// Wheel zoom anchors on the cursor: the plan point under it stays put while
// the view scales, so you can dive toward whatever you are pointing at.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('wheel zoom keeps the plan point under the cursor fixed', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');

  const p = await h.worldToClient(page, 5, 5);
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(50);
  }

  // If (5,5) is still under the cursor, the click lands on it.
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(400);
  await page.mouse.click(p.x, p.y - 80);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines.some(seg => h.touchesPoint(seg, 5, 5))).toBe(true);
});

test('zooming out re-centers away from the cursor too', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');

  const p = await h.worldToClient(page, -8, 6);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(50);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(50);

  // In then out by one notch lands back where it started.
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(400);
  await page.mouse.click(p.x, p.y - 80);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines.some(seg => h.touchesPoint(seg, -8, 6))).toBe(true);
});
