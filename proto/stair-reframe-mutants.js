#!/usr/bin/env node
// MUTATION GATE for the stair framed again after a move or a turn, and the
// MOVE verb sliding a door (tests/stair-reframe.spec.js, and the MOVE test in
// tests/model-html-fenestration.spec.js).
//
// Movie, 19 Oct: "is there a way to regenerate the beam after the stairs
// move" -- "the short ends won't need beams ever ... only the long end needs a
// beam on side that span 10 ft or more" -- "i'm trying to select and then MOVE
// the door to SLIDE it on the wall, but it isn't moving".
//
// Run: node proto/stair-reframe-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-reframe.spec.js tests/model-html-fenestration.spec.js';
const TURNED = 'turned to lie with the joists, the stair keeps no side beam; one UNDO brings it back';
const HALF = 'turned end for end, the beam goes on the open side, never where the wall carries it';
const SLID = 'slid and let go, the stair is framed again where it landed, in the same UNDO';
const DOOR = 'MOVE in the foot slides a selected opening along its wall, and one UNDO puts it back';
const MUTANTS = [
  { file: 'MODEL.html', name: 'a run with the joists still takes a side beam',
    find: "    if (joist && (Math.abs(u.x) >= Math.abs(u.z) ? 'x' : 'z') === joist) return [];\n",
    with: "",
    test: TURNED },
  { file: 'MODEL.html', name: 'the joists are read along the beams, not across them',
    find: "    if (joist && (Math.abs(u.x) >= Math.abs(u.z) ? 'x' : 'z') === joist) return [];\n",
    with: "    if (joist && (Math.abs(u.x) >= Math.abs(u.z) ? 'x' : 'z') !== joist) return [];\n",
    test: TURNED },
  { file: 'MODEL.html', name: 'a turn is not framed again (the framing rides it)',
    find: "    const reframed = entries.filter(entry => entry.type === 'stair').map(({ item }) => reframeStair(item));\n",
    with: "    const reframed = [];\n",
    test: HALF },
  { file: 'MODEL.html', name: 'the re-frame is an UNDO of its own after a turn',
    find: "    undoStack.push(steps.length ? { kind: 'batch', steps: [turn, ...steps] } : turn);\n",
    with: "    undoStack.push(turn, ...steps);\n",
    test: TURNED },
  { file: 'MODEL.html', name: 'a slide is not framed again (the framing rides it)',
    find: "            const reframed = [reframeStair(md.stair)];\n",
    with: "            const reframed = [{ steps: [], beams: 0, before: 0 }];\n",
    test: SLID },
  { file: 'MODEL.html', name: 'the old framing stays when the new is laid',
    find: "        if (index < 0) return;\n        list.splice(index, 1);\n        removed.push({ list, index, item });\n",
    with: "        if (index < 0) return;\n        removed.push({ list, index, item });\n",
    test: TURNED },
  { file: 'MODEL.html', name: 'MOVE carries a door as a selection with no points',
    find: "      if (host) {\n        moveState.drag = { kind: 'opening', at, opening: lone, host, was: lone.offset, moved: false };\n",
    with: "      if (false) {\n        moveState.drag = { kind: 'opening', at, opening: lone, host, was: lone.offset, moved: false };\n",
    test: DOOR },
  { file: 'MODEL.html', name: 'MOVE takes the door with the pointer, not along the wall',
    find: "      const along = d.was + (dx * wx + dz * wz) / length;\n",
    with: "      const along = d.was + Math.hypot(dx, dz);\n",
    test: DOOR },
  { file: 'MODEL.html', name: 'a door slid by MOVE has no UNDO',
    find: "        undoStack.push(foldRedim({ kind: 'move-opening', opening: d.opening, was: d.was }));\n        markDirty();\n        sayOnStrip('Slid along its wall. UNDO puts it back.');\n",
    with: "        markDirty();\n        sayOnStrip('Slid along its wall. UNDO puts it back.');\n",
    test: DOOR },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4456' } });
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
