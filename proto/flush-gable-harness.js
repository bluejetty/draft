// proto/flush-gable-harness.js -- a gable runs flush past a step in its wall
//
// jb, 14 Nov 2026, a 2 STOREY whose front wall steps back a foot for its
// last six and a half, drawn by hand in HAND ROOF: the long front piece
// made GABLE, the foot of step and the short piece left eaves. The solver
// raised a plane off the one-foot eave, met the gable's own plane in a
// sliver ridge eight feet short of the real one, and wedged a hip over the
// stepped piece under it: "the front gable only likes to gable all the way
// across doesn't want to make a small gable". Busting the roof and deleting
// that hip triangle left the storey's wall line standing up through the
// roof. "the jogged back gable wall should be flush across ... not a line in
// the middle where the lower wall extends up".
//
// TWO RULES, both pinned here:
//   geometry-2d gableJogKinds -- a step of up to ROOF_GABLE_JOG_FT between
//   a solid edge and an eave running on the same way takes the step and the
//   eave with it: one GABLE, flush across (before, both sides had to be
//   solid already).
//   cut-view cornerTopAt -- the corner where a gable wall steps back is a
//   corner of the storey only: a parallel neighbour up to the jog limit
//   behind or in front lifts no crease into the gable. A wall running
//   ACROSS (the 45 of elevation-harness's clipped gable, a wing's side)
//   still does, and so does a parallel wall past the limit (a real wing).
//
// Run: node proto/flush-gable-harness.js            (checks)
//      node proto/flush-gable-harness.js --mutate   (checks + mutation table)
const path = require('path');
const { mutate: MUTATE, files } = require('./harness-args.js').mutationModeWithFiles();
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['a step beside one gable keeps its eave (both sides had to be solid)', 'geometry-2d.js',
    c => c.replace('        if (!before && !after) continue;', '        if (!before || !after) continue;')],
  ['the eave beyond the step keeps its kind; only the foot goes gable', 'geometry-2d.js',
    c => c.replace("        if (!before) out[(i + n - 1) % n] = 'gable';\n        if (!after) out[(i + 1) % n] = 'gable';\n", '')],
  ['the step corner climbs into the gable again', 'cut-view.js',
    c => c.replace('          if (!end || stepsPast(g)) return;', '          if (!end) return;')],
  ['a parallel wall any distance back is a step (a wing\'s corner lifts no crease)', 'cut-view.js',
    c => c.replace('        if (Math.abs(g.face.depth - face.depth) > jogFt + 0.05) return false;', '        return true;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('flush-gable-harness',
    MUTATIONS, { root: ROOT, harness: __filename, args: files });
  process.exit(all ? 0 : 1);
}

// jb's house: 19'-6" x 41'-6", two storeys, the front stepped back `jog`
// feet for its last 6'-6" (x 13 .. 19.5). The hand roof's eave ring is the
// wall ring pushed out 2 ft.
const W = (id, levelId, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' });
const wallsOf = (levelId, jog) => [
  W(`w${levelId}a`, levelId, [0, 0], [0, -41.5]), W(`w${levelId}b`, levelId, [0, -41.5], [19.5, -41.5]),
  W(`w${levelId}c`, levelId, [19.5, -41.5], [19.5, -jog]), W(`w${levelId}d`, levelId, [19.5, -jog], [13, -jog]),
  W(`w${levelId}e`, levelId, [13, -jog], [13, 0]), W(`w${levelId}f`, levelId, [13, 0], [0, 0])];
const ringOf = jog => [[-2, 2], [15, 2], [15, 2 - jog], [21.5, 2 - jog], [21.5, -43.5], [-2, -43.5]];
const ROOF = (edges, jog) => ({ id: 'roof-1', levelId: 7, sourceLevelId: 5, follows: 'none', pitch: 4, overhang: 2, fascia: 5.5,
  points: ringOf(jog).map(([x, z]) => ({ x, y: 0, z })), edges, edgeOverhang: edges.map(() => 2),
  footprint: [[0, 0], [13, 0], [13, -jog], [19.5, -jog], [19.5, -41.5], [0, -41.5]].map(([x, z]) => ({ x, y: 0, z })) });
const house = (edges, jog = 1) => ({
  version: 1, board: 'drafting', planTurn: 0, buildType: 'twoStorey', autoRoof: false,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 }, { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 1, nextDrawingItemId: 50,
  walls: [...wallsOf(3, jog), ...wallsOf(5, jog)],
  lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], roofs: [ROOF(edges, jog)],
});
const LONG = ['gable', 'eave', 'eave', 'eave', 'eave', 'eave'];      // the record as jb's panel left it
const SHORT = ['eave', 'eave', 'gable', 'eave', 'eave', 'eave'];     // the short piece pressed instead
const FLUSH = ['gable', 'gable', 'gable', 'eave', 'eave', 'eave'];   // what both mean
const PLATE = 17.25;   // top of the 2ND FL walls: 9 + 8 + the floor's own depth, read off the paint

