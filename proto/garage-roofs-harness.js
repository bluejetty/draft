// A BUNGALOW'S HOUSE AND GARAGE: DIFFERENT HEIGHTS, ONE ROOF OR TWO.
//
// Movie, 6 Oct: "i increased the HOUSE wall (not GARAGE WALL) the garage wall
// also moved to house height though. they should be different heights" -- and
// "if both walls are same height exactly they should be ONE roof". The garage
// default is 9'-1 1/8" + 1'-0 5/8" = 10'-1 3/4", one MAIN floor package over
// the house precut, because it stands on the house sill.
//
// level-assembly.js: the garage numbers, and the house rule skipping garage
// walls. garage-roofs.js: which loops are roofed, the cut, the regroup.
//
// Run: node proto/garage-roofs-harness.js          (checks)
//      node proto/garage-roofs-harness.js --mutate (checks + mutations)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function load(mutate) {
  const srcs = { 'geometry-2d.js': read('geometry-2d.js'), 'level-assembly.js': read('level-assembly.js'),
    'traced-plans.js': read('traced-plans.js'), 'garage-roofs.js': read('garage-roofs.js') };
  if (mutate) {
    const [file, fn] = mutate;
    const next = fn(srcs[file]);
    if (next === srcs[file]) throw new Error('mutation matched nothing -- it would prove nothing');
    srcs[file] = next;
  }
  const window = {};
  Object.values(srcs).forEach(src => new Function('window', src)(window)); // eslint-disable-line no-new-func
  return window;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const r3 = n => Math.round(n * 1000) / 1000;
const ptsKey = pts => pts.map(p => `${r3(p.x)},${r3(p.z)}`).join(' ');

// The premade bungalow's shapes: a 32 x 40 house, a garage 24 wide standing
// 4 ft past the house's right wall, notched for the tie.
const HOUSE = [{ x: -16, z: -20 }, { x: 16, z: -20 }, { x: 16, z: 20 }, { x: -16, z: 20 }];
const GARAGE = [{ x: -4, z: 20 }, { x: 16, z: 20 }, { x: 16, z: 19 }, { x: 20, z: 19 },
  { x: 20, z: 46 }, { x: -4, z: 46 }];
const MAIN_PKG = (11.875 + 0.75) / 12;

check('the attached garage default is 10\'-1 3/4"', W =>
  [r3(W.DraftLevelAssembly.DEFAULT_ATTACHED_GARAGE_WALL_FT * 12), 121.75]);
check('that default tops out level with a 9\'-1 1/8" house', W =>
  [r3(W.DraftLevelAssembly.garageTopAboveMainFt({}) * 12), r3(9.09375 * 12)]);
check('a typed garage height is used as typed', W =>
  [r3(W.DraftLevelAssembly.attachedGarageWallFt({ sectionTable: { rows: { attachedGarage: { mainWallHeightFt: 11 } } } })), 11]);
check('a frost-walled garage sits 2 ft lower, as cut-view.js drops it', W => {
  const cv = read('cut-view.js').match(/GARAGE_SILL_BELOW_HOUSE_FT = (\d+(?:\.\d+)?)/);
  return [W.DraftGarageRoofs.garageDropFt({ sectionTable: { rows: { attachedGarage: { garageFoundation: 'frostwall' } } } }, null),
    Number(cv && cv[1])];
});
check('a split never drops its garage', W =>
  [W.DraftGarageRoofs.garageDropFt({ buildType: 'bilevel',
    sectionTable: { rows: { attachedGarage: { garageFoundation: 'frostwall' } } } }, null), 0]);

check('the house height moves the house walls and leaves the garage walls', W => {
  const L = W.DraftLevelAssembly;
  const walls = [{ id: 'h', levelId: 3, topHeight: 8.09375 }, { id: 'g', levelId: 3, topHeight: 8.09375, body: 'garage' }];
  const out = L.wallsFollowingHeights(walls, { 3: { wallHeightFt: 8.09375 } }, { 3: { wallHeightFt: 12 } });
  return [out && out.map(w => w.topHeight).join(), '12,8.09375'];
});
check('the garage height moves the garage walls at its old top, not a detached one', W => {
  const L = W.DraftLevelAssembly;
  const walls = [{ id: 'g', body: 'garage', topHeight: 9 }, { id: 'd', body: 'garage', topHeight: 9 },
    { id: 'h', topHeight: 9 }, { id: 'own', body: 'garage', topHeight: 7 }];
  const out = L.garageWallsFollowing(walls, 9, 10, w => w.id === 'd');
  return [out && out.map(w => w.topHeight).join(), '10,9,9,7'];
});

