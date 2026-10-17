#!/usr/bin/env node
// MUTATION GATE for which stairs a floor plan shows, and how
// (tests/stairs-per-floor.spec.js).
//
// Movie, 16 Oct: "BASEMENT shows main->basement only; MAIN shows main->2nd
// and any main->basement; 2ND FL shows main->2nd normal weight and
// main->basement lighter." The rule's rows are proto/layout-plan-harness.js's
// (stair-geometry stairsShownOn) and the painter's proto/render-2d-harness.js's;
// these are the pages' seams.
//
// Run: node proto/stairs-per-floor-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stairs-per-floor.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'MODEL paints its own stairs only, as it always did',
    find: '      stairs: shown.map(entry => entry.stair),',
    with: '      stairs: stairs(),',
    test: 'MODEL: the basement reads UP, MAIN reads DN and UP, 2ND FL reads DN with the lower stair lighter' },
  { file: 'MODEL.html',
    name: 'MODEL tells the painter every stair is its own',
    with: "      roleFor: stair => 'own',",
    find: "      roleFor: stair => roles.get(stair) || 'own',",
    test: 'MODEL: the basement reads UP, MAIN reads DN and UP, 2ND FL reads DN with the lower stair lighter' },
  { file: 'layout-plan.js',
    name: 'the sheet hands the composer no list, so it picks its own stairs only',
    find: '        ? [...stairRoles.keys()] : null,',
    with: '        ? null : null,',
    test: 'LAYOUT: the dealt plan sheets show the same stairs the same way' },
  { file: 'layout-plan.js',
    name: 'the sheet tells the painter every stair is its own',
    find: "        roleFor: stair => (stairRoles.get(stair) || 'own'),",
    with: "        roleFor: stair => 'own',",
    test: 'LAYOUT: the dealt plan sheets show the same stairs the same way' },
  { file: 'stair-geometry.js',
    name: 'a stair above this floor is shown too',
    find: "    return top < here ? 'below' : null;",
    with: "    return 'below';",
    test: 'MODEL: the basement reads UP, MAIN reads DN and UP, 2ND FL reads DN with the lower stair lighter' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4366' } });
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
