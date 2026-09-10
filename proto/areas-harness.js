#!/usr/bin/env node
// areas.js — AN OPENING IS DEDUCTED FROM A FLOOR IT IS NOT ON.
//
// Verdict 2 of the module review gate (MODULE-REVIEW-GATE.md:117), the only
// WRONG of the seventeen: `openingsSqFt += polygonArea(opening.points)` adds
// the full area of every record whose hostId names the floor, with no test
// that the hole is on it. The error is silent, and always in the applicant's
// favour, on a number that goes on a permit application.
//
// THE GATE'S TABLE AND THE RULING DIVERGE ON ONE ROW, deliberately. The gate
// tabulated:
//
//   floor 20x14 = 280 sq ft
//   opening 10x4 fully inside     deducts 40   net 240   correct
//   opening HALF off the edge     deducts 40   net 240   should be net 260
//   opening ENTIRELY outside      deducts 40   net 240   should be net 280
//
// `net 260` is the CLIPPING answer -- deduct only the 20 sq ft actually over
// floor. Verdict 2 offered clipping or refusing and said "the fix needs a
// ruling"; the ruling (Kevin, 9 Sep) chose REFUSING: an opening not inside its
// host is not deducted at all, and the level's line says so. Under that ruling
// the half-off row is net 280, not 260. The scenarios below are the gate's
// verbatim so the two can be read side by side; the expectations are the
// ruling's.
//
// NOT COVERED HERE, on purpose: polygonArea's bowtie contract -- a
// self-intersecting ring shoelaces to exactly zero -- is verdict 2's other
// half, a shared missing precondition tracked as audit M6. It belongs with M6
// rather than being half-fixed inside this change.
//
// Run: node proto/areas-harness.js
require('./harness-args.js').noFlags();

global.window = global.window || {};
require('../geometry-2d.js');
require('../areas.js');
const { computeAreas } = global.window.DraftAreas;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  const ok = Math.abs(got - want) < 0.001;
  if (!ok) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};
const checkEq = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};

const rect = (x, z, w, d) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
const LEVELS = [{ id: 3, name: 'MAIN FL' }];
// The gate's floor, verbatim: 20 x 14 = 280 sq ft.
const FLOOR = { id: 'f1', levelId: 3, points: rect(0, 0, 20, 14) };

const run = openings => computeAreas({
  levels: LEVELS, floors: [FLOOR], openings,
  outlines: [], roomTags: [], basementLevelId: null,
}).levels[0];

// ── The gate's three cases ──────────────────────────────────────────────────
// The 10x4 opening is 40 sq ft in every one of them; only its position moves.
let row = run([{ hostId: 'f1', points: rect(5, 5, 10, 4) }]);
check('fully inside: deducts 40, net 240', row.netSqFt, 240);
checkEq('fully inside: nothing excluded', row.excludedOpenings, 0);

row = run([{ hostId: 'f1', points: rect(15, 5, 10, 4) }]);
check('HALF off the east edge: deducts nothing, net 280', row.netSqFt, 280);
checkEq('half off: one opening excluded', row.excludedOpenings, 1);

row = run([{ hostId: 'f1', points: rect(40, 40, 10, 4) }]);
check('ENTIRELY outside: deducts nothing, net 280', row.netSqFt, 280);
checkEq('entirely outside: one opening excluded', row.excludedOpenings, 1);

// ── Flush must still deduct ─────────────────────────────────────────────────
// The workflow the whole design exists for: a stair opening run out to the
// exterior wall, sharing that wall's line exactly. Boundary counts as inside,
// so this is a real hole and comes off. A careless containment fix breaks
// exactly this case and forces the drafter back to leaving a sliver.
row = run([{ hostId: 'f1', points: rect(0, 5, 6, 4) }]);
check('FLUSH to the west wall still deducts 24, net 256', row.netSqFt, 256);
checkEq('flush: nothing excluded', row.excludedOpenings, 0);

row = run([{ hostId: 'f1', points: rect(0, 0, 6, 4) }]);
check('flush in a corner, two walls at once, still deducts', row.netSqFt, 280 - 24);

// FLUSH TO THE EAST EDGE, and this one is not a duplicate of the west case.
// Found by mutation: disabling the boundary test entirely left every other
// check green. `within`'s ray casts to the RIGHT, so a corner on the WEST edge
// still crosses the east wall and reads inside without any boundary rule --
// the west flush case passes for the wrong reason. A corner on the EAST edge
// crosses nothing, so ONLY the on-boundary test can answer it. Without this
// row, a fix that made the boundary exclusive would ship green and quietly
// stop deducting every stairwell run out to that wall.
row = run([{ hostId: 'f1', points: rect(14, 5, 6, 4) }]);
check('FLUSH to the east wall still deducts 24, net 256', row.netSqFt, 256);
checkEq('flush east: nothing excluded', row.excludedOpenings, 0);

// ── A concave floor: corners inside, an edge that leaves ────────────────────
// This is why ringInsideRing asks twice. A corners-only fix passes a
// corners-only test, so the test has to be one corners alone would let through.
const L = { id: 'f2', levelId: 3,
  points: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 6 }, { x: 10, z: 6 },
           { x: 10, z: 14 }, { x: 0, z: 14 }] };
const runL = openings => computeAreas({
  levels: LEVELS, floors: [L], openings,
  outlines: [], roomTags: [], basementLevelId: null,
}).levels[0];
const L_AREA = 20 * 6 + 10 * 8;   // 120 + 80 = 200
row = runL([{ hostId: 'f2',
  points: [{ x: 2, z: 13 }, { x: 18, z: 5 }, { x: 2, z: 5 }] }]);
check('every corner on the L but an edge through the notch: not deducted',
  row.netSqFt, L_AREA);
checkEq('L notch: one opening excluded', row.excludedOpenings, 1);

row = runL([{ hostId: 'f2', points: rect(2, 8, 6, 4) }]);
check('inside the L short leg: deducts 24', row.netSqFt, L_AREA - 24);

// ── Already handled, pinned so a fix cannot quietly undo them ───────────────
row = run([{ hostId: 'SOMEONE_ELSE', points: rect(5, 5, 10, 4) }]);
check('hostId names another floor: never deducted here', row.netSqFt, 280);
checkEq('hostId mismatch is not an exclusion of THIS floor', row.excludedOpenings, 0);

row = run([{ hostId: 'f1', points: [{ x: 5, z: 5 }, { x: 6, z: 6 }] }]);
check('degenerate opening under 3 points: dropped before it counts', row.netSqFt, 280);
checkEq('degenerate is not reported as an exclusion', row.excludedOpenings, 0);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
