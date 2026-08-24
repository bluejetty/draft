// Press-and-drag with the Select tool opens a selection window without picking
// a mode first: blue selects fully enclosed items on the current level, and
// holding Shift while dragging widens it to every level (red). A short click
// still selects single items.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function dragWindow(page, x1, z1, x2, z2, { shift = false } = {}) {
  const a = await h.worldToClient(page, x1, z1);
  const b = await h.worldToClient(page, x2, z2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
}

test('press-and-drag in click mode window-selects enclosed items', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);
  await drawLine(page, -8, 15, 8, 15); // outside the window

  await h.selectTool(page, 'Select');
  await dragWindow(page, -12, -5, 12, 5);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.touchesPoint(lines[0], -8, 15)).toBe(true);
});

test('a short click without dragging still selects a single item', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, 0);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
});

test('holding Shift while dragging selects across all levels', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0); // MAIN FL

  // Switch to 2ND FL and draw a second line in the same footprint.
  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: '2ND FL' }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
  await drawLine(page, -8, 2, 8, 2);

  await h.selectTool(page, 'Select');
  await dragWindow(page, -12, -5, 12, 5, { shift: true });
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
});

test('a single click on the first node closes a shape', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('t'); // set the T-square down — the triangle needs free angles
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -10, -10);
  await h.clickWorld(page, 10, -10);
  await h.clickWorld(page, 0, 10);
  await h.clickWorld(page, -10, -10); // back on the first node — closes
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(3);
});

