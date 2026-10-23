#!/usr/bin/env node
// MUTATION GATE for the X that closes a shelf (Movie, 23 Oct). Each row
// breaks one line, runs the one test that should notice, and restores the
// file from HEAD.
//
//   node proto/shelf-close-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shelf-close.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'no X on the squares',
    find: "      square.append(screen, label, shelfCloseX(shelf));\n",
    with: "      square.append(screen, label);\n",
    test: 'an X sits top right of every square' },
  { file: 'MODEL.html',
    name: 'no X on the LEVELS rows',
    find: "      row.append(document.createTextNode(shelf.name || `SHELF ${shelf.id}`), shelfCloseX(shelf));\n",
    with: "      row.textContent = shelf.name || `SHELF ${shelf.id}`;\n",
    test: 'an X sits top right of every square' },
  { file: 'MODEL.html',
    name: 'the X enters the shelf as well as asking',
    find: "    x.addEventListener('click', event => { event.stopPropagation(); askShelfClose(Number(shelf.id)); });\n",
    with: "    x.addEventListener('click', () => { askShelfClose(Number(shelf.id)); });\n",
    test: 'an X sits top right of every square' },
  { file: 'MODEL.html',
    name: 'CANCEL closes the shelf',
    find: "    else if (choice === 'discard') closeShelf(shelfId);\n",
    with: "    else closeShelf(shelfId);\n",
    test: 'an X sits top right of every square' },
  { file: 'MODEL.html',
    name: 'the closed shelf keeps its geometry in the file',
    find: "      drawing[field] = drawing[field].filter(item => !item || item.levelId !== owner);\n",
    with: "",
    test: 'CLOSE WITHOUT SAVING takes the shelf' },
  { file: 'MODEL.html',
    name: 'closing one shelf takes every shelf\'s geometry',
    find: "      drawing[field].forEach(item => { if (item && item.levelId === owner) goneIds.add(String(item.id)); });\n      drawing[field] = drawing[field].filter(item => !item || item.levelId !== owner);\n",
    with: "      drawing[field].forEach(item => { if (item && item.levelId < 0) goneIds.add(String(item.id)); });\n      drawing[field] = drawing[field].filter(item => !item || item.levelId >= 0);\n",
    test: 'CLOSE WITHOUT SAVING takes the shelf' },
  { file: 'MODEL.html',
    name: 'SAVE FIRST closes before the file is written',
    find: "    if (choice === 'save') askShelfSuite(shelfId, () => closeShelf(shelfId));\n",
    with: "    if (choice === 'save') { closeShelf(shelfId); askShelfSuite(shelfId); }\n",
    test: 'SAVE AS SUITE FIRST writes the shelf' },
  { file: 'MODEL.html',
    name: 'the kind question cancelled still closes the shelf',
    find: "  shelfSuiteAsk?.querySelector('[data-shelf-suite-cancel]')?.addEventListener('click', () => { shelfSuiteAsk.hidden = true; shelfSuitePending = null; });\n",
    with: "  shelfSuiteAsk?.querySelector('[data-shelf-suite-cancel]')?.addEventListener('click', () => { shelfSuiteAsk.hidden = true; if (shelfSuitePending?.after) shelfSuitePending.after(); shelfSuitePending = null; });\n",
    test: 'SAVE AS SUITE FIRST writes the shelf' },
  { file: 'MODEL.html',
    name: 'closing the shelf you stand on leaves you standing on it',
    find: "      drawing.activeBoneyardShelfId = Number(rest[0].id);\n",
    with: "",
    test: 'closing the shelf you stand on lands you on the other' },
  { file: 'MODEL.html',
    name: 'the last shelf is closed outright',
    find: "    drawing.boneyardShelves = emptied ? [shelf] : rest;\n",
    with: "    drawing.boneyardShelves = rest;\n",
    test: 'closing the shelf you stand on lands you on the other' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4554' } });
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
