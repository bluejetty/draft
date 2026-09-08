// UNDER MIN ink must follow the CURRENT minimums, not the ones in force when
// the drawing was last grown.
//
// THE DEFECT THESE PIN. A room tag persists the VERDICT (underMin) and one of
// its three inputs (areaSqFt). The other two -- the room's short side and its
// category -- were computed transiently at grow time and stored nowhere, so
// nothing could re-evaluate on load. evaluateRoom had exactly one caller on
// the page and it was the ROOM TAGS button. Change the office minimums in
// STANDARDS, reopen any drawing, and every flag -- shown AND hidden -- was
// whatever it was at the last grow.
//
// Kevin's rule is what the fix follows: files store FACTS, never findings.
// minDimensionFt and roomCategory are the missing facts; underMin stays only
// so drawings saved before them keep their answer.
//
// WHY A WC AND NOT A BARE ROOM. The first draft of this file used a plain
// room and could never have gone green: a bare room tags as ROOM, whose
// category has no row in the minimums table, and evaluateRoom returns ok for
// any category without one -- deliberately, so a flag never fires on a guess.
// It was red before the fix and red after, which is the most expensive kind
// of test: one that looks like it is pinning a defect and is pinning nothing.
// A toilet makes the room a WC, which the table does grade.
//
// AND THE KEYS ARE LOWERCASE. normaliseRoomMinimums walks the DEFAULT table's
// own ids (bedroom, kitchen, living, wc, laundry, dz) and reads stored[id],
// so a package keyed 'WC' is silently dropped and the defaults survive -- a
// tightening that does not tighten.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3;

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// A 20x12 house split by a partition — two rooms, both far over the WC
// minimums (18 sq ft, 3ft), so they start out passing.
async function drawTwoRoomHouse(page, partitionX = 2) {
  await drawWall(page, -10, -6, 10, -6);
  await drawWall(page, 10, -6, 10, 6);
  await drawWall(page, 10, 6, -10, 6);
  await drawWall(page, -10, 6, -10, -6);
  await drawWall(page, partitionX, -6, partitionX, 6);
}

async function placeFixtures(page, label, spots) {
  await page.locator('[data-model-left]').getByRole('button', { name: /\bFixture\b/i }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  for (const [x, z] of spots) {
    await h.clickWorld(page, x, z);
    await h.waitForSaved(page);
  }
}

async function runRoomTags(page) {
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
}

// Tighten the WC row past anything these rooms can satisfy.
async function tightenWcMinimums(page) {
  await page.evaluate(() => {
    const m = window.DraftProfileManager;
    m.saveActive(m.createPackage('standards', 'tight', {
      model: { roomMinimums: { wc: { minAreaSqFt: 100000, minDimensionFt: 500 } } },
    }));
  });
}

async function reopen(page) {
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  // The re-grade happens in memory; an areas toggle forces the re-save that
  // lets the verdict be read back out of storage.
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-areas]').click();
  await h.waitForSaved(page);
}

test('the two facts behind the verdict round-trip through a save', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page);
  await placeFixtures(page, 'TOILET', [[-4, -5.5], [6, -5.5]]);
  await runRoomTags(page);

  const tags = (await h.savedDrawing(page)).roomTags;
  expect(tags.length, 'the toilets grew two WC tags').toBe(2);
  tags.forEach(tag => {
    expect(tag.roomCategory, `${tag.name} stored the category it was graded under`).toBe('wc');
    expect(tag.minDimensionFt, `${tag.name} stored its short side`).toBeGreaterThan(0);
  });
});

test('UNDER MIN follows a minimums change across a reload, without pressing ROOM TAGS', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page);
  await placeFixtures(page, 'TOILET', [[-4, -5.5], [6, -5.5]]);
  await runRoomTags(page);

  // THE COMPANIONS. Without them this passes on a drawing that grew no tag
  // at all, or one already flagged before the change -- "nothing is flagged"
  // and "nothing exists" look identical from outside, and a flag that was
  // always on proves no re-grade happened.
  const before = (await h.savedDrawing(page)).roomTags;
  expect(before.length, 'tags were grown to have a verdict about').toBe(2);
  expect(before.some(t => t.underMin === true), 'and they start out passing').toBe(false);

  await tightenWcMinimums(page);
  await reopen(page);

  const after = (await h.savedDrawing(page)).roomTags;
  expect(after.length, 'the tags survived the reload').toBe(before.length);
  expect(after.every(t => t.underMin === true),
    'every WC is under the tightened minimums and says so').toBe(true);
});

test('a drawing saved without the facts keeps its stored verdict — no false flag', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page);
  await placeFixtures(page, 'TOILET', [[-4, -5.5], [6, -5.5]]);
  await runRoomTags(page);

  // Strip the facts back out: this is exactly what every drawing saved
  // before this change looks like on disk.
  await page.evaluate(async () => {
    const file = await window.SharedFileStore.loadSharedFile('model-drawing');
    const saved = JSON.parse(await file.text());
    saved.roomTags = saved.roomTags.map(({ minDimensionFt, roomCategory, ...rest }) => rest);
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }),
      'model-drawing');
  });

  await tightenWcMinimums(page);
  await reopen(page);

  const after = (await h.savedDrawing(page)).roomTags;
  expect(after.length, 'the legacy tags loaded').toBe(2);
  // ABSENT IS NOT ZERO. Re-grading these with minDimensionFt reading 0 would
  // flag every room in every old drawing under the dimension rule.
  expect(after.every(t => t.underMin === false),
    'a tag with no facts is left exactly as it was stored').toBe(true);
  expect(after.every(t => t.minDimensionFt === undefined),
    'and nothing was written back onto it on load').toBe(true);
});
