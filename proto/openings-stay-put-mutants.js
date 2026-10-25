#!/usr/bin/env node
// MUTATION GATE for openings staying put when a wall's end is dragged
// (Movie, 23 Oct). Each row breaks one line, runs the one test that should
// notice, and restores the file from HEAD.
//
//   node proto/openings-stay-put-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/openings-stay-put.spec.js';

const MUTANTS = [
  { file: 'model/16-gestures-undo.js',
    name: 'the openings ride the start, as before',
    find: "          if (board !== 'toy') keepOpeningsPut(md, grabbed);\n",
    with: "",
    test: 'the start dragged in 4 ft' },
  { file: 'model/10-tracking-garage.js',
    name: 'an opening off the wall is kept',
    find: "      if (off - half < -1e-6 || off + half > len + 1e-6) {\n",
    with: "      if (false) {\n",
    test: 'the start dragged in 4 ft' },
  { file: 'model/10-tracking-garage.js',
    name: 'only an opening whose centre is off the wall goes',
    find: "      if (off - half < -1e-6 || off + half > len + 1e-6) {\n",
    with: "      if (off < -1e-6 || off > len + 1e-6) {\n",
    test: 'the end dragged in 7 ft' },
  { file: 'model/10-tracking-garage.js',
    name: 'UNDO leaves the new offsets',
    find: "    return [...(edits.length ? [{ kind: 'props', edits }] : []), ...gone];\n",
    with: "    return gone;\n",
    test: 'the start dragged in 4 ft' },
  { file: 'model/16-gestures-undo.js',
    name: 'UNDO leaves the deleted deleted',
    find: "        undoStack.push(settledOpenings.length ? { kind: 'batch', steps: [moveStep, ...settledOpenings] } : moveStep);\n",
    with: "        undoStack.push(moveStep);\n",
    test: 'the start dragged in 4 ft' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4536' } });
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
