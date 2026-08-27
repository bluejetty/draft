// Selection-first Extend (window-select, then X), typed-length Extend moves
// (R), and polar tracking — hovering a node acquires it as an orange origin
// whose 45° rays the cursor snaps along while drawing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function dragWindow(page, x1, z1, x2, z2) {
  const a = await h.worldToClient(page, x1, z1);
  const b = await h.worldToClient(page, x2, z2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test('window-select then X extends the selection: base and destination clicks move it', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Select');
  await dragWindow(page, -12, -5, 12, 5);
  await page.keyboard.press('x');
  await page.waitForTimeout(200);

  await h.clickWorld(page, -8, 0);  // base point on a node
  await h.clickWorld(page, -8, 5);  // destination: straight down 5'
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.touchesPoint(lines[0], -8, 5)).toBe(true);
  expect(h.touchesPoint(lines[0], 8, 5)).toBe(true);
});

test('R freezes the Extend move so an exact length can be typed', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Select');
  await dragWindow(page, -12, -5, 12, 5);
  await page.keyboard.press('x');
  await page.waitForTimeout(200);

  await h.clickWorld(page, 0, 0);   // base at the line midpoint snap
  await h.moveTo(page, 5, 0);       // aim the move to the right
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  await page.keyboard.type("5'");
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.touchesPoint(lines[0], -3, 0)).toBe(true);
  expect(h.touchesPoint(lines[0], 13, 0)).toBe(true);
});

test('hovering a node acquires an orange polar origin whose 45° rays snap the cursor', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('p'); // pick the compass up — polar is off by default
  await drawLine(page, 0, 0, 5, -5); // away from the origin, so any snap must be polar

  await h.selectTool(page, 'Line');
  await h.moveTo(page, 0, 0);      // acquire the node as origin
  await expect(page.locator('[data-model-polar]')).toBeVisible();

  await h.moveTo(page, 10, 0.2);   // near the horizontal ray, not on it
  await expect(page.locator('[data-model-polar]')).toBeVisible();

  await h.clickWorld(page, 10, 0.2);
  await page.waitForTimeout(400);
  await h.clickWorld(page, 10, 5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const added = lines.find(line => h.touchesPoint(line, 10, 5));
  expect(added).toBeTruthy();
  const snapped = [added.start, added.end].find(pt => Math.abs(pt.x - 10) < 0.05);
  expect(snapped).toBeTruthy();
  expect(Math.abs(snapped.z)).toBeLessThan(0.05); // pulled onto the ray (z = 0)
});
