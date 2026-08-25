// Every drawing tool works on the BONEYARD: geometry stores to the active
// shelf under its negative pseudo level id (-shelfId), so shelves stay
// isolated from each other and from the architectural levels, and identical
// coordinates on different shelves never overlap.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function selectBoneyard(page) {
  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
}

async function switchLevel(page, name) {
  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('a wall and a line drawn on the BONEYARD store to the shelf, not a level', async ({ page }) => {
  await h.openModel(page);
  await selectBoneyard(page);

  await drawWall(page, -8, -5, 8, -5);
  await drawLine(page, -8, 5, 8, 5);

  const saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(1);
  expect(saved.walls[0].levelId).toBe(-1); // SHELF 1's pseudo level id
  expect(saved.lines).toHaveLength(1);
  expect(saved.lines[0].levelId).toBe(-1);
  // No level owns the shelf geometry.
  const levelIds = saved.levels.map(level => level.id);
  expect(levelIds).not.toContain(-1);
});

test('shelves are isolated: the same spot on two shelves holds two separate items', async ({ page }) => {
  await h.openModel(page);
  await selectBoneyard(page);
  await drawLine(page, -6, 0, 6, 0);

  await page.getByRole('button', { name: '+ SHELF' }).click();
  await page.waitForTimeout(300);
  await drawLine(page, -6, 0, 6, 0); // identical coordinates, different shelf

  const saved = await h.savedDrawing(page);
  expect(saved.lines).toHaveLength(2);
  expect(saved.lines.map(line => line.levelId).sort((a, b) => a - b)).toEqual([-2, -1]);
});

test('shelf geometry survives a reload', async ({ page }) => {
  await h.openModel(page);
  await selectBoneyard(page);
  await drawWall(page, -8, -5, 8, -5);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(1);
  expect(saved.walls[0].levelId).toBe(-1);
});

test('deleting on a shelf removes only that shelf\'s geometry', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'MAIN FL');
  await drawLine(page, -6, 2, 6, 2); // level line at its own spot
  await selectBoneyard(page);
  await drawLine(page, -6, 2, 6, 2); // shelf line at the same spot

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, 2);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.lines).toHaveLength(1);
  expect(saved.lines[0].levelId).toBe(3); // MAIN FL's line survives
});

test('ordinary levels are unaffected: a MAIN FL wall still stores to the level', async ({ page }) => {
  await h.openModel(page);
  await selectBoneyard(page);
  await drawWall(page, -8, -5, 8, -5);
  await switchLevel(page, 'MAIN FL');
  await drawWall(page, -4, 0, 4, 0);

  const saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(2);
  expect(saved.walls.map(wall => wall.levelId).sort((a, b) => a - b)).toEqual([-1, 3]);
});
