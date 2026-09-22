#!/usr/bin/env node
// NO TWO PIECES OF CONCRETE ARE VISIBLE AT THE SAME PLACE.
//
// Movie, 22 Sep 2026, on E4 of a 2 STOREY + GARAGE + ROOM OVER he had just
// built:
//
//   "the 2nd floor is lined up but foundation off kilter still"
//
// THE WALLS WERE ALREADY RIGHT, which is why this is an ink harness and not a
// geometry one. Measured on that build, the garage tie is the same on every
// level, which is exactly what he asked for on 21 Sep and got:
//
//     FOUNDATION  (16,19) -> (20,19)   body=garage
//     MAIN FL     (16,19) -> (20,19)   body=garage
//     2ND FL      (16,19) -> (20,19)
//
// WHAT WAS OFF WAS THE ELEVATION. Two exposed foundation tops overlapped for
// exactly one foot -- the tie's foot:
//
//     e -1.048   u -46.00..-19.00    the GARAGE's concrete, z 19..46
//     e -1.173   u -20.00.. 20.00    the HOUSE's concrete,  z -20..20
//
// 1.5" apart in height and stepping a foot apart in plan, so the drawing put
// the step a foot from where the concrete actually steps. cut-view.js's
// `fdnHidden` demanded TOTAL cover -- `o.lo <= g.lo && o.hi >= g.hi` -- and
// the garage's face covers one foot of the house's twenty-eight, so it hid
// none of it and the house's line ran on underneath.
//
// AND "NO TWO TOPS MAY OVERLAP" IS NOT THE RULE, which this harness asserted
// first and four elevations across two fixtures refused. A face standing
// BEHIND a shorter one shows its top over the top of the one in front -- that
// is a taller building seen past a lower one, and both lines belong on the
// drawing. Ink alone cannot tell that from the defect: in both cases two tops
// at different heights cover the same stretch, and what separates them is
// which is nearer, which the strokes do not carry.
//
// SO THE SWEEP ASSERTS THE PART THAT IS INVARIANT: two faces at the SAME
// height covering the same stretch. Same top, same base, one behind the other
// -- the far one is hidden entirely, with nothing of it to see past. That is
// the case the old all-or-nothing test did handle, and it stays true whatever
// the buildings are.
//
// The defect Movie reported is then pinned exactly, on his own drawing, by
// the block at the foot of this file: the two tops must MEET, and meet on the
// tie. A rule too weak to catch the bug plus a measurement that does beats
// one rule that is wrong.
//
//   node proto/foundation-face-harness.js [file.draft ...]
const fs = require('fs');
const path = require('path');
const H = require('./elevation-harness.js');

const ROOT = path.join(__dirname, '..');
const FACE_W = 1;        // cut-view.js strokes an exposed foundation face at this
const GRADE_W = 2;       // ...and the grade line, which bounds the band below

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// Every level run in a painted view, with its width and WHICH STROKE it came
// from, in model feet.
//
// THE STROKE IS THE FACE, and carrying it is what makes this measurable. One
// exposed face paints its top line AND its bottom line in a single
// beginPath/stroke pair, so those two runs sit at different heights over the
// same stretch -- legitimately, they are the top and bottom of one piece of
// concrete. Without the stroke index the first draft of this harness read
// every face as clashing with itself, on four fixtures.
//
// The alternative was a height threshold to tell tops from bottoms, which
// would have been a guess about how far above grade a face's base can sit and
// would have quietly stopped working the first time a grade beam hung.
const levelRuns = view => {
  const out = [];
  view.strokes.forEach((s, stroke) => {
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i];
      if (b.move) continue;
      if (Math.abs(a.e - b.e) > 0.005) continue;
      if (Math.abs(a.u - b.u) < 0.3) continue;
      out.push({ e: a.e, u0: Math.min(a.u, b.u), u1: Math.max(a.u, b.u), w: s.w, stroke });
    }
  });
  return out;
};

const win = H.loadDraftModules();

