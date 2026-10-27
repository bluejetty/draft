#!/usr/bin/env node
// MUTATION GATE for the hovered node ALT lines up on (SHIFT until 27 Oct) (tests/ref-lock.spec.js).
//
// Movie, 23 Oct: "i can SCROLL OVER a node/ or corner ... if i press SHIFT and
// hold the T SQUARE will line up with that previously scrolled over node and
// i can enter a length and the length will be measured from that node".
//
// Run: node proto/ref-lock-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/ref-lock.spec.js';
const MUTANTS = [
  { file: 'model/10-tracking-garage.js', name: 'SHIFT lines up on nothing',
    find: "    if (!refLock || !at || !REF_TOOLS.has(activeTool)) return null;\n    const p = refAim(refLock, at);",
    with: "    return null;\n    const p = refAim(refLock, at);",
    test: 'hovered, then ALT' },
  { file: 'model/16-gestures-undo.js', name: 'the hovered node is never taken',
    find: "        if (node) refHover = { x: node.x, z: node.z };\n",
    with: "",
    test: 'hovered, then ALT' },
  { file: 'model/14-promotion-tools.js', name: 'a typed length is measured from the run, not the node',
    find: "    const fromRef = refTyped(feet);\n",
    with: "    const fromRef = null;\n",
    test: 'measured from the node' },
  { file: 'model/16-gestures-undo.js', name: 'let go and moved, the cursor stays lined up',
    find: "      if (refLock?.released && cursorWorld && Math.hypot(at.x - refLock.at.x, at.z - refLock.at.z) * view.scale > 6) dropRefLock();\n",
    with: "",
    test: 'let go of ALT and move' },
  { file: 'model/11-floor-openings-fixtures.js', name: 'a floor corner does not line up',
    find: "  const loopPoint = (at, corners = activeTool === 'floor' ? floorCorners : activeTool === 'shape' ? shapeCorners : []) => {\n    const ref = refPoint(at);\n    if (ref) return { x: ref.x, z: ref.z };\n",
    with: "  const loopPoint = (at, corners = activeTool === 'floor' ? floorCorners : activeTool === 'shape' ? shapeCorners : []) => {\n",
    test: 'floor' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4540' } });
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
