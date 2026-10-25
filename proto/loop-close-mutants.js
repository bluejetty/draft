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
    name: 'ENTER once closes the shape',
    find: "    if (twice && loopInHand()) return closeLoop();\n",
    with: "    if (loopInHand()) return closeLoop();\n",
    test: 'on a SHAPE, ENTER once is a corner at the cursor and ENTER twice quickly closes on the first' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the second ENTER of the pair is a second corner on the shape',
    find: "    if (loopTailIs(shapeCorners, here)) return;\n",
    with: "",
    test: 'on a SHAPE, ENTER once is a corner at the cursor and ENTER twice quickly closes on the first' },
  { file: 'model/14-promotion-tools.js',
    name: 'SPACE is not heard on a loop tool',
    find: "    if (e.key !== ' ' || e.repeat || !(drawsRun() || loopInHand() || dimInHand()) || modalUp()) return;\n",
    with: "    if (e.key !== ' ' || e.repeat || !(drawsRun() || dimInHand()) || modalUp()) return;\n",
    test: 'SPACE twice quickly closes the single slope ROOF outline on its first corner; its first press on the last corner is no corner' },
  { file: 'model/08-structure-roof.js',
    name: 'the first SPACE of the pair is a corner on top of the roof\'s last',
    find: "    if (loopTailIs(s.corners, here)) return;\n",
    with: "",
    test: 'SPACE twice quickly closes the single slope ROOF outline on its first corner; its first press on the last corner is no corner' },
  { file: 'model/14-promotion-tools.js',
    name: 'two corners close, silently',
    find: "    if (corners.length < 3) {\n      sayOnStrip(`A ${activeTool.toUpperCase()} needs three corners before it can close on the first.`);\n",
    with: "    if (corners.length < 2) {\n      sayOnStrip(`A ${activeTool.toUpperCase()} needs three corners before it can close on the first.`);\n",
    test: 'below three corners nothing closes: the strip says so and the corners stay, to carry on from' },
  { file: 'model/14-promotion-tools.js',
    name: 'the outline does not close on the key',
    find: "    if (activeTool === 'outline') outlineAdd(first, first);\n",
    with: "    if (activeTool === 'outline') return true;\n",
    test: 'an OUTLINE closes by ENTER twice as a press on its first corner does' },
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
