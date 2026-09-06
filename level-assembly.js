// LEVEL ASSEMBLY — what one level is made of: its wall height and the floor
// built on top of it.
//
// Pulled out because THREE copies of this had grown: MODEL.dc.html's, an
// identical pair in LAYOUT.dc.html, and a third in proto/elevation-harness.js
// whose comment already admitted it "mirrors LAYOUT.dc.html's
// normaliseLevelAssembly exactly". Three copies of a defaults table is three
// chances for a drafter's 2x12 to mean 11.5" on one board and 11.875" on
// another.
//
// WHAT FORCED IT NOW. stair-geometry.js works out a stair's rise from the
// level below -- wall height plus this level's floor assembly -- and MODEL.html
// has to answer that question to paint a stair at all. It could not: the
// normaliser lived on the component. Feeding the stair its STORED riseFt
// instead was the tempting shortcut and it is wrong, because MODEL.dc.html
// re-derives the rise on every paint and never writes it back (see
// _stairCurrentLayout: "the rise captured at placement" is a FALLBACK, not the
// truth). Edit a wall height, save, and the stored rise is stale -- so the two
// boards would have drawn the same drawing with different riser counts.
//
// Pure, and it reads nothing. LAYOUT.dc.html still holds its own copy; adopting
// this there is a separate change with its own test surface.
if (!window.DraftLevelAssembly) {
(() => {
  // 8'-1 1/8": eight foot studs on a plate, plus the double top plate.
  const DEFAULT_WALL_TOP_FT = (8 * 12 + 1 + 1 / 8) / 12;
  const DEFAULT_FLOOR_ASSEMBLY = Object.freeze({
    joistDepthIn: 11 + 7 / 8,
    joistSpacingIn: 16,
    sheathingIn: 3 / 4,
  });
  // Framed floor joist choices offered by the FLOOR JOISTS box. OWJ depth is
  // entered by hand since open-web joists come in many depths.
  const JOIST_TYPES = Object.freeze([
    Object.freeze({ id: 'conv_2x10', label: '2x10', depthIn: 9 + 1 / 4 }),
    Object.freeze({ id: 'conv_2x12', label: '2x12', depthIn: 11 + 1 / 2 }),
    Object.freeze({ id: 'tji', label: 'TJI', depthIn: 11 + 7 / 8 }),
    Object.freeze({ id: 'owj', label: 'OWJ', depthIn: null }),
  ]);
  const DEFAULT_JOIST_TYPE = 'tji';
  // Footings run 8" deep (typ), setting the bottom of excavation below the wall.
  const DEFAULT_FOOTING_DEPTH_IN = 8;
  // Basement slabs pour 3" (typ house; a garage runs 4").
  const DEFAULT_FDN_SLAB_THICKNESS_IN = 3;

  // Per-level wall + floor assembly: the WALL HEIGHT and FLOOR JOISTS boxes
  // edit these, and the sidebar's border heights derive from them.
  const defaultLevelAssembly = () => ({
    wallHeightFt: DEFAULT_WALL_TOP_FT,
    joistType: DEFAULT_JOIST_TYPE,
    joistDepthIn: DEFAULT_FLOOR_ASSEMBLY.joistDepthIn,
    joistSpacingIn: DEFAULT_FLOOR_ASSEMBLY.joistSpacingIn,
    sheathingIn: DEFAULT_FLOOR_ASSEMBLY.sheathingIn,
    slabThicknessIn: DEFAULT_FDN_SLAB_THICKNESS_IN,
    footingDepthIn: DEFAULT_FOOTING_DEPTH_IN,
    footingWidthIn: null, // null → derived from the foundation wall type
  });

  const normaliseLevelAssembly = raw => {
    const base = defaultLevelAssembly();
    if (!raw || typeof raw !== 'object') return base;
    const positive = (value, fallback) =>
      Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
    return {
      wallHeightFt: positive(raw.wallHeightFt, base.wallHeightFt),
      joistType: JOIST_TYPES.some(type => type.id === raw.joistType) ? raw.joistType : base.joistType,
      joistDepthIn: positive(raw.joistDepthIn, base.joistDepthIn),
      joistSpacingIn: positive(raw.joistSpacingIn, base.joistSpacingIn),
      sheathingIn: positive(raw.sheathingIn, base.sheathingIn),
      slabThicknessIn: positive(raw.slabThicknessIn, base.slabThicknessIn),
      footingDepthIn: positive(raw.footingDepthIn, base.footingDepthIn),
      footingWidthIn: Number.isFinite(Number(raw.footingWidthIn)) && Number(raw.footingWidthIn) > 0
        ? Number(raw.footingWidthIn) : null,
    };
  };

  // The floor thickness a level adds on top of the walls below it. Named
  // rather than inlined because a stair's rise is wall height PLUS this, and
  // reading `(joistDepthIn + sheathingIn) / 12` at the call site invites
  // someone to forget the sheathing.
  const levelFloorFt = assembly => (assembly.joistDepthIn + assembly.sheathingIn) / 12;

  window.DraftLevelAssembly = Object.freeze({
    defaultLevelAssembly,
    normaliseLevelAssembly,
    levelFloorFt,
    DEFAULT_WALL_TOP_FT,
    DEFAULT_FLOOR_ASSEMBLY,
    JOIST_TYPES,
    DEFAULT_JOIST_TYPE,
    DEFAULT_FOOTING_DEPTH_IN,
    DEFAULT_FDN_SLAB_THICKNESS_IN,
  });
})();
}
