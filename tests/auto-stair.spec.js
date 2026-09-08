// AUTO-PLACE STAIRS (board #260): the tour's stair step and a BUILD HOUSE
// press with no stairs OFFER a rule-derived placement — riser math from
// the level heights, the run hugging the beam edge, folding when straight
// doesn't fit — as a SUGGESTION tagged auto:true, born legal (zero nudge),
// parked-not-built outside the tour (Q2b), stacked upstairs (Q4), widened
// per rule B, and declined for good by deleting it (Q6). The candidate
// geometry itself is pinned by the 27-check offline harness against
// auto-stair.js; these specs pin the commit layer. Tests opt back into
// suggestions (autoStairs: true) — the rest of the suite runs with them
// seeded off through the settings package.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// 2 STOREY: the first test climbs to the 2ND FLOOR on Enter, and since
// NEW-5 the stored type answers that climb (a BUNGALOW would go to the ROOF).
async function traceHouse(page, points) {
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

const RECT = [[-14, -12], [14, -12], [14, 12], [-14, 12]];
const L_PLAN = [[-15, -12], [15, -12], [15, -2], [3, -2], [3, 12], [-15, 12]];

const autoStairs = saved => saved.stairs.filter(stair => stair.auto);
const stairOpenings = saved => saved.surfaceOpenings.filter(opening => Number.isInteger(opening.stairId));

test('the tour stair step arrives pre-placed, born legal, and the bone cuts its opening un-nudged', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true });
  await traceHouse(page, L_PLAN);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
  await h.waitForSaved(page);

  let saved = await h.savedDrawing(page);
  const placed = autoStairs(saved);
  expect(placed).toHaveLength(1);
  expect(placed[0].levelId).toBe(3);
  const before = { x: placed[0].start.x, z: placed[0].start.z };

  // The suggestion satisfied the stair gate — Enter opens MAIN FLOOR DONE
  // (accept-by-default), and its primary climbs to the rooms step.
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click();
  await h.waitForSaved(page);

  // Mid-tour bone press: the build ends the tour and cuts the opening for
  // the suggested stair exactly where it was born — zero nudge.
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe(null);
  const stair = autoStairs(saved)[0];
  expect(stair.start.x).toBeCloseTo(before.x, 3);
  expect(stair.start.z).toBeCloseTo(before.z, 3);
  expect(stairOpenings(saved)).toHaveLength(1);
  expect(saved.walls.length).toBeGreaterThan(0);
});

test('the 2ND floor stair stacks over the suggestion below, 6" wider beside the exterior wall (rule B)', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true });
  // 14x16: no beam (14' span), the straight run cannot fit inside the
  // interior ring (the basement setback is the foundation wall plus its
  // insulation lining — ~1.2'), and the L folds into a ring corner —
  // wall-adjacent by construction.
  await traceHouse(page, [[-7, -8], [7, -8], [7, 8], [-7, 8]]);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click(); // → MAIN, L suggested
  await h.waitForSaved(page);

  let saved = await h.savedDrawing(page);
  expect(autoStairs(saved)).toHaveLength(1);
  expect(autoStairs(saved)[0].shape).toBe('L');
  expect(autoStairs(saved)[0].widthFt).toBeCloseTo(3, 5);

  await page.keyboard.press('Enter'); // gate lit → MAIN FLOOR DONE
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click(); // → rooms-main
  await page.keyboard.press('Enter'); // rooms gate is always lit → choice popup
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Enter'); // primary → 2ND FLOOR
  await h.waitForSaved(page);

  saved = await h.savedDrawing(page);
  const stairs = autoStairs(saved).sort((a, b) => a.levelId - b.levelId);
  expect(stairs).toHaveLength(2);
  expect(stairs[1].levelId).toBe(5);
  // Stacked: directly over the run below; rule B: the wall-adjacent
  // basement stair widens the flight above to 3'-6".
  expect(stairs[1].start.x).toBeCloseTo(stairs[0].start.x, 3);
  expect(stairs[1].start.z).toBeCloseTo(stairs[0].start.z, 3);
  expect(stairs[1].shape).toBe('L');
  expect(stairs[1].widthFt).toBeCloseTo(3.5, 5);
  expect(stairs[0].widthFt).toBeCloseTo(3, 5); // the basement flight keeps 3'-0"
});

// BOARD #315 / audit Q17 SUPERSEDED Q2(b), and this test was rewritten
// rather than adjusted. It used to pin the park: press once for a
// suggestion, press again to build. Q17 says a bone press never stalls, so
// the behaviour it pinned is gone and the test now pins what replaced it.
// Rewriting a test because the RULING changed is not editing to pass; the
// difference is that the old assertions were deleted outright instead of
// loosened until they went green.
test('outside the tour ONE press places the stairs and builds (Q17)', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true });
  await traceHouse(page, RECT);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape'); // leave the tour — no stairs placed
  await h.waitForSaved(page);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  // ONE press: the stairs are there AND the house is up AND the openings
  // are cut where those stairs stand. Any one of these missing is the
  // stall Q17 forbids.
  expect(autoStairs(saved).length, 'the bone must place the stairs it found missing').toBeGreaterThan(0);
  expect(saved.walls.length, 'and build in the SAME press — no park').toBeGreaterThan(0);
  expect(stairOpenings(saved).length).toBe(autoStairs(saved).length);

  // And it says what it filled, in the build summary rather than as a
  // warning: informative, never a stall.
  await expect(page.locator('[data-model-drawing-message]')).toContainText('stairs placed');
});

