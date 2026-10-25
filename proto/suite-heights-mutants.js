#!/usr/bin/env node
// MUTATION GATE for a suite's heights (tests/suite-heights.spec.js).
//
// Movie, 20 Oct: "the HEIGHTS won't really need to be determined until it is
// place onto a plan and it will take the floor and ceiling height and fit
// itself into that height" -- and on the boneyard, a stand-in marked as set
// when placed.
//
// Run: node proto/suite-heights-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/suite-heights.spec.js';
const MUTANTS = [
  { file: 'hologram.js', name: 'a placed suite keeps its own file\'s heights',
    find: "            { ...placed(holo, suiteExisting(holo, parts(holo).existing, info)), ...shellHeights(saved) }, levels);\n",
    with: "            placed(holo, suiteExisting(holo, parts(holo).existing, info)), levels);\n",
    test: 'PLACED AS A SUITE' },
  { file: 'hologram.js', name: 'the floor\'s wall heights are not handed over',
    find: "  const SHELL_HEIGHT_KEYS = ['levelAssemblies', 'sectionTable',",
    with: "  const SHELL_HEIGHT_KEYS = ['sectionTable',",
    test: 'PLACED AS A SUITE' },
  { file: 'hologram.js', name: 'a suite file still blue keeps its own heights',
    find: "        const fits = isSuiteFile(holo);\n",
    with: "        const fits = false;\n",
    test: 'A SUITE FILE STILL BLUE' },
  { file: 'hologram.js', name: 'a plain hologram is fitted to the floor too',
    find: "        const fits = isSuiteFile(holo);\n",
    with: "        const fits = true;\n",
    test: 'A SUITE FILE STILL BLUE' },
  { file: 'model/07-walls-magnet.js', name: 'a suite wall is drawn at the plain 8\' default',
    find: "      topHeight: topHeight ?? suiteStandIn(levelId) ?? wallSetting('wallTopHeight', 8),\n",
    with: "      topHeight: topHeight ?? wallSetting('wallTopHeight', 8),\n",
    test: 'a commercial suite' },
  { file: 'model/07-walls-magnet.js', name: 'a commercial suite stands in at the residential height',
    find: "  const SUITE_STAND_IN_FT = { residential: 8, commercial: 10 };\n",
    with: "  const SUITE_STAND_IN_FT = { residential: 8, commercial: 8 };\n",
    test: 'a commercial suite' },
  { file: 'model/15-panels.js', name: 'PROPERTIES does not say the floor sets it',
    find: "    if (standIn != null) {\n      const note = document.createElement('div');\n",
    with: "    if (false) {\n      const note = document.createElement('div');\n",
    test: 'a residential suite' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4465' } });
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