const win = H.loadDraftModules();
const G = win.DraftGeometry2D;
const CHECKS = [];
const check = (label, ok, got) => CHECKS.push({ label, ok, got });
const K = kinds => kinds.map(k => k[0]).join('');
const pts = ring => ring.map(([x, z]) => ({ x, y: 0, z }));

// ── THE KINDS ──────────────────────────────────────────────────────────
check('one gable, the foot and the parallel eave beyond it go with it: flush across',
  K(G.gableJogKinds(pts(ringOf(1)), LONG)) === K(FLUSH), K(G.gableJogKinds(pts(ringOf(1)), LONG)));
check('the short piece pressed instead: the same flush gable',
  K(G.gableJogKinds(pts(ringOf(1)), SHORT)) === K(FLUSH), K(G.gableJogKinds(pts(ringOf(1)), SHORT)));
check('no gable at all: the step rule touches nothing',
  K(G.gableJogKinds(pts(ringOf(1)), LONG.map(() => 'eave'))) === 'eeeeee', K(G.gableJogKinds(pts(ringOf(1)), LONG.map(() => 'eave'))));
check('a step past the limit (8 ft) is a wing end: the gable stops at it',
  K(G.gableJogKinds(pts(ringOf(8)), LONG)) === K(LONG), K(G.gableJogKinds(pts(ringOf(8)), LONG)));
check('a sloped edge beyond the step is the roof\'s own business: untouched',
  K(G.gableJogKinds(pts(ringOf(1)), ['gable', 'eave', 'sloped', 'eave', 'eave', 'eave'])) === 'geseee',
  K(G.gableJogKinds(pts(ringOf(1)), ['gable', 'eave', 'sloped', 'eave', 'eave', 'eave'])));

// ── THE SOLVER: one ridge out to the front, nothing off the foot ───────
{
  const arcs = G.roofSkeleton(ROOF(LONG, 1));
  const ridge = arcs.filter(s => Math.abs(s.a.x - 9.75) < 0.01 && Math.abs(s.b.x - 9.75) < 0.01);
  const front = Math.max(...ridge.flatMap(s => [s.a.z, s.b.z]));
  check('the ridge sits mid-house (x 9.75) and runs out to the front gable (z 2)',
    ridge.length > 0 && Math.abs(front - 2) < 0.01, `ridge ${ridge.length} arc(s), front z ${front}`);
  const sliver = arcs.filter(s => Math.abs(s.a.x - 6.5) < 0.01 || Math.abs(s.b.x - 6.5) < 0.01);
  check('no sliver ridge at x 6.5 (the plane off the one-foot eave)', sliver.length === 0,
    sliver.map(s => `${s.a.x},${s.a.z}->${s.b.x},${s.b.z}`).join(' | ') || 'none');
}

