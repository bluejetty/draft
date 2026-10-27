#!/usr/bin/env node
// MUTATION GATE for game/ -- TOY, the game, step 1 (tests/toy-game.spec.js).
//
// Movie, 27 Oct: "make a very simplistic GAME version of this programs" --
// "if they create a house in the TOY MODE 'game' they can bring it over to
// this program and do more detailed work if they want".
//
// Run: node proto/toy-game-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/toy-game.spec.js';

const MUTANTS = [
  { file: 'game/toy-game.js',
    name: 'a run is not rounded to the whole foot',
    find: "      const feet = Math.max(1, Math.round(Math.abs(dx)));\n",
    with: "      const feet = Math.max(1, Math.abs(dx));\n",
    test: 'every wall lands square and a whole foot long, and pressing the start closes the run' },
  { file: 'game/toy-game.js',
    name: 'a run rounded below a foot is a wall of no length',
    find: "      const feet = Math.max(1, Math.round(Math.abs(dx)));\n",
    with: "      const feet = Math.round(Math.abs(dx));\n",
    test: 'every wall lands square and a whole foot long, and pressing the start closes the run' },
  { file: 'game/toy-game.js',
    name: 'the run never turns: every wall runs across',
    find: "    if (Math.abs(dx) >= Math.abs(dz)) {\n",
    with: "    if (true) {\n",
    test: 'every wall lands square and a whole foot long, and pressing the start closes the run' },
  { file: 'game/toy-game.js',
    name: 'pressing the start does not close the run',
    find: "    if (same(point, runStart)) { say('Closed'); endRun(); return; }\n",
    with: "",
    test: 'every wall lands square and a whole foot long, and pressing the start closes the run' },
  { file: 'game/toy-game.js',
    name: 'the browser does not keep the house',
    find: "  const change = next => { history.push(walls); walls = next; keep(); };\n",
    with: "  const change = next => { history.push(walls); walls = next; };\n",
    test: 'UNDO takes back the last wall, and the house is still there after a reload' },
  { file: 'game/toy-game.js',
    name: 'the walls are written on the wrong storey',
    find: "    id: `toy-${nextId++}`, levelId: MAIN_FL, view: 'plan',\n",
    with: "    id: `toy-${nextId++}`, levelId: 5, view: 'plan',\n",
    test: 'SAVE writes a .draft that MODEL opens, with the walls where the game drew them' },
  { file: 'game/toy-game.js',
    name: 'the file does not say it came from TOY',
    find: "    version: 1, planTurn: 0, board: FORMAT.board('toy'),\n",
    with: "    version: 1, planTurn: 0, board: null,\n",
    test: 'SAVE writes a .draft that MODEL opens, with the walls where the game drew them' },
  { file: 'game/toy-game.js',
    name: "OPEN takes every storey's walls onto MAIN FL",
    find: "    const mine = all.filter(wall => Number(wall.levelId) === MAIN_FL\n      && ",
    with: "    const mine = all.filter(wall => ",
    test: 'OPEN reads a saved house back in' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4795' } });
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
