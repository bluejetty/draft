// WHAT HANGS ON A WALL IS PASTED WITH IT.
//
// Movie, 20 Oct, with the suites drawn on MAIN FL: "can it be possible for
// me to copy that all down to the boneyard somehow?" -- "can i select ALL on
// the floor and then paste ALL in the boneyard". COPY took the walls and
// their windows, and PASTE put the windows down still naming the wall they
// came from -- a wall on the level they had left -- so they showed nowhere.
// The walls land first now and what hangs on them is re-pointed at the
// copies; a fixture comes too, by the same rule.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
// A two-wall suite corner on MAIN FL with a window in one wall and a toilet
// on the other, and a house wall off to the side that is not copied.
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('wc1', [0, 0], [8, 0]), W('wc2', [8, 0], [8, 6]), W('house', [20, 0], [30, 0])],
  lines: [], floors: [], roofs: [], dimensions: [],
  fenestrations: [{ id: 'win', wallId: 'wc1', levelId: 3, view: 'plan', type: 'window', offset: 3, width: 2,
    sillHeight: 3, headHeight: 6.67 }],
  fixtures: [{ id: 'loo', wallId: 'wc2', levelId: 3, view: 'plan', kind: 'toilet', offset: 3, width: 1.7, depth: 2.4, side: 1 }],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?right=1&pane=levels&level=3&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// A selection window over the suite corner, left to right.
async function windowOver(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}
// The BONEYARD card in the LEVELS panel: one press puts the active shelf up.
async function goToBoneyard(page) {
  await page.locator('[data-boneyard]').click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-shelf="1"]')).toHaveAttribute('data-active', '');
}

test('the suite pasted on the BONEYARD brings its window and its toilet, hung on the pasted walls', async ({ page }) => {
  const { at } = await open(page);
  await windowOver(page, at, [-2, -2], [10, 8]);
  await expect(page.locator('#copy')).toBeVisible();
  await page.locator('#copy').click();
  await goToBoneyard(page);
  await expect(page.locator('#paste')).toBeVisible();
  await page.locator('#paste').click();
  const d = await saved(page);
  const shelf = d.walls.filter(w => w.levelId === -1);
  expect(shelf, 'the two suite walls on SHELF 1, not the house wall').toHaveLength(2);
  expect(d.walls, 'the originals still on MAIN FL').toHaveLength(5);
  const wins = d.fenestrations.filter(o => o.levelId === -1);
  expect(wins, 'the window came').toHaveLength(1);
  const onWall = shelf.find(w => w.id === wins[0].wallId);
  expect(onWall, 'on a pasted wall').toBeTruthy();
  expect([onWall.start.x, onWall.end.x], 'the copy of wc1').toEqual([0, 8]);
  const loos = d.fixtures.filter(f => f.levelId === -1);
  expect(loos, 'the toilet came').toHaveLength(1);
  const looWall = shelf.find(w => w.id === loos[0].wallId);
  expect(looWall && [looWall.start.z, looWall.end.z], 'on the copy of wc2').toEqual([0, 6]);
  expect(d.fenestrations.find(o => o.id === 'win').wallId, 'the original window untouched').toBe('wc1');
});

test('a window whose wall is not in the paste stays behind', async ({ page }) => {
  const { at } = await open(page);
  // The window alone: a click on it, no wall.
  await page.mouse.click(...at(3, 0));
  await page.waitForTimeout(200);
  await expect(page.locator('#copy')).toBeVisible();
  await page.locator('#copy').click();
  await goToBoneyard(page);
  if (await page.locator('#paste').isVisible()) await page.locator('#paste').click();
  const d = await saved(page);
  expect(d.fenestrations.filter(o => o.levelId === -1), 'no orphan window on the shelf').toHaveLength(0);
  expect(d.fenestrations, 'and the original still there').toHaveLength(1);
});
