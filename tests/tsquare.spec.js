// The full-time T-square: drawing squares to 90° with no modifier held, the
// cursor roams free while the endpoint projects onto the locked ray, and T
// sets the square down for the odd angled wall. TRIM lives on Q now.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('drawing squares to 90° by default', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 0, 0, 8, 2.5);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  // The cursor sat well off axis; the endpoint stayed on the horizontal ray.
  expect(h.near(lines[0].end.x, 8)).toBe(true);
  expect(h.near(lines[0].end.z, 0)).toBe(true);
});

test('T sets the T-square down for a free angle and picks it back up', async ({ page }) => {
  await h.openModel(page);

  await page.keyboard.press('t');
  await drawLine(page, 0, 0, 6, 4);

  let lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.near(lines[0].end.x, 6)).toBe(true);
  expect(h.near(lines[0].end.z, 4)).toBe(true);

  await page.keyboard.press('t');
  await drawLine(page, 0, -8, 5, -6.5);

  lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  const squared = lines.find(line => h.near(line.start.z, -8));
  expect(h.near(squared.end.x, 5)).toBe(true);
  expect(h.near(squared.end.z, -8)).toBe(true);
});

test('a reference node across the plan sets the locked length exactly', async ({ page }) => {
  await h.openModel(page);
  // A reference segment whose near node sits off the drawing axis.
  await drawLine(page, 6, -2, 10, -2);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  // The free cursor grabs the node at (6,-2); the endpoint takes its
  // perpendicular projection onto the locked horizontal ray: exactly (6,0).
  await h.clickWorld(page, 6, -2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const drawn = lines.find(line => h.near(line.start.x, 0) && h.near(line.start.z, 0));
  expect(h.near(drawn.end.x, 6, 0.05)).toBe(true);
  expect(h.near(drawn.end.z, 0, 0.05)).toBe(true);
});

test('held Shift protractor takes over from the T-square at 45°', async ({ page }) => {
  await h.openModel(page);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await page.keyboard.down('Shift');
  await h.clickWorld(page, 6, 5);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  // (6,5) projected onto the 45° ray lands at (5.5, 5.5).
  expect(h.near(lines[0].end.x, 5.5)).toBe(true);
  expect(h.near(lines[0].end.z, 5.5)).toBe(true);
});

test('TRIM answers to Q and wears it on its label', async ({ page }) => {
  await h.openModel(page);

  await expect(page.getByRole('button', { name: /Trim\s+\[Q\]/i })).toBeVisible();
  await page.keyboard.press('q');
  const labels = await h.activeToolLabels(page);
  expect(labels.some(label => /trim/i.test(label))).toBe(true);
});

// Closing on the first node: with the T-square holding the last corner square,
// a click ON the first node lands the projected corner AND closes the loop —
// three corners plus one click on the start finishes a rectangle.
async function realClick(page, x, z) {
  const p = await h.worldToClient(page, x, z);
  await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test('an outline rectangle closes on the first-node click', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await realClick(page, -8, -6);
  await realClick(page, 8, -6);
  await realClick(page, 8, 6);
  await realClick(page, -8, -6);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const pts = saved.boneyardOutlines[0].points;
  expect(pts).toHaveLength(4);
  // The squared 4th corner: same x as the start, same z as the 3rd corner.
  expect(h.near(pts[3].x, pts[0].x)).toBe(true);
  expect(h.near(pts[3].z, pts[2].z)).toBe(true);
});

test('a shape rectangle closes on the first-node click', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Shape');
  await realClick(page, -8, -6);
  await realClick(page, 8, -6);
  await realClick(page, 8, 6);
  await realClick(page, -8, -6);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes).toHaveLength(1);
  expect(saved.shapes[0].points).toHaveLength(4);
});

test('the chip reports the T-square state and T survives a reload', async ({ page }) => {
  await h.openModel(page);

  const chip = page.locator('[data-mode-tsquare]');
  await expect(chip).toHaveAttribute('title', /T-SQUARE on/i);
  await page.keyboard.press('t');
  await expect(chip).toHaveAttribute('title', /T-SQUARE off/i);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await expect(page.locator('[data-mode-tsquare]')).toHaveAttribute('title', /T-SQUARE off/i);
});

test('Space drops corners on the snap point and Enter finishes the run', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Shape');

  for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) {
    const p = await h.worldToClient(page, x, z);
    await page.mouse.move(p.x, p.y, { steps: 8 });
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes).toHaveLength(1);
  expect(saved.shapes[0].points).toHaveLength(4);
});

test('the protractor chip lights with the blade the modifiers hold', async ({ page }) => {
  await h.openModel(page);

  const angle = page.locator('[data-protractor-angle]');
  await expect(angle).toHaveText('');

  await page.keyboard.down('Shift');
  await expect(angle).toHaveText('45°');

  await page.keyboard.down('Control');
  await expect(angle).toHaveText('30°');

  // Ctrl alone holds no blade any more — it is the T-square toggle tap.
  await page.keyboard.up('Shift');
  await expect(angle).toHaveText('');

  await page.keyboard.up('Control');
  await expect(angle).toHaveText('');
});
