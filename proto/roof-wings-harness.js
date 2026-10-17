// WHICH ENDS OF A ROOF HIP, WHICH GABLE, AND WHICH WING IS A ROOF OF ITS OWN.
//
// Movie, 16 Oct, on his own modified bilevel (proto/repro-movie-roof-wings
// .draft): "the back on this one could have been a hip" ... "the upper roof
// should have been 2 separate roofs with a gable on both" ... "the upper 2nd
// floor roof can be hip no problem because it won't have to worry about
// height of other walls" ... "the peak of the roof should be at the 2nd
// floor wall if there is main floor roof beside the 2nd floor wall slope
// that roof AWAY or to the SIDES of that 2nd floor wall" ... "can you draw
// the lower red roof that connects back to the house wall gable (show it as
// dotted line (under the upper roof overhang)".
//
// geometry-2d answers with three functions, and this harness measures each
// on his rings:
//
//   roofWingKinds      the ring as wings; a wing's end in open air is an
//                      eave (hip), an end on anything as tall is a gable.
//   roofEndAttachment  a narrower wing on another's END comes off as its
//                      own ring, flush against the rest.
//   roofHiddenSpans    the stretches of a roof's edges under a higher
//                      roof's sheet, in edge parameter, for the dotted line.
//
// Run: node proto/roof-wings-harness.js          (checks)
//      node proto/roof-wings-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const SRC = path.join(__dirname, '..', 'geometry-2d.js');

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

const P = (x, z) => ({ x, z });
const ring = pairs => pairs.map(([x, z]) => P(x, z));
const K = kinds => kinds.map(k => k[0]).join('');

