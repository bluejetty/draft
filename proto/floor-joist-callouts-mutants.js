#!/usr/bin/env node
// MUTATION GATE for the joist callouts and the footprint on every plan page
// (tests/floor-joist-callouts.spec.js).
//
// Movie, 16 Oct, marked up on the 2ND FL FLOOR LAYOUT: an arrowed span line
// perpendicular to the beam in every bay, the short form beside it, in
// place of the three-line OWJ note; a faded footprint on every PLAN-view
// page, the same scale page to page. The engines' rows are in
// proto/mid-span-beam-harness.js, proto/render-2d-harness.js and
// proto/layout-plan-harness.js; these are the pages' links.
//
// Run: node proto/floor-joist-callouts-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/floor-joist-callouts.spec.js';

const MUTANTS = [
  { file: 'model/01-skin-view.js',
    name: 'MODEL never paints the callouts on its floor view',
    find: '    paintJoistCallouts(belowBeams, env);\n',
    with: '',
    test: 'the deck is called out in every bay, on MODEL and on the 2ND FLOOR sheet' },
  { file: 'layout-plan.js',
    name: 'the floor sheet is handed no callouts',
    find: '        ? joistCalloutsFor(saved, levelId, under) : []),',
    with: '        ? [] : []),',
    test: 'the deck is called out in every bay, on MODEL and on the 2ND FLOOR sheet' },
  { file: 'plan-composition.js',
    name: 'the composer is handed the callouts and paints none',
    find: "        env.joistCallouts.forEach(callout => { onLayer(ctx, 'S-BEAM'); render.drawJoistSpans2D(ctx, toS, callout, {}, env.structureEnv); });",
    with: '        void 0;',
    test: 'the deck is called out in every bay, on MODEL and on the 2ND FLOOR sheet' },
  { file: 'LAYOUT.html',
    name: 'each plan sheet picks its own scale again',
    find: '        : buildingPlan(views) && Number.isFinite(sharedPif) ? sharedPif : this._autoScaleFor(views, region);',
    with: '        : this._autoScaleFor(views, region);',
    test: 'every plan page carries the faded footprint, and the building\'s plan sheets share one scale' },
  { file: 'layout-plan.js',
    name: 'the footprint is not ghosted',
    find: 'return [...floorBelowLoops(saved, levelId), ...footprintLoops(saved)].filter(points => {',
    with: 'return [...floorBelowLoops(saved, levelId)].filter(points => {',
    test: 'every plan page carries the faded footprint, and the building\'s plan sheets share one scale' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4364' } });
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
