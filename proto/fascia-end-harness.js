#!/usr/bin/env node
// NOTHING STANDS JUST INSIDE THE END OF A FASCIA BAND.
//
// Movie, 21 Sep 2026, on a roof in his own drawing:
//
//   "also notice on the roof there is usually always an extra line where the
//    fascia is on one side about 1.5" inwards that should NOT be showing"
//
// He was right about all three things, including the one that sounded like an
// estimate. Measured across four elevations of repro-2storey-garage, the spare
// vertical stood 1.8", 2.1", 3.0", 3.3" and 3.6" inside the band's end -- one
// sampling step, every time -- and on ONE end of a run, because the other end
// happened to land on a sample.
//
// WHAT IT WAS. cut-view.js grows each fascia run out to the eave's true end
// (extendRunsToEaves, and the reason is written at its head) but it did that
// AFTER drawing the silhouette. So the band reached the roof's real corner
// while the outline's end riser still stood at the last sample, leaving a
// vertical stranded inboard with the band running on past it.
//
// AND A SECOND ONE UNDERNEATH. E3 and E4 look back along their axis, so u
// DESCENDS as the silhouette is sampled and a run came out of that loop with
// its ends reversed -- `u0 22, u1 -47.708` on repro-bungalow-garage-roofs E4.
// Every test downstream reads them as an interval, so an inverted run
// overlapped no eave, grew by nothing, and was then thrown away by
// `u1 - u0 > 0.5` before it could be banded. The band still appeared, because
// the face-edge pass draws it exactly and had nothing of the silhouette's to
// subtract. That is why this hid: the only visible symptom was the stranded
// riser, and the silhouette's own band was simply missing.
//
// ONE CHECK CATCHES BOTH, which is why they are pinned together here: with the
// ordering fixed and the inversion left in, the two descending elevations
// still strand a riser and this harness still goes red.
//
// THE THRESHOLD IS NOT A ROUND NUMBER PICKED FOR COMFORT. Artifacts measured
// 1.8"-3.6"; the nearest LEGITIMATE vertical in the same band was 19.2" away
// and 7.35 ft tall -- a roof-takeover edge where a garage roof dies into the
// house wall, which is not a fascia end at all. Six inches sits in the middle
// of a gap of more than an order of magnitude.
//
//   node proto/fascia-end-harness.js [file.draft ...]
const fs = require('fs');
const path = require('path');
const H = require('./elevation-harness.js');

const ROOT = path.join(__dirname, '..');
const FASCIA_FT = 5.5 / 12;
const SILHOUETTE_W = 1.5;   // cut-view.js draws the roof outline at this width
const BAND_W = 2.25;        // ...and the fascia's shadow, one per eave run
const INSIDE_IN = 6;        // how far in from an end still counts as "at" it

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// Every straight vertical segment in the painted view, in model space.
const verticalsOf = view => {
  const out = [];
  view.strokes.forEach(s => {
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i];
      if (b.move) continue;
      if (Math.abs(a.u - b.u) > 0.004) continue;
      if (Math.abs(a.e - b.e) < 0.01) continue;
      out.push({ u: (a.u + b.u) / 2, eLo: Math.min(a.e, b.e), eHi: Math.max(a.e, b.e), w: s.w });
    }
  });
  return out;
};

// A band's ink sits at the fascia's BOTTOM; its top is 5.5" above.
const bandsOf = view => view.strokes
  .filter(s => Math.abs(s.w - BAND_W) < 1e-9)
  .map(s => {
    const us = s.pts.map(p => p.u);
    return { u0: Math.min(...us), u1: Math.max(...us), base: s.pts[0].e };
  });

const files = process.argv.slice(2).filter(a => !a.startsWith('-'));
const drawings = files.length ? files : [
  'repro-2storey-garage.draft',
  'repro-bungalow-garage-roofs.draft',
  'repro-garage-house.draft',
  'repro-L-house.draft',
].map(name => path.join(ROOT, 'proto', name));

