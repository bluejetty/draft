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
  ['the ENTRY is pushed as a storey again', 'boneyard-edit.js',
    c => c.replace('if (asked === landing) return pushLanding(drawing, req, ctx, all);', '')],
  ['an inward push drags any edge facing the same way', 'boneyard-edit.js',
    c => c.replace('if (prev.out < 0 && hit.h > REACH_FT + TOL) break;', '')],
  ['a notched front moves on one side of the notch only', 'boneyard-edit.js',
    c => c.replace('        twins.push({ loop: lp, edge: e });', '')],
  ['the landing\'s push leaves MAIN\'s notch behind', 'boneyard-edit.js',
    c => c.replace('if (into) carryOnLine(d, into, edge, edge.lo, edge.hi, out * edge.n, newId, report);', '')],
  ['the house\'s roof stands on the room over the garage\'s plate', 'boneyard-loops.js',
    c => c.replace('const plates = floors.filter(f => !ownedBy.has(Number(f.floor.id)));', 'const plates = floors;')],
  ['a roof on a plate of its own is not drawn on the bone', 'boneyard-loops.js',
    c => c.replace('if (roof.sourceLevelId == null || roof.garage || (roof.points || []).length < 3) return;', 'return;')],
  ['the room\'s roof is drawn at the house roof\'s height', 'boneyard-loops.js',
    c => c.replace('polys: level.loops.map(loop => loop.points.map(p => project(p, loop.elev ?? level.elev, deg))),',
      'polys: level.loops.map(loop => loop.points.map(p => project(p, level.elev, deg))),')
      .replace('elev: on.floor.wallTop, sourceLevelId: on.floor.id });', 'sourceLevelId: on.floor.id });')],
  ['pulling the room\'s roof moves the house\'s', 'boneyard-edit.js',
    c => c.replace('const mine = (d.roofs || []).filter(r => r.id != null && r.id === loop.id);', 'const mine = [];')],
  ['an overhang is never spent: every level above goes out with the push', 'boneyard-edit.js',
    c => c.replace('if (left <= TOL) move = -left;', 'if (true) move = prev.out;')],
  ['an overhang left in the gap is not trimmed back to 2\'-0"', 'boneyard-edit.js',
    c => c.replace('else if (left > CANTILEVER_FT + TOL && left < FIRST_PILE_FT - TOL) {',
      'else if (false) {')],
  ['inward leaves the levels above behind', 'boneyard-edit.js',
    c => c.replace('      } else {\n        move = prev.out;\n      }', '      } else {\n        move = 0;\n      }')],
  ['a pile goes in over the house\'s own foundation', 'boneyard-edit.js',
    c => c.replace('          if (onFoundation(p)) continue;\n', '')],
  ['a roof pushed over the house gets no wall under it', 'boneyard-edit.js',
    c => c.replace("    roofs.forEach(r => { report.hoodWalls = (report.hoodWalls || 0) + roofHood(d, r, ctx); });\n", '')],
  ['a room wall a jog off the line stands in for the stick-framed back wall', 'boneyard-edit.js',
    c => c.replace('if (!e.square || e.axis !== axis || Math.abs(e.c - c) > 1e-6) return;',
      'if (!e.square || e.axis !== axis || Math.abs(e.c - c) > 1.5) return;')],
  ['the walls under the roof go back on their centreline', 'boneyard-edit.js',
    c => c.replace("        refLine,\n        baseHeight: heights.baseHeight,", "        refLine: 'center',\n        baseHeight: heights.baseHeight,")],
  ['a house that is not a MOD BILEVEL gets the walls too', 'boneyard-edit.js',
    c => c.replace("    if (d.buildType !== 'modifiedBilevel') return 0;\n", '')],
  ['the main roof is not cut at the new walls', 'boneyard-edit.js',
    c => c.replace('    if (runs.length) cutMainRoof(d, roof, line, house, runs, roomEdges);\n', '')],
  ['the cut runs on behind the stick-framed wall', 'boneyard-edit.js',
    c => c.replace('const take = inside(line, mid) && house.some(h => inside(h, mid)) && !inStrip(mid);',
      'const take = inside(line, mid) && house.some(h => inside(h, mid));')],
  ['the old cut is left when the roof moves again', 'boneyard-edit.js',
    c => c.replace('      r.cuts = r.cuts.filter(cut => cut.hoodOf !== String(roof.id));\n', '')],
  ['a cut roof keeps all its paper', 'geometry-2d.js',
    c => c.replace('  return cutRoofFaces(faces, roof);\n};', '  return faces;\n};')],
  ['a face split by a cut keeps its seams as edges', 'geometry-2d.js',
    c => c.replace('    return t < -1e-9 || t > 1 + 1e-9;', '    return false;')],
  ['a ridge guide runs straight through a cut', 'geometry-2d.js',
    c => c.replace('  if (t1 - t0 < 1e-9) return [part];', '  return [part];')],
  ['the file drops a roof\'s cuts', 'drawing-format.js',
    c => c.replace('          return cuts.length ? { cuts } : {};', '          return {};')],
  ['the old walls are left when the roof moves again', 'boneyard-edit.js',
    c => c.replace("    d.walls = (d.walls || []).filter(w => w.hoodOf !== String(roof.id));\n", '')],
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
  ['the openings are not found', 'boneyard-loops.js',
    c => c.replace('if (!best) return;\n      const half', 'if (true) return;\n      const half')],
  ['an opening is found on a level its wall is not on', 'boneyard-loops.js',
    c => c.replace(' || Number(wall.levelId) !== Number(levelId)) return;', ') return;')],
  ['the gap is not cut out of the line', 'boneyard-loops.js',
    c => c.replace('t = Math.max(t, g.to);', '')],
  ['the gap is centred on the wall start, not the opening', 'boneyard-loops.js',
    c => c.replace('const off = Number(f.offset) || 0;', 'const off = 0;')],
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

