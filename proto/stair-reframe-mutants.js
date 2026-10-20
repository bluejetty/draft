#!/usr/bin/env node
// MUTATION GATE for the stair framed again after a move or a turn, and the
// MOVE verb sliding a door, and a fixture reaching from where it will stand
// (tests/stair-reframe.spec.js, the MOVE test in model-html-fenestration, the
// washer and dryer tests in model-html-fixture-tool).
//
// Movie, 19 Oct: "is there a way to regenerate the beam after the stairs
// move" -- "the short ends won't need beams ever ... only the long end needs a
// beam on side that span 10 ft or more" -- "i'm trying to select and then MOVE
// the door to SLIDE it on the wall, but it isn't moving" -- "i can't insert
// WASHER or DRYER - i need it for LAUNDRY" -- "the T SQUARE isn't keeping it
// at 90 degrees it is freemoving" -- "move exactly 12'1 down (at 90 with T on)
// but it won't allow me to enter a LENGTH" -- and the typed distance for doors,
// stairs and beam rows, and a stair asked again when its carrying beam moves.
//
// Run: node proto/stair-reframe-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-reframe.spec.js tests/model-html-fenestration.spec.js tests/model-html-fixture-tool.spec.js tests/move-tsquare.spec.js tests/beam-move.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'a typed distance does not re-frame the stair for the exact place',
    find: "    const settled = settleSelectionMove(m.set);\n    const steps = [m.moveStep, ...settled.steps];\n",
    with: "    const settled = { steps: [], said: '' };\n    const steps = [m.moveStep, ...settled.steps];\n",
    test: 'after a MOVE drag, a typed distance puts the stair exactly there and frames it there' },
  { file: 'MODEL.html', name: 'what the drag\'s release worked out is left standing under the typed one',
    find: "    after.slice().reverse().forEach(step => { undoStack.push(step); undoOnce(); });\n",
    with: "",
    test: 'after a MOVE drag, a typed distance puts the stair exactly there and frames it there' },
  { file: 'MODEL.html', name: 'a typed distance leaves a beam row unclipped',
    find: "    if (m.set.run) reclipRun(m.set.run);\n    m.set.wells.forEach(",
    with: "    m.set.wells.forEach(",
    test: 'after a MOVE drag, a typed distance puts the row exactly that far across' },
  { file: 'MODEL.html', name: 'a moved carrying beam never asks the stair beside it',
    find: "      ...(carrying ? reframeStairsOn([Number(set.run[0].levelId)], set.stairs || []) : [])];\n",
    with: "    ];\n",
    test: 'the carrying beam moved away, the stair takes a side beam where it lost one' },
  { file: 'MODEL.html', name: 'a deleted carrying beam never asks the stair beside it',
    find: "    const reframed = carriers.length ? reframeStairsOn(carriers, spare) : [];\n",
    with: "    const reframed = [];\n",
    test: 'the carrying beam deleted, the stair takes a side beam; its own beam deleted is left deleted' },
  { file: 'MODEL.html', name: 'a stair\'s own beam deleted by hand is put back',
    find: "    .filter(stair => !spare.includes(stair)\n",
    with: "    .filter(stair => true\n",
    test: 'the row and the stair\'s own beam deleted together: the stair is not re-framed' },
  { file: 'MODEL.html', name: 'a typed distance leaves the door where the slide did',
    find: "    undoOnce();\n    m.opening.offset = clamped.offset;\n",
    with: "    undoOnce();\n",
    test: 'after a MOVE slide, a typed distance puts the door exactly that far along' },
  { file: 'MODEL.html', name: 'the LENGTH box stays shut after a move',
    find: "    const moveTypable = moveTypedReady();\n",
    with: "    const moveTypable = false;\n",
    test: 'after a MOVE drag, a typed length moves it exactly that far the same way' },
  { file: 'MODEL.html', name: 'a typed length after a move is read as a wall length',
    find: "    if (moveTypedReady()) { moveByTyped(); return; }\n",
    with: "",
    test: 'after a MOVE drag, a typed length moves it exactly that far the same way' },
  { file: 'MODEL.html', name: 'the typed move adds to the drag instead of replacing it',
    find: "    m.set.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });\n    if (m.set.run) reclipRun(m.set.run);\n",
    with: "    m.set.before.forEach(b => { b.vtx.x += dx; b.vtx.z += dz; });\n    if (m.set.run) reclipRun(m.set.run);\n",
    test: 'after a MOVE drag, a typed length moves it exactly that far the same way' },
  { file: 'MODEL.html', name: 'MOVE goes free with the T-square lit',
    find: "      if (tsquareOn && board !== 'toy' && !d.set.across) {\n",
    with: "      if (false) {\n",
    test: 'MOVE with the T-square lit slides the assembly straight across, not with the hand' },
  { file: 'MODEL.html', name: 'an assembly dragged under SELECT goes free with the T-square lit',
    find: "          if (tsquareOn && board !== 'toy') { if (Math.abs(dx) >= Math.abs(dz)) dz = 0; else dx = 0; }\n",
    with: "",
    test: 'an assembly dragged under SELECT is held square too' },
  { file: 'MODEL.html', name: 'a fixture reaches only the 30px grab zone',
    find: "    const thresh = Math.max(FIXTURE_PICK_PX / view.scale, reachFt);\n",
    with: "    const thresh = FIXTURE_PICK_PX / view.scale;\n",
    test: 'a washer pressed where it will stand lands on the wall' },
  { file: 'MODEL.html', name: 'a run with the joists still takes a side beam',
    find: "    if (joist && (Math.abs(u.x) >= Math.abs(u.z) ? 'x' : 'z') === joist) return [];\n",
    with: "",
    test: 'a run with the joists, clear of every beam, takes no side beam' },
  { file: 'MODEL.html', name: 'the joists are read along the beams, not across them',
    find: "    if (joist && (Math.abs(u.x) >= Math.abs(u.z) ? 'x' : 'z') === joist) return [];\n",
    with: "    if (joist && (Math.abs(u.x) >= Math.abs(u.z) ? 'x' : 'z') !== joist) return [];\n",
    test: 'turned to lie with the joists, the stair keeps no side beam; one UNDO brings it back' },
  { file: 'MODEL.html', name: 'a turn is not framed again (the framing rides it)',
    find: "    const reframed = entries.filter(entry => entry.type === 'stair').map(({ item }) => reframeStair(item));\n",
    with: "    const reframed = [];\n",
    test: 'turned end for end, the beam goes on the open side, never where the wall carries it' },
  { file: 'MODEL.html', name: 'the re-frame is an UNDO of its own after a turn',
    find: "    undoStack.push(steps.length ? { kind: 'batch', steps: [turn, ...steps] } : turn);\n",
    with: "    undoStack.push(turn, ...steps);\n",
    test: 'turned to lie with the joists, the stair keeps no side beam; one UNDO brings it back' },
  { file: 'MODEL.html', name: 'a slide is not framed again (the framing rides it)',
    find: "            const reframed = [reframeStair(md.stair)];\n",
    with: "            const reframed = [{ steps: [], beams: 0, before: 0 }];\n",
    test: 'slid and let go, the stair is framed again where it landed, in the same UNDO' },
  { file: 'MODEL.html', name: 'the old framing stays when the new is laid',
    find: "        const index = list.indexOf(item);\n        if (index < 0) return;\n        list.splice(index, 1);\n        removed.push({ list, index, item });\n      });\n    });\n    const framed = placeStairSideFraming([stair]);\n",
    with: "        const index = list.indexOf(item);\n        if (index < 0) return;\n        removed.push({ list, index, item });\n      });\n    });\n    const framed = placeStairSideFraming([stair]);\n",
    test: 'turned to lie with the joists, the stair keeps no side beam; one UNDO brings it back' },
  { file: 'MODEL.html', name: 'MOVE carries a door as a selection with no points',
    find: "      if (host) {\n        moveState.drag = { kind: 'opening', at, opening: lone, host, was: lone.offset, moved: false,\n",
    with: "      if (false) {\n        moveState.drag = { kind: 'opening', at, opening: lone, host, was: lone.offset, moved: false,\n",
    test: 'MOVE in the foot slides a selected opening along its wall, and one UNDO puts it back' },
  { file: 'MODEL.html', name: 'MOVE takes the door with the pointer, not along the wall',
    find: "      const along = d.was + (dx * wx + dz * wz) / length;\n",
    with: "      const along = d.was + Math.hypot(dx, dz);\n",
    test: 'MOVE in the foot slides a selected opening along its wall, and one UNDO puts it back' },
  { file: 'MODEL.html', name: 'a door slid by MOVE has no UNDO',
    find: "        undoStack.push(liveRedimFold({ kind: 'move-opening', opening: d.opening, was: d.was }, d.live));\n        // AND A TYPED DISTANCE",
    with: "        // AND A TYPED DISTANCE",
    test: 'MOVE in the foot slides a selected opening along its wall, and one UNDO puts it back' },
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
