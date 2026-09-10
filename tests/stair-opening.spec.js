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
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');
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
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');
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
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();

  // Both surfaces measurable: the computed rough opening is announced.
  await expect(page.getByText(/Rough opening 3'-1"/)).toBeVisible();

  // First click keys the interior face, second picks the run direction.
  await h.clickWorld(page, -8, 0.3);
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
  // Runs from the anchor click toward the second click's direction. The anchor
  // is x=-8 because the measured opening is 10'-5" and the floor ends at x=10:
  // from x=2 it would hang 2'-5" over open air, which the tool now refuses and
  // which "an opening that runs past the floor is refused" keeps pinned.
  expect(Math.min(...xs)).toBeCloseTo(-8, 3);
});

test('an opening that runs past the floor is refused, with the length named', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await drawFloor(page);
  await drawFoundationSlab(page);
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();
  await expect(page.getByText(/Rough opening 3'-1"/)).toBeVisible();

  // THE OLD PLACEMENT, kept on purpose. The measured opening is 10'-5" and the
  // floor's right edge is x=10, so anchoring at x=2 and running right puts the
  // far end at x=12.4167 -- 2'-5" of hole over open air. Three specs used to
  // pin this arrangement and pass, because the tool only ever asked whether the
  // opening's CENTRE was on the floor, and at x=7.2 the centre comfortably is.
  await h.clickWorld(page, 2, 0.3);
  await page.waitForTimeout(300);
  await h.clickWorld(page, 8, 2);
  await page.waitForTimeout(300);

  // Refused, and the message names the measured length so the drafter knows how
  // much room to find rather than guessing at what "does not fit" means.
  //
  // THE ASSERTION IS PHRASED TO EXCLUDE SUCCESS, and it had to be rewritten to
  // manage it. The first version asked for "10'-5"" and /past|room|fit/i, and
  // BOTH passed against the unguarded page: the success line is
  //   Stair opening cut on A-FL-OPNG - 3'-1" x 10'-5" (... clears 6'-10" headroom ...)
  // so "10'-5"" matched its length and /room/ matched "headROOM". Two refusal
  // assertions satisfied by a successful cut -- only the opening count below
  // was doing any work. So: a phrase success cannot contain, AND an explicit
  // absence of the phrase success always contains.
  await expect(page.locator('[data-model-drawing-message]')).toContainText('runs off the floor');
  await expect(page.locator('[data-model-drawing-message]')).toContainText("10'-5\"");
  await expect(page.locator('[data-model-drawing-message]')).not.toContainText('Stair opening cut');

  // Nothing cut. The refusal is the whole point: an opening deducted from a
  // floor it hangs off is silent and always in the applicant's favour.
  const drawing = await h.savedDrawing(page);
  expect(drawing.surfaceOpenings || []).toHaveLength(0);
});

test('an opening flush with the floor edge is still cut', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await drawFloor(page);
  await drawFoundationSlab(page);
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();
  await expect(page.getByText(/Rough opening 3'-1"/)).toBeVisible();

  // ON THE BOUNDARY COUNTS AS INSIDE, and it has to be the EAST edge to prove
  // it. A stairwell run flush to an exterior wall is on the slab; refusing it
  // would force back the sliver of floor this design exists to make
  // unnecessary. Nothing else in this file touches an edge at all.
  //
  // WHAT THIS CASE DOES AND DOES NOT PROVE, measured rather than assumed.
  //
  // It proves a flush opening survives the REAL CLICK PATH -- tool, wall pick,
  // rectangle, guard, commit, save. It does NOT pin the boundary rule itself,
  // and two attempts to make it do so both failed for instructive reasons.
  // Anchored at the WEST edge, the boundary-exclusive mutant survived:
  // ringInsideRing casts its ray rightward, so a point on the west edge still
  // crosses the east wall and reads inside with the boundary rule switched
  // off. Moved to the EAST edge it survived too, because a click cannot land
  // exactly on a boundary -- pixel-to-world conversion puts the corner a
  // fraction inside, where the ray-cast answers and the boundary rule is never
  // consulted.
  //
  // So the primitive is pinned where it CAN be pinned exactly, by harnesses
  // that construct polygons directly: proto/ring-inside-harness.js and
  // proto/areas-harness.js both go red under that mutant. This spec proves the
  // wiring; those prove the rule. Do not "fix" this by loosening the assertion
  // until the mutant dies here -- that would only hide which half is covering
  // what.
  //
  // The opening is 10'-5" and runs right from the anchor, so anchoring at
  // 10 - LENGTH puts its far edge exactly on the floor's east edge, x=10.
  const flushAnchor = 10 - LENGTH_IN / 12;
  await h.clickWorld(page, flushAnchor, 0.3);
  await page.waitForTimeout(300);
  await h.clickWorld(page, flushAnchor + 4, 2);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.surfaceOpenings).toHaveLength(1);
  const xs = drawing.surfaceOpenings[0].points.map(p => p.x);
  expect(Math.max(...xs)).toBeCloseTo(10, 3);
});

test('typed stair width and headroom resize the opening', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await drawFloor(page);
  await drawFoundationSlab(page);
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();
  await page.getByLabel('Stair width').fill('42"');
  await page.getByLabel('Stair width').blur();
  await page.getByLabel('Stair headroom').fill(`7'`);
  await page.getByLabel('Stair headroom').blur();

  // 42" + 1" finish = 3'-7" opening width.
  await expect(page.getByText(/Rough opening 3'-7"/)).toBeVisible();

  await h.clickWorld(page, -8, 0.3);
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
  await switchLayerView(page, 'FLOOR LAYOUT (FLOOR)');

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'STAIRS', exact: true }).click();
  await h.clickWorld(page, -8, 0.3);
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
