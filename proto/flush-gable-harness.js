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
// THE RULE, pinned here: geometry-2d gableJogKinds -- a step of up to
// ROOF_GABLE_JOG_FT between a solid edge and an eave running on the same
// way takes the step and the eave with it: one GABLE press, the roof flush
// across (before, both sides had to be solid already). jb, later that day,
// on seeing it: "the front gable and the further back gable ... the front
// line should go up to the bottom roof". So the gable end stepped is TWO
// gable walls a foot apart under one roof, and in the elevation the front
// one's edge at the step is a corner the whole way up to the rake's
// underside (cut-view cornerTopAt, the rule the clipped gable's 45 corner
// set): PR #1010's cap at the plate is undone, and this pins the climb.
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
  ['the peak is no station: the wall top runs flat under the apex', 'cut-view.js',
    c => c.replace('      if (tops.length < 4) return tops;', '      return tops;')],
  ['a rake ending at a JOINT hangs a soffit return', 'cut-view.js',
    c => c.replace("const noSoffit = k => edgeKind(k) === 'gable' || edgeKind(k) === 'joint';",
      "const noSoffit = k => edgeKind(k) === 'gable';")],
  ['the seam between a gable wall and its rake board shows what lies on it', 'cut-view.js',
    c => c.replace('        return u != null && behindWall(pt, u, elev - SEAM_PROBE_FT)', '        return false && behindWall(pt, u, elev - SEAM_PROBE_FT)')],
  ['a step in the roofline is joined station to station', 'cut-view.js',
    c => c.replace('        if (!coarse && prev && prev.elev != null', '        if (false && prev && prev.elev != null')],
  ['the small gable has no JOINT at its back (it raises a plane off it)', 'geometry-2d.js',
    c => c.replace("let smallKinds = [K[at(i - 1)], 'eave', 'joint', K[at(i - 2)]];", "let smallKinds = [K[at(i - 1)], 'eave', 'eave', K[at(i - 2)]];")
      .replace("smallKinds = [K[at(i - 1)], 'eave', 'joint', 'joint', 'joint', K[at(i - 2)]];", "smallKinds = [K[at(i - 1)], 'eave', 'eave', 'eave', 'eave', K[at(i - 2)]];")],
  ['a rake\'s foot is drawn the whole run, through what stands in front', 'cut-view.js',
    c => c.replace("const footShows = t => { const q = at(t); return !hidden(q.p, q.e, q.u); };", "const footShows = () => true;")],
  ['the wall that sticks out climbs to the big rake over the small gable', 'cut-view.js',
    c => c.replace('      if (jog) top = Math.max(top, jog.top);', '      if (false) top = Math.max(top, jog.top);')
      .replace("const jogFront = jog ? new Set([String(jog.skip)]) : null;", 'const jogFront = null;')],
  ['a file without jogOf: the small piece is not found by its JOINT', 'cut-view.js',
    c => c.replace('          if (partner == null) {\n            facesByRoof.forEach((_, other) => {', '          if (partner == null) { return;\n            facesByRoof.forEach((_, other) => {')],
  ['the small piece is not tucked back over the jog-out', 'geometry-2d.js',
    c => c.replace('        if (backBy > 1e-3) {', '        if (false) {')],
  ['an arc running on along a JOINT is kept whole (the tucked piece cannot be faced)', 'geometry-2d.js',
    c => c.replace('    if (notched) return arcsOffSolidEdges(notched, solidEdgesOf(roof));', '    if (notched) return notched;')
      .replace('      return arcsOffSolidEdges(roofSkeleton(stepped.roof).flatMap(seg => cutRoofSegment(seg, { cuts: stepped.cuts })),\n        solidEdgesOf(roof));',
        '      return roofSkeleton(stepped.roof).flatMap(seg => cutRoofSegment(seg, { cuts: stepped.cuts }));')],
  ['the gable wall over a lower roof is not told apart', 'geometry-2d.js',
    c => c.replace('      if (!rings.some(ring => ringInside(mid, ring))) continue;', '      continue;')],
  ['a reopened file drops jogOf', 'drawing-format.js',
    c => c.replace("          ? { jogOf: String(roof.jogOf).trim() } : {}),", '          ? {} : {}),')],
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
  // The rake's underside at the step: the rake board's foot line (its
  // apex) less a third a foot over the 3.25 ft from the ridge.
  const corner = inkPlumbAt(e1, 13);
  const cornerTop = Math.max(...corner.flatMap(x => [x.a.e, x.b.e]));
  const rakeUnder = e1.filter(x => x.w === 2.25).reduce((m, x) => Math.max(m, x.a.e, x.b.e), 0) - 3.25 / 3;
  check('E1: the front gable wall\'s edge at the step runs up to the rake\'s underside (two gable walls, a foot apart)',
    corner.length > 0 && Math.abs(cornerTop - rakeUnder) < 0.05, `top ${cornerTop.toFixed(2)}, rake underside ${rakeUnder.toFixed(2)}: ${fmt(corner)}`);
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
  check('E1 of a 5 ft step: the corner at u 13 climbs into the gable too', inkPlumbAt(e1, 13).length > 0, fmt(inkPlumbAt(e1, 13)));
}

