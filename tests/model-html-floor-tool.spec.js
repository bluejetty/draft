// THE FLOOR TOOL ON MODEL.html — drawing the thing the page could already paint.
//
// PARITY-model-html-vs-dc.md has carried the row "Draw a floor — floor tool,
// absent, must-have: it paints floors it cannot create" since tier 2c, when
// Gilligan wired drawFloor2D into this page. A floor drawn by the old page
// arrives here and renders, corner handles and all; a drafter sitting in front
// of this page had no way to make one.
//
// WHAT IS MEASURED IS MOSTLY THE RECORD, not the pixels, and one pair of
// fields above the rest: `view` and `structure`. A floor saved with the wrong
// view is INVISIBLE — it lands on a layer set the drafter is not looking at —
// and a framed floor saved as a slab is three inches of concrete where a foot
// of joists belongs. Neither shows on the canvas the moment it is drawn, which
// is exactly why they are the first thing this file asks about.
//
// THE ONE PIXEL CHECK IS THE FIRST CORNER, and it is a pixel check because
// nothing else can answer it: the question is whether the drafter SEES the
// press land, and a record cannot say. It is the first test in the file for
// the same reason — every other check presses corners and trusts they went
// somewhere, and this is the one that looks.
//
// THE THICKNESSES ARE WRITTEN OUT IN INCHES rather than read back off
// window.DraftLevelAssembly. Asking the page which number it used and then
// checking it used that number is a tautology; these are the module's own
// constants copied by hand, so a change to either end has to be made twice and
// the failure names this file.
//
// PRESSES ARE AIMED THROUGH THE PUBLISHED CAMERA (h.planFrame), so a corner
// lands on the world point it names rather than on centre-of-canvas arithmetic
// that stops being true the moment anything pans or zooms.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

const MAIN_FL = 3;
const FOUNDATION = 1;

// level-assembly.js's own two numbers, copied. DEFAULT_FLOOR_THICKNESS_IN is
// derived there (joistDepthIn 11-7/8 + sheathingIn 3/4); DEFAULT_FDN_SLAB_-
// THICKNESS_IN is the 3" pour.
const FRAMED_IN = 12.625;
const SLAB_IN = 3;

