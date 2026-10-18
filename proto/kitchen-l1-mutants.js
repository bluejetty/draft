#!/usr/bin/env node
// MUTATION GATE for KITCHEN L1's gesture on the live page
// (tests/kitchen-l1.spec.js).
//
// Movie, 17 Oct: "can you make a WC and KITCHENS that are like on this plan
// ... call it ... KITCHEN L1". The kitchen's geometry has its own engine
// (proto/kitchen-presets-harness.js --mutate); these rows bend the PAGE's
// seams -- the press filing the records, F reaching the kitchen, the one
// undo step -- which no pure check can see.
//
// Run: node proto/kitchen-l1-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/kitchen-l1.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the press with a kitchen in hand drops a single fixture instead',
    find: "    if (kitchenPreset) return dropKitchen(at);\n",
    with: '',
    test: 'KITCHEN L1 pressed into the north-east corner lays six pieces on its two walls' },
  { file: 'MODEL.html',
    name: 'F no longer reaches the kitchen',
    find: "    else if (event.code === 'KeyF') kitchenFlip = !kitchenFlip;\n",
    with: '',
    test: 'F swaps the legs: the sink goes along the north wall' },
  { file: 'MODEL.html',
    name: 'the kitchen is filed with no undo step',
    find: "      kind: 'built', walls: ownWalls, outlines: [], list: null,\n      items: made.map(item => ({ list: drawing.fixtures, item }))\n",
    with: "      kind: 'built', walls: [], outlines: [], list: null,\n      items: [].map(item => ({ list: drawing.fixtures, item }))\n",
    test: 'KITCHEN L1 pressed into the north-east corner lays six pieces on its two walls' },
  { file: 'MODEL.html',
    name: 'in open floor it brings no walls, so nothing drops',
    find: "    const own = KP.ownWalls(kitchenPreset, at, kitchenTurn);\n",
    with: "    if (true) return null;\n    const own = KP.ownWalls(kitchenPreset, at, kitchenTurn);\n",
    test: 'pressed in open floor it brings its own two walls and lays itself against them, one rigid assembly' },
  { file: 'MODEL.html',
    name: 'with walls of its own it is still not rigid',
    find: "      fixed: ownWalls.length > 0,\n",
    with: "      fixed: false,\n",
    test: 'pressed in open floor it brings its own two walls and lays itself against them, one rigid assembly' },
  { file: 'MODEL.html',
    name: '[ and ] never reach the kitchen',
    find: "    else if (turn && kitchenPreset) kitchenTurn = ((kitchenTurn + turn) % 360 + 360) % 360;\n",
    with: '',
    test: '[ and ] turn it in open floor: a quarter turn and its top wall runs north' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4432' } });
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
