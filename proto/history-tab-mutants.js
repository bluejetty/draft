#!/usr/bin/env node
// MUTATION GATE for the UNDO / REDO tab (Movie, 20 Oct):
// "a UNDO / REDO tab under the NOTES/ CALC ... click on each one ... it will
// change the model to that version". Each row breaks one line of MODEL.html,
// runs the one test that should notice, and restores the file from HEAD.
//
//   node proto/history-tab-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/history-tab.spec.js';

const MUTANTS = [
  { file: 'model/17-boot-save.js',
    name: 'an edit makes no version',
    find: "    historyNoteEdit();\n    if (dirty) return;\n",
    with: "    if (dirty) return;\n",
    test: 'UNDO / REDO hangs under NOTES / CALC and lists the session\'s versions, newest first, CURRENT on top' },
  { file: 'model/16-gestures-undo.js',
    name: 'the newest version is not called CURRENT',
    find: "      what.textContent = i === n - 1 ? `CURRENT \\u00B7 ${entry.label}` : entry.label;\n",
    with: "      what.textContent = entry.label;\n",
    test: 'UNDO / REDO hangs under NOTES / CALC and lists the session\'s versions, newest first, CURRENT on top' },
  { file: 'model/16-gestures-undo.js',
    name: 'a jump leaves the cursor where it was',
    find: "      versions.cursor = index;\n",
    with: "",
    test: 'a version clicked goes on the sheet, whole; CURRENT puts the newest back' },
  // NOT A ROW: the dedupe in historyTake (`if (at && at.json === json) return;`)
  // guards a dirty mark that changed nothing, and no gesture on the page
  // makes one today -- every release checks `moved` before it marks. It
  // stays as a defence; a row on it would only ever survive.
  { file: 'model/16-gestures-undo.js',
    name: 'an edit on an older version keeps the versions after it',
    find: "    versions.entries.length = versions.cursor + 1;\n",
    with: "",
    test: 'drawing on an older version drops the versions after it' },
  { file: 'model/16-gestures-undo.js',
    name: 'Ctrl+Shift+Z steps nowhere',
    find: "      if (versions.cursor < versions.entries.length - 1) { e.preventDefault(); historyStep(1); }\n",
    with: "",
    test: 'Ctrl+Z with no fine-grained undo left steps back a version; Ctrl+Shift+Z steps forward' },
  { file: 'model/16-gestures-undo.js',
    name: 'Ctrl+Z with nothing to undo does nothing',
    find: "        if (versions.cursor > 0) { e.preventDefault(); historyStep(-1); }\n",
    with: "",
    test: 'Ctrl+Z with no fine-grained undo left steps back a version; Ctrl+Shift+Z steps forward' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4522' } });
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
