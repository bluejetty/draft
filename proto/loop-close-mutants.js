#!/usr/bin/env node
// MUTATION GATE for the loop rule (Movie, 22 Oct): "for when a user is
// completing a shape like FLOOR, ROOF or SHAPE once the user is ready to make
// the LAST / at FIRST point location by DOUBLE clicking, or pressing ENTER or
// SPACEBAR twice quickly" -- "and dimensions and lines too should work that
// way too". Each row breaks one line, runs the one test that should notice,
// and restores the file from HEAD.
//
//   node proto/loop-close-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/loop-close.spec.js';

const MUTANTS = [
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the double-click\'s second click is a second corner on the floor',
    find: "    if (loopTailIs(floorCorners, here)) return;\n",
    with: "",
    test: 'a double-click on a FLOOR is its last corner and closes it on the first; the second click leaves no corner behind' },
  { file: 'model/14-promotion-tools.js',
    name: 'ENTER puts a corner at the cursor instead of closing',
    find: "    if (loopInHand()) return closeLoop();\n",
    with: "    if (loopInHand()) { loopPress(cursorWorld); return true; }\n",
    test: 'on a SHAPE, ENTER once closes on the first corner' },
  { file: 'model/14-promotion-tools.js',
    name: 'SPACE is not heard',
    find: "    if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat || modalUp() || keyIsTyping(e.target)) return;\n",
    with: "    if (e.key !== 'Enter' || e.repeat || modalUp() || keyIsTyping(e.target)) return;\n",
    test: 'SPACE once closes the single slope ROOF outline' },
  { file: 'model/16-gestures-undo.js',
    name: 'the right button cancels the loop instead of closing it',
    find: "        if (finishOrRepeat()) { stripRefresh(); paint(); }\n",
    with: "        if (cancelGestures()) { stripRefresh(); paint(); }\n",
    test: 'SPACE once closes the single slope ROOF outline' },
  { file: 'model/14-promotion-tools.js',
    name: 'two corners close, silently',
    find: "    if (corners.length < 3) {\n      sayOnStrip(`A ${activeTool.toUpperCase()} needs three corners before it can close on the first.`);\n",
    with: "    if (corners.length < 2) {\n      sayOnStrip(`A ${activeTool.toUpperCase()} needs three corners before it can close on the first.`);\n",
    test: 'below three corners nothing closes: the strip says so and the corners stay, to carry on from' },
  { file: 'model/14-promotion-tools.js',
    name: 'the outline does not close on the key',
    find: "    if (activeTool === 'outline') outlineAdd(first, first);\n",
    with: "    if (activeTool === 'outline') return true;\n",
    test: 'an OUTLINE closes by ENTER as a press on its first corner does' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4526' } });
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
