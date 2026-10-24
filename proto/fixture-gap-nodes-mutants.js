#!/usr/bin/env node
// MUTATION GATE for the half inch's corners as nodes and the lone SHIFT tap
// (Movie, 24 Oct): the corners where the faint lines meet, a wall's FACE put
// on one, a wall end there riding its fixture, a corner within an eighth of
// an inch winning over a stronger pull, and SHIFT once to break a corner.
// Each row breaks one line, runs the one test that should notice, and
// restores from HEAD.
//
//   node proto/fixture-gap-nodes-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/fixture-gap-nodes.spec.js';

const MUTANTS = [
  { file: 'fixture-geometry.js',
    name: 'a run kept tight gets a node between its pieces',
    find: "    if (!abuts(a0)) out.push({ ...geo.frame.at(a0 - g, geo.faceOff), end: -1 });\n",
    with: "    out.push({ ...geo.frame.at(a0 - g, geo.faceOff), end: -1 });\n",
    test: 'none where a run is tight' },
  { file: 'MODEL.html',
    name: 'the half-inch corners are no nodes to draw to',
    find: "    fixtureGapNodes().forEach(v => {\n",
    with: "    [].forEach(v => {\n",
    test: 'puts its FACE there' },
  { file: 'MODEL.html',
    name: 'a drawn wall keeps its middle on the corner',
    find: "    if (board !== 'toy') { faceOntoGap(wall, wall.start); faceOntoGap(wall, wall.end); }\n",
    with: "",
    test: 'puts its FACE there' },
  { file: 'MODEL.html',
    name: 'the face away from the fixture goes on the corner',
    find: "end: wall.end === vtx ? node : carry });\n      if (!frame) return null;\n      const toward = (geo.center.x - node.x) * frame.nx + (geo.center.z - node.z) * frame.nz;\n      const off = toward >= 0 ?",
    with: "end: wall.end === vtx ? node : carry });\n      if (!frame) return null;\n      const toward = (geo.center.x - node.x) * frame.nx + (geo.center.z - node.z) * frame.nz;\n      const off = toward < 0 ?",
    test: 'puts its FACE there' },
  { file: 'MODEL.html',
    name: 'a loose far end stays, and the wall leans',
    find: "    const carry = otherFrom || (looseEnd(other, wall) ? { x: other.x, z: other.z } : null);\n",
    with: "    const carry = otherFrom || null;\n",
    test: 'puts its FACE there' },
  { file: 'MODEL.html',
    name: 'a connected wall end stays behind when the fixture slides',
    find: "      l.vtx.x = c.x + (l.x - l.cx);\n",
    with: "      void c;\n",
    test: 'is connected' },
  { file: 'MODEL.html',
    name: 'UNDO of the slide leaves the carried wall end where it went',
    find: "            ? { kind: 'batch', steps: [step, { kind: 'move', before: md.links.map(({ vtx, x, z, offX, offZ }) => ({ vtx, x, z, offX, offZ })) }] }\n",
    with: "            ? step\n",
    test: 'is connected' },
  { file: 'MODEL.html',
    name: 'a corner dragged onto a half-inch corner keeps its middle there',
    find: "            const shift = faceOntoGap(own, grabbed.vtx, { otherFrom: md.faceFrom });\n",
    with: "            const shift = null;\n",
    test: 'loose wall\'s corner dragged' },
  { file: 'MODEL.html',
    name: 'UNDO of that drag leaves the far end stepped across',
    find: "...(md.follow || []), ...(md.faceBefore || [])],\n",
    with: "...(md.follow || [])],\n",
    test: 'loose wall\'s corner dragged' },
  { file: 'MODEL.html',
    name: 'the stronger pull wins even an eighth of an inch from a corner',
    find: "    return cornerUnderHand(at, nodes, corners)?.v || nearest(nodes)\n",
    with: "    return nearest(nodes)\n",
    test: 'within an eighth of an inch' },
  { file: 'MODEL.html',
    name: 'SHIFT held through a click counts as a tap',
    find: "  window.addEventListener('pointerdown', () => { if (shiftTap) shiftTap.clean = false; }, true);\n",
    with: "",
    test: 'Esc while the end is carried' },
  { file: 'MODEL.html',
    name: 'a lone SHIFT tap does nothing',
    find: "    if (activeTool !== RESTING_TOOL || moveDrag || board === 'toy' || modalUp()) return;\n",
    with: "    return;\n",
    test: 'one SHIFT tap' },
  { file: 'MODEL.html',
    name: 'Esc leaves the corner broken',
    find: "      if (md.body.start === f.vtx) md.body.start = shared[i].vtx;\n      if (md.body.end === f.vtx) md.body.end = shared[i].vtx;\n",
    with: "",
    test: 'Esc while the end is carried' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4545' } });
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
