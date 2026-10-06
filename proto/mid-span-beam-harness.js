#!/usr/bin/env node
// build-house.js midSpanBeams — THE SPAN RULE, AND WHAT A POST MAY STAND ON.
//
// THIS FILE EXISTS BECAUSE IT DID NOT. `grep -ln midSpanBeams proto/*.js`
// came back empty: the rule that decides where every beam and telepost in the
// app goes had NO offline coverage at all. Its only checks were in
// tests/beam-corner.spec.js, which drives /MODEL.dc.html (tests/helpers.js:154)
// -- the page the app cannot reach -- and that file's own header says
//
//     "The geometry itself is pinned by the offline harness against
//      build-house.js; these specs pin the commit layer"
//
// which was not true when it was written and has not been true since. A
// sentence naming a guard that does not exist is worse than no sentence: two
// PR bodies have now repeated it.
//
// SO HALF OF THIS IS THE OLD BEHAVIOUR, pinned for the first time, and half is
// Movie's stacking rule (25 Sep). The old half went in FIRST and failed
// nothing -- which is the only way to know that adding the new half did not
// quietly move the existing answer.
//
// Run: node proto/mid-span-beam-harness.js
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ── THE MUTANTS ───────────────────────────────────────────────────────────
//
// THE SUBJECT IS LOADED THROUGH harness-env.js NOW, and that is the only
// reason this table can exist. It was two require() calls into global.window,
// which node caches and a mutant cannot reach; the sandbox loader reads every
// module fresh and prefers DRAFT_HARNESS_SOURCE_OVERRIDES when the parent has
// written one. Nothing about the checks moved and all of them pass either way
// -- measured before the table was written, so a row that goes red is the row
// and not the loader.
const MUTATIONS = [
  // JOISTS SPAN THE SHORT WAY -- and since 6 Oct that is asked twice. The
  // early return on the short span used to be the only gate; now the row
  // count is taken off the short axis's own strip, so a 40 x 18 house reads
  // one bay and lays nothing whichever side the early return measured. Bending
  // it alone changes no answer, so it is not a row here.
  // THE TRIGGER'S VALUE, not its strictness. 19 is Movie's number; at 18 a
  // 19 ft short span gets a beam it should not have.
  //
  // THE STRICTNESS ROW WAS TRIED FIRST AND SURVIVED, and that is a property
  // of the subject rather than a hole in the checks. `shortSpan <= beamAtFt`
  // at :240 opened to `<` lets a 19 ft house through the early return -- and
  // the LOCAL span test at :278 refuses it again on the same threshold with
  // matching strictness (`localSpanAt(...) > beamAtFt`, and 19 > 19 is
  // false). Opening that one instead is caught by the early return for the
  // same reason, from the other side. Two gates, one number, and neither is
  // solely responsible: no single-line bend of either can put a beam in a
  // 19 ft house, so neither is a row. Bending the number moves both at once,
  // which is why this is the row that bites.
  ['the trigger is 18 ft, so a 19 ft span gets a beam it does not need',
    'build-house.js',
    c => c.replace('  const midSpanBeams = (points, { beamAtFt = 19, maxSpanFt = 12,',
      '  const midSpanBeams = (points, { beamAtFt = 18, maxSpanFt = 12,')],

  ['the beam is laid across the short axis instead of along the long one',
    'build-house.js',
    c => c.replace("    const axis = w >= d ? 'x' : 'z';",
      "    const axis = w >= d ? 'z' : 'x';")],

  // A stair hole is why the beam is not simply on the centre line.
  ['a hole in the floor is not cut out of the strip', 'build-house.js',
    c => c.replace('    holes.forEach(hole => {', '    [].forEach(hole => {')],

  // MOVIE, 6 OCT: rows enough that no joist passes 19 ft. Rounded the other
  // way, an 81 ft house is three bays of 27.
  ['the bays are counted down, so a joist may run past 19 ft', 'build-house.js',
    c => c.replace('      const bays = Math.ceil((b - a) / beamAtFt - 1e-9);',
      '      const bays = Math.max(1, Math.floor((b - a) / beamAtFt));')],

  // The old cap: one beam, or two at third points, whatever the width.
  ['no more than two rows however wide the house', 'build-house.js',
    c => c.replace('      for (let k = 1; k < bays; k++) cutStrips.push(',
      '      for (let k = 1; k < Math.min(bays, 3); k++) cutStrips.push(')],

  // A row is kept where the floor IT sits in needs it -- the old rule asked
  // the section through the middle of the house, which an arm off to one
  // side never contains.
  ['a row out in an arm is judged by the middle of the house', 'build-house.js',
    c => c.replace('      const host = spans.find(([a, b]) => a + 1e-6 < c && c < b - 1e-6) || [0, 0];',
      '      const mid = (Math.min(...points.map(crossCoord)) + Math.max(...points.map(crossCoord))) / 2;\n'
      + '      const host = spans.find(([a, b]) => a <= mid && mid <= b) || [0, 0];')],

  // A row lying on a section's wall is a beam on the foundation.
  ['a row along an arm\'s own wall is kept as a beam', 'build-house.js',
    c => c.replace('      const host = spans.find(([a, b]) => a + 1e-6 < c && c < b - 1e-6) || [0, 0];',
      '      const host = spans.find(([a, b]) => a - 1e-9 <= c && c <= b + 1e-9) || [0, 0];')],

  // CEIL, NOT FLOOR: 40 ft at a 12 ft limit is four spans of 10, not three of
  // 13.33. Floor is the arithmetic that keeps the post count down and puts a
  // span over the limit, which is the one thing the limit is for.
  ['the run is divided down, so a span may run past the limit', 'build-house.js',
    c => c.replace('        const spans = Math.max(1, Math.ceil((to - from) / maxSpanFt));',
      '        const spans = Math.max(1, Math.floor((to - from) / maxSpanFt));')],

  // The ends bear on the outline, so a post there is a post in a wall.
  ['posts are put at the run ends as well as the divisions', 'build-house.js',
    c => c.replace('        for (let s = 1; s < spans; s++) cuts.push({ t: from + ((to - from) * s) / spans, unsupported: true });',
      '        for (let s = 0; s <= spans; s++) cuts.push({ t: from + ((to - from) * s) / spans, unsupported: true });')],

  ['a caller-supplied bearing test is ignored and the outline always carries',
    'build-house.js',
    c => c.replace("    const bears = typeof bearsAt === 'function' ? bearsAt : onOutline;",
      '    const bears = onOutline;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('mid-span-beam',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const { midSpanBeams } = require('./harness-env.js').loadDraftModules().DraftBuildHouse;

let failed = 0, ran = 0;
const checkEq = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};
const checkList = (label, got, want) => {
  ran += 1;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { failed += 1; console.log(`  FAIL ${label}\n       got ${a}\n       want ${b}`); }
};

// A rectangle centred on the origin: `wide` along x, `deep` along z.
const rect = (wide, deep) => [
  { x: -wide / 2, z: -deep / 2 }, { x: wide / 2, z: -deep / 2 },
  { x: wide / 2, z: deep / 2 }, { x: -wide / 2, z: deep / 2 },
];
const round = n => Number(n.toFixed(4));
const xsOf = list => [...new Set(list.map(p => round(p.x)))].sort((a, b) => a - b);
const zsOf = list => [...new Set(list.map(p => round(p.z)))].sort((a, b) => a - b);
// Every beam's length, in order along the run.
const lensOf = beams => beams
  .map(b => ({ at: Math.min(b.start.x, b.end.x) + Math.min(b.start.z, b.end.z),
    len: round(Math.hypot(b.end.x - b.start.x, b.end.z - b.start.z)) }))
  .sort((a, b) => a.at - b.at).map(e => e.len);

// ══ THE OLD BEHAVIOUR, PINNED FIRST ═══════════════════════════════════════

// ── The 19 ft trigger is on the SHORT span ────────────────────────────────
{
  // 40 x 18: the long side is well past 19, the short side is not. Joists
  // span the short way, so nothing is needed.
  const plan = midSpanBeams(rect(40, 18));
  checkEq('a short span under 19 ft needs no beam', plan.beams.length, 0);
  checkEq('and no posts either', plan.columns.length, 0);
}
{
  // Exactly 19 is not OVER 19.
  checkEq('19 ft exactly is not over the trigger',
    midSpanBeams(rect(40, 19)).beams.length, 0);
  checkEq('19.01 is', midSpanBeams(rect(40, 19.01)).beams.length > 0, true);
}

// ── One beam along the LONG axis, at mid-span of the short one ────────────
{
  // 40 wide x 32 deep: axis x (40 >= 32), strips run in z from -16..16, so
  // the cut is the centre line z = 0. The run is clipped to the outline at
  // x = -20..20, which is 40 ft, and ceil(40/12) = 4 spans of 10.
  const plan = midSpanBeams(rect(40, 32));
  checkList('the beam sits on the centre line', zsOf(plan.beams.map(b => b.start)), [0]);
  checkList('and runs the full width', xsOf(plan.beams.flatMap(b => [b.start, b.end])),
    [-20, -10, 0, 10, 20]);
  checkList('in four equal spans of 10', lensOf(plan.beams), [10, 10, 10, 10]);
  checkList('with three posts at the divisions', xsOf(plan.columns), [-10, 0, 10]);
  checkEq('and none at the ends, which bear on the outline', plan.columns.length, 3);
}

// ── No span may exceed maxSpanFt ──────────────────────────────────────────
{
  const plan = midSpanBeams(rect(40, 32), { maxSpanFt: 9 });
  // ceil(40/9) = 5 spans of 8.
  checkList('a tighter span limit divides further', lensOf(plan.beams), [8, 8, 8, 8, 8]);
  checkEq('and adds the posts to match', plan.columns.length, 4);
}

// ══ MOVIE'S ROW RULE, 6 OCT ═══════════════════════════════════════════════
// "for AUTOplacement with 1-0 5/8" floor the max span of joists is 19ft so
//  we will need to shift the beams/columns and add at least 1 more row,
//  maybe 2 are needed"

// The widest joist span left anywhere in the floor: each cross-section of the
// outline, cut by the beams that run through that slice.
const worstJoist = (points, beams) => {
  const runsAlongX = beams.every(b => Math.abs(b.start.z - b.end.z) < 1e-6);
  const along = p => (runsAlongX ? p.x : p.z), cross = p => (runsAlongX ? p.z : p.x);
  const lo = Math.min(...points.map(along)), hi = Math.max(...points.map(along));
  let worst = 0;
  for (let t = lo + 0.05; t < hi; t += 0.5) {
    const hits = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if ((along(a) > t) === (along(b) > t)) return;
      hits.push(cross(a) + (t - along(a)) / (along(b) - along(a)) * (cross(b) - cross(a)));
    });
    hits.sort((p, q) => p - q);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const stops = [hits[i], hits[i + 1]];
      beams.forEach(b => {
        const c = cross(b.start), s0 = Math.min(along(b.start), along(b.end)), s1 = Math.max(along(b.start), along(b.end));
        if (c > hits[i] && c < hits[i + 1] && t >= s0 - 1e-6 && t <= s1 + 1e-6) stops.push(c);
      });
      stops.sort((p, q) => p - q);
      for (let s = 0; s + 1 < stops.length; s++) worst = Math.max(worst, stops[s + 1] - stops[s]);
    }
  }
  return round(worst);
};
const poly = list => list.map(([x, z]) => ({ x, z }));
{
  // 60 x 40: the old rule put two rows at the thirds, 13.33 apart -- the
  // same answer, since 40 is three bays of 19 or less.
  const plan = midSpanBeams(rect(60, 40));
  checkList('40 ft deep takes two rows at the thirds',
    zsOf(plan.beams.map(b => b.start)), [round(-20 + 40 / 3), round(-20 + 80 / 3)]);
}
{
  // 38.5 deep: one beam would leave 19.25 a side.
  const plan = midSpanBeams(rect(60, 38.5));
  checkEq('just past 2 x 19 takes a second row', zsOf(plan.beams.map(b => b.start)).length, 2);
  checkEq('and both spans are legal', worstJoist(rect(60, 38.5), plan.beams) <= 19, true);
}
{
  // 81 x 92, the size of Movie's L: the old rule stopped at two rows and
  // left 27 ft joists. 81 is five bays of 16.2.
  const plan = midSpanBeams(rect(81, 92));
  checkEq('an 81 ft span takes four rows', xsOf(plan.beams.map(b => b.start)).length, 4);
  checkEq('so no joist passes 19 ft', worstJoist(rect(81, 92), plan.beams) <= 19, true);
}
{
  // Movie's house (6 Oct screenshot): an L, 81 across the top 26 ft and 47
  // down the rest of 92. The old answer was rows at 27 and 47 -- 34 ft of
  // joist between the wall and the first.
  const house = poly([[0, 0], [81, 0], [81, 26], [47, 26], [47, 92], [0, 92]]);
  const plan = midSpanBeams(house);
  checkEq('the L has no joist past 19 ft', worstJoist(house, plan.beams) <= 19, true);
  // The rows out in the wing (x past 47) stop at the wing's back wall.
  const wingRows = plan.beams.filter(b => b.start.x > 47 + 1e-6);
  checkEq('rows out in the wing stay in the wing',
    wingRows.length > 0 && wingRows.every(b => Math.max(b.start.z, b.end.z) <= 26 + 1e-6), true);
}
{
  // A T whose stem is only 20 ft wide in places: every section, not just the
  // middle one, is held to the limit.
  const tee = poly([[0, 0], [70, 0], [70, 30], [45, 30], [45, 70], [25, 70], [25, 30], [0, 30]]);
  const plan = midSpanBeams(tee);
  checkEq('a T has no joist past 19 ft', worstJoist(tee, plan.beams) <= 19, true);
}
{
  // An E on its side: the main body, a 17 ft arm along the front and a 30 ft
  // arm along the back. The rows divide 80 ft into five bays; the ones near
  // the arms snap onto their walls at z = 17 and 50. The front arm spans 17
  // and needs nothing; the back arm spans 30 and needs a row of its own --
  // which a rule asking the middle of the house (z = 40, in neither arm)
  // never gives it.
  const e = poly([[0, 0], [90, 0], [90, 17], [30, 17], [30, 50], [90, 50], [90, 80], [0, 80]]);
  const plan = midSpanBeams(e);
  checkEq('a narrow arm gets no row, whatever the arm beside it needs',
    plan.beams.some(b => Math.max(b.start.x, b.end.x) > 30 + 1e-6 && b.start.z <= 17 + 1e-6), false);
  checkEq('and no row runs along an arm\'s own wall',
    plan.beams.some(b => Math.max(b.start.x, b.end.x) > 30 + 1e-6
      && [17, 50].some(z => Math.abs(b.start.z - z) < 1e-6)), false);
  checkEq('the wide arm does', plan.beams.some(b => Math.max(b.start.x, b.end.x) > 30 + 1e-6 && b.start.z > 50), true);
  checkEq('and nothing passes 19', worstJoist(e, plan.beams) <= 19, true);
}
{
  // Wide in both directions, so the rows run the long way and there are many.
  const plan = midSpanBeams(rect(100, 70));
  checkEq('a 70 ft span takes three rows', zsOf(plan.beams.map(b => b.start)).length, 3);
  checkEq('every joist within 19', worstJoist(rect(100, 70), plan.beams) <= 19, true);
}

