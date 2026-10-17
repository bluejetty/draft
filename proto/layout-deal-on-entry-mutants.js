#!/usr/bin/env node
// MUTATION GATE for the entry deal on CONSTRUCTION LAYOUT
// (tests/layout-deal-on-entry.spec.js).
//
// Movie, 17 Oct: "if the user created a house already, when they go into the
// CONSTRUCTION LAYOUT area, can you automatically DEAL the sheets when they
// enter so they all pop up" ... "check to make sure the sheets haven't been
// dealt yet first, if they have been dealt already don't do anything" ...
// "if its blank and there is a house in the model space, make a DEAL". Three
// halves of one rule, one row each. LAYOUT.html is page code with no engine
// harness, so every row here is the page's.
//
// Run: node proto/layout-deal-on-entry-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-deal-on-entry.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'nothing is dealt on entry: the flag is the only way in again',
    find: '      if (this.state.auto || this._blankOverHouse()) this._composeDefaultSet();\n',
    with: '      if (this.state.auto) this._composeDefaultSet();\n',
    test: 'a blank layout over a built house is dealt on entry, with no press and no dialog' },
  { file: 'LAYOUT.html',
    name: 'a sheet with a hand on it is dealt over on every visit',
    find: '    return this.state.viewports.length === 0 && this._levelsWithWalls().length > 0;\n',
    with: '    return this._levelsWithWalls().length > 0;\n',
    test: 'sheets already dealt or arranged by hand are left exactly as saved, and nothing is written' },
  // NO ROW FOR THE WALLS HALF OF _blankOverHouse. With the walls test taken
  // out, a drawing with no walls still deals nothing: the composer itself
  // places no view on an empty drawing and writes nothing back, so the guard
  // is belt and braces and a row for it would survive on the first run. The
  // spec's third test still pins the behaviour the drafter sees.
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4406' } });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`, { cwd: ROOT }).toString().trim();
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
  const caught = result === 'failed';
  if (caught) killed += 1;
  console.log(`  ${caught ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS (anchor missing)` : ''));
process.exit(killed === MUTANTS.length ? 0 : 1);
