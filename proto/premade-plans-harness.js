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
    // AND EXACTLY ONCE. proto/mutant-anchors-harness.js makes this check for
    // every proto/*-mutants.js file and says why: the runners use
    // String.replace(find, with), which rewrites THE FIRST MATCH ONLY, so an
    // anchor occurring twice mutates whichever copy comes first -- quite
    // possibly not the branch the mutation is named for -- and still reports a
    // clean KILLED. But that gate globs `*-mutants.js` and this table lives in
    // a `*-harness.js`, so it has never looked here.
    //
    // AND THIS FILE HAS NOW BEEN BITTEN BY IT TWICE. The note on "1 STOREY
    // comes with no openings at all" records the first: `houseOpenings:
    // houseOpenings(),` matched the bungalow's block until 2 STOREY was
    // written above it, then silently became 2 STOREY's. The second was
    // 20 Sep -- `pt(-halfW, -halfD), pt(halfW, -halfD),` is also the opening
    // of houseLoop, so a mutant aimed at the wing loop trimmed the house.
    //
    // APPLIED TWICE, because the mutators here are opaque functions rather
    // than the {find, with} pairs that gate can read as data. A second pass
    // over the already-mutated text changes nothing when the anchor was
    // unique, and changes something more when it was not.
    if (mutate(next) !== next) {
      throw new Error('mutation anchor matches more than once -- replace() takes '
        + 'the FIRST, which may not be the code the mutation is named for');
    }
    src = next;
  }
  const window = {};
  new Function('window', fs.readFileSync(GEO, 'utf8'))(window);
  new Function('window', src)(window);
  return window.DraftPremadePlans;
}

// THE GEOMETRY MODULE THE PAGE ITSELF USES, loaded once and never mutated:
// every mutation here is to premade-plans.js, so this is the fixed ruler the
// designs are measured against. `load` hands back only DraftPremadePlans, and
// the checks below need edgeOnLoop -- the exact predicate MODEL.html raises
// walls through -- rather than a second opinion about what "shared" means.
const GEOM = (() => {
  const w = {};
  new Function('window', fs.readFileSync(GEO, 'utf8'))(w);
  return w.DraftGeometry2D;
})();

const n = v => Number(v).toFixed(3);
// The house's front line, which is where the garage roof's rear now sits.
const DEPTH_HALF = 20;

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

// IS THIS POINT ON THAT LOOP? Asked through edgeOnLoop with the point given
// as both ends, so it is the page's own predicate and the page's own epsilon
// rather than a second definition of "touching" that could drift from it.
const pointOn = (point, loop) => GEOM.edgeOnLoop(point, point, GEOM.loopSegments(loop));

// WHICH EDGES LIE ON `loop` FOR PART OF THEIR LENGTH BUT NOT ALL OF IT.
//
// This is the shape of the doubled-wall bug, stated once. MODEL.html skips a
// wall when edgeOnLoop says its edge is shared, and edgeOnLoop tests an edge
// END TO END -- by design, because a wall is raised whole or not at all. So an
// edge that runs along the house for twenty feet and then carries on past its
// corner answers "not shared", and the whole thing goes up: twenty feet of it
// standing in the same place as a house wall.
//
// SAMPLED BETWEEN THE ENDS, NEVER AT THEM. Two loops that merely meet at a
// corner share that one point, and a corner is not a run -- testing the
// endpoints would call every touching edge partly-shared and the check would
// be noise.
const partlyOn = (points, loop) => edges(points).filter(edge => {
  const at = t => ({ x: edge.from.x + edge.dx * t, z: edge.from.z + edge.dz * t });
  const on = [0.1, 0.3, 0.5, 0.7, 0.9].map(t => pointOn(at(t), loop));
  return on.some(Boolean) && !on.every(Boolean);
});

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
check('the board offers a plan for every entry that has one',
  P => [P.entryIds().sort().join(','),
    'bungalow,bungalow-garage,twoStorey,twoStorey-garage,twoStorey-over']);

// ── 2 STOREY ──
// Movie, 19 Sep: "make the 2 storey the same for now sizewise".

check('a 2 STOREY is the bungalow-s footprint, to the foot',
  P => { const a = bbox(P.bungalow().house), b = bbox(P.twoStorey().house);
         return [`${n(b.maxX - b.minX)}x${n(b.maxZ - b.minZ)}`,
           `${n(a.maxX - a.minX)}x${n(a.maxZ - a.minZ)}`]; });

check('and it says it has two storeys rather than leaving it to be inferred',
  P => [`${P.bungalow().storeys},${P.twoStorey().storeys}`, '1,2']);

// NO DOOR UPSTAIRS. The clamp would accept one and the drafter would find it
// on the elevation, opening into air.
check('the upper storey has windows and no doors',
  P => [P.twoStorey().upperOpenings.some(o => o.type === 'door'), false]);

// THE FRONT IS WHOLE UP THERE. On the ground floor the garage covers the
// first twenty feet of the front wall; the garage is a single storey, so
// upstairs that stretch looks over its roof and takes windows like any other.
check('the upper front carries more glass than the ground floor-s, because '
  + 'the garage is not in front of it',
  P => { const front = list => list.filter(o => o.edge === 2).length;
         const t = P.twoStorey({ garage: true });
         return [front(t.upperOpenings) > front(t.houseOpenings), true]; });

// ── THE ROOM OVER THE GARAGE ──
// Movie, 19 Sep: "put the 2nd story over the garage only 2/3 the garage
// length (make it about 18ft long by 24 or 26 wide" ... "so the front of the
// garage will have some roof on the main floor area".
//
// TWO SENTENCES, TWO SUMS, and the checks are the sums rather than the
// numbers: he gave a FRACTION and a LENGTH for the same edge, so they have to
// agree, and that agreement is a stronger reading than either alone.

// MEASURED FROM THE HOUSE'S FRONT LINE, not across the bounding box, and the
// change is what the tie forced. Movie's *"make it about 18ft long by 24 or 26
// wide"* is the room's own length; the bounding box now reads 19 because the
// proud four feet step back a foot onto the tie. Measuring the box would
// report a room a foot longer than it is, over four feet of its twenty-four.
//
// THE NOTCH IS CHECKED ON ITS OWN BELOW rather than folded in here, so "the
// room is 18 long" and "its corner reaches the tie" stay two facts that can
// fail separately.
check('the room over the garage is 24 wide by 18 long from the house-s front line',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const b = bbox(plan.overGarage), house = bbox(plan.house);
         return [`${n(b.maxX - b.minX)}x${n(b.maxZ - house.maxZ)}`, `${n(24)}x${n(18)}`]; });

// AND THE NOTCH IS FOUR FEET WIDE, the garage's own proud stretch -- not the
// whole back run, which is the half of the superseded ruling that was right.
check('and the tie notch is the proud 4 ft only, not the whole back run',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const house = bbox(plan.house);
         const onTie = edges(plan.overGarage)
           .filter(e => Math.abs(e.from.z - (house.maxZ - 1)) < 0.01
             && Math.abs(e.to.z - (house.maxZ - 1)) < 0.01);
         return [onTie.map(e => n(e.len)).join(','), n(4)]; });

// AND THIS CHECK'S EXACTNESS WAS LUCK, which only showed when the two bodies
// were made consistent. It compared the room's bounding box (18, with no tie)
// against the garage's (27, which HAS one) and landed on 2/3 to the digit --
// two unlike measurements whose ratio happened to be the round number Movie
// said. Now that the room takes the tie too, like for like is 19/27 = 0.704,
// or 18/26 = 0.692 measured from the house's front line. Neither is 2/3.
//
// So it is a tolerance around his word "only 2/3", which is what he actually
// said, rather than an equality that was never measuring what it claimed.
check('which is about two thirds of the garage-s length, his other way of saying it',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const over = bbox(plan.overGarage), garage = bbox(plan.garage);
         const ratio = (over.maxZ - over.minZ) / (garage.maxZ - garage.minZ);
         return [Math.abs(ratio - 2 / 3) < 0.05, true]; });

