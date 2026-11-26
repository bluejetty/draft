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
    c => c.replace('    drawSectionStairs(env, ctx, cut, axis, stack, X, Y, pxPerFt, C, ptAtU, cutSolids);\n', '')],
  ['a cut along the run is read as one across it', 'cut-view.js',
    c => c.replace('if (Math.abs(c) > Math.SQRT1_2) {', 'if (Math.abs(c) > 2) {')],
  // RE-AIMED 13 OCT, when a flight over a garage learned to land on the slab
  // (Movie: "stairs go to 0-0 but should go down to the slab"): the line this
  // was anchored on is three now, and the mutant is the same idea said
  // against the new shape -- every stair runs to the basement slab.
  ['every stair runs down to the basement slab', 'cut-view.js',
    c => c.replace(`      const bottomFt = garageUnder
        ? garageFloorAt(env, stack.foundation, garageUnder,
          footOf(top.floorTop - garageSlabTop(env, stack.foundation, garageUnder)))
        : (below ? below.floorTop : stack.foundation.slabTop);`,
    '      const bottomFt = stack.foundation.slabTop;')],
  // AND A FLIGHT THE CUT ONLY PASSES IS DRAWN TOO (Movie, 14 Oct: "i cut a
  // section the other direction and the stairs don't show, they should be on
  // the left side"). The mutant is the rule that replaced: nothing but what
  // the cut slices.
  ['only the flights the cut slices are drawn', 'cut-view.js',
    c => c.replace('        if (!spans.length && !seen) return;', '        if (!spans.length) return;')],
  ['the floor band runs straight over the stairwell', 'cut-view.js',
    c => c.replace('return holes.length ? subtractRuns(runs, floorRuns(cut, axis, holes)) : runs;', 'return runs;')],
  ['a floor strip under 6" beside a stairwell is thrown away', 'cut-view.js',
    c => c.replace('        if (span.max - span.min <= 0.1) return;\n        ctx.fillStyle = weight(C.assembly, 0.15);',
      '        if (span.max - span.min <= 0.5) return;\n        ctx.fillStyle = weight(C.assembly, 0.15);')],
  ['the steps beyond are drawn on the viewer\'s side', 'cut-view.js',
    c => c.replace('const far = (depthOf(at(lenFt, 0)) > depthOf(at(0, 0))) ? 1 : -1;',
      'const far = (depthOf(at(lenFt, 0)) > depthOf(at(0, 0))) ? -1 : 1;')],
  ['a stair with no rail still draws one', 'cut-view.js',
    c => c.replace("        : stair.rail === 'none' || !stair.rail ? []\n          : [stair.rail === 'right' ? 1 : -1];",
      "        : [stair.rail === 'right' ? 1 : -1];")],
  ['the across cut slices no stringers', 'cut-view.js',
    c => c.replace('        [xa, xb - sx].forEach(x => {', '        [].forEach(x => {')],
  ['the turned stair\'s landing is not drawn', 'cut-view.js',
    c => c.replace('        if (!band) return;\n        const eL = band.e;', '        if (true) return;\n        const eL = band.e;')],
  ['the stringer throat is measured off the nosings again', 'stair-section.js',
    c => c.replace('- (layout.riserIn / treadRunIn()) * (u - flight.u0 + STAIR_RISER_FACE_IN / 12);',
      '- (layout.riserIn / treadRunIn()) * (u - flight.u0);')],
  ['a flight draws one tread short', 'stair-section.js',
    c => c.replace('    for (let k = 1; k < flight.risers; k++) {', '    for (let k = 2; k < flight.risers; k++) {')],
  // jb, 22 Nov 2026: "the stairs on the section seem to not position
  // properly" -- a landing only SEEN past the cut was never drawn, and what
  // lies beyond painted over the floor bands the cut slices.
  ['a landing seen past the cut is not drawn', 'cut-view.js',
    c => c.replace('        if (!band || !Array.isArray(landing.poly)) return;',
      '        if (true) return;')],
  ['what lies beyond is not hidden behind what the cut slices', 'cut-view.js',
    c => c.replace('          ctx.clip();\n          paint();', '          paint();')],
  ['the floor bands are left out of what the cut slices', 'cut-view.js',
    c => c.replace('      ...stack.floors.flatMap(level => levelRuns(level.id)', '      ...[].flatMap(level => levelRuns(level.id)')],
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

