#!/usr/bin/env node
// MUTATION GATE for a hologram's layers (tests/hologram-layers.spec.js).
//
// Movie, 26 Oct: "in the hologram area can we have a LAYERS area ... all the
// SAME like the TB, but you can also check a box to delink it from the main
// LAYER SET ... for a particual 'SUITE/SHELF/TYPE COLOR' or also ... 1
// specific suite" -- "turn off most or all of the text". Six seams: the words
// let through, a copy's own set, a type's own set, the painter's layer gate,
// the format keeping a copy's set, and ADVANCED.
//
// Run: node proto/hologram-layers-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/hologram-layers.spec.js';

const MUTANTS = [
  { file: 'hologram.js',
    name: 'TEXT off still writes the words',
    find: "    if (!off || !off.has(WORDS)) return draw();\n",
    with: "    return draw();\n",
    test: 'ADVANCED lists every layer by its own name, and FEWER LAYERS goes back to the five' },
  { file: 'hologram.js',
    name: 'a copy\'s own set is ignored',
    find: "    if (holo?.layersOwn === true) return { off: cleanOff(holo.layersOff), from: 'copy' };\n",
    with: "",
    test: 'one main set for every hologram; a type, or one copy, can take its own' },
  { file: 'hologram.js',
    name: 'a type\'s own set is ignored',
    find: "    if (file) return { off: cleanOff(file), from: 'type' };\n",
    with: "",
    test: 'one main set for every hologram; a type, or one copy, can take its own' },
  { file: 'drawing-format.js',
    name: 'the file forgets a copy\'s own set',
    find: "        ...(holo?.layersOwn === true ? { layersOwn: true, layersOff:",
    with: "        ...(false ? { layersOwn: true, layersOff:",
    test: 'one main set for every hologram; a type, or one copy, can take its own' },
  { file: 'plan-composition.js',
    name: 'a room name ignores its layer being off',
    find: "        .filter(tag => shows(tag.layer || 'ROOM-IDS-AREA') && !off(tag.layer || 'ROOM-IDS-AREA'))\n",
    with: "        .filter(tag => shows(tag.layer || 'ROOM-IDS-AREA'))\n",
    test: 'ADVANCED lists every layer by its own name, and FEWER LAYERS goes back to the five' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'ADVANCED shows the five groups still',
    find: "    const groups = store.advanced\n",
    with: "    const groups = false\n",
    test: 'ADVANCED lists every layer by its own name, and FEWER LAYERS goes back to the five' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4698' } });
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
