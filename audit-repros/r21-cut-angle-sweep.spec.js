// Where does the section's roof profile stop being drawn as the cut rotates?
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R21: roof profile vs cut angle', async ({ page }) => {
  test.setTimeout(300000);
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

  const roofInk = () => page.evaluate(() => {
    const c = document.querySelector('[data-model-overlay]');
    const W = c.width, H = c.height;
    const { data } = c.getContext('2d').getImageData(0, 0, W, H);
    let ink = 0;
    for (let y = 20; y < Math.floor(H * 0.30); y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] > 150 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink++;
      }
    }
    return ink;
  });

  for (const t of [0, 2.8, 5.7, 9.2, 11.2, 13.4, 16]) {
    await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: 'MAIN FL' }) })
      .locator('.level-name').click();
    await page.waitForTimeout(300);
    await page.keyboard.press('c');
    await h.clickWorld(page, -16, -t);
    await h.clickWorld(page, 16, t);
    await h.clickWorld(page, 0, -14);
    await page.waitForTimeout(400);
    const rows = page.locator('.cut-row');
    await rows.nth(await rows.count() - 1).click();
    await page.waitForTimeout(900);
    const deg = Math.round(Math.atan2(2 * t, 32) * 180 / Math.PI);
    console.log(`cut at ${String(deg).padStart(2)} deg: roof-zone ink ${await roofInk()}`);
  }
});
