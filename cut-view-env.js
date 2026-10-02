// THE CUT VIEW'S ENV -- what cut-view.js has to be handed to draw a section
// or an elevation of a saved drawing.
//
// LIFTED OUT OF LAYOUT.html on 27 Sep, verbatim, because the Real Estate
// Layout became the THIRD page to need it. It was already the second: MODEL
// keeps its own, woven through with editor concerns, and proto/harness-env.js
// keeps a third for the offline engines. A fourth hand copy is the shape every
// one of this repo's module extractions was written against -- plan-composition
// for the plan draw order, shell-bars for the furniture, drawing-format for the
// record -- and the failure is always the same: the copy that drifts is the one
// nobody was measuring.
//
// WHAT IT IS: a bag of FUNCTIONS over one saved drawing. cut-view.js never
// reaches into a drawing; it asks this. So this file is the whole of the
// contract between a page's stored JSON and the painter, and a page that can
// build one can draw every view the app has.
//
// IT NORMALISES ON THE WAY IN and answers the same objects every time it is
// asked -- a painter walks `walls()` thousands of times in one frame, and a
// fresh array per call would be a new identity for every Map this file feeds.
//
// MODEL IS NOT A CALLER YET. Its copy carries the pooled-vertex identity the
// editor needs and untangling that is its own job; the two are held together
// today by tests/write-tier.spec.js and the elevation specs rather than by
// sharing this. Said here so the next reader knows the count is three, not two.
if (!window.DraftCutViewEnv) {
(() => {
  // Once per page: this env is rebuilt on every level change.
  let warnedNoRoofWords = false;
  let warnedNoLayerStandards = false;

  const DEFAULT_FOOTING_WIDTH_IN = 20;
  const ICF_FOOTING_WIDTH_IN = 24;

  // `levels` is format.levels(saved.levels) -- the caller has it already,
  // because it is what drives its own level rail.
  function buildCutViewEnv(saved, levels) {
    if (!saved) return null;
    const { normaliseLevelAssembly, levelRole, levelFloorFt, DEFAULT_WALL_TOP_FT }
      = window.DraftLevelAssembly;
    const format = window.DraftDrawingFormat;
    const levelIds = new Set(levels.map(level => level.id));
    const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);
    const point = raw => {
      const x = num(raw?.x), z = num(raw?.z);
      return x === null || z === null ? null : { x, z };
    };
    const walls = (Array.isArray(saved.walls) ? saved.walls : []).map(wall => {
      const start = point(wall?.start), end = point(wall?.end);
      if (!start || !end || !levelIds.has(Number(wall?.levelId))) return null;
      const topHeight = num(wall?.topHeight);
      return {
        id: String(wall?.id || ''),
        start,
        end,
        levelId: Number(wall.levelId),
        view: wall?.view || 'plan',
        ...(wall?.body === 'garage' ? { body: 'garage' } : {}),
        wallType: wall?.wallType,
        baseHeight: num(wall?.baseHeight) ?? 0,
        topHeight: topHeight !== null && topHeight > 0 ? topHeight : DEFAULT_WALL_TOP_FT,
        // WHAT THE WALL WEARS, carried through rather than re-validated. The
        // record was normalised by drawing-format.js when the file was opened,
        // and a page that draws no finishes is not affected by their being
        // here -- but the Real Estate Layout draws nothing else, and a wall
        // arriving here stripped of its cladding would be a blank elevation
        // with no error anywhere to say why.
        ...(wall?.finish ? { finish: wall.finish } : {}),
        ...(wall?.finishColor ? { finishColor: wall.finishColor } : {}),
        ...(Array.isArray(wall?.finishBands) && wall.finishBands.length
          ? { finishBands: wall.finishBands } : {}),
      };
    }).filter(Boolean);
    const floors = (Array.isArray(saved.floors) ? saved.floors : []).map(floor => {
      const points = (Array.isArray(floor?.points) ? floor.points : []).map(point).filter(Boolean);
      if (points.length < 3 || !levelIds.has(Number(floor?.levelId))) return null;
      return {
        points,
        levelId: Number(floor.levelId),
        view: floor?.view || 'floor',
        garage: floor?.garage === true,
        thickenedEdge: floor?.thickenedEdge === true,
      };
    }).filter(Boolean);
    // THE ROOF'S OWN WORDS COME WITH IT. Without these two lists the
    // normaliser drops `roofing` and `gableCorner`, and a page whose subject
    // IS the roofing draws every roof in asphalt with nothing anywhere saying
    // why -- which is exactly how the finish page came up blank on 27 Sep.
    const roofTypes = window.DraftRoofTypes || null;
    const profiles = window.DraftProfileManager || null;
    // The comment above says what this costs; this says it OUT LOUD, where a
    // drafter looking at a roof drawn in the wrong material can find it. A
    // dropped `roofing` reads as data loss, not as a missing script tag.
    if (!warnedNoRoofWords && (!roofTypes || !profiles)) {
      warnedNoRoofWords = true;
      console.warn('cut-view-env: '
        + [!roofTypes && 'roof-types.js', !profiles && 'profile-manager.js']
          .filter(Boolean).join(' and ')
        + ' is not loaded, so a stored roofing or gable-corner choice is dropped '
        + 'on load -- the roof draws as the default and the saved choice is gone.');
    }
    const roofs = format.roofs(saved.roofs, levelIds, {
      roofingIds: roofTypes ? roofTypes.ROOFING_TYPES.map(r => r.id) : null,
      cornerStyles: profiles ? profiles.GABLE_CORNER_STYLES : null,
    });
    const fenestrations = format.fenestrations(saved.fenestrations, levelIds);
    const outlines = format.outlines(saved.outlines, levelIds);
    // Columns too: the elevation draws the piles under a grade beam.
    const columns = format.columns
      ? format.columns(saved.columns, levelIds, {}) : (saved.columns || []);
    const shelves = format.boneyardShelves(saved.boneyardShelves);
    const masters = format.boneyardOutlines(saved.boneyardOutlines, new Set(shelves.map(shelf => shelf.id)));
    const assemblies = saved.levelAssemblies && typeof saved.levelAssemblies === 'object'
      ? saved.levelAssemblies : {};
    // Role-aware since PR #323: OVER GARAGE spans clear on a 19 1/4" joist
    // and ENTRY frames on 2x10s. Reading these levels as plain floors drew
    // this board's sections and elevations off MODEL.dc.html's.
    const levelAssembly = levelId => normaliseLevelAssembly(assemblies[levelId], levelRole(levelId));
    // SITE and ROOF are whole-level contexts and the FOUNDATION bears no floor
    // of its own — the floor-bearing stack is every other level, lowest first.
    const floorLevels = levels
      .filter(level => level.id > 0 && level.id !== 1 && level.id !== 7 && level.id !== 8)
      .slice()
      .reverse();
    const levelWallTopFt = (levelId, view = 'plan') => {
      const tops = walls
        .filter(wall => wall.levelId === levelId && wall.view === view)
        .map(wall => wall.topHeight);
      return tops.length ? Math.max(...tops) : DEFAULT_WALL_TOP_FT;
    };
    // Board #346: the last outboard copy of point-to-segment, collapsed onto the
    // shared export. geometry-2d.js is already loaded here (line 16), and this
    // page's env feeds cut-view.js's garageOfWall through edgeOnOutline below —
    // the same contract proto/elevation-harness.js serves, whose identical copy
    // collapsed in PR #353.
    //
    // NO CALLER-LOCAL FALLBACK. The export refuses a segment under 0.01ft
    // (Infinity) where this copy answered distance-to-`a`, and the one caller
    // was measured rather than assumed: edgeOnOutline's onBoundary is a
    // `.some()` across every edge, and a zero-length edge sits exactly on a
    // point its two neighbours already reach, so the Infinity is skipped and a
    // neighbour answers the same number. Checked against a clean square, a
    // duplicated corner, an edge ending on the duplicate, three identical
    // points, and a point only the zero-length edge could match: no flip in any
    // of them. It differs in one shape only — an outline whose edges are ALL
    // degenerate — and there `false` is the better answer, because something
    // that is one point has no boundary for an edge to lie along.
    const distToSeg = (pt, a, b) =>
      window.DraftGeometry2D.pointToSegment(pt, { start: a, end: b }).d;
    const standards = window.DraftStructureStandards.normaliseStructureStandards(
      window.DraftProfileManager?.getActive('standards')?.content?.model?.structureStandards);
    // ── AND THE LAYER TICKS, off the same active profile ──────────────────
    //
    // Movie, 29 Sep: "can we make the window number get layer A-DIMS-FENS so
    // the user can turn them off in ELEVATION views if desired".
    //
    // A window's size tag IS a fenestration dimension -- it is the elevation's
    // way of saying what the plan's opening-centre string says -- so it
    // answers to that layer rather than to a switch of its own. One tick, both
    // drawings, which is the point of the layer being named for what it
    // measures instead of for the sheet it sits on.
    const layerApi = window.DraftLayerStandards;
    if (!warnedNoLayerStandards && !(window.DraftProfileManager && layerApi)) {
      warnedNoLayerStandards = true;
      console.warn('cut-view-env: profile-manager.js is not loaded, so every '
        + 'layer draws regardless of its Visible tick -- window size tags '
        + 'cannot be switched off on any elevation this env draws.');
    }
    const layerTable = window.DraftProfileManager && layerApi
      ? layerApi.normaliseLayerStandards(
        window.DraftProfileManager.getActive('standards')?.content?.model?.layerStandards)
      : null;
    const datum = format.number(saved.elevationDatum, 0) === 100 ? 100 : 0;
    const units = saved.units === 'metric' ? 'metric' : 'imperial';
    const ftIn = feet => window.DraftFormatters.formatArchitecturalInches(feet * 12);
    return {
      // null for a layer the table does not carry, which the painter reads as
      // "draws" -- the same shape plan-composition's layerShows uses, so the
      // plan and the elevation cannot answer differently.
      layerStandard: layerTable ? (id => layerTable[id] || null) : null,
      // The office's Fenestration labels, for the one switch cut-view asks
      // of them: whether a door carries its size on an elevation.
      fenStandards: () => (window.DraftFenLabels && window.DraftProfileManager
        ? window.DraftFenLabels.normaliseFenStandards(
          window.DraftProfileManager.getActive('standards')?.content?.model?.fenestrationStandards)
        : null),
      floorLevels: () => floorLevels,
      levelAssembly,
      // ASKS THE MODULE. This spelt the arithmetic out until 7 Sep -- one of
      // four hand copies of `(joistDepthIn + sheathingIn) / 12`, which is
      // exactly what level-assembly.js's own comment warned the inlined form
      // would invite: "reading it at the call site invites someone to forget
      // the sheathing". Three call sites inlined it anyway.
      levelFloorFt: levelId => levelFloorFt(levelAssembly(levelId)),
      levelWallTopFt,
      footingWidthIn: levelId => {
        const assembly = levelAssembly(levelId);
        if (assembly.footingWidthIn) return assembly.footingWidthIn;
        const icf = walls.some(wall => wall.levelId === levelId
          && wall.view === 'foundation'
          && String(wall.wallType || '').startsWith('icf'));
        return icf ? ICF_FOOTING_WIDTH_IN : DEFAULT_FOOTING_WIDTH_IN;
      },
      walls: () => walls,
      roofs: () => roofs,
      floors: () => floors,
      columns: () => columns,
      fenestrations: () => fenestrations,
      garageOutlines: levelId => outlines.filter(outline =>
        outline.levelId === levelId && outline.garage && outline.points.length >= 3),
      garageFoundation: garage => {
        const mode = garage?.foundation
          || masters.find(master => master.id === garage?.masterId)?.foundation;
        return mode === 'thickened' ? 'thickened' : 'gradebeam';
      },
      edgeOnOutline: (a, b, outline, eps = 0.1) => {
        if (!outline) return false;
        const count = outline.open ? outline.points.length - 1 : outline.points.length;
        const onBoundary = pt => outline.points.some((p, index) => {
          if (index >= count) return false;
          const q = outline.points[(index + 1) % outline.points.length];
          return distToSeg(pt, p, q) <= eps;
        });
        return onBoundary(a) && onBoundary(b)
          && onBoundary({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
      },
      masterPointById: srcId => {
        for (const master of masters) {
          const src = master.points.find(p => p.id === srcId);
          if (src) return src;
        }
        return null;
      },
      gableCornerStyle: () => standards.gableCorner,
      elevLabel: elev => {
        const sign = elev > 0 && !datum ? '+' : '';
        return sign + (units === 'imperial' ? ftIn(elev) : (elev * 0.3048).toFixed(3) + ' m');
      },
      ftIn,
      elevationDatum: () => datum,
    };
  }

  window.DraftCutViewEnv = Object.freeze({ buildCutViewEnv });
})();
}
