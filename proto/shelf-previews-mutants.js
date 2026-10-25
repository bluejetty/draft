#!/usr/bin/env node
// MUTATION GATE for the shelf previews above the bone, the SHELVES tab and
// the fit on entering a shelf (Movie, 23 Oct). Each row breaks one line, runs
// the one test that should notice, and restores the file from HEAD.
//
//   node proto/shelf-previews-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shelf-previews.spec.js';

const MUTANTS = [
  { file: 'model.css',
    name: 'the row stands off the axis',
    find: "  #shelf-strip { position:absolute; left:0; bottom:calc(100% - 14px); transform:translateX(-50%);\n",
    with: "  #shelf-strip { position:absolute; left:0; bottom:calc(100% - 14px); transform:none;\n",
    test: 'the row centred above the bone' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'the squares are never painted',
    find: "    strip.querySelectorAll('.shelf-preview').forEach(square => {\n      const screen = square.querySelector('canvas');\n",
    with: "    [].forEach(square => {\n      const screen = square.querySelector('canvas');\n",
    test: 'the suite drawn in its square' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'a press on a square enters nothing',
    find: "      square.addEventListener('click', () => enterShelf(Number(shelf.id)));\n",
    with: "",
    test: 'a press on a square enters that shelf' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'entering a shelf keeps the view where it was',
    find: "    goToBoneyard(shelfId);\n    fit(false, SHELF_FIT_MARGIN);\n",
    with: "    goToBoneyard(shelfId);\n",
    test: 'a press on a square enters that shelf' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'the tab forgets on a reload',
    find: "        keepLight('shelfStrip', shelfStripOpen);\n",
    with: "",
    test: 'a reload remembers' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'a new shelf gets no square',
    find: "    if (saveAsButton) saveAsButton.disabled = !drawing;\n    buildShelfStrip();\n",
    with: "    if (saveAsButton) saveAsButton.disabled = !drawing;\n    if (!shelfStrip()) buildShelfStrip();\n",
    test: 'SHELF adds a square' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4538' } });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`, { cwd: ROOT }).toString().trim();
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
