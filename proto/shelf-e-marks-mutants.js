#!/usr/bin/env node
// MUTATION GATE for the E marks kept off the shelf (Movie, 22 Oct: "lets take
// off the E1-E4 from the SHELF don't think its needed there"). Each row breaks
// one line, runs the one test that should notice, and restores the file from
// HEAD.
//
//   node proto/shelf-e-marks-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shelf-e-marks.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the shelf draws the E marks as a floor does',
    find: "  const eMarksDrawn = () => (boneyardActive ? [] : (siteMarkRing() || autoElevationCuts()));\n",
    with: "  const eMarksDrawn = () => (siteMarkRing() || autoElevationCuts());\n",
    test: 'on the shelf no E mark is drawn' },
  { file: 'MODEL.html',
    name: 'no E mark is drawn anywhere',
    find: "  const eMarksDrawn = () => (boneyardActive ? [] : (siteMarkRing() || autoElevationCuts()));\n",
    with: "  const eMarksDrawn = () => [];\n",
    test: 'on the shelf no E mark is drawn' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4530' } });
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
