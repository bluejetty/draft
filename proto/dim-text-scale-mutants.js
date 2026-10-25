#!/usr/bin/env node
// MUTATION GATE for the dimension figures' size (Movie, 25 Oct: "it would be
// nice if the dimension text was approx that size" -- "lock it in with the
// layout scale ... maybe have a secondary method to change the scale"):
// 1/8" printed at the level's most detailed LAYOUT scale, never under 7px,
// DIM SCALE overriding it per level and kept in the file.
//
//   node proto/dim-text-scale-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/dim-text-scale.spec.js';

const MUTANTS = [
  { file: 'render-2d.js',
    name: 'the figure ignores its text scale',
    find: "    const FULL_FONT = `600 ${11 * k * t}px",
    with: "    const FULL_FONT = `600 ${11 * k}px",
    test: 'most detailed LAYOUT scale' },
  { file: 'model/03-plan-paint.js',
    name: 'MODEL hands the painter no text scale',
    find: "    textScale: dimTextScale(),\n",
    with: "",
    test: 'most detailed LAYOUT scale' },
  { file: 'model/03-plan-paint.js',
    name: 'the figure is sized off the first sheet, not the most detailed',
    find: "    return pifs.length ? Math.max(...pifs) : null;",
    with: "    return pifs.length ? pifs[0] : null;",
    test: 'most detailed LAYOUT scale' },
  { file: 'model/03-plan-paint.js',
    name: 'no floor: zoomed out the figure shrinks to a smear',
    find: "    return Math.max(DIM_TEXT_MIN_PX, px) / 11;",
    with: "    return px / 11;",
    test: 'most detailed LAYOUT scale' },
  { file: 'model/03-plan-paint.js',
    name: 'the sheet is ignored: always 1/4"',
    find: "    dimOwnPif(levelId) || dimLayoutPif(levelId) || DIM_TEXT_DEFAULT_PIF;",
    with: "    dimOwnPif(levelId) || DIM_TEXT_DEFAULT_PIF;",
    test: 'a 1/8" sheet doubles' },
  { file: 'model/03-plan-paint.js',
    name: 'his DIM SCALE pick does not win over the sheet',
    find: "    dimOwnPif(levelId) || dimLayoutPif(levelId) || DIM_TEXT_DEFAULT_PIF;",
    with: "    dimLayoutPif(levelId) || dimOwnPif(levelId) || DIM_TEXT_DEFAULT_PIF;",
    test: 'DIM SCALE beside HAND DIMS' },
  { file: 'model/03-plan-paint.js',
    name: 'LAYOUT again keeps the old pick in the file',
    find: "        if (pick.value) next[id] = Number(pick.value); else delete next[id];",
    with: "        if (pick.value) next[id] = Number(pick.value);",
    test: 'DIM SCALE beside HAND DIMS' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4612' } });
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
