// THE PREMADE BUNGALOW — what the drive-thru's bone hands over.
//
// Movie, 18 Sep: "we shouldn't put it in the drivethru window yet, i'd just
// like to offer them premade designs in there at the beginning", and then the
// design itself, in his own numbers: 32 wide, 40 long, a 24 ft garage 26 long
// whose right wall stands 4 ft proud of the house's toward the property line,
// with that one wall running the extra foot -- 27 -- so the foundations
// connect through a whole foot of building rather than a wall thickness.
//
// THE ARITHMETIC IS CHECKED IN THE HARNESS, not here. proto/premade-plans-
// harness.js measures the plan itself, twenty-five ways, because the plan is
// pure and a harness can mutate it. What this file is for is everything
// between the plan and the drawing: that the press reaches it, that both
// bodies land, that the garage is stored as an ATTACHED one, and that one
// Ctrl+Z takes the whole order back.
//
// SO THE ASSERTIONS HERE ARE ABOUT THE RECORD AND THE MODULE AGREEING. Where a
// dimension appears it is read out of premade-plans.js rather than typed in
// again -- a spec that hard-coded 32 would pass on a page that had stopped
// asking the module and grown its own copy of the number, which is the exact
// failure the module exists to prevent.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// An EMPTY sheet, because a premade design is what a project starts with.
// The bone fixture's house would trip the one-house cap before anything
// interesting happened.
//
// THE WHOLE LEVEL STACK, and that is not decoration. A bone press raises a
// building ACROSS the levels -- storey walls on MAIN FL, concrete on
// FOUNDATION, the roof on ROOF -- and drawing-format.js drops any record whose
// levelId the drawing does not list. A fixture with MAIN FL alone would write
// a foundation into a file that loses it on the next open, and every check
// below would pass while measuring the page's memory rather than the drawing.
const empty = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  // The readout's TEXT, not its visibility: it is a debug strip and starts
  // hidden, so toBeVisible waits for ever on a page that loaded perfectly.
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// Order a type at the window and press the bone on the post.
async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(250);
}

