#!/usr/bin/env node
// MUTATION GATE for a selected stair held by its corner
// (tests/stair-corner-grab.spec.js).
//
// Movie, 26 Oct, the one snap rule: whole-thing drags are held by the
// nearest own corner within a node's reach, cyan before the press. Four
// seams: the corner taken, its catch, the cyan ring before the press, and
// Ctrl switching the catch off.
//
// Run: node proto/stair-corner-grab-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-corner-grab.spec.js';

const MUTANTS = [
  { file: 'model/16-gestures-undo.js',
    name: 'the press takes no corner',
    find: "        grab: corner ? { x: corner.x, z: corner.z } : at, corner,\n",
    with: "        grab: at, corner: null,\n",
    test: 'lands on it exactly' },
  { file: 'model/16-gestures-undo.js',
    name: 'the corner catches nothing',
    find: "            const hit = pointCatch(held, md.magnet);\n",
    with: "            const hit = null;\n",
    test: 'lands on it exactly' },
  { file: 'model/10-tracking-garage.js',
    name: 'no cyan ring before the press',
    find: "      ? selection.filter(e => e.type === 'stair').map(e => stairCornerAt(e.item, cursorWorld)).find(Boolean) : null;\n",
    with: "      ? null : null;\n",
    test: 'rings cyan' },
  { file: 'model/16-gestures-undo.js',
    name: 'Ctrl held still catches',
    find: "          if (md.corner && snapLive() && board !== 'toy') {\n",
    with: "          if (md.corner && board !== 'toy') {\n",
    test: 'Ctrl held' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4776' } });
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
