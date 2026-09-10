// BUILD HOUSE refuses a stair opening that does not fit the floor, and SAYS SO.
//
// The opening is deducted arithmetically from the level's floor area, so a
// hole hanging over open air is charged to a floor that never had it and
// nothing downstream disagrees — the error is silent and always in the
// applicant's favour. _buildStairOpenings therefore tests the WHOLE footprint
// against the floor ring, and a stair it cannot cut rides back on the result
// as a named refusal rather than a skip: nobody is watching one stair during
// BUILD HOUSE, so a skip with no trace is what makes a run unexplainable.
//
// WHY A U-PLAN HOUSE, and not something simpler. Placement already checks the
// opening's four CORNERS against the outline's inset ring
// (_stairFitsInsideWalls), and BUILD HOUSE generates the floor as a copy of
// the outline — measured, not assumed: on a plain rectangle the saved floor
// polygon is identical to the outline's. So on any CONVEX house, corners
// inside means the whole opening is inside, and this branch is unreachable.
// It needs a floor a rectangle can straddle: a re-entrant notch narrow enough
// that the opening's long edge crosses its mouth while every corner stays on
// solid floor. A U-plan house with a recessed courtyard is exactly that shape,
// and a stair run across the back of the recess is exactly where a drafter
// would put one.
//
// An L will NOT do it, and the reason is worth keeping. A quadrant of missing
// floor that overlaps an axis-aligned rectangle always swallows one of its
// corners, so placement refuses first and this code never runs. Rotating the
// stair to beat that fails too: plan stairs snap orthogonal, so the diagonal
// run drawn for the attempt came back axis-aligned and 81" nudged.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function usePlanContext(page, level = 'MAIN FL') {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: 'PLAN' }).first().click();
}

// A 20x16 house with a 3'-wide courtyard cut into the north wall, its mouth at
// z = 1.5. The notch is narrower than the opening is long, which is the whole
// point: the opening's north edge can cross it with both north corners still
// on floor.
async function drawCourtyardOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -10, -8);
  await h.clickWorld(page, 10, -8);
  await h.clickWorld(page, 10, 8);
  await h.clickWorld(page, 1.5, 8);
  await h.clickWorld(page, 1.5, 1.5);
  await h.clickWorld(page, -1.5, 1.5);
  await h.clickWorld(page, -1.5, 8);
  await h.clickWorld(page, -10, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function placeStair(page, z) {
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, -5, z);
  await h.clickWorld(page, 5, z);
  await page.waitForTimeout(300);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

test('BUILD HOUSE refuses an opening that crosses the courtyard, and names the level', async ({ page }) => {
  await h.openModel(page);
  await drawCourtyardOutline(page);
  await usePlanContext(page);

  // Centreline at z = 0.5: the opening is 3'-1" wide, so its north edge lands
  // at z = 2.04 and crosses the notch mouth at z = 1.5. Both north corners sit
  // at x = -5.04 and x = 5.38, well outside the notch's 3' width, so placement
  // accepts the stair and the auto-fit leaves it where it was drawn.
  await placeStair(page, 0.5);
  await buildHouse(page);

  const message = page.locator('[data-model-drawing-message]');
  // PHRASED TO EXCLUDE SUCCESS. A cut opening reports "1 stair opening" in the
  // same summary, so "stair opening" alone is satisfied by both worlds; "NOT
  // cut" is a phrase success cannot produce, and the level name is what makes
  // the report worth having on a house with stairs on several levels.
  await expect(message).toContainText('1 stair opening NOT cut');
  await expect(message).toContainText('MAIN FL: the opening runs off the floor');

  const saved = await h.savedDrawing(page);
  // BOTH HALVES, because "no openings" on its own is satisfied by a house
  // where the stair itself was refused at placement — which is a different
  // defect with its own spec. The stair is here; only its hole was refused.
  expect(saved.stairs || []).toHaveLength(1);
  expect(saved.surfaceOpenings || []).toHaveLength(0);
});

test('the same house cuts the opening once the run clears the courtyard', async ({ page }) => {
  await h.openModel(page);
  await drawCourtyardOutline(page);
  await usePlanContext(page);

  // The control: same concave floor, same stair, moved south so the whole
  // footprint is on floor. Without this, a guard that refused every non-convex
  // floor — or refused every stair — would pass the case above.
  await placeStair(page, -4);
  await buildHouse(page);

  const message = page.locator('[data-model-drawing-message]');
  await expect(message).toContainText('1 stair opening');
  await expect(message).not.toContainText('NOT cut');

  const saved = await h.savedDrawing(page);
  expect(saved.stairs || []).toHaveLength(1);
  expect(saved.surfaceOpenings || []).toHaveLength(1);
  expect(saved.surfaceOpenings[0].stairId).toBe(saved.stairs[0].id);
});
