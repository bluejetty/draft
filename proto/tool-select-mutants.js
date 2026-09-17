// DOES THE SELECTION SPEC CATCH A BROKEN SELECTION?
//
// Same gate as proto/tool-column-mutants.js, same reason. Six of these seven
// checks went green first try; the seventh was red, and it was red for the
// WRONG REASON -- the spec was clicking at a world point it had mis-mapped, so
// "the ALL filter does not grab a line" was really "there is nothing where you
// clicked". A click that misses and a filter that excludes look identical from
// outside, which is the whole defect class.
//
// Restores from HEAD, so the baseline must be committed first, and refuses to
// run if it is not.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  {
    name: 'ALL LEVELS becomes a modifier instead of a third mode',
    find: "  const setSelectionMode = id => {\n    selectionMode = id;",
    with: "  const setSelectionMode = id => {\n    selectionMode = id === 'window-all' ? 'window' : id;",
    test: 'the mode help says exactly',
  },
  {
    name: 'picking a mode no longer arms SELECT',
    find: "    selectionMode = id;\n    setTool('select');",
    with: '    selectionMode = id;',
    test: 'picking a mode also arms SELECT',
  },
  {
    name: 'the mode help drops the shift-drag sentence',
    find: "    click: 'Click items to select; Shift adds or removes. Press and drag for a '\n      + 'blue window — hold Shift while dragging for a red all-levels window.',",
    with: "    click: 'Click items to select; Shift adds or removes.',",
    test: 'the mode help says exactly',
  },
  {
    name: 'the filter help is red all the time',
    find: "      filterHelpEl.toggleAttribute('data-engaged', selectFilter !== 'all');",
    with: "      filterHelpEl.toggleAttribute('data-engaged', true);",
    test: 'an engaged filter turns the help red',
  },
  {
    name: 'the filter stops restricting -- everything responds',
    find: "  const filterAllows = type => selectFilter === 'all' || selectFilter === type;",
    with: '  const filterAllows = () => true;',
    test: 'the WALL filter stops a line responding',
  },
  {
    name: 'the filter over-restricts -- nothing responds',
    find: "  const filterAllows = type => selectFilter === 'all' || selectFilter === type;",
    with: "  const filterAllows = type => selectFilter === type;",
    test: 'the WALL filter stops a line responding',
  },
  {
    name: 'shift adds but never removes',
    // RE-POINTED. Both arms were rewritten when withGroup() arrived: the
    // toggle now compares by item identity across a group rather than by
    // index. The DEFECT is the same one -- shift adds and never takes away --
    // so only the removing arm is neutralised.
    find: "          setSelection(at >= 0\n            ? selection.filter(entry => !whole.some(w => w.item === entry.item))\n            : selection.concat(whole.filter(w =>\n              !selection.some(entry => entry.item === w.item))));",
    with: "          setSelection(at >= 0\n            ? selection\n            : selection.concat(whole.filter(w =>\n              !selection.some(entry => entry.item === w.item))));",
    test: 'shift adds and shift removes',
  },
  {
    name: 'a plain click stops clearing the selection',
    // RE-POINTED. `setSelection(hit ? [hit] : [])` became
    // `setSelection(withGroup(hit))`, which returns the same empty array for
    // a miss. The comment is kept in the anchor because the bare call now
    // appears twice in MODEL.html -- the other is the never-armed press path
    // at :9253 -- and an anchor that matches the wrong one mutates the wrong
    // branch while still reporting a result.
    find: "        // An empty click clears, which is the other half of select: without it\n        // the drafter has no way to put a selection down.\n        setSelection(withGroup(hit));",
    with: "        // An empty click clears, which is the other half of select: without it\n        // the drafter has no way to put a selection down.\n        if (hit) setSelection(withGroup(hit));",
    test: 'a plain click on empty space',
  },
  {
    name: 'Esc drops the selection AND the filter in one press',
    find: "      if (!selection.length && selectFilter !== 'all') setSelectFilter('all');",
    with: "      if (selectFilter !== 'all') setSelectFilter('all');",
    test: 'Esc clears the selection',
  },
  {
    name: 'a window takes what it crosses, not what it encloses',
    find: "        if (inside(item.start) && inside(item.end)) out.push({ type: 'wall', item });",
    with: "        if (inside(item.start) || inside(item.end)) out.push({ type: 'wall', item });",
    test: 'one end of a wall',
  },
  {
    name: 'a floor only needs one corner in the box',
    find: '        if (pts.length >= 3 && pts.every(inside)) out.push',
    with: '        if (pts.length >= 3 && pts.some(inside)) out.push',
    test: 'every corner is in the box',
  },
  {
    name: 'ALL LEVELS stops reaching past the active level',
    find: "    const all = selectionMode === 'window-all';",
    with: '    const all = false;',
    test: 'ALL LEVELS reaches upstairs',
  },
  {
    name: 'WINDOW starts reaching every level too',
    find: "    const all = selectionMode === 'window-all';",
    with: '    const all = true;',
    test: 'ALL LEVELS reaches upstairs',
  },
  {
    name: 'the filter stops restricting a window',
    find: "    if (filterAllows('line')) {\n      scope('lines', lines).forEach(item => {",
    with: '    if (true) {\n      scope(\'lines\', lines).forEach(item => {',
    test: 'the OBJECT TYPE filter restricts a window',
  },
  {
    name: 'a shift-drag replaces instead of adding',
    find: '        setSelection(band.shift\n          ? selection.concat(caught.filter(c =>\n            !selection.some(entry => entry.item === c.item)))\n          : caught);',
    with: '        setSelection(caught);',
    test: 'shift-drag adds to the selection',
  },
  {
    name: 'a tap in a window mode stops selecting',
    find: "        const hit = hitAt(toWorld(e.clientX - rect.left, e.clientY - rect.top));\n        setSelection(hit ? [hit] : []);\n      }\n      paint();\n      return;",
    with: '        setSelection([]);\n      }\n      paint();\n      return;',
    test: 'a tap in a window mode still selects',
  },
  {
    name: 'the readout stops reporting the selection',
    find: "      + (selection.length ? `   <b>${selection.length} selected</b>` : '')",
    with: '',
    test: 'shift adds and shift removes',
  },
];

