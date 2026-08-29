// Checklist 1/13: _undo() is async (it re-applies a whole serialized drawing)
// but the keydown handler calls it fire-and-forget. Key auto-repeat therefore
// runs several restores concurrently over the same history stacks.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('R4: held Ctrl+Z (key auto-repeat) races the async undo', async ({ page }) => {
  await h.openModel(page);
  for (let i = 0; i < 5; i++) await drawLine(page, -20 + i, -20, -20 + i, -10);
  expect((await h.savedDrawing(page)).lines.length).toBe(5);

  // One undo at a time is well behaved.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(700);
  console.log('after 1 clean undo:', (await h.savedDrawing(page)).lines.length);

  // Now the same as a held key: four keydowns inside one frame, nothing awaited.
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true, repeat: i > 0,
      }));
    }
  });
  await page.waitForTimeout(2500);
  const after = await h.savedDrawing(page);
  console.log('after 4 repeated undos:', after.lines.length, '(expected 0)');
  expect(after.lines.length, 'four undos from four lines should land on zero').toBe(0);

  // The redo stack should now hold the four states that were undone.
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(600); }
  const redone = await h.savedDrawing(page);
  console.log('after 4 redos:', redone.lines.length, '(expected 4)');
  expect(redone.lines.length, 'redo must retrace the states the raced undo left').toBe(4);
});
