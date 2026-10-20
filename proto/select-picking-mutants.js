#!/usr/bin/env node
// MUTATION GATE for SELECT picking a kind (tests/select-picking.spec.js).
//
// Movie, 19 Oct: "i'd like the 4 buttons SELECT / ASSEMBLY / TRIM / DIMENSION
// up in that little space over the regular open tab area -- the main reason
// will be so i can have the SELECT button chosen, and also choose the
// FENETRATION ... if a user make a rectangular window it will SELECT all the
// FENSTRATIONS in the rectangle so the user can delete them all at once" --
// "ONLY 1 at a time", ended by "escape or press S or SELECT again".
//
// Run: node proto/select-picking-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/select-picking.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'the bar over the tabs is never built',
    find: "  buildSelectBar();\n",
    with: "",
    test: 'the four keys are copied over the tabs' },
  { file: 'MODEL.html', name: 'SELECT from the bar never starts picking',
    find: "      if (fromBar) setSelectPicking(true);\n",
    with: "",
    test: 'SELECT, then FENESTRATION' },
  { file: 'MODEL.html', name: 'a kind key draws while SELECT is picking',
    find: "    if (selectPicking && PICK_KINDS[id]) { pickKind(PICK_KINDS[id]); return; }\n",
    with: "",
    test: 'SELECT, then FENESTRATION' },
  { file: 'MODEL.html', name: 'the lit kind never lets go',
    find: "    selectFilter = same ? 'all' : kind;\n",
    with: "    selectFilter = kind;\n",
    test: 'one kind at a time' },
  { file: 'MODEL.html', name: 'the box never takes a dimension',
    find: "    if (selectFilter === 'dimension') {\n      shownDimensions().forEach(item => {\n",
    with: "    if (false) {\n      shownDimensions().forEach(item => {\n",
    test: 'DIMENSION picked' },
  { file: 'MODEL.html', name: 'a plain box takes the dimensions too',
    find: "    if (selectFilter === 'dimension') {\n      shownDimensions().forEach(item => {\n",
    with: "    if (filterAllows('dimension')) {\n      shownDimensions().forEach(item => {\n",
    test: 'DIMENSION picked' },
  { file: 'MODEL.html', name: 'a kitchen button\'s kind is ignored by the box',
    find: "      fixtures().filter(fixtureKindAllowed).forEach(item => {\n",
    with: "      fixtures().forEach(item => {\n",
    test: 'a kitchen or bath button picks only its own kind' },
  { file: 'MODEL.html', name: 'a kitchen button places while SELECT is picking',
    find: "          if (selectPicking) { pickKind('fixture', kind.id); return; }\n",
    with: "",
    test: 'a kitchen or bath button picks only its own kind' },
  { file: 'MODEL.html', name: 'Esc leaves the picking up',
    find: "      if (!selection.length && selectPicking) setSelectPicking(false);\n",
    with: "",
    test: 'Esc, S, or SELECT again ends it' },
  { file: 'MODEL.html', name: 'S and SELECT again leave the picking up',
    find: "      if (selectPicking) { setSelectPicking(false); return; }\n",
    with: "",
    test: 'Esc, S, or SELECT again ends it' },
  { file: 'MODEL.html', name: 'ending the picking keeps the kind',
    find: "    if (!on) { selectFilter = 'all'; selectFixtureKind = null; }\n",
    with: "",
    test: 'Esc, S, or SELECT again ends it' },
  { file: 'MODEL.html', name: 'arming another tool leaves the picking up',
    find: "    if (next !== RESTING_TOOL && selectPicking) setSelectPicking(false);\n",
    with: "",
    test: 'a key with no kind' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4463' } });
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
