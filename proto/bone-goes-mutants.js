#!/usr/bin/env node
// MUTATION GATE for the BONE on an elevation or a section walking to EXT
// FINISH or PROJECT (tests/bone-goes.spec.js).
//
// Movie, 20 Oct: "maybe pressing the BONE in elevations should take them over
// to the EXT FINISH area", "take them over to PROJECT fom SECTIONS if they
// press the bone in the sections area", the empty file keeping the drive-thru
// ("good idea"), and EXT FINISH landing on the same elevation ("ok").
//
// Run: node proto/bone-goes-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/bone-goes.spec.js';
const MUTANTS = [
  { file: 'model/04-levels-notes-bars.js', name: 'the press never asks where it goes -- the drive-thru everywhere',
    find: "    const goes = boneGoesTo();\n    if (goes) { guardUnsaved(",
    with: "    const goes = null;\n    if (goes) { guardUnsaved(",
    test: 'on E3' },
  { file: 'model/04-levels-notes-bars.js', name: 'an empty file walks to EXT FINISH too',
    find: "    if (!cut || !(drawing?.walls || []).length) return null;",
    with: "    if (!cut) return null;",
    test: 'an empty file' },
  { file: 'model/04-levels-notes-bars.js', name: 'a section taken for an elevation',
    find: "    return autoElevationCuts().some(c => String(c.id) === String(cut.id))\n      ? {",
    with: "    return true\n      ? {",
    test: 'on a section' },
  { file: 'model/04-levels-notes-bars.js', name: 'EXT FINISH not told which elevation',
    find: "href: `./EXTFINISH.html?elev=${encodeURIComponent(cut.id)}` }",
    with: "href: './EXTFINISH.html' }",
    test: 'on E3' },
  { file: 'model/04-levels-notes-bars.js', name: 'the tag never put on',
    find: "    if (goes) bone.dataset.boneGoes = goes.label;",
    with: "    if (goes) void 0;",
    test: 'on E3' },
  { file: 'model/04-levels-notes-bars.js', name: 'the tag never taken off',
    find: "    else delete bone.dataset.boneGoes;",
    with: "    else void 0;",
    test: 'the tag comes off' },
  { file: 'EXTFINISH.html', name: 'EXT FINISH ignores ?elev=',
    find: "      let currentElev = askedElev || 'E1';",
    with: "      let currentElev = 'E1';",
    test: 'on E3' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4503' } });
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
