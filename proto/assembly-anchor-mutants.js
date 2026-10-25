#!/usr/bin/env node
// MUTATION GATE for ANCHOR nodes on an assembly
// (tests/assembly-anchor.spec.js).
//
// Movie, 22 Oct: "if that point moves the 'Y' object will moves according to
// how that point moves"; "make the top an bottom of the walls STRETCH ... as
// if it was a window moving back and forth in the wall"; "would only work if
// 2 nodes alone a similar walls that are aligned".
//
// Run: node proto/assembly-anchor-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/assembly-anchor.spec.js';
const MUTANTS = [
  { file: 'model/16-gestures-undo.js', name: 'a body drag ignores the track',
    find: "if (md.slide) ({ dx, dz } = slideDelta(md.slide, dx, dz));",
    with: "if (false) ({ dx, dz } = slideDelta(md.slide, dx, dz));",
    test: 'two anchors on a lined-up wall' },
  { file: 'model/06-selection-pick.js', name: 'the slide is not held short of the wall end',
    find: "t = Math.max(slide.lo, Math.min(slide.hi, t));",
    with: "",
    test: 'stops before the outside wall' },
  { file: 'model/09-draw-move-stretch.js', name: 'MOVE lets the anchors go off the outside wall',
    find: "if (!held.has(item[key]) || pinned.has(item[key])) return;",
    with: "if (!held.has(item[key])) return;",
    test: 'stops before the outside wall' },
  { file: 'model/06-selection-pick.js', name: 'anchors on walls that do not line up still slide',
    find: "return ol > 1e-6 && Math.abs(ox * u.z - oz * u.x) / ol < 0.01;",
    with: "return ol > 1e-6;",
    test: 'two anchors on a lined-up wall' },
  { file: 'model/16-gestures-undo.js', name: 'nothing follows a one-anchor corner',
    find: "        followAnchors(md.follow);\n",
    with: "",
    test: 'one anchor' },
  { file: 'model/15-panels.js', name: 'ANCHOR takes a corner no outside wall shares',
    find: "      if (!outsideWallsAt(group, best.vtx).length) {\n        sayOnStrip(",
    with: "      if (false) {\n        sayOnStrip(",
    test: 'ANCHOR picks a shared corner' },
  { file: 'model/06-selection-pick.js', name: 'no aqua dots painted',
    find: "    canvas.dataset.anchors = String(n);",
    with: "    canvas.dataset.anchors = '0';",
    test: 'ANCHOR picks a shared corner' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4527' } });
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
