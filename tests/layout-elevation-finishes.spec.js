// THE EXT. FINISH HATCHES PRINT ON THE LAYOUT ELEVATIONS.
//
// jb, 26 Nov 2026, on CONSTRUCTION LAYOUT sheet 2 ELEVATIONS: "and then i
// also need the elevation hatches to show in the construction plan too".
// The siding, shake, stucco dark, bands and roofing set on EXT. FINISH drew
// there and nowhere else: LAYOUT never asked the painter for `finishes`, and
// never loaded finish-patterns.js / roof-patterns.js that the painter reads
// them from. The same drawing, clad and plain, must now differ in the ink
// inside every elevation frame -- and only in the elevations.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

function drawing(finish) {
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
    ...(finish && view === 'plan' ? { finish } : {}),
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
    layout: { auto: true },
  };
}

async function openLayout(page, saved) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

// Every non-white pixel inside each frame of `kind` on the open sheet. The
// hatch is drawn at half strength, so the count takes any ink at all.
async function inkIn(page, kind) {
  const frames = JSON.parse(await page.locator('[data-layout-canvas]').getAttribute('data-layout-frames'))
    .filter(f => f.kind === kind);
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  const m = { zoom, panX: (box.width - PW * zoom) / 2, panY: (box.height - PH * zoom) / 2 };
  return page.evaluate(({ frames, m }) => {
    const c = document.querySelector('[data-layout-canvas]');
    const dpr = c.width / c.getBoundingClientRect().width;
    const ctx = c.getContext('2d');
    return frames.map(f => {
      const x = Math.round((m.panX + f.xIn * m.zoom) * dpr), y = Math.round((m.panY + f.yIn * m.zoom) * dpr);
      const w = Math.max(1, Math.round(f.wIn * m.zoom * dpr)), hh = Math.max(1, Math.round(f.hIn * m.zoom * dpr));
      const d = ctx.getImageData(x, y, w, hh).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 235 && d[i + 3] > 0) n += 1;
      return n;
    });
  }, { frames, m });
}

async function sheetInk(page, saved, kind) {
  await openLayout(page, saved);
  const layout = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text()).layout;
  }, BUCKET);
  const v = layout.viewports.find(vp => vp.kind === kind);
  expect(v, `a ${kind} viewport on the set`).toBeTruthy();
  await page.locator(`[data-layout-sheet="${v.sheet || 1}"]`).click();
  await page.waitForTimeout(400);
  return inkIn(page, kind);
}

test('the page loads the two hatch painters the elevation reads', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const loaded = await page.evaluate(() => ({
    walls: typeof window.DraftFinishPatterns?.drawFinish === 'function',
    roofs: typeof window.DraftRoofPatterns === 'object' && !!window.DraftRoofPatterns,
  }));
  expect(loaded).toEqual({ walls: true, roofs: true });
});

test('siding set on EXT. FINISH hatches every LAYOUT elevation', async ({ page }) => {
  const plain = await sheetInk(page, drawing(null), 'elevation');
  const clad = await sheetInk(page, drawing('siding_h'), 'elevation');
  expect(plain.length, 'elevations on the sheet').toBeGreaterThan(0);
  expect(clad.length).toBe(plain.length);
  clad.forEach((n, i) => expect(n, `elevation ${i + 1} carries the siding courses`)
    .toBeGreaterThan(plain[i] * 1.3));
});

test('a section viewport stays line work', async ({ page }) => {
  const plain = await sheetInk(page, drawing(null), 'section');
  const clad = await sheetInk(page, drawing('siding_h'), 'section');
  expect(clad.length).toBe(plain.length);
  clad.forEach((n, i) => expect(Math.abs(n - plain[i]), `section ${i + 1} unchanged`)
    .toBeLessThanOrEqual(Math.max(20, plain[i] * 0.02)));
});
