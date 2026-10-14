// THE ROOM OVER A DETACHED GARAGE GETS WINDOWS, AND THE DOORS FACE THE STREET.
//
// Movie, 14 Oct, twice over: "still FENSTRATIONS look like not properly
// loading on the Detached Garage 2 storey grade beam", and then "can you put
// the garage door openings facing FRONT / E1 direction as DEFAULT (corner lots
// aren't as common so the user can change that)".
//
// THE FIRST WAS NOT A LOADING FAULT. Measured on an ordered grade-beam garage:
// four walls on OVER GARAGE and not one opening on any of them. The storey
// went up on 13 Oct and nothing ever dealt it a window, so every elevation of
// it was a blank band -- the elevations were right and there was nothing to
// draw.
//
// THE SECOND IS THE SAME SHAPE OF BUG one level down: the design names edge 2
// as the front and the loop's edge 2 is wherever the corners happened to start,
// so a turned plan left the overhead doors facing the neighbour.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const fs = require('fs');
const path = require('path');

const BUCKET = 'model-drawing';
const UPPER = 4;
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// An empty sheet on the real level stack, so everything read below belongs to
// the garage this spec ordered.
async function open(page, planTurn = 0) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved, turn }) => {
    const bare = {
      ...saved, planTurn: turn,
      walls: [], outlines: [], floors: [], roofs: [], fenestrations: [],
      dimensions: [], lines: [], shapes: [], stairs: [],
    };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(bare)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO, turn: planTurn });
  await page.goto('/MODEL.html?level=1&view=foundation');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function orderGarage(page, entry = 'detached-gradebeam') {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
}

const upperOpenings = saved => (saved.fenestrations || [])
  .filter(item => Number(item.levelId) === UPPER);

// WHICH WAY A WALL FACES, outward: the loops are wound so that the normal of
// an edge running (dx, dz) is (dz, -dx). Read off the wall rather than from a
// table, because that is the thing the fix has to get right.
const facingOf = wall => {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dz / len, z: -dx / len };
};

test('the room over the garage comes with windows, not a blank band', async ({ page }) => {
  await open(page);
  const saved = await orderGarage(page);
  const up = upperOpenings(saved);
  expect(up.length, 'the storey over the garage was dealt no openings at all')
    .toBeGreaterThan(0);
  // WINDOWS ONLY. A door on this storey opens into air -- the clamp would
  // accept it and the drafter would find it on the elevation.
  expect([...new Set(up.map(item => item.type))], 'something other than a window went up here')
    .toEqual(['window']);
  // ON EVERY WALL, which is what makes it a room rather than a shed with a
  // light: four walls up there, and each one carries at least one.
  const walls = (saved.walls || []).filter(wall => Number(wall.levelId) === UPPER);
  expect(walls.length, 'the storey itself is missing').toBe(4);
  const hosts = new Set(up.map(item => item.wallId));
  expect(hosts.size, 'a wall of the room has no window at all').toBe(4);
  // AND THEY ARE REAL OPENINGS: a width, a sill off the floor, a head above
  // it. A record with a zero width draws nothing and reads as "not loading".
  up.forEach(item => {
    expect(item.width, `${item.id} has no width`).toBeGreaterThan(1);
    expect(item.headHeight, `${item.id} has no height`).toBeGreaterThan(item.sillHeight);
    expect(item.sillHeight, `${item.id} sits on the floor like a door`).toBeGreaterThan(0);
  });
});

test('and none of them stands over the stairwell', async ({ page }) => {
  // The ground floor's front is two bays and a 6 ft strip with the man door;
  // the stair lands in that strip and comes up against this wall, so the
  // window that would be in its headroom is the one left out.
  await open(page);
  const saved = await orderGarage(page);
  const doors = (saved.fenestrations || []).filter(item => item.garage === true);
  expect(doors.length, 'the ground floor got no overhead doors').toBeGreaterThan(0);
  const front = doors[0].wallId;
  const over = upperOpenings(saved).filter(item => item.wallId === front);
  const wall = (saved.walls || []).find(item => item.id === front);
  const span = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
  over.forEach(item => {
    expect(item.offset + item.width / 2,
      `${item.id} reaches into the 6 ft stair strip at the end of the front wall`)
      .toBeLessThanOrEqual(span - 6 + 0.01);
  });
});

// ── AND THE DOORS THEMSELVES FACE THE STREET ─────────────────────────────
//
// Movie, 14 Oct: "can you put the garage door openings facing FRONT / E1
// direction as DEFAULT (corner lots aren't as common so the user can change
// that)".
//
// THE RULE IS auto-windows' garageDoorPlan, which is where every door-facing
// decision in the app is made, and it had three cases: a garage stepped back
// from the house front takes the street; one hung off the house takes the
// face opposite that joint; and anything else took THE LONGEST RUN. A
// standalone garage carries neither cue, so it fell to the third -- and the
// longest run is a fact about the garage's shape, not about which way the lot
// faces. On the usual deep garage that is a side wall.
//
// ASKED OF THE MODULE DIRECTLY, because that is where the rule lives and the
// builds that use it each dress it in their own geometry. The orientations
// are the module's own words (E1 south, E2 west, E3 north, E4 east).
test('a standalone garage puts its doors on the street face, not the longest wall',
  async ({ page }) => {
    await page.goto('/MODEL.html');
    await page.waitForFunction(() => !!window.DraftAutoWindows, null, { timeout: 10000 });
    const plan = await page.evaluate(() => window.DraftAutoWindows.garageDoorPlan({
      // A 24 x 30 box: the SIDES are the long walls, which is the usual
      // detached garage and the shape the old rule got wrong.
      faces: [
        { index: 0, lengthFt: 24, orientation: 'back' },
        { index: 1, lengthFt: 30, orientation: 'right' },
        { index: 2, lengthFt: 24, orientation: 'front' },
        { index: 3, lengthFt: 30, orientation: 'left' },
      ],
      manDoorFaceIndex: null,
    }));
    expect(plan, 'no door plan at all').toBeTruthy();
    expect(plan.faceIndex, `the doors took face ${plan.faceIndex} -- ${plan.reason}`).toBe(2);
    expect(plan.reason).toMatch(/street/);
  });

test('but a garage hung off the house still opens away from the man door',
  async ({ page }) => {
    // THE CUE THAT EXISTS WINS. The new default is for the garage that has no
    // cue at all; an attached one still reads the drawing rather than the
    // convention, or every attached garage would open into the house.
    await page.goto('/MODEL.html');
    await page.waitForFunction(() => !!window.DraftAutoWindows, null, { timeout: 10000 });
    const plan = await page.evaluate(() => window.DraftAutoWindows.garageDoorPlan({
      faces: [
        { index: 0, lengthFt: 24, orientation: 'back' },
        { index: 1, lengthFt: 30, orientation: 'right' },
        { index: 2, lengthFt: 24, orientation: 'front' },
        { index: 3, lengthFt: 30, orientation: 'left' },
      ],
      manDoorFaceIndex: 3,
    }));
    expect(plan.faceIndex, `the doors took face ${plan.faceIndex} -- ${plan.reason}`).toBe(1);
  });
