// The entry-L stacking sweep (promoted by the audit cross-review).
//
// `_buildStackedStair`'s splitTreads branch is the most intricate geometry in
// the recent boards: over an entry L the whole frame FLIPS — the upper stair's
// long top leg rides over the LONG leg below, its landing overlays the landing
// below, the short 2-3 step flight lands at the entry floor, and the turn
// reverses. It shipped with exactly one spec, which checked `splitTreads` and
// `turn` and nothing about where the stair actually IS. Two stairs can carry
// the right field values and still not sit over one another, and a stair drawn
// wrong prints wrong.
//
// So this file tests the CLAIM the stacking is for: headroom. The landing
// above must sit over the landing below, and the run above must cross the run
// below at a right angle — checked from the stored geometry, in both turn
// directions (the ENTRY stamp's end of the front wall picks the turn, and
// each case asserts which turn it got, so the coverage cannot silently
// collapse back to one direction), and on a house where the mirrored run may
// not fit at all (there the contract is that the app says so and falls back
// to a legal stair, rather than drawing one that hangs outside the building).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The landing the app lays out: 36" clear plus the nosing/drywall allowance,
// never narrower than the stair itself.
const LANDING_CLEAR_FT = 3 + (11 - 10 + 0.5) / 12;
const landFt = widthFt => Math.max(LANDING_CLEAR_FT, widthFt);

// Where a turned stair's landing sits, rebuilt from what was stored: the first
// leg's direction and length, then half a landing along it and half a landing
// across it toward the turn. Same construction the app lays the landing out
// with, so agreement here means the two stairs really are stacked.
function landingCentre(stair) {
  const dx = stair.end.x - stair.start.x;
  const dz = stair.end.z - stair.start.z;
  const run1 = Math.hypot(dx, dz);
  const d = { x: dx / run1, z: dz / run1 };
  const s = stair.turn === 'right' ? 1 : -1;
  const perp = { x: -d.z * s, z: d.x * s };
  const L = landFt(stair.widthFt);
  return {
    x: stair.start.x + d.x * (run1 + L / 2) + perp.x * (-stair.widthFt / 2 + L / 2),
    z: stair.start.z + d.z * (run1 + L / 2) + perp.z * (-stair.widthFt / 2 + L / 2),
    d,
    run1,
  };
}

const autoStairs = saved => saved.stairs.filter(stair => stair.auto);

// Even-odd ray cast: is the point inside the outline ring? The stacking
// branch mirrors a run across the plan, so "inside the building" has to mean
// the polygon, not its bounding box — on an L plan the notch is inside the
// box and outside the walls.
const insideRing = (poly, pt) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if ((a.z > pt.z) !== (b.z > pt.z)
      && pt.x < a.x + (b.x - a.x) * (pt.z - a.z) / (b.z - a.z)) hit = !hit;
  }
  return hit;
};

// Both stairs stand inside the building: start, end, and landing centre of
// each, ray-cast against the level's outline ring.
function expectStairsInside(saved, stairs) {
  const outline = saved.outlines.find(item => item.levelId === 5 && item.points.length >= 3)
    || saved.outlines.find(item => item.points.length >= 3);
  stairs.forEach(stair => {
    const centre = landingCentre(stair);
    [stair.start, stair.end, { x: centre.x, z: centre.z }].forEach(point => {
      expect(insideRing(outline.points, point),
        `(${point.x.toFixed(2)}, ${point.z.toFixed(2)}) inside the outline`).toBe(true);
    });
  });
}