// ── HIS HOUSE, AS THE BUILDER HANDS THE RINGS OVER ───────────────────────
//
// MAIN FL block A is 24 x 22 (x -36..-12, z -22..0) with a 12 x 12 stub B
// beside it (x -12..0, z -18..-6, the split entry inside it); the room over
// the garage stands half a storey higher (OVER GARAGE, walls to 14 ft
// against MAIN's 9) with the landing hood reaching 1.5 ft into A; the
// garage stub D is a storey lower beside the room.
const MAIN_TOP = 9, ROOM_TOP = 14, ENTRY_TOP = 5;
const BODIES = [
  { points: ring([[0, 0], [0, -6], [-6, -6], [-6, -18], [-12, -18], [-12, -22], [-36, -22], [-36, 0]]), top: MAIN_TOP },
  { points: ring([[-6, -18], [-6, -6], [0, -6], [0, -18]]), top: ENTRY_TOP },
  { points: ring([[-12, 0], [-12, 10], [14, 10], [14, 2], [24, 2], [24, -12], [0, -12], [0, 0]]), top: MAIN_TOP },
  { points: ring([[-12, 0], [-12, 10], [14, 10], [14, -12], [0, -12], [0, 0]]), top: ROOM_TOP },
];
// The house roof as ONE ring (what the build made before the split), cut
// flush round the landing: the four flush edges are gables going in.
const HOUSE_RING = ring([[-12, 2], [-12, -6], [-13.5, -6], [-13.5, -12], [2, -12], [2, -20], [-10, -20], [-10, -24], [-38, -24], [-38, 2]]);
const HOUSE_IN = ['gable', 'gable', 'gable', 'gable', 'eave', 'eave', 'eave', 'eave', 'eave', 'eave'];
const HOUSE_OVER = [0, 0, 0, 0, 2, 2, 2, 2, 2, 2];
// The room's hood ring, squared over the room and the landing.
const ROOM_RING = ring([[-14, 12], [16, 12], [16, -14], [-15.5, -14], [-15.5, -4], [-14, -4]]);
const ROOM_IN = ['eave', 'eave', 'eave', 'eave', 'eave', 'eave'];
// The garage stub, flush against the room.
const STUB_RING = ring([[14, 4], [26, 4], [26, -14], [14, -14]]);
const STUB_IN = ['eave', 'eave', 'eave', 'gable'];
const STUB_OVER = [2, 2, 2, 0];
// The house's wall loop, spike cleaned, with the entry joined in.
const HOUSE_LOOP = ring([[0, 0], [0, -18], [-12, -18], [-12, -22], [-36, -22], [-36, 0]]);

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── THE ENDS ───────────────────────────────────────────────────────────
check('the house ring: the back end stands in open air and hips (his V)', G => {
  const k = G.roofWingKinds(HOUSE_RING, HOUSE_IN, BODIES, { edgeOverhang: HOUSE_OVER, overhangFt: 2, top: MAIN_TOP });
  return [k[8], 'eave'];
});
check('the house ring: the garage end lands on the stub and the landing, and gables', G => {
  const k = G.roofWingKinds(HOUSE_RING, HOUSE_IN, BODIES, { edgeOverhang: HOUSE_OVER, overhangFt: 2, top: MAIN_TOP });
  return [k[6], 'gable'];
});
check('the house ring: the long sides stay eaves', G => {
  const k = G.roofWingKinds(HOUSE_RING, HOUSE_IN, BODIES, { edgeOverhang: HOUSE_OVER, overhangFt: 2, top: MAIN_TOP });
  return [[k[7], k[9]].join(','), 'eave,eave'];
});
check("the stub's far end is open and hips (his 45-degree line)", G => {
  const k = G.roofWingKinds(HOUSE_RING, HOUSE_IN, BODIES, { edgeOverhang: HOUSE_OVER, overhangFt: 2, top: MAIN_TOP });
  return [[k[4], k[5]].join(','), 'eave,eave'];
});
check('the edges cut flush against the landing stay gables: the peak is at that wall', G => {
  const k = G.roofWingKinds(HOUSE_RING, HOUSE_IN, BODIES, { edgeOverhang: HOUSE_OVER, overhangFt: 2, top: MAIN_TOP });
  return [K(k.slice(0, 4)), 'gggg'];
});
check('the whole house ring, read together', G => {
  const k = G.roofWingKinds(HOUSE_RING, HOUSE_IN, BODIES, { edgeOverhang: HOUSE_OVER, overhangFt: 2, top: MAIN_TOP });
  return [K(k), 'ggggeegeee'];
});
check('the room over the garage stands higher than everything beside it: hip both ends', G => {
  const k = G.roofWingKinds(ROOM_RING, ROOM_IN, BODIES, { overhangFt: 2, top: ROOM_TOP });
  return [K(k), 'eeeeee'];
});
check('told nothing about heights, the room would gable where the house and garage stand', G => {
  // the guard the heights give: without them a lower body still counts
  const k = G.roofWingKinds(ROOM_RING, ROOM_IN, BODIES.map(b => b.points), { overhangFt: 2 });
  return [K(k), 'egegeg'];
});
check('the garage stub rises to the room (flush gable) and hips at its free ends', G => {
  const k = G.roofWingKinds(STUB_RING, STUB_IN, BODIES, { edgeOverhang: STUB_OVER, overhangFt: 2, top: MAIN_TOP });
  return [K(k), 'eeeg'];
});
check('a plain rectangle in open air is a hip all round', G => {
  const k = G.roofWingKinds(ring([[-2, -2], [34, -2], [34, 42], [-2, 42]]), ['eave', 'eave', 'eave', 'eave'], [], { overhangFt: 2 });
  return [K(k), 'eeee'];
});
check('an L of one height stays one roof with a valley: no end gables', G => {
  const L = ring([[-2, -2], [42, -2], [42, 22], [22, 22], [22, 34], [-2, 34]]);
  const k = G.roofWingKinds(L, L.map(() => 'eave'), [], { overhangFt: 2 });
  return [K(k), 'eeeeee'];
});
check('a named gable is never flipped back to an eave', G => {
  const k = G.roofWingKinds(ring([[-2, -2], [34, -2], [34, 42], [-2, 42]]), ['gable', 'eave', 'eave', 'eave'], [], { overhangFt: 2 });
  return [k[0], 'gable'];
});
check('a ring with a spike (a wall walked twice) is not read as wings: nothing is split off it', G => {
  const spiked = ring([[0, 0], [0, -18], [-6, -18], [0, -18], [-12, -18], [-12, -22], [-36, -22], [-36, 0]]);
  return [[G.roofWingsOf(spiked), G.roofEndAttachment(spiked)], [null, null]];
});
check('a ring with a diagonal edge is handed back untouched', G => {
  const tri = ring([[0, 0], [10, 0], [10, 10], [0, 20]]);
  const k = G.roofWingKinds(tri, ['gable', 'eave', 'eave', 'eave'], BODIES, { overhangFt: 2, top: MAIN_TOP });
  return [K(k), 'geee'];
});
check('a bump\'s return in the middle of a wing is not an end: it stays an eave, taller neighbour or not', G => {
  // a 40 x 20 wing with an 8 ft bay 3 ft deep on its south side, and a
  // taller body standing right beside the bay's west return
  const bay = ring([[0, 0], [16, 0], [16, -3], [24, -3], [24, 0], [40, 0], [40, 20], [0, 20]]);
  const tall = [{ points: ring([[8, 0], [16, 0], [16, -3], [8, -3]]), top: 20 }];
  const k = G.roofWingKinds(bay, bay.map(() => 'eave'), tall, { overhangFt: 0, top: 9 });
  return [k[1], 'eave'];
});
check('a body standing a foot clear of the end wall is not landed on: the end hips', G => {
  const box = ring([[-2, -2], [42, -2], [42, 22], [-2, 22]]);
  const clear = [{ points: ring([[41, 0], [45, 0], [45, 20], [41, 20]]), top: 20 }];
  const k = G.roofWingKinds(box, box.map(() => 'eave'), clear, { overhangFt: 2, top: 9 });
  return [k[1], 'eave'];
});
check('a body against the end wall is landed on: the end gables', G => {
  const box = ring([[-2, -2], [42, -2], [42, 22], [-2, 22]]);
  const against = [{ points: ring([[40, 0], [45, 0], [45, 20], [40, 20]]), top: 20 }];
  const k = G.roofWingKinds(box, box.map(() => 'eave'), against, { overhangFt: 2, top: 9 });
  return [k[1], 'gable'];
});
check('the sliver merge: the ring is read as two wings, the block and the stub', G => {
  const made = G.roofWingsOf(HOUSE_RING, { edgeOverhang: HOUSE_OVER, overhangFt: 2 });
  return [made.wings.length + ':' + made.wings.map(w => w.axis).join(''), '2:xx'];
});
check('the widest span is the main wing: 24 x 22 before 30 x 18', G => {
  const made = G.roofWingsOf(ring([[0, 0], [0, -18], [-12, -18], [-12, -22], [-36, -22], [-36, 0]]));
  const r = made.wings[0].rects[0];
  return [[r.x0, r.x1, r.z0, r.z1].join(','), '-36,-12,-22,0'];
});

