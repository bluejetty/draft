// THE SELECT KEYS ON THE DIMS ROW (Movie, 24 Oct, since moved -- see below): "the SELECT / ASSEMBLY /
// DIMENSION / TRIM buttons should be brough down to where they were before
// so the text can be read and they will be level /symetrical with the AUTO
// DIMS / HAND DIMS etc line on the other side".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// AND THE DIMS ROW WENT DOWN, 11 Nov (Movie, with a mockup: "move the dims
// stuff down to the bottom right"): the chips stand on the foot lane, left
// of the clock. The keys keep their line under the strip's words.
test('the S / Y / D / Q keys stand under the strip\'s words, and the DIMS chips on the foot lane left of the clock', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 640 });
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.goto('/MODEL.html?right=1&lpane=build&left=1&pane=levels&level=3&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#dims-show')).toBeVisible();
  const box = id => page.evaluate(id => { const b = document.getElementById(id).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, mid: (b.top + b.bottom) / 2 }; }, id);
  const keys = await box('select-bar'), dims = await box('dims-show'), words = await box('strip-message');
  const clock = await box('clock'), foot = await box('house-strip');
  expect(keys.top, 'clear of the strip\'s line of capitals').toBeGreaterThanOrEqual(words.top + 12);
  expect(dims.bottom, 'the chips stand on the foot bar').toBeLessThanOrEqual(640 + 1);
  expect(dims.top, 'in its lane').toBeGreaterThanOrEqual(foot.top);
  expect(dims.right, 'left of the clock').toBeLessThanOrEqual(clock.left);
  expect(clock.left - dims.right, 'and beside it').toBeLessThanOrEqual(16);
});
