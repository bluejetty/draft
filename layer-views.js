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
    Object.freeze({ id:'floor', label:'FLOOR LAYOUT (FLOOR)', contents:['S-BEAM', 'S-SLAB', 'A-FL-OPNG', 'FLOOR DIMENSION', 'A-ANNO-NOTE'] }),
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

  window.DraftLayerViews = Object.freeze({
    FLOOR_LEVEL_VIEWS, LEVEL_LAYER_VIEWS, WHOLE_LEVEL_IDS,
    layerViewsForLevelId, defaultLayerViewId, layersFor,
  });
})();
}
