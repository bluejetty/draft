#!/usr/bin/env node
// MUTATION GATE for the ROOF PIECE tool (jb, 13 Nov 2026: the HAND ROOF's
// own plane, drawn by hand): the DRAW A ROOF card's third option, and the
// only one on the ROOF plan; the outline closed, one press names the EAVE,
// the rest GABLE, an edge along another roof a JOINT; it bears on the storey
// below (or the top storey from the ROOF plan) and is a hand roof from birth.
//
// Run: node proto/roof-piece-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/roof-piece.spec.js'];
const MUTANTS = [
  { file: 'model/08-structure-roof.js', name: 'the pressed edge is ignored: edge 0 is always the eave', spec: 'tests/roof-piece.spec.js',
    find: "      if (i === eaveIndex) return 'eave';",
    with: "      if (i === 0) return 'eave';",
    test: 'on a storey the card offers the ROOF PIECE; outline, then the EAVE press, make a hand roof over the floor below' },
  { file: 'model/08-structure-roof.js', name: 'an edge along another roof is a GABLE, not a JOINT', spec: 'tests/roof-piece.spec.js',
    find: "      return pieceEdgeOnOtherRoof(p, ring[(i + 1) % ring.length]) ? 'joint' : 'gable';",
    with: "      return 'gable';",
    test: 'a second piece laid along the first gets a JOINT on the shared edge; the first is left as it was' },
  { file: 'model/08-structure-roof.js', name: 'a JOINT keeps the eave overhang', spec: 'tests/roof-piece.spec.js',
    find: "    const overs = edges.map(e => (e === 'joint' ? 0 : over));",
    with: "    const overs = edges.map(() => over);",
    test: 'a second piece laid along the first gets a JOINT on the shared edge; the first is left as it was' },
  { file: 'model/08-structure-roof.js', name: 'the closed outline makes the roof at once, nobody asked the eave', spec: 'tests/roof-piece.spec.js',
    find: "    if (s.kind === 'piece') return pieceOutlineDone(s);",
    with: "    if (s.kind === 'piece') { s.ring = s.corners.map(p => ({ x: p.x, z: p.z })); return commitPieceRoof(s, 0); }",
    test: 'on a storey the card offers the ROOF PIECE; outline, then the EAVE press, make a hand roof over the floor below' },
  { file: 'model/08-structure-roof.js', name: 'a press off every edge makes the roof anyway', spec: 'tests/roof-piece.spec.js',
    find: "    if (index == null) { sayOnStrip('Click ON one edge of the outline -- the EAVE, where the piece slopes down to.'); return; }",
    with: "    if (false) { sayOnStrip('Click ON one edge of the outline -- the EAVE, where the piece slopes down to.'); return; }",
    test: 'a press off every edge makes nothing; Escape puts the piece down; UNDO takes a made piece back' },
  { file: 'model/08-structure-roof.js', name: 'a piece drawn on a storey is not drawn on it (no drawnOn)', spec: 'tests/roof-piece.spec.js',
    find: "      ...(onStorey ? { drawnOn: Number(activeLevelId()) } : {}),",
    with: "      ...(false ? { drawnOn: Number(activeLevelId()) } : {}),",
    test: 'on a storey the card offers the ROOF PIECE; outline, then the EAVE press, make a hand roof over the floor below' },
  { file: 'model/08-structure-roof.js', name: 'a piece drawn on the ROOF plan is a lower roof drawn on it', spec: 'tests/roof-piece.spec.js',
    find: "    const onStorey = storeyHere();",
    with: "    const onStorey = true;",
    test: 'on the ROOF plan the card offers only the ROOF PIECE; it sits on the top storey with no storey of its own' },
  { file: 'model/08-structure-roof.js', name: 'from the ROOF plan the piece bears on the lowest storey', spec: 'tests/roof-piece.spec.js',
    find: "    return storeys.length ? storeys[storeys.length - 1].id : shedBearsOn();",
    with: "    return storeys.length ? storeys[0].id : shedBearsOn();",
    test: 'on the ROOF plan the card offers only the ROOF PIECE; it sits on the top storey with no storey of its own' },
  { file: 'model/08-structure-roof.js', name: 'the piece keeps following the PROJECT page', spec: 'tests/roof-piece.spec.js',
    find: "      garage: false,\n      follows: 'none',\n      layer: 'A-ROOF',\n    });\n    shedRoof = null;\n    markDirty();\n    setTool(RESTING_TOOL);\n    selectPlaced('roof', roof);\n    const joints",
    with: "      garage: false,\n      follows: 'house',\n      layer: 'A-ROOF',\n    });\n    shedRoof = null;\n    markDirty();\n    setTool(RESTING_TOOL);\n    selectPlaced('roof', roof);\n    const joints",
    test: 'on a storey the card offers the ROOF PIECE; outline, then the EAVE press, make a hand roof over the floor below' },
  { file: 'model/09-draw-move-stretch.js', name: 'the card does not open on the ROOF plan', spec: 'tests/roof-piece.spec.js',
    find: "    if (roofPickCard && (storeyHere() || onRoofPlan)) {",
    with: "    if (roofPickCard && storeyHere()) {",
    test: 'on the ROOF plan the card offers only the ROOF PIECE; it sits on the top storey with no storey of its own' },
  { file: 'model/09-draw-move-stretch.js', name: 'the single slope and gable roofs are offered on the ROOF plan too', spec: 'tests/roof-piece.spec.js',
    find: "        .forEach(button => { button.hidden = !storeyHere(); });",
    with: "        .forEach(button => { button.hidden = false; });",
    test: 'on the ROOF plan the card offers only the ROOF PIECE; it sits on the top storey with no storey of its own' },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4463' } });
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
