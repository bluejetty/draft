// TOY MODE GRIP TABS — turtle path step 2, and the first UI the mode has.
//
// A wall the toy may move wears a tab. Drag it and the wall moves in whole
// feet; when it can go no further IT STOPS AT THE POSITION THE RULE ALLOWS AND
// THE THING THAT STOPPED IT SAYS WHY.
//
// ── THE RULING THESE SPECS EXIST TO PROTECT ─────────────────────────────
//
//   THE WALL STOPS DEAD. THE BLOCKER SAYS WHY. NEVER ELASTIC.
//
// (Movie, 1 Sep 2026.) Rubber-banding is the one option that is wrong rather
// than merely weaker: it puts a refused position on screen in a mode whose
// entire claim is that it cannot show you an invalid house, and on a
// touchscreen a wall that stretches reads as "push harder" — fighting the rule
// instead of seeing it. So the preview and the committed geometry are the same
// geometry, and neither is ever the finger's.
//
// Stopping SILENTLY fails the other way: on an iPad "nothing happened" reads
// as "it didn't take my touch". Hence the line, in the room's words.
//
// Every decision about how far a wall may go belongs to toy-constraints.js and
// every measurement of the house to toy-context.js — both proved in node, in
// proto/toy-constraints-harness.js and proto/toy-context-harness.js. What is
// pinned here is only what the UI does with the verdict, observed the way the
// rest of the suite observes: the overlay canvas and the saved file.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// TOY MODE's door is a query flag until the real switch is built (step 5).
const openToy = page => h.openModel(page, { webgl: false, search: '?toy=1' });

const TAB_BLUE = [44, 110, 155];      // #2c6e9b, the tab's edge
const BLOCK_ORANGE = [217, 119, 6];   // #d97706, the blocker's highlight
const WALL_INK = [29, 31, 32];        // #1d1f20, a plan wall
const TAB_OFFSET_PX = 18;             // TOY_TAB_OFFSET_PX in MODEL

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// The T-square is on full time, so an ordinary drawn wall is always square.
// Putting it down is the only way to get a genuinely angled wall into the
// drawing -- which is the geometry the toy has to be silent about.
async function drawAngledWall(page, x1, z1, x2, z2) {
  await page.keyboard.press('t');
  await expect(page.locator('[data-mode-tsquare]')).toHaveAttribute('title', /T-SQUARE off/i);
  await drawWall(page, x1, z1, x2, z2);
  await page.keyboard.press('t');
  await expect(page.locator('[data-mode-tsquare]')).toHaveAttribute('title', /T-SQUARE on/i);
}

// A 26x10 house split down the middle. The partition Ts into the north and
// south walls rather than meeting them end to end, so it is its own weld group
// and is the wall that actually flexes; the four shell walls weld into one.
async function drawTwoRoomHouse(page, partitionX = 0) {
  await drawWall(page, -13, -5, 13, -5);
  await drawWall(page, 13, -5, 13, 5);
  await drawWall(page, 13, 5, -13, 5);
  await drawWall(page, -13, 5, -13, -5);
  await drawWall(page, partitionX, -5, partitionX, 5);
}

// A closet makes the west room a BEDROOM, so it is graded against the company
// minimums (97 sq ft, 9'-8" least dimension) instead of being an unrated room
// the toy has no opinion about at all. Two clicks along the wall set its width.
async function closetOnNorthWall(page, x1, x2) {
  await h.selectTool(page, 'Fixture');
  await page.getByRole('button', { name: 'CLOSET', exact: true }).click();
  await h.clickWorld(page, x1, -4.6);
  await h.clickWorld(page, x2, -4.6);
  await h.waitForSaved(page);
}

// Where a wall's tab lands on screen: the midpoint of the wall, pushed
// TOY_TAB_OFFSET_PX along the wall's own LEFT normal — +90° from start→end, so
// a wall running along +x points its left at −z.
async function tabSpot(page, x1, z1, x2, z2) {
  const mid = await h.worldToClient(page, (x1 + x2) / 2, (z1 + z2) / 2);
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz) || 1;
  return { x: mid.x + (dz / len) * TAB_OFFSET_PX, y: mid.y + (-dx / len) * TAB_OFFSET_PX };
}

const inkAt = async (page, spot, colour, radius = 10) =>
  h.countColor(await h.overlayPixels(page, spot.x, spot.y, radius), colour);

