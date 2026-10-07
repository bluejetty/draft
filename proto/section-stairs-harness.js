#!/usr/bin/env node
// A SECTION THROUGH A STAIR DRAWS THE STAIR, WITH ITS RAIL.
//
// Movie, 7 Oct: "i will need them to also display on the SECTIONS when i make
// cuts" -- "it should show the full stairs with the rails". cut-view.js's
// drawSectionStairs draws every flight the cut passes over: WITH the run, the
// whole profile by stair-section.js's drawFlight (the STAIR SECTION page's own
// routine); ACROSS it, the tread and two stringers the cut slices, the steps
// beyond in a lighter line, and the rail. The floor band opens over the
// stairwell.
//
// EVERY COUNT IS A DIFFERENCE against the same section with no stairs (or no
// floor openings), so nothing else the section draws can make a check pass.
//
// Run: node proto/section-stairs-harness.js
//      node proto/section-stairs-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the section never draws its stairs', 'cut-view.js',
    c => c.replace('    drawSectionStairs(env, ctx, cut, axis, stack, X, Y, pxPerFt, C, ptAtU);\n', '')],
  ['a cut along the run is read as one across it', 'cut-view.js',
    c => c.replace('if (Math.abs(c) > Math.SQRT1_2) {', 'if (Math.abs(c) > 2) {')],
  ['every stair runs down to the basement slab', 'cut-view.js',
    c => c.replace('const bottomFt = below ? below.floorTop : stack.foundation.slabTop;',
      'const bottomFt = stack.foundation.slabTop;')],
  ['the floor band runs straight over the stairwell', 'cut-view.js',
    c => c.replace('return holes.length ? subtractRuns(runs, floorRuns(cut, axis, holes)) : runs;', 'return runs;')],
  ['the steps beyond are drawn on the viewer\'s side', 'cut-view.js',
    c => c.replace('const far = (depthOf(at(lenFt, 0)) > depthOf(at(0, 0))) ? 1 : -1;',
      'const far = (depthOf(at(lenFt, 0)) > depthOf(at(0, 0))) ? -1 : 1;')],
  ['a stair with no rail still draws one', 'cut-view.js',
    c => c.replace("        : stair.rail === 'none' || !stair.rail ? []\n          : [stair.rail === 'right' ? 1 : -1];",
      "        : [stair.rail === 'right' ? 1 : -1];")],
  ['the across cut slices no stringers', 'cut-view.js',
    c => c.replace('        [xa, xb - sx].forEach(x => {', '        [].forEach(x => {')],
  ['the turned stair\'s landing is not drawn', 'cut-view.js',
    c => c.replace('      if (parts.landing && flights[1]) {', '      if (false) {')],
  ['the stringer throat is measured off the nosings again', 'stair-section.js',
    c => c.replace('- (layout.riserIn / STAIR_TREAD_RUN_IN) * (u - flight.u0 + STAIR_RISER_FACE_IN / 12);',
      '- (layout.riserIn / STAIR_TREAD_RUN_IN) * (u - flight.u0);')],
  ['a flight draws one tread short', 'stair-section.js',
    c => c.replace('    for (let k = 1; k < flight.risers; k++) {', '    for (let k = 2; k < flight.risers; k++) {')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('section-stairs',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const CV = win.DraftCutView;
const SAVED = JSON.parse(fs.readFileSync(path.join(__dirname, 'perf-bungalow.draft'), 'utf8'));
const PX = 20;

// The perf bungalow's stairs both run +z from z -33.43 at x -14.83, 3 ft wide,
// rail on the left: MAIN FL down to the basement, 2ND FL down to MAIN FL.
const ALONG = { id: 1, name: 'S1', startPt: { x: -14.5, z: -52 }, endPt: { x: -14.5, z: -4 }, dirVec: { x: 1, z: 0 }, levelId: 3 };
const ACROSS = { id: 2, name: 'S2', startPt: { x: -37, z: -28 }, endPt: { x: 4, z: -28 }, dirVec: { x: 0, z: -1 }, levelId: 3 };

function paint(saved, cut, tweak = env => env) {
  const env = tweak(H.buildEnv(win, saved));
  const extents = CV.cutViewExtents(env, cut);
  const w = 2000, h = 1200;
  const { ctx, strokes, fills } = H.recordingCtx();
  CV.drawCutView(env, ctx, w, h, cut, { pxPerFt: PX, extents });
  const y0 = (h - (extents.yTop - extents.yBottom) * PX) / 2;
  const eOf = y => extents.yTop - (y - y0) / PX;
  return { strokes, fills, eOf, stack: CV.sectionLevelStack(env) };
}
const noStairs = env => ({ ...env, stairs: () => [] });
const noHoles = env => ({ ...env, floorOpenings: () => [] });
const rects = (p, ink) => p.fills.filter(f => f.rect && f.ink === ink).map(f => f.rect);
const count = (p, ink, pred = () => true) => rects(p, ink).filter(pred).length;
const wide = r => Math.abs(r.w) > Math.abs(r.h);
const tall = r => Math.abs(r.h) > Math.abs(r.w);
const r2 = n => Math.round(n * 100) / 100;

const FACE = '#fff';
const STRINGER = 'rgba(89,128,166,0.15)';   // a path fill; the floor bands are rects
const CUT = 'rgba(89,128,166,0.3)';
const BAND = 'rgba(89,128,166,0.15)';
const RISERS = 14;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};

// ── WITH THE RUN: both flights in full ─────────────────────────────────────
{
  const p = paint(SAVED, ALONG), bare = paint(SAVED, ALONG, noStairs);
  const floors = p.stack.floors;
  const main = floors.find(l => l.id === 3), upper = floors.find(l => l.id === 5);
  check('every tread of both stairs is drawn',
    count(p, FACE, wide) - count(bare, FACE, wide), 2 * (RISERS - 1));
  check('and every riser', count(p, FACE, tall) - count(bare, FACE, tall), 2 * RISERS);
  check('one cut stringer per stair',
    p.fills.filter(f => f.pts && f.ink === STRINGER).length, 2);
  check('and one rail over each, 36" up',
    p.strokes.filter(s => s.w === 2).length - bare.strokes.filter(s => s.w === 2).length, 2);
  // THE RISE IS THE SECTION'S: the bottom riser of each stair stands on a
  // floor this section draws.
  const riserFeet = rects(p, FACE).filter(tall).map(r => r2(p.eOf(r.y + r.h)));
  check('the upper stair lands on the MAIN FL', riserFeet.includes(r2(main.floorTop)), true);
  check('the lower stair lands on the basement slab', riserFeet.includes(r2(p.stack.foundation.slabTop)), true);
  check('and no riser stands outside the two storeys it climbs',
    riserFeet.every(e => e >= r2(p.stack.foundation.slabTop) && e <= r2(upper.floorTop)), true);
  // THE STRINGER'S THROAT: its plumb cut at the top runs 7" below the first
  // notch root, which is one riser under the floor.
  const upperStringer = p.fills.filter(f => f.pts && f.ink === STRINGER)
    .find(f => r2(p.eOf(Math.min(...f.pts.map(pt => pt.y)))) === r2(upper.floorTop));
  const riserFt = (upper.floorTop - main.floorTop) / RISERS;
  const plumb = upperStringer && upperStringer.pts[upperStringer.pts.length - 2];
  check('the stringer keeps a 7" throat under its notches',
    plumb ? r2(p.eOf(plumb.y)) : 'none', r2(upper.floorTop - riserFt - 7 / 12));
  check('the floor bands open over both stairwells',
    count(p, BAND) - count(paint(SAVED, ALONG, noHoles), BAND), 2);
}

// ── ACROSS THE RUN: the slice, the steps beyond, the rail end-on ───────────
{
  const p = paint(SAVED, ACROSS), bare = paint(SAVED, ACROSS, noStairs);
  const cutTreads = rects(p, CUT).filter(wide);
  check('one cut tread per stair', cutTreads.length, 2);
  check('two cut stringers per stair', rects(p, CUT).filter(tall).length, 4);
  const main = p.stack.floors.find(l => l.id === 3);
  const upper = p.stack.floors.find(l => l.id === 5);
  const riserFt = (upper.floorTop - main.floorTop) / RISERS;
  const onARiser = r => {
    const steps = (upper.floorTop - p.eOf(r.y)) / riserFt;
    return Math.abs(steps - Math.round(steps)) < 0.02;
  };
  check('the cut tread of the upper stair sits on a riser line',
    cutTreads.filter(r => p.eOf(r.y) > main.floorTop).every(onARiser), true);
  // The stairs run away from this viewer: everything beyond lies BELOW the
  // slice.
  const light = p.strokes.filter(s => s.ink === 'rgba(29,31,32,0.45)' && s.w === 0.75);
  const lightBare = bare.strokes.filter(s => s.ink === 'rgba(29,31,32,0.45)' && s.w === 0.75);
  const sliceTop = Math.min(...cutTreads.map(r => r.y));
  check('the steps beyond are drawn', light.length - lightBare.length > 0, true);
  check('and they fall away below the slice, as the stair does',
    light.slice(lightBare.length).every(s => s.pts.every(pt => pt.y >= sliceTop - 0.5)), true);
  const rails = p.strokes.filter(s => s.w === 2).length - bare.strokes.filter(s => s.w === 2).length;
  check('each stair\'s rail stands over the slice', rails, 2);
  const noRail = paint({ ...SAVED, stairs: SAVED.stairs.map(st => ({ ...st, rail: 'none' })) }, ACROSS);
  check('and a stair with no rail draws none',
    noRail.strokes.filter(s => s.w === 2).length - bare.strokes.filter(s => s.w === 2).length, 0);
}

// ── A TURNED STAIR: the first flight and the landing it turns on ───────────
{
  const L = { ...SAVED, stairs: SAVED.stairs.map(st => (st.levelId === 5 ? { ...st, shape: 'L' } : st)) };
  const p = paint(L, ALONG), bare = paint(L, ALONG, noStairs);
  const SG = win.DraftStairGeometry;
  const layout = SG.stairLayout((p.stack.floors.find(l => l.id === 5).floorTop
    - p.stack.floors.find(l => l.id === 3).floorTop));
  const split = SG.stairShapeSplit({ shape: 'L', widthFt: 3 }, layout);
  check('the L\'s first flight draws its own treads beside the straight stair\'s',
    count(p, FACE, wide) - count(bare, FACE, wide), split.t1 + (RISERS - 1));
  check('and the landing it turns on', count(p, BAND) - count(bare, BAND), 1);
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
