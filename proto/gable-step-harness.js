#!/usr/bin/env node
// A STEP BETWEEN TWO GABLES IS PART OF THE GABLE WALL (jb, 13 Nov 2026).
//
// "when i change the autoroof to gable it goes nuts": a 2 storey whose end
// wall stepped back a foot for its last ten feet. Both pieces of that end
// made GABLE, the foot between them stayed an EAVE, and the solver raised a
// plane off the one-foot eave that ran the length of the house -- on E2 a
// shed slope past the house, a second peak under it, a stray wall line. The
// rules this harness pins, all in geometry-2d.js:
//
//   gableJogKinds   an eave of up to ROOF_GABLE_JOG_FT (6) running square
//                   between two parallel solid edges that run the SAME way
//                   is a gable; a notch's bottom (its sides run opposite
//                   ways) and a step past the limit keep their kind.
//   stepVirtual     the solver reads those kinds off a record nobody
//                   re-saved; the ring is solved squared past the step and
//                   the strip cut away, so the ridge runs out to the end and
//                   no line climbs the step, and the planes come out whole.
//
//   node proto/gable-step-harness.js            checks
//   node proto/gable-step-harness.js --mutate   each row bent, which check catches it
const fs = require('fs');
const path = require('path');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const SRC = path.join(__dirname, '..', 'geometry-2d.js');

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(window);
  return window.DraftGeometry2D;
}

const ring = pairs => pairs.map(([x, z]) => ({ x, y: 0, z }));
const K = kinds => kinds.map(k => k[0]).join('');
const area = pts => Math.abs(pts.reduce((s, p, i) => {
  const q = pts[(i + 1) % pts.length]; return s + p.x * q.z - q.x * p.z;
}, 0)) / 2;
const segs = arcs => arcs.map(s => [s.a.x, s.a.z, s.b.x, s.b.z].map(v => Math.round(v * 100) / 100).join(','))
  .sort().join(' ');

// jb's house: 60 x 30, the west end stepped back a foot for its north ten
// feet; the eave ring is the wall ring pushed out 2'.
const STEPPED = ring([[-31, 7], [-32, 7], [-32, -17], [32, -17], [32, 17], [-31, 17]]);
const roofOf = (points, edges) => ({ points, edges, pitch: 4, overhang: 2, edgeOverhang: points.map(() => 2) });
// Both pieces of the end gabled by the panel, the foot left an eave (the
// record as his file held it).
const AS_SAVED = ['eave', 'gable', 'eave', 'gable', 'eave', 'gable'];
// A notch cut into an eave, both sides gables: its bottom stays an eave.
const NOTCHED = ring([[0, 0], [20, 0], [20, 10], [12, 10], [12, 6], [8, 6], [8, 10], [0, 10]]);
const NOTCH_KINDS = ['eave', 'eave', 'eave', 'gable', 'eave', 'gable', 'eave', 'eave'];
// A step of nine feet is a wing end, not a jog.
const WIDE = ring([[-23, 7], [-32, 7], [-32, -17], [32, -17], [32, 17], [-23, 17]]);

