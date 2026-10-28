// MODEL.html's page script, part 7 of 17: moving a corner and a wall, the room corner card, the magnet, the ordered garage.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── move a corner ─────────────────────────────────────────────────────────
  // THE DRAG MOVES THE POOLED VERTEX OBJECT, not a copy of its numbers. That
  // is the whole mechanism: load rebuilt reference equality at shared corners
  // (the pool, above), so one wall's endpoint IS its neighbour's, and writing
  // x/z once carries every wall in every view that meets there. Nothing
  // iterates "the other walls", because there is no such list to get wrong.
  //
  // The two distances are the old page's, measured rather than chosen:
  //   grab  _findVertexHit, MODEL.dc.html:16589 — _magnetRadius() * 1.5,
  //         and _magnetRadius() is snapZone * 5 (MODEL.dc.html:16532)
  //   arm   the node drag turns live past 4px of travel, MODEL.dc.html:10825
  // 30px to pick a corner up. Where it SNAPS is the one snapping rule's
  // (reachFt, below).
  const CORNER_GRAB_PX = window.DraftSnapZone.DEFAULT_SNAP_ZONE * 5 * 1.5;
  const DRAG_ARM_PX = 4;

  // A BUILD HOUSE wall corner rides a BONEYARD master point: srcId names the
  // master, offX/offZ hold the corner's offset from it. THE OLD PAGE KEEPS THE
  // LINK THROUGH A DRAG and re-measures the offset — _relinkVertex,
  // MODEL.dc.html:11641, called on every moved ref at MODEL.dc.html:10855. It
  // never drops srcId. This page matches that, because a dropped link is a
  // wall that quietly stops following its bone and nothing says so.
  //
  // The masters are reachable here: `drawing` is the parsed save spread whole,
  // so drawing.boneyardOutlines arrives untouched. It arrives RAW, which is
  // the trap — storage names a master point's id `id` (drawing-format.js:698)
  // and only MODEL.dc.html's loader renames it `pointId` in memory
  // (MODEL.dc.html:5828). Reading `pointId` here would resolve nothing,
  // silently, on every corner in the drawing.
  const masterPointById = srcId => {
    for (const master of (drawing?.boneyardOutlines || [])) {
      const src = (master?.points || []).find(p => p && String(p.id) === String(srcId));
      if (src) return src;
    }
    return null;
  };

  // ── §4: THE MASTER GOVERNS ─────────────────────────────────────────────────
  // A PORT of MODEL.dc.html:12057 `_propagateMasterOutline(master)`, and the
  // order is emphatic that it must be one: "the propagation is not the
  // outline, it is the dozen things that ride the outline. A fresh
  // implementation gets the corners right and silently leaves the dimension
  // strings, the teleposts and the garage behind."
  //
  // So every rider below is carried across, each with its own loop, and the
  // gate mutates them away SEPARATELY -- a check that only reads the outline
  // passes with all four deleted.
  //
  // THE CONTRACT IS srcId + OFFSET, and it is already this page's: relinkVertex
  // just below re-measures offX/offZ against the master on every drag, so a
  // rider that has been dragged off the corner keeps the gap it was given.
  // Propagation is the write half of the same contract relinkVertex reads.
  //
  // NAMES: storage calls a master point's id `id` (drawing-format.js:698) and
  // only MODEL.dc.html renames it `pointId` in memory (:5828). This page reads
  // the file's own spelling, which is what masterPointById already does.
  const propagateMasterOutline = master => {
    if (!master || !drawing) return 0;
    const byId = new Map((master.points || []).map(pt => [String(pt.id), pt]));
    if (!byId.size) return 0;
    let moved = 0;

    // THE COPIES. DC selects them by masterId and each point by srcId; both
    // links are stamped at addLevel, which is what the previous commit fixed.
    (drawing.outlines || []).forEach(outline => {
      if (String(outline.masterId || '') !== String(master.id)) return;
      const overridden = new Set(outline.overriddenSrcIds || []);
      (outline.points || []).forEach(pt => {
        if (!pt.srcId) return;
        const src = byId.get(String(pt.srcId));
        if (!src) return;
        // §5a: A HAND-MOVED POINT FREEZES. It stays exactly where the
        // drafter put it and the master moves out from under it.
        //
        // THIS IS A DELIBERATE DIVERGENCE FROM MODEL.dc.html, which rides the
        // point at its stored offset (:12057). Movie ruled the other way, and
        // the reason is what an override MEANS: the drafter took this one
        // corner off the master by hand. Riding keeps it following the master
        // forever at a fixed gap, which is the one thing the override was
        // pressed to stop -- it makes "overridden" mean "offset", and there is
        // already a word for offset, on every rider below.
        //
        // The port landed first and this is its own commit, per the order:
        // "the two changes fail differently and a combined one cannot be
        // bisected". A freeze that is wrong strands a corner; a port that is
        // wrong moves the whole plan.
        //
        // offX/offZ ARE LEFT ALONE rather than cleared. relinkVertex owns
        // them and re-measures against the master on every drag, so they are
        // re-established the moment this point is dragged again -- and a
        // frozen point that still remembers its gap is what makes clearing an
        // override put it back on the corner it came from, whenever that verb
        // arrives. Clearing them here would throw that away silently.
        if (overridden.has(pt.srcId)) return;
        pt.x = src.x; pt.z = src.z; pt.bulge = src.bulge || 0;
        moved += 1;
      });
    });

    // RIDER 1: POOLED WALL VERTICES. Generated walls hold points linked to the
    // master they were built from; each follows at the offset measured when it
    // was generated or last dragged.
    const ride = vtx => {
      const src = vtx?.srcId ? byId.get(String(vtx.srcId)) : null;
      if (!src) return;
      vtx.x = src.x + (vtx.offX || 0);
      vtx.z = src.z + (vtx.offZ || 0);
      moved += 1;
    };
    (drawing.walls || []).forEach(w => { ride(w.start); ride(w.end); });

    // RIDER 2: AUTO-DIMENSION ENDS, so a footprint edit keeps every string
    // outside the moved plan instead of stranding it over the old wall.
    (drawing.dimensions || []).forEach(d => { ride(d.start); ride(d.end); });

    // RIDER 3: AUTO-BEAMS snapped to a jog corner (board #244), corner
    // teleposts with them -- the same srcId/offset contract.
    (drawing.beams || []).forEach(b => { ride(b.start); ride(b.end); });

    // RIDER 4: COLUMNS, which carry one point rather than two.
    (drawing.columns || []).forEach(c => ride(c.point));

    return moved;
  };

  const relinkVertex = vtx => {
    if (!vtx?.srcId) return;
    const src = masterPointById(vtx.srcId);
    if (src) { vtx.offX = vtx.x - src.x; vtx.offZ = vtx.z - src.z; }
  };

  // ── §6: A WALL PULLED OFF ITS FOOTPRINT ────────────────────────────────
  //
  // Movie, 15 Oct, asked what the footprint should do when a wall is dragged
  // away from it, and answered with the question itself: "can we ask them if
  // they would like a cantilever or overhang supported by a beam (2ft max if
  // cantilevel, 4-6 min if supported on beam. or ask them if they would like
  // to move the foundation other floors and roof at the same time --- 3
  // options".
  //
  // WHICH IS THE ONLY ANSWER THE PAGE CANNOT WORK OUT ITSELF. The drag says
  // where the wall went and nothing about what it meant: the same 2 ft east
  // is a cantilevered floor, a supported overhang, or the whole building
  // getting wider, and those are three different buildings. It is not what
  // his standing order covers -- "don't ask the user about placing beams and
  // columns ... just make the decision based on spans" is about SIZING what
  // the design needs, and this is the design.
  //
  // AND IT WAS A REAL HOLE, MEASURED, not a tidy-up. A wall dragged 4 ft east
  // moved its corner and left the outline where it was, so AUTO DIMS -- which
  // strings the OUTLINE, walls only as a fallback -- re-laid a 20'-0" overall
  // over a 24 ft building. The strings follow once the footprint does, which
  // is why the re-lay below waited on this.
  //
  // THE LADDER IS ALREADY WRITTEN, in two places that agree, and this reads
  // them rather than restating the numbers: tour.js's floorPullLadder (0 to
  // 2'-0" free, the 2'-0"-to-4'-6" gap jumped, piles out to 18'-0") and
  // boneyard-edit.js's CANTILEVER_FT / FIRST_PILE_FT / PILE_SPACING_FT /
  // PILE_FOOTING. His "4-6 min if supported on beam" is 4'-6", which is what
  // both of those have said since the BONEYARD went in.
  const footprintRules = () => {
    const BE = window.DraftBoneyardEdit;
    const T = window.DraftTour;
    return {
      cantileverFt: BE?.CANTILEVER_FT ?? 2,
      firstPileFt: BE?.FIRST_PILE_FT ?? 4.5,
      spacingFt: BE?.PILE_SPACING_FT ?? 8,
      footing: BE?.PILE_FOOTING ?? 'pile10',
      // The ladder answers {d, piles}: where the pull may stand, and the rows
      // that hold it there. A page without tour.js gets the free cantilever
      // and nothing else, which refuses rather than invents.
      ladder: T?.floorPullLadder
        ? want => T.floorPullLadder(want)
        : want => ({ d: Math.min(want, BE?.CANTILEVER_FT ?? 2), piles: [] }),
    };
  };

  // WHICH OUTLINE CORNERS THE DRAG LEFT BEHIND. A corner is "on" the
  // footprint when the wall vertex stood exactly on an outline point before
  // the drag -- not near it. The two are written as one place by the BUILD,
  // by the trace and by the pool, so slack here would catch a corner that was
  // never on the footprint and move it for no reason the drafter asked.
  const FOOTPRINT_TOL = 1e-6;
  const footprintBreak = md => {
    if (!drawing || !md?.before?.length) return null;
    if (md.kind !== 'corner' && md.kind !== 'wall') return null;
    // A BONE MASTER'S OWN POINT IS NOT A WALL OFF ITS FOOTPRINT. Dragging one
    // IS the "move everything" answer, and §4 above already carries it.
    if ((drawing.boneyardOutlines || []).some(master =>
      (master.points || []).includes(md.before[0].vtx))) return null;
    // AND NEITHER IS A LINE. The body grab answers for a selected LINE as
    // well as a wall now, so a 'wall' drag whose body is a line reaches here
    // -- and a line is draughting, not the building. It raises no storey and
    // carries no floor, so a cantilever under one would be a cantilever
    // under nothing. Without this, a line drawn along a wall and dragged off
    // it is asked whether the foundation should follow.
    if (md.body && !walls().includes(md.body)) return null;
    const levelId = Number(md.body?.levelId ?? activeLevelId());
    const copies = (drawing.outlines || []).filter(outline =>
      Number(outline.levelId) === levelId && outline.site !== true
      && (outline.points || []).length >= 3);
    if (!copies.length) return null;
    const moves = [];
    md.before.forEach(was => {
      if (Math.hypot(was.vtx.x - was.x, was.vtx.z - was.z) < FOOTPRINT_TOL) return;
      copies.forEach(outline => {
        const pt = (outline.points || []).find(p =>
          Math.abs(p.x - was.x) < FOOTPRINT_TOL && Math.abs(p.z - was.z) < FOOTPRINT_TOL);
        if (pt) moves.push({ outline, pt, from: { x: was.x, z: was.z },
          to: { x: was.vtx.x, z: was.vtx.z } });
      });
    });
    if (!moves.length) return null;
    // HOW FAR OFF, AND WHICH WAY. The distance is to the footprint AS IT
    // STOOD -- the nearest point on that loop, not the straight-line length
    // of the pull -- so a corner slid ALONG its own wall reads as nothing off
    // the footprint and a diagonal reads its true projection.
    const G = window.DraftGeometry2D;
    const loop = moves[0].outline.points.map(p => ({ x: p.x, z: p.z }));
    const offLoop = pt => loop.reduce((best, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return Math.min(best, G.pointToSegment(pt, { start: a, end: b }).d);
    }, Infinity);
    // AND THE MIDDLE OF WHAT MOVED IS PROBED AS WELL AS ITS ENDS, which a
    // dragged WALL BODY is the whole reason for. Push a wall 3 ft in and both
    // of its ends slide along the two walls beside it -- each one lands ON
    // the footprint, distance zero, while the wall between them is 3 ft away
    // from where it was. Ends alone read that gesture as nothing having left
    // the footprint, which is the one gesture "move ext wall inward" is made
    // of. For a single dragged corner the middle IS the corner, so the same
    // line answers both.
    const mid = moves.reduce((sum, move) => ({
      x: sum.x + move.to.x / moves.length,
      z: sum.z + move.to.z / moves.length,
    }), { x: 0, z: 0 });
    const outFt = Math.max(offLoop(mid), ...moves.map(move => offLoop(move.to)));
    if (outFt < 0.01) return null;
    // DIRECTION IS READ AT THE MIDDLE AND ONLY THERE. An end that slid along
    // its neighbouring wall sits ON the loop, where inside-or-out is a
    // coin toss between implementations -- so a wall pushed IN would read as
    // outward on the strength of a boundary point. The middle is strictly one
    // side or the other in every gesture that reaches here.
    const outward = !pointInLoop(loop, mid);
    return { moves, outFt, outward, levelId, loop, mid };
  };

  // ── THE THREE ANSWERS ──────────────────────────────────────────────────
  //
  // THE LADDER MOVES THE NUMBER, AND THE WALL GOES WITH IT. A pull of 3'-0"
  // lands in the band the ladder forbids, so CANTILEVER brings it back to
  // 2'-0" and ON PILES takes it out to 4'-6" -- and the WALL has to travel
  // with the footprint, or answering the question would leave the two
  // disagreeing again, which is the thing that was asked about.
  const scaleFootprintPull = (pending, targetFt) => {
    const k = pending.outFt > 0 ? targetFt / pending.outFt : 1;
    if (Math.abs(k - 1) < 1e-9) return;
    pending.md.before.forEach(was => {
      was.vtx.x = was.x + (was.vtx.x - was.x) * k;
      was.vtx.z = was.z + (was.vtx.z - was.z) * k;
      relinkVertex(was.vtx);
    });
    pending.moves.forEach(move => {
      move.to = {
        x: move.from.x + (move.to.x - move.from.x) * k,
        z: move.from.z + (move.to.z - move.from.z) * k,
      };
    });
    pending.outFt = targetFt;
  };

  // THIS LEVEL ONLY, AND THE MASTER IS TOLD TO KEEP ITS HANDS OFF. §5a: a
  // copy point the drafter has taken off the master FREEZES -- and that is
  // exactly what a cantilever is. This floor stands where he put it while the
  // floor below stays where it was, and a later master edit must not drag it
  // back flush and quietly undo the overhang.
  const footprintThisLevel = (pending, step) => {
    pending.moves.forEach(({ outline, pt, to }) => {
      step.before.push({ vtx: pt, x: pt.x, z: pt.z });
      pt.x = to.x; pt.z = to.z;
      if (!pt.srcId) return;
      const list = outline.overriddenSrcIds = outline.overriddenSrcIds || [];
      if (list.includes(pt.srcId)) return;
      list.push(pt.srcId);
      (step.overrides = step.overrides || []).push({ list, id: pt.srcId });
    });
  };

  // EVERY POINT THAT STOOD ON THAT CORNER TRAVELS, on every level. Where
  // there IS a master this goes through it, because that is the link the
  // drawing already has and §4 carries a dozen riders off it. Where there is
  // not -- a premade house "carries no master until the drafter makes one",
  // and the BONEYARD's own rules say so -- it falls back to the module's
  // geometric rule: what stands ON the outline moves with it.
  const footprintEveryLevel = (pending, step) => {
    const moved = [];
    const masters = new Set();
    const take = pt => {
      step.before.push({ vtx: pt, x: pt.x, z: pt.z });
      moved.push(pt);
    };
    pending.moves.forEach(({ pt, from, to }) => {
      const master = pt.srcId ? masterPointById(pt.srcId) : null;
      if (master) {
        // THE MASTER MOVES BY WHAT THE WALL MOVED, not to where the wall is:
        // the copy may be riding at an offset, and writing the wall's own
        // position onto the master would silently swallow that gap.
        take(master);
        master.x += to.x - from.x;
        master.z += to.z - from.z;
        const owner = (drawing.boneyardOutlines || [])
          .find(m => (m.points || []).includes(master));
        if (owner) masters.add(owner);
        return;
      }
      const dx = to.x - from.x, dz = to.z - from.z;
      const atCorner = p => p && Math.abs(p.x - from.x) < FOOTPRINT_TOL
        && Math.abs(p.z - from.z) < FOOTPRINT_TOL;
      const carry = p => { if (!atCorner(p) || moved.includes(p)) return; take(p); p.x += dx; p.z += dz; };
      (drawing.outlines || []).forEach(o => (o.points || []).forEach(carry));
      (drawing.walls || []).forEach(w => { carry(w.start); carry(w.end); });
      (drawing.lines || []).forEach(l => { carry(l.start); carry(l.end); });
      (drawing.floors || []).forEach(f => (f.points || []).forEach(carry));
      (drawing.beams || []).forEach(b => { carry(b.start); carry(b.end); });
    });
    // AND THE ROOF'S EAVE RIDES ITS OWN CORNER. The eave stands one overhang
    // OUT from the wall below, so it is never AT the corner and the sweep
    // above cannot see it -- but a corner that travels takes its eave the
    // same distance, the overhang being unchanged by the move. Matched by
    // proximity because that offset is the only thing linking the two: the
    // roof point inside one overhang's diagonal of the old corner, nearest
    // first, and at most one per roof.
    let eaves = 0;
    pending.moves.forEach(({ from, to }) => {
      const dx = to.x - from.x, dz = to.z - from.z;
      (drawing.roofs || []).forEach(roof => {
        const reach = (Number(roof.overhang) || 0) * Math.SQRT2 + 0.01;
        let best = null;
        (roof.points || []).forEach(p => {
          if (moved.includes(p)) return;
          const d = Math.hypot(p.x - from.x, p.z - from.z);
          if (d <= reach && (!best || d < best.d)) best = { p, d };
        });
        if (!best) return;
        take(best.p);
        best.p.x += dx; best.p.z += dz;
        eaves += 1;
      });
    });
    // ── AND NOW THE MASTER IS TOLD, which is the whole point of having gone
    // through it: §4 carries a dozen riders off one propagation -- every
    // level's copy, the walls, the dimension strings, the beams and the
    // teleposts -- and moving the master without it would move a point
    // nothing follows.
    //
    // AND THE DRAGGED WALL'S OFFSET NEEDS NOTHING DOING TO IT, which is worth
    // saying because the opposite looks obviously true. A vertex that had
    // been re-measured against its master during the drag would record a 4 ft
    // gap from a master about to move 4 ft, and propagating it as it stood
    // would land the wall 8 ft out -- twice what the hand did, from a gesture
    // that reads correctly on the master and on every copy.
    //
    // IT CANNOT HAPPEN HERE because a plain corner or wall drag does not
    // relink: relinkVertex is called from translateItemsBy -- the ASSEMBLY
    // drag -- and from the ladder's rescale below, and `group` is not a kind
    // that reaches this function. So the offsets are still the ones the
    // vertex had before the hand touched it, which is exactly what a whole
    // building moving wants.
    //
    // WRITTEN DOWN RATHER THAN GUARDED AGAINST. A restore here would be a
    // line nothing can reach, and the mutation gate said so: the mutant that
    // broke it changed no drawing. The day the corner drag relinks like the
    // assembly drag does, this is the paragraph that says what that breaks.
    if (masters.size) {
      masters.forEach(master => propagateMasterOutline(master));
      // UNDO RE-RUNS THE PROPAGATION rather than snapshotting what it
      // touched. The riders are reconstructed from master + offset, and undo
      // restores both of those from `before` -- so asking again rebuilds
      // precisely the drawing that was there, by the same contract, however
      // many riders the propagation grows later.
      step.repropagate = [...masters];
    }
    return { eaves };
  };

  // THE PILES UNDER A SUPPORTED OVERHANG, along its OUTER edge: one at each
  // end and infill at most PILE_SPACING_FT apart. The ladder's rows say
  // WHETHER an overhang needs holding up; where the weight lands is the far
  // edge, which for a dragged corner or a dragged wall is the line the drag
  // left behind.
  //
  // NOT pilePoints: that one walks a CLOSED house perimeter and stands its
  // first pile back from the foundation it must not disturb. This is one open
  // edge in open air, with no foundation to stand off from.
  //
  // THE MARK IS NOT WRITTEN HERE. A pile outside the perimeter wall carrying
  // floor and nothing else is P1 by the rule Movie gave on 15 Oct, and
  // pileMark reads that off the outlines at paint time -- so a mark written
  // in would be a second answer to a question already answered.
  const overhangPiles = (pending, step) => {
    const rules = footprintRules();
    const ends = pending.moves.map(move => move.to);
    const spots = [ends[0]];
    if (ends.length > 1) {
      const last = ends[ends.length - 1];
      const run = Math.hypot(last.x - ends[0].x, last.z - ends[0].z);
      const bays = Math.max(1, Math.ceil(run / rules.spacingFt));
      for (let i = 1; i <= bays; i += 1) {
        spots.push({
          x: ends[0].x + (last.x - ends[0].x) * (i / bays),
          z: ends[0].z + (last.z - ends[0].z) * (i / bays),
        });
      }
    }
    drawing.columns = drawing.columns || [];
    const placed = [];
    spots.forEach(spot => {
      const column = {
        id: newDrawingItemId('column'),
        point: { x: spot.x, y: 0, z: spot.z },
        levelId: FOUNDATION_LEVEL_ID,
        view: 'foundation',
        footing: rules.footing,
        // THE DRAFTER'S, NOT THE SUGGESTER'S. AUTO PILES sweeps its own and
        // would take these with it -- and they are not a suggestion, they are
        // what holds up the overhang he just asked for.
        auto: false,
      };
      drawing.columns.push(column);
      placed.push({ list: drawing.columns, item: column });
    });
    (step.items = step.items || []).push(...placed);
    return placed.length;
  };

  // ── AND INWARD, WHAT THE WALL UNCOVERED ────────────────────────────────
  //
  // Movie, 15 Oct, straight after the outward three: "for interior stretch we
  // could do the same thing, but it wouldn't create an exterior overhang, it
  // would offer move the full foundation roof etc, or move ext wall inward
  // for roof deck / floor req membrane".
  //
  // So the card is DIRECTIONAL. Pulled out, a wall is a cantilever, an
  // overhang or a wider building; pushed in, it is a smaller building or a
  // storey stepped back over the one below -- and what it steps off is a
  // ROOF DECK, which is a floor in the weather and needs a membrane.
  //
  // ONLY WHERE THERE IS A STOREY BELOW TO STEP OFF. The lowest storey
  // pushed in is just a smaller building: nothing is uncovered, there is no
  // deck, and offering one would name a thing that is not there.
  const storeyBelow = levelId => {
    const here = (drawing.levels || []).find(l => Number(l.id) === Number(levelId));
    if (!here) return null;
    return (drawing.levels || [])
      .filter(l => (Number(l.elev) || 0) < (Number(here.elev) || 0)
        && (drawing.outlines || []).some(o => Number(o.levelId) === Number(l.id)
          && o.site !== true && (o.points || []).length >= 3))
      .sort((a, b) => (Number(b.elev) || 0) - (Number(a.elev) || 0))[0] || null;
  };

  // THE GROUND THE WALL CAME OFF: the quad between where the corners stood
  // and where they stand now. One moved corner makes a sliver and two make a
  // strip, and the centroid of the points is where the note goes in both --
  // which is why this returns the points rather than a rectangle.
  const uncoveredPatch = pending => {
    const pts = [...pending.moves.map(m => m.from), ...pending.moves.map(m => m.to).reverse()];
    if (pts.length < 3) return null;
    const at = pts.reduce((sum, p) => ({ x: sum.x + p.x / pts.length, z: sum.z + p.z / pts.length }),
      { x: 0, z: 0 });
    return { points: pts, at };
  };

  // A STOREY STEPPED BACK, and the deck it leaves called by its name. The
  // outline move is the cantilever's, inward; what it leaves behind is said
  // in a note, because the format has no DECK and inventing one to carry a
  // sentence would be a format change doing a note's job. The geometry -- the
  // wall in, the floor below still out -- is what makes the deck; the note is
  // what makes the membrane get built.
  const DECK_NOTE = 'ROOF DECK — MEMBRANE OVER SLOPED FLOOR';
  const stepInForDeck = (pending, step) => {
    footprintThisLevel(pending, step);
    const patch = uncoveredPatch(pending);
    const below = storeyBelow(pending.levelId);
    if (!patch || !below) return null;
    drawing.notes = drawing.notes || [];
    const id = drawing.notes.reduce((top, n) => Math.max(top, Number(n.id) || 0), 0) + 1;
    const at = { ...patch.at, y: 0 };
    const note = {
      id, anchor: at, text: { ...at }, levelId: pending.levelId, view: 'plan',
      // ON THIS LEVEL'S PLAN, not the one below's, because that is the sheet
      // the deck is read off: standing on the stepped-back storey, the deck
      // is the ground outside its walls.
      //
      // `end: 'none'` IS WHAT LETS THE TEXT SIT ON THE ANCHOR. A leader of no
      // length is refused by the loader, and a deck wants its name written
      // across it rather than pointed at from somewhere else.
      body: DECK_NOTE, end: 'none',
      fill: false, fillOpacity: 0.85, outline: false, bullnose: 0,
      layer: 'A-ANNO-NOTE',
    };
    drawing.notes.push(note);
    (step.items = step.items || []).push({ list: drawing.notes, item: note });
    return { below };
  };

  // ── THE CARD ───────────────────────────────────────────────────────────
  //
  // ONE GESTURE, ONE UNDO, as everywhere else on this page: the drag's own
  // 'move' step is already on the stack when the card goes up, and the answer
  // is written INTO it -- the outline points onto `before`, the piles onto
  // `items`, the override onto `overrides`. So the Ctrl+Z that puts the wall
  // back puts the footprint, the piles and the freeze back with it, and there
  // is never a half-answered drag on the stack.
  const footprintCard = document.getElementById('footprint-ask');
  let footprintPending = null;
  // ── THE ROOM CORNER CARD (Movie, 23 Oct) ─────────────────────────────
  // A press on a shape's corner that is a wall's node. MOVE WALL AND FLOOR
  // picks the wall standing on the node, so the next drag of that node
  // takes both (the corner IS the node). DE-LINK gives the shape its own
  // copy of the point, so the corner drags on its own; one UNDO relinks it.
  const roomCornerCard = document.getElementById('room-corner-ask');
  let roomCornerPending = null;
  const askRoomCorner = (tag, index) => {
    roomCornerPending = { tag, index };
    if (!roomCornerCard) { settleRoomCorner('free'); return; }
    roomCornerCard.hidden = false;
    setTimeout(() => roomCornerCard.querySelector('[data-room-corner-wall]')?.focus(), 0);
  };
  const settleRoomCorner = choice => {
    const pending = roomCornerPending;
    roomCornerPending = null;
    if (roomCornerCard) roomCornerCard.hidden = true;
    if (!pending) return;
    const { tag, index } = pending;
    const pt = tag.points?.[index];
    if (!pt) return;
    if (choice === 'wall') {
      const on = wallsOnCorner(pt);
      if (on.length) setSelection(on.map(wall => ({ type: 'wall', item: wall })));
      sayOnStrip('Drag the node: the wall and the floor move together.');
    } else if (choice === 'free') {
      const before = { ...tag, points: tag.points.slice() };
      tag.points = tag.points.map((p, i) => (i === index ? { x: p.x, z: p.z } : p));
      undoStack.push({ kind: 'props', edits: [{ item: tag, before }] });
      markDirty();
      sayOnStrip('The corner is free of the wall \u2014 drag it on its own. UNDO links it back.');
    }
    showSelectionProps();
    paint();
  };
  if (roomCornerCard) {
    roomCornerCard.querySelector('[data-room-corner-wall]').addEventListener('click', () => settleRoomCorner('wall'));
    roomCornerCard.querySelector('[data-room-corner-free]').addEventListener('click', () => settleRoomCorner('free'));
    roomCornerCard.addEventListener('click', e => { if (e.target === roomCornerCard) settleRoomCorner(null); });
  }
  const ft2txt = ft => window.DraftFormatters.formatArchitecturalInches(ft * 12);

  const settleFootprint = choice => {
    const pending = footprintPending;
    footprintPending = null;
    if (footprintCard) footprintCard.hidden = true;
    if (!pending) return;
    const { step } = pending;
    const rules = footprintRules();
    const said = [];
    if (choice === 'cantilever') {
      scaleFootprintPull(pending, Math.min(pending.outFt, rules.cantileverFt));
      footprintThisLevel(pending, step);
      said.push(`CANTILEVER ${ft2txt(pending.outFt)} — the floor projects past the one below`);
    } else if (choice === 'piles') {
      const { d, piles } = rules.ladder(Math.max(pending.outFt, rules.firstPileFt));
      scaleFootprintPull(pending, d);
      footprintThisLevel(pending, step);
      const n = piles.length ? overhangPiles(pending, step) : 0;
      said.push(`OVERHANG ${ft2txt(d)} on ${n} ${n === 1 ? 'pile' : 'piles'}`);
      // THE LADDER'S OWN JUMP, SAID OUT LOUD. A 3'-0" pull comes back 4'-6"
      // and the drafter did not type either number; silence here reads as the
      // page having moved his wall for reasons of its own.
      if (Math.abs(d - pending.pulled) > 0.01) {
        said.push(`taken out from ${ft2txt(pending.pulled)} — nothing may stand between `
          + `${ft2txt(rules.cantileverFt)} and ${ft2txt(rules.firstPileFt)}`);
      }
    } else if (choice === 'deck') {
      const made = stepInForDeck(pending, step);
      said.push(`STEPPED IN ${ft2txt(pending.outFt)}`);
      // THE MEMBRANE IS THE POINT, so it is the sentence rather than a
      // detail of it: a floor that was inside the building a moment ago is
      // in the weather now, and nothing else on the plan says so.
      said.push(made
        ? `what it stepped off is a ROOF DECK over ${made.below.name} and wants a membrane`
        : 'nothing was uncovered, so no deck was named');
    } else if (choice === 'all') {
      const { eaves } = footprintEveryLevel(pending, step);
      said.push(`The whole building moved ${ft2txt(pending.outFt)}`);
      // WHAT DID NOT FOLLOW IS SAID TOO. A roof whose eave this could not
      // find is a roof still drawn over the old corner, and a drafter who is
      // not told goes to print with it.
      said.push(eaves ? `foundation, floors and ${eaves} roof ${eaves === 1 ? 'eave' : 'eaves'} with it`
        : 'foundation and floors with it — no roof eave sat on that corner, so check the roof');
    } else {
      // ESCAPE: what this page did before the card existed. A wall standing
      // off its footprint is a real thing to want for a moment, and the only
      // wrong answer is to decide for him.
      said.push('The wall stands off its footprint — the floor below is unchanged');
    }
    foldRedim(step);
    markDirty();
    sayOnStrip(`${said.join(' · ')}.`);
    paint();
  };

  // THE TOY BOARD IS NOT ASKED. Nothing on that board has a foundation to
  // cantilever off, and a modal in the middle of a child's drag is the one
  // thing the board is built not to do -- it takes the whole-building answer,
  // which is what a bone push means there, and says so on the strip.
  const offerFootprintChoice = (md, step) => {
    const found = footprintBreak(md);
    if (!found) return false;
    // `pulled` is what the HAND did and never changes; `outFt` is where the
    // answer put it, and the ladder may move that.
    footprintPending = { ...found, md, step, pulled: found.outFt };
    if (board === 'toy' || !footprintCard) {
      settleFootprint('all');
      return true;
    }
    const rules = footprintRules();
    const q = sel => footprintCard.querySelector(sel);
    q('[data-footprint-out]').textContent = ft2txt(found.outFt);
    q('[data-footprint-side]').textContent = found.outward ? 'past' : 'inside';
    const cant = q('[data-footprint-cantilever]');
    const piles = q('[data-footprint-piles]');
    const deck = q('[data-footprint-deck]');
    // THE CARD IS DIRECTIONAL (Movie, 15 Oct). Pulled OUT, a wall is a
    // cantilever, an overhang or a wider building. Pushed IN, nothing
    // projects: it is a smaller building, or a storey stepped back over the
    // one below -- and the deck that leaves is only a deck if there IS a
    // storey below it to step off.
    cant.hidden = !found.outward || found.outFt >= rules.firstPileFt;
    piles.hidden = !found.outward || found.outFt <= rules.cantileverFt;
    deck.hidden = found.outward || !storeyBelow(found.levelId);
    if (!cant.hidden) {
      q('[data-footprint-cantilever-label]').textContent =
        ft2txt(Math.min(found.outFt, rules.cantileverFt));
    }
    if (!piles.hidden) {
      q('[data-footprint-piles-label]').textContent =
        ft2txt(rules.ladder(Math.max(found.outFt, rules.firstPileFt)).d);
    }
    footprintCard.hidden = false;
    // THE FIRST ANSWER THAT IS ACTUALLY OFFERED takes the focus, so Enter
    // always lands on something the card is showing. Written as the row's
    // own order rather than as a chain of ternaries, which is what it was
    // the moment a fourth button existed.
    const offered = [cant, piles, deck, q('[data-footprint-all]')]
      .find(button => !button.hidden);
    setTimeout(() => offered && offered.focus(), 0);
    return true;
  };

  if (footprintCard) {
    footprintCard.querySelector('[data-footprint-cantilever]')
      .addEventListener('click', () => settleFootprint('cantilever'));
    footprintCard.querySelector('[data-footprint-piles]')
      .addEventListener('click', () => settleFootprint('piles'));
    footprintCard.querySelector('[data-footprint-deck]')
      .addEventListener('click', () => settleFootprint('deck'));
    footprintCard.querySelector('[data-footprint-all]')
      .addEventListener('click', () => settleFootprint('all'));
    // ENTER TAKES WHAT IS FOCUSED, Escape leaves the wall where it was
    // dropped -- corner-join's own pair of keys, and for its reasons.
    window.addEventListener('keydown', event => {
      if (footprintCard.hidden || (event.key !== 'Enter' && event.key !== 'Escape')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { settleFootprint('off'); return; }
      const focused = document.activeElement;
      if (focused?.matches?.('[data-footprint-cantilever]')) settleFootprint('cantilever');
      else if (focused?.matches?.('[data-footprint-piles]')) settleFootprint('piles');
      else if (focused?.matches?.('[data-footprint-deck]')) settleFootprint('deck');
      else settleFootprint('all');
    }, true);
  }

  // Only the SELECTED wall's own two corners are grabbable. Selection first,
  // then drag: without that rule every pan begun near any corner anywhere in
  // the drawing would move it instead of sliding the sheet.
  // THE ONE SEGMENT THE DRAFTER HAS CHOSEN, wall or line -- the two records
  // whose shape IS two points. selectedWall() stays as it is: the WALL drags
  // and the assembly panel are about walls, and widening it would hand a line
  // to machinery that reads wallType and refLine.
  const selectedSegment = () => {
    if (selection.length !== 1) return null;
    const { type, item } = selection[0];
    if (type === 'wall') return walls().includes(item) ? item : null;
    if (type === 'line') return lines().includes(item) ? item : null;
    return null;
  };
  const cornerAt = worldPt => {
    // THE MASTER'S OWN CORNERS, on the boneyard, and this is §4's missing
    // gesture. Same rule as a wall's: SELECTION FIRST, then the grab -- so a
    // pan begun near a corner still pans, and only the outline the drafter
    // chose offers handles.
    // AND A SHELF WALL'S OR LINE'S ENDS AS WELL (Movie, 22 Oct, on a suite
    // on the shelf: "the length of the walls seems to be locked, can we
    // allow the user to select the nodes at the end of the line and then
    // change its length by dragging"). This returned null for anything but
    // a master here, so on the shelf a wall slid by its body and its ends
    // took no grab at all; a selected master still offers its corners, and
    // anything else falls through to the rule below.
    if (showingBoneyard()) {
      const lone = selection.length === 1 && selection[0].type === 'outline'
        ? selection[0].item : null;
      if (lone && outlines().includes(lone)) {
        const G = window.DraftGeometry2D;
        return G.nearestVertex(lone.points || [], worldPt, CORNER_GRAB_PX / view.scale);
      }
    }
    // AND A SELECTED LINE'S TWO ENDS, which the LINE panel has promised since
    // it was written -- "A LINE IS TWO POINTS. DRAG AN END TO CHANGE IT." --
    // and this page had no path for: this offered the selected WALL's ends and
    // nothing else, and the multi-item drag needs two things selected, so a
    // press on a single selected line's end slid the sheet. A panel that
    // describes a gesture the page has not got is worse than one that says
    // nothing, because the drafter reads it as the drag failing.
    //
    // IT NEEDED NOTHING ELSE. A line's ends are POOLED VERTICES like a wall's
    // (the LINE tool commits them through poolVertex), the 'corner' drag
    // writes a point through and relinks it, the 'move' undo step restores
    // points whatever record holds them, and splitRunCorners leaves early on
    // anything but a TOY wall. The gesture was already general; the pick was
    // the only thing that was not.
    const selectedSeg = selectedSegment();
    if (!selectedSeg || !selectedSeg.start || !selectedSeg.end) return null;
    // THE TYPE FILTER GOVERNS THIS GRAB TOO, for segmentBodyAt's reason:
    // "WALL is engaged: nothing else responds", and a press that takes hold
    // of a point is responding.
    //
    // THIS HALF WAS ALREADY WRONG, and it is fixed here because the two are
    // one rule and one gesture -- the ends and the body of the same record.
    // Measured before the line was written: a LINE selected under ALL, WALL
    // engaged after, and its end still dragged. Leaving it would make the
    // note on segmentBodyAt a lie about the page rather than a description
    // of it.
    if (!filterAllows(walls().includes(selectedSeg) ? 'wall' : 'line')) return null;
    const G = window.DraftGeometry2D;
    const ends = [selectedSeg.start, selectedSeg.end].filter(Boolean);
    return G.nearestVertex(ends, worldPt, CORNER_GRAB_PX / view.scale);
  };

  // Corners on screen that a moving vertex may snap to. Excluded by reference
  // AND by coincident position, matching _withoutVertices (MODEL.dc.html:16543):
  // the pool keys corners by (level, view, body), so a garage corner and a
  // house corner can share a spot as two separate objects, and offering one as
  // a snap target for the other would be a snap that moved nothing.
  const snapCandidates = moving => {
    const out = [];
    walls().concat(bgWalls()).forEach(wall => {
      [wall.start, wall.end].forEach(v => {
        if (!v || moving.includes(v)) return;
        if (moving.some(m => Math.abs(v.x - m.x) < 0.001 && Math.abs(v.z - m.z) < 0.001)) return;
        out.push(v);
      });
    });
    return out;
  };

  // SNAP OFF, OR CTRL HELD, AND THE POINT GOES WHERE THE HAND IS (Movie, 26
  // Oct, the one snap rule): this catch too, now that it reaches a node's 2".
  const cornerSnap = (worldPt, moving) => (snapLive()
    ? window.DraftGeometry2D.nearestVertex(snapCandidates([moving]), worldPt, reachFt(NODE_REACH))
    : null);

  // ── SNAP AND TRACK (Movie, 17 Oct) ──────────────────────────────────────
  //
  // SNAP: "when i draw a LINE or a WALL, see those nodes where the wall ends,
  // i'd like them to light up glow orange when the mouse scrolls over and if
  // the user clicks NEARBY those within an 4" dia 2" radius ... make the point
  // go righton the other node". Two inches -- or a few pixels, whichever is
  // more, because zoomed out two inches is less than a pixel and no hand can
  // find it.
  //
  // TRACK: the cross lines square to a node, and "i want to be able to 'snap'
  // on the cross lines yes so i can easily connect back to a node
  // perpendicular" -- which turns over his 1 Oct "no snapping to the line"
  // for the rays; with TRACK unlit they are gone altogether. A press within
  // a few pixels of a node's line lands on it; near two (one level with a
  // node, one plumb with another) it lands where they cross.
  //
  // THE BULLSEYE, on an empty level only: "when the user mouses over the
  // TARGET when the screen is clear (nothing on it) snap that node to within
  // 2.5ft radius of that point. (only when nothing is around, later on once
  // the user has drawn a line or wall, don't make it magnetic after that".
  const BULLSEYE_PULL_FT = 2.5;
  // AND THE CORNERS OF THE WALLS' FACES (Movie, 18 Oct: "can i make the EXT
  // WALL corner nodes (on the outline wall lines) ... so i can reference that
  // edge of wall when i draw or change things"): the outside and inside
  // corners of this level's walls, and on ROOF PLAN the corners of the wall
  // tops drawn there. Worked out once per drawing change and level, not on
  // every move of the mouse.
  let faceCornerCache = { key: null, list: [] };
  const wallFaceNodes = () => {
    const G = window.DraftGeometry2D;
    if (!G?.wallFaceCorners || !drawing) return [];
    const key = `${modelEpoch}|${activeLevelId()}|${activeViewId() || ''}|${[...bgLayers].join(',')}`;
    if (faceCornerCache.key === key) return faceCornerCache.list;
    const own = walls();
    // AND THE BG LAYERS' WALLS, so their corners pull too (Movie, 21 Oct: "i
    // would like the NODES to work in the BG").
    const segs = (own.length ? own : (activeLevelId() === ROOF_LEVEL_ID && G.roofPlanWalls
      ? G.roofPlanWalls({ walls: drawing.walls || [], outlines: drawing.outlines || [],
        floors: drawing.floors || [], levels: drawing.levels || [] }) : [])).concat(bgWalls());
    faceCornerCache = { key, list: G.wallFaceCorners(segs, openingThicknessFt()) };
    return faceCornerCache.list;
  };
  // ── THE MAGNET: FACE CORNERS PULL HARDEST, THEN THE FACE LINES ─────────
  //
  // Movie, 19 Oct, lining a 3 1/2" wall's node up with the inside corner of a
  // 5 1/2" interior wall: "can these interior walls be 'attracted' to SNAP to
  // the INTERIOR CORNER and also to the INTERIOR WALL LINE (but more pull
  // from the inside/outside corners" -- "when i draw a LINE i'd also like
  // these NODES and int lines to allow SNAPPING and magnetic type behavior
  // with glowing mouse rollovers". So a face corner reaches twice as far as a
  // face line, every wall's faces -- interior walls as much as exterior --
  // pull a point drawn or dragged near them, and the corners and faces in
  // reach light up in the cross lines' neon.
  // ── THREE TIERS OF MAGNET (Movie, 19 Oct) ────────────────────────────
  //
  // "all the ext CORNERS become NODES, or to ACT like nodes (the ACT LIKE
  // nodes, also on all interior corners will be YELLOW glow and will be
  // slightly less magnetic than the ORANGE NODES and then the YELLOW/ GREEN
  // NEON color will be for WALL SURFACES which will also be magnetic".
  //
  // ORANGE is a wall's or a line's own end. YELLOW is a corner that acts
  // like one: a face corner (outside, inside, a free end's two), or where two
  // runs cross with no node there. NEON is a face line. Each tier pulls over
  // its own reach, orange furthest. Between two POINTS in reach THE NEARER
  // WINS, the orange on a tie (one snapping rule, Movie 26 Oct: plain
  // nearest). A face is a LINE and the hand is always on some point of it,
  // so a point in reach beats a face every time -- #807's "more pull from
  // the inside/outside corners".
  // THE KINDS OF TARGET a point can be caught by -- what each reaches is
  // the one snap rule's (reachFt, below).
  const NODE_REACH = 'node';
  const CORNER_REACH = 'corner';
  const LINE_REACH = 'line';
  // How near the cursor a magnet has to be to light up at all.
  const MAGNET_SHOW_PX = 48;
  let faceLineCache = { key: null, list: [] };
  const wallFaceSegs = () => {
    const G = window.DraftGeometry2D;
    if (!G?.wallFaceLines || !drawing) return [];
    const key = `${modelEpoch}|${activeLevelId()}|${activeViewId() || ''}`;
    if (faceLineCache.key === key) return faceLineCache.list;
    faceLineCache = { key, list: G.wallFaceLines(walls(), openingThicknessFt()) };
    return faceLineCache.list;
  };
  // ── THE ONE SNAP RULE (Movie, 25-26 Oct) ─────────────────────────────
  //
  // Every catch on this page asks this one function how far it reaches.
  // IN INCHES ON THE PLAN, not pixels: "i don't want to 'hit it' when i'm
  // zoomed out, i want to zoom in and hit it so i know i hit the right
  // thing" -- and "3" is too far i think more like 1.5 or 2"". A wall's end
  // or node 2", a face corner or a crossing 1 1/2", a line or a tracking
  // line 1", a suite lining up 3" ("both at 3""). Drawn on the screen that
  // is never under 4 px ("can we have a snap on the floor") -- a hand right
  // on top of a point still catches it, zoomed out or not -- and never over
  // 30 px, so a corner close up does not grab from across the screen.
  // SNAP STRENGTH (SETTINGS) scales the whole set; CTRL HELD switches every
  // catch off until it is let go ("hold Ctrl ... and the point goes exactly
  // where your mouse is").
  const SNAP_REACH_IN = Object.freeze({ node: 2, corner: 1.5, line: 1, track: 1, suite: 3 });
  const SNAP_FLOOR_PX = 4;
  const SNAP_CEILING_PX = 30;
  // CTRL HELD (13-suites-trim-follow.js): nothing reaches, so every catch
  // below finds nothing and the point goes where the hand is.
  var snapHeldOff = false;
  const snapLive = () => snapOn && !snapHeldOff;
  // Read once a page: SETTINGS is another page, and a change there is
  // picked up the next time MODEL opens.
  let snapStrengthRead = null;
  const snapStrength = () => {
    if (snapStrengthRead == null) {
      const S = window.DraftSnapZone;
      let stored;
      try { stored = window.DraftProfileManager?.getActive?.('settings')?.content?.model?.snapReach; } catch { stored = null; }
      snapStrengthRead = S?.normaliseSnapReach ? S.normaliseSnapReach(stored) : 1;
    }
    return snapStrengthRead;
  };
  const reachFt = kind => {
    if (snapHeldOff) return -1;
    const ft = (SNAP_REACH_IN[kind] || SNAP_REACH_IN.node) / 12 * snapStrength();
    // A SUITE LINES UP BY THE BUILDING'S OWN TOLERANCE, in inches whatever
    // the zoom; every other target by the floor and ceiling on the screen.
    if (kind === 'suite') return ft;
    const px = Math.min(SNAP_CEILING_PX, Math.max(SNAP_FLOOR_PX, ft * view.scale));
    return px / view.scale;
  };
  // ── EVERY RUN AND LOOP ON THE LEVEL FEEDS ONE MAGNET (Movie, 19 Oct) ──
  //
  // "id like the lines / walls / areas / floors/ roofs etc to all act in
  // this way". A loop's corners -- a floor's, a roof's, an outline's, a
  // shape's -- are its own nodes (orange); its edges and a line's body are
  // faces (neon); and where any two runs cross with no node there is a
  // corner that acts like one (yellow). One list each, read by the draw,
  // the drag and the paint alike.
  const loopsHere = () => [...floors(), ...roofs(), ...outlines(), ...shapes()]
    .filter(item => Array.isArray(item?.points) && item.points.length >= 3);
  const loopCorners = () => loopsHere().flatMap(item => item.points
    .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.z)));
  const loopEdges = () => loopsHere().flatMap(item => item.points.map((p, i) =>
    ({ start: p, end: item.points[(i + 1) % item.points.length], loop: item })));
  // Every straight run on the level, start to end.
  const runsHere = () => [...walls(), ...lines(), ...loopEdges()];
  // A line's body and a loop's edge are faces as they stand (a wall's are
  // its two, wallFaceLines).
  const bodySegs = runs => runs.filter(r => r?.start && r?.end && !r.bulge)
    .map(r => ({ a: r.start, b: r.end, run: r }));
  let magnetSegCache = { key: null, list: [] };
  const magnetSegs = () => {
    if (!drawing) return [];
    const key = `${modelEpoch}|${activeLevelId()}|${activeViewId() || ''}`;
    if (magnetSegCache.key === key) return magnetSegCache.list;
    magnetSegCache = { key, list: [...wallFaceSegs(), ...bodySegs([...lines(), ...loopEdges(), ...siteRoofEdges()])] };
    return magnetSegCache.list;
  };
  // ON THE SITE, THE ROOF'S EDGES are lines to land on too (siteSnapNodes).
  const SITE_SNAP_LEVEL = 8;
  const siteRoofEdges = () => (Number(activeLevelId()) === SITE_SNAP_LEVEL && drawing
    ? (drawing.roofs || []).filter(r => Array.isArray(r?.points) && r.points.length >= 3)
      .flatMap(r => r.points.map((p, i) => ({ start: p, end: r.points[(i + 1) % r.points.length] })))
    : []);
  // WHERE RUNS CROSS WITH NO NODE THERE: yellow corners too, on this level.
  let crossingCache = { key: null, list: [] };
  const crossingNodes = () => {
    const G = window.DraftGeometry2D;
    if (!G?.lineCrossings || !drawing) return [];
    const key = `${modelEpoch}|${activeLevelId()}|${activeViewId() || ''}`;
    if (crossingCache.key === key) return crossingCache.list;
    crossingCache = { key, list: G.lineCrossings(runsHere()) };
    return crossingCache.list;
  };
  // EVERY YELLOW CORNER: the faces' corners and the crossings.
  const actLikeNodes = () => [...wallFaceNodes(), ...crossingNodes()];
  // THE STRONGER PULL between an orange node and a yellow corner in reach:
  // the nearer wins, the orange on a tie. `{ v, node }`, or null when
  // neither reaches.
  // WITHIN AN EIGHTH OF AN INCH, THAT CORNER (Movie, 24 Oct: "i have a hard
  // time to click on the outside of the 3.5" wall (maybe too close to the
  // other magnetic snapps, can we make it so if you are within 1/8" of a
  // corner like this it will override any stronger snaps ?", and "if a user
  // has problems snapping they can zoom in"). Any corner -- a node, a face
  // corner, a half-inch corner -- the hand is that close to is the one it
  // meant, whatever pulls harder from further off.
  const EIGHTH_FT = 1 / 96;
  const cornerUnderHand = (at, nodes, corners) => {
    if (snapHeldOff) return null;
    let best = null;
    [[nodes, true], [corners, false]].forEach(([list, node]) => (list || []).forEach(v => {
      const d = Math.hypot(v.x - at.x, v.z - at.z);
      if (d <= EIGHTH_FT && (!best || d < best.d)) best = { d, v, node };
    }));
    return best ? { v: best.v, node: best.node } : null;
  };
  const strongerPoint = (at, nodes, corners) => {
    const close = cornerUnderHand(at, nodes, corners);
    if (close) return close;
    const score = (list, px) => {
      const r = reachFt(px);
      let best = null;
      list.forEach(v => {
        const d = Math.hypot(v.x - at.x, v.z - at.z);
        if (d <= r && (!best || d < best.d)) best = { d, v };
      });
      return best;
    };
    // PLAIN NEAREST (Movie, 26 Oct, one snapping rule): each catches from its
    // own reach, and of the two the closer one wins; the node a tie.
    const node = score(nodes, NODE_REACH);
    const corner = score(corners, CORNER_REACH);
    if (node && (!corner || node.d <= corner.d)) return { v: node.v, node: true };
    return corner ? { v: corner.v, node: false } : null;
  };
  const nearestWithin = (list, at, px) => {
    const r = reachFt(px);
    let best = null;
    list.forEach(v => {
      const d = Math.hypot(v.x - at.x, v.z - at.z);
      if (d <= r && (!best || d < best.d)) best = { d, v };
    });
    return best ? best.v : null;
  };
  const faceFoot = (seg, at) => {
    const dx = seg.b.x - seg.a.x, dz = seg.b.z - seg.a.z, len2 = dx * dx + dz * dz;
    if (len2 < 1e-9) return null;
    const t = Math.max(0, Math.min(1, ((at.x - seg.a.x) * dx + (at.z - seg.a.z) * dz) / len2));
    return { x: seg.a.x + t * dx, z: seg.a.z + t * dz };
  };
  const nearestFace = (segs, at, px = LINE_REACH) => {
    const r = reachFt(px);
    let best = null;
    segs.forEach(seg => {
      const p = faceFoot(seg, at);
      if (!p) return;
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d <= r && (!best || d < best.d)) best = { d, pt: p, seg };
    });
    return best;
  };
  // The magnets a point being drawn answers to; null when SNAP is off.
  const drawMagnet = () => (snapLive() && board !== 'toy'
    ? { nodes: nodeEnds({ faces: false }), corners: actLikeNodes(), segs: magnetSegs() } : null);
  // A DRAGGED NODE answers to every wall but its own: the walls it is an end
  // of move with it, so their faces are not where they were. Worked out once
  // when the drag starts.
  const dragMagnet = vtx => {
    const G = window.DraftGeometry2D;
    if (!G?.wallFaceLines || !vtx) return { corners: [], segs: [] };
    const touches = v => v && (v === vtx || (Math.abs(v.x - vtx.x) < 0.001 && Math.abs(v.z - vtx.z) < 0.001));
    const still = walls().filter(w => !touches(w.start) && !touches(w.end));
    const stillOthers = [...lines(), ...loopEdges()].filter(l => !touches(l.start) && !touches(l.end));
    const stillRuns = [...still, ...stillOthers];
    return { nodes: nodeEnds({ faces: false }).filter(v => !touches(v)),
      corners: [...G.wallFaceCorners(still, openingThicknessFt()),
        ...(G.lineCrossings ? G.lineCrossings(stillRuns) : [])],
      segs: [...G.wallFaceLines(still, openingThicknessFt()), ...bodySegs(stillOthers)] };
  };
  // A DRAGGED WALL answers to every wall it is not joined to: its own ends'
  // neighbours travel with it, so their faces are not where they were.
  const bodyMagnet = body => {
    const G = window.DraftGeometry2D;
    if (!G?.wallFaceLines || !body) return { nodes: [], corners: [], segs: [] };
    const ends = [body.start, body.end];
    const touches = v => v && ends.some(e => e === v || (Math.abs(v.x - e.x) < 0.001 && Math.abs(v.z - e.z) < 0.001));
    const still = walls().filter(w => w !== body && !touches(w.start) && !touches(w.end));
    const stillOthers = [...lines(), ...loopEdges()].filter(l => !touches(l.start) && !touches(l.end));
    const stillRuns = [...still, ...stillOthers];
    return { nodes: nodeEnds({ faces: false }).filter(v => !touches(v)),
      corners: [...G.wallFaceCorners(still, openingThicknessFt()),
        ...(G.lineCrossings ? G.lineCrossings(stillRuns) : [])],
      segs: [...G.wallFaceLines(still, openingThicknessFt()), ...bodySegs(stillOthers)] };
  };
  // ── A MOVED SELECTION OR ROOF SEEKS BY EVERY POINT IT CARRIES ────────
  //
  // (Movie, 19 Oct: areas, floors and roofs "act in this way".) The magnet
  // is everything on the level that is not moving, worked out once per
  // drag; each carried point, where the hand would put it, feels the three
  // tiers, and the whole set shifts by the one shortfall that wins -- the
  // corner drag's rule applied to a set, so a floor dragged near a wall's
  // node lands a corner on it and keeps its shape. Moving points are kept
  // out by reference AND by position (a roof's points are rebuilt on every
  // move, so the reference alone would miss them).
  const magnetExcluding = pts => {
    const G = window.DraftGeometry2D;
    if (!G?.wallFaceLines) return { nodes: [], corners: [], segs: [] };
    const moving = new Set(pts);
    const stillPt = v => v && !moving.has(v)
      && !pts.some(p => Math.abs(p.x - v.x) < 0.001 && Math.abs(p.z - v.z) < 0.001);
    const stillRun = r => stillPt(r.start) && stillPt(r.end);
    const stillWalls = walls().filter(stillRun);
    const stillOthers = [...lines(), ...loopEdges()].filter(stillRun);
    return { nodes: nodeEnds({ faces: false }).filter(stillPt),
      corners: [...G.wallFaceCorners(stillWalls, openingThicknessFt()),
        ...(G.lineCrossings ? G.lineCrossings([...stillWalls, ...stillOthers]) : [])],
      segs: [...G.wallFaceLines(stillWalls, openingThicknessFt()), ...bodySegs(stillOthers)] };
  };
  const pointsSeek = (before, dx, dz, magnet) => {
    let best = null;
    const offer = (share, make) => { if (!best || share < best.share) best = { share, make }; };
    before.forEach(b => {
      const at = { x: b.x + dx, z: b.z + dz };
      const point = strongerPoint(at, magnet.nodes, magnet.corners);
      if (point) {
        offer(catchShare(Math.hypot(point.v.x - at.x, point.v.z - at.z), point.node ? NODE_REACH : CORNER_REACH), () => ({
          dx: dx + point.v.x - at.x, dz: dz + point.v.z - at.z,
          lit: { pt: { x: point.v.x, y: 0, z: point.v.z }, corner: point.v, node: point.node } }));
        return;
      }
      const face = nearestFace(magnet.segs, at);
      if (face) {
        offer(catchShare(face.d, LINE_REACH), () => ({
          dx: dx + face.pt.x - at.x, dz: dz + face.pt.z - at.z,
          lit: { pt: { x: face.pt.x, y: 0, z: face.pt.z }, seg: face.seg } }));
      }
    });
    return best ? best.make() : null;
  };
  // ── THE MOVE'S HAND CATCHES TOO, AND LINES UP SQUARE (Movie, 19 Oct) ──
  //
  // "i'd also like the cursor in this version of MOVE when i mouse over
  // corners / lines etc to creat a SNAPpoint (even to when my mouse is
  // perpendicular to the node / my moving edge" -- "to lines corners and
  // NODE". Two catches on top of the carried points' seek above:
  //
  // THE HAND'S OWN. The point the press took hold of lands exactly on the
  // node, corner or face the cursor is over -- the three tiers, by the same
  // share-of-reach rule a drawn point reads. The hand's catch beats a
  // carried point's whenever it has one: he is aiming the cursor, and an
  // assembly that jumped to put some other corner on some other face while
  // the cursor sat on a node would read as a miss.
  //
  // THE SQUARE LINE-UP, with the T-square lit. The move goes along one axis,
  // and a node or corner catches the hand, or any carried point, when its
  // coordinate ON THAT AXIS comes within pull; the other axis is not
  // measured at all, so a corner straight across from a node lines up with
  // it from any distance ("perpendicular to the node"). A face running
  // across the axis catches a point passing within its span. The shortfall
  // is taken along the axis only, so the assembly still goes straight, and
  // a dashed guide from the point to what it lined up with shows why it
  // stopped.
  // ONE SNAPPING RULE (Movie, 26 Oct): each target catches from its own
  // reach, and of everything in reach the nearest wins -- in plan feet, not
  // as a share of the reach -- save that any point (a node, a corner) beats
  // any line. Infinity is out of reach.
  const LINE_LAST = 1e6;
  const catchShare = (d, kind) => (d <= reachFt(kind) + 1e-9 ? d + (kind === LINE_REACH ? LINE_LAST : 0) : Infinity);
  // A point's 2-D catch: `{ land, pt, corner, node, share }` or `{ land, pt,
  // seg, share }`, `land` being where the point goes; null out of reach.
  const pointCatch = (at, magnet) => {
    if (!magnet) return null;
    const point = strongerPoint(at, magnet.nodes || [], magnet.corners || []);
    if (point) {
      const d = Math.hypot(point.v.x - at.x, point.v.z - at.z);
      return { land: { x: point.v.x, z: point.v.z }, pt: { x: point.v.x, y: 0, z: point.v.z },
        corner: point.v, node: point.node, share: catchShare(d, point.node ? NODE_REACH : CORNER_REACH) };
    }
    const face = nearestFace(magnet.segs || [], at);
    return face ? { land: { x: face.pt.x, z: face.pt.z }, pt: { x: face.pt.x, y: 0, z: face.pt.z },
      seg: face.seg, share: catchShare(face.d, LINE_REACH) } : null;
  };
  // The same point's catch measured along `axis` alone: a node first (the
  // orange wins a tie, as strongerPoint has it), then a corner, then a face
  // standing across the axis. `guide` runs from where the point lands to
  // the node or corner it lined up with.
  const axisCatch = (at, axis, magnet) => {
    if (!magnet) return null;
    const other = axis === 'x' ? 'z' : 'x';
    const landed = gap => ({ x: at.x, z: at.z, [axis]: at[axis] + gap });
    let best = null;
    const offer = (gap, px, make) => {
      const share = catchShare(Math.abs(gap), px);
      if (share < Infinity && (!best || share < best.share)) best = { share, gap, make };
    };
    const point = (list, px, node) => list.forEach(v => offer(v[axis] - at[axis], px, gap => ({
      land: landed(gap), pt: { x: v.x, y: 0, z: v.z }, corner: v, node, guide: { from: landed(gap), to: { x: v.x, z: v.z } } })));
    point(magnet.nodes || [], NODE_REACH, true);
    point(magnet.corners || [], CORNER_REACH, false);
    if (!best) {
      const slack = reachFt(NODE_REACH);
      (magnet.segs || []).forEach(seg => {
        if (Math.abs(seg.a[axis] - seg.b[axis]) > 1e-6) return;
        const lo = Math.min(seg.a[other], seg.b[other]) - slack, hi = Math.max(seg.a[other], seg.b[other]) + slack;
        if (at[other] < lo || at[other] > hi) return;
        offer(seg.a[axis] - at[axis], LINE_REACH, gap => ({ land: landed(gap), pt: { ...landed(gap), y: 0 }, seg }));
      });
    }
    return best ? { share: best.share, ...best.make(best.gap) } : null;
  };
  // Where a MOVE's hand and carried points would catch, (dx, dz) from the
  // press: the hand first, else the carried point nearest its target as a
  // share of its reach. `axis` is the one the T-square holds, or null for
  // a free move. `{ dx, dz, lit }`, or null when nothing reaches.
  const moveSeek = (d, dx, dz, axis) => {
    const catchAt = at => (axis ? axisCatch(at, axis, d.magnet) : pointCatch(at, d.magnet));
    const by = (from, hit) => ({ dx: dx + hit.land.x - from.x, dz: dz + hit.land.z - from.z, lit: hit });
    const hand = { x: d.at.x + dx, z: d.at.z + dz };
    const own = catchAt(hand);
    if (own) return by(hand, own);
    let best = null;
    d.set.before.forEach(b => {
      if (b.holo) return;
      const at = { x: b.x + dx, z: b.z + dz };
      const hit = catchAt(at);
      if (hit && (!best || hit.share < best.hit.share)) best = { hit, at };
    });
    return best ? by(best.at, best.hit) : null;
  };
  // ── A MOVED WALL'S FACES SEEK (Movie, 19 Oct) ───────────────────────────
  //
  // "the YELLOW/ GREEN NEON color will be for WALL SURFACES which will also
  // be magnetic for other wall surfaces/ nodes/ and 'act like' nodes". A wall
  // being dragged by its body carries its two faces, and each face feels
  // three pulls across the run: another wall's face it would line up with
  // (neon, 1"), a node it would pass through (orange, 2"), a corner that
  // acts like one (yellow, 1 1/2") -- the three tiers, by the one snapping
  // rule (catchShare). The wall slides ACROSS its run by the shortfall and no further, so
  // the T-square's projection and the hand's travel along the run both stand.
  // A face lines up with a face only where the two run parallel; a point
  // pulls a face only where it stands within the wall's own length (a hair
  // past the ends allowed), because a face line does not reach out past its
  // wall. Targets are worked out once per drag (bodyMagnet) and the moving
  // wall is read where the hand has put it, (dx, dz) from its press.
  //
  // `{ dx, dz, lit }`, lit being `{ seg, own, pt }` on a face or
  // `{ corner, node, own, pt }` on a point; null when nothing reaches.
  // THE TRAVEL'S COMPONENT ALONG THE WALL'S RUN ROUNDED TO THE FOOT, the
  // across component kept: what a caught face leaves to the light.
  const footAlongRun = (body, dx, dz) => {
    const Q = window.DraftToyConstraints;
    if (!Q || !body?.start || !body?.end) return { dx, dz };
    const ux0 = body.end.x - body.start.x, uz0 = body.end.z - body.start.z, len = Math.hypot(ux0, uz0);
    if (len < 1e-6) return { dx, dz };
    const ux = ux0 / len, uz = uz0 / len, nx = -uz, nz = ux;
    const along = Q.quantiseFeet(dx * ux + dz * uz), across = dx * nx + dz * nz;
    return { dx: ux * along + nx * across, dz: uz * along + nz * across };
  };
  const wallFaceSeek = (md, dx, dz) => {
    const body = md.body;
    // FROM WHERE THE DRAG BEGAN, not from the wall's live ends: those are
    // already where the last pointermove put them, and reading them would
    // apply the hand's travel twice.
    const [s0, e0] = md.before || [];
    if (!body || !s0 || !e0) return null;
    const magnet = (md.magnet ||= bodyMagnet(body));
    const ux0 = e0.x - s0.x, uz0 = e0.z - s0.z, len = Math.hypot(ux0, uz0);
    if (len < 1e-6) return null;
    const u = { x: ux0 / len, z: uz0 / len }, n = { x: -u.z, z: u.x };
    const moved = { x: s0.x + dx, z: s0.z + dz };
    const t = openingThicknessFt()(body);
    const { startOff, endOff } = window.DraftGeometry2D.wallFaceOffsets
      ? window.DraftGeometry2D.wallFaceOffsets(body, t)
      : { startOff: -t / 2, endOff: t / 2 };
    const along = pt => (pt.x - moved.x) * u.x + (pt.z - moved.z) * u.z;
    const across = pt => (pt.x - moved.x) * n.x + (pt.z - moved.z) * n.z;
    const slack = reachFt(NODE_REACH);
    let best = null;
    const offer = (gap, px, make) => {
      const share = catchShare(Math.abs(gap), px);
      if (share === Infinity) return;
      if (!best || share < best.share) best = { share, gap, make };
    };
    [startOff, endOff].forEach(o => {
      // THE OWN FACE WHERE THE SLIDE LEAVES IT, lined up with what caught it.
      const ownAt = gap => ({
        a: { x: moved.x + n.x * (o + gap), z: moved.z + n.z * (o + gap) },
        b: { x: moved.x + n.x * (o + gap) + u.x * len, z: moved.z + n.z * (o + gap) + u.z * len } });
      // ANOTHER WALL'S FACE, parallel: the gap is the same all along it.
      magnet.segs.forEach(seg => {
        const sx = seg.b.x - seg.a.x, sz = seg.b.z - seg.a.z, sl = Math.hypot(sx, sz);
        if (sl < 1e-6 || Math.abs(u.x * sz - u.z * sx) / sl > 1e-3) return;
        offer(across(seg.a) - o, LINE_REACH, gap => {
          const own = ownAt(gap);
          return { seg, own, pt: { x: (own.a.x + own.b.x) / 2, y: 0, z: (own.a.z + own.b.z) / 2 } };
        });
      });
      // A NODE OR A CORNER within the wall's length: the face passes through it.
      const point = (list, px, node) => list.forEach(v => {
        const a = along(v);
        if (a < -slack || a > len + slack) return;
        offer(across(v) - o, px, gap => ({ corner: v, node, own: ownAt(gap), pt: { x: v.x, y: 0, z: v.z } }));
      });
      point(magnet.nodes, NODE_REACH, true);
      point(magnet.corners, CORNER_REACH, false);
    });
    if (!best) return null;
    return { dx: dx + n.x * best.gap, dz: dz + n.z * best.gap, lit: best.make(best.gap) };
  };
  // Where a dragged point lands: a node first, then a face corner, then a
  // face line. `{ pt, corner }` or `{ pt, seg }`, or null.
  // WITHIN AN INCH OF A LINE IT CROSSES, A DRAGGED END CONNECTS TO IT (Movie,
  // 22 Oct: "when i stretch or shrink a line, when it crosses a line or wall
  // line int or ext, allow it to connect to that line if the user drops it
  // within an inch"). The end's own run -- one wall or line, free at this
  // end -- is carried on through `pt` to where it meets each still face or
  // line, and the nearest meeting within the inch is where the end goes: on
  // the line, at the run's own angle, which is what keeps the angle he
  // likes locked. A corner two runs share has no one angle, so none.
  const INCH_JOIN_FT = 1 / 12;
  const runsAtVertex = vtx => [...walls(), ...lines()].filter(r => r.start === vtx || r.end === vtx);
  const inchJoin = (vtx, pt, segs) => {
    const owners = runsAtVertex(vtx);
    if (owners.length !== 1 || !segs?.length) return null;
    const run = owners[0];
    const other = run.start === vtx ? run.end : run.start;
    if (!other) return null;
    const dx = pt.x - other.x, dz = pt.z - other.z;
    if (Math.hypot(dx, dz) < 1e-6) return null;
    let best = null;
    segs.forEach(seg => {
      const P = seg.start || seg.a || seg[0], Q = seg.end || seg.b || seg[1];
      if (!P || !Q) return;
      const ex = Q.x - P.x, ez = Q.z - P.z;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) return;
      const s = ((P.x - other.x) * dz - (P.z - other.z) * dx) / den;
      if (s < -1e-6 || s > 1 + 1e-6) return;
      const X = { x: P.x + ex * s, z: P.z + ez * s };
      const d = Math.hypot(X.x - pt.x, X.z - pt.z);
      if (d <= INCH_JOIN_FT && (!best || d < best.d)) best = { d, pt: X, seg };
    });
    return best;
  };
  const dragMagnetAt = (at, vtx, magnet) => {
    const close = magnet ? cornerUnderHand(at, magnet.nodes || [], magnet.corners) : null;
    if (close) return { pt: { x: close.v.x, y: 0, z: close.v.z }, corner: close.v, node: close.node };
    const node = cornerSnap(at, vtx);
    if (node) return { pt: { x: node.x, y: 0, z: node.z }, corner: node, node: true };
    if (!magnet) return null;
    const point = strongerPoint(at, magnet.nodes || [], magnet.corners);
    if (point) return { pt: { x: point.v.x, y: 0, z: point.v.z }, corner: point.v, node: point.node };
    const face = nearestFace(magnet.segs, at);
    return face ? { pt: { x: face.pt.x, y: 0, z: face.pt.z }, seg: face.seg } : null;
  };
  // A wall's or a line's own end, as opposed to a face corner.
  const isOwnNode = v => [...walls(), ...lines()].some(seg => [seg.start, seg.end]
    .some(e => e && Math.abs(e.x - v.x) < 1e-6 && Math.abs(e.z - v.z) < 1e-6))
    || loopCorners().some(e => Math.abs(e.x - v.x) < 1e-6 && Math.abs(e.z - v.z) < 1e-6);
  // Worked out once per drawing change, level and hologram placing, not on
  // every move of the mouse: a plan of twenty suites is a lot of walls.
  let holoSnapCache = { key: null, list: [] };
  const hologramSnapNodes = () => {
    const shown = holograms().filter(holo => !holo.hidden);
    if (!shown.length) return [];
    const key = `${modelEpoch}|${activeLevelId()}|${shown.map(holo => `${holo.id},${holo.x},${holo.z},${holo.angleDeg},${holo.flip === true}`).join(';')}`;
    if (holoSnapCache.key === key) return holoSnapCache.list;
    const list = shown.flatMap(holo => [...hologramSuperNodes(holo).map(n => n.point), ...hologramCorners(holo)])
      .filter(v => v && Number.isFinite(v.x) && Number.isFinite(v.z))
      .map(v => ({ x: v.x, y: 0, z: v.z }));
    holoSnapCache = { key, list };
    return list;
  };
  const nodeEnds = ({ faces = true } = {}) => {
    const out = [];
    [...walls(), ...lines()].forEach(seg => [seg.start, seg.end].forEach(v => {
      if (v && !out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    }));
    // A LOOP'S CORNERS ARE ITS NODES (Movie, 19 Oct).
    loopCorners().forEach(v => {
      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    });
    // AND A FIXTURE'S CORNERS, while a FLOOR or SHAPE is drawn (Movie, 23
    // Oct: "make the corners of tub and sink mini- snap nodes if possible for
    // connecting the flooring").
    fixtureNodes().forEach(v => {
      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    });
    // AND EACH FIXTURE'S HALF-INCH CORNERS, for every tool (Movie, 24 Oct:
    // "the corner where the 2 X 1/2" faint lines meet ... if there is a
    // corner node the use can 'connect' them"): a wall drawn or dragged to
    // one lands on it, and rides the fixture after (fixtureLinks).
    fixtureGapNodes().forEach(v => {
      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    });
    // AND A HOLOGRAM'S CORNERS (Movie, 25 Oct: "i'd like to snap the
    // startpoint of my line to the corner of the hologram (if i go withing the
    // purple ring, and click to set a new node i'd like it to be placed
    // exactly where the node circled by the purple ring"): its coloured
    // corner rings and its walls' own ends, every tool, as nodes.
    hologramSnapNodes().forEach(v => {
      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    });
    // AND THE TRACE IN HAND'S FIRST CORNER, once it can be closed on (Movie,
    // 21 Oct): the last corner finds the first as it finds any node.
    traceHome().forEach(v => {
      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    });
    if (faces) wallFaceNodes().forEach(v => {
      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    });
    // AND THE BG STOREYS' WALL ENDS (Movie, 21 Oct: "i would like the NODES
    // to work in the BG"): nodes like the level's own, so they are asked
    // before the cross lines, not after.
    bgWalls().forEach(w => [w.start, w.end].forEach(v => {
      if (v && !out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    }));
    // AND ON THE SITE, THE REGISTRATION TARGET and the roof drawn over it
    // (Movie, 26 Oct: "the roof plan doesn't seem to have NODE SNAPS working
    // - i really would like the REGISTRATION TARGET to have a node snap so i
    // can position the property site plan properly").
    siteSnapNodes().forEach(v => {
      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);
    });
    return out;
  };
  // ON THE SITE ONLY. There the house is shown by its roof, whose corners
  // live on the ROOF level, so they are the house's nodes, and the gold
  // target is one with them. On a floor plan the target is worked out from
  // the walls -- it is the house's own outside corner, a corner that catches
  // already -- and a wall dragged there would be caught by its own corner.
  const siteSnapNodes = () => {
    if (!drawing || Number(activeLevelId()) !== SITE_SNAP_LEVEL) return [];
    const out = [];
    const target = siteDatumNow();
    if (target && Number.isFinite(target.x) && Number.isFinite(target.z)) out.push({ x: target.x, y: 0, z: target.z });
    (drawing.roofs || []).forEach(r => (r?.points || []).forEach(p => {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) out.push(p);
    }));
    return out;
  };
  // THE FIXTURE CORNERS A FLOOR OR SHAPE CATCHES: the four of each piece's
  // box (a toilet's is no outline to floor to), on this level, only while
  // one of those two tools is up -- a wall drawn past a tub still takes the
  // wall's own nodes and nothing of the tub's.
  const fixtureNodes = () => {
    if (activeTool !== 'floor' && activeTool !== 'shape') return [];
    const FG = window.DraftFixtureGeometry;
    if (!FG?.fixtureGeometry) return [];
    return fixtures().filter(fx => fx.kind !== 'toilet').flatMap(fx => {
      const geo = FG.fixtureGeometry(drawing.walls || [], fx);
      return (geo?.corners || []).map(c => ({ x: c.x, z: c.z }));
    });
  };
  // THE HALF-INCH CORNERS OF EVERY FIXTURE ON THE LEVEL, kept for the frame:
  // nodeEnds is asked on every pointer move, and a fixture's geometry does not
  // change between two paints.
  let gapNodeCache = { frame: -1, nodes: [] };
  const fixtureGapNodes = () => {
    if (gapNodeCache.frame === paintFrame) return gapNodeCache.nodes;
    const FG = window.DraftFixtureGeometry;
    const list = drawing ? fixtures() : [];
    const nodes = FG?.gapCorners
      ? list.flatMap(fx => FG.gapCorners(drawing.walls || [], fx, list).map(c => ({ x: c.x, z: c.z, fixture: fx, end: c.end })))
      : [];
    gapNodeCache = { frame: paintFrame, nodes };
    return nodes;
  };
  // A WALL PUT ON A HALF-INCH CORNER PUTS ITS FACE THERE, not its middle
  // (Movie, 24 Oct, asked which: "Wall's face lines up"): its end moves off
  // the corner by the distance from its drawn line to the face that looks at
  // the fixture, so the fixture keeps exactly its half inch to that face.
  // Twice, because the end moving turns the wall a hair and the face with it.
  const faceSpot = (wall, node, vtx) => {
    const FG = window.DraftFixtureGeometry;
    const geo = FG.fixtureGeometry(drawing.walls || [], node.fixture);
    if (!geo) return null;
    let at = { x: vtx.x, z: vtx.z };
    for (let i = 0; i < 2; i += 1) {
      const trial = { ...wall, start: wall.start === vtx ? at : wall.start, end: wall.end === vtx ? at : wall.end };
      const frame = FG.wallFrame(trial);
      if (!frame) return null;
      const toward = (geo.center.x - node.x) * frame.nx + (geo.center.z - node.z) * frame.nz;
      const off = toward >= 0 ? Math.max(frame.startOff, frame.endOff) : Math.min(frame.startOff, frame.endOff);
      at = { x: node.x - frame.nx * off, z: node.z - frame.nz * off };
    }
    return at;
  };
  // THE WHOLE WALL STEPS ACROSS when its other end is loose -- joined to
  // nothing, on no corner -- so it keeps its line instead of leaning; an
  // other end held by something stays, and the wall turns the hair it must.
  // Returns how far the end moved, or null when it was on no corner.
  const looseEnd = (v, wall) => !!v
    && ![...walls(), ...lines()].some(r => r !== wall && (r.start === v || r.end === v))
    && !fixtureGapNodes().some(n => Math.hypot(n.x - v.x, n.z - v.z) < 1e-6);
  const faceOntoGap = (wall, vtx, { otherFrom = null } = {}) => {
    if (!wall || !vtx || !walls().includes(wall)) return null;
    const node = fixtureGapNodes().find(n => Math.hypot(n.x - vtx.x, n.z - vtx.z) < 1e-6);
    if (!node) return null;
    const other = wall.start === vtx ? wall.end : wall.start;
    const carry = otherFrom || (looseEnd(other, wall) ? { x: other.x, z: other.z } : null);
    const FG = window.DraftFixtureGeometry;
    let at;
    if (carry) {
      // A STRAIGHT STEP ACROSS: the wall's own line, so one pass is exact.
      const geo = FG.fixtureGeometry(drawing.walls || [], node.fixture);
      const frame = geo && FG.wallFrame({ ...wall, start: wall.start === vtx ? node : carry, end: wall.end === vtx ? node : carry });
      if (!frame) return null;
      const toward = (geo.center.x - node.x) * frame.nx + (geo.center.z - node.z) * frame.nz;
      const off = toward >= 0 ? Math.max(frame.startOff, frame.endOff) : Math.min(frame.startOff, frame.endOff);
      at = { x: node.x - frame.nx * off, z: node.z - frame.nz * off };
    } else {
      at = faceSpot(wall, node, vtx);
    }
    if (!at) return null;
    const shift = { x: at.x - node.x, z: at.z - node.z };
    vtx.x = at.x;
    vtx.z = at.z;
    relinkVertex(vtx);
    if (carry) {
      other.x = carry.x + shift.x;
      other.z = carry.z + shift.z;
      relinkVertex(other);
    }
    return shift;
  };
  // THE WALL ENDS STANDING WITH THEIR FACE ON A FIXTURE'S HALF-INCH CORNER:
  // connected to it, so a slide of the fixture takes them along. Dragged off,
  // they let go -- being there is the whole of the connection.
  const LINK_TOL_FT = 0.01;
  const GAP_NODE_PX = 4;
  const fixtureLinks = fixture => {
    const FG = window.DraftFixtureGeometry;
    if (!FG?.gapCorners) return [];
    const corners = FG.gapCorners(drawing.walls || [], fixture, fixtures())
      .map(c => ({ ...c, fixture }));
    const host = hostWallOf(fixture);
    const seen = new Set();
    const out = [];
    walls().forEach(wall => {
      if (wall === host) return;
      [wall.start, wall.end].forEach(v => {
        if (!v || seen.has(v)) return;
        const c = corners.find(p => {
          if (Math.hypot(p.x - v.x, p.z - v.z) < LINK_TOL_FT) return true;
          const spot = faceSpot(wall, p, v);
          return !!spot && Math.hypot(spot.x - v.x, spot.z - v.z) < LINK_TOL_FT;
        });
        if (!c) return;
        seen.add(v);
        out.push({ vtx: v, x: v.x, z: v.z, offX: v.offX, offZ: v.offZ, end: c.end, cx: c.x, cz: c.z });
      });
    });
    return out;
  };
  const hostWallOf = fixture => walls().find(w => w.id === fixture.wallId) || null;
  // THE CONNECTED WALL ENDS GO WHERE THEIR CORNERS WENT, each keeping how it
  // stood off the corner at its own end of the piece.
  const carryFixtureLinks = md => {
    if (!md.links?.length) return;
    const FG = window.DraftFixtureGeometry;
    const corners = FG.gapCorners(drawing.walls || [], md.fixture, fixtures());
    md.links.forEach(l => {
      const c = corners.find(p => p.end === l.end);
      if (!c) return;
      l.vtx.x = c.x + (l.x - l.cx);
      l.vtx.z = c.z + (l.z - l.cz);
      relinkVertex(l.vtx);
    });
  };
  // A WALL'S OWN NODE WINS: its face corners stand an inch or two off it,
  // and a press meant for the node it always took must still land there. The
  // face corners take a press only where no node is in reach.
  const snapNodeAt = at => {
    if (!at) return null;
    // THE EXACT CATCH TAKES THE SAME CEILING: six pixels at six a foot is a
    // foot, and a garage front drawn a foot off the house's corner (his MOD
    // BILEVEL) was taken for a press on it.
    const r = reachFt(NODE_REACH);
    const nearest = list => {
      let best = null;
      list.forEach(v => {
        const d = Math.hypot(v.x - at.x, v.z - at.z);
        if (d <= r && (!best || d < best.d)) best = { d, v };
      });
      return best ? best.v : null;
    };
    const nodes = nodeEnds({ faces: false }), corners = actLikeNodes();
    return cornerUnderHand(at, nodes, corners)?.v || nearest(nodes)
      || strongerPoint(at, nodes, corners)?.v || null;
  };
  let lastSnapKey = '';
  let moveHoverAt = null;   // where the MOVE hover last painted
  // NOTHING AROUND, as Movie put it ("only when nothing is around"): no
  // wall, line, floor or footprint here, no loop in hand, and no traced
  // outline anywhere -- the house he traced is around while its garage is
  // drawn, and the bullseye pulled the garage's first corner a foot on to it.
  const levelIsEmpty = () => !walls().length && !lines().length && !outlineCorners.length
    && !floors().length && !outlines().length && !(drawing?.boneyardOutlines || []).length;
  const drawSnap = at => {
    if (!at) return {};
    if (snapLive()) {
      const node = snapNodeAt(at);
      if (node) return { pt: { x: node.x, y: 0, z: node.z }, node };
      if (board !== 'toy') {
        const face = nearestFace(magnetSegs(), at);
        if (face) return { pt: { x: face.pt.x, y: 0, z: face.pt.z }, face: face.seg };
      }
      if (!drawStart && levelIsEmpty()) {
        const b = gridDatum();
        if (b && Math.hypot(b.x - at.x, b.z - at.z) <= BULLSEYE_PULL_FT) return { pt: { x: b.x, y: 0, z: b.z }, bullseye: true };
      }
    }
    return trackSnap(at) || {};
  };
  // THE CROSS LINES' CATCH, on its own so a dragged loop corner can take it
  // without the node catch that would find the corner itself. `skip` is the
  // point in hand: its own rays are no guide to where it should go.
  const trackSnap = (at, skip = [], nodes = null) => {
    if (!trackOn) return null;
    const reach = reachFt('track');
    const skipped = n => skip.some(s => Math.abs(s.x - n.x) < 1e-6 && Math.abs(s.z - n.z) < 1e-6);
    let bx = null, bz = null;
    (nodes || [...trackingNodes(), ...nodeEnds()]).forEach(n => {
      if (skipped(n)) return;
      const dx = Math.abs(at.x - n.x), dz = Math.abs(at.z - n.z);
      if (dx <= reach && dz > reach && (!bx || dx < bx.d)) bx = { d: dx, n };
      if (dz <= reach && dx > reach && (!bz || dz < bz.d)) bz = { d: dz, n };
    });
    if (!bx && !bz) return null;
    return { pt: { x: bx ? bx.n.x : at.x, y: 0, z: bz ? bz.n.z : at.z },
      rays: [bx && { n: bx.n, axis: 'x' }, bz && { n: bz.n, axis: 'z' }].filter(Boolean) };
  };

  // A SNAP THAT ONLY SLIDES ALONG THE AXIS. When a run is being held square,
  // one coordinate is fixed by the square and the other is free; a corner off
  // the fixed one is not reachable without breaking the square, and the square
  // wins.
  //
  // THE SNAP CONTRIBUTES ITS ALONG-AXIS COORDINATE AND NOTHING ELSE. The
  // squared coordinate is kept exactly, so the run cannot come off square by
  // any amount at all, and the free coordinate comes from the corner, so the
  // endpoint still lines up with it.
  //
  // FILTERING CANDIDATES BY "ON THE AXIS" WAS THE FIRST ATTEMPT AND IT WAS
  // WRONG, in a way only measuring showed. The axis is `drawStart`'s fixed
  // coordinate, and when a run starts in empty space that value came from the
  // cursor -- 5.9987, not 6 -- so no model corner is ever exactly on it and
  // the snap silently never fired. Which reads as "square", because it is
  // square: a lock too tight and a lock working look the same from the wall
  // alone. That is why the probe checks both halves.
  //
  // Projecting needs no tolerance and cannot drift: whatever the corner's
  // fixed coordinate is, it is discarded.
  //
  // `moving` IS THE VERTEX BEING DRAGGED, and it is not optional for a drag
  // even though it is empty for a run being drawn. snapCandidates excludes a
  // moving corner by reference and by coincident position, so without it a
  // dragged point is its own nearest candidate and the square's free
  // coordinate snaps straight back to where the drag started -- a point that
  // refuses to move, which reads as a lock rather than a snap.
  //
  // AND THE MAGNET, SQUARED: a face corner lends its free coordinate the way
  // a node does, and failing that the point stops where the squared run
  // crosses a wall's face -- a run held square meets the face it is drawn to.
  const axisMagnet = (worldPt, fixed, moving = [], magnet = null) => {
    const node = cornerSnap(worldPt, moving);
    const point = node ? { v: node, node: true }
      : (magnet && strongerPoint(worldPt, magnet.nodes || [], magnet.corners));
    const corner = point?.v;
    if (corner) {
      return { pt: fixed === 'z' ? { x: corner.x, y: 0, z: worldPt.z } : { x: worldPt.x, y: 0, z: corner.z },
        corner, node: !!point.node };
    }
    if (!magnet) return null;
    const free = fixed === 'z' ? 'x' : 'z';
    const r = reachFt(LINE_REACH);
    let best = null;
    magnet.segs.forEach(seg => {
      const d0 = seg.a[fixed] - worldPt[fixed], d1 = seg.b[fixed] - worldPt[fixed];
      if (d0 * d1 > 0 || Math.abs(d1 - d0) < 1e-9) return;
      const at = seg.a[free] + (seg.b[free] - seg.a[free]) * (d0 / (d0 - d1));
      const d = Math.abs(at - worldPt[free]);
      if (d <= r && (!best || d < best.d)) best = { d, at, seg };
    });
    if (!best) return null;
    return { pt: fixed === 'z' ? { x: best.at, y: 0, z: worldPt.z } : { x: worldPt.x, y: 0, z: best.at },
      seg: best.seg };
  };
  // WHAT IS CIRCLED IS WHAT IS CONNECTED TO (Movie, 27 Oct: "can we make it
  // so if something is scolled over and is CIRCLED --- THAT is what will be
  // connected too"). A node or a corner in reach of the HAND beats the
  // square: the point goes exactly on it and the ring is drawn on it. Before
  // this the square slid along to the node's free coordinate only, and the
  // ring -- a few pixels across -- sat over the node while the press landed
  // beside it, 7/16" off in his outline. Null when nothing is in reach.
  const handPoint = (hand, magnet = null) => {
    if (!hand || board === 'toy') return null;
    const node = cornerSnap(hand, []);
    const point = node ? { v: node, node: true }
      : (magnet && strongerPoint(hand, magnet.nodes || [], magnet.corners));
    return point ? { pt: { x: point.v.x, y: 0, z: point.v.z }, corner: point.v, node: !!point.node } : null;
  };
  const axisSnap = (worldPt, fixed, moving = [], magnet = null) =>
    axisMagnet(worldPt, fixed, moving, magnet)?.pt || null;

  // ── move a whole wall ─────────────────────────────────────────────────────
  // BOTH ENDS BY THE SAME DELTA. Their corners are pooled, so the neighbouring
  // walls that meet them travel too and the outline deforms around the moved
  // wall — the ruling, and the conservative one: a wall that detached from its
  // corners instead would be silently unhooked from the pool, the same failure
  // shape as a dropped srcId and just as invisible until much later. A true
  // detach, if it is ever wanted, is a deliberate gesture with its own name.
  //
  // THE OLD PAGE HAS NO SUCH GESTURE — its SELECT drag grabs a vertex
  // (_findVertexHit, MODEL.dc.html:10512) and a press on a wall body away from
  // a corner moves nothing. So this is the first behaviour on this page with
  // nothing to copy, and the one thing that IS copied is the precedence: the
  // old page tests for a vertex before it tests for a line
  // (MODEL.dc.html:16791 then :16799), and so does pointerdown below.
  //
  // A CONSEQUENCE OF THAT ORDER, stated rather than discovered later: the
  // corner zone is 30px and the body zone is 12, so on a wall shorter than
  // about 60px on screen the two corner zones meet and there is no body left
  // to grab. Zoom in and it appears. That is the old page's own precedence
  // producing it, not a rule added here.
  // A LINE'S BODY DRAGS TOO, and it is the other half of the gesture the LINE
  // panel has promised since it was written. #20 gave a selected line's ENDS
  // to cornerAt by asking selectedSegment() instead of selectedWall(); its
  // BODY was left on the wall-only question, so a press in the middle of a
  // selected line slid the sheet while a press on either end moved the point.
  // One record, two grabs, two answers -- and the drafter reads the one that
  // does nothing as the line being stuck.
  //
  // IT NEEDED NOTHING ELSE, for #20's own reasons: a line's ends are POOLED
  // VERTICES like a wall's, movingEnds reads the two points any segment has,
  // the 'move' undo step restores points whatever record holds them, and
  // splitRunCorners leaves early on anything but a TOY wall. What the two
  // callers below needed was to stop assuming the answer is a wall.
  const segmentBodyAt = worldPt => {
    // A FIXED ASSEMBLY HELD WHOLE (a click on any piece of it picks it all)
    // is grabbed by any of its walls: the rigid drag below takes it from
    // there, as it did when one wall of it was all a click picked.
    const fixedWall = () => selection.find(entry => entry.type === 'wall' && entry.item?.start && entry.item?.end
      && groupOf(entry)?.fixed === true
      && window.DraftGeometry2D.pointToSegment(worldPt, entry.item).d < SELECT_GRAB_PX / view.scale)?.item || null;
    const selectedSeg = selectedSegment() || fixedWall();
    if (!selectedSeg || !selectedSeg.start || !selectedSeg.end) return null;
    // AND THE TYPE FILTER GOVERNS THE GRAB, not just the pick. "WALL is
    // engaged: nothing else responds" is the whole rule, and a press that
    // takes hold of something is the plainest kind of responding.
    //
    // IT ONLY BECAME REACHABLE WHEN THE GRAB LEARNED ABOUT LINES. While this
    // answered for walls alone, a selection the filter forbids could not also
    // be the thing it offered -- a line selected under ALL, WALL engaged
    // after, and the grab had nothing to say about it. Now it does, and
    // without this the press takes the gesture: the click that should have
    // been refused leaves the line selected instead, which is what
    // model-tool-select caught.
    if (!filterAllows(walls().includes(selectedSeg) ? 'wall' : 'line')) return null;
    const { d } = window.DraftGeometry2D.pointToSegment(worldPt, selectedSeg);
    return d < SELECT_GRAB_PX / view.scale ? selectedSeg : null;
  };

  // The two vertex objects a wall drag moves. NOT deduped, and it took a
  // mutation to settle that. A wall whose ends were one pooled corner would
  // travel twice the cursor's distance, so a dedupe looks obviously necessary
  // — but nothing can reach it: segmentCore drops any wall shorter than 1e-6
  // before it arrives (drawing-format.js), the pool merges corners closer than
  // 0.001, and everything in between is sub-pixel, with its two corners on top
  // of each other. Every press on such a wall is inside the 30px corner zone,
  // so the body grab below never runs on one. The dedupe that was here could
  // not be made to fail, which is the same thing as not being a guard.
  const movingEnds = wall => [wall.start, wall.end];

  // A wall drag snaps by its ENDS, not its body: offer each moving end the
  // corner nearest to where the raw delta would put it, take the closer of the
  // two, and shift the whole delta so that end lands exactly. The wall still
  // moves rigidly — the correction applies to both ends — which is the corner
  // drag's snap generalised rather than a second rule.
  const wallSnapDelta = (before, dx, dz) => {
    const G = window.DraftGeometry2D;
    const moving = before.map(b => b.vtx);
    const candidates = snapCandidates(moving);
    const r = reachFt(NODE_REACH);
    let best = null, bestD = Infinity;
    before.forEach(b => {
      const at = { x: b.x + dx, z: b.z + dz };
      const hit = G.nearestVertex(candidates, at, r);
      if (!hit) return;
      const d = Math.hypot(hit.x - at.x, hit.z - at.z);
      if (d < bestD) { bestD = d; best = { dx: hit.x - b.x, dz: hit.z - b.z }; }
    });
    return best;
  };

  // ONE ENTRY PER GESTURE, and an entry KNOWS WHAT IT UNDOES.
  //
  // TIER 3c GENERALISED THIS, and it had to. Until 3c an entry was a bare list
  // of vertices with the numbers they started with, and undo wrote those
  // numbers back — which can only restore the POSITION of an object that still
  // exists. A created wall has no position to go back to and a deleted one has
  // no vertex left to write on, so create and delete were unrepresentable, not
  // merely unimplemented.
  //
  // Three kinds now, and the old one is unchanged in behaviour:
  //   { kind: 'move',   before }              the corner / wall drag, as before
  //   { kind: 'add',    wall }                undo removes it again
  //   { kind: 'remove', wall, index, deps }   undo puts it and its dependents back
  //   { kind: 'remove-item', list, index, item }  the same for a non-wall
  //   { kind: 'edge-tag', roof, index, was }  a roof edge's EAVE / GABLE flip
  //
  // The pool is still what keeps 'move' small — restoring those objects'
  // numbers puts back every wall that travelled with them. 'add' and 'remove'
  // carry the wall RECORD, whose endpoints are the pooled objects themselves,
  // so a re-added wall rejoins its corners by identity rather than by
  // coordinate — which is the same reason the loader pools at all.
  const undoStack = [];

  // ── TIER 3c: drawing a wall, and deleting one ─────────────────────────────
  // THE FIRST RUNG THAT CREATES AND DESTROYS. Everything before it moved
  // geometry that already existed; the whole write surface was a move-drag
  // commit and an undo. So the rule here is not "make it work" but "make it
  // indistinguishable from the old page's own writer", because the file has to
  // keep opening there.
  //
  // MODEL.dc.html:14609 `_commitWall` is the single authority — the two chain
  // committers (:11297, :21833) both funnel through it — and every field below
  // is derived the way that function derives it. DERIVER on the left of the
  // arrow, STORER on the right:
  //
  //   id          _newDrawingItemId('wall')  ->  `wall-${n}`, counter persisted
  //                                              as nextDrawingItemId (:3559)
  //   start/end   _mergeVertex(pt, levelId, homeView)  ->  the POOLED object
  //   levelId     the active level's ID, never its index
  //   view        _wallHomeView  ->  'foundation' on that set, else 'plan'
  //   wallType    _contextWallType()  ->  validated against WALL_TYPES
  //   baseHeight  state.wallBaseHeight  ->  number, 0
  //   topHeight   state.wallTopHeight   ->  number, 8
  //   refLine     state.wallRefLine     ->  'centre' folds to 'center'; 'left'
  //   body/auto   NOT SET by _commitWall — conditional keys, never invented
  //
  // `auto: true` in particular would tell the old page's delete path this is
  // generated geometry (:22218). A hand-drawn wall must not carry it.

  // THE THREE WALL SETTINGS ARE PERSISTED, so they are read off the drawing
  // rather than hardcoded here: MODEL.dc.html:3517-3519 writes wallRefLine,
  // wallBaseHeight and wallTopHeight into every save. Reading them back is how
  // a wall drawn on this page inherits the same settings the drafter last used
  // on the old one, instead of this page having a private opinion. The
  // fallbacks are the old page's own initial values (:2911-2913).
  const wallSetting = (key, fallback) =>
    (drawing && drawing[key] !== undefined && drawing[key] !== null) ? drawing[key] : fallback;

  // MODEL.dc.html:9010 `_contextWallTypes` and :9016 `_contextWallType`,
  // ported -- and then OPENED UP (Movie, 20 Oct: "i need ALL the walltypes
  // on ALL floors (the 2x4 and 2x6 in the foundation and the ICF walls 11.25
  // 6\"core and 13.25: 8\" core and the regular 8\" conc. just put ALL walls
  // available for all floors"). The old page kept the foundation assemblies
  // and the framed ones apart; a suite drawn in 2x6 on MAIN FL has to meet
  // an ICF shell of the same type to click onto it, and a walk-out
  // basement's framed wall is a basement wall. So every context offers the
  // whole table, ITS OWN KIND FIRST: the foundation leads with concrete and
  // ICF, a floor with the studs. Only the DEFAULT still follows the context
  // (contextWallType): a wall drawn with nothing picked is still 8" concrete
  // in the foundation and 2x6 on a floor.
  const contextWallTypes = viewId => {
    const WT = window.DraftWallTypes;
    if (viewId == null) return WT.WALL_TYPES;
    const isFdn = id => WT.FOUNDATION_WALL_TYPE_IDS.includes(id);
    const own = WT.WALL_TYPES.filter(t => isFdn(t.id) === (viewId === 'foundation'));
    const rest = WT.WALL_TYPES.filter(t => !own.includes(t));
    return [...own, ...rest];
  };
  const contextWallType = viewId => {
    // THE DEFAULT IS THE CONTEXT'S OWN KIND, as it always was: the list a
    // selected wall's TYPE row offers is everything, but a wall DRAWN with
    // the stored default is still 8" concrete in the foundation and 2x6 on a
    // floor -- a 2x6 left active on a floor must not pour the foundation
    // in studs. The other kind is reached by picking it: on a selected wall
    // (contextWallTypes), or on the WALL panel for ICF on a floor (below).
    const WT = window.DraftWallTypes;
    const isFdn = id => WT.FOUNDATION_WALL_TYPE_IDS.includes(id);
    const choices = contextWallTypes(viewId)
      .filter(t => viewId == null || isFdn(t.id) === (viewId === 'foundation'));
    const active = wallSetting('activeWallType', null);
    if (choices.some(t => t.id === active)) return active;
    // ICF AND CONCRETE PICKED ON THE WALL PANEL ARE DRAWN ON A FLOOR TOO:
    // they stand above grade as well. A stud wall is still never the
    // foundation's -- there the foundation set is the only answer.
    if (viewId !== 'foundation' && WALL_PANEL_TYPES.some(([id]) => id === active)) return active;
    const want = viewId === 'foundation' ? 'concrete_8' : 'stud_2x6';
    return (choices.find(t => t.id === want) || choices[0]).id;
  };

  // MODEL.dc.html:14614 `_wallHomeView`. A wall drawn on any set other than
  // FOUNDATION lives in PLAN — pooling it under the ACTIVE view instead would
  // let a foundation wall and a plan wall at the same coordinates share a
  // corner they do not share on the old page.
  const wallHomeView = viewId => (viewId === 'foundation' ? 'foundation' : 'plan');

  // MODEL.dc.html:3224 `_newDrawingItemId`, and :5982 is why the counter must
  // be BUMPED rather than left to heal itself. The old page's load takes
  // Math.max(saved, highestSuffix + 1, 1) — a maximum, never a lowering. Draw
  // wall-7, delete it, save without bumping: nothing survives carrying 7, the
  // max does not rise, and the NEXT wall drawn anywhere is wall-7 again. The
  // cascade below stops a door reattaching that way, but groups and level
  // locks reference members by id too and this page passes both through
  // untouched — so a stale group would adopt a brand-new wall nobody put in it.
  const newDrawingItemId = kind => {
    const next = Number.isInteger(drawing.nextDrawingItemId) ? drawing.nextDrawingItemId : 1;
    drawing.nextDrawingItemId = next + 1;
    return `${kind}-${next}`;
  };

  // The pool key is THREE VALUES plus coordinates — (levelId, viewId, body) —
  // and mergeVertex is the same shared function the loader pools with, so a
  // new endpoint landing on an existing corner returns THAT OBJECT. Anything
  // else and mitring silently reverts to butt joints: no error, capped ends.
  const poolVertex = (pt, levelId, viewId) =>
    window.DraftGeometry2D.mergeVertex(vertexPool, pt, levelId, viewId, 'house');

  // A corner is retired only when NOTHING still holds it. Identity, not
  // coordinates: two corners at the same place are still two corners if the
  // pool never merged them.
  // Returns WHAT IT RETIRED, because undo has to put exactly those back — see
  // the 'remove' branch. A retire that reports nothing forces undo to guess.
  const retirePoolCorners = corners => {
    const retired = [];
    corners.forEach(corner => {
      // LINES HOLD POOLED CORNERS TOO (commitDrawn pools a line's ends), so a
      // corner only a line still stands on is not free to go.
      const held = drawing.walls.some(w => w.start === corner || w.end === corner)
        || (drawing.lines || []).some(l => l.start === corner || l.end === corner);
      if (held) return;
      const at = vertexPool.indexOf(corner);
      if (at >= 0) { vertexPool.splice(at, 1); retired.push(corner); }
    });
    return retired;
  };

  // `bone: false` for a run that brings its own outline. The autobuilt
  // garage writes a garage-flagged loop of its own, and letting the TOY
  // bone grow a second one off the same four walls would leave the level
  // holding two footprints for one building -- one of them saying nothing
  // about being a garage, which is the record building-bodies.js counts.
  // refLine IS AN ARGUMENT NOW, and it is `undefined` everywhere but the house
  // build. A drawn wall takes the drafter's setting, which is what he set it
  // for; a wall raised FROM AN OUTLINE takes the side the outline's own
  // winding dictates (build-house.js's outlineInteriorRef), because the
  // traced line is the exterior face and the body has to land inside it. A
  // freehand loop is wound whichever way the drafter walked it, so reading
  // the setting there would put the walls outside the house on every
  // clockwise trace -- and the drawing would look almost right.
  // WHERE A COMMITTED WALL GOES, and until now that was always "wherever the
  // drafter is standing". That is right for a DRAWN wall and wrong for a BUILT
  // one: a building is raised across the whole stack -- storey walls on each
  // floor level, concrete on FOUNDATION -- and MODEL.dc.html's _buildHouse
  // says so by calling _buildHouseWalls once per level with the level and the
  // view as arguments (:14640, :14646).
  //
  // raiseLoop ALREADY TOOK A levelId and put it on the outline, then let the
  // walls take the active one instead. The two agreed only because its one
  // caller passed the active level in -- a split waiting for the first caller
  // that did not, which is this rung.
  // ── WHAT A WALL WILL LOOK LIKE, ASKED ONCE ───────────────────────────────
  //
  // The two properties that decide an assembly's WIDTH and which SIDE of the
  // drawn line it fills. Split out of commitWall for the rubber band, which
  // has to paint the wall the next press will build -- same type, same side --
  // and the only way to keep that true is for the resolution to be ONE
  // function. Two that agree today is the shape of every drift in this file:
  // the ghost would keep filling left after the drafter set the default to
  // centre, and the wall would land half an assembly off the line he aimed at.
  //
  // 'center', not 'centre', and the fold lives here rather than at the commit
  // for the reason the note below already gives -- a record written with the
  // British spelling reaches the file unvalidated. Now the PREVIEW reads the
  // folded value too, so a stored 'centre' cannot draw a ghost on one side of
  // the line and a wall on the other.
  const wallShape = ({ refLine, view: onView, wallType } = {}) => {
    const viewId = onView ?? onActiveLevel().viewId;
    return {
      wallType: wallType || contextWallType(viewId),
      // CENTERLINE BY DEFAULT (Movie, 16 Oct: "allow the user to select the
      // 'LEFT SIDE' CENTERLINE or 'RIGHT SIDE' for placement of the actual
      // wall, based on where the LINE is positioned" -- CENTERLINE the
      // default, the pick sticky between walls). 'left' was the old page's
      // default and stayed here unread until the WALL panel gave the choice a
      // control; the house's own exterior walls name their reference line
      // themselves (outlineInteriorRef) and are not touched by this.
      refLine: (raw => (raw === 'centre' ? 'center' : raw))(
        refLine || wallSetting('wallRefLine', 'center')),
    };
  };

  // A SUITE'S WALLS ARE DRAWN AT A STAND-IN HEIGHT on the boneyard (Movie,
  // 20 Oct: "the HEIGHTS won't really need to be determined until it is
  // place onto a plan"). 8'-0" for a residential suite and 10'-0" for a
  // commercial one, so the plan, the cuts and the 3D read sensibly while it
  // is drawn; placed on a floor, it takes that floor's floor-to-ceiling
  // height and this number is not used. Null off the boneyard or in any
  // other drawing.
  const SUITE_STAND_IN_FT = { residential: 8, commercial: 10 };
  const suiteStandIn = levelId => (drawing?.suiteKind && Number(levelId) < 0
    ? SUITE_STAND_IN_FT[drawing.suiteKind] ?? null : null);
  const commitWall = (startPt, endPt,
    { bone = true, refLine, levelId: onLevel, view: onView, wallType,
      baseHeight, topHeight, body } = {}) => {
    const active = onActiveLevel();
    const levelId = onLevel ?? active.levelId;
    const viewId = onView ?? active.viewId;
    const homeView = wallHomeView(viewId);
    const shape = wallShape({ refLine, view: viewId, wallType });
    const wall = {
      id: newDrawingItemId('wall'),
      start: poolVertex(startPt, levelId, homeView),
      end: poolVertex(endPt, levelId, homeView),
      levelId,
      view: homeView,
      wallType: shape.wallType,
      // A BUILT WALL KNOWS ITS OWN HEIGHTS. The drafter's stored defaults are
      // right for a wall he DRAWS and meaningless for a grade beam, which is
      // a band of concrete hanging off grade -- its base and top are derived
      // from the foundation datum, not from a setting.
      baseHeight: baseHeight ?? wallSetting('wallBaseHeight', 0),
      topHeight: topHeight ?? suiteStandIn(levelId) ?? wallSetting('wallTopHeight', 8),
      // 'center', not 'centre'. drawing-format.js:400 folds the British
      // spelling on LOAD, but this page has no serializer — a record written
      // with 'centre' reaches the file unvalidated and only the next load
      // repairs it, moving the wall half an assembly thickness in between.
      // The fold now lives in wallShape above, where the PREVIEW reads it too.
      refLine: shape.refLine,
    };
    // WHOSE WALL IT IS. building-bodies.js and the section painters tell a
    // garage's concrete from the house's by `body`, and a grade beam filed as
    // house concrete is drawn at the house's own height.
    if (body) wall.body = body;
    drawing.walls.push(wall);
    // AN END PUT ON A FIXTURE'S HALF-INCH CORNER: its face goes there.
    if (board !== 'toy') { faceOntoGap(wall, wall.start); faceOntoGap(wall, wall.end); }
    undoStack.push({ kind: 'add', wall });
    if (bone) extendToyBone(startPt, endPt, levelId);
    markDirty();
    return wall;
  };

  // ── §2: THE GESTURE MAKES THE BONE, NOT ONLY THE WALLS ───────────────────
  //
  // Movie, 13 Sep: "yes the toy house will have the bones and those will be
  // what TOY can manipulate". Before this, commitWall pushed to drawing.walls
  // and touched nothing else, and the only place this page made a level
  // outline was adding a level (:2919) -- so a hand-drawn TOY house had no
  // bone, and §2's "the outline becomes a bone" had nothing to become one.
  //
  // TOY ONLY. Writing the outline on every board would change what every
  // DRAFTING drawing contains, which is a much larger claim than this order
  // makes and is what the DRAFTING half of acceptance 2b guards.
  //
  // masterId NULL, which is the format's "purely local outline"
  // (drawing-format.js:893). A hand-drawn house came from no master, so this
  // record IS the bone rather than a copy of one -- and that is exactly the
  // shape §2 says not to invent a second store for.
  //
  // THE ID IS A STRING HERE AND THAT IS CORRECT, in deliberate contrast to a
  // column's. drawing-format.js reads an outline id with String() (:921) and a
  // column's with Number() (:512). Same page, same allocator, opposite
  // requirements -- so newDrawingItemId is right for this one and wrong for
  // that one, and neither is a house style.
  // A SECOND RUN AWAY FROM THE HOUSE IS A SECOND BONE. Ruled 13 Sep, against
  // the alternative of one bone per level: a detached garage is a separate
  // footprint by definition, so one level can carry two bones and each is
  // grabbed on its own. The first version of this joined every run on a level
  // into one outline, which drew a polygon running from the house across the
  // yard to the garage -- a shape nobody drew, and one §4's break-the-bone
  // would have had to pretend was a loop.
  //
  // WHICH BONE A RUN BELONGS TO IS DECIDED BY ITS FIRST POINT: a run that
  // starts where a bone ended continues it, and a run that starts anywhere
  // else opens a new one. That is the same fact the chain already uses -- the
  // next wall starts where the last ended -- rather than a second rule.
  let pendingBone = null;
  const sameSpot = (a, b) => !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) < 1e-6;
  const endsAt = (bone, at) => sameSpot(bone?.points?.[bone.points.length - 1], at);
  const toyBoneFor = (levelId, from) => (drawing.outlines || [])
    .find(o => Number(o.levelId) === Number(levelId) && !o.masterId
      && endsAt(o, from)) || null;

  const extendToyBone = (from, to, levelId) => {
    if (board !== 'toy') return;
    const same = sameSpot;
    const pt = p => ({ x: p.x, y: 0, z: p.z });
    let bone = toyBoneFor(levelId, from);
    if (!bone && pendingBone
        && Number(pendingBone.levelId) === Number(levelId)
        && endsAt(pendingBone, from)) {
      bone = pendingBone;
    }
    if (!bone) {
      // NOT PUSHED YET. The format refuses an outline under three points
      // (:918), so a one- or two-point record written into the file is a
      // record the reader throws away -- the silent, one-reload-later loss
      // this page has now been bitten by twice. It is held here until it is
      // a shape the reader will keep.
      // ONE PENDING BONE AT A TIME, and it is never overwritten: drawPress
      // refuses a disconnected run while one is unfinished, so reaching here
      // with a pending bone that does not end at `from` is not a state the
      // gesture can produce.
      // NO ID YET. The counter is PERSISTED, so taking a number here spends it
      // on a record that may never exist: a one-wall run is not a bone (the
      // format refuses an outline under three points), and every abandoned run
      // would leave a permanent gap between the counter and the file's
      // contents. model-html-draw-delete.spec.js:169 reads the counter after
      // one drawn wall and is the check that says so -- 9 where 8 was the
      // wall's own successor.
      //
      // The id is taken at the push below, where the bone becomes a thing the
      // reader will keep. Nothing reads pendingBone.id before then.
      pendingBone = { id: null, masterId: null,
        levelId, points: [pt(from)], overriddenSrcIds: [] };
      bone = pendingBone;
    }
    // NO DEDUPE HERE, AND THE GATE IS WHY. This read
    //   `if (!same(last, to)) bone.points.push(pt(to))`
    // to stop a shared corner being stored twice -- and the mutant that
    // removes the guard survived every check, including one asserting the
    // exact corner list. It survived because the guard CANNOT FIRE: `to`
    // equals the bone's last point only if a wall ends where it starts, and
    // drawPress refuses that before commitWall is reached, treating the second
    // press as a correction. The shared corner is already one point because a
    // chained wall's start IS the previous end.
    //
    // So the line was unreachable, and a guard nothing can exercise is a
    // claim about a case that does not exist. Removed rather than left
    // sitting under a permanent survivor.
    bone.points.push(pt(to));
    if (bone === pendingBone && bone.points.length >= 3) {
      drawing.outlines = drawing.outlines || [];
      bone.id = newDrawingItemId('outline');   // spent only now that it lands
      drawing.outlines.push(bone);
      pendingBone = null;
    }
  };

  // ── THE ORDERED GARAGE BUILDS ITSELF ─────────────────────────────────────
  //
  // Movie, 15 Sep: "now i need the garage to be AUTOBUILT ... it should
  // make a rectangle outline of that size and then build it with the
  // project data". This is the FIRST listener on the order seam: until now
  // a press recorded what was wanted and drew nothing.
  //
  // THE OUTLINE IS THE ORDER AND THE WALLS FOLLOW IT, in that sequence,
  // because the loop is what says "this is a detached garage of this size"
  // -- four walls alone are a shape the file cannot tell from a shed. The
  // walls are committed through the same commitWall the drafter's own
  // trace uses, so the garage carries the project's wall type, heights and
  // reference line rather than a second set of defaults invented here.
  //
  // WHERE IT STANDS IS garage-site.js's ANSWER, not this page's: PROJECT
  // will place one too, and a second derivation of "beside the house" is
  // the copy the ruling is about.
  //
  // ONE PRESS, ONE UNDO. Five separate steps would have Ctrl+Z leave three
  // walls and a garage-flagged loop standing around them, which is not a
  // state any gesture can otherwise produce.
  // ── BUILT FRONT-DOWN, STANDING WHERE E1 IS ──────────────────────────────
  //
  // Movie, 1 Oct: *"i'd like the drawings to start out with E1 on the right
  // side looking leftwards towards the house"* -- and HOUSE ROTATE moves E1
  // too. The premade house and the ordered garage are both designed with their
  // front down the plan, E1's seat before any turn, and until this they came
  // out that way whatever the drawing's turn: a garage door facing E3 on a
  // turned drawing, its "front" on the elevation that reads the back.
  //
  // SO THE BUILDER WORKS IN ITS OWN FRAME. The drawing turns back to no turn,
  // the builder places against the house exactly as it was written to, and
  // everything turns forward again -- the new building with it. In place and
  // about the origin (plan-rotate.js says why), so the 'built' undo step still
  // holds the very walls it names and the drafter's own walls come back to the
  // bit. The corner pool turns too, or a new wall would merge onto a corner
  // standing in the other frame.
  const builtFrontDown = build => order => {
    const ROT = window.DraftPlanRotate;
    const turn = ((Number(drawing?.planTurn) || 0) % 4 + 4) % 4;
    if (!drawing || !turn || !ROT?.turnInPlace) return build(order);
    ROT.turnInPlace(drawing, 4 - turn, { also: vertexPool });
    markDirty();
    let out = null;
    try {
      out = build(order);
    } finally {
      ROT.turnInPlace(drawing, turn, { also: vertexPool });
      markDirty();
      fit();
      paint();
    }
    return out;
  };

  // `given` IS A GARAGE THE DRAFTER TRACED: its own corners and doors
  // (traced-plans.js), and the trace records to put back on Ctrl+Z.
  const buildOrderedGarage = (order, given = null) => {
    if (!drawing || !order?.entry?.needsSize || (!order.size && !given?.corners)) return null;
    // THE LOWEST FLOOR LEVEL, NOT THE ACTIVE ONE -- the same fix the premade
    // house needed, and the other half of what Movie reported. A garage
    // ordered while looking at FOUNDATION had its STUD walls committed
    // through the active view, so contextWallType handed back concrete_8 and
    // the drafter got a garage framed in eight inches of concrete on the
    // foundation set. MODEL.dc.html's _buildGarageWalls uses
    // `_floorLevels()[0]` for exactly this reason.
    const storey = lowestFloorLevel();
    if (!storey) return null;
    const levelId = storey.id;
    const corners = given?.corners
      || window.DraftGarageSite.plotFor(drawing, levelId, order.size);
    if (!corners) return null;
    drawing.outlines = drawing.outlines || [];
    const outline = {
      id: newDrawingItemId('outline'),
      masterId: null,
      levelId,
      garage: true,
      // DETACHED, SAID ON THE RECORD. It is the detached family's own tile,
      // and an outline that only implies it would not spend the detached
      // garage's slot -- building-bodies.js reads the flag, not the family.
      detached: true,
      foundation: order.entry.foundation || null,
      points: corners.map(pt => ({ x: pt.x, y: 0, z: pt.z })),
      overriddenSrcIds: [],
    };
    drawing.outlines.push(outline);
    // WHETHER THERE IS A STOREY IS DECIDED ONCE, HERE, because three things
    // downstream want the same answer and must not each work it out: the
    // front wall's bays, the storey itself, and the stair that stands in the
    // strip the bays leave. 'none' is an answer and is kept -- a drafter who
    // took the room off and orders another garage is not asking for it back,
    // and gets the stock single-bay front with it.
    const fdnKind = order.entry.foundation || null;
    const detachedRow = () => drawing.sectionTable?.rows?.detachedGarage || {};
    const carriesStorey = window.DraftBuildMenu.garageCarriesStorey(fdnKind);
    const wantsRoom = carriesStorey && detachedRow().overGarage !== 'none';
    // The four walls' own 'add' steps are dropped for the single 'built'
    // one below. Left in, the first Ctrl+Z would take the whole garage and
    // the next four would each hunt a wall that is already gone.
    const mark = undoStack.length;
    // STUDS ON THE STOREY, said explicitly rather than inherited: `plan` is
    // where a garage's framed walls live whatever set the drafter is on.
    const walls = corners.map((corner, index) =>
      commitWall(corner, corners[(index + 1) % corners.length],
        { bone: false, levelId, view: 'plan', body: 'garage' }));
    // ── AND A WAY INTO IT ────────────────────────────────────────────────
    //
    // Movie, 20 Sep: "also the detached garage doesn't have a roof or windows
    // and doors yet i noticed". Four walls, its concrete, and nothing else --
    // a sealed box on every sheet.
    //
    // BY EDGE, and this array IS edge-indexed rather than merely in order:
    // corners.map raises one wall per edge and skips none, so `walls[i]` is
    // edge i. Said out loud because the same assumption held in raiseLoop
    // right up until an attached garage began skipping shared edges, and the
    // openings then moved one wall over and still looked like doors.
    //
    // THE SIZE USED TO BE THE ONE THE DRAFTER TYPED, handed to the design
    // rather than re-derived -- "measuring the loop back would be a second
    // opinion about which of the two numbers is the width". That reading was
    // right about ordered garages and wrong about the other half of this
    // function: a TRACED garage has no typed size at all, and the second
    // opinion it feared is not available to disagree. See the measurement
    // below, which comes to the same numbers wherever a size was typed.
    //
    // AND THE WALL THICKNESS THIS PAGE FRAMED IT IN, because that is what
    // carries the end of the overhead door's lintel -- premade-plans.js sizes
    // the door to fit and cannot know what contextWallType handed back.
    // THE DESIGN IS ALREADY FACING THE STREET HERE. builtFrontDown turns the
    // drawing back to no turn before this runs and forward again after, so
    // edge 2 -- the design's front -- comes out on E1 at every turn. Measured
    // before adding a rotation this build does not need.
    // ── THE SIZE COMES OFF THE LOOP, NOT OFF THE ORDER ───────────────────
    //
    // Movie, 14 Oct, looking at a 2 storey detached garage he had TRACED:
    // "the garage doors are showing on the main floor but not on 2nd floor
    // and there is no roof", and "gap between main ceiling and 2nd floor
    // wall". Three faults, one cause, and it was a crash: `order.size` is
    // what the drive-thru was ASKED for, and a traced garage brings corners
    // instead -- the guard at the top of this function allows exactly that.
    // So `order.size.widthFt` threw, AFTER the walls were committed and
    // BEFORE the deck, the room's windows and the roof. A build that stops
    // halfway leaves a drawing that looks built and is not: the storey
    // stood on nothing, which is the gap he saw, and nothing raised a roof
    // over it.
    //
    // THE LOOP IS THE BUILDING. `order.size` is a request; `corners` is what
    // got built, and it is always there -- the function returns before here
    // without it. On a garage the board PLOTTED the two are the same numbers
    // (garage-site plots width across x and depth back from the door wall),
    // so nothing about an ordered garage moves; a traced one gets measured
    // instead of throwing.
    const sizeBox = corners.reduce((box, pt) => ({
      x0: Math.min(box.x0, pt.x), x1: Math.max(box.x1, pt.x),
      z0: Math.min(box.z0, pt.z), z1: Math.max(box.z1, pt.z),
    }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
    const builtSize = { widthFt: sizeBox.x1 - sizeBox.x0, depthFt: sizeBox.z1 - sizeBox.z0 };
    // THE DESIGN IS ALREADY FACING THE STREET HERE. builtFrontDown turns the
    // drawing back to no turn before this runs and forward again after, so
    // edge 2 -- the design's front -- comes out on E1 at every turn. Measured
    // before adding a rotation this build does not need.
    const openings = given?.openings ? dealOpenings(given.openings, walls, levelId) : dealOpenings(
      (window.DraftPremadePlans.detachedGarageOpenings({
        widthFt: builtSize.widthFt,
        depthFt: builtSize.depthFt,
        wallThicknessFt: openingThicknessFt()(walls[0]),
        // TWO BAYS AND A STRIP WHERE THERE IS A STAIR TO STAND IN IT -- the
        // same `wantsRoom` the storey is raised on, so a garage whose room
        // was turned off keeps the stock single-bay front rather than a strip
        // left over from a stair nobody is getting.
        stair: wantsRoom,
      })), walls, levelId);
    // AND ITS CONCRETE. Movie ordered a "detached garage 25x25 with frost
    // wall" and got four stud walls: the tile asked him which foundation and
    // then threw the answer away, because nothing on this page read it.
    const concrete = raiseGarageConcrete(corners, outline);
    // ── AND THE ROOF OVER IT ─────────────────────────────────────────────
    //
    // NO `against`, and that is the whole difference between this roof and the
    // attached garage's. A detached garage touches nothing: every edge is an
    // eave, every edge takes the full overhang, and there is no house wall for
    // a gable to cut against. The attached one passes the house and gets both
    // of those answers the other way round on two of its edges.
    //
    // FLAGGED `garage` WITH ITS OWN PLATE, for the same reason the attached
    // one is: cut-view.js's roofBaseElev bears such a roof at the first floor's
    // top plus the plate instead of on the full wall stack, so a single-storey
    // garage beside a 2 STOREY keeps a single-storey roof. On a bungalow the
    // two readings land on the same number, so the flag costs nothing there.
    //
    // AND ONLY WHERE THERE IS A ROOF LEVEL TO PUT IT ON, which is the rule the
    // premade build already follows -- a drawing without one gets the garage it
    // ordered rather than a silent failure or a roof filed nowhere.
    // ── AND A STOREY OVER IT, WHERE THE FOUNDATION CARRIES ONE ─────────────
    //
    // Movie, 13 Oct: "its the detached garages, when someone selects FROST
    // WALL or GRADE BEAM, lets give them a DEFAULT - 2 storey which will
    // need a set of stairs too and the thicker floor joists most likely (if
    // wider than 19ft will need OWJ)" -- and of the third foundation, "you
    // won't have to worry about stairs on the thickened edge, we can't have
    // 2nd floor for thickened edge".
    //
    // THE SAME DEFAULT FROM THE OTHER DOOR. PROJECT writes it when the
    // foundation is chosen there; this is the drive-thru, which is the other
    // place a foundation is picked, and a default that only fired on one of
    // them would be a default a drafter met at random. Written onto the
    // section table so PROJECT's schedule and section show the storey that
    // was just built rather than disagreeing with the model.
    //
    // 'none' IS AN ANSWER AND IS KEPT -- see carriesStorey/wantsRoom above,
    // which is where this press decides, once, whether there is a storey.
    if (carriesStorey && detachedRow().overGarage !== 'room') {
      const table = drawing.sectionTable || { rows: {} };
      const rows = table.rows || {};
      drawing.sectionTable = { ...table, rows: { ...rows,
        detachedGarage: { ...(rows.detachedGarage || {}),
          garageFoundation: fdnKind, overGarage: 'room' } } };
    }
    // THE STOREY GOES ON 2ND FL (Movie, 14 Oct: "the Garage 2 storey
    // shouldn't even have a 1.5 floor - it is more like a bungalow than a
    // bilevel"). It went on OVER GARAGE until then, which is the HALF storey
    // of a split and is why the cards all read "1.5 2ND FL" over a building
    // that has no half anything -- see GARAGE_ROOM_LEVEL_ID. Added here when
    // the drawing has not got it, the way the bilevel's build adds ENTRY,
    // and filed in the levels list above MAIN FL.
    const levelItems = [];
    const upperId = GARAGE_ROOM_LEVEL_ID;
    let upperWalls = [];
    let upperOutline = null;
    let upperDeck = null;
    // AND THE ROOM'S OWN WINDOWS, held so they ride the one 'built' step with
    // everything else: one press is one undo, and a row of windows left
    // hanging over a garage that is gone is the shape of an undo that only
    // knew about half of what it built. (It was exactly that for an hour --
    // model-html-ordered-garage's undo check is what said so.)
    let upperOpenings = [];
    if (wantsRoom) {
      if (!levelPresent(upperId)) {
        // THE STOCK NAME AND HEIGHT FOR THIS LEVEL, not a pair typed here:
        // 2ND FL stands a storey over MAIN FL, and a drawing that already
        // carries the level keeps whatever it was named and set to.
        const level = { id: upperId, name: '2ND FL', elev: 9, visible: true };
        const at = (drawing.levels || [])
          .findIndex(entry => Number(entry.id) === levelId);
        drawing.levels.splice(at < 0 ? 0 : at, 0, level);
        levelItems.push({ list: drawing.levels, item: level });
      }
      // ITS OWN LOOP, so everything that asks "what stands on this level"
      // -- the beam rule, the dimensions, the plan painter -- finds a body
      // rather than inferring one from the walls.
      upperOutline = {
        id: newDrawingItemId('outline'),
        masterId: null,
        levelId: upperId,
        // NOT `garage`: this is a room, and a loop flagged garage would be
        // read as another bay by everything that counts garages -- including
        // the beam rule, which is looking for the garage UNDER this body.
        garage: false,
        points: corners.map(pt => ({ x: pt.x, y: 0, z: pt.z })),
        overriddenSrcIds: [],
      };
      drawing.outlines.push(upperOutline);
      upperWalls = corners.map((corner, index) =>
        commitWall(corner, corners[(index + 1) % corners.length],
          { bone: false, levelId: upperId, view: 'plan', body: 'garage' }));
      // AND ITS WINDOWS. Movie, 14 Oct, twice: "still FENSTRATIONS look like
      // not properly loading on the Detached Garage 2 storey grade beam".
      // The storey went up on 13 Oct with four walls and nothing in them, so
      // every elevation of it was a blank band -- the elevations were right
      // and there was nothing to draw. Dealt the same way the ground floor's
      // openings are, off the size the drafter typed and the thickness this
      // page framed the walls in, so the two sets cannot disagree about
      // either; premade-plans decides where they go.
      upperOpenings = dealOpenings((window.DraftPremadePlans.detachedGarageUpperOpenings({
        widthFt: builtSize.widthFt,
        depthFt: builtSize.depthFt,
        wallThicknessFt: openingThicknessFt()(upperWalls[0]),
        // THE SAME `stair` THE FRONT BAYS WERE DEALT ON, so the window that
        // would stand over the stairwell is the one that is left out.
        stair: wantsRoom,
        // ── AND THE ROOM'S OWN WALLS, EDGE BY EDGE ──────────────────────
        //
        // The design's rectangle is four edges; a garage the drafter TRACED
        // is whatever he drew, and his 14 Oct one was an L with six. Handed
        // only a width and a depth, it dealt the first four and left the
        // other two blank -- one of which was the wall he was looking at.
        // These are the edges actually raised, in the order walls[i] is
        // edge i (the same assumption the ground floor's deal rests on).
        edgesFt: corners.map((pt, index) => {
          const next = corners[(index + 1) % corners.length];
          return Math.hypot(next.x - pt.x, next.z - pt.z);
        }),
        // AND WHICH OF THEM THE STAIR COMES UP AGAINST: the wall the
        // overhead doors went in, asked of the openings that were just
        // dealt rather than assumed, since a traced garage puts them
        // wherever the drafter drew them.
        frontEdge: Math.max(0, walls.findIndex(wall => (openings || [])
          .some(item => item?.garage === true && String(item.wallId) === String(wall.id)))),
      })), upperWalls, upperId);
      // AND A DECK UNDER IT, which is the house build's own per-storey rule:
      // walls AND a floor, or the section draws a storey standing on
      // nothing. This deck is what the span rule measures.
      drawing.floors = drawing.floors || [];
      upperDeck = floorRecord(corners, upperId, 'floor');
      drawing.floors.push(upperDeck);
    }
    // FLAGGED `garage` WITH ITS OWN PLATE (above), and the plate is the whole
    // stack when there is a storey in it: the garage wall, the deck over it,
    // and the room's own wall. A roof left on the lower plate would sit on
    // the garage ceiling with the room standing through it.
    const LAsm = window.DraftLevelAssembly;
    const roofPlateFt = assemblyFor(levelId).wallHeightFt + (wantsRoom
      ? LAsm.levelFloorFt(assemblyFor(upperId)) + assemblyFor(upperId).wallHeightFt
      : 0);
    const roof = levelPresent(ROOF_LEVEL_ID)
      ? raiseRoofOver(corners, {
        garage: true,
        follows: 'detachedGarage',
        plateHeightFt: roofPlateFt,
        sourceLevelId: wantsRoom ? upperId : levelId,
      })
      : null;
    undoStack.length = mark;
    // ── AND THE DIMENSIONS, WHICH THIS PRESS HAS NEVER PLACED ──────────────
    //
    // Movie, 13 Oct, looking at a LAYOUT sheet: "just noticed - not
    // dimensions on the detached garage roof plan, can you check it later."
    //
    // IT IS NOT THE ROOF PLAN, AND IT IS NOT LAYOUT. Measured: a detached
    // garage comes off this press with NO dimensions at all -- the tally is
    // empty, every plan of it, not merely the roof one. The house's bone
    // press has strung every level it touched since AUTO DIMS went in; this
    // press is the other build in the app and it never learned to.
    //
    // THE LEVELS THE GARAGE ACTUALLY TOUCHED, asked the same way the house
    // press asks: its walls go on the lowest storey, its slab and footings on
    // FOUNDATION, its roof on ROOF. The floor layout is asked too, for the
    // parity Movie ruled for the house ("can we add dimensions to ALL them
    // except electric plan") -- placeAutoDims answers -1 where a view holds
    // nothing worth stringing, so asking costs a no.
    //
    // ONE PRESS IS ONE UNDO, so the strings ride the same 'built' step as the
    // walls: `items` takes what was laid and `restored` what the sweep took
    // out, which is the pair that branch already knows how to put back.
    // ── AND WHAT HOLDS THAT DECK UP ────────────────────────────────────────
    //
    // Movie, 13 Oct: "can you adjust the floor depths based on how far the
    // span is for the detached garage. after the 31ft we would need rows of
    // beam and columns".
    //
    // IT IS ALL ALREADY WRITTEN, and for this exact building. placeAutoBeam's
    // garage pass reads a floor body standing over a garage loop and answers
    // with build-house.js's own table: owjFor sizes the deck from the span --
    // its deepest row reaches 31 ft at 12" o.c., which IS his number -- and
    // past it garageBeamPlan lays the dropped ENGINEERED BEAM on columns he
    // ruled for on 12 Oct, centred between the garage doors. What was missing
    // was a detached garage with a floor over it to ask about.
    //
    // ASKED FROM THE GARAGE'S OWN LEVEL, which is the level that FRAMES the
    // deck above it -- the same relation the house press walks.
    const framed = [];
    const framedSwept = [];
    if (wantsRoom) {
      const beamed = placeAutoBeam({ levelId });
      if (beamed !== -1) {
        framed.push(...beamed.placed);
        framedSwept.push(...beamed.restored);
      }
      // AND A WAY UP INTO IT -- Movie, 13 Oct: a storey over the garage "will
      // need a set of stairs too", "along one side", off an 8 ft entry. The
      // flight comes with its well cut out of the deck above it. Its RISE is
      // the one thing that is not the house's: it lands on the garage slab,
      // 5 1/2" under the sill -- see garageSlabDescent.
      //
      // AFTER THE BEAMS, because the stair is nudged clear of whatever is
      // carrying the floor it cuts through, and the beam has to be down for
      // that to be possible.
      const stairs = placeGarageRoomStair(upperId);
      if (stairs !== -1) framed.push(...stairs.placed);
      // AND THE HEADER THE WELL NEEDS, now the well is cut. The beam pass
      // above ran before the stair and could not see it -- see
      // placeStairHeaders, which adds and moves nothing else, so running it
      // here costs the beams nothing.
      framed.push(...placeStairHeaders({ levelId }));
    }
    const dimmed = [];
    const dimSwept = [];
    [[levelId, 'plan'], [levelId, 'floor'],
      ...(wantsRoom ? [[upperId, 'plan'], [upperId, 'floor']] : []),
      [FOUNDATION_LEVEL_ID, 'foundation'], [ROOF_LEVEL_ID, 'plan']]
      .forEach(([id, view]) => {
        if (!levelPresent(id)) return;
        const result = placeAutoDims(id, view);
        // -1 IS A REAL ANSWER: nothing on that view is big enough to string.
        if (result === -1) return;
        dimmed.push(...result.placed);
        dimSwept.push(...result.removed);
      });
    // `outlines` PLURAL, because a premade bungalow raises two bodies on one
    // press and one press is one undo. The garage passes its single loop as a
    // list of one rather than the branch learning two shapes.
    undoStack.push({ kind: 'built',
      walls: walls.concat(concrete.walls).concat(upperWalls),
      outlines: upperOutline ? [outline, upperOutline] : [outline],
      list: drawing.outlines, openings: openings.concat(upperOpenings),
      items: concrete.items.concat(roof ? [roof] : [])
        .concat(framed)
        .concat(dimmed.map(item => ({ list: drawing.dimensions, item })))
        // THE LEVEL THE STOREY NEEDED GOES BACK WITH IT, the way the
        // bilevel's ENTRY does -- a drawing left carrying an empty OVER
        // GARAGE after an undo is a level the drafter never asked for.
        .concat(upperDeck ? [{ list: drawing.floors, item: upperDeck }] : [])
        .concat(levelItems),
      restored: (given?.restore || []).concat(framedSwept)
        .concat(dimSwept.length ? [{ list: drawing.dimensions, items: dimSwept }] : []) });
    markDirty();
    paint();
    return outline;
  };
  // AND THE BOARD GETS OUT OF THE WAY once it has built what was ordered:
  // the drafter's next move is to look at the garage, and it is behind the
  // sign.
  window.ModelBuild.onOrder(order => {
    if (!builtFrontDown(buildOrderedGarage)(order)) return;
    window.ModelBuild.orderServed();
    setSign(false);
  });

