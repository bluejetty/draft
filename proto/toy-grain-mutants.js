// DOES THE TOY GRAIN SPEC CATCH A GRID THAT IS NOT THE HOUSE'S?
//
// The gate for TOY's 6" grain (Movie, 16 Oct): interior walls on the 6" grid
// off the exterior corners, the inside faces and opening edges as hard lines
// that beat it, and cabinets on the same grain from the nearer corner.
//
// MUTANT 4 IS THE ONE WORTH THE GATE. Put the face on the wall's LINE instead
// of its inside face and everything else still passes -- the grid works, the
// openings work, the light stays on -- while every interior wall is drawn
// 5½" into the exterior wall. Only the face check sees it, and it sees it
// only because it asks for the exact number rather than "near the wall".
//
// MUTANT 2 IS THE ONE HE CORRECTED IN CONVERSATION: "its not measure off
// inside face - the 6" grid is based on the ext corners of the house". A
// grid on the world origin agrees with the house's on every house that
// happens to stand on the world's foot marks, which is every fixture but
// the one written to catch it.
//
// THE SPEC PATH IS WRITTEN OUT IN EACH ROW: mutant-anchors-harness.js reads
// this table on its own, without the rest of the file.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'model/09-draw-move-stretch.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'THE GRAIN WITH NO HOUSE: a level with no outline is gridded anyway',
    find: '    const pts = house && house.points;\n    if (!pts || pts.length < 3) return null;',
    with: '    const pts = (house && house.points && house.points.length >= 3) ? house.points\n      : [{ x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 }];',
    test: 'with no outline on the level the foot rule stands too' },

  { file: 'model/09-draw-move-stretch.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'THE GRID IS THE WORLD\'S: a house off the world\'s foot marks gets the wrong grid',
    find: '      x: Math.min(...pts.map(p => Number(p.x))),\n      z: Math.min(...pts.map(p => Number(p.z))) } };',
    with: '      x: 0,\n      z: 0 } };',
    test: 'the grid is the exterior corners, not the world origin' },

  { file: 'model/09-draw-move-stretch.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'THE HARD LINES ARE FORGOTTEN: the grid wins at the face',
    find: '    return best ? best.c : grid;',
    with: '    return grid;',
    test: 'cut at its inside face' },

  { file: 'model/09-draw-move-stretch.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'THE FACE IS THE WALL\'S LINE: every interior wall runs 5½" into the exterior wall',
    find: '      const faceAcross = inside ? frame.endOff : frame.startOff;',
    with: '      const faceAcross = inside ? frame.startOff : frame.endOff;',
    test: 'cut at its inside face' },

  { file: 'model/09-draw-move-stretch.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'a floor opening\'s edge is not a hard line',
    find: '      if (Number(opening.levelId) !== Number(levelId) || opening.hostType !== \'floor\') return;',
    with: '      return;',
    test: 'the edge of a floor opening is a hard line' },

  { file: 'model/10-tracking-garage.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'THE GRAIN LEAKS OUTSIDE THE HOUSE: a run beside it is gridded too',
    find: '    if (grain && inHouse(grain, free) && (!drawStart || inHouse(grain, drawStart))) {',
    with: '    if (grain) {',
    test: 'outside the house, and with no house on the level' },

  { file: 'model/11-floor-openings-fixtures.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'cabinets are measured from the wall\'s start, so one cannot sit flush in the far corner',
    find: '    const datum = placement.along <= len / 2 ? 0 : len;',
    with: '    const datum = 0;',
    test: 'a cabinet run lands on the half foot from the nearer corner' },

  { file: 'model/11-floor-openings-fixtures.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'THE LEAK: cabinets are gridded on DRAFTING too',
    find: '    if (board !== \'toy\' || !kind.casework || !Q) return placement.along;',
    with: '    if (!kind.casework || !Q) return placement.along;',
    test: 'on DRAFTING a cabinet keeps the width the hand gave it' },

  { file: 'toy-constraints.js', spec: 'tests/model-toy-grain.spec.js',
    name: 'onGrain ignores its datum: every grain is the world\'s',
    find: '    return d + Math.round((v - d) / step) * step;',
    with: '    return Math.round(v / step) * step;',
    test: 'the grid is the exterior corners, not the world origin' },
];

const run = (spec, grep) => {
  try {
    execSync(`npx playwright test ${spec}`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it.
const dirty = execSync('git status --porcelain MODEL.html toy-constraints.js',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

// THE BASELINE FIRST. A spec that is already red kills every mutant and
// prints a perfect sheet over broken code.
if (run('tests/model-toy-grain.spec.js', null) !== 'passed') {
  console.error('BASELINE RED: tests/model-toy-grain.spec.js fails on an unmutated tree; nothing below would mean anything.');
  process.exit(1);
}
console.log('baseline green\n');

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); ambiguous += 1; continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.spec, m.test);
  let note = '';
  if (result === 'passed' && run(m.spec, null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant counts as
// AMBIGUOUS and fails the sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
