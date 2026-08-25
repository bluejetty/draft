// A closed shape doubles as a flooring AREA: it reports its measured area,
// can carry a finish veneer (tile, carpet, hardwood, laminate) laid over the
// floor sheathing, and saves on A-FL-FLOORING as structured data for the
// future estimates. Without a finish it stays a plain SHAPE outline.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawShapeRect(page) {
  // 16' x 12' rectangle = 192 sq ft.
  await h.selectTool(page, 'Shape');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('a closed shape reports its area in the Shape panel', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);
  await expect(page.getByText('192 SQ FT')).toBeVisible();
});

test('picking a veneer turns the shape into a flooring area on A-FL-FLOORING', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  await page.getByRole('button', { name: 'TILE', exact: true }).click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes).toHaveLength(1);
  const shape = saved.shapes[0];
  expect(shape.layer).toBe('A-FL-FLOORING');
  expect(shape.flooring).toEqual({ type: 'tile', thicknessIn: 3 / 8 });
});

test('NONE clears the finish back to a plain SHAPE outline', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  await page.getByRole('button', { name: 'CARPET', exact: true }).click();
  await h.waitForSaved(page);
  await page.getByRole('button', { name: 'NONE', exact: true }).click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const shape = saved.shapes[0];
  expect(shape.layer).toBe('SHAPE');
  expect(shape.flooring).toBeNull();
});

test('flooring thickness above the sheathing is editable', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  await page.getByRole('button', { name: 'HARDWOOD', exact: true }).click();
  const input = page.getByPlaceholder('3/8"');
  await expect(input).toBeVisible();
  await input.fill('3/4');
  await input.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes[0].flooring).toEqual({ type: 'hardwood', thicknessIn: 3 / 4 });
});

test('flooring areas survive a reload with finish and thickness intact', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  await page.getByRole('button', { name: 'LAMINATE', exact: true }).click();
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes).toHaveLength(1);
  expect(saved.shapes[0].layer).toBe('A-FL-FLOORING');
  expect(saved.shapes[0].flooring).toEqual({ type: 'laminate', thicknessIn: 3 / 8 });

  // Panel still shows the finish as active after reload.
  await h.selectTool(page, 'Shape');
  await expect(page.getByText('192 SQ FT')).toBeVisible();
});
