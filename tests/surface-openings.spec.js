// FENESTRATION's hole mode: select a floor or roof with Select, then E cuts a
// free-form opening into it — any closed shape, not just a rectangle. With
// nothing selected, E keeps its wall door / window behavior, so walls and
// roof / floor holes mix on the same layout. Holes save on A-FL-OPNG /
// A-ROOF-OPNG and never move their host's boundary.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const FLOOR_FILL = [89, 128, 166]; // rgba(89,128,166,…) floor fill

async function switchLevel(page, name) {
  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function switchLayerView(page, label) {
  await page.locator('.level-row.active').getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

// A 20×12 floor on the FLOOR layer set, centred on the origin.
async function drawFloor(page) {
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');
  await h.selectTool(page, 'Floor');
  await h.clickWorld(page, -10, -6);
  await h.clickWorld(page, 10, -6);
  await h.clickWorld(page, 10, 6);
  await h.clickWorld(page, -10, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawBasicRoof(page) {
  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await h.clickWorld(page, 0, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function selectAt(page, x, z) {
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, x, z);
  await page.waitForTimeout(200);
}

test('E cuts a free-form opening into a selected floor on A-FL-OPNG', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await selectAt(page, 0, 0); // click inside the floor selects it

  await h.selectTool(page, 'Fenestration');
  // A five-sided hole — anything closed works, not just rectangles.
  await h.clickWorld(page, -4, -2);
  await h.clickWorld(page, 2, -2);
  await h.clickWorld(page, 4, 0);
  await h.clickWorld(page, 2, 2);
  await h.clickWorld(page, -4, 2);
  await h.clickWorld(page, -4, -2); // first corner again closes it
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings).toHaveLength(1);
  const opening = saved.surfaceOpenings[0];
  expect(opening.hostType).toBe('floor');
  expect(opening.hostId).toBe(saved.floors[0].id);
  expect(opening.layer).toBe('A-FL-OPNG');
  expect(opening.points).toHaveLength(5);
  // The host floor's own boundary is untouched.
  expect(saved.floors[0].points).toHaveLength(4);
  expect(saved.floors[0].points.some(p => h.near(p.x, -10) && h.near(p.z, -6))).toBe(true);
});

test('E cuts an opening into a selected roof on A-ROOF-OPNG', async ({ page }) => {
  await h.openModel(page);
  await drawBasicRoof(page);
  await selectAt(page, 0, 6); // inside the roof body, away from edges

  await h.selectTool(page, 'Fenestration');
  // A triangular chimney hole, finished with Enter instead of closing.
  await h.clickWorld(page, -2, 4);
  await h.clickWorld(page, 2, 4);
  await h.clickWorld(page, 0, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings).toHaveLength(1);
  const opening = saved.surfaceOpenings[0];
  expect(opening.hostType).toBe('roof');
  expect(opening.hostId).toBe(saved.roofs[0].id);
  expect(opening.layer).toBe('A-ROOF-OPNG');
  expect(opening.points).toHaveLength(3);
  expect(saved.roofs[0].points).toHaveLength(4);
});

test('with nothing selected E still places a wall door', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.fenestrations).toHaveLength(1);
  expect(saved.fenestrations[0].layer).toBe('A-DOOR');
  expect(saved.surfaceOpenings || []).toHaveLength(0);
});

test('the first corner must land inside the selected host', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await selectAt(page, 0, 0);

  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 15, 10); // outside the floor
  await expect(page.getByText('Click inside the selected floor to start the opening.')).toBeVisible();

  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings || []).toHaveLength(0);
});

test('openings survive a reload attached to their host', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await selectAt(page, 0, 0);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -3, -2);
  await h.clickWorld(page, 3, -2);
  await h.clickWorld(page, 3, 2);
  await h.clickWorld(page, -3, 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings).toHaveLength(1);
  expect(saved.surfaceOpenings[0].hostId).toBe(saved.floors[0].id);
  expect(saved.surfaceOpenings[0].layer).toBe('A-FL-OPNG');
});

test('opening corners drag with Select without moving the host floor', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await selectAt(page, 0, 0);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -3, -2);
  await h.clickWorld(page, 3, -2);
  await h.clickWorld(page, 3, 2);
  await h.clickWorld(page, -3, 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, 3, 2);
  const to = await h.worldToClient(page, 5, 4);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const opening = saved.surfaceOpenings[0];
  expect(opening.points.some(p => h.near(p.x, 5) && h.near(p.z, 4))).toBe(true);
  // Host boundary corners stay put.
  expect(saved.floors[0].points.every(p => Math.abs(p.x) > 9.5 && Math.abs(p.z) > 5.5)).toBe(true);
});

test('a click inside an opening selects it; Delete removes just the hole', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await selectAt(page, 0, 0);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -3, -2);
  await h.clickWorld(page, 3, -2);
  await h.clickWorld(page, 3, 2);
  await h.clickWorld(page, -3, 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await selectAt(page, 0, 0); // inside the hole beats the floor around it
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings || []).toHaveLength(0);
  expect(saved.floors).toHaveLength(1);
});

test('deleting the host floor takes its openings with it', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await selectAt(page, 0, 0);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -3, -2);
  await h.clickWorld(page, 3, -2);
  await h.clickWorld(page, 3, 2);
  await h.clickWorld(page, -3, 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await selectAt(page, 8, 5); // inside the floor but outside the hole
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.floors).toHaveLength(0);
  expect(saved.surfaceOpenings || []).toHaveLength(0);
});

test('the hole renders as a gap in the floor fill', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await selectAt(page, 0, 0);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -3, -2);
  await h.clickWorld(page, 3, -2);
  await h.clickWorld(page, 3, 2);
  await h.clickWorld(page, -3, 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 14, 10); // clear the selection so no highlight fill
  await page.waitForTimeout(300);

  // Sample deep inside the hole vs. floor area well away from it.
  const inHole = await h.worldToClient(page, 0, 0);
  const inFloor = await h.worldToClient(page, -7, 4.5);
  const holePixels = await h.overlayPixels(page, inHole.x, inHole.y, 5);
  const floorPixels = await h.overlayPixels(page, inFloor.x, inFloor.y, 5);
  expect(h.countColor(floorPixels, FLOOR_FILL)).toBeGreaterThan(0);
  expect(h.countColor(holePixels, FLOOR_FILL)).toBe(0);
});

test('A-FL-OPNG and A-ROOF-OPNG are Company Standard Layers', async ({ page }) => {
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-layer-name="A-FL-OPNG"]')).toBeVisible();
  await expect(page.locator('[data-layer-name="A-ROOF-OPNG"]')).toBeVisible();
  await expect(page.locator('[data-layer-print="A-FL-OPNG"]')).toBeChecked();
  await expect(page.locator('[data-layer-print="A-ROOF-OPNG"]')).toBeChecked();
});
