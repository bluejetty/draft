#!/usr/bin/env node
// RELOAD THE HOUSE TO THE PROJECT NUMBERS (Movie, 20 Oct): "i forgot to enter
// the PROJECT info first. i would like to tranform the existing outline wall
// and roof to the new contstuction type and heights" ... "to reload press the
// bone in project area once you pick your numbers and kinds of stuff youd
// like" ... "certain things need to be locked - BUNGALOW / number of stories".
//
// Pins project-reload.js: which walls change height (the storey's tallest),
// which change type (the shell on an outline, the foundation borrowing the
// storeys' outline), what is left alone (interior walls, a pony wall, grade
// beams, a detached garage, the BONEYARD, a ROOF-tool roof), that the roofs
// reshape and regroup, and that the inputs are never edited where they lie.
//
//   node proto/project-reload-harness.js            the checks
//   node proto/project-reload-harness.js --mutate   each mutation, and what caught it
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const FILES = ['geometry-2d.js', 'level-assembly.js', 'traced-plans.js', 'garage-roofs.js', 'project-reload.js'];

function load(mutate, overrides = {}) {
  const srcs = {};
  FILES.forEach(f => { srcs[f] = overrides[f] || read(f); });
  if (mutate) {
    const [file, fn] = mutate;
    const next = fn(srcs[file]);
    if (next === srcs[file]) throw new Error('mutation matched nothing -- it would prove nothing');
    srcs[file] = next;
  }
  const window = {};
  FILES.forEach(f => new Function('window', srcs[f])(window)); // eslint-disable-line no-new-func
  return window;
}

const MAIN = 3, FDN = 1, ROOF = 7, SHELF = -1;
const LEVELS = [{ id: 8, name: 'SITE' }, { id: 7, name: 'ROOF' }, { id: 5, name: '2ND FL' },
  { id: 3, name: 'MAIN FL' }, { id: 1, name: 'FOUNDATION' }];
const LOOP = [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 28 }, { x: 0, z: 28 }];
const GARAGE = [{ x: 40, z: 4 }, { x: 64, z: 4 }, { x: 64, z: 28 }, { x: 40, z: 28 }];
const FAR = [{ x: 100, z: 0 }, { x: 124, z: 0 }, { x: 124, z: 24 }, { x: 100, z: 24 }];
const pt = p => ({ x: p.x, y: 0, z: p.z });
const wall = (id, a, b, { levelId = MAIN, view = 'plan', top = 8, type = 'stud_2x6', body } = {}) => ({
  id, levelId, view, start: { x: a.x, z: a.z }, end: { x: b.x, z: b.z },
  baseHeight: 0, topHeight: top, wallType: type, refLine: 'left',
  ...(body ? { body } : {}),
});
const ring = (prefix, loop, opts) => loop.map((a, i) =>
  wall(`${prefix}${i + 1}`, a, loop[(i + 1) % loop.length], opts));
const roof = (id, loop, extra = {}) => ({
  id, levelId: ROOF, follows: 'house', pitch: 4, overhang: 2,
  points: loop.map(p => ({ x: p.x, y: 0, z: p.z })),
  edges: ['eave', 'eave', 'eave', 'eave'], edgeOverhang: [2, 2, 2, 2], ...extra,
});
const grow = (loop, by) => loop.map(p => ({
  x: p.x + (p.x > 20 ? by : -by), z: p.z + (p.z > 14 ? by : -by) }));

