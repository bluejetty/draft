#!/usr/bin/env node
// HOW LONG EACH CUT THE RAIL SEATS TAKES TO PAINT.
//
// IT USED TO MEASURE ONE SECTION AND MULTIPLY BY SIX, and that was wrong by
// two orders of magnitude. Its own header said "how long ONE SECTION takes to
// paint" and its last line printed "six cards at the median", turning a
// single sample into a claim about a population it had never sampled. Four of
// the six seats are ELEVATIONS, and an elevation is not a section:
//
//     repro-garage-house     E1 48.3 ms      section 0.48 ms
//     repro-L-house          E1 30.0 ms      section 0.22 ms
//     repro-courtyard-house  E1 29.9 ms      section 0.27 ms
//
// About 100x, and size-independent (the same at 232x152 and 900x600), so it is
// the painter's hidden-line geometry rather than rasterisation. The 0.14-0.30
// ms figure this script used to print was true of a section and was quoted --
// by me, in two pull requests and in the spec -- as the cost of a card. It
// reversed a recommendation it had no standing to reverse.
//
// So it now times EVERY cut the rail actually seats and reports them
// separately. A tool that averages a cheap case with an expensive one hides
// exactly the thing the question turns on.
//
// SPEC-model-html-cut-views.md left this explicitly unmeasured: the browser
// route needs a test hook the page does not have, and a synthetic env would
// have timed the stub rather than a house. Neither objection applies here —
// elevation-harness.js already loads the real modules, mirrors a real saved
// drawing into the real eighteen-accessor env, and exports all three pieces.
//
// WHAT THIS MEASURES: the painter's JavaScript — the level stack, the wall and
// floor runs, the geometry — against a recording context that records calls
// instead of rasterising them. It does NOT measure canvas rasterisation, so a
// browser's per-card cost is this plus fill and stroke. That makes this number
// a FLOOR for the card question, which is the direction that keeps it honest:
// if the floor is already expensive, thumbnails are settled.
//
//   node proto/cut-view-timing.js [file.draft] [iterations]
const fs = require('fs');
const path = require('path');
const H = require('./elevation-harness.js');

const file = process.argv[2] || path.join(__dirname, 'repro-garage-house.draft');
const iterations = Number(process.argv[3]) || 200;

const win = H.loadDraftModules();
const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
const env = H.buildEnv(win, saved);
const CV = win.DraftCutView;

// EVERY SEAT THE RAIL HOLDS: the four standard elevations, derived the same
// way the page derives them, plus the drawing's own sections. A section is
// constructed across the widest axis only when the drawing carries none, so
// the number describes a cut somebody actually drew wherever one exists.
const walls = env.walls();
const xs = walls.flatMap(w => [w.start.x, w.end.x]);
const zs = walls.flatMap(w => [w.start.z, w.end.z]);
const mid = (zs.reduce((a, b) => a + b, 0) / (zs.length || 1));
const sections = (saved.cuts || []).length ? saved.cuts : [{
  id: 'S1', name: 'S1', elev: 0, levelId: null,
  startPt: { x: Math.min(...xs) - 10, z: mid },
  endPt: { x: Math.max(...xs) + 10, z: mid },
  dirVec: { x: 0, z: 1 },
}];
// KIND BY WHICH LIST IT CAME FROM, not by cut.auto. The page's
// DraftCutMarks.autoElevationCuts stamps `auto: true`; the harness's
// standardElevationCuts does not, so reading the flag here printed all four
// elevations as "section" -- a mislabelled column in the column that is the
// whole point of the table.
const seats = [
  ...H.standardElevationCuts(env).map(cut => ({ cut, kind: 'elevation' })),
  ...sections.map(cut => ({ cut, kind: 'section' })),
];

console.log(`drawing:    ${path.basename(file)}`);
console.log(`walls:      ${walls.length}   floors: ${env.floors().length}   roofs: ${env.roofs().length}`);
console.log(`seats:      ${seats.map(s => s.cut.name || s.cut.id).join(', ')}`
  + `${(saved.cuts || []).length ? '' : '   (section constructed — the drawing carries none)'}`);

// THUMBNAIL SIZE, because that is what the rail draws. Measured at the full
// size too when this was written and it made no difference: the cost is
// geometry, not fill.
const W = 232, H_PX = 152;

const timeOne = cut => {
  // A WARM RUN FIRST, discarded. The first call pays for lazy module work and
  // JIT, and reporting it as the per-card cost would overstate every later one.
  for (let i = 0; i < 10; i += 1) CV.drawCutView(env, H.recordingCtx().ctx, W, H_PX, cut);
  const times = [];
  for (let i = 0; i < iterations; i += 1) {
    const rec = H.recordingCtx();
    const t0 = process.hrtime.bigint();
    CV.drawCutView(env, rec.ctx, W, H_PX, cut);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  return {
    min: times[0],
    median: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    max: times[times.length - 1],
  };
};

console.log(`\n${iterations} paints each at ${W}x${H_PX}, milliseconds:`);
console.log('  seat          kind        min    median     p95     max');
let total = 0;
seats.forEach(({ cut, kind }) => {
  const t = timeOne(cut);
  total += t.median;
  console.log(`  ${String(cut.name || cut.id).padEnd(12)}  ${kind.padEnd(10)}`
    + `${t.min.toFixed(2).padStart(6)}${t.median.toFixed(2).padStart(9)}`
    + `${t.p95.toFixed(2).padStart(8)}${t.max.toFixed(2).padStart(8)}`);
});

// THE RAIL'S OWN COST: the seats added up, not one of them multiplied. This is
// what an EDIT pays, since the thumbnails repaint on the model epoch and not
// on mouse traffic -- but an edit that blocks this long is a freeze the
// drafter feels on every wall they draw.
console.log(`\nthe rail repaints all ${seats.length} on every edit: `
  + `${total.toFixed(1)} ms of JS, before any rasterisation.`);
