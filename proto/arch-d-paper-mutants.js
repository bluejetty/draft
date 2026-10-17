#!/usr/bin/env node
// MUTATION GATE for the D sheets on the CONSTRUCTION LAYOUT
// (tests/layout-arch-d.spec.js).
//
// Movie, 17 Oct: "11X17 won't be big enough, i think they are 22X 34 or
// something??" -- 24 x 36 (ARCH D, his North Point set) and 22 x 34 (ANSI
// D). Three seams: the layout's size table, the file format's key list,
// and the titleblock's set for the sheet. The titleblock's own engine
// (proto/titleblock-harness.js --mutate) holds the frames' widths.
//
// Run: node proto/arch-d-paper-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-arch-d.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'the layout never offers 24 x 36',
    find: "  '24x36': { label: '24 × 36  (ARCH D)', w: 24, h: 36 },\n",
    with: '',
    test: '24 x 36 is offered, the sheet takes it and reads it back, and the frames move to the D set' },
  { file: 'drawing-format.js',
    name: 'the file forgets a D sheet on reload',
    find: "  const LAYOUT_PAPER_KEYS = ['11x17', '8.5x11', '24x36', '22x34'];",
    with: "  const LAYOUT_PAPER_KEYS = ['11x17', '8.5x11'];",
    test: '24 x 36 is offered, the sheet takes it and reads it back, and the frames move to the D set' },
  { file: 'titleblock.js',
    name: 'a D sheet wears the ledger titleblock',
    find: "    ...[['03', '24x36'], ['04', '22x34']].flatMap(([n, paper]) => [",
    with: "    ...[].flatMap(([n, paper]) => [",
    test: '24 x 36 is offered, the sheet takes it and reads it back, and the frames move to the D set' },
  { file: 'LAYOUT.html',
    name: 'the layout never offers 22 x 34',
    find: "  '22x34': { label: '22 × 34  (ANSI D)', w: 22, h: 34 },\n",
    with: '',
    test: '22 x 34 is the other D sheet, and portrait turns it up' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4461' } });
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
