// PROFESSOR GRUFF's entry performance notice (#227): the drafting engine runs
// entirely on the visitor's machine, so on entry he asks them to close other
// browser windows and tabs. GOT IT, Enter, or a drawing click puts it away;
// "don't show this again" rides the settings profile through a reload.
// These specs wait for model-ready inline — helpers.waitForModelReady would
// dismiss the notice before it could be asserted on.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function openModelRaw(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
}

test('the notice greets a fresh visit and GOT IT puts it away', async ({ page }) => {
  await openModelRaw(page);

  await expect(page.locator('[data-perf-notice]')).toBeVisible();
  await expect(page.getByText(/CLOSE ALL OTHER BROWSER WINDOWS AND TABS/)).toBeVisible();
  await expect(page.getByText('Professor Gruff').first()).toBeVisible();

  await page.locator('[data-perf-notice-continue]').click();
  await expect(page.locator('[data-perf-notice]')).toBeHidden();
});

test('Enter dismisses the notice from the keyboard', async ({ page }) => {
  await openModelRaw(page);
  await expect(page.locator('[data-perf-notice]')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.locator('[data-perf-notice]')).toBeHidden();
});

test('the first drawing click retires the notice without losing the click', async ({ page }) => {
  await openModelRaw(page);
  await expect(page.locator('[data-perf-notice]')).toBeVisible();

  await h.clickWorld(page, 0, 8);
  await expect(page.locator('[data-perf-notice]')).toBeHidden();
});

test("don't show this again survives a reload; a plain dismissal doesn't", async ({ page }) => {
  await openModelRaw(page);
  await expect(page.locator('[data-perf-notice]')).toBeVisible();

  // A plain GOT IT is per-visit only: the next entry greets again.
  await page.locator('[data-perf-notice-continue]').click();
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  await expect(page.locator('[data-perf-notice]')).toBeVisible();

  // The checkbox makes it permanent.
  await page.locator('[data-perf-notice-off]').check();
  await page.locator('[data-perf-notice-continue]').click();
  await expect(page.locator('[data-perf-notice]')).toBeHidden();

  await page.reload();
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  await page.waitForTimeout(800); // the profile restore gets a beat to (not) re-open it
  await expect(page.locator('[data-perf-notice]')).toBeHidden();
});