// ── THE SPLIT ──────────────────────────────────────────────────────────
check('the stub stands on the block\'s end and narrower: it comes off as its own ring', G => {
  const apart = G.roofEndAttachment(HOUSE_LOOP);
  return [apart ? apart.wing.map(p => `${p.x},${p.z}`).join(' ') : 'null', '-12,-18 0,-18 0,0 -12,0'];
});
check('and what is left is the block, whole', G => {
  const apart = G.roofEndAttachment(HOUSE_LOOP);
  return [apart ? apart.rest.map(p => `${p.x},${p.z}`).join(' ') : 'null', '-36,-22 -12,-22 -12,0 -36,0'];
});
check('everything beyond the block goes with the wing: the entry\'s corner is not left behind', G => {
  const loop = ring([[0, 0], [0, -6], [-6, -6], [-6, -18], [-12, -18], [-12, -22], [-36, -22], [-36, 0]]);
  const apart = G.roofEndAttachment(loop);
  const area = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.z - q.x * p.z; }, 0)) / 2;
  return [apart ? `${area(apart.wing)}+${area(apart.rest)}` : 'null', '144+528'];
});
check('a wing on another\'s SIDE makes a valley and is not split off', G => {
  return [G.roofEndAttachment(ring([[0, 0], [40, 0], [40, 20], [20, 20], [20, 32], [0, 32]])), null];
});
check('a T: the stem on the bar\'s side is not split off either', G => {
  return [G.roofEndAttachment(ring([[0, 0], [40, 0], [40, 20], [30, 20], [30, 40], [10, 40], [10, 20], [0, 20]])), null];
});
check('a wing as wide as the end it stands on is the same rectangle, not a split', G => {
  return [G.roofEndAttachment(ring([[0, 0], [52, 0], [52, 32], [0, 32]])), null];
});
check('a wing on the bar\'s end that reaches past the bar\'s side is not split off', G => {
  return [G.roofEndAttachment(ring([[0, 0], [40, 0], [40, 15], [52, 15], [52, 30], [40, 30], [40, 20], [0, 20]])), null];
});
check('a wider block on the bar\'s end is the bar\'s host, not its wing: no split', G => {
  return [G.roofEndAttachment(ring([[0, 0], [40, 0], [40, -5], [52, -5], [52, 25], [40, 25], [40, 20], [0, 20]])), null];
});
check('a plain rectangle has nothing to split', G => [G.roofEndAttachment(ring([[0, 0], [40, 0], [40, 32], [0, 32]])), null]);

