#!/usr/bin/env node
// MUTATION GATE for the plan sheets on LAYOUT (tests/layout-plan-sheets.spec.js).
//
// Movie, 16 Oct: "on every PLAN-view sheet (site, roof, floor, foundation)
// the viewport frame takes the largest area inside the border lines, the
// title centred near the bottom line. The drawing's scale stays as it is";
// "SITE PLAN: north arrow ON by default, up in the top-right corner area";
// and on the site plan's scale, "when the lots are larger i may have
// problems". LAYOUT.html's composer is page code with no engine harness, so
// every row here is the page's.
//
// Run: node proto/layout-plan-sheets-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-plan-sheets.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: "a plan's window is its natural frame again, not the sheet",
    find: '          commit(views[0], xIn, yIn, crop);',
    with: '          commit(views[0], xIn, yIn);',
    test: 'every plan sheet' },
  { file: 'LAYOUT.html',
    name: 'the window is grown to the border line, over the caption',
    find: '            b: natural.yIn + natural.hIn - (region.y + region.h - COMPOSE_LABEL_IN),',
    with: '            b: natural.yIn + natural.hIn - (region.y + region.h),',
    test: 'every plan sheet' },
  { file: 'LAYOUT.html',
    name: "the site plan walks the architect's ladder again",
    find: "const scaleFamilyFor = view => (isSiteView(view) ? 'site' : 'architect');",
    with: "const scaleFamilyFor = view => 'architect';",
    test: 'the site plan' },
  { file: 'LAYOUT.html',
    name: "the site rungs are 1\" = 120' and up again",
    find: 'const SITE_SCALE_PREFS = [1 / 10, 1 / 20, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80,',
    with: 'const SITE_SCALE_PREFS = [1 / 120, 1 / 240, 1 / 360, 1 / 480, 1 / 50, 1 / 60, 1 / 80,',
    test: 'the site plan' },
  { file: 'LAYOUT.html',
    name: 'the site plan waits for the toggle like any other sheet',
    find: '      northArrow: this.state.northArrow || this._sheetViewports(sheet).some(isSiteView),',
    with: '      northArrow: this.state.northArrow,',
    test: 'the site plan sheet flies' },
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

const dirty = execSync('git status --porcelain LAYOUT.html', { cwd: ROOT }).toString().trim();
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
