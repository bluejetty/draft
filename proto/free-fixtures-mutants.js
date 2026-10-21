#!/usr/bin/env node
// MUTATION GATE for fixtures kept where they stand when their wall is deleted
// (tests/free-fixtures.spec.js).
//
// Movie, 21 Oct: "leave the item and i can either leave it in position or
// move to attach to a wall in new location".
//
// Run: node proto/free-fixtures-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/free-fixtures.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'the tub measured after its wall went: it jumps',
    find: "const geo = FGk && FGk.fixtureGeometry([...drawing.walls, wall], fx);",
    with: "const geo = FGk && FGk.fixtureGeometry(drawing.walls, fx);",
    test: 'leaves the toilet and the tub' },
  { file: 'fixture-geometry.js', name: 'a free fixture has no line to stand on',
    find: "const fixtureGeometry = (walls, fixture, wall = hostOf(walls, fixture)) => {",
    with: "const fixtureGeometry = (walls, fixture, wall = walls.find(w => w.id === fixture.wallId)) => {",
    test: 'leaves the toilet and the tub' },
  { file: 'drawing-format.js', name: 'a free fixture dropped on load',
    find: "if ((!wallId && !host) || fixtureLevelId == null",
    with: "if (!wallId || fixtureLevelId == null",
    test: 'leaves the toilet and the tub' },
  { file: 'MODEL.html', name: 'a free fixture not drawn or picked on its floor',
    find: "(fx.wallId == null ? !!fx.host : shown.has(fx.wallId))",
    with: "shown.has(fx.wallId)",
    test: 'drags anywhere' },
  { file: 'MODEL.html', name: 'UNDO leaves them free',
    find: "      (step.freed || []).forEach(({ item, before }) => {",
    with: "      ([]).forEach(({ item, before }) => {",
    test: 'UNDO puts the wall back' },
  { file: 'MODEL.html', name: 'a free fixture slides as if on a wall',
    find: "    if (fixture.wallId == null && fixture.host) {\n      const all = fixtures();",
    with: "    if (false) {\n      const all = fixtures();",
    test: 'drags anywhere' },
  { file: 'MODEL.html', name: 'only its back lands it: brought up front first it stays free',
    find: "const edges = [mid(geo.corners[0], geo.corners[1]), mid(geo.corners[2], geo.corners[3])];",
    with: "const edges = [mid(geo.corners[0], geo.corners[1])];",
    test: 'drags anywhere' },
  { file: 'MODEL.html', name: 'a free fixture not pasted: it has no wall in the paste',
    find: "if (onWall(type) && !free) {",
    with: "if (onWall(type)) {",
    test: 'copies and pastes' },
  { file: 'MODEL.html', name: 'the pasted copy shares the original\'s line: run mates',
    find: "if (!wallIds.has(was)) wallIds.set(was, `free:${copy.id}`);",
    with: "if (!wallIds.has(was)) wallIds.set(was, raw.host.id);",
    test: 'copies and pastes' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4509' } });
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
