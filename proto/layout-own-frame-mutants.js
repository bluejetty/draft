#!/usr/bin/env node
// MUTATION GATE for a sheet's own titleblock (tests/layout-titleblock.spec.js).
//
// Movie, 26 Oct: "allow the user to change the main TB, but also allow a
// little checkbox to make the page allowed to use a different TB type ...
// the BAND version on the SITE PLAN and the SIDE version on the other plans".
// Four seams: the sheet wearing its own, the menu setting the sheet's not
// the set's, the file keeping it, and a re-deal keeping it.
//
// Run: node proto/layout-own-frame-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-titleblock.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'every sheet wears the main frame',
    find: "      .frameOnSheet(this._ownFrame(sheet) || this.state.titleblock, this.state.paperKey, this.state.orientation);\n",
    with: "      .frameOnSheet(this.state.titleblock, this.state.paperKey, this.state.orientation);\n",
    test: 'THIS SHEET ONLY gives one sheet its own frame; the rest keep the main one' },
  { file: 'LAYOUT.html',
    name: 'the menu always sets the main frame',
    find: "        this._frameForSheet(), id => (own ? this._setOwnFrame(id) : this._setTitleblock(id)));\n",
    with: "        this._frameForSheet(), id => this._setTitleblock(id));\n",
    test: 'THIS SHEET ONLY gives one sheet its own frame; the rest keep the main one' },
  { file: 'drawing-format.js',
    name: 'the file forgets a sheet\'s own frame',
    find: "            ? { titleblock: sheet.titleblock } : {}) })),\n",
    with: "            ? {} : {}) })),\n",
    test: 'THIS SHEET ONLY gives one sheet its own frame; the rest keep the main one' },
  { file: 'LAYOUT.html',
    name: 'a re-deal drops the sheet\'s own frame',
    find: "      sheets: sheetPlan.map(({ title }) => ({ title, ...(ownByTitle.has(title) ? { titleblock: ownByTitle.get(title) } : {}) })),\n",
    with: "      sheets: sheetPlan.map(({ title }) => ({ title })),\n",
    test: 'THIS SHEET ONLY gives one sheet its own frame; the rest keep the main one' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4664' } });
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