async function traceHouse(page, points) {
  await page.locator('[data-select-build="bungalow"]').click();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// One drafter's session that ends in an entry L with a floor above it:
// stamps placed by hand with suggestions OFF, then suggestions ON and the
// bone pressed — the same path the shipped entry-L spec walks, with the house
// and the stair's side of the plan as parameters.
async function entryLSession(page, { house, stair, entryAt }) {
  // The escort is parked (Movie, 2 Sep) and this session CLIMBS it -- it waits
  // on [data-tour-popup] to step FOUNDATION -> MAIN. So it opts in, like every
  // other tour-driving spec, rather than losing the coverage.
  await h.openModel(page, { tourEscort: true });
  await page.evaluate(() => {
    const manager = window.DraftProfileManager;
    manager.saveActive(manager.createPackage('standards', 'entry-tray', {
      model: { roomTray: ['ENTRY', 'KITCHEN', 'LIVING', 'BEDROOM', 'BATH', 'HALL'] },
    }));
  });
  await page.reload();
  await h.waitForModelReady(page);

  await traceHouse(page, house);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click(); // → MAIN
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, stair[0][0], stair[0][1]);
  await h.clickWorld(page, stair[1][0], stair[1][1]);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter'); // gate → MAIN FLOOR DONE
  await page.locator('[data-tour-popup]').click(); // → rooms-main
  await expect(page.locator('[data-room-tray]')).toBeVisible();
  await page.locator('[data-tray-chip]').filter({ hasText: /^ENTRY$/ }).click();
  await h.clickWorld(page, entryAt[0], entryAt[1]);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);
  await h.selectTool(page, 'Stair');
  await page.getByRole('button', { name: 'REMOVE LAST STAIR' }).click();
  await h.waitForSaved(page);

  await page.evaluate(() => {
    const manager = window.DraftProfileManager;
    manager.saveActive(manager.createPackage('settings', 'test-settings', {
      model: { suggestStairs: true },
    }));
  });
  await page.reload();
  await h.waitForModelReady(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  return page.locator('[data-model-drawing-message]').textContent();
}

// The invariants a stacked entry L must satisfy, whichever way it turns.
function expectStackedOverEntryL(main, upper) {
  expect(main.shape).toBe('L');
  expect(upper.shape).toBe('L');
  // The frame flips: the short flight below becomes the long leg above.
  expect(upper.splitTreads).toBeGreaterThan(main.splitTreads);
  expect(upper.turn).not.toBe(main.turn);

  const below = landingCentre(main);
  const above = landingCentre(upper);
  // THE POINT OF STACKING: one landing over the other. Half a foot is well
  // inside a 3' landing and far outside "the geometry is fine, the fields
  // just happen to match".
  expect(Math.hypot(above.x - below.x, above.z - below.z)).toBeLessThan(0.5);
  // And the runs cross at a right angle — the upper long leg riding back over
  // the long leg below, not doubling along the short one.
  expect(Math.abs(above.d.x * below.d.x + above.d.z * below.d.z)).toBeLessThan(0.02);
  // The upper leg really is the long one: more treads than the short flight.
  expect(above.run1).toBeGreaterThan(below.run1);
}

// A rectangle deep enough for the mirrored long leg to fit, front wall at
// z = +12. The ENTRY stamp is what makes the L an ENTRY L, and its end of
// the front wall is what picks the turn: the landing slides along the wall
// toward the stamp's projection, and the main flight runs from the landing
// toward the roomier side — so a stamp near the right end turns the stair
// right, and one near the left end turns it left. Each case asserts the
// turn it was built to get, so both branches of landingCentre's
// `turn === 'right'` sign really run.
const DEEP = [[-14, -12], [14, -12], [14, 12], [-14, 12]];

test('an entry near the right end of the front wall turns right, and stacks', async ({ page }) => {
  await entryLSession(page, { house: DEEP, stair: [[2, -2], [2, 4]], entryAt: [10, 10.5] });
  const saved = await h.savedDrawing(page);
  const main = autoStairs(saved).find(stair => stair.levelId === 3);
  const upper = autoStairs(saved).find(stair => stair.levelId === 5);
  expect(main, 'MAIN got an auto stair').toBeTruthy();
  expect(upper, '2ND got an auto stair').toBeTruthy();
  expect(main.turn).toBe('right');
  expectStackedOverEntryL(main, upper);
});