check('equal tops are one roof over both', W => {
  const r = W.DraftGarageRoofs.roofLoops({ house: HOUSE, garage: GARAGE, houseTopFt: 9, garageTopFt: 9 });
  return [`${r.merged}|${r.garage}|${r.house.flush.length}`, 'true|null|0'];
});
check('a lower garage dies into the house: its shared edges flush, the house all eaves', W => {
  const r = W.DraftGarageRoofs.roofLoops({ house: HOUSE, garage: GARAGE, houseTopFt: 12, garageTopFt: 9 });
  const flushOnHouse = r.garage.flush.every(i => {
    const a = r.garage.ring[i], b = r.garage.ring[(i + 1) % r.garage.ring.length];
    return (a.z === 20 && b.z === 20 && Math.max(a.x, b.x) <= 16) || (a.x === 16 && b.x === 16);
  });
  return [`${r.merged}|${r.house.flush.length}|${r.garage.flush.length > 0}|${flushOnHouse}|${!r.house.cuts}`,
    'false|0|true|true|true'];
});
check('a taller garage stands out of the house roof: the house is cut, never flushed', W => {
  const r = W.DraftGarageRoofs.roofLoops({ house: HOUSE, garage: GARAGE, houseTopFt: 8, garageTopFt: 9 });
  return [`${r.house.flush.length}|${r.garage.flush.length}|${r.house.cuts && ptsKey(r.house.cuts[0])}`,
    '0|0|-4,19 20,19 20,46 -4,46'];
});
check('the taller garage is roofed over its rectangle, not its notched loop', W => {
  const r = W.DraftGarageRoofs.roofLoops({ house: HOUSE, garage: GARAGE, houseTopFt: 8, garageTopFt: 9 });
  return [ptsKey(r.garage.ring), '-4,19 20,19 20,46 -4,46'];
});

check('a cut roof goes OUTWARD on a ring wound either way', W => {
  const GR = W.DraftGarageRoofs;
  const sq = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];
  return [`${ptsKey(GR.cutRoof(sq, [], 2).points)}|${ptsKey(GR.cutRoof(sq.slice().reverse(), [], 2).points)}`,
    '-2,-2 12,-2 12,12 -2,12|-2,12 12,12 12,-2 -2,-2'];
});
check('an eave and a flush stretch on one line meet in a step, not a slant', W => {
  const GR = W.DraftGarageRoofs;
  const ring = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 4, z: 10 }, { x: 0, z: 10 }];
  const cut = GR.cutRoof(ring, [2], 2);
  return [`${ptsKey(cut.points)}|${cut.edges.join(',')}`,
    '-2,-2 12,-2 12,10 4,10 4,12 -2,12|eave,eave,gable,gable,eave,eave'];
});

// ── THE REGROUP, ON A BUILT BUNGALOW ─────────────────────────────────────
const BUILT = (rows = {}, assemblies = {}) => ({
  buildType: 'bungalow',
  levelAssemblies: assemblies,
  sectionTable: { rows },
  outlines: [{ id: 'h', levelId: 3, points: HOUSE }, { id: 'g', levelId: 3, garage: true, points: GARAGE }],
  walls: [],
  roofs: [{ id: 'r1', levelId: 7, garage: false, follows: 'house', overhang: 2, pitch: 4, fascia: 5.5,
    roofing: 'metal', edges: ['eave', 'eave', 'eave', 'eave'], points: [] }],
});
check('house and garage at one top regroup to one roof that keeps its id and roofing', W => {
  const d = BUILT({ attachedGarage: { mainWallHeightFt: 9.09375 + MAIN_PKG } }, { 3: { wallHeightFt: 9.09375 } });
  const out = W.DraftGarageRoofs.regroupRoofs(d);
  return [out && `${out.length}|${out[0].id}|${out[0].roofing}|${out[0].follows}`, '1|r1|metal|house'];
});
check('a taller garage regroups to two roofs: the house cut, the garage on its own plate', W => {
  const d = BUILT({}, { 3: { wallHeightFt: 8.09375 } });
  const out = W.DraftGarageRoofs.regroupRoofs(d);
  const g = out && out.find(r => r.follows === 'attachedGarage');
  const h = out && out.find(r => r.follows === 'house');
  return [out && `${out.length}|${r3(g.plateHeightFt)}|${g.garage}|${(h.cuts || []).length}`,
    `2|${r3(9.09375)}|true|1`];
});
check('a 2 STOREY only moves its garage roof to the garage plate', W => {
  const d = BUILT({ attachedGarage: { mainWallHeightFt: 11 } });
  d.outlines.push({ id: 'u', levelId: 5, points: HOUSE });
  d.roofs.push({ id: 'g1', levelId: 7, garage: true, follows: 'attachedGarage', plateHeightFt: 8, points: [], edges: [] });
  const out = W.DraftGarageRoofs.regroupRoofs(d);
  return [out && `${out.length}|${r3(out[1].plateHeightFt)}|${out[0] === d.roofs[0]}`,
    `2|${r3(11 - MAIN_PKG)}|true`];
});
check('a split is left alone', W => {
  const d = BUILT();
  d.buildType = 'modifiedBilevel';
  return [W.DraftGarageRoofs.regroupRoofs(d), null];
});