const win = H.loadDraftModules();
let bandsSeen = 0;

drawings.forEach(file => {
  const label = path.basename(file);
  if (!fs.existsSync(file)) { failures.push(`${label} is missing`); return; }
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const env = H.buildEnv(win, saved);
  H.standardElevationCuts(env).forEach(cut => {
    const view = H.paintElevation(win, env, cut, { pxPerFt: 40 });
    const bands = bandsOf(view);
    bandsSeen += bands.length;
    const verticals = verticalsOf(view);
    const strays = [];
    bands.forEach(band => {
      const lo = band.base - 0.02, hi = band.base + FASCIA_FT + 0.02;
      verticals.forEach(v => {
        if (Math.abs(v.w - SILHOUETTE_W) > 1e-9) return;      // not the outline
        if (v.eHi < lo + 0.02 || v.eLo > hi - 0.02) return;   // misses the band
        if (v.u <= band.u0 + 1e-6 || v.u >= band.u1 - 1e-6) return;  // outside, or exactly at an end
        const dIn = Math.min(v.u - band.u0, band.u1 - v.u) * 12;
        if (dIn > INSIDE_IN) return;                          // far from either end
        strays.push(`u ${v.u.toFixed(3)} is ${dIn.toFixed(2)}" inside band `
          + `${band.u0.toFixed(2)}..${band.u1.toFixed(2)}`);
      });
    });
    check(`${label} ${cut.id}: no outline riser stranded inside a fascia band`,
      strays.length === 0, strays.join('\n      '));
  });
});

// A CHECK THAT MEASURED NOTHING PASSES, and this one reads bands that a
// refactor could stop emitting at this width. Then every assertion above is
// vacuously true and the harness is green having looked at nothing.
check('the drawings actually painted fascia bands to check',
  bandsSeen > 0, `${bandsSeen} bands found at lineWidth ${BAND_W}`);

