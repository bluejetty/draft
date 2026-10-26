// THE 1' LIGHT MOVES A SELECTION BY THE FOOT.
//
// Movie, 20 Oct, with three things picked and MOVE lit: "when i MOVE a group
// of items and i use the '1'' key (beside T SQUARE - which works) the '1''
// key doesn't make it go 'by the foot' its length is still 'free' based on
// cursor position" -- and "can we make it work for when i moved grouped stuff
// too". A dragged wall and a dragged stair already landed on the foot with
// the light lit; a selection carried by MOVE, an assembly dragged under
// SELECT and a handful of lines went wherever the hand went. Now each axis
// of the travel is rounded to a whole foot, after the T-square picks the
// axis and before the magnet, so a catch still wins.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const L = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', layer: 'draft', weight: 1, style: 'solid' });
// A two-wall "WC" assembly and two lines, all standing clear of everything,
// so no magnet has a reason to pull them.
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('wc1', [0, 0], [8, 0]), W('wc2', [8, 0], [8, 6]), W('solo', [14, -14], [22, -14])],
  lines: [L('la', [-20, -12], [-12, -12]), L('lb', [-20, -8], [-12, -8])],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
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
const line = (d, id) => d.lines.find(l => l.id === id);
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
const light = page => page.locator('[data-mode-scale]');
async function lightFoot(page, on) {
  const lit = /\blit\b/.test(await light(page).getAttribute('class') || '');
  if (lit !== on) await light(page).click();
  if (on) await expect(light(page)).toHaveClass(/lit/);
  else await expect(light(page)).not.toHaveClass(/lit/);
}

test('MOVE with the 1\' light lit carries the assembly a whole foot each way', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightFoot(page, true);
  await page.locator('#model-move').click();
  // 5.4 across and 1.6 down: five and two.
  await drag(page, at(4, 3), at(9.4, 4.6));
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, 'five feet across').toBeCloseTo(5, 6);
  expect(wall(d, 'wc1').start.z, 'two feet down').toBeCloseTo(2, 6);
  expect(wall(d, 'wc2').end.z, 'the whole assembly').toBeCloseTo(8, 6);
});

test('an assembly dragged under SELECT lands on the foot too', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightFoot(page, true);
  await drag(page, at(4, 0), at(9.4, 1.6));
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x).toBeCloseTo(5, 6);
  expect(wall(d, 'wc1').start.z).toBeCloseTo(2, 6);
});

test('and so do lines moved together', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(-16, -12));
  await page.keyboard.down('Shift');
  await page.mouse.click(...at(-16, -8));
  await page.keyboard.up('Shift');
  await expect(page.locator('#delete')).toBeVisible();
  await lightFoot(page, true);
  await drag(page, at(-16, -12), at(-10.6, -10.4));
  const d = await saved(page);
  expect(line(d, 'la').start.x, 'five feet across').toBeCloseTo(-15, 6);
  expect(line(d, 'la').start.z, 'two feet down').toBeCloseTo(-10, 6);
  expect(line(d, 'lb').end.z, 'both lines').toBeCloseTo(-6, 6);
});

// A LONE WALL, SIDE TO SIDE (Movie, 20 Oct: "the 1' thing works when i change
// the wall lengths though i just noticed but not moving walls side to side").
test('a lone wall carried by MOVE lands on the foot', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, -14));
  await expect(page.locator('#delete')).toBeVisible();
  await lightFoot(page, true);
  await page.locator('#model-move').click();
  await drag(page, at(18, -11), at(23.4, -9.4));
  const d = await saved(page);
  expect(wall(d, 'solo').start.x, 'five feet across').toBeCloseTo(19, 6);
  expect(wall(d, 'solo').start.z, 'two feet down').toBeCloseTo(-12, 6);
});

test('and a lone wall dragged by its body under SELECT', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, -14));
  await expect(page.locator('#delete')).toBeVisible();
  await lightFoot(page, true);
  await drag(page, at(18, -14), at(23.4, -15.6));
  const d = await saved(page);
  expect(wall(d, 'solo').start.x).toBeCloseTo(19, 6);
  expect(wall(d, 'solo').start.z).toBeCloseTo(-16, 6);
});

// A FACE WITHIN REACH OF THE FOOT STILL CATCHES, ACROSS -- and the other axis
// stays on the foot. The two lines run at z = -12: the wall rounded to -12
// lands a face on one of them, a hair off its centreline; its travel along
// the run is still the whole five feet. Before this it was the catch that
// threw the foot away on both axes, which is the free slide Movie saw.
test('a face that catches moves the wall across to it and leaves the other axis on the foot', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, -14));
  await expect(page.locator('#delete')).toBeVisible();
  await lightFoot(page, true);
  // The hand 0.3 ft past the line: the near face 1.85" off it, inside the
  // one snap rule's reach for a line (an inch, floored at 4 px).
  await drag(page, at(18, -14), at(23.4, -12.3));
  const d = await saved(page);
  expect(wall(d, 'solo').start.x, 'five feet along, on the foot').toBeCloseTo(19, 6);
  expect(Math.abs(wall(d, 'solo').start.z + 12), 'a face on the line, half a 2x4 off its centre')
    .toBeCloseTo(3.5 / 24, 3);
});

test('with the light off the move is free, as it was', async ({ page }) => {
  const { at } = await open(page);
  await pickAssembly(page, at);
  await lightFoot(page, false);
  await page.locator('#model-move').click();
  await drag(page, at(4, 3), at(9.4, 4.6));
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x).toBeCloseTo(5.4, 1);
  expect(wall(d, 'wc1').start.z).toBeCloseTo(1.6, 1);
});
