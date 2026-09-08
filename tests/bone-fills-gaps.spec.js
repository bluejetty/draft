// BOARD #315 — THE BONE FILLS THE GAPS (audit Q17, 29 Aug).
//
//   "A bone press never stalls or warns on missing input. STAIRS — every
//    house always gets 1 interior stair set floor-to-floor (the rule, not
//    an option). ROOMS — no room stamps, deal a random valid room program
//    by the rules. Drafter silence means you pick."
//
// Bare outline + one bone press = complete house. These specs pin that
// property end to end, and the boundaries around it: what SILENCE means,
// and what counts as the drafter having spoken instead.
//
// The stair half's own edge cases live in auto-stair.spec.js. This file
// owns the whole-house property and the room deal.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const RECT = [[-14, -12], [14, -12], [14, 12], [-14, 12]];

// A BARE OUTLINE AND NOTHING ELSE: trace it, leave the tour, press once.
// The escape is what makes it bare — the tour would place stairs and stamps
// itself, and then the bone would have no gaps to fill.
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

const stamps = saved => (saved.roomTags || []).filter(tag => tag.stamped && tag.base);
const dealt = saved => stamps(saved).filter(tag => tag.auto === true);
const manual = saved => stamps(saved).filter(tag => tag.auto !== true);

test('bare outline + ONE press = a complete house', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true, autoWindows: true });
  await bareOutline(page);

  const before = await h.savedDrawing(page);
  // THE FIXTURE IS REALLY BARE, asserted before it is trusted. Every check
  // below is "the bone produced X"; if the tour had already produced X the
  // whole file would pass while the bone did nothing.
  expect(before.walls || [], 'the fixture must start with no walls').toHaveLength(0);
  expect(before.stairs || [], 'and no stairs').toHaveLength(0);
  expect(stamps(before), 'and no room stamps').toHaveLength(0);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  // One press, everything. Named individually so a failure says WHICH gap
  // went unfilled rather than "a count changed".
  expect(saved.walls.length, 'walls').toBeGreaterThan(0);
  expect((saved.floors || []).length, 'floors').toBeGreaterThan(0);
  expect((saved.roofs || []).length, 'roof').toBeGreaterThan(0);
  expect((saved.stairs || []).length, 'stairs — the bone places them, Q17').toBeGreaterThan(0);
  expect((saved.surfaceOpenings || []).filter(o => Number.isInteger(o.stairId)).length,
    'the stair opening cut for them').toBeGreaterThan(0);
  expect(dealt(saved).length, 'rooms dealt — the bone deals them, Q17').toBeGreaterThan(0);
  expect((saved.fenestrations || []).length, 'windows').toBeGreaterThan(0);
  expect((saved.dimensions || []).length, 'auto dims').toBeGreaterThan(0);

  // NO STALL, NO WARNING — and the summary says what was filled.
  const message = page.locator('[data-model-drawing-message]');
  await expect(message).toContainText('House built from the outline');
  await expect(message).toContainText('stairs placed');
  await expect(message).toContainText('dealt (house default)');
});

test('the dealt rooms grow into real interior walls, in the same press', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true, autoWindows: true });
  await bareOutline(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  // The deal has to land BEFORE the grower runs or the stamps are just
  // labels. Interior walls are the proof the order of operations held.
  // A grown interior wall is an auto 2x4 on the plan -- the shape
  // _growStampedRooms pushes. Exterior walls are 2x6 and not auto.
  const interior = saved.walls.filter(wall => wall.auto === true && wall.wallType === 'stud_2x4');
  expect(dealt(saved).length, 'stamps to grow from').toBeGreaterThan(0);
  expect(interior.length, 'interior walls grown from the dealt program').toBeGreaterThan(0);
});

test('a single drafter stamp is speech: that floor is left alone', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true, autoWindows: true });
  // The room tray lives in the tour's rooms step, which is also the honest
  // way a drafter stamps a floor. Climb to it, stamp MAIN, and leave 2ND
  // untouched -- so one drawing carries both cases at once.
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter');
  for (const [x, z] of RECT) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await page.locator('[data-tour-popup]').click();          // FOUNDATION → MAIN
  await h.waitForSaved(page);
  await page.keyboard.press('Enter');                        // MAIN gate
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click();           // → rooms-main
  await expect(page.locator('[data-room-tray]')).toBeVisible();
  await page.locator('[data-tray-chip]').filter({ hasText: /^KITCHEN$/ }).click();
  await h.clickWorld(page, -4, -4);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');                       // out of the tour
  await h.waitForSaved(page);

  const before = await h.savedDrawing(page);
  const mine = manual(before);
  expect(mine.length, 'the fixture needs the drafter stamp it is about').toBe(1);
  const spokenFor = mine[0].levelId;
  const at = { x: mine[0].at.x, z: mine[0].at.z, name: mine[0].name };

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  // NEVER TOUCHED: same count, same place, same name, still not auto.
  const after = manual(saved);
  expect(after.length).toBe(1);
  expect(after[0].at.x).toBeCloseTo(at.x, 6);
  expect(after[0].at.z).toBeCloseTo(at.z, 6);
  expect(after[0].name).toBe(at.name);
  expect(after[0].auto).not.toBe(true);

  // NOTHING DEALT ON THAT FLOOR.
  expect(dealt(saved).filter(tag => tag.levelId === spokenFor),
    'the bone must not deal onto a floor the drafter stamped').toHaveLength(0);

  // AND THE COMPANION THAT MAKES IT MEAN SOMETHING: the OTHER floor stayed
  // silent, so it must have been dealt. Without this, a deal that never ran
  // at all would pass the check above.
  expect(dealt(saved).filter(tag => tag.levelId !== spokenFor).length,
    'the silent floor must still be dealt, or the check above proves nothing')
    .toBeGreaterThan(0);
});

test('the deal is deterministic: the same drawing deals the same program', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true, autoWindows: true });
  await bareOutline(page);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const first = dealt(await h.savedDrawing(page))
    .map(tag => `${tag.levelId}:${tag.base}@${tag.at.x.toFixed(3)},${tag.at.z.toFixed(3)}`).sort();
  expect(first.length, 'a deal to compare').toBeGreaterThan(0);

  // Undo the whole build — one press, one history entry — and press again.
  await page.keyboard.press('Control+z');
  await h.waitForSaved(page);
  const undone = await h.savedDrawing(page);
  expect(stamps(undone), 'the undo must really clear the deal, or the re-press is a no-op')
    .toHaveLength(0);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const second = dealt(await h.savedDrawing(page))
    .map(tag => `${tag.levelId}:${tag.base}@${tag.at.x.toFixed(3)},${tag.at.z.toFixed(3)}`).sort();

  // "Random valid" never means unreproducible.
  expect(second).toEqual(first);
});
