// geometry-2d.js selfIntersects — does a drafted ring cross itself?
//
// Audit M6 said offsetOutline has no self-intersection cleanup, reachability
// INFERRED. It is CONFIRMED now: the T-square forces segments onto an axis and
// hides it, `t` stows the T-square, and a crossing outline draws exactly as
// clicked. areas.js then reports 0 for it, because the lobes cancel.
//
// This proves only the detector. What the app should DO about a crossing
// outline is unruled and is not decided here.
global.window = global.window || {};
require('../geometry-2d.js');
require('../areas.js');            // polygonArea lives here, not in geometry-2d
const G = global.window.DraftGeometry2D;
const A = global.window.DraftAreas;
const P = (...c) => c.map(([x, z]) => ({ x, z }));

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};

// Simple rings must not be flagged: adjacent edges share a corner, and the
// closing pair share another, and both land inside segmentIntersection's own
// tolerance. Counting them would call every polygon self-intersecting.
check('a square is simple', G.selfIntersects(P([0,0],[10,0],[10,10],[0,10])), false);
check('the same square wound backwards is simple', G.selfIntersects(P([0,10],[10,10],[10,0],[0,0])), false);
check('a triangle is simple', G.selfIntersects(P([0,0],[10,0],[0,10])), false);
check('an L-shape is simple', G.selfIntersects(P([0,0],[10,0],[10,4],[4,4],[4,10],[0,10])), false);

// The shape a drafter can actually draw, measured in the browser with the
// T-square stowed: clicked corners come back unsnapped and polygonArea is 0.
check('a bowtie crosses itself', G.selfIntersects(P([-10,-8],[10,8],[10,-8],[-10,8])), true);
check('and its shoelace area is 0', A.polygonArea(P([-10,-8],[10,8],[10,-8],[-10,8])), 0);
check('a figure-eight crosses itself', G.selfIntersects(P([0,0],[10,10],[0,10],[10,0])), true);

// Degenerate input answers rather than throwing: too few points cannot cross.
check('two points cannot cross', G.selfIntersects(P([0,0],[10,0])), false);
check('three points cannot cross', G.selfIntersects(P([0,0],[10,0],[5,5])), false);
check('empty is false', G.selfIntersects([]), false);
check('a non-array is false', G.selfIntersects(null), false);

// THE REGRESSION THAT MATTERS. The vertex magnet merges a drafter's small jog
// into a ZERO-WIDTH SPIKE -- out and back along one line -- and that ring is
// normal, permanent and present in ordinary saved drawings. An earlier version
// of this function used segmentIntersection, whose tolerance counts a touch as
// a hit, so it called every spike a crossing and turned auto-dims.spec.js red
// by refusing a house with a 1 7/16" step in one wall.
check('a MAGNET SPIKE is not a crossing',
  G.selfIntersects(P([-8,-6],[8,-6],[8,6],[3,6],[3,3],[3,6],[-8,6])), false);
check('the same ring before the magnet merged it',
  G.selfIntersects(P([-8,-6],[8,-6],[8,6],[3,6],[3,3],[2.88,3],[2.88,6],[-8,6])), false);

// Concave houses must pass: rectangle, L and T are starter-shape.js's own
// three outputs, and a deep C or U is an ordinary plan.
check('an L-shaped house', G.selfIntersects(P([0,0],[20,0],[20,6],[10,6],[10,14],[0,14])), false);
check('a T-shaped house', G.selfIntersects(P([0,0],[20,0],[20,6],[14,6],[14,14],[6,14],[6,6],[0,6])), false);
check('a deep C', G.selfIntersects(P([0,0],[12,0],[12,3],[3,3],[3,9],[12,9],[12,12],[0,12])), false);
check('a U-shape', G.selfIntersects(P([0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10])), false);

// And the case that defeats every area-ratio test: an unequal bowtie encloses
// the same fraction of itself that a deep C does (0.500 against 0.541), so no
// threshold separates them. A proper crossing test does not care.
check('a bowtie with UNEQUAL lobes still crosses',
  G.selfIntersects(P([0,0],[10,4],[10,0],[0,8])), true);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
