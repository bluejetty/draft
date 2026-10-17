// THE PLAN SHEETS: the window fills the sheet, the site plan takes an
// engineer's scale, and it flies the north arrow by convention.
//
// Movie, 16 Oct: "on every PLAN-view sheet (site, roof, floor, foundation)
// the viewport frame takes the largest area inside the border lines, the
// title centred near the bottom line. The drawing's scale stays as it is";
// "SITE PLAN: north arrow ON by default, up in the top-right corner area";
// and on the site plan's scale, "when the lots are larger i may have
// problems".
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17, PH = 11, FIT_MARGIN = 60;
const STRIP_X = PW - 0.5 - 1.15 / 2;        // the titleblock strip's centreline
const ARROW_MID_Y = 0.5 + (PH - 1) * 0.05;  // inside the north-arrow cell
// The composer's region on 11x17 landscape with the ROUGH DRAFTER strip:
// half-inch margins, the 1.15" strip, no corner to clear (LSQUARE01 wears
// sharp corners), and the 0.3" caption line the window leaves under itself.
const REGION = { x: 0.5, y: 0.5, w: 17 - 1 - 1.15, h: 11 - 1 };
const LABEL_IN = 0.3;

const point = (x, z) => ({ x, y: 0, z });
function drawing({ lot = [80, 200] } = {}) {
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
  const [lw, ld] = lot;
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
      points: [{ x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 }, { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 }],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    outlines: [{
      id: 'site', levelId: 8, site: true,
      points: [point(-lw / 2 + 18, -ld / 2 + 13), point(lw / 2 + 18, -ld / 2 + 13),
        point(lw / 2 + 18, ld / 2 + 13), point(-lw / 2 + 18, ld / 2 + 13)],
    }],
    cuts: [],
    fenestrations: [],
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
const savedLayout = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).layout;
}, BUCKET);
const frames = async page => JSON.parse(await page.locator('[data-layout-canvas]').getAttribute('data-layout-frames'));
async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return { zoom, panX: (box.width - PW * zoom) / 2, panY: (box.height - PH * zoom) / 2 };
}
async function inkAround(page, xIn, yIn, radiusIn = 0.5) {
  const m = await sheetMetrics(page);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const data = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2)).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, { cx: m.panX + xIn * m.zoom, cy: m.panY + yIn * m.zoom, r: radiusIn * m.zoom });
}
const goSheet = async (page, n) => {
  await page.locator(`[data-layout-sheet="${n}"]`).click();
  await page.waitForTimeout(300);
};

test('the site plan takes the engineer\'s rung the lot fits, and says so', async ({ page }) => {
  await openLayout(page, drawing({ lot: [80, 200] }));
  const layout = await savedLayout(page);
  const site = layout.viewports.find(v => v.kind === 'plan' && Number(v.levelId) === 8);
  expect(site, 'the SITE PLAN was dealt').toBeTruthy();
  // 200 ft runs down a 10" sheet: 1" = 20' wants 10" and the caption line
  // too, so the rung is 1" = 30' -- 6.7" of lot with paper to spare.
  expect(site.pif).toBeCloseTo(1 / 30, 9);
  const f = (await frames(page)).find(x => x.id === site.id);
  expect(f.pif).toBeCloseTo(1 / 30, 9);
  // A bigger lot steps down the same ladder, never onto the architect's.
  await openLayout(page, drawing({ lot: [150, 300] }));
  const big = (await savedLayout(page)).viewports.find(v => v.kind === 'plan' && Number(v.levelId) === 8);
  expect(big.pif).toBeCloseTo(1 / 40, 9);
});

test('every plan sheet\'s window takes the largest area inside the border, the caption under it', async ({ page }) => {
  await openLayout(page, drawing());
  const layout = await savedLayout(page);
  const plans = layout.viewports.filter(v => v.kind === 'plan');
  expect(plans.map(v => Number(v.levelId)).sort((a, b) => a - b)).toEqual([1, 3, 7, 8]);
  for (const plan of plans) {
    await goSheet(page, plan.sheet);
    const list = await frames(page);
    expect(list.length, `sheet ${plan.sheet} holds one window`).toBe(1);
    const f = list[0];
    expect(f.xIn, `${plan.levelId} left`).toBeCloseTo(REGION.x, 2);
    expect(f.yIn, `${plan.levelId} top`).toBeCloseTo(REGION.y, 2);
    expect(f.wIn, `${plan.levelId} width`).toBeCloseTo(REGION.w, 2);
    expect(f.hIn, `${plan.levelId} height`).toBeCloseTo(REGION.h - LABEL_IN, 2);
    // The drawing itself stays centred at the rung the ladder chose: the
    // viewport's centre is the region's, and the window is the crop.
    expect(plan.xIn).toBeCloseTo(REGION.x + REGION.w / 2, 2);
    expect(plan.yIn).toBeCloseTo(REGION.y + (REGION.h - LABEL_IN) / 2, 2);
  }
  // The house at 1/4" would be 9" x 6.5" plus allowance: the window is far
  // bigger than the drawing, which is the point -- the scale did not move.
  const main = plans.find(v => Number(v.levelId) === 3);
  expect(main.pif).toBe(1 / 4);
});

test('the site plan sheet flies the north arrow by convention; the next sheet waits for the toggle', async ({ page }) => {
  await openLayout(page, drawing());
  const layout = await savedLayout(page);
  const site = layout.viewports.find(v => v.kind === 'plan' && Number(v.levelId) === 8);
  await expect(page.locator('[data-layout-north]')).toContainText('Off');
  await goSheet(page, site.sheet);
  expect(await inkAround(page, STRIP_X, ARROW_MID_Y, 0.25), 'the arrow on the site plan').toBeGreaterThan(20);
  await goSheet(page, site.sheet + 1);
  expect(await inkAround(page, STRIP_X, ARROW_MID_Y, 0.25), 'bare on the elevations').toBe(0);
  expect((await savedLayout(page)).northArrow, 'the toggle itself is untouched').toBeFalsy();
});
