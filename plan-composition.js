// THE PLAN, COMPOSED ONCE (work order: RD-DOCUMENTS/ORDER-construction-layouts.md).
//
// A plan drawing is not one painter, it is a dozen of them in an order that
// matters -- floors under walls, walls under their openings, labels over
// everything -- and until this module existed that order lived in THREE
// places. Counted on 20 Sep, `drawFloor2D` call sites and the annotation each
// page draws beside them:
//
//     MODEL.dc.html    8   fen 5   dims 3   marks 6   closets 10   fixtures 6
//     MODEL.html       8   fen 0   dims 1   marks 2   closets  1   fixtures 1
//     layout-plan.js   0   fen 0   dims 0   marks 0   closets  0   fixtures 0
//
// The third row is the reason this exists. LAYOUT.dc.html draws a construction
// sheet through `layout-plan.js`, whose own header says what it is -- "the
// wall painter is the shared DraftRender2D one" -- and walls are the whole of
// it. So the sheet the page's own link calls "the sheet that goes to site"
// carries no dimension strings, no window or door tags, no cut marks.
//
// WRITING THAT ANNOTATION INTO THE LAYOUT PAGE WOULD HAVE BEEN A FOURTH COPY,
// which is the defect this codebase refuses by name everywhere else --
// cut-view.js calls it "a second, smaller renderer that could drift". So the
// composition moves here and the pages call it.
//
// ── WHAT THIS MODULE IS NOT ──────────────────────────────────────────────
//
// IT DRAWS THE DRAWING, NEVER THE EDITOR. The model page's overlay also paints
// the grid, the origin, underlays, the half-drawn wall chain, placement
// ghosts, selection halos and hit indices -- all of which are answers to
// "what is this drafter doing right now", and none of which belongs on a
// sheet. That seam is why this module takes no tool, no snap point and no
// selection: a caller that wants those draws them itself, after.
//
// IT COMPUTES NOTHING. Every painter here is `render-2d.js`'s, called with the
// env that page already builds for it. What this module owns is the ORDER and
// the FILTERING -- which entities belong to a level and a layer view -- and
// those are exactly the two things that drifted.
//
// AUTO-DIMENSIONS ARE NOT DRAWN HERE, and that surprised me enough to write it
// down: the model does not paint its exterior dimension strings, it PLACES
// them. `_placeAutoDims` computes the segments and pushes them into the
// drawing as ordinary dimension records carrying `auto: true`, so they are in
// the saved file like any other. A sheet therefore gets them for free by
// drawing the `dimensions` collection, and `auto-dims.js` is not a dependency
// of this module at all.
if (!window.DraftPlanComposition) {
(() => {
  'use strict';

  const R = () => window.DraftRender2D;

  const list = value => (Array.isArray(value) ? value : []);

  // ── WHICH DRAWING OF A LEVEL ─────────────────────────────────────────────
  //
  // A level with layer views shows ONE of them; a whole-level context (ROOF,
  // SITE) shows everything it holds. That is `_drawPlanThumb2D`'s rule and it
  // is the one an entity filter has to carry, because a foundation plan that
  // also draws the basement's stud walls is two drawings on one sheet.
  //
  // `viewId` NULL MEANS EVERY VIEW, which is what the layout page's saved
  // viewports mean when they carry no view -- `layout-plan.js` documents that
  // compatibility and it has to survive the move.
  const onView = (viewId, hasLayerViews) => item =>
    !hasLayerViews || viewId === null || (item.view || 'plan') === viewId;

  const forLevel = (items, levelId, viewId, hasLayerViews, { views = true } = {}) => {
    const keep = onView(viewId, hasLayerViews);
    return list(items).filter(item => item.levelId === levelId && (!views || keep(item)));
  };

  // A LAYER ANSWERS TWICE: is it on, and does it print. The second only binds
  // when something is actually printing, and a caller that supplies no
  // standards gets everything -- a sheet with no layer table should draw the
  // drawing, not nothing.
  const layerShows = env => layerId => {
    const standard = env.layerStandard ? env.layerStandard(layerId) : null;
    if (!standard) return true;
    if (!standard.visible) return false;
    return !env.isPrinting || standard.printable !== false;
  };

  // ── THE ORDER ────────────────────────────────────────────────────────────
  //
  // Lifted from MODEL.dc.html's `_redrawOverlay`, minus every editor step.
  // The two-pass wall draw is not a stylistic choice and must not be collapsed
  // into one loop: every wall's FILL goes down before any wall's STROKE, so a
  // join reads as one continuous assembly instead of each wall's body being
  // painted over its neighbour's edge.
  const drawPlan = (ctx, toS, env) => {
    const render = R();
    if (!render || !ctx || typeof toS !== 'function') return;

    const levelId = env.levelId;
    const hasLayerViews = Boolean(env.hasLayerViews);
    const viewId = env.viewId === undefined ? null : env.viewId;
    const shows = layerShows(env);
    const pick = (items, options) => forLevel(items, levelId, viewId, hasLayerViews, options);

    // Roofs and outlines are whole-level, not per-view: a roof belongs to the
    // level it covers and shows on every drawing of it.
    const floors = pick(env.floors).filter(floor => shows(floor.layer));
    const shapes = pick(env.shapes).filter(shape => shows(shape.layer));
    const roofs = pick(env.roofs, { views: false });
    const walls = pick(env.walls);
    const lines = pick(env.lines).filter(line => shows(line.layer));
    const dimensions = pick(env.dimensions).filter(dimension => shows(dimension.layer));
    const notes = pick(env.notes).filter(note => shows(note.layer));

    // A STAGE WITH NO ENV IS SKIPPED, NOT GUESSED. These painters read their
    // colours, their formatters and their host lookups straight off the env --
    // `drawFloor2D` reaches for `env.colors.fill` with no guard at all -- so a
    // caller that cannot honestly supply one would not draw a paler floor, it
    // would throw in the middle of a sheet. A caller says what it can draw by
    // supplying the env for it, and this is where that is honoured.
    if (env.floorEnv) floors.forEach(floor => render.drawFloor2D(ctx, toS, floor, {}, env.floorEnv));
    if (env.shapeEnv) shapes.forEach(shape => render.drawShape2D(ctx, toS, shape, {}, env.shapeEnv));
    if (env.roofEnv) roofs.forEach(roof => render.drawRoof2D(ctx, toS, roof, {}, env.roofEnv));

    const joins = env.wallJoins ? env.wallJoins(walls) : null;
    walls.forEach(wall => render.drawWallSeg2D(ctx, toS, wall, false, joins, 'fill', env.wallEnv));
    walls.forEach(wall => render.drawWallSeg2D(ctx, toS, wall, false, joins, 'stroke', env.wallEnv));

    drawOpenings(ctx, toS, env, walls, shows);

    // FIXTURES RIDE THEIR HOST WALL, so the painter is handed the wall as its
    // own argument rather than looking it up. `_redrawOverlay` draws them
    // immediately after the openings and before anything measured, which is
    // the order kept here.
    if (env.fixtureEnv) {
      const wallById = new Map(walls.map(wall => [wall.id, wall]));
      pick(env.fixtures).filter(fixture => shows(fixture.layer)).forEach(fixture => {
        render.drawFixture2D(ctx, toS, fixture, {}, wallById.get(fixture.wallId), env.fixtureEnv);
      });
    }

    // ELECTRIC IS ITS OWN SHEET'S WORTH OF MARKS and electric-symbols.js owns
    // every one of them; this only decides WHICH devices and how big the mark
    // is. The size is measured off the transform rather than assumed, so a
    // symbol tracks zoom exactly -- two world points a known distance apart,
    // which is the old page's own trick.
    if (env.electricEnv && window.DraftElectricSymbols) {
      const symbols = window.DraftElectricSymbols;
      const devices = pick(env.electricDevices).filter(device => shows(device.layer));
      if (devices.length && env.electricDeviceAt) {
        const a = toS({ x: 0, y: 0, z: 0 });
        const b = toS({ x: env.electricEnv.deviceFt || 0.5, y: 0, z: 0 });
        const size = Math.max(3, Math.hypot(b.x - a.x, b.y - a.y));
        devices.forEach(device => {
          const placed = env.electricDeviceAt(device);
          if (!placed) return;
          const at = toS(placed.pt);
          const paint = symbols[env.electricEnv.symbolFor?.(device.kind) || 'wallOutlet']
            || symbols.wallOutlet;
          symbols.drawDevice(ctx, (c, sz) => paint(c, sz), at.x, at.y, size, placed.rotation);
        });
      }
    }

    // STAIRS PAINT A COLLECTION rather than one item -- render-2d resolves the
    // list off the env it is handed -- so the env arrives WITHOUT its `stairs`
    // and this puts the filtered ones in. The alternative was a caller
    // filtering by level and view for itself, which is the one job this module
    // exists to stop being written twice.
    if (env.stairEnv) {
      render.drawStairs2D(ctx, toS, { ...env.stairEnv, stairs: pick(env.stairs) });
    }
    if (env.cutMarkEnv) render.drawCutMarks2D(ctx, toS, env.cutMarkEnv);
    if (env.outlineEnv) render.drawOutlines2D(ctx, toS, env.outlineEnv);

    strokeLines(ctx, toS, lines, env);

    // DIMENSIONS AND NOTES GO LAST of what this module draws, over the
    // geometry they measure. The model's overlay puts its selection halos
    // above even these, which is an editor step and stays with the editor.
    if (env.dimensionEnv) {
      dimensions.forEach(dimension => render.drawDimension2D(ctx, toS, dimension, {}, env.dimensionEnv));
    }
    // STRUCTURE GOES OVER THE DRAWING IT HOLDS UP. `_redrawOverlay` puts beams
    // and columns after the room tags and before the stairs, which is late on
    // purpose: a telepost is read against the floor it stands on, so it is
    // drawn last of the things that are not text.
    //
    // THE PAINTERS ARE render-2d.js's AND HAVE BEEN ALL ALONG -- drawBeam2D
    // and drawColumn2D, with a mutation suite on them in
    // proto/render-2d-harness.js. MODEL.html calls them; MODEL.dc.html has a
    // 134-line inline twin and never adopted them. Composing them here is how
    // that twin stops being the only way the old page can draw structure.
    //
    // THE FOOTING IS THE CALLER'S ANSWER, not the painter's -- only a pile
    // changes the drawn shape, a telepost being the default square.
    if (env.structureEnv) {
      pick(env.beams).forEach(beam => render.drawBeam2D(ctx, toS, beam, {}, env.structureEnv));
      pick(env.columns).forEach(column => render.drawColumn2D(ctx, toS, column, {
        footing: env.columnFooting ? env.columnFooting(column) : null,
      }, env.structureEnv));
    }

    if (env.noteEnv) {
      notes.forEach(note => render.drawNoteScreen2D(ctx, toS(note.anchor), toS(note.text), note, {}, env.noteEnv));
    }
  };

  // ── OPENINGS, AND THE TWO THINGS WRITTEN BESIDE THEM ─────────────────────
  //
  // The opening itself, then the office's naming ladder (G 8x16 / ED36 / D32 /
  // W 24x36), then the grade-beam cut note. All three are lifted from
  // `_redrawOverlay` unchanged in what they draw.
  //
  // AN OPENING IS FILTERED BY ITS HOST WALL, not by its own level. A wall
  // shared between storeys can put another level's openings on this draw, and
  // the host-wall test is the one that gets that right -- which is also why
  // the label pass looks the outline up per LEVEL rather than once.
  const drawOpenings = (ctx, toS, env, walls, shows) => {
    const render = R();
    if (!env.openingGeometry) return;
    const hostIds = new Set(walls.map(wall => wall.id));
    const openings = list(env.fenestrations)
      .filter(opening => hostIds.has(opening.wallId) && shows(opening.layer));
    if (!openings.length) return;

    const geometryOf = new Map();
    openings.forEach(opening => {
      const geometry = env.openingGeometry(opening);
      if (geometry) geometryOf.set(opening, geometry);
    });

    geometryOf.forEach((geometry, opening) => {
      render.drawOpening2D(ctx, toS, opening, { geometry },
        { isPrinting: Boolean(env.isPrinting), ...(env.openingEnv || {}) });
    });

    if (env.showFenLabels && window.DraftFenLabels && env.houseOutline && env.edgeOnOutline) {
      const wallById = new Map(walls.map(wall => [wall.id, wall]));
      const outlineByLevel = new Map();
      const outlineFor = id => {
        if (!outlineByLevel.has(id)) outlineByLevel.set(id, env.houseOutline(id));
        return outlineByLevel.get(id);
      };
      ctx.save();
      ctx.fillStyle = env.labelColor || '#1d1f20';
      ctx.font = env.labelFont || "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      geometryOf.forEach((geometry, opening) => {
        const wall = wallById.get(opening.wallId);
        if (!wall) return;
        const outline = outlineFor(opening.levelId);
        const label = window.DraftFenLabels.fenLabelForOpening(opening, {
          exteriorWall: Boolean(outline && env.edgeOnOutline(wall.start, wall.end, outline)),
        });
        if (!label) return;
        // BESIDE THE SYMBOL, off the wall FACE: glazing runs along the wall,
        // so its perpendicular is the wall's normal, and the assembly's own
        // corners bound the half thickness the label has to clear.
        const [ga, gb] = geometry.glazing;
        const run = Math.hypot(gb.x - ga.x, gb.z - ga.z) || 1;
        const nx = -(gb.z - ga.z) / run, nz = (gb.x - ga.x) / run;
        const half = Math.max(...geometry.corners.map(corner =>
          Math.abs((corner.x - geometry.center.x) * nx + (corner.z - geometry.center.z) * nz)));
        const at = toS({
          x: geometry.center.x + nx * (half + 0.55),
          z: geometry.center.z + nz * (half + 0.55),
        });
        ctx.fillText(label, at.x, at.y);
      });
      ctx.restore();
    }

    // THE GRADE-BEAM CUT, on the FOUNDATION drawing only. A door through a
    // poured wall marks the pour cut -- down 12" the width of the door, with
    // the 4" slab pouring over the top of the beam -- and it is a note the
    // site reads, so it belongs on the sheet and not only on the screen.
    if (env.viewId === 'foundation' && env.concreteWallIds) {
      const concrete = env.concreteWallIds();
      ctx.save();
      ctx.fillStyle = env.gradeBeamColor || '#b04050';
      ctx.font = env.labelFont || "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      geometryOf.forEach((geometry, opening) => {
        if (opening.type !== 'door' || !concrete.has(opening.wallId)) return;
        const c = toS(geometry.center);
        ctx.fillText('CUT GRADE BEAM DN 12" — SLAB POURS OVER', c.x, c.y - 9);
      });
      ctx.restore();
    }
  };

  // Lines carry a bulge, so they are not all straight: the control point comes
  // from the caller because the curve's shape is the page's arithmetic.
  const strokeLines = (ctx, toS, lines, env) => {
    if (!lines.length) return;
    ctx.save();
    ctx.strokeStyle = env.lineColor || '#1d1f20';
    ctx.lineWidth = 1;
    lines.forEach(seg => {
      const a = toS(seg.start), b = toS(seg.end);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      if (seg.bulge && env.lineControlPoint) {
        const c = toS(env.lineControlPoint(seg));
        ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      } else {
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    });
    ctx.restore();
  };

  window.DraftPlanComposition = Object.freeze({
    drawPlan,
    // Exported for the harness and for a caller that wants the same filtering
    // without the painting -- a sheet that has to FIT a plan needs the points
    // before it can draw them.
    forLevel,
    onView,
  });
})();
}
