// ROOM GROWING review fixes (follow-up to boards #275/#276): the bone's
// regrow pass reconciles instead of piling up — stale grown walls sweep
// when their program leaves, walls the drafter touched are promoted and
// kept, a deleted partition edge stays declined on ITS floor only, and a
// typed (frozen) drag settles ownership by how it ends: Enter promotes,
// Escape puts everything back. The numbering and cache-key math is pinned
// by the offline harness (proto/room-grow-harness.js).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// THE TOUR IS PARKED for drafters (Movie, 2 Sep) but this file drives it:
// its setup helpers climb FOUNDATION -> MAIN -> rooms through the popup ladder,
// so every test here turns the escort back on. The code is switched off, not
// deleted, and a parked feature with no coverage is one flag from shipping with
// nothing watching it.

// 2 STOREY: the upstairs tests climb to the 2ND FLOOR on Enter at MAIN
// ROOMS DONE, and since NEW-5 the stored type answers that climb (a
// BUNGALOW goes to the ROOF instead).
async function traceHouse(page, w, d) {
  await page.locator('[data-select-build="twoStorey"]').click();
  await page.keyboard.press('Enter');
  await h.clickWorld(page, -w / 2, -d / 2);
  await h.clickWorld(page, w / 2, -d / 2);
  await h.clickWorld(page, w / 2, d / 2);
  await h.clickWorld(page, -w / 2, d / 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function placeStairs(page, x = 2, z = -2) {
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, x, z);
  await h.clickWorld(page, x, z + 6);
  await h.waitForSaved(page);
}

async function reachRoomsMain(page, w, d) {
  await traceHouse(page, w, d);
  await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
  await placeStairs(page);
  await page.keyboard.press('Enter');
  await page.locator('[data-tour-popup]').click(); // → rooms-main
  await expect(page.locator('[data-room-tray]')).toBeVisible();
}

async function stamp(page, chip, x, z) {
  await page.locator('[data-tray-chip]').filter({ hasText: new RegExp(`^${chip}$`) }).click();
  await h.clickWorld(page, x, z);
  await h.waitForSaved(page);
}

// Wall nodes outrank tag labels in the select hit test, so when a grown
// corner sits on the stamp point, step along the painted label until the
// editor answers.
async function clickTag(page, x, z) {
  const editor = page.locator('[data-tag-editor-input]');
  for (const dx of [0, 1.5, -1.5, 3]) {
    await h.selectTool(page, 'Select');
    await h.clickWorld(page, x + dx, z);
    if (await editor.isVisible().catch(() => false)) return;
    await page.waitForTimeout(300);
    if (await editor.isVisible().catch(() => false)) return;
  }
  await expect(editor).toBeVisible();
}

// Naming a stamp to nothing deletes it (with its attached companions).
async function deleteTagAt(page, x, z) {
  await clickTag(page, x, z);
  await page.locator('[data-tag-editor-input]').fill('');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// Press on a node and pull it, leaving the mouse button down for the caller.
async function startDrag(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(150); // the grab arms after the hold delay
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

const grownWalls = saved => saved.walls.filter(wall => wall.auto && wall.wallType === 'stud_2x4');

// The standard program: four stamps in the corners of a 28x22.
async function growFourRooms(page) {
  await reachRoomsMain(page, 28, 22);
  await stamp(page, 'KITCHEN', -9, -7);
  await stamp(page, 'LIVING', 9, -7);
  await stamp(page, 'BEDROOM 1', -9, 7);
  await stamp(page, 'BATH', 9, 7);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
}

test('deleting the stamps sweeps their grown walls on the next bone — no stale partitions', async ({ page }) => {
  await h.openModel(page, { tourEscort: true, roomGrow: true });
  await growFourRooms(page);
  let saved = await h.savedDrawing(page);
  expect(grownWalls(saved).length).toBeGreaterThan(2);

  // The program leaves: every stamp deleted (BEDROOM 1 takes any attached
  // companions with it), then the bone rebuilds.
  const tags = saved.roomTags.filter(tag => tag.stamped && tag.companionOf == null);
  for (const tag of tags) await deleteTagAt(page, tag.at.x, tag.at.z);
  saved = await h.savedDrawing(page);
  expect(saved.roomTags.filter(tag => tag.stamped)).toHaveLength(0);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(grownWalls(saved)).toHaveLength(0);
});

test('an ordinary drag promotes the grown wall, and the promoted wall survives the sweep', async ({ page }) => {
  await h.openModel(page, { tourEscort: true, roomGrow: true });
  await growFourRooms(page);
  let saved = await h.savedDrawing(page);
  const before = grownWalls(saved);
  expect(before.length).toBeGreaterThan(2);

  // Pull an interior endpoint of a grown wall a couple of feet: the drag
  // lands and the wall is the drafter's now.
  const target = before.find(wall => [wall.start, wall.end].some(pt =>
    Math.abs(pt.x) < 13.5 && Math.abs(pt.z) < 10.5));
  const grip = [target.start, target.end].find(pt => Math.abs(pt.x) < 13.5 && Math.abs(pt.z) < 10.5);
  await h.selectTool(page, 'Select');
  await startDrag(page, grip.x, grip.z, grip.x, grip.z + 2);
  await page.mouse.up();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  const promoted = saved.walls.filter(wall => !wall.auto && wall.wallType === 'stud_2x4');
  expect(promoted.length).toBeGreaterThan(0);

  // The program leaves and the bone sweeps — but only the still-auto walls.
  const tags = saved.roomTags.filter(tag => tag.stamped && tag.companionOf == null);
  for (const tag of tags) await deleteTagAt(page, tag.at.x, tag.at.z);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(grownWalls(saved)).toHaveLength(0);
  expect(saved.walls.filter(wall => !wall.auto && wall.wallType === 'stud_2x4').length)
    .toBeGreaterThanOrEqual(promoted.length);
});

test('a frozen drag keeps ownership through the preview; Escape restores wall and ownership', async ({ page }) => {
  await h.openModel(page, { tourEscort: true, roomGrow: true });
  await growFourRooms(page);
  let saved = await h.savedDrawing(page);
  const before = grownWalls(saved);
  const target = before.find(wall => [wall.start, wall.end].some(pt =>
    Math.abs(pt.x) < 13.5 && Math.abs(pt.z) < 10.5));
  const grip = [target.start, target.end].find(pt => Math.abs(pt.x) < 13.5 && Math.abs(pt.z) < 10.5);

  // Freeze the drag with R, type a distance (live preview), then Escape:
  // the node returns to where R found it, and the wall stays the machine's.
  await h.selectTool(page, 'Select');
  await startDrag(page, grip.x, grip.z, grip.x + 4, grip.z);
  await page.keyboard.press('r');
  await page.keyboard.type('3');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await h.waitForSaved(page);

  saved = await h.savedDrawing(page);
  const after = grownWalls(saved);
  const restored = after.find(wall => [wall.start, wall.end].some(pt =>
    h.near(pt.x, grip.x + 4, 0.3) && h.near(pt.z, grip.z, 0.3)));
  expect(restored).toBeTruthy();
  expect(restored.auto).toBe(true);
  expect(saved.walls.filter(wall => !wall.auto && wall.wallType === 'stud_2x4')).toHaveLength(0);
});

test('a frozen drag committed with Enter moves the endpoint and promotes the wall', async ({ page }) => {
  await h.openModel(page, { tourEscort: true, roomGrow: true });
  await growFourRooms(page);
  let saved = await h.savedDrawing(page);
  const before = grownWalls(saved);
  const target = before.find(wall => [wall.start, wall.end].some(pt =>
    Math.abs(pt.x) < 13.5 && Math.abs(pt.z) < 10.5));
  const grip = [target.start, target.end].find(pt => Math.abs(pt.x) < 13.5 && Math.abs(pt.z) < 10.5);

  await h.selectTool(page, 'Select');
  await startDrag(page, grip.x, grip.z, grip.x + 4, grip.z);
  await page.keyboard.press('r');
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await h.waitForSaved(page);

  saved = await h.savedDrawing(page);
  // The typed commit took the wall out of the machine's hands.
  const promoted = saved.walls.filter(wall => !wall.auto && wall.wallType === 'stud_2x4');
  expect(promoted.length).toBeGreaterThan(0);
  // And the endpoint really moved off its grown position.
  const stillThere = promoted.concat(grownWalls(saved)).some(wall =>
    [wall.start, wall.end].some(pt => h.near(pt.x, grip.x + 3, 0.2) && h.near(pt.z, grip.z, 0.2)));
  expect(stillThere).toBe(true);
});

test('a deleted partition edge stays declined on its floor, and the same edge grows upstairs', async ({ page }) => {
  await h.openModel(page, { tourEscort: true, roomGrow: true });
  await reachRoomsMain(page, 28, 22);
  await stamp(page, 'KITCHEN', -9, -7);
  await stamp(page, 'BEDROOM 1', 9, 7);

  await page.keyboard.press('Enter'); // rooms gate → MAIN ROOMS DONE
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Enter'); // a 2 STOREY climbs to the 2ND FLOOR, no choice asked (NEW-5)
  await placeStairs(page); // stacked in the opening
  await page.keyboard.press('Enter');
  await page.locator('[data-tour-popup]').click(); // → rooms-second
  await expect(page.locator('[data-room-tray]')).toBeVisible();
  // The same two-stamp program at the same coordinates: identical geometry.
  await stamp(page, 'BEDROOM', -9, -7);
  await stamp(page, 'WC', 9, 7);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  let saved = await h.savedDrawing(page);
  const mainWalls = grownWalls(saved).filter(wall => wall.levelId === 3);
  const upWalls = grownWalls(saved).filter(wall => wall.levelId === 5);
  expect(mainWalls.length).toBeGreaterThan(0);
  expect(upWalls.length).toBeGreaterThan(0);

  // Delete ONE grown wall on MAIN (by its midpoint, on the active level).
  const doomed = mainWalls[0];
  const mid = { x: (doomed.start.x + doomed.end.x) / 2, z: (doomed.start.z + doomed.end.z) / 2 };
  const edgeKey = wall => [wall.start, wall.end]
    .map(pt => `${Math.round(pt.x * 4) / 4},${Math.round(pt.z * 4) / 4}`).sort().join('|');
  const doomedKey = edgeKey(doomed);
  await h.openRails(page);
  await page.locator('.level-row').filter({ hasText: 'MAIN FL' }).first().click();
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, mid.x, mid.z);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  // Bone again: MAIN must not regrow the declined edge; the 2ND floor twin
  // at the SAME coordinates must still stand.
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  const mainAfter = grownWalls(saved).filter(wall => wall.levelId === 3);
  const upAfter = grownWalls(saved).filter(wall => wall.levelId === 5);
  expect(mainAfter.some(wall => edgeKey(wall) === doomedKey)).toBe(false);
  // The decline belongs to MAIN alone: the floor above regrows its whole
  // program, untouched by a deletion downstairs.
  expect(upAfter.map(edgeKey).sort()).toEqual(upWalls.map(edgeKey).sort());
});
