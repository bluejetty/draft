// A LINE LANDS ON THE VIEW IT WAS DRAWN ON (jb, 16 Nov 2026: "i tried to draw
// a line on the floor layout, but it drew it on the floor plan instead").
//
// The LINE tool filed every line under the WALLS' home view -- 'plan' unless
// FOUNDATION -- so a line drawn on a FLOOR LAYOUT saved to the walls plan and
// vanished from the layout it was drawn on. The old page (MODEL.dc.html
// `_commitLine`) files a line under the active view; so does this one now.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const HOUSE = [point(0, 0), point(24, 0), point(24, 30), point(0, 30)];
const fixture = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 2,
  walls: HOUSE.map((pt, i) => ({
    id: 100 + i, start: pt, end: HOUSE[(i + 1) % HOUSE.length], levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], stairs: [], notes: [],
  roomTags: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  outlines: [{ id: 1, levelId: 3, points: HOUSE, garage: false }],
  floors: [{ id: 'deck-3', levelId: 3, view: 'floor', structure: 'floor', points: HOUSE }],
  beams: [], columns: [],
});

async function open(page, query) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: fixture() });
  await page.goto(`/MODEL.html?left=1&lpane=drafting&${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
  return h.planFrame(page);
}
const drawLine = async (page, at) => {
  await page.keyboard.press('l');
  await page.mouse.click(...at(4, 10)); await page.waitForTimeout(60);
  await page.mouse.click(...at(16, 10)); await page.waitForTimeout(60);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
};
const savedLines = page => page.evaluate(() => (drawing.lines || [])
  .map(l => ({ levelId: Number(l.levelId), view: l.view })));
const shownLines = page => page.evaluate(() => lines().length);

test('a line drawn on the MAIN FL FLOOR LAYOUT saves to that layout and shows there, not on the walls plan', async ({ page }) => {
  const { at } = await open(page, 'level=3&view=floor');
  expect(await h.modelViewId(page)).toBe('floor');
  await drawLine(page, at);
  expect(await savedLines(page)).toEqual([{ levelId: 3, view: 'floor' }]);
  expect(await shownLines(page), 'the layout it was drawn on shows it').toBe(1);
  await h.pickModelLayer(page, 3, 'plan');
  await page.waitForTimeout(150);
  expect(await shownLines(page), 'the walls plan does not').toBe(0);
});

test('a line drawn on the walls plan still saves to the plan', async ({ page }) => {
  const { at } = await open(page, 'level=3&view=plan');
  await drawLine(page, at);
  expect(await savedLines(page)).toEqual([{ levelId: 3, view: 'plan' }]);
});
