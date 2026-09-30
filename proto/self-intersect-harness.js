// geometry-2d.js selfIntersects — does a drafted ring cross itself?
//
// Audit M6 said offsetOutline has no self-intersection cleanup, reachability
// INFERRED. It is CONFIRMED now: the T-square forces segments onto an axis and
// hides it, `t` stows the T-square, and a crossing outline draws exactly as
// clicked. areas.js then reports 0 for it, because the lobes cancel.
//
// This proves only the detector. What the app should DO about a crossing
// outline is unruled and is not decided here.

// THIS HARNESS TOOK NO ARGUMENTS UNTIL 30 SEP. `--mutate` once printed a
// full passing run and exited 0 having mutated nothing; noFlags() stopped
// the lie by refusing the flag, and the loader below is what finally made
// the mode real -- node's require() reads the file off disk and cannot see
// DRAFT_HARNESS_SOURCE_OVERRIDES.
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const { loadDraftModules } = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');

// ── THE MUTANTS ───────────────────────────────────────────────────────────
//
// The checks below are almost all NEGATIVE -- fifteen shapes that must not be
// flagged against three that must. That balance is the point of the function
// and it is also the way a detector can be green while doing nothing: a
// selfIntersects that always returned false would pass fifteen of eighteen.
// So the rows that matter here are the ones that make it over-eager, because
// over-eager is the failure this function was rewritten to fix.
const MUTATIONS = [
  // THE REGRESSION THIS FUNCTION EXISTS BECAUSE OF, restored exactly. An
  // earlier version used segmentIntersection, whose tolerance counts a TOUCH
  // as a hit, and the vertex magnet leaves zero-width spikes in ordinary
  // saved rings -- out and back along one line. It called every one of them
  // a crossing and refused houses the app itself draws.
  ['touching counts as crossing, so a magnet spike is a crossing again',
    'geometry-2d.js',
    c => c.replace('      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;',
      '      if (side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0) return true;')],

  // AND IT TAKES BOTH SEGMENTS. One alone asks whether this edge-s LINE
  // separates the other edge-s ends, which is true all over any concave
  // plan -- an L, a T, a deep C.
  ['one segment-s line separating the other-s ends is enough',
    'geometry-2d.js',
    c => c.replace('      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;',
      '      if (side(a, b, c) * side(a, b, d) < 0) return true;')],

  // ANCHORED ON THE LOOP THAT FOLLOWS IT, because `const side = ...` matches
  // TWICE in geometry-2d.js -- ringInsideRing declares the same helper, with
  // the same name, body and indentation, and replace() takes the first.
  // mutant-anchors refused the row until it said which one it meant. (That
  // the two are byte-identical is its own small finding: one orientation
  // helper, written out twice.)
  ['the cross product is a sum, so which side is which is nonsense',
    'geometry-2d.js',
    c => c.replace('    const side = (a, b, p) => Math.sign((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));\n'
      + '    for (let i = 0; i < n; i += 1) {',
      '    const side = (a, b, p) => Math.sign((b.x - a.x) * (p.z - a.z) + (b.z - a.z) * (p.x - a.x));\n'
      + '    for (let i = 0; i < n; i += 1) {')],

  ['a non-array throws instead of answering no', 'geometry-2d.js',
    c => c.replace('    if (!Array.isArray(points) || points.length < 4) return false;\n', '')],

  // THE DETECTOR THAT DOES NOTHING. Fifteen of the eighteen checks are
  // negative, so a selfIntersects that never fires passes most of this file;
  // this row is what says the three positive ones are real.
  ['nothing is ever a crossing', 'geometry-2d.js',
    c => c.replace('      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;',
      '      if (false) return true;')],

  // AND THE FLOOR ON A RING. Four corners is the smallest ring that CAN
  // cross itself, and every positive check in this file has exactly four.
  ['a four-corner ring is too small to be asked about', 'geometry-2d.js',
    c => c.replace('    if (!Array.isArray(points) || points.length < 4) return false;',
      '    if (!Array.isArray(points) || points.length < 8) return false;')],

  // ── THREE ROWS ARE NOT HERE, AND ALL THREE WERE WRITTEN FIRST ───────────
  //
  // They are in one group because they have one cause: the strict sign test
  // makes three older guards unreachable, and none of them can be bent into
  // a different answer by any ring.
  //
  //   `for (let j = i + 2; ...)` loosened to `i + 1`, so ADJACENT segments
  //   are compared. They share a corner, so one side is always 0 and the
  //   product is never < 0.
  //
  //   `if (i === 0 && j === n - 1) continue;` deleted, so the CLOSING PAIR
  //   is compared. Same reason -- it shares points[0].
  //
  //   `points[(i + 1) % n]` for `b` turned into a non-wrapping read, so the
  //   last segment never closes the ring. The inner loop starts at i + 2,
  //   so when i is n - 1 it does not run at all and that `b` is never used.
  //   `d` wraps on its own line and is untouched, so the closing segment is
  //   still compared as the INNER one.
  //
  // MEASURED, NOT ONLY ARGUED: 400,000 random rings of 4 to 7 corners, plus
  // the eighteen shapes below and two built to cross on the closing edge --
  // zero disagreements with the unmutated function, for all three.
  //
  // THE GUARDS STAY. They were load-bearing under the segmentIntersection
  // version this replaced, whose tolerance counted a touch as a hit, and
  // they are the right shape again the moment the sign test is loosened --
  // which is exactly what the first row of this table does. They earn their
  // place by skipping work, not by changing an answer, and a row that cannot
  // go red for a reason that matters is not a row.
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('self-intersect',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const modules = loadDraftModules();
const G = modules.DraftGeometry2D;
const A = modules.DraftAreas;
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