// ── THE DOTTED LINE ────────────────────────────────────────────────────
const A = { points: ring([[-38, -24], [-10, -24], [-10, 2], [-38, 2]]), edges: ['eave', 'gable', 'eave', 'eave'], edgeOverhang: [2, 2, 2, 2], pitch: 4 };
const B = { points: ring([[-12, -20], [2, -20], [2, -12], [-12, -12]]), edges: ['eave', 'eave', 'gable', 'gable'], edgeOverhang: [2, 2, 0, 0], pitch: 4 };
const spans = list => list.map(edge => edge.map(([a, b]) => `${a.toFixed(3)}-${b.toFixed(3)}`).join('|')).join(';');
check('the stub\'s edges under the house\'s rake: 2 ft of the north eave, 2 ft of the south, the whole west', G => {
  return [spans(G.roofHiddenSpans(B, [A])), '0.000-0.143;;0.857-1.000;0.000-1.000'];
});
check('the house\'s rake is OVER the stub, so none of it is hidden', G => [spans(G.roofHiddenSpans(A, [B])), ';;;']);
check('a roof on a different plate is not compared: nothing hidden', G => {
  return [spans(G.roofHiddenSpans(B, [{ ...A, plateHeightFt: 8 }])), ';;;'];
});
check('a roof alone hides nothing', G => [spans(G.roofHiddenSpans(B, [])), ';;;']);

function run() {
  const G = load(null);
  let failed = 0;
  CHECKS.forEach(({ label, fn }) => {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `threw: ${err.message}`; want = 'no throw'; }
    if (String(got) !== String(want)) {
      failed += 1;
      console.log(`FAIL  ${label}\n      got  ${got}\n      want ${want}`);
    }
  });
  console.log(`\n${CHECKS.length - failed}/${CHECKS.length} checks passed`);
  if (failed) process.exitCode = 1;
}

