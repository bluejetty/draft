// AUTO STAIR ON THE LIVE PAGE — the flight between two floors, and the hole it
// descends through.
//
// Movie, 25 Sep: "maybe give them stairs too", and, asked what the first PR
// should deliver, "Runs plus the hole in the floor".
//
// THE PAGE COULD PAINT A STAIR AND COULD NOT DERIVE ONE. stair-geometry.js has
// been loaded here since tier 2 and paintStairs draws whatever the drawing
// holds -- but auto-stair.js and stair-rules.js were loaded by NEITHER of
// MODEL.html's script blocks, so the STAIR key armed a tool with no panel, no
// button and no press handler. A house with two floors arrived with no way
// between them.
//
// WHAT THIS FILE DOES NOT CHECK is the placement scoring: which corner an L
// folds into, how a BEDROOM stamp repels, what the entry L is worth. That is
// auto-stair.js's and tests/auto-stair.spec.js pins it against the module
// directly. What only a page test can reach is everything BETWEEN the module
// and the file -- which level each flight is filed on, that the records
// survive the reload, that the opening is hosted on a real floor and carries
// its stair's id, that the well ends up clear of the beams, that a second
// press does not stack a second flight, and that one Ctrl+Z takes the lot.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FOUNDATION = 1, MAIN_FL = 3, SECOND_FL = 5;

// THE WHOLE LEVEL STACK, for the reason model-html-auto-beam.spec.js gives:
// drawing-format.js drops any record whose levelId the drawing does not list,
// so a fixture missing a level would write stairs the next open loses and
// every count below would measure the page's memory rather than the file.
const empty = (extra = {}) => ({
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
  ...extra,
});

// `cx`/`cz` DEFAULT TO THE ORIGIN, so every caller written before them is
// unchanged. They exist because a storey with TWO bodies on it cannot be
// built out of rectangles that all stand in the same place, and two bodies is
// the only shape that can tell houseOutlineOn's three rules apart.
const rect = ({ id = 'outline-x', levelId = MAIN_FL, wide = 40, deep = 32,
  cx = 0, cz = 0, garage = false } = {}) => ({
  id, levelId, garage,
  points: [
    { x: cx - wide / 2, y: 0, z: cz - deep / 2 },
    { x: cx + wide / 2, y: 0, z: cz - deep / 2 },
    { x: cx + wide / 2, y: 0, z: cz + deep / 2 },
    { x: cx - wide / 2, y: 0, z: cz + deep / 2 },
  ],
});

// A FLOOR FOR THE HOLE TO BE CUT FROM. `structure: 'floor'` rather than 'slab'
// is the discriminator buildStairOpenings filters on -- a slab is poured, not
// framed, and nothing cuts a stairwell out of one.
const floorOn = ({ id = 'floor-x', levelId = MAIN_FL, wide = 40, deep = 32,
  cx = 0, cz = 0 } = {}) => ({
  id, levelId, view: 'plan', structure: 'floor', garage: false,
  slopeInPerFt: 0, thickness: 0.9583333333333334, thickenedEdge: false,
  points: rect({ wide, deep, cx, cz }).points,
});

async function open(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 FOR THE TOOL COLUMN AND ?right=1 FOR THE PROPERTIES SLOT: both
  // ship collapsed, and the key is the only way to arm a tool with no legacy
  // button.
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(600);
}

