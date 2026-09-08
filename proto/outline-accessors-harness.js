// geometry-2d.js outlineSegment / outlineSegmentCount / lineControlPoint —
// how an outline's points become edges, and where an arc's control point sits.
//
// These three were `this._` methods on MODEL.dc.html, which is the whole
// reason drawOutlines2D could not be called by any other page. The painter had
// moved into render-2d.js; its address had not. They are lifted here verbatim
// so MODEL.html can supply the same env.
//
// THEY ARRIVE WITH CHECKS BECAUSE THEY HAD NONE. Nothing in the repo exercised
// them: they were reached only through the old page's paint loop, where a wrong
// answer shows up as a slightly wrong drawing that nobody is comparing against
// anything. A lift is exactly when that stops being tolerable -- two callers
// now, and a silent divergence between them would be visible only as "the new
// page draws that arc differently", which is the most expensive kind of bug to
// find and the cheapest to prevent here.
//
// THE SEAM WORTH KNOWING: a segment is keyed to its STARTING point. points[i]
// carries the bulge of the edge running from i to i+1. An OPEN outline (the
// attached-garage case) has no closing edge, so it owns one fewer segment than
// it has points. Get that backwards and a closed room loses a wall or an open
// one grows a phantom edge across its mouth -- both of which draw.
//
// Run: node proto/outline-accessors-harness.js          (checks)
//      node proto/outline-accessors-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'geometry-2d.js');

// Shared argument handling -- see proto/harness-args.js for why it is the one
// file here loaded with require() rather than from source text.
const MUTATION_MODE = require('./harness-args.js').mutationMode();

// Load from SOURCE TEXT so a mutant can be applied to it in process. A green
// run proves nothing on its own; the mutation table below is what says these
// checks can fail.
function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window.DraftGeometry2D;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// Comparisons are on strings, because the run loop compares with !== and two
// equal points are two different objects. Rounded to 4dp: these are feet, and
// 1/10000 ft is 1/800 inch -- far below anything the drafter can draw, so a
// difference that survives rounding is a real difference and not float dust.
const r = n => Math.round(n * 1e4) / 1e4;
const sig = p => `${r(p.x)},${r(p.y || 0)},${r(p.z)}`;
const segSig = s => `${sig(s.start)} -> ${sig(s.end)} bulge ${r(s.bulge)}`;

const pt = (x, z, extra = {}) => ({ x, y: 0, z, ...extra });

// A closed square, and the same points as an open run.
const square = { points: [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)] };
const openRun = { points: [pt(0, 0), pt(10, 0), pt(10, 10)], open: true };

// ── How many edges ──
check('a closed outline has one segment per point',
  G => [G.outlineSegmentCount(square), 4]);

// The open case is the attached garage: the last point has no outgoing edge.
// A closing segment here would draw a wall across the garage's mouth.
check('an open outline has one fewer segment than points',
  G => [G.outlineSegmentCount(openRun), 2]);

// `open` is tested against literal true, not truthiness. An outline carrying
// open: 'yes' or open: 1 from some future writer is CLOSED, and that is the
// behaviour being pinned rather than endorsed -- if it should change, this
// check is where the change gets noticed.
check('open is === true, not merely truthy',
  G => [G.outlineSegmentCount({ points: [pt(0, 0), pt(1, 0), pt(2, 0)], open: 1 }), 3]);

// ── Which points an edge runs between ──
check('the first segment runs from point 0 to point 1',
  G => [segSig(G.outlineSegment(square, 0)), '0,0,0 -> 10,0,0 bulge 0']);

// THE WRAP. The last segment of a closed outline returns to point 0. Without
// it a room is drawn as three walls and a gap, which reads as a doorway.
check('the last segment of a closed outline wraps to the start',
  G => [segSig(G.outlineSegment(square, 3)), '0,0,10 -> 0,0,0 bulge 0']);

check('the last segment of an open outline does not wrap',
  G => [segSig(G.outlineSegment(openRun, 1)), '10,0,0 -> 10,0,10 bulge 0']);

