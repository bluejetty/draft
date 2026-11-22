#!/usr/bin/env node
// MUTATION GATE for a deck hiding the lines behind it on the elevations
// (tests/deck-hides-lines-behind.spec.js).
//
// jb, 22 Nov 2026, on E1 with a deck across the front: "these lines behind
// shouldn't show on the deck floor make sense?".
//
// Run: node proto/deck-hides-lines-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/deck-hides-lines-behind.spec.js';
const MUTANTS = [
  { file: 'cut-view.js', name: 'no deck laid back down: the corner lines run over it again',
    find: '      ctx.clip();\n      paintDeckBand(band);\n      ctx.restore();',
    with: '      ctx.clip();\n      ctx.restore();',
    test: 'E1:' },
  { file: 'cut-view.js', name: 'laid back down unclipped: a deck behind the house paints over the house',
    find: '      ctx.clip();\n      paintDeckBand(band);',
    with: '      paintDeckBand(band);',
    test: 'E3:' },
  { file: 'cut-view.js', name: 'nothing nearer is asked: the far deck covers the house\'s floor band',
    find: '    const near = deckOccluders.filter(o => o.depth > band.depth + 1e-6',
    with: '    const near = deckOccluders.filter(o => false && o.depth > band.depth + 1e-6',
    test: 'E3:' },
  { file: 'cut-view.js', name: 'only the walls are asked, not the floor bands in front',
    find: '    const deckOccluders = [...allSpans, ...rimBands,',
    with: '    const deckOccluders = [...allSpans,',
    test: 'E3:' },
  { file: 'cut-view.js', name: 'everything counts as nearer: no deck is ever laid back down',
    find: '    const deckOccluders = [...allSpans, ...rimBands,',
    with: '    const deckOccluders = [...allSpans, ...rimBands, { lo: -1e9, hi: 1e9, depth: 1e9, top: 1e9, bottom: -1e9 },',
    test: 'E1:' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4503' } });
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
