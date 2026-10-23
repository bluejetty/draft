#!/usr/bin/env node
// MUTATION GATE for ZOOM TO FILL and the north arrow's chip (Movie, 23 Oct).
// Each row breaks one line, runs the one test that should notice, and
// restores the file from HEAD.
//
//   node proto/zoom-to-fill-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/zoom-to-fill.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the arrow loses its box',
    find: '  <button type="button" id="north-hit" class="dock-chip" data-north-button data-north-hit\n',
    with: '  <button type="button" id="north-hit" style="background:transparent;border:0" data-north-button data-north-hit\n',
    test: 'the three chips stand in a row' },
  { file: 'MODEL.html',
    // A FIXED PITCH, not one read off the rail: the row no longer follows
    // the columns. (DOCK_CHIP + 4 is a pixel under the rail's own 45 and
    // inside the spec's tolerance; this one is a chip's width off.)
    name: 'the row keeps a fixed pitch instead of the rail\'s',
    find: "    const pitch = Math.max(DOCK_CHIP + 4, cols ? (cols[1] - cols[0]) / 2 : 45);\n",
    with: "    const pitch = DOCK_CHIP + 14;\n",
    test: 'the three chips stand in a row' },
  { file: 'MODEL.html',
    name: 'the press fills nothing',
    find: "      if (zoomToFill()) { paint(); return; }\n",
    with: "      if (false) { paint(); return; }\n",
    test: 'ZOOM TO FILL with no dimensions' },
  { file: 'MODEL.html',
    name: 'no air round the building',
    find: "  const ZOOM_FILL_PAD = { plain: 0.20, dims: 0.10 };\n",
    with: "  const ZOOM_FILL_PAD = { plain: 0, dims: 0.10 };\n",
    test: 'ZOOM TO FILL with no dimensions' },
  { file: 'MODEL.html',
    name: 'the strings get the building\'s fifth, not their tenth',
    find: "    const pad = dims.length ? ZOOM_FILL_PAD.dims : ZOOM_FILL_PAD.plain;\n",
    with: "    const pad = ZOOM_FILL_PAD.plain;\n",
    test: 'with a dimension string showing' },
  { file: 'MODEL.html',
    name: 'the string\'s stand-off is not framed',
    find: "  const DIM_FILL_PX = 32;\n",
    with: "  const DIM_FILL_PX = 0;\n",
    test: 'with a dimension string showing' },
  { file: 'MODEL.html',
    name: 'an empty level fills to the origin and says nothing',
    find: "    if (!own.length && !dims.length) return false;\n",
    with: "    if (!own.length && !dims.length) { view.cx = 0; view.cz = 0; view.scale = 6; return true; }\n",
    test: 'nothing drawn' },
  { file: 'MODEL.html',
    name: 'the needles are not painted on the face',
    find: "    window.DraftNorth.drawPair(fx, side / 2, side / 2 + NORTH_R * 0.4, NORTH_R, n, {\n",
    with: "    if (false) window.DraftNorth.drawPair(fx, side / 2, side / 2 + NORTH_R * 0.4, NORTH_R, n, {\n",
    test: 'the three chips stand in a row' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4543' } });
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
