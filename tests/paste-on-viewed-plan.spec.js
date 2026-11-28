// A WALL PASTED WITH THE FOUNDATION PLAN UP LANDS ON THE FOUNDATION PLAN,
// AND A PASTE NEVER STACKS A WALL EXACTLY ON ANOTHER.
//
// jb, 19 Nov 2026: the 1FT stubs copied off MAIN FL and pasted with the
// FOUNDATION plan up kept their 'plan' view and were filed on the foundation
// level's BASEMENT (WALLS) plan -- nothing showed on FOUNDATION, so PASTE was
// pressed again and again: nine copies of each stub, stacked and invisible
// where they were pasted (his 20261119T1305 file). model/08 pasteHeld now
// files a pasted wall under the home view of the plan it is pasted on, and
// skips a copy that would land end for end on another wall of that plan
// (jb: "yes please skip that"); the first paste onto its own original, the
// usual PASTE-then-MOVE, still lands.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b, extra = {}) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'left', baseHeight: 0, topHeight: 8, ...extra });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('stub', [0, 0], [6, 0]),
    W('fdn', [-2, 4], [10, 4], { levelId: 1, view: 'foundation', wallType: 'concrete_8', baseHeight: -8, topHeight: 0 })],
  lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openEditor(page, { drawing: drawing(), url: '/MODEL.html?right=1&pane=levels&level=3&view=plan', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
}
const savedWalls = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).walls;
};
const atStub = w => Math.abs(w.start.z) < 0.01 && Math.abs(w.end.z) < 0.01
  && Math.min(w.start.x, w.end.x) === 0 && Math.max(w.start.x, w.end.x) === 6;

test('copied on MAIN FL, pasted with FOUNDATION up: on the FOUNDATION plan, once however often PASTE is pressed', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { setSelection([{ type: 'wall', item: drawing.walls.find(w => w.id === 'stub') }]); paint(); });
  await expect(page.locator('#copy')).toBeVisible();
  await page.locator('#copy').click();
  await page.locator('#view-rail .seat[data-seat="1:foundation"]').click();
  await expect.poll(() => page.evaluate(() => [Number(activeLevelId()), activeViewId()])).toEqual([1, 'foundation']);
  await expect(page.locator('#paste')).toBeVisible();
  await page.locator('#paste').click();
  await page.waitForTimeout(150);
  for (let i = 0; i < 3; i += 1) {
    await page.locator('#paste').click({ force: true }).catch(() => page.keyboard.press('Control+v'));
    await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => stripNotice)).toMatch(/already there/i);
  const walls = await savedWalls(page);
  const onFdn = walls.filter(w => Number(w.levelId) === 1 && atStub(w));
  expect(onFdn.map(w => w.view), JSON.stringify(onFdn)).toEqual(['foundation']);
  // The original stays on MAIN FL, alone.
  expect(walls.filter(w => Number(w.levelId) === 3 && atStub(w))).toHaveLength(1);
});

test('PASTE onto the level it was copied from still lands on its original once (PASTE, then MOVE)', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { setSelection([{ type: 'wall', item: drawing.walls.find(w => w.id === 'stub') }]); paint(); });
  await page.locator('#copy').click();
  await page.locator('#paste').click();
  await page.waitForTimeout(150);
  await page.locator('#paste').click({ force: true });
  await page.waitForTimeout(150);
  const walls = await savedWalls(page);
  expect(walls.filter(w => Number(w.levelId) === 3 && atStub(w)), 'the original and one copy').toHaveLength(2);
});
