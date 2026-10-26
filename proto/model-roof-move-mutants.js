#!/usr/bin/env node
// MUTATION GATE for MOVE on a roof (tests/model-html-roof-move.spec.js).
//
// Movie, 18 Oct: "grab the edge of a roof ... MOVE ... pushed it over all the
// way to the left so there is no roof left it would just smooth out the roof
// to the main eave" -- "drag it down to where the main roof edge is and line
// them up" -- "SELECT just the NODE and i could either DELETE it or MOVE it".
//
// Run: node proto/model-roof-move-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-roof-move.spec.js';
const MUTANTS = [
  { file: 'model/09-draw-move-stretch.js', name: "the edge slides but its ends do not follow the neighbours",
    find: "    const na = lineMeet(a2, u, prev, along(prev, a)) || a2;\n",
    with: "    const na = a2;\n",
    test: "an edge beside a 45-degree corner: its end slides along the 45" },
  { file: 'model/09-draw-move-stretch.js', name: "nothing is tidied after an edge move",
    find: "      tidyRoof(roof, near);\n",
    with: "",
    test: "option 1: the jog's side pushed all the way across smooths it into the main eave; one UNDO" },
  { file: 'model/09-draw-move-stretch.js', name: "the wall line stays put under a moved edge",
    find: "        if (roof.footprint) roof.footprint = slideEdge(roof.footprint, i, dist);\n",
    with: "",
    test: "option 2: the jog's front dragged down onto the main eave line -- no node left over" },
  { file: 'model/09-draw-move-stretch.js', name: "a straight-on point of one kind is kept",
    find: "        if (back || sameKind) hit = i;\n",
    with: "        if (back) hit = i;\n",
    test: "option 2: the jog's front dragged down onto the main eave line -- no node left over" },
  { file: 'model/09-draw-move-stretch.js', name: "DELETE leaves the node",
    find: "    if (moveState?.node) { deleteRoofNode(); return 1; }\n",
    with: "",
    test: "a node dragged moves alone; a node clicked is picked and DELETE takes it out" },
  { file: 'model/09-draw-move-stretch.js', name: "a clicked node is never picked",
    find: "      moveState.node = d.node != null ? { roof: d.targets[0], list: [d.node] } : null;\n",
    with: "      moveState.node = null;\n",
    test: "a node dragged moves alone; a node clicked is picked and DELETE takes it out" },
  { file: 'model/09-draw-move-stretch.js', name: "inside the roof grabs nothing",
    find: "    const inside = node == null && edge == null && whole.some(rf => pointInRing(rf.points, at));\n",
    with: "    const inside = false;\n",
    test: "a drag inside the roof moves the whole roof" },
  // THE EDGE STOP AT 3" (Movie, 26 Oct, the one snap rule).
  { file: 'model/09-draw-move-stretch.js', name: "the edge stop catches from 8 px again",
    find: "        const catchFt = snapLive() && board !== 'toy' ? ROOF_EDGE_STOP_IN / 12 * snapStrength() : 0;\n",
    with: "        const catchFt = 8 / view.scale;\n",
    test: "the edge stop catches from 2 1/2\" short, not from 4\"" },
  { file: 'model/09-draw-move-stretch.js', name: "the edge stop catches nothing short of the corner",
    find: "  const ROOF_EDGE_STOP_IN = 3;\n",
    with: "  const ROOF_EDGE_STOP_IN = 0;\n",
    test: "the edge stop catches from 2 1/2\" short, not from 4\"" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4443' } });
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
