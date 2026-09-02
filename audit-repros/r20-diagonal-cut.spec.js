// The work order flags roof-plane intersection on diagonal cuts. This renders
// a 45-degree section through a hip-roofed house for inspection.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R20: a 45-degree section through the house', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(500);
  await h.waitForSaved(page);

  // Corner to corner: 45 degrees across the plan.
  await page.keyboard.press('c');
  await h.clickWorld(page, -16, -13);
  await h.clickWorld(page, 16, 13);
  await h.clickWorld(page, 10, -10);
  await page.waitForTimeout(500);
  await page.locator('.cut-row', { hasText: 'S1' }).click();
  await page.waitForTimeout(1000);
  await page.locator('[data-model-canvas]').screenshot({ path: '/tmp/fc/diagonal-section.png' });
  const roofInk = async (label) => {
    const n = await page.evaluate(() => {
      const c = document.querySelector('[data-model-overlay]');
      const W = c.width, H = c.height;
      const { data } = c.getContext('2d').getImageData(0, 0, W, H);
      // Count dark ink in the top third of the sheet, where a roof would draw.
      let ink = 0;
      for (let y = 0; y < Math.floor(H * 0.28); y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (data[i + 3] > 150 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink++;
        }
      }
      return ink;
    });
    console.log(`${label}: dark ink in the roof zone = ${n}`);
    return n;
  };
  const diag = await roofInk('45-degree cut  ');

  // Controls: the same house, cut square across, and cut 10 degrees off square.
  for (const [name, a, b, v] of [
    ['square cut    ', [-16, 0], [16, 0], [0, -10]],
    ['10-degree cut ', [-16, -2.8], [16, 2.8], [0, -10]],
    ['30-degree cut ', [-16, -9.2], [16, 9.2], [0, -10]],
  ]) {
    await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: 'MAIN FL' }) })
      .locator('.level-name').click();
    await page.waitForTimeout(300);
    await page.keyboard.press('c');
    await h.clickWorld(page, a[0], a[1]);
    await h.clickWorld(page, b[0], b[1]);
    await h.clickWorld(page, v[0], v[1]);
    await page.waitForTimeout(400);
    const rows = page.locator('.cut-row');
    await rows.nth(await rows.count() - 1).click();
    await page.waitForTimeout(900);
    await roofInk(name);
  }
  await page.locator('[data-model-canvas]').screenshot({ path: '/tmp/fc/last-cut.png' });
});
