#!/usr/bin/env node
// MUTATION GATE for the run's ending: a double-click ends it (Movie, 20
// Oct) and so do ENTER, SPACE and the right click, once (jb, 9 Nov, "how
// AUTOCAD did it"). Each row breaks one line, runs the one test that should
// notice, and restores the file from HEAD.
//
//   node proto/series-close-mutants.js
//
// NOT A ROW: SPACE typed in the LENGTH box. The box keeps its keys to
// itself, so the handler's own INPUT guard never sees one -- the spec pins
// the behaviour, but no mutation here could reach it.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/series-close.spec.js';

const MUTANTS = [
  { file: 'model/14-promotion-tools.js',
    name: 'a double-click leaves the run in hand',
    find: "    if (!drawsRun() || !drawStart) return;\n    e.preventDefault();\n    endDrawRun();\n",
    with: "    if (!drawsRun() || !drawStart) return;\n    e.preventDefault();\n",
    test: 'a double-click ends a WALL run with its point as the last corner' },
  { file: 'model/14-promotion-tools.js',
    name: 'ENTER and SPACE leave the run in hand',
    find: "    if (drawsRun() && drawStart) { endDrawRun(); return true; }\n",
    with: "",
    test: 'ENTER, SPACE or the right button once ends the LINE run' },
  { file: 'model/14-promotion-tools.js',
    name: 'ENTER puts a corner at the cursor again, as it did before 9 Nov',
    find: "    if (drawsRun() && drawStart) { endDrawRun(); return true; }\n",
    with: "    if (drawsRun() && drawStart) { drawPress(cursorWorld); return true; }\n",
    test: 'ENTER, SPACE or the right button once ends the LINE run' },
  { file: 'model/16-gestures-undo.js',
    name: 'the right button cancels the run instead of ending it',
    find: "        if (finishOrRepeat()) { stripRefresh(); paint(); }\n",
    with: "        if (cancelGestures()) { stripRefresh(); paint(); }\n",
    test: 'ENTER, SPACE or the right button once ends the LINE run' },
  { file: 'model/14-promotion-tools.js',
    name: 'ENTER with nothing in hand starts a run at the cursor',
    find: "    if (drawsRun() && drawStart) { endDrawRun(); return true; }\n",
    with: "    if (drawsRun() && drawStart) { endDrawRun(); return true; }\n    if (drawsRun() && cursorWorld) { drawPress(cursorWorld); return true; }\n",
    test: 'ENTER with nothing in hand puts no corner down' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4512' } });
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
