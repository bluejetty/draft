#!/usr/bin/env node
// MUTATION GATE for the door bucks on a garage's foundation plan
// (tests/door-bucks.spec.js).
//
// Movie, 16 Oct: "DOOR BUCKS at the man door and each garage door, 2" wider
// than the door each side ... the slab pours through the buck". The engine's
// rows are proto/door-bucks-harness.js's and the painter's
// proto/render-2d-harness.js's; these are the pages' seams.
//
// Run: node proto/door-bucks-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/door-bucks.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'MODEL never paints the bucks',
    find: '        paintDoorBucks();\n',
    with: '',
    test: 'MODEL: the FOUNDATION view cuts a buck at the man door and the overhead door, the basement plan none' },
  { file: 'MODEL.html',
    name: 'MODEL cuts the bucks on the basement plan too',
    find: "    const onFoundation = activeViewId() === 'foundation';",
    with: '    const onFoundation = true;',
    test: 'MODEL: the FOUNDATION view cuts a buck at the man door and the overhead door, the basement plan none' },
  { file: 'door-bucks.js',
    name: 'a door on a house wall cuts a buck too',
    find: "      if (!host || host.body !== 'garage' || (host.view || 'plan') !== 'plan') return;",
    with: "      if (!host || (host.view || 'plan') !== 'plan') return;",
    test: 'MODEL: the FOUNDATION view cuts a buck at the man door and the overhead door, the basement plan none' },
  { file: 'layout-plan.js',
    name: 'the sheet cuts no bucks',
    find: "      doorBucks: view === 'foundation' && !shell && window.DraftDoorBucks",
    with: '      doorBucks: false && window.DraftDoorBucks',
    test: 'LAYOUT: the dealt FOUNDATION sheet cuts the same two bucks, and the MAIN FL PLAN none' },
  { file: 'plan-composition.js',
    name: 'the composition is handed the bucks and paints none',
    find: '      render.drawDoorBucks2D(ctx, toS, env.doorBucks, env.buckEnv || {});\n',
    with: '',
    test: 'LAYOUT: the dealt FOUNDATION sheet cuts the same two bucks, and the MAIN FL PLAN none' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4367' } });
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
