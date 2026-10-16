// DOES THE WALL JUSTIFICATION SPEC CATCH A PANEL THAT SAYS LEFT AND DRAWS RIGHT?
//
// The gate for the wall's side (Movie, 16 Oct: "allow the user to select
// the 'LEFT SIDE' CENTERLINE or 'RIGHT SIDE' for placement of the actual
// wall, based on where the LINE is positioned").
//
// MUTANT 3 IS THE ONE WORTH THE GATE. The record names the FACE the line is
// and his words name the BODY's side -- the same fact from opposite ends --
// so the table that maps one to the other can be written backwards and
// every other check still passes: the panel shows three chips, the pick
// sticks, the save keeps it. Only a check that asks for the record's value
// behind the word sees it. Mutant 4 is the same mistake on the selection
// panel, which used to carry the opposite sense under the same word.
//
// THE SPEC PATH IS WRITTEN OUT IN EACH ROW: mutant-anchors-harness.js reads
// this table on its own, without the rest of the file.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'THE OLD DEFAULT: a drawn wall is a left-face wall, not a centreline wall',
    find: "        refLine || wallSetting('wallRefLine', 'center')),",
    with: "        refLine || wallSetting('wallRefLine', 'left')),",
    test: 'CENTERLINE pressed, and a drawn wall is a centreline wall' },

  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'THE PICK IS NOT THE DRAWING\'S: it lights a chip and changes no wall',
    find: '      drawing.wallRefLine = id;\n      markDirty();\n      showWallProps();',
    with: '      showWallProps();',
    test: 'LEFT SIDE puts the wall on the drafter' },

  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'THE WORDS MAP BACKWARDS: LEFT SIDE stores the left face, a wall on the right',
    find: "  const WALL_SIDES = [['right', 'LEFT SIDE'], ['center', 'CENTERLINE'], ['left', 'RIGHT SIDE']];",
    with: "  const WALL_SIDES = [['left', 'LEFT SIDE'], ['center', 'CENTERLINE'], ['right', 'RIGHT SIDE']];",
    test: 'LEFT SIDE puts the wall on the drafter' },

  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'the selection panel keeps the old sense: its LEFT is a wall on the right',
    find: "  const REF_LINES = [['right', 'LEFT SIDE'], ['center', 'CENTERLINE'], ['left', 'RIGHT SIDE']];",
    with: "  const REF_LINES = [['left', 'LEFT SIDE'], ['center', 'CENTERLINE'], ['right', 'RIGHT SIDE']];",
    test: 'the selection panel speaks the same words' },

  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'A HARD LINE DOES NOT JUSTIFY: a wall along the face stands inside the exterior wall',
    find: '      const justified = toyJustifyAlongHardLine(from, to);',
    with: '      const justified = null;',
    test: 'along an inside face the wall takes the room side' },

  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'JUSTIFIED THE WRONG WAY: into the exterior wall, over the hole',
    find: "    return line.away * nAlongAxis > 0 ? 'left' : 'right';",
    with: "    return line.away * nAlongAxis > 0 ? 'right' : 'left';",
    test: 'along an opening edge the wall goes away from the hole' },

  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'the WALL tool raises no panel: the choice has no control',
    find: "    if (tool === 'wall') { showWallProps(); return; }",
    with: '',
    test: 'arming the WALL tool raises its panel' },

  { file: 'MODEL.html', spec: 'tests/model-wall-justify.spec.js',
    name: 'an opening edge is justified toward the hole (the away sign read from the wrong end)',
    find: "        const band = (axis, c) => ({ axis, c, kind: 'opening', away: Math.sign(c - mid[axis]) || 1,",
    with: "        const band = (axis, c) => ({ axis, c, kind: 'opening', away: Math.sign(mid[axis] - c) || 1,",
    test: 'along an opening edge the wall goes away from the hole' },
];

const run = (spec, grep) => {
  try {
    execSync(`npx playwright test ${spec}`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

// THE BASELINE FIRST. A spec that is already red kills every mutant and
// prints a perfect sheet over broken code.
if (run('tests/model-wall-justify.spec.js', null) !== 'passed') {
  console.error('BASELINE RED: tests/model-wall-justify.spec.js fails on an unmutated tree; nothing below would mean anything.');
  process.exit(1);
}
console.log('baseline green\n');

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); ambiguous += 1; continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.spec, m.test);
  let note = '';
  if (result === 'passed' && run(m.spec, null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant counts as
// AMBIGUOUS and fails the sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
