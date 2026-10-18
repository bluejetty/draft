// A PLACED STAIR MOVES, AND ITS WELL GOES WITH IT.
//
// Movie, 15 Oct: "Stairs locked — no move or drag". They were. A stair could
// be picked and deleted and that was the whole of it, so a flight the
// suggester had parked down the middle of the house could only be taken out
// and suggested back into the same place. Nothing on MODEL.html armed a drag
// for one: MOVE_TOGETHER held 'line' and 'note', and the moveDrag kinds were
// dimension rows, notes, tags, openings and walls.
//
// WHAT THE WELL ADDS, and why it is in this file rather than left for later:
// buildStairOpenings files each hole with its stair's id and NEVER cuts a
// second one for a stair that already has one. So a flight that moved and
// left its hole behind had no way back to it -- the drafter would be looking
// at a stair over solid floor and a hole over nothing, with no button that
// repairs either. A drag that moves the flight alone is not half the feature,
// it is a worse drawing than no drag at all.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const STAIR_ID = 7401;
const MATE_ID = 7402;
const FLOOR_ID = 'FL-TEST-1';
const WELL_ID = 'OP-TEST-1';

// A flight across an empty MAIN FL, with the floor it is cut through. No
// walls: this is a test about a gesture, and a house around the stair would
// only give the pick chain (wall and line BEFORE stair) a chance to take the
// press for reasons that are not this file's subject.
const base = ({ auto = true, shared = false } = {}) => ({
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
    points: [{ x: -15, z: -12 }, { x: 15, z: -12 }, { x: 15, z: 12 }, { x: -15, z: 12 }],
  }],
  stairs: [
    {
      id: STAIR_ID, levelId: MAIN_FL, view: 'plan', layer: 'A-STR',
      start: { x: -2, z: -4 }, end: { x: 8, z: -4 },
      widthFt: 3, riseFt: 9, rail: 'left',
      shape: 'straight', turn: 'right', winders: 0, auto,
    },
    // THE MATE EXISTS ONLY FOR THE SHARED-WELL CASE, and it is placed well
    // clear of the first flight so a press meant for one cannot land on the
    // other.
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

const saved = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

const stairOf = (file, id = STAIR_ID) => file.stairs.find(s => Number(s.id) === id);
const wellOf = file => file.surfaceOpenings.find(o => o.id === WELL_ID);

// A POINT INSIDE THE FLIGHT, a foot and a half down from the top nosing.
// stairRings builds the first run from the stair's own start, so this is
// inside it for any rise that produces more than two treads -- and the hover
// label is asked for it rather than assumed, because a press that misses the
// stair would otherwise read as a drag that does not work.
async function onStair(page, stair) {
  const { at } = await h.planFrame(page);
  const len = Math.hypot(stair.end.x - stair.start.x, stair.end.z - stair.start.z);
  const dir = { x: (stair.end.x - stair.start.x) / len, z: (stair.end.z - stair.start.z) / len };
  const [x, y] = at(stair.start.x + dir.x * 1.5, stair.start.z + dir.z * 1.5);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name'), 'the press point is on the stair')
    .toHaveText('STAIR', { timeout: 4000 });
  return [x, y];
}

async function dragBy(page, [x, y], dxFt, dzFt) {
  const { scale } = await h.planFrame(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dxFt * scale, y + dzFt * scale, { steps: 6 });
  await page.mouse.up();
}

const moved = (after, before, dx, dz, what) => {
  expect(after.x - before.x, `${what} moved ${dx} ft in x`).toBeCloseTo(dx, 2);
  expect(after.z - before.z, `${what} moved ${dz} ft in z`).toBeCloseTo(dz, 2);
};

test('a selected stair drags, and one Ctrl+Z puts it back', async ({ page }) => {
  await open(page, base());
  const before = stairOf(await saved(page));

  // THE FIRST CLICK SELECTS, the press after it drags -- a tag's and a
  // dimension's own two-step, so a stray press on a stair cannot move it.
  const at = await onStair(page, before);
  await page.mouse.click(at[0], at[1]);
  await dragBy(page, at, 4, 3);
  await save(page);

  const after = stairOf(await saved(page));
  moved(after.start, before.start, 4, 3, 'the top nosing');
  moved(after.end, before.end, 4, 3, 'the foot');
  // THE FLIGHT IS THE SAME FLIGHT. A drag that changed the run or the bearing
  // would be a different stair in a new place.
  expect(Math.hypot(after.end.x - after.start.x, after.end.z - after.start.z),
    'the run is unchanged')
    .toBeCloseTo(Math.hypot(before.end.x - before.start.x, before.end.z - before.start.z), 3);
  expect(after.shape, 'and so are its shape and turn').toBe(before.shape);
  expect(after.turn).toBe(before.turn);

  // TOUCHED BY HAND, so no longer the suggester's placement -- the format's
  // own rule for `auto`.
  expect(before.auto, 'the fixture starts as a suggested placement').toBe(true);
  expect(after.auto, 'a drag clears auto').toBe(false);

  await page.locator('#model-undo').click();
  await save(page);
  const undone = stairOf(await saved(page));
  expect(undone.start).toEqual(before.start);
  expect(undone.end).toEqual(before.end);
  expect(undone.auto, 'and gives the auto tag back with it').toBe(true);
});

test('the well travels with the flight, in the same undo step', async ({ page }) => {
  await open(page, base());
  const first = await saved(page);
  const before = stairOf(first);
  const well = wellOf(first);

  const at = await onStair(page, before);
  await page.mouse.click(at[0], at[1]);
  await dragBy(page, at, -3, 2);
  await save(page);

  const after = wellOf(await saved(page));
  expect(after.points, 'the well keeps its shape').toHaveLength(well.points.length);
  after.points.forEach((pt, i) => moved(pt, well.points[i], -3, 2, `well corner ${i}`));
  // ITS HOST IS UNCHANGED: the hole is still cut from the same floor, moved
  // within it rather than re-cut from whatever the stair now sits over.
  expect(after.hostId).toBe(FLOOR_ID);
  expect(after.stairId).toBe(STAIR_ID);

  // ONE GESTURE, ONE UNDO -- the flight and the hole together. A second
  // Ctrl+Z would mean the drafter had to guess how many steps his one drag
  // cost him.
  await page.locator('#model-undo').click();
  await save(page);
  const undone = await saved(page);
  expect(wellOf(undone).points).toEqual(well.points);
  expect(stairOf(undone).start).toEqual(before.start);
});

test('a well two flights share stays put, and the strip says so', async ({ page }) => {
  await open(page, base({ shared: true }));
  const first = await saved(page);
  const before = stairOf(first);
  const well = wellOf(first);
  expect(well.stairIds, 'the fixture shares one hole between two flights')
    .toEqual([STAIR_ID, MATE_ID]);

  const at = await onStair(page, before);
  await page.mouse.click(at[0], at[1]);
  await dragBy(page, at, 4, 0);
  await save(page);

  const after = await saved(page);
  moved(stairOf(after).start, before.start, 4, 0, 'the flight that was dragged');
  expect(wellOf(after).points, 'the shared hole did not move').toEqual(well.points);
  expect(stairOf(after, MATE_ID).start, 'nor did the other flight')
    .toEqual(stairOf(first, MATE_ID).start);
  // SAID, NOT LEFT TO BE FOUND. A hole that stayed behind is the one thing
  // the drafter cannot read off his own drag.
  await expect(page.locator('#strip-message')).toContainText('shared well');
});

test('an unselected stair is not dragged by a press on it', async ({ page }) => {
  await open(page, base());
  const before = stairOf(await saved(page));

  // NO SELECTING CLICK FIRST. The press pans the sheet, as a press on bare
  // board does, and the stair stays where it was -- which is what keeps a
  // drafter panning across the plan from carrying a flight along with him.
  const at = await onStair(page, before);
  await dragBy(page, at, 5, 5);
  await page.waitForTimeout(200);
  // SAVED IF THERE IS ANYTHING TO SAVE. A gesture that moved nothing leaves
  // the page clean and the button disabled, so insisting on a save here would
  // fail the test for the very behaviour it is checking.
  if (await page.locator('#save').isEnabled()) await save(page);

  const after = stairOf(await saved(page));
  expect(after.start, 'the stair did not move').toEqual(before.start);
  expect(after.end).toEqual(before.end);
});

// AND ITS FRAMING (Movie, 18 Oct: "the beam stayed in the old location
// too"): the open side's flush beam and its post travel with the flight, in
// the same undo step.
test('the beam framing the well, and its post, travel with the flight', async ({ page }) => {
  const f = base();
  f.beams = [{ id: 1, start: { x: -2.5, y: 0, z: -2.5 }, end: { x: 8.5, y: 0, z: -2.5 }, levelId: MAIN_FL,
    view: 'floor', mode: 'flush', stairId: STAIR_ID }];
  f.columns = [{ id: 1, point: { x: 8.5, y: 0, z: -2.5 }, levelId: MAIN_FL, view: 'floor', footing: 'pad36' }];
  await open(page, f);
  const first = await saved(page);
  const at = await onStair(page, stairOf(first));
  await page.mouse.click(at[0], at[1]);
  await dragBy(page, at, -3, 2);
  await save(page);
  const after = await saved(page);
  moved(after.beams[0].start, first.beams[0].start, -3, 2, 'beam start');
  moved(after.beams[0].end, first.beams[0].end, -3, 2, 'beam end');
  moved(after.columns[0].point, first.columns[0].point, -3, 2, 'its post');
  await page.locator('#model-undo').click();
  await save(page);
  const undone = await saved(page);
  expect(undone.beams[0].start).toEqual(first.beams[0].start);
  expect(undone.columns[0].point).toEqual(first.columns[0].point);
});
