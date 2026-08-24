// Select can pick a whole outline by clicking one of its dashed edges (or a
// bare corner). Delete then follows the red/blue scope language: deleting on
// a level removes only that level's copy; deleting the BONEYARD master takes
// every level copy with it. An outline carrying BUILD HOUSE geometry refuses.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOutline(page, points) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('clicking an outline edge selects it and Delete removes the level copy locally', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 6], [-8, 6]]);

  const saved = await h.savedDrawing(page);
  const before = saved.outlines.length;

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -6); // middle of the bottom edge
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const after = await h.savedDrawing(page);
  expect(after.outlines.length).toBe(before - 1);
  // The master and the other level copies survive a local delete.
  expect(after.boneyardOutlines).toHaveLength(1);
});

test('deleting the BONEYARD master takes every level copy with it', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 6], [-8, 6]]);

  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -6);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(0);
  expect(saved.outlines).toHaveLength(0);
});

test('an outline carrying BUILD HOUSE geometry refuses whole-outline delete', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 6], [-8, 6]]);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);

  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -6);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-model-drawing-message]')).toContainText('built geometry');
  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
});

test('Escape clears an outline selection', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 6], [-8, 6]]);

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -6);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.outlines.length).toBeGreaterThan(0);
  expect(saved.boneyardOutlines).toHaveLength(1);
});
