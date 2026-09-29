#!/usr/bin/env node
// LEVEL LOCK — offline checks for level-lock.js (board #315).
//
// The lock's rules live in a module rather than the page because
// MODEL.dc.html exposes no handle to its component: a rule in there is
// reachable only through a gesture, and the gesture that moves a rigid
// assembly does not exist yet. So the rules are pinned here and the page
// keeps only the part that owns the real point objects.
//
//   node proto/level-lock-harness.js
//   node proto/level-lock-harness.js --mutate
//
// Exit 0 = every check passed.
//
// WHY IT TOOK A MUTATION MODE. Devin's audit, 28 Sep, found this file in a
// class of seven that ACCEPTED `--mutate`, ran the plain checks, printed no
// table and exited 0 -- so any count asking "does it take the flag?" scored
// them as covered. That is worse than the thirty-seven that refuse the flag
// outright, because a refusal is honest. The table below is the answer, and
// the argument parser now refuses anything it does not understand.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// THE FLAG IS THE SHARED GUARD'S, NOT A HAND-ROLLED COPY OF IT.
//
// The block here read argv itself. Two things followed. It refused
// `--coverage`, which proto/harness-args.js treats as the SAME mode spelled a
// second way, so one of the two documented spellings exited 2 on this file.
// And CI derives its engine list from the CALL FORM
// `require('./harness-args.js').mutationMode()` -- a harness that parses its
// own argv is invisible to that grep, so the table below would have run here
// and nowhere else. A mutation table CI never runs is the silence this whole
// piece of work is about, one level out.
const MUTATE = require('./harness-args.js').mutationMode();

const SOURCE = fs.readFileSync(path.join(ROOT, 'level-lock.js'), 'utf8');

// THE MODULE IS LOADED PER RUN, not once at the top: a mutation is an edit to
// its source, and a module frozen onto a shared sandbox could not be replaced.
const load = (edit) => {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, Set, Map, isFinite };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(edit ? edit(SOURCE) : SOURCE, sandbox, { filename: 'level-lock.js' });
  return win.DraftLevelLock;
};

let passed = 0;
let failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

function run(edit) {
passed = 0;
failures = [];
let L;
try { L = load(edit); } catch (err) { check('level-lock.js loads', false, err.message); return; }

check('level-lock.js defines DraftLevelLock', !!L, String(L));
if (!L) return;

// ── MAKING A LOCK ────────────────────────────────────────────────────────
const stack = L.makeLock('lock-1', 'WC STACK', ['g-main', 'g-second', 'g-base']);
check('a lock over three assemblies is made', !!stack && stack.members.length === 3,
  JSON.stringify(stack));
check('and its name is carried, upper-cased', stack.name === 'WC STACK', stack.name);

// A LOCK OF ONE IS NOT A LOCK, and this is the check that keeps the rule.
// Two members are the fewest that can disagree; a shorter one can never do
// anything, and on screen that is indistinguishable from one that works.
check('a lock of ONE member is refused', L.makeLock('lock-2', 'X', ['only']) === null,
  JSON.stringify(L.makeLock('lock-2', 'X', ['only'])));
check('and so is a lock of the same member twice',
  L.makeLock('lock-3', 'X', ['g1', 'g1']) === null,
  JSON.stringify(L.makeLock('lock-3', 'X', ['g1', 'g1'])));
check('a lock with no id is refused', L.makeLock('', 'X', ['g1', 'g2']) === null,
  JSON.stringify(L.makeLock('', 'X', ['g1', 'g2'])));

// ── FINDING IT ───────────────────────────────────────────────────────────
const locks = [stack];
check('a member finds its lock', L.lockFor(locks, 'g-second')?.id === 'lock-1',
  JSON.stringify(L.lockFor(locks, 'g-second')));
check('a stranger finds none', L.lockFor(locks, 'g-garage') === null,
  JSON.stringify(L.lockFor(locks, 'g-garage')));

// THE MOVER IS NOT ITS OWN SIBLING. The caller has already applied its own
// move, so including it would move it twice -- which reads on screen as an
// assembly sliding at double speed while the others keep up.
const sibs = L.siblingIds(locks, 'g-second');
check('siblings are the OTHER members, never the mover',
  sibs.length === 2 && !sibs.includes('g-second'), JSON.stringify(sibs));
check('a stranger has no siblings', L.siblingIds(locks, 'g-garage').length === 0,
  JSON.stringify(L.siblingIds(locks, 'g-garage')));

// ── EVERY POINT ONCE ─────────────────────────────────────────────────────
// The one that bites. A corner shared by two walls of the same assembly is
// ONE object in the vertex pool; walking items and moving their points would
// move it twice and tear the assembly apart at its own corners.
const corner = { x: 0, z: 0 };
const assembly = [
  { start: corner, end: { x: 10, z: 0 } },
  { start: corner, end: { x: 0, z: 10 } },
  { points: [corner, { x: 5, z: 5 }] },
];
const pts = L.uniquePoints(assembly);
check('a shared corner is collected ONCE, not once per item',
  pts.length === 4, `${pts.length} points from 6 slots across 3 items`);
check('and the shared corner really is shared in the fixture',
  assembly[0].start === assembly[1].start && assembly[0].start === assembly[2].points[0],
  'if this fails the check above proves nothing');

L.translate(pts, 3, -2);
check('the shared corner moved by the delta exactly once',
  corner.x === 3 && corner.z === -2, JSON.stringify(corner));
check('and so did an unshared point',
  assembly[0].end.x === 13 && assembly[0].end.z === -2, JSON.stringify(assembly[0].end));

// PLAN ONLY. y is the storey, and a lock spans storeys — touching it would
// drag one floor's assembly onto another's level.
const withY = [{ start: { x: 0, y: 9, z: 0 }, end: { x: 1, y: 9, z: 1 } }];
L.translate(L.uniquePoints(withY), 5, 5);
check('y is never touched — a lock moves in plan, not between storeys',
  withY[0].start.y === 9 && withY[0].end.y === 9,
  JSON.stringify([withY[0].start.y, withY[0].end.y]));

// A column-style item carries a single `point` rather than start/end.
const column = [{ point: { x: 1, z: 1 } }];
check('an item with a single point is collected too',
  L.uniquePoints(column).length === 1, JSON.stringify(L.uniquePoints(column)));

// ── BREAKING ─────────────────────────────────────────────────────────────
const after = L.breakLock(locks, 'lock-1');
check('breaking removes the lock outright', after.length === 0, JSON.stringify(after));
check('and the members are strangers afterwards',
  L.lockFor(after, 'g-second') === null && L.siblingIds(after, 'g-second').length === 0,
  JSON.stringify(L.lockFor(after, 'g-second')));
// AND IT IS NOT DESTRUCTIVE OF THE ORIGINAL. breakLock returns a new list;
// a caller that kept the old one must still see the old one, or an undo
// would restore a lock that had already been mutated away underneath it.
check('breaking does not mutate the list it was given',
  locks.length === 1 && locks[0].id === 'lock-1', JSON.stringify(locks));
check('breaking an id that is not there changes nothing',
  L.breakLock(locks, 'lock-nope').length === 1,
  JSON.stringify(L.breakLock(locks, 'lock-nope')));

// ── EMPTY AND MALFORMED INPUT ────────────────────────────────────────────
check('no locks at all is not an error',
  L.lockFor([], 'g1') === null && L.siblingIds([], 'g1').length === 0
  && L.uniquePoints([]).length === 0 && L.translate([], 1, 1) === 0, 'empty inputs');
check('a malformed lock does not throw',
  L.lockFor([null, {}, { members: null }], 'g1') === null, 'malformed locks');
}

