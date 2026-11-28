// THE BASEMENT (WALLS) SEAT FRAMES THE WHOLE BASEMENT (jb, 19 Nov 2026:
// "the BASEMENT layout little layout on right side - it is zoomed in for some
// reason ?").
//
// A made foundation type with basement slices (the stock 8" CONC + 2X6 BSMT)
// is drawn on FOUNDATION, and the BASEMENT (WALLS) plan paints its basement
// slices under the basement's own walls (basementFoundationWalls). Those
// walls are the basement's outline -- but allPoints() measured only the
// level's OWN walls, so a basement holding a stair and one short wall framed
// that short wall and the seat showed a zoomed-in corner of hatch.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SHOTS = process.env.BASEMENT_SEAT_SHOTS || '';
const STOCK = 'wt_stock_conc8_bsmt';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8, ...extra });
const F = (id, a, b) => W(id, a, b, { levelId: 1, view: 'foundation', wallType: STOCK, widthIn: 14,
  refLine: 'left', baseHeight: -8, topHeight: 0 });
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2, nextDrawingItemId: 40,
  walls: [
    W('n1', [0, 0], [40, 0]), W('n2', [40, 0], [40, 20]), W('n3', [40, 20], [0, 20]), W('n4', [0, 20], [0, 0]),
    // The basement is the foundation loop: drawn once, on FOUNDATION.
    F('fn', [0, 0], [40, 0]), F('fe', [40, 0], [40, 20]), F('fs', [40, 20], [0, 20]), F('fw', [0, 20], [0, 0]),
    // And one short wall of the basement's own, at the east end.
    W('bp', [36, 2], [36, 6], { levelId: 1, wallType: 'stud_2x4' })],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});

// Where the seat's ink lies, as a share of the seat's width and height.
const inkBox = seat => seat.evaluate(el => {
  const c = el.querySelector('canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] < 40) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0: x0 / c.width, x1: x1 / c.width, y0: y0 / c.height, y1: y1 / c.height };
});

test('the BASEMENT (WALLS) seat shows the whole foundation loop, not the short wall zoomed in', async ({ page }) => {
  await h.openEditor(page, { drawing: drawing(), bucket: BUCKET, url: '/MODEL.html?left=1&right=1&level=1&view=plan', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const seat = page.locator('#view-rail .seat', { hasText: 'BASEMENT (WALLS)' });
  await expect(seat).toHaveCount(1);
  await page.waitForTimeout(800);
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/page.png` });
    await seat.screenshot({ path: `${SHOTS}/seat.png` });
  }
  const box = await inkBox(seat);
  // The 40 x 20 ft loop: ink from near one side of the seat to near the
  // other, with paper left round it -- not hatch cut off at both edges.
  expect(box.x0).toBeGreaterThan(0.02);
  expect(box.x1).toBeLessThan(0.98);
  expect(box.x1 - box.x0).toBeGreaterThan(0.6);
});
