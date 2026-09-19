// WHAT A ROOF DOES OVER A FOOTPRINT THAT IS NOT ONE RECTANGLE.
//
// Movie, 19 Sep: "it doesn't know how to connect the garage and main floor
// roof - it is easy when they are the same height it would be like one large
// outline (ignore the line between house and garage and make the roof full
// perimter as house and garage". Making that one outline is a one-line change
// in premade-plans.js. What it lands on is roofSkeleton(), and that is where
// the trouble was: the union of a house and a garage is a footprint with TWO
// reflex corners, one wing proud of the other and one inset, and on that shape
// the wavefront walked out of the building.
//
// THE SHAPE THAT BROKE IT, and the two neighbours that did not:
//
//   L,  one reflex corner                       6 planes, peak 6.000  ok
//   T,  two reflex, the arm inside the width    8 planes, peak 6.000  ok
//   Z,  two reflex, the arm proud AND inset     6 planes, peak 10.667 WRONG
//
// 10.667 ft of rise on a 4/12 roof is 32 ft of run -- the full width of the
// house, where the true answer is half of it. The roof floated because two
// reflex corners reached the shrinking ring AT THE SAME INSTANT and only the
// first was acted on; the second was left as a zero-width spike hanging off
// the new loop, and the corner at the base of that spike then travelled
// OUTWARD. Nothing downstream could tell: the planes still tiled the footprint
// exactly, so an area check passes against the defect. It takes reading the
// peak, or counting the planes, to see it.
//
// WHAT THESE CHECKS ASSERT, and why each one can fail:
//
//   * one roof plane per eave edge. A hip roof puts exactly one plane on each
//     eave -- no more (a plane split in two) and no fewer (a plane swallowed
//     by its neighbour, which is what happened here: 6 planes on 8 eaves).
//   * the planes tile the footprint. Weakest of the four, kept because it is
//     the one that catches a plane going MISSING rather than merging.
//   * every plane is a simple polygon. The swallowed plane listed the same
//     corner twice, having walked out and back.
//   * the peak sits where the footprint says it must. Measured against an
//     inscribed circle found by search -- an oracle that shares no code with
//     the skeleton at all. On a rectilinear footprint with one pitch, the
//     highest point of the roof is the centre of the largest circle that fits
//     inside, lifted by the pitch. That is the check that reads 10.667.
//
// Run: node proto/roof-skeleton-harness.js          (checks)
//      node proto/roof-skeleton-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const SRC = path.join(__dirname, '..', 'geometry-2d.js');

// Source-loaded so a mutant can be applied without touching disk. geometry-2d
// hangs itself off `window` and reads nothing else, so a bare object is the
// whole environment it needs.
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
const PITCH = 4;

// ── THE FOOTPRINTS ───────────────────────────────────────────────────────
//
// All eave, no gable: a hip on every side, so every edge owes a plane and
// there is nowhere for a missing one to hide. Sizes are house-sized on
// purpose -- a 4 ft jog on a 32 ft wall is the jog a garage actually makes,
// and the defect below is sensitive to how far proud the wing sits.
const SHAPES = [
  // One reflex corner. The wings share their left wall, so the two arms are
  // flush and the ring resolves in two collapses with nothing simultaneous.
  // 36 ft across the body, so the ridge sits 18 ft in.
  { name: 'L, one reflex corner',
    points: [P(0, 0), P(36, 0), P(36, 40), P(20, 40), P(20, 70), P(0, 70)],
    peak: 18 * PITCH / 12 },
  // Two reflex corners, but the arm sits INSIDE the width of the body on both
  // sides -- neither corner ever reaches the far wall, so again nothing
  // coincides. Same 36 ft body, same 18 ft.
  { name: 'T, two reflex, arm inside the width',
    points: [P(0, 0), P(36, 0), P(36, 40), P(26, 40), P(26, 70), P(10, 70), P(10, 40), P(0, 40)],
    peak: 18 * PITCH / 12 },
  // Two reflex corners with the arm PROUD on one side and INSET on the other
  // -- a house with a garage beside it, drawn as one outline. 32 ft body,
  // 4 ft proud to the right, 12 ft inset on the left. Both reflex corners sit
  // 10 ft from the wall opposite, so both arrive at once. The body is 32 ft
  // across, so the ridge sits 16 ft in and the roof rises 5.333 ft -- and
  // 10.667 ft, which is what it read, is 32 ft of run: the FULL width.
  { name: 'Z, two reflex, arm proud and inset',
    points: [P(0, 0), P(32, 0), P(32, 40), P(36, 40), P(36, 70), P(12, 70), P(12, 40), P(0, 40)],
    peak: 16 * PITCH / 12 },
  // The Z again, with a point sitting in the middle of the bottom wall. That
  // is what the splice leaves behind when a house outline and a garage
  // outline are joined into one: the wall runs straight through a corner
  // that is not a corner. The roof must not notice.
  { name: 'Z with a splice point in the middle of a wall',
    points: [P(0, 0), P(12, 0), P(32, 0), P(32, 40), P(36, 40),
      P(36, 70), P(12, 70), P(12, 40), P(0, 40)],
    peak: 16 * PITCH / 12 },
  // Four reflex corners and every one of them arriving at the same instant.
  // Not the shape that broke -- kept because the fix is ABOUT simultaneity,
  // and a symmetric cross is simultaneity everywhere at once. If handling one
  // coincidence breaks four, it breaks here. Every arm is 20 ft wide, so the
  // whole roof ridges 10 ft in.
  { name: 'a cross, four reflex corners all at once',
    points: [P(20, 0), P(40, 0), P(40, 20), P(60, 20), P(60, 40), P(40, 40),
      P(40, 60), P(20, 60), P(20, 40), P(0, 40), P(0, 20), P(20, 20)],
    peak: 10 * PITCH / 12 },
];

