// premade-plans.js — the bungalow the drive-thru hands over.
//
// WHY A HARNESS AND NOT ONLY A SPEC. Every number in this design came out of
// Movie's sentences on 18 Sep, and the sentences overdetermine it: he gave the
// two widths AND the split they make (12 visible, 20 covered), the garage
// depth AND the odd wall that runs 27. That redundancy is the check. A plan
// that satisfies the widths but not the split is wrong in a way no screenshot
// would show -- a house and a garage that both measure right and meet in the
// wrong place.
//
// SO THE ASSERTIONS ARE THE SENTENCES, not the constants. Reading WIDTH_FT
// back and comparing it to 32 asserts nothing; measuring the piece of house
// wall the garage leaves exposed and finding 12 asserts the arrangement.
//
// Run: node proto/premade-plans-harness.js          (checks)
//      node proto/premade-plans-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'premade-plans.js');
// premade-plans.js reads the app's opening defaults (head height, window sill)
// out of geometry-2d.js rather than typing its own, so the window it is given
// has to have that module in it. Loaded from source into the SAME window the
// plan gets, not required as a node module: this harness's whole method is to
// run the subject's own text, and a mutation is applied to that text.
const GEO = path.join(__dirname, '..', 'geometry-2d.js');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', fs.readFileSync(GEO, 'utf8'))(window);
  new Function('window', src)(window);
  return window.DraftPremadePlans;
}

const n = v => Number(v).toFixed(3);

// The shoelace sign this app reads winding by, and build-house.js's
// outlineInteriorRef reads the same one.
const area2 = points => points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + (point.x * next.z - next.x * point.z);
}, 0);

const bbox = points => ({
  minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
  minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)),
});

// Every edge, as {from, to, len, axis}. A design of right angles has no
// diagonals, and that is itself worth checking.
const edges = points => points.map((point, index) => {
  const next = points[(index + 1) % points.length];
  const dx = next.x - point.x;
  const dz = next.z - point.z;
  return { from: point, to: next, dx, dz, len: Math.hypot(dx, dz) };
});

// The lengths of every edge, sorted, so a check can name a set rather than an
// order -- the winding is allowed to change without every check moving.
const lengths = points => edges(points).map(e => Number(e.len.toFixed(3)))
  .sort((a, b) => a - b).join(',');

// Do two axis-aligned rectangles' INTERIORS meet? Shared edges do not count:
// the garage is meant to sit against the house.
const overlaps = (a, b) => a.minX < b.maxX && b.minX < a.maxX
  && a.minZ < b.maxZ && b.minZ < a.maxZ;

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── the house ──
check('the house is a rectangle of four corners',
  P => [P.bungalow().house.length, 4]);

check('32 wide and 40 deep, which is the 1280 sq ft Movie called a good starter',
  P => { const b = bbox(P.bungalow().house);
         return [`${n(b.maxX - b.minX)}x${n(b.maxZ - b.minZ)}`, `${n(32)}x${n(40)}`]; });

check('and it is centred on the origin, where MODEL puts the middle of the screen',
  P => { const b = bbox(P.bungalow().house);
         return [`${n(b.minX + b.maxX)},${n(b.minZ + b.maxZ)}`, '0.000,0.000']; });

check('1 STOREY on its own comes with no garage',
  P => [P.bungalow().garage, null]);

check('every house corner is a whole foot',
  P => [P.bungalow().house.every(p => Number.isInteger(p.x) && Number.isInteger(p.z)), true]);

// ── the garage, measured as Movie described it ──
check('the garage is 24 across its door wall',
  P => { const g = P.bungalow({ garage: true }).garage;
         const door = edges(g).find(e => e.dz === 0 && e.from.z === bbox(g).maxZ);
         return [n(door.len), n(24)]; });

check('and every one of its corners is a whole foot too',
  P => [P.bungalow({ garage: true }).garage
    .every(p => Number.isInteger(p.x) && Number.isInteger(p.z)), true]);

// THE SENTENCE, NOT THE CONSTANT. This measures the piece of the house's front
// wall the garage leaves uncovered, which is the thing Movie actually said --
// "there will be 12ft of house visible".
check('12 ft of the house front is left visible beside the garage',
  P => { const plan = P.bungalow({ garage: true });
         const house = bbox(plan.house);
         const garage = bbox(plan.garage);
         return [n(garage.minX - house.minX), n(12)]; });

