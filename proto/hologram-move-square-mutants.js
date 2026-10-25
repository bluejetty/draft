#!/usr/bin/env node
// MUTATION GATE for the T-SQUARE and FOOT LIGHT on a hologram MOVE
// (tests/hologram-move-square.spec.js).
//
// Movie, 19 Oct: "when i MOVE the hologram --- when the T SQUARE is engaged
// it should only move in 90's from its original position". Three seams: the
// square, the foot, and the square not leaking when the T-square is up.
//
// NOT HERE: the suite snap's slide being held to the moving axis. That needs
// a suite lined up with a shell, and the suite specs (Opus, #806) own that
// fixture; the seam is one line and read in review.
//
// Run: node proto/hologram-move-square-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/hologram-move-square.spec.js';

const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js',
    name: 'the move ignores the T-square',
    find: '    const squaredAt = squareTo(from, at);\n',
    with: '    const squaredAt = at;\n',
    test: 'with the T-SQUARE down a MOVE goes along one axis only, from where it stood' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the move squares with the T-square up',
    find: '    const squaredAt = squareTo(from, at);\n',
    with: '    const squaredAt = Math.abs(at.x - from.x) >= Math.abs(at.z - from.z) ? { x: at.x, z: from.z } : { x: from.x, z: at.z };\n',
    test: 'with the T-SQUARE up the same drag goes where the hand went' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the move ignores the foot light',
    find: '    return onTheFoot_if() ? onTheFoot(from, squaredAt, 0) : squaredAt;\n',
    with: '    return squaredAt;\n',
    test: 'the FOOT LIGHT lands the move on the whole foot, and TOY squares and rounds both' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the move is measured from the hand, not from where it stood',
    find: '    m.underlay.x = m.before.x + (to.x - m.from.x);\n    m.underlay.z = m.before.z + (to.z - m.from.z);\n',
    with: '    m.underlay.x = m.before.x + (to.x - m.from.x);\n    m.underlay.z = m.before.z + (at.z - m.from.z);\n',
    test: 'with the T-SQUARE down a MOVE goes along one axis only, from where it stood' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4472' } });
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
