#!/usr/bin/env node
// THE CLOSET OBJECT — the offline harness.
//
//   node proto/closets-harness.js
//
// Exit code 0 = every check passed.
//
// ── THE RULING THIS FILE EXISTS TO PROTECT ──────────────────────────────
//
//   A ROOM IN TOY MODE IS ALWAYS A RECTANGLE. A CLOSET IS AN OBJECT PLACED
//   IN IT — NOT A BITE TAKEN OUT OF ITS OUTLINE.
//
// (Movie, 1 Sep 2026.) It is the third answer to the same question and the
// only one that holds: "rectangles only" was wrong because a bedroom with a
// closet in the corner is an L and that is the commonest room in a house; the
// L ruling that replaced it was unnecessary once the closet stops being a
// shape and becomes a type. The room stays the shape every other rule is good
// at, and the awkward thing gets its own size and its own checks.
//
// So there is no neck measurement here and there must never be one. If a room
// in this file is not a rectangle, something upstream has gone wrong.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = {};
['closets.js'].forEach(file => { (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8')); });
const C = window.DraftClosets;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const inches = ft => `${Math.round(ft * 12)}"`;

// A room's four walls, traced so the interior is on the LEFT of every edge --
// the convention roomLoops produces and toy-context.js reads. +x east, +z south.
const rect = (w, d, ids = ['N', 'E', 'S', 'W']) => ([
  { id: ids[0], start: { x: 0, z: 0 }, end: { x: w, z: 0 } },
  { id: ids[1], start: { x: w, z: 0 }, end: { x: w, z: d } },
  { id: ids[2], start: { x: w, z: d }, end: { x: 0, z: d } },
  { id: ids[3], start: { x: 0, z: d }, end: { x: 0, z: 0 } },
]);

// ── 1 · The object's own dimensions ──────────────────────────────────────
// Movie's numbers, and they have ONE home: a depth option may be offered
// later, so 2'-1" is a value rather than a literal typed at each use.
{
  check('inside depth is 2\'-1" clear', near(C.INSIDE_DEPTH_FT, 2 + 1 / 12),
    `${inches(C.INSIDE_DEPTH_FT)}`);
  check('construction is 3 1/2"', near(C.WALL_FT, 3.5 / 12), `${inches(C.WALL_FT)}`);
  check('the rail line is 1\'-0" off the back wall', near(C.RAIL_FT, 1));
  // These two are a foot apart and the write-up briefly had them at the same
  // offset, which would have drawn one line over the other.
  check('the shelf-above line is 1\'-6" off the back wall, not 1\'-0"',
    near(C.SHELF_FT, 1.5) && C.SHELF_FT !== C.RAIL_FT, `${inches(C.SHELF_FT)}`);
  check('both lines sit inside the clear depth',
    C.RAIL_FT < C.INSIDE_DEPTH_FT && C.SHELF_FT < C.INSIDE_DEPTH_FT);
  // The object standing in the room is the clear inside PLUS the front wall
  // that carries the door -- 2'-4 1/2", not 2'-1". The room loses the whole
  // thing, so this is the number the squaring rule spends.
  check('the footprint is the inside plus the front wall',
    near(C.FOOTPRINT_DEPTH_FT, 2 + 1 / 12 + 3.5 / 12), `${inches(C.FOOTPRINT_DEPTH_FT)}`);
}

// ── 2 · The door, and which face the trim comes off ──────────────────────
// 4" EACH SIDE, ON THE OUTSIDE FACE ONLY -- the inside face does not care.
// Taking it off the inside instead is a different and stricter rule: the
// inside is already 7" narrower than the outside, so the two disagree about
// both the smallest closet and the door a given closet gets.
{
  check('the smallest closet is a D18 plus its trim, 2\'-2"',
    near(C.minWidthFt(), 1.5 + 8 / 12), inches(C.minWidthFt()));
  check('and anything under that is not a closet', C.doorFor(2) === null);
  check('a 2\'-2" closet takes a D18', C.doorFor(1.5 + 8 / 12).label === 'D18');
  check('a 4\'-0" closet takes a D36', C.doorFor(4).label === 'D36',
    JSON.stringify(C.doorFor(4)));
  // The width at which the two readings of the trim rule visibly disagree: 4"
  // each side off the outside allows a DD48 here, 4" off the inside does not.
  check('a 4\'-8" closet takes a DD48, which is the outside-face reading',
    C.doorFor(4 + 8 / 12).label === 'DD48', JSON.stringify(C.doorFor(4 + 8 / 12)));
  check('the door always leaves 4" of outside face each side',
    C.DOORS.every(door => {
      const width = door.widthFt + 2 * C.DOOR_TRIM_FT;
      return C.doorFor(width).widthFt === door.widthFt;
    }));
}

// ── 3 · THE SQUARING RULE ────────────────────────────────────────────────
// "Put the closet in the location which will make the room more so a square,
// one less of a rectangle." The depth comes off the room's LONGER dimension,
// so the closet stands against a SHORT wall and never a long one.
{
  // A 12 x 14 bedroom. N and S run 12 (the short walls); E and W run 14.
  const room = rect(12, 14);
  const put = C.placeIn({ walls: room, openings: [], widthFt: 4 });
  check('the closet lands on a short wall, not a long one',
    put.wallId === 'N' || put.wallId === 'S', JSON.stringify(put));

  // Worked both ways, which is the whole argument: same closet, opposite
  // effect on the room that is left.
  const onShort = C.squarenessAfter(room, room[0]);   // N, eats the 14
  const onLong = C.squarenessAfter(room, room[1]);    // E, eats the 12
  check('against the short wall the room comes out squarer',
    onShort > onLong, `short ${onShort.toFixed(3)} vs long ${onLong.toFixed(3)}`);
  // 14 - 2'-4 1/2" leaves 11'-7 1/2" against the 12: near enough square.
  // 12 - 2'-4 1/2" leaves 9'-7 1/2" against the 14: longer and thinner.
  check('and the numbers are the ones that argument rests on',
    near(onShort, (14 - C.FOOTPRINT_DEPTH_FT) / 12, 1e-9)
      && near(onLong, (12 - C.FOOTPRINT_DEPTH_FT) / 14, 1e-9),
    `${onShort} / ${onLong}`);

  // DETERMINISM. The same room must place the same closet twice running, and
  // a square room satisfies the squaring rule on all four walls -- so the tie
  // has to fall through to something stable rather than to whichever wall was
  // looked at first.
  const square = rect(12, 12);
  const first = C.placeIn({ walls: square, openings: [], widthFt: 4 });
  const again = C.placeIn({ walls: square.slice().reverse(), openings: [], widthFt: 4 });
  check('a square room places the same closet however its walls are ordered',
    first.wallId === again.wallId && near(first.offsetFt, again.offsetFt),
    `${first.wallId}@${first.offsetFt} vs ${again.wallId}@${again.offsetFt}`);
}

// ── 4 · OPENINGS WIN, AND THE SWING COUNTS ───────────────────────────────
// Hard rule. A closet that cannot be placed without covering a window, a door,
// or a door's swing is a refusal -- never a closet placed on top of a window.
{
  const room = rect(12, 14);
  // A window across the middle of BOTH short walls. The squaring rule wants a
  // short wall; it cannot have one, and must give way rather than cover glass.
  const openings = [
    { id: 'w1', wallId: 'N', offsetFt: 3, widthFt: 6, type: 'window' },
    { id: 'w2', wallId: 'S', offsetFt: 3, widthFt: 6, type: 'window' },
  ];
  const put = C.placeIn({ walls: room, openings, widthFt: 4 });
  check('a window on the short walls pushes the closet to a long one',
    put.wallId === 'E' || put.wallId === 'W', JSON.stringify(put));
  check('and squareness is what it gave up, not the window',
    !put.refused);

  // Glass on every wall, with no clear run left anywhere: a refusal to report,
  // not a closet standing over a window.
  const boarded = ['N', 'E', 'S', 'W'].map((id, i) =>
    ({ id: `g${i}`, wallId: id, offsetFt: 1, widthFt: 10, type: 'window' }));
  check('and when no wall is clear at all, it refuses',
    C.placeIn({ walls: room, openings: boarded, widthFt: 4 }).refused === 'NO_CLEAR_WALL');

  // A DOOR'S SWING, which is the half that is easy to miss: this door is on
  // the WEST wall and the closet would sit in the corner beside it, covering
  // nothing -- and stopping it opening.
  const swing = [{ id: 'd1', wallId: 'W', offsetFt: 10, widthFt: 3, type: 'door' }];
  const clear = C.placeIn({ walls: room, openings: swing, widthFt: 4 });
  const corner = C.footprintFor(room[0], 0, 4);   // N wall, hard into the NW corner
  check('a door swing blocks a closet that covers none of the door',
    C.blockedByOpening(corner, room[0], 0, 4, room, swing) === true);
  check('so the closet goes somewhere it can be opened past',
    !clear.refused && !(clear.wallId === 'N' && near(clear.offsetFt, 0)),
    JSON.stringify(clear));
  // The same opening as a WINDOW has no swing, so the same corner is fine.
  const asWindow = swing.map(o => ({ ...o, type: 'window' }));
  check('and a window in the same place does not, because it has no swing',
    C.blockedByOpening(corner, room[0], 0, 4, room, asWindow) === false);
}

// ── 5 · The shared wall breaks ties, and never more than that ────────────
// For SOUND DEADENING -- two feet of hanging clothes between a bedroom and the
// noisiest wall it has. Not pipe access: anyone later moving a closet OFF a
// plumbing wall to get at the pipes has misread the rule.
{
  // A SQUARE room, so all four walls square it equally and the tie-break is
  // the only thing left to decide.
  const square = rect(12, 12);
  const shared = square.map(wall => (wall.id === 'S' ? { ...wall, shared: 'bedroom' } : wall));
  check('on a tie, the shared wall wins',
    C.placeIn({ walls: shared, openings: [], widthFt: 4 }).wallId === 'S',
    JSON.stringify(C.placeIn({ walls: shared, openings: [], widthFt: 4 })));

  const plumbed = shared.map(wall => (wall.id === 'E' ? { ...wall, shared: 'bathroom', plumbing: true } : wall));
  check('and a plumbing wall wins ahead of any other shared wall',
    C.placeIn({ walls: plumbed, openings: [], widthFt: 4 }).wallId === 'E',
    JSON.stringify(C.placeIn({ walls: plumbed, openings: [], widthFt: 4 })));

  // THE ONE THAT MATTERS. On an oblong room the shared wall must NOT drag the
  // closet off the wall that squares the room -- that gives back exactly the
  // squareness the rule exists to win. Here the long EAST wall is the shared
  // plumbing wall and it still loses.
  const oblong = rect(12, 14).map(wall =>
    (wall.id === 'E' ? { ...wall, shared: 'bathroom', plumbing: true } : wall));
  const put = C.placeIn({ walls: oblong, openings: [], widthFt: 4 });
  check('but a shared wall never outranks the squaring rule',
    put.wallId === 'N' || put.wallId === 'S', JSON.stringify(put));
}

// ── 6 · The clearance in front is unset, and honestly so ─────────────────
{
  // Movie supplied it on 1 Sep: 3'-0". It has one home, so the day a depth
  // option or a second kind of object arrives there is one number to revisit.
  check('the clear strip has exactly one home',
    near(C.CLEAR_STRIP_MIN_FT, 3));
}

// ── 7 · AUTO-PLACE, UNASKED ──────────────────────────────────────────────
// The toy never leaves a closet out of a secondary bedroom. The drafter may
// move or delete it afterwards -- what matters is that they are deciding
// against something rather than being asked to remember.
{
  // Two bedrooms and a bathroom side by side, each a plain rectangle. Walls
  // are shared where the rooms meet, which is the ordinary case rather than a
  // contrived one.
  const walls = [
    ...rect(12, 14, ['b1N', 'b1E', 'b1S', 'b1W']),
    ...rect(12, 14, ['b2N', 'b2E', 'b2S', 'b2W']),
    ...rect(8, 10, ['wcN', 'wcE', 'wcS', 'wcW']),
  ];
  const rooms = [
    { id: 'bed1', category: 'bedroom', primary: true, wallIds: ['b1N', 'b1E', 'b1S', 'b1W'] },
    { id: 'bed2', category: 'bedroom', wallIds: ['b2N', 'b2E', 'b2S', 'b2W'] },
    { id: 'wc1', category: 'wc', wallIds: ['wcN', 'wcE', 'wcS', 'wcW'] },
  ];
  const run = C.autoPlace({ rooms, walls, openings: [] });

  check('a secondary bedroom gets a closet without being asked',
    run.placed.length === 1 && run.placed[0].roomId === 'bed2',
    JSON.stringify(run.placed.map(p => p.roomId)));
  // The suite is skipped on purpose: it gets an ensuite and a walk-in, which
  // are their own thing, and the numbering that decides which room that is
  // belongs to the plan rather than to this module.
  check('the primary suite is left alone', !run.placed.some(p => p.roomId === 'bed1'));
  check('and a bathroom is not a bedroom', !run.placed.some(p => p.roomId === 'wc1'));
  check('the placed closet knows which room dimension it eats',
    run.placed[0].dim === 'width' || run.placed[0].dim === 'depth',
    JSON.stringify(run.placed[0]));
  check('and it carries a real door', run.placed[0].door && run.placed[0].door.label === 'D36',
    JSON.stringify(run.placed[0].door));

  // NEVER A SECOND ONE. The toy places what is missing; a closet the drafter
  // moved is still that room's closet, and a pass that ran twice must not
  // hand them another.
  const again = C.autoPlace({ rooms, walls, openings: [], existing: run.placed });
  check('running again places nothing, because nothing is missing',
    again.placed.length === 0, JSON.stringify(again.placed));

  // THE ONLY NON-PLACEMENT IS A REFUSAL, and it reports. A closet standing
  // over a window is worse than a bedroom without one: the first is wrong,
  // the second is merely unfinished.
  const glazed = ['b2N', 'b2E', 'b2S', 'b2W'].map((id, i) =>
    ({ id: `g${i}`, wallId: id, offsetFt: 1, widthFt: 10, type: 'window' }));
  const blocked = C.autoPlace({ rooms, walls, openings: glazed });
  check('a bedroom with no clear wall is refused, not given a closet anyway',
    blocked.placed.length === 0 && blocked.refused.length === 1
      && blocked.refused[0].roomId === 'bed2',
    JSON.stringify(blocked));
  check('and the refusal says why', blocked.refused[0].reason === 'NO_CLEAR_WALL');
}

// ── 8 · THE CLEAR STRIP, and the seam it answers ─────────────────────────
// toy-constraints.js knows nothing about closets. It asks whoever owns the
// object whether it still fits, and this is that answer -- which is what lets
// a bedroom refuse to shrink past its own closet without the constraint module
// ever learning what a closet is.
{
  const closet = { id: 'c1', kind: 'closet', roomId: 'bed2', dim: 'depth' };
  const room = depth => ({ id: 'bed2', clearWidthFt: 12, clearDepthFt: depth });
  const ask = depth => C.clearanceFor(closet, { rooms: [room(depth)] });

  // Movie's number, 1 Sep: 3'-0" of floor to stand on. The closet's own
  // 2'-4 1/2" plus that strip is 5'-4 1/2", so a room shallower than that
  // cannot hold an openable closet.
  check('the minimum is Movie\'s 3\'-0", not a derived number',
    near(C.CLEAR_STRIP_MIN_FT, 3), `${C.CLEAR_STRIP_MIN_FT}`);
  check('a room too shallow to open the closet is refused',
    ask(5).ok === false, JSON.stringify(ask(5)));
  check('and one with the strip intact is not',
    ask(6).ok === true, JSON.stringify(ask(6)));
  check('the refusal carries both what was needed and what was left',
    near(ask(5).needFt, 3) && near(ask(5).haveFt, 5 - C.FOOTPRINT_DEPTH_FT),
    JSON.stringify(ask(5)));

  // What it MEASURES is right regardless, and is the half that can be checked
  // now: a 12ft room less the closet's own 2'-4 1/2" leaves 9'-7 1/2" to stand
  // in.
  check('but the strip it reports is the floor actually left in front',
    near(ask(12).haveFt, 12 - C.FOOTPRINT_DEPTH_FT), `${ask(12).haveFt}`);
  check('and it measures across the wall the closet stands against',
    near(C.clearanceFor({ ...closet, dim: 'width' }, { rooms: [room(30)] }).haveFt,
      12 - C.FOOTPRINT_DEPTH_FT),
    'a closet on the width axis measured the depth');

  // A thing that is not a closet is not this module's to answer for.
  check('anything that is not a closet is somebody else\'s answer',
    C.clearanceFor({ id: 'x', kind: 'stair', roomId: 'bed2' }, { rooms: [room(4)] }).ok === true);
}

// ── Report ───────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n  ${failures.length} FAILED, ${passed} passed\n`);
  failures.forEach(name => console.error(`   ✘ ${name}`));
  console.error('');
  process.exit(1);
}
console.log(`\n  ${passed} checks passed\n`);
