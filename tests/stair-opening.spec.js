// FENESTRATION · STAIRS cuts the measured rough opening a stair needs into
// the floor: width is the stair width plus a 1" total drywall finish
// allowance, length runs until the headroom (6'-10" default) clears under the
// floor assembly, rounded up to the next whole inch. The option is shaded out
// with a REQ message until both floor surfaces are measurable, and the
// opening keys to the interior face of the wall it is placed against.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function switchLayerView(page, label) {
  await page.locator('.level-row.active').getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

// A PLAN wall along z = 0 for the opening to key against.
async function drawWall(page) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// A 20×12 floor north of the wall on the active level's FLOOR layer set.
async function drawFloor(page) {
  await switchLayerView(page, 'FLOOR PLAN');
  await h.selectTool(page, 'Floor');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await h.clickWorld(page, 10, 12);
  await h.clickWorld(page, -10, 12);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// The FDN slab the lowest stair descends onto.
async function drawFoundationSlab(page) {
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await h.selectTool(page, 'Floor');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await h.clickWorld(page, 10, 12);
  await h.clickWorld(page, -10, 12);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await switchLevel(page, 'MAIN FL');
}

// Defaults: 11 7/8" joists + 3/4" sheathing, 8'-1 1/8" walls, 3" slab —
// riser count / height as the stair tool computes them for MAIN FL.
const FLOOR_IN = 11.875 + 0.75;
const WALL_IN = 8 * 12 + 1 + 1 / 8;
const RISE_IN = FLOOR_IN + WALL_IN - 3;
const RISERS = Math.ceil(RISE_IN / 7.875);
const RISER_IN = RISE_IN / RISERS;
// Length clears 6'-10" headroom + the floor assembly, up to the next inch.
const LENGTH_IN = Math.ceil((82 + FLOOR_IN) / RISER_IN * 10);
const WIDTH_IN = 36 + 1; // 3' stair + 1" total drywall finish
const WALL_IN_FACE_Z = 5.5 / 12; // 2×6 drawn refLine left: interior face north

test('STAIRS is a fenestration option, shaded with REQ until measurable', async ({ page }) => {
  await h.openModel(page);
  await switchLayerView(page, 'FLOOR PLAN');
  await h.selectTool(page, 'Fenestration');

  const stairsBtn = page.getByRole('button', { name: 'STAIRS', exact: true });
  await expect(stairsBtn).toBeVisible();
  await stairsBtn.click();

  // Nothing measurable yet: the REQ message names both missing surfaces.
  await expect(page.getByText('REQ MAIN FL, FDN SLAB')).toBeVisible();

  // Clicking the canvas refuses with the same requirement.
  await h.clickWorld(page, 0, 1);
  await expect(page.getByText(/REQ MAIN FL, FDN SLAB — the stair opening/)).toBeVisible();
});

test('the REQ message narrows to the one missing surface', async ({ page }) => {
  await h.openModel(page);
  await drawFloor(page);
  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();
  await expect(page.getByText('REQ FDN SLAB', { exact: true })).toBeVisible();
});

test('a stair opening cuts the measured rectangle keyed to the wall face', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await drawFloor(page);
  await drawFoundationSlab(page);
  await switchLayerView(page, 'FLOOR PLAN');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();

  // Both surfaces measurable: the computed rough opening is announced.
  await expect(page.getByText(/Rough opening 3'-1"/)).toBeVisible();

  // First click keys the interior face, second picks the run direction.
  await h.clickWorld(page, 2, 0.3);
  await page.waitForTimeout(300);
  await h.clickWorld(page, 8, 2);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.surfaceOpenings).toHaveLength(1);
  const opening = drawing.surfaceOpenings[0];
  expect(opening.hostType).toBe('floor');
  expect(opening.layer).toBe('A-FL-OPNG');
  expect(opening.levelId).toBe(3);
  expect(opening.points).toHaveLength(4);

  const xs = opening.points.map(p => p.x);
  const zs = opening.points.map(p => p.z);
  // Keyed to the interior face of the 2×6 wall, not its drawn line.
  expect(Math.min(...zs)).toBeCloseTo(WALL_IN_FACE_Z, 3);
  // Width: 3' stair + 1" finish. Length: headroom-clearing run, to the inch.
  expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(WIDTH_IN / 12, 3);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(LENGTH_IN / 12, 3);
  // Runs from the anchor click toward the second click's direction.
  expect(Math.min(...xs)).toBeCloseTo(2, 3);
});

test('typed stair width and headroom resize the opening', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await drawFloor(page);
  await drawFoundationSlab(page);
  await switchLayerView(page, 'FLOOR PLAN');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();
  await page.getByLabel('Stair width').fill('42"');
  await page.getByLabel('Stair width').blur();
  await page.getByLabel('Stair headroom').fill(`7'`);
  await page.getByLabel('Stair headroom').blur();

  // 42" + 1" finish = 3'-7" opening width.
  await expect(page.getByText(/Rough opening 3'-7"/)).toBeVisible();

  await h.clickWorld(page, 2, 0.3);
  await page.waitForTimeout(300);
  await h.clickWorld(page, 8, 2);
  await h.waitForSaved(page);

  const opening = (await h.savedDrawing(page)).surfaceOpenings[0];
  const xs = opening.points.map(p => p.x);
  const zs = opening.points.map(p => p.z);
  expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(43 / 12, 3);
  const length = Math.ceil((84 + FLOOR_IN) / RISER_IN * 10);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(length / 12, 3);
});

test('the stair opening survives a reload on its floor', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await drawFloor(page);
  await drawFoundationSlab(page);
  await switchLayerView(page, 'FLOOR PLAN');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();
  await h.clickWorld(page, 2, 0.3);
  await page.waitForTimeout(300);
  await h.clickWorld(page, 8, 2);
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.surfaceOpenings).toHaveLength(1);
  expect(drawing.surfaceOpenings[0].layer).toBe('A-FL-OPNG');
  const floor = drawing.floors.find(f => f.structure === 'floor');
  expect(drawing.surfaceOpenings[0].hostId).toBe(floor.id);
});
