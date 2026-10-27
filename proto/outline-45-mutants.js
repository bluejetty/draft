#!/usr/bin/env node
// MUTATION GATE for the outline's 45 on DRAFTING (tests/outline-45.spec.js).
//
// Movie, 17 Oct, tracing the North Point building's chamfered corner: "the
// 45 angle i need it too". Three seams: the outline's step (an eighth turn
// on DRAFTING, a quarter on TOY), the edge home's eighth of an inch with the
// last corner sliding along its own edge to make the edge home exact, and
// the strip saying a 45's legs.
//
// Run: node proto/outline-45-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/outline-45.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: 'the outline turns square on DRAFTING too, as it did',
    find: "  const outlineStep = () => (board === 'toy' ? 90 : 45);\n",
    with: "  const outlineStep = () => 90;\n",
    test: 'on DRAFTING a typed 45 lays the chamfer, says its legs, and the typed edge home closes square within the eighth' },
  { file: 'model/10-tracking-garage.js',
    name: 'TOY takes the 45 as well',
    find: "  const outlineStep = () => (board === 'toy' ? 90 : 45);\n",
    with: "  const outlineStep = () => 45;\n",
    test: 'TOY still turns square: a press aimed near the diagonal lands on the axis' },
  { file: 'model/10-tracking-garage.js',
    name: 'the edge home must land exactly, so the 45 never closes',
    find: '  const OUTLINE_HOME_FT = 1 / 96;\n',
    with: '  const OUTLINE_HOME_FT = 0;\n',
    test: 'on DRAFTING a typed 45 lays the chamfer, says its legs, and the typed edge home closes square within the eighth' },
  { file: 'model/10-tracking-garage.js',
    name: 'the last corner stays put and the edge home leans',
    find: '          outlineCorners[outlineCorners.length - 1] = home;\n',
    with: '',
    test: 'on DRAFTING a typed 45 lays the chamfer, says its legs, and the typed edge home closes square within the eighth' },
  { file: 'model/10-tracking-garage.js',
    name: 'with no instrument lit the outline still turns in eighths',
    find: '      const hand = protractorOn ? outlineHand(from, at, protractorStep) : outlineAligned(at);\n',
    with: '      const hand = outlineHand(from, at, 45);\n',
    test: 'on DRAFTING with no instrument lit the outline turns at any angle, unrounded, and closes on the first corner' },
  { file: 'model/10-tracking-garage.js',
    name: 'a free outline still has to come home square',
    find: "    if (board !== 'toy' && !tsquareLive() && !protractorOn && angleLockDeg() == null) return last;\n",
    with: '',
    test: 'on DRAFTING with no instrument lit the outline turns at any angle, unrounded, and closes on the first corner' },
  { file: 'model/10-tracking-garage.js',
    name: 'a 45 goes down without its legs said',
    find: '    if (from) sayDiagonal(from, pt);\n',
    with: '',
    test: 'on DRAFTING a typed 45 lays the chamfer, says its legs, and the typed edge home closes square within the eighth' },
  { file: 'model/10-tracking-garage.js',
    name: 'a one-corner outline closes on a short first edge and loses it',
    find: '    if (first && outlineCorners.length >= 3\n      && Math.hypot',
    with: '    if (first\n      && Math.hypot',
    test: 'a first edge shorter than the close-the-loop reach is kept, not pulled home' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4471' } });
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
