// THE CLOSET OBJECT — a small room standing IN a room, not a bite taken out of
// its outline.
//
// Movie's ruling, 1 Sep: a room in TOY MODE is always a rectangle and a closet
// is an object placed in it. That is what keeps every rule in the toy simple —
// the room stays the shape the rules are good at, and the awkward thing becomes
// a type with its own size and its own checks. The same move as the
// jack-and-jill bath.
//
// The numbers below are the object's own spec and have ONE HOME. A depth option
// may be offered later, so 2'-1" is a value here rather than a literal typed at
// each use.
//
// No room rule lives in this file. It answers two questions — what size is a
// closet, and which wall should it stand against — and the constraint module
// decides what any of that is allowed to mean.
//
// ── SCOPE NOTE, NOT BUILT HERE ──────────────────────────────────────────
// This module is WIRED INTO NOTHING. Nothing calls `placeIn`, no closet is
// drawn from it, and merging it puts no closet on screen. It exists because it
// was written before the board moved, and it is left in place so whoever picks
// the board up starts from tested code rather than a blank file.
//
// What is still owed, and is that board's work rather than this file's:
//
//   AUTO-PLACE A CLOSET IN EVERY SECONDARY BEDROOM, UNASKED. (Movie, 1 Sep.)
//   The drafter may move it or delete it afterwards; the toy just never leaves
//   one out. The only non-placement is a REFUSAL — no wall can take it without
//   covering a window, a door or a swing — and that reports rather than
//   forcing one in. `placeIn` already returns exactly that refusal; what does
//   not exist is the pass that walks the plan's bedrooms and calls it.
//
//   The minimum clear strip in front of a closet is still Movie's number. See
//   CLEAR_STRIP_MIN_FT below.
if (!window.DraftClosets) {
(() => {
  // ── Movie's dimensions, 1 Sep ─────────────────────────────────────────
  const INSIDE_DEPTH_FT = 2 + 1 / 12;   // 2'-1" clear. Fixed for now.
  const WALL_FT = 3.5 / 12;             // 3½" construction
  const RAIL_FT = 1;                    // dotted rail line off the back wall
  const SHELF_FT = 1.5;                 // "edge of shelf above", normal weight
  const CLOTHES_FT = 22 / 12;           // hanging clothes, centred on the rail
  // 4" EACH SIDE, ON THE OUTSIDE FACE ONLY. The inside face does not care, so
  // the trim is taken off the closet's outside width and never off the inside.
  const DOOR_TRIM_FT = 4 / 12;

  // The whole object's footprint in the room: the clear inside, plus the front
  // wall that carries the door. Both lines and the door sit inside this.
  const FOOTPRINT_DEPTH_FT = INSIDE_DEPTH_FT + WALL_FT;

  const DOORS = Object.freeze([
    { label: 'DD72', widthFt: 6 },
    { label: 'DD60', widthFt: 5 },
    { label: 'DD48', widthFt: 4 },
    { label: 'D36',  widthFt: 3 },
    { label: 'D30',  widthFt: 2.5 },
    { label: 'D24',  widthFt: 2 },
    { label: 'D18',  widthFt: 1.5 },
  ]);

  // ── THE CLEAR STRIP IN FRONT OF A CLOSET ──────────────────────────────
  //
  //   3'-0". Movie, 1 Sep.
  //
  // The floor you stand on to open it, and the rule that stops a bedroom being
  // shrunk until its own closet will not open. A builder's number rather than
  // a derived one, which is why it was asked for instead of guessed: measured
  // for context while it was outstanding, a shallow reach-in leaves about 6ft
  // of strip and a walk-in about 4ft, and 3'-0" clears both.
  const CLEAR_STRIP_MIN_FT = 3;

  const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const lengthOf = wall => Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);

  // The widest door off the ladder that leaves 4" of outside face each side for
  // its trim. A closet too narrow for a D18 is not a closet.
  const doorFor = outsideWidthFt => {
    const width = num(outsideWidthFt);
    if (width === null) return null;
    return DOORS.find(door => door.widthFt <= width - 2 * DOOR_TRIM_FT) || null;
  };

  const minWidthFt = () => DOORS[DOORS.length - 1].widthFt + 2 * DOOR_TRIM_FT;

  // A wall runs start→end; its LEFT is +90° from that run. `roomLoops` traces
  // a room with its interior on the left of every edge, so a closet standing in
  // the room sits to the left of the wall carrying it — the same convention
  // toy-context.js uses for its signs, deliberately.
  const inward = wall => {
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) return null;
    return { x: dz / len, z: -dx / len };
  };

  // The closet's footprint as a rectangle in world feet, given where along the
  // wall it starts.
  const footprintFor = (wall, alongFt, widthFt) => {
    const dir = (() => {
      const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
      const len = Math.hypot(dx, dz) || 1;
      return { x: dx / len, z: dz / len };
    })();
    const into = inward(wall);
    if (!into) return null;
    const at = t => ({ x: wall.start.x + dir.x * t, z: wall.start.z + dir.z * t });
    const a = at(alongFt), b = at(alongFt + widthFt);
    const push = pt => ({ x: pt.x + into.x * FOOTPRINT_DEPTH_FT, z: pt.z + into.z * FOOTPRINT_DEPTH_FT });
    return [a, b, push(b), push(a)];
  };

  // ── Geometry helpers for the placement rules ──────────────────────────
  const dot = (a, b) => a.x * b.x + a.z * b.z;
  const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });

  // Distance from a point to a segment — the primitive every clearance test
  // below is built from.
  const pointToSegment = (p, a, b) => {
    const ab = sub(b, a);
    const len2 = dot(ab, ab);
    if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.z - a.z);
    let t = dot(sub(p, a), ab) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + ab.x * t), p.z - (a.z + ab.z * t));
  };

  const segmentToSegment = (a1, a2, b1, b2) => Math.min(
    pointToSegment(a1, b1, b2), pointToSegment(a2, b1, b2),
    pointToSegment(b1, a1, a2), pointToSegment(b2, a1, a2),
  );

  // How close a rectangle comes to a segment, counting a segment that runs
  // through it as zero.
  const polyToSegment = (poly, a, b) => {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      best = Math.min(best, segmentToSegment(poly[i], poly[(i + 1) % poly.length], a, b));
    }
    return best;
  };

  // Where an opening sits in the world, along the wall that carries it.
  const openingSpan = (wall, opening) => {
    const len = lengthOf(wall);
    if (len < 1e-9) return null;
    const dir = { x: (wall.end.x - wall.start.x) / len, z: (wall.end.z - wall.start.z) / len };
    const at = t => ({ x: wall.start.x + dir.x * t, z: wall.start.z + dir.z * t });
    const from = num(opening.offsetFt) ?? 0;
    return [at(from), at(from + (num(opening.widthFt) ?? 0))];
  };

  // ── OPENINGS WIN. HARD. ───────────────────────────────────────────────
  // A closet that cannot be placed without covering a window, a door, or a
  // door's swing is a refusal, not a compromise. The swing matters on its own:
  // a closet can leave a door completely uncovered and still stop it opening.
  //
  // Which end a door is hinged on is not stored, so BOTH are treated as
  // possible — the swept region is everything within the door's own width of
  // its opening. That is conservative in the only direction it is safe to be.
  const blockedByOpening = (footprint, wall, alongFt, widthFt, walls, openings) => {
    const here = (openings || []).filter(opening => opening.wallId === wall.id);
    // On this wall, an overlap is enough: the closet would stand in front of it.
    const covers = here.some(opening => {
      const from = num(opening.offsetFt) ?? 0;
      const to = from + (num(opening.widthFt) ?? 0);
      return from < alongFt + widthFt - 1e-9 && to > alongFt + 1e-9;
    });
    if (covers) return true;
    // Anywhere in the room, a door needs its swing.
    return (openings || []).some(opening => {
      if (opening.type !== 'door') return false;
      const host = (walls || []).find(entry => entry.id === opening.wallId);
      if (!host) return false;
      const span = openingSpan(host, opening);
      if (!span) return false;
      return polyToSegment(footprint, span[0], span[1]) < (num(opening.widthFt) ?? 0) - 1e-9;
    });
  };

  // ── THE SQUARING RULE ─────────────────────────────────────────────────
  // "Put the closet in the location which will make the room more so a square,
  // one less of a rectangle." The closet's depth comes off the room's LONGER
  // dimension, so it stands against a short wall and never a long one. What is
  // scored is the room that is left: closest to square wins.
  const squarenessAfter = (walls, wall) => {
    const xs = walls.flatMap(entry => [entry.start.x, entry.end.x]);
    const zs = walls.flatMap(entry => [entry.start.z, entry.end.z]);
    let width = Math.max(...xs) - Math.min(...xs);
    let depth = Math.max(...zs) - Math.min(...zs);
    const into = inward(wall);
    if (!into) return 0;
    // The closet eats the dimension its wall faces across.
    if (Math.abs(into.x) > Math.abs(into.z)) width -= FOOTPRINT_DEPTH_FT;
    else depth -= FOOTPRINT_DEPTH_FT;
    if (width <= 0 || depth <= 0) return 0;
    return Math.min(width, depth) / Math.max(width, depth);
  };

  // ── WHERE THE CLOSET GOES ─────────────────────────────────────────────
  // In order, and the order is not negotiable:
  //
  //   1. Never cover a window, a door, or a door's swing. HARD.
  //   2. The wall that leaves the room squarest.
  //   3. Tie-break only: a wall shared with an adjacent bedroom or bathroom,
  //      a plumbing wall ahead of any other shared one. FOR SOUND DEADENING,
  //      not pipe access — two feet of hanging clothes against the noisiest
  //      wall the room has. Anyone later moving the closet OFF a plumbing wall
  //      to get at the pipes has misread this.
  //
  // Never promote 3 above 2: a closet dragged onto the shared wall against the
  // room's shape gives back the squareness the rule exists to win.
  //
  // Deterministic throughout. On a square room either wall satisfies the
  // squaring rule, and the same room must place the same closet twice running,
  // so ties fall through to the wall's own id rather than to whichever came
  // back first.
  const placeIn = ({ walls, openings, widthFt } = {}) => {
    const room = (walls || []).filter(wall => wall && wall.start && wall.end);
    const width = num(widthFt);
    if (!room.length || width === null) return { refused: 'NO_ROOM' };
    if (width < minWidthFt() - 1e-9) return { refused: 'TOO_NARROW' };

    const candidates = [];
    room.forEach(wall => {
      const run = lengthOf(wall);
      if (run < width - 1e-9) return;
      // Snug into either corner: that is what makes it a corner closet, and it
      // leaves the middle of the wall free rather than splitting the room.
      [0, run - width].forEach((alongFt, index) => {
        if (alongFt < -1e-9) return;
        const footprint = footprintFor(wall, alongFt, width);
        if (!footprint) return;
        if (blockedByOpening(footprint, wall, alongFt, width, room, openings)) return;
        candidates.push({
          wallId: wall.id,
          offsetFt: alongFt,
          footprint,
          squareness: squarenessAfter(room, wall),
          shared: wall.plumbing ? 2 : wall.shared ? 1 : 0,
          end: index,
        });
      });
    });
    if (!candidates.length) return { refused: 'NO_CLEAR_WALL' };

    candidates.sort((a, b) => (b.squareness - a.squareness)
      || (b.shared - a.shared)
      || String(a.wallId).localeCompare(String(b.wallId))
      || (a.end - b.end));
    const best = candidates[0];
    return {
      wallId: best.wallId,
      offsetFt: best.offsetFt,
      widthFt: width,
      depthFt: FOOTPRINT_DEPTH_FT,
      door: doorFor(width),
      footprint: best.footprint,
    };
  };

  // ── AUTO-PLACE, UNASKED ───────────────────────────────────────────────
  // "Auto-place a closet in every secondary bedroom, unasked." (Movie, 1 Sep.)
  // The drafter may move it or delete it afterwards; THE TOY JUST NEVER LEAVES
  // ONE OUT. A bedroom without a closet is the thing a beginner does not know
  // to notice, so the toy notices for them.
  //
  // The only non-placement is a REFUSAL -- no wall can take it without
  // covering a window, a door or a swing -- and it is reported rather than
  // forced in. A closet standing over a window is worse than a bedroom without
  // one, because the first is wrong and the second is merely unfinished.
  //
  // The primary suite is skipped: it gets an ensuite and a walk-in, which are
  // their own thing. Which room that is comes from the caller, because the
  // numbering that decides it belongs to the plan and not to this file.
  const DEFAULT_WIDTH_FT = 4;   // matches the shipped closet fixture's own default

  const dimEaten = wall => {
    const into = inward(wall);
    if (!into) return 'depth';
    return Math.abs(into.x) > Math.abs(into.z) ? 'width' : 'depth';
  };

  const autoPlace = ({ rooms, walls, openings, widthFt, existing } = {}) => {
    const byId = new Map((walls || []).map(wall => [wall.id, wall]));
    const already = existing || [];
    const placed = [];
    const refused = [];
    (rooms || []).forEach(room => {
      if (!room || room.category !== 'bedroom') return;
      if (room.primary) return;
      // Never a second one: the toy places what is missing, and a closet the
      // drafter moved is still that room's closet.
      if (already.some(closet => closet.roomId === room.id)) return;
      const roomWalls = (room.wallIds || []).map(id => byId.get(id)).filter(Boolean);
      if (!roomWalls.length) return;
      const width = num(widthFt) ?? DEFAULT_WIDTH_FT;
      const put = placeIn({ walls: roomWalls, openings, widthFt: width });
      if (put.refused) { refused.push({ roomId: room.id, reason: put.refused }); return; }
      placed.push({
        ...put,
        kind: 'closet',
        roomId: room.id,
        dim: dimEaten(byId.get(put.wallId)),
      });
    });
    return { placed, refused };
  };

  // ── THE CLEAR STRIP: what the constraint module asks about ────────────
  // `isLegal` knows nothing about closets. It asks whoever owns the object
  // whether it still fits, and this is that answer for a closet.
  //
  // What a closet needs is floor to stand on while you open it. It occupies
  // 2'-4 1/2" of the room measured across the wall it stands against, so what
  // is left in front is the room's dimension on that axis less the closet --
  // and the room dimensions in the configuration handed here are the PROPOSED
  // ones, which is what makes this answer a constraint on a move rather than a
  // description of the house at rest.
  //
  // WITH NO NUMBER SUPPLIED IT REFUSES NOTHING. That is the honest state while
  // the minimum is still Movie's to give: the whole path is wired, and the day
  // CLEAR_STRIP_MIN_FT stops being null it starts refusing, with no other
  // change anywhere.
  const clearanceFor = (object, config) => {
    if (!object || object.kind !== 'closet') return { ok: true };
    const room = ((config && config.rooms) || []).find(entry => entry.id === object.roomId);
    if (!room) return { ok: true };
    // The closet eats the dimension its wall faces across -- the same axis
    // toy-context.js calls the wall's `dim`, and stored on the closet when it
    // was placed so this never has to re-derive it.
    const across = object.dim === 'width'
      ? num(room.clearWidthFt)
      : num(room.clearDepthFt);
    if (across === null) return { ok: true };
    const haveFt = across - FOOTPRINT_DEPTH_FT;
    const needFt = CLEAR_STRIP_MIN_FT;
    return { ok: haveFt >= needFt - 1e-9, haveFt, needFt };
  };

  window.DraftClosets = Object.freeze({
    autoPlace,
    dimEaten,
    DEFAULT_WIDTH_FT,
    clearanceFor,
    placeIn,
    squarenessAfter,
    blockedByOpening,
    pointToSegment,
    polyToSegment,
    openingSpan,
    INSIDE_DEPTH_FT, WALL_FT, RAIL_FT, SHELF_FT, CLOTHES_FT, DOOR_TRIM_FT,
    FOOTPRINT_DEPTH_FT, DOORS, CLEAR_STRIP_MIN_FT,
    doorFor, minWidthFt, inward, footprintFor, lengthOf,
  });
})();
}
