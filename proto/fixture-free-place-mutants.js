#!/usr/bin/env node
// MUTATION GATE for placing a fixture anywhere (Movie, 24 Oct: "i can't place
// the INDUVIDUAL items of the kitchen items manually yet"): pressed away from
// every wall it drops free, centred on the press, one UNDO. Each row breaks
// one line, runs the one test that should notice, and restores from HEAD.
//
//   node proto/fixture-free-place-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/fixture-free-place.spec.js';

const MUTANTS = [
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a press away from a wall is refused again',
    find: "    if (!placement) return freeFixturePress(kind, at);\n",
    with: "    if (!placement) { sayOnStrip('Press near a wall.'); return null; }\n",
    test: 'a STOVE pressed in the middle of the room' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the free piece is not centred on the press',
    find: "      const dx = at.x - geo.center.x, dz = at.z - geo.center.z;\n",
    with: "      const dx = 0, dz = 0;\n",
    test: 'a STOVE pressed in the middle of the room' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4551' } });
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
