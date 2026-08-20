const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

const UNDO = 'Control+z';
const REDO = 'Control+Shift+z';

test.describe('undo history', () => {
  test('undo removes the last committed line and redo puts it back', async ({ page }) => {
    await h.openModel(page);
    await drawLine(page, 0, 0, 10, 0);
    await drawLine(page, 0, 5, 10, 5);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(2);

    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    const afterUndo = h.allLines(await h.savedDrawing(page));
    expect(afterUndo).toHaveLength(1);
    expect(h.touchesPoint(afterUndo[0], 0, 0)).toBe(true);

    await page.keyboard.press(REDO);
    await h.waitForSaved(page);
    const afterRedo = h.allLines(await h.savedDrawing(page));
    expect(afterRedo).toHaveLength(2);
    expect(afterRedo.some(line => h.touchesPoint(line, 0, 5))).toBe(true);
  });

  test('undo brings back a deleted wall with its assembly settings', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Wall');
    await h.clickWorld(page, -10, 0);
    await h.clickWorld(page, 10, 0);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    const before = h.allWalls(await h.savedDrawing(page));
    expect(before).toHaveLength(1);

    await h.selectTool(page, 'Select');
    await h.clickWorld(page, 0, 0);
    await page.keyboard.press('Delete');
    await h.waitForSaved(page);
    expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(0);

    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    expect(h.allWalls(await h.savedDrawing(page))).toEqual(before);
  });

  test('undo reverses an import and leaves the drawing that was open before it', async ({ page }) => {
    await h.openModel(page);
    await drawLine(page, 0, 0, 10, 0);
    const before = await h.savedDrawing(page);

    const imported = JSON.parse(JSON.stringify(before));
    imported.lines.push({
      id: 'line-99',
      start: { x: 0, y: 0, z: 8 },
      end: { x: 12, y: 0, z: 8 },
      levelId: imported.lines[0].levelId,
    });
    await page.locator('[data-drawing-import]').setInputFiles({
      name: 'other.draft', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(imported)),
    });
    await h.waitForSaved(page);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(2);

    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
  });

  test('a new edit after undo drops the redo branch', async ({ page }) => {
    await h.openModel(page);
    await drawLine(page, 0, 0, 10, 0);
    await drawLine(page, 0, 5, 10, 5);

    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    await drawLine(page, 0, -5, 10, -5);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(2);

    await page.keyboard.press(REDO);
    await page.waitForTimeout(400);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(2);
    expect(lines.some(line => h.touchesPoint(line, 0, 5))).toBe(false);
    await expect(page.locator('[data-model-drawing-message]')).toContainText('Nothing to redo');
  });

  // History boundaries: loading is not an edit, and neither is a refused one.
  test('reopening a stored drawing records nothing to undo', async ({ page }) => {
    await h.openModel(page);
    await drawLine(page, 0, 0, 10, 0);

    await page.reload();
    await expect(page.locator('[data-model-canvas]')).toBeVisible();
    await page.waitForTimeout(600);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);

    await page.keyboard.press(UNDO);
    await page.waitForTimeout(400);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
  });

  test('a refused import adds no history entry', async ({ page }) => {
    await h.openModel(page);
    await drawLine(page, 0, 0, 10, 0);
    await drawLine(page, 0, 5, 10, 5);

    await page.locator('[data-drawing-import]').setInputFiles({
      name: 'broken.draft', mimeType: 'application/json',
      buffer: Buffer.from('not a drawing'),
    });
    await expect(page.locator('[data-model-drawing-message]')).toContainText('Import failed');

    // One undo has to reach the single-line state. If the refused import had
    // recorded an entry, this would restore the two-line state instead.
    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
  });

  test('undo and redo do not add history entries of their own', async ({ page }) => {
    await h.openModel(page);
    await drawLine(page, 0, 0, 10, 0);
    await drawLine(page, 0, 5, 10, 5);

    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    await page.keyboard.press(REDO);
    await h.waitForSaved(page);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(2);

    // Two edits were made, so two undos must empty the drawing regardless of the
    // undo/redo round trip in between.
    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);
    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
  });

  test('undo restores shared corners rather than duplicating them', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.clickWorld(page, 10, 0);
    await h.clickWorld(page, 10, 10);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await drawLine(page, -10, -10, -5, -10);

    await page.keyboard.press(UNDO);
    await h.waitForSaved(page);

    // Dragging the shared corner has to move both segments, which only holds if
    // the restored endpoints are the same Vector3 instance.
    await h.selectTool(page, 'Select');
    const from = await h.worldToClient(page, 10, 0);
    const to = await h.worldToClient(page, 14, 0);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await h.waitForSaved(page);

    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(2);
    expect(lines.filter(line => h.touchesPoint(line, 14, 0))).toHaveLength(2);
  });
});
