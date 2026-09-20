// DOES THE DRAFTING BRUSH'S SPEC CATCH A BRUSH THAT PAINTS NOTHING?
//
// The gate for tests/model-html-drafting-brush.spec.js. The rule the whole
// tool turns on is THE BRUSH CARRIES WHAT A THING IS, NEVER WHERE IT IS, and
// a spec can pass that rule's easy half -- "did the type arrive?" -- while
// being blind to its hard half -- "did anything about position move?". So the
// mutants below break each half separately.
//
// MUTANT 3 IS THE ONE WORTH THE GATE. Every other check passes if the brush
// simply assigns the source record over the target: the type arrives, the
// height arrives, the chip lights. What breaks is that wall b moves on top of
// wall a, which is the failure a "did it copy?" check cannot see and the one
// a drafter would report as the page destroying his drawing.
//
// Run: node proto/drafting-brush-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-drafting-brush.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE CHIP GOES BACK TO SLEEP: a control the page draws and cannot use',
    find: '    <button type="button" id="strip-brush" class="chip" data-mode-brush',
    with: '    <button type="button" id="strip-brush" class="chip dormant" disabled data-mode-brush',
    test: 'the chip is awake, and empty it says nothing' },

  { file: 'MODEL.html',
    name: 'THE BRUSH PAINTS NOTHING: it lifts and lights and never gives',
    find: '    Object.assign(item, brushLoad.props);',
    with: '    void brushLoad;',
    test: 'a second wall takes the first one-s properties and does not move' },

  // THE FIRST DRAFT OF THIS MUTANT WAS A NO-OP -- `brushLoad.source ||
  // brushLoad.props` on a load that has no `source`, so it fell straight back
  // to the real value and "survived" while changing nothing. A mutation that
  // does not mutate proves nothing and reads exactly like one that does.
  { file: 'MODEL.html',
    name: 'THE WHOLE RECORD TRAVELS, so a dusted wall lands on top of its source',
    find: '    const out = {};',
    with: '    return { ...item }; /* mutant */ // eslint-disable-line',
    test: 'a second wall takes the first one-s properties and does not move' },

  { file: 'MODEL.html',
    name: 'POSITION IS A PROPERTY: the wall arrives wearing where it came from',
    find: "    wall: ['wallType', 'refLine', 'baseHeight', 'topHeight'],",
    with: "    wall: ['wallType', 'refLine', 'baseHeight', 'topHeight', 'start', 'end'],",
    test: 'a second wall takes the first one-s properties and does not move' },

  { file: 'MODEL.html',
    name: 'ANY KIND TAKES ANY KIND: a wall-s properties land on a line',
    find: '    if (kind === brushLoad.kind) { brushDust(hit); return; }',
    with: '    if (BRUSH_PROPS[kind]) { brushDust(hit); return; }',
    test: 'a wall-s properties will not land on a line' },

  { file: 'MODEL.html',
    name: 'THE FIT IS NOT ASKED: a 16 ft door lands in a 4 ft bay and nothing draws it',
    find: '      if (!fit || Math.abs(fit.offset - (Number(item.offset) || 0)) > 1e-6) {',
    with: '      if (false) {',
    test: 'and onto one in a bay too short it says TOO BIG and changes nothing' },

  { file: 'MODEL.html',
    // AIMED AT WALL e, NOT AT THE 4 FT ONE. On a wall too short to carry the
    // door at all, clampOpeningToWall returns null and `!fit` refuses on its
    // own -- so this mutant survived until the fixture grew a wall that CAN
    // carry it, just not there.
    name: 'REFUSED BECOMES SLID: the dusted opening moves along to make room',
    find: '      if (!fit || Math.abs(fit.offset - (Number(item.offset) || 0)) > 1e-6) {',
    with: '      if (!fit) {',
    test: 'and it refuses rather than sliding the opening it was aimed at' },

  { file: 'MODEL.html',
    name: 'A BARE WALL GETS NOTHING: the brush can only ever repaint',
    find: "    if (brushLoad.kind === 'fenestration' && kind === 'wall') {",
    with: '    if (false) {',
    test: 'a loaded opening on bare wall puts a new one there' },

  { file: 'MODEL.html',
    name: 'THE PLACED ONE IS THE TOOL-S, not the brush-s: same door, wrong properties',
    find: "    const dusting = brushHas('fenestration') ? brushLoad.props : null;",
    with: '    const dusting = null;',
    test: 'a loaded opening on bare wall puts a new one there' },

  { file: 'MODEL.html',
    name: 'THE LOAD DIES WITH THE TOOL CHANGE, so WALL draws the stored default',
    find: "    if (next !== RESTING_TOOL) brushOn = false;",
    with: "    if (next !== RESTING_TOOL) { brushOn = false; brushLoad = null; }",
    test: 'arming WALL puts the brush-s press down and keeps what it holds' },

  { file: 'MODEL.html',
    name: 'THE DRAWN WALL IGNORES THE BRUSH: the load is held and never spent',
    find: "    const wall = commitWall(drawStart, end, brushOptions('wall'));\n    // CHAINING",
    with: '    const wall = commitWall(drawStart, end);\n    // CHAINING',
    test: 'arming WALL puts the brush-s press down and keeps what it holds' },

  { file: 'MODEL.html',
    name: 'THE BRUSH KEEPS TAKING PRESSES under an armed WALL, so nothing can be drawn',
    find: "    if (next !== RESTING_TOOL) brushOn = false;",
    with: '    void next;',
    test: 'arming WALL puts the brush-s press down and keeps what it holds' },

  { file: 'MODEL.html',
    name: 'ESCAPE DROPS THE TOOL TOO, so there is no way to put the load down alone',
    find: '      if (brushLoad) { brushDrop(); return; }',
    with: '      if (brushLoad) { brushDrop(); brushOn = false; stripRefresh(); return; }',
    test: 'Escape puts the load down and leaves the brush up' },

  { file: 'MODEL.html',
    name: 'ESCAPE DOES NOT REACH THE BRUSH: the load cannot be put down at all',
    find: '      if (brushLoad) { brushDrop(); return; }',
    with: '      void brushLoad;',
    test: 'Escape puts the load down and leaves the brush up' },

  { file: 'MODEL.html',
    name: 'UNDO ASSIGNS ONLY: a window that was dusted stays an overhead door',
    find: '          Object.keys(item).forEach(key => {\n            if (!(key in before)) delete item[key];\n          });',
    with: '          /* mutant */',
    test: 'a key the brush added is removed by the undo, not left standing' },

  { file: 'MODEL.html',
    name: 'A DUST IS NOT UNDOABLE: ten presses and no way back',
    find: '    undoStack.push(brushUndoStep([item]));',
    with: '    void brushUndoStep;',
    test: 'one Ctrl+Z puts a dusted wall back' },

  { file: 'MODEL.html',
    name: 'THE FOOT TILE IS THE OLD SCALE TRIANGLE AGAIN',
    find: '        <rect x="1.5" y="1.5" width="13" height="13" rx="1"></rect>\n        <path d="M6.6 4.8 V11.2" stroke-width="1.2"></path>',
    with: '        <path d="M2 11 L8 4 L14 11 Z"></path>\n        <path d="M6.6 4.8 V11.2" stroke-width="1.2"></path>',
    test: 'the foot switch is a square tile with a 1 in it' },

  { file: 'MODEL.html',
    name: 'THE CHIP LIGHTS WHEN ARMED, not when loaded -- it stops saying what it will do',
    find: "    brushChip.classList.toggle('lit', !!brushLoad);",
    with: "    brushChip.classList.toggle('lit', brushOn);",
    test: 'Escape puts the load down and leaves the brush up' },
];

const run = grep => {
  try {
    execSync(`npx playwright test ${SPEC}`
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
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
