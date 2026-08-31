const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('PROBE: can a real hit-tested mouse click draw a line at all?', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  const before = (await h.savedDrawing(page)).lines?.length ?? 0;
  // Far from any overlay: bottom-left of the canvas.
  const a = await h.worldToClient(page, -14, 8);
  const b = await h.worldToClient(page, -6, 8);
  await page.mouse.move(a.x, a.y); await page.mouse.click(a.x, a.y);
  await page.waitForTimeout(400);
  await page.mouse.move(b.x, b.y); await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const after = (await h.savedDrawing(page)).lines?.length ?? 0;
  console.log(`PROBE real-mouse lines: before=${before} after=${after}`);
  expect(after).toBe(before + 1);
});
