// geometry-2d.js — an opening on its host wall: the bearing it must keep back
// from each end, and the footprint that carves the wall.
//
// WHY THIS MOVED AND WHY IT IS CHECKED HERE. MODEL.dc.html has derived this
// since fenestration existed, and MODEL.html has to place doors and windows
// now. A hand-rolled twin is how #401 lost a shard, so the arithmetic moved
// into geometry-2d.js and this harness is what stops the module from drifting
// away from the page it was lifted out of.
//
// WHAT WOULD GO WRONG SILENTLY, which is what most of these checks are aimed
// at. Every one of these numbers is a distance in FEET that renders perfectly
// whatever it is: an opening reserved 1 1/2" from a corner instead of 8 1/2"
// draws exactly like a correct one, and the drawing is wrong only in the way
// that matters — there is no wood under the lintel. The same is true of a jamb
// on the wrong face and a pad that does not reach past the wall stroke. None
// of it is visible; all of it is arithmetic; so it is measured here rather
// than looked at.
//
// THE THICKNESS LOOKUP IS THIS FILE'S OWN, and deliberately not the real wall
// table. Two synthetic types a foot apart make it unmistakable WHICH wall was
// asked: a carrier of 0.25 and a carrier of 1 cannot be confused, where two
// real stud walls three inches apart could pass a wrong reading as rounding.
//
// Run: node proto/opening-geometry-harness.js          (checks)
//      node proto/opening-geometry-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'geometry-2d.js');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window.DraftGeometry2D;
}

// Two wall types a foot apart. See the header: real stud walls are too close
// together to tell a wrong reading from a rounding.
const THICK = { big: 1, small: 0.25 };
const thicknessFt = wall => THICK[wall?.wallType || 'big'];

const wall = (over = {}) => ({
  id: 'w', levelId: 3, view: 'plan', wallType: 'big', refLine: 'center',
  start: { x: 0, y: 0, z: 0 }, end: { x: 20, y: 0, z: 0 }, ...over,
});

// A partition meeting the host at its START corner only. The far end is free,
// so one wall exercises both reserve rules at once — which is the case the
// old page's comment calls out: "one wall can meet a different thing at each
// of its ends".
const MEETS_START = {
  id: 'm', levelId: 3, view: 'plan', wallType: 'small', refLine: 'center',
  start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: -10 },
};

const HOST = wall();
const WALLS = [HOST, MEETS_START];
const opts = (over = {}) => ({ walls: WALLS, thicknessFt, ...over });
const opening = (over = {}) => ({ id: 'o', wallId: 'w', offset: 10, width: 3, type: 'window', ...over });

const ft = n => Number(n).toFixed(4);
const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── the bearing ──
// NBC Table 9.23.12.3.-A note (4): 38 mm up to a 3 m span, 76 mm over it.
check('a short span bears 1 1/2"',
  G => [ft(G.openingBearingFt(3)), ft(1.5 / 12)]);

check('a long span bears 3"',
  G => [ft(G.openingBearingFt(16)), ft(3 / 12)]);

// The code says "spans up to 3 m", so 3 m itself is the SHORT rule. An opening
// exactly on the boundary is the one a >= would get wrong, and it is the only
// width that can tell the two comparisons apart.
check('exactly 3 m is still the short bearing, because the code says "up to"',
  G => [ft(G.openingBearingFt(3 / 0.3048)), ft(1.5 / 12)]);

// ── what stands at the end ──
check('a wall meeting at the corner is found',
  G => [G.wallMeetingAt(HOST, HOST.start, WALLS)?.id, 'm']);

check('and nothing is found at the free end',
  G => [G.wallMeetingAt(HOST, HOST.end, WALLS)?.id ?? 'none', 'none']);

check('a wall on another level does not carry this one',
  G => [G.wallMeetingAt(HOST, HOST.start,
    [HOST, { ...MEETS_START, levelId: 5 }])?.id ?? 'none', 'none']);

