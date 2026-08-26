// AREAS (board #170): per-level developed areas a drafter can put on a
// permit application. Floor footprints minus floor openings per the stated
// as-built convention (a stairwell counts once in the building total — at
// the level with solid floor beneath it), the basement reported as the
// secondary-suite line, and the ROOM TAGS areas rolling up per level.
// The two AutoCAD lessons are pinned by name below: background (ghost)
// lines never enter the math, and near-touching walls close a room at the
// true area while a genuinely open room yields no area at all.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function switchLayerView(page, label) {
  await page.locator('.level-row.active').getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function drawOutline(page, points) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);
}

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function openAreas(page) {
  await page.locator('[data-areas-open]').click();
  await expect(page.locator('[data-areas-dialog]')).toBeVisible();
}

async function closeAreas(page) {
  await page.locator('[data-areas-dialog]').getByRole('button', { name: 'DONE' }).click();
}

test('a rectangle house with a floor hole and a basement reports exact level, suite, and total figures', async ({ page }) => {
  await h.openModel(page);
  // 16 x 12 outline -> BUILD HOUSE: framed floors on MAIN FL and 2ND FL,
  // slab on FOUNDATION - 192 sq ft each.
  await drawOutline(page, [[-8, -6], [8, -6], [8, 6], [-8, 6]]);
  await buildHouse(page);

  // Cut a 3' x 8' hole (24 sq ft) into the MAIN FL floor - same record a
  // stair rough opening writes, at a size this test controls exactly.
  await switchLayerView(page, 'FLOOR');
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 4, 0);
  await page.waitForTimeout(200);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -1.5, -4);
  await h.clickWorld(page, 1.5, -4);
  await h.clickWorld(page, 1.5, 4);
  await h.clickWorld(page, -1.5, 4);
  await h.clickWorld(page, -1.5, -4); // first corner again closes it
  await h.waitForSaved(page);

  await openAreas(page);
  const rows = page.locator('[data-areas-level]');
  await expect(rows).toHaveCount(3);
  // Top-down: 2ND FL, MAIN FL, FOUNDATION.
  await expect(rows.nth(0)).toContainText('2ND FL');
  await expect(rows.nth(0).locator('[data-areas-net]')).toHaveText('192 sq ft');
  await expect(rows.nth(1)).toContainText('MAIN FL');
  await expect(rows.nth(1).locator('[data-areas-net]')).toHaveText('168 sq ft');
  await expect(rows.nth(1).locator('[data-areas-less]')).toContainText('24 sq ft');
  await expect(rows.nth(2)).toContainText('FOUNDATION');
  await expect(rows.nth(2).locator('[data-areas-net]')).toHaveText('192 sq ft');
  // The basement line is the secondary-suite figure; the total sums the nets,
  // counting the stairwell footprint once (solid floor below the hole).
  await expect(page.locator('[data-areas-suite]')).toContainText('192 sq ft');
  await expect(page.locator('[data-areas-total]')).toHaveText('552 sq ft');
  await expect(page.locator('[data-areas-convention]')).toContainText('deducted from the level');
});

test('the deduction for a true stair opening equals that opening\'s own polygon area', async ({ page }) => {
  await h.openModel(page);
  await drawOutline(page, [[-8, -6], [8, -6], [8, 6], [-8, 6]]);
  await buildHouse(page);

  await switchLayerView(page, 'FLOOR');
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 4, 0);
  await page.waitForTimeout(200);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -1.5, -4);
  await h.clickWorld(page, 1.5, -4);
  await h.clickWorld(page, 1.5, 4);
  await h.clickWorld(page, -1.5, 4);
  await h.clickWorld(page, -1.5, -4);
  await h.waitForSaved(page);

  // Whatever the drawn opening's stored polygon measures, the MAIN FL net is
  // gross minus exactly that - the convention applied to the record itself.
  const saved = await h.savedDrawing(page);
  const opening = saved.surfaceOpenings.find(candidate => candidate.hostType === 'floor');
  expect(opening).toBeTruthy();
  const area = Math.abs(opening.points.reduce((sum, pt, index) => {
    const next = opening.points[(index + 1) % opening.points.length];
    return sum + (pt.x * next.z - next.x * pt.z);
  }, 0) / 2);
  await openAreas(page);
  const netText = await page.locator('[data-areas-level]').nth(1).locator('[data-areas-net]').textContent();
  expect(parseInt(netText, 10)).toBe(192 - Math.round(area));
});

test('an L-shaped house reports the L footprint, not its bounding box', async ({ page }) => {
  await h.openModel(page);
  // 16 x 12 less an 8 x 6 notch = 144 sq ft per level.
  await drawOutline(page, [[-8, -6], [8, -6], [8, 0], [0, 0], [0, 6], [-8, 6]]);
  await buildHouse(page);

  await openAreas(page);
  const rows = page.locator('[data-areas-level]');
  await expect(rows.nth(1).locator('[data-areas-net]')).toHaveText('144 sq ft');
  await expect(page.locator('[data-areas-total]')).toHaveText('432 sq ft');
});

