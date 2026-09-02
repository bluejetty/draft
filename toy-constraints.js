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
// REQUIRES window.DraftGeometry2D, window.DraftWallTypes and window.DraftRoomStandards -- resolved at CALL time, not at load. A page may list this
// script before its dependency and still work; only the room and wall rules needs the
// dependency present by the time it is called.
//
// It was captured at load until 2 Sep, which meant a page whose script order
// put this first got a module that loaded clean, reported every export, and
// threw later from a call site naming a different file.
if (!window.DraftToyConstraints) {
(() => {
  const geo = () => window.DraftGeometry2D;
  const wallTypes = () => window.DraftWallTypes;
  const standards = () => window.DraftRoomStandards;

  // ── Tunables ──────────────────────────────────────────────────────────
  const FOOT_FT = 1;                 // the toy's unit: the user moves whole feet
  // THE ONE EXCEPTION TO THE FOOT, and it is a permitted one. The rounding
  // rule allows half-feet before inches are ever allowed, and an EXTERIOR wall
  // is where that earns its keep: a foot is a lot of house to gain or lose in
  // one press, and the outside wall is the one people nudge to make a room
  // work. Inches stay out of the input path entirely.
  const HALF_FOOT_FT = 0.5;
  const CANTILEVER_FREE_FT = 2;      // up to here, silent
  const CANTILEVER_PILES_FT = 4.5;   // beyond here, bump out AND add piles
  const ORTHO_TOL_DEG = 0.5;         // how far off square still counts as square
  const WELD_TOL_FT = 1 / 12;        // ends this close share a corner, so weld
  const OPENING_EDGE_FT = 2 / 12;    // an opening needs this much wall each side
  // WHERE THE STRUCTURE HAS TO CHANGE. Joists span the SHORT way, so a house
  // whose short span passes this needs a beam down the long axis -- and two at
  // third points past twice it, which is a second row of columns and a second
  // set of piles. The number is build-house.js's `beamAtFt`, read rather than
  // restated: the toy refusing at a foot the generator would happily have
  // built is worse than not refusing at all.
  const BEAM_AT_FT = 19;

  // ── Reason codes ──────────────────────────────────────────────────────
  // A NAMED SET, exported — never English assembled at the call site. A
  // blocked drag stops at the permitted position and the blocker says why in
  // the room's words ("BEDROOM 2 would be under 9'-8""), which is presentation
  // built FROM these codes rather than from strings this module wrote.
  const REASON = Object.freeze({
    NOT_ORTHOGONAL: 'NOT_ORTHOGONAL',
    TOUCHES_NON_ORTHOGONAL: 'TOUCHES_NON_ORTHOGONAL',
    MIN_ROOM: 'MIN_ROOM',
    OPENING_WOULD_NOT_FIT: 'OPENING_WOULD_NOT_FIT',
    CANTILEVER: 'CANTILEVER',
    GROUP_MEMBER_BLOCKED: 'GROUP_MEMBER_BLOCKED',
    OBJECT_CLEARANCE: 'OBJECT_CLEARANCE',
    NEEDS_A_BEAM: 'NEEDS_A_BEAM',
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
    const types = wallTypes().WALL_TYPES || [];
    const legacy = wallTypes().LEGACY_WALL_TYPES || {};
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
  // A wall's own step. Everything moves by the foot unless it says otherwise,
  // and only an exterior wall does -- passed in by MODEL rather than inferred,
  // because which walls are exterior is plan topology and this module has
  // never been in the business of working that out.
  const stepFor = wall => num(wall && wall.stepFt) ?? FOOT_FT;

  const quantiseFeet = (delta, stepFt = FOOT_FT) => {
    const d = num(delta);
    if (d === null) return 0;
    const step = num(stepFt) || FOOT_FT;
    return Math.round(d / step) * step;
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
    [b.start, b.end].some(q => geo().distance(p, q) <= WELD_TOL_FT));

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
  //   rooms:    [{ id, category, clearWidthFt, clearDepthFt,
  //               insideSqFt?, minDimensionFt?, bounds:
  //               [{ wallId, dim: 'width'|'depth', sign: +1|-1, runFt? }] }]
  //   openings: [{ id, wallId, offsetFt, widthFt }]
  //
  // A room's `bounds` say how its clear dimensions answer to a wall moving in
  // its own positive direction. MODEL owns that mapping because it owns plan
  // topology; this module owns what the resulting numbers are allowed to be.
  //
  // THE MEASURED NUMBERS ARE HANDED OVER, NOT RE-DERIVED. `insideSqFt` and
  // `minDimensionFt` are what MODEL's room-tag pass already computes off the
  // room's own loop, and they are what the standards get asked about. Deriving
  // the area here as width x depth instead is the area of a RECTANGLE: it
  // overstates an L by its notch — a 20x20 bounding box around a 300 sq ft L
  // reads 400 — and the toy would then permit a room the room tag flags on the
  // same drawing. One derivation, not two.
  //
  // Both are optional, and absent means the caller has only two dimensions to
  // offer: their product and their smaller are then the only numbers
  // consistent with what it said, which is exactly right for a rectangle.
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
      const verdict = standards().evaluateRoom({
        category: room.category,
        insideSqFt: num(room.insideSqFt) ?? width * depth,
        minDimensionFt: num(room.minDimensionFt) ?? Math.min(width, depth),
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
      const runFt = geo().distance(host.start, host.end);
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

    // ── PUSHING THE OUTSIDE OUT ─────────────────────────────────────────
    // It is not distance that stops an exterior wall, it is STRUCTURE. Joists
    // span the short way, so pushing the LONG wall out costs nothing -- the
    // span it crosses does not change -- while pushing the short one out
    // eventually needs a beam down the middle and the columns under it.
    //
    // A flat cap would refuse the first and permit the second, which is the
    // wrong way round on both counts. So the limit is the span itself, and the
    // toy can say the true thing when it stops: past here it needs a beam.
    //
    // The footprint's own short span is MODEL's to measure; absent, nothing is
    // checked, which is the honest reading of "no footprint was offered".
    const shortSpanFt = num(config && config.shortSpanFt);
    if (shortSpanFt !== null && shortSpanFt > BEAM_AT_FT) {
      violations.push({
        reason: REASON.NEEDS_A_BEAM,
        shortSpanFt,
        beamAtFt: BEAM_AT_FT,
        // Past twice the span it is two beams at third points, which is a
        // second row of columns and a second set of piles.
        beams: shortSpanFt > BEAM_AT_FT * 2 ? 2 : 1,
      });
    }

    // ── THE SEAM FOR THINGS STANDING IN A ROOM ──────────────────────────
    // A closet is an OBJECT placed in a room, not a bite taken out of its
    // outline (Movie, 1 Sep). That ruling is what keeps every rule above
    // simple: the room stays a rectangle, so the minimums measure the box and
    // no neck measurement is needed anywhere.
    //
    // But an object has clearance of its own. A bedroom can be shrunk until
    // its own closet will not open, and this module has to be able to refuse
    // that WITHOUT KNOWING WHAT A CLOSET IS. So it asks.
    //
    // `clearanceFor` is supplied by whoever owns the object and answers for
    // one object in a proposed configuration -- it can read the room's changed
    // dimensions out of that configuration, which is what a clear strip
    // depends on. This module knows only that `ok: false` is a violation, and
    // carries enough of the answer back for the refusal to name the thing.
    //
    // NO OBJECT REASONING BELONGS HERE, and none should ever be added: the day
    // a second kind of object needs clearance, it implements the same call.
    // With no callback supplied nothing is asked and nothing can refuse, which
    // is the honest state while the clear strip has no number yet.
    const clearanceFor = config && config.clearanceFor;
    if (typeof clearanceFor === 'function') {
      (config.objects || []).forEach(object => {
        const verdict = clearanceFor(object, config);
        if (!verdict || verdict.ok !== false) return;
        violations.push({
          reason: REASON.OBJECT_CLEARANCE,
          objectId: object.id,
          objectKind: object.kind,
          roomId: object.roomId,
          needFt: verdict.needFt,
          haveFt: verdict.haveFt,
        });
      });
    }

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
    // The short span answers to a move the same way a room's dimensions do:
    // MODEL says which walls grow it and by how much, because which wall faces
    // across the short axis is plan topology.
    const grows = (config.spanGrowsWith || []).filter(entry => groupIds.includes(entry.wallId));
    const shortSpanFt = num(config.shortSpanFt) === null ? config.shortSpanFt
      : num(config.shortSpanFt) + grows.reduce(
        (sum, entry) => sum + (entry.sign < 0 ? -1 : 1) * delta, 0);
    const rooms = (config.rooms || []).map(room => {
      const bounds = (room.bounds || []).filter(bound => groupIds.includes(bound.wallId));
      if (!bounds.length) return room;
      const width0 = num(room.clearWidthFt) ?? 0;
      const depth0 = num(room.clearDepthFt) ?? 0;
      let width = width0;
      let depth = depth0;
      // The measured area TRAVELS with the move instead of being recomputed
      // from the box afterwards: it answers to the run of the room's own edge
      // along the wall that moved, which MODEL measured off the loop. `runFt`
      // absent falls back to the opposite dimension — that run for a
      // rectangle, and the same rectangle the width x depth fallback assumes.
      let area = num(room.insideSqFt);
      bounds.forEach(bound => {
        const change = (bound.sign < 0 ? -1 : 1) * delta;
        const sweep = num(bound.runFt) ?? (bound.dim === 'depth' ? width0 : depth0);
        if (area !== null) area += change * sweep;
        if (bound.dim === 'depth') depth += change; else width += change;
      });
      const moved = { ...room, clearWidthFt: width, clearDepthFt: depth };
      if (area !== null) moved.insideSqFt = area;
      // The least dimension is the short side of the box the move just
      // changed, which is what MODEL's `minSide` is measuring in the first
      // place — so advancing it is reading the same box, not a second opinion.
      if (num(room.minDimensionFt) !== null) moved.minDimensionFt = Math.min(width, depth);
      return moved;
    });
    return { ...config, walls, rooms, shortSpanFt };
  };

  // WHAT STOPPED THE SET — in the same words whether it stopped you dead or
  // merely short. A room violation knows its room but not which wall shrank
  // it, so trace it back through the room's bounds: the wall that blocks a
  // group drag is usually not the one under the finger, and without naming it
  // a refusal reads as the app ignoring the user.
  const describeBlocker = (blocked, ctx, groupIds, grabbedId) => {
    const said = { reason: blocked.reason };
    if (blocked.band) said.band = blocked.band;
    if (blocked.roomId) said.roomId = blocked.roomId;
    // The MINIMUM that was hit, so a refusal can be put in the room's words
    // ("BEDROOM 2 would be under 9'-8"") rather than in this module's. Which
    // rule failed decides the sentence, so the presentation layer needs it and
    // must not go asking the standards a second question to find out.
    if (blocked.failures) said.failures = blocked.failures;
    // What the refusal has to name, when the thing that stopped the move was
    // an object standing in the room rather than the room itself.
    if (blocked.objectId !== undefined) said.objectId = blocked.objectId;
    if (blocked.objectKind !== undefined) said.objectKind = blocked.objectKind;
    let culprit = blocked.wallId || null;
    if (!culprit && blocked.roomId) {
      const room = (ctx.rooms || []).find(r => r.id === blocked.roomId);
      const bound = ((room && room.bounds) || []).find(b => groupIds.includes(b.wallId));
      culprit = bound ? bound.wallId : null;
    }
    if (culprit && culprit !== grabbedId) {
      said.reason = REASON.GROUP_MEMBER_BLOCKED;
      said.blockedBy = culprit;
      said.underlying = blocked.reason;
    }
    return said;
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

    const stepFt = stepFor(wall);
    const wanted = quantiseFeet(proposedDelta, stepFt);
    if (wanted === 0) return { delta: 0, reason: REASON.NO_MOVE, group: groupIds };

    // A GROUP'S PERMITTED DELTA IS THE SMALLEST PERMITTED DELTA OF ANY MEMBER:
    // one blocked member blocks the set. Walk from the wanted distance back
    // toward zero a foot at a time and take the largest the whole
    // configuration accepts, so a partly-blocked drag still moves as far as it
    // legally can instead of refusing outright.
    const base = { walls, rooms: ctx.rooms, openings: ctx.openings, minimums: ctx.minimums, mode,
      objects: ctx.objects, clearanceFor: ctx.clearanceFor, shortSpanFt: ctx.shortSpanFt,
      spanGrowsWith: ctx.spanGrowsWith };
    const step = wanted > 0 ? stepFt : -stepFt;
    let blocked = null;
    for (let d = wanted; Math.abs(d) >= stepFt - 1e-9; d -= step) {
      const verdict = isLegal(configAfterMove(base, groupIds, d));
      if (verdict.ok) {
        const result = { delta: d, group: groupIds };
        const advisory = (configAfterMove(base, groupIds, d).walls || [])
          .map(w => num(w.cantileverFt)).filter(ft => ft)
          .map(cantileverBand).find(band => band !== BAND.FREE);
        // A DRAG THAT STOPPED SHORT SAYS WHY. Without this the ruling — the
        // wall stops at the permitted position and the thing that stopped it
        // speaks — only holds when NOTHING was permitted, and the commoner
        // half (moved some, wanted more) has a wall stopping under the finger
        // for no stated reason, which on a touchscreen reads as a dropped
        // touch. `blocked` is the first refusal walking back from what was
        // asked, so it is the rule the user actually leaned on.
        if (blocked) Object.assign(result, describeBlocker(blocked, ctx, groupIds, wall.id));
        // The advisory band describes where the wall LANDED, so it is the
        // later word on `band`. The two can only both exist in DRAFTING, where
        // BUMP_FOUNDATION is permitted and only BUMP_AND_PILES blocks; in TOY
        // no permitted position is ever in a band, so `band` there is the one
        // that stopped you, which is what the BUMP_FOUNDATION steer reads.
        if (advisory) result.band = advisory;
        return result;
      }
      // THE BINDING CONSTRAINT IS THE CLOSEST ONE, not the furthest. Walking
      // back from what was asked, several rules can refuse the far positions
      // while only one refuses the position just past where the wall actually
      // stopped -- and that last one is the rule the user leaned on. Keeping
      // the first refusal instead reports whatever failed out at the finger,
      // which on a long drag is rarely what stopped it: drag a wall five feet
      // into a room and the area minimum fails out there, while the thing that
      // held you at one foot was the closet behind you.
      blocked = verdict.violations[0];
    }

    const refusal = { delta: 0, reason: REASON.NO_MOVE, group: groupIds };
    if (blocked) Object.assign(refusal, describeBlocker(blocked, ctx, groupIds, wall.id));
    return refusal;
  };

  window.DraftToyConstraints = Object.freeze({
    REASON,
    BAND,
    MODE,
    FOOT_FT,
    HALF_FOOT_FT,
    BEAM_AT_FT,
    stepFor,
    CANTILEVER_FREE_FT,
    CANTILEVER_PILES_FT,
    ORTHO_TOL_DEG,
    WELD_TOL_FT,
    OPENING_EDGE_FT,
    isLegal,
    allowedMove,
    describeBlocker,
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
