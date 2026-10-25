#!/usr/bin/env node
// MUTATION GATE for the floor layout's dimensions
// (tests/floor-layout-dims.spec.js).
//
// Movie, 16 Oct, marked up on the 2ND FL FLOOR LAYOUT: the stair opening's
// dims OUTSIDE the plan when the opening is within 3 ft of the exterior
// wall's outside perimeter line; the FLUSH/DROPPED BEAM note and the beam's
// string on opposite sides of the beam, one note for a beam laid in pieces;
// the FLOOR layouts dimension the floor only, not out to the garage. The
// arithmetic's rows are proto/dim-layers-harness.js's (the outside string)
// and proto/render-2d-harness.js's (the tag's side); these are the pages'
// links to them.
//
// Run: node proto/floor-layout-dims-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/floor-layout-dims.spec.js';

const MUTANTS = [
  { file: 'auto-dims.js',
    name: 'an opening hugging the wall is strung inside, between the two',
    find: '        const hug = order.find(index => hugs[index]);',
    with: '        const hug = undefined;',
    test: 'the stair opening is strung OUTSIDE the plan when it is within 3 ft of the wall, past the stack' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the perimeter stack is not handed over, so the outside string lands on it',
    find: '      perimeter: segments || [],',
    with: '      perimeter: [],',
    test: 'the stair opening is strung OUTSIDE the plan when it is within 3 ft of the wall, past the stack' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a FLOOR layout strings out to the garage again',
    find: "    const strung = view === 'floor' ? outlines.filter(outline => !outline.garage) : outlines;",
    with: '    const strung = outlines;',
    test: 'a FLOOR layout dimensions the floor only, not out to the garage' },
  { file: 'model/01-skin-view.js',
    name: 'MODEL tags every beam on its old side, string or no string',
    find: '    const tags = R.beamTagSides(beams(), dimensions());',
    with: '    const tags = new Map();',
    test: 'the FLUSH BEAM note goes on the side opposite the string, once per beam line' },
  { file: 'plan-composition.js',
    name: 'the LAYOUT sheet tags every beam on its old side',
    find: "      const tags = typeof render.beamTagSides === 'function' ? render.beamTagSides(beamsHere, dimensions) : new Map();",
    with: '      const tags = new Map();',
    test: 'the FLUSH BEAM note goes on the side opposite the string, once per beam line' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4363' } });
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
