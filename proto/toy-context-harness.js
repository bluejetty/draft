#!/usr/bin/env node
// TOY MODE CONTEXT — the offline harness (turtle path step 2).
//
//   node proto/toy-context-harness.js
//
// Exit code 0 = every check passed.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────
//
//   A SIGN BACKWARDS IS A TOY THAT REFUSES THE SAFE DIRECTION AND PERMITS
//   THE ILLEGAL ONE.
//
// Every other mistake in the mapping shows up as something obviously broken.
// This one shows up as software that works — tabs appear, walls move, refusals
// are worded politely — and quietly lets a beginner shrink a bedroom past its
// minimum while blocking them from making it bigger. It cannot be caught by
// looking at the screen, which is why the mapping is a module and why the
// first thing proved here is all four directions.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = {};
['wall-types.js', 'room-standards.js', 'geometry-2d.js', 'areas.js',
  'toy-constraints.js', 'toy-context.js']
  .forEach(file => { (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8')); });
const T = window.DraftToyConstraints;
const C = window.DraftToyContext;
const geo = window.DraftGeometry2D;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// +x east, +z south. A stud_2x6 wall is 5½" thick, so halfFt is 0.229166…
const wall = (id, x0, z0, x1, z1, extra = {}) => ({
  id, start: { x: x0, z: z0 }, end: { x: x1, z: z1 },
  wallType: 'stud_2x6', refLine: 'center', ...extra,
});
const boundOn = (room, wallId) => room.bounds.find(b => b.wallId === wallId);

// ── 1 · THE SIGNS, in all four directions ────────────────────────────────
// One 20x12 room, its four walls traced clockwise in x/z. Each wall is asked
// the same question: if you move along YOUR left normal, does this room grow
// or shrink? The answers must differ per wall, because "positive" is each
// wall's own direction and not a compass bearing.
{
  const walls = [
    wall('N', 0, 0, 20, 0),     // runs +x, left normal points -z (outward)
    wall('E', 20, 0, 20, 12),   // runs +z, left normal points +x (outward)
    wall('S', 20, 12, 0, 12),   // runs -x, left normal points +z (outward)
    wall('W', 0, 12, 0, 0),     // runs -z, left normal points -x (outward)
  ];
  const ctx = C.gather({ walls, categoryFor: () => 'bedroom' });
  check('one closed rectangle is one room', ctx.rooms.length === 1,
    `got ${ctx.rooms.length}`);
  const room = ctx.rooms[0];

  // Traced this way every left normal points OUT of the room, so every wall
  // grows it. That is the check: not "the signs are +1" but that all four
  // agree despite pointing at four different compass directions.
  ['N', 'E', 'S', 'W'].forEach(id => {
    check(`moving ${id} along its own left normal grows the room`,
      boundOn(room, id) && boundOn(room, id).sign === 1,
      JSON.stringify(boundOn(room, id)));
  });

  // Reverse a wall's stored direction and its left normal flips with it, so
  // the SAME physical move must now read as the opposite sign. This is the
  // check that fails if the mapping quietly uses a compass direction.
  const flipped = C.gather({
    walls: walls.map(w => (w.id === 'N' ? wall('N', 20, 0, 0, 0) : w)),
    categoryFor: () => 'bedroom',
  });
  check('reversing a wall reverses its sign, because left is the wall\'s own',
    boundOn(flipped.rooms[0], 'N').sign === -1,
    JSON.stringify(boundOn(flipped.rooms[0], 'N')));

  // A wall running along x opens and closes the DEPTH; one running along z
  // moves the WIDTH. Getting this backwards puts the move on the wrong
  // dimension and the minimum is then measured across the wrong axis.
  check('an east-west wall moves the depth', boundOn(room, 'N').dim === 'depth');
  check('a north-south wall moves the width', boundOn(room, 'E').dim === 'width');

  // The run each wall contributes is its own length, which is what the area
  // answers to when it moves.
  check('each bound carries the run of the room edge along it',
    near(boundOn(room, 'N').runFt, 20) && near(boundOn(room, 'E').runFt, 12),
    `N ${boundOn(room, 'N').runFt} E ${boundOn(room, 'E').runFt}`);
}

// ── 2 · The area matches what MODEL already computes ─────────────────────
// The room-tag pass takes centreline area, subtracts half a wall along every
// edge, and adds back the corner squares that subtraction doubles up. This
// module must produce that same number — the whole point of handing it over
// is that there is one derivation, so a second one that disagrees is worse
// than none.
{
  const walls = [
    wall('N', 0, 0, 20, 0), wall('E', 20, 0, 20, 12),
    wall('S', 20, 12, 0, 12), wall('W', 0, 12, 0, 0),
  ];
  const room = C.gather({ walls, categoryFor: () => 'bedroom' }).rooms[0];

  // Worked by hand from the same rule: 240 centreline, less 64ft of edge at
  // 0.2291666 half-thickness, plus 4 corner squares.
  const half = T.thicknessFt(walls[0]) / 2;
  const byHand = 240 - (20 + 12 + 20 + 12) * half + 4 * half * half;
  check('the inside area is MODEL\'s, to the last decimal',
    near(room.insideSqFt, byHand), `${room.insideSqFt} vs ${byHand}`);

  // And it is a real face-to-face area, not the centreline one.
  check('which is smaller than the centreline area it came from',
    room.insideSqFt < 240 && room.insideSqFt > 225, `${room.insideSqFt}`);

  // areas.js is the repo's own polygon area. The centreline figure this is
  // built from has to agree with it, or the two disagree about the polygon
  // before any wall thickness is involved.
  check('the centreline area agrees with areas.js on the same points',
    near(window.DraftAreas.polygonArea(room.points), 240),
    `polygonArea said ${window.DraftAreas.polygonArea(room.points)}`);

  check('the least dimension is the short side of the box, as minSide is',
    near(room.minDimensionFt, 12), `${room.minDimensionFt}`);
}

// ── 3 · An L: two edges on one wall, and an area the box overstates ──────
// A 20x20 L with a 10x10 bite out of its south-east corner: 300 sq ft of
// floor inside a 20x20 box. This is the shape that made the constraint module
// hand its area over instead of deriving it, so the mapping has to produce
// the honest number AND the run each wall actually contributes.
{
  const walls = [
    wall('N', 0, 0, 20, 0),
    wall('E', 20, 0, 20, 10),
    wall('MIDS', 20, 10, 10, 10),
    wall('MIDE', 10, 10, 10, 20),
    wall('S', 10, 20, 0, 20),
    wall('W', 0, 20, 0, 0),
  ];
  const room = C.gather({ walls, categoryFor: () => 'bedroom' }).rooms[0];

  check('the L is one room', room !== undefined);
  check('its box is 20 by 20',
    near(room.clearWidthFt, 20) && near(room.clearDepthFt, 20),
    `${room.clearWidthFt} x ${room.clearDepthFt}`);
  // 300 centreline, less the 80ft perimeter at half a wall, plus the six
  // corner squares — the same rule as the rectangle, on a shape the box would
  // have called 400.
  const half = T.thicknessFt(walls[0]) / 2;
  const byHand = 300 - 80 * half + 6 * half * half;
  check('but its area is the floor it actually has, not the box',
    near(room.insideSqFt, byHand), `${room.insideSqFt} vs ${byHand}`);
  check('and nothing like the 400 the bounding box would have said',
    room.insideSqFt < 300, `${room.insideSqFt}`);

  // The west wall runs the full 20; the north wall runs 20; the two notch
  // walls run 10 each. An area that answered to the box instead of the run
  // would take 20 sq ft off for a foot of the notch wall rather than 10.
  check('the notch walls contribute their own 10ft run',
    near(boundOn(room, 'MIDS').runFt, 10) && near(boundOn(room, 'MIDE').runFt, 10),
    JSON.stringify(room.bounds));
  check('and the full-length walls contribute 20',
    near(boundOn(room, 'W').runFt, 20) && near(boundOn(room, 'N').runFt, 20));
}

// ── 4 · The mapping feeds the predicate, and the verdict is the module's ──
// The point of the whole exercise: a gathered house goes into allowedMove
// unmodified and comes back with a verdict this module had no hand in.
{
  // A 26x10 shell split down the middle by a partition, so both rooms are
  // 13x10. The partition Ts into the shell rather than meeting it end to end,
  // so it is its own weld group and actually flexes -- a wall OF the shell
  // would drag all four and change nothing, which is section 5's point.
  //
  // Shrinking one of them has exactly ONE legal foot in it, and the number
  // that decides is worth reading carefully because it is not the obvious
  // one. The rooms are 13x10 on the centreline = 130 sq ft, but MODEL's
  // inside figure is 113.71: its half-wall deduction charges the FULL length
  // of a wall to every room that wall borders, and the north and south walls
  // run the whole 26ft across both. So one foot off leaves 103.71 and two
  // would leave 93.71, under the 97 sq ft floor -- the AREA rule bites, well
  // before the 9'-8" least dimension does.
  //
  // That deduction is MODEL's approximation, not this module's: reproducing
  // it is the job, since a mapping that computed a better number would have
  // the toy and the room tag disagree about the same room on the same
  // drawing. It is reported in the PR alongside the minSide note, not fixed
  // here.
  const shell = [
    wall('N', 0, 0, 26, 0), wall('E', 26, 0, 26, 10),
    wall('S', 26, 10, 0, 10), wall('W', 0, 10, 0, 0),
  ];
  const part = wall('P', 13, 0, 13, 10);
  const ctx = C.gather({ walls: [...shell, part], categoryFor: () => 'bedroom' });
  check('the gathered house is legal at rest', T.isLegal(ctx).ok,
    JSON.stringify(T.isLegal(ctx).violations));
  check('and it is two rooms', ctx.rooms.length === 2, `got ${ctx.rooms.length}`);

  // P runs +z so its left normal points +x. The room to its WEST therefore
  // grows when P moves positive, and the room to its EAST shrinks: one
  // partition, two rooms, opposite signs. Getting this wrong is the failure
  // that looks like working software.
  const west = ctx.rooms.find(r => Math.min(...r.points.map(pt => pt.x)) < 1);
  const east = ctx.rooms.find(r => r !== west);
  check('the room west of the partition grows in its positive direction',
    boundOn(west, 'P').sign === 1, JSON.stringify(boundOn(west, 'P')));
  check('and the room east of it shrinks, from the same wall and the same move',
    boundOn(east, 'P').sign === -1, JSON.stringify(boundOn(east, 'P')));

  // Negative delta walks P west: the west room shrinks, and it is the west
  // room that must stop the drag.
  check('the inside area is MODEL\'s, shared-wall deduction and all',
    near(west.insideSqFt, 130 - (26 + 10 + 26 + 10) * (T.thicknessFt(part) / 2)
      + 4 * (T.thicknessFt(part) / 2) ** 2), `${west.insideSqFt}`);

  const shrink = T.allowedMove(part, -5, ctx);
  check('a shrink that overshoots stops at the permitted foot',
    shrink.delta === -1, JSON.stringify(shrink));
  check('and the verdict names the room the mapping built',
    shrink.reason === T.REASON.MIN_ROOM && shrink.roomId === west.id,
    JSON.stringify(shrink));

  // The mirror image, which is the half a flipped sign would have broken
  // silently: the same overshoot the other way stops on the EAST room.
  const other = T.allowedMove(part, 5, ctx);
  check('and the same overshoot the other way is stopped by the other room',
    other.delta === 1 && other.roomId === east.id, JSON.stringify(other));
}

// ── 5 · What is deliberately not fabricated ──────────────────────────────
// MODEL has no per-wall bearing, stairAgainst or cantilever flag. Rather than
// invent them, the mapping leaves them absent and lets the constraint
// module's corner rule decide. The consequence is worth pinning because it is
// what the grip tabs will show: the shell is one group, partitions are not.
{
  const shell = [
    wall('N', 0, 0, 30, 0), wall('E', 30, 0, 30, 20),
    wall('S', 30, 20, 0, 20), wall('W', 0, 20, 0, 0),
  ];
  const part = wall('P', 15, 0, 15, 20);
  const ctx = C.gather({ walls: [...shell, part], categoryFor: () => 'bedroom' });

  check('no bearing flag is invented',
    ctx.walls.every(w => w.bearing === undefined && w.stairAgainst === undefined
      && w.cantileverFt === undefined));
  check('so the shell welds into one group',
    T.weldGroup(shell[0], { walls: ctx.walls }).length === 4,
    T.weldGroup(shell[0], { walls: ctx.walls }).map(w => w.id).join(','));
  check('and a partition that Ts into it is its own',
    T.weldGroup(part, { walls: ctx.walls }).length === 1,
    T.weldGroup(part, { walls: ctx.walls }).map(w => w.id).join(','));
  check('the partition splits the shell into two rooms',
    ctx.rooms.length === 2, `got ${ctx.rooms.length}`);
}

// ── 6 · Openings come across in feet, and orphans are dropped ────────────
{
  const walls = [
    wall('N', 0, 0, 20, 0), wall('E', 20, 0, 20, 12),
    wall('S', 20, 12, 0, 12), wall('W', 0, 12, 0, 0),
  ];
  const ctx = C.gather({
    walls,
    openings: [
      { id: 'd1', wallId: 'N', offset: 4, width: 3 },
      { id: 'ghost', wallId: 'GONE', offset: 1, width: 3 },
    ],
    categoryFor: () => 'bedroom',
  });
  check('MODEL\'s offset/width arrive as offsetFt/widthFt',
    ctx.openings.length === 1 && near(ctx.openings[0].offsetFt, 4)
      && near(ctx.openings[0].widthFt, 3), JSON.stringify(ctx.openings));
  check('an opening on a wall that is not here is dropped, not carried',
    !ctx.openings.some(o => o.id === 'ghost'));
}

// ── Report ───────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n  ${failures.length} FAILED, ${passed} passed\n`);
  failures.forEach(name => console.error(`   ✘ ${name}`));
  console.error('');
  process.exit(1);
}
console.log(`\n  ${passed} checks passed\n`);
