// DOES tests/preset-registration.spec.js CATCH A PRESET THAT IS NOT ON ITS
// INSIDE FACES, OR HAS NO MINI REGISTRATION POINT?
//
// Movie, 28 Oct: the kitchen's 3.5" wall "on the interior (behind the
// cabinets etc) and the intersection at the corner of the kitchen would be
// the 'mini' registration point"; bathrooms the same, the point at the tub
// corner. Each mutant breaks one of those; the spec named in `test` must go
// red.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SPEC = 'tests/preset-registration.spec.js';

const MUTANTS = [
  { file: 'kitchen-presets.js',
    name: 'the kitchen\'s walls go back on their centrelines',
    find: "wallType: 'stud_2x4', refLine: 'left' },",
    with: "wallType: 'stud_2x4', refLine: 'center' },",
    test: 'KITCHEN L1 in open floor' },
  { file: 'washroom-presets.js',
    name: 'the bath\'s rim walls stay on their centrelines',
    find: '      if (!w.face) return wall;',
    with: '      return wall;',
    test: 'WC 1 in open floor' },
  { file: 'washroom-presets.js',
    name: 'the bath\'s point goes to the corner away from the vanity',
    find: '    return by && by.at[0] < W / 2 ? [0, 0] : [W, 0];',
    with: '    return by && by.at[0] < W / 2 ? [W, 0] : [0, 0];',
    test: 'WC 1 in open floor' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the bath carries no registration point',
    find: '      ...(registrationOn(made, room.registration) || {}),\n',
    with: '',
    test: 'WC 1 in open floor' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the kitchen carries no registration point',
    find: '      ...(registrationOn(ownWalls, kitchen.registration) || {}),\n',
    with: '',
    test: 'KITCHEN L1 in open floor' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the kitchen is committed on centrelines whatever the preset says',
    find: "      stand: w, wall: commitWall(w.start, w.end, { bone: false, refLine: w.refLine || 'center', wallType: w.wallType }),",
    with: "      stand: w, wall: commitWall(w.start, w.end, { bone: false, refLine: 'center', wallType: w.wallType }),",
    test: 'KITCHEN L1 in open floor' },
  { file: 'model/03-plan-paint.js',
    name: 'the mini targets are never drawn',
    find: '        paintMiniTargets();\n',
    with: '',
    test: 'KITCHEN L1 in open floor' },
];

const run = (spec, grep) => {
  try {
    execSync(`npx playwright test ${spec} --workers=1`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// The restore is `git checkout -- <file>`: refuse to run over uncommitted
// work in any file a mutant touches.
const files = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${files.join(' ')}`, { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  const spec = m.spec || SPEC;
  let result = run(spec, m.test);
  let note = '';
  if (result === 'passed' && run(spec, null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
