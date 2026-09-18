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

    // TEN WALLS: four round the house, six round the garage's six-cornered
    // loop. A garage stored as a plain rectangle would give nine.
    expect((saved.walls || []).length,
      'both bodies were walled, the garage on all six of its corners').toBe(10);
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
