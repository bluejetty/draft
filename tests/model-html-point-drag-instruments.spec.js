// A DRAGGED POINT READS THE SAME INSTRUMENTS AS A DRAWN ONE.
//
// Movie, 15 Oct: "dragging a point ignores the T-square and 1' snap". It did,
// and only there. A run being DRAWN goes through drawPoint, which squares it,
// projects the corner snap onto the squared axis and rounds the whole foot; a
// point being DRAGGED went through cornerSnap and nothing else. So the two lit
// instruments governed where a corner could be PUT and said nothing about
// where it could be MOVED -- a drafter could square a wall to draw it and pull
// it off square a minute later with the T-square still down.
//
// It is also a hole in the FOOT LIGHT's own order, which Movie ruled on
// 14 Sep: asked whether the light governs drawing only or drawing and
// dragging, "so it can be turned on and off with that light" -- ONE LIGHT,
// BOTH. model-foot-light.spec.js pins the light on a drawn run and on a WALL
// BODY drag; the point drag is the third gesture and was never covered.
//
// BOTH INSTRUMENTS IN ONE FILE because the fix is one call site: the drag now
// goes through squareTo / axisSnap / onTheFoot in drawPoint's own order, so a
// test that lit only one of them could not tell a correct order from a lucky
// one.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// A 20 ft square and one stub wall inside it. The square's NE corner at
// (10,-10) is the point every gesture here drags; the stub's free end at
// (6, 6.4) is BAIT -- a real wall corner at a deliberately fractional place,
// which is the only way to tell "the snap caught a corner" from "the foot
// rounded to a whole number that happened to land there".
const NE = { x: 10, z: -10 };
const BAIT = { x: 6, z: 6.4 };
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
    ['stub', V(BAIT.x, BAIT.z), V(6, 8)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  nextDrawingItemId: 20,
  ...extra,
});

async function open(page, board = 'drafting') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base({ board }) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
}

const foot = page => page.locator('[data-mode-scale]');
const tsquare = page => page.locator('[data-mode-tsquare]');
const lit = loc => loc.evaluate(el => el.classList.contains('lit'));

const saveAndRead = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};

// WHERE THE NE CORNER ENDED UP, asked of BOTH walls that share it. The loader
// pools corners, so the north wall's end and the east wall's start are one
// object -- and a drag that moved only one of them would be a drag that tore
// the building open at that corner, which no single-wall read could see.
const corner = saved => {
  const n = saved.walls.find(w => w.id === 'n');
  const e = saved.walls.find(w => w.id === 'e');
  expect(e.start.x, 'the pooled corner moved for both walls').toBeCloseTo(n.end.x, 6);
  expect(e.start.z, 'the pooled corner moved for both walls').toBeCloseTo(n.end.z, 6);
  return n.end;
};

// Select the north wall, then grab its NE end: cornerAt only offers the
// SELECTED wall's two ends, so the click is not optional.
async function grabCorner(page) {
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, -10));
  await page.waitForTimeout(80);
  await page.mouse.move(...at(NE.x, NE.z));
  await page.mouse.down();
  return at;
}

