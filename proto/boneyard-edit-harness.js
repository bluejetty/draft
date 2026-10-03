#!/usr/bin/env node
// THE BONEYARD'S EDITS (boneyard-edit.js), offline.
//
// Movie, 3 Oct: a moved bone takes "walls, floors, roof" with it; edges move
// "whole feet"; "all of them" of the moving rules; "also need to 'break' the
// outline (per foot)". The rules themselves are his, written down in
// RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/HOW-THE-BONEYARD-WORKS.md:
//
//   outward     flush above follows; an overhang is spent first; one that
//               would land between 2'-0" and 4'-6" is trimmed to 2'-0"
//   inward      everything hooked above comes in the same amount
//   a floor     walks the pull ladder: 2'-0" free, nothing until 4'-6",
//               piles out to 18'-0", rows at most 8'-0" apart
//
// The house is built here by hand -- a 32 x 40 on MAIN FL with its concrete,
// slab and footings, a 2ND FL over it, a roof 2 ft out -- so every number
// below can be checked on paper.
//
// Run: node proto/boneyard-edit-harness.js [--mutate]
const path = require('path');
const H = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

const MUTATIONS = [
  ['an overhang is never spent: every level above goes out with the push', 'boneyard-edit.js',
    c => c.replace('if (left <= TOL) move = -left;', 'if (true) move = prev.out;')],
  ['an overhang left in the gap is not trimmed back to 2\'-0"', 'boneyard-edit.js',
    c => c.replace('else if (left > CANTILEVER_FT + TOL && left < FIRST_PILE_FT - TOL) {',
      'else if (false) {')],
  ['inward leaves the levels above behind', 'boneyard-edit.js',
    c => c.replace('      } else {\n        move = prev.out;\n      }', '      } else {\n        move = 0;\n      }')],
  ['the ladder is not walked: a floor lands in the 2\'-0" to 4\'-6" gap', 'boneyard-edit.js',
    c => c.replace('const gotH = snapOverhang(ladder, wantH, under.h);', 'const gotH = wantH;')],
  ['a nudge from 2\'-0" does not jump the gap, so the arrows stick', 'boneyard-edit.js',
    c => c.replace('if (want > was && near(was, CANTILEVER_FT, 0.01)) return FIRST_PILE_FT;', '')],
  ['the pile rows stand 16 ft apart, not 8', 'boneyard-edit.js',
    c => c.replace('const PILE_SPACING_FT = 8;', 'const PILE_SPACING_FT = 16;')],
  ['old piles stay when the overhang shrinks', 'boneyard-edit.js',
    c => c.replace("    d.columns = (d.columns || []).filter(col => !(col.footing === PILE_FOOTING",
      "    d.columns = (d.columns || []).filter(col => true || !(col.footing === PILE_FOOTING")],
  ['a part-edge push closes no jog wall', 'boneyard-edit.js',
    c => c.replace('if (!movedAt.has(k) || !stayedAt.has(k)) return;', 'return;')],
  ['a part-edge push drags the whole edge on an angle', 'boneyard-edit.js',
    c => c.replace("if (!moving[(i - 1 + N) % N] && onLine(prev.p, L)) out.push({ p: { ...v.p }, e: null });", '')],
  ['the roof stays where it was', 'boneyard-edit.js',
    c => c.replace('report.roofs += pushRoofs(', 'report.roofs += 0 && pushRoofs(')],
  ['a bump-out\'s eave is not widened past its corners', 'boneyard-edit.js',
    c => c.replace('lo: L.lo - sLo * oh, hi: L.hi + sHi * oh };', 'lo: L.lo, hi: L.hi };')],
  ['an opening keeps its old offset on a split wall', 'boneyard-edit.js',
    c => c.replace('f.offset = Math.max(0, Math.min(p.len, p.t));', '')],
  ['the edge the garage and house share is pushed anyway', 'boneyard-edit.js',
    c => c.replace("if (shared) return { ok: false, reason: 'SHARED' };", '')],
  ['a break lands off the foot mark', 'boneyard-edit.js',
    c => c.replace('const u = Math.round(Number(req.atFt));\n    if (!(u >= edge.lo + 1 - TOL && u <= edge.hi - 1 + TOL)) return { ok: false, reason: \'AT_END\' };\n    const at = pointAt(edge.axis, edge.c, u);\n    const d = clone(drawing);\n    if (level.kind',
      'const u = Number(req.atFt);\n    if (!(u >= edge.lo + 1 - TOL && u <= edge.hi - 1 + TOL)) return { ok: false, reason: \'AT_END\' };\n    const at = pointAt(edge.axis, edge.c, u);\n    const d = clone(drawing);\n    if (level.kind')],
  ['the foundation is drawn as the floor over it, not its own concrete', 'boneyard-loops.js',
    c => c.replace('const poured = concreteLoop(drawing);', 'const poured = null;')],
  ['a garage push leaves its concrete behind', 'boneyard-edit.js',
    c => c.replace('if (garage) pushLevelRecords(d, 1, true, L, newId);', '')],
  ['the bones all grow at once instead of bottom first', 'boneyard-loops.js',
    c => c.replace('const t = (ms - k * levelMs) / levelMs;', 'const t = ms / levelMs;')],
  ['the lowest bone pops up instead of rising off the ground', 'boneyard-loops.js',
    c => c.replace('const base = k ? slots[k - 1] : level.elev - FIRST_RISE_FT;',
      'const base = k ? slots[k - 1] : level.elev;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('boneyard-edit-harness',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const E = win.DraftBoneyardEdit;
const BL = win.DraftBoneyardLoops;
const ladder = win.DraftTour.floorPullLadder;

let failed = 0, passed = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed += 1; else failed += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
};
const r3 = v => Math.round(v * 1000) / 1000;
const pts = list => list.map(p => [r3(p.x), r3(p.z)]);

// ── THE HOUSE ───────────────────────────────────────────────────────────
const rect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const ring = (loop, extra) => loop.map((p, i) => ({
  start: { x: p.x, y: 0, z: p.z }, end: { x: loop[(i + 1) % loop.length].x, y: 0, z: loop[(i + 1) % loop.length].z },
  ...extra,
}));
const house = ({ upper = rect(-16, -20, 16, 20), garage = false } = {}) => {
  const main = rect(-16, -20, 16, 20);
  let id = 0;
  const next = p => `${p}-${++id}`;
  const walls = [
    ...ring(main, { levelId: 3, view: 'plan', wallType: 'stud_2x6' }),
    ...ring(main, { levelId: 1, view: 'foundation', wallType: 'concrete_8' }),
    ...(upper ? ring(upper, { levelId: 5, view: 'plan', wallType: 'stud_2x6' }) : []),
  ].map(w => ({ ...w, id: next('wall') }));
  const d = {
    version: 1,
    levels: [{ id: 7, name: 'ROOF' }, { id: 5, name: '2ND FL' }, { id: 3, name: 'MAIN FL' }, { id: 1, name: 'FOUNDATION' }],
    outlines: [
      { id: next('outline'), levelId: 3, garage: false, points: main.map(p => ({ ...p, y: 0 })) },
      ...(upper ? [{ id: next('outline'), levelId: 5, garage: false, points: upper.map(p => ({ ...p, y: 0 })) }] : []),
    ],
    walls,
    floors: [
      { id: next('floor'), levelId: 3, structure: 'floor', garage: false, points: main },
      { id: next('floor'), levelId: 1, structure: 'slab', garage: false, points: main },
    ],
    lines: ring(main, { levelId: 1, view: 'foundation', layer: 'S-FOOTING' })
      .map(l => ({ ...l, id: next('line'), start: { ...l.start, _draftBody: 'house' }, end: { ...l.end, _draftBody: 'house' } })),
    roofs: [{ id: next('roof'), levelId: 7, sourceLevelId: null, garage: false, overhang: 2,
      points: rect(-18, -22, 18, 22), edges: ['eave', 'eave', 'eave', 'eave'], edgeOverhang: [2, 2, 2, 2] }],
    // A window on MAIN's left wall (edge 3, from (-16,20) to (-16,-20)), 30 ft along: z = -10.
    fenestrations: [],
    dimensions: [],
    columns: [],
    beams: [],
  };
  d.fenestrations.push({ id: next('fenestration'), wallId: d.walls[3].id, levelId: 3, type: 'window', offset: 30, width: 4 });
  if (garage) {
    // A garage off the front, sharing the house's front line from x = -4 to 16.
    const g = [{ x: 16, z: 20 }, { x: 20, z: 20 }, { x: 20, z: 46 }, { x: -4, z: 46 }, { x: -4, z: 20 }];
    d.outlines.push({ id: next('outline'), levelId: 3, garage: true, points: g });
    d.walls.push(...ring(g, { levelId: 3, view: 'plan', body: 'garage' }).slice(0, 4).map(w => ({ ...w, id: next('wall') })));
    d.walls.push(...ring(g, { levelId: 1, view: 'foundation', body: 'garage' }).slice(0, 4).map(w => ({ ...w, id: next('wall') })));
    d.floors.push({ id: next('floor'), levelId: 1, structure: 'slab', garage: true, points: g });
    d.columns.push({ id: 1, point: { x: 19.667, y: 0, z: 30 }, levelId: 1, view: 'foundation', footing: 'pile12', pileMark: 'P2', auto: true });
  }
  return d;
};
const STACK = { foundation: { wallBottom: -9 }, floors: [
  { id: 3, name: 'MAIN FL', floorTop: 0, wallTop: 8 }, { id: 5, name: '2ND FL', floorTop: 9, wallTop: 17 }] };
const levelsOf = d => BL.boneLevels(d, STACK);
const ctx = d => {
  const levels = levelsOf(d);
  return { levels, ladder, roofSourceId: (levels.find(l => l.kind === 'roof') || {}).sourceLevelId };
};
const push = (d, kind, levelId, edgeIndex, deltaFt, loopIndex = 0) =>
  E.pushEdge(d, { kind, levelId, loopIndex, edgeIndex, deltaFt }, ctx(d));
const outline = (d, levelId, garage = false) => d.outlines.find(o => o.levelId === levelId && o.garage === garage);
const minZ = list => r3(Math.min(...list.map(p => p.z)));
const minX = list => r3(Math.min(...list.map(p => p.x)));
const piles = d => d.columns.filter(c => c.pileMark === 'P1');

// ── EDGES ───────────────────────────────────────────────────────────────
const back = E.edgeOf(rect(-16, -20, 16, 20), 0);
check('the back edge moves in z, faces -z, runs -16 to 16', [back.axis, back.n, back.c, back.lo, back.hi], ['z', -1, -20, -16, 16]);
check('a slanted edge is not square', E.edgeOf([{ x: 0, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 6 }], 0).square, false);
check('a loop chained from its walls', pts(E.chainLoop(ring(rect(0, 0, 4, 6)))), [[0, 0], [4, 0], [4, 6], [0, 6]]);
check('walls that do not close make no loop', E.chainLoop(ring(rect(0, 0, 4, 6)).slice(0, 3)), null);

// ── THE FOUNDATION, OUTWARD: flush levels and the roof go with it ───────
{
  const r = push(house(), 'foundation', 1, 0, -3);
  const d = r.drawing;
  check('everything flush over the back wall came out 3 ft', r.report.moves.map(m => [m.name, m.outFt]),
    [['FOUNDATION', 3], ['MAIN FL', 3], ['2ND FL', 3]]);
  check('MAIN and 2ND outlines', [minZ(outline(d, 3).points), minZ(outline(d, 5).points)], [-23, -23]);
  check('the back wall, in concrete, on MAIN and on 2ND', d.walls.filter(w => w.start.z === -23 && w.end.z === -23)
    .map(w => w.levelId).sort(), [1, 3, 5]);
  check('the side walls stretched to meet it', d.walls.filter(w => w.levelId === 3 && w.start.x === -16 && w.end.x === -16)
    .map(w => [w.start.z, w.end.z]), [[20, -23]]);
  check('the slab, the deck and the footing', [minZ(d.floors.find(f => f.levelId === 1).points),
    minZ(d.floors.find(f => f.levelId === 3).points),
    Math.min(...d.lines.map(l => Math.min(l.start.z, l.end.z)))], [-23, -23, -23]);
  check('the eave stays 2 ft past the wall', minZ(d.roofs[0].points), -25);
  check('the window on the stretched wall stands where it stood', r3(d.fenestrations[0].offset), 30);
  check('the drawing handed in is untouched', minZ(outline(house(), 3).points), -20);
}

// ── AN OVERHANG IS SPENT FIRST ──────────────────────────────────────────
{
  const d0 = house({ upper: rect(-16, -30, 16, 20) });   // 2ND hangs 10 ft past MAIN's back
  const r = push(d0, 'foundation', 1, 0, -3);
  check('MAIN went out 3; 2ND kept its edge, its overhang now 7', [minZ(outline(r.drawing, 3).points),
    minZ(outline(r.drawing, 5).points)], [-23, -30]);
  check('a 7 ft overhang stands on one row of piles under its edge', [...new Set(piles(r.drawing).map(p => r3(p.point.z)))], [-30]);
  check('rows no more than 8 ft apart: 32 ft takes five', piles(r.drawing).length, 5);
}

// ── AND AN OVERHANG LEFT IN THE GAP IS TRIMMED TO 2'-0" ────────────────
{
  const d0 = house({ upper: rect(-16, -25, 16, 20) });   // 5 ft past MAIN
  const piled = push(d0, 'foundation', 1, 0, -1).drawing; // 4 ft: trimmed to 2
  check('5 ft out, pushed 1: 4 ft is in the gap, so 2ND comes back to 2 ft past',
    minZ(outline(piled, 5).points), -23);
  const r = push(house({ upper: rect(-16, -30, 16, 20) }), 'foundation', 1, 0, -7);
  check('10 ft out, pushed 7: 3 ft would be in the gap -- 2ND loses 1 ft', [minZ(outline(r.drawing, 5).points),
    r.report.trims.map(t => [t.name, t.trimFt])], [-29, [['2ND FL', 1]]]);
  check('and the piles come out from under a free cantilever', piles(r.drawing).length, 0);
}

// ── INWARD: everything hooked above comes in the same amount ────────────
{
  const r = push(house({ upper: rect(-16, -22, 16, 20) }), 'foundation', 1, 0, 3);
  check('foundation in 3: MAIN in 3, 2ND (2 ft over) in 3, still 2 ft over',
    [minZ(outline(r.drawing, 3).points), minZ(outline(r.drawing, 5).points)], [-17, -19]);
}

// ── A FLOOR'S OWN PULL WALKS THE LADDER ─────────────────────────────────
{
  let d = house();
  const steps = [];
  for (let i = 0; i < 4; i += 1) {
    const r = push(d, 'floor', 3, 3, -1);   // MAIN's left wall, out
    d = r.drawing;
    steps.push(minX(outline(d, 3).points));
  }
  check('arrows out: 1, 2, then the jump to 4\'-6", then 5\'-6"', steps, [-17, -18, -20.5, -21.5]);
  check('the foundation did not move', minX(d.walls.filter(w => w.levelId === 1).flatMap(w => [w.start, w.end])), -16);
  check('5\'-6" stands on a row of piles under the edge', [...new Set(piles(d).map(p => r3(p.point.x)))], [-21.5]);
  const back1 = push(d, 'floor', 3, 3, 1).drawing;
  const back2 = push(back1, 'floor', 3, 3, 1).drawing;
  check('and back: 4\'-6", then down past the gap to 2\'-0" with no piles',
    [minX(outline(back1, 3).points), minX(outline(back2, 3).points), piles(back2).length], [-20.5, -18, 0]);
  check('the snap, directly', [E.snapOverhang(ladder, 3, 2), E.snapOverhang(ladder, 3.5, 4.5), E.snapOverhang(ladder, 30, 10)],
    [4.5, 2, 18]);
}

// ── BREAK, AND A JOG ────────────────────────────────────────────────────
{
  const d0 = house({ upper: null });
  const b = E.breakEdge(d0, { kind: 'floor', levelId: 3, loopIndex: 0, edgeIndex: 3, atFt: 0.4 }, ctx(d0));
  check('the corner lands on the foot mark', pts(outline(b.drawing, 3).points), [[-16, -20], [16, -20], [16, 20], [-16, 20], [-16, 0]]);
  check('not in the last foot of an edge',
    E.breakEdge(d0, { kind: 'floor', levelId: 3, loopIndex: 0, edgeIndex: 3, atFt: 19.6 }, ctx(d0)).reason, 'AT_END');
  const r = push(b.drawing, 'floor', 3, 3, -6);
  const d = r.drawing;
  check('the front half came out 6 ft, the back half stayed', pts(outline(d, 3).points),
    [[-16, -20], [16, -20], [16, 20], [-22, 20], [-22, 0], [-16, 0]]);
  const left = d.walls.filter(w => w.levelId === 3 && ((w.start.x === -16 && w.end.x === -16) || (w.start.x === -22 && w.end.x === -22)
    || (w.start.z === 0 && w.end.z === 0)));
  check('the wall was cut, its front part moved, and a short wall closes the jog',
    left.map(w => [w.start.x, w.start.z, w.end.x, w.end.z]).sort(),
    [[-16, 0, -16, -20], [-16, 0, -22, 0], [-22, 20, -22, 0]].sort());
  const fen = d.fenestrations[0];
  const host = d.walls.find(w => w.id === fen.wallId);
  check('the window at z = -10 is on the part that stayed, 10 ft along it',
    [host.start.x, host.end.x, r3(fen.offset)], [-16, -16, 10]);
  check('the eave steps round the bump: out past its corner, in past the jog',
    pts(d.roofs[0].points), [[-18, -22], [18, -22], [18, 22], [-24, 22], [-24, -2], [-18, -2]]);
  const backHalf = push(b.drawing, 'floor', 3, 4, -2).drawing;
  check('the other part, the other way round the loop: the back half out 2',
    pts(outline(backHalf, 3).points), [[-18, -20], [16, -20], [16, 20], [-16, 20], [-16, 0], [-18, 0]]);
  const pushedBack = push(d, 'floor', 3, 3, 6).drawing;
  check('pushed back flush, the jog closes up', outline(pushedBack, 3).points.length, 5);
}

// ── THE FOUNDATION'S OWN BONE ───────────────────────────────────────────
{
  const d = push(house({ upper: null }), 'floor', 3, 3, -2).drawing;
  const fdn = levelsOf(d).find(l => l.kind === 'foundation');
  check('once MAIN overhangs, the foundation is drawn from its concrete', minX(fdn.loops[0].points), -16);
  const b = E.breakEdge(d, { kind: 'foundation', levelId: 1, loopIndex: 0, edgeIndex: 3, atFt: 5 }, ctx(d));
  check('a foundation break cuts the concrete and its footing',
    [b.drawing.walls.filter(w => w.levelId === 1).length, b.drawing.lines.length], [5, 5]);
}

// ── THE GARAGE ──────────────────────────────────────────────────────────
{
  const d0 = house({ upper: null, garage: true });
  check('the house front the garage shares will not move', push(d0, 'floor', 3, 2, 1).reason, 'SHARED');
  const r = push(d0, 'floor', 3, 1, 2, 1);   // the garage's right side, x = 20, out 2
  const d = r.drawing;
  check('the garage, its concrete, its slab and its pile went out 2', [
    Math.max(...outline(d, 3, true).points.map(p => p.x)),
    d.walls.filter(w => w.body === 'garage' && w.start.x === 22 && w.end.x === 22).map(w => w.levelId).sort(),
    Math.max(...d.floors.find(f => f.garage).points.map(p => p.x)),
    r3(d.columns.find(c => c.pileMark === 'P2').point.x)], [22, [1, 3], 22, 21.667]);
}

// ── THE ROOF, ON ITS OWN ────────────────────────────────────────────────
{
  const d0 = house();
  const roofBone = levelsOf(d0).find(l => l.kind === 'roof');
  check('the roof\'s bone is its eave brought back in by its overhang', pts(roofBone.loops[0].points),
    [[-16, -20], [16, -20], [16, 20], [-16, 20]]);
  const r = E.pushEdge(d0, { kind: 'roof', levelId: 7, loopIndex: 0, edgeIndex: 0, deltaFt: -5 }, ctx(d0));
  check('pulled 5 ft over a back deck: the eave goes out 5, posts under its edge',
    [minZ(r.drawing.roofs[0].points), [...new Set(piles(r.drawing).map(p => r3(p.point.z)))],
      minZ(outline(r.drawing, 5).points)], [-27, [-25], -20]);
  check('and it never comes in past its wall',
    E.pushEdge(d0, { kind: 'roof', levelId: 7, loopIndex: 0, edgeIndex: 0, deltaFt: 1 }, ctx(d0)).reason, 'NO_RUNG');
}

// ── THE GROW: BOTTOM FIRST, EACH OFF THE ONE BELOW (Movie, 3 Oct) ─────
{
  const lv = [{ elev: 9 }, { elev: -4 }, { elev: 0 }, { elev: 0 }, { elev: 18 }];
  const at = ms => BL.growStage(lv, ms, 100).map(st => (st.shown ? r3(st.h) : null));
  check('a moment in, only the foundation is up, rising off the ground', at(50)[1] > -8 && at(50)[1] < -4
    && at(50).filter(v => v !== null).length === 1, true);
  check('the two floors at one height rise together, off the foundation', [at(150)[2] === at(150)[3],
    at(150)[2] > -4 && at(150)[2] < 0, at(150)[0], at(150)[4]], [true, true, null, null]);
  check('at the end every bone stands at its own height', at(1000), [9, -4, 0, 0, 18]);
  check('four heights, four slots', BL.growMs(lv, 100), 400);
}

console.log(failed ? `\n${failed} check(s) FAILED, ${passed} passed` : `\nall ${passed} boneyard-edit checks passed`);
process.exit(failed ? 1 : 0);
