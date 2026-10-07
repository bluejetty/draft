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
  const STAIR_TREAD_RUN_IN = window.DraftStairGeometry.STAIR_TREAD_RUN_IN;
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

  // Turned shapes draw UNFOLDED along the walk line: a flat landing adds its
  // depth to the developed run; winders unfold to the straight length.
  const devRun = (stair, layout) => {
    const split = SG().stairShapeSplit(stair, layout);
    if (!split || split.winders) return { runFt: layout.runFt, split };
    return { runFt: (split.t1 + split.t2) * STAIR_TREAD_RUN_IN / 12 + split.landFt, split };
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
  const drawFlight = (ctx, flight, layout, uToX, yOf, inks) => {
    const riseStep = layout.riserIn / 12;
    const runStep = STAIR_TREAD_RUN_IN / 12;
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
    const faceU = j => flight.u0 + j * runStep - STAIR_RISER_FACE_IN / 12;
    const elevAt = j => flight.e0 - j * riseStep;
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
    const uBottom = flight.u0 - STAIR_RISER_FACE_IN / 12 + (flightRise - drop) / slope;
    ctx.lineTo(uToX(uBottom), yOf(flight.e0 - flightRise));
    ctx.lineTo(uToX(faceU(1)), yOf(rootE(faceU(1)) - drop));
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
      box(nose - boardW, nose, elevAt(k), elevAt(k) - treadThk);
    }
    // Risers: 3/4" ply standing on the tread below (or the landing), closing
    // up to the underside of the tread above — the horizontal joint bears on
    // top of the tread, carpenter style.
    ctx.fillStyle = inks.riser;
    for (let j = 1; j <= flight.risers; j++) {
      box(faceU(j) - riserThk, faceU(j), elevAt(j - 1) - treadThk, elevAt(j));
    }
  };

  // The line through the notch roots (each tread's top at its riser face)
  // at stair u: the stringer's throat is measured plumb down from it.
  const notchRootE = (flight, layout, u) => flight.e0
    - (layout.riserIn / STAIR_TREAD_RUN_IN) * (u - flight.u0 + STAIR_RISER_FACE_IN / 12);

  // The flights a stair descends in, in unfolded stair u: one for a straight
  // stair (or winders, which unfold straight), two around the flat landing
  // for an L or U. `landU` is where the last riser meets the floor below.
  const stairFlights = (layout, split) => {
    const riseStep = layout.riserIn / 12;
    const runStep = STAIR_TREAD_RUN_IN / 12;
    const flat = split && !split.winders ? split : null;
    const flights = flat
      ? [
        { u0: 0, e0: 0, risers: flat.t1 + 1 },
        { u0: flat.t1 * runStep + flat.landFt, e0: -(flat.t1 + 1) * riseStep, risers: layout.risers - flat.t1 - 1 },
      ]
      : [{ u0: 0, e0: 0, risers: layout.risers }];
    const last = flights[flights.length - 1];
    const landU = last.u0 + last.risers * runStep - STAIR_RISER_FACE_IN / 12;
    return { flat, flights, landU };
  };

  // Where a flight's rail ends: the face of its last riser, 36" over the
  // floor it lands on -- the same line the section pane draws.
  const flightRailEnd = (flight, layout) => ({
    u: flight.u0 + flight.risers * STAIR_TREAD_RUN_IN / 12 - STAIR_RISER_FACE_IN / 12,
    e: flight.e0 - flight.risers * layout.riserIn / 12,
  });

  const drawSectionPane = (ctx, rect, stair, layout, descent, dev, uToX, pxPerFt, yOf, env) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    const split = dev.split;
    const shapeNote = split
      ? ` · ${split.shape} SHAPE UNFOLDED${split.winders ? ` (${split.winders} WINDERS)` : ' (LANDING)'}`
      : '';
    env.header(ctx, rect,
      `STAIR SECTION — ${layout.risers}R @ ${env.inchesOnly(layout.riserIn)} · TREADS FULL 2x12 · RISERS 3/4" PLY FACE @ ${env.inchesOnly(STAIR_RISER_FACE_IN)}${shapeNote}`);
    const riseStep = layout.riserIn / 12;
    const runStep = STAIR_TREAD_RUN_IN / 12;
    const fadeFill = 'rgba(89,128,166,0.14)';
    const fadeLine = 'rgba(89,128,166,0.55)';
    const noteFont = "600 9px 'Barlow Condensed', system-ui, sans-serif";

    const { flat, flights, landU } = stairFlights(layout, split);

    // Faded upper floor band, cut at the opening edge (u = 0).
    const floorFt = env.floorFt(stair.levelId);
    ctx.fillStyle = fadeFill;
    ctx.strokeStyle = fadeLine;
    ctx.lineWidth = 1;
    ctx.fillRect(rect.x, yOf(0), uToX(0) - rect.x, floorFt * pxPerFt);
    ctx.strokeRect(rect.x - 2, yOf(0), uToX(0) - rect.x + 2, floorFt * pxPerFt);
    // Faded landing band under the run-out.
    ctx.fillRect(uToX(landU), yOf(-layout.riseFt), rect.x + rect.w - uToX(landU), (8 / 12) * pxPerFt);
    ctx.strokeRect(uToX(landU), yOf(-layout.riseFt), rect.x + rect.w - uToX(landU) + 2, (8 / 12) * pxPerFt);

    flights.forEach(flight => drawFlight(ctx, flight, layout, uToX, yOf, PANE_INKS));

    // The mid-flight landing on a turned stair: a level structural band
    // between the two flights, labelled with its clear size rule.
    if (flat) {
      const uL0 = flights[1].u0 - flat.landFt;
      const eL = flights[1].e0;
      const x = uToX(uL0), w = flat.landFt * pxPerFt;
      ctx.fillStyle = 'rgba(93,74,138,0.12)';
      ctx.strokeStyle = STAIR_COLOR;
      ctx.lineWidth = 1.25;
      ctx.fillRect(x, yOf(eL), w, (8 / 12) * pxPerFt);
      ctx.strokeRect(x, yOf(eL), w, (8 / 12) * pxPerFt);
      ctx.fillStyle = 'rgba(29,31,32,0.7)';
      ctx.font = noteFont;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`LANDING — 36" CLEAR${flat.shape === 'U' ? ' · RUNS 4.5" APART' : ''}`, x + w / 2, yOf(eL) - 3);
    }

    // The handrail, one constant 36" above the nosing line: sloped along
    // each flight, LEVEL across the landing, connected through the turn.
    if (stair.rail && stair.rail !== 'none') {
      const railFt = 3;
      const railPts = [{ u: 0, e: railFt }];
      if (flat) {
        const eL = flights[1].e0;
        railPts.push({ u: flights[1].u0 - flat.landFt, e: eL + railFt });
        railPts.push({ u: flights[1].u0, e: eL + railFt });
      }
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
    ctx.moveTo(uToX(landU), yOf(-layout.riseFt)); ctx.lineTo(rect.x + rect.w, yOf(-layout.riseFt));
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
    ctx.fillText(`${env.inchesOnly(STAIR_OPENING_NOSING_MIN_IN)} MIN NOSING + BACKING`,
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
      ? ` · ${split.shape} SHAPE UNFOLDED${split.winders ? ` (${split.winders} WINDERS)` : ''}`
      : '';
    env.header(ctx, rect, `STAIR PLAN — DN ${layout.risers}R TO THE RIGHT · ${env.ftIn(stair.widthFt)} WIDE${shapeNote}`);
    const runStep = STAIR_TREAD_RUN_IN / 12;
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
    const flat = split && !split.winders ? split : null;
    const segs = flat
      ? [
        { u0: 0, treads: flat.t1 },
        { u0: flat.t1 * runStep + flat.landFt, treads: flat.t2 },
      ]
      : [{ u0: 0, treads: layout.treads }];
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
    if (flat) {
      const lx0 = uToX(flat.t1 * runStep), lx1 = uToX(flat.t1 * runStep + flat.landFt);
      ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('LANDING', (lx0 + lx1) / 2, vMid + half / 2);
    }
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
  // printing, mode ('split' | 'section' | 'plan'), levelName.
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
    if (rects.section) drawSectionPane(ctx, rects.section, stair, layout, descent, dev, uToX, pxPerFt, frame.sectionYOf, paneEnv);
    if (rects.plan) drawPlanPane(ctx, rects.plan, stair, layout, dev, uToX, pxPerFt, frame.planYOf, paneEnv);
    if (rects.section && rects.plan) {
      ctx.strokeStyle = 'rgba(29,31,32,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, rects.plan.y - 3); ctx.lineTo(w, rects.plan.y - 3);
      ctx.stroke();
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
