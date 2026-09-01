// TOY MODE CONSTRAINTS (turtle path step 1) — the one function every
// manipulation moves through, and the predicate underneath it.
//
// No DOM, no component state, no UI. That is the point of doing it first:
// every rule is argued once, here, where a test can prove it, instead of being
// re-argued inside three different painters later. MODEL gathers the real
// walls and applies the verdict, exactly as it does for build-house.js and
// auto-stair.js.
//
// THE PREDICATE IS THE PRIMITIVE. `isLegal` answers "is this configuration
// legal?"; `allowedMove` proposes a configuration and asks it. That order is
// deliberate — RABBIT's four-plans-per-press generates against the predicate,
// and bolting a generator onto a move-validator afterwards is the expensive
// version of this.
if (!window.DraftToyConstraints) {
(() => {
  const geo = window.DraftGeometry2D;
  const wallTypes = window.DraftWallTypes;
  const standards = window.DraftRoomStandards;

  // ── Tunables ──────────────────────────────────────────────────────────
  const FOOT_FT = 1;                 // the toy's unit: the user moves whole feet
  const CANTILEVER_FREE_FT = 2;      // up to here, silent
  const CANTILEVER_PILES_FT = 4.5;   // beyond here, bump out AND add piles
  const ORTHO_TOL_DEG = 0.5;         // how far off square still counts as square
  const WELD_TOL_FT = 1 / 12;        // ends this close share a corner, so weld
  const OPENING_EDGE_FT = 2 / 12;    // an opening needs this much wall each side

  // ── Reason codes ──────────────────────────────────────────────────────
  // A NAMED SET, exported — never English assembled at the call site. What a
  // blocked drag does (nothing, resist, or explain) is an open ruling and a
  // property of the presentation, not of this function. Codes are what stop
  // that ruling turning into a find-and-replace across the UI once answered.
  const REASON = Object.freeze({
    NOT_ORTHOGONAL: 'NOT_ORTHOGONAL',
    TOUCHES_NON_ORTHOGONAL: 'TOUCHES_NON_ORTHOGONAL',
    MIN_ROOM: 'MIN_ROOM',
    OPENING_WOULD_NOT_FIT: 'OPENING_WOULD_NOT_FIT',
    CANTILEVER: 'CANTILEVER',
    GROUP_MEMBER_BLOCKED: 'GROUP_MEMBER_BLOCKED',
    NO_MOVE: 'NO_MOVE',
  });

  // Cantilever bands ride on the verdict as DATA, not as a thrown error,
  // because the two modes disagree about the middle one: TOY hard-blocks it
  // and steers toward bumping the foundation out, DRAFTING permits it with
  // advice. One verdict, two presentations.
  const BAND = Object.freeze({
    FREE: 'FREE',                       // ≤ 2'-0", silent
    BUMP_FOUNDATION: 'BUMP_FOUNDATION', // 2'-0" to 4'-6"
    BUMP_AND_PILES: 'BUMP_AND_PILES',   // beyond 4'-6"
  });

  const MODE = Object.freeze({ TOY: 'TOY', DRAFTING: 'DRAFTING' });

  // ── Small helpers ─────────────────────────────────────────────────────

  const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  // Thickness comes from the catalogue. A 2×6 wall is 5½" because WALL_TYPES
  // says so, and no number in this file is allowed to disagree with it.
  const thicknessFt = wall => {
    const types = wallTypes.WALL_TYPES || [];
    const legacy = wallTypes.LEGACY_WALL_TYPES || {};
    const id = wall && wall.wallType;
    const row = types.find(type => type.id === id)
      || types.find(type => type.id === legacy[id]);
    return row ? row.totalIn / 12 : 0;
  };

  // WHOLE FEET, quantised on the MOVE and never on the position.
  //
  // THE TOY NEVER SILENTLY CORRECTS WHAT IT DID NOT CREATE. A wall standing at
  // −1.386 moves a whole foot from where it is, to −0.386; it does not snap to
  // −1 or 0. A beginner cannot be blamed for a wall shifting 4½" they never
  // asked to move, and old drawings continuing to open is a standing
  // constraint on this project. (Movie's ruling, 31 Aug.)
  const quantiseFeet = delta => {
    const d = num(delta);
    if (d === null) return 0;
    return Math.round(d / FOOT_FT) * FOOT_FT;
  };

  // Square within tolerance, measured on the wall's own run. A curved wall is
  // never orthogonal whatever its endpoints say.
  const isOrthogonal = wall => {
    if (!wall || !wall.start || !wall.end) return false;
    if (wall.curved || num(wall.bulge)) return false;
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    if (Math.hypot(dx, dz) < 1e-9) return false;
    const deg = Math.abs(Math.atan2(dz, dx) * 180 / Math.PI) % 90;
    return Math.min(deg, 90 - deg) <= ORTHO_TOL_DEG;
  };

  const endsTouch = (a, b) => [a.start, a.end].some(p =>
    [b.start, b.end].some(q => geo.distance(p, q) <= WELD_TOL_FT));

  // NON-ORTHOGONAL GEOMETRY IS INERT, and it spreads by contact: a square wall
  // touching an angled one cannot be reasoned about either, because moving it
  // changes an angle this module has no opinion about. Such walls do nothing
  // rather than break, so an old drawing stays viewable and partly editable.
  const inertReason = (wall, walls) => {
    if (!isOrthogonal(wall)) return REASON.NOT_ORTHOGONAL;
    const others = (walls || []).filter(other => other.id !== wall.id);
    if (others.some(other => !isOrthogonal(other) && endsTouch(wall, other))) {
      return REASON.TOUCHES_NON_ORTHOGONAL;
    }
    return null;
  };

  // ── The inside face, not the centreline ───────────────────────────────
  // A wall runs start→end; its LEFT is +90° from that run and its RIGHT is
  // −90°. `refLine` says which line the stored geometry is, so the distance
  // from that line to the face a room actually sees is:
  //
  //   ref is on the room's side   → 0     (the line already is that face)
  //   ref is 'center'             → t/2
  //   ref is on the far side      → t     (the line is the other face)
  //
  // Measure a move on the centreline instead and the user asks for 12 and is
  // handed 11'-6½", after which every dimension on the sheet contradicts the
  // number they typed. That is the confusion the mode exists to prevent.
  // `roomSide` is +1 when the room lies to the wall's left, −1 to its right.
  const insideFaceOffsetFt = (wall, roomSide) => {
    const t = thicknessFt(wall);
    const ref = wall && wall.refLine;
    if (ref === 'center') return t / 2;
    const refSide = ref === 'left' ? 1 : -1;      // 'right' is the default face
    return refSide === (roomSide < 0 ? -1 : 1) ? 0 : t;
  };

  // What the user reads: face to face, never line to line.
  const clearFromLineGap = (lineGapFt, wallA, sideA, wallB, sideB) =>
    Math.abs(num(lineGapFt) ?? 0)
      - insideFaceOffsetFt(wallA, sideA)
      - insideFaceOffsetFt(wallB, sideB);

  // The inverse, which is what turns a typed 12 into a move. Ask for 12 clear
  // between two `refLine: 'right'` walls and the LINES must sit 12'-5½" apart,
  // not 12'-0" — the naive version is the 11'-6½" bug.
  const lineGapForClear = (clearFt, wallA, sideA, wallB, sideB) =>
    (num(clearFt) ?? 0)
      + insideFaceOffsetFt(wallA, sideA)
      + insideFaceOffsetFt(wallB, sideB);

  // ── Bones and welds ───────────────────────────────────────────────────
  // A wall has a bone, but bones weld into groups: drag one and everything
  // welded to it comes along. Room boundaries stay closed because the walls
  // forming a corner are welded AT that corner — you cannot drag one and leave
  // a gap. What flexes is a wall mid-run with slack either side.
  //
  // Welded from day one: anything carrying load above it, and anything a stair
  // sits against. Both arrive as flags from MODEL rather than being inferred,
  // because MODEL knows what stands above a wall and this module does not.
  const weldsWith = (a, b) => {
    if (!endsTouch(a, b)) return false;
    if (a.bearing && b.bearing) return true;
    if (a.stairAgainst && b.stairAgainst) return true;
    return a.corner !== false && b.corner !== false;
  };

  const weldGroup = (wall, context) => {
    const walls = (context && context.walls) || [wall];
    const explicit = (context && context.welds) || null;
    if (explicit) {
      const named = explicit.find(group => group.includes(wall.id));
      if (named) return walls.filter(w => named.includes(w.id));
    }
    const group = [wall];
    let grew = true;
    while (grew) {
      grew = false;
      walls.forEach(candidate => {
        if (group.some(member => member.id === candidate.id)) return;
        if (group.some(member => weldsWith(member, candidate))) { group.push(candidate); grew = true; }
      });
    }
    return group;
  };

  const cantileverBand = ft => {
    const overhang = Math.abs(num(ft) ?? 0);
    if (overhang <= CANTILEVER_FREE_FT) return BAND.FREE;
    if (overhang <= CANTILEVER_PILES_FT) return BAND.BUMP_FOUNDATION;
    return BAND.BUMP_AND_PILES;
  };

  // ── THE PREDICATE ─────────────────────────────────────────────────────
  // Is this configuration legal? Every rule that constrains a move constrains
  // a configuration, so this is the primitive and `allowedMove` merely asks it
  // about a proposed one.
  //
  //   walls:    [{ id, start, end, wallType, refLine, cantileverFt?, ... }]
  //   rooms:    [{ id, category, clearWidthFt, clearDepthFt, bounds:
  //               [{ wallId, dim: 'width'|'depth', sign: +1|-1 }] }]
  //   openings: [{ id, wallId, offsetFt, widthFt }]
  //
  // A room's `bounds` say how its clear dimensions answer to a wall moving in
  // its own positive direction. MODEL owns that mapping because it owns plan
  // topology; this module owns what the resulting numbers are allowed to be.
  const isLegal = config => {
    const walls = (config && config.walls) || [];
    const rooms = (config && config.rooms) || [];
    const openings = (config && config.openings) || [];
    const minimums = (config && config.minimums) || null;
    const mode = (config && config.mode) || MODE.TOY;
    const violations = [];

    // Interior minimums are the office's numbers, read and never restated.
    rooms.forEach(room => {
      const width = num(room.clearWidthFt) ?? 0;
      const depth = num(room.clearDepthFt) ?? 0;
      const verdict = standards.evaluateRoom({
        category: room.category,
        insideSqFt: width * depth,
        minDimensionFt: Math.min(width, depth),
      }, minimums);
      if (!verdict.ok) {
        violations.push({ reason: REASON.MIN_ROOM, roomId: room.id, failures: verdict.failures });
      }
    });

    // Openings travel with their wall; what this checks is that they still fit
    // the wall that carries them.
    openings.forEach(opening => {
      const host = walls.find(wall => wall.id === opening.wallId);
      if (!host) return;
      const runFt = geo.distance(host.start, host.end);
      const start = num(opening.offsetFt) ?? 0;
      const width = num(opening.widthFt) ?? 0;
      if (start < OPENING_EDGE_FT || start + width > runFt - OPENING_EDGE_FT) {
        violations.push({
          reason: REASON.OPENING_WOULD_NOT_FIT, wallId: host.id, openingId: opening.id,
        });
      }
    });

    // Cantilevers. The band is always reported; whether it is a violation is
    // the mode's business, which is exactly why the band is data.
    walls.forEach(wall => {
      const ft = num(wall.cantileverFt);
      if (!ft) return;
      const band = cantileverBand(ft);
      if (band === BAND.FREE) return;
      if (mode === MODE.DRAFTING && band === BAND.BUMP_FOUNDATION) return;  // advised, not blocked
      violations.push({ reason: REASON.CANTILEVER, wallId: wall.id, band, cantileverFt: ft });
    });

    return { ok: violations.length === 0, violations };
  };

  // Apply a move to a configuration WITHOUT touching the caller's objects:
  // the predicate has to be asked about a hypothetical, and a predicate that
  // mutates its subject cannot be asked twice.
  const configAfterMove = (config, groupIds, delta) => {
    const walls = (config.walls || []).map(wall => (groupIds.includes(wall.id)
      ? { ...wall, cantileverFt: num(wall.cantileverFt) === null
        ? wall.cantileverFt : num(wall.cantileverFt) + (wall.cantileverGrowsWithMove ? delta : 0) }
      : wall));
    const rooms = (config.rooms || []).map(room => {
      const bounds = (room.bounds || []).filter(bound => groupIds.includes(bound.wallId));
      if (!bounds.length) return room;
      let width = num(room.clearWidthFt) ?? 0;
      let depth = num(room.clearDepthFt) ?? 0;
      bounds.forEach(bound => {
        const change = (bound.sign < 0 ? -1 : 1) * delta;
        if (bound.dim === 'depth') depth += change; else width += change;
      });
      return { ...room, clearWidthFt: width, clearDepthFt: depth };
    });
    return { ...config, walls, rooms };
  };

  // ── ALLOWED MOVE ──────────────────────────────────────────────────────
  // Given where this wall is and what else is in the house, how far may it
  // actually move? Returns the permitted movement — possibly zero — plus a
  // reason code when the answer is not "all of it".
  const allowedMove = (wall, proposedDelta, context) => {
    const ctx = context || {};
    const walls = ctx.walls || (wall ? [wall] : []);
    const mode = ctx.mode || MODE.TOY;

    if (!wall) return { delta: 0, reason: REASON.NO_MOVE, group: [] };

    // Inert geometry first: cheapest to answer, and it is the answer that
    // keeps old drawings open.
    const group = weldGroup(wall, { ...ctx, walls });
    const groupIds = group.map(member => member.id);
    for (const member of group) {
      const inert = inertReason(member, walls);
      if (inert) return { delta: 0, reason: inert, wallId: member.id, group: groupIds };
    }

    const wanted = quantiseFeet(proposedDelta);
    if (wanted === 0) return { delta: 0, reason: REASON.NO_MOVE, group: groupIds };

    // A GROUP'S PERMITTED DELTA IS THE SMALLEST PERMITTED DELTA OF ANY MEMBER:
    // one blocked member blocks the set. Walk from the wanted distance back
    // toward zero a foot at a time and take the largest the whole
    // configuration accepts, so a partly-blocked drag still moves as far as it
    // legally can instead of refusing outright.
    const base = { walls, rooms: ctx.rooms, openings: ctx.openings, minimums: ctx.minimums, mode };
    const step = wanted > 0 ? FOOT_FT : -FOOT_FT;
    let blocked = null;
    for (let d = wanted; Math.abs(d) >= FOOT_FT - 1e-9; d -= step) {
      const verdict = isLegal(configAfterMove(base, groupIds, d));
      if (verdict.ok) {
        const result = { delta: d, group: groupIds };
        const advisory = (configAfterMove(base, groupIds, d).walls || [])
          .map(w => num(w.cantileverFt)).filter(ft => ft)
          .map(cantileverBand).find(band => band !== BAND.FREE);
        if (advisory) result.band = advisory;
        return result;
      }
      if (!blocked) blocked = verdict.violations[0];
    }

    const refusal = { delta: 0, reason: blocked ? blocked.reason : REASON.NO_MOVE, group: groupIds };
    if (blocked) {
      if (blocked.band) refusal.band = blocked.band;
      if (blocked.roomId) refusal.roomId = blocked.roomId;
      // WHICH MEMBER STOPPED THE SET. A room violation knows its room but not
      // which wall shrank it, so trace it back through the room's bounds. This
      // matters because the wall that blocks a group drag is usually not the
      // one under the finger — without naming it, a refusal reads as the app
      // ignoring the user.
      let culprit = blocked.wallId || null;
      if (!culprit && blocked.roomId) {
        const room = (ctx.rooms || []).find(r => r.id === blocked.roomId);
        const bound = (room && room.bounds || []).find(b => groupIds.includes(b.wallId));
        culprit = bound ? bound.wallId : null;
      }
      if (culprit && culprit !== wall.id) {
        refusal.reason = REASON.GROUP_MEMBER_BLOCKED;
        refusal.blockedBy = culprit;
        refusal.underlying = blocked.reason;
      }
    }
    return refusal;
  };

  window.DraftToyConstraints = Object.freeze({
    REASON,
    BAND,
    MODE,
    FOOT_FT,
    CANTILEVER_FREE_FT,
    CANTILEVER_PILES_FT,
    ORTHO_TOL_DEG,
    WELD_TOL_FT,
    OPENING_EDGE_FT,
    isLegal,
    allowedMove,
    configAfterMove,
    weldGroup,
    cantileverBand,
    thicknessFt,
    isOrthogonal,
    insideFaceOffsetFt,
    clearFromLineGap,
    lineGapForClear,
    quantiseFeet,
  });
})();
}
