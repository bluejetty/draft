#!/usr/bin/env node
// MUTATION GATE for EXTEND on a roof edge and the T-square on a roof's MOVE
// (tests/roof-extend.spec.js).
//
// Movie, 28 Oct: "extend the roof to the edge of the wall" -- "the edge of
// the roof that i select" -- and "the T isn't engaging for when i move the
// roof".
//
// Run: node proto/roof-extend-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/roof-extend.spec.js';

const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js',
    name: 'EXTEND on a roof edge does nothing, as before',
    find: "    if (roofHit) { roofExtendPress(roofHit); return; }\n",
    with: "",
    test: 'EXTEND on a roof edge slides it straight out' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the farthest edge ahead, not the nearest',
    find: "      if (best == null || Math.abs(d) < Math.abs(best)) best = d;\n",
    with: "      if (best == null || Math.abs(d) > Math.abs(best)) best = d;\n",
    test: 'EXTEND on a roof edge slides it straight out' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the ROOF plan\'s wall tops are not edges to reach',
    find: "    if (!standing.length && activeLevelId() === ROOF_LEVEL_ID && G.roofPlanWalls && drawing) {\n",
    with: "    if (false) {\n",
    test: 'EXTEND reaches the wall tops the ROOF plan draws' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'an EXTEND is no UNDO step',
    find: "    undoStack.push({ kind: 'props', edits: [{ item: roof, before }] });\n    markDirty();\n    sayOnStrip(`ROOF EDGE",
    with: "    markDirty();\n    sayOnStrip(`ROOF EDGE",
    test: 'EXTEND on a roof edge slides it straight out' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'the T-square does not hold a roof corner square',
    find: "    const squareMove = tsquareLive() && (d.kind === 'roof' || d.kind === 'nodes' || d.kind === 'node');\n",
    with: "    const squareMove = false;\n",
    test: 'T-square lit: a roof corner dragged with MOVE goes straight across' },
  { file: 'model/07-walls-magnet.js',
    name: 'the ROOF plan\'s wall tops have no faces to land on, as before',
    find: "    const segs = own.length ? own : (activeLevelId() === ROOF_LEVEL_ID && G.roofPlanWalls\n",
    with: "    const segs = own.length ? own : (false && G.roofPlanWalls\n",
    test: 'on the ROOF plan a line drawn beside a wall top lands on its face' },
  { file: 'model/07-walls-magnet.js',
    name: 'a line crossing a wall top makes no corner',
    find: "    const tops = walls().length ? [] : wallFaceSegs().map(f => ({ start: f.a, end: f.b }));\n",
    with: "    const tops = [];\n",
    test: 'on the ROOF plan a line crossing a wall top gives a corner' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4804' } });
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
