// A GARAGE ABOVE THE HOUSE CEILING: THE BONE ASKS (Movie, 7 Oct): keep the
// garage's 10'-1 3/4" default, "but ... if it (garage) goes higher, ask the
// user if they would prefer to allign the garage height with ceiling
// height". YES: "GARAGE and HOUSE will be ONE ROOF". NO: keep it, and ask
// every time.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = (extra = {}) => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, file = empty()) {
  await h.openModel(page, { webgl: false, garageAlign: 'ask' });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
}
const built = async page => {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 6000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return h.savedDrawing(page);
};
const MAIN_PKG = (11.875 + 0.75) / 12;
const r3 = n => Math.round(n * 1000) / 1000;

test('YES lines the garage up with the house ceiling, under one roof', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow-garage');
  const ask = page.locator('#garage-align');
  await expect(ask).toBeVisible();
  // 10'-1 3/4" from the sill against an 8'-1 1/8" house: a foot over.
  await expect(ask.locator('[data-garage-align-over]')).toHaveText(`1'-0"`);
  await expect(ask.locator('[data-garage-align-to]')).toHaveText(`9'-1 3/4"`);
  await page.locator('[data-garage-align-yes]').click();
  await expect(ask).toBeHidden();
  const d = await built(page);
  expect(r3(d.sectionTable.rows.attachedGarage.mainWallHeightFt)).toBe(r3(109.125 / 12 - 1 + MAIN_PKG));
  expect(d.roofs, 'one roof over house and garage').toHaveLength(1);
});

test('NO keeps the garage at its height, two roofs -- and asks again next time', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow-garage');
  await page.locator('[data-garage-align-no]').click();
  const d = await built(page);
  expect(d.sectionTable?.rows?.attachedGarage?.mainWallHeightFt ?? null).toBeNull();
  expect(d.roofs.filter(r => r.follows === 'attachedGarage')).toHaveLength(1);

  // The next build asks again.
  await open(page);
  await order(page, 'bungalow', 'twoStorey-garage');
  await expect(page.locator('#garage-align')).toBeVisible();
});

test('a garage already level with the house, or a split, is not asked about', async ({ page }) => {
  await open(page, empty({ levelAssemblies: { 3: { wallHeightFt: 109.125 / 12 } } }));
  await order(page, 'bungalow', 'bungalow-garage');
  const d = await built(page);
  await expect(page.locator('#garage-align')).toBeHidden();
  expect(d.roofs).toHaveLength(1);

  await open(page);
  await order(page, 'bungalow', 'twoStorey-over');
  await built(page);
  await expect(page.locator('#garage-align')).toBeHidden();
});
