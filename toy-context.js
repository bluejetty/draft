// TOY MODE CONTEXT (turtle path step 2) — gathering the house into the shape
// `allowedMove` reads.
//
// toy-constraints.js decides what a house is ALLOWED to be. It cannot gather
// one: it is handed walls, rooms and openings and knows nothing about how
// MODEL stores a plan. This module is that mapping, and it is the real work of
// the grip-tab board.
//
// NO RULE LIVES HERE. Everything below is a measurement or a topological fact.
// What the resulting numbers are permitted to be stays in the constraint
// module, so it is argued once instead of drifting between painters.
//
// It sits outside MODEL for one reason: THE SIGNS. A room's `bounds` say how
// its clear dimensions answer to a wall moving in its own positive direction,
// and one sign backwards makes the toy refuse the safe direction and permit
// the illegal one — a failure that looks exactly like working software from
// the outside. Buried in a 21,000-line component it cannot be tested; here it
// can, in node, in all four directions.
// REQUIRES window.DraftGeometry2D and window.DraftToyConstraints -- resolved at CALL time, not at load. A page may list this
// script before its dependency and still work; only the room read needs the
// dependency present by the time it is called.
//
// It was captured at load until 2 Sep, which meant a page whose script order
// put this first got a module that loaded clean, reported every export, and
// threw later from a call site naming a different file.
if (!window.DraftToyContext) {
(() => {
  const geo = () => window.DraftGeometry2D;
  const toy = () => window.DraftToyConstraints;

  // MODEL's room-tag pass reads the same enclosures this does, with these
  // numbers. They are matched rather than chosen: different ones and the two
  // disagree about how many rooms the house has.
  const JOIN_FT = 0.7;          // ROOM_TAG_JOIN_FT
  const MIN_AREA_SQFT = 12;     // ROOM_TAG_MIN_AREA_SQFT
  const ON_LINE_FT = 0.05;      // a loop edge this close to a wall's line is on it
  const PARALLEL_TOL = 0.02;    // |sin| between an edge and the wall carrying it

  // ── A WALL'S POSITIVE DIRECTION ───────────────────────────────────────
  // Its LEFT normal — the same convention `insideFaceOffsetFt` already uses,
  // so "positive" means one thing across the two modules. A wall running
  // start→end has its left at +90° from the run, so a wall running along +x
  // points its left at −z.
  const leftNormal = wall => {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) return null;
    return { x: dz / len, z: -dx / len };
  };

  // Which of the two box dimensions this wall opens and closes. A wall running
  // along x has its normal along z, so it moves the DEPTH; a wall running
  // along z moves the WIDTH. Only meaningful for a square wall — which is the
  // only kind that ever gets a tab.
  const dimOf = wall => (Math.abs(wall.end.x - wall.start.x)
    >= Math.abs(wall.end.z - wall.start.z) ? 'depth' : 'width');

  // Which wall a loop edge runs along. `roomLoops` cuts walls where they
  // cross, so a room's edge is a PART of a wall and an L can put two edges on
  // the same one. Both are found by asking which segment's line carries the
  // edge's midpoint while running parallel to it — parallel matters, or a
  // corner point picks up the wall it is merely touching.
  const hostOf = (a, b, segments) => {
    const ex = b.x - a.x, ez = b.z - a.z;
    const elen = Math.hypot(ex, ez);
    if (elen < 1e-9) return null;
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    let best = null, bestD = ON_LINE_FT;
    segments.forEach(seg => {
      const sx = seg.end.x - seg.start.x, sz = seg.end.z - seg.start.z;
      const slen = Math.hypot(sx, sz);
      if (slen < 1e-9) return;
      const cross = Math.abs((ex * sz - ez * sx) / (elen * slen));
      if (cross > PARALLEL_TOL) return;
      const off = Math.abs((mid.x - seg.start.x) * (-sz) + (mid.z - seg.start.z) * sx) / slen;
      if (off < bestD) { bestD = off; best = seg; }
    });
    return best;
  };

  // ── A ROOM, IN THE WORDS THE PREDICATE USES ───────────────────────────
  const roomFrom = (loop, byId, categoryFor) => {
    const pts = loop.points;
    if (pts.length < 3) return null;
    const xs = pts.map(p => p.x), zs = pts.map(p => p.z);

    // MODEL's room-tag pass, matched rather than re-invented: centreline area,
    // less half a wall along every edge, plus the corner squares that
    // subtraction doubles up. The constraint module is handed this number
    // instead of deriving one, because two derivations disagree on an L.
    let inside = loop.area;
    loop.segments.forEach(seg => {
      inside -= Math.hypot(seg.end.x - seg.start.x, seg.end.z - seg.start.z) * seg.halfFt;
    });
    const halfAvg = loop.segments.reduce((sum, seg) => sum + seg.halfFt, 0)
      / Math.max(1, loop.segments.length);
    inside += pts.length * halfAvg * halfAvg;

    // The box, which is what MODEL's `minSide` measures and what a move moves.
    const clearWidthFt = Math.max(...xs) - Math.min(...xs);
    const clearDepthFt = Math.max(...zs) - Math.min(...zs);

    // ── THE SIGNS ───────────────────────────────────────────────────────
    // `roomLoops` returns interior faces traced so the room is on the LEFT of
    // every directed edge. So a wall whose own start→end agrees with the edge
    // has the room on ITS left too, and moving along its left normal walks
    // into the room and takes floor away. Disagree, and the same move walks
    // away from the room and gives floor back.
    const seen = new Map();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const runFt = Math.hypot(b.x - a.x, b.z - a.z);
      if (runFt < 1e-6) continue;
      const host = hostOf(a, b, loop.segments);
      if (!host || host.id === undefined || host.id === null) continue;
      const wall = byId.get(host.id);
      if (!wall) continue;
      const along = (b.x - a.x) * (wall.end.x - wall.start.x)
        + (b.z - a.z) * (wall.end.z - wall.start.z);
      const prior = seen.get(host.id);
      if (prior) {
        prior.runFt += runFt;
        // An L can put two stretches of one wall on the same room. The longer
        // stretch names the direction; they only disagree if the plan folds
        // back on itself, which is not a shape the toy can produce.
        if (runFt > prior.longest) { prior.longest = runFt; prior.sign = along > 0 ? -1 : 1; }
      } else {
        seen.set(host.id, { wallId: host.id, dim: dimOf(wall),
          sign: along > 0 ? -1 : 1, runFt, longest: runFt });
      }
    }
    const bounds = [...seen.values()].map(({ wallId, dim, sign, runFt }) =>
      ({ wallId, dim, sign, runFt }));

    return {
      id: loop.id,
      category: categoryFor ? categoryFor(loop) : null,
      clearWidthFt,
      clearDepthFt,
      insideSqFt: Math.max(0, inside),
      minDimensionFt: Math.min(clearWidthFt, clearDepthFt),
      bounds,
      points: pts,
    };
  };

  // ── GATHER ────────────────────────────────────────────────────────────
  // `walls` are MODEL's plan walls, already carrying id / start / end /
  // wallType / refLine. They are passed through untouched.
  //
  // WHAT IS DELIBERATELY NOT FABRICATED: `bearing`, `stairAgainst` and
  // `cantileverFt`. The constraint module reads them to decide which walls
  // weld, and MODEL tracks none of them per wall today. Inventing them here
  // would make the toy disagree with the model about what the house is, so
  // they are left absent and `weldsWith` falls through to its corner rule —
  // which welds every pair of walls that meet end to end. That makes the
  // exterior shell one rigid group whose tab slides the whole house, and
  // leaves interior partitions (which T into walls rather than meeting them
  // end to end) as the singletons that flex. Coherent, and honest about what
  // is known. Supplying the flags is its own board.
  const gather = ({ walls, openings, objects, clearanceFor, categoryFor, joinFt, minAreaSqFt } = {}) => {
    const plan = (walls || []).filter(wall => wall && wall.start && wall.end);
    const byId = new Map(plan.map(wall => [wall.id, wall]));

    // halfFt comes from the catalogue through the constraint module's own
    // reader, so a 2x6 wall is 5½" here for exactly the reason it is there.
    const loops = geo().roomLoops(plan.map(wall => ({
      id: wall.id,
      start: { x: wall.start.x, z: wall.start.z },
      end: { x: wall.end.x, z: wall.end.z },
      halfFt: toy().thicknessFt(wall) / 2,
    })), joinFt === undefined ? JOIN_FT : joinFt);

    const floor = minAreaSqFt === undefined ? MIN_AREA_SQFT : minAreaSqFt;
    const rooms = loops
      .map((loop, index) => roomFrom({ ...loop, id: `room-${index + 1}` }, byId, categoryFor))
      .filter(room => room && room.insideSqFt >= floor);

    return {
      walls: plan,
      rooms,
      // Things standing IN the rooms travel with the context untouched, and
      // whoever owns them answers for their clearance. This module measures
      // rooms; it does not know what a closet is either.
      objects: objects || [],
      clearanceFor,
      openings: (openings || []).map(opening => ({
        id: opening.id,
        wallId: opening.wallId,
        offsetFt: opening.offsetFt !== undefined ? opening.offsetFt : opening.offset,
        widthFt: opening.widthFt !== undefined ? opening.widthFt : opening.width,
      })).filter(opening => byId.has(opening.wallId)),
    };
  };

  window.DraftToyContext = Object.freeze({
    gather,
    leftNormal,
    dimOf,
    hostOf,
    JOIN_FT,
    MIN_AREA_SQFT,
  });
})();
}
