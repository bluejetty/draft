// PAST THE SPAN THE JOISTS REACH, OVER A GARAGE -- decided, not asked.
//
// Movie, 12 Oct, on how it is carried: "PLACE COLUMNS to support BEAM (which
// are placed 10ft max from the back wall to where the front of the room above
// is ... place the columns centered between 2 doors so the cars won't hit the
// columns", "the beam doesn't need to be steel", "DROPPED ENGINEERED BEAM".
//
// AND 15 OCT, ON WHO DECIDES: "don't ask the user about placing beams and
// columns or the engineered owj, just make the decision based on spans don't
// ask the user, they can adjust it later if they need too". A card used to go
// up here with two answers on it. The span answers now.
//
// THE SPAN THAT DECIDES is build-house.js's garageBareSpanFt: the deepest OWJ
// the table holds, read at the 16" o.c. he lays first -- 28 ft over a garage.
// Past it the joists would need the 12" o.c. last resort, which is what his
// own 30 ft detached garage came out on and what he was looking at when he
// said the span was too far.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const D = 40;           // front to back; the span is the WIDTH, side wall to side wall
const WIDE = 36;        // past the 28 ft a bare deck reaches
const STAIR_ID = 7401;
// A well inside the room, two feet off the left wall: the joists run across it
// in x, so the side that runs farther to its next support is the inboard edge.
const WELL = { x0: 2, x1: 5.5, z0: 8, z1: 20 };

const garageWall = (id, W, x0, z0, x1, z1) => ({
  id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', body: 'garage',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const loop = (id, levelId, garage, W) => ({
  id, levelId, garage,
  points: [{ x: 0, y: 0, z: 0 }, { x: W, y: 0, z: 0 }, { x: W, y: 0, z: D }, { x: 0, y: 0, z: D }],
});
const door = (offset, i) => ({
  id: `gd-${i}`, wallId: 'g-front', levelId: 3, view: 'plan', type: 'door', layer: 'A-DOOR',
  offset, width: 8, sillHeight: 0, headHeight: 7, garage: true,
});
// TWO DOORS AT A QUARTER AND THREE QUARTERS ACROSS -- 9 and 27 ft on the 36 ft
// garage, which is where the beam between them lands. The front wall runs from
// x = W back to 0, so an offset along it counts down from W.
const FILE = (W, { well = false } = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 2,
  walls: [garageWall('g-back', W, 0, 0, W, 0), garageWall('g-right', W, W, 0, W, D),
    garageWall('g-front', W, W, D, 0, D), garageWall('g-left', W, 0, D, 0, 0)],
  fenestrations: [door(W * 0.75, 0), door(W * 0.25, 1)],
  outlines: [loop('garage-out', 3, true, W), loop('room-out', 5, false, W)],
  stairs: well ? [{
    id: STAIR_ID, levelId: 5, view: 'plan', layer: 'A-STR',
    start: { x: (WELL.x0 + WELL.x1) / 2, z: WELL.z0 },
    end: { x: (WELL.x0 + WELL.x1) / 2, z: WELL.z1 },
    widthFt: WELL.x1 - WELL.x0, riseFt: 9, rail: 'left',
    shape: 'straight', turn: 'right', winders: 0,
  }] : [],
  surfaceOpenings: well ? [{
    id: 'well-1', hostType: 'floor', hostId: 'room-floor', levelId: 5, stairId: STAIR_ID,
    points: [{ x: WELL.x0, z: WELL.z0 }, { x: WELL.x1, z: WELL.z0 },
      { x: WELL.x1, z: WELL.z1 }, { x: WELL.x0, z: WELL.z1 }],
  }] : [],
  lines: [], floors: [], roofs: [], dimensions: [], shapes: [],
  notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, W = WIDE, opts = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: FILE(W, opts) });
  // ON 2ND FL: AUTO BEAM frames the floor of the level on screen, and the
  // room over the garage is the 2ND FL's.
  await page.goto('/MODEL.html?left=1&right=1&level=5&view=floor');
  await page.waitForTimeout(800);
  await h.showLeftPane(page, h.TOOL_PANE.beam || 'build');
  const key = page.locator('[data-tool-key="beam"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await key.click();
}
const autoBeam = page => page.locator('[data-auto-beam]').click();
async function saved(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return page.evaluate(async bucket => JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text()), BUCKET);
}
const notesOn = (d, levelId, re) => (d.notes || []).filter(n => Number(n.levelId) === levelId && re.test(n.body));

