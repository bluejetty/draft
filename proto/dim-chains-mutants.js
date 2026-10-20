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
  { file: 'MODEL.html', name: 'the points are measured in the order pressed',
    find: "    }).sort((p1, p2) => p1.along - p2.along);\n",
    with: "    });\n",
    test: 'points pressed in any order' },
  { file: 'MODEL.html', name: 'SPACE does nothing',
    find: "    if (e.key !== ' ' || e.repeat || activeTool !== 'dimension' || modalUp()) return;\n",
    with: "    if (e.key !== '\\u00a7' || e.repeat || activeTool !== 'dimension' || modalUp()) return;\n",
    test: 'SPACE ends the points' },
  { file: 'MODEL.html', name: 'the string is put down after its first line',
    find: "      undoStack.push(step);\n      dimLastLine = {",
    with: "      undoStack.push(step);\n      dimPoints = []; dimPlacing = false;\n      dimLastLine = {",
    test: 'each click lays another line' },
  { file: 'MODEL.html', name: 'ENTER does not finish the lines',
    find: "    if (dimPlacing) return dimLastLine ? finishDimString() : false;\n",
    with: "    if (dimPlacing) return false;\n",
    test: 'each click lays another line' },
  { file: 'MODEL.html', name: 'a click on the line just placed lays another',
    find: "        if (Math.abs(off) * view.scale < 8) {",
    with: "        if (Math.abs(off) * view.scale < 0) {",
    test: 'a click on the line just placed finishes' },
  { file: 'MODEL.html', name: 'a double-click leaves its first press\'s line',
    find: "    if (!last || Date.now() - last.when >= 700 || last.count < 2\n",
    with: "    if (true || Date.now() - last.when >= 700 || last.count < 2\n",
    test: 'a double-click finishes too' },
  { file: 'MODEL.html', name: 'an UNDO leaves the lines going',
    find: "    if (!dimLastLine || undoStack[undoStack.length - 1] === dimLastLine.step) return false;\n",
    with: "    if (true) return false;\n",
    test: 'UNDO of the line just placed' },
  { file: 'MODEL.html', name: 'a dimension is still not copied',
    find: "  const NOT_COPIED = new Set(['stair', 'roof', 'roomtag', 'note']);\n",
    with: "  const NOT_COPIED = new Set(['stair', 'roof', 'roomtag', 'note', 'dimension']);\n",
    test: 'COPIED and PASTED' },
  { file: 'MODEL.html', name: 'the pasted dimension takes a string id',
    find: "        copy.id = newDimensionId();\n",
    with: "",
    test: 'COPIED and PASTED' },
  { file: 'MODEL.html', name: 'the pasted dimension lands on the original',
    find: "        const out = { x: -dz / len * 2, z: dx / len * 2 };\n",
    with: "        const out = { x: 0, z: 0 };\n",
    test: 'COPIED and PASTED' },
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
