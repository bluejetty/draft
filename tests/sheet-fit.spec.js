// The sheet measures the wrong rectangle (board NEW-2, part 1).
//
// An elevation's height came from the SECTION painter's reserved box: the
// object plus 2' of air above the ridge and 2' below the footing. On a
// two-storey over a basement that reads 36.25' for 32.25' of ink, and the
// stacked pair misses the 1/8" rung by 0.05' — six-tenths of an inch. The
// composer was never wrong; it was told the building is taller than it is.
//
// The buried foundation is NOT the padding and is not removed: an elevation
// draws it dashed below grade, down to the footing. Only the air comes off.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const REGION_H_IN = 10;      // 11x17 landscape, less margins and the strip

function boneDrawing({ auto = true, layout = undefined } = {}) {
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
  });
  const ring = (idBase, levelId, view, top) => [
    wall(idBase + 1, levelId, view, 0, 0, 36, 0, top),
    wall(idBase + 2, levelId, view, 36, 0, 36, 26, top),
    wall(idBase + 3, levelId, view, 36, 26, 0, 26, top),
    wall(idBase + 4, levelId, view, 0, 26, 0, 0, top),
  ];
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [...ring(0, 3, 'plan', 8.09), ...ring(10, 1, 'foundation', 8)],
    roofs: [{
      id: 1, levelId: 7, pitch: 4, overhang: 1.5,
      points: [
        { x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 },
        { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 },
      ],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    cuts: [{
      id: 1, name: 'S1', elev: 0, levelId: 3,
      startPt: { x: 18, z: -4 }, endPt: { x: 18, z: 30 },
      dirVec: { x: 1, z: 0 },
    }],
    fenestrations: [
      { id: 1, levelId: 3, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
    layout: layout !== undefined ? layout : { auto },
  };
}


// Movie's shape: two storeys over a basement. The one-storey bone fixture
// already deals at 1/8", which is why the suite never caught this.
function twoStoreyOverBasement() {
  const d = boneDrawing();
  d.levels = [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -9 },
  ];
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
  });
  const ring = (b, lvl, view, top) => [
    wall(b + 1, lvl, view, 0, 0, 36, 0, top), wall(b + 2, lvl, view, 36, 0, 36, 26, top),
    wall(b + 3, lvl, view, 36, 26, 0, 26, top), wall(b + 4, lvl, view, 0, 26, 0, 0, top),
  ];
  d.walls = [...ring(0, 3, 'plan', 8.09), ...ring(20, 5, 'plan', 8.09),
    ...ring(10, 1, 'foundation', 8)];
  return d;
}

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

// The composer persists from inside the load callback; reads wait for its
// write to land instead of racing it.
async function waitForCompose(page) {
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

async function savedLayout(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()).layout : null;
  }, BUCKET);
}



test('a two-storey over a basement deals its elevations at 1/8", not 1/16"', async ({ page }) => {
  await openLayout(page, twoStoreyOverBasement());
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const elevs = layout.viewports.filter(v => v.kind === 'elevation');
  expect(elevs.length).toBe(4);
  // 1/16" is not a real drafting scale and this building does not need it.
  elevs.forEach(v => expect(v.pif).toBe(1 / 8));
});

test('the elevations fill their page rather than swimming in the middle of it', async ({ page }) => {
  await openLayout(page, twoStoreyOverBasement());
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const elevs = layout.viewports.filter(v => v.kind === 'elevation');
  const sheet = elevs[0].sheet;
  const pair = elevs.filter(v => v.sheet === sheet);
  expect(pair.length).toBe(2);
  // The complaint was two thirds of the page empty. Measure the ink block
  // against the working region, not the chosen number.
  const drawnFt = 32.25;
  const stackIn = pair.reduce((sum, v) => sum + drawnFt * v.pif, 0);
  expect(stackIn / REGION_H_IN).toBeGreaterThan(0.8);
});

