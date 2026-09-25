// LAYER VIEWS — which drawing of a level you are looking at.
//
// A level is not one drawing. MAIN FL has a walls plan, a floor layout, a
// stair drawing and an electrical plan; FOUNDATION has basement walls and
// the concrete below them. MODEL has always known this — it is what the
// layer-set buttons switch between — but the table lived inside
// MODEL.dc.html, so the sheet composer could not see it and a plan viewport
// could only say WHICH LEVEL, never WHICH DRAWING OF IT (board NEW-2 part 2).
//
// This file is that table and nothing else: pure data plus two lookups, no
// DOM, node-loadable, frozen. MODEL and LAYOUT both read it, so the sheet
// set and the drawing board can never disagree about what a view contains.
//
// `contents` is the CAD layer list a view shows. Some of those layers have
// no entity in the drawing format yet (E-POWER, S-SLAB, S-FDN, S-FOOTING) —
// the table states the intent, and a view whose layers carry nothing simply
// deals no sheet rather than a blank one.
if (!window.DraftLayerViews) {
(() => {
  const FLOOR_LEVEL_VIEWS = Object.freeze([
    Object.freeze({ id:'e-power', label:'ELECTRIC', contents:['E-POWER', 'A-WALL-EXT', 'A-WALL-INT', 'E-POWER DIMENSION', 'A-ANNO-NOTE'] }),
    Object.freeze({ id:'plan', label:'FLOOR PLAN (WALLS)', contents:['A-WALL-EXT', 'A-WALL-INT', 'A-DOOR', 'A-GLAZ', 'A-FL', 'A-FL-DECK', 'A-FL-FLOORING', 'A-STR', 'PLAN DIMENSION', 'ROOM-IDS-AREA', 'A-ANNO-NOTE'] }),
    // S-COL-FOOTING JOINS S-BEAM HERE (Movie, 25 Sep). A floor's beam was
    // already on this view and what holds it up was on none: S-COL-FOOTING
    // appeared only in the FOUNDATION set below, so a post on MAIN FL was a
    // record in the file and on no sheet -- present always, drawn never.
    //
    // THE LAYER NAME IS THE FORMAT'S, not a claim about footings. A column
    // record is written with `layer: 'S-COL-FOOTING'` unconditionally
    // (drawing-format.js:657) whether it stands on a pad or on the beam
    // below, so a floor view that wants to draw posts has to name that layer.
    // Renaming it would be a format change for a word.
    Object.freeze({ id:'floor', label:'FLOOR LAYOUT (FLOOR)', contents:['S-BEAM', 'S-COL-FOOTING', 'S-SLAB', 'A-FL-OPNG', 'FLOOR DIMENSION', 'A-ANNO-NOTE'] }),
    Object.freeze({ id:'stair', label:'STAIR', contents:['A-STR', 'A-FL-OPNG', 'STAIR SECTION', 'A-ANNO-NOTE'] }),
  ]);
  const LEVEL_LAYER_VIEWS = Object.freeze({
    5: FLOOR_LEVEL_VIEWS,
    3: FLOOR_LEVEL_VIEWS,
    1: Object.freeze([
      Object.freeze({ id:'e-power', label:'ELECTRIC', contents:['E-POWER', 'A-WALL-EXT', 'A-WALL-INT', 'E-POWER DIMENSION', 'A-ANNO-NOTE'] }),
      Object.freeze({ id:'plan', label:'BASEMENT (WALLS)', contents:['A-WALL-EXT', 'A-WALL-INT', 'A-DOOR', 'A-GLAZ', 'ROOM-IDS-AREA', 'A-ANNO-NOTE'] }),
      Object.freeze({ id:'foundation', label:'FOUNDATION', contents:['S-FDN', 'S-COL-FOOTING', 'S-FOOTING', 'S-BEAM', 'S-SLAB', 'FOUNDATION DIMENSION', 'A-ANNO-NOTE'] }),
    ]),
  });
  // SITE and ROOF are whole-level drafting contexts; every other positive
  // level — including levels added with + ADD — is a floor with the
  // standard sets.
  const WHOLE_LEVEL_IDS = Object.freeze([7, 8]);
  const layerViewsForLevelId = levelId => {
    const id = Number(levelId);
    return LEVEL_LAYER_VIEWS[id]
      || (id > 0 && !WHOLE_LEVEL_IDS.includes(id) ? FLOOR_LEVEL_VIEWS : []);
  };
  // FOUNDATION opens on the concrete foundation plan; floors open on walls.
  const defaultLayerViewId = levelId => {
    const views = layerViewsForLevelId(levelId);
    if (!views.length) return null;
    return views.some(view => view.id === 'foundation') ? 'foundation' : 'plan';
  };
  // The layer list one view of one level shows. An unknown view id is not an
  // error — it falls back to the level's own default rather than painting
  // nothing, so an old or hand-edited layout still draws.
  const layersFor = (levelId, viewId) => {
    const views = layerViewsForLevelId(levelId);
    if (!views.length) return [];
    const view = views.find(v => v.id === viewId)
      || views.find(v => v.id === defaultLayerViewId(levelId));
    return view ? view.contents : [];
  };

  // The levels that carry a floor, bottom-up. The levels rail lists top-down,
  // so this reverses -- and the reversal is the part worth having one home for:
  // a stair climbs from the level BELOW, and reading this list the wrong way up
  // lands the flight on the wrong storey.
  //
  // It lives here because "does this level have a floor" is a layer-views
  // question -- the filter asks this file's own table -- and the pages that
  // needed the answer were each re-asking it in their own words.
  const floorLevels = levels => (levels || [])
    .filter(level => layerViewsForLevelId(level.id).some(view => view.id === 'floor'))
    .slice()
    .reverse();

  // WHERE A FLOOR OUTLINE SAVES, which is not always the layer set it was
  // drawn on. Lifted from MODEL.dc.html:9262 so the two pages cannot come to
  // different answers -- it is a layer-views question, the same as floorLevels
  // above, and the pages were each about to ask it in their own words.
  //
  // THE SECOND CLAUSE IS THE ONE THAT SURPRISES. Drawn on FOUNDATION, a floor
  // is a concrete slab, which is obvious. Drawn anywhere else on a level that
  // HAS a foundation set, it is STILL a slab -- because a level with a
  // foundation is a level whose floor IS the foundation, whichever layer set
  // the drafter happened to be looking at. Only a level with no foundation set
  // at all gets a plain framed floor.
  //
  // drawing-format.js:218 records what this costs when it is got wrong: "THE
  // FALLBACK IS 'floor', NOT 'plan' ... MODEL.html got this wrong in tier 2a
  // and no fixture could catch it, because the old page always writes the
  // field explicitly."
  const floorHomeView = (viewId, levelId) => {
    if (viewId === 'foundation') return 'foundation';
    return layerViewsForLevelId(levelId).some(view => view.id === 'foundation')
      ? 'foundation' : 'floor';
  };

  window.DraftLayerViews = Object.freeze({
    FLOOR_LEVEL_VIEWS, LEVEL_LAYER_VIEWS, WHOLE_LEVEL_IDS,
    layerViewsForLevelId, defaultLayerViewId, layersFor, floorLevels,
    floorHomeView,
  });
})();
}