check('nor does one on another view',
  G => [G.wallMeetingAt(HOST, HOST.start,
    [HOST, { ...MEETS_START, view: 'foundation' }])?.id ?? 'none', 'none']);

check('a wall is never its own carrier',
  G => [G.wallMeetingAt(HOST, HOST.start, [HOST])?.id ?? 'none', 'none']);

// AND NOT ITS OWN COPY EITHER. This one was found by writing the check: the
// page this came from always held the live object, so identity was enough
// there -- but a module is called by whoever has the numbers, and MODEL.html
// hands its painters plain copies. Under identity alone a wall finds its own
// copy at its corner and reserves a whole wall thickness that is not there.
check('nor a copy of itself, which is what a page hands a painter',
  G => [G.wallMeetingAt(HOST, HOST.start, [{ ...HOST }])?.id ?? 'none', 'none']);

// NEAR IS NOT MEETING. A wall ending half a foot short of this one's end is
// not under its lintel, and the 0.02 tolerance is what says so -- it is there
// for floating-point drift in a shared corner, not for proximity. Without a
// wall in this position the tolerance can be widened a hundredfold and every
// other check still passes.
const PASSES_NEAR = {
  id: 'n', levelId: 3, view: 'plan', wallType: 'small', refLine: 'center',
  start: { x: 19.5, y: 0, z: -10 }, end: { x: 19.5, y: 0, z: 0 },
};

check('a wall that stops half a foot short carries nothing',
  G => [G.wallMeetingAt(HOST, HOST.end, [HOST, PASSES_NEAR])?.id ?? 'none', 'none']);

check('so that end still reserves the free post, not that wall',
  G => [ft(G.openingEndReserveFt(HOST, HOST.end, 0.125,
    { walls: [HOST, PASSES_NEAR], thicknessFt })), ft(5.5 / 12 + 0.125)]);

// THE RESERVE IS THE CARRIER PLUS THE BEARING, and the carrier is whatever
// actually stands there -- the MEETING wall's thickness, not the host's.
check('the carrier is the meeting wall, not the wall being opened',
  G => [ft(G.openingEndReserveFt(HOST, HOST.start, 0.125, opts())), ft(0.25 + 0.125)]);

// "If nothing there use a 6x6 post" -- there is no free end, so the rule has
// no undefined case.
check('a free end reserves a dressed 6x6 post plus the bearing',
  G => [ft(G.openingEndReserveFt(HOST, HOST.end, 0.125, opts())), ft(5.5 / 12 + 0.125)]);

// ── the clamp ──
// Wall 20' long, opening 3' wide: 1.5 + (0.25 + 0.125) at the met end, and
// 1.5 + (5.5/12 + 0.125) at the free one.
check('an opening pushed off the met end lands at its own bearing line',
  G => [ft(G.clampOpeningToWall(HOST, 0, 3, opts()).offset), ft(1.5 + 0.375)]);

check('and off the free end, at the post line, which is further in',
  G => [ft(G.clampOpeningToWall(HOST, 99, 3, opts()).offset), ft(20 - 1.5 - (5.5 / 12 + 0.125))]);

check('an opening that already fits is left exactly where it is',
  G => [ft(G.clampOpeningToWall(HOST, 10, 3, opts()).offset), ft(10)]);

check('a wall too short for the width plus both bearings takes no opening',
  G => [G.clampOpeningToWall(wall({ end: { x: 2, y: 0, z: 0 } }), 1, 3, opts()), null]);

check('a zero-width opening is refused rather than clamped to a point',
  G => [G.clampOpeningToWall(HOST, 10, 0, opts()), null]);

// faceReferenced:false is the restore rule -- bearing only, no carrier -- and
// it is LOOSER, which is the whole point: it must not move openings that were
// sound when they were saved.
check('the restore rule reserves the bearing alone',
  G => [ft(G.clampOpeningToWall(HOST, 0, 3, opts({ faceReferenced: false })).offset),
    ft(1.5 + 0.125)]);

