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

// ── BESIDE A TALLER WALL: GABLE INTO IT, SHED AWAY FROM IT ─────────────
//
// Movie, 17 Oct, on his MOD BILEVEL (scratchpad sample movie-roof-
// 20261017T0911): "on main roof split the roof into 2 roofs -- front will be
// gabled away slope from 2nd floor, and back roof can be gabled at front to
// connect to back of 2nd floor and shed water to sides and hip at back" ...
// "will need the main roof to have a 'gable wall' ... where the lower green
// roof will meet the GABLE wall of the main roof". His main loop, spike
// cleaned: the west block (x -39..-19, z -20..21, its east side stepping a
// foot where the garage wall stands off the corner) with the middle piece
// (x -19..-6, z -12..0) beside the room over the garage (x -20..0, z 0..21)
// and its stair hood (x -13.5..0, z -6..0).
const AGAINST_RING = ring([[-6, 0], [-6, -12], [-19, -12], [-19, -20], [-39, -20], [-39, 21], [-20, 21], [-20, 0]]);
const AGAINST_WALL = ring([[0, 0], [0, 21], [-20, 21], [-20, 0], [-13.5, 0], [-13.5, -6], [0, -6]]);
const edgeOf = (r, a, b) => r.findIndex((p, i) => {
  const q = r[(i + 1) % r.length];
  return Math.abs(p.x - a[0]) < 1e-6 && Math.abs(p.z - a[1]) < 1e-6 && Math.abs(q.x - b[0]) < 1e-6 && Math.abs(q.z - b[1]) < 1e-6;
});
const kindAt = (piece, a, b) => {
  const i = edgeOf(piece.ring, a, b);
  if (i < 0) return 'missing';
  return piece.flush.includes(i) ? 'flush' : piece.rake.includes(i) ? 'rake' : 'eave';
};
check('beside the room the main roof comes apart into the back block and the front piece', G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  return [r ? r.pieces.map(p => p.role).join(',') : 'null', 'block,shed'];
});
check('the block is the whole west block, the foot of step and all, and the front piece the middle piece', G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  const span = p => { const xs = p.ring.map(q => q.x), zs = p.ring.map(q => q.z); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)].join(','); };
  return [r.pieces.map(span).join(' | '), '-39,-19,-20,21 | -19,-6,-12,0'];
});
check("the block's wall side: flush on the room, a rake past it, and the foot between them flush", G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  const b = r.pieces[0];
  return [[kindAt(b, [-20, 0], [-20, 21]), kindAt(b, [-19, -20], [-19, 0]), kindAt(b, [-19, 0], [-20, 0])].join(','), 'flush,rake,flush'];
});
check("the block's flanks and far end are eaves: water to the sides, a hip at the back", G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  const b = r.pieces[0];
  return [[kindAt(b, [-39, -20], [-19, -20]), kindAt(b, [-20, 21], [-39, 21]), kindAt(b, [-39, 21], [-39, -20])].join(','), 'eave,eave,eave'];
});
check('the front piece sheds away from the room: one eave, on the side facing away', G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  const s = r.pieces[1];
  const eaves = s.ring.filter((p, i) => !s.flush.includes(i) && !s.rake.includes(i)).length;
  return [[eaves, kindAt(s, [-19, -12], [-6, -12])].join(','), '1,eave'];
});
check("the front piece is flush against the block's gable wall and the room, a rake on its open end", G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  const s = r.pieces[1];
  return [[kindAt(s, [-19, 0], [-19, -12]), kindAt(s, [-6, 0], [-19, 0]), kindAt(s, [-6, -12], [-6, -6])].join(','), 'flush,flush,rake'];
});
check('the gable wall is the stretch where the front piece stands against the block', G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  return [JSON.stringify(r.gableWalls.map(w => [w.start.x, w.start.z, w.end.x, w.end.z])), '[[-19,0,-19,-12]]'];
});
check('the hood reaching a foot into the block is no bite to notch it round', G => {
  const r = G.roofAgainstWall(AGAINST_RING, AGAINST_WALL);
  const deep = G.roofAgainstWall(AGAINST_RING, ring([[0, 0], [0, 21], [-30, 21], [-30, 0]]));
  // The replay's hood stands half a foot into the block: a foot of overlap
  // along the gable line, not a bite.
  const shallow = G.roofAgainstWall(AGAINST_RING, ring([[0, 0], [0, 21], [-20, 21], [-20, 0], [-19.5, 0], [-19.5, -6], [0, -6]]));
  return [[r.notchBlock, deep && deep.notchBlock, shallow && shallow.notchBlock].join(','), 'false,true,false'];
});
check('a wall touching nothing but a sliver leaves the ring to the ordinary rules', G => {
  const far = G.roofAgainstWall(AGAINST_RING, ring([[10, 10], [20, 10], [20, 20], [10, 20]]));
  const graze = G.roofAgainstWall(AGAINST_RING, ring([[-20, 0], [-20, 3], [-17, 3], [-17, 0]]));
  return [[far, graze].map(v => (v === null ? 'null' : 'split')).join(','), 'null,null'];
});
check('a plain rectangle against a wall is one block with no arm', G => {
  const r = G.roofAgainstWall(ring([[0, 0], [30, 0], [30, 20], [0, 20]]), ring([[30, 5], [40, 5], [40, 15], [30, 15]]));
  const b = r.pieces[0];
  return [[r.pieces.length, kindAt(b, [30, 5], [30, 15]), kindAt(b, [30, 0], [30, 5]), kindAt(b, [30, 15], [30, 20]), kindAt(b, [0, 0], [30, 0])].join(','), '1,flush,rake,rake,eave'];
});
// HIS 16 OCT HOUSE STAYS AS IT WAS: the stub on the block's end comes off
// first, undecided, and the block touches no taller wall on a side of its
// own -- so both go to the ordinary rules (roofWingKinds), exactly as before
// this rule existed.
check('his 16 Oct house: the stub comes off the end undecided and the block is handed back undecided', G => {
  const r = G.roofAgainstWall(HOUSE_LOOP, ring([[-12, 0], [-12, 10], [14, 10], [14, 2], [24, 2], [24, -12], [0, -12], [0, 0]]));
  return [r ? r.pieces.map(p => `${p.role}:${p.decided}`).join(',') : 'null', 'rest:false,arm:false'];
});
check('his 16 Oct house: the stub is the east part, flush where it stands against the block', G => {
  const r = G.roofAgainstWall(HOUSE_LOOP, ring([[-12, 0], [-12, 10], [14, 10], [14, 2], [24, 2], [24, -12], [0, -12], [0, 0]]));
  const arm = r.pieces[1];
  const span = p => { const xs = p.ring.map(q => q.x), zs = p.ring.map(q => q.z); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)].join(','); };
  return [span(arm) + ' ' + kindAt(arm, [-12, 0], [-12, -18]), '-12,0,-18,0 flush'];
});
// ── A JOG IN THE WALL IS NOT A JOG IN THE ROOF (Movie, 17 Oct) ────────────
// "the lower garage wall should have a jog in it, should just be a normal
// hip without the extra little hip where it jogs". His garage's front
// stands a foot north of the house's line: the roof ring takes the outer
// line, the wall keeps its jog.
const JOGGED_GARAGE = ring([[0, 0], [0, -1], [6, -1], [6, 21], [-20, 21], [-20, 0]]);
check('a foot of jog in the garage front comes out of the roof ring, onto the outer line', G => {
  const out = G.loopWithoutJogs(JOGGED_GARAGE);
  return [JSON.stringify(out.points.map(p => [p.x, p.z])), '[[6,-1],[6,21],[-20,21],[-20,-1]]'];
});
check('a jog that steps inward slides the inner edge out too', G => {
  const out = G.loopWithoutJogs(ring([[0, 0], [10, 0], [10, 10], [6, 10], [6, 11], [0, 11]]));
  return [JSON.stringify(out.points.map(p => [p.x, p.z])), '[[0,0],[10,0],[10,11],[0,11]]'];
});
check('four feet of step is a step, not a jog, and stays', G => {
  const out = G.loopWithoutJogs(ring([[0, 0], [10, 0], [10, 10], [6, 10], [6, 14], [0, 14]]));
  return [out.points.length, 6];
});
check("the caller's edge numbers follow the slide: the edge after the jog is still found", G => {
  const out = G.loopWithoutJogs(JOGGED_GARAGE);
  // edge 2 was (6,-1)->(6,21), the garage's front; edge 1 was the jog
  // itself and now reads as the edge before it; edge 5, (-20,0)->(0,0),
  // slid onto the outer line as the first edge.
  return [[out.edgeIndexOf.get(2), out.edgeIndexOf.get(1), out.edgeIndexOf.get(5)].join(','), '0,3,3'];
});
check('the stepped offset steps between a flush stretch and a rake on one line', G => {
  const out = G.offsetOutlineStepped(ring([[0, 0], [10, 0], [10, 10], [10, 20], [0, 20]]), ['eave', 'gable', 'gable', 'eave', 'eave'], [2, 2, 0, 2, 2]);
  return [JSON.stringify(out.points.map(p => [p.x, p.z])) + ' ' + K(out.edges) + ' ' + out.edgeOverhang.join(''), '[[-2,-2],[12,-2],[12,10],[10,10],[10,22],[-2,22]] egggee 220022'];
});

