// DOES THE SPEC CATCH A SNAPSHOT THAT BECOMES THE WRONG DETAIL?
//
// jb, 20 Nov 2026: "have it pop up in the DETAIL area as a new detail" --
// "copies the lines over so they can be edited and new details added too".
//
// The camera's own gate (detail-snapshot-camera-mutants.js) covers what is
// filed. This one covers what is made of it: a detail whose lines are a
// twelfth of their size or twelve times it, upside down, in the wrong
// detail, in a frame that is not the box, behind a board where they cannot
// be seen -- and a tray that does not say what is in it. Every one of those
// still makes a detail and still says so on the strip.
//
// THE TABLE IS PLAIN DATA: proto/mutant-anchors-harness.js reads it without
// running this file.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED
// when the spec fails, so a spec that is already red kills everything.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/detail-snapshot-pickup.spec.js';

const MUTANTS = [
  { file: 'model/21-details-library.js',
    name: 'the picture\'s inches are read as feet: a two foot line comes in twenty-four feet long',
    find: '    const toWorld = ([x, y]) => ({ x: x / 12, z: -y / 12 });',
    with: '    const toWorld = ([x, y]) => ({ x, z: -y });',
    test: 'USE makes a detail of it' },

  { file: 'model/21-details-library.js',
    name: 'the detail is upside down: the picture runs y up, the sheet z down, and nothing turned it over',
    find: '    const toWorld = ([x, y]) => ({ x: x / 12, z: -y / 12 });',
    with: '    const toWorld = ([x, y]) => ({ x: x / 12, z: y / 12 });',
    test: 'USE makes a detail of it' },

  { file: 'model/21-details-library.js',
    name: 'the frame is left at the default 4 x 4, so most of an 8 x 6 picture is outside what prints',
    find: '      frameW: frameOver(rec.widthFt), frameH: frameOver(rec.heightFt),\n',
    with: '',
    test: 'USE makes a detail of it' },

  { file: 'model/21-details-library.js',
    name: 'the frame is rounded DOWN to the quarter inch: the line that ran to the edge of the box is outside it',
    find: '  const frameOver = ft => Math.ceil(Number(ft) * 48 - 1e-6) / 48;',
    with: '  const frameOver = ft => Math.floor(Number(ft) * 48) / 48;',
    test: 'end to end' },

  { file: 'model/21-details-library.js',
    name: 'the lines go into the FIRST detail, not the new one',
    find: "      levelId, view: lineView,\n      layer: 'SNAPSHOT',",
    with: "      levelId: -1, view: lineView,\n      layer: 'SNAPSHOT',",
    test: 'USE makes a detail of it' },

  { file: 'model/21-details-library.js',
    name: 'the picture\'s words are dropped',
    find: '    lettered.forEach(note => drawing.notes.push(note));\n    undoStack.push({ kind: \'built\', walls: [], outlines: [], list: null, openings: [],\n      items: [...made.map(',
    with: '    undoStack.push({ kind: \'built\', walls: [], outlines: [], list: null, openings: [],\n      items: [...made.map(',
    test: 'USE makes a detail of it' },

  { file: 'model/21-details-library.js',
    name: 'a three inch word is lettered three FEET high',
    find: '        heightFt: t.h / 12, rot: Number(t.rot) || 0,',
    with: '        heightFt: t.h, rot: Number(t.rot) || 0,',
    test: 'USE makes a detail of it' },

  { file: 'model/21-details-library.js',
    name: 'the new detail is made behind the board, where it cannot be seen or drawn on',
    find: '    closeDetailsBoard();\n    buildChrome();\n    fit(false, 0.8);',
    with: '    buildChrome();\n    fit(false, 0.8);',
    test: 'USE makes a detail of it' },

  { file: 'model/21-details-library.js',
    name: 'bringing the lines in is not on the undo stack: UNDO skips past them and takes the detail before',
    find: "    undoStack.push({ kind: 'built', walls: [], outlines: [], list: null, openings: [],\n      items: [...made.map(item => ({ list: drawing.lines, item })),\n        ...lettered.map(item => ({ list: drawing.notes, item }))] });\n    snapshotTrayOpen = false;",
    with: '    snapshotTrayOpen = false;',
    test: 'the lines are his to edit' },

  { file: 'model/21-details-library.js',
    name: 'a second detail from the same picture takes the first one\'s name',
    find: '    if (!taken.has(base.toUpperCase())) return base;\n    let n = 2;',
    with: '    if (taken) return base;\n    let n = 2;',
    test: 'the picture stays in the tray' },

  { file: 'model/21-details-library.js',
    name: 'X takes the picture off the list and leaves it in the store, to come back on the next load',
    find: "          try { await DS.remove(rec.id); } catch (error) { console.warn('draft: snapshot not removed', error); }",
    with: "          try { await DS.list(); } catch (error) { console.warn('draft: snapshot not removed', error); }",
    test: 'the picture stays in the tray' },

  { file: 'model/21-details-library.js',
    name: 'the key does not say how many are waiting',
    find: '      textContent: `SNAPSHOTS (${snapshotTray.length})`,',
    with: "      textContent: 'SNAPSHOTS',",
    test: 'the pane says what is waiting' },

  { file: 'model/21-details-library.js',
    name: 'the oldest picture is on top: the one he just took is at the bottom of two dozen',
    find: '    [...snapshotTray].reverse().forEach(rec => {',
    with: '    [...snapshotTray].forEach(rec => {',
    test: 'the pane says what is waiting' },

  { file: 'model/21-details-library.js',
    name: 'the chips are blank: three snapshots of S1 cannot be told apart',
    find: '      requestAnimationFrame(() => paintSnapshotThumb(thumb, rec));',
    with: '      requestAnimationFrame(() => {});',
    test: 'the pane says what is waiting' },

  { file: 'model/21-details-library.js',
    name: 'the chip draws the picture a tenth its size, a speck in the corner of the chip',
    find: '    const k = Math.min((cw - 4) / W, (ch - 4) / H);',
    with: '    const k = Math.min((cw - 4) / W, (ch - 4) / H) / 10;',
    test: 'the pane says what is waiting' },

  { file: 'model/21-details-library.js',
    name: 'the library never hears of a picture taken in another tab: it shows only what was there when it loaded',
    find: '    window.SharedFileStore.onBucketChanged(DS.BUCKET, refresh);',
    with: '    void refresh;',
    test: 'a picture taken in another tab arrives' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'the camera does not say where the picture goes next',
    find: 'In the snapshot tray (${tray.length}) — SNAPSHOTS in a DETAILS LIBRARY makes a detail of it. Box another, or ESC.`);',
    with: 'In the snapshot tray (${tray.length}). Box another, or ESC.`);',
    test: 'end to end' },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4394' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it.
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
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
  // UNIQUE OR NOT AT ALL: an anchor that matches twice mutates the first
  // match, which may not be the call site the mutant is named for.
  if (before.split(m.find).length !== 2) {
    console.log(`  SKIPPED   ${m.name}  (anchor ${before.includes(m.find) ? 'matches more than once' : 'not found'} — re-aim \`find\`)`);
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

// READ AGAINST WHAT WAS DEFINED, never on its own.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
