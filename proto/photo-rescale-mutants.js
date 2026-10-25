#!/usr/bin/env node
// MUTATION GATE for a photo picked on the sheet and RESCALED (Movie, 23
// Oct). Each row breaks one line, runs the one test that should notice, and
// restores the file from HEAD.
//
//   node proto/photo-rescale-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/photo-rescale.spec.js';

const MUTANTS = [
  { file: 'model/06-selection-pick.js',
    name: 'a press on the picture picks nothing',
    find: "      const photo = underlayAt(worldPt);\n      if ((photo) && take({ type: 'underlay', item: photo })) return out;\n",
    with: "",
    test: 'a press on the picture picks it' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'RESCALE comes to the foot for any selection',
    find: "    const able = !!selectedPhoto() && !activeCut() && !modalUp();\n    if (!able) { rescaleState.open = false; rescaleState.drag = null; }\n",
    with: "    const able = !!selection.length && !activeCut() && !modalUp();\n    if (!able) { rescaleState.open = false; rescaleState.drag = null; }\n",
    test: 'a press on the picture picks it' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a corner scales about the picture\'s middle, not the opposite corner',
    find: "      u.x = ax + (dx * f) / 2;\n      u.z = az + (dz * f) / 2;\n",
    with: "",
    test: 'RESCALE: a corner keeps the proportions' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a corner lets the proportions go',
    find: "      u.widthFt = b0.widthFt * f;\n      u.heightFt = b0.heightFt * f;\n",
    with: "      u.widthFt = Math.max(RESCALE_MIN_FT, Math.abs(at.x - ax));\n      u.heightFt = b0.heightFt * f;\n",
    test: 'RESCALE: a corner keeps the proportions' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a side scales about the middle',
    find: "    if (handle.id === 'e') { const w = Math.max(RESCALE_MIN_FT, at.x - r0.left); u.widthFt = w; u.x = r0.left + w / 2; }\n",
    with: "    if (handle.id === 'e') { const w = Math.max(RESCALE_MIN_FT, at.x - r0.left); u.widthFt = w; }\n",
    test: 'RESCALE: a side stretches' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a drag leaves no UNDO step',
    find: "      undoStack.push({ kind: 'props', edits: [{ item: u, before: b }] });\n      markDirty();\n      const F = window.DraftFormatters;\n",
    with: "      markDirty();\n      const F = window.DraftFormatters;\n",
    test: 'RESCALE: a corner keeps the proportions' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'ROTATE ignores the picked picture',
    find: "    const photo = photoInHand() || selectedPhoto();\n",
    with: "    const photo = photoInHand();\n",
    test: 'ROTATE turns the picked picture' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'MOVE does not take the picked picture in hand',
    find: "    const photo = selectedPhoto();\n    if (photo) {\n      setRescaleOpen(false);\n",
    with: "    const photo = null;\n    if (photo) {\n      setRescaleOpen(false);\n",
    test: 'MOVE takes the picked picture in hand' },
  { file: 'model/08-structure-roof.js',
    name: 'DELETE cannot find the picture\'s list',
    find: "    underlay: 'underlays',\n",
    with: "",
    test: 'ROTATE turns the picked picture' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4549' } });
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
