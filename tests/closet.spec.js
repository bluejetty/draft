// The CLOSET fixture is a small room hosted on a wall: two clicks set the
// width, the body projects 2'-1" inside behind 2x4 closet walls, side walls
// skip where the run end snugs into an existing crossing wall, and the door
// comes off the DD/D ladder by the width that fits between the side walls.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function pickKind(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
}

test('CLOSET appears in a BEDROOM catalog group', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Fixture');
  await expect(page.getByRole('button', { name: 'CLOSET', exact: true })).toBeVisible();
});

test('two clicks along a wall place a closet on A-FIXT with the clicked width', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'CLOSET');
  await h.clickWorld(page, -3, 0.4);
  await h.clickWorld(page, 3, 0.4);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  const closet = drawing.fixtures[0];
  expect(closet.kind).toBe('closet');
  expect(closet.layer).toBe('A-FIXT');
  expect(closet.wallId).toBe(drawing.walls[0].id);
  expect(closet.width).toBeCloseTo(6, 0);          // the two clicks are 6ft apart
  expect(closet.offset).toBeCloseTo(10, 0);        // centred on the wall
  expect(closet.depth).toBeCloseTo(2 + 1 / 12 + 3.5 / 12, 5); // 2'-1" inside + 2x4 front wall
  expect(closet.side).toBe(1);
});

test('a run too narrow for a D18 refuses the closet', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'CLOSET');
  await h.clickWorld(page, 0, 0.4);
  await h.clickWorld(page, 1.5, 0.4); // 1'-6" — under D18 + framing clearance
  await h.waitForSaved(page);

  expect((await h.savedDrawing(page)).fixtures ?? []).toHaveLength(0);
});

test('closets survive a reload attached to their walls', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'CLOSET');
  await h.clickWorld(page, -2, 0.4);
  await h.clickWorld(page, 4, 0.4);
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  expect(drawing.fixtures[0].kind).toBe('closet');
  expect(drawing.fixtures[0].wallId).toBe(drawing.walls[0].id);
});

test('a run click near a wall corner node still starts the closet', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await drawWall(page, -10, -8, -10, 2); // crossing wall sharing the corner node
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'CLOSET');
  await h.clickWorld(page, -9.6, 0.3); // within node-grab range of the corner
  await h.clickWorld(page, -5, 0.3);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  expect(drawing.fixtures[0].kind).toBe('closet');
});

test('a click on the opposite wall face restarts the run instead of spanning faces', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'CLOSET');
  await h.clickWorld(page, -6, 0.4);  // start on the south face
  await h.clickWorld(page, -1, -0.4); // north face — restarts, no closet yet
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).fixtures ?? []).toHaveLength(0);

  await h.clickWorld(page, 4, -0.4);  // completes the north-face run
  await h.waitForSaved(page);
  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  expect(drawing.fixtures[0].side).toBe(-1);
  expect(drawing.fixtures[0].width).toBeCloseTo(5, 0);
});

test('a click inside the closet body selects it and Delete removes it', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'CLOSET');
  await h.clickWorld(page, -3, 0.4);
  await h.clickWorld(page, 3, 0.4);
  await h.waitForSaved(page);

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, 1.2); // inside the projected body
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(0);
  expect(drawing.walls).toHaveLength(1);
});
