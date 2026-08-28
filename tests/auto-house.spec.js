// BUILD HOUSE turns the OUTLINE copies into a starter shell in one click:
// 2×6 stud walls + framed floors on MAIN FL and 2ND FL, 8" concrete walls +
// an S-SLAB slab + strip-footing linework on FOUNDATION, and an all-eave
// roof grown from the ROOF level's outline by the roof overhang. Each piece
// only builds where the level is still empty, so a second click never
// doubles up.
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

  // Strip footings: two rings of linework on the foundation layer set — a
  // 20" footing centered on the 8" wall, so 6" projection past each face.
  const footings = saved.lines.filter(line => line.levelId === 1);
  expect(footings).toHaveLength(8);
  footings.forEach(line => expect(line.view).toBe('foundation'));
  const hasCorner = (x, z) => footings.some(line =>
    (Math.abs(line.start.x - x) < 0.05 && Math.abs(line.start.z - z) < 0.05)
    || (Math.abs(line.end.x - x) < 0.05 && Math.abs(line.end.z - z) < 0.05));
  expect(hasCorner(-8.5, -6.5)).toBe(true);
  expect(hasCorner(8.5, 6.5)).toBe(true);
  expect(hasCorner(-8 + 7 / 6, -6 + 7 / 6)).toBe(true);
  expect(hasCorner(8 - 7 / 6, 6 - 7 / 6)).toBe(true);

  // ROOF: one all-eave 4:12 roof grown by the default 2' overhang.
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.levelId).toBe(7);
  // Grown from the ROOF level's own outline copy (brought in from the BONEYARD).
  expect(roof.sourceLevelId).toBe(7);
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
  expect(saved.lines).toHaveLength(8);
  expect(saved.roofs).toHaveLength(1);
});

test('a wider saved footing width recenters the footing rings', async ({ page }) => {
  await h.openModel(page);

  // The width left the FOUNDATION card face — it changes on the PROJECT page
  // now, landing in the same saved assembly slot.
  const fdn = page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: 'FOUNDATION' }) });
  await expect(fdn.locator('.level-edge-edit[title^="Footing width"]')).toHaveCount(0);
  await page.locator('[data-project-open]').click();
  await page.waitForURL(/PROJECT\.html/);
  const width = page.locator('[data-detail-input="footingWidth"]');
  await width.fill('24');
  await width.dispatchEvent('change');
  await expect(page.locator('#status')).toContainText('saved');
  expect((await h.savedDrawing(page)).levelAssemblies['1'].footingWidthIn).toBe(24);
  await page.goto('/MODEL.dc.html');
  await h.waitForModelReady(page);

  // BUILD HOUSE draws the wider footing: 24" on the 8" wall = 8" each side.
  await drawOutlineRect(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  const footings = saved.lines.filter(line => line.levelId === 1);
  expect(footings).toHaveLength(8);
  const hasCorner = (x, z) => footings.some(line =>
    (Math.abs(line.start.x - x) < 0.05 && Math.abs(line.start.z - z) < 0.05)
    || (Math.abs(line.end.x - x) < 0.05 && Math.abs(line.end.z - z) < 0.05));
  expect(hasCorner(-8 - 8 / 12, -6 - 8 / 12)).toBe(true);
  expect(hasCorner(-8 + 8 / 12 + 8 / 12, -6 + 8 / 12 + 8 / 12)).toBe(true);
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
  // Floors, footings, and roof still build everywhere.
  expect(saved.floors).toHaveLength(3);
  expect(saved.lines.filter(line => line.levelId === 1)).toHaveLength(8);
  expect(saved.roofs).toHaveLength(1);
});

test('BUILD HOUSE without an outline explains the select-first flow and builds nothing', async ({ page }) => {
  await h.openModel(page);
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await expect(page.locator('[data-model-drawing-message]')).toContainText('Nothing to build yet');

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
  expect(saved.lines).toHaveLength(0);
  expect(saved.roofs).toHaveLength(0);
  // The outline survives the undo.
  expect(saved.outlines).toHaveLength(saved.levels.length);
});
