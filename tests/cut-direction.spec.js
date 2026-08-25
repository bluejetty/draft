const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The view arrow must point toward the side of the cut line the drafter
// clicks, not away from it.
test('the cut arrow points to the side the drafter clicks', async ({ page }) => {
  await h.openModel(page);

  const answers = [];
  page.on('dialog', dialog => dialog.accept(answers.shift() ?? ''));

  const placeCut = async (name, z, chooseZ) => {
    await page.keyboard.press('c');
    answers.push(name);
    await h.clickWorld(page, -10, z);
    await h.clickWorld(page, 10, z);
    await h.clickWorld(page, 0, chooseZ);
    await page.waitForTimeout(400);
  };

  await placeCut('SECTION A-A', 6, 0);    // click below the line (smaller z)
  await placeCut('SECTION B-B', -6, 0);   // click above the line (larger z)
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const byName = Object.fromEntries(saved.cuts.map(c => [c.name, c]));
  expect(byName['SECTION A-A'].dirVec.z).toBeLessThan(0);
  expect(byName['SECTION B-B'].dirVec.z).toBeGreaterThan(0);
});
