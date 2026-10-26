// MODEL.html's page script, part 2 of 17: holograms, DEMO, super nodes, each window's size tag, the tag under the pointer.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── HOLOGRAMS: ANOTHER .draft UNDER THIS ONE (Movie, 8 Oct) ─────────────
  //
  // "allow users to bring DRAFT 'HOLOGRAM' into another file" -- the existing
  // house on a lot that is getting an addition. Drawn by the SAME painter the
  // LAYOUT sheets and the neighborhood program draw a whole .draft with
  // (layout-plan.js drawPlan), handed a transform that places it. It reads
  // the hologram's own copy and nothing on this page's item lists, so no
  // tool can select, snap to or change it.
  //
  // LIGHT BLUE, the colour MODEL.dc.html's BACKGROUND ghost already used, so
  // it cannot be read as this drawing's ink. The painter draws in black on
  // the page's own ground; SCREEN with blue turns the black to blue and
  // leaves the ground the ground, in every skin. The second canvas is the
  // mask that keeps the screen pass off the empty parts.
  // ── HOLOGRAMS: ANOTHER .draft UNDER THIS ONE (Movie, 8 Oct) ─────────────
  //
  // What is drawn -- the existing plan less its DEMO, the DEMO dashed, both
  // screened light blue -- is hologram.js's, shared with the LAYOUT sheets.
  // What stays here is this page's: which switches are on, DEMO PART's
  // first click, and the picking.
  const H = () => window.DraftHologram;
  const HOLOGRAM_BLUE = 'rgb(82,151,218)';
  const HOLOGRAM_VIEWS = new Set(['plan', 'floor', 'foundation']);
  const holograms = () => (Array.isArray(drawing?.holograms) ? drawing.holograms : []);
  // ── DEMO (Movie, 8 Oct) ──────────────────────────────────────────────
  //
  // "would it be possible to make stuff for 'demo' and redraw the new stuff
  // overtop (have both showing or turn on or off which ones you want to look
  // at) - the hologram will stay, but just parts will be 'removed' from the
  // new 'hologram' the DEMO parts".
  //
  // THREE SWITCHES, each the drafter's to flip: EXISTING (the hologram less
  // what is coming out), DEMO (what is coming out, dashed -- the way a permit
  // set draws removals) and NEW (this drawing's own work). Kept per browser:
  // they are how the drafter is LOOKING, not something the file says.
  // DEMO PART's state, up here because the painter shows its first click.
  let hologramPartMode = false;
  let hologramHover = null;        // the hologram a list row the pointer is over lights
  let hologramPartStart = null;    // { wallId, along, at } -- the first click
  const HOLOGRAM_SHOW_KEY = 'draft.hologram.show';
  const hologramShow = (() => {
    const all = { existing: true, demo: true, new: true };
    try {
      const kept = JSON.parse(localStorage.getItem(HOLOGRAM_SHOW_KEY) || '{}');
      Object.keys(all).forEach(key => { if (kept[key] === false) all[key] = false; });
    } catch { /* every switch on */ }
    return all;
  })();
  const hologramShapes = (holo, items, levelId, view) => H().shapes(holo, items, levelId, view);
  const hologramWallsPlaced = () => (H() ? holograms().filter(holo => !holo.hidden)
    .flatMap(holo => H().placed(holo, H().parts(holo).existing.walls || [])) : []);
  // ── A HOLOGRAM PICKED LIKE AN ASSEMBLY (Movie, 20 Oct) ─────────────────
  //
  // "would it be possible to SELECT the HOLOGRAM UNITS as like selecting a
  // ASSEMBLY unit - and allow the user to copy, flip rotate etc in the way
  // they can do it with a selected ASSEMBLY unit (or units) id like to pick
  // all 4 of these suites with a rectagular select and then copy / flip
  // them". Its walls on this level, where they stand on the plan: a click on
  // one picks the whole hologram, and the box catches it by them.
  const hologramWallsHere = holo => (H() && !holo?.hidden
    ? H().placed(holo, (H().parts(holo).existing.walls || []).filter(w => w?.levelId === activeLevelId()))
      .filter(w => w?.start && w?.end) : []);
  const hologramPickAt = worldPt => {
    const G = window.DraftGeometry2D;
    if (!G) return null;
    const reach = SELECT_GRAB_PX / view.scale;
    let best = null, bestD = reach;
    holograms().forEach(holo => hologramWallsHere(holo).forEach(wall => {
      const { d } = G.pointToSegment(worldPt, wall);
      if (d < bestD) { bestD = d; best = holo; }
    }));
    return best;
  };
  // ITS PLACED PIVOT -- where its own middle stands on this drawing -- and
  // every corner of its walls here, for the middle a turn or a flip goes about.
  const hologramPivotPlaced = holo => ({ x: (Number(holo.pivotX) || 0) + (Number(holo.x) || 0),
    z: (Number(holo.pivotZ) || 0) + (Number(holo.z) || 0) });
  const hologramCorners = holo => hologramWallsHere(holo).flatMap(w => [w.start, w.end]);

  // ── SUPER NODES (Movie, 20 Oct), and their going (26 Oct) ─────────────
  //
  // "i have another idea for the suites to make it easier to place as
  // holograms. can i make special 'NODES' -- make a NODE command in the
  // drafting menu, and those will be super high power nodes very SNAP
  // Magnetic. and my plan is to place them on the corners of the suites
  // where they will attach to the other SUPER NODES that i will place on
  // the corners of all the suites and the outside corner will be the
  // outside ext wall line, the inside corner will be the inside int wall
  // line." -- SUPERNODE, one word, his spelling; "think 1ft is good";
  // "super nodes will attach to other super nodes" -- "and also to other
  // nodes but secondarily (to place the first one)"; "corner SUPER nodes
  // GREEN / BLUE / TURQOISE BRIGHT".
  //
  // NO SUPERNODE ANY MORE (Movie, 26 Oct: "maybe we can get rid of that, it
  // didn't work that good"): no N tool, no turquoise dots, no suite caught
  // by a house node. A suite meets a suite by its end lines and the shell
  // by its walls, both from 3" (reachFt('suite')); the gold registration
  // corner stays. Old files' superNodes are read past and not saved.
  // PRINTSCREEN shoots with `presenting` up, and no marker paints then.
  let presenting = false;
  const SUPER_NODE_INK = '#1ef2ff';
  const SUPER_NODE_GLOW = 'rgba(30, 242, 255, 0.95)';
  // A HOLOGRAM'S SUPER NODES, placed, on this level.
  const hologramSuperNodes = holo => (H()?.suiteSuperNodes ? H().suiteSuperNodes(holo, activeLevelId()) : []);
  // THE COLOUR A SHELF'S SUITE WEARS ON THE PLAN: that of the hologram file
  // named for the shelf (EDIT ON SHELF names the shelf for the file, and a
  // shelf saved as a suite is filed under the shelf's name), or none.
  const shelfColourOf = shelf => {
    if (!shelf || !H()?.colourOf) return null;
    const name = String(shelf.name || `SHELF ${shelf.id}`).trim().toUpperCase();
    const twin = holograms().find(holo => String(H().fileOf(holo) || '').trim().toUpperCase() === name);
    return twin ? H().colourOf(twin, drawing) : null;
  };
  // GOLD ON THE REGISTRATION CORNER (Movie, 22 Oct: "make that SUPERNODE
  // corner gold to match"): the corner standing on the gold target wears
  // the target's own ink, so the corner that lines up reads at a glance --
  // a suite hologram's and a shelf's (hologram.js registered).
  let goldDots = 0;   // how many came out gold this paint, for the specs
  // `ink` names a colour of the node's own -- a hologram's corners wear
  // their file's colour (Movie, 23 Oct) -- and gold still wins.
  const superDot = (pt, { ring = false, bright = false, faint = false, gold = false, ink: own = null } = {}) => {
    const p = toS(pt);
    if (gold) goldDots += 1;
    const ink = gold ? (skin['draw-origin'] || SUPER_NODE_INK) : (own || SUPER_NODE_INK);
    ctx.save();
    ctx.shadowColor = gold || own ? ink : SUPER_NODE_GLOW;
    ctx.shadowBlur = bright ? 16 : faint ? 6 : 10;
    ctx.globalAlpha = faint ? 0.55 : 1;
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = bright ? 3 : 2;
    if (ring || bright) { ctx.beginPath(); ctx.arc(p.x, p.y, bright ? 9 : 6, 0, Math.PI * 2); ctx.stroke(); }
    if (!ring || bright) { ctx.beginPath(); ctx.arc(p.x, p.y, bright ? 3 : 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  // THE ANCHORS' PAINT, filled in with the anchor helpers (whose consts
  // come later in the file than this paint pass); the assembly whose
  // anchors are being picked, while the ANCHOR verb is lit.
  let paintAnchors = () => {};
  let paintRefGuide = () => {};
  let anchorPicking = null;
  // THE HOUSE'S AS DOTS, A HOLOGRAM'S AS RINGS, so the two kinds read
  // apart; the pair that has a hologram in hand, bright. For the specs,
  // `data-super-lock` names the house node holding it.
  const paintSuperNodes = () => {
    if (presenting || !drawing) return;
    goldDots = 0;
    // A HOLOGRAM'S CORNERS IN ITS FILE'S COLOUR (Movie, 23 Oct: "make the
    // AQUA corner NODES on the imported suite/shelfs ... match the chart for
    // each unit type" -- "will be easier for a user to identify them"). The
    // same ink the HOLOGRAM panel's row and the tinted walls wear; the gold
    // registration corner stays gold.
    // A SUITE'S END LINES, NOT ITS CORNER RINGS (Movie, 25 Oct): a line on
    // its top and bottom, in its file's colour, 2 ft past each corner so it
    // is easy to see and to grab; the pair a held suite has caught, bright.
    // The gold registration corner keeps its ring; nothing else does now.
    const lineLock = traceMoving?.hologram ? traceMoving.lineLock : null;
    let litLines = 0;
    const drawnLines = [];
    holograms().filter(holo => !holo.hidden).forEach(holo => {
      const ink = H().colourOf?.(holo, drawing)?.ink || null;
      (H().suiteEndLines?.(holo, activeLevelId()) || []).forEach(L => {
        drawnLines.push({ L, holo, ink: ink || SUPER_NODE_INK });
        const bright = !!lineLock && ((traceMoving.underlay === holo && lineLock.mine.end === L.end)
          || (lineLock.other === holo && lineLock.line.end === L.end));
        if (bright) litLines += 1;
        const a = toS(L.ea), b = toS(L.eb);
        ctx.save();
        ctx.strokeStyle = ink || SUPER_NODE_INK;
        ctx.shadowColor = ink || SUPER_NODE_GLOW;
        ctx.shadowBlur = bright ? 14 : 6;
        ctx.lineWidth = bright ? 4 : 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
      });
      hologramSuperNodes(holo).forEach(n => {
        if (n.registration === true) superDot(n.point, { ring: true, ink, gold: true });
      });
    });
    // JOINED, THE TWO COLOURS TAKE TURNS (Movie, 25 Oct: "when the 2 suites
    // joine rather than overlapping the lines make a new line that has both
    // colors but is dashed one color and then back to the other color" --
    // "to notify the user they are connected too, if they are both solid
    // they aren't connected precisely"). Two suites' end lines that face
    // each other and lie on one line, to a hundredth of a foot, are redrawn
    // over the stretch they share: one colour solid, the other dashed on it.
    let joined = 0;
    drawnLines.forEach((p, i) => drawnLines.slice(i + 1).forEach(q => {
      if (p.holo === q.holo) return;
      const { L } = p, M = q.L;
      if (L.n.x * M.n.x + L.n.z * M.n.z > -0.999) return;
      if (Math.abs((M.a.x - L.a.x) * L.n.x + (M.a.z - L.a.z) * L.n.z) > 0.01) return;
      const u = { x: (L.b.x - L.a.x) / L.len, z: (L.b.z - L.a.z) / L.len };
      const along = pt => (pt.x - L.ea.x) * u.x + (pt.z - L.ea.z) * u.z;
      const reach = Math.hypot(L.eb.x - L.ea.x, L.eb.z - L.ea.z);
      const t0 = Math.max(0, Math.min(along(M.ea), along(M.eb)));
      const t1 = Math.min(reach, Math.max(along(M.ea), along(M.eb)));
      if (t1 - t0 <= 0.01) return;
      joined += 1;
      const a = toS({ x: L.ea.x + u.x * t0, z: L.ea.z + u.z * t0 });
      const b = toS({ x: L.ea.x + u.x * t1, z: L.ea.z + u.z * t1 });
      ctx.save();
      ctx.lineWidth = 4;
      ctx.lineCap = 'butt';
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.ink;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = q.ink;
      ctx.setLineDash([9, 9]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }));
    if (!thumbTarget) {
      canvas.dataset.joinedLines = String(joined);
      canvas.dataset.suiteLines = String(litLines);
      if (lineLock) canvas.dataset.lineLock = `${lineLock.other.id}:${lineLock.line.end}`;
      else delete canvas.dataset.lineLock;
    }
    // AND A SHELF'S OWN CORNERS, on the shelf and in its little square above
    // the bone, in the colour its copies on the plan wear -- the hologram
    // file named for the shelf -- so the square and the copies read as one
    // unit type at a glance. A shelf no copy has come from yet keeps the
    // plain aqua.
    const shelfLevel = activeLevelId();
    if (shelfLevel < 0 && H()?.shelfSuperNodes) {
      const ink = shelfColourOf(shelves().find(sh => -Number(sh.id) === shelfLevel))?.ink || null;
      H().shelfSuperNodes(walls(), shelfLevel, drawing?.planTurn || 0).forEach(n => superDot(n.point, { ring: true, gold: n.registration === true, ink }));
    }
    // THE SHEET'S OWN COUNT, not a shelf square's: a thumb paint passes
    // through here too now, and must not write over what the sheet said.
    if (thumbTarget) return;
    canvas.dataset.goldSuperNodes = String(goldDots);
  };
  const paintHolograms = () => {
    // The HOLOGRAM chip lit while any is loaded -- after an UNDO, an open.
    // (Its consts may still be ahead of us on the first paint.)
    try { setHologramChip(); } catch { /* not wired yet */ }
    if (!H()) return;
    const drew = H().paint(ctx, toS, drawing, activeLevelId(),
      { view: activeViewId(), show: hologramShow, paperColor: skin['surface-page'] });
    // A SUITE IN HAND LIGHTS THE SHELL WALL IT IS LINING UP WITH, and the
    // doors and windows it will cut there (Movie, 18 Oct: "light up the walls
    // when they are close enough for auto snap allignment and then show where
    // the windows ard doors are"). A wall beside it that is not its thickness
    // is lit in the warning ink: those faces can never line up.
    const inHand = (() => { try { return traceMoving?.hologram ? traceMoving.underlay : null; } catch { return null; } })();
    if (inHand && inHand.mode === 'suite' && H().suiteNear) {
      const G = window.DraftGeometry2D;
      const thick = openingThicknessFt();
      const body = w => {
        const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz) || 1;
        const n = { x: -dz / len, z: dx / len };
        const { startOff, endOff } = G.wallFaceOffsets(w, thick(w));
        const at = (p, o) => toS({ x: p.x + n.x * o, z: p.z + n.z * o });
        return [at(w.start, startOff), at(w.end, startOff), at(w.end, endOff), at(w.start, endOff)];
      };
      const near = H().suiteNear(drawing, inHand, activeLevelId(), reachFt('suite'));
      ctx.save();
      ctx.lineWidth = 2.5;
      near.forEach(n => {
        ctx.strokeStyle = n.lined ? (skin['accent'] || '#e8a33d') : '#d04848';
        const q = body(n.host);
        ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
      });
      const cuts = H().hostOpenings(drawing).filter(o => o.suite === inHand.id && o.levelId === activeLevelId());
      ctx.fillStyle = skin['accent'] || '#e8a33d';
      ctx.globalAlpha = 0.55;
      cuts.forEach(o => {
        const w = (drawing.walls || []).find(x => String(x.id) === String(o.wallId));
        if (!w) return;
        const g = G.openingGeometry(o, w, { walls: drawing.walls, thicknessFt: thick, padFt: 0 });
        if (!g?.corners) return;
        const q = g.corners.map(p => toS(p));
        ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      });
      ctx.restore();
      const odd = near.find(n => !n.sameThickness);
      if (odd && !near.some(n => n.lined)) {
        const f = window.DraftFormatters.formatArchitecturalInches;
        sayOnStrip(`That suite wall is ${f(odd.suiteIn)} and the shell wall ${f(odd.shellIn)} -- both faces have to line up, so no windows cut there. Make them one thickness.`);
      }
    }
    // DEMO PART's first click, so the drafter can see where the cut starts.
    if (drew && hologramPartStart) {
      const at = toS(hologramPartStart.at);
      ctx.save();
      ctx.strokeStyle = HOLOGRAM_BLUE;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(at.x, at.y, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  };

  // THE DOOR BUCKS ON THE FOUNDATION VIEW (Movie, 16 Oct): "DOOR BUCKS at
  // the man door and each garage door, 2" wider than the door each side ...
  // the slab pours through the buck in the slab's light blue. The inside
  // edge of the door buck, below the slab, is a lighter line." The garage's
  // doors live on its walls plan and the concrete under them is a closed
  // ring, so door-bucks.js projects each door onto the concrete beneath;
  // the sheet (layout-plan) asks the same module. `data-door-bucks` on the
  // plan says how many were drawn, for a spec to read.
  const paintDoorBucks = () => {
    const DB = window.DraftDoorBucks;
    const R = window.DraftRender2D;
    const G = window.DraftGeometry2D;
    const onFoundation = activeViewId() === 'foundation';
    const bucks = onFoundation && DB && R.drawDoorBucks2D ? DB.doorBucks({
      walls: drawing?.walls || [],
      fenestrations: drawing?.fenestrations || [],
      thicknessFt: openingThicknessFt(),
      faceOffsets: G.wallFaceOffsets,
      concreteLevelId: activeLevelId(),
    }) : [];
    canvas.setAttribute('data-door-bucks', String(bucks.length));
    if (!bucks.length) return;
    R.drawDoorBucks2D(ctx, toS, bucks, {
      paperColor: skin['surface-page'],
      slabFill: skin['draw-floor'],
      wallInk: skin['draw-wall-edge'] || skin['ink-primary'],
      belowAlpha: 0.4,
    });
  };

  const paintWalls = () => {
    // Lazy, so a load-order change cannot bind these to undefined at parse
    // time -- but LOUD, not guarded. An earlier version returned quietly when
    // a module was missing, which turns a broken page into an empty drawing:
    // no error, no warning, and a test asserting "nothing was drawn" passes
    // while the drafter's walls silently vanish. Gilligan's call, 3 Sep, and
    // it is the same shape as everything that cost this repo a night --
    // _stairAutoFit giving up silently, the vertex magnet merging corners
    // silently. A painter that cannot paint must say so.
    const WT = window.DraftWallTypes;
    const R = window.DraftRender2D;
    const G = window.DraftGeometry2D;
    const missing = [!WT && 'wall-types.js', !R && 'render-2d.js',
      !G && 'geometry-2d.js'].filter(Boolean);
    if (missing.length) {
      throw new Error(`MODEL.html: cannot paint walls, ${missing.join(' and ')} `
        + 'did not load. Check the script order in the page head.');
    }
    // MITRED, at last. This page passed `null` for joins from tier 1 until
    // now, which gives capped ends: every corner closed with a straight line
    // across the assembly instead of the layer boundaries running through the
    // vertex. The classifier was extracted before the thing it needs -- it
    // keys on object identity, and the pool that rebuilds identity at shared
    // corners is built in the load path above.
    //
    // Classified over the WALLS ON SCREEN rather than every wall in the
    // drawing -- but that scoping is a BELT, and the pool is the braces.
    //
    // Measured, after a first version of this comment claimed the scoping was
    // what stops an invisible wall voting on a visible corner. It is not, on
    // its own: the pool keys on (levelId, viewId, body), so a wall on another
    // level, another layer set or another body already holds a DIFFERENT
    // corner object and cannot be grouped with these whatever list is passed
    // in. Swapping `shown` for `drawing.walls` changes no pixel, and dropping
    // viewId from the pool key changes none either -- each mutation alone
    // survives because the other mechanism still delivers the answer. Only
    // removing both together turns the corner into a tee.
    //
    // Kept anyway, and not as decoration: it is the cheaper of the two to
    // reason about, it keeps the classifier's input the same set the painter
    // iterates, and a redundant guard on "the drawing mitres the way it looks"
    // is worth its two words.
    const shown = walls();
    // MELDED, where a wall ends on another's middle or two walls cross: the
    // painter is handed the walls cut at those points so the T and the X join
    // like corners do (geometry-2d's meldPieces). Drawing only -- `shown`
    // stays the real walls for the openings below and for everything else.
    const pieces = G.meldPieces ? G.meldPieces(shown) : shown;
    const joins = G.wallJoins(pieces);
    pieces.forEach(wall => {
      if (!wall.start || !wall.end) return;
      R.drawWallSeg2D(ctx, toS, wall, false, joins, 'both', wallEnv());
    });

    // ── AND THE OPENINGS IN THEM ─────────────────────────────────────────
    //
    // ON TOP OF THE WALLS, NEVER BESIDE THEM. An opening is a HOLE: it fills
    // its own footprint with the page colour so the wall reads as cut through,
    // then draws the jambs and the sash back in. Painted before the walls it
    // would be poche-d over and disappear; the order is the drawing.
    //
    // Until now this page drew none of them. A house with windows and doors --
    // every real drawing in this app -- opened here showing BLANK WALLS, and
    // nothing said so: the records were loaded, saved back untouched, and
    // simply never drawn.
    openingsOn(shown, true).forEach(({ opening, geometry }) =>
      R.drawOpening2D(ctx, toS, opening, { geometry }, openingEnv()));
    paintTooBig(ctx, toS, shown);
    paintWindowSizes(ctx, toS, shown);
  };

  // ── WHAT COULD NOT BE MADE GLOWS ───────────────────────────────────────
  //
  // Movie, 20 Oct: "make it glow to be obvious too them when it can't be made
  // due to width etc". The door a brush could not widen, or the wall too short
  // for the opening pressed onto it, is ringed in the warning ink with a halo
  // until the next press or the popup is closed. Screen only: the painters
  // above it are what prints.
  const paintTooBig = (ctx, toS, shown) => {
    if (!brushWarned) return;
    let ring = null;
    if (brushWarned.opening) {
      const hit = openingsOn(shown).find(({ opening }) => opening === brushWarned.opening);
      if (hit) ring = hit.geometry.corners;
    } else if (brushWarned.wall && shown.includes(brushWarned.wall)) {
      ring = [brushWarned.wall.start, brushWarned.wall.end];
    }
    if (!ring) return;
    ctx.save();
    ctx.strokeStyle = skin['ink-warn'];
    ctx.shadowColor = skin['ink-warn'];
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ring.forEach((pt, i) => {
      const p = toS({ x: pt.x, y: 0, z: pt.z });
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    });
    if (ring.length > 2) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  // ── AND EACH WINDOW SAYS ITS SIZE ──────────────────────────────────────
  //
  // Movie, 28 Sep: *"make the windows on the floor plans and on the elevations
  // size : \"36 X 42\" width by height in inches"*, *"mark the window on ext
  // side of window paralel with the window"*, and *"(don't need the letter for
  // the window)"*.
  //
  // THIS PAGE DREW NO TAG AT ALL. fen-labels.js has formatted one since board
  // #141 and plan-composition.js places one, but that module paints the
  // CONSTRUCTION LAYOUT sheets and this page has never called it -- so the tag
  // existed in the codebase and on no screen a drafter opens.
  //
  // THE HELPER IS render-2d's, NOT A SECOND COPY. labelAlongLine2D turns the
  // text to the line, flips it out of the upside-down half turn and holds it
  // clear -- three rules with three mutations already on them, written for the
  // BEAMS on 27 Sep and noted there as "the helper the window tags will share".
  // This is that share.
  //
  // ctx AND toS ARE HANDED IN, not closed over. They are locals of the paint
  // pass -- `const R = window.DraftRender2D` is declared inside each one too --
  // and a helper written at this level that reaches for them compiles, runs,
  // throws on the first window and draws nothing. It did exactly that once.
  // THE GAP IS fen-labels.js's PLAN_TAG_GAP_FT now, with the placement.
  // The click target is a little larger than the ink, which is the usual
  // allowance for a 9px label: the tag is a CONTROL now, and a control you
  // have to hit exactly is a control that feels broken.
  const TAG_HIT_PAD = 5;
  const TAG_HIT_HALF_H = 8;
  const windowTagHits = [];
  // THE BATH FIXTURES' SIZE MARKS (Movie, 23 Oct), kept apart from the
  // windows' so each list clears with its own painter's guards.
  const fixtureTagHits = [];
  const SIZE_MARKED_KINDS = new Set(['shower', 'stall', 'tub', 'vanity', 'pedestal', 'pedestal30']);
  const SIZE_MARK_OFF_PX = 11;
  // HOW FAR IN FROM AN EDGE a mark that sits INSIDE its piece is drawn: the
  // 9px text centred this far in has its foot about a pixel off the edge.
  const SIZE_MARK_IN_PX = 7;
  // The shower pan's curb, as render-2d.js draws it (its `inset`).
  const SHOWER_CURB_FT = 0.15;
  // THE PIECES WHOSE WIDTH IS SAID ON THEIR FRONT EDGE (Movie, 24 Oct:
  // "kitchen cabinet width on front edge, bottom of numbers closest to
  // edge"). The sink base says it in its bowl, the uppers inside their own
  // front line; the appliances say what they are, not a width.
  const CABINET_MARKED_KINDS = new Set(['cabinet', 'drawerbase', 'doorbase', 'cornerbase', 'tallcab']);
  // THE OFFICE'S SIZE SWITCHES (STANDARDS, SIZE MARKS), read at paint time.
  const sizeMarkStandards = () => (window.DraftFenLabels && window.DraftProfileManager
    ? window.DraftFenLabels.normaliseFenStandards(
      window.DraftProfileManager.getActive('standards')?.content?.model?.fenestrationStandards)
    : null);
  const paintWindowSizes = (ctx, toS, shown) => {
    // ── THE SHEET'S OWN TAGS, AND NOT THE THUMBNAILS' ────────────────────
    //
    // This painter also fills the rail's six little level canvases, and they
    // paint AFTER the sheet. Recorded blind, their tags overwrote the hit
    // list with coordinates from a canvas an inch across -- so every tag on
    // the drawing quietly stopped answering a press, while still being
    // painted perfectly. Nothing threw, and the picture was right.
    //
    // The test is the canvas the presses actually arrive on, not a flag a
    // caller passes: a caller that forgot the flag would bring the fault
    // straight back.
    const live = ctx.canvas === canvas;
    // CLEARED AHEAD OF THE GUARDS, not after them. Every `return` below is a
    // paint that drew no tags at all, and a list left standing would keep the
    // LAST paint's tags clickable over a drawing that no longer shows them --
    // a press landing on a window that is not on screen.
    if (live) windowTagHits.length = 0;
    const R = window.DraftRender2D;
    const FL = window.DraftFenLabels;
    const BH = window.DraftBuildHouse;
    if (!FL || !BH || !R || !R.labelAlongLine2D) return;
    // THE TICK, read at paint time from layerStandardOf a few hundred lines
    // down. Same rule and same wording as cut-view.js's own gate so the plan
    // and the elevation cannot answer differently about one layer: a layer
    // the table does not carry DRAWS.
    // AND THE DOORS, by A-DIMS-DOOR's own tick (Movie, 1 Oct: "all
    // window/door/equipe sizes on floor plans"). A door's tag takes a press
    // too now (Movie, 20 Oct: "when they click on the D48 - if they change
    // that to D60 the door width would also change to 5ft wide ... 2 ways to
    // change the width") -- all but a garage door's, whose G 16W x 8H is
    // feet and a height, and is changed in PROPERTIES.
    const showWin = layerStandardOf('A-DIMS-WIN')?.visible !== false;
    const showDoor = layerStandardOf('A-DIMS-DOOR')?.visible !== false;
    if (!showWin && !showDoor) return;
    const outlines = new Map();
    const outlineOf = id => {
      if (!outlines.has(id)) outlines.set(id, houseOutlineOn(id));
      return outlines.get(id);
    };
    ctx.save();
    ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
    openingsOn(shown, true).forEach(({ opening, geometry }) => {
      if (!geometry || !geometry.glazing) return;
      const isWindow = opening.type === 'window';
      if (isWindow ? !showWin : (opening.type !== 'door' || !showDoor)) return;
      const label = FL.fenLabelForOpening(opening, { exteriorWall: isWindow,
        units: drawing?.units });
      if (!label) return;
      // WHERE IT GOES IS fen-labels.js's NOW, and this page's copy is gone
      // rather than left beside it. The Construction Layout draws this same
      // tag from plan-composition.js and was drawing it the OLD way --
      // horizontal, on whichever side the wall happened to be drawn from,
      // and on doors too -- because the 28 Sep rebuild happened here and not
      // there. Two placements of one tag is the drift this repo keeps paying
      // for; the 0.55 ft gap was already written in both files.
      //
      // exteriorNormalAt WENT WITH IT. It had exactly one caller on this page
      // -- this tag -- so nothing is stranded and no second copy is made.
      // AND WITH NO OUTLINE, OFF THE WALL AWAY FROM THE LEVEL'S MIDDLE
      // (fen-labels planTagLine): hand-drawn walls carry no outline, and a
      // window on them went untagged (Movie, 16 Oct).
      const line = FL.openingTagLine(opening, geometry, outlineOf(opening.levelId),
        { centre: FL.wallsCentre(shown) });
      if (!line) return;
      // OFFSET 0, ON A LINE ALREADY MOVED OUTSIDE. labelAlongLine2D's own
      // offset is perpendicular in the ROTATED frame, and its read-direction
      // flip makes a->b and b->a the same angle -- so which side it lands on
      // cannot be chosen by handing it the line backwards. The side is decided
      // in the helper, where the outline knows which way is out, and
      // labelAlongLine2D is left to do the one thing only it does.
      const placed = R.labelAlongLine2D(ctx, toS(line.a), toS(line.b),
        label, { offset: 0, color: skin['ink-quiet'] || skin['draw-wall-edge'] });
      // WHERE IT LANDED, FROM THE PAINTER'S OWN MOUTH. The tag takes a press
      // now, and a hit test that worked the placement out a second time would
      // be a second copy of it -- right today and wrong the first morning the
      // tag moves. The helper hands back what it already computed.
      //
      // MEASURED HERE RATHER THAN IN THE HELPER: a width costs a measureText
      // per label, and of this page's labels only these take a click.
      if (live && placed && (isWindow || opening.garage !== true)) {
        windowTagHits.push({
          opening, label, cx: placed.cx, cy: placed.cy, angle: placed.angle,
          halfW: ctx.measureText(label).width / 2 + TAG_HIT_PAD,
          halfH: TAG_HIT_HALF_H,
        });
      }
    });
    ctx.restore();
  };

  // ── THE FIXTURES' AND CABINETS' MARKS (Movie, 23 and 24 Oct) ──────────
  //
  // "we should actually add a SIZE mark (30X60) etc to show the size, and
  // also allow the user to click on the size mark to change the size", and on
  // 24 Oct where each one goes:
  //   SHOWER, STALL  depth X width, just off the front edge, in the room
  //   TUB            inside it, near the open side -- one mark, its own size
  //   VANITY         inside it, at the front left ("sink left front of vanity")
  //   PEDESTAL       just off its front edge
  //   CABINETS       the width, inside the front edge, the numbers' foot to it
  //   SINK BASE      the width in the bowl: centred in a single, the left
  //                  bowl of a double, the bigger (right) of a 60/40
  //   UPPERS         the width just behind their dashed front line, toward
  //                  the wall, lighter grey
  // Left is the drafter's, standing in the room facing the piece. The
  // fixtures' marks take a press; the cabinets' only say.
  const paintFixtureMarks = (ctx, toS) => {
    const live = ctx.canvas === canvas;
    if (live) fixtureTagHits.length = 0;
    const marked = [];
    const R = window.DraftRender2D;
    const FL = window.DraftFenLabels;
    const FG = window.DraftFixtureGeometry;
    if (live) window.__fixtureTags = marked;
    // EVERY MARK SAID, for the specs: what it marks, what it says, where.
    const said = [];
    if (live) window.__sizeMarks = said;
    if (!R || !R.labelAlongLine2D || !FL || !FG) return;
    const std = sizeMarkStandards();
    const showFixtures = !std || std.fixtureSizes !== false;
    const showCabinets = !std || std.cabinetSizes !== false;
    if (!showFixtures && !showCabinets) return;
    const all = drawing?.walls || [];
    const metric = drawing?.units === 'metric';
    const say = ft => (metric ? String(FL.mmTo(ft, 5)) : String(Math.round(ft * 12)));
    const ink = skin['ink-quiet'] || skin['draw-wall-edge'];
    const env = {
      fixtureGeometry: fx => FG.fixtureGeometry(all, fx),
      hasUppers: fx => !!window.DraftFixtureKinds?.hasUppers(fx),
    };
    const list = fixtures();
    ctx.save();
    ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
    // A line along the piece at (along0..along1, across), moved `px` screen
    // pixels toward the piece's middle (negative: out into the room).
    const lineAt = (geo, along0, along1, across, px) => {
      const a = toS(geo.frame.at(along0, across)), b = toS(geo.frame.at(along1, across));
      const c = toS(geo.center);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const nl = Math.hypot(c.x - mx, c.y - my) || 1;
      const nx = (c.x - mx) / nl * px, ny = (c.y - my) / nl * px;
      return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }];
    };
    // ...or moved `px` toward the line at `toward` -- the uppers' mark goes
    // behind their dashed line, toward the wall (Movie, 24 Oct: "the 36 on
    // the upper cabinet move to be behind the dashed line (not on top)").
    const lineToward = (geo, along0, along1, across, toward, px) => {
      const a = toS(geo.frame.at(along0, across)), b = toS(geo.frame.at(along1, across));
      const t = toS(geo.frame.at(along0, toward));
      const nl = Math.hypot(t.x - a.x, t.y - a.y) || 1;
      const nx = (t.x - a.x) / nl * px, ny = (t.y - a.y) / nl * px;
      return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }];
    };
    const draw = ([a, b], label, color = ink, what = null, id = null) => {
      const placed = R.labelAlongLine2D(ctx, a, b, label, { offset: 0, color });
      if (placed && what) said.push({ what, id, label, cx: placed.cx, cy: placed.cy });
      return placed;
    };
    const take = (fx, label, placed) => {
      if (!placed) return;
      marked.push({ id: fx.id, label, cx: placed.cx, cy: placed.cy });
      if (live) {
        fixtureTagHits.push({
          fixture: fx, label, cx: placed.cx, cy: placed.cy, angle: placed.angle,
          halfW: ctx.measureText(label).width / 2 + TAG_HIT_PAD, halfH: TAG_HIT_HALF_H,
        });
      }
    };
    list.forEach(fx => {
      const geo = FG.fixtureGeometry(all, fx);
      if (!geo || !geo.frame) return;
      const a0 = geo.tub ? geo.tubAlongStart : geo.alongStart;
      const a1 = geo.tub ? geo.tubAlongEnd : geo.alongEnd;
      const P = (along, across) => toS(geo.frame.at(along, across));
      if (showFixtures && SIZE_MARKED_KINDS.has(fx.kind)) {
        const label = `${say(fx.depth)}X${say(a1 - a0)}`;
        if (fx.kind === 'tub') {
          take(fx, label, draw(lineAt(geo, a0, a1, geo.frontOff, SIZE_MARK_IN_PX), label));
        } else if (fx.kind === 'vanity') {
          // THE FRONT LEFT: a run along the front from the drafter's left
          // corner, as long as the mark and a little, with the mark on it.
          const leftLow = R.viewerLeftIsLow(P, a0, a1, geo.backOff, geo.frontOff);
          const [lo, hi] = lineAt(geo, a0, a1, geo.frontOff, SIZE_MARK_IN_PX);
          const [from, to] = leftLow ? [lo, hi] : [hi, lo];
          const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
          const reach = Math.min(len, ctx.measureText(label).width + 8);
          const end = { x: from.x + (to.x - from.x) / len * reach, y: from.y + (to.y - from.y) / len * reach };
          take(fx, label, draw([from, end], label));
        } else if (fx.kind === 'shower' || fx.kind === 'stall') {
          // INSIDE THE LIP (Movie, 25 Oct: "on the shower can the SIZE mark
          // be brought to the inside lip of the shower (right now its on the
          // outside of the lip"): just in from the pan's curb line, which
          // render-2d draws SHOWER_CURB_FT in from the front edge.
          const curb = geo.frontOff - (fx.side === -1 ? -1 : 1) * SHOWER_CURB_FT;
          take(fx, label, draw(lineAt(geo, a0, a1, curb, SIZE_MARK_IN_PX), label));
        } else {
          take(fx, label, draw(lineAt(geo, a0, a1, geo.frontOff, -SIZE_MARK_OFF_PX), label));
        }
      }
      if (!showCabinets) return;
      if (CABINET_MARKED_KINDS.has(fx.kind)) {
        // EACH RUN UNDER THE COUNTER, a stove standing in it cut out.
        (R.counterSpans2D ? R.counterSpans2D(fx, list, env) : [[a0, a1]]).forEach(([c0, c1]) => {
          if (c1 - c0 >= MARKED_RUN_MIN_FT) draw(lineAt(geo, c0, c1, geo.frontOff, SIZE_MARK_IN_PX), say(c1 - c0), ink, 'cabinet', fx.id);
        });
      } else if (fx.kind === 'sinkbase' || fx.kind === 'sink') {
        const leftLow = R.viewerLeftIsLow(P, a0, a1, geo.backOff, geo.frontOff);
        const bowls = R.sinkBowlSpans(a0, a1, R.sinkBowlsOf(fx), leftLow, fx.kind === 'sink' ? 0.15 : undefined);
        const [b0, b1] = bowls.spans[bowls.mark];
        draw(lineAt(geo, b0, b1, (geo.backOff + geo.frontOff) / 2, 0), say(a1 - a0), ink, 'sink', fx.id);
      }
      // THE UPPERS OVER IT, each run its own width, lighter.
      const spans = R.upperSpans2D ? R.upperSpans2D(fx, list, env) : [];
      if (spans.length) {
        const front = R.upperFrontOff2D(geo, fx);
        ctx.save();
        ctx.globalAlpha *= UPPER_MARK_ALPHA;
        spans.forEach(([u0, u1]) => {
          if (u1 - u0 >= MARKED_RUN_MIN_FT) draw(lineToward(geo, u0, u1, front, geo.backOff, SIZE_MARK_IN_PX), say(u1 - u0), ink, 'upper', fx.id);
        });
        ctx.restore();
      }
    });
    ctx.restore();
  };
  // "not as dark / grey" (Movie, 24 Oct): the uppers' marks, under the rest.
  const UPPER_MARK_ALPHA = 0.55;
  // A run shorter than this is a filler, and says nothing.
  const MARKED_RUN_MIN_FT = 6 / 12;

  // ── WHICH TAG IS UNDER THE POINTER ─────────────────────────────────────
  //
  // IN CSS PIXELS, the same space the press arrives in. toS and toWorld are
  // inverses in that space and the context carries the devicePixelRatio
  // transform, so a press compares to a placement with nothing scaled between
  // them. A ratio applied here would put every tag's target off by a factor of
  // two on the machines where it is hardest to notice.
  //
  // THE BOX IS ROTATED, BECAUSE THE TAG IS. A tag on a north wall and one on
  // an east wall are the same label turned ninety degrees, and an
  // axis-aligned box round the second would claim a patch of sheet it never
  // covered. The press is turned into the tag's own frame and tested there.
  //
  // LAST FIRST. Two windows close together can overlap tags, and the one
  // painted last is the one the drafter sees on top -- occlusion on this
  // sheet is paint order, so the pick runs the list backwards to agree with
  // the picture.
  const windowTagAt = (sx, sy) => {
    const hits = [...windowTagHits, ...fixtureTagHits];
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      const hit = hits[i];
      const dx = sx - hit.cx, dy = sy - hit.cy;
      const cos = Math.cos(-hit.angle), sin = Math.sin(-hit.angle);
      if (Math.abs(dx * cos - dy * sin) <= hit.halfW
        && Math.abs(dx * sin + dy * cos) <= hit.halfH) return hit;
    }
    return null;
  };

  // ── AND THE TAG IS WHERE YOU CHANGE IT ─────────────────────────────────
  //
  // Movie, 28 Sep: *"yes i want to change the window tags when you click on
  // them and that will also change the actual window soze"*. The label stopped
  // being a caption the moment it could be typed into.
  let windowTagEditor = null;
  const closeWindowTagEditor = () => {
    // NULLED BEFORE THE REMOVE, because removing a focused input fires blur
    // synchronously and blur closes the editor: cleared first, the re-entry
    // finds nothing to do instead of reaching through a half-removed node.
    const box = windowTagEditor;
    windowTagEditor = null;
    if (box) box.remove();
  };
  const editWindowSize = hit => {
    closeWindowTagEditor();
    const rect = canvas.getBoundingClientRect();
    const box = document.createElement('input');
    box.type = 'text';
    if (hit.fixture) box.dataset.fixtureSizeEntry = String(hit.fixture.id);
    else box.dataset.windowSizeEntry = String(hit.opening.id);
    // A DOOR'S BOX OPENS ON ITS WHOLE WIDTH: the tag may say both panels and
    // a height (D36/24 X 96), but what the box takes back is one number.
    const doorOpening = !hit.fixture && hit.opening?.type === 'door';
    box.value = doorOpening
      ? `D${drawing?.units === 'metric' ? window.DraftFenLabels.mmTo(hit.opening.width, 5)
        : Math.round((Number(hit.opening.width) || 0) * 12)}`
      : hit.label;
    Object.assign(box.style, {
      position: 'fixed', left: `${rect.left + hit.cx - 36}px`,
      top: `${rect.top + hit.cy - 11}px`, width: '72px', zIndex: '60',
      font: "600 12px 'Barlow Condensed', system-ui, sans-serif",
      textAlign: 'center',
    });
    document.body.append(box);
    windowTagEditor = box;
    box.focus();
    // SELECTED, so the first keystroke replaces the size rather than
    // appending to it. A drafter who clicks a tag means to state a new size,
    // not to edit the old one a character at a time.
    box.select();
    box.addEventListener('keydown', event => {
      // THE PAGE'S OWN SHORTCUTS MUST NOT FIRE while a size is being typed:
      // this canvas binds single letters to tools, so an unguarded `d` in a
      // box would arm a tool behind the drafter's back.
      event.stopPropagation();
      if (event.key === 'Enter') {
        const opening = hit.opening, fixture = hit.fixture, typed = box.value;
        closeWindowTagEditor();
        if (fixture) commitFixtureSize(fixture, typed);
        else commitWindowSize(opening, typed);
      }
      if (event.key === 'Escape') closeWindowTagEditor();
    });
    box.addEventListener('blur', closeWindowTagEditor);
    // A ZOOM MOVES EVERY TAG, so an open box stops describing the window it
    // was opened on: left standing it sits over a DIFFERENT window and still
    // writes to the first -- the drafter aims at one window and resizes
    // another, which nothing afterwards could explain. Nothing typed is lost,
    // because nothing is committed until Enter.
    //
    // ON THE WINDOW, NOT THE CANVAS. The box sits ON the tag, so a wheel
    // aimed at the tag is delivered to the BOX and never reaches the sheet
    // underneath -- a listener on the canvas looks right and never fires.
    // `once` takes it off again, and closing twice is already harmless.
    window.addEventListener('wheel', closeWindowTagEditor,
      { capture: true, once: true });
  };

  // WIDTH ABOUT THE CENTRE, HEIGHT DOWN FROM THE HEAD. Movie, 28 Sep: *"center
  // dimension line stays in same place enlarge outward from that point"*, and
  // for the height the head stays put while the sill drops.
  //
  // THE CENTRE COSTS NO CODE, which is worth saying out loud: `offset` IS the
  // centre -- clampOpeningToWall reserves width/2 either side of it -- so a
  // width change that leaves offset alone is already a change about the
  // centre line. Moving anything to "keep it centred" would move it off.
  //
  // THE HEAD IS THE DATUM for the same reason the placers are head-anchored:
  // heads line up across a wall and sills do not, so height is spent
  // downwards.
  // THE WIDEST THIS WALL CAN CARRY, said with a refusal (Movie, 20 Oct, on a
  // French pair that would not go to 5'-0" in a 5'-3" closet wall: "ok
  // that's why"). clampOpeningToWall is the one rule; this only asks it, to
  // the half inch, from the top down.
  const widestOpeningFt = wall => {
    const G = window.DraftGeometry2D;
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    const opts = { walls: walls(), thicknessFt: openingThicknessFt() };
    let lo = 0, hi = Math.floor(len * 24);
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (G.clampOpeningToWall(wall, len / 2, mid / 24, opts)) lo = mid; else hi = mid - 1;
    }
    return lo / 24;
  };
  const widestSaid = (wall, say) => {
    const most = widestOpeningFt(wall);
    return most > 0 ? ` The most it can take is ${say(most)}.` : ' It cannot take an opening at all.';
  };

  // THE SIZE MARK TYPED INTO (Movie, 23 Oct): "30X60" is 30" deep off the
  // wall by 60" along it -- depth first, as the mark reads. A tub that was
  // filling an alcove becomes a plain tub of the typed size. One UNDO.
  const commitFixtureSize = (fixture, text) => {
    const FL = window.DraftFenLabels;
    const metric = drawing?.units === 'metric';
    const nums = String(text ?? '').match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length !== 2 || !(Number(nums[0]) > 0) || !(Number(nums[1]) > 0)) {
      sayOnStrip(`${String(text).trim() || 'That'} is not a size \u2014 type it as `
        + (metric ? '760 X 1525, in millimetres' : '30 X 60, in inches') + ': depth first, then along the wall.');
      return;
    }
    const per = metric ? (FL?.MM_PER_FT || 304.8) : 12;
    const depth = Number(nums[0]) / per, width = Number(nums[1]) / per;
    const before = { ...fixture };
    fixture.depth = Number(depth.toFixed(4));
    fixture.width = Number(width.toFixed(4));
    if (fixture.kind === 'tub') { delete fixture.endWallId; delete fixture.dir; }
    undoStack.push({ kind: 'props', edits: [{ item: fixture, before }] });
    markDirty();
    paint();
    const K = window.DraftFixtureKinds;
    const name = K?.kindFor?.(fixture.kind)?.label || fixture.kind;
    sayOnStrip(`${name} is ${nums[0]} X ${nums[1]} \u2014 UNDO puts it back.`);
  };
  const commitWindowSize = (opening, text) => {
    const FL = window.DraftFenLabels;
    const G = window.DraftGeometry2D;
    if (!FL || !G) return;
    // IN THE DRAWING'S UNITS: the box opened on the tag as painted, so a metric
    // drawing hands back millimetres.
    const metric = drawing?.units === 'metric';
    const isDoor = opening.type === 'door';
    // A DOOR'S TAG IS ITS WIDTH ALONE -- D60 is sixty inches -- so it reads
    // one number, and its height stays what PROPERTIES says (Movie: "only
    // change height in properties").
    const doorWidth = () => {
      const nums = String(text ?? '').match(/\d+(?:\.\d+)?/g);
      if (!nums || nums.length !== 1 || !(Number(nums[0]) > 0)) return null;
      const widthFt = Number(nums[0]) / (metric ? FL.MM_PER_FT : 12);
      return { widthFt, heightFt: (Number(opening.headHeight) || 0) - (Number(opening.sillHeight) || 0) };
    };
    const size = isDoor ? doorWidth() : FL.parseWindowSize(text, { units: drawing?.units });
    const say = ft => (metric ? `${FL.mmTo(ft, 5)} mm` : `${Math.round(ft * 12)}"`);
    // REFUSE, DO NOT GUESS -- the numberField above keeps the same rule. A
    // size that cannot be read must never become a size nobody typed: this is
    // a drawing someone builds from.
    if (!size) {
      sayOnStrip(`${String(text).trim() || 'That'} is not a size — type it as `
        + (isDoor ? `${metric ? 'D 915, in millimetres' : 'D60, in inches'}.`
          : `${metric ? '915 X 1065, in millimetres' : '36 X 42, in inches'}.`));
      return;
    }
    const host = walls().find(wall => String(wall.id) === String(opening.wallId));
    if (!host) return;
    // THE WALL'S OWN REFUSAL, not a second guess at one. clampOpeningToWall
    // returns null when the run cannot carry the width with the bearing each
    // end needs -- and what each end needs depends on what stands there, which
    // is knowledge this file has no business holding a copy of.
    const fits = G.clampOpeningToWall(host, opening.offset, size.widthFt,
      { walls: walls(), thicknessFt: openingThicknessFt() });
    if (!fits) {
      brushWarn(`TOO BIG — ${say(size.widthFt)} is wider than this wall can carry.`
        + widestSaid(host, say), { opening });
      return;
    }
    const head = Number(opening.headHeight) || 0;
    const sill = head - size.heightFt;
    if (!(sill >= 0)) {
      sayOnStrip(`${say(size.heightFt)} tall would put the sill through the floor.`);
      return;
    }
    // ONE TYPED SIZE, ONE UNDO, carrying the two numbers a resize moves. The
    // record is mutated in place for the reason 'move-opening' gives in the
    // applier: every other reader holds this opening by reference, and
    // restoring a copy would detach them all.
    //
    // PUSHED ONLY IF SOMETHING ACTUALLY CHANGES, the same rule the slide
    // keeps -- a drafter who retypes the size a window already is should not
    // spend a Ctrl+Z on a step that does nothing visible.
    if (opening.width !== size.widthFt || opening.sillHeight !== sill) {
      undoStack.push({ kind: 'size-opening', opening,
        wasWidth: opening.width, wasSill: opening.sillHeight });
    }
    opening.width = size.widthFt;
    opening.sillHeight = sill;
    markDirty();
    paint();
  };

