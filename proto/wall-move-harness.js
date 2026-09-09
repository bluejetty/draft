#!/usr/bin/env node
// THE WALL MOVE — allowedMove() checked against the office's rules, offline.
//
// toy-constraints.js answers one question: given this wall, this drawing and
// this mode, how far may the wall actually move, and WHAT KIND of move was
// that? It is built and checked here before either screen exists, because a
// screen that has to be dragged to find out what the rules are is a screen
// that will disagree with the other screen about them.
//
//   node proto/wall-move-harness.js            (checks)
//   node proto/wall-move-harness.js --mutate   (checks + mutation table)
//
// Exit code 0 = every check passed, and in --mutate every mutant was caught.
//
// ── THE RULES THIS FILE EXISTS TO PROTECT ────────────────────────────────
//
//   Out to 2'-0" the joists overhang and it costs nothing.
//   From 2'-0" to 4'-6" it is INADVISABLE, not impossible: a beam and extra
//     structure. TOY blocks it; DRAFTING permits it and says what it costs.
//   Past 4'-6" the foundation itself moves, everything above follows, and
//     there is real bearing underneath again.
//
// The middle band is the whole point. A flat "you may move 2 feet" cap would
// make the expensive detail invisible and the honest one impossible, and a
// beginner would learn a rule the trade does not have.
//
// LOADED FROM SOURCE, NOT require()d, so a mutant can be applied to it. Every
// check below must be able to fail: the mutation table is the evidence that
// they can, and a check nothing can break is decoration.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'toy-constraints.js');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

// The real wall catalogue, the real room standards and the real shared
// geometry — never stand-ins. The minimums this function clamps at are the
// office's minimums or they are nothing, and geometry-2d.js is the only
// geometry dependency this module is allowed to take.
function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  ['wall-types.js', 'room-standards.js', 'geometry-2d.js']
    .forEach(file => new Function('window', fs.readFileSync(path.join(ROOT, file), 'utf8'))(window));
  new Function('window', src)(window);
  return window.DraftToyConstraints;
}

// ── Fixtures ─────────────────────────────────────────────────────────────
// A wall runs start→end; +x east, +z south. A wall running along +x has its
// LEFT to −z and its RIGHT to +z, and a positive delta moves it to its left.
const wall = (id, x0, z0, x1, z1, extra = {}) => ({
  id, start: { x: x0, z: z0 }, end: { x: x1, z: z1 },
  wallType: 'stud_2x6', refLine: 'right', ...extra,
});

// An exterior wall on the half foot whose overhang grows with the move: this
// is the wall the bands are about. `exterior` and `cantileverGrowsWithMove`
// come from MODEL, which knows what is outside and what stands under it.
const outside = (extra = {}) => wall('south', 0, 0, 20, 0, {
  stepFt: 0.5, exterior: true, cantileverFt: 0, cantileverGrowsWithMove: true, ...extra,
});
const bare = { rooms: [], openings: [] };

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── 1 · The free zone passes straight through ────────────────────────────
check('a foot of overhang is free, and the wall moves the whole foot',
  T => [T.allowedMove(outside(), 1, { ...bare, walls: [outside()] }).delta, 1]);
check('exactly 2 feet is still free',
  T => [T.allowedMove(outside(), 2, { ...bare, walls: [outside()] }).delta, 2]);
check('and a free move is a LOCAL cantilever, not a foundation move',
  T => [T.allowedMove(outside(), 2, { ...bare, walls: [outside()] }).kind, T.KIND.CANTILEVER]);
// The kind is not a restatement of the distance: an interior partition moving
// the same two feet is a different operation, with no foundation under it.
check('the same two feet on a partition is an interior move',
  T => [T.allowedMove(wall('p', 0, 0, 12, 0), 2, { ...bare, walls: [wall('p', 0, 0, 12, 0)] }).kind,
    T.KIND.INTERIOR]);

// ── 2 · The middle band: blocked in TOY, advised in DRAFTING ─────────────
// PROVISIONAL: stopping at the near edge rather than refusing outright is the
// implementation default, flagged as undecided in toy-constraints.js. If that
// ruling changes, this check changes with it — deliberately, not silently.
check('TOY stops the drag at the near edge of the band',
  T => [T.allowedMove(outside(), 3, { ...bare, walls: [outside()], mode: T.MODE.TOY }).delta, 2]);
