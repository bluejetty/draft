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
// jb, 15 Nov 2026, the next morning: "when i switch the hip to gable it
// changes BOTH hips to gables, sometimes i'd like only one to be hip and the
// other to be gable". So a press now changes the piece pressed and no more
// (model/15 jogEndPress cuts the roof into the pieces that say so); running
// on past the step is what GABLE END and the autoroof ask for (`runPast`).
// The flush roof below is the one GABLE END / ONE FLUSH GABLE make.
//
// Run: node proto/flush-gable-harness.js            (checks)
//      node proto/flush-gable-harness.js --mutate   (checks + mutation table)
const path = require('path');
const { mutate: MUTATE, files } = require('./harness-args.js').mutationModeWithFiles();
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['GABLE END / the autoroof: a step beside one gable keeps its eave', 'geometry-2d.js',
    c => c.replace('        if (!before && !after) continue;', '        if (!before || !after) continue;')],
  ['a press on one piece runs on past the step (both pieces go gable)', 'geometry-2d.js',
    c => c.replace('        if (!runPast && (!before || !after)) continue;\n', '')],
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
    c => c.replace("const footShows = t => { const q = at(t); return !hidden(q.p, q.e, q.u, roof); };", "const footShows = () => true;")],
  ['the wall that sticks out climbs to the big rake over the small gable', 'cut-view.js',
    c => c.replace('      if (jog) top = Math.max(top, jog.top);', '      if (false) top = Math.max(top, jog.top);')
      .replace("const jogFront = jog ? new Set([String(jog.skip)]) : null;", 'const jogFront = null;')],
  ['a file without jogOf: the small piece is not found by its JOINT', 'cut-view.js',
    c => c.replace('          if (partner == null) {\n            facesByRoof.forEach((_, other) => {', '          if (partner == null) { return;\n            facesByRoof.forEach((_, other) => {')],
  ['the small piece is not tucked back over the jog-out', 'geometry-2d.js',
    c => c.replace('        } else if (backBy > 1e-3) {', '        } else if (false) {')],
  ['an arc running on along a JOINT is kept whole (the tucked piece cannot be faced)', 'geometry-2d.js',
    c => c.replace('    if (notched) return arcsOffSolidEdges(notched, solidEdgesOf(roof));', '    if (notched) return notched;')
      .replace('      return arcsOffSolidEdges(roofSkeleton(stepped.roof).flatMap(seg => cutRoofSegment(seg, { cuts: stepped.cuts })),\n        solidEdgesOf(roof));',
        '      return roofSkeleton(stepped.roof).flatMap(seg => cutRoofSegment(seg, { cuts: stepped.cuts }));')],
  ['the gable wall over a lower roof is not told apart', 'geometry-2d.js',
    c => c.replace('      if (!rings.some(ring => ringInside(mid, ring))) continue;', '      continue;')],
  ['the part in front pressed alone is cut as two gables (no hipped piece)', 'geometry-2d.js',
    c => c.replace("        if (mode === 'hipBump') {", '        if (false) {')],
  ['the small gable runs no further back than the stepped-back line (no valleys)', 'geometry-2d.js',
    c => c.replace("          small = [A, B, C, apex, farIn];", '          small = [A, B, C, farIn];')
      .replace("          smallKinds = [K[at(i - 1)], 'eave', 'joint', 'joint', K[at(i - 2)]];", "          smallKinds = [K[at(i - 1)], 'eave', 'joint', K[at(i - 2)]];")
      .replace("          smallFrom = [edgeIdx[at(i - 1)], edgeIdx[at(i)], -1, -1, edgeIdx[at(i - 2)]];", '          smallFrom = [edgeIdx[at(i - 1)], edgeIdx[at(i)], -1, edgeIdx[at(i - 2)]];')],
  ['a press anywhere finds any step', 'geometry-2d.js',
    c => c.replace('    const wanted = three => (index == null || three.includes(index)) && Boolean(modeOf(three));', '    const wanted = three => Boolean(modeOf(three));')],
  ['the hipped roof\'s eave runs on under the small gable, through its gable wall', 'cut-view.js',
    c => c.replace('        if (buried(own, pt, elev)) return true;', '')],
  ['the hip keeps the small gable\'s tail (no cut)', 'geometry-2d.js',
    c => c.replace('    if (tail) bigRec.cuts = [{ points: tail, jog: true }];', '')],
  ['an old file never gets the tail cut', 'geometry-2d.js',
    c => c.replace('      if (was === now) return;', '      return;')],
  ['the eave beyond the tail cut is read as a seam (its band goes)', 'geometry-2d.js',
    c => c.replace('  if (outline && onOutline(p, q, outline)) return false;\n', '')],
  ['a gable wall\'s top is read off a JOINT it only touches', 'cut-view.js',
    c => c.replace("        if (pts.some((a, i) => roof.edges?.[i] === 'joint' && edgeKindOf(roof, i) !== 'joint'", "        if (false && pts.some((a, i) => roof.edges?.[i] === 'joint' && edgeKindOf(roof, i) !== 'joint'")],
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
const PAST = { runPast: true };
check('GABLE END: one gable, the foot and the parallel eave beyond it go with it: flush across',
  K(G.gableJogKinds(pts(ringOf(1)), LONG, PAST)) === K(FLUSH), K(G.gableJogKinds(pts(ringOf(1)), LONG, PAST)));
