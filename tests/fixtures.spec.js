// The FIXTURE command hosts kitchen / bath / laundry plan symbols on walls.
// A fixture stores its host wall, its centre offset along the wall, and which
// face the body projects from — geometry redraws from the current wall, so
// fixtures ride wall edits. Cabinets and vanities are two-click runs on
// A-CASE; the tub is a two-wall alcove fixture that stretches up to 6" past
// standard and slides along its back wall.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

async function pickKind(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
}

test('FIXTURE is a rail command with KITCHEN / BATH / LAUNDRY catalog options', async ({ page }) => {
  await h.openModel(page);
  const rail = page.locator('[data-model-left]').getByRole('button', { name: /\bFixture\b/i });
  await expect(rail).toBeVisible();

  await h.selectTool(page, 'Fixture');
  for (const label of ['CABINET', 'SINK', 'FRIDGE', 'STOVE', 'TUB', 'TOILET', 'SHOWER', 'STALL', 'VANITY', 'WASHER', 'DRYER']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('a fridge saves on A-FIXT hosted on its wall with offset and side', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'FRIDGE');
  await h.clickWorld(page, 2, 0.4);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  const fixture = drawing.fixtures[0];
  expect(fixture.kind).toBe('fridge');
  expect(fixture.layer).toBe('A-FIXT');
  expect(fixture.wallId).toBe(drawing.walls[0].id);
  expect(fixture.offset).toBeCloseTo(12, 0); // centre 12ft from the wall start
  expect(fixture.width).toBeCloseTo(3, 5);
  expect(fixture.side).toBe(1); // clicked below the wall → body projects that way
});

test('a washer places from the LAUNDRY group on A-FIXT', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'WASHER');
  await h.clickWorld(page, -4, -0.4);
  await h.waitForSaved(page);

  const fixture = (await h.savedDrawing(page)).fixtures[0];
  expect(fixture.kind).toBe('washer');
  expect(fixture.layer).toBe('A-FIXT');
  expect(fixture.side).toBe(-1);
});

test('a cabinet run takes two clicks along the wall and saves on A-CASE', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture'); // CABINET is the default catalog entry
  await h.clickWorld(page, -6, -0.4);
  await h.clickWorld(page, 0, -0.4);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  const run = drawing.fixtures[0];
  expect(run.kind).toBe('cabinet');
  expect(run.layer).toBe('A-CASE');
  expect(run.wallId).toBe(drawing.walls[0].id);
  expect(run.width).toBeCloseTo(6, 0);  // the two clicks are 6ft apart
  expect(run.offset).toBeCloseTo(7, 0); // centred between along 4 and along 10
  expect(run.depth).toBeCloseTo(2, 5);  // 24" base cabinet
});

test('a vanity run is 21" deep casework', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'VANITY');
  await h.clickWorld(page, 2, 0.4);
  await h.clickWorld(page, 6, 0.4);
  await h.waitForSaved(page);

  const run = (await h.savedDrawing(page)).fixtures[0];
  expect(run.kind).toBe('vanity');
  expect(run.layer).toBe('A-CASE');
  expect(run.depth).toBeCloseTo(1.75, 5);
});

test('fixtures ride their host wall when it moves', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'FRIDGE');
  await h.clickWorld(page, 2, 0.4);
  await h.waitForSaved(page);

  // Drag both wall endpoints 5ft south; the fixture stores no geometry, so
  // its footprint must recompute onto the moved wall.
  await h.selectTool(page, 'Select');
  await dragWorld(page, -10, 0, -10, 5);
  await dragWorld(page, 10, 0, 10, 5);

  const drawing = await h.savedDrawing(page);
  const fixture = drawing.fixtures[0];
  expect(fixture.wallId).toBe(drawing.walls[0].id);
  expect(fixture.offset).toBeCloseTo(12, 0); // the along-wall centre is unchanged
  expect(h.near(drawing.walls[0].start.z, 5)).toBe(true);

  // A click inside the recomputed footprint (x≈2, just south of the wall face)
  // picks the fixture, and Delete removes it without touching the wall.
  await h.clickWorld(page, 2, 6);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  expect(after.fixtures).toHaveLength(0);
  expect(after.walls).toHaveLength(1);
});

test('dragging a fixture slides it along its host wall', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'FRIDGE');
  await h.clickWorld(page, 2, 0.4);
  await h.waitForSaved(page);

  await h.selectTool(page, 'Select');
  await dragWorld(page, 2, 1.2, -5, 1.2); // grab the body, pull it west

  const fixture = (await h.savedDrawing(page)).fixtures[0];
  expect(fixture.offset).toBeCloseTo(5, 0); // centre now 5ft from the wall start
  expect(fixture.wallId).toBeTruthy();      // still hosted, never detached
});

