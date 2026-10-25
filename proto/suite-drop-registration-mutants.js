#!/usr/bin/env node
// MUTATION GATE for a suite dropping onto the registration position
// (tests/suite-drop-registration.spec.js).
//
// Movie, 22 Oct: "once they drop it onto a plan it will drop into the
// registration position and the user can move it to the correct location
// they want it in".
//
// Run: node proto/suite-drop-registration-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/suite-drop-registration.spec.js';
const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js', name: 'the drop never registers',
    find: "if (registeredAt) { holo.x = registeredAt.x; holo.z = registeredAt.z; }",
    with: "",
    test: 'gold target on the plan' },
  { file: 'model/13-suites-trim-follow.js', name: 'any drawing registers, not only a suite',
    find: "if (!F.suiteKind(holo?.source?.suiteKind) || !CM?.siteDatum) return null;",
    with: "if (!CM?.siteDatum) return null;",
    test: 'not a suite stays' },
  { file: 'model/13-suites-trim-follow.js', name: 'the suite\'s walls read as their own level, not MAIN FL',
    find: "\n      .map(w => ({ ...w, levelId: 3 }));\n    const own = CM.siteDatum",
    with: ".map(w => ({ ...w, levelId: -1 }));\n    const own = CM.siteDatum",
    test: 'gold target on the plan' },
  { file: 'model/13-suites-trim-follow.js', name: 'the suite\'s corner goes on the plan target backwards',
    find: "return { x: target.x - at.x, z: target.z - at.z };",
    with: "return { x: at.x - target.x, z: at.z - target.z };",
    test: 'gold target on the plan' },
  { file: 'model/13-suites-trim-follow.js', name: 'it lands registered but not in hand',
    find: "    traceMoving = { underlay: holo, from: null, before: null, hologram: true };\n    sayOnStrip(`${name} is in",
    with: "    traceMoving = null;\n    sayOnStrip(`${name} is in",
    test: 'arrives in hand' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4525' } });
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
