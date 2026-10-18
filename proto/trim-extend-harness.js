#!/usr/bin/env node
// trim-extend-harness.js — WHERE THE CUTTING EDGES CROSS, WHAT A PRESS TAKES
//
// Movie, 17 Oct: "select both items and them select the TRIM ... then select
// the part i want to cut ... the part i select gets the cut ... is gone" --
// "cuts on either side if there is another selected line crossing over" --
// and EXTEND: "if the int wall is 2 ft from the ext wall i select both ... and
// then click the int wall at the end closest to the ext wall and it will
// extend to attach to the wall".
//
// trim-extend.js is pure: segments in, parameters along the pressed one out.
// The fixtures are a 2x6 exterior wall whose stored line is its OUTSIDE face
// (refLine 'left', the body to +normal) and partitions that cross it, run
// short of it, or cross a second wall.
//
// Run: node proto/trim-extend-harness.js            (checks)
//      node proto/trim-extend-harness.js --mutate   (checks + mutation table)
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['a wall cutter cuts at its stored line, not its faces', 'trim-extend.js',
    c => c.replace('      const a = at(o1).t, b = at(o2).t;', '      const a = at(0).t, b = at(0).t;')],
  ['a cutter counts however far past its ends the line meets it', 'trim-extend.js',
    c => c.replace('      if (mid.s < -tol - EPS || mid.s > 1 + tol + EPS) return;', '')],
  ['a tee the segment ends in cuts it as if it crossed', 'trim-extend.js',
    c => c.replace('    const inside = (allSpans || []).filter(sp => sp.lo > EPS && sp.hi < 1 - EPS);',
      '    const inside = (allSpans || []).filter(sp => sp.hi > EPS && sp.lo < 1 - EPS);')],
  ['the piece always runs to the segment\'s end ahead', 'trim-extend.js',
    c => c.replace('    const from = behind ? behind.lo : 0, to = ahead ? ahead.hi : 1;',
      '    const from = behind ? behind.lo : 0, to = 1;')],
  ['the cut stops at the face on the side taken away, leaving wall inside the cutter', 'trim-extend.js',
    c => c.replace('    const from = behind ? behind.lo : 0, to = ahead ? ahead.hi : 1;',
      '    const from = behind ? behind.hi : 0, to = ahead ? ahead.lo : 1;')],
  ['a press with nothing either side cuts the whole segment', 'trim-extend.js',
    c => c.replace('    if (!behind && !ahead) return null;\n', '')],
  ['an end runs to the far face, not the near', 'trim-extend.js',
    c => c.replace("      if (end === 'end' && sp.lo > 1 + EPS && (!best || sp.lo < best.t)) best = { t: sp.lo, cutter: sp.cutter };",
      "      if (end === 'end' && sp.lo > 1 + EPS && (!best || sp.hi < best.t)) best = { t: sp.hi, cutter: sp.cutter };")],
  ['an end runs to the farthest cutter, not the nearest', 'trim-extend.js',
    c => c.replace("      if (end === 'start' && sp.hi < -EPS && (!best || sp.hi > best.t)) best = { t: sp.hi, cutter: sp.cutter };",
      "      if (end === 'start' && sp.hi < -EPS && (!best || sp.hi < best.t)) best = { t: sp.hi, cutter: sp.cutter };")],
  ['a left-face wall\'s body is taken on the wrong side of its line', 'trim-extend.js',
    c => c.replace("    const lo = ref === 'left' ? 0 : ref === 'right' ? -t : -t / 2;",
      "    const lo = ref === 'left' ? -t : ref === 'right' ? 0 : -t / 2;")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('trim-extend',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = require('./harness-env.js').loadDraftModules();
const TE = win.DraftTrimExtend;
const WT = win.DraftWallTypes.WALL_TYPES;
const thicknessFt = s => (s.isLine ? 0 : (WT.find(t => t.id === (s.wallType || 'stud_2x6')) || WT[1]).totalIn / 12);
const P = (x, z) => ({ x, y: 0, z });
const W = (a, b, wallType = 'stud_2x6', refLine = 'center') => ({ start: P(...a), end: P(...b), wallType, refLine });
const L = (a, b) => ({ start: P(...a), end: P(...b), isLine: true });

let failed = 0, ran = 0;
const check = (label, cond, detail) => {
  ran += 1;
  if (cond) return;
  failed += 1;
  console.log(`  FAIL ${label}${detail !== undefined ? `\n       ${detail}` : ''}`);
};
const near = (a, b, eps = 1e-6) => Number.isFinite(a) && Math.abs(a - b) < eps;
const T6 = 5.5 / 12, T4 = 3.5 / 12;
const opts = { thicknessFt, reachFt: T4 / 2 + 1e-3 };

// THE EXTERIOR WALL: stored line on x = 0, its OUTSIDE face, run z 20 -> 0
// with refLine 'left'. Its normal (-dz, dx)/len is (+1, 0), and 'left' fills
// the body from the line toward +normal: x 0 .. 5.5", inside the house.
const EXT = W([0, 20], [0, 0], 'stud_2x6', 'left');

// A PARTITION RUNNING THROUGH IT, Movie's case: x -4 -> 12 along z = 10.
const RUN = W([-4, 10], [12, 10], 'stud_2x4');
const runSpans = TE.spans(RUN, [EXT], opts);
check('the exterior wall crosses the partition as one span', runSpans.length === 1, runSpans.length);
check('from its outside face at x = 0', near(runSpans[0]?.lo * 16 - 4, 0), runSpans[0]?.lo * 16 - 4);
check('to its inside face at x = 5.5"', near(runSpans[0]?.hi * 16 - 4, T6), runSpans[0]?.hi * 16 - 4);
// HIS CASE: the press on the piece outside the house takes it away AND the
// run through the wall, so what is kept stops at the INSIDE face -- the face
// on the kept side. Nothing is left standing inside the exterior wall.
const outside = TE.trimPiece(runSpans, 0.1);
check('a press on the piece past the wall takes the start piece', outside?.kind === 'start', outside?.kind);
check('and the run through the wall: the kept partition stops at the inside face',
  near(outside?.to * 16 - 4, T6), outside?.to * 16 - 4);
// The press on the room side keeps the stub outside, stopped at the OUTSIDE face.
const inside = TE.trimPiece(runSpans, 0.8);
check('a press on the room side takes the end piece', inside?.kind === 'end', inside?.kind);
check('and the kept stub stops at the outside face', near(inside?.from * 16 - 4, 0), inside?.from * 16 - 4);
check('a press on the wall\'s own body takes nothing', TE.trimPiece(runSpans, (runSpans[0].lo + runSpans[0].hi) / 2) === null);

// TWO CUTTERS, "cuts on either side": a second, centred 2x4 at x = 8.
const MID = W([8, 4], [8, 16], 'stud_2x4', 'center');
const two = TE.spans(RUN, [EXT, MID], opts);
check('two cutters cross it as two spans, in order', two.length === 2 && two[0].lo < two[1].lo, two.length);
const between = TE.trimPiece(two, (4 + 4) / 16);
check('a press between them takes the middle piece', between?.kind === 'middle', between?.kind);
check('from the first wall\'s face on the kept side', near(between?.from * 16 - 4, 0), between?.from * 16 - 4);
check('to the second wall\'s face on the kept side', near(between?.to * 16 - 4, 8 + T4 / 2), between?.to * 16 - 4);
const beyond = TE.trimPiece(two, 14 / 16);
check('a press past the second takes only the piece past it, and the run through it',
  beyond?.kind === 'end' && near(beyond.from * 16 - 4, 8 - T4 / 2), beyond && beyond.from * 16 - 4);

// NO CROSSING, NOTHING TO CUT.
check('a segment nothing crosses has nothing to trim',
  TE.trimPiece(TE.spans(W([2, 2], [6, 2], 'stud_2x4'), [MID], opts), 0.5) === null);
// A cutter the line meets only past its far end does not count.
check('a cutter met only well past its own end is left out',
  TE.spans(W([-4, 30], [12, 30], 'stud_2x4'), [EXT], opts).length === 0);
// A tee it already ends in is not a crossing of it.
const TEE = W([12, 10], [T6, 10], 'stud_2x4');
const teeSpans = TE.spans(TEE, [EXT, MID], opts);
const teePiece = TE.trimPiece(teeSpans, 0.2);
check('a partition ending on the wall is cut at the OTHER crossing only',
  teePiece?.kind === 'start' && near(12 - teePiece.to * (12 - T6), 8 - T4 / 2), teePiece && 12 - teePiece.to * (12 - T6));
const teeEnd = TE.trimPiece(teeSpans, 0.9);
check('and the piece up to the tee goes to its end', teeEnd?.kind === 'end' && near(teeEnd.to, 1), teeEnd && teeEnd.to);
// THE MELDED TEE, today's convention: the partition ends INSIDE the wall's
// body, on its centre. Still not a crossing of it -- the piece up to it goes
// to the partition's end, not to the wall's face with a stub left inside.
const MELD = W([12, 10], [T6 / 2, 10], 'stud_2x4');
const meldEnd = TE.trimPiece(TE.spans(MELD, [EXT, MID], opts), 0.9);
check('a tee ended inside the wall body is not cut at that wall',
  meldEnd?.kind === 'end' && near(meldEnd.to, 1), meldEnd && `${meldEnd.kind} ${meldEnd.to}`);

// EXTEND: "the int wall is 2 ft from the ext wall".
const SHORT = W([12, 10], [T6 + 2, 10], 'stud_2x4');
const shortSpans = TE.spans(SHORT, [EXT], opts);
const run = TE.extendTo(shortSpans, 'end');
check('the end two feet short runs on to the wall', !!run && run.cutter === EXT);
check('and stops at its inside face', near(12 + run.t * (T6 + 2 - 12), T6), run && 12 + run.t * (T6 + 2 - 12));
check('the start end, with nothing behind it, does not move', TE.extendTo(shortSpans, 'start') === null);
// The nearest of two, at the start end this time.
const BACK = W([T6 + 2, 10], [7, 10], 'stud_2x4');
const backRun = TE.extendTo(TE.spans(BACK, [EXT, W([-6, 0], [-6, 20], 'stud_2x6', 'center')], opts), 'start');
check('a start end runs to the NEAREST cutter behind it', !!backRun && backRun.cutter === EXT, backRun && backRun.cutter);
check('to that cutter\'s near face',
  near(T6 + 2 + backRun.t * (7 - T6 - 2), T6), backRun && T6 + 2 + backRun.t * (7 - T6 - 2));
check('an end already reaching into a wall is not extended through it',
  TE.extendTo(TE.spans(W([12, 10], [T6 / 2, 10], 'stud_2x4'), [EXT], opts), 'end') === null);

// LINES CUT AND ARE CUT, with no thickness.
const lineSpans = TE.spans(L([0, 5], [10, 5]), [L([4, 0], [4, 10])], opts);
check('a line cutter is a point, not a span',
  lineSpans.length === 1 && near(lineSpans[0].lo, lineSpans[0].hi) && near(lineSpans[0].lo, 0.4), JSON.stringify(lineSpans));
// Parallel never crosses.
check('a parallel cutter never crosses', TE.spans(RUN, [W([0, 12], [10, 12])], opts).length === 0);
// RIGHT-face and CENTRE walls put their bodies where render-2d draws them.
check('a right-face wall fills to -normal', JSON.stringify(TE.faceOffsets({ refLine: 'right' }, 1)) === '[-1,0]');
check('a left-face wall fills to +normal', JSON.stringify(TE.faceOffsets({ refLine: 'left' }, 1)) === '[0,1]');
check('a centred wall straddles its line', JSON.stringify(TE.faceOffsets({ refLine: 'center' }, 1)) === '[-0.5,0.5]');

console.log(`\ntrim / extend: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
