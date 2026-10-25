#!/usr/bin/env node
// MUTATION GATE for the SELECT keys' seat (Movie, 24 Oct): centred on the
// row the north arrow and the AUTO DIMS / HAND DIMS chips stand on, and
// never over the strip's words. Each row breaks one line, runs the test that
// should notice, and restores from HEAD.
//
//   node proto/select-bar-seat-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/select-bar-seat.spec.js';

const MUTANTS = [
  { file: 'model/03-plan-paint.js',
    name: 'the keys stay hung under the top bar, over the words',
    find: "    seatSelectBar();\n    if (!northDock) return;\n",
    with: "    if (!northDock) return;\n",
    test: 'centred on the AUTO DIMS row' },
  { file: 'model/03-plan-paint.js',
    name: 'the keys sit a row low',
    find: "    const mid = canvas.getBoundingClientRect().top + northCentre().y - 28 + DOCK_CHIP / 2;\n",
    with: "    const mid = canvas.getBoundingClientRect().top + northCentre().y + DOCK_CHIP / 2;\n",
    test: 'centred on the AUTO DIMS row' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4558' } });
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
