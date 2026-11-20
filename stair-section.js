// STAIR SECTION — the carpenter's stair, drawn on its own page.
//
// Moved out of MODEL.dc.html (_drawStairWorkspace2D and its two panes) so
// MODEL.html can draw the same workspace -- Movie, 7 Oct: "on the
// MODEL.DC.html i could bring up the STAIR SECTION - it would show a full page
// with 2 views ... can you find that and bring it over". Both pages call this
// file; neither keeps a copy.
//
// THE WORKSPACE: the level's STAIR layer view fills the canvas with two panes
// on ONE horizontal scale -- the section on top, the down-view plan below --
// so every nosing lines up between them. Clicking a pane fills the screen
// with it; clicking again returns to the split.
//
// Pure painting: what the page knows (its walls, floors, formatters, the
// floor package of a level) is handed in as `env`.
if (!window.DraftStairSection) {
(() => {
  const SG = () => window.DraftStairGeometry;
  const STAIR_COLOR = '#5d4a8a';
  // THE TREAD RUN, READ LIVE: it is the office's (STANDARDS, STAIRS).
  const treadRunIn = () => SG().STAIR_TREAD_RUN_IN;
  const STAIR_TREAD_THICK_IN = 1.5;    // full 2x12 tread
  const STAIR_TREAD_BOARD_IN = 11.25;  // 2x12 actual width, left full
  const STAIR_RISER_THICK_IN = 0.75;   // 3/4" plywood riser
  const STAIR_RISER_FACE_IN = window.DraftStairGeometry.STAIR_RISER_FACE_IN;
  // The stringer's throat, PLUMB: from the notch roots (the line through
  // every tread top at its riser face) down to the stringer's bottom edge.
  // Measured from the NOSING line, as MODEL.dc.html had it, the bottom edge
  // ran above the notches and the stringer drew as a row of teeth with no
  // board under them. 7" plumb is about 5 1/2" square to the slope: what a
  // 2x12 keeps once it is cut.
  const STAIR_STRINGER_DROP_IN = 7;
  // THE OPENING EDGE IS NOT THE NOSING: 1/2" nosing + 1 1/2" of backing behind
  // it -- the floor the hole must not take away. MODEL.dc.html keeps the same
  // two numbers (STAIR_NOSING_IN, STAIR_NOSING_BACKING_IN) for the cut itself.
  const STAIR_OPENING_NOSING_MIN_IN = 1.5 + 0.5;
  const STAIR_TOP_NOSING_IN = 0.5;
  const STAIR_TOP_BACKING_IN = STAIR_OPENING_NOSING_MIN_IN - STAIR_TOP_NOSING_IN;
  // A flat landing's structural band, as the panes draw it.
  const STAIR_LANDING_BAND_IN = 8;

  // Turned shapes draw UNFOLDED along the walk line: a flat landing adds its
  // depth to the developed run; winders unfold to the straight length.
  //
  // THE DESCENT UNFOLDED (stairSequence): every stretch of treads and every
  // flat landing in walking order -- an L's one landing, a U's two (jb, 14
  // Nov 2026) with any middle flight between them. `segs` are the tread
  // stretches, `flats` the landings ({ u0, u1, e }), `flights` what each
  // riser run is: a stretch of treads and the riser down off its end.
  const stairUnfold = (layout, split) => {
    const riseStep = layout.riserIn / 12;
    const runStep = treadRunIn() / 12;
    const seq = SG().stairSequence ? SG().stairSequence(split) : null;
    const hasFlat = !!(seq && seq.some(item => item.flatFt));
    if (!hasFlat) {
      return { segs: [{ u0: 0, treads: layout.treads }], flats: [],
        flights: [{ u0: 0, e0: 0, risers: layout.risers }], runFt: layout.runFt };
    }
    const segs = [], flats = [], flights = [];
    let u = 0, e = 0, open = { u0: 0, e0: 0, treads: 0 };
    seq.forEach(item => {
      if (item.treads) {
        segs.push({ u0: u, treads: item.treads });
        open.treads += item.treads;
        u += item.treads * runStep;
        return;
      }
      // A flat ends the flight in hand: its treads and the riser down onto it.
      flights.push({ u0: open.u0, e0: open.e0, risers: open.treads + 1, ontoLanding: true,
        ...(open.offLanding ? { offLanding: true } : {}) });
      e -= (open.treads + 1) * riseStep;
      flats.push({ u0: u, u1: u + item.flatFt, e });
      u += item.flatFt;
      open = { u0: u, e0: e, treads: 0, offLanding: true };
    });
    flights.push({ u0: open.u0, e0: open.e0, risers: open.treads + 1,
      ...(open.offLanding ? { offLanding: true } : {}) });
    return { segs, flats, flights, runFt: u };
  };
  // The turn in words for a pane's caption.
  const turnWord = split => {
    const one = n => (n ? `${n} WINDERS` : 'FLAT');
    if (split.shape === 'L') return split.winders ? `${split.winders} WINDERS` : 'LANDING';
    if (split.merged) return 'LANDING';
    return `UPPER ${one(split.winders)} · LOWER ${one(split.lowerWinders)}`
      + (split.midRisers ? ` · ${split.midRisers} STEP${split.midRisers === 1 ? '' : 'S'} BETWEEN` : '');
  };
  const devRun = (stair, layout) => {
    const split = SG().stairShapeSplit(stair, layout);
    return { runFt: stairUnfold(layout, split).runFt, split };
  };

  const paneRects = (w, h, mode = 'split') => {
    if (mode === 'section') return { section: { x: 0, y: 0, w, h }, plan: null };
    if (mode === 'plan') return { section: null, plan: { x: 0, y: 0, w, h } };
    const gap = 6;
    const half = (h - gap) / 2;
    return { section: { x: 0, y: 0, w, h: half }, plan: { x: 0, y: half + gap, w, h: half } };
  };

  // The pane under a press in split mode: the top half is the section.
  const paneAtY = (y, h) => (y < h / 2 ? 'section' : 'plan');

  // The shared frame both panes draw in: one locked horizontal scale so the
  // whole run plus note room on either side always fits, the section's full
  // rise fits its pane, and every nosing lines up vertically between panes.
  const frameFor = ({ stair, layout, descent, w, h, mode = 'split' }) => {
    const dev = devRun(stair, layout);
    const rects = paneRects(w, h, mode);
    const noteFt = Math.max(4, dev.runFt * 0.45);
    const uMin = -noteFt, uMax = dev.runFt + noteFt;
    const spanFt = uMax - uMin;
    const paneW = (rects.section || rects.plan).w;
    let pxPerFt = (paneW - 24) / spanFt;
    // ROOM FOR THE RAIL: it stands 3 ft over the top nosing, so the section
    // keeps 4 ft of air above the upper floor (MODEL.dc.html kept 2 and the
    // rail ran off the top of the pane).
    if (rects.section) pxPerFt = Math.min(pxPerFt, (rects.section.h - 46) / (layout.riseFt + 6));
    if (rects.plan) pxPerFt = Math.min(pxPerFt, (rects.plan.h - 46) / (stair.widthFt + 6));
    pxPerFt = Math.max(2, pxPerFt);
    const xAtU0 = 12 + ((paneW - 24) - spanFt * pxPerFt) / 2 - uMin * pxPerFt;
    const uToX = u => xAtU0 + u * pxPerFt;
    const sectionY0 = rects.section
      ? rects.section.y + 24 + Math.max(0, (rects.section.h - 46 - (layout.riseFt + 6) * pxPerFt) / 2) + 4 * pxPerFt
      : null;
    const sectionYOf = elevFt => sectionY0 - elevFt * pxPerFt;
    const planYMid = rects.plan ? rects.plan.y + 24 + (rects.plan.h - 34) / 2 : null;
    const planYOf = v => planYMid + v * pxPerFt;
    return { stair, layout, descent, dev, rects, pxPerFt, uToX, sectionYOf, planYOf, mode };
  };

  // A pane's caption, and the hint for what a press does there.
  const paneHeader = (ctx, rect, label, mode, printing) => {
    ctx.fillStyle = 'rgba(29,31,32,0.55)';
    ctx.font = "600 10px 'Barlow Condensed', system-ui, sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(label, rect.x + 10, rect.y + 8);
    if (!printing) {
      ctx.textAlign = 'right';
      ctx.fillText(mode === 'split' ? 'CLICK TO ENLARGE' : 'CLICK TO SPLIT', rect.x + rect.w - 10, rect.y + 8);
    }
  };

  // ONE FLIGHT'S PROFILE, the carpenter's way: the cut stringer, the 2x12
  // treads and the 3/4" ply risers. `flight` is { u0, e0, risers } in stair
  // u (downhill from the top nosing) and elevation (0 at the top nosing);
  // `uToX` may run either way across the page and `yOf` takes an elevation,
  // so the STAIR SECTION page and a SECTION cut through the house draw the
  // same stair from this one routine.
  const PANE_INKS = Object.freeze({
    line: STAIR_COLOR, stringer: 'rgba(93,74,138,0.12)', tread: '#e8e2f2', riser: '#ddd5ec',
  });
  // `opts.topBacking` (the STAIR SECTION page's top flight): the top riser is
  // the 1 1/2" backing on the opening's header, its face 1/2" behind the top
  // nosing (jb, 19 Nov: "1/2" nosing then 1.5" backing to the stair opening
  // edge"), down the floor's depth `opts.topBacking.depthFt`.
  //
  // THE STRINGER IS NOT CUT OFF at a landing (jb, 19 Nov, "lengthen the
  // stringers ... don't cut them off"): a flight down ONTO a landing runs its
  // underside on until it meets the landing's underside, and a flight OFF a
  // landing runs its underside back up under the landing to meet it there.
  const drawFlight = (ctx, flight, layout, uToX, yOf, inks, opts = {}) => {
    const riseStep = layout.riserIn / 12;
    const runStep = treadRunIn() / 12;
    const treadThk = STAIR_TREAD_THICK_IN / 12;
    const boardW = STAIR_TREAD_BOARD_IN / 12;
    const riserThk = STAIR_RISER_THICK_IN / 12;
    const drop = STAIR_STRINGER_DROP_IN / 12;
    const slope = riseStep / runStep;
    // A box between two stations and two elevations, whichever way u runs.
    const box = (ua, ub, eTop, eBottom) => {
      const xa = uToX(ua), xb = uToX(ub);
      const x = Math.min(xa, xb), w = Math.abs(xb - xa);
      const y = yOf(eTop), h = yOf(eBottom) - y;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    };
    // Riser j face within this flight, 11" back from the nosing of the
    // tread it stands on, in stair u.
    const backing = opts.topBacking || null;
    const backFaceU = flight.u0 - STAIR_TOP_NOSING_IN / 12;
    const faceU = j => (backing && j === 1 ? backFaceU : flight.u0 + j * runStep - STAIR_RISER_FACE_IN / 12);
    const elevAt = j => flight.e0 - j * riseStep;
    const bandFt = STAIR_LANDING_BAND_IN / 12;
    // Where the underside line (its throat plumb under the notch roots)
    // reaches elevation e.
    const undersideU = e => flight.u0 - STAIR_RISER_FACE_IN / 12 + (flight.e0 - e - drop) / slope;
    // Cut stringer: sawtooth at the finished profile (the boards draw over
    // it), a plumb cut against the top edge, and a level cut at the bottom.
    ctx.beginPath();
    ctx.moveTo(uToX(faceU(1)), yOf(flight.e0));
    for (let j = 1; j <= flight.risers; j++) {
      ctx.lineTo(uToX(faceU(j)), yOf(elevAt(j - 1)));
      ctx.lineTo(uToX(faceU(j)), yOf(elevAt(j)));
      if (j < flight.risers) ctx.lineTo(uToX(faceU(j + 1)), yOf(elevAt(j)));
    }
    const flightRise = flight.risers * riseStep;
    const rootE = u => notchRootE(flight, layout, u);
    const footE = flight.e0 - flightRise;
    if (flight.ontoLanding) {
      // Back under the last riser, plumb down the landing's end to its
      // underside, then level out to where the underside line meets it
      // (jb, 19 Nov: the landing's end meets the stringer, no gap).
      const cutE = footE - bandFt;
      const endU = faceU(flight.risers) - riserThk;
      ctx.lineTo(uToX(endU), yOf(footE));
      ctx.lineTo(uToX(endU), yOf(cutE));
      ctx.lineTo(uToX(Math.max(endU, undersideU(cutE))), yOf(cutE));
    } else {
      ctx.lineTo(uToX(undersideU(footE)), yOf(footE));
    }
    if (flight.offLanding) {
      // Up under the landing to its underside, and level back to the
      // first riser's face.
      const cutE = flight.e0 - bandFt;
      ctx.lineTo(uToX(Math.min(faceU(1), undersideU(cutE))), yOf(cutE));
      ctx.lineTo(uToX(faceU(1)), yOf(cutE));
    } else {
      ctx.lineTo(uToX(faceU(1)), yOf(rootE(faceU(1)) - drop));
    }
    ctx.closePath();
    ctx.fillStyle = inks.stringer;
    ctx.strokeStyle = inks.line;
    ctx.lineWidth = 1.25;
    ctx.fill();
    ctx.stroke();

    // Treads: full 2x12 boards, 1.5" thick, nosing at every 10" run increment.
    ctx.fillStyle = inks.tread;
    for (let k = 1; k < flight.risers; k++) {
      const nose = flight.u0 + k * runStep;
      // The top tread butts the backing rather than running behind it.
      const back = backing && k === 1 ? Math.max(nose - boardW, backFaceU) : nose - boardW;
      box(back, nose, elevAt(k), elevAt(k) - treadThk);
    }
    // Risers: 3/4" ply standing on the tread below (or the landing), closing
    // up to the underside of the tread above — the horizontal joint bears on
    // top of the tread, carpenter style.
    ctx.fillStyle = inks.riser;
    for (let j = backing ? 2 : 1; j <= flight.risers; j++) {
      box(faceU(j) - riserThk, faceU(j), elevAt(j - 1) - treadThk, elevAt(j));
    }
    if (backing) {
      // The backing, from the opening edge to its face, the floor's depth;
      // the 1/2" nosing over it, a tread's thickness.
      ctx.fillStyle = inks.tread;
      box(-STAIR_OPENING_NOSING_MIN_IN / 12 + flight.u0, backFaceU, flight.e0, flight.e0 - backing.depthFt);
      box(backFaceU, flight.u0, flight.e0, flight.e0 - treadThk);
    }
  };

  // The line through the notch roots (each tread's top at its riser face)
  // at stair u: the stringer's throat is measured plumb down from it.
  const notchRootE = (flight, layout, u) => flight.e0
    - (layout.riserIn / treadRunIn()) * (u - flight.u0 + STAIR_RISER_FACE_IN / 12);

  // The flights a stair descends in, in unfolded stair u: one for a straight
  // stair (or winders, which unfold straight), two around the flat landing
  // for an L or U. `landU` is where the last riser meets the floor below.
  const stairFlights = (layout, split) => {
    const runStep = treadRunIn() / 12;
    const { flights, flats } = stairUnfold(layout, split);
    const flat = flats.length ? split : null;
    const last = flights[flights.length - 1];
    const landU = last.u0 + last.risers * runStep - STAIR_RISER_FACE_IN / 12;
    return { flat, flats, flights, landU };
  };

  // Where a flight's rail ends: the face of its last riser, 36" over the
  // floor it lands on -- the same line the section pane draws.
  const flightRailEnd = (flight, layout) => ({
    u: flight.u0 + flight.risers * treadRunIn() / 12 - STAIR_RISER_FACE_IN / 12,
    e: flight.e0 - flight.risers * layout.riserIn / 12,
  });

  const drawSectionPane = (ctx, rect, stair, layout, descent, dev, uToX, pxPerFt, yOf, env) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    const split = dev.split;
    const shapeNote = split
      ? ` · ${split.shape} SHAPE UNFOLDED (${turnWord(split)})`
      : '';
    env.header(ctx, rect,
      `STAIR SECTION — ${layout.risers}R @ ${env.inchesOnly(layout.riserIn)} · TREADS FULL 2x12 · RISERS 3/4" PLY FACE @ ${env.inchesOnly(STAIR_RISER_FACE_IN)}${shapeNote}`);
    const riseStep = layout.riserIn / 12;
    const runStep = treadRunIn() / 12;
    const fadeFill = 'rgba(89,128,166,0.14)';
    const fadeLine = 'rgba(89,128,166,0.55)';
    const noteFont = "600 9px 'Barlow Condensed', system-ui, sans-serif";

    const { flat, flats, flights, landU } = stairFlights(layout, split);

    // Faded upper floor band, cut at the opening edge: the 2" between it and
    // the top nosing is the backing and the nosing, drawn with the flight.
    const floorFt = env.floorFt(stair.levelId);
    const xEdge = uToX(-STAIR_OPENING_NOSING_MIN_IN / 12);
    ctx.fillStyle = fadeFill;
    ctx.strokeStyle = fadeLine;
    ctx.lineWidth = 1;
    ctx.fillRect(rect.x, yOf(0), xEdge - rect.x, floorFt * pxPerFt);
    ctx.strokeRect(rect.x - 2, yOf(0), xEdge - rect.x + 2, floorFt * pxPerFt);
    // The floor it lands on, ALL THE WAY ACROSS (jb, 19 Nov: "draw the slab
    // all the way"): under the whole stair, not only the run-out.
    ctx.fillRect(rect.x, yOf(-layout.riseFt), rect.w, (8 / 12) * pxPerFt);
    ctx.strokeRect(rect.x - 2, yOf(-layout.riseFt), rect.w + 4, (8 / 12) * pxPerFt);

    flights.forEach((flight, i) => drawFlight(ctx, flight, layout, uToX, yOf, PANE_INKS,
      i === 0 ? { topBacking: { depthFt: floorFt } }
        : flight.offLanding ? { topBacking: { depthFt: STAIR_LANDING_BAND_IN / 12 } } : {}));

    // The mid-flight landing on a turned stair: a level structural band
    // between the two flights, labelled with its clear size rule.
    // A U's two landings each draw their band, the upper and the lower.
    // THE LANDING'S ENDS (jb, 19 Nov, his green circles): it starts under
    // the last riser of the flight above, so that riser stands on it and the
    // stringer meets its end, and it stops at the backing of the flight
    // below, as the floor stops at the top -- 1 1/2" backing, 1/2" nosing.
    flats.forEach((band, i) => {
      const u0 = band.u0 - (STAIR_RISER_FACE_IN - treadRunIn() + STAIR_RISER_THICK_IN) / 12;
      const u1 = band.u1 - STAIR_OPENING_NOSING_MIN_IN / 12;
      const x = uToX(u0), w = (u1 - u0) * pxPerFt;
      ctx.fillStyle = 'rgba(93,74,138,0.12)';
      ctx.strokeStyle = STAIR_COLOR;
      ctx.lineWidth = 1.25;
      ctx.fillRect(x, yOf(band.e), w, (8 / 12) * pxPerFt);
      ctx.strokeRect(x, yOf(band.e), w, (8 / 12) * pxPerFt);
      ctx.fillStyle = 'rgba(29,31,32,0.7)';
      ctx.font = noteFont;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const name = flats.length > 1 ? (i === 0 ? 'UPPER LANDING' : 'LOWER LANDING') : 'LANDING';
      const apart = flat.shape === 'U' && flat.merged ? ' · RUNS 4.5" APART' : '';
      ctx.fillText(`${name} — 36" CLEAR${apart}`, x + w / 2, yOf(band.e) - 3);
    });

    // The handrail, one constant 36" above the nosing line: sloped along
    // each flight, LEVEL across the landing, connected through the turn.
    if (stair.rail && stair.rail !== 'none') {
      const railFt = 3;
      const railPts = [{ u: 0, e: railFt }];
      flats.forEach(band => {
        railPts.push({ u: band.u0, e: band.e + railFt });
        railPts.push({ u: band.u1, e: band.e + railFt });
      });
      railPts.push({ u: landU, e: -layout.riseFt + railFt });
      ctx.strokeStyle = STAIR_COLOR;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      railPts.forEach((p, i) => (i === 0
        ? ctx.moveTo(uToX(p.u), yOf(p.e))
        : ctx.lineTo(uToX(p.u), yOf(p.e))));
      ctx.stroke();
      ctx.fillStyle = 'rgba(29,31,32,0.7)';
      ctx.font = noteFont;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('RAIL @ 36"', uToX(0) + 4, yOf(railFt) - 2);
    }

    // The two points that matter: the floor opening edge and the landing.
    // THE HEADER IS NOT THE NOSING, and this section drew them as one line
    // until Movie read it: "the nosing of the stair shouldn't be part of the
    // floor opening". The nosing stays at u = 0, the cut sits
    // STAIR_OPENING_NOSING_MIN_IN behind it, and the strip between them is
    // the 1/2" nosing and the 1 1/2" of backing that carries it -- which is
    // the floor the hole must NOT take away.
    //
    // Drawn as it is cut, so the section and _stairOpeningFootprint cannot
    // tell a drafter two different things about the same edge.
    const openU = -STAIR_OPENING_NOSING_MIN_IN / 12;
    ctx.strokeStyle = '#b04050';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(uToX(openU), yOf(0)); ctx.lineTo(uToX(openU), yOf(-floorFt));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rect.x, yOf(-layout.riseFt)); ctx.lineTo(rect.x + rect.w, yOf(-layout.riseFt));
    ctx.stroke();
    // The build-up itself, between the cut and the nosing: a thin tick at the
    // floor line so the 2" reads as a thing rather than as slack.
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(uToX(openU), yOf(0)); ctx.lineTo(uToX(0), yOf(0));
    ctx.stroke();
    ctx.fillStyle = '#b04050';
    ctx.font = noteFont;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('EDGE OF STAIR OPENING', uToX(openU) - 4, yOf(0) - 3);
    ctx.textAlign = 'left';
    ctx.fillText(`${env.inchesOnly(STAIR_TOP_NOSING_IN)} NOSING + ${env.inchesOnly(STAIR_TOP_BACKING_IN)} BACKING`,
      uToX(0) + 4, yOf(0) - 3);
    ctx.textAlign = 'left';
    if (descent) ctx.fillText(`LANDS ON ${descent.landing.toUpperCase()}`, uToX(dev.runFt) + 8, yOf(-layout.riseFt) - 3);

    // Rise / run figures in the note room on the left.
    ctx.fillStyle = 'rgba(29,31,32,0.7)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`TOTAL RISE ${env.ftIn(layout.riseFt)}`, rect.x + 10, yOf(-layout.riseFt / 2));
    ctx.fillText(`TOTAL RUN ${env.ftIn(dev.runFt)}${split ? ' UNFOLDED' : ''}`, rect.x + 10, yOf(-layout.riseFt / 2) + 13);

    // The site rule: grade only ever fills UP to the drawn datum, so risers
    // are only ever adjusted shorter — never taller than drawn.
    ctx.fillStyle = 'rgba(29,31,32,0.6)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('VERIFY ACTUAL HEIGHT CHANGE ON SITE — ADJUST RISER HEIGHT DOWN ONLY;',
      rect.x + 10, rect.y + rect.h - 16);
    ctx.fillText('IF MORE HEIGHT IS NEEDED, ADD A RISER AND EQUALIZE ALL RISERS.',
      rect.x + 10, rect.y + rect.h - 5);
    ctx.restore();
  };

  const drawPlanPane = (ctx, rect, stair, layout, dev, uToX, pxPerFt, vToY, env) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    const split = dev.split;
    const shapeNote = split
      ? ` · ${split.shape} SHAPE UNFOLDED (${turnWord(split)})`
      : '';
    env.header(ctx, rect, `STAIR PLAN — DN ${layout.risers}R TO THE RIGHT · ${env.ftIn(stair.widthFt)} WIDE${shapeNote}`);
    const runStep = treadRunIn() / 12;
    const vMid = vToY(0);
    // Stair-local frame: u downhill along the run, v to the right walking down.
    const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const du = { x: dx / len, z: dz / len };
    const local = pt => ({
      u: (pt.x - stair.start.x) * du.x + (pt.z - stair.start.z) * du.z,
      v: (pt.x - stair.start.x) * -du.z + (pt.z - stair.start.z) * du.x,
    });
    const toPane = pt => { const l = local(pt); return { x: uToX(l.u), y: vToY(l.v) }; };

    // Faded reference: the level's PLAN walls and FLOOR outlines with their
    // openings, locked and non-editable in this workspace.
    if (!split) {
      const levelId = stair.levelId;
      const fade = 'rgba(89,128,166,0.4)';
      ctx.strokeStyle = fade;
      ctx.lineWidth = 1.25;
      env.walls()
        .filter(wall => wall.levelId === levelId && (wall.view || 'plan') === 'plan')
        .forEach(wall => {
          const a = toPane(wall.start), b = toPane(wall.end);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
      ctx.setLineDash([5, 4]);
      env.floors()
        .filter(floor => floor.levelId === levelId)
        .forEach(floor => {
          const points = (floor.points || []).map(toPane);
          if (points.length < 2) return;
          ctx.beginPath();
          points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath(); ctx.stroke();
          env.openingsFor('floor', floor.id).forEach(opening => {
            const hole = opening.points.map(toPane);
            if (hole.length < 2) return;
            ctx.beginPath();
            hole.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.closePath(); ctx.stroke();
          });
        });
      ctx.setLineDash([]);
    }

    // The stair itself, on A-STR: stringers, tread lines, rail bars, DN
    // arrow. Unfolded, the tread segments to draw: either the whole run, or
    // the two runs around the flat landing band.
    const half = (stair.widthFt / 2) * pxPerFt;
    const { segs, flats } = stairUnfold(layout, split);
    const x0 = uToX(0), x1 = uToX(dev.runFt);
    ctx.strokeStyle = STAIR_COLOR;
    ctx.fillStyle = STAIR_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, vMid - half); ctx.lineTo(x1, vMid - half);
    ctx.moveTo(x0, vMid + half); ctx.lineTo(x1, vMid + half);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    segs.forEach(seg => {
      for (let i = 0; i <= seg.treads; i++) {
        const x = uToX(seg.u0 + i * runStep);
        ctx.moveTo(x, vMid - half); ctx.lineTo(x, vMid + half);
      }
    });
    ctx.stroke();
    // The flat landing band, labelled with its clear-size rule.
    flats.forEach((band, i) => {
      const lx0 = uToX(band.u0), lx1 = uToX(band.u1);
      ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(flats.length > 1 ? (i === 0 ? 'UPPER' : 'LOWER') : 'LANDING', (lx0 + lx1) / 2, vMid + half / 2);
    });
    if (stair.rail && stair.rail !== 'none') {
      const inset = Math.min(half - 1, 0.25 * pxPerFt);
      const sides = stair.rail === 'both' ? [-1, 1] : [stair.rail === 'right' ? 1 : -1];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      sides.forEach(side => {
        const y = vMid + side * (half - inset);
        ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      });
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, vMid); ctx.lineTo(x1, vMid);
    ctx.moveTo(x1 - 8, vMid - 4); ctx.lineTo(x1, vMid); ctx.lineTo(x1 - 8, vMid + 4);
    ctx.stroke();
    ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`DN — ${layout.risers}R @ ${env.inchesOnly(layout.riserIn)}`, (x0 + x1) / 2, vMid - 3);

    // Opening edge emphasised across the stair width -- BEHIND the top nosing
    // by STAIR_OPENING_NOSING_MIN_IN, the same place the section draws it and
    // the same place _stairOpeningFootprint cuts it.
    //
    // THE TWO PANES MUST AGREE and `stair-view.spec.js` is what holds them to
    // it: it measures the opening mark's x in each pane and allows 2 px
    // between them. Moving the section's edge and leaving this one gave 4,
    // which is how the disagreement was caught rather than shipped.
    const xOpen = uToX(-STAIR_OPENING_NOSING_MIN_IN / 12);
    ctx.strokeStyle = '#b04050';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(xOpen, vMid - half - 6); ctx.lineTo(xOpen, vMid + half + 6);
    ctx.stroke();
    ctx.fillStyle = '#b04050';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('EDGE OF STAIR OPENING', xOpen - 4, vMid - half - 8);
    ctx.restore();
  };

  // The whole workspace: paper, both panes and the rule between them. Null
  // `stair` paints the empty-state line instead. `env`: floorFt(levelId),
  // ftIn(ft), inchesOnly(in), walls(), floors(), openingsFor(kind, id),
  // printing, mode ('split' | 'section' | 'plan'), levelName, compact.
  const drawWorkspace = (ctx, w, h, stair, env) => {
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);
    if (!stair) {
      ctx.fillStyle = 'rgba(29,31,32,0.55)';
      ctx.font = "600 13px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`No stair on ${env.levelName || 'this level'} yet — place one with the STAIR tool in PLAN.`, w / 2, h / 2);
      return null;
    }
    const layout = SG().stairCurrentLayout(stair, env.levels);
    const descent = SG().stairDescent(stair.levelId, env.levels);
    const frame = frameFor({ stair, layout, descent, w, h, mode: env.mode || 'split' });
    const paneEnv = { ...env,
      header: (c, rect, label) => paneHeader(c, rect, label, frame.mode, env.printing) };
    const { rects, dev, uToX, pxPerFt } = frame;
    // COMPACT, for OBJ / PROP's little boxes (Movie, 25 Oct: "can we use 2 of
    // the windows to show plan and sections views"): the drawing alone. At
    // 140px the captions, notes and site rule only crowd each other, and the
    // window says the figures in its own title and PROPERTIES.
    if (env.compact) ctx.fillText = () => {};
    try {
      if (rects.section) drawSectionPane(ctx, rects.section, stair, layout, descent, dev, uToX, pxPerFt, frame.sectionYOf, paneEnv);
      if (rects.plan) drawPlanPane(ctx, rects.plan, stair, layout, dev, uToX, pxPerFt, frame.planYOf, paneEnv);
      if (rects.section && rects.plan) {
        ctx.strokeStyle = 'rgba(29,31,32,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, rects.plan.y - 3); ctx.lineTo(w, rects.plan.y - 3);
        ctx.stroke();
      }
    } finally {
      if (env.compact) delete ctx.fillText;
    }
    return frame;
  };

  window.DraftStairSection = Object.freeze({
    STAIR_COLOR,
    STAIR_TREAD_THICK_IN,
    STAIR_TREAD_BOARD_IN,
    STAIR_RISER_THICK_IN,
    STAIR_STRINGER_DROP_IN,
    STAIR_OPENING_NOSING_MIN_IN,
    devRun,
    stairFlights,
    stairUnfold,
    notchRootE,
    flightRailEnd,
    drawFlight,
    paneRects,
    paneAtY,
    frameFor,
    paneHeader,
    drawSectionPane,
    drawPlanPane,
    drawWorkspace,
  });
})();
}
