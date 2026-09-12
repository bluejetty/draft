#!/usr/bin/env node
// HOW LONG ONE SECTION TAKES TO PAINT.
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

// A cut straight through the house on its widest axis. Taken from the drawing
// when it carries one, so the number describes a section somebody actually
// drew rather than one invented to be cheap.
const stored = (saved.cuts || [])[0];
const walls = env.walls();
const xs = walls.flatMap(w => [w.start.x, w.end.x]);
const zs = walls.flatMap(w => [w.start.z, w.end.z]);
const mid = (zs.reduce((a, b) => a + b, 0) / (zs.length || 1));
const cut = stored || {
  id: 'S1', name: 'S1', elev: 0, levelId: null,
  startPt: { x: Math.min(...xs) - 10, z: mid },
  endPt: { x: Math.max(...xs) + 10, z: mid },
  dirVec: { x: 0, z: 1 },
};

console.log(`drawing:    ${path.basename(file)}`);
console.log(`walls:      ${walls.length}   floors: ${env.floors().length}   roofs: ${env.roofs().length}`);
console.log(`cut:        ${cut.name || cut.id}${stored ? ' (from the drawing)' : ' (constructed across the widest axis)'}`);

// A WARM RUN FIRST, discarded. The first call pays for lazy module work and
// JIT, and reporting it as the per-card cost would overstate every later card.
for (let i = 0; i < 10; i += 1) CV.drawCutView(env, H.recordingCtx().ctx, 900, 600, cut);

const times = [];
for (let i = 0; i < iterations; i += 1) {
  const rec = H.recordingCtx();
  const t0 = process.hrtime.bigint();
  CV.drawCutView(env, rec.ctx, 900, 600, cut);
  times.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
times.sort((a, b) => a - b);
const at = q => times[Math.min(times.length - 1, Math.floor(times.length * q))];
const mean = times.reduce((a, b) => a + b, 0) / times.length;

console.log(`\n${iterations} paints, milliseconds:`);
console.log(`  min ${times[0].toFixed(2)}   median ${at(0.5).toFixed(2)}   mean ${mean.toFixed(2)}   p95 ${at(0.95).toFixed(2)}   max ${times[times.length - 1].toFixed(2)}`);
console.log(`\nsix cards at the median: ${(at(0.5) * 6).toFixed(1)} ms per frame of JS, before any rasterisation.`);
