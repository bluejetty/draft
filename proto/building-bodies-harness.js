#!/usr/bin/env node
// BUILDING BODIES — offline checks for building-bodies.js.
//
// The cap is Movie's: "1 autobuilt BUILDING per DRAFT file (a BUILDING would
// be a HOUSE or a DETACHED GARAGE)". It is on the PAIR, not one slot each.
// The question this module answers -- what does this drawing already hold --
// decides whether MODEL's bone has anything left to offer, so the answers
// are pinned here rather than only through a page that has to be driven.
//
//   node proto/building-bodies-harness.js
//
// Exit 0 = every check passed.
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const { loadDraftModules } = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');

// ── THE MUTANTS ───────────────────────────────────────────────────────────
//
// THIS FILE BUILT ITS OWN vm SANDBOX UNTIL 30 SEP, and that is the whole
// reason it had no table. A sandbox harness-env.js did not make cannot see
// DRAFT_HARNESS_SOURCE_OVERRIDES, so no row could reach the source: the
// module was unbendable, and an unbendable module cannot be checked by
// bending it. Adding building-bodies.js to loadDraftModules' list was the
// one change that made a table possible at all.
//
// A MUTANT RUNS AS ITS OWN PROCESS, through mutant-subprocess.js -- the
// parent bends the source, the child is this same harness with the override
// pointing at it, and harness-env.js's loader prefers what it finds there.
const MUTATIONS = [
  // ── pointInLoop ─────────────────────────────────────────────────────────
  // EVEN-ODD IS THE WHOLE ALGORITHM. A latch answers "the ray hit something"
  // instead of "the ray hit an odd number of things", which is right for
  // every point inside a convex shape and wrong for every point left of one.
  // A check that only ever sampled the middle of a square could not tell the
  // two apart, so this row exists to prove the ones outside it are real.
  ['the ray latches instead of flipping, so anything it hits reads as inside',
    'building-bodies.js',
    c => c.replace('      if (crosses) inside = !inside;',
      '      if (crosses) inside = true;')],

  // A RAY THROUGH A VERTEX MUST COUNT IT ONCE. `!==` is what says EXACTLY
  // one end of the edge is above the sample; `||` says at least one is, so
  // the two edges meeting at a vertex both count and the ray crossing it
  // comes back with the answer inverted.
  ['an edge counts when either end is above the sample, not exactly one',
    'building-bodies.js',
    c => c.replace('      const crosses = ((a.z > at.z) !== (b.z > at.z))',
      '      const crosses = ((a.z > at.z) || (b.z > at.z))')],

  // ── storeyBodies ────────────────────────────────────────────────────────
  ['a garage counts as one of the storey\'s bodies', 'building-bodies.js',
    c => c.replace('      && outline.garage !== true\n', '')],

  ['a two-point outline counts as a footprint', 'building-bodies.js',
    c => c.replace('      && (outline.points || []).length >= 3)',
      '      && (outline.points || []).length >= 0)')],

  // LEVEL IDS ARRIVE BOTH WAYS. A saved file can hand back '2' where the
  // page held 2, so both sides are coerced; === alone silently returns an
  // empty storey, which reads as "nothing drawn here" rather than as an
  // error.
  ['the storey id is compared without coercing it', 'building-bodies.js',
    c => c.replace('    .filter(outline => Number(outline.levelId) === Number(storeyId)',
      '    .filter(outline => outline.levelId === storeyId')],

  // ── houseOutlineOn ──────────────────────────────────────────────────────
  ['the level id is compared without coercing it', 'building-bodies.js',
    c => c.replace('      .find(item => Number(item.id) === Number(levelId));',
      '      .find(item => item.id === levelId);')],

  // THE SMALLEST BODY WINS. auto-stair-mutants.js carries a row with this
  // same aim, and it has to drive a browser to see it; this one is the same
  // claim for the price of a subprocess.
  ['the smallest body on the storey is taken for the house',
    'building-bodies.js',
    c => c.replace('      ownArea(body.outline) > ownArea(best.outline) ? body : best).outline;',
      '      ownArea(body.outline) < ownArea(best.outline) ? body : best).outline;')],

  ['a room over the garage is eligible to be the house', 'building-bodies.js',
    c => c.replace('    const house = bodies.filter(body => !bodyOverGarage(drawing, body.outline));',
      '    const house = bodies;')],

  // ── bodyOverGarage ──────────────────────────────────────────────────────
  // THE SHARE IS WHAT SEPARATES SITTING ON IT FROM TOUCHING IT. At zero, a
  // house whose corner laps a garage by a few feet is disqualified from
  // being the house -- which is the exact reading the constant's own comment
  // forbids.
  ['any overlap at all counts as sitting over the garage', 'building-bodies.js',
    c => c.replace('    return inBody > 0 && over / inBody > OVER_GARAGE_BODY_SHARE;',
      '    return inBody > 0 && over / inBody > 0;')],

  // AND THE FALLBACK. Every body on the storey over a garage is a DETACHED
  // garage with a room on it, which Movie says does want a stair -- so the
  // filter cannot be allowed to empty the pool.
  ['nothing falls back when every body sits over a garage', 'building-bodies.js',
    c => c.replace('    const pool = house.length ? house : bodies;',
      '    const pool = house;')],

  // ── TWO ROWS ARE NOT HERE, AND BOTH WERE TRIED FIRST ────────────────────
  //
  // THE EPSILON GUARD. `((b.z - a.z) || Number.EPSILON)` is what this
  // module's own comment called the behavioural difference between its
  // pointInLoop and the two private copies in geometry-2d.js. A row dropping
  // the `|| Number.EPSILON` SURVIVES, and not because the checks are weak:
  // the guard cannot be reached. `crosses` needs `(a.z > at.z) !== (b.z >
  // at.z)`, false whenever a.z === b.z, so `&&` short-circuits before the
  // division -- and a zero denominator needs exactly the a.z === b.z the
  // short circuit has already refused. Measured as well as argued: 12,996
  // samples over a square, an L, a comb and a ring with a repeated point,
  // guarded against bare, ZERO disagreements. Both geometry-2d copies are
  // written with the same `&&`, so all three agree; building-bodies.js has
  // been corrected to say so, which is worth more than a row here because it
  // says unifying the three is safe.
  //
  // THE HALF-OPEN SIDE. `(a.z > at.z) !== (b.z > at.z)` turned `>=` also
  // SURVIVES, and this one is a row that should not exist rather than a hole
  // to plug. Both forms are consistent half-open rules; they disagree only
  // at points lying exactly on a vertex row -- 84,100 samples over four
  // shapes, 496 disagreements, every one of them on such a row and none
  // anywhere else -- and where two bodies share an edge BOTH forms count a
  // point on it exactly once. They differ only in WHICH body owns the line:
  // `>` gives it to the upper, `>=` to the lower. Nothing any caller can see
  // turns on that, so a check written to kill the row would be pinning an
  // arbitrary side and calling it a requirement. The `||` row above is the
  // crossing-test row that CAN go red for a reason that matters.
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('building-bodies',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const B = loadDraftModules().DraftBuildingBodies;
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

check('building-bodies.js defines DraftBuildingBodies', !!B, String(B));
if (!B) { console.log('building bodies harness: 0 passed, 1 failed'); process.exit(1); }

const house = { id: 'o1', levelId: 1 };
const upper = { id: 'o2', levelId: 2 };
const attached = { id: 'o3', levelId: 1, garage: true };
const attached2 = { id: 'o6', levelId: 1, garage: true };
const detached = { id: 'o4', levelId: 1, garage: true, detached: true };
const stamped = { id: 'o5', levelId: 1, garage: true, masterId: 'm1' };
const master = { id: 'm1', shelfId: 7, garage: true, detached: true };

const left = drawing => JSON.stringify(B.missing(drawing));

// ── AN EMPTY DRAWING ─────────────────────────────────────────────────────
check('an empty drawing holds neither body',
  !B.hasHouse({}) && !B.hasDetachedGarage({}), left({}));
// TWO OR NOTHING, NEVER ONE. An empty file offers BOTH because the drafter
// has yet to choose which building this file is for; the moment one stands
// the other is gone too. A `missing` of length 1 would mean the old
// slot-each rule had come back.
check('and both are still on offer',
  left({}) === '["house","detachedGarage"]', left({}));
check('nothing at all does not throw',
  !B.hasHouse(null) && !B.isFull(undefined), 'null drawing');

// ── THE HOUSE ────────────────────────────────────────────────────────────
check('an outline with no garage flag is a house',
  B.hasHouse({ outlines: [house] }), 'house');
// A TWO STOREY HOUSE IS ONE BODY WITH AN OUTLINE PER STOREY. The question is
// "is there a house", never "how many outlines" -- counting would call a
// second storey a second house, which mattered under the old rule and would
// now be invisible, since one house already closes the board.
check('a second storey is the same house, not a second one',
  B.hasHouse({ outlines: [house, upper] })
  && B.missing({ outlines: [house, upper] }).length === 0,
  left({ outlines: [house, upper] }));

// ── THE GARAGES ──────────────────────────────────────────────────────────
// THE ONE THAT BITES, and it needs the house taken AWAY to be seen at all.
// Under the old rule the witness was "a house plus an attached garage is
// still owed its detached one"; now the house alone fills the file, so that
// sentence cannot distinguish an attached garage from a doorknob. Standing
// the attached garage ON ITS OWN is what isolates the property: it is not a
// building, so the file is still empty and BOTH are on offer.
check('an attached garage is not a detached one',
  !B.hasDetachedGarage({ outlines: [attached] })
  && B.hasAttachedGarage({ outlines: [attached] }),
  left({ outlines: [attached] }));
check('and on its own it is no building at all',
  !B.hasBuilding({ outlines: [attached] })
  && left({ outlines: [attached] }) === '["house","detachedGarage"]',
  left({ outlines: [attached] }));
// MOVIE, ASKED DIRECTLY: "2 or more can be allowed for attached garage i
// think". They hang off the house, so no number of them is a second body.
check('and any number of them is still one building',
  B.hasBuilding({ outlines: [house, attached, attached2] })
  && !B.hasDetachedGarage({ outlines: [house, attached, attached2] }),
  left({ outlines: [house, attached, attached2] }));
check('a garage that says detached is one',
  B.hasDetachedGarage({ outlines: [detached] }), 'detached');
// STAMPED FROM THE SHELF, the outline carries the master's id and not its
// properties -- reading only the outline would call a stamped detached
// garage attached, and let a second building in beside it.
check('a garage stamped from a detached master is detached',
  B.hasDetachedGarage({ outlines: [stamped], boneyardOutlines: [master] }),
  'stamped');
check('and without its master it is not guessed at',
  !B.hasDetachedGarage({ outlines: [stamped] }), 'orphan stamp');
check('a garage is never counted as the house',
  !B.hasHouse({ outlines: [detached] }), 'garage only');

// ── FULL ─────────────────────────────────────────────────────────────────
// EITHER ONE ALONE IS THE WHOLE CAP. These two are the change itself: under
// the old rule each of these files was half empty and the board stayed open.
check('a house alone fills the file',
  B.isFull({ outlines: [house] }), left({ outlines: [house] }));
check('a detached garage alone fills the file',
  B.isFull({ outlines: [detached] }), left({ outlines: [detached] }));
// AND A HOUSE DOES NOT LEAVE THE GARAGE OWED, which is the sentence that
// reverses. Spelled out rather than folded into the check above, because
// this is the one a reader of the old harness will come looking for.
check('a house closes the board to the detached garage too',
  !B.missing({ outlines: [house, upper, attached] }).includes('detachedGarage'),
  left({ outlines: [house, upper, attached] }));
check('and a detached garage closes it to the house',
  !B.missing({ outlines: [detached] }).includes('house'),
  left({ outlines: [detached] }));
// THE PAIR CANNOT SHARE A FILE ANY MORE, so a drawing holding both is a file
// written before this rule. It reads as full, which is the safe answer: the
// bone offers nothing rather than topping it up.
const legacy = { outlines: [house, upper, attached, detached] };
check('a file that already holds both still reads as full',
  B.isFull(legacy) && B.missing(legacy).length === 0, left(legacy));

// ── WHAT IS INSIDE WHAT ──────────────────────────────────────────────────
//
// pointInLoop, storeyBodies and houseOutlineOn moved into this file on 30 Sep
// so the window size tags and the auto stair could stop reading MODEL's
// closure for them. NOTHING OFFLINE TOUCHED THEM. The checks above are all
// about the one-building cap, and the three answers below were exercised
// only by driving a browser -- a module read by MODEL.html, layout-plan.js
// and plan-composition.js should be able to say whether it works without one.

const SQUARE = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];
// AN L, because a bounding box answers the notch wrong and a convex-only
// check would never find out.
const ELL = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 },
  { x: 4, z: 4 }, { x: 4, z: 10 }, { x: 0, z: 10 }];

