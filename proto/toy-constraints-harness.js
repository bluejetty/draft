#!/usr/bin/env node
// TOY MODE CONSTRAINTS — the offline harness (turtle path step 1).
//
// toy-constraints.js is a pure module, so its rules are checked here in node
// against real geometry instead of through the browser: fast enough to run on
// every edit, and it can assert things no paint-scan could.
//
//   node proto/toy-constraints-harness.js
//
// Exit code 0 = every check passed.
//
// ── THE RULING THIS FILE EXISTS TO PROTECT ───────────────────────────────
//
//   THE TOY NEVER SILENTLY CORRECTS WHAT IT DID NOT CREATE.
//
// A wall that is not on the foot — the repro file has one at x = −1.386 —
// moves a WHOLE FOOT FROM WHERE IT IS, to −0.386. It does not snap to −1 or 0.
// A beginner cannot be blamed for a wall shifting 4½" they never asked to
// move, and old drawings continuing to open is a standing constraint on this
// project. (Movie's ruling, 31 Aug 2026.)
//
// It is written here, at the top, because it is exactly the kind of decision
// someone tidies up in six months without knowing it was decided.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = {};
['wall-types.js', 'room-standards.js', 'geometry-2d.js', 'toy-constraints.js']
  .forEach(file => { (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8')); });
const T = window.DraftToyConstraints;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ── Fixtures ─────────────────────────────────────────────────────────────
// A wall runs start→end; +x east, +z south. A wall running along +x has its
// LEFT to −z and its RIGHT to +z.
const wall = (id, x0, z0, x1, z1, extra = {}) => ({
  id, start: { x: x0, z: z0 }, end: { x: x1, z: z1 },
  wallType: 'stud_2x6', refLine: 'right', ...extra,
});

// ── 1 · A whole-foot wall moves whole feet ───────────────────────────────
{
  const w = wall('w1', 0, 0, 0, 20);
  const ctx = { walls: [w], rooms: [], openings: [] };
  check('a whole-foot wall moves a whole foot',
    T.allowedMove(w, 1, ctx).delta === 1);
  check('a fractional request rounds to the nearest foot',
    T.allowedMove(w, 0.8, ctx).delta === 1,
    `got ${T.allowedMove(w, 0.8, ctx).delta}`);
  check('a request under half a foot is no move at all',
    T.allowedMove(w, 0.4, ctx).delta === 0
    && T.allowedMove(w, 0.4, ctx).reason === T.REASON.NO_MOVE);
  check('the move is signed',
    T.allowedMove(w, -3, ctx).delta === -3);
}

// ── 2 · THE RULING: the −1.386 wall ──────────────────────────────────────
{
  const w = wall('odd', -1.386, 0, -1.386, 20);
  const ctx = { walls: [w], rooms: [], openings: [] };
  const move = T.allowedMove(w, 1, ctx);
  check('the off-foot wall moves a whole foot', move.delta === 1);
  const landedAt = w.start.x + move.delta;
  check('−1.386 lands on −0.386, not on −1 and not on 0',
    near(landedAt, -0.386),
    `landed at ${landedAt}`);
  check('nothing snapped the wall to a round number',
    !near(landedAt, -1) && !near(landedAt, 0));
}

// ── 3 · A move that takes a bedroom under its minimum ────────────────────
// room-standards.js says a BEDROOM needs 97 sq ft and 9'-8" least dimension.
// Those numbers are read, never restated here.
{
  const shared = wall('shared', 0, 0, 0, 12);
  const ctx = {
    walls: [shared],
    rooms: [{
      id: 'bed1', category: 'bedroom',
      clearWidthFt: 10, clearDepthFt: 12,
      bounds: [{ wallId: 'shared', dim: 'width', sign: -1 }],
    }],
    openings: [],
  };
  // This bedroom is 10'-0" wide against a 9'-8" least-dimension floor, so
  // there is no legal shrink at all: every whole foot breaks it, and the
  // answer is a flat refusal rather than a smaller move.
  const shrink = T.allowedMove(shared, 3, ctx);
  check('shrinking a bedroom below its floor is refused',
    shrink.delta === 0 && shrink.reason === T.REASON.MIN_ROOM,
    `got delta ${shrink.delta} reason ${shrink.reason}`);
  check('the refusal names the room',
    shrink.roomId === 'bed1');
  check('growing the room is never blocked by a minimum',
    T.allowedMove(shared, -4, ctx).delta === -4);

  // With room to give, a partly-blocked drag goes as far as it legally can
  // instead of refusing outright — 12' can lose two feet but not three.
  const roomy = {
    walls: [shared],
    rooms: [{
      id: 'bed3', category: 'bedroom',
      clearWidthFt: 12, clearDepthFt: 12,
      bounds: [{ wallId: 'shared', dim: 'width', sign: -1 }],
    }],
    openings: [],
  };
  check('a move that keeps the bedroom legal is allowed',
    T.allowedMove(shared, 2, roomy).delta === 2,
    `got ${T.allowedMove(shared, 2, roomy).delta}`);
  check('a partly-blocked drag moves as far as it legally can',
    T.allowedMove(shared, 3, roomy).delta === 2,
    `got ${T.allowedMove(shared, 3, roomy).delta}`);
}

// ── 4 · A welded group moves as one, and one blocked member blocks it ────
{
  // A shared wall with a closet return welded to it at the corner.
  const shared = wall('shared', 0, 0, 0, 12);
  const ret = wall('return', 0, 12, 6, 12);
  const walls = [shared, ret];
  const group = T.weldGroup(shared, { walls });
  check('the return is welded to the shared wall',
    group.length === 2 && group.some(w => w.id === 'return'));

  const free = T.allowedMove(shared, 2, { walls, rooms: [], openings: [] });
  check('a welded group moves as one',
    free.delta === 2 && free.group.length === 2,
    `delta ${free.delta} group ${JSON.stringify(free.group)}`);

  // Now put a room against the RETURN that cannot give up any width. The
  // finger is on `shared`; the block is on the other member.
  const blockedCtx = {
    walls,
    rooms: [{
      id: 'bed2', category: 'bedroom',
      clearWidthFt: 10, clearDepthFt: 11,
      bounds: [{ wallId: 'return', dim: 'width', sign: -1 }],
    }],
    openings: [],
  };
  const blocked = T.allowedMove(shared, 2, blockedCtx);
  check('one blocked member blocks the whole set',
    blocked.delta === 0, `got ${blocked.delta}`);
  check('and the refusal names the member that stopped it',
    blocked.reason === T.REASON.GROUP_MEMBER_BLOCKED
    && blocked.underlying === T.REASON.MIN_ROOM,
    `reason ${blocked.reason} underlying ${blocked.underlying}`);
}

// ── 5 · Non-orthogonal geometry is inert, and it spreads by contact ──────
{
  const angled = wall('angled', 0, 0, 10, 7);
  const square = wall('square', 10, 7, 10, 20);   // touches the angled one
  const clean = wall('clean', 40, 0, 40, 20);     // touches nothing
  const walls = [angled, square, clean];
  const ctx = { walls, rooms: [], openings: [] };

  check('an angled wall is not orthogonal', !T.isOrthogonal(angled));
  const a = T.allowedMove(angled, 2, ctx);
  check('an angled wall returns zero, inert',
    a.delta === 0 && a.reason === T.REASON.NOT_ORTHOGONAL,
    `got ${a.delta} / ${a.reason}`);

  const s = T.allowedMove(square, 2, ctx);
  check('a square wall TOUCHING an angled one is inert too',
    s.delta === 0
    && (s.reason === T.REASON.TOUCHES_NON_ORTHOGONAL
      || s.reason === T.REASON.NOT_ORTHOGONAL),
    `got ${s.delta} / ${s.reason}`);

  check('a clean wall well away from it still moves',
    T.allowedMove(clean, 2, ctx).delta === 2);

  const curved = wall('curved', 0, 40, 10, 40, { curved: true });
  check('a curved wall is inert whatever its endpoints say',
    T.allowedMove(curved, 2, { walls: [curved] }).reason === T.REASON.NOT_ORTHOGONAL);
}

// ── 6 · Cantilever bands ────────────────────────────────────────────────
{
  check('1\'-6" is the free band', T.cantileverBand(1.5) === T.BAND.FREE);
  check('exactly 2\'-0" is still free', T.cantileverBand(2) === T.BAND.FREE);
  check('3\'-0" wants the foundation bumped', T.cantileverBand(3) === T.BAND.BUMP_FOUNDATION);
  check('exactly 4\'-6" is still the middle band', T.cantileverBand(4.5) === T.BAND.BUMP_FOUNDATION);
  check('beyond 4\'-6" wants piles too', T.cantileverBand(5) === T.BAND.BUMP_AND_PILES);

  const silent = wall('c1', 0, 0, 0, 20, { cantileverFt: 1.5 });
  const quiet = T.allowedMove(silent, 1, { walls: [silent], rooms: [], openings: [] });
  check('a 1\'-6" cantilever moves silently',
    quiet.delta === 1 && !quiet.band, `delta ${quiet.delta} band ${quiet.band}`);

  const over = wall('c2', 0, 0, 0, 20, { cantileverFt: 3 });
  const ctx = { walls: [over], rooms: [], openings: [] };
  const stopped = T.allowedMove(over, 1, ctx);
  check('a 3\'-0" cantilever is blocked in TOY MODE',
    stopped.delta === 0 && stopped.reason === T.REASON.CANTILEVER,
    `delta ${stopped.delta} reason ${stopped.reason}`);
  check('and the block carries the band in its reason',
    stopped.band === T.BAND.BUMP_FOUNDATION, `band ${stopped.band}`);

  // The same verdict, the other presentation: DRAFTING permits the middle
  // band with advice. This is why the band is data and not a thrown error.
  const drafting = T.allowedMove(over, 1, { ...ctx, mode: T.MODE.DRAFTING });
  check('DRAFTING MODE permits the middle band',
    drafting.delta === 1, `got ${drafting.delta} / ${drafting.reason}`);
  check('and still reports the band as advice',
    drafting.band === T.BAND.BUMP_FOUNDATION, `band ${drafting.band}`);
}

// ── 7 · refLine: asking for 12 produces 12'-0" clear ────────────────────
// The failure this pins is exact: a 2×6 wall is 5½", so measuring on the line
// instead of the face hands the user 11'-6½" when they typed 12.
{
  const west = wall('west', 0, 0, 0, 20, { refLine: 'right' });
  const east = wall('east', 12, 0, 12, 20, { refLine: 'right' });
  // The room lies between them: to the LEFT of the west wall's run (+z south,
  // so left is −x… ) — sides are passed explicitly precisely so this is not
  // guesswork inside the module.
  const sideWest = -1, sideEast = 1;

  const naiveClear = T.clearFromLineGap(12, west, sideWest, east, sideEast);
  check('measuring on the line under-delivers by a wall thickness',
    near(naiveClear, 12 - 5.5 / 12),
    `naive clear ${naiveClear} (expected ${12 - 5.5 / 12})`);
  check('and that shortfall is the 11\'-6½" the spec names',
    near(naiveClear, 11 + 6.5 / 12, 1e-3),
    `naive clear ${naiveClear}`);

  const gap = T.lineGapForClear(12, west, sideWest, east, sideEast);
  check('asking for 12 clear puts the LINES 12\'-5½" apart',
    near(gap, 12 + 5.5 / 12), `gap ${gap}`);
  check('and that gap really does measure 12\'-0" clear',
    near(T.clearFromLineGap(gap, west, sideWest, east, sideEast), 12));

  // Thickness itself is never rounded: the material keeps its true dimension.
  check('the wall is still 5½" thick', near(T.thicknessFt(west), 5.5 / 12));
}

// ── 8 · Openings travel with their wall ─────────────────────────────────
{
  const w = wall('host', 0, 0, 0, 10);
  const ctx = {
    walls: [w], rooms: [],
    openings: [{ id: 'd1', wallId: 'host', offsetFt: 3, widthFt: 3 }],
  };
  check('an opening that fits does not block the move',
    T.allowedMove(w, 1, ctx).delta === 1);

  const tight = {
    walls: [w], rooms: [],
    openings: [{ id: 'd2', wallId: 'host', offsetFt: 9.9, widthFt: 3 }],
  };
  const verdict = T.isLegal(tight);
  check('an opening running off the end of its wall is illegal',
    !verdict.ok && verdict.violations[0].reason === T.REASON.OPENING_WOULD_NOT_FIT);
}

// ── 9 · The predicate is usable on its own (RABBIT's input) ─────────────
{
  const legal = T.isLegal({
    walls: [wall('a', 0, 0, 0, 12)],
    rooms: [{ id: 'r', category: 'bedroom', clearWidthFt: 10, clearDepthFt: 12, bounds: [] }],
    openings: [],
  });
  check('a legal configuration answers ok with no violations',
    legal.ok && legal.violations.length === 0);

  const illegal = T.isLegal({
    walls: [wall('a', 0, 0, 0, 12)],
    rooms: [{ id: 'r', category: 'bedroom', clearWidthFt: 6, clearDepthFt: 8, bounds: [] }],
    openings: [],
  });
  check('an illegal one names every rule it breaks',
    !illegal.ok && illegal.violations[0].reason === T.REASON.MIN_ROOM
    && illegal.violations[0].failures.length === 2,
    JSON.stringify(illegal.violations[0]));

  check('the predicate does not mutate what it is asked about', (() => {
    const room = { id: 'r', category: 'bedroom', clearWidthFt: 10, clearDepthFt: 12,
      bounds: [{ wallId: 'a', dim: 'width', sign: -1 }] };
    const w = wall('a', 0, 0, 0, 12);
    T.allowedMove(w, 2, { walls: [w], rooms: [room], openings: [] });
    return room.clearWidthFt === 10 && w.start.x === 0;
  })());
}

// ── Report ───────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n  ${failures.length} FAILED, ${passed} passed\n`);
  failures.forEach(name => console.error(`   ✘ ${name}`));
  console.error('');
  process.exit(1);
}
console.log(`\n  ${passed} checks passed\n`);
