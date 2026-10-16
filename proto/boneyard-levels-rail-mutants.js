// DOES THE RAIL SPEC CATCH A RAIL THAT IS NOT WHERE HE ASKED FOR IT?
//
// Movie, 16 Oct: "squeeze in between the 2 windows the LEVELS ... so they are
// stacked between the 2 windows ... the 3D Model area can get smaller and the
// 3D model smaller as well".
//
// This is a layout change, and the trouble with layout is that every wrong
// answer still renders: a rail stacked under the panes, a rail squeezed to
// nothing, chips in a row inside it, chips floating halfway down it, panes
// still split even, a model laid out for a window it is no longer in. The
// page looks like a page in every one of those. Each is a mutant here.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/boneyard-levels-rail.spec.js';

const MUTANTS = [
  { file: 'BONEYARD.html',
    name: 'the levels go back into the right pane\'s head, where a fourth '
      + 'level squeezes the title and the verbs along',
    find: '    <div class="levels-rail" aria-label="Levels">\n'
      + '      <div class="legend" id="legend"></div>\n'
      + '    </div>\n',
    with: '',
    extra: [{ find: '        <span class="title" id="level-title">LEVEL</span>\n',
      with: '        <span class="title" id="level-title">LEVEL</span>\n'
        + '        <div class="legend" id="legend"></div>\n' }],
    test: 'the levels sit between the two windows' },

  { file: 'BONEYARD.html',
    name: 'the rail is put after both windows, so the levels stand to the '
      + 'right of the page instead of between them',
    find: '    <div class="levels-rail" aria-label="Levels">\n'
      + '      <div class="legend" id="legend"></div>\n'
      + '    </div>\n',
    with: '',
    extra: [{ find: '  </main>',
      with: '    <div class="levels-rail" aria-label="Levels">\n'
        + '      <div class="legend" id="legend"></div>\n'
        + '    </div>\n  </main>' }],
    test: 'the levels sit between the two windows' },

  { file: 'BONEYARD.html',
    name: 'the rail may shrink: FOUNDATION is cut off on its own chip',
    find: '  .levels-rail { flex: none; display: flex; align-items: flex-start; }',
    with: '  .levels-rail { flex: 0 1 0; min-width: 0; display: flex; align-items: flex-start; }',
    test: 'they are stacked, top-aligned, and none of them is clipped' },

  { file: 'BONEYARD.html',
    name: 'the chips are left in a row, so the rail is the old legend stood '
      + 'somewhere narrower',
    find: '  .levels-rail .legend { flex-direction: column; align-items: stretch;',
    with: '  .levels-rail .legend { align-items: stretch;',
    test: 'they are stacked, top-aligned, and none of them is clipped' },

  { file: 'BONEYARD.html',
    name: 'the chips are sized to their own names, so the rail is a ragged '
      + 'edge rather than a stack',
    find: '  .levels-rail .legend { flex-direction: column; align-items: stretch;',
    with: '  .levels-rail .legend { flex-direction: column; align-items: flex-start;',
    test: 'they are stacked, top-aligned, and none of them is clipped' },

  { file: 'BONEYARD.html',
    name: 'the stack floats in the middle of the rail instead of starting '
      + 'with the two windows',
    find: '  .levels-rail { flex: none; display: flex; align-items: flex-start; }',
    with: '  .levels-rail { flex: none; display: flex; align-items: center; }',
    test: 'they are stacked, top-aligned, and none of them is clipped' },

  { file: 'BONEYARD.html',
    name: 'the level names are allowed to wrap, so a chip is two lines deep '
      + 'and the stack no longer reads as a list',
    find: '  .levels-rail .legend button { justify-content: flex-start; white-space: nowrap; }',
    with: '  .levels-rail .legend button { justify-content: flex-start; width: 40px; }',
    test: 'they are stacked, top-aligned, and none of them is clipped' },

  { file: 'BONEYARD.html',
    name: 'the 3D gives up nothing: the two windows split the page even, and '
      + 'the rail is squeezed in out of the gap between them',
    find: '  .pane-3d { flex: 0 1 38%; }',
    with: '  .pane-3d { flex: 1; }',
    test: 'the 3D side is the one that gave up the room' },

  { file: 'BONEYARD.html',
    name: 'the WRONG window is narrowed -- the editing side, which is the one '
      + 'every foot of is worked in',
    find: '    <section class="pane pane-3d" aria-label="The bones in 3D">',
    with: '    <section class="pane" aria-label="The bones in 3D">',
    extra: [{ find: '    <section class="pane" aria-label="The chosen level">',
      with: '    <section class="pane pane-3d" aria-label="The chosen level">' }],
    test: 'the 3D side is the one that gave up the room' },

  { file: 'BONEYARD.html',
    name: 'the model is laid out for the window it used to have, so the '
      + 'narrower one cuts it off',
    find: '        laid = BL.layout(shown(), angle, w, h, 30, tilt);',
    with: '        laid = BL.layout(shown(), angle, w * 1.6, h, 30, tilt);',
    test: 'the 3D side is the one that gave up the room' },

  { file: 'BONEYARD.html',
    name: 'the model is drawn small inside the window instead of to it, which '
      + 'is a smaller picture for the wrong reason',
    find: '        laid = BL.layout(shown(), angle, w, h, 30, tilt);',
    with: '        laid = BL.layout(shown(), angle, w, h, 160, tilt);',
    test: 'the 3D side is the one that gave up the room' },

  { file: 'BONEYARD.html',
    name: 'a chip in the rail no longer picks its level',
    find: '          b.addEventListener(\'click\', () => { pick(level); });',
    with: '          if (level.kind === \'roof\') b.addEventListener(\'click\', () => { pick(level); });',
    test: 'every chip in the rail still picks its level' },

  { file: 'BONEYARD.html',
    name: 'the rail stops saying WHICH level is picked -- and with the levels '
      + 'out of the pane head it is the only place that is written',
    find: '          b.setAttribute(\'aria-pressed\', String(picked === level));',
    with: '          b.setAttribute(\'aria-pressed\', \'false\');',
    test: 'every chip in the rail still picks its level' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4373' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync('git status --porcelain BONEYARD.html',
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
  const edits = [{ find: m.find, with: m.with }, ...(m.extra || [])];
  if (!edits.every(edit => before.includes(edit.find))) {
    console.log(`  SKIPPED   ${m.name}  (anchor not found — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(path, edits.reduce((text, edit) =>
    text.replace(edit.find, edit.with), before));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check — re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