check('GABLE END on the short piece instead: the same flush gable',
  K(G.gableJogKinds(pts(ringOf(1)), SHORT, PAST)) === K(FLUSH), K(G.gableJogKinds(pts(ringOf(1)), SHORT, PAST)));
check('a press on one piece (jb, 15 Nov): that piece only, the step and the other piece keep their eaves',
  K(G.gableJogKinds(pts(ringOf(1)), LONG)) === K(LONG) && K(G.gableJogKinds(pts(ringOf(1)), SHORT)) === K(SHORT),
  `${K(G.gableJogKinds(pts(ringOf(1)), LONG))} ${K(G.gableJogKinds(pts(ringOf(1)), SHORT))}`);
check('both pieces gable: the foot between them still goes gable',
  K(G.gableJogKinds(pts(ringOf(1)), ['gable', 'eave', 'gable', 'eave', 'eave', 'eave'])) === K(FLUSH),
  K(G.gableJogKinds(pts(ringOf(1)), ['gable', 'eave', 'gable', 'eave', 'eave', 'eave'])));
check('no gable at all: the step rule touches nothing',
  K(G.gableJogKinds(pts(ringOf(1)), LONG.map(() => 'eave'))) === 'eeeeee', K(G.gableJogKinds(pts(ringOf(1)), LONG.map(() => 'eave'))));
check('a step past the limit (8 ft) is a wing end: the gable stops at it',
  K(G.gableJogKinds(pts(ringOf(8)), LONG, PAST)) === K(LONG), K(G.gableJogKinds(pts(ringOf(8)), LONG, PAST)));
check('a sloped edge beyond the step is the roof\'s own business: untouched',
  K(G.gableJogKinds(pts(ringOf(1)), ['gable', 'eave', 'sloped', 'eave', 'eave', 'eave'], PAST)) === 'geseee',
  K(G.gableJogKinds(pts(ringOf(1)), ['gable', 'eave', 'sloped', 'eave', 'eave', 'eave'], PAST)));

