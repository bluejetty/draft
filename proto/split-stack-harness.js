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
//   OVER GARAGE deck  -4.4479 + 10.6979      = 6.25      (MOD BILEVEL only: 6'-3" over MAIN)
//
// Run: node proto/split-stack-harness.js [--mutate]
const path = require('path');
const H = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

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
  ['MAIN\'s rim band is papered across the entry\'s tall wall again', 'cut-view.js',
    c => c.replace('            && face.level.wallTop > level.floorTop + 1e-6',
      '            && false')],
  ['the entry\'s wall stops at its own storey\'s ceiling again', 'cut-view.js',
    c => c.replace('      let level = ownTop > storey.wallTop + 0.05 && storey.id === ENTRY_LEVEL_ID',
      '      let level = false && storey.id === ENTRY_LEVEL_ID')],
  ['a plain BILEVEL gets the storey over the garage', 'level-assembly.js',
    c => c.replace("out.upper = buildType === 'modifiedBilevel';", 'out.upper = true;')],
  ['a split\'s garage climbs to MAIN FL\'s ceiling again', 'cut-view.js',
    c => c.replace('if (plate != null) level = { ...level, wallTop: plate };', 'void plate;')],
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
near('MOD BILEVEL: OVER GARAGE deck 6\'-3" over MAIN, the Sharma plans\' 10 risers', floor(mod, 4).floorTop, 6.25);
near('MOD BILEVEL: the house roof still bears on MAIN FL\'s ceiling', mod.bearing, floor(mod, 3).wallTop);
near('MOD BILEVEL: 2ND FL still climbs from MAIN, not from OVER GARAGE', floor(mod, 5).floorBottom, floor(mod, 3).wallTop);

const typed = stackOf('bilevel', { sectionTable: { rows: { bilevel: { woodFillHeightFt: 5 } } } });
near('a typed WOOD FILL moves ENTRY with it', floor(typed, 2).floorBottom, -1.0521 - 5);

// ── AND THE FRONT OF A BILEVEL, SEEN FROM THE STREET ─────────────────────
// The entry's front runs from the landing to MAIN FL's ceiling (13'-6 1/2"
// on PROJECT's defaults): the elevation stands it to its own top rather than
// to the ENTRY storey's, and MAIN's rim band does not paper over it.
{
  const front = (levelId, id, x0, x1, topHeight) =>
    ({ id, levelId, start: { x: x0, z: 20 }, end: { x: x1, z: 20 }, ...(topHeight ? { topHeight } : {}) });
  const saved = {
    buildType: 'bilevel', levels: LEVELS,
    walls: [
      front(3, 'mainL', -16, -10),
      front(2, 'entry', -10, 2, 13.5417),
      { id: 'back', levelId: 3, start: { x: -16, z: -20 }, end: { x: 16, z: -20 } },
    ],
  };
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E1');
  const out = H.paintElevation(win, env, cut, {});
  const fills = out.modelFills || [];
  const spans = (f, u, lo, hi) => {
    const us = f.pts.map(p => p.u), es = f.pts.map(p => p.e);
    return Math.min(...us) < u && Math.max(...us) > u && Math.min(...es) >= lo && Math.max(...es) <= hi;
  };
  // MAIN's band: floorBottom -1.0521 to floorTop 0, padded a pixel.
  const band = u => fills.filter(f => f.ink === '#fff' && spans(f, u, -1.2, 0.2)).length;
  near('a BILEVEL front: MAIN\'s rim band still runs across MAIN\'s own wall', band(-13) > 0 ? 1 : 0, 1);
  near('a BILEVEL front: and not across the entry\'s wall, which runs past it', band(-4) > 0 ? 1 : 0, 0);
  const entryTop = Math.max(...fills.filter(f => f.pts.some(p => Math.abs(p.u + 4) < 6))
    .flatMap(f => f.pts.filter(p => p.u > -9.5 && p.u < 1.5).map(p => p.e)));
  near('a BILEVEL front: the entry\'s wall climbs to MAIN FL\'s ceiling', entryTop, 109.125 / 12, 0.1);
}

// ── THE MOD BILEVEL'S GARAGE, ON ITS OWN BEAM AND UNDER ITS OWN ROOF ─────
// Movie, 3 Oct, on E4: "the garage wall height also extends too high up. it
// should only go to the underside of the 2nd floor" -- and "the grade beam is
// missing, the 1.5" sill plate should match height and then 32" grade beam
// below". A MOD BILEVEL + its garage as MODEL built it from the drive-thru
// (proto/repro-modbilevel-garage-beam.draft):
//
//   garage sill       the house sill                         -5.2813
//   OVER GARAGE       its floor's underside, the garage roof   4.5833
//   the beam          32" of concrete under a 1 1/2" plate   -5.4063 .. -8.0729
{
  const fs = require('fs');
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-modbilevel-garage-beam.draft'), 'utf8'));
  const env = H.buildEnv(win, saved);
  const stack = CV.sectionLevelStack(env);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E4');
  const { faces } = CV.elevationFaces(env, cut, stack, CV.cutAxis(cut));
  const tops = kind => faces.filter(f => (kind === 'garage') === Boolean(f.garage)
    && Number(f.wall.levelId) === 3).map(f => f.level.wallTop);
  near('MOD BILEVEL E4: every garage wall stops under the room\'s floor',
    Math.max(...tops('garage')), floor(stack, 4).floorBottom);
  near('MOD BILEVEL E4: and MAIN FL\'s own walls still reach MAIN\'s ceiling',
    Math.min(...tops('house')), floor(stack, 3).wallTop);
  const beam = saved.walls.filter(w => Number(w.levelId) === 1 && w.body === 'garage');
  near('MOD BILEVEL: the garage sill is the house sill',
    CV.garageBearing(env, stack.foundation, env.garageOutlines(3)[0]), stack.foundation.wallTop);
  near('MOD BILEVEL: the beam it was built with tops out a plate under that',
    stack.foundation.wallBottom + Math.max(...beam.map(w => w.topHeight)), -5.4063);
  near('MOD BILEVEL: and hangs 32" -- 18" of it under grade',
    stack.foundation.wallBottom + Math.min(...beam.map(w => w.baseHeight)), stack.foundation.grade - 1.5);
}

// AND NOTHING ELSE MOVES. A bungalow with the same levels stacks as it did.
const plain = stackOf(null);
near('a BUNGALOW\'s lowest level is still the datum', plain.floors[0].floorTop, 0);
near('a BUNGALOW still stacks MAIN a storey over its lowest level',
  floor(plain, 3).floorBottom, floor(plain, 2).wallTop);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall split-stack checks passed');
process.exit(failed ? 1 : 0);
