// THE ASSEMBLY KEY (Movie, 18 Oct).
//
// "can we put it up in with the other main letters and allow the user to
// press Y first and THEN puts them into select mode the items and THEn press
// ENTER or DOUBLE CLICK or press Y again to close the assembly as one new
// unit with the items within moving, copy rotate as one unit" -- and before
// that, "just tried pressing Y ENTER as a command and it didn't assemble the
// WC s that i picked": the Y on the panel's button was a label nothing
// listened to.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
// Three free walls, and two more already an assembly -- a WC, say.
const WALLS = [W('a', [0, 0], [6, 0]), W('b', [0, 4], [6, 4]), W('c', [0, 8], [6, 8]),
  W('wc1', [10, 0], [16, 0]), W('wc2', [16, 0], [16, 6])];
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20, nextGroupId: 2,
  walls: WALLS, lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
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
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const key = page => page.locator('[data-tool-key="assembly"]');
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); };
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const ids = g => g.members.map(m => m.id).sort();

test('ASSEMBLY is a key among the DRAW / EDIT letters, Y on its face', async ({ page }) => {
  await open(page);
  await expect(key(page)).toBeVisible();
  await expect(key(page)).toContainText('Y');
  await expect(key(page)).toContainText('ASSEMBLY');
});

test('Y, click two walls -- no Shift -- and ENTER: one new assembly of both', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('y');
  await expect(key(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#strip-message')).toContainText('ASSEMBLY');
  await click(page, at, 3, 0);
  await click(page, at, 3, 4);
  await page.keyboard.press('Enter');
  await expect(key(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#strip-message')).toContainText('2 items move, copy and rotate as one');
  const d = await saved(page);
  const made = d.groups.find(g => g.id !== 'group-1');
  expect(ids(made)).toEqual(['a', 'b']);
  expect(made.fixed).toBe(true);
});

test('a second click takes one back out; Y again closes it', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('y');
  await click(page, at, 3, 0);
  await click(page, at, 3, 4);
  await click(page, at, 3, 8);
  await click(page, at, 3, 4);
  await page.keyboard.press('y');
  const made = (await saved(page)).groups.find(g => g.id !== 'group-1');
  expect(ids(made)).toEqual(['a', 'c']);
});

test('a double-click closes it, and what it lands on is in', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('y');
  await click(page, at, 3, 0);
  await page.mouse.dblclick(...at(3, 8));
  await page.waitForTimeout(100);
  const made = (await saved(page)).groups.find(g => g.id !== 'group-1');
  expect(ids(made)).toEqual(['a', 'c']);
});

test('a WC picked by one wall goes in whole: the new unit holds it and the free wall', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('y');
  await click(page, at, 13, 0);
  await click(page, at, 3, 0);
  await page.keyboard.press('Enter');
  const d = await saved(page);
  expect(d.groups).toHaveLength(1);
  expect(ids(d.groups[0])).toEqual(['a', 'wc1', 'wc2']);
});

test('Escape puts it down with nothing made', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('y');
  await click(page, at, 3, 0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(key(page)).toHaveAttribute('aria-pressed', 'false');
  expect((await saved(page)).groups).toHaveLength(1);
});
