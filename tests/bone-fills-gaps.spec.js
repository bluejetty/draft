// BOARD #315 — THE BONE FILLS THE GAPS (audit Q17, 29 Aug), stair half.
//
//   "A bone press never stalls or warns on missing input. STAIRS — every
//    house always gets 1 interior stair set floor-to-floor (the rule, not
//    an option). If the drafter didn't place stairs, auto-place them
//    silently."
//
// Bare outline + one bone press = a house, no skipped-step messages. This
// file owns the whole-house property; the stair placement's own edge cases
// (stacking, widening, the entry L, the tour's step) stay in
// auto-stair.spec.js where they already live.
//
// THE ROOM HALF OF Q17 IS NOT HERE, and not because it was forgotten. It
// was built and it collided with board #275 — deleting every stamp and
// pressing the bone must SWEEP the grown partitions away, while an empty
// floor must be DEALT a program, and together they regrow the walls the
// drafter just removed. Movie's call was that the rooms can wait; the
// stall is the stair park, and it stands on its own.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const RECT = [[-14, -12], [14, -12], [14, 12], [-14, 12]];

// A BARE OUTLINE AND NOTHING ELSE: trace it, leave the tour, press once.
// The escape is what makes it bare — the tour would place the stairs
// itself, and then the bone would have no gap to fill.
async function bareOutline(page) {
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter');
  for (const [x, z] of RECT) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);
}

test('bare outline + ONE press = a house, stairs and all', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, autoWindows: true });
  await bareOutline(page);

  const before = await h.savedDrawing(page);
  // THE FIXTURE IS REALLY BARE, asserted before it is trusted. Every check
  // below is "the bone produced X"; if the tour had already produced X the
  // whole test would pass while the bone did nothing.
  expect(before.walls || [], 'the fixture must start with no walls').toHaveLength(0);
  expect(before.stairs || [], 'and no stairs — that is the gap under test').toHaveLength(0);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  // One press, everything. Named individually so a failure says WHICH gap
  // went unfilled rather than "a count changed".
  expect((saved.stairs || []).length, 'stairs — the bone places them, Q17').toBeGreaterThan(0);
  expect(saved.walls.length, 'walls — and it builds in the SAME press, no park').toBeGreaterThan(0);
  expect((saved.floors || []).length, 'floors').toBeGreaterThan(0);
  expect((saved.roofs || []).length, 'roof').toBeGreaterThan(0);
  expect((saved.surfaceOpenings || []).filter(o => Number.isInteger(o.stairId)).length,
    'the stair opening cut for them').toBeGreaterThan(0);
  expect((saved.fenestrations || []).length, 'windows').toBeGreaterThan(0);
  expect((saved.dimensions || []).length, 'auto dims').toBeGreaterThan(0);

  // NO STALL, NO WARNING — and the summary says what was filled.
  const message = page.locator('[data-model-drawing-message]');
  await expect(message).toContainText('House built from the outline');
  await expect(message).toContainText('stairs placed');
});

test('one press is ONE undo: the whole house goes back together', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, autoWindows: true });
  await bareOutline(page);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const built = await h.savedDrawing(page);
  expect(built.walls.length, 'a house to undo').toBeGreaterThan(0);
  expect((built.stairs || []).length, 'with the stairs the press filled in').toBeGreaterThan(0);

  // The press placed the stairs and then built. If the placement recorded
  // its own history entry, one ctrl-Z would peel the house off and leave
  // the stairs standing in the empty outline — a press that takes two
  // undos to reverse.
  await page.keyboard.press('Control+z');
  await h.waitForSaved(page);
  const undone = await h.savedDrawing(page);
  expect(undone.walls || [], 'the house is gone').toHaveLength(0);
  expect(undone.stairs || [], 'and so are the stairs it came with').toHaveLength(0);
});
