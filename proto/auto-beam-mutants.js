// DOES THE AUTO BEAM SPEC CATCH A WIRING THAT PLACES NOTHING USEFUL?
//
// The gate for tests/model-html-auto-beam.spec.js, in the shape the other
// twenty-one take: an ambiguous anchor is refused rather than guessed at, and
// a survivor is re-run against the whole spec before it is called one.
//
// THIS FEATURE'S FAILURE MODE IS A RECORD IN THE RIGHT ARRAY AND THE WRONG
// DRAWING. A beam filed on level 3 or on the 'plan' view is in the save file,
// passes the format, and paints on no sheet -- S-BEAM and S-COL-FOOTING are in
// the FOUNDATION view's layer list and in no other (layer-views.js:32). Half
// the mutants below are that one bug wearing different hats, because that is
// the bug that was actually available: MODEL.html's own beamPress files by
// where the drafter is standing, and copying it here would have been the
// natural thing to write.
//
// AND THE OTHER HALF IS THE DEAD-CALLER TRAP. tests/beam-corner.spec.js has
// nine green tests over this geometry and every one drives /MODEL.dc.html
// (tests/helpers.js:154), so the module was covered while the app placed
// nothing at all. Mutant 1 is that defect restored: if it survives, this file
// is measuring the module again instead of the page.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE DEFECT THIS FIXED: the bone builds a house and places no beam',
    find: '    const beamed = placeAutoBeam();\n    if (beamed !== -1) {',
    with: '    const beamed = -1;\n    if (beamed !== -1) {',
    test: 'a built house arrives with its mid-span beam and teleposts on FOUNDATION' },
  { file: 'MODEL.html',
    name: 'the beam is filed on the level the drafter is standing on',
    find: "    const levelId = FOUNDATION_LEVEL_ID;\n    const view = 'foundation';",
    with: "    const levelId = onActiveLevel().levelId;\n    const view = 'foundation';",
    test: 'a built house arrives with its mid-span beam and teleposts on FOUNDATION' },
  { file: 'MODEL.html',
    name: 'the beam is filed on the layer set the drafter is standing on',
    find: "    const levelId = FOUNDATION_LEVEL_ID;\n    const view = 'foundation';",
    with: "    const levelId = FOUNDATION_LEVEL_ID;\n    const view = wallHomeView(onActiveLevel().viewId);",
    test: 'a built house arrives with its mid-span beam and teleposts on FOUNDATION' },
  { file: 'MODEL.html',
    name: 'the beam is not marked generated, so nothing can ever sweep it',
    find: "        mode: 'flush',\n        auto: true,",
    with: "        mode: 'flush',",
    test: 'every record survives the reload' },
  { file: 'MODEL.html',
    name: 'the column is not marked generated',
    find: "        footing: 'pad36',\n        auto: true,",
    with: "        footing: 'pad36',",
    test: 'every record survives the reload' },
  { file: 'MODEL.html',
    name: 'the id never rises, so the format drops every beam after the first',
    find: '        id: beamId++,',
    with: '        id: beamId,',
    test: 'every record survives the reload' },
  { file: 'MODEL.html',
    name: 'a re-run lays a second set on top of the first',
    find: '    drawing.beams = (drawing.beams || []).filter(beam => {\n'
      + '      if (!isMine(beam)) return true;\n      sweptBeams.push(beam);\n      return false;\n    });',
    with: '',
    test: 're-running replaces its own structure and leaves a drafter’s alone' },
  { file: 'MODEL.html',
    name: 'the sweep takes the drafter’s own beam with it',
    find: '    const isMine = item => item.auto === true\n'
      + '      && Number(item.levelId) === levelId && item.view === view;',
    with: '    const isMine = item => Number(item.levelId) === levelId && item.view === view;',
    test: 're-running replaces its own structure and leaves a drafter’s alone' },
  { file: 'MODEL.html',
    name: 'the garage is taken for the house, so the beam runs through it',
    find: '      && outline.garage !== true\n',
    with: '',
    test: 'the garage is not the house footprint' },
  { file: 'MODEL.html',
    name: 'the stair opening is ignored and the beam crosses it',
    find: '      holes: stairHolesOn(points, storeyId),',
    with: '      holes: [],',
    test: 'a stair opening in the floor above pushes the beam off it' },
  { file: 'MODEL.html',
    name: 'the stair is read off the level the beam is filed on, not the floor above',
    find: '      holes: stairHolesOn(points, storeyId),',
    with: '      holes: stairHolesOn(points, FOUNDATION_LEVEL_ID),',
    test: 'a stair opening in the floor above pushes the beam off it' },
  { file: 'MODEL.html',
    name: 'the button press writes no undo step, so Ctrl+Z cannot reach it',
    find: '    if (result.placed.length || result.restored.length) {\n      undoStack.push({',
    with: '    if (false) {\n      undoStack.push({',
    test: 'one Ctrl+Z takes the beam back, and the bone press takes it with the house' },
  { file: 'MODEL.html',
    name: 'arming BEAM shows nothing, so the button exists only for COLUMN',
    find: "    if (tool === 'beam' || tool === 'column') { showBeamProps(); return; }",
    with: "    if (tool === 'column') { showBeamProps(); return; }",
    test: 'the BEAM tool raises the panel, and its button is the second way in' },
  { file: 'MODEL.html',
    name: 'the button offers to file a beam against a level the drawing has not got',
    find: '    const ready = !!found && levelPresent(FOUNDATION_LEVEL_ID);',
    with: '    const ready = !!found;',
    test: 'no FOUNDATION level means the button is greyed, not a record filed nowhere' },
  { file: 'MODEL.html',
    name: 'a house under 19 ft gets silence instead of the rule’s own answer',
    find: "      : 'Every span is under 19′ — no mid-span beam needed.');",
    with: "      : '');",
    test: 'a span under 19 ft gets no beam, and the page says so rather than going quiet' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-html-auto-beam.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
