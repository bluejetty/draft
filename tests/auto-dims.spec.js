// AUTO DIMS strings the exterior of the active plan on all four sides:
// the closest string dims corner-to-corner through the fenestration centres
// facing each side, the next string dims every footprint jog, and the
// outermost string is the overall. The first string offset is adjustable
// (1'-6" or 3'-0") and every further string steps out 1'-6". Re-running
// replaces the previous auto strings; manual dimensions are left alone.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// House: 16×12 rect (x -8..8, z -6..6).
async function drawHouseOutline(page) {
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

async function switchLevel(page, name) {
  await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
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

async function runAutoDims(page) {
  await h.selectTool(page, 'Dimension');
  await page.getByRole('button', { name: 'AUTO DIMS' }).click();
  await h.waitForSaved(page);
}

test('AUTO DIMS strings a rectangle: overalls everywhere, openings on the door side', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  // Door centred on the z=-6 wall.
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, -6);
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  // BUILD HOUSE lays its own stack on every level; this test watches the
  // active MAIN FL plan the AUTO DIMS button just restrung.
  const auto = saved.dimensions.filter(dimension =>
    dimension.auto && dimension.levelId === 3 && dimension.view === 'plan');
  // Rectangle: 3 plain sides get 1 overall each; the door side gets a
  // 2-piece openings string plus its overall.
  expect(auto).toHaveLength(6);

  // Openings string sits at the first offset (1'-6") off the door side and
  // breaks at the door centre.
  const openingString = auto.filter(dimension =>
    h.near(dimension.start.z, -7.5) && h.near(dimension.end.z, -7.5));
  expect(openingString).toHaveLength(2);
  const centreEnds = openingString
    .flatMap(dimension => [dimension.start.x, dimension.end.x])
    .filter(x => Math.abs(x) < 1);
  expect(centreEnds).toHaveLength(2);
  // That side's overall steps out one string spacing further.
  const overall = auto.find(dimension =>
    h.near(dimension.start.z, -9) && h.near(dimension.end.z, -9));
  expect(overall).toBeTruthy();
  expect(Math.abs(overall.end.x - overall.start.x)).toBeCloseTo(16, 3);
});

test('an L-shape gets jog strings and overalls on every side', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 0);
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 0, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  // Per side: a 2-piece jog string (3 distinct coords) + the overall.
  expect(auto).toHaveLength(12);
  // Jog strings sit at the first offset, overalls one spacing further out.
  const north = auto.filter(dimension => dimension.start.z < -6.5);
  expect(north).toHaveLength(3);
  const northOverall = north.find(dimension => h.near(dimension.start.z, -9));
  expect(Math.abs(northOverall.end.x - northOverall.start.x)).toBeCloseTo(16, 3);
});

test('auto strings ride master outline edits, staying outside the moved plan', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await runAutoDims(page);

  // Slide the whole footprint by dragging every master corner the same 4' east
  // on the BONEYARD — the auto strings must ride along, never left inside.
  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, -6, 12, -6);
  await dragWorld(page, 8, 6, 12, 6);
  await dragWorld(page, -8, -6, -4, -6);
  await dragWorld(page, -8, 6, -4, 6);

  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto && dimension.levelId === 3);
  expect(auto).toHaveLength(4);
  // Every string end carries its master link and rode the 4' slide.
  auto.forEach(dimension => {
    expect(dimension.start.srcId).toBeTruthy();
    expect(dimension.end.srcId).toBeTruthy();
  });
  // Mouse drops land within a pixel of the target, so compare loosely.
  const east = auto.find(dimension => dimension.start.x > 9);
  expect(east.start.x).toBeCloseTo(13.5, 0);
  const west = auto.find(dimension => dimension.start.x < -5);
  expect(west.start.x).toBeCloseTo(-5.5, 0);
  const north = auto.find(dimension => dimension.start.z < -7);
  expect(north.start.x).toBeCloseTo(-4, 0);
  expect(north.end.x).toBeCloseTo(12, 0);

  // The links survive a reload: a further master edit still carries them.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 12, -6, 12, -10);
  const reloaded = await h.savedDrawing(page);
  const northAfter = reloaded.dimensions.filter(dimension =>
    dimension.auto && dimension.levelId === 3).find(dimension => dimension.end.z < -10.5);
  expect(northAfter).toBeTruthy();
  expect(northAfter.end.z).toBeCloseTo(-11.5, 0);
});

