// WHICH WAY ROUND THE OUTLINE WAS DRAWN CANNOT MATTER.
//
// Movie's list: "a drawn outline should always end up the exterior face". A
// drafter walks a house clockwise or anticlockwise as the hand falls, and the
// building has to come out the same either way -- the walls on the same lines,
// their thickness landing INSIDE the line he traced, the floor and the roof
// where they were on the other one.
//
// IT IS PINNED HERE RATHER THAN FIXED. Measured on this page first: a traced
// bungalow walked both ways round comes out with the same wall centrelines,
// the same floor, the same roof and the same outline box -- the refLine flips
// ('left' one way, 'right' the other) and that is the whole difference, which
// is the compensation doing its job. The pieces that make it true are spread
// over four files and none of them says so in a way a test can read:
//
//   turtle.js      insideIsLeft reads the signed area and picks refLine
//   traced-plans.js  re-winds a loop to match its neighbour, and asks which
//                    side of a midpoint is indoors "rather than trusting the
//                    winding"
//   geometry-2d.js offsetOutlineVariable chooses its flip by which way makes
//                  the ring BIGGER, so a positive distance always grows it;
//                  roofFaces and the weld walk re-wind their copies
//
// So this is the check that would go red if any one of them were simplified
// back to "assume the ring is clockwise".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

const empty = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function drawType(page) {
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  await page.locator('#dt-banner-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  // THE PRESS SEEDS A CORNER ON THE BULLSEYE. These two traces are a
  // rectangle ABOUT the origin -- which is what makes "towards the middle"
  // arithmetic-free above -- so the datum is not one of their corners, and
  // the drafter takes that corner back before walking his own.
  await h.dropSeededCorner(page);
}

async function trace(page, corners) {
  const { at } = await h.planFrame(page);
  for (const [x, z] of [...corners, corners[0]]) await page.mouse.click(...at(x, z));
  await page.waitForTimeout(150);
  // CONNECT AT CORNER, answered the way a drafter does.
  if (await page.locator('#corner-join').isVisible()) {
    await page.keyboard.press('Enter');
    await expect(page.locator('#corner-join')).toBeHidden();
  }
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

// A RECTANGLE ABOUT THE ORIGIN, so "towards the middle" is "towards (0,0)"
// and the inward test below needs no arithmetic of its own.
const CW = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
const CCW = [...CW].reverse();

const box = points => [
  +Math.min(...points.map(p => p.x)).toFixed(3), +Math.max(...points.map(p => p.x)).toFixed(3),
  +Math.min(...points.map(p => p.z)).toFixed(3), +Math.max(...points.map(p => p.z)).toFixed(3)];

const planWalls = d => (d.walls || [])
  .filter(w => Number(w.levelId) === MAIN_FL && w.view === 'plan');

// A wall as a line, with its two ends in a fixed order, so the same four walls
// compare equal however they were walked.
const asLine = w => {
  const a = [+w.start.x.toFixed(3), +w.start.z.toFixed(3)];
  const b = [+w.end.x.toFixed(3), +w.end.z.toFixed(3)];
  return JSON.stringify(a <= b ? [a, b] : [b, a]);
};

test('a house traced the other way round is the same house', async ({ page }) => {
  await open(page);
  await drawType(page);
  const one = await trace(page, CW);

  await open(page);
  await drawType(page);
  const other = await trace(page, CCW);

  expect(planWalls(one).length, 'four walls either way').toBe(4);
  expect(planWalls(other).length).toBe(4);
  expect(planWalls(other).map(asLine).sort(), 'the same four wall lines')
    .toEqual(planWalls(one).map(asLine).sort());

  const outlineOf = d => (d.outlines || []).find(o => Number(o.levelId) === MAIN_FL && !o.garage);
  expect(box(outlineOf(other).points), 'the same outline').toEqual(box(outlineOf(one).points));
  const floorBox = d => (d.floors || []).filter(f => Number(f.levelId) === MAIN_FL).map(f => box(f.points));
  expect(floorBox(other), 'the same floor').toEqual(floorBox(one));
  expect((other.roofs || []).map(r => box(r.points)), 'the same roof')
    .toEqual((one.roofs || []).map(r => box(r.points)));

  // AND THE DIFFERENCE IS THE COMPENSATION ITSELF: the ring really was walked
  // the other way, and refLine is what absorbs it. Without this the test could
  // pass on a page that silently re-wound the trace before building -- which
  // would be a different answer to the same question, and one that would move
  // every traced corner the drafter had already placed.
  const area2 = points => points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.z - q.x * p.z;
  }, 0);
  expect(Math.sign(area2(outlineOf(other).points)),
    'the second trace is wound the other way').toBe(-Math.sign(area2(outlineOf(one).points)));
  expect([...new Set(planWalls(one).map(w => w.refLine))], 'one way').toEqual(['left']);
  expect([...new Set(planWalls(other).map(w => w.refLine))], 'and the other').toEqual(['right']);
});

test('the line the drafter traced is the EXTERIOR face, whichever way he walked',
  async ({ page }) => {
    // ASKED OF THE PAGE, NOT OF THIS FILE. geometry-2d's wallFaceOffsets is
    // where "which side of the line is the wall" is decided -- the same three
    // lines render-2d paints by -- so the test reads the offsets off the page
    // and works out where the body landed. Writing `left means +perp` here
    // instead would be this file agreeing with itself: flip the convention in
    // the subject and a test that carried its own copy stays green.
    //
    // The body must fill TOWARDS the middle of the house on every wall, which
    // is what "the outline ends up the exterior face" means in the one place
    // it can be measured.
    for (const corners of [CW, CCW]) {
      await open(page);
      await drawType(page);
      const d = await trace(page, corners);
      const walls = planWalls(d);
      expect(walls.length, 'four walls went up').toBe(4);
      const inwards = await page.evaluate(list => list.map(w => {
        const G = window.DraftGeometry2D;
        const type = (window.DraftWallTypes.WALL_TYPES || [])
          .find(t => t.id === (w.wallType || 'stud_2x6'));
        const totalFt = (type ? type.totalIn : 6) / 12;
        const { startOff, endOff } = G.wallFaceOffsets(w, totalFt);
        const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z;
        const len = Math.hypot(dx, dz) || 1;
        // The band's own middle, across the line: + is the (-dz, dx) side.
        const across = (startOff + endOff) / 2;
        const mid = { x: (w.start.x + w.end.x) / 2, z: (w.start.z + w.end.z) / 2 };
        const body = { x: mid.x + (-dz / len) * across, z: mid.z + (dx / len) * across };
        // Did the body land nearer the middle of the house than the line did?
        return Math.hypot(body.x, body.z) < Math.hypot(mid.x, mid.z);
      }), walls);
      expect(inwards, `the wall body fills outward on a ${
        corners === CW ? 'clockwise' : 'anticlockwise'} loop`)
        .toEqual([true, true, true, true]);
    }
  });
