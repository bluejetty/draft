// DOES THE SPEC CATCH LETTERING THAT IS NOT AT ITS PRINTED SIZE?
//
// Movie, 16 Oct: "can you put it at the exact size that it will PRINT when the
// layout is PRINTED so the user can adjust it if they need too".
//
// The failure he reported was not a wrong size, it was a FLOOR: the number was
// already in paper inches and a Math.max held it up at small zooms. So the
// mutants are the ways a size can stop tracking the paper while still drawing
// something perfectly legible -- a floor restored, a ceiling added, a constant
// in place of the paper figure, the paper figure read as pixels.
//
// TWO MUTANTS ARE NOT HERE, and it is worth saying which rather than letting a
// clean sheet imply more than it covers:
//
//   1. THE GAP under the caption, now 4px of paper rather than 4 screen px.
//      Every way of measuring it reads the viewport frame instead -- the frame
//      is a quarter-opacity line in the same ink, a pixel above where the band
//      starts. Argued for in LAYOUT.html, unpinned here.
//   2. THE PRINT caption's own floor, which was removed with the others and
//      is not stood back up here. It could not have bitten: print renders at
//      72 px to the inch, where 0.14in is 10.08px and the 9px floor never
//      applied. The floor that lied was the one on the SCREEN preview, and
//      that is the one these mutants restore.
//   3. THE `inkScale` HANDED TO drawCutView, which is what puts an ELEVATION's
//      level tags and size tags in paper units. The spec places a PLAN
//      viewport, because a plan is what a saved drawing composes without cuts;
//      pinning the elevation half needs a fixture with a cut in it, which is a
//      spec this one is not. Deleting that line would survive every check
//      here. It is the half of his report this file does NOT yet defend.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-text-prints-true.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'the 9 px floor is back: at the zoom a whole sheet is read at, the '
      + 'caption stops shrinking with the paper',
    find: "    ctx.fillStyle = selected ? '#5980a6' : 'rgba(29,31,32,0.45)';\n"
      + "    ctx.font = `600 ${zoom * VIEWPORT_TITLE_IN}px 'Barlow Condensed', sans-serif`;",
    with: "    ctx.fillStyle = selected ? '#5980a6' : 'rgba(29,31,32,0.45)';\n"
      + "    ctx.font = `600 ${Math.max(9, zoom * VIEWPORT_TITLE_IN)}px 'Barlow Condensed', sans-serif`;",
    test: 'the viewport caption grows exactly as fast as the sheet' },

  { file: 'LAYOUT.html',
    name: 'the scaling is softened -- a base size with a little of the paper '
      + 'added, which tracks the sheet lazily instead of exactly',
    find: "    ctx.fillStyle = selected ? '#5980a6' : 'rgba(29,31,32,0.45)';\n"
      + "    ctx.font = `600 ${zoom * VIEWPORT_TITLE_IN}px 'Barlow Condensed', sans-serif`;",
    with: "    ctx.fillStyle = selected ? '#5980a6' : 'rgba(29,31,32,0.45)';\n"
      + "    ctx.font = `600 ${9 + zoom * VIEWPORT_TITLE_IN * 0.3}px 'Barlow Condensed', sans-serif`;",
    test: 'the viewport caption grows exactly as fast as the sheet' },

  { file: 'LAYOUT.html',
    name: 'the caption is a fixed pixel size, which is the bug he reported '
      + 'with no floor to hide behind',
    find: "    ctx.fillStyle = selected ? '#5980a6' : 'rgba(29,31,32,0.45)';\n"
      + "    ctx.font = `600 ${zoom * VIEWPORT_TITLE_IN}px 'Barlow Condensed', sans-serif`;",
    with: "    ctx.fillStyle = selected ? '#5980a6' : 'rgba(29,31,32,0.45)';\n"
      + "    ctx.font = `600 10px 'Barlow Condensed', sans-serif`;",
    test: 'the viewport caption grows exactly as fast as the sheet' },

  { file: 'LAYOUT.html',
    name: 'the paper figure is read as pixels: the size no longer depends on '
      + 'the paper at all',
    find: 'const VIEWPORT_TITLE_IN = 0.14;',
    with: 'const VIEWPORT_TITLE_IN = 0.14 / 42;',
    test: 'and it is drawn at the size it will print' },

  { file: 'LAYOUT.html',
    name: 'the caption is drawn half again as big as it prints -- it tracks '
      + 'the paper perfectly and is still the wrong size',
    find: 'const VIEWPORT_TITLE_IN = 0.14;',
    with: 'const VIEWPORT_TITLE_IN = 0.24;',
    test: 'and it is drawn at the size it will print' },

  { file: 'LAYOUT.html',
    name: 'the transform the paint used is published stale, so a check on the '
      + 'printed size is measured against the wrong zoom',
    find: "    document.body.dataset.layoutView = [zoom, panX, panY]\n"
      + "      .map(n => Math.round(n * 100) / 100).join(',');",
    with: "    document.body.dataset.layoutView = [zoom * 1.5, panX, panY]\n"
      + "      .map(n => Math.round(n * 100) / 100).join(',');",
    test: 'and it is drawn at the size it will print' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4381' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync('git status --porcelain LAYOUT.html',
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

// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
