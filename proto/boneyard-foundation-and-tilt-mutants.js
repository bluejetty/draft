// DOES THE BONEYARD SPEC CATCH A FOUNDATION THAT DROPS THE GARAGE AGAIN?
//
// The gate for two of Movie's 16 Oct asks on the BONEYARD page: "the
// foundation doesn't show the garage outline, but it should show that (like
// the main floor does)", and "put in up and down arrows over the rotation and
// 15 degree iterations in those directions too".
//
// MUTANT 1 IS THE OLD CODE. The garage was left off the foundation on purpose
// for a fortnight, under a comment that read as a rule; the one-line mutant
// that puts that reading back is what the spec has to refuse from now on.
//
// MUTANT 3 IS THE ONE WORTH THE GATE. Take the copy out and the foundation's
// garage loop IS the floor's loop -- the same object -- and the floor's
// openings, attached later, appear on the foundation too: garage doors in a
// grade beam. Every count still passes; only the openings check sees it.
//
// THE SPEC PATHS ARE WRITTEN OUT IN EACH ROW: mutant-anchors-harness.js reads
// this table on its own, without the rest of the file.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'boneyard-loops.js', spec: 'tests/boneyard.spec.js',
    name: 'THE OLD READING: a garage stands on a slab, so the foundation drops it',
    find: '    const fdnLoops = [...fdnHouse, ...garageOnFdn];',
    with: '    const fdnLoops = [...fdnHouse];',
    test: 'one loop per floor, the foundation under them' },

  { file: 'boneyard-loops.js', spec: 'tests/boneyard.spec.js',
    name: 'DOUBLED: the floor\'s garage loop is added under the one the drafter drew himself',
    find: '    const garageOnFdn = own.some(l => l.garage) ? []',
    with: '    const garageOnFdn = false ? []',
    test: 'not doubled under one the drafter drew' },

  { file: 'boneyard-loops.js', spec: 'tests/boneyard.spec.js',
    name: 'NOT A COPY: the foundation\'s garage loop is the floor\'s object, openings and all',
    find: '.find(g => g.length) || []).map(l => ({ ...l }));',
    with: '.find(g => g.length) || []);',
    test: 'every door and window is a gap in the bone' },

  { file: 'boneyard-loops.js', spec: 'tests/boneyard.spec.js',
    name: 'THE TILT IS IGNORED: the projection stays isometric whatever the page asks',
    find: '    return { x: rx, y: rz * Math.sin(t) - elev * Math.cos(t) };',
    with: '    return { x: rx, y: rz * Math.sin(TILT) - elev * Math.cos(TILT) };',
    test: 'tipped flat the bones are an elevation' },

  { file: 'boneyard-loops.js', spec: 'tests/boneyard.spec.js',
    name: 'the ladder WRAPS: past a plan comes an elevation',
    find: '    TILT_LADDER[Math.max(0, Math.min(TILT_LADDER.length - 1, tiltRung(deg) + steps))];',
    with: '    TILT_LADDER[((tiltRung(deg) + steps) % TILT_LADDER.length + TILT_LADDER.length) % TILT_LADDER.length];',
    test: 'it tips up and down a rung at a time' },

  { file: 'boneyard-loops.js', spec: 'tests/boneyard.spec.js',
    name: 'ISO IS NOT A RUNG: the view the page opens on cannot be stepped back to',
    find: '  const TILT_LADDER = Object.freeze([0, 15, 30, ISO_TILT_DEG, 45, 60, 75, 90]);',
    with: '  const TILT_LADDER = Object.freeze([0, 15, 30, 45, 60, 75, 90]);',
    test: 'it tips up and down a rung at a time' },

  { file: 'BONEYARD.html', spec: 'tests/boneyard.spec.js',
    name: 'the page never tells the layout its tilt: the arrows change a number and nothing else',
    find: '        laid = BL.layout(shown(), angle, w, h, 30, tilt);',
    with: '        laid = BL.layout(shown(), angle, w, h);',
    test: 'it tips up and down a rung at a time' },

  { file: 'BONEYARD.html', spec: 'tests/boneyard.spec.js',
    name: 'an arrow at the end of the ladder stays live and does nothing',
    find: '        document.getElementById(\'tip-up\').disabled = tilt >= 90;',
    with: '        document.getElementById(\'tip-up\').disabled = false;',
    test: 'it tips up and down a rung at a time' },
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
const dirty = execSync('git status --porcelain boneyard-loops.js BONEYARD.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

// THE BASELINE FIRST. A spec that is already red kills every mutant and
// prints a perfect sheet over broken code.
if (run('tests/boneyard.spec.js', null) !== 'passed') {
  console.error('BASELINE RED: tests/boneyard.spec.js fails on an unmutated tree; nothing below would mean anything.');
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
