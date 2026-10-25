#!/usr/bin/env node
// MUTATION GATE for the dimension POINT delete (Movie, 20 Oct): "select that
// 'point' arrows, etc where they meet and be able to DELETE it ... only that
// 'point will no longer be measured ... if an end 'point' is deleted from a
// dimension line, the entire line to the next point will be deleted". Each
// row breaks one line of MODEL.html, runs the one test that should notice,
// and restores the file from HEAD.
//
//   node proto/dim-points-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/dim-points.spec.js';

const MUTANTS = [
  { file: 'model/06-selection-pick.js',
    name: 'a point is never under the cursor',
    find: "      const point = dimPointAt(worldPt);\n      if (point && take(point)) return out;\n",
    with: "",
    test: 'DELETE on the point where two pieces meet joins them into one longer measurement' },
  { file: 'model/08-structure-roof.js',
    name: 'DELETE on a point takes the whole line',
    find: "    if (entry.type === 'dimension' && entry.point) return deleteDimPoint(entry.item, entry.point);\n",
    with: "",
    test: 'DELETE on the point where two pieces meet joins them into one longer measurement' },
  { file: 'model/08-structure-roof.js',
    name: 'the joined piece keeps its own far ref, not the neighbour\'s',
    find: "      if (farRef) dim[refKey] = { ...farRef }; else delete dim[refKey];\n",
    with: "",
    test: 'DELETE on the point where two pieces meet joins them into one longer measurement' },
  { file: 'model/08-structure-roof.js',
    name: 'an end point is treated as a meeting point',
    find: "    if (!next) {\n      const index = list.indexOf(dim);\n",
    with: "    if (false) {\n      const index = list.indexOf(dim);\n",
    test: 'DELETE on an end point takes the run to the next point; the string ends there now' },
  { file: 'model/06-selection-pick.js',
    name: 'a point on an AUTO dimension is picked too',
    find: "      if (d.auto) return;\n      const line = dimDrawnLine(d);\n      if (!line) return;\n      [['start', line[0]], ['end', line[1]]]",
    with: "      const line = dimDrawnLine(d);\n      if (!line) return;\n      [['start', line[0]], ['end', line[1]]]",
    test: 'a point on an AUTO dimension is not offered; the hand piece sharing the corner goes instead' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4509' } });
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
