const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

// Writes a drawing straight into the store the app loads from, then reloads.
async function seedDrawing(page, drawing) {
  await page.evaluate(async ({ bucket, json }) => {
    const file = new File([json], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: h.STORAGE_BUCKET, json: JSON.stringify(drawing) });
}

test('R7: a null/NaN coordinate silently loads as 0 instead of being refused', async ({ page }) => {
  await h.openModel(page);
  // A minimal, otherwise-valid drawing: one wall from (10,10) to (20,10).
  const base = {
    version: 1,
    levels: [{ id: 3, name: 'MAIN FL', elev: 0, visible: true }],
    walls: [{
      id: 'wall-1', start: { x: 10, y: 0, z: 10 }, end: { x: 20, y: 0, z: 10 },
      levelId: 3, view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
    }],
    nextDrawingItemId: 2,
  };
  // This is exactly what JSON.stringify writes when a coordinate goes NaN.
  base.walls[0].end.x = null;
  await seedDrawing(page, base);
  await page.reload();
  await h.waitForModelReady(page);
  // Force the app to write its in-memory drawing back out.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -20, -20);
  await h.clickWorld(page, -20, -18);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const loaded = await h.savedDrawing(page);
  const wall = (loaded.walls || [])[0];
  console.log('loaded wall:', JSON.stringify(wall && { start: wall.start, end: wall.end }));
  // Either the wall is refused (dropped) or it keeps its geometry.
  // What actually happens: end.x becomes 0 — a 10' wall becomes a 20' wall
  // pointing the other way, with no message.
  expect(wall, 'a wall with a null coordinate must not silently move').toBeFalsy();
});

test('R7b: string / empty / boolean coordinates are coerced instead of refused', async ({ page }) => {
  await h.openModel(page);
  const base = {
    version: 1,
    levels: [{ id: 3, name: 'MAIN FL', elev: 0, visible: true }],
    walls: [
      { id: 'wall-1', start: { x: '', y: 0, z: 10 }, end: { x: 20, y: 0, z: 10 }, levelId: 3, view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' },
      { id: 'wall-2', start: { x: false, y: 0, z: 12 }, end: { x: [], y: 0, z: 12 }, levelId: 3, view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' },
    ],
    nextDrawingItemId: 3,
  };
  await seedDrawing(page, base);
  await page.reload();
  await h.waitForModelReady(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -20, -20);
  await h.clickWorld(page, -20, -18);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const loaded = await h.savedDrawing(page);
  console.log('walls back:', JSON.stringify((loaded.walls || []).map(w => ({ id: w.id, s: w.start, e: w.end }))));
  expect((loaded.walls || []).length, 'garbage coordinates should not survive as real geometry').toBe(0);
});
