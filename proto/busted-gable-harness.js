#!/usr/bin/env node
// A BUSTED ROOF'S PIECES DRAW AS THE ROOF DID (jb, 13 Nov 2026).
//
// jb busted the autohouse's hip, deleted its front slope, lined the pieces
// up with construction lines, and E2 was "messed up the same way": "its not
// used to allowing the bust", "it knew how to draw gable roofs nicely
// before". Two painter faults, both in cut-view.js's elevation:
//
//   AN ORPHAN JOINT IS A GABLE     the pieces' front edges were still JOINT
//                                  edges with no piece beside them, drawn as
//                                  a bare line where a gable draws its rake
//                                  boards and gable wall (edgeKindOf)
//   NO CREASE UNDER THE RIDGE      every polygon corner creased the fascia,
//                                  so joint-meets-joint at the ridge end hung
//                                  5.5" of board at eave height under a ridge
//                                  4 ft up (the crease pass)
//
// Fixtures are a 20 x 40 bungalow box. GABLE: two pieces sharing the ridge
// at x = 10, their front and back edges orphan joints (the deleted slopes).
// HIP: three pieces, the back one a triangle, every joint shared. APART: the
// hip's back triangle moved 1 ft back, so the two hip joints have lost it.
//
// Run: node proto/busted-gable-harness.js            (checks)
//      node proto/busted-gable-harness.js --mutate   (checks + mutation table)
const path = require('path');
const { mutate: MUTATE, files } = require('./harness-args.js').mutationModeWithFiles();
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['every joint reads as shared: an orphan joint stays a bare line', 'cut-view.js',
    c => c.replace("      return jointShared(roof, pts[k], pts[(k + 1) % n]) ? 'joint' : 'gable';",
      "      return 'joint';")],
  ['no joint reads as shared: the ridge itself wears rakes', 'cut-view.js',
    c => c.replace("      return jointShared(roof, pts[k], pts[(k + 1) % n]) ? 'joint' : 'gable';",
      "      return 'gable';")],
  ['shared is judged with a 10 ft slack, so a piece moved away still joins', 'cut-view.js',
    c => c.replace('        return geo().pointToSegment(a, seg).d < 0.1 && geo().pointToSegment(b, seg).d < 0.1;',
      '        return geo().pointToSegment(a, seg).d < 10 && geo().pointToSegment(b, seg).d < 10;')],
  ['a joint corner creases the fascia again', 'cut-view.js',
    c => c.replace("          if (kindPrev !== 'eave' && kindNext !== 'eave' && (kindPrev === 'joint' || kindNext === 'joint')) return;\n", '')],
  ['no corner with a joint on either side creases, the eave\'s own end included', 'cut-view.js',
    c => c.replace("          if (kindPrev !== 'eave' && kindNext !== 'eave' && (kindPrev === 'joint' || kindNext === 'joint')) return;",
      "          if (kindPrev === 'joint' || kindNext === 'joint') return;")],
  ['the rake pass reads the file\'s kind, not the effective one', 'cut-view.js',
    c => c.replace("        const gableSegs = rpts.flatMap((a, i) => {\n          if (edgeKindOf(roof, i) !== 'gable') return [];",
      "        const gableSegs = rpts.flatMap((a, i) => {\n          if (roof.edges?.[i] !== 'gable') return [];")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('busted-gable-harness',
    MUTATIONS, { root: ROOT, harness: __filename, args: files });
  process.exit(all ? 0 : 1);
}

const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center' });
const ROOF = (id, pts, edges) => ({ id, levelId: 7, follows: 'none', pitch: 4, overhang: 2, fascia: 5.5,
  points: pts.map(([x, z]) => ({ x, y: 0, z })), edges, edgeOverhang: edges.map(e => (e === 'eave' ? 2 : 0)) });
