// LEVEL ASSEMBLY — what one level is made of: its wall height and the floor
// built on top of it.
//
// Pulled out because THREE copies of this had grown: MODEL.dc.html's, an
// identical pair in LAYOUT.html, and a third in proto/elevation-harness.js
// whose comment already admitted it "mirrors LAYOUT.html's
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
// Pure, and it reads nothing. Every caller reads it here -- LAYOUT.html
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
    // AND IT IS AN OPEN WEB JOIST, not a deep TJI. Movie, 28 Sep: "the floor
    // joists will need to be 19.25\" thick OWJ". The depth was already
    // right and the TYPE was still the house's default, so the one level on
    // the drawing that cannot take a TJI was the one labelled TJI. The
    // reason is the paragraph above OVER_GARAGE_JOIST_IN: a garage has no
    // interior walls to land on, and clear-spanning a double bay is what an
    // open web joist is for.
    //
    // ITS DEPTH IS STILL STORED, which is why this is a default and not a
    // rule. JOIST_TYPES carries a null depth for OWJ -- "entered by hand
    // since open-web joists come in many depths" -- so the 19 1/4" beside it
    // is the office answer a drafter may type past.
    overGarage: Object.freeze({
      joistDepthIn: OVER_GARAGE_JOIST_IN, joistType: 'owj' }),
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
  // level asks this question -- MODEL.dc.html, LAYOUT.html and the harnesses
  // each held their own one-liner for it, which is how the role-less callers in
  // #325 happened: the TABLE had one home, the LOOKUP had four.
  const levelAssemblyFor = (levelAssemblies, levelId) =>
    normaliseLevelAssembly(levelAssemblies?.[levelId], levelRole(levelId));

  // ── THE WALLS THAT WERE ON THE DEFAULT FOLLOW IT ────────────────────────
  //
  // Movie, 19 Sep: "if the floor or ceiling is the same height as the
  // DEFAULT, if they change the PROJECT DEFAULT, also change those heights to
  // match", and, accepting what that leaves behind in the same breath: "(the
  // user may need to manually change the 'previously adjusted' height".
  //
  // WHAT WAS BROKEN. A wall's top is COPIED IN when it is drawn, from its
  // storey's wallHeightFt, and never looked at again -- on both pages. So
  // changing the storey's height moved nothing already on the sheet, and a
  // drafter who raised MAIN FL to 9' had to redraw every wall on it.
  //
  // NO NEW KEY, AND NOTHING TO MIGRATE, because Movie's rule IS the
  // comparison: a wall whose top equals the height in force is ON that
  // height, and one that differs is the drafter's. That reading costs
  // nothing and cannot go stale; a stored "I am on the default" flag would
  // be a second fact about the same wall, free to disagree with the first.
  //
  // IT TAKES BOTH TABLES, BEFORE AND AFTER, and that is the whole reason this
  // is a function rather than a rule written at the box that edits a height.
  // Only the moment of the write knows the OLD number -- which is what says
  // which walls were following it. One tick later, the wall at 8'-1 1/2" on a
  // storey now set to 9' is indistinguishable from one a drafter typed.
  //
  // THE TOP, NOT THE BASE. wallHeightFt governs where a wall STOPS; where it
  // starts is the level's own elevation, which is a different number changed
  // by a different control. A base that followed this would move walls for a
  // reason nobody asked for.
  //
  // Returns null when nothing moved, so a caller can leave the walls key
  // alone entirely rather than writing an identical array back.
  const wallsFollowingHeights = (walls, before, after) => {
    if (!Array.isArray(walls) || !walls.length) return null;
    const topFor = (table, levelId) =>
      normaliseLevelAssembly(table?.[levelId], levelRole(levelId)).wallHeightFt;
    // WHICH STOREYS MOVED -- and the key set is the AFTER table's, which is
    // the storeys actually being written. A first-time write is still
    // covered, because such a storey IS in `after`; it simply has no record
    // in `before` and reads the office default there, which is the height it
    // really had.
    //
    // THE UNION OF BOTH WOULD BE A DEFECT, and it was one for as long as it
    // took a mutation to survive and be read properly. A storey present in
    // `before` and absent from `after` is not a storey somebody lowered: it
    // is one the writer's table does not know about -- a level added
    // elsewhere while this tab sat open. Under the union its walls would be
    // dragged to the office default because `after` answered the default for
    // a storey nobody asked about. That is the same snapshot hazard the
    // caller's re-read exists to avoid, arriving by a side door.
    const moved = new Map();
    const ids = new Set(Object.keys(after || {}));
    ids.forEach(id => {
      const was = topFor(before, id);
      const now = topFor(after, id);
      if (Number.isFinite(was) && Number.isFinite(now) && Math.abs(was - now) > 1e-9) {
        moved.set(String(id), { was, now });
      }
    });
    if (!moved.size) return null;
    let changed = false;
    const next = walls.map(wall => {
      // A GARAGE WALL IS NOT THE HOUSE'S. Movie, 6 Oct: "i increased the
      // HOUSE wall (not GARAGE WALL) the garage wall also moved to house
      // height though. they should be different heights". It stands on the
      // same storey, so the height test alone swept it along; it follows
      // the garage's own WALL HEIGHT instead (garageWallsFollowing).
      if (wall?.body === 'garage') return wall;
      const step = moved.get(String(wall?.levelId));
      if (!step) return wall;
      if (!(Math.abs(Number(wall.topHeight) - step.was) < 1e-9)) return wall;
      changed = true;
      return { ...wall, topHeight: step.now };
    });
    return changed ? next : null;
  };

  // The top of the tallest wall on a level, per view. Falls back to the office
  // default when a level has no walls yet -- a level being empty is not the
  // same as its walls being at height zero, and returning 0 would sink a stair.
  const levelWallTopFt = (walls, levelId, view = 'plan') => {
    const tops = (walls || [])
      .filter(wall => wall.levelId === levelId && (wall.view || 'plan') === view)
      .map(wall => wall.topHeight);
    return tops.length ? Math.max(...tops) : DEFAULT_WALL_TOP_FT;
  };

  // ── THE SPLIT'S HEIGHTS: ONE TABLE FOR EVERY PAGE ──────────────────────
  //
  // Movie, 2 Oct, on the premade BILEVEL: "use the 'PROJECT' information for
  // bilevel to determine floor heights and thicknesses". Those numbers are the
  // PROJECT page's section table -- its BILEVEL and MOD BILEVEL rows, which
  // start from project-page.js SPLIT_BASE -- and until now only PROJECT's own
  // wall section read them. Every elevation and section on every other page
  // stood its floors one on top of the next, so an ENTRY level would have
  // come out a whole storey under MAIN FL instead of half of one.
  //
  // THE DEFAULTS ARE HELD HERE AND PROJECT KEEPS ITS COPY, checked equal by
  // proto/section-table-harness.js: project-page.js freezes its table at
  // load, and its harnesses load it without this module in front of it.
  const SPLIT_TYPES = Object.freeze(['bilevel', 'modifiedBilevel']);
  const SPLIT_PLATE_STACK_IN = 1.5 * 3;
  const SPLIT_DEFAULTS = Object.freeze({
    // A 5'-0" pour with the basement made up in wood above it.
    fdnWallHeightFt: 5,
    // An 8' precut sawn in two, on three plates: 4'-2 3/4".
    woodFillHeightFt: (46.25 + SPLIT_PLATE_STACK_IN) / 12,
    // 9'-1 1/8": the 104 5/8" precut on three plates.
    mainWallHeightFt: (104.625 + SPLIT_PLATE_STACK_IN) / 12,
    upperWallHeightFt: (104.625 + SPLIT_PLATE_STACK_IN) / 12,
    // The lower 2nd floor's deck, measured from the ENTRY deck: 6'-3" over
    // MAIN (the Sharma plans' 10 risers of 7 1/2") on a 4'-5 3/8" drop.
    upperDeckAboveEntryFt: 10 + 8.375 / 12,
    upperJoistDepthIn: 11.875,
    upperExtentFt: 5.5,
  });
  const isSplitType = buildType => SPLIT_TYPES.includes(buildType);
  // The row's own number where one was typed, the default where not -- the
  // same "stored beats default" rule as every other field in this file.
  const splitValues = (buildType, row) => {
    const out = { ...SPLIT_DEFAULTS };
    Object.keys(SPLIT_DEFAULTS).forEach(key => {
      const value = Number(row?.[key]);
      if (row?.[key] != null && Number.isFinite(value) && value > 0) out[key] = value;
    });
    ['mainJoistDepthIn', 'mainSheathingIn', 'slabThicknessIn', 'footingDepthIn'].forEach(key => {
      const value = Number(row?.[key]);
      if (row?.[key] != null && Number.isFinite(value) && value > 0) out[key] = value;
    });
    out.upper = buildType === 'modifiedBilevel';
    return out;
  };

  // ── WHERE AN ATTACHED GARAGE'S WALLS TOP OUT ────────────────────────────
  //
  // Movie, 6 Oct: the attached garage's default wall is 9'-1 1/8" + 1'-0 5/8"
  // = 10'-1 3/4" -- it stands on the house SILL, one MAIN floor package
  // below the floor the house walls stand on -- "and then only change it if
  // the user changes the text input". project-page.js keeps the same figure
  // as ATTACHED_GARAGE_WALL_FT for the PROJECT card; section-table-harness
  // holds the two together.
  //
  // THE TOP IS MEASURED FROM MAIN FL, the datum the house's own wall and a
  // garage roof's plateHeightFt (cut-view.js roofBaseElev) are both read
  // from. So a garage wall's stored topHeight, its roof's plate and the
  // house wall can be compared directly: equal tops are one roof.
  const DEFAULT_ATTACHED_GARAGE_WALL_FT = (104.625 + 4.5 + 11.875 + 0.75) / 12;
  const MAIN_LEVEL_ID = 3;
  const attachedGarageWallFt = drawing => {
    const typed = drawing?.sectionTable?.rows?.attachedGarage?.mainWallHeightFt;
    return Number.isFinite(Number(typed)) && typed != null && Number(typed) > 0
      ? Number(typed) : DEFAULT_ATTACHED_GARAGE_WALL_FT;
  };
  const houseWallTopFt = drawing =>
    levelAssemblyFor(drawing?.levelAssemblies, MAIN_LEVEL_ID).wallHeightFt;
  // `dropFt` is how far the garage sill sits under the house sill --
  // cut-view.js garageSillDropFt, 0 on a grade beam.
  const garageTopAboveMainFt = (drawing, dropFt = 0) => attachedGarageWallFt(drawing)
    - levelFloorFt(levelAssemblyFor(drawing?.levelAssemblies, MAIN_LEVEL_ID)) - (Number(dropFt) || 0);

  // THE GARAGE'S WALLS FOLLOW ITS OWN NUMBER, the way the house's follow
  // theirs: a garage wall standing at the old top moves to the new one, and
  // one the drafter set by hand stays. `isDetached` keeps a detached
  // garage's walls out of it -- they answer to a different row.
  const garageWallsFollowing = (walls, wasFt, nowFt, isDetached = () => false) => {
    if (!Array.isArray(walls) || !walls.length) return null;
    if (!Number.isFinite(wasFt) || !Number.isFinite(nowFt) || Math.abs(wasFt - nowFt) < 1e-9) return null;
    let moved = false;
    const next = walls.map(wall => {
      if (wall?.body !== 'garage' || isDetached(wall)) return wall;
      if (!(Math.abs(Number(wall.topHeight) - wasFt) < 1e-6)) return wall;
      moved = true;
      return { ...wall, topHeight: nowFt };
    });
    return moved ? next : null;
  };

  // ── THE ROOF NUMBERS THE PROJECT PAGE OWNS ──────────────────────────────
  //
  // Movie, 6 Oct: set OVERHANG to 5'-0" on the PROJECT page, pressed the
  // BONE, and got a 2 ft eave. MODEL cut every roof with its own ROOF-tool
  // number (2 ft, 4/12) and never read the PROJECT one. This is the one
  // answer to "what overhang and pitch does this roof get", asked by the
  // build and by the PROJECT save alike.
  //
  // THE SAME FALLBACKS THE PROJECT CARDS SHOW. The house reads the split
  // row on a BILEVEL / MOD BILEVEL (splitOr) and the drawing's own number
  // otherwise; a garage reads its own row and falls back to the drawing's
  // number, not the split row's -- cellValue's fallback is the live field.
  const ROOF_ROWS = Object.freeze(['house', 'attachedGarage', 'detachedGarage']);
  const ROOF_LEVEL_ID = 7;   // MODEL.html's ROOF_LEVEL_ID
  const cellNumber = value => (value != null && Number.isFinite(Number(value)) ? Number(value) : null);
  const positiveNumber = value => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);
  const projectRoofFor = (drawing, row = 'house', type = drawing?.buildType) => {
    const rows = drawing?.sectionTable?.rows || {};
    const own = row === 'house' ? (isSplitType(type) ? rows[type] : null) : rows[row];
    const overhangFt = cellNumber(own?.roofOverhangFt) ?? positiveNumber(drawing?.roofOverhang) ?? 2;
    const pitch = cellNumber(own?.roofPitch) ?? positiveNumber(drawing?.roofPitch) ?? 4;
    return {
      overhangFt: Math.min(6, Math.max(0, overhangFt)),
      pitch: Math.min(24, Math.max(0, pitch)),
    };
  };

  // WHICH OF THOSE ROWS A ROOF FOLLOWS. The build stamps `follows`; a roof
  // built before that is read off what it is -- only the build's roofs sit
  // on the ROOF level, a garage roof cut flush against the house is the
  // attached one, and one with an eave all round stands alone. A roof the
  // drafter cut with the ROOF tool sits on its own storey and follows
  // nothing, so a PROJECT change never moves it.
  const roofFollows = roof => {
    if (ROOF_ROWS.includes(roof?.follows)) return roof.follows;
    if (Number(roof?.levelId) !== ROOF_LEVEL_ID) return null;
    if (roof?.garage !== true) return 'house';
    const flush = Array.isArray(roof.edgeOverhang)
      ? roof.edgeOverhang.some(value => Number(value) === 0)
      : (roof.edges || []).includes('gable');
    return flush ? 'attachedGarage' : 'detachedGarage';
  };

  // ── AND A BUILT ROOF FOLLOWS A CHANGED NUMBER ───────────────────────────
  //
  // Movie, 6 Oct: "RESHAPE each time ... allow it to autoregenerate for when
  // i already have a house drawn". The wallsFollowingHeights rule, for roofs:
  // it takes BOTH drawings because only the moment of the write knows which
  // row moved, and a roof follows only the row that did.
  //
  // EACH EDGE MOVES BY ITS OWN DIFFERENCE. An eave or a rake goes from the
  // overhang it has to the new one; a gable cut flush against a wall (zero)
  // stays on the wall. Offsetting the cut roof by the difference lands where
  // cutting the wall loop at the new overhang would, so nothing has to
  // remember the loop the roof was cut from. `offsetVariable` is
  // geometry-2d's offsetOutlineVariable, handed in so this module keeps no
  // geometry of its own.
  //
  // Null when nothing moved, so the caller leaves the roofs key alone.
  const reshapeRoof = (roof, to, offsetVariable) => {
    const points = Array.isArray(roof?.points) ? roof.points : [];
    const count = points.length;
    if (count < 3) return roof;
    const fallback = Number.isFinite(Number(roof.overhang)) ? Number(roof.overhang) : 2;
    const was = Array.isArray(roof.edgeOverhang) && roof.edgeOverhang.length === count
      ? roof.edgeOverhang.map(value => (Number.isFinite(Number(value)) ? Number(value) : fallback))
      : points.map(() => fallback);
    const now = was.map((value, index) =>
      (value > 0 || (roof.edges || [])[index] !== 'gable' ? to.overhangFt : value));
    const delta = now.map((value, index) => value - was[index]);
    let moved = points;
    if (delta.some(d => Math.abs(d) > 1e-9)) {
      const out = offsetVariable(points.map(pt => ({ x: pt.x, z: pt.z })), delta);
      if (!Array.isArray(out) || out.length !== count
        || out.some(pt => !Number.isFinite(pt?.x) || !Number.isFinite(pt?.z))) return roof;
      moved = out.map((pt, index) => ({ ...points[index], x: pt.x, z: pt.z }));
    }
    if (moved === points && roof.pitch === to.pitch && roof.overhang === to.overhangFt) return roof;
    return { ...roof, points: moved, overhang: to.overhangFt, edgeOverhang: now, pitch: to.pitch };
  };
  const roofsFollowingProject = (roofs, before, after, offsetVariable) => {
    if (!Array.isArray(roofs) || !roofs.length || typeof offsetVariable !== 'function') return null;
    const wanted = {};
    ROOF_ROWS.forEach(row => {
      const was = projectRoofFor(before, row);
      const now = projectRoofFor(after, row);
      if (was.overhangFt !== now.overhangFt || was.pitch !== now.pitch) wanted[row] = now;
    });
    if (!Object.keys(wanted).length) return null;
    let reshapedAny = false;
    const following = roofs.map(roof => {
      const to = wanted[roofFollows(roof)];
      if (!to) return roof;
      const reshaped = reshapeRoof(roof, to, offsetVariable);
      if (reshaped !== roof) reshapedAny = true;
      return reshaped;
    });
    return reshapedAny ? following : null;
  };

  window.DraftLevelAssembly = Object.freeze({
    DEFAULT_ATTACHED_GARAGE_WALL_FT,
    attachedGarageWallFt,
    houseWallTopFt,
    garageTopAboveMainFt,
    garageWallsFollowing,
    ROOF_ROWS,
    projectRoofFor,
    roofFollows,
    reshapeRoof,
    roofsFollowingProject,
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
    wallsFollowingHeights,
    levelWallTopFt,
    DEFAULT_WALL_TOP_FT,
    DEFAULT_FLOOR_ASSEMBLY,
    JOIST_TYPES,
    DEFAULT_JOIST_TYPE,
    DEFAULT_FOOTING_DEPTH_IN,
    DEFAULT_FDN_SLAB_THICKNESS_IN,
    SPLIT_TYPES,
    SPLIT_DEFAULTS,
    isSplitType,
    splitValues,
  });
})();
}
