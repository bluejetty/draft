#!/usr/bin/env node
// MUTATION GATE for LAYOUT's scales (tests/sheet-fit.spec.js,
// tests/layout-edit-in-model.spec.js).
//
// Movie, 18 Oct: "we put the E2 and E4 (long sides) to the same scale as the
// SITE PLAN ... 1'=30" ... the E1 and E3 (short width sides) look good at the
// current 3/32" =1'" -- and "add a second inquiry below: 'CHANGE SCALE?:'".
//
// Run: node proto/layout-scale-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/sheet-fit.spec.js tests/layout-edit-in-model.spec.js';
const MUTANTS = [
  { file: 'LAYOUT.html', name: "the ladder stops at 3/32\"",
    find: "const AUTO_SCALE_PREFS = [1 / 4, 3 / 16, 1 / 8, 3 / 32,\n  1 / 20, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 200];\n",
    with: "const AUTO_SCALE_PREFS = [1 / 4, 3 / 16, 1 / 8, 3 / 32];\n",
    test: "a building 3/32\" cannot hold: the long elevations at 1\" = 30', the short ends at 3/32\", the plans on one engineer's rung" },
  { file: 'LAYOUT.html', name: "the elevation pair never splits",
    find: "      const pifs = elevSheet && pif < 3 / 32 - 1e-9\n",
    with: "      const pifs = false\n",
    test: "a building 3/32\" cannot hold: the long elevations at 1\" = 30', the short ends at 3/32\", the plans on one engineer's rung" },
  { file: 'LAYOUT.html', name: "the short end is not held at 3/32\"",
    find: "        ? views.map(view => Math.min(3 / 32, this._autoScaleFor([cropped(view)], share))) : pif;\n",
    with: "        ? views.map(view => this._autoScaleFor([cropped(view)], share)) : pif;\n",
    test: "a building 3/32\" cannot hold: the long elevations at 1\" = 30', the short ends at 3/32\", the plans on one engineer's rung" },
  { file: 'LAYOUT.html', name: "a pick re-scales nothing",
    find: "    on('[data-edit-scale-list]', 'change', e => this._rescaleAsked(Number(e.target.value)));\n",
    with: "",
    test: "CHANGE SCALE? under it: a list of the usual scales with this one picked, and a box for any other" },
  { file: 'LAYOUT.html', name: "a typed scale is not read",
    find: "      const pif = parseScale(e.target.value);\n",
    with: "      const pif = null;\n",
    test: "CHANGE SCALE? under it: a list of the usual scales with this one picked, and a box for any other" },
  { file: 'LAYOUT.html', name: "a typed scale is not named",
    find: "  if (feet >= 1 && Math.abs(feet - Math.round(feet)) < 1e-6) return `1\" = ${Math.round(feet)}'`;\n",
    with: "",
    test: "CHANGE SCALE? under it: a list of the usual scales with this one picked, and a box for any other" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4439' } });
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
