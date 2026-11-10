#!/usr/bin/env node
// MUTATION GATE for the schedules and the wall section on LAYOUT
// (tests/schedules-wall-section.spec.js).
//
// jb, 9 Nov: "Window and door schedules and a wall section cut in the base
// set", "will you put the window schedules in the ESTIMATES section? ... and
// doors", "so the wall section is basically taken from the PROJECT
// information right". The pure rows and the section's numbers are gated in
// node by proto/schedules-harness.js --mutate; what is here is the PAGE
// side -- the deal, the add menu, the frame, the titleblock, the reader,
// the painter and the ESTIMATES row -- which has no engine harness.
//
// Run: node proto/schedules-wall-section-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/schedules-wall-section.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'the WALL SECTION sheet is not dealt',
    find: '    if (this._wallSection()) {\n      deal(\'WALL SECTION\'',
    with: '    if (false) {\n      deal(\'WALL SECTION\'',
    test: 'the deal puts a WALL SECTION sheet' },
  { file: 'LAYOUT.html',
    name: "the three details take the sheet's rung, not their own",
    find: '          const own = Math.min(...details.map(view => this._detailPif(view, share)));',
    with: '          const own = pif;',
    test: 'the deal puts a WALL SECTION sheet' },
  { file: 'LAYOUT.html',
    name: "a dealt schedule takes the sheet's scale",
    find: "          viewports.push({ ...base, kind: 'schedule', table: view.table, pif: SCHEDULE_PIF });",
    with: "          viewports.push({ ...base, kind: 'schedule', table: view.table, pif: 1 / 4 });",
    test: 'the deal puts a WALL SECTION sheet' },
  { file: 'LAYOUT.html',
    name: 'a sheet of schedules reads AS NOTED on the titleblock',
    find: "      : (pifs.length ? 'AS NOTED' : (sheetViewports.length ? 'NTS' : ''));",
    with: "      : (pifs.length ? 'AS NOTED' : (sheetViewports.length ? 'AS NOTED' : ''));",
    test: 'a schedule prints its rows' },
  { file: 'LAYOUT.html',
    name: 'the add menu leaves the details out',
    find: "      ['SCHEDULES', schedules], ['DETAILS', details]]",
    with: "      ['SCHEDULES', schedules]]",
    test: 'ADD VIEWPORT offers the schedules' },
  { file: 'LAYOUT.html',
    name: "a placed schedule's frame follows the sheet's ladder instead of the table",
    find: "    if (isSchedule(view)) return SCHEDULE_PIF;\n    if (isDetail(view)) return this._detailPif(view);",
    with: "    if (isDetail(view)) return this._detailPif(view);",
    test: 'ADD VIEWPORT offers the schedules' },
  { file: 'drawing-format.js',
    name: 'the layout reader drops a schedule on reload',
    find: "      if (kind === 'schedule') {\n        const table = oneOf(viewport?.table, LAYOUT_SCHEDULE_TABLES, null);",
    with: "      if (false) {\n        const table = oneOf(viewport?.table, LAYOUT_SCHEDULE_TABLES, null);",
    test: 'survives a reload' },
  { file: 'drawing-format.js',
    name: 'the layout reader drops every detail on reload',
    find: "      if (kind === 'detail') {\n        const detail = oneOf(viewport?.detail, LAYOUT_DETAIL_IDS, null);",
    with: "      if (false) {\n        const detail = oneOf(viewport?.detail, LAYOUT_DETAIL_IDS, null);",
    test: 'survives a reload' },
  { file: 'wall-section.js',
    name: 'the detail painter puts no ink down',
    find: '    const X = x => box.x + (x - win.minX) * pxPerFt;',
    with: '    return; const X = x => box.x + (x - win.minX) * pxPerFt;',
    test: 'has ink in every one of its four windows' },
  { file: 'ESTIMATES.html',
    name: 'the estimate row loses its mark',
    find: '          item.innerHTML = `${row.mark ? `<span class="mark" data-mark>${row.mark}</span>` : \'\'}${row.label}',
    with: '          item.innerHTML = `${row.label}',
    test: 'a schedule prints its rows' },
  { file: 'estimates.js',
    name: "the estimate's door rows carry no mark",
    find: "      key: g.key, mark: g.mark, unit: 'EA', qty: g.count, waste: 0, net: g.count,\n      label: g.garage",
    with: "      key: g.key, unit: 'EA', qty: g.count, waste: 0, net: g.count,\n      label: g.garage",
    test: 'a schedule prints its rows' },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4367' } });
    return 'passed';
  } catch { return 'failed'; }
};

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
console.log(`\n${killed}/${ran} mutants killed${ambiguous ? `, ${ambiguous} ambiguous` : ''}`);
process.exit(killed === ran && !ambiguous ? 0 : 1);