// ── A ROOF ON A PLATE OF ITS OWN ────────────────────────────────────────
// Movie, 4 Oct, on the MOD BILEVEL: "the upper roof needs a 'roof' - orange'
// wireframe on the bone". The room over the garage stands on OVER GARAGE,
// half a storey over MAIN, with its own square roof; the house's roof is
// MAIN's.
{
  const d0 = house({ upper: null });
  d0.levels.splice(1, 0, { id: 4, name: 'OVER GARAGE' });
  d0.outlines.push({ id: 'outline-room', levelId: 4, garage: false,
    points: rect(-4, 20, 20, 38).map(p => ({ ...p, y: 0 })) });
  d0.roofs.push({ id: 'roof-room', levelId: 7, sourceLevelId: 4, garage: false, overhang: 2,
    points: rect(-6, 12, 22, 40), edges: ['eave', 'eave', 'eave', 'eave'], edgeOverhang: [2, 2, 2, 2] });
  const SPLIT = { foundation: { wallBottom: -9 }, floors: [
    { id: 3, name: 'MAIN FL', floorTop: 0, wallTop: 8 }, { id: 4, name: 'OVER GARAGE', floorTop: 6.25, wallTop: 14.25 }] };
  const levels = BL.boneLevels(d0, SPLIT);
  const roofBone = levels.find(l => l.kind === 'roof');
  check('the house\'s roof stands on MAIN, not on the room over the garage', roofBone.elev, 8);
  const room = roofBone.loops.find(l => l.id === 'roof-room');
  check('the room\'s roof is drawn too, square, at the room\'s own ceiling',
    room && [pts(room.points), room.elev, room.sourceLevelId],
    [[[-4, 14], [20, 14], [20, 38], [-4, 38]], 14.25, 4]);
  const at = roofBone.loops.indexOf(room);
  const c = { levels, ladder, roofSourceId: roofBone.sourceLevelId };
  const r = E.pushEdge(d0, { kind: 'roof', levelId: 7, loopIndex: at, edgeIndex: 1, deltaFt: 2 }, c);
  check('pulling the room\'s roof moves that roof, not the house\'s',
    r.ok && [r3(Math.max(...r.drawing.roofs[1].points.map(p => p.x))), r3(Math.max(...r.drawing.roofs[0].points.map(p => p.x)))],
    [24, 18]);
}