// ── THE STRIP A WALL STANDS ON BESIDE A STAIRWELL IS STILL FLOOR ───────────
//
// jb, 26 Nov 2026, on S2: "the section is missing the 2nd floor floor between
// main and 2nd floor beside stairs/ext wall". A stair widened to the wall side
// opens the upper floor to the wall's inside face, leaving the 5 1/2" the 2x6
// stands on -- and the band painter threw away any run under 6".
{
  const edgeZ = Math.max(...SAVED.floors.find(f => f.id === 'floor-23').points.map(pt => pt.z));
  const stripFt = 5.5 / 12;
  const widened = {
    ...SAVED,
    surfaceOpenings: SAVED.surfaceOpenings.map(o => (o.hostId !== 'floor-23' ? o : {
      ...o, points: o.points.map(pt => (pt.z > -30 ? { ...pt, z: edgeZ - stripFt } : pt)),
    })),
  };
  const p = paint(widened, ALONG);
  const upper = p.stack.floors.find(l => l.id === 5);
  const strips = rects(p, BAND).filter(r => Math.abs(Math.abs(r.w) / PX - stripFt) < 0.01
    && Math.abs(p.eOf(r.y) - upper.floorTop) < 0.01);
  check('the 5 1/2" of 2ND FL floor between the stairwell and the wall is drawn', strips.length, 1);
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

// ── A FLIGHT THE CUT ONLY PASSES IS STILL DRAWN ───────────────────────────
//
// Movie, 14 Oct, on S2 of the two-storey detached garage: "i cut a section
// the other direction and the stairs don't show, they should be on the left
// side". The stair stands against one side wall and the cut ran down the
// other, so nothing sliced it -- and a section shows the room, not only the
// plane. Both orientations, because they are two different pictures: WITH the
// run it is the profile in a lighter line, ACROSS it the flight end-on.
//
// BEYOND, NOT MERELY ELSEWHERE, which is the other half of the rule and is
// checked by flipping the same cut's dirVec: a stair behind the viewer's
// shoulder is out of the picture and must draw nothing.
{
  const flip = cut => ({ ...cut, dirVec: { x: -cut.dirVec.x, z: -cut.dirVec.z } });
  // Parallel to the run, 6'-10" to the +x side of it, looking -x: the stair
  // is past the cut and no part of it is sliced.
  const PAST_ALONG = { id: 9, name: 'SB', startPt: { x: -8, z: -52 }, endPt: { x: -8, z: -4 }, dirVec: { x: 1, z: 0 }, levelId: 3 };
  // Across the run and past its foot, looking back up it.
  const PAST_ACROSS = { id: 10, name: 'SC', startPt: { x: -37, z: -45 }, endPt: { x: 4, z: -45 }, dirVec: { x: 0, z: -1 }, levelId: 3 };
  const bareA = paint(SAVED, PAST_ALONG, noStairs);
  const pA = paint(SAVED, PAST_ALONG);
  check('a flight the cut passes is drawn in profile',
    pA.fills.length - bareA.fills.length > 0, true);
  // IN THE LIGHTER INK, which is how a reader tells what was SEEN from what
  // was CUT: not one tread in the solid face the sliced flights draw, and no
  // cut stringer.
  check('and in the lighter ink, not the sliced one',
    [count(pA, FACE, wide) - count(bareA, FACE, wide),
      pA.fills.filter(f => f.pts && f.ink === STRINGER).length].join(), '0,0');
  const bareB = paint(SAVED, PAST_ACROSS, noStairs);
  const pB = paint(SAVED, PAST_ACROSS);
  const lightOf = p => p.strokes.filter(s => s.ink === 'rgba(29,31,32,0.45)').length;
  check('and seen end-on it draws its nosings across the width',
    lightOf(pB) - lightOf(bareB) > 0, true);
  // AND NOTHING IS CUT, which is what tells a drawn-beyond flight from a
  // sliced one: no tread fill, no stringer, on either picture.
  check('nothing is cut on either, because nothing was',
    count(pB, CUT) - count(bareB, CUT), 0);
  check('a stair behind the viewer draws nothing, along',
    paint(SAVED, flip(PAST_ALONG)).fills.length - paint(SAVED, flip(PAST_ALONG), noStairs).fills.length, 0);
  check('and nothing across',
    paint(SAVED, flip(PAST_ACROSS)).strokes.length
      - paint(SAVED, flip(PAST_ACROSS), noStairs).strokes.length, 0);
}

// ── AN L SEEN PAST THE CUT: ITS LANDING, AND NOTHING OVER A CUT FLOOR ─────
//
// jb, 22 Nov 2026, on S1 and S2 of an L stair at a corner: "the stairs on the
// section seem to not position properly". On S1 (looking past the stair) the
// long flight stopped in mid-air and the short one stood alone as a box,
// because a landing was drawn only where the cut crossed it. On S2 (through
// the landing, looking back up the long flight) the flight seen end-on painted
// its risers up through the cut floor band. The landing is drawn when seen;
// everything beyond is clipped to its storey with the sliced bands taken out.
{
  const L = { ...SAVED, stairs: SAVED.stairs.map(st => (st.levelId === 3
    ? { ...st, shape: 'L', turn: 'right', splitTreads: 8 } : st)) };
  // The recorder's rect() is a no-op, so the clip's boxes are kept here.
  const paintClip = (saved, cut, tweak) => {
    const env = (tweak || (e => e))(H.buildEnv(win, saved));
    const extents = CV.cutViewExtents(env, cut);
    const w = 2000, h = 1200;
    const rec = H.recordingCtx();
    const { ctx } = rec;
    let pending = [], clipRects = null;
    const stack = [];
    const orig = { beginPath: ctx.beginPath, stroke: ctx.stroke, save: ctx.save, restore: ctx.restore };
    ctx.beginPath = function () { pending = []; return orig.beginPath.call(this); };
    ctx.rect = (x, y, rw, rh) => pending.push({ x0: Math.min(x, x + rw), x1: Math.max(x, x + rw), y0: Math.min(y, y + rh), y1: Math.max(y, y + rh) });
    ctx.clip = () => { clipRects = pending.slice(); };
    ctx.save = function () { stack.push(clipRects); return orig.save.call(this); };
    ctx.restore = function () { if (stack.length) clipRects = stack.pop(); return orig.restore.call(this); };
    ctx.stroke = function () {
      const n = rec.strokes.length;
      orig.stroke.call(this);
      if (rec.strokes.length > n) rec.strokes[n].rects = clipRects;
    };
    CV.drawCutView(env, ctx, w, h, cut, { pxPerFt: PX, extents });
    return { ...rec, stack: CV.sectionLevelStack(env) };
  };
  const SEEN_LANDING = 'rgba(89,128,166,0.08)';
  // Parallel to the first flight, 6 ft to its +x side, looking -x: the L is
  // wholly past the cut.
  const PAST = { id: 11, name: 'SL', startPt: { x: -8, z: -52 }, endPt: { x: -8, z: -4 }, dirVec: { x: 1, z: 0 }, levelId: 3 };
  const seenL = paintClip(L, PAST), seenBare = paintClip(L, PAST, noStairs);
  check('a landing seen past the cut is drawn',
    count(seenL, SEEN_LANDING) - count(seenBare, SEEN_LANDING) > 0, true);
  // Across the landing, looking back up the first flight (it lies at smaller
  // z, the far side of a +z dirVec).
  const SG = win.DraftStairGeometry;
  const st = L.stairs.find(s => s.levelId === 3);
  const parts = SG.stairPlanParts(st, SG.stairLayout(st.riseFt, st.risers));
  const zs = parts.landings[0].poly.map(p => p.z);
  const zMid = (Math.min(...zs) + Math.max(...zs)) / 2;
  const THROUGH = { id: 12, name: 'ST', startPt: { x: -37, z: zMid }, endPt: { x: 4, z: zMid }, dirVec: { x: 0, z: 1 }, levelId: 3 };
  const thru = paintClip(L, THROUGH), thruBare = paintClip(L, THROUGH, noStairs);
  const lightInk = 'rgba(29,31,32,0.45)';
  const beyondStrokes = thru.strokes.filter(s => s.ink === lightInk).slice(thruBare.strokes.filter(s => s.ink === lightInk).length);
  check('the first flight is seen end-on past the landing', beyondStrokes.length > 0, true);
  check('and every line of it is drawn under the clip', beyondStrokes.every(s => Array.isArray(s.rects) && s.rects.length > 0), true);
  // The floor bands the cut slices: rects in the band ink deeper than 10".
  const bands = thru.fills.filter(f => f.rect && f.ink === BAND && Math.abs(f.rect.h) / PX > 10 / 12)
    .map(f => ({ x0: Math.min(f.rect.x, f.rect.x + f.rect.w), x1: Math.max(f.rect.x, f.rect.x + f.rect.w),
      y0: Math.min(f.rect.y, f.rect.y + f.rect.h), y1: Math.max(f.rect.y, f.rect.y + f.rect.h) }));
  const overlaps = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  check('the cut floor bands are there to hide behind', bands.length > 0, true);
  check('and nothing seen past the cut is painted over one',
    beyondStrokes.every(s => (s.rects || []).every(r => bands.every(b => !overlaps(r, b)))), true);
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
