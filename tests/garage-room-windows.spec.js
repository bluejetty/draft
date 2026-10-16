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
// 2ND FL (Movie, 14 Oct): "the Garage 2 storey shouldn't even have a 1.5
// floor - it is more like a bungalow than a bilevel". This read 4 -- OVER
// GARAGE, which is a SPLIT's half storey and is where the room was filed
// until that ruling. Nothing else in this file moves: the windows it is
// about are dealt the same way onto the same four walls, one entry higher
// up the level list.
const UPPER = 5;
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

test('and a garage hung off the house opens at the street too', async ({ page }) => {
  // THE STREET WINS WHEREVER A WALL FACES IT. Movie, 14 Oct, asked which
  // should win where the two disagree: "2" -- the street -- and "garage door
  // to face street, user can change it later if needed". The old rule sent an
  // attached garage's doors to the face OPPOSITE its man-door connection,
  // which on a garage alongside the house is the neighbour's side.
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.DraftAutoWindows, null, { timeout: 10000 });
  const plan = await page.evaluate(() => window.DraftAutoWindows.garageDoorPlan({
    faces: [
      { index: 0, lengthFt: 24, orientation: 'back' },
      { index: 1, lengthFt: 30, orientation: 'right' },
      { index: 2, lengthFt: 24, orientation: 'front' },
      { index: 3, lengthFt: 30, orientation: 'left' },
    ],
    // JOINED ON ITS LEFT, so the old rule would have sent the doors right.
    manDoorFaceIndex: 3,
  }));
  expect(plan.faceIndex, `the doors took face ${plan.faceIndex} -- ${plan.reason}`).toBe(2);
  expect(plan.reason).toMatch(/street/);
});

// ── AND THE WHOLE WAY THROUGH, ON THE FLOW HE USED ───────────────────────
//
// Movie drew the garage himself rather than taking the shelf's: the board's
// OUTLINE press arms the trace, the loop he walks becomes the garage, and
// traced-plans asks auto-windows where the doors go. That is the path the
// rule above actually serves, so it is the path this check walks.
//
// MEASURED BOTH WAYS before it was written: with the rule reverted, the two
// overhead doors land on the wall facing NORTH -- the back of the lot -- and
// with it they face south, which is E1.
test('a garage the drafter traces himself opens toward E1', async ({ page }) => {
  await open(page);
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator('#dt-tiles [data-build-entry="detached-gradebeam"]').click();
  // THE OUTLINE PRESS, which is "I'll draw it myself" -- the garage is the one
  // type the board refuses to trace from the tile alone, so this is the only
  // door into it.
  await page.locator('[data-drivethru-outline]').first().click();
  await page.waitForTimeout(200);
  // AND THAT PRESS NOW SEEDS A CORNER ON THE BULLSEYE (Movie, 15 Oct). This
  // garage is traced about the origin rather than from it, so the corner
  // comes back off before the walk.
  await h.dropSeededCorner(page);

  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  const scale = Number(hit[1]);
  const box = await page.locator('#plan').boundingBox();
  const click = async (x, z) => {
    await page.mouse.click(box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale);
    await page.waitForTimeout(90);
  };
  // 30 WIDE AND 24 DEEP, so the long walls are the ones running east-west:
  // the shape where "the longest run" and "the street" are different answers.
  for (const [x, z] of [[-15, -12], [15, -12], [15, 12], [-15, 12], [-15, -12]]) await click(x, z);
  await page.waitForTimeout(700);
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

  const saved = await h.savedDrawing(page);
  const overhead = (saved.fenestrations || []).filter(item => item.garage === true);
  expect(overhead.length, 'the traced garage got no overhead door').toBeGreaterThan(0);
  const walls = (saved.walls || []).filter(wall => wall.wallType === 'stud_2x6');
  const facing = wall => {
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: Math.round(dz / len), z: Math.round(-dx / len) };
  };
  overhead.forEach(door => {
    const wall = walls.find(item => item.id === door.wallId);
    expect(wall, `${door.id} hangs on no wall`).toBeTruthy();
    const out = facing(wall);
    // E1 looks from +z on an unturned plan, which is where the street is.
    expect(`${out.x},${out.z}`, `the overhead door faces ${out.x},${out.z}, not the street`)
      .toBe('0,1');
  });
});

