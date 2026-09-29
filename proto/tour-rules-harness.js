#!/usr/bin/env node
// THE TOUR'S RULES — the pull ladder, the stair snap zone, the gable math and
// the room-stamp names, measured off tour.js itself.
//
// WHY IT EXISTS. Devin's audit, 28 Sep: tour.js publishes fourteen exports and
// not one test or harness in the repo names `DraftTour`. The page tests drive
// the tour through the browser, so what they witness is that a gesture had an
// effect -- not that the ladder puts a pile at 8' rather than 8.5', and not
// that a pull of 3' is refused. Those numbers are the drafter's own and they
// are written down in one place; nothing checks that the place still says it.
//
// WHAT IT CHECKS, AND WHY NOT MORE. Every export here is pure -- data in,
// numbers out, no DOM, no store -- which is the whole reason the module was
// carved out. So the subject is loaded from source into a sandbox and called
// directly. Two exports (stampDisplayName, detectorNumberStart) read
// window.DraftRoomGrow when it is there; both paths are checked, because the
// fallback is the one that runs on a page that has not loaded it and it is the
// one nobody would notice losing.
//
// THE LADDER IS CHECKED AS AN INVARIANT, NOT AS A TABLE OF ANSWERS. Seven
// spot values say the stages are where the comment says. The sweep says the
// thing the stages exist FOR: across the whole 0-18' range no span between
// supports exceeds 8', no cantilever past the outermost support exceeds 2',
// and no pull ever rests in the forbidden 2'-4'6" band. A table of answers
// goes green against a ladder rebuilt wrong in the same shape; the invariant
// does not.
//
// Run: node proto/tour-rules-harness.js
//      node proto/tour-rules-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

// One edit, aimed at tour.js by name. Every read goes through here so a
// mutation reaches the sandbox rather than the disk.
let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

// roomGrow: null loads tour.js with no DraftRoomGrow on the window, which is
// what a page that has not loaded room-grow.js gives it.
function loadTour(roomGrow) {
  const win = {};
  if (roomGrow) win.DraftRoomGrow = roomGrow;
  const sandbox = { window: win, console, Math, Number, String, Object, Array,
    JSON, Map, Set, RegExp, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('tour.js'), sandbox, { filename: 'tour.js' });
  if (!win.DraftTour) throw new Error('tour.js did not publish DraftTour');
  return win.DraftTour;
}

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

