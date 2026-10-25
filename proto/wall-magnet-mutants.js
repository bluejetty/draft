#!/usr/bin/env node
// MUTATION GATE for the wall magnet (tests/wall-magnet.spec.js).
//
// Movie, 19 Oct: "can these interior walls be 'attracted' to SNAP to the
// INTERIOR CORNER and also to the INTERIOR WALL LINE (but more pull from the
// inside/outside corners" -- "glow orange at 'magnetic snap nodes' and glow
// yellow green neon for LINE and non node corner magnetic snaps".
//
// Run: node proto/wall-magnet-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/wall-magnet.spec.js';
const MUTANTS = [
  { file: "model/07-walls-magnet.js", name: "no face lines in the draw snap",
    find: "        const face = nearestFace(magnetSegs(), at);\n",
    with: "        const face = null;\n",
    test: 'a LINE started a hair off an interior wall\'s face starts ON the face, and the face lights neon' },
  { file: "geometry-2d.js", name: "the face lines sit on the wall's centre",
    find: "      const { startOff, endOff } = wallFaceOffsets(w, thicknessFt(w));\n      return [startOff, endOff].map(o => ({",
    with: "      return [0, 0].map(o => ({",
    test: 'a LINE started a hair off an interior wall\'s face starts ON the face, and the face lights neon' },
  { file: "model/07-walls-magnet.js", name: "face corners pull no further than a line",
    find: "  const FACE_CORNER_PULL_PX = 11;\n",
    with: "  const FACE_CORNER_PULL_PX = 6;\n",
    test: 'the inside corner pulls harder than the face: 10px along the face still lands on the corner' },
  { file: "model/10-tracking-garage.js", name: "a face corner glows as a node",
    find: "      kind: lit.seg ? 'face' : lit.node ? 'node' : 'corner',\n",
    with: "      kind: lit.seg ? 'face' : 'node',\n",
    test: 'the inside corner pulls harder than the face: 10px along the face still lands on the corner' },
  { file: "model/10-tracking-garage.js", name: "a wall end glows neon",
    find: "    const ownNode = snap.node && isOwnNode(snap.node);\n",
    with: "    const ownNode = false;\n",
    test: 'a wall\'s own end is a node: it glows orange, not neon' },
  { file: "model/16-gestures-undo.js", name: "a drag takes no magnet",
    find: "          const magnet = snapOn && board !== 'toy' ? (md.magnet ||= dragMagnet(grabbed.vtx)) : null;\n",
    with: "          const magnet = null;\n",
    test: 'a 2x4\'s node dragged near the 2x6\'s face lands on it' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4452' } });
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