check('and the garage covers the other 20 of it',
  P => { const plan = P.bungalow({ garage: true });
         const house = bbox(plan.house);
         const garage = bbox(plan.garage);
         return [n(house.maxX - garage.minX), n(20)]; });

check('the garage-s right wall stands 4 ft proud of the house-s, toward the lot line',
  P => { const plan = P.bungalow({ garage: true });
         return [n(bbox(plan.garage).maxX - bbox(plan.house).maxX), n(4)]; });

// THE TWO SUMS THAT CLOSE. 12 + 20 = the house width and 20 + 4 = the garage
// width, which is how the reading of Movie's sentence was checked in the first
// place. A plan that got the arrangement wrong fails one of these even when
// both widths are right.
check('visible plus covered is the house width',
  P => { const plan = P.bungalow({ garage: true });
         const house = bbox(plan.house);
         const garage = bbox(plan.garage);
         return [n((garage.minX - house.minX) + (house.maxX - garage.minX)),
           n(house.maxX - house.minX)]; });

check('covered plus proud is the garage width',
  P => { const plan = P.bungalow({ garage: true });
         const house = bbox(plan.house);
         const garage = bbox(plan.garage);
         return [n((house.maxX - garage.minX) + (garage.maxX - house.maxX)),
           n(24)]; });

// ── the extra foot ──
check('one garage side runs 27 and the other 26',
  P => { const g = P.bungalow({ garage: true }).garage;
         const sides = edges(g).filter(e => e.dx === 0)
           .map(e => Number(e.len.toFixed(3))).sort((a, b) => a - b);
         return [sides.join(','), '1,26,27']; });

// The 1 ft in that list is the tie itself -- the run down the house's right
// wall. Named rather than left as an unexplained third number.
check('the long side is the one on the property-line side',
  P => { const g = P.bungalow({ garage: true }).garage;
         const box = bbox(g);
         const long = edges(g).filter(e => e.dx === 0)
           .find(e => Math.abs(e.len - 27) < 0.001);
         return [n(long.from.x), n(box.maxX)]; });

check('the exposed rear wall is 4 ft, which is the man-door-s',
  P => { const plan = P.bungalow({ garage: true });
         const houseFront = bbox(plan.house).maxZ;
         const rear = edges(plan.garage)
           .find(e => e.dz === 0 && e.from.z < houseFront);
         return [n(rear.len), n(4)]; });

check('and it sits one foot behind the house-s front line',
  P => { const plan = P.bungalow({ garage: true });
         const houseFront = bbox(plan.house).maxZ;
         const rear = edges(plan.garage)
           .find(e => e.dz === 0 && e.from.z < houseFront);
         return [n(houseFront - rear.from.z), n(1)]; });

// ── the two bodies ──
// "the garage won't overlap the house though the house square will be
// primary". The house is a rectangle and the garage's body is one too apart
// from the tie notch, so this is the bounding boxes minus the tie -- which is
// exactly the piece that is allowed to reach behind the front line.
// BOUNDING BOXES ARE THE WRONG INSTRUMENT HERE and the first draft of this
// check used them: the garage's box and the house's box DO overlap, in the
// one-foot strip the tie reaches into, while the garage's actual body does
// not. The box said the plan was broken when the plan was right. So the rule
// is stated the way Movie stated it -- the only part of the garage behind the
// house's front line is the tie, and the tie is entirely to the right of the
// house -- and measured on the garage's own corners.
check('nothing of the garage reaches into the house square but the tie',
  P => { const plan = P.bungalow({ garage: true });
         const house = bbox(plan.house);
         const behind = plan.garage.filter(point => point.z < house.maxZ);
         return [behind.length > 0 && behind.every(point => point.x >= house.maxX), true]; });

// AND THE BOXES ARE STILL ASKED, on the part of the garage that is clear of
// the house altogether: in front of the front line it may stand anywhere, and
// behind it the check above holds it to the tie.
check('the garage-s own rectangle clears the house entirely in front',
  P => { const plan = P.bungalow({ garage: true });
         const house = bbox(plan.house);
         const ahead = { ...bbox(plan.garage), minZ: house.maxZ };
         return [overlaps(house, ahead), false]; });

