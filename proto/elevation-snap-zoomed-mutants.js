// DOES THE SPEC CATCH A SNAP THAT LOSES THE HOUSE WHEN ZOOMED IN?
//
// jb, 14 Nov 2026: "on the sections and elevations can we have 'node snap' on
// the corners intersections etc ... so i can draw overtop to fix small
// problems quickly" -- and a small problem is fixed zoomed in, where the snap
// had kept 5 pieces of a house's 244.
//
// THE FAULT WAS SILENT. Nothing errored: the ring simply never lit, and a
// line drawn over a zoomed elevation started under the hand instead of on
// the corner beside it. So the mutants are the ways that comes back -- the
// painter stops saying which clip is its viewport, or the snap stops
// listening -- and the one that would "fix" it by keeping hatch as well.
//
// proto/elev-snap-harness.js --mutate holds the recorder's own table (CI
// runs it); this gate is the painter and the recorder together, in the page.
//
// THE TABLE IS PLAIN DATA: proto/mutant-anchors-harness.js reads it without
// running this file.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/elevation-snap-zoomed.spec.js';

const MUTANTS = [
  { file: 'cut-view.js',
    name: 'the painter no longer names its viewport: zoomed in, the whole house reads as hatch and nothing of it is caught',
    find: '      ctx.snapFrameClip = true;\n      ctx.clip();',
    with: '      ctx.clip();',
    test: 'zoomed in, the snap still has the house' },

  { file: 'cut-view.js',
    name: 'the same, panned: the drawing runs under the rails and the snap has lost it',
    find: '      ctx.snapFrameClip = true;\n      ctx.clip();',
    with: '      ctx.clip();',
    test: 'and panned to the side as well' },

  { file: 'cut-view.js',
    name: 'the viewport is named AFTER it is clipped: the word lands on the first face\'s clip instead, and the house is still lost',
    find: '      ctx.snapFrameClip = true;\n      ctx.clip();',
    with: '      ctx.clip();\n      ctx.snapFrameClip = true;',
    test: 'zoomed in, the snap still has the house' },

  { file: 'elev-snap.js',
    name: 'the snap does not hear the name',
    find: "        if (prop === 'snapFrameClip') { frameNext = !!value; return true; }",
    with: "        if (prop === 'snapFrameClip') return true;",
    test: 'zoomed in, the snap still has the house' },

  { file: 'elev-snap.js',
    name: 'the name is heard and not used: the viewport is judged by its size as before',
    find: '            const frameClip = frameNext || (!clipsSeen && !segs.length);',
    with: '            const frameClip = !clipsSeen && !segs.length;',
    test: 'zoomed in, the snap still has the house' },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4395' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline: the restore is
// `git checkout -- <file>`, so uncommitted work in a mutated file is
// destroyed the first time a mutant touches it.
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
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
  if (before.split(m.find).length !== 2) {
    console.log(`  SKIPPED   ${m.name}  (anchor ${before.includes(m.find) ? 'matches more than once' : 'not found'} — re-aim \`find\`)`);
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

// READ AGAINST WHAT WAS DEFINED, never on its own.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
