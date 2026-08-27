const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The clicked arrow is the way the view LOOKS. dirVec stores where the viewer
// STANDS — the opposite side — because the bubble triangles and the generated
// workspaces both read it that way (sight line = -dirVec).
test('the cut looks toward the side the drafter clicks', async ({ page }) => {
  await h.openModel(page);

  const placeCut = async (z, chooseZ) => {
    await page.keyboard.press('c');
    await h.clickWorld(page, -10, z);
    await h.clickWorld(page, 10, z);
    await h.clickWorld(page, 0, chooseZ);
    await page.waitForTimeout(400);
  };

  await placeCut(6, 0);    // looks toward smaller z: viewer stands at larger z
  await placeCut(-6, 0);   // looks toward larger z: viewer stands at smaller z
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const byName = Object.fromEntries(saved.cuts.map(c => [c.name, c]));
  expect(byName.S1.dirVec.z).toBeGreaterThan(0);
  expect(byName.S2.dirVec.z).toBeLessThan(0);
});
