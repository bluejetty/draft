#!/usr/bin/env node
// BUILDING BODIES — offline checks for building-bodies.js.
//
// The cap is Movie's: "only 1 house and 1 detached garage maximum". The
// question this module answers -- what does this drawing already hold --
// decides whether MODEL's bone has anything left to offer, so the answers
// are pinned here rather than only through a page that has to be driven.
//
//   node proto/building-bodies-harness.js
//
// Exit 0 = every check passed.
require('./harness-args.js').noFlags();

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const win = {};
const sandbox = { window: win, console, Object, Array, String, Number, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'building-bodies.js'), 'utf8'),
  sandbox, { filename: 'building-bodies.js' });

const B = win.DraftBuildingBodies;
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
const detached = { id: 'o4', levelId: 1, garage: true, detached: true };
const stamped = { id: 'o5', levelId: 1, garage: true, masterId: 'm1' };
const master = { id: 'm1', shelfId: 7, garage: true, detached: true };

// ── AN EMPTY DRAWING ─────────────────────────────────────────────────────
check('an empty drawing holds neither body',
  !B.hasHouse({}) && !B.hasDetachedGarage({}), JSON.stringify(B.missing({})));
check('and both are still on offer',
  JSON.stringify(B.missing({})) === '["house","detachedGarage"]',
  JSON.stringify(B.missing({})));
check('nothing at all does not throw',
  !B.hasHouse(null) && !B.isFull(undefined), 'null drawing');

// ── THE HOUSE ────────────────────────────────────────────────────────────
check('an outline with no garage flag is a house',
  B.hasHouse({ outlines: [house] }), 'house');
// A TWO STOREY HOUSE IS ONE BODY WITH AN OUTLINE PER STOREY. The question is
// "is there a house", never "how many outlines" -- counting would call a
// second storey a second house and refuse the garage the drafter still needs.
check('a second storey is the same house, not a second one',
  B.hasHouse({ outlines: [house, upper] })
  && JSON.stringify(B.missing({ outlines: [house, upper] })) === '["detachedGarage"]',
  JSON.stringify(B.missing({ outlines: [house, upper] })));

// ── THE GARAGES ──────────────────────────────────────────────────────────
// THE ONE THAT BITES. An attached garage is part of the house it hangs off,
// so it must NOT spend the detached garage's slot -- a drafter with a double
// attached garage is still owed his detached one.
check('an attached garage is not a detached one',
  !B.hasDetachedGarage({ outlines: [house, attached] })
  && B.hasAttachedGarage({ outlines: [house, attached] }),
  JSON.stringify(B.missing({ outlines: [house, attached] })));
check('and it does not spend the detached slot',
  JSON.stringify(B.missing({ outlines: [house, attached] })) === '["detachedGarage"]',
  JSON.stringify(B.missing({ outlines: [house, attached] })));
check('a garage that says detached is one',
  B.hasDetachedGarage({ outlines: [detached] }), 'detached');
// STAMPED FROM THE SHELF, the outline carries the master's id and not its
// properties -- reading only the outline would call a stamped detached
// garage attached, and offer the drafter a second one.
check('a garage stamped from a detached master is detached',
  B.hasDetachedGarage({ outlines: [stamped], boneyardOutlines: [master] }),
  'stamped');
check('and without its master it is not guessed at',
  !B.hasDetachedGarage({ outlines: [stamped] }), 'orphan stamp');
check('a garage is never counted as the house',
  !B.hasHouse({ outlines: [detached] }), 'garage only');

// ── FULL ─────────────────────────────────────────────────────────────────
const project = { outlines: [house, upper, attached, detached] };
check('a house and a detached garage fill the project',
  B.isFull(project) && B.missing(project).length === 0,
  JSON.stringify(B.missing(project)));
check('a garage on its own leaves the house owed',
  JSON.stringify(B.missing({ outlines: [detached] })) === '["house"]',
  JSON.stringify(B.missing({ outlines: [detached] })));

console.log(`building bodies harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  \u2718 ${line}`));
  process.exit(1);
}
