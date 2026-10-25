#!/usr/bin/env node
// MUTATION GATE for R / L opening the LENGTH box, mid-drag too (Movie, 20 Oct):
// "i press 'R' or 'L' and it takes me into the text box to type the length,
// and i press enter or the mouse button or the space bar". Each row breaks one line,
// runs the one test that should notice, and restores the file from HEAD.
//
//   node proto/move-typed-keys-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/move-typed-keys.spec.js';

const MUTANTS = [
  { file: 'model/14-promotion-tools.js',
    name: 'R and L open nothing',
    find: "    if (!/^[rl]$/i.test(event.key) || inAField(event.target) || modalUp()) return;\n",
    with: "    return;\n",
    test: 'R after the drag opens the box too, and ENTER finishes' },
  { file: 'model/14-promotion-tools.js',
    name: 'the box does not open while the button is down',
    find: "    if (mid) { typedMidDrag = true; lengthBox.disabled = false; lengthBox.value = ''; }\n",
    with: "    if (mid) return;\n",
    test: 'L pressed mid-drag opens the box, and the release moves it the typed length along the push' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'the release forgets the typed length',
    find: "    if (moveTypedReady() && String(lengthBox.value).trim()) { moveByTyped(); return; }\n",
    with: "",
    test: 'L pressed mid-drag opens the box, and the release moves it the typed length along the push' },
  { file: 'model/14-promotion-tools.js',
    name: 'SPACE twice is two spaces',
    find: "    if (e.key === ' ' && / $/.test(lengthBox.value) && lengthBox.value.trim()) {\n",
    with: "    if (false) {\n",
    test: 'SPACE twice finishes it; one space is part of the length' },
  { file: 'model/14-promotion-tools.js',
    name: 'one SPACE finishes, so 14 6 cannot be typed',
    find: "    if (e.key === ' ' && / $/.test(lengthBox.value) && lengthBox.value.trim()) {\n",
    with: "    if (e.key === ' ' && lengthBox.value.trim()) {\n",
    test: 'SPACE twice finishes it; one space is part of the length' },
  { file: 'model/14-promotion-tools.js',
    name: 'a press on the sheet is a pick again',
    find: "    if (!String(lengthBox.value).trim() || !moveTypedReady()) return;\n    event.preventDefault();\n",
    with: "    return;\n    event.preventDefault();\n",
    test: 'a press on the sheet finishes it, and the assembly stays picked' },
  { file: 'model/16-gestures-undo.js',
    name: 'an assembly dragged under SELECT refuses the typed length again',
    find: "!(md.lockBefore && md.lockBefore.length) && !master\n",
    with: "!md.lockBefore && !master\n",
    test: 'an assembly dragged under SELECT takes L mid-drag the same way' },
  { file: 'model/14-promotion-tools.js',
    name: 'L is taken from the LINE tool at all times',
    find: "    if (lengthBox.disabled && !mid) return;\n",
    with: "",
    test: 'with nothing in hand, L is still the LINE key' },
  { file: 'model/14-promotion-tools.js',
    name: 'ENTER with the button down waits for the release again (Movie, 25 Oct)',
    find: "    if (typedMidDrag && dragInHand()) {\n",
    with: "    if (false) {\n",
    test: 'a lone wall dragged under SELECT' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4516' } });
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