check('the middle of a square is inside it',
  B.pointInLoop(SQUARE, { x: 5, z: 5 }), 'centre');
// TO THE LEFT, WHERE THE RAY CROSSES TWICE. This is the point that tells
// even-odd from "the ray hit something": a latch reads it as inside, and a
// check that only ever sampled the centre could not tell the two apart.
check('a point left of a square is outside it, though the ray crosses twice',
  !B.pointInLoop(SQUARE, { x: -5, z: 5 }), 'left of square');
check('and one to the right is outside it, with nothing to cross at all',
  !B.pointInLoop(SQUARE, { x: 15, z: 5 }), 'right of square');
// DIAGONALLY OFF THE CORNER, outside on BOTH axes and below every vertex the
// shape has. Straight out to the side is not the same question: with every
// vertex above the sample the horizontal edges start counting too, and
// whether that lands odd or even depends on how many there are. This point
// is where a crossing test that asks "is either end above" instead of
// "is exactly one end above" first gives a wrong answer.
check('a point below and left of the whole square is outside it',
  !B.pointInLoop(SQUARE, { x: -5, z: -5 }), 'off the corner');
check('the notch of an L is outside it',
  !B.pointInLoop(ELL, { x: 7, z: 7 }), 'L notch');
check('and both of the L\'s arms are inside it',
  B.pointInLoop(ELL, { x: 7, z: 2 }) && B.pointInLoop(ELL, { x: 2, z: 7 }),
  `arm z2 ${B.pointInLoop(ELL, { x: 7, z: 2 })}, arm z7 ${B.pointInLoop(ELL, { x: 2, z: 7 })}`);