async function saveOnNewPage(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

// THE PLAN AS THE PAGE ITSELF HOLDS IT. Every dimension below comes from here
// rather than from a number typed into this file.
const planned = page => page.evaluate(() => {
  const P = window.DraftPremadePlans;
  return {
    width: P.WIDTH_FT, depth: P.DEPTH_FT,
    garageWidth: P.GARAGE_WIDTH_FT, garageDepth: P.GARAGE_DEPTH_FT,
    past: P.GARAGE_PAST_FT, tie: P.GARAGE_TIE_FT,
  };
});

const span = (points, axis) => {
  const values = points.map(point => point[axis]);
  return Math.max(...values) - Math.min(...values);
};

// WALLS COUNTED BY WHERE THEY LIVE, not in total. A bone press now raises a
// building across the stack -- studs on the storey, concrete on FOUNDATION --
// so a bare total answers "did enough walls appear" and never "did the right
// walls appear on the right sets". Two of the checks below used to read a
// total and both had to change when the foundation arrived; keyed counts say
// what changed instead of just how much.
const wallsBy = saved => (saved?.walls || []).reduce((tally, wall) => {
  // THE BODY IS PART OF THE KEY, because a house's foundation wall and a
  // garage's grade beam are both `concrete_8` on the same set and are not the
  // same thing at all -- one stands on a footing, the other hangs off grade.
  // Without it this tally said "8 concrete walls" and could not say whose.
  const key = `L${wall.levelId}/${wall.view}/${wall.wallType}`
    + (wall.body ? `/${wall.body}` : '');
  tally[key] = (tally[key] || 0) + 1;
  return tally;
}, {});

const houseOf = saved => (saved?.outlines || []).find(o => o.garage !== true) || null;
const garageOf = saved => (saved?.outlines || []).find(o => o.garage === true) || null;

test('1 STOREY builds the bungalow off the window bone', async ({ page }) => {
  await open(page);
  const plan = await planned(page);

  await order(page, 'bungalow', 'bungalow');
  await saveOnNewPage(page);

  const saved = await savedFile(page);
  const house = houseOf(saved);
  expect(house, 'a house outline reached the file').not.toBeNull();
  expect(span(house.points, 'x')).toBeCloseTo(plan.width, 3);
  expect(span(house.points, 'z')).toBeCloseTo(plan.depth, 3);

  // A WALL ON EVERY SIDE, which is the half an outline check cannot see: the
  // ordered garage taught this page that a loop with no walls renders as a
  // house and is a guide line.
  //
  // AND ON THE RIGHT SET. Movie, 19 Sep: "the current houses are missing
  // foundation and roof you only did the main level so far it looks like".
  // The studs go on the storey and the concrete goes on FOUNDATION, which is
  // MODEL.dc.html's _buildHouse calling _buildHouseWalls once per level with
  // the level and the view as arguments.
  expect(wallsBy(saved), 'studs on the storey, concrete on FOUNDATION')
    .toEqual({ 'L3/plan/stud_2x6': 4, 'L1/foundation/concrete_8': 4 });

  // 1 STOREY ON ITS OWN CARRIES NO GARAGE. Without this the plain tile could
  // hand over the tile beside it and nothing here would notice.
  expect(garageOf(saved), 'no garage was ordered and none was built').toBeNull();
});

test('1 STOREY + GARAGE raises both bodies, and the garage is an ATTACHED one',
  async ({ page }) => {
    await open(page);
    const plan = await planned(page);

    await order(page, 'bungalow', 'bungalow-garage');
    await saveOnNewPage(page);

    const saved = await savedFile(page);
    const house = houseOf(saved);
    const garage = garageOf(saved);
    expect(house, 'the house went up').not.toBeNull();
    expect(garage, 'and so did the garage').not.toBeNull();

    // ATTACHED, SAID ON THE RECORD. building-bodies.js tells the two apart by
    // `detached === true`, and an attached garage is part of the house it
    // hangs off -- it must NOT spend the detached garage's slot, or the board
    // would refuse the drafter the detached one he is still entitled to.
    expect(garage.detached, 'the record says attached').toBe(false);

    expect(span(garage.points, 'x')).toBeCloseTo(plan.garageWidth, 3);

    // THE LONG SIDE IS THE EXTRA FOOT. 26 deep plus the 1 ft tie that carries
    // the rear wall past the house's front line and onto its side wall.
    expect(span(garage.points, 'z')).toBeCloseTo(plan.garageDepth + plan.tie, 3);

    // AND IT STANDS PROUD ON THE PROPERTY-LINE SIDE by exactly the 4 ft that
    // leaves a man-door wall. Measured against the HOUSE, not against zero:
    // the relation is what Movie specified, and it survives the plan moving.
    const houseRight = Math.max(...house.points.map(p => p.x));
    const garageRight = Math.max(...garage.points.map(p => p.x));
    expect(garageRight - houseRight,
      'the garage-s right wall is 4 ft closer to the lot line than the house-s')
      .toBeCloseTo(plan.past, 3);

    // EIGHT WALLS: four round the house, and four of the garage's six edges.
    // THIS READ TEN, and ten was the defect -- Movie, 18 Sep, with the wall
    // marked in green: "the garage has an extra wall that is not needed. the
    // garage walls should link into the house (look at how the DC version did
    // it)". An attached garage does not raise the edges it shares with the
    // house; the next test is the one that says which, and why.
    // FOUR BODIES OF WALL, and each is a different thing. The garage is
    // framed AND has its own concrete -- a grade beam by default, hanging off
    // grade -- which is not the house's foundation and must not be counted
    // with it.
    expect(wallsBy(saved), 'house studs, garage studs, house foundation, '
      + 'garage grade beam -- four on each of its own edges')
      .toEqual({
        'L3/plan/stud_2x6': 4,
        'L3/plan/stud_2x6/garage': 4,
        'L1/foundation/concrete_8': 4,
        'L1/foundation/concrete_8/garage': 4,
      });
  });

// THE TWO EDGES THE GARAGE DOES NOT OWN, and what happens to the doors when
// they are dropped. Both halves are here together because they are one
// change: taking runs out of the list is what stopped a wall's POSITION
// meaning its edge.
test('the attached garage raises no wall the house already has',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'bungalow-garage');
    await saveOnNewPage(page);

    const saved = await savedFile(page);
    const house = houseOf(saved);
    const garage = garageOf(saved);
    const len = wall => Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);

    // THE MEASUREMENT IS MADE AGAINST THE HOUSE OUTLINE, in the test's own
    // arithmetic rather than through the page's edgeOnLoop. Asking the page
    // whether it obeyed its own rule, using its own rule, is a tautology; this
    // walks the house's corners here.
    const onHouse = pt => house.points.some((corner, index) => {
      const next = house.points[(index + 1) % house.points.length];
      const dx = next.x - corner.x, dz = next.z - corner.z;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-6) return false;
      const t = Math.max(0, Math.min(1,
        ((pt.x - corner.x) * dx + (pt.z - corner.z) * dz) / len2));
      return Math.hypot(pt.x - corner.x - t * dx, pt.z - corner.z - t * dz) <= 0.1;
    });
    const sharesWithHouse = wall => onHouse(wall.start) && onHouse(wall.end)
      && onHouse({ x: (wall.start.x + wall.end.x) / 2,
        z: (wall.start.z + wall.end.z) / 2 });

    // The control, and it is the half that keeps the assertion honest: the
    // GARAGE LOOP still has two such edges. If the plan ever stopped sharing
    // any, "no wall shares one" would be true of a rule that had been deleted.
    const sharedEdges = garage.points.filter((corner, index) => {
      const next = garage.points[(index + 1) % garage.points.length];
      return sharesWithHouse({ start: corner, end: next });
    });
    expect(sharedEdges.length, 'the garage loop still shares two edges with '
      + "the house -- the 20 ft along its front wall and the 1 ft tie down "
      + 'its side').toBe(2);

    const garageCorner = pt => (garage.points || []).some(corner =>
      Math.hypot(corner.x - pt.x, corner.z - pt.z) < 0.01);
    const garageWalls = (saved.walls || [])
      .filter(wall => garageCorner(wall.start) && garageCorner(wall.end));
    // FOUR FRAMED AND FOUR IN CONCRETE, not six of either: the garage owns
    // four of its six edges, and the rule applies to its grade beam exactly
    // as it does to its studs -- the beam is raised through the same
    // raiseLoop, measured against the same house loop.
    expect(garageWalls.filter(w => w.view === 'plan').length,
      'four framed garage walls, not six').toBe(4);
    expect(garageWalls.filter(w => w.view === 'foundation').length,
      'and four of concrete under them, not six').toBe(4);
    for (const wall of garageWalls) {
      expect(sharesWithHouse(wall),
        `the garage wall ${wall.id} stands where no house wall does`).toBe(false);
    }

    // AND THE DOORS FOLLOWED THEIR EDGES. The design keys an opening to an
    // EDGE NUMBER; dropping two runs out of the list is exactly what makes a
    // wall's position stop meaning its edge, and by position the man-door
    // would land on the 27 ft side and the overhead door on the 26 ft one.
    // Both would still have read as "doors on a garage" from any count.
    const byId = new Map((saved.walls || []).map(wall => [String(wall.id), wall]));
    const openings = (saved.fenestrations || []);
    const manDoor = openings.find(o => o.garage !== true && o.width === 2.5);
    const overhead = openings.find(o => o.garage === true);
    expect(manDoor, 'the man-door was written').toBeTruthy();
    expect(overhead, 'and the overhead door').toBeTruthy();
    // 4 ft is the exposed rear wall, the only wall a man-door belongs on --
    // it is why the garage stands proud of the house at all.
    expect(len(byId.get(String(manDoor.wallId))),
      'the man-door is on the 4 ft rear wall').toBeCloseTo(4, 2);
    // 24 ft is the door wall, the garage's full width.
    expect(len(byId.get(String(overhead.wallId))),
      'the overhead door is on the 24 ft door wall').toBeCloseTo(24, 2);
  });

test('the attached garage does not spend the detached garage-s slot',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'bungalow-garage');

    // THE BOARD IS THE WITNESS A DRAFTER WOULD USE. Asking
    // building-bodies.js directly would check the module against itself; what
    // matters is that with a house and an ATTACHED garage standing, the
    // DETACHED one is still on offer -- because an attached garage is part of
    // the house it hangs off and was never the body that fills that slot.
    await h.openDriveThru(page);
    await page.locator('[data-build-family="detachedGarage"]').click();
    await expect(page.locator('[data-build-entry="detached-thickened"]'),
      'the detached garage is still on offer').toBeVisible();
  });

test('a second press is refused rather than stacking a second house',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'bungalow');
    await saveOnNewPage(page);
    const once = (await savedFile(page)).outlines.length;

    await order(page, 'bungalow', 'bungalow');
    const sign = page.locator('[data-drivethru-line]');
    await expect(sign, 'the board says so rather than building in silence')
      .toContainText('ALREADY');

    await saveOnNewPage(page);
    expect((await savedFile(page)).outlines.length,
      'a second bungalow exactly on top of the first looks like one house '
      + 'until something is dragged').toBe(once);
  });

test('one Ctrl+Z takes the whole order back, house and garage together',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'bungalow-garage');
    await saveOnNewPage(page);
    expect((await savedFile(page)).outlines.length).toBe(2);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await saveOnNewPage(page);

    const saved = await savedFile(page);
    // ONE PRESS, ONE UNDO. Left as the walls' own steps, the first Ctrl+Z
    // would take one wall of ten and the drafter would press it nine more
    // times to get back where he started.
    expect(saved.outlines, 'both loops went back').toHaveLength(0);
    expect(saved.walls, 'and every wall with them').toHaveLength(0);
  });