test('background walls from another level change no area (the AutoCAD ghost-line lesson)', async ({ page }) => {
  await h.openModel(page);
  // A closed 12 x 10 room on MAIN FL.
  await drawWall(page, -6, -5, 6, -5);
  await drawWall(page, 6, -5, 6, 5);
  await drawWall(page, 6, 5, -6, 5);
  await drawWall(page, -6, 5, -6, -5);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  const before = (await h.savedDrawing(page)).roomTags.filter(tag => tag.levelId === 3);
  expect(before).toHaveLength(1);

  // A wall slicing through the same footprint - on 2ND FL, shown on MAIN FL
  // only as a background reference.
  await switchLevel(page, '2ND FL');
  await drawWall(page, 0, -8, 0, 8);
  await switchLevel(page, 'MAIN FL');
  await levelRow(page, '2ND FL').locator('.level-bg').click();
  await page.waitForTimeout(300);

  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  const after = (await h.savedDrawing(page)).roomTags.filter(tag => tag.levelId === 3);
  // Still ONE room at the identical area - the ghost wall entered nothing.
  expect(after).toHaveLength(1);
  expect(after[0].areaSqFt).toBe(before[0].areaSqFt);
});

test('a corner gap inside the join tolerance still closes the room at the same area; a real gap yields none (the AutoCAD flood-out lesson)', async ({ page }) => {
  await h.openModel(page);
  // Closed 10 x 10 reference room on MAIN FL.
  await drawWall(page, -5, -5, 5, -5);
  await drawWall(page, 5, -5, 5, 5);
  await drawWall(page, 5, 5, -5, 5);
  await drawWall(page, -5, 5, -5, -5);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  const closed = (await h.savedDrawing(page)).roomTags.filter(tag => tag.levelId === 3);
  expect(closed).toHaveLength(1);

  // The same room on 2ND FL with one wall stopping 0.4' short of the corner -
  // inside ROOM_TAG_JOIN_FT, so the loop still closes at the same area.
  await switchLevel(page, '2ND FL');
  await drawWall(page, -5, -5, 5, -5);
  await drawWall(page, 5, -5, 5, 5);
  await drawWall(page, 5, 5, -5, 5);
  await drawWall(page, -5, 5, -5, -4.6);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  const gapped = (await h.savedDrawing(page)).roomTags.filter(tag => tag.levelId === 5);
  expect(gapped).toHaveLength(1);
  // "Same area" to the tag's own 0.1 sq ft display grid: the joined corner
  // is not byte-identical geometry, but a flood-out would differ by tens of
  // square feet, not tenths.
  expect(Math.abs(gapped[0].areaSqFt - closed[0].areaSqFt)).toBeLessThanOrEqual(0.2);

  // A genuinely open room - a 3' hole in the wall run - yields NO area
  // rather than a flooded-out wrong one.
  await switchLevel(page, 'FOUNDATION');
  await drawWall(page, -5, -5, 5, -5);
  await drawWall(page, 5, -5, 5, 5);
  await drawWall(page, 5, 5, -5, 5);
  await drawWall(page, -5, 5, -5, -2);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await page.waitForTimeout(400);
  const open = (await h.savedDrawing(page)).roomTags.filter(tag => tag.levelId === 1);
  expect(open).toHaveLength(0);
});

test('an open-concept space rolls up as one combined room; the plan tag is untouched', async ({ page }) => {
  await h.openModel(page);
  // One big 20 x 20 open space with kitchen fixtures on the north wall: the
  // fixture vote says KITCHEN, the size says the living space shares it.
  await drawWall(page, -10, -10, 10, -10);
  await drawWall(page, 10, -10, 10, 10);
  await drawWall(page, 10, 10, -10, 10);
  await drawWall(page, -10, 10, -10, -10);
  await page.locator('[data-model-left]').getByRole('button', { name: /\bFixture\b/i }).click();
  await page.getByRole('button', { name: 'FRIDGE', exact: true }).click();
  await h.clickWorld(page, 0, -9.5);
  await h.waitForSaved(page);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const tags = saved.roomTags.filter(tag => tag.levelId === 3);
  expect(tags).toHaveLength(1);
  // The plan keeps the honest fixture-vote tag...
  expect(tags[0].name).toBe('KITCHEN');
  // ...and the roll-up labels the combined space, one room, no invented split.
  await openAreas(page);
  const rooms = page.locator('[data-areas-level]').nth(1).locator('[data-areas-rooms]');
  await expect(rooms).toContainText('KITCHEN / LIVING');
  await closeAreas(page);
});
