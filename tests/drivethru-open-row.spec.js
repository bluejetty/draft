// THE DRIVE-THRU'S OPEN ROW (jb, 24 Nov 2026): "we should add - open
// existing plan - to this, maybe above or below the others to 'seperate' it
// somewhat", then OPEN DETAIL LIBRARY beside it.
//
// What is pinned: the row sits ABOVE the house types on the shelf, apart
// from them; OPEN EXISTING PLAN is the top bar's OPEN (the same picker) and
// the board goes down once a file is in; OPEN DETAIL LIBRARY lists the
// libraries this browser keeps and opens the one pressed; and the row steps
// aside while a family's submenu needs the shelf.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));
const SHOTS = process.env.DRAFT_SHOTS || '';

async function openPage(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

test('the open row stands above the house types, apart from them', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 700 });
  await openPage(page);
  await h.openDriveThru(page);
  const row = page.locator('[data-drivethru-open-row]');
  await expect(row).toBeVisible();
  expect(await row.locator('button').allTextContents())
    .toEqual(['OPEN EXISTING PLAN', 'OPEN DETAIL LIBRARY']);
  const rowBox = await row.boundingBox();
  const families = await page.locator('#build-families').boundingBox();
  expect(rowBox.y + rowBox.height, 'the row is above the tiles, not among them')
    .toBeLessThanOrEqual(families.y);
  const shelf = await page.locator('#dt-tiles').boundingBox();
  expect(rowBox.y, 'and on the shelf').toBeGreaterThanOrEqual(shelf.y);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '1-ruff-open-row.png') });

  // A FAMILY'S SUBMENU NEEDS THE SHELF, so the row steps aside for it.
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await expect(page.locator('#dt-tiles [data-build-entry]').first()).toBeVisible();
  await expect(row).toBeHidden();
});

test('CLASSIC DRAFTING stands on its own dark row under the house tiles', async ({ page }) => {
  // jb, 25 Nov 2026: "lets move the CLASSIC DRAFTING to underneath and make
  // it dark blue like the upper buttons".
  await page.setViewportSize({ width: 1366, height: 700 });
  await openPage(page);
  await h.openDriveThru(page);
  const row = page.locator('[data-drivethru-classic-row]');
  await expect(row).toBeVisible();
  expect(await row.locator('button').allTextContents()).toEqual(['CLASSIC DRAFTING']);
  await expect(page.locator('#build-families [data-build-entry="classic-drafting"]'),
    'no longer in the site-plan stack').toHaveCount(0);
  const rowBox = await row.boundingBox();
  const families = await page.locator('#build-families').boundingBox();
  expect(rowBox.y, 'under the tiles').toBeGreaterThanOrEqual(families.y + families.height - 1);
  // CENTRED under them, as the OPEN row is centred over them.
  const button = await row.locator('button').boundingBox();
  const mid = families.x + families.width / 2;
  expect(Math.abs(button.x + button.width / 2 - mid), 'centred').toBeLessThan(12);
  // THE SAME PLATE AS THE OPEN ROW's buttons, in this skin and the other.
  const look = sel => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await look('[data-drivethru-classic-row] button'))
    .toBe(await look('[data-drivethru-open-plan]'));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '4-classic-row-night.png') });
  await page.locator('[data-theme-switch] [data-theme="rough"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'rough');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '5-classic-row-rough.png') });
  expect(await look('[data-drivethru-classic-row] button'), 'dark blue on ROUGH')
    .toBe('rgb(31, 63, 107)');
  expect(await look('[data-drivethru-classic-row] button'))
    .toBe(await look('[data-drivethru-open-plan]'));

  // A FAMILY'S SUBMENU NEEDS THE SHELF, so this row steps aside too.
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await expect(page.locator('#dt-tiles [data-build-entry]').first()).toBeVisible();
  await expect(row).toBeHidden();
});

test('OPEN EXISTING PLAN is the top bar OPEN, and the board goes down once a file is in',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-drivethru-open-plan]').click();
    const picker = await chooser;
    expect(await picker.element().getAttribute('id')).toBe('file-input');
    await picker.setFiles({ name: 'site.draft', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(REPRO)) });
    await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  });

test('OPEN DETAIL LIBRARY lists this browser\'s libraries and opens the one pressed',
  async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 700 });
    await openPage(page);
    const lib = { ...REPRO, standalone: 'details', detailsLibrary: 'FRAMING SET' };
    await page.evaluate(async saved => {
      await window.SharedFileStore.saveNamedFile(
        new File([JSON.stringify(saved)], 'FRAMING SET.draft', { type: 'application/json' }),
        'details-libraries');
    }, lib);
    await h.openDriveThru(page);
    await page.locator('[data-drivethru-open-details]').click();
    const list = page.locator('[data-drivethru-open-list]');
    await expect(list).toBeVisible();
    expect(await list.locator('button').allTextContents())
      .toEqual(['FRAMING SET', 'FROM COMPUTER', 'BACK']);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '2-detail-library-list.png') });

    await list.getByRole('button', { name: 'BACK' }).click();
    await expect(page.locator('[data-drivethru-open-row]')).toBeVisible();

    await page.locator('[data-drivethru-open-details]').click();
    await list.getByRole('button', { name: 'FRAMING SET' }).click();
    await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
    expect(await page.evaluate(() => drawing.standalone)).toBe('details');
  });

test('rough: the open row wears the sheet\'s blue', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 700 });
  await openPage(page);
  await page.goto('/MODEL.html?mode=night&theme=rough');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await expect(page.locator('[data-drivethru-open-row]')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '3-rough-open-row.png') });
});
