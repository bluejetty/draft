// ROOF works on any level — dormers and overhangs mix with wall plans — and
// the Floor tool on a FOUNDATION context makes a concrete slab (S-SLAB) that
// lives in the FOUNDATION layer set instead of a framed FLOOR assembly.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

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

async function drawRoofEdge(page) {
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await h.clickWorld(page, 0, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawFloorOutline(page) {
  await h.selectTool(page, 'Floor');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('a roof can be drawn on MAIN FL and stays on that level', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'MAIN FL');
  await drawRoofEdge(page);

  const saved = await h.savedDrawing(page);
  expect(saved.roofs).toHaveLength(1);
  expect(saved.roofs[0].levelId).toBe(3);
  expect(saved.roofs[0].layer).toBe('A-ROOF');
});

test('a roof can be drawn on 2ND FL and on FOUNDATION', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, '2ND FL');
  await drawRoofEdge(page);
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await drawRoofEdge(page);

  const saved = await h.savedDrawing(page);
  const levels = saved.roofs.map(roof => roof.levelId).sort();
  expect(levels).toEqual([1, 5]);
});

test('the Floor tool on FOUNDATION makes a concrete slab in that layer set', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await drawFloorOutline(page);

  const saved = await h.savedDrawing(page);
  expect(saved.floors).toHaveLength(1);
  const slab = saved.floors[0];
  expect(slab.levelId).toBe(1);
  expect(slab.view).toBe('foundation');
  expect(slab.structure).toBe('slab');
  // Slabs default to the level's 3" concrete, not the framed assembly depth.
  expect(slab.thickness).toBeCloseTo(3 / 12, 5);
});

test('a foundation slab survives a reload in the FOUNDATION layer set', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await drawFloorOutline(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const slab = (await h.savedDrawing(page)).floors[0];
  expect(slab.view).toBe('foundation');
  expect(slab.structure).toBe('slab');
});

test('FLOOR FROM SHAPE on FOUNDATION builds a slab from the shape', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');

  await h.selectTool(page, 'Shape');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Floor');
  await page.getByRole('button', { name: 'FLOOR FROM SHAPE' }).click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.floors).toHaveLength(1);
  expect(saved.floors[0].view).toBe('foundation');
  expect(saved.floors[0].structure).toBe('slab');
});

test('framed floors elsewhere are untouched by the foundation slab path', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'MAIN FL');
  await switchLayerView(page, 'FLOOR PLAN');
  await drawFloorOutline(page);

  const saved = await h.savedDrawing(page);
  expect(saved.floors).toHaveLength(1);
  expect(saved.floors[0].view).toBe('floor');
  expect(saved.floors[0].structure).toBe('floor');
});
