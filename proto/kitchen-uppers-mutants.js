#!/usr/bin/env node
// MUTATION GATE for the kitchen's UPPERS switch (Movie, 24 Oct): "allow the
// lower cabinets to turn on or off upper cabinet that would match the width.
// oh ya also above the fridge too, but the fridge upper cabinet should be 18"
// deep" -- every lower piece ON as it comes, none over an island, the switch
// in PROPERTIES, only OFF in the file, and a cabinet run's uppers cut round
// each piece standing in it. Each row breaks one line, runs the one test
// that should notice, and restores from HEAD.
//
//   node proto/kitchen-uppers-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/kitchen-uppers.spec.js tests/kitchen-corner.spec.js';

const MUTANTS = [
  { file: 'fixture-kinds.js',
    name: 'the switch is ignored: OFF still hangs them',
    find: "    && (typeof fixture === 'string' || fixture?.uppers !== false);\n",
    with: "    ;\n",
    test: 'UPPERS OFF' },
  { file: 'fixture-kinds.js',
    name: 'the sink base starts with none again',
    find: "{ id: 'sinkbase', label: 'SINK BASE', group: 'KITCHEN', widthFt: 4, depthFt: 2, casework: false, run: false, uppers: true,",
    with: "{ id: 'sinkbase', label: 'SINK BASE', group: 'KITCHEN', widthFt: 4, depthFt: 2, casework: false, run: false, uppers: false,",
    test: 'every lower piece' },
  { file: 'fixture-kinds.js',
    name: 'a piece on an island hangs uppers too',
    find: "    return typeof fixture === 'string' || !(Number(fixture?.standoff) > 0);\n",
    with: "    return true;\n",
    test: 'every lower piece' },
  { file: 'render-2d.js',
    name: 'the fridge\'s upper is 12" like the rest',
    find: "  const FRIDGE_UPPER_DEPTH_FT = 1.5;\n",
    with: "  const FRIDGE_UPPER_DEPTH_FT = 1;\n",
    test: '18" deep' },
  { file: 'drawing-format.js',
    name: 'the file forgets OFF',
    find: "        ...(fixture?.uppers === false ? { uppers: false } : {}),\n",
    with: "",
    test: 'UPPERS OFF' },
  { file: 'MODEL.html',
    name: 'PROPERTIES has no UPPERS',
    find: "    if (KU?.takesUppers && items.every(f => KU.takesUppers(f))) {\n",
    with: "    if (false) {\n",
    test: 'UPPERS OFF' },
  { file: 'render-2d.js',
    name: 'a run\'s uppers run on over a piece switched OFF',
    find: "  const upperCutsOn = (fixture, fixtures, env) => (fixture.kind !== 'cabinet' ? []\n",
    with: "  const upperCutsOn = (fixture, fixtures, env) => (true ? []\n",
    test: 'switched OFF' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4557' } });
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
