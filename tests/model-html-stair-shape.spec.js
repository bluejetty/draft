// A SELECTED STAIR TAKES ITS SHAPE, ITS TURN AND ITS WINDERS.
//
// Movie, 15 Oct: "you wanted U/L shapes and winders". All three have been in
// the format and the geometry since the stair went in -- drawing-format.js
// validates `shape`, `turn` and `winders`, stairShapeSplit and
// stairPlanParts build the landing and the second leg from them, and
// MODEL.dc.html carries the picker. MODEL.html had no way to say so: it wrote
// `winders: 0` and whatever shape the suggester chose, and a selected stair
// had no properties panel at all.
//
// THE WELL IS THE HALF THAT IS EASY TO MISS. Everything about the flight is
// derived at paint time, so the stair needs nothing but the word -- but the
// stairwell is a STORED ring, cut to the shape the stair used to have, and an
// L folds its second leg out sideways from under it. AUTO STAIR will not
// repair it either: buildStairOpenings never cuts a second hole for a stair
// that already has one.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const STAIR_ID = 7401;
const MATE_ID = 7402;
const FLOOR_ID = 'FL-TEST-1';
const WELL_ID = 'OP-TEST-1';

// A straight flight across an empty MAIN FL with the floor it is cut through,
// and 9 ft of rise -- which at the 7 7/8" maximum riser is thirteen treads,
// well past the three a turn needs.
const base = ({ shape = 'straight', winders = 0, shared = false } = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [],
  underlays: [],
  floors: [{
    id: FLOOR_ID, levelId: MAIN_FL, view: 'floor', structure: 'floor',
    points: [{ x: -20, z: -16 }, { x: 20, z: -16 }, { x: 20, z: 16 }, { x: -20, z: 16 }],
  }],
  stairs: [
    {
      id: STAIR_ID, levelId: MAIN_FL, view: 'plan', layer: 'A-STR',
      start: { x: -2, z: -4 }, end: { x: 8, z: -4 },
      widthFt: 3, riseFt: 9, rail: 'left',
      shape, turn: 'right', winders, auto: true,
    },
    ...(shared ? [{
      id: MATE_ID, levelId: MAIN_FL, view: 'plan', layer: 'A-STR',
      start: { x: -2, z: 6 }, end: { x: 8, z: 6 },
      widthFt: 3, riseFt: 9, rail: 'left',
      shape: 'straight', turn: 'right', winders: 0, auto: true,
    }] : []),
  ],
  surfaceOpenings: [{
    id: WELL_ID, hostType: 'floor', hostId: FLOOR_ID, levelId: MAIN_FL,
    stairId: STAIR_ID,
    ...(shared ? { stairIds: [STAIR_ID, MATE_ID] } : {}),
    points: [
      { x: -2.5, z: -5.5 }, { x: 8.5, z: -5.5 },
      { x: 8.5, z: -2.5 }, { x: -2.5, z: -2.5 },
    ],
  }],
});

