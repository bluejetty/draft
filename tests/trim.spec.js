// Trim shares its intersection choice with the red hover highlight, so it is
// covered end to end as well as in the geometry unit tests.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('trim removes the clicked side up to the nearest crossing', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);   // horizontal
  await drawLine(page, 4, -8, 4, 8);     // vertical, crossing at x = 4

  await h.selectTool(page, 'Trim');
  await h.clickWorld(page, 8, 0);        // click the horizontal line right of the crossing
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const horizontal = lines.filter(line => Math.abs(line.start.z) < 0.1 && Math.abs(line.end.z) < 0.1);
  expect(horizontal).toHaveLength(1);
  // The clicked side is gone: the segment now ends at the crossing, not at x = 10.
  expect(h.touchesPoint(horizontal[0], -10, 0)).toBe(true);
  expect(h.touchesPoint(horizontal[0], 4, 0)).toBe(true);
  expect(h.touchesPoint(horizontal[0], 10, 0)).toBe(false);
});
