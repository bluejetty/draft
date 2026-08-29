// ROOM GROWING (boards #275/#276): stamps project dashed boundary claims
// and BUILD HOUSE grows real 2x4 interior walls from the stamp program —
// both gated behind the roomGrow setting (specs opt in; the suite runs
// with it seeded off). The #276 numbering rules — house-wide BEDROOM/WC
// ladders, the one BEDROOM 1 primary, claimed numbers, the basement
// B-series, the live WC fixture suffix — are RULES and run ungated. The
// partition and numbering math is pinned by the 29-check offline harness
// against room-grow.js; these specs pin the commit layer.
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
  await page.keyboard.press('Enter');
  await page.locator('[data-tour-popup]').click(); // → rooms-main
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

const names = saved => saved.roomTags.map(tag => tag.name).sort();
const grownWalls = saved => saved.walls.filter(wall => wall.auto && wall.wallType === 'stud_2x4');

test('stamps project dashed boundary claims — preview only, nothing saved until the bone', async ({ page }) => {
  await h.openModel(page, { roomGrow: true });
  await reachRoomsMain(page, 24, 18);
  await stamp(page, 'KITCHEN', -7, -5);
  await stamp(page, 'BEDROOM', 7, 5);

  // The dashed claims paint on the overlay in the preview blue (or the
  // flag red) — probe a grid across the plan for either.
  let hits = 0;
  for (const [x, z] of [[-7, -5], [7, 5], [0, -5], [0, 5], [-7, 5], [7, -5]]) {
    const pt = await h.worldToClient(page, x, z);
    const pixels = await h.overlayPixels(page, pt.x, pt.y, 60);
    hits += h.countColor(pixels, [89, 128, 166]) + h.countColor(pixels, [176, 64, 80]);
  }
  expect(hits).toBeGreaterThan(0);

  // Preview only: no interior walls exist until the bone.
  const saved = await h.savedDrawing(page);
  expect(grownWalls(saved)).toHaveLength(0);
});

test('the bone grows 2x4 interior walls from the stamp program and the rooms clear their minimums', async ({ page }) => {
  await h.openModel(page, { roomGrow: true });
  // 28x22: room for the four-stamp program at minimums beside the stair
  // well — a 26x20 genuinely cannot hold it, and the shrink-then-flag
  // path is the offline harness's case 7.
  await reachRoomsMain(page, 28, 22);
  await stamp(page, 'KITCHEN', -9, -7);
  await stamp(page, 'LIVING', 9, -7);
  await stamp(page, 'BEDROOM 1', -9, 7);
  await stamp(page, 'BATH', 9, 7);

  await page.locator('[data-build-house]').click(); // mid-step bone: build + grow
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe(null);
  const grown = grownWalls(saved);
  expect(grown.length).toBeGreaterThan(2);
  grown.forEach(wall => expect(wall.levelId).toBe(3));
  // Every stamped claim absorbed its area and cleared its minimums row.
  const roomStamps = saved.roomTags.filter(tag => tag.stamped && tag.base && tag.companionOf == null);
  roomStamps.forEach(tag => {
    expect(tag.areaSqFt).toBeGreaterThan(0);
    expect(tag.underMin).toBe(false);
  });
});

test('BEDROOM 1 demotes by rename and another room promotes — one primary at any instant', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 24, 18);
  await stamp(page, 'BEDROOM 1', -6, 0);
  await stamp(page, 'BEDROOM', 3, 0);
  let saved = await h.savedDrawing(page);
  expect(names(saved)).toContain('BEDROOM 1');
  expect(names(saved)).toContain('BEDROOM 2');

  // Demote: renaming the primary to an ordinary number keeps the family
  // and CLAIMS the number; the title falls vacant.
  await clickTag(page, -6, 0);
  await page.locator('[data-tag-editor-input]').fill('BEDROOM 4');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(names(saved)).not.toContain('BEDROOM 1');
  expect(names(saved)).toContain('BEDROOM 4');
  const demoted = saved.roomTags.find(tag => tag.name === 'BEDROOM 4');
  expect(demoted.base).toBe('BEDROOM');
  expect(demoted.claimedNo).toBe(4);

  // Promote: the other bedroom takes the vacant title.
  await clickTag(page, 3, 0);
  await page.locator('[data-tag-editor-input]').fill('BEDROOM 1');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(names(saved)).toContain('BEDROOM 1');
  expect(saved.roomTags.find(tag => tag.name === 'BEDROOM 1').base).toBe('BEDROOM 1');

  // And while it stands, a rename INTO the title is refused.
  await clickTag(page, -6, 0);
  await page.locator('[data-tag-editor-input]').fill('BEDROOM 1');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(names(saved).filter(name => name === 'BEDROOM 1')).toHaveLength(1);
  expect(names(saved)).toContain('BEDROOM 4'); // the demoted one kept its claim
});

test('BEDROOM and WC ladders run house-wide — the 2ND floor continues, never restarts', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 24, 18);
  await stamp(page, 'BEDROOM 1', -6, 0);
  await stamp(page, 'BEDROOM', 0, 0);
  await stamp(page, 'WC', 6, 0);

  await page.keyboard.press('Enter'); // rooms gate always lit → choice popup
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Enter'); // primary → 2ND FLOOR
  await placeStairs(page); // stacked in the opening
  await page.keyboard.press('Enter');
  await page.locator('[data-tour-popup]').click(); // → rooms-second
  await expect(page.locator('[data-room-tray]')).toBeVisible();
  await stamp(page, 'BEDROOM', 0, 4);
  await stamp(page, 'WC', 6, 4);

  const saved = await h.savedDrawing(page);
  const all = names(saved);
  expect(all).toContain('BEDROOM 2'); // MAIN
  expect(all).toContain('BEDROOM 3'); // 2ND — continues the ladder
  expect(all).toContain('WC 1');
  expect(all).toContain('WC 2');
  expect(all.filter(name => name === 'BEDROOM 1')).toHaveLength(1);
});

test('the WC number belongs to the room — fixtures never enter the stored name', async ({ page }) => {
  await h.openModel(page);
  await reachRoomsMain(page, 24, 18);
  // An enclosed room with a toilet: detection names it WC 1.
  const wall = async (x1, z1, x2, z2) => {
    await h.selectTool(page, 'Wall');
    await h.clickWorld(page, x1, z1);
    await h.clickWorld(page, x2, z2);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
  };
  await wall(-10, -7, -2, -7); await wall(-2, -7, -2, 1);
  await wall(-2, 1, -10, 1); await wall(-10, 1, -10, -7);
  await page.locator('[data-model-left]').getByRole('button', { name: /\bFixture\b/i }).click();
  await page.getByTitle(/Toilet/).click();
  await h.clickWorld(page, -6, -6.6);
  await h.waitForSaved(page);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  let saved = await h.savedDrawing(page);
  expect(names(saved)).toContain('WC 1');

  // A shower joins the room: the painted readout gains /S (mapping pinned
  // by the offline harness) but the STORED name never carries the suffix
  // and the number never moves.
  await page.locator('[data-model-left]').getByRole('button', { name: /\bFixture\b/i }).click();
  await page.getByTitle(/36" square shower/).click();
  await h.clickWorld(page, -8, -6.6);
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(names(saved)).toContain('WC 1');
  expect(saved.roomTags.every(tag => !/\//.test(tag.name))).toBe(true);
});