check('so restore leaves an opening that placement would have pushed in',
  G => [ft(G.clampOpeningToWall(HOST, 1.7, 3, opts({ faceReferenced: false })).offset), ft(1.7)]);

// A missing lookup would silently reserve the free-post figure at EVERY end,
// putting openings closer to a corner than the wood allows -- so it throws.
check('placement without a thickness lookup refuses to guess',
  G => { try { G.clampOpeningToWall(HOST, 10, 3, { walls: WALLS }); return ['no throw', 'throws']; }
         catch (err) { return ['throws', 'throws']; } });

// ── the footprint ──
const geom = (G, over = {}, o = {}) => G.openingGeometry(opening(o), wall(over), opts({ padFt: 0.1 }));

check('the centre sits on the wall centreline at the offset',
  G => { const g = geom(G); return [`${ft(g.center.x)},${ft(g.center.z)}`, `${ft(10)},${ft(0)}`]; });

check('the carved quad is the opening wide',
  G => { const g = geom(G);
         const xs = g.corners.map(c => c.x);
         return [ft(Math.max(...xs) - Math.min(...xs)), ft(3)]; });

// THE PAD REACHES PAST BOTH FACES, or the wall's own boundary stroke -- which
// is centred on the face -- is left drawn across the gap.
check('and reaches the wall thickness plus the pad at each face',
  G => { const g = geom(G);
         const zs = g.corners.map(c => c.z);
         return [`${ft(Math.min(...zs))},${ft(Math.max(...zs))}`,
           `${ft(-0.5 - 0.1)},${ft(0.5 + 0.1)}`]; });

check('a left-referenced wall carries its opening on one side of the line',
  G => { const g = geom(G, { refLine: 'left' });
         const zs = g.corners.map(c => c.z);
         return [`${ft(Math.min(...zs))},${ft(Math.max(...zs))}`, `${ft(-0.1)},${ft(1.1)}`]; });

check('a right-referenced wall carries it on the other',
  G => { const g = geom(G, { refLine: 'right' });
         const zs = g.corners.map(c => c.z);
         return [`${ft(Math.min(...zs))},${ft(Math.max(...zs))}`, `${ft(-1.1)},${ft(0.1)}`]; });

check('the two jambs stand at the two ends of the opening, not one',
  G => { const g = geom(G);
         return [`${ft(g.jambs[0][0].x)},${ft(g.jambs[1][0].x)}`, `${ft(8.5)},${ft(11.5)}`]; });

check('each jamb caps the full wall thickness',
  G => { const g = geom(G);
         return [ft(g.jambs[0][1].z - g.jambs[0][0].z), ft(1 + 0.2)]; });

check('the glazing line runs down the middle of the wall',
  G => { const g = geom(G);
         return [`${ft(g.glazing[0].z)},${ft(g.glazing[1].z)}`, `${ft(0)},${ft(0)}`]; });

// The footprint is built from the CLAMPED offset, so an opening asked for off
// the end draws where it will be built rather than where it was asked for.
check('a footprint asked for off the end is drawn where the clamp puts it',
  G => [ft(geom(G, {}, { offset: 0 }).center.x), ft(1.5 + 0.375)]);

check('a wall too short has no footprint at all',
  G => [G.openingGeometry(opening(), wall({ end: { x: 2, y: 0, z: 0 } }), opts()), null]);

check('and neither has an opening with no wall to host it',
  G => [G.openingGeometry(opening(), null, opts()), null]);

// A diagonal wall: the quad has to follow the wall, not the axes. Run 3-4-5 so
// the numbers are exact.
check('an opening on a diagonal wall follows the wall',
  G => { const g = G.openingGeometry(opening({ offset: 2.5, width: 1 }),
    wall({ end: { x: 3, y: 0, z: 4 } }), opts({ padFt: 0 }));
         return [`${ft(g.center.x)},${ft(g.center.z)}`, `${ft(1.5)},${ft(2)}`]; });

