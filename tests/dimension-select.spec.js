// Dimension strings are first-class objects for the Select tool: a click on
// the string selects it, a selection window catches it, and Delete removes it
// like any other item.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawDimension(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Dimension');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await h.waitForSaved(page);
}

test('a click on a dimension selects it and Delete removes it', async ({ page }) => {
  await h.openModel(page);
  await drawDimension(page, -8, 0, 8, 0);
  expect((await h.savedDrawing(page)).dimensions).toHaveLength(1);

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, 0);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  expect((await h.savedDrawing(page)).dimensions).toHaveLength(0);
});

test('a selection window catches dimensions along with everything else', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -8, 3);
  await h.clickWorld(page, 8, 3);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await drawDimension(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Select');
  const a = await h.worldToClient(page, -12, -4);
  const b = await h.worldToClient(page, 12, 6);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(h.allLines(saved)).toHaveLength(0);
  expect(saved.dimensions).toHaveLength(0);
});