// The whole overlay, for asking "is the blocker lit anywhere at all" without
// having to know which wall the verdict picked.
const inkAnywhere = (page, [r, g, b]) => page.evaluate(([red, green, blue]) => {
  const canvas = document.querySelector('[data-model-overlay]');
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    if (Math.abs(data[i] - red) <= 26 && Math.abs(data[i + 1] - green) <= 26
      && Math.abs(data[i + 2] - blue) <= 26) count += 1;
  }
  return count;
}, [r, g, b]);

const hasTabAt = async (page, ...wall) =>
  (await inkAt(page, await tabSpot(page, ...wall), TAB_BLUE)) > 0;

const message = page => page.locator('[data-model-drawing-message]');

// Drag a tab `feet` along world x, in steps, so the move handler sees the
// stream of events a finger would rather than one jump.
async function dragTabBy(page, spot, feet, { steps = 8, settle = 0, release = true } = {}) {
  const zero = await h.worldToClient(page, 0, 0);
  const there = await h.worldToClient(page, feet, 0);
  const travel = there.x - zero.x;
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(spot.x + travel * i / steps, spot.y);
    if (settle) await page.waitForTimeout(settle);
  }
  if (release) { await page.mouse.up(); await h.waitForSaved(page); }
}

const wallNear = (walls, x1, z1, x2, z2) => walls.find(wall =>
  (h.near(wall.start.x, x1, 0.2) && h.near(wall.start.z, z1, 0.2)
    && h.near(wall.end.x, x2, 0.2) && h.near(wall.end.z, z2, 0.2))
  || (h.near(wall.start.x, x2, 0.2) && h.near(wall.start.z, z2, 0.2)
    && h.near(wall.end.x, x1, 0.2) && h.near(wall.end.z, z1, 0.2)));

