#!/usr/bin/env node
// GARAGE SIZES — offline checks for build-menu.js's fourth question.
//
// Movie, 15 Sep: "allow them to enter the size give them choices 16x24
// 24x26 25x25 (or 4th option allow them to enter ___FT X ___FT)". The
// three stock sizes are data; the fourth is a typed pair, and a typed pair
// is the one a drafter can get wrong -- so the checking of it lives in the
// module with the sizes rather than in the page's field handler, where
// PROJECT and the layout sheet could not reach it.
//
//   node proto/garage-size-harness.js
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
vm.runInContext(fs.readFileSync(path.join(ROOT, 'build-menu.js'), 'utf8'),
  sandbox, { filename: 'build-menu.js' });

const BM = win.DraftBuildMenu;
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// ── THE THREE MOVIE NAMED, in his order ──────────────────────────────────
check('the three stock sizes are his three, in his order',
  BM.GARAGE_SIZES.map(size => size.id).join(' ') === '16x24 24x26 25x25',
  JSON.stringify(BM.GARAGE_SIZES.map(size => size.id)));
// WIDTH IS ACROSS THE DOOR WALL. 16x24 and 24x16 are different buildings
// and the label cannot say which is which, so the numbers are pinned.
check('16x24 is 16 across the door wall by 24 back',
  BM.garageSizeById('16x24').widthFt === 16
  && BM.garageSizeById('16x24').depthFt === 24,
  JSON.stringify(BM.garageSizeById('16x24')));
check('every stock size carries both figures and a label',
  BM.GARAGE_SIZES.every(size => size.widthFt > 0 && size.depthFt > 0
    && typeof size.label === 'string' && size.label.length > 0),
  JSON.stringify(BM.GARAGE_SIZES));
check('a size nobody offers is not invented',
  BM.garageSizeById('30x40') === null, String(BM.garageSizeById('30x40')));

// ── THE FOURTH, WHICH IS TYPED ───────────────────────────────────────────
const typed = BM.customGarageSize(18, 22);
check('a typed pair comes back in the same shape as a stock one',
  typed.widthFt === 18 && typed.depthFt === 22 && typed.custom === true,
  JSON.stringify(typed));
// THE SAME SHAPE IS THE POINT: whoever builds the box must never have to
// ask which of the four the drafter pressed.
check('and it names itself the way the stock ones do',
  typed.label === "18' x 22'", typed.label);
check('the fields arrive as strings and are still read as figures',
  BM.customGarageSize('16', '24')?.widthFt === 16,
  JSON.stringify(BM.customGarageSize('16', '24')));

// ── WHAT IS NOT A SIZE ───────────────────────────────────────────────────
// A BLANK FIELD IS NOT A ZERO. Number('') is 0, which would pass any
// "is it a number" test and build a garage with no width at all.
check('an empty field is refused, not read as nought',
  BM.customGarageSize('', '24') === null,
  JSON.stringify(BM.customGarageSize('', '24')));
check('one figure on its own is not a size',
  BM.customGarageSize(20, null) === null,
  JSON.stringify(BM.customGarageSize(20, null)));
check('words are refused',
  BM.customGarageSize('big', 'wide') === null, 'words');
check('a slipped finger under the minimum is refused',
  BM.customGarageSize(BM.GARAGE_SIZE_MIN_FT - 1, 24) === null,
  JSON.stringify(BM.customGarageSize(BM.GARAGE_SIZE_MIN_FT - 1, 24)));
check('and a shop-sized one over the maximum',
  BM.customGarageSize(24, BM.GARAGE_SIZE_MAX_FT + 1) === null,
  JSON.stringify(BM.customGarageSize(24, BM.GARAGE_SIZE_MAX_FT + 1)));
// THE BOUNDS THEMSELVES ARE INSIDE, or the smallest garage the drafter is
// told he may have would be refused when he typed it.
check('the bounds are inclusive at both ends',
  !!BM.customGarageSize(BM.GARAGE_SIZE_MIN_FT, BM.GARAGE_SIZE_MAX_FT),
  JSON.stringify(BM.customGarageSize(BM.GARAGE_SIZE_MIN_FT, BM.GARAGE_SIZE_MAX_FT)));

// ── WHO ASKS THE QUESTION ────────────────────────────────────────────────
// A HOUSE'S SIZE ARRIVES WITH ITS PREMADE DESIGN; a garage is a box, so
// its size IS the design. Only the detached entries carry the flag, and
// the page hangs the whole size row off it.
const detached = BM.familyById('detachedGarage').entries;
check('every detached garage entry asks how big',
  detached.every(entry => entry.needsSize === true),
  JSON.stringify(detached.map(entry => entry.needsSize)));
check('and no house entry does',
  BM.BUILD_MENU.filter(family => family.id !== 'detachedGarage')
    .flatMap(family => family.entries)
    .every(entry => entry.needsSize === undefined),
  'a house entry asked for a size');

console.log(`garage size harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  \u2718 ${line}`));
  process.exit(1);
}
