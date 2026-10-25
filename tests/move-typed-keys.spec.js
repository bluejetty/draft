// R AND L OPEN THE LENGTH BOX, MID-DRAG TOO.
//
// Movie, 20 Oct: "i click the ASSEMBLY to highlight it.. i move it in the
// direction i want to move (with T SQUARE ON it will be in a 90 direction...
// then i press 'R' or 'L' and it takes me into the text box to type the
// length, and i press enter or the mouse button or the space bar to finish
// the length and make the MOVE" -- "R = RADIUS (not right) L = LENGTH (not
// left)". A typed length after a MOVE already existed (move-tsquare.spec.js);
// this is the two letters that open the box, the box opening while the
// button is still down, and the three ways to finish: ENTER, the mouse, and
// SPACE twice ("14 6" is a length with a space in it).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
// A two-wall "WC" assembly standing clear of everything, so no magnet has a
// reason to pull it.
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('wc1', [0, 0], [8, 0]), W('wc2', [8, 0], [8, 6])],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'wc1' }, { type: 'wall', id: 'wc2' }] }],
  levelLocks: [], underlays: [],
});

async function open(page, file = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
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
const wall = (d, id) => d.walls.find(w => w.id === id);
async function drag(page, from, to) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
async function pickAssembly(page, at) {
  await page.mouse.click(...at(4, 0));
  await expect(page.locator('#delete')).toBeVisible();
}
async function lightTsquare(page) {
  const chip = page.locator('[data-mode-tsquare]');
  if (!/\blit\b/.test(await chip.getAttribute('class') || '')) await chip.click();
  await expect(chip).toHaveClass(/lit/);
}

const lineKey = page => page.locator('[data-tool-key="line"]');

test('L pressed mid-drag opens the box, and the release moves it the typed length along the push', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await page.locator('#model-move').click();
  const from = at(4, 3), to = at(4.6, 6);
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 6 });
  await page.keyboard.press('l');
  const box = page.locator('#frozen-length');
  await expect(box, 'L put the caret in the LENGTH box with the button still down').toBeFocused();
  await page.keyboard.type("12'1");
  await page.mouse.up();
  await expect(page.locator('#strip-message')).toContainText('Moved');
  const d = await saved(page);
  expect(wall(d, 'wc1').start.z, "exactly 12'-1\" down").toBeCloseTo(12 + 1 / 12, 6);
  expect(wall(d, 'wc1').start.x, 'and square').toBeCloseTo(0, 6);
  expect(wall(d, 'wc2').end.z, 'the whole assembly').toBeCloseTo(18 + 1 / 12, 6);
});

test('R after the drag opens the box too, and ENTER finishes', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await page.locator('#model-move').click();
  await drag(page, at(4, 3), at(9, 3.6));
  await page.keyboard.press('r');
  const box = page.locator('#frozen-length');
  await expect(box).toBeFocused();
  await page.keyboard.type('10');
  await page.keyboard.press('Enter');
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, 'ten feet across').toBeCloseTo(10, 6);
  expect(wall(d, 'wc1').start.z).toBeCloseTo(0, 6);
});

test('SPACE twice finishes it; one space is part of the length', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await page.locator('#model-move').click();
  await drag(page, at(4, 3), at(9, 3.6));
  await page.keyboard.press('l');
  await page.keyboard.type('7 6 ');
  await expect(page.locator('#frozen-length'), 'one space typed, nothing moved yet').toBeFocused();
  await page.keyboard.press(' ');
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, "7'-6\" across").toBeCloseTo(7.5, 6);
});

test('a press on the sheet finishes it, and the assembly stays picked', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await page.locator('#model-move').click();
  await drag(page, at(4, 3), at(9, 3.6));
  await page.keyboard.press('l');
  // SEVEN, NOT THE FIVE THE DRAG ALREADY WENT: a press that finished nothing
  // would leave it at five and read as a pass.
  await page.keyboard.type('7');
  await page.mouse.click(...at(2, 4));   // empty sheet, on the canvas
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, 'seven feet across').toBeCloseTo(7, 6);
  await expect(page.locator('#delete'), 'still picked').toBeVisible();
});

test('an assembly dragged under SELECT takes L mid-drag the same way', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  const from = at(4, 0), to = at(9, 0.6);
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 6 });
  await page.keyboard.press('l');
  await expect(page.locator('#frozen-length')).toBeFocused();
  await page.keyboard.type('8');
  await page.mouse.up();
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, 'eight feet across').toBeCloseTo(8, 6);
  expect(wall(d, 'wc1').start.z).toBeCloseTo(0, 6);
});

test('with nothing in hand, L is still the LINE key', async ({ page }) => {
  await open(page);
  await page.keyboard.press('l');
  await expect(lineKey(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#frozen-length')).not.toBeFocused();
});

// ENTER WITH THE BUTTON STILL DOWN (Movie, 25 Oct: "press 0-2 and press
// ENTER and at that point i'd like the wall to move 2 inchers over in the
// direction i chose, but it doesn't do it at that point"): ENTER ends the
// drag there and moves it the typed length; the button let go after adds
// nothing.
test('a lone wall dragged under SELECT, L, 0-2 and ENTER mid-drag: two inches over, there and then', async ({ page }) => {
  const file = drawing();
  file.groups = [];
  file.walls = [W('free', [0, 0], [0, 8]), W('far', [12, 0], [12, 8])];
  const { at } = await open(page, file);
  await lightTsquare(page);
  await page.mouse.click(...at(0, 4));
  await expect(page.locator('#delete')).toBeVisible();
  await page.mouse.move(...at(0, 4));
  await page.mouse.down();
  await page.mouse.move(...at(3, 4.3), { steps: 6 });
  await page.keyboard.press('l');
  await expect(page.locator('#frozen-length')).toBeFocused();
  await page.keyboard.type('0-2');
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message'), 'moved on the ENTER, button still down').toContainText(/[Mm]oved/);
  const mid = await page.evaluate(() => drawing.walls.find(w => w.id === 'free').start.x);
  expect(mid, 'two inches across, before the button comes up').toBeCloseTo(2 / 12, 6);
  await page.mouse.move(...at(6, 4.3), { steps: 3 });
  await page.mouse.up();
  const d = await saved(page);
  expect(wall(d, 'free').start.x, 'and the release added nothing').toBeCloseTo(2 / 12, 6);
  expect(wall(d, 'free').start.z).toBeCloseTo(0, 6);
  expect(wall(d, 'free').end.x).toBeCloseTo(2 / 12, 6);
});
