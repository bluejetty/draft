#!/usr/bin/env node
// MUTATION GATE for BUST ROOF (jb, 13 Nov 2026: "would it be possible to
// BUST it in to peices" -- "Y for bust yes please"): the panel button and the
// Y key cut a roof into one piece per plane, in one assembly, with one UNDO;
// a piece's JOINT edges survive the file and a ROOF press; a corner dragged
// on one piece takes the pieces beside it along; a typed FASCIA, IN stays on the
// roof and the elevation hangs that board.
//
// Run: node proto/roof-bust-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/roof-bust.spec.js'];
const MUTANTS = [
  { file: 'model/15-panels.js', name: 'the bust leaves no UNDO step', spec: 'tests/roof-bust.spec.js',
    find: "    undoStack.push({ kind: 'assembly', undo: () => {\n      done.slice().reverse()",
    with: "    void ({ kind: 'assembly', undo: () => {\n      done.slice().reverse()",
    test: 'UNDO joins the roof back, grouping and all' },
  { file: 'model/15-panels.js', name: 'the pieces are not held in an assembly', spec: 'tests/roof-bust.spec.js',
    find: "      drawing.groups.push({ id: `group-${n}`, name: `ROOF PIECES ${n}`, fixed: false,",
    with: "      void ({ id: `group-${n}`, name: `ROOF PIECES ${n}`, fixed: false,",
    test: 'BUST ROOF cuts the jog roof into one piece per plane, held as one assembly' },
  { file: 'model/15-panels.js', name: 'the pieces keep following the PROJECT page', spec: 'tests/roof-bust.spec.js',
    find: "      const items = pieces.map(piece => ({ ...piece, id: freshId() }));",
    with: "      const items = pieces.map(piece => ({ ...piece, id: freshId(), follows: 'house' }));",
    test: 'BUST ROOF cuts the jog roof into one piece per plane, held as one assembly' },
  { file: 'model/14-promotion-tools.js', name: 'Y arms ASSEMBLY instead of busting a loose roof', spec: 'tests/roof-bust.spec.js',
    find: "    if (selection.every(entry => entry.type === 'roof' && !groupOf(entry))) {\n      bustRoofs(selection.map(entry => entry.item));",
    with: "    if (false) {\n      bustRoofs(selection.map(entry => entry.item));",
    test: 'Y on a picked roof busts it; Y again busts the assembly it made' },
  { file: 'model/09-draw-move-stretch.js', name: 'a dragged corner leaves the pieces beside it behind', spec: 'tests/roof-bust.spec.js',
    find: "    riders.forEach(r => { if (!targets.includes(r.roof)) { normaliseForMove(r.roof); targets.push(r.roof); } });",
    with: "    riders.length = 0;",
    test: 'a ridge corner dragged on one piece takes the same corner of its neighbours along' },
  { file: 'model/08-structure-roof.js', name: 'a ROOF press flips a JOINT to a GABLE', spec: 'tests/roof-bust.spec.js',
    find: "    if (hit.roof.edges[hit.index] === 'joint') {",
    with: "    if (false) {",
    test: "a piece's JOINT edge is named on the panel and a ROOF press does not flip it" },
  { file: 'drawing-format.js', name: 'the reader drops JOINT back to EAVE', spec: 'tests/roof-bust.spec.js',
    find: "            && (roof.edges[index] === 'gable' || roof.edges[index] === 'sloped' || roof.edges[index] === 'joint')",
    with: "            && (roof.edges[index] === 'gable' || roof.edges[index] === 'sloped')",
    test: 'BUST ROOF cuts the jog roof into one piece per plane, held as one assembly' },
  { file: 'geometry-2d.js', name: 'a JOINT moves like an eave, so a piece solves as a hip of its own', spec: 'tests/roof-bust.spec.js',
    find: "  const isSolidEdge = kind => kind === 'gable' || kind === 'joint';",
    with: "  const isSolidEdge = kind => kind === 'gable';",
    test: "the pieces stand exactly where the roof's planes stood" },
  { file: 'drawing-format.js', name: 'the reader puts the standard board back on every roof', spec: 'tests/roof-bust.spec.js',
    find: "        fascia: roofFasciaIn(roof?.fascia),",
    with: "        fascia: ROOF_FASCIA_IN,",
    test: "FASCIA, IN on the ROOF panel sets one roof's board and the file keeps it" },
  { file: 'drawing-format.js', name: 'a fascia past the drafting limit is kept', spec: 'tests/roof-bust.spec.js',
    find: "    return Number.isFinite(n) && n >= ROOF_FASCIA_MIN_IN && n <= ROOF_FASCIA_MAX_IN ? n : ROOF_FASCIA_IN;",
    with: "    return Number.isFinite(n) && n >= ROOF_FASCIA_MIN_IN ? n : ROOF_FASCIA_IN;",
    test: "FASCIA, IN on the ROOF panel sets one roof's board and the file keeps it" },
  { file: 'cut-view.js', name: 'the elevation hangs the standard board whatever the roof wears', spec: 'tests/roof-bust.spec.js',
    find: "  const roofFasciaFt = roof => (Number(roof?.fascia) > 0 ? Number(roof.fascia) : ROOF_FASCIA_IN) / 12;",
    with: "  const roofFasciaFt = roof => ROOF_FASCIA_IN / 12;",
    test: 'E1 hangs a 10" board under the main roof once its fascia is typed' },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4461' } });
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
