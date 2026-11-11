#!/usr/bin/env node
// MUTATION GATE for room tags on the SITE / ROOF sheets (jb, 10 Nov: "it
// isn't showing the room tag on the construction plan"). Each row breaks
// one line, runs the one test that should notice, and restores the file
// from HEAD.
//
//   node proto/room-tag-on-sheet-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-site-room-tag.spec.js';
const TEST = 'the SITE PLAN sheet prints the level';
const MUTANTS = [
  { file: 'layout-plan.js',
    name: 'the level marks leave the room tags out, as before',
    find: "      roomTags,\n      roomTagEnv: roomTagEnv(saved, false),\n",
    with: "      roomTags: [],\n      roomTagEnv: roomTagEnv(saved, false),\n",
    test: 'the SITE PLAN sheet prints the level' },
  { file: 'layout-plan.js',
    name: 'the level marks compose with no tag painter',
    find: "      roomTags,\n      roomTagEnv: roomTagEnv(saved, false),\n",
    with: "      roomTags,\n      roomTagEnv: null,\n",
    test: 'the SITE PLAN sheet prints the level' },
  { file: 'layout-plan.js',
    name: 'the sheet prints a metric area in square feet',
    find: "    areaLabel: sqFt => (saved?.units === 'metric'\n      ? `${(Math.round(sqFt * 0.09290304 * 10) / 10).toLocaleString('en-US')} m\\u00b2`\n",
    with: "    areaLabel: sqFt => (false\n      ? `${(Math.round(sqFt * 0.09290304 * 10) / 10).toLocaleString('en-US')} m\\u00b2`\n",
    test: 'the SITE PLAN sheet prints the level' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
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
      + 'is applied. Fix the spec first.');
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
  let result = run(m.test || TEST);
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