function runChecks() {
  passed = 0; failures = [];
  const T = loadTour(null);

  // ── THE PULL LADDER, STAGE BY STAGE ──────────────────────────────────
  // Read the comment at the top of tour.js beside these: each line here is
  // one of its rungs, and a rung that moves should land on exactly one.
  const ladder = [
    [0,    0,    [],        'nothing pulled is nothing to carry'],
    [2,    2,    [],        "2' is a pure cantilever, the office's hard cap"],
    [2.5,  2,    [],        "2'6\" is in the forbidden band and falls back to the cantilever"],
    [4,    4.5,  [4.5],     "4' is in the forbidden band and snaps up to the first pile"],
    [6,    6,    [6],       'one pile rides directly under the corner'],
    [8,    8,    [8],       "at 8' the pile is still under the corner"],
    [9.5,  9.5,  [8],       "past 8' the pile parks and the corner cantilevers"],
    [12,   12,   [6, 12],   'two piles: the outer rides the corner, the inner halves the run'],
    [18,   18,   [8, 16],   "at the 18' ceiling the outer parks at 16' and cantilevers 2'"],
  ];
  ladder.forEach(([ask, wantD, wantPiles, why]) => {
    const got = T.floorPullLadder(ask);
    check(`pull ${ask}' -> ${wantD}' (${why})`, near(got.d, wantD),
      `got ${got.d}`);
    check(`pull ${ask}' piles [${wantPiles}] (${why})`,
      got.piles.length === wantPiles.length
        && got.piles.every((p, i) => near(p, wantPiles[i])),
      `got [${got.piles}]`);
  });

  // READ AS A NUMBER, NOT AS THE EXPORT. Comparing the clamp against
  // T.FLOOR_PULL_MAX_FT is a check whose subject moves with the thing it is
  // checking: raise the constant and both sides agree at the new number. The
  // ceiling is 18' because the office says 18'.
  check("the ceiling is 18', stated", T.FLOOR_PULL_MAX_FT === 18,
    `the export says ${T.FLOOR_PULL_MAX_FT}`);
  check("the cantilever cap is 2', stated", T.FLOOR_CANTILEVER_FT === 2,
    `the export says ${T.FLOOR_CANTILEVER_FT}`);
  check('a pull past the ceiling is clamped, not refused',
    near(T.floorPullLadder(25).d, 18), `got ${T.floorPullLadder(25).d}`);
  check('a negative pull is clamped to nothing',
    near(T.floorPullLadder(-5).d, 0) && T.floorPullLadder(-5).piles.length === 0);

  // THE BAND IS THE POINT: 3' is both an illegal cantilever and a bad pile
  // spot, so no pull may ever come to rest inside it.
  // The sweep below is what would catch a ladder rebuilt wrong in the right
  // shape -- every 1/10 of a foot, not the nine rungs above.
  let inBand = 0, longSpan = null, longTip = null, unordered = 0;
  for (let ask = 0; ask <= 18.0001; ask += 0.1) {
    const { d, piles } = T.floorPullLadder(ask);
    if (d > T.FLOOR_CANTILEVER_FT + 1e-9 && d < 4.5 - 1e-9) inBand += 1;
    let prev = 0;
    piles.forEach(p => {
      if (p < prev - 1e-9) unordered += 1;
      if (p - prev > 8 + 1e-6 && (longSpan == null || p - prev > longSpan)) longSpan = p - prev;
      prev = p;
    });
    const tip = d - prev;
    if (tip > T.FLOOR_CANTILEVER_FT + 1e-6 && (longTip == null || tip > longTip)) longTip = tip;
  }
  check('no pull comes to rest in the forbidden 2\'-4\'6" band', inBand === 0,
    `${inBand} of the swept pulls did`);
  check('no span between supports exceeds 8\'', longSpan === null,
    `worst span ${longSpan}`);
  check('no cantilever past the outermost pile exceeds 2\'', longTip === null,
    `worst tip ${longTip}`);
  check('piles come back in order from the support outward', unordered === 0);

  // ── THE STACKED-STAIR SNAP ZONE ──────────────────────────────────────
  // A 10' run, 3' wide, from the origin down +x. Zone is the rectangle plus
  // a 1' margin, so it reaches 2.5' either side of the centreline.
  const run = [{ start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, widthFt: 3 }];
  const inside = T.stairSnapZone({ x: 5, z: 0 }, run);
  check('a point already inside the zone stands where it is',
    inside.snapped === false && near(inside.x, 5) && near(inside.z, 0));
  const nudged = T.stairSnapZone({ x: 5, z: 4 }, run);
  check('a point outside but within reach snaps', nudged && nudged.snapped === true);
  check('it snaps to the zone EDGE, not to the run centreline',
    nudged && near(nudged.z, 2.5), `landed at z ${nudged && nudged.z}`);
  check('a point beyond the snap radius is refused outright',
    T.stairSnapZone({ x: 5, z: 40 }, run) === null);
  check('with no stairs below, the point stands unsnapped',
    T.stairSnapZone({ x: 1, z: 1 }, []).snapped === false);
  const wide = T.stairSnapZone({ x: 5, z: 4 },
    [{ start: { x: 0, z: 0 }, end: { x: 10, z: 0 } }]);
  check('a run with no stated width is treated as 3\' wide',
    wide && near(wide.z, 2.5), `landed at z ${wide && wide.z}`);
  const two = T.stairSnapZone({ x: 5, z: 6 }, [
    { start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, widthFt: 3 },
    { start: { x: 0, z: 9 }, end: { x: 10, z: 9 }, widthFt: 3 },
  ]);
  check('with two runs below it snaps to the nearer one',
    two && near(two.z, 6.5), `landed at z ${two && two.z}`);

  // ── GABLE ANCHORS ────────────────────────────────────────────────────
  // Edge a->b 20' long. Candidates project onto it; only what lands inside
  // the run, clear of the margin at both ends, becomes an anchor.
  const a = { x: 0, z: 0 }, b = { x: 20, z: 0 };
  const anchors = T.gableAnchors(a, b, [
    { x: 12, z: 3, kind: 'W', floor: 1, widthFt: 4 },
    { x: 4,  z: -2, kind: 'D', floor: 2 },
    { x: 0.1, z: 0, kind: 'W', floor: 1 },     // inside the end margin
    { x: 25, z: 0, kind: 'W', floor: 1 },      // off the end
    { x: -3, z: 0, kind: 'W', floor: 1 },      // behind the start
  ]);
  check('only candidates landing within the run become anchors', anchors.length === 2,
    `got ${anchors.length}`);
  check('anchors come back in order along the edge',
    anchors[0] && anchors[1] && anchors[0].t < anchors[1].t);
  check('a candidate inside the end margin is dropped',
    !anchors.some(anchor => anchor.t < 0.25));
  check('a candidate off the wall projects onto it rather than being lost',
    anchors[1] && near(anchors[1].t, 12));
  check('an anchor carries its kind and floor', anchors[0].kind === 'D' && anchors[0].floor === 2);
  check('an anchor with no width says so rather than inventing one',
    anchors[0].widthFt === null);

  // ── SNAP ALONG THE EDGE ──────────────────────────────────────────────
  const grid = T.snapAlongEdge(5.4, 20, 1, []);
  check('free placement rounds to the increment', near(grid.t, 5) && grid.anchor === null);
  // The wall is 20'6" on purpose: on a wall whose length is a whole number
  // of increments a grid counted from the far end lands on the same ticks,
  // so the check would pass either way and prove nothing.
  check('the grid is counted FROM THE BUILDING CORNER',
    near(T.snapAlongEdge(5.4, 20.5, 1, []).t, 5),
    `a grid counted from the far end of a 20'6" wall would land on 5.5; got `
      + T.snapAlongEdge(5.4, 20.5, 1, []).t);
  const won = T.snapAlongEdge(5.4, 20, 1, [{ t: 5.6 }]);
  check('an anchor within the radius beats the grid',
    near(won.t, 5.6) && won.anchor !== null);
  // Nearest first in the list, so "the last one in range wins" is a
  // different answer from "the nearest wins".
  const nearer = T.snapAlongEdge(5.4, 20, 1, [{ t: 5.45 }, { t: 5.6 }]);
  check('the nearest anchor wins, not the last one in range',
    near(nearer.t, 5.45), `snapped to ${nearer.t}`);
  check('an anchor outside the radius does not',
    T.snapAlongEdge(5.4, 20, 1, [{ t: 9 }]).anchor === null);
  check('the grid never walks off the end of the edge',
    near(T.snapAlongEdge(25, 20, 1, []).t, 20) && near(T.snapAlongEdge(-9, 20, 1, []).t, 0));

  // ── GABLE SPLIT AND PEAK RISE ────────────────────────────────────────
  const mid = T.gableSplit(20, 10, 6);
  check('a gable centres on the point asked for',
    near(mid.fromFt, 7) && near(mid.toFt, 13));
  const left = T.gableSplit(20, 1, 6);
  check('a gable pushed at the start keeps its flank',
    near(left.fromFt, 1) && near(left.toFt, 7));
  const right = T.gableSplit(20, 19, 6);
  check('a gable pushed at the end keeps the far flank too',
    near(right.toFt, 19) && near(right.fromFt, 13));
  check('the gable keeps its full width wherever it is clamped',
    near(mid.toFt - mid.fromFt, 6) && near(left.toFt - left.fromFt, 6)
      && near(right.toFt - right.fromFt, 6));
  check('the wall lengthens by the triangle rise at the peak',
    near(T.gablePeakRiseFt(20, 6), 5),
    "a 20' gable at 6/12 rises 5'");

  // ── THE FINALE'S REVEAL ──────────────────────────────────────────────
  check('the reveal starts at the floor', near(T.revealClipY(0, 2500, 0, 10), 0));
  check('the reveal ends at the top', near(T.revealClipY(2500, 2500, 0, 10), 10));
  check('time past the end does not climb further',
    near(T.revealClipY(9000, 2500, 0, 10), 10));
  check('the reveal is EASED, not linear',
    !near(T.revealClipY(625, 2500, 0, 10), 2.5, 0.05),
    'a quarter of the way through a linear climb would be at 2.5');
  check('the ease is symmetrical about the half',
    near(T.revealClipY(1250, 2500, 0, 10), 5));
  let climbed = true, last = -1;
  for (let ms = 0; ms <= 2500; ms += 50) {
    const y = T.revealClipY(ms, 2500, 0, 10);
    if (y < last - 1e-9) climbed = false;
    last = y;
  }
  check('the reveal never goes back down', climbed);

  // ── ROOM STAMP NAMES, WITHOUT room-grow.js ───────────────────────────
  // The fallback path: per-floor numbering, bare until a second lands. This
  // is what a page that has not loaded room-grow.js gets, and no browser
  // test stands on it.
  const stamps = [
    { id: 1, levelId: 2, base: 'OFFICE', name: 'OFFICE' },
    { id: 2, levelId: 2, base: 'BEDROOM', name: 'BEDROOM' },
    { id: 3, levelId: 2, base: 'BEDROOM', name: 'BEDROOM' },
    { id: 4, levelId: 3, base: 'BEDROOM', name: 'BEDROOM' },
    { id: 5, levelId: 2, base: null, name: 'MOVIE ROOM' },
  ];
  check('the only room of its base on its floor is bare',
    T.stampDisplayName(stamps, stamps[0]) === 'OFFICE');
  check('a second of the same base numbers them both',
    T.stampDisplayName(stamps, stamps[1]) === 'BEDROOM 1'
      && T.stampDisplayName(stamps, stamps[2]) === 'BEDROOM 2');
  check('numbering is per floor when the house-wide ladder is not loaded',
    T.stampDisplayName(stamps, stamps[3]) === 'BEDROOM');
  check('a renamed stamp keeps its custom name forever',
    T.stampDisplayName(stamps, stamps[4]) === 'MOVIE ROOM');
  check('numbering follows placement order, not array order',
    T.stampDisplayName([stamps[2], stamps[1]], stamps[1]) === 'BEDROOM 1',
    'the lower id is 1 whichever way the list is handed over');
  check('the detector starts one past the stamps on that floor',
    T.detectorNumberStart(stamps, 'BEDROOM', 2) === 3);
  check('the detector counts that floor only',
    T.detectorNumberStart(stamps, 'BEDROOM', 3) === 2);
  check('a base with no stamps starts at 1',
    T.detectorNumberStart(stamps, 'DEN', 2) === 1);

  // ── ROOM STAMP NAMES, WITH room-grow.js ──────────────────────────────
  // A stand-in ladder, so what is checked is that tour.js DEFERS to it --
  // not what room-grow.js decides, which is room-grow's own business.
  const grown = loadTour({
    assignStampNumbers: list => new Map(list.map(s => [s.id, `${s.base} B9`])),
  });
  check('the house-wide ladder governs a BEDROOM when it is loaded',
    grown.stampDisplayName(stamps, stamps[1]) === 'BEDROOM B9');
  check('it does not govern a base outside the house-wide list',
    grown.stampDisplayName(stamps, stamps[0]) === 'OFFICE');
  check('it does not override a renamed stamp',
    grown.stampDisplayName(stamps, stamps[4]) === 'MOVIE ROOM');
  check('the detector reads the numbers the ladder actually assigned',
    grown.detectorNumberStart(stamps, 'BEDROOM', 1, 1) === 10,
    'the stand-in hands out B9 on the basement level, so the detector starts at 10');

  // ── COMPANIONS AND INCREMENTS ────────────────────────────────────────
  check('the primary suite brings an ensuite and a walk-in',
    T.bedroomCompanions('BEDROOM 1').join() === 'ENSUITE,WALK-IN');
  check('an ordinary bedroom brings a closet',
    T.bedroomCompanions('BEDROOM').join() === 'CLOSET');
  check('a room that is not a bedroom brings nothing',
    T.bedroomCompanions('OFFICE').length === 0);

  const inc = T.normaliseTourRoofIncrements(undefined);
  check('the resting grid falls back to a foot',
    inc.baseIn === 12 && inc.shiftIn === 6 && inc.ctrlShiftIn === 3);
  check('a stored increment is kept',
    T.normaliseTourRoofIncrements({ baseIn: 4 }).baseIn === 4);
  check('a zero or negative increment falls back rather than freezing the grid',
    T.normaliseTourRoofIncrements({ baseIn: 0, shiftIn: -2 }).baseIn === 12
      && T.normaliseTourRoofIncrements({ baseIn: 0, shiftIn: -2 }).shiftIn === 6);
  check('a non-numeric increment falls back',
    T.normaliseTourRoofIncrements({ ctrlShiftIn: 'six' }).ctrlShiftIn === 3);
}