test('a 36" square shower places from the BATH group on A-FIXT', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'SHOWER');
  await h.clickWorld(page, -2, 0.4);
  await h.waitForSaved(page);

  const fixture = (await h.savedDrawing(page)).fixtures[0];
  expect(fixture.kind).toBe('shower');
  expect(fixture.layer).toBe('A-FIXT');
  expect(fixture.width).toBeCloseTo(3, 5);
  expect(fixture.depth).toBeCloseTo(3, 5);
});

test('a 48x32 shower stall places from the BATH group', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'STALL');
  await h.clickWorld(page, 4, -0.4);
  await h.waitForSaved(page);

  const fixture = (await h.savedDrawing(page)).fixtures[0];
  expect(fixture.kind).toBe('stall');
  expect(fixture.layer).toBe('A-FIXT');
  expect(fixture.width).toBeCloseTo(4, 5);
  expect(fixture.depth).toBeCloseTo(8 / 3, 5);
  expect(fixture.side).toBe(-1);
});

test('the tub spans its alcove and stores back and faucet-end walls', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -8, 0, 8, 0);   // back wall
  await drawWall(page, -8, -6, -8, 2); // faucet-end wall crossing at the west end
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'TUB');
  await h.clickWorld(page, 0, -0.4);   // back wall, body south into the room
  await h.clickWorld(page, -8, -3);    // faucet-end wall
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  const tub = drawing.fixtures[0];
  const backWall = drawing.walls.find(w => h.near(w.start.z, 0) && h.near(w.end.z, 0));
  const endWall = drawing.walls.find(w => w !== backWall);
  expect(tub.kind).toBe('tub');
  expect(tub.layer).toBe('A-FIXT');
  expect(tub.wallId).toBe(backWall.id);
  expect(tub.endWallId).toBe(endWall.id);
  expect(tub.dir).toBe(1);              // the alcove runs east from the faucet wall
  expect(tub.width).toBeCloseTo(5, 5);  // standard 60" tub, stretch derives on draw
  expect(tub.offset).toBe(0);           // starts tight against the faucet wall
  expect(tub.side).toBe(-1);
});

test('the tub slides along its back wall, the slide gap persisting as offset', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -8, 0, 8, 0);
  await drawWall(page, -8, -6, -8, 2);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'TUB');
  await h.clickWorld(page, 0, -0.4);
  await h.clickWorld(page, -8, -3);
  await h.waitForSaved(page);

  // The tub sits from the faucet wall face; grab its body and slide it east.
  await h.selectTool(page, 'Select');
  await dragWorld(page, -5, -1.5, 2, -1.5);

  const tub = (await h.savedDrawing(page)).fixtures[0];
  expect(tub.offset).toBeGreaterThan(5); // slid well away from the faucet wall
  expect(tub.offset).toBeLessThan(11);   // clamped inside the alcove's leftover
});

test('an alcove shorter than the minimum tub refuses the tub', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -8, 0, 8, 0);
  await drawWall(page, -8, -6, -8, 2);   // faucet-end wall
  await drawWall(page, -4.5, -6, -4.5, 2); // a crossing wall only ~3'-6" away
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'TUB');
  await h.clickWorld(page, -6, -0.4);
  await h.clickWorld(page, -8, -3);
  await h.waitForSaved(page);

  expect((await h.savedDrawing(page)).fixtures ?? []).toHaveLength(0);
});

test('fixtures survive a reload attached to their walls', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'STOVE');
  await h.clickWorld(page, 2, 0.4);
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fixtures).toHaveLength(1);
  expect(drawing.fixtures[0].kind).toBe('stove');
  expect(drawing.fixtures[0].wallId).toBe(drawing.walls[0].id);
});

test('deleting the host wall removes the fixtures riding it', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page, -10, 0, 10, 0);
  await h.selectTool(page, 'Fixture');
  await pickKind(page, 'TOILET');
  await h.clickWorld(page, -4, -0.4);
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).fixtures).toHaveLength(1);

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 8, 0); // the wall itself, clear of the fixture
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.walls).toHaveLength(0);
  expect(drawing.fixtures).toHaveLength(0);
});

test('A-FIXT and A-CASE are Company Standard Layers', async ({ page }) => {
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-layer-name="A-FIXT"]')).toBeVisible();
  await expect(page.locator('[data-layer-name="A-CASE"]')).toBeVisible();
  await expect(page.locator('[data-layer-print="A-FIXT"]')).toBeChecked();
  await expect(page.locator('[data-layer-print="A-CASE"]')).toBeChecked();
});
