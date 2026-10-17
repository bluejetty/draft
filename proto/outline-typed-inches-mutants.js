#!/usr/bin/env node
// MUTATION GATE for an outline edge typed in inches
// (tests/outline-typed-inches.spec.js).
//
// Movie, 17 Oct: "its not allowing me to complete when i type in text 5-2
// ENTER ... its in toy mode ... but no way to turn it off but to enter
// precise numbers". One seam: the OUTLINE box promoting the board for a
// number TOY cannot hold, instead of refusing it. Two rows: the old refusal
// put back, and the promotion made a no-op.
//
// Run: node proto/outline-typed-inches-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/outline-typed-inches.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the outline box refuses inches again',
    find: "        const promoted = promoteForNumber(toyCouldMakeLength(feet), said);\n",
    with: "        if (!toyCouldMakeLength(feet)) { stripMessage.textContent = 'the outline goes in whole feet'; lengthBox.blur(); return; }\n        const promoted = false;\n",
    test: 'on TOY, 5-2 typed for an outline edge moves the board to DRAFTING and makes the edge 5\'-2"' },
  { file: 'MODEL.html',
    name: 'the outline box keeps the number and leaves the board on TOY',
    find: "        const promoted = promoteForNumber(toyCouldMakeLength(feet), said);\n",
    with: "        const promoted = false;\n",
    test: 'on TOY, 5-2 typed for an outline edge moves the board to DRAFTING and makes the edge 5\'-2"' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4451' } });
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