test('the house strings hug the house edge; the garage dims its own stack', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  // Attached garage protruding east: open run from (8,-4) out to x=14 and back.
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  await h.clickWorld(page, 8, -4);
  await h.clickWorld(page, 14, -4);
  await h.clickWorld(page, 14, 4);
  await h.clickWorld(page, 8, 4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  const vertical = auto.filter(dimension => h.near(dimension.start.x, dimension.end.x, 0.01));
  // The house's east strings sit off the HOUSE edge (x=8), not out past the
  // garage: the closest east string is at 8+1'-6" = 9.5.
  const houseEast = vertical.filter(dimension => dimension.start.x > 8.5 && dimension.start.x < 12);
  expect(houseEast.length).toBeGreaterThan(0);
  expect(Math.min(...houseEast.map(dimension => dimension.start.x))).toBeCloseTo(9.5, 1);
  // The garage gets its own east overall off its own far edge (14+1.5 = 15.5).
  const garageEast = vertical.filter(dimension => dimension.start.x > 15);
  expect(garageEast.length).toBeGreaterThan(0);
  expect(Math.min(...garageEast.map(dimension => dimension.start.x))).toBeCloseTo(15.5, 1);
  // The garage's buried west side (against the house) gets no string of its
  // own — nothing lands at 8-1.5 = 6.5, inside the plan.
  expect(vertical.some(dimension => Math.abs(dimension.start.x - 6.5) < 0.5)).toBe(false);
  // Flush against the house is a shared edge, not an overlap: the garage
  // keeps its north overall at -4-1.5 = -5.5, out in the open beside the house.
  const horizontal = auto.filter(dimension => h.near(dimension.start.z, dimension.end.z, 0.01));
  const garageNorth = horizontal.find(dimension =>
    h.near(dimension.start.z, -5.5, 0.3) && Math.min(dimension.start.x, dimension.end.x) > 7);
  expect(garageNorth).toBeTruthy();
});

test('an inch-scale jog strings straight: merged into the neighbouring corner', async ({ page }) => {
  await h.openModel(page);
  // T off for the deliberately off-square corner: north-east dips 0'-1¼" low.
  await h.selectTool(page, 'Outline');
  await page.keyboard.press('t');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6.1);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  // The 0.1' jog merges away: one overall per side, no tiny jog strings.
  expect(auto).toHaveLength(4);
  const north = auto.find(dimension => dimension.start.z < -7);
  expect(Math.abs(north.end.x - north.start.x)).toBeCloseTo(16, 1);
  // The first string still clears the LOWEST part of the skewed wall by 1'-6".
  expect(north.start.z).toBeLessThanOrEqual(-6.1 - 1.5 + 0.05);
});

test('re-running replaces auto strings, keeps manual dims, honours the 3\'-0" offset', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  // One manual dimension inside the plan.
  await h.selectTool(page, 'Dimension');
  await h.clickWorld(page, -4, 0);
  await h.clickWorld(page, 4, 0);
  await h.waitForSaved(page);

  await runAutoDims(page);
  let saved = await h.savedDrawing(page);
  expect(saved.dimensions.filter(dimension => dimension.auto)).toHaveLength(4);
  expect(saved.dimensions.filter(dimension => !dimension.auto)).toHaveLength(1);

  // Switch the first offset to 3'-0" and re-run: same count, strings move out.
  await page.getByRole('button', { name: '3\'-0"' }).click();
  await runAutoDims(page);
  saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  expect(auto).toHaveLength(4);
  expect(saved.dimensions.filter(dimension => !dimension.auto)).toHaveLength(1);
  const west = auto.find(dimension => dimension.start.x < -8.5);
  expect(west.start.x).toBeCloseTo(-11, 3);
});
