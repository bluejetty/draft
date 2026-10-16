// DOES THE DEAD-STRIP SPEC CATCH A STAIR THAT WAS NEVER MOVED?
//
// Movie, 15 Oct: "if that area is less than 7 ft we should move the stairs to
// the garage wall ... if there is 7ft or more, the north side of the stair
// opening would also need 2 more columns on each end of the stair and a
// beam".
//
// One measurement picks between two drawings, so most of the ways this can be
// wrong leave a house that still builds, still has a stair, and still saves:
// a strip never measured, a threshold that answers the same way every time, a
// distance taken from the middle of the hole instead of its edge, a push to
// the wrong side, a beam on a side that is already carried, framing an AUTO
// sweep can carry off, a beam laid across the opening it is meant to frame.
// Each of those is a mutant here.
//
// ONE MUTANT IS NOT HERE, and it is worth saying which. stairCloseDeadStrip
// puts the stair back when the move it just made is not legal -- a beam
// standing in the strip -- and no house this spec can build has one there to
// demonstrate it. Writing a mutant for it would mean writing a check that
// cannot fail, so the restore is argued for in MODEL.html and left unpinned
// here rather than counted as covered.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-stair-dead-strip.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the strip is never closed: a stair stands in the middle of a house '
      + 'too narrow for the room it leaves',
    find: '    const [near] = stairSideStrips(stair);\n'
      + '    if (!near || !(near.ft > 0.01) || near.ft >= STAIR_DEAD_STRIP_FT) return 0;',
    with: '    const [near] = stairSideStrips(stair);\n'
      + '    if (true) return 0;',
    test: 'a strip too small to be a room goes away' },

  { file: 'MODEL.html',
    name: 'the 7 ft threshold is dropped, so every stair is pushed to a wall '
      + 'and a room that was there is given away',
    find: '    if (!near || !(near.ft > 0.01) || near.ft >= STAIR_DEAD_STRIP_FT) return 0;',
    with: '    if (!near || !(near.ft > 0.01)) return 0;',
    test: 'a strip that IS a room leaves the stair where the suggester put it' },

  { file: 'MODEL.html',
    name: 'the strip is measured from the middle of the well, so half a '
      + 'stairwell counts as room',
    find: '      const out = Math.max(...poly.map(pt =>\n'
      + '        (pt.x - mid.x) * dir.x + (pt.z - mid.z) * dir.z));',
    with: '      const out = 0;',
    test: 'a strip too small to be a room goes away' },

  { file: 'MODEL.html',
    name: 'the stair is pushed toward the FAR wall: the strip it was meant to '
      + 'close is the one it opens',
    find: '    }).filter(side => Number.isFinite(side.ft)).sort((a, b) => a.ft - b.ft);',
    with: '    }).filter(side => Number.isFinite(side.ft)).sort((a, b) => b.ft - a.ft);',
    test: 'a strip too small to be a room goes away' },

  { file: 'MODEL.html',
    name: 'a stacked flight is moved on its own, which unstacks it from the '
      + 'run below and loses the line-up he asked for',
    find: '      if (!stacked) stairCloseDeadStrip(res.stair);',
    with: '      stairCloseDeadStrip(res.stair);',
    test: 'the flight above takes its extra width on the wall side' },

  { file: 'MODEL.html',
    name: 'the open side of the well is never framed',
    find: '    return stairSideSpans(stair).filter(side => side.ft >= STAIR_SIDE_BEAM_SPAN_FT - 1e-6)',
    with: '    return [].filter(side => side.ft >= STAIR_SIDE_BEAM_SPAN_FT - 1e-6)',
    test: 'the open side of the well gets a beam on two columns' },

  { file: 'MODEL.html',
    name: 'a side the mid-span beam already carries gets a second beam beside '
      + 'the first, and two more columns with it',
    find: '      .filter(side => !beams.some(beam =>\n'
      + '        stairBeamGapFt(beam, poly) <= STAIR_SIDE_BEAM_NEAR_FT',
    with: '      .filter(side => !beams.some(beam =>\n'
      + '        false && stairBeamGapFt(beam, poly) <= STAIR_SIDE_BEAM_NEAR_FT',
    test: 'the open side of the well gets a beam on two columns' },

  { file: 'MODEL.html',
    name: 'WHICH SIDE the carrying beam is on is not asked, so the beam '
      + 'hugging one edge excuses the open edge too',
    find: '        && ((beam.start.x + beam.end.x) / 2 - mid.x) * side.dir.x\n'
      + '          + ((beam.start.z + beam.end.z) / 2 - mid.z) * side.dir.z > 0))',
    with: '        && true))',
    test: 'the open side of the well gets a beam on two columns' },

  { file: 'MODEL.html',
    name: 'the beam is laid flush ON the well edge -- a beam across the '
      + 'opening it was put there to frame',
    find: '        const off = STAIR_FLUSH_BEAM_WIDTH_IN / 24;',
    with: '        const off = 0;',
    test: 'the open side of the well gets a beam on two columns' },

  { file: 'MODEL.html',
    name: 'the beam keeps the old 2" clearance off the edge instead of its '
      + 'face on it (the #745 offset, 1/4" into the hole on a 3 1/2" beam)',
    find: '        const off = STAIR_FLUSH_BEAM_WIDTH_IN / 24;',
    with: '        const off = STAIR_BEAM_CLEAR_IN / 12;',
    test: 'the open side of the well gets a beam on two columns' },

  { file: 'MODEL.html',
    name: 'a strip that is a room is framed from 7 ft, not 10: the 7-10 ft '
      + 'room gets a beam and two columns the joists did not need',
    find: '  const STAIR_SIDE_BEAM_SPAN_FT = 10;',
    with: '  const STAIR_SIDE_BEAM_SPAN_FT = 7;',
    test: 'under 10 ft of floor gets no beam' },

  { file: 'MODEL.html',
    name: 'the span is measured to the wall alone: a carrying beam in the '
      + 'strip does not shorten it',
    find: '        if (hit) ft = Math.min(ft, Math.hypot(hit.x - side.from.x, hit.z - side.from.z));',
    with: '        if (hit) ft = Math.min(ft, Infinity);',
    test: 'under 10 ft of floor gets no beam' },

  { file: 'MODEL.html',
    name: 'the two columns are both at one end of the beam',
    find: '        return { start: a, end: b, columns: [a, b] };',
    with: '        return { start: a, end: b, columns: [a, a] };',
    test: 'the open side of the well gets a beam on two columns' },

  { file: 'MODEL.html',
    name: 'the framing is marked AUTO, so the next beam press sweeps away '
      + 'what holds the open side of the well',
    find: "          ...filing, mode: 'flush', auto: false, stairId: stair.id,",
    with: "          ...filing, mode: 'flush', auto: true, stairId: stair.id,",
    test: 'they are not a suggestion' },

  { file: 'MODEL.html',
    name: 'the framing is left out of the undo step: one Ctrl+Z takes the '
      + 'house back and leaves a beam and two posts standing in the air',
    find: '      placed: [...placed, ...cut.placed, ...framed.placed],',
    with: '      placed: [...placed, ...cut.placed],',
    test: 'one Ctrl+Z takes the stair framing back with the house' },

  { file: 'MODEL.html',
    name: 'the widened flight stays centred, so half the width it gained '
      + 'lands in the room and the flights no longer line up',
    find: '      const grew = (record.widthFt - (below.widthFt || record.widthFt)) / 2;',
    with: '      const grew = 0;',
    test: 'the flight above takes its extra width on the wall side' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4353' } });
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

// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