// ── A stair hole pushes the beam into the larger clear strip ──────────────
{
  // 40 x 32, strip z = -16..16. A hole from -16 to -8 leaves [-8, 16], whose
  // midpoint is 4.
  const plan = midSpanBeams(rect(40, 32), { holes: [{ min: -16, max: -8 }] });
  checkList('the beam re-lands mid-span of the larger remaining strip',
    zsOf(plan.beams.map(b => b.start)), [4]);
}

// ── An end that bears on nothing gets a post ──────────────────────────────
{
  // bearsAt says only the left half of the outline carries. The run's right
  // end then hangs, and a post goes under it.
  const bearsAt = p => p.x < 0;
  const plan = midSpanBeams(rect(40, 32), { bearsAt });
  checkEq('an unsupported run end gets a post', xsOf(plan.columns).includes(20), true);
  checkEq('and a bearing one does not', xsOf(plan.columns).includes(-20), false);
}

// ══ MOVIE'S STACKING RULE, 25 SEP ═════════════════════════════════════════
// "the columns and beams are most often located over top of each other (
//  this is always the case for a columns - it need to be over another
//  column ... or over a solid wall ... (which acts as a column"

// ── With nothing named below, the answer does not move ────────────────────
{
  const bare = midSpanBeams(rect(40, 32));
  const empty = midSpanBeams(rect(40, 32), { supportsBelow: [] });
  checkList('an empty support list is the same as none', lensOf(empty.beams), lensOf(bare.beams));
  checkEq('and claims nothing about what holds the posts up',
    empty.columns.some(c => c.unsupported), false);
}