test('past the span it puts a DROPPED ENGINEERED BEAM between the doors, unasked', async ({ page }) => {
  await open(page);
  await autoBeam(page);
  await expect(page.locator('#garage-span'), 'nothing to answer').toHaveCount(0);
  const d = await saved(page);
  const beams = (d.beams || []).filter(b => b.auto && Number(b.levelId) === 3);
  expect(beams.length, 'one beam: 36 ft is two rows of joists').toBe(1);
  expect(beams[0].mode, 'dropped, "better for ducts ... and insulation"').toBe('dropped');
  expect(beams[0].start.x, 'between the doors at 9 and 27 ft').toBeCloseTo(WIDE / 2, 6);
  expect([beams[0].start.z, beams[0].end.z].sort((a, b) => a - b), 'back wall to front of the room').toEqual([0, D]);
  const auto = (d.columns || []).filter(c => c.auto && Number(c.levelId) === 3);
  const cols = auto.filter(c => c.footing !== 'post6').map(c => c.point.z).sort((a, b) => a - b);
  expect(cols, '10 ft apart at most, none where the beam bears on a wall').toEqual([10, 20, 30]);
  // AND WHERE IT BEARS ON A WALL, A POST BUILT INTO THE WALL (Movie, 16 Oct:
  // "a solid support column built into the wall below where the beam
  // rests"): a 6x6 under each end, on the pier between the doors.
  const posts = auto.filter(c => c.footing === 'post6');
  expect(posts.map(c => [c.point.x, c.point.z]).sort((a, b) => a[1] - b[1]), 'a post under each end')
    .toEqual([[WIDE / 2, 0], [WIDE / 2, D]]);
  posts.forEach(c => expect(c.inWall, 'built into the wall').toBe(true));
  expect(notesOn(d, 3, /^DROPPED ENGINEERED BEAM$/).length, 'the beam is marked').toBe(1);
  const owj = notesOn(d, 5, /^ENGINEERED OWJ/);
  expect(owj.length).toBe(1);
  expect(owj[0].body, 'the joists now span wall to beam').toMatch(/WALL TO BEAM -- 18'-0" SPAN/);
  expect(notesOn(d, 5, /^REQ ENGINEERED BEAM/).length).toBe(0);

  // AND A RE-RUN GIVES THE SAME ANSWER, because the same span is still there.
  // It is the sweep that makes this worth checking: AUTO BEAM takes its own
  // records out before it lays them again, so a second press must leave one
  // beam and one tag rather than two of each.
  await autoBeam(page);
  await page.waitForTimeout(200);
  const rerun = await saved(page);
  expect((rerun.beams || []).filter(b => b.auto && b.mode === 'dropped').length, 'still the dropped beam').toBe(1);
  expect(notesOn(rerun, 3, /^DROPPED ENGINEERED BEAM$/).length, 'one tag, not two').toBe(1);
});

test('a deck inside the span keeps the garage clear, with no beam at all', async ({ page }) => {
  // THE OTHER HALF OF THE RULE, and the one that keeps 12 Oct's "we don't want
  // columns in the garage" true: a span the joists reach on their own gets the
  // OWJ note and nothing else. 26 ft is inside the 28 ft ceiling.
  await open(page, 26);
  await autoBeam(page);
  const d = await saved(page);
  expect((d.beams || []).filter(b => b.auto).length, 'no beam').toBe(0);
  expect((d.columns || []).filter(c => c.auto).length, 'no column in the garage').toBe(0);
  const owj = notesOn(d, 5, /^ENGINEERED OWJ/);
  expect(owj.length, 'the joists are named on the room-s floor layout').toBe(1);
  expect(owj[0].body, 'side wall to side wall, as they are').toMatch(/SIDE WALL TO SIDE WALL -- 26'-0" SPAN/);
  expect(owj[0].body, 'and at the spacing he lays first').toMatch(/@ 16" O\.C\./);
  expect(notesOn(d, 5, /^REQ ENGINEERED BEAM/).length, 'the engineer-s note is gone for good').toBe(0);
});

test('the 30 ft detached garage -- his own -- gets its beam and its header', async ({ page }) => {
  // THE BUILDING HE REPORTED. 30 ft side wall to side wall used to come out on
  // "ENGINEERED OWJ 23-1/4\" @ 12\" O.C." and no beam: "there should have been
  // at least 1 beam (or 2 with one by the stairs) the span was too far".
  await open(page, 30, { well: true });
  await autoBeam(page);
  const d = await saved(page);
  const beams = (d.beams || []).filter(b => b.auto && Number(b.levelId) === 3);
  const dropped = beams.filter(b => b.mode === 'dropped');
  expect(dropped.length, 'the row across the floor').toBe(1);

  // AND THE ONE BY THE STAIRS: a flush header on the well edge the joists run
  // farther to reach -- the inboard one, since the other side is a 2 ft stub
  // against the wall. It carries the stair's id, the way the well does.
  const header = beams.find(b => b.mode === 'flush');
  expect(header, 'the header by the stairs').toBeTruthy();
  expect(header.stairId, 'filed against the stair it heads off').toBe(STAIR_ID);
  expect(Math.min(header.start.x, header.end.x), 'on the well-s inboard edge')
    .toBeCloseTo(WELL.x1, 2);
  expect([header.start.z, header.end.z].sort((a, b) => a - b), 'the length of the well')
    .toEqual([WELL.z0, WELL.z1]);

  // THE DECK IS LIGHTER FOR IT: the row is half the span, so the joist the
  // table answers with is no longer its deepest at its tightest spacing.
  expect(notesOn(d, 5, /^ENGINEERED OWJ/)[0].body).toMatch(/WALL TO BEAM/);
  expect(notesOn(d, 5, /^ENGINEERED OWJ/)[0].body).not.toMatch(/@ 12" O\.C\./);
});
