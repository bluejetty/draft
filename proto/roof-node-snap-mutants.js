#!/usr/bin/env node
// MUTATION GATE for roof corner drags on the ROOF plan (jb, 13 Nov 2026:
// "the node snaps don't seem to work when i adjust the roof"; "make that
// intersection like a node"; "something is still left behind" after a
// piece is deleted): the wall tops drawn on the ROOF plan are the drag's
// magnets, a roof edge crossing a wall face is a corner, 1 FT lands the
// corner on the foot, and a deleted piece leaves its assembly and turns the
// JOINT edges beside it to GABLE under one UNDO.
//
// Run: node proto/roof-node-snap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

// LITERALS IN THE TABLE, not constants: proto/mutant-anchors-harness.js reads
// the MUTANTS table on its own, with nothing else of this file defined.
const SPECS = ['tests/roof-node-snap.spec.js'];
const MUTANTS = [
  { file: 'model/07-walls-magnet.js', name: 'the wall tops are left out of the drag magnet', spec: 'tests/roof-node-snap.spec.js',
    find: "    const tops = roofPlanWallTops();\n    const stillWalls = [...walls(), ...tops].filter(stillRun);",
    with: "    const tops = [];\n    const stillWalls = [...walls(), ...tops].filter(stillRun);",
    test: 'a roof corner dragged on the ROOF plan lands on a wall top\'s corner' },
  { file: 'model/07-walls-magnet.js', name: 'the wall tops\' ends are not nodes', spec: 'tests/roof-node-snap.spec.js',
    find: "    return { nodes: [...nodeEnds({ faces: false }).filter(stillPt), ...topEnds],",
    with: "    return { nodes: [...nodeEnds({ faces: false }).filter(stillPt)],",
    test: 'a roof corner dragged on the ROOF plan lands on a wall top\'s corner' },
  { file: 'model/07-walls-magnet.js', name: 'a roof edge crossing a wall face is no corner', spec: 'tests/roof-node-snap.spec.js',
    find: "        ...(topFaces.length ? G.lineCrossings([...stillOthers, ...topFaces]) : [])],",
    with: "        ...[]],",
    test: 'where a roof edge crosses a wall\'s face is a node the corner lands on' },
  { file: 'model/07-walls-magnet.js', name: 'the tops are read on every level, not the ROOF plan only', spec: 'tests/roof-node-snap.spec.js',
    find: "    if (!drawing || !G?.roofPlanWalls || activeLevelId() !== ROOF_LEVEL_ID || walls().length) return [];",
    with: "    if (!drawing || !G?.roofPlanWalls) return [];",
    test: 'a roof corner dragged on the ROOF plan lands on a wall top\'s corner' },
  { file: 'model/09-draw-move-stretch.js', name: '1 FT is ignored on a roof corner', spec: 'tests/roof-node-snap.spec.js',
    find: "        const footed = pt => (footOn ? onTheFoot(own, { x: pt.x, z: pt.z }, 0) : pt);",
    with: "        const footed = pt => pt;",
    test: 'with 1 FT lit and nothing caught, the corner lands a whole foot out' },
  { file: 'model/09-draw-move-stretch.js', name: '1 FT is read from the drag start, not the corner', spec: 'tests/roof-node-snap.spec.js',
    find: "          to = snap ? { x: snap.x, z: snap.z } : (f => ({ x: f.x, z: f.z }))(footed(at));",
    with: "          to = snap ? { x: snap.x, z: snap.z } : at;",
    test: 'with 1 FT lit and nothing caught, the corner lands a whole foot out' },
  { file: 'model/08-structure-roof.js', name: 'a deleted piece stays in its assembly', spec: 'tests/roof-node-snap.spec.js',
    find: "    groups.forEach(g => { g.members = (g.members || []).filter(m => !(m && m.type === 'roof' && String(m.id) === String(roof.id))); });",
    with: "    groups.forEach(g => { g.members = (g.members || []); });",
    test: 'a deleted piece leaves the assembly and turns the JOINT edges beside it to GABLE; UNDO puts it all back' },
  { file: 'model/08-structure-roof.js', name: 'the JOINT edges beside a deleted piece stay joints', spec: 'tests/roof-node-snap.spec.js',
    find: "        if (alongGone(p, other.points[(i + 1) % other.points.length])) { edges[i] = 'gable'; turned += 1; }",
    with: "        if (false) { edges[i] = 'gable'; turned += 1; }",
    test: 'a deleted piece leaves the assembly and turns the JOINT edges beside it to GABLE; UNDO puts it all back' },
  { file: 'model/08-structure-roof.js', name: 'every JOINT anywhere turns, shared with the deleted piece or not', spec: 'tests/roof-node-snap.spec.js',
    find: "    const alongGone = (p, q) => ring.some((a, k) => {",
    with: "    const alongGone = (p, q) => true || ring.some((a, k) => {",
    test: 'a deleted piece leaves the assembly and turns the JOINT edges beside it to GABLE; UNDO puts it all back' },
  { file: 'model/08-structure-roof.js', name: 'UNDO brings the piece back but not its edges', spec: 'tests/roof-node-snap.spec.js',
    find: "      edits.forEach(({ item, before }) => { Object.keys(item).forEach(k => delete item[k]); Object.assign(item, before); });\n    } });\n    markDirty();\n    if (edits.length) {",
    with: "    } });\n    markDirty();\n    if (edits.length) {",
    test: 'a deleted piece leaves the assembly and turns the JOINT edges beside it to GABLE; UNDO puts it all back' },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4465' } });
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
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
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
