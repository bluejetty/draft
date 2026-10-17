// LAYOUT plan viewports (board #168): pure helpers that turn a saved drawing's
// plan-level entities into ink on a sheet. Everything model-side stays in feet;
// the caller owns the model→screen transform (toS), built from the viewport's
// architectural scale (paper inches per model foot) and the sheet zoom. The
// wall painter is the shared DraftRender2D one; walls parsed from JSON get
// their shared corners re-interned so the identity-keyed join index works
// exactly as it does in the Model Space.
if (!window.DraftLayoutPlan) {
(() => {
  const { WALL_TYPES, LEGACY_WALL_TYPES } = window.DraftWallTypes;

  // ── SAID ONCE, AND SAID BY NAME ────────────────────────────────────────
  //
  // Both fallbacks below are the shape that cost this repo three defects on
  // 28 Sep: an absent module becomes an empty object or a null stage, the
  // sheet paints, drawPlan returns true, and nothing anywhere says a word.
  // The page looks finished and is missing a storey's worth of stairs.
  //
  // ONCE PER PAGE, NOT PER PAINT. These sit in a draw that runs on every
  // repaint, and sixty identical lines a second is a warning nobody reads.
  // cut-view.js keeps the same shape for its pattern modules.
  let warnedNoStandards = false;
  let warnedNoLayerViews = false;
  let warnedNoLayerStandards = false;
  let warnedNoLevelAssembly = false;

  const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);

  // Walls of one level as the PLAN context shows them: the level's own plan
  // walls plus its foundation structure (the foundation-level PLAN draws the
  // int walls against the poured concrete). Shared endpoints intern to one
  // point object per coordinate so the join index can key on identity.
  // `view` selects WHICH DRAWING of the level: 'plan' is the walls plan,
  // 'foundation' the concrete under it (board NEW-2 part 2). Passing null
  // means "every wall on this level", which is what this function did before
  // views existed -- a saved layout whose viewports carry no view therefore
  // composes byte-for-byte as it did, which the order requires. Only a
  // viewport that names its view gets filtered.
  //
  // Without that filter a FOUNDATION sheet draws the basement walls and the
  // concrete on top of each other, since both live on level 1.
  function planWalls(saved, levelId, view = null) {
    const interned = new Map();
    const intern = raw => {
      const x = num(raw?.x), z = num(raw?.z);
      if (x === null || z === null) return null;
      const key = `${Math.round(x * 4096)},${Math.round(z * 4096)}`;
      if (!interned.has(key)) interned.set(key, { x, y: 0, z });
      return interned.get(key);
    };
    return (Array.isArray(saved?.walls) ? saved.walls : [])
      .filter(wall => wall?.levelId === levelId)
      .filter(wall => view === null || (wall.view || 'plan') === view)
      .map(wall => {
        const start = intern(wall.start), end = intern(wall.end);
        if (!start || !end || start === end) return null;
        const wallType = WALL_TYPES.some(type => type.id === wall.wallType)
          ? wall.wallType
          : (LEGACY_WALL_TYPES[wall.wallType] || 'stud_2x6');
        return {
          id: wall.id,
          start,
          end,
          levelId,
          // WHICH DRAWING OF THE LEVEL THIS WALL BELONGS TO, carried rather
          // than dropped -- and dropping it was a silent hole for as long as
          // the view argument existed.
          //
          // THE FILTER RUNS TWICE. This function narrows to the view, and
          // then plan-composition's own `forLevel` narrows AGAIN on
          // `item.view` because it is handed every other collection raw. With
          // the field stripped here, the second pass read every wall as
          // 'plan' and threw out the entire foundation drawing -- an empty
          // sheet from a filter that had already done its job.
          //
          // It went unseen because no caller had ever passed a view: the
          // sheet page drew whole levels, so the second filter never had
          // anything to disagree with. The first caller to use the argument
          // (LAYOUT's FOUNDATION sheet, 23 Sep) got a blank page.
          view: wall.view || 'plan',
          wallType,
          refLine: ['left', 'right', 'center'].includes(wall.refLine) ? wall.refLine : 'left',
        };
      })
      .filter(Boolean);
  }

  function planOpenings(saved, levelId, walls) {
    const wallIds = new Set(walls.map(wall => wall.id));
    return (Array.isArray(saved?.fenestrations) ? saved.fenestrations : [])
      .filter(opening => opening?.levelId === levelId
        && wallIds.has(opening.wallId)
        && num(opening.offset) !== null
        && num(opening.width) > 0);
  }

  // Extents of the walls in model feet, outside faces included, so the
  // viewport centres on the drawn plan rather than on the reference lines.
  function wallBounds(walls) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    walls.forEach(wall => {
      const def = WALL_TYPES.find(type => type.id === wall.wallType) || WALL_TYPES[1];
      // A WHOLE ASSEMBLY EACH WAY, ON PURPOSE (audit 3.2 asked). A wall drawn
      // on its LEFT or RIGHT face puts all of its thickness on one side of
      // the line, and a mitred corner carries the outer face past the
      // endpoint by up to the same again -- so half would clip real ink.
      // The cost is a frame up to one wall thickness roomy on a centred wall,
      // which planBounds' callers pad over anyway.
      const reach = def.totalIn / 12;
      [wall.start, wall.end].forEach(pt => {
        minX = Math.min(minX, pt.x - reach); maxX = Math.max(maxX, pt.x + reach);
        minZ = Math.min(minZ, pt.z - reach); maxZ = Math.max(maxZ, pt.z + reach);
      });
    });
    if (minX > maxX) return null;
    return { minX, minZ, maxX, maxZ };
  }

  // ── WHAT A PLAN CLAIMS ON PAPER ──────────────────────────────────────────
  //
  // `wallBounds` above answers "where are the walls", and for a long time that
  // was also the answer to "how big is this viewport" -- which was right only
  // while walls were the only thing a sheet drew. They are not any more.
  //
  // THE MODEL SPACE ALREADY HAD THE SHAPE OF THIS ANSWER and it is followed
  // here rather than invented: MODEL.html's `allPoints` fits a plan over
  // WALLS, LINES, FLOORS, and -- when it needs the whole level -- ROOFS and
  // OUTLINES, with its own comment pointing at MODEL.dc.html:7269's thumbnail
  // bounds as where the five came from. A ROOF or SITE level holds no walls at
  // all, so a bounds over walls alone finds nothing there and frames the level
  // off the side of the sheet.
  //
  // AND THEN THE ONE THING IT NEEDED. Neither page counts DIMENSIONS, and on
  // screen that is correct -- a dimension string outside the fit is one pan
  // away, and including them would re-zoom every drawing the drafter opens.
  // A SHEET CANNOT PAN. What falls outside a viewport is not further away, it
  // is gone, and on Movie's own drawing the strings stand 3 to 4.5 ft outside
  // the walls they measure -- so the sheet was clipping off the very numbers
  // it exists to carry. Measured rather than allowed for, because 4.5 ft is
  // this drawing's answer and not every drawing's.
  //
  // WALLS STILL COUNT THEIR THICKNESS. A wall's record is its reference LINE,
  // and the ink is half an assembly either side of it, which is the whole
  // reason `wallBounds` exists and why this reuses it rather than reading
  // start and end points like the other four collections.
  //
  // LEVEL-WIDE, NO VIEW FILTER, matching what `_planBounds` already asked
  // `planWalls` for. A viewport sized over every view of a level is a superset
  // of the one drawing it shows, and for a FRAME a superset is safe in the one
  // direction that matters: it can be roomier than it needs, never tighter.
  // `floorBelow: false` is for a caller that does NOT draw the storey below --
  // the neighborhood's shell. The frame and the ink have to agree: a box sized
  // for a ghost nobody draws makes the house smaller on the page for nothing,
  // and a box that leaves out a ghost that IS drawn clips it off the paper.
  // The default is on, because every construction sheet draws it.
  function planBounds(saved, levelId, { floorBelow: withBelow = true } = {}) {
    // A FULL FLOOR'S FRAME TAKES IN ITS HALF-FLOOR, drawn on the same sheet.
    const half = halfLevelUnder(levelId);
    const box = wallBounds(planWalls(saved, levelId)
      .concat(half != null ? planWalls(saved, half) : []));
    let minX = box ? box.minX : Infinity, maxX = box ? box.maxX : -Infinity;
    let minZ = box ? box.minZ : Infinity, maxZ = box ? box.maxZ : -Infinity;
    const eat = pt => {
      const x = num(pt?.x), z = num(pt?.z);
      if (x === null || z === null) return;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    };
    const onLevel = key => (Array.isArray(saved?.[key]) ? saved[key] : [])
      .filter(item => item?.levelId === levelId);
    onLevel('lines').forEach(item => { eat(item.start); eat(item.end); });
    // A DIMENSION'S LABEL STRADDLES ITS LINE, so the outermost row needs room
    // past its own record or half its figure is clipped at the frame edge
    // (Movie's roof plan, 11 Oct: the 70'-0" overall cut in two).
    const DIM_LABEL_ROOM_FT = 1.5;
    const eatDimension = item => [item.start, item.end].forEach(pt => {
      const x = num(pt?.x), z = num(pt?.z);
      if (x === null || z === null) return;
      [-1, 1].forEach(sx => [-1, 1].forEach(sz =>
        eat({ x: x + sx * DIM_LABEL_ROOM_FT, z: z + sz * DIM_LABEL_ROOM_FT })));
    });
    onLevel('dimensions').forEach(eatDimension);
    // AND THE BEAM ROWS BORROWED FROM THE LEVEL UNDER, which the floor
    // layout draws (structureUnder) and which stand outside the walls.
    const under = structureUnder(saved, levelId);
    if (under) {
      (Array.isArray(saved?.dimensions) ? saved.dimensions : [])
        .filter(item => item?.levelId === under.levelId && item.view === under.view
          && item.layer === COLUMN_DIM_LAYER)
        .forEach(eatDimension);
    }
    ['floors', 'roofs', 'outlines'].forEach(key => onLevel(key)
      .forEach(item => (Array.isArray(item.points) ? item.points : []).forEach(eat)));
    // AND THE GHOST OF THE STOREY UNDERNEATH (Movie, 12 Oct: "adjust the
    // scale so the larger plan with the extra lightweight lines fits on the
    // upper floors (which are smaller without the background lines)"). The
    // viewport's scale is picked from this box, so an upper floor set back
    // from the one below has to carry it here or the ghost is drawn outside
    // the frame and clipped — which on screen is a pan and on paper is gone.
    if (withBelow) ghostLoops(saved, levelId).forEach(points => points.forEach(eat));
    // AND WHAT HANGS OVER THE WALLS PLAN -- the cantilever above and the
    // roof overhang (overhead-lines.js) -- which by definition lie outside
    // the walls and would otherwise be clipped at the frame.
    if (window.DraftOverheadLines && window.DraftLevelAssembly && window.DraftLayerViews) {
      const LA = window.DraftLevelAssembly;
      const lines = window.DraftOverheadLines.overheadLines({
        levelId,
        ladder: window.DraftLayerViews.floorLevels(Array.isArray(saved?.levels) ? saved.levels : [])
          .map(level => Number(level.id))
          .filter(id => !LA.STOREY_NUMBER || !(id in LA.STOREY_NUMBER) || Number.isInteger(Number(LA.STOREY_NUMBER[id]))),
        outlines: Array.isArray(saved?.outlines) ? saved.outlines : [],
        roofs: Array.isArray(saved?.roofs) ? saved.roofs : [],
      });
      [...lines.cantilevers, ...lines.overhangs].forEach(seg => { eat(seg.start); eat(seg.end); });
    }
    // THE SITE SHEET FRAMES WHAT THE SITE SHEET DRAWS. Its own level carries
    // the lot and nothing else, so sizing it level-by-level like a storey
    // would cut the building off the page -- and a building that does not fit
    // its lot (the case that started all this) is exactly when a drafter
    // needs to see both.
    if (num(levelId) === SITE_LEVEL_ID) {
      const parts = sitePlanParts(saved);
      [...parts.bodies, ...parts.roofs].forEach(item => item.points.forEach(eat));
    }
    if (minX > maxX) return null;
    return { minX, minZ, maxX, maxZ };
  }

  // ── THREE TWINS RETIRED HERE, and naming them is the point ───────────────
  //
  // This file used to carry its own `wallJoins` (68 lines), its own
  // `openingGeometry` (45) and its own `drawOpening2D` (90) -- a second copy
  // of each, beside the shared ones in geometry-2d.js and render-2d.js that
  // the Model Space draws with. Its own header called it out and then did it
  // anyway: "the wall painter is the shared DraftRender2D one".
  //
  // WHAT THAT COST WAS NOT LINES, IT WAS AGREEMENT. A door on a construction
  // sheet and the same door on the drafter's screen were drawn by two
  // different painters and placed by two different clamps -- the shared
  // `openingGeometry` clamps an opening against its NEIGHBOURING WALLS
  // (`clampOpeningToWall` takes the whole wall list), this file's twin clamped
  // it between two fixed jamb margins and knew nothing about neighbours. Two
  // answers to "where does this window sit", and the sheet is the one that
  // goes to site.
  //
  // WHAT THIS FILE KEEPS is the half that is genuinely its own: turning SAVED
  // JSON into entities the painters can take -- interning shared corners so
  // the identity-keyed join index works, resolving legacy wall types, and
  // filtering to a level and a view. That is parsing, not drawing, and it has
  // no twin anywhere.

  // The opening clamp needs a wall's total thickness as a function, because
  // the shared geometry asks per wall rather than being told once.
  // THE MODEL SPACE'S OWN LOOK, carried rather than re-chosen: these are the
  // literals MODEL.dc.html:17038 passes its floor painter and :8899 its
  // dimension painter. A sheet that picked its own blues would be a second
  // opinion about what a floor looks like, which is the whole disease this
  // file is being cured of.
  const FLOOR_COLORS = Object.freeze({
    fill: 'rgba(89,128,166,0.16)',
    fillPreview: 'rgba(89,128,166,0.12)',
    stroke: '#47779a',
    strokePreview: 'rgba(89,128,166,0.72)',
    selected: '#5980a6',
  });
  // MODEL.dc.html:2462's own STAIR_COLOR, carried for the same reason as the
  // floor blues above -- a stair drawn violet on screen and some other colour
  // on the sheet is two opinions about one object.
  const STAIR_COLOR = '#5d4a8a';
  // MODEL.dc.html:2518 and :15703. The fill is a translucent white so a
  // fixture reads as a solid object over the floor tint without hiding the
  // wall behind it.
  const FIXTURE_COLOR = '#1d1f20';
  const FIXTURE_FILL = 'rgba(255,255,255,0.65)';
  const DIMENSION_COLORS = Object.freeze({
    stroke: '#365e86',
    selected: '#5980a6',
    selectedHalo: 'rgba(89,128,166,0.35)',
    preview: 'rgba(89,128,166,0.58)',
    labelBack: 'rgba(255,255,255,0.92)',
  });

  const thicknessFt = wall =>
    ((WALL_TYPES.find(type => type.id === (wall.wallType || 'stud_2x6')) || WALL_TYPES[1])
      .totalIn / 12);

  // Paint one plan viewport. The ORDER and the FILTERING are
  // plan-composition.js's now, shared with the Model Space; this builds the
  // env that composition draws through.
  //
  // `padFt` IS THE ZOOM FACT, not a geometry one, and it arrives from the
  // caller for that reason: the wall boundary stroke is centred on the face,
  // so an opening's gap has to reach a little past each face to interrupt it,
  // and "a little" is a couple of SCREEN pixels. The sheet owns its camera.
  // ── THE ROOF PLAN SHEET ──────────────────────────────────────────────────
  //
  // Movie, 6 Oct: "yes lets do the roof plan sheet" -- the ROOF PLAN sheet was
  // dealt by name and left blank, because this painter drew a level only
  // through its walls and the roof level has none. It draws what the Model
  // Space's roof plan draws (MODEL.html paintRoofs): every roof on the level,
  // each stopped at the outside face of a storey whose own roof stands over
  // it, and the tops of the exterior walls each roof stands on, thin and solid
  // (geometry-2d roofBearing, render-2d drawWallTops2D). False when the level
  // has no roofs either, so a caller still learns there was nothing to draw.
  // The plate line's ink on paper: MODEL.dc.html's own, like every other
  // literal in this file.
  const ROOF_PLATE_INK = '#1d1f20';

  function drawRoofPlan(ctx, toS, saved, levelId, env = {}) {
    const geo = window.DraftGeometry2D;
    const render = window.DraftRender2D;
    if (!geo || !render) return false;
    const of = key => (Array.isArray(saved?.[key]) ? saved[key] : []);
    const roofs = of('roofs').filter(roof => roof?.levelId === levelId
      && Array.isArray(roof.points) && roof.points.length >= 3);
    if (!roofs.length) return false;
    const openings = of('surfaceOpenings');
    const roofEnv = {
      isPrinting: true,
      offsetOutline: (pts, dist) => geo.offsetOutline(pts, dist),
      offsetOutlineVariable: (pts, dists) => geo.offsetOutlineVariable(pts, dists),
      roofSkeleton: geo.roofSkeleton,
      cutRoofSegment: geo.cutRoofSegment,
      roofWelds: roof => geo.roofWeldSpans(roof, roofs),
      roofHidden: roof => geo.roofHiddenSpans(roof, roofs),
      surfaceOpeningsFor: (hostType, hostId) => openings.filter(opening =>
        opening.hostType === hostType && opening.hostId === hostId
        && Array.isArray(opening.points) && opening.points.length >= 3),
    };
    const bearing = new Map((geo.roofBearing ? geo.roofBearing({
      roofs, walls: of('walls'), outlines: of('outlines'), levels: of('levels'),
    }) : []).map(b => [b.roof, b]));
    roofs.forEach(roof => {
      const b = bearing.get(roof);
      render.drawRoof2D(ctx, toS, roof, b && b.exclude.length ? { exclude: b.exclude } : {}, roofEnv);
    });
    const thicknessFt = wall => {
      const type = WALL_TYPES.find(t => t.id === wall.wallType)
        || WALL_TYPES.find(t => t.id === LEGACY_WALL_TYPES[wall.wallType])
        || WALL_TYPES.find(t => t.id === 'stud_2x6');
      return (type ? type.totalIn : 5.5) / 12;
    };
    // ── THE PLATES THE ROOF RESTS ON, IN THE CALLER'S INK ─────────────────
    //
    // Movie, 14 Oct: "please show the outline of the top plates of walls that
    // the roof rests on that are n the roof plan - show those lines also in
    // the site plane".
    //
    // THEY WERE ALREADY BEING DRAWN ON BOTH, in `#1d1f20` -- MODEL.dc.html's
    // paper ink, which is right on a sheet and is BLACK ON A BLACK GROUND on
    // MODEL's own site plan. So the lines he was asking for were under his
    // cursor and invisible: the sheet had them, the screen painted them into
    // the dark. The same thing the property line and the site dimension rows
    // were handed their ink for, two reports earlier the same day, and for
    // exactly the same reason.
    //
    // THE DEFAULT IS STILL PAPER. A caller that says nothing gets what every
    // construction sheet has always drawn; only a caller painting on its own
    // ground has to say so.
    if (render.drawWallTops2D && geo.roofPlanWalls) {
      render.drawWallTops2D(ctx, toS, geo.roofPlanWalls({
        walls: of('walls'), outlines: of('outlines'), floors: of('floors'), levels: of('levels'),
      }), { thicknessFt, color: env.wallTopInk || ROOF_PLATE_INK },
      { wallFaceOffsets: geo.wallFaceOffsets });
    }
    // AND ITS DIMENSIONS (Movie, 11 Oct: "can we add the dimensions to the
    // roof plan"). The roof level's strings -- overhang and wall faces, roof
    // edge to roof edge, the full length -- are stored on the level like any
    // plan's, and this sheet left them behind. Last, over what they measure,
    // and only on a construction sheet: a listing, a shell and a hologram
    // carry no dimensions on any other sheet either.
    if (render.drawDimension2D && env.shell !== true && env.listing !== true
      && env.hologram !== true && env.siteFootprint !== true) {
      const fmt = window.DraftFormatters || {};
      const dimensionEnv = {
        label: ft => fmt.formatArchitecturalInches(ft * 12),
        colors: DIMENSION_COLORS,
        atLine: true,
        // Paper units: the sheet zoom over its print zoom (render-2d).
        inkScale: env.inkScale,
      };
      of('dimensions').filter(dimension => dimension?.levelId === levelId).forEach(dimension => {
        if (ctx && 'dxfLayer' in ctx) ctx.dxfLayer = dimension.layer || 'A-DIMS';
        render.drawDimension2D(ctx, toS, dimension, {}, dimensionEnv);
      });
    }
    return true;
  }

  // THE SPLIT'S HALF-FLOORS RIDE ON THEIR FULL FLOOR (Movie, 7 Oct): "in
  // layout areas we will only need to show the MAIN floors" -- the 0.5 floor
  // is drawn on MAIN FL's sheet and the 1.5 floor on 2ND FL's, "slightly
  // lighter in shade ... and if any lines are on top of each other the 2nd
  // floor lines should overrule". Walls, windows, doors and stairs only.
  //
  // THE PAIRING IS READ OFF THE LADDER, NOT LISTED HERE (Movie, 14 Oct):
  // "if there are any 3rd floors added in the future i will also want to
  // present it that way for all the layouts". This was `{3: 2, 5: 4}`, a
  // second copy of what level-assembly.js's STOREY_FLOOR already says -- 2
  // and 3 are both MAIN FL, 4 and 5 are both 2ND FL -- so a 2.5 floor added
  // to that table would have folded nowhere until somebody remembered this
  // line as well. Derived, the ladder stays the one place a storey is
  // described, and every list that asks follows it the same day.
  //
  // WITHIN A STOREY THE HIGHER ID IS THE FULL FLOOR. That is the ladder's
  // own rule -- level-assembly's `storeyHeadOf` takes the highest id of the
  // storey -- and it is why these two are a `max` and a `min` rather than a
  // lookup: the half floor is the mate BELOW, the full floor the mate ABOVE.
  const storeyMates = levelId => {
    const LA = window.DraftLevelAssembly;
    if (!LA || !LA.STOREY_FLOOR || typeof LA.sameStorey !== 'function') return [];
    return Object.keys(LA.STOREY_FLOOR).map(Number).filter(Number.isFinite)
      .filter(other => other !== Number(levelId) && LA.sameStorey(other, levelId));
  };
  // The half floor drawn on this level's sheet, or null for a level that is
  // not a storey's head.
  const halfLevelUnder = levelId => {
    const below = storeyMates(levelId).filter(id => id < Number(levelId));
    return below.length ? Math.max(...below) : null;
  };
  // And the other way round: the full floor a half floor rides on.
  const fullFloorOver = levelId => {
    const above = storeyMates(levelId).filter(id => id > Number(levelId));
    return above.length ? Math.min(...above) : null;
  };
  const HALF_LEVEL_SHEET_ALPHA = 0.6;

  // ── THE STOREY UNDER THIS ONE, GHOSTED (Movie, 12 Oct) ─────────────────
  //
  // "we should also show a very lightweight line that shows that ext wall
  // outlines of the wlls below and then adjust the scale so the larger plan
  // with the extra lightweight lines fits on the upper floors (which are
  // smaller without the background lines)" -- "it gives the user a better
  // visual underatanding of what they are looking at".
  //
  // THE SAME SHAPE AS THE BASEMENT'S FOUNDATION, one storey up. His 7 Oct
  // ruling below -- "show the FOUNDATION WALL (slightly lighter ...)" -- is
  // this request with the levels swapped, so it is answered the same way:
  // drawn first so every real line is over it, at a lower alpha, and taken
  // into the frame so it cannot be clipped off the paper.
  //
  // OUTLINES, NOT WALLS, and that is forced rather than preferred. "Ext wall
  // outlines" needs to know which walls are exterior and NOTHING IN A DRAWING
  // SAYS: A-WALL-EXT and A-WALL-INT are in the standards table and no code
  // has ever put a wall on either (auto-dims.js writes the same sentence
  // where it meets the same wall). An OUTLINE is the traced footprint the
  // house was built from, so it already IS the exterior line -- closed, and
  // carrying its garages. A level drawn wall by wall with no outline gets NO
  // ghost rather than a guessed one, which is why `floorBelow` keeps looking
  // down for a storey that has one.
  //
  // WHICH LEVEL IS "BELOW" COMES FROM THE LADDER THAT ALREADY EXISTS:
  // level-assembly.js's STOREY_NUMBER, ids ascending with height, kept in one
  // place precisely so each page does not keep its own answer. FOUNDATION,
  // ROOF and SITE carry no storey number -- "a number here means a floor to
  // stand on and they are not floors" -- so none of them is ever the floor
  // below. That is deliberate for the foundation: it sits under MAIN FL on
  // the same footprint, the BASEMENT sheet already draws it (below), and a
  // second line on top of the first would be ink for nothing.
  //
  // THE HALF-FLOOR IS SKIPPED because it is already on this sheet, in full,
  // at HALF_LEVEL_SHEET_ALPHA. 2ND FL therefore shows 1.5 the way it always
  // did and MAIN FL under the pair as the ghost -- the storey below, not the
  // half of this one.
  //
  // ON EVERY VIEW OF THE LEVEL, not just 'plan'. `planBounds` is cached per
  // LEVEL and has no view to go on, so a ghost drawn on some views and not
  // others would mean a frame sized for ink that is not there. Drawing it
  // wherever the frame allows for it keeps the two exactly in step, and the
  // orientation it gives is as useful on a FLOOR LAYOUT as on a plan.
  const GHOST_BELOW_ALPHA = 0.3;
  // The page is white paper and takes MODEL.dc.html's ink literal, the same
  // way `structureEnv` below does.
  const GHOST_BELOW_INK = '#1d1f20';

  const outlineLoopsOn = (saved, levelId) =>
    (Array.isArray(saved?.outlines) ? saved.outlines : [])
      .filter(outline => outline?.levelId === levelId
        && Array.isArray(outline.points) && outline.points.length >= 3)
      .map(outline => outline.points);

  function floorBelow(saved, levelId) {
    // SAID BY NAME IF THE LADDER IS NOT THERE. This is the shape the header
    // of this file names: an absent module reads as an empty object, the
    // ladder comes back empty, every floor quietly has nothing below it, and
    // the sheet looks finished. Once per page, like the three above it.
    const assembly = window.DraftLevelAssembly;
    if (!assembly || !assembly.STOREY_NUMBER) {
      if (!warnedNoLevelAssembly) {
        warnedNoLevelAssembly = true;
        console.warn('layout-plan: level-assembly.js is missing, so no plan can '
          + 'show the storey below it. Load it before this file.');
      }
      return null;
    }
    const ladder = Object.keys(assembly.STOREY_NUMBER)
      .map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!ladder.includes(levelId)) return null;
    const half = halfLevelUnder(levelId);
    const under = ladder.filter(id => id < levelId && id !== half);
    for (let i = under.length - 1; i >= 0; i -= 1) {
      if (outlineLoopsOn(saved, under[i]).length) return under[i];
    }
    return null;
  }

  // The loops an upper floor shows the storey under it by, or [] for a level
  // that has nothing under it to show.
  function floorBelowLoops(saved, levelId) {
    const below = floorBelow(saved, levelId);
    return below == null ? [] : outlineLoopsOn(saved, below);
  }

  // THE BUILDING'S FOOTPRINT -- the house and its garage, as the lowest
  // storey that has outlines draws them (Movie, 16 Oct: a faded footprint
  // line on every PLAN-view page, the same scale page to page, so the pages
  // read as one building). Not the lot line, which is the SITE's.
  //
  // THE GROUND STOREY IS READ OFF THE SAME LADDER floorBelow reads
  // (level-assembly's STOREY_NUMBER), and it is the lowest FULL storey that
  // has outlines: a bilevel's ENTRY landing is half a storey and not the
  // building's footprint. Without the ladder there is no footprint, for the
  // reason floorBelow gives: a ghost of a guessed level is worse than none.
  function footprintLoops(saved) {
    const assembly = window.DraftLevelAssembly;
    if (!assembly || !assembly.STOREY_NUMBER) return [];
    const storeys = Object.keys(assembly.STOREY_NUMBER)
      .filter(id => Number.isInteger(Number(assembly.STOREY_NUMBER[id])))
      .map(Number).filter(Number.isFinite).sort((lo, hi) => lo - hi);
    const ground = storeys.find(id => outlineLoopsOn(saved, id).length);
    if (ground == null) return [];
    return (Array.isArray(saved?.outlines) ? saved.outlines : [])
      .filter(outline => outline?.levelId === ground && outline.site !== true
        && Array.isArray(outline.points) && outline.points.length >= 3)
      .map(outline => outline.points);
  }

  // WHAT A PLAN PAGE GHOSTS UNDER ITSELF: the storey below (12 Oct) and the
  // building's footprint (16 Oct), each loop once, and none this level
  // already draws as its own outline -- a ghost under the same line is ink
  // for nothing.
  function ghostLoops(saved, levelId) {
    const key = points => JSON.stringify(points.map(pt => [Math.round(num(pt?.x) * 100) / 100, Math.round(num(pt?.z) * 100) / 100]));
    const own = new Set(outlineLoopsOn(saved, levelId).map(key));
    const seen = new Set();
    return [...floorBelowLoops(saved, levelId), ...footprintLoops(saved)].filter(points => {
      const k = key(points);
      if (own.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function drawFloorBelowGhost(ctx, toS, saved, levelId) {
    const loops = ghostLoops(saved, levelId);
    if (!loops.length) return;
    ctx.save();
    ctx.globalAlpha *= GHOST_BELOW_ALPHA;
    ctx.strokeStyle = GHOST_BELOW_INK;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    loops.forEach(points => {
      ctx.beginPath();
      points.forEach((pt, index) => {
        const p = toS(pt);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  }

  // A HALF-FLOOR GETS NO SHEET OF ITS OWN once its full floor has walls to
  // carry it; alone (no full floor drawn yet) it still prints by itself.
  // The basement plan's faded foundation: the house's walls, not the garage's.
  const BASEMENT_LEVEL_ID = 1;
  const BASEMENT_FOUNDATION_ALPHA = HALF_LEVEL_SHEET_ALPHA;
  function basementGhostKeeps(saved, wallId) {
    const wall = (Array.isArray(saved?.walls) ? saved.walls : []).find(item => item?.id === wallId);
    return !!wall && wall.body !== 'garage';
  }

  // THE JOIST CALLOUTS OF A LEVEL'S DECK, for the composer to paint
  // (render-2d drawJoistSpans2D): build-house joistBays per floor body, with
  // the beams filed on the level under (`under`, structureUnder's answer),
  // the holes in this deck, and the label off the schedule.
  function joistCalloutsFor(saved, levelId, under) {
    const B = window.DraftBuildHouse;
    const LA = window.DraftLevelAssembly;
    const VIEWS = window.DraftLayerViews;
    if (!B || typeof B.joistBays !== 'function' || !LA || !VIEWS) return [];
    const of = key => (Array.isArray(saved?.[key]) ? saved[key] : []);
    const beams = under ? of('beams').filter(beam => beam?.levelId === under.levelId && beam.view === under.view) : [];
    const holes = of('surfaceOpenings').filter(opening => opening?.levelId === levelId
      && opening.hostType === 'floor' && Array.isArray(opening.points) && opening.points.length >= 3);
    const ladder = VIEWS.floorLevels(of('levels')).map(level => Number(level.id));
    const at = ladder.indexOf(Number(levelId));
    const below = new Set(at < 0 ? [] : ladder.slice(0, at));
    const garages = of('outlines').filter(outline => outline?.garage === true
      && below.has(Number(outline.levelId)) && Array.isArray(outline.points) && outline.points.length >= 3);
    const wallById = new Map(of('walls').map(wall => [String(wall.id), wall]));
    const doorPoints = of('fenestrations').filter(fen => fen?.garage === true)
      .map(fen => wallById.get(String(fen.wallId))).filter(wall => wall?.start && wall?.end)
      .map(wall => ({ x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }));
    const label = B.joistCallout(LA.levelAssemblyFor(saved?.levelAssemblies, levelId));
    // THE BODIES AUTO BEAM FRAMES -- the level's outlines, the garage's own
    // aside -- so the callout and the beam plan read one deck. A floor
    // record can carry a stair landing's tab past the room, and its box is
    // then wider than any joist spans; the floors stand in only where a
    // level has no outline.
    const bodies = of('outlines').filter(outline => outline?.levelId === levelId && outline.garage !== true
      && outline.site !== true && Array.isArray(outline.points) && outline.points.length >= 3);
    const decks = bodies.length ? bodies : of('floors').filter(floor => floor?.levelId === levelId
      && (floor.view || 'floor') === 'floor' && floor.garage !== true
      && Array.isArray(floor.points) && floor.points.length >= 3);
    return decks
      .map(floor => {
        const points = floor.points.map(pt => ({ x: num(pt.x), z: num(pt.z) }));
        const bays = B.joistBays(points, { beams, holes, axis: B.deckJoistAxis(points, { garages, doorPoints }) });
        return bays ? { ...bays, label } : null;
      }).filter(Boolean);
  }

  // A level's FLOOR LAYOUT: the floors filed on its 'floor' view.
  function hasFloorLayout(saved, levelId) {
    return (Array.isArray(saved?.floors) ? saved.floors : []).some(floor =>
      floor?.levelId === levelId && (floor.view || 'floor') === 'floor'
      && Array.isArray(floor.points) && floor.points.length >= 3);
  }

  // ── WHAT HOLDS A FLOOR UP IS ON ITS SHEET ────────────────────────────────
  //
  // Movie, 12 Oct: "the beam BELOW the floor should show on the main floor
  // (the exact same one as in the basement) and on the 2nd floor layout the
  // MAIN FLOOR beam and colms should show", all at normal weight, with their
  // AUTO DIMS rows.
  //
  // A BEAM IS STORED ON THE LEVEL IT STANDS ON, not the floor it carries:
  // placeAutoBeam files the main floor's beam on FOUNDATION / foundation and
  // the 2nd floor's on MAIN FL / floor (MODEL.html floorCarriedBy). So a
  // floor layout borrows the structure of the level under it -- FOUNDATION
  // for the lowest floor, the floor below for every other -- and no longer
  // draws its own, which is the next floor up's.
  //
  // NULL WHEN THE DRAWING CANNOT SAY, which keeps the sheet drawing its own
  // structure the way it did: a drawing with no levels list, or a level that
  // carries no floor.
  const COLUMN_DIM_LAYER = 'A-DIMS-COLS'; // auto-dims.js DIM_LAYERS.COLUMNS
  function structureUnder(saved, levelId) {
    const VIEWS = window.DraftLayerViews;
    if (!VIEWS || typeof VIEWS.floorLevels !== 'function') return null;
    const floors = VIEWS.floorLevels(Array.isArray(saved?.levels) ? saved.levels : []);
    const at = floors.findIndex(level => Number(level?.id) === Number(levelId));
    if (at < 0) return null;
    if (at === 0) return { levelId: BASEMENT_LEVEL_ID, view: 'foundation' };
    return { levelId: Number(floors[at - 1].id), view: 'floor' };
  }

  function ridesOnFullFloor(saved, levelId) {
    const full = fullFloorOver(levelId);
    return full != null && planWalls(saved, Number(full)).length > 0;
  }

  // ── THE SITE PLAN ────────────────────────────────────────────────────────
  //
  // Movie, 14 Oct, having drawn a lot and gone to the layout: "i tried to do
  // the site plan in the layout area - it should pop up a viewport with the
  // new site plan, (nothing happens) i tried to RE-DEAL the sheets, and it
  // still didn't pop up a site plan" -- and, before that, "also show a
  // 'footprint shape' of the building on the site plan. is that possible".
  //
  // THE SHEET WAS DEALT AND EMPTY ON PURPOSE, until there was something to
  // put on it: SITE PLAN is one of the names the set deals "even with nothing
  // to draw on it", because a set with towns missing teaches the wrong shape.
  // The lot arrived on 13 Oct and nobody came back to this.
  //
  // WHAT A SITE PLAN IS, HERE: the lot line, the building's footprint inside
  // it, and the eave line the footprint sits under -- which is the drawing
  // his own setback question is asked of ("for that 30 for garage with 2ft
  // overhangs would be min 38 min"): the eave is what comes closest to the
  // property line, so it is the line that has to be on the sheet.
  const SITE_LEVEL_ID = 8;
  const SITE_FOOTPRINT_FILL = 'rgba(29,31,32,0.10)';
  // THE HOUSE'S OWN AREA, DARKER (Movie, 14 Oct): "perrhaps the FOOTPRINT
  // area of the house could be darker shading too (everything withing
  // interior walls". Over the roof plan rather than under it, because the
  // roof's own planes are filled and would bury a tone laid first -- and a
  // translucent wash over line work is what a hatch is anyway: the ridges and
  // hips still read through it.
  const SITE_INSIDE_FILL = 'rgba(29,31,32,0.22)';

  // ── THE PROPERTY LINE ─────────────────────────────────────────────────
  //
  // Movie, 14 Oct: "can we make the SITE OUTLINE for the property THICK BLACK
  // LINES on the layout for contruction plan and on the NIGHT make them
  // bright thick white and make the long DASH and THICK DOT - LONG DASH -
  // THICK DOT repeated over and over".
  //
  // THAT IS THE SURVEYOR'S LINE, and it is the one line on a site plan that
  // is read before anything else: every setback on the sheet is measured to
  // it. It was a plain 2px solid stroke in the page's grey-black, which on a
  // sheet carrying a roof plan and a wall outline read as one more edge.
  //
  // THE DOT IS A ZERO-LENGTH DASH UNDER A ROUND CAP, which is how a canvas
  // draws a round dot on a dashed line -- a short dash would be a tick, and
  // ticks and dashes at the same weight read as a broken line rather than as
  // dash-dot. The cap also adds half the width to each end of the long dash,
  // so the gaps are written longer than they look to compensate.
  //
  // IN PAPER UNITS where the sheet has them: a site plan is drawn at 1:200 or
  // thereabouts, and a pattern in screen pixels would be a different pattern
  // on every zoom.
  const SITE_LINE_INK = '#000000';
  const SITE_LINE_W = 3;
  const SITE_LINE_DASH = Object.freeze([14, 8, 0, 8]);

  // ── THE TWO ROWS OUTSIDE THE PROPERTY LINE ────────────────────────────
  //
  // Movie, 14 Oct: "the dimensions which i will also add to the outside of the
  // site lines. we need the front to back and side to side FULL dimensions of
  // the site on the outmost dimension and on the inner dimension we need the
  // location of the hosue from front of site, width of house and then to the
  // back of the site and same for hosue position side to side ... (make it 3ft
  // from the property line on the outside for the first dimension position and
  // then 2ft future for the outside dimensino line".
  //
  // THE HOUSE'S POSITION READS NEAREST THE LOT and the lot's own size reads
  // outside it, which is the order a reader wants: the setback you check
  // against the bylaw sits beside the line it is measured to.
  //
  // IN FEET, NOT PIXELS. These are distances on the ground like the setbacks
  // beside them, so the rows hold their spacing at every zoom and every sheet
  // scale; a pixel offset would crowd the lot on a small viewport and drift
  // off the paper on a large one.
  const SITE_DIM_FIRST_FT = 3;
  const SITE_DIM_GAP_FT = 2;
  const SITE_DIM_OUTER_FT = SITE_DIM_FIRST_FT + SITE_DIM_GAP_FT;

  const boxOfPoints = points => (points.length ? {
    minX: Math.min(...points.map(pt => pt.x)), maxX: Math.max(...points.map(pt => pt.x)),
    minZ: Math.min(...points.map(pt => pt.z)), maxZ: Math.max(...points.map(pt => pt.z)),
  } : null);

  // WHICH WAY IS THE FRONT. E1 is the front of the house and of the lot, and
  // cut-marks owns which compass side that is once the plan has been turned --
  // so the rows are built off its answer rather than off a hardcoded "front is
  // +z", which would stand both of them on the wrong edges of a turned site.
  const siteAxes = planTurn => {
    const CM = window.DraftCutMarks;
    const dir = id => (CM && typeof CM.eMarkDir === 'function' ? CM.eMarkDir(id, planTurn) : null);
    return { front: dir('E1') || { x: 0, z: 1 }, left: dir('E2') || { x: -1, z: 0 } };
  };

  // ONE ROW: the stops along `axis`, on a line whose other coordinate is
  // `lineAt` for all of them -- which is what makes a row a row. A stop pair
  // closer than a quarter inch is dropped rather than drawn as a zero: a house
  // built to the property line is legal and common, and "0" against the line
  // it is built on tells a reader nothing.
  const siteChain = (stops, axis, lineAt, row) => {
    const out = [];
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (Math.abs(stops[i + 1] - stops[i]) < 0.02) continue;
      out.push({
        start: axis === 'z' ? { x: lineAt, z: stops[i] } : { x: stops[i], z: lineAt },
        end: axis === 'z' ? { x: lineAt, z: stops[i + 1] } : { x: stops[i + 1], z: lineAt },
        axis,
        row,
      });
    }
    return out;
  };

  // THE SITE'S OWN DIMENSION STRINGS, generated rather than stored: they
  // restate the lot and the building, and the drafter edits both by dragging
  // -- a stored copy would be a second record of the same two boxes, going
  // stale between drags. Exported so MODEL paints the same rows on screen and
  // seats its elevation marks clear of them.
  function siteDimStrings(saved) {
    const { lot, bodies } = sitePlanParts(saved);
    if (!lot) return [];
    const lotBox = boxOfPoints(lot.points);
    if (!lotBox) return [];
    const houseBox = boxOfPoints(bodies.flatMap(body => body.points));
    const { front, left } = siteAxes(num(saved?.planTurn) || 0);
    const rows = [];
    const build = (axis, side) => {
      const lo = axis === 'z' ? lotBox.minZ : lotBox.minX;
      const hi = axis === 'z' ? lotBox.maxZ : lotBox.maxX;
      const across = axis === 'z' ? 'x' : 'z';
      const sign = Math.sign(across === 'z' ? side.z : side.x) || -1;
      const edge = sign > 0
        ? (across === 'z' ? lotBox.maxZ : lotBox.maxX)
        : (across === 'z' ? lotBox.minZ : lotBox.minX);
      const at = outFt => edge + sign * outFt;
      // INNER: where the building stands between the two lot lines -- lot
      // line to house, the house itself, house to the far lot line.
      if (houseBox) {
        const hLo = axis === 'z' ? houseBox.minZ : houseBox.minX;
        const hHi = axis === 'z' ? houseBox.maxZ : houseBox.maxX;
        rows.push(...siteChain([lo, hLo, hHi, hi], axis, at(SITE_DIM_FIRST_FT), 'inner'));
      }
      // OUTER: the lot, end to end.
      rows.push(...siteChain([lo, hi], axis, at(SITE_DIM_OUTER_FT), 'outer'));
    };
    // Front to back is measured along the front's own axis and read from the
    // LEFT side; side to side is measured across it and read from the FRONT.
    // Two edges, so neither row crosses the other's figures.
    build(front.z ? 'z' : 'x', left);
    build(front.z ? 'x' : 'z', front);
    return rows;
  }

  // HOW FAR OUT EVERYTHING ELSE HAS TO STAND. Movie, same message: "the E1-E4
  // on the outside can we make it so it is on the OUTSIDE of the site lines".
  // The marks are seated by MODEL, which asks here rather than keeping its own
  // copy of 3 and 2 -- one number, so a change to the rows moves the ring with
  // them instead of leaving it among the figures.
  const siteDimReachFt = () => SITE_DIM_OUTER_FT;

  // THE FOOTPRINT IS THE GROUND FLOOR'S OUTLINES, every building on it. The
  // lowest floor level that HAS outlines answers -- a bungalow's and a
  // detached garage's are both on MAIN FL, and a split's lowest is ENTRY --
  // so what is drawn is what stands on the ground rather than one storey of
  // it. The lot itself is excluded by its own flag, which is what the flag
  // is for.
  function sitePlanParts(saved) {
    const outlines = (Array.isArray(saved?.outlines) ? saved.outlines : [])
      .filter(item => item && Array.isArray(item.points) && item.points.length > 2);
    const lot = outlines.find(item => item.site === true) || null;
    const bodies = outlines.filter(item => item.site !== true
      && num(item.levelId) !== null && num(item.levelId) > 1
      && num(item.levelId) !== SITE_LEVEL_ID && num(item.levelId) !== 7);
    const ground = bodies.length
      ? Math.min(...bodies.map(item => num(item.levelId))) : null;
    const roofs = (Array.isArray(saved?.roofs) ? saved.roofs : [])
      .filter(item => item && Array.isArray(item.points) && item.points.length > 2);
    return {
      lot,
      bodies: ground === null ? [] : bodies.filter(item => num(item.levelId) === ground),
      roofs,
    };
  }

  const siteLoop = (ctx, toS, points) => {
    ctx.beginPath();
    points.forEach((pt, i) => {
      const s = toS(pt);
      if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
    });
    ctx.closePath();
  };

  function drawSitePlan(ctx, toS, saved, env = {}) {
    const geo = window.DraftGeometry2D;
    const { lot, bodies, roofs } = sitePlanParts(saved);
    if (!lot && !bodies.length && !roofs.length) return false;
    // ── THE FOOTPRINT IS THE ROOF PLAN (Movie, 14 Oct) ──────────────────
    //
    // "for the FOOTPRINT on the site plan the ROOF PLAN with the WALL
    // OUTLINES would be a good drawing to use for the FOOTPRINT on the SITE
    // PLAN (but the dimensioning will be different on the site plan".
    //
    // WHICH IS A DRAWING THIS FILE ALREADY MAKES: drawRoofPlan lays the roof
    // planes with their ridges and hips, and then drawWallTops2D puts the
    // wall outlines under them -- the two halves he named, in one call. The
    // first cut of this painter drew its own dashed eave line and a filled
    // outline, which was a worse drawing of the same thing and a second copy
    // of geometry the roof plan owns.
    //
    // WITHOUT THE DIMENSIONS, because "the dimensioning will be different on
    // the site plan": a roof plan measures the building, and a site plan
    // measures the setbacks to the lot lines. `siteFootprint` is named rather
    // than borrowing `listing` or `shell`, which mean other things and would
    // read as this painter pretending to be a sheet it is not.
    let drewFootprint = false;
    [...new Set(roofs.map(roof => num(roof.levelId)))]
      .filter(id => id !== null)
      .forEach(id => {
        if (drawRoofPlan(ctx, toS, saved, id, { ...env, siteFootprint: true })) {
          drewFootprint = true;
        }
      });
    // AND THE AREA INSIDE THE WALLS, SHADED. "everything withing interior
    // walls" -- so the outline, which is the EXTERIOR face, is pulled in by
    // one wall thickness before it is filled. The thickness is the one the
    // level's own walls are built at, not a number typed here; a body with no
    // walls to ask falls back to the outline itself rather than guessing an
    // inset, which on a thin building would turn the shading inside out.
    const insideOf = body => {
      const level = num(body.levelId);
      const walls = planWalls(saved, level).filter(wall => wall.wallType);
      const type = walls.length
        ? (WALL_TYPES.find(t => t.id === walls[0].wallType)
          || WALL_TYPES.find(t => t.id === LEGACY_WALL_TYPES[walls[0].wallType]))
        : null;
      const thick = (type ? type.totalIn : 5.5) / 12;
      if (!geo || typeof geo.offsetOutline !== 'function') return body.points;
      const inner = geo.offsetOutline(body.points, -thick);
      return Array.isArray(inner) && inner.length === body.points.length
        && inner.every(pt => Number.isFinite(pt.x) && Number.isFinite(pt.z))
        ? inner : body.points;
    };
    if (drewFootprint && bodies.length) {
      if ('dxfLayer' in ctx) ctx.dxfLayer = 'A-PLAN';
      ctx.fillStyle = SITE_INSIDE_FILL;
      bodies.forEach(body => { siteLoop(ctx, toS, insideOf(body)); ctx.fill(); });
    }
    // NO ROOF YET, SO THE OUTLINE STANDS IN. A drafter who has traced his
    // walls and not yet pressed the bone still has a lot to place a building
    // on, and an empty square on the site sheet would say he has not.
    if (!drewFootprint) {
      if ('dxfLayer' in ctx) ctx.dxfLayer = 'A-PLAN';
      ctx.fillStyle = SITE_FOOTPRINT_FILL;
      ctx.strokeStyle = 'rgba(29,31,32,0.95)';
      ctx.lineWidth = 1.5;
      bodies.forEach(body => {
        siteLoop(ctx, toS, body.points);
        ctx.fill();
        ctx.stroke();
      });
    }
    // AND THE LOT LINE OVER EVERYTHING, heavy: it is the boundary the whole
    // sheet is about, and on a crowded corner lot the footprint may touch it.
    if (lot) {
      if ('dxfLayer' in ctx) ctx.dxfLayer = 'A-SITE';
      ctx.save();
      const scale = env.inkScale || 1;
      ctx.lineCap = 'round';
      ctx.setLineDash(SITE_LINE_DASH.map(part => part * scale));
      ctx.strokeStyle = env.siteLineInk || SITE_LINE_INK;
      ctx.lineWidth = SITE_LINE_W * scale;
      siteLoop(ctx, toS, lot.points);
      ctx.stroke();
      ctx.restore();
    }
    // AND THE TWO ROWS OUTSIDE IT (Movie, 14 Oct): the house's position
    // against the lot lines nearest the lot, the lot's own size outside that.
    // Drawn last, like every other sheet's dimensions, over what they measure.
    const render = window.DraftRender2D;
    const rows = siteDimStrings(saved);
    if (rows.length && render && render.drawDimension2D) {
      if ('dxfLayer' in ctx) ctx.dxfLayer = 'A-SITE-DIMS';
      const fmt = window.DraftFormatters || {};
      const dimensionEnv = {
        label: ft => (fmt.formatArchitecturalInches
          ? fmt.formatArchitecturalInches(ft * 12) : `${Math.round(ft)}'`),
        colors: env.siteDimColors || DIMENSION_COLORS,
        // ON THE LINE, because the line is already where he put it: the rows
        // stand 3 ft and 5 ft off the lot in FEET, and the screen's default
        // 19px stand-off would add a second offset in a different unit on top
        // of it -- the two rows would sit at a different spacing on every zoom.
        atLine: true,
        inkScale: env.inkScale,
      };
      rows.forEach(row => render.drawDimension2D(ctx, toS, row, {}, dimensionEnv));
    }
    return true;
  }

  function drawPlan(ctx, toS, saved, levelId, env = {}) {
    const composition = window.DraftPlanComposition;
    const geo = window.DraftGeometry2D;
    if (!composition || !geo) return false;

    // THE SITE LEVEL IS NOT A STOREY, and has no walls to find: its sheet is
    // the lot, the footprint and the eave line (drawSitePlan above).
    if (num(levelId) === SITE_LEVEL_ID) return drawSitePlan(ctx, toS, saved, env);

    const view = env.view || null;
    // WHICH PILE IS WHICH, by what stands over it (Movie, 15 Oct). The rule is
    // build-house.js's; the bodies are every building outline on the drawing,
    // on any storey, with the LOT LINE left out because a lot is not a
    // building -- the same `site` flag sitePlanParts and auto-dims read.
    const pileBodies = (Array.isArray(saved?.outlines) ? saved.outlines : [])
      .filter(outline => outline && outline.site !== true
        && Array.isArray(outline.points) && outline.points.length > 2)
      .map(outline => ({ points: outline.points, garage: outline.garage === true }));
    const pileMarkOf = column => (window.DraftBuildHouse
      ? window.DraftBuildHouse.pileMark(column.point, pileBodies)
      : String(column.footing || ''));
    const walls = planWalls(saved, levelId, view)
      .filter(wall => env.foundationGhost !== true || basementGhostKeeps(saved, wall.id));
    // A FLOOR LAYOUT HAS FLOORS, NOT WALLS of its own: the deck, its holes,
    // the beams and posts under it and its dimensions.
    const floorLayout = view === 'floor' && hasFloorLayout(saved, levelId);
    if (!walls.length && !floorLayout) return drawRoofPlan(ctx, toS, saved, levelId, env);

    // THE STOREY UNDER THIS ONE, FIRST OF ALL, so every other line on the
    // sheet — this floor's and the half-floor's alike — lands over it.
    //
    // ONLY ON THIS LEVEL'S OWN PASS: the recursive calls below are this same
    // function drawing the half-floor and the foundation, and each would
    // otherwise ghost ITS OWN storey below as well.
    //
    // NOT ON A SHELL AND NOT ON A HOLOGRAM, for the reasons those two modes
    // exist. A SHELL is a house seen at 1"=40' on the neighborhood, stripped
    // to walls because everything else at that scale "is a blue smudge that
    // hides the walls" -- a second footprint behind this one is exactly that
    // smudge. A HOLOGRAM is ANOTHER drawing shown under the one being drawn,
    // so its storey below would be a ghost of a ghost, two buildings deep.
    // A LISTING keeps it: `listing` takes away dimensions and sizes -- the
    // annotation a buyer does not read -- and this is geometry, which is what
    // that plan is for.
    if (env.halfLevel !== true && env.foundationGhost !== true
      && env.shell !== true && env.hologram !== true) {
      drawFloorBelowGhost(ctx, toS, saved, levelId);
    }

    // UNDER, so the full floor's own lines are the ones left on top.
    const half = env.halfLevel === true ? null : halfLevelUnder(levelId);
    if (half != null && (planWalls(saved, half, view).length
      || (view === 'floor' && hasFloorLayout(saved, half)))) {
      ctx.save();
      ctx.globalAlpha *= HALF_LEVEL_SHEET_ALPHA;
      drawPlan(ctx, toS, saved, half, { ...env, halfLevel: true });
      ctx.restore();
    }
    // THE BASEMENT PLAN SHOWS THE FOUNDATION IT STANDS IN (Movie, 7 Oct):
    // "show the FOUNDATION WALL (slightly lighter ...) (don't show footings,
    // but show where columns are located". The house's foundation walls and
    // its posts, off the FOUNDATION view, under the basement's own walls --
    // no pads, and no piles, which are the garage's footings.
    if (levelId === BASEMENT_LEVEL_ID && view === 'plan' && env.halfLevel !== true
      && env.foundationGhost !== true) {
      const fdnWalls = planWalls(saved, levelId, 'foundation')
        .filter(wall => basementGhostKeeps(saved, wall.id));
      if (fdnWalls.length) {
        ctx.save();
        ctx.globalAlpha *= BASEMENT_FOUNDATION_ALPHA;
        drawPlan(ctx, toS, saved, levelId, { ...env, view: 'foundation', foundationGhost: true });
        ctx.restore();
      }
    }
    const foundationGhost = env.foundationGhost === true;
    const halfLevel = env.halfLevel === true || foundationGhost;
    // On the half-floor's pass, only what Movie named.
    const only = list => (halfLevel ? [] : list);
    // A FLOOR LAYOUT DRAWS WHAT HOLDS IT UP (structureUnder): the level
    // under's beams, posts and beam rows, re-filed onto this sheet so the
    // composer's level and view filter keeps them. Not the piles, which are
    // the garage's footings and stay on the foundation.
    const under = view === 'floor' && !halfLevel ? structureUnder(saved, levelId) : null;
    const borrowed = (key, keep) => (Array.isArray(saved?.[key]) ? saved[key] : [])
      .filter(item => item?.levelId === under.levelId && item.view === under.view && keep(item))
      .map(item => ({ ...item, levelId, view }));
    const notPile = column => !/pile/i.test(String(column.footing || ''));
    const beamRow = dimension => dimension.layer === COLUMN_DIM_LAYER;
    const ownBeamRow = dimension => dimension?.levelId === levelId && dimension.view === view
      && beamRow(dimension);

    // THE BUILDING, OR THE CONSTRUCTION DOCUMENT. `env.shell` asks for the
    // first: walls, floors, roofs and the holes in them, and nothing that
    // exists to be READ -- no dimension strings, no notes, no fixtures, no
    // stairs, no beams or columns.
    //
    // It is not a style. It is what a plan MEANS at a different distance. A
    // house on a neighborhood at 1"=40' is a building among buildings, and
    // its dimension strings at that scale are a blue smudge that hides the
    // walls they measure -- measured by looking at four real houses placed on
    // neighborhood/index.html, which is the caller this was added for.
    //
    // Every stage in plan-composition.js is already env-gated, so this only
    // has to decline to build an env rather than teach the composer a mode.
    const shell = env.shell === true;
    const unless = built => (shell ? null : built);
    // A REAL ESTATE PLAN (`listing: true`): the plan a buyer reads. Movie, 1
    // Oct: "on REAL ESTATE LAYOUTS we should NOT show the dimensions at all,
    // but they should show ROOM TAGS with approx size", walls SOLID, and no
    // window, door or equipment sizes ("not on any real estate plans"). It
    // keeps what `shell` throws away -- stairs and fixtures, which is how a
    // buyer reads a room -- so it is its own switch rather than shell's.
    const listing = env.listing === true;
    const forConstruction = built => (shell || listing ? null : built);
    // A HOLOGRAM (`hologram: true`): another .draft shown under the one being
    // drawn (Movie, 8 Oct, the existing house on a lot getting an addition).
    // The building as it is drawn -- walls, doors, windows, stairs, fixtures,
    // room names -- without its dimension strings and notes, which are the
    // OTHER drawing's annotation and would read as this one's.
    const hologram = env.hologram === true;
    // THE POSTS THAT HOLD UP THE FLOOR ABOVE, ON THE WALLS PLAN (Movie, 12
    // Oct: "on the PLANS, only show the column which will support the floor
    // above (show columns on main that will support 2nd floor)"). Those are
    // this level's own floor-layout posts, re-filed onto the plan, drawn dark
    // where they stand in a wall. Not on a listing, where the walls are solid
    // ("you won't see the columns"), and not the piles.
    const planPosts = view === 'plan' && !halfLevel && !listing && !shell && !hologram
      ? (Array.isArray(saved?.columns) ? saved.columns : []).filter(column => column?.levelId === levelId && column.view === 'floor'
        && !/pile/i.test(String(column.footing || ''))).map(column => ({ ...column, view }))
      : null;

    const of = key => (Array.isArray(saved?.[key]) ? saved[key] : []);
    const openings = of('surfaceOpenings');
    const surfaceOpeningsFor = (hostType, hostId) => openings.filter(opening =>
      opening.hostType === hostType && opening.hostId === hostId
      && Array.isArray(opening.points) && opening.points.length >= 3);
    const paperColor = env.paperColor || '#ffffff';
    const fmt = window.DraftFormatters || {};
    const stairs = window.DraftStairGeometry || null;
    const fixtures = window.DraftFixtureGeometry || null;
    const closets = window.DraftClosets || null;
    const STANDARDS = (window.DraftCutView && window.DraftCutView.STANDARDS) || {};
    if (!warnedNoStandards && !Object.keys(STANDARDS).length) {
      warnedNoStandards = true;
      // "OR THREW ON LOAD" IS NOT HEDGING. cut-view.js destructures
      // DraftFormatters at load, so a page that lists it BEFORE formatters.js
      // has the tag and no module -- indistinguishable from here, and the
      // exact fault REALESTATEPLAN shipped with.
      console.warn('layout-plan: cut-view.js is not loaded, or threw on load, so '
        + 'every drawing standard reads undefined -- the garage slab note prints '
        + 'with no thickness and its thickened edge is sized from nothing.');
    }
    // The level's own elevation, which the stair painter measures its descent
    // from. Absent means zero, the way every other level-keyed lookup here
    // treats a level it cannot find.
    const levelElev = (Array.isArray(saved?.levels) ? saved.levels : [])
      .find(level => level?.id === levelId)?.elev || 0;

    // THE LEVEL READINGS A STAIR IS DERIVED FROM, which is the whole reason
    // `stairCurrentLayout` takes a second argument: a stair does not store its
    // risers, it re-derives them from the storey heights every time it is
    // drawn, so a sheet that cannot read the heights cannot draw the stair.
    // MODEL.dc.html gathers exactly these four off its component state
    // (`_stairLevels`); here they come off the saved JSON through the same
    // pure functions that page's accessors are wrappers over, so the two
    // cannot count risers differently.
    //
    // `wallTopFtFor` reads the RAW saved walls, not `walls` above: it wants
    // `topHeight` off every level's walls, and `planWalls` both filters to
    // this level and drops that field on its way to the painter.
    const LEVELS = window.DraftLevelAssembly;
    const VIEWS = window.DraftLayerViews;
    // GATED ON THE STAGE HAVING WANTED TO RUN. A drawing with no stairs, or a
    // page with no level assembly, is not missing anything -- warning there
    // would be noise, and noise is how a real warning gets ignored.
    if (!warnedNoLayerViews && stairs && LEVELS && !VIEWS) {
      warnedNoLayerViews = true;
      console.warn('layout-plan: layer-views.js is not loaded, so the stair stage '
        + 'is skipped entirely -- no stair on any level will be drawn.');
    }
    const stairLevels = stairs && LEVELS && VIEWS ? {
      floors: VIEWS.floorLevels(saved?.levels),
      assemblyFor: id => LEVELS.levelAssemblyFor(saved?.levelAssemblies, id),
      floorFtFor: id => LEVELS.levelFloorFt(LEVELS.levelAssemblyFor(saved?.levelAssemblies, id)),
      wallTopFtFor: (id, forView) => LEVELS.levelWallTopFt(of('walls'), id, forView),
    } : null;
    // THE STAIRS THIS LEVEL'S PLAN SHOWS, by role (stair-geometry
    // stairsShownOn): only the plan's stairs, which is where a stair lives.
    const stairRoles = new Map(stairLevels && typeof stairs.stairsShownOn === 'function'
      ? stairs.stairsShownOn(levelId, of('stairs').filter(stair =>
        (stair.view || 'plan') === (view || 'plan')), stairLevels.floors)
        .map(entry => [entry.stair, entry.role])
      : []);

    // ── THE GATE GETS ITS HANDLE ────────────────────────────────────────
    //
    // plan-composition.js has asked every entity `layerShows(layer)` since it
    // was written, and that function opens with:
    //
    //     const standard = env.layerStandard ? env.layerStandard(layerId) : null;
    //     if (!standard) return true;
    //
    // Nobody has ever passed `layerStandard`. Checked across every page and
    // module on 29 Sep: STANDARDS.html WRITES visible/printable into the saved
    // profile, and no painter has ever READ them back. So every tick a drafter
    // has set on that page since it shipped has changed nothing on any sheet.
    // A gate fitted and no handle -- and it fails the safe way, which is why
    // it went unnoticed: the drawing looks right, it just cannot be edited.
    //
    // This is the handle. It belongs in this file because both sheet pages
    // paint through it -- LAYOUT.html and REALESTATEPLAN.html each load
    // profile-manager.js before this one -- so one wiring serves both rather
    // than each page growing its own copy of the same lookup.
    //
    // MODEL.html is deliberately NOT wired: it paints its own plan rather than
    // calling this composer (board items 38-40), and the Model Space is where
    // a drafter is EDITING. A dimension hidden there is one they cannot click.
    const profiles = window.DraftProfileManager;
    const layerApi = window.DraftLayerStandards;
    if (!warnedNoLayerStandards && !(profiles && layerApi)) {
      warnedNoLayerStandards = true;
      console.warn('layout-plan: '
        + (!profiles ? 'profile-manager.js' : 'layer standards')
        + ' is not loaded, so every layer draws regardless of its Visible tick '
        + '-- STANDARDS can be set and this sheet will ignore it.');
    }
    const layerTable = profiles && layerApi
      ? layerApi.normaliseLayerStandards(
        profiles.getActive('standards')?.content?.model?.layerStandards)
      : null;

    composition.drawPlan(ctx, toS, {
      levelId,
      viewId: view,
      // THE DRAWING'S OWN SWITCH, for the window and door size tags: a sheet
      // off a metric drawing tags W 915 X 1065, as the Model Space does.
      units: saved?.units === 'metric' ? 'metric' : 'imperial',
      // ── AND THOSE TAGS HOLD THEIR SIZE ON THE PAPER ───────────────────
      //
      // Movie, 13 Oct: "on construction layouts the WINDOW/DOOR text marks
      // D36 etc change as i zoom in and out. can you lock those with the same
      // size text as in the INT wall walls (5.5" and 3.5")".
      //
      // THEY WERE THE ONE LETTERING LEFT IN SCREEN PIXELS. This env passed no
      // labelFont at all, so plan-composition fell back to a bare 9px -- a
      // SCREEN size, which holds still while the drawing under it zooms, so
      // the tag grows against the plan on the way out and shrinks on the way
      // in. Everything beside it had already been moved onto paper units: the
      // dimension figures take `inkScale` for exactly this (11 Oct, "ticks and
      // figures scale with the sheet when it zooms instead of holding their
      // screen size").
      //
      // 8px x inkScale IS THE INTERIOR DIMENSION FIGURE, to the pixel --
      // render-2d.js's TIGHT_FONT, which is what prints 5 1/2" and 3 1/2"
      // between the studs. Movie named that text as the one to match, so it
      // is the same arithmetic rather than a number that looks like it.
      labelFont: `600 ${8 * (env.inkScale || 1)}px 'Barlow Condensed', system-ui, sans-serif`,
      // ── WHICH OUTLINE IS THE HOUSE, for the window size tag ───────────
      //
      // The tag sits on the EXTERIOR side of the glass and nothing can say
      // which side that is without the outline. building-bodies.js answers
      // it, and the MODEL SPACE ASKS THE SAME FUNCTION -- which is the whole
      // point, because a sheet that nearly agreed with the screen would put
      // the tag inside the house on exactly the plans where a body sits over
      // the garage.
      //
      // WITHHELD IN SHELL, by the same `unless` the dimensions take. A
      // neighborhood at 1"=40' asks for the building rather than the
      // construction document, so the tag stage never opens there and needs
      // no mode of its own.
      houseOutline: halfLevel || hologram ? null : forConstruction(id => (window.DraftBuildingBodies
        ? window.DraftBuildingBodies.houseOutlineOn(saved, id) : null)),
      // null for a layer the table does not carry, which layerShows reads as
      // "draws" -- an untagged dimension from before this key existed, and a
      // profile that predates a layer being added, both keep drawing.
      layerStandard: layerTable ? (id => layerTable[id] || null) : null,
      // ── AND WHICH LAYERS THIS VIEW CARRIES AT ALL ─────────────────────
      //
      // The other half of the same gate, and the first caller `layersFor`
      // has ever had. The profile answers "is this layer on" once for the
      // drawing; the view's own `contents` answers "is it on THIS drawing of
      // the level" -- which is what lets one sheet of a level show its
      // interior strings and another not, without the drafter re-ticking the
      // standards table between two viewports of the same house.
      //
      // NULL WHEN NO VIEW WAS NAMED, which is the same compatibility promise
      // `hasLayerViews` keeps below: a layout composed before views existed
      // is composed byte-for-byte as it was, because there is no view whose
      // contents could exclude anything.
      //
      // `layersFor` FALLS BACK TO THE LEVEL'S DEFAULT VIEW rather than to an
      // empty list, so an old or hand-edited layout naming a view that no
      // longer exists draws that level's default drawing instead of a blank
      // viewport.
      viewLayers: view !== null && VIEWS ? VIEWS.layersFor(levelId, view) : null,
      // A SAVED VIEWPORT CARRYING NO VIEW MEANS EVERY VIEW ON THE LEVEL, which
      // is this file's standing compatibility promise -- a layout composed
      // before views existed must compose byte-for-byte as it did. Saying
      // `hasLayerViews` only when a view was named is how that survives the
      // move into the shared filter.
      hasLayerViews: view !== null,
      isPrinting: false,

      walls,
      fenestrations: of('fenestrations'),
      // ON A FLOOR LAYOUT THE HALF-FLOOR'S DECK COMES TOO (Movie, 7 Oct: "we
      // should also show the 0.5 FLOOR in the 1 FLOOR"), lighter and under.
      floors: env.halfLevel === true && view === 'floor' ? of('floors') : only(of('floors')),
      roofs: only(of('roofs')),
      shapes: only(of('shapes')),
      lines: only(of('lines')),
      dimensions: under
        ? of('dimensions').filter(dimension => !ownBeamRow(dimension)).concat(borrowed('dimensions', beamRow))
        : only(of('dimensions')),
      notes: only(of('notes')),

      wallJoins: geo.wallJoins,
      meldPieces: geo.meldPieces,
      lineControlPoint: geo.lineControlPoint,
      openingGeometry: opening => {
        const wall = walls.find(w => w.id === opening.wallId);
        return wall && geo.openingGeometry(opening, wall,
          { walls, thicknessFt, padFt: env.padFt || 0 });
      },

      // THE SHEET IS PAPER, so the opening gap is paper-coloured rather than
      // the screen's #fafafa -- which the Model Space chose to match ITS clear
      // colour. That one value is the whole of what this page has ever needed
      // to say about the look of an opening, and it is why render-2d's painter
      // takes colours at all.
      openingEnv: { openingGapColor: paperColor },
      wallEnv: { wallTypes: WALL_TYPES, solid: listing },
      floorEnv: {
        cornerMarks: false,
        surfaceOpeningsFor,
        offsetOutline: (pts, dist) => geo.offsetOutline(pts, dist),
        formatInchesOnly: fmt.formatInchesOnly,
        // Derived the way MODEL.dc.html:2279 derives it, off the two the cut
        // view exports, rather than carried here as a third copy of a number.
        garageSlabThicknessIn: STANDARDS.GARAGE_SLAB_THICKNESS_IN,
        garageEdgeDepthIn: STANDARDS.GARAGE_EDGE_DEPTH_IN,
        garageEdgeTaperRunIn: STANDARDS.GARAGE_EDGE_DEPTH_IN - STANDARDS.GARAGE_SLAB_THICKNESS_IN,
        colors: FLOOR_COLORS,
      },
      // STAIRS. The painter is render-2d.js's drawStairs2D and the arithmetic
      // is stair-geometry.js's -- MODEL.dc.html's own two helpers for this are
      // two-line wrappers over `stairCurrentLayout` and `stairPlanParts`, so
      // there is nothing here to port, only to hand over.
      //
      // THE LAYER ANSWERS YES because this page keeps no layer table. A sheet
      // with no standards draws the drawing rather than nothing, which is the
      // same rule the composition applies to every other collection.
      stairEnv: !shell && stairLevels ? {
        layer: { visible: true, printable: true },
        isPrinting: false,
        elev: levelElev,
        stairColor: STAIR_COLOR,
        treadRunIn: stairs.STAIR_TREAD_RUN_IN,
        layoutFor: stair => stairs.stairCurrentLayout(stair, stairLevels),
        partsFor: (stair, layout) => stairs.stairPlanParts(stair, layout),
        formatInchesOnly: fmt.formatInchesOnly,
        roleFor: stair => (stairRoles.get(stair) || 'own'),
      } : null,
      stairs: of('stairs'),
      // WHICH STAIRS THIS SHEET SHOWS, AND HOW (Movie, 16 Oct; stair-geometry
      // stairsShownOn): its own going DN, the ones landing on it going UP,
      // the ones entirely under it lighter -- the same answer MODEL gives.
      stairsShown: !shell && stairLevels && typeof stairs.stairsShownOn === 'function'
        ? [...stairRoles.keys()] : null,

      // FIXTURES -- which is what a WASHROOM actually is on a plan.
      //
      // The dealt WC is four walls and a group; nothing about it is a fixture
      // record (`_dealWashrooms` writes walls only). Its tub, toilet and basin
      // are placed by the drafter as wall-hosted fixtures, and until now the
      // sheet drew the four walls and left the room EMPTY -- a three-piece
      // bathroom printed as a blank box. The same silence covered every
      // kitchen, laundry and closet, because they are all the same record.
      //
      // Nothing is re-derived here. `fixtureGeometry` is the module both pages
      // ask, and the numbers beside it (the closet's rod and shelf, the
      // counter overhang, the ink) are read off their own modules rather than
      // retyped -- MODEL.dc.html:15692 builds this same env from the same
      // exports.
      //
      // IT IS HANDED THE LEVEL'S WALLS, NOT THE DRAWING'S. An alcove tub finds
      // its far end by looking for a crossing wall, and a wall on another
      // storey is not one. This also keeps the wall objects identical to the
      // ones the composition looks the host up in, so a tub and its host agree
      // about which wall they mean.
      fixtureEnv: !shell && fixtures && closets ? {
        fixtureGeometry: (fixture, wall) => fixtures.fixtureGeometry(walls, fixture, wall),
        wallCross: (a, frame, b) => fixtures.wallCross(a, frame, b),
        wallFrame: wall => fixtures.wallFrame(wall),
        walls,
        closetDoorFor: outsideWidthFt => closets.doorFor(outsideWidthFt),
        CLOSET_CLOTHES_FT: closets.CLOTHES_FT,
        CLOSET_ROD_FT: closets.RAIL_FT,
        CLOSET_SHELF_FT: closets.SHELF_FT,
        CLOSET_WALL_FT: closets.WALL_FT,
        COUNTER_OVERHANG_FT: fixtures.COUNTER_OVERHANG_FT,
        FIXTURE_COLOR,
        fixtureFill: FIXTURE_FILL,
        // The neighbours a counter piece melds with at a joint.
        fixtures: only(of('fixtures')),
        // Which pieces carry upper cabinets, drawn dashed and lighter over
        // them (the overhead convention): the catalogue's answer. Not on a
        // listing, which is the furniture plan and not the construction
        // document -- the same line planPosts and beamsAbove draw.
        hasUppers: fixture => !listing && !!(window.DraftFixtureKinds && window.DraftFixtureKinds.hasUppers(fixture)),
      } : null,
      fixtures: only(of('fixtures')),

      // WHICH PILE IS WHICH, by what stands over it -- build-house.js's rule,
      // asked with every building outline on the drawing (the LOT LINE is not
      // a building, which is what `site` is for).
      // BEAMS AND COLUMNS, which a foundation sheet is arguably FOR: a site
      // builder setting teleposts reads them off this drawing. The painters
      // are render-2d.js's own -- drawBeam2D and drawColumn2D, with a mutation
      // suite already on them -- so this supplies colour and nothing else.
      //
      // THE MODEL SPACE'S INKS, carried rather than re-chosen: beams brown,
      // columns the drawing's ink. MODEL.html reads them off its skin; this
      // page is white paper like MODEL.dc.html, so it takes that page's
      // literals.
      structureEnv: unless({
        isPrinting: false,
        beamColor: '#7a4a21',
        columnColor: '#1d1f20',
        labelFont: "600 9px 'Barlow Condensed', system-ui, sans-serif",
      }),
      beams: under ? borrowed('beams', () => true) : only(of('beams')),
      // THE BEAM IN THE FLOOR SYSTEM OVER THIS PLAN (Movie, 16 Oct, the
      // overhead convention): the beams this level carries, filed on it
      // under its floor view (the basement's on 'foundation', a storey's on
      // 'floor'), re-filed onto the plan so the composer's filter keeps them
      // and painted dash-dot and lighter as `above`. The same rows planPosts
      // already borrows the posts from -- "columns already shown".
      // THE CANTILEVER OF THE FLOOR ABOVE AND THE ROOF OVERHANG (same note),
      // dashed and lighter: overhead-lines.js clips the storey above's
      // outline and this storey's roofs to what lies outside this level's
      // own outlines, on the full-storey ladder (a bilevel's half levels
      // left out). A listing keeps them -- geometry, which is what that
      // plan is for -- a shell, a hologram and the half-level pass do not.
      overheadLines: view === 'plan' && !halfLevel && !shell && !hologram && window.DraftOverheadLines
        ? (() => {
          const LA = window.DraftLevelAssembly;
          const lines = window.DraftOverheadLines.overheadLines({
            levelId,
            ladder: VIEWS.floorLevels(of('levels')).map(level => Number(level.id))
              .filter(id => !LA || !LA.STOREY_NUMBER || !(id in LA.STOREY_NUMBER)
                || Number.isInteger(Number(LA.STOREY_NUMBER[id]))),
            outlines: of('outlines'),
            roofs: of('roofs'),
          });
          return [...lines.cantilevers, ...lines.overhangs];
        })()
        : [],
      overheadEnv: { ink: GHOST_BELOW_INK },
      beamsAbove: view === 'plan' && !halfLevel && !listing && !shell && !hologram
        ? of('beams').filter(beam => beam?.levelId === levelId
          && beam.view === (levelId === BASEMENT_LEVEL_ID ? 'foundation' : 'floor'))
          .map(beam => ({ ...beam, view }))
        : [],
      // THE JOIST CALLOUT IN EVERY BAY OF THIS DECK (Movie, 16 Oct): the
      // bays between the storey under's beams, the arrow clear of the
      // stairwell, the short form off this storey's schedule. A bare deck
      // over a garage runs with the door wall.
      joistCallouts: unless(view === 'floor' && !halfLevel && hasFloorLayout(saved, levelId)
        ? joistCalloutsFor(saved, levelId, under) : []),
      columns: foundationGhost
        ? of('columns').filter(column => !/pile/i.test(String(column.footing || '')))
        : under ? borrowed('columns', notPile)
          : planPosts ? only(of('columns')).concat(planPosts) : only(of('columns')),
      // ONLY A PILE CHANGES THE DRAWN SHAPE; a telepost is the default square.
      // The same rule MODEL.html:3266 applies, and it is the CALLER's answer
      // rather than the painter's.
      //
      // AND THE LABEL IS THE SCHEDULE MARK, as it is in MODEL space (Movie,
      // 15 Oct): P3 under a house outline on any storey, P2 under a garage,
      // P1 for the rest. It used to be the raw id, so a LAYOUT foundation
      // sheet printed "pile12" under every pile -- the same defect MODEL.html
      // carried until the table went in, surviving here because nothing on
      // this side read the table either.
      //
      // THE DIAMETER IS STILL THE OLD HARD-CODED 6, deliberately: fixing it
      // changes the size of every pile drawn on a LAYOUT sheet, which is a
      // question about this page's pixels and not about what a pile is called.
      // Named here rather than left to be found.
      columnFooting: column => (/pile/i.test(String(column.footing || ''))
        ? { pile: true, sizeIn: 6, label: pileMarkOf(column) } : null),
      roofEnv: {
        isPrinting: false,
        offsetOutline: (pts, dist) => geo.offsetOutline(pts, dist),
        offsetOutlineVariable: (pts, dists) => geo.offsetOutlineVariable(pts, dists),
        roofSkeleton: geo.roofSkeleton,
        cutRoofSegment: geo.cutRoofSegment,
        // WELDED AGAINST WHAT THIS SHEET ACTUALLY DRAWS. plan-composition
        // picks roofs with `{ views: false }` -- a roof is never view-filtered
        // -- so `of('roofs')` is exactly the set that reaches the painter, and
        // a roof cannot be welded to one that is not on the drawing.
        roofWelds: roof => geo.roofWeldSpans(roof, of('roofs')),
        roofHidden: roof => geo.roofHiddenSpans(roof, of('roofs')),
        surfaceOpeningsFor,
      },
      // SHAPES ARE NOT DRAWN ON A SHEET YET and that is declared rather than
      // silent: `drawShape2D` wants `areaLabel` and `outlineAreaSqFt`, which
      // are the Model Space's arithmetic and have no shared home. A shape is
      // a construction OUTLINE -- deliberately unlike a floor or a roof -- so
      // a sheet missing one is missing a guide, not a building.
      shapeEnv: null,
      dimensionEnv: hologram ? null : forConstruction({
        label: ft => fmt.formatArchitecturalInches(ft * 12),
        colors: DIMENSION_COLORS,
        // THE LINE WHERE IT IS STORED, so the frame (sized to the records)
        // holds every row of a stack (render-2d drawDimension2D).
        atLine: true,
        // AND ITS INK IN PAPER UNITS: ticks and figures scale with the sheet
        // when it zooms instead of holding their screen size (Movie, 11 Oct).
        inkScale: env.inkScale,
      }),
      // THE NAME ON A CONSTRUCTION PLAN, THE NAME AND THE SIZE ON A LISTING
      // (Movie, 1 Oct: "the 2nd line will be only for REAL ESTATE LAYOUTS -
      // the 1st Line (ROOM TITLE) will be needed for both"). Printing, so no
      // UNDER MIN nag reaches paper.
      roomTagEnv: unless({
        color: '#1d1f20',
        isPrinting: true,
        areaFor: listing ? (tag => tag.size || '') : (() => ''),
      }),
      roomTags: only(of('roomTags')),
      noteEnv: hologram ? null : unless({ color: '#1d1f20', fillColor: paperColor }),
    });
    return true;
  }

  window.DraftLayoutPlan = Object.freeze({
    planWalls,
    planOpenings,
    wallBounds,
    planBounds,
    floorBelow,
    floorBelowLoops,
    footprintLoops,
    ghostLoops,
    joistCalloutsFor,
    ridesOnFullFloor,
    halfLevelUnder,
    fullFloorOver,
    hasFloorLayout,
    structureUnder,
    drawPlan,
    sitePlanParts,
    drawSitePlan,
    siteDimStrings,
    siteDimReachFt,
  });
})();
}
