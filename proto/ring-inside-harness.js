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

// THIS HARNESS TOOK NO ARGUMENTS UNTIL 30 SEP, and the note it carried is
// worth keeping because it is half of why the table below took so long to
// arrive: `node ring-inside-harness.js --mutate` once printed a full passing
// run and exited 0, having mutated nothing. noFlags() fixed the lie by
// refusing the flag. THE OTHER HALF was the loader -- `require('../
// geometry-2d.js')` reads the file off disk, and node's require cannot see
// DRAFT_HARNESS_SOURCE_OVERRIDES, so no row could have reached the source
// even once the flag was honoured. Both had to go for the mode to be real.
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const { loadDraftModules } = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');

// ── THE MUTANTS ───────────────────────────────────────────────────────────
//
// The subject is a containment test with FOUR guards stacked on each other,
// and the checks above were written against a defect that got through twice.
// What the table proves is that each guard is still load-bearing -- that the
// flush cases pass because the boundary rule is there, and the L-notch cases
// fail because the edge-crossing loop is, rather than both happening to come
// out right through the point-in-polygon test alone.
const MUTATIONS = [
  // ── THE BOUNDARY RULE ───────────────────────────────────────────────────
  // ON THE BOUNDARY COUNTS AS INSIDE, and that is the whole reason this
  // design needs no sliver of floor beside a stairwell. Without it the
  // point-in-polygon test decides the flush cases, and which way it falls
  // depends on which wall the opening is flush to.
  ['the boundary no longer counts as inside', 'geometry-2d.js',
    c => c.replace('      if (onEdge(pt)) return true;\n', '')],

  // AND THE SEGMENT IT IS ON. `t` clamps the point to the edge's own span;
  // without it, anything collinear with an edge's INFINITE line is on that
  // edge -- a point far off the end of a wall included.
  ['a point collinear with an edge counts wherever it is on that line',
    'geometry-2d.js',
    c => c.replace('      return t >= -EPS && t <= 1 + EPS;', '      return true;')],

  // THE TOLERANCE IS A THOUSANDTH OF A FOOT, which is a hair. At a foot it
  // swallows a real overhang.
  ['the on-edge tolerance is a foot, not a thousandth', 'geometry-2d.js',
    c => c.replace('    const EPS = 0.001;', '    const EPS = 1;')],

  // ── CORNERS ARE NOT ENOUGH ──────────────────────────────────────────────
  // THE DEFECT THAT GOT THROUGH TWICE. Every corner of the triangle sits on
  // the L; only the edge-crossing loop refuses the one that runs its long
  // edge through the notch.
  ['corner containment alone decides it, with no edge test at all',
    'geometry-2d.js',
    c => c.replace('        if (properlyCrosses(a, b, c, d)) return false;\n', '')],

  // PROPERLY IS THE WORD THAT MATTERS. Non-strict signs make a touch or a
  // shared line count as a crossing, which refuses exactly the flush opening
  // the boundary rule above was written to allow -- two guards that would
  // then disagree with each other.
  ['touching counts as crossing, so a flush opening is refused',
    'geometry-2d.js',
    c => c.replace('      side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;',
      '      side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0;')],

  // AND IT TAKES BOTH PAIRS. One side alone asks whether the inner edge's
  // LINE separates two outer corners, which is true all over a floor an
  // opening sits well inside of.
  ['one side of the crossing test is enough', 'geometry-2d.js',
    c => c.replace('      side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;',
      '      side(a, b, c) * side(a, b, d) < 0;')],

  // ── THE POINT-IN-POLYGON UNDERNEATH ─────────────────────────────────────
  ['nothing asks whether the corners are in the floor at all', 'geometry-2d.js',
    c => c.replace('    if (!inner.every(within)) return false;\n', '')],

  ['one corner inside is enough, rather than every corner', 'geometry-2d.js',
    c => c.replace('    if (!inner.every(within)) return false;',
      '    if (!inner.some(within)) return false;')],

  // ── THE DEGENERATE GUARDS ───────────────────────────────────────────────
  ['two points count as a ring', 'geometry-2d.js',
    c => c.replace('    if (inner.length < 3 || outer.length < 3) return false;',
      '    if (inner.length < 2 || outer.length < 2) return false;')],

  ['a non-array is not refused, so it throws instead of answering',
    'geometry-2d.js',
    c => c.replace('    if (!Array.isArray(inner) || !Array.isArray(outer)) return false;\n', '')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('ring-inside',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const G = loadDraftModules().DraftGeometry2D;

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

// FLUSH OUTSIDE IS THE MIRROR OF FLUSH INSIDE, and the pair is what makes
// the boundary rule delicate. An opening pushed one bay too far sits clear
// of the floor while still SHARING a wall's line, so every corner of it
// answers "on the boundary" to a test that forgets to ask which part of the
// boundary. What separates these from the three flush cases above is that
// the shared line is an edge's EXTENSION, not the edge -- and that every
// corner has to be in the floor, not merely one of them.
check('pushed clear off the north wall, still on its line',
  G.ringInsideRing(rect(0, 14, 20, 4), FLOOR), false);
check('half as wide, so only two corners share that line',
  G.ringInsideRing(rect(0, 14, 10, 4), FLOOR), false);
check('and pushed off the east wall, on its line',
  G.ringInsideRing(rect(20, 0, 6, 14), FLOOR), false);

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
