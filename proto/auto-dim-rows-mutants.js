#!/usr/bin/env node
// MUTATION GATE for AUTO DIMS on a shelf and its rows taken off and put back
// (tests/auto-dim-rows.spec.js).
//
// Movie, 26 Oct: "can we put the AUTODIM / HAND DIM buttons in the SHELF
// ... if the user pressed it please make them" -- "allow the user to be able
// to DELETE a string or add a string back from AUTODIMENSION ... when the
// line is deleted i'd like the other lines to re-adjust. and then put it
// back if they change their mind".
//
// Run: node proto/auto-dim-rows-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/auto-dim-rows.spec.js';

const MUTANTS = [
  { file: 'auto-dims.js',
    name: 'a row taken off is laid anyway',
    find: "        const kept = strings.filter(string => !offRows.has(`${side}:${string.layer}`));\n",
    with: "        const kept = strings;\n",
    test: 'DELETE on one piece of a row takes the row off that side, and the rows outside step in' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'AUTO DIMS is not told which rows are off',
    find: "      rowsOff: autoRowsOff(levelId, view),\n",
    with: "",
    test: 'DELETE on one piece of a row takes the row off that side, and the rows outside step in' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'east and west read the wrong way round',
    find: "    if (Math.abs(dim.start.x - dim.end.x) < 1e-6) return dim.start.x < cx ? 'W' : 'E';\n",
    with: "    if (Math.abs(dim.start.x - dim.end.x) < 1e-6) return dim.start.x < cx ? 'E' : 'W';\n",
    test: 'DELETE on one piece of a row takes the row off that side, and the rows outside step in' },
  { file: 'model/08-structure-roof.js',
    name: 'DELETE takes the one piece, as before',
    find: "    const rowPicks = selection.filter(entry => entry.type === 'dimension' && isAutoRow(entry.item));\n",
    with: "    const rowPicks = [];\n",
    test: 'DELETE on one piece of a row takes the row off that side, and the rows outside step in' },
  { file: 'model/03-plan-paint.js',
    name: 'the chips wait for strings, as before',
    find: "    const any = dimensions().length > 0 || activeTool === 'dimension' || walls().length > 0;\n",
    with: "    const any = dimensions().length > 0 || activeTool === 'dimension';\n",
    test: 'on a shelf the AUTO DIMS chip is there before any strings, and a press lays the four rows' },
  { file: 'model/03-plan-paint.js',
    name: 'the first press only shows and hides',
    find: "            pressAutoDims();\n            return;\n",
    with: "            return;\n",
    test: 'on a shelf the AUTO DIMS chip is there before any strings, and a press lays the four rows' },
  { file: 'model/03-plan-paint.js',
    name: 'a tick in ROWS takes the row off whichever way it goes',
    find: "          changeAutoRows(levelId, view, rows => (tick.checked ? rows.filter(r => r !== key) : [...rows, key]));\n",
    with: "          changeAutoRows(levelId, view, rows => [...rows, key]);\n",
    test: 'ROWS puts it back, the rows step out again; UNDO takes the put-back away' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'UNDO puts the strings back and forgets the list',
    find: "      setAutoRowsOff(levelId, view, before);\n      drawing.dimensions = (drawing.dimensions || []).filter(dim => !placed.includes(dim));\n",
    with: "      drawing.dimensions = (drawing.dimensions || []).filter(dim => !placed.includes(dim));\n",
    test: 'ROWS puts it back, the rows step out again; UNDO takes the put-back away' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4792' } });
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