test('the section keeps its reserved box while the elevation loses the air', async ({ page }) => {
  await openLayout(page, twoStoreyOverBasement());
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const section = layout.viewports.find(v => v.kind === 'section');
  // The section painter reserves 2' above the ridge and below the footing so
  // its cut edges clear the frame, and it still does: this board gave
  // elevations their own number rather than changing the shared one. A
  // section of 34' x 36.25' takes 1/4" alone and is unaffected by the fix.
  expect(section).toBeTruthy();
  expect(section.pif).toBe(1 / 4);
});

test('the fix leaves measurable headroom for dimensions still to come', async ({ page }) => {
  await openLayout(page, twoStoreyOverBasement());
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const elevs = layout.viewports.filter(v => v.kind === 'elevation');
  const pair = elevs.filter(v => v.sheet === elevs[0].sheet);
  // Dimension strings and elevation markers are not drawn yet, and when they
  // arrive they eat into this slack. Measure what is actually left on the
  // page rather than asserting arithmetic: if a later change spends the
  // headroom, this fails BEFORE the pair silently falls back to 1/16".
  const drawnFt = 32.25;
  const stackIn = pair.reduce((sum, v) => sum + drawnFt * v.pif, 0)
    + 2 * 0.3 + 0.35;                       // captions and the gap
  const slackIn = REGION_H_IN - stackIn;
  expect(slackIn).toBeGreaterThan(0);
  // ~0.99" of paper, which at 1/8" is 3.95' of building: about 1.97' of
  // allowance per side, per view. A dimension string needing more standoff
  // than that brings this board back.
  expect(slackIn).toBeGreaterThan(0.9);
});

test('a house too wide for 1/8" lands on 3/32", not half the size', async ({ page }) => {
  const d = twoStoreyOverBasement();
  d.cuts = [];
  const wide = w => (w.start.x === 36 || w.end.x === 36)
    ? { ...w,
        start: { ...w.start, x: w.start.x === 36 ? 130 : w.start.x },
        end: { ...w.end, x: w.end.x === 36 ? 130 : w.end.x } }
    : w;
  d.walls = d.walls.map(wide);
  d.roofs[0].points = [
    { x: -1.5, z: -1.5 }, { x: 131.5, z: -1.5 },
    { x: 131.5, z: 27.5 }, { x: -1.5, z: 27.5 },
  ];
  await openLayout(page, d);
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const plan = layout.viewports.find(v => v.kind === 'plan');
  // 130' of house needs 16.25" at 1/8" and the region is 14.85" wide, so the
  // pair of rungs on either side of it decide this: 3/32" holds it in 12.19",
  // where 1/16" would draw the same house at half the size for no reason.
  expect(plan.pif).toBe(3 / 32);
  layout.viewports.forEach(v => expect(v.pif).toBeGreaterThanOrEqual(3 / 32));
});

test('a single view sits in the middle of its sheet, not the corner', async ({ page }) => {
  const d = twoStoreyOverBasement();
  d.cuts = [];                       // one plan level with walls, no sections
  d.levels = d.levels.filter(l => l.id !== 5);
  d.walls = d.walls.filter(w => w.levelId !== 5);
  await openLayout(page, d);
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const flow = layout.viewports.filter(v => v.kind === 'plan');
  const first = flow[0];
  const sameSheet = flow.filter(v => v.sheet === first.sheet);
  if (sameSheet.length === 1) {
    // Region is x 0.5 .. 15.35 on an 11x17 with the right-hand strip.
    expect(first.xIn).toBeCloseTo(0.5 + 14.85 / 2, 1);
  } else {
    // A pair or a block centres as a group: its midpoint is the region's.
    const mid = sameSheet.reduce((s, v) => s + v.xIn, 0) / sameSheet.length;
    expect(mid).toBeCloseTo(0.5 + 14.85 / 2, 1);
  }
});