test('the board comes down once it has built what was ordered', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow');

  await expect(page.locator('#drivethru'),
    'the drafter-s next move is to look at his house, and it is behind the sign')
    .toHaveAttribute('data-shut', '');
});

test('building the design puts the trace down with it', async ({ page }) => {
  await open(page);
  // Pressing the tile arms the outline trace through onChoose -- the old
  // page's own two-things-at-once, and it still stands, because a drafter who
  // CLOSES the board instead of pressing the bone means to draw it himself.
  await order(page, 'bungalow', 'bungalow');
  await saveOnNewPage(page);

  // ONCE THE HOUSE IS BUILT HE DOES NOT. An armed trace left over a finished
  // house turns the drafter's next press -- a press at his own new house, to
  // look at it or to pick something on it -- into the first corner of a second
  // one. Nothing on screen would say that had happened until he pressed again.
  const frame = await h.planFrame(page);
  for (const [x, z] of [[-4, -4], [4, -4], [4, 4], [-4, -4]]) {
    const at = frame.at(x, z);
    await page.mouse.click(at[0], at[1]);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(150);

  // THE DIRTY FLAG IS THE WITNESS, not the saved file. The first draft of this
  // read the file back and compared counts -- against the file it had saved
  // BEFORE the presses, which of course had not moved. It passed with the
  // trace armed and the mutation that leaves it armed survived. This page does
  // not autosave: an edit shows up as UNSAVED on the button and nowhere else
  // until somebody presses it.
  await expect(page.locator('#save'),
    'four presses on the finished house drew no second outline -- the page is '
    + 'still exactly what was saved').toHaveText('SAVED');
});

// ── THE DESIGN'S OWN WINDOWS AND DOORS ───────────────────────────────────
//
// Movie, 18 Sep: "i'd like the windows to be in set positions for each house in
// the drivethru menu, but for the 'AUTOHOUSE' when they draw the outline and
// create the house that one could have the fenestrations auto generated" --
// and then "please windows and doors into the bungalow and i'll change them if
// I need to afterwards".
//
// WHERE they go is the harness's business (proto/premade-plans-harness.js
// measures every one against the wall it hangs on, bearing included). What
// this file checks is that they ARRIVE: hung on the right walls, in a shape
// drawing-format.js will keep, and taken back by the same one undo.

const openingsOf = saved => saved?.fenestrations || [];

test('the bungalow arrives with its openings, hung on its own walls',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'bungalow-garage');
    await saveOnNewPage(page);

    const saved = await savedFile(page);
    const openings = openingsOf(saved);
    const planned = await page.evaluate(() => {
      const plan = window.DraftPremadePlans.bungalow({ garage: true });
      return plan.houseOpenings.length + plan.garageOpenings.length;
    });
    expect(openings.length, 'every opening the design names was written')
      .toBe(planned);

    // HOSTED ON WALLS THAT EXIST. An opening whose wallId matches nothing is
    // dropped by the loader without a word, so the drawing would repair itself
    // on the next open and the drafter would never learn what had been lost.
    const wallIds = new Set((saved.walls || []).map(w => String(w.id)));
    for (const o of openings) {
      expect(wallIds.has(String(o.wallId)),
        `opening ${o.id} is hosted on a wall that is in the drawing`).toBe(true);
    }

    // AND IN A SHAPE THE FORMAT KEEPS: a head above the sill, a positive
    // width, a layer matching the type. drawing-format.js:216 drops a record
    // failing any of those.
    for (const o of openings) {
      expect(o.headHeight > o.sillHeight, `${o.id} has a head above its sill`).toBe(true);
      expect(o.width > 0, `${o.id} has a width`).toBe(true);
      expect(o.layer, `${o.id} is on the layer its type calls for`)
        .toBe(o.type === 'door' ? 'A-DOOR' : 'A-GLAZ');
      // NOT THE BONE'S. auto-windows.js re-deals what it dealt; the design's
      // openings are the drafter's from the moment they land.
      expect(o.auto, `${o.id} is the design's, not a dealt one`).toBe(false);
    }

    // THE GARAGE DOOR IS ON THE GARAGE, which is the one that would be easiest
    // to hang on the wrong body: both loops are raised in the same call.
    const garageDoor = openings.find(o => o.garage === true);
    expect(garageDoor, 'the overhead door was written').toBeTruthy();
    const garageWallIds = new Set((saved.walls || [])
      .filter(w => {
        const g = garageOf(saved);
        return (g.points || []).some(p =>
          Math.hypot(p.x - w.start.x, p.z - w.start.z) < 0.01);
      }).map(w => String(w.id)));
    expect(garageWallIds.has(String(garageDoor.wallId)),
      'the overhead door hangs on a garage wall, not a house one').toBe(true);
  });

test('and the loader keeps every one of them', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow-garage');
  await saveOnNewPage(page);
  const written = openingsOf(await savedFile(page)).length;

  // THE ROUND TRIP IS THE ACCEPTANCE. Everything above measures what this page
  // WROTE; this measures what survives being read back, which is the half that
  // catches a record the format refuses. A dropped opening is silent -- the
  // house simply has fewer windows than the design.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const onScreen = await page.evaluate(() =>
    Number(/(\d+)\/\d+/.exec(
      /fenestrations? \d+\/\d+/.exec(document.getElementById('readout').textContent)
      || [''])?.[1] ?? NaN));
  // The readout does not count fenestrations, so the file is the witness: a
  // save after the reload re-writes what the page LOADED.
  await page.locator('#save').click().catch(() => {});
  expect(openingsOf(await savedFile(page)).length,
    'every opening survived the read back').toBe(written);
});

test('one Ctrl+Z takes the openings back with the house', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow-garage');
  await saveOnNewPage(page);
  expect(openingsOf(await savedFile(page)).length).toBeGreaterThan(0);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  await saveOnNewPage(page);

  // LEFT BEHIND, they would be openings hosted on walls that no longer exist
  // -- which the loader drops on the next open, so the drawing repairs itself
  // and nothing ever says the file had been wrong.
  expect(openingsOf(await savedFile(page)),
    'the openings went back with the walls they hung on').toHaveLength(0);
});

// ── THE WHOLE BUILDING, NOT ONE STOREY OF IT ─────────────────────────────
//
// Movie, 19 Sep, looking at a bungalow he had just ordered: "the current
// houses are missing foundation and roof you only did the main level so far
// it looks like". He is right, and the elevations were the visible cost.
//
// MODEL.dc.html:14632 `_buildHouse` is the reference -- his ruling on it is
// "it worked decent in that version not perfect but real nice" -- and it
// raises, from one press: walls and a floor per floor level, then FOUNDATION's
// concrete walls, its slab and its strip footings, then the roof.

// Order a design while looking at FOUNDATION, which is where the entry screen
// leaves a drafter. That was the state Movie reported from.
async function orderFromFoundation(page, entry = 'bungalow') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html?level=1&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', entry);
  await page.keyboard.press('Escape');
  await saveOnNewPage(page);
  return savedFile(page);
}

