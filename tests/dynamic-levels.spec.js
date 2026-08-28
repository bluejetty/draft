// Levels are dynamic: delete the 2ND FL card for a bungalow, add a 3RD FL
// (and beyond) for taller buildings. Added floors get the standard ELECTRIC /
// PLAN / FLOOR layer sets, join BUILD HOUSE, and persist in the drawing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

test('deleting 2ND FL makes a bungalow: BUILD HOUSE skips it', async ({ page }) => {
  await h.openModel(page);
  const answers = [];
  page.on('dialog', dialog => dialog.accept(answers.shift() ?? ''));

  await drawOutlineRect(page);

  await levelRow(page, '2ND FL').locator('.level-del').click();
  await h.waitForSaved(page);
  await expect(levelRow(page, '2ND FL')).toHaveCount(0);

  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.levels.map(level => level.name)).toEqual(['SITE', 'ROOF', 'MAIN FL', 'FOUNDATION']);
  // MAIN FL + FOUNDATION shells only — nothing on the deleted level.
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(4);
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(4);
  expect(saved.walls.filter(wall => wall.levelId === 5)).toHaveLength(0);
  expect(saved.floors).toHaveLength(2);
  expect(saved.roofs).toHaveLength(1);

  // The bungalow survives a reload.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await expect(levelRow(page, '2ND FL')).toHaveCount(0);
  await expect(levelRow(page, 'MAIN FL')).toHaveCount(1);
});

test('an added 3RD FL gets the floor layer sets and joins BUILD HOUSE', async ({ page }) => {
  await h.openModel(page);
  const answers = [];
  page.on('dialog', dialog => dialog.accept(answers.shift() ?? ''));

  await drawOutlineRect(page);

  answers.push('3RD FL', '18');
  await page.getByRole('button', { name: '+ ADD' }).click();
  await page.waitForTimeout(400);

  // The new card slots in above the 2ND FL (below ROOF) with the standard sets.
  const names = await page.locator('.level-name').allTextContents();
  expect(names).toEqual(['SITE', 'ROOF', '3RD FL', '2ND FL', 'MAIN FL', 'FOUNDATION', 'BONEYARD']);
  const third = levelRow(page, '3RD FL');
  await expect(third.locator('.level-layer')).toHaveText(['ELECTRIC', 'WALL PLAN', 'FLOOR PLAN', 'STAIR']);

  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const thirdLevel = saved.levels.find(level => level.name === '3RD FL');
  expect(thirdLevel).toBeTruthy();
  expect(thirdLevel.elev).toBe(18);
  // The new floor built its shell like any other floor level.
  const thirdWalls = saved.walls.filter(wall => wall.levelId === thirdLevel.id);
  expect(thirdWalls).toHaveLength(4);
  thirdWalls.forEach(wall => {
    expect(wall.wallType).toBe('stud_2x6');
    expect(wall.view).toBe('plan');
  });
  expect(saved.floors.filter(floor => floor.levelId === thirdLevel.id)).toHaveLength(1);
  // It received its own copy of the master outline.
  expect(saved.outlines.filter(outline => outline.levelId === thirdLevel.id)).toHaveLength(1);

  // And it persists.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await expect(levelRow(page, '3RD FL')).toHaveCount(1);
  await expect(levelRow(page, '3RD FL').locator('.level-layer')).toHaveText(['ELECTRIC', 'WALL PLAN', 'FLOOR PLAN', 'STAIR']);
});

test('the insulation wall type is drawable on the foundation PLAN', async ({ page }) => {
  await h.openModel(page);

  // Work on FOUNDATION's PLAN layer set.
  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'PLAN' }).click();
  await page.waitForTimeout(300);

  await h.selectTool(page, 'Wall');
  await page.getByRole('button', { name: 'Insul Wall  (6½")' }).click();
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(1);
  expect(saved.walls[0].wallType).toBe('insulation_6');
  expect(saved.walls[0].levelId).toBe(1);
  expect(saved.walls[0].view).toBe('plan');
});

test('wall types follow the context: structural on FOUNDATION, stud walls on PLAN', async ({ page }) => {
  await h.openModel(page);

  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'FOUNDATION' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Wall');

  // The FOUNDATION layer set offers only the structural assemblies.
  await expect(page.getByRole('button', { name: '8" Concrete' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Insul Wall  (6½")' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '2×4 Stud  (3½")' })).toHaveCount(0);

  // The PLAN layer set on the FOUNDATION card offers the stud / insul walls.
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'PLAN' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'Insul Wall  (6½")' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2×4 Stud  (3½")' })).toBeVisible();
  await expect(page.getByRole('button', { name: '8" Concrete' })).toHaveCount(0);

  // A wall drawn here is a plan wall even if a structural type was active.
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(1);
  expect(saved.walls[0].view).toBe('plan');
  expect(saved.walls[0].wallType).toBe('stud_2x6');
});

test('the foundation PLAN shows the concrete walls as a locked reference', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'PLAN' }).click();
  await page.waitForTimeout(400);

  // The concrete wall drawn on the FOUNDATION set renders on PLAN too.
  const onWall = await h.worldToClient(page, 0, -6);
  const pixels = await h.overlayPixels(page, onWall.x, onWall.y);
  expect(h.countColor(pixels, [29, 31, 32])).toBeGreaterThan(0);

  // But it stays locked: dragging its edge with Select moves nothing.
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, 0, -6);
  const to = await h.worldToClient(page, 0, -12);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const saved = await h.savedDrawing(page);
  const foundationWalls = saved.walls.filter(wall => wall.levelId === 1 && wall.view === 'foundation');
  expect(foundationWalls).toHaveLength(4);
  foundationWalls.forEach(wall => {
    expect(Math.abs(wall.start.z) <= 6.5 && Math.abs(wall.end.z) <= 6.5).toBe(true);
  });
});
