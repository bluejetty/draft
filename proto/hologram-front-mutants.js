#!/usr/bin/env node
// MUTATION GATE for a hologram standing in front painted over the building on
// an elevation (tests/hologram-front.spec.js).
//
// Movie, 21 Oct: "the PHASE 1 hologram roof is on the 1st ceiling but doesn't
// show in the E1 top layer position" -- and "yes" to weighing each hologram
// whole, in front or behind from where the elevation stands.
//
// Run: node proto/hologram-front-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/hologram-front.spec.js';
const MUTANTS = [
  { file: 'cut-view.js', name: 'the elevation never calls the overlay',
    find: "    runOverlay(opts, { x0, y0, pxPerFt, uMin, yTop, external: Boolean(fit) });\n",
    with: "",
    test: 'painted over the house' },
  { file: 'hologram.js', name: 'the overlay paints the ones behind',
    find: "overlay: frame => paintCut(ctx, w, h, cut, saved, frame, { ...env, show, front: true }),",
    with: "overlay: frame => paintCut(ctx, w, h, cut, saved, frame, { ...env, show, front: false }),",
    test: 'painted over the house' },
  { file: 'hologram.js', name: 'in front weighed by the middles, not whole',
    find: "    return Boolean(own && it && it.lo >= own.hi - FRONT_TOL_FT);",
    with: "    return Boolean(own && it && (it.lo + it.hi) / 2 >= (own.lo + own.hi) / 2);",
    test: 'never in front' },
  { file: 'hologram.js', name: 'the near side read from the far side',
    find: "      const v = (p.x - o.x) * d.x + (p.z - o.z) * d.z;",
    with: "      const v = -((p.x - o.x) * d.x + (p.z - o.z) * d.z);",
    test: 'in front from its own side' },
  { file: 'hologram.js', name: 'no give where the two buildings meet',
    find: "  const FRONT_TOL_FT = 2;",
    with: "  const FRONT_TOL_FT = -1;",
    test: 'in front from its own side' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4505' } });
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
