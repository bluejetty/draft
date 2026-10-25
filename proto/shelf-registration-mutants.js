#!/usr/bin/env node
// MUTATION GATE for the shelf's registration target and the gold super node
// (tests/model-html-site-point.spec.js).
//
// Movie, 22 Oct: "also in the SHELF can the registration lower right corner
// auto place itself like it does for a house"; "it will probably be one of
// the SUPERNODE corners"; "make that SUPERNODE corner gold to match".
//
// Run: node proto/shelf-registration-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-site-point.spec.js';
const MUTANTS = [
  { file: 'model/01-skin-view.js', name: 'the shelf keeps its first-click datum',
    find: "const shelf = boneyardActive ? boneyardLevelId() : null;",
    with: "const shelf = null;",
    test: 'on a shelf the target' },
  { file: 'model/01-skin-view.js', name: 'the shelf\'s walls read as boneyard, skipped',
    find: "\n          .map(w => ({ ...w, levelId: 3 }));",
    with: ";",
    test: 'follows the suite moved' },
  { file: 'model/02-holograms-tags.js', name: 'no gold node on the plan',
    find: "gold: n.id === goldId })",
    with: "gold: false })",
    test: 'super node on the target' },
  { file: 'model/02-holograms-tags.js', name: 'no gold ring on a suite hologram',
    find: "gold: n.registration === true })",
    with: "gold: false })",
    test: 'corner ring on its own target' },
  { file: 'hologram.js', name: 'the suite\'s registration corner never marked',
    find: "return nodes.map(n => (n === best ? { ...n, registration: true } : n));",
    with: "return nodes;",
    test: 'corner ring on its own target' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4522' } });
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
