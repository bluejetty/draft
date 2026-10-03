// THE OUTLINE DRAWS LIKE EXT WALL, AND THE DRIVE-THRU OFFERS IT (BONEYARD PR 3a).
//
// Movie, 3 Oct, on drawing the outline in the MODEL space: "like EXT WALL" --
//
//   90-DEGREE CORNERS, WHOLE FEET   every edge square to the last, whole feet long
//   THE LENGTH / ANGLE BOX          a typed length puts the next corner down
//   STILL REFUSES A CROSSED LOOP    and closes on the first corner
//
// and on the drive-thru: "PRESS BUTTON to build now -or- CLICK HERE to draw
// house OUTLINE", for every type, the detached garage included.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The master the trace wrote, read back from the store after a save.
async function savedMasters(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  return d.boneyardOutlines || [];
}
const offsets = master => {
  const [o] = master.points;
  return master.points.map(p => [Math.round((p.x - o.x) * 1000) / 1000,
    Math.round((p.z - o.z) * 1000) / 1000]);
};

test('every corner is square off the last and a whole number of feet along', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  // Presses a little off the square and off the foot, the way a hand lands.
  await page.mouse.click(...at(-10, -8));
  await page.mouse.click(...at(10.4, -7.3));
  await page.mouse.click(...at(10.8, 7.6));
  await page.mouse.click(...at(-10, 8.3));
  await page.mouse.click(...at(-10, -8));
  const masters = await savedMasters(page);
  expect(masters.length, 'the loop closed and was kept').toBe(1);
  expect(offsets(masters[0]), 'squared and brought to the foot').toEqual(
    [[0, 0], [20, 0], [20, 16], [0, 16]]);
});

test('the band shows the corner the press will put down, not the cursor', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(0, 0));
  await page.mouse.move(...at(7.4, 1.2));
  // The strip's length is the edge the next press will put down.
  await expect(page.locator('#frozen-length')).toHaveValue(/^7'/);
  await expect(page.locator('#strip-message')).toContainText('outline — next corner');
});

test('a typed length puts the next corner down, and a broken one is refused', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(0, 0));
  await page.mouse.move(...at(6, 0.5));
  const box = page.locator('#frozen-length');
  await expect(box).toBeEnabled();
  await box.fill('12\'-6"');
  await box.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('whole feet');
  await page.mouse.move(...at(6, 0.5));
  await box.fill('24');
  await box.press('Enter');
  await page.mouse.move(...at(24, 6));
  await box.fill('18');
  await box.press('Enter');
  await page.mouse.move(...at(18, 18));
  await box.fill('24');
  await box.press('Enter');
  // Home: the last corner is square under the first, so the press closes.
  await page.mouse.click(...at(0, 0));
  const masters = await savedMasters(page);
  expect(offsets(masters[0])).toEqual([[0, 0], [24, 0], [24, 18], [0, 18]]);
});

test('a close from a corner that does not line up is refused, and says how', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(0, 0));
  await page.mouse.click(...at(12, 0));
  await page.mouse.click(...at(12, 10));
  await page.mouse.click(...at(1, 10));
  // Near the first corner, but the edge home would not be square.
  await page.mouse.click(...at(0.4, 0.4));
  await expect(page.locator('#strip-message')).toContainText('Line the last corner up with the first');
  expect((await h.savedDrawing(page))?.boneyardOutlines?.length || 0).toBe(0);
});

test('a crossed loop is still refused', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  for (const [x, z] of [[0, 0], [10, 0], [10, 10], [5, 10], [5, -5], [0, -5]]) {
    await page.mouse.click(...at(x, z));
  }
  await page.mouse.click(...at(0, 0));
  await expect(page.locator('#strip-message')).toContainText('crosses itself');
});

