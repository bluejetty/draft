// CLOSED RISERS, THE UNDERSIDE AND WHITE CEILINGS IN 3D (jb, 28 Nov 2026).
//
// jb: "on the stairs we should put a 1/2 board on the front of the steps to
// cover the hole, and then on the back a 1/2" wood to cover it underside
// (at diagonal angle) ... or should i show the underside and expose the
// multiple stringers". Agreed on OBJ PROP: RISER BOARDS ON or NONE, and
// UNDERSIDE CLOSED (1/2" WOOD or 1/2" GYP, "painted white") or SHOW
// STRINGERS; "leave both of those ON", "DEFAULT WOOD for backing". And
// "make the ceiling and inside of stair opening default to WHITE (GYP
// Painted)".
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FIXTURE = path.join(__dirname, '..', 'proto', 'repro-movie-2storey-garage.draft');
const DRYWALL = [238, 236, 230];

async function build(p, change = null) {
  await p.goto('/viewer/index.html?painter=plain');
  await p.waitForSelector('body[data-ready="1"]');
  const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  return p.evaluate(([s, src]) => {
    if (src) s = (new Function('s', src))(s) || s;
    const built = DraftViewer.loadDrawing(s, 'test');
    const of = kind => built.faces.filter(f => f.kind === kind && !f.hologram);
    const levels = {};
    built.stack.floors.forEach(l => { levels[l.id] = { top: l.floorTop, bottom: l.floorBottom }; });
    return {
      stairs: built.counts.stairs,
      levels,
      risers: of('riser').map(f => ({ ys: f.pts.map(q => q.y), colour: f.colour })),
      under: of('stair-under').map(f => ({ ys: f.pts.map(q => q.y), colour: f.colour })),
      floors: of('floor').map(f => ({ ys: f.pts.map(q => q.y), colour: f.colour, flat: f.pts.every(q => Math.abs(q.y - f.pts[0].y) < 1e-6) })),
    };
  }, [saved, change]);
}

test('by default every step has a 1/2" riser board and the underside is closed in wood', async ({ page: p }) => {
  const r = await build(p);
  expect(r.stairs).toBe(2);
  // Six faces a board; 14 risers a flight here (13 treads + the top one),
  // two flights.
  expect(r.risers.length).toBeGreaterThanOrEqual(2 * 13 * 6);
  expect(r.risers.length % 6).toBe(0);
  // The top riser of the 2ND FL flight reaches up under the 1" nosing
  // board that lies flush with the 2ND FL.
  const top = Math.max(...r.risers.flatMap(f => f.ys));
  expect(top).toBeCloseTo(r.levels[5].top - 1 / 12, 3);
  // A board on the slope and one closing the stringers' plumb ends at the
  // head of the flight ("the back flat part of stringer"), each flight.
  expect(r.under.length).toBeGreaterThanOrEqual(2 * 2 * 6);
  expect(r.under.every(f => f.colour.join() !== DRYWALL.join())).toBe(true);
  const open = await build(p, `s.stairs.forEach(st => { st.underside = 'open'; }); return s;`);
  expect(open.under).toEqual([]);
  expect(open.risers.length).toBe(r.risers.length);
});

test('1/2" WOOD and 1/2" GYP cover the underside on the slope; GYP is white', async ({ page: p }) => {
  const wood = await build(p);
  expect(wood.under.length).toBeGreaterThanOrEqual(2 * 6);
  expect(wood.under.every(f => f.colour.join() !== DRYWALL.join())).toBe(true);
  // On the slope: each board's faces span most of a storey's fall.
  const fall = Math.max(...wood.under.flatMap(f => f.ys)) - Math.min(...wood.under.flatMap(f => f.ys));
  expect(fall).toBeGreaterThan(6);
  const gyp = await build(p, `s.stairs.forEach(st => { st.underside = 'gyp'; }); return s;`);
  expect(gyp.under.length).toBe(wood.under.length);
  expect(gyp.under.every(f => f.colour.join() === DRYWALL.join())).toBe(true);
});

test('a floor is wood on top, white painted board underneath and round the stair hole', async ({ page: p }) => {
  const r = await build(p);
  const L5 = r.levels[5];
  const at = (f, y) => f.ys.every(v => Math.abs(v - y) < 1e-6);
  const tops = r.floors.filter(f => f.flat && at(f, L5.top));
  const bottoms = r.floors.filter(f => f.flat && at(f, L5.bottom));
  expect(tops.length).toBeGreaterThan(0);
  expect(bottoms.length).toBeGreaterThan(0);
  expect(tops.every(f => f.colour.join() !== DRYWALL.join())).toBe(true);
  expect(bottoms.every(f => f.colour.join() === DRYWALL.join())).toBe(true);
  // The upright sides: the stair hole's are white; the outside edge's are not.
  const sides = r.floors.filter(f => !f.flat && Math.min(...f.ys) >= L5.bottom - 1e-6 && Math.max(...f.ys) <= L5.top + 1e-6);
  expect(sides.some(f => f.colour.join() === DRYWALL.join())).toBe(true);
  expect(sides.some(f => f.colour.join() !== DRYWALL.join())).toBe(true);
});

test('RISER BOARDS NONE leaves the steps open', async ({ page: p }) => {
  const r = await build(p, `s.stairs.forEach(st => { st.riserBoards = false; }); return s;`);
  expect(r.stairs).toBe(2);
  expect(r.risers).toEqual([]);
});

// jb, 28 Nov 2026: "the top step looks like there is a gap, there should be
// a nosing or backing board of WOOD in there". This file's MAIN FL hole edge
// is 2 1/2" behind the 2ND FL flight's head (x -16.625 vs -16.4167).
test('the head of a flight is closed to the hole edge: wood backing down the floor, nosing flush with it', async ({ page: p }) => {
  await p.goto('/viewer/index.html?painter=plain');
  await p.waitForSelector('body[data-ready="1"]');
  const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const r = await p.evaluate(s => {
    const built = DraftViewer.loadDrawing(s, 'test');
    const L5 = built.stack.floors.find(l => l.id === 5);
    const wood = built.faces.filter(f => f.kind === 'stair-head' && f.group === 'L3');
    const xs = wood.flatMap(f => f.pts.map(q => q.x));
    const atEdge = wood.filter(f => f.pts.some(q => Math.abs(q.x + 16.625) < 1e-3));
    const ys = atEdge.flatMap(f => f.pts.map(q => q.y));
    return { minX: Math.min(...xs), lo: Math.min(...ys), hi: Math.max(...ys), top: L5.floorTop, bottom: L5.floorBottom };
  }, saved);
  expect(r.minX).toBeCloseTo(-16.625, 3);
  expect(r.hi).toBeCloseTo(r.top, 3);
  expect(r.lo).toBeCloseTo(r.bottom, 3);
});