const drawing = roofs => ({
  version: 1, board: 'drafting', planTurn: 0, buildType: 'bungalow', autoRoof: false,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1, nextDrawingItemId: 50,
  walls: [W('w1', [0, 0], [20, 0]), W('w2', [20, 0], [20, -40]), W('w3', [20, -40], [0, -40]), W('w4', [0, -40], [0, 0])],
  lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], roofs,
});
// The same gable as ONE roof record, the way the autohouse draws it.
const ONE = () => drawing([ROOF('r', [[-2, 2], [22, 2], [22, -42], [-2, -42]], ['gable', 'eave', 'gable', 'eave'])]);
const GABLE = () => drawing([
  ROOF('ra', [[-2, 2], [10, 2], [10, -42], [-2, -42]], ['joint', 'joint', 'joint', 'eave']),
  ROOF('rb', [[10, 2], [22, 2], [22, -42], [10, -42]], ['joint', 'eave', 'joint', 'joint'])]);
const HIP = () => drawing([
  ROOF('ra', [[-2, 2], [10, 2], [10, -30], [-2, -42]], ['joint', 'joint', 'joint', 'eave']),
  ROOF('rb', [[10, 2], [22, 2], [22, -42], [10, -30]], ['joint', 'eave', 'joint', 'joint']),
  ROOF('rc', [[-2, -42], [22, -42], [10, -30]], ['eave', 'joint', 'joint'])]);
const APART = () => drawing([
  ROOF('ra', [[-2, 2], [10, 2], [10, -30], [-2, -42]], ['joint', 'joint', 'joint', 'eave']),
  ROOF('rb', [[10, 2], [22, 2], [22, -42], [10, -30]], ['joint', 'eave', 'joint', 'joint']),
  ROOF('rc', [[-2, -43], [22, -43], [10, -31]], ['eave', 'joint', 'joint'])]);

const win = H.loadDraftModules();
const CHECKS = [];
const check = (label, ok, got) => CHECKS.push({ label, ok, got });
const FASCIA_FT = 5.5 / 12;

// Every elevation's strokes as segments in feet: u along the cut, e up.
const paint = (saved, id) => {
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === id);
  const v = H.paintElevation(win, env, cut, {});
  const segs = [];
  v.strokes.forEach(s => s.pts.forEach((p, i) => {
    if (!i || p.move) return;
    const q = s.pts[i - 1];
    segs.push({ a: q, b: p, w: s.w });
  }));
  return segs;
};
// A rake board: the heavy sloped line 5.5" under a gable edge.
const rakes = segs => segs.filter(x => x.w === 2.25 && Math.abs(x.a.u - x.b.u) > 0.3 && Math.abs(x.a.e - x.b.e) > 0.3);
// A fascia crease: the thin plumb seam, one board tall, at u.
const creases = segs => segs.filter(x => x.w === 1.25 && Math.abs(x.a.u - x.b.u) < 0.01
  && Math.abs(Math.abs(x.a.e - x.b.e) - FASCIA_FT) < 0.02);
const creasesAt = (segs, u) => creases(segs).filter(x => Math.abs(x.a.u - u) < 0.05);
const fmt = xs => xs.map(x => `${x.a.u.toFixed(2)},${x.a.e.toFixed(2)}->${x.b.u.toFixed(2)},${x.b.e.toFixed(2)}`).join(' | ') || 'none';
// Heavy level lines (eave feet, fascia bands) at a height, long enough to be a run.
const levelHeavyAt = (segs, e) => segs.filter(x => x.w === 2.25 && Math.abs(x.a.e - e) < 0.05
  && Math.abs(x.b.e - e) < 0.05 && Math.abs(x.a.u - x.b.u) > 2);

// ── THE WHOLE CLAIM: THE PIECES PAINT AS THE ONE ROOF DID ────────────────
// "it knew how to draw gable roofs nicely before": every elevation of the
// two-piece gable is, stroke for stroke, the one-record gable's.
['E1', 'E2', 'E3', 'E4'].forEach(id => {
  const key = x => `${x.a.u.toFixed(2)},${x.a.e.toFixed(2)}->${x.b.u.toFixed(2)},${x.b.e.toFixed(2)} w${x.w}`;
  const one = new Set(paint(ONE(), id).map(key));
  const two = new Set(paint(GABLE(), id).map(key));
  const onlyOne = [...one].filter(k => !two.has(k)), onlyTwo = [...two].filter(k => !one.has(k));
  check(`${id}: the two-piece gable paints stroke for stroke as the one-record gable`,
    !onlyOne.length && !onlyTwo.length,
    `only the one roof: ${onlyOne.slice(0, 6).join(' | ') || 'none'}; only the pieces: ${onlyTwo.slice(0, 6).join(' | ') || 'none'}`);
});

