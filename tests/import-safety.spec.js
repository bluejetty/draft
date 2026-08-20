const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOneLine(page) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');       // finish the chain
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
}

async function importFile(page, name, contents) {
  await page.locator('[data-drawing-import]').setInputFiles({
    name, mimeType: 'application/json', buffer: Buffer.from(contents),
  });
  await page.waitForTimeout(600);
}

test.describe('failed imports', () => {
  test('a file that is not a drawing reports an error and changes nothing', async ({ page }) => {
    await h.openModel(page);
    await drawOneLine(page);
    const before = await h.savedDrawing(page);

    await importFile(page, 'notes.draft', 'this is not json');

    await expect(page.locator('[data-model-drawing-message]')).toContainText('Import failed');
    await expect(page.locator('[data-model-status]')).toHaveText('SAVED');
    expect(await h.savedDrawing(page)).toEqual(before);
  });

  test('a newer format version is refused, not partly applied', async ({ page }) => {
    await h.openModel(page);
    await drawOneLine(page);
    const before = await h.savedDrawing(page);

    await importFile(page, 'future.draft', JSON.stringify({ version: 99, levels: [] }));

    await expect(page.locator('[data-model-drawing-message]')).toContainText('newer version');
    expect(await h.savedDrawing(page)).toEqual(before);
  });

  test('a valid drawing round-trips', async ({ page }) => {
    await h.openModel(page);
    await drawOneLine(page);
    const exported = await h.savedDrawing(page);

    await importFile(page, 'good.draft', JSON.stringify(exported));

    await expect(page.locator('[data-model-drawing-message]')).toContainText('imported');
    await h.waitForSaved(page);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(h.allLines(exported).length);
  });
});
