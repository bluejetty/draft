// A section's garage rule, read off the drawn sheet.
//
// Board #346: LAYOUT.dc.html's env.edgeOnOutline is the one caller of the
// point-to-segment copy that collapsed onto window.DraftGeometry2D. Nothing
// exercised it -- breaking the shared export outright left every layout spec
// green -- so the collapse was landing unobserved. This is that observable.
//
// The rule it watches is cut-view.js's audit C5: a garage is a slab on grade,
// so the HOUSE's slab and level band span the house's bearing walls and never
// the garage's. Which walls are the garage's is decided by edgeOnOutline, wall
// by wall, against the garage outlines on that wall's own level.
//
// Two cuts through one building, each rendered twice with only the outlines'
// `garage` flag flipped -- identical geometry, so the ink difference is the
// rule and nothing else:
//
//   cut through the garage  -- the flag SUPPRESSES the house slab, so the
//                              garage read draws strictly less ink
//   cut through the house   -- a garage away from the cut changes nothing, so
//                              the two reads are identical
//
// The pair is two-sided. An edgeOnOutline stuck on false fails the first (no
// wall is ever the garage's, the slab draws across it); stuck on true it fails
// the second (every wall is the garage's, the house loses its own slab).
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17, PH = 11, FIT_MARGIN = 60;
const point = (x, z) => ({ x, y: 0, z });

// A 36x26 house with a 24x20 garage hung off its east wall, x 36..60, z 4..24.
// The garage outline is stored on BOTH the main floor and the foundation:
// garageOfWall asks for the outlines on the WALL's level, and it is the
// foundation walls that carry the slab rule.
function garageHouse({ cutX, garage }) {
  const wall = (id, levelId, view, sx, sz, ex, ez, body) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: 9, refLine: 'left', ...(body ? { body } : {}),
  });
  const house = (base, levelId, view) => [
    wall(base + 1, levelId, view, 0, 0, 36, 0),
    wall(base + 2, levelId, view, 36, 0, 36, 26),
    wall(base + 3, levelId, view, 36, 26, 0, 26),
    wall(base + 4, levelId, view, 0, 26, 0, 0),
  ];
  const garageWalls = (base, levelId, view) => [
    wall(base + 1, levelId, view, 36, 4, 60, 4, 'garage'),
    wall(base + 2, levelId, view, 60, 4, 60, 24, 'garage'),
    wall(base + 3, levelId, view, 60, 24, 36, 24, 'garage'),
  ];
  const garagePts = [point(36, 4), point(60, 4), point(60, 24), point(36, 24)];
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [
      ...house(100, 3, 'plan'), ...house(200, 1, 'foundation'),
      ...garageWalls(300, 3, 'plan'), ...garageWalls(400, 1, 'foundation'),
    ],
    outlines: [
      { id: 'g1', masterId: null, levelId: 3, garage, points: garagePts },
      { id: 'g2', masterId: null, levelId: 1, garage, points: garagePts },
    ],
    lines: [], floors: [], roofs: [], shapes: [], dimensions: [],
    cuts: [{
      id: 1, name: 'S1', elev: 0, levelId: 3,
      startPt: { x: cutX, z: -4 }, endPt: { x: cutX, z: 30 }, dirVec: { x: 1, z: 0 },
    }],
    fenestrations: [], layout: { auto: true },
  };
}

async function openLayout(page, saved) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, doc }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(doc)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, doc: saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

// Non-white pixels inside the auto-composed section viewport, the same way
// layout-compose.spec.js reads a sheet.
async function sectionInk(page, saved) {
  await openLayout(page, saved);
  const layout = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text()).layout;
  }, BUCKET);
  const section = (layout.viewports || []).find(viewport => viewport.kind === 'section');
  expect(section, 'the auto layout composed a section viewport').toBeTruthy();
  await page.locator(`[data-layout-sheet="${section.sheet}"]`).click();
  await page.waitForTimeout(250);
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return page.evaluate(({ zoom: z, panX, panY, xIn, yIn, radiusIn }) => {
    const ctx = document.querySelector('[data-layout-canvas]').getContext('2d');
    const r = Math.round(radiusIn * z);
    const cx = Math.round(panX + xIn * z), cy = Math.round(panY + yIn * z);
    const data = ctx.getImageData(cx - r, cy - r, r * 2, r * 2).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, {
    zoom,
    panX: (box.width - PW * zoom) / 2,
    panY: (box.height - PH * zoom) / 2,
    xIn: section.xIn, yIn: section.yIn, radiusIn: 3.5,
  });
}

test('a cut through the garage draws no house slab across it', async ({ page }) => {
  const asGarage = await sectionInk(page, garageHouse({ cutX: 48, garage: true }));
  const asHouse = await sectionInk(page, garageHouse({ cutX: 48, garage: false }));
  // The same two foundation walls either way; only the slab and the level band
  // between them come and go. A few hundred pixels of difference would be
  // noise, a band across a 24ft bay is thousands.
  expect(asHouse - asGarage).toBeGreaterThan(1000);
});

test('a garage away from the cut leaves the house section alone', async ({ page }) => {
  const withGarage = await sectionInk(page, garageHouse({ cutX: 18, garage: true }));
  const withoutGarage = await sectionInk(page, garageHouse({ cutX: 18, garage: false }));
  expect(withGarage).toBe(withoutGarage);
});
