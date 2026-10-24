#!/usr/bin/env node
// MUTATION GATE for the SIDELIGHT door (Movie, 24 Oct): its panels, its
// D36/14 and D14/36/14 marks, the file keeping its sides and light, and the
// PROPERTIES rows that set them. Each row breaks one line, runs the one test
// that should notice, and restores from HEAD.
//
//   node proto/sidelight-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/sidelight-door.spec.js';

const MUTANTS = [
  { file: 'geometry-2d.js',
    name: 'the latch-side light goes at the hinge',
    find: "    const panels = sides === 'latch' ? [['door', 0, doorFt], ['light', doorFt, total]]\n",
    with: "    const panels = sides === 'latch' ? [['light', 0, lightFt], ['door', lightFt, total]]\n",
    test: 'its panels' },
  { file: 'geometry-2d.js',
    name: 'BOTH SIDES counts one light',
    find: "    const n = sides === 'both' ? 2 : 1;\n    const fits = l => l > 0 && total - n * l >= 1;\n    const stored = Number(opening?.sidelightWidth);\n",
    with: "    const n = 1;\n    const fits = l => l > 0 && total - n * l >= 1;\n    const stored = Number(opening?.sidelightWidth);\n",
    test: 'its panels' },
  { file: 'geometry-2d.js',
    name: 'a light that leaves no leaf is taken as stored',
    find: "    const lightFt = fits(stored) ? stored : fits(SIDELIGHT_DEFAULT_FT) ? SIDELIGHT_DEFAULT_FT : total / 4;\n",
    with: "    const lightFt = stored > 0 ? stored : fits(SIDELIGHT_DEFAULT_FT) ? SIDELIGHT_DEFAULT_FT : total / 4;\n",
    test: 'its panels' },
  { file: 'fen-labels.js',
    name: 'a sidelight is marked by its whole width',
    find: "    if (opening.doorStyle === 'sidelight') {\n",
    with: "    if (false) {\n",
    test: 'its mark says both' },
  { file: 'fen-labels.js',
    name: 'only two panels are said',
    find: "    const width = panels ? splitFt.map(size).join('/') : String(size(widthFt));\n",
    with: "    const width = panels ? splitFt.slice(0, 2).map(size).join('/') : String(size(widthFt));\n",
    test: 'its mark says both' },
  { file: 'drawing-format.js',
    name: 'the file forgets a sidelight\'s sides',
    find: "          sidelightSides: oneOf(opening?.sidelightSides, ['latch', 'hinge', 'both'], 'latch'),\n",
    with: "",
    test: 'the file keeps' },
  { file: 'MODEL.html',
    name: 'BOTH SIDES keeps the unit\'s width and squeezes the leaf',
    find: "            const refusal = resizeOpenings(p.doorFt + count(sides) * p.lightFt,\n",
    with: "            const refusal = resizeOpenings(Number(only.width),\n",
    test: 'PROPERTIES: SIDELIGHT BOTH SIDES' },
  { file: 'geometry-2d.js',
    name: 'EXT – SIDELIGHT is not in the DOOR list',
    find: "    { id: 'ext-sidelight', type: 'ext', style: 'sidelight', label: 'EXT – SIDELIGHT', sizes: inches([50, 64]), defaultFt: 50 / 12 },\n",
    with: "",
    test: 'picked from the DOOR list' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4548' } });
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
