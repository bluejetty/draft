#!/usr/bin/env node
// MUTATION GATE for the optional house on the site plan
// (tests/site-footprint-optional.spec.js).
//
// Movie, 6 Nov: "i decided not to AUTOBUILD a house, i just want to draw a
// site plan, but this GREY BOX appears and i can't seem to delete it ...
// the AUTOHOUSE should be optional, NOT required for a user to choose".
//
// Four defects that still render: a switch nobody reads, a press that
// cannot reach the box, a DELETE that leaves the roof standing shaded, and
// a hidden roof still in reach of a press.
//
// Run: node proto/site-footprint-optional-mutants.js
//      (refuses a dirty tree on the mutated files; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/site-footprint-optional.spec.js';

const MUTANTS = [
  { file: 'layout-plan.js',
    name: 'the file\'s HOUSE FOOTPRINT switch is read by the site plan\'s parts',
    find: "    if (saved?.siteFootprint === false) return { lot, bodies: [], roofs: [] };",
    with: "    if (saved?.siteFootprint === 'never') return { lot, bodies: [], roofs: [] };",
    test: 'hides the building' },
  { file: 'model/06-selection-pick.js',
    name: 'a press inside the grey box on SITE reaches the ground storey\'s outline',
    find: "      if (takeAll('outline', [...outlinesAt(worldPt), ...siteBodiesAt(worldPt)])) return out;",
    with: "      if (takeAll('outline', outlinesAt(worldPt))) return out;",
    test: 'DELETE takes it and its roof' },
  { file: 'model/08-structure-roof.js',
    name: 'DELETE on the footprint takes the roof over it in the same press',
    find: "      over.forEach(roof => take(drawing.roofs || [], roof));",
    with: "      ",
    test: 'DELETE takes it and its roof' },
  { file: 'model/06-selection-pick.js',
    name: 'a roof hidden with the footprint is out of a press\'s reach',
    find: "  const pickRoofs = () => (activeLevelId() === SITE_LEVEL_ID ? siteParts().roofs : roofs());",
    with: "  const pickRoofs = () => (activeLevelId() === SITE_LEVEL_ID ? (drawing?.roofs || []).filter(r => Number(r.levelId) === ROOF_LEVEL_ID) : roofs());",
    test: 'hides the building' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4361' } });
    return 'passed';
  } catch { return 'failed'; }
};

const files = [...new Set(MUTANTS.map(m => m.file))].join(' ');
const dirty = execSync(`git status --porcelain ${files}`, { cwd: ROOT }).toString().trim();
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