// Asking an open outline for the segment it does not have. `points[i+1] || start`
// degenerates to a zero-length self-segment rather than throwing on undefined.
// Nothing calls this today -- segmentCount stops the loop first -- so it is a
// guard, and a guard nothing exercises is a guard nobody knows is there.
check('an open outline asked past its end returns a zero-length segment',
  G => [segSig(G.outlineSegment(openRun, 2)), '10,0,10 -> 10,0,10 bulge 0']);

// ── Whose bulge ──
// The bulge belongs to the edge LEAVING a point, so it is read off `start`.
// Reading it off `end` puts every arc on the wrong edge: the drawing still
// draws, and every curve is one segment out of place.
const bulged = { points: [pt(0, 0, { bulge: 2 }), pt(10, 0), pt(10, 10), pt(0, 10)] };
check('a segment takes its bulge from the point it starts at',
  G => [G.outlineSegment(bulged, 0).bulge, 2]);
check('and the following segment is not given it',
  G => [G.outlineSegment(bulged, 1).bulge, 0]);
check('a point with no bulge yields 0, not undefined',
  G => [G.outlineSegment(square, 0).bulge, 0]);

// ── Where the control point sits ──
// A straight segment's control point is its midpoint. This is the control for
// everything below: without it, every arc assertion could be satisfied by a
// function that ignores bulge entirely and always returns the midpoint.
check('a straight segment controls from its midpoint',
  G => [sig(G.lineControlPoint({ start: pt(0, 0), end: pt(10, 0), bulge: 0 })), '5,0,0']);

// THE LEFT NORMAL. For a segment running +x, left is -z. Flip the sign and
// every arc in the drawing bows the wrong way -- still a smooth curve, still
// the right endpoints, mirrored.
check('bulge offsets along the LEFT normal of the direction of travel',
  G => [sig(G.lineControlPoint({ start: pt(0, 0), end: pt(10, 0), bulge: 3 })), '5,0,3']);

// The same edge walked backwards must bow the other way, or "left" means
// nothing. An offset that ignored direction would satisfy the check above.
check('and the same edge reversed bows the other way',
  G => [sig(G.lineControlPoint({ start: pt(10, 0), end: pt(0, 0), bulge: 3 })), '5,0,-3']);

check('the offset is perpendicular for a segment running the other axis too',
  G => [sig(G.lineControlPoint({ start: pt(0, 0), end: pt(0, 10), bulge: 2 })), '-2,0,5']);

// A degenerate segment divides by its length. `|| 1` keeps that finite; without
// it every coordinate is NaN, and a NaN moveTo silently paints nothing.
check('a zero-length segment does not produce NaN',
  G => [sig(G.lineControlPoint({ start: pt(4, 4), end: pt(4, 4), bulge: 5 })), '4,0,4']);

check('a missing bulge is treated as straight',
  G => [sig(G.lineControlPoint({ start: pt(0, 0), end: pt(8, 0) })), '4,0,0']);

// y is averaged and defaulted, because a plan projection drops it but a
// section does not, and undefined would poison the average.
check('y is averaged across the segment',
  G => [sig(G.lineControlPoint({ start: { x: 0, y: 2, z: 0 }, end: { x: 10, y: 8, z: 0 }, bulge: 0 })), '5,5,0']);
check('a point with no y contributes 0 rather than NaN',
  G => [sig(G.lineControlPoint({ start: { x: 0, z: 0 }, end: { x: 10, y: 6, z: 0 }, bulge: 0 })), '5,3,0']);

