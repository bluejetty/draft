// MODEL.html's page script, part 8 of 17: STRUCTURE, ROOF, one DELETE.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── STRUCTURE: PLACING A COLUMN AND A BEAM ───────────────────────────────
  //
  // AN INTEGER ID, AND NOT newDrawingItemId. This is the whole trap in #392's
  // other half. That helper returns the STRING `column-7`, which is what
  // commitWall uses and what the wall reader accepts -- but drawing-format.js
  // reads a column's id at :512 and a beam's at :549 with `Number(id)` and
  // drops the record when it is not an integer. Measured before any of this
  // was written:
  //
  //   F.columns([{ id: 'column-7', point, levelId: 3, view: 'plan' }])  ->  []
  //   F.columns([{ id: 7,          point, levelId: 3, view: 'plan' }])  ->  [ ... ]
  //
  // So the obvious implementation puts a column on the canvas, saves a file
  // that reads correctly, and loses it on the next load with no error at
  // either end. Highest-plus-one rather than a counter, because the format
  // dedupes on id: a repeat drops every record after the first, equally
  // silently.
  const newStructureId = list => {
    let max = 0;
    for (const item of (list || [])) {
      const n = Number(item?.id);
      if (Number.isInteger(n) && n > max) max = n;
    }
    return max + 1;
  };

  // A SECOND UNDO KIND RATHER THAN A WIDER FIRST ONE. The existing 'add' step
  // is wall-shaped -- `drawing.walls.indexOf(step.wall)` -- so pushing a column
  // through it would pop a step, find nothing, and silently spend the
  // drafter's undo. Widening that branch would touch wall undo, which is
  // merged and covered; this leaves it alone.
  const addItem = (list, item) => {
    list.push(item);
    undoStack.push({ kind: 'add-item', list, item });
    markDirty();
    paint();
    return item;
  };

  const placeColumn = at => {
    const { levelId, viewId } = onActiveLevel();
    drawing.columns = drawing.columns || [];
    return selectPlaced('column', addItem(drawing.columns, {
      id: newStructureId(drawing.columns),
      point: { x: at.x, y: 0, z: at.z },
      levelId,
      // A column answers to the same home-view rule a wall does: everything on
      // this page reads 'plan' except floors. Placed on the FOUNDATION plan it
      // belongs to the foundation, not to a default.
      view: wallHomeView(viewId),
      // The format's own default, named here rather than left out, so the
      // record this page writes and the record the reader rebuilds are the
      // same object rather than one filled in behind the page's back.
      footing: 'pad36',
    }));
  };

  // ROOM TAG: one press puts a tag down, selected, with its NAME box ready to
  // type over. The tool stays armed, so a drafter walks the plan room by room.
  const placeRoomTag = at => {
    const { levelId, viewId } = onActiveLevel();
    if (viewId != null && viewId !== 'plan') {
      sayOnStrip('ROOM TAGS go on the FLOOR PLAN (WALLS) view.');
      return null;
    }
    drawing.roomTags = drawing.roomTags || [];
    // A WHOLE-NUMBER ID, which the format requires, and past every one used:
    // the counter the old page keeps and the highest id in the file both.
    const ids = drawing.roomTags.map(t => Number(t.id)).filter(Number.isInteger);
    const id = Math.max(0, ...ids, (Number(drawing.nextRoomTagId) || 1) - 1) + 1;
    drawing.nextRoomTagId = id + 1;
    // WITH A SMALL SQUARE FOR ITS SHAPE (Movie, 23 Oct): its corners drag
    // out to the walls, or stay a square for a drafter who wants only a name.
    const tag = selectPlaced('roomtag', addItem(drawing.roomTags, {
      id, at: { x: at.x, z: at.z }, levelId, view: 'plan',
      name: 'ROOM', areaSqFt: 0, underMin: false, stamped: true, layer: ROOM_TAG_LAYER,
      points: roomSquare(at),
    }));
    const name = document.querySelector('[data-prop-text="name"]');
    if (name) { name.focus(); name.select(); }
    return tag;
  };

  // WHAT WAS JUST PLACED IS WHAT IS SELECTED, exactly as commitWall does for a
  // wall. It is also what gives the properties panel something to show: this
  // page cannot hit-test a column, so the placement is the only moment the
  // selection can arrive.
  const selectPlaced = (type, item) => {
    setSelection([{ type, item }]);
    return item;
  };

  let beamStart = null;
  const beamPress = at => {
    if (!beamStart) { beamStart = { x: at.x, y: 0, z: at.z }; paint(); return null; }
    const end = { x: at.x, y: 0, z: at.z };
    // A BEAM OF NO LENGTH IS NOT A BEAM, and the reader agrees: the format
    // drops anything under 0.001 (drawing-format.js:553). Writing one would
    // put a record in the file that vanishes on load -- the same silent loss
    // as a string id, by a different route. Treat the second press as a
    // correction, exactly as drawPress does for a wall.
    if (Math.hypot(end.x - beamStart.x, end.z - beamStart.z) < 0.001) {
      beamStart = end; paint(); return null;
    }
    const { levelId, viewId } = onActiveLevel();
    drawing.beams = drawing.beams || [];
    const beam = addItem(drawing.beams, {
      id: newStructureId(drawing.beams),
      start: beamStart,
      end,
      levelId,
      view: wallHomeView(viewId),
      // Named for the same reason footing is: the record this page writes and
      // the record the reader rebuilds should be the same object, not one
      // filled in behind the page's back.
      mode: 'flush',
    });
    // No chaining: a beam is one span between two supports, not a run. The
    // next beam starts where the drafter next presses.
    beamStart = null;
    return selectPlaced('beam', beam);
  };

  // ── LINE: THE WALL'S GESTURE, A LINE'S RECORD ─────────────────────────────
  //
  // Movie, 1 Oct, gave LINE two presses and one line; 5 Oct: "make the line
  // act like the WALL everything the same". So LINE now goes through
  // drawPress with the wall -- chaining, T-square, foot, corner snap, tracking
  // rays, LENGTH and ANGLE -- and only this decides what a piece writes. The
  // ends are POOLED like every other line's, so a line drawn onto a line's
  // corner shares it, and layer `draft` is what the reader gives any line
  // whose layer it does not know.
  const commitDrawn = (from, to) => {
    if (activeTool !== 'line') {
      const justified = toyJustifyAlongHardLine(from, to);
      return { type: 'wall', item: commitWall(from, to,
        { ...brushOptions('wall'), ...(justified ? { refLine: justified } : {}) }) };
    }
    const { levelId, viewId } = onActiveLevel();
    const lineView = wallHomeView(viewId);
    drawing.lines = drawing.lines || [];
    const line = addItem(drawing.lines, {
      id: newDrawingItemId('line'),
      start: poolVertex({ x: from.x, z: from.z }, levelId, lineView),
      end: poolVertex({ x: to.x, z: to.z }, levelId, lineView),
      levelId,
      view: lineView,
      layer: 'draft',
      // THE LAST STYLE CHOSEN STICKS (Movie, 19 Oct): the next line drawn
      // takes the weight, colour and style the panel last set.
      ...lineStyleDefaults(),
    });
    return { type: 'line', item: line };
  };

  // ── ROOF: THE FOOTPRINT IS THE GESTURE ────────────────────────────────────
  //
  // Parity with MODEL.dc.html:16704 `_buildRoofFromShape` -- the from-a-shape
  // rework, board #31 -- and with nothing else. The old page has a SECOND way
  // in: click an edge, click the side the body runs toward, drop a square
  // (:16584 `_handleRoofClick`, phases 'edge' / 'direction' / 'overhang').
  // That path is deliberately not ported. It is a second control on one piece
  // of state, which is the drift this page was rebuilt to end, and the order
  // is explicit: no new entry path.
  //
  // WHAT IS WRITTEN IS drawing-format.js:490's record, key for key. Every
  // field below is one that validator already rebuilds, so the roof this
  // gesture writes and the roof the reader restores are the same object.
  //
  // POINTS ARE PLAIN, NOT POOLED. Walls pool their endpoints through
  // poolVertex(pt, levelId, viewId), but that pool is keyed by VIEW and a roof
  // has none -- roofs take the level-only rule (see roofs(), :2221). A roof
  // corner filed under a view roofs do not have is a corner nothing can find
  // again. The old page pools because its node drag hit-tests roof vertices;
  // this page has no such gesture, so pooling here would add state with no
  // way to reach it.
  //
  // 5.5 IS NOT A CHOICE THE PANEL MAKES, AND NOT A NUMBER THIS PAGE OWNS.
  // drawing-format.js writes `fascia` unconditionally on load, so a
  // drafter-set one would be dropped on the next open -- store-vs-derive, the
  // bug class task #28 named. The panel DERIVES the heel and stores nothing,
  // and it takes the fascia from the module that decides what a roof record
  // is rather than keeping a second 5.5 here to drift from it.
  const ROOF_FASCIA_IN = window.DraftDrawingFormat.ROOF_FASCIA_IN;
  const ROOF_EDGE_GRAB_PX = 12;
  let roofOverhangFt = 2;   // drawing-format.js:503's own default
  let roofPitch = 4;        //  ..and :504's

  // THE HEEL IS NOT RE-DERIVED HERE. drawing-format.js owns
  // `fasciaIn + overhangFt * pitch` beside the fascia it starts from, and
  // proto/section-table-harness.js:204 measures it (5.5, 2, 4 -> 13.5);
  // project-page.js delegates to the same function. A second copy in this file
  // would be a second answer the moment either moved.
  //
  // IT IS READ FROM A MODULE THIS PAGE ALREADY LOADS. Getting it from
  // project-page.js instead cost nothing at the panel and 1855 lines at the
  // door, and tests/model-html-tier1.spec.js:244 -- the guard on what this
  // page is allowed to depend on -- went red for exactly that reason.
  const roofHeelIn = () =>
    window.DraftDrawingFormat.roofHeelIn(ROOF_FASCIA_IN, roofOverhangFt, roofPitch);

  // The footprint the roof is cut from: the level's outline, offset OUT by the
  // overhang. Last one wins, as the old page takes the last shape (:16718).
  const roofSourceOutline = () => {
    const list = outlines().filter(o => (o.points || []).length >= 3);
    return list.length ? list[list.length - 1] : null;
  };

  const buildRoofFromFootprint = () => {
    const { levelId } = onActiveLevel();
    const source = roofSourceOutline();
    if (levelId == null || !source) return null;
    const pts = window.DraftGeometry2D.offsetOutline(
      source.points.map(pt => ({ x: pt.x, z: pt.z })), roofOverhangFt);
    // An offset that collapses the loop is not a roof. Writing the degenerate
    // one would put a record in the file that drawing-format.js:494 drops on
    // load -- present on screen, gone after a reload, which is the silent loss
    // beamPress refuses for the same reason.
    if (!Array.isArray(pts) || pts.length < 3) return null;
    drawing.roofs = drawing.roofs || [];
    return addItem(drawing.roofs, {
      id: newDrawingItemId('roof'),
      points: pts.map(pt => ({ x: pt.x, z: pt.z })),
      levelId,
      sourceLevelId: source.levelId ?? null,
      sourceShapeId: source.id || null,
      edges: pts.map(() => 'eave'),
      overhang: roofOverhangFt,
      pitch: roofPitch,
      fascia: ROOF_FASCIA_IN,
      layer: 'A-ROOF',
    });
  };

  // Nearest roof EDGE to a world point, threshold converted at the current
  // zoom exactly as wallAt does, so the grab stays 12px on screen at any
  // scale. Mirrors MODEL.dc.html:_findRoofEdgeAt, whose threshold is the same
  // conversion written through the frustum instead of view.scale.
  const roofEdgeAt = worldPt => {
    const G = window.DraftGeometry2D;
    const thresh = ROOF_EDGE_GRAB_PX / view.scale;
    let best = null, bestD = thresh;
    roofs().forEach(roof => {
      const pts = roof.points || [];
      pts.forEach((pt, index) => {
        const next = pts[(index + 1) % pts.length];
        const { d } = G.pointToSegment(worldPt, { start: pt, end: next });
        if (d < bestD) { bestD = d; best = { roof, index }; }
      });
    });
    return best;
  };

  // A GABLE IS PLACED BY FLIPPING AN EDGE, NOT BY DRAWING ONE (the BONE note's
  // ruled pick-target model). The press does nothing at all when it lands off
  // every edge -- it does not start a roof, because there is only one way to
  // start one and it is the panel's button.
  const roofPress = at => {
    const hit = roofEdgeAt(at);
    if (!hit) return null;
    const was = hit.roof.edges[hit.index] === 'gable' ? 'gable' : 'eave';
    const now = was === 'gable' ? 'eave' : 'gable';
    hit.roof.edges[hit.index] = now;
    // A FOURTH UNDO KIND rather than a wider existing one, for the reason
    // addItem's comment gives: 'add-item' pops a record OUT of a list, and a
    // tag flip adds nothing. Undoing one through that branch would splice a
    // whole roof away for a one-word change.
    undoStack.push({ kind: 'edge-tag', roof: hit.roof, index: hit.index, was });
    markDirty();
    paint();
    return hit;
  };

  // ── A SINGLE SLOPE ROOF, DRAWN BY HAND (Movie, 21 Oct) ───────────────────
  //
  // "lets make a POPUP and we can put different ROOF options in there fo
  // SPECIAL roofs" -- "option 1 - simple 1 slope roof". Drawn on a storey
  // (his PHASE 2: the 10 ft of main floor beside PHASE 1, the 2nd floor set
  // back from it), in three steps: "first ... the edge line ... where of the
  // ext wall bearing line ... a line that follows the main floor ext wall";
  // then "the DIRECTION OF SLOPE - mark the EAVE side"; then "the ROOF shape"
  // -- "the user will need to draw their eave overhang, shape of the roof
  // (looking down from above)". The pitch is the PROJECT's to start ("they
  // can change it"). It sits on the storey BELOW the one it is drawn on, and
  // shows on that one and on the ROOF plan (`drawnOn`).
  // `var`: the painter reads it from the first paint, before this line runs.
  // A GABLE ROOF (Movie, 22 Oct: "a 2-sided ... gable roof with 2 edges
  // specified (opposite edges PEAK will be in the middle and eaves on
  // outside (the 2nd 'eave direction' q from the 1 slope would be answered
  // when they place 2nd edge"; "for this one ASK overhang (and pitch)") is the
  // same steps' `kind: 'gable'`: a second bearing line c-d where the shed
  // marks its slope, then the questions instead of an outline.
  var shedRoof = null;   // { kind, stage: 'bearing'|'slope'|'shape'|'bearing2'|'ask', a, b, c, d, down, corners }
  const roofPickCard = document.querySelector('[data-roof-pick]');
  const storeyHere = () => !boneyardActive
    && floorsOf(drawing?.levels).some(l => Number(l.id) === Number(activeLevelId()));
  // THE STOREY IT BEARS ON: the one under this, or this one on the lowest.
  const shedBearsOn = () => {
    const list = floorsOf(drawing?.levels);
    const i = list.findIndex(l => Number(l.id) === Number(activeLevelId()));
    return i > 0 ? Number(list[i - 1].id) : Number(activeLevelId());
  };
  const shedWallsBelow = () => (drawing?.walls || []).filter(w => Number(w.levelId) === shedBearsOn()
    && (w.view || 'plan') !== 'foundation' && w.start && w.end);
  // THE BEARING LINE SNAPS TO THE WALLS UNDER IT: an end in reach, else the
  // nearest point along one, else the page's own snap.
  const shedSnap = at => {
    const G = window.DraftGeometry2D;
    const reach = SELECT_GRAB_PX / view.scale;
    let best = null, bestD = reach;
    shedWallsBelow().forEach(w => [w.start, w.end].forEach(p => {
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < bestD) { bestD = d; best = { x: p.x, z: p.z }; }
    }));
    if (best) return best;
    bestD = reach;
    shedWallsBelow().forEach(w => {
      const { d, point } = G.pointToSegment(at, w);
      if (d < bestD && point) { bestD = d; best = { x: point.x, z: point.z }; }
    });
    return best || loopPoint(at);
  };
  // THE T-SQUARE HOLDS, as it does for a wall (Movie, 21 Oct: "i need the T
  // SQUARE to work for when i draw the roof lower wall bearing line"): the
  // bearing line's far end squared to its first, and each corner of the
  // outline squared to the one before. The snap goes first and the square
  // may only slide it along the axis, the wall's own order.
  const shedPoint = (s, at) => {
    if (s.stage === 'bearing') return s.a ? squareTo(s.a, shedSnap(at)) : shedSnap(at);
    if (s.stage === 'bearing2') return s.c ? squareTo(s.c, shedSnap(at)) : shedSnap(at);
    const last = s.corners[s.corners.length - 1];
    return last ? squareTo(last, loopPoint(at)) : loopPoint(at);
  };
  // THE EDGE IN HAND, for the LENGTH box (Movie, 21 Oct: "i need the LENGTH
  // input box to work when I press "R" or "L" or just go into the box and
  // start typeing"): the bearing line from its first point, or the outline
  // from its last corner, to where the next press would land.
  function shedRun() {
    const s = shedRoof;
    if (!s || activeTool !== 'roof' || !cursorWorld) return null;
    const from = s.stage === 'bearing' ? s.a : s.stage === 'bearing2' ? s.c
      : s.stage === 'shape' ? s.corners[s.corners.length - 1] : null;
    return from ? { from, to: shedPoint(s, cursorWorld) } : null;
  }
  // A TYPED LENGTH PUTS THE POINT DOWN that far along the way the cursor
  // points (squared, if the T-square is lit), as a press would.
  function shedByTyped(feet) {
    const s = shedRoof, run = shedRun();
    if (!run) return false;
    const dx = run.to.x - run.from.x, dz = run.to.z - run.from.z, len = Math.hypot(dx, dz);
    if (len < 1e-6) { sayOnStrip('Point the cursor the way it goes first.'); return true; }
    const p = { x: run.from.x + dx / len * feet, z: run.from.z + dz / len * feet };
    if (s.stage === 'bearing') {
      s.b = p;
      shedFirstLineDone(s);
    } else if (s.stage === 'bearing2') {
      gableSecondLine(s, p);
    } else {
      s.corners.push(p);
    }
    paint();
    return true;
  }
  const SHED_SAYS = {
    bearing: 'SINGLE SLOPE 1/3: click two points along the wall the roof sits on.',
    slope: 'SINGLE SLOPE 2/3: click the EAVE side -- the way the roof slopes down.',
    shape: 'SINGLE SLOPE 3/3: click the roof’s outline from above, overhang and all; close on the first corner or ENTER.',
  };
  const GABLE_SAYS = {
    bearing: 'GABLE ROOF 1/3: click two points along the wall one eave sits on.',
    bearing2: 'GABLE ROOF 2/3: click two points along the opposite wall -- the other eave. The peak runs between them.',
    ask: 'GABLE ROOF 3/3: the overhangs and the pitch, then MAKE ROOF.',
  };
  const startShedRoof = () => {
    if (roofPickCard) roofPickCard.hidden = true;
    shedRoof = { kind: 'shed', stage: 'bearing', a: null, b: null, down: null, corners: [] };
    sayOnStrip(SHED_SAYS.bearing);
    paint();
  };
  const startGableRoof = () => {
    if (roofPickCard) roofPickCard.hidden = true;
    shedRoof = { kind: 'gable', stage: 'bearing', a: null, b: null, c: null, d: null, down: null, corners: [] };
    sayOnStrip(GABLE_SAYS.bearing);
    paint();
  };
  const gableAsk = document.querySelector('[data-gable-ask]');
  const endShedRoof = () => { shedRoof = null; if (gableAsk) gableAsk.hidden = true; paint(); };
  // THE FIRST LINE DOWN: the shed asks its slope next, the gable its other wall.
  function shedFirstLineDone(s) {
    s.stage = s.kind === 'gable' ? 'bearing2' : 'slope';
    sayOnStrip(s.kind === 'gable' ? GABLE_SAYS.bearing2 : SHED_SAYS.slope);
  }
  // THE SECOND LINE: parallel to the first and apart from it, or refused.
  function gableSecondLine(s, p) {
    const ax = s.b.x - s.a.x, az = s.b.z - s.a.z, al = Math.hypot(ax, az);
    const cx = p.x - s.c.x, cz = p.z - s.c.z, cl = Math.hypot(cx, cz);
    if (Math.abs(ax * cz - az * cx) / (al * cl) > Math.sin(5 * Math.PI / 180)) {
      sayOnStrip('The two eave lines must run the same way -- click two points along the opposite wall.');
      s.c = null;
      return;
    }
    const across = Math.abs(((s.c.x - s.a.x) * -az + (s.c.z - s.a.z) * ax) / al);
    if (across < 2) {
      sayOnStrip('That is the same wall -- click the wall across from the first.');
      s.c = null;
      return;
    }
    s.d = p;
    s.stage = 'ask';
    sayOnStrip(GABLE_SAYS.ask);
    if (gableAsk) {
      const ft = window.DraftFormatters.formatArchitecturalInches;
      const project = window.DraftLevelAssembly.projectRoofFor(drawing, 'house', drawing.buildType);
      gableAsk.querySelector('[data-gable-eave]').value = ft(project.overhangFt * 12);
      gableAsk.querySelector('[data-gable-pitch]').value = String(project.pitch);
      gableAsk.hidden = false;
      gableAsk.querySelector('[data-gable-eave]').focus();
      gableAsk.querySelector('[data-gable-eave]').select();
    }
  }
  // DOWNHILL: the unit normal of the bearing line on the side pressed.
  const shedDownAt = (s, at) => {
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, len = Math.hypot(dx, dz);
    let n = { x: -dz / len, z: dx / len };
    if ((at.x - s.a.x) * n.x + (at.z - s.a.z) * n.z < 0) n = { x: -n.x, z: -n.z };
    return n;
  };
  const shedPress = at => {
    const s = shedRoof;
    if (s.stage === 'ask') return;
    if (s.stage === 'bearing') {
      const p = shedPoint(s, at);
      if (!s.a) { s.a = p; paint(); return; }
      if (Math.hypot(p.x - s.a.x, p.z - s.a.z) < 0.5) { sayOnStrip('Click the far end of the wall, not the same point.'); return; }
      s.b = p;
      shedFirstLineDone(s);
      paint();
      return;
    }
    if (s.stage === 'bearing2') {
      const p = shedPoint(s, at);
      if (!s.c) { s.c = p; paint(); return; }
      if (Math.hypot(p.x - s.c.x, p.z - s.c.z) < 0.5) { sayOnStrip('Click the far end of the wall, not the same point.'); return; }
      gableSecondLine(s, p);
      paint();
      return;
    }
    if (s.stage === 'slope') {
      s.down = shedDownAt(s, at);
      s.stage = 'shape';
      sayOnStrip(SHED_SAYS.shape);
      paint();
      return;
    }
    const raw = loopPoint(at);
    if (s.corners.length >= 3) {
      const first = s.corners[0];
      if (Math.hypot(raw.x - first.x, raw.z - first.z) <= OUTLINE_CLOSE_FT) { commitShedRoof(); return; }
    }
    const here = shedPoint(s, at);
    // A PRESS ON THE LAST CORNER IS NO CORNER: the second click of a double
    // lands where its first did (see the loop rule at seriesKeyPress).
    if (loopTailIs(s.corners, here)) return;
    s.corners.push(here);
    paint();
  };
  // EACH EDGE OF THE OUTLINE, read against the bearing line: one running
  // along it on the downhill side (or on it) is the EAVE, its overhang the
  // distance out from the wall; one along it uphill stands against the taller
  // wall, a gable cut FLUSH; the rest are the sloping ends, RAKES, overhanging
  // the end wall under them where one runs within 4 ft, else flush.
  const shedEdges = (ring, s) => {
    const G = window.DraftGeometry2D;
    const ax = s.b.x - s.a.x, az = s.b.z - s.a.z, al = Math.hypot(ax, az);
    const along = { x: ax / al, z: az / al };
    const below = shedWallsBelow();
    return ring.map((p, i) => {
      const q = ring[(i + 1) % ring.length];
      const ex = q.x - p.x, ez = q.z - p.z, el = Math.hypot(ex, ez) || 1;
      const u = { x: ex / el, z: ez / el };
      const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
      if (Math.abs(u.x * along.z - u.z * along.x) < Math.sin(10 * Math.PI / 180)) {
        const off = (mid.x - s.a.x) * s.down.x + (mid.z - s.a.z) * s.down.z;
        return off >= -0.5 ? { kind: 'eave', over: Math.max(0, off) } : { kind: 'gable', over: 0 };
      }
      let over = 0, bestD = 4;
      below.forEach(w => {
        const wx = w.end.x - w.start.x, wz = w.end.z - w.start.z, wl = Math.hypot(wx, wz) || 1;
        if (Math.abs((wx / wl) * u.z - (wz / wl) * u.x) > Math.sin(10 * Math.PI / 180)) return;
        const { d } = G.pointToSegment(mid, w);
        if (d < bestD) { bestD = d; over = d; }
      });
      return { kind: 'gable', over };
    });
  };
  const commitShedRoof = () => {
    const G = window.DraftGeometry2D;
    const s = shedRoof;
    const ring = s.corners.map(p => ({ x: p.x, z: p.z }));
    if (ring.length < 3) { sayOnStrip('A roof needs at least three corners.'); return null; }
    if (G.selfIntersects(ring)) { sayOnStrip('That outline crosses itself, so it encloses no roof.'); return null; }
    const read = shedEdges(ring, s);
    if (!read.some(e => e.kind === 'eave')) {
      sayOnStrip('No edge of that outline runs along the eave side. Draw the eave along the wall line.');
      return null;
    }
    const overs = read.map(e => Number(e.over.toFixed(4)));
    const foot = G.offsetOutlineVariable(ring, overs.map(v => -v));
    const footOk = foot.length === ring.length && foot.every(p => Number.isFinite(p.x) && Number.isFinite(p.z));
    const eave = read.find(e => e.kind === 'eave');
    const { pitch } = window.DraftLevelAssembly.projectRoofFor(drawing, 'house', drawing.buildType);
    drawing.roofs = drawing.roofs || [];
    const roof = addItem(drawing.roofs, {
      id: newDrawingItemId('roof'),
      points: ring.map(p => ({ x: p.x, y: 0, z: p.z })),
      levelId: ROOF_LEVEL_ID,
      sourceLevelId: shedBearsOn(),
      drawnOn: Number(activeLevelId()),
      sourceShapeId: null,
      edges: read.map(e => e.kind),
      overhang: Number(eave.over.toFixed(4)),
      edgeOverhang: overs,
      ...(footOk ? { footprint: foot.map(p => ({ x: p.x, y: 0, z: p.z })) } : {}),
      pitch,
      fascia: ROOF_FASCIA_IN,
      garage: false,
      follows: 'none',
      layer: 'A-ROOF',
    });
    shedRoof = null;
    markDirty();
    setTool(RESTING_TOOL);
    selectPlaced('roof', roof);
    sayOnStrip(`SINGLE SLOPE ROOF made at ${pitch}/12. Change its pitch or overhangs in PROPERTIES.`);
    return roof;
  };
  // THE GABLE ROOF ITSELF: each eave out past its own line by the eave
  // overhang, and its ends WHERE THE LINES END (Movie, 22 Oct: "maybe the
  // first draw of it place the edges of the roof where the user places the
  // ends of his EDGE marks"; "and then allow him to change its shape
  // afterwards" -- it is an ordinary roof from then on, its nodes and edges
  // the ROOF tool's to move). The long edges are EAVES, the ends GABLES
  // flush at the marks, so the peak runs down the middle between them.
  const commitGableRoof = () => {
    const G = window.DraftGeometry2D, F = window.DraftFormatters;
    const s = shedRoof;
    if (!s || s.kind !== 'gable' || !s.d) return null;
    const read = sel => F.parseArchitecturalLength(gableAsk.querySelector(sel).value);
    const eaveIn = read('[data-gable-eave]');
    const pitch = Number(gableAsk.querySelector('[data-gable-pitch]').value);
    if (!eaveIn.ok || eaveIn.inches < 0 || eaveIn.inches > 120) {
      sayOnStrip('Type the overhang as a length up to 10 ft, like 2\' or 1\'-6".');
      return null;
    }
    if (!Number.isFinite(pitch) || pitch <= 0 || pitch > 24) {
      sayOnStrip('Type the pitch as the rise in 12, like 6.');
      return null;
    }
    const eave = eaveIn.inches / 12;
    const ax = s.b.x - s.a.x, az = s.b.z - s.a.z, al = Math.hypot(ax, az);
    const u = { x: ax / al, z: az / al };
    let n = { x: -u.z, z: u.x };
    if ((s.c.x - s.a.x) * n.x + (s.c.z - s.a.z) * n.z < 0) n = { x: -n.x, z: -n.z };
    const t = p => (p.x - s.a.x) * u.x + (p.z - s.a.z) * u.z;
    // EACH END OF THE FIRST LINE MEETS THE END OF THE SECOND ON ITS SIDE.
    const [c, d] = t(s.c) <= t(s.d) ? [s.c, s.d] : [s.d, s.c];
    const out = (p, k) => ({ x: p.x + n.x * k, z: p.z + n.z * k });
    // ONE EAVE, AN END, THE OTHER EAVE, THE OTHER END.
    const ring = [out(s.a, -eave), out(s.b, -eave), out(d, eave), out(c, eave)];
    const edges = ['eave', 'gable', 'eave', 'gable'];
    const overs = edges.map(e => Number((e === 'eave' ? eave : 0).toFixed(4)));
    const foot = G.offsetOutlineVariable(ring, overs.map(v => -v));
    const footOk = foot.length === ring.length && foot.every(p => Number.isFinite(p.x) && Number.isFinite(p.z));
    drawing.roofs = drawing.roofs || [];
    const roof = addItem(drawing.roofs, {
      id: newDrawingItemId('roof'),
      points: ring.map(p => ({ x: p.x, y: 0, z: p.z })),
      levelId: ROOF_LEVEL_ID,
      sourceLevelId: shedBearsOn(),
      drawnOn: Number(activeLevelId()),
      sourceShapeId: null,
      edges,
      overhang: Number(eave.toFixed(4)),
      edgeOverhang: overs,
      ...(footOk ? { footprint: foot.map(p => ({ x: p.x, y: 0, z: p.z })) } : {}),
      pitch,
      fascia: ROOF_FASCIA_IN,
      garage: false,
      follows: 'none',
      layer: 'A-ROOF',
    });
    shedRoof = null;
    gableAsk.hidden = true;
    markDirty();
    setTool(RESTING_TOOL);
    selectPlaced('roof', roof);
    sayOnStrip(`GABLE ROOF made at ${pitch}/12. Change its pitch or overhangs in PROPERTIES.`);
    return roof;
  };
  gableAsk?.querySelector('[data-gable-make]')?.addEventListener('click', () => commitGableRoof());
  gableAsk?.querySelector('[data-gable-cancel]')?.addEventListener('click', () => {
    endShedRoof();
    sayOnStrip('GABLE ROOF put down.');
  });
  gableAsk?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitGableRoof(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); endShedRoof(); sayOnStrip('GABLE ROOF put down.'); }
  });
  // THE STEPS IN HAND: the walls it can bear on, faint; the bearing line;
  // the slope arrow; the outline with a band to the cursor.
  function paintShedRoof() {
    const s = shedRoof;
    if (!s || activeTool !== 'roof') return;
    ctx.save();
    ctx.strokeStyle = skin['draw-note'];
    ctx.fillStyle = skin['draw-note'];
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    shedWallsBelow().forEach(w => {
      const a = toS(w.start), b = toS(w.end);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    const tip = s.stage === 'bearing' && s.a && cursorWorld ? shedPoint(s, cursorWorld) : s.b;
    if (s.a && tip) {
      const a = toS(s.a), b = toS(tip);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // THE GABLE'S OTHER EAVE LINE.
    const tip2 = s.stage === 'bearing2' && s.c && cursorWorld ? shedPoint(s, cursorWorld) : s.d;
    if (s.c && tip2) {
      const c = toS(s.c), d = toS(tip2);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    const down = s.down || (s.stage === 'slope' && cursorWorld ? shedDownAt(s, cursorWorld) : null);
    if (s.a && s.b && down) {
      const m = { x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2 };
      const len = 30 / view.scale;
      const t = { x: m.x + down.x * len, z: m.z + down.z * len };
      const pm = toS(m), pt = toS(t);
      ctx.beginPath(); ctx.moveTo(pm.x, pm.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      const ang = Math.atan2(pt.y - pm.y, pt.x - pm.x);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - 9 * Math.cos(ang - 0.45), pt.y - 9 * Math.sin(ang - 0.45));
      ctx.lineTo(pt.x - 9 * Math.cos(ang + 0.45), pt.y - 9 * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
    }
    if (s.corners.length) {
      const trace = cursorWorld ? s.corners.concat([shedPoint(s, cursorWorld)]) : s.corners;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      trace.forEach((pt, i) => { const p = toS(pt); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.stroke();
      ctx.setLineDash([]);
      if (s.corners.length >= 3) {
        const f = toS(s.corners[0]);
        ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }
  roofPickCard?.querySelector('[data-roof-kind="shed"]')?.addEventListener('click', startShedRoof);
  roofPickCard?.querySelector('[data-roof-kind="gable"]')?.addEventListener('click', startGableRoof);
  // A PRESS ON THE PLAN IS AN ANSWER TOO: the ROOF tool's own edge flip, not
  // a hand-drawn roof, so the question goes away.
  canvas.addEventListener('pointerdown', () => {
    if (roofPickCard && !roofPickCard.hidden && !shedRoof) roofPickCard.hidden = true;
  }, true);
  roofPickCard?.querySelector('[data-roof-pick-cancel]')?.addEventListener('click', () => {
    roofPickCard.hidden = true;
  });
  // ESCAPE STEPS OUT, the popup with it. ENTER and SPACE are the loop rule's
  // (seriesKeyPress, below): once is a corner at the cursor, twice quickly
  // closes the outline on its first corner, as a double-click does.
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && roofPickCard && !roofPickCard.hidden) { roofPickCard.hidden = true; return; }
    if (!shedRoof) return;
    // TYPING IN A BOX IS THE BOX'S.
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'Escape') {
      const kind = shedRoof.kind;
      endShedRoof();
      sayOnStrip(kind === 'gable' ? 'GABLE ROOF put down.' : 'SINGLE SLOPE ROOF put down.');
    }
  }, true);

  // DELETE CASCADES, IT DOES NOT REFUSE — MODEL.dc.html:22225-22251 does, and
  // the round-trip proof is about the two pages agreeing on what delete MEANS.
  // A refusal here would also need a message surface this page does not have
  // for a drafter with no keyboard.
  //
  // Three referent classes, all riding through on the ...parsed spread and
  // none of them validated on load — format.fenestrations and format.fixtures
  // check levelId, type, width and offset and NEVER that the host wall exists
  // (drawing-format.js:184-200, :229-245). So an orphan is invisible and
  // persistent: it survives every save, paints nowhere, and returns the moment
  // something is given its host's id.
  const deleteWall = wall => {
    const index = drawing.walls.indexOf(wall);
    if (index < 0) return null;
    drawing.walls.splice(index, 1);
    const gone = wall.id;
    const deps = [];
    const cut = (list, doomed) => {
      if (!Array.isArray(list)) return;
      for (let i = list.length - 1; i >= 0; i--) {
        if (!doomed(list[i])) continue;
        deps.push({ list, index: i, item: list[i] });
        list.splice(i, 1);
      }
    };
    // A door or window whose host is gone.
    cut(drawing.fenestrations, f => f && f.wallId === gone);
    // A FIXTURE IS KEPT, WHERE IT STANDS (Movie, 21 Oct: "leave the item and
    // i can either leave it in position or move to attach to a wall in new
    // location"): it keeps the line this wall stood on as its `host`, and a
    // tub that loses an alcove wall is a plain tub of the length it had.
    // Each change is a before for the undo.
    const freed = [];
    const FGk = window.DraftFixtureGeometry;
    (drawing.fixtures || []).forEach(fx => {
      if (!fx || (fx.wallId !== gone && fx.endWallId !== gone)) return;
      // MEASURED AS IT STOOD, the wall still in the list.
      const geo = FGk && FGk.fixtureGeometry([...drawing.walls, wall], fx);
      freed.push({ item: fx, before: { ...fx } });
      if (geo && geo.tub) {
        fx.width = Number(geo.tubLen.toFixed(4));
        fx.offset = Number(geo.along.toFixed(4));
      }
      if (fx.kind === 'tub') { delete fx.endWallId; delete fx.dir; }
      if (fx.wallId === gone) {
        fx.host = { id: `free:${gone}`, start: { x: wall.start.x, y: 0, z: wall.start.z },
          end: { x: wall.end.x, y: 0, z: wall.end.z }, wallType: wall.wallType, refLine: wall.refLine || 'center' };
        fx.wallId = null;
      }
    });
    // AND THE REFUSED ONES, or refusing a record makes it IMMORTAL. Since the
    // load block started normalising fixtures (tier 3j), a fixture the format
    // turns down is held in `refusedItems` and put back by withRefused() on
    // save -- which is right, because declining to act on a drafter's geometry
    // must not delete it. But a delete cascade IS this page acting on the
    // wall, and a refused fixture the cascade cannot reach outlives the wall
    // it hung on: invisible, unpaintable, and back in the file after every
    // save. That is the orphan this test names, arriving by a new road.
    //
    // Through `cut` rather than a filter, so the removal joins `deps` and undo
    // restores it with everything else the wall took.
    cut(refusedItems.fixtures, entry => entry && entry.item
      && (entry.item.wallId === gone || entry.item.endWallId === gone));
    // AND GROUPS, which neither the order nor the review named. The old page
    // runs _cleanupGroups() beside the cascade; groups reference members by
    // {type, id}, so a group left holding a dead wall id adopts the next wall
    // to be given it. Members go; a group emptied to fewer than two members
    // is not a group, so it goes too.
    if (Array.isArray(drawing.groups)) {
      drawing.groups.forEach(group => {
        cut(group && group.members, m => m && m.type === 'wall' && String(m.id) === gone);
      });
      cut(drawing.groups, g => g && Array.isArray(g.members) && g.members.length < 2);
    }
    // deps were collected newest-first per list; undo re-inserts in reverse so
    // each splice lands at the index it was taken from.
    deps.reverse();
    const retired = retirePoolCorners([wall.start, wall.end]);
    setSelection(selection.filter(entry => entry.item !== wall));
    undoStack.push({ kind: 'remove', wall, index, deps, retired, freed });
    markDirty();
    return wall;
  };

  // ── one DELETE, for everything selected (§7a) ─────────────────────────────
  // THE VERB IS WIDENED, `selectedWall()` IS NOT. That helper answers "is a
  // single wall selected", which is what the length box and the wall gestures
  // ask it; widening it to mean "the selected thing" would quietly hand those
  // callers a floor. So the narrow question stays narrow and the deleting
  // happens out here, over the selection itself.
  //
  // AND THE WALL CASCADE IS CALLED, NOT REIMPLEMENTED. deleteWall carries the
  // fenestrations, fixtures, group members and pooled corners with it; a
  // second removal path that only spliced drawing.walls would leave every one
  // of those behind, which is the exact orphan class its own comment
  // describes.
  const SELECTION_LISTS = Object.freeze({
    line: 'lines',
    floor: 'floors',
    outline: 'outlines',
    column: 'columns',
    beam: 'beams',
    // DELETE COMES FREE WITH THE ENTRY. deleteEntry splices out of whatever
    // list this names and pushes the undo step, so an opening needs no branch
    // of its own -- and the cascade the other way already worked: deleteWall
    // takes its openings with it.
    fenestration: 'fenestrations',
    // AND WHAT SELECT REACHES NOW (1 Oct): a closet or any fixture, a roof,
    // and a stair -- whose floor hole goes with it, below.
    fixture: 'fixtures',
    roof: 'roofs',
    stair: 'stairs',
    roomtag: 'roomTags',
    // A NOTE (Movie, 10 Oct): deletes and undoes like a tag.
    note: 'notes',
    // A HOLOGRAM (Movie, 20 Oct): picked, copied, deleted like an assembly.
    hologram: 'holograms',
    shape: 'shapes',
    // A PHOTO ON THE SHEET (Movie, 23 Oct): picked where it lies, deleted
    // like the rest (the card's own DELETE does the same).
    underlay: 'underlays',
    // A DIMENSION, picked off its line (Movie, 6 Oct: "with the DIMENSION
    // lines, can they be selectable so i can move some if there is a better
    // position"). It deletes like the rest; it is not copied.
    dimension: 'dimensions',
  });

  // HELD BY COPY ONLY WHERE A PASTE CAN LAND IT. A fixture rides a wall by
  // id and a stair owns the hole cut for it in the floor, so a pasted copy
  // of either would come down bound to things on the level it left. They
  // delete and undo like the rest; they are not carried.
  // A FIXTURE IS CARRIED NOW (Movie, 20 Oct, the suites drawn on MAIN FL:
  // "can i select ALL on the floor and then paste ALL in the boneyard"): it
  // is bound to its wall by id, and the paste re-points it at the wall's
  // copy, as it does a door or a window -- see pasteHeld. One whose wall is
  // not in the paste stays behind.
  // A ROOM TAG IS NOT CARRIED EITHER: its id is a whole number the format
  // insists on, and a paste re-ids with a string.
  // A NOTE's id is a whole number for the same reason.
  // A DIMENSION IS CARRIED NOW (Movie, 20 Oct: "i'd also like to be able to
  // copy and paste and existing dimension line a little further outward or
  // inward so i can delete some of the dimensions on it for new dimension
  // line"): its id is a whole number too, so the paste gives it one of its own
  // (newDimensionId) rather than the string every other copy takes.
  // A STAIR COPIES (Movie, 25 Oct: "Should Ctrl+C / Ctrl+V copy stairs too? yes"),
  // its well and open side cut and framed again where the copy lands.
  const NOT_COPIED = new Set(['roof', 'roomtag', 'note']);

  // DELETE A POINT, NOT THE LINE (Movie, 20 Oct): "rather than the dimension
  // line disappearing only that 'point' will no longer be measured and the
  // measurements will change to measure the now longer 2 points that still
  // exist ... if an end 'point' is deleted from a dimension line, the entire
  // line to the next point will be deleted".
  //
  // A hand string is one record per piece, the pieces sharing their points
  // (dimString), so a point in the middle of the string is where two
  // records meet: the one picked is stretched to the neighbour's far end,
  // takes the neighbour's far ref (a corner or an opening it was put on, so
  // it keeps following that), and the neighbour goes. A point at the end of
  // the string meets nothing: its piece goes, and the string now ends at
  // the next point. One UNDO puts the two pieces back as they were.
  const dimPointsMeet = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.z - b.z) < 0.01;
  const deleteDimPoint = (dim, point) => {
    const list = drawing?.dimensions;
    if (!Array.isArray(list) || !list.includes(dim) || !dim[point]) return false;
    const at = dim[point];
    const next = dimRow(dim).find(d => d !== dim && !d.auto
      && (dimPointsMeet(d.start, at) || dimPointsMeet(d.end, at))) || null;
    if (!next) {
      const index = list.indexOf(dim);
      list.splice(index, 1);
      undoStack.push({ kind: 'remove-item', list, index, item: dim });
    } else {
      // Two steps -- the stretch and the removal -- and deleteSelection
      // batches whatever a DELETE pushed, so they are one UNDO from there.
      const farEnd = dimPointsMeet(next.start, at) ? 'end' : 'start';
      const far = next[farEnd], farRef = next[`${farEnd}Ref`];
      const before = { ...dim };
      dim[point] = { ...dim[point], x: far.x, z: far.z };
      const refKey = `${point}Ref`;
      if (farRef) dim[refKey] = { ...farRef }; else delete dim[refKey];
      undoStack.push({ kind: 'props', edits: [{ item: dim, before }] });
      const index = list.indexOf(next);
      list.splice(index, 1);
      undoStack.push({ kind: 'remove-item', list, index, item: next });
    }
    markDirty();
    return true;
  };
  const deleteEntry = entry => {
    if (!entry || !drawing) return false;
    if (entry.type === 'dimension' && entry.point) return deleteDimPoint(entry.item, entry.point);
    if (entry.type === 'wall') return !!deleteWall(entry.item);
    // A STAIR TAKES ITS STAIRWELL WITH IT. AUTO STAIR cuts a surface opening
    // in the floor above and tags it with the stair's id; deleting the stair
    // alone would leave a hole in the floor that nothing explains. One undo
    // step for both, so one press puts the stair and its hole back together.
    if (entry.type === 'stair') {
      const removed = [];
      const take = (list, item) => {
        const index = list.indexOf(item);
        if (index < 0) return;
        list.splice(index, 1);
        removed.push({ list, index, item });
      };
      take(drawing.stairs || [], entry.item);
      if (!removed.length) return false;
      const holes = drawing.surfaceOpenings || [];
      holes.filter(hole => hole.stairId === entry.item.id
        || (hole.stairIds || []).includes(entry.item.id)).forEach(hole => take(holes, hole));
      undoStack.push({ kind: 'remove-items', removed });
      markDirty();
      return true;
    }
    // A BEAM TAKES ITS POSTS WITH IT (Movie, 19 Oct: "i will also want to
    // probably DELETE one line of beams"). A row of teleposts with nothing to
    // hold up is not structure; one undo puts the row back whole. A post the
    // drafter placed off the beam, or one another beam still stands on, stays.
    if (entry.type === 'beam') {
      const removed = [];
      const take = (list, item) => {
        const index = list.indexOf(item);
        if (index < 0) return;
        list.splice(index, 1);
        removed.push({ list, index, item });
      };
      const posts = columnsOnBeam(entry.item,
        (drawing.beams || []).filter(b => !selection.some(e => e.item === b)));
      take(drawing.beams || [], entry.item);
      if (!removed.length) return false;
      posts.forEach(post => take(drawing.columns || [], post));
      undoStack.push({ kind: 'remove-items', removed });
      markDirty();
      return true;
    }
    const key = SELECTION_LISTS[entry.type];
    const list = key ? drawing[key] : null;
    if (!Array.isArray(list)) return false;
    const index = list.indexOf(entry.item);
    if (index < 0) return false;
    list.splice(index, 1);
    undoStack.push({ kind: 'remove-item', list, index, item: entry.item });
    markDirty();
    return true;
  };

  // ── COPY AND PASTE, ACROSS WORKSPACES ──────────────────────────────────────
  // Movie, 14 Sep: "copy and paste stuff in there that won't show on the plan
  // (to save for later / reference)".
  //
  // WHAT MAKES THIS NEW rather than a port. DC's copy is one gesture inside
  // one workspace -- capture a rectangle, give a base point, give a
  // destination, done -- and Movie's ask OUTLIVES the gesture: take it here,
  // put it down over there, possibly after looking at three other shelves.
  // So COPY takes a snapshot and PASTE reads that snapshot, and the two are
  // joined by `held` rather than by one uninterrupted drag.
  //
  // RAW SNAPSHOTS, taken at COPY. Holding references to the live items would
  // let an edit -- or a DELETE -- between the copy and the paste reach back
  // into what the drafter thought he had taken.
  // A BEAM COPIES WITH WHAT IT IS (Movie, 20 Oct: "i COPYed the BEAM - when
  // this happens the COLUMNS ... and pad footing for the whole building
  // should get coppied and pasted" -- a second row under the main floor's TJI
  // in the middle of each suite). The whole row across the building, every
  // piece of it, and every post standing on it, each post with its pad.
  const copiedEntries = () => {
    const out = selection.slice();
    const has = item => out.some(entry => entry.item === item);
    selection.filter(entry => entry.type === 'beam').forEach(({ item }) => {
      beamRun(item).forEach(piece => {
        if (!has(piece)) out.push({ type: 'beam', item: piece });
        columnsOnBeam(piece).forEach(post => { if (!has(post)) out.push({ type: 'column', item: post }); });
      });
    });
    return out;
  };
  const copySelection = () => {
    if (!drawing || !selection.length) return 0;
    held = copiedEntries()
      .filter(entry => entry.type === 'wall'
        || (SELECTION_LISTS[entry.type] && !NOT_COPIED.has(entry.type)))
      .map(entry => ({ type: entry.type, raw: JSON.parse(JSON.stringify(entry.item)) }));
    const posts = held.filter(h => h.type === 'column').length;
    if (held.some(h => h.type === 'beam')) {
      sayOnStrip(`COPIED the beam row${posts ? ` and its ${posts} post${posts === 1 ? '' : 's'} with their pads` : ''}. PASTE, then MOVE it where the new row goes.`);
    }
    return held.length;
  };

  const pasteHeld = () => {
    if (!drawing || !held.length) return 0;
    const owner = activeLevelId();
    const landed = [];
    // THE WALLS LAND FIRST, AND WHAT HANGS ON THEM FOLLOWS (Movie, 20 Oct:
    // the suites copied down to the boneyard came without their windows).
    // A door, a window or a fixture names its wall by id; the wall's copy
    // takes a new id, so the copy of what hangs on it is re-pointed at that,
    // or it would stand on the wall it left, on a level it is no longer on,
    // and show nowhere. One whose wall is not in the paste is not pasted.
    const wallIds = new Map();
    const onWall = type => type === 'fenestration' || type === 'fixture';
    const ordered = [...held.filter(h => h.type === 'wall'), ...held.filter(h => h.type !== 'wall')];
    ordered.forEach(({ type, raw }) => {
      const key = type === 'wall' ? 'walls' : SELECTION_LISTS[type];
      if (!key) return;
      // A FREE FIXTURE (its wall deleted, Movie: "leave the item") has no
      // wall to wait for: it comes with its own wall line.
      const free = type === 'fixture' && raw.wallId == null && raw.host;
      if (onWall(type) && !free) {
        if (!wallIds.has(String(raw.wallId))) return;
        if (raw.endWallId != null && !wallIds.has(String(raw.endWallId))) return;
      }
      // EVERY LINK TO WHERE IT CAME FROM IS CUT, and each strip is its own
      // rule rather than one tidy-up:
      //
      //   id        REALLOCATED, always. "Never paste an item carrying the id
      //             it had on the level it came from" -- #392 paid for one id
      //             bug already and a duplicate id is the same family.
      //   levelId   THE ACTIVE WORKSPACE, which is what makes this a paste
      //             ONTO a shelf: a level's id, or -shelfId on a shelf.
      //   groupId   DROPPED, though MEASURED IT IS ALREADY A NO-OP HERE and
      //             that is worth saying rather than implying a guard that is
      //             not doing the work. The order's rule is "do not let a
      //             pasted wall join a group that lives on another level", and
      //             on this page membership is not on the item: a group holds
      //             `members: [{type, id}]` and the wall normaliser keeps no
      //             groupId. Reallocating the id is therefore what actually
      //             enforces the rule -- no member row names the copy. The
      //             strip stays for anything that does carry one.
      //   srcId     DROPPED, with offX/offZ. Those link a corner to a
      //             boneyard master so propagation can find it; a pasted copy
      //             is new geometry, not a second face of the master, and
      //             leaving the link would have the master drag the parked
      //             copy around.
      const { id: _id, groupId: _g, ...rest } = raw;
      const copy = { ...rest, id: newDrawingItemId(type), levelId: owner };
      // A HOLOGRAM IS THE SAME FILE AGAIN, as its card's COPY makes it: where
      // it stood, on no level of this drawing's (its own levels say where it
      // stands), with none of the first one's DEMO marks.
      if (type === 'hologram') {
        delete copy.levelId;
        delete copy.demo;
        while (holograms().some(h => h.id === copy.id)) copy.id = newDrawingItemId('hologram');
      }
      if (type === 'wall') wallIds.set(String(raw.id), copy.id);
      if (free) {
        // ITS OWN LINE, shared with the free pieces pasted beside it but not
        // with the ones it was copied from -- they are not run mates.
        const was = `host:${raw.host.id}`;
        if (!wallIds.has(was)) wallIds.set(was, `free:${copy.id}`);
        copy.host = { ...raw.host, id: wallIds.get(was) };
      } else if (onWall(type)) {
        copy.wallId = wallIds.get(String(raw.wallId));
        if (raw.endWallId != null) copy.endWallId = wallIds.get(String(raw.endWallId));
      }
      // A PASTED DIMENSION IS THE DRAFTER'S: a whole-number id, on the hand
      // layer, not auto -- an AUTO DIMS re-lay would otherwise sweep the copy
      // he put down to keep -- and no slid-row record of the string it left.
      if (type === 'dimension') {
        copy.id = newDimensionId();
        copy.auto = false;
        copy.layer = DIM_HAND_LAYER;
        delete copy.moved;
        // AND 2 FT FURTHER OUT, on the side its line already stands off: a
        // copy laid exactly on the original would be the same row, and
        // sliding one would carry both. From here he slides it in or out.
        const dx = copy.end.x - copy.start.x, dz = copy.end.z - copy.start.z;
        const len = Math.hypot(dx, dz) || 1;
        const out = { x: -dz / len * 2, z: dx / len * 2 };
        copy.start = { ...copy.start, x: copy.start.x + out.x, z: copy.start.z + out.z };
        copy.end = { ...copy.end, x: copy.end.x + out.x, z: copy.end.z + out.z };
      }
      // A STAIR'S COPY: a whole-number id (the format reads no other), on the
      // floor it came down from, the drafter's rather than AUTO STAIR's, and
      // one stair's width and a foot to its right -- laid on the original its
      // well would be the same hole.
      if (type === 'stair') {
        copy.id = newStructureId(drawing.stairs || []);
        copy.levelId = raw.levelId;
        delete copy.auto;
        const dx = copy.end.x - copy.start.x, dz = copy.end.z - copy.start.z;
        const len = Math.hypot(dx, dz) || 1;
        const by = (Number(copy.widthFt) || 3) + 1;
        const side = { x: -dz / len * by, z: dx / len * by };
        copy.start = { ...copy.start, x: copy.start.x + side.x, z: copy.start.z + side.z };
        copy.end = { ...copy.end, x: copy.end.x + side.x, z: copy.end.z + side.z };
      }
      ['start', 'end', 'point', 'anchor'].forEach(field => {
        if (!copy[field] || typeof copy[field] !== 'object') return;
        const { srcId: _s, offX: _ox, offZ: _oz, ...pt } = copy[field];
        copy[field] = { ...pt };
      });
      if (Array.isArray(copy.points)) {
        copy.points = copy.points.map(pt => {
          const { srcId: _s, offX: _ox, offZ: _oz, ...keep } = pt || {};
          return { ...keep };
        });
      }
      drawing[key] = drawing[key] || [];
      drawing[key].push(copy);
      landed.push({ type, item: copy });
    });
    if (!landed.length) return 0;
    // A PASTED STAIR'S WELL AND OPEN SIDE, as a placed one's: only the copies,
    // every stair already there is served.
    const pastedStairs = landed.filter(e => e.type === 'stair').map(e => e.item);
    const stairBuilt = [];
    if (pastedStairs.length) {
      const served = new Set((drawing.stairs || []).filter(st => !pastedStairs.includes(st)).map(st => st.id));
      stairBuilt.push(...buildStairOpenings(served).placed, ...placeStairSideFraming(pastedStairs).placed);
    }
    // ONE UNDO TAKES THE PASTE BACK, every piece of it.
    undoStack.push({ kind: 'built', walls: landed.filter(e => e.type === 'wall').map(e => e.item),
      outlines: [], openings: [],
      items: [...landed.filter(e => e.type !== 'wall').map(({ type, item }) => ({ list: drawing[SELECTION_LISTS[type]], item })), ...stairBuilt] });
    markDirty();
    // SELECTED WHERE IT LANDED, so the drafter can see what he just put down
    // and move it without hunting for it.
    setSelection(landed);
    paint();
    return landed.length;
  };

  // A COPY OF THE SELECTION FIRST. deleteWall calls setSelection, which
  // rebuilds the array being walked; iterating the live one deletes every
  // second thing and reports success.
  const deleteSelection = () => {
    if (!drawing || !selection.length) return 0;
    // A FIXED ASSEMBLY'S FIXTURES STAY WHEN ITS WALLS GO (Movie, 23 Oct:
    // "the shower seems to be deleted if i delete this back wall, can we do
    // the same thing we did with the toilet so the wall can be deleted"). A
    // press on one wall picks the whole WC, walls and fixtures; DELETE takes
    // the walls, and their cascade leaves each fixture standing where it was
    // (deleteWall's `host`), as it does for a wall deleted on its own. A
    // fixture is deleted when it is picked on its own.
    const stays = entry => {
      if (entry.type !== 'fixture') return false;
      const owner = groupOf(entry);
      return !!owner && owner.fixed === true
        && selection.some(e => e.type === 'wall' && groupOf(e) === owner);
    };
    const staying = selection.filter(stays);
    const doomed = selection.filter(entry => !stays(entry));
    let gone = 0;
    const mark = undoStack.length;
    doomed.forEach(entry => { if (deleteEntry(entry)) gone += 1; });
    if (!gone) return 0;
    if (staying.length) {
      sayOnStrip(`${staying.length === 1 ? 'The fixture stays' : `${staying.length} fixtures stay`} where ${staying.length === 1 ? 'it' : 'they'} stood \u2014 pick one on its own to delete it. UNDO puts the walls back.`);
    }
    // A DELETED ROW OF BEAM LENGTHENS THE BAYS EITHER SIDE OF IT, so its
    // floor is asked again -- see stepUpJoists -- in the same UNDO.
    const framing = [...new Set(doomed.filter(e => e.type === 'beam').map(e => Number(e.item.levelId)))];
    const stepped = framing.map(stepUpJoists);
    const stepEdits = stepped.flatMap(r => r.edits);
    if (stepEdits.length) {
      undoStack.push({ kind: 'props', edits: stepEdits });
      sayOnStrip(`${stepped.flatMap(r => r.said).join('. ')}. UNDO puts it back.`);
    }
    // AND THE STAIRS BESIDE A BEAM THAT WENT -- see reframeStairsOn. Every
    // beam counts: another stair measures its sides to this one's framing as
    // to any carrier. But not the stair whose OWN side beam went: deleting
    // that is the drafter's call (`spare`).
    const carriers = [...new Set(doomed.filter(e => e.type === 'beam')
      .map(e => Number(e.item.levelId)))];
    const spare = (drawing.stairs || []).filter(stair =>
      doomed.some(e => e.type === 'beam' && Number(e.item.stairId) === Number(stair.id)));
    const reframed = carriers.length ? reframeStairsOn(carriers, spare) : [];
    reframed.forEach(r => undoStack.push(...r.steps));
    const framedSaid = stairFramingSaid(reframed);
    if (framedSaid) sayOnStrip(`${framedSaid.trim()} UNDO puts it back.`);
    // ONE DELETE, ONE UNDO: a row of beam is several pieces, and a click
    // takes them all, so the press that took them puts them back together.
    if (undoStack.length - mark > 1) undoStack.push({ kind: 'batch', steps: undoStack.splice(mark) });
    setSelection(selection.filter(entry => !doomed.includes(entry)));
    return gone;
  };

