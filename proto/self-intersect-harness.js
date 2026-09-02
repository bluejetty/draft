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

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