async function saveNow(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

// IDEMPOTENT, unlike the press: pressing the ARMED key returns to SELECT, so a
// helper that always clicked would DISARM the tool for a caller already
// holding it and take the panel down with it. That is not a visible failure --
// the next click() waits out its timeout on a locator that is not there.
//
// THE BOARD IS SWITCHED FIRST: STAIR is a build tool and build tools are on
// DRAFTING (tool-roster.js:52). On TOY the key is disabled and the click hangs.
async function armStair(page) {
  await page.locator('[data-board-switch] [data-board="drafting"]').click();
  await page.waitForTimeout(150);
  const key = page.locator('[data-tool-key="stair"]');
  if (await key.getAttribute('aria-pressed') !== 'true') {
    await key.click();
    await page.waitForTimeout(150);
  }
}

const autoStairButton = page => page.locator('[data-auto-stair]');

// ── THE HOUSE ARRIVES WITH ITS STAIRS ──────────────────────────────────────

test('a built two-storey arrives with stacked flights and cut openings',
  async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey');
  await saveNow(page);
  const saved = await savedFile(page);

  const stairs = (saved.stairs || []).filter(stair => stair.auto === true);
  expect(stairs.length,
    'the house was built with two floors and no way between them').toBe(2);

  const byLevel = new Map(stairs.map(stair => [stair.levelId, stair]));
  expect([...byLevel.keys()].sort((a, b) => a - b)).toEqual([MAIN_FL, SECOND_FL]);

  // THE STACKING RULE, MEASURED ON POSITION. The upper flight goes directly
  // over the one below so the headroom holds, so the two runs are the same
  // line -- not merely both present.
  const lower = byLevel.get(MAIN_FL), upper = byLevel.get(SECOND_FL);
  expect(Math.hypot(upper.start.x - lower.start.x, upper.start.z - lower.start.z),
    'the upper flight does not stand over the one below it').toBeLessThan(0.01);
  expect(Math.hypot(upper.end.x - lower.end.x, upper.end.z - lower.end.z),
    'the upper run points somewhere else').toBeLessThan(0.01);

  // AND EACH ONE HAS ITS HOLE, hosted on a real floor of its own level. An
  // opening filed against a floor that is not there is a hole in nothing.
  const openings = (saved.surfaceOpenings || [])
    .filter(opening => opening.stairId != null);
  expect(openings.length, 'a stair descends through a floor with no hole in it')
    .toBe(2);
  const floorById = new Map((saved.floors || []).map(floor => [floor.id, floor]));
  openings.forEach(opening => {
    const host = floorById.get(opening.hostId);
    expect(host, `opening ${opening.id} is hosted on a floor that is not here`)
      .toBeTruthy();
    expect(host.levelId, 'the hole was cut in another storey').toBe(opening.levelId);
    expect(host.structure, 'a stairwell was cut out of a poured slab')
      .not.toBe('slab');
    expect(stairs.some(stair => stair.id === opening.stairId),
      'the opening names a stair the file does not hold').toBe(true);
  });
});

// THE ID IS AN INTEGER, AND THIS IS NOT A STYLE CHECK. Walls, outlines, floors
// and openings take `newDrawingItemId` -- the `kind-7` string -- but
// drawing-format.js's stair validator reads Number.isInteger(Number(id)), so a
// stair carrying `stair-7` is NaN to it and the record is DROPPED on the next
// load with no error at either end. Caught before it shipped; pinned so it
// cannot come back.
// ── A STAIRCASE BELONGS IN THE HOUSE, NOT OVER THE GARAGE ───────────────
//
// Movie, 25 Sep: "the ATTACHED garage won't need a staircase to the 2nd floor
// (unless the user wants it special - don't need it as default)" ... "the
// DETACHED needs one because it doesn't have a house with stairs in it".
//
// MEASURED ON HIS OWN BUILD before the fix -- the flight from MAIN FL to
// 2ND FL laid out inside the room over the garage, with its opening cut
// through that room's floor:
//
//     stair lvl 3   x  -1.7  z  -5.4    in the house
//     stair lvl 5   x   2.7  z  30.6    in the GARAGE
//
// `storeyBodies` keeps every outline not flagged `garage`, and raiseGarage
// files the room over the garage as an ordinary one -- so 2ND FL carries two
// and `houseOutlineOn` took the LAST. That is the right rule for AUTO PILES
// and the framing panel, whose own note says "the most recent loop is the one
// the drafter means"; it is the wrong question for a stair.
//
// THE OPENING IS CHECKED TOO, not just the run. The hole is what makes the
// room unusable, and it is cut from the stair's own footprint -- so a check
// on the run alone would pass a fix that moved the flight and left the hole.
test('the stair to the second floor lands in the house, not over the garage',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'twoStorey-over');
    await saveNow(page);
    const saved = await savedFile(page);

    const inLoop = (pts, at) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if (((a.z > at.z) !== (b.z > at.z))
          && (at.x < (b.x - a.x) * (at.z - a.z) / ((b.z - a.z) || Number.EPSILON) + a.x)) {
          inside = !inside;
        }
      }
      return inside;
    };
    const garages = (saved.outlines || []).filter(o => o.garage === true
      && (o.points || []).length >= 3);
    // THE FIXTURE'S REACH: without a garage in the drawing this proves
    // nothing, and `twoStorey-over` is the only premade that builds a room
    // over one.
    expect(garages.length, 'the build lost its garage, so this proves nothing')
      .toBeGreaterThan(0);

    const upper = (saved.stairs || []).find(stair =>
      stair.auto === true && Number(stair.levelId) === SECOND_FL);
    expect(upper, 'no flight was placed on the second floor').toBeTruthy();
    const mid = {
      x: (upper.start.x + upper.end.x) / 2,
      z: (upper.start.z + upper.end.z) / 2,
    };
    expect(garages.some(g => inLoop(g.points, mid)),
      `the flight to the second floor was laid out over the garage, at `
      + `x ${mid.x.toFixed(1)} z ${mid.z.toFixed(1)}`).toBe(false);

    const holes = (saved.surfaceOpenings || []).filter(o =>
      Number(o.levelId) === SECOND_FL && (o.points || []).length >= 3);
    holes.forEach(hole => {
      const c = hole.points.reduce((sum, pt) => ({
        x: sum.x + pt.x / hole.points.length,
        z: sum.z + pt.z / hole.points.length,
      }), { x: 0, z: 0 });
      expect(garages.some(g => inLoop(g.points, c)),
        `a stair opening was cut through the room over the garage, at `
        + `x ${c.x.toFixed(1)} z ${c.z.toFixed(1)}`).toBe(false);
    });
  });

