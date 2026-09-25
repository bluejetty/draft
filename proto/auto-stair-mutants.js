// DOES THE AUTO STAIR SPEC CATCH A HOUSE NOBODY CAN WALK THROUGH?
//
// The gate for tests/model-html-auto-stair.spec.js, in the shape its
// twenty-three siblings take: an ambiguous anchor is refused rather than
// guessed at, and a survivor is re-run against the whole spec before it is
// called one.
//
// THIS FEATURE'S FAILURE MODES ARE ALL QUIET ONES, and two of them are the
// same shape as bugs already found on this branch:
//
//   A STAIR THE READER DROPS. drawing-format.js validates a stair's id with
//   Number.isInteger, while walls, outlines, floors and openings all carry the
//   `kind-7` STRING that newDrawingItemId mints. A stair built with the wrong
//   one draws perfectly, saves without complaint, and is simply not there on
//   the next open. That was a real bug in this port, caught before it shipped.
//
//   A FLIGHT THAT DOES NOT STACK. The upper run standing over the lower is
//   what keeps the headroom, and a free placement looks exactly as finished on
//   the plan -- the drawing only comes apart when someone builds it.
//
//   A WELL ON A BEAM. MODEL.dc.html carried this one until 7 Sep: its
//   _stairFloorBeams read only the level's OWN floor view, so against the
//   app's own generated beams -- all filed at FOUNDATION -- it returned [],
//   the nudge took its empty-list exit, and the legality check reported the
//   beam half clear unconditionally. Both were inert on every built house, and
//   nothing said so.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the runs are placed and the floor is never opened',
    find: '    const cut = buildStairOpenings();',
    with: '    const cut = { cut: 0, nudges: [], refused: [], placed: [] };',
    test: 'a built two-storey arrives with stacked flights and cut openings' },
  { file: 'MODEL.html',
    name: 'the upper flight is placed free instead of over the one below',
    find: '      if (stairPlacementLegal(stacked)) {',
    with: '      if (false) {',
    test: 'a built two-storey arrives with stacked flights and cut openings' },
  { file: 'MODEL.html',
    name: 'THE BUG THIS PORT HIT: the stair id is a string, so the reader '
      + 'drops every one of them',
    find: '    let stairId = newStructureId(drawing.stairs);',
    with: "    let stairId = newDrawingItemId('stair');",
    test: 'every placed stair survives the reload with its id and riser count' },
  { file: 'MODEL.html',
    name: 'the id never advances, so the second stair is dropped as a duplicate',
    find: '      stairId += 1;',
    with: '      stairId += 0;',
    test: 'every placed stair survives the reload with its id and riser count' },
  { file: 'MODEL.html',
    name: "the riser count is left to the reader's default of 1",
    find: '      risers: sug.layout.risers,',
    with: '      risers: undefined,',
    test: 'every placed stair survives the reload with its id and riser count' },
  { file: 'MODEL.html',
    name: 'the well is never nudged off the beams carrying the floor',
    find: '      moved = stairNudgeOffBeams(stair) || moved;',
    with: '      moved = moved || false;',
    test: 'no stair opening lands on a beam carrying its floor' },
  { file: 'MODEL.html',
    name: "dc's own defect restored: only the level's OWN floor view is "
      + 'searched, so the generated beams are invisible and the check passes '
      + 'on an empty list',
    find: '      (Number(beam.levelId) === Number(levelId) && beam.view === \'floor\')',
    with: '      (Number(beam.levelId) === Number(levelId) && beam.view === \'nope\')',
    test: 'no stair opening lands on a beam carrying its floor' },
  { file: 'MODEL.html',
    name: 'a level that already has a stair gets a second one stacked on it',
    find: '    if (planStairs.some(stair => Number(stair.levelId) === Number(levelId))) return null;',
    with: '    if (false) return null;',
    test: 'a second press places nothing and says so' },
  { file: 'MODEL.html',
    name: 'the stairs ride no undo step, so Ctrl+Z leaves them in mid air',
    find: '      extra.push(...staired.placed);',
    with: '      extra.push();',
    test: 'one Ctrl+Z takes the stairs and their openings with the house' },
  { file: 'MODEL.html',
    name: 'the hole is cut out of a poured slab',
    find: "          && floor.structure !== 'slab' && (floor.points || []).length >= 3);",
    with: '          && (floor.points || []).length >= 3);',
    test: 'a built two-storey arrives with stacked flights and cut openings' },
  { file: 'MODEL.html',
    name: 'the button offers itself with nothing to descend from',
    find: '    const ready = !!window.DraftAutoStair && placeable.length > 0;',
    with: '    const ready = !!window.DraftAutoStair;',
    test: 'the button is greyed with no outline to descend from, and says why' },
  { file: 'MODEL.html',
    name: 'a press with STAIR armed is swallowed in silence',
    find: "      sayOnStrip('STAIR places through AUTO STAIR for now — hand placement is next.');",
    with: '      ;',
    test: 'a click with STAIR armed says hand placement is next' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-html-auto-stair.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
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