// Through `via` first where one is given, so the drag is past the 4px arm
// before it comes back -- and so a point that ends up where it started has
// been somewhere else on the way, rather than never having armed at all.
async function dragTo(page, at, [x, z], via = null) {
  if (via) await page.mouse.move(...at(via[0], via[1]), { steps: 6 });
  await page.mouse.move(...at(x, z), { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test('both instruments off: the point lands where the hand let go', async ({ page }) => {
  await open(page);
  expect(await lit(foot(page)), 'the foot light is off on a page that never saw it')
    .toBe(false);
  expect(await lit(tsquare(page)), 'and so is the T-square').toBe(false);

  const at = await grabCorner(page);
  await dragTo(page, at, [12.4, -8.6]);

  // THE REGRESSION GUARD FOR THE WHOLE CHANGE. With nothing lit, squareTo
  // hands the raw point straight back and squaredAxis answers null, so the
  // drag must be exactly what it was before the instruments were wired in.
  const pt = corner(await saveAndRead(page));
  expect(pt.x, 'no instrument, no correction').toBeCloseTo(12.4, 2);
  expect(pt.z).toBeCloseTo(-8.6, 2);
});

test('the FOOT light rounds a dragged point to the whole foot', async ({ page }) => {
  await open(page);
  await foot(page).click();
  expect(await lit(foot(page)), 'the chip lights').toBe(true);

  const at = await grabCorner(page);
  await dragTo(page, at, [12.4, -10]);

  const pt = corner(await saveAndRead(page));
  expect(pt.x, 'a 2.4 ft pull lands 2 ft away, on the foot').toBeCloseTo(12, 6);
  expect(pt.z, 'and nothing moved across it').toBeCloseTo(-10, 6);
});

test('the FOOT light rounds DISTANCE, so a nudge rounds back to nothing',
  async ({ page }) => {
    // minFeet IS 0 FOR A DRAG and 1 for a drawn run, which is the one place
    // the two gestures differ. A drawn run of no length is a wall the reader
    // drops, so drawing has a floor; a corner nudged four inches with the
    // light lit must round back to where it started, or the light would be an
    // instrument that MOVES geometry the hand did not.
    await open(page);
    await foot(page).click();

    const at = await grabCorner(page);
    await dragTo(page, at, [10.4, -10], [14, -10]);

    const pt = corner(await saveAndRead(page));
    expect(pt.x, 'under half a foot, the corner is where it was').toBeCloseTo(10, 6);
    expect(pt.z).toBeCloseTo(-10, 6);
  });

test('the T-SQUARE holds a dragged point square to where it started',
  async ({ page }) => {
    await open(page);
    await tsquare(page).click();
    expect(await lit(tsquare(page)), 'the chip lights').toBe(true);

    // 4 ft across and 1.4 down: x dominates, so x is the free coordinate and
    // z is held at exactly the value the corner started with.
    const at = await grabCorner(page);
    await dragTo(page, at, [14, -8.6]);

    const pt = corner(await saveAndRead(page));
    expect(pt.x, 'the free coordinate follows the hand').toBeCloseTo(14, 2);
    expect(pt.z, 'and the squared one is held exactly, not approximately')
      .toBeCloseTo(-10, 6);
  });

test('the T-SQUARE squares the other way when the cross-axis dominates',
  async ({ page }) => {
    // The same instrument, the other half: 1.4 across and 6 down, so z is
    // free and x is held. A square that only ever held z would pass the test
    // above and fail every plumb wall on the board.
    await open(page);
    await tsquare(page).click();

    const at = await grabCorner(page);
    await dragTo(page, at, [11.4, -4]);

    const pt = corner(await saveAndRead(page));
    expect(pt.x, 'the squared coordinate is held exactly').toBeCloseTo(10, 6);
    expect(pt.z, 'and the free one follows the hand').toBeCloseTo(-4, 2);
  });

test('the corner snap still beats the foot', async ({ page }) => {
  // drawPoint's own precedence, and its reason: "a snap that lands on a real
  // corner is the one case where the foot gives way -- the corner is where the
  // geometry actually joins". The bait sits at z = 6.4, which no rounding of
  // the pull's length can produce, so landing on it is proof the snap ran and
  // the foot then kept its hands off.
  await open(page);
  await foot(page).click();

  const at = await grabCorner(page);
  await dragTo(page, at, [BAIT.x, BAIT.z]);

  const pt = corner(await saveAndRead(page));
  expect(pt.x, 'the corner caught the bait exactly').toBeCloseTo(BAIT.x, 6);
  expect(pt.z, 'and the foot did not then nudge it off').toBeCloseTo(BAIT.z, 6);
});

test('THE LEAK: the TOY board does not square a dragged point', async ({ page }) => {
  // squaring() and onTheFoot_if() each answer "is this run held square /
  // rounded", and BOTH carry `board === 'toy'` as well as the switch. Reaching
  // for them here would have squared every corner drag on the bone board,
  // where nothing has ever squared one -- toy-constraints governs what moves
  // there. model-html-save.spec.js found it first, by dragging a bone-built
  // corner 90 across and 50 down and getting a z of exactly 0; this is the
  // same claim where it can be read as a claim rather than as a save failing.
  await open(page, 'toy');

  const at = await grabCorner(page);
  await dragTo(page, at, [12.4, -8.6]);

  const pt = corner(await saveAndRead(page));
  expect(pt.x, 'the board squares a DRAWN run, not a dragged point').toBeCloseTo(12.4, 2);
  expect(pt.z, 'so the cross-axis travel survives').toBeCloseTo(-8.6, 2);
});

test('a dragged point is never its own snap target', async ({ page }) => {
  // snapCandidates excludes the moving vertex by reference AND by coincident
  // position. Under the square the free coordinate comes from a snapped
  // corner, so a moving point left in the candidate list would hand its own
  // starting coordinate back on every event -- a point that cannot be moved
  // at all, which reads as a lock rather than a snap.
  await open(page);
  await tsquare(page).click();

  const at = await grabCorner(page);
  await dragTo(page, at, [13, -10]);

  const pt = corner(await saveAndRead(page));
  expect(pt.x, 'the point went where it was pulled').toBeCloseTo(13, 2);
});
