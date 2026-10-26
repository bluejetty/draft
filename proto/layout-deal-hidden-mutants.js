#!/usr/bin/env node
// MUTATION GATE for DEAL SHEETS hidden over a dealt set
// (tests/layout-compose.spec.js).
//
// Movie, 26 Oct: "if they accidentally or misunderstand what RE-DEAL means it
// will delete all their work placing the viewports" -- "Hide the button: it
// goes away after the first deal, and you add new views by hand with + ADD
// VIEWPORT". Two seams: the button hidden, and the verb refusing over a
// sheet with a viewport on it.
//
// Run: node proto/layout-deal-hidden-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-compose.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'DEAL SHEETS stays over a dealt set',
    find: "    deal.hidden = this.state.viewports.length > 0;\n",
    with: "    deal.hidden = false;\n",
    test: 'a sheet with a viewport on it offers no DEAL; with the last one deleted it is back and deals the set without asking' },
  { file: 'LAYOUT.html',
    name: 'the verb deals over a sheet with a viewport on it',
    find: "    if (!this._saved || this.state.viewports.length > 0) return;\n",
    with: "    if (!this._saved) return;\n",
    test: 'a sheet with a viewport on it offers no DEAL; with the last one deleted it is back and deals the set without asking' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4723' } });
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