test('an entry near the left end of the front wall turns left, and stacks', async ({ page }) => {
  // The genuinely mirrored case: the OTHER turn, not just the other side of
  // the plan — main.turn differs from the case above, so a sign error in
  // landingCentre cannot hide by applying the same wrong sign to both files.
  await entryLSession(page, { house: DEEP, stair: [[-2, -2], [-2, 4]], entryAt: [-10, 10.5] });
  const saved = await h.savedDrawing(page);
  const main = autoStairs(saved).find(stair => stair.levelId === 3);
  const upper = autoStairs(saved).find(stair => stair.levelId === 5);
  expect(main).toBeTruthy();
  expect(upper).toBeTruthy();
  expect(main.turn).toBe('left');
  expectStackedOverEntryL(main, upper);
});

test('a shallower house stacks too, and neither stair lands outside the building', async ({ page }) => {
  // 28 x 16, with the stair pushed close to the front wall. The mirror turns a
  // 2-step flight into a ten-step one running the other way across the plan —
  // eight feet of run plus a landing that did not have to go anywhere before —
  // so this is where it would hang out through a wall if the flip were wrong.
  //
  // It does not: at this size the stack still succeeds. The branch where it
  // CANNOT is written for below, but is not reached from here — see the note
  // in the PR: forcing it wants a genuinely smaller upper floor, which means a
  // per-level outline edit, and BUILD HOUSE may regenerate that from the
  // BONEYARD master. That case is unproven, not covered.
  const shallow = [[-14, -8], [14, -8], [14, 8], [-14, 8]];
  const note = await entryLSession(page, {
    house: shallow, stair: [[2, -2], [2, 2]], entryAt: [0, 6.5],
  });
  const saved = await h.savedDrawing(page);
  const main = autoStairs(saved).find(stair => stair.levelId === 3);
  const upper = autoStairs(saved).find(stair => stair.levelId === 5);
  expect(main).toBeTruthy();
  expect(upper, 'the floor above still gets a stair either way').toBeTruthy();

  if (main.shape === 'L' && Number.isInteger(main.splitTreads) && upper.splitTreads > main.splitTreads) {
    expectStackedOverEntryL(main, upper);
  } else {
    // The fallback: the app says the stack could not be made, in the same
    // breath as the stair it placed instead. Both wordings are verified
    // against the source (MODEL.dc.html's _suggestStairForLevel), not
    // guessed — this branch has never executed, so the strings being real
    // is all that separates an untested assertion from a wrong one.
    expect(note).toMatch(/could not stack over the run below|no legal stair position/i);
  }

  // Whatever it placed, both stairs stand inside the building. The stacking
  // branch mirrors a run across the plan; landing that outside the walls is
  // the failure this sweep exists to catch.
  expectStairsInside(saved, [main, upper]);
});

test('an L-shaped house: the stack stays out of the notch', async ({ page }) => {
  // The plan where the bounding box would lie: the notch (the missing
  // quadrant) is inside the box and outside the walls. The front wing is
  // kept wide enough (18') that the entry L is still the pick, and the
  // mirrored upper run rides back across the plan toward the notch — if the
  // stack lands in it, the ray cast says so where a box check would stay
  // green.
  const ell = [[-14, -12], [14, -12], [14, 12], [-4, 12], [-4, 4], [-14, 4]];
  const note = await entryLSession(page, {
    house: ell, stair: [[2, -2], [2, 4]], entryAt: [5, 10.5],
  });
  const saved = await h.savedDrawing(page);
  const main = autoStairs(saved).find(stair => stair.levelId === 3);
  const upper = autoStairs(saved).find(stair => stair.levelId === 5);
  expect(main).toBeTruthy();
  expect(upper, 'the floor above still gets a stair either way').toBeTruthy();

  if (main.shape === 'L' && Number.isInteger(main.splitTreads) && upper.splitTreads > main.splitTreads) {
    expectStackedOverEntryL(main, upper);
  } else {
    expect(note).toMatch(/could not stack over the run below|no legal stair position/i);
  }

  expectStairsInside(saved, [main, upper]);
});
