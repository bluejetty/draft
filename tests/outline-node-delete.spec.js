// Delete over a hovered outline node plucks just that point: the edit routes
// through the BONEYARD master, so the point leaves every level copy and the
// master together and the srcId links stay clean. Outlines keep their
// minimum (3 points closed, 2 open); whole-outline deletion stays with
// Select as before.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOutline(page, points) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function deleteNodeAt(page, x, z) {
  await h.moveTo(page, x, z);
  await page.waitForTimeout(150);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
}

test('Delete over a level-copy corner removes the point from the master and every copy', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 0], [8, 6], [-8, 6]]);

  await deleteNodeAt(page, 8, 0); // the stray mid-edge point
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  expect(master.points).toHaveLength(4);
  expect(master.points.some(point => h.near(point.x, 8) && h.near(point.z, 0))).toBe(false);
  saved.outlines.forEach(copy => {
    expect(copy.points).toHaveLength(4);
    expect(copy.points.some(point => h.near(point.x, 8) && h.near(point.z, 0))).toBe(false);
    // Every surviving point still rides a master point.
    copy.points.forEach(point =>
      expect(master.points.some(mp => mp.id === point.srcId)).toBe(true));
  });
});

test('Delete works on the BONEYARD master directly', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 0], [8, 6], [-8, 6]]);

  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await deleteNodeAt(page, 8, 0);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines[0].points).toHaveLength(4);
  saved.outlines.forEach(copy => expect(copy.points).toHaveLength(4));
});

test('a closed outline keeps its minimum three points', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [0, 6]]);

  await deleteNodeAt(page, 0, 6);

  await expect(page.locator('[data-model-drawing-message]')).toContainText('at least 3 points');
  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines[0].points).toHaveLength(3);
});

test('Delete over a built corner explains itself instead of silently doing nothing', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 6], [-8, 6]]);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);

  await deleteNodeAt(page, 8, 6);

  await expect(page.locator('[data-model-drawing-message]')).toContainText('built geometry');
  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines[0].points).toHaveLength(4);
});

test('Delete with a selection still removes the selected objects, not the hovered node', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 0], [8, 6], [-8, 6]]);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -4, 10);
  await h.clickWorld(page, 4, 10);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Select the line by clicking it, then hover the outline corner and Delete:
  // the selection wins.
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, 10);
  await deleteNodeAt(page, 8, 0);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(h.allLines(saved)).toHaveLength(0);
  expect(saved.boneyardOutlines[0].points).toHaveLength(5);
});
