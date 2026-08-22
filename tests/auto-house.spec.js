// BUILD HOUSE turns the OUTLINE copies into a starter shell in one click:
// 2×6 stud walls + framed floors on MAIN FL and 2ND FL, 8" concrete walls +
// an S-SLAB slab on FOUNDATION, and an all-eave roof grown from the MAIN FL
// outline by the roof overhang. Each piece only builds where the level is
// still empty, so a second click never doubles up.
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

test('BUILD HOUSE generates walls, floors, slab, and roof from the outline', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);

  // MAIN FL + 2ND FL: four 2×6 stud walls each, on PLAN.
  for (const levelId of [3, 5]) {
    const walls = saved.walls.filter(wall => wall.levelId === levelId);
    expect(walls).toHaveLength(4);
    walls.forEach(wall => {
      expect(wall.wallType).toBe('stud_2x6');
      expect(wall.view).toBe('plan');
    });
    // Walls trace the outline corners.
    expect(walls.some(wall => h.touchesPoint(wall, -8, -6))).toBe(true);
    expect(walls.some(wall => h.touchesPoint(wall, 8, 6))).toBe(true);
    // A framed floor from the same outline.
    const floors = saved.floors.filter(floor => floor.levelId === levelId);
    expect(floors).toHaveLength(1);
    expect(floors[0].structure).toBe('floor');
    expect(floors[0].points).toHaveLength(4);
  }

  // FOUNDATION: 8" concrete walls on S-FDN and a slab on S-SLAB.
  const fdnWalls = saved.walls.filter(wall => wall.levelId === 1);
  expect(fdnWalls).toHaveLength(4);
  fdnWalls.forEach(wall => {
    expect(wall.wallType).toBe('concrete_8');
    expect(wall.view).toBe('foundation');
  });
  const slabs = saved.floors.filter(floor => floor.levelId === 1);
  expect(slabs).toHaveLength(1);
  expect(slabs[0].structure).toBe('slab');

  // ROOF: one all-eave 4:12 roof grown by the default 2' overhang.
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.levelId).toBe(7);
  expect(roof.pitch).toBe(4);
  expect(roof.overhang).toBe(2);
  expect(roof.edges.every(edge => edge === 'eave')).toBe(true);
  expect(roof.points.some(p => h.near(p.x, -10) && h.near(p.z, -8))).toBe(true);
  expect(roof.points.some(p => h.near(p.x, 10) && h.near(p.z, 8))).toBe(true);

  // The outline guide itself is untouched.
  expect(saved.outlines).toHaveLength(saved.levels.length);
});

test('a second BUILD HOUSE click never doubles the shell', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(12);
  expect(saved.floors).toHaveLength(3);
  expect(saved.roofs).toHaveLength(1);
});

test('BUILD HOUSE only fills levels that are still empty', async ({ page }) => {
  await h.openModel(page);
  // A hand-drawn MAIN FL wall first: BUILD HOUSE must leave MAIN FL walls alone.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -4, 0);
  await h.clickWorld(page, 4, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await drawOutlineRect(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  // MAIN FL keeps only the hand-drawn wall; the other levels got theirs.
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(1);
  expect(saved.walls.filter(wall => wall.levelId === 5)).toHaveLength(4);
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(4);
  // Floors and roof still build everywhere.
  expect(saved.floors).toHaveLength(3);
  expect(saved.roofs).toHaveLength(1);
});

test('BUILD HOUSE without an outline explains itself and builds nothing', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await expect(page.getByText('Nothing to build from')).toBeVisible();

  const saved = await h.savedDrawing(page);
  expect(saved?.walls || []).toHaveLength(0);
  expect(saved?.roofs || []).toHaveLength(0);
});

test('one undo removes the whole generated house', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);

  const saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(0);
  expect(saved.floors).toHaveLength(0);
  expect(saved.roofs).toHaveLength(0);
  // The outline survives the undo.
  expect(saved.outlines).toHaveLength(saved.levels.length);
});
