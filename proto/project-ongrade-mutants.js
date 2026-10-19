#!/usr/bin/env node
// MUTATION GATE for the ON-GRADE house's frost wall (Movie, 18 Oct: "for the
// project ON GRADE foundation use 4' frost wall with footing (not 8ft / go to
// 4ft" -- "default 4ft, allow the user to change to 8ft or 9ft etc"). The
// floor hung on the foundation's inside face is gated in
// proto/section-table-harness.js --mutate.
//
// The ICF floor-framing hold (19 Oct) is gated here too.
//
// Run: node proto/project-ongrade-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/project-over-garage.spec.js'];
const MUTANTS = [
  { file: 'PROJECT.html', name: "ON-GRADE keeps the basement wall", spec: 'tests/project-over-garage.spec.js',
    find: "              setAssembly(1, 'wallHeightFt', ON_GRADE_FROST_WALL_FT + attachmentFt());\n",
    with: "",
    test: "ON-GRADE pours a 4' frost wall" },
  { file: 'PROJECT.html', name: "1 STOREY keeps the frost wall", spec: 'tests/project-over-garage.spec.js',
    find: "              setAssembly(1, 'wallHeightFt', assemblyDefaults(1).wallHeightFt);\n",
    with: "",
    test: "ON-GRADE pours a 4' frost wall" },
  // CONCRETE STANDS ON CONCRETE (Movie, 19 Oct: "the PLATFORM framing method
  // won't work on floors with CONC ICF bearing down"): an ICF storey holds its
  // floor on BALLOON / LEDGER; wood leaves both.
  { file: 'PROJECT.html', name: "ICF lets the floor stay platform", spec: 'tests/project-over-garage.spec.js',
    find: "const ledgerForced = levelId => /^icf|^concrete/.test(floorWallType(levelId));",
    with: "const ledgerForced = () => false;",
    test: "an ICF storey holds its floor on BALLOON / LEDGER" },
  { file: 'PROJECT.html', name: "a wall type change never re-holds the floor", spec: 'tests/project-over-garage.spec.js',
    find: "setAssembly(level.id, 'wallType', value);\n            holdIcfLedgers();",
    with: "setAssembly(level.id, 'wallType', value);",
    test: "an ICF storey holds its floor on BALLOON / LEDGER" },
  { file: 'PROJECT.html', name: "PLATFORM still offered on ICF", spec: 'tests/project-over-garage.spec.js',
    find: ".filter(type => type.id === 'balloon' || !ledgerForced(level.id)",
    with: ".filter(type => true || !ledgerForced(level.id)",
    test: "an ICF storey holds its floor on BALLOON / LEDGER" },
  { file: 'PROJECT.html', name: "an anchorless choice keeps its first list", spec: 'tests/project-over-garage.spec.js',
    find: "          refreshChoices(control, el);\n",
    with: "",
    test: "an ICF storey holds its floor on BALLOON / LEDGER" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4451' } });
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
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
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
