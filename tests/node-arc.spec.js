// Node / Arc tool: a click on a line's body inserts a draggable node there;
// a press beside the line (cursor edge touching) pulls the segment into an arc
// whose bulge follows the cursor. Both edits keep the line's layer and view.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function dragWorld(page, x1, z1, x2, z2) {
  const a = await h.worldToClient(page, x1, z1);
  const b = await h.worldToClient(page, x2, z2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test('clicking a line with the Node/Arc tool inserts a node at that point', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  await h.selectTool(page, 'Node');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  expect(lines.every(line => h.touchesPoint(line, 2, 0))).toBe(true);
  expect(lines.some(line => h.touchesPoint(line, -10, 0))).toBe(true);
  expect(lines.some(line => h.touchesPoint(line, 10, 0))).toBe(true);
  // The split halves stay on the line's own layer — nothing to reorganise.
  expect(lines.every(line => line.layer === 'draft')).toBe(true);
});

test('an inserted node can be dragged to reshape both halves', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  await h.selectTool(page, 'Node');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);
  await dragWorld(page, 2, 0, 2, 5);
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  expect(lines.every(line => h.touchesPoint(line, 2, 5))).toBe(true);
  expect(lines.some(line => h.touchesPoint(line, -10, 0))).toBe(true);
  expect(lines.some(line => h.touchesPoint(line, 10, 0))).toBe(true);
});

test('dragging beside a line pulls it into an arc with a stored bulge', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Node');
  // Press with the cursor edge touching the line (0.6 ft ≈ 7 px off centre).
  await dragWorld(page, 0, 0.6, 0, 4);
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  // Endpoints stay put; only the bulge changes.
  expect(h.touchesPoint(lines[0], -8, 0)).toBe(true);
  expect(h.touchesPoint(lines[0], 8, 0)).toBe(true);
  expect(Math.abs(lines[0].bulge)).toBeGreaterThan(3);
  expect(Math.abs(lines[0].bulge)).toBeLessThan(5);
});

test('an existing arc can be grabbed again and resized', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Node');
  await dragWorld(page, 0, 0.6, 0, 4);
  await h.waitForSaved(page);
  // The curve apex now sits at bulge/2 ≈ 2 ft; grab just beside it and pull further.
  await dragWorld(page, 0, 2.5, 0, 7);
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(Math.abs(lines[0].bulge)).toBeGreaterThan(6);
});

test('a node dropped on an arc lands on the curve and splits the bulge', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Node');
  await dragWorld(page, 0, 0.6, 0, 4);
  await h.waitForSaved(page);
  // The apex of a 4 ft bulge sits at z ≈ 2 — click it dead centre.
  await h.clickWorld(page, 0, 2);
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  expect(lines.every(line => h.touchesPoint(line, 0, 2))).toBe(true);
  // Each half keeps a share of the original curvature.
  expect(lines.every(line => Math.abs(line.bulge) > 0.5)).toBe(true);
});

test('arcs persist through save and reload', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);

  await h.selectTool(page, 'Node');
  await dragWorld(page, 0, 0.6, 0, 4);
  await h.waitForSaved(page);
  const before = h.allLines(await h.savedDrawing(page))[0].bulge;

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(600);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(lines[0].bulge).toBeCloseTo(before, 5);
});
