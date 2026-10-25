#!/usr/bin/env node
// MUTATION GATE for CTRL+A (Movie, 22 Oct: "ok lets do the CTRL-A (select
// all) i just had a use for it"). Each row breaks one line, runs the one test
// that should notice, and restores the file from HEAD.
//
//   node proto/select-all-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/select-all.spec.js';

const MUTANTS = [
  { file: 'model/16-gestures-undo.js',
    name: 'CTRL+A is not heard',
    find: "    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {\n      if (!drawing || modalUp() || activeCut()) return;\n",
    with: "    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {\n      return;\n",
    test: 'CTRL+A selects everything on the level' },
  { file: 'model/06-selection-pick.js',
    name: 'CTRL+A ignores the kind picked',
    find: "    boxShapes(selectionMode === 'window-all').forEach(({ type, item }) =>\n      withGroup({ type, item })",
    with: "    boxShapes(selectionMode === 'window-all').forEach(({ type, item }) =>\n      (selectFilter === 'all' ? withGroup({ type, item }) : [{ type, item }])",
    test: 'CTRL+A selects everything on the level' },
  { file: 'model/06-selection-pick.js',
    name: 'CTRL+A never reaches the other levels',
    find: "    boxShapes(selectionMode === 'window-all').forEach(",
    with: "    boxShapes(false).forEach(",
    test: 'under ALL LEVELS, CTRL+A reaches every level' },
  { file: 'model/06-selection-pick.js',
    name: 'CTRL+A always reaches every level',
    find: "    boxShapes(selectionMode === 'window-all').forEach(",
    with: "    boxShapes(true).forEach(",
    test: 'under ALL LEVELS, CTRL+A reaches every level' },
  { file: 'model/16-gestures-undo.js',
    name: 'a plain A selects all too',
    find: "    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {\n      if (!drawing || modalUp() || activeCut()) return;\n",
    with: "    if (!e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {\n      if (!drawing || modalUp() || activeCut()) return;\n",
    test: 'a plain A is still SHAPE' },
  { file: 'model/16-gestures-undo.js',
    name: 'CTRL+A typed in a box selects all',
    find: "    if (typing) return;\n    if (e.key === '0') { fit(); paint(); }\n    // CTRL+A SELECTS ALL",
    with: "    if (typing && e.key !== 'a') return;\n    if (e.key === '0') { fit(); paint(); }\n    // CTRL+A SELECTS ALL",
    test: 'CTRL+A typed in a box is the box' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4528' } });
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