// ── THE GABLE, SEEN FROM ITS ENDS (E1 front, E3 back) ───────────────────
['E1', 'E3'].forEach(id => {
  const segs = paint(GABLE(), id);
  const r = rakes(segs);
  check(`GABLE ${id}: the orphan joint edges wear two rake boards, one up each slope`,
    r.length === 2 && r.some(x => Math.min(x.a.e, x.b.e) < Math.max(x.a.e, x.b.e)), fmt(r));
  const ridgeU = id === 'E1' ? 10 : -10;
  check(`GABLE ${id}: no fascia crease under the ridge (joint meets joint at u ${ridgeU})`,
    creasesAt(segs, ridgeU).length === 0, fmt(creasesAt(segs, ridgeU)));
  const ends = id === 'E1' ? [-2, 22] : [2, -22];
  check(`GABLE ${id}: the two eaves' ends still crease (eave meets gable)`,
    ends.every(u => creasesAt(segs, u).length > 0), ends.map(u => `${u}: ${creasesAt(segs, u).length}`).join(', '));
});
// ── AND FROM THE SIDE (E2): the shared ridge is a ridge, not a gable ────
{
  const segs = paint(GABLE(), 'E2');
  const ridgeE = Math.max(...segs.flatMap(x => [x.a.e, x.b.e]).filter(Number.isFinite));
  check('GABLE E2: the shared ridge joint wears no rake board (no heavy line 5.5" under the ridge)',
    rakes(segs).length === 0 && levelHeavyAt(segs, ridgeE - FASCIA_FT).length === 0,
    `rakes ${fmt(rakes(segs))}; heavy level at ${(ridgeE - FASCIA_FT).toFixed(2)}: ${levelHeavyAt(segs, ridgeE - FASCIA_FT).length}`);
  check('GABLE E2: the eave\'s two ends crease and nothing between them does',
    creasesAt(segs, 2).length > 0 && creasesAt(segs, -42).length > 0
      && creases(segs).every(x => Math.abs(x.a.u - 2) < 0.05 || Math.abs(x.a.u + 42) < 0.05),
    fmt(creases(segs)));
}
// ── THE HIP: a shared hip joint is no gable, and its outer corner creases ─
{
  const front = paint(HIP(), 'E1');
  check('HIP E1: the orphan front joints wear rakes; the shared hips wear none (two boards, not four)',
    rakes(front).length === 2, fmt(rakes(front)));
  const side = paint(HIP(), 'E2');
  check('HIP E2: no rake on the side (the hip joints are shared)', rakes(side).length === 0, fmt(rakes(side)));
  check('HIP E2: the hip corner at the back (eave meets a shared joint) still creases',
    creasesAt(side, -42).length > 0, fmt(creasesAt(side, -42)));
  const back = paint(HIP(), 'E3');
  check('HIP E3: the back triangle\'s eave shows no rake and no crease under its apex',
    rakes(back).length === 0 && creasesAt(back, -10).length === 0, `rakes ${fmt(rakes(back))}; apex creases ${fmt(creasesAt(back, -10))}`);
  // A shared hip read as a gable hangs a gable wall's seam under the apex.
  const plumb = back.filter(x => Math.abs(x.a.u + 10) < 0.05 && Math.abs(x.b.u + 10) < 0.05 && Math.max(x.a.e, x.b.e) > 8.2);
  check('HIP E3: nothing hangs under the apex (the shared hips are no gables)', plumb.length === 0, fmt(plumb));
}
// ── APART: a piece moved off its neighbour has lost its joint ───────────
{
  // The hips' joints have nothing along them now (the triangle is a foot
  // back), so from the front they are gable edges and wear rakes: four
  // boards, the front pair and the hip pair, where the HIP showed two.
  const segs = paint(APART(), 'E1');
  check('APART E1: the hip joints whose triangle moved a foot back are gables now (four rake boards)',
    rakes(segs).length === 4, fmt(rakes(segs)));
}

const failed = CHECKS.filter(c => !c.ok);
failed.forEach(c => console.log(`FAIL  ${c.label}\n      got  ${c.got}`));
console.log(`\n${CHECKS.length - failed.length}/${CHECKS.length} checks passed`);
if (failed.length) process.exitCode = 1;
