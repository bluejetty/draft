#!/usr/bin/env node
// MUTATION GATE for NORTH at the head of LAYOUT's sheet rail
// (tests/layout-north-in-rail.spec.js).
//
// Movie, 17 Oct, drawn in GIMP over CONSTRUCTION LAYOUT: "on construction
// layout move the North arrow up here". Each row below is one way the move
// could quietly come apart: the button not seated, the bar seating a second
// one, the sheets no longer fitting under it.
//
// Run: node proto/layout-north-in-rail-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-north-in-rail.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'the rail head is never filled: NORTH is nowhere on the page',
    find: "    document.querySelector('[data-sheet-rail-head]').innerHTML = window.DraftShellBars.toolMarkup('north');\n",
    with: '',
    test: 'NORTH stands at the head of the sheet rail, not in the bottom bar, and the sheets fit under it' },
  { file: 'LAYOUT.html',
    name: 'the bar seats NORTH too, so there are two of it',
    find: "<script>window.DraftShellBars.bottomBar({ page: 'construction' });</script>",
    with: "<script>window.DraftShellBars.bottomBar({ page: 'construction', tools: ['north'] });</script>",
    test: 'NORTH stands at the head of the sheet rail, not in the bottom bar, and the sheets fit under it' },
  // NO ROW FOR THE HEAD'S HEIGHT IN _sizeRail. At the rail's 172px the two
  // columns, not the rows, decide a thumbnail's size for any set the composer
  // deals, so taking the head's row off the top changes nothing a spec can
  // see until a set runs to nine rows or more. The subtraction stays, for
  // the day a set does; a row for it here would survive on the first run.
  { file: 'shell-bars.js',
    name: 'the bar hands out no markup for a tool',
    find: "    toolMarkup: name => BAR_TOOLS[name] || '',\n",
    with: "    toolMarkup: name => '',\n",
    test: 'NORTH stands at the head of the sheet rail, not in the bottom bar, and the sheets fit under it' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4413' } });
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
