const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOneLine(page) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
}

const guard = page => page.locator('[data-file-guard]');
const newButton = page => page.getByRole('button', { name: 'NEW', exact: true });
const openButton = page => page.getByRole('button', { name: 'OPEN', exact: true });

test('NEW on an untouched drawing starts fresh without asking', async ({ page }) => {
  await h.openModel(page);

  await newButton(page).click();

  await expect(guard(page)).toHaveCount(0);
  await expect(page.locator('[data-model-drawing-message]')).toContainText('New drawing started');
});

test('NEW with unsaved work asks first; DON\'T SAVE clears the drawing', async ({ page }) => {
  await h.openModel(page);
  await drawOneLine(page);

  await newButton(page).click();
  await expect(guard(page)).toBeVisible();

  await page.getByRole('button', { name: "DON'T SAVE" }).click();
  await expect(guard(page)).toHaveCount(0);
  await expect(page.locator('[data-model-drawing-message]')).toContainText('New drawing started');
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
});

test('CANCEL keeps the drawing exactly as it was', async ({ page }) => {
  await h.openModel(page);
  await drawOneLine(page);
  const before = await h.savedDrawing(page);

  await newButton(page).click();
  await page.getByRole('button', { name: 'CANCEL' }).click();

  await expect(guard(page)).toHaveCount(0);
  expect(await h.savedDrawing(page)).toEqual(before);
});

test('SAVE FIRST downloads the drawing, then the new sheet appears', async ({ page }) => {
  await h.openModel(page);
  await drawOneLine(page);

  await newButton(page).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SAVE FIRST' }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('model-drawing');
  await expect(guard(page)).toHaveCount(0);
  await expect(page.locator('[data-model-drawing-message]')).toContainText('New drawing started');
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
});

test('a cleared drawing stays cleared after a reload', async ({ page }) => {
  await h.openModel(page);
  await drawOneLine(page);

  await newButton(page).click();
  await page.getByRole('button', { name: "DON'T SAVE" }).click();
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
});

test('NEW is undoable: Ctrl+Z brings the old drawing back', async ({ page }) => {
  await h.openModel(page);
  await drawOneLine(page);

  await newButton(page).click();
  await page.getByRole('button', { name: "DON'T SAVE" }).click();
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);

  await page.locator('[data-model-canvas]').click();
  await page.keyboard.press('Control+z');
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
});

test('OPEN with a clean sheet goes straight to the file picker and imports', async ({ page }) => {
  await h.openModel(page);
  await drawOneLine(page);
  const exported = await h.savedDrawing(page);

  // Saving parks the dirty flag, so OPEN right after asks nothing.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SAVE', exact: true }).click();
  await downloadPromise;

  const chooserPromise = page.waitForEvent('filechooser');
  await openButton(page).click();
  await expect(guard(page)).toHaveCount(0);
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'other.draft', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });

  await expect(page.locator('[data-model-drawing-message]')).toContainText('imported');
});

test('OPEN with unsaved work asks first', async ({ page }) => {
  await h.openModel(page);
  await drawOneLine(page);

  await openButton(page).click();
  await expect(guard(page)).toBeVisible();
  await expect(guard(page)).toContainText('OPEN DRAWING');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: "DON'T SAVE" }).click();
  await chooserPromise;
});