// A drawing with BOTH kinds of level in it, because the rule under test is a
// rule ABOUT levels: FOUNDATION (id 1) has a foundation layer set and MAIN FL
// (id 3) does not, and layer-views.js turns that one difference into a slab or
// a framed floor. A fixture with one level could not tell the two apart.
const base = extra => ({
  version: 1,
  levels: [{ id: FOUNDATION, name: 'FOUNDATION', elev: -8 },
    { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 1,
  board: 'drafting',
  // Walls on MAIN FL, for the same reason the outline spec keeps them: they
  // are what the page paints to prove it opened, and they give fit() a house
  // to frame so the camera is not looking at an empty sheet.
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

const readout = page => page.locator('#readout');

// The count the page itself shows, so a check can be made without saving.
// `floors 1/1` is shown-of-total: the first number is what the active layer
// set holds, which is the half that catches a floor filed under the wrong view.
const floorsShown = async page => Number(
  (await readout(page).textContent()).match(/floors (\d+)\/(\d+)/)?.[1] ?? -1);
const floorsTotal = async page => Number(
  (await readout(page).textContent()).match(/floors (\d+)\/(\d+)/)?.[2] ?? -1);

async function open(page, { level = MAIN_FL, view = 'floor', file = base({}) } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 for the tool column: FLOOR has no legacy button on this page, so
  // the key in the rail is the only way to arm it.
  await page.goto(`/MODEL.html?level=${level}&view=${view}&left=1`);
  await expect(readout(page)).toContainText('floors', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="floor"]')).toBeVisible();
}

const armFloor = page => page.locator('[data-tool-key="floor"]').click();

// A PRESS AIMED AT THE SHEET HAS TO LAND ON THE SHEET. The left rail is a
// control and takes its own presses, and where a world point falls is the
// camera's business: fit() frames whatever the fixture left standing and the
// scale it picks moves from run to run. So the view is zoomed out until every
// corner of the loop is over the canvas, and the browser's own hit-testing is
// what says when it is — arithmetic against the rail's box would be a second
// copy of the page's layout, free to disagree with it.
const onSheet = (page, points) => page.evaluate(list => list.map(([cx, cy]) => {
  const el = document.elementFromPoint(cx, cy);
  return !!el && el.id === 'plan';
}), points);

async function frameForLoop(page, corners) {
  let frame = await h.planFrame(page);
  for (let notch = 0; notch < 10; notch += 1) {
    const points = corners.map(([x, z]) => frame.at(x, z));
    if ((await onSheet(page, points)).every(Boolean)) return frame;
    await page.mouse.move(frame.box.x + frame.box.width / 2,
      frame.box.y + frame.box.height / 2);
    await page.mouse.wheel(0, 120);   // out, so the loop moves toward the middle
    await page.waitForTimeout(80);
    frame = await h.planFrame(page);
  }
  throw new Error('no zoom puts every corner of this loop on the sheet');
}

// Press corners in order WITHOUT closing. The frame is returned so a caller
// can go on pressing through the same camera.
async function press(page, frame, corners) {
  for (const [x, z] of corners) {
    const at = frame.at(x, z);
    await page.mouse.click(at[0], at[1]);
    await page.waitForTimeout(100);
  }
}

// THE CLOSE IS THE GESTURE'S ENDING — no Enter, no FINISH — because that is
// the old page's contract (_handleFloorClick) and a tool that needs a keyboard
// is not one an iPad can use.
const closeOn = (page, frame, [x, z]) => press(page, frame, [[x, z]]);

async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

// THE READ THAT MATTERS: not what the page is holding, but what a fresh load
// of the saved file keeps. window.DraftDrawingFormat is the same normaliser
// the page runs on load, so this asks the question the reload asks — and it is
// the read that catches an id or a field the reader quietly drops.
const survives = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await file.text());
  const F = window.DraftDrawingFormat;
  const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
  return {
    raw: (raw.floors || []).length,
    floors: F.floors(raw.floors, levelIds, {
      defaultFloorThickness: 1,
      defaultFloorAssembly: {},
    }),
  };
}, BUCKET);

const SQUARE = [[-6, -5], [6, -5], [6, 5], [-6, 5]];

// WHAT IS ACTUALLY ON THE GLASS around a world point, in device pixels.
//
// The trace check below reads the canvas rather than recording a strokeStyle.
// A recorded colour says the painter was TOLD one; it passes just as happily
// when the colour is set on a context that then draws nothing, and "the
// half-drawn loop is invisible" is the exact defect this rung is fixing --
// Movie on the outline tool, 17 Sep: "outline command doesn't work".
//
// AN OFF-CANVAS SAMPLE IS AN ERROR, NOT AN ANSWER. getImageData clamps its
// rectangle and transparent pixels count as no ink, so a sample taken past the
// edge comes back clean and reads as "nothing painted there" -- which is how a
// pixel check in this suite went green while measuring a patch that was not on
// screen at all.
async function inkAt(page, frame, [x, z], rgb, radius = 12) {
  const [clientX, clientY] = frame.at(x, z);
  return page.evaluate(({ clientX, clientY, radius, target }) => {
    const canvas = document.getElementById('plan');
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const px = Math.round((clientX - rect.left) * sx);
    const py = Math.round((clientY - rect.top) * sy);
    const size = Math.max(4, Math.round(radius * 2 * sx));
    const x0 = Math.round(px - size / 2);
    const y0 = Math.round(py - size / 2);
    if (x0 < 0 || y0 < 0 || x0 + size > canvas.width || y0 + size > canvas.height) {
      throw new Error(`sample at ${px},${py} is not wholly on the canvas`);
    }
    const { data } = canvas.getContext('2d').getImageData(x0, y0, size, size);
    let hits = 0;
    for (let i = 0; i < data.length; i += 4) {
      const d = Math.max(Math.abs(data[i] - target[0]),
        Math.abs(data[i + 1] - target[1]), Math.abs(data[i + 2] - target[2]));
      if (d <= 10 && data[i + 3] > 200) hits += 1;
    }
    return hits;
  }, { clientX, clientY, radius, target: rgb });
}

// palette.js's draw-floor-edge, written out because that is what comes back
// off the canvas. Hard-coded on purpose: asking the page what colour it used
// and then checking it used that colour is a tautology.
const EDGE = [0x59, 0x80, 0xa6];

test('the first corner of a trace is visible on the sheet', async ({ page }) => {
  // A PRESS THAT CHANGES NOTHING CANNOT BE TOLD FROM A PRESS THAT MISSED.
  // drawFloor2D returns early under two points, so the first corner of a floor
  // is the one mark the shared painter will never make -- which is precisely
  // the press a drafter needs to see land.
  await open(page);
  const frame = await frameForLoop(page, SQUARE);
  const CORNER = SQUARE[0];

  // The control, and it is not a formality: this spot has to be blank before
  // the press for "ink after it" to mean the trace and not the drawing.
  expect(await inkAt(page, frame, CORNER, EDGE),
    'nothing is on this spot before the corner is placed').toBe(0);

  await armFloor(page);
  await press(page, frame, [CORNER]);
  expect(await inkAt(page, frame, CORNER, EDGE),
    'the corner the drafter placed is on the sheet').toBeGreaterThan(0);
});

test('a closed loop becomes a floor that survives save and reload',
  async ({ page }) => {
    await open(page);
    expect(await floorsTotal(page), 'the fixture starts with no floors, so the '
      + 'one counted below can only be the one drawn').toBe(0);

    await armFloor(page);
    const frame = await frameForLoop(page, [...SQUARE, SQUARE[0]]);
    await press(page, frame, SQUARE);
    await closeOn(page, frame, SQUARE[0]);

    expect(await floorsShown(page), 'the closed loop is on screen').toBe(1);
    await save(page);

    const after = await survives(page);
    expect(after.raw, 'the page wrote a floor').toBe(1);
    // THE HALF THAT CATCHES A DROPPED RECORD. drawing-format reads a floor's
    // id with String() and refuses anything under three points, so a loop
    // written with two corners or a missing level lands in the file and
    // disappears on the next load with nothing said at either end.
    expect(after.floors.length, 'and a reload keeps it').toBe(1);

    const floor = after.floors[0];
    expect(floor.points.length, 'all four corners, in the order pressed').toBe(4);
    // Within a foot of where they were aimed: the press is mapped through the
    // published camera and rounded to a pixel, and a pixel is a tenth of a
    // foot at these scales. A corner that went somewhere else went somewhere
    // else by more than this.
    SQUARE.forEach(([x, z], index) => {
      expect(Math.abs(floor.points[index].x - x),
        `corner ${index} x`).toBeLessThan(1);
      expect(Math.abs(floor.points[index].z - z),
        `corner ${index} z`).toBeLessThan(1);
    });
    expect(floor.levelId, 'filed against the level it was drawn on').toBe(MAIN_FL);
  });

test('MAIN FL gets a framed floor, FOUNDATION gets a slab', async ({ page }) => {
  // THE RULE IS layer-views.js's floorHomeView, and it is the one that
  // surprises: a level with a foundation layer set puts its floor on
  // FOUNDATION as a slab, because such a level's floor IS its foundation.
  // MAIN FL has no foundation set, so it gets a framed floor on FLOOR.
  await open(page, { level: MAIN_FL, view: 'floor' });
  await armFloor(page);
  let frame = await frameForLoop(page, SQUARE);
  await press(page, frame, SQUARE);
  await closeOn(page, frame, SQUARE[0]);
  await save(page);

  const framed = (await survives(page)).floors[0];
  expect(framed, 'MAIN FL must have got a floor at all').toBeTruthy();
  expect(framed.view, 'a floor on a level with no foundation set saves to '
    + 'the FLOOR layer set').toBe('floor');
  expect(framed.structure, 'and it is framed, not poured').toBe('floor');
  expect(framed.thickness * 12, "a framed floor is its assembly's own depth")
    .toBeCloseTo(FRAMED_IN, 3);

  // FOUNDATION, on the same drawing, drawn on its own layer set.
  await open(page, { level: FOUNDATION, view: 'foundation' });
  await armFloor(page);
  frame = await frameForLoop(page, SQUARE);
  await press(page, frame, SQUARE);
  await closeOn(page, frame, SQUARE[0]);
  await save(page);

  const slab = (await survives(page)).floors[0];
  expect(slab, 'FOUNDATION must have got a floor at all').toBeTruthy();
  expect(slab.view, 'a floor drawn on FOUNDATION saves there').toBe('foundation');
  expect(slab.structure, 'and it is a slab').toBe('slab');
  expect(slab.thickness * 12, "a slab is as thick as its level pours")
    .toBeCloseTo(SLAB_IN, 3);

  // The control the two halves need: these are different numbers. Were the
  // page to write one thickness for both, every assertion above would still
  // read as if it had checked something.
  expect(FRAMED_IN).not.toBeCloseTo(SLAB_IN, 3);
});

test("a floor drawn on FOUNDATION's walls plan is still a slab, and says so",
  async ({ page }) => {
    // THE CLAUSE OF floorHomeView THAT SURPRISES, and the one the test above
    // could not reach: a level that HAS a foundation set files its floor there
    // WHICHEVER set the drafter was looking at, because such a level's floor
    // IS its foundation. Drawn on FOUNDATION's own foundation set the rule is
    // indistinguishable from "save where you drew"; only this case separates
    // them. Written after a mutation that replaced floorHomeView with its
    // first clause alone survived the rest of this file.
    await open(page, { level: FOUNDATION, view: 'plan' });
    await armFloor(page);
    const frame = await frameForLoop(page, SQUARE);
    await press(page, frame, SQUARE);
    await closeOn(page, frame, SQUARE[0]);

    await save(page);
    const floor = (await survives(page)).floors[0];
    expect(floor, 'the loop must have committed at all').toBeTruthy();
    expect(floor.view, 'a level with a foundation set puts its floor there '
      + 'whichever set it was drawn on').toBe('foundation');
    expect(floor.structure, 'which makes it concrete, not joists').toBe('slab');
    expect(floor.thickness * 12, 'poured to the level\'s own slab thickness')
      .toBeCloseTo(SLAB_IN, 3);

    // AND THE DRAFTER IS TOLD, because the consequence of that rule is a slab
    // that is nowhere on the sheet they are looking at. This page has no
    // courtesy set to keep it visible, so the sentence is what stands between
    // a correct save and a tool that looks broken.
    expect(await floorsShown(page), 'it is not on the plan set').toBe(0);
    expect(await floorsTotal(page), 'but it is in the drawing').toBe(1);
    await expect(page.locator('[data-strip-message]'))
      .toContainText('not on this layer set');
  });

test('a crossing loop is refused, and the corners already placed are kept',
  async ({ page }) => {
    // A BOWTIE: the four corners in this order make a simple open polyline,
    // and only the CLOSING edge crosses it. So the refusal is about the close
    // and not about a corner that was already impossible to place.
    const BOWTIE = [[-6, -5], [6, -5], [6, 5], [12, 0]];
    // One more corner takes the crossing out: the closing edge now comes back
    // below the loop instead of through it. Verified against the module
    // offline — selfIntersects says true for the four and false for the five.
    const RESCUE = [12, -9];

    await open(page);
    await armFloor(page);
    const frame = await frameForLoop(page, [...BOWTIE, RESCUE]);
    await press(page, frame, BOWTIE);
    await closeOn(page, frame, BOWTIE[0]);

    expect(await floorsTotal(page), 'a loop that crosses itself encloses no '
      + 'area, so nothing is drawn').toBe(0);
    await expect(page.locator('[data-strip-message]')).toContainText('crosses itself');

    // THE HALF THIS TEST IS REALLY FOR. A refusal that cleared the trace would
    // make the drafter retrace the whole room to move one corner. The corners
    // are still there, so one more press and a close finish the loop they
    // started — and the five corners in the saved record are the proof.
    await press(page, frame, [RESCUE]);
    await closeOn(page, frame, BOWTIE[0]);
    expect(await floorsTotal(page), 'the fifth corner closes it').toBe(1);

    await save(page);
    const floor = (await survives(page)).floors[0];
    expect(floor.points.length, 'all five corners — the four that were refused '
      + 'and the one that rescued them').toBe(5);
  });

test('with two corners down, a press on the first places a corner',
  async ({ page }) => {
    // TWO CORNERS ENCLOSE NO AREA, so below three a press near the first is a
    // drafter putting a corner there and not a close. The shape below is a
    // thin triangle whose third corner sits 1.2 ft from the first — inside the
    // close radius — so if that press closed, the gesture would end with two
    // corners and commit nothing.
    const A = [-6, -5], B = [6, -5], NEAR_A = [-6, -3.8];
    await open(page);
    await armFloor(page);
    const frame = await frameForLoop(page, [A, B, NEAR_A]);
    await press(page, frame, [A, B, NEAR_A]);
    // Nothing yet: three corners are down but none of them closed anything.
    expect(await floorsTotal(page), 'placing the third corner is not closing')
      .toBe(0);
    await closeOn(page, frame, A);

    expect(await floorsTotal(page), 'and now the close lands').toBe(1);
    await save(page);
    expect((await survives(page)).floors[0].points.length,
      'three corners, the third of them the one near the first').toBe(3);
  });

test('one undo takes the floor back', async ({ page }) => {
  await open(page);
  await armFloor(page);
  const frame = await frameForLoop(page, SQUARE);
  await press(page, frame, SQUARE);
  await closeOn(page, frame, SQUARE[0]);
  expect(await floorsTotal(page)).toBe(1);

  // ONE PRESS IS ONE UNDO. A floor is one gesture however many corners it
  // took, the same contract the wall and the column keep.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  expect(await floorsTotal(page), 'the floor goes back in one keystroke').toBe(0);

  await save(page);
  expect((await survives(page)).raw, 'and the undone floor is not in the file')
    .toBe(0);
});

test('the tool puts itself down once the loop closes', async ({ page }) => {
  await open(page);
  await armFloor(page);
  await expect(page.locator('[data-tool-key="floor"]'))
    .toHaveAttribute('aria-pressed', 'true');

  const frame = await frameForLoop(page, SQUARE);
  await press(page, frame, SQUARE);
  await closeOn(page, frame, SQUARE[0]);

  // A TOOL THAT STAYS ARMED DRAWS A SECOND FLOOR under the next press, which
  // is the old page's behaviour for a finished gesture and not this page's:
  // every placement tool here rests when it is done, so the drafter's next
  // press is a selection rather than a corner they did not mean.
  await expect(page.locator('[data-tool-key="floor"]'))
    .toHaveAttribute('aria-pressed', 'false');
  await press(page, frame, [[-2, 0], [2, 0], [2, 3]]);
  expect(await floorsTotal(page), 'three more presses draw nothing').toBe(1);
});
