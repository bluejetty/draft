#!/usr/bin/env node
// MUTATION GATE for the window tag that went missing
// (tests/fen-labels.spec.js, tests/window-size-tags.spec.js,
// tests/layout-window-tags.spec.js).
//
// Movie, 16 Oct: a MAIN FL window with no tag at all. Two ways a tag could
// go missing, both closed: a window with no height to say now says its
// width ("W 36", fen-labels fenLabel), and a level with no outline tags its
// windows off the wall's own normal, away from the level's middle
// (planTagLine's `centre`, handed over by MODEL and by the sheet).
//
// Run: node proto/window-tag-fallback-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'fen-labels.js',
    name: 'a window with no height draws no tag at all',
    find: "      if (!Number.isFinite(heightFt) || heightFt <= 0) return `W ${size(widthFt)}`;",
    with: "      if (!Number.isFinite(heightFt) || heightFt <= 0) return '';",
    spec: 'tests/fen-labels.spec.js', test: 'the formatter encodes every quirk in the ladder' },
  { file: 'fen-labels.js',
    name: 'with no outline the tag is not placed',
    find: '    if (!out && centre && Number.isFinite(centre.x) && Number.isFinite(centre.z)) {',
    with: '    if (false) {',
    spec: 'tests/window-size-tags.spec.js', test: 'a window on a level with no outline is still tagged, off the wall' },
  { file: 'MODEL.html',
    name: 'MODEL hands the tag no middle to step away from',
    find: '        { centre: FL.wallsCentre(shown) });',
    with: '        { centre: null });',
    spec: 'tests/window-size-tags.spec.js', test: 'a window on a level with no outline is still tagged, off the wall' },
  { file: 'plan-composition.js',
    name: 'the sheet hands the tag no middle to step away from',
    find: '          { centre: FL.wallsCentre ? FL.wallsCentre(walls) : null });',
    with: '          { centre: null });',
    spec: 'tests/layout-window-tags.spec.js', test: 'a plan viewport tags the windows of a level with no outline too' },
];

const SPECS = [...new Set(MUTANTS.map(m => m.spec))];
const run = (spec, name) => {
  try {
    execSync(`npx playwright test ${spec} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4365' } });
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
  const clean = run(SPECS.join(' '), null);
  if (clean !== 'passed') {
    console.log('REFUSING TO RUN: a spec is already failing before any mutant '
      + 'is applied.\nEvery mutant would read as KILLED and the sheet would be a '
      + 'lie. Fix the spec first.');
    process.exit(1);
  }
  console.log('baseline: the unmutated specs pass\n');
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
  let result = run(m.spec, m.test);
  let note = '';
  if (result === 'passed' && run(m.spec, null) === 'failed') {
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