test('the drive-thru offers to draw it, for a house and for a garage', async ({ page }) => {
  await open(page);
  await h.openDriveThru(page);
  const link = page.locator('#dt-outline');
  await expect(link, 'nothing picked, nothing to draw').toBeHidden();
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  await expect(page.locator('#dt-note')).toHaveText('PRESS BUTTON to build now -or-');
  await expect(link).toHaveText('CLICK HERE to draw house OUTLINE');
  await link.click();
  await expect(page.locator('#drivethru'), 'the sign goes down').toHaveAttribute('data-shut', '');
  // It takes a press until it has slid away -- the bone is under its path.
  await expect(page.locator('#drivethru')).toBeHidden();
  await expect(page.locator('#strip-message')).toContainText('Trace your 1 STOREY');

  // A GARAGE: offered the same way, and the loop is the garage's.
  // With a type picked the bone asks first; CHANGE goes back to the board.
  await page.keyboard.press('Escape');
  await page.locator('#bone').click();
  await page.locator('[data-build-choice-change]').click();
  await expect(page.locator('#drivethru')).not.toHaveAttribute('data-shut', '');
  await page.locator('[data-build-family="detachedGarage"]').click();
  // No size asked since 24 Sep: the default rides the order.
  await page.locator('[data-build-entry="detached-thickened"]').click();
  await expect(link).toHaveText('CLICK HERE to draw garage OUTLINE');
  await link.click();
  await expect(page.locator('#strip-message')).toContainText('Trace your garage');
  // The sign takes a press until it has slid away; the corners come after.
  await expect(page.locator('#drivethru')).toBeHidden();
  const { at } = await h.planFrame(page);
  for (const [x, z] of [[30, 0], [52, 0], [52, 22], [30, 22], [30, 0]]) {
    await page.mouse.click(...at(x, z));
  }
  const masters = await savedMasters(page);
  expect(masters.map(m => m.garage), 'the traced loop is a garage').toEqual([true]);
});

// Movie, 3 Oct: "above CLICK HERE to draw HOUSE OUTLINE... add another line
// that says PRESS TO DRAW HOUSE WITHOUT drawing OUTLINE (and will do the same
// as pressing the 'BONE')".
test('the line above it builds the house the way the bone does', async ({ page }) => {
  await open(page);
  await page.goto('/MODEL.html?theme=rough');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  const now = page.locator('#dt-build-now-shelf');
  await expect(now, 'nothing picked, nothing to build').toBeHidden();
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  await expect(now).toHaveText('PRESS TO DRAW HOUSE WITHOUT drawing OUTLINE');
  // ABOVE the outline line, not beside or under it.
  const a = await now.boundingBox(), b = await page.locator('#dt-outline-shelf').boundingBox();
  expect(a.y + a.height, 'it sits above the outline line').toBeLessThanOrEqual(b.y + 1);
  await now.click();
  await expect(page.locator('#drivethru'), 'the sign goes down').toHaveAttribute('data-shut', '');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.walls.filter(w => Number(w.levelId) === 3).length, 'the house is built').toBeGreaterThan(0);
  expect(d.boneyardOutlines, 'and nothing was traced').toEqual([]);
});

test('on RUFF the screen says it too, over the outline line', async ({ page }) => {
  await open(page);
  await h.openDriveThru(page);
  await page.locator('[data-build-family="detachedGarage"]').click();
  await page.locator('[data-build-entry="detached-thickened"]').click();
  await expect(page.locator('#dt-build-now')).toHaveText('PRESS TO DRAW GARAGE WITHOUT drawing OUTLINE');
  await expect(page.locator('#dt-build-now-shelf'), 'the shelf copy is ROUGH\'s').toBeHidden();
});

test('on ROUGH the sheet carries the same press under the selections', async ({ page }) => {
  await open(page);
  await page.goto('/MODEL.html?theme=rough');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  const shelf = page.locator('#dt-outline-shelf');
  await expect(shelf).toBeVisible();
  await shelf.click();
  await expect(page.locator('#strip-message')).toContainText('Trace your 1 STOREY');
});
