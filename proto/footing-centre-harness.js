#!/usr/bin/env node
// FOOTING CENTRED ON THE CONCRETE -- the buried footing outline of an
// elevation, on jb's own file. Its own harness rather than a block in
// elevation-harness.js so the elevation gate's twenty mutants do not each
// repaint this fixture too: the CI harnesses job runs close to its limit.
const fs = require('fs');
const path = require('path');
const { loadDraftModules, buildEnv, standardElevationCuts, paintElevation, recordingCtx } = require('./harness-env.js');

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
  ['the section centres the footing on the whole wall, lining and all', 'cut-view.js',
    c => c.replace('        const mid = (span.lo + span.hi) / 2;\n', '        const mid = c.u;\n')],
  ['the section slab stops at the lining, not the concrete', 'cut-view.js',
    c => c.replace('        return sign > 0 ? span.hi : span.lo;\n', '        return near.u + sign * near.width / 2;\n')],
  ['the section lining runs down to the footing', 'cut-view.js',
    c => c.replace("      const lined = !c.garage && Number.isFinite(slabTop)\n", "      const lined = false && Number.isFinite(slabTop)\n")],
  ['the lining box runs its foot across the concrete at the slab top', 'cut-view.js',
    c => c.replace('        box(wLo, span.lo, top, slabTop);\n', '        box(wLo, wHi, top, slabTop);\n')],
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

// ── AND ON THE SECTION (jb, 20 Nov 2026) ──────────────────────────────
//
// "on 8\" conc wall it will be centered on the 8\" wall (foundation wall)
// and if insulated interior wall is added, that won't effect the footing.
// on ICF wall ... the full wall can be used to center the footing", and
// "the floor slab should go all the way to the interior of the foundation
// wall and the interior 2x6 wall should only go to the top of the slab".
// S1 across jb's house, through both long walls; read in sheet inches.
{
  const tFile = path.join(ROOT, 'proto', 'repro-jb-fdn-tee.draft');
  const saved = JSON.parse(fs.readFileSync(tFile, 'utf8'));
  if (win.DraftWallTypes.adoptDrawing) win.DraftWallTypes.adoptDrawing(saved);
  const sec = (drawing) => {
    const env = buildEnv(win, drawing);
    const CV = win.DraftCutView, PX = 40;
    const c = drawing.cuts[0];
    const { ctx, fills, strokes } = recordingCtx();
    CV.drawCutView(env, ctx, 2000, 1200, c, { pxPerFt: PX, extents: CV.cutViewExtents(env, c) });
    const inch = v => v / PX * 12;
    lastStrokes = strokes.map(s => ({ ...s, pts: s.pts.map(p => ({ ...p, x: inch(p.x), y: inch(p.y) })) }));
    return fills.filter(f => f.rect).map(f => ({ seq: f.seq, x: inch(f.rect.x), w: inch(f.rect.w), y: inch(f.rect.y), h: inch(f.rect.h) }));
  };
  let lastStrokes = [];
  const near = (a, b, tol = 0.1) => Math.abs(a - b) <= tol;
  const rects = sec(saved);
  const footings = rects.filter(r => near(r.w, 20) && near(r.h, 8));
  const concrete = rects.filter(r => near(r.w, 8));
  check('section: two footings on the cut', footings.length === 2, `${footings.length}`);
  footings.forEach((f, i) => {
    const mid = f.x + f.w / 2;
    check(`section: footing ${i + 1} is centred on the 8" concrete, not the 14" wall`,
      concrete.some(c => near(c.x + c.w / 2, mid)), `footing centre ${mid.toFixed(2)}"`);
  });
  const slab = rects.find(r => near(r.h, 3) && r.w > 120);
  check('section: the basement slab is drawn', !!slab);
  if (slab) {
    const innerFaces = concrete.map(c => [c.x, c.x + c.w]).flat();
    check('section: the slab runs to the inside face of the concrete at both ends',
      innerFaces.some(u => near(u, slab.x)) && innerFaces.some(u => near(u, slab.x + slab.w)),
      `slab ${slab.x.toFixed(2)}..${(slab.x + slab.w).toFixed(2)}"`);
    const whole = rects.filter(r => near(r.w, 14) && r.h > 3);
    check('section: the 2x6 lining stops at the top of the slab',
      whole.length === 2 && whole.every(r => near(r.y + r.h, slab.y)),
      whole.map(r => (r.y + r.h).toFixed(2)).join(', ') + ` vs slab top ${slab.y.toFixed(2)}`);
    // jb, 22 Nov 2026: "that slab line shouldn't go through the foundation
    // wall". No ink laid over the 8" concrete runs level at the slab's top
    // inside it (a datum painted before the pour is covered by its fill).
    const pours = concrete.filter(cr => near(cr.y + cr.h, slab.y + slab.h, 0.05) || cr.y + cr.h > slab.y + 1);
    const across = [];
    lastStrokes.forEach(st => st.pts.forEach((b, i) => {
      const a = st.pts[i - 1];
      if (!a || b.move || !near(a.y, slab.y, 0.05) || !near(b.y, slab.y, 0.05)) return;
      const l = Math.min(a.x, b.x), r = Math.max(a.x, b.x);
      pours.forEach(cr => { if (st.seq > cr.seq && Math.min(r, cr.x + cr.w) - Math.max(l, cr.x) > 0.5) across.push(`${l.toFixed(2)}..${r.toFixed(2)}`); });
    }));
    check('section: no line across the concrete at the slab top', across.length === 0, across.join(', '));
    const outlined = footings.filter(f => lastStrokes.some(st => st.pts.length >= 4
      && concrete.some(cr => st.pts.some(p => near(p.x, cr.x) && near(p.y, f.y)) && st.pts.some(p => near(p.x, cr.x + cr.w) && near(p.y, f.y)))
      && st.pts.some(p => p.y < slab.y - 12)));
    check('section: each pour is outlined top to footing in one box', outlined.length === 2, `${outlined.length}`);
  }
  // ICF: no lining, the footing centres on the whole wall.
  const icf = { ...saved, walls: saved.walls.map(w => (w.view === 'foundation' ? { ...w, wallType: 'icf', sliceFlip: false } : w)) };
  const ir = sec(icf);
  const iw = (win.DraftWallTypes.WALL_TYPES.find(t => t.id === 'icf') || {}).totalIn;
  const iwalls = ir.filter(r => near(r.w, iw) && r.h > 20);
  // UNDER A WALL, not merely 8" deep: a stair landing seen past the cut is an
  // 8" band too (jb, 22 Nov 2026), and it stands on no footing.
  const ifoot = ir.filter(r => r.h > 7.5 && r.h < 8.5 && r.w > iw
    && iwalls.some(w => near(w.y + w.h, r.y, 0.5) && r.x <= w.x + 0.1 && r.x + r.w >= w.x + w.w - 0.1));
  check('section: an ICF wall centres its footing on the whole wall',
    ifoot.length === 2 && ifoot.every(f => iwalls.some(w => near(w.x + w.w / 2, f.x + f.w / 2))),
    `${ifoot.length} footings, ${iwalls.length} ICF walls`);
}

console.log(`footing centre harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
