// DOES THE BULLSEYE-SEED SPEC CATCH A CORNER THAT IS NOT THERE?
//
// Movie, 15 Oct: "when they select to DRAW THE OUTLINE (at the drive thru)
// when the drivethru window disappears and it goes to the model space screen,
// select the first point for them on the bullseye (registration point), and
// allow them to proceed from that point."
//
// One corner is the whole feature, which makes it the easiest kind of thing
// to get subtly wrong: a seed that is never placed, one placed for every
// arming instead of the press he actually made, one at the world origin on a
// drawing whose bullseye has been moved, one placed where no bullseye is
// painted at all, and one written a line too early and swept away by the
// arming that was supposed to carry it. Each of those is a mutant here, and
// each of them draws a house that looks right until you count its corners.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-outline-starts-on-the-bullseye.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: 'no corner is seeded at all: the press arms the trace and leaves '
      + 'the sheet empty, as it did before',
    find: '    outlineCorners = bullseye ? [{ x: bullseye.x, z: bullseye.z }] : [];',
    with: '    outlineCorners = [];',
    test: 'the drive-thru press leaves the first corner on the bullseye' },

  { file: 'model/10-tracking-garage.js',
    name: 'every arming seeds a corner, so a drafter still choosing a type '
      + 'has a point on his drawing he never placed',
    find: '    const bullseye = fromLink ? gridDatum() : null;',
    with: '    const bullseye = gridDatum();',
    test: 'a type picked at the window seeds nothing either' },

  { file: 'model/10-tracking-garage.js',
    name: 'the seed is the world origin rather than the bullseye: on a '
      + 'drawing whose datum has been moved, the corner is nowhere',
    find: '    const bullseye = fromLink ? gridDatum() : null;',
    with: '    const bullseye = fromLink ? { x: 0, z: 0 } : null;',
    test: 'the seed follows the datum, it is not the world origin' },

  { file: 'model/10-tracking-garage.js',
    name: 'a drawing with NO bullseye painted gets a corner anyway, placed '
      + 'where nothing is drawn for it to stand on',
    find: '    outlineCorners = bullseye ? [{ x: bullseye.x, z: bullseye.z }] : [];',
    with: '    outlineCorners = [{ x: bullseye?.x || 0, z: bullseye?.z || 0 }];',
    test: 'a drawing with no bullseye painted gets no corner' },

  { file: 'model/10-tracking-garage.js',
    name: 'the seed is written before the arming, and the arming sweeps it: '
      + 'the one ordering the comment above it promises',
    // THE SAME FAULT, WRITTEN FORWARD. Moving the two lines above setTool is
    // not one contiguous edit -- eighty lines of comment sit between them --
    // so the mutation arms the tool again AFTER the seed instead, which runs
    // the listener that empties outlineCorners. Same sweep, same empty list,
    // one string to swap.
    find: '    outlineCorners = bullseye ? [{ x: bullseye.x, z: bullseye.z }] : [];\n'
      + '    sayTraceThe(picked);',
    with: '    outlineCorners = bullseye ? [{ x: bullseye.x, z: bullseye.z }] : [];\n'
      + "    setTool('outline');\n"
      + '    sayTraceThe(picked);',
    test: 'the drive-thru press leaves the first corner on the bullseye' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4372' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

{
  const clean = run(null);
  if (clean !== 'passed') {
    console.log('REFUSING TO RUN: the spec is already failing before any mutant '
      + 'is applied.\nEvery mutant would read as KILLED and the sheet would be a '
      + 'lie. Fix the spec first.');
    process.exit(1);
  }
  console.log('baseline: the unmutated spec passes\n');
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  if (!before.includes(m.find)) {
    console.log(`  SKIPPED   ${m.name}  (anchor not found — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check — re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