check('and says it was the band that stopped it, not the distance',
  T => [T.allowedMove(outside(), 3, { ...bare, walls: [outside()], mode: T.MODE.TOY }).kind,
    T.KIND.BLOCKED_BAND]);
check('DRAFTING permits the same three feet',
  T => [T.allowedMove(outside(), 3, { ...bare, walls: [outside()], mode: T.MODE.DRAFTING }).delta, 3]);
check('and hands back the band it landed in',
  T => [T.allowedMove(outside(), 3, { ...bare, walls: [outside()], mode: T.MODE.DRAFTING }).band,
    T.BAND.BUMP_FOUNDATION]);
// The advice is the reason DRAFTING permits it at all: permitted silently, the
// drafter learns nothing and buys a beam they did not know they were buying.
check('with advice naming the beam',
  T => [/beam/.test((T.allowedMove(outside(), 3,
    { ...bare, walls: [outside()], mode: T.MODE.DRAFTING }).advice || {}).text || ''), true]);
check('and the signpost that says where the real fix lives',
  T => [/foundation bone/.test((T.allowedMove(outside(), 3,
    { ...bare, walls: [outside()], mode: T.MODE.DRAFTING }).advice || {}).signpost || ''), true]);
// Mode is passed in and never inferred. Same wall, same distance, same
// drawing: only the declared mode differs, and the answers differ.
check('mode is the only difference between those two answers',
  T => {
    const ctx = mode => ({ ...bare, walls: [outside()], mode });
    return [T.allowedMove(outside(), 3, ctx(T.MODE.TOY)).delta
      === T.allowedMove(outside(), 3, ctx(T.MODE.DRAFTING)).delta, false];
  });
// The default is the careful one. A caller that forgets to say gets TOY,
// because a missing mode granting the expensive detail is the failure that
// looks like a working feature.
check('a caller that declares no mode is treated as TOY',
  T => [T.allowedMove(outside(), 3, { ...bare, walls: [outside()] }).delta, 2]);
// Capability is not a costume: the character riding along changes nothing.
check('the skin on the screen does not change what the wall may do',
  T => [T.allowedMove(outside(), 3,
    { ...bare, walls: [outside()], mode: T.MODE.TOY, character: 'gruff', skin: 'blue' }).delta, 2]);

// ── 3 · Past 4'-6" it is a foundation move, and it says so ───────────────
// Free again beyond the band, but only as a DIFFERENT operation: the
// foundation moves out under the wall and everything above follows. The
// caller declares that; silence is not consent, because "does the bone move
// by default" is still undecided.
check('six feet with the foundation following is permitted',
  T => [T.allowedMove(outside(), 6,
    { ...bare, walls: [outside()], mode: T.MODE.DRAFTING, foundationFollows: true }).delta, 6]);
check('and it is a GLOBAL foundation move, not a bigger cantilever',
  T => [T.allowedMove(outside(), 6,
    { ...bare, walls: [outside()], mode: T.MODE.DRAFTING, foundationFollows: true }).kind,
    T.KIND.FOUNDATION_MOVE]);
check('with the foundation left where it is, the same six feet is not granted',
  T => [T.allowedMove(outside(), 6,
    { ...bare, walls: [outside()], mode: T.MODE.DRAFTING }).delta, 4.5]);

