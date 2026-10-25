#!/usr/bin/env node
// MUTATION GATE for the MOVE drag's hand catch, hover glow and square
// line-up (tests/move-snap.spec.js).
//
// Movie, 19 Oct: "i'd also like the cursor in this version of MOVE when i
// mouse over corners / lines etc to creat a SNAPpoint (even to when my
// mouse is perpendicular to the node / my moving edge" -- "stuff should
// glow when i mouse over so i know its magnetic snapable". Seven seams: the
// hand's catch, the hand's precedence, the line-up measured along the axis,
// its guide, the hover glow, the hover magnet read again for a new
// selection, and the faint nodes around the hand.
//
// Run: node proto/move-snap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/move-snap.spec.js';

const MUTANTS = [
  { file: 'model/07-walls-magnet.js',
    name: 'the hand catches nothing',
    find: '    const own = catchAt(hand);\n',
    with: '    const own = null;\n',
    test: 'dragging with the hand over a node puts the grab point exactly on it' },
  { file: 'model/07-walls-magnet.js',
    name: 'a carried corner beats the hand',
    find: '    if (own) return by(hand, own);\n    let best = null;\n',
    with: '    let best = own ? { hit: { ...own, share: 2 }, at: hand } : null;\n',
    test: 'and the hand\'s own line-up wins over a carried corner\'s nearer one' },
  { file: 'model/07-walls-magnet.js',
    name: 'nothing lines up along the axis',
    find: '      const share = catchShare(Math.abs(gap), px);\n      if (share <= 1 && (!best || share < best.share)) best = { share, gap, make };\n',
    with: '      const share = catchShare(Math.abs(gap), px);\n      if (share <= 0 && (!best || share < best.share)) best = { share, gap, make };\n',
    test: 'T-square lit, moving across: a carried corner stops level with a node far below it, and the guide says which' },
  { file: 'model/07-walls-magnet.js',
    name: 'the line-up shows no guide',
    find: '      land: landed(gap), pt: { x: v.x, y: 0, z: v.z }, corner: v, node, guide: { from: landed(gap), to: { x: v.x, z: v.z } } })));\n',
    with: '      land: landed(gap), pt: { x: v.x, y: 0, z: v.z }, corner: v, node })));\n',
    test: 'T-square lit, moving across: a carried corner stops level with a node far below it, and the guide says which' },
  { file: 'model/10-tracking-garage.js',
    name: 'nothing glows before the press',
    find: '    const hover = moveHover();\n    if (hover) {\n',
    with: '    const hover = null;\n    if (hover) {\n',
    test: 'MOVE armed, nothing pressed: the node under the hand glows and is named, the nodes near it glow faintly, and a new selection reads a new magnet' },
  { file: 'model/10-tracking-garage.js',
    name: 'the hover magnet is never read again',
    find: '    if (moveHoverCache.key !== key) moveHoverCache = { key, magnet: magnetExcluding(carriedPoints(selectionEntries())) };\n',
    with: '    if (!moveHoverCache.magnet) moveHoverCache = { key, magnet: magnetExcluding(carriedPoints(selectionEntries())) };\n',
    test: 'MOVE armed, nothing pressed: the node under the hand glows and is named, the nodes near it glow faintly, and a new selection reads a new magnet' },
  { file: 'model/10-tracking-garage.js',
    name: 'the nodes around the hand stay dark',
    find: '    if (nodes) (magnet.nodes || []).forEach(n => {\n',
    with: '    if (false) (magnet.nodes || []).forEach(n => {\n',
    test: 'MOVE armed, nothing pressed: the node under the hand glows and is named, the nodes near it glow faintly, and a new selection reads a new magnet' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4484' } });
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
