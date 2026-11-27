#!/usr/bin/env node
// MUTATION GATE for DETAILS ON LAYOUT SHEETS (tests/layout-library-details.spec.js),
// step 4 of jb's DETAILS library plan (19 Nov 2026).
//
// Defects that still render: a library detail the reader drops, a library
// copy that forgets it is one, a shelf with no card offered as a detail, a
// frame the wrong size, a detail at the working scale instead of its own,
// the wrong shelf painted, no bubble, a details file that offers levels,
// RELOAD FROM LIBRARY missing or doing nothing, CHANGE LIBRARY that keeps
// the old one linked, a library listed as a file from disk.
//
// Run: node proto/layout-library-details-mutants.js
//      (refuses a dirty tree on the mutated files; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-library-details.spec.js';

const MUTANTS = [
  { file: 'drawing-format.js',
    name: 'the reader keeps a library detail window',
    find: "['plan', 'section', 'elevation', 'schedule', 'detail', 'libdetail', 'view3d']",
    with: "['plan', 'section', 'elevation', 'schedule', 'detail', 'view3d']",
    test: 'own scale' },
  { file: 'drawing-format.js',
    name: 'a library copy remembers it came from the browser',
    find: "...(src?.library === true ? { library: true } : {}), drawing };",
    with: "drawing };",
    test: 'own scale' },
  { file: 'LAYOUT.html',
    name: 'only shelves with a card are details',
    find: "      .filter(shelf => shelf.detail)\n      .map(shelf => ({ shelf, card: format.detailCard(shelf.detail) }));",
    with: "      .map(shelf => ({ shelf, card: format.detailCard(shelf.detail) }));",
    test: 'links a library' },
  { file: 'LAYOUT.html',
    name: 'a detail is framed on its frame',
    find: "      return found ? { wFt: found.card.frameW, hFt: found.card.frameH } : null;",
    with: "      return found ? { wFt: found.card.frameW * 2, hFt: found.card.frameH } : null;",
    test: 'own scale' },
  { file: 'LAYOUT.html',
    name: 'a detail comes in at the scale it was drawn at',
    find: "    if (isLibDetail(view)) return this._libDetail(view)?.card.scale || 1;",
    with: "",
    test: 'own scale' },
  { file: 'LAYOUT.html',
    name: 'the detail\'s own shelf is painted',
    find: "        window.DraftLayoutPlan.drawLevelMarks(ctx, toS, this._saved, -found.shelf.id, {",
    with: "        window.DraftLayoutPlan.drawLevelMarks(ctx, toS, this._saved, found.shelf.id, {",
    test: 'own scale' },
  { file: 'LAYOUT.html',
    name: 'a detail wears its bubble on the desk',
    find: "      this._paintLibBubble(ctx, viewport, px, zoom, selected ? '#5980a6' : '#1d1f20');",
    with: "",
    test: 'own scale' },
  { file: 'LAYOUT.html',
    name: 'a details file offers its details',
    find: "    if (this._standalone === 'details') {",
    with: "    if (false) {",
    test: 'links a library' },
  { file: 'LAYOUT.html',
    name: 'the DETAILS LIBRARY section is on the menu',
    find: "    this._paintLibraryChoices(head, pick, press);",
    with: "",
    test: 'links a library' },
  { file: 'LAYOUT.html',
    name: 'a library is not listed as a file from disk',
    find: "    (this.state.sources || []).filter(other => !other.library).forEach(other => press(other.name,",
    with: "    (this.state.sources || []).forEach(other => press(other.name,",
    test: 'links a library' },
  { file: 'LAYOUT.html',
    name: 'RELOAD FROM LIBRARY is on a library detail\'s menu',
    find: "      ...(src && src.library ? [{ key: 'reload-from-library'",
    with: "      ...(false ? [{ key: 'reload-from-library'",
    test: 'own scale' },
  { file: 'LAYOUT.html',
    name: 'RELOAD FROM LIBRARY brings the newer copy in',
    find: "    this._reloadSource(id, { name: src.name, drawing });",
    with: "",
    test: 'RELOAD FROM LIBRARY' },
  { file: 'LAYOUT.html',
    name: 'the linked library is the last one picked',
    find: "    return libs.length ? libs[libs.length - 1] : null;",
    with: "    return libs.length ? libs[0] : null;",
    test: 'one library linked' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4372' } });
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
