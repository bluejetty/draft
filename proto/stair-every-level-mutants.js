#!/usr/bin/env node
// MUTATION GATE for a stair on every level and a flight picked from the floor
// it lands on (jb, 22 Nov 2026: "when i create a set of stairs can you create
// it for all levels", "allow the user to move the stairs on multiple levels
// (the basement as well as main floor"). Each row breaks one line, runs the
// one test that should notice, and restores from HEAD.
//
//   node proto/stair-every-level-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-every-level.spec.js';
const MUTANTS = [
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'ALL LEVELS stacks nothing',
    find: "    const filled = stairHand.allLevels ? stairFillLevels(stair, settle) : { made: [], kept: [] };\n",
    with: "    const filled = { made: [], kept: [] };\n",
    test: 'ALL LEVELS is lit by default' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'THIS LEVEL ONLY is ignored',
    find: "    stairHand.allLevels = btn.dataset.stairLevels === 'all'; syncStairPick(); paint();\n",
    with: "    syncStairPick(); paint();\n",
    test: 'THIS LEVEL ONLY places the one flight' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'only the floors above are stacked',
    find: "    for (let i = k - 1; i >= 0 && from; i--) from = stackOnto(from, ids[i]);\n",
    with: "",
    test: 'UP FROM HERE stacks down as well' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a floor that has one gets a second on top',
    find: "      if (there) { kept.push(levelId); return there; }\n",
    with: "",
    test: 'a floor that already has a stair there keeps it' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'UNDO leaves the stacked flights',
    find: "      items: [{ list: drawing.stairs, item: stair }, ...filled.made.map(item => ({ list: drawing.stairs, item })),\n",
    with: "      items: [{ list: drawing.stairs, item: stair },\n",
    test: 'ALL LEVELS is lit by default' },
  { file: 'model/01-skin-view.js',
    name: 'the floor a flight lands on cannot pick it',
    find: "        && SG.stairRoleOn(stair, levelId, floors) === 'lands') : []),\n",
    with: "        && false) : []),\n",
    test: 'the basement plan picks and drags' },
];


const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4566' } });
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
