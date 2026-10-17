// AN OUTLINE TYPED IN INCHES MOVES THE BOARD, the way a wall does.
//
// Movie, 17 Oct, tracing the North Point building's outline on a fresh
// drawing: "its not allowing me to complete when i type in text 5-2 ENTER"
// ... "its in toy mode" ... "but no way to turn it off but to enter precise
// numbers". The board is a lamp since 15 Oct -- nothing to press -- and a
// typed wall length promotes it; the OUTLINE tool's box answered "the
// outline goes in whole feet" instead, on every board, so the one gesture
// that could have left TOY was the one it refused.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = board => ({
  version: 1, board,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, board) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty(board) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const boardOf = page => page.evaluate(() => document.body.getAttribute('data-board'));

// A 5'-2" x 4' box: east by a typed 5-2, south by a press, west by a typed
// 5-2, home by a press on the first corner.
async function boxWithTypedSides(page) {
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(0, 0));
  await page.mouse.move(...at(6, 0));
  await page.waitForTimeout(60);
  await page.keyboard.type('5-2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.mouse.move(...at(5.1667, 4));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(5.1667, 4));
  await page.mouse.move(...at(0, 4));
  await page.waitForTimeout(60);
  await page.keyboard.type('5-2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.mouse.move(...at(0, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(0, 0));
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  const [master] = d.boneyardOutlines || [];
  const [o] = master.points;
  return master.points.map(p => [Math.round((p.x - o.x) * 1000) / 1000, Math.round((p.z - o.z) * 1000) / 1000]);
}

test('on TOY, 5-2 typed for an outline edge moves the board to DRAFTING and makes the edge 5\'-2"', async ({ page }) => {
  await open(page, 'toy');
  expect(await boardOf(page)).toBe('toy');
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(0, 0));
  await page.mouse.move(...at(6, 0));
  await page.waitForTimeout(60);
  await page.keyboard.type('5-2');
  await page.keyboard.press('Enter');
  // Said in his own words, and the lamp changes behind it.
  await expect(page.locator('#strip-message')).toContainText('5-2 is finer than TOY draws');
  expect(await boardOf(page)).toBe('drafting');
  await expect(page.locator('#strip-message')).not.toContainText('whole feet');
});

test('on DRAFTING the typed inches land to the inch, and the box closes square on them', async ({ page }) => {
  await open(page, 'drafting');
  const pts = await boxWithTypedSides(page);
  expect(pts).toEqual([[0, 0], [5.167, 0], [5.167, 4], [0, 4]]);
  expect(await boardOf(page)).toBe('drafting');
});
