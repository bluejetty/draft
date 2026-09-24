// DOES THE LAYOUT-RECORD SPEC CATCH A SHEET THAT DRAWS THE WRONG PICTURE?
//
// proto/layout-record-mutants.js already gates the RECORD half of this board:
// whether a sheet set written by the old page survives the validator. That is
// Node, and Node cannot see ink. This file gates the other half.
//
// THE DIVISION IS THE POINT. A port could read every field of the record
// faithfully, write it back byte for byte, and draw the views somewhere else
// entirely -- or draw every view on every sheet, or draw none at all. The
// record checks pass throughout. Mutants 2 and 3 are exactly those, and they
// are the reason tests/layout-record.spec.js exists at all rather than the
// harness alone.
//
// Run: node proto/layout-record-spec-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.resolve(__dirname, '..');
// TWO SPECS, because the board has two halves: whether a saved record opens
// whole (layout-record) and whether the sheets draw what they say they draw
// (layout-compose's two-sheets-off-one-level pair).
const SPEC = 'tests/layout-record.spec.js tests/layout-compose.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'THE SAVED SHEETS ARE NOT LOADED: the page opens the drawing and '
      + 'starts the sheet set over empty',
    find: '      viewports: layout ? layout.viewports : [],',
    with: '      viewports: [],',
    test: 'the sheet set opens on the sheets it was left on' },

  { file: 'LAYOUT.html',
    // THE ONE THE NODE GATE CANNOT REACH. Every field of the record still
    // round-trips; the drawings simply are not where the record says.
    name: 'THE PAPER POSITION IS IGNORED WHEN DRAWING: the record round-trips '
      + 'perfectly and every view is drawn against the left margin',
    find: '    return { xIn: viewport.xIn - wIn / 2, yIn: viewport.yIn - hIn / 2, wIn, hIn };',
    with: '    return { xIn: 1, yIn: viewport.yIn - hIn / 2, wIn, hIn };',
    test: 'the sheet set opens on the sheets it was left on' },

  { file: 'LAYOUT.html',
    // AND THE OTHER ONE. Ink goes UP, not down, so a check that only asked
    // "did this sheet draw something" would call it healthy.
    name: 'THE SHEET FILTER STOPS FILTERING: all seven views draw on all five '
      + 'sheets, so every page of the set is the same picture',
    find: '    return this.state.viewports.filter(viewport => (viewport.sheet || 1) === sheet);',
    with: '    return this.state.viewports;',
    test: 'every sheet still carries its drawing' },

  { file: 'LAYOUT.html',
    name: 'A HAND-ARRANGED SET IS RE-DEALT ON LOAD, so a drafter-s arrangement '
      + 'is replaced by the composer-s every time the page is opened',
    find: '      if (this.state.auto) this._composeDefaultSet();',
    with: '      this._composeDefaultSet();',
    test: 'the sheet set opens on the sheets it was left on' },

  // THE TWO BELOW GUARD THE 23 SEP FIX, and they are aimed at
  // layout-compose.spec.js rather than this board's own spec: the defect was
  // in what the sheets DREW, and the sheet set that shows it is a two-storey
  // one whose level 1 carries both the concrete and the basement walls.
  { file: 'LAYOUT.html',
    name: 'THE VIEW IS NOT PASSED TO THE PAINTER AGAIN: both level-1 sheets go '
      + 'back to drawing the concrete and the basement walls stacked',
    find: '          view: viewport.view || null,',
    with: '          view: null,',
    test: 'the two sheets are two different drawings' },

  { file: 'layout-plan.js',
    // THE HALF THAT MADE THE FIRST ATTEMPT WORSE than the defect: the view
    // arrives, the filter runs, the field is dropped, and plan-composition's
    // second pass reads every wall as 'plan' and empties the sheet.
    name: 'planWalls DROPS THE WALL-S VIEW AGAIN, so the second filter throws '
      + 'the whole FOUNDATION drawing away and the sheet comes up blank',
    find: "          view: wall.view || 'plan',\n",
    with: '',
    test: 'the two sheets are two different drawings' },

  { file: 'LAYOUT.html',
    // THE FIRST DRAFT OF THIS AIMED AT THE FIXTURE -- `"sheet":2` flipped to
    // 1 -- and mutant-anchors-harness.js's rule refused it before it ran: the
    // fixture has TWO viewports on sheet 2, so `replace` would have moved one
    // of them and reported on whichever came first. The failure it was named
    // for lives in the page anyway.
    name: 'THE SHEET LIST IS ONE SHEET LONG whatever the record says, so four '
      + 'sheets of a five-sheet set cannot be reached at all',
    find: '    return Math.max(1, ...this.state.viewports.map(viewport => viewport.sheet || 1));',
    with: '    return 1;',
    test: 'the sheet set opens on the sheets it was left on' },
];

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this list has any uncommitted work in it silently
// destroyed the first time a mutant touches it.
const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')} ${SPEC}`,
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

const run = grep => {
  try {
    execSync(`npx playwright test ${SPEC}`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe',
        // Its own port, this directory's rule: playwright.config.js reuses a
        // server already on the default port, and a mutation run attaching to
        // another checkout's server would measure that tree instead of this one.
        env: { ...process.env, DRAFT_TEST_PORT: '4346' } });
    return 'passed';
  } catch { return 'failed'; }
};

// THE BASELINE, FIRST. A spec that is already failing kills every mutant and
// prints a perfect sheet over broken code -- the lie this gate exists to
// prevent, told by the gate itself.
if (run(null) !== 'passed') {
  console.log('REFUSING TO RUN: the spec is already failing before any mutant is '
    + 'applied.\nEvery mutant would read as KILLED and the sheet would be a lie.');
  process.exit(1);
}
console.log('baseline: the unmutated spec passes\n');

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const file = path.join(ROOT, m.file);
  const before = fs.readFileSync(file, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits !== 1) {
    console.log(`  SKIPPED   ${m.name}\n            (anchor matches ${hits}× — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(file, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  // A mutant caught by a DIFFERENT test than the one it is aimed at is not a
  // clean kill: the named test is still blind and the file would say
  // otherwise. drafting-brush-mutants.js's rule, kept.
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

console.log(`\nlayout record spec mutants: ${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} skipped (bad anchor)` : ''));
process.exit(killed === ran && !ambiguous ? 0 : 1);
