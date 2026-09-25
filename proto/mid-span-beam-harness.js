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
require('./harness-args.js').noFlags();

global.window = global.window || {};
require('../geometry-2d.js');
require('../build-house.js');
const { midSpanBeams } = global.window.DraftBuildHouse;

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

// ── Past twice the trigger, two beams at the third points ─────────────────
{
  // 60 x 40: short span 40 > 2 x 19, so the strip's thirds rather than its
  // middle. The strip is z = -20..20, so the cuts are at -20 + 40/3 and
  // -20 + 80/3.
  const plan = midSpanBeams(rect(60, 40));
  checkList('a very wide house gets two beams at the third points',
    zsOf(plan.beams.map(b => b.start)), [round(-20 + 40 / 3), round(-20 + 80 / 3)]);
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
