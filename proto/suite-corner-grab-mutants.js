#!/usr/bin/env node
// MUTATION GATE for a suite held by its corner (tests/suite-corner-grab.spec.js).
//
// Movie, 26 Oct, the one snapping rule: "whole-thing drags grab the nearest
// own corner within reach", SUPERNODE gone ("maybe we can get rid of that, it
// didn't work that good"), and Ctrl held for no snap at all. Five seams: the
// corner taken on the press, the corner's catch on a house point, the
// T-square holding that catch to the hand's axis, the cyan ring before the
// press, and Ctrl switching every reach off.
//
// Run: node proto/suite-corner-grab-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/suite-corner-grab.spec.js';

const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js',
    name: 'the press takes no corner',
    find: "    traceMoving.grab = traceMoving.hologram ? suiteGrabAt(traceMoving.underlay, traceMoving.from)\n",
    with: "    traceMoving.grab = traceMoving.hologram ? null\n",
    test: 'a press by the suite\'s corner takes that corner exactly' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the corner catches nothing',
    find: "    m.pointLock = suitePointLock(m);\n",
    with: "    m.pointLock = null;\n",
    test: 'the suite\'s corner lands on it exactly and its window cuts the shell' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the catch goes off the square',
    find: "      m.underlay.z += held === 'z' ? 0 : m.pointLock.dz;\n",
    with: "      m.underlay.z += m.pointLock.dz;\n",
    test: 'T-square lit: the corner\'s catch moves the suite along the hand\'s axis only' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'no cyan ring before the press',
    find: "    if (key !== suiteHoverKey) { suiteHoverKey = key; requestAnimationFrame(() => paint()); }\n",
    with: "    if (key !== suiteHoverKey) { suiteHoverKey = key; }\n",
    test: 'a press by the suite\'s corner takes that corner exactly' },
  { file: 'model/07-walls-magnet.js',
    name: 'Ctrl held still catches',
    find: "    if (snapHeldOff) return -1;\n",
    with: "",
    test: 'Ctrl held: nothing catches' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4730' } });
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
