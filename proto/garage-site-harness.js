#!/usr/bin/env node
// GARAGE SITE — offline checks for where an autobuilt garage stands.
//
// Movie, 15 Sep: "now i need the garage to be AUTOBUILT ... it should make
// a rectangle outline of that size and then build it with the project
// data". A traced garage says where it goes by being traced; an ordered
// one does not, so the page has to answer that itself -- and the answer is
// a rule about buildings, not about this page.
//
//   node proto/garage-site-harness.js
//
// Exit 0 = every check passed.
require('./harness-args.js').noFlags();

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const win = {};
const sandbox = { window: win, console, Object, Array, String, Number, JSON, Math };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'garage-site.js'), 'utf8'),
  sandbox, { filename: 'garage-site.js' });

const GS = win.DraftGarageSite;
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

const box = points => ({
  minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
  minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)),
});
const size = (widthFt, depthFt) => ({ widthFt, depthFt });
// A 20x30 house, front wall on z = 0, standing on level 1.
const HOUSE = {
  outlines: [{
    id: 'outline-1', levelId: 1, points: [
      { x: -10, z: -30 }, { x: 10, z: -30 }, { x: 10, z: 0 }, { x: -10, z: 0 },
    ],
  }],
  walls: [],
};

// ── THE BOX IS THE SIZE ORDERED, THE WAY ROUND IT WAS ORDERED ────────────
// Width across the door wall, depth back from it. A 16x24 laid out as a
// 24x16 is a different building and the label cannot tell you which.
const empty = GS.plotFor({}, 1, size(16, 24));
check('an ordered 16x24 is 16 across and 24 back',
  Math.abs(box(empty).maxX - box(empty).minX - 16) < 1e-9
  && Math.abs(box(empty).maxZ - box(empty).minZ - 24) < 1e-9,
  JSON.stringify(box(empty)));
check('the loop is four corners, not a closed five',
  empty.length === 4, `${empty.length} points`);

// ── AN EMPTY SHEET HAS NO HOUSE TO STAND BESIDE ──────────────────────────
// So the garage takes the middle rather than sitting 10ft east of nothing,
// which would put the first thing a drafter ever builds off to one side of
// a sheet that fits to it.
check('on an empty level the garage is centred across the sheet',
  Math.abs(box(empty).minX + box(empty).maxX) < 1e-9,
  JSON.stringify(box(empty)));

// ── BESIDE THE HOUSE, NEVER THROUGH IT ───────────────────────────────────
const beside = GS.plotFor(HOUSE, 1, size(24, 26));
check('the garage stands a yard-gap east of the house',
  Math.abs(box(beside).minX - (10 + GS.SETBACK_FT)) < 1e-9,
  JSON.stringify(box(beside)));
check('and nothing of it overlaps the house footprint',
  box(beside).minX > 10, JSON.stringify(box(beside)));
// THE DOOR WALL LINES UP WITH THE HOUSE FRONT. Two buildings whose fronts
// disagree by a foot read as a mistake in every elevation off them.
check('its door wall sits on the house front line',
  Math.abs(box(beside).maxZ - 0) < 1e-9, JSON.stringify(box(beside)));

// ── WALLS COUNT, NOT ONLY OUTLINES ───────────────────────────────────────
// A DRAFTING drawing carries no bone at all (the outline is written on the
// TOY board only), so reading outlines alone would place the garage
// through the middle of a hand-drawn house and report success.
const drafted = {
  outlines: [],
  walls: [{ levelId: 1, start: { x: -10, z: -30 }, end: { x: 14, z: 0 } }],
};
check('a hand-drawn house with no bone is still something to stand beside',
  GS.plotFor(drafted, 1, size(16, 24))[0].x > 14,
  JSON.stringify(GS.plotFor(drafted, 1, size(16, 24))));

// ── ANOTHER LEVEL IS NOT THIS LEVEL ──────────────────────────────────────
// A garage on the foundation level is not crowded by the second storey; it
// is crowded by what is on its own floor.
check('a body on another level does not move the garage',
  GS.plotFor(HOUSE, 2, size(16, 24))[0].x === GS.plotFor({}, 2, size(16, 24))[0].x,
  JSON.stringify(GS.plotFor(HOUSE, 2, size(16, 24))));

// ── A SIZELESS ORDER IS NOT A PLOT ───────────────────────────────────────
// The bone already refuses one out loud; this refuses to invent geometry
// for it, so a second caller cannot quietly build a zero-width box.
check('no size, no plot', GS.plot(null, null) === null);
check('a zero width is not a size', GS.plot(size(0, 24), null) === null);
check('nor is a blank field read as a number',
  GS.plot(size('', 24), null) === null);

// ── WHAT COUNTS AS STANDING ──────────────────────────────────────────────
check('an empty level reports nothing standing',
  GS.occupied({ outlines: [], walls: [] }, 1) === null);
check('the house box is measured from its own corners',
  JSON.stringify(GS.occupied(HOUSE, 1))
    === JSON.stringify({ minX: -10, maxX: 10, minZ: -30, maxZ: 0 }),
  JSON.stringify(GS.occupied(HOUSE, 1)));

console.log(`garage site harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  \u2718 ${line}`));
  process.exit(1);
}
