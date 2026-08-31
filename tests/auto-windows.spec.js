// AUTO WINDOWS (board #169): BUILD HOUSE stops leaving the walls bare. The
// bone deals windows onto the exterior faces by the office siting rules —
// front and back maximized, a trapped bedroom rescued on its own side wall,
// one side deliberately left blank until the site plan says which — and every
// one it deals is an ordinary window the drafter can move, resize or delete.
//
// The siting math itself is pinned by proto/auto-windows-harness.js (45
// checks, no browser). These specs pin the layer that matters here: that the
// bone gathers the right geometry, commits real fenestrations, and keeps its
// hands off anything the drafter has touched.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A wide rectangle: the long runs face front (+z) and back (-z), the short
// ones left (-x) and right (+x), matching the E1-E4 section-mark convention.
const HOUSE = [[-20, -14], [20, -14], [20, 14], [-20, 14]];

async function traceOutline(page, points) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);
}

// Which way a wall faces, worked out from the drawing exactly as the plan
// reads it: E1 is south (+z), E3 north, E2 west, E4 east.
function orientationOf(wall, walls) {
  const cx = walls.reduce((s, w) => s + (w.start.x + w.end.x) / 2, 0) / walls.length;
  const cz = walls.reduce((s, w) => s + (w.start.z + w.end.z) / 2, 0) / walls.length;
  const mx = (wall.start.x + wall.end.x) / 2, mz = (wall.start.z + wall.end.z) / 2;
  const dx = mx - cx, dz = mz - cz;
  if (Math.abs(dz) >= Math.abs(dx)) return dz >= 0 ? 'front' : 'back';
  return dx <= 0 ? 'left' : 'right';
}

// Auto windows on one level, tallied by the face they landed on.
function windowsByFace(saved, levelId) {
  const walls = saved.walls.filter(w => w.levelId === levelId && (w.view || 'plan') === 'plan');
  const byId = new Map(walls.map(w => [w.id, w]));
  const tally = { front: 0, back: 0, left: 0, right: 0 };
  saved.fenestrations
    .filter(o => o.type === 'window' && o.auto === true && o.levelId === levelId)
    .forEach(o => {
      const wall = byId.get(o.wallId);
      if (wall) tally[orientationOf(wall, walls)] += 1;
    });
  return tally;
}

const autoWindows = saved => saved.fenestrations.filter(o => o.type === 'window' && o.auto === true);

test('the bone maximizes the front and back and leaves one side deliberately bare', async ({ page }) => {
  await h.openModel(page, { autoWindows: true });
  await traceOutline(page, HOUSE);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const main = saved.walls.find(w => w.levelId === 3);
  expect(main).toBeTruthy();
  const tally = windowsByFace(saved, 3);

  // Front and back are the faces the office maximizes.
  expect(tally.front).toBeGreaterThanOrEqual(2);
  expect(tally.back).toBeGreaterThanOrEqual(2);
  // With no bedroom trapped, the LEFT side takes the windows and the right
  // wall stays blank. One bare wall is the rule, not a bug.
  expect(tally.left).toBeGreaterThanOrEqual(2);
  expect(tally.right).toBe(0);
});

test('an auto window is an ordinary window, not a special object', async ({ page }) => {
  await h.openModel(page, { autoWindows: true });
  await traceOutline(page, HOUSE);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const dealt = autoWindows(saved);
  expect(dealt.length).toBeGreaterThan(0);
  dealt.forEach(opening => {
    expect(opening.type).toBe('window');
    expect(opening.layer).toBe('A-GLAZ');       // the ordinary glazing layer
    expect(opening.view).toBe('plan');
    expect(opening.width).toBeCloseTo(30 / 12, 5);      // W 30x42, the default
    expect(opening.headHeight - opening.sillHeight).toBeCloseTo(42 / 12, 5);
    expect(opening.headHeight).toBeGreaterThan(opening.sillHeight);
    expect(typeof opening.wallId).toBe('string');
  });
});

test('nothing is dealt until the drafter asks for it', async ({ page }) => {
  // The seeded default for the suite is OFF, so a legacy build is untouched.
  await h.openModel(page);
  await traceOutline(page, HOUSE);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(autoWindows(saved)).toHaveLength(0);
});

test('the openings never crowd each other or run into a corner', async ({ page }) => {
  await h.openModel(page, { autoWindows: true });
  await traceOutline(page, HOUSE);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const walls = new Map(saved.walls.map(w => [w.id, w]));
  const byWall = {};
  saved.fenestrations
    .filter(o => o.levelId === 3 && (o.view || 'plan') === 'plan')
    .forEach(o => { (byWall[o.wallId] = byWall[o.wallId] || []).push(o); });

  let checked = 0;
  Object.entries(byWall).forEach(([wallId, list]) => {
    const wall = walls.get(wallId);
    if (!wall) return;
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    list.sort((a, b) => a.offset - b.offset).forEach((o, i) => {
      // 2'-0" off each corner.
      expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(2 - 0.001);
      expect(o.offset + o.width / 2).toBeLessThanOrEqual(len - 2 + 0.001);
      const next = list[i + 1];
      if (next) {
        // 3'-0" of wall between them.
        const gap = (next.offset - next.width / 2) - (o.offset + o.width / 2);
        expect(gap).toBeGreaterThanOrEqual(3 - 0.001);
      }
      checked += 1;
    });
  });
  expect(checked).toBeGreaterThan(0);
});

