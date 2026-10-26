#!/usr/bin/env node
// MUTATION GATE for each suite drawn as a picture of its own
// (tests/suite-pictures.spec.js).
//
// Movie, 26 Oct, his 22-suite file: a suite drag ran at seven frames a
// second. Each suite is drawn once and laid on after; these are the seams
// that keep the picture honest -- when it is drawn afresh, when it is only
// slid, what is never drawn, and the shell's share worked out once per change.
//
// Run: node proto/suite-pictures-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/suite-pictures.spec.js';

const MUTANTS = [
  { file: 'hologram.js',
    name: 'every paint draws every suite afresh',
    find: "        if (!pic || pic.key !== key) {\n",
    with: "        if (true) {\n",
    test: 'drawn once, then laid on: a paint with nothing changed draws no suite again, and looks as drawn line by line' },
  { file: 'hologram.js',
    name: 'a suite off the screen is drawn anyway',
    find: "        if (env.pictures && box && (box.x1 < 0 || box.y1 < 0 || box.x0 > w || box.y0 > h)) return;\n",
    with: "",
    test: 'a suite off the screen is not drawn; zoomed, the one on it is drawn afresh' },
  { file: 'hologram.js',
    name: 'a moved suite is drawn afresh instead of slid',
    find: "        const key = [holoKey({ ...holo, x: 0, z: 0 }), gone",
    with: "        const key = [holoKey(holo), gone",
    test: 'a moved suite slides its picture; lined up on the shell, it is drawn afresh without the wall the shell takes' },
  { file: 'hologram.js',
    name: 'the wall the shell takes is not in the key',
    find: "holoKey({ ...holo, x: 0, z: 0 }), gone ? [...gone].sort().join(',') : '',\n",
    with: "holoKey({ ...holo, x: 0, z: 0 }), '',\n",
    test: 'a moved suite slides its picture; lined up on the shell, it is drawn afresh without the wall the shell takes' },
  { file: 'hologram.js',
    name: 'its layers are not in the key',
    find: "          levelId, view, paperColor, [...(layersOff || [])].join(','), env.pictureKey || '',\n",
    with: "          levelId, view, paperColor, env.pictureKey || '',\n",
    test: 'its layers changed, a suite is drawn afresh' },
  { file: 'hologram.js',
    name: 'a sheet is laid on from pictures too',
    find: "        if (!env.pictures || !box || ",
    with: "        if (!box || ",
    test: 'a sheet or a print draws every suite line by line, every time' },
  { file: 'hologram.js',
    name: 'the shell\'s share is kept past an edit to its walls',
    find: "    const key = `${JSON.stringify(hostWalls(saved))}|",
    with: "    const key = `${hostWalls(saved).length}|",
    test: 'the shell\'s windows from a suite follow an edit to the shell, and a change to what is handed out is not kept' },
  { file: 'hologram.js',
    name: 'what is handed out is the kept answer itself',
    find: "  const hostOpenings = saved => shared(saved).openings.map(o => ({ ...o }));\n",
    with: "  const hostOpenings = saved => shared(saved).openings;\n",
    test: 'the shell\'s windows from a suite follow an edit to the shell, and a change to what is handed out is not kept' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4778' } });
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
