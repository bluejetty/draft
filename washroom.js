// THE PREDESIGNED WASHROOM — one three-piece WC, dealt by the bone, stacked
// floor to floor (board #315 room half, reworked; SURVEY-interior task 26).
//
// Movie's spec, 8 Sep. The numbers are the unit's own and have ONE HOME here,
// so a fixture that moves moves once.
//
// ── THE DIMENSIONS ARE FINISHED FACE TO FINISHED FACE ────────────────────
// The work order said 8'-7" x 5'-7" "outside-of-stud". IT IS NOT. Read that
// way the fixtures overrun the room by 14" and no arrangement recovers it --
// worked through before any of this was written, which is what the order
// asked for. Read as FINISHED FACES both dimensions land exactly:
//
//   length  30 tub depth + 36 toilet + 36 sink + 1 finish = 103" = 8'-7"
//   width    6 chase     + 60 tub length       + 1 finish =  67" = 5'-7"
//
// The unit brings its own walls OUTSIDE those faces, so its stud footprint
// is 9'-4" x 6'-2". Anyone reading "8'-7" outside of stud" is starting from
// the error this comment exists to stop.
//
// ── WHY THE 6" WALL ──────────────────────────────────────────────────────
// It stands between the wet wall and the tub, on the wet wall side, and it
// is a plumbing chase: it carries the supply up to the tub faucet so that
// EVERY faucet and hookup in the room lands in the one 2x6 wall. That is
// also what makes the LEVEL LOCK worth having -- stack the wet wall and the
// drain runs straight down. It is measured across the WIDTH, which is why it
// never appears in the 102" length run.
//
// ── WHAT THIS FILE DOES AND DOES NOT DO ──────────────────────────────────
// It answers what a washroom IS at a given size, and it carries the two
// placement RULES that are about geometry rather than about this page:
// stair landing zones (a general keep-out every auto-placer wants) and
// which side the unit takes. All of it returns plain geometry in feet.
//
// It owns no group or lock machinery, does no hit-testing, and never
// touches the drawing. WHERE a unit actually lands, and what it becomes
// once it does, is the caller's problem -- exactly as closets.js splits it.
//
// (This header said "no placement heuristic, no stair landing zones" until
// 8 Sep, when both had been added below it. A stale header is worse than no
// header: it is a claim a reader has no reason to doubt.)
if (!window.DraftWashroom) {
(() => {
  const IN = 1 / 12;

  // ── Movie's spec, 8 Sep ───────────────────────────────────────────────
  const TUB_LENGTH_IN = 60;
  const TUB_DEPTH_IN = 30;
  const CHASE_IN = 6;          // the wall between the wet wall and the tub
  const TOILET_RUN_IN = 36;    // clear floor between tub and sink -- the toilet's
  const SINK_RUN_IN = 36;      // the sink run at standard size
  const SINK_RUN_MAX_IN = 42;  // growth feeds the sink first, to here
  const FINISH_IN = 1;         // 1/2" cement board at the tub + 1/2" drywall

  // Construction. The wet wall is 2x6 because the stack and supplies live in
  // it; every other wall is 2x4.
  const WET_WALL_IN = 5.5;
  const WALL_IN = 3.5;
  const CEMENT_BOARD_IN = 0.5;   // around the tub
  const DRYWALL_IN = 0.5;        // everywhere else

  const TILE_IN = 12;            // the light-line floor grid, 12"x12"

  const STANDARD_LENGTH_IN = TUB_DEPTH_IN + TOILET_RUN_IN + SINK_RUN_IN + FINISH_IN;  // 103
  const STANDARD_WIDTH_IN = CHASE_IN + TUB_LENGTH_IN + FINISH_IN;                     // 67

  // ── THE GROWTH LADDER ─────────────────────────────────────────────────
  // Extra length feeds the SINK first, 36" -> 42". Once the sink is full,
  // further space opens BETWEEN TUB AND TOILET -- that is where a drafter
  // later swaps in a larger tub or a shower, so the room grows toward the
  // change it is most likely to be asked for.
  const runsForLength = (lengthIn) => {
    const spare = Math.max(0, lengthIn - STANDARD_LENGTH_IN);
    const toSink = Math.min(spare, SINK_RUN_MAX_IN - SINK_RUN_IN);
    return {
      tubDepthIn: TUB_DEPTH_IN,
      gapIn: spare - toSink,              // tub-to-toilet, for a future tub/shower
      toiletRunIn: TOILET_RUN_IN,
      sinkRunIn: SINK_RUN_IN + toSink,
      finishIn: FINISH_IN,
    };
  };

  // DOES THE ROOM HOLD ITS FIXTURES? Stated as a function because the whole
  // unit turns on it and the spec got it wrong once already.
  //
  // THE FIRST VERSION OF THIS WAS A TAUTOLOGY, and its own companion check
  // caught it: it summed the runs and compared them to the length, but
  // runsForLength derives the gap AS the remainder, so the sum equalled the
  // length whatever was asked. It could not fail. That is the shape this
  // repo keeps cataloguing -- a check whose broken state looks exactly like
  // its passing state -- and it was in code written twenty minutes earlier.
  //
  // So it measures against the SPEC instead: a room closes when it is long
  // enough for the fixed runs plus a sink at minimum, and when every run
  // lands inside its stated bounds. closes(94) -- the clear length the
  // "outside of stud" reading gives -- is FALSE, which is the error it
  // exists to catch.
  const MIN_LENGTH_IN = TUB_DEPTH_IN + TOILET_RUN_IN + SINK_RUN_IN + FINISH_IN;
  const closes = (lengthIn = STANDARD_LENGTH_IN) => {
    const r = runsForLength(lengthIn);
    const sum = r.tubDepthIn + r.gapIn + r.toiletRunIn + r.sinkRunIn + r.finishIn;
    const reasons = [];
    if (lengthIn < MIN_LENGTH_IN) {
      reasons.push(`${lengthIn}" is shorter than the ${MIN_LENGTH_IN}" the fixtures need`);
    }
    if (r.sinkRunIn < SINK_RUN_IN || r.sinkRunIn > SINK_RUN_MAX_IN) {
      reasons.push(`sink run ${r.sinkRunIn}" outside ${SINK_RUN_IN}-${SINK_RUN_MAX_IN}"`);
    }
    if (r.gapIn < 0) reasons.push(`negative tub-to-toilet gap ${r.gapIn}"`);
    if (r.toiletRunIn !== TOILET_RUN_IN) reasons.push(`toilet run moved to ${r.toiletRunIn}"`);
    if (r.tubDepthIn !== TUB_DEPTH_IN) reasons.push(`tub depth moved to ${r.tubDepthIn}"`);
    if (Math.abs(sum - lengthIn) > 1e-9) reasons.push(`runs sum to ${sum}", not ${lengthIn}"`);
    return { sum, lengthIn, ok: reasons.length === 0, reasons };
  };

  // ── THE UNIT, IN FEET, ANCHORED AT ITS WET-WALL CORNER ────────────────
  // u runs along the wet wall (the length); v runs away from it (the width).
  // The caller rotates and places; nothing here knows about north or a plan.
  //
  // ORDER ALONG u IS THE WALK-IN ORDER: door end first (sink), then toilet,
  // then the tub at the far end. The door lands opposite the wet wall at the
  // sink end -- the usual three-piece arrangement, and the furthest the room
  // allows the door to be from the tub.
  const layout = ({ lengthIn = STANDARD_LENGTH_IN, widthIn = STANDARD_WIDTH_IN } = {}) => {
    const r = runsForLength(lengthIn);
    const L = lengthIn * IN, W = widthIn * IN;

    // Walking in from the door end.
    let u = 0;
    const sink = { u0: u, u1: u + r.sinkRunIn * IN };
    u = sink.u1;
    const toilet = { u0: u, u1: u + r.toiletRunIn * IN };
    u = toilet.u1;
    const gap = { u0: u, u1: u + r.gapIn * IN };
    u = gap.u1;
    const tub = { u0: u, u1: u + r.tubDepthIn * IN };

    return {
      lengthFt: L,
      widthFt: W,
      // The wet wall runs the full length at v = 0. Everything with a supply
      // sits on it.
      wetWall: { v: 0, thicknessFt: WET_WALL_IN * IN, u0: 0, u1: L },
      fixtures: [
        // Sink and toilet stand against the wet wall.
        { kind: 'sink', u0: sink.u0, u1: sink.u1, v0: 0, v1: Math.min(22 * IN, W) },
        { kind: 'toilet', u0: toilet.u0, u1: toilet.u1, v0: 0, v1: Math.min(30 * IN, W) },
        // The tub spans the width BEYOND the chase, its faucet at the chase
        // end so the supply comes out of the wet wall.
        {
          kind: 'tub',
          u0: tub.u0, u1: tub.u1,
          v0: CHASE_IN * IN,
          v1: CHASE_IN * IN + TUB_LENGTH_IN * IN,
          faucetEnd: 'wet',
        },
      ],
      // The chase: 6" of wall between the wet wall and the tub, on the wet
      // wall side, for the tub's supply.
      chase: { u0: tub.u0, u1: tub.u1, v0: 0, v1: CHASE_IN * IN },
      // Cement board around the tub, drywall on the rest.
      finishes: [
        { kind: 'cement-board', thicknessFt: CEMENT_BOARD_IN * IN, at: 'tub' },
        { kind: 'drywall', thicknessFt: DRYWALL_IN * IN, at: 'other' },
      ],
      // NO WINDOW, by design. Any glass on that side wall belongs to the
      // bedrooms beside it -- stated as a value so a caller cannot read the
      // absence of a window record as "nobody got around to it".
      window: null,
      door: { u: sink.u0 + (r.sinkRunIn * IN) / 2, v: W, facing: 'in' },
      tileGridFt: TILE_IN * IN,
      runsIn: r,
    };
  };

  // ── STAIR LANDING ZONES — a general rule, not a washroom one ───────────
  // Every stair run gets a keep-out at its top AND its bottom: minimum
  // 3'-0", preferred 3'-6", the full width of the run. Nothing AUTO-PLACED
  // may occupy it.
  //
  // IT BINDS THE MACHINE, NOT THE HUMAN. A drafter may put whatever they
  // like on a landing -- they can see the stair. This exists because the
  // machine cannot, and a closet dealt onto the bottom step is the kind of
  // thing that gets drawn, printed and built before anyone looks.
  //
  // Stated here because the washroom is the first caller, not because it
  // belongs to washrooms: closets, kitchens and built-ins all want it, and
  // the second caller should find it already written.
  const LANDING_MIN_FT = 3;
  const LANDING_PREFERRED_FT = 3.5;

  const landingZones = (stairs, { depthFt = LANDING_PREFERRED_FT } = {}) =>
    (stairs || []).flatMap(stair => {
      const a = stair.start, b = stair.end;
      if (!a || !b) return [];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return [];
      const ux = dx / len, uz = dz / len;          // along the run
      const px = -uz, pz = ux;                     // across it
      const half = (Number(stair.widthFt) || 3) / 2;
      // BOTH ENDS. A run has a landing at the top and one at the bottom, and
      // which end is which does not matter to a keep-out.
      return [
        { at: a, sign: -1 },
        { at: b, sign: +1 },
      ].map(({ at, sign }) => ({
        // The zone as its four corners, so a caller can test any shape
        // against it rather than only an axis-aligned box.
        corners: [
          { x: at.x + px * half, z: at.z + pz * half },
          { x: at.x - px * half, z: at.z - pz * half },
          { x: at.x - px * half + ux * sign * depthFt, z: at.z - pz * half + uz * sign * depthFt },
          { x: at.x + px * half + ux * sign * depthFt, z: at.z + pz * half + uz * sign * depthFt },
        ],
        depthFt,
        stairId: stair.id ?? null,
      }));
    });

  // ── WHICH SIDE THE WASHROOM TAKES ─────────────────────────────────────
  // Second rule: the WC goes to the GARAGE SIDE, so living and dining own
  // the open non-garage side.
  //
  // WITH NO GARAGE THE DOOR PREDICTS IT. A garage most likely lands on the
  // side away from the front door, so the WC takes that side now and a house
  // that grows a garage later already has the stack sitting behind it.
  //
  //   door centred -> left     door left -> right     door right -> left
  //
  // Returns 'left' or 'right' in the plan's own terms; the caller owns what
  // those mean on its axes. `null` only when there is nothing to go on at
  // all, which is a caller's decision to make, not a coin this should flip.
  const garageSide = ({ garageOutlineSide = null, doorSide = null } = {}) => {
    if (garageOutlineSide === 'left' || garageOutlineSide === 'right') return garageOutlineSide;
    if (doorSide === 'left') return 'right';
    if (doorSide === 'right') return 'left';
    if (doorSide === 'centre' || doorSide === 'center') return 'left';
    return null;
  };

  window.DraftWashroom = Object.freeze({
    layout,
    closes,
    landingZones,
    garageSide,
    LANDING_MIN_FT,
    LANDING_PREFERRED_FT,
    runsForLength,
    MIN_LENGTH_IN,
    STANDARD_LENGTH_IN,
    STANDARD_WIDTH_IN,
    TUB_LENGTH_IN,
    TUB_DEPTH_IN,
    CHASE_IN,
    TOILET_RUN_IN,
    SINK_RUN_IN,
    SINK_RUN_MAX_IN,
    FINISH_IN,
    WET_WALL_IN,
    WALL_IN,
    CEMENT_BOARD_IN,
    DRYWALL_IN,
    TILE_IN,
  });
})();
}
