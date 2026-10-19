#!/usr/bin/env node
// MUTATION GATE for beams part 2 (tests/beam-depth.spec.js, tests/beam-ask.spec.js).
//
// Movie, 19 Oct: "allow the user to INCREASE the thickness of the floor if the
// span is increased past acceptable span, and would be 31 feet max space for
// OWJ" -- "the beams and joists will be marked BEAM / JOIST SPAN REQUIRES
// ENGINEERING / ADDITIONAL SUPPORT" -- "if it is a crawl space ... THAT ceiling
// height can be decreased" -- "on the AUTOHOUSE, before the beams are placed,
// maybe we should make a popup that says PLACE BEAMS and COLUMS".
//
// Run: node proto/beam-depth-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/beam-depth.spec.js tests/beam-ask.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'a moved row never asks its floor again',
    find: "      const stepped = d.set.run ? stepUpJoists(d.set.run[0].levelId) : { edits: [], said: [] };\n",
    with: "      const stepped = { edits: [], said: [] };\n",
    test: 'a row moved to leave a 28 ft bay steps the OWJ up to 23-1/4" @ 16"; one UNDO puts the row and the floor back' },
  { file: 'MODEL.html', name: 'the step-up is an UNDO of its own',
    find: "        ? { kind: 'batch', steps: [moveStep, { kind: 'props', edits: stepped.edits }] } : moveStep);\n",
    with: "        ? moveStep : moveStep);\n",
    test: 'a row moved to leave a 28 ft bay steps the OWJ up to 23-1/4" @ 16"; one UNDO puts the row and the floor back' },
  { file: 'MODEL.html', name: 'the floor steps to the deepest row, not the shallowest that reaches',
    find: "      const want = B.owjFor(span, { minDepthIn: asm.joistDepthIn });\n",
    with: "      const want = B.owjFor(99, { minDepthIn: asm.joistDepthIn });\n",
    test: 'a row moved to leave a 28 ft bay steps the OWJ up to 23-1/4" @ 16"; one UNDO puts the row and the floor back' },
  { file: 'MODEL.html', name: 'a crawl space keeps its height and the footing drops',
    find: "          fRec.wallHeightFt = fdn.wallHeightFt - deeperFt;\n",
    with: "",
    test: 'over a crawl space the floor deepens down into it: the pour gives up the 4"' },
  { file: 'MODEL.html', name: 'a deleted row leaves the floor as it was',
    find: "    const stepped = framing.map(stepUpJoists);\n",
    with: "    const stepped = [];\n",
    test: 'deleting a row steps the floor up too, in the same UNDO' },
  { file: 'build-house.js', name: 'no bay is ever past the table',
    find: "    if (!callout.bays.some(bay => bay.spanFt > OWJ_MAX_SPAN_FT + 1e-6)) return callout;\n",
    with: "    return callout;\n",
    test: 'past 31 ft the floor stays at 23-1/4" @ 12" and the bay and its beam carry the ENGINEERING mark' },
  { file: 'render-2d.js', name: 'the bay mark is never painted',
    find: "      if (bay.warn && !env.isPrinting) {\n",
    with: "      if (false) {\n",
    test: 'past 31 ft the floor stays at 23-1/4" @ 12" and the bay and its beam carry the ENGINEERING mark' },
  { file: 'render-2d.js', name: 'the beam beside the long bay is never marked',
    find: "      if (options.warn && !(typeof beam.mark === 'string' && beam.mark.trim())) {\n",
    with: "      if (false) {\n",
    test: 'past 31 ft the floor stays at 23-1/4" @ 12" and the bay and its beam carry the ENGINEERING mark' },
  { file: 'build-house.js', name: 'the engineer\'s callout does not lift the mark',
    find: "    if (typeof assembly.joistCallout === 'string' && assembly.joistCallout.trim()) return callout;\n",
    with: "",
    test: 'a floor the engineer has specified carries no mark' },
  { file: 'MODEL.html', name: 'AUTO HOUSE asks nothing',
    find: "    if (beamAsk.items.length) askForBeams(beamAsk);\n",
    with: "",
    test: 'the bungalow comes up with the question; YES keeps the beams and columns' },
  { file: 'MODEL.html', name: 'NOT NOW leaves the beams standing',
    find: "      list.splice(index, 1);\n      removed.push({ list, index, item });\n    });\n    beamAskItems = [];\n",
    with: "      removed.push({ list, index, item });\n    });\n    beamAskItems = [];\n",
    test: 'NOT NOW takes the mid-span rows and their posts out, says where to place them later; UNDO puts them back' },
  { file: 'MODEL.html', name: 'NOT NOW takes the stair headers too',
    find: "    beamAskItems.forEach(({ list, item }) => {\n",
    with: "    [...beamAskItems, ...(drawing.beams || []).filter(b => b.stairId).map(item => ({ list: drawing.beams, item }))].forEach(({ list, item }) => {\n",
    test: 'the stair headers are never asked about: a 2 STOREY keeps its stairwell header through NOT NOW' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4454' } });
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