check('the garage stands in FRONT of the house, not behind it (+z is the front)',
  P => { const plan = P.bungalow({ garage: true });
         return [bbox(plan.garage).maxZ > bbox(plan.house).maxZ, true]; });

check('the two loops are wound the same way, so one rule reads both',
  P => { const plan = P.bungalow({ garage: true });
         return [Math.sign(area2(plan.house)), Math.sign(area2(plan.garage))]; });

// NO DIAGONALS. Every edge of both loops runs along an axis; a design of right
// angles that grew a slope would still close, still measure, and be wrong.
check('every edge of both loops is square',
  P => { const plan = P.bungalow({ garage: true });
         const all = [...edges(plan.house), ...edges(plan.garage)];
         return [all.every(e => e.dx === 0 || e.dz === 0), true]; });

check('the garage loop closes on six corners',
  P => [P.bungalow({ garage: true }).garage.length, 6]);

// ── the windows and doors ────────────────────────────────────────────────
//
// THE BEARING NUMBERS ARE WRITTEN OUT HERE, not imported, and that is the
// point: they are the INDEPENDENT WITNESS. geometry-2d.js's clamp is what
// refuses an opening that will not fit, and a harness that asked the clamp
// would be checking the clamp against itself. These are the same rule stated
// a second time, from MODEL.dc.html's own constants, so a design that drifts
// past what the clamp allows fails HERE -- at the design, where it is a
// drawing decision -- rather than silently at build time, where the opening
// just never appears.
//
//   a stud_2x6 is 5 1/2"        the carrier at each end of the opening
//   1 1/2" bearing              up to a 3 m span
//   3" bearing                  past it
const WALL_FT = 5.5 / 12;
const SPAN_FT = 3 / 0.3048;
const reserveFor = widthFt => WALL_FT + (widthFt > SPAN_FT ? 3 : 1.5) / 12;

const edgeOf = (points, index) => edges(points)[index];

// Every opening, paired with the edge it hangs on.
const placed = plan => [
  ...plan.houseOpenings.map(o => ({ o, edge: edgeOf(plan.house, o.edge), where: 'house' })),
  ...(plan.garageOpenings || []).map(o => ({ o, edge: edgeOf(plan.garage, o.edge), where: 'garage' })),
];

check('every opening names an edge the loop actually has',
  P => { const plan = P.bungalow({ garage: true });
         return [placed(plan).every(({ edge }) => !!edge), true]; });

// THE ONE THAT MATTERS. An opening wider than its wall can carry with the
// bearing left at each end is REFUSED by the clamp at build time -- it simply
// does not appear, and nothing says why. A design is the wrong place to find
// that out from.
check('every opening fits its wall with the bearing left at each end',
  P => { const plan = P.bungalow({ garage: true });
         const tight = placed(plan).filter(({ o, edge }) => {
           const reserve = reserveFor(o.widthFt);
           return o.offsetFt - o.widthFt / 2 < reserve - 1e-9
             || o.offsetFt + o.widthFt / 2 > edge.len - reserve + 1e-9;
         });
         return [tight.map(({ o }) => `${o.type}@${o.edge}:${o.offsetFt}`).join(','), '']; });

check('and no two openings on the same wall overlap',
  P => { const plan = P.bungalow({ garage: true });
         const clashes = [];
         placed(plan).forEach((a, i) => placed(plan).slice(i + 1).forEach(b => {
           if (a.where !== b.where || a.o.edge !== b.o.edge) return;
           const aa = [a.o.offsetFt - a.o.widthFt / 2, a.o.offsetFt + a.o.widthFt / 2];
           const bb = [b.o.offsetFt - b.o.widthFt / 2, b.o.offsetFt + b.o.widthFt / 2];
           if (aa[0] < bb[1] && bb[0] < aa[1]) clashes.push(`${a.o.type}/${b.o.type}`);
         }));
         return [clashes.join(','), '']; });