test('the building goes on the lowest floor level, not the one being looked at',
  async ({ page }) => {
    // THE DEFECT, STATED. buildPremadePlan raised the house on
    // onActiveLevel(), so ordering from the entry screen -- which opens on
    // FOUNDATION -- filed the whole bungalow on level 1. Nothing said so: the
    // walls painted, the file saved, and only the elevations showed it, by
    // being blank.
    const saved = await orderFromFoundation(page);
    const studs = (saved.walls || []).filter(w => w.wallType === 'stud_2x6');
    expect(studs.length, 'the storey was framed').toBe(4);
    for (const wall of studs) {
      expect(wall.levelId, 'a stud wall belongs to the storey, not the '
        + 'foundation the drafter happened to be looking at').toBe(3);
      expect(wall.view).toBe('plan');
    }
    // The control: this is not vacuous only because the order WAS placed from
    // somewhere else. A house on level 1 is what the bug produced.
    expect(studs.every(w => w.levelId !== 1)).toBe(true);
  });

test('it comes with its foundation — walls, slab and footings',
  async ({ page }) => {
    const saved = await orderFromFoundation(page);

    const concrete = (saved.walls || []).filter(w => w.view === 'foundation');
    expect(concrete.length, 'a foundation wall under every storey wall').toBe(4);
    for (const wall of concrete) {
      expect(wall.levelId).toBe(1);
      // The type comes from the page's own foundation choices, never the
      // stud default -- the two lists are DISJOINT, so this is not a near
      // miss but a wall of the wrong kind.
      expect(wall.wallType).toBe('concrete_8');
    }

    // THE SLAB, poured to the level's own thickness, on the FOUNDATION set.
    const slab = (saved.floors || []).find(f => f.structure === 'slab');
    expect(slab, 'the slab was poured').toBeTruthy();
    expect(slab.levelId).toBe(1);
    expect(slab.view).toBe('foundation');
    expect(slab.thickness * 12).toBeCloseTo(3, 2);

    // AND THE STOREY'S OWN FLOOR, which is the other half of _buildHouse's
    // per-level pass and is framed, not poured.
    const deck = (saved.floors || []).find(f => f.structure === 'floor');
    expect(deck, 'the storey got its floor').toBeTruthy();
    expect(deck.levelId).toBe(3);
    expect(deck.view).toBe('floor');
    expect(deck.thickness * 12).toBeCloseTo(12.625, 2);

    // THE STRIP FOOTINGS: two rings, one outside the wall and one inside, so
    // a four-sided house gets eight legs. They are LINES on S-FOOTING, which
    // is what the old page writes -- not a wall and not a floor.
    const footings = (saved.lines || []).filter(l => l.layer === 'S-FOOTING');
    expect(footings.length, 'two rings of four').toBe(8);
    for (const line of footings) {
      expect(line.levelId).toBe(1);
      expect(line.view).toBe('foundation');
    }
  });

test('it comes with its roof, on the ROOF level', async ({ page }) => {
  const saved = await orderFromFoundation(page);
  const roofs = saved.roofs || [];
  expect(roofs.length, 'one roof, not one per storey').toBe(1);
  const roof = roofs[0];
  // MODEL.dc.html's own number: _buildHouseRoof both looks for the footprint
  // on level 7 and refuses a second house roof by testing `levelId === 7`.
  expect(roof.levelId, 'the roof lives on ROOF').toBe(7);
  expect(roof.points.length, 'one corner per corner of the house').toBe(4);
  // EVERY EDGE AN EAVE, which is _buildHouseRoof's own default -- the drafter
  // flips the gables with the ROOF tool, and this page has that gesture.
  expect(roof.edges.every(e => e === 'eave'), 'all eaves to start').toBe(true);
  // It oversails the house by the overhang, so the roof is bigger than the
  // footprint it was cut from. Equal would mean the offset never ran.
  const house = houseOf(saved);
  expect(span(roof.points, 'x')).toBeGreaterThan(span(house.points, 'x'));
});

test('one footprint, not one per ring', async ({ page }) => {
  // The foundation is the SAME loop raised again in concrete. An outline for
  // it would be a second footprint for one building -- which the one-house
  // cap reads as a house already built, and every count of outlines reads as
  // two buildings.
  const saved = await orderFromFoundation(page);
  expect((saved.outlines || []).length, 'one building, one outline').toBe(1);
});

test('and the elevations draw', async ({ page }) => {
  // THE WHOLE POINT, from the drafter's seat. drawElevationView looks each
  // wall's level up in the floor stack and returns false when it collects no
  // faces; drawCutView then prints "The cut line crosses no walls" instead of
  // a house. All four of Movie's elevations read that.
  //
  // MEASURED, NOT GUESSED. With nothing built, E1 covers 0.006 of the canvas
  // -- that is the sentence itself. With the building up: 0.028 to 0.032, a
  // fivefold gap, so the threshold below sits clear of both ends rather than
  // just past one measurement.
  await orderFromFoundation(page);
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    await page.goto(`/MODEL.html?view=cut:${id}`);
    await page.waitForTimeout(600);
    const ink = await page.evaluate(() => {
      const canvas = document.getElementById('plan');
      const { data } = canvas.getContext('2d').getImageData(
        0, 0, canvas.width, canvas.height);
      const bg = [data[0], data[1], data[2]];
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]),
          Math.abs(data[i + 2] - bg[2])) > 12) n += 1;
      }
      return n / (data.length / 4);
    });
    expect(ink, `${id} draws a building, not the "crosses no walls" sentence`)
      .toBeGreaterThan(0.015);
  }
});

test('it writes nothing the reload would lose', async ({ page }) => {
  // A DRAWING WITHOUT A FOUNDATION, which is a drawing somebody made that way
  // -- and a bone press is not permission to restructure it.
  //
  // THE FAILURE THIS GUARDS IS SILENT. drawing-format.js validates every
  // record's levelId against the drawing's own level list and DROPS what it
  // does not recognise, so concrete written to a FOUNDATION this drawing has
  // not got would sit in the file, paint once, and be gone on the next open.
  // Written after a mutation removing the guard survived every other check in
  // this file -- because the fixture above HAS a foundation, so nothing could
  // tell whether the guard was there.
  const noFoundation = {
    ...empty(),
    levels: [
      { id: 7, name: 'ROOF', elev: 0 },
      { id: 3, name: 'MAIN FL', elev: 0 },
    ],
    activeLevelIdx: 1,
  };
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: noFoundation });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', 'bungalow');
  await page.keyboard.press('Escape');
  await saveOnNewPage(page);

  // THE GENERAL FORM, not "no foundation walls": what the page wrote and what
  // a reload keeps must be the same counts. Anything filed against a level
  // the drawing has not got fails this, whatever kind of record it is.
  const kept = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const raw = JSON.parse(await file.text());
    const F = window.DraftDrawingFormat;
    const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
    return {
      wroteWalls: (raw.walls || []).length,
      keptWalls: F.walls(raw.walls, levelIds, {}).length,
      wroteFloors: (raw.floors || []).length,
      keptFloors: F.floors(raw.floors, levelIds, {}).length,
      wroteLines: (raw.lines || []).length,
      keptLines: F.lines(raw.lines, levelIds, {}).length,
      wroteRoofs: (raw.roofs || []).length,
      keptRoofs: F.roofs(raw.roofs, levelIds).length,
    };
  }, BUCKET);

  expect(kept.wroteWalls, 'the storey was still framed').toBe(4);
  expect(kept.keptWalls, 'and every wall survives the reload').toBe(kept.wroteWalls);
  expect(kept.keptFloors, 'every floor survives').toBe(kept.wroteFloors);
  expect(kept.keptLines, 'every footing line survives').toBe(kept.wroteLines);
  expect(kept.keptRoofs, 'and the roof survives').toBe(kept.wroteRoofs);
  // The control: this drawing HAS a roof level, so the roof is the proof that
  // the build still does everything the drawing can hold. Were it zero, the
  // equalities above would be true of a press that built nothing.
  expect(kept.wroteRoofs, 'the roof went up, since ROOF is here').toBe(1);
});

