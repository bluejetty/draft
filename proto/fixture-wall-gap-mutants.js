#!/usr/bin/env node
// MUTATION GATE for the half inch off the walls a piece stands against
// (tests/fixture-wall-gap.spec.js).
//
// Movie, 23 Oct: "add 1/2" on back and sides (not on front)"; "the corner at
// the extra 1/2" point will be the important point i need to attached to the
// corner of wall"; "not the toilet"; "faint line"; "update all the stuff".
//
// Run: node proto/fixture-wall-gap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/fixture-wall-gap.spec.js';
const MUTANTS = [
  { file: 'fixture-geometry.js', name: 'no piece takes the half inch',
    find: "    ? 0 : WALL_GAP_FT);\n",
    with: "    ? 0 : 0);\n",
    test: 'a shower pressed by the corner' },
  { file: 'fixture-geometry.js', name: 'the toilet takes it too',
    find: "const NO_WALL_GAP = new Set(['toilet', 'island', 'closet']);",
    with: "const NO_WALL_GAP = new Set(['island', 'closet']);",
    test: 'a toilet takes no half inch' },
  { file: 'fixture-geometry.js', name: 'a run into a crossing wall is left where it is',
    find: "        if (Math.abs(shift) < 1e-4) return;\n",
    with: "        return;\n",
    test: 'a drawing opened with a run' },
  { file: 'fixture-geometry.js', name: 'a run short of the wall is not pulled in',
    find: "            if (lo == null || Math.abs(ask) < Math.abs(lo)) lo = ask;\n",
    with: "            if (ask > 0 && (lo == null || Math.abs(ask) < Math.abs(lo))) lo = ask;\n",
    test: 'a vanity run pressed from the corner' },
  { file: 'model/11-floor-openings-fixtures.js', name: 'a press by the corner is held off by the header bearing',
    find: "    const clamped = intoCorner != null ? { offset: intoCorner } : G.clampOpeningToWall(",
    with: "    const clamped = false ? { offset: intoCorner } : G.clampOpeningToWall(",
    test: 'a shower pressed by the corner' },
  { file: 'render-2d.js', name: 'no light line drawn',
    find: "    if (wallGap > 0 && geo.faceOff != null) {\n",
    with: "    if (false) {\n",
    test: 'light line' },
  { file: 'render-2d.js', name: 'the light line runs across the front too',
    find: "      L([left, geo.faceOff], [right, geo.faceOff]);\n",
    with: "      L([left, geo.faceOff], [right, geo.faceOff]); L([left, cFront], [right, cFront]);\n",
    test: 'light line' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4537' } });
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
