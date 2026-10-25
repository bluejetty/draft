#!/usr/bin/env node
// MUTATION GATE for the GABLE ROOF drawn by hand (tests/gable-roof.spec.js).
//
// Movie, 22 Oct: "a 2-sided ... gable roof with 2 edges specified (opposite
// edges PEAK will be in the middle and eaves on outside"; "for this one ASK
// overhang (and pitch)"; "place the edges of the roof where the user places
// the ends of his EDGE marks".
//
// Run: node proto/gable-roof-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/gable-roof.spec.js';
const MUTANTS = [
  { file: 'model/08-structure-roof.js', name: 'the eaves sit on the lines, no overhang out past them',
    find: "const out = (p, k) => ({ x: p.x + n.x * k, z: p.z + n.z * k });",
    with: "const out = (p, k) => ({ x: p.x, z: p.z });",
    test: 'two eave lines' },
  { file: 'model/08-structure-roof.js', name: 'the ends crossed: the first line\'s start meets the second line\'s far end',
    find: "const [c, d] = t(s.c) <= t(s.d) ? [s.c, s.d] : [s.d, s.c];",
    with: "const [c, d] = [s.c, s.d];",
    test: 'drawn backwards' },
  { file: 'model/08-structure-roof.js', name: 'four eaves: a hip roof, no gable ends',
    find: "const edges = ['eave', 'gable', 'eave', 'gable'];",
    with: "const edges = ['eave', 'eave', 'eave', 'eave'];",
    test: 'two eave lines' },
  { file: 'model/08-structure-roof.js', name: 'a second line any way at all',
    find: "if (Math.abs(ax * cz - az * cx) / (al * cl) > Math.sin(5 * Math.PI / 180)) {",
    with: "if (false) {",
    test: 'does not run the same way' },
  { file: 'model/08-structure-roof.js', name: 'the pitch asked and then ignored',
    find: "      pitch,\n      fascia: ROOF_FASCIA_IN,\n      garage: false,\n      follows: 'none',\n      layer: 'A-ROOF',\n    });\n    shedRoof = null;\n    gableAsk.hidden = true;",
    with: "      pitch: 3,\n      fascia: ROOF_FASCIA_IN,\n      garage: false,\n      follows: 'none',\n      layer: 'A-ROOF',\n    });\n    shedRoof = null;\n    gableAsk.hidden = true;",
    test: 'two eave lines' },
  { file: 'model/08-structure-roof.js', name: 'any pitch taken, nonsense included',
    find: "if (!Number.isFinite(pitch) || pitch <= 0 || pitch > 24) {",
    with: "if (false) {",
    test: 'bad pitch' },
  { file: 'model/08-structure-roof.js', name: 'CANCEL leaves the questions up',
    find: "const endShedRoof = () => { shedRoof = null; if (gableAsk) gableAsk.hidden = true; paint(); };",
    with: "const endShedRoof = () => { shedRoof = null; paint(); };",
    test: 'CANCEL in the questions' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4517' } });
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
