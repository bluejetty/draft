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

  // A drawing whose envelope is sound but whose entities are partly broken is
  // loaded rather than refused: refusing would throw away the good geometry too.
  // What must never happen is losing entities quietly.
  test('broken entities are skipped, kept out of the drawing, and reported', async ({ page }) => {
    await h.openModel(page);
    await drawOneLine(page);
    const exported = await h.savedDrawing(page);
    const levelId = exported.levels[0].id;

    const partly = {
      ...exported,
      lines: [
        ...exported.lines,
        { id: 'line-900', start: { x: 0, z: 0 }, end: null, levelId },          // no endpoint
        { id: 'line-901', start: { x: 0, z: 0 }, end: { x: 5, z: 5 }, levelId: 9999 }, // missing level
      ],
      floors: [
        { id: 'floor-900', levelId, points: [{ x: 0, z: 0 }, { x: 4, z: 0 }] }, // too few points
      ],
    };

    await importFile(page, 'partly-broken.draft', JSON.stringify(partly));

    // Two different reasons, reported as two different things: the
    // endpoint-less line and the two-point floor are DAMAGE, while the line on
    // level 9999 is simply on a level this drawing does not have. Rolling them
    // together is how a corrupt file hides behind routine leftovers.
    const message = page.locator('[data-model-drawing-message]');
    await expect(message).toContainText('2 items were incomplete');
    await expect(message).toContainText('1 item belonged to a level that is no longer in the drawing');
    await h.waitForSaved(page);
    const saved = await h.savedDrawing(page);
    expect(h.allLines(saved)).toHaveLength(h.allLines(exported).length);
    expect(saved.floors).toHaveLength(0);
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
