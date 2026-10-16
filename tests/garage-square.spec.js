// THE GARAGE SQUARE: NOTHING STANDS WHERE THE CAR GOES, AND A BEAM NEVER
// RESTS OVER A DOOR.
//
// Movie, 16 Oct: "on a 2 storey garage the stairs can't overlap where the
// garage door / car will be or the landing area for the man door (42"x42"
// landing" ... "lets go 20ft total 'height (length) for square" ... "(not +4)
// just 20" ... "actually on the sides only make it increase by 6" so the colms
// can know they can be placed between the 2 doors" ... "no columns in that
// area either".
//
// And: "the beam cant rest over the garage opening or door opening either,
// they should have a solid support column built into the wall below where the
// beam rests (can't be opening)".
//
// The square itself is build-house.js garageKeepOuts, proved in
// proto/mid-span-beam-harness.js; this is the page obeying it -- the auto
// stair, the auto beam's columns and bearings, and what the page says when a
// garage is too shallow for its own square. proto/garage-square-mutants.js is
// this spec's gate.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = 32, D = 24;              // 32 side wall to side wall, 24 deep: two bays and a pier a stair fits on
const DOOR_FT = 20 / 3;            // his 6'8" overhead doors
const INSET = 5.5 / 12;            // a 2x6 wall, line to inside face
const STAIR_ID = 7501;

const garageWall = (id, x0, z0, x1, z1) => ({
  id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', body: 'garage',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const loop = (id, levelId, garage) => ({
  id, levelId, garage,
  points: [{ x: 0, y: 0, z: 0 }, { x: W, y: 0, z: 0 }, { x: W, y: 0, z: D }, { x: 0, y: 0, z: D }],
});
// THE FRONT WALL RUNS x = 0 -> W at z = D -- the other way round the loop
// from its neighbours, on purpose: its right-hand normal points OUT of the
// garage, so the square's "into the garage" has to be worked out and not
// assumed from the wall's direction. An offset from its start is the door's x.
const overhead = (x, i, width = DOOR_FT) => ({
  id: `gd-${i}`, wallId: 'g-front', levelId: 3, view: 'plan', type: 'door', layer: 'A-DOOR',
  offset: x, width, sillHeight: 0, headHeight: 7, garage: true,
});
const FILE = ({ doors, depth = D } = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 2,
  walls: [garageWall('g-back', 0, 0, W, 0), garageWall('g-right', W, 0, W, depth),
    garageWall('g-front', 0, depth, W, depth), garageWall('g-left', 0, depth, 0, 0)],
  fenestrations: doors,
  outlines: [
    { ...loop('garage-out', 3, true), points: loop('garage-out', 3, true).points.map(p => ({ ...p, z: Math.min(p.z, depth) })) },
    { ...loop('room-out', 5, false), points: loop('room-out', 5, false).points.map(p => ({ ...p, z: Math.min(p.z, depth) })) },
  ],
  stairs: [], surfaceOpenings: [],
  // THE ROOM'S FLOOR, which is what a well is cut through.
  floors: [{ id: 'room-floor', levelId: 5, view: 'floor', garage: false,
    points: loop('room-out', 5, false).points.map(p => ({ ...p, z: Math.min(p.z, depth) })) }],
  lines: [], roofs: [], dimensions: [], shapes: [],
  notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});
const TWO_DOORS = [overhead(8, 0), overhead(24, 1)];
const ONE_WIDE_DOOR = [overhead(16, 0, 16)];

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?left=1&lpane=build&right=1&level=5&view=floor');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function arm(page, tool) {
  await h.showLeftPane(page, h.TOOL_PANE[tool] || 'build');
  const key = page.locator(`[data-tool-key="${tool}"]`);
  if (await key.getAttribute('aria-pressed') !== 'true') {
    await key.click();
    await page.waitForTimeout(150);
  }
}
const autoBeam = async page => { await arm(page, 'beam'); await page.locator('[data-auto-beam]').click(); await page.waitForTimeout(300); };
const autoStair = async page => { await arm(page, 'stair'); await page.locator('[data-auto-stair]').click(); await page.waitForTimeout(300); };
async function saved(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return page.evaluate(async bucket => JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text()), BUCKET);
}
const boxOf = points => ({
  x0: Math.min(...points.map(p => p.x)), x1: Math.max(...points.map(p => p.x)),
  z0: Math.min(...points.map(p => p.z)), z1: Math.max(...points.map(p => p.z)),
});
const r = n => Math.round(n * 1000) / 1000;
// His two squares, as the rule draws them: door + 6" each side, 20 ft in from
// the inside face of the door wall.
const SQUARES = [8, 24].map(x => ({
  x0: x - DOOR_FT / 2 - 0.5, x1: x + DOOR_FT / 2 + 0.5, z0: D - INSET - 20, z1: D - INSET,
}));
const overlaps = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;

