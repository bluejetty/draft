// A DETACHED garage is a CLOSED garage loop: MARK GARAGE, then close the run
// back on its first point — no house welding. A foundation prompt picks the
// construction: GRADE BEAM (full perimeter beam; 4" slab sloping 1/8"/ft to
// the door on graded fill) or THICKENED-EDGE SLAB (one LEVEL monolithic pour:
// 4" field, 1'-0" edge, 45° taper, on gravel). BUILD HOUSE raises four stud
// walls, the chosen foundation, overhead + man doors, and its own all-eave
// roof that never splices into the house.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawHouseOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// A 12×10 garage clear of the house, closed by re-clicking its first
// corner; the foundation prompt then lands the master. The 12' front takes
// the 9' narrow overhead door; a 10' side takes the man door.
async function drawDetachedGarage(page, foundation) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /DETACHED GARAGE/ }).click();
  await h.clickWorld(page, 14, -5);
  await h.clickWorld(page, 26, -5);
  await h.clickWorld(page, 26, 5);
  await h.clickWorld(page, 14, 5);
  await h.clickWorld(page, 14, -5);
  await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
  await page.locator(foundation === 'thickened'
    ? '[data-detached-thickened-edge]' : '[data-detached-grade-beam]').click();
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

test('closing a garage loop prompts for the foundation and stores a detached master', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'gradebeam');

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const master = saved.boneyardOutlines[0];
  expect(master.garage).toBe(true);
  expect(master.open).toBeFalsy();
  expect(master.detached).toBe(true);
  expect(master.foundation).toBe('gradebeam');
  expect(master.points).toHaveLength(4);

  // Every level carries a copy tagged with the same construction.
  const copies = saved.outlines.filter(outline => outline.garage);
  expect(copies).toHaveLength(saved.levels.length);
  copies.forEach(copy => {
    expect(copy.detached).toBe(true);
    expect(copy.foundation).toBe('gradebeam');
  });
});

test('the thickened-edge choice lands on the master and its copies', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'thickened');

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines[0].foundation).toBe('thickened');
  saved.outlines.filter(outline => outline.garage)
    .forEach(copy => expect(copy.foundation).toBe('thickened'));
});

test('BUILD HOUSE grade beam: full perimeter beam, sloped 4" slab, walls, doors, own roof', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);

  // Grade beam all the way around the closed loop — no leg is skipped.
  const fdnWalls = saved.walls.filter(wall => wall.levelId === 1);
  expect(fdnWalls).toHaveLength(4);
  fdnWalls.forEach(wall => expect(wall.wallType).toBe('concrete_8'));

  // Uniform 4" slab sloping 1/8"/ft to the door — the fill carries the fall.
  const slab = saved.floors.find(floor => floor.garage);
  expect(slab).toBeTruthy();
  expect(slab.thickness * 12).toBeCloseTo(4, 5);
  expect(slab.slopeInPerFt).toBeCloseTo(1 / 8, 5);
  expect(slab.thickenedEdge).toBeFalsy();
  expect(slab.points).toHaveLength(4);

  // Four stud walls off the slab.
  const studWalls = saved.walls.filter(wall => wall.levelId === 3);
  expect(studWalls).toHaveLength(4);
  studWalls.forEach(wall => {
    expect(wall.wallType).toBe('stud_2x6');
    expect(wall.baseHeight).toBe(0);
  });

  // Its own roof: garage-tagged, every edge an eave, past the far wall.
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.garage).toBe(true);
  roof.edges.forEach(edge => expect(edge).toBe('eave'));
  expect(Math.max(...roof.points.map(point => point.x))).toBeGreaterThan(26);

  // Overhead + man door on the plan walls AND the beam (pour cut).
  const doors = saved.fenestrations.filter(opening => opening.type === 'door');
  expect(doors.filter(door => door.view === 'plan')).toHaveLength(2);
  expect(doors.filter(door => door.view === 'foundation')).toHaveLength(2);
  const widths = doors.map(door => door.width);
  expect(widths).toContain(9); // narrow overhead on the 12' front leg
});

test('BUILD HOUSE thickened edge: no beam, LEVEL FLAT monolithic slab', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'thickened');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);

  // No grade beam — the slab's perimeter IS the footing.
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(0);

  // One level pour: 4" field, no slope, thickened-edge flagged.
  const slab = saved.floors.find(floor => floor.garage);
  expect(slab).toBeTruthy();
  expect(slab.thickness * 12).toBeCloseTo(4, 5);
  expect(slab.slopeInPerFt).toBe(0);
  expect(slab.thickenedEdge).toBe(true);

  // Walls and roof still rise; doors land on the plan walls only (no beam
  // to cut on the FOUNDATION plan).
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(4);
  expect(saved.roofs).toHaveLength(1);
  expect(saved.roofs[0].garage).toBe(true);
  const doors = saved.fenestrations.filter(opening => opening.type === 'door');
  expect(doors.filter(door => door.view === 'plan')).toHaveLength(2);
  expect(doors.filter(door => door.view === 'foundation')).toHaveLength(0);
});

