// DOES THE FOOTPRINT-ASK SPEC CATCH AN ANSWER THAT LIES?
//
// Movie, 15 Oct: "can we ask them if they would like a cantilever or overhang
// supported by a beam (2ft max if cantilevel, 4-6 min if supported on beam.
// or ask them if they would like to move the foundation other floors and roof
// at the same time --- 3 options".
//
// Three answers to one gesture is three chances to build something that looks
// right on screen and is wrong in the file: a card that never comes up, a
// cantilever that moves the wall and not the footprint, a ladder that is read
// and then ignored, a master moved with nothing told to follow it, a freeze
// that is never recorded, an undo that hands back the strings and leaves the
// concrete. Each of those is a mutant here.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
//
// ONE MUTANT WAS REMOVED RATHER THAN KILLED, and that is the gate working.
// It restored the dragged wall's master offset before propagating -- which
// reads as obviously necessary and is not: a plain corner drag never
// re-measures that offset (relinkVertex belongs to the ASSEMBLY drag), so the
// mutant changed no drawing and no spec could have caught it. The line came
// out and the reason went into MODEL.html where the next reader will be
// tempted to put it back.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-footprint-ask.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the card never comes up: every drag answers itself',
    find: '    if (!moves.length) return null;',
    with: '    if (true) return null;',
    test: 'a small pull offers the cantilever' },

  { file: 'MODEL.html',
    name: 'OFF THE FOOTPRINT is measured as the LENGTH OF THE PULL, so a corner '
      + 'slid along its own wall is asked about',
    // SAME LINE AS THE `mid` MUTANT BELOW, a different lie told about it:
    // this one swaps the distance TO THE FOOTPRINT for the length of the
    // pull, which reads a corner slid along its own wall as 3 ft off.
    find: '    const outFt = Math.max(offLoop(mid), ...moves.map(move => offLoop(move.to)));',
    with: '    const outFt = Math.max(...moves.map(move => '
      + 'Math.hypot(move.to.x - move.from.x, move.to.z - move.from.z)));',
    test: 'a corner slid ALONG its own wall' },

  { file: 'MODEL.html',
    name: 'CANTILEVER moves the wall and leaves the footprint behind — the '
      + 'very fault the card was built for',
    find: '      step.before.push({ vtx: pt, x: pt.x, z: pt.z });\n      pt.x = to.x; pt.z = to.z;',
    with: '      step.before.push({ vtx: pt, x: pt.x, z: pt.z });',
    test: 'CANTILEVER moves the footprint on this level' },

  { file: 'MODEL.html',
    name: 'the ladder is read and then ignored: a 3 ft pull stands in the band '
      + 'nothing may stand in',
    find: '  const scaleFootprintPull = (pending, targetFt) => {\n'
      + '    const k = pending.outFt > 0 ? targetFt / pending.outFt : 1;',
    with: '  const scaleFootprintPull = (pending, targetFt) => {\n'
      + '    const k = 1;',
    test: 'a pull into the forbidden band' },

  { file: 'MODEL.html',
    name: 'an overhang past 4-6 is left standing on nothing',
    find: '      const n = piles.length ? overhangPiles(pending, step) : 0;',
    with: '      const n = 0;',
    test: 'ON PILES puts a pile under the overhang' },

  { file: 'MODEL.html',
    name: 'the piles are AUTO, so the next AUTO PILES press sweeps away what '
      + 'holds the overhang up',
    find: '        auto: false,\n      };\n      drawing.columns.push(column);',
    with: '        auto: true,\n      };\n      drawing.columns.push(column);',
    test: 'ON PILES puts a pile under the overhang' },

  { file: 'MODEL.html',
    name: 'the master moves and nothing is told to follow it',
    find: '      masters.forEach(master => propagateMasterOutline(master));',
    with: '      masters.forEach(master => master);',
    test: 'MOVE EVERYTHING goes through the master' },

  { file: 'MODEL.html',
    name: 'a cantilevered corner is never frozen off the master, so the next '
      + 'master edit pulls the overhang back flush',
    find: '      list.push(pt.srcId);',
    with: '      if (false) list.push(pt.srcId);',
    test: 'CANTILEVER takes that one corner OFF the master' },

  { file: 'MODEL.html',
    name: 'undo leaves the freeze on: a corner that silently stops following '
      + 'the bone',
    find: '    (step.overrides || []).forEach(({ list, id }) => {\n'
      + '      const at = list.indexOf(id);\n'
      + '      if (at >= 0) list.splice(at, 1);\n'
      + '    });',
    with: '    (step.overrides || []).forEach(({ list, id }) => list && id);',
    test: 'undoing a cantilever takes the freeze off' },

  { file: 'MODEL.html',
    name: 'foldRedim takes the step\'s item list over again: one Ctrl+Z hands '
      + 'back the strings and leaves the concrete in the ground',
    find: '    (step.items = step.items || []).push(\n'
      + '      ...redim.placed.map(item => ({ list: drawing.dimensions, item })));',
    with: '    step.items = redim.placed.map(item => ({ list: drawing.dimensions, item }));',
    test: 'one Ctrl+Z puts the wall, the footprint and the pile back' },

  // NOT "foldRedim runs first": putting it before the card and leaving the
  // one in settleFootprint changes nothing a drawing can show, because the
  // second re-lay overwrites the first from the finished geometry. The
  // defect worth a mutant is the ANSWERED path never re-laying at all, which
  // is what the release site's early return would leave behind if the card
  // took the gesture and then forgot the strings.
  { file: 'MODEL.html',
    name: 'the answered drag never re-lays its strings: the card takes the '
      + 'gesture and the dimensions are left over the old building',
    find: '    foldRedim(step);\n    markDirty();\n    sayOnStrip',
    with: '    markDirty();\n    sayOnStrip',
    test: 'the strings re-lay off the footprint that moved' },

  { file: 'MODEL.html',
    name: 'the roof is left over the old corner, and nothing says so',
    find: '        best.p.x += dx; best.p.z += dz;',
    with: '        best.p.x += 0; best.p.z += 0;',
    test: 'takes the eave with it' },

  { file: 'MODEL.html',
    name: 'the TOY board gets the card too, in the middle of a child\'s drag',
    find: "    if (board === 'toy' || !footprintCard) {",
    with: '    if (!footprintCard) {',
    test: 'the TOY board is never asked' },

  // ── AND THE INWARD HALF ─────────────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'the middle of what moved is never probed: a wall pushed IN reads '
      + 'as nothing having left the footprint',
    find: '    const outFt = Math.max(offLoop(mid), ...moves.map(move => offLoop(move.to)));',
    with: '    const outFt = Math.max(...moves.map(move => offLoop(move.to)));',
    test: 'pushed IN, the card offers neither overhang' },

  { file: 'MODEL.html',
    name: 'direction is read at an END, where sitting on the loop is a coin '
      + 'toss: a wall pushed in reads as outward',
    find: '    const outward = !pointInLoop(loop, mid);',
    with: '    const outward = moves.some(move => !pointInLoop(loop, move.to));',
    test: 'pushed IN, the card offers neither overhang' },

  { file: 'MODEL.html',
    name: 'a deck is offered on the lowest storey, where nothing is uncovered '
      + 'to put a membrane on',
    find: '    deck.hidden = found.outward || !storeyBelow(found.levelId);',
    with: '    deck.hidden = found.outward;',
    test: 'the lowest storey has nothing to step off' },

  { file: 'MODEL.html',
    name: 'the storey steps back and nothing says the floor it left is in the '
      + 'weather',
    find: '    drawing.notes.push(note);\n    (step.items = step.items || [])'
      + '.push({ list: drawing.notes, item: note });',
    with: '    (step.items = step.items || []).push();',
    test: 'STEP IN FOR A ROOF DECK moves this floor' },

  { file: 'MODEL.html',
    name: 'the membrane note is filed on the floor below, not the sheet the '
      + 'deck is read off',
    find: "      id, anchor: at, text: { ...at }, levelId: pending.levelId, view: 'plan',",
    with: "      id, anchor: at, text: { ...at }, "
      + 'levelId: storeyBelow(pending.levelId).id, '
      + "view: 'plan',",
    test: 'STEP IN FOR A ROOF DECK moves this floor' },

  { file: 'MODEL.html',
    name: 'undo leaves the membrane note behind: a deck named on a storey that '
      + 'never stepped back',
    find: '    const patch = uncoveredPatch(pending);',
    with: '    const patch = uncoveredPatch(pending); step = { items: [] };',
    test: 'one Ctrl+Z takes the step-in and its membrane note back' },

  // ── AND THE LINE THAT IS NOT A BUILDING ─────────────────────────────────
  { file: 'MODEL.html',
    name: 'a dragged LINE is asked whether the foundation should follow it',
    find: '    if (md.body && !walls().includes(md.body)) return null;',
    with: '    if (false) return null;',
    test: 'a LINE dragged off the footprint is not asked about' },

  { file: 'MODEL.html',
    name: 'ESCAPE answers for him: the page decides what the drag meant',
    find: "      if (event.key === 'Escape') { settleFootprint('off'); return; }",
    with: "      if (event.key === 'Escape') { settleFootprint('all'); return; }",
    test: 'ESCAPE leaves the wall off its footprint' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4351' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync('git status --porcelain MODEL.html',
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
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

console.log(`\n${killed}/${ran} mutations caught`
  + (ambiguous ? `, ${ambiguous} skipped` : ''));
process.exit(killed === ran && !ambiguous ? 0 : 1);