// ── THE WALL REACHES THE PEAK ──────────────────────────────────────────
//
// jb, 14 Nov 2026: "right at the top under the peak fascia the wall doesn't
// get high enough you can see a little triangle on front and back". The
// ridge (u 9.75) falls between two half-foot stations, and the wall top ran
// flat between them a sixth of a foot under the rake's underside. Now the
// bend is a station of its own (cut-view peakStations): no level ink near
// the apex, front and back, whole roof and busted pieces alike.
{
  const flatUnderApex = segs => {
    const apexE = Math.max(...segs.filter(x => x.w === 2.25).flatMap(x => [x.a.e, x.b.e]));
    return segs.filter(x => x.ink !== '#fff' && Math.abs(x.a.e - x.b.e) < 0.01
      && Math.abs(x.a.u - x.b.u) > 0.05 && x.a.e > apexE - 1
      && [x.a.u, x.b.u].every(u => Math.abs(u) > 8.5 && Math.abs(u) < 11));   // E3 looks back: u runs negative
  };
  const busted = saved => ({ ...saved, roofs: G.roofPieces(saved.roofs[0]).map((r, i) => ({ ...r, id: `roof-p${i}` })) });
  const ENDS = ['gable', 'eave', 'eave', 'eave', 'gable', 'eave'];
  [['E1', house(ENDS)], ['E3', house(ENDS)], ['E1', busted(house(ENDS))], ['E3', busted(house(ENDS))]]
    .forEach(([cut, saved], k) => {
      const flat = flatUnderApex(paint(saved, cut));
      check(`${cut}${k > 1 ? ' (busted pieces)' : ''}: the gable wall climbs to the peak, no flat top under the apex`,
        flat.length === 0, fmt(flat));
    });
}

