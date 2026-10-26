#!/usr/bin/env node
// MUTATION GATE for DIMENSIONS BY HAND (tests/dimension-hand.spec.js).
//
// Movie, 17-18 Oct: "D command ... VERT or HORIZ ... DIAG", "press enter or
// double click to end the string and the next click will position the
// dimensions", "same as the autodims look" -- and AUTO DIMS / HAND DIMS on
// the sheet to show or hide each kind.
//
// Run: node proto/dimension-hand-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/dimension-hand.spec.js';
const MUTANTS = [
  { file: 'model/15-panels.js', name: "the strings land on an auto layer",
    find: "          layer: DIM_HAND_LAYER, auto: false,\n",
    with: "          layer: 'A-DIMS-OVR', auto: false,\n", test: 'a HORIZ string: three points, ENTER, a press above stands two dimensions there, on A-DIMS-HAND' },
  { file: 'model/15-panels.js', name: "the strings are marked auto, for AUTO DIMS to sweep",
    find: "          layer: DIM_HAND_LAYER, auto: false,\n",
    with: "          layer: DIM_HAND_LAYER, auto: true,\n", test: 'a HORIZ string: three points, ENTER, a press above stands two dimensions there, on A-DIMS-HAND' },
  { file: 'model/14-promotion-tools.js', name: "ENTER does not end the string",
    find: "    if (dimInHand()) return dimOnceEnds();\n",
    with: "", test: 'a HORIZ string: three points, ENTER, a press above stands two dimensions there, on A-DIMS-HAND' },
  { file: 'model/15-panels.js', name: "the ink stands toward what it measures",
    find: "      const [s0, s1] = away < 0 ? [b, a] : [a, b];\n",
    with: "      const [s0, s1] = [a, b];\n", test: 'a HORIZ string: three points, ENTER, a press above stands two dimensions there, on A-DIMS-HAND' },
  { file: 'model/15-panels.js', name: "VERT measures across",
    find: "    if (dimMode === 'v') return { x: 0, z: 1 };\n",
    with: "    if (dimMode === 'v') return { x: 1, z: 0 };\n", test: 'a VERT string ends with a double-click and stands where the next press is' },
  { file: 'model/15-panels.js', name: "no pop-up over the sheet",
    find: "      canvas.parentElement.append(dimPop);\n",
    with: "", test: 'D arms it: HORIZ, VERT and DIAG in PROPERTIES and on the pop-up over the sheet, HORIZ lit' },
  { file: 'model/15-panels.js', name: "a tool change keeps the string in hand",
    find: "    if (next !== 'dimension' || dimLastLine) { dimPoints = []; dimPlacing = false; dimLastLine = null; }\n",
    with: "", test: 'Esc puts the string down, one UNDO takes a placed one, and AUTO DIMS leaves hand strings alone' },
  { file: 'model/01-skin-view.js', name: "a hidden kind is still painted",
    find: "  const shownDimensions = () => dimensions().filter(d => !dimsHidden[dimKind(d)]);\n",
    with: "  const shownDimensions = () => dimensions();\n", test: 'AUTO DIMS and HAND DIMS beside the north arrow show or hide each kind; the drawing keeps both; a reload remembers' },
  { file: 'model/03-plan-paint.js', name: "the chips forget on a reload",
    find: "          dimsHidden = { ...dimsHidden, [kind]: !dimsHidden[kind] };\n          try { localStorage.setItem('model.dimsHidden', JSON.stringify(dimsHidden)); } catch (e) {}\n",
    with: "          dimsHidden = { ...dimsHidden, [kind]: !dimsHidden[kind] };\n", test: 'AUTO DIMS and HAND DIMS beside the north arrow show or hide each kind; the drawing keeps both; a reload remembers' },
  { file: 'model/03-plan-paint.js', name: "the chips stand on a level with no strings",
    find: "    dimsShowBox.hidden = !any;\n",
    with: "    dimsShowBox.hidden = false;\n", test: 'no strings on the level, no chips -- until the DIMENSION tool is up' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4437' } });
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
