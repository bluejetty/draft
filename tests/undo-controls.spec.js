// UNDO / REDO you can reach without a keyboard (audit C4).
//
// The history was never missing — `_undo()` / `_redo()` over serialized
// drawing snapshots, bound to Ctrl+Z and Ctrl+Shift+Z. What was missing was
// any way to reach it on the device this app is built for: a drafter on an
// iPad has no keyboard, so every action was permanent. These specs pin the
// two buttons on the instrument strip: that they are there, that they drive
// the SAME history the keyboard drives, that a button with nothing to do
// says so instead of answering a press with silence, and that they are big
// enough for a fingertip.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const undo = page => page.locator('[data-undo]');
const redo = page => page.locator('[data-redo]');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('the strip carries UNDO and REDO, and they undo and redo', async ({ page }) => {
  await h.openModel(page);
  await expect(undo(page)).toBeVisible();
  await expect(redo(page)).toBeVisible();

  await drawLine(page, -20, -20, -20, -10);
  await drawLine(page, -16, -20, -16, -10);
  expect((await h.savedDrawing(page)).lines).toHaveLength(2);

  await undo(page).click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).lines, 'the button undid the second line').toHaveLength(1);

  await undo(page).click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).lines).toHaveLength(0);

  await redo(page).click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).lines, 'and redo puts it back').toHaveLength(1);
});

test('a button with nothing to do is disabled, and says why', async ({ page }) => {
  await h.openModel(page);
  // A fresh drawing has no history either way.
  await expect(undo(page)).toBeDisabled();
  await expect(redo(page)).toBeDisabled();
  await expect(undo(page)).toHaveAttribute('title', /nothing to undo/i);

  await drawLine(page, -20, -20, -20, -10);
  await expect(undo(page), 'an edit lights UNDO').toBeEnabled();
  await expect(redo(page), 'and leaves REDO dark').toBeDisabled();
  await expect(undo(page)).toHaveAttribute('title', /undo the last change/i);

  await undo(page).click();
  await h.waitForSaved(page);
  await expect(redo(page), 'an undo lights REDO').toBeEnabled();

  // A new edit after an undo drops the redo branch — the button follows.
  await drawLine(page, -12, -20, -12, -10);
  await expect(redo(page), 'a new edit closes the redo branch').toBeDisabled();
});

test('the buttons and the keyboard drive one history, not two', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -20, -20, -20, -10);
  await drawLine(page, -16, -20, -16, -10);

  // Undo with the keyboard, redo with the button: if these were separate
  // paths the second half would have nothing to redo.
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => document.body.dataset.saveDirty === '0');
  expect((await h.savedDrawing(page)).lines).toHaveLength(1);
  await expect(redo(page)).toBeEnabled();

  await redo(page).click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).lines).toHaveLength(2);

  // And the other way round.
  await undo(page).click();
  await h.waitForSaved(page);
  await page.keyboard.press('Control+Shift+z');
  await page.waitForFunction(() => document.body.dataset.saveDirty === '0');
  expect((await h.savedDrawing(page)).lines,
    'the keyboard redid what the button undid').toHaveLength(2);
});

test('a fingertip can hit them', async ({ page }) => {
  await h.openModel(page);
  // The audit measured every control on this strip at 15x15 CSS px. 44 is the
  // width these have to clear; the height is the strip's, which is what the
  // strip can give without overlapping the drawing canvas.
  for (const control of [undo(page), redo(page)]) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(34);
  }
});
