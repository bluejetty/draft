#!/usr/bin/env node
// MUTATION GATE for BREAK (tests/model-html-break.spec.js).
//
// Movie, 18 Oct: "place the BREAK command down near where UNDO COPY DELETE
// commands show up" -- "the BREAK can be used for making break in line wall,
// edge o f shape roof floor etc", "adding a new node", "just ad a node to the
// edge of the roof ... 'gable between 2 nodes" -- and "ASSEMBLY GROUP /
// ASSEMBLY BUST".
//
// Run: node proto/model-break-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-break.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: "BREAK never shows",
    find: "    breakButton.hidden = !able || !!rotateState?.open;\n",
    with: "    breakButton.hidden = true;\n",
    test: "a roof: BREAK adds nodes on the edge clicked, each half keeps its kind and overhang, and the wall line gains them too" },
  { file: 'MODEL.html', name: "a roof node's new edge is an eave whatever the edge was",
    find: "    roof.edges = [...kinds.slice(0, i + 1), kinds[i], ...kinds.slice(i + 1)];\n",
    with: "    roof.edges = [...kinds.slice(0, i + 1), 'eave', ...kinds.slice(i + 1)];\n",
    test: "a roof: BREAK adds nodes on the edge clicked, each half keeps its kind and overhang, and the wall line gains them too" },
  { file: 'MODEL.html', name: "the new edge loses its overhang",
    find: "    roof.edgeOverhang = [...overs.slice(0, i + 1), overs[i], ...overs.slice(i + 1)];\n",
    with: "    roof.edgeOverhang = [...overs.slice(0, i + 1), 0, ...overs.slice(i + 1)];\n",
    test: "a roof: BREAK adds nodes on the edge clicked, each half keeps its kind and overhang, and the wall line gains them too" },
  { file: 'MODEL.html', name: "the wall line does not gain the node",
    find: "      roof.footprint = [...foot.slice(0, i + 1), { x: a.x + ex * t, y, z: a.z + ez * t }, ...foot.slice(i + 1)];\n",
    with: "",
    test: "a roof: BREAK adds nodes on the edge clicked, each half keeps its kind and overhang, and the wall line gains them too" },
  { file: 'MODEL.html', name: "ENTER does not end it",
    find: "    if (event.key !== 'Enter' || !breakState.held) return;\n",
    with: "    if (true) return;\n",
    test: "a roof: BREAK adds nodes on the edge clicked, each half keeps its kind and overhang, and the wall line gains them too" },
  { file: 'MODEL.html', name: "a roof node takes no UNDO",
    find: "    undoStack.push({ kind: 'props', edits: [{ item, before }] });\n    markDirty();\n  };\n  const endBreak",
    with: "    markDirty();\n  };\n  const endBreak",
    test: "GABLE between two nodes gables that stretch only; one UNDO a node" },
  { file: 'MODEL.html', name: "the second half of a broken wall will not break again",
    find: "      breakState.pieces.push({ type: 'wall', item: tail });\n",
    with: "",
    test: "a wall: BREAK makes it two joined at the node, then three; UNDO joins them back" },
  { file: 'MODEL.html', name: "UNDO leaves the wall short",
    find: "        item.end = end;\n        before.forEach(b => { b.o.points = b.points; });\n",
    with: "        before.forEach(b => { b.o.points = b.points; });\n",
    test: "a wall: BREAK makes it two joined at the node, then three; UNDO joins them back" },
  { file: 'MODEL.html', name: "a line will not break",
    find: "    if (held.type === 'line') {\n",
    with: "    if (held.type === 'line' && false) {\n",
    test: "a line: BREAK makes two lines at the node" },
  { file: 'MODEL.html', name: "an assembly is not broken",
    find: "    ungroupSelected();\n    sayOnStrip(`ASSEMBLY BUST: broken into pieces",
    with: "    sayOnStrip(`ASSEMBLY BUST: broken into pieces",
    test: "an assembly selected: the foot button says BUST and busts it into its pieces; a roof's says BREAK" },
  { file: 'MODEL.html', name: "a piece of an assembly offers BREAK, not BUST",
    find: "    && !selectedGroups().length ? selection[0] : null);\n",
    with: "    ? selection[0] : null);\n",
    test: "an assembly selected: the foot button says BUST and busts it into its pieces; a roof's says BREAK" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4435' } });
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
