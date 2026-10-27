#!/usr/bin/env node
// MUTATION GATE for ARCHICAD's keys (tests/archicad-keys.spec.js).
//
// Movie, 27 Oct: "it has the SHIFT for the 90 degree lines (like our T
// SQUARE) i think i'd like to try to get it working fairly similar to
// ARCHICAD, but also change it so it s a little better" -- Shift held =
// square, T latches it and Shift frees it, Ctrl+G groups, Ctrl+Shift+G
// ungroups.
//
// Run: node proto/archicad-keys-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/archicad-keys.spec.js';

const MUTANTS = [
  { file: 'model/01-skin-view.js',
    name: 'SHIFT does nothing to the T-square',
    find: "  const tsquareLive = () => tsquareOn !== shiftSquare;\n",
    with: "  const tsquareLive = () => tsquareOn;\n",
    test: 'SHIFT held squares the run and lights the T-square; let go, the run is free again' },
  { file: 'model/01-skin-view.js',
    name: 'SHIFT cannot free a latched T-square',
    find: "  const tsquareLive = () => tsquareOn !== shiftSquare;\n",
    with: "  const tsquareLive = () => tsquareOn || shiftSquare;\n",
    test: 'T latches the T-square down; SHIFT then frees the run while held; T again lifts it' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'SHIFT is never heard',
    find: "    shiftSquare = held;\n",
    with: "    shiftSquare = false;\n",
    test: 'SHIFT held squares the run and lights the T-square; let go, the run is free again' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the chip shows the latch, not what holds the run',
    find: "    tsquareChip.classList.toggle('lit', tsquareLive());\n",
    with: "    tsquareChip.classList.toggle('lit', tsquareOn);\n",
    test: 'SHIFT held squares the run and lights the T-square; let go, the run is free again' },
  { file: 'model/14-promotion-tools.js',
    name: 'T does not latch the T-square',
    find: "    if (map.tsquare && kb.eventMatchesBinding(event, map.tsquare)) {\n",
    with: "    if (false) {\n",
    test: 'T latches the T-square down; SHIFT then frees the run while held; T again lifts it' },
  { file: 'model/16-gestures-undo.js',
    name: 'a SHIFT-dragged wall goes where the hand goes',
    find: "          if (tsquareLive() && board !== 'toy' && md.body?.start && md.body?.end) {\n",
    with: "          if (tsquareOn && board !== 'toy' && md.body?.start && md.body?.end) {\n",
    test: 'SHIFT-dragging a wall by its middle slides it straight across, its corners still joined' },
  { file: 'model/14-promotion-tools.js',
    name: 'CTRL+G groups nothing',
    find: "    if (map.groupAlt && kb.eventMatchesBinding(event, map.groupAlt)) {\n",
    with: "    if (false) {\n",
    test: 'CTRL+G makes what is picked one assembly; CTRL+SHIFT+G ungroups it' },
  { file: 'model/14-promotion-tools.js',
    name: 'CTRL+SHIFT+G ungroups nothing',
    find: "    if (map.ungroup && kb.eventMatchesBinding(event, map.ungroup)) {\n",
    with: "    if (false) {\n",
    test: 'CTRL+G makes what is picked one assembly; CTRL+SHIFT+G ungroups it' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4797' } });
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
