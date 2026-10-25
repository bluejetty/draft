#!/usr/bin/env node
// MUTATION GATE for one click in the middle of a wall dimensioning both its
// faces (Movie, 25 Oct: "if the user clicks the middle of a wall it will
// place dims on either side ... one click not 2"). Each row breaks one line,
// runs the one test that should notice, and restores from HEAD.
//
//   node proto/dim-wall-faces-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/dim-wall-faces.spec.js';

const MUTANTS = [
  { file: 'model/15-panels.js',
    name: 'a click in a wall is one point again',
    find: "    const faces = dimWallFacesAt(at);\n",
    with: "    const faces = null;\n",
    test: 'one click in the middle of a wall' },
  { file: 'model/15-panels.js',
    name: 'only the first face is taken',
    find: "      dimPoints.push(...faces.points);\n",
    with: "      dimPoints.push(faces.points[0]);\n",
    test: 'in a string' },
  { file: 'model/15-panels.js',
    name: 'a click on a face takes both faces too',
    find: "      if (!(across > lo + clear && across < hi - clear)) continue;\n",
    with: "      if (!(across > lo - 0.25 && across < hi + 0.25)) continue;\n",
    test: 'a click on a face' },
];


const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4563' } });
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
