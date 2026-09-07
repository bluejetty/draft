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

  // NOT EVERY LEVEL FRAMES THE SAME, and until 6 Sep this module could not say
  // so. Commander Devin's ruling that day: the half-level assembly stays a
  // DERIVE, and this file becomes ROLE-AWARE, so there is ONE deriver instead
  // of two vocabularies. No new persisted key -- a role is read off the level,
  // never stored beside it.
  //
  // WHAT THE MISSING VOCABULARY COST. PROJECT.html grew its own copy of this
  // table because it had per-level facts to express and no way to express them
  // here: an 8'-0" foundation pour against the house's 8'-1 1/8", ENTRY's
  // 2x10s, OVER GARAGE's clear span. That copy was a FOURTH -- the three this
  // module was extracted to end were MODEL's, LAYOUT's and the elevation
  // harness's -- and it was never counted, because it did not look like drift.
  // It was not drift. It was the design, kept in the only place that could
  // hold it.
  //
  // So a half-level added on the Model Space drew a 12 5/8" floor while the
  // PROJECT page read 10" for the same level: two pages self-consistent and
  // disagreeing, which is the derive/store divergence class exactly.
  const FOUNDATION_POUR_FT = 8;
  // THE SILL PLATE ON TOP OF THE POUR, and the reason the foundation's wall
  // height is not the pour. Movie, 7 Sep: "default is 8\" conc wall with 1.5\"
  // pt sill plate 8'1.5\" total (default)" and "8'1.5\" foundation it needs a
  // sill plate". The floor bears on the SILL, not on the concrete, so the
  // height a level asks for is pour + sill.
  //
  // IT LIVES HERE NOW, AND IT USED TO LIVE IN project-page.js. That page still
  // exports it and nine call sites still read it from there -- unchanged, and
  // now re-exported from this module rather than declared a second time. A
  // sill thickness typed in two files is the fourth-copy problem, and this
  // repo spent 6 Sep removing one of those.
  //
  // THE PATTERN WAS ALREADY IN THE FILE, FOR THE SPLIT AND NOT FOR THE HOUSE.
  // project-page.js: "The SPLIT's 5'-0\" concrete wall with the 1 1/2\" sill on
  // top is the office default -- 5'-1 1/2\" to the bearing surface, and the
  // entry floor sits on that sill". Same composition, already correct there.
  // The house foundation is the one that never got it.
  const SILL_PLATE_IN = 1.5;
  // 8'-1 1/2" to the bearing line. Composed, not typed: quoting 97.5 here
  // would survive the pour changing, and the pour is the number a drafter
  // actually edits.
  const FOUNDATION_WALL_TOP_FT = (FOUNDATION_POUR_FT * 12 + SILL_PLATE_IN) / 12;
  // ONE HEIGHT FOR EVERY FOUNDATION WALL TYPE, ON PURPOSE. An ICF wall and a
  // PT SPF wood foundation do not stack to the same number as an 8" pour with
  // a sill, and Movie holds those: 7 Sep, "PT SPF wall and ICF wall heights
  // will be different but don't worry about it until you figure out the 8\"
  // conc wall", then "leave them 8'1.5\" for now i will change them in the
  // futre" and "user can change them".
  //
  // SO THIS IS A HELD DECISION, NOT A GAP. All three types default to the
  // concrete answer, and a drafter who needs another types it -- a stored
  // wallHeightFt already beats this default through normaliseLevelAssembly's
  // `positive(raw.wallHeightFt, base.wallHeightFt)`, the same stored-beats-
  // derived contract every other field here has. Written down so the next
  // reader does not invent the other two numbers to "finish" the table.
  // THE ENTRY LEVEL FRAMES IN 2x10, NOT I-JOIST. Movie, 5 Sep: "the entry
  // floor i put 2x10 typical with 3/4" ply sheathing", and 6 Sep: "the entry
  // joists are 9.25" with 3/4" ply sheathing". 9 1/4 + 3/4 = a 10" package.
  const ENTRY_JOIST_IN = 9 + 1 / 4;
  // OVER GARAGE SPANS CLEAR, so it does not get the house's joist. A house
  // floor lands on interior walls every dozen feet; a garage has none, so the
  // 11 7/8" that works over a bedroom will not cross a double bay.
  //
  // 19 1/4" JOIST, AND THE 20 IS THE PACKAGE. Movie, 6 Sep: "make the joists
  // 19.25" with 3/4" sheathing". PROJECT.html carried 20 as the JOIST for a
  // day -- written before the correction, so it contradicted nothing when
  // written -- and drew every over-garage deck 3/4" high.
  const OVER_GARAGE_JOIST_IN = 19 + 1 / 4;

  // A level's ROLE is what it does in the building, not where it sits in a
  // list. Ids are the pages' vocabulary; this is the module's.
  const LEVEL_ROLES = Object.freeze(['floor', 'foundation', 'entry', 'overGarage']);
  // The ids are fixed by the numbering both pages already share -- floors odd,
  // half-levels even, 1 FOUNDATION / 2 ENTRY / 4 OVER GARAGE -- and mapping
  // them HERE is the point of the ruling: one place says which level frames
  // differently, instead of each page keeping its own answer.
  const ROLE_BY_LEVEL_ID = Object.freeze({ 1: 'foundation', 2: 'entry', 4: 'overGarage' });
  const levelRole = levelId => ROLE_BY_LEVEL_ID[levelId] || 'floor';

  // Only what the role CHANGES. Everything unlisted stays the house default,
  // so a role can never quietly re-answer a field it has no opinion about.
  // ONLY WHAT COMMANDER DEVIN RULED, which is the half-levels and nothing
  // else. FOUNDATION IS DELIBERATELY ABSENT.
  //
  // PROJECT.html pours its foundation wall at 8'-0" and MODEL.dc.html has
  // always drawn it at the house's 8'-1 1/8". That is a THIRD divergence, it
  // predates this work, and consolidating it here would have changed the
  // height of an existing drawing's foundation wall with no press behind it --
  // which board #313 forbids and which CI caught: section-view.spec.js:160
  // went red on a garage section whose concrete band moved.
  //
  // So the foundation pour stays PROJECT's own answer until somebody rules
  // it, and this table carries only the two joists that were ruled. A
  // consolidation that quietly resolves an unruled disagreement is not a
  // consolidation, it is a decision nobody made.
  const ROLE_DEFAULTS = Object.freeze({
    // A FOUNDATION IS NOT A FRAMED WALL, and until 7 Sep this table said it
    // was. With no entry here the foundation fell through to
    // DEFAULT_WALL_TOP_FT -- eight-foot STUDS plus a DOUBLE TOP PLATE, a
    // stick-framing formula applied to concrete, landing on 8'-1 1/8" and
    // looking close enough to the right answer to survive.
    foundation: Object.freeze({ wallHeightFt: FOUNDATION_WALL_TOP_FT }),
    entry: Object.freeze({ joistDepthIn: ENTRY_JOIST_IN }),
    overGarage: Object.freeze({ joistDepthIn: OVER_GARAGE_JOIST_IN }),
  });

  // Per-level wall + floor assembly: the WALL HEIGHT and FLOOR JOISTS boxes
  // edit these, and the sidebar's border heights derive from them.
  //
  // THE ROLE IS OPTIONAL AND DEFAULTS TO 'floor', so every existing caller
  // keeps the answer it had. A caller that knows the level passes its role and
  // gets the right one.
  const defaultLevelAssembly = (role = 'floor') => ({
    wallHeightFt: DEFAULT_WALL_TOP_FT,
    joistType: DEFAULT_JOIST_TYPE,
    joistDepthIn: DEFAULT_FLOOR_ASSEMBLY.joistDepthIn,
    joistSpacingIn: DEFAULT_FLOOR_ASSEMBLY.joistSpacingIn,
    sheathingIn: DEFAULT_FLOOR_ASSEMBLY.sheathingIn,
    slabThicknessIn: DEFAULT_FDN_SLAB_THICKNESS_IN,
    footingDepthIn: DEFAULT_FOOTING_DEPTH_IN,
    footingWidthIn: null, // null → derived from the foundation wall type
    ...(ROLE_DEFAULTS[role] || {}),
  });

  const normaliseLevelAssembly = (raw, role = 'floor') => {
    const base = defaultLevelAssembly(role);
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
    levelRole,
    LEVEL_ROLES,
    ROLE_BY_LEVEL_ID,
    FOUNDATION_POUR_FT,
    SILL_PLATE_IN,
    FOUNDATION_WALL_TOP_FT,
    ENTRY_JOIST_IN,
    OVER_GARAGE_JOIST_IN,
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
