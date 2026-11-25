#!/usr/bin/env node
// MUTATION GATE for CHANGE BOTH FLIGHTS (jb, 25 Nov 2026: "beside UPPER 10 -
// LOWER 2 on the right put a box for CHANGE BOTH FLIGHTS and if they click it
// it will match the changes on each level", "the landings should line up").
// Each row breaks one line, runs the one test that should notice, and
// restores from HEAD.
//
//   node proto/stair-change-both-flights-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-change-both-flights.spec.js';
const MUTANTS = [
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'an edit is never matched on the stack',
    find: "    const mates = stair?.matchStack ? stairStackMates(stair) : [];\n",
    with: "    const mates = [];\n",
    test: 'ticked: FLIGHTS, TURN, WIDTH and RAIL' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'ticking does not line the others up',
    find: "      mates.forEach(mate => stairMatchOnto(stair, mate));\n      stairRewidenStack(all);\n",
    with: "      stairRewidenStack(all);\n",
    test: 'ticking it lines 2ND FL up' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the match keeps the old top nosing',
    find: "    st.start = { ...st.start, x: src.start.x, z: src.start.z };\n",
    with: "",
    test: 'ticking it lines 2ND FL up' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the split is not carried',
    find: "    if (split) st.splitTreads = split.t1;\n",
    with: "",
    test: 'ticking it lines 2ND FL up' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the EXT. WALL widening is lost on a match',
    find: "      .forEach(up => editStair(up, st => stairSetLegWiden(st, stairLegWidenFor(st, base))));\n",
    with: "      .forEach(up => editStair(up, st => stairSetLegWiden(st, null)));\n",
    test: 'the 9" EXT. WALL widening stays' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a match is its own UNDO',
    find: "    if (steps.length === 1) undoStack.push(steps[0]);\n    else if (steps.length) undoStack.push({ kind: 'batch', steps });\n    return ok;\n",
    with: "    steps.forEach(s => undoStack.push(s));\n    return ok;\n",
    test: 'ticked: FLIGHTS, TURN, WIDTH and RAIL' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a stair laid on every floor comes unticked',
    find: "    if (made.length) fresh.forEach(st => { st.matchStack = true; });\n",
    with: "",
    test: 'a stair laid on every floor comes ticked' },
  // REMOVED: 'the tick is not saved' (drawing-format.js dropping
  // matchStack). MODEL.html saves and reopens its own JSON without passing
  // stairs through drawing-format's reader, so the field survives either
  // way there; the reader is kept in step for the pages that do use it.
  { file: 'model/15-panels.js',
    name: 'the box is not beside UPPER · LOWER',
    find: "      box.lastElementChild.querySelector('.chip-row').append(matchBox());\n",
    with: "",
    test: 'the box stands beside UPPER' },
  { file: 'model/15-panels.js',
    name: 'the rail is not matched',
    find: "        stairEditMatched(stair, () => editStair(stair, st => { st.rail = id; return null; }));\n",
    with: "        editStair(stair, st => { st.rail = id; return null; });\n",
    test: 'ticked: FLIGHTS, TURN, WIDTH and RAIL' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4577' } });
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
