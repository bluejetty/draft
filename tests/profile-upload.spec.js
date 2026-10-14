// A SETTINGS FILE THAT CAN BE PUT BACK.
//
// Movie, 14 Oct: "in the COMPANY STARDARDS and SETTINGS area , can we save all
// that information onto a file that users can reupload if the information gets
// reloaded and delted", and "offer the user to SAVE The STANDARDS SETTING info
// into a file they can reload".
//
// DOWNLOAD has been on both pages since packages landed. The way BACK was only
// ever in Construction Layout's own dialog -- which is not where somebody who
// has just lost their shortcuts goes looking, and is the half of the sentence
// this file is about. (The standards side, logos and all, is covered in
// tests/company-logo.spec.js, which has a file to carry.)
//
// THE CHECK IS THAT THE PAGE CHANGES, not that the package did. An import that
// wrote localStorage and left every control showing the old answer is exactly
// the quiet half-failure a drafter would carry into the next drawing.
const { test, expect } = require('@playwright/test');

const openSettings = async page => {
  await page.goto('/SETTINGS.html');
  await expect(page.locator('#upload')).toBeVisible();
  // The switches live under a collapsed "Snap zone" panel; a real drafter
  // opens it to reach them, and so does this.
  await page.locator('details.advanced > summary').first().click();
  await expect(page.locator('[data-wallet-sound]')).toBeVisible();
};

test('a settings file put back restores the switches it was saved with', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await openSettings(page);

  // BOTH DEFAULT ON, which is what makes the test readable: whatever is on
  // screen at the end, if it is still the default, nothing was applied.
  await expect(page.locator('[data-wallet-sound]')).toBeChecked();
  await expect(page.locator('[data-auto-windows]')).toBeChecked();

  await page.locator('[data-wallet-sound]').uncheck();
  await page.locator('[data-auto-windows]').uncheck();
  const saved = await page.evaluate(() =>
    JSON.stringify(window.DraftProfileManager.getActive('settings')));
  const model = JSON.parse(saved).content.model;
  expect(model.walletSound, 'the switch never reached the package').toBe(false);
  expect(model.autoWindows).toBe(false);

  // THE BROWSER THAT LOST EVERYTHING, which is the case he described.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('details.advanced > summary').first().click();
  await expect(page.locator('[data-wallet-sound]')).toBeChecked();

  await page.locator('[data-upload-file]').setInputFiles({
    name: 'mine.draft.settings', mimeType: 'application/json', buffer: Buffer.from(saved),
  });
  await expect(page.locator('#status')).toContainText('now active');
  await expect(page.locator('[data-wallet-sound]'),
    'the import did not reach the controls').not.toBeChecked();
  await expect(page.locator('[data-auto-windows]')).not.toBeChecked();
});

test('a settings file is refused on the standards page, and the other way round',
  async ({ page }) => {
    // ONE WRONG FILE IS THE LIKELY MISTAKE, because the two downloads differ by
    // one word in the extension and land in the same folder. profile-manager
    // already refuses a mismatched kind; what matters here is that the page
    // SAYS so instead of appearing to work.
    await page.addInitScript(() => localStorage.clear());
    await openSettings(page);
    // BUILT, NOT READ OFF THE PAGE: nothing has been changed here, so there is
    // no active settings package yet, and `getActive` would hand back null --
    // which the import would refuse as malformed rather than as the WRONG KIND,
    // and the test would pass for the wrong reason.
    const settingsFile = await page.evaluate(() =>
      JSON.stringify(window.DraftProfileManager.createPackage('settings', 'mine', { model: {} })));

    await page.goto('/STANDARDS.html');
    await expect(page.locator('#upload')).toBeVisible();
    await page.locator('[data-upload-file]').setInputFiles({
      name: 'mine.draft.settings', mimeType: 'application/json', buffer: Buffer.from(settingsFile),
    });
    await expect(page.locator('#status')).toHaveClass(/warning/);
    await expect(page.locator('#status')).toContainText('standards');
  });
