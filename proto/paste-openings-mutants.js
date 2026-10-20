#!/usr/bin/env node
// MUTATION GATE for what hangs on a pasted wall (tests/paste-openings.spec.js).
//
// Movie, 20 Oct: "can i select ALL on the floor and then paste ALL in the
// boneyard". Three seams: the window re-pointed at the wall's copy, the
// fixture carried at all, and the orphan (a window whose wall is not in the
// paste) left behind.
//
// Run: node proto/paste-openings-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/paste-openings.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'a pasted window still names the wall it left',
    find: "        copy.wallId = wallIds.get(String(raw.wallId));\n",
    with: "",
    test: 'the suite pasted on the BONEYARD brings its window and its toilet, hung on the pasted walls' },
  { file: 'MODEL.html',
    name: 'a fixture is not carried',
    find: "  const NOT_COPIED = new Set(['stair', 'roof', 'roomtag', 'note', 'dimension']);\n",
    with: "  const NOT_COPIED = new Set(['fixture', 'stair', 'roof', 'roomtag', 'note', 'dimension']);\n",
    test: 'the suite pasted on the BONEYARD brings its window and its toilet, hung on the pasted walls' },
  { file: 'MODEL.html',
    name: 'an orphan window is pasted anyway',
    find: "        if (!wallIds.has(String(raw.wallId))) return;\n",
    with: "",
    test: 'a window whose wall is not in the paste stays behind' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4487' } });
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
