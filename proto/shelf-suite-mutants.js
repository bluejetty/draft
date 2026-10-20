#!/usr/bin/env node
// MUTATION GATE for the BONEYARD as a mini model area: shelves renamed, a
// shelf saved as its own SUITE .draft, a suite put back on a shelf
// (tests/shelf-suite.spec.js).
//
// Movie, 20 Oct: "ALLOW users to use the BONEYARD - as a little mini model
// area and they can independanatly SAVE whatever is in there as a SUITE. (but
// a draft file)" -- "if i double click on SHELF1 name it will allow me to
// rename it".
//
// Run: node proto/shelf-suite-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shelf-suite.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'a double-click renames nothing',
    find: "        renameShelf(row, Number(shelf.id));\n",
    with: '',
    test: 'a double-click on a shelf renames it' },
  { file: 'MODEL.html', name: 'the second click of a double-click goes there again',
    find: "        if (boneyardActive && Number(shelf.id) === activeShelfId()) return;\n",
    with: '',
    test: 'a double-click on a shelf renames it' },
  { file: 'MODEL.html', name: 'Esc keeps the typed name',
    find: "      if (event.key === 'Escape') finish(false);",
    with: "      if (event.key === 'Escape') finish(true);",
    test: 'a double-click on a shelf renames it' },
  { file: 'MODEL.html', name: 'the whole drawing goes in the suite file',
    find: "        out[key] = value.filter(item => item && Number(item.levelId) === owner);",
    with: "        out[key] = value;",
    test: 'SAVE AS SUITE writes only the shelf' },
  { file: 'MODEL.html', name: 'the suite file is not marked a suite',
    find: "    out.suiteKind = kind;\n",
    with: '',
    test: 'SAVE AS SUITE writes only the shelf' },
  { file: 'MODEL.html', name: 'the file is not named for the shelf',
    find: "    const name = `${shelf?.name || `SHELF ${shelfId}`}.draft`;",
    with: "    const name = 'suite.draft';",
    test: 'SAVE AS SUITE writes only the shelf' },
  { file: 'MODEL.html', name: 'EDIT ON SHELF leaves the shelf its number',
    find: "    if (shelf) shelf.name = String(holo.name || 'SUITE').toUpperCase();",
    with: '',
    test: 'EDIT ON SHELF' },
  { file: 'MODEL.html', name: 'EDIT ON SHELF brings no windows',
    find: "    const TYPE_OF = { walls: 'wall', lines: 'line', floors: 'floor', fenestrations: 'fenestration',",
    with: "    const TYPE_OF = { walls: 'wall', lines: 'line', floors: 'floor',",
    test: 'EDIT ON SHELF' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4501' } });
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