const MUTATIONS = [
  ['the house rule sweeps the garage walls along again', 'level-assembly.js',
    s => s.replace("      if (wall?.body === 'garage') return wall;\n", '')],
  ['the garage default is the house precut again', 'level-assembly.js',
    s => s.replace('(104.625 + 4.5 + 11.875 + 0.75) / 12', '(104.625 + 4.5) / 12')],
  ['the garage top forgets the floor package', 'level-assembly.js',
    s => s.replace('    - levelFloorFt(levelAssemblyFor(drawing?.levelAssemblies, MAIN_LEVEL_ID)) - (Number(dropFt) || 0);',
      '    - (Number(dropFt) || 0);')],
  ['a detached garage\'s walls follow the attached height', 'level-assembly.js',
    s => s.replace("if (wall?.body !== 'garage' || isDetached(wall)) return wall;", "if (wall?.body !== 'garage') return wall;")],
  ['equal tops still make two roofs', 'garage-roofs.js',
    s => s.replace('    if (sameTop(houseTopFt, garageTopFt)) {\n', '    if (false) {\n')],
  ['a taller garage flushes the house roof again', 'garage-roofs.js',
    s => s.replace('    const garageLower = !(garageTopFt > houseTopFt + SAME_TOP_FT);', '    const garageLower = true;')],
  ['the cut is the notched loop, not its rectangle', 'garage-roofs.js',
    s => s.replace('    if (square) {', '    if (false) {')],
  ['the step is dropped: one point where eave meets flush', 'garage-roofs.js',
    s => s.replace("      out.push({ p: { x: v.x + cur.nx * dPrev, z: v.z + cur.nz * dPrev }, kind: { gable: true, over: 0 } });\n", '')],
  ['the cut goes inward', 'garage-roofs.js',
    s => s.replace('    const sign = area > 0 ? 1 : -1;', '    const sign = area > 0 ? -1 : 1;')],
  ['the regrouped garage roof bears at the house plate', 'garage-roofs.js',
    s => s.replace('        plateHeightFt: topG,\n        follows', '        plateHeightFt: L.houseWallTopFt(drawing),\n        follows')],
  ['a frost wall drops nothing', 'garage-roofs.js',
    s => s.replace("return kind === 'frostwall' ? FROST_SILL_DROP_FT : 0;", 'return 0;')],
];

function score(W) {
  return CHECKS.map(({ label, fn }) => {
    let got, want;
    try { [got, want] = fn(W); } catch (err) { got = `threw: ${err.message}`; want = 'no throw'; }
    return { label, ok: String(got) === String(want), got, want };
  });
}

function run() {
  const results = score(load(null));
  const failed = results.filter(r => !r.ok);
  failed.forEach(r => console.log(`FAIL  ${r.label}\n      got  ${r.got}\n      want ${r.want}`));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

function runMutations() {
  run();
  console.log('\n' + 'mutation'.padEnd(62) + 'caught by');
  let survived = 0, broken = 0;
  MUTATIONS.forEach(([label, file, fn]) => {
    let W;
    try { W = load([file, fn]); } catch (err) {
      broken += 1;
      console.log(`${label.padEnd(62)}!!! MUTATION DID NOT APPLY: ${err.message}`);
      return;
    }
    const caught = score(W).filter(r => !r.ok).map(r => r.label);
    if (!caught.length) survived += 1;
    console.log(label.padEnd(62) + (caught.length ? caught.join('\n' + ' '.repeat(62)) : '*** NOTHING ***'));
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (survived || broken) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run();
