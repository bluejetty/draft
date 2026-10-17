#!/usr/bin/env node
// overhead-lines-harness.js — WHAT HANGS OVER A WALLS PLAN
//
// Movie, 16 Oct (MAIN FL PLAN sheet 7): "a cantilever of the floor above and
// a roof overhang, drawn dashed and lighter ... A floor shows only what sits
// DIRECTLY over it: on a 2-storey the 2ND FL shows the roof overhang; MAIN
// shows the 2nd floor's cantilevers and any roof covering main-floor area
// (lower roof over a one-storey wing, garage roof, porch roof). Nothing two
// storeys up."
//
// overhead-lines.js is pure: outlines, roofs and the storey ladder in,
// segments out. The bands repro is a 2-storey with an attached garage, a
// room over the garage, a main roof (sourceLevelId null) and a garage roof
// filed to MAIN FL.
//
// Run: node proto/overhead-lines-harness.js            (checks)
//      node proto/overhead-lines-harness.js --mutate   (checks + mutation table)
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['an upper edge lying along the wall under it is a cantilever', 'overhead-lines.js',
    c => c.replace('  const EDGE_TOL_FT = 0.05;', '  const EDGE_TOL_FT = -1;')],
  ['the whole upper loop is kept, inside the walls too', 'overhead-lines.js',
    c => c.replace("        if (!covered(lower, at((t0 + t1) / 2))) out.push({ start: at(t0), end: at(t1) });",
      '        out.push({ start: at(t0), end: at(t1) });')],
  ['an upper edge is never cut where it crosses the wall line', 'overhead-lines.js',
    c => c.replace('      if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);', '')],
  ['a level with no outlines is told the whole floor above hangs over it', 'overhead-lines.js',
    c => c.replace("    const cantilevers = above === null || !own.length ? []", '    const cantilevers = above === null ? []')],
  ['the cantilever is read two storeys up', 'overhead-lines.js',
    c => c.replace('    const above = at >= 0 && at + 1 < rungs.length ? rungs[at + 1] : null;',
      '    const above = at >= 0 && at + 2 < rungs.length ? rungs[at + 2] : (at >= 0 && at + 1 < rungs.length ? rungs[at + 1] : null);')],
  ['a roof filed to a floor is drawn on every floor', 'overhead-lines.js',
    c => c.replace('        && roofLevelOf(roof, rungs, outlines) === id)', '        )')],
  ['the main roof is drawn on the bottom storey', 'overhead-lines.js',
    c => c.replace('    for (let i = ladder.length - 1; i >= 0; i -= 1) if (loopsOn(outlines, ladder[i]).length) return ladder[i];',
      '    for (let i = 0; i < ladder.length; i += 1) if (loopsOn(outlines, ladder[i]).length) return ladder[i];')],
  ["a roof's own sourceLevelId is ignored", 'overhead-lines.js',
    c => c.replace('    if (src !== null && ladder.includes(src)) return src;', '')],
  ['a garage on the storey above hangs over this one', 'overhead-lines.js',
    c => c.replace('      : loopsOn(outlines, above, { garages: false }).flatMap(', '      : loopsOn(outlines, above).flatMap(')],
  ['the lot line counts as this level\'s outline', 'overhead-lines.js',
    c => c.replace("    .filter(outline => Number(outline?.levelId) === Number(levelId) && outline.site !== true",
      '    .filter(outline => Number(outline?.levelId) === Number(levelId)')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('overhead-lines',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = require('./harness-env.js').loadDraftModules();
const O = win.DraftOverheadLines;
const SAVED = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-movie-bands.draft'), 'utf8'));

let failed = 0, ran = 0;
const check = (label, cond, detail) => {
  ran += 1;
  if (cond) return;
  failed += 1;
  console.log(`  FAIL ${label}${detail !== undefined ? `\n       ${detail}` : ''}`);
};
const key = seg => [seg.start.x, seg.start.z, seg.end.x, seg.end.z].map(v => Math.round(v * 100) / 100).join(',');
const keys = segs => segs.map(key).sort().join(' | ');
const len = segs => segs.reduce((sum, s) => sum + Math.hypot(s.end.x - s.start.x, s.end.z - s.start.z), 0);
const box = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const LADDER = [1, 3, 5];
const linesOn = (levelId, over = {}) => O.overheadLines({
  levelId, ladder: LADDER, outlines: SAVED.outlines, roofs: SAVED.roofs, ...over,
});

// ── THE CLIPPER ─────────────────────────────────────────────────────────
// A 32x40 floor over a 32x40 floor: nothing sticks out. The same floor
// pushed 2' past the front: the front edge and 2' of each side.
const LOWER = [box(-16, -20, 16, 20)];
check('a floor the same as the one under it hangs nothing over', O.outsideSegments(box(-16, -20, 16, 20), LOWER).length === 0,
  keys(O.outsideSegments(box(-16, -20, 16, 20), LOWER)));
const front = O.outsideSegments(box(-16, -22, 16, 20), LOWER);
check('a floor 2\' past the front hangs its front edge and two 2\' ends', front.length === 3 && Math.abs(len(front) - 36) < 0.01,
  keys(front));
check('and the ends stop at the wall line', front.every(s => Math.min(s.start.z, s.end.z) >= -22.001 && Math.max(s.start.z, s.end.z) <= -19.999),
  keys(front));
// A loop wholly outside: every edge whole.
check('a loop clear of the walls is kept whole', O.outsideSegments(box(-18, -22, 18, 22), LOWER).length === 4
  && Math.abs(len(O.outsideSegments(box(-18, -22, 18, 22), LOWER)) - 160) < 0.01);
// An edge that crosses in and out: cut at the crossings, inside dropped.
const across = O.outsideSegments([{ x: -30, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 30 }, { x: -30, z: 30 }], LOWER);
check('an edge through the walls keeps only its two outside parts',
  across.filter(s => s.start.z === 0 && s.end.z === 0).length === 2
  && across.filter(s => s.start.z === 0 && s.end.z === 0).every(s => Math.max(s.start.x, s.end.x) <= -15.99 || Math.min(s.start.x, s.end.x) >= 15.99),
  keys(across));
check('nothing under it, everything is outside', O.outsideSegments(box(0, 0, 4, 4), []).length === 4);
check('an L-shaped lower loop clips too', O.outsideSegments(box(0, 0, 10, 10),
  [[{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 5 }, { x: 5, z: 5 }, { x: 5, z: 10 }, { x: 0, z: 10 }]]).length === 2);
check('two points are not a loop', O.outsideSegments([{ x: 0, z: 0 }, { x: 1, z: 1 }], LOWER).length === 0);

// ── THE BANDS REPRO ─────────────────────────────────────────────────────
// MAIN FL: the 2nd floor sits on the house and on the garage, no
// cantilever; the garage roof (sourceLevelId 3) hangs 2' past the garage
// on its two sides and its back, and 2' at each end of its gable edge where
// that edge runs past the garage walls.
const main = linesOn(3);
check('MAIN FL: no cantilever, the 2nd floor sits on walls', main.cantilevers.length === 0, keys(main.cantilevers));
check('MAIN FL: the garage roof hangs past the garage on three sides and both gable ends',
  main.overhangs.length === 5 && Math.abs(len(main.overhangs) - (10 + 10 + 28 + 2 + 2)) < 0.01, keys(main.overhangs));
check('MAIN FL: and none of it is the main roof', main.overhangs.every(s => s.start.z >= 37.99 && s.end.z >= 37.99), keys(main.overhangs));
// 2ND FL: the main roof, all round, nothing of the garage roof.
const upper = linesOn(5);
check('2ND FL: no floor above, no cantilever', upper.cantilevers.length === 0);
check('2ND FL: the main roof hangs all round', upper.overhangs.length === 8, keys(upper.overhangs));
check('2ND FL: and the garage roof is not two storeys down', upper.overhangs.every(s => Math.max(s.start.z, s.end.z) <= 40.01), keys(upper.overhangs));
// The basement: no outlines of its own, so no cantilever is claimed.
const basement = linesOn(1);
check('BASEMENT: no outlines, so the main floor is not drawn hanging over it', basement.cantilevers.length === 0 && basement.overhangs.length === 0);
// A cantilever: push the 2nd floor 2' past the front wall.
const pushed = SAVED.outlines.map(o => (o.id === 'outline-15' ? { ...o, points: box(-16, -22, 16, 20).map(p => ({ ...p, y: 0 })) } : o));
const cant = linesOn(3, { outlines: pushed });
check('MAIN FL: a 2nd floor pushed 2\' past the front hangs that edge and its ends', cant.cantilevers.length === 3 && Math.abs(len(cant.cantilevers) - 36) < 0.01,
  keys(cant.cantilevers));
// NOTHING TWO STOREYS UP: a basement given the house's outline sees MAIN
// FL over it (flush, nothing) and not the pushed 2nd floor.
const basementOutlined = pushed.concat([{ id: 'bsmt', levelId: 1, points: box(-16, -20, 16, 20).map(p => ({ ...p, y: 0 })) }]);
check('BASEMENT: sees the main floor over it, not the 2nd floor two storeys up, and not the garage beside it',
  linesOn(1, { outlines: basementOutlined }).cantilevers.length === 0,
  keys(linesOn(1, { outlines: basementOutlined }).cantilevers));
// A roof naming no storey is the top storey's; one naming a rung is that rung's.
check('a roof naming no level covers the top storey with outlines', O.roofLevelOf({ sourceLevelId: null }, LADDER, SAVED.outlines) === 5);
check('a roof naming the ROOF level, not a rung, is the main roof too', O.roofLevelOf({ sourceLevelId: 7 }, LADDER, SAVED.outlines) === 5);
check('a roof naming MAIN FL covers MAIN FL', O.roofLevelOf({ sourceLevelId: 3 }, LADDER, SAVED.outlines) === 3);
// The lot line is the SITE's, never this level's outline.
const withLot = SAVED.outlines.concat([{ id: 'lot', levelId: 3, site: true, points: box(-100, -100, 100, 100) }]);
check('the lot line on a level does not swallow its overhangs', linesOn(3, { outlines: withLot }).overhangs.length === 5);
check('nothing in, nothing out', O.overheadLines({}).cantilevers.length === 0 && O.overheadLines({}).overhangs.length === 0);

console.log(`\noverhead lines: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