// ── THE FRONT ELEVATION ────────────────────────────────────────────────
const paint = (saved, id) => {
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === id);
  const v = H.paintElevation(win, env, cut, {});
  const segs = [];
  v.strokes.forEach(s => s.pts.forEach((p, i) => {
    if (!i || p.move) return;
    const q = s.pts[i - 1];
    segs.push({ a: q, b: p, w: s.w, ink: s.ink });
  }));
  return segs;
};
const key = x => `${x.a.u.toFixed(2)},${x.a.e.toFixed(2)}->${x.b.u.toFixed(2)},${x.b.e.toFixed(2)} w${x.w} ${x.ink}`;
const fmt = xs => xs.map(key).join(' | ') || 'none';
// A wall line standing up through the gable: ink (not the fill's own
// paper-coloured seal), plumb at u, reaching above the plate.
const inkPlumbAt = (segs, u) => segs.filter(x => x.ink !== '#fff' && x.w >= 1.2
  && Math.abs(x.a.u - u) < 0.01 && Math.abs(x.b.u - u) < 0.01 && Math.max(x.a.e, x.b.e) > PLATE + 0.1);
{
  const e1 = paint(house(LONG), 'E1');
  check('E1: no wall line stands up through the gable at the step (u 13)', inkPlumbAt(e1, 13).length === 0, fmt(inkPlumbAt(e1, 13)));
  const corner = e1.filter(x => x.ink !== '#fff' && x.w >= 1.2 && Math.abs(x.a.u - 13) < 0.01 && Math.abs(x.b.u - 13) < 0.01);
  check('E1: the step is still a corner of the storeys under the plate',
    corner.length > 0 && Math.abs(Math.max(...corner.flatMap(x => [x.a.e, x.b.e])) - PLATE) < 0.05, fmt(corner));
  // The rake boards: every heavy sloped line lies on the gable's two rakes
  // through the apex -- one gable, flush, not a small one beside a hip.
  const apexE = Math.max(...e1.filter(x => x.w === 2.25).flatMap(x => [x.a.e, x.b.e]));
  const rakes = e1.filter(x => x.w === 2.25 && Math.abs(x.a.u - x.b.u) > 0.3 && Math.abs(x.a.e - x.b.e) > 0.3);
  const onRake = p => Math.abs(p.e - (apexE - Math.abs(p.u - 9.75) / 3)) < 0.03;
  check('E1: every rake board lies on the one gable\'s two rakes (eave to apex, both sides of x 9.75)',
    rakes.length >= 2 && rakes.every(x => onRake(x.a) && onRake(x.b))
      && Math.min(...rakes.flatMap(x => [x.a.u, x.b.u])) < -1.9 && Math.max(...rakes.flatMap(x => [x.a.u, x.b.u])) > 21.4,
    `apex ${apexE.toFixed(2)}; ${fmt(rakes)}`);
  // The record as saved by an older page (one gable) and the healed one
  // (three) paint alike: the drawing's roofs come healed (drawing-format.js
  // reads every record through gableJogKinds; model/17 heals the file too).
  const raw = new Set(e1.map(key)), healed = new Set(paint(house(FLUSH), 'E1').map(key));
  const onlyRaw = [...raw].filter(k => !healed.has(k)), onlyHealed = [...healed].filter(k => !raw.has(k));
  check('E1: the one-gable record paints stroke for stroke as the healed three-gable record',
    !onlyRaw.length && !onlyHealed.length,
    `only raw: ${onlyRaw.slice(0, 5).join(' | ') || 'none'}; only healed: ${onlyHealed.slice(0, 5).join(' | ') || 'none'}`);
  check('E1: the short piece pressed instead paints the same',
    (() => { const s = new Set(paint(house(SHORT), 'E1').map(key)); return s.size === raw.size && [...s].every(k => raw.has(k)); })(),
    'differs');
}
// ── A DEEPER STEP, 5 ft, still inside the limit ────────────────────────
{
  const raw = new Set(paint(house(LONG, 5), 'E1').map(key)), healed = new Set(paint(house(FLUSH, 5), 'E1').map(key));
  const onlyRaw = [...raw].filter(k => !healed.has(k)), onlyHealed = [...healed].filter(k => !raw.has(k));
  check('E1 of a 5 ft step: the one-gable record paints as the healed one (the stepped piece climbs its rake too)',
    !onlyRaw.length && !onlyHealed.length,
    `only raw: ${onlyRaw.slice(0, 5).join(' | ') || 'none'}; only healed: ${onlyHealed.slice(0, 5).join(' | ') || 'none'}`);
  const e1 = paint(house(LONG, 5), 'E1');
  check('E1 of a 5 ft step: no wall line up through the gable at u 13', inkPlumbAt(e1, 13).length === 0, fmt(inkPlumbAt(e1, 13)));
}
// ── A WING, NOT A STEP: 8 ft back, both pieces gable by hand ───────────
{
  const e1 = paint(house(['gable', 'eave', 'gable', 'eave', 'eave', 'eave'], 8), 'E1');
  check('E1 of an 8 ft step: the corner at u 13 still climbs into the gable (a wing\'s corner is a crease)',
    inkPlumbAt(e1, 13).length > 0, fmt(inkPlumbAt(e1, 13)));
}

const failed = CHECKS.filter(c => !c.ok);
failed.forEach(c => console.log(`FAIL  ${c.label}\n      got  ${c.got}`));
console.log(`\n${CHECKS.length - failed.length}/${CHECKS.length} checks passed`);
if (failed.length) process.exitCode = 1;