// ── 4 · Bodily drag: the wall keeps its length, the ends stretch ─────────
// The dragged wall travels sideways as one body and the walls meeting it at
// each end grow or shrink. That is what holds the corners at 90°; stretching
// the dragged wall instead racks the house one drag at a time.
{
  // `corner: false` on the returns is what lets them flex instead of being
  // carried — see the note under check 4d.
  const south = () => wall('south', 0, 0, 20, 0);
  const west = () => wall('west', 0, 0, 0, -12, { corner: false });
  const east = () => wall('east', 20, 0, 20, -12, { corner: false });
  const ctx = () => ({ ...bare, walls: [south(), west(), east()] });
  const moved = T => T.allowedMove(south(), 2, ctx());

  check('the dragged wall is the only thing that moves',
    T => [moved(T).group.join(','), 'south']);
  check('and it keeps its own length',
    T => [moved(T).lengthFt, 20]);
  check('both end walls stretch',
    T => [moved(T).stretches.map(s => s.wallId).sort().join(','), 'east,west']);
  check('each by the distance the wall travelled',
    T => [moved(T).stretches.map(s => Math.round(s.stretchFt * 1000) / 1000).join(','), '2,2']);
  check('and the stretch is reported from length to length, not as a bare delta',
    T => [moved(T).stretches.map(s => `${s.fromFt}->${s.toFt}`).join(','), '12->14,12->14']);
  // Pulling the other way shrinks them, and a shrink is a negative stretch
  // rather than a second concept.
  check('dragging back shrinks the same two walls',
    T => [T.allowedMove(south(), -2, ctx()).stretches
      .map(s => Math.round(s.stretchFt * 1000) / 1000).join(','), '-2,-2']);

  // ── 4d · WHAT TODAY'S GATHERER ACTUALLY PRODUCES ──────────────────────
  // Without `corner: false` the returns are WELDED to the dragged wall, so
  // they are carried, not stretched, and the honest answer is an empty list.
  // toy-context.js sets no `bearing` flags today, so `weldsWith` welds every
  // end-to-end pair and this — not the case above — is what a real gathered
  // shell hands back. Recorded as a check so it is a known property of the
  // current gatherer rather than a surprise at wiring time.
  const welded = () => ({ ...bare, walls: [south(), wall('west', 0, 0, 0, -12),
    wall('east', 20, 0, 20, -12)] });
  check('a welded shell carries its end walls instead, and stretches nothing',
    T => [T.allowedMove(south(), 2, welded()).stretches.length, 0]);
  check('because every wall touching the drag came along',
    T => [T.allowedMove(south(), 2, welded()).group.sort().join(','), 'east,south,west']);
}

// ── 5 · Angled and curved geometry is inert, and it spreads by contact ───
// An old drawing full of angles must still open, and the only safe answer for
// a wall this function cannot reason about is to leave it exactly where it is.
{
  const angled = wall('angled', 0, 0, 10, 7);
  const square = wall('square', 10, 7, 10, 20);   // touches the angled one
  const clear = wall('clear', 60, 0, 60, 20);     // touches nothing
  const walls = [angled, square, clear];
  const ctx = { ...bare, walls };

  check('an angled wall does not move',
    T => [T.allowedMove(angled, 2, ctx).delta, 0]);
  check('and it is ineligible, which is not the same as blocked',
    T => [T.allowedMove(angled, 2, ctx).kind, T.KIND.INELIGIBLE]);
  // Named against the wall's OWN geometry. Refusing it because the square wall
  // beside it touches something angled is the right answer for the wrong
  // reason, and the wrong reason is the one that gets printed on the screen.
  check('and the refusal is about that wall, not its neighbour',
    T => [T.allowedMove(angled, 2, ctx).reason, T.REASON.NOT_ORTHOGONAL]);
  check('a square wall TOUCHING an angled one does not move either',
    T => [T.allowedMove(square, 2, ctx).delta, 0]);
  check('and it names the contact rather than blaming its own geometry',
    T => [T.allowedMove(square, 2, ctx).reason, T.REASON.TOUCHES_NON_ORTHOGONAL]);
  check('a square wall away from the angle still moves',
    T => [T.allowedMove(clear, 2, ctx).delta, 2]);
  // TOY has to know which walls get a grip tab BEFORE anything is dragged, so
  // the predicate answers on its own, from the same rule.
  check('eligibility answers without a move being proposed',
    T => [T.eligibility(square, walls).eligible, false]);
  check('and agrees with the move it would have refused',
    T => [T.eligibility(square, walls).reason, T.allowedMove(square, 2, ctx).reason]);
  check('an eligible wall says so',
    T => [T.eligibility(clear, walls).eligible, true]);
}

// ── 6 · Interior minimums, approached from both sides ────────────────────
// room-standards.js says a BEDROOM needs 97 sq ft and 9'-8" least dimension.
// Those numbers are read from the office's table, never restated here — this
// harness would still pass if the office changed them, which is the point.
{
  const shared = wall('shared', 0, 0, 0, 12);
  const bedroom = sign => ({
    ...bare,
    walls: [shared],
    rooms: [{ id: 'bed', category: 'bedroom', clearWidthFt: 12, clearDepthFt: 12,
      bounds: [{ wallId: 'shared', dim: 'width', sign }] }],
  });
  check('pushing in stops at the minimum instead of refusing the drag',
    T => [T.allowedMove(shared, 3, bedroom(-1)).delta, 2]);
  check('and names the room it stopped for',
    T => [T.allowedMove(shared, 3, bedroom(-1)).roomId, 'bed']);
  check('approached from the other side, it clamps the same way',
    T => [T.allowedMove(shared, -3, bedroom(1)).delta, -2]);
  check('growing the room is never what a minimum stops',
    T => [T.allowedMove(shared, -4, bedroom(-1)).delta, -4]);
  check('a clamp is not a cantilever, and does not claim to be',
    T => [T.allowedMove(shared, 3, bedroom(-1)).kind, T.KIND.INTERIOR]);
}

