#!/usr/bin/env node
// MUTATION GATE for OPEN SUITE on the BONEYARD (tests/shelf-suite.spec.js).
//
// Movie, 21 Oct: "can we also have a OPEN SUITE -where a suite will open in the
// shelf and i can put all the SUITES in the same file as the SHELL and go into
// the SHELFS if i need to edit them".
//
// Run: node proto/open-suite-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shelf-suite.spec.js';
const MUTANTS = [
  { file: 'model/05-props-shelves-rail.js', name: 'no OPEN SUITE button',
    find: "    openRow.append(openShelf);\n",
    with: "",
    test: 'OPEN SUITE opens' },
  { file: 'model/13-suites-trim-follow.js', name: 'the file picked is read and dropped',
    find: "    if (source) editOnShelf({ name: file.name.replace(/\\.[^.]+$/, ''), source });",
    with: "    if (source) {}",
    test: 'OPEN SUITE opens' },
  { file: 'model.css', name: 'its line sits beside the head: the shelves jump under a rename',
    find: "  .lv-card[data-boneyard] { flex-wrap:wrap; }\n",
    with: "",
    test: 'renames' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4510' } });
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
