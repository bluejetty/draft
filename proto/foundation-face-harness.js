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
// SO THERE IS NO CROSS-FIXTURE SWEEP IN THIS FILE, and the note at its foot
// records what was tried and why it went. Narrowing the rule to same-height
// pairs left it catching only the grade bottoms, which is the limitation that
// note names -- so what is left is a MEASUREMENT of the defect Movie
// reported, on his own drawing: the two tops must MEET, and meet on the tie.
//
// A measurement that catches the bug beats a rule that is either wrong or
// vacuous, and saying so here keeps this header honest about how few checks
// the file actually carries.
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
// ── A BUCK'S SILL IS NOT A TOP OF CONCRETE ───────────────────────────────
//
// A door buck is a notch cut out of the top of the beam, so the face's stroke
// now carries its sill as another level run at face weight, inside the band
// this file reads tops from -- and on repro-movie-garage-2storey E3 that made
// "two exposed foundation tops" read three: -1.1729, -1.2979 and -1.5479, the
// last being the man door's.
//
// THE TOP OF A FACE IS THE HIGHEST RUN ITS OWN STROKE DRAWS. One face paints
// its top, its base and now its door sills in a single beginPath/stroke pair
// -- which is the same fact the note at `levelRuns` already turns on -- so
// asking each stroke for its highest run names the top of concrete and
// nothing else. A notch can only go DOWN from it.
// AND THE SILL PLATE'S TOP IS NOT A TOP OF CONCRETE. Movie, 4 Oct, asked
// for a full-weight line along the top of the plate and the pour's own top
// drawn light under it -- so a face now paints its concrete top light, in a
// stroke of its own, and a level run 1 1/2" over a light one is the plate.
const PLATE_FT = 1.5 / 12;
const topRuns = (runs, grade, faceW) => {
  const best = new Map();
  const light = runs.filter(r => r.ink && r.ink !== '#1d1f20');
  // A plate, not a step: the painter's own PLATE_CAP_FT, 6", is what it
  // will paint a plate across -- an older drawing's house walls stored at
  // the generic 8'-0" make a 3" one.
  const isPlateTop = r => light.some(q => r.e - q.e > PLATE_FT - 0.01 && r.e - q.e < 0.5
    && q.u0 < r.u1 - 0.05 && r.u0 < q.u1 - 0.05);
  runs.filter(r => Math.abs(r.w - faceW) < 1e-9 && r.e > grade + 0.5 && r.e < 0.5 && !isPlateTop(r))
    .forEach(r => {
      const had = best.get(r.stroke);
      if (!had || r.e > had.e + 1e-9) best.set(r.stroke, r);
    });
  return [...best.values()];
};

const levelRuns = view => {
  const out = [];
  view.strokes.forEach((s, stroke) => {
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i];
      if (b.move) continue;
      if (Math.abs(a.e - b.e) > 0.005) continue;
      if (Math.abs(a.u - b.u) < 0.3) continue;
      out.push({ e: a.e, u0: Math.min(a.u, b.u), u1: Math.max(a.u, b.u), w: s.w, stroke, ink: s.ink });
    }
  });
  return out;
};

// ── THE FLAG, ANSWERED ────────────────────────────────────────────────────
//
// The header advertised `[file.draft ...]` and the file never read argv at
// all: every argument, `--mutate` included, went straight into the bin. Both
// halves are fixed here -- the two fixtures this harness measures are named
// in the checks below, not chosen by the caller, so a positional is refused
// rather than pretended at, and `--mutate` does what it says.
// and it is the shared guard that answers it, not a copy of the guard. CI
// derives its engine list from the CALL FORM
// `require('./harness-args.js').mutationMode()`, so a harness that reads its
// own argv carries a mutation table that CI never runs -- the same silence as
// the flag that was filtered away, one level out. The shared guard also takes
// `--coverage`, the second spelling of this one mode, which the hand-rolled
// block refused.
const MUTATE = require('./harness-args.js').mutationMode();

