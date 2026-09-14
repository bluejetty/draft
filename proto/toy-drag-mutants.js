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
    test: 'DRAFTING keeps the off-axis' },
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
    find: '    if (stopped) sayOnStrip(blockerSays(verdict));',
    with: '',
    test: 'a blocked drag stops dead' },
  { file: 'MODEL.html',
    name: 'every refusal says the same thing, so the reason is decoration',
    find: '  const blockerSays = verdict =>\n    BLOCKER_WORDS[verdict.reason] || `cannot move it: ${verdict.reason}`;',
    with: "  const blockerSays = () => 'cannot move that';",
    test: 'a blocked drag stops dead' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-draw.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: '/home/user/draft' }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `/home/user/draft/${m.file}`;
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
  execSync(`git checkout -- ${m.file}`, { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// THE COUNT IS READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED
// mutant printed "10/10 killed" on another gate today and read like a clean
// sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