test('one Ctrl+Z takes the whole building back', async ({ page }) => {
  // ONE PRESS IS ONE UNDO however many records it made. The press now writes
  // walls on two levels, two floors, eight footing lines, a roof, an outline
  // and eleven openings -- and a Ctrl+Z that took the walls and left the
  // footings would leave concrete linework under nothing.
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html?level=1&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', 'bungalow');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(250);
  await saveOnNewPage(page);

  const saved = await savedFile(page);
  expect((saved.walls || []).length, 'the walls went').toBe(0);
  expect((saved.floors || []).length, 'the floor and the slab went').toBe(0);
  expect((saved.lines || []).length, 'the footings went').toBe(0);
  expect((saved.roofs || []).length, 'the roof went').toBe(0);
  expect((saved.outlines || []).length, 'the footprint went').toBe(0);
  expect((saved.fenestrations || []).length, 'and the openings went').toBe(0);
});

// ── 2 STOREY: the shell goes up on every storey the design has ───────────
//
// Movie, 19 Sep: "make the 2 storey the same for now sizewise" and "make a
// single story garage". The designs landed first and nothing read them: the
// build raised ONE storey, so ordering a 2 STOREY produced a bungalow with a
// 2 STOREY label on the strip.
//
// WHAT SEPARATES THE TWO IS NOT A COUNT OF WALLS. Both designs have the same
// footprint — deliberately — so "eight walls instead of four" is true of a
// 2 STOREY and of a bungalow built twice. The checks below read WHICH LEVELS
// carry them.

const byLevel = (list, key = 'levelId') => (list || []).reduce((tally, item) => {
  tally[item[key]] = (tally[item[key]] || 0) + 1;
  return tally;
}, {});

test('a 2 STOREY frames both storeys, a bungalow only one', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'bungalow');
  await saveOnNewPage(page);
  const one = await savedFile(page);

  await open(page);
  await order(page, 'bungalow', 'twoStorey');
  await saveOnNewPage(page);
  const two = await savedFile(page);

  const studs = saved => byLevel((saved.walls || [])
    .filter(wall => wall.wallType === 'stud_2x6'));
  // MAIN FL only, against MAIN FL and 2ND FL. The footprints are identical,
  // so the level keys are the whole of the difference.
  expect(studs(one), 'a bungalow frames one storey').toEqual({ 3: 4 });
  expect(studs(two), 'a 2 STOREY frames two').toEqual({ 3: 4, 5: 4 });

  // AND A DECK UNDER EACH. A storey framed with no floor under it is a storey
  // the section draws standing on nothing — _buildHouse's per-level pass does
  // walls AND a floor, and doing only the first is the easy half.
  const decks = saved => byLevel((saved.floors || [])
    .filter(floor => floor.structure === 'floor'));
  expect(decks(one)).toEqual({ 3: 1 });
  expect(decks(two), 'both storeys got a floor').toEqual({ 3: 1, 5: 1 });

  // One outline per storey: each level carries its own copy of the footprint,
  // which is how the old page holds a multi-storey house.
  expect(byLevel(two.outlines), 'a footprint on each storey').toEqual({ 3: 1, 5: 1 });
});

test('upstairs gets windows and no doors', async ({ page }) => {
  // A FRONT DOOR DEALT AGAIN ON THE STOREY ABOVE opens into air. The clamp
  // accepts it — it fits the wall — and it shows up on the elevation, which
  // is the one place nobody looks until the drawing is out.
  await open(page);
  await order(page, 'bungalow', 'twoStorey');
  await saveOnNewPage(page);
  const saved = await savedFile(page);

  const upstairs = (saved.fenestrations || []).filter(o => o.levelId === 5);
  const downstairs = (saved.fenestrations || []).filter(o => o.levelId === 3);
  expect(upstairs.length, 'the upper storey was glazed').toBeGreaterThan(0);
  expect(upstairs.some(o => o.type === 'door'), 'and no door up there').toBe(false);
  // The control: the ground floor DOES have one, so this is a difference
  // between the two sets and not a design with no doors anywhere.
  expect(downstairs.some(o => o.type === 'door'),
    'while the ground floor keeps its front door').toBe(true);
});

test('the garage stays a single storey under a 2 STOREY', async ({ page }) => {
  // Movie, 19 Sep: "make a single story garage". The house grows upward and
  // the garage does not follow it — the floor OVER a garage is a different
  // body on a different level, not this loop raised twice.
  await open(page);
  await order(page, 'bungalow', 'twoStorey-garage');
  await saveOnNewPage(page);
  const saved = await savedFile(page);

  const garageStuds = (saved.walls || [])
    .filter(wall => wall.body === 'garage' && wall.view === 'plan');
  expect(garageStuds.length, 'four garage walls, framed once').toBe(4);
  expect(byLevel(garageStuds), 'all of them on the lowest storey').toEqual({ 3: 4 });

  // The house, meanwhile, did go up.
  const houseStuds = (saved.walls || [])
    .filter(wall => wall.wallType === 'stud_2x6' && wall.body !== 'garage');
  expect(byLevel(houseStuds), 'the house is on both').toEqual({ 3: 4, 5: 4 });
});

test('a design wanting more storeys than the drawing has levels builds what fits',
  async ({ page }) => {
    // THE SAME PRINCIPLE AS THE FOUNDATION GUARD. A record filed against a
    // level the drawing does not list is dropped on the next load, so a
    // second storey written into a single-floor drawing would paint once and
    // vanish. A bone press is not permission to restructure someone's level
    // stack, so the build takes the levels that are there.
    const oneFloor = {
      ...empty(),
      levels: [
        { id: 7, name: 'ROOF', elev: 0 },
        { id: 3, name: 'MAIN FL', elev: 0 },
        { id: 1, name: 'FOUNDATION', elev: -8 },
      ],
      activeLevelIdx: 1,
    };
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, f }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(f)], 'drawing.json',
          { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, f: oneFloor });
    await page.goto('/MODEL.html');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await order(page, 'bungalow', 'twoStorey');
    await page.keyboard.press('Escape');
    await saveOnNewPage(page);

    const kept = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const raw = JSON.parse(await file.text());
      const F = window.DraftDrawingFormat;
      const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
      return {
        wrote: (raw.walls || []).length,
        keeps: F.walls(raw.walls, levelIds, {}).length,
      };
    }, BUCKET);
    // Four studs on MAIN FL and four of concrete: one storey's worth, and
    // every one of them survives the reload.
    expect(kept.wrote, 'one storey plus its foundation').toBe(8);
    expect(kept.keeps, 'and nothing was written that the reload loses')
      .toBe(kept.wrote);
  });

