#!/usr/bin/env node
// MUTATION GATE for BREAK (tests/model-html-break.spec.js).
//
// Movie, 18 Oct: "'BREAK' the roof and deleted the 2 hip peices and move the
// GABLE part all the wal over" -- "place the BREAK command down near where
// UNDO COPY DELETE commands show up ... when the roof or other ASSEMBLIES are
// selected".
//
// Run: node proto/model-break-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-break.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'BREAK never shows',
    find: '    breakButton.hidden = !able || !!rotateState?.open;\n',
    with: '    breakButton.hidden = true;\n',
    test: 'a roof selected: BREAK in the foot; two clicks edge to edge cut it in two along a flush gable' },
  { file: 'MODEL.html', name: 'the cut is an eave, so a hip stands at it',
    find: "      k.push('gable'); o.push(0);\n",
    with: "      k.push('eave'); o.push(0);\n",
    test: 'a roof selected: BREAK in the foot; two clicks edge to edge cut it in two along a flush gable' },
  { file: 'MODEL.html', name: 'the second piece keeps the first one\'s id',
    find: "    const second = make(h2, newDrawingItemId('roof'));\n",
    with: '    const second = make(h2, roof.id);\n',
    test: 'a roof selected: BREAK in the foot; two clicks edge to edge cut it in two along a flush gable' },
  { file: 'MODEL.html', name: 'UNDO cannot join the roof again',
    find: "    undoStack.push({ kind: 'replace-items', list: drawing.roofs, removed: [{ item: roof, index }], added: [first, second] });\n",
    with: '',
    test: 'the piece not wanted is deleted, and UNDO joins the roof again' },
  { file: 'MODEL.html', name: 'an assembly is not broken',
    find: '    ungroupSelected();\n    sayOnStrip(`ASSEMBLY BUST: broken into pieces',
    with: '    sayOnStrip(`ASSEMBLY BUST: broken into pieces',
    test: "an assembly selected: the foot button says BUST and busts it into its pieces; a roof's says BREAK" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4435' } });
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
