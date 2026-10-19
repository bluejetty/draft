// AUTO HOUSE ASKS BEFORE IT LAYS THE MID-SPAN BEAMS (Movie, 19 Oct).
//
// "on the AUTOHOUSE, before the beams are placed, maybe we should make a popup
// that says PLACE BEAMS and COLUMS (if they are needed due to span) -- place
// all the stair opening beams and columns AUTOMATICALLY those won't change
// unless the stair opening moves".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
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
async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
}
async function saved(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return page.evaluate(async bucket => JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text()), BUCKET);
}
// The house's mid-span rows: auto, not a stair's header, not over a garage.
const midSpan = d => (d.beams || []).filter(b => b.auto && !b.stairId && Number(b.levelId) === 1);
const ask = page => page.locator('[data-beam-ask]');

test('the bungalow comes up with the question; YES keeps the beams and columns', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow');
  await expect(ask(page)).toBeVisible();
  await expect(ask(page)).toContainText('PLACE BEAMS AND COLUMNS?');
  await expect(ask(page).locator('[data-beam-ask-why]')).toContainText('spans');
  await page.locator('[data-beam-ask-yes]').click();
  await expect(ask(page)).toBeHidden();
  const d = await saved(page);
  expect(midSpan(d).length).toBeGreaterThan(0);
  expect((d.columns || []).filter(c => c.auto && Number(c.levelId) === 1
    && !String(c.footing || '').startsWith('pile')).length).toBeGreaterThan(0);
});

test('NOT NOW takes the mid-span rows and their posts out, says where to place them later; UNDO puts them back', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow');
  await page.locator('[data-beam-ask-no]').click();
  await expect(ask(page)).toBeHidden();
  await expect(page.locator('[data-strip-message]')).toContainText('AUTO BEAM');
  let d = await saved(page);
  expect(midSpan(d)).toHaveLength(0);
  expect((d.columns || []).filter(c => c.auto && c.footing === 'pad36')).toHaveLength(0);
  expect((d.walls || []).length, 'the house stays').toBeGreaterThan(0);
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(midSpan(d).length).toBeGreaterThan(0);
});

test('the stair headers are never asked about: a 2 STOREY keeps its stairwell header through NOT NOW', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey');
  await expect(ask(page)).toBeVisible();
  await page.locator('[data-beam-ask-no]').click();
  const d = await saved(page);
  expect((d.beams || []).some(b => b.stairId), 'the stairwell header').toBe(true);
  expect(midSpan(d)).toHaveLength(0);
});
