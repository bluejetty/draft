// Checklist 14: the suite seeds boneReveal OFF, stair suggestions OFF and a
// 999-bone wallet. No user will ever run that. This drives the shipped
// defaults — all of them, at once, in one document.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R15: the configuration a real first-time user gets', async ({ page }) => {
  test.setTimeout(300000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  // boneReveal: true + autoStairs: true = the real defaults; boneWallet: false
  // = the real 3-bone new-browser wallet.
  await h.openModel(page, { boneReveal: true, autoStairs: true, boneWallet: false });

  const wallet = async () => page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('draft-bone-wallet') || 'null');
    return w ? w.balance : null;
  });
  const msg = async () => (await page.locator('[data-model-drawing-message]').textContent().catch(() => '') || '').trim();
  console.log('wallet at start:', await wallet());

  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-13, -9], [13, -9], [13, 9], [-13, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);

  for (let press = 1; press <= 4; press++) {
    await h.selectTool(page, 'Outline');
    await page.locator('[data-build-house]').click();
    await page.waitForTimeout(1200);
    const d = await h.savedDrawing(page);
    console.log(`bone press ${press}: wallet ${await wallet()}`
      + ` | walls ${(d.walls || []).length} stairs ${(d.stairs || []).length} roofs ${(d.roofs || []).length}`
      + ` | view ${await page.locator('[data-model-title-detail]').last().textContent().catch(() => '-')}`
      + ` | "${(await msg()).slice(0, 90)}"`);
  }
  console.log('page errors:', errors.length ? errors : 'none');
});
