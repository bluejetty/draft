#!/usr/bin/env node
// MUTATION GATE for the roof with no 45s of its own (tests/roof-cricket.spec.js).
//
// Movie, 16 Oct: "you know about these 45 degree roof corners we need to get
// rid of right", and on the 15th "they should been all 90 degrees no 45s".
// The build cut a 2 ft chamfer at an inside corner (the cricket) since 19 Sep;
// it cuts none now, and geometry-2d's cricketRing waits for the drafter to
// ask for one. The row below puts the chamfer back; the regroup's own copy
// is proto/garage-roofs-harness.js's row.
//
// Run: node proto/roof-no-45s-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/roof-cricket.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the build cuts the cricket again: a 45 at the inside corner',
    find: '    const shaped = notched || plain;',
    with: "    const shaped = G.cricketRing((notched || plain).points, (notched || plain).edges, (notched || plain).edgeOverhang, { needsCricket: () => true }) || notched || plain;",
    test: 'the inside corner is a corner' },

];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4360' } });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html', { cwd: ROOT }).toString().trim();
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
