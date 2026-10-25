#!/usr/bin/env node
// MUTATION GATE for a hologram brought in on the floor the drafter is on, and
// a drawing whose suite is only on a shelf coming onto its floor
// (tests/hologram-floor.spec.js).
//
// Movie, 20 Oct: "can we load them in the CURRENT PLAN LEVEL.. so if i'm in
// MAIN FLOOR PLAN - it would align into that floor, or 2nd floor", and "i
// saved the 2BD on the SHELF and when i brought it in as a HOLOGRAM - it
// loaded it into the SHELF".
//
// Run: node proto/hologram-floor-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/hologram-floor.spec.js';
const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js', name: 'brought in where its own file has it, not on the floor in view',
    find: "    if (map && !sameMap(holo, map)) holo.levelMap = map;",
    with: "    void map;",
    test: 'on 2ND FL' },
  { file: 'model/13-suites-trim-follow.js', name: 'the floor in view read one up',
    find: "    const map = here >= 0 ? suiteMapFor(holo, here) : null;",
    with: "    const map = here >= 0 ? suiteMapFor(holo, here + 1) : null;",
    test: 'on MAIN FL' },
  { file: 'model/13-suites-trim-follow.js', name: 'a shelf-only drawing left on the shelf',
    find: "    if (!window.DraftDrawingFormat.suiteKind(parsed?.suiteKind) && !onlyOnShelves(parsed)) return parsed;",
    with: "    if (!window.DraftDrawingFormat.suiteKind(parsed?.suiteKind)) return parsed;",
    test: 'only on a shelf' },
  { file: 'model/13-suites-trim-follow.js', name: 'one wall on a floor counted as all on shelves',
    find: "    return list.length > 0 && list.every(w => Number(w?.levelId) < 0);",
    with: "    return list.length > 0 && list.some(w => Number(w?.levelId) < 0);",
    test: 'keeps what it parked' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4504' } });
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
