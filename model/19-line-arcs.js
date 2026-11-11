// ARCS AND CIRCLES INSIDE THE LINE COMMAND (jb, 11 Nov 2026: "i don't think
// i can draw circle yet" -- "can it be a part of the LINE command, so i could
// includ and ARC in a series of lines, maybe would need to use the right click
// menu for this").
//
// NOTHING NEW ON THE PALETTE. Every letter is taken, and jb asked for the arc
// to live in the run, the way AutoCAD's PLINE takes A for Arc and L for Line
// mid-string. So while LINE is up, a right click opens a small menu --
// STRAIGHT / ARC / 3-POINT ARC / CIRCLE, then CLOSE / FINISH / CANCEL -- and
// the same four stand as chips in the foot row for anyone without a right
// button. The right click used to FINISH the run (jb, 9 Nov, PR #947); it
// still does on a WALL run and everywhere else. On LINE the menu's FINISH is
// that same verb, one press further away, and ENTER / SPACE / a double-click
// are unchanged.
//
// WHAT AN ARC PIECE IS: the same `bulge` field a FILLET or a traced DXF arc
// has always written on a line record, read since today as a circular arc
// (geometry-2d.js lineArc). So an arc drawn here picks, moves, deletes,
// prints, pens and goes out to DXF exactly as a bent line already did -- and
// as a true ARC entity, because every painter now strokes it with ctx.arc.
//
// THE THREE WAYS TO BEND:
//   ARC         -- the next press is the arc's END; it leaves the piece before
//                  it tangent-continuous (AutoCAD's default). With nothing
//                  before it (the first piece of a run) it asks for the point
//                  the arc passes through as a second press, like 3-POINT ARC.
//   3-POINT ARC -- the END, then the point the arc passes THROUGH.
//   CIRCLE      -- the CENTRE, then the radius by a press or a typed length
//                  (R, the LENGTH box). Two half-circle pieces, one assembly.
// STRAIGHT puts the run back on plain lines. The mode is kept across runs
// while LINE stays up and goes back to STRAIGHT when the tool is put down.
//
// AND ON THE AREA / SHAPE AND FLOOR COMMANDS (jb, 11 Nov: "the AREA command
// doesn't have CIRCLE, maybe these commands should be added to it"): the
// same menu and chips while SHAPE or FLOOR is up. A loop's corner carries
// the outline's `bulge` for the edge leaving it (geometry-2d.js loopSegment),
// so ARC bends the edge from the last corner, 3-POINT ARC asks the through
// point, CLOSE bends the closing edge the same way and commits, and CIRCLE
// commits a four-quarter-arc loop in one go (circleLoop). The loop's own
// presses -- a straight corner, the close on the first corner -- are
// untouched when the mode is STRAIGHT.
//
// Loaded after 18-draft-commands.js. Every call into here from an earlier
// file is guarded with typeof, as 18's are. Same scope, same indent.

  // ── the state ───────────────────────────────────────────────────────────
  var lineArcState = {
    mode: 'straight',       // 'straight' | 'arc' | 'arc3' | 'circle'
    end: null,              // 3-POINT: the end pressed, waiting for the through point
    through: null,          // the through point, set for the one commit it steers
    centre: null,           // a loop tool's CIRCLE: the centre pressed, waiting for the radius
    closing: false,         // a loop tool: the end waited on is the first corner (CLOSE)
  };
  const LINE_ARC_MODES = Object.freeze([
    { id: 'straight', label: 'STRAIGHT', title: 'Plain lines, as before' },
    { id: 'arc', label: 'ARC', title: 'The next press ends an arc that leaves the last piece smoothly; on a fresh run, press the end then the point it passes through' },
    { id: 'arc3', label: '3-POINT ARC', title: 'Press the arc’s end, then the point it passes through' },
    { id: 'circle', label: 'CIRCLE', title: 'Press the centre, then the radius -- or type it' },
  ]);
  const lineArcGeo = () => window.DraftGeometry2D;
  const lineToolUp = () => activeTool === 'line' && !activeCut();
  // THE LOOP TOOLS THAT TAKE THE MENU: SHAPE and FLOOR (jb, 11 Nov), whose
  // corners are loopCornersInHand's (11-floor-openings-fixtures.js).
  const loopArcToolUp = () => (activeTool === 'shape' || activeTool === 'floor') && !activeCut();
  const arcToolUp = () => lineToolUp() || loopArcToolUp();
  const loopArcCorners = () => (loopArcToolUp() ? loopCornersInHand() || [] : []);
  const lineArcModeIs = id => lineArcState.mode === id;
  const lineArcSays = text => { sayOnStrip(`${activeTool.toUpperCase()}: ${text}`); };

  // THE PIECE BEFORE THE OPEN END, if the run is chained to it by identity --
  // the tangent an ARC continues.
  const lineRunTangent = from => {
    const last = drawnChain[drawnChain.length - 1];
    if (!last || last.type !== 'line' || !from || last.item.end !== from) return null;
    const G = lineArcGeo();
    const arc = last.item.bulge ? G.lineArc(last.item) : null;
    if (arc) return arc.tangentEnd;
    const dx = last.item.end.x - last.item.start.x, dz = last.item.end.z - last.item.start.z;
    const l = Math.hypot(dx, dz);
    return l < 1e-9 ? null : { x: dx / l, z: dz / l };
  };
  // Whether the next piece needs a THROUGH point before it can be made.
  const lineArcWantsThrough = () => lineArcModeIs('arc3')
    || (lineArcModeIs('arc') && !lineRunTangent(drawStart));
  // THE BULGE THE NEXT PIECE TAKES, asked by commitDrawnPiece (08) for every
  // line it writes: a through point steers it once; ARC bends off the
  // tangent; anything else is straight.
  function lineRunBulge(from, to) {
    if (activeTool !== 'line') return 0;
    const G = lineArcGeo();
    if (lineArcState.through) {
      const b = G.bulgeThrough(from, to, lineArcState.through);
      lineArcState.through = null;
      return b;
    }
    if (lineArcModeIs('arc')) {
      const u = lineRunTangent(from);
      return u ? G.bulgeForTangent(from, to, u) : 0;
    }
    return 0;
  }

  // A FREE POINT WITH THE SNAPS, for the through point and the circle's
  // radius press: a corner or a node if the hand is on one, else the hand.
  // Not drawPoint, which squares and foots the press to drawStart -- a point
  // the arc passes through is not on the chord.
  const lineArcFreePoint = at => {
    const corner = cornerSnap(at, []);
    if (corner) return { x: corner.x, y: 0, z: corner.z };
    const snap = drawSnap(at);
    return snap.pt ? { x: snap.pt.x, y: 0, z: snap.pt.z } : { x: at.x, y: 0, z: at.z };
  };

  // ── the presses ─────────────────────────────────────────────────────────
  // Before drawPress (16's pointerdown and the touch lift). True = taken.
  function lineArcPress(at) {
    if (!lineToolUp()) return false;
    if (lineArcModeIs('circle')) {
      clearNotice();
      if (!drawStart) {
        drawStart = lineArcFreePoint(at);
        lineArcSays('now press the radius, or type it.');
        stripRefresh(); paint();
        return true;
      }
      const p = lineArcFreePoint(at);
      const r = Math.hypot(p.x - drawStart.x, p.z - drawStart.z);
      if (r < 0.01) return true;
      lineArcCircle(drawStart, r);
      return true;
    }
    if (!drawStart) return false;
    if (!lineArcWantsThrough()) return false;
    clearNotice();
    if (!lineArcState.end) {
      const end = drawPoint(at);
      if (Math.hypot(end.x - drawStart.x, end.z - drawStart.z) < 0.001) return true;
      lineArcState.end = end;
      lineArcSays('now press the point the arc passes through.');
      stripRefresh(); paint();
      return true;
    }
    lineArcState.through = lineArcFreePoint(at);
    lineArcCommit(lineArcState.end);
    return true;
  }
  // The piece from drawStart to `end`, chained like drawPress's own commit.
  const lineArcCommit = end => {
    const made = commitDrawn(drawStart, end);
    lineArcState.end = null;
    lineArcState.through = null;
    drawStart = made.item.end;
    setSelection([made]);
    stripRefresh();
    paint();
  };
  // A TYPED LENGTH with a circle's centre down is its radius; with a 3-POINT
  // arc waiting for its end it sets that end along the aim. True = taken.
  function lineArcTyped(feet, end) {
    if (!lineToolUp() || !drawStart) return false;
    if (lineArcModeIs('circle')) { lineArcCircle(drawStart, feet); return true; }
    if (lineArcWantsThrough() && !lineArcState.end && end) {
      lineArcState.end = { x: end.x, y: 0, z: end.z };
      lineArcSays('now press the point the arc passes through.');
      stripRefresh(); paint();
      return true;
    }
    return false;
  }

  // ── THE CIRCLE: two half circles, one assembly ──────────────────────────
  // Pooled ends like any line's, so the quadrant points are nodes; the
  // style the panel last set, like any line drawn; ONE undo step.
  const lineArcCircle = (centre, r) => {
    const { levelId, viewId } = onActiveLevel();
    const lineView = wallHomeView(viewId);
    drawing.lines = drawing.lines || [];
    const west = poolVertex({ x: centre.x - r, z: centre.z }, levelId, lineView);
    const east = poolVertex({ x: centre.x + r, z: centre.z }, levelId, lineView);
    const piece = (start, end) => ({
      id: newDrawingItemId('line'), start, end, levelId, view: lineView, layer: 'draft',
      // A bulge of 2r puts the middle a radius out from the chord: a half
      // circle each way round.
      bulge: 2 * r,
      ...lineStyleDefaults(),
    });
    const top = piece(west, east), bottom = piece(east, west);
    drawing.lines.push(top, bottom);
    const n = Number(drawing.nextGroupId) > 0 ? Number(drawing.nextGroupId) : groups().length + 1;
    drawing.groups = drawing.groups || [];
    const group = {
      id: `group-${n}`, name: `CIRCLE ${n}`, fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'line', id: top.id }, { type: 'line', id: bottom.id }], wallSettings: null,
    };
    drawing.groups.push(group);
    drawing.nextGroupId = n + 1;
    undoStack.push({ kind: 'batch', steps: [
      { kind: 'add-item', list: drawing.lines, item: top },
      { kind: 'add-item', list: drawing.lines, item: bottom },
      { kind: 'add-item', list: drawing.groups, item: group },
    ] });
    markDirty();
    drawStart = null;
    setSelection([{ type: 'line', item: top }, { type: 'line', item: bottom }]);
    lineArcSays(`circle, ${feetLabel(r)} radius. Press the next centre, or STRAIGHT for lines.`);
    stripRefresh();
    paint();
  };

  // ── the mode ────────────────────────────────────────────────────────────
  function setLineArcMode(mode) {
    if (!LINE_ARC_MODES.some(m => m.id === mode)) return;
    const was = lineArcState.mode;
    lineArcState.mode = mode;
    lineArcState.end = null;
    lineArcState.through = null;
    lineArcState.centre = null;
    lineArcState.closing = false;
    if (loopArcToolUp()) {
      const n = loopArcCorners().length;
      const hint = { straight: 'plain corners.',
        arc: n >= 2 ? 'press where the arc ends.' : 'press where the arc ends, then the point it passes through.',
        arc3: 'press where the arc ends, then the point it passes through.',
        circle: 'press the centre.' }[mode];
      lineArcSays(hint);
      stripRefresh();
      paint();
      return;
    }
    // A circle has no run to chain onto, and a run cannot continue from a
    // circle's centre: the open end goes either way across.
    if ((mode === 'circle') !== (was === 'circle')) drawStart = null;
    const hint = { straight: 'plain lines.', arc: drawStart && lineRunTangent(drawStart)
      ? 'press where the arc ends.' : 'press where the arc ends, then the point it passes through.',
      arc3: 'press where the arc ends, then the point it passes through.',
      circle: 'press the centre.' }[mode];
    lineArcSays(hint);
    stripRefresh();
    paint();
  }
  // CLOSE: the piece back to where the run began, in the mode in hand, and
  // the run is put down. The run's first point is the chain's first start.
  function lineRunClose() {
    if (!lineToolUp() || !drawStart || lineArcModeIs('circle')) return false;
    const first = drawnChain.find(entry => entry.type === 'line' && drawing.lines.includes(entry.item));
    if (!first) { lineArcSays('nothing to close yet -- draw a piece first.'); return true; }
    const home = first.item.start;
    if (Math.hypot(home.x - drawStart.x, home.z - drawStart.z) < 0.001) { endDrawRun(); return true; }
    if (lineArcWantsThrough()) {
      lineArcState.end = { x: home.x, y: 0, z: home.z };
      lineArcSays('closing with an arc -- press the point it passes through.');
      stripRefresh(); paint();
      return true;
    }
    lineArcCommit({ x: home.x, y: 0, z: home.z });
    endDrawRun();
    stripRefresh(); paint();
    return true;
  }
  // Esc and a tool change put the half-taken arc down; the mode stays
  // through Esc and goes back to STRAIGHT with the tool.
  function lineArcCancel() { lineArcState.end = null; lineArcState.through = null; lineArcState.centre = null; lineArcState.closing = false; }
  toolListeners.push(next => {
    if (!['line', 'shape', 'floor'].includes(next)) { lineArcState.mode = 'straight'; }
    lineArcCancel();
    // The row comes and goes with the tool, not with the next paint.
    syncLineBar();
  });

  // ── what the strip says ─────────────────────────────────────────────────
  function lineArcStrip() {
    if (loopArcToolUp()) return loopArcStrip();
    if (!lineToolUp()) return null;
    if (lineArcModeIs('straight')) {
      // The right button opens the menu here, not FINISH as on a WALL run.
      return drawStart
        ? 'line — second point · ENTER, SPACE or a double-click ends the run · the right button: ARC, CIRCLE, CLOSE · ESC abandons it'
        : 'line — first point · the right button: ARC, CIRCLE';
    }
    if (lineArcModeIs('circle')) return `line — CIRCLE · ${drawStart ? 'press or type the radius' : 'press the centre'} · ESC abandons it`;
    const kind = lineArcModeIs('arc3') ? '3-POINT ARC' : 'ARC';
    if (!drawStart) return `line — ${kind} · first point`;
    if (lineArcState.end) return `line — ${kind} · the point the arc passes through · ESC abandons it`;
    return `line — ${kind} · where the arc ends · ENTER, SPACE or a double-click ends the run · ESC abandons it`;
  }

  // ── the ghost ───────────────────────────────────────────────────────────
  // Painted by 03's run ghost in place of its straight dash. True = painted.
  function paintLineArcGhost(run) {
    if (!lineToolUp() || lineArcModeIs('straight')) return false;
    const G = lineArcGeo();
    ctx.save();
    ctx.strokeStyle = skin['draw-wall-edge'];
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    if (lineArcModeIs('circle')) {
      const c = toS(drawStart);
      const r = Math.hypot(run.to.x - run.from.x, run.to.z - run.from.z) * view.scale;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      const b = toS(run.to);
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
      return true;
    }
    let seg = null;
    if (lineArcState.end) {
      // The end is down; the arc bends through the hand.
      const through = cursorWorld ? lineArcFreePoint(cursorWorld) : null;
      seg = { start: drawStart, end: lineArcState.end,
        bulge: through ? G.bulgeThrough(drawStart, lineArcState.end, through) : 0 };
      const e = toS(lineArcState.end);
      ctx.fillStyle = skin['accent'];
      ctx.fillRect(e.x - 3, e.y - 3, 6, 6);
    } else if (lineArcModeIs('arc') && lineRunTangent(drawStart)) {
      seg = { start: drawStart, end: run.to, bulge: G.bulgeForTangent(drawStart, run.to, lineRunTangent(drawStart)) };
    } else {
      ctx.restore();
      return false;
    }
    window.DraftRender2D.strokeSegPath2D(ctx, toS, seg, { controlPoint: G.lineControlPoint });
    ctx.restore();
    return true;
  }

  // ── THE LOOP TOOLS: SHAPE and FLOOR (jb, 11 Nov) ───────────────────────
  // The corner before the open end gives the tangent an ARC continues: the
  // last corner, leaving the one before it along that edge's bend or chord.
  const loopTangent = corners => {
    const n = corners.length;
    if (n < 2) return null;
    const G = lineArcGeo();
    const seg = G.loopSegment(corners, n - 2);
    const arc = seg.bulge ? G.lineArc(seg) : null;
    if (arc) return arc.tangentEnd;
    const dx = seg.end.x - seg.start.x, dz = seg.end.z - seg.start.z;
    const l = Math.hypot(dx, dz);
    return l < 1e-9 ? null : { x: dx / l, z: dz / l };
  };
  const loopArcWantsThrough = () => lineArcModeIs('arc3')
    || (lineArcModeIs('arc') && !loopTangent(loopArcCorners()));
  const loopFirstNear = (corners, p) => corners.length >= 3
    && Math.hypot(p.x - corners[0].x, p.z - corners[0].z) <= OUTLINE_CLOSE_FT;
  // THE LOOP COMMITTED, by the tool's own commit with the corners handed in.
  const loopArcCommit = loop => {
    lineArcCancel();
    const made = activeTool === 'floor' ? commitFloor(loop) : commitShape(loop);
    stripRefresh();
    paint();
    return made;
  };
  // THE EDGE FROM THE LAST CORNER TO `end` TAKES ITS BEND, and the loop
  // either closes (end is the first corner) or grows by that corner.
  const loopArcTake = (end, bulge) => {
    const corners = loopArcCorners();
    const last = corners[corners.length - 1];
    if (!last) return;
    last.bulge = bulge || 0;
    if (lineArcState.closing) { loopArcCommit(corners.slice()); return; }
    corners.push({ x: end.x, z: end.z });
    lineArcState.end = null;
    lineArcState.through = null;
    stripRefresh();
    paint();
  };
  // Before loopPress (16's dispatch and the touch lift). True = taken.
  function loopArcPress(at) {
    if (!loopArcToolUp() || lineArcModeIs('straight')) return false;
    const G = lineArcGeo();
    const corners = loopArcCorners();
    clearNotice();
    if (lineArcModeIs('circle')) {
      if (corners.length) return false;
      if (!lineArcState.centre) {
        lineArcState.centre = lineArcFreePoint(at);
        lineArcSays('now press the radius, or type it.');
        stripRefresh(); paint();
        return true;
      }
      const p = lineArcFreePoint(at);
      const r = Math.hypot(p.x - lineArcState.centre.x, p.z - lineArcState.centre.z);
      if (r < 0.01) return true;
      loopArcCircle(lineArcState.centre, r);
      return true;
    }
    if (!corners.length) return false;
    if (lineArcState.end) {
      // The end is down: this press is the point the arc passes through.
      const through = lineArcFreePoint(at);
      const last = corners[corners.length - 1];
      loopArcTake(lineArcState.end, G.bulgeThrough(last, lineArcState.end, through));
      return true;
    }
    const here = loopPoint(at);
    const last = corners[corners.length - 1];
    if (Math.hypot(here.x - last.x, here.z - last.z) < 0.001) return true;
    const closes = loopFirstNear(corners, here);
    const end = closes ? { x: corners[0].x, z: corners[0].z } : here;
    lineArcState.closing = closes;
    if (loopArcWantsThrough()) {
      lineArcState.end = end;
      lineArcSays('now press the point the arc passes through.');
      stripRefresh(); paint();
      return true;
    }
    loopArcTake(end, G.bulgeForTangent(last, end, loopTangent(corners)));
    return true;
  }
  // A CIRCLE AS A SHAPE OR FLOOR: four quarter arcs, committed at once.
  const loopArcCircle = (centre, r) => {
    const loop = lineArcGeo().circleLoop(centre, r);
    const made = loopArcCommit(loop);
    if (made) lineArcSays(`circle, ${feetLabel(r)} radius. Press the next centre, or STRAIGHT for corners.`);
  };
  // CLOSE on a loop: the closing edge in the mode in hand. True = taken.
  function loopArcClose() {
    if (!loopArcToolUp()) return false;
    const corners = loopArcCorners();
    if (corners.length < 3 || lineArcModeIs('circle')) { closeLoop(); return true; }
    if (lineArcModeIs('straight')) { closeLoop(); stripRefresh(); paint(); return true; }
    const first = { x: corners[0].x, z: corners[0].z };
    lineArcState.closing = true;
    if (loopArcWantsThrough()) {
      lineArcState.end = first;
      lineArcSays('closing with an arc -- press the point it passes through.');
      stripRefresh(); paint();
      return true;
    }
    const last = corners[corners.length - 1];
    loopArcTake(first, lineArcGeo().bulgeForTangent(last, first, loopTangent(corners)));
    return true;
  }
  // A TYPED LENGTH on a loop: a circle's radius with its centre down; an
  // arc's end that far along the aim. True = taken.
  function loopArcTyped(feet) {
    if (!loopArcToolUp() || lineArcModeIs('straight')) return false;
    if (lineArcModeIs('circle')) {
      if (!lineArcState.centre) return false;
      loopArcCircle(lineArcState.centre, feet);
      return true;
    }
    const corners = loopArcCorners();
    if (!corners.length || lineArcState.end || !cursorWorld) return false;
    const last = corners[corners.length - 1];
    const aim = loopPoint(cursorWorld);
    const ux = aim.x - last.x, uz = aim.z - last.z;
    const len = Math.hypot(ux, uz);
    if (len < 1e-6) { stripMessage.textContent = 'point away from the corner first'; return true; }
    const end = { x: last.x + ux / len * feet, z: last.z + uz / len * feet };
    lineArcState.closing = false;
    if (loopArcWantsThrough()) {
      lineArcState.end = end;
      lineArcSays('now press the point the arc passes through.');
      stripRefresh(); paint();
      return true;
    }
    loopArcTake(end, lineArcGeo().bulgeForTangent(last, end, loopTangent(corners)));
    return true;
  }
  // THE CORNERS THE GHOST TRACES: the corners placed with their bends, and
  // the rubber edge to the hand bent the way the next press would bend it.
  // Returns null when the plain band is right. A circle in hand is its own
  // closed ring about the centre.
  function loopArcTrace(corners, hand) {
    if (!loopArcToolUp() || lineArcModeIs('straight')) return null;
    const G = lineArcGeo();
    if (lineArcModeIs('circle')) {
      if (!lineArcState.centre || !hand) return null;
      const r = Math.hypot(hand.x - lineArcState.centre.x, hand.z - lineArcState.centre.z);
      return { points: G.circleLoop(lineArcState.centre, r), closed: true, centre: lineArcState.centre };
    }
    if (!corners.length) return null;
    const points = corners.map(c => ({ x: c.x, z: c.z, ...(c.bulge ? { bulge: c.bulge } : {}) }));
    const last = points[points.length - 1];
    if (lineArcState.end) {
      const through = hand ? lineArcFreePoint(hand) : null;
      last.bulge = through ? G.bulgeThrough(last, lineArcState.end, through) : 0;
      points.push({ x: lineArcState.end.x, z: lineArcState.end.z });
      return { points, closed: lineArcState.closing, end: lineArcState.end };
    }
    if (!hand) return { points, closed: false };
    const end = loopPoint(hand);
    const u = loopTangent(corners);
    last.bulge = lineArcModeIs('arc') && u ? G.bulgeForTangent(last, end, u) : 0;
    points.push({ x: end.x, z: end.z });
    return { points, closed: false };
  }
  // A CIRCLE'S CENTRE DOWN on a loop tool: the LENGTH box takes the radius
  // and the ghost follows the hand, with no corner in hand to say so.
  const loopArcTypable = () => loopArcToolUp() && lineArcModeIs('circle') && !!lineArcState.centre;
  // THE CIRCLE GHOST on a loop tool: the ring about the centre, out to the
  // hand, and the spoke. Painted by 03 beside the loop in hand. True = painted.
  function paintLoopArcGhost() {
    if (!loopArcTypable() || !cursorWorld) return false;
    const c = toS(lineArcState.centre);
    const hand = lineArcFreePoint(cursorWorld);
    const r = Math.hypot(hand.x - lineArcState.centre.x, hand.z - lineArcState.centre.z) * view.scale;
    ctx.save();
    ctx.strokeStyle = skin['draw-note'];
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
    const b = toS(hand);
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
    return true;
  }
  function loopArcStrip() {
    const tool = activeTool;
    const n = loopArcCorners().length;
    if (lineArcModeIs('straight')) return null;
    if (lineArcModeIs('circle')) return `${tool} — CIRCLE · ${lineArcState.centre ? 'press or type the radius' : 'press the centre'} · ESC abandons it`;
    const kind = lineArcModeIs('arc3') ? '3-POINT ARC' : 'ARC';
    if (!n) return `${tool} — ${kind} · first corner`;
    if (lineArcState.end) return `${tool} — ${kind} · the point the arc passes through · ESC abandons it`;
    return `${tool} — ${kind} · where the arc ends · the first corner, CLOSE or ENTER closes the loop · ESC abandons it`;
  }

  // ── LINES INTO A SHAPE, AND BACK (jb, 11 Nov) ──────────────────────────
  // "if there is a completed and ASSEMBLED 'y' SHAPE in lines, can we allow
  // the user to select the shape (like this circle) and in the properties
  // ... change the items to AREA / SHAPE with the middle filled in" -- and
  // "should be option to turn a closed shape into lines". The LINE panel
  // offers MAKE SHAPE when the lines picked chain end to end into one
  // closed ring; the SHAPE panel offers MAKE LINES. Arcs go both ways as
  // the one `bulge`; the lines are removed on convert (jb: "REMOVE"), and
  // one UNDO puts them back.
  const RING_JOIN_FT = 0.01;
  const ptsMeet = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) <= RING_JOIN_FT;
  // THE RING THE LINES MAKE, as loop corners with bends, or null with the
  // reason they make none.
  function linesRingLoop(lines) {
    const list = (lines || []).filter(l => l && l.start && l.end);
    if (list.length < 2) return { points: null, why: 'pick two or more lines that join into a ring' };
    // Every end meets exactly one other end: a tee or a loose end is no
    // ring. By place in the list, not identity: two lines pooled on one
    // corner share the vertex object.
    const ends = list.flatMap(l => [l.start, l.end]);
    for (let i = 0; i < ends.length; i += 1) {
      const meets = ends.filter((o, j) => j !== i && ptsMeet(o, ends[i])).length;
      if (meets !== 1) return { points: null, why: meets ? 'a corner joins three lines' : 'the lines leave a gap' };
    }
    const G = lineArcGeo();
    const used = new Set();
    const points = [];
    let line = list[0], forward = true;
    for (let n = 0; n < list.length; n += 1) {
      used.add(line);
      const from = forward ? line.start : line.end, to = forward ? line.end : line.start;
      points.push({ x: from.x, z: from.z, ...(line.bulge ? { bulge: forward ? line.bulge : -line.bulge } : {}) });
      const next = list.find(o => !used.has(o) && (ptsMeet(o.start, to) || ptsMeet(o.end, to)));
      if (!next) {
        if (n === list.length - 1 && ptsMeet(to, points[0])) break;
        return { points: null, why: 'the lines make more than one ring' };
      }
      forward = ptsMeet(next.start, to);
      line = next;
    }
    if (used.size !== list.length) return { points: null, why: 'the lines make more than one ring' };
    // A CIRCLE OF TWO HALVES has two corners; every loop rule wants three,
    // so each arc is cut at its middle.
    while (points.length < 3) {
      const split = [];
      points.forEach((p, i) => {
        const seg = G.loopSegment(points, i);
        const cut = G.splitSegAtMid(seg);
        split.push({ x: p.x, z: p.z, ...(cut.bulge ? { bulge: cut.bulge } : {}) });
        split.push({ x: cut.mid.x, z: cut.mid.z, ...(cut.bulge ? { bulge: cut.bulge } : {}) });
      });
      points.splice(0, points.length, ...split);
    }
    if (G.selfIntersects(G.flattenLoop(points))) return { points: null, why: 'the ring crosses itself' };
    return { points, why: null };
  }
  // THE LINES BECOME ONE SHAPE: the same ring, the lines and any assembly
  // made only of them gone, the shape picked with its panel up. One UNDO.
  function linesToShape(lines) {
    const ring = linesRingLoop(lines);
    if (!ring.points) { sayOnStrip(`MAKE SHAPE: ${ring.why}.`); return null; }
    const removed = [];
    const take = (list, item) => {
      const index = list.indexOf(item);
      if (index < 0) return;
      list.splice(index, 1);
      removed.push({ list, index, item });
    };
    const ids = new Set(lines.map(l => String(l.id)));
    groups().filter(g => (g.members || []).length && g.members.every(m => m.type === 'line' && ids.has(String(m.id))))
      .forEach(g => take(drawing.groups, g));
    lines.forEach(l => take(drawing.lines, l));
    drawing.shapes = drawing.shapes || [];
    const shape = {
      id: newDrawingItemId('shape'),
      points: ring.points,
      levelId: lines[0].levelId,
      sourceLevelId: null,
      flooring: null,
      layer: 'SHAPE',
      ...(typeof shapeStyleDefaults === 'function' ? shapeStyleDefaults() : {}),
    };
    drawing.shapes.push(shape);
    undoStack.push({ kind: 'batch', steps: [
      { kind: 'remove-items', removed },
      { kind: 'add-item', list: drawing.shapes, item: shape },
    ] });
    markDirty();
    setSelection([{ type: 'shape', item: shape }]);
    sayOnStrip(`SHAPE made from ${lines.length} line${lines.length === 1 ? '' : 's'}. UNDO puts the lines back.`);
    stripRefresh();
    paint();
    return shape;
  }
  // THE SHAPE BECOMES ITS EDGES: one line per edge, bends kept, pooled at
  // the corners and grouped as one FIXED assembly so it still picks as a
  // ring; the shape gone. One UNDO.
  function shapeToLines(shape) {
    const pts = shape?.points || [];
    if (pts.length < 3) return null;
    const { viewId } = onActiveLevel();
    const lineView = wallHomeView(viewId);
    const levelId = shape.levelId;
    drawing.lines = drawing.lines || [];
    const vtx = pts.map(p => poolVertex({ x: p.x, z: p.z }, levelId, lineView));
    const made = pts.map((p, i) => ({
      id: newDrawingItemId('line'), start: vtx[i], end: vtx[(i + 1) % pts.length], levelId, view: lineView, layer: 'draft',
      ...(p.bulge ? { bulge: p.bulge } : {}),
      ...(typeof lineStyleDefaults === 'function' ? lineStyleDefaults() : {}),
    }));
    const index = drawing.shapes.indexOf(shape);
    if (index < 0) return null;
    drawing.shapes.splice(index, 1);
    drawing.lines.push(...made);
    const n = Number(drawing.nextGroupId) > 0 ? Number(drawing.nextGroupId) : groups().length + 1;
    drawing.groups = drawing.groups || [];
    const group = {
      id: `group-${n}`, name: `SHAPE ${n}`, fixed: true, stretchBehavior: 'rigid',
      members: made.map(l => ({ type: 'line', id: l.id })), wallSettings: null,
    };
    drawing.groups.push(group);
    drawing.nextGroupId = n + 1;
    undoStack.push({ kind: 'batch', steps: [
      { kind: 'remove-item', list: drawing.shapes, index, item: shape },
      ...made.map(l => ({ kind: 'add-item', list: drawing.lines, item: l })),
      { kind: 'add-item', list: drawing.groups, item: group },
    ] });
    markDirty();
    setSelection(made.map(l => ({ type: 'line', item: l })));
    sayOnStrip(`${made.length} lines made from the shape, one assembly. UNDO puts the shape back.`);
    stripRefresh();
    paint();
    return made;
  }

  // ── the foot row ────────────────────────────────────────────────────────
  const lineBar = document.getElementById('line-bar');
  if (lineBar) {
    lineBar.querySelectorAll('[data-line-mode]').forEach(chip => {
      chip.addEventListener('click', () => { setLineArcMode(chip.dataset.lineMode); });
    });
    lineBar.querySelector('[data-line-close]')?.addEventListener('click', () => { if (!loopArcClose()) lineRunClose(); });
  }
  function syncLineBar() {
    if (!lineBar) return;
    // ON SHAPE AND FLOOR THE ROW STANDS ONLY ONCE A LOOP IS IN HAND or a
    // bend is chosen (the right-click menu reaches the modes at any time),
    // so the foot's verbs -- UNDO, DELETE, MOVE -- stay where a drafter
    // who has just closed a shape goes looking for them.
    const loopRow = loopArcToolUp() && (loopArcCorners().length > 0 || !!lineArcState.centre || !lineArcModeIs('straight'));
    const up = !modalUp() && (lineToolUp() || loopRow);
    lineBar.hidden = !up;
    if (!up) return;
    // THE ROW STANDS OVER THE VERBS, as OFFSET's and ARRAY's do (Movie, 18
    // Oct: "i like how those little commands cover the other ones when they
    // are active"); eleven verbs and five chips do not fit the foot.
    [deleteButton, undoButton, copyButton, pasteButton, rotateButton, flipButton, orderButton, moveButton, breakButton, rescaleButton, wallOffButton]
      .forEach(b => { if (b) b.hidden = true; });
    [rotateBar, flipBar, orderBar, rescaleBar].forEach(b => { if (b) b.hidden = true; });
    lineBar.querySelectorAll('[data-line-mode]').forEach(chip => {
      const lit = chip.dataset.lineMode === lineArcState.mode;
      chip.setAttribute('aria-pressed', String(lit));
      chip.classList.toggle('lit', lit);
    });
    const close = lineBar.querySelector('[data-line-close]');
    if (close) close.disabled = loopArcToolUp() ? !(loopArcCorners().length >= 3 && !lineArcModeIs('circle'))
      : !(drawStart && !lineArcModeIs('circle') && drawnChain.length);
  }

  // ── the right-click menu ────────────────────────────────────────────────
  // Opened by 16's right button when it did not travel and LINE is up.
  const lineMenu = document.createElement('div');
  lineMenu.id = 'line-menu';
  lineMenu.dataset.lineMenu = '';
  lineMenu.setAttribute('role', 'menu');
  lineMenu.hidden = true;
  document.body.append(lineMenu);
  const closeLineMenu = () => { if (!lineMenu.hidden) { lineMenu.hidden = true; lineMenu.textContent = ''; } };
  function lineRunMenu(clientX, clientY) {
    if (!arcToolUp() || modalUp()) return false;
    const loop = loopArcToolUp();
    const corners = loopArcCorners();
    const inHand = loop ? corners.length > 0 || !!lineArcState.centre : !!drawStart;
    const items = [
      ...LINE_ARC_MODES.map(m => ({ key: m.id, label: m.label, title: m.title, on: true,
        lit: lineArcModeIs(m.id), run: () => setLineArcMode(m.id) })),
      { rule: true },
      // ON A LOOP, CLOSE bends the closing edge in the mode in hand and
      // commits; FINISH closes it straight, as ENTER does.
      { key: 'close', label: 'CLOSE', title: loop ? 'Close the loop on its first corner, in the mode in hand' : 'Back to where the run began, and the run is done',
        on: loop ? corners.length >= 3 && !lineArcModeIs('circle') : inHand && !lineArcModeIs('circle') && drawnChain.length > 0,
        run: () => { if (!loopArcClose()) lineRunClose(); } },
      { key: 'finish', label: 'FINISH', title: loop ? 'Close the loop straight on its first corner (ENTER)' : 'End the run here (ENTER)',
        on: loop ? corners.length >= 3 : inHand && !lineArcModeIs('circle'),
        run: () => { if (loop) { lineArcCancel(); closeLoop(); } else endDrawRun(); stripRefresh(); paint(); } },
      { key: 'cancel', label: 'CANCEL', title: loop ? 'Drop the corners (ESC)' : 'Put the run down (ESC)', on: inHand,
        run: () => { cancelGestures(); stripRefresh(); paint(); } },
    ];
    lineMenu.textContent = '';
    items.forEach(item => {
      if (item.rule) {
        const rule = document.createElement('div');
        rule.className = 'line-menu-rule';
        lineMenu.append(rule);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.dataset.lineMenuItem = item.key;
      button.textContent = item.label;
      button.title = item.title || '';
      button.disabled = !item.on;
      if (item.lit) button.classList.add('lit');
      button.addEventListener('click', () => { closeLineMenu(); item.run(); });
      lineMenu.append(button);
    });
    lineMenu.hidden = false;
    const w = lineMenu.offsetWidth, h = lineMenu.offsetHeight;
    lineMenu.style.left = `${Math.max(4, Math.min(clientX, window.innerWidth - w - 4))}px`;
    lineMenu.style.top = `${Math.max(4, Math.min(clientY, window.innerHeight - h - 4))}px`;
    return true;
  }
  // A press anywhere else shuts it, as does Esc; a press on the canvas
  // with it open shuts it and goes no further.
  window.addEventListener('pointerdown', e => {
    if (lineMenu.hidden || lineMenu.contains(e.target)) return;
    closeLineMenu();
    if (e.target === canvas) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !lineMenu.hidden) { closeLineMenu(); e.stopPropagation(); } }, true);
  const lineMenuOpen = () => !lineMenu.hidden;