// NOTHING ON THE STRETCH THE GARAGE COVERS. Twenty of the house's thirty-two
// front feet are behind the garage, and a window there looks into it. This is
// the check the first draft of the design needed and did not have: it used the
// 12 ft VISIBLE width as an offset instead of the 20 ft covered one, and put
// both the front door and the front window inside the garage.
check('no front opening sits on the stretch the garage covers',
  P => { const plan = P.bungalow({ garage: true });
         const house = bbox(plan.house);
         const garage = bbox(plan.garage);
         const covered = house.maxX - garage.minX;
         const front = plan.houseOpenings.filter(o => o.edge === 2);
         return [front.every(o => o.offsetFt - o.widthFt / 2 >= covered), true]; });

check('the front carries a door, and it is the only door on the house',
  P => { const doors = P.bungalow().houseOpenings.filter(o => o.type === 'door');
         return [`${doors.length}@${doors.map(d => d.edge).join('')}`, '1@2']; });

check('every other wall of the house carries windows',
  P => { const plan = P.bungalow();
         const edgesWith = new Set(plan.houseOpenings
           .filter(o => o.type === 'window').map(o => o.edge));
         return [[...edgesWith].sort().join(','), '0,1,2,3']; });

// A HOUSE WITH NO GARAGE STILL HAS ITS WINDOWS. The openings belong to the
// house, not to the pairing, and a plain 1 STOREY that arrived blank would be
// the same defect this whole rung is about.
check('1 STOREY on its own still comes with its openings',
  P => [P.bungalow().houseOpenings.length > 0 && P.bungalow().garageOpenings === null, true]);

check('the garage door is 16 ft on the door wall, and says it is a garage door',
  P => { const plan = P.bungalow({ garage: true });
         const door = plan.garageOpenings.find(o => o.garage === true);
         const wall = edgeOf(plan.garage, door.edge);
         return [`${n(door.widthFt)} on a ${n(wall.len)} ft wall`, `${n(16)} on a ${n(24)} ft wall`]; });

// THE MAN-DOOR IS WHY THE 4 FT WALL EXISTS. Movie: the garage stands proud
// "so a man-door can be installed that leads on a path to backyard". Four feet
// is not four feet of door -- take the bearing off each end and 2'-10" of it
// is usable -- so this measures that the leaf FITS, not merely that it is
// there.
check('the man-door is on the exposed rear wall, and fits it',
  P => { const plan = P.bungalow({ garage: true });
         const man = plan.garageOpenings.find(o => o.garage !== true);
         const wall = edgeOf(plan.garage, man.edge);
         const room = wall.len - 2 * reserveFor(man.widthFt);
         return [`${n(wall.len)} ft wall, ${n(man.widthFt)} leaf, fits=${man.widthFt <= room}`,
           `${n(4)} ft wall, ${n(2.5)} leaf, fits=true`]; });

check('a door sits on the floor and a window does not',
  P => { const plan = P.bungalow({ garage: true });
         const all = [...plan.houseOpenings, ...plan.garageOpenings];
         return [all.every(o => (o.type === 'door' ? o.sillFt === 0 : o.sillFt > 0)), true]; });

check('and every opening has a head above its sill, which the format demands',
  P => { const plan = P.bungalow({ garage: true });
         const all = [...plan.houseOpenings, ...plan.garageOpenings];
         return [all.every(o => o.headFt > o.sillFt), true]; });

// ── the catalogue ──
check('the board offers a plan for 1 STOREY and 1 STOREY + GARAGE',
  P => [P.entryIds().sort().join(','), 'bungalow,bungalow-garage']);

check('and only the second of those carries a garage',
  P => [`${P.planFor('bungalow').garage},${P.planFor('bungalow-garage').garage !== null}`,
    'null,true']);

check('an entry with no design yet answers null rather than a wrong house',
  P => [P.planFor('bilevel'), null]);

