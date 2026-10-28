#!/usr/bin/env node
// MUTATION GATE for the BONEYARD's LOCKS and its verbs in the foot
// (tests/boneyard-locks.spec.js).
//
// Movie, 27 Oct: "add a checkbox area so the user who is controlling one
// outline on one floor can select the other floor with lines that overlap to
// move locked with how they move the layer they are on" -- "lets go ALL
// CHECKED first" -- and BREAK and UNDO "down to a similar location as we have
// it for model space".
//
// Run: node proto/boneyard-locks-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/boneyard-locks.spec.js';

const MUTANTS = [
  { file: 'boneyard-edit.js',
    name: 'the locked floors below do not follow',
    find: "      if (!hits.length) break;\n",
    with: "      if (hits.length || !hits.length) break;\n",
    test: 'locked, the foundation goes out with MAIN FL on the same line' },
  { file: 'boneyard-edit.js',
    name: 'a floor with a locked one flush under it still walks the ladder',
    find: "    const carriedUnder = p > 0 && flushBelow(p - 1, edge.c).length > 0;\n",
    with: "    const carriedUnder = false;\n",
    test: 'locked, the foundation goes out with MAIN FL on the same line' },
  { file: 'boneyard-edit.js',
    name: 'an unlocked floor above follows anyway',
    find: "      if (!follows(ctx, lvl)) break;\n",
    with: "",
    test: 'unlocked, MAIN FL stays put when the foundation under it is pushed' },
  { file: 'boneyard-edit.js',
    name: 'an unlocked roof follows anyway',
    find: "        if (roofFollows(ctx)) report.roofs +=",
    with: "        if (true) report.roofs +=",
    test: 'unlocked, the ROOF stays put when the wall under it goes out' },
  { file: 'boneyard-edit.js',
    name: 'BREAK leaves the locked levels alone',
    find: "    if (ctx && ctx.locked) {\n      (ctx.levels || []).forEach(other => {",
    with: "    if (false) {\n      (ctx.levels || []).forEach(other => {",
    test: 'BREAK puts the corner on the locked levels on the same line too' },
  { file: 'boneyard-edit.js',
    name: 'BREAK ignores the lock boxes',
    find: "        if (other === level || !follows(ctx, other)) return;\n",
    with: "        if (other === level) return;\n",
    test: 'BREAK puts the corner on the locked levels on the same line too' },
  { file: 'BONEYARD.html',
    name: 'the boxes arrive unchecked',
    find: "          box.checked = !unlocked.has(keyOf(level));\n",
    with: "          box.checked = false;\n",
    test: 'each level row is BG, the level, then its LOCK box' },
  { file: 'BONEYARD.html',
    name: 'BG stays on the right',
    find: "          row.append(back, b, lock);\n",
    with: "          row.append(b, back, lock);\n",
    test: 'each level row is BG, the level, then its LOCK box' },
  { file: 'BONEYARD.html',
    name: 'the boxes change nothing',
    find: "        locked: new Set(levels.map(keyOf).filter(k => !unlocked.has(k))),\n",
    with: "        locked: new Set(levels.map(keyOf)),\n",
    test: 'unlocked, MAIN FL stays put when the foundation under it is pushed' },
  { file: 'shell-bars.js',
    name: 'with no trio the verbs are seated off the right edge',
    find: "    const trioLeft = trioBox.width ? trioBox.left : barBox.left;\n",
    with: "    const trioLeft = trioBox.width ? trioBox.left : window.innerWidth;\n",
    test: 'BREAK and UNDO stand in the foot' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4802' } });
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
