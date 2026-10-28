#!/usr/bin/env node
// MUTATION GATE for a stair placed by hand (Movie, 25 Oct: "i can't insert a
// new set of stairs when i use the STAIR command button"; "give them a popup
// choice"; UP or DOWN, "yes B"; and Ctrl+C / Ctrl+V copy stairs, "yes"). Each
// row breaks one line, runs the one test that should notice, and restores
// from HEAD.
//
//   node proto/stair-hand-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-hand.spec.js';

const MUTANTS = [
  { file: 'model/16-gestures-undo.js',
    name: 'the STAIR press places nothing again',
    find: "    if (activeTool === 'stair') { stairHandPress(at); return; }\n",
    with: "    if (activeTool === 'stair') { return; }\n",
    test: 'two presses place a straight flight' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'its well is not cut',
    find: "    const cut = buildStairOpenings(others);\n",
    with: "    const cut = { cut: 0, refused: [], nudges: [], placed: [] };\n",
    test: 'two presses place a straight flight' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'UP is filed on the floor in view',
    find: "    if (here === 1) return ids.length ? ids[0] : null;\n    const i = ids.indexOf(here);\n    return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;\n",
    with: "    return ids.includes(here) ? here : null;\n",
    test: 'UP FROM HERE' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the popup\'s turn is not what is placed',
    find: "      at: stairHand.at, toward, layout: ready.layout, shape: stairHand.shape, turn: stairHand.turn,\n",
    with: "      at: stairHand.at, toward, layout: ready.layout, shape: stairHand.shape, turn: 'right',\n",
    test: 'TURN LEFT are what is placed' },
  { file: 'model/16-gestures-undo.js',
    name: 'Esc keeps the stair in hand',
    find: "    if (stairHand.at) { stairHand.at = null; syncStairPick(); }\n",
    with: "",
    test: 'Esc puts the stair in hand down' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'UNDO leaves its well behind',
    find: "      items: [{ list: drawing.stairs, item: stair }, ...cut.placed, ...framed.placed], restored: [] });\n",
    with: "      items: [{ list: drawing.stairs, item: stair }, ...framed.placed], restored: [] });\n",
    test: 'one UNDO takes the stair and its well back' },
  { file: 'model/08-structure-roof.js',
    name: 'a stair is not copied again',
    find: "  const NOT_COPIED = new Set(['roomtag', 'note']);\n",
    with: "  const NOT_COPIED = new Set(['stair', 'roomtag', 'note']);\n",
    test: 'Ctrl+C and Ctrl+V copy a stair' },
  { file: 'model/08-structure-roof.js',
    name: 'the pasted stair lands on the original',
    find: "        copy.start = { ...copy.start, x: copy.start.x + side.x, z: copy.start.z + side.z };\n",
    with: "",
    test: 'Ctrl+C and Ctrl+V copy a stair' },
  { file: 'model/08-structure-roof.js',
    name: 'the pasted stair gets no well',
    find: "      stairBuilt.push(...buildStairOpenings(served).placed, ...placeStairSideFraming(pastedStairs).placed);\n",
    with: "",
    test: 'Ctrl+C and Ctrl+V copy a stair' },
];


const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4566' } });
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