const roofOf = points => ({ points, edges: points.map(() => 'eave'), pitch: PITCH });

const areaOf = points => Math.abs(points.reduce((sum, pt, i) => {
  const next = points[(i + 1) % points.length];
  return sum + (pt.x * next.z - next.x * pt.z);
}, 0)) / 2;

// ── THE ORACLE ───────────────────────────────────────────────────────────
//
// The largest circle that fits inside the footprint, found by search over the
// bounding box and refined three times. It shares no line of code with
// roofSkeleton -- it does not know what a wavefront is -- which is the whole
// reason it is here.
//
// It is a CEILING, not an answer. Every wall of the roof moves inward at
// exactly the rate the pitch says, so a point still under open sky at run t
// is at least t from every wall: the roof can never rise past that circle.
// It can stop short of it, and on the cross below it does -- there the
// closest thing to the middle is a reflex CORNER rather than a wall, and a
// corner sheds no water. So the ceiling is asserted on every shape and the
// exact peak is stated per shape, by hand, from the width of the body.
//
// Refinement is three passes at 0.5 / 0.05 / 0.005 ft, so the radius is good
// to better than a hundredth of a foot and the rise it implies to a third of
// that. The checks allow 0.01 ft.
function pointToSegment(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

function insidePolygon(p, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i], pj = points[j];
    if ((pi.z > p.z) !== (pj.z > p.z)
      && p.x < (pj.x - pi.x) * (p.z - pi.z) / (pj.z - pi.z) + pi.x) inside = !inside;
  }
  return inside;
}

function inscribedRadius(points) {
  const clearance = p => (insidePolygon(p, points)
    ? points.reduce((min, pt, i) => Math.min(min, pointToSegment(p, pt, points[(i + 1) % points.length])), Infinity)
    : -1);
  const xs = points.map(p => p.x), zs = points.map(p => p.z);
  let lo = { x: Math.min(...xs), z: Math.min(...zs) };
  let hi = { x: Math.max(...xs), z: Math.max(...zs) };
  let best = { x: lo.x, z: lo.z, r: -1 };
  [0.5, 0.05, 0.005].forEach(step => {
    for (let x = lo.x; x <= hi.x + 1e-9; x += step) {
      for (let z = lo.z; z <= hi.z + 1e-9; z += step) {
        const r = clearance({ x, z });
        if (r > best.r) best = { x, z, r };
      }
    }
    lo = { x: best.x - step, z: best.z - step };
    hi = { x: best.x + step, z: best.z + step };
  });
  return best.r;
}

// ── WHAT THE SKELETON GIVES BACK ─────────────────────────────────────────
function roofOver(G, points) {
  const roof = roofOf(points);
  const arcs = G.roofSkeleton(roof);
  const faces = G.roofFaces(roof, arcs);
  let peak = 0;
  faces.forEach(face => face.points.forEach(p => {
    peak = Math.max(peak, G.roofFaceRise(face, p, PITCH));
  }));
  return { roof, arcs, faces, peak };
}

// Two corners of one plane landing on the same spot. A plane that walked out
// of the building and back lists its turning point twice.
const repeatsACorner = face => face.points.some((p, i) => face.points.some((q, j) =>
  j > i && Math.hypot(p.x - q.x, p.z - q.z) < 1e-3));

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

SHAPES.forEach(({ name, points, peak }) => {
  check(`${name}: one roof plane per eave`,
    G => [roofOver(G, points).faces.length, points.length]);

  check(`${name}: the planes tile the footprint`,
    G => { const { faces } = roofOver(G, points);
      const covered = faces.reduce((sum, face) => sum + face.area, 0);
      return [Math.abs(covered - areaOf(points)) < 0.01, true]; });

  check(`${name}: no plane doubles back on itself`,
    G => [roofOver(G, points).faces.filter(repeatsACorner).length, 0]);

  check(`${name}: the roof rises no further than the footprint allows`,
    G => { const got = roofOver(G, points).peak;
      const ceiling = inscribedRadius(points) * PITCH / 12 + 0.01;
      return [got <= ceiling ? 'under the ceiling' : `${got.toFixed(3)} over ${ceiling.toFixed(3)}`,
        'under the ceiling']; });

  check(`${name}: and it peaks where the width of the body says`,
    G => { const got = roofOver(G, points).peak;
      return [Math.abs(got - peak) < 0.01 ? 'as drawn' : got.toFixed(3),
        Math.abs(got - peak) < 0.01 ? 'as drawn' : peak.toFixed(3)]; });
});

