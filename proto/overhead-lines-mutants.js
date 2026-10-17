#!/usr/bin/env node
// MUTATION GATE for the cantilever and roof overhang lines on plan views
// (tests/overhead-lines.spec.js).
//
// Movie, 16 Oct (MAIN FL PLAN sheet 7): "a cantilever of the floor above
// and a roof overhang, drawn dashed and lighter ... A floor shows only what
// sits DIRECTLY over it ... Nothing two storeys up." The clipping's rows are
// proto/overhead-lines-harness.js's, the painter's
// proto/render-2d-harness.js's and the sheet's proto/layout-plan-harness.js's;
// these are the pages' seams.
//
// Run: node proto/overhead-lines-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/overhead-lines.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'MODEL never draws the overhead lines',
    find: '        paintOverheadLines();\n',
    with: '',
    test: 'MODEL: the walls plan hangs the cantilever above and the roof over it; the floor layout nothing' },
  { file: 'MODEL.html',
    name: 'MODEL draws the overhead lines on the floor layout too',
    find: "    const onWallsPlan = activeViewId() === 'plan';",
    with: '    const onWallsPlan = true;',
    test: 'MODEL: the walls plan hangs the cantilever above and the roof over it; the floor layout nothing' },
  { file: 'MODEL.html',
    name: 'MODEL reads the roofs as hanging over every floor',
    find: '      roofs: drawing?.roofs || [],\n    }) : { cantilevers: [], overhangs: [] };',
    with: '      roofs: (drawing?.roofs || []).map(roof => ({ ...roof, sourceLevelId: activeLevelId() })),\n    }) : { cantilevers: [], overhangs: [] };',
    test: 'MODEL: the walls plan hangs the cantilever above and the roof over it; the floor layout nothing' },
  { file: 'overhead-lines.js',
    name: 'the whole upper loop is kept, inside the walls too',
    find: '        if (!covered(lower, at((t0 + t1) / 2))) out.push({ start: at(t0), end: at(t1) });',
    with: '        out.push({ start: at(t0), end: at(t1) });',
    test: 'MODEL: the walls plan hangs the cantilever above and the roof over it; the floor layout nothing' },
  { file: 'render-2d.js',
    name: 'the overhead lines are drawn solid',
    find: '    ctx.setLineDash([...OVERHEAD_DASH]);\n    ctx.globalAlpha *= OVERHEAD_ALPHA;',
    with: '    ctx.globalAlpha *= OVERHEAD_ALPHA;',
    test: 'MODEL: the walls plan hangs the cantilever above and the roof over it; the floor layout nothing' },
  { file: 'layout-plan.js',
    name: 'the sheet hands the composition no overhead lines',
    find: "      overheadLines: view === 'plan' && !halfLevel && !shell && !hologram && window.DraftOverheadLines",
    with: '      overheadLines: false',
    test: 'LAYOUT: the dealt MAIN FL PLAN and 2ND FL PLAN sheets hang their overhead lines; the MAIN FLOOR layout none' },
  { file: 'plan-composition.js',
    name: 'the composition is handed the overhead lines and paints none',
    find: '      render.drawOverheadLines2D(ctx, toS, env.overheadLines, env.overheadEnv || {});\n',
    with: '',
    test: 'LAYOUT: the dealt MAIN FL PLAN and 2ND FL PLAN sheets hang their overhead lines; the MAIN FLOOR layout none' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4386' } });
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