check('it sits over the garage-s own width, so its walls land on the walls below',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const over = bbox(plan.overGarage), garage = bbox(plan.garage);
         return [`${n(over.minX)},${n(over.maxX)}`, `${n(garage.minX)},${n(garage.maxX)}`]; });

// THE LEFTOVER IS THE POINT, not a remainder. Movie: "so the front of the
// garage will have some roof on the main floor area".
check('and it stops short of the door end, leaving garage roof at main-floor level',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const over = bbox(plan.overGarage), garage = bbox(plan.garage);
         return [garage.maxZ - over.maxZ > 6, true]; });

// A RULING OVERTURNED, 22 Sep. This check WAS the decision, and it read "it
// starts at the house's front wall, not a foot past it on the tie".
//
// Movie: *"where the garage hooks into the house the foundation, main floor
// and 2nd floor should connect all the same (1ft in from corner)"*, and, when
// three consistent readings were put to him, **(a)** -- all three at the tie.
// Measured on his own drawing beforehand: foundation and main floor connect at
// z = 19, the second floor at z = 20, so the upper wall stood a foot in front
// of the wall beneath it with nothing under it.
//
// THE ROOM'S BACK IS STILL THE HOUSE'S FRONT LINE over the stretch they share;
// what reaches the tie is the PROUD four feet, exactly as the garage below
// does it. So the test is the minimum z, which is now the tie.
check('it reaches the tie, so its proud corner stands over the garage wall below',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const house = bbox(plan.house), over = bbox(plan.overGarage);
         return [n(over.minZ), n(house.maxZ - 1)]; });

// AND THE SHARED STRETCH DID NOT MOVE, which is the half of the old ruling
// that was right: taking the WHOLE back run to the tie would bury twenty feet
// of it inside the house. Measured where the room meets the house, clear of
// the proud corner.
check('and its back run still sits on the house-s front line, not a foot inside it',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const house = bbox(plan.house);
         const backRun = edges(plan.overGarage)
           .filter(e => Math.abs(e.from.z - house.maxZ) < 0.01
             && Math.abs(e.to.z - house.maxZ) < 0.01);
         return [backRun.length > 0, true]; });

// The wall against the house is interior: a window there looks into the hall.
check('three windows, none of them on the wall against the house',
  P => { const o = P.twoStorey({ garage: true, overGarage: true }).overGarageOpenings;
         return [`${o.length},${o.some(x => x.edge === 0)}`, '3,false']; });

// ── AND THE WALL IT MUST NOT RAISE TWICE ──
//
// The room is wider than the piece of house it sits against: its back run
// starts inside the house's front wall and carries on past the house's right
// corner, because that is how far the garage sticks out. That run has to be
// TWO edges -- the shared stretch and the rest -- or the skip in MODEL.html
// cannot take it, and twenty feet of upper front wall gets built twice.
//
// THE CHECK IS THE GENERAL SHAPE, NOT THE VERTEX. Naming the corner would be
// satisfied by a loop that happens to list that point and is wrong everywhere
// else; "no edge is partly on the house" is the property the skip actually
// needs, and it goes on being the right question if the design changes size.
check('no edge of the room over the garage lies on the house for only part of itself',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         return [partlyOn(plan.overGarage, plan.house).length, 0]; });

// AND IT IS SHARED AT ALL, which the check above does not say: a room floating
// clear of the house has no partly-shared edge either, and would pass it.
// TWO EDGES NOW, and the second one is the tie -- which is not a new kind of
// thing but the pair MODEL.html's raiseLoop comment has always counted for the
// GARAGE below: "the 20 ft along the house's front wall is the one in the
// screenshot; the 1 ft TIE down the house's right wall is the same mistake a
// foot long". The room having the tie gives it the same pair, and the skip
// takes both whole.
check('two of its edges are shared with the house: 20 ft of front wall and the 1 ft tie',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const segs = GEOM.loopSegments(plan.house);
         const shared = edges(plan.overGarage)
           .filter(e => GEOM.edgeOnLoop(e.from, e.to, segs))
           .map(e => n(e.len)).sort();
         return [shared.join(','), [n(20), n(1)].sort().join(',')]; });

// THE EDGE NUMBERS ARE THE LOOP'S, and splitting an edge renumbers everything
// after it. Checked as a FIT rather than as a list of indices, because a list
// would have to be rewritten by the same hand that broke it: a window whose
// edge moved lands on a wall too short to hold it, and that is measurable.
check('every window in the room fits the edge it names, clear of both corners',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const es = edges(plan.overGarage);
         const bad = plan.overGarageOpenings.filter(o => {
           const edge = es[o.edge];
           return !edge || o.offsetFt - o.widthFt / 2 < 0.5
             || o.offsetFt + o.widthFt / 2 > edge.len - 0.5;
         });
         return [bad.length, 0]; });

// AND CENTRED ON IT, which fitting does not say. The tie made the right-hand
// wall a foot longer than the room, and premade-plans.js says in as many
// words what halving the room's length would then cost: "six inches off
// centre". That is a measurement, so it is measured -- to the half inch,
// twelve times tighter than the drift it is there to catch. A window six
// inches off centre in a 19 ft wall still fits it comfortably, so the check
// above sees nothing wrong with one.
check('and each window is centred on that edge, the tie-lengthened one included',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const es = edges(plan.overGarage);
         const off = plan.overGarageOpenings.filter(o =>
           !es[o.edge] || Math.abs(o.offsetFt - es[o.edge].len / 2) > 1 / 24);
         return [off.length, 0]; });

// ── WHAT THE GARAGE'S OWN ROOF COVERS ──
//
// A roof over the part of the garage the room stands on would be a roof
// INSIDE the building, under a floor. So the garage roof takes what the room
// leaves -- and on the designs with no room, that is the garage's full DEPTH.
//
// "ENTIRE" UNTIL 20 SEP, and the difference is the tie. This check compared
// the roof's edge lengths to the garage's and found them equal, which said
// the roof followed the footprint corner for corner -- jog and all. Movie
// ruled that jog out of the roof the same day ("it should be gabled on the
// house end (not cottage)"), so the roof is a rectangle on the house line
// now and the garage keeps its six-cornered walls. The rule the check was
// written for is unchanged: with no room over it, the garage roof reaches
// all the way back to the house rather than stopping at a stub.

check('a garage with nothing on it is roofed all the way back to the house',
  P => { const plan = P.twoStorey({ garage: true });
         const roof = bbox(plan.garageRoof), garage = bbox(plan.garage);
         return [`${n(roof.minZ)},${n(roof.maxZ)},${n(roof.minX)},${n(roof.maxX)}`,
           `${n(DEPTH_HALF)},${n(garage.maxZ)},${n(garage.minX)},${n(garage.maxX)}`]; });

check('and it stops at the house line rather than following the tie behind it',
  P => { const plan = P.twoStorey({ garage: true });
         return [`${n(bbox(plan.garageRoof).minZ)},${n(bbox(plan.garage).minZ)}`,
           `${n(DEPTH_HALF)},${n(DEPTH_HALF - 1)}`]; });

// ── AND A BUNGALOW'S GARAGE HAS NO ROOF OF ITS OWN ──
//
// This check read the other way round until 20 Sep -- that a bungalow's
// garage was roofed entire, through the same helper the 2 STOREY uses. Movie
// replaced the arrangement it was describing: "it doesn't know how to connect
// the garage and main floor roof - it is easy when they are the same height
// it would be like one large outline (ignore the line between house and
// garage and make the roof full perimter as house and garage".
//
// SAME HEIGHT IS THE CONDITION, so the two designs part here. A bungalow's
// garage stands on the same plate as its house and the two are ONE roof; a
// 2 STOREY's garage is deliberately single storey, so its roof is a storey
// down and still its own -- and the check above still holds it.
check('a bungalow-s garage is roofed by the house, so it has no roof of its own',
  P => [P.planFor('bungalow-garage').garageRoof, null]);

// THE PERIMETER OF BOTH BODIES, counted rather than described: a rectangle
// and a rectangle overlapping one of its edges make EIGHT corners. Four would
// be the house alone, which is the drawing this replaces.
check('and the house roof is raised over both of them',
  P => [P.planFor('bungalow-garage').houseRoof.length, 8]);

