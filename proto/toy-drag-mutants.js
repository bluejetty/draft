// DOES THE §3 SPEC CATCH A DRAG THAT DECIDES NOTHING?
//
// The gate for §3 — the bone drag, the off-grid landing, and the blocker. Same
// two hardenings as the eight before it: an ambiguous anchor is refused rather
// than guessed at, and a survivor is re-run against the whole spec before it
// is called one.
//
// MUTANT 1 IS THE DEFECT THAT ACTUALLY SHIPPED TODAY, and it is the reason
// this file exists in the shape it does. MODEL.html never loaded the
// constraint modules: toyWallDelta asked for window.DraftToyConstraints, got
// undefined, hit its own `if (!T || !C) return null` guard and fell through to
// wallSnapDelta, so TOY behaved exactly like DRAFTING. It survived 29/29 and
// 14/14 — because every §3 check I had was phrased "TOY must not leak into
// DRAFTING", and A FEATURE THAT IS SWITCHED OFF LEAKS NOTHING.
//
// A missing <script> is not a normal mutation target. It is one here because a
// defensive null turns an absent dependency into a silent no-op, and that
// guard is correct for a page that legitimately lacks the modules — so nothing
// but a mutant will ever ask again.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE DEFECT THAT SHIPPED: the constraint modules are not loaded',
    find: '<script src="./toy-constraints.js"></script>',
    with: '',
    test: 'first nudge lands on the foot' },
  { file: 'MODEL.html',
    name: 'the context module is not loaded, so the drag has no house to read',
    find: '<script src="./toy-context.js"></script>',
    with: '',
    test: 'first nudge lands on the foot' },
  { file: 'MODEL.html',
    name: 'the drag stops asking the module and snaps like DRAFTING',
    find: "          const toy = board === 'toy' ? toyWallDelta(md, dx, dz) : null;",
    with: '          const toy = null;',
    test: 'first nudge lands on the foot' },
  { file: 'MODEL.html',
    name: 'TOY LEAKS: every board goes through the constraint path',
    find: "          const toy = board === 'toy' ? toyWallDelta(md, dx, dz) : null;",
    with: '          const toy = toyWallDelta(md, dx, dz);',
    test: 'the constraint path is TOY only' },
  // THE MUTANT THAT PROVED A REDUNDANCY rather than a hole is gone with the
  // line it mutated. `ask = land === null ? wanted : land` survived because
  // stepFt already lands the wall: quantiseFeet(-1, 0.958) is -0.958 whichever
  // value is asked for. Two lines encoding one intent, and the gate is what
  // said so -- the code is one line shorter and the mutant has nothing left to
  // change.
  { file: 'MODEL.html',
    name: 'the landing distance is quantised away by a whole-foot step',
    // RE-ANCHORED after the landing was collapsed into one function. The old
    // anchor named a line that no longer exists, so the gate printed SKIPPED
    // and totalled 7/9 -- the count is against 10 defined, which is the only
    // reason the skip was visible at all.
    find: '    const probe = { ...wall, stepFt: land };',
    with: '    const probe = { ...wall };',
    test: 'first nudge lands on the foot' },
  { file: 'MODEL.html',
    name: 'THE ASK IS NOT THE LANDING: a one-foot drag sails past the mark',
    // The line I deleted as redundant and had to restore. Only a +z nudge can
    // see it: pulling -z, quantising by 0.958 lands on the mark whatever is
    // asked for. Aimed at the direction check for exactly that reason.
    find: '    const ask = offGridBy(pos) ? dir * land : wanted;',
    with: '    const ask = wanted;',
    test: 'pushed the other way' },
  { file: 'MODEL.html',
    name: 'the landing ignores which way the wall is going',
    // REPLACES the on-grid guard mutant, which survived because the guard had
    // become redundant -- an on-grid wall computes a step of FOOT down either
    // path. The direction is what is left, and it is real: land the wall on
    // the mark BEHIND it while the drafter pulls forward and the wall jumps
    // the wrong way.
    find: "    return direction > 0 ? FOOT - frac : frac;",
    with: '    return frac;',
    test: 'first nudge lands on the foot' },
  { file: 'MODEL.html',
    name: 'the move is not perpendicular: the along-run component rides too',
    find: "    const wanted = axis === 'x' ? dz : dx;",
    with: '    const wanted = dz;',
    // AIMED AT A WALL THAT RUNS ALONG Z. Every wall dragged in the checks
    // above runs along x, where `dz` is the right answer anyway -- so the
    // mutant changed nothing and survived. A side wall is the only place the
    // difference shows.
    test: 'a side wall moves along its own perpendicular' },
  { file: 'MODEL.html',
    name: 'a refused drag moves anyway, elastic instead of dead',
    find: '    const moved = verdict.delta || 0;',
    with: '    const moved = verdict.delta || ask;',
    test: 'a blocked drag stops dead' },
  { file: 'MODEL.html',
    name: 'THE BLOCKER GOES SILENT, which is where this section started',
    // A NO-OP, NOT A DELETION, and the difference is the whole mutant.
    // Removing the line outright left `else if (verdict.delta) ...` dangling,
    // so the page stopped PARSING -- and a mutant that breaks the syntax is
    // killed by every check at once, whether or not any of them asserts what
    // it names. It read KILLED while proving only that the file compiles.
    //
    // Caught by reading the live diff during a run rather than the result, and
    // it is the same defect as the swallowed exit code and the check that
    // named no test: a green whose cause is not the thing being claimed.
    find: '    if (stopped) sayOnStrip(blockerSays(verdict));',
    with: '    if (stopped) { /* mutant: the blocker says nothing */ }',
    test: 'a blocked drag stops dead' },
  { file: 'MODEL.html',
    name: 'every refusal says the same thing, so the reason is decoration',
    find: '  const blockerSays = verdict =>\n    BLOCKER_WORDS[verdict.reason] || `cannot move it: ${verdict.reason}`;',
    with: "  const blockerSays = () => 'cannot move that';",
    test: 'a blocked drag stops dead' },

  // ── §3b: THE DIAGONAL ────────────────────────────────────────────────────
  // Five for the two faults that let TOY draw a diagonal. The first two are
  // the faults themselves; the third is the leak; the fourth is the refusal
  // naming the wrong rule. The fifth is a guard I believe is UNREACHABLE and
  // am asking the gate about rather than deleting on my own reasoning -- the
  // last time I deleted a line the gate called redundant, it was load-bearing.
  // REMOVED, WITH THE READING AS THE MEASUREMENT: 'THE PAGE LIES ABOUT WHAT
  // MOVES: the weld group swallows the house'. It dropped the
  // `welds: [[wall.id]]` override and SURVIVED once its test grep was
  // corrected -- and it is unkillable from this page today, for a reason that
  // is read off the files rather than inferred:
  //
  //   MIN_ROOM               needs a room category   MODEL.html passes no
  //                                                  categoryFor, so every
  //                                                  derived room is
  //                                                  category: null and
  //                                                  evaluateRoom returns ok
  //   OPENING_WOULD_NOT_FIT  needs openings          gather({ walls }) at
  //                                                  MODEL.html:8910 passes
  //                                                  none
  //   CANTILEVER             needs wall.cantileverFt the field is in NO page
  //                                                  file -- only
  //                                                  toy-constraints.js,
  //                                                  toy-context.js and three
  //                                                  harnesses
  //   NEEDS_A_BEAM           needs shortSpanFt       zero occurrences in
  //                                                  MODEL.html
  //
  // One uniform reason, not four: THE PAGE HANDS THE MODULE WALLS AND NOTHING
  // ELSE. The eligibility path IS live and its refusals do reach the strip
  // (inertReason reads geometry alone, toy-constraints.js:181) -- but
  // eligibility never reads the weld group, and every rule that would read it
  // never runs. So no drag can make the two group shapes answer differently.
  //
  // A mutation nothing can catch is not evidence, it is a permanent survivor
  // sitting in the file's total. The override stays; what goes is the claim
  // that this file measures it.
  //
  // WHAT WOULD MAKE THIS LIVE AGAIN, so this reads as a deferral and not a
  // deletion: pass `shortSpanFt` or `openings` into the gather call at
  // MODEL.html:8910. Either one starts a wall-keyed rule firing, at which
  // point a drag CAN make the two weld shapes answer differently and this
  // mutation is worth restoring -- it would be measuring something real.
  // Nothing about the page is broken today; those rules are simply not built
  // yet, and the drag, the geometry and the eligibility refusals all work.
  { file: 'toy-constraints.js',
    name: 'NOTHING CHECKS THE SHAPE AFTER THE MOVE, so the diagonal comes back',
    // RE-POINTED. wouldAngle gained a `ctx.detached` argument and the
    // statement wrapped onto two lines.
    find: "      const angled = mode === MODE.TOY\n        ? wouldAngle(wall, groupIds, walls, d, ctx.detached) : null;",
    with: '      const angled = null;',
    // GREP CORRECTED: the title reads 'never LEAVES the next wall on an
    // angle'. One conjugation was the whole defect -- 'leave' is not a
    // substring of 'leaves ', so -g matched nothing, playwright ran nothing
    // and exited non-zero, and all three of these scored KILLED off an empty
    // run. This file's 16/16 was three kills lighter than it read.
    test: 'never leaves the next wall on an angle' },
  { file: 'toy-constraints.js',
    name: 'THE ANGLE RULE LEAKS INTO DRAFTING, where off-axis is the freedom',
    // RE-POINTED, as directly above.
    find: "      const angled = mode === MODE.TOY\n        ? wouldAngle(wall, groupIds, walls, d, ctx.detached) : null;",
    with: '      const angled = wouldAngle(wall, groupIds, walls, d, ctx.detached);',
    // ASKED OF THE MODULE. Aimed at the page check first, where it SURVIVED:
    // DRAFTING never calls the module from this page, so the page cannot tell
    // a TOY-only rule from a rule that does not exist.
    test: 'asked of the module, not of the page' },
  { file: 'toy-constraints.js',
    name: 'the refusal is renamed to a distance problem it is not',
    find: '      if (blocked.reason !== REASON.WOULD_ANGLE_NEIGHBOUR) {',
    with: '      if (true) {',
    // GREP CORRECTED: the title reads 'never LEAVES the next wall on an
    // angle'. One conjugation was the whole defect -- 'leave' is not a
    // substring of 'leaves ', so -g matched nothing, playwright ran nothing
    // and exited non-zero, and all three of these scored KILLED off an empty
    // run. This file's 16/16 was three kills lighter than it read.
    test: 'never leaves the next wall on an angle' },
  { file: 'toy-constraints.js',
    name: 'THE ANGLE TEST IS INVERTED: square neighbours refuse, bent ones pass',
    // Replaces the "is the skip reachable" question, which the gate answered:
    // it SURVIVED the whole spec, agreeing with inertReason that nothing can
    // reach it, so the guard is gone rather than left under a permanent
    // survivor.
    //
    // MY FIRST REPLACEMENT WAS A DUD and I caught it before running it: moving
    // the stretched wall's PINNED end instead of its welded one still leaves
    // n2 bent, so it refuses exactly as the real code does and would have
    // survived while looking like a real mutation. Inverting the test is
    // reachable in both directions -- the square must still drag, the broken
    // run must still refuse -- so one check cannot satisfy it by accident.
    find: '      if (!isOrthogonal(moved)) return other.id;',
    with: '      if (isOrthogonal(moved)) return other.id;',
    test: 'the ordinary square still drags' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-draw.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, not just the page. The restore is
// `git checkout -- <file>`, so a file left out of this guard has any
// uncommitted work in it silently destroyed the first time a mutant touches
// it. §3b added toy-constraints.js to the targets; it belongs here too.
const dirty = execSync('git status --porcelain MODEL.html toy-constraints.js',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// THE COUNT IS READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED
// mutant printed "10/10 killed" on another gate today and read like a clean
// sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