// THE OTHER HALF OF Q17, and the reason the declined-suggestion memory
// could not simply be deleted. "Every house always gets 1 interior stair
// set floor-to-floor — the rule, not an option" means deleting the stairs
// and pressing again PLACES THEM AGAIN. The old Q6 reading — deleting is
// "no thanks", the next press builds stairless — survives only inside the
// tour, where it is pinned separately below.
test('deleting the stairs and pressing again places them again (Q17)', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true });
  await traceHouse(page, RECT);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const placed = autoStairs(await h.savedDrawing(page)).length;
  expect(placed, 'the first press must place stairs, or the delete below proves nothing')
    .toBeGreaterThan(0);

  // REMOVE LAST STAIR works on the ACTIVE level, so clear them floor by
  // floor. Deleting an auto stair used to set the decline memory; outside
  // the tour that memory no longer speaks.
  for (const level of ['2ND FL', 'MAIN FL']) {
    await page.locator('.level-name', { hasText: level }).click();
    await page.waitForTimeout(300);
    await h.selectTool(page, 'Stair');
    await page.getByRole('button', { name: 'REMOVE LAST STAIR' }).click();
    await h.waitForSaved(page);
  }
  expect(autoStairs(await h.savedDrawing(page))).toHaveLength(0);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(autoStairs(saved).length, 'the set is the rule, not an option — it comes back')
    .toBeGreaterThan(0);
  expect(saved.walls.length).toBeGreaterThan(0);
});

// suggestStairs === false IS THE DOOR OUT, and it is the only one. Q17 is a
// ruling about SILENCE — "drafter silence means you pick" — so a drafter who
// turned suggestions off in Settings has spoken, and the bone builds the
// house they asked for: no stairs, no argument, no stall.
test('suggestStairs off still builds stairless in one press (Q17 is about silence)', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true });
  await page.evaluate(() => {
    const manager = window.DraftProfileManager;
    manager.saveActive(manager.createPackage('settings', 'test-settings', {
      model: { suggestStairs: false },
    }));
  });
  await page.reload();
  await h.waitForModelReady(page);

  await traceHouse(page, RECT);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(autoStairs(saved), 'the setting is speech, and the bone listens').toHaveLength(0);
  expect(saved.walls.length, 'and it still builds in one press').toBeGreaterThan(0);
});

test('an ENTRY stamp near the front wall wins the entry L, and the stacked stair mirrors it (rule A)', async ({ page }) => {
  // Suggestions stay OFF for the setup — the stamps get placed the
  // hand-drafter way first, and the toggle flips on for the finale.
  await h.openModel(page, { tourEscort: true });
  await page.evaluate(() => {
    const manager = window.DraftProfileManager;
    manager.saveActive(manager.createPackage('standards', 'entry-tray', {
      model: { roomTray: ['ENTRY', 'KITCHEN', 'LIVING', 'BEDROOM', 'BATH', 'HALL'] },
    }));
  });
  await page.reload();
  await h.waitForModelReady(page);

  await traceHouse(page, RECT);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click(); // → MAIN (no suggestion — off)
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 2, -2);
  await h.clickWorld(page, 2, 4);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter'); // gate → MAIN FLOOR DONE
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click(); // → rooms-main
  await expect(page.locator('[data-room-tray]')).toBeVisible();
  await page.locator('[data-tray-chip]').filter({ hasText: /^ENTRY$/ }).click();
  await h.clickWorld(page, 0, 10.5); // the front-entry zone, near the south wall
  await h.waitForSaved(page);
  // Escape leaves the tour only from a popup — open the rooms-main choice
  // popup first, then Escape out of the tour entirely.
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tour-popup]')).toBeHidden();
  await h.waitForSaved(page);
  await h.selectTool(page, 'Stair');
  await page.getByRole('button', { name: 'REMOVE LAST STAIR' }).click(); // hand stair — no decline
  await h.waitForSaved(page);

  // Flip suggestions ON and reopen: a session with stamps and no stairs.
  await page.evaluate(() => {
    const manager = window.DraftProfileManager;
    manager.saveActive(manager.createPackage('settings', 'test-settings', {
      model: { suggestStairs: true },
    }));
  });
  await page.reload();
  await h.waitForModelReady(page);

  await page.locator('[data-build-house]').click(); // Q17: places AND builds
  await expect(page.locator('[data-model-drawing-message]')).toContainText('stairs placed');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const main = autoStairs(saved).find(item => item.levelId === 3);
  expect(main).toBeTruthy();
  expect(main.shape).toBe('L');
  expect(main.splitTreads).toBe(2); // the fewest entry steps that fit
  // First run: 2 treads toward the front wall — start to end spans 20".
  const firstRun = Math.hypot(main.end.x - main.start.x, main.end.z - main.start.z);
  expect(firstRun).toBeCloseTo(2 * 10 / 12, 2);
  expect(main.end.z).toBeGreaterThan(main.start.z); // descending toward z=+12
  expect(main.end.z).toBeGreaterThan(7); // the landing tucked at the front wall

  // The stacked 2ND stair mirrors the entry L: the LONG top leg over the
  // long leg below, the short flight landing at the entry — splitTreads
  // flips to treads − landing − 2, and the turn reverses.
  const upper = autoStairs(saved).find(item => item.levelId === 5);
  expect(upper).toBeTruthy();
  expect(upper.shape).toBe('L');
  expect(upper.splitTreads).toBe(upper.risers - 1 - 1 - 2);
  expect(upper.turn).not.toBe(main.turn);
});