// ── THE SOLVER: one ridge out to the front, nothing off the foot ───────
{
  const arcs = G.roofSkeleton(ROOF(FLUSH, 1));
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
  const e1 = paint(house(FLUSH), 'E1');
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
}
// ── A DEEPER STEP, 5 ft, still inside the limit ────────────────────────
{
  const e1 = paint(house(FLUSH, 5), 'E1');
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
  [['as drawn', both, FLUSH], ['wound the other way', both.slice().reverse(), FLUSH.slice(0, 5).reverse().concat(FLUSH[5])]]
    .forEach(([how, pts, kinds]) => {
      // Reversed: edge k of the reversed ring is old edge n-2-k.
      const n = pts.length;
      const k2 = how === 'as drawn' ? kinds : pts.map((_, k) => FLUSH[((n - 2 - k) % n + n) % n]);
      const split = G.gableJogSplit(pts, k2);
      const box = ring => ring.map(p => `${p.x},${p.z}`).sort().join(' ');
      check(`two gables (${how}): the big roof stops on the stepped-back line, the small one is the part that sticks out`,
        !!split && box(split.big) === box([{ x: -2, z: 1 }, { x: 21.5, z: 1 }, { x: 21.5, z: -43.5 }, { x: -2, z: -43.5 }])
          && box(split.small) === box([{ x: -2, z: 2 }, { x: 15, z: 2 }, { x: 15, z: 1 }, { x: -2, z: 1 }])
          && split.smallKinds.slice().sort().join() === 'eave,eave,gable,joint'
          && split.bigKinds.filter(k => k === 'gable').length === 1,
        split ? `${box(split.big)} | ${box(split.small)} ${split.smallKinds}` : 'no split');
    });
  const pieces = G.gableJogPieces(ROOF(FLUSH, 1));
  const two = { ...house(FLUSH), roofs: [{ ...pieces.big, id: 'roof-1' }, { ...pieces.small, id: 'roof-2', jogOf: 'roof-1' }] };
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

// ── ONE PIECE AT A TIME (jb, 15 Nov 2026) ──────────────────────────────
//
// "sometimes i'd like only one to be hip and the other to be gable". Only
// the stepped-back piece a gable: "the hip should end at the 'gable wall'
// that goes across for the large gable" -- the big gable across as for two
// gables, the part in front a small roof hipped at its front corners and
// stopped by a JOINT on the big gable's wall line. Only the part that
// sticks out a gable: "othe way around needs a valley" -- the end hipped
// across the stepped-back line, a small gable over the part in front whose
// ridge runs back into it, two JOINTs (valleys) meeting at its end.
{
  const box = ring => ring.map(p => `${p.x},${p.z}`).sort().join(' ');
  const hipBump = G.gableJogPieces(ROOF(SHORT, 1));
  check('stepped-back piece only: the big gable across the house, the part in front a hipped piece back to the big gable wall',
    !!hipBump && hipBump.mode === 'hipBump'
      && box(hipBump.big.points) === box([{ x: -2, z: 1 }, { x: 21.5, z: 1 }, { x: 21.5, z: -43.5 }, { x: -2, z: -43.5 }])
      && hipBump.big.edges.filter(k => k === 'gable').length === 1
      && box(hipBump.small.points) === box([{ x: -2, z: 2 }, { x: 15, z: 2 }, { x: 15, z: -1 }, { x: -2, z: -1 }])
      && hipBump.small.edges.slice().sort().join() === 'eave,eave,eave,joint',
    hipBump ? `${hipBump.mode}: ${box(hipBump.big.points)} | ${box(hipBump.small.points)} ${hipBump.small.edges}` : 'no split');
  const gableBump = G.gableJogPieces(ROOF(LONG, 1));
  check('part in front only: the end hipped across the stepped-back line, a small gable running back to a valley end half its width in',
    !!gableBump && gableBump.mode === 'gableBump'
      && box(gableBump.big.points) === box([{ x: -2, z: 1 }, { x: 21.5, z: 1 }, { x: 21.5, z: -43.5 }, { x: -2, z: -43.5 }])
      && !gableBump.big.edges.includes('gable')
      && box(gableBump.small.points) === box([{ x: -2, z: 2 }, { x: 15, z: 2 }, { x: 15, z: 1 }, { x: 6.5, z: -7.5 }, { x: -2, z: 1 }])
      && gableBump.small.edges.slice().sort().join() === 'eave,eave,gable,joint,joint',
    gableBump ? `${gableBump.mode}: ${box(gableBump.big.points)} | ${box(gableBump.small.points)} ${gableBump.small.edges}` : 'no split');
  check('a press names its step: an edge off the step finds no pieces', G.gableJogPieces(ROOF(LONG, 1), { index: 4 }) === null,
    'found');
  if (gableBump) {
    const arcs = G.roofSkeleton({ ...gableBump.small, id: 'roof-2' });
    const ridge = arcs.filter(a => Math.abs(a.a.x - 6.5) < 0.01 && Math.abs(a.b.x - 6.5) < 0.01);
    const zs = ridge.flatMap(a => [a.a.z, a.b.z]);
    check('the small gable\'s ridge runs from its gable (z 2) back to where the valleys meet (z -7.5)',
      ridge.length > 0 && Math.abs(Math.max(...zs) - 2) < 0.01 && Math.abs(Math.min(...zs) + 7.5) < 0.01,
      arcs.map(a => `${a.a.x},${a.a.z}->${a.b.x},${a.b.z}`).join(' | '));
    const saved = { ...house(LONG), roofs: [{ ...gableBump.big, id: 'roof-1' }, { ...gableBump.small, id: 'roof-2', jogOf: 'roof-1' }] };
    const e1 = paint(saved, 'E1');
    const heavy = e1.filter(x => x.w === 2.25 && Math.abs(x.a.u - x.b.u) > 0.3 && Math.abs(x.a.e - x.b.e) > 0.3);
    const top = Math.max(...heavy.flatMap(x => [x.a.e, x.b.e]));
    const peakU = heavy.flatMap(x => [x.a, x.b]).filter(p => Math.abs(p.e - top) < 0.01).map(p => p.u);
    check('E1: the small gable peaks over the part in front (u 6.5); the hipped end shows no rake',
      peakU.length > 0 && peakU.every(u => Math.abs(u - 6.5) < 0.05) && heavy.every(x => Math.max(x.a.u, x.b.u) <= 15.05),
      `peak at ${peakU.map(u => u.toFixed(2)).join()}: ${fmt(heavy)}`);
    // jb, 15 Nov 2026, the small gable brought out (a deeper fascia on it,
    // its board hanging lower than the hipped roof's): "the 'hip roof' is
    // shown through the 'gable wall'". The hipped roof's front eave lies, in
    // plan, inside the small piece and under its surface; none of its band
    // may cross the small gable's wall between the rakes.
    // Read with the hip WHOLE (no tail cut, as a file from before the cut
    // has it on any page that does not open it through MODEL): the bury rule
    // on its own.
    const { cuts: _cuts, ...whole } = saved.roofs[0];
    void _cuts;
    const deep = { ...saved, roofs: [whole, { ...saved.roofs[1], fascia: 18, own: ['fascia'] }] };
    const segs = paint(deep, 'E1');
    // The band: its thin top line and its heavy foot, as they stand right
    // of the small gable where nothing is in front of them.
    const band = x => Math.abs(x.a.e - x.b.e) < 0.01 && Math.abs(x.a.u - x.b.u) > 0.05
      && (x.w === 2.25 || x.ink === 'rgba(29,31,32,0.6)');
    const bandEs = [...new Set(segs.filter(x => band(x) && Math.min(x.a.u, x.b.u) > 14.5).map(x => x.a.e.toFixed(3)))].map(Number);
    const through = segs.filter(x => band(x) && bandEs.some(e => Math.abs(x.a.e - e) < 0.01)
      && Math.max(x.a.u, x.b.u) > 2 && Math.min(x.a.u, x.b.u) < 11);
    check('E1, the small gable\'s fascia 18": the hipped roof\'s eave band does not cross the small gable wall (u 2..11)',
      bandEs.length > 0 && through.length === 0, `band at ${bandEs.map(e => e.toFixed(2)).join()}: ${fmt(through)}`);

    // ── THE SMALL GABLE'S TAIL CUT OUT OF THE HIP (jb, 15 Nov 2026) ──────
    //
    // "on roof plan that extra roof can be removed i marked purple ... the
    // purple triangle cut from large hip roof", and on E2 "we need to remove
    // this line" under the small gable. The triangle from the eave line back
    // to where the valleys meet goes on the hip as a cut (geometry-2d
    // jogTailOf): its planes stay, its paper there goes.
    const tri = box([{ x: 15, z: 1 }, { x: 6.5, z: -7.5 }, { x: -2, z: 1 }]);
    const jogCuts = (gableBump.big.cuts || []).filter(c => c.jog);
    check('the hip carries the small gable\'s tail as a cut: the eave line back to the valleys\' meeting',
      jogCuts.length === 1 && box(jogCuts[0].points) === tri, JSON.stringify(gableBump.big.cuts || null));
    const bare = [{ ...whole, id: 'roof-1' }, { ...gableBump.small, id: 'roof-2', jogOf: 'roof-1' }];
    const changed = G.refreshJogCuts(bare);
    const again = G.refreshJogCuts(bare);
    check('a file cut before the rule gets the cut on open (refreshJogCuts), once',
      changed === 1 && again === 0 && (bare[0].cuts || []).some(c => c.jog && box(c.points) === tri),
      `changed ${changed}, again ${again}: ${JSON.stringify(bare[0].cuts || null)}`);
    const faces = G.roofFaces(saved.roofs[0], G.roofSkeleton(saved.roofs[0]));
    const inTri = { x: 6.5, z: -2 };
    const covering = faces.filter(f => {
      let inside = false;
      f.points.forEach((p, k) => {
        const q = f.points[(k + 1) % f.points.length];
        if ((p.z > inTri.z) !== (q.z > inTri.z) && inTri.x < (q.x - p.x) * (inTri.z - p.z) / (q.z - p.z) + p.x) inside = !inside;
      });
      return inside;
    });
    check('no face of the hip lies under the small gable\'s tail', covering.length === 0,
      covering.map(f => f.points.map(p => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(' ')).join(' | ') || 'none');
    // E1 with the cut: the hip's band still runs right of the small gable
    // (the eave beyond the cut is the sheet's edge, not a seam), none of it
    // under the small gable, and no sliver of the stepped-back wall climbing
    // the small rake where the valley comes down (u 13 .. 13.6).
    const cutSegs = paint({ ...saved, roofs: [saved.roofs[0], { ...saved.roofs[1], fascia: 18, own: ['fascia'] }] }, 'E1');
    const cutBand = [...new Set(cutSegs.filter(x => band(x) && Math.min(x.a.u, x.b.u) > 14.5).map(x => x.a.e.toFixed(3)))].map(Number);
    const cutThrough = cutSegs.filter(x => band(x) && cutBand.some(e => Math.abs(x.a.e - e) < 0.01)
      && Math.max(x.a.u, x.b.u) > 2 && Math.min(x.a.u, x.b.u) < 11);
    check('E1 with the tail cut: the hip\'s band runs on right of the small gable, and not under it',
      cutBand.length >= 2 && cutThrough.length === 0, `band at ${cutBand.map(e => e.toFixed(2)).join()}: ${fmt(cutThrough)}`);
    const plain = paint(saved, 'E1');
    // The sliver: a slant from up the rake at the corner (u 13) down to the
    // plate half a foot on.
    const sliver = plain.filter(x => x.ink !== '#fff'
      && Math.min(x.a.u, x.b.u) > 12.95 && Math.max(x.a.u, x.b.u) < 13.7 && Math.abs(x.a.u - x.b.u) > 0.05
      && Math.max(x.a.e, x.b.e) > PLATE + 0.3 && Math.min(x.a.e, x.b.e) < PLATE + 0.1);
    check('E1 with the tail cut: no sliver of wall climbs the small rake where its valley comes down',
      sliver.length === 0, fmt(sliver));
  }
}

const failed = CHECKS.filter(c => !c.ok);
failed.forEach(c => console.log(`FAIL  ${c.label}\n      got  ${c.got}`));
console.log(`\n${CHECKS.length - failed.length}/${CHECKS.length} checks passed`);
if (failed.length) process.exitCode = 1;
