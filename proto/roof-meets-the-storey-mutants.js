// DOES THE SPEC CATCH A ROOF THAT QUIETLY STOPS MEETING THE WALL?
//
// Movie, 16 Oct: "the main rule for that connection should be the roof should
// be designed in a way (usually using gable design) to slope the main roof
// AWAY or to the SIDES of the 2nd storey wall lines".
//
// THE DEFECT THIS WORK FIXED WAS SILENT, and that is what the mutants are
// arranged around. The rule was already written; a stray vertex in a traced
// loop made the ring non-square, cutLoops refused it, and the cut that
// applies the rule answered null -- which notchRoofRound dropped on the
// floor. Nothing threw, nothing was logged, and the drawing came out with a
// two-foot eave aimed at a wall. Every row below is a way back into that
// quiet: the clean not running, the clean running too hard, the order going
// back, the cut never being asked for, or the named edges losing their
// numbering as the loop is renumbered under them.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-roof-meets-the-storey.spec.js';

const MUTANTS = [
  { file: 'geometry-2d.js',
    name: 'the clean does nothing, so the offset keeps running a diagonal '
      + 'across the building',
    find: '        if (Math.abs(cross) > 1e-9 || dot < 1 - 1e-9) continue;',
    with: '        if (true) continue;',
    test: 'a loop that doubles back loses the tip' },

  { file: 'geometry-2d.js',
    name: 'it stops asking which WAY the two edges leave, so a plain '
      + 'straight-through vertex is eaten as a spike',
    find: '        if (Math.abs(cross) > 1e-9 || dot < 1 - 1e-9) continue;',
    with: '        if (Math.abs(cross) > 1e-9) continue;',
    test: 'a loop that doubles back loses the tip' },

  { file: 'geometry-2d.js',
    name: 'one pass only: a tip the first pass could not see is left in the '
      + 'loop, and offsets exactly as badly as the one just removed',
    find: '    while (cut && live.length > 3) {',
    with: '    if (cut && live.length > 3) {',
    test: 'a loop that doubles back loses the tip' },

  { file: 'geometry-2d.js',
    name: 'the map comes back ungapped, so a caller following its named '
      + 'edges across the clean reads the wrong ones',
    find: '        kept = kept.filter((_, index) => index !== i);',
    with: '        kept = kept.slice(0, -1);',
    test: 'a loop that doubles back loses the tip' },

  { file: 'MODEL.html',
    name: 'the roof ring is taken straight from the loop again, spike and all',
    find: '    const cleaned = G.loopWithoutSpikes(loop);\n'
      + '    const ring = cleaned.points;',
    with: '    const cleaned = G.loopWithoutSpikes(loop);\n'
      + '    const ring = loop.map(pt => ({ x: pt.x, z: pt.z }));',
    test: 'the roof dies into the 2nd-storey wall' },

  { file: 'MODEL.html',
    name: 'the named edges do not follow the renumbering, so a flush gable '
      + 'lands on an edge nobody named',
    find: '    const followClean = list => (Array.isArray(list)\n'
      + '      ? list.map(index => ringIndexOf.get(index)).filter(index => index !== undefined)\n'
      + '      : list);',
    with: '    const followClean = list => list;',
    test: 'the roof dies into the 2nd-storey wall' },

  { file: 'MODEL.html',
    name: 'the roof is never asked to meet the wall: the cut is not passed',
    find: '          buildType: roofType, notch: houseRoofNotch }));',
    with: '          buildType: roofType, notch: null }));',
    test: 'the roof dies into the 2nd-storey wall' },

  { file: 'MODEL.html',
    name: 'the cut goes back to running AFTER the chamfer, which is the '
      + 'order that made the whole thing silent',
    find: '    const notched = notch ? notchPlainRoof(plain, notch, roofOverhangFt) : null;\n'
      + '    const base = notched || plain;',
    with: '    const base = plain;',
    test: 'the roof dies into the 2nd-storey wall' },

  { file: 'MODEL.html',
    name: 'the edges cut against the wall keep their two feet of overhang, '
      + 'so a rake hangs inside the room',
    find: "      edges: cut.onCut.map(onWall => (onWall ? 'gable' : 'eave')),\n"
      + '      edgeOverhang: cut.onCut.map(onWall => (onWall ? 0 : overhangFt)),',
    with: "      edges: cut.onCut.map(onWall => (onWall ? 'gable' : 'eave')),\n"
      + '      edgeOverhang: cut.onCut.map(() => overhangFt),',
    test: 'the roof dies into the 2nd-storey wall' },

  { file: 'MODEL.html',
    name: 'the cut edges are left as eaves -- the roof stops at the wall and '
      + 'still drains into it',
    find: "      edges: cut.onCut.map(onWall => (onWall ? 'gable' : 'eave')),",
    with: "      edges: cut.onCut.map(() => 'eave'),",
    test: 'the roof dies into the 2nd-storey wall' },

  // AND THE DESIGN THAT WAS ALREADY RIGHT. A fix for a traced house that
  // moved an ordered one would be a trade, not a fix.
  { file: 'MODEL.html',
    name: 'the clean trims a corner off the stock design',
    find: '    const cleaned = G.loopWithoutSpikes(loop);\n'
      + '    const ring = cleaned.points;',
    with: '    const cleaned = G.loopWithoutSpikes(loop);\n'
      + '    const ring = cleaned.points.slice(0, -1);',
    test: 'the stock MOD BILEVEL is exactly where it was' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4355' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync('git status --porcelain MODEL.html geometry-2d.js',
  { cwd: ROOT }).toString().trim();
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
  const hits = before.split(m.find).length - 1;
  if (hits === 0) {
    console.log(`  SKIPPED   ${m.name}  (anchor not found — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  if (hits > 1) {
    console.log(`  AMBIGUOUS (${hits} matches)  ${m.name}`);
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
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
