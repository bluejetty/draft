// The ROOM TRAY (board #198): per-floor rooms steps in the guided tour —
// tap a chip, tap the plan, and the stamp lands. Bedrooms number from the
// first stamp and bring their companions (ENSUITE + WALK-IN for the
// floor's first, a CLOSET for each later one); every stamp is draggable,
// renamable, and deletable ever after; stamps survive ROOM TAGS re-runs
// and NAME the rooms they sit in; the bone writes the room counts into
// the PROJECT info. Stamping is optional — the gate is always lit.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function traceHouse(page, w, d) {
  await page.locator('[data-select-house]').click();
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
  await page.keyboard.press('Enter'); // the lit gate opens MAIN FLOOR DONE
  await page.locator('[data-tour-popup]').click(); // single popup → rooms-main
  await expect(page.locator('[data-room-tray]')).toBeVisible();
}

async function stamp(page, chip, x, z) {
  await page.locator('[data-tray-chip]').filter({ hasText: new RegExp(`^${chip}$`) }).click();
  await h.clickWorld(page, x, z);
  await h.waitForSaved(page);
}

async function clickTag(page, x, z) {
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, x, z);
  await expect(page.locator('[data-tag-editor-input]')).toBeVisible();
}

const stamps = saved => saved.roomTags.filter(tag => tag.stamped);
const names = saved => saved.roomTags.map(tag => tag.name).sort();

test('the tray stamps on a chip-tap/plan-tap pair, disarms, and the step can skip straight to the roof', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 16, 12);

  await stamp(page, 'KITCHEN', 0, 0);
  let saved = await h.savedDrawing(page);
  expect(stamps(saved)).toHaveLength(1);
  expect(stamps(saved)[0].name).toBe('KITCHEN'); // bare while it's alone
  expect(stamps(saved)[0].base).toBe('KITCHEN');

  // The chip disarmed on placement — a stray plan tap stamps nothing.
  // (Select first: the stair tool is still armed from the climb, and its
  // first click would otherwise start a run and hold the Enter gate.)
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 3, 3);
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(stamps(saved)).toHaveLength(1);

  // MAIN ROOMS DONE carries the one-storey fork: straight to the ROOF.
  await page.keyboard.press('Enter');
  await page.locator('[data-tour-popup] [data-tour-next-roof]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe('roof');
});

test('bedrooms number from the first stamp, companions ride along, and deletes renumber + cascade', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 24, 18);

  await stamp(page, 'BEDROOM', -6, 0);
  let saved = await h.savedDrawing(page);
  expect(names(saved)).toEqual(['BEDROOM 1', 'ENSUITE', 'WALK-IN']);
  const companions = stamps(saved).filter(tag => tag.companionOf != null);
  expect(companions).toHaveLength(2);

  await stamp(page, 'BEDROOM', 0, 0);
  await stamp(page, 'BEDROOM', 6, 0);
  saved = await h.savedDrawing(page);
  expect(names(saved)).toEqual([
    'BEDROOM 1', 'BEDROOM 2', 'BEDROOM 3',
    'CLOSET 1', 'CLOSET 2', 'ENSUITE', 'WALK-IN',
  ]);

  // Deleting BEDROOM 2 (empty text commits the delete) renumbers the third
  // bedroom down and takes the still-attached CLOSET with it — the lone
  // survivor closet drops back to its bare name.
  await clickTag(page, 0, 0);
  await page.locator('[data-tag-editor-input]').fill('');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(names(saved)).toEqual(['BEDROOM 1', 'BEDROOM 2', 'CLOSET', 'ENSUITE', 'WALK-IN']);
});

test('renames leave the numbering pool, drags claim companions, and everything survives a reload', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 24, 18);

  await stamp(page, 'BATH', -6, -4);
  await stamp(page, 'BATH', 0, -4);
  await clickTag(page, -6, -4); // BATH 1 → a custom name, forever
  await page.locator('[data-tag-editor-input]').fill('POWDER ROOM');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  let saved = await h.savedDrawing(page);
  expect(names(saved)).toEqual(['BATH', 'POWDER ROOM']); // the survivor renumbers bare
  expect(stamps(saved).find(tag => tag.name === 'POWDER ROOM').base).toBeUndefined();

  await page.reload();
  await h.waitForModelReady(page);
  saved = await h.savedDrawing(page);
  expect(names(saved)).toEqual(['BATH', 'POWDER ROOM']);
  expect(stamps(saved)).toHaveLength(2);
  await expect(page.locator('[data-room-tray]')).toBeVisible(); // the step resumed

  // A dragged companion is claimed and outlives its bedroom; the attached
  // one dies with it.
  await stamp(page, 'BEDROOM', 6, 2);
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, 6, 4.2); // the ENSUITE companion
  const to = await h.worldToClient(page, 10, 6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  const ensuite = stamps(saved).find(tag => tag.name === 'ENSUITE');
  expect(ensuite.companionOf).toBeUndefined();

  await clickTag(page, 6, 2); // delete BEDROOM 1
  await page.locator('[data-tag-editor-input]').fill('');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(names(saved)).toEqual(['BATH', 'ENSUITE', 'POWDER ROOM']); // WALK-IN went with its bedroom
});

test('a stamp names the room it sits in, grades UNDER MIN, and offsets the detector numbering', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 24, 18);

  // Two enclosed PLAN rooms inside the outline: a small 8x8 (under the 97
  // sq ft bedroom minimum) and an 8x10 with a closet run voting bedroom.
  const wall = async (x1, z1, x2, z2) => {
    await h.selectTool(page, 'Wall');
    await h.clickWorld(page, x1, z1);
    await h.clickWorld(page, x2, z2);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
  };
  await wall(-10, -7, -2, -7); await wall(-2, -7, -2, 1);
  await wall(-2, 1, -10, 1); await wall(-10, 1, -10, -7);
  await wall(2, -7, 10, -7); await wall(10, -7, 10, 3);
  await wall(10, 3, 2, 3); await wall(2, 3, 2, -7);
  await page.locator('[data-model-left]').getByRole('button', { name: /\bFixture\b/i }).click();
  // The fixture kind by its tooltip — the tray's CLOSET chip shares the name.
  await page.getByTitle(/Closet — two clicks/).click();
  await h.clickWorld(page, 4, -6);
  await h.clickWorld(page, 8, -6);
  await h.waitForSaved(page);

  await stamp(page, 'BEDROOM', -6, -3); // inside the small room

  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const bedroom1 = saved.roomTags.find(tag => tag.name === 'BEDROOM 1');
  expect(bedroom1.stamped).toBe(true);          // the stamp IS the room's tag
  expect(bedroom1.areaSqFt).toBeGreaterThan(50); // it absorbed the room's area
  expect(bedroom1.underMin).toBe(true);          // 8x8 fails the 97 sq ft row
  expect(saved.roomTags.some(tag => tag.name === 'ROOM' && tag.at.x < 0)).toBe(false);
  // The detector's own bedroom numbers PAST the stamp — no name collision.
  expect(saved.roomTags.some(tag => /^BED(ROOM|RM) 2$/.test(tag.name) && !tag.stamped)).toBe(true);
});

test('a mid-step bone press builds, ends the tour, and stamps the room counts into the project info', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 16, 12);

  await stamp(page, 'BEDROOM', -3, 0); // brings ENSUITE + WALK-IN
  await stamp(page, 'BATH', 4, 0);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe(null);
  expect(saved.walls.length).toBeGreaterThan(0);
  expect(saved.projectInfo.bedrooms).toBe(1);
  expect(saved.projectInfo.bathrooms).toBe(2); // BATH + the ENSUITE companion
});