// ── JB'S HAND ROOF: THREE PIECES OVER THE STEP ─────────────────────────
//
// jb, 14 Nov 2026, the same house roofed by hand: the big roof as two
// pieces meeting at the ridge (x 9.75), the left one notched at the front,
// and a small front piece whose peak (x 6.5) meets the left piece's slope
// and which falls to an eave at x 15 -- a little gable in front of the big
// one. "some minor problems with the roof still":
//   E1  a level line from the small peak two feet across the big gable wall
//       (a soffit return off the rake's foot, where the foot is a JOINT);
//   E3  a tick of the front piece's rake poking through the back rake board
//       under the peak (a run end bisected onto the seam between the gable
//       wall's top and the board's foot, which neither cover took);
//   E4  the top of the fascia band stepping down on a slant where the big
//       roof stops and the front pieces carry on (two silhouette stations
//       joined across the step).
{
  const P = pts => pts.map(([x, z]) => ({ x, y: 0, z }));
  const piece = (id, ring, edges) => ({ id, levelId: 7, follows: 'none', pitch: 4, overhang: 2, fascia: 5.5,
    points: P(ring), edges, edgeOverhang: edges.map((k, i) => (i ? 0 : 2)) });
  const hand = { ...house(LONG), roofs: [
    piece('roof-66', [[-2, 2], [-2, -43.5], [9.75, -43.5], [9.75, 1], [6.5, 1], [6.5, 2]],
      ['eave', 'gable', 'joint', 'gable', 'joint', 'gable']),
    piece('roof-68', [[21.5, -43.5], [21.5, 1], [9.75, 1], [9.75, -43.5]], ['eave', 'gable', 'joint', 'gable']),
    piece('roof-70', [[15, -1], [15, 2], [6.5, 2], [6.5, -1]], ['eave', 'gable', 'joint', 'gable']),
  ] };
  const inked = segs => segs.filter(x => x.ink !== '#fff' && x.ink !== 'rgba(255,255,255,1)');
  {
    const level = inked(paint(hand, 'E1')).filter(x => Math.abs(x.a.e - x.b.e) < 0.01 && x.a.e > 19.5
      && Math.min(x.a.u, x.b.u) >= 6.4 && Math.max(x.a.u, x.b.u) <= 9 && Math.abs(x.a.u - x.b.u) > 0.5);
    check('hand roof E1: no level line off the small peak (a rake ending at a JOINT has no soffit return)',
      level.length === 0, fmt(level));
  }
  {
    // From the back u = -x. The back rakes climb toward the ridge (u -9.75);
    // anything near u -6.5..-7.5 up there falling the OTHER way is the front
    // piece's rake showing through.
    const tick = inked(paint(hand, 'E3')).filter(x => {
      const lo = Math.min(x.a.u, x.b.u), hi = Math.max(x.a.u, x.b.u);
      if (lo < -7.6 || hi > -6.3 || hi - lo < 0.1 || Math.max(x.a.e, x.b.e) < 19.5) return false;
      return (x.b.e - x.a.e) / (x.b.u - x.a.u) > 0.1;
    });
    check('hand roof E3: the front piece\'s rake does not poke through the back rake board',
      tick.length === 0, fmt(tick));
  }
  {
    // The big roof stops at z 1 (E4: u -1); past it the front pieces are
    // a foot lower. The step is plumb: no segment crosses it on a slant.
    const slant = inked(paint(hand, 'E4')).filter(x => {
      const lo = Math.min(x.a.u, x.b.u), hi = Math.max(x.a.u, x.b.u);
      return lo < -0.95 && hi > -1.15 && hi - lo > 0.05 && hi - lo < 1
        && Math.abs(x.a.e - x.b.e) > 0.5 && Math.min(x.a.e, x.b.e) > 20;
    });
    check('hand roof E4: the roofline steps down plumb where the big roof stops', slant.length === 0, fmt(slant));
  }
}

