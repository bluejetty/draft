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

  // THE JOIST CALLOUT (Movie, 16 Oct).
  ['the arrow stands in the stairwell',
    'build-house.js',
    c => c.replace('      const at = candidates.find(clear) ?? candidates[0];', '      const at = candidates[0];')],
  ['the arrow dodges the well only in the well-s own bay',
    'build-house.js',
    c => c.replace('      const clear = at => !holeBoxes.some(hole =>\n        at > hole[beamAxis][0]',
      '      const clear = at => !holeBoxes.some(hole =>\n        Math.min(hole[joist][1], to) - Math.max(hole[joist][0], from) > 0.01 && at > hole[beamAxis][0]')],
  ['the arrow clears the well by a foot, onto its string',
    'build-house.js',
    c => c.replace('  const JOIST_ARROW_CLEAR_FT = 3;', '  const JOIST_ARROW_CLEAR_FT = 1;')],
  ['the bays ignore the beams',
    'build-house.js',
    c => c.replace("    const cuts = [...new Set(crossing.filter(beam => beam.along === beamAxis)", "    const cuts = [...new Set([].filter(beam => beam.along === beamAxis)")],
  ['the joists run along the beams instead of across them',
    'build-house.js',
    c => c.replace("      joist = onX >= crossing.length - onX ? 'z' : 'x';", "      joist = onX >= crossing.length - onX ? 'x' : 'z';")],
  ['a bare deck ignores the way its caller says',
    'build-house.js',
    c => c.replace("    } else if (axis === 'x' || axis === 'z') {", '    } else if (false) {')],
  ['a beam beside the deck cuts it anyway',
    'build-house.js',
    c => c.replace('    }).filter(beam => beam.fixed > box[beam.across][0] + 0.01 && beam.fixed < box[beam.across][1] - 0.01\n      && Math.min(beam.hi, box[beam.along][1]) - Math.max(beam.lo, box[beam.along][0]) > 0.01);',
      '    }).filter(beam => beam.fixed > box[beam.across][0] + 0.01 && beam.fixed < box[beam.across][1] - 0.01);')],
  ['a room over a garage runs the short way',
    'build-house.js',
    c => c.replace('    return garageJoistAxis(box, near);', '    return null;')],
  ['the callout names the stock TJI as an OWJ',
    'build-house.js',
    c => c.replace("    const name = type === 'tji' ? 'TJI' : 'ENGINEERED OWJ';", "    const name = 'ENGINEERED OWJ';")],
  ['the depth is printed as a decimal',
    'build-house.js',
    c => c.replace('    const eighths = Math.round((depthIn - whole) * 8);', '    const eighths = 0; void whole;')],
  ['the garage joist ignores its minimum depth',
    'build-house.js',
    c => c.replace('const rows = OWJ_SPANS.filter(r => r.depthIn >= minDepthIn - 1e-6);', 'const rows = OWJ_SPANS;')],
  ['the garage beams ignore the doors', 'build-house.js',
    c => c.replace('    if (legalBetween.length >= n && legalBetween.length <= 12) pick(legalBetween, 0, []);', '')],
  // MOVIE, 12 OCT: "side wall to side wall -- the sides that land on walls".
  ['the garage joists take the short way whatever wall the doors are in', 'build-house.js',
    c => c.replace('    if (xWall !== zWall) return xWall > zWall ? \'x\' : \'z\';', '')],
  ['a beam end on a wall still gets a column', 'build-house.js',
    c => c.replace('        if ((k === 0 || k === bays) && onWall(p)) continue;', '')],
  ['the longest spans never drop to 12" o.c.',
    'build-house.js',
    c => c.replace("ocOrder = [16, 12] }", "ocOrder = [16] }")],
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

  // A stair that splits the floor into narrow strips does not take the beam.
  ['a stair leaving only narrow strips drops the beam', 'build-house.js',
    c => c.replace('    if (!cutStrips.length && strips.length) {', '    if (false) {')],

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

  // MOVIE, 15 OCT: the bare deck ends where the table stops reaching at the
  // spacing he lays. Read at 12" instead and his 30 ft garage goes back to
  // having no beam at all, which is the drawing he reported.
  ['the bare deck is measured at the 12" o.c. last resort', 'build-house.js',
    c => c.replace('  const OWJ_BARE_OC_IN = 16;', '  const OWJ_BARE_OC_IN = 12;')],
  // And the other half of the one number: the rows may run past the ceiling.
  ['the rows are cut to a flat 30 ft again', 'build-house.js',
    c => c.replace('doors = [], onWall = () => false, maxJoistFt = garageBareSpanFt(),',
      'doors = [], onWall = () => false, maxJoistFt = 30,')],

  // THE HEADER PICKS ITS EDGE BY MEASURE, not by taking the first one.
  ['the stair header always takes the low edge', 'build-house.js',
    c => c.replace('    const u = runHi > runLo ? hi : lo;', '    const u = lo;')],
  // TWO GUARDS NOW STAND BETWEEN A WELL AND A HEADER IT HAS NO CALL FOR --
  // "nothing to catch" and "under 10 ft" -- and a zero run fails both, so
  // bending the first alone changes no answer (measured 16 Oct: it survived).
  // The row bends both, which is the one edit that puts a header on a well
  // wedged between two supports.
  ['a well with nothing to catch still gets a header', 'build-house.js',
    c => c.replace('    if (runLo <= 0.01 && runHi <= 0.01) return null;\n', '')
      .replace('    if (Math.max(runLo, runHi) < minRunFt - 1e-6) return null;\n', '')],
  // MOVIE, 16 OCT: the two refusals, each bent back to the 15 Oct rule.
  ['a well set across the beam gets a header on its end again (the photo)', 'build-house.js',
    c => c.replace('    if (!(a1 - a0 > hi - lo + 0.01)) return null;\n', '')],
  ['the header comes at any span, not only past 10 ft', 'build-house.js',
    c => c.replace('    if (Math.max(runLo, runHi) < minRunFt - 1e-6) return null;\n', '')],
  ['the 10 ft is 7', 'build-house.js',
    c => c.replace('  const STAIR_HEADER_SPAN_FT = 10;', '  const STAIR_HEADER_SPAN_FT = 7;')],
  // THE GARAGE SQUARE, Movie 16 Oct: each of his numbers, and each consumer.
  ['the square is a foot each side of the door, which closes the pier between two doors', 'build-house.js',
    c => c.replace('  const GARAGE_SQUARE_SIDE_IN = 6;', '  const GARAGE_SQUARE_SIDE_IN = 12;')],
  ['the square is 24 ft deep (the old "+4 on top")', 'build-house.js',
    c => c.replace('  const GARAGE_SQUARE_DEPTH_FT = 20;', '  const GARAGE_SQUARE_DEPTH_FT = 24;')],
  ['the square is measured from the wall line, not its inside face', 'build-house.js',
    c => c.replace('      const inset = Number.isFinite(door.insetFt) ? door.insetFt : insetFt;', '      const inset = 0;')],
  ['a shallow garage is not capped: the square runs out the back wall', 'build-house.js',
    c => c.replace('      const deep = Math.min(wantFt, avail);', '      const deep = wantFt;')],
  ['the landing is 36" square', 'build-house.js',
    c => c.replace('  const MAN_DOOR_LANDING_IN = 42;', '  const MAN_DOOR_LANDING_IN = 36;')],
  ['a well across the square\'s edge is not in it (corners only)', 'build-house.js',
    c => c.replace('        if (segmentsCross(a, b, k.points[j], k.points[(j + 1) % k.points.length])) return true;', '')],
  ['a column in the square stands: nothing is dropped', 'build-house.js',
    c => c.replace('        if (inKeepOut(keepOuts, p)) { dropped.push(p); continue; }\n', '')],
  ['the beam rests over the door: the row is not slid to solid wall', 'build-house.js',
    c => c.replace('    const solid = u => u > lo + 0.01 && u < hi - 0.01 && solidAt(u, openings);', '    const solid = u => u > lo + 0.01 && u < hi - 0.01;')],
  ['the post stands at the opening\'s edge with no bearing of its own', 'build-house.js',
    c => c.replace('  const BEAM_BEARING_CLEAR_FT = (BEAM_POST_IN / 2 + BEAM_BEARING_IN) / 12;', '  const BEAM_BEARING_CLEAR_FT = 0;')],
  ['no post is built into the wall under the beam\'s ends', 'build-house.js',
    c => c.replace('      posts.push(start, end);\n', '')],
  ['a wall that is all door is reported solid', 'build-house.js',
    c => c.replace("        bearing = 'none';", "        bearing = 'solid';")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('mid-span-beam',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const { midSpanBeams, owjFor, OWJ_SPANS, garageBeamPlan, garageJoistAxis, garageSpanFt,
  garageBareSpanFt, garageStairHeader, STAIR_HEADER_SPAN_FT, garageKeepOuts, inKeepOut, hitsKeepOut,
  GARAGE_SQUARE_DEPTH_FT, GARAGE_SQUARE_SIDE_IN, MAN_DOOR_LANDING_IN, BEAM_BEARING_CLEAR_FT,
  joistBays, deckJoistAxis, joistCallout, inchesLabel,
} = require('./harness-env.js').loadDraftModules().DraftBuildHouse;

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

{
  // 28 x 24 with the stair taking z -3..9: strips of 9 and 3, neither past
  // 19 on its own. The joists beside the opening still span 24, so the
  // beam stays -- mid-span of the larger strip (house-tour.spec.js:224).
  const plan = midSpanBeams(rect(28, 24), { holes: [{ min: -3, max: 9 }] });
  checkList('a stair leaving only narrow strips still keeps the beam, in the larger one',
    zsOf(plan.beams.map(b => b.start)), [-7.5]);
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

// ── OPEN WEB JOISTS OVER A GARAGE (Movie, 12 Oct) ─────────────────────────
{
  const pick = (span, opts) => { const o = owjFor(span, opts); return `${o.depthIn}@${o.ocIn}${o.fits ? '' : '!'}`; };
  // 19-1/4", NOT 19-3/4" (Movie, 13 Oct): every truss depth is its round
  // number less the 3/4" sheathing, so the FLOOR PACKAGE lands round --
  // "i like for ours lines up to 20\" even with the sheathing".
  const garage = { minDepthIn: 19.25 };
  checkEq('a 22 ft garage takes his 19-1/4" at 16" o.c.', pick(22, garage), '19.25@16');
  checkEq('never shallower over a garage, however short', pick(12, garage), '19.25@16');
  checkEq('past 25 ft it goes deeper, still at 16"', pick(27, garage), '23.25@16');
  checkEq('"12" for longest" once no 16" row reaches', pick(30, garage), '23.25@12');
  checkEq('past the table it says so', pick(33, garage), '23.25@12!');
  // AND THE 21-1/4" ROW CARRIES THE SPANS BETWEEN THEM (Movie, 14 Oct), so a
  // deck that is past 19-1/4" @ 16" does not jump straight to the deepest
  // truss in the table.
  checkEq('26 ft takes the new 21-1/4" row', pick(26, garage), '21.25@16');
  // 15-1/4", the shallowest row. Every depth is its round number less the
  // sheathing since 13 Oct, so the shallowest truss makes a 16" floor -- and
  // 13-1/4" left the table on 14 Oct (Movie: "only the 11 7/8\" are
  // Engineered TJI. the OWJ are 19.25\" or bigger, also smaller one 16\"
  // 15.25\" 18\" (17.25\"", then "than i guess 21.25\" and 23.25\" and
  // that's probably it hey"), because a 14" nominal open-web truss is not a
  // thing he orders -- that depth is a TJI, and a TJI is one depth, 11 7/8".
  checkEq('elsewhere the shallowest that spans it', pick(20, {}), '15.25@16');
  // THE DEPTHS ARE A FACT, where the spans are a judgement a supplier's own
  // chart may replace -- so the five he named are asserted outright.
  checkEq('the five depths an OWJ comes in',
    OWJ_SPANS.map(r => r.depthIn).join(), '15.25,17.25,19.25,21.25,23.25');
  checkEq('every row is safer at closer spacing',
    OWJ_SPANS.every(r => r.spanFt[12] > r.spanFt[16] && r.spanFt[16] > r.spanFt[19.2] && r.spanFt[19.2] > r.spanFt[24]), true);
  checkEq('and deeper always spans further',
    OWJ_SPANS.every((r, i) => i === 0 || [12, 16, 19.2, 24].every(oc => r.spanFt[oc] > OWJ_SPANS[i - 1].spanFt[oc])), true);
}

// ── PAST THE TABLE: DROPPED ENGINEERED BEAMS ON COLUMNS (Movie, 12 Oct) ───
{
  const box = { x0: 0, x1: 36, z0: 0, z1: 40 };
  const back = p => p.z <= 0.01;
  const between = garageBeamPlan(box, { doors: [{ x: 9, z: 40 }, { x: 27, z: 40 }], onWall: back });
  checkEq('a 36 ft span takes one beam, front to back', between.beams.length, 1);
  checkEq('between the two doors, so the cars miss its columns', between.beams[0].start.x, 18);
  checkEq('no joist row past the ceiling', between.rowFt <= garageBareSpanFt(), true);
  checkEq('columns no more than 10 ft apart, none at the wall it bears on',
    JSON.stringify(between.columns.map(c => c.z)), JSON.stringify([10, 20, 30, 40]));
  const wide = garageBeamPlan({ x0: 0, x1: 65, z0: 0, z1: 70 },
    { doors: [8, 20, 32, 44, 56].map(x => ({ x, z: 70 })) });
  checkEq('"if more than 60 would need 3 rows": two beams past 60 ft', wide.beams.length, 2);
  checkEq('each between a pair of doors', JSON.stringify(wide.beams.map(b => b.start.x)), JSON.stringify([26, 50]));
  const lopsided = garageBeamPlan(box, { doors: [{ x: 3, z: 40 }, { x: 6, z: 40 }] });
  checkEq('doors that would leave a row past 30 ft give way to even rows', lopsided.beams[0].start.x, 18);
  checkEq('a span the joists reach takes no beam', garageBeamPlan({ x0: 0, x1: 28, z0: 0, z1: 40 }).beams.length, 0);
  // ── THE 30 FT GARAGE HE REPORTED (Movie, 15 Oct) ────────────────────────
  //
  // "there should have been at least 1 beam (or 2 with one by the stairs) the
  // span was too far". It used to take none: maxJoistFt was a flat 30, which
  // let a 30 ft row through while the deck over it was being sized off the
  // table's 12" o.c. last resort. One number for both halves now.
  // His own: 30 across by 24 deep, doors in the front wall, so the joists run
  // the way that wall runs and the span is the 30.
  const his = { x0: 0, x1: 30, z0: 0, z1: 24 };
  const hisDoors = [{ x: 8, z: 24 }, { x: 22, z: 24 }];
  checkEq('and the span is the 30, side wall to side wall',
    garageSpanFt(his, hisDoors), 30);
  checkEq('and 30 ft -- his own detached garage -- takes one',
    garageBeamPlan(his, { doors: hisDoors }).beams.length, 1);
  checkEq('the bare-deck ceiling is the deepest OWJ at 16" o.c.',
    garageBareSpanFt({ minDepthIn: 19.25 }), 28);
  checkEq('and the row the beams cut to is that same number',
    garageBeamPlan(his, { doors: hisDoors }).rowFt <= garageBareSpanFt(), true);
  // "side wall to side wall -- the sides that land on walls": a garage wider
  // than it is deep still spans across, between the walls without doors.
  const shallow = { x0: 0, x1: 36, z0: 0, z1: 24 };
  const doorsFront = [{ x: 9, z: 24 }, { x: 27, z: 24 }];
  checkEq('the joists run the way the door wall runs, not the short way',
    garageJoistAxis(shallow, doorsFront), 'x');
  checkEq('so the span is side wall to side wall', garageSpanFt(shallow, doorsFront), 36);
  checkEq('and the beam still stands between the doors', garageBeamPlan(shallow, { doors: doorsFront }).beams[0].start.x, 18);
  checkEq('doors on a side wall turn the joists', garageJoistAxis(box, [{ x: 0, z: 20 }]), 'z');
  checkEq('no doors: the shorter side', garageJoistAxis(shallow, []), 'z');
}

// ── THE HEADER BY THE STAIRS ──────────────────────────────────────────────
//
// Movie, 15 Oct: "at least 1 beam (or 2 with one by the stairs)". The joists
// run in x here, the well sits 2 ft off the left wall and runs ALONG the beam,
// and the mid-span beam is at 16 -- so the stub by the wall is 2 ft and the
// inboard side runs 10.5.
//
// AND 16 OCT: "when the stairs are alligned perp to the main beam like in ths
// photo above, we don't need beams on the short ends of the stairs, only when
// it is ll and there is 10ft or more span of floor until the next beam or
// ext. wall". So the header is a refusal more often than a placement: a well
// across the beam gets none, and a well along it gets none under 10 ft.
{
  const well = { x0: 2, x1: 5.5, z0: 8, z1: 20 };
  const header = garageStairHeader(well, { axis: 'x', supports: [0, 16, 30] });
  checkEq('the header lands on the edge the joists run farther to reach',
    header && header.start.x, 5.5);
  checkEq('and runs the length of the well',
    header && JSON.stringify([header.start.z, header.end.z]), JSON.stringify([8, 20]));
  // THE SAME WELL WITH THE BEAM AT 15: 9.5 ft of floor to it, and "only when
  // ... there is 10ft or more span of floor until the next beam".
  checkEq('under 10 ft of floor to the next support, no header',
    garageStairHeader(well, { axis: 'x', supports: [0, 15, 30] }), null);
  // THE OTHER WAY ABOUT: a well hard against the inboard support and open to
  // the wall takes its header on the wall side instead. Same rule, read from
  // the other end -- which is the check that tells the rule from the answer.
  // Ten feet exactly, which is "10ft or more".
  const far = garageStairHeader({ x0: 10, x1: 14, z0: 8, z1: 20 },
    { axis: 'x', supports: [0, 15, 30] });
  checkEq('the long side wins whichever side it is on', far && far.start.x, 10);
  // ACROSS THE BEAM -- the photo: a well 12 ft along the joists and 3 1/2 ft
  // across them, with 16 ft of floor past its end. Its ends are headers, not
  // beams, however far the floor runs.
  checkEq('a well set across the beam takes no header on its ends',
    garageStairHeader({ x0: 2, x1: 14, z0: 8, z1: 11.5 }, { axis: 'x', supports: [0, 30] }), null);
  // A well with a support hard against both ends has nothing to catch.
  checkEq('a well between two supports takes no header',
    garageStairHeader({ x0: 0, x1: 15, z0: 8, z1: 20 }, { axis: 'x', supports: [0, 15] }), null);
  // IN z, the same answers turned a quarter.
  const turned = garageStairHeader({ x0: 8, x1: 20, z0: 2, z1: 5.5 },
    { axis: 'z', supports: [0, 16, 30] });
  checkEq('and the joists running in z turn it with them', turned && turned.start.z, 5.5);
  checkEq('the threshold is exported for the pages to quote', STAIR_HEADER_SPAN_FT, 10);
  checkEq('a well of no width is not a well', garageStairHeader({ x0: 2, x1: 2, z0: 8, z1: 20 },
    { axis: 'x', supports: [0, 15, 30] }), null);
}

// ── THE GARAGE SQUARE: NOTHING STANDS WHERE THE CAR GOES ──────────────────
//
// Movie, 16 Oct: "lets go 20ft total 'height (length) for square" ... "(not
// +4) just 20" ... "actually on the sides only make it increase by 6" so the
// colms can know they can be placed between the 2 doors" ... "no columns in
// that area either"; and "the landing area for the man door (42"x42"
// landing".
{
  // His garage: 30 wide, 24 deep, two 6'8" doors on the z = 24 wall at 8 and
  // 22, a 3 ft man door in the right side wall, 2x6 walls (5 1/2").
  const ring = [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 24 }, { x: 0, z: 24 }];
  const inset = 5.5 / 12;
  const south = { along: { x: 1, z: 0 }, inward: { x: 0, z: -1 } };
  const doors = [
    { id: 'a', at: { x: 8, z: 24 }, ...south, widthFt: 20 / 3, overhead: true },
    { id: 'b', at: { x: 22, z: 24 }, ...south, widthFt: 20 / 3, overhead: true },
    { id: 'm', at: { x: 30, z: 4 }, along: { x: 0, z: 1 }, inward: { x: -1, z: 0 }, widthFt: 3, overhead: false },
  ];
  const squares = garageKeepOuts(ring, doors, { insetFt: inset });
  const bays = squares.filter(k => k.kind === 'bay');
  const xs = k => k.points.map(p => p.x), zs = k => k.points.map(p => p.z);
  checkEq('one square per overhead door, and the man door\'s landing', squares.map(k => k.kind).join(), 'bay,bay,landing');
  checkEq('a 6\'8" door\'s square is 7\'-8" wide: the door plus 6" each side',
    +(Math.max(...xs(bays[0])) - Math.min(...xs(bays[0]))).toFixed(4), +(20 / 3 + 1).toFixed(4));
  checkEq('so the pier between the doors stays free: 11\'-10" to 18\'-2" is 6\'-4" of wall',
    +(Math.min(...xs(bays[1])) - Math.max(...xs(bays[0]))).toFixed(4), +(14 - 20 / 3 - 1).toFixed(4));
  checkEq('20\'-0" deep from the INSIDE face of the door wall',
    [Math.max(...zs(bays[0])), Math.min(...zs(bays[0]))].map(v => +v.toFixed(4)).join(), [24 - inset, 24 - inset - 20].map(v => +v.toFixed(4)).join());
  checkEq('not capped: the garage is deeper than its square', bays.some(k => k.capped), false);
  const landing = squares.find(k => k.kind === 'landing');
  checkEq('the landing is 42" x 42" inside the man door',
    [Math.max(...xs(landing)) - Math.min(...xs(landing)), Math.max(...zs(landing)) - Math.min(...zs(landing))].map(v => +v.toFixed(4)).join(), '3.5,3.5');
  checkEq('and starts at the wall\'s inside face', +Math.max(...xs(landing)).toFixed(4), +(30 - inset).toFixed(4));
  // A GARAGE SHALLOWER THAN ITS SQUARE: his is about 20 ft door wall to back
  // wall, so the square takes the whole depth, and the plan has to say so.
  const shallow = garageKeepOuts([{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 20 }, { x: 0, z: 20 }],
    doors.slice(0, 2).map(d => ({ ...d, at: { x: d.at.x, z: 20 } })), { insetFt: inset });
  checkEq('a 20 ft garage is capped at its own depth, inside face to inside face', +shallow[0].depthFt.toFixed(4), +(20 - 2 * inset).toFixed(4));
  checkEq('and says it is capped', shallow.every(k => k.capped), true);
  checkEq('the numbers are his: 20 ft, 6", 42"', [GARAGE_SQUARE_DEPTH_FT, GARAGE_SQUARE_SIDE_IN, MAN_DOOR_LANDING_IN].join(), '20,6,42');
  // WHAT STANDS IN ONE. A well inside a bay, a well straddling its edge, a
  // well in the pier, a well that swallows the landing.
  const well = (x0, x1, z0, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  checkEq('a well inside a bay stands where the car goes', hitsKeepOut(squares, well(6, 9, 10, 20)), true);
  checkEq('a well across a bay\'s edge does too', hitsKeepOut(squares, well(11, 14, 10, 20)), true);
  checkEq('a well on the pier between the doors is clear', hitsKeepOut(squares, well(12.5, 16, 10, 20)), false);
  // NO CORNER OF EITHER INSIDE THE OTHER: a well running right across the
  // bay, wall to pier. Only its edges cross the square's, and that is the
  // third way two rectangles meet.
  checkEq('a well that runs clean across a bay is in it', hitsKeepOut(squares, well(2, 14, 10, 12)), true);
  checkEq('a well past the square\'s 20 ft is clear', hitsKeepOut(squares, well(6, 9, 0.5, 3)), false);
  checkEq('a well that swallows the landing is in it', hitsKeepOut(squares, well(25, 30, 1, 7)), true);
  checkEq('a point in the bay', inKeepOut(squares, { x: 8, z: 12 }), true);
  checkEq('a point on the pier', inKeepOut(squares, { x: 15, z: 12 }), false);

  // THE BEAM PLAN HONOURS IT: columns in a bay are dropped, the pier keeps
  // its column, and every beam end gets its post in the wall.
  const box = { x0: 0, x1: 30, z0: 0, z1: 24 };
  const centres = doors.filter(d => d.overhead).map(d => d.at);
  const spans = doors.filter(d => d.overhead).map(d => [d.at.x - d.widthFt / 2, d.at.x + d.widthFt / 2]);
  const plan = garageBeamPlan(box, { doors: centres, keepOuts: squares, openings: spans, onWall: p => p.z <= 0.01 || p.z >= 23.99 });
  checkEq('the row stands on the pier between the doors', plan.beams[0].start.x, 15);
  checkEq('its columns are on the pier line, none dropped', JSON.stringify([plan.columns.map(c => c.z), plan.dropped.length]), JSON.stringify([[8, 16], 0]));
  checkEq('a 6x6 post under each end, in the wall', JSON.stringify(plan.posts), JSON.stringify([{ x: 15, z: 0 }, { x: 15, z: 24 }]));
  checkEq('solid bearing at both ends', plan.bearing, 'solid');
  // ONE WIDE DOOR IN THE MIDDLE: the even row would land over it. The row
  // slides to the door's edge plus the post and its bearing, and the column
  // that would have stood in the square is dropped.
  const one = [{ id: 'c', at: { x: 15, z: 24 }, ...south, widthFt: 16, overhead: true }];
  const oneSquares = garageKeepOuts(ring, one, { insetFt: inset });
  const p1 = garageBeamPlan(box, { doors: one.map(d => d.at), keepOuts: oneSquares, openings: [[7, 23]], onWall: p => p.z <= 0.01 || p.z >= 23.99 });
  checkEq('a beam never rests over the garage door: the row slides off it',
    +p1.beams[0].start.x.toFixed(4), +(7 - BEAM_BEARING_CLEAR_FT).toFixed(4));
  checkEq('by half a 6x6 and the lintel\'s bearing: 4 1/4"', +(BEAM_BEARING_CLEAR_FT * 12).toFixed(2), 4.25);
  checkEq('the columns that would have stood in front of the car are dropped',
    JSON.stringify([p1.columns.length, p1.dropped.length]), JSON.stringify([0, 2]));
  checkEq('and the long row is reported for the note', +p1.rowFt.toFixed(2), +(30 - (7 - BEAM_BEARING_CLEAR_FT)).toFixed(2));
  // NO SOLID WALL AT ALL: doors wall to wall.
  const none = garageBeamPlan(box, { doors: [{ x: 15, z: 24 }], openings: [[0.2, 29.8]] });
  checkEq('a wall that is all door has no bearing to give, and the plan says so', none.bearing, 'none');
  // A side wall's door is under no beam end: not an opening to the row.
  checkEq('the plain plan still answers as before', JSON.stringify(garageBeamPlan(box, { doors: centres }).beams), JSON.stringify(plan.beams));
}

// ── THE JOIST CALLOUT, ONE PER BAY (Movie, 16 Oct) ────────────────────────
//
// Marked up on the 2ND FL FLOOR LAYOUT: the three-line OWJ note struck out,
// an arrowed span line perpendicular to the beam in every bay, the short
// form beside it. joistBays answers the bays; the sheet draws them.
{
  const rect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  const HOUSE = rect(0, 0, 24, 30);
  const BEAM = { start: { x: 0.5, z: 22 }, end: { x: 23.5, z: 22 } };
  const WELL = { points: rect(8, 24, 11, 28) };
  const bays = joistBays(HOUSE, { beams: [BEAM], holes: [WELL] });
  checkEq('a beam across the deck makes two bays', bays.bays.length, 2);
  checkEq('the joists run across the beam', bays.axis, 'z');
  checkList('wall to beam, beam to wall', bays.bays.map(b => [b.from, b.to]), [[0, 22], [22, 30]]);
  checkEq('the deck-s span is its widest bay', bays.spanFt, 22);
  // THE ARROW IS CLEAR OF THE STAIRWELL: the well is at x 8..11, so a third
  // of the way (x 8) is in it and the arrow moves on to two thirds -- in the
  // well's own bay AND in the bay next door, whose arrow would otherwise
  // stand on the well's wall-to-wall string.
  checkEq('the arrow in the well-s bay stands clear of the well', Math.round(bays.bays[1].at * 100) / 100, 16);
  checkEq('and so does the arrow in the bay the well is not in', Math.round(bays.bays[0].at * 100) / 100, 16);
  checkEq('with no well there, a third of the way along',
    Math.round(joistBays(HOUSE, { beams: [BEAM] }).bays[0].at * 100) / 100, 8);
  checkEq('a well 3 ft off the third mark still moves it (the string and its label need the room)',
    Math.round(joistBays(HOUSE, { beams: [BEAM], holes: [{ points: rect(10.5, 24, 13, 28) }] }).bays[1].at * 100) / 100, 16);
  checkEq('and 3 ft and a hair off does not',
    Math.round(joistBays(HOUSE, { beams: [BEAM], holes: [{ points: rect(11.1, 24, 13, 28) }] }).bays[1].at * 100) / 100, 8);
  checkEq('two beams make three bays',
    joistBays(HOUSE, { beams: [BEAM, { start: { x: 0, z: 10 }, end: { x: 24, z: 10 } }] }).bays.length, 3);
  checkEq('a beam that does not cross the deck cuts no bay',
    joistBays(HOUSE, { beams: [{ start: { x: 30, z: 10 }, end: { x: 50, z: 10 } }] }).bays.length, 1);
  checkEq('a bare deck spans the short way', joistBays(rect(0, 0, 26, 24)).axis, 'z');
  checkEq('unless the caller says which way (a room over a garage)',
    joistBays(rect(0, 0, 26, 24), { axis: 'x' }).axis, 'x');
  checkEq('a bare deck is one bay wall to wall', joistBays(rect(0, 0, 26, 24), { axis: 'x' }).spanFt, 26);
  checkEq('a body too small to frame answers null', joistBays(rect(0, 0, 24, 0.2)), null);
  checkEq('an upright beam turns the joists', joistBays(HOUSE, { beams: [{ start: { x: 12, z: 0 }, end: { x: 12, z: 30 } }] }).axis, 'x');
  // THE WAY A DECK OVER A GARAGE RUNS: with the door wall (garageJoistAxis),
  // the doors read as points on their wall.
  const GARAGE = { points: rect(0, 0, 26, 24) };
  checkEq('over a garage with doors in the street wall, the joists run with that wall',
    deckJoistAxis(rect(0, 0, 26, 24), { garages: [GARAGE], doorPoints: [{ x: 13, z: 24 }] }), 'x');
  checkEq('doors in a side wall turn them',
    deckJoistAxis(rect(0, 0, 26, 24), { garages: [GARAGE], doorPoints: [{ x: 0, z: 12 }] }), 'z');
  checkEq('a deck over no garage says nothing (joistBays takes the short way)',
    deckJoistAxis(rect(40, 40, 60, 60), { garages: [GARAGE], doorPoints: [{ x: 13, z: 24 }] }), null);
  // THE SHORT FORM, off the schedule.
  checkEq('an OWJ reads ENGINEERED OWJ and its depth', joistCallout({ joistType: 'owj', joistDepthIn: 19.25 }), 'ENGINEERED OWJ 19-1/4"');
  checkEq('a TJI reads TJI and its depth', joistCallout({ joistType: 'tji', joistDepthIn: 11.875 }), 'TJI 11-7/8"');
  checkEq('lumber reads its size', joistCallout({ joistType: 'conv_2x10', joistDepthIn: 9.25 }), '2x10 JOISTS');
  checkEq('a whole depth has no fraction', inchesLabel(16), '16"');
  checkEq('a half is reduced', inchesLabel(11.5), '11-1/2"');
  checkEq('three quarters too', inchesLabel(23.75), '23-3/4"');
}

console.log(`\nmid-span beams: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