// ── THE ROOM OVER THE GARAGE ────────────────────────────────────────────────
//
// Movie, 19 Sep, asked outright where it goes: "no it will be the '2 storey',
// the 'over garage' layer is for bilevels when that would be a 'lower' 2nd
// floor" -- and then, plainer still, "this one is even with the 2nd floor so
// will be considered 2nd floor". A half-level is for a room sitting half a
// storey off the floors around it. This one is flush with the storey above, so
// it IS that storey, and the tile needs nothing added to anybody's level stack.
//
// UNTIL THIS LANDED THE TILE BUILT NOTHING OF IT. 2 STOREY + GARAGE + ROOM
// OVER raised a house and a garage -- byte for byte what 2 STOREY + GARAGE
// raises -- and the strip said "house on 2 storeys, garage, foundation, roof"
// without one word about the room that never went up. A press that quietly
// drops the thing written on the tile is the silent loss this page keeps
// refusing.

test('2 STOREY + GARAGE + ROOM OVER puts the room on 2ND FL with the storey', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey-over');
  await saveOnNewPage(page);
  const over = await savedFile(page);

  // THE CONTROL IS THE TILE BESIDE IT. 2 STOREY + GARAGE is the same design
  // without the room, so the DIFFERENCE between the two is the room and
  // nothing else -- which is a far stronger reading than a count, because a
  // count of walls on 2ND FL is also satisfied by the upper storey alone.
  await open(page);
  await order(page, 'bungalow', 'twoStorey-garage');
  await saveOnNewPage(page);
  const without = await savedFile(page);

  const upperOutlines = saved => (saved.outlines || [])
    .filter(o => Number(o.levelId) === 5);
  expect(upperOutlines(without).length, 'the plain 2 STOREY has the storey alone').toBe(1);
  expect(upperOutlines(over).length, 'and ROOM OVER adds a second footprint up there').toBe(2);

  // NOT A GARAGE FOOTPRINT. building-bodies.js reads every outline that is not
  // a garage as the house, and the room is living space -- marked `garage` it
  // would count as a second garage and spend a slot the drafter still has.
  expect(upperOutlines(over).every(o => o.garage !== true),
    'the room is house, not garage').toBe(true);

  // AND ON 2ND FL ONLY. Level 4 is the over-garage half-level, and a record
  // filed against a level this drawing has not got is dropped by
  // drawing-format.js on the next open -- so a room that went there would
  // paint once and be gone, which is the failure that looks like nothing.
  expect(byLevel(over.outlines)[4], 'nothing was filed on the half-level').toBe(undefined);
});

test('the room over the garage does not raise the house wall it stands against', async ({ page }) => {
  // TWENTY FEET OF THE TWO RUN IN THE SAME PLACE. The room is wider than the
  // stretch of house it sits against, so its back run starts inside the
  // house's front wall and carries on past the house's right corner. Left as
  // one edge that run is only PARTLY shared, edgeOnLoop answers "not shared"
  // because it tests an edge end to end, and the whole back wall goes up --
  // twenty feet of it standing in the same place as the house's own upper
  // front wall. Doubled linework, a doubled stud count, and two walls to drag
  // when the house moves. It is the wall Movie marked in green on the garage,
  // one floor further up.
  await open(page);
  await order(page, 'bungalow', 'twoStorey-over');
  await saveOnNewPage(page);
  const saved = await savedFile(page);

  // OVERLAP, NOT IDENTITY -- and the difference is the whole test.
  //
  // The first version of this check hashed each wall by its two endpoints and
  // looked for a repeat. It passed against the bug. The room's back run is
  // (-4,20)->(20,20) and the house's front wall is (16,20)->(-16,20): twenty
  // feet of the same line, and not one endpoint in common. By identity they
  // are two different walls, which is exactly what they are -- the defect is
  // that they occupy the same twenty feet, and only a test that measures
  // OVERLAP can see it.
  //
  // Grouped by the line each wall lies on -- a z for the horizontals, an x
  // for the verticals, which is all these designs have -- and then no two
  // spans on one line may share more than a rounding error.
  const line = wall => {
    const a = wall.start, b = wall.end;
    if (Math.abs(a.z - b.z) < 0.01) {
      return { id: `${wall.levelId}:h:${a.z.toFixed(2)}`,
        lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) };
    }
    if (Math.abs(a.x - b.x) < 0.01) {
      return { id: `${wall.levelId}:v:${a.x.toFixed(2)}`,
        lo: Math.min(a.z, b.z), hi: Math.max(a.z, b.z) };
    }
    return null;   // a diagonal: these designs have none, and it cannot pair
  };
  // EVERY LEVEL, not just 2ND FL. Two collinear stud walls overlapping on one
  // level is wrong wherever it happens, and the garage below has the same
  // shape of seam. Concrete is filtered out by `view` -- a foundation wall
  // under a stud wall is the building working correctly.
  const plan = (saved.walls || []).filter(wall => wall.view === 'plan');
  const doubled = [];
  plan.forEach((wall, i) => {
    const a = line(wall);
    if (!a) return;
    plan.slice(i + 1).forEach(other => {
      const b = line(other);
      if (!b || b.id !== a.id) return;
      const over = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
      if (over > 0.01) doubled.push(`${a.id} overlapping ${over.toFixed(2)} ft`);
    });
  });
  expect(doubled, 'two walls were raised along the same line').toEqual([]);

  // AND THE CONTROL: the room DID raise walls up there, so the check above is
  // measuring a room that exists rather than passing on an empty level.
  const plain = await (async () => {
    await open(page);
    await order(page, 'bungalow', 'twoStorey-garage');
    await saveOnNewPage(page);
    return savedFile(page);
  })();
  const upperCount = file => (file.walls || [])
    .filter(w => Number(w.levelId) === 5 && w.view === 'plan').length;
  expect(upperCount(saved), 'the room added walls to 2ND FL')
    .toBeGreaterThan(upperCount(plain));
});

