// geometry-2d.js ringInsideRing — is this opening actually in that floor?
//
// A floor opening is deducted from its host ARITHMETICALLY: the slab polygon is
// never cut, so nothing else in the app ever asks whether the hole is really in
// the floor it is charged against. Measured before this existed, on a 20x14
// floor with a 10x4 opening:
//
//   fully inside      deducts 40   net 240   correct
//   half off the edge deducts 40   net 240   should be 260
//   entirely outside  deducts 40   net 240   should be 280
//
// THE FLUSH CASE IS THE ONE TO GET RIGHT. A stair opening run to an exterior
// wall shares that wall's line exactly. An ArchiCAD drafter leaves a sliver of
// floor there to keep the slab one measurable piece; this app never cuts the
// slab, so the sliver is unnecessary — and a containment test that refused a
// flush edge would put it straight back.
global.window = global.window || {};
require('../geometry-2d.js');
const G = global.window.DraftGeometry2D;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};
const rect = (x, z, w, d) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
const FLOOR = rect(0, 0, 20, 14);
// An L-shaped floor: the notch is the concave corner corner-tests alone miss.
const L = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 6 }, { x: 10, z: 6 }, { x: 10, z: 14 }, { x: 0, z: 14 }];

check('an opening well inside its floor', G.ringInsideRing(rect(5, 5, 10, 4), FLOOR), true);

// The workflow this was written for: the stairwell against the outside wall.
check('FLUSH to the west wall is allowed', G.ringInsideRing(rect(0, 5, 6, 4), FLOOR), true);
check('flush to the north edge is allowed', G.ringInsideRing(rect(5, 10, 6, 4), FLOOR), true);
check('flush in a corner, two walls at once', G.ringInsideRing(rect(0, 0, 6, 4), FLOOR), true);

// Overhang is the defect: its area is deducted as though it were floor.
check('half hanging off the east edge', G.ringInsideRing(rect(15, 5, 10, 4), FLOOR), false);
check('entirely outside the building', G.ringInsideRing(rect(40, 40, 10, 4), FLOOR), false);
check('a hair over the edge still fails', G.ringInsideRing(rect(19.9, 5, 1, 4), FLOOR), false);

// Corner containment alone would pass this one: every corner sits on the L,
// but the span crosses the notch that is not floor.
check('spanning an L-shaped floor notch', G.ringInsideRing(rect(6, 4, 10, 4), L), false);
check('inside the L short leg', G.ringInsideRing(rect(2, 8, 6, 4), L), true);

// THE CASE THAT WAS WRONG TWICE. Every corner of this triangle sits on the L,
// but the long edge runs through the notch that is not floor. Corner
// containment passes it. So did a midpoint sample, because the midpoint lands
// exactly on the leg's boundary. Only a proper edge-crossing test refuses it.
check('an edge through the L notch, all corners inside',
  G.ringInsideRing([{ x: 2, z: 13 }, { x: 18, z: 5 }, { x: 2, z: 5 }], L), false);

// Degenerate input answers rather than throwing.
check('too few points is false', G.ringInsideRing([{ x: 0, z: 0 }, { x: 1, z: 1 }], FLOOR), false);
check('a non-array is false', G.ringInsideRing(null, FLOOR), false);
check('no host is false', G.ringInsideRing(rect(5, 5, 2, 2), null), false);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
