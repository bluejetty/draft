// THE MAIN FLOOR'S BEAM AND POSTS SHOW ON THE 2ND FL LAYOUT (jb, 26 Nov 2026:
// "also the main floor beam and column should show on the 2nd floor layout
// with lighter shading (like how it shows the foundation beam and columns on
// the main floor layout").
//
// AUTO BEAM files a storey's beam on its FLOOR view and the floor layout above
// already drew those. A beam drawn with the BEAM tool or PASTEd on the 1 MAIN
// FL PLAN (WALLS) is filed on 'plan' (model/08 pasteHeld), and the 2ND FL
// LAYOUT never looked there: on jb's file the ENGD LVL BEAM by the stair, and
// its two posts, showed on the main floor plan and not on the layout above.
// Either view of the level under is now structure under the floor (model/01
// paintBeamsBelow, layout-plan heldByUnder) -- on MAIN FL that is FOUNDATION
// and BASEMENT (WALLS) both.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const P = (x, z) => ({ x, y: 0, z });
const BOX = [[-20, -16], [20, -16], [20, 16], [-20, 16]].map(([x, z]) => P(x, z));
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'o3', levelId: 3, garage: false, points: BOX },
    { id: 'o5', levelId: 5, garage: false, points: BOX }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [
    // AUTO BEAM's foundation row, and a hand beam on BASEMENT (WALLS).
    { id: 1, start: P(-20, 0), end: P(20, 0), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
    { id: 2, start: P(-20, -8), end: P(0, -8), levelId: 1, view: 'plan', mode: 'flush' },
    // The main floor's, drawn (or pasted) on its walls plan.
    { id: 3, start: P(-10, 6), end: P(10, 6), levelId: 3, view: 'plan', mode: 'flush' },
  ],
  columns: [
    { id: 1, point: P(0, 0), levelId: 1, view: 'foundation', footing: 'pad36', auto: true },
    { id: 2, point: P(-10, -8), levelId: 1, view: 'plan', footing: 'pad24' },
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

test('the 2ND FL LAYOUT draws the main floor beam and posts drawn on its walls plan, lighter', async ({ page }) => {
  await open(page, '/MODEL.html?level=5&view=floor');
  const plan = page.locator('#plan');
  await expect(plan).toHaveAttribute('data-beams-below', '1');
  await expect(plan).toHaveAttribute('data-posts-below', '2');
});

test('the 1 MAIN FL LAYOUT draws FOUNDATION\'s and BASEMENT (WALLS)\'s, not its own walls plan\'s', async ({ page }) => {
  await open(page, '/MODEL.html?level=3&view=floor');
  const plan = page.locator('#plan');
  await expect(plan).toHaveAttribute('data-beams-below', '2');
  await expect(plan).toHaveAttribute('data-posts-below', '2');
});

test('the main floor walls plan keeps its beam as its own, nothing borrowed below', async ({ page }) => {
  await open(page, '/MODEL.html?level=3&view=plan');
  await expect(page.locator('#plan')).toHaveAttribute('data-beams-below', '0');
  const own = await page.evaluate(() => beams().map(b => b.id));
  expect(own).toEqual([3]);
});
