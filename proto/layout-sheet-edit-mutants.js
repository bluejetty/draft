#!/usr/bin/env node
// MUTATION GATE for LAYOUT's sheet edits (Movie, 25 Oct): a press on the open
// sheet's name renames it everywhere, the X deletes a sheet (asking when it
// holds drawings), ADD VIEWPORT asks what and places it at a fitting rung,
// and a double press on the logo cell opens the picker / upload.
//
//   node proto/layout-sheet-edit-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-sheet-edit.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'a press on the open sheet\'s name only opens it',
    find: "    if (this.state.activeSheet === n && e.target.closest('[data-sheet-name]')) {",
    with: "    if (false) {",
    test: 'one name changes all three' },
  { file: 'LAYOUT.html',
    name: 'the rename is never kept',
    find: "    sheets[n - 1] = { ...sheets[n - 1], title };",
    with: "",
    test: 'one name changes all three' },
  { file: 'titleblock.js',
    name: 'the titleblock never says where its title is',
    find: "      info.onPageTitle({ x: x + w * 0.5, y: arrowB, w: w * 0.5, h: titleB - arrowB });",
    with: "",
    test: 'one name changes all three' },
  { file: 'LAYOUT.html',
    name: 'the X deletes the open sheet, not its own',
    find: "      this._removeSheet(n, true);",
    with: "      this._removeSheet(this.state.activeSheet, true);",
    test: 'the X takes a sheet off' },
  { file: 'LAYOUT.html',
    name: 'a sheet with drawings goes without asking',
    find: "    if (ask && held && !window.confirm(",
    with: "    if (false && !window.confirm(",
    test: 'the X takes a sheet off' },
  { file: 'LAYOUT.html',
    name: 'the X loses its accent',
    find: "    background-color: var(--accent); color: var(--accent-ink);\n    font: 700 11px/1",
    with: "    background-color: var(--surface-chip); color: var(--ink-primary);\n    font: 700 11px/1",
    test: 'the X wears the accent' },
  { file: 'LAYOUT.html',
    name: 'ADD VIEWPORT places the level plan whatever was picked',
    find: "    const view = picked || { kind: 'plan', levelId };",
    with: "    const view = { kind: 'plan', levelId };",
    test: 'ADD VIEWPORT asks what' },
  { file: 'LAYOUT.html',
    name: 'a picked view walks only the architect ladder',
    find: "      pif: picked ? this._pickedPif(view) : this._placementPif(view),",
    with: "      pif: SCALES[0].pif,",
    test: 'ADD VIEWPORT asks what' },
  { file: 'LAYOUT.html',
    name: 'the logo cell does not open the picker',
    find: "        this._openLogoPicker();\n        return;",
    with: "        return;",
    test: 'logo opens the picker' },
  { file: 'LAYOUT.html',
    name: 'an uploaded logo keeps its margin',
    find: "      const box = trimBox(c.getContext('2d'), c.width, c.height);",
    with: "      const box = { x: 0, y: 0, w: c.width, h: c.height };",
    test: 'logo opens the picker' },
  { file: 'logo-file.js',
    name: 'a PDF is read as a picture, which it is not',
    find: "  const toCanvas = (file, maxPx = 512) => (isPdf(file) ? fromPdf(file, maxPx) : fromImage(file, maxPx));",
    with: "  const toCanvas = (file, maxPx = 512) => fromImage(file, maxPx);",
    test: 'takes a PDF' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4618' } });
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
