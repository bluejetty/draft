#!/usr/bin/env node
// MUTATION GATE for the main roof beside a 2nd-floor wall
// (tests/roof-against-wall.spec.js).
//
// Movie, 17 Oct: "on main roof split the roof into 2 roofs -- front will be
// gabled away slope from 2nd floor, and back roof can be gabled at front to
// connect to back of 2nd floor and shed water to sides and hip at back" ...
// "will need the main roof to have a 'gable wall'". The geometry's rows are
// proto/roof-wings-harness.js's; these are the build's seams in MODEL.html.
//
// Run: node proto/roof-against-wall-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/roof-against-wall.spec.js';
const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the roof is never read against the wall: the old wings rule runs',
    find: "    if (wings && !stepped && notch && G.roofAgainstWall\n",
    with: "    if (false && wings && !stepped && notch && G.roofAgainstWall\n",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: "the block's kinds are read as wings again, not taken as decided",
    find: "        if (block.decided) {\n          pieceLists = { flush: block.flush, rake: block.rake };\n          readWings = false;",
    with: "        if (block.decided) {\n          pieceLists = { flush: block.flush, rake: block.rake };\n          readWings = true;",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: 'the piece is cut on the sheet, after its overhang, and the rake runs on beside the hood',
    find: "    if (pieceLists && notchHere) {\n      const cut = window.DraftPremadePlans.cutLoops(ring, notchHere);",
    with: "    if (false) {\n      const cut = window.DraftPremadePlans.cutLoops(ring, notchHere);",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: 'the piece is offset with the slanting variable offset, not the stepped one',
    find: "    const steppedPiece = pieceLists && G.offsetOutlineStepped\n",
    with: "    const steppedPiece = false && G.offsetOutlineStepped\n",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: 'the jog in the garage front stays in the roof ring',
    find: "    const unjogged = G.loopWithoutJogs ? G.loopWithoutJogs(cleaned.points)\n",
    with: "    const unjogged = false ? G.loopWithoutJogs(cleaned.points)\n",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: 'the block keeps the project pitch however high it peaks',
    find: "    if (pieceLists && notch && Number.isFinite(Number(ownTop))) {\n      const inLoop",
    with: "    if (false) {\n      const inLoop",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: 'an edge running a jog past the room is no longer flush',
    find: "      return G.edgeOnLoop(a, b, sharedWith) || mostlyOnLoop(a, b, sharedWith);",
    with: "      return G.edgeOnLoop(a, b, sharedWith);",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: 'no gable wall is raised under the rake',
    find: "          onGableWall: run => gableWallRuns.push(run) }));",
    with: "          onGableWall: null }));",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
  { file: 'MODEL.html',
    name: "the gable wall's plate is the room's, not the main roof's bearing",
    find: "            refLine: inBlock ? 'left' : 'right', baseHeight: base, topHeight: base,",
    with: "            refLine: inBlock ? 'left' : 'right', baseHeight: base, topHeight: split.upperWallHeightFt,",
    test: 'his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4402' } });
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
