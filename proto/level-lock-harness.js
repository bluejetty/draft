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
//
// Exit 0 = every check passed.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const win = {};
const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, Set, Map, isFinite };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'level-lock.js'), 'utf8'), sandbox, { filename: 'level-lock.js' });

const L = win.DraftLevelLock;
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

check('level-lock.js defines DraftLevelLock', !!L, String(L));
if (!L) { console.log('level lock harness: 0 passed, 1 failed'); process.exit(1); }

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

console.log(`level lock harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
