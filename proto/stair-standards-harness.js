#!/usr/bin/env node
// THE OFFICE'S STAIR NUMBERS, OFFLINE (Movie, 25 Oct: "is stair limitations
// set up in STANDARDS, we should allow that to change too in STANDARDS").
// stair-geometry.js keeps the defaults -- MAX RISER 7 7/8", MIN RISER 6",
// TREAD RUN 10", MIN WIDTH 36", MIN HEADROOM 6'-10" -- clamps what a
// package hands it, and lays every stair out by what it was handed.
//
// Run: node proto/stair-standards-harness.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
require('./harness-args.js').noFlags();

const ROOT = path.join(__dirname, '..');
const load = (active) => {
  const ctx = { window: active ? { DraftProfileManager: { getActive: () => ({ content: { model: { stairStandards: active } } }) } } : {}, Math, Number, Object };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'stair-geometry.js'), 'utf8'), ctx, { filename: 'stair-geometry.js' });
  return ctx.window.DraftStairGeometry;
};
let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed += 1; else { failed += 1; console.log(`  FAIL  ${what}`); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;

// THE DEFAULTS, with no package at all.
let SG = load(null);
const d = SG.stairStandards();
check(d.maxRiserIn === 7.875 && d.minRiserIn === 6 && d.treadRunIn === 10 && d.minWidthIn === 36 && d.headroomIn === 82,
  'no package: 7 7/8", 6", 10", 36", 6\'-10"');
check(SG.STAIR_MAX_RISER_IN === 7.875 && SG.STAIR_TREAD_RUN_IN === 10 && SG.STAIR_MIN_WIDTH_IN === 36, 'the exported numbers are the defaults');
check(SG.stairLayout(9.5).risers === 15, 'a 9\'-6" rise: 15 risers under 7 7/8"');
// CLAMPED, AND THE LEAST NEVER ABOVE THE MOST.
const n = SG.normaliseStairStandards({ maxRiserIn: 30, minRiserIn: 20, treadRunIn: 'x', minWidthIn: 10, headroomIn: -1 });
check(n.maxRiserIn === 12, 'a 30" riser comes down to 12"');
check(n.minRiserIn === 12, 'the least comes down to the most');
check(n.treadRunIn === 10 && n.headroomIn === 82, 'nonsense keeps the default');
check(n.minWidthIn === 24, 'a 10" stair comes up to 24"');
// FROM THE PACKAGE: the office's numbers lay the stair out.
SG = load({ maxRiserIn: 7.5, minRiserIn: 6.5, treadRunIn: 11, minWidthIn: 40 });
check(SG.STAIR_MAX_RISER_IN === 7.5 && SG.STAIR_TREAD_RUN_IN === 11 && SG.STAIR_MIN_WIDTH_IN === 40, 'the package\'s numbers are read');
const lay = SG.stairLayout(9.5);
check(lay.risers === Math.ceil(114 / 7.5), 'the risers by its 7 1/2" most');
check(near(lay.runFt, (lay.risers - 1) * 11 / 12), 'the run by its 11" tread');
const range = SG.stairRiserRange(9.5);
check(range.most === Math.floor(114 / 6.5), 'the most risers by its 6 1/2" least');
// HANDED ITS OWN: useStairStandards wins over the package.
SG.useStairStandards({ maxRiserIn: 8 });
check(SG.STAIR_MAX_RISER_IN === 8 && SG.STAIR_TREAD_RUN_IN === 10, 'useStairStandards replaces the whole set');

console.log(`stair standards: ${passed} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
