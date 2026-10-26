// RESIDENTIAL SUITE / COMMERCIAL SUITE: chosen on the drive-thru or the
// PROJECT page, drawn on the BONEYARD, and brought into a house as a hologram.
//
// Movie, 20 Oct: "make the TYPE (the firt card like BUNGALOW / BILEVEL /
// "SUITE") call it SUITE at the 1st CARD level, then RESIDENTIAL SUITE as
// option 1, COMMERCIAL SUITE as option 2" -- on the drive-thru "a RESIDENTIAL
// SUITE card and a COMMERCIAL SUITE card (close together)" -- on PROJECT "a
// 4th mainn card "SUITE" after BILEVEL, and offer 2 choices in are to the
// right "RESIDENTIAL" & "COMMERCIAL"" -- "both those 'SUITES will be built in
// the BONE'YARD" (the minus level) "and will be to place as HOLOGRAM in
// another DRAFT file", where it stays a blue hologram until set to SUITE.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
  { id: 1, name: 'FOUNDATION', elev: -8 }];
const drawing = extra => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
const W = (id, a, b, levelId) => ({ id, start: P(...a), end: P(...b), levelId, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });

async function open(page, f, url = '/MODEL.html?right=1') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const closeCard = async page => {
  if (await page.locator('#trace-ask').isVisible()) await page.locator('[data-trace-later]').click();
  if (await page.locator('#hologram-ask').isVisible()) await page.locator('[data-hologram-close]').click();
};
async function saved(page) {
  await closeCard(page);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const onBoneyard = page => expect(page.locator('[data-boneyard]')).toHaveAttribute('data-active', '');

test('the drive-thru: the two suite tiles stand together in the top row, and the bone opens the BONEYARD', async ({ page }) => {
  await open(page, drawing());
  await h.openDriveThru(page);
  const stack = page.locator('#build-families [data-build-stack="suite"]');
  await expect(stack.locator('[data-build-entry]')).toHaveText(['RESIDENTIAL SUITE', 'COMMERCIAL SUITE']);
  await stack.locator('[data-build-entry="suite-commercial"]').click();
  await expect(stack.locator('[data-build-entry="suite-commercial"]')).toHaveClass(/chosen/);
  await page.locator('#dt-bone').click();
  await onBoneyard(page);
  await expect(page.locator('#strip-message')).toContainText('COMMERCIAL SUITE');
  const d = await saved(page);
  expect(d.suiteKind).toBe('commercial');
  expect(d.buildType ?? null, 'a suite is not a house type').toBeNull();
});

test('a sheet that already holds a drawing is asked to save first, and the suite starts on a clean file', async ({ page }) => {
  await open(page, drawing({ walls: [W('w1', [0, 0], [10, 0], 3)] }));
  await h.openDriveThru(page);
  await page.locator('[data-build-entry="suite-residential"]').click();
  await page.locator('#dt-bone').click();
  await expect(page.locator('#file-guard')).toBeVisible();
  await page.locator('[data-guard-discard]').click();
  await onBoneyard(page);
  const d = await saved(page);
  expect(d.suiteKind).toBe('residential');
  expect(d.walls, 'a clean file').toHaveLength(0);
});

test('a suite file opens on the BONEYARD, where it is drawn', async ({ page }) => {
  await open(page, drawing({ suiteKind: 'residential' }));
  await onBoneyard(page);
  // AND A HOUSE FILE DOES NOT.
  await open(page, drawing());
  await expect(page.locator('[data-boneyard]')).not.toHaveAttribute('data-active', '');
});

test('PROJECT: SUITE is the 4th card, RESIDENTIAL and COMMERCIAL beside it, and the bone starts it on the BONEYARD', async ({ page }) => {
  await open(page, drawing());
  await page.goto('/PROJECT.html');
  const cards = page.locator('.type-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(3)).toHaveAttribute('data-type', 'suite');
  await cards.nth(3).click();
  await expect(page.locator('#stage-suite')).toBeVisible();
  const kinds = page.locator('#suite-family-row .family-button');
  await expect(kinds).toHaveText(['RESIDENTIAL', 'COMMERCIAL']);
  await kinds.first().click();
  await expect(kinds.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.nth(3), 'the project is the suite card now').toHaveClass(/home/);
  await expect.poll(async () => (await h.savedDrawing(page)).suiteKind, 'PROJECT saved which suite').toBe('residential');
  await page.locator('#bone').click();
  await page.waitForURL(/MODEL\.html/);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openModelRail(page);
  await onBoneyard(page);
  const d = await saved(page);
  expect(d.suiteKind).toBe('residential');
});

test('INSERTED INTO A HOUSE: it comes in a blue hologram, standing on a floor, and its card names the kind', async ({ page }) => {
  // A SUITE DRAWN ON THE BONEYARD: its walls are on shelf 1, level -1.
  const suite = drawing({ suiteKind: 'commercial',
    boneyardShelves: [{ id: 1, name: 'SHELF 1' }], activeBoneyardShelfId: 1,
    walls: [W('s1', [0, 0], [12, 0], -1), W('s2', [12, 0], [12, 10], -1)] });
  await open(page, drawing(), '/MODEL.html?level=3');
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-ask-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name: 'cafe.draft', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(suite)) });
  await page.keyboard.press('Escape');
  const d = await saved(page);
  const [holo] = d.holograms;
  expect(holo.mode ?? null, 'a blue hologram until it is set to SUITE').toBeNull();
  expect(holo.source.walls.map(w => w.levelId), 'standing on its MAIN FL').toEqual([3, 3]);
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('#hologram-ask [data-hologram-name]').first()).toHaveText('COMMERCIAL SUITE · cafe');
});