// ── AND IT LANDS IN THE BIGGEST HOUSE BODY, NOT THE FIRST ONE FILED ────────
//
// THE TEST ABOVE CANNOT SAY THIS, and a mutation run is what proved it. On
// twoStorey-over the house is BOTH the biggest body on the storey AND the
// first one filed, so the three rules houseOutlineOn composes -- drop the
// bodies over the garage, then take the largest of what is left -- all give
// the same answer there. Two of the three mutants written for that change
// survived: `bodyOverGarage` made to return false, and the reduce replaced by
// `pool[0]`. Neither changed a coordinate, so nothing could catch them.
//
// SO THIS IS THE DRAWING THAT TELLS THEM APART, and every number in it is
// chosen to break one of those coincidences:
//
//   over-garage   30 x 24 at x +25   720 sq ft   FILED FIRST, and the BIGGEST
//   house-small   16 x 12 at x -30   192 sq ft   filed before the big one
//   house-big     24 x 20 at x  -5   480 sq ft   the one the stair belongs in
//
// The garage itself stands under the first of them on MAIN FL, so the body
// above it is genuinely over a garage rather than merely named that way.
//
//   correct                       -> house-big   (largest after the filter)
//   bodyOverGarage returns false  -> over-garage (720 beats 480)
//   pool[0] instead of the reduce -> house-small (filed first of the two)
//
// Three rules, three different answers, one press. THE ASSERTIONS NAME ALL
// THREE BODIES rather than only refusing the garage: "not over the garage"
// would pass a stair dropped in the wrong house body, which is exactly the
// mutant that survived.
test('the stair takes the biggest house body, not the first one filed',
  async ({ page }) => {
    const GARAGE = { wide: 30, deep: 24, cx: 25 };
    const SMALL = { wide: 16, deep: 12, cx: -30 };
    const BIG = { wide: 24, deep: 20, cx: -5 };
    await open(page, empty({
      outlines: [
        // MAIN FL: the garage, and the body the lower flight descends in.
        { ...rect({ id: 'garage', levelId: MAIN_FL, ...GARAGE }), garage: true },
        rect({ id: 'lower-big', levelId: MAIN_FL, ...BIG }),
        // 2ND FL, IN THIS ORDER. The order is the fixture: it is what makes
        // "first filed" a different answer from "largest".
        rect({ id: 'over-garage', levelId: SECOND_FL, ...GARAGE }),
        rect({ id: 'house-small', levelId: SECOND_FL, ...SMALL }),
        rect({ id: 'house-big', levelId: SECOND_FL, ...BIG }),
      ],
      floors: [
        floorOn({ id: 'floor-main', levelId: MAIN_FL, ...BIG }),
        floorOn({ id: 'floor-2nd', levelId: SECOND_FL, ...BIG }),
      ],
    }));
    await armStair(page);
    await expect(autoStairButton(page)).toBeEnabled();
    await autoStairButton(page).click();
    await page.waitForTimeout(400);
    await saveNow(page);
    const saved = await savedFile(page);

    const byId = new Map((saved.outlines || []).map(o => [o.id, o]));
    const inLoop = (pts, at) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if (((a.z > at.z) !== (b.z > at.z))
          && (at.x < (b.x - a.x) * (at.z - a.z) / ((b.z - a.z) || Number.EPSILON) + a.x)) {
          inside = !inside;
        }
      }
      return inside;
    };

    const upper = (saved.stairs || []).find(stair =>
      stair.auto === true && Number(stair.levelId) === SECOND_FL);
    expect(upper, 'no flight was placed on the second floor').toBeTruthy();
    const mid = {
      x: (upper.start.x + upper.end.x) / 2,
      z: (upper.start.z + upper.end.z) / 2,
    };
    const where = `x ${mid.x.toFixed(1)} z ${mid.z.toFixed(1)}`;

    expect(inLoop(byId.get('over-garage').points, mid),
      `the flight was laid out in the room over the garage, at ${where} -- the `
      + 'over-garage filter is not being applied').toBe(false);
    expect(inLoop(byId.get('house-small').points, mid),
      `the flight was laid out in the SMALL house body, at ${where} -- the `
      + 'storey is being answered by what was filed first, not by area').toBe(false);
    expect(inLoop(byId.get('house-big').points, mid),
      `the flight is in none of the three bodies, at ${where}`).toBe(true);
  });