test.describe('TOY MODE grip tabs', () => {
  test('a square wall wears a tab; an angled one, and its neighbour, do not', async ({ page }) => {
    await openToy(page);
    await drawWall(page, -20, -8, -8, -8);        // square, on its own
    await drawAngledWall(page, 2, -8, 10, -2);   // genuinely angled
    await drawWall(page, 10, -2, 10, 8);         // square, but welded to the angled one
    await page.waitForTimeout(200);

    // Confirm the drawing really holds an angled wall: with the T-square on
    // full time it is easy to write this test against three square walls and
    // watch it pass for the wrong reason.
    const drawn = h.allWalls(await h.savedDrawing(page));
    expect(drawn.some(wall => Math.abs(wall.start.x - wall.end.x) > 0.1
      && Math.abs(wall.start.z - wall.end.z) > 0.1)).toBe(true);

    expect(await hasTabAt(page, -20, -8, -8, -8)).toBe(true);
    // Silence is the honest presentation of "the toy has no opinion here". A
    // tab that never works is worse than no tab, and non-orthogonal geometry
    // spreads its inertness by contact — so the square wall touching the
    // angled one is just as tabless as the angled one itself.
    expect(await hasTabAt(page, 2, -8, 10, -2)).toBe(false);
    expect(await hasTabAt(page, 10, -2, 10, 8)).toBe(false);
  });

  test('one tab per weld group, not one per wall', async ({ page }) => {
    await openToy(page);
    await drawTwoRoomHouse(page);
    await page.waitForTimeout(200);

    // Five walls, two weld groups. Two tabs that always moved together would
    // be a lie about what the house is, so the four-wall shell shows one
    // between them and the partition — which Ts in rather than welding —
    // shows its own.
    const shell = [
      [-13, -5, 13, -5], [13, -5, 13, 5], [13, 5, -13, 5], [-13, 5, -13, -5],
    ];
    const onShell = [];
    for (const wall of shell) onShell.push(await hasTabAt(page, ...wall));
    expect(onShell.filter(Boolean).length).toBe(1);
    expect(await hasTabAt(page, 0, -5, 0, 5)).toBe(true);
  });

  test('dragging 3.14 feet moves the wall three feet, not 3.14', async ({ page }) => {
    await openToy(page);
    await drawTwoRoomHouse(page);
    await page.waitForTimeout(200);

    await dragTabBy(page, await tabSpot(page, 0, -5, 0, 5), 3.14);

    // The MOVE is quantised, never the position: the wall goes a whole number
    // of feet from where it stood.
    const walls = h.allWalls(await h.savedDrawing(page));
    const moved = wallNear(walls, 3, -5, 3, 5);
    expect(moved).toBeTruthy();
    expect(moved.start.x).toBeCloseTo(3, 4);
    expect(moved.end.x).toBeCloseTo(3, 4);
    // And it did not drift along the walls it runs between.
    expect(Math.abs(moved.start.z)).toBeCloseTo(5, 4);
  });

  test('the toy never corrects what it did not create', async ({ page }) => {
    await openToy(page);
    await drawWall(page, -13, -5, 13, -5);
    await drawWall(page, 13, -5, 13, 5);
    await drawWall(page, 13, 5, -13, 5);
    await drawWall(page, -13, 5, -13, -5);
    // A partition deliberately off the foot. The drawing grid quantises to a
    // sixteenth, so this lands near -1.386 and nowhere near a whole foot --
    // which is the whole point.
    await drawWall(page, -1.386, -5, -1.386, 5);
    await page.waitForTimeout(200);

    const before = h.allWalls(await h.savedDrawing(page))
      .find(wall => Math.abs(wall.start.x + 1.386) < 0.05 && Math.abs(wall.start.z) > 4);
    expect(before).toBeTruthy();
    expect(Number.isInteger(before.start.x)).toBe(false);

    await dragTabBy(page, await tabSpot(page, before.start.x, -5, before.start.x, 5), 1);

    const after = h.allWalls(await h.savedDrawing(page))
      .find(wall => Math.abs(wall.start.x - (before.start.x + 1)) < 0.02
        && Math.abs(wall.start.z) > 4);
    // A WHOLE FOOT FROM WHERE IT WAS -- not snapped to -1, and not to 0. A
    // beginner cannot be blamed for a wall shifting 4 1/2" they never asked to
    // move, and old drawings opening unchanged is a standing constraint here.
    expect(after).toBeTruthy();
    expect(after.start.x - before.start.x).toBeCloseTo(1, 4);
    expect(Number.isInteger(after.start.x)).toBe(false);
  });

  test('a drag into a room minimum stops at the permitted foot, never at the finger', async ({ page }) => {
    await openToy(page);
    await drawTwoRoomHouse(page);
    await closetOnNorthWall(page, -10, -6);
    await page.waitForTimeout(200);

    // Ask for eight feet west. The bedroom cannot give that up, so while the
    // finger is still out at eight the wall must already be standing on the
    // permitted foot.
    await dragTabBy(page, await tabSpot(page, 0, -5, 0, 5), -8, { release: false });

    const finger = await h.worldToClient(page, -8, 0);
    // THE PIXEL POSITION IS NEVER THE FINGER'S. This is the assertion the
    // rubber-band version of this feature would fail, and the reason the
    // ruling exists.
    expect(await inkAt(page, finger, WALL_INK, 6)).toBe(0);

    await page.mouse.up();
    await h.waitForSaved(page);

    const walls = h.allWalls(await h.savedDrawing(page));
    const moved = walls.find(wall => Math.abs(wall.start.z) > 4 && Math.abs(wall.end.z) > 4
      && Math.abs(wall.start.x - wall.end.x) < 0.01 && Math.abs(wall.start.x) < 12);
    expect(moved).toBeTruthy();
    // It moved, it moved WEST, it stopped short of the eight asked for, and it
    // stopped on a whole foot. Committing decided nothing the preview had not
    // already settled.
    expect(moved.start.x).toBeLessThan(0);
    expect(moved.start.x).toBeGreaterThan(-8);
    expect(moved.start.x).toBeCloseTo(Math.round(moved.start.x), 4);
  });

  test('the refusal is in the room\'s words, and the blocker is highlighted', async ({ page }) => {
    await openToy(page);
    await drawTwoRoomHouse(page);
    await closetOnNorthWall(page, -10, -6);
    // Tag the rooms so the line can call the room by the name the user reads.
    await h.selectTool(page, 'Annotation');
    await page.locator('[data-room-tags]').click();
    await h.waitForSaved(page);
    await page.waitForTimeout(200);

    await dragTabBy(page, await tabSpot(page, 0, -5, 0, 5), -8,
      { release: false, steps: 6, settle: 90 });

    // A beginner who reads this has learned something about houses. MIN_ROOM
    // teaches nothing and reads as an error.
    await expect(message(page)).toContainText(/would be under/i);
    const said = await message(page).textContent();
    expect(said).not.toMatch(/MIN_ROOM|NOT_ORTHOGONAL|CANTILEVER|OPENING_WOULD/);
    expect(said).toMatch(/BEDR|ROOM/i);
    // A real dimension or a real area, never a bare code.
    expect(said).toMatch(/\d+'-\d+"|\d+ sq ft/);

    // And the wall that stopped the drag wears the highlight.
    const onWall = await h.worldToClient(page, -1, 0);
    expect(await inkAt(page, onWall, BLOCK_ORANGE, 8)).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test('the same rule leaned on twice in one drag speaks once', async ({ page }) => {
    await openToy(page);
    await drawTwoRoomHouse(page);
    await closetOnNorthWall(page, -10, -6);
    await page.waitForTimeout(200);

    const spot = await tabSpot(page, 0, -5, 0, 5);
    const zero = await h.worldToClient(page, 0, 0);
    const perFoot = (await h.worldToClient(page, 1, 0)).x - zero.x;
    // Four small moves over ~400ms: comfortably longer than the hold the
    // blocker waits out before it speaks, so a lean that SHOULD produce a line
    // always has. A shorter push is the graze the delay exists to stay quiet
    // about, and would make this test prove nothing.
    const lean = async feet => {
      for (let i = 0; i < 4; i++) {
        await page.mouse.move(spot.x + feet * perFoot - i, spot.y);
        await page.waitForTimeout(100);
      }
    };

    await page.mouse.move(spot.x, spot.y);
    await page.mouse.down();

    // Lean on the limit until it speaks. The blocker lighting up IS the line
    // being said -- they are set together.
    await lean(-8);
    expect(await inkAnywhere(page, BLOCK_ORANGE)).toBeGreaterThan(0);
    await expect(message(page)).toContainText(/would be under/i);

    // Ease off to somewhere legal: self-clearing, with nothing to dismiss.
    await lean(-1);
    expect(await inkAnywhere(page, BLOCK_ORANGE)).toBe(0);

    // Lean on the SAME rule again, just as long. It does not speak twice --
    // no chattering while the user keeps pushing at the wall that will not
    // move. This is the assertion that fails if the once-per-rule bookkeeping
    // is dropped, because the highlight would come straight back.
    await lean(-8);
    expect(await inkAnywhere(page, BLOCK_ORANGE)).toBe(0);

    await page.mouse.up();
    await h.waitForSaved(page);
    expect(await inkAnywhere(page, BLOCK_ORANGE)).toBe(0);
  });

  test('in a weld group the highlight lands on the blocker, not the grabbed wall', async ({ page }) => {
    await openToy(page);
    await drawWall(page, -13, -5, 13, -5);
    await drawWall(page, 13, -5, 13, 5);
    await drawWall(page, 13, 5, -13, 5);
    await drawWall(page, -13, 5, -13, -5);
    // The partition in TWO collinear halves meeting at (0,0). They meet end to
    // end, so they weld into one group and move together -- and either can be
    // the one that stops the drag while the other is under the finger.
    await drawWall(page, 0, -5, 0, 0);
    await drawWall(page, 0, 0, 0, 5);
    await closetOnNorthWall(page, -10, -6);
    await page.waitForTimeout(200);

    // One tab between the two halves, because they are one group.
    const north = await hasTabAt(page, 0, -5, 0, 0);
    const south = await hasTabAt(page, 0, 0, 0, 5);
    expect([north, south].filter(Boolean).length).toBe(1);

    const grabbed = north ? [0, -5, 0, 0] : [0, 0, 0, 5];
    await dragTabBy(page, await tabSpot(page, ...grabbed), -8,
      { release: false, steps: 6, settle: 90 });
    await expect(message(page)).toContainText(/would be under/i);

    // Both halves now stand at the permitted foot, one above z=0 and one
    // below, so which of them wears the highlight is readable off the canvas.
    const permitted = -1;
    const onNorth = await inkAt(page, await h.worldToClient(page, permitted, -2.5), BLOCK_ORANGE, 7);
    const onSouth = await inkAt(page, await h.worldToClient(page, permitted, 2.5), BLOCK_ORANGE, 7);
    // Exactly one half is lit: the highlight is a wall, not the whole group.
    expect((onNorth > 0) !== (onSouth > 0)).toBe(true);
    // And it is the half that ISN'T under the finger. In a welded group the
    // wall that stops you is usually not the one you grabbed, and lighting up
    // the grabbed one would teach the wrong rule.
    expect(north ? onSouth > 0 : onNorth > 0).toBe(true);
    await page.mouse.up();
  });

  test('without the flag there is no tab anywhere', async ({ page }) => {
    // The door is temporary, but while it is the door it has to work both
    // ways: an ordinary drafting session must be untouched by any of this.
    await h.openModel(page, { webgl: false });
    await drawTwoRoomHouse(page);
    await page.waitForTimeout(200);
    expect(await hasTabAt(page, 0, -5, 0, 5)).toBe(false);
    expect(await hasTabAt(page, -13, -5, 13, -5)).toBe(false);
  });
});
