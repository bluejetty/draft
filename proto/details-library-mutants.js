#!/usr/bin/env node
// MUTATION GATE for the DETAILS LIBRARY (tests/details-library.spec.js).
//
// jb, 19 Nov 2026: "a 'special file' like the site plan it will only contain
// the DETAIL DRAWINGS ... id like to draw each detail in a seperate 'SHELF'
// ... it won't need all the LEVELS / LAYERS".
//
// Defects that still render: a tile that does not mark the file, a library
// that opens on a level, a panel that goes on listing levels, a rail that
// seats the house, BUILD keys left up or their letters armed, a card that
// does not reach the file or forgets its undo, a + DETAIL with no card, a
// SAVE DETAIL that never keeps the library copy, a frame the fit ignores;
// and on the board: a library that does not open on it, thumbnails of
// nothing or of the wrong detail, filters that do not filter, a drag that
// lands on the wrong side or cannot be undone, a DELETE that does not ask.
//
// Run: node proto/details-library-mutants.js
//      (refuses a dirty tree on the mutated files; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/details-library.spec.js';

const MUTANTS = [
  { file: 'drawing-format.js',
    name: "'details' is a standalone kind the format keeps",
    find: "const STANDALONE_KINDS = Object.freeze(['site', 'classic', 'details']);",
    with: "const STANDALONE_KINDS = Object.freeze(['site', 'classic']);",
    test: 'opens in its detail' },
  { file: 'drawing-format.js',
    name: 'a shelf keeps its detail card through the reader',
    find: "        ...(shelf?.detail && typeof shelf.detail === 'object' ? { detail: detailCard(shelf.detail) } : {}) };",
    with: "      };",
    test: 'the card reaches the file' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the press stands the drafter in DETAIL 1',
    find: "    if (want === 'details') { if (typeof startDetailsLibrary === 'function') startDetailsLibrary(); return; }",
    with: "",
    test: 'the press builds nothing' },
  { file: 'model/17-boot-save.js',
    name: 'a details file opens in its detail, not on a level',
    find: "    if (drawing.standalone === 'details') boneyardActive = true;",
    with: "",
    test: 'opens in its detail' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'a level asked for on a details file lands back in the detail',
    find: "    if (drawing?.standalone === 'details') { goToBoneyard(); return; }",
    with: "",
    test: 'opens in its detail' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'the LEVELS pane lists the details, not the levels',
    find: "if (drawing?.standalone === 'details' && typeof buildDetailsPanel === 'function') { buildDetailsPanel(levelsPanel); return; }",
    with: "",
    test: 'nothing of a house is offered' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'the view rail seats nothing on a details file',
    find: "    if (drawing?.standalone === 'details') return [];",
    with: "",
    test: 'nothing of a house is offered' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the house doors are greyed on a details file',
    find: "    const locked = siteOnly() || detailsFile();",
    with: "    const locked = siteOnly();",
    test: 'nothing of a house is offered' },
  { file: 'model/21-details-library.js',
    name: 'the BUILD keys are refused in a details file',
    find: "    return window.DraftToolRoster?.get?.(id)?.group === 'build';",
    with: "    return false;",
    test: 'nothing of a house is offered' },
  { file: 'model/14-promotion-tools.js',
    name: 'a refused key\'s letter arms nothing',
    find: "    if (typeof detailsToolRefused === 'function' && detailsToolRefused(id)) {",
    with: "    if (false) {",
    test: 'nothing of a house is offered' },
  { file: 'model/21-details-library.js',
    name: 'a card edit is one UNDO',
    find: "    undoStack.push({ kind: 'props', edits: [{ item: shelf, before }] });",
    with: "",
    test: 'each edit is one UNDO' },
  { file: 'model/21-details-library.js',
    name: 'the frame is typed in feet and inches',
    find: "        writeCard({ [key]: read.inches / 12 });",
    with: "        writeCard({ [key]: read.inches });",
    test: 'the card reaches the file' },
  { file: 'model/21-details-library.js',
    name: 'a new detail takes the category and scale of the one before it',
    find: "      ? { category: from.category, scale: from.scale } : {});",
    with: "      ? {} : {});",
    test: '+ DETAIL makes another' },
  { file: 'model/21-details-library.js',
    name: 'SAVE DETAIL keeps the library copy in this browser',
    find: "      const name = await storeLibrary();",
    with: "      const name = 'nowhere';",
    test: 'SAVE DETAIL saves the drawing' },
  { file: 'model/21-details-library.js',
    name: 'the first detail is named and carded',
    find: "      ...(isUnnamedShelf(shelf) ? { name: `DETAIL ${shelf.id}` } : {}),",
    with: "",
    test: 'the press builds nothing' },
  { file: 'build-menu.js',
    name: 'the tile is a standalone press',
    find: "label: 'DRAW DETAILS LIBRARY', standalone: 'details',",
    with: "label: 'DRAW DETAILS LIBRARY',",
    test: 'the press builds nothing' },
  // ── THE DETAILS BOARD (step 3) ──
  { file: 'model/21-details-library.js',
    name: 'a library opens on its board',
    find: "    boardOpen = isDetailsFile();",
    with: "    boardOpen = false;",
    test: 'opens on its board' },
  { file: 'model/21-details-library.js',
    name: 'a thumbnail is painted by the plan\'s painters',
    find: "      paintShapes(); paintLines(); paintNotes(); paintDimensions();",
    with: "",
    test: 'opens on its board' },
  { file: 'model/21-details-library.js',
    name: 'a thumbnail shows its own detail only',
    find: "      thumbTarget = { levelId: -Number(shelf.id), viewId: null };",
    with: "      thumbTarget = { levelId: -1, viewId: null };",
    test: 'opens on its board' },
  { file: 'model/21-details-library.js',
    name: 'the board stops short of the pane on the right',
    find: "      else if (r.left > mid) right = Math.min(right, r.left - 8);",
    with: "",
    test: 'opens on its board' },
  { file: 'model/21-details-library.js',
    name: 'a category on the rail filters the cards',
    find: "        && card.category !== boardView.category) return false;",
    with: "        && false) return false;",
    test: 'the board filters' },
  { file: 'model/21-details-library.js',
    name: 'TYP. / SPECIAL filters the cards',
    find: "      if (boardView.kind !== 'all' && card.kind !== boardView.kind) return false;",
    with: "",
    test: 'the board filters' },
  { file: 'model/21-details-library.js',
    name: 'search reads the tags, the note and the category',
    find: "      const words = [shelf.name, card.category, card.note, ...card.tags].join(' ').toLowerCase();",
    with: "      const words = [shelf.name].join(' ').toLowerCase();",
    test: 'the board filters' },
  { file: 'model/21-details-library.js',
    name: 'the star makes a favourite',
    find: "            writeCardOf(id, { favourite: !card.favourite });",
    with: "",
    test: 'the board filters' },
  { file: 'model/21-details-library.js',
    name: 'a dragged card lands before or after by the half it is dropped on',
    find: "          node.dataset.dropSide = event.clientX > r.left + r.width / 2 ? 'after' : 'before';",
    with: "          node.dataset.dropSide = 'after';",
    test: 'a card dragged onto another' },
  { file: 'model/21-details-library.js',
    name: 'a drag to sort is one UNDO',
    find: "    undoStack.push({ kind: 'reorder', lists: [{ list, before }] });",
    with: "",
    test: 'a card dragged onto another' },
  { file: 'model/21-details-library.js',
    name: 'cards drag into place under BY HAND only',
    find: "          if (boardView.sort !== 'hand') {",
    with: "          if (false) {",
    test: 'a card dragged onto another' },
  { file: 'model/21-details-library.js',
    name: 'DELETE asks twice',
    find: "        if (btn.dataset.armed !== undefined) {",
    with: "        if (true) {",
    test: 'right-click' },
  { file: 'model/21-details-library.js',
    name: '+ CATEGORY is kept in the file',
    find: "        drawing.detailCategories = [...(Array.isArray(drawing.detailCategories) ? drawing.detailCategories : []), name];",
    with: "",
    test: 'right-click' },
  { file: 'model/21-details-library.js',
    name: 'a card dropped on a category moves to it',
    find: "          if (shelf) writeCardOf(id, { category: c }, `${shelf.name} moved to ${c}.`);",
    with: "",
    test: 'right-click' },
  { file: 'model/21-details-library.js',
    name: '+ DETAIL on the board takes the category on view',
    find: "          if (c !== DB_ALL && c !== DB_FAVOURITES) writeCard({ category: c });",
    with: "",
    test: '+ DETAIL on the board' },
  { file: 'model/21-details-library.js',
    name: 'SAVE LIBRARY keeps the library copy',
    find: "      const stored = await storeLibrary();",
    with: "      const stored = 'nowhere';",
    test: 'SAVE LIBRARY on the board' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4371' } });
    return 'passed';
  } catch { return 'failed'; }
};

const files = [...new Set(MUTANTS.map(m => m.file))].join(' ');
const dirty = execSync(`git status --porcelain ${files}`, { cwd: ROOT }).toString().trim();
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
  const caught = result === 'failed';
  if (caught) killed += 1;
  console.log(`  ${caught ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS (anchor missing)` : ''));
process.exit(killed === MUTANTS.length ? 0 : 1);