const CHECKS = [
  { label: 'the foot between two gables is a gable',
    fn: G => [K(G.gableJogKinds(STEPPED, AS_SAVED)), 'ggegeg'] },
  { label: 'a step with one gable beside it keeps its eave',
    fn: G => [K(G.gableJogKinds(STEPPED, ['eave', 'gable', 'eave', 'eave', 'eave', 'eave'])), 'egeeee'] },
  { label: 'a notch\'s bottom between two gables stays an eave',
    fn: G => [K(G.gableJogKinds(NOTCHED, NOTCH_KINDS)), 'eeegeg' + 'ee'] },
  { label: 'a step past the limit keeps its eave',
    fn: G => [K(G.gableJogKinds(WIDE, AS_SAVED)), 'egegeg'] },
  { label: 'the limit is six feet',
    fn: G => [G.ROOF_GABLE_JOG_FT, 6] },
  { label: 'the record as saved solves to one ridge, end to end',
    fn: G => [segs(G.roofSkeleton(roofOf(STEPPED, AS_SAVED))), '-32,0,32,0'] },
  { label: 'two planes cover the ring exactly',
    fn: G => {
      const roof = roofOf(STEPPED, AS_SAVED);
      const faces = G.roofFaces(roof, G.roofSkeleton(roof));
      return [`${faces.length} ${Math.round(faces.reduce((s, f) => s + area(f.points), 0) * 100) / 100}`,
        `2 ${area(STEPPED)}`];
    } },
  { label: 'the east end hipped: a ridge to the gable end and two hips, no line up the step',
    fn: G => [segs(G.roofSkeleton(roofOf(STEPPED, ['gable', 'gable', 'eave', 'eave', 'eave', 'gable']))),
      '-32,0,15,0 32,-17,15,0 32,17,15,0'] },
  { label: 'the hipped case: three planes, whole, covering the ring',
    fn: G => {
      const roof = roofOf(STEPPED, ['gable', 'gable', 'eave', 'eave', 'eave', 'gable']);
      const faces = G.roofFaces(roof, G.roofSkeleton(roof));
      return [`${faces.length} ${Math.round(faces.reduce((s, f) => s + area(f.points), 0) * 100) / 100}`,
        `3 ${area(STEPPED)}`];
    } },
  { label: 'the north plane runs to the gable end past the step, in one piece',
    fn: G => {
      const roof = roofOf(STEPPED, AS_SAVED);
      const north = G.roofFaces(roof, G.roofSkeleton(roof)).find(f => f.points.some(p => p.z > 10));
      return [north ? Math.min(...north.points.map(p => p.x)) : 'none', -32];
    } },
  { label: 'a plain rectangle is untouched by the step rule',
    fn: G => [segs(G.roofSkeleton(roofOf(ring([[-32, -17], [32, -17], [32, 17], [-32, 17]]), ['eave', 'gable', 'eave', 'gable']))),
      '-32,0,32,0'] },
];

function run() {
  const G = load(null);
  let failed = 0;
  CHECKS.forEach(({ label, fn }) => {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `threw: ${err.message}`; want = 'no throw'; }
    if (String(got) !== String(want)) {
      failed += 1;
      console.log(`FAIL  ${label}\n      got  ${got}\n      want ${want}`);
    }
  });
  console.log(`\n${CHECKS.length - failed}/${CHECKS.length} checks passed`);
  if (failed) process.exitCode = 1;
}

const MUTATIONS = [
  ['the step rule is switched off',
    s => s.replace('  const ROOF_GABLE_JOG_FT = 6;', '  const ROOF_GABLE_JOG_FT = 0;')],
  ['a step of any length is a gable',
    s => s.replace("        if (!d || d.len > jogFt + eps) continue;\n        if (!solid(i - 1) || !solid(i + 1)) continue;",
      "        if (!d) continue;\n        if (!solid(i - 1) || !solid(i + 1)) continue;")],
  ['a notch\'s bottom is a gable too',
    s => s.replace('        if (!squareToBoth || !sameWay) continue;', '        if (!squareToBoth) continue;')],
  ['a step beside one gable is a gable',
    s => s.replace("        if (!solid(i - 1) || !solid(i + 1)) continue;", "        if (!solid(i - 1) && !solid(i + 1)) continue;")],
  ['the ring is solved as it stands, step and all',
    s => s.replace("    const stepped = stepVirtual(roof);\n    if (stepped) return roofSkeleton(stepped.roof)", "    const stepped = null;\n    if (stepped) return roofSkeleton(stepped.roof)")],
  ['the solver reads the record\'s kinds as saved',
    s => s.replace("    const kinds = gableJogKinds(pts, Array.isArray(roof.edges) ? roof.edges : pts.map(() => 'eave'));\n    const eps = 1e-6;",
      "    const kinds = Array.isArray(roof.edges) ? roof.edges : pts.map(() => 'eave');\n    const eps = 1e-6;")],
];

function runMutations() {
  console.log('\n' + 'mutation'.padEnd(70) + 'caught by');
  let survived = 0;
  let broken = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    let G;
    try { G = load(mutate); } catch (err) {
      broken += 1;
      console.log(`${label.padEnd(70)}!!! MUTATION DID NOT APPLY: ${err.message}`);
      return;
    }
    const caught = [];
    CHECKS.forEach(({ label: name, fn }) => {
      let got, want;
      try { [got, want] = fn(G); } catch (err) { caught.push(name); return; }
      if (String(got) !== String(want)) caught.push(name);
    });
    if (!caught.length) survived += 1;
    console.log(label.padEnd(70)
      + (caught.length ? caught.join('\n' + ' '.repeat(70)) : '*** NOTHING ***'));
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  if (survived || broken) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run();
