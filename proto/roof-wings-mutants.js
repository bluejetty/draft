#!/usr/bin/env node
// MUTATION GATE for the roof's ends and the wing that is a roof of its own
// (tests/roof-wings.spec.js).
//
// Movie, 16 Oct, on his own modified bilevel: "the back on this one could
// have been a hip" ... "the upper roof should have been 2 separate roofs with
// a gable on both" ... "show it as dotted line (under the upper roof
// overhang)" ... "the upper 2nd floor roof can be hip no problem because it
// won't have to worry about height of other walls".
//
// The engine's own rows are proto/roof-wings-harness.js (--mutate) and the
// dotted line's are proto/render-2d-harness.js's. The rows below are the
// PAGE's: the split asked for, each body handed the top of its walls, the stub raised against the rest, the
// cut keeping what the uncut edges already had, and the ends decided at all.
//
// Run: node proto/roof-wings-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/roof-wings.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the stub stays in the house roof: no roof of its own',
    find: '      const apart = G.roofEndAttachment(ring);',
    with: '      const apart = null;',
    test: 'his house: the main block hips at the back and gables at the stub; the stub is its own roof under the rake' },
  { file: 'MODEL.html',
    name: 'the stub is raised with no wall to die into: an eave against the house',
    find: '          ...opts, flush: null, rake: null, against: [apart.rest, ...againstLoops] });',
    with: '          ...opts, flush: null, rake: null, against: againstLoops });',
    test: 'his house: the main block hips at the back and gables at the stub; the stub is its own roof under the rake' },
  { file: 'MODEL.html',
    name: 'the ends are never decided: the ring keeps the kinds the cut gave it',
    find: '      edges: G.roofWingKinds(cut.points, cut.edges, bodies, {',
    with: '      edges: cut.edges, unused: G.roofWingKinds(cut.points, cut.edges, bodies, {',
    test: 'his house: the main block hips at the back and gables at the stub; the stub is its own roof under the rake' },
  { file: 'MODEL.html',
    name: "a body's walls have no height: the room gables where the lower house and garage stand",
    find: '      .map(outline => ({ points: outline.points, top: topOf(outline.levelId) }));',
    with: '      .map(outline => ({ points: outline.points, top: null }));',
    test: 'his house: the main block hips at the back and gables at the stub; the stub is its own roof under the rake' },
  { file: 'MODEL.html',
    name: "the roof's own plate is unknown, so every body counts",
    find: '        top: Number.isFinite(Number(ownTop)) ? Number(ownTop) : null }),',
    with: '        top: null }),',
    test: 'his house: the room over the garage hips both ends, and the garage stub rises to its wall with a hipped front' },
  { file: 'MODEL.html',
    name: 'the cut reads every uncut edge as a full eave again: two feet of overhang on a flush edge',
    find: '        const own = j >= 0 && Array.isArray(plain.edgeOverhang) ? Number(plain.edgeOverhang[j]) : NaN;',
    with: '        const own = NaN;',
    test: 'his house: the main block hips at the back and gables at the stub; the stub is its own roof under the rake' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4361' } });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html', { cwd: ROOT }).toString().trim();
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