// THE HAND-DRAWN BUNGALOW: a traced outline whose walls stand at the WALL
// tool's 8'-0" in 2x6, an interior wall, a half wall, the foundation under it
// in 8" concrete with no outline of its own, the house roof at 4/12 and 2',
// a ROOF-tool roof, and a suite on a BONEYARD shelf. The PROJECT page now
// says MAIN FL 9'-0" ICF, FOUNDATION 8'-1 1/2" ICF, pitch 6, overhang 3.
const bungalow = () => ({
  version: 1, buildType: 'bungalow', levels: LEVELS,
  outlines: [{ id: 'h', levelId: MAIN, garage: false, points: LOOP.map(pt) }],
  walls: [
    ...ring('w', LOOP),
    wall('mid', { x: 20, z: 0 }, { x: 20, z: 28 }),
    wall('pony', { x: 5, z: 5 }, { x: 15, z: 5 }, { top: 4 }),
    ...ring('f', LOOP, { levelId: FDN, view: 'foundation', type: 'concrete_8' }),
    wall('shelf', { x: 0, z: 0 }, { x: 10, z: 0 }, { levelId: SHELF }),
  ],
  roofs: [roof('r1', grow(LOOP, 2)), roof('loose', grow(LOOP, 2), { follows: 'none' })],
  levelAssemblies: { [MAIN]: { wallHeightFt: 9, wallType: 'icf' }, [FDN]: { wallHeightFt: 8.125, wallType: 'icf' } },
  roofPitch: 6, roofOverhang: 3,
});

// THE SAME HOUSE WITH AN ATTACHED GARAGE AND A DETACHED ONE, no roofs: the
// garage's walls answer the garage's own top, its grade beam and the
// detached garage's walls answer other rows.
const withGarages = () => {
  const d = bungalow();
  d.roofs = [];
  d.outlines.push(
    { id: 'g', levelId: MAIN, garage: true, detached: false, points: GARAGE.map(pt) },
    { id: 'd', levelId: MAIN, garage: true, detached: true, points: FAR.map(pt) });
  d.walls.push(
    ...ring('g', GARAGE, { top: 10, body: 'garage' }),
    wall('beam', GARAGE[0], GARAGE[1], { levelId: FDN, view: 'foundation', top: 0.5, type: 'concrete_8', body: 'garage' }),
    ...ring('d', FAR, { top: 9, body: 'garage' }));
  return d;
};

const run = (W, d) => W.DraftProjectReload.reloadHouse(d,
  { offsetVariable: W.DraftGeometry2D.offsetOutlineVariable });
const find = (out, id) => out.walls.find(w => w.id === id);
const r3 = n => Math.round(n * 1000) / 1000;
const says = (out, id) => { const w = find(out, id); return `${w.wallType}@${r3(w.topHeight)}`; };

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

check('the shell walls take the storey-s type and height',
  W => { const out = run(W, bungalow());
    return [['w1', 'w2', 'w3', 'w4'].map(id => says(out, id)).join(' '), 'icf@9 icf@9 icf@9 icf@9']; });

check('an interior wall rises with the storey and keeps its own framing',
  W => [says(run(W, bungalow()), 'mid'), 'stud_2x6@9']);

check('a wall cut short stays short',
  W => [says(run(W, bungalow()), 'pony'), 'stud_2x6@4']);

check('the foundation borrows the storey-s outline for its shell and takes its own type and height',
  W => { const out = run(W, bungalow());
    return [['f1', 'f2', 'f3', 'f4'].map(id => says(out, id)).join(' '), 'icf@8.125 icf@8.125 icf@8.125 icf@8.125']; });

check('a BONEYARD shelf is a parts bin, not the house',
  W => [says(run(W, bungalow()), 'shelf'), 'stud_2x6@8']);

check('the house roof takes the pitch and overhang, and its eave moves out',
  W => { const out = run(W, bungalow()); const r = out.roofs.find(x => x.id === 'r1');
    return [`${r.pitch}|${r.overhang}|${Math.min(...r.points.map(p => p.x))}`, '6|3|-3']; });

check('a ROOF-tool roof is the drafter-s and is not touched',
  W => { const d = bungalow(); const out = run(W, d);
    return [out.roofs.find(x => x.id === 'loose') === d.roofs[1], true]; });

check('it counts what it changed',
  W => { const out = run(W, bungalow()); return [`${out.moved}|${out.retyped}|${out.reshaped}`, '9|8|1']; });

check('the drawing handed in is not edited where it lies',
  W => { const d = bungalow(); const before = JSON.stringify(d); run(W, d); return [JSON.stringify(d), before]; });