if (!MUTATE) {
  run(null);
  console.log(`level lock harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
//
// Each edits level-lock.js in memory and asserts the checks above go red. A
// check that survives its own mutation is not a check. Every one of these is
// a way the lock could be wrong while still looking like a working feature:
// it still makes locks, still finds them, still moves something.
const MUTATIONS = [
  // The one the module was written to prevent. A Set is identity-based; an
  // array is not, so the shared corner is collected twice and moved twice.
  ['a shared corner is collected once per item, not once', 'level-lock.js',
    c => c.replace('const points = new Set();', 'const points = [];')
      .replace('.forEach(p => points.add(p));', '.forEach(p => points.push(p));')
      .replace('if (item.point) points.add(item.point);', 'if (item.point) points.push(item.point);')],

  // A lock of one is indistinguishable on screen from a lock that works.
  ['a lock of ONE member is allowed', 'level-lock.js',
    c => c.replace('if (!id || members.length < 2) return null;', 'if (!id) return null;')],

  // The de-duplication at creation: the same member named twice makes a
  // two-member lock that is really a lock of one.
  ['the same member twice counts as two members', 'level-lock.js',
    c => c.replace('const members = [...new Set((groupIds || []).filter(Boolean))];',
      'const members = (groupIds || []).filter(Boolean);')],

  // The mover owns its own move already; including it moves it twice.
  ['the mover is returned among its own siblings', 'level-lock.js',
    c => c.replace('return lock ? lock.members.filter(id => id !== groupId) : [];',
      'return lock ? lock.members.slice() : [];')],

  // y is the storey. Touching it drags one floor's assembly onto another's.
  ['translate moves the storey as well as the plan', 'level-lock.js',
    c => c.replace('{ point.x += dx; point.z += dz; }',
      '{ point.x += dx; point.z += dz; point.y = (point.y || 0) + dz; }')],

  // breakLock returns a new list; splicing the caller's would make an undo
  // restore a lock that had already been removed underneath it.
  ['breaking mutates the list it was given', 'level-lock.js',
    c => c.replace('const breakLock = (locks, lockId) => (locks || []).filter(lock => lock?.id !== lockId);',
      'const breakLock = (locks, lockId) => { const i = (locks || []).findIndex(l => l?.id === lockId);'
      + ' if (i >= 0) locks.splice(i, 1); return locks || []; };')],

  // An id is what a lock is found by; a lock without one can never be broken.
  ['a lock with no id is made anyway', 'level-lock.js',
    c => c.replace('if (!id || members.length < 2) return null;', 'if (members.length < 2) return null;')],

  // A single-point item (a column) carries `point`, not start/end.
  ['an item carrying a single point is skipped', 'level-lock.js',
    c => c.replace('if (item.point) points.add(item.point);', '')],
];

let caught = 0;
for (const [name, , edit] of MUTATIONS) {
  const before = SOURCE;
  if (edit(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing -- re-aim it)`);
    continue;
  }
  run(edit);
  if (failures.length) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`level-lock-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
