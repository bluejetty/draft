#!/usr/bin/env node
// MUTATION GATE for the bath fixtures' size marks, their own width, and a
// WC's fixtures staying when its walls go (Movie, 23 Oct). Each row breaks
// one line, runs the one test that should notice, and restores from HEAD.
//
//   node proto/fixture-size-mark-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/fixture-size-mark.spec.js';

const MUTANTS = [
  { file: 'model/08-structure-roof.js',
    name: 'the WC\'s shower goes with its walls',
    find: "      return !!owner && owner.fixed === true\n        && selection.some(e => e.type === 'wall' && groupOf(e) === owner);\n",
    with: "      return false;\n",
    test: 'DELETE on a wall of the WC' },
  { file: 'fixture-geometry.js',
    name: 'a fixture is cut down to its wall again',
    find: "    const width = Math.max(fixture.width, 0.5);\n",
    with: "    const width = Math.min(fixture.width, Math.max(frame.len - 0.02, 0.5));\n",
    test: 'a fixture keeps its own width' },
  { file: 'model/02-holograms-tags.js',
    name: 'no size mark on the bath fixtures',
    find: "  const SIZE_MARKED_KINDS = new Set(['shower', 'stall', 'tub', 'vanity', 'pedestal', 'pedestal30']);\n",
    with: "  const SIZE_MARKED_KINDS = new Set([]);\n",
    test: 'the shower carries its size' },
  { file: 'model/02-holograms-tags.js',
    name: 'the mark reads width X depth, the wrong way round',
    find: "        const label = `${say(fx.depth)}X${say(a1 - a0)}`;\n",
    with: "        const label = `${say(a1 - a0)}X${say(fx.depth)}`;\n",
    test: 'the shower carries its size' },
  { file: 'model/02-holograms-tags.js',
    name: 'the typed size sets the width only',
    find: "    fixture.depth = Number(depth.toFixed(4));\n    fixture.width = Number(width.toFixed(4));\n",
    with: "    fixture.width = Number(width.toFixed(4));\n",
    test: 'the shower carries its size' },
  { file: 'model/02-holograms-tags.js',
    name: 'a typed size leaves no UNDO step',
    find: "    undoStack.push({ kind: 'props', edits: [{ item: fixture, before }] });\n    markDirty();\n    paint();\n    const K = window.DraftFixtureKinds;\n",
    with: "    markDirty();\n    paint();\n    const K = window.DraftFixtureKinds;\n",
    test: 'the shower carries its size' },
  { file: 'model/02-holograms-tags.js',
    name: 'a size that cannot be read is guessed at',
    find: "    if (!nums || nums.length !== 2 || !(Number(nums[0]) > 0) || !(Number(nums[1]) > 0)) {\n",
    with: "    if (false) {\n",
    test: 'a size that cannot be read is refused' },
  { file: 'model/02-holograms-tags.js',
    name: 'a tub typed into keeps filling its alcove',
    find: "    if (fixture.kind === 'tub') { delete fixture.endWallId; delete fixture.dir; }\n    undoStack.push({ kind: 'props', edits: [{ item: fixture, before }] });\n",
    with: "    undoStack.push({ kind: 'props', edits: [{ item: fixture, before }] });\n",
    test: 'the tub in its alcove' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4550' } });
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
