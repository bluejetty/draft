// The corner-L kitchen preset (KITCHEN library slice 1): one click near an
// inside corner drops the whole kitchen — base cabinet runs along both legs,
// sink + DW on the long leg, fridge in its 36" bay at the open end, range
// centered on the short leg — with independent + PANTRY and + ISLAND toggles.
// Every piece lands as an ordinary wall-hosted fixture, so the drafter can
// select and slide anything afterward.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// Two walls meeting at (-10, 0): a 20' leg east and a 10' leg south (world
// +z). The kitchen's inside corner is at the west end, room to the southeast.
async function drawCornerWalls(page) {
  await drawWall(page, -10, 0, 10, 0);
  await drawWall(page, -10, 0, -10, 10);
}

async function pickKind(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
}

const byKind = (drawing, kind) => drawing.fixtures.filter(f => f.kind === kind);

test('the KITCHEN group carries DW, ISLAND, PANTRY, and the L PRESET', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Fixture');
  for (const label of ['DW', 'ISLAND', 'PANTRY', 'L PRESET']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('the pantry and island toggles appear only while the preset is active', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Fixture');
  await expect(page.getByRole('button', { name: '+ PANTRY', exact: true })).toHaveCount(0);
  await pickKind(page, 'L PRESET');
  await expect(page.getByRole('button', { name: '+ PANTRY', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ ISLAND', exact: true })).toBeVisible();
});

test('one corner click places the plain corner-L kitchen at the proven spots', async ({ page }) => {
  await h.openModel(page);
  await drawCornerWalls(page);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'L PRESET');
  await h.clickWorld(page, -9.5, 0.5);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  const longWall = drawing.walls.find(w => h.near(w.start.z, 0) && h.near(w.end.z, 0));
  const shortWall = drawing.walls.find(w => w !== longWall);
  expect(drawing.fixtures).toHaveLength(6);

  // Two straight cabinet runs on A-CASE, one per leg.
  const cabinets = byKind(drawing, 'cabinet');
  expect(cabinets).toHaveLength(2);
  cabinets.forEach(run => expect(run.layer).toBe('A-CASE'));
  const longRun = cabinets.find(run => run.wallId === longWall.id);
  const shortRun = cabinets.find(run => run.wallId === shortWall.id);
  expect(longRun.width).toBeGreaterThan(15);  // 20' leg minus corner and fridge bay
  expect(shortRun.width).toBeGreaterThan(8);  // 10' leg minus the corner

  // Sink on the long run with the 24" DW tucked beside it toward the corner.
  const [sink] = byKind(drawing, 'sink');
  const [dish] = byKind(drawing, 'dish');
  expect(sink.wallId).toBe(longWall.id);
  expect(dish.wallId).toBe(longWall.id);
  expect(dish.width).toBeCloseTo(2, 5);
  expect(sink.offset - dish.offset).toBeCloseTo(sink.width / 2 + dish.width / 2, 5);
  expect(dish.offset).toBeLessThan(sink.offset); // DW sits on the corner side

  // Fridge in its 36" bay at the open end of the long leg.
  const [fridge] = byKind(drawing, 'fridge');
  expect(fridge.wallId).toBe(longWall.id);
  expect(fridge.width).toBeCloseTo(3, 5);
  expect(fridge.offset).toBeGreaterThan(17); // near the 20' end

  // Range centered on the short leg.
  const [stove] = byKind(drawing, 'stove');
  expect(stove.wallId).toBe(shortWall.id);
  expect(stove.offset).toBeGreaterThan(3);
  expect(stove.offset).toBeLessThan(7);

  // Everything projects into the room.
  drawing.fixtures.forEach(fixture => {
    expect(fixture.side).toBe(fixture.wallId === longWall.id ? 1 : -1);
  });
});

test('+ PANTRY and + ISLAND add the corner pantry and the 42"-aisle island', async ({ page }) => {
  await h.openModel(page);
  await drawCornerWalls(page);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'L PRESET');
  await pickKind(page, '+ PANTRY');
  await pickKind(page, '+ ISLAND');
  await h.clickWorld(page, -9.5, 0.5);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  const longWall = drawing.walls.find(w => h.near(w.start.z, 0) && h.near(w.end.z, 0));
  expect(drawing.fixtures).toHaveLength(8);

  // The 48" x 48" walk-in pantry snugs into the dead corner of the long leg.
  const [pantry] = byKind(drawing, 'pantry');
  expect(pantry.wallId).toBe(longWall.id);
  expect(pantry.width).toBeCloseTo(4, 5);
  expect(pantry.depth).toBeCloseTo(4, 5);
  expect(pantry.offset).toBeLessThan(3); // its centre sits ~2' off the corner

  // Cabinets start past the pantry so every run stays straight.
  const longRun = byKind(drawing, 'cabinet').find(run => run.wallId === longWall.id);
  expect(longRun.offset - longRun.width / 2).toBeGreaterThan(3.9);

  // The island floats 42" + countertop overhang off the wall face.
  const [island] = byKind(drawing, 'island');
  expect(island.wallId).toBe(longWall.id);
  expect(island.depth).toBeCloseTo(3, 5);
  expect(island.standoff).toBeCloseTo(2 + 1 / 12 + 3.5, 5);
});

test('the preset refuses a corner without enough clear wall', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await drawWall(page, -10, 0, -10, 4); // short leg only 4' — under the 5' minimum
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'L PRESET');
  await h.clickWorld(page, -9.5, 0.5);
  await h.waitForSaved(page);

  expect((await h.savedDrawing(page)).fixtures ?? []).toHaveLength(0);
});

test('preset pieces stay movable: the sink slides along its wall like any fixture', async ({ page }) => {
  await h.openModel(page);
  await drawCornerWalls(page);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'L PRESET');
  await h.clickWorld(page, -9.5, 0.5);
  await h.waitForSaved(page);

  const before = await h.savedDrawing(page);
  const [sink] = byKind(before, 'sink');
  const grabX = sink.offset - 10; // wall runs from x -10; grab the body
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, grabX, 1.2);
  const to = await h.worldToClient(page, grabX + 3, 1.2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);

  const after = byKind(await h.savedDrawing(page), 'sink')[0];
  expect(after.offset).toBeGreaterThan(sink.offset + 2);
  expect(after.wallId).toBe(sink.wallId);
});

test('kitchen preset fixtures survive a reload, island standoff included', async ({ page }) => {
  await h.openModel(page);
  await drawCornerWalls(page);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'L PRESET');
  await pickKind(page, '+ PANTRY');
  await pickKind(page, '+ ISLAND');
  await h.clickWorld(page, -9.5, 0.5);
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(8);
  const [island] = byKind(drawing, 'island');
  expect(island.standoff).toBeCloseTo(2 + 1 / 12 + 3.5, 5);
  expect(byKind(drawing, 'pantry')).toHaveLength(1);
  expect(byKind(drawing, 'dish')).toHaveLength(1);
});
