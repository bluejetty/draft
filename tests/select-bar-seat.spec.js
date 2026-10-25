// THE SELECT KEYS ON THE DIMS ROW (Movie, 24 Oct): "the SELECT / ASSEMBLY /
// DIMENSION / TRIM buttons should be brough down to where they were before
// so the text can be read and they will be level /symetrical with the AUTO
// DIMS / HAND DIMS etc line on the other side".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('the S / Y / D / Q keys are centred on the AUTO DIMS row, under the strip\'s words', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 640 });
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.goto('/MODEL.html?right=1&lpane=build&left=1&pane=levels&level=3&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#dims-show')).toBeVisible();
  const box = id => page.evaluate(id => { const b = document.getElementById(id).getBoundingClientRect(); return { top: b.top, mid: (b.top + b.bottom) / 2 }; }, id);
  const keys = await box('select-bar'), dims = await box('dims-show'), words = await box('strip-message');
  expect(Math.abs(keys.mid - dims.mid), 'level with AUTO DIMS / HAND DIMS').toBeLessThan(2);
  expect(keys.top, 'clear of the strip\'s line of capitals').toBeGreaterThanOrEqual(words.top + 12);
});