test('the room over the garage gets its windows and its floor', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey-over');
  await saveOnNewPage(page);
  const over = await savedFile(page);

  await open(page);
  await order(page, 'bungalow', 'twoStorey-garage');
  await saveOnNewPage(page);
  const without = await savedFile(page);

  // THE DESIGN SAYS HOW MANY, and it is asked rather than typed in again: a
  // spec carrying its own 3 would pass on a page that had stopped reading the
  // module and grown a copy of the number.
  const wanted = await page.evaluate(() =>
    window.DraftPremadePlans.planFor('twoStorey-over').overGarageOpenings.length);
  const upperGlazing = saved => (saved.fenestrations || [])
    .filter(o => Number(o.levelId) === 5).length;
  expect(upperGlazing(over) - upperGlazing(without),
    'the room was glazed, by exactly what the design asks for').toBe(wanted);

  // A FLOOR OF ITS OWN. The storey pass lays a deck the shape of the HOUSE,
  // and the room hangs off the side of it -- so a room framed by that pass
  // alone is a room standing on nothing.
  const upperDecks = saved => (saved.floors || [])
    .filter(f => Number(f.levelId) === 5 && f.structure === 'floor').length;
  expect(upperDecks(without), 'the storey has its own deck').toBe(1);
  expect(upperDecks(over), 'and the room has a second').toBe(2);

  // EVERY RECORD THE PRESS WROTE SURVIVES THE RELOAD. drawing-format.js drops
  // records it cannot place, and this page has no serializer between the push
  // and the file -- so what it wrote and what a reload keeps must be the same.
  const kept = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const raw = JSON.parse(await file.text());
    const F = window.DraftDrawingFormat;
    const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
    return { wrote: (raw.walls || []).length,
      keeps: F.walls(raw.walls, levelIds, {}).length };
  }, BUCKET);
  expect(kept.keeps, 'nothing was written that the reload loses').toBe(kept.wrote);
});

test('the strip says the room went up, and says so when it cannot', async ({ page }) => {
  // A PRESS THAT DROPS WHAT THE TILE PROMISES MUST SAY SO. The drafter is
  // very likely not looking at 2ND FL when he presses -- the entry screen
  // opens on FOUNDATION -- so an empty sheet that tells you where to look is
  // the difference between a feature and a page that looks broken.
  await open(page);
  await order(page, 'bungalow', 'twoStorey-over');
  // READ WITH ITS NEIGHBOUR, because 'room over' alone is a substring of the
  // refusal below it -- "NO room over" contains it, so the loose assertion
  // passed against a page that raised no room at all. The parts are joined
  // with ', ', so the garage and the room adjacent is a sentence only the
  // built case can produce.
  await expect(page.locator('#strip-message'))
    .toContainText('garage, room over,', { timeout: 4000 });
  await expect(page.locator('#strip-message'),
    'the built case must not read like the refusal')
    .not.toContainText('NO room over');

  // NOWHERE TO PUT IT. storeyLevels returns the levels the drawing HAS, so a
  // room-over ordered into a drawing with one floor level has no storey above
  // to sit on -- and a bone press is not permission to add one.
  const oneFloor = {
    version: 1,
    levels: [
      { id: 7, name: 'ROOF', elev: 0 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -8 },
    ],
    activeLevelIdx: 1,
    walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
    outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
    roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
    groups: [], levelLocks: [], underlays: [],
  };
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: oneFloor });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', 'twoStorey-over');
  await expect(page.locator('#strip-message')).toContainText('NO room over', { timeout: 4000 });
});

// ── THE ROOFS ───────────────────────────────────────────────────────────────
//
// A SINGLE-STOREY GARAGE BESIDE A 2 STOREY BEARS ITS ROOF A STOREY LOWER, and
// the format already carries that: cut-view.js's roofBaseElev bears a roof on
// the full wall stack UNLESS it holds `garage: true` and a real
// `plateHeightFt`, in which case it bears at the first floor's top plus the
// plate. Movie, 19 Sep, confirming the reading: "the front of garage roof is
// lower yes your right".
//
// THE HEIGHT IS ASKED OF THE PAGE'S OWN ARITHMETIC, never recomputed here. A
// spec that worked out where a roof ought to bear would be a second home for
// the rule, free to agree with a broken page. sectionLevelStack builds the
// stack and roofBaseElev answers, both out of cut-view.js; this file only
// hands them the drawing.
const cutStack = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await file.text());
  const LV = window.DraftLayerViews, LA = window.DraftLevelAssembly;
  const CV = window.DraftCutView;
  const assemblyFor = id => LA.normaliseLevelAssembly(
    (raw.levelAssemblies || {})[id], LA.levelRole(id));
  // The inputs sectionLevelStack reads, written the way MODEL.html's own
  // cutEnv writes them -- one line each, over the same two modules. The last
  // two are for the FOUNDATION half of the stack, which the roofs above do
  // not use but the builder insists on having.
  const env = {
    floorLevels: () => LV.floorLevels(raw.levels),
    levelAssembly: id => assemblyFor(id),
    levelFloorFt: id => LA.levelFloorFt(assemblyFor(id)),
    levelWallTopFt: (id, view = 'plan') =>
      LA.levelWallTopFt(raw.walls || [], id, view),
    footingWidthIn: id => assemblyFor(id).footingWidthIn,
  };
  const stack = CV.sectionLevelStack(env);
  const roofs = raw.roofs || [];
  const base = roof => CV.roofBaseElev(roof, stack, {});
  const garage = roofs.filter(r => r.garage === true);
  const house = roofs.filter(r => r.garage !== true);
  return {
    roofs: roofs.length,
    garageRoofs: garage.length,
    houseRoofs: house.length,
    storeys: stack.floors.length,
    // The two bases, and the height of one storey read off the SAME stack --
    // so the comparison below quotes no arithmetic of its own.
    garageBase: garage.length ? base(garage[0]) : null,
    houseBase: house.length ? base(house[0]) : null,
    oneStorey: stack.floors.length > 1
      ? stack.floors[1].wallTop - stack.floors[0].wallTop : 0,
    // The top of the LOWEST storey's walls -- the ones a single-storey
    // garage actually stands on, whatever the house does above it.
    mainWallTop: stack.floors[0].wallTop,
    bearing: stack.bearing,
    plates: garage.map(r => r.plateHeightFt),
    mainWallHeight: assemblyFor(3).wallHeightFt,
  };
}, BUCKET);