// ── A post lands on the column below, not on the even division ────────────
{
  // The floor below is held at x = -12, 2 and 14 on the same centre line.
  // Even division would put posts at -10, 0, 10 -- none of them over anything.
  // Greedy-furthest from -20: the furthest support within 12 ft is -12; from
  // there, 2 is 14 away so it is out of reach and -12+12 = 0 has nothing, so
  // the furthest reachable is... 2 is out, so nothing: the limit post at 0.
  // From 0 the furthest within 12 is 2? no -- 14 is 14 away. So 2.
  const below = [{ x: -12, z: 0 }, { x: 2, z: 0 }, { x: 14, z: 0 }];
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  const posts = xsOf(plan.columns);
  posts.forEach(x => {
    const stacked = below.some(b => Math.abs(b.x - x) < 1e-6);
    const tagged = plan.columns.find(c => round(c.x) === x).unsupported === true;
    checkEq(`a post at x=${x} either stacks or says it does not`, stacked || tagged, true);
  });
  checkEq('every span is still legal',
    lensOf(plan.beams).every(len => len <= 12 + 1e-9), true);
  checkEq('and the beams are cut where the posts stand',
    lensOf(plan.beams).length, posts.length + 1);
}

// ── Greedy-furthest takes the fewest posts ────────────────────────────────
{
  // Supports every 2 ft. An even division would use 3 posts; walking the
  // nearest support each time would use 19. The furthest-within-reach walk
  // uses ceil(40/12) - 1 = 3, landing on supports at 12-ft steps.
  const below = [];
  for (let x = -18; x <= 18; x += 2) below.push({ x, z: 0 });
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  checkList('a dense floor below is walked at the span limit, not at every support',
    xsOf(plan.columns), [-8, 4, 16]);
  checkEq('and nothing is left unsupported',
    plan.columns.some(c => c.unsupported), false);
}

