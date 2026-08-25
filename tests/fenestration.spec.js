// One FENESTRATION command hosts door and window openings on existing walls.
// The DOOR / WINDOW option picks the CAD layer (A-DOOR / A-GLAZ); each opening
// stores its centre offset along the wall, width, and heights from the bottom
// of the wall, and the wall renders with a gap at the opening.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const WALL_STROKE = [29, 31, 32]; // #1d1f20, committed wall boundary color

async function switchLayerView(page, label) {
  await page.locator('.level-row.active').getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function switchLevel(page, name) {
  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawWall(page) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// Small sample window so jamb lines and the centre grab dot stay out of frame.
async function wallStrokeCount(page, x, z) {
  const p = await h.worldToClient(page, x, z);
  const pixels = await h.overlayPixels(page, p.x, p.y, 5);
  return h.countColor(pixels, WALL_STROKE);
}

test('FENESTRATION is a stable rail command with DOOR / WINDOW options', async ({ page }) => {
  await h.openModel(page);
  const rail = page.locator('[data-model-left]').getByRole('button', { name: /\bFenestration\b/i });
  await expect(rail).toBeVisible();

  await h.selectTool(page, 'Fenestration');
  await expect(page.getByRole('button', { name: 'DOOR', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'WINDOW', exact: true })).toBeVisible();
});

test('a door opening saves on A-DOOR with its host wall, centre and sizes', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fenestrations).toHaveLength(1);
  const opening = drawing.fenestrations[0];
  expect(opening.type).toBe('door');
  expect(opening.layer).toBe('A-DOOR');
  expect(opening.wallId).toBe(drawing.walls[0].id);
  expect(opening.offset).toBeCloseTo(12, 0); // centre 12ft from the wall start
  expect(opening.width).toBeCloseTo(3, 5);   // default 3'-0" door
  expect(opening.sillHeight).toBe(0);        // doors sit at the bottom of the wall
  expect(opening.headHeight).toBeCloseTo((6 * 12 + 8) / 12, 3); // 6'-8" head
});

test('a window opening saves on A-GLAZ with a sill height above the wall bottom', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
  await h.clickWorld(page, -3, 0);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fenestrations).toHaveLength(1);
  const opening = drawing.fenestrations[0];
  expect(opening.type).toBe('window');
  expect(opening.layer).toBe('A-GLAZ');
  expect(opening.width).toBeCloseTo(4, 5);      // default 4'-0" window
  expect(opening.sillHeight).toBeCloseTo(2.5, 5); // default 2'-6" sill
  expect(opening.headHeight).toBeGreaterThan(opening.sillHeight);
});

test('typed width, sill and head heights flow into the next opening', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
  await page.getByLabel('Opening width').fill('5');
  await page.getByLabel('Window sill height').fill('3');
  await page.getByLabel('Opening head height').fill('7');
  await page.getByLabel('Opening head height').blur();
  await h.clickWorld(page, 0, 0);
  await h.waitForSaved(page);

  const opening = (await h.savedDrawing(page)).fenestrations[0];
  expect(opening.width).toBeCloseTo(5, 5);
  expect(opening.sillHeight).toBeCloseTo(3, 5);
  expect(opening.headHeight).toBeCloseTo(7, 5);
});

test('an opening interrupts its wall without touching the wall geometry', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  expect(await wallStrokeCount(page, 2.7, 0)).toBeGreaterThan(0);

  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);
  await h.selectTool(page, 'Select');
  await page.waitForTimeout(300);

  // The wall edge strokes disappear inside the opening but survive outside it.
  expect(await wallStrokeCount(page, 2.7, 0)).toBe(0);
  expect(await wallStrokeCount(page, -6, 0)).toBeGreaterThan(0);

  // The wall itself keeps its full endpoints — rendering carves the gap.
  const walls = h.allWalls(await h.savedDrawing(page));
  expect(walls).toHaveLength(1);
  expect(h.touchesPoint(walls[0], -10, 0)).toBe(true);
  expect(h.touchesPoint(walls[0], 10, 0)).toBe(true);
});

test('openings survive a reload attached to their wall', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fenestrations).toHaveLength(1);
  expect(drawing.fenestrations[0].wallId).toBe(drawing.walls[0].id);
  expect(drawing.fenestrations[0].layer).toBe('A-DOOR');
});

test('the opening centre is a snap point for dimensions', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  await h.selectTool(page, 'Dimension');
  await h.clickWorld(page, 2.05, 0.1); // only the vertex magnet pulls the click

  await h.clickWorld(page, -10, 0);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.dimensions).toHaveLength(1);
  const dimension = drawing.dimensions[0];
  // The centre sits at the opening's midpoint: x ≈ 2, z inside the wall.
  const centreEnd = [dimension.start, dimension.end]
    .find(pt => Math.abs(pt.x - 2) < 0.05 && Math.abs(pt.z) < 0.5);
  expect(centreEnd).toBeTruthy();
  expect(dimension.view).toBe('plan'); // saves with the PLAN DIMENSION layer
});

test('deleting a selected opening or its host wall removes the opening', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
  await h.clickWorld(page, -5, 0);
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).fenestrations).toHaveLength(2);

  // Click-select the door and delete just that opening.
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 2, 0);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  let drawing = await h.savedDrawing(page);
  expect(drawing.fenestrations).toHaveLength(1);
  expect(drawing.walls).toHaveLength(1);

  // Deleting the host wall takes its remaining opening with it.
  await h.clickWorld(page, 8, 0);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  drawing = await h.savedDrawing(page);
  expect(drawing.walls).toHaveLength(0);
  expect(drawing.fenestrations).toHaveLength(0);
});

test('FENESTRATION works in PLAN, FOUNDATION, and FLOOR (floor / roof holes)', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  const tool = page.locator('[data-model-left]').getByRole('button', { name: /\bFenestration\b/i });
  await switchLayerView(page, 'FLOOR');
  await expect(tool).toBeEnabled();

  await switchLayerView(page, 'PLAN');
  await expect(tool).toBeEnabled();

  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await expect(tool).toBeEnabled();
});

test('a door opening hosts on an S-FDN foundation wall', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  const wall = h.allWalls(drawing)[0];
  expect(wall.view).toBe('foundation');
  expect(drawing.fenestrations).toHaveLength(1);
  const opening = drawing.fenestrations[0];
  expect(opening.wallId).toBe(wall.id);
  expect(opening.view).toBe('foundation');
  expect(opening.layer).toBe('A-DOOR');
});

test('interior 2x4 and 2x6 stud walls stay available on the foundation level PLAN', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'PLAN');
  await h.selectTool(page, 'Wall');
  await expect(page.getByRole('button', { name: /2×4 Stud/ })).toBeVisible();
  await page.getByRole('button', { name: /2×4 Stud/ }).click();
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const wall = h.allWalls(await h.savedDrawing(page))[0];
  expect(wall.view).toBe('plan');
  expect(wall.wallType).toBe('stud_2x4');
});

test('A-DOOR and A-GLAZ are Company Standard Layers', async ({ page }) => {
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-layer-name="A-DOOR"]')).toBeVisible();
  await expect(page.locator('[data-layer-name="A-GLAZ"]')).toBeVisible();
  await expect(page.locator('[data-layer-print="A-DOOR"]')).toBeChecked();
  await expect(page.locator('[data-layer-print="A-GLAZ"]')).toBeChecked();
});
