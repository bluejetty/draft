#!/usr/bin/env node
// MUTATION GATE for the overhead convention on plan views
// (tests/overhead-convention.spec.js).
//
// Movie, 16 Oct (MAIN FL PLAN sheet 7): "anything above the cut is drawn
// lighter weight with a dash-dot line -- the beam in the floor system above
// (or dropped) on the floor it is over (columns already shown); upper
// kitchen cabinets ... Beams dash-dot; cantilevers, overhangs and uppers
// dashed." The painter's rows are proto/render-2d-harness.js's and the
// sheet's proto/layout-plan-harness.js's; these are the pages' seams and the
// catalogue's flag.
//
// Run: node proto/overhead-convention-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/overhead-convention.spec.js';
const MUTANTS = [
  { file: 'MODEL.html',
    name: 'MODEL never draws the beam above',
    find: '        paintBeamsAbove();\n',
    with: '',
    test: 'MODEL: the walls plan draws the beam over it dash-dot and the uppers dashed; the floor layout neither' },
  { file: 'MODEL.html',
    name: 'MODEL draws the beam above on the floor layout too',
    find: "    const onPlanView = activeViewId() === 'plan';",
    with: '    const onPlanView = true;',
    test: 'MODEL: the walls plan draws the beam over it dash-dot and the uppers dashed; the floor layout neither' },
  { file: 'MODEL.html',
    name: 'MODEL hangs no uppers',
    find: '      if (K && K.hasUppers(fixture) && R.drawUpperCabinets2D) R.drawUpperCabinets2D(ctx, toS, fixture, wall, env);\n',
    with: '',
    test: 'MODEL: the walls plan draws the beam over it dash-dot and the uppers dashed; the floor layout neither' },
  { file: 'fixture-kinds.js',
    name: 'the catalogue says no piece carries uppers',
    find: "kind.uppers === true",
    with: "kind.uppers === 'never'",
    test: 'MODEL: the walls plan draws the beam over it dash-dot and the uppers dashed; the floor layout neither' },
  { file: 'render-2d.js',
    name: 'the beam above is drawn solid',
    find: 'ctx.setLineDash(above ? [...OVERHEAD_DASH_DOT] : ',
    with: 'ctx.setLineDash(false ? [...OVERHEAD_DASH_DOT] : ',
    test: 'MODEL: the walls plan draws the beam over it dash-dot and the uppers dashed; the floor layout neither' },
  { file: 'layout-plan.js',
    name: 'the sheet borrows no beam above',
    find: "      beamsAbove: view === 'plan' && !halfLevel && !listing && !shell && !hologram",
    with: '      beamsAbove: false',
    test: 'LAYOUT: the dealt MAIN FL PLAN sheet draws the beam over it dash-dot and the uppers dashed; the MAIN FLOOR layout neither' },
  { file: 'plan-composition.js',
    name: 'the composition is handed the beams above and paints none',
    find: "      beamsOver.forEach(beam => { onLayer(ctx, beam.layer || 'S-BEAM'); render.drawBeam2D(ctx, toS, beam, { above: true, tag: overTags.get(beam.id) }, env.structureEnv); });\n",
    with: '',
    test: 'LAYOUT: the dealt MAIN FL PLAN sheet draws the beam over it dash-dot and the uppers dashed; the MAIN FLOOR layout neither' },
  { file: 'plan-composition.js',
    name: 'the composition hangs no uppers',
    find: '            render.drawUpperCabinets2D(ctx, toS, fixture, wallById.get(fixture.wallId) || undefined, env.fixtureEnv);\n',
    with: '',
    test: 'LAYOUT: the dealt MAIN FL PLAN sheet draws the beam over it dash-dot and the uppers dashed; the MAIN FLOOR layout neither' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4374' } });
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
