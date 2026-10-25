#!/usr/bin/env node
// MUTATION GATE for the drive-thru's third button (Movie, 20 Oct): "SPECIFY
// FRAMING DETAILS, HEIGHTS in PROJECT AREA --- this will take them over to
// the PROJECT AREA with whatever they selected so far". Each row breaks one
// line of MODEL.html, runs the one test that should notice, and restores the
// file from HEAD.
//
//   node proto/drivethru-project-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/drivethru-project-button.spec.js';

const MUTANTS = [
  { file: 'model/04-levels-notes-bars.js',
    name: 'the button never rises with the order',
    find: "    projectGoPresses.forEach(press => { press.hidden = !canTrace; });\n",
    with: "",
    test: 'the button stands where the two text lines stood, once a type is picked' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the garage half of the order is left behind',
    find: "    if (entry.type && drawing.garagePlan !== plan) { drawing.garagePlan = plan; markDirty(); }\n",
    with: "",
    test: 'it takes the order to PROJECT: the type and its garage light the family row there' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the order goes over unsaved',
    find: "    Promise.resolve(save()).catch(() => false).then(() => {\n",
    with: "    Promise.resolve(false).then(() => {\n",
    test: 'it takes the order to PROJECT: the type and its garage light the family row there' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the card is not named on the way over',
    find: "      if (card) url.searchParams.set('type', card);\n",
    with: "",
    test: 'a detached garage order opens the DETACHED GARAGE card' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4511' } });
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