// ── THE STEP LANDS ON THE TIE, on Movie's own drawing ────────────────────
//
// Meeting is not enough on its own: a painter that hid the GARAGE's foot
// instead of the house's would leave the two tops meeting perfectly and put
// the step at z = 20, which is the same defect wearing the other shoe. So
// both are asked -- that they meet, and where.
//
// THE TIE IS ASKED OF THE DRAWING, not typed here: it is where the garage's
// own foundation wall turns, which is the wall that runs in x with the
// smallest z among the garage's foundation walls.
const MOVIE = path.join(ROOT, 'proto', 'repro-movie-garage-2storey.draft');
if (!fs.existsSync(MOVIE)) {
  failures.push('proto/repro-movie-garage-2storey.draft is missing');
} else {
  const saved = JSON.parse(fs.readFileSync(MOVIE, 'utf8'));
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E4');
  const view = H.paintElevation(win, env, cut, { pxPerFt: 40 });
  const runs = levelRuns(view);
  const grade = runs.filter(r => Math.abs(r.w - GRADE_W) < 1e-9)
    .map(r => r.e).sort((a, b) => a - b)[0];
  // The two TOPS: the highest distinct elevation band of exposed face ink.
  const tops = runs.filter(r => Math.abs(r.w - FACE_W) < 1e-9
    && r.e > grade + 0.5 && r.e < 0.5)
    .sort((a, b) => a.u0 - b.u0);
  check('Movie’s drawing paints two exposed foundation tops on E4',
    tops.length === 2, `${tops.length} found`);
  if (tops.length === 2) {
    // E4 looks along +x, so u = -z: the tie at z = 19 reads u = -19.
    const tieWalls = (saved.walls || []).filter(w => (w.view || 'plan') === 'foundation'
      && Math.abs(w.start.z - w.end.z) < 0.01 && Math.abs(w.start.x - w.end.x) > 0.5);
    const tieZ = tieWalls.length
      ? Math.min(...tieWalls.map(w => w.start.z).filter(z => z > 0)) : null;
    check('and they meet each other exactly, with no gap and no overlap',
      Math.abs(tops[0].u1 - tops[1].u0) < 0.05,
      `${tops[0].u1.toFixed(3)} against ${tops[1].u0.toFixed(3)}`);
    check('and they meet ON THE TIE, where the concrete actually steps',
      tieZ !== null && Math.abs(tops[0].u1 + tieZ) < 0.05,
      `they meet at u ${tops[0].u1.toFixed(2)}; the tie is z ${tieZ} (u ${(-tieZ).toFixed(2)})`);
  }
}

// ── MEASURED AND NOT FIXED, said here so the green above is not read as more
// than it is ─────────────────────────────────────────────────────────────
//
// A far face that is TALLER than a nearer one still paints its BOTTOM line
// over the stretch the nearer one covers. Measured on
// repro-bungalow-garage-roofs E3: `e -2.196 u -16.00..4.00` and
// `e -2.196 u -16.00..16.00`, twenty feet shared.
//
// It is the same partial-occlusion question one axis over, and the fix above
// does not reach it: `behindFdn` asks `o.topE >= g.topE`, so a nearer face
// that is SHORTER hides nothing at all -- when what it should hide is
// everything below its own top. Answering that properly makes a face's
// visible region a POLYGON rather than a set of u-runs, which is a real
// change to that painter and not what Movie reported.
//
// AND IT SHOWS AS NOTHING TODAY. Both bottoms sit on the grade line, which is
// already stroked the full width of the drawing at w2 -- so the spare ink
// lands exactly on top of ink that is meant to be there. That is why it has
// never been reported, and it is also why it is written down rather than
// silently left: the day a face's base rises off grade, it will be visible.
//
// THE SWEEP THAT USED TO BE HERE WAS DELETED RATHER THAN WEAKENED. It asserted
// "no two tops overlap" across four fixtures, and four elevations refused it
// correctly: a building standing behind a lower one shows its top over the
// top of the one in front, and ink alone cannot tell that from the defect --
// what separates them is which is nearer, which the strokes do not carry.
// Narrowed to same-height pairs it caught only the grade bottoms above, which
// is the limit this note records. A sweep that is either wrong or vacuous is
// worth less than the measurement below.

console.log(`foundation face harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
