// DOES THE LAYOUT-RECORD HARNESS CATCH A SHEET SET COMING BACK SHORT?
//
// layout-record-harness.js is fifteen checks of the shape "the record
// survives X", and that shape is the one that reads green while measuring
// nothing: a fixture with no viewports survives everything. It was green the
// first time it ran, which tells you precisely nothing.
//
// So each mutant below is a real way a saved sheet set could come apart under
// the port, and the question asked of the harness is whether it NOTICES.
//
// MUTANT 1 IS THE ONE THE GATE IS FOR. `cutIds` defaults to an empty Set, so
// a port that writes `format.layout(saved.layout, levelIds)` does not throw,
// does not warn, and silently drops EVERY section viewport off EVERY saved
// sheet set. The sheets come up looking fine with fewer drawings on them.
//
// MUTANT 8 IS THE OPPOSITE FAILURE and the reason check 9 is a pin rather
// than a comment: a port that helpfully starts preserving the plan
// viewport's `view` makes the FOUNDATION sheet and the basement plan differ
// under a drafter who never asked them to.
//
// IT RUNS THE HARNESS, NOT A SPEC, so the whole gate is seconds. There is no
// excuse for not running it.
//
// Run: node proto/layout-record-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.resolve(__dirname, '..');
const HARNESS = 'proto/layout-record-harness.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'THE CUT IDS ARE NOT PASSED: every section viewport falls off every '
      + 'saved sheet set, quietly, and the sheets just have less on them',
    find: 'const layout = saved?.layout ? format.layout(saved.layout, levelIds, cutIds) : null;',
    with: 'const layout = saved?.layout ? format.layout(saved.layout, levelIds) : null;' },

  { file: 'LAYOUT.html',
    name: 'THE PAPER IS PATCHED UNCONDITIONALLY, so every drawing saved before '
      + 'the picker existed opens with a null sheet size',
    find: '    if (layout?.paperKey) patch.paperKey = layout.paperKey;',
    with: '    patch.paperKey = layout?.paperKey;' },

  { file: 'drawing-format.js',
    name: 'A SECTION OUTLIVES ITS CUT: the viewport is kept pointing at a cut '
      + 'the Model Space deleted',
    find: '        if (!Number.isInteger(cutId) || !cutIds.has(cutId)) return null;',
    with: '        if (!Number.isInteger(cutId)) return null;' },

  { file: 'drawing-format.js',
    name: 'EVERY VIEWPORT LANDS ON SHEET 1: a five-sheet set opens as one page '
      + 'with five drawings stacked on it',
    find: '      const base = { id, kind, pif, xIn, yIn, sheet };',
    with: '      const base = { id, kind, pif, xIn, yIn, sheet: 1 };' },

  { file: 'drawing-format.js',
    name: 'THE NORTH ARROW COMES DOWN on every drawing that had it raised',
    find: '      northArrow: raw?.northArrow === true,',
    with: '      northArrow: false,' },

  { file: 'drawing-format.js',
    name: 'THE NEXT ID GOES BACKWARDS, so the next viewport placed collides '
      + 'with a saved one and the older of the two is dropped on the load after',
    find: '      nextViewportId: Math.max(',
    with: '      nextViewportId: Math.min(' },

  { file: 'drawing-format.js',
    // A WELL-MEANT CHANGE, which is why it is here: snapping the sheet to a
    // quarter inch is the sort of thing that reads like tidiness and moves
    // every hand-placed view on every saved drawing.
    name: 'THE SHEET SNAPS TO A QUARTER INCH: a nudged view loses the spot the '
      + 'drafter put it in',
    find: '      const xIn = num(viewport?.xIn);',
    with: '      const xIn = num(viewport?.xIn) === null ? null\n'
      + '        : Math.round(num(viewport?.xIn) * 4) / 4;' },

  { file: 'drawing-format.js',
    // THE DEFECT THIS GATE ACTUALLY FOUND, put back. `view` says which
    // drawing of a level a plan viewport is, and dropping it here made the
    // FOUNDATION sheet and the basement sheet the same picture on every
    // drawing that had been saved and reopened.
    name: 'THE READER DROPS `view` AGAIN, so FOUNDATION and the basement plan '
      + 'collapse back into two copies of one drawing',
    find: `        const view = oneOf(viewport?.view, LINE_VIEWS, null);
        return view
          ? { ...base, levelId: viewportLevelId, view }
          : { ...base, levelId: viewportLevelId };`,
    with: '        return { ...base, levelId: viewportLevelId };' },

  { file: 'shell-bars.js',
    // INVERTED WHEN THE PORT LANDED, and the anchors harness is what said so:
    // this used to point the bar AT the new name while the page was still the
    // old one. Now the page is LAYOUT.html and the failure runs the other way
    // -- a bar left pointing at the file the port deleted.
    name: 'THE PORT RENAMES THE PAGE AND LEAVES THE BAR ALONE: a dead '
      + 'CONSTRUCTION LAYOUT chip on all six pages of the shop',
    find: "      href: './LAYOUT.html',",
    with: "      href: './LAYOUT.dc.html'," },

  // THE THREE BELOW MUTATE THE FIXTURE, not the code. They are the guards on
  // the guard: this whole file is worthless if the record it opens is thin,
  // and a thin record is the easiest thing in the world to swap in by
  // accident -- re-capture it off a page that had not been dealt, or off one
  // whose flag was still up, and every check above passes over nothing.
  { file: 'proto/layout-record-dc.draft',
    name: 'THE FIXTURE BECOMES AN `auto` RECORD, which the page re-deals on '
      + 'load -- so it is written again rather than carried, and proves nothing',
    find: '"auto":false',
    with: '"auto":true' },

  { file: 'proto/layout-record-dc.draft',
    name: 'THE FIXTURE WEARS THE DEFAULT STRIP, so a reader that ignores '
      + 'titleblock entirely returns the right answer by accident',
    find: '"titleblock":"bluejetty-band"',
    with: '"titleblock":"roughdrafter"' },

  { file: 'proto/layout-record-dc.draft',
    name: 'THE FIXTURE LOWERS ITS NORTH ARROW, so a reader that never reads '
      + 'the field agrees with it',
    find: '"northArrow":true',
    with: '"northArrow":false' },
];

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this list has any uncommitted work in it silently
// destroyed the first time a mutant touches it. Derived from MUTANTS rather
// than typed out again, because the two lists drifting is the same class of
// bug this directory is about.
const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

