// SITE PLAN AND BASEMENT (WALLS) SEATS (jb, 25 Nov 2026: "the SITE PLAN and
// BASEMENT don't show LAYOUT small views ? how come?" -- "the site plan is
// just a line").
//
// SITE: his lot is 895 ft across. fit() never zoomed out past 0.25 px/ft, so
// in a seat 82px wide the lot was drawn 220px wide and the seat caught one
// edge of it; and the seat painted only the lot line, not the building the
// main SITE view stands on it (drawSitePlan).
// BASEMENT: a house whose basement holds no walls of its own. The main view
// ghosts the foundation walls on that plan; the seat painted nothing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BLANK = {
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};
const box = (prefix, x0, z0, x1, z1, levelId, view) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]
  .map(([sx, sz, ex, ez], i) => ({ id: `${prefix}${i + 1}`, levelId, view,
    start: { x: sx, y: 0, z: sz }, end: { x: ex, y: 0, z: ez },
    wallType: 'stud_2x6', refLine: 'left', baseHeight: 0, topHeight: 9 }));
// A long lot, the shape of his: 900 ft by 350 ft, a 400 ft building on it.
const LOT = { id: 900, site: true, levelId: 8,
  points: [{ x: -450, z: -175 }, { x: 450, z: -175 }, { x: 450, z: 175 }, { x: -450, z: 175 }] };
const HOUSE = {
  ...BLANK,
  // The traced outline of the house: the footprint the SITE shades.
  outlines: [LOT, { id: 901, levelId: 3,
    points: [{ x: -200, z: -30 }, { x: 200, z: -30 }, { x: 200, z: 30 }, { x: -200, z: 30 }] }],
  walls: [...box('m', -200, -30, 200, 30, 3, 'plan'), ...box('f', -200, -30, 200, 30, 1, 'foundation')],
};

async function openRail(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, drawing);
  await page.goto('/MODEL.html?left=1&right=1&level=3&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(800);
}
// Inked pixels in each third of a seat's canvas, left to right.
const thirds = seat => seat.evaluate(el => {
  const c = el.querySelector('canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const n = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 40) continue;
    n[Math.min(2, Math.floor((((i / 4) % c.width) / c.width) * 3))] += 1;
  }
  return n;
});

test('the SITE PLAN seat shows the whole lot and the building on it', async ({ page }) => {
  // The lot alone first, for what its line puts in the middle third.
  await openRail(page, { ...BLANK, outlines: [LOT] });
  const lotOnly = (await thirds(page.locator('#view-rail .seat', { hasText: 'SITE PLAN' })))[1];
  await openRail(page, HOUSE);
  const seat = page.locator('#view-rail .seat', { hasText: 'SITE PLAN' });
  await expect(seat).toHaveCount(1);
  const [left, middle, right] = await thirds(seat);
  // Both ends of the lot are in the seat, not one edge of it.
  expect(left, 'the lot\'s west end').toBeGreaterThan(30);
  expect(right, 'the lot\'s east end').toBeGreaterThan(30);
  // And the building, which only the footprint pass (drawSitePlan) draws.
  expect(middle, 'the building on the lot').toBeGreaterThan(lotOnly + 60);
});

test('the BASEMENT (WALLS) seat shows the foundation it stands in', async ({ page }) => {
  await openRail(page, HOUSE);
  const seat = page.locator('#view-rail .seat', { hasText: 'BASEMENT (WALLS)' });
  await expect(seat).toHaveCount(1);
  const n = await thirds(seat);
  expect(n[0] + n[1] + n[2], 'the foundation ghost').toBeGreaterThan(100);
  // Framed on it: both ends of the 400 ft foundation are in the seat.
  expect(n[0]).toBeGreaterThan(10);
  expect(n[2]).toBeGreaterThan(10);
});

// NO LOT DRAWN (jb, 28 Nov 2026: "the site plan layout small window is
// zooming in too far"). The seat paints the house's footprint, but framed
// only the SITE level's own records -- none without a lot -- so it fell to
// 6 px/ft at the origin and showed one corner of the house.
test('the SITE PLAN seat fits the whole house when no lot is drawn', async ({ page }) => {
  const house = {
    ...BLANK,
    outlines: [{ id: 901, levelId: 3,
      points: [{ x: 10, z: 5 }, { x: 50, z: 5 }, { x: 50, z: 29 }, { x: 10, z: 29 }] }],
    walls: box('m', 10, 5, 50, 29, 3, 'plan'),
  };
  await openRail(page, house);
  const seat = page.locator('#view-rail .seat', { hasText: 'SITE PLAN' });
  await expect(seat).toHaveCount(1);
  const [left, middle, right] = await thirds(seat);
  // Both ends of the house, and its middle, are in the seat.
  expect(left, 'the house\'s west end').toBeGreaterThan(30);
  expect(right, 'the house\'s east end').toBeGreaterThan(30);
  expect(middle, 'the house\'s middle').toBeGreaterThan(30);
});
