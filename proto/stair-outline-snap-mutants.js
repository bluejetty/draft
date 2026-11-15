#!/usr/bin/env node
// MUTATION GATE for a stair's outline snapping (tests/stair-outline-snap.spec.js).
//
// jb, 15 Nov 2026: "can you make the stair corners NODE snapable so i can
// position the corner or edge to a edge wall" -- "or t wall corner". Four
// seams: an L's corners, a corner's catch on a T, an edge onto a face, and
// MOVE reading the outline.
//
// Run: node proto/stair-outline-snap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-outline-snap.spec.js';

const MUTANTS = [
  { file: 'model/06-selection-pick.js',
    name: 'a turned flight has no corners',
    find: "    if (!f) return stairOutlineOf(stair).corners;\n",
    with: "    if (!f) return [];\n",
    test: 'rings cyan under the hand' },
  { file: 'model/07-walls-magnet.js',
    name: 'the outline\'s corners catch nothing',
    find: "    if (best) return { dx: dx + best.hit.land.x - best.at.x, dz: dz + best.hit.land.z - best.at.z, lit: best.hit };\n",
    with: "    if (best) return null;\n",
    test: 'any corner of an L lands' },
  { file: 'model/07-walls-magnet.js',
    name: 'no edge lies on a face',
    find: "    const first = edgeCatch(dx, dz);\n",
    with: "    const first = null;\n",
    test: 'lies on a wall face' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'MOVE takes no stair corner',
    find: "    entries.filter(e => e.type === 'stair').forEach(({ item }) => stairCorners(item)\n",
    with: "    entries.filter(e => false).forEach(({ item }) => stairCorners(item)\n",
    test: 'MOVE' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4777' } });
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
