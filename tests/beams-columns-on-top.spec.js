// BEAMS AND COLUMNS ON TOP (jb, 28 Nov 2026: "can you bring the BEAM and
// columns to the top layer"). On jb's 2ND FL PLAN (WALLS) an ENG'D LVL BEAM
// ran along the stairwell and the stair's lines were drawn over it and its
// posts. MODEL now paints beams and columns after the walls, fixtures and
// stairs (model/03 paint), as a LAYOUT sheet already did (plan-composition:
// structure after the stairs); the dimensions, notes and selection stay over
// them. A column's PAD stays down with the concrete, under the walls.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const P = (x, z) => ({ x, y: 0, z });
const BOX = [[-20, -16], [20, -16], [20, 16], [-20, 16]].map(([x, z]) => P(x, z));
const wall = (id, levelId, view, a, b) => ({ id, levelId, view, start: P(...a), end: P(...b),
  wallType: 'ext-2x6', height: 8 });
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 40,
  walls: [wall(10, 3, 'plan', [-20, -16], [20, -16]), wall(11, 1, 'foundation', [-20, -16], [20, -16])],
  lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'o3', levelId: 3, garage: false, points: BOX },
    { id: 'o5', levelId: 5, garage: false, points: BOX }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [
    { id: 1, start: P(-20, 0), end: P(20, 0), levelId: 1, view: 'foundation', mode: 'flush' },
    { id: 3, start: P(-10, 6), end: P(10, 6), levelId: 3, view: 'plan', mode: 'flush' },
    { id: 4, start: P(-10, -6), end: P(10, -6), levelId: 3, view: 'floor', mode: 'flush' },
  ],
  columns: [
    { id: 1, point: P(0, 0), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 3, point: P(-10, 6), levelId: 3, view: 'plan', footing: 'pad24' },
    { id: 4, point: P(10, 6), levelId: 3, view: 'plan', footing: 'pad24' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page, url) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, drawing());
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The order the painters are called in on one repaint, first call of each.
const paintOrder = page => page.evaluate(() => {
  // render-2d's export is frozen, so a wrapped copy stands in for one paint;
  // every MODEL painter reads window.DraftRender2D at call time.
  const R = window.DraftRender2D;
  const names = ['drawPadGroup2D', 'drawWallSeg2D', 'drawFixture2D', 'drawStairs2D',
    'drawBeam2D', 'drawColumn2D', 'drawDimension2D'];
  const seen = [];
  const spy = { ...R };
  names.forEach(name => {
    if (typeof R[name] !== 'function') return;
    spy[name] = (...args) => { if (!seen.includes(name)) seen.push(name); return R[name](...args); };
  });
  window.DraftRender2D = spy;
  try { paint(); } finally { window.DraftRender2D = R; }
  return seen;
});

test('MODEL walls plan: beams and columns are painted after the walls and the stairs', async ({ page }) => {
  await open(page, '/MODEL.html?level=3&view=plan');
  const order = await paintOrder(page);
  for (const top of ['drawBeam2D', 'drawColumn2D']) {
    expect(order).toContain(top);
    expect(order.indexOf(top)).toBeGreaterThan(order.indexOf('drawWallSeg2D'));
    expect(order.indexOf(top)).toBeGreaterThan(order.indexOf('drawStairs2D'));
  }
  // The beam over this plan (dash-dot) is in the same top pass.
  await expect(page.locator('#plan')).toHaveAttribute('data-beams-above', '1');
});

test('MODEL foundation: the pad stays under the walls, the beam and post go over them', async ({ page }) => {
  await open(page, '/MODEL.html?level=1&view=foundation');
  const order = await paintOrder(page);
  expect(order.indexOf('drawPadGroup2D')).toBeGreaterThanOrEqual(0);
  expect(order.indexOf('drawPadGroup2D')).toBeLessThan(order.indexOf('drawWallSeg2D'));
  expect(order.indexOf('drawBeam2D')).toBeGreaterThan(order.indexOf('drawWallSeg2D'));
  expect(order.indexOf('drawColumn2D')).toBeGreaterThan(order.indexOf('drawStairs2D'));
});

test('MODEL floor layout: the beam under this floor is painted over the stairs too', async ({ page }) => {
  await open(page, '/MODEL.html?level=5&view=floor');
  await expect(page.locator('#plan')).toHaveAttribute('data-beams-below', '2');
  const order = await paintOrder(page);
  expect(order.indexOf('drawBeam2D')).toBeGreaterThan(order.indexOf('drawStairs2D'));
  expect(order.indexOf('drawColumn2D')).toBeGreaterThan(order.indexOf('drawStairs2D'));
});
