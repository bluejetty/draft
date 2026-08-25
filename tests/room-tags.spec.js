// ROOM TAGS (#131): the Annotation strip's ROOM TAGS button finds each
// enclosed room in the level's PLAN walls and names it from the fixtures
// inside — every bathroom is a WC numbered biggest-first, a washer/dryer
// marks LAUNDRY, kitchen fixtures mark KITCHEN, and a closet marks a
// bedroom (BEDROOM when the room is wide enough, BEDRM in tight rooms).
// Basement rooms take a B prefix (WC B1). Tags save on ROOM-IDS-AREA; the
// optional area readout is off by default and MAIN FL only.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// A 20x12 house (walls -10..10 x -6..6) split by a partition; the left room
// is the bigger one when the partition sits right of centre.
async function drawTwoRoomHouse(page, partitionX = 2) {
  await drawWall(page, -10, -6, 10, -6);
  await drawWall(page, 10, -6, 10, 6);
  await drawWall(page, 10, 6, -10, 6);
  await drawWall(page, -10, 6, -10, -6);
  await drawWall(page, partitionX, -6, partitionX, 6);
}

// One selection, then clicks — reselecting the rail button mid-flow can hit
// the strip's REMOVE LAST FIXTURE, whose name also matches \bFixture\b.
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

test('ROOM TAGS names WCs biggest-first and saves them on ROOM-IDS-AREA', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page, 2);
  // Left room is the bigger one; the right toilet lands in the smaller.
  await placeFixtures(page, 'TOILET', [[-4, -5.5], [6, -5.5]]);
  await runRoomTags(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.roomTags).toHaveLength(2);
  drawing.roomTags.forEach(tag => expect(tag.layer).toBe('ROOM-IDS-AREA'));
  const wc1 = drawing.roomTags.find(tag => tag.name === 'WC 1');
  const wc2 = drawing.roomTags.find(tag => tag.name === 'WC 2');
  expect(wc1).toBeTruthy();
  expect(wc2).toBeTruthy();
  expect(wc1.at.x).toBeLessThan(2);   // WC 1 sits in the bigger left room
  expect(wc2.at.x).toBeGreaterThan(2);
  expect(wc1.areaSqFt).toBeGreaterThan(wc2.areaSqFt);
});

test('kitchen and laundry fixtures name their rooms; a bare room tags ROOM', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page, 0);
  await placeFixtures(page, 'FRIDGE', [[-4, -5.5]]);
  await runRoomTags(page);

  const drawing = await h.savedDrawing(page);
  const names = drawing.roomTags.map(tag => tag.name).sort();
  expect(names).toEqual(['KITCHEN', 'ROOM']);

  // The washer upgrades the bare room to LAUNDRY on a re-run, and the re-run
  // replaces the level's tags instead of stacking a second set.
  await placeFixtures(page, 'WASHER', [[4, -5.5]]);
  await runRoomTags(page);
  const after = await h.savedDrawing(page);
  expect(after.roomTags).toHaveLength(2);
  expect(after.roomTags.map(tag => tag.name).sort()).toEqual(['KITCHEN', 'LAUNDRY']);
});

test('closets mark bedrooms: BEDROOM when wide, BEDRM in a tight room', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page, 3); // left room 13 ft wide, right room 7 ft (< 8 ft = tight)
  // Closets are two-click runs: one in each room.
  await placeFixtures(page, 'CLOSET', [[-6, -5.5], [-2, -5.5], [4.5, -5.5], [8.5, -5.5]]);
  await runRoomTags(page);

  const drawing = await h.savedDrawing(page);
  const names = drawing.roomTags.map(tag => tag.name).sort();
  expect(names).toEqual(['BEDRM 2', 'BEDROOM 1']); // biggest bedroom numbers first
});

test('basement rooms take the B prefix: WC B1 on the FOUNDATION plan', async ({ page }) => {
  await h.openModel(page);
  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'PLAN' }).click();
  await page.waitForTimeout(300);
  await drawTwoRoomHouse(page, 2);
  await placeFixtures(page, 'TOILET', [[-4, -5.5], [6, -5.5]]);
  await runRoomTags(page);

  const drawing = await h.savedDrawing(page);
  const names = drawing.roomTags.map(tag => tag.name).sort();
  expect(names).toEqual(['WC B1', 'WC B2']);
});

test('areas are off by default; the toggle persists and tags survive a reload', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page, 2);
  await placeFixtures(page, 'TOILET', [[-4, -5.5]]);
  await runRoomTags(page);

  let drawing = await h.savedDrawing(page);
  expect(drawing.roomAreasOn).toBe(false);
  // Left room: 12x12 to centerlines less the 2x6 walls ≈ 131 sq ft inside.
  const wc1 = drawing.roomTags.find(tag => tag.name === 'WC 1');
  expect(wc1.areaSqFt).toBeGreaterThan(120);
  expect(wc1.areaSqFt).toBeLessThan(144);

  await page.locator('[data-room-areas]').click();
  await h.waitForSaved(page);
  drawing = await h.savedDrawing(page);
  expect(drawing.roomAreasOn).toBe(true);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  drawing = await h.savedDrawing(page);
  expect(drawing.roomTags.length).toBe(2);
  expect(drawing.roomAreasOn).toBe(true);
});

test('CLEAR TAGS removes the plan level tags; broken stored tags are dropped on load', async ({ page }) => {
  await h.openModel(page);
  await drawTwoRoomHouse(page, 2);
  await runRoomTags(page);
  expect((await h.savedDrawing(page)).roomTags.length).toBe(2);

  await page.locator('[data-room-tags-clear]').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).roomTags.length).toBe(0);

  // A tag with no name and a tag with a bad level never load.
  await page.evaluate(async () => {
    const file = await window.SharedFileStore.loadSharedFile('model-drawing');
    const saved = JSON.parse(await file.text());
    saved.roomTags = [
      { id: 1, at: { x: 0, z: 0 }, levelId: 3, name: '' },
      { id: 2, at: { x: 0, z: 0 }, levelId: 99, name: 'WC 1' },
      { id: 3, at: { x: 1, z: 1 }, levelId: 3, name: 'kitchen', areaSqFt: -5 },
    ];
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }),
      'model-drawing');
  });
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  // The load filters in memory; an areas toggle forces a re-save so the
  // cleaned list can be read back from storage.
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-areas]').click();
  await h.waitForSaved(page);
  const tags = (await h.savedDrawing(page)).roomTags;
  expect(tags).toHaveLength(1);
  expect(tags[0].name).toBe('KITCHEN'); // names store uppercase
  expect(tags[0].areaSqFt).toBe(0);     // negative areas clamp to none
});
