#!/usr/bin/env node
// MUTATION GATE for the run's ending (Movie, 20 Oct): "1 click makes a NODE,
// if DOUBLE click it closes.. also make the ENTER and SPACE act in the same
// way". Each row breaks one line of MODEL.html, runs the one test that should
// notice, and restores the file from HEAD.
//
//   node proto/series-close-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/series-close.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'a double-click leaves the run in hand',
    find: "    if (!drawsRun() || !drawStart || modalUp()) return;\n    e.preventDefault();\n    endDrawRun();\n",
    with: "    if (!drawsRun() || !drawStart || modalUp()) return;\n    e.preventDefault();\n",
    test: 'a double-click ends a WALL run with its point as the last corner' },
  { file: 'MODEL.html',
    name: 'a second press is one more corner, never the end',
    find: "    if (twice && drawsRun() && drawStart) { endDrawRun(); return true; }\n",
    with: "",
    test: 'ENTER or SPACE once is a corner at the cursor, twice ends the LINE run' },
  { file: 'MODEL.html',
    name: 'ENTER and SPACE need a run already in hand',
    find: "    if (run) { drawPress(cursorWorld); return true; }\n",
    with: "    if (run && drawStart) { drawPress(cursorWorld); return true; }\n",
    test: 'ENTER or SPACE once is a corner at the cursor, twice ends the LINE run' },
  { file: 'MODEL.html',
    name: 'two presses any time apart count as twice',
    find: "    const twice = seriesKeyLast.key === key && now - seriesKeyLast.at < SERIES_TWICE_MS && still;\n",
    with: "    const twice = seriesKeyLast.key === key && still;\n",
    test: 'a second press after a pause, or after the cursor moved on, is not an end' },
  { file: 'MODEL.html',
    name: 'a quick second press ends the run wherever the cursor went',
    find: "    const twice = seriesKeyLast.key === key && now - seriesKeyLast.at < SERIES_TWICE_MS && still;\n",
    with: "    const twice = seriesKeyLast.key === key && now - seriesKeyLast.at < SERIES_TWICE_MS;\n",
    test: 'a second press after a pause, or after the cursor moved on, is not an end' },
  { file: 'MODEL.html',
    name: 'SPACE in a box lands a corner',
    find: "    if (e.key !== ' ' || e.repeat || !drawsRun() || modalUp()) return;\n    const t = e.target;\n    if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return;\n",
    with: "    if (e.key !== ' ' || e.repeat || !drawsRun() || modalUp()) return;\n",
    test: 'SPACE typed in the LENGTH box is a space, not a corner' },
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
