#!/usr/bin/env node
// MUTATION GATE for ROTATE (tests/model-html-rotate.spec.js).
//
// Movie, 18 Oct: "i also need a ROTATE command (for items that are selected
// like the stiarcase which i'd like to rotate 90)", "with the DEL COPY ROTATE
// commands in that lower area", "in the photo popup area can we also add
// 'ROTATE'".
//
// Run: node proto/model-rotate-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-rotate.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'the bar does not cover the other verbs',
    find: '      [deleteButton, undoButton, copyButton, pasteButton].forEach(b => { if (b) b.hidden = true; });\n',
    with: '', test: 'a stair selected: ROTATE in the foot, its row over the verbs, a quarter turn clockwise on screen about its middle' },
  { file: 'MODEL.html', name: 'turned anticlockwise on screen',
    find: '      pt.x = cx + dx * cos - dz * sin;\n      pt.z = cz + dx * sin + dz * cos;\n',
    with: '      pt.x = cx + dx * cos + dz * sin;\n      pt.z = cz - dx * sin + dz * cos;\n', test: 'a stair selected: ROTATE in the foot, its row over the verbs, a quarter turn clockwise on screen about its middle' },
  { file: 'MODEL.html', name: 'turned about the origin, not its middle',
    find: '    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;\n',
    with: '    const cx = 0, cz = 0;\n', test: 'a stair selected: ROTATE in the foot, its row over the verbs, a quarter turn clockwise on screen about its middle' },
  { file: 'MODEL.html', name: 'a typed angle is ignored',
    find: '      rotateSelection(deg);\n      box.value = \'\';\n',
    with: "      box.value = '';\n", test: 'a typed angle, and one UNDO puts it back' },
  { file: 'MODEL.html', name: 'UNDO forgets the turn',
    find: "    undoStack.push({ kind: 'rotate', before, detached });\n",
    with: '', test: 'a typed angle, and one UNDO puts it back' },
  { file: 'MODEL.html', name: 'one wall of a WC turns alone',
    find: '      if (!owner || owner.fixed !== true) return;\n      itemsOfGroup(owner)',
    with: '      if (true) return;\n      itemsOfGroup(owner)', test: 'a WC turns whole, and lets go of the corner it shared with the house wall; UNDO joins it again' },
  { file: 'MODEL.html', name: 'the shared corner drags the house wall round',
    find: '        detached.push({ wall: item, key, orig: item[key] });\n        item[key] = { ...item[key] };\n',
    with: '', test: 'a WC turns whole, and lets go of the corner it shared with the house wall; UNDO joins it again' },
  { file: 'MODEL.html', name: 'the photo turns without swapping its sides',
    find: '    if (q % 2) { const w = underlay.widthFt; underlay.widthFt = underlay.heightFt; underlay.heightFt = w; }\n',
    with: '', test: "the PHOTO popup has ROTATE: a quarter turn, the picture's sides swapped; one in hand glows and turns from the foot" },
  { file: 'MODEL.html', name: 'no ROTATE in the photo popup',
    find: '      row.append(name, move, turn, del);\n',
    with: '      row.append(name, move, del);\n', test: "the PHOTO popup has ROTATE: a quarter turn, the picture's sides swapped; one in hand glows and turns from the foot" },
  { file: 'MODEL.html', name: 'the stair well stays behind',
    find: '    const turned = points.concat(wells);\n',
    with: '    const turned = points;\n', test: 'a stair turned takes its well with it; UNDO puts both back' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4434' } });
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
