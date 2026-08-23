// BUILD HOUSE-generated geometry stays linked to the BONEYARD master points
// it derived from: every generated vertex remembers its source point (srcId)
// and its offset at generation, so a master edit ripples through the walls,
// floors, slab, footings, and roof on every level. A generated vertex the
// drafter drags afterwards re-measures its offset — locked relative, never
// left behind — and the links survive a save/reload.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function switchLevel(page, name) {
  await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) })
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

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

test('BUILD HOUSE stamps generated points with their master link', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const masterIds = new Set(saved.boneyardOutlines[0].points.map(p => p.id));

  // Walls trace the outline exactly: linked with a zero offset.
  saved.walls.forEach(wall => {
    for (const end of [wall.start, wall.end]) {
      expect(masterIds.has(end.srcId)).toBe(true);
      expect(Math.abs(end.offX)).toBeLessThan(0.001);
      expect(Math.abs(end.offZ)).toBeLessThan(0.001);
    }
  });
  saved.floors.forEach(floor => floor.points.forEach(p => expect(masterIds.has(p.srcId)).toBe(true)));

  // Footing rings link to the corner they were offset from — the exterior
  // ring 6" out (20" footing on the 8" wall), the interior ring 14" in.
  const footings = saved.lines.filter(line => line.levelId === 1);
  expect(footings).toHaveLength(8);
  footings.forEach(line => {
    for (const end of [line.start, line.end]) {
      expect(masterIds.has(end.srcId)).toBe(true);
      expect([0.5, 7 / 6].some(d => h.near(Math.abs(end.offX), d))).toBe(true);
    }
  });

  // Roof corners link at the 2' overhang offset.
  saved.roofs[0].points.forEach(p => {
    expect(masterIds.has(p.srcId)).toBe(true);
    expect(h.near(Math.abs(p.offX), 2)).toBe(true);
    expect(h.near(Math.abs(p.offZ), 2)).toBe(true);
  });
});

test('a master edit ripples through the whole generated house', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);

  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 6, 12, 10);

  const saved = await h.savedDrawing(page);
  // Stud walls and concrete walls follow the corner on every level.
  for (const levelId of [1, 3, 5]) {
    const walls = saved.walls.filter(wall => wall.levelId === levelId);
    expect(walls.some(wall => h.touchesPoint(wall, 12, 10))).toBe(true);
    expect(walls.some(wall => h.touchesPoint(wall, 8, 6))).toBe(false);
  }
  // Floors and the slab follow.
  saved.floors.forEach(floor => {
    expect(floor.points.some(p => h.near(p.x, 12) && h.near(p.z, 10))).toBe(true);
  });
  // Footing rings keep their projection off the moved corner.
  const footings = saved.lines.filter(line => line.levelId === 1);
  const hasCorner = (x, z) => footings.some(line =>
    (h.near(line.start.x, x) && h.near(line.start.z, z))
    || (h.near(line.end.x, x) && h.near(line.end.z, z)));
  expect(hasCorner(12.5, 10.5)).toBe(true);
  expect(hasCorner(12 - 7 / 6, 10 - 7 / 6)).toBe(true);
  // The roof eave keeps its 2' overhang off the moved corner.
  expect(saved.roofs[0].points.some(p => h.near(p.x, 14) && h.near(p.z, 12))).toBe(true);
});

test('a dragged generated node rides later master edits at its new offset', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);

  // Pull the MAIN FL wall corner 2' out both ways — a cantilevered corner.
  await switchLevel(page, 'MAIN FL');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 6, 10, 8);

  // Now move the master corner: the cantilever rides along, still 2' proud.
  await switchLevel(page, 'BONEYARD');
  await dragWorld(page, 8, 6, 4, 2);

  const saved = await h.savedDrawing(page);
  const walls = saved.walls.filter(wall => wall.levelId === 3);
  expect(walls.some(wall => h.touchesPoint(wall, 6, 4))).toBe(true);
  expect(walls.some(wall => h.touchesPoint(wall, 10, 8))).toBe(false);
  // Levels without the local pull follow the master exactly.
  const upper = saved.walls.filter(wall => wall.levelId === 5);
  expect(upper.some(wall => h.touchesPoint(wall, 4, 2))).toBe(true);
});

test('the links survive a reload: master edits still move the house', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);

  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Select');
  await dragWorld(page, -8, -6, -12, -10);

  const saved = await h.savedDrawing(page);
  const fdnWalls = saved.walls.filter(wall => wall.levelId === 1);
  expect(fdnWalls.some(wall => h.touchesPoint(wall, -12, -10))).toBe(true);
  const footings = saved.lines.filter(line => line.levelId === 1);
  expect(footings.some(line =>
    (h.near(line.start.x, -12.5) && h.near(line.start.z, -10.5))
    || (h.near(line.end.x, -12.5) && h.near(line.end.z, -10.5)))).toBe(true);
  expect(saved.roofs[0].points.some(p => h.near(p.x, -14) && h.near(p.z, -12))).toBe(true);
});