// THE 2 STOREY IS NOT SPLICED, which is the other half of the same rule --
// its roof is the house's footprint, four corners, with the garage's own
// roof a storey below and a valley between them that wants a cricket.
check('a 2 STOREY is not spliced, because its garage stands a storey lower',
  P => [P.planFor('twoStorey-garage').houseRoof.length, 4]);

// THE STUB IS THE PIECE MOVIE ASKED FOR. 19 Sep: "so the front of the garage
// will have some roof on the main floor area". It is checked as a JOIN rather
// than as a depth: the room's front wall and the stub's back edge are the same
// line, which is what stops a gap or an overlap between the two roofs.
check('a garage with a room on it is roofed from where the room stops',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const roof = bbox(plan.garageRoof), over = bbox(plan.overGarage);
         return [n(roof.minZ), n(over.maxZ)]; });

check('and carries on to the garage-s own far end',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const roof = bbox(plan.garageRoof), garage = bbox(plan.garage);
         return [n(roof.maxZ), n(garage.maxZ)]; });

check('over the garage-s full width, so the step down spans the front',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         const roof = bbox(plan.garageRoof), garage = bbox(plan.garage);
         return [`${n(roof.minX)},${n(roof.maxX)}`,
           `${n(garage.minX)},${n(garage.maxX)}`]; });

// THE ONE THAT SAYS WHY. The three above pin where the stub is; this pins
// what it must never be -- a sheet under the floor of the room above it.
check('and never reaches under the room, which would roof the inside of a house',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         return [overlaps(bbox(plan.garageRoof), bbox(plan.overGarage)), false]; });

check('no garage, no roof over one',
  P => [P.twoStorey({ overGarage: true }).garageRoof, null]);

check('no garage, no room over it',
  P => [P.twoStorey({ overGarage: true }).overGarage, null]);

check('and only the second of those carries a garage',
  P => [`${P.planFor('bungalow').garage},${P.planFor('bungalow-garage').garage !== null}`,
    'null,true']);

check('an entry with no design yet answers null rather than a wrong house',
  P => [P.planFor('bilevel'), null]);

// ── THE DETACHED GARAGE OFF THE BOARD ────────────────────────────────────
//
// A DIFFERENT KIND OF DESIGN, which is why it gets its own block. Everything
// above is fixed: the bungalow is 32 x 40 whatever anybody types, so its
// openings are constants and the checks read them back. A detached garage is
// whatever size the drafter asked for -- eight feet to sixty, off the board or
// typed -- so what is fixed here is the RULE, and a check that only looked at
// a 25x25 would pin one point on it.
//
// THE FIT IS THE WHOLE RISK. An opening wider than its wall can carry reaches
// the file, and then geometry-2d.js's clampOpeningToWall refuses it on every
// paint: the record is there, nothing draws it, and the drafter gets a garage
// that is shut on the plan, shut on the elevation and shut in 3D with no
// error anywhere. So the door widths are checked against THAT clamp -- the
// app's own, loaded above and never mutated -- rather than against arithmetic
// written out a second time here.
const STUD_2X6_FT = 5.5 / 12;
const STUD_2X4_FT = 3.5 / 12;

// A wall of this length with another wall standing at each end, which is what
// every wall of a four-sided garage has. The clamp reserves the carrier's own
// thickness plus the lintel bearing at each end, and a free end would reserve
// a 6x6 post instead -- a different number, and not this building's.
const clampOn = (lenFt, offsetFt, widthFt, tFt) => {
  const wall = { id: 'w', levelId: 1, view: 'plan',
    start: { x: 0, z: 0 }, end: { x: lenFt, z: 0 } };
  const ends = [
    { id: 'a', levelId: 1, view: 'plan', start: { x: 0, z: 0 }, end: { x: 0, z: -10 } },
    { id: 'b', levelId: 1, view: 'plan', start: { x: lenFt, z: 0 }, end: { x: lenFt, z: -10 } },
  ];
  return GEOM.clampOpeningToWall(wall, offsetFt, widthFt,
    { walls: [wall, ...ends], thicknessFt: () => tFt });
};

const detached = (P, widthFt, depthFt, tFt = STUD_2X6_FT) =>
  P.detachedGarageOpenings({ widthFt, depthFt, wallThicknessFt: tFt });
const onEdge = (list, edge) => list.find(o => o.edge === edge) || null;
// The sizes the board offers, plus the two ends of the typed range and a
// scatter between them -- 8 and 60 are build-menu.js's own bounds.
const SWEEP = (() => {
  const out = [];
  for (let w = 8; w <= 60; w += 0.5) out.push(w);
  return out;
})();

check('a 25x25 gets a window and two doors, one per wall',
  P => [detached(P, 25, 25).map(o => o.edge).join(','), '0,2,3']);

check('the overhead door is on the door wall, centred across it',
  P => { const door = onEdge(detached(P, 25, 25), 2);
         return [`${n(door.offsetFt)},${n(door.widthFt)},${door.type}`,
           `${n(12.5)},${n(16)},door`]; });

check('the man door is on the wall the house is on, centred along the depth',
  P => { const door = onEdge(detached(P, 25, 24), 3);
         return [`${n(door.offsetFt)},${n(door.widthFt)},${door.type}`,
           `${n(12)},${n(2.5)},door`]; });

check('the window is on the back wall, off both doors',
  P => { const win = onEdge(detached(P, 25, 25), 0);
         return [`${n(win.offsetFt)},${n(win.widthFt)},${win.type}`,
           `${n(12.5)},${n(3)},window`]; });

// ── THE 16x24 ON THE BOARD, which is the size that made this a rule ──────
//
// TWELVE, NOT SIXTEEN AND NOT NINE. Sixteen feet of door wall cannot carry a
// 16 ft leaf -- that is the whole reason the ladder exists -- and the next
// rung down that it CAN carry is the 12. Written out because the first draft
// of this check said 9: a 16 ft garage reads like a single bay, and the rule
// is not "a single bay gets a single door", it is "the widest the wall
// carries". Nine is what a narrower wall would get, and nothing here decides
// by what the size is called.
check("the 16 ft board size gets a 12 ft door, not the double it cannot carry",
  P => [n(onEdge(detached(P, 16, 24), 2).widthFt), n(12)]);

check('and that is not an opinion: the app-s own clamp refuses a 16 on that wall',
  P => [clampOn(16, 8, 16, STUD_2X6_FT), null]);

check('while the 12 it picks clears the same clamp without being moved',
  P => [n(clampOn(16, 8, 12, STUD_2X6_FT).offset), n(8)]);

// ── AND EVERY OTHER SIZE, not just the two on the board ──────────────────
//
// THE CLAMP IS THE JUDGE. For every width the board will accept, the door the
// ladder picked must be one the painter will draw, and it must sit where the
// design put it -- a door the clamp SLIDES is a door that is not centred on
// the wall any more, which on a garage is visible from the street.
check('every overhead door it picks clears the clamp, unmoved, at every size',
  P => { const bad = SWEEP.filter(w => {
           const door = onEdge(detached(P, w, 24), 2);
           if (!door) return false;
           const got = clampOn(w, door.offsetFt, door.widthFt, STUD_2X6_FT);
           return !got || Math.abs(got.offset - door.offsetFt) > 1e-9;
         });
         return [bad.join(','), '']; });

check('and every man door does, down the depth',
  P => { const bad = SWEEP.filter(d => {
           const door = onEdge(detached(P, 24, d), 3);
           if (!door) return false;
           const got = clampOn(d, door.offsetFt, door.widthFt, STUD_2X6_FT);
           return !got || Math.abs(got.offset - door.offsetFt) > 1e-9;
         });
         return [bad.join(','), '']; });

check('and every window does, across the back',
  P => { const bad = SWEEP.filter(w => {
           const win = onEdge(detached(P, w, 24), 0);
           if (!win) return false;
           const got = clampOn(w, win.offsetFt, win.widthFt, STUD_2X6_FT);
           return !got || Math.abs(got.offset - win.offsetFt) > 1e-9;
         });
         return [bad.join(','), '']; });

