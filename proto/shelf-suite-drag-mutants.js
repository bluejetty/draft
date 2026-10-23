#!/usr/bin/env node
// MUTATION GATE for a shelf square dragged onto the plan, and OPEN SUITE /
// SAVE AS SUITE beside the SHELVES tab (Movie, 23 Oct). Each row breaks one
// line, runs the one test that should notice, and restores from HEAD.
//
//   node proto/shelf-suite-drag-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shelf-suite-drag.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the two buttons never come out',
    find: "      if (b) b.hidden = !boneyardActive;\n",
    with: "      if (b) b.hidden = true;\n",
    test: 'OPEN SUITE and SAVE AS SUITE' },
  { file: 'MODEL.html',
    name: 'the two buttons are out on MAIN FL too',
    find: "      if (b) b.hidden = !boneyardActive;\n",
    with: "      if (b) b.hidden = false;\n",
    test: 'OPEN SUITE and SAVE AS SUITE' },
  { file: 'MODEL.html',
    name: 'SAVE AS SUITE beside the tab asks nothing',
    find: "        side('shelf-save-suite', 'SAVE AS SUITE', 'Save what is on this shelf, and only it, as its own SUITE .draft', () => askShelfSuite()));\n",
    with: "        side('shelf-save-suite', 'SAVE AS SUITE', 'Save what is on this shelf, and only it, as its own SUITE .draft', () => {}));\n",
    test: 'OPEN SUITE and SAVE AS SUITE' },
  { file: 'MODEL.html',
    name: 'a press that moves never becomes a drag',
    find: "        press.dragging = true;\n        dragShelfSuite(press.shelfId, event);\n",
    with: "        press.dragging = true;\n",
    test: 'press and hold a square' },
  { file: 'MODEL.html',
    name: 'the suite lands where its file has it, not under the hand',
    find: "    holo.x += at.x - grip.x;\n    holo.z += at.z - grip.z;\n",
    with: "",
    test: 'press and hold a square' },
  { file: 'MODEL.html',
    name: 'the drop leaves a move step over the add: two UNDOs',
    find: "    if (m.shelfDrop) {\n      if (!commit) {\n",
    with: "    if (false) {\n      if (!commit) {\n",
    test: 'press and hold a square' },
  { file: 'MODEL.html',
    // THE VIEW CHECK, not the cut guard: an elevation's view id is not a
    // plan view, so the guard alone is belt and braces that no spec can
    // tell apart; the view check is what a cut actually runs into.
    name: 'the drag works on an elevation\'s view',
    find: "    return v == null || !!H()?.VIEWS?.has(v);\n",
    with: "    return true;\n",
    test: 'on an elevation, the site, or standing on a shelf' },
  { file: 'MODEL.html',
    name: 'the drag works on the site or the roof',
    find: "    if (!floorsOf(drawing.levels).some(l => Number(l.id) === Number(activeLevelId()))) return false;\n",
    with: "",
    test: 'on an elevation, the site, or standing on a shelf' },
  { file: 'MODEL.html',
    name: 'Esc leaves the suite on the sheet',
    find: "        if (at >= 0) drawing.holograms.splice(at, 1);\n",
    with: "",
    test: 'Esc while it is in hand' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4546' } });
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
