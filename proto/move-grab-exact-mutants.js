#!/usr/bin/env node
// MUTATION GATE for MOVE taking hold of an exact corner and putting it on an
// exact corner, and flooring corners snapping the same way (Movie, 25 Oct:
// "the 'node or intersection' is given a CIRCLE ... place that node EXACTLY
// onto another intersection or node"; the WC "off a little each time").
//
//   node proto/move-grab-exact-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/move-grab-exact.spec.js';

const MUTANTS = [
  { file: 'model/09-draw-move-stretch.js',
    name: 'the press takes hold where it falls',
    find: "      moveState.drag = { kind: 'selection', at: grab ? { x: grab.x, z: grab.z } : at, grab: grab || null,",
    with: "      moveState.drag = { kind: 'selection', at, grab: grab || null,",
    test: 'inside corner of a 2x6 meeting' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'the WC walls\' face corners are not offered',
    find: "      G.wallFaceCorners(ws, openingThicknessFt()).forEach(c => pts.push({ x: c.x, z: c.z, node: false }));",
    with: "",
    test: 'inside corner of a 2x6 meeting' },
  { file: 'model/10-tracking-garage.js',
    name: 'no circle before the press',
    find: "    const grabHover = moveState?.on && !moveState.drag && !moveState.roof && cursorWorld ? moveGrabAt(cursorWorld) : null;",
    with: "    const grabHover = null;",
    test: 'inside corner of a 2x6 meeting' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'the grab reaches everywhere',
    find: "    const r = reachFt(NODE_REACH);",
    with: "    const r = Infinity;",
    test: 'no circle' },
  { file: 'model/16-gestures-undo.js',
    name: 'the flooring corner keeps the 4 px reach for a face corner',
    find: "          const face = window.DraftGeometry2D.nearestVertex(wallFaceNodes(), raw, reachFt(CORNER_REACH));",
    with: "          const face = window.DraftGeometry2D.nearestVertex(wallFaceNodes(), raw, 4 / view.scale);",
    test: 'flooring corner' },
  { file: 'model/16-gestures-undo.js',
    name: 'the wall\'s node beats the nearer face corner',
    find: "          if (face && far(face) < far(caught)) {\n            const link = roomLinkAt(face);",
    with: "          if (face && !caught) {\n            const link = roomLinkAt(face);",
    test: 'flooring corner' },
  { file: 'model/10-tracking-garage.js',
    name: 'no circle on a flooring corner in hand',
    find: "    if (moveDrag?.kind === 'roomcorner' && moveDrag.lit) {",
    with: "    if (false) {",
    test: 'flooring corner' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4632' } });
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