// `grep` runs only the check a mutant is aimed at, which is fast. But an
// aimed mutant that survives has TWO possible meanings -- the suite cannot see
// this defect, or the mutant was pointed at the wrong check -- and those look
// identical in the output. That has now happened twice in this file: the
// enclosure mutants stayed aimed at the weak check they had exposed, so the
// new checks written to catch them were never run against them.
//
// So a survivor is re-run against the WHOLE spec before it is called a
// survivor. Slower, and only on survivors, which are meant to be rare.
const run = grep => {
  try {
    execSync(`npx playwright test tests/model-tool-select.spec.js`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: MODEL.html has uncommitted changes and this '
    + 'script restores it from HEAD.\n' + dirty);
  process.exit(1);
}

const PATH = `${ROOT}/MODEL.html`;
let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const before = fs.readFileSync(PATH, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) {
    console.log(`  SKIPPED (anchor not found): ${m.name}`);
    continue;
  }
  // AN AMBIGUOUS ANCHOR IS WORSE THAN A MISSING ONE. String.replace takes the
  // FIRST match, so a `find` that now occurs twice quietly mutates a site the
  // test was never watching, the test passes, and the run reports a survivor
  // that was never actually attacked. That is exactly what happened to "a
  // plain click stops clearing the selection" the moment the window drag added
  // a second `setSelection(hit ? [hit] : [])`.
  if (hits > 1) {
    console.log(`  AMBIGUOUS (${hits} matches, refusing to guess): ${m.name}`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(PATH, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed') {
    // Aimed check let it through. Was anything else watching?
    if (run(null) === 'failed') { result = 'failed'; note = '  (caught by another check -- re-aim `test`)'; }
  }
  execSync('git checkout -- MODEL.html', { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never against what ran. A SKIPPED mutant
// leaves `ran` smaller, so `10/10 killed` prints like a clean sheet while the
// exit code says otherwise -- and the line is what gets read.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ran < MUTANTS.length ? ` -- ${MUTANTS.length - ran} NEVER RAN` : '')
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS -- anchors that match more than one site` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