// ── A BILEVEL'S ENTRY IS A LANDING (Movie, 4 Oct) ──────────────────────
// Stretching a MOD BILEVEL's ENTRY put "8 piles under the overhang" inside
// the house -- "they shouldn't show up there on the interior" -- and folded
// MAIN FL's outline back on itself. The landing is no storey under MAIN: its
// pushes carry MAIN's notch round it and place no piles, and MAIN bears on
// the foundation.
{
  const fs = require('fs');
  const CV = win.DraftCutView;
  const m0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-modbilevel-e1.draft'), 'utf8'));
  const mLevels = d => BL.boneLevels(d, CV.sectionLevelStack(H.buildEnv(win, d)));
  const mCtx = d => {
    const levels = mLevels(d);
    return { levels, ladder, roofSourceId: (levels.find(l => l.kind === 'roof') || {}).sourceLevelId };
  };
  const mPush = (d, kind, levelId, edgeIndex, deltaFt) =>
    E.pushEdge(d, { kind, levelId, loopIndex: 0, edgeIndex, deltaFt }, mCtx(d));
  const houseOf = (d, id) => d.outlines.find(o => Number(o.levelId) === id && !o.garage).points.map(p => [p.x, p.z]);
  const P1 = d => d.columns.filter(c => c.pileMark === 'P1').length;
  // ENTRY: [(-10,14) (2,14) (2,20) (-4,20) (-10,20)]; edge 0 is its back.
  const out = mPush(m0, 'floor', 2, 0, -5);
  check('ENTRY out 5 ft at the back: no piles, MAIN\'s notch goes with it',
    out.ok && [P1(out.drawing), houseOf(out.drawing, 3)],
    [0, [[-16, -20], [16, -20], [16, 20], [2, 20], [2, 9], [-10, 9], [-10, 20], [-16, 20]]]);
  const inn = mPush(m0, 'floor', 2, 4, 3);
  check('ENTRY side in 3 ft: no piles, MAIN\'s back wall stays where it is',
    inn.ok && [P1(inn.drawing), houseOf(inn.drawing, 3)],
    [0, [[-16, -20], [16, -20], [16, 20], [2, 20], [2, 14], [-7, 14], [-7, 20], [-16, 20]]]);
  const front = mPush(m0, 'floor', 2, 2, 2);
  check('ENTRY front out 2 ft over the garage line: the room over the garage stays',
    front.ok && JSON.stringify(houseOf(front.drawing, 4)) === JSON.stringify(houseOf(m0, 4)), true);
  // FOUNDATION: [(-16,-20) (16,-20) (16,20) (-16,20)]; edge 2 is its front.
  const fdn = mPush(m0, 'foundation', 1, 2, 2);
  check('FOUNDATION front out 2 ft: MAIN\'s front both sides of the notch, the ENTRY front, no piles',
    fdn.ok && [P1(fdn.drawing), houseOf(fdn.drawing, 3), houseOf(fdn.drawing, 2)],
    [0, [[-16, -20], [16, -20], [16, 22], [2, 22], [2, 14], [-10, 14], [-10, 22], [-16, 22]],
      [[-10, 14], [2, 14], [2, 22], [-4, 22], [-10, 22]]]);
  // The far edge facing the same way is another wall, not one hanging off
  // this line: the room over the garage, 37 ft from the back wall.
  const backIn = mPush(m0, 'foundation', 1, 0, 3);
  check('FOUNDATION back in 3 ft: MAIN follows, the room over the garage does not',
    backIn.ok && [houseOf(backIn.drawing, 3)[0], JSON.stringify(houseOf(backIn.drawing, 4)) === JSON.stringify(houseOf(m0, 4))],
    [[-16, -17], true]);
  // And an edge further out than any ladder reaches is another wall, not
  // one hanging off this line: a 2ND FL drawn 20 ft past MAIN's back stays
  // where it is when MAIN's back comes in.
  const far = house({ upper: rect(-16, -40, 16, 20) });
  const farIn = push(far, 'floor', 3, 0, 3);
  check('MAIN back in 3 ft: a 2ND FL edge 20 ft further out is not dragged',
    farIn.ok && [minZ(outline(farIn.drawing, 3).points), minZ(outline(farIn.drawing, 5).points)], [-17, -40]);
  const main = mPush(m0, 'floor', 3, 0, -6);
  check('MAIN FL out 6 ft at the back: piled against the FOUNDATION, not the ENTRY',
    main.ok && [P1(main.drawing) > 0, main.report.overhangFt], [true, 6]);
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

// ── THE OPENINGS IN THE BONE (Movie, 3 Oct) ──────────────────────────
// "show the doors and window as openings in the outline with a dot where
// their center position is".
{
  const d = house();
  // A door on the front (wall 2, (16,20) to (-16,20)), 10 ft along: x = 6.
  d.fenestrations.push({ id: 'door-1', wallId: d.walls[2].id, levelId: 3, type: 'door', offset: 10, width: 3 });
  // And a window on 2ND FL, whose walls are their own.
  d.fenestrations.push({ id: 'up-1', wallId: d.walls[11].id, levelId: 5, type: 'window', offset: 5, width: 2 });
  const lv = levelsOf(d);
  const main = lv.find(l => l.name === 'MAIN FL').loops[0];
  check('MAIN\'s window and door, each on its own edge, with its centre and its width',
    main.openings.map(o => [o.type, o.edge, r3(o.at), r3(o.from), r3(o.to)]),
    [['window', 3, 30, 28, 32], ['door', 2, 10, 8.5, 11.5]]);
  check('2ND FL\'s window is 2ND FL\'s, not MAIN\'s', lv.find(l => l.name === '2ND FL').loops[0].openings
    .map(o => [o.type, o.edge, r3(o.at)]), [['window', 3, 5]]);
  check('the foundation and the roof are solid', lv.filter(l => l.kind !== 'floor')
    .map(l => l.loops.some(loop => loop.openings)), [false, false]);
  const { runs, dots } = BL.runsOf(main);
  check('the line is broken at each opening: 4 edges, 2 gaps, 6 runs', runs.length, 6);
  check('the front breaks either side of the door', runs.filter(r => r.a.z === 20 && r.b.z === 20)
    .map(r => [r3(r.a.x), r3(r.b.x)]), [[16, 7.5], [4.5, -16]]);
  check('a dot at each centre, door or window', dots.map(dd => [dd.type, r3(dd.p.x), r3(dd.p.z)]),
    [['door', 6, 20], ['window', -16, -10]]);
  const laid = BL.layout(lv, 45, 400, 300);
  check('laid out: the dots are on screen where the plan points project',
    laid.levels.find(l => l.name === 'MAIN FL').cut[0].dots.length, 2);
  check('MAIN\'s window is not drawn on 2ND FL, over the same line',
    lv.find(l => l.name === '2ND FL').loops[0].openings.length, 1);
}

// ── AN UPPER ROOF PUSHED OUT OVER THE HOUSE (Movie, 4-5 Oct) ───────────
// Movie's own MOD BILEVEL, the room-over-the-garage's roof pushed 15 ft west
// over the main roof. BONEYARD said "4 piles under the overhang" and put them
// inside the house; "the piles are needed when the roof or floors are pulled
// over area with no foundation below (exterior of foundation perimeter)".
// And the roof wants "a WALL that goes at the wall distance from edge of
// roof eave overhang (2ft typ ...) and lines up with the walls over the
// garage on each side", from MAIN's ceiling to the room's plate.
{
  const fs = require('fs');
  const CV = win.DraftCutView;
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-modbilevel-roof-over-house.draft'), 'utf8'));
  const d0 = raw.drawing || raw;
  const stackOf = d => CV.sectionLevelStack(H.buildEnv(win, d));
  const hCtx = d => {
    const stack = stackOf(d);
    const levels = BL.boneLevels(d, stack);
    return { levels, ladder, roofSourceId: (levels.find(l => l.kind === 'roof') || {}).sourceLevelId,
      hoodHeights: id => {
        const main = stack.floors.find(l => Number(l.id) === 3);
        const own = stack.floors.find(l => Number(l.id) === Number(id));
        return { baseHeight: Math.max(0, main.wallTop - own.floorTop), topHeight: own.wallTop - own.floorTop };
      } };
  };
  const c0 = hCtx(d0);
  const roofBone = c0.levels.find(l => l.kind === 'roof');
  const at = roofBone.loops.findIndex(l => l.id === 'roof-70');
  const west = E.edgesOf(roofBone.loops[at].points)
    .find(e => e.square && e.axis === 'x' && Math.abs(e.c - 7) < 1e-6 && e.hi > 3);
  const r = E.pushEdge(d0, { kind: 'roof', levelId: 7, loopIndex: at, edgeIndex: west.index, deltaFt: -1 }, c0);
  check('the room\'s roof pushes a foot further west', r.ok && r3(Math.min(...r.drawing.roofs.find(x => x.id === 'roof-70').points.map(p => p.x))), 4);
  const fdn = r.ok ? r.drawing.floors.filter(f => f.view === 'foundation').map(f => f.points) : [];
  const ins = (pts, p) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
    }
    return hit;
  };
  const inner = r.ok ? r.drawing.columns.filter(col => col.footing === 'pile10' && col.auto !== true
    && fdn.some(pts => ins(pts, col.point))) : ['no push'];
  check('no pile under it: it hangs over the house\'s own foundation', inner.length, 0);
  const hood = r.ok ? r.drawing.walls.filter(w => w.hoodOf === 'roof-70') : [];
  const runs = hood.map(w => [w.start, w.end].map(p => [r3(p.x), r3(p.z)]).sort().join(' ')).sort();
  check('a wall 2 ft in from the new edge, and its sides on to the room\'s walls',
    runs, [[[6, -2], [6, 4]], [[6, -2], [19, -2]], [[19, -16], [19, -2]], [[6, 4], [20, 4]]].map(x => x.sort().join(' ')).sort());
  // ON THE EXTERIOR FACE, not the centreline (Movie, 9 Oct: "should be EXT
  // line so it lines up"): the body side is in from the wall line, so 3 ft
  // that way is inside the roof (2 ft eave), and 3 ft the other way is not.
  const roof70 = r.ok ? r.drawing.roofs.find(x => x.id === 'roof-70').points : [];
  const bodySide = w => {
    const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz);
    const s = w.refLine === 'left' ? 1 : w.refLine === 'right' ? -1 : 0;
    const m = { x: (w.start.x + w.end.x) / 2, z: (w.start.z + w.end.z) / 2 };
    return { x: m.x - s * 3 * dz / len, z: m.z + s * 3 * dx / len };
  };
  check('on the exterior face, the wall in from the line', hood.length && hood.every(w =>
    (w.refLine === 'left' || w.refLine === 'right') && ins(roof70, bodySide(w))), true);
  check('from MAIN\'s ceiling to the room\'s plate', hood.length && hood.every(w =>
    Math.abs(w.baseHeight - (109.125 / 12 - 6.25)) < 1e-3 && Math.abs(w.topHeight - 109.125 / 12) < 1e-3), true);
  // MOD BILEVEL ONLY: the same push on the same house filed as a plain
  // BILEVEL builds no walls under the roof.
  const asBilevel = { ...d0, buildType: 'bilevel' };
  const rb = E.pushEdge(asBilevel, { kind: 'roof', levelId: 7, loopIndex: at, edgeIndex: west.index, deltaFt: -1 }, c0);
  check('only a MODIFIED BILEVEL gets walls under the roof',
    rb.ok && rb.drawing.walls.filter(w => w.hoodOf).length, 0);
  // ── AND THE MAIN ROOF STOPS AT THOSE WALLS ──────────────────────────
  //
  // Movie, 5 Oct: "the main floor roof should stop at the new wall", but
  // at the back jog "the main roof will go all the way to the actual 2nd
  // floor wall". So one cut, x 6..20 by z -2..4: the end and side walls box
  // it, and the strip behind the stick-framed wall (x 19..20) is not in it.
  const rect = cut => {
    const xs = cut.points.map(p => p.x), zs = cut.points.map(p => p.z);
    return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)].map(r3);
  };
  const mainOf = dr => dr.roofs.find(x => x.id === 'roof-68');
  check('the main roof is cut where the new walls box it in, not behind the stick wall',
    r.ok && (mainOf(r.drawing).cuts || []).map(c => [rect(c), c.hoodOf]),
    [[[6, 20, -2, 4], 'roof-70']]);
  // THE CUT TAKES PAPER AWAY AND MOVES NO PLANE: the same height as the
  // uncut roof everywhere outside it, none inside.
  const G = win.DraftGeometry2D;
  const uncut = mainOf(d0), cutRoof = r.ok ? mainOf(r.drawing) : uncut;
  let moved = 0, kept = 0;
  for (let x = -21.75; x < 22; x += 0.5) {
    for (let z = -17.75; z < 18; z += 0.5) {
      const was = CV.sectionRoofHeightAt({ x, z }, uncut);
      const now = CV.sectionRoofHeightAt({ x, z }, cutRoof);
      if (x > 6 && x < 20 && z > -2 && z < 4) { if (now != null) kept += 1; continue; }
      if (was == null || now == null || Math.abs(was - now) > 1e-6) moved += 1;
    }
  }
  check('no roof is left inside the cut', kept, 0);
  check('and the rest of the main roof is exactly where it was', moved, 0);
  // A SEAM IS NOT AN EDGE: the face the cut splits keeps no line along the
  // cut's own z = -2 out past the wall at x 6, where the slope carries on.
  const faces = G.roofFaces(cutRoof, G.roofSkeleton(cutRoof));
  const strays = faces.flatMap(f => f.points.map((p, i) => ({ p, q: f.points[(i + 1) % f.points.length], seam: f.seams && f.seams[i] })))
    .filter(e => !e.seam && Math.abs(e.p.z + 2) < 1e-6 && Math.abs(e.q.z + 2) < 1e-6
      && Math.min(e.p.x, e.q.x) < 6 - 1e-6);
  check('a face split by the cut draws no seam across the slope', strays.length, 0);
  check('a ridge guide stops at the cut and carries on past it',
    G.cutRoofSegment({ a: { x: 0, z: 0 }, b: { x: 30, z: 0 } }, cutRoof)
      .map(s => [r3(s.a.x), r3(s.b.x)]), [[0, 6], [20, 30]]);
  // SAVED AND READ BACK, the cut is still there and still its roof's.
  const F = win.DraftDrawingFormat;
  const reread = r.ok ? F.roofs(r.drawing.roofs, new Set((r.drawing.levels || []).map(l => Number(l.id))))
    .find(x => x.id === 'roof-68') : null;
  check('a saved file keeps the cut', reread && (reread.cuts || []).map(c => [rect(c), c.hoodOf]),
    [[[6, 20, -2, 4], 'roof-70']]);
  check('only a MODIFIED BILEVEL\'s main roof is cut', rb.ok && (mainOf(rb.drawing).cuts || []).length, 0);
  const r2 = r.ok && E.pushEdge(r.drawing, { kind: 'roof', levelId: 7, loopIndex: at, edgeIndex: west.index, deltaFt: 1 }, hCtx(r.drawing));
  check('pushed back, the walls follow and are not doubled',
    r2 && r2.ok && r2.drawing.walls.filter(w => w.hoodOf === 'roof-70')
      .map(w => [w.start, w.end].map(p => [r3(p.x), r3(p.z)]).sort().join(' ')).sort(),
    [[[7, -2], [7, 4]], [[7, -2], [19, -2]], [[19, -16], [19, -2]], [[7, 4], [20, 4]]].map(x => x.sort().join(' ')).sort());
  check('pushed back, the cut follows and is not doubled',
    r2 && r2.ok && (mainOf(r2.drawing).cuts || []).map(rect), [[7, 20, -2, 4]]);
}

console.log(failed ? `\n${failed} check(s) FAILED, ${passed} passed` : `\nall ${passed} boneyard-edit checks passed`);
process.exit(failed ? 1 : 0);