// ── pointOnLineSeg AND pointToSegment ────────────────────────────────────
//
// Added when MODEL.dc.html's _pointOnLineSeg and _distToLineSeg were collapsed
// onto these. They arrive with checks for the same reason the three above did:
// they had none. pointToSegment is reached by TWENTY call sites on the old page
// -- every click-to-select, every snap, every beam-to-edge distance -- and the
// only thing standing behind it was that the drawing looked right.
//
// THE DEGENERATE RULE IS THE LOAD-BEARING ONE. A segment shorter than 0.01ft
// answers Infinity, NOT zero. Its own comment says why: a zero would make
// every click "hit" a collapsed wall, so a stray zero-length segment would
// silently swallow every selection on the drawing. Nothing pinned that until
// now, which means the comment was the only thing holding it.
//
// THREE OTHER DISTANCE FUNCTIONS IN THIS REPO DISAGREE WITH THIS ONE, and
// they disagree exactly where nothing looks. On a zero-length segment:
//
//   pointToSegment / _distToLineSeg    Infinity      (len2 < 0.0001 guard)
//   distToSegment   MODEL.dc.html      distance to a (len2 = ... || 1)
//   distPtSeg       auto-stair.js      distance to a (len2 > 0 ? ... : 0)
//   distToSeg       proto/elevation-harness.js  same shape
//
// So a degenerate segment reads as "right here" to three of them and
// "infinitely far" to this one. Anyone collapsing the other three onto this
// export must write the failing test FIRST, because the flip is silent:
// distToSegment's callers are proximity tests at <= 0.6 and <= 0.8, and
// elevation-harness uses its variant as an on-boundary <= eps. A degenerate
// edge currently lands INSIDE those thresholds and would land outside, so
// the tag simply stops being assigned and on-boundary becomes permanently
// false. No error is raised, and no existing fixture would catch it, because
// a zero-length edge is not something anyone draws on purpose -- it arrives
// from an import or a collapsed corner.
//
// (Found by Skipper, 8 Sep, while reading ahead of the collapse rather than
// after it. Verified against all four sources before being written down.)
//
// NOTE THE DELIBERATE ASYMMETRY WITH lineControlPoint, which is the one input
// where these two genuinely disagree: on a zero-length segment lineControlPoint
// answers the midpoint (via `|| 1`) and pointToSegment answers Infinity. Both
// are right, because they are answering different questions -- "where is this
// arc's control point" always has an answer, "how close did the drafter click"
// does not. Anyone collapsing these further needs to keep that difference.
check('the perpendicular foot inside the segment gives distance and t',
  G => [JSON.stringify(G.pointToSegment(pt(5, 3), { start: pt(0, 0), end: pt(10, 0) })), '{"d":3,"t":0.5}']);

check('a point past the end clamps to t=1 and measures from the endpoint',
  G => [JSON.stringify(G.pointToSegment(pt(20, 0), { start: pt(0, 0), end: pt(10, 0) })), '{"d":10,"t":1}']);

check('a point before the start clamps to t=0',
  G => [JSON.stringify(G.pointToSegment(pt(-5, 0), { start: pt(0, 0), end: pt(10, 0) })), '{"d":5,"t":0}']);

// THE ONE THAT MATTERS. Not "does not throw" -- the specific answer Infinity,
// because 0 is what a naive projection returns and 0 is what breaks clicking.
check('a zero-length segment is INFINITELY far, not zero away',
  G => [G.pointToSegment(pt(4, 4), { start: pt(4, 4), end: pt(4, 4) }).d, Infinity]);

check('and a segment under the 0.01ft floor is too',
  G => [G.pointToSegment(pt(0, 1), { start: pt(0, 0), end: pt(0.005, 0) }).d, Infinity]);

// The companion. Without it the two checks above pass on a pointToSegment that
// answers Infinity for EVERY segment, which is the emptiness trap: a rule that
// rejects everything looks exactly like a rule that rejects the right things.
check('a segment just over the floor is measured normally',
  G => [JSON.stringify(G.pointToSegment(pt(0, 1), { start: pt(0, 0), end: pt(0.02, 0) })), '{"d":1,"t":0}']);

// The arc branch, paired against the same segment without bulge. Unpaired, a
// distance of 9 proves nothing -- it is only evidence that the bulge branch ran
// because the straight answer to the identical question is 10.
check('a bulged segment is measured to the ARC, not the chord',
  G => [G.pointToSegment(pt(5, 10), { start: pt(0, 0), end: pt(10, 0), bulge: 2 }).d, 9]);
check('and the same segment without bulge answers the chord distance',
  G => [G.pointToSegment(pt(5, 10), { start: pt(0, 0), end: pt(10, 0) }).d, 10]);

// The arc branch samples rather than solving, so its t is always on the 24-step
// grid. Pinned because "it got close enough" would survive the sampling being
// replaced by something with different endpoints or a different step count.
check('the arc branch returns a t on the 24-step sampling grid',
  G => [Number.isInteger(G.pointToSegment(pt(1, 5), { start: pt(0, 0), end: pt(10, 0), bulge: 2 }).t * 24), true]);

