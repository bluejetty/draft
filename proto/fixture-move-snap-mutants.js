#!/usr/bin/env node
// MUTATION GATE for moving a cabinet along its wall (Movie, 24 Oct): "i
// can't MOVE the cabinets sideways. and can you make the edges (not the 1/2"
// extra but the main edge of the cabinet) to snap to the SIDE of the other
// CABINET when its within 1 inch". MOVE slides a picked fixture as its
// SELECT drag does; its side catches a neighbour's inside an inch, by the
// pieces' own widths. Each row breaks one line, runs the one test that
// should notice, and restores from HEAD.
//
//   node proto/fixture-move-snap-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/fixture-move-snap.spec.js';

const MUTANTS = [
  { file: 'model/09-draw-move-stretch.js',
    name: 'MOVE carries a picked fixture as a selection again, and nothing moves',
    find: "      const held = piece && fixtureMoveBegin(piece, at);\n",
    with: "      const held = null;\n",
    test: 'MOVE slides' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'no side catches at all',
    find: "    if (!snapOn || board === 'toy') return target;\n",
    with: "    return target;\n",
    test: 'within an inch' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the catch reaches four inches',
    find: "  const SIDE_SNAP_FT = 1 / 12;\n",
    with: "  const SIDE_SNAP_FT = 4 / 12;\n",
    test: 'within an inch' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the side goes to the half inch off it, not to it',
    find: "o1 = Number(o.offset) + Number(o.width) / 2;\n      [o1 + half, o0 - half].forEach(t => {\n",
    with: "o1 = Number(o.offset) + Number(o.width) / 2;\n      [o1 + half + 1 / 24, o0 - half - 1 / 24].forEach(t => {\n",
    test: 'within an inch' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'the SELECT drag takes no catch',
    find: "      const at = FG.slideClamp(sideSnap(fixture, md.was.offset + dAlong, half), half, bounds, blocks);\n",
    with: "      const at = FG.slideClamp(md.was.offset + dAlong, half, bounds, blocks);\n",
    test: 'SELECT drag' },
  // ...AND AN ASSEMBLY OF PIECES (Movie, 25 Oct: "ONE at a time unless the
  // user connects 2 with Y ASSEMBLY (2 or mor)").
  { file: 'model/09-draw-move-stretch.js',
    name: 'a Y assembly of pieces moves one piece at a time',
    find: "      const set = fixtureSetSlide(at);\n",
    with: "      const set = null;\n",
    test: 'two pieces joined' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a kitchen preset\'s pieces all move together',
    find: "    if ((owner.members || []).some(m => m.type !== 'fixture')) return null;\n",
    with: "",
    test: 'kitchen preset' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4556' } });
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
