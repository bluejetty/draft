#!/usr/bin/env node
// MUTATION GATE for FLIP (tests/model-html-flip.spec.js).
//
// Movie, 20 Oct: "i need another option down there for FLIP beside rotate
// and move". Seven seams: no mirror, mirrored about the origin, the wall's
// line not swapped, the fixture staying on its face, the door's swing kept,
// the stair's turn kept, and UNDO forgetting the swaps.
//
// Run: node proto/model-flip-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-flip.spec.js';

const MUTANTS = [
  { file: 'model/09-draw-move-stretch.js', name: 'nothing is mirrored',
    find: "    const mirror = pt => { pt[axis] = 2 * mid - pt[axis]; };\n",
    with: "    const mirror = pt => { pt[axis] = pt[axis]; };\n",
    test: 'a WC selected: FLIP in the foot beside ROTATE, its row over the verbs; left for right mirrors it whole about its middle and swaps every side' },
  { file: 'model/09-draw-move-stretch.js', name: 'mirrored about the origin, not its middle',
    find: "    const mid = (Math.min(...vals) + Math.max(...vals)) / 2;\n",
    with: "    const mid = 0;\n",
    test: 'top for bottom, and one UNDO puts the lot back' },
  { file: 'model/09-draw-move-stretch.js', name: 'the wall keeps its line',
    find: "      w.refLine = w.refLine === 'left' ? 'right' : 'left';\n",
    with: "",
    test: 'a WC selected: FLIP in the foot beside ROTATE, its row over the verbs; left for right mirrors it whole about its middle and swaps every side' },
  { file: 'model/09-draw-move-stretch.js', name: 'the fixture stays on its face',
    find: "      f.side = f.side === -1 ? 1 : -1;\n",
    with: "",
    test: 'a WC selected: FLIP in the foot beside ROTATE, its row over the verbs; left for right mirrors it whole about its middle and swaps every side' },
  { file: 'model/09-draw-move-stretch.js', name: 'the door keeps its swing',
    find: "      edits.push({ item: o, before: { ...o } });\n      o.swingFlip = o.swingFlip !== true;\n",
    with: "      edits.push({ item: o, before: { ...o } });\n",
    test: 'a WC selected: FLIP in the foot beside ROTATE, its row over the verbs; left for right mirrors it whole about its middle and swaps every side' },
  { file: 'model/09-draw-move-stretch.js', name: 'the stair keeps its turn',
    find: "      item.turn = item.turn === 'left' ? 'right' : 'left';\n",
    with: "",
    test: 'a stair flipped end for end turns the other way' },
  { file: 'model/09-draw-move-stretch.js', name: 'UNDO forgets the swaps',
    find: "    const steps = [flipped, ...(edits.length ? [{ kind: 'props', edits }] : []), ...reframed.flatMap(r => r.steps)];\n",
    with: "    const steps = [flipped, ...reframed.flatMap(r => r.steps)];\n",
    test: 'top for bottom, and one UNDO puts the lot back' },
  { file: 'shell-bars.js', name: 'crowded, the verbs keep their full size and land on the BONE',
    find: "    for (const stage of ['1', '2']) {\n      if (width <= room) break;\n      box.dataset.tight = stage;\n      width = box.getBoundingClientRect().width;\n    }\n",
    with: "",
    test: 'crowded, the verbs draw in and leave the BONE clear' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4494' } });
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