test('the garage roof bears on the garage-s own walls, under either house', async ({ page }) => {
  // THE WHOLE POINT OF THE PLATE, stated as the thing a builder would say: a
  // roof sits on the walls holding it up. The garage is a single storey under
  // both designs, so its roof bears on the lowest storey's wall top in both --
  // and that is a stronger claim than either "same as the house" or "lower
  // than the house", because it names the right number rather than a
  // relationship to another roof that might itself be wrong.
  //
  // IT WAS WRITTEN THE WEAKER WAY FIRST, and the weaker way was false. The
  // first version asserted that on a bungalow the garage roof and the house
  // roof bear together, on the reasoning that a one-storey house bears on its
  // one storey. They do not: 8.09 against 17.24. `bearing` is the top of the
  // TOPMOST FLOOR LEVEL IN THE STACK, and floorLevels() keeps a level because
  // it has a floor layer view, not because anything stands on it -- so the
  // default stack's 2ND FL puts a bungalow's house roof a phantom storey up.
  // MODEL.dc.html does the same: _buildHouseRoof hunts down the levels for an
  // outline but still bases the roof on stack.bearing.
  //
  // THAT IS NOT THIS CHANGE'S TO FIX -- it is cut-view's stack semantics and
  // both pages share it -- but it is not going to be quietly asserted away
  // either. What is checked here is the garage roof, which this change owns.
  for (const entry of ['bungalow-garage', 'twoStorey-garage']) {
    await open(page);
    await order(page, 'bungalow', entry);
    await saveOnNewPage(page);
    const m = await cutStack(page);

    expect(m.garageRoofs, `${entry}: the garage got a roof of its own`).toBe(1);
    expect(m.houseRoofs, `${entry}: and the house one`).toBe(1);
    expect(m.garageBase, `${entry}: the garage roof left its own walls`)
      .toBeCloseTo(m.mainWallTop, 4);
  }
});

test('a 2 STOREY-s garage roof bears one storey below the house-s', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey-garage');
  await saveOnNewPage(page);
  const m = await cutStack(page);

  expect(m.storeys, 'the fixture has two storeys to tell apart').toBe(2);
  expect(m.garageRoofs).toBe(1);
  expect(m.houseRoofs).toBe(1);
  // EXACTLY ONE STOREY, and the storey is measured off the same stack that
  // placed the roofs -- not a number typed into this file.
  expect(m.houseBase - m.garageBase,
    'the garage roof did not drop a storey below the house-s')
    .toBeCloseTo(m.oneStorey, 4);
  // AND IT IS A DROP, not a coincidence of two zeroes.
  expect(m.oneStorey, 'a storey has height, so the check above says something')
    .toBeGreaterThan(6);
});

test('the garage roof takes its plate from the storey it stands on', async ({ page }) => {
  // NOT A TYPED NUMBER. The plate is what makes the drop the right size, and
  // a literal here would pass on a page that had stopped asking the assembly.
  await open(page);
  await order(page, 'bungalow', 'twoStorey-garage');
  await saveOnNewPage(page);
  const m = await cutStack(page);

  expect(m.plates.length, 'there is a garage roof to read a plate off').toBe(1);
  // A REAL NUMBER FIRST: drawing-format.js reads a stored null as a plate of
  // ZERO, which bears the garage roof on the slab instead of on its walls --
  // a roof at ground level, which looks like a missing roof. Asked before the
  // comparison so a missing plate reports itself rather than throwing inside
  // toBeCloseTo.
  expect(Number.isFinite(m.plates[0]), 'the garage roof carries no plate at all')
    .toBe(true);
  expect(m.plates[0], 'the plate is the main floor-s own wall height')
    .toBeCloseTo(m.mainWallHeight, 4);
});

test('the roofs meet the house with gables, not with eaves running into a wall', async ({ page }) => {
  // AN EAVE AGAINST THE HOUSE runs the roof plane into the house wall; a
  // gable cuts it vertically at the wall, which is what the wall is there to
  // meet. MODEL.dc.html's _buildGarageRoof makes the same call through the
  // same test -- an edge lying on the house outline.
  await open(page);
  await order(page, 'bungalow', 'bungalow-garage');
  await saveOnNewPage(page);
  const saved = await savedFile(page);

  const garageRoof = (saved.roofs || []).find(r => r.garage === true);
  const houseRoof = (saved.roofs || []).find(r => r.garage !== true);
  expect(garageRoof, 'there is a garage roof').toBeTruthy();

  // THE GARAGE'S TWO SHARED EDGES, and it is TWO -- the 20 ft along the
  // house front and the 1 ft tie down its right wall. The tie is the one
  // nobody would report, and it is the reason this counts rather than
  // asserting "at least one".
  const gables = (garageRoof.edges || []).filter(e => e === 'gable').length;
  expect(gables, 'the garage roof meets the house on its two shared edges').toBe(2);

  // THE CONTROL: the house roof touches nothing, so every edge of it is an
  // eave. Without this, "2 gables" is also satisfied by a page that gables
  // edges at random.
  expect((houseRoof.edges || []).every(e => e === 'eave'),
    'the house roof is all eaves, having nothing to meet').toBe(true);
});

test('2 STOREY + GARAGE + ROOM OVER roofs all three, and none of them indoors', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey-over');
  await saveOnNewPage(page);
  const saved = await savedFile(page);
  const m = await cutStack(page);

  // THREE ROOFS, THREE HEIGHTS IN TWO GROUPS: the house and the room bear on
  // the full stack, the garage stub a storey below. Movie's own description
  // of the shape -- "so the front of the garage will have some roof on the
  // main floor area".
  expect(m.roofs, 'the house, the room over, and the stub in front of it').toBe(3);
  expect(m.garageRoofs, 'only the stub is a garage roof').toBe(1);
  expect(m.houseBase - m.garageBase, 'and only it drops a storey')
    .toBeCloseTo(m.oneStorey, 4);

  // THE ROOM'S ROOF IS NOT FLAGGED. The room IS the second storey, so a
  // garage flag on it would drop it a storey and roof the room at the height
  // of its own floor.
  const stub = (saved.roofs || []).find(r => r.garage === true);
  const overRoof = (saved.roofs || [])
    .find(r => r.garage !== true && Number(r.sourceLevelId) === 5);
  expect(overRoof, 'the room over the garage got a roof').toBeTruthy();

  // NO ROOF UNDER A FLOOR. The stub must stop where the room begins: a sheet
  // reaching back under the room would be a roof inside the building. Read as
  // a Z overlap of the two footprints, since both span the garage's width.
  const zSpan = roof => ({
    lo: Math.min(...roof.points.map(p => p.z)),
    hi: Math.max(...roof.points.map(p => p.z)),
  });
  const a = zSpan(stub), b = zSpan(overRoof);
  const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
  // The two roofs each carry an overhang, so their sheets are MEANT to lap at
  // the join. What they must not do is lap by a room's length.
  expect(overlap, 'the garage roof reaches back under the room over it')
    .toBeLessThan(2 * 2 + 0.01);

  // EVERY ROOF SURVIVES THE RELOAD. drawing-format.js drops what it cannot
  // place, and this page has no serializer between the push and the file.
  const kept = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const raw = JSON.parse(await file.text());
    const F = window.DraftDrawingFormat;
    const levelIds = new Set((raw.levels || []).map(l => Number(l.id)));
    const back = F.roofs(raw.roofs, levelIds);
    return { wrote: (raw.roofs || []).length, keeps: back.length,
      garageKept: back.filter(r => r.garage === true).length,
      platesKept: back.filter(r => Number.isFinite(r.plateHeightFt)).length };
  }, BUCKET);
  expect(kept.keeps, 'nothing was written that the reload loses').toBe(kept.wrote);
  expect(kept.garageKept, 'and the garage flag came back').toBe(1);
  expect(kept.platesKept, 'and so did the plate that makes it drop').toBe(1);
});
