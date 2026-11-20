#!/usr/bin/env node
// FOOTING CENTRED ON THE CONCRETE -- the buried footing outline of an
// elevation, on jb's own file. Its own harness rather than a block in
// elevation-harness.js so the elevation gate's twenty mutants do not each
// repaint this fixture too: the CI harnesses job runs close to its limit.
const fs = require('fs');
const path = require('path');
const { loadDraftModules, buildEnv, standardElevationCuts, paintElevation } = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// A MUTANT RUNS AS ITS OWN PROCESS -- see proto/mutant-subprocess.js for why.
const MUTATIONS = [
  ['the footing is centred on the whole wall, lining and all', 'cut-view.js',
    c => c.replace('      const concrete = face.concreteIn ?? face.wallIn;\n', '      const concrete = face.wallIn;\n')],
  ['a footing end a hair in from the run end draws its own shoulder', 'cut-view.js',
    c => c.replace('      const SHOULDER_SLACK_FT = 1 / 96;\n', '      const SHOULDER_SLACK_FT = 1e-6;\n')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('footing-centre-harness',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = loadDraftModules();

// Every stroke as straight model-space segments (as in elevation-harness.js).
const segmentsOf = view => view.strokes.flatMap(s => {
  const out = [];
  for (let i = 1; i < s.pts.length; i++) {
    const a = s.pts[i - 1], b = s.pts[i];
    if (b.move) continue;
    if (Math.hypot(b.u - a.u, b.e - a.e) < 1e-6) continue;
    out.push({ a, b });
  }
  return out;
});
// Feet of ink inside a model-space box.
const inkIn = (view, { uLo, uHi, eLo, eHi }) => {
  let feet = 0;
  segmentsOf(view).forEach(({ a, b }) => {
    const steps = Math.max(2, Math.ceil(Math.hypot(b.u - a.u, b.e - a.e) / 0.05));
    let run = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = a.u + (b.u - a.u) * t, e = a.e + (b.e - a.e) * t;
      if (u >= uLo && u <= uHi && e >= eLo && e <= eHi) run += 1;
    }
    feet += run / (steps + 1) * Math.hypot(b.u - a.u, b.e - a.e);
  });
  return feet;
};
// A stroke matching a model-space line, within tolerance at both ends.
const hasLine = (view, u0, e0, u1, e1, tol = 0.25) => segmentsOf(view).some(({ a, b }) => {
  const fits = (p, u, e) => Math.abs(p.u - u) <= tol && Math.abs(p.e - e) <= tol;
  return (fits(a, u0, e0) && fits(b, u1, e1)) || (fits(a, u1, e1) && fits(b, u0, e0));
});

// ── THE FOOTING IS CENTRED ON THE CONCRETE (jb, 19 Nov 2026) ──────────
//
// "it doesn't look like they are centered on the foundation wall like they
// should be, and extra lines in the middle footing" -- "the plan footing is
// good". jb's house on the stock 8" CONC + 2X6 BSMT wall, with two 2 ft
// concrete_8 T stubs run out the front (planTurn 3: jb's E1 is E4 here).
// The plan rings a 20" footing 6" past each face of the 8" CONCRETE; the
// elevation measured it off the whole 14" with the hidden lining, so the
// outside edge stood 3" out and a second 3" shoulder showed at the T.
  const tFile = path.join(ROOT, 'proto', 'repro-jb-fdn-tee.draft');
  const tSaved = JSON.parse(fs.readFileSync(tFile, 'utf8'));
  if (win.DraftWallTypes.adoptDrawing) win.DraftWallTypes.adoptDrawing(tSaved);
  const tEnv = buildEnv(win, tSaved);
  const tv = paintElevation(win, tEnv, standardElevationCuts(tEnv).find(c => c.id === 'E4'));
  const FTG_TOP = -9.348, FTG_BOT = -9.998;
  check('jb T: the outside corner footing stands 6" past the concrete face (left)',
    hasLine(tv, -0.5, FTG_TOP, -0.5, FTG_BOT, 0.02), 'riser at u -0.5');
  check('jb T: the outside corner footing stands 6" past the concrete face (right)',
    hasLine(tv, 20.0, FTG_TOP, 20.0, FTG_BOT, 0.02), 'riser at u 20.0');
  check('jb T: no 3" footing edge measured off the lining',
    inkIn(tv, { uLo: -0.3, uHi: -0.2, eLo: FTG_BOT + 0.05, eHi: FTG_TOP - 0.05 }) < 0.05
    && inkIn(tv, { uLo: 19.7, uHi: 19.8, eLo: FTG_BOT + 0.05, eHi: FTG_TOP - 0.05 }) < 0.05);
  check('jb T: the middle stem footing is centred under the stem (11.825..13.5 under 12.325..13)',
    hasLine(tv, 11.825, FTG_TOP, 11.825, FTG_BOT, 0.02) && hasLine(tv, 13.5, FTG_TOP, 13.5, FTG_BOT, 0.02));
  const extra = inkIn(tv, { uLo: 13.2, uHi: 13.3, eLo: FTG_BOT + 0.05, eHi: FTG_TOP - 0.05 });
  check('jb T: no extra shoulder inside the middle footing', extra < 0.05,
    `${extra.toFixed(2)} ft of ink at u 13.25`);
  const corner = inkIn(tv, { uLo: -0.45, uHi: -0.05, eLo: FTG_TOP - 0.02, eHi: FTG_TOP + 0.02 });
  check('jb T: one footing top at the corner, not a second off the stub', corner < 0.5,
    `${corner.toFixed(2)} ft of ink`);

console.log(`footing centre harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