// ── A solid wall below holds the whole stretch it covers ──────────────────
{
  // A wall running ALONG the beam from -20 to 20 holds every point on it, so
  // the posts land exactly at the span limit -- the wall is support wherever
  // the frame happens to need it.
  const below = [{ start: { x: -20, z: 0 }, end: { x: 20, z: 0 } }];
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  checkList('a wall under the beam holds it wherever a post is needed',
    xsOf(plan.columns), [-8, 4, 16]);
  checkEq('so none of them stands on nothing',
    plan.columns.some(c => c.unsupported), false);
}

// ── A wall CROSSING the beam holds one point, IF IT IS IN REACH ───────────
{
  // -9 is 11 ft from the run's start, inside the 12 ft limit.
  const below = [{ start: { x: -9, z: -16 }, end: { x: -9, z: 16 } }];
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  checkEq('a crossing wall holds the beam where it crosses', xsOf(plan.columns)[0], -9);
  checkEq('and that post stands on something',
    plan.columns.find(c => round(c.x) === -9).unsupported, undefined);
}
{
  // -3 is 17 ft from the start, PAST the limit -- so the first post cannot
  // wait for it and lands at the limit instead, saying it stands on nothing.
  // This was written as a passing expectation of -3 and the harness refused
  // it: reaching for an out-of-range support is how a span over the limit
  // gets drawn, which is the one thing maxSpanFt exists to prevent.
  const below = [{ start: { x: -3, z: -16 }, end: { x: -3, z: 16 } }];
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  checkEq('a support past the span limit is not reached for', xsOf(plan.columns)[0], -8);
  checkEq('and the post that lands short says so',
    plan.columns.find(c => round(c.x) === -8).unsupported, true);
  checkEq('every span still legal',
    lensOf(plan.beams).every(len => len <= 12 + 1e-9), true);
}

