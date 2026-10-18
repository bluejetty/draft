// ROTATE (Movie, 18 Oct).
//
// "i just realized i also need a ROTATE command (for items that are selected
// like the stiarcase which i'd like to rotate 90)" -- down "with the DEL COPY
// ROTATE commands in that lower area", its little row covering the others
// while it is up ("i like how those little commands cover the other ones
// when they are active"); and "in the photo popup area can we also add
// 'ROTATE' and maybe also allow this item to glow when selected".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
// A house wall, and a two-wall "WC" whose first wall starts ON the house
// wall's end -- the corner they share must not drag the house wall round.
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('house', [-10, 0], [0, 0]), W('wc1', [0, 0], [8, 0]), W('wc2', [8, 0], [8, 6])],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [],
  stairs: [{ id: 7, start: { x: -6, y: 0, z: 3 }, end: { x: 4, y: 0, z: 3 }, levelId: 3,
    view: 'plan', widthFt: 3, riseFt: 9, risers: 14, treadRunIn: 10, shape: 'straight' }],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'wc1' }, { type: 'wall', id: 'wc2' }] }],
  levelLocks: [], underlays: [],
});
const PHOTO = { id: 'u1', levelId: 3, kind: 'image', name: 'roof plan', x: -4, z: 4,
  widthFt: 20, heightFt: 10, opacity: 0.7 };

async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
// THE STAIR IS PICKED BY ITS TREADS, which stand to one side of its run
// line -- so try a hair either side until DELETE says something is held.
async function pickStair(page, at) {
  for (const z of [3.8, 2.2, 3.2, 2.8]) {
    await click(page, at, -1, z);
    if (await page.locator('#delete').isVisible()) return;
  }
  throw new Error('the stair would not pick');
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 1000) / 1000 + 0;
const xz = p => [r2(p.x), r2(p.z)];

test('a stair selected: ROTATE in the foot, its row over the verbs, a quarter turn clockwise on screen about its middle', async ({ page }) => {
  const { at } = await open(page);
  await pickStair(page, at);
  await expect(page.locator('#model-rotate')).toBeVisible();
  await expect(page.locator('#delete')).toBeVisible();
  await page.locator('#model-rotate').click();
  await expect(page.locator('[data-rotate-bar]')).toBeVisible();
  for (const id of ['#delete', '#copy', '#model-undo', '#model-rotate']) await expect(page.locator(id)).toBeHidden();
  const [s0, e0] = [at(-6, 3), at(4, 3)];
  await page.locator('[data-rotate-by="90"]').click();
  const stair = (await saved(page)).stairs[0];
  expect([xz(stair.start), xz(stair.end)], 'about its middle (-1, 3)').toEqual([[-1, -2], [-1, 8]]);
  // CLOCKWISE AS THE DRAFTER SEES IT: on screen the run (dx, dy) became (-dy, dx).
  const [s1, e1] = [at(stair.start.x, stair.start.z), at(stair.end.x, stair.end.z)];
  const before = [e0[0] - s0[0], e0[1] - s0[1]], after = [e1[0] - s1[0], e1[1] - s1[1]];
  expect(Math.round(after[0]) + 0).toBe(Math.round(-before[1]) + 0);
  expect(Math.round(after[1])).toBe(Math.round(before[0]));
  await page.locator('[data-rotate-done]').click();
  await expect(page.locator('[data-rotate-bar]')).toBeHidden();
  await expect(page.locator('#delete')).toBeVisible();
});

test('a typed angle, and one UNDO puts it back', async ({ page }) => {
  const { at } = await open(page);
  await pickStair(page, at);
  await page.locator('#model-rotate').click();
  await page.locator('[data-rotate-angle]').fill('180');
  await page.locator('[data-rotate-angle]').press('Enter');
  let stair = (await saved(page)).stairs[0];
  expect([xz(stair.start), xz(stair.end)]).toEqual([[4, 3], [-6, 3]]);
  await page.keyboard.press('Control+z');
  stair = (await saved(page)).stairs[0];
  expect([xz(stair.start), xz(stair.end)]).toEqual([[-6, 3], [4, 3]]);
});

test('a WC turns whole, and lets go of the corner it shared with the house wall; UNDO joins it again', async ({ page }) => {
  const { at } = await open(page);
  // ONE WALL OF THE WC PICKED IS THE WC PICKED: it turns whole.
  await click(page, at, 4, 0);
  await page.locator('#model-rotate').click();
  await page.locator('[data-rotate-by="-90"]').click();
  let d = await saved(page);
  const wall = id => d.walls.find(w => w.id === id);
  expect([xz(wall('house').start), xz(wall('house').end)], 'the house wall stays put').toEqual([[-10, 0], [0, 0]]);
  // Middle of the WC's points (0..8, 0..6) is (4, 3); a quarter anticlockwise.
  expect([xz(wall('wc1').start), xz(wall('wc1').end)]).toEqual([[1, 7], [1, -1]]);
  expect([xz(wall('wc2').start), xz(wall('wc2').end)]).toEqual([[1, -1], [7, -1]]);
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect([xz(wall('wc1').start), xz(wall('wc2').end)]).toEqual([[0, 0], [8, 6]]);
});

test('the PHOTO popup has ROTATE: a quarter turn, the picture\'s sides swapped; one in hand glows and turns from the foot', async ({ page }) => {
  await open(page, { ...drawing(), underlays: [PHOTO] });
  await page.locator('[data-mode-trace]').click();
  if (!await page.locator('#trace-ask').isVisible()) await page.locator('[data-mode-trace]').click();
  await expect(page.locator('#trace-ask')).toBeVisible();
  await page.locator('[data-trace-rotate="u1"]').click();
  await page.locator('[data-trace-later]').click();
  let u = (await saved(page)).underlays[0];
  expect([u.turn, u.widthFt, u.heightFt, u.x, u.z]).toEqual([1, 10, 20, -4, 4]);
  // In hand (MOVE): ROTATE in the foot turns the picture.
  await page.locator('[data-mode-trace]').click();
  if (!await page.locator('#trace-ask').isVisible()) await page.locator('[data-mode-trace]').click();
  await page.locator('[data-trace-move="u1"]').click();
  await expect(page.locator('#model-rotate')).toBeVisible();
  await page.locator('#model-rotate').click();
  await page.locator('[data-rotate-by="90"]').click();
  await page.keyboard.press('Escape');
  u = (await saved(page)).underlays[0];
  expect([u.turn, u.widthFt, u.heightFt]).toEqual([2, 20, 10]);
});