// ── AND A TRACED GARAGE IS BUILT ALL THE WAY, NOT HALFWAY ────────────────
//
// Movie, 14 Oct, over a 2 storey detached garage he had drawn himself: "the
// garage doors are showing on the main floor but not on 2nd floor and there
// is no roof", then "and gap between main ceiling and 2nd floor wall".
//
// THREE SYMPTOMS, ONE CRASH. `order.size` is what the drive-thru was ASKED
// for and a traced garage brings corners instead, so reading `.widthFt` off
// it threw -- after the walls were committed and before the deck, the room's
// windows and the roof. The storey stood on nothing, which is the gap; the
// band between the two plates was empty because there was no floor there.
//
// AND THE TEST ABOVE WATCHED IT HAPPEN. It traces a garage and then reads
// the overhead doors, which are dealt BEFORE the throw -- so it passed on
// every run while the second storey came out hollow. That is the whole
// reason these are asked of the ROOM: a check that stops at the ground floor
// cannot see a build that stops after it.
//
// AN L, NOT A RECTANGLE, because his was: the design deals a rectangle's
// four edges and a traced loop can have six, which left the two extra walls
// blank once the crash was fixed -- one of them the front he was looking at.
const TRACED_L = [[0, 0], [0, -18], [-16, -18], [-16, -27], [-38, -27], [-38, 0]];

async function traceGarage(page, corners, entry = 'detached-frostwall') {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator('[data-drivethru-outline]').first().click();
  await page.waitForTimeout(200);
  // THE SEED AGAIN. TRACED_L's first corner is ON the datum, which is worse
  // than being away from it: the first press would land a second corner on
  // top of the seeded one and leave a zero-length edge in the loop.
  await h.dropSeededCorner(page);
  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  const scale = Number(hit[1]);
  const box = await page.locator('#plan').boundingBox();
  for (const [x, z] of [...corners, corners[0]]) {
    await page.mouse.click(box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(200);
  if (await page.locator('#corner-join').isVisible().catch(() => false)) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(700);
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return h.savedDrawing(page);
}

test('a traced 2 storey garage gets its deck, its roof and its windows',
  async ({ page }) => {
    await open(page);
    const saved = await traceGarage(page, TRACED_L);
    const upperWalls = (saved.walls || [])
      .filter(wall => wall.wallType === 'stud_2x6' && Number(wall.levelId) === UPPER);
    expect(upperWalls.length, 'the storey over the garage never went up').toBe(TRACED_L.length);
    // THE THREE HE NAMED, in the order he named them.
    expect(upperOpenings(saved).length, 'the room came out with no windows')
      .toBeGreaterThan(0);
    expect((saved.roofs || []).length, 'nothing roofed it').toBeGreaterThan(0);
    expect((saved.floors || []).some(floor => Number(floor.levelId) === UPPER),
      'the room stands on no deck -- the gap he saw between the two plates').toBe(true);
  });

test('and every wall of it takes its share, not just a rectangle\'s four',
  async ({ page }) => {
    await open(page);
    const saved = await traceGarage(page, TRACED_L);
    const upperWalls = (saved.walls || [])
      .filter(wall => wall.wallType === 'stud_2x6' && Number(wall.levelId) === UPPER);
    const hosts = new Set(upperOpenings(saved).map(item => String(item.wallId)));
    // THE LONG FRONT IS THE ONE THAT WENT BLANK. On this loop it is the 38 ft
    // run, the last edge of six -- past where a four-edge design can reach,
    // and the wall his elevation was looking at.
    const longest = upperWalls.reduce((best, wall) => {
      const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      return !best || len > best.len ? { wall, len } : best;
    }, null);
    expect(hosts.has(String(longest.wall.id)),
      `the ${longest.len.toFixed(0)} ft wall has no window; hosts: ${[...hosts].join(', ')}`)
      .toBe(true);
    // AND NOT ONE WALL CARRIES THE LOT: a design that fell back to the
    // rectangle would crowd the first four edges and leave the rest bare.
    expect(hosts.size, 'the windows are bunched onto too few walls')
      .toBeGreaterThanOrEqual(4);
  });
