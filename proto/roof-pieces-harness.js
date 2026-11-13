// A ROOF BUSTED INTO ITS PLANES (jb, 13 Nov 2026).
//
// "the autoroof is really cool for doing the quick house but unless it is
// nearly perfect at the begining its hard to modify" -- "would it be
// possible to BUST it in to peices". geometry-2d.js roofPieces turns one roof
// into one roof per solved plane: the same polygon, one EAVE edge, the hips,
// valleys and ridges JOINT edges. The checks here are the whole contract:
// at every point the roof covered, the pieces together stand at the height
// the roof stood, and nowhere else; each piece solves as a single plane; a
// raised heel, a hood cut, a cross gable and a SLOPED edge ride along.
//
// Run: node proto/roof-pieces-harness.js          (checks)
//      node proto/roof-pieces-harness.js --mutate (checks + mutations)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'geometry-2d.js');

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(window);
  return window.DraftGeometry2D;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

const mk = (pts, edges, extra = {}) => ({ id: 'r', levelId: 7, sourceLevelId: 3, garage: false, fascia: 5.5, layer: 'A-ROOF',
  points: pts.map(([x, z]) => ({ x, y: 0, z })), edges, overhang: 2, pitch: 6, edgeOverhang: edges.map(() => 2), ...extra });
const BOX = [[0, 0], [40, 0], [40, 20], [0, 20]];
const ALL_EAVE = ['eave', 'eave', 'eave', 'eave'];
const ROOFS = {
  hip: () => mk(BOX, ALL_EAVE),
  gableEnd: () => mk(BOX, ['eave', 'gable', 'eave', 'gable'], { edgeOverhang: [2, 0, 2, 1] }),
  L: () => mk([[-10, -8], [10, -8], [10, 2], [2, 2], [2, 8], [-10, 8]], ['eave', 'eave', 'eave', 'eave', 'eave', 'eave']),
  heel: () => mk(BOX, ALL_EAVE, { edgeHeelIn: [0, 0, 24, 0] }),
  sloped: () => mk(BOX, ['eave', 'sloped', 'eave', 'eave']),
  cut: () => mk(BOX, ALL_EAVE, { cuts: [{ points: [{ x: 30, z: -1 }, { x: 41, z: -1 }, { x: 41, z: 8 }, { x: 30, z: 8 }], hoodOf: 'up' }] }),
  cross: () => mk(BOX, ALL_EAVE, { crossGables: [{ at: { x: 20, z: 2 }, widthFt: 10, pitch: 8 }] }),
  shed: () => mk([[0, 0], [40, 0], [40, 10], [0, 10]], ['eave', 'gable', 'gable', 'gable']),
  clockwise: () => mk([[0, 0], [0, 20], [40, 20], [40, 0]], ALL_EAVE),
};

// Heights at a grid: the roof's own, and the pieces'. `miss` is a covered
// point no piece covers, `extra` a piece where the roof had none, `worst`
// the largest height difference, in feet.
const compare = (G, roof) => {
  const pieces = G.roofPieces(roof);
  const faces = G.roofFaces(roof, G.roofSkeleton(roof));
  let worst = 0, miss = 0, extra = 0, n = 0;
  for (let x = -12; x <= 42; x += 0.37) {
    for (let z = -10; z <= 22; z += 0.41) {
      const p = { x, z };
      const r0 = G.roofRiseAt(roof, p, faces);
      const rs = pieces.map(pc => G.roofRiseAt(pc, p)).filter(v => v != null);
      if (r0 == null) { if (rs.length) extra += 1; continue; }
      n += 1;
      if (!rs.length) { miss += 1; continue; }
      worst = Math.max(worst, Math.min(...rs.map(v => Math.abs(v - r0))));
    }
  }
  return { pieces, faces, n, miss, extra, worst: Math.round(worst * 1000) / 1000 };
};
const standsWhereItStood = name => check(`${name}: the pieces stand where the roof's planes stood`, G => {
  const c = compare(G, ROOFS[name]());
  return [`${c.pieces.length >= 2} miss ${c.miss} extra ${c.extra} worst ${c.worst}`, 'true miss 0 extra 0 worst 0'];
});
['hip', 'gableEnd', 'L', 'heel', 'sloped', 'cut', 'cross', 'clockwise'].forEach(standsWhereItStood);

