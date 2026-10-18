// MOVE FOR ANY SELECTION, AND THE WC AS ONE ASSEMBLY (Movie, 18 Oct).
//
// "the WC i'm not able to make an ASSEBLY - so i can select it as 1 UNIT -
// its always in peiced. I CAN rotate the selection hoever, need to be able to
// MOVE the SELECTED items too" -- "i'd also like to FREELY MOVE the entire
// selection or 'ASSEMBLY'".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
// A house wall, and a two-wall WC whose first wall starts ON the house wall's
// end, with a window in it.
const drawing = (groups = [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
  members: [{ type: 'wall', id: 'wc1' }, { type: 'wall', id: 'wc2' }] }]) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('house', [-10, 0], [0, 0]), W('wc1', [0, 0], [8, 0]), W('wc2', [8, 0], [8, 6])],
  lines: [], floors: [], roofs: [], dimensions: [],
  fenestrations: [{ id: 'win', wallId: 'wc1', levelId: 3, view: 'plan', type: 'window', offset: 3, width: 2,
    sillHeight: 3, headHeight: 6.67 }],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups, levelLocks: [], underlays: [],
});
async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // The LEVELS panel folded away: it stands over the right of the plan.
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const ends = (d, id) => { const w = d.walls.find(x => x.id === id); return [w.start.x, w.start.z, w.end.x, w.end.z].map(v => Math.round(v * 100) / 100 + 0); };

test('MOVE takes a whole FIXED assembly anywhere: the walls, the window riding them; the house wall stays; one UNDO', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 8, 3);                          // one wall of the WC is the WC
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  // A drag from open floor, not from a wall: anywhere moves it.
  await drag(page, at, [3, 3], [5, 4]);
  let d = await saved(page);
  expect(ends(d, 'wc1')).toEqual([2, 1, 10, 1]);
  expect(ends(d, 'wc2')).toEqual([10, 1, 10, 7]);
  expect(ends(d, 'house')).toEqual([-10, 0, 0, 0]);
  expect(d.fenestrations[0]).toMatchObject({ wallId: 'wc1', offset: 3 });
  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(ends(d, 'wc1')).toEqual([0, 0, 8, 0]);
  expect(ends(d, 'house')).toEqual([-10, 0, 0, 0]);
});

test('MOVE takes a loose selection too, and a press that does not travel moves nothing', async ({ page }) => {
  const { at } = await open(page, drawing([]));
  await click(page, at, 8, 3);
  await page.keyboard.down('Shift');
  await click(page, at, 4, 0);
  await page.keyboard.up('Shift');
  await page.locator('#model-move').click();
  await click(page, at, 4, 4);                          // a click, not a drag
  let d = await saved(page);
  expect(ends(d, 'wc2')).toEqual([8, 0, 8, 6]);
  await drag(page, at, [4, 4], [4, 5]);
  d = await saved(page);
  expect(ends(d, 'wc1')).toEqual([0, 1, 8, 1]);
  expect(ends(d, 'wc2')).toEqual([8, 1, 8, 7]);
  expect(ends(d, 'house')).toEqual([-10, 0, 0, 0]);
});

test('ASSEMBLY GROUP opens its name box in view, and an assembly keeps the window it was made with', async ({ page }) => {
  // A SHORT SCREEN, his laptop's: the panel's foot is below the fold.
  await page.setViewportSize({ width: 1280, height: 600 });
  const { at } = await open(page, drawing([]));
  await click(page, at, 8, 3);
  await page.keyboard.down('Shift');
  await click(page, at, 4, 0);
  await page.keyboard.up('Shift');
  await page.getByRole('button', { name: 'DRAFTING', exact: true }).click();
  await page.locator('[data-assembly-start]').click();
  await expect(page.locator('[data-assembly-name]')).toBeInViewport();
  await expect(page.locator('[data-assembly-name]')).toBeFocused();
  await page.locator('[data-assembly-name]').fill('WC');
  await page.locator('[data-assembly-fixed]').click();
  const d = await saved(page);
  expect(d.groups).toHaveLength(1);
  expect(d.groups[0]).toMatchObject({ name: 'WC', fixed: true });
  // An assembly holding a window finds it again when it is picked.
  const withWin = drawing([{ id: 'group-1', name: 'WC', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'wc1' }, { type: 'wall', id: 'wc2' }, { type: 'fenestration', id: 'win' }] }]);
  const f = await open(page, withWin);
  await click(page, f.at, 8, 3);
  await page.getByRole('button', { name: 'DRAFTING', exact: true }).click();
  await expect(page.locator('[data-tool-group="assembly"]')).toContainText('3 selected items');
});