// ── Mutations ──
const MUTATIONS = [
  ['the garage hangs off the wrong side of the house',
    s => s.replace('const right = houseRight + GARAGE_PAST_FT;',
      'const right = houseRight - GARAGE_PAST_FT;')],
  ['the garage is measured from the origin instead of from the house',
    s => s.replace('const right = houseRight + GARAGE_PAST_FT;',
      'const right = GARAGE_WIDTH_FT / 2;')],
  ['the extra foot goes on the left wall instead of the right',
    s => s.replace('pt(houseRight, tieZ),         // down the house-s right wall, the 1 ft tie'
      .replace('-s', "'s"), 'pt(houseRight, houseFront),')
      .replace('pt(left, houseFront),         // back to the house-s front wall'
        .replace('-s', "'s"), 'pt(left, tieZ), pt(left, houseFront),')],
  ['there is no tie at all -- the garage butts onto the front face',
    s => s.replace('const tieZ = houseFront - GARAGE_TIE_FT;',
      'const tieZ = houseFront;')],
  ['the tie reaches a foot too far into the house',
    s => s.replace('const tieZ = houseFront - GARAGE_TIE_FT;',
      'const tieZ = houseFront - GARAGE_TIE_FT * 2;')],
  ['the garage is laid out as a 26 x 24 rather than a 24 x 26',
    s => s.replace('const doorZ = houseFront + GARAGE_DEPTH_FT;',
      'const doorZ = houseFront + GARAGE_WIDTH_FT;')
      .replace('const left = right - GARAGE_WIDTH_FT;',
        'const left = right - GARAGE_DEPTH_FT;')],
  ['the garage stands behind the house instead of in front of it',
    s => s.replace('const doorZ = houseFront + GARAGE_DEPTH_FT;',
      'const doorZ = houseFront - GARAGE_DEPTH_FT - DEPTH_FT;')],
  ['the house is laid out 40 wide and 32 deep',
    s => s.replace('const halfW = WIDTH_FT / 2;\n    const halfD = DEPTH_FT / 2;',
      'const halfW = DEPTH_FT / 2;\n    const halfD = WIDTH_FT / 2;')],
  ['the house is built from the corner rather than centred',
    s => s.replace('pt(-halfW, -halfD), pt(halfW, -halfD), pt(halfW, halfD), pt(-halfW, halfD),',
      'pt(0, 0), pt(halfW * 2, 0), pt(halfW * 2, halfD * 2), pt(0, halfD * 2),')],
  ['1 STOREY comes with a garage nobody asked for',
    s => s.replace("bungalow: () => bungalow({ garage: false }),",
      "bungalow: () => bungalow({ garage: true }),")],
  ['an entry with no design gets the bungalow anyway',
    s => s.replace('const planFor = entryId => (PLANS[entryId] ? PLANS[entryId]() : null);',
      'const planFor = entryId => (PLANS[entryId] || PLANS.bungalow)();')],
  ['the front door is placed by the VISIBLE width instead of the covered one',
    s2 => s2.replace('const covered = GARAGE_WIDTH_FT - GARAGE_PAST_FT;',
      'const covered = WIDTH_FT - GARAGE_WIDTH_FT + GARAGE_PAST_FT;')],
  ['the man-door is a standard 3 ft leaf, which the 4 ft wall cannot carry',
    s2 => s2.replace('opening(1, GARAGE_PAST_FT / 2, 2.5, ', 'opening(1, GARAGE_PAST_FT / 2, 3, ')],
  ['the garage door is hung on the garage-s long wall instead of the door wall',
    s2 => s2.replace('opening(3, GARAGE_WIDTH_FT / 2, 16, ', 'opening(2, GARAGE_WIDTH_FT / 2, 16, ')],
  ['two front openings are given the same offset',
    s2 => s2.replace('opening(2, covered + 8.5, 4,', 'opening(2, covered + 3.5, 4,')],
  ['the windows sit on the floor like doors',
    s2 => s2.replace("sillFt: type === 'door' ? 0 : WINDOW_SILL_FT,", 'sillFt: 0,')],
  ['1 STOREY comes with no openings at all',
    s2 => s2.replace('    houseOpenings: houseOpenings(),', '    houseOpenings: [],')],
  ['the two loops are wound against each other',
    s => s.replace('      pt(houseRight, houseFront),   // where it leaves the house',
      '      ...[].concat(), pt(left, houseFront), pt(left, doorZ), pt(right, doorZ), pt(right, tieZ), pt(houseRight, tieZ), pt(houseRight, houseFront), ...[], // reversed\n      ...[], // was: pt(houseRight, houseFront),   // where it leaves the house')],
];

// ── Run ──
function run(P) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(P); } catch (err) { got = `THREW: ${err.message}`; want = '(no throw)'; }
    if (String(got) !== String(want)) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(66) + 'caught by');
  let survivors = 0, broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(66)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(66)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
