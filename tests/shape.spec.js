// SHAPE is a first-class closed construction outline: draw one by hand or
// CAPTURE it from the exterior wall outline of the level (or the level
// below). It saves on the neutral SHAPE layer and carries no roof / floor
// semantics — the ROOF and FLOOR commands build their own geometry from it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawWallRect(page) {
  // A closed rectangle of exterior walls on MAIN FL PLAN.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6); // close onto the first point
  await h.waitForSaved(page);
}

async function drawShapeRect(page) {
  await h.selectTool(page, 'Shape');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('a shape drawn by hand saves on the SHAPE layer', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes).toHaveLength(1);
  const shape = saved.shapes[0];
  expect(shape.layer).toBe('SHAPE');
  expect(shape.levelId).toBe(3); // MAIN FL
  expect(shape.points).toHaveLength(4);
  expect(shape.points.some(p => h.near(p.x, -8) && h.near(p.z, -6))).toBe(true);
  expect(shape.points.some(p => h.near(p.x, 8) && h.near(p.z, 6))).toBe(true);
});

test('CAPTURE traces the wall outline into a shape without touching the walls', async ({ page }) => {
  await h.openModel(page);
  await drawWallRect(page);

  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Shape');
  await page.getByRole('button', { name: 'CAPTURE WALL OUTLINE' }).click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes).toHaveLength(1);
  const shape = saved.shapes[0];
  expect(shape.layer).toBe('SHAPE');
  expect(shape.levelId).toBe(7);      // lives on ROOF where it was captured
  expect(shape.sourceLevelId).toBe(3); // traced from MAIN FL
  expect(shape.points).toHaveLength(4);
  // The shape sits at the wall line — no overhang or offset applied.
  shape.points.forEach(p => {
    expect(h.near(Math.abs(p.x), 8)).toBe(true);
    expect(h.near(Math.abs(p.z), 6)).toBe(true);
  });
  expect(saved.roofs || []).toHaveLength(0);
  expect(saved.floors || []).toHaveLength(0);

  // The captured walls stay untouched on MAIN FL.
  const walls = h.allWalls(saved);
  expect(walls).toHaveLength(4);
  expect(walls.every(wall => wall.levelId === 3)).toBe(true);
});

test('CAPTURE without a closed wall outline reports a clear failure', async ({ page }) => {
  await h.openModel(page);

  // An open L of walls: no closed outline anywhere.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Shape');
  await page.getByRole('button', { name: 'CAPTURE WALL OUTLINE' }).click();
  await expect(page.getByText(/do not close into an outline/)).toBeVisible();

  const saved = await h.savedDrawing(page);
  expect(saved.shapes || []).toHaveLength(0);
});

test('FLOOR built from a shape saves to FLOOR and leaves the shape untouched', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  await h.selectTool(page, 'Floor');
  await page.getByRole('button', { name: 'FLOOR FROM SHAPE' }).click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.floors).toHaveLength(1);
  const floor = saved.floors[0];
  expect(floor.levelId).toBe(3);
  expect(floor.view).toBe('floor'); // FLOOR layer set, wherever it was built from
  expect(floor.points).toHaveLength(4);
  expect(floor.points.some(p => h.near(p.x, -8) && h.near(p.z, -6))).toBe(true);
  expect(saved.shapes).toHaveLength(1);
  expect(saved.shapes[0].points).toHaveLength(4);
});

test('editing a derived floor never moves the source shape', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  await h.selectTool(page, 'Floor');
  await page.getByRole('button', { name: 'FLOOR FROM SHAPE' }).click();
  await h.waitForSaved(page);

  // Drag the floor's corner on the FLOOR layer set, where the shape's own
  // corner is not the nearer vertex.
  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'FLOOR', exact: true }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, 8, 6);
  const to = await h.worldToClient(page, 12, 10);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const floor = saved.floors[0];
  expect(floor.points.some(p => h.near(p.x, 12) && h.near(p.z, 10))).toBe(true);
  // The source shape still sits at the original rectangle.
  const shape = saved.shapes[0];
  expect(shape.points.some(p => h.near(p.x, 12) && h.near(p.z, 10))).toBe(false);
  expect(shape.points.some(p => h.near(p.x, 8) && h.near(p.z, 6))).toBe(true);
});

test('shapes survive a reload', async ({ page }) => {
  await h.openModel(page);
  await drawShapeRect(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);

  const saved = await h.savedDrawing(page);
  expect(saved.shapes).toHaveLength(1);
  expect(saved.shapes[0].layer).toBe('SHAPE');
  expect(saved.shapes[0].points).toHaveLength(4);
});
