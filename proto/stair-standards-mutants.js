#!/usr/bin/env node
// MUTATION GATE for the STAIRS in STANDARDS (Movie, 25 Oct): the page shows
// the office's stair numbers, reads inches or feet-and-inches, refuses
// nonsense, keeps them in the standards package and RESET puts them back;
// the model lays a stair out by them -- MAX RISER the risers, TREAD RUN the
// run, MIN WIDTH the least WIDTH and the popup's start.
//
//   node proto/stair-standards-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-standards.spec.js';

const MUTANTS = [
  { file: 'STANDARDS.html',
    name: 'the stair numbers are not kept in the package',
    find: "      const saveActive = message => {\n        const pkg = manager.createPackage('standards', packageName, { model:{ layerStandards, structureStandards, roomMinimums, roomTray, fenestrationStandards, stairStandards, companyLogos } });\n",
    with: "      const saveActive = message => {\n        const pkg = manager.createPackage('standards', packageName, { model:{ layerStandards, structureStandards, roomMinimums, roomTray, fenestrationStandards, companyLogos } });\n",
    test: 'STANDARDS has a STAIRS section' },
  { file: 'STANDARDS.html',
    name: 'a bare number is read as feet',
    find: "        return Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);\n",
    with: "        return 12 * (Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0));\n",
    test: 'STANDARDS has a STAIRS section' },
  { file: 'STANDARDS.html',
    name: 'RESET leaves the stair numbers as they were',
    find: "        stairStandards = SG.normaliseStairStandards(null);\n        fillStairStandards();\n",
    with: "",
    test: 'STANDARDS has a STAIRS section' },
  { file: 'stair-geometry.js',
    name: 'the package is never read',
    find: "      try { raw = window.DraftProfileManager?.getActive?.('standards')?.content?.model?.stairStandards; } catch { raw = null; }\n",
    with: "      raw = null;\n",
    test: 'the model lays a stair out' },
  { file: 'stair-geometry.js',
    name: 'the run keeps a 10\" tread',
    find: "    return { riseFt: riseIn / 12, risers, riserIn, treads, runFt: treads * stairStandards().treadRunIn / 12 };\n",
    with: "    return { riseFt: riseIn / 12, risers, riserIn, treads, runFt: treads * 10 / 12 };\n",
    test: 'the model lays a stair out' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'WIDTH keeps a 36\" least',
    find: "    if (!(want >= stairMinWidthIn())) {\n",
    with: "    if (!(want >= 36)) {\n",
    test: 'the model lays a stair out' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the popup shows 36 whatever the office says',
    find: "      width.value = String(stairHand.widthIn);\n",
    with: "",
    test: 'the model lays a stair out' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4569' } });
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
