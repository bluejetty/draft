#!/usr/bin/env node
// MUTATION GATE for the page row's order (tests/boneyard.spec.js, the tab
// test, and tests/model-drivethru.spec.js's bar test).
//
// Movie, 17 Oct: "on the bottom left area where it says PROJECT MODEL
// WIREFRAME EXT FINISH can you put MODEL at the right of that EXT FINISH
// like this PROJECT WIREFRAME EXT FINISH MODEL". One table in shell-bars.js
// sets the order on every page; one row here puts MODEL back where it was
// and asks whether the specs notice.
//
// Run: node proto/model-chip-last-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/boneyard.spec.js';

const MUTANTS = [
  { file: 'shell-bars.js',
    name: 'MODEL goes back to second in the row',
    find: "    Object.freeze({ id: 'boneyard', row: 'page', label: 'BONEYARD', labelRough: 'WIREFRAME',",
    with: "    Object.freeze({ id: 'model', row: 'page', label: 'MODEL', href: './MODEL.html',\n"
      + "      title: 'The model: where the house is drawn', here: 'The model \\u2014 you are here' }),\n"
      + "    Object.freeze({ id: 'boneyard', row: 'page', label: 'BONEYARD', labelRough: 'WIREFRAME',",
    test: 'the tab sits between PROJECT and EXT. FINISH, named for the skin' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4410' } });
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