// ── TWO MORE OF MOVIE'S 21 SEP REPORTS, on his own drawing ────────────────
//
// Both are about the garage roof on E1 FRONT and both are pinned here rather
// than in a spec, because what makes them checkable is a MEASUREMENT of the
// ink rather than anything a page does.
const MOVIE = path.join(ROOT, 'proto', 'repro-movie-garage-2storey.draft');
if (!fs.existsSync(MOVIE)) {
  failures.push('proto/repro-movie-garage-2storey.draft is missing');
} else {
  const saved = JSON.parse(fs.readFileSync(MOVIE, 'utf8'));
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E1');
  const view = H.paintElevation(win, env, cut, { pxPerFt: 40 });

  // THE GARAGE ROOF IS THE LOW ONE, found by its band's base rather than by
  // id -- an id would pin the fixture, and this is about the drawing's shape.
  const garage = bandsOf(view).sort((a, b) => a.base - b.base)[0];
  check('Movie\u2019s drawing still paints a low garage fascia band on E1',
    Boolean(garage), 'no band found');

  if (garage) {
    // 1. THE ROOF IS NOT TRANSPARENT. The house's 2nd-floor rim band had its
    //    vertical edges drawn straight through the garage roof, at the
    //    garage's own exterior walls -- one overhang in from each roof edge.
    //    Movie: "i could see the sidewalls through the roof", "transparent".
    //
    //    The wall positions are DERIVED from the roof and its overhang, not
    //    typed in: a hardcoded u would pin this fixture's dimensions instead
    //    of the rule.
    const roof = (saved.roofs || []).slice()
      .sort((a, b) => Math.min(...(a.points || []).map(p => p.z))
        - Math.min(...(b.points || []).map(p => p.z))).pop();
    const over = Number(roof.overhang) || 0;
    const xs = (roof.points || []).map(p => p.x);
    const walls = [Math.min(...xs) + over, Math.max(...xs) - over];
    // BOUNDED ABOVE BY THE ROOF'S OWN RIDGE, because the roof can only hide
    // what is inside it. Without that bound this caught the HOUSE's
    // second-storey wall corner running up to the house eave at 17.252,
    // which is legitimately visible above the garage roof.
    const ridge = Math.max(...view.strokes.flatMap(st => st.pts.map(pt => pt.e))
      .filter(e => e < garage.base + 6));
    // AND THE TEST IS "REACHES INTO THE ROOF", NOT "LIES INSIDE IT". The
    // first version demanded the vertical START above the eave, and was
    // MUTATION-RUN AGAINST THE FIX REVERTED AND PASSED -- because the thing
    // it exists to catch begins 0.3" BELOW the eave (the rim band spans
    // 8.077..9.177 against an eave at 8.102), so its own precondition threw
    // it out. A guard that excludes its subject is worse than none: it
    // reports the fix is held when nothing is holding it.
    //
    // So: the TOP must be inside the roof. A vertical whose top pokes out
    // above the ridge is partly in open air and belongs on the drawing; one
    // whose top is under the ridge and above the eave is wholly covered.
    const strays = [];
    verticalsOf(view).forEach(v => {
      if (Math.abs(v.w - 1.25) > 1e-9) return;              // wall / band ink
      if (!walls.some(wu => Math.abs(v.u - wu) < 0.1)) return;
      if (v.eHi <= garage.base + 0.02) return;              // entirely below the eave
      if (v.eHi >= ridge - 0.02) return;                    // pokes out the top
      strays.push(`u ${v.u.toFixed(2)} e ${v.eLo.toFixed(3)}..${v.eHi.toFixed(3)}`);
    });
    check('no rim-band edge is drawn through the garage roof at its side walls',
      strays.length === 0,
      `walls at u ${walls.map(n => n.toFixed(1)).join(', ')}; roof `
      + `e ${garage.base.toFixed(3)}..${ridge.toFixed(3)}`
      + `\n      ${strays.join('\n      ')}`);

    // 2. A RIDGE IS ONE LINE. `onGable` passes for a ridge terminating on a
    //    gable edge, so the flat top of the gable end wore a fascia board --
    //    a light line and a heavy one 5.5" apart, level. Movie: "you
    //    shouldn't see the bottom of the top choard in the front elevation".
    //
    //    Measured as: no LEVEL line may sit exactly one board below another
    //    level line, above the garage eave. At the eave itself that pairing
    //    is the fascia band and is correct, which is why the test starts
    //    above it.
    // AT THE RIDGE, AND ONLY THERE. The first version of this looked for any
    // level line one board under another above the garage eave, and caught
    // the HOUSE's own eave band -- which is what an eave band IS. Every eave
    // wears one; a RIDGE must not. So the height is pinned to the ridge.
    const bandAtRidge = [];
    const levelRuns = [];
    view.strokes.forEach(st => {
      for (let i = 1; i < st.pts.length; i++) {
        const a = st.pts[i - 1], b = st.pts[i];
        if (b.move) continue;
        if (Math.abs(a.e - b.e) > 0.004) continue;
        if (Math.abs(a.u - b.u) < 0.5) continue;
        levelRuns.push({ e: a.e, u0: Math.min(a.u, b.u), u1: Math.max(a.u, b.u), w: st.w, ink: st.ink });
      }
    });
    // THE RAKE BAND, BY ITS OWN TWO INKS, and this precision is the point.
    // The band is a 0.6-alpha w1 top over a solid w2.25 shadow; nothing else
    // in the file draws that pair. Asking only "is any line one board under
    // the ridge" was BROADER THAN THE FIX, and it caught something the fix
    // does not address -- see the note at the foot of this block.
    const atRidge = levelRuns.filter(r => Math.abs(r.e - ridge) < 0.02
      && Math.abs(r.w - 1) < 1e-9 && String(r.ink).includes('0.6'));
    atRidge.forEach(A => levelRuns.forEach(B => {
      if (Math.abs(B.w - 2.25) > 1e-9) return;
      if (Math.abs((A.e - FASCIA_FT) - B.e) > 0.02) return;   // B one board under A
      const lo = Math.max(A.u0, B.u0), hi = Math.min(A.u1, B.u1);
      if (hi - lo < 1) return;
      bandAtRidge.push(`ridge e ${A.e.toFixed(3)} over e ${B.e.toFixed(3)}, `
        + `u ${lo.toFixed(1)}..${hi.toFixed(1)}`);
    }));
    check('the ridge wears no RAKE FASCIA BAND',
      bandAtRidge.length === 0, bandAtRidge.join('\n      '));
    // AND THE RIDGE IS STILL DRAWN. Removing a band must not remove the line:
    // a ridge is one line, and zero is as wrong as two.
    check('the ridge is still drawn, as a single silhouette line',
      levelRuns.some(r => Math.abs(r.e - ridge) < 0.02 && Math.abs(r.w - 1.5) < 1e-9),
      `nothing at w 1.5 and e ${ridge.toFixed(3)}`);

    // 3. AND NO SOFFIT RETURNS FROM IT EITHER, which is the same defect as 2
    //    wearing different ink and was left standing by that fix.
    //
    //    A soffit return closes the open corner under a rake's LOW end -- the
    //    flat metal plane under the eave-overhang triangle. A ridge has no
    //    such corner. `rake` asked only `onGable`, which the flat top of a
    //    gable end passes as squarely as its sloped sides do, so the ridge
    //    got one: measured here before the fix, a solid w1 line level at
    //    `u 4..6`, running the roof's own 2 ft of overhang.
    //
    //    NOT AT `ridge - 5.5"`, WHICH IS WHY THIS IS A BAND AND NOT A VALUE.
    //    The note this check replaces said 5.5" from reading the constant.
    //    Measured, it is 5.40" -- 11.90208 against 11.45208 -- because the
    //    face-edge pass puts the peak 0.1" above where the silhouette pass
    //    puts it. An equality on the constant would have passed while the
    //    line was still being drawn.
    //    AND NOT KEYED ON THE WIDTH, which the first draft of this check was
    //    and which would have sifted an empty set. The returns are w1; so is
    //    the band's top; the rake SILHOUETTES are w1.5. Filtering to solid w1
    //    first and then asking about elevation left a population of two --
    //    the legitimate returns at the eave -- so the zone came out empty
    //    whatever the painter did up at the ridge. It is the ELEVATION that
    //    does the work here, so the elevation is the only filter.
    const roofUs = (roof.points || []).map(p => p.x);
    const uLo = Math.min(...roofUs), uHi = Math.max(...roofUs);
    const overlapsRoof = r => r.u1 > uLo - 0.1 && r.u0 < uHi + 0.1;
    const underRidge = levelRuns
      .filter(r => overlapsRoof(r)
        && r.e < ridge - 0.02 && r.e > ridge - FASCIA_FT - 0.02)
      .map(r => `w ${r.w} ${r.ink} level at e ${r.e.toFixed(5)} `
        + `(${((ridge - r.e) * 12).toFixed(2)}" under the ridge), u ${r.u0.toFixed(1)}..${r.u1.toFixed(1)}`);
    check('nothing returns a soffit off the ridge, a corner that is not open',
      underRidge.length === 0,
      `ridge e ${ridge.toFixed(5)}, roof u ${uLo.toFixed(1)}..${uHi.toFixed(1)}`
      + `\n      ${underRidge.join('\n      ')}`);

    // 4. AND NO RAKE TREATMENT AT ALL FROM THIS SIDE, because the gable end
    //    this roof has faces AWAY from E1.
    //
    //    Movie, 22 Sep, with the ridge fixed and the two sloping bands still
    //    there, marking them green: *"i can still see the 'lower' line of the
    //    top chord (except in the middle where the window is)"*. The middle
    //    was the ridge, already fixed; the sides are the gable end's rakes.
    //
    //    They ARE rakes and a rake IS a board -- but roof-69's gable lies at
    //    z = 38 with its outward normal pointing -z, and E1's cut sits at
    //    z = 48 looking back along -z, so that end is the far face. What the
    //    drafter sees there is the HIP in front of it, which projects onto
    //    exactly the same line. A hip is where two planes meet: one line.
    //
    //    SO THE WHOLE FAMILY GOES, band and soffit return together -- the
    //    return lies in the same z = 38 plane and is behind the same hip.
    //    THIS REPLACES A CHECK THAT DEMANDED THE OPPOSITE. Written this
    //    morning against the ridge fix, "each rake still returns its soffit at
    //    the eave" was the guard against deleting too much, and it was right
    //    about that fix. The facing rule makes its subject invisible from
    //    here, so it moves to the elevation that can see it rather than being
    //    deleted -- see E3 below.
    const slopingBand = [];
    view.strokes.forEach(st => {
      if (Math.abs(st.w - BAND_W) > 1e-9) return;
      for (let i = 1; i < st.pts.length; i++) {
        const a = st.pts[i - 1], b = st.pts[i];
        if (b.move || Math.abs(a.e - b.e) < 0.02 || Math.abs(a.u - b.u) < 0.5) continue;
        if (Math.max(a.u, b.u) < uLo - 0.1 || Math.min(a.u, b.u) > uHi + 0.1) continue;
        slopingBand.push(`u ${a.u.toFixed(1)}..${b.u.toFixed(1)} e ${a.e.toFixed(2)}..${b.e.toFixed(2)}`);
      }
    });
    check('the gable end faces away from E1, so it wears no rake band here',
      slopingBand.length === 0, slopingBand.join('\n      '));

    const eaveReturns = levelRuns.filter(r => overlapsRoof(r)
      && Math.abs(r.w - 1) < 1e-9 && !String(r.ink).includes('0.6')
      && Math.abs(r.e - garage.base) < 0.02
      && Math.abs((r.u1 - r.u0) - over) < 0.1);
    check('and no soffit returns from it either, for the same reason',
      eaveReturns.length === 0,
      eaveReturns.map(r => `u ${r.u0.toFixed(1)}..${r.u1.toFixed(1)}`).join(', '));

    // 5. AND THE PAINTER HAS NOT LOST RAKES, which is what a facing rule is
    //    one bad line away from doing. E3 is the elevation roof-69's gable
    //    DOES face, and there the board and its soffit return are both drawn,
    //    on the sliver of gable the house does not hide.
    //
    //    ZERO IS AS WRONG AS TWO -- the same rule this file states for the
    //    ridge line. Without this, `toward > 0.01` written as `toward < 0.01`
    //    silences every rake in the drawing and checks 2-4 all still pass.
    const backCut = H.standardElevationCuts(env).find(c => c.id === 'E3');
    const back = H.paintElevation(win, env, backCut, { pxPerFt: 40 });
    let bandPair = 0;
    let backReturn = 0;
    back.strokes.forEach(st => {
      for (let i = 1; i < st.pts.length; i++) {
        const a = st.pts[i - 1], b = st.pts[i];
        if (b.move) continue;
        const sloped = Math.abs(a.e - b.e) > 0.02 && Math.abs(a.u - b.u) > 0.5;
        if (sloped && Math.abs(st.w - BAND_W) < 1e-9) bandPair += 1;
        if (!sloped && Math.abs(a.e - b.e) < 0.005 && Math.abs(a.u - b.u) > 0.5
          && Math.abs(st.w - 1) < 1e-9 && !String(st.ink).includes('0.6')
          && Math.abs(a.e - garage.base) < 0.02
          && Math.abs(Math.abs(b.u - a.u) - over) < 0.1) backReturn += 1;
      }
    });
    check('but E3, which the gable DOES face, still draws its rake band',
      bandPair > 0, `${bandPair} sloping band run(s) on E3`);
    check('and that rake still returns its soffit at the eave',
      backReturn > 0, `${backReturn} return(s) of ${over}' at e ${garage.base.toFixed(3)} on E3`);
  }
}

console.log(`fascia end harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
