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
  function planBounds(saved, levelId) {
    const box = wallBounds(planWalls(saved, levelId));
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
    onLevel('dimensions').forEach(item => { eat(item.start); eat(item.end); });
    ['floors', 'roofs', 'outlines'].forEach(key => onLevel(key)
      .forEach(item => (Array.isArray(item.points) ? item.points : []).forEach(eat)));
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
  function drawPlan(ctx, toS, saved, levelId, env = {}) {
    const composition = window.DraftPlanComposition;
    const geo = window.DraftGeometry2D;
    if (!composition || !geo) return false;

    const view = env.view || null;
    const walls = planWalls(saved, levelId, view);
    if (!walls.length) return false;

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
    const stairLevels = stairs && LEVELS && VIEWS ? {
      floors: VIEWS.floorLevels(saved?.levels),
      assemblyFor: id => LEVELS.levelAssemblyFor(saved?.levelAssemblies, id),
      floorFtFor: id => LEVELS.levelFloorFt(LEVELS.levelAssemblyFor(saved?.levelAssemblies, id)),
      wallTopFtFor: (id, forView) => LEVELS.levelWallTopFt(of('walls'), id, forView),
    } : null;

    composition.drawPlan(ctx, toS, {
      levelId,
      viewId: view,
      // A SAVED VIEWPORT CARRYING NO VIEW MEANS EVERY VIEW ON THE LEVEL, which
      // is this file's standing compatibility promise -- a layout composed
      // before views existed must compose byte-for-byte as it did. Saying
      // `hasLayerViews` only when a view was named is how that survives the
      // move into the shared filter.
      hasLayerViews: view !== null,
      isPrinting: false,

      walls,
      fenestrations: of('fenestrations'),
      floors: of('floors'),
      roofs: of('roofs'),
      shapes: of('shapes'),
      lines: of('lines'),
      dimensions: of('dimensions'),
      notes: of('notes'),

      wallJoins: geo.wallJoins,
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
      wallEnv: { wallTypes: WALL_TYPES },
      floorEnv: {
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
      } : null,
      stairs: of('stairs'),

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
      } : null,
      fixtures: of('fixtures'),

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
      beams: of('beams'),
      columns: of('columns'),
      // ONLY A PILE CHANGES THE DRAWN SHAPE; a telepost is the default square.
      // The same rule MODEL.html:3266 applies, and it is the CALLER's answer
      // rather than the painter's.
      columnFooting: column => (/pile/i.test(String(column.footing || ''))
        ? { pile: true, sizeIn: 6, label: column.footing } : null),
      roofEnv: {
        isPrinting: false,
        offsetOutline: (pts, dist) => geo.offsetOutline(pts, dist),
        roofSkeleton: geo.roofSkeleton,
        surfaceOpeningsFor,
      },
      // SHAPES ARE NOT DRAWN ON A SHEET YET and that is declared rather than
      // silent: `drawShape2D` wants `areaLabel` and `outlineAreaSqFt`, which
      // are the Model Space's arithmetic and have no shared home. A shape is
      // a construction OUTLINE -- deliberately unlike a floor or a roof -- so
      // a sheet missing one is missing a guide, not a building.
      shapeEnv: null,
      dimensionEnv: unless({
        label: ft => fmt.formatArchitecturalInches(ft * 12),
        colors: DIMENSION_COLORS,
      }),
      noteEnv: unless({ color: '#1d1f20', fillColor: paperColor }),
    });
    return true;
  }

  window.DraftLayoutPlan = Object.freeze({
    planWalls,
    planOpenings,
    wallBounds,
    planBounds,
    drawPlan,
  });
})();
}
