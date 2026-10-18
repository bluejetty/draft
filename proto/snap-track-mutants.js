#!/usr/bin/env node
// MUTATION GATE for SNAP and TRACK (tests/snap-track.spec.js).
//
// Movie, 17 Oct: "when i draw a LINE or a WALL, see those nodes ... glow
// orange ... within an 4" dia 2" radius lets try make the point go righton the
// other node" -- "i want to be able to 'snap' on the cross lines yes so i can
// easily connect back to a node perpendicular" -- "have them ON default yes".
// The bullseye's 2.5 ft pull on an empty drawing only, no drag-to-draw on a
// mouse, and ENTER placing the point the cursor shows.
//
// Run: node proto/snap-track-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/snap-track.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the node snap reaches nowhere',
    find: "    const r = Math.max(NODE_SNAP_FT, NODE_SNAP_PX / view.scale);\n",
    with: "    const r = 0;\n",
    test: 'SNAP: a press near a wall end lands exactly on it, and the orange donut marks it first' },
  { file: 'MODEL.html',
    name: 'the press never asks SNAP or TRACK',
    find: "    const snap = !fixed && board !== 'toy' ? drawSnap(wanted) : {};\n",
    with: "    const snap = {};\n",
    test: 'TRACK: a press near the line square to a node lands on it' },
  { file: 'MODEL.html',
    name: 'SNAP switched off still snaps',
    find: "    if (snapOn) {\n      const node = snapNodeAt(at);\n",
    with: "    if (true) {\n      const node = snapNodeAt(at);\n",
    test: 'switched off, they leave the press where it was' },
  { file: 'MODEL.html',
    name: 'TRACK switched off still pulls to the plumb line',
    find: "    if (trackOn) {\n      const reach = RAY_HIT_PX / view.scale;\n",
    with: "    if (true) {\n      const reach = RAY_HIT_PX / view.scale;\n",
    test: 'switched off, they leave the press where it was' },
  { file: 'MODEL.html',
    name: 'TRACK reaches nowhere',
    find: "      const reach = RAY_HIT_PX / view.scale;\n",
    with: "      const reach = 0;\n",
    test: 'TRACK: a press near the line square to a node lands on it' },
  { file: 'MODEL.html',
    name: 'the bullseye pulls once there is a wall too',
    find: "      if (!drawStart && levelIsEmpty()) {\n",
    with: "      if (!drawStart) {\n",
    test: 'the bullseye pulls the first point from 2.5 ft on an empty drawing, and not once there is a wall' },
  { file: 'MODEL.html',
    name: 'the bullseye does not pull',
    find: "        if (b && Math.hypot(b.x - at.x, b.z - at.z) <= BULLSEYE_PULL_FT) return",
    with: "        if (b && Math.hypot(b.x - at.x, b.z - at.z) <= 0) return",
    test: 'the bullseye pulls the first point from 2.5 ft on an empty drawing, and not once there is a wall' },
  { file: 'MODEL.html',
    name: 'the orange donut is never marked',
    find: "      canvas.setAttribute('data-snap-node', ",
    with: "      canvas.removeAttribute('data-snap-node', ",
    test: 'SNAP: a press near a wall end lands exactly on it, and the orange donut marks it first' },
  { file: 'MODEL.html',
    name: 'a mouse lift places a wall again',
    find: "    if (!press.touch) return;\n",
    with: "",
    test: 'a mouse press-drag-release places no wall; click, choose, click does' },
  { file: 'MODEL.html',
    name: "ENTER does not place the run's point",
    find: "    if (drawsRun() && drawStart) { drawPress(cursorWorld); return true; }\n",
    with: "",
    test: 'ENTER places the point the cursor shows, as a click would' },
  { file: 'MODEL.html',
    name: 'SNAP starts dark',
    find: "  let snapOn = stored.snapLight !== false;\n",
    with: "  let snapOn = stored.snapLight === true;\n",
    test: 'SNAP and TRACK stand in the instrument strip, lit by default' },
  { file: 'MODEL.html',
    name: 'TRACK starts dark',
    find: "  let trackOn = stored.trackLight !== false;\n",
    with: "  let trackOn = stored.trackLight === true;\n",
    test: 'SNAP and TRACK stand in the instrument strip, lit by default' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4472' } });
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
