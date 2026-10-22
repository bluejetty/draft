// CTRL+A SELECTS ALL (Movie, 22 Oct: "ok lets do the CTRL-A (select all) i
// just had a use for it"). It is the WINDOW box drawn around the whole sheet
// without the drawing of it: everything on the level, or only the kind picked
// under OBJECT TYPE, or every level's walls, lines and floors under ALL
// LEVELS. A plain A is still the SHAPE key, and a CTRL+A typed in a box is
// the box's.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const empty = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 3, nextDrawingItemId: 50,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page, level = 3, view = '') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto(`/MODEL.html?level=${level}&lpane=drafting&left=1${view ? `&view=${view}` : ''}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); }
// ARM ONLY WHEN DOWN: a press on a lit key puts it down again.
async function arm(page, id) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const key = page.locator(`[data-tool-key="${id}"]`);
  if (await key.getAttribute('aria-pressed') === 'true') return;
  await h.armFromRail(page, id);
}
// A RUN OF ONE LEG: two presses, then ENTER twice ends the run.
async function run(page, at, id, x1, z1, x2, z2) {
  await arm(page, id);
  await press(page, at, x1, z1);
  await press(page, at, x2, z2);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
async function selectAll(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(80);
}

test('CTRL+A selects everything on the level, so one DELETE takes it all', async ({ page }) => {
  const { at } = await open(page);
  await run(page, at, 'line', -8, 0, 8, 0);
  await run(page, at, 'line', -8, 6, 8, 6);
  await run(page, at, 'wall', -8, 3, 8, 3);
  await arm(page, 'select');
  await selectAll(page);
  await expect(strip(page)).toContainText('3 selected');
  await page.keyboard.press('Delete');
  const d = await saved(page);
  expect(d.lines).toHaveLength(0);
  expect(d.walls).toHaveLength(0);
});

test('CTRL+A honours the kind picked under OBJECT TYPE', async ({ page }) => {
  const { at } = await open(page);
  await run(page, at, 'line', -8, 0, 8, 0);
  await run(page, at, 'wall', -8, 3, 8, 3);
  await arm(page, 'select');
  await page.locator('[data-sel-filter="line"]').click();
  await selectAll(page);
  await expect(strip(page)).toContainText('1 selected');
  await expect(strip(page)).toContainText('only');
  await page.keyboard.press('Delete');
  const d = await saved(page);
  expect(d.lines).toHaveLength(0);
  expect(d.walls, 'the wall is not a LINE').toHaveLength(1);
});

test('under ALL LEVELS, CTRL+A reaches every level; otherwise only this one', async ({ page }) => {
  const { at } = await open(page);
  await run(page, at, 'line', -8, 0, 8, 0); // MAIN FL
  await saved(page);
  await page.goto('/MODEL.html?level=5&lpane=drafting&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const up = await h.planFrame(page);
  await run(page, up.at, 'line', -8, 4, 8, 4); // 2ND FL
  await arm(page, 'select');
  // THIS LEVEL ONLY: the MAIN FL line is not reached.
  await selectAll(page);
  await expect(strip(page)).toContainText('1 selected');
  await page.keyboard.press('Escape');
  await page.locator('[data-sel-mode="window-all"]').click();
  await selectAll(page);
  await expect(strip(page)).toContainText('2 selected');
  await page.keyboard.press('Delete');
  expect((await saved(page)).lines).toHaveLength(0);
});

test('CTRL+A typed in a box is the box\'s, and a plain A is still SHAPE', async ({ page }) => {
  // ON THE FLOOR LAYOUT, where a drawn floor lives and can be pressed.
  const { at } = await open(page, 3, 'floor');
  await run(page, at, 'line', -8, -4, 8, -4);
  // A FLOOR, for a PROPERTIES field that takes the keyboard: its THICKNESS.
  await arm(page, 'floor');
  for (const [x, z] of [[2, 2], [12, 2], [12, 8]]) await press(page, at, x, z);
  await page.mouse.dblclick(...at(2, 8));
  await page.waitForTimeout(150);
  await arm(page, 'select');
  await press(page, at, 7, 5);
  await h.showLeftPane(page, 'properties');
  await expect(page.locator('#props-slot .props-title').first()).toHaveText('FLOOR');
  await page.locator('#props-slot [data-prop-row="thickened edge"] [data-prop-value="on"]').click();
  const field = page.locator('#props-slot [data-prop-field="thickness"]');
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(80);
  await expect(strip(page)).not.toContainText('SELECT ALL');
  await expect(field, 'the box kept the keyboard').toBeFocused();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Escape');
  await page.keyboard.press('a');
  await expect(page.locator('[data-tool-key="shape"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(strip(page)).not.toContainText('SELECT ALL');
});
