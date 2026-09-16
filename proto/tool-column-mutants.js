// DOES THE TOOL-COLUMN SPEC CATCH A BROKEN COLUMN?
//
// Every one of its six checks went green first try, and the run that was
// supposed to prove them red beforehand was red for the WRONG reason -- the
// fixture was never seeded, so all six failed at "no drawing saved" without
// ever reaching an assertion. A test that has only ever been green, and whose
// one red run proves nothing, is exactly the check this project keeps finding:
// broken and passing look the same from the outside.
//
// So each check gets a mutant aimed at it. The mutation is applied to the real
// file, the one test that should notice is run, and the file is restored from
// HEAD -- which is why the baseline is committed BEFORE this runs. `git
// checkout --` restores HEAD, not the working tree, and running this over
// uncommitted wiring destroys it.
//
// `assert` on every anchor. A mutation whose text does not match applies
// nothing, the test passes, and the run reports a killed mutant it never made.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  {
    name: 'a tool goes missing from the roster',
    file: 'tool-roster.js',
    find: "    { id: 'shape',        name: 'SHAPE',        group: 'draw',  kind: 'contextual', command: 'shape' },\n",
    with: '',
    test: 'seventeen keys',
  },
  {
    name: 'two tools swap places',
    file: 'tool-roster.js',
    find: "    { id: 'copy',         name: 'Copy',         group: 'draw',  kind: 'standard',   command: 'copy' },\n    { id: 'trim',         name: 'Trim',         group: 'draw',  kind: 'standard',   command: 'trim' },\n",
    with: "    { id: 'trim',         name: 'Trim',         group: 'draw',  kind: 'standard',   command: 'trim' },\n    { id: 'copy',         name: 'Copy',         group: 'draw',  kind: 'standard',   command: 'copy' },\n",
    test: 'seventeen keys',
  },
  {
    name: 'a bare key gets a letter invented for it',
    file: 'tool-roster.js',
    find: "{ id: 'beam',         name: 'BEAM',         group: 'build', kind: 'contextual', command: null }",
    with: "{ id: 'beam',         name: 'BEAM',         group: 'build', kind: 'contextual', command: 'background' }",
    test: 'twelve keys carry a letter',
  },
  {
    name: 'the letters ignore SETTINGS and use the defaults',
    file: 'tool-roster.js',
    find: '    const stored = window.DraftProfileManager\n      ?.getActive(\'settings\')?.content?.keybindings;',
    with: '    const stored = null;',
    test: 'a SETTINGS remap',
  },
  {
    name: 'the register lets two tools be armed at once',
    file: 'MODEL.html',
    find: "      btn.setAttribute('aria-pressed', String(btn.dataset.toolKey === next));",
    with: "      if (btn.dataset.toolKey === next) btn.setAttribute('aria-pressed', 'true');",
    test: 'the register holds one tool',
  },
  {
    name: 'the keypad keeps its own state and leaves the old button behind',
    file: 'MODEL.html',
    find: "    drawButton.classList.toggle('armed', next === 'wall');",
    with: '',
    test: 'ONE register',
  },
  {
    name: 'the press dispatch stops reading the register',
    file: 'MODEL.html',
    find: "    if (activeTool === 'wall') { drawPress(at); return; }",
    with: '',
    test: 'a wall still commits',
  },
];

const run = grep => {
  try {
    execSync(`npx playwright test tests/model-tool-column.spec.js -g ${JSON.stringify(grep)} --reporter=line`,
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch {
    return 'failed';
  }
};

const dirty = execSync('git status --porcelain tool-roster.js MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: tool-roster.js or MODEL.html has uncommitted '
    + 'changes, and this script restores them from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  if (!before.includes(m.find)) {
    console.log(`  SKIPPED (anchor not found): ${m.name}`);
    continue;
  }
  fs.writeFileSync(path, before.replace(m.find, m.with));
  const result = run(m.test);
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}`
    + `   (${m.test})`);
}
console.log(`\n${killed}/${MUTANTS.length} killed`);
process.exit(killed === MUTANTS.length ? 0 : 1);
