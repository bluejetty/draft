#!/usr/bin/env node
// MUTATION GATE for the holograms in the BONEYARD (Movie, 25 Oct): one button
// per hologram file at the foot of the levels column, in its card colour, its
// copies counted, OFF at every opening; ON draws the file's walls in the 3D
// and on its own level flat, and only looks -- nothing is saved. Each row
// breaks one line, runs the one test that should notice, and restores from
// HEAD.
//
//   node proto/boneyard-holograms-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/boneyard-holograms.spec.js';

const MUTANTS = [
  { file: 'BONEYARD.html',
    name: 'every file is shown, on or off',
    find: "      const holosShown = () => holoFiles().filter(file => holoOn.has(file.name));\n",
    with: "      const holosShown = () => holoFiles();\n",
    test: 'one button per hologram file' },
  { file: 'BONEYARD.html',
    name: 'every file in the first card colour',
    find: "          if (!files.has(name)) files.set(name, { name, color: HOLO.colourOf(holo, d).ink, holos: [], copies: 0 });\n",
    with: "          if (!files.has(name)) files.set(name, { name, color: HOLO.COLOURS[0].ink, holos: [], copies: 0 });\n",
    test: 'one button per hologram file' },
  { file: 'BONEYARD.html',
    name: 'the copies are not counted',
    find: "          if (file.copies > 1) {\n",
    with: "          if (false) {\n",
    test: 'one button per hologram file' },
  { file: 'BONEYARD.html',
    name: 'the flat view shows every level\'s hologram walls',
    find: "          holosShown().filter(file => !holoBg.has(file.name)).forEach(file => {\n            const walls = holoWalls(file).filter(w => Number(w.levelId) === Number(level.levelId));\n",
    with: "          holosShown().filter(file => !holoBg.has(file.name)).forEach(file => {\n            const walls = holoWalls(file);\n",
    test: 'ON draws the file' },
  { file: 'BONEYARD.html',
    name: 'the 3D draws no hologram walls',
    find: "            const walls = holoWalls(file).filter(w => laid.levels.some(l => l.kind !== 'roof'\n",
    with: "            const walls = [].filter(w => laid.levels.some(l => l.kind !== 'roof'\n",
    test: 'ON draws the file' },
  { file: 'BONEYARD.html',
    name: 'the button turns on but never off',
    find: "            if (holoOn.has(file.name)) { holoOn.delete(file.name); holoBg.delete(file.name); } else holoOn.add(file.name);\n",
    with: "            holoOn.add(file.name);\n",
    test: 'ON draws the file' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4568' } });
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
