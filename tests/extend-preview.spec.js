// X-first Extend flow: the capture rectangle and captured nodes stay visible
// after the drag ends, a ghost shows where the geometry is moving, and the
// Shift 90° lock and R typed-length commands work from that flow too.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BLUE = [89, 128, 166]; // #5980a6 — current-level Extend accent

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function dragExtendRect(page, x1, z1, x2, z2) {
  const a = await h.worldToClient(page, x1, z1);
  const b = await h.worldToClient(page, x2, z2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test('capture rectangle stays visible and the shape ghosts to the destination', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Extend');
  await dragExtendRect(page, -10, -3, 10, 3);

  // Rectangle still on screen after the drag ended (base phase)
  await h.moveTo(page, 6, -8); // nudge the mouse so the overlay redraws
  const topEdge = await h.worldToClient(page, 0, -3);
  expect(h.countColor(await h.overlayPixels(page, topEdge.x, topEdge.y), BLUE)).toBeGreaterThan(0);

  // Pick a base, then move away: ghost of the line follows the cursor
  await h.clickWorld(page, 0, 0);
  await h.moveTo(page, 0, 6);
  const ghost = await h.worldToClient(page, 4, 6);
  expect(h.countColor(await h.overlayPixels(page, ghost.x, ghost.y), BLUE)).toBeGreaterThan(0);

  // Shift locks the move to a straight 90° direction
  await page.keyboard.down('Shift');
  await h.moveTo(page, 1.5, 6);
  const p = await h.worldToClient(page, 1.5, 6);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up('Shift');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.touchesPoint(lines[0], -8, 6)).toBe(true);
  expect(h.touchesPoint(lines[0], 8, 6)).toBe(true);
});

test('R typed length works in the rectangle-first Extend flow', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Extend');
  await dragExtendRect(page, -10, -3, 10, 3);

  await h.clickWorld(page, 0, 0);   // base at the line midpoint snap
  await h.moveTo(page, 5, 0);       // aim the move to the right
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  await page.keyboard.type("7'");
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.touchesPoint(lines[0], -1, 0)).toBe(true);
  expect(h.touchesPoint(lines[0], 15, 0)).toBe(true);
});