const run = () => {
  try {
    execSync(`node ${HARNESS}`, { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// THE BASELINE, FIRST. A mutant counts as KILLED when the harness fails, so a
// harness that is ALREADY failing kills every mutant and prints a perfect
// sheet over broken code -- the lie this gate exists to prevent, told by the
// gate itself.
if (run() !== 'passed') {
  console.log('REFUSING TO RUN: the harness is already failing before any mutant '
    + 'is applied.\nEvery mutant would read as KILLED and the sheet would be a lie.');
  process.exit(1);
}
console.log('baseline: the unmutated harness passes\n');

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const file = path.join(ROOT, m.file);
  const before = fs.readFileSync(file, 'utf8');
  // THE ANCHOR MUST BE UNIQUE, not merely present: `replace` takes the FIRST
  // match, so an anchor occurring twice mutates whichever copy comes first and
  // the gate prints SURVIVED when the truth is "the mutant never reached the
  // code". units-stack-mutants.js paid for that lesson.
  const hits = before.split(m.find).length - 1;
  if (hits !== 1) {
    console.log(`  SKIPPED   ${m.name}\n            (anchor matches ${hits}× — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(file, before.replace(m.find, m.with));
  const result = run();
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}`);
}

console.log(`\nlayout record mutants: ${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} skipped (bad anchor)` : ''));
// A SKIPPED MUTANT IS A FAILURE OF THE GATE, not a neutral outcome: it means
// this file believes it tested something it never applied.
process.exit(killed === ran && !ambiguous ? 0 : 1);