// ── AND THE RECORD THE ARCS CARRY ────────────────────────────────────────
//
// Each arc's ta/tb is how far the wavefront had advanced at its ends, and
// that is what the 3D lift reads to put an arc at a height. An arc that
// travelled outward carried a t larger than the footprint allows, which is
// the same defect read off the arcs instead of the planes.
check('no arc claims to be higher than the footprint allows',
  G => { const broken = SHAPES.filter(({ points }) => {
    const limit = inscribedRadius(points) + 0.01;
    return roofOver(G, points).arcs.some(arc => Math.max(arc.ta, arc.tb) > limit);
  });
    return [broken.map(shape => shape.name).join(', '), '']; });

// AND THE TWO ACCOUNTS OF A HEIGHT MUST AGREE. An arc end says how far the
// wavefront had come when it got there; the plane under that point says how
// far it is from its eave. They are the same number by two routes -- the 3D
// lift reads the first and the section cut reads the second, so a roof that
// disagrees with itself here is a model whose elevation and whose plan are
// different buildings.
check('an arc is at the height the plane under it puts it',
  G => { const wrong = [];
    SHAPES.forEach(({ name, points }) => {
      const { arcs, faces } = roofOver(G, points);
      const ends = [];
      arcs.forEach(arc => { ends.push([arc.a, arc.ta], [arc.b, arc.tb]); });
      faces.forEach(face => face.points.forEach(corner => {
        const end = ends.find(([p]) => Math.hypot(p.x - corner.x, p.z - corner.z) < 1e-3);
        if (!end) return;
        const byPlane = G.roofFaceRise(face, corner, PITCH);
        const byArc = end[1] * PITCH / 12;
        if (Math.abs(byPlane - byArc) > 0.01) {
          wrong.push(`${name} (${corner.x.toFixed(1)},${corner.z.toFixed(1)}) `
            + `plane ${byPlane.toFixed(3)} arc ${byArc.toFixed(3)}`);
        }
      }));
    });
    return [wrong.slice(0, 3).join('; '), '']; });

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

// ONE MUTATION WAS WRITTEN FOR THIS TABLE AND THEN WITHDRAWN, recorded here
// rather than left out. The spike test asks two things of a corner: that its
// edges are collinear, and that they point OPPOSITE ways. Dropping the second
// half -- so a vertex sitting straight along its own wall is trimmed as well
// -- was caught by nothing, including the footprint added above for exactly
// that reason, the one with a splice point mid-wall. Trimming such a vertex
// removes a corner the ring did not need and draws a line along a wavefront
// edge that is already there, and every account downstream comes out the
// same. So the direction half of that test is NOT covered by anything here,
// and saying so is worth more than a table entry that is permanently red.
const MUTATIONS = [
  // THE DEFECT ITSELF. Queue the loops a split makes without trimming them,
  // and the second of two simultaneous reflex arrivals is left hanging off
  // the new ring as a spike.
  ['a ring is queued with the spike a simultaneous split left on it',
    s => s.replace('        settle(loopA);\n        settle(loopB);',
      '        queue.push(loopA, loopB);')],
  // The spike is trimmed but its ridge is never drawn, so two planes meet
  // along a line the face walk cannot see and merge into one.
  ['the ridge two wavefronts met along is trimmed away instead of drawn',
    s => s.replace('          if (Math.hypot(pt.x - tail.x, pt.z - tail.z) > eps) arcs.push({ a: pt, b: tail, ta: t, tb: t });',
      '          // the ridge goes unrecorded')],
  // A ring down to a single segment IS the ridge. Drop that and every wing
  // loses its ridge line, so the planes either side never part.
  ['a ring worn down to one segment is dropped instead of being the ridge',
    s => s.replace('      if (loop.pts.length === 2) {', '      if (false) {')],
  // Never look for a reflex corner reaching the far wall, so a concave
  // footprint is treated as though it were convex.
  ['a reflex corner never splits the ring',
    s => s.replace('        if (cross >= -eps) continue; // convex corner',
      '        if (true) continue; // convex corner')],
  // Half the fix: the first loop off a split is trimmed and the second is
  // not. Which of the two carries the spike depends on which reflex corner
  // arrived first, so a fix that settles only one of them is a coin toss.
  ['only the first of the two loops a split makes is trimmed',
    s => s.replace('        settle(loopA);\n        settle(loopB);',
      '        settle(loopA);\n        queue.push(loopB);')],
  // The loops a split makes carry the wavefront-s advance at the pinch.
  // Restart them at zero and every arc beyond the pinch reports a height
  // measured from the wrong place.
  ['a loop made by a split forgets how far the wavefront had already come',
    s => s.replace('const loopA = { pts: [ { ...s } ], kinds: [kinds[splitVertex]], t0: t1 };',
      'const loopA = { pts: [ { ...s } ], kinds: [kinds[splitVertex]], t0: 0 };')],
];

// A MUTATION THAT NEVER APPLIED IS NOT A MUTATION THAT WAS CAUGHT -- broken
// is its own tally and it fails the run, the same as level-label-harness.js.
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