// ── A support off the line is not a support ───────────────────────────────
{
  // The same columns, moved 2 ft off the beam's line. Nothing stacks, so
  // every post is tagged rather than silently claimed.
  const below = [{ x: -12, z: 2 }, { x: 2, z: 2 }, { x: 14, z: 2 }];
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  checkEq('a column two feet to one side holds nothing up',
    plan.columns.every(c => c.unsupported === true), true);
}
{
  // ...but one within the tolerance does.
  const below = [{ x: -8, z: 0.4 }];
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  checkEq('and one within the tolerance does',
    plan.columns.find(c => round(c.x) === -8).unsupported, undefined);
}

// ── A gap nothing can bridge is tagged, not hidden ────────────────────────
{
  // One support near the start and nothing after it. The rest of the run has
  // to be held up anyway, and those posts must say they stand on nothing.
  const below = [{ x: -10, z: 0 }];
  const plan = midSpanBeams(rect(40, 32), { supportsBelow: below });
  const stacked = plan.columns.filter(c => !c.unsupported);
  checkList('the reachable support is used', xsOf(stacked), [-10]);
  checkEq('and the posts past it admit they stand on nothing',
    plan.columns.filter(c => c.unsupported === true).length > 0, true);
  checkEq('while every span stays legal',
    lensOf(plan.beams).every(len => len <= 12 + 1e-9), true);
}

console.log(`\nmid-span beams: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
