// THE UNDO / REDO TAB (Movie, 20 Oct): "i need a better UNDO/REDO
// functionality in model space. can we put a UNDO / REDO tab under the
// NOTES/ CALC. and in there have the last 100 UNDO ... and then 100 REDO ...
// list with the DATE/TIME style stamps ... click on each one and see what
// the changes are and it will change the model to that version whichever
// they end up on, or if they want the current version they select the
// CURRENT" -- "do it per session".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
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
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const tab = page => page.locator('#history-tab');
const rows = page => page.locator('[data-history-row]');
async function openTab(page) {
  if (await tab(page).getAttribute('aria-expanded') !== 'true') await tab(page).click();
  await expect(page.locator('#history-panel')).toBeVisible();
}
// A WALL DRAWN: two presses and ESC puts the run down.
async function wall(page, at, a, b) {
  // ARMED ONCE: a second press on a lit WALL key puts the tool down.
  const key = page.locator('[data-tool-key="wall"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await h.armFromRail(page, 'wall');
  await page.mouse.click(...at(...a));
  await page.waitForTimeout(80);
  await page.mouse.click(...at(...b));
  await page.waitForTimeout(80);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const STAMP = /^\d\d:\d\d:\d\d/;

test('UNDO / REDO hangs under NOTES / CALC and lists the session\'s versions, newest first, CURRENT on top', async ({ page }) => {
  const { at } = await open(page);
  await expect(tab(page)).toHaveText('UNDO / REDO');
  const [notes, history] = await Promise.all([
    page.locator('#notes-tab').boundingBox(), tab(page).boundingBox()]);
  expect(history.y, 'below NOTES / CALC').toBeGreaterThanOrEqual(notes.y + notes.height);
  expect(Math.round(history.x + history.width), 'on the same edge').toBe(Math.round(notes.x + notes.width));
  await openTab(page);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('CURRENT');
  await expect(rows(page).first()).toContainText('OPENED');
  expect(await rows(page).first().locator('.hp-when').textContent(), 'a time stamp').toMatch(STAMP);
  await wall(page, at, [2, 2], [8, 2]);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).toContainText('CURRENT');
  await expect(rows(page).nth(0)).toContainText('+1 wall');
  await expect(rows(page).nth(1)).toContainText('OPENED');
  await expect(rows(page).nth(1)).not.toContainText('CURRENT');
  await expect(rows(page).nth(0)).toHaveAttribute('aria-selected', 'true');
});

test('a version clicked goes on the sheet, whole; CURRENT puts the newest back', async ({ page }) => {
  const { at } = await open(page);
  await wall(page, at, [2, 2], [8, 2]);
  await wall(page, at, [2, 6], [8, 6]);
  await openTab(page);
  await expect(rows(page)).toHaveCount(3);
  await rows(page).nth(2).click();   // OPENED
  await expect(page.locator('#strip-message')).toContainText(/is on the sheet/i);
  expect((await saved(page)).walls, 'the empty sheet it opened on').toHaveLength(0);
  // THE VERSIONS STAY, the one on the sheet marked and the rest ahead of it.
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(2)).toHaveAttribute('aria-selected', 'true');
  await expect(rows(page).nth(0)).toHaveAttribute('data-side', 'redo');
  await expect(page.locator('[data-history-count]')).toHaveText('0 BACK · 2 FORWARD');
  await rows(page).nth(0).click();   // CURRENT
  await expect(page.locator('#strip-message')).toContainText(/CURRENT version back/i);
  expect((await saved(page)).walls, 'both walls back').toHaveLength(2);
  await expect(rows(page).nth(0)).toHaveAttribute('aria-selected', 'true');
});

test('drawing on an older version drops the versions after it', async ({ page }) => {
  const { at } = await open(page);
  await wall(page, at, [2, 2], [8, 2]);
  await wall(page, at, [2, 6], [8, 6]);
  await openTab(page);
  await rows(page).nth(1).click();   // one wall
  await expect(page.locator('#strip-message')).toContainText(/is on the sheet/i);
  await wall(page, at, [2, 10], [8, 10]);
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toContainText('CURRENT');
  await expect(rows(page).nth(0)).toHaveAttribute('aria-selected', 'true');
  const d = await saved(page);
  expect(d.walls, 'the first wall and the new one; the second is gone').toHaveLength(2);
  expect(d.walls.map(w => Math.round(w.start.z)).sort((p, q) => p - q)).toEqual([2, 10]);
});

test('Ctrl+Z with no fine-grained undo left steps back a version; Ctrl+Shift+Z steps forward', async ({ page }) => {
  const { at } = await open(page);
  await wall(page, at, [2, 2], [8, 2]);
  await openTab(page);
  await rows(page).nth(1).click();   // OPENED: the jump also empties the undo stack
  await expect(page.locator('#strip-message')).toContainText(/is on the sheet/i);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('#strip-message')).toContainText(/CURRENT version back/i);
  expect((await saved(page)).walls).toHaveLength(1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#strip-message')).toContainText(/is on the sheet/i);
  expect((await saved(page)).walls).toHaveLength(0);
});

test('the versions are the session\'s: the saved file carries none of them', async ({ page }) => {
  const { at } = await open(page);
  await wall(page, at, [2, 2], [8, 2]);
  const d = await saved(page);
  expect(Object.keys(d).filter(k => /history|version[s]|undo/i.test(k) && k !== 'version'), 'no history key in the file').toEqual([]);
  expect(JSON.stringify(d)).not.toContain('OPENED');
});
