#!/usr/bin/env node
// MUTATION GATE for SNAP STRENGTH (tests/snap-settings.spec.js).
//
// Movie, 26 Oct, the one snap rule: reaches in inches on the plan, scaled
// as a set by SNAP STRENGTH on the Settings page. Three seams: MODEL reading
// the strength, the four steps only, and the page saving the pick.
//
// Run: node proto/snap-strength-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/snap-settings.spec.js';

const MUTANTS = [
  { file: 'model/07-walls-magnet.js',
    name: 'MODEL ignores the strength',
    find: "      snapStrengthRead = S?.normaliseSnapReach ? S.normaliseSnapReach(stored) : 1;\n",
    with: "      snapStrengthRead = 1;\n",
    test: 'MODEL reads the strength' },
  { file: 'profile-manager.js',
    name: 'any number is a strength',
    find: "    return SNAP_REACH_CHOICES.includes(raw) ? raw : DEFAULT_SNAP_REACH;\n",
    with: "    return Number.isFinite(raw) ? raw : DEFAULT_SNAP_REACH;\n",
    test: 'a strength that is not one of the four reads as 100%' },
  { file: 'SETTINGS.html',
    name: 'the pick is not saved',
    find: "        saveActive('Snap strength saved locally.');\n",
    with: "",
    test: 'the Settings page edits and saves the snap strength' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4751' } });
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
