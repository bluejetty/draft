#!/usr/bin/env node
// MUTATION GATE for DIMENSION ending on one press or the right button
// (Movie, 23 Oct). Each row breaks one line, runs the one test that should
// notice, and restores the file from HEAD.
//
//   node proto/dim-once-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/dim-once.spec.js';

const MUTANTS = [
  { file: 'model/14-promotion-tools.js',
    name: 'ENTER and SPACE end nothing on a dimension',
    find: "    if (dimInHand()) return dimOnceEnds();\n",
    with: "    if (dimInHand()) return true;\n",
    test: 'SPACE once ends the points' },
  { file: 'model/15-panels.js',
    name: 'finishing takes the last line back, as the double-click does',
    find: "    if (dimPlacing) return finishDimString();\n    if (endDimString()) paint();\n    return true;\n",
    with: "    if (dimPlacing) { takeBackDoubleClickLine(); return finishDimString(); }\n    if (endDimString()) paint();\n    return true;\n",
    test: 'SPACE once ends the points' },
  { file: 'model/16-gestures-undo.js',
    name: 'the right button cancels the dimension, as it did',
    find: "        if (dimInHand()) { dimOnceEnds(); stripRefresh(); paint(); }\n        else if (cancelGestures()) { stripRefresh(); paint(); }\n",
    with: "        if (cancelGestures()) { stripRefresh(); paint(); }\n",
    test: 'the RIGHT button ends the points' },
  { file: 'model/16-gestures-undo.js',
    name: 'ESC no longer throws the points away',
    find: "    dimPoints = [];\n    dimPlacing = false;\n    rulerFrom = null;\n",
    with: "    rulerFrom = null;\n",
    test: 'ESC alone abandons the string' },
  { file: 'model/15-panels.js',
    name: 'the last end places nothing at the mouse (Movie, 25 Oct)',
    find: "    if (dimPlacing && cursorWorld && dimString(dimPoints, cursorWorld).length) {\n",
    with: "    if (false) {\n",
    test: 'one line there, and done' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4540' } });
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
