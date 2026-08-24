// AUTO DIMS on the ROOF level strings the roof footprints for the truss
// designer. Per side: the closest string breaks at the corners of the edges
// facing that side, a middle string catches eave lines the first one missed
// (the far eaves of an L — the truss bearing lines), and the outermost
// string is the overall, eave to eave across the footprint. BUILD HOUSE
// refreshes the roof stack along with the floor and foundation stacks.
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

test('a rectangular roof gets one overall per side at the first offset', async ({ page }) => {
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
  // Footprint (-6,0)…(6,12): no jogs, no interior eaves — 4 overalls only.
  expect(auto).toHaveLength(4);
  const north = auto.find(dimension => h.near(dimension.start.z, -1.5) && h.near(dimension.end.z, -1.5));
  expect(north).toBeTruthy();
  expect(Math.abs(north.end.x - north.start.x)).toBeCloseTo(12, 5);
  const west = auto.find(dimension => h.near(dimension.start.x, -7.5) && h.near(dimension.end.x, -7.5));
  expect(west).toBeTruthy();
  expect(Math.abs(west.end.z - west.start.z)).toBeCloseTo(12, 5);
});

test('an L roof strings facing corners, missed eave lines, and overalls', async ({ page }) => {
  await h.openModel(page);
  await buildLRoof(page);
  await runAutoDims(page);

  const auto = roofAutoDims(await h.savedDrawing(page));
  // N and W: full-width facing eave, so the missed-eave string (broken at
  // the far eave line) sits closest with the overall outside — 3 dims each.
  // S and E: the facing corners jog at the notch — 2-piece string + overall.
  expect(auto).toHaveLength(12);

  // N side: middle string at z = -8 - 1'6" breaks at the x=2 eave line.
  const northPieces = auto.filter(dimension =>
    h.near(dimension.start.z, -9.5) && h.near(dimension.end.z, -9.5));
  expect(northPieces).toHaveLength(2);
  expect(northPieces.some(dimension =>
    h.near(dimension.start.x, 2) || h.near(dimension.end.x, 2))).toBe(true);
  // N overall one spacing further out, eave to eave.
  const northOverall = auto.find(dimension =>
    h.near(dimension.start.z, -11) && h.near(dimension.end.z, -11));
  expect(Math.abs(northOverall.end.x - northOverall.start.x)).toBeCloseTo(20, 5);

  // W side: middle string breaks at the z=2 eave line, overall spans 16'.
  const westPieces = auto.filter(dimension =>
    h.near(dimension.start.x, -11.5) && h.near(dimension.end.x, -11.5));
  expect(westPieces).toHaveLength(2);
  expect(westPieces.some(dimension =>
    h.near(dimension.start.z, 2) || h.near(dimension.end.z, 2))).toBe(true);

  // S side: facing string breaks at the notch corner x=2.
  const southPieces = auto.filter(dimension =>
    h.near(dimension.start.z, 9.5) && h.near(dimension.end.z, 9.5));
  expect(southPieces).toHaveLength(2);
  expect(southPieces.some(dimension =>
    h.near(dimension.start.x, 2) || h.near(dimension.end.x, 2))).toBe(true);

  // Re-running replaces the stack instead of doubling it.
  await runAutoDims(page);
  expect(roofAutoDims(await h.savedDrawing(page))).toHaveLength(12);
});

test('tagging the notch edge GABLE drops its eave line from the north string', async ({ page }) => {
  await h.openModel(page);
  await buildLRoof(page);

  // The x=2 vertical edge stops being an eave, so no truss bears on it.
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, 2, 5);
  await h.waitForSaved(page);
  const roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.edges.filter(edge => edge === 'gable')).toHaveLength(1);

  await runAutoDims(page);
  const auto = roofAutoDims(await h.savedDrawing(page));
  // N loses its middle string: just the overall at the first offset now.
  const north = auto.filter(dimension => dimension.start.z < -8 && dimension.end.z < -8);
  expect(north).toHaveLength(1);
  expect(h.near(north[0].start.z, -9.5)).toBe(true);
  expect(Math.abs(north[0].end.x - north[0].start.x)).toBeCloseTo(20, 5);
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
  // The generated rectangle roof (outline + overhang) strings 4 overalls.
  const auto = roofAutoDims(saved);
  expect(auto).toHaveLength(4);
  const minX = Math.min(...saved.roofs[0].points.map(point => point.x));
  const west = auto.find(dimension =>
    h.near(dimension.start.x, minX - 1.5) && h.near(dimension.end.x, minX - 1.5));
  expect(west).toBeTruthy();
});