// ── THE MUTANTS ───────────────────────────────────────────────────────────
//
// Each row puts one line of cut-view.js back the way it was on the day Movie
// reported the defect the checks below measure: the all-or-nothing cover
// test, the cover measured to the concrete instead of to the plate on it,
// the depth test that decides which face is in front, and the clip that
// gives a crease its length. Every one of them has to make this file go red.
//
// A MUTANT RUNS AS ITS OWN PROCESS -- see proto/mutant-subprocess.js for why.
const MUTATIONS = [
  ['a face is hidden only when another covers it END TO END', 'cut-view.js',
    c => c.replace('        if (o.hi <= r.lo + 0.05 || o.lo >= r.hi - 0.05) return [r];',
      '        if (!(o.lo <= r.lo + 0.05 && o.hi >= r.hi - 0.05)) return [r];')],

  ['what hides a face is its concrete, not the plate on top of it', 'cut-view.js',
    c => c.replace('&& o.topE + plateOf(o) >= g.topE - 1e-3',
      '&& o.topE >= g.topE - 1e-3')],

  ['a plate is never counted, however short the rise to it', 'cut-view.js',
    c => c.replace('      return rise > 0.01 && rise < PLATE_CAP_FT ? rise : 0;',
      '      return 0;')],

  ['a face at the SAME depth hides the one beside it', 'cut-view.js',
    c => c.replace('      && o.depth > g.depth + 1e-6\n', '')],

  ['a corner stops at the concrete and leaves the plate unclosed', 'cut-view.js',
    c => c.replace('        ctx.moveTo(X(u), Y(g.topE + (interior ? 0 : plateOf(g))));',
      '        ctx.moveTo(X(u), Y(g.topE));')],

  // ── AND THE SIXTH, WHICH WAS A PARAGRAPH UNTIL A FIXTURE REACHED IT ───
  //
  // This row was written with the five above and survived all of them. The
  // note it replaces said why, and said what would end it: "it becomes a
  // real row the day a fixture carries a far face that genuinely stands
  // proud of what is in front of it". Since cover is measured to the top of
  // the PLATE, a face whose step is hidden yields no runs and never reaches
  // this pass -- and on all fifteen .draft fixtures in proto/ every step was
  // hidden, so the flattened painter hashed byte-identical to the real one.
  //
  // WHAT NONE OF THE FIFTEEN HAD WAS A SECOND FOUNDATION IN FRONT OF THE
  // HOUSE WITH A LOWER TOP OF CONCRETE. Every garage in them is attached and
  // bears sill-to-sill with the house, so its concrete tops out at the house's
  // own height or 1 1/2" over it -- either way the plate covers the step.
  // proto/fixture-detached-slab-garage.draft is the case the note asked for:
  // a DETACHED garage on a THICKENED EDGE, which cut-view.js tops out at
  // grade + GARAGE_SLAB_ABOVE_GRADE_IN, ten inches, against the house's
  // fifteen and a half. It stands in front of the house and laps the house's
  // own corner, so that corner creases against the garage's concrete.
  //
  // Measured on it, E3, at the house's corner u -8:
  //
  //     real      e -1.1771 -> -1.5021    stops on the garage's top
  //     flattened e -1.1771 -> -2.3271    runs on down to grade
  //
  // Ten inches of extra crease down the middle of a face the garage covers,
  // which is the defect this clip was written against wearing the other shoe.
  ['the buried-crease clip is flattened, and a corner runs down to grade', 'cut-view.js',
    c => c.replace('const foot = Math.max(shownBase, Math.min(g.topE, hiddenTo));',
      'const foot = shownBase;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('foundation-face-harness',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

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
  // The two TOPS: the highest run each exposed face's own stroke draws.
  const tops = topRuns(runs, grade, FACE_W).sort((a, b) => a.u0 - b.u0);
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

// ── NOTHING OF A BURIED FACE SHOWS AT THE BACK ───────────────────────────
//
// Movie, 24 Sep, marking this drawing on E3 BACK and again on E2 LEFT: "here
// are some small errors (with red highlight)", "another small spot (opposite
// where garage connects)". One light vertical crossing the floor line, the
// full depth of the exposed concrete, standing in the middle of a wall with
// nothing behind it to crease.
//
// IT IS THE GARAGE'S CORNER, SEEN THROUGH THE HOUSE. On E3 the garage stands
// behind the house and its left corner falls well inside the house's own
// span. The run survived `behindFdn` on a technicality -- the garage's
// concrete tops out ABOVE the house's, so `o.topE >= g.topE` failed and the
// face counted as unhidden.
//
// THE FIRST ROUND CLIPPED THE CORNER TO THE STEP and stopped there, calling
// the step real and worth finding. It left the face's own TOP LINE running
// the full width behind the house, and on 26 Sep Movie circled twenty feet
// of it: "the garage door buck is showing on the HOUSE FOUNDATION at the
// back" ... "its like the house is transparent or the door buck lines are
// going in front of the house".
//
// SO THE STEP IS NOT VISIBLE EITHER, and that is the correction. A house does
// not stop at its concrete -- the sill plate on it is opaque, cut-view fills
// exactly that strip, and it reaches the bearing line ABOVE the garage's
// concrete. Everything of that face is behind a wall.
//
// MEASURED on this fixture, E3, after:
//
//     u -20, -16, 16    1.275 ft, full depth, nothing in front of them
//     u 4               gone -- it was 0.125 ft of a step behind the house
//
// The pair below is two-sided for the reason the old pair was: "stop drawing
// corners" passes the first of them and fails the second.

if (fs.existsSync(MOVIE)) {
  const saved = JSON.parse(fs.readFileSync(MOVIE, 'utf8'));
  const env = H.buildEnv(win, saved);
  ['E2', 'E3'].forEach(id => {
    const cut = H.standardElevationCuts(env).find(c => c.id === id);
    const view = H.paintElevation(win, env, cut, { pxPerFt: 40 });
    const runs = levelRuns(view);
    const grade = runs.filter(r => Math.abs(r.w - GRADE_W) < 1e-9)
      .map(r => r.e).sort((a, b) => a - b)[0];
    // THE TWO TOPS, read the way the check above reads them, so the step this
    // crease is allowed to be long is the drawing's own number and not one
    // typed here.
    const tops = [...new Set(topRuns(runs, grade, FACE_W).map(r => r.e.toFixed(4)))]
      .map(Number).sort((a, b) => b - a);
    check(`${id}: the drawing paints two exposed foundation tops`,
      tops.length === 2, `${tops.length}: ${tops.join(', ')}`);
    if (tops.length !== 2) return;
    const step = tops[0] - tops[1];
    const exposed = tops[0] - grade;
    check(`${id}: the step between the two tops is smaller than the concrete is deep`,
      step > 0.001 && step < exposed / 2,
      `step ${step.toFixed(4)} against ${exposed.toFixed(4)} of exposed face`);
    // ── AND NOTHING OF A BURIED FACE IS DRAWN AT ALL ──────────────────────
    //
    // THIS PAIR USED TO ASSERT THE OPPOSITE, and the reason it inverted is
    // Movie, 26 Sep, on the BACK elevation: *"the garage door buck is showing
    // on the HOUSE FOUNDATION at the back"*, then *"its like the house is
    // transparent or the door buck lines are going in front of the house"*.
    //
    // The round that wrote these checks found the same root cause and stopped
    // one step short of it: the garage's concrete tops out above the house's,
    // so `o.topE >= g.topE` failed and the garage counted as unhidden. It
    // clipped the CORNER to the step -- "the truth, at the size the truth is"
    // -- and left the face's own top line running the full width behind the
    // house, which is what he circled twenty feet of.
    //
    // THE STEP IS NOT VISIBLE, and that is the correction. The house does not
    // stop at its concrete: the sill plate on it is opaque, this painter fills
    // exactly that strip, and it reaches the bearing line ABOVE the garage's
    // concrete. So the step is behind a wall, and a mark for it is a mark for
    // something a drafter standing at the back cannot see.
    //
    // TWO-SIDED, for the reason the old pair was: "stop drawing corners"
    // passes the first of these and fails the second.
    const verticals = [];
    view.strokes.forEach(st => {
      for (let i = 1; i < st.pts.length; i += 1) {
        const a = st.pts[i - 1], b = st.pts[i];
        if (b.move) continue;
        if (Math.abs(a.u - b.u) > 0.01) continue;
        const hi = Math.max(a.e, b.e), lo = Math.min(a.e, b.e);
        if (lo < grade - 0.01 || hi > tops[0] + 0.3 || hi <= grade + 0.01) continue;
        verticals.push({ u: a.u, hi, lo, len: hi - lo });
      }
    });
    check(`${id}: the foundation still draws its corners`,
      verticals.length > 0, `${verticals.length} in the band`);
    const short = verticals.filter(m => m.len < exposed - 0.01);
    check(`${id}: and none of them is cut short by something standing in front`,
      short.length === 0,
      short.length ? short.map(m => `u ${m.u.toFixed(2)} ${(m.len).toFixed(3)}ft`).join('  ')
        + ` -- a full corner is ${exposed.toFixed(3)}ft` : `all ${verticals.length} run full depth`);
  });
}

// ── A CORNER CREASES AGAINST WHAT IS IN FRONT OF IT, NOT DOWN TO GRADE ───
//
// THE CASE THE FIFTEEN FIXTURES DID NOT HAVE. Every garage in them is
// attached and bears sill-to-sill with the house, so wherever one face steps
// behind another the sill plate covers the step and the face yields no runs
// at all -- which left the clip that gives a buried crease its length
// unreachable, and a paragraph in the table above where a row should be.
//
// proto/fixture-detached-slab-garage.draft is that case, built from
// repro-garage-house.draft by standing its garage off the house: the body
// moves clear (x -4, z -18), its house-end wall -- which was the HOUSE's,
// with the house's own footings under it -- is replaced by one of the
// garage's own, its outline closes and turns detached, and its foundation
// becomes a THICKENED EDGE. cut-view.js tops a thickened edge out at grade +
// GARAGE_SLAB_ABOVE_GRADE_IN, ten inches, with no plate on it, and the slab
// is its own top of concrete, so the stored wall tops out there too.
//
// WHAT THAT MAKES, on E3: the garage stands in front of the house and laps
// the house's corner at u -8. Its concrete is ten inches proud of grade and
// the house's is fifteen and a half, so the house's face is NOT hidden -- and
// the corner that creases against it must stop where the garage's concrete
// stops, not carry on down behind it to grade.
//
// EVERY NUMBER BELOW IS ASKED OF THE DRAWING. The two tops are read the way
// the checks above read them, the corner is whichever end of the house's run
// falls inside the garage's, and the crease is measured against the garage's
// own top -- so this says nothing about where a slab sits, only that the
// crease ends on it.
const SLAB = path.join(ROOT, 'proto', 'fixture-detached-slab-garage.draft');
if (!fs.existsSync(SLAB)) {
  failures.push('proto/fixture-detached-slab-garage.draft is missing');
} else {
  const saved = JSON.parse(fs.readFileSync(SLAB, 'utf8'));
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E3');
  const view = H.paintElevation(win, env, cut, { pxPerFt: 40 });
  const runs = levelRuns(view);
  const grade = runs.filter(r => Math.abs(r.w - GRADE_W) < 1e-9)
    .map(r => r.e).sort((a, b) => a - b)[0];
  const tops = topRuns(runs, grade, FACE_W).sort((a, b) => b.e - a.e);
  // THE FIXTURE'S REACH, ASSERTED BEFORE IT IS TRUSTED: two exposed tops at
  // different heights, or there is no step here and every check below is a
  // filter over an empty list.
  check('slab fixture: E3 paints two exposed tops at different heights',
    tops.length === 2 && tops[0].e > tops[1].e + 0.1,
    tops.map(t => `e ${t.e.toFixed(4)} u ${t.u0.toFixed(2)}..${t.u1.toFixed(2)}`).join('  '));
  if (tops.length === 2 && tops[0].e > tops[1].e + 0.1) {
    const house = tops[0], slab = tops[1];
    const corner = [house.u0, house.u1]
      .find(u => u > slab.u0 + 0.05 && u < slab.u1 - 0.05);
    check('slab fixture: a house corner falls inside the garage’s span',
      corner !== undefined,
      `house ${house.u0.toFixed(2)}..${house.u1.toFixed(2)}, `
      + `garage ${slab.u0.toFixed(2)}..${slab.u1.toFixed(2)}`);
    if (corner !== undefined) {
      const marks = [];
      view.strokes.forEach(st => {
        for (let i = 1; i < st.pts.length; i += 1) {
          const a = st.pts[i - 1], b = st.pts[i];
          if (b.move) continue;
          if (Math.abs(a.u - b.u) > 0.01 || Math.abs(a.u - corner) > 0.01) continue;
          const hi = Math.max(a.e, b.e), lo = Math.min(a.e, b.e);
          if (hi < house.e - 0.02 || hi > house.e + 0.3 || lo > house.e - 0.02) continue;
          marks.push({ hi, lo });
        }
      });
      check('slab fixture: the corner is creased', marks.length === 1,
        `${marks.length} vertical(s) at u ${corner.toFixed(2)}`);
      if (marks.length === 1) {
        check('slab fixture: and the crease stops on the garage’s top of concrete',
          Math.abs(marks[0].lo - slab.e) < 0.02,
          `crease foot ${marks[0].lo.toFixed(4)}, garage top ${slab.e.toFixed(4)}`);
        check('slab fixture: rather than carrying on down to grade',
          marks[0].lo > grade + 0.1,
          `crease foot ${marks[0].lo.toFixed(4)}, grade ${grade.toFixed(4)}`);
      }
    }
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
// It is the same partial-occlusion question one axis over, and neither fix
// above reaches it: `behindFdn` asks whether the near face plus its plate
// reaches the far face's top, so a nearer face that is SHORTER than that
// hides nothing at all -- when what it should hide is everything below its
// own top. The plate closed the inch-and-a-half case, not the general one. Answering that properly makes a face's
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
