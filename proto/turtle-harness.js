#!/usr/bin/env node
// THE TURTLE — the offline harness (turtle path step 3).
//
//   node proto/turtle-harness.js
//
// Exit code 0 = every check passed.
//
// ── THE TWO CLAIMS THIS FILE EXISTS TO PROTECT ──────────────────────────
//
//   1. TWO VERBS. Turn 90°, and go a whole number of feet. Nothing else.
//   2. THE USER TYPES 12 AND THE ROOM MEASURES 12.
//
// The second is why the first is shaped as it is. If the turtle walked the
// CENTRELINE, someone would type 12 and the finished room would measure
// 11'-6½" -- every dimension on the drawing contradicting the number they
// entered, which is exactly the confusion a toy exists to prevent. So the
// turtle walks the inside face and thickness goes outward, and the check that
// proves it asks the constraint module rather than restating the arithmetic.

const MUTATE = require('./harness-args.js').mutationMode();

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── MUTATIONS (1 Oct) ─────────────────────────────────────────────────────
// Against the checks this file had, SEVEN OF TEN were caught -- measured.
// Every walk here started at the origin facing east, and every heading was in
// range, so walk()'s two options and turn()'s fold were never exercised. The
// checks under "WHERE IT STARTS AND WHICH WAY" are what those three asked for.
const MUTATIONS = [
  ['left and right are the same turn, and every house is mirrored', 'turtle.js',
    c => c.replace('if (which === TURN.LEFT) return (at + 3) % 4;', 'if (which === TURN.LEFT) return (at + 1) % 4;')],
  ['a typed 12.6 is cut to 12, not rounded to 13', 'turtle.js',
    c => c.replace('return Math.round(asked / step) * step;', 'return Math.floor(asked / step) * step;')],
  ['a string is read as a distance', 'turtle.js',
    c => c.replace("const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);",
      'const num = value => (Number.isFinite(Number(value)) && value != null ? Number(value) : null);')],
  ['a turn on the spot draws a zero-length wall', 'turtle.js',
    c => c.replace('      if (next.ranFt === 0) return;   // a turn on the spot draws nothing\n', '')],
  ['a walk a foot short is nudged shut', 'turtle.js',
    c => c.replace('const closes = (path, tolFt = 1e-9) => {', 'const closes = (path, tolFt = 1.5) => {')],
  ['the inside is read off the wrong side of the walk', 'turtle.js',
    c => c.replace('    return doubled < 0;', '    return doubled > 0;')],
  ['the turtle draws in 2x4, so the room measures the wrong 12', 'turtle.js',
    c => c.replace("const wallsFrom = (path, { wallType = 'stud_2x6' } = {}) => {",
      "const wallsFrom = (path, { wallType = 'stud_2x4' } = {}) => {")],
  ['a walk always starts at the origin, wherever it was asked to', 'turtle.js',
    c => c.replace('let at = { x: (startAt && num(startAt.x)) ?? 0, z: (startAt && num(startAt.z)) ?? 0 };',
      'let at = { x: 0, z: 0 };')],
  ['a walk always sets off east, whichever way it was facing', 'turtle.js',
    c => c.replace('    let facing = num(heading) ?? 0;', '    let facing = 0;')],
  ['a heading below zero is not folded back into the four', 'turtle.js',
    c => c.replace('    const at = ((num(heading) ?? 0) % 4 + 4) % 4;', '    const at = (num(heading) ?? 0) % 4;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('turtle',
    MUTATIONS, { root: ROOT, harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}
global.window = {};
['wall-types.js', 'room-standards.js', 'geometry-2d.js', 'toy-constraints.js', 'turtle.js']
  .forEach(file => { (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8')); });
const T = window.DraftTurtle;
const C = window.DraftToyConstraints;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const facing = h => T.HEADINGS[h].name;

// A room walked as a closed loop: straight on for the first leg, then three
// turns the same way. This is how a person actually draws a box.
const box = (w, d, which = 'right') => T.walk([
  { turn: 'straight', goFt: w },
  { turn: which, goFt: d },
  { turn: which, goFt: w },
  { turn: which, goFt: d },
]);

// ── 1 · TURN, and only four places it can point ──────────────────────────
{
  // +z is DOWN on screen, so left from east is NORTH. Backwards here mirrors
  // every house the turtle ever draws, and mirrors it silently.
  check('left from east faces north', facing(T.turn(0, 'left')) === 'N');
  check('right from east faces south', facing(T.turn(0, 'right')) === 'S');
  check('straight on stays put', facing(T.turn(0, 'straight')) === 'E');
  check('four lefts come home', facing([0, 0, 0, 0].reduce(h => T.turn(h, 'left'), 0)) === 'E');
  check('four rights come home', facing([0, 0, 0, 0].reduce(h => T.turn(h, 'right'), 0)) === 'E');

  // THERE IS NO THIRD VERB, and no fifth heading for one to reach. Anything
  // that is not a left or a right is straight on -- so a stray word cannot
  // steer the turtle somewhere it was never able to go.
  check('an unknown turn is straight on, not a new direction',
    facing(T.turn(0, 'sharp-left')) === 'E' && facing(T.turn(0, undefined)) === 'E');
  check('and there are only ever four headings', T.HEADINGS.length === 4);
}

// ── 2 · GO, in whole feet, quantised on the way IN ───────────────────────
// The rounding rule is the spine of the mode: everything adjustable is to the
// nearest foot. Rounding on the way in is what stops the drawing disagreeing
// with the number the user typed.
{
  check('12.4 feet is twelve feet', near(T.quantise(12.4), 12));
  check('12.6 feet is thirteen', near(T.quantise(12.6), 13));
  check('nothing typed is no distance', T.quantise(undefined) === 0 && T.quantise('12') === 0);
  // Half-feet come before inches EVER do, and only when asked for.
  check('a half foot is available but not the default',
    near(T.quantise(12.5), 13) && near(T.quantise(12.5, { fine: true }), 12.5));
  // A walk cannot produce a fraction of an inch, whatever it is handed.
  const messy = T.walk([{ turn: 'straight', goFt: 11.7 }, { turn: 'right', goFt: 8.2 }]);
  check('so no leg is ever a fraction of a foot',
    messy.legs.every(leg => Number.isInteger(leg.runFt)),
    JSON.stringify(messy.legs.map(l => l.runFt)));
  // A turn with nowhere to go draws nothing rather than a zero-length wall.
  check('turning on the spot draws no wall',
    T.walk([{ turn: 'right', goFt: 0 }]).legs.length === 0);
}

// ── 3 · ORTHOGONAL BY CONSTRUCTION ───────────────────────────────────────
// Not a rule that runs afterwards -- there is no way to EXPRESS a non-square
// wall with these two verbs. That is what makes TOY output TOY-editable by
// definition, so the constraint module never has to call the turtle's own work
// inert. Checked by asking that module, not by re-deriving what square means.
{
  const wander = T.walk([
    { turn: 'straight', goFt: 9 }, { turn: 'left', goFt: 4 }, { turn: 'left', goFt: 3 },
    { turn: 'right', goFt: 7 }, { turn: 'right', goFt: 12 }, { turn: 'straight', goFt: 5 },
  ]);
  const walls = T.wallsFrom(wander);
  check('every wall a wandering turtle draws is square',
    walls.length > 0 && walls.every(wall => C.isOrthogonal(wall)),
    JSON.stringify(walls.map(w => `${w.start.x},${w.start.z}->${w.end.x},${w.end.z}`)));
  // And therefore none of it is inert to the toy: everything it drew can be
  // grabbed by a grip tab afterwards.
  check('so none of it is inert when the toy reads it back',
    walls.every(wall => C.allowedMove(wall, 1, { walls }).reason !== C.REASON.NOT_ORTHOGONAL));
}

// ── 4 · THE WALK CLOSES, OR IT DOES NOT ──────────────────────────────────
// A house outline has to close. The turtle either came home or it did not --
// it is never nudged shut, because a wall quietly moved to close a loop is the
// same lie as a wall quietly snapped to a foot.
{
  check('a box closes', T.closes(box(12, 14)));
  check('and a walk that stops short does not, rather than being nudged',
    !T.closes(T.walk([
      { turn: 'straight', goFt: 12 }, { turn: 'right', goFt: 14 },
      { turn: 'right', goFt: 12 }, { turn: 'right', goFt: 13 },
    ])));
  const sq = box(12, 14);
  check('the box is the size that was asked for',
    sq.legs.map(leg => leg.runFt).join(',') === '12,14,12,14',
    JSON.stringify(sq.legs.map(l => l.runFt)));
  check('and it is walked as four square legs',
    sq.legs.map(leg => facing(leg.heading)).join('') === 'ESWN');
}

// ── 5 · WHICH SIDE THE INSIDE IS ON, READ OFF THE WALK ───────────────────
// The user turns whichever way feels natural. The module works out where the
// inside ended up rather than demanding a direction, so a left-handed walk and
// a right-handed one both get their faces right.
{
  const clockwise = box(12, 14, 'right');
  const widdershins = box(12, 14, 'left');
  check('turning right walks with the inside on the right',
    !T.insideIsLeft(clockwise) && T.wallsFrom(clockwise)[0].refLine === 'right');
  check('turning left walks with the inside on the left',
    T.insideIsLeft(widdershins) && T.wallsFrom(widdershins)[0].refLine === 'left');
  check('and every wall of a walk agrees about which side that is',
    new Set(T.wallsFrom(clockwise).map(w => w.refLine)).size === 1);
}

// ── 6 · THE CLAIM: THE USER TYPES 12 AND THE ROOM MEASURES 12 ────────────
// The whole reason the turtle walks a face. Proved by asking the constraint
// module what the two stored lines mean face to face -- if the turtle had
// walked the centreline instead, the same 12 would come back as 11'-6½" and
// every dimension on the sheet would contradict the number that was typed.
{
  const room = box(12, 14, 'right');
  const walls = T.wallsFrom(room);
  const north = walls[0];   // runs east along the top
  const south = walls[2];   // runs west along the bottom
  // Their stored lines are 14 apart; the room lies to the RIGHT of each, which
  // is the side `refLine: 'right'` names.
  const clear = C.clearFromLineGap(14, north, -1, south, -1);
  check('the 14 the user typed is 14 feet CLEAR, not 14 on the centreline',
    near(clear, 14), `${clear}`);

  // The same walls read as if the turtle had walked the centreline: the gap
  // the user would actually have got, and the bug this design prevents.
  const centred = walls.map(wall => ({ ...wall, refLine: 'center' }));
  const wrong = C.clearFromLineGap(14, centred[0], -1, centred[2], -1);
  check('where a centreline walk would have handed back 13\'-6½"',
    wrong < 14 && near(wrong, 14 - C.thicknessFt(north)),
    `${wrong}`);
  // And the thickness is the material's, untouched by any of the rounding.
  check('while the wall keeps its real 5 1/2" thickness',
    near(C.thicknessFt(north) * 12, 5.5, 1e-6), `${C.thicknessFt(north) * 12}"`);
}

// ── 7 · WHERE IT STARTS AND WHICH WAY (1 Oct) ─────────────────────────────
// A second room is walked from the corner of the first, not from the origin,
// and a turtle can be set off facing any of the four ways.
{
  const from = T.walk([{ turn: 'straight', goFt: 4 }], { startAt: { x: 5, z: 3 } });
  check('a walk starts where it is put down',
    from.points[0].x === 5 && from.points[0].z === 3 && from.at.x === 9 && from.at.z === 3,
    JSON.stringify(from.points));
  const north = T.walk([{ turn: 'straight', goFt: 4 }], { heading: 3 });
  check('and sets off the way it is facing',
    north.at.x === 0 && north.at.z === -4 && facing(north.legs[0].heading) === 'N',
    JSON.stringify(north.at));
  // One left from east is heading -1 to anything that counts backwards; it
  // must still be one of the four, not an index the table has not got.
  check('a heading below zero folds back into the four',
    facing(T.turn(-1, 'straight')) === 'N' && facing(T.turn(-1, 'right')) === 'E');
}

// ── Report ───────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n  ${failures.length} FAILED, ${passed} passed\n`);
  failures.forEach(name => console.error(`   ✘ ${name}`));
  console.error('');
  process.exit(1);
}
console.log(`\n  ${passed} checks passed\n`);