async function open(page, fixture) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: fixture });
  await page.goto(`/MODEL.html?left=1&right=1&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}

async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

// WHAT A FRESH LOAD KEEPS, not what the page holds: DraftDrawingFormat is the
// normaliser the page runs on open, so this asks the question a reload asks --
// and `winders` is exactly the field a reader can quietly drop (it is zeroed
// for any shape but L).
const survives = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await file.text());
  const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
  return {
    stairs: window.DraftDrawingFormat.stairs(raw.stairs, levelIds),
    wells: raw.surfaceOpenings,
  };
}, BUCKET);

const stairOf = (file, id = STAIR_ID) => file.stairs.find(s => Number(s.id) === id);
const wellOf = file => file.wells.find(o => o.id === WELL_ID);

// Select the stair: a click where the first run is, a foot and a half down
// from the top nosing. The hover label is asked for the point first, so a
// press that missed the flight cannot read as a panel that failed to build.
async function pickStair(page, stair) {
  const { at } = await h.planFrame(page);
  const len = Math.hypot(stair.end.x - stair.start.x, stair.end.z - stair.start.z);
  const dir = { x: (stair.end.x - stair.start.x) / len, z: (stair.end.z - stair.start.z) / len };
  const [x, y] = at(stair.start.x + dir.x * 1.5, stair.start.z + dir.z * 1.5);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name'), 'the click point is on the stair')
    .toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(x, y);
  await expect(page.locator('#props-slot [data-prop-row="shape"]')).toBeVisible({ timeout: 4000 });
  return [x, y];
}

const chip = (page, row, value) =>
  page.locator(`#props-slot [data-prop-row="${row}"] [data-prop-value="${value}"]`);

test('the panel offers STRAIGHT / L / U, and the turn only once there is one',
  async ({ page }) => {
    await open(page, base());
    await pickStair(page, base().stairs[0]);

    await expect(chip(page, 'shape', 'straight')).toHaveAttribute('aria-pressed', 'true');
    // A STRAIGHT FLIGHT HAS NO HANDED VERSION, so no TURN row is offered --
    // a row whose two choices mean nothing is the panel describing a property
    // the drawing does not have.
    await expect(page.locator('#props-slot [data-prop-row="turn"]')).toHaveCount(0);

    await chip(page, 'shape', 'U').click();
    await expect(chip(page, 'shape', 'U')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#props-slot [data-prop-row="turn"]')).toBeVisible();

    await save(page);
    const after = stairOf(await survives(page));
    expect(after.shape, 'the U survives a reload').toBe('U');
    expect(after.auto, 'and the stair is no longer the suggester-s').toBe(false);
  });

test('an L re-cuts the stairwell, and one undo puts both back', async ({ page }) => {
  await open(page, base());
  const first = await survives(page);
  const well = wellOf(first);
  expect(well.points, 'the fixture-s well is the straight run-s rectangle')
    .toHaveLength(4);

  await pickStair(page, stairOf(first));
  await chip(page, 'shape', 'L').click();
  await save(page);

  const after = await survives(page);
  expect(stairOf(after).shape).toBe('L');
  // AN L'S HOLE IS NOT A RECTANGLE. stairOpeningFootprint builds the turn's
  // leg into the ring, so the count is the plainest proof the well was re-cut
  // from the new shape rather than left as the straight run's box.
  expect(wellOf(after).points.length,
    'the well is re-cut to the turn, not left as a rectangle')
    .toBeGreaterThan(4);
  expect(wellOf(after).hostId, 'and still cut from the same floor').toBe(FLOOR_ID);

  // ONE GESTURE, ONE UNDO -- the word and the hole together.
  await page.locator('#model-undo').click();
  await save(page);
  const undone = await survives(page);
  expect(undone.stairs.find(s => Number(s.id) === STAIR_ID).shape).toBe('straight');
  expect(wellOf(undone).points).toEqual(well.points);
});

test('winders are behind a double-click on L, and only on an L', async ({ page }) => {
  await open(page, base());
  await pickStair(page, base().stairs[0]);

  // A SINGLE CLICK ON L MAKES AN L AND NOTHING MORE. Revealing the winder row
  // on the first click would advertise winders, which the arrangement exists
  // not to do -- MODEL.dc.html's own note: "never the default and never
  // advertised".
  await chip(page, 'shape', 'L').click();
  await expect(page.locator('#props-slot [data-prop-row="winders"]')).toHaveCount(0);

  await chip(page, 'shape', 'L').dblclick();
  await expect(page.locator('#props-slot [data-prop-row="winders"]')).toBeVisible();
  await expect(chip(page, 'winders', '0')).toHaveAttribute('aria-pressed', 'true');

  await chip(page, 'winders', '2').click();
  await save(page);
  expect(stairOf(await survives(page)).winders, '2 winders survive a reload').toBe(2);

  // THE FORMAT'S RULE, APPLIED BY THE PAGE: winders are L-only, so moving to
  // a U clears them here rather than letting the record say 2 and the reader
  // say 0 -- which would be the panel showing a choice the file does not hold.
  await chip(page, 'shape', 'U').click();
  await expect(page.locator('#props-slot [data-prop-row="winders"]')).toHaveCount(0);
  await save(page);
  expect(stairOf(await survives(page)).winders, 'a U carries no winders').toBe(0);
});

test('a stair that already has winders shows the row without being asked',
  async ({ page }) => {
    // NOT A SECRET TO KEEP FROM THE DRAFTER WHO IS LOOKING AT THEM. The hidden
    // door is about not advertising winders, not about hiding ones already
    // drawn -- a panel that omitted the row would make them unreachable.
    await open(page, base({ shape: 'L', winders: 3 }));
    await pickStair(page, base({ shape: 'L', winders: 3 }).stairs[0]);
    await expect(page.locator('#props-slot [data-prop-row="winders"]')).toBeVisible();
    await expect(chip(page, 'winders', '3')).toHaveAttribute('aria-pressed', 'true');
  });

test('a well two flights share is not re-cut, and the strip says so', async ({ page }) => {
  await open(page, base({ shared: true }));
  const first = await survives(page);
  const well = wellOf(first);

  await pickStair(page, stairOf(first));
  await chip(page, 'shape', 'L').click();
  await save(page);

  const after = await survives(page);
  expect(stairOf(after).shape, 'the flight took the shape').toBe('L');
  expect(wellOf(after).points, 'the shared hole was left alone').toEqual(well.points);
  await expect(page.locator('#strip-message')).toContainText('shared well');
});
