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

  expect(grownWalls(saved), 'no interior partitions were grown from the program').toEqual([]);
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
