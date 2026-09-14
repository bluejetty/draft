#!/usr/bin/env node
// WHAT NOTHING SITS ON — the offline harness for uncoveredRegions.
//
// §5 of the TOY bones order, ruled 14 Sep: "every part of a floor that
// nothing sits on gets a roof over it". That is a polygon DIFFERENCE, and
// geometry-2d.js had no boolean operation before this.
//
// OFFLINE ON PURPOSE. It is a pure function of two rings, so a browser adds
// nothing but four minutes a run -- and the cases that matter here are
// SHAPES, which are quicker to state as coordinates than to drive through a
// canvas. The page-level checks assert that roofs get made; this asserts that
// the right area was found.
require('./harness-args.js').noFlags();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
['geometry-2d.js'].forEach(file =>
  (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8')));
const G = window.DraftGeometry2D;

let passed = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

const R = (x0, z0, x1, z1) => [
  { x: x0, y: 0, z: z0 }, { x: x1, y: 0, z: z0 },
  { x: x1, y: 0, z: z1 }, { x: x0, y: 0, z: z1 }];
const area = ring => Math.abs(ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length];
  return sum + (p.x * q.z - q.x * p.z);
}, 0) / 2);
const total = rings => rings.reduce((sum, r) => sum + area(r), 0);
const box = ring => [
  Math.min(...ring.map(p => p.x)), Math.min(...ring.map(p => p.z)),
  Math.max(...ring.map(p => p.x)), Math.max(...ring.map(p => p.z))];

// ── A RANCH: nothing above, so the whole floor is uncovered ────────────────
{
  const out = G.uncoveredRegions(R(0, 0, 40, 30), null);
  check('a ranch takes one roof over the whole floor', out.length === 1,
    `got ${out.length}`);
  check('and it is the whole floor', total(out) === 1200, `got ${total(out)}`);
}

// ── FULLY COVERED: an upper storey the same size leaves nothing ────────────
{
  const out = G.uncoveredRegions(R(0, 0, 40, 30), R(0, 0, 40, 30));
  check('a storey that covers the floor leaves no roof', out.length === 0,
    `got ${out.length} region(s), area ${total(out)}`);
}

// ── PULLED BACK FROM ONE SIDE ─────────────────────────────────────────────
{
  const out = G.uncoveredRegions(R(0, 0, 40, 30), R(0, 0, 40, 20));
  check('a storey pulled back leaves ONE strip', out.length === 1,
    `got ${out.length}`);
  check('the strip is the uncovered 40x10', total(out) === 400, `got ${total(out)}`);
  check('and it is where the ceiling was opened',
    String(box(out[0])) === String([0, 20, 40, 30]), String(box(out[0])));
}

// ── A FLOOR WIDER THAN THE ONE ABOVE ──────────────────────────────────────
{
  const out = G.uncoveredRegions(R(0, 0, 40, 30), R(0, 0, 25, 30));
  check('the part sticking out takes a roof', total(out) === 450, `got ${total(out)}`);
}

// ── SET BACK ALL ROUND: a ring, which no single footprint can hold ────────
{
  const out = G.uncoveredRegions(R(0, 0, 40, 30), R(10, 10, 30, 20));
  check('a setback on every side leaves a RING, cut into pieces',
    out.length === 4, `got ${out.length}`);
  check('and the pieces are exactly the ring', total(out) === 1200 - 200,
    `got ${total(out)}`);
  // NO OVERLAP, which is the failure a greedy decomposition makes: two
  // rectangles claiming the same strip roof it twice and the area still
  // looks right if you only add it up.
  const overlap = out.some((a, i) => out.some((b, j) => {
    if (i >= j) return false;
    const [ax0, az0, ax1, az1] = box(a), [bx0, bz0, bx1, bz1] = box(b);
    return ax0 < bx1 && bx0 < ax1 && az0 < bz1 && bz0 < az1;
  }));
  check('no two pieces overlap', !overlap, 'two roofs cover the same ground');
}

// ── AN L-SHAPED FLOOR, because every fixture so far is a rectangle ────────
{
  const L = [{ x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, { x: 40, y: 0, z: 15 },
    { x: 20, y: 0, z: 15 }, { x: 20, y: 0, z: 30 }, { x: 0, y: 0, z: 30 }];
  const out = G.uncoveredRegions(L, null);
  check('an L-shaped floor is covered completely', total(out) === 900,
    `got ${total(out)}`);
  const overlap = out.some((a, i) => out.some((b, j) => {
    if (i >= j) return false;
    const [ax0, az0, ax1, az1] = box(a), [bx0, bz0, bx1, bz1] = box(b);
    return ax0 < bx1 && bx0 < ax1 && az0 < bz1 && bz0 < az1;
  }));
  check('and its pieces do not overlap', !overlap);
}

// ── A STOREY THAT OVERHANGS: nothing of it is the lower floor's problem ───
{
  const out = G.uncoveredRegions(R(0, 0, 20, 20), R(10, 10, 40, 40));
  check('an overhanging storey only uncovers what is under the floor',
    total(out) === 400 - 100, `got ${total(out)}`);
}

// ── THE PIECE COUNT, which every check above was blind to ─────────────────
//
// A mutant that stopped the rectangles growing DOWNWARD survived all of the
// above: area and non-overlap are identical however the region is partitioned,
// so nothing could see it. I could not construct a distinguishing case by
// hand either, and was ready to call the downward run an unreachable
// optimisation and delete it -- which is exactly the reasoning that cost the
// `ask = land` line this morning.
//
// So I measured instead: over 4000 random lower/upper pairs the partition
// differs in 785 of them, and at worst the run gives ONE rectangle where its
// absence gives THREE. This is that case, kept as a fixture.
//
// It matters on the drawing, not just in the count: three stacked roof
// records over one strip of floor is three lean-tos where one roof belongs.
{
  const out = G.uncoveredRegions(R(3, 0, 4, 8), R(4, 1, 12, 3));
  check('a storey alongside the floor leaves ONE roof, not one per band',
    out.length === 1, `got ${out.length} pieces`);
  check('and it is the whole strip', total(out) === 8, `got ${total(out)}`);
}

console.log();
failures.forEach(f => console.log('  FAIL  ' + f));
console.log(`\n  ${passed} checks passed` + (failures.length
  ? `, ${failures.length} FAILED` : ''));
process.exit(failures.length ? 1 : 0);
