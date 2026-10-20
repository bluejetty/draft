// THE DRIVE-THRU'S THIRD BUTTON (Movie, 20 Oct): "when it gets to this point
// on the DRIVE THRU --- lets replace the 2 lines of text at the very bottom
// (which already have nice buttons above) 'PRESS TO DRAW HOUSE.... etc'
// lines.... in their place i'd like a 3rd button option - 'SPECIFY FRAMING
// DETAILS, HEIGHTS in PROJECT AREA' --- this will take them over to the
// PROJECT AREA with whatever they selected so far".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function open(page, theme = null) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto(theme ? `/MODEL.html?theme=${theme}` : '/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
}
const pick = async (page, family, entry) => {
  const card = page.locator(`[data-build-entry="${entry}"]`);
  if (!(await card.isVisible().catch(() => false))) {
    await page.locator(`[data-build-family="${family}"]`).click();
  }
  await card.click();
};
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

test('the button stands where the two text lines stood, once a type is picked', async ({ page }) => {
  await open(page);
  const go = page.locator('#dt-project-go');
  await expect(go, 'nothing picked, nothing to specify').toBeHidden();
  await expect(page.locator('#dt-build-now')).toHaveCount(0);
  await expect(page.locator('#dt-outline')).toHaveCount(0);
  await pick(page, 'bungalow', 'bungalow');
  await expect(go).toBeVisible();
  await expect(go).toHaveText('SPECIFY FRAMING DETAILS, HEIGHTS in PROJECT AREA');
  // ON THE SCREEN, where the two lines were, under what Gruff says.
  const line = await page.locator('#dt-line').boundingBox();
  const box = await go.boundingBox();
  expect(box.y, 'under the sign\'s line').toBeGreaterThanOrEqual(line.y + line.height - 1);
});

test('it takes the order to PROJECT: the type and its garage light the family row there', async ({ page }) => {
  await open(page);
  await pick(page, 'bungalow', 'bungalow-garage');
  await page.locator('#dt-project-go').click();
  await page.waitForURL(/PROJECT\.html/);
  const d = await stored(page);
  expect(d.buildType).toBe('bungalow');
  expect(d.garagePlan).toBe('attached');
  await expect(page.locator('.type-card[data-type="bungalow"]')).toHaveClass(/\bhome\b/);
  await expect(page.locator('[data-family-entry="bungalow-garage"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-family-entry="bungalow"]')).toHaveAttribute('aria-pressed', 'false');
});

test('a detached garage order opens the DETACHED GARAGE card', async ({ page }) => {
  await open(page);
  await pick(page, 'detachedGarage', 'detached-thickened');
  await page.locator('#dt-project-go').click();
  await page.waitForURL(/PROJECT\.html\?type=detached/);
  await expect(page.locator('#stage-detached')).toBeVisible();
});

test('on ROUGH the sheet carries the button under the banners', async ({ page }) => {
  await open(page, 'rough');
  await pick(page, 'bungalow', 'bungalow');
  const shelf = page.locator('#dt-project-go-shelf');
  await expect(shelf).toBeVisible();
  await expect(page.locator('#dt-project-go'), 'the screen copy is RUFF\'s').toBeHidden();
  const banners = await page.locator('#dt-banners').boundingBox();
  const box = await shelf.boundingBox();
  expect(box.y, 'under the banners').toBeGreaterThanOrEqual(banners.y + banners.height - 1);
  await shelf.click();
  await page.waitForURL(/PROJECT\.html/);
  expect((await stored(page)).buildType).toBe('bungalow');
});
