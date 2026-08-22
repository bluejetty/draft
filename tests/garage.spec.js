// A GARAGE is a marked outline attached to the house: MARK GARAGE arms the
// Outline tool so the next closed outline stores as the garage footprint
// (copied to every level like a master). BUILD HOUSE then grows an open-C
// grade beam — concrete walls only on the sides away from the house, since
// the house foundation closes the fourth side — a 4" slab sloped 1/8"/ft,
// garage stud walls on the open sides, and the garage's own roof whose
// house-shared edge is tagged GABLE so it links into the house roof.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// House: 16×12 rect. Garage: 12×8 attached to the house's right side —
// its left edge (x=8, z from -4 to 4) rides the house outline.
async function drawHouseOutline(page) {
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
  await page.getByRole('button', { name: 'MARK GARAGE' }).click();
  await h.clickWorld(page, 8, -4);
  await h.clickWorld(page, 20, -4);
  await h.clickWorld(page, 20, 4);
  await h.clickWorld(page, 8, 4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

test('MARK GARAGE stores a garage outline on every level and persists', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);

  const saved = await h.savedDrawing(page);
  // Two masters on the shelf: the house and the garage.
  expect(saved.boneyardOutlines).toHaveLength(2);
  expect(saved.boneyardOutlines.filter(outline => outline.garage)).toHaveLength(1);
  // Every level carries a copy of each, the garage copies flagged.
  expect(saved.outlines).toHaveLength(saved.levels.length * 2);
  expect(saved.outlines.filter(outline => outline.garage)).toHaveLength(saved.levels.length);
});

test('BUILD HOUSE grows the open-C grade beam, sloped slab, and garage roof', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);

  // Grade beam: three concrete walls on the sides away from the house — the
  // shared edge (x=8) builds nothing, the house foundation closes the C.
  const fdnWalls = saved.walls.filter(wall => wall.levelId === 1);
  expect(fdnWalls).toHaveLength(7); // 4 house + 3 garage
  fdnWalls.forEach(wall => {
    expect(wall.wallType).toBe('concrete_8');
    expect(wall.view).toBe('foundation');
  });
  const garageBeam = fdnWalls.filter(wall =>
    h.touchesPoint(wall, 20, -4) || h.touchesPoint(wall, 20, 4));
  expect(garageBeam).toHaveLength(3);
  // No foundation wall runs along the shared house edge inside the garage span.
  const sharedEdgeWall = fdnWalls.find(wall =>
    h.near(wall.start.x, 8) && h.near(wall.end.x, 8)
    && Math.max(wall.start.z, wall.end.z) <= 4.05 && Math.min(wall.start.z, wall.end.z) >= -4.05);
  expect(sharedEdgeWall).toBeUndefined();

  // Garage stud walls on MAIN FL follow the same open-C.
  const mainWalls = saved.walls.filter(wall => wall.levelId === 3);
  expect(mainWalls).toHaveLength(7); // 4 house + 3 garage
  expect(mainWalls.filter(wall => h.touchesPoint(wall, 20, -4) || h.touchesPoint(wall, 20, 4)))
    .toHaveLength(3);

  // Garage slab: 4" pour sloped 1/8" per foot, flagged for sections/specs.
  const slabs = saved.floors.filter(floor => floor.levelId === 1);
  expect(slabs).toHaveLength(2); // house slab + garage slab
  const garageSlab = slabs.find(floor => floor.garage);
  expect(garageSlab).toBeTruthy();
  expect(garageSlab.structure).toBe('slab');
  expect(garageSlab.thickness * 12).toBeCloseTo(4, 5);
  expect(garageSlab.slopeInPerFt).toBeCloseTo(1 / 8, 5);

  // Garage roof: its own editable roof with an independent plate height, the
  // house-shared edge tagged GABLE so the planes link into the house roof.
  expect(saved.roofs).toHaveLength(2);
  const garageRoof = saved.roofs.find(roof => roof.garage);
  expect(garageRoof).toBeTruthy();
  expect(garageRoof.levelId).toBe(7);
  expect(Number.isFinite(garageRoof.plateHeightFt)).toBe(true);
  expect(garageRoof.edges.filter(edge => edge === 'gable')).toHaveLength(1);
  expect(garageRoof.edges.filter(edge => edge === 'eave')).toHaveLength(3);
  const houseRoof = saved.roofs.find(roof => !roof.garage);
  expect(houseRoof.edges.every(edge => edge === 'eave')).toBe(true);
});

test('a second BUILD HOUSE click never doubles the garage', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(7);
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(7);
  expect(saved.floors.filter(floor => floor.levelId === 1)).toHaveLength(2);
  expect(saved.roofs).toHaveLength(2);
});

test('a garage alone still builds its grade beam and slab', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'MARK GARAGE' }).click();
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 12, 0);
  await h.clickWorld(page, 12, 8);
  await h.clickWorld(page, 0, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  // With no house outline every garage edge gets grade beam.
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(4);
  const garageSlab = saved.floors.find(floor => floor.garage);
  expect(garageSlab).toBeTruthy();
  expect(saved.roofs.filter(roof => roof.garage)).toHaveLength(1);
});