const MUTATIONS = [
  // BESIDE A TALLER WALL (Movie, 17 Oct).
  ['a block joined from two wings a foot apart is read as two',
    s => s.replace('          const widthClose = Math.abs(aw0 - bw0) <= JOG_FT + eps && Math.abs(aw1 - bw1) <= JOG_FT + eps;',
      '          const widthClose = Math.abs(aw0 - bw0) <= eps && Math.abs(aw1 - bw1) <= eps;')],
  ['a stub four feet narrower is joined into the block like a jog',
    s => s.replace('const JOG_FT = 1.5;', 'const JOG_FT = 4.1;')],
  ['a stub on the block\'s end is kept in the block under the wall rule',
    s => s.replace("        if (!onEnd || !narrower) continue;\n        const stack = [];", "        continue;\n        const stack = [];")],
  ['an arm in front of the gable wall stays in the block',
    s => s.replace('  const armsAt = noWall ? [] : [...wallSide.sharedWith.keys()].filter(liveWing);', '  const armsAt = [];')],
  ['the gable wall past the room is left an eave',
    s => s.replace("        (split.hit[i] ? flush : rake).push(i);", "        if (split.hit[i]) flush.push(i);")],
  ['the foot of step between two wall-side edges takes an overhang',
    s => s.replace("        && wallSide.vs.some(v => Math.abs(b[axis] - v) <= sliverFt + eps)) flush.push(i);", "        && false) flush.push(i);")],
  ['the front piece gables toward the room instead of shedding away',
    s => s.replace("      if (!away) rake.push(i);", "      rake.push(i);")],
  ['the front piece is not flush against the block',
    s => s.replace("    const split = splitWhere(armRing, p => inPrimary(p) || onWall(p));", "    const split = splitWhere(armRing, p => onWall(p));")],
  ['a foot of overlap is a bite to notch the block round',
    s => s.replace("    && Math.min(...primaryRing.map((a, i) => segDist(p, a, primaryRing[(i + 1) % primaryRing.length]))) > sliverFt);", "    );")],
  ['a wall grazing a sliver splits the ring',
    s => s.replace("  if (primaryAt < 0 || !(info[primaryAt].wallSide.wallLen > sliverFt)) {", "  if (primaryAt < 0) {")],
  ['a jog is left in the roof ring',
    s => s.replace('        if (jl < eps || jl > jogFt + eps) continue;', '        continue;')],
  ['a four-foot step is taken out like a jog',
    s => s.replace('  const ROOF_JOG_FT = 1.5;', '  const ROOF_JOG_FT = 4.1;')],
  ['the jog slides onto the inner line, leaving a foot of wall bare',
    s => s.replace('        const jOutward = !insideOf(probe, live);', '        const jOutward = insideOf(probe, live);')],
  ['the stepped offset slants like the variable one',
    s => s.replace("    out.push({ p: { x: v.x + cur.nx * dPrev, z: v.z + cur.nz * dPrev }, kind: { gable: true, over: 0 } });\n    out.push({ p: { x: v.x + cur.nx * d[i], z: v.z + cur.nz * d[i] }, kind });",
      "    out.push({ p: { x: v.x + cur.nx * d[i], z: v.z + cur.nz * d[i] }, kind });")],
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
    s => s.replace('\n      const narrower = (bhi - blo) < (ahi - alo) - 0.5 && blo >= alo - eps && bhi <= ahi + eps;',
      '\n      const narrower = (bhi - blo) < (ahi - alo) - 0.5;')],
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