test('the stair to the room over the garage lands on the pier between the doors, not where a car goes',
  async ({ page }) => {
    await open(page, FILE({ doors: TWO_DOORS }));
    // The beam first, as the build does: the row stands on the pier, and the
    // stair hugs it -- on the pier, where the squares leave 8'-4" of floor.
    await autoBeam(page);
    await autoStair(page);
    const d = await saved(page);
    const well = (d.surfaceOpenings || []).find(o => Number(o.levelId) === 5 && Number(o.stairId) > 0);
    expect(well, 'a stair was placed and its well cut').toBeTruthy();
    const box = boxOf(well.points);
    SQUARES.forEach((square, i) => expect(overlaps(box, square),
      `the well ${JSON.stringify(box)} stands in the square of door ${i} ${JSON.stringify(square)}`).toBe(false));
    expect(box.x0, 'on the pier').toBeGreaterThan(SQUARES[0].x1 - 1e-6);
    expect(box.x1).toBeLessThan(SQUARES[1].x0 + 1e-6);
  });

test('the beam between two doors keeps its columns, and a 6x6 is built into the wall under each end',
  async ({ page }) => {
    await open(page, FILE({ doors: TWO_DOORS }));
    await autoBeam(page);
    const d = await saved(page);
    const beams = (d.beams || []).filter(b => b.auto && Number(b.levelId) === 3);
    expect(beams.length, 'one row').toBe(1);
    expect(beams[0].start.x, 'on the pier, between the doors').toBeCloseTo(16, 6);
    const cols = (d.columns || []).filter(c => c.auto && Number(c.levelId) === 3);
    const pads = cols.filter(c => c.footing !== 'post6');
    expect(pads.map(c => c.point.z).sort((a, b) => a - b), 'columns down the pier, none dropped').toEqual([8, 16]);
    pads.forEach(c => SQUARES.forEach(square => expect(overlaps({ x0: c.point.x, x1: c.point.x, z0: c.point.z, z1: c.point.z }, square),
      'no column where the car goes').toBe(false)));
    // "a solid support column built into the wall below where the beam rests"
    const posts = cols.filter(c => c.footing === 'post6');
    expect(posts.map(c => [r(c.point.x), r(c.point.z)]).sort((a, b) => a[1] - b[1]), 'a post under each end, in the wall')
      .toEqual([[16, 0], [16, D]]);
    posts.forEach(c => expect(c.inWall).toBe(true));
  });

test('a beam never rests over the garage door: the row slides to solid wall and its columns leave the square',
  async ({ page }) => {
    // ONE 16 FT DOOR IN THE MIDDLE: the even row would land at 16, over it.
    await open(page, FILE({ doors: ONE_WIDE_DOOR }));
    await autoBeam(page);
    const d = await saved(page);
    const beams = (d.beams || []).filter(b => b.auto && Number(b.levelId) === 3);
    expect(beams.length, 'one row').toBe(1);
    // The door runs 8 to 24; the post is half a 6x6 and 1 1/2" of bearing
    // clear of it: 4 1/4", so the row stands at 7'-7 3/4".
    expect(beams[0].start.x, 'off the door, on solid wall').toBeCloseTo(8 - 4.25 / 12, 4);
    const cols = (d.columns || []).filter(c => c.auto && Number(c.levelId) === 3);
    // The square is 17 ft wide (7'-6" to 24'-6") and 20 ft deep, so every
    // column along that row would stand in front of the car: all dropped,
    // and the beam spans wall to wall on its two posts.
    expect(cols.filter(c => c.footing !== 'post6'), 'no column in the square').toEqual([]);
    expect(cols.filter(c => c.footing === 'post6').length, 'the two posts in the walls').toBe(2);
  });

test('a garage too shallow for its square says so on the garage plan, once', async ({ page }) => {
  // 18 FT DEEP: the square is capped at the floor, 17'-1" inside face to
  // inside face, and the page says the garage needs more depth.
  await open(page, FILE({ doors: TWO_DOORS, depth: 18 }));
  await autoBeam(page);
  const d = await saved(page);
  const notes = (d.notes || []).filter(n => Number(n.levelId) === 3 && n.view === 'plan' && /^GARAGE SQUARE/.test(n.body));
  expect(notes.length, 'one note').toBe(1);
  expect(notes[0].body).toMatch(/17'-1" DEEP -- THIS GARAGE NEEDS MORE DEPTH/);
  expect(notes[0].body).toMatch(/20'-0" FROM THE DOOR WALL FOR A CAR/);
  // AND A RE-RUN TAKES ITS OWN WORDS BACK before saying them again.
  await autoBeam(page);
  const again = await saved(page);
  expect((again.notes || []).filter(n => /^GARAGE SQUARE/.test(n.body)).length, 'said once').toBe(1);
});
