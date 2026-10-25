#!/usr/bin/env node
// MUTATION GATE for the STAIR LOCK (tests/model-html-stair-lock.spec.js).
//
// Movie, 18 Oct: "make the INTERIOR line of a wall (like a SNAP POINT for the
// stairs ... once the stair is locked onto that wall, the user can move it,
// but if the user also changes the foundation wall thickness, that should
// also move the stairs (and reduce the width ... make a popup".
//
// Run: node proto/model-stair-lock-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-stair-lock.spec.js';
const MUTANTS = [
  { file: "model/16-gestures-undo.js", name: "no snap on a drag",
    find: "          const snap = stairFaceSnap(md.stair);\n",
    with: "          const snap = null;\n",
    test: "dragged near the foundation wall, the flight's side snaps to its inside face and locks to it" },
  { file: "model/06-selection-pick.js", name: "the snap lands on the wall line, not its face",
    find: "    const faces = [o + k * startOff, o + k * endOff];\n",
    with: "    const faces = [o + k * 1e-3, o - k * 1e-3];\n",
    test: "dragged near the foundation wall, the flight's side snaps to its inside face and locks to it" },
  { file: "model/16-gestures-undo.js", name: "no lock is written",
    find: "            if (lock) md.stair.lock = lock; else delete md.stair.lock;\n",
    with: "",
    test: "dragged near the foundation wall, the flight's side snaps to its inside face and locks to it" },
  { file: "model/16-gestures-undo.js", name: "a lock never lets go",
    find: "            if (lock) md.stair.lock = lock; else delete md.stair.lock;\n",
    with: "            if (lock) md.stair.lock = lock;\n",
    test: "dragged well clear, nothing snaps and the lock lets go" },
  { file: "model/15-panels.js", name: "a thicker wall moves nothing",
    find: "    if (patch.wallType !== undefined || patch.refLine !== undefined) showStairFitNote(followStairLocks());\n",
    with: "",
    test: "a thicker foundation wall moves the locked side in, the far side stays, and a pop-up gives the new width" },
  { file: "model/06-selection-pick.js", name: "the whole flight moves, keeping its width",
    find: "      stair.widthFt = widthFt;\n",
    with: "",
    test: "a thicker foundation wall moves the locked side in, the far side stays, and a pop-up gives the new width" },
  { file: "model/06-selection-pick.js", name: "an up flight snaps to the foundation",
    find: "    const basement = Number(landing) === 1;\n",
    with: "    const basement = true;\n",
    test: "a flight going UP from the main floor (filed on 2ND) snaps to the MAIN floor wall's inside face, not the foundation's" },
  { file: "model/06-selection-pick.js", name: "both sides move",
    find: "        if (side === 'left') left = f; else right = f;\n",
    with: "        if (side === 'left') left = f; else { left += f - right; right = f; }\n",
    test: "locked between the foundation wall and a basement wall, a thicker foundation squeezes it from that side only" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4440' } });
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
