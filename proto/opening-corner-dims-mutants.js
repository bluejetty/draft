// DOES THE OPENING-TO-THE-CORNERS SPEC CATCH A READOUT THAT LIES?
//
// Movie, 15 Oct: "with windows and doors when you click them can you show
// their dimensions to the corners as well so the user can know how far they
// should move it".
//
// A readout driven by the selection has a particular way of being wrong: it
// draws when it should not, it does not clear when the pick is dropped, or it
// prints a number that is nearly right. The last is the dangerous one -- the
// centre of an opening stands half a wall thickness off the stored line, so
// a corner-to-centre measurement taken straight reads 5.0052 where a tape
// reads 5. Each of those is a mutant here.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-opening-to-the-corners.spec.js';

const MUTANTS = [
  { file: 'model/06-selection-pick.js',
    name: 'the readout is never drawn: a picked opening says nothing',
    find: "    if (selection.length !== 1 || selection[0].type !== 'fenestration') { report(); return; }",
    with: '    if (true) { report(); return; }',
    test: 'clicking a window says how far it is from each corner' },

  { file: 'model/06-selection-pick.js',
    name: 'measured corner-to-centre STRAIGHT, so the two numbers no longer '
      + 'add up to the wall',
    find: '      const feet = Math.abs(i === 0 ? along : run - along);',
    with: '      const feet = Math.hypot(centre.x - corner.x, centre.z - corner.z);',
    test: 'clicking a window says how far it is from each corner' },

  { file: 'model/06-selection-pick.js',
    name: 'any selection gets it, so picking a WALL prints two numbers about '
      + 'an opening nobody chose',
    find: "    if (selection.length !== 1 || selection[0].type !== 'fenestration') { report(); return; }\n"
      + '    const opening = selection[0].item;',
    with: '    if (selection.length !== 1) { report(); return; }\n'
      + "    const opening = selection[0].type === 'fenestration' ? selection[0].item\n"
      + "      : (drawing.fenestrations || [])[0];",
    test: 'a wall picked instead says nothing' },

  { file: 'model/03-plan-paint.js',
    name: 'drawn from inside paintSelection, which returns early: the numbers '
      + 'never clear when the pick is dropped',
    find: '        openingCornerDims(ctx, toS);\n'
      + '        // AFTER the selection, so a hovered corner of a selected wall reads as',
    with: '        // AFTER the selection, so a hovered corner of a selected wall reads as',
    test: 'dropping the pick takes the numbers with it' },

  { file: 'model/06-selection-pick.js',
    name: 'only the near corner is reported, so the room on the other side is '
      + 'never shown',
    find: '    [wall.start, wall.end].forEach((corner, i) => {',
    with: '    [wall.start].forEach((corner, i) => {',
    test: 'clicking a window says how far it is from each corner' },

  { file: 'model/06-selection-pick.js',
    name: 'the readout is painted once and never follows the slide',
    find: '      shownDims.push({ corner: i === 0 ? \'start\' : \'end\', ft: Math.round(feet * 1e4) / 1e4 });',
    with: '      shownDims.push({ corner: i === 0 ? \'start\' : \'end\', ft: 5 });',
    test: 'and the numbers follow it as it slides' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4357' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline: the restore is
// `git checkout -- <file>`, so uncommitted work in a mutated file is
// destroyed the first time a mutant touches it, and a guard that fires only
// afterwards lets you walk away believing the gate is running.
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

console.log(`\n${killed}/${ran} mutations caught`
  + (ambiguous ? `, ${ambiguous} skipped` : ''));
process.exit(killed === ran && !ambiguous ? 0 : 1);
