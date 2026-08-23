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