check('no opening is ever keyed to an edge the plot has not got',
  P => [SWEEP.flatMap(w => detached(P, w, w).map(o => o.edge))
    .filter(edge => !(edge >= 0 && edge <= 3)).join(','), '']);

// ── THE THICKNESS IS READ, NOT ASSUMED ───────────────────────────────────
//
// Ten feet of door wall is the length where the two framings disagree: a 2x4
// garage reserves an inch and a half less at each end than a 2x6 one, which
// is exactly the difference between a 9 ft door fitting and not.
check('a 2x4 garage carries a door its 2x6 twin cannot',
  P => [`${n(onEdge(detached(P, 10, 24, STUD_2X4_FT), 2).widthFt)},`
    + `${n(onEdge(detached(P, 10, 24, STUD_2X6_FT), 2).widthFt)}`,
    `${n(9)},${n(8)}`]);

check('and with no thickness given it guesses nothing at all',
  P => [P.detachedGarageOpenings({ widthFt: 25, depthFt: 25 }).length, 0]);

check('nor with no size given',
  P => [P.detachedGarageOpenings({ wallThicknessFt: STUD_2X6_FT }).length, 0]);

// AND A SIZE THAT IS NOT A SIZE IS REFUSED, which is the case the finite
// guard is actually there for. A missing width loses every comparison in
// `carries` and would deal nothing even unguarded; an INFINITE one wins them
// all, and the garage gets a window centred at infinity feet. NaN and
// Infinity are not the same bad number and only one of them fails safe.
check('and an infinite size is refused rather than dealt a window at infinity',
  P => [P.detachedGarageOpenings({ widthFt: Infinity, depthFt: Infinity,
    wallThicknessFt: STUD_2X6_FT }).length, 0]);

// ── THE BOX TOO NARROW FOR ANY STOCK DOOR ────────────────────────────────
//
// build-menu.js will accept a typed 8 x 8. No overhead door made is carried by
// eight feet of wall, so it gets none -- and it still gets the man door and the
// window, because the shed it is still wants a way in and some light.
check('an 8 ft box gets no overhead door, and still gets its man door and window',
  P => [detached(P, 8, 8).map(o => `${o.edge}:${o.type}`).join(','),
    '0:window,3:door']);

check('the overhead door is a garage door at 7 ft; the man door is neither',
  P => { const list = detached(P, 25, 25);
         const oh = onEdge(list, 2), man = onEdge(list, 3);
         return [`${oh.garage},${n(oh.headFt)},${man.garage},${n(man.headFt)}`,
           `true,${n(7)},false,${n(GEOM.DEFAULT_OPENING_HEAD_FT)}`]; });

// A WINDOW HANGS FROM THE HEAD, AND IT IS 4'-2" OF GLASS. Movie's ruling of
// 21 Sep put the head at 7'-0" and made the sill what falls out, so asking for
// DEFAULT_WINDOW_SILL_FT here stopped being the question -- that constant is
// now the SIZE's other half, not a position.
//
// THE SIZE IS WHAT THIS DESIGN OWNS, so the size is what is asked. It is the
// same 4'-2" these windows have always been, which is the whole reason "move
// to 7ft" moves them rather than reshaping them: a house rebuilt from the
// drive-thru has to agree with the same house opened from a file, and
// drawing-format.js migrates by keeping the size.
check('the window hangs from the 7 ft head, not off the floor',
  P => { const w = onEdge(detached(P, 25, 25), 0);
         return [`${n(w.headFt)} sill ${n(w.sillFt)}`,
           `${n(GEOM.DEFAULT_WINDOW_HEAD_FT)} sill `
           + `${n(GEOM.DEFAULT_WINDOW_HEAD_FT - (GEOM.DEFAULT_OPENING_HEAD_FT - GEOM.DEFAULT_WINDOW_SILL_FT))}`]; });

check('and it is the same 4 ft 2 in of glass it always was',
  P => { const w = onEdge(detached(P, 25, 25), 0);
         return [n(w.headFt - w.sillFt),
           n(GEOM.DEFAULT_OPENING_HEAD_FT - GEOM.DEFAULT_WINDOW_SILL_FT)]; });

// ── THE 2 STOREY'S ROOF, AND WHAT MUST STAY OUT OF IT ────────────────────
//
// Movie, 20 Sep, looking at the ROOF PLAN of a 2 STOREY + GARAGE + ROOM OVER:
// "the 2 storey roofs have same problem the 1 storeys had earlier". Measured
// before a line was changed:
//
//     house roof   z -20..20   at the two-storey plate
//     room over    z  20..38   ALSO at the two-storey plate
//     garage stub  z  38..46   one storey lower
//
// The room is on 2ND FL and FLUSH with it -- Movie, 19 Sep: "this one is even
// with the 2nd floor so will be considered 2nd floor" -- so it bears on the
// house's own plate, and two hips at one height meeting badly is the 1 STOREY
// defect exactly, one floor up.
//
// SO THE INTERESTING CHECKS ARE THE EXCLUSIONS. "Did the room get roofed with
// the house" is the easy half and one loop satisfies it; the half that can go
// wrong quietly is everything the splice must NOT swallow, because a body a
// storey lower under a two-storey hip is not a roof at all -- which is the
// very thing houseRoofLoop's storey test was written to refuse.
const inside = (pt, loop) => {
  let hit = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a.z > pt.z) !== (b.z > pt.z)
      && pt.x < (b.x - a.x) * (pt.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
};
const covers = (loop, pt) => inside(pt, loop) || pointOn(pt, loop);

const ROOM_PLAN = () => ({ garage: true, overGarage: true });

check('2 STOREY + ROOM OVER roofs the house and the room under one loop',
  P => [P.twoStorey(ROOM_PLAN()).houseRoof.length, 8]);

check('and every corner of the house is under it',
  P => { const plan = P.twoStorey(ROOM_PLAN());
         return [plan.house.filter(pt => !covers(plan.houseRoof, pt)).length, 0]; });

check('and every corner of the room is under it',
  P => { const plan = P.twoStorey(ROOM_PLAN());
         return [plan.overGarage.filter(pt => !covers(plan.houseRoof, pt)).length, 0]; });

check('and the middle of the room is under it, not just its corners',
  P => { const plan = P.twoStorey(ROOM_PLAN());
         const box = bbox(plan.overGarage);
         return [covers(plan.houseRoof,
           { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 }), true]; });

// ── AND NOW THE TWO THAT MATTER ──────────────────────────────────────────
//
// THE GARAGE STUB IS A STOREY LOWER. Movie: "make a single story garage". It
// keeps its own roof and the valley between the two is the CRICKET, which is
// not built -- fixing two hips at ONE height must not pretend to fix the one
// junction that genuinely has two.
check('the garage stub is NOT under the house roof -- it is a storey lower',
  P => { const plan = P.twoStorey(ROOM_PLAN());
         const box = bbox(plan.garageRoof);
         return [covers(plan.houseRoof,
           { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 }), false]; });

// THE TIE IS THE SUBTLE ONE, and its answer reversed on 22 Sep with Movie's
// ruling (a) -- see overGarageLoop for the measurement.
//
// IT USED TO BE EXCLUDED, and the reason was sound at the time: the tie is a
// 4 ft x 1 ft strip of GARAGE reaching back along the house's side wall
// (x 16..20, z 19..20), single storey like the rest of the garage, so a
// two-storey roof over it would be a roof over a body a floor lower.
//
// WHAT CHANGED IS THE BODY, NOT THE RULE. The room now reaches the tie, so
// the tie is two storeys where this roof covers it, and the storey test has
// nothing left to refuse. The rule that excluded it is the same rule that now
// includes it.
check('and the garage tie IS under it, because the room reaches the tie now',
  P => { const plan = P.twoStorey(ROOM_PLAN());
         return [covers(plan.houseRoof, { x: 18, z: 19.5 }), true]; });

// AND A 2 STOREY WITH NO ROOM STILL EXCLUDES IT, which is what keeps the old
// reasoning honest rather than merely overruled: with nothing standing on the
// tie it is single storey, and the roof leaves it alone exactly as before.
check('but a 2 STOREY with no room over the garage still leaves the tie out',
  P => [covers(P.twoStorey({ garage: true }).houseRoof, { x: 18, z: 19.5 }), false]);

