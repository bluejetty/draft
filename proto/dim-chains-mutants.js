#!/usr/bin/env node
// MUTATION GATE for the dimension chains (tests/dim-chains.spec.js).
//
// Movie, 20 Oct: "i'd like it if it doesn't matter what order they are
// placed ... can you also add PRESS SPACEBAR to also end the cycle ... after
// the first line is placed can you also allow the user to place a SECOND line
// in another position and another until the user double clicks the mouse,
// enter key or keyboard (click again after the last one twice) to stop ...
// i'd also like to be able to copy and paste and existing dimension line a
// little further outward or inward".
//
// Run: node proto/dim-chains-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/dim-chains.spec.js';
const MUTANTS = [
  { file: 'model/15-panels.js', name: 'the points are measured in the order pressed',
    find: "    }).sort((p1, p2) => p1.along - p2.along);\n",
    with: "    });\n",
    test: 'points pressed in any order' },
  { file: 'model/14-promotion-tools.js', name: 'SPACE does nothing',
    find: "    if (e.key !== ' ' || e.repeat || !(drawsRun() || loopInHand() || dimInHand()) || modalUp()) return;\n",
    with: "    if (e.key !== ' ' || e.repeat || !(drawsRun() || loopInHand()) || modalUp()) return;\n",
    test: 'SPACE ends the points' },
  { file: 'model/15-panels.js', name: 'the string is put down after its first line',
    find: "      undoStack.push(step);\n      dimLastLine = {",
    with: "      undoStack.push(step);\n      dimPoints = []; dimPlacing = false;\n      dimLastLine = {",
    test: 'each click lays another line' },
  { file: 'model/15-panels.js', name: 'ENTER does not finish the lines',
    find: "    if (dimPlacing) return finishDimString();\n    if (endDimString()) paint();\n",
    with: "    if (dimPlacing) return true;\n    if (endDimString()) paint();\n",
    test: 'each click lays another line' },
  { file: 'model/15-panels.js', name: 'a click right on the line just placed lays a duplicate',
    find: "      if (dimOnLastLine(at)) return;\n",
    with: "",
    test: 'a click beside the line just placed lays another' },
  { file: 'model/15-panels.js', name: 'a click near the line just placed finishes the string again',
    find: "      if (dimOnLastLine(at)) return;\n",
    with: "      if (dimOnLastLine(at)) { finishDimString(); return; }\n",
    test: 'a click beside the line just placed lays another' },
  { file: 'model/16-gestures-undo.js', name: 'ESC keeps the lines already laid',
    find: "    if (dimPlacing) dimAbandon();\n",
    with: "",
    test: 'ESC while the lines are being laid' },
  { file: 'model/15-panels.js', name: 'an UNDO leaves the lines going',
    find: "    if (!dimLastLine || undoStack[undoStack.length - 1] === dimLastLine.step) return false;\n",
    with: "    if (true) return false;\n",
    test: 'UNDO of the line just placed' },
  { file: 'model/08-structure-roof.js', name: 'a dimension is still not copied',
    find: "  const NOT_COPIED = new Set(['stair', 'roof', 'roomtag', 'note']);\n",
    with: "  const NOT_COPIED = new Set(['stair', 'roof', 'roomtag', 'note', 'dimension']);\n",
    test: 'COPIED and PASTED' },
  { file: 'model/08-structure-roof.js', name: 'the pasted dimension takes a string id',
    find: "        copy.id = newDimensionId();\n",
    with: "",
    test: 'COPIED and PASTED' },
  { file: 'model/08-structure-roof.js', name: 'the pasted dimension lands on the original',
    find: "        const out = { x: -dz / len * 2, z: dx / len * 2 };\n",
    with: "        const out = { x: 0, z: 0 };\n",
    test: 'COPIED and PASTED' },
  { file: 'model/15-panels.js',
    name: 'a line placed with HAND DIMS off stays hidden (Movie, 25 Oct: "LEFT CLICK ... isn\'t working")',
    find: "      const wasHidden = dimsHidden.hand;\n",
    with: "      const wasHidden = false;\n",
    test: 'with HAND DIMS off, placing a line turns them back on' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4462' } });
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
