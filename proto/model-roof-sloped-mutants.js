#!/usr/bin/env node
// MUTATION GATE for the SLOPED roof edge (tests/model-html-roof-move.spec.js).
//
// Movie, 18 Oct: "that corner node i would delete to cut off the corner and
// match the 45 (it would be a sloped eave)" -- "keep the PLANE / SLOPE of roof
// FIXED". The geometry has its own mutants in proto/roof-skeleton-harness.js.
//
// Run: node proto/model-roof-sloped-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-roof-move.spec.js';
const T = 'a corner node DELETEd on a plain roof: a SLOPED edge, the planes the corner had, cut along it';
const MUTANTS = [
  { file: 'MODEL.html', name: "a corner DELETEd joins its edges as a plain eave",
    find: "    if (turn > 1e-6) roof.edges[(i - 1 + n0) % n0] = 'sloped';\n",
    with: "",
    test: T },
  { file: 'MODEL.html', name: "a node on a straight run DELETEd leaves a SLOPED edge too",
    find: "    if (turn > 1e-6) roof.edges",
    with: "    if (turn >= 0) roof.edges",
    test: "a BREAK node DELETEd from a straight eave just goes; no SLOPED edge" },
  { file: 'MODEL.html', name: "the EDGE panel has no SLOPED chip",
    find: "['gable', 'GABLE'], ['sloped', 'SLOPED']];",
    with: "['gable', 'GABLE']];",
    test: T },
  { file: 'MODEL.html', name: "a SLOPED edge reads as an eave in the page",
    find: "  const roofEdgeKind = k => (k === 'gable' || k === 'sloped' ? k : 'eave');",
    with: "  const roofEdgeKind = k => (k === 'gable' ? k : 'eave');",
    test: T },
  { file: 'drawing-format.js', name: "the format turns SLOPED back into an eave",
    find: "(roof.edges[index] === 'gable' || roof.edges[index] === 'sloped')",
    with: "(roof.edges[index] === 'gable')",
    test: T },
  { file: 'geometry-2d.js', name: "the geometry ignores SLOPED",
    find: "    if (n < 3 || !kinds.includes('sloped')) return null;",
    with: "    return null;",
    test: T },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4443' } });
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
