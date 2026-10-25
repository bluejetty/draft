// DOES THE LINE-BODY SPEC CATCH A GRAB THAT LIES?
//
// The LINE panel has promised since it was written that a line is two points
// and drags like a wall. #20 gave cornerAt its ENDS; its BODY stayed on the
// wall-only question, so a press in the middle of a selected line slid the
// sheet while a press on either end moved the point. One record, two grabs,
// two answers -- and a drafter reads the one that does nothing as the line
// being stuck.
//
// The ways to build the other half wrong are the ways the first half could
// have been built wrong: ask the wrong question, drop the selection rule, or
// move one end where the gesture moves both. Each is a mutant here.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-line-like-wall.spec.js';

const MUTANTS = [
  { file: 'model/07-walls-magnet.js',
    name: 'the body grab asks for a WALL again: a line is stuck in the middle',
    // ANCHORED ON THE PICK AND ITS GUARD, which segmentBodyAt alone has in
    // this spelling: cornerAt's copy is followed by its own filter note and
    // then nearestVertex, so three lines tell the two apart.
    find: '    const selectedSeg = selectedSegment() || fixedWall();\n'
      + '    if (!selectedSeg || !selectedSeg.start || !selectedSeg.end) return null;',
    with: '    const selectedSeg = selectedWall() || fixedWall();\n'
      + '    if (!selectedSeg || !selectedSeg.start || !selectedSeg.end) return null;',
    test: 'a selected LINE drags by its BODY' },

  { file: 'model/07-walls-magnet.js',
    name: 'the selection rule goes: every press near any line moves it '
      + 'instead of sliding the sheet',
    find: '    const selectedSeg = selectedSegment() || fixedWall();',
    with: '    const selectedSeg = selectedSegment() || lines()[0];',
    test: 'an UNSELECTED line is not dragged by a press on its body' },

  { file: 'model/07-walls-magnet.js',
    name: 'the body drag moves ONE end, so a line dragged by its middle '
      + 'swings instead of travelling',
    find: '  const movingEnds = wall => [wall.start, wall.end];',
    with: '  const movingEnds = wall => [wall.start];',
    test: 'a selected LINE drags by its BODY' },

  // ── AND THE FILTER THAT SHUTS THE LINE OUT ──────────────────────────────
  { file: 'model/07-walls-magnet.js',
    name: 'the type filter does not reach the BODY grab: WALL is engaged and '
      + 'a line still drags by its middle',
    find: "    if (!filterAllows(walls().includes(selectedSeg) ? 'wall' : 'line')) return null;\n"
      + '    const { d } = window.DraftGeometry2D.pointToSegment(worldPt, selectedSeg);',
    with: '    const { d } = window.DraftGeometry2D.pointToSegment(worldPt, selectedSeg);',
    test: 'nor by its BODY' },

  { file: 'model/07-walls-magnet.js',
    name: 'nor the END grab: WALL is engaged and a line still drags by its end',
    find: "    if (!filterAllows(walls().includes(selectedSeg) ? 'wall' : 'line')) return null;\n"
      + '    const G = window.DraftGeometry2D;',
    with: '    const G = window.DraftGeometry2D;',
    test: 'does not drag by its END' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4356' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline: the restore is
// `git checkout -- <file>`, so uncommitted work in a mutated file is
// destroyed the first time a mutant touches it, and a guard that fires only
// afterwards lets you walk away believing the gate is running.
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
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

console.log(`\n${killed}/${ran} mutations caught`
  + (ambiguous ? `, ${ambiguous} skipped` : ''));
process.exit(killed === ran && !ambiguous ? 0 : 1);
