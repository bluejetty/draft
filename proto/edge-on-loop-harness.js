// geometry-2d.js edgeOnLoop — is this edge ON that loop?
//
// WHAT AN ATTACHED GARAGE ASKS BEFORE IT RAISES A WALL. Movie, 18 Sep, with
// the offending wall marked in green on a screenshot of the new page: "the
// garage has an extra wall that is not needed. the garage walls should link
// into the house (look at how the DC version did it)". The DC version is one
// line of _buildGarageWalls -- skip an edge that lies on the house outline --
// and this is that test, now read by BOTH pages from one place.
//
// THE MIDPOINT CLAUSE IS WHY THIS FILE EXISTS. Two of the three samples are
// obvious and neither the bungalow nor any other fixture in the suite can tell
// whether the third is there: that plan's shared edges run straight along the
// house, so "both ends on the house" and "the whole edge on the house" agree
// on every one of them. The case that separates them has to be built, and it
// is the L-shaped house below -- a wall whose two ends are house corners and
// whose middle crosses open air. Dropping that wall would leave the building
// open to the weather, and nothing in the browser suite would have said so.
//
// AND THE ARC, for the same reason in the other direction. pointToSegment
// FOLLOWS a bulge; a points-only version of this test would straighten every
// arc edge on the way past and answer a different question on exactly the
// outlines where the answer is hard to see. MODEL.dc.html hands this its own
// outline segments, bulges and all, so the check below is what stops that
// delegation quietly becoming a lie.

