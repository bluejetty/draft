#!/usr/bin/env node
// MUTATION GATE for DRAW STANDALONE SITE PLAN
// (tests/standalone-site-plan.spec.js).
//
// Movie, 6 Nov: "DRAW STANDALONE SITE PLAN ... put it like the RESIDENTIAL
// SUITES and COMMERCIAL SUITE - half size ... leave a spot below" -- "and
// then that plan will be only for the SITE PLAN layer - no other layers
// offered".
//
// Eleven defects that still render: a tile that orders instead of going, a
// press that goes but does not say so in the file, a panel and a rail that
// go on offering every level, a house order that leaves the mark on, a
// LAYOUT that deals the whole set or offers it under + ADD VIEWPORT, a
// CLASSIC DRAFTING that orders a house, one that writes no mark, one that
// leaves the house tiles live, and a panel that hides levels on it.
//
// Run: node proto/standalone-site-plan-mutants.js
//      (refuses a dirty tree on the mutated files; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/standalone-site-plan.spec.js';

const MUTANTS = [
  { file: 'build-menu.js',
    name: 'the tile is a standalone press, not a house order',
    find: "label: 'DRAW STANDALONE SITE PLAN', standalone: 'site' }),",
    with: "label: 'DRAW STANDALONE SITE PLAN' }),",
    test: 'the press drops the board' },
  { file: 'build-menu.js',
    name: 'CLASSIC DRAFTING is a free press, not a house order',
    find: "label: 'CLASSIC DRAFTING', free: true,",
    with: "label: 'CLASSIC DRAFTING',",
    test: 'CLASSIC DRAFTING drops the board' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'CLASSIC DRAFTING writes its mark on the file',
    find: "    if (drawing.standalone !== 'classic') { drawing.standalone = 'classic'; markDirty(); }",
    with: "    if (drawing.standalone) { delete drawing.standalone; markDirty(); }",
    test: 'CLASSIC DRAFTING drops the board' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the house tiles are locked on a classic sheet',
    find: "    if (!classicLocked() || entry?.free) return;",
    with: "    return;",
    test: 'CLASSIC DRAFTING drops the board' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'a classic sheet offers every level: the panel reads the site mark alone',
    find: "    if (standalone === 'site') return;",
    with: "    if (standalone) return;",
    test: 'CLASSIC DRAFTING drops the board' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the press writes the mark on the file',
    find: "    if (drawing.standalone !== want) { drawing.standalone = want; markDirty(); }",
    with: "",
    test: 'the press drops the board' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'a house ordered off the board takes the mark off',
    find: "    if (drawing?.standalone) { delete drawing.standalone; markDirty(); }",
    with: "",
    test: 'gives the levels back' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'the LEVELS panel stops at SITE on a standalone file',
    find: "    if (standalone === 'site') return;",
    with: "    if (standalone === 'never') return;",
    test: 'offers SITE PLAN and no other' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'the view rail seats the site plan alone',
    find: "    if (drawing?.standalone === 'site') return seats;",
    with: "    if (drawing?.standalone === 'never') return seats;",
    test: 'offers SITE PLAN and no other' },
  { file: 'LAYOUT.html',
    name: 'LAYOUT deals the SITE PLAN and leaves the rest of the set in the deck',
    find: "      if (this._standalone === 'site' && title !== 'SITE PLAN') return;",
    with: "",
    test: 'LAYOUT deals the SITE PLAN alone' },
  { file: 'LAYOUT.html',
    name: '+ ADD VIEWPORT offers the site plan and nothing else',
    find: "    const siteOnly = this._standalone === 'site';",
    with: "    const siteOnly = false;",
    test: 'LAYOUT deals the SITE PLAN alone' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4363' } });
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
