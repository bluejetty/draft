#!/usr/bin/env node
// MUTATION GATE for SHAPE and FLOOR catching up with WALL and LINE (Movie,
// 25 Oct): the tool stays up after a loop closes; the LENGTH box takes the
// next corner, exactly; a picked shape's or floor's corners drag, plain
// points; and Ctrl+C / Ctrl+V are the foot's COPY and PASTE. Each row breaks
// one line, runs the one test that should notice, and restores from HEAD.
//
//   node proto/loop-edit-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/loop-edit.spec.js';

const MUTANTS = [
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a closed floor puts the tool down again',
    find: "    // THE TOOL STAYS UP for the next floor (Movie, 25 Oct), as SHAPE's does.\n",
    with: "    setTool(RESTING_TOOL);\n",
    test: 'FLOOR stays up after it closes' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a closed shape puts the tool down again',
    find: "    selectPlaced('shape', shape);\n    sayOnStrip('SHAPE closed.",
    with: "    setTool(RESTING_TOOL);\n    selectPlaced('shape', shape);\n    sayOnStrip('SHAPE closed.",
    test: 'SHAPE stays up after it closes' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a double-click on the first corner starts the next shape',
    find: "    if (loopRepress(shapeCorners, here)) return;\n",
    with: "",
    test: "a double-click on a SHAPE's first corner" },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the LENGTH box stays shut on a loop in hand',
    find: "      || !!shedRun() || loopTypable();\n",
    with: "      || !!shedRun();\n",
    test: "a FLOOR's next corner takes a typed length" },
  { file: 'model/14-promotion-tools.js',
    name: 'a typed length on a shape is ignored',
    find: "      if (feet !== undefined) typedLoopCorner(feet);\n",
    with: "",
    test: "a SHAPE's next corner takes a typed length" },
  { file: 'model/16-gestures-undo.js',
    name: 'only a room shape\'s corners drag',
    find: "    const loopKind = selection.length === 1 && ['roomtag', 'shape', 'floor'].includes(selection[0].type)\n",
    with: "    const loopKind = selection.length === 1 && ['roomtag'].includes(selection[0].type)\n",
    test: "a picked SHAPE's corner drags" },
  { file: 'model/16-gestures-undo.js',
    name: 'a dragged floor corner loses its y',
    find: "pt = md.loopKind === 'floor' ? { x: pt.x, y: 0, z: pt.z } : { x: pt.x, z: pt.z };\n",
    with: "pt = { x: pt.x, z: pt.z };\n",
    test: "a picked FLOOR's corner drags" },
  { file: 'model/16-gestures-undo.js',
    name: 'Ctrl+V pastes nothing',
    find: "      if (e.key.toLowerCase() === 'c') { copySelection(); paint(); } else pasteHeld();\n",
    with: "      if (e.key.toLowerCase() === 'c') { copySelection(); paint(); }\n",
    test: 'Ctrl+C copies what is picked' },
];


const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4561' } });
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