check('and the bungalow-s loop DOES take its tie, because that garage is level with it',
  P => [covers(P.bungalow({ garage: true }).houseRoof, { x: 18, z: 19.5 }), true]);

check('the room has no roof of its own, which is the other half of the splice',
  P => [P.twoStorey(ROOM_PLAN()).overGarageRoof, null]);

// ── AND THE CASES THAT MUST NOT HAVE MOVED ───────────────────────────────
check('a 2 STOREY + GARAGE with no room is still the house alone -- that one wants the cricket',
  P => [P.twoStorey({ garage: true }).houseRoof.length, 4]);

check('and a 2 STOREY with no garage at all is too',
  P => [P.twoStorey({}).houseRoof.length, 4]);

check('the bungalow-s spliced loop is untouched, corner for corner',
  P => [JSON.stringify(P.bungalow({ garage: true }).houseRoof.map(pt => [pt.x, pt.z])),
    JSON.stringify([[-16, -20], [16, -20], [16, 19], [20, 19], [20, 46], [-4, 46],
      [-4, 20], [-16, 20]])]);

// THE TWO WINGS ARE ONE SHAPE, which is why they are one function. If this
// ever fails, the shared loop has grown a case and the sharing is a lie.
check('the two wing loops differ in z alone -- same widths, same x',
  P => { const room = P.twoStorey(ROOM_PLAN()).houseRoof;
         const gar = P.bungalow({ garage: true }).houseRoof;
         return [room.map(pt => pt.x).join(','), gar.map(pt => pt.x).join(',')]; });

check('and the spliced roof is wound the way every other loop here is',
  P => [Math.sign(area2(P.twoStorey(ROOM_PLAN()).houseRoof)),
    Math.sign(area2(P.twoStorey({}).house))]);

// ── THE SKELETON RESOLVES ON IT, which is not a given for this family ────
//
// This is the eight-corner, two-reflex-corner footprint that floated a ridge
// a full storey high until #439: roofSkeleton acted on the first of two
// simultaneous arrivals and left the second hanging off the ring as a spike.
// The bungalow's loop is the same family and carries that shape as the
// harness's Z case. A new member of it is checked, not assumed.
//
// SIX FEET IS THE ARITHMETIC, not a number read off a working build: the ring
// is offset by the 2 ft overhang, so it is 36 ft across the house, and a hip
// at 4:12 rises half of that times the pitch -- 18 x 4/12.
check('a hip over the spliced loop peaks where the arithmetic says, not a storey up',
  P => { const loop = P.twoStorey(ROOM_PLAN()).houseRoof.map(pt => ({ x: pt.x, z: pt.z }));
         const ring = GEOM.offsetOutline(loop, 2);
         const roof = { points: ring, edges: ring.map(() => 'eave'), pitch: 4, overhang: 2 };
         const faces = GEOM.roofFaces(roof, GEOM.roofSkeleton(roof));
         let peak = 0;
         faces.forEach(face => face.points.forEach(pt => {
           const h = GEOM.roofFaceRise(face, pt, 4);
           if (Number.isFinite(h) && h > peak) peak = h;
         }));
         return [n(peak), n(18 * 4 / 12)]; });

check('and it leaves no corner of the footprint unroofed',
  P => { const loop = P.twoStorey(ROOM_PLAN()).houseRoof.map(pt => ({ x: pt.x, z: pt.z }));
         const ring = GEOM.offsetOutline(loop, 2);
         const roof = { points: ring, edges: ring.map(() => 'eave'), pitch: 4, overhang: 2 };
         const faces = GEOM.roofFaces(roof, GEOM.roofSkeleton(roof));
         // Every corner of the BUILDING -- not the offset ring -- has to have
         // a face over it; a hole in the middle of a hip is what a dropped
         // skeleton arrival looks like from above.
         const missed = loop.filter(pt =>
           !faces.some(face => inside({ x: pt.x + 0.01, z: pt.z + 0.01 }, face.points)
             || inside({ x: pt.x - 0.01, z: pt.z - 0.01 }, face.points)));
         return [missed.length, 0]; });

// ── THE GARAGE ROOF'S HOUSE END ──────────────────────────────────────────
//
// Movie, 20 Sep, on the E4 RIGHT elevation of a 2 STOREY + GARAGE: "when the
// main floor garage roof connects to the house that has 2 storey it should be
// gabled on the house end (not cottage) i think this was a problem on model.dc
// but was solved". He ruled B of two readings: cut the roof on the HOUSE LINE
// rather than gable the jog.
//
// WHAT HE WAS LOOKING AT. garageLoop steps back a foot along the house's right
// wall so the foundations connect. Taking that jog into the roof leaves a four
// foot edge at z = 19 which is not on the house, so it hips -- a triangle of
// roof tucked against the house wall.
//
// AND THE FIX NEEDS A DECLARATION, not a better geometric test, which is the
// part worth checking rather than trusting. The rear runs the garage's full
// width and the house stops four feet short of it, so "does this edge lie on
// the house" answers NO for the very edge that most obviously is the house
// end. MODEL.dc.html reached the same conclusion: its open garages mark the
// closing edges gable BY INDEX (`index >= legCount - 1`), not by geometry.
const houseEndOf = plan => (plan.garageRoofHouseEnd || []);

// The page's own flush rule, replayed here: an edge is cut flush when the
// design NAMES it or when it lies on the body behind it, and flush carries
// both the gable and the zero overhang.
const flushKinds = (plan, against) => {
  const ring = plan.garageRoof.map(pt => ({ x: pt.x, z: pt.z }));
  const named = new Set(houseEndOf(plan));
  const shared = against ? GEOM.loopSegments(against) : null;
  const flushAt = i => named.has(i)
    || (shared ? GEOM.edgeOnLoop(ring[i], ring[(i + 1) % ring.length], shared) : false);
  const pts = GEOM.offsetOutlineVariable(ring,
    ring.map((_, i) => (flushAt(i) ? 0 : 2)));
  return ring.map((_, i) => (ring.length === pts.length && flushAt(i) ? 'gable' : 'eave'));
};

check('the garage roof is cut on the house line, not on the tie',
  P => { const plan = P.twoStorey({ garage: true });
         return [n(Math.min(...plan.garageRoof.map(pt => pt.z))), n(DEPTH_HALF)]; });

check('so the tie is behind it and not under it',
  P => { const plan = P.twoStorey({ garage: true });
         // The tie's own z -- one foot back of the house line -- must be
         // outside the roof's footprint entirely.
         return [plan.garageRoof.some(pt => pt.z < DEPTH_HALF), false]; });

check('and the roof loop is four corners, the jog gone',
  P => [P.twoStorey({ garage: true }).garageRoof.length, 4]);

check('the house end gables and the other three hip -- 2 STOREY + GARAGE',
  P => { const plan = P.twoStorey({ garage: true });
         return [flushKinds(plan, plan.house).join(','), 'gable,eave,eave,eave']; });

check('and the same with a room over it, where the stub dies into the room',
  P => { const plan = P.twoStorey({ garage: true, overGarage: true });
         return [flushKinds(plan, plan.overGarage).join(','), 'gable,eave,eave,eave']; });

// THE ONE THAT SAYS WHY THE DECLARATION EXISTS. Without it the no-room case
// hips at the house end, because the edge runs four feet past the house's
// corner and edgeOnLoop is end-to-end by design.
check('geometry alone cannot find that edge, which is why the design names it',
  P => { const plan = P.twoStorey({ garage: true });
         const ring = plan.garageRoof;
         return [GEOM.edgeOnLoop(ring[0], ring[1], GEOM.loopSegments(plan.house)), false]; });

check('the house end is edge 0 in both designs, so one index serves both',
  P => [`${houseEndOf(P.twoStorey({ garage: true })).join(',')}/`
    + `${houseEndOf(P.twoStorey({ garage: true, overGarage: true })).join(',')}`, '0/0']);

check('a design with no garage names no house end',
  P => [P.twoStorey({}).garageRoofHouseEnd, null]);

