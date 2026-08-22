// The straight STAIR tool places from the top landing: the first click sets
// the top nosing at the floor opening, the second only fixes the downhill
// direction — the run is laid out from the level heights (subfloor to
// subfloor; the lowest floor descends onto the basement slab). Handrail bars
// are stair metadata: one bar on a picked side (default left), both, or off.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const STAIR_STROKE = [93, 74, 138]; // #5d4a8a

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function usePlanContext(page, level = 'MAIN FL') {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: 'PLAN' }).first().click();
}

// Defaults: 11 7/8" joists + 3/4" sheathing, 8'-1 1/8" walls, 3" slab.
const FLOOR_IN = 11.875 + 0.75;
const WALL_IN = 8 * 12 + 1 + 1 / 8;
const MAIN_RISE_FT = (FLOOR_IN + WALL_IN - 3) / 12;   // down to the basement slab
const SECOND_RISE_FT = (WALL_IN + FLOOR_IN) / 12;      // down to the MAIN FL subfloor
const RISERS = 14;                                     // ceil(rise / 7.875") for both
const RUN_FT = (RISERS - 1) * 10 / 12;                 // treads at a 10" run

test('a MAIN FL stair runs from the top nosing down to the basement slab', async ({ page }) => {
  await h.openModel(page);
  await usePlanContext(page);

  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 5, 0); // downhill direction only — not the run length
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.stairs).toHaveLength(1);
  const stair = saved.stairs[0];
  expect(stair.layer).toBe('A-STR');
  expect(stair.levelId).toBe(3);
  expect(stair.view).toBe('plan');
  expect(stair.rail).toBe('left');
  expect(stair.risers).toBe(RISERS);
  expect(stair.treadRunIn).toBe(10);
  expect(Math.abs(stair.riseFt - MAIN_RISE_FT)).toBeLessThan(0.01);
  // The bottom nosing lands the full computed run away, not at the click.
  expect(Math.abs(stair.start.x - 0)).toBeLessThan(0.01);
  expect(Math.abs(stair.end.x - RUN_FT)).toBeLessThan(0.01);
  expect(Math.abs(stair.end.z)).toBeLessThan(0.01);

  // The plan drawing shows the stair in its layer colour.
  const mid = await h.worldToClient(page, RUN_FT / 2, 0);
  const pixels = await h.overlayPixels(page, mid.x, mid.y, 14);
  expect(h.countColor(pixels, STAIR_STROKE)).toBeGreaterThan(0);

  // The stair survives a reload.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  const reloaded = await h.savedDrawing(page);
  expect(reloaded.stairs).toHaveLength(1);
  expect(reloaded.stairs[0].risers).toBe(RISERS);
});

test('a 2ND FL stair rises the lower wall height plus its floor assembly', async ({ page }) => {
  await h.openModel(page);
  await usePlanContext(page, '2ND FL');

  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 0, 6); // downhill direction along +z
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.stairs).toHaveLength(1);
  const stair = saved.stairs[0];
  expect(stair.levelId).toBe(5);
  expect(Math.abs(stair.riseFt - SECOND_RISE_FT)).toBeLessThan(0.01);
  expect(stair.risers).toBe(RISERS);
  expect(Math.abs(stair.end.x)).toBeLessThan(0.01);
  expect(Math.abs(stair.end.z - RUN_FT)).toBeLessThan(0.01);
});

test('handrail bars: both sides or off, picked before placing', async ({ page }) => {
  await h.openModel(page);
  await usePlanContext(page);

  await h.selectTool(page, 'Stair');
  await page.getByRole('button', { name: '2 BARS', exact: true }).click();
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, -5, 0);
  await h.waitForSaved(page);

  await page.getByRole('button', { name: 'OFF', exact: true }).click();
  await h.clickWorld(page, 0, 5);
  await h.clickWorld(page, 5, 5);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.stairs).toHaveLength(2);
  expect(saved.stairs[0].rail).toBe('both');
  expect(saved.stairs[1].rail).toBe('none');
});

test('stairs only place in PLAN; FLOOR keeps the tool disabled', async ({ page }) => {
  await h.openModel(page);
  await levelRow(page, 'MAIN FL').locator('.level-body').click();
  await levelRow(page, 'MAIN FL').locator('.level-layer', { hasText: 'FLOOR' }).click();

  const stairButton = page.getByRole('button', { name: /\bStair\b/i }).first();
  await expect(stairButton).toBeDisabled();
});
