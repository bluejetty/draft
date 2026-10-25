#!/usr/bin/env node
// MUTATION GATE for beams and columns the drafter can move (tests/beam-move.spec.js).
//
// Movie, 19 Oct: "I'd like to be able to move the BEAM manually so that all the
// columns follow. i will also want to probably DELETE one line of beams" --
// "would be 31 feet max space for OWJ" -- "make that TEXT editable so and
// ENGINEER can change it to whatever they specify the floor or beams as".
//
// Run: node proto/beam-move-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/beam-move.spec.js';
const MUTANTS = [
  { file: 'model/06-selection-pick.js', name: 'a click cannot reach a beam',
    find: "      const beam = segAt(beams(), worldPt);\n",
    with: "      const beam = null;\n",
    test: 'a click on one piece picks the row; MOVE slides it across itself only, its posts ride, its far end finds the wall' },
  { file: 'model/06-selection-pick.js', name: 'a click takes one piece, not the row',
    find: "    if (entry.type === 'beam') return beamRun(entry.item).map(item => ({ type: 'beam', item }));\n",
    with: "",
    test: 'a click on one piece picks the row; MOVE slides it across itself only, its posts ride, its far end finds the wall' },
  { file: 'model/09-draw-move-stretch.js', name: 'the posts stay behind',
    find: "        columnsOnBeam(item, (drawing.beams || []).filter(b => !chosen.has(b))).map(c => c.point)),\n",
    with: "        []),\n",
    test: 'a click on one piece picks the row; MOVE slides it across itself only, its posts ride, its far end finds the wall' },
  { file: 'model/09-draw-move-stretch.js', name: 'the row moves freely, along itself too',
    find: "      if (d.set.across) {\n",
    with: "      if (false) {\n",
    test: 'a click on one piece picks the row; MOVE slides it across itself only, its posts ride, its far end finds the wall' },
  { file: 'model/09-draw-move-stretch.js', name: 'a moved row keeps its length',
    find: "      if (d.set.run) reclipRun(d.set.run);\n",
    with: "",
    test: 'a click on one piece picks the row; MOVE slides it across itself only, its posts ride, its far end finds the wall' },
  { file: 'model/08-structure-roof.js', name: 'a deleted beam leaves its posts standing',
    find: "      posts.forEach(post => take(drawing.columns || [], post));\n",
    with: "",
    test: 'DELETE on a beam takes its whole row and its posts; a post off the row stays; one UNDO brings it back' },
  { file: 'model/08-structure-roof.js', name: 'a deleted row takes one UNDO per piece',
    find: "    if (undoStack.length - mark > 1) undoStack.push({ kind: 'batch', steps: undoStack.splice(mark) });\n",
    with: "",
    test: 'DELETE on a beam takes its whole row and its posts; a post off the row stays; one UNDO brings it back' },
  { file: 'drawing-format.js', name: 'the reader drops the MARK',
    find: "        ...(typeof beam?.mark === 'string' && beam.mark.trim()\n",
    with: "        ...(false\n",
    test: "the engineer's MARK names the beam, survives the reload and a re-press of AUTO BEAM" },
  { file: 'render-2d.js', name: 'the MARK is not what the beam is labelled',
    find: "      const named = typeof beam.mark === 'string' && beam.mark.trim() ? beam.mark.trim()\n",
    with: "      const named = false ? beam.mark.trim()\n",
    test: "the engineer's MARK names the beam, survives the reload and a re-press of AUTO BEAM" },
  { file: 'model/12-garage-storeys-stairs.js', name: 'a re-press of AUTO BEAM wipes the MARK',
    find: "        if (twin) item.mark = twin.mark.trim();\n",
    with: "",
    test: 'pressing AUTO BEAM again keeps the MARK on the beam it lays back down in the same place' },
  { file: 'build-house.js', name: 'the typed JOIST CALLOUT is ignored',
    find: "    if (typed) return typed;\n",
    with: "",
    test: "a floor's JOIST CALLOUT is typed in the BEAM panel and replaces the worked-out one" },
  { file: 'level-assembly.js', name: 'the assembly drops the JOIST CALLOUT',
    find: "      joistCallout: typeof raw.joistCallout === 'string' && raw.joistCallout.trim()\n",
    with: "      joistCallout: false\n",
    test: "a floor's JOIST CALLOUT is typed in the BEAM panel and replaces the worked-out one" },
  { file: 'model/12-garage-storeys-stairs.js', name: 'an OWJ floor keeps the 19 ft rule',
    find: "        ...(carriedAsm?.joistType === 'owj' ? { beamAtFt: window.DraftBuildHouse.garageBareSpanFt() } : {}),\n",
    with: "",
    test: 'AUTO BEAM on an OWJ floor spaces its rows by the joist: a 40 ft deep house takes one row, not two' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4453' } });
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