test('detached construction survives a save and reload', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'thickened');
  await buildHouse(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(700);

  const saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  expect(master.detached).toBe(true);
  expect(master.foundation).toBe('thickened');
  const slab = saved.floors.find(floor => floor.garage);
  expect(slab.thickenedEdge).toBe(true);
  expect(slab.slopeInPerFt).toBe(0);
});

test('a detached garage beside a house keeps its own roof and skips the ties', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);

  // 4 house foundation walls + 4 garage beams — nothing welded, no rebar
  // ties (those belong to the attached open run).
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(8);
  expect(saved.notes.filter(note => note.body === 'REBAR TIE')).toHaveLength(0);

  // Two roofs: the house's own plus the garage's all-eave roof — never one
  // spliced loop.
  expect(saved.roofs).toHaveLength(2);
  const garageRoof = saved.roofs.find(roof => roof.garage);
  const houseRoof = saved.roofs.find(roof => !roof.garage);
  expect(garageRoof).toBeTruthy();
  garageRoof.edges.forEach(edge => expect(edge).toBe('eave'));
  expect(Math.max(...houseRoof.points.map(point => point.x))).toBeLessThan(14);
});

test('a second BUILD HOUSE never doubles the detached garage', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(4);
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(4);
  expect(saved.floors.filter(floor => floor.garage)).toHaveLength(1);
  expect(saved.roofs).toHaveLength(1);
});

// BUILD GARAGE after the fact: an ordinary closed outline (no MARK GARAGE)
// converts into a detached garage — the prompt picks the foundation, and the
// garage builds right away.
test('BUILD GARAGE converts a plain rectangle and builds it in one go', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, 14, -5);
  await h.clickWorld(page, 26, -5);
  await h.clickWorld(page, 26, 5);
  await h.clickWorld(page, 14, 5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await page.locator('[data-build-garage]').click();
  await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
  await page.locator('[data-detached-thickened-edge]').click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const master = saved.boneyardOutlines[0];
  expect(master.garage).toBe(true);
  expect(master.detached).toBe(true);
  expect(master.foundation).toBe('thickened');
  // The house-master rectangle is gone — only garage copies remain.
  expect(saved.outlines.every(outline => outline.garage)).toBe(true);
  // And the garage built without a separate BUILD HOUSE click.
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(4);
  const slab = saved.floors.find(floor => floor.garage);
  expect(slab.thickenedEdge).toBe(true);
  expect(saved.roofs).toHaveLength(1);
  expect(saved.roofs[0].garage).toBe(true);
});

// Garage first, house second: the garage's built pieces must not read as
// "the shell is already built" — BUILD HOUSE raises the house next to them.
test('a house drawn after a built garage still builds', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, 14, -5);
  await h.clickWorld(page, 26, -5);
  await h.clickWorld(page, 26, 5);
  await h.clickWorld(page, 14, 5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await page.locator('[data-build-garage]').click();
  await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
  await page.locator('[data-detached-thickened-edge]').click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);

  await drawHouseOutline(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  // House shell: foundation walls + main-floor walls beside the garage's.
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(4);
  expect(saved.walls.filter(wall => wall.levelId === 3).length).toBeGreaterThanOrEqual(8);
  // House slab joins the garage slab; footings and the house roof appear.
  expect(saved.floors.filter(floor => !floor.garage && floor.levelId === 1)).toHaveLength(1);
  expect(saved.lines.filter(line => line.layer === 'S-FOOTING').length).toBeGreaterThan(0);
  expect(saved.roofs.filter(roof => !roof.garage)).toHaveLength(1);
  expect(saved.roofs.filter(roof => roof.garage)).toHaveLength(1);

  // And a second BUILD HOUSE stays idempotent.
  await buildHouse(page);
  const again = await h.savedDrawing(page);
  expect(again.walls.length).toBe(saved.walls.length);
  expect(again.floors.length).toBe(saved.floors.length);
  expect(again.roofs.length).toBe(saved.roofs.length);
});

test('BUILD GARAGE beside a house converts the newest rectangle, not the house', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, 14, -5);
  await h.clickWorld(page, 26, -5);
  await h.clickWorld(page, 26, 5);
  await h.clickWorld(page, 14, 5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await page.locator('[data-build-garage]').click();
  await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
  await page.locator('[data-detached-grade-beam]').click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  // House master untouched; the garage master joined it on the shelf.
  expect(saved.boneyardOutlines).toHaveLength(2);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.detached).toBe(true);
  expect(garageMaster.foundation).toBe('gradebeam');
  const houseMaster = saved.boneyardOutlines.find(outline => !outline.garage);
  expect(houseMaster).toBeTruthy();
  // The whole plan built: house shell plus the garage pieces.
  expect(saved.walls.filter(wall => wall.levelId === 1).length).toBeGreaterThanOrEqual(8);
  expect(saved.roofs).toHaveLength(2);
});
