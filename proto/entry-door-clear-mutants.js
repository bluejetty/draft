#!/usr/bin/env node
// MUTATION GATE for the front door clear of the garage on a traced bilevel
// (tests/entry-door-clear.spec.js).
//
// Movie, 17 Oct: "the Front Door can't bump into the garage like that it
// needs at least 4-6 from the edge of the garage wall to the side of the
// entry area ... so the door fits plus extra 9\" approx on each side". The
// engines (proto/traced-plans-harness.js, proto/premade-plans-harness.js)
// bend the two modules offline; these rows bend the same two seams and ask
// the built drawing, through the bone, whether it noticed.
//
// Run: node proto/entry-door-clear-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/entry-door-clear.spec.js';

const MUTANTS = [
  { file: 'traced-plans.js',
    name: 'the garage line is read only where the garage lies on the front line',
    find: '      const reach = garage.filter(p => p.z >= z - ENTRY_JOG_REACH_FT).map(p => p.x);\n',
    with: '      const reach = garage.filter(p => Math.abs(p.z - z) < TOL).map(p => p.x);\n',
    test: 'his jogged garage: the landing straddles the garage\'s real side wall and the front door stands clear of it' },
  { file: 'premade-plans.js',
    name: 'the MOD BILEVEL street door goes back against the far wall',
    find: '    opening(3, STREET_DOOR_IN_FT, FRONT_DOOR_FT, \'door\'),\n',
    with: '    opening(3, 3, FRONT_DOOR_FT, \'door\'),\n',
    test: 'his jogged garage: the landing straddles the garage\'s real side wall and the front door stands clear of it' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4426' } });
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
