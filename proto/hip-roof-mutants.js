#!/usr/bin/env node
// MUTATION GATE for the HIP ROOF off the wall line (tests/hip-roof.spec.js).
//
// jb, 13 Nov 2026: "draw an outline and it will make a hip/pyramid style
// roof from it", "draw the line on the ext wall and make the roof create
// the desired overhang"; "HIP ROOF plus gable ends" on the card.
//
// Run: node proto/hip-roof-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

// EVERY ROW NAMES ITS SPEC AND ITS TEST AS LITERALS: mutant-anchors-harness reads
// the MUTANTS table on its own, with nothing else of this file defined.
const MUTANTS = [
  { file: 'model/08-structure-roof.js', name: 'the overhang is never added: the roof stands on the wall line', spec: 'tests/hip-roof.spec.js',
    find: "    const out = G.offsetOutlineVariable(s.wallRing, hipOvers(s));",
    with: "    const out = s.wallRing;",
    test: 'the wall outline, closed, then ENTER: a hip with the PROJECT overhang added outward, every edge an eave' },
  { file: 'model/08-structure-roof.js', name: 'the wall ring is not kept as the footprint', spec: 'tests/hip-roof.spec.js',
    find: "      footprint: s.wallRing.map(p => ({ x: p.x, y: 0, z: p.z })),\n      pitch,\n      fascia: ROOF_FASCIA_IN,\n      garage: false,\n      follows: 'none',\n      layer: 'A-ROOF',\n    });\n    shedRoof = null;\n    markDirty();\n    setTool(RESTING_TOOL);\n    selectPlaced('roof', roof);\n    const gables",
    with: "      pitch,\n      fascia: ROOF_FASCIA_IN,\n      garage: false,\n      follows: 'none',\n      layer: 'A-ROOF',\n    });\n    shedRoof = null;\n    markDirty();\n    setTool(RESTING_TOOL);\n    selectPlaced('roof', roof);\n    const gables",
    test: 'the wall outline, closed, then ENTER: a hip with the PROJECT overhang added outward, every edge an eave' },
  { file: 'model/08-structure-roof.js', name: 'ENTER at the gable question starts the outline over instead of finishing', spec: 'tests/hip-roof.spec.js',
    find: "    if (s.kind === 'hip') return s.stage === 'gables' ? commitHipRoof(s) : hipOutlineDone(s);",
    with: "    if (s.kind === 'hip') return hipOutlineDone(s);",
    test: 'the wall outline, closed, then ENTER: a hip with the PROJECT overhang added outward, every edge an eave' },
  { file: 'model/08-structure-roof.js', name: 'a press on an edge names no gable', spec: 'tests/hip-roof.spec.js',
    find: "    if (s.gables.has(index)) s.gables.delete(index); else s.gables.add(index);",
    with: "    if (false) s.gables.delete(index);",
    test: 'edges pressed are GABLE ends with the SIDE OVERHANG, pressed again eaves; ENTER keeps the last answer' },
  { file: 'model/08-structure-roof.js', name: 'a second press on a gable end never makes it an eave again', spec: 'tests/hip-roof.spec.js',
    find: "    if (s.gables.has(index)) s.gables.delete(index); else s.gables.add(index);",
    with: "    s.gables.add(index);",
    test: 'edges pressed are GABLE ends with the SIDE OVERHANG, pressed again eaves; ENTER keeps the last answer' },
  { file: 'model/08-structure-roof.js', name: 'a gable end takes the eave overhang, not the SIDE OVERHANG', spec: 'tests/hip-roof.spec.js',
    find: "    return s.wallRing.map((p, i) => (s.gables.has(i) ? gable : eave));",
    with: "    return s.wallRing.map(() => eave);",
    test: 'edges pressed are GABLE ends with the SIDE OVERHANG, pressed again eaves; ENTER keeps the last answer' },
  { file: 'model/08-structure-roof.js', name: 'the roof is filed with every edge an eave whatever was pressed', spec: 'tests/hip-roof.spec.js',
    find: "    const pressed = s.wallRing.map((p, i) => (s.gables.has(i) ? 'gable' : 'eave'));",
    with: "    const pressed = s.wallRing.map(() => 'eave');",
    test: 'edges pressed are GABLE ends with the SIDE OVERHANG, pressed again eaves; ENTER keeps the last answer' },
  { file: 'model/08-structure-roof.js', name: 'a press off every edge makes the roof anyway', spec: 'tests/hip-roof.spec.js',
    find: "    if (index == null) { sayOnStrip('Click ON an edge to make it a GABLE end, or ENTER to finish the hip roof.'); return; }",
    with: "    if (index == null) { commitHipRoof(s); return; }",
    test: 'on the ROOF plan the card offers the HIP ROOF beside the ROOF PIECE; a press off every edge makes nothing; Escape puts it down; UNDO takes it back' },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4468' } });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const SPECS = [...new Set(MUTANTS.map(m => m.spec))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`, { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}
{
  const clean = run(null, SPECS.join(' '));
  if (clean !== 'passed') {
    console.log('REFUSING TO RUN: the spec is already failing before any mutant is applied. Fix the spec first.');
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