// THE SAMPLER MUST INCLUDE BOTH ENDS. A loop starting at i=1 still answers
// sensibly everywhere except right at the segment's start, where it snaps 1/24
// along instead of to the point itself -- which is a click landing on the wrong
// end of an arc and nothing else in this file could see it.
check('a point exactly on the arc start is zero away at t=0',
  G => [JSON.stringify(G.pointToSegment(pt(0, 0), { start: pt(0, 0), end: pt(10, 0), bulge: 2 })), '{"d":0,"t":0}']);
check('and a point exactly on the arc end is zero away at t=1',
  G => [JSON.stringify(G.pointToSegment(pt(10, 0), { start: pt(0, 0), end: pt(10, 0), bulge: 2 })), '{"d":0,"t":1}']);

check('a straight segment interpolates x and z at t',
  G => [sig(G.pointOnLineSeg({ start: pt(0, 0), end: pt(10, 4) }, 0.25)), '2.5,0,1']);
check('t=0 is the start and t=1 is the end',
  G => [`${sig(G.pointOnLineSeg({ start: pt(0, 0), end: pt(10, 4) }, 0))}|${sig(G.pointOnLineSeg({ start: pt(0, 0), end: pt(10, 4) }, 1))}`,
    '0,0,0|10,0,4']);

// The arc apex, computed from the quadratic rather than read off the function:
// at t=0.5 a quadratic Bezier sits at (start + 2c + end)/4, and c is 2ft off the
// chord midpoint, so the apex is 1ft off it -- half the bulge, not the bulge.
check('the arc at t=0.5 sits at half the bulge, not the whole of it',
  G => [sig(G.pointOnLineSeg({ start: pt(0, 0), end: pt(10, 0), bulge: 2 }, 0.5)), '5,0,1']);

// AND ONE OFF-CENTRE, which the t=0.5 check above cannot replace. At the
// midpoint of a symmetric segment the curve's x is EQUAL to the control point's
// x, so an implementation that just returned the control point passes that
// check on x. At t=0.25 they differ (2.5 against 5) and the difference is
// visible. Found by a mutation surviving, not by reading.
check('an off-centre sample is on the quadratic, not at the control point',
  G => [sig(G.pointOnLineSeg({ start: pt(0, 0), end: pt(10, 0), bulge: 2 }, 0.25)), '2.5,0,0.75']);

// SURPRISING BUT REAL, and pinned as-is rather than fixed: y does NOT
// interpolate. Both branches average the two endpoint ys and hand back the same
// y at every t. Harmless in plan, where y is dropped -- but anyone reaching for
// this in a section will get a flat answer, and should find out here.
check('y is averaged at every t rather than interpolated',
  G => [`${sig(G.pointOnLineSeg({ start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 10, z: 0 } }, 0)).split(',')[1]}`, '5']);

// ── THE TWO COPIES MUST NOT DRIFT ──
//
// The originals are still on MODEL.dc.html and the old page still calls its
// own -- that is the house convention, set by the mergeVertex lift, which is
// also still duplicated. It is a reasonable convention: the old page is 1.1 MB
// of working software and rewiring it is a separate risk from sharing a
// function.
//
// But it leaves an asymmetry this file would otherwise hide. Every check above
// tests the geometry-2d.js copy. Nothing tests MODEL.dc.html's, so an edit
// there -- a fix, a tweak, a refactor by someone who has never read this file
// -- passes everything and silently makes the two pages draw the same outline
// differently. That is the exact failure the lift was supposed to end.
//
// So the last check is not about outlines at all: it is that the two bodies
// are still the same text. It fails on ANY divergence, including one that is
// an improvement -- and that is the intent. The right response to it going red
// is to port the change and delete one copy, not to update this string.
const DC = path.join(__dirname, '..', 'MODEL.dc.html');
const norm = t => t.replace(/\s+/g, ' ').trim();
const bodyIn = (src, name) => {
  const i = src.search(new RegExp(`\\n  (?:function )?${name}\\(`));
  if (i < 0) return null;
  const j = src.indexOf('\n  }\n', i);
  return j < 0 ? null : norm(src.slice(src.indexOf('{', i), j));
};

