#!/usr/bin/env node
// THE SPLIT'S HALF-LEVELS STAND WHERE PROJECT PUTS THEM.
//
// Movie, 2 Oct, on the premade BILEVEL: "use the 'PROJECT' information for
// bilevel to determine floor heights and thicknesses" and "the BILEVEL needs
// a entry floor sitting on the foundation wall". cut-view.js sectionLevelStack
// is the one table every elevation and section on every page stands its
// floors on; before this, it stacked ENTRY a whole storey under MAIN FL.
//
// The numbers below are PROJECT's own defaults (level-assembly.js
// SPLIT_DEFAULTS, held equal to project-page.js SPLIT_BASE by
// section-table-harness.js) worked by hand:
//
//   MAIN FL package   11 7/8" + 3/4"         = 1.0521'
//   wood fill         46 1/4" + 4 1/2"       = 4.2292'
//   ENTRY package     9 1/4" + 3/4"          = 0.8333'
//   ENTRY sill        -1.0521 - 4.2292       = -5.2813
//   ENTRY deck        -5.2813 + 0.8333       = -4.4479   (4'-5 3/8" under MAIN)
//   pour bottom       -5.2813 - 1/8 - 5      = -10.4063
//   OVER GARAGE deck  -4.4479 + 9            = 4.5521    (MOD BILEVEL only)
//
// Run: node proto/split-stack-harness.js [--mutate]
const path = require('path');
const H = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');
const MUTATE = process.argv.includes('--mutate');

const MUTATIONS = [
  ['the split is ignored and ENTRY stacks a storey under MAIN again', 'cut-view.js',
    c => c.replace('const splitStack = splitFloorStack(env, floors);', 'const splitStack = null;')],
  ['ENTRY stands on MAIN\'s package instead of the wood fill', 'cut-view.js',
    c => c.replace('const entrySill = -mainPkgFt - split.woodFillHeightFt;',
      'const entrySill = -mainPkgFt - split.woodFillHeightFt + pkgFt(2);')],
  ['the pour is the house\'s 8\' instead of PROJECT\'s 5\'', 'cut-view.js',
    c => c.replace('- (split ? split.fdnWallHeightFt : env.levelWallTopFt(1, \'foundation\'));',
      '- env.levelWallTopFt(1, \'foundation\');')],
  ['the foundation bears under the first level in the list, not the lowest deck', 'cut-view.js',
    c => c.replace('const lowest = stack.reduce((low, level) => (level.floorBottom < low.floorBottom ? level : low), stack[0]);',
      'const lowest = stack[1] || stack[0];')],
  ['OVER GARAGE climbs from MAIN rather than from ENTRY', 'cut-view.js',
    c => c.replace('const deck = place[2].floorTop + split.upperDeckAboveEntryFt;',
      'const deck = place[3].wallTop + pkgFt(4);')],
  ['a typed WOOD FILL is ignored', 'level-assembly.js',
    c => c.replace('if (row?.[key] != null && Number.isFinite(value) && value > 0) out[key] = value;\n    });\n    [',
      'void value;\n    });\n    [')],
  ['a plain BILEVEL gets the storey over the garage', 'level-assembly.js',
    c => c.replace("out.upper = buildType === 'modifiedBilevel';", 'out.upper = true;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('split-stack-harness',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const CV = win.DraftCutView;
const LEVELS = [
  { id: 8, name: 'SITE' }, { id: 7, name: 'ROOF' }, { id: 5, name: '2ND FL' },
  { id: 4, name: 'OVER GARAGE' }, { id: 3, name: 'MAIN FL' }, { id: 2, name: 'ENTRY' },
  { id: 1, name: 'FOUNDATION' },
];
const wall = (levelId, id) => ({ id, levelId, start: { x: 0, z: 0 }, end: { x: 10, z: 0 } });
const stackOf = (buildType, extra = {}) => CV.sectionLevelStack(H.buildEnv(win, {
  buildType, levels: LEVELS, walls: [wall(2, 'e'), wall(3, 'm'), wall(4, 'g')], ...extra,
}));
const floor = (stack, id) => stack.floors.find(level => Number(level.id) === id);

let failed = 0;
const near = (label, got, want, eps = 1e-3) => {
  const ok = Number.isFinite(got) && Math.abs(got - want) <= eps;
  if (!ok) failed += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${Number(got).toFixed(4)} (want ${want.toFixed(4)})`);
};

const bi = stackOf('bilevel');
near('BILEVEL: MAIN FL is the datum', floor(bi, 3).floorTop, 0);
near('BILEVEL: ENTRY sits on the sill, a fill wall and MAIN\'s package down', floor(bi, 2).floorBottom, -5.2813);
near('BILEVEL: ENTRY deck 4\'-5 3/8" under MAIN', floor(bi, 2).floorTop, -4.4479);
near('BILEVEL: ENTRY\'s wall reaches MAIN\'s bearing line', floor(bi, 2).wallTop, floor(bi, 3).floorBottom);
near('BILEVEL: MAIN\'s wall is PROJECT\'s 9\'-1 1/8"', floor(bi, 3).wallTop, 109.125 / 12);
near('BILEVEL: the foundation bears at ENTRY\'s sill', bi.foundation.wallTop, -5.2813);
near('BILEVEL: a 5\'-0" pour under the sill plate', bi.foundation.wallBottom, -10.4063);
near('BILEVEL: no storey over the garage -- 4 climbs from MAIN', floor(bi, 4).floorBottom, floor(bi, 3).wallTop);

const mod = stackOf('modifiedBilevel');
near('MOD BILEVEL: OVER GARAGE deck 9\' over ENTRY\'s', floor(mod, 4).floorTop, -4.4479 + 9);
near('MOD BILEVEL: 2ND FL still climbs from MAIN, not from OVER GARAGE', floor(mod, 5).floorBottom, floor(mod, 3).wallTop);

const typed = stackOf('bilevel', { sectionTable: { rows: { bilevel: { woodFillHeightFt: 5 } } } });
near('a typed WOOD FILL moves ENTRY with it', floor(typed, 2).floorBottom, -1.0521 - 5);

// AND NOTHING ELSE MOVES. A bungalow with the same levels stacks as it did.
const plain = stackOf(null);
near('a BUNGALOW\'s lowest level is still the datum', plain.floors[0].floorTop, 0);
near('a BUNGALOW still stacks MAIN a storey over its lowest level',
  floor(plain, 3).floorBottom, floor(plain, 2).wallTop);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall split-stack checks passed');
process.exit(failed ? 1 : 0);
