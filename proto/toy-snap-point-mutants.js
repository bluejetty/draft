#!/usr/bin/env node
// MUTATION GATE for TOY taking the point it lights (tests/toy-snap-point.spec.js).
//
// Movie, 27 Oct: "i'm trying to snap onto the end of the line, but it is
// snapping me couple inches over from it" -- on TOY: "it was probably to the
// 1ft".
//
// Run: node proto/toy-snap-point-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/toy-snap-point.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: 'TOY asks no snap, as before',
    find: "    const caught = !fixed || board === 'toy' ? drawSnap(at) : {};\n",
    with: "    const caught = !fixed && board !== 'toy' ? drawSnap(at) : {};\n",
    test: 'TOY: a first point pressed beside a line end, inside its ring, lands on the end' },
  { file: 'model/10-tracking-garage.js',
    name: 'TOY lights the first point and lands where the hand is',
    find: "    const snap = !fixed && (board !== 'toy' || lit) ? caught : {};\n",
    with: "    const snap = !fixed && board !== 'toy' ? caught : {};\n",
    test: 'TOY: a first point pressed beside a line end, inside its ring, lands on the end' },
  { file: 'model/10-tracking-garage.js',
    name: 'a square run takes the foot over the lit point',
    find: "    if (fixed && lit) return fixed === 'z' ? { x: lit.x, y: 0, z: wanted.z } : { x: wanted.x, y: 0, z: lit.z };\n",
    with: "",
    test: 'TOY: a run held square ends on the lit line end, not on the whole foot past it' },
  { file: 'model/10-tracking-garage.js',
    name: 'the square run slides on the wrong axis',
    find: "    if (fixed && lit) return fixed === 'z' ? { x: lit.x, y: 0, z: wanted.z } : { x: wanted.x, y: 0, z: lit.z };\n",
    with: "    if (fixed && lit) return fixed === 'x' ? { x: lit.x, y: 0, z: wanted.z } : { x: wanted.x, y: 0, z: lit.z };\n",
    test: 'TOY: a run held square ends on the lit line end, not on the whole foot past it' },
  { file: 'model/10-tracking-garage.js',
    name: 'the square run takes the lit point off square',
    find: "    if (fixed && lit) return fixed === 'z' ? { x: lit.x, y: 0, z: wanted.z } : { x: wanted.x, y: 0, z: lit.z };\n",
    with: "    if (fixed && lit) return { x: lit.x, y: 0, z: lit.z };\n",
    test: 'TOY: a run held square ends on the lit line end, not on the whole foot past it' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4794' } });
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
