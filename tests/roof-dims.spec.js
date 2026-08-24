// AUTO DIMS on the ROOF level strings the roof footprints for the truss
// designer. Per side: the closest string runs roof edge → the bearing wall
// corners facing that side → roof edge (the end pieces read the overhang),
// and the outermost string is the overall, eave to eave across the
// footprint. The wall line sits one overhang inside the roof edge. BUILD
// HOUSE refreshes the roof stack along with the floor and foundation stacks.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function switchLevel(page, name) {
  await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function runAutoDims(page) {
  await h.selectTool(page, 'Dimension');
  await page.getByRole('button', { name: 'AUTO DIMS' }).click();
  await h.waitForSaved(page);
}

// L-shaped roof: shape (-8,-6)…(-8,6) with a notch at (0,0), grown by the 2'
// default overhang → footprint (-10,-8) (10,-8) (10,2) (2,2) (2,8) (-10,8),
// every edge an eave.
async function buildLRoof(page) {
  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Shape');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 0);
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 0, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Roof');
  await page.getByRole('button', { name: 'FROM SHAPE', exact: true }).click();
  await page.getByRole('button', { name: 'BUILD FROM SHAPE' }).click();
  await h.waitForSaved(page);
}

function roofAutoDims(saved) {
  return saved.dimensions.filter(dimension =>
    dimension.auto && dimension.levelId === 7 && dimension.view === 'plan');
}

test('a rectangular roof strings overhang / span / overhang plus the overall per side', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await h.clickWorld(page, 0, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await runAutoDims(page);
  const auto = roofAutoDims(await h.savedDrawing(page));
  // Footprint (-6,0)…(6,12), 2' overhang → wall line (-4,2)…(4,10). Per
  // side: overhang / wall span / overhang at the first offset + the overall.
  expect(auto).toHaveLength(16);
  const north = auto.filter(dimension => h.near(dimension.start.z, -1.5) && h.near(dimension.end.z, -1.5));
  expect(north).toHaveLength(3);
  const pieces = north.map(dimension => Math.abs(dimension.end.x - dimension.start.x)).sort((a, b) => a - b);
  expect(pieces[0]).toBeCloseTo(2, 3);
  expect(pieces[1]).toBeCloseTo(2, 3);
  expect(pieces[2]).toBeCloseTo(8, 3);
  const northOverall = auto.find(dimension => h.near(dimension.start.z, -3) && h.near(dimension.end.z, -3));
  expect(northOverall).toBeTruthy();
  expect(Math.abs(northOverall.end.x - northOverall.start.x)).toBeCloseTo(12, 5);
  const west = auto.filter(dimension => h.near(dimension.start.x, -7.5) && h.near(dimension.end.x, -7.5));
  expect(west).toHaveLength(3);
});

test('an L roof strings each side\'s own wall corners between the overhang ends', async ({ page }) => {
  await h.openModel(page);
  await buildLRoof(page);
  await runAutoDims(page);

  const auto = roofAutoDims(await h.savedDrawing(page));
  // Wall line (-8,-6)(8,-6)(8,0)(0,0)(0,6)(-8,6) inside footprint ±2'.
  // N and W face one flat wall: overhang / span / overhang + overall — 4.
  // S and E face the notch: their string breaks at its wall corner too — 5.
  expect(auto).toHaveLength(18);

  // N side first string: -10 → -8 → 8 → 10; the notch (x=0/2) stays off it.
  const northPieces = auto.filter(dimension =>
    h.near(dimension.start.z, -9.5) && h.near(dimension.end.z, -9.5));
  expect(northPieces).toHaveLength(3);
  expect(northPieces.some(dimension =>
    h.near(dimension.start.x, 2) || h.near(dimension.end.x, 2)
    || h.near(dimension.start.x, 0) || h.near(dimension.end.x, 0))).toBe(false);
  // N overall one spacing further out, eave to eave.
  const northOverall = auto.find(dimension =>
    h.near(dimension.start.z, -11) && h.near(dimension.end.z, -11));
  expect(Math.abs(northOverall.end.x - northOverall.start.x)).toBeCloseTo(20, 5);

  // S side first string breaks at the notch wall corner x=0:
  // -10 → -8 → 0 → 8 → 10.
  const southPieces = auto.filter(dimension =>
    h.near(dimension.start.z, 9.5) && h.near(dimension.end.z, 9.5));
  expect(southPieces).toHaveLength(4);
  expect(southPieces.some(dimension =>
    h.near(dimension.start.x, 0) || h.near(dimension.end.x, 0))).toBe(true);

  // E side first string breaks at the notch wall corner z=0.
  const eastPieces = auto.filter(dimension =>
    h.near(dimension.start.x, 11.5) && h.near(dimension.end.x, 11.5));
  expect(eastPieces).toHaveLength(4);
  expect(eastPieces.some(dimension =>
    h.near(dimension.start.z, 0) || h.near(dimension.end.z, 0))).toBe(true);

  // Re-running replaces the stack instead of doubling it.
  await runAutoDims(page);
  expect(roofAutoDims(await h.savedDrawing(page))).toHaveLength(18);
});

test('tagging an edge GABLE leaves the wall-corner strings alone', async ({ page }) => {
  await h.openModel(page);
  await buildLRoof(page);

  // The x=2 vertical edge stops being an eave; the strings still read the
  // bearing wall corners the same way.
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, 2, 5);
  await h.waitForSaved(page);
  const roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.edges.filter(edge => edge === 'gable')).toHaveLength(1);

  await runAutoDims(page);
  const auto = roofAutoDims(await h.savedDrawing(page));
  expect(auto).toHaveLength(18);
  const north = auto.filter(dimension => dimension.start.z < -8 && dimension.end.z < -8);
  expect(north).toHaveLength(4);
});

test('BUILD HOUSE refreshes the roof stack with the plan stacks', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.roofs.length).toBeGreaterThan(0);
  // The generated rectangle roof (outline + overhang) strings overhang /
  // span / overhang + the overall on each side.
  const auto = roofAutoDims(saved);
  expect(auto).toHaveLength(16);
  const minX = Math.min(...saved.roofs[0].points.map(point => point.x));
  const west = auto.filter(dimension =>
    h.near(dimension.start.x, minX - 1.5) && h.near(dimension.end.x, minX - 1.5));
  expect(west).toHaveLength(3);
});
