// THE FIREPLACE'S CENTRE TAB (jb, 28 Nov 2026): "can you make a 'tab' on the
// fireplace right in the dead center of the fireplace (widthwise) so i can
// pick up and move it to the center of the dimension line and therefore
// center it in the wall".
//
// Picked, the fireplace shows a small square tab at the middle of its width,
// just inside its front. Pressed on the tab, the drag carries it by its
// centre, and that centre catches a node -- a dimension's midpoint -- so
// it lands centred under the dimension. Pressed anywhere else it slides by
// the travel as before.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8 });
// A 5' wide box's dimension, midpoint at x = 0, 1'-6" out in the room.
const DIM = { id: 7, start: { x: -2.5, y: 0, z: 1.5 }, end: { x: 2.5, y: 0, z: 1.5 }, levelId: 3,
  view: 'plan', layer: 'A-DIMS-HAND', auto: false };
// The fireplace's centre at x = -4 (offset 6 on a wall from x = -10).
const FP = { id: 'fp', wallId: 'six', levelId: 3, view: 'plan', kind: 'fireplace', layer: 'A-FIXT',
  offset: 6, width: 5, depth: 19 / 12, side: 1 };
const drawing = () => ({
  version: 1, board: 'drafting', units: 'imperial', planTurn: 0,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 20,
  walls: [W('six', [-10, 0], [10, 0])], fixtures: [FP], dimensions: [DIM],
  lines: [], floors: [], roofs: [], fenestrations: [], outlines: [], shapes: [], surfaceOpenings: [],
  notes: [], stairs: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [],
  levelLocks: [], underlays: [],
});

async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  await page.keyboard.press('s');
  const { at } = await h.planFrame(page);
  // Pick it by its body, inside the wall it sits in.
  await page.mouse.click(...at(-4, -0.6));
  await expect.poll(() => page.evaluate(() => selection.map(s => s.type).join())).toBe('fixture');
  const tab = await page.evaluate(() => window.DraftFixtureGeometry.centreTab(drawing.walls, drawing.fixtures[0]));
  return { at, tab };
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
async function drag(page, from, to) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(from[0] + 4, from[1], { steps: 2 });
  await page.mouse.move(...to, { steps: 10 });
  await page.mouse.up();
}
const offset = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).fixtures.find(f => f.id === 'fp').offset;
};

test('the tab sits at the middle of its width, just inside its front', async ({ page }) => {
  const { tab } = await open(page);
  expect(tab.x).toBeCloseTo(-4, 6);
  // 2x6 room face at 2.75", the trim 2" proud: the front at 4.75", the tab 1 1/2" inside it.
  expect(tab.z * 12).toBeCloseTo(3.25, 3);
});

test('held by its tab, its centre lands on the dimension\'s midpoint', async ({ page }) => {
  const { at, tab } = await open(page);
  await drag(page, at(tab.x, tab.z), at(0.08, 1.5));
  expect(await offset(page), 'centred on the dim: x = 0 is 10 along the wall').toBeCloseTo(10, 6);
  await page.keyboard.press('Control+z');
  expect(await offset(page)).toBeCloseTo(6, 6);
});

test('held anywhere else, it slides by the travel and catches nothing', async ({ page }) => {
  const { at } = await open(page);
  await drag(page, at(-4, -0.6), at(0.08, 1.5));
  const got = await offset(page);
  expect(Math.abs(got - 10), 'not pulled onto the midpoint').toBeGreaterThan(0.05);
  expect(got).toBeCloseTo(10.08, 1);
});
