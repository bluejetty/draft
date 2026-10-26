#!/usr/bin/env node
// MUTATION GATE for a BONEYARD shelf on a sheet (tests/layout-sheet-edit.spec.js).
//
// Movie, 26 Oct: "i'd like to be able to add a viewport from a 'SHELF'
// drawing so i can show the suites". Four seams: the SHELVES group in the
// add list, only shelves that hold walls, the frame on the suite, and the
// shelf's viewport read back.
//
// Run: node proto/layout-shelf-viewport-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-sheet-edit.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'a shelf is framed on everything lying on it',
    find: "      if (levelId < 0) {\n        const pts = ",
    with: "      if (false) {\n        const pts = ",
    test: '+ ADD VIEWPORT offers a SHELF with a drawing on it, and puts it on the sheet' },
  { file: 'LAYOUT.html',
    name: 'no SHELVES in the add list',
    find: "    return [['PLANS', plans], ['SHELVES', shelves], ",
    with: "    return [['PLANS', plans], ['SHELVES', []], ",
    test: '+ ADD VIEWPORT offers a SHELF with a drawing on it, and puts it on the sheet' },
  { file: 'LAYOUT.html',
    name: 'an empty shelf is offered too',
    find: "      .filter(shelf => (Array.isArray(saved.walls) ? saved.walls : []).some(w => w?.levelId === -shelf.id))\n",
    with: "",
    test: '+ ADD VIEWPORT offers a SHELF with a drawing on it, and puts it on the sheet' },
  { file: 'LAYOUT.html',
    name: 'a shelf viewport falls off on reading the file back',
    find: "    const viewLevelIds = new Set([...levelIds, ...this._shelfLevels.map(level => level.id)]);\n",
    with: "    const viewLevelIds = levelIds;\n",
    test: '+ ADD VIEWPORT offers a SHELF with a drawing on it, and puts it on the sheet' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4655' } });
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
