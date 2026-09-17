// DOES THE CORNER-HIGHLIGHT SPEC CATCH A RING THAT LIES?
//
// A hover mark is easy to build wrong in ways that look right: painted and
// never cleared, painted from a second hit test that disagrees with the drag,
// or painted everywhere the cursor goes rather than where a grab is. Each of
// those is a mutant here.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code. That happened on the level-lock gate after a
// rebase; every gate carries this guard now.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-corner-glow.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the ring is never painted at all',
    find: '    if (!hoverCorner) return;',
    with: '    if (true) return;',
    test: 'paints a ring on it' },

  { file: 'MODEL.html',
    name: 'the ring is painted and NEVER CLEARED: every corner visited stays lit',
    find: '      if (corner !== hoverCorner) { hoverCorner = corner; paint(); }',
    with: '      if (corner && corner !== hoverCorner) { hoverCorner = corner; paint(); }',
    test: 'leaves nothing behind' },

  { file: 'MODEL.html',
    name: 'the ring follows the CURSOR rather than the grab: lit on bare sheet',
    find: '      const corner = cornerAt(at);\n      canvas.classList.toggle(\'over-corner\', !!corner);',
    with: '      const corner = cornerAt(at) || { x: at.x, z: at.z };\n      canvas.classList.toggle(\'over-corner\', !!corner);',
    test: 'bare sheet gets no ring' },

  { file: 'MODEL.html',
    name: 'the ring offers a grab the drag would refuse: an unselected wall lights',
    // DISAMBIGUATED. Those two lines occur TWICE in MODEL.html -- here in the
    // corner/ring path, and again in wallBodyAt (:6341). replace() takes the
    // first, so this happened to be hitting the right one; a reordering would
    // have moved it to the body grab silently, still reporting a clean result.
    // The third line is what tells them apart.
    find: "    const selectedSeg = selectedWall();\n    if (!selectedSeg || !walls().includes(selectedSeg)) return null;\n    const G = window.DraftGeometry2D;",
    with: "    const selectedSeg = selectedWall() || walls()[0];\n    if (!selectedSeg || !walls().includes(selectedSeg)) return null;\n    const G = window.DraftGeometry2D;",
    test: 'UNSELECTED wall gets no ring' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4344' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it. This gate mutates MODEL.html
// and nothing else.
//
// BEFORE THE BASELINE, NOT AFTER, and that ordering is the whole value. The
// baseline below is a full Playwright run of the spec -- minutes -- and it
// answers a question about the spec, not about your tree. A guard that fires
// only after it lets you walk away believing the gate is running when it has
// already refused, and the uncommitted work it was protecting is the thing
// you were least willing to lose.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
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
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