check('and the garage roof is wound like every other loop here',
  P => [Math.sign(area2(P.twoStorey({ garage: true }).garageRoof)),
    Math.sign(area2(P.twoStorey({}).house))]);

check('the stub with a room over is untouched by all of this',
  P => [JSON.stringify(P.twoStorey({ garage: true, overGarage: true })
    .garageRoof.map(pt => [pt.x, pt.z])),
  JSON.stringify([[-4, 38], [20, 38], [20, 46], [-4, 46]])]);

// ── Mutations ──
// ── THREE ANCHORS THE TIE MADE WORTH NAMING ONCE ─────────────────────────
//
// Several mutations below quote one of these three blocks of
// premade-plans.js. Written out at each use, each use was a place for the
// next rewrite of that function to miss -- and the rewrite of 22 Sep missed
// five, which is most of how this table came to hold nine anchors that
// matched nothing. No count here, for the reason .github/workflows/test.yml
// gives for not counting the engines: it changed twice while this was being
// written.
//
// ONE COPY IS NOT A GUARANTEE that the anchor is still right; it is a
// guarantee that when it goes wrong it goes wrong ONCE, in a named place,
// and load()'s two guards say which. Both of those guards -- matched nothing,
// matched twice -- are what caught this table out, so they are worth keeping
// cheap to answer.
const ROOM_BOUNDS = `    const back = houseFront;
    const tieZ = houseFront - GARAGE_TIE_FT;
    const front = back + OVER_GARAGE_LENGTH_FT;`;

const ROOM_RETURN = `    return [
      pt(left, back),          // the shared back run, along the house's front
      pt(houseRight, back),    // the house's own corner -- splits that run
      pt(houseRight, tieZ),    // down the house's right wall: the 1 ft tie
      pt(right, tieZ),         // the proud rear wall, over the garage's own
      pt(right, front),        // the long right side
      pt(left, front),         // the far end
    ];`;

const GARAGE_TIE_DECL = `    // One foot BEHIND the house's front line, which is the tie.
    const tieZ = houseFront - GARAGE_TIE_FT;`;

