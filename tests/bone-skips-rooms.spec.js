// THE FIXTURE MUST BE ONE THAT WOULD GROW, AND POST-TOUR.
//
// Two false starts, both caught by companions rather than by reading:
//
//  1. The first draft traced an outline and pressed the bone with NO STAMPS
//     down, so nothing would have grown either way — and the mutation
//     (switching BONE_GROWS_ROOMS back on) sailed straight through it. A skip
//     test on a floor with nothing to skip proves nothing.
//  2. The second stamped through the tour's rooms pause and pressed there.
//     But the washroom deal holds itself mid-tour on purpose (the Q10 hold,
//     MODEL.dc.html — `_washroomStep`), so no washroom was ever due, and
//     Escape does not end the tour: measured, `tour.step` reads "rooms-main"
//     both before and after it.
//
// So: finish the outline, leave the escort, press the bone once to get the
// shell AND the dealt washroom, then put a stamp program down and press
// again. The second press is the one under test — it has everything a grow
// needs and must still grow nothing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const RECT = [[-14, -11], [14, -11], [14, 11], [-14, 11]];   // 28x22

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

// The same four-room program tests/room-grow.spec.js uses to prove partitions
// DO grow. Written straight into the saved drawing rather than through the
// tray, because the tray is a tour pause and this press must be post-tour.
async function stampProgram(page) {
  await page.evaluate(async () => {
    const file = await window.SharedFileStore.loadSharedFile('model-drawing');
    const saved = JSON.parse(await file.text());
    const at = (x, z) => ({ x, y: 0, z });
    let id = 9000;
    saved.roomTags = [...(saved.roomTags || []),
      { id: id++, at: at(-9, -7), levelId: 3, view: 'plan', name: 'KITCHEN', stamped: true, base: 'KITCHEN', layer: 'ROOM-IDS-AREA' },
      { id: id++, at: at(9, -7), levelId: 3, view: 'plan', name: 'LIVING', stamped: true, base: 'LIVING', layer: 'ROOM-IDS-AREA' },
      { id: id++, at: at(-9, 7), levelId: 3, view: 'plan', name: 'BEDROOM 1', stamped: true, base: 'BEDROOM 1', layer: 'ROOM-IDS-AREA' },
      { id: id++, at: at(9, 7), levelId: 3, view: 'plan', name: 'BATH', stamped: true, base: 'BATH', layer: 'ROOM-IDS-AREA' },
    ];
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), 'model-drawing');
  });
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
}

// A wall the BUILD owns and would regenerate: `auto` plus stud_2x4 is exactly
// what the grower marks its partitions with, and what must stop appearing.
const grownWalls = saved => (saved.walls || [])
  .filter(w => w.auto === true && w.wallType === 'stud_2x4');

const washrooms = saved => (saved.groups || []).filter(g => g.washroomLevelId != null);

async function builtAndStamped(page) {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await bareOutline(page);
  await page.locator('[data-build-house]').click();   // shell + the dealt washroom
  await h.waitForSaved(page);
  await stampProgram(page);
  await page.locator('[data-build-house]').click();   // the press under test
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('a bone press grows no partitions from a stamped program, and the washroom stands', async ({ page }) => {
  const saved = await builtAndStamped(page);

  // THE COMPANIONS CARRY THIS TEST. "No grown walls" is trivially true of a
  // press that built nothing, and equally true of a floor with no stamps —
  // the exact hole the first draft fell into.
  expect((saved.walls || []).length, 'the bone built a shell').toBeGreaterThan(0);
  const stamps = (saved.roomTags || []).filter(tag => tag.stamped && tag.base);
  expect(stamps.length, 'a stamp program was on the floor to be skipped').toBeGreaterThan(2);
  expect(washrooms(saved).length, 'and the washroom is there — it is not what gets skipped').toBeGreaterThan(0);
  // ONE PER SHELLED FLOOR, AND NO SECOND ONE ON A RE-PRESS. `> 0` above is
  // the old, loose half: it passes just as happily on a floor dealt three.
  // The press under test is the SECOND, so this is also the re-press guard --
  // _dealWashrooms skips a floor that already holds one, and a duplicate here
  // is that guard failing.
  const seats = washrooms(saved).map(g => g.washroomLevelId);
  expect(new Set(seats).size, 'a floor was dealt more than one washroom').toBe(seats.length);

  expect(grownWalls(saved), 'no interior partitions were grown from the program').toEqual([]);
});

// THE CONTRACT, NAMED RATHER THAN IMPLIED (board #331 redefined, 16 Sep).
//
// #331 began as a BYPASS -- the dealer "didn't work good, i need to fix it
// later" -- and the tests above pin the half that is an absence: no partitions
// grow. An absence is a weak thing to build on. What the bone actually
// promises now is a POSITIVE list, and until this test nothing said it:
// structure and stairs and one washroom per shelled floor, and nothing else
// inside.
//
// MEASURED, NOT ASSUMED. A bare-outline twoStorey press deals TWO washrooms --
// levels 3 and 5, one per floor the shell just went up on. "Exactly one WC"
// reads as one per house and is wrong; the rule is one per shelled floor, and
// an assertion written from the phrase rather than from the press would have
// pinned the wrong number.
//
// IT DOES NOT BOX OUT A LATER DEALER. Every assertion is about what the bone
// builds TODAY, at floor granularity. A dealer upgrade adds partitions and
// turns the `noPartitions` line red -- which is correct, because that IS the
// contract changing, and it should be a decision rather than a drift.
test('the bone builds structure, stairs and one washroom a floor — and nothing else inside',
  async ({ page }) => {
    await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
    await bareOutline(page);
    await page.locator('[data-build-house]').click();
    await h.waitForSaved(page);
    const saved = await h.savedDrawing(page);

    // STRUCTURE KEEPS GENERATING. Beams, columns and footings are BUILD
    // HOUSE's job and were never what #331 switched off.
    expect((saved.beams || []).length, 'the bone stopped generating beams').toBeGreaterThan(0);
    expect((saved.columns || []).length, 'the bone stopped generating columns').toBeGreaterThan(0);
    expect((saved.stairs || []).length, 'the bone stopped building stairs').toBeGreaterThan(0);

    // ONE WASHROOM A FLOOR, on the floors the shell just went up on.
    const seats = washrooms(saved).map(g => g.washroomLevelId);
    expect(seats.length, 'no washroom was dealt at all').toBeGreaterThan(0);
    expect(new Set(seats).size, 'a floor was dealt more than one washroom').toBe(seats.length);

    // NO "AND NOTHING ELSE INSIDE" LINE HERE, DELIBERATELY. It belongs to this
    // contract and it is the one claim this fixture cannot carry: a bare
    // outline has no stamp program, so nothing grows whether the grower is on
    // or off, and `grownWalls === []` would pass either way. Measured -- with
    // BONE_GROWS_ROOMS flipped true this test stayed green while the stamped
    // test above went red naming the partitions.
    //
    // That is false start #1 at the top of this file arriving again by a new
    // road: a skip test on a floor with nothing to skip proves nothing. The
    // absence half is carried by 'a bone press grows no partitions from a
    // stamped program', which puts a four-room program down first and has
    // teeth. This test carries the POSITIVE half -- what the bone does build.
  });

test('the build summary says nothing about rooms rather than lying about them', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await bareOutline(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await stampProgram(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  const message = page.locator('[data-model-drawing-message]');
  await expect(message).toContainText(/wall|stair|roof|window|washroom|dim/i);
  await expect(message).not.toContainText('grown from');
  await expect(message).not.toContainText('room stamp');
});
