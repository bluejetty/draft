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
    find: "          setSelection(at >= 0\n            ? selection.filter((_, i) => i !== at)\n            : selection.concat([hit]));",
    with: '          setSelection(at >= 0 ? selection : selection.concat([hit]));',
    test: 'shift adds and shift removes',
  },
  {
    name: 'a plain click stops clearing the selection',
    find: '        setSelection(hit ? [hit] : []);',
    with: '        if (hit) setSelection([hit]);',
    test: 'a plain click on empty space',
  },
  {
    name: 'Esc drops the selection AND the filter in one press',
    find: "      if (!selection.length && selectFilter !== 'all') setSelectFilter('all');",
    with: "      if (selectFilter !== 'all') setSelectFilter('all');",
    test: 'Esc clears the selection',
  },
  {
    name: 'the readout stops reporting the selection',
    find: "      + (selection.length ? `   <b>${selection.length} selected</b>` : '')",
    with: '',
    test: 'shift adds and shift removes',
  },
];

const run = grep => {
  try {
    execSync(`npx playwright test tests/model-tool-select.spec.js -g ${JSON.stringify(grep)} --reporter=line`,
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: '/home/user/draft' }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: MODEL.html has uncommitted changes and this '
    + 'script restores it from HEAD.\n' + dirty);
  process.exit(1);
}

const PATH = '/home/user/draft/MODEL.html';
let killed = 0, ran = 0;
for (const m of MUTANTS) {
  const before = fs.readFileSync(PATH, 'utf8');
  if (!before.includes(m.find)) {
    console.log(`  SKIPPED (anchor not found): ${m.name}`);
    continue;
  }
  ran += 1;
  fs.writeFileSync(PATH, before.replace(m.find, m.with));
  const result = run(m.test);
  execSync('git checkout -- MODEL.html', { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}`);
}
console.log(`\n${killed}/${ran} killed`);
process.exit(killed === ran && ran === MUTANTS.length ? 0 : 1);