test('every placed stair survives the reload with its id and riser count',
  async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey');
  await saveNow(page);
  const stairs = ((await savedFile(page)).stairs || []).filter(s => s.auto === true);

  expect(stairs.length).toBeGreaterThan(0);
  stairs.forEach(stair => {
    expect(Number.isInteger(stair.id), `stair id ${stair.id} is not an integer, `
      + 'so the reader drops it').toBe(true);
    expect(stair.view, 'a stair filed on a view that does not draw it').toBe('plan');
    expect(stair.riseFt, 'a stair with no rise is dropped by the reader')
      .toBeGreaterThan(0);
    // `risers` IS NOT SET BY MODEL.dc.html's _buildAutoStair, while its HAND
    // placement sets it (:3383). drawing-format.js defaults a missing one to
    // 1, so an auto stair saved and reloaded came back claiming ONE riser --
    // invisible, because stairCurrentLayout re-derives the layout from the
    // level heights on every paint. tests/stairs.spec.js:44 asserts the field,
    // so it is contract, and a record whose own numbers disagree is the kind
    // of thing that is true until something finally reads it.
    expect(stair.risers, 'the stored riser count came back as the validator '
      + 'default, not the layout').toBeGreaterThan(1);
    expect(stair.treadRunIn, 'the stored tread run is missing').toBeGreaterThan(0);
  });
  const ids = stairs.map(stair => stair.id);
  expect(new Set(ids).size, 'two stairs share an id, and the reader dedupes by '
    + 'dropping every record after the first').toBe(ids.length);
});

// ── THE WELL KEEPS CLEAR OF WHAT CARRIES THE FLOOR ─────────────────────────
//
// A beam crossing an open well is a beam over the drafter's head on the way
// down. The build places the beams FIRST for exactly this reason, so the stair
// has something to be nudged off.
test('no stair opening lands on a beam carrying its floor', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey');
  await saveNow(page);
  const saved = await savedFile(page);

  const openings = (saved.surfaceOpenings || []).filter(o => o.stairId != null);
  expect(openings.length).toBeGreaterThan(0);

  // Distance from a segment to a point, flat: the well's edges against the
  // beam's ends and the beam against the well's corners.
  const segDist = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1,
      ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
    return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
  };

  let checked = 0;
  openings.forEach(opening => {
    // The beams carrying THIS floor: its own FLOOR view, plus FOUNDATION's on
    // the lowest storey -- which is where every beam the build generates goes.
    const beams = (saved.beams || []).filter(beam =>
      (beam.levelId === opening.levelId && beam.view === 'floor')
      || (opening.levelId === MAIN_FL && beam.levelId === FOUNDATION
        && beam.view === 'foundation'));
    beams.forEach(beam => {
      let gap = Infinity;
      opening.points.forEach((pt, i) => {
        const next = opening.points[(i + 1) % opening.points.length];
        gap = Math.min(gap,
          segDist(beam.start, pt, next), segDist(beam.end, pt, next),
          segDist(pt, beam.start, beam.end), segDist(next, beam.start, beam.end));
      });
      checked += 1;
      expect(gap, `a beam runs within ${(gap * 12).toFixed(1)}" of the well on `
        + `level ${opening.levelId}`).toBeGreaterThan(2 / 12 - 0.01);
    });
  });
  // THE COUNT IS ASSERTED TOO, because "no beam was too close" is also what a
  // run that found no beams at all would report -- which is precisely the
  // MODEL.dc.html defect this rule exists to avoid, where the lookup returned
  // [] and the check passed unconditionally.
  expect(checked, 'no beam was checked against any well, so this test proves '
    + 'nothing').toBeGreaterThan(0);
});