check('beside the L, level with its lower arm, is outside it',
  !B.pointInLoop(ELL, { x: -5, z: 2 }), 'beside the low arm');
// A RAY THROUGH A VERTEX COUNTS IT ONCE. z = 4 runs straight through the L's
// inside corner, where two edges meet: `!==` is what says exactly one end of
// an edge is above the sample, so the pair contributes one crossing and not
// two.
check('a ray straight through the L\'s inner corner still reads inside',
  B.pointInLoop(ELL, { x: 2, z: 4 }), 'through the corner');

// ── THE BODIES ON ONE STOREY ─────────────────────────────────────────────
const sq = (x, z, w, d) =>
  [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
// LEVEL 2 IS FILED UNDER A STRING and one of its outlines answers with a
// number, because a saved file hands back both and storeyBodies coerces
// both sides on purpose.
const storeys = {
  levels: [{ id: 1 }, { id: '2' }],
  outlines: [
    { id: 'h', levelId: 1, points: sq(0, 0, 24, 20) },
    { id: 'g', levelId: 1, garage: true, points: sq(40, 0, 24, 24) },
    { id: 'thin', levelId: 1, points: [{ x: 0, z: 0 }, { x: 1, z: 1 }] },
    { id: 'u', levelId: 2, points: sq(0, 0, 10, 10) },
    { id: 's', levelId: '2', points: sq(60, 60, 6, 6) },
  ],
};
const idsOn = (drawing, id) =>
  B.storeyBodies(drawing, id).map(body => body.outline.id).join(',');

check('a storey holds the footprints filed on it',
  idsOn(storeys, 1) === 'h', idsOn(storeys, 1));
check('a garage on that storey is not one of its bodies',
  !idsOn(storeys, 1).split(',').includes('g'), idsOn(storeys, 1));
// TWO POINTS ARE A LINE, NOT A FOOTPRINT. ownArea would hand back 0 for it
// and the reduce would quietly carry it along as a body.
check('and a two-point outline is not a footprint at all',
  !idsOn(storeys, 1).split(',').includes('thin'), idsOn(storeys, 1));
check('a storey id given as a string finds the same bodies as the number',
  idsOn(storeys, '1') === idsOn(storeys, 1) && idsOn(storeys, '1') === 'h',
  `'1' -> ${idsOn(storeys, '1')}, 1 -> ${idsOn(storeys, 1)}`);
check('and an outline whose own levelId is a string is found too',
  idsOn(storeys, 2) === 'u,s', idsOn(storeys, 2));
check('the body carries the storey it was asked for',
  B.storeyBodies(storeys, 1)[0].storeyId === 1,
  String(B.storeyBodies(storeys, 1)[0].storeyId));

// ── WHICH BODY IS THE HOUSE ──────────────────────────────────────────────
const houseOn = (drawing, id) => {
  const outline = B.houseOutlineOn(drawing, id);
  return outline ? outline.id : null;
};

check('a storey with nothing on it has no house outline',
  houseOn({ levels: [{ id: 1 }], outlines: [] }, 1) === null,
  String(houseOn({ levels: [{ id: 1 }], outlines: [] }, 1)));
check('and a level the drawing does not have has none either',
  houseOn(storeys, 9) === null, String(houseOn(storeys, 9)));
check('a level whose id was saved as a string is still found',
  houseOn(storeys, 2) === 'u', String(houseOn(storeys, 2)));

// THE BIGGEST BODY IS THE HOUSE, NOT THE FIRST ONE FILED. `small` is filed
// first on purpose: pool[0] and the largest are the same outline on a house
// with one body, so a one-body fixture cannot tell a reduce from an index.
const twoHouses = {
  levels: [{ id: 1 }],
  outlines: [
    { id: 'small', levelId: 1, points: sq(0, 0, 12, 16) },
    { id: 'big', levelId: 1, points: sq(20, 0, 24, 20) },
  ],
};
check('the biggest body on the storey is the house, not the first one filed',
  houseOn(twoHouses, 1) === 'big', String(houseOn(twoHouses, 1)));

// A ROOM OVER THE GARAGE IS NOT THE HOUSE, EVEN AS THE BIGGER BODY. This is
// Movie's own defect from 25 Sep -- the flight to 2ND FL laid out inside the
// room over the garage -- and `room` is 720 sq ft against the house's 480 so
// that size alone gives the wrong answer.
const overGarage = {
  levels: [{ id: 1 }, { id: 2 }],
  outlines: [
    { id: 'garage', levelId: 1, garage: true, points: sq(0, 0, 24, 30) },
    { id: 'house', levelId: 2, points: sq(40, 0, 24, 20) },
    { id: 'room', levelId: 2, points: sq(0, 0, 24, 30) },
  ],
};
check('a bigger room sitting over the garage is still not the house',
  houseOn(overGarage, 2) === 'house', String(houseOn(overGarage, 2)));

// TOUCHING IS NOT SITTING ON. The house laps the garage by a 4 ft corner --
// 16 sq ft of 900 -- and `shed` is here so the answer can go WRONG: with
// nothing else on the storey a disqualified house still comes back through
// the fallback, and the row that drops the share to zero would survive.
const cornerTouch = {
  levels: [{ id: 1 }, { id: 2 }],
  outlines: [
    { id: 'garage', levelId: 1, garage: true, points: sq(0, 0, 24, 24) },
    { id: 'house', levelId: 2, points: sq(20, 20, 30, 30) },
    { id: 'shed', levelId: 2, points: sq(60, 60, 10, 10) },
  ],
};
check('a house lapping the garage at one corner is still the house',
  houseOn(cornerTouch, 2) === 'house', String(houseOn(cornerTouch, 2)));

// AND WHEN EVERY BODY IS OVER A GARAGE, ONE OF THEM IS STILL THE ANSWER.
// That file is a detached garage with a room on it, which Movie says DOES
// want a stair -- so the filter emptying the pool has to fall back rather
// than refuse.
const allOver = {
  levels: [{ id: 1 }, { id: 2 }],
  outlines: [
    { id: 'garage', levelId: 1, garage: true, points: sq(0, 0, 24, 30) },
    { id: 'room', levelId: 2, points: sq(0, 0, 24, 30) },
  ],
};
check('a detached garage with a room over it still names that room',
  houseOn(allOver, 2) === 'room', String(houseOn(allOver, 2)));

console.log(`building bodies harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