// ── TWO GABLES (jb, 15 Nov 2026: "can you make it 2 seperate gables ?") ───
//
// geometry-2d gableJogPieces: the big gable on the stepped-back line across
// the whole house, a small lower one over the part that sticks out, peaking
// at its own middle. What a GABLE press on the stepped end now makes (model/15
// splitJogGable); E1 shows two peaks, the small one in front and lower.
{
  const both = [ringOf(1).map(([x, z]) => ({ x, y: 0, z }))].map(pts => pts)[0];
  [['as drawn', both, LONG], ['wound the other way', both.slice().reverse(), LONG.slice(0, 5).reverse().concat(LONG[5])]]
    .forEach(([how, pts, kinds]) => {
      // Reversed: edge k of the reversed ring is old edge n-2-k.
      const n = pts.length;
      const k2 = how === 'as drawn' ? kinds : pts.map((_, k) => LONG[((n - 2 - k) % n + n) % n]);
      const split = G.gableJogSplit(pts, k2);
      const box = ring => ring.map(p => `${p.x},${p.z}`).sort().join(' ');
      check(`two gables (${how}): the big roof stops on the stepped-back line, the small one is the part that sticks out`,
        !!split && box(split.big) === box([{ x: -2, z: 1 }, { x: 21.5, z: 1 }, { x: 21.5, z: -43.5 }, { x: -2, z: -43.5 }])
          && box(split.small) === box([{ x: -2, z: 2 }, { x: 15, z: 2 }, { x: 15, z: 1 }, { x: -2, z: 1 }])
          && split.smallKinds.slice().sort().join() === 'eave,eave,gable,joint'
          && split.bigKinds.filter(k => k === 'gable').length === 1,
        split ? `${box(split.big)} | ${box(split.small)} ${split.smallKinds}` : 'no split');
    });
  const pieces = G.gableJogPieces(ROOF(LONG, 1));
  const two = { ...house(LONG), roofs: [{ ...pieces.big, id: 'roof-1' }, { ...pieces.small, id: 'roof-2', jogOf: 'roof-1' }] };
  const e1 = paint(two, 'E1');
  const heavy = e1.filter(x => x.w === 2.25 && Math.abs(x.a.u - x.b.u) > 0.3 && Math.abs(x.a.e - x.b.e) > 0.3);
  const apexAt = u => heavy.some(x => [x.a, x.b].some(p => Math.abs(p.u - u) < 0.05));
  const top = u => Math.max(...heavy.flatMap(x => [x.a, x.b]).filter(p => Math.abs(p.u - u) < 0.05).map(p => p.e));
  check('two gables, E1: two peaks, the big one mid-house (u 9.75) and the small one over the front piece (u 6.5), lower',
    apexAt(9.75) && apexAt(6.5) && top(6.5) < top(9.75) - 0.5,
    `peaks 9.75: ${apexAt(9.75) && top(9.75).toFixed(2)}, 6.5: ${apexAt(6.5) && top(6.5).toFixed(2)}`);
  // jb, 15 Nov: "the top chord bottom line of the top roof goes through the
  // bottom roof fascia". The big rake's foot (heavy, rising from the small
  // peak toward 9.75) stops where it goes behind the small gable's rake board.
  const bigFoot = heavy.filter(x => x.b.u !== x.a.u && (x.b.e - x.a.e) / (x.b.u - x.a.u) > 0.2
    && Math.max(x.a.u, x.b.u) > 9 && Math.max(x.a.u, x.b.u) < 10);
  const lowEnd = Math.min(...bigFoot.flatMap(x => [x.a.u, x.b.u]));
  check('two gables, E1: the big rake\'s heavy foot stops at the small gable\'s rake board (u ~7.15), not through it to the peak',
    bigFoot.length > 0 && lowEnd > 7.0, `low end u ${lowEnd.toFixed(2)}`);
  // jb, 15 Nov: "front has the line that extends up from lower roof to
  // upper roof which should be just white". The wall that sticks out carries
  // the small gable: its step corner stops under the small rake (17.93 at
  // u 13), not up the big gable's face to the big rake (20.08). Also when
  // the file has lost the small piece's `jogOf` (found by its JOINT).
  const smallUnder = 17.93;   // the small rake's underside at u 13, read off the paint
  [['named', two], ['unnamed', { ...two, roofs: two.roofs.map(({ jogOf: _j, ...r }) => r) }]].forEach(([how, saved]) => {
    const corner = inkPlumbAt(paint(saved, 'E1'), 13);
    const cTop = Math.max(...corner.flatMap(x => [x.a.e, x.b.e]));
    check(`two gables, E1 (${how}): the step corner stops under the small rake, no line up the big gable`,
      corner.length > 0 && cTop < 18.2, `corner top ${cTop.toFixed(2)} (small rake ~${smallUnder.toFixed(2)}): ${fmt(corner)}`);
  });
  // jb, 15 Nov: "should cover overtop of the jog out and go to the larger
  // gable wall". From its peak (x 6.5) to the step side the small piece runs
  // on back to the big gable's wall line (z -1); the other half stops at the
  // big roof's edge (z 1), where its plane is the big roof's own.
  {
    const sm = pieces.small;
    const box = ring => ring.map(p => `${p.x},${p.z}`).sort().join(' ');
    check('two gables: the small piece runs back over the jog-out to the big gable wall from its peak',
      box(sm.points) === box([{ x: -2, z: 2 }, { x: 15, z: 2 }, { x: 15, z: -1 }, { x: 6.5, z: -1 }, { x: 6.5, z: 1 }, { x: -2, z: 1 }])
        && sm.edges.slice().sort().join() === 'eave,eave,gable,joint,joint,joint',
      `${box(sm.points)} ${sm.edges}`);
    const area = pts => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.z - q.x * p.z; }, 0)) / 2;
    const arcs = G.roofSkeleton(sm);
    const faces = G.roofFaces(sm, arcs);
    const covered = faces.reduce((a, f) => a + area(f.points), 0);
    check('two gables: the tucked piece solves -- its ridge stops at the big roof\'s edge, two planes cover it',
      faces.length === 2 && Math.abs(covered - area(sm.points)) < 1e-6
        && arcs.length === 1 && Math.min(arcs[0].a.z, arcs[0].b.z) > 0.99,
      `${faces.length} faces, ${covered.toFixed(2)} of ${area(sm.points).toFixed(2)}; arcs ${arcs.map(x => `${x.a.x},${x.a.z}->${x.b.x},${x.b.z}`).join(' ')}`);
    // ROOF plan (jb, 15 Nov: "show the back gable wall on the roof plan maybe
    // grey or dotted"): the big gable's wall line over the tuck is a hidden wall.
    const big = pieces.big;
    const wallRing = G.offsetOutlineVariable(big.points.map(p => ({ x: p.x, z: p.z })), big.edgeOverhang.map(v => -v));
    const spans = G.gableWallOverSpans(big, [big, sm], wallRing);
    const g = big.edges.indexOf('gable');
    const wa = wallRing[g], wb = wallRing[(g + 1) % wallRing.length];
    const xs = (spans[g] || []).map(([t0, t1]) => [wa.x + (wb.x - wa.x) * t0, wa.x + (wb.x - wa.x) * t1].sort((p, q) => p - q));
    check('ROOF plan: the big gable wall line is hidden (dashed) where it stands over the tuck, x 6.5 to 15, solid elsewhere',
      xs.length === 1 && Math.abs(xs[0][0] - 6.5) < 1e-3 && Math.abs(xs[0][1] - 15) < 1e-3,
      JSON.stringify(xs));
  }
  // A reopened file keeps the pair: drawing-format keeps `jogOf` and `flushOf`.
  const F = win.DraftDrawingFormat;
  if (F && typeof F.roofs === 'function') {
    const flat = { ...ROOF(FLUSH, 1) };
    const [b0, b1] = F.roofs([{ ...two.roofs[0], flushOf: flat }, two.roofs[1]], new Set([3, 5, 7]));
    check('two gables: a reopened file keeps jogOf on the small piece and flushOf on the big one',
      b1 && b1.jogOf === 'roof-1' && b0 && b0.flushOf && b0.flushOf.points.length === 6,
      `jogOf ${b1 && b1.jogOf}, flushOf ${b0 && b0.flushOf ? b0.flushOf.points.length + ' points' : 'none'}`);
  } else check('drawing-format reachable', false, Object.keys(win).filter(k => /Format/.test(k)).join());
}

const failed = CHECKS.filter(c => !c.ok);
failed.forEach(c => console.log(`FAIL  ${c.label}\n      got  ${c.got}`));
console.log(`\n${CHECKS.length - failed.length}/${CHECKS.length} checks passed`);
if (failed.length) process.exitCode = 1;