// THIS FILE ALREADY DID MUTATION TESTING -- BY HAND, AND ONLY ONCE. Two of
// the checks below say so in their own comments: one was "written after a
// mutation loosening `near(a) && near(b)` to `||` survived every other check
// in this file", and another after a loopSegments that stopped at the last
// pair "survived this file until this check was written". geometry-2d.js
// carries a third, where a redundant `|| !segments.length` was deleted
// because a mutation of it changed no answer at all.
//
// THAT WORK WAS REAL AND NOTHING RE-RAN IT. A finding in prose is a claim
// about the day it was written; the table below is the same three rows plus
// the ones nobody had got to, run on every push.
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const { loadDraftModules } = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  // ── THE MIDPOINT CLAUSE ─────────────────────────────────────────────────
  // THE ROW THIS FILE WAS WRITTEN AROUND. Both ends on the house is not the
  // same question as the edge being on the house, and the shape that tells
  // them apart -- a chord across an L's notch -- is not in any fixture the
  // browser suite draws. Dropping the wall it names leaves the building open
  // to the weather.
  ['both ends on the loop is enough, with no midpoint sample',
    'geometry-2d.js',
    c => c.replace('    return near(a) && near(b)\n'
      + '      && near({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });',
      '    return near(a) && near(b);')],

  // AND ALL THREE SAMPLES HAVE TO LAND. This is the hand-run row recorded in
  // the check below it: either end plus a middle says yes to a wall that is
  // mostly nowhere.
  ['either end will do, so long as the middle lands', 'geometry-2d.js',
    c => c.replace('    return near(a) && near(b)\n'
      + '      && near({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });',
      '    return (near(a) || near(b))\n'
      + '      && near({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });')],

  ['the midpoint is not the middle, but the first end-s x', 'geometry-2d.js',
    c => c.replace('      && near({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });',
      '      && near({ x: a.x, z: (a.z + b.z) / 2 });')],

  // ── THE CLOSING EDGE ────────────────────────────────────────────────────
  // THE SECOND HAND-RUN ROW. A loop that stops at the last pair leaves one
  // whole wall of every building unaskable, and every other check in this
  // file passes while it does.
  ['the loop never closes, so its last wall cannot be asked about',
    'geometry-2d.js',
    c => c.replace('      end: list[(index + 1) % list.length],',
      '      end: list[index + 1] || point,')],

  // ── THE TOLERANCE ───────────────────────────────────────────────────────
  // A tenth of a foot is the old page-s own eps, carried over: enough for a
  // corner that has been through a vertex pool and a save, not enough for a
  // wall that is really somewhere else.
  ['the default tolerance is a foot, not a tenth', 'geometry-2d.js',
    c => c.replace('  function edgeOnLoop(a, b, segments, eps = 0.1) {',
      '  function edgeOnLoop(a, b, segments, eps = 1) {')],

  ['the caller-s tolerance is ignored for the built-in one', 'geometry-2d.js',
    c => c.replace('    const near = pt => segments.some(seg => pointToSegment(pt, seg).d <= eps);',
      '    const near = pt => segments.some(seg => pointToSegment(pt, seg).d <= 0.1);')],

  // ── THE BULGE ───────────────────────────────────────────────────────────
  // SEGMENTS, NOT POINTS, is the reason MODEL.dc.html can hand this its own
  // outline unchanged. Straighten the arc and this answers a different
  // question on exactly the drawings where the answer is hard to see.
  // ANCHORED ON THE FUNCTION LINE ABOVE IT, because `if (!seg.bulge) {` on
  // its own matches TWICE in geometry-2d.js -- pointOnLineSeg has the same
  // line, and replace() takes the first. mutant-anchors-harness refused this
  // row until it named which one it meant, which is the guard doing exactly
  // its job: the row would have bent a function this check never calls and
  // then reported the arc claim as proven.
  ['an arc is read as its chord', 'geometry-2d.js',
    c => c.replace('  function pointToSegment(worldPt, seg) {\n    if (!seg.bulge) {',
      '  function pointToSegment(worldPt, seg) {\n    if (true) {')],

  // ── THE SAMPLES AND THE GUARD ───────────────────────────────────────────
  ['a sample has to be near EVERY segment, not some segment',
    'geometry-2d.js',
    c => c.replace('    const near = pt => segments.some(seg => pointToSegment(pt, seg).d <= eps);',
      '    const near = pt => segments.every(seg => pointToSegment(pt, seg).d <= eps);')],

  ['a missing segment list throws instead of answering no', 'geometry-2d.js',
    c => c.replace('    if (!Array.isArray(segments)) return false;\n', '')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('edge-on-loop',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const G = loadDraftModules().DraftGeometry2D;

const P = (...corners) => corners.map(([x, z]) => ({ x, z }));
const at = (x, z) => ({ x, z });

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};

// ── The bungalow's own arrangement, in the small ─────────────────────────
// A house rectangle and an edge lying along its front wall: the green one.
const HOUSE = P([-16, -20], [16, -20], [16, 20], [-16, 20]);
const houseSegs = G.loopSegments(HOUSE);

check('an edge lying along the house-s front wall is on it',
  G.edgeOnLoop(at(-4, 20), at(16, 20), houseSegs), true);
check('and so is the 1 ft tie down its side wall -- the one nobody reports',
  G.edgeOnLoop(at(16, 20), at(16, 19), houseSegs), true);
check('the garage-s exposed rear wall is not: one end stands clear',
  G.edgeOnLoop(at(16, 19), at(20, 19), houseSegs), false);
check('nor is its door wall, which touches the house nowhere',
  G.edgeOnLoop(at(20, 46), at(-4, 46), houseSegs), false);

// ── The midpoint clause ──────────────────────────────────────────────────
// An L-shaped house. (10,4) and (4,10) are both CORNERS of it, so both ends
// of the edge between them sit on the boundary -- and the edge itself cuts
// straight across the notch, three feet clear of the building at its middle.
const ELL = P([0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]);
const ellSegs = G.loopSegments(ELL);

check('both ends are on the L', G.edgeOnLoop(at(10, 4), at(10, 4), ellSegs), true);
check('a chord between two corners of an L is NOT on it -- its middle is '
  + 'open air, and a garage wall dropped here leaves the house open',
  G.edgeOnLoop(at(10, 4), at(4, 10), ellSegs), false);
// The control the check above needs: walk the same two corners round the
// INSIDE of the notch and every sample is on the boundary, so the answer
// flips. Without this, "false" could be coming from anything.
check('while the same two corners joined THROUGH the notch corner are on it',
  G.edgeOnLoop(at(10, 4), at(4, 4), ellSegs), true);
// AND ALL THREE SAMPLES HAVE TO LAND, not two of them. This edge starts on a
// corner of the L and ends eight feet inside open air, and its MIDDLE lands
// exactly on the notch corner (4,4) -- so an implementation asking for either
// end plus the middle says yes to a wall that is mostly nowhere. Written
// after a mutation loosening `near(a) && near(b)` to `||` survived every
// other check in this file.
check('an edge with one end in open air is not on the loop, however well '
  + 'its middle lands', G.edgeOnLoop(at(0, 0), at(8, 8), ellSegs), false);

// ── The bulge is followed, not straightened ──────────────────────────────
// One bowed edge. Its two ends are on the loop by construction; the CHORD
// between them bellies 0.25 ft away from the arc at its middle, which is well
// past the tolerance. A points-only version of this test reads the arc as its
// chord and answers true.
const BOWED = [
  { start: at(0, 0), end: at(10, 0), bulge: 0.5 },
  { start: at(10, 0), end: at(10, 10), bulge: 0 },
  { start: at(10, 10), end: at(0, 10), bulge: 0 },
  { start: at(0, 10), end: at(0, 0), bulge: 0 },
];
check('the chord of a bowed edge is not the bowed edge',
  G.edgeOnLoop(at(0, 0), at(10, 0), BOWED), false);
check('but a straight edge of the same loop still reads as on it',
  G.edgeOnLoop(at(10, 0), at(10, 10), BOWED), true);

// ── Tolerance, and what it is for ────────────────────────────────────────
// Corners arrive through a vertex pool and a save/load round trip, so an edge
// that is meant to be on the wall lands a hair off it. The default 0.1 ft is
// the old page's own eps, carried over rather than chosen again.
// THE CLOSING EDGE IS AN EDGE. loopSegments joins the last corner back to the
// first, and a version that stopped at the last pair would leave one whole
// wall of every building unaskable -- here the house's left wall, which is
// the segment between HOUSE's last corner and its first. That mutation
// survived this file until this check was written.
check('an edge on the loop-s closing side is on it',
  G.edgeOnLoop(at(-16, 0), at(-16, 10), houseSegs), true);

check('an edge an inch off the wall is still on it',
  G.edgeOnLoop(at(-4, 20.08), at(16, 20.08), houseSegs), true);
check('an edge a foot off the wall is not',
  G.edgeOnLoop(at(-4, 19), at(16, 19), houseSegs), false);
check('and the tolerance can be tightened by the caller',
  G.edgeOnLoop(at(-4, 20.08), at(16, 20.08), houseSegs, 0.01), false);

// ── Degenerate input answers rather than throwing ────────────────────────
// A body with no loop to compare against is the ordinary case for a DETACHED
// garage, which is asked this question and must be told "no".
check('no segments at all is false, not a throw', G.edgeOnLoop(at(0, 0), at(1, 0), []), false);
check('and neither is a missing list', G.edgeOnLoop(at(0, 0), at(1, 0), null), false);

console.log(`\n${ran - failed}/${ran} checks passed`);
process.exit(failed ? 1 : 0);
