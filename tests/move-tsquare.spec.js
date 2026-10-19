// THE T-SQUARE HOLDS A MOVE SQUARE.
//
// Movie, 19 Oct, dragging a WC's walls with MOVE lit: "i'm trying to move
// this ASSEMBLY of WALLS and the T SQUARE isn't keeping it at 90 degrees it
// is freemoving". The T-square already held a wall dragged by its body; a
// selection carried by MOVE, and an assembly dragged under SELECT, went
// wherever the hand went. With it lit, the larger travel wins and the other
// is dropped -- the assembly slides straight across or straight up.
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

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
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

test('MOVE with the T-square lit slides the assembly straight across, not with the hand', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await page.locator('#model-move').click();
  // Five across and a foot and a half down: the across wins.
  await drag(page, at(4, 3), at(9, 4.5));
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, 'five feet across').toBeCloseTo(5, 1);
  expect(wall(d, 'wc1').start.z, 'and not an inch down').toBeCloseTo(0, 6);
  expect(wall(d, 'wc2').end.z, 'the whole assembly').toBeCloseTo(6, 6);
});

test('and straight up when the hand went mostly up', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await page.locator('#model-move').click();
  await drag(page, at(4, 3), at(5.5, -2));
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, 'not an inch across').toBeCloseTo(0, 6);
  expect(wall(d, 'wc1').start.z, 'five feet up').toBeCloseTo(-5, 1);
});

test('an assembly dragged under SELECT is held square too', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await drag(page, at(4, 0), at(9, 1.5));
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x).toBeCloseTo(5, 1);
  expect(wall(d, 'wc1').start.z, 'held on its line').toBeCloseTo(0, 6);
});

test('with the T-square unlit the move is free, as it was', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  const chip = page.locator('[data-mode-tsquare]');
  if (/\blit\b/.test(await chip.getAttribute('class') || '')) await chip.click();
  await page.locator('#model-move').click();
  await drag(page, at(4, 3), at(9, 4.5));
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x).toBeCloseTo(5, 0);
  expect(wall(d, 'wc1').start.z).toBeCloseTo(1.5, 0);
});

// AND A TYPED LENGTH MAKES IT EXACT (Movie, 19 Oct: "i would like to move
// exactly 12'1 down (at 90 with T on) but it won't allow me to enter a
// LENGTH"). Drag it roughly down, type the distance -- no click into the box,
// the way a wall's length is typed -- and ENTER puts it exactly there along
// the line the drag took. One UNDO takes the whole move back.
test('after a MOVE drag, a typed length moves it exactly that far the same way', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightTsquare(page);
  await page.locator('#model-move').click();
  await drag(page, at(4, 3), at(4.6, 6));
  const box = page.locator('#frozen-length');
  await expect(box, 'the box takes a number after the move').toBeEnabled();
  await page.keyboard.type("12'1");
  await expect(box).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('Moved');
  let d = await saved(page);
  expect(wall(d, 'wc1').start.z, "exactly 12'-1\" down").toBeCloseTo(12 + 1 / 12, 6);
  expect(wall(d, 'wc1').start.x, 'and square').toBeCloseTo(0, 6);
  expect(wall(d, 'wc2').end.z, 'the whole assembly').toBeCloseTo(18 + 1 / 12, 6);
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(wall(d, 'wc1').start.z, 'one UNDO, back where it started').toBeCloseTo(0, 6);
});
