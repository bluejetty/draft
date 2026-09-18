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
const empty = () => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
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
  expect((saved.walls || []).length, 'four walls off the four sides').toBe(4);

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
    expect((saved.walls || []).length,
      'both bodies were walled, the garage on the four edges it owns').toBe(8);
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
    expect(garageWalls.length, 'four garage walls, not six').toBe(4);
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
