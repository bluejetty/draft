#!/usr/bin/env node
// MUTATION GATE for the garage square on the page (tests/garage-square.spec.js).
//
// The square itself -- 20 ft deep from the inside face, 6" each side, the 42"
// landing, the columns it drops and the row it slides off a door -- is
// build-house.js and is proved by proto/mid-span-beam-harness.js --mutate.
// This gate is for the PAGE's half: that the auto stair is TOLD about the
// squares, that the beam pass hands the plan its keep-outs and the openings
// under its ends, that the posts are filed, and that the shallow-garage note
// is said once.
//
// NOT HERE, AND SAID SO: stairPlacementLegal's own square test guards the
// STACKED flight and the dead-strip push, neither of which this fixture
// reaches (the suggester already refuses the square, so legality is never
// the deciding question). The rule it calls, hitsKeepOut, is proved in the
// engine; the wiring line is read, not gated.
//
// Run: node proto/garage-square-mutants.js   (refuses a dirty MODEL.html; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/garage-square.spec.js';

const MUTANTS = [
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the stair suggester is never told about the square: the well stands where the car goes',
    find: '      keepOuts: garageKeepOutsUnder(levelId).map(k => k.points),',
    with: '      keepOuts: [],',
    test: 'lands on the pier between the doors' },

  { file: 'model/03-plan-paint.js',
    name: 'the squares point OUT of the garage (the inward normal is never flipped)',
    find: "      if ((centre.x - at.x) * inward.x + (centre.z - at.z) * inward.z < 0) inward = { x: -inward.x, z: -inward.z };\n",
    with: '',
    test: 'lands on the pier between the doors' },

  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the beam plan is not handed the squares: a column stands in front of the car',
    find: '        keepOuts,\n        openings,\n      });',
    with: '        keepOuts: [],\n        openings,\n      });',
    test: 'a beam never rests over the garage door' },

  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the beam plan is not told where the doors are: the row rests over the garage door',
    find: '        keepOuts,\n        openings,\n      });',
    with: '        keepOuts,\n        openings: [],\n      });',
    test: 'a beam never rests over the garage door' },

  { file: 'model/12-garage-storeys-stairs.js',
    name: 'no post is filed under the beam\'s ends',
    find: "        const record = { id: columnId++, point: { ...p, y: 0 }, levelId, view, footing: 'post6', inWall: true, auto: true };\n        drawing.columns.push(record);",
    with: "        const record = { id: columnId++, point: { ...p, y: 0 }, levelId, view, footing: 'post6', inWall: true, auto: true };",
    test: 'a 6x6 is built into the wall under each end' },

  { file: 'model/03-plan-paint.js',
    name: 'the square is measured from the wall line, not the inside face (the note reads 18 ft, not 17\'-1")',
    find: "        insetFt: (Number.isFinite(totalIn) ? totalIn : 5.5) / 12 }];",
    with: '        insetFt: 0 }];',
    test: 'too shallow for its square says so' },

  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a garage too shallow for its square is not called out',
    find: '      if (garage && shallow) {',
    with: '      if (false && garage && shallow) {',
    test: 'too shallow for its square says so' },

  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a re-run says the shallow-garage note again instead of taking it back first',
    find: '    drawing.notes = notesNow.filter(note => !isBeamTag(note) && !isSquareNote(note)',
    with: '    drawing.notes = notesNow.filter(note => !isBeamTag(note)',
    test: 'too shallow for its square says so' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4357' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
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