check('a hip box busts into four pieces, one per face', G => [G.roofPieces(ROOFS.hip()).length, 4]);
check('every piece has exactly one EAVE and the rest JOINT or GABLE', G => {
  const bad = G.roofPieces(ROOFS.L()).filter(p => p.edges.filter(k => k === 'eave').length !== 1
    || p.edges.some(k => !['eave', 'joint', 'gable'].includes(k)));
  return [bad.length, 0];
});
check('a piece solves as a single plane: no skeleton lines, one face', G => {
  const pieces = G.roofPieces(ROOFS.hip());
  return [pieces.map(p => `${G.roofSkeleton(p).length}/${G.roofFaces(p, G.roofSkeleton(p)).length}`).join(' '), '0/1 0/1 0/1 0/1'];
});
check('a gable end stays a GABLE on its piece, at its own overhang', G => {
  const pieces = G.roofPieces(ROOFS.gableEnd());
  const gables = pieces.flatMap(p => p.edges.map((k, i) => (k === 'gable' ? p.edgeOverhang[i] : null)).filter(v => v != null));
  return [gables.sort().join(','), '0,0,1,1'];
});
check('a piece is a hand roof at the roof\'s pitch, with its eave\'s overhang', G => {
  const p = G.roofPieces(ROOFS.hip())[0];
  return [`${p.follows} ${p.pitch} ${p.overhang} ${p.levelId} ${p.sourceLevelId}`, 'none 6 2 7 3'];
});
check('the raised heel rides to the piece whose eave was raised, and only there', G => {
  const pieces = G.roofPieces(ROOFS.heel());
  const heels = pieces.map(p => (p.edgeHeelIn || []).filter(v => v > 0).join(','));
  return [heels.filter(Boolean).join('|'), '24'];
});
check('a hood cut rides to the pieces it reaches', G => {
  const pieces = G.roofPieces(ROOFS.cut());
  return [`${pieces.filter(p => p.cuts).length} ${pieces.find(p => p.cuts)?.cuts[0].hoodOf}`, '2 up'];
});
check('a cross gable rides to the piece whose eave it stands on', G => {
  const pieces = G.roofPieces(ROOFS.cross());
  const host = pieces.filter(p => p.crossGables);
  return [`${host.length} ${host[0]?.crossGables[0].widthFt} ${G.crossGableShapes(host[0]).length}`, '1 10 1'];
});
check('a roof that is one plane already busts into nothing', G => [G.roofPieces(ROOFS.shed()).length, 0]);
check('a JOINT holds the plane the way a GABLE does', G => {
  const a = mk(BOX, ['eave', 'gable', 'eave', 'gable']);
  const b = mk(BOX, ['eave', 'joint', 'eave', 'joint']);
  return [JSON.stringify(G.roofSkeleton(b)), JSON.stringify(G.roofSkeleton(a))];
});
check('one eave is one plane: no skeleton lines however many corners', G => {
  const r = mk([[0, 0], [40, 0], [40, 10], [20, 14], [0, 10]], ['eave', 'joint', 'joint', 'joint', 'joint']);
  return [`${G.roofSkeleton(r).length} ${G.roofFaces(r, G.roofSkeleton(r)).length}`, '0 1']; });
check('the roof handed in is not edited where it lies', G => {
  const r = ROOFS.heel();
  const before = JSON.stringify(r);
  G.roofPieces(r);
  return [JSON.stringify(r) === before, true];
});

const MUTATIONS = [
  ['a JOINT moves like an eave',
    s => s.replace("const isSolidEdge = kind => kind === 'gable' || kind === 'joint';", "const isSolidEdge = kind => kind === 'gable';")],
  ['the heel strips are not cut from the pieces',
    s => s.replace("const strips = raised ? cutLoopsOf({ cuts: raised.cuts }) : [];", 'const strips = [];')],
  ['the heel is dropped from the piece',
    s => s.replace("return planeEdge(face, j) ? { p, kind: 'eave', over: overs[j], heel: heels[j] }", "return planeEdge(face, j) ? { p, kind: 'eave', over: overs[j], heel: 0 }")],
  ['every ring eave is the piece\'s eave, plane or not',
    s => s.replace("const planeEdge = (face, j) => virt.length === n\n", 'const planeEdge = (face, j) => true || virt.length === n\n')],
  ['a hood cut is not carried',
    s => s.replace("if (reached.length) {\n      piece.cuts", 'if (false) {\n      piece.cuts')],
  ['a cross gable is not carried',
    s => s.replace("if (standing.length) piece.crossGables", 'if (false) piece.crossGables')],
  ['a gable end becomes a JOINT',
    s => s.replace("if (kinds[j] === 'gable') return { p, kind: 'gable', over: overs[j], heel: 0 };", "if (kinds[j] === 'gable') return { p, kind: 'joint', over: 0, heel: 0 };")],
  ['the pieces follow the PROJECT page',
    s => s.replace("piece.follows = 'none';", "piece.follows = 'house';")],
  ['one piece is enough to bust',
    s => s.replace('return pieces.length >= 2 ? pieces : [];', 'return pieces;')],
];

function score(G) {
  return CHECKS.map(({ label, fn }) => {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `threw: ${err.message}`; want = 'no throw'; }
    return { label, ok: String(got) === String(want), got, want };
  });
}

function run() {
  const results = score(load(null));
  const failed = results.filter(r => !r.ok);
  failed.forEach(r => console.log(`FAIL  ${r.label}\n      got  ${r.got}\n      want ${r.want}`));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

function runMutations() {
  run();
  console.log('\n' + 'mutation'.padEnd(62) + 'caught by');
  let missed = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    let caught;
    try { caught = score(load(mutate)).filter(r => !r.ok).map(r => r.label); } catch (err) { caught = [`load threw: ${err.message}`]; }
    if (!caught.length) missed += 1;
    console.log(`${label.padEnd(62)}${caught.length ? caught[0] : 'SURVIVED'}`);
  });
  console.log(`\n${MUTATIONS.length - missed}/${MUTATIONS.length} mutations caught`);
  if (missed) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run();