check('no type on the storey and no shared type leaves every type alone',
  W => { const d = bungalow(); d.levelAssemblies = { [MAIN]: { wallHeightFt: 9 } };
    const out = run(W, d); return [`${says(out, 'w1')}|${out.retyped}`, 'stud_2x6@9|0']; });

check('the shared exterior type answers for a storey with no type of its own',
  W => { const d = bungalow(); d.levelAssemblies = { [MAIN]: { wallHeightFt: 9 } }; d.activeWallType = 'icf_13';
    return [says(run(W, d), 'w1'), 'icf_13@9']; });

check('the storey-s own type beats the shared one',
  W => { const d = bungalow(); d.activeWallType = 'icf_13';
    return [says(run(W, d), 'w1'), 'icf@9']; });

check('a foundation type that is not a foundation wall changes nothing',
  W => { const d = bungalow(); d.levelAssemblies[FDN].wallType = 'stud_2x4';
    return [says(run(W, d), 'f1'), 'concrete_8@8.125']; });

check('a house already at its numbers answers null',
  W => { const d = bungalow(); d.roofs = []; d.walls = d.walls.filter(w => w.id !== 'shelf');
    d.levelAssemblies = { [MAIN]: { wallHeightFt: 8, wallType: 'stud_2x6' }, [FDN]: { wallHeightFt: 8, wallType: 'concrete_8' } };
    return [run(W, d), null]; });

check('no walls, or no drawing, is null and not a throw',
  W => [`${run(W, { walls: [] })}|${run(W, null)}|${run(W, { walls: 'x' })}`, 'null|null|null']);

check('the attached garage-s walls go to the garage-s own top, not the house-s',
  W => { const d = withGarages(); const out = run(W, d);
    const want = W.DraftGarageRoofs.garageTopFt(d, d.outlines[1]);
    return [`${says(out, 'g1')}|${r3(want) !== 9}|${says(out, 'w1')}`, `icf@${r3(want)}|true|icf@9`]; });

check('the garage-s grade beam hangs where the foundation put it',
  W => [says(run(W, withGarages()), 'beam'), 'concrete_8@0.5']);

check('a detached garage answers its own row and is not touched',
  W => [says(run(W, withGarages()), 'd1'), 'stud_2x6@9']);

// THE REGROUP, with garage-roofs.js stood in for by a recorder: a moved top
// regroups the roofs, a reload that moved none does not.
const RECORDER = `window.DraftGarageRoofs = Object.freeze({
  detachedWallTest: () => () => false, bodiesOf: () => null, garageTopFt: () => 10,
  regroupRoofs: () => { window.__regroups = (window.__regroups || 0) + 1; return null; } });`;
check('a moved top regroups the roofs; a reload that moved none does not',
  (W, mutate) => { const S = load(mutate, { 'garage-roofs.js': RECORDER });
    run(S, bungalow()); const afterMove = S.__regroups || 0;
    const d = bungalow(); d.levelAssemblies[MAIN].wallHeightFt = 8; d.levelAssemblies[FDN].wallHeightFt = 8;
    run(S, d);
    return [`${afterMove}|${(S.__regroups || 0) - afterMove}`, '1|0']; });

check('a house stands when walls do; an outline alone is a plan not yet raised',
  W => { const P = W.DraftProjectReload;
    return [`${P.houseStands(bungalow())}|${P.houseStands({ outlines: [{}], walls: [] })}|${P.houseStands(null)}`, 'true|false|false']; });

