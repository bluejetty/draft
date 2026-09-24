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

console.log(`building bodies harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
