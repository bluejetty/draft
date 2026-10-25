#!/usr/bin/env node
// MUTATION GATE for a free fixture turning (Movie, 25 Oct: "the VANITY
// doesn't go with its back towards the wall ... i tried to rotate it ...
// didn't work ... I think i might have tried to flip too"). Each row breaks
// one line, runs the one test that should notice, and restores from HEAD.
//
//   node proto/free-fixture-turn-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/free-fixture-turn.spec.js';

const MUTANTS = [
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'only its back or front lands it on a wall, as before',
    find: "    const edges = [mid(c[0], c[1]), mid(c[2], c[3]), mid(c[1], c[2]), mid(c[3], c[0])];\n",
    with: "    const edges = [mid(c[0], c[1]), mid(c[2], c[3])];\n",
    test: 'dragged with its SIDE against a wall' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'ROTATE refuses a free fixture again',
    find: "    if (type === 'fixture' && item.wallId == null && item.host?.start && item.host?.end) return [item.host.start, item.host.end];\n",
    with: "",
    test: 'ROTATE turns a free vanity' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'it turns about the line it stands on, not its body',
    find: "    const spread = [...points.filter(pt => !freeLines.has(pt)), ...holos.flatMap(hologramCorners), ...freeBodies];\n",
    with: "    const spread = [...points, ...holos.flatMap(hologramCorners)];\n",
    test: 'ROTATE turns a free vanity' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a flipped free fixture keeps facing the same way',
    find: "    (drawing.fixtures || []).filter(f => wallIds.has(String(f.wallId)) || freeOnes.includes(f)).forEach(f => {\n",
    with: "    (drawing.fixtures || []).filter(f => wallIds.has(String(f.wallId))).forEach(f => {\n",
    test: 'FLIP top for bottom' },
];


const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4564' } });
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
