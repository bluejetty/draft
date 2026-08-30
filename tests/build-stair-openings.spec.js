// BUILD HOUSE cuts each placed stair's rough opening out of its floor: the
// hole follows the walking line down until the head clears the headroom
// under the floor, carrying half the 1" finish allowance on every side. The
// stair is rough intent, so it gets nudged first — one real wall assembly
// inside the exterior (the lowest floor adds the insulation wall lining the
// concrete) and at least 2" clear of the beams carrying the floor. A stair
// that already owns its opening keeps it untouched on a re-build.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function usePlanContext(page, level = 'MAIN FL') {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: 'PLAN' }).first().click();
}

async function useFloorContext(page, level = 'MAIN FL') {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: 'FLOOR LAYOUT' }).click();
}

async function drawOutlineRect(page, hx = 8, hz = 6) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -hx, -hz);
  await h.clickWorld(page, hx, -hz);
  await h.clickWorld(page, hx, hz);
  await h.clickWorld(page, -hx, hz);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

function bbox(points) {
  return {
    minX: Math.min(...points.map(p => p.x)),
    maxX: Math.max(...points.map(p => p.x)),
    minZ: Math.min(...points.map(p => p.z)),
    maxZ: Math.max(...points.map(p => p.z)),
  };
}

// MAIN FL descent: 11 7/8" joists + 3/4" sheathing over 8'-1 1/8" foundation
// walls minus the 3" slab = 14 risers at 7.625". The opening runs until
// 6'-10" headroom + the floor assembly clears: 94.625" / 7.625" = 12.41
// tread slots x 10" = 124.1" -> next inch is 125".
const OPEN_LEN_FT = 125 / 12;
const FINISH_FT = 1 / 24; // half the 1" finish allowance per side
const HALF_W = 1.5 + FINISH_FT;

test('BUILD HOUSE cuts the stair opening; a re-build keeps it', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await usePlanContext(page);

  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, -5, 0);
  await h.clickWorld(page, 5, 0);
  await h.waitForSaved(page);

  await buildHouse(page);
  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings).toHaveLength(1);
  const opening = saved.surfaceOpenings[0];
  expect(opening.hostType).toBe('floor');
  expect(opening.levelId).toBe(3);
  expect(opening.layer).toBe('A-FL-OPNG');
  expect(opening.stairId).toBe(saved.stairs[0].id);
  // Hosted on the MAIN FL framed floor.
  const floor = saved.floors.find(f => f.levelId === 3 && f.structure === 'floor');
  expect(opening.hostId).toBe(floor.id);
  // A straight run cuts a rectangle: headroom length + finish on every side.
  expect(opening.points).toHaveLength(4);
  const box = bbox(opening.points);
  expect(Math.abs(box.minX - (-5 - FINISH_FT))).toBeLessThan(0.02);
  expect(Math.abs(box.maxX - (-5 + OPEN_LEN_FT + FINISH_FT))).toBeLessThan(0.02);
  expect(Math.abs(box.minZ + HALF_W)).toBeLessThan(0.02);
  expect(Math.abs(box.maxZ - HALF_W)).toBeLessThan(0.02);
  // Nothing pushed the stair — it already sat legal.
  expect(Math.abs(saved.stairs[0].start.x - (-5))).toBeLessThan(0.02);
  expect(Math.abs(saved.stairs[0].start.z)).toBeLessThan(0.02);

  // A second BUILD HOUSE leaves the stair's opening alone.
  await buildHouse(page);
  const rebuilt = await h.savedDrawing(page);
  expect(rebuilt.surfaceOpenings).toHaveLength(1);
  expect(rebuilt.surfaceOpenings[0].id).toBe(opening.id);

  // The stair link survives a reload.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  const reloaded = await h.savedDrawing(page);
  expect(reloaded.surfaceOpenings).toHaveLength(1);
  expect(reloaded.surfaceOpenings[0].stairId).toBe(reloaded.stairs[0].id);
});

test('the opening pulls one real wall assembly inside the exterior', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await usePlanContext(page);

  // Pointed at the right wall: the run would land in the foundation wall +
  // insulation assembly (8" + 6.5" = 14.5"), so the stair slides back inside.
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 3, 0);
  await h.clickWorld(page, 8, 0);
  await h.waitForSaved(page);

  await buildHouse(page);
  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings).toHaveLength(1);
  const box = bbox(saved.surfaceOpenings[0].points);
  const limit = 8 - 14.5 / 12;
  expect(box.maxX).toBeLessThanOrEqual(limit + 0.005);
  expect(box.maxX).toBeGreaterThan(limit - 0.05);
  // The stair itself moved with its opening.
  const expectedStart = limit - 0.002 - FINISH_FT - OPEN_LEN_FT;
  expect(Math.abs(saved.stairs[0].start.x - expectedStart)).toBeLessThan(0.05);
});

test('the opening keeps 2" clear of the beams carrying the floor', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  // A beam on the MAIN FL FLOOR view crossing the stair's landing zone.
  await useFloorContext(page);
  await h.selectTool(page, 'Beam');
  await h.clickWorld(page, 5.5, -4);
  await h.clickWorld(page, 5.5, 4);
  await h.waitForSaved(page);

  await usePlanContext(page);
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, -5, 0);
  await h.clickWorld(page, 5, 0);
  await h.waitForSaved(page);

  await buildHouse(page);
  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings).toHaveLength(1);
  const box = bbox(saved.surfaceOpenings[0].points);
  // The bottom edge backed off to 2" shy of the beam centreline.
  const limit = 5.5 - 2 / 12;
  expect(box.maxX).toBeLessThanOrEqual(limit + 0.005);
  expect(box.maxX).toBeGreaterThan(limit - 0.05);
  expect(saved.stairs[0].start.x).toBeLessThan(-5.05);
  // The beam itself never moved.
  expect(Math.abs(saved.beams[0].start.x - 5.5)).toBeLessThan(0.001);
});

test('an L stair cuts an L-shaped well over its landing and second run', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page, 12, 10);
  await usePlanContext(page);

  await h.selectTool(page, 'Stair');
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await h.clickWorld(page, -4, -4);
  await h.clickWorld(page, 1, -4);
  await h.waitForSaved(page);

  await buildHouse(page);
  const saved = await h.savedDrawing(page);
  expect(saved.surfaceOpenings).toHaveLength(1);
  const opening = saved.surfaceOpenings[0];
  // First run (6 treads) + 3'-1 1/2" landing + the used stretch of run 2:
  // 12.41 slots - 6 treads - 1 landing = 5.41 -> 54.1" -> 55" down run 2.
  expect(opening.points).toHaveLength(10);
  const box = bbox(opening.points);
  const run1 = 5, land = 3.125, run2Cut = 55 / 12;
  expect(Math.abs(box.minX - (-4 - FINISH_FT))).toBeLessThan(0.02);
  expect(Math.abs(box.maxX - (-4 + run1 + land + FINISH_FT))).toBeLessThan(0.02);
  expect(Math.abs(box.minZ - (-4 - HALF_W))).toBeLessThan(0.02);
  // The turn side reaches across the landing and down the second run.
  expect(Math.abs(box.maxZ - (-4 - 1.5 + land + run2Cut + FINISH_FT))).toBeLessThan(0.02);
});