const MUTATIONS = [
  // ── THE GARAGE ROOF'S HOUSE END ──
  ['the roof follows the tie again, hipping four feet against the house wall',
    s2 => s2.replace('const back = houseFront + (overGarage ? OVER_GARAGE_LENGTH_FT : 0);',
      'const back = houseFront + (overGarage ? OVER_GARAGE_LENGTH_FT : -GARAGE_TIE_FT);')],
  ['the roof stops at the room-s front line even when there is no room',
    s2 => s2.replace('const back = houseFront + (overGarage ? OVER_GARAGE_LENGTH_FT : 0);',
      'const back = houseFront + OVER_GARAGE_LENGTH_FT;')],
  ['no edge is declared the house end, so geometry alone decides and misses it',
    s2 => s2.replace('const GARAGE_ROOF_HOUSE_END = Object.freeze([0]);',
      'const GARAGE_ROOF_HOUSE_END = Object.freeze([]);')],
  ['the wrong edge is declared the house end -- the garage-s long side',
    s2 => s2.replace('const GARAGE_ROOF_HOUSE_END = Object.freeze([0]);',
      'const GARAGE_ROOF_HOUSE_END = Object.freeze([1]);')],
  ['the design stops naming its house end at all',
    s2 => s2.replace('    garageRoofHouseEnd: garage ? GARAGE_ROOF_HOUSE_END : null,',
      '    garageRoofHouseEnd: null,')],
  ['a design with no garage names a house end anyway',
    s2 => s2.replace('    garageRoofHouseEnd: garage ? GARAGE_ROOF_HOUSE_END : null,',
      '    garageRoofHouseEnd: GARAGE_ROOF_HOUSE_END,')],
  // ── THE 2 STOREY'S SPLICE ──
  // ANCHORED ON THE WING LOOP'S OWN BLOCK, not on the two points. The first
  // draft of this mutant used `pt(-halfW, -halfD), pt(halfW, -halfD),` alone,
  // which is ALSO the opening of houseLoop twelve lines up -- so it trimmed
  // the HOUSE, both loops moved together, and the check it was aimed at
  // passed while a different one failed. The same trap this file already
  // records for `houseOpenings: houseOpenings(),`, sprung a second way.
  ['the house itself is trimmed out of the wing loop-s back corner',
    s2 => s2.replace('      pt(-halfW, -halfD), pt(halfW, -halfD),\n      pt(halfW, backZ),',
      '      pt(-halfW + 4, -halfD), pt(halfW, -halfD),\n      pt(halfW, backZ),')],
  ['the wing-s far end is wound backwards, tying the loop into a bowtie',
    s2 => s2.replace('      pt(right, frontZ),      // down the wing-s long side\n      pt(left, frontZ),       // its far end'.replace('wing-s', "wing's"),
      '      pt(left, frontZ),\n      pt(right, frontZ),')],
  ['every wing loop is wound the other way round',
    s2 => s2.replace('      pt(left, halfD),        // back up to the house-s front line\n      pt(-halfW, halfD),\n    ];'.replace('house-s', "house's"),
      '      pt(left, halfD),\n      pt(-halfW, halfD),\n    ].reverse();')],
  ['a house with no wing at all is given one anyway',
    s2 => s2.replace('    return garage && storeys === 1 ? houseGarageLoop() : houseLoop();',
      '    return garage && storeys === 1 ? houseGarageLoop() : houseRoomLoop();')],
  // ── THE SEVEN THAT THE TIE LEFT AIMING AT NOTHING, 22 SEP ─────────────
  //
  // Movie's ruling (a) rewrote overGarageLoop, overGarageOpenings and
  // houseRoomLoop, and seven mutations in this table went on quoting the text
  // those rewrites replaced. An anchor that matches nothing is not a passing
  // mutation, it is an absent one -- load() throws on it, --mutate counts it
  // "never applied", and the exit code says so. That is the whole point of
  // running this table in CI both ways.
  //
  // INVERTED, and it is the same mutation as before. It used to ADD the tie
  // to the room's roof loop, because the loop stopped at the house's front
  // line and the tie was the error. The ruling made the tie the code, so what
  // now proves the check is the edit that TAKES IT AWAY.
  ['the room-s roof loop stops at the house-s front line, dropping the tie again',
    s2 => s2.replace('houseWingLoop(DEPTH_FT / 2 - GARAGE_TIE_FT, DEPTH_FT / 2 + OVER_GARAGE_LENGTH_FT)',
      'houseWingLoop(DEPTH_FT / 2, DEPTH_FT / 2 + OVER_GARAGE_LENGTH_FT)')],
  ['the room-s loop runs to the garage door, swallowing the stub a storey below',
    s2 => s2.replace('houseWingLoop(DEPTH_FT / 2 - GARAGE_TIE_FT, DEPTH_FT / 2 + OVER_GARAGE_LENGTH_FT)',
      'houseWingLoop(DEPTH_FT / 2 - GARAGE_TIE_FT, DEPTH_FT / 2 + GARAGE_DEPTH_FT)')],
  ['the room is never spliced in, so it keeps meeting the house roof badly',
    s2 => s2.replace('if (garage && overGarage) return houseRoomLoop();',
      'void overGarage;')],
  ['the splice stops asking about the room, so a plain 2 STOREY + GARAGE gets it too',
    s2 => s2.replace('if (garage && overGarage) return houseRoomLoop();',
      'if (garage) return houseRoomLoop();')],
  ['the room is given a roof of its own as well, so it gets one UNDER the house-s',
    s2 => s2.replace('    overGarageRoof: null,',
      '    overGarageRoof: overGarage && garage ? overGarageLoop() : null,')],
  ['the wing loop loses the corner where the house wall meets it',
    s2 => s2.replace('      pt(halfW, backZ),       // up the house-s right wall as far as the wing\n'
      .replace('house-s', "house's"), '')],
  ['the bungalow-s loop forgets its tie, which IS at its garage-s height',
    s2 => s2.replace('houseWingLoop(DEPTH_FT / 2 - GARAGE_TIE_FT, DEPTH_FT / 2 + GARAGE_DEPTH_FT)',
      'houseWingLoop(DEPTH_FT / 2, DEPTH_FT / 2 + GARAGE_DEPTH_FT)')],
  ['the wing is squared off at the house width, so it stands proud of nothing',
    s2 => s2.replace('    const right = halfW + GARAGE_PAST_FT;\n    const left = right - GARAGE_WIDTH_FT;\n    return [\n      pt(-halfW, -halfD), pt(halfW, -halfD),\n      pt(halfW, backZ),',
      '    const right = halfW;\n    const left = right - GARAGE_WIDTH_FT;\n    return [\n      pt(-halfW, -halfD), pt(halfW, -halfD),\n      pt(halfW, backZ),')],
  // ── THE DETACHED GARAGE ──
  ['the overhead door is hung on the right wall instead of the door wall',
    s2 => s2.replace("out.push(opening(2, w / 2, overhead, 'door',",
      "out.push(opening(1, w / 2, overhead, 'door',")],
  ['the ladder is climbed from the bottom, so every garage gets the narrowest door',
    s2 => s2.replace('Object.freeze([16, 12, 10, 9, 8])', 'Object.freeze([8, 9, 10, 12, 16])')],
  ['the door is written whether the wall can carry it or not',
    s2 => s2.replace('const overhead = widestDoorFor(w, t);',
      'const overhead = OVERHEAD_DOOR_WIDTHS_FT[0];')],
  ['the lintel bears at one end only',
    s2 => s2.replace('wallLengthFt >= widthFt + 2 * (wallThicknessFt',
      'wallLengthFt >= widthFt + 1 * (wallThicknessFt')],
  ['the bearing is left out and only the wall it runs into is reserved',
    s2 => s2.replace('(wallThicknessFt + G.openingBearingFt(widthFt))',
      '(wallThicknessFt + 0 * G.openingBearingFt(widthFt))')],
  ['the man door goes on the right wall, away from the house',
    s2 => s2.replace("out.push(opening(3, d / 2, MAN_DOOR_WIDTH_FT, 'door'));",
      "out.push(opening(1, d / 2, MAN_DOOR_WIDTH_FT, 'door'));")],
  ['the overhead door is hung off the corner instead of centred',
    s2 => s2.replace("out.push(opening(2, w / 2, overhead, 'door',",
      "out.push(opening(2, 0, overhead, 'door',")],
  ['the overhead door heads at the house-s own door height',
    s2 => s2.replace("        { garage: true, headFt: GARAGE_DOOR_HEAD_FT }));",
      "        { garage: true }));")],
  ['what the garage is framed in is ignored',
    s2 => s2.replace('const t = Number(wallThicknessFt);', 'const t = 0;')],
  ['the window is put on the door wall, through the overhead door',
    s2 => s2.replace("out.push(opening(0, w / 2, GARAGE_WINDOW_WIDTH_FT, 'window'));",
      "out.push(opening(2, w / 2, GARAGE_WINDOW_WIDTH_FT, 'window'));")],
  ['the size is taken on trust, so an infinite garage is dealt openings',
    s2 => s2.replace('if (!Number.isFinite(w) || !Number.isFinite(d) || !Number.isFinite(t)) return [];',
      'if (!Number.isFinite(t)) return [];')],
  ['a missing size falls back to a default one instead of being refused',
    s2 => s2.replace(`const w = Number(widthFt);
    const d = Number(depthFt);`, `const w = Number(widthFt) || 24;
    const d = Number(depthFt) || 24;`)],
  ['the window is patio-sized and written whether the back wall carries it or not',
    s2 => s2.replace(`if (carries(w, GARAGE_WINDOW_WIDTH_FT, t)) {
      out.push(opening(0, w / 2, GARAGE_WINDOW_WIDTH_FT, 'window'));`,
    `if (true) {
      out.push(opening(0, w / 2, 8, 'window'));`)],
  ['the man door is a 7 ft pair, written whether the wall carries it or not',
    s2 => s2.replace(`if (carries(d, MAN_DOOR_WIDTH_FT, t)) {
      out.push(opening(3, d / 2, MAN_DOOR_WIDTH_FT, 'door'));`,
    `if (true) {
      out.push(opening(3, d / 2, 7, 'door'));`)],
  ['the man door is keyed one past the last edge of the plot',
    s2 => s2.replace("out.push(opening(3, d / 2, MAN_DOOR_WIDTH_FT, 'door'));",
      "out.push(opening(4, d / 2, MAN_DOOR_WIDTH_FT, 'door'));")],
  ['the room over the garage covers the whole garage',
    s2 => s2.replace('const OVER_GARAGE_LENGTH_FT = 18;',
      'const OVER_GARAGE_LENGTH_FT = 27;')],
  // RE-ANCHORED: `tieZ` is declared between the two lines this used to name,
  // so the old anchor spanned a line that is no longer there.
  ['the room over the garage is at the door end instead of against the house',
    s2 => s2.replace(ROOM_BOUNDS, `    const front = houseFront + GARAGE_DEPTH_FT;
    const back = front - OVER_GARAGE_LENGTH_FT;
    const tieZ = back - GARAGE_TIE_FT;`)],
  // AND THE ROOM'S OWN TIE, which no mutation covered because until the
  // ruling the room had none: this is the five-point loop it had the day
  // before, with the proud corner square on the house's front line and
  // nothing under the foot of second floor beside it.
  ['the room over has no tie, so its proud corner overhangs the garage wall below',
    s2 => s2.replace(ROOM_RETURN, `    return [
      pt(left, back),
      pt(houseRight, back),
      pt(right, back),
      pt(right, front),
      pt(left, front),
    ];`)],
  // RE-ANCHORED: the tie gave this loop two more points, so both of these
  // named a five-point return that no longer exists.
  ['the room over is narrower than the garage it sits on',
    s2 => s2.replace(ROOM_RETURN, `    return [
      pt(left + 2, back),
      pt(houseRight, back),
      pt(houseRight, tieZ),
      pt(right - 2, tieZ),
      pt(right - 2, front),
      pt(left + 2, front),
    ];`)],
  // THE CORNER GOES BACK, and the loop is a rectangle again -- which is what
  // it was, and what let the skip in MODEL.html miss the shared stretch.
  ['the room-s back wall is one run again, partly on the house and raised whole',
    s2 => s2.replace(ROOM_RETURN,
      '    return [pt(left, back), pt(right, back), pt(right, front), pt(left, front)];')],
  // AND THE OTHER READING OF THE RULING, the one premade-plans.js names and
  // refuses in as many words: take the WHOLE back run to the tie rather than
  // the proud four feet, and twenty of its feet lie a foot inside the house.
  // Nothing tested that refusal until the ruling made it worth stating.
  ['the room-s whole back run goes to the tie, burying 20 ft of it in the house',
    s2 => s2.replace(ROOM_RETURN,
      '    return [pt(left, tieZ), pt(right, tieZ), pt(right, front), pt(left, front)];')],
  // The loop keeps its corner; the WINDOWS forget the tie moved them along.
  ['the room-s windows keep the edge numbers they had before the tie',
    s2 => s2.replace(`    doubleCasement(3, (OVER_GARAGE_LENGTH_FT + GARAGE_TIE_FT) / 2),
    doubleCasement(4, GARAGE_WIDTH_FT / 2),
    doubleCasement(5, OVER_GARAGE_LENGTH_FT / 2),`,
    `    doubleCasement(2, (OVER_GARAGE_LENGTH_FT + GARAGE_TIE_FT) / 2),
    doubleCasement(3, GARAGE_WIDTH_FT / 2),
    doubleCasement(4, OVER_GARAGE_LENGTH_FT / 2),`)],
  // AND THE TIE LENGTHENED THE WALL THAT WINDOW SITS IN. premade-plans.js
  // says what the old number would cost -- "six inches off centre" -- and
  // that is a measurement, so this is the mutant that takes it. The window
  // still FITS its wall, so the fit check above cannot see this one.
  ['the room-s right-side window is centred on the room, not on its lengthened wall',
    s2 => s2.replace("    doubleCasement(3, (OVER_GARAGE_LENGTH_FT + GARAGE_TIE_FT) / 2),",
      "    doubleCasement(3, OVER_GARAGE_LENGTH_FT / 2),")],
  ['a 2 STOREY is bigger than the 1 STOREY beside it on the board',
    s2 => s2.replace('  const twoStorey = ({ garage = false, overGarage = false } = {}) => ({\n    house: houseLoop(),',
      '  const twoStorey = ({ garage = false, overGarage = false } = {}) => ({\n'
      + '    house: houseLoop().map(p => pt(p.x * 1.2, p.z)),')],
  ['the 2 STOREY forgets it has two storeys',
    s2 => s2.replace('    upperOpenings: upperOpenings(),\n    storeys: 2,',
      '    upperOpenings: upperOpenings(),\n    storeys: 1,')],
  ['a door is dealt upstairs, opening into air',
    s2 => s2.replace(`  const upperOpenings = () => [
    // Front: three across the whole width, since nothing is in front of it.
    opening(2, 8, 4, 'window'),`,
    `  const upperOpenings = () => [
    // Front: three across the whole width, since nothing is in front of it.
    opening(2, 8, 4, 'door'),`)],
  // THE ROOM IS FORGOTTEN WHEN THE ROOF IS CUT: the garage is roofed entire,
  // and the sheet runs under the floor of the room standing on it.
  // RE-AIMED 20 SEP. Both of these anchored on garageRoofLoop's old body --
  // `if (!overGarage) return loop;` and a `back` computed unconditionally --
  // and the house-end rewrite took both lines away. The guard in load() said
  // so on the first run; before it existed they would have gone on reporting
  // clean kills while testing nothing, which is the rot
  // proto/mutant-anchors-harness.js was built for and does not look here.
  //
  // They are ONE mutation now, because the rewrite made them one: with the
  // roof's rear computed from a single `back`, "roofed entire despite the
  // room" and "cut from the house rather than from the room" are the same
  // edit. The second name is kept, being the more precise of the two.
  //
  // The stub is cut from the house instead of from where the room ends, so
  // it reaches back under the room.
  ['the garage roof starts at the house instead of where the room stops',
    s2 => s2.replace('const back = houseFront + (overGarage ? OVER_GARAGE_LENGTH_FT : 0);',
      'const back = houseFront;')],
  // It stops short of the garage door end, leaving the front unroofed.
  ['the garage roof stops short of the garage-s own front',
    s2 => s2.replace('    const front = houseFront + GARAGE_DEPTH_FT;',
      '    const front = houseFront + GARAGE_DEPTH_FT - 4;')],
  ['the room over gets a window in the wall against the house',
    s2 => s2.replace('    doubleCasement(3, (OVER_GARAGE_LENGTH_FT + GARAGE_TIE_FT) / 2),',
      '    doubleCasement(0, (OVER_GARAGE_LENGTH_FT + GARAGE_TIE_FT) / 2),')],
  // ── FOUR ANCHORS THAT WERE POINTING AT THE WRONG FUNCTION ──────────────
  //
  // Found on 20 Sep the moment load() began refusing an anchor that matches
  // more than once. `const right = houseRight + GARAGE_PAST_FT;` occurs THREE
  // times -- garageLoop, overGarageLoop, garageRoofLoop -- and
  // `const left = right - GARAGE_WIDTH_FT;` FOUR. String.replace takes the
  // first, so every one of these had been mutating garageLoop or houseLoop by
  // luck of file order rather than by aim, and reporting clean kills for it.
  //
  // They were ambiguous on merged main too, not introduced by the wing-loop
  // extraction: the counts are identical either side of it. The extraction is
  // only what made somebody look.
  //
  // RE-ANCHORED ON A BLOCK EACH FUNCTION ALONE HAS. garageLoop is the only one
  // that goes on to compute `doorZ`, and houseLoop is the only `halfW/halfD`
  // pair that is followed by a bare four-corner return.
  ['the garage hangs off the wrong side of the house',
    s => s.replace(`    const right = houseRight + GARAGE_PAST_FT;\n    const left = right - GARAGE_WIDTH_FT;\n    const doorZ = houseFront + GARAGE_DEPTH_FT;`,
      `    const right = houseRight - GARAGE_PAST_FT;\n    const left = right - GARAGE_WIDTH_FT;\n    const doorZ = houseFront + GARAGE_DEPTH_FT;`)],
  ['the garage is measured from the origin instead of from the house',
    s => s.replace(`    const right = houseRight + GARAGE_PAST_FT;\n    const left = right - GARAGE_WIDTH_FT;\n    const doorZ = houseFront + GARAGE_DEPTH_FT;`,
      `    const right = GARAGE_WIDTH_FT / 2;\n    const left = right - GARAGE_WIDTH_FT;\n    const doorZ = houseFront + GARAGE_DEPTH_FT;`)],
  ['the extra foot goes on the left wall instead of the right',
    s => s.replace('pt(houseRight, tieZ),         // down the house-s right wall, the 1 ft tie'
      .replace('-s', "'s"), 'pt(houseRight, houseFront),')
      .replace('pt(left, houseFront),         // back to the house-s front wall'
        .replace('-s', "'s"), 'pt(left, tieZ), pt(left, houseFront),')],
  // AND A FIFTH, FOUND THE SAME WAY, 22 SEP. These two named
  // `const tieZ = houseFront - GARAGE_TIE_FT;`, which was garageLoop's alone
  // until the room took the tie as well -- and then matched twice. The guard
  // refused them rather than let them mutate whichever copy came first, which
  // is the section header above working exactly as it was written to.
  //
  // RE-ANCHORED ON THE COMMENT, because that is what garageLoop's copy has
  // and the room's has not: the room's tie is declared under a long note
  // about the ruling, between `back` and `front`.
  ['there is no tie at all -- the garage butts onto the front face',
    s => s.replace(GARAGE_TIE_DECL, `    // One foot BEHIND the house's front line, which is the tie.
    const tieZ = houseFront;`)],
  ['the tie reaches a foot too far into the house',
    s => s.replace(GARAGE_TIE_DECL, `    // One foot BEHIND the house's front line, which is the tie.
    const tieZ = houseFront - GARAGE_TIE_FT * 2;`)],
  ['the garage is laid out as a 26 x 24 rather than a 24 x 26',
    s => s.replace(`    const right = houseRight + GARAGE_PAST_FT;\n    const left = right - GARAGE_WIDTH_FT;\n    const doorZ = houseFront + GARAGE_DEPTH_FT;`,
      `    const right = houseRight + GARAGE_PAST_FT;\n    const left = right - GARAGE_DEPTH_FT;\n    const doorZ = houseFront + GARAGE_WIDTH_FT;`)],
  ['the garage stands behind the house instead of in front of it',
    s => s.replace('const doorZ = houseFront + GARAGE_DEPTH_FT;',
      'const doorZ = houseFront - GARAGE_DEPTH_FT - DEPTH_FT;')],
  ['the house is laid out 40 wide and 32 deep',
    s => s.replace(`    const halfW = WIDTH_FT / 2;\n    const halfD = DEPTH_FT / 2;\n    return [\n      pt(-halfW, -halfD), pt(halfW, -halfD), pt(halfW, halfD), pt(-halfW, halfD),`,
      `    const halfW = DEPTH_FT / 2;\n    const halfD = WIDTH_FT / 2;\n    return [\n      pt(-halfW, -halfD), pt(halfW, -halfD), pt(halfW, halfD), pt(-halfW, halfD),`)],
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
  // ANCHORED ON THE BUNGALOW'S OWN BLOCK, not on the field name. This read
  // `houseOpenings: houseOpenings(),` and hit the FIRST one in the file --
  // which was the bungalow's until 2 STOREY was written above it, and then
  // silently became 2 STOREY's. The mutation went on applying and the check
  // it was meant to trip went on passing, which is a mutation that proves
  // nothing while looking like one that proves something.
  ['1 STOREY comes with no openings at all',
    s2 => s2.replace(`  const bungalow = ({ garage = false } = {}) => ({
    house: houseLoop(),
    houseOpenings: houseOpenings(),`,
    `  const bungalow = ({ garage = false } = {}) => ({
    house: houseLoop(),
    houseOpenings: [],`)],
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