const MUTATIONS = [
  ['every wall on the storey moves, the half wall too', 'project-reload.js',
    s => s.replace('        && Math.abs(top - tallest.get(groupKey(wall))) < EPS\n', '')],
  ['interior walls are retyped with the shell', 'project-reload.js',
    s => s.replace("      if (!rings.some(ring => geo.edgeOnLoop(wall.start, wall.end, ring))) return null;\n", '')],
  ['the foundation borrows nothing and is never retyped', 'project-reload.js',
    s => s.replace('    return [...byLevel.values()].flat();', '    return [];')],
  ['the garage-s grade beam is lifted to the garage top', 'project-reload.js',
    s => s.replace("        if (viewOf(wall) === 'foundation' || isDetached(wall)) return null;",
      '        if (isDetached(wall)) return null;')],
  ['a detached garage-s walls follow the attached garage-s top', 'project-reload.js',
    s => s.replace("        if (viewOf(wall) === 'foundation' || isDetached(wall)) return null;",
      "        if (viewOf(wall) === 'foundation') return null;")],
  ['the grade beam is poured in the foundation-s wall type', 'project-reload.js',
    s => s.replace("      if (wall.body === 'garage' && (isDetached(wall) || viewOf(wall) === 'foundation')) return null;",
      "      if (wall.body === 'garage' && isDetached(wall)) return null;")],
  ['the BONEYARD shelves are reloaded with the house', 'project-reload.js',
    s => s.replace('    && wall.levelId != null && levelIds.has(Number(wall.levelId)));',
      '    && wall.levelId != null);')],
  ['a ROOF-tool roof is reshaped too', 'project-reload.js',
    s => s.replace('        if (!row) return roof;\n', '')],
  ['the roofs never regroup', 'project-reload.js',
    s => s.replace('    if (moved) {\n      const regrouped', '    if (false) {\n      const regrouped')],
  ['an unchanged house is handed back anyway', 'project-reload.js',
    s => s.replace('    if (!moved && !retyped && nextRoofs === roofs) return null;', '')],
  ['the shared type beats the storey-s own', 'project-reload.js',
    s => s.replace('      return exteriorIds().includes(asm.wallType) ? asm.wallType : activeType;',
      '      return activeType || asm.wallType;')],
  ['any foundation type is poured, a stud wall included', 'project-reload.js',
    s => s.replace('        return foundationIds().includes(asm.wallType) ? asm.wallType : null;',
      '        return asm.wallType;')],
  ['the wall is edited where it lies', 'project-reload.js',
    s => s.replace('        next = { ...next, topHeight: want };', '        next.topHeight = want;')],
  ['the garage-s walls set the house-s full height', 'project-reload.js',
    s => s.replace('|${bodyOf(wall)}`;', '`;')],
  ['the garage follows the house-s storey height', 'project-reload.js',
    s => s.replace('        return garageTop;', '        return L.levelAssemblyFor(table, wall.levelId).wallHeightFt;')],
];

function run_() {
  const W = load(null);
  let failed = 0;
  CHECKS.forEach(({ label, fn }) => {
    let got, want;
    try { [got, want] = fn(W, null); } catch (err) { got = `threw: ${err.message}`; want = 'no throw'; }
    if (String(got) !== String(want)) {
      failed += 1;
      console.log(`FAIL  ${label}\n      got  ${got}\n      want ${want}`);
    }
  });
  console.log(`\n${CHECKS.length - failed}/${CHECKS.length} checks passed`);
  if (failed) process.exitCode = 1;
}

function runMutations() {
  console.log('\n' + 'mutation'.padEnd(62) + 'caught by');
  let survived = 0;
  let broken = 0;
  MUTATIONS.forEach(([label, file, fn]) => {
    const mutate = [file, fn];
    let W;
    try { W = load(mutate); } catch (err) {
      broken += 1;
      console.log(`${label.padEnd(62)}!!! MUTATION DID NOT APPLY: ${err.message}`);
      return;
    }
    const caught = [];
    CHECKS.forEach(({ label: name, fn }) => {
      let got, want;
      try { [got, want] = fn(W, mutate); } catch (err) { caught.push(name); return; }
      if (String(got) !== String(want)) caught.push(name);
    });
    if (!caught.length) survived += 1;
    console.log(label.padEnd(62)
      + (caught.length ? caught.join('\n' + ' '.repeat(62)) : '*** NOTHING ***'));
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  if (survived || broken) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run_();