const dcSrc = fs.readFileSync(DC, 'utf8');
const g2Src = fs.readFileSync(SRC, 'utf8');
[['_outlineSegment', 'outlineSegment'],
  ['_outlineSegmentCount', 'outlineSegmentCount']].forEach(([dcName, gName]) => {
  const a = bodyIn(dcSrc, dcName), b = bodyIn(g2Src, gName);
  check(`${gName} is still byte-identical to MODEL.dc.html's ${dcName}`,
    () => [a !== null && a === b, true]);
});

// _lineControlPoint IS NO LONGER ON THAT LIST, and its check was deleted rather
// than relaxed. This file used to say the right response to a byte-identity
// failure is "port the change and delete one copy, not update this string" --
// so when the copy went, the string went with it. Relaxing it to a subset
// comparison, or leaving it asserting over a one-line forwarder, would have
// left a check whose passing state and broken state look the same.
//
// What replaces it guards the opposite direction: that nobody re-inlines the
// arithmetic. A forwarder is a few characters; the moment one of these grows a
// Math.hypot again there are two copies and the drift is back.
[['_lineControlPoint', 'lineControlPoint'],
  ['_pointOnLineSeg', 'pointOnLineSeg'],
  ['_distToLineSeg', 'pointToSegment']].forEach(([dcName, gName]) => {
  const body = bodyIn(dcSrc, dcName);
  check(`MODEL.dc.html's ${dcName} forwards to ${gName} instead of duplicating it`,
    () => [body !== null && body.includes(`window.DraftGeometry2D.${gName}(`) && !/Math\.hypot|bestD/.test(body), true]);
});

