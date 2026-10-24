#!/usr/bin/env node
// MUTATION GATE for the click again (Movie, 24 Oct): "if a user clicks and
// the wrong item (if they overlap) is selected the first time, allow the user
// to make a 2nd click and it will select the 'underneath' item ... and then
// cycle back to the first one". Each row breaks one line, runs the test that
// should notice, and restores from HEAD.
//
//   node proto/pick-under-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/pick-under.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'a click again takes the top one again',
    find: "    if (now >= 0 && hits.length > 1) {\n",
    with: "    if (false) {\n",
    test: 'step down' },
  { file: 'MODEL.html',
    name: 'the last one under is the end, no way round to the top',
    find: "        const k = (now + i) % hits.length;\n",
    with: "        const k = Math.min(now + i, hits.length - 1);\n",
    test: 'step down' },
  { file: 'MODEL.html',
    name: 'a press on what is in hand, let go, does nothing',
    find: "      } else if (e && !e.shiftKey && activeTool !== 'assembly') {\n        // A PRESS ON WHAT IS ALREADY IN HAND",
    with: "      } else if (false) {\n        // A PRESS ON WHAT IS ALREADY IN HAND",
    test: 'step down' },
  { file: 'MODEL.html',
    name: 'a click anywhere steps down, not only on the same spot',
    find: "    const again = lastPick && Math.hypot(sx - lastPick.sx, sy - lastPick.sy) <= PICK_AGAIN_PX;\n",
    with: "    const again = !!lastPick;\n",
    test: 'somewhere else' },
  { file: 'MODEL.html',
    name: 'nothing says which of how many',
    find: "    if (under.of > 1) sayOnStrip(",
    with: "    if (false) sayOnStrip(",
    test: 'step down' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4559' } });
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