if (!MUTATE) {
  runChecks();
  console.log(`\ntour rules harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
//
// Every row bends one number or one guard that the drafter stated out loud in
// the comment at the top of tour.js, and every row has to make a check above
// go red. A row that survives is a rule this harness only appears to check.
const MUTATIONS = [
  ["the pull ceiling is raised past 18'", 'tour.js',
    c => c.replace('const FLOOR_PULL_MAX_FT = 18;', 'const FLOOR_PULL_MAX_FT = 20;')],

  ["the cantilever cap grows from 2' to 3'", 'tour.js',
    c => c.replace('const FLOOR_CANTILEVER_FT = 2;', 'const FLOOR_CANTILEVER_FT = 3;')],

  ['the first pile moves in to 4\'', 'tour.js',
    c => c.replace('const FLOOR_FIRST_PILE_FT = 4.5;', 'const FLOOR_FIRST_PILE_FT = 4;')],

  ['the parked pile drifts out past 8\'', 'tour.js',
    c => c.replace('const FLOOR_ONE_PILE_PARK_FT = 8;', 'const FLOOR_ONE_PILE_PARK_FT = 9;')],

  ['the outer pile parks further out, so the last span goes long', 'tour.js',
    c => c.replace('const FLOOR_TWO_PILE_PARK_FT = 16;', 'const FLOOR_TWO_PILE_PARK_FT = 17;')],

  ['the forbidden band is no longer snapped out of', 'tour.js',
    c => c.replace(`    if (d > FLOOR_CANTILEVER_FT && d < FLOOR_FIRST_PILE_FT) {
      d = d - FLOOR_CANTILEVER_FT < FLOOR_FIRST_PILE_FT - d
        ? FLOOR_CANTILEVER_FT : FLOOR_FIRST_PILE_FT;
    }
`, '')],

  ['the band snaps the wrong way, to the far side', 'tour.js',
    c => c.replace('? FLOOR_CANTILEVER_FT : FLOOR_FIRST_PILE_FT;',
      '? FLOOR_FIRST_PILE_FT : FLOOR_CANTILEVER_FT;')],

  ['the parked-pile stage is dropped, so the pile rides past 8\'', 'tour.js',
    c => c.replace(`    if (d <= FLOOR_ONE_PILE_PARK_FT + FLOOR_CANTILEVER_FT) {
      return { d, piles: [FLOOR_ONE_PILE_PARK_FT] };
    }
`, '')],

  ['the inner pile stops halving the run', 'tour.js',
    c => c.replace('return { d, piles: [outer / 2, outer] };',
      'return { d, piles: [FLOOR_ONE_PILE_PARK_FT, outer] };')],

  ['the snap zone stops refusing a click that is nowhere near', 'tour.js',
    c => c.replace('    if (best.dist <= snapFt) return { x: best.x, z: best.z, snapped: true };\n    return null;',
      '    return { x: best.x, z: best.z, snapped: true };')],

  ['a point already inside the zone is dragged to its edge anyway', 'tour.js',
    c => c.replace('if (best.dist < 0.05) return { x: pt.x, z: pt.z, snapped: false }; // already inside', '')],

  ['the zone loses its 1\' margin', 'tour.js',
    c => c.replace('const half = (stair.widthFt || 3) / 2 + marginFt;',
      'const half = (stair.widthFt || 3) / 2;')],

  ['a run with no stated width is treated as a line', 'tour.js',
    c => c.replace('const half = (stair.widthFt || 3) / 2 + marginFt;',
      'const half = (stair.widthFt || 0) / 2 + marginFt;')],

  ['anchors stop being kept clear of the wall ends', 'tour.js',
    c => c.replace('if (t < marginFt || t > len - marginFt) return null;',
      'if (t < -1e9) return null;')],

  ['anchors come back in the order the candidates were handed over', 'tour.js',
    c => c.replace('.filter(Boolean).sort((p, q) => p.t - q.t);', '.filter(Boolean);')],

  ['an anchor with no width is given one', 'tour.js',
    c => c.replace('widthFt: candidate.widthFt || null', 'widthFt: candidate.widthFt || 3')],

  ['the grid is counted from the far end of the wall', 'tour.js',
    c => c.replace('const snapped = Math.round(tFt / incrementFt) * incrementFt;',
      'const snapped = edgeLenFt - Math.round((edgeLenFt - tFt) / incrementFt) * incrementFt;')],

  ['the grid is no longer held on the wall', 'tour.js',
    c => c.replace('return { t: Math.min(Math.max(snapped, 0), edgeLenFt), anchor: null };',
      'return { t: snapped, anchor: null };')],

  ['the second anchor in range wins instead of the nearest', 'tour.js',
    c => c.replace('if (d <= snapRadiusFt && (!best || d < Math.abs(best.t - tFt))) best = anchor;',
      'if (d <= snapRadiusFt) best = anchor;')],

  ['an anchor out of range still beats the grid', 'tour.js',
    c => c.replace('if (d <= snapRadiusFt && (!best', 'if ((!best')],

  ['the gable is allowed to run off the end of the wall', 'tour.js',
    c => c.replace(`    const from = Math.max(minFlankFt,
      Math.min(centerFt - half, edgeLenFt - minFlankFt - widthFt));`,
    '    const from = centerFt - half;')],

  ['the peak rise forgets the gable is a triangle', 'tour.js',
    c => c.replace('const gablePeakRiseFt = (widthFt, pitch) => (widthFt / 2) * (pitch / 12);',
      'const gablePeakRiseFt = (widthFt, pitch) => widthFt * (pitch / 12);')],

  ['the reveal climbs linearly', 'tour.js',
    c => c.replace('const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;',
      'const eased = t;')],

  ['the reveal is not held at the top', 'tour.js',
    c => c.replace('const t = Math.min(1, Math.max(0, elapsedMs / durationMs));',
      'const t = Math.max(0, elapsedMs / durationMs);')],

  ['stamps are numbered in the order the list arrives, not by placement', 'tour.js',
    c => c.replace('.sort((a, b) => a.id - b.id);', ';')],

  ['a stamp that is the only one of its base is numbered 1 anyway', 'tour.js',
    c => c.replace('if (pool.length === 1) return stamp.base;', '')],

  ['numbering pools every floor together without the house-wide ladder', 'tour.js',
    c => c.replace('.filter(other => other.base === stamp.base && other.levelId === stamp.levelId)',
      '.filter(other => other.base === stamp.base)')],

  ['a renamed stamp is renumbered under its old base', 'tour.js',
    c => c.replace('if (!stamp.base) return stamp.name; // renamed — custom forever', '')],

  ['the house-wide ladder is ignored when it is loaded', 'tour.js',
    c => c.replace('if (HOUSE_WIDE.includes(stamp.base) && window.DraftRoomGrow) {',
      'if (false) {')],

  ['the detector starts ON the last number instead of past it', 'tour.js',
    c => c.replace('      return highest + 1;', '      return highest;')],

  ['the detector counts the whole house when the ladder is absent', 'tour.js',
    c => c.replace('return stamps.filter(stamp => stamp.base === base && stamp.levelId === levelId).length + 1;',
      'return stamps.filter(stamp => stamp.base === base).length + 1;')],

  ['the primary suite brings a closet like any other bedroom', 'tour.js',
    c => c.replace("base === 'BEDROOM 1' ? ['ENSUITE', 'WALK-IN']", "base === 'BEDROOM 1' ? ['CLOSET']")],

  ['a zero increment is taken at face value and freezes the grid', 'tour.js',
    c => c.replace('return Number.isFinite(n) && n > 0 ? n : fallback;',
      'return Number.isFinite(n) ? n : fallback;')],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }   // a mutant that will not even run is caught
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`tour-rules-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
