// PROFESSOR GRUFF's attached-garage lesson: arming ATTACHED GARAGE opens a
// dismissible callout teaching the connection — start ON the house, three
// legs out-around-back, land ON the house — instead of bending the live line
// mechanics. The first drawing click retires it, "don't show this again"
// remembers across reloads, and DETACHED garages never see it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawHouseOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function armAttached(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
}

test('arming ATTACHED GARAGE opens the lesson; GOT IT closes it, marking stays armed', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await armAttached(page);

  await expect(page.locator('[data-garage-callout]')).toBeVisible();
  await page.locator('[data-garage-callout-continue]').click();
  await expect(page.locator('[data-garage-callout]')).toBeHidden();
  await expect(page.getByRole('button', { name: /MARKING ATTACHED GARAGE/ })).toBeVisible();
});

test('the first drawing click retires the lesson and still places the corner', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await armAttached(page);
  await expect(page.locator('[data-garage-callout]')).toBeVisible();

  await h.clickWorld(page, 8, -4);
  await expect(page.locator('[data-garage-callout]')).toBeHidden();

  // The click was not swallowed — the run carries on from it.
  await h.clickWorld(page, 14, -4);
  await h.clickWorld(page, 14, 4);
  await h.clickWorld(page, 8, 4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster).toBeTruthy();
  expect(garageMaster.points).toHaveLength(4);
  expect(h.near(garageMaster.points[0].x, 8)).toBe(true);
  expect(h.near(garageMaster.points[0].z, -4)).toBe(true);
});

test("don't show this again holds across re-arming and a reload", async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await armAttached(page);
  await expect(page.locator('[data-garage-callout]')).toBeVisible();
  await page.locator('[data-garage-callout-off]').check();
  await page.locator('[data-garage-callout-continue]').click();

  // Re-arming in the same visit stays quiet...
  await page.getByRole('button', { name: /MARKING ATTACHED GARAGE/ }).click(); // off
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();    // on again
  await expect(page.locator('[data-garage-callout]')).toBeHidden();

  // ...and the choice rides the settings profile through a reload.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await armAttached(page);
  await expect(page.locator('[data-garage-callout]')).toBeHidden();
  await expect(page.getByRole('button', { name: /MARKING ATTACHED GARAGE/ })).toBeVisible();
});

test('DETACHED GARAGE never opens the attached lesson', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /DETACHED GARAGE/ }).click();
  await expect(page.locator('[data-garage-callout]')).toBeHidden();
});