const MUTATIONS = [
  ['a spike is read as wings, and the ring quietly rebuilt clean',
    s => s.replace('    if (ul > eps && vl > eps && Math.abs(ux * vz - uz * vx) < eps && (ux * vx + uz * vz) < 0) return null;', '')],
  ['the biggest rectangle is the main wing, not the widest span',
    s => s.replace("if (!best || span > best.span + eps || (Math.abs(span - best.span) <= eps && area > best.area + eps)) {",
      'if (!best || area > best.area + eps) {')],
  ['slivers are wings of their own',
    s => s.replace('const SLIVER_FT = 4.1;', 'const SLIVER_FT = 0;')],
  ['the long axis is read off the sheet, overhang and all',
    s => s.replace("wing.axis = wallSpan(main(wing), 'x') >= wallSpan(main(wing), 'z') - eps ? 'x' : 'z';",
      "wing.axis = (main(wing).x1 - main(wing).x0) >= (main(wing).z1 - main(wing).z0) - eps ? 'x' : 'z';")],
  ['an end anywhere along the wing counts, not only at its extreme',
    s => s.replace('    if (Math.abs(at - extreme) > SLIVER_FT + eps) return null;', '    // wherever it is')],
  ['a wing attached at the end is not something to gable for',
    s => s.replace('    const attached = own < across(wing, end.axis) - 0.5;', '    const attached = false;')],
  ['a body is probed from the sheet\'s edge, not the wall: four feet too far out',
    s => s.replace('    const push = 0.5 - overAt(edge.i);', '    const push = overAt(edge.i) + 0.5;')],
  ['a body is probed on the roof\'s own side of the wall',
    s => s.replace('    const push = 0.5 - overAt(edge.i);', '    const push = -0.5 - overAt(edge.i);')],
  ['a lower body counts as something to gable at',
    s => s.replace('    .filter(body => ownTop === null || body.top === null || body.top >= ownTop - 0.01);', '')],
  ['a taller body is the one that does not count',
    s => s.replace('body.top >= ownTop - 0.01);', 'body.top < ownTop - 0.01);')],
  ['a named gable is flipped like any other end',
    s => s.replace("    if (out[i] === 'gable') return;                  // flush already, or named", '')],
  ['every end hips, whatever stands there',
    s => s.replace("    out[i] = (attached || meetsBody(edge)) ? 'gable' : 'eave';", "    out[i] = 'eave';")],
  ['every end gables',
    s => s.replace("    out[i] = (attached || meetsBody(edge)) ? 'gable' : 'eave';", "    out[i] = 'gable';")],
  ['a wing beyond the host\'s width is split off as if it stood within it',
    s => s.replace('      const narrower = (bhi - blo) < (ahi - alo) - 0.5 && blo >= alo - eps && bhi <= ahi + eps;',
      '      const narrower = (bhi - blo) < (ahi - alo) - 0.5;')],
  ['only the wing\'s own rectangle comes off; what hangs beyond it is left behind',
    s => s.replace('          off[p][q] = true; stack.push([p, q]);', '          return;')],
  ['the hidden test reads the roof\'s own height on its edge, where it has none',
    s => s.replace('      const mid = { x: a.x + dx * (t0 + t1) / 2 + in0.x * 0.02, z: a.z + dz * (t0 + t1) / 2 + in0.z * 0.02 };',
      '      const mid = { x: a.x + dx * (t0 + t1) / 2, z: a.z + dz * (t0 + t1) / 2 };')],
  ['a lower roof hides a higher one',
    s => s.replace('        return mate.plate + rise > myHeight + ROOF_UNDER_TOL_FT;', '        return mate.plate + rise < myHeight - ROOF_UNDER_TOL_FT;')],
  ['roofs on different plates are compared as if on one',
    s => s.replace('    && ((plateOf(other) === null) === (myPlate === null)))', ')')],
  ['the edge is never cut where another ring crosses it: all or nothing',
    s => s.replace("      if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) ts.add(Math.round(t * 1e6) / 1e6);", '')],
];

function runMutations() {
  console.log('\n' + 'mutation'.padEnd(70) + 'caught by');
  let survived = 0;
  let broken = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    let G;
    try { G = load(mutate); } catch (err) {
      broken += 1;
      console.log(`${label.padEnd(70)}!!! MUTATION DID NOT APPLY: ${err.message}`);
      return;
    }
    const caught = [];
    CHECKS.forEach(({ label: name, fn }) => {
      let got, want;
      try { [got, want] = fn(G); } catch (err) { caught.push(name); return; }
      if (String(got) !== String(want)) caught.push(name);
    });
    if (!caught.length) survived += 1;
    console.log(label.padEnd(70)
      + (caught.length ? caught.join('\n' + ' '.repeat(70)) : '*** NOTHING ***'));
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  if (survived || broken) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run();