test('a re-press re-deals its own hand without doubling up', async ({ page }) => {
  await h.openModel(page, { autoWindows: true });
  await traceOutline(page, HOUSE);
  await buildHouse(page);
  const first = autoWindows(await h.savedDrawing(page));
  expect(first.length).toBeGreaterThan(0);

  await buildHouse(page);
  const second = autoWindows(await h.savedDrawing(page));

  // The same house deals the same hand — not twice the windows.
  expect(second).toHaveLength(first.length);
  const spot = list => list.map(o => `${o.wallId}@${o.offset.toFixed(3)}`).sort();
  expect(spot(second)).toEqual(spot(first));
});

test('a wall the drafter has opened himself is left to him', async ({ page }) => {
  await h.openModel(page, { autoWindows: true });
  await traceOutline(page, HOUSE);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const walls = saved.walls.filter(w => w.levelId === 3 && (w.view || 'plan') === 'plan');
  // The LEFT wall is the window side, so it is where the dealer is working
  // and where a hand-placed opening actually costs it something.
  const side = walls.find(w => orientationOf(w, walls) === 'left');
  expect(side).toBeTruthy();
  const len = Math.hypot(side.end.x - side.start.x, side.end.z - side.start.z);
  const u = { x: (side.end.x - side.start.x) / len, z: (side.end.z - side.start.z) / len };
  const dealt = saved.fenestrations.filter(o => o.wallId === side.id && o.auto === true);
  expect(dealt.length).toBeGreaterThan(0);

  // A spot on that wall the dealer left free, clear of its own openings.
  const spot = [...Array(Math.floor(len))].map((_, i) => i + 0.5)
    .find(at => at > 4 && at < len - 4
      && dealt.every(o => Math.abs(o.offset - at) > 6));
  expect(spot).toBeTruthy();
  const at = { x: side.start.x + u.x * spot, z: side.start.z + u.z * spot };

  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
  await h.clickWorld(page, at.x, at.z);
  await h.waitForSaved(page);

  // Take the opening as the app actually recorded it: levels stack at these
  // coordinates, so which wall id it binds to is the app's call, not ours.
  const mine = (await h.savedDrawing(page)).fenestrations.filter(o => o.auto !== true);
  expect(mine.length).toBeGreaterThan(0);
  const his = mine[0];

  await buildHouse(page);
  const after = await h.savedDrawing(page);

  // His wall is his: the dealer skips that whole face rather than working
  // around him, and his own opening is left exactly as he placed it.
  expect(after.fenestrations.filter(o => o.wallId === his.wallId && o.auto === true)).toHaveLength(0);
  const still = after.fenestrations.filter(o => o.wallId === his.wallId && o.auto !== true);
  expect(still.length).toBe(1);
  expect(still[0].offset).toBeCloseTo(his.offset, 5);
  expect(still[0].width).toBeCloseTo(his.width, 5);
  // And the rest of the house still got its deal.
  expect(autoWindows(after).length).toBeGreaterThan(0);
});

// ── The garage door face ───────────────────────────────────────────────
// The ruleset itself is pinned here against the module as the browser
// loads it; that the wiring leaves legacy garages alone is pinned by
// detached-garage.spec.js, which runs with this board seeded off.

test('a step-back garage puts its door on the street face, in two singles when the run fits', async ({ page }) => {
  await h.openModel(page, { autoWindows: true });
  const plan = await page.evaluate(() => window.DraftAutoWindows.garageDoorPlan({
    faces: [
      { index: 0, orientation: 'front', lengthFt: 24, behindHouseFront: false },
      { index: 1, orientation: 'left', lengthFt: 22, behindHouseFront: true },
      { index: 2, orientation: 'back', lengthFt: 24, behindHouseFront: true },
      { index: 3, orientation: 'right', lengthFt: 22, behindHouseFront: true },
    ],
    manDoorFaceIndex: 1,
  }));
  expect(plan.faceIndex).toBe(0);                 // the street face
  expect(plan.orientation).toBe('front');
  expect(plan.doors).toHaveLength(2);             // 24' fits a pair
  plan.doors.forEach(door => {
    expect(door.widthFt).toBe(8);
    expect(door.headFt).toBe(7);
  });
  // The pair keeps the same 3'-0" pier the windows keep.
  expect(Math.abs(plan.doors[1].offset - plan.doors[0].offset)).toBeGreaterThanOrEqual(8 + 3 - 1e-9);
});

test('an ambiguous rectangle lands the garage door opposite the man-door connection', async ({ page }) => {
  await h.openModel(page, { autoWindows: true });
  const square = index => ({ index, lengthFt: 20 });
  const plan = await page.evaluate(faces => window.DraftAutoWindows.garageDoorPlan({
    faces, manDoorFaceIndex: 2,
  }), [
    { ...square(0), orientation: 'front' }, { ...square(1), orientation: 'left' },
    { ...square(2), orientation: 'back' }, { ...square(3), orientation: 'right' },
  ]);
  // No step-back cue anywhere, so the man door decides: nobody walks
  // through the car to get into the house.
  expect(plan.faceIndex).toBe(0);
  expect(plan.reason).toMatch(/opposite/);

  // A short run cannot take a pair, so it falls back to one double.
  const narrow = await page.evaluate(() => window.DraftAutoWindows.garageDoorPlan({
    faces: [{ index: 0, orientation: 'front', lengthFt: 20 }],
  }));
  expect(narrow.doors).toHaveLength(1);
  expect(narrow.doors[0].widthFt).toBe(16);
});
