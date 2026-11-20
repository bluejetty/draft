#!/usr/bin/env node
// MUTATION GATE for CREATE WALL TYPE, part two (jb, 16 Nov 2026): a made
// type's slices in the sections, on the WALL SECTION sheet, in the DXF and
// in ESTIMATES 6-C.
//
// Run: node proto/wall-type-sections-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/wall-type-sections.spec.js'];
const MUTANTS = [
  { file: 'cut-view.js', name: 'a section cuts a made wall as one grey band', spec: 'tests/wall-type-sections.spec.js',
    find: "    if (!WT?.isUserWallTypeId || !wall || !WT.isUserWallTypeId(wall.wallType)) return;",
    with: "    return;",
    test: 'a section cuts a made wall' },
  { file: 'cut-view.js', name: 'the foundation crossings skip the slices', spec: 'tests/wall-type-sections.spec.js',
    // The lined branch: a foundation type with a lining stands its slices on
    // the slab (jb, 20 Nov 2026), and this spec's 8IN CONC + LINING is one.
    find: "        ctx.fillRect(x, Y(top), wid, (top - slabTop) * pxPerFt);\n        sectionSlices(ctx, X, Y, pxPerFt, c, top, slabTop, C);",
    with: "        ctx.fillRect(x, Y(top), wid, (top - slabTop) * pxPerFt);",
    test: 'a section cuts a made wall' },
  { file: 'cut-view-env.js', name: 'the sheets\' section env never learns the file\'s made types', spec: 'tests/wall-type-sections.spec.js',
    find: "    if (saved && window.DraftWallTypes?.adoptDrawing) window.DraftWallTypes.adoptDrawing(saved);",
    with: "",
    test: 'a section cuts a made wall' },
  { file: 'wall-section.js', name: 'the WALL SECTION ignores the made floor type', spec: 'tests/wall-type-sections.spec.js',
    find: "      const made = madeTypeOn(levelId, 'plan', 'floor');",
    with: "      const made = null;",
    test: 'the WALL SECTION sheet names the made type' },
  { file: 'wall-section.js', name: 'the WALL SECTION drops the foundation lining', spec: 'tests/wall-type-sections.spec.js',
    find: "        ...(fdnPour ? { slices: slicesOf(fdnPour), lining: slicesOf(fdnLining) } : {}),",
    with: "",
    test: 'the WALL SECTION draws a line between each slice' },
  { file: 'project-page.js', name: 'no line between a floor wall\'s slices', spec: 'tests/wall-type-sections.spec.js',
    find: "          if (at > 0 && at < levelWallFt) line(at, faceFromY, at, faceToY, 0.75);",
    with: "",
    test: 'the WALL SECTION draws a line between each slice' },
  { file: 'estimates.js', name: 'ESTIMATES counts no made types', spec: 'tests/wall-type-sections.spec.js',
    find: "      walltypes: madeWallTypeRows(saved, d),",
    with: "      walltypes: [],",
    test: 'ESTIMATES 6-C' },
  { file: 'estimates.js', name: 'a slice line counts the openings in', spec: 'tests/wall-type-sections.spec.js',
    find: "      const net = round1(Math.max(0, g.gross - g.openings));\n      g.type.layers",
    with: "      const net = round1(g.gross);\n      g.type.layers",
    test: 'ESTIMATES 6-C' },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4812' } });
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
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
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
