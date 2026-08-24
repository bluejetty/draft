// BONEYARD fenestration MARKS: on the BONEYARD the FENESTRATION tool marks
// door / window openings on the master outline edges instead of cutting a
// wall. BUILD HOUSE resolves every mark into an ordinary wall-hosted opening
// — door marks cut the lowest floor's generated wall, window marks cut every
// floor level's, so stacked storeys share aligned glazing. An attached
// garage also gets its doors automatically (overhead centred on the longest
// open leg, man door on another leg, in both the stud wall and the grade
// beam), and the build finishes by laying the auto-dimension stack on every level it
// touched. Clicking a mark removes it; everything replays through save/load.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function switchLevel(page, name) {
  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawGarageOutline(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  for (const [x, z] of [[8, -4], [20, -4], [20, 4], [8, 4]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// Place a door mark at (0,-6) and a window mark at (8,0) on the BONEYARD
// master, then return to MAIN FL.
async function markDoorAndWindow(page) {
  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, -6);
  await h.waitForSaved(page);
  await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
  await h.clickWorld(page, 8, 0);
  await h.waitForSaved(page);
  await switchLevel(page, 'MAIN FL');
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

test('the FENESTRATION tool on the BONEYARD marks the master outline', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await markDoorAndWindow(page);

  const saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  expect(master.marks).toHaveLength(2);

  const door = master.marks.find(mark => mark.type === 'door');
  expect(door).toBeTruthy();
  // Keyed to the edge starting at (-8,-6): centre 8' along, default 3' door.
  const doorEdge = master.points.find(p => p.id === door.edgeId);
  expect(h.near(doorEdge.x, -8) && h.near(doorEdge.z, -6)).toBe(true);
  expect(door.offsetFt).toBeCloseTo(8, 0);
  expect(door.widthFt).toBeCloseTo(3, 5);
  expect(door.sillFt).toBe(0);
  expect(door.headFt).toBeCloseTo((6 * 12 + 8) / 12, 3);

  const window = master.marks.find(mark => mark.type === 'window');
  expect(window).toBeTruthy();
  const windowEdge = master.points.find(p => p.id === window.edgeId);
  expect(h.near(windowEdge.x, 8) && h.near(windowEdge.z, -6)).toBe(true);
  expect(window.offsetFt).toBeCloseTo(6, 0);
  expect(window.widthFt).toBeCloseTo(4, 5);
  expect(window.sillFt).toBeCloseTo(2.5, 5);

  // No wall openings yet — marks live on the master until BUILD HOUSE.
  expect(saved.fenestrations).toHaveLength(0);
});

test('clicking an existing mark removes it', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await markDoorAndWindow(page);

  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, -6);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  expect(master.marks).toHaveLength(1);
  expect(master.marks[0].type).toBe('window');
});

test('marks survive a reload', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await markDoorAndWindow(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines[0].marks).toHaveLength(2);
});

test('BUILD HOUSE cuts marks into the generated walls: door low, windows on every floor', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await markDoorAndWindow(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  // One door on MAIN FL + a window on MAIN FL and 2ND FL.
  const doors = saved.fenestrations.filter(opening => opening.type === 'door');
  expect(doors).toHaveLength(1);
  expect(doors[0].levelId).toBe(3);
  expect(doors[0].layer).toBe('A-DOOR');
  expect(doors[0].width).toBeCloseTo(3, 5);

  const windows = saved.fenestrations.filter(opening => opening.type === 'window');
  expect(windows).toHaveLength(2);
  expect(new Set(windows.map(opening => opening.levelId))).toEqual(new Set([3, 5]));
  windows.forEach(opening => {
    expect(opening.layer).toBe('A-GLAZ');
    expect(opening.width).toBeCloseTo(4, 5);
    expect(opening.sillHeight).toBeCloseTo(2.5, 5);
  });

  // Each opening hosts on the generated wall spanning its mark's edge: the
  // door's wall runs the bottom edge, the windows' walls the right edge.
  const wallsById = new Map(saved.walls.map(wall => [wall.id, wall]));
  const doorWall = wallsById.get(doors[0].wallId);
  expect(h.touchesPoint(doorWall, -8, -6) && h.touchesPoint(doorWall, 8, -6)).toBe(true);
  expect(doors[0].offset).toBeCloseTo(8, 0);
  windows.forEach(opening => {
    const wall = wallsById.get(opening.wallId);
    expect(h.touchesPoint(wall, 8, -6) && h.touchesPoint(wall, 8, 6)).toBe(true);
    expect(opening.offset).toBeCloseTo(6, 0);
  });
});

test('re-running BUILD HOUSE never doubles the marked openings or the dims', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await markDoorAndWindow(page);
  await buildHouse(page);
  const first = await h.savedDrawing(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.fenestrations).toHaveLength(3);
  expect(saved.walls).toHaveLength(12);
  expect(saved.dimensions).toHaveLength(first.dimensions.length);
});

test('BUILD HOUSE lays the auto-dimension stack on every level it builds', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await markDoorAndWindow(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  expect(auto.length).toBeGreaterThan(0);
  // Floor plans and the foundation each get their strings.
  expect(auto.some(dimension => dimension.levelId === 3 && dimension.view === 'plan')).toBe(true);
  expect(auto.some(dimension => dimension.levelId === 5 && dimension.view === 'plan')).toBe(true);
  expect(auto.some(dimension => dimension.levelId === 1 && dimension.view === 'foundation')).toBe(true);
  // The door mark's centre (x=0) splits MAIN FL's south string: a dimension
  // line ends at the opening centre.
  expect(auto.some(dimension => dimension.levelId === 3
    && (h.near(dimension.start.x, 0, 0.6) || h.near(dimension.end.x, 0, 0.6)))).toBe(true);
});

test('an attached garage gets its overhead + man doors in the wall and the grade beam', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await drawGarageOutline(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const doors = saved.fenestrations.filter(opening => opening.type === 'door');
  // Overhead + man door, each cut into the stud wall (plan) and the grade
  // beam (foundation) = 4 doors.
  expect(doors).toHaveLength(4);
  doors.forEach(opening => expect(opening.layer).toBe('A-DOOR'));

  // The longest open leg is 12' — too short for the 16' door, so the 9'
  // single-car overhead goes in.
  const overheads = doors.filter(opening => h.near(opening.width, 9, 0.01));
  expect(overheads).toHaveLength(2);
  expect(new Set(overheads.map(opening => opening.view))).toEqual(new Set(['plan', 'foundation']));
  overheads.forEach(opening => expect(opening.headHeight).toBeCloseTo(7, 3));

  const manDoors = doors.filter(opening => h.near(opening.width, (2 * 12 + 8) / 12, 0.01));
  expect(manDoors).toHaveLength(2);
  expect(new Set(manDoors.map(opening => opening.view))).toEqual(new Set(['plan', 'foundation']));

  // The overhead doors centre on the longest open leg (the z = -4 run).
  const wallsById = new Map(saved.walls.map(wall => [wall.id, wall]));
  overheads.forEach(opening => {
    const wall = wallsById.get(opening.wallId);
    expect(h.near(wall.start.z, -4) && h.near(wall.end.z, -4)).toBe(true);
  });
  // The man doors sit on another leg (the z = 4 run back toward the house).
  manDoors.forEach(opening => {
    const wall = wallsById.get(opening.wallId);
    expect(h.near(wall.start.z, 4) && h.near(wall.end.z, 4)).toBe(true);
  });
});
