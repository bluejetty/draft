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

console.log(`fascia end harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
