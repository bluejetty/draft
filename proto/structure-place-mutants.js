// DOES THE PLACEMENT SPEC CATCH A PLACEMENT THAT LOSES THE WORK?
//
// The gate for tests/model-structure-place.spec.js. Same two hardenings as the
// six before it: an ambiguous anchor is refused rather than guessed at, and a
// survivor is re-run against the whole spec before it is called one.
//
// EVERY MUTANT HERE IS A WAY TO WRITE A RECORD THE READER THROWS AWAY. That is
// the shape of this feature's failure: not a crash, not a blank canvas, but a
// column that is on screen, in the save file, and gone one reload later, with
// no error at either end. Mutant 1 is the bug that was actually waiting --
// newDrawingItemId returns "column-7" and drawing-format.js:512 reads the id
// with Number(). It was found by measurement before the gesture was written,
// which is the only reason it is a mutant here instead of a defect in main.
const { execSync } = require('child_process');
const fs = require('fs');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE BUG THAT WAS WAITING: the page allocator, whose ids are strings',
    find: '      id: newStructureId(drawing.columns),',
    with: "      id: newDrawingItemId('column'),",
    test: 'a placed column survives save and reload' },
  { file: 'MODEL.html',
    name: 'the beam takes a string id too',
    find: '      id: newStructureId(drawing.beams),',
    with: "      id: newDrawingItemId('beam'),",
    test: 'a placed beam survives save and reload' },
  { file: 'MODEL.html',
    name: 'the allocator never rises, so every column after the first is dropped',
    find: '      if (Number.isInteger(n) && n > max) max = n;',
    with: '',
    test: 'two columns get two ids' },
  { file: 'MODEL.html',
    name: 'a zero-length beam is written, and vanishes on load',
    find: '    if (Math.hypot(end.x - beamStart.x, end.z - beamStart.z) < 0.001) {\n      beamStart = end; paint(); return null;\n    }',
    with: '',
    test: 'a beam of no length is not written at all' },
  { file: 'MODEL.html',
    name: 'structure undo rides the wall step, and silently spends it',
    find: "    undoStack.push({ kind: 'add-item', list, item });",
    with: "    undoStack.push({ kind: 'add', item });",
    test: 'undo takes back a placed column' },
  { file: 'MODEL.html',
    name: 'the footing is written off the format\'s list',
    find: "      footing: 'pad36',",
    with: "      footing: 'pad',",
    test: 'placing a column opens its properties' },
  { file: 'MODEL.html',
    name: 'a pile keeps a pad size the reader will drop',
    find: "        if (id.startsWith('pile')) delete item.padIn;",
    with: '        if (id.startsWith(\'pile\')) item.padIn = 36;',
    test: 'placing a column opens its properties' },
  { file: 'MODEL.html',
    name: 'the beam mode is not written, so the panel and the file disagree',
    find: "      mode: 'flush',",
    with: '',
    test: 'placing a beam shows its mode and its span' },
  { file: 'MODEL.html',
    name: 'the readout stops counting columns',
    find: '      + `columns <b>${shownOfTotal(columns().length, drawing.columns)}</b>   `',
    with: '',
    test: 'the readout counts columns and beams' },
  { file: 'MODEL.html',
    name: 'placement stops selecting what it placed, so the panel never opens',
    find: '  const selectPlaced = (type, item) => {\n    setSelection([{ type, item }]);\n    return item;\n  };',
    with: '  const selectPlaced = (type, item) => item;',
    test: 'placing a column opens its properties' },
  { file: 'MODEL.html',
    name: 'putting a tool down leaves the beam anchor, so BEAM finishes under COLUMN',
    find: '    drawStart = null;\n    beamStart = null;',
    with: '    drawStart = null;',
    // RE-AIMED. This pointed at the round trip, which never changes tools with
    // a beam half made -- so the mutant died somewhere else and the gate said
    // so. A kill credited to the wrong check reads exactly like a clean sheet.
    test: 'abandons a half-made beam' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-structure-place.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: '/home/user/draft' }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `/home/user/draft/${m.file}`;
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
  execSync(`git checkout -- ${m.file}`, { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