// ── Run ──
function run(G) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// ── Mutations ──
// Each entry breaks one decision. Every one of them still DRAWS -- that is why
// they are worth listing: none of these produces an exception or a blank page,
// only a drawing that is quietly wrong.
const MUTATIONS = [
  // ── pointToSegment / pointOnLineSeg ──
  // The degenerate rule first, because it is the one with a comment claiming it
  // matters and no check behind it until now.
  ['a zero-length segment answers 0 away instead of Infinity',
    s => s.replace('return { d: Infinity, t: 0 };', 'return { d: 0, t: 0 };')],
  ['the 0.01ft floor is removed entirely',
    s => s.replace('if (len2 < 0.0001) return { d: Infinity, t: 0 };', '')],
  ['the floor is applied to real segments too',
    s => s.replace('if (len2 < 0.0001)', 'if (len2 < 10000)')],
  ['t is no longer clamped to the segment',
    s => s.replace('const t = Math.max(0, Math.min(1, ((worldPt.x - ax) * dx + (worldPt.z - az) * dz) / len2));',
      'const t = ((worldPt.x - ax) * dx + (worldPt.z - az) * dz) / len2;')],
  ['the arc branch is never taken, so arcs measure as chords',
    s => s.replace('  function pointToSegment(worldPt, seg) {\n    if (!seg.bulge) {',
      '  function pointToSegment(worldPt, seg) {\n    if (true) {')],
  ['the arc is sampled at a different resolution',
    s => s.replace('const STEPS = 24;', 'const STEPS = 25;')],
  ['the arc sampler starts past the beginning of the segment',
    s => s.replace('for (let i = 0; i <= STEPS; i++) {', 'for (let i = 1; i <= STEPS; i++) {')],
  ['pointOnLineSeg interpolates y instead of averaging it',
    s => s.replace('        y: ((seg.start.y || 0) + (seg.end.y || 0)) / 2,\n        z: seg.start.z + (seg.end.z - seg.start.z) * t,',
      '        y: (seg.start.y || 0) + ((seg.end.y || 0) - (seg.start.y || 0)) * t,\n        z: seg.start.z + (seg.end.z - seg.start.z) * t,')],
  ['the quadratic uses the control point as the apex rather than a control',
    s => s.replace('x: it * it * seg.start.x + 2 * it * t * c.x + t * t * seg.end.x,', 'x: c.x,')],
  ['open outlines are counted as closed',
    s => s.replace('return outline.open === true ? outline.points.length - 1 : outline.points.length;',
      'return outline.points.length;')],
  ['closed outlines are counted as open',
    s => s.replace('return outline.open === true ? outline.points.length - 1 : outline.points.length;',
      'return outline.points.length - 1;')],
  ['open is tested for truthiness rather than === true',
    s => s.replace('return outline.open === true ? outline.points.length - 1', 'return outline.open ? outline.points.length - 1')],
  ['the closing segment no longer wraps to point 0',
    s => s.replace('points[(index + 1) % points.length]', 'points[index + 1]')],
  ['open outlines wrap like closed ones',
    s => s.replace('const end = outline.open === true ? (points[index + 1] || start) : points[(index + 1) % points.length];',
      'const end = points[(index + 1) % points.length];')],
  ['a segment takes its bulge from the point it ends at',
    s => s.replace('return { start, end, bulge: start.bulge || 0 };', 'return { start, end, bulge: end.bulge || 0 };')],
  ['an absent bulge is passed through as undefined',
    s => s.replace('bulge: start.bulge || 0 };', 'bulge: start.bulge };')],
  ['arcs bow along the RIGHT normal',
    s => s.replace('x: (seg.start.x + seg.end.x) / 2 + (-dz / len) * bulge,\n      y: ((seg.start.y || 0) + (seg.end.y || 0)) / 2,\n      z: (seg.start.z + seg.end.z) / 2 + (dx / len) * bulge,',
      'x: (seg.start.x + seg.end.x) / 2 + (dz / len) * bulge,\n      y: ((seg.start.y || 0) + (seg.end.y || 0)) / 2,\n      z: (seg.start.z + seg.end.z) / 2 + (-dx / len) * bulge,')],
  // BOTH OF THESE ARE ANCHORED ON THE seg. LINE ABOVE THEM, and that is not
  // decoration. `const len = Math.hypot(dx, dz) || 1;` appears FOUR times in
  // geometry-2d.js, and String.replace takes the first -- so the unanchored
  // version mutated a different function and survived, and I read that as a
  // coverage gap until I counted the occurrences. load() throws when a
  // mutation matches NOTHING; nothing throws when it matches the WRONG thing,
  // which reports a gap that is not there and hides one that is.
  ['the offset is not normalised by segment length',
    s => s.replace('dz = seg.end.z - seg.start.z;\n    const len = Math.hypot(dx, dz) || 1;',
      'dz = seg.end.z - seg.start.z;\n    const len = 1;')],
  ['a zero-length segment divides by zero',
    s => s.replace('dz = seg.end.z - seg.start.z;\n    const len = Math.hypot(dx, dz) || 1;',
      'dz = seg.end.z - seg.start.z;\n    const len = Math.hypot(dx, dz);')],
  ['a missing y poisons the average instead of defaulting to 0',
    s => s.replace('y: ((seg.start.y || 0) + (seg.end.y || 0)) / 2,', 'y: (seg.start.y + seg.end.y) / 2,')],
];

if (MUTATION_MODE) {
  // TWO THINGS THIS LOOP REFUSES TO CALL A PASS, both found by making it come
  // out wrong on purpose while writing this file.
  //
  // A MUTATION THAT WILL NOT APPLY IS NOT A CAUGHT MUTATION. `const len =
  // Math.hypot(dx, dz) || 1;` occurs four times in geometry-2d.js, so an
  // unanchored replace hit the wrong function; anchoring it then over-corrected
  // and matched nothing at all. Both errors printed a full green table. The
  // older shape of this loop turned the load() throw into a `missed` entry,
  // which is the counter for "a check noticed" -- so the guard against a
  // meaningless mutation was itself reported as a successful one. Broken
  // mutations are counted separately and are fatal.
  //
  // AN EMPTY LIST IS NOT A CLEAN SWEEP. With no mutations the loop prints
  // "0/0 mutations caught" and exits 0, which is the same absence-that-reads-
  // as-a-pass this harness exists to prevent, one layer in. (Skipper's find,
  // on the older engines.)
  console.log('\n' + 'mutation'.padEnd(56) + 'caught by');
  let survivors = 0;
  let broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(56)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(56)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
