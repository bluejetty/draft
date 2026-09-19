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
// Pure, and it reads nothing. Every caller reads it here -- LAYOUT.dc.html
// adopted it in c420e80 and holds no table of its own.
if (!window.DraftLevelAssembly) {
(() => {
  // 8'-1 1/8": eight foot studs on a plate, plus the double top plate.
  const DEFAULT_WALL_TOP_FT = (8 * 12 + 1 + 1 / 8) / 12;
  const DEFAULT_FLOOR_ASSEMBLY = Object.freeze({
    joistDepthIn: 11 + 7 / 8,
    joistSpacingIn: 16,
    sheathingIn: 3 / 4,
  });
  // HOW THICK THAT FLOOR IS, 12 5/8" -- the TJI plus its sheathing, which is
  // the assembly above added up. It lived as a MODEL.dc.html local while the
  // assembly it describes lived here, and the two pages then disagreed:
  // MODEL.html told drawing-format a floor with no stored thickness was 0.75
  // ft, this page said 1.052. Nothing had caught it because the old page
  // always writes the field, so the fallback was only ever reached by a
  // hand-edited file -- and then the two pages would have drawn the same
  // drawing at different thicknesses, in section, where it shows.
  const DEFAULT_FLOOR_THICKNESS_IN = DEFAULT_FLOOR_ASSEMBLY.joistDepthIn
    + DEFAULT_FLOOR_ASSEMBLY.sheathingIn;
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
  // AND IT IS THE BEARING LINE, WHICH IS NOT THE CONCRETE'S OWN HEIGHT. A
  // level asks "how far up does the floor sit", and that is pour + plate;
  // the PROJECT page's FDN WALL box asks "how tall is the pour", and that is
  // this less the attachment. Movie, 16 Sep, reading the label off the
  // section: "it says foundation 8'1.5\" the foundation should be 8' and then
  // the sill plat is 1.5\"".
  //
  // THE STORED NUMBER DID NOT MOVE, on purpose -- MODEL.dc.html stands its
  // foundation walls at this height with no plate of its own, so lowering it
  // to the pour would drop every modelled main floor 1 1/2" and shorten the
  // stair that reaches it. The split lives in the two pages' PRESENTATION:
  // PROJECT shows the pour and the attachment as separate numbers that add
  // back up to this one.
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

  // ── WHAT A LEVEL IS CALLED ON SCREEN ────────────────────────────────────
  //
  // Movie, 19 Sep: "lets name them 0.5 MAIN FL / 1 MAIN FL / 1.5 2ND FL /
  // 2 2ND FL --- this will actually make most sense". The number is WHERE the
  // level sits and the name is WHICH FLOOR IT BELONGS TO, so a bilevel's
  // entry reads as a partial main floor and the room over a garage as a lower
  // second floor -- which is what he called it when he ruled the room over a
  // 2 STOREY garage onto 2ND FL: "the 'over garage' layer is for bilevels
  // when that would be a 'lower' 2nd floor".
  //
  // ONLY THE STOREYS ARE NUMBERED. Movie, same conversation, on FOUNDATION,
  // ROOF, SITE and BONEYARD: those carry no number, because a number here
  // means a floor to stand on and they are not floors. A level a drafter adds
  // himself gets none either -- _addLevel hands out ids from 9 up, which are
  // outside this scheme entirely.
  //
  // DERIVED, NEVER STORED, and that is not a style preference. A level is a
  // RECORD with a `name`, so changing the stored strings would leave every
  // file made before today reading MAIN FL while a new one read 1 MAIN FL --
  // the same level under two names depending on when it was saved. It would
  // also break the lookups that find a level BY name. Derived, a file saved
  // either side of this change is byte-identical, `levels.find(l => l.name
  // === 'MAIN FL')` goes on working, and a locator matching 'MAIN FL' still
  // matches because '1 MAIN FL' contains it.
  //
  // THE ID IS THE IDENTITY. These four ids are constants the pages share and
  // never allocate, so id 2 is the bilevel entry and id 4 the over-garage
  // wherever they turn up. The stored name is honoured where it says
  // something this table does not know -- a drawing whose id 3 is called
  // GROUND reads '1 GROUND', not '1 MAIN FL' -- so the rename never silently
  // eats a word somebody chose.
  const STOREY_NUMBER = Object.freeze({ 2: '0.5', 3: '1', 4: '1.5', 5: '2' });
  const STOREY_FLOOR = Object.freeze({ 2: 'MAIN FL', 3: 'MAIN FL', 4: '2ND FL', 5: '2ND FL' });
  // What these levels are called in a file today, which is the only thing
  // this table is allowed to replace.
  const STOREY_STORED = Object.freeze({ 2: 'ENTRY', 3: 'MAIN FL', 4: 'OVER GARAGE', 5: '2ND FL' });

  const levelLabel = (levelId, storedName) => {
    const number = STOREY_NUMBER[levelId];
    const stored = String(storedName == null ? '' : storedName).trim();
    if (!number) return stored || `level ${levelId}`;
    const floor = (!stored || stored === STOREY_STORED[levelId])
      ? STOREY_FLOOR[levelId] : stored;
    return `${number} ${floor}`;
  };

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
    // The level's exterior wall assembly id. null → the drawing's shared
    // answer: activeWallType's exterior default for a framed floor, 8"
    // concrete for the FOUNDATION. Floors share one type almost always, so
    // this is the rare-split override, not the usual home of the choice.
    // Validated as an id against wall-types.js by the pages that draw — this
    // module holds no wall table and must stay loadable without one.
    // Stud SPACING stays out on purpose: a per-floor spacing is estimating
    // data for later, not part of the assembly's drawn thickness.
    wallType: null,
    // WHAT KIND OF FOUNDATION THIS IS, where wallType says what it is made
    // of. Movie, 17 Sep: "on house foundation side i realized we sill also
    // need a house GRADE BEAM", and, asked whether that belonged beside the
    // wall-type dropdown or inside it: "it will be part of the foundation
    // dropdown because the grade beam will replace the foundation wall".
    //
    // TWO KEYS BECAUSE THEY ARE TWO FACTS, offered as one question. A wall
    // type is a THICKNESS and a layer stack -- wall-types.js owns that table
    // and every page validates a stored id against it -- and a grade beam is
    // none of those things: no strip footing, piles instead, and a crawl
    // space rather than a basement behind it. Filing it as a wall type would
    // hand every reader of wallType a value that is not one. 'wall' is the
    // default and means "ask wallType", so nothing already saved changes.
    foundationKind: 'wall',
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
      wallType: typeof raw.wallType === 'string' && raw.wallType ? raw.wallType : null,
      // Anything but the one other kind normalises back to 'wall', so a
      // hand-edited file or an older save cannot strand a drawing on a
      // foundation no page knows how to draw.
      foundationKind: raw.foundationKind === 'gradebeam' ? 'gradebeam' : 'wall',
    };
  };

  // The floor thickness a level adds on top of the walls below it. Named
  // rather than inlined because a stair's rise is wall height PLUS this, and
  // reading `(joistDepthIn + sheathingIn) / 12` at the call site invites
  // someone to forget the sheathing.
  const levelFloorFt = assembly => (assembly.joistDepthIn + assembly.sheathingIn) / 12;

  // Bind the normaliser to a drawing's stored table. Every board that draws a
  // level asks this question -- MODEL.dc.html, LAYOUT.dc.html and the harnesses
  // each held their own one-liner for it, which is how the role-less callers in
  // #325 happened: the TABLE had one home, the LOOKUP had four.
  const levelAssemblyFor = (levelAssemblies, levelId) =>
    normaliseLevelAssembly(levelAssemblies?.[levelId], levelRole(levelId));

  // The top of the tallest wall on a level, per view. Falls back to the office
  // default when a level has no walls yet -- a level being empty is not the
  // same as its walls being at height zero, and returning 0 would sink a stair.
  const levelWallTopFt = (walls, levelId, view = 'plan') => {
    const tops = (walls || [])
      .filter(wall => wall.levelId === levelId && (wall.view || 'plan') === view)
      .map(wall => wall.topHeight);
    return tops.length ? Math.max(...tops) : DEFAULT_WALL_TOP_FT;
  };

  window.DraftLevelAssembly = Object.freeze({
    DEFAULT_FLOOR_THICKNESS_IN,
    defaultLevelAssembly,
    normaliseLevelAssembly,
    levelRole,
    levelLabel,
    STOREY_NUMBER,
    LEVEL_ROLES,
    ROLE_BY_LEVEL_ID,
    FOUNDATION_POUR_FT,
    SILL_PLATE_IN,
    FOUNDATION_WALL_TOP_FT,
    ENTRY_JOIST_IN,
    OVER_GARAGE_JOIST_IN,
    levelFloorFt,
    levelAssemblyFor,
    levelWallTopFt,
    DEFAULT_WALL_TOP_FT,
    DEFAULT_FLOOR_ASSEMBLY,
    JOIST_TYPES,
    DEFAULT_JOIST_TYPE,
    DEFAULT_FOOTING_DEPTH_IN,
    DEFAULT_FDN_SLAB_THICKNESS_IN,
  });
})();
}