// ── Mutations ──
const MUTATIONS = [
  ['the bearing boundary includes 3 m, so a 3 m span takes the long figure',
    s => s.replace('widthFt > OPENING_BEARING_SPAN_FT', 'widthFt >= OPENING_BEARING_SPAN_FT')],
  ['short and long bearings are swapped',
    s => s.replace('? OPENING_BEARING_LONG_IN : OPENING_BEARING_SHORT_IN',
      '? OPENING_BEARING_SHORT_IN : OPENING_BEARING_LONG_IN')],
  ['a free end carries nothing -- the 6x6 post goes',
    s => s.replace('const OPENING_FREE_END_POST_IN = 5.5;', 'const OPENING_FREE_END_POST_IN = 0;')],
  ['the carrier is measured as the wall being opened, not the one it meets',
    s => s.replace('thicknessFt(meeting)', 'thicknessFt(wall)')],
  ['a wall finds its own copy standing at its corner and calls it the carrier',
    s => s.replace('&& !(other.id !== undefined && wall.id !== undefined && String(other.id) === String(wall.id))\n', '')],
  ['a wall on any level can carry this one',
    s => s.replace('&& other.levelId === wall.levelId\n', '')],
  ['a wall on any view can carry this one',
    s => s.replace("&& (other.view || 'plan') === (wall.view || 'plan')\n", '')],
  ['a wall carries one it merely passes near, not one it meets',
    s => s.replace('distance(other.start, point) < 0.02 || distance(other.end, point) < 0.02',
      'distance(other.start, point) < 2 || distance(other.end, point) < 2')],
  ['the clamp hands back whatever it was given',
    s => s.replace('return { offset: Math.min(Math.max(offset, half + atStart), len - half - atEnd) };',
      'return { offset };')],
  ['a wall too short for the opening takes it anyway',
    s => s.replace('if (!(width > 0) || len < width + atStart + atEnd) return null;',
      'if (!(width > 0)) return null;')],
  ['only the far end keeps its bearing',
    s => s.replace('const atStart = faceReferenced ? openingEndReserveFt(wall, wall.start, bearing, ends) : bearing;',
      'const atStart = 0;')],
  ['placement quietly falls back to the restore rule',
    s => s.replace('const { walls, thicknessFt, faceReferenced = true } = opts;',
      'const { walls, thicknessFt, faceReferenced = false } = opts;')],
  ['the pad stops reaching past the wall faces',
    s => s.replace('at(clamped.offset - half, startOff - padFt),\n        at(clamped.offset + half, startOff - padFt),',
      'at(clamped.offset - half, startOff),\n        at(clamped.offset + half, startOff),')],
  ['both jambs stand at the same end of the opening',
    s => s.replace('[at(clamped.offset + half, startOff - padFt), at(clamped.offset + half, endOff + padFt)],',
      '[at(clamped.offset - half, startOff - padFt), at(clamped.offset - half, endOff + padFt)],')],
  ['every wall is treated as centre-referenced',
    s => s.replace("const startOff = refLine === 'left' ? 0 : refLine === 'right' ? -totalFt : -totalFt / 2;",
      'const startOff = -totalFt / 2;')],
  ['the glazing line runs along a face instead of the centreline',
    s => s.replace('glazing: [at(clamped.offset - half, midOff), at(clamped.offset + half, midOff)],',
      'glazing: [at(clamped.offset - half, startOff), at(clamped.offset + half, startOff)],')],
  ['the footprint is drawn where the opening was asked for, not where it fits',
    s => s.replace('center: at(clamped.offset, midOff),', 'center: at(opening.offset, midOff),')],
];

// ── Run ──
function run(G) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `THREW: ${err.message}`; want = '(no throw)'; }
    if (String(got) !== String(want)) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(74) + 'caught by');
  let survivors = 0, broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(74)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(74)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