// ── Run ──────────────────────────────────────────────────────────────────
function run(T) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(T); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// Each mutant is a rule someone could plausibly get wrong — the band edges,
// the two modes, the contact test — and each must be caught by a check that
// names it. A mutant nothing catches means the rule is not actually protected.
const MUTATIONS = [
  ['the free band ends at 3 feet instead of 2',
    s => s.replace('const CANTILEVER_FREE_FT = 2;', 'const CANTILEVER_FREE_FT = 3;')],
  ['the far band edge moves from 4\'-6" to 6\'',
    s => s.replace('const CANTILEVER_PILES_FT = 4.5;', 'const CANTILEVER_PILES_FT = 6;')],
  ['the free band is exclusive, so exactly 2 feet costs a beam',
    s => s.replace('if (overhang <= CANTILEVER_FREE_FT) return BAND.FREE;',
      'if (overhang < CANTILEVER_FREE_FT) return BAND.FREE;')],
  ['the modes are swapped: TOY advises and DRAFTING blocks',
    s => s.replace('if (mode === MODE.DRAFTING && band === BAND.BUMP_FOUNDATION) return;',
      'if (mode === MODE.TOY && band === BAND.BUMP_FOUNDATION) return;')],
  ['the band is advisory in both modes',
    s => s.replace('if (mode === MODE.DRAFTING && band === BAND.BUMP_FOUNDATION) return;',
      'if (band === BAND.BUMP_FOUNDATION) return;')],
  ['mode defaults to DRAFTING when the caller says nothing',
    s => s.replace('const mode = ctx.mode || MODE.TOY;', 'const mode = ctx.mode || MODE.DRAFTING;')],
  ['a foundation move is permitted whether or not the foundation follows',
    s => s.replace('if (band === BAND.BUMP_AND_PILES && foundationFollows) return;',
      'if (band === BAND.BUMP_AND_PILES) return;')],
  ['past 4\'-6" is reported as a bigger cantilever',
    s => s.replace('return cantileverBand(overhang) === BAND.BUMP_AND_PILES',
      'return false')],
  ['the touching-wall test is dropped, so only the angled wall itself is inert',
    s => s.replace(
      "if (others.some(other => !isOrthogonal(other) && endsTouch(wall, other))) {",
      'if (false) {')],
  ['contact is judged by identity rather than by touching ends',
    s => s.replace('endsTouch(wall, other)', 'other.id === wall.id')],
  ['an angled wall is inert but reports nothing about why',
    s => s.replace('if (!isOrthogonal(wall)) return REASON.NOT_ORTHOGONAL;', '')],
  ['eligibility answers from its own rule instead of the one that moves walls',
    s => s.replace('const inert = inertReason(wall, walls || [wall]);',
      'const inert = isOrthogonal(wall) ? null : REASON.NOT_ORTHOGONAL;')],
  ['the dragged wall is stretched along with the ends',
    s => s.replace('if (groupIds.includes(other.id) || !other.start || !other.end) return;',
      'if (!other.start || !other.end) return;')],
  ['the end wall is measured from the corner that moved, not the pinned one',
    s => s.replace("const pinned = other[endName === 'start' ? 'end' : 'start'];",
      'const pinned = other[endName];')],
  ['the stretch is reported as a magnitude, so a shrink reads as a growth',
    s => s.replace('stretchFt: toFt - fromFt', 'stretchFt: Math.abs(toFt - fromFt)')],
  ['the room minimum is checked against the box instead of the standards',
    s => s.replace('if (!verdict.ok) {', 'if (false) {')],
  ['the advice loses its signpost to the foundation bone',
    s => s.replace('go downstairs and bump the foundation bone out', 'try a smaller number')],
  ['a permitted band move carries no advice at all',
    s => s.replace('if (result.band && ADVICE[result.band]) result.advice = ADVICE[result.band];', '')],
];

if (MUTATION_MODE) {
  console.log('\nMUTATION                                                              CAUGHT BY');
  let survivors = 0, broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(70)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(70)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
