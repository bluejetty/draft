#!/usr/bin/env node
// MUTATION GATE for COPY on a beam taking its row and its posts, and PASTE's
// one UNDO (tests/beam-copy.spec.js).
//
// Movie, 20 Oct: "i COPYed the BEAM - when this happens the COLUMNS ... and
// pad footing for the whole building should get coppied and pasted".
//
// Run: node proto/beam-copy-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/beam-copy.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'the posts stay behind',
    find: "        columnsOnBeam(piece).forEach(post => { if (!has(post)) out.push({ type: 'column', item: post }); });\n",
    with: '',
    test: 'COPY on one piece takes the whole row' },
  { file: 'MODEL.html', name: 'COPY takes only the selection again',
    find: "    held = copiedEntries()\n",
    with: "    held = selection.slice()\n",
    test: 'COPY on one piece takes the whole row' },
  { file: 'MODEL.html', name: 'a paste has no UNDO',
    find: "    undoStack.push({ kind: 'built', walls: landed.filter(e => e.type === 'wall').map(e => e.item),",
    with: "    void ({ kind: 'built', walls: landed.filter(e => e.type === 'wall').map(e => e.item),",
    test: 'one UNDO takes the whole paste back' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4470' } });
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
