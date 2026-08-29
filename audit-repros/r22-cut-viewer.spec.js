// The same diagonal cut, two different viewer-side clicks.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R22: viewer side vs the roof profile on a diagonal cut', async ({ page }) => {
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

  const cases = [
    ['t=13  (39 deg)', [10, -10], 13],
    ['t=13.4 (40 deg)', [0, -14], 13.4],
    ['t=16  (45 deg)', [0, -18], 16],
    ['t=9.2 (30 deg)', [0, -14], 9.2],
  ];
  for (const [label, v, t] of cases) {
    await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: 'MAIN FL' }) })
      .locator('.level-name').click();
    await page.waitForTimeout(300);
    await page.keyboard.press('c');
    await h.clickWorld(page, -16, -t);
    await h.clickWorld(page, 16, t);
    await h.clickWorld(page, v[0], v[1]);
    await page.waitForTimeout(400);
    const rows = page.locator('.cut-row');
    await rows.nth(await rows.count() - 1).click();
    await page.waitForTimeout(900);
    const ink = await roofInk();
    const title = (await page.locator('[data-model-title-detail]').last().textContent().catch(() => '')) || '';
    console.log(`${label}: roof-zone ink ${ink} | view ${title.trim()}`);
    await page.locator('[data-model-canvas]').screenshot({ path: `/tmp/fc/cut-t${t}.png` });
  }
});