// ── THE BUTTON ─────────────────────────────────────────────────────────────

test('the button is greyed with no outline to descend from, and says why',
  async ({ page }) => {
    await open(page);
    await armStair(page);
    const btn = autoStairButton(page);
    await expect(btn).toBeDisabled();
    // DISABLED, NOT HIDDEN -- the rule the ROOF and BEAM panels take: a button
    // that vanishes teaches the drafter that STAIR does nothing here, and one
    // that is greyed says what is missing.
    expect(await btn.getAttribute('title'))
      .toContain('No floor with an outline to descend from');
  });

test('the button names the levels it would place on', async ({ page }) => {
  await open(page, empty({ outlines: [rect()] }));
  await armStair(page);
  const btn = autoStairButton(page);
  await expect(btn).toBeEnabled();
  expect(await btn.getAttribute('title')).toContain('MAIN FL');
});

// A LEVEL THAT ALREADY HAS A STAIR IS LEFT ALONE. Re-running must not stack a
// second flight on the first, and a hand-placed stair is the drafter's answer
// to this question already.
test('a second press places nothing and says so', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey');
  await armStair(page);
  await autoStairButton(page).click();
  await page.waitForTimeout(300);
  await saveNow(page);
  const after = ((await savedFile(page)).stairs || []).length;
  expect(after, 'the second press stacked another flight on the first').toBe(2);
});

// ── ONE PRESS IS ONE UNDO ──────────────────────────────────────────────────
//
// The stairs AND their openings ride in the one 'built' step that covers the
// whole building. A stair with an undo step of its own would make a premade
// house cost two Ctrl+Z, and an opening left behind by an undo that took the
// stair is a hole in a floor with nothing descending through it.
test('one Ctrl+Z takes the stairs and their openings with the house',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'twoStorey');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    await saveNow(page);
    const saved = await savedFile(page);
    expect((saved.stairs || []).length,
      'the undo took the house and left the stairs standing in mid air').toBe(0);
    expect((saved.surfaceOpenings || []).filter(o => o.stairId != null).length,
      'the undo left a hole in a floor with no stair through it').toBe(0);
  });

// ── THE TOOL SAYS WHAT IT CANNOT DO YET ────────────────────────────────────
//
// Hand placement is the second half of this task. A tool that swallows a press
// in silence is worse than one that refuses it: the drafter reads the click as
// landing and the stair as failing to draw.
test('a click with STAIR armed says hand placement is next', async ({ page }) => {
  await open(page, empty({ outlines: [rect()] }));
  await armStair(page);
  // planFrame, NOT clickWorld. helpers.clickWorld presses
  // `[data-model-canvas]`, which appears ZERO times in MODEL.html and twice in
  // MODEL.dc.html -- it is a dc-page helper, and against this page its
  // boundingBox() simply never resolves. The run does not fail, it HANGS, and
  // 180 seconds later reports a timeout naming a locator rather than a page.
  // That is the dead-caller trap one layer down from the one this file's
  // header is about: the helper is fine, it is just not this page's.
  // planFrame is the MODEL.html companion and reads #plan's data-view.
  const frame = await h.planFrame(page);
  const [px, py] = frame.at(0, 0);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  // #strip-message, NOT #strip. sayOnStrip writes into the SPAN
  // (MODEL.html:1149, `data-strip-message`); #strip is the whole top bar, so
  // asserting on it matched SETTINGS and STANDARDS and nothing the page said.
  await expect(page.locator('#strip-message')).toContainText('AUTO STAIR');
  await saveNow(page);
  expect(((await savedFile(page)).stairs || []).length,
    'the click placed a stair the tool has no gesture for').toBe(0);
});
