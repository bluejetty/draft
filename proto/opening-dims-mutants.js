#!/usr/bin/env node
// MUTATION GATE for the door and window dot as a dimension point, the strings
// that follow an opening live while it slides, and the size boxes reading
// feet first (tests/opening-dims.spec.js, and the feet-first test in
// tests/model-html-fenestration.spec.js).
//
// Movie, 20 Oct: "can you make that round dot in the middle SNAPABLE point
// ORANGE for the dimensions to link onto and if i move that can the dimension
// move with it ... autoupdate those fenstration dimensions immediately" --
// "make it the same format as th other ones where it 1-6 or 0-18 would be the
// same. (would need to type feet first before inches)" -- "when i move the
// line it doesn't allow me to enter the LENGTH textbox" -- "when i grab an
// enpoint NODE, i'd like to move it over 1/16" by typing into the length box".
//
// Run: node proto/opening-dims-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/opening-dims.spec.js tests/model-html-fenestration.spec.js tests/typed-drag.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'a SELECT drag takes no typed length',
    find: "        moveTyped = !offered && board !== 'toy' && !md.loose && !(md.lockBefore && md.lockBefore.length) && !master\n",
    with: "        moveTyped = false && !md.loose && !master\n",
    test: 'a line dragged by its body, then a typed length' },
  { file: 'MODEL.html', name: 'an end node takes no typed length',
    find: "          && (md.kind === 'wall' || md.kind === 'group' || md.kind === 'corner') && Math.hypot(ddx, ddz) > 1e-6\n",
    with: "          && (md.kind === 'wall' || md.kind === 'group') && Math.hypot(ddx, ddz) > 1e-6\n",
    test: 'an end NODE dragged a hair' },
  { file: 'MODEL.html', name: 'the typed length stacks a second step on the drag',
    find: "    undoOnce();\n    m.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });\n    m.before.forEach(b => relinkVertex(b.vtx));\n",
    with: "    m.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });\n    m.before.forEach(b => relinkVertex(b.vtx));\n",
    test: 'a line dragged by its body, then a typed length' },
  { file: 'MODEL.html', name: 'another tool leaves the box on the last drag',
    find: "  toolListeners.push(() => { if (moveTyped) { moveTyped = null; stripRefresh(); } });\n",
    with: "",
    test: 'another tool put in hand ends it' },
  { file: 'MODEL.html', name: 'the dot takes no dimension',
    find: "    if (dot) return { x: dot.c.x, z: dot.c.z, ref: { openingId: String(dot.opening.id), x: dot.c.x, z: dot.c.z } };\n",
    with: "",
    test: "a dimension put on the door's dot is linked to it, and follows the door when it is slid" },
  { file: 'MODEL.html', name: 'a dimension on the dot stays where the door was',
    find: "    const refPoint = ref => (ref.openingId != null\n",
    with: "    const refPoint = ref => (false\n",
    test: "a dimension put on the door's dot is linked to it, and follows the door when it is slid" },
  { file: 'drawing-format.js', name: 'the file forgets which opening a dimension is on',
    find: "        if (String(r.openingId ?? '').trim()) return { openingId: String(r.openingId).trim(), x: Number(r.x), z: Number(r.z) };\n",
    with: "",
    test: "a dimension put on the door's dot is linked to it, and follows the door when it is slid" },
  { file: 'MODEL.html', name: 'the strings wait for the release',
    find: "          if (clamped && clamped.offset !== md.opening.offset) {\n            md.opening.offset = clamped.offset;\n            liveRedimStep(md.live);\n",
    with: "          if (clamped && clamped.offset !== md.opening.offset) {\n            md.opening.offset = clamped.offset;\n",
    test: 'with AUTO DIMS on the plan, the strings follow the door while it is being slid, and one UNDO puts them back' },
  { file: 'MODEL.html', name: 'UNDO brings back the strings the hand passed through, not the ones before',
    find: "    const removed = live.before.filter(dim => !list.includes(dim));\n",
    with: "    const removed = [];\n",
    test: 'with AUTO DIMS on the plan, the strings follow the door while it is being slid, and one UNDO puts them back' },
  { file: 'MODEL.html', name: 'a bare number in a door box is inches again',
    find: "        || F.parseArchitecturalLength(input.value);\n",
    with: "        || (inches ? F.parseAssemblyInches : F.parseArchitecturalLength)(input.value);\n",
    test: 'door and window boxes read feet first' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4458' } });
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
