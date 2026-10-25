// MODEL.html's page script, part 12 of 17: a garage's grade beam, rooms over garages, windows over roofs, strings that follow, beams by stairs, storeys, AUTO STAIR, framing.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── WHAT A GARAGE'S GRADE BEAM STANDS ON ──────────────────────────────────
  //
  // Movie, 25 Sep: "i pile per corner and then 1 every 9ft or less ... (even
  // them out if its less than 9ft", and "place a P2 for garage as DEFAULT
  // pile type : P2 | 12" DIA x 15' LONG, 2-15M x 17' VERTICAL | 15.0".
  //
  // THE MARK AND THE DIAMETER ARE ONE ANSWER, not two. P2 is the 12" row of
  // spec-master.js:202's CONCRETE PILE SCHEDULE, so the footing that gets
  // DRAWN is the 12" one; a record whose diameter disagreed with its mark
  // would put two numbers on one hole.
  //
  // NOT MODEL.dc.html's pile10. That page's default was the 10" pile and it
  // placed two of them (:23740), which is a different rule with a different
  // answer -- naming its constant here would look like a port and read as
  // one.
  const GARAGE_PILE_SPACING_FT = 9;
  const GARAGE_PILE_FOOTING = 'pile12';
  // ── P2 OR P3: WHAT THE PILE IS CARRYING ────────────────────────────────
  //
  // Movie, 25 Sep: "pile P2 for a garage with only 1 floor, P3 req if a 2nd
  // floor is over the garage".
  //
  // BOTH ARE 12" DIAMETER -- spec-master.js:202-203, P2 is 12" DIA x 15' LONG
  // and P3 is 12" DIA x 20' LONG -- so the drawn symbol does not move and
  // GARAGE_PILE_FOOTING stays pile12. What changes is the SCHEDULE MARK, and
  // with it the load the row claims: 15.0 kPa against 30.0. A room over the
  // garage is a storey of dead and live load arriving on the same four piles,
  // and it is the LENGTH that answers it -- 20' of skin friction instead of
  // 15'. Nothing about the plan symbol could have said so, which is exactly
  // why the mark is a field rather than a drawing.
  const GARAGE_PILE_MARK_ONE_STOREY = 'P2';
  const GARAGE_PILE_MARK_ROOM_OVER = 'P3';

  // ── AND THERE IS NO FLAG TO READ, SO THE QUESTION IS ASKED GEOMETRICALLY ─
  //
  // The premade's room over the garage gets its deck from
  // `floorRecord(plan.overGarage, upperStorey.id, 'floor')` -- with no
  // `{ garage: true }`, so it is not marked as the garage's own floor. A
  // drafter who draws a floor over a garage by hand marks nothing either.
  // Reading a flag would have answered P2 for both, and the premade is the
  // case Movie was looking at.
  //
  // THE LEVEL IS THE ONE THE GARAGE'S STOREY CARRIES. lowestFloorLevel() is
  // where garage walls stand; floorCarriedBy hands back the level above it,
  // and null at the top of the stack -- a one-storey drawing has no level for
  // a room to be on, which is the P2 case stated rather than assumed.
  //
  // ── HOW MUCH OF THE GARAGE IS BUILT OVER, NOT WHETHER ANYTHING TOUCHES ──
  //
  // TWO WRONG ANSWERS CAME BEFORE THIS ONE, and the second is the useful one.
  //
  // First this asked whether any vertex of either ring lay inside the other.
  // An ATTACHED garage welds to the house along a shared edge, so its corners
  // sit exactly ON the boundary of the floor above, and even-odd
  // point-in-polygon is undefined on a boundary. Pulling the samples off the
  // edge fixed that and did not fix the test.
  //
  // BECAUSE THE GARAGE REALLY DOES LAP THE HOUSE. Measured on the premades:
  //
  //     twoStorey-garage   house x -16..16  z -20..20
  //                        garage x  -4..20  z  19..46
  //
  // The garage runs a foot INTO the house -- GARAGE_TIE_FT, the lap that
  // makes the two buildings one -- so the house's own second floor overlaps
  // the garage outline by a 1 ft x 20 ft strip whether or not anything is
  // built over the garage. Any overlap test answers P3 for every attached
  // garage in a two-storey house.
  //
  // SO THE QUESTION IS HOW MUCH, which is also the physical question: a pile
  // is marked for the load standing on it, and a foot of lap is not a room.
  // The share is estimated by sampling -- a grid over the garage, the samples
  // that fall inside it, and how many of those are also under a floor on the
  // level above. Measured on the same two designs:
  //
  //     twoStorey-garage    20 sq ft of 648    ~3%    the tie alone
  //     twoStorey-over     456 sq ft of 648   ~70%    a room over
  //
  // A quarter is the line, with better than twenty points of margin either
  // side of it. ANY floor on that level counts toward the share rather than
  // each being asked alone, so a garage half covered by the house's floor and
  // half by a bonus room reads as covered rather than as neither.
  const ROOM_OVER_SHARE = 0.25;
  const ROOM_OVER_GRID = 12;
  const garagePileMark = loop => {
    const storey = lowestFloorLevel();
    const above = storey ? floorCarriedBy(storey.id) : null;
    if (!above) return GARAGE_PILE_MARK_ONE_STOREY;
    const floorsAbove = (drawing?.floors || []).filter(floor =>
      Number(floor.levelId) === Number(above.id)
      && (floor.view || 'plan') !== 'foundation'
      && (floor.points || []).length >= 3);
    if (!floorsAbove.length) return GARAGE_PILE_MARK_ONE_STOREY;
    const xs = loop.map(pt => pt.x), zs = loop.map(pt => pt.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const z0 = Math.min(...zs), z1 = Math.max(...zs);
    let inGarage = 0, covered = 0;
    for (let i = 0; i < ROOM_OVER_GRID; i += 1) {
      for (let j = 0; j < ROOM_OVER_GRID; j += 1) {
        // Cell CENTRES, so a sample never lands on the ring's own edge --
        // which is the boundary case that started this.
        const at = {
          x: x0 + ((i + 0.5) / ROOM_OVER_GRID) * (x1 - x0),
          z: z0 + ((j + 0.5) / ROOM_OVER_GRID) * (z1 - z0),
        };
        if (!pointInLoop(loop, at)) continue;
        inGarage += 1;
        if (floorsAbove.some(floor => pointInLoop(floor.points, at))) covered += 1;
      }
    }
    if (!inGarage) return GARAGE_PILE_MARK_ONE_STOREY;
    return covered / inGarage >= ROOM_OVER_SHARE
      ? GARAGE_PILE_MARK_ROOM_OVER : GARAGE_PILE_MARK_ONE_STOREY;
  };
  // HOW FAR BACK FROM THE HOUSE THE FIRST PILE STANDS. Movie, 25 Sep: "the
  // first one should not be at the foundation it should be 4-6 min or 5' max
  // (lets go 4'6 default) the first pile shouldn't effect the foundation/
  // footing so therefore needs to be placed min 4'6 from the foundation wall".
  //
  // A BAND, AND THE DEFAULT IS ITS FLOOR: 4'-6" to 5'-0", placed at 4'-6". So
  // the number only ever moves one way and an engineer raising it has 6" of
  // room before it leaves what Movie named.
  const GARAGE_PILE_STANDOFF_FT = 4.5;
  // TWO PILES CLOSER THAN THIS ARE ONE PILE at the point between them --
  // "piles shouldn't be withing 3ft of each other". Passed explicitly rather
  // than left to pilePoints' default so the page states the number it means;
  // build-house.js owns the rule and proto/auto-piles-harness.js pins it.
  const GARAGE_PILE_MIN_GAP_FT = 3;

  // THE RULE ITSELF, with two callers: the bone press builds a garage and
  // pours its piles in one gesture, and the COLUMN panel's AUTO PILES pours
  // them under a garage already drawn. Movie asked for both -- "when a garage
  // is created from 'OUTLINE' this should be used to add the piles when grade
  // beam is selected", and "we should also add that into the COLUMN command".
  //
  // IT WRITES THE RECORDS AND PUSHES NO UNDO STEP, the same split
  // placeAutoDims and placeAutoBeam take: the bone press folds these into the
  // ONE step that covers the whole building, and a worker with a step of its
  // own would make a premade house cost two Ctrl+Z.
  //
  // THE CENTRELINE, NOT THE OUTLINE. "the pile should be located in the
  // center of the wall" -- and an outline is a wall FACE: footingRings
  // offsets from 0 and -(wallFt + projFt), so the concrete hangs inboard of
  // the loop. Half the wall in is the middle of it, 4" on concrete_8.
  const placeGaragePiles = (loop, { against = null } = {}) => {
    const levelId = FOUNDATION_LEVEL_ID;
    const placed = [];
    if (!levelPresent(levelId)) return { placed };
    const G = window.DraftGeometry2D;
    const WT = window.DraftWallTypes;
    const wallFt = (WT.WALL_TYPES.find(t => t.id === 'concrete_8')?.totalIn || 8) / 12;
    const ring = loop.map(pt => ({ x: pt.x, z: pt.z }));
    const spine = G.offsetOutline(ring, -wallFt / 2);
    // An offset that collapses the loop is not a beam to pile under, the same
    // refusal buildRoofFromFootprint makes for the same reason.
    if (!Array.isArray(spine) || spine.length < 3) return { placed };
    // THE SHARED EDGES ARE TESTED ON THE SOURCE LOOP, not on the inset one --
    // the same trap the footing rings carry a note about. The spine has been
    // moved off the house, so asking whether IT lies on the house answers no
    // for every leg, and the garage would get a row of piles buried in the
    // house wall.
    const shared = against ? G.loopSegments(against) : null;
    const onHouse = index => {
      if (!shared) return false;
      const a = ring[index], b = ring[(index + 1) % ring.length];
      return G.edgeOnLoop(a, b, shared);
    };
    drawing.columns = drawing.columns || [];
    // ONE ANSWER PER GARAGE, not one per pile: every pile under a beam
    // carries the same storeys, and asking per pile would let a rounding
    // difference put two marks under one building.
    const mark = garagePileMark(ring);
    let pileId = newStructureId(drawing.columns);
    window.DraftBuildHouse.pilePoints(spine, {
      maxSpacingFt: GARAGE_PILE_SPACING_FT,
      skipEdge: onHouse,
      // THE STANDOFF RIDES ON `skipEdge`, which is why it is only ever the
      // HOUSE it stands off from: a detached garage passes no `against`, so
      // no edge is skipped, no end is a house end, and every corner keeps its
      // pile. Nothing here has to ask whether the garage is attached.
      standoffFt: GARAGE_PILE_STANDOFF_FT,
      minGapFt: GARAGE_PILE_MIN_GAP_FT,
    }).forEach(point => {
      const column = {
        id: pileId++,
        point: { x: point.x, y: 0, z: point.z },
        levelId,
        view: 'foundation',
        footing: GARAGE_PILE_FOOTING,
        // THE SCHEDULE'S OWN MARK, so the plan and SPECS say one thing. P2
        // and P3 are both 12" DIA (spec-master.js:202-203), which is why the
        // footing above is the 12" one either way: a record whose drawn
        // diameter disagreed with its mark would be two answers to one
        // question. See garagePileMark for which of the two, and why.
        pileMark: mark,
        auto: true,
      };
      drawing.columns.push(column);
      placed.push({ list: drawing.columns, item: column });
    });
    return { placed };
  };

  // The level a BUILDING starts on. floorLevels is bottom-up, so [0] is the
  // lowest storey -- MAIN FL on the standard stack, and MODEL.dc.html's own
  // choice for garage walls (`_floorLevels()[0]`). Never the active level: a
  // drafter looking at the foundation when he presses the bone is not asking
  // for a house made of basement walls.
  const lowestFloorLevel = () => storeyLevels(1)[0] || null;

  // THE LEVELS A BUILDING'S STOREYS GO ON, bottom-up and no more than the
  // design asks for. floorLevels() is already bottom-up, so [0] is the lowest
  // storey -- MAIN FL on the standard stack.
  //
  // A DESIGN CAN WANT MORE STOREYS THAN THE DRAWING HAS LEVELS, and this
  // returns what is there rather than inventing one. Ordering a 2 STOREY into
  // a drawing with a single floor level builds a single storey of it, which
  // is the same principle as the foundation guard: a record filed against a
  // level the drawing does not list is dropped on the next load, and a bone
  // press is not permission to restructure somebody's level stack.
  //
  // NOT THE HALF LEVELS. ENTRY (2) and OVER GARAGE (4) are floors, but they
  // are not storeys a house is stacked on: a bilevel's ENTRY sits UNDER its
  // MAIN FL, and counted here it would be the "lowest storey" the whole house
  // was raised on. The design files its half-level bodies by name.
  const storeyLevels = wanted => window.DraftLayerViews
    .floorLevels(drawing?.levels || [])
    .filter(level => !HALF_LEVEL_IDS.includes(Number(level.id)))
    .slice(0, Math.max(1, Number(wanted) || 1));
  const HALF_LEVEL_IDS = Object.freeze([2, 4]);
  const ENTRY_LEVEL_ID = 2;
  const OVER_GARAGE_LEVEL_ID = 4;
  // ── AND THE ROOM OVER A DETACHED GARAGE IS A FULL STOREY ───────────────
  //
  // Movie, 14 Oct, looking at the levels his 2 storey detached garage came
  // out with: "the Garage 2 storey shouldn't even have a 1.5 floor - it is
  // more like a bungalow than a bilevel".
  //
  // HE IS RIGHT ABOUT THE BUILDING. OVER GARAGE is the HALF storey of a
  // split -- a room over an ATTACHED garage, sitting between MAIN FL and the
  // 2ND FL beside it, which is why the ladder numbers it 1.5. A detached
  // garage is not a split: its bay is one full storey and the room on top is
  // the next, stacked square, with nothing beside either. Filing that room
  // on 4 made the drawing say the opposite of what it is, and said it in the
  // one place he reads it -- "1.5 2ND FL" on every card and every sheet.
  //
  // SO IT GOES ON 2ND FL, which he chose when asked. The cost is named
  // rather than hidden: the deck's joist depth and sheathing are a LEVEL's
  // assembly, so a drawing carrying both a house's 2nd floor and a detached
  // garage's room now has one spec for both decks. That is the trade he
  // took, and PROJECT's detached-garage band follows this constant so the
  // schedule and the model cannot drift apart on which level it means.
  const GARAGE_ROOM_LEVEL_ID = 5;

  // A LEVEL THE DRAWING ACTUALLY HAS. drawing-format.js validates every
  // record's levelId against the drawing's own level list and DROPS the ones
  // it does not recognise -- so concrete written to a FOUNDATION that this
  // drawing has not got would sit in the file, paint once, and be gone on the
  // next load. That is the silent loss this page keeps having to refuse: a
  // record only right until it is reloaded is a file that is wrong now.
  //
  // NOT "ADD THE LEVEL". A drawing with no foundation is a drawing somebody
  // made that way, and a bone press is not permission to restructure it.
  const levelPresent = id => (drawing?.levels || [])
    .some(level => Number(level.id) === id);

  // THE CONCRETE UNDER THE HOUSE: walls, slab and footings, all on FOUNDATION.
  //
  // NO SECOND OUTLINE. The foundation is the same loop raised again in
  // concrete, and an outline for it would be a second footprint for one
  // building -- which every count of outlines reads as two houses.
  // `topHeight` is the wall to the BEARING LINE, pour + sill -- a bilevel
  // pours 5'-0" where a house pours 8'-0". Left out, the wall takes the
  // level's own default, as it always has.
  const raiseFoundationUnder = (loop, { garage = false, topHeight } = {}) => {
    const made = { walls: [], items: [] };
    const levelId = FOUNDATION_LEVEL_ID;
    const fdn = raiseLoop(loop, levelId, {
      viewId: 'foundation',
      wallType: contextWallType('foundation'),
      withOutline: false,
      topHeight,
    });
    made.walls.push(...fdn.walls);

    // THE SLAB, poured to the level's own thickness through floorRecord --
    // the same record the floor gesture writes, so a built slab and a drawn
    // one cannot differ in what a slab IS.
    drawing.floors = drawing.floors || [];
    const slab = floorRecord(loop, levelId, 'foundation', { garage });
    drawing.floors.push(slab);
    made.items.push({ list: drawing.floors, item: slab });

    // THE STRIP FOOTINGS, two rings of ordinary linework with the footing
    // centred on the wall: equal projection past each face. Lifted from
    // _buildHouseFootings, arithmetic and all -- build-house.js already owns
    // the ring offsetting, and the two numbers it needs come from the wall
    // type and the level's own footing width rather than from a literal here.
    const WT = window.DraftWallTypes;
    const wallFt = (WT.WALL_TYPES.find(t => t.id === 'concrete_8')?.totalIn || 8) / 12;
    const projFt = Math.max(0, (assemblyFor(levelId).footingWidthIn / 12) - wallFt) / 2;
    const rings = window.DraftBuildHouse.footingRings(
      loop.map(pt => ({ x: pt.x, z: pt.z })), wallFt, projFt);
    drawing.lines = drawing.lines || [];
    rings.forEach(ring => ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length];
      // A degenerate footing leg is not linework. The offset of a tight
      // corner can collapse one, and drawing-format.js drops a zero-length
      // line on load -- so writing it would be a record that vanishes.
      if (Math.hypot(next.x - point.x, next.z - point.z) < 0.01) return;
      const line = {
        id: newDrawingItemId('line'),
        start: poolVertex({ x: point.x, z: point.z }, levelId, 'foundation'),
        end: poolVertex({ x: next.x, z: next.z }, levelId, 'foundation'),
        levelId,
        view: 'foundation',
        layer: 'S-FOOTING',
      };
      drawing.lines.push(line);
      made.items.push({ list: drawing.lines, item: line });
    }));
    return made;
  };

  // ── THE GARAGE'S OWN CONCRETE ────────────────────────────────────────────
  //
  // Movie ordered a "detached garage 25x25 with frost wall" and got four stud
  // walls. The FROST WALL was recorded on the outline and read by nothing,
  // because the thing that reads it -- MODEL.dc.html's _buildGarageGradeBeam
  // -- had never been ported. So the tile asked him a question and then threw
  // the answer away.
  //
  // THREE FOUNDATIONS, THREE DIFFERENT BUILDINGS, and the difference is not
  // cosmetic:
  //
  //   FROST WALL     concrete standing on a strip footing at the house's
  //                  footing depth -- so it gets footings, and its base is 0.
  //   GRADE BEAM     a band of concrete HANGING off grade, no footing under
  //                  it at all. Its base is its own top less the pour.
  //   THICKENED EDGE no beam and no footing: the slab's own perimeter IS the
  //                  footing, which is what `thickenedEdge` on the slab says.
  //
  // Reading `foundation` and building the same thing for all three would be
  // worse than building nothing, because the drawing would then state a
  // foundation it does not have.
  // `houseTop` IS THE HOUSE'S OWN BEARING LINE when the build poured one of
  // its own -- a split's 5'-0" + sill (Movie, 3 Oct, on a MODIFIED BILEVEL:
  // "the grade beam is missing, the 1.5" sill plate should match height and
  // then 32" grade beam below and the piles under the grade beam"). Read off
  // the level's 8'-0" default instead, the beam was set ~3 ft high against
  // the bilevel's deeper wall bottom: all of it behind the garage's siding
  // and none of it below grade. Left out, the level's default, as before.
  const raiseGarageConcrete = (loop, garage, { against = null, houseTop: bearing } = {}) => {
    const made = { walls: [], items: [] };
    const levelId = FOUNDATION_LEVEL_ID;
    if (!levelPresent(levelId)) return made;
    const S = window.DraftCutView.STANDARDS;
    const kind = garageFoundationOf(garage);
    const detached = garage?.detached === true;
    const houseTop = Number.isFinite(bearing) ? bearing : assemblyFor(levelId).wallHeightFt;
    // ASKS cut-view rather than repeating the subtraction: grade is measured
    // from the top of CONCRETE and `houseTop` is the bearing line, one sill
    // plate above it. Spelled out here, this line read 1 1/2" high -- the
    // same missing plate as the garage tops above, one link further down.
    const grade = window.DraftCutView.gradeFromBearing(houseTop);

    // THE TOP OF THE CONCRETE, per kind. A detached garage sits on its own
    // lot and answers to grade; an attached one is set down from the house so
    // the two sills relate -- Movie, 4 Sep, "sill to sill".
    //
    // AND SILL TO SILL IS ONE PLATE BELOW WHAT THIS LINE USED TO SAY. Movie,
    // 25 Sep: "the garage sill and house sill line up" ... "the concrete
    // starts below the 1.5" sill". `houseTop` is the foundation wall's
    // BEARING line -- pour PLUS plate (level-assembly.js's
    // FOUNDATION_WALL_TOP_FT: "IT IS THE BEARING LINE, WHICH IS NOT THE
    // CONCRETE'S OWN HEIGHT") -- so setting the garage's top of CONCRETE to
    // it put the garage a plate proud of the house it is bolted to. Measured
    // before the fix on a bungalow: house sill 8'-1 1/2", garage sill 8'-3",
    // on both foundation kinds.
    //
    // THE RULE EXISTED TWICE AND HAD ALREADY DRIFTED, which is why it now
    // lives in ONE place. cut-view.js's frostWallTop DRAWS the drop with a
    // split clause -- level on a bilevel, Movie 4 Sep and again 25 Sep -- and
    // this builder applied it unconditionally, so a frost-walled bilevel was
    // BUILT 2 ft down and DRAWN level. garageSillDropFt is now exported and
    // both callers ask it, so the two cannot disagree again.
    //
    // A GRADE BEAM TAKES NO DROP: grade is only 1'-2" under the house sill,
    // so a dropped beam would sit below it. cut-view.js's garageSillDropFt
    // carries that reasoning in full.
    const drop = window.DraftCutView.garageSillDropFt(drawing?.buildType, kind);
    const attachedTop = houseTop - drop - S.GARAGE_BEAM_PLATE_IN / 12;
    const frostTop = detached ? grade + S.DETACHED_BEAM_ABOVE_GRADE_IN / 12 : attachedTop;
    const beamTop = detached ? grade + S.DETACHED_BEAM_ABOVE_GRADE_IN / 12 : attachedTop;

    if (kind !== 'thickened') {
      const topHeight = kind === 'frostwall' ? frostTop : beamTop;
      // A FROST WALL STANDS, A GRADE BEAM HANGS. The one number that says so.
      //
      // AND IT HUNG FOR A DETACHED GARAGE ONLY, which made an attached one's
      // "grade beam" a frost wall wearing the wrong label: base 0 is concrete
      // standing on a strip footing at the house's footing depth, which is
      // the definition three lines above this one, of the OTHER kind.
      // Measured on a fresh 2 STOREY + GARAGE before the fix -- four garage
      // foundation walls, `base 0 top 8.125`, the house's own profile.
      //
      // Movie, 24 Sep: *"please make the DEFAULT attached garages GRADE BEAM
      // and PILES (not frost wall)"*. The KIND was already right --
      // garageFoundationOf answers `gradebeam` when nothing has said
      // otherwise -- so what he was looking at was the kind being read and
      // then built as the other thing. Attached or detached, a grade beam is
      // GARAGE_BEAM_CONCRETE_IN of pour hanging off its own top: 32", which
      // on an attached garage puts 14" of it above grade and 18" below, and
      // nothing under it but the piles.
      const baseHeight = kind === 'frostwall' ? 0
        : topHeight - S.GARAGE_BEAM_CONCRETE_IN / 12;
      const beam = raiseLoop(loop, levelId, {
        viewId: 'foundation',
        wallType: 'concrete_8',
        withOutline: false,
        against,
        baseHeight,
        topHeight,
        body: 'garage',
      });
      made.walls.push(...beam.walls);

      // ── AND THE PILES UNDER A GRADE BEAM ─────────────────────────────
      //
      // A GRADE BEAM HANGS, which is the sentence thirty lines up, and until
      // now nothing was written under it to hang from: this page built the
      // beam and the slab and left the garage standing on nothing at all.
      // Movie's 24 Sep default -- "make the DEFAULT attached garages GRADE
      // BEAM and PILES (not frost wall)" -- arrived half done, and only the
      // half that is drawn was noticed.
      //
      // THE WORKER IS SHARED WITH THE BUTTON. placeGaragePiles is the whole
      // rule and this is one of its two callers; the other is AUTO PILES in
      // the COLUMN panel, for a garage already drawn. A second copy here
      // would be a second answer the moment either moved.
      if (kind === 'gradebeam') {
        const piled = placeGaragePiles(loop, { against });
        made.items.push(...piled.placed);
        made.piles = piled.placed.length;
      }
    }

    // THE SLAB. Four inches, and it FALLS toward the door unless its edge is
    // the footing -- Movie, 4 Sep: "slab 4\" conc slope 1/8\" down from back
    // to the garage door opening (front)".
    drawing.floors = drawing.floors || [];
    const slab = {
      ...floorRecord(loop, levelId, 'foundation', { garage: true }),
      slopeInPerFt: kind === 'thickened' ? 0 : S.GARAGE_SLAB_SLOPE_IN_PER_FT,
      thickness: S.GARAGE_SLAB_THICKNESS_IN / 12,
      thickenedEdge: kind === 'thickened',
    };
    drawing.floors.push(slab);
    made.items.push({ list: drawing.floors, item: slab });

    // THE FOOTINGS, UNDER A FROST WALL ONLY. A grade beam has none by
    // definition and a thickened edge is its own, so writing rings for either
    // would draw concrete that is not there.
    if (kind === 'frostwall') {
      const WT = window.DraftWallTypes;
      const wallFt = (WT.WALL_TYPES.find(t => t.id === 'concrete_8')?.totalIn || 8) / 12;
      const projFt = Math.max(0, (assemblyFor(levelId).footingWidthIn / 12) - wallFt) / 2;
      const shared = against ? window.DraftGeometry2D.loopSegments(against) : null;
      const rings = window.DraftBuildHouse.footingRings(
        loop.map(pt => ({ x: pt.x, z: pt.z })), wallFt, projFt);
      drawing.lines = drawing.lines || [];
      rings.forEach(ring => ring.forEach((point, index) => {
        const next = ring[(index + 1) % ring.length];
        if (Math.hypot(next.x - point.x, next.z - point.z) < 0.01) return;
        // THE SHARED EDGES GET NO FOOTING EITHER, tested on the SOURCE loop
        // rather than the offset ring -- the ring has been moved off the
        // house, so asking whether IT lies on the house would answer no for
        // every leg. The old page tests `polygon[index]` for the same reason.
        const a = loop[index], b = loop[(index + 1) % loop.length];
        if (shared && window.DraftGeometry2D.edgeOnLoop(a, b, shared)) return;
        const line = {
          id: newDrawingItemId('line'),
          start: poolVertex({ x: point.x, z: point.z }, levelId, 'foundation'),
          end: poolVertex({ x: next.x, z: next.z }, levelId, 'foundation'),
          levelId,
          view: 'foundation',
          layer: 'S-FOOTING',
        };
        drawing.lines.push(line);
        made.items.push({ list: drawing.lines, item: line });
      }));
    }
    made.kind = kind;
    return made;
  };

  // THE ROOF OVER IT, cut from the house loop offset by the overhang and laid
  // on the ROOF level. Every edge starts an EAVE, which is _buildHouseRoof's
  // own default -- the drafter flips the gables with the ROOF tool, and this
  // page already has that gesture.
  // A ROOF OVER A LOOP, at the height the body under it bears at.
  //
  // TWO ROOFS OVER ONE BUILDING SIT AT TWO HEIGHTS, and the format already
  // says how. cut-view.js's roofBaseElev bears a roof on the full wall stack
  // UNLESS it carries `garage: true` and a real `plateHeightFt`, in which case
  // it bears at the first floor's top plus that plate -- so a single-storey
  // garage beside a 2 STOREY keeps a single-storey roof instead of a sheet
  // sailing out of the upper wall. drawing-format.js round-trips both fields,
  // so nothing about the file has to change for this.
  //
  // `plateHeightFt` IS A REAL NUMBER OR IT IS ABSENT. The loader reads a
  // stored null as a plate height of ZERO, which bears a garage roof at the
  // main-floor LINE -- on the slab, not on its walls.
  //
  // AND THE EDGES AGAINST THE HOUSE ARE GABLES. An eave there runs the roof
  // plane into the house wall; a gable cuts it vertically at the wall, which
  // is what the wall is there to meet. MODEL.dc.html's _buildGarageRoof makes
  // the same call through the same test -- an edge lying on the house outline
  // -- and it is edgeOnLoop here for the reason the garage's own walls use it:
  // one rule, one home.
  // How far under the taller wall's plate a gabled block's peak stays.
  const GABLE_CLEAR_FT = 1;
  const raiseRoofOver = (loop, opts = {}) => {
    const { garage = false, plateHeightFt = null,
      sourceLevelId = null, against = null, flush = null, rake = null,
      follows = garage ? 'attachedGarage' : 'house', buildType = drawing.buildType,
      stepped = false, cuts = null, notch = null, collect = null, wings = true } = opts;
    const G = window.DraftGeometry2D;
    // ── THE OVERHANG AND PITCH ARE THE PROJECT PAGE'S ────────────────────
    //
    // Movie, 6 Oct: OVERHANG 5'-0" on PROJECT, pressed the BONE, and got a
    // 2 ft eave -- this cut every roof with the ROOF tool's own number.
    // level-assembly.js answers for the row this roof follows, and the roof
    // keeps the row so a later PROJECT change reshapes it.
    const { overhangFt: roofOverhangFt, pitch: roofPitch } =
      window.DraftLevelAssembly.projectRoofFor(drawing, follows, buildType);
    // ── THE LOOP IS CLEANED BEFORE IT IS A ROOF ─────────────────────────
    //
    // A traced house can come back along the wall it just drew -- six feet of
    // north wall walked twice, with no area between the passes. geometry-2d's
    // loopWithoutSpikes says what that costs: the offset meets such a vertex
    // with two ANTIPARALLEL edges, lands a stray point, and hands back a ring
    // with a diagonal across the building. Everything downstream then
    // misbehaves QUIETLY -- cutLoops refuses a ring that is not square, so
    // the rule that keeps a roof from draining into a 2nd-storey wall simply
    // does not run, and nothing says so.
    //
    // AND THE NAMED EDGES FOLLOW IT. `flush` and `rake` are indices into the
    // loop the CALLER handed in; cleaning renumbers them, and a list read
    // against the wrong numbering would gable an edge nobody named. `kept` is
    // the map, and an index whose vertex went is dropped rather than guessed.
    const cleaned = G.loopWithoutSpikes(loop);
    // AND A JOG IN THE WALL IS NOT A JOG IN THE ROOF (Movie, 17 Oct: "should
    // just be a normal hip without the extra little hip where it jogs"):
    // geometry-2d loopWithoutJogs takes a foot of step out of the ring, and
    // the caller's edge numbers follow through both cleanings.
    const unjogged = G.loopWithoutJogs ? G.loopWithoutJogs(cleaned.points)
      : { points: cleaned.points, kept: cleaned.points.map((_, index) => index) };
    let ring = unjogged.points;
    const ringIndexOf = new Map();
    cleaned.kept.forEach((was, mid) => {
      const now = unjogged.edgeIndexOf ? unjogged.edgeIndexOf.get(mid) : unjogged.kept.indexOf(mid);
      if (now !== undefined && now >= 0) ringIndexOf.set(was, now);
    });
    // ── A NARROWER WING ON THIS ROOF'S END IS A ROOF OF ITS OWN ──────────
    //
    // Movie, 16 Oct: "the upper roof should have been 2 separate roofs with
    // a gable on both" ... "draw the lower red roof that connects back to
    // the house wall gable ... make it clear they are 2 different roofs".
    // geometry-2d's roofEndAttachment finds a wing standing on another's
    // END and narrower than it; that wing is raised first, on its own and
    // flush against the rest, and the rest carries on with its end a gable
    // and its rake hanging over the wing's roof. A wing on another's SIDE
    // is not this: it makes a valley and stays in the one ring. Nor is a
    // ring whose edges are named by the design (flush / rake lists) or cut
    // by garage-roofs.js: those designs say where their roofs part.
    const againstLoops = Array.isArray(against) && against.length && Array.isArray(against[0])
      ? against : (against ? [against] : []);
    // THE WING TAKEN OFF IS A BODY THIS ROOF'S END LANDS ON: "a gable on
    // both" -- the wing's roof dies into this end, so this end is a wall.
    const splitOff = [];
    // ── BESIDE A TALLER WALL IT GABLES INTO THE WALL (Movie, 17 Oct) ─────
    //
    // "the 2nd floor wall will be where the roof should be at highest point
    // ... on main roof split the roof into 2 roofs -- front will be gabled
    // away slope from 2nd floor, and back roof can be gabled at front to
    // connect to back of 2nd floor and shed water to sides and hip at back".
    // geometry-2d's roofAgainstWall reads the ring against the wall line it
    // is cut by (`notch`): the block touching that wall most keeps the ring,
    // its whole wall side a gable (flush on the wall, a gable wall past it)
    // and its flanks eaves; every arm in front of that gable wall comes off
    // as a roof of its own -- a shed away from the wall when it touches the
    // wall too. Each piece comes with its edge kinds decided, in its own
    // numbering, so the lists below take them as they are and nothing is
    // re-read as wings afterwards.
    let pieceLists = null;
    let readWings = wings;
    let notchHere = notch;
    let endSplitDone = false;
    if (wings && !stepped && notch && G.roofAgainstWall
      && !(Array.isArray(flush) && flush.length) && !(Array.isArray(rake) && rake.length)) {
      const beside = G.roofAgainstWall(ring, notch);
      if (beside && beside.pieces.length) {
        const [block, ...arms] = beside.pieces;
        arms.forEach(arm => {
          // A DECIDED ARM (the shed) comes with its kinds; an UNDECIDED one
          // (a stub on the block's end, roofEndAttachment's case) takes the
          // ordinary rules, flush where it stands against the block.
          const own = raiseRoofOver(arm.ring, {
            ...opts, flush: arm.flush, rake: arm.decided ? arm.rake : null, wings: !arm.decided,
            against: [block.ring, ...againstLoops],
          });
          if (own && typeof collect === 'function') collect(own);
          if (!arm.decided) splitOff.push(arm.ring);
        });
        if (typeof opts.onGableWall === 'function') beside.gableWalls.forEach(run => opts.onGableWall(run));
        ring = block.ring;
        if (block.decided) {
          pieceLists = { flush: block.flush, rake: block.rake };
          readWings = false;
          if (!beside.notchBlock) notchHere = null;
        } else {
          endSplitDone = true;
        }
      }
    }
    // `wings: false` is a ring the design drew as ONE roof on purpose -- the
    // bilevel's hood over the room and its landing, hipped at every corner
    // (Movie, 6 Oct: "it should be ridgeline to corner at 45") -- and it is
    // neither taken apart nor re-read as wings.
    if (readWings && !endSplitDone && !stepped && !(Array.isArray(flush) && flush.length) && !(Array.isArray(rake) && rake.length)) {
      const apart = G.roofEndAttachment(ring);
      if (apart) {
        const own = raiseRoofOver(apart.wing, {
          ...opts, flush: null, rake: null, against: [apart.rest, ...againstLoops] });
        if (own && typeof collect === 'function') collect(own);
        splitOff.push(apart.wing);
        ring = apart.rest;
      }
    }
    const followClean = list => (Array.isArray(list)
      ? list.map(index => ringIndexOf.get(index)).filter(index => index !== undefined)
      : list);
    // AN ARM COMES BACK THROUGH HERE WITH ITS KINDS NAMED and the same wall
    // line to cut round; it is a piece too.
    if (!pieceLists && notchHere
      && ((Array.isArray(flush) && flush.length) || (Array.isArray(rake) && rake.length))) {
      pieceLists = { flush: followClean(flush || []), rake: followClean(rake || []) };
    }
    // A PIECE IS CUT ROUND THE TALLER WALL BEFORE IT IS OFFSET, not after:
    // cut on the sheet, the overhang beside the cut survives as a strip of
    // roof hanging in the air along the taller wall (the shed's rake ran on
    // past the hood's wall). Cut on the wall ring, the overhang grows from
    // what is left. The cut edges are flush gables; every other edge keeps
    // the kind the piece came with, found by the edge it lies along.
    if (pieceLists && notchHere) {
      const cut = window.DraftPremadePlans.cutLoops(ring, notchHere);
      if (cut) {
        const eps = 1e-6;
        const before = ring;
        const alongOf = (a, b) => (Math.abs(a.z - b.z) < eps ? 'x' : 'z');
        const was = (a, b) => {
          const axis = alongOf(a, b), other = axis === 'x' ? 'z' : 'x';
          const lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
          for (let j = 0; j < before.length; j++) {
            const p = before[j], q = before[(j + 1) % before.length];
            if (alongOf(p, q) !== axis || Math.abs(p[other] - a[other]) > eps) continue;
            const plo = Math.min(p[axis], q[axis]), phi = Math.max(p[axis], q[axis]);
            if (lo >= plo - eps && hi <= phi + eps) return j;
          }
          return -1;
        };
        const points = cut.points.map(pt => ({ x: pt.x, z: pt.z }));
        const flushNow = [], rakeNow = [];
        points.forEach((a, i) => {
          if (cut.onCut[i]) { flushNow.push(i); return; }
          const j = was(a, points[(i + 1) % points.length]);
          if (j >= 0 && pieceLists.flush.includes(j)) flushNow.push(i);
          else if (j >= 0 && pieceLists.rake.includes(j)) rakeNow.push(i);
        });
        ring = points;
        pieceLists = { flush: flushNow, rake: rakeNow };
        notchHere = null;
      }
      // A CUT THE WALL RING REFUSES (an edge of it lying along the wall
      // line) is left to the cut on the sheet, as before.
    }
    // ── THE EDGES AGAINST THE HOUSE ARE CUT FLUSH, NOT OVERHUNG ──────────
    //
    // A roof that dies into a house wall has no eave there and no board to
    // hang one on: the sheet stops at the wall. MODEL.dc.html's
    // _buildGarageRoof says so by building its offset with
    // offsetOutlineVariable and a distance of ZERO on every house-path edge.
    //
    // OFFSET UNIFORMLY, THE GARAGE ROOF GREW INTO THE HOUSE. Measured on the
    // bungalow: the shared edge (16,20)-(-4,20) moved out to z=18, two feet
    // inside the house -- and the elevation then drew a RAKE FASCIA along it,
    // a pair of parallel lines floating in the middle of the house's own roof
    // with no gable under them. Movie marked exactly that in green.
    //
    // So the shared edges take zero and the rest take the overhang, which is
    // the same `against` loop the walls and the gable flags already use --
    // one question asked once, three ways round.
    const sharedWith = againstLoops.length ? againstLoops.flatMap(l => G.loopSegments(l)) : null;
    // ── AND AN EDGE THE DESIGN NAMES, WHICH GEOMETRY CANNOT FIND ─────────
    //
    // Movie, 20 Sep, on the 2 STOREY's garage: "it should be gabled on the
    // house end (not cottage)". The test below is END TO END on purpose -- a
    // wall is raised whole or not at all -- and the garage's rear runs its
    // full width while the house it dies into stops four feet short of that.
    // So the edge that most obviously IS the house end answers `false`, and
    // hips. Measured: `(-4,20)->(20,20)` on the house -> false.
    //
    // MODEL.dc.html SOLVED IT THE SAME WAY, which is where this comes from.
    // Its open garages close their footprint along the house's own boundary
    // path and _buildGarageRoof marks those closing edges gable BY INDEX --
    // `index >= legCount - 1` -- with a distance of zero, rather than asking
    // geometry a question geometry cannot answer.
    //
    // DECLARED IS A UNION WITH DERIVED, never a replacement: a design that
    // names one edge does not stop the others being found. And it carries
    // BOTH halves of "flush" -- the gable AND the zero overhang -- because
    // they are one fact: a roof that dies into a wall has no eave there and
    // no board to hang one on.
    const named = new Set(pieceLists ? pieceLists.flush : followClean(Array.isArray(flush) ? flush : []));
    // ── AND A GABLE THAT DIES INTO NOTHING, WHICH IS A RAKE ──────────────
    //
    // `flush` carries two facts as one -- gable, and no overhang -- and the
    // note above is right about why: a roof that dies into a wall has no eave
    // there and no board to hang one on. Every gable this page had ever built
    // was that kind, so the two never needed separating.
    //
    // Movie, 24 Sep, asked for the first one that is not: *"we will need
    // additional short 2ft extra peice of gable that extends 2ft past the
    // back exterior garage wall"*. A gable end standing in open air, with the
    // ordinary two feet of rake hanging off it -- which is `flush`'s two
    // facts pulled apart, taking the first and not the second.
    //
    // SO IT IS ITS OWN LIST, and it WINS over a derivation: an edge the
    // design calls a rake is one, whatever `against` happens to find under
    // it. `flush` is still a union with derived, because that pair says the
    // same thing; this one says the opposite of half of it.
    const raked = new Set(pieceLists ? pieceLists.rake : followClean(Array.isArray(rake) ? rake : []));
    // AN EDGE THAT RUNS A JOG PAST THE WALL IT DIES INTO IS STILL FLUSH:
    // loopWithoutJogs above straightened the garage's front onto the line
    // a foot north of the house's, so the roof's edge against the room now
    // runs that foot past the room's corner -- all of it on the room's wall
    // line but for the foot, which edgeOnLoop's whole-edge test refuses.
    const mostlyOnLoop = (a, b, segments) => {
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (!(len > 0.01)) return false;
      const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
      let covered = 0;
      (segments || []).forEach(seg => {
        const p = seg.start, q = seg.end;
        const off = p2 => Math.abs((p2.x - a.x) * uz - (p2.z - a.z) * ux);
        if (off(p) > 0.01 || off(q) > 0.01) return;            // not on this line
        const tp = (p.x - a.x) * ux + (p.z - a.z) * uz, tq = (q.x - a.x) * ux + (q.z - a.z) * uz;
        covered += Math.max(0, Math.min(len, Math.max(tp, tq)) - Math.max(0, Math.min(tp, tq)));
      });
      return covered >= len - 1.5 - 0.01 && covered > len / 2;
    };
    const gableEdge = index => {
      if (raked.has(index) || named.has(index)) return true;
      if (!sharedWith) return false;
      const a = ring[index], b = ring[(index + 1) % ring.length];
      return G.edgeOnLoop(a, b, sharedWith) || mostlyOnLoop(a, b, sharedWith);
    };
    const flushAt = index => !raked.has(index) && gableEdge(index);
    const sharedEdge = gableEdge;
    // THE DISTANCE EACH EDGE WAS PUSHED OUT, kept rather than recomputed --
    // it is the only place that knows, and the plan painter needs it to draw
    // a gable's wall line. Every roof before the tie piece had one distance
    // all the way round, so `overhang` alone was the whole truth; a roof with
    // both kinds of gable at once makes it a lie. See drawRoof2D.
    // `stepped`: a ring whose flush and eave stretches share a line (the
    // bungalow's split roofs) is cut by garage-roofs.js, which steps between
    // them rather than slanting across.
    const steppedCut = stepped
      ? window.DraftGarageRoofs.cutRoof(ring, [...named], roofOverhangFt) : null;
    if (steppedCut) {
      drawing.roofs = drawing.roofs || [];
      const roof = {
        id: newDrawingItemId('roof'),
        points: steppedCut.points,
        levelId: ROOF_LEVEL_ID,
        sourceLevelId,
        sourceShapeId: null,
        edges: steppedCut.edges,
        overhang: roofOverhangFt,
        edgeOverhang: steppedCut.edgeOverhang,
        pitch: roofPitch,
        fascia: ROOF_FASCIA_IN,
        garage,
        follows,
        ...(Array.isArray(cuts) && cuts.length ? { cuts: cuts.map(points => ({ points })) } : {}),
        layer: 'A-ROOF',
      };
      if (garage && Number.isFinite(plateHeightFt)) roof.plateHeightFt = plateHeightFt;
      drawing.roofs.push(roof);
      return { list: drawing.roofs, item: roof };
    }
    const edgeOverhang = ring.map((_, index) => (flushAt(index) ? 0 : roofOverhangFt));
    const pts = (sharedWith || named.size || raked.size)
      ? G.offsetOutlineVariable(ring, edgeOverhang)
      : G.offsetOutline(ring, roofOverhangFt);
    // An offset that collapses the loop is not a roof, and the record would be
    // dropped on load anyway -- present on screen, gone after a reload.
    if (!Array.isArray(pts) || pts.length < 3) return null;
    // READ OFF THE SOURCE RING, NOT THE OFFSET ONE. The overhang moves every
    // unshared point outward, so an offset edge no longer lies on the house it
    // was cut against -- asking there would find no gables at all. The two
    // rings have the same edge count and the same order, which is what makes
    // the answer for edge i of one the answer for edge i of the other.
    const gableAt = index =>
      ring.length === pts.length && sharedEdge(index);
    // ── AND NO VALLEY RUNS INTO A CORNER (geometry-2d cricketRing) ───────
    //
    // Movie, 19 Sep and 14 Oct: a cricket where the low points are, "2ft of
    // extra watershed rather than valley running into the corner". An inside
    // corner of this ring is where the skeleton starts a valley, so the
    // corner is cut back 2 ft each way and the valley ends there instead.
    //
    // AFTER the offset and the kinds, never before: the chamfer is a fact
    // about the ROOF -- it is the roof's own valley that must not reach the
    // roof's own corner -- and the kinds are what tell an inside corner
    // standing in open air from one dying into a wall.
    // A PIECE CUT BESIDE A TALLER WALL STEPS where a flush stretch and a
    // rake share one line (geometry-2d offsetOutlineStepped): the variable
    // offset slants between two overhangs on one line, and a slanted gable
    // wall is not a wall.
    const steppedPiece = pieceLists && G.offsetOutlineStepped
      ? G.offsetOutlineStepped(ring, ring.map((_, index) => (gableEdge(index) ? 'gable' : 'eave')), edgeOverhang)
      : null;
    const plain = steppedPiece || {
      points: pts.map(pt => ({ x: pt.x, z: pt.z })),
      edges: pts.map((_, index) => (gableAt(index) ? 'gable' : 'eave')),
      ...(ring.length === pts.length ? { edgeOverhang } : {}),
    };
    // ── THE WALL OF A TALLER BODY CUTS IT FIRST, BEFORE ANY CHAMFER ─────
    //
    // Movie, 16 Oct: "the main rule for that connection should be the roof
    // should be designed in a way (usually using gable design) to slope the
    // main roof AWAY or to the SIDES of the 2nd storey wall lines", and "the
    // rest of the roofs not involved in the connection to the second floor
    // can be drawn as a normal HIP style roof that the user can change to
    // gable if they desire".
    //
    // THE CUT USED TO RUN AFTERWARDS, on the finished record, and on his own
    // traced house it SILENTLY DID NOTHING. Measured from the file he sent:
    // the cricket below had already chamfered the roof's inside corner, and
    // cutLoops refuses a ring that is not square-cornered -- it answered
    // null, notchRoofRound returned false, and nobody was told. The main
    // roof kept a two-foot eave running straight at the room's wall, which
    // is the water he marked in red.
    //
    // SO THE ORDER IS THE FIX, and it is the right order on its own terms:
    // where a roof dies into a wall is a fact about the BUILDING, and the
    // chamfer is a fact about the finished roof. Decide the junction, then
    // shape what is left -- and the chamfer at that corner then goes by
    // itself, because cricketRing already refuses a corner whose edges are
    // gables.
    const notched = notchHere ? notchPlainRoof(plain, notchHere, roofOverhangFt) : null;
    // ── AND NO 45 OF ITS OWN (Movie, 16 Oct) ─────────────────────────────
    //
    // "you know about these 45 degree roof corners we need to get rid of
    // right", and on the 15th: "those 45 degree corners aren't necessary ...
    // they should been all 90 degrees no 45s" ... "there might be a 45 but
    // not in those situation, only if you really need it for a cricket".
    //
    // So the build cuts NO cricket: a roof corner is an outline corner, the
    // valley runs to it, and the plan shows right angles and the hips the
    // skeleton makes of them. geometry-2d's cricketRing stays for the day he
    // adds a cricket himself ("maybe later i will allow the user to design
    // and add crickets to the roof plan if they need them"); the build no
    // longer guesses where one is wanted. `overRoof` above went with it.
    const cut = notched || plain;
    // ── AND THE ENDS: A HIP IN OPEN AIR, A GABLE ON ANYTHING ELSE ────────
    //
    // Movie, 16 Oct, on his own house: "the back on this one could have been
    // a hip", "the upper roof should have been 2 separate roofs with a gable
    // on both", and on the room over the garage, "hip roofs won't fit in
    // that roof version". geometry-2d's roofWingKinds reads the ring as
    // wings, hips a wing's end that stands in open air and gables one that
    // lands on anything -- a narrower wing of this same roof, or a body on
    // any level whose wall is right there. The edges already cut flush
    // against a taller wall stay gables, which is what puts the PEAK at that
    // wall: "the highest part of the main floor roof should be where it
    // connects to the 2nd floor wall and slope away or to the sides".
    //
    // EVERY OUTLINE ON THE DRAWING IS A BODY, the site's apart, because the
    // roof being raised cannot know which storey stands beside its end -- the
    // garage stub beside the room's end is one storey lower, and the main
    // block beside the room's other end is a half-storey higher. Both are
    // walls, and either way the end is a gable.
    //
    // AND EACH BODY CARRIES THE TOP OF ITS WALLS, read off the same level
    // stack the elevations are cut from, beside this roof's own bearing:
    // "the upper 2nd floor roof can be hip no problem because it won't have
    // to worry about height of other walls". A body whose walls stop below
    // this roof's plate is something this roof stands OVER, and the end
    // above it hips; a body at least as tall is a wall the end gables at.
    const CV = window.DraftCutView;
    const sectionEnv = CV ? cutEnv() : null;
    const stack = sectionEnv && CV.sectionLevelStack ? CV.sectionLevelStack(sectionEnv) : null;
    const topOf = levelId => {
      const floor = stack?.floors?.find(level => Number(level.id) === Number(levelId));
      return floor && Number.isFinite(Number(floor.wallTop)) ? Number(floor.wallTop) : null;
    };
    const ownTop = stack && CV.roofBaseElev
      ? CV.roofBaseElev({ garage, plateHeightFt, sourceLevelId, follows }, stack, sectionEnv) : null;
    const bodies = (drawing.outlines || [])
      .filter(outline => Number(outline.levelId) !== SITE_LEVEL_ID
        && Array.isArray(outline.points) && outline.points.length >= 3)
      .map(outline => ({ points: outline.points, top: topOf(outline.levelId) }))
      .concat(splitOff.map(points => ({ points, top: Number.isFinite(Number(ownTop)) ? Number(ownTop) : null })));
    const shaped = readWings ? {
      ...cut,
      edges: G.roofWingKinds(cut.points, cut.edges, bodies, {
        edgeOverhang: cut.edgeOverhang || null, overhangFt: roofOverhangFt,
        top: Number.isFinite(Number(ownTop)) ? Number(ownTop) : null }),
    } : cut;
    // ── AND IT KEEPS UNDER THE WALL IT GABLES INTO (Movie, 17 Oct) ────────
    //
    // "the back roof can have a lower slope if it doesn't fit (like this
    // one)": a block gabled into a taller wall peaks AT that wall, and at
    // the project pitch his back block peaked above the room's plate -- a
    // gable into a roof, not a wall. So the peak is read off the skeleton
    // (the longest wavefront time, times the pitch) and, where it clears
    // the taller wall's top by less than a foot, the pitch comes down to
    // the quarter that fits, and no lower than 2 in 12.
    let pitchHere = roofPitch;
    if (pieceLists && notch && Number.isFinite(Number(ownTop))) {
      const inLoop = (p, ring2) => G.pointInLoop && G.pointInLoop(p, ring2);
      const tallerTop = bodies.reduce((best, body) => {
        if (!Number.isFinite(Number(body.top)) || !(body.top > ownTop)) return best;
        const touches = notch.some(p => inLoop(p, body.points)) || body.points.some(p => inLoop(p, notch));
        return touches ? Math.max(best, Number(body.top)) : best;
      }, -Infinity);
      if (Number.isFinite(tallerTop)) {
        const trial = { points: shaped.points, edges: shaped.edges, pitch: roofPitch };
        const peakRun = G.roofSkeleton(trial).reduce((most, arc) => Math.max(most, Number(arc.ta) || 0, Number(arc.tb) || 0), 0);
        const peak = peakRun * roofPitch / 12;
        const allowed = tallerTop - ownTop - GABLE_CLEAR_FT;
        if (peakRun > 0 && allowed > 0 && peak > allowed) {
          pitchHere = Math.max(2, Math.floor((allowed / peakRun) * 12 * 4) / 4);
        }
      }
    }
    drawing.roofs = drawing.roofs || [];
    const roof = {
      id: newDrawingItemId('roof'),
      points: shaped.points,
      levelId: ROOF_LEVEL_ID,
      sourceLevelId,
      sourceShapeId: null,
      edges: shaped.edges,
      overhang: roofOverhangFt,
      // Indexed like `edges`, and under the SAME guard: an offset that changed
      // the edge count has made the per-edge answer meaningless, and a wrong
      // array is worse than none because the painter would trust it.
      ...(shaped.edgeOverhang ? { edgeOverhang: shaped.edgeOverhang } : {}),
      pitch: pitchHere,
      // A FITTED PIECE REMEMBERS THE PITCH IT WAS ASKED FOR, so the PROJECT
      // row's number is still on the record and a reader can tell a piece
      // lowered to fit under a wall from one the drafter pitched low.
      ...(pitchHere !== roofPitch ? { designPitch: roofPitch } : {}),
      fascia: ROOF_FASCIA_IN,
      garage,
      follows,
      layer: 'A-ROOF',
    };
    if (garage && Number.isFinite(plateHeightFt)) roof.plateHeightFt = plateHeightFt;
    drawing.roofs.push(roof);
    return { list: drawing.roofs, item: roof };
  };

  // ── A WINDOW CLEARS THE ROOF UNDER IT ────────────────────────────────────
  //
  // Movie, 21 Sep: *"the window should be about 4\" over the roof line"*, and
  // when asked which of three ways it should move: *"keep top of window at
  // same spot and subtract size from bottom"*.
  //
  // THE WINDOW HE WAS LOOKING AT IS THE PREMADE PLAN'S, which is why this
  // exists as well as the dealer's copy on MODEL.dc.html.
  // BOARD-a-roof-through-a-window.md said the cause was auto-windows.js and
  // it was wrong: his fixture carries eighteen windows and NONE with
  // `auto: true`. They are premade-plans.js's `upperOpenings()` -- a fixed
  // `8, 16, 24` across the front -- and on the front wall `(16,20)->(-16,20)`
  // offset 8 is `x = 8`, the garage ridge to the foot.
  //
  // THE RULE ITSELF IS THE MODULE'S, both halves. Writing the arithmetic a
  // second time here is how the two pages end up disagreeing about which
  // roofs count, which side of a wall to sample, or what the heights are
  // measured from -- and a disagreement in any of those is a right window on
  // one page and a wrong one on the other. What is genuinely this page's is
  // only what no pure module may reach for: the roof records, their bearing,
  // and the surface height over a plan point.
  //
  // AFTER THE ROOFS, which is why it is called from down there rather than
  // where the openings are placed. The clearance is a height; the heights
  // come from the roofs; the roofs are raised well after the walls.
  //
  // AND ONLY THIS PRESS'S OWN OPENINGS. `raiseLoop` hands back the records it
  // made, so the set is exact: nothing the drafter placed and nothing from an
  // earlier press is touched.
  const clearOpeningsOverRoofs = bodies => {
    const AW = window.DraftAutoWindows;
    const CV = window.DraftCutView;
    const G = window.DraftGeometry2D;
    if (!AW?.roofProfileAlong || !CV || !G) return { lifted: 0, dropped: 0 };
    if (!(drawing.roofs || []).length) return { lifted: 0, dropped: 0 };
    const env = cutEnv();
    const stack = CV.sectionLevelStack(env);
    if (!stack?.floors?.length) return { lifted: 0, dropped: 0 };
    // The skeleton once per roof, not once per sample: a 40 ft wall asks a
    // hundred and sixty times.
    const roofs = drawing.roofs
      .filter(roof => (roof.points || []).length >= 3)
      .map(roof => ({
        roof,
        // THE EAVE, NOT THE BEARING. `riseAt` measures from the eave line,
        // so this has to be the elevation the rise is measured from or the
        // clearance is struck against a roof one fascia board lower than
        // the one on the sheet. It was `roofBaseElev` and the window Movie
        // marked sat an inch and a half inside the garage ridge because of
        // it: 4" of clearance, less 5 1/2" of fascia nobody counted.
        base: CV.roofEaveElev(roof, stack, env),
        riseAt: ((faces) => (pt, r) => CV.sectionRoofHeightAt(pt, r, faces))(
          G.roofFaces(roof, G.roofSkeleton(roof))),
      }));
    const wallById = new Map((drawing.walls || []).map(w => [w.id, w]));
    // geometry-2d.js keeps two of these and exports neither, so this is the
    // third copy rather than a reach into a module's private. Same crossing
    // count MODEL.dc.html's _autoWindowFaces uses to point its normals out.
    const inRing = (p, ring) => {
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i];
        if ((a.z > p.z) !== (b.z > p.z)
          && p.x < a.x + (b.x - a.x) * (p.z - a.z) / (b.z - a.z)) hit = !hit;
      }
      return hit;
    };
    let lifted = 0;
    const dropped = [];
    bodies.filter(b => b && b.loop && b.body).forEach(({ loop, body }) => {
      const ring = loop.map(p => ({ x: p.x, z: p.z }));
      const windows = (body.openings || []).filter(o => o && o.type === 'window');
      if (!windows.length) return;
      const byWall = new Map();
      windows.forEach(o => {
        const list = byWall.get(o.wallId) || [];
        list.push(o);
        byWall.set(o.wallId, list);
      });
      byWall.forEach((list, wallId) => {
        const wall = wallById.get(wallId);
        if (!wall) return;
        const floor = stack.floors.find(lvl => lvl.id === list[0].levelId);
        if (!floor) return;
        const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
        const lengthFt = Math.hypot(dx, dz);
        if (!(lengthFt > 0.5)) return;
        const u = { x: dx / lengthFt, z: dz / lengthFt };
        // WHICH SIDE IS OUTSIDE, asked of the LOOP and not of the wall. A
        // wall's centreline stands half its thickness inside the line it was
        // raised on, so a short probe off the wall can still land inside the
        // body; a foot clears any wall this app builds and is well short of
        // the narrowest body it can raise.
        let out = { x: -u.z, z: u.x };
        const mid = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
        if (inRing({ x: mid.x + out.x, z: mid.z + out.z }, ring)) {
          out = { x: -out.x, z: -out.z };
        }
        const profile = AW.roofProfileAlong({
          start: wall.start, u, outward: out, lengthFt, roofs,
          floorTopFt: floor.floorTop, wallTopFt: floor.wallTop,
        });
        if (!profile) return;
        list.forEach(o => {
          const cleared = AW.clearRoofUnder({
            roofFt: profile, offsetFt: o.offset, widthFt: o.width,
            sillFt: o.sillHeight, headFt: o.headHeight,
          });
          // NO GLASS LEFT IS NO WINDOW, and the record goes with it: a sill
          // above its own head is not a short window, it is a hole in the
          // drawing that reads as one.
          if (!cleared) { dropped.push(o.id); return; }
          if (!cleared.lifted) return;
          o.sillHeight = cleared.sillFt;
          lifted += 1;
        });
      });
    });
    if (dropped.length) {
      const gone = new Set(dropped);
      drawing.fenestrations = (drawing.fenestrations || []).filter(o => !gone.has(o.id));
    }
    return { lifted, dropped: dropped.length };
  };

  // ── AUTO DIMS ────────────────────────────────────────────────────────────
  //
  // Exterior dimension strings on all four sides of a plan. Per side the
  // closest string dims corner to corner through the fenestration centres
  // facing that side, the next dims every footprint jog, and the outermost is
  // the overall.
  //
  // THE COMPUTATION IS NOT PORTED, BECAUSE IT WAS ALREADY SHARED. auto-dims.js
  // was extracted pure out of the old page -- plain data in, segments out, no
  // THREE and no DOM -- and had exactly one caller. This is the second, and it
  // passes the same arguments to the same function. Everything below is the
  // stateful shell the module deliberately does not own: filtering the
  // collections, resolving opening centres, and turning segments into records.
  //
  // AN INTEGER ID, WHICH IS NOT THIS PAGE'S USUAL KIND. Walls and outlines
  // wear `wall-3`; drawing-format.js:dimensions requires `Number.isInteger`
  // and refuses anything else, so a dimension carrying this page's ordinary id
  // would be dropped on the next load -- present on screen, gone after a
  // reload. The counter is the old page's `nextDimensionId`, which survives
  // here on `...parsed`, and it is recovered the way the old LOADER recovers
  // it rather than trusted: the max of the stored counter and every id already
  // in the drawing. A counter alone is wrong the moment a file arrives without
  // one, and a collision writes a dimension that silently replaces another.
  const newDimensionId = () => {
    const used = (drawing?.dimensions || [])
      .map(dimension => Number(dimension.id))
      .filter(Number.isInteger);
    const stored = Number.isInteger(drawing?.nextDimensionId) ? drawing.nextDimensionId : 1;
    const next = Math.max(1, stored, ...used.map(id => id + 1));
    drawing.nextDimensionId = next + 1;
    return next;
  };

  // WHAT THE STRINGS ARE DRAWN AROUND, for one level and one layer view.
  // Returns { placed, removed }, or -1 when the level holds nothing with
  // enough size to string -- the old page's own signal, and the reason a
  // caller can tell "nothing to dimension" from "dimensioned nothing".
  //
  // BOTH LISTS, because re-running REPLACES this level and view's own auto
  // strings, and an undo that only took the new ones away would leave the
  // drafter with neither: the ones it swept would be gone for good. They are
  // rarely anything -- a fresh build sweeps nothing -- and that is exactly
  // why a loss here would go unnoticed until the one drawing where it did.
  // ── THE STRINGS FOLLOW WHAT THEY MEASURE ────────────────────────────────
  //
  // Movie's list: "dimensions attached to what they measure". They were not.
  // A dimension is two points and nothing else -- the format carries no link
  // to the wall it was strung off -- so dragging a wall left every string
  // where it was, still reading the old number. Measured on this page: a 20 ft
  // house whose east wall is dragged 4 ft east keeps a 20'-0" overall string
  // standing over a 24 ft building, and only pressing AUTO DIMS again fixes
  // it. A drawing that is wrong until somebody remembers a button is worse
  // than one that never had the strings.
  //
  // ATTACHED BY RE-DERIVING, NOT BY A LINK. The alternative was a reference on
  // each end -- "this one measures corner X, standing `by` feet off it" -- and
  // it is the bigger change in every direction: a format addition, a migration
  // for every drawing already saved, and a second rule for what a string is
  // measuring that has to agree with auto-dims' own for the drawing to make
  // sense. auto-dims ALREADY answers "where do the strings go for this
  // geometry", and placeAutoDims already sweeps its own and keeps the rows the
  // drafter slid (`moved`). So the move asks it again, which is the same
  // answer by the only rule there is.
  //
  // ONLY WHERE THERE ARE AUTO STRINGS ALREADY. A drafter who has never pressed
  // AUTO DIMS must not find a dimensioned plan because he nudged a wall --
  // this follows strings, it does not start them. Hand-drawn dimensions are
  // not auto and are never swept, so they stay exactly as they are (and stay
  // stale, which is the honest answer: the page does not know what a string
  // the drafter drew himself was measuring).
  const redimAfterMove = () => {
    if (!drawing) return null;
    const levelId = activeLevelId();
    const view = activeViewId() || 'plan';
    const already = (drawing.dimensions || []).some(dim => dim.auto === true
      && Number(dim.levelId) === Number(levelId) && (dim.view || 'plan') === view);
    if (!already) return null;
    const result = placeAutoDims(levelId, view);
    return result === -1 ? null : result;
  };

  // The two lists an undo step carries when a gesture also re-laid the
  // strings: what it added, and what it swept to add them. Written once and
  // used by the move steps below -- 'built' keeps its own copy of these loops
  // because it interleaves a selection sweep between them.
  //
  // APPENDED, NEVER ASSIGNED. §6's answer puts its piles on the same `items`
  // before this runs, and a step that took the list over would hand undo the
  // dimensions and keep the piles -- one Ctrl+Z leaving concrete in the
  // ground under an overhang that is no longer there.
  // AND WHILE AN OPENING SLIDES, THE STRINGS FOLLOW IT LIVE (Movie, 20 Oct:
  // "it would be really nice to autoupdate those fenstration dimensions
  // immediately if possible (so the user can see what they move the opening
  // too in REAL time"). The strings on the level are noted as the drag
  // begins and asked again on every move; on the release the step takes back
  // what the last ask put down and restores what was there BEFORE the drag
  // -- not the in-between strings the hand passed through -- so one UNDO
  // still puts the plan back as it was. Null where there are no auto strings
  // to follow, for redimAfterMove's reason.
  const liveRedimBegin = () => {
    if (!drawing) return null;
    const levelId = activeLevelId();
    const view = activeViewId() || 'plan';
    const here = (drawing.dimensions || []).filter(dim => dim.auto === true
      && Number(dim.levelId) === Number(levelId) && (dim.view || 'plan') === view);
    return here.length ? { levelId, view, before: here } : null;
  };
  const liveRedimStep = live => { if (live) placeAutoDims(live.levelId, live.view); };
  const liveRedimFold = (step, live) => {
    if (!live) return foldRedim(step);
    liveRedimStep(live);
    const list = drawing.dimensions || [];
    const placed = list.filter(dim => dim.auto === true && Number(dim.levelId) === Number(live.levelId)
      && (dim.view || 'plan') === live.view && !live.before.includes(dim));
    const removed = live.before.filter(dim => !list.includes(dim));
    (step.items = step.items || []).push(...placed.map(item => ({ list: drawing.dimensions, item })));
    if (removed.length) (step.restored = step.restored || []).push({ list: drawing.dimensions, items: removed });
    return step;
  };
  const foldRedim = step => {
    const redim = redimAfterMove();
    if (!redim) return step;
    (step.items = step.items || []).push(
      ...redim.placed.map(item => ({ list: drawing.dimensions, item })));
    if (redim.removed.length) {
      (step.restored = step.restored || [])
        .push({ list: drawing.dimensions, items: redim.removed });
    }
    return step;
  };

  const placeAutoDims = (levelId, view) => {
    if (!drawing) return -1;
    const G = window.DraftGeometry2D;
    const AD = window.DraftAutoDims;
    // The ELECTRIC sheet dims the walls it is drawn over, which live on the
    // plan -- MODEL.dc.html's own first line of _placeAutoDims.
    const wallView = view === 'e-power' ? 'plan' : view;
    const walls = (drawing.walls || []).filter(wall =>
      Number(wall.levelId) === levelId && (wall.view || 'plan') === wallView);
    const outlines = (drawing.outlines || []).filter(outline =>
      Number(outline.levelId) === levelId && (outline.points || []).length >= 3);
    // ROOFS ONLY ON THE ROOF LEVEL, where the module strings each footprint
    // for the truss designer instead of stringing the walls.
    const roofs = levelId === ROOF_LEVEL_ID
      ? (drawing.roofs || []).filter(roof =>
        Number(roof.levelId) === levelId && (roof.points || []).length >= 3)
      : [];
    // THE OPENING CENTRES, resolved through the same geometry the painter
    // uses. openingsOn already refuses an opening its wall cannot carry, so
    // this list holds nothing the drawing does not really have.
    //
    // AND THE HOST WALL COMES WITH EACH ONE, because the module needs it: it
    // reads the wall's own direction to decide which side of which footprint
    // the opening belongs to, and hands a wall shared by two footprints to the
    // smaller group so a garage door dims with the garage. Looked up by id
    // from the SAME filtered list, so an opening whose wall is not on this
    // level and view drops out rather than dragging a foreign wall in.
    const wallById = new Map(walls.map(wall => [String(wall.id), wall]));
    const openings = openingsOn(walls, true)
      .map(entry => ({
        center: entry.geometry && entry.geometry.center,
        wall: wallById.get(String(entry.opening.wallId)),
      }))
      .filter(entry => entry.center && entry.wall);
    // A FLOOR LAYOUT DIMENSIONS THE FLOOR (Movie, 16 Oct: the floor layouts
    // dimension the floor only, not out to the garage). The garage has no
    // floor framing on this sheet -- its slab is the foundation's -- so its
    // outline leaves the perimeter stack here and the strings stop at the
    // house. Every other view keeps the building whole.
    const strung = view === 'floor' ? outlines.filter(outline => !outline.garage) : outlines;
    const segments = AD.computeAutoDimStrings({
      walls, outlines: strung, roofs, openings,
      offsetOutline: (pts, dist) => G.offsetOutline(pts, dist),
      firstOffset: autoDimFirstOffsetFt(),
      jogMergeFt: AD.JOG_MERGE_FT,
      stringSpacingFt: AD.STRING_SPACING_FT,
      // THE INTERIOR STRING'S TWO INPUTS, and it draws nothing without them.
      // A wall's FACES are what that string measures to, and a face is the
      // stored line offset by a thickness this module has never known -- the
      // wall-type table lives on this page. `openingThicknessFt` is the same
      // resolver the fenestration geometry uses, so a dimension lands on the
      // face a jamb was drawn against rather than near it.
      thicknessFt: openingThicknessFt(),
      faceOffsets: G.wallFaceOffsets,
      // THE BEAM LINES, LOCATED ON THE OUTSIDE OF A FRAMING SHEET (Movie, 11
      // Oct: "put it on the EXT of the plan"). The same beams the column
      // stack below reads, and none on any other sheet.
      beams: view === 'floor' || view === 'foundation'
        ? (drawing.beams || []).filter(beam => Number(beam.levelId) === levelId && beam.view === view)
        : [],
    });
    // ── AND THE COLUMN STACK, ON THE TWO SHEETS THAT FRAME ───────────────
    //
    // Movie, 29 Sep: "on the FLOOR LAYOUT and FOUNDATION LAYOUT the
    // A-DIMS-COLS layer should measure the columns (and beam since the col
    // sits on it) from both directions".
    //
    // GATED ON THE VIEW, not left to each record's own `view` field. A beam
    // can be stored on 'plan', and posts strung across the walls plan are
    // clutter on the sheet a client reads. The two views that want them are
    // the ones a framer builds from -- which is what he asked for.
    const framing = view === 'floor' || view === 'foundation';
    const onThisSheet = list => (list || []).filter(item =>
      Number(item.levelId) === levelId && item.view === view);
    const columnSegments = framing ? AD.computeColumnDimStrings({
      beams: onThisSheet(drawing.beams),
      columns: onThisSheet(drawing.columns),
      outlines,
      walls,
      // The stair hole, so a string does not run across it. Same filter the
      // painter uses at :2448 -- level, host and a real polygon.
      floorOpenings: (drawing.surfaceOpenings || []).filter(opening =>
        Number(opening.levelId) === levelId && opening.hostType === 'floor'
        && (opening.points || []).length >= 3),
      // THE STACK ALREADY OUTSIDE, so an opening string sent out past the
      // wall (within 3 ft of it) lands one row beyond the perimeter rows.
      perimeter: segments || [],
      firstOffsetFt: autoDimFirstOffsetFt(),
      stringSpacingFt: AD.STRING_SPACING_FT,
    }) : [];
    // THE EARLY RETURN IS UNCHANGED FOR THE CASE IT WAS WRITTEN FOR. It fires
    // when computeAutoDimStrings finds nothing big enough to string, and that
    // must still mean "keep the dims you have" rather than "clear them". What
    // it no longer does is throw away a column stack on a level whose
    // perimeter could not be strung.
    if (!segments && !columnSegments.length) return -1;
    const allSegments = [...(segments || []), ...columnSegments];
    if (!Array.isArray(drawing.dimensions)) drawing.dimensions = [];
    // RE-RUNNING REPLACES THIS LEVEL AND VIEW'S OWN AUTO STRINGS and nothing
    // else. `auto: true` is what separates a generated string from one a
    // drafter drew, and a hand-drawn dimension must survive a rebuild --
    // which is why commitWall's note says this page never invents that key.
    const made = [];
    const removed = [];
    drawing.dimensions = (drawing.dimensions || []).filter(dimension => {
      const mine = dimension.auto === true && Number(dimension.levelId) === levelId
        && dimension.view === view;
      if (mine) removed.push(dimension);
      return !mine;
    });
    // A ROW THE DRAFTER MOVED STAYS MOVED (Movie, 6 Oct: "Keep my moves").
    // Each moved record says where its row was first put and how far it has
    // come; a fresh string landing on that same first line is put the same
    // distance off, and says so too. Only the measurements are new.
    const rowKey = (axis, at, layer) => `${axis}|${Math.round(at * 1000)}|${layer || ''}`;
    const movedRows = new Map();
    removed.forEach(d => {
      const m = d.moved;
      if (m && (m.axis === 'x' || m.axis === 'z') && Number.isFinite(m.from) && Number.isFinite(m.by)) {
        movedRows.set(rowKey(m.axis, m.from, d.layer), m);
      }
    });
    const keepMove = (dimension) => {
      const { start, end } = dimension;
      const axis = Math.abs(start.z - end.z) < 1e-6 ? 'z' : (Math.abs(start.x - end.x) < 1e-6 ? 'x' : null);
      const m = axis && movedRows.get(rowKey(axis, start[axis], dimension.layer));
      if (!m) return;
      start[axis] += m.by;
      end[axis] += m.by;
      dimension.moved = { axis, from: m.from, by: m.by };
    };
    allSegments.forEach(segment => {
      // THE srcIds ARE DROPPED, AND THAT IS A REAL LOSS RATHER THAN A TIDY-UP.
      // The module returns srcStartId/srcEndId so the old page can link each
      // end to a master corner, and its dims then FOLLOW when that corner is
      // dragged. This page writes no srcIds on anything -- not outlines, not
      // roofs -- so there is nothing here to link to, and a dimension that
      // claimed a link it does not have would be worse than one that admits
      // it has none. Re-run after an edit, which is what the old page's own
      // message tells a drafter to do.
      // THE LAYER IS KEPT WHERE THE srcIds ARE DROPPED, and the difference is
      // that this one is not a link to something this page does not have --
      // it is the module's own answer to "what does this string measure",
      // decided at the push in auto-dims.js where the kind was still known.
      // Nothing downstream can re-derive it: by here every kind is two points
      // and a distance. Dropping it would leave the drafter with five kinds
      // of dimension and one switch, which is what this change is undoing.
      const dimension = {
        id: newDimensionId(),
        start: { x: segment.start.x, y: 0, z: segment.start.z },
        end: { x: segment.end.x, y: 0, z: segment.end.z },
        levelId,
        view,
        layer: segment.layer,
        auto: true,
      };
      keepMove(dimension);
      drawing.dimensions.push(dimension);
      made.push(dimension);
    });
    return { placed: made, removed };
  };


  // ── AUTO BEAM + COLUMNS ─────────────────────────────────────────────────
  //
  // Movie, 25 Sep: "ther AUTOBEAM placement was removed a house over 19 ft
  // wide needs a beam and columns in the basement / foundation" ... "the DC
  // version had it" ... "the AUTOBEAM/COLUMN should be available in the
  // build/ BEAM & COLUMN buttons".
  //
  // NEVER WIRED, RATHER THAN REMOVED, and the difference is where to look.
  // build-house.js:88 `midSpanBeams` came across whole and is exported;
  // MODEL.dc.html calls it twice -- :4356 on the tour and :4828 when a stair
  // re-derives the beam -- and MODEL.html calls it NOWHERE. The live page
  // paints beams and columns it has no gesture to create.
  //
  // AND NINE GREEN SPECS SAID NOTHING. tests/beam-corner.spec.js covers this
  // geometry through helpers.openModel, which navigates to /MODEL.dc.html
  // (tests/helpers.js:154) -- so every auto-beam assertion in the suite is
  // about the page the app cannot reach. A spec driving THIS page is part of
  // the fix rather than a follow-up.
  //
  // THE FOUNDATION ONLY, FOR NOW. Movie's rule is wider -- "the columns and
  // beams that will be needed on the main floor if there is a 2nd floor" --
  // and an upper floor needs two things that are not here yet.
  //
  // ONE is his stacking rule: "the columns and beams are most often located
  // over top of each other ( this is always the case for a columns - it need
  // to be over another column ... or over a solid wall ... (which acts as a
  // column". midSpanBeams cannot express it. It asks `bearsAt` at a run's two
  // ENDS ONLY (build-house.js:290) and divides the interior evenly, with no
  // reference to anything underneath -- so two identical runs stack by
  // coincidence and drift apart the moment a footprint or a stair opening
  // differs between the floors.
  //
  // THE OTHER is somewhere to draw the post: S-COL-FOOTING is in the
  // FOUNDATION view's layer list and in no floor view's (layer-views.js:32
  // against :23). A main-floor column filed today would be a record that
  // paints nowhere -- on screen never, in the file always.
  //
  // AND THE ROOF EXCLUDES ITSELF, which is the same rule rather than a second
  // one. Movie: "usually a roof won't need columns or beams (usually the
  // exterior walls do the complete job ... not likely on the exterior ei
  // overhanging roof over deck)". A level earns a beam from the FLOOR it
  // carries, and the top storey carries no floor.

  // WHERE THE HOUSE IS, NOT WHERE THE DRAFTER IS STANDING. The FOUNDATION
  // carries no outline of its own -- raiseFoundationUnder is explicit that a
  // second footprint for one building is what every count of outlines reads
  // as two houses -- so the loop comes off the lowest floor level, which is
  // where the bone puts it.
  //
  // THE GARAGE IS SKIPPED. Its slab is not the floor this beam carries, and a
  // loop taken across both bodies would run a beam through the garage.
  // MODEL.dc.html picks the same way, `!outline.garage` (:4804).
  // EVERY BODY ON A STOREY, not one of them. A level can hold more than one
  // closed loop -- a 2 STOREY WITH ROOM OVER GARAGE puts the house's own upper
  // floor AND the room over the garage on 2ND FL -- and each is a floor with
  // its own clear span.
  //
  // "LAST ONE WINS" WAS WRONG HERE, and measurably: on twoStorey-over the
  // outlines on 2ND FL are the house at 32 x 40 and the room over the garage
  // at 24 x 19, in that order. Taking the last one measured the room, whose
  // short span is exactly 19 and so needs nothing, and the house's forty feet
  // were never asked about. The main floor came back with no beam at all and
  // nothing said so.
  const storeyBodies = (storeyLevel = null) => {
    const storey = storeyLevel || lowestFloorLevel();
    if (!storey) return [];
    return (drawing?.outlines || [])
      .filter(outline => Number(outline.levelId) === Number(storey.id)
        && outline.garage !== true
        && (outline.points || []).length >= 3)
      .map(outline => ({ outline, storeyId: storey.id }));
  };

  // EVERY BODY OF THE STOREY A LEVEL CARRIES, both halves of it. A MOD
  // BILEVEL files the landing's outline on 0.5 MAIN FL and the rest of the
  // floor on 1 MAIN FL, and they are two pieces of ONE floor for the level
  // underneath to hold up -- so the foundation frames both, and each is
  // still measured on its own as storeyBodies has always done. Each body
  // keeps its OWN level in `storeyId`, which is what the notes and the
  // over-garage test read: a note about the landing belongs on the landing's
  // sheet even when the foundation is what framed it.
  const storeyBodiesOver = levelId =>
    storeyLevelsOver(levelId).flatMap(level => storeyBodies(level));

  // THE ONE-BODY QUESTION still has callers that want one answer -- AUTO PILES
  // asks which loop the garage shares an edge with, and the panel asks whether
  // there is anything to frame at all. Last one wins there, the rule
  // roofSourceOutline takes and for its reason: the most recent loop is the
  // one the drafter means.
  const houseFootprint = (storeyLevel = null) => {
    const list = storeyBodies(storeyLevel);
    return list.length ? list[list.length - 1] : null;
  };

  // A STAIR OPENING IS A HOLE IN THE FLOOR THE BEAM CARRIES, so the beam
  // re-lands mid-span of the larger remaining strip instead of crossing it.
  // Ported from MODEL.dc.html:4806 `_rederiveTourBeam`, INCLUDING WHICH LEVEL
  // IT READS -- the stairs on the floor ABOVE, not the ones on the level the
  // beam is filed against. That relationship is the whole rule: a level's
  // beam serves the floor over it, which is also why the roof gets none.
  //
  // midSpanBeams wants intervals along the SHORT axis and picks that axis
  // itself from the same points, so this asks the bounding box the same
  // question rather than being told the answer.
  const stairHolesOn = (points, levelId) => {
    const xs = points.map(pt => pt.x), zs = points.map(pt => pt.z);
    const axisIsX = (Math.max(...xs) - Math.min(...xs))
      >= (Math.max(...zs) - Math.min(...zs));
    return (drawing?.stairs || [])
      .filter(stair => Number(stair.levelId) === Number(levelId)
        && stair.start && stair.end)
      .map(stair => {
        const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
        const len = Math.hypot(dx, dz) || 1;
        const half = (stair.widthFt || 3) / 2;
        const nx = -dz / len * half, nz = dx / len * half;
        const coords = [
          { x: stair.start.x + nx, z: stair.start.z + nz },
          { x: stair.start.x - nx, z: stair.start.z - nz },
          { x: stair.end.x + nx, z: stair.end.z + nz },
          { x: stair.end.x - nx, z: stair.end.z - nz },
        ].map(corner => (axisIsX ? corner.z : corner.x));
        return { min: Math.min(...coords), max: Math.max(...coords) };
      });
  };

  // ── THE BEAM BY THE STAIRS ──────────────────────────────────────────────
  //
  // Movie, 15 Oct, on the detached 2-storey garage: "there should have been at
  // least 1 beam (or 2 with one by the stairs)". The second one is not another
  // row across the floor -- it is the header the cut joists land on where the
  // well interrupts them. build-house.js picks the edge (garageStairHeader);
  // this finds the wells and the supports to ask it with.
  //
  // A PASS OF ITS OWN, AND IT RUNS AFTER THE STAIRS. placeAutoBeam runs before
  // them on a build -- a decision with its own note, because the stair MOVES to
  // clear a beam and not the other way about -- so at beam time the well does
  // not exist yet. This is additive and re-derives nothing: it reads the beams
  // already placed, never moves one, and skips a well whose header is already
  // there (`stairId` on the beam, filed the way the well itself is). So it can
  // be called again after anything, which is what makes it safe to call from
  // both the press and the build.
  //
  // ONLY WHERE THERE ARE BEAMS. A deck the joists cross in one span has no
  // support line to measure a header against, and this page has never drawn
  // headers round a well on a plain OWJ deck -- that is the joist engineer's
  // sheet, and the note on it says so.
  const placeStairHeaders = ({ levelId }) => {
    const BH = window.DraftBuildHouse;
    if (!BH || !Array.isArray(drawing?.beams)) return [];
    const rows = drawing.beams.filter(beam => beam.auto === true && beam.mode === 'dropped'
      && Number(beam.levelId) === Number(levelId) && beam.start && beam.end);
    if (!rows.length) return [];
    const boxOf = points => {
      const xs = points.map(p => p.x), zs = points.map(p => p.z);
      return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    };
    const centre = points => points.reduce((m, p) => ({
      x: m.x + p.x / points.length, z: m.z + p.z / points.length }), { x: 0, z: 0 });
    const inRing = (ring, p) => {
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a.z > p.z) !== (b.z > p.z)
          && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    };
    let beamId = newStructureId(drawing.beams);
    const placed = [];
    storeyBodiesOver(levelId).forEach(({ outline, storeyId }) => {
      const points = outline.points.map(pt => ({ x: pt.x, z: pt.z }));
      const mine = rows.filter(beam => inRing(points, {
        x: (beam.start.x + beam.end.x) / 2, z: (beam.start.z + beam.end.z) / 2 }));
      if (!mine.length) return;
      // THE JOISTS RUN ACROSS THE BEAMS, so the axis is read off a beam rather
      // than re-derived from the garage doors: one answer, and it is the one
      // the beams were actually placed on.
      const first = mine[0];
      const axis = Math.abs(first.end.z - first.start.z)
        >= Math.abs(first.end.x - first.start.x) ? 'x' : 'z';
      const body = boxOf(points);
      const supports = [
        axis === 'x' ? body.x0 : body.z0,
        axis === 'x' ? body.x1 : body.z1,
        ...mine.map(beam => (axis === 'x' ? beam.start.x : beam.start.z)),
      ];
      (drawing.surfaceOpenings || [])
        .filter(hole => Number(hole.levelId) === Number(storeyId)
          && hole.hostType === 'floor' && (hole.points || []).length >= 3
          && Number(hole.stairId) > 0
          && inRing(points, centre(hole.points))
          && !drawing.beams.some(beam => Number(beam.stairId) === Number(hole.stairId)))
        .forEach(hole => {
          const header = BH.garageStairHeader(boxOf(hole.points), { axis, supports });
          if (!header) return;
          // FLUSH, AND NO COLUMN UNDER IT: a header sits in the floor catching
          // joists and lands on the trimmers either side of the opening. A
          // post there would stand in the garage holding up a stairwell.
          const record = {
            id: beamId, start: { ...header.start, y: 0 }, end: { ...header.end, y: 0 },
            levelId: Number(levelId), view: first.view, mode: 'flush', auto: true,
            stairId: Number(hole.stairId),
          };
          beamId += 1;
          drawing.beams.push(record);
          placed.push({ list: drawing.beams, item: record });
        });
    });
    return placed;
  };

  // THE WORKER, AND THE BUTTON IS NOT ITS ONLY CALLER -- the same split
  // placeAutoDims takes, for the same reason: the bone press folds this into
  // the ONE undo step that covers the whole build, and a worker that pushed
  // its own would make a premade house cost two Ctrl+Z. Movie asked for both
  // halves -- "we should just autoplace the beam once into the 'premade
  // homes' and if i need to change them i will", then "maybe we should make a
  // button for AUTO-BEAM COLUMN".
  //
  // -1 IS A REAL ANSWER, as it is there: no house outline, or no FOUNDATION
  // to file against, is not a count of zero.
  //
  // WHAT IT RETURNS IS UNDO-SHAPED, `{list, item}` pairs and `{list, items}`
  // groups, so both callers drop it straight into a 'built' step without
  // knowing that a beam and a column live in different arrays.
  // ── WHICH FLOOR A LEVEL CARRIES ──────────────────────────────────────────
  //
  // A LEVEL EARNS ITS BEAM FROM THE FLOOR ABOVE IT, which is the rule the
  // stair-hole lookup already follows and the reason the roof excludes itself:
  // Movie, 25 Sep, "usually a roof won't need columns or beams (usually the
  // exterior walls do the complete job)". The top storey carries no floor, so
  // it gets nothing without that ever being a special case.
  //
  // FOUNDATION carries the lowest storey; a storey carries the next one up.
  // floorLevels is bottom-up and excludes FOUNDATION (it has no 'floor' view),
  // so the two questions are one lookup with one branch.
  // ── A STOREY, NOT THE NEXT ENTRY IN THE LIST ─────────────────────────────
  //
  // Movie, 13 Oct, on the MOD BILEVEL whose main floor beam was nowhere to be
  // found in its basement: "lets consider the 0.5 and 1 storey as ONE 'level'
  // for this situation".
  //
  // A half level is PART of the floor above it -- level-assembly's own table
  // has read 0.5 and 1 as MAIN FL since the day they were numbered. Walking
  // the list one entry at a time put the ENTRY landing between FOUNDATION and
  // MAIN FL, so the foundation framed a landing six feet across, the 61 ft
  // floor over the rest of it was framed by that landing instead, and its
  // beam was filed on the landing's own sheet. He went looking for it in the
  // basement, found nothing, and drew two by hand.
  //
  // THE HEAD OF THE STOREY IS WHAT COMES BACK, so every caller that NAMES the
  // floor being carried says "1 MAIN FL" rather than naming the landing
  // again. `storeyBodiesOver` below is what the framing measures, and that
  // takes the whole storey, both halves of it.
  const storeyLevelsOver = levelId => {
    const LA = window.DraftLevelAssembly;
    const floors = window.DraftLayerViews.floorLevels(drawing?.levels || []);
    // The storeys in order, bottom up: the floor list with each run of levels
    // that share a storey collapsed to one entry.
    const keys = [];
    floors.forEach(level => {
      const key = LA.storeyKeyOf(level.id);
      if (keys[keys.length - 1] !== key) keys.push(key);
    });
    // FOUNDATION carries the lowest storey; a storey carries the next one up.
    // A level that is in no storey here -- ROOF, SITE, the drafter's own --
    // carries nothing, which is the answer the list walk gave before.
    const mine = Number(levelId) === FOUNDATION_LEVEL_ID ? null : LA.storeyKeyOf(levelId);
    const at = mine === null ? -1 : keys.indexOf(mine);
    if (mine !== null && at < 0) return [];
    const want = keys[at + 1];
    return want ? floors.filter(level => LA.storeyKeyOf(level.id) === want) : [];
  };
  const floorCarriedBy = levelId => {
    const storey = storeyLevelsOver(levelId);
    if (!storey.length) return null;
    const head = window.DraftLevelAssembly.storeyHeadOf(storey.map(l => l.id), storey[0].id);
    return storey.find(level => Number(level.id) === Number(head)) || storey[0];
  };

  // ── WHAT IS ALREADY HOLDING THE FLOOR BELOW ──────────────────────────────
  //
  // Movie, 25 Sep: "this is always the case for a columns - it need to be over
  // another column ... or over a solid wall ... (which acts as a column".
  //
  // COLUMNS AS POINTS, WALLS AS SEGMENTS, which is the shape midSpanBeams
  // takes. Only what is BELOW the level being framed, and only what is really
  // there: a wall with a door through it is not solid across the door, so the
  // openings are cut out here rather than in build-house.js -- an opening's
  // width is this page's business and the geometry file has no idea what a
  // fenestration is.
  //
  // THE FOUNDATION HAS NOTHING BELOW IT and wants none: its posts stand on
  // their own pads, which is why a null list means "divide evenly and claim
  // nothing", exactly as before this rule existed.
  const supportsUnder = levelId => {
    const floors = window.DraftLayerViews.floorLevels(drawing?.levels || []);
    const at = floors.findIndex(level => Number(level.id) === Number(levelId));
    // The level under a storey is the storey below it, or FOUNDATION for the
    // lowest. Under FOUNDATION there is only ground.
    const belowId = Number(levelId) === FOUNDATION_LEVEL_ID ? null
      : (at > 0 ? Number(floors[at - 1].id) : FOUNDATION_LEVEL_ID);
    if (belowId == null || !levelPresent(belowId)) return null;
    const out = [];
    (drawing?.columns || [])
      .filter(column => Number(column.levelId) === belowId && column.point)
      .forEach(column => out.push({ x: column.point.x, z: column.point.z }));
    // A BEAM BELOW IS NOT A SUPPORT, and leaving it out is the point. A post
    // landing mid-span on the beam underneath loads that beam rather than
    // carrying through to the ground -- which is the thing Movie's rule
    // exists to stop. Only what stands: columns, and solid wall.
    const openings = new Map();
    (drawing?.fenestrations || []).forEach(opening => {
      const key = String(opening.wallId);
      if (!openings.has(key)) openings.set(key, []);
      openings.get(key).push(opening);
    });
    (drawing?.walls || [])
      .filter(wall => Number(wall.levelId) === belowId && wall.start && wall.end)
      .forEach(wall => {
        const holes = (openings.get(String(wall.id)) || [])
          .map(opening => ({
            from: Number(opening.offset) || 0,
            to: (Number(opening.offset) || 0) + (Number(opening.width) || 0),
          }))
          .filter(hole => hole.to > hole.from)
          .sort((a, b) => a.from - b.from);
        const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
        if (!(len > 0.01)) return;
        const at01 = t => ({
          x: wall.start.x + (wall.end.x - wall.start.x) * (t / len),
          z: wall.start.z + (wall.end.z - wall.start.z) * (t / len),
        });
        let from = 0;
        holes.forEach(hole => {
          if (hole.from - from > 0.01) out.push({ start: at01(from), end: at01(hole.from) });
          from = Math.max(from, hole.to);
        });
        if (len - from > 0.01) out.push({ start: at01(from), end: at01(len) });
      });
    return out.length ? out : null;
  };

  // `midSpan` answers which of the records placed are the house's own mid-span
  // rows and their posts -- not a garage's framing, not a stair's header --
  // with the bare span that wanted them, for AUTO HOUSE's question (Movie,
  // 19 Oct, askForBeams).
  const placeAutoBeam = ({ levelId = FOUNDATION_LEVEL_ID } = {}) => {
    const midSpan = [];
    let midSpanFt = 0;
    if (!drawing) return -1;
    // A LEVEL THE DRAWING ACTUALLY HAS, which is what levelPresent exists for:
    // a beam filed against a level this drawing has not got would paint once
    // and be gone on the next load.
    if (!levelPresent(levelId)) return -1;
    // THE FLOOR THIS LEVEL CARRIES is the footprint the span rule measures --
    // not the level's own. A main-floor beam is sized by the SECOND floor
    // over it, and the two differ the moment the upper storey is smaller.
    const carried = floorCarriedBy(levelId);
    if (!carried) return -1;
    // EVERY BODY ON THAT FLOOR, each measured on its own. A 2 STOREY WITH ROOM
    // OVER GARAGE puts two loops on 2ND FL and they are two floors: the house
    // at 32 x 40, which needs a beam, and the room over the garage at 24 x 19,
    // which does not. One answer for the pair would be wrong whichever loop it
    // came from.
    const bodies = storeyBodiesOver(levelId);
    if (!bodies.length) return -1;
    // THE DRAWING THAT SHOWS STRUCTURE, NAMED RATHER THAN INHERITED.
    // wallHomeView hands back 'plan' whenever the drafter happens to be on
    // BASEMENT (WALLS) or a floor's walls plan, and S-BEAM is in the
    // FOUNDATION and FLOOR views and in neither of those -- so a beam filed
    // by where he was standing would paint nowhere on half the presses, which
    // is the silent loss this page keeps refusing. MODEL.dc.html names the
    // foundation one too (:4833).
    const view = levelId === FOUNDATION_LEVEL_ID ? 'foundation' : 'floor';

    // RE-RUNNING REPLACES THIS LEVEL AND VIEW'S OWN AUTO STRUCTURE and nothing
    // else -- the rule placeAutoDims takes, for the reason Movie gave: "we
    // should just autoplace the beam once ... and if i need to change them i
    // will". `auto: true` is what separates a generated beam from one he drew,
    // and a hand-placed one must survive a rebuild.
    //
    // NOT THE PILES, and this is MODEL.dc.html's own exception arriving late
    // (:4826 spares its auto pile stubs from the same sweep). The first
    // version of this said there was nothing here to spare, because
    // `pullSrcId` -- the only auto pile the OLD page makes -- appears nowhere
    // in this file. True when it was written and false one commit later:
    // AUTO PILES puts `auto: true` piles on FOUNDATION / foundation, the
    // exact level and view this sweeps.
    //
    // MEASURED, NOT REASONED. A premade bungalow + garage came back with
    // ELEVEN piles calculated and ZERO written: raiseGarageConcrete places
    // them and placeAutoBeam runs afterwards in the same press and ate every
    // one. No error, no message -- the garage simply stood on nothing again,
    // which is the defect the piles were added to fix.
    //
    // A TELEPOST IS THIS FUNCTION'S, A PILE IS THE GARAGE'S. The footing says
    // which, the way it does on the old page. Beams carry no footing, so the
    // same predicate reads false for them and their sweep is untouched.
    const sweptBeams = [], sweptColumns = [];
    // AND WHAT THE OLD RULE LEFT ON A HALF LEVEL. Before a storey was one
    // thing to frame, the landing of a MOD BILEVEL framed the floor above it
    // and filed the beam on its own sheet. That level frames nothing now, so
    // anything `auto` still sitting on it is an orphan from the old rule --
    // and leaving it would draw the same beam twice, once where it belongs
    // and once where he could not find it. Only levels of the storey being
    // framed, only the floor view, and only auto: a beam he drew himself on
    // the landing is his, and the pile exception below still applies.
    const orphanLevels = storeyLevelsOver(levelId)
      .map(level => Number(level.id))
      .filter(id => id !== Number(carried.id));
    const isMine = item => item.auto === true
      && ((Number(item.levelId) === levelId && item.view === view)
        || (item.view === 'floor' && orphanLevels.includes(Number(item.levelId))));
    const isPile = item => String(item.footing || '').startsWith('pile');
    // IN PLACE, NOT REASSIGNED. A press that built the garage's piles a step
    // earlier filed them for its one undo as {list, item} against THIS array;
    // a fresh array here left that undo removing them from a list the drawing
    // no longer held, and Ctrl+Z took the house and left the ten piles.
    const sweep = (list, swept, keep) => {
      const kept = list.filter(item => keep(item) || (swept.push(item), false));
      list.splice(0, list.length, ...kept);
      return list;
    };
    drawing.beams = sweep(drawing.beams || [], sweptBeams, beam => !isMine(beam));
    drawing.columns = sweep(drawing.columns || [], sweptColumns,
      column => !isMine(column) || isPile(column));

    // THE LINK BACK TO THE OUTLINE is what carries a beam through an edit.
    // midSpanBeams tags an end that landed on a corner with `srcIndex` into
    // the points it was handed; that corner may itself ride a BONEYARD master
    // through `srcId`, and propagateMaster already hunts beams and columns by
    // it (RIDER 3 and RIDER 4, :7012). So the link is COPIED from the corner
    // and the offset is measured by relinkVertex rather than here -- one
    // arithmetic for the contract instead of a second one to drift from it.
    //
    // A corner with no srcId leaves a plain point, which is the honest record:
    // a house the bone built has no master until the drafter makes one, and a
    // beam claiming a link it has not got is worse than one admitting it has
    // none -- placeAutoDims' own note on dropped srcIds is about exactly this.
    const placed = [];
    // HIGHEST-PLUS-ONE ONCE, THEN COUNT UP, and hoisted OUT of the body loop
    // for the same reason it was hoisted out of the record loop: newStructureId
    // reads the list, so asking it again per body would restart the count and
    // hand the second body the first body's ids. The format dedupes on id and
    // drops every repeat after the first, silently.
    let beamId = newStructureId(drawing.beams);
    let columnId = newStructureId(drawing.columns);
    let beamCount = 0, columnCount = 0, unsupportedCount = 0;

    // ── NO POSTS IN A GARAGE: ITS FLOOR SPANS WALL TO WALL ON OWJ ────────
    //
    // Movie, 12 Oct: "we don't want columns in the garage ... go SIDE WALL to
    // SIDE WALL direction for joists and use ENGINEERED OWJ". A floor body
    // that stands over a garage gets no beam and no posts; it gets a note on
    // its floor layout instead, sized off the short way across it by
    // build-house.js's owjFor. A re-run replaces the note it wrote before --
    // known by its wording, since the note record keeps no `auto` key.
    // A GARAGE ON A STOREY BELOW the body, not one beside it: a body on the
    // garage's own level is the house next to it, never the room over it.
    const elevOf = id => Number((drawing.levels || []).find(l => Number(l.id) === Number(id))?.elev) || 0;
    const garageOutlines = (drawing.outlines || [])
      .filter(o => o.garage === true && (o.points || []).length >= 3);
    const garageLoops = garageOutlines.map(o => o.points);
    const inLoop = (pts, p) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    };
    const overGarage = (points, storeyId) => {
      const c = points.reduce((m, p) => ({ x: m.x + p.x / points.length, z: m.z + p.z / points.length }), { x: 0, z: 0 });
      return garageOutlines.some(o => elevOf(o.levelId) < elevOf(storeyId) - 1e-6 && inLoop(o.points, c));
    };
    const OWJ_NOTE = /^ENGINEERED OWJ/;
    // ── PAST THE TABLE: THE SPAN DECIDES ────────────────────────────────
    //
    // Movie, 12 Oct, on a span the joists cannot reach: "PLACE COLUMNS to
    // support BEAM" -- "the beam doesn't need to be steel", "dropped beam ...
    // better for ducts etc ... insulation of 2nd floor", "DROPPED ENGINEERED
    // BEAM".
    //
    // IT USED TO ASK WHICH OF TWO ANSWERS HE WANTED, in a popup, and keep the
    // answer on the drawing so a re-run did not ask twice. The popup is gone --
    // Movie, 15 Oct: "don't ask the user about placing beams and columns or
    // the engineered owj, just make the decision based on spans don't ask the
    // user, they can adjust it later if they need too". The span decides now,
    // every time, and what he does not like he moves.
    //
    // THE OTHER ANSWER WENT WITH THE QUESTION. "1. REQ ENGINEERED BEAM / OR
    // JOISTS" wrote a note and left the floor with nothing holding it up,
    // which is the one outcome a drawing cannot be left in by a rule that no
    // longer asks. Its note is still SWEPT below, so a drawing answered that
    // way before comes back framed instead of keeping a stale label.
    const REQ_NOTE = /^REQ ENGINEERED BEAM/;
    const BEAM_TAG = /^DROPPED ENGINEERED BEAM$/;
    const notesNow = drawing.notes || [];
    const isBeamTag = note => Number(note.levelId) === Number(levelId) && note.view === view
      && BEAM_TAG.test(String(note.body || ''));
    // EVERY GARAGE NOTE THIS PRESS OWNS GOES BEFORE ANY IS WRITTEN: the OWJ
    // and REQ notes on the floor above, the beam tags beside the beams, and
    // the square's two words (no solid bearing; a garage too shallow).
    const SQUARE_NOTE = /^(NO SOLID BEARING FOR BEAM|GARAGE SQUARE )/;
    const isSquareNote = note => SQUARE_NOTE.test(String(note.body || ''));
    drawing.notes = notesNow.filter(note => !isBeamTag(note) && !isSquareNote(note)
      && !(note.view === 'floor' && (OWJ_NOTE.test(String(note.body || ''))
        || REQ_NOTE.test(String(note.body || '')))
        && bodies.some(b => Number(b.storeyId) === Number(note.levelId))));
    const owjNotePlaced = [];
    const fmtFt = ft => window.DraftFormatters.formatArchitecturalInches(ft * 12);
    const boxOf = points => {
      const xs = points.map(p => p.x), zs = points.map(p => p.z);
      return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    };
    const addNote = (at, levelOf, viewOf, body) => {
      drawing.notes = drawing.notes || [];
      const id = drawing.notes.reduce((top, n) => Math.max(top, Number(n.id) || 0), 0) + 1;
      const note = {
        id, anchor: { ...at, y: 0 }, text: { ...at, y: 0 }, levelId: levelOf, view: viewOf, body, end: 'none',
        fill: false, fillOpacity: 0.85, outline: false, bullnose: 0, layer: 'A-ANNO-NOTE',
      };
      drawing.notes.push(note);
      owjNotePlaced.push({ list: drawing.notes, item: note });
    };
    const owjNote = (points, storeyId, { spanFt = null, between = 'SIDE WALL TO SIDE WALL' } = {}) => {
      const box = boxOf(points);
      const span = spanFt ?? Math.min(box.x1 - box.x0, box.z1 - box.z0);
      // 19-1/4", NOT 19-3/4" (Movie, 13 Oct): "i like for ours lines up to 20\"
      // even with the sheathing". A truss is built to order either way, so the
      // depth is decided by the framing arithmetic -- and it is the depth
      // PROJECT has scheduled this deck at since 28 Sep, so the note on the
      // plan and the row on the schedule now say one number.
      const owj = window.DraftBuildHouse.owjFor(span, { minDepthIn: 19.25 });
      // EVERY DEPTH IN THE TABLE IS A QUARTER PAST A WHOLE INCH, so every one
      // of them is printed as the fraction a drafter reads. This named
      // 19-1/4" and let the rest through as a decimal, which was harmless
      // while 19-1/4" was the only row anything over a garage could reach and
      // would have written "21.25"" on a plan the moment a wider deck picked
      // the next row up (Movie, 14 Oct, naming the family: 15.25, 17.25,
      // 19.25, 21.25, 23.25).
      // THE THREE-LINE NOTE IS GONE (Movie, 16 Oct, struck out on the 2ND FL
      // FLOOR LAYOUT): the deck is called out on the sheet instead, an
      // arrowed span line in every bay with the short form beside it
      // ("ENGINEERED OWJ 19-1/4"", render-2d drawJoistSpans2D off the
      // schedule below). `between` is the decision this press made and is
      // kept in the name for the reader of this code; the sheet shows it as
      // the arrow's two ends.
      void between;
      // ── AND THE SCHEDULE SAYS THE SAME DEPTH ──────────────────────────
      //
      // The note on the plan and PROJECT's row for this deck have agreed
      // since 28 Sep, and they agreed by COINCIDENCE: the room over a garage
      // was filed on OVER GARAGE, whose stock assembly is the 19 1/4" OWJ.
      // Movie moved that room to 2ND FL on 14 Oct ("more like a bungalow
      // than a bilevel"), whose stock joist is the house's -- so without
      // this the plan would say 19-1/4" and the schedule would say the
      // house's floor, about a deck nobody can frame twice.
      //
      // WRITTEN HERE because this is where the depth is DECIDED. A second
      // call to owjFor somewhere else is a second opinion waiting to drift.
      //
      // AND ONLY WHERE THE STOREY IS THIS ROOM'S ALONE. A joist depth is a
      // LEVEL's, and a drawing carrying a house's 2nd floor as well as a
      // garage's room has one level for both -- writing the garage's deck
      // there would retype the house's floor without asking. Movie took that
      // sharing knowingly when he chose 2ND FL; silently overwriting what he
      // had already specified for the house is not the same thing.
      const alone = bodies.filter(b => Number(b.storeyId) === Number(storeyId)).length === 1;
      if (alone) {
        drawing.levelAssemblies = drawing.levelAssemblies || {};
        drawing.levelAssemblies[storeyId] = {
          ...(drawing.levelAssemblies[storeyId] || {}),
          joistDepthIn: owj.depthIn,
          // AND WHAT KIND, so the callout reads "ENGINEERED OWJ" and not the
          // storey's stock TJI at a depth the TJI table does not make.
          joistType: 'owj',
        };
      }
      return owj;
    };
    // THE GARAGE UNDER A BODY, and its doors and walls for the beam plan.
    const garageUnder = (points, storeyId) => {
      const c = points.reduce((m, p) => ({ x: m.x + p.x / points.length, z: m.z + p.z / points.length }), { x: 0, z: 0 });
      return garageOutlines.find(o => elevOf(o.levelId) < elevOf(storeyId) - 1e-6 && inLoop(o.points, c)) || null;
    };
    // THE OVERHEAD DOORS' CENTRES, from the one door reader the square uses
    // too (garageDoorRecordsOf), so the beam and the square cannot disagree
    // about where a door is.
    const garageDoorsOf = garage => garageDoorRecordsOf(garage)
      .filter(door => door.overhead).map(door => door.at);
    const nearLoop = (loop, p, tol = 0.75) => loop.some((a, i) => {
      const b = loop[(i + 1) % loop.length];
      const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
      const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
      return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z) <= tol;
    });
    let garageBeams = 0, garageColumns = 0;
    const placeGarageColumns = (points, storeyId) => {
      const garage = garageUnder(points, storeyId);
      const keepOuts = garage ? garageKeepOutsOf(garage) : [];
      const doorRecords = garage ? garageDoorRecordsOf(garage) : [];
      const axis = window.DraftBuildHouse.garageJoistAxis(garage ? boxOf(garage.points) : boxOf(points),
        garage ? garageDoorsOf(garage) : []);
      // THE OPENINGS UNDER THE BEAM'S ENDS: every door in a wall running the
      // joists' way -- the walls the row bears on -- as a span along the row
      // axis. A door in a side wall is under no beam end.
      const openings = doorRecords
        .filter(door => Math.abs(axis === 'x' ? door.along.x : door.along.z) > 0.9)
        .map(door => {
          const c = axis === 'x' ? door.at.x : door.at.z;
          return [c - door.widthFt / 2, c + door.widthFt / 2];
        });
      const plan = window.DraftBuildHouse.garageBeamPlan(boxOf(points), {
        doors: garage ? garageDoorsOf(garage) : [],
        doorBox: garage ? boxOf(garage.points) : boxOf(points),
        onWall: p => !!garage && nearLoop(garage.points, p),
        keepOuts,
        openings,
      });
      plan.beams.forEach(beam => {
        const id = beamId;
        beamId += 1;
        const record = {
          id, start: { ...beam.start, y: 0 }, end: { ...beam.end, y: 0 },
          levelId, view, mode: 'dropped', auto: true,
        };
        drawing.beams.push(record);
        placed.push({ list: drawing.beams, item: record });
        const along = plan.axis === 'x' ? { x: 1.5, z: 0 } : { x: 0, z: 1.5 };
        // A THIRD OF THE WAY ALONG, clear of the GARAGE tag in the middle.
        addNote({ x: beam.start.x + (beam.end.x - beam.start.x) / 3 + along.x,
          z: beam.start.z + (beam.end.z - beam.start.z) / 3 + along.z },
          levelId, view, 'DROPPED ENGINEERED BEAM');
      });
      plan.columns.forEach(p => {
        const record = { id: columnId++, point: { ...p, y: 0 }, levelId, view, footing: 'pad36', auto: true };
        drawing.columns.push(record);
        placed.push({ list: drawing.columns, item: record });
      });
      // THE SOLID SUPPORT UNDER EACH END: "a solid support column built into
      // the wall below where the beam rests". A 6x6 in the wall, on the
      // wall's own footing, filed with the beam it holds.
      (plan.posts || []).forEach(p => {
        const record = { id: columnId++, point: { ...p, y: 0 }, levelId, view, footing: 'post6', inWall: true, auto: true };
        drawing.columns.push(record);
        placed.push({ list: drawing.columns, item: record });
      });
      // AND WHAT THE RULES COULD NOT GIVE, SAID OUT LOUD rather than drawn
      // wrong: a row with no solid wall to land on, and a garage too shallow
      // for its own square.
      if (plan.bearing === 'none' && plan.beams.length) {
        const beam = plan.beams[0];
        addNote({ x: (beam.start.x + beam.end.x) / 2, z: (beam.start.z + beam.end.z) / 2 },
          levelId, view, 'NO SOLID BEARING FOR BEAM\nEVERY STAND LANDS OVER A DOOR -- WIDEN THE PIER OR MOVE A DOOR');
      }
      const shallow = keepOuts.find(k => k.kind === 'bay' && k.capped);
      if (garage && shallow) {
        const gb = boxOf(garage.points);
        addNote({ x: (gb.x0 + gb.x1) / 2, z: (gb.z0 + gb.z1) / 2 + 2 }, Number(garage.levelId), 'plan',
          `GARAGE SQUARE ${fmtFt(shallow.depthFt)} DEEP -- THIS GARAGE NEEDS MORE DEPTH\n`
          + `${fmtFt(window.DraftBuildHouse.GARAGE_SQUARE_DEPTH_FT)} FROM THE DOOR WALL FOR A CAR`);
      }
      garageBeams += plan.beams.length;
      garageColumns += plan.columns.length;
      owjNote(points, storeyId, { spanFt: plan.rowFt, between: 'WALL TO BEAM' });
    };

    bodies.forEach(({ outline, storeyId }) => {
      const points = outline.points.map(pt => ({ x: pt.x, z: pt.z }));
      if (garageLoops.length && overGarage(points, storeyId)) {
        // SIDE WALL TO SIDE WALL: the span the joists take between the two
        // garage walls without doors, not simply the shorter side.
        const garage = garageUnder(points, storeyId);
        const doors = garage ? garageDoorsOf(garage) : [];
        const box = boxOf(points);
        const axis = window.DraftBuildHouse.garageJoistAxis(garage ? boxOf(garage.points) : box, doors);
        const span = axis === 'x' ? box.x1 - box.x0 : box.z1 - box.z0;
        // THE BARE DECK ONLY WHILE THE TABLE REACHES AT 16" O.C. Movie's own
        // ceiling, read off his own table -- see garageBareSpanFt. It used to
        // be `owjFor(span).fits`, which let the deck ride the 12" o.c. last
        // resort: the detached 2-storey garage came out 30 ft wall to wall on
        // "ENGINEERED OWJ 23-1/4" @ 12" O.C." and no beam at all, which is the
        // drawing he was looking at when he said the span was too far.
        if (span <= window.DraftBuildHouse.garageBareSpanFt({ minDepthIn: 19.25 }) + 1e-6) {
          owjNote(points, storeyId, { spanFt: span, between: 'SIDE WALL TO SIDE WALL' });
          return;
        }
        placeGarageColumns(points, storeyId);
        return;
      }
      // THE ROW SPACING IS THE FLOOR'S OWN JOIST (Movie, 19 Oct, on a 40 ft
      // deep North Point with three rows of beams where he wanted two: "31
      // feet max space for OWJ"). The 19 ft rule is the 1'-0 5/8" floor's; an
      // OWJ floor spans what its table says at 16" o.c. -- 28 ft at the 24"
      // package -- the same bare-deck ceiling garageBareSpanFt gives a garage
      // floor, keeping 12" o.c. as the last resort it is.
      const carriedAsm = window.DraftLevelAssembly?.levelAssemblyFor?.(drawing.levelAssemblies, storeyId);
      const plan = window.DraftBuildHouse.midSpanBeams(points, {
        holes: stairHolesOn(points, storeyId),
        supportsBelow: supportsUnder(levelId),
        ...(carriedAsm?.joistType === 'owj' ? { beamAtFt: window.DraftBuildHouse.garageBareSpanFt() } : {}),
      });
      if (plan.beams.length) {
        const bare = window.DraftBuildHouse.joistBays(points, {});
        midSpanFt = Math.max(midSpanFt, bare?.spanFt || 0);
      }
      // THE LINK IS THIS BODY'S OWN. `srcIndex` indexes the points THIS call
      // was handed, so the closure has to be rebuilt per body -- one hoisted
      // out of the loop would read the last body's corners for every beam.
      const linked = (source, srcIndex) => {
        const pt = { x: source.x, y: 0, z: source.z };
        const corner = Number.isInteger(srcIndex) ? outline.points[srcIndex] : null;
        if (corner && corner.srcId) { pt.srcId = corner.srcId; relinkVertex(pt); }
        return pt;
      };
      plan.beams.forEach(beam => {
        const record = {
          id: beamId++,
          start: linked(beam.start, beam.start.srcIndex),
          end: linked(beam.end, beam.end.srcIndex),
          levelId,
          view,
          // Named for the reason beamPress names it: the record this page
          // writes and the record the reader rebuilds should be one object,
          // not one filled in behind the page's back.
          mode: 'flush',
          auto: true,
        };
        drawing.beams.push(record);
        placed.push({ list: drawing.beams, item: record });
        midSpan.push({ list: drawing.beams, item: record });
      });
      plan.columns.forEach(column => {
        const record = {
          id: columnId++,
          point: linked(column, column.srcIndex),
          levelId,
          view,
          footing: 'pad36',
          auto: true,
        };
        drawing.columns.push(record);
        placed.push({ list: drawing.columns, item: record });
        midSpan.push({ list: drawing.columns, item: record });
      });
      beamCount += plan.beams.length;
      columnCount += plan.columns.length;
      // A POST THE GEOMETRY COULD NOT STAND ON ANYTHING is counted, not
      // stored. midSpanBeams tags it `unsupported` because the beam still has
      // to be held up somewhere and a silent post there is the drawing
      // claiming support it has not got -- but drawing-format.js's column
      // validator has no such field, so writing it would be a key the reader
      // drops on the next load. That is the silent loss this page refuses
      // everywhere else, so the fact goes to the DRAFTER instead, now, while
      // he is looking at the press that made it.
      unsupportedCount += plan.columns.filter(column => column.unsupported).length;
    });

    placed.push(...owjNotePlaced);
    beamCount += garageBeams;
    columnCount += garageColumns;
    // AND THE HEADERS, LAST, when every row this press laid is on the drawing
    // for them to be measured against. On a BUILD there are no wells yet and
    // this finds nothing -- the build calls the same pass again once the
    // stairs are in.
    const headers = placeStairHeaders({ levelId });
    placed.push(...headers);
    beamCount += headers.length;
    // A MARK OUTLIVES THE RE-PRESS (Movie, 19 Oct: the engineer's text for
    // "STEEL, LAMINATED BEAMS etc"). A beam laid back down on the line of one
    // this press swept takes that beam's mark, so pressing AUTO BEAM again
    // never wipes what the engineer specified.
    const marked = sweptBeams.filter(b => typeof b.mark === 'string' && b.mark.trim() && b.start && b.end);
    if (marked.length) {
      placed.filter(entry => entry.list === drawing.beams).forEach(({ item }) => {
        if (item.mark) return;
        const mid = { x: (item.start.x + item.end.x) / 2, z: (item.start.z + item.end.z) / 2 };
        const ux = item.end.x - item.start.x, uz = item.end.z - item.start.z, len = Math.hypot(ux, uz) || 1;
        const twin = marked.find(old => {
          const vx = old.end.x - old.start.x, vz = old.end.z - old.start.z, vlen = Math.hypot(vx, vz) || 1;
          return Math.abs(ux * vz - uz * vx) / (len * vlen) < 0.01
            && window.DraftGeometry2D.pointToSegment(mid, old).d < COLUMN_ON_BEAM_FT;
        });
        if (twin) item.mark = twin.mark.trim();
      });
    }
    return {
      placed,
      restored: [
        ...(sweptBeams.length ? [{ list: drawing.beams, items: sweptBeams }] : []),
        ...(sweptColumns.length ? [{ list: drawing.columns, items: sweptColumns }] : []),
      ],
      beams: beamCount,
      columns: columnCount,
      unsupported: unsupportedCount,
      levelId,
      midSpan,
      midSpanFt,
    };
  };

  // ── AUTO STAIR (board #260) ───────────────────────────────────────────────
  //
  // Movie, 25 Sep: "maybe give them stairs too". A house with two floors and
  // no stair between them is the same omission the main-floor beam was: the
  // drawing asserts a storey nobody can reach.
  //
  // THE DERIVATION IS NOT HERE. auto-stair.js scores every candidate straight
  // run, folded L and U switchback against the interior ring, the carrying
  // beams and the room stamps, and hands back ONE born-legal suggestion -- its
  // well already inside the ring and already clear of the beams. This layer
  // only feeds it real geometry, commits the winner, and owns everything
  // stateful: the level heights the rise comes from, the opening cut, the
  // stacking, the undo records.
  //
  // A SUGGESTION, NOT A SILENT COMMIT, and that is dc's own rule kept: a hand
  // placement never carries `auto`, a re-run replaces only auto-tagged stairs,
  // and DELETING one is "no thanks" -- nothing re-suggests it.
  const STAIR_LAYER = 'A-STR';
  const DEFAULT_STAIR_WIDTH_FT = 3;      // 36" between stringers
  const STAIR_BEAM_CLEAR_IN = 2;         // well edge off a carrying beam's centreline (#246)
  const STAIR_OPENING_FINISH_IN = 1;     // finish allowance, half of it on each side of the well
  // THE ROUGH OPENING IS BIGGER THAN THE STAIR AT BOTH ENDS, for opposite
  // reasons. Movie, 21 Sep, reading a stair section: "the nosing of the stair
  // shouldn't be part of the floor opening ... 1.5" of material if needed for
  // stair backing and then 1/2" for the stair nosing", and "at bottom it is
  // opposite nosing goes over the opening min. 2"" -- "could be more".
  //
  // So the top pulls the header BACK behind the nosing and the bottom lets the
  // floor REACH OVER, and both push the hole out past the finished line by the
  // same build-up. A MINIMUM, never a figure: nothing may round it down.
  const STAIR_NOSING_BACKING_IN = 1.5;
  const STAIR_NOSING_IN = 0.5;
  const STAIR_OPENING_NOSING_MIN_IN = STAIR_NOSING_BACKING_IN + STAIR_NOSING_IN;
  const DEFAULT_STAIR_HEADROOM_FT = (6 * 12 + 10) / 12;
  // HEADROOM IS A SETTING, NOT A CONSTANT, and it is the number that decides
  // how far down the flight the hole has to reach. It is page state rather
  // than drawing data for the same reason layer standards are: nothing in
  // drawing-format.js holds it, so writing it onto the drawing would be a key
  // the reader drops on the next load -- the silent loss this page refuses
  // everywhere else. A drawing reopened elsewhere gets that page's headroom,
  // which is the honest answer while the format has no field for it.
  let stairHeadroomFt = DEFAULT_STAIR_HEADROOM_FT;
  // The stair's own two settings, page state for the same reason: the WIDTH a
  // new flight is placed at, and which side the handrail bar goes on walking
  // down. Both ride on each stair record once placed -- drawing-format.js
  // validates `widthFt` and `rail` -- so the page state is the DEFAULT for the
  // next placement, never the truth about one already drawn.
  let stairWidthFt = DEFAULT_STAIR_WIDTH_FT;
  let stairRailSide = 'left';
  // THE WINDER ROW IS BEHIND A DOUBLE-CLICK ON L, which is MODEL.dc.html's own
  // hidden door (`stairWindersOpen`, :2865: "Winders are never the default and
  // never advertised"). Page state rather than a field on the stair: it is
  // about what the PANEL is showing, not about the flight -- a stair that
  // already has winders shows the row whatever this says.
  let stairWindersOpen = false;

  // The house outline on one level: the LAST non-garage loop, which is
  // storeyBodies' own rule and its reason -- "the most recent loop is the one
  // the drafter means". Reused rather than re-filtered so the garage skip and
  // the three-point minimum have exactly one definition on this page.
  // ── WHICH BODY A STAIRCASE BELONGS IN ──────────────────────────────────
  //
  // Movie, 25 Sep: "the ATTACHED garage won't need a staircase to the 2nd
  // floor (unless the user wants it special - don't need it as default)" ...
  // "the DETACHED needs one because it doesn't have a house with stairs in
  // it".
  //
  // MEASURED ON HIS OWN 2 STOREY + GARAGE + ROOM OVER, built 25 Sep: the
  // stair from MAIN FL to 2ND FL was laid out inside the room over the
  // garage, and its opening cut through that room's floor.
  //
  //     stair lvl 3   x  -1.7  z  -5.4    in the house
  //     stair lvl 5   x   2.7  z  30.6    in the GARAGE
  //
  // THE LOOKUP TOOK THE LAST BODY. storeyBodies keeps every outline that is
  // not flagged `garage`, and raiseGarage files the room over the garage as
  // an ordinary outline -- so 2ND FL carries two, and `bodies.length - 1`
  // picked the newer, smaller one:
  //
  //     outline-15   x -16..16  z -20..20   1280 sq ft   the house's 2nd floor
  //     outline-37   x  -4..20  z  19..38    436 sq ft   the room over the garage
  //
  // LAST-ONE-WINS IS RIGHT FOR ITS OTHER CALLERS and stays theirs: AUTO PILES
  // asks which loop a garage shares an edge with and the panel asks whether
  // there is anything to frame, and for both "the most recent loop is the one
  // the drafter means" (houseFootprint's own note). A staircase is a different
  // question -- not which loop was drawn last, but which one is the HOUSE --
  // so it gets its own, and houseFootprint is left alone.
  //
  // A ROOM OVER THE GARAGE IS THE GARAGE'S ROOM. It is asked geometrically
  // because there is no flag to read: the deck raiseGarage builds carries no
  // `garage: true`, exactly as its floor record does not. A body more than
  // half over a garage outline is that garage's; of whatever is left, the
  // largest is the house.
  // WHICH OUTLINE IS THE HOUSE, asked of building-bodies.js rather than
  // answered here. plan-composition.js needs the same answer to put a window
  // size tag on the EXTERIOR side of the glass on a Construction Layout
  // sheet, and two pages agreeing most of the time is how a tag ends up
  // inside the house on the one plan that matters.
  //
  // bodyOverGarage AND ITS SHARE CONSTANT WENT WITH IT. They had one caller
  // between them -- this -- so nothing is stranded here.
  const houseOutlineOn = levelId =>
    window.DraftBuildingBodies.houseOutlineOn(drawing, levelId);

  // The floor levels bottom-up. stairLevels() already builds exactly this list
  // for the painter -- levels carrying a 'floor' view, reversed -- so asking it
  // again here keeps ONE answer to "which levels are floors", the way
  // assemblyFor is this page's one level-assembly lookup.
  const stairFloorLevels = () => stairLevels().floors;

  // The level's name for a message about it. levelName() answers for the
  // ACTIVE level and takes no argument -- and AUTO STAIR reports on levels the
  // drafter is not standing on, so it needs the label by id. Same derivation,
  // through the same levelLabel, so the two never read differently.
  const namedLevel = levelId => {
    const level = (drawing?.levels || [])
      .find(entry => Number(entry.id) === Number(levelId));
    return level ? levelLabel(level.id, level.name) : `level ${levelId}`;
  };

  // Even-odd point-in-polygon. NOT in geometry-2d.js: cut-view.js keeps a
  // private copy (:385) and MODEL.dc.html another (:18402), so this is the
  // third. Left local rather than hoisted into the module in this change --
  // moving it is a three-caller refactor with its own harness, and doing it
  // inside a port would put a behaviour question inside a parity question.
  // BUILDING-BODIES' NOW, and delegated rather than re-typed at nine call
  // sites. It went out with houseOutlineOn, which needed it, and this page
  // keeps the name it has used since -- an alias is one line, nine renames
  // are nine chances to miss one.
  const pointInLoop = (points, at) =>
    window.DraftBuildingBodies.pointInLoop(points, at);

  // ONE WALL ASSEMBLY OF SETBACK off the exterior, never a hard-coded
  // thickness: the interior ring insets the outline by the THICKEST wall
  // actually standing along it, and the lowest floor's descent adds the
  // insulation wall lining the foundation to the foundation wall itself --
  // that stair passes both, so both count.
  const stairOpeningSetbackFt = levelId => {
    const WT = window.DraftWallTypes;
    const outline = houseOutlineOn(levelId);
    const floors = stairFloorLevels();
    const lowest = floors.length > 0 && Number(floors[0].id) === Number(levelId);
    const totalIn = id => (WT.WALL_TYPES.find(type => type.id === id) || {}).totalIn || 0;
    const thickest = (walls, fallbackIn) => walls.reduce((most, wall) =>
      Math.max(most, totalIn(wall.wallType || 'stud_2x6')), fallbackIn);
    // EXTERIOR MEANS STANDING ON THE OUTLINE, and that test is geometry-2d's
    // edgeOnLoop -- the same one the garage walls and the auto-pile skip use.
    //
    // SEGMENTS, NOT POINTS, and the module says why in its own comment: a
    // points-only version would quietly straighten every arc edge. Built ONCE
    // rather than inside the filter, which would rebuild the whole ring per
    // wall.
    const ring = outline
      ? window.DraftGeometry2D.loopSegments(outline.points) : null;
    const onOutline = wall => !!ring
      && window.DraftGeometry2D.edgeOnLoop(wall.start, wall.end, ring);
    const planIn = thickest((drawing?.walls || []).filter(wall =>
      Number(wall.levelId) === Number(levelId)
      && (wall.view || 'plan') === 'plan' && onOutline(wall)), totalIn('stud_2x6'));
    if (!lowest) return planIn / 12;
    const fdnIn = thickest((drawing?.walls || []).filter(wall => wall.view === 'foundation'),
      totalIn('concrete_8'));
    return Math.max(planIn, fdnIn + totalIn('insulation_6')) / 12;
  };

  // THE BEAMS CARRYING THIS LEVEL'S FLOOR -- the ones a well must keep clear
  // of, because a beam crossing an open well is a beam over the drafter's head
  // on the way down.
  //
  // THE SECOND CLAUSE IS THE WHOLE POINT, and dc learned it the hard way on
  // 7 Sep: every beam BUILD HOUSE generates is filed at FOUNDATION in the
  // foundation view, so a lookup that read only the level's OWN floor view
  // returned [] against the app's own beams -- the nudge took its empty-list
  // exit and the legality check reported the beam half clear unconditionally.
  // Both were inert on every automatically built house.
  // ── THE BEAMS UNDER A FLOOR ARE FILED ON THE LEVEL BELOW IT ─────────
  //
  // placeAutoBeam files the beams carrying a floor on the level whose storey
  // holds them up: the FOUNDATION's beams (view 'foundation') carry the
  // lowest floor, and MAIN FL's floor-view beams carry the 2ND FL -- or the
  // room over a garage, whose beam is filed on the garage's level. So the
  // beams a stair on level S must keep its 2" off are the ones on every
  // level L with floorCarriedBy(L) === S.
  //
  // THIS READ THE STAIR'S OWN LEVEL (and the FOUNDATION for the lowest
  // floor), which was right for a bungalow and wrong one floor up: a 2ND FL
  // stair never saw the beam under it, and found 16 Oct, the stair to the
  // room over a detached garage ran its suggestion on a stand-in line
  // instead of hugging the garage's beam, 2" off, as every other floor's
  // does.
  const stairFloorBeams = levelId => {
    const carriers = (drawing?.levels || []).map(level => Number(level.id))
      .filter(id => Number(floorCarriedBy(id)?.id) === Number(levelId));
    return (drawing?.beams || []).filter(beam => carriers.includes(Number(beam.levelId))
      && beam.view === (Number(beam.levelId) === FOUNDATION_LEVEL_ID ? 'foundation' : 'floor'));
  };

  // Closest approach between a beam's centreline and the well boundary -- zero
  // when the beam reaches into the well at all.
  const stairBeamGapFt = (beam, poly) => {
    const G = window.DraftGeometry2D;
    let gap = Infinity;
    for (let index = 0; index < poly.length; index++) {
      const edge = { start: poly[index], end: poly[(index + 1) % poly.length] };
      if (G.segmentIntersection(beam, edge)) return 0;
      gap = Math.min(gap,
        G.pointToSegment(beam.start, edge).d,
        G.pointToSegment(beam.end, edge).d,
        G.pointToSegment(edge.start, beam).d,
        G.pointToSegment(edge.end, beam).d);
    }
    if (pointInLoop(poly, beam.start) || pointInLoop(poly, beam.end)) return 0;
    return gap;
  };

  // THE WELL IN WORLD SPACE. Its LENGTH is not the stair's: it spends tread
  // slots down the walking line until the drop reaches headroom plus the floor
  // assembly, so a deep floor or a tall drafter opens a longer hole. A flat
  // landing spends one slot, winders their tread count, and the covered parts
  // -- first run, landing, the used stretch of the second run -- union into one
  // well carrying half the finish allowance on every side.
  //
  // THE HEADER SITS BEHIND THE NOSING, not on it. `u = 0` is the top nosing,
  // so starting the hole there would make the nosing line and the cut line one
  // line -- and the backing would have no floor to fasten to. Only this end
  // moves: the far end is set by headroom, and Movie confirmed it stays that
  // way, "the opening above is effected by headroom as well on that end".
  const stairOpeningFootprint = (stair, headroomFt = stairHeadroomFt) => {
    const SG = window.DraftStairGeometry;
    const levels = stairLevels();
    const layout = SG.stairCurrentLayout(stair, levels);
    const split = SG.stairShapeSplit(stair, layout);
    const clearIn = headroomFt * 12
      + window.DraftLevelAssembly.levelFloorFt(assemblyFor(stair.levelId)) * 12;
    const slots = clearIn / layout.riserIn;
    const runStep = SG.STAIR_TREAD_RUN_IN / 12;
    const inchUp = ft => Math.ceil(ft * 12 - 0.0001) / 12;
    const w = stair.widthFt;
    const noseFt = STAIR_OPENING_NOSING_MIN_IN / 12;
    let uv;
    if (!split || slots <= split.t1) {
      const capFt = split ? split.t1 * runStep : layout.runFt;
      const lenFt = Math.min(inchUp(slots * runStep), capFt);
      if (!(lenFt > 0)) return null;
      uv = [{ u: -noseFt, v: -w / 2 }, { u: lenFt, v: -w / 2 },
            { u: lenFt, v: w / 2 }, { u: -noseFt, v: w / 2 }];
    } else {
      const run1 = split.t1 * runStep;
      const run2 = split.t2 * runStep;
      const L = split.landFt;
      const landSlots = split.winders || 1;
      const past = Math.max(0, slots - split.t1 - landSlots);
      const r2c = Math.min(inchUp(past * runStep), run2);
      if (split.shape === 'L') {
        const v1 = -w / 2 + L;
        const u2a = run1 + L / 2 - w / 2;
        const u2b = run1 + L / 2 + w / 2;
        uv = r2c <= 0
          ? [{ u: -noseFt, v: -w / 2 }, { u: run1 + L, v: -w / 2 }, { u: run1 + L, v: v1 },
             { u: run1, v: v1 }, { u: run1, v: w / 2 }, { u: -noseFt, v: w / 2 }]
          : [{ u: -noseFt, v: -w / 2 }, { u: run1 + L, v: -w / 2 }, { u: run1 + L, v: v1 },
             { u: u2b, v: v1 }, { u: u2b, v: v1 + r2c }, { u: u2a, v: v1 + r2c },
             { u: u2a, v: v1 }, { u: run1, v: v1 }, { u: run1, v: w / 2 }, { u: -noseFt, v: w / 2 }];
      } else {
        const vTop = w + SG.STAIR_U_GAP_IN / 12 + w / 2;
        const vLow = w / 2 + SG.STAIR_U_GAP_IN / 12;
        uv = r2c <= 0
          ? [{ u: -noseFt, v: -w / 2 }, { u: run1 + L, v: -w / 2 }, { u: run1 + L, v: vTop },
             { u: run1, v: vTop }, { u: run1, v: w / 2 }, { u: -noseFt, v: w / 2 }]
          : [{ u: -noseFt, v: -w / 2 }, { u: run1 + L, v: -w / 2 }, { u: run1 + L, v: vTop },
             { u: run1 - r2c, v: vTop }, { u: run1 - r2c, v: vLow }, { u: run1, v: vLow },
             { u: run1, v: w / 2 }, { u: -noseFt, v: w / 2 }];
      }
    }
    const dedup = uv.filter((pt, index) => {
      const prev = uv[(index + uv.length - 1) % uv.length];
      return Math.hypot(pt.u - prev.u, pt.v - prev.v) > 0.001;
    });
    if (dedup.length < 3) return null;
    const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const d = { x: dx / len, z: dz / len };
    const s = split && split.turn === 'left' ? -1 : 1;
    const perp = { x: -d.z * s, z: d.x * s };
    const ring = window.DraftGeometry2D.offsetOutline(
      dedup.map(pt => ({ x: pt.u, z: pt.v })), STAIR_OPENING_FINISH_IN / 24);
    return ring.map(pt => ({
      x: stair.start.x + d.x * pt.x + perp.x * pt.z,
      z: stair.start.z + d.z * pt.x + perp.z * pt.z,
    }));
  };


  const stairShift = (stair, dx, dz) => {
    stair.start.x += dx; stair.start.z += dz;
    stair.end.x += dx; stair.end.z += dz;
  };

  // Push the well back inside the interior ring, worst corner first. Six steps
  // because one push can expose another corner on a different edge.
  const stairNudgeInsideWalls = stair => {
    const G = window.DraftGeometry2D;
    const outline = houseOutlineOn(stair.levelId);
    if (!outline || outline.points.length < 3) return false;
    const ring = G.offsetOutline(
      outline.points.map(pt => ({ x: pt.x, z: pt.z })),
      -stairOpeningSetbackFt(stair.levelId));
    let moved = false;
    for (let step = 0; step < 6; step++) {
      const poly = stairOpeningFootprint(stair);
      if (!poly) break;
      let worst = null;
      poly.forEach(pt => {
        if (pointInLoop(ring, pt)) return;
        let best = null;
        ring.forEach((rp, index) => {
          const seg = { start: rp, end: ring[(index + 1) % ring.length] };
          const { d } = G.pointToSegment(pt, seg);
          if (!best || d < best.d) best = { d, seg };
        });
        if (best && (!worst || best.d > worst.d)) worst = best;
      });
      if (!worst) break;
      const ex = worst.seg.end.x - worst.seg.start.x, ez = worst.seg.end.z - worst.seg.start.z;
      const el = Math.hypot(ex, ez) || 1;
      let n = { x: -ez / el, z: ex / el };
      const mid = {
        x: (worst.seg.start.x + worst.seg.end.x) / 2,
        z: (worst.seg.start.z + worst.seg.end.z) / 2,
      };
      if (!pointInLoop(ring, { x: mid.x + n.x * 0.05, z: mid.z + n.z * 0.05 })) n = { x: -n.x, z: -n.z };
      stairShift(stair, n.x * (worst.d + 0.002), n.z * (worst.d + 0.002));
      moved = true;
    }
    return moved;
  };

  // Push the well off any beam it comes within the clearance of, taking
  // whichever side of the beam is the shorter move.
  const stairNudgeOffBeams = stair => {
    // NOT ITS OWN FRAMING: the flush beam on the open side stands half a
    // beam off the well, inside this clearance, by design.
    const beams = stairFloorBeams(stair.levelId)
      .filter(beam => Number(beam.stairId) !== Number(stair.id));
    if (!beams.length) return false;
    const clearFt = STAIR_BEAM_CLEAR_IN / 12;
    let moved = false;
    for (let step = 0; step < 4; step++) {
      const poly = stairOpeningFootprint(stair);
      if (!poly) break;
      const beam = beams.find(item => stairBeamGapFt(item, poly) < clearFt - 0.0001);
      if (!beam) break;
      const bx = beam.end.x - beam.start.x, bz = beam.end.z - beam.start.z;
      const bl = Math.hypot(bx, bz) || 1;
      const n = { x: -bz / bl, z: bx / bl };
      const base = beam.start.x * n.x + beam.start.z * n.z;
      const projs = poly.map(pt => pt.x * n.x + pt.z * n.z);
      const pushPlus = (base + clearFt) - Math.min(...projs);
      const pushMinus = Math.max(...projs) - (base - clearFt);
      const t = pushPlus <= pushMinus ? pushPlus + 0.002 : -(pushMinus + 0.002);
      stairShift(stair, n.x * t, n.z * t);
      moved = true;
    }
    return moved;
  };

  // ALTERNATING, BECAUSE ONE FIX OPENS THE OTHER RULE: sliding off a beam can
  // push a corner through the wall and back. Four passes, then it stops --
  // a stair that cannot satisfy both is refused rather than shuffled forever.
  // Returns the total move in INCHES, which is what the drafter is told.
  const stairAutoFit = stair => {
    const from = { x: stair.start.x, z: stair.start.z };
    for (let pass = 0; pass < 4; pass++) {
      let moved = stairNudgeInsideWalls(stair);
      moved = stairNudgeOffBeams(stair) || moved;
      if (!moved) break;
    }
    return Math.hypot(stair.start.x - from.x, stair.start.z - from.z) * 12;
  };

  // BORN LEGAL, VERIFIED: every well corner inside the interior ring and the
  // well clear of the carrying beams -- the exact two rules stairAutoFit
  // nudges for, checked WITHOUT nudging. Asked only of the stacked candidate,
  // which nothing scored: suggestStair's own winner is already legal by
  // construction.
  const stairPlacementLegal = stair => {
    const outline = houseOutlineOn(stair.levelId);
    if (!outline || outline.points.length < 3) return false;
    const poly = stairOpeningFootprint(stair);
    if (!poly || poly.length < 3) return false;
    const ring = window.DraftGeometry2D.offsetOutline(
      outline.points.map(pt => ({ x: pt.x, z: pt.z })),
      -stairOpeningSetbackFt(stair.levelId));
    if (!poly.every(pt => pointInLoop(ring, pt))) return false;
    const clearFt = STAIR_BEAM_CLEAR_IN / 12;
    // AND NOT WHERE THE CAR GOES: the garage square under this floor is the
    // third question, the same shape as the ring and the beams (Movie, 16
    // Oct: "the stairs can't overlap where the garage door / car will be or
    // the landing area for the man door").
    const BH = window.DraftBuildHouse;
    if (BH && BH.hitsKeepOut(garageKeepOutsUnder(stair.levelId), poly)) return false;
    return stairFloorBeams(stair.levelId)
      .filter(beam => Number(beam.stairId) !== Number(stair.id))
      .every(beam => stairBeamGapFt(beam, poly) >= clearFt - 1e-4);
  };

  // Rule B's trigger: the well runs beside an exterior wall.
  const stairWallAdjacent = stair => {
    const G = window.DraftGeometry2D;
    const outline = houseOutlineOn(stair.levelId);
    if (!outline || outline.points.length < 3) return false;
    const poly = stairOpeningFootprint(stair);
    if (!poly) return false;
    const ring = G.offsetOutline(
      outline.points.map(pt => ({ x: pt.x, z: pt.z })),
      -stairOpeningSetbackFt(stair.levelId));
    const edge = Math.min(...poly.map(pt => {
      let best = Infinity;
      for (let i = 0; i < ring.length; i++) {
        best = Math.min(best,
          G.pointToSegment(pt, { start: ring[i], end: ring[(i + 1) % ring.length] }).d);
      }
      return best;
    }));
    return edge < 1;
  };

  // ── THE DEAD STRIP BESIDE A WELL ────────────────────────────────────────
  //
  // Movie, 15 Oct, over his own foundation plan: "lets try to minimize cols
  // ,... see that part i marked pink - its too small to be useful, if that
  // area is less than 7 ft we should move the stairs to the garage wall (but
  // leave it 13" space between the ext wall line and where the stair starts
  // (to allow for foundation wall and insulation)", and, for the other half
  // of the same rule, "if there is 7ft or more, the north side of the stair
  // opening would also need 2 more columns on each end of the stair and a
  // beam".
  //
  // ONE MEASUREMENT, TWO ANSWERS. The strip left between the well and the
  // wall it faces is either a room or it is waste: under 7 ft nothing can be
  // done with it, so the stair goes over and takes the strip with it; at 7 ft
  // or more it IS a room, so the stair stays where the suggester put it and
  // the side it leaves open gets framed instead.
  //
  // THE 13" IS NOT TYPED HERE, and that is deliberate. stairOpeningSetbackFt
  // already derives the same inset from the walls actually standing -- the
  // foundation wall plus the insulation wall lining it -- and answers 14-1/2"
  // against this page's 8" concrete and 6-1/2" insulation. His 13" is that
  // same allowance read off a different assembly; a typed 13 would stop
  // following the drafter's own wall types the moment he changed one, which
  // is the thing that setback was written to do.
  const STAIR_DEAD_STRIP_FT = 7;
  // A carrying beam within this of a well's long edge IS that side's beam, so
  // the side is already framed and gets nothing. The mid-span pass lands one
  // at STAIR_BEAM_CLEAR_IN (2") off the edge it hugs, so this only has to be
  // wide enough to recognise it and narrow enough not to claim the beam on
  // the far side of a small room.
  const STAIR_SIDE_BEAM_NEAR_FT = 1;
  // ── AND THE OPEN SIDE IS FRAMED ONLY PAST 10 FT, WITH THE BEAM'S FACE ON THE
  // EDGE ──
  //
  // Movie, 16 Oct: "when long side is exposed to 10ft or more floor span it
  // should have a column on each end of the opening and a flush beam along
  // the opening (edge of beam alligned with edge of opening (center a few
  // inches inside the floor)".
  //
  // TWO RULES ON ONE STRIP, and they stack: under 7 ft the strip is dead and
  // the stair goes to the wall (STAIR_DEAD_STRIP_FT); from 7 ft it is a room,
  // and up to 10 ft its joists carry themselves -- nothing is added; at 10 ft
  // and over the open edge takes the flush beam on a column at each end.
  //
  // THE SPAN IS FLOOR SPAN: from the well's edge to the next support on that
  // side, a carrying beam or the exterior wall, whichever the joists reach
  // first (stairSideSpans). #745 measured to the wall alone.
  const STAIR_SIDE_BEAM_SPAN_FT = 10;
  // THE OFFSET IS THE BEAM'S OWN, not a clearance. #745 set the centreline
  // STAIR_BEAM_CLEAR_IN (2") off the well edge, which on a 3 1/2" beam put
  // the face 1/4" inside the hole and looked right by accident. His rule is
  // the FACE on the opening's edge, so the centre sits half the beam inside
  // the floor whatever the beam is: two plies of 1 3/4" engineered lumber
  // here, the flush beam the garage already frames with. The 2" clearance is
  // untouched -- it still keeps a well off every OTHER carrying beam, and a
  // stair's own framing is excused from it by its stairId.
  const STAIR_FLUSH_BEAM_WIDTH_IN = 3.5;

  // BOTH SIDES OF A WELL, measured ACROSS the run: a ray from the middle of
  // each long edge out to the interior ring. `{ ft, dir }`, dir pointing that
  // way, nearest side first.
  //
  // A RAY RATHER THAN A NEAREST-POINT DISTANCE, which stairWallAdjacent above
  // can use and this cannot: the nearest point of the ring to a well corner
  // is as likely to be the wall the stair runs INTO as the one it runs
  // beside, and a strip measured to the wrong wall is a stair slid sideways
  // for a reason that was never on that side.
  const stairSideStrips = stair => {
    const G = window.DraftGeometry2D;
    const outline = houseOutlineOn(stair.levelId);
    const poly = stairOpeningFootprint(stair);
    if (!outline || outline.points.length < 3 || !poly || poly.length < 3) return [];
    const ring = G.offsetOutline(
      outline.points.map(pt => ({ x: pt.x, z: pt.z })),
      -stairOpeningSetbackFt(stair.levelId));
    const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const n = { x: -dz / len, z: dx / len };
    const mid = poly.reduce((sum, pt) => ({
      x: sum.x + pt.x / poly.length, z: sum.z + pt.z / poly.length }), { x: 0, z: 0 });
    return [1, -1].map(side => {
      const dir = { x: n.x * side, z: n.z * side };
      // FROM THE HOLE'S OWN EDGE, not from its middle: the strip is what is
      // left beside the opening, and half a well is not part of it.
      const out = Math.max(...poly.map(pt =>
        (pt.x - mid.x) * dir.x + (pt.z - mid.z) * dir.z));
      const from = { x: mid.x + dir.x * out, z: mid.z + dir.z * out };
      const ray = { start: from, end: { x: from.x + dir.x * 1000, z: from.z + dir.z * 1000 } };
      let best = Infinity;
      for (let i = 0; i < ring.length; i++) {
        const hit = G.segmentIntersection(ray,
          { start: ring[i], end: ring[(i + 1) % ring.length] });
        if (hit) best = Math.min(best, Math.hypot(hit.x - from.x, hit.z - from.z));
      }
      return { ft: best, dir, from };
    }).filter(side => Number.isFinite(side.ft)).sort((a, b) => a.ft - b.ft);
  };

  // THE FLOOR SPAN ON EACH SIDE: the ring's answer, or the first carrying beam
  // the same ray crosses, whichever is nearer. The joists on that side span
  // from the well's edge to that support, and that is what the open-side rule
  // asks about. A stair's own framing (a beam carrying its stairId) is not a
  // support the well is measured to -- it is the answer, not the question.
  const stairSideSpans = stair => {
    const G = window.DraftGeometry2D;
    const beams = stairFloorBeams(stair.levelId)
      .filter(beam => Number(beam.stairId) !== Number(stair.id));
    return stairSideStrips(stair).map(side => {
      const ray = { start: side.from,
        end: { x: side.from.x + side.dir.x * 1000, z: side.from.z + side.dir.z * 1000 } };
      let ft = side.ft;
      beams.forEach(beam => {
        const hit = G.segmentIntersection(ray, { start: beam.start, end: beam.end });
        if (hit) ft = Math.min(ft, Math.hypot(hit.x - side.from.x, hit.z - side.from.z));
      });
      return { ...side, ft };
    });
  };

  // THE STAIR GOES OVER when the strip beside it is too small to be a room.
  // Returns the move in feet, 0 when the strip is a room or there is nothing
  // to measure.
  //
  // AND IT PUTS THE STAIR BACK IF THE MOVE IS NOT LEGAL. The strip is clear of
  // the wall by construction, but a carrying beam can be standing in it, and a
  // well slid onto a beam is worse than a narrow strip: stairAutoFit would
  // then nudge it off again, to somewhere neither rule asked for.
  const stairCloseDeadStrip = stair => {
    const [near] = stairSideStrips(stair);
    if (!near || !(near.ft > 0.01) || near.ft >= STAIR_DEAD_STRIP_FT) return 0;
    // JUST INSIDE THE RING, by the same two-thousandth the beam nudge uses:
    // a well edge landed exactly ON the setback line reads as outside it on
    // the next floating-point comparison, and stairAutoFit pulls it back.
    const t = near.ft - 0.002;
    stairShift(stair, near.dir.x * t, near.dir.z * t);
    if (stairPlacementLegal(stair)) return t;
    stairShift(stair, -near.dir.x * t, -near.dir.z * t);
    return 0;
  };

  // WHICH LEVEL A STAIR'S FRAMING IS FILED ON. The beams carrying the lowest
  // floor are the FOUNDATION's, in the foundation view -- stairFloorBeams
  // reads them from exactly there -- and every floor above carries its own.
  // Filed anywhere else, a beam under a well would be invisible to the rule
  // that keeps the next well off it.
  const stairFrameFiling = levelId => {
    const floors = stairFloorLevels();
    const lowest = floors.length ? Number(floors[0].id) : null;
    return Number(levelId) === lowest
      ? { levelId: FOUNDATION_LEVEL_ID, view: 'foundation' }
      : { levelId: Number(levelId), view: 'floor' };
  };

  // THE OPEN SIDE OF A WELL GETS A BEAM ON TWO COLUMNS -- "2 more columns on
  // each end of the stair and a beam".
  //
  // PER SIDE, AND ONLY WHERE THE SIDE IS REALLY OPEN: a side standing on the
  // wall is carried by the wall, and a side the mid-span pass already laid a
  // beam along is carried by that beam. What is left is a long edge of a hole
  // with nothing under it, which is the one that needs framing -- so a stair
  // pushed to the wall by the rule above comes out with ONE beam, not two,
  // and the columns stay minimised the way he asked.
  // THE WAY THE JOISTS RUN UNDER A STAIR'S FLOOR: across the beams carrying
  // it (its own framing aside -- that is the answer, not the question), or
  // the short way on a deck with none. joistBays' reading, so the arrows on
  // the sheet and this rule never disagree. 'x', 'z', or null for no body.
  const stairJoistAxis = stair => {
    const B = window.DraftBuildHouse;
    const outline = houseOutlineOn(stair.levelId);
    if (!B?.joistBays || !outline || outline.points.length < 3) return null;
    const beams = stairFloorBeams(stair.levelId)
      .filter(beam => Number(beam.stairId) !== Number(stair.id));
    return B.joistBays(outline.points.map(pt => ({ x: pt.x, z: pt.z })), { beams })?.axis || null;
  };

  const stairOpenSideFraming = stair => {
    const poly = stairOpeningFootprint(stair);
    if (!poly || poly.length < 3) return [];
    // ITS OWN FRAMING ASIDE, as stairSideSpans has it: the question is what
    // the well needs, and the beam already answering it is not a carrier
    // that excuses the side it stands on.
    const beams = stairFloorBeams(stair.levelId)
      .filter(beam => Number(beam.stairId) !== Number(stair.id));
    const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const u = { x: dx / len, z: dz / len };
    // A RUN WITH THE JOISTS CUTS NONE ALONG ITS SIDES (Movie, 19 Oct: "the
    // short ends won't need beams ever it can be supported but the side
    // joists only the long end needs a beam on side that span 10 ft or
    // more"). The joists beside it run past the hole whole; only the ones at
    // its ends are cut, and a header on the next joist carries those. So a
    // stair parallel to the joists -- across the beams -- takes no side beam.
    const joist = stairJoistAxis(stair);
    if (joist && (Math.abs(u.x) >= Math.abs(u.z) ? 'x' : 'z') === joist) return [];
    const mid = poly.reduce((sum, pt) => ({
      x: sum.x + pt.x / poly.length, z: sum.z + pt.z / poly.length }), { x: 0, z: 0 });
    // TEN FEET OF FLOOR OR MORE on that side, to the wall or to a beam.
    return stairSideSpans(stair).filter(side => side.ft >= STAIR_SIDE_BEAM_SPAN_FT - 1e-6)
      .filter(side => !beams.some(beam =>
        stairBeamGapFt(beam, poly) <= STAIR_SIDE_BEAM_NEAR_FT
        // THE BEAM ON THAT SIDE, not simply a beam near the hole: a gap
        // measured to the well says nothing about which side of it the beam
        // is on, and the one hugging the east edge would otherwise excuse the
        // west edge as well.
        && ((beam.start.x + beam.end.x) / 2 - mid.x) * side.dir.x
          + ((beam.start.z + beam.end.z) / 2 - mid.z) * side.dir.z > 0))
      .map(side => {
        // THE LONG EDGE, END TO END, and the two columns at its ends: what he
        // asked for, and also where a trimmer's load comes down.
        //
        // THE FACE ON THE OPENING'S EDGE: the centreline half a beam inside
        // the floor (STAIR_FLUSH_BEAM_WIDTH_IN). That is inside the 2" every
        // other carrying beam keeps off a well, which is why stairNudgeOffBeams
        // and stairPlacementLegal excuse a stair's own framing by its stairId
        // -- without that the next press would shuffle the stair away from
        // the beam that holds it.
        const off = STAIR_FLUSH_BEAM_WIDTH_IN / 24;
        const along = poly.map(pt => (pt.x - mid.x) * u.x + (pt.z - mid.z) * u.z);
        const base = { x: side.from.x + side.dir.x * off, z: side.from.z + side.dir.z * off };
        const a = { x: base.x + u.x * Math.min(...along),
          z: base.z + u.z * Math.min(...along) };
        const b = { x: base.x + u.x * Math.max(...along),
          z: base.z + u.z * Math.max(...along) };
        return { start: a, end: b, columns: [a, b] };
      });
  };

  // The rule-derived suggestion for one level, UNCOMMITTED. The beam edges are
  // the ones the well must clear, the stamps weight the circulation core, and
  // `lowerStair` is a soft pull toward the run below -- passed only on the
  // fallback path, where the strict stack could not hold its headroom.
  const autoStairSuggestion = (levelId, lowerStair = null) => {
    const AS = window.DraftAutoStair;
    const SG = window.DraftStairGeometry;
    if (!AS) return null;
    const outline = houseOutlineOn(levelId);
    if (!outline || outline.points.length < 3) return null;
    const descent = SG.stairDescent(levelId, stairLevels());
    if (!descent || !(descent.riseFt > 0)) return null;
    const layout = SG.stairLayout(descent.riseFt);
    const floors = stairFloorLevels();
    const lowest = floors.length > 0 && Number(floors[0].id) === Number(levelId);
    const beams = stairFloorBeams(levelId).map(beam => ({
      start: { x: beam.start.x, z: beam.start.z },
      end: { x: beam.end.x, z: beam.end.z },
    }));
    const stamps = (drawing?.roomTags || [])
      .filter(tag => Number(tag.levelId) === Number(levelId) && tag.stamped === true && tag.base)
      .map(tag => ({ name: tag.base, x: tag.at.x, z: tag.at.z }));
    const res = AS.suggestStair({
      points: outline.points.map(pt => ({ x: pt.x, z: pt.z })),
      insetFt: stairOpeningSetbackFt(levelId),
      beams,
      stamps,
      runFt: layout.runFt,
      treads: layout.treads,
      widthFt: stairWidthFt,
      landFt: SG.stairLandFt(stairWidthFt),
      finishIn: STAIR_OPENING_FINISH_IN,
      gapIn: STAIR_BEAM_CLEAR_IN,
      runStepFt: SG.STAIR_TREAD_RUN_IN / 12,
      softInterior: lowest,   // rule B: basement stairs prefer interior, softly
      lowerStair,
      // THE GARAGE SQUARE under this floor: no candidate may stand in it.
      keepOuts: garageKeepOutsUnder(levelId).map(k => k.points),
    });
    return { ...res, layout, descent };
  };

  // Commit one suggestion as an ordinary stair record -- the same shape a hand
  // placement writes, plus the auto tag and the entry L's split.
  //
  // THE ID IS AN INTEGER AND IS HANDED IN, which is not cosmetic. Walls,
  // outlines, floors and openings take `newDrawingItemId` -- the `kind-7`
  // string -- but drawing-format.js's stair validator reads
  // `Number.isInteger(Number(stair.id))`, so a stair carrying `stair-7` is
  // NaN to it and the record is dropped on the next load. That is the exact
  // failure newStructureId's own comment was written for: "saves a file that
  // reads correctly, and loses it on the next load with no error at either
  // end". It comes in from the caller because one press places a flight on
  // every descending floor, and a counter re-read per level would hand the
  // same number out twice -- which the format dedupes by dropping every
  // record after the first, equally silently.
  //
  // `risers` AND `treadRunIn` ARE SET HERE AND ARE NOT IN THE dc ORIGINAL.
  // MODEL.dc.html's _buildAutoStair omits both while its HAND placement sets
  // `risers: layout.risers` (:3383) -- and drawing-format.js defaults a
  // missing `risers` to 1, so an auto stair saved and reloaded came back
  // claiming ONE riser. It never showed: stairCurrentLayout re-derives the
  // layout from the level heights on every paint, and design-notices.js
  // computes its riser counts from `riseFt` rather than the stored field. But
  // tests/stairs.spec.js:44 asserts stair.risers, so the field is contract,
  // and a record whose own numbers disagree with each other is the kind of
  // thing that is true until something finally reads it.
  const buildAutoStair = (levelId, sug, widthFt, id) => {
    const SG = window.DraftStairGeometry;
    return {
      id,
      start: { x: sug.stair.start.x, y: 0, z: sug.stair.start.z },
      end: stairEndPoint(sug.stair, sug.layout),
      levelId,
      view: 'plan',
      widthFt,
      riseFt: sug.layout.riseFt,
      risers: sug.layout.risers,
      treadRunIn: SG.STAIR_TREAD_RUN_IN,
      rail: stairRailSide,
      shape: sug.stair.shape,
      turn: sug.stair.turn,
      winders: 0,
      auto: true,
      ...(Number.isInteger(sug.stair.splitTreads) && sug.stair.splitTreads > 0
        ? { splitTreads: sug.stair.splitTreads } : {}),
    };
  };

  // `end` IS THE END OF THE FIRST LEG, not of the whole flight -- a turned
  // stair stores its top run and derives the rest. drawing-format.js:598 says
  // start is the upper-floor nosing; the direction is start -> end, downhill.
  const stairEndPoint = (shape, layout) => {
    const SG = window.DraftStairGeometry;
    const dx = shape.end.x - shape.start.x, dz = shape.end.z - shape.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const firstLen = shape.shape === 'straight' ? layout.runFt
      : (shape.splitTreads || Math.max(1, Math.floor((layout.treads - 1) / 2)))
        * SG.STAIR_TREAD_RUN_IN / 12;
    return {
      x: shape.start.x + (dx / len) * firstLen,
      y: 0,
      z: shape.start.z + (dz / len) * firstLen,
    };
  };


  // STAIRS STACK: the upper run goes directly over the one below so the
  // headroom holds. Over an entry L the frame FLIPS -- the upper stair's LONG
  // top leg rides over the long leg below, the landing overlays the landing,
  // and the short 2-3 step leg lands at the entry floor -- so the turn
  // reverses and splitTreads becomes the long top leg. Built UNCOMMITTED; the
  // caller pushes it only once stairPlacementLegal says the well still fits.
  const buildStackedStair = (below, levelId, layout, widthFt, id) => {
    const SG = window.DraftStairGeometry;
    const runStep = SG.STAIR_TREAD_RUN_IN / 12;
    const dxb = below.end.x - below.start.x, dzb = below.end.z - below.start.z;
    const lb = Math.hypot(dxb, dzb) || 1;
    const d = { x: dxb / lb, z: dzb / lb };
    const belowLayout = SG.stairCurrentLayout(below, stairLevels());
    const belowSplit = SG.stairShapeSplit(below, belowLayout);
    const make = (start, dir, firstLen, extra) => ({
      id,
      start: { x: start.x, y: 0, z: start.z },
      end: { x: start.x + dir.x * firstLen, y: 0, z: start.z + dir.z * firstLen },
      levelId,
      view: 'plan',
      widthFt,
      riseFt: layout.riseFt,
      risers: layout.risers,
      treadRunIn: SG.STAIR_TREAD_RUN_IN,
      rail: below.rail,
      shape: below.shape || 'straight',
      turn: below.turn || 'right',
      winders: below.winders || 0,
      auto: true,
      ...extra,
    });
    // THE EXTRA WIDTH GOES TO THE WALL SIDE, not half of it into the room.
    //
    // Movie, 15 Oct: "the above storey stairs goingto the second floor will
    // have full 6\" still so those stairs can be 6\" wider", and then "line it
    // up on and leave the extra inch on the exterior wall side the carpenter
    // can deal with it".
    //
    // Rule B widens a flight stacked over a basement run that hugs an
    // exterior wall -- the basement lost its width to the foundation wall and
    // the insulation lining it, and the storey above has only a stud wall
    // there. A wider run left centred on the same line grows BOTH ways, so
    // half the width it just gained lands in the room, and the two flights no
    // longer line up on the edge a carpenter sets his stringers to. Taking it
    // back on the wall side puts the inside edges over each other and leaves
    // the odd inch where he said to leave it.
    const widened = record => {
      const grew = (record.widthFt - (below.widthFt || record.widthFt)) / 2;
      if (!(grew > 0.0001)) return record;
      const [near] = stairSideStrips(below);
      if (!near) return record;
      stairShift(record, near.dir.x * grew, near.dir.z * grew);
      return record;
    };
    if (belowSplit && Number.isInteger(below.splitTreads) && below.splitTreads > 0) {
      const tShort = belowSplit.t1;
      const s = belowSplit.turn === 'right' ? 1 : -1;
      const perp = { x: -d.z * s, z: d.x * s };
      const L = belowSplit.landFt;
      const run1b = belowSplit.t1 * runStep;
      const landingCentre = {
        x: below.start.x + d.x * (run1b + L / 2) + perp.x * (-below.widthFt / 2 + L / 2),
        z: below.start.z + d.z * (run1b + L / 2) + perp.z * (-below.widthFt / 2 + L / 2),
      };
      const t1u = Math.max(1, layout.treads - 1 - tShort);
      const du = { x: -perp.x, z: -perp.z };
      const su = -s;
      const perpU = { x: -du.z * su, z: du.x * su };
      const Lu = SG.stairLandFt(widthFt);
      const run1u = t1u * runStep;
      const start = {
        x: landingCentre.x - du.x * (run1u + Lu / 2) - perpU.x * (-widthFt / 2 + Lu / 2),
        z: landingCentre.z - du.z * (run1u + Lu / 2) - perpU.z * (-widthFt / 2 + Lu / 2),
      };
      return widened(make(start, du, run1u, {
        turn: su > 0 ? 'right' : 'left',
        winders: 0,
        splitTreads: t1u,
      }));
    }
    const firstLen = belowSplit
      ? Math.max(1, Math.floor((layout.treads - 1) / 2)) * runStep
      : layout.runFt;
    return widened(make({ x: below.start.x, z: below.start.z }, d, firstLen, {}));
  };

  // SUGGEST FOR ONE LEVEL: stack over the run below first, and fall back to
  // the level's own best candidate with a message when the stack cannot be
  // made legal. Returns { stair, note } -- a null stair with a note when
  // nothing fits, and null outright when the level needs no stair at all.
  //
  // A LEVEL THAT ALREADY HAS ONE IS LEFT ALONE. Re-running must not stack a
  // second flight on the first, and a hand-placed stair is the drafter's
  // answer to this question already.
  const suggestStairForLevel = (levelId, id) => {
    const SG = window.DraftStairGeometry;
    const floors = stairFloorLevels();
    const idx = floors.findIndex(level => Number(level.id) === Number(levelId));
    if (idx < 0) return null;
    const descent = SG.stairDescent(levelId, stairLevels());
    if (!descent || !(descent.riseFt > 0)) return null;
    const planStairs = (drawing?.stairs || [])
      .filter(stair => (stair.view || 'plan') === 'plan');
    if (planStairs.some(stair => Number(stair.levelId) === Number(levelId))) return null;
    const layout = SG.stairLayout(descent.riseFt);
    const below = idx > 0
      ? planStairs.find(stair => Number(stair.levelId) === Number(floors[idx - 1].id))
      : null;
    // RULE B: a basement descent running beside an exterior wall widens every
    // stacked flight above it to 3'-6", so the basement run keeps its true
    // 3'-0" clear past the thicker foundation wall.
    const lowestStair = floors.length
      ? planStairs.find(stair => Number(stair.levelId) === Number(floors[0].id))
      : null;
    const widen = lowestStair ? stairWallAdjacent(lowestStair) : false;
    const widthFt = idx > 0 && widen ? Math.max(3.5, stairWidthFt) : stairWidthFt;
    let stackNote = '';
    if (below) {
      const stacked = buildStackedStair(below, levelId, layout, widthFt, id);
      if (stairPlacementLegal(stacked)) {
        return {
          stair: stacked,
          note: `${namedLevel(levelId)}: ${layout.risers} risers stacked over the run below`
            + ' — headroom holds.',
        };
      }
      stackNote = ' (could not stack over the run below — headroom needs checking)';
    }
    // The strict stack did not hold, so fall back to a free placement -- but
    // let the flight below still PULL on it. Its run midpoint stands in for
    // the well centre, near enough for a proximity bonus.
    const sug = autoStairSuggestion(levelId, below ? {
      wellCentre: {
        x: (below.start.x + below.end.x) / 2,
        z: (below.start.z + below.end.z) / 2,
      },
    } : null);
    if (!sug) return null;
    if (!sug.stair) {
      return {
        stair: null,
        note: `${namedLevel(levelId)}: no legal stair position — straight `
          + `${sug.report?.straight || 'blocked'}; L ${sug.report?.L || 'blocked'};`
          + ` U ${sug.report?.U || 'blocked'}.`,
      };
    }
    const stair = buildAutoStair(levelId, sug, widthFt, id);
    const how = sug.stair.splitTreads
      ? `entry L — landing at the front wall, ${sug.stair.splitTreads} steps down from the entry`
      : sug.stair.shape === 'straight'
        ? `straight run${stairFloorBeams(levelId).length ? ' along the beam edge' : ''}`
        : sug.stair.shape === 'L' ? 'folded L at the corner nearest the core' : 'U switchback';
    return { stair, note: `${namedLevel(levelId)}: ${layout.risers} risers · ${how}${stackNote}.` };
  };


  // THE HOLE THE STAIR DESCENDS THROUGH. A stair is rough intent: it gets a
  // NUDGE first -- clear of every beam carrying the floor, one real wall
  // assembly inside the exterior -- and then the well is cut from the floor it
  // lands inside.
  //
  // A REFUSAL IS REPORTED, NOT SWALLOWED. Nobody is watching a single stair
  // during a build, so a hole that silently did not get cut is the drafter
  // handed a house with a stair and no opening and nothing saying why. It
  // rides back as data on the result the caller already reads -- the same
  // choice the unsupported-column count made.
  //
  // CENTRE-ONLY, and that is the manual path's rule too rather than a
  // shortcut here: an opening is charged to the floor its centre lands in.
  // The whole-footprint question is a real one -- this opening's LENGTH comes
  // from headroom, not from the stair, so a stair that fits can still open a
  // hole that overhangs -- and it is reported rather than refused.
  // `served` names stairs that need no hole: a MOD BILEVEL's third flight
  // climbs FROM a landing whose own deck stops at its top step, so there is
  // no floor of its level over the run to cut.
  const buildStairOpenings = (served = new Set()) => {
    const G = window.DraftGeometry2D;
    const result = { cut: 0, nudges: [], refused: [], placed: [] };
    if (!Array.isArray(drawing.surfaceOpenings)) drawing.surfaceOpenings = [];
    (drawing?.stairs || [])
      .filter(stair => (stair.view || 'plan') === 'plan' && !served.has(stair.id))
      .forEach(stair => {
        if (drawing.surfaceOpenings.some(opening => opening.stairId === stair.id
          || (opening.stairIds || []).includes(stair.id))) return;
        const descent = window.DraftStairGeometry.stairDescent(stair.levelId, stairLevels());
        if (!descent || !(descent.riseFt > 0)) return;
        const nudgedIn = stairAutoFit(stair);
        const points = stairOpeningFootprint(stair);
        if (!points || points.length < 3) return;
        const candidates = (drawing?.floors || []).filter(floor =>
          Number(floor.levelId) === Number(stair.levelId)
          && floor.structure !== 'slab' && (floor.points || []).length >= 3);
        const floor = candidates.find(item => G.ringInsideRing(points, item.points));
        if (!floor) {
          const centre = points.reduce((sum, pt) => ({
            x: sum.x + pt.x / points.length,
            z: sum.z + pt.z / points.length,
          }), { x: 0, z: 0 });
          result.refused.push(candidates.some(item => pointInLoop(item.points, centre))
            ? `${namedLevel(stair.levelId)}: the opening runs off the floor`
            : `${namedLevel(stair.levelId)}: no floor to cut it from`);
          return;
        }
        // PLAIN POINTS, NOT POOLED. poolVertex is keyed to the 'house' body,
        // so pooling here would let an opening corner MERGE with a wall corner
        // and drag one when the other moves -- which is the exact thing
        // MODEL.dc.html's separate 'opening' body exists to prevent. And the
        // loader pools WALLS only, so an opening written with plain points is
        // what a reload produces anyway: pooling on the press and not on the
        // reload would be the two paths disagreeing.
        const opening = {
          id: newDrawingItemId('opening'),
          hostType: 'floor',
          hostId: floor.id,
          points: points.map(pt => ({ x: pt.x, z: pt.z })),
          levelId: stair.levelId,
          stairId: stair.id,
        };
        drawing.surfaceOpenings.push(opening);
        result.placed.push({ list: drawing.surfaceOpenings, item: opening });
        result.cut += 1;
        if (nudgedIn > 0.05) {
          result.nudges.push(window.DraftFormatters.formatInchesOnly(nudgedIn));
        }
      });
    return result;
  };

  // ── THE GARAGE ROOM'S OWN FLIGHT, PLACED RATHER THAN SUGGESTED ───────────
  //
  // Movie, 13 Oct, having seen the suggester's answer: "for 2 storey make it
  // 24X30 and put the stairs along one side", and "the door goes straight to
  // the bottom of the stairs (about 8ft entry area before the stairs".
  //
  // THE SUGGESTER WAS NOT WRONG, IT WAS BLIND. Its job is to find room in a
  // house whose rooms it does not know, and it scores a run against beams,
  // stamped room names and the flight below -- an empty 30x24 box offers it
  // none of those, so it parked the run down the middle. The room's SHAPE is
  // the answer here and the build knows it: the front wall carries two bays
  // and a 4 ft strip beside them, and the strip is the stair's.
  //
  //   ALONG THE HOUSE SIDE   the strip's own wall, one assembly in, which is
  //                          the same inset the well is cut to.
  //   8 FT BACK FROM THE DOOR the entry he asked for, measured from the INSIDE
  //                          face rather than the centreline -- what a drafter
  //                          paces is the floor, not the geometry.
  //   CLIMBING AWAY FROM IT  so the bottom tread meets the man door and the
  //                          flight runs into the building, not at it.
  //
  // NULL WHEN IT WILL NOT FIT, and the caller then falls back to the
  // suggester: a garage typed shallow enough that 8 ft of entry and the run
  // do not fit between the walls should get the best position something can
  // find, not a flight through the back wall.
  // THE ENTRY HE ASKED FOR, AND THE LANDING HE RULED ON. Movie, 13 Oct: "the
  // door goes straight to the bottom of the stairs (about 8ft entry area
  // before the stairs", then "and top of landing needs at least 3ft to the
  // int of the ext wall" -- revised in the same breath to "make it 3'6 min
  // from the ext wall line", "4-6 perferred", "3-6 min."
  //
  // MEASURED FROM THE WALL LINE, which is what he said and is not the same as
  // the inside face: the line is the outline's own, the one he reads off the
  // plan. On his 24 ft depth that is what makes the numbers close -- 8 ft of
  // entry and a 12'-6" run leave exactly 3'-6" behind the top.
  //
  // THE LANDING IS THE CONSTRAINT AND THE ENTRY IS THE GIVE. A landing under
  // 3'-6" is a code question; an entry a few inches short of 8 is a taste
  // one. So the landing takes what it needs up to the preferred 4'-6", the
  // entry takes the rest, and a garage too shallow for both hands the
  // placement back to the suggester rather than drawing a flight that
  // arrives at a wall.
  const GARAGE_STAIR_ENTRY_FT = 8;
  const GARAGE_STAIR_LANDING_MIN_FT = 3.5;
  const GARAGE_STAIR_LANDING_WANT_FT = 4.5;
  // AND OFF THE WALL BY A FOOT, Movie 13 Oct: "we should also put the
  // eterior stairs at 1ft in from the ext wall line to allow 8" con min, or
  // 1ft for ICF (might need a bit more". So the clearance is not a framing
  // inset -- it is room for the CONCRETE under the wall, and a foot covers
  // both the 8" minimum pour and an ICF wall. Measured from the wall LINE,
  // like the landing, because that is the line he reads it off.
  //
  // AND "A BIT MORE" IS WORKED OUT RATHER THAN REMEMBERED. On this page a
  // wall's reference line is its FACE, not its centreline, so a foot from the
  // wall line is a foot from the OUTSIDE of the wall: on a 2x6 that leaves
  // about 6 1/2" of floor inside it, and on ICF -- near a foot thick -- it
  // leaves nothing at all. So the clearance is the GREATER of his foot and
  // the wall's own thickness plus a margin, which is a flat foot on framing
  // and widens itself on ICF without anyone having to notice.
  const GARAGE_STAIR_WALL_CLEAR_FT = 1;
  const GARAGE_STAIR_WALL_MARGIN_FT = 0.5;
  // "lets make stair width 3-4 for 2 storey garage typical (default" -- four
  // inches wider than the page's own 3'-0", and only here: this is the
  // garage's stair, not the house's, and the page-wide default is what every
  // other flight is still placed at.
  const GARAGE_STAIR_WIDTH_FT = 3 + 4 / 12;
  const buildGarageRoomStair = (levelId, corners, id) => {
    const SG = window.DraftStairGeometry;
    if (!SG || !corners || corners.length < 3) return null;
    const descent = SG.stairDescent(levelId, stairLevels());
    if (!descent || !(descent.riseFt > 0)) return null;
    const layout = SG.stairLayout(descent.riseFt);
    const xs = corners.map(pt => pt.x), zs = corners.map(pt => pt.z);
    const minX = Math.min(...xs), maxZ = Math.max(...zs), minZ = Math.min(...zs);
    const inset = stairOpeningSetbackFt(levelId);
    const widthFt = GARAGE_STAIR_WIDTH_FT;
    // `stairOpeningSetbackFt` IS THE WALL ASSEMBLY -- the same number the well
    // is cut to -- so it is what "the wall's own thickness" asks, and an ICF
    // garage answers it differently from a 2x6 one without this knowing how.
    const clearFt = Math.max(GARAGE_STAIR_WALL_CLEAR_FT,
      inset + GARAGE_STAIR_WALL_MARGIN_FT);
    const centreX = minX + clearFt + widthFt / 2;
    // WHAT IS LEFT ONCE THE FLIGHT IS IN IT, wall line to wall line, split
    // between the landing at the back and the entry at the door. The landing
    // is served first, up to the preferred 4'-6"; whatever remains is the
    // entry, which is why a deeper garage spends its extra foot on the walk
    // in rather than on a landing nobody stands on.
    const spare = (maxZ - minZ) - layout.runFt;
    const landing = Math.min(GARAGE_STAIR_LANDING_WANT_FT,
      Math.max(GARAGE_STAIR_LANDING_MIN_FT, spare - GARAGE_STAIR_ENTRY_FT));
    // SHORT OF THE MINIMUM IS NOT A STAIR TO DRAW. Better the suggester's
    // best position than a flight whose top lands 2 ft off the back wall.
    if (spare - landing < GARAGE_STAIR_LANDING_MIN_FT) return null;
    const topZ = minZ + landing;
    const bottomZ = topZ + layout.runFt;
    if (bottomZ > maxZ - inset) return null;
    return {
      id,
      // START IS THE UPPER NOSING and start -> end runs DOWNHILL
      // (drawing-format.js:598), so the top of the flight is the end farther
      // from the door and `end` is the bottom tread beside the entry.
      start: { x: centreX, y: 0, z: topZ },
      end: { x: centreX, y: 0, z: bottomZ },
      levelId,
      view: 'plan',
      widthFt,
      riseFt: layout.riseFt,
      risers: layout.risers,
      treadRunIn: SG.STAIR_TREAD_RUN_IN,
      rail: stairRailSide,
      shape: 'straight',
      turn: 'right',
      winders: 0,
      auto: true,
    };
  };

  // ONE FLIGHT, IN THE STRIP, WITH ITS WELL -- the garage build's own call.
  // It returns undo-shaped `{list, item}` pairs like placeAutoStairs, so the
  // press still costs one Ctrl+Z, and it falls back to the suggester when the
  // deliberate position will not fit.
  const placeGarageRoomStair = levelId => {
    if (!drawing) return -1;
    if (!Array.isArray(drawing.stairs)) drawing.stairs = [];
    const outline = (drawing.outlines || []).find(loop => Number(loop.levelId) === Number(levelId)
      && loop.garage !== true && (loop.points || []).length >= 3);
    const stair = outline
      ? buildGarageRoomStair(levelId, outline.points, newStructureId(drawing.stairs))
      : null;
    if (!stair) return placeAutoStairs({ only: [levelId] });
    drawing.stairs.push(stair);
    const cut = buildStairOpenings();
    return { placed: [{ list: drawing.stairs, item: stair }, ...cut.placed] };
  };

  // EVERY DESCENDING FLOOR WITHOUT A STAIR, BOTTOM-UP -- and the order is the
  // rule rather than tidiness, the same way it is for the beams: an upper
  // flight stacks on the one below it, so the floor under it has to be placed
  // FIRST or the stack has nothing to sit over and every storey is placed
  // free.
  //
  // WHAT IT RETURNS IS UNDO-SHAPED, `{list, item}` pairs, so the bone press
  // folds the stairs AND their openings into the ONE step that covers the
  // whole build. A stair with an undo step of its own would make a premade
  // house cost two Ctrl+Z.
  //
  // -1 IS A REAL ANSWER: no floor levels at all is not a count of zero.
  // `only` NARROWS IT TO NAMED LEVELS and nothing else: the detached garage's
  // build raises ONE storey and wants a flight into that storey, not one onto
  // every floor level the drawing happens to have -- a 2ND FL with nothing on
  // it would otherwise come back with a stair in mid-air. The stacking lookup
  // inside suggestStairForLevel still reads the WHOLE floor list, so a
  // narrowed press still stacks on what is really below it.
  // THE OPEN SIDE OF EVERY WELL, COMMITTED. Reads stairOpenSideFraming and
  // writes the records the drawing keeps, undo-shaped like everything else
  // the build hands back.
  //
  // auto: FALSE, and it is the overhang piles' reason again. placeAutoBeam
  // sweeps and re-derives the beams it marked `auto`, and what it re-derives
  // is the MID-SPAN plan -- which knows about the hole but not about this
  // rule, so a sweep would carry off the beam holding the open side of a well
  // and put nothing back. These are not a suggestion; they are what the
  // opening stands on.
  const placeStairSideFraming = stairs => {
    if (!Array.isArray(drawing?.beams)) drawing.beams = [];
    if (!Array.isArray(drawing?.columns)) drawing.columns = [];
    let beamId = newStructureId(drawing.beams);
    let columnId = newStructureId(drawing.columns);
    const placed = [];
    let beams = 0, columns = 0;
    stairs.forEach(stair => {
      const filing = stairFrameFiling(stair.levelId);
      stairOpenSideFraming(stair).forEach(side => {
        const beam = {
          id: beamId, start: { ...side.start, y: 0 }, end: { ...side.end, y: 0 },
          ...filing, mode: 'flush', auto: false, stairId: stair.id,
        };
        beamId += 1;
        drawing.beams.push(beam);
        placed.push({ list: drawing.beams, item: beam });
        beams += 1;
        side.columns.forEach(point => {
          // THE SAME FILING AS ITS BEAM. A post and the beam it holds up are
          // one piece of structure, and the mid-span pass files its pair
          // together for the same reason -- a column on another sheet from
          // the beam over it is two drawings of one thing.
          const column = {
            id: columnId, point: { x: point.x, y: 0, z: point.z },
            ...filing, footing: 'pad36', auto: false,
          };
          columnId += 1;
          drawing.columns.push(column);
          placed.push({ list: drawing.columns, item: column });
          columns += 1;
        });
      });
    });
    return { placed, beams, columns };
  };

  // A STAIR MOVED OR TURNED IS FRAMED AGAIN (Movie, 19 Oct: "is there a way
  // to regenerate the beam after the stairs move"). Its framing used to ride
  // along with it, which is right for a slide and wrong for a turn: a run
  // turned to lie with the joists needs no side beam at all, and one turned
  // end for end has its open side where the wall was. So the old framing
  // (stairFramingOf: its beams and the posts only they stand on) comes out
  // and stairOpenSideFraming lays what the stair asks for where it now is.
  // Returns the two undo steps -- out, then in -- for the gesture's batch.
  //
  // NOTHING TO MEASURE, NOTHING RE-LAID: with no house ring on the stair's
  // level there is no span to read, and the framing the drafter has stays
  // where the gesture carried it.
  const reframeStair = stair => {
    const ring = houseOutlineOn(stair.levelId);
    if (!ring || ring.points.length < 3) return { steps: [], beams: 0, before: 0 };
    const old = stairFramingOf(stair);
    const removed = [];
    [[drawing?.beams, old.beams], [drawing?.columns, old.columns]].forEach(([list, items]) => {
      items.forEach(item => {
        const index = list.indexOf(item);
        if (index < 0) return;
        list.splice(index, 1);
        removed.push({ list, index, item });
      });
    });
    const framed = placeStairSideFraming([stair]);
    const steps = [];
    if (removed.length) steps.push({ kind: 'remove-items', removed });
    if (framed.placed.length) steps.push({ kind: 'built', walls: [], outlines: [], list: null, items: framed.placed });
    if (steps.length) setSelection(selection.filter(entry => !old.beams.includes(entry.item) && !old.columns.includes(entry.item)));
    return { steps, beams: framed.beams, before: old.beams.length };
  };

  // AND A STAIR BESIDE A CARRYING BEAM THAT MOVED OR WENT (Movie, 19 Oct: the
  // stair beam is re-checked when a beam changes too). The beam is what the
  // well's side spans are measured to, so moving it can earn a side beam or
  // take one away. Re-laid ONLY WHEN THE ANSWER CHANGES -- a stair that needs
  // the same number of side beams keeps the ones it has, hand-adjusted or
  // not -- and never the stairs in `spare`: a stair whose own framing the
  // drafter just moved or deleted is being adjusted by hand.
  const reframeStairsOn = (framingLevelIds, spare = []) => (drawing?.stairs || [])
    .filter(stair => !spare.includes(stair)
      && framingLevelIds.includes(Number(stairFrameFiling(stair.levelId).levelId))
      && stairOpenSideFraming(stair).length !== stairFramingOf(stair).beams.length)
    .map(reframeStair);

  // The strip's word on a re-frame: what the stair now stands on, or nothing
  // when nothing changed.
  const stairFramingSaid = reframed => {
    const now = reframed.reduce((n, r) => n + r.beams, 0);
    const was = reframed.reduce((n, r) => n + r.before, 0);
    if (!now && !was) return '';
    if (!now) return ' Its side beam is not needed where it is now, so it came out.';
    return ` Framed again: ${now === 1 ? 'a side beam' : `${now} side beams`} on posts where the stair now is.`;
  };

  const placeAutoStairs = ({ served = new Set(), only = null } = {}) => {
    if (!drawing || !window.DraftAutoStair) return -1;
    const floors = stairFloorLevels()
      .filter(level => !only || only.map(Number).includes(Number(level.id)));
    if (!floors.length) return -1;
    if (!Array.isArray(drawing.stairs)) drawing.stairs = [];
    let stairId = newStructureId(drawing.stairs);
    const placed = [];
    const notes = [];
    floors.forEach(level => {
      const res = suggestStairForLevel(level.id, stairId);
      if (!res) return;
      notes.push(res.note);
      if (!res.stair) return;
      drawing.stairs.push(res.stair);
      placed.push({ list: drawing.stairs, item: res.stair });
      stairId += 1;
      // AND THE DEAD STRIP CLOSES HERE, INSIDE THE LOOP, before the next
      // level is asked for. The flight above stacks on the POSITION of the
      // one below, so a stair moved after the stack was built would leave the
      // upper flight standing over where the lower one used to be -- the
      // drift the comment below this loop already owns, and the one case of
      // it this page can avoid outright by moving first.
      //
      // ONLY A FLIGHT WITH NOTHING UNDER IT, and that is not an optimisation.
      // A run over another run is STACKED on it for headroom, and the storey
      // above has a thinner wall on the same side -- so the strip beside the
      // upper flight is a few inches wide by construction, reads as dead, and
      // closing it would walk the upper flight off the lower one and undo
      // both the stack and "line it up on" in one move. The flight below is
      // where this rule answers, and it answers for the whole stack.
      const order = stairFloorLevels().map(entry => Number(entry.id));
      const mine = order.indexOf(Number(level.id));
      const stacked = (drawing.stairs || []).some(stair => stair !== res.stair
        && (stair.view || 'plan') === 'plan'
        && order.indexOf(Number(stair.levelId)) >= 0
        && order.indexOf(Number(stair.levelId)) < mine);
      if (!stacked) stairCloseDeadStrip(res.stair);
    });
    // THE HOLES COME AFTER EVERY RUN IS DOWN, not per level inside the loop:
    // an upper flight stacks on the POSITION of the one below it, so every run
    // has to be placed before any of them is measured for a hole.
    //
    // AND THAT IS NOT A FULL ANSWER, which is worth saying plainly rather than
    // leaving the paragraph above to imply it is. stairAutoFit MOVES a stair
    // to clear a beam or a wall, and it moves each one on its own -- so a
    // lower flight nudged here can still slide out from under an upper flight
    // that was stacked on where it used to be. Deferring the cut stops the
    // interleaving, not the drift.
    //
    // Every premade measures clean today, and the stacking check in
    // tests/model-html-auto-stair.spec.js is what says so -- it compares the
    // two runs' POSITIONS rather than trusting that they were placed that way,
    // so it fails the day a nudge breaks one. The honest fix, carrying the
    // delta up the stack or refusing a nudge that breaks it, is not written on
    // the strength of a case nobody has hit.
    const cut = buildStairOpenings(served);
    // THE OPEN SIDES LAST OF ALL, because stairAutoFit inside the cut above
    // is the final word on where each run stands: framing laid before it
    // would be a beam along a well edge that then moved.
    const framed = placeStairSideFraming(placed.map(entry => entry.item));
    return {
      placed: [...placed, ...cut.placed, ...framed.placed],
      stairs: placed.length,
      openings: cut.cut,
      nudges: cut.nudges,
      refused: cut.refused,
      sideBeams: framed.beams,
      sideColumns: framed.columns,
      notes,
    };
  };

  // ── A STAIR BY HAND (Movie, 25 Oct) ───────────────────────────────────
  //
  // "i can't insert a new set of stairs when i use the STAIR command button"
  // -- the tool had pointed at AUTO STAIR since it was made. Asked how, he
  // chose a popup ("give them a popup choice": STRAIGHT, L or U, the hand it
  // turns, the width) and both directions: DOWN from the floor in view, or UP
  // from it to the floor above ("yes B - we'll try it out").
  //
  // TWO PRESSES, as a wall's run: the first step, then the way it runs. The
  // flight follows the cursor at its real length between them. Whichever way
  // it is placed, the record is the downward one on the floor it comes down
  // from (stair-place.js), so its well is cut and its open side framed as an
  // AUTO STAIR flight's are, by the same two calls, and one UNDO takes the
  // three back.
  const stairPickCard = document.querySelector('[data-stair-pick]');
  let stairHand = { shape: 'straight', turn: 'right', up: false, widthIn: 36, at: null };
  // THE FLOOR A FLIGHT PLACED FROM HERE IS FILED ON: this one going DOWN; the
  // one above going UP -- from the basement plan, the lowest floor.
  const stairHandLevel = (up = stairHand.up) => {
    const ids = stairFloorLevels().map(level => Number(level.id));
    const here = Number(activeLevelId());
    if (!up) return ids.includes(here) ? here : null;
    if (here === 1) return ids.length ? ids[0] : null;
    const i = ids.indexOf(here);
    return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;
  };
  const stairHandLayout = () => {
    const levelId = stairHandLevel();
    const SG = window.DraftStairGeometry;
    const descent = levelId == null ? null : SG.stairDescent(levelId, stairLevels());
    return descent && descent.riseFt > 0 ? { levelId, layout: SG.stairLayout(descent.riseFt) } : null;
  };
  const stairHandShaped = toward => {
    const ready = stairHandLayout();
    if (!ready || !stairHand.at || !toward) return null;
    const shaped = window.DraftStairPlace.stairFromAim(window.DraftStairGeometry, {
      at: stairHand.at, toward, layout: ready.layout, shape: stairHand.shape, turn: stairHand.turn,
      widthFt: stairHand.widthIn / 12, up: stairHand.up,
    });
    return shaped ? { ...ready, shaped } : null;
  };
  const stairHandSay = () => {
    const way = stairHand.up ? 'UP to the floor above' : 'DOWN from this floor';
    const first = stairHand.up ? 'the bottom step' : 'the top step';
    return stairHand.at
      ? `STAIR ${stairHand.shape.toUpperCase()} ${way} -- point the way it runs and click to place (Esc cancels).`
      : `STAIR ${stairHand.shape.toUpperCase()} ${way} -- click ${first}.`;
  };
  const syncStairPick = () => {
    if (!stairPickCard) return;
    stairPickCard.querySelectorAll('[data-stair-shape]').forEach(btn =>
      btn.setAttribute('aria-pressed', String(btn.dataset.stairShape === stairHand.shape)));
    stairPickCard.querySelectorAll('[data-stair-turn]').forEach(btn =>
      btn.setAttribute('aria-pressed', String(btn.dataset.stairTurn === stairHand.turn)));
    stairPickCard.querySelectorAll('[data-stair-dir]').forEach(btn => {
      btn.setAttribute('aria-pressed', String((btn.dataset.stairDir === 'up') === stairHand.up));
      btn.disabled = stairHandLevel(btn.dataset.stairDir === 'up') == null;
    });
    const turns = stairPickCard.querySelector('[data-stair-turns]');
    if (turns) turns.hidden = stairHand.shape === 'straight';
    const said = stairPickCard.querySelector('[data-stair-pick-say]');
    if (said) said.textContent = stairHandSay();
  };
  const stairHandPress = at => {
    if (stairHandLevel() == null) {
      sayOnStrip(stairHand.up ? 'STAIR UP: there is no floor above this one to go up to.'
        : 'STAIR DOWN: this level is no floor a stair comes down from -- pick UP FROM HERE.');
      return;
    }
    const snap = drawSnap(at);
    const p = snap.pt ? { x: snap.pt.x, z: snap.pt.z } : { x: at.x, z: at.z };
    if (!stairHand.at) {
      stairHand.at = p;
      sayOnStrip(stairHandSay());
      syncStairPick();
      paint();
      return;
    }
    commitHandStair(p);
  };
  const commitHandStair = toward => {
    const made = stairHandShaped(toward);
    if (!made) { sayOnStrip('STAIR -- point away from the first step, then click.'); return; }
    const SG = window.DraftStairGeometry;
    const { levelId, layout, shaped } = made;
    if (!Array.isArray(drawing.stairs)) drawing.stairs = [];
    const others = new Set(drawing.stairs.map(stair => stair.id));
    const stair = {
      id: newStructureId(drawing.stairs),
      start: shaped.start, end: shaped.end,
      levelId, view: 'plan',
      widthFt: stairHand.widthIn / 12,
      riseFt: layout.riseFt, risers: layout.risers, treadRunIn: SG.STAIR_TREAD_RUN_IN,
      rail: stairRailSide, shape: shaped.shape, turn: shaped.turn, winders: 0,
    };
    drawing.stairs.push(stair);
    // ITS WELL AND ITS OPEN SIDE, as AUTO STAIR's flights get them -- this
    // flight's only: every other stair is served.
    const cut = buildStairOpenings(others);
    const framed = placeStairSideFraming([stair]);
    undoStack.push({ kind: 'built', walls: [], outlines: [], list: null,
      items: [{ list: drawing.stairs, item: stair }, ...cut.placed, ...framed.placed], restored: [] });
    stairHand.at = null;
    markDirty();
    const well = cut.cut ? 'its well cut' : cut.refused.length ? `NO well cut -- ${cut.refused.join('; ')}` : 'no floor to cut a well in';
    sayOnStrip(`STAIR placed -- ${layout.risers} risers ${stairHand.up ? 'up to' : 'down from'} ${namedLevel(levelId)}, ${well}`
      + `${cut.nudges.length ? `, nudged ${cut.nudges.join(', ')} clear` : ''}. UNDO takes it back; click the next stair's first step.`);
    syncStairPick();
    buildChrome();
    paint();
  };
  // THE FLIGHT IN HAND, in the preview's ink: its runs and its landing.
  const paintStairHandPreview = () => {
    if (activeTool !== 'stair' || !stairHand.at || !cursorWorld) return;
    const made = stairHandShaped(cursorWorld);
    if (!made) return;
    const outline = window.DraftStairPlace.stairOutline(window.DraftStairGeometry, made.shaped, made.layout);
    ctx.save();
    ctx.strokeStyle = skin['draw-dim'] || '#4ad';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    [...outline.runs, ...(outline.landing ? [outline.landing] : [])].forEach(ring => {
      ctx.beginPath();
      ring.forEach((p, i) => { const s2 = toS(p); if (i) ctx.lineTo(s2.x, s2.y); else ctx.moveTo(s2.x, s2.y); });
      ctx.closePath();
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.beginPath();
    outline.walk.forEach((p, i) => { const s2 = toS(p); if (i) ctx.lineTo(s2.x, s2.y); else ctx.moveTo(s2.x, s2.y); });
    ctx.stroke();
    ctx.restore();
  };
  stairPickCard?.querySelectorAll('[data-stair-shape]').forEach(btn => btn.addEventListener('click', () => {
    stairHand.shape = btn.dataset.stairShape; syncStairPick(); sayOnStrip(stairHandSay()); paint();
  }));
  stairPickCard?.querySelectorAll('[data-stair-turn]').forEach(btn => btn.addEventListener('click', () => {
    stairHand.turn = btn.dataset.stairTurn; syncStairPick(); paint();
  }));
  stairPickCard?.querySelectorAll('[data-stair-dir]').forEach(btn => btn.addEventListener('click', () => {
    stairHand.up = btn.dataset.stairDir === 'up'; stairHand.at = null; syncStairPick(); sayOnStrip(stairHandSay()); paint();
  }));
  stairPickCard?.querySelector('[data-stair-width]')?.addEventListener('change', e => {
    const inches = Math.round(Number(e.target.value));
    stairHand.widthIn = Number.isFinite(inches) ? Math.min(72, Math.max(30, inches)) : 36;
    e.target.value = String(stairHand.widthIn);
    paint();
  });
  stairPickCard?.querySelector('[data-stair-width]')?.addEventListener('keydown', e => e.stopPropagation());
  stairPickCard?.querySelector('[data-stair-pick-close]')?.addEventListener('click', () => { stairPickCard.hidden = true; });
  // UP BY DEFAULT ON A LEVEL NO STAIR COMES DOWN FROM (the basement plan),
  // DOWN everywhere else; the card comes up with the tool and goes with it.
  toolListeners.push(next => {
    stairHand.at = null;
    if (!stairPickCard) return;
    if (next !== 'stair') { stairPickCard.hidden = true; return; }
    if (stairHandLevel(false) == null && stairHandLevel(true) != null) stairHand.up = true;
    if (stairHandLevel(true) == null && stairHandLevel(false) != null) stairHand.up = false;
    stairPickCard.hidden = false;
    syncStairPick();
    sayOnStrip(stairHandSay());
  });
  // ENTER OR SPACE PLACES IT WHERE IT POINTS, as a click does.
  window.addEventListener('keydown', e => {
    if (activeTool !== 'stair' || !stairHand.at || !cursorWorld) return;
    if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    commitHandStair(cursorWorld);
  });

  // ── A PLACED STAIR CHANGED (Movie, 25 Oct) ────────────────────────────
  //
  // OBJ / PROP's stair fields -- "One PROPERTIES i'd like added is WIDTH",
  // "ADD or SUBTRACT stair tread", the shape, its turn, its rail -- and the
  // width mark on the plan all come through here: the change, then its well
  // cut again where the stair now stands and its framing laid again, and one
  // UNDO for the lot. A stair the drafter has touched is his, not AUTO
  // STAIR's suggestion any more.
  const STAIR_MIN_WIDTH_IN = 36;
  const editStair = (stair, change) => {
    const before = { ...stair, start: { ...stair.start }, end: { ...stair.end },
      ...(stair.lock ? { lock: JSON.parse(JSON.stringify(stair.lock)) } : {}) };
    const hole = stairWellOf(stair).hole;
    const holeBefore = hole ? { ...hole } : null;
    const why = change(stair);
    if (why) {
      Object.keys(stair).forEach(key => { if (!(key in before)) delete stair[key]; });
      Object.assign(stair, before);
      sayOnStrip(why);
      return false;
    }
    delete stair.auto;
    const SG = window.DraftStairGeometry;
    const layout = SG.stairCurrentLayout(stair, stairLevels());
    stair.risers = layout.risers;
    const end = SG.stairEndFor(stair, layout);
    stair.end = { x: end.x, y: 0, z: end.z };
    const ring = hole && stairOpeningFootprint(stair);
    if (ring && ring.length >= 3) hole.points = ring.map(pt => ({ x: pt.x, z: pt.z }));
    const reframed = reframeStair(stair);
    undoStack.push({ kind: 'batch', steps: [
      { kind: 'props', edits: [{ item: stair, before }, ...(hole ? [{ item: hole, before: holeBefore }] : [])] },
      ...reframed.steps] });
    markDirty();
    paint();
    return true;
  };
  // ITS WIDTH, IN INCHES: a side that lies on a wall's face stays on it and
  // the flight grows away from it; free on both sides, it grows both ways.
  const setStairWidth = (stair, inches) => {
    const want = Math.round(Number(inches) * 8) / 8;
    if (!(want >= STAIR_MIN_WIDTH_IN)) {
      sayOnStrip(`STAIR WIDTH -- ${STAIR_MIN_WIDTH_IN}" at the least.`);
      return false;
    }
    return editStair(stair, st => {
      const frame = stairFrame(st);
      const lock = stairLockNow(st);
      const half = (Number(st.widthFt) || 3) / 2, now = want / 24;
      const shift = lock?.left && !lock?.right ? half - now : lock?.right && !lock?.left ? now - half : 0;
      if (frame && shift) {
        st.start = { ...st.start, x: st.start.x + frame.n.x * shift, z: st.start.z + frame.n.z * shift };
        st.end = { ...st.end, x: st.end.x + frame.n.x * shift, z: st.end.z + frame.n.z * shift };
      }
      st.widthFt = want / 12;
      return null;
    }) && (sayOnStrip(`STAIR ${want}" wide -- its well cut again. UNDO puts it back.`), true);
  };
  // ONE RISER MORE OR LESS: the rise is the floor's, so each riser takes its
  // share -- more risers, each lower and the flight a tread longer; fewer,
  // each higher. Never outside the minimum and the maximum.
  const stepStairRisers = (stair, by) => {
    const SG = window.DraftStairGeometry;
    const layout = SG.stairCurrentLayout(stair, stairLevels());
    const range = SG.stairRiserRange(layout.riseFt);
    const next = layout.risers + by;
    const F = window.DraftFormatters;
    if (!range || next < range.fewest) {
      sayOnStrip(`STAIR -- ${next} risers would be ${F.formatInchesOnly(layout.riseFt * 12 / next)} each, over the ${F.formatInchesOnly(SG.STAIR_MAX_RISER_IN)} most.`);
      return false;
    }
    if (next > range.most) {
      sayOnStrip(`STAIR -- ${next} risers would be ${F.formatInchesOnly(layout.riseFt * 12 / next)} each, under the ${F.formatInchesOnly(SG.STAIR_MIN_RISER_IN)} least.`);
      return false;
    }
    const done = editStair(stair, st => { st.riserCount = next; return null; });
    if (done) sayOnStrip(`STAIR ${next} risers at ${F.formatInchesOnly(layout.riseFt * 12 / next)} -- its run ${F.formatArchitecturalInches(Math.max(1, next - 1) * SG.STAIR_TREAD_RUN_IN)}. UNDO puts it back.`);
    return done;
  };

  // ── A BILEVEL'S TWO FLIGHTS ────────────────────────────────────────────
  //
  // Movie, 2 Oct: from the landing "2 sets of stairs 1 going to main fl and
  // one going down to basement (one going down to basement on 'garage door'
  // side and the up to main on house door side)".
  //
  // THE DESIGN SAYS WHERE, THE LEVELS SAY HOW FAR. Each run comes from
  // premade-plans.js as a point on the landing's back edge and a direction;
  // the rise is stair-geometry's stairDescent, the same number the stair
  // keeps re-deriving after it is placed:
  //
  //   UP    filed on MAIN FL -- a stair is filed on the floor it descends
  //         FROM -- so its top nosing is back in the house and it lands on
  //         the landing's back edge. Rise: ENTRY's wall + MAIN's package.
  //   DOWN  filed on ENTRY, its top nosing on that same edge, running back
  //         under MAIN FL to the slab. Rise: ENTRY's package + the pour and
  //         sill, less the slab.
  //
  // AND MAIN FL IS OPEN OVER BOTH. The DOWN flight runs under MAIN's deck,
  // and a deck across it is a floor at forehead height on the way down -- so
  // each flight gets its opening in MAIN's deck, filed with its stairId so
  // the auto pass after this finds both served and cuts nothing twice.
  //
  // Returns undo-shaped {list, item} pairs: one press, one Ctrl+Z.
  // ── THE ROOM'S ROOF RUNS BACK OVER THE THIRD FLIGHT ────────────────────
  //
  // Movie, 4 Oct, on the MOD BILEVEL: "the roof needs to extend to the END
  // of the stairs so that the person climbing the stairs will have adequate
  // headroom" -- to the bottom step on MAIN FL, its eave past that -- and
  // "if it is above the main roof there should be a wall that goes from the
  // bottom of the 2nd fl roof to the top of the main fl ceiling". Shown both,
  // he chose the narrow one: a strip the width of the upper landing, back
  // over the flight, so the room's roof becomes an L rather than growing
  // into one big square over the house.
  //
  // THE BOTTOM STEP is where placeBilevelStairs will put it -- the same
  // descent and layout, read before the flight exists because the roofs go
  // up first. THE WALLS stand on OVER GARAGE, from MAIN's ceiling (its wall
  // top, less the flight's rise, on this level's datum) to the room's own
  // plate: across the strip's back end and down both its sides, as far as
  // the landing. Stick-framed, bearing on MAIN's ceiling.
  //
  // A ROOF CUT ROUND A TALLER BODY'S WALL LINE (premade-plans.js cutLoops):
  // the edges on that line become flush gables. Left as it was when the
  // body takes nothing out of it, or would leave it in pieces.
  // THE SAME CUT, ON A ROOF THAT IS NOT A RECORD YET. raiseRoofOver holds
  // `{points, edges, edgeOverhang}` in hand before it files anything, and the
  // cut has to happen THERE (see the note at the call) rather than on the
  // finished roof -- so the shape is the same and only the carrier differs.
  // Null when the loops do not cut, which is what the caller falls back on.
  const notchPlainRoof = (plain, wallLine, overhangFt) => {
    const cut = window.DraftPremadePlans.cutLoops(plain.points, wallLine);
    if (!cut) return null;
    const points = cut.points.map(pt => ({ x: pt.x, z: pt.z }));
    // AN EDGE THE CUT DID NOT MAKE KEEPS WHAT IT HAD. The ring handed in
    // already carries a kind and an overhang per edge -- the stub's west
    // edge is flush against the house wall, gable and zero -- and the cut
    // renumbers the ring. Reading every uncut edge as "eave, full overhang"
    // put two feet of overhang on a flush edge, so the plan drew its gable
    // wall line two feet inside the stub. Each uncut edge finds the edge of
    // the ring it lies along and takes that edge's answers.
    const eps = 1e-6;
    const alongOf = (a, b) => (Math.abs(a.z - b.z) < eps ? 'x' : 'z');
    const was = (a, b) => {
      const axis = alongOf(a, b), other = axis === 'x' ? 'z' : 'x';
      const lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
      for (let j = 0; j < plain.points.length; j++) {
        const p = plain.points[j], q = plain.points[(j + 1) % plain.points.length];
        if (alongOf(p, q) !== axis || Math.abs(p[other] - a[other]) > eps) continue;
        const plo = Math.min(p[axis], q[axis]), phi = Math.max(p[axis], q[axis]);
        if (lo >= plo - eps && hi <= phi + eps) return j;
      }
      return -1;
    };
    return {
      points,
      edges: cut.onCut.map((onWall, i) => {
        if (onWall) return 'gable';
        const j = was(points[i], points[(i + 1) % points.length]);
        return j >= 0 && plain.edges[j] === 'gable' ? 'gable' : 'eave';
      }),
      edgeOverhang: cut.onCut.map((onWall, i) => {
        if (onWall) return 0;
        const j = was(points[i], points[(i + 1) % points.length]);
        const own = j >= 0 && Array.isArray(plain.edgeOverhang) ? Number(plain.edgeOverhang[j]) : NaN;
        return Number.isFinite(own) ? own : overhangFt;
      }),
    };
  };

  const notchRoofRound = (roof, wallLine) => {
    const cut = window.DraftPremadePlans.cutLoops(roof.points, wallLine);
    if (!cut) return false;
    const overhang = Number(roof.overhang) || 0;
    roof.points = cut.points.map(pt => ({ x: pt.x, z: pt.z }));
    roof.edges = cut.onCut.map(onWall => (onWall ? 'gable' : 'eave'));
    roof.edgeOverhang = cut.onCut.map(onWall => (onWall ? 0 : overhang));
    return true;
  };

  // NULL when there is no third flight or landing to cover, and the roof is
  // the design's own loop.
  const stairHood = (plan, levelId, deckWalls = []) => {
    const SG = window.DraftStairGeometry;
    const run = plan.stairs?.upper, landing = plan.upperLanding;
    if (!SG || !run || !landing || levelId == null) return null;
    const descent = SG.stairDescent(levelId, stairLevels());
    if (!descent || !(descent.riseFt > 0)) return null;
    const bottomZ = run.z + run.toward * SG.stairLayout(descent.riseFt).runFt;
    const xs = landing.map(p => p.x);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const z0 = Math.min(run.z, bottomZ), z1 = Math.max(run.z, bottomZ);
    if (!(z1 - z0 > 0.01)) return null;
    const strip = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
    const roof = window.DraftPremadePlans.joinLoops(plan.overGarageRoof, strip);
    if (!roof) return null;
    const LA = window.DraftLevelAssembly;
    const split = LA.splitValues(drawing.buildType, drawing.sectionTable?.rows?.[drawing.buildType]);
    const baseHeight = split.mainWallHeightFt - descent.riseFt;
    const topHeight = split.upperWallHeightFt;
    // EVERY EDGE OF THE ROOF'S WALL LINE THE ROOM'S OWN WALLS DO NOT STAND
    // ON: the strip's end and sides, the landing's sides, and the old square's
    // back edge across to its corner -- that last stretch "stick framed on the
    // outside so there won't be a jog at the north end". Each is the edge
    // less whatever collinear stretch of the room's loop already covers it.
    const room = plan.overGarage || [];
    const along = (a, b) => (Math.abs(a.z - b.z) < 1e-6 ? 'x' : 'z');
    const covered = (a, b) => {
      const axis = along(a, b), other = axis === 'x' ? 'z' : 'x';
      const spans = [];
      room.forEach((p, i) => {
        const q = room[(i + 1) % room.length];
        if (along(p, q) !== axis || Math.abs(p[other] - a[other]) > 1e-6
          || Math.abs(q[other] - a[other]) > 1e-6) return;
        spans.push([Math.min(p[axis], q[axis]), Math.max(p[axis], q[axis])]);
      });
      return spans;
    };
    const runs = [];
    roof.forEach((a, i) => {
      const b = roof[(i + 1) % roof.length];
      const axis = along(a, b);
      const lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
      let open = [[lo, hi]];
      covered(a, b).forEach(([c0, c1]) => {
        open = open.flatMap(([o0, o1]) => [[o0, Math.min(o1, c0)], [Math.max(o0, c1), o1]])
          .filter(([o0, o1]) => o1 - o0 > 0.01);
      });
      open.forEach(([o0, o1]) => {
        const at = v => (axis === 'x' ? { x: v, z: a.z } : { x: a.x, z: v });
        runs.push(a[axis] <= b[axis] ? [at(o0), at(o1)] : [at(o1), at(o0)]);
      });
    });
    // ON THE EXTERIOR FACE, like the room's own walls (raiseLoop), so the two
    // line up outside. Movie, 9 Oct, on the OVER GARAGE plan: "why is it
    // CENTERLINE ? should be EXT line so it lines up". The runs keep the
    // roof's winding, so the roof's interior side is each wall's inside.
    const refLine = window.DraftBuildHouse.outlineInteriorRef(roof);
    // ── OVER THE ENTRY'S FRONT IT STANDS ON THE DECK, NOT UNDER THE ROOF ──
    //
    // Movie, 10 Oct, on E1: "these walls line up, can we make the 'blend' so
    // this line doesn't show". Under the upper landing the entry's walls stop
    // at the landing's deck (the build above), which is this storey's floor
    // -- there is no main roof between them and the hood. So the stretch of
    // a hood wall standing on one of them starts on the floor, and the face
    // runs straight up from the entry's wall instead of leaving the gap from
    // the deck to MAIN's ceiling that the elevation drew as a box.
    const lowered = deckWalls.map(wall => [wall.start, wall.end]);
    const pieces = [];
    runs.forEach(([a, b]) => {
      const axis = along(a, b), other = axis === 'x' ? 'z' : 'x';
      // Measured from a toward b, so a run keeps the roof's winding.
      const sgn = b[axis] >= a[axis] ? 1 : -1;
      const t = v => (v - a[axis]) * sgn, len = t(b[axis]);
      const on = lowered
        .filter(([p, q]) => along(p, q) === axis && Math.abs(p[other] - a[other]) < 1e-6
          && Math.abs(q[other] - a[other]) < 1e-6)
        .map(([p, q]) => [Math.max(0, Math.min(t(p[axis]), t(q[axis]))), Math.min(len, Math.max(t(p[axis]), t(q[axis])))])
        .filter(([c0, c1]) => c1 - c0 > 0.01)
        .sort((m, n) => m[0] - n[0]);
      const at = k => {
        const v = a[axis] + k * sgn;
        return axis === 'x' ? { x: v, z: a.z } : { x: a.x, z: v };
      };
      let from = 0;
      on.forEach(([c0, c1]) => {
        if (c0 - from > 0.01) pieces.push({ a: at(from), b: at(c0), base: baseHeight });
        pieces.push({ a: at(Math.max(from, c0)), b: at(c1), base: 0 });
        from = Math.max(from, c1);
      });
      if (len - from > 0.01) pieces.push({ a: at(from), b: at(len), base: baseHeight });
    });
    // A RUN THAT CARRIES ON A ROOM WALL'S LINE KEEPS THAT WALL'S SIDE OF IT.
    // Movie, 12 Oct, on the OVER GARAGE plan's back corner (blue ADD, red
    // REMOVE): the room's back wall stands on the wall below and so has its
    // body on the outside of the line, and the hood's foot of wall carrying
    // on from it had its body on the inside -- a jog where the two met, and
    // a corner that did not close. 'left' puts the body on the (-dz, dx)
    // side of start -> end, the rule raiseLoop's stacking reads.
    const roomWalls = (drawing.walls || []).filter(wall =>
      Number(wall.levelId) === Number(levelId) && (wall.view || 'plan') === 'plan');
    const near = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < 0.01;
    const sideFor = (a, b) => {
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (!(len > 1e-6)) return refLine;
      const on = roomWalls.find(wall => {
        const wx = wall.end.x - wall.start.x, wz = wall.end.z - wall.start.z;
        const wl = Math.hypot(wx, wz);
        if (!(wl > 1e-6) || Math.abs(dx * wz - dz * wx) / (len * wl) > 1e-6) return false;
        return [a, b].some(p => near(p, wall.start) || near(p, wall.end));
      });
      if (!on || on.refLine === 'center') return refLine;
      const wx = on.end.x - on.start.x, wz = on.end.z - on.start.z;
      const body = on.refLine === 'right' ? -1 : 1;
      const same = (-dz * -wz + dx * wx) * body > 0;
      return same ? 'left' : 'right';
    };
    const walls = pieces.map(piece => commitWall(piece.a, piece.b, {
      bone: false, levelId, view: 'plan', refLine: sideFor(piece.a, piece.b),
      baseHeight: piece.base, topHeight,
    }));
    return { roof, walls };
  };

  // THE OUTLINE OF A FEW AXIS-SQUARE RECTANGLES TAKEN TOGETHER, as one ring,
  // or null when they do not make exactly one piece. Cut on the grid of their
  // own edges: a cell is in when its centre is in any rectangle, and the ring
  // is the cell sides with nothing on the other side, chained and straightened.
  const rectUnionRing = rects => {
    const xs = [...new Set(rects.flatMap(r => [r.x0, r.x1]))].sort((p, q) => p - q);
    const zs = [...new Set(rects.flatMap(r => [r.z0, r.z1]))].sort((p, q) => p - q);
    const filled = (i, j) => {
      if (i < 0 || j < 0 || i >= xs.length - 1 || j >= zs.length - 1) return false;
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      return rects.some(r => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1);
    };
    // Each boundary side, walked with the inside on its left.
    const next = new Map();
    const key = (i, j) => `${i},${j}`;
    let sides = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        if (!filled(i, j)) continue;
        if (!filled(i, j - 1)) { next.set(key(i, j), [i + 1, j]); sides += 1; }
        if (!filled(i + 1, j)) { next.set(key(i + 1, j), [i + 1, j + 1]); sides += 1; }
        if (!filled(i, j + 1)) { next.set(key(i + 1, j + 1), [i, j + 1]); sides += 1; }
        if (!filled(i - 1, j)) { next.set(key(i, j + 1), [i, j]); sides += 1; }
      }
    }
    if (next.size !== sides || !sides) return null;   // a corner touched twice
    const start = next.keys().next().value.split(',').map(Number);
    const ring = [];
    let at = start;
    for (let n = 0; n <= sides; n++) {
      ring.push(at);
      at = next.get(key(...at));
      if (at[0] === start[0] && at[1] === start[1]) break;
    }
    if (ring.length !== sides) return null;            // more than one piece
    const straight = ring.filter((p, n) => {
      const q = ring[(n + ring.length - 1) % ring.length], r = ring[(n + 1) % ring.length];
      return !((q[0] === p[0] && p[0] === r[0]) || (q[1] === p[1] && p[1] === r[1]));
    });
    return straight.map(([i, j]) => ({ x: xs[i], z: zs[j] }));
  };

  const placeBilevelStairs = (spec, mainLevelId) => {
    const SG = window.DraftStairGeometry;
    if (!SG || !spec) return [];
    if (!Array.isArray(drawing.stairs)) drawing.stairs = [];
    if (!Array.isArray(drawing.surfaceOpenings)) drawing.surfaceOpenings = [];
    const made = [];
    const levels = stairLevels();
    const mainDeck = (drawing.floors || []).find(floor =>
      Number(floor.levelId) === Number(mainLevelId) && floor.structure !== 'slab');
    let id = newStructureId(drawing.stairs);
    const flight = (run, levelId, topAtLanding, { hole = true } = {}) => {
      const descent = SG.stairDescent(levelId, levels);
      if (!run || !descent || !(descent.riseFt > 0)) return;
      const layout = SG.stairLayout(descent.riseFt);
      const far = run.z + run.toward * layout.runFt;
      const startZ = topAtLanding ? run.z : far;
      const endZ = topAtLanding ? far : run.z;
      const stair = {
        id,
        start: { x: run.x, y: 0, z: startZ },
        end: { x: run.x, y: 0, z: endZ },
        levelId,
        view: 'plan',
        widthFt: run.widthFt,
        riseFt: layout.riseFt,
        risers: layout.risers,
        treadRunIn: SG.STAIR_TREAD_RUN_IN,
        rail: stairRailSide,
        shape: 'straight',
        turn: 'right',
        winders: 0,
        auto: true,
      };
      id += 1;
      drawing.stairs.push(stair);
      made.push({ list: drawing.stairs, item: stair });
      if (!hole) { made.served = [...(made.served || []), stair.id]; return; }
      if (!mainDeck) return;
      const half = run.widthFt / 2;
      const z0 = Math.min(startZ, endZ), z1 = Math.max(startZ, endZ);
      wells.push({ x0: run.x - half, x1: run.x + half, z0, z1, stairId: stair.id });
    };
    const wells = [];
    flight(spec.up, Number(mainLevelId), false);
    flight(spec.down, ENTRY_LEVEL_ID, true);
    // ONE HOLE OVER BOTH FLIGHTS (Movie, 7 Oct): "that little floor area
    // between the stairs (lets just make that a GAP space. they can place the
    // handrails or a wall seperation between the stairs as they need)". The
    // strip between the two wells is opened where both run, and the opening
    // names both stairs. Each flight's own well is kept for the framing,
    // which hangs a beam down each outside edge at that flight's length.
    made.wells = wells.map(({ stairId, ...rect }) => rect);
    const [a, b] = wells.slice().sort((p, q) => p.x0 - q.x0);
    const lo = b ? Math.max(a.z0, b.z0) : 0, hi = b ? Math.min(a.z1, b.z1) : 0;
    const rects = b && b.x0 - a.x1 < 1 && hi - lo > 0.01
      ? [a, b, { x0: a.x1, x1: b.x0, z0: lo, z1: hi }] : null;
    const joined = rects && rectUnionRing(rects);
    const holes = joined
      ? [{ points: joined, stairId: a.stairId, stairIds: [a.stairId, b.stairId] }]
      : wells.map(w => ({
        points: [{ x: w.x0, z: w.z0 }, { x: w.x1, z: w.z0 }, { x: w.x1, z: w.z1 }, { x: w.x0, z: w.z1 }],
        stairId: w.stairId,
      }));
    holes.forEach(hole => {
      const opening = {
        id: newDrawingItemId('opening'),
        hostType: 'floor',
        hostId: mainDeck.id,
        levelId: Number(mainLevelId),
        ...hole,
      };
      drawing.surfaceOpenings.push(opening);
      made.push({ list: drawing.surfaceOpenings, item: opening });
    });
    // THE THIRD FLIGHT, a MOD BILEVEL's: over the down flight, from the upper
    // landing back down to MAIN FL. It stands ON MAIN's deck, so it cuts no
    // hole in it -- and its own level's deck is the landing, which stops at
    // its top step.
    if (spec.upper && levelPresent(OVER_GARAGE_LEVEL_ID)) {
      flight(spec.upper, OVER_GARAGE_LEVEL_ID, true, { hole: false });
    }
    return made;
  };

  // ── A BILEVEL'S FRAMING ROUND THE ENTRY ────────────────────────────────
  //
  // Movie, 3 Oct: the entry floor overlaps the house by 3.5" on its three
  // inside edges "so an interior wall can be built to hold up the entry floor
  // and then extended further to also hold the main floor" -- a wall that
  // FILLS rather than bears: "it doesn't SUPPORT the floor the beams should
  // but will fill in the inbetween areas". And "copy sharmas" for the rest:
  // dropped LVL beams down both long sides of the stair opening, a post at
  // each end of each, pads under the posts (Sharma sheets 8 and 9).
  //
  // THE FILL WALLS are 2x4s on the basement's own plan, slab to MAIN's
  // underside: PROJECT's pour, its sill and its wood fill. The sides stop at
  // the inside face of the front foundation wall they run into.
  //
  // THE BEAMS carry MAIN and THE POSTS stand on the basement slab, so both
  // are filed where a bungalow's main-floor beams and teleposts are: on
  // FOUNDATION, its FOUNDATION view -- the plan that draws a post's pad.
  // The beams run from the fill wall's line back to the far end of the
  // opening beside them, which is the flight's own run. Not `auto`: they are
  // the design's, and a later AUTO BEAM press sweeps only its own.
  //
  // THE POSTS stand on standard 36" pads. Where two sit 2'-5 1/2" apart in an
  // inside corner the pads pour as one, which is Sharma's 3' x 5' there.
  //
  // Returns { body, items, beams, posts } -- the walls as a body for the
  // build's one undo, everything else as {list, item} pairs.
  const placeBilevelFraming = (framing, flights, split, { frontFaceFt = 8 / 12 } = {}) => {
    const LA = window.DraftLevelAssembly;
    if (!framing || !split || !levelPresent(FOUNDATION_LEVEL_ID)) return null;
    const fillTopFt = split.fdnWallHeightFt + LA.SILL_PLATE_IN / 12 + split.woodFillHeightFt;
    const frontZ = Math.max(...framing.fillWalls.flatMap(run => [run.start.z, run.end.z]));
    const walls = framing.fillWalls.map(run => {
      const trim = pt => (Math.abs(pt.z - frontZ) < 1e-6 && run.start.x === run.end.x
        ? { x: pt.x, z: pt.z - frontFaceFt } : pt);
      return commitWall(trim(run.start), trim(run.end), {
        bone: false, levelId: FOUNDATION_LEVEL_ID, view: 'plan',
        wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: fillTopFt,
      });
    });
    const items = [];
    drawing.beams = drawing.beams || [];
    drawing.columns = drawing.columns || [];
    let nextBeamId = newStructureId(drawing.beams);
    let nextColumnId = newStructureId(drawing.columns);
    const post = at => {
      const record = {
        id: nextColumnId++,
        point: { x: at.x, y: 0, z: at.z },
        levelId: FOUNDATION_LEVEL_ID,
        view: 'foundation',
        footing: 'pad36',
      };
      drawing.columns.push(record);
      items.push({ list: drawing.columns, item: record });
    };
    framing.posts.forEach(post);
    // ONE BEAM DOWN EACH OUTSIDE EDGE OF THE WELL, read off the openings the
    // flights just cut rather than worked out again here.
    const holes = (flights.wells || []).map(w => [
      { x: w.x0, z: w.z0 }, { x: w.x1, z: w.z0 }, { x: w.x1, z: w.z1 }, { x: w.x0, z: w.z1 }]);
    let beams = 0;
    if (holes.length) {
      const minX = pts => Math.min(...pts.map(p => p.x));
      const maxX = pts => Math.max(...pts.map(p => p.x));
      const farZ = pts => Math.min(...pts.map(p => p.z));
      const leftHole = holes.reduce((a, b) => (minX(b) < minX(a) ? b : a));
      const rightHole = holes.reduce((a, b) => (maxX(b) > maxX(a) ? b : a));
      [[minX(leftHole), farZ(leftHole)], [maxX(rightHole), farZ(rightHole)]].forEach(([x, z]) => {
        const record = {
          id: nextBeamId++,
          start: { x, y: 0, z: framing.wellBeamZ },
          end: { x, y: 0, z },
          levelId: FOUNDATION_LEVEL_ID,
          view: 'foundation',
          mode: 'dropped',
        };
        drawing.beams.push(record);
        items.push({ list: drawing.beams, item: record });
        beams += 1;
        post(record.start);
        post(record.end);
      });
    }
    return {
      body: { outline: null, walls, openings: [] },
      items,
      beams,
      posts: items.filter(entry => entry.list === drawing.columns).length,
    };
  };

  // `given` IS A TRACED HOUSE: traced-plans.js's plan off the drafter's own
  // loops, and the trace records the build takes off the drawing, to be put
  // back by the same Ctrl+Z that takes the house.
  const buildPremadePlan = (order, given = null) => {
    if (!drawing) return null;
    const plan = given?.plan || window.DraftPremadePlans.planFor(order?.entry?.id);
    if (!plan) return null;
    // THE LOWEST FLOOR LEVEL, NOT THE ACTIVE ONE. A drafter standing on
    // FOUNDATION when he presses the bone is not asking for a house made of
    // basement walls -- and that is exactly what he got: ordered from the
    // entry screen, which opens on level 1, the whole bungalow was filed
    // there and every elevation came back "the cut line crosses no walls".
    const storey = lowestFloorLevel();
    if (!storey) return null;
    const levelId = storey.id;
    if (!Array.isArray(drawing.outlines)) drawing.outlines = [];
    // ONE GESTURE, ONE UNDO, the same as the ordered garage: the walls' own
    // 'add' steps are dropped for the single 'built' one covering both bodies.
    const mark = undoStack.length;
    // ── A BILEVEL'S HALF LEVEL, AND ITS HEIGHTS ─────────────────────────
    //
    // Movie, 2 Oct: "the BILEVEL needs a entry floor sitting on the
    // foundation wall", heights from "the 'PROJECT' information for bilevel".
    // A design with an `entry` gets the ENTRY level (2) added if the drawing
    // lacks it -- the drafter pressed a tile that says BILEVEL, which IS the
    // permission the level guard elsewhere asks for -- and the numbers come
    // from PROJECT's section-table row through the same splitValues every
    // elevation stands the levels on (cut-view.js splitFloorStack).
    const levelItems = [];
    let split = null;
    if (plan.entry) {
      const LA = window.DraftLevelAssembly;
      const type = drawing.buildType || order?.entry?.type;
      split = LA.splitValues(type, drawing.sectionTable?.rows?.[type]);
      if (!levelPresent(ENTRY_LEVEL_ID)) {
        const level = { id: ENTRY_LEVEL_ID, name: 'ENTRY', elev: -4, visible: true };
        const fdnAt = (drawing.levels || [])
          .findIndex(entry => Number(entry.id) === FOUNDATION_LEVEL_ID);
        drawing.levels.splice(fdnAt < 0 ? drawing.levels.length : fdnAt, 0, level);
        levelItems.push({ list: drawing.levels, item: level });
      }
      // THE ENTRY'S OWN WALL HEIGHT IS DERIVED: the fill wall and the entry
      // joists stand on one sill and both reach MAIN's bearing line, so what
      // is left is the fill less the entry package -- PROJECT's arithmetic.
      // Stored, because the stair that climbs from the landing to MAIN FL
      // reads its rise off this level's wall (stair-geometry stairDescent).
      // A MOD BILEVEL'S ROOM OVER THE GARAGE is the half level OVER GARAGE
      // (4) -- "the 'over garage' layer is for bilevels when that would be a
      // 'lower' 2nd floor" -- filed above MAIN FL in the list, on PROJECT's
      // 2ND FL wall.
      if (plan.overGarage && !levelPresent(OVER_GARAGE_LEVEL_ID)) {
        const level = { id: OVER_GARAGE_LEVEL_ID, name: 'OVER GARAGE', elev: 6, visible: true };
        const mainAt = (drawing.levels || [])
          .findIndex(entry => Number(entry.id) === MAIN_FLOOR_LEVEL_ID);
        drawing.levels.splice(mainAt < 0 ? 0 : mainAt, 0, level);
        levelItems.push({ list: drawing.levels, item: level });
      }
      const entryPkgFt = LA.levelFloorFt(assemblyFor(ENTRY_LEVEL_ID));
      drawing.levelAssemblies = drawing.levelAssemblies || {};
      if (plan.overGarage) {
        drawing.levelAssemblies[OVER_GARAGE_LEVEL_ID] = {
          ...(drawing.levelAssemblies[OVER_GARAGE_LEVEL_ID] || {}),
          wallHeightFt: split.upperWallHeightFt,
        };
      }
      drawing.levelAssemblies[ENTRY_LEVEL_ID] = {
        ...(drawing.levelAssemblies[ENTRY_LEVEL_ID] || {}),
        wallHeightFt: split.woodFillHeightFt - entryPkgFt,
      };
    }
    // ── AND WHERE THE FLOOR MEETS THE WALL ───────────────────────────────
    //
    // ON-GRADE's one difference from the bungalow beside it on the board:
    // the joists hang on a ledger inside the foundation with their tops
    // flush with the sill, so only the sheathing lands on top of the wall.
    // The design says so with `framing` and this writes it onto the floor
    // level's own assembly, where PROJECT's FLOOR FRAMING choice reads and
    // edits it afterwards -- the tile sets it, it is not owned by the tile.
    //
    // ONTO `levelId`, THE STOREY THE SHELL IS ACTUALLY RAISED ON, not a
    // hardcoded MAIN FL: the build files itself on lowestFloorLevel() above,
    // and a framing written to a level the house is not on would be a claim
    // about an empty storey.
    //
    // ONLY WHEN THE DESIGN ASKS. A plain bungalow carries `framing: null`
    // and nothing is written, so a drafter who had set a level to balloon by
    // hand and then built an ordinary house keeps his answer.
    if (plan.framing) {
      drawing.levelAssemblies = drawing.levelAssemblies || {};
      drawing.levelAssemblies[levelId] = {
        ...(drawing.levelAssemblies[levelId] || {}),
        framing: plan.framing,
      };
    }
    // ── THE SHELL, ONE STOREY AT A TIME ──────────────────────────────────
    //
    // MODEL.dc.html's _buildHouse walks `floors.forEach` and calls
    // _buildHouseWalls once per floor level; a bungalow simply has an outline
    // on one of them. Here the DESIGN says how many storeys it has, so the
    // walk is over the levels the design asks for and the drawing can hold.
    //
    // UPSTAIRS GETS ITS OWN OPENINGS, not the ground floor's. The design
    // carries both sets, and the reason is a front door: dealt again on the
    // storey above it would open into air, which the clamp accepts and the
    // elevation shows.
    const storeys = storeyLevels(plan.storeys);
    // HELD BY NAME, NEVER BY POSITION. `raised` is a list of bodies whose
    // length depends on how many storeys the design has and what hangs off
    // it, and the garage's concrete used to be found at `raised[1]` -- true
    // of a bungalow, and the UPPER STOREY of a 2 STOREY. Both outlines answer
    // `attachedGarage` and neither is detached, so the wrong one gave the
    // right foundation and nothing looked amiss; the moment a garage outline
    // carried its own `foundation`, or the room over it became a fourth body,
    // it would stop agreeing. The same trap wallsByEdge was built to close.
    let garageBody = null;
    let overGarageBody = null;
    // A BILEVEL'S HOUSE leaves the entry's edges bare -- the one fill wall in
    // the overlap stands there instead (placeBilevelFraming) -- and stands
    // its walls PROJECT's 9'-1 1/8".
    const raised = storeys.map((level, index) => raiseLoop(plan.house, level.id,
      { openings: index === 0 ? plan.houseOpenings
        : (plan.upperOpenings || plan.houseOpenings),
        ...(plan.entry ? { against: plan.entry, topHeight: split.mainWallHeightFt } : {}) }));
    // ── AND THE ENTRY, ON ITS OWN LEVEL ──────────────────────────────────
    //
    // ONLY ITS FRONT IS A WALL here, for the same reason the house leaves the
    // notch bare. And that front runs UNBROKEN from the landing to MAIN FL's
    // ceiling -- the foyer is open over the landing -- so it is the entry's
    // wall, the fill and MAIN's package and MAIN's storey tall: 13'-6 1/2" on
    // PROJECT's defaults.
    let entryBody = null;
    let entryLevelId = null;
    // The entry's walls that stop at the upper landing's deck (stairHood).
    let entryDeckWalls = [];
    if (plan.entry && levelPresent(ENTRY_LEVEL_ID)) {
      const LA = window.DraftLevelAssembly;
      entryLevelId = ENTRY_LEVEL_ID;
      const tallFt = split.mainWallHeightFt
        + LA.levelFloorFt(assemblyFor(levelId))
        + split.woodFillHeightFt
        - LA.levelFloorFt(assemblyFor(ENTRY_LEVEL_ID));
      entryBody = raiseLoop(plan.entry, ENTRY_LEVEL_ID,
        { openings: plan.entryOpenings, against: plan.house, topHeight: tallFt });
      raised.push(entryBody);
      // UNDER THE UPPER LANDING the entry's front stops at the landing's
      // deck: the room's own back wall, and the door into it, carry on above.
      if (plan.upperLanding) {
        const xs = plan.upperLanding.map(pt => pt.x);
        const lo = Math.min(...xs) - 0.01, hi = Math.max(...xs) + 0.01;
        entryDeckWalls = entryBody.walls
          .filter(wall => [wall.start, wall.end].every(pt => pt.x >= lo && pt.x <= hi));
        entryDeckWalls.forEach(wall => { wall.topHeight = split.upperDeckAboveEntryFt; });
      }
      // ── AND THE WOOD FILL ALL ROUND ──────────────────────────────────
      //
      // "Both pour the same 5'-0" wall and make the rest of the basement
      // height up in wood above it" (project-page.js, Movie 4 Sep). So the
      // house's perimeter carries a stud wall from the sill to MAIN FL's
      // bearing line. It stands on the same sill as the ENTRY's joists, so
      // it is filed on ENTRY at that level's own wall height (the fill less
      // the entry package, as stored above). Without it the elevation showed
      // a four-foot gap between the concrete and MAIN's floor.
      //
      // THE NOTCHED LOOP, against the entry, so the run across the entry's
      // front is the entry's own tall wall and not a second one under it.
      const fillBody = raiseLoop(plan.house, ENTRY_LEVEL_ID, {
        against: plan.entry,
        withOutline: false,
        topHeight: split.woodFillHeightFt - LA.levelFloorFt(assemblyFor(ENTRY_LEVEL_ID)),
      });
      raised.push(fillBody);
    }
    if (plan.garage) {
      // THE HOUSE IS WHAT THE GARAGE IS MEASURED AGAINST, and it is handed
      // over rather than found: the garage hangs off the house by
      // construction (premade-plans.js builds its loop from the house's own
      // right and front lines), so the body it shares edges with is known
      // here and searching the drawing for it would be a second, weaker
      // answer to a question this function already holds.
      // `garage` AND `body` ARE TWO DIFFERENT FLAGS and both are needed.
      // `garage: true` marks the OUTLINE as a garage footprint; `body` marks
      // each WALL as the garage's, which is how building-bodies.js and the
      // section painters tell its framing from the house's. The ordered
      // detached garage carried body from the start and this one did not --
      // a split the wall tally found the moment it began counting by body.
      // THE GARAGE IS A SINGLE STOREY -- Movie, 19 Sep: "make a single story
      // garage" -- so it goes on the lowest storey only, however many the
      // house has. The floor OVER it is a different body on a different
      // level, not this loop raised twice.
      // UNDER A MOD BILEVEL'S ROOM the garage's walls run up to the room's
      // floor: from the house sill (one entry package under the ENTRY deck)
      // to the OVER GARAGE deck less its own package.
      const LA = window.DraftLevelAssembly;
      const underRoomFt = (plan.entry && plan.overGarage && split)
        ? split.upperDeckAboveEntryFt
          - LA.levelFloorFt(assemblyFor(OVER_GARAGE_LEVEL_ID))
          + LA.levelFloorFt(assemblyFor(ENTRY_LEVEL_ID))
        : null;
      // AND OFF A SPLIT, WITH NO ROOM ON IT, TO THE GARAGE'S OWN HEIGHT.
      // Movie, 6 Oct: the house and garage walls "should be different
      // heights", the garage's default 10'-1 3/4" from the house sill --
      // read as a top over MAIN FL so it compares with the house's own
      // (garage-roofs.js). A room over it still needs its walls at the
      // house's plate, where that room's floor is.
      const ownTopFt = (!split && !plan.overGarage)
        ? window.DraftGarageRoofs.garageTopFt(drawing, null) : null;
      const garageTopHeight = underRoomFt || ownTopFt;
      garageBody = raiseLoop(plan.garage, levelId,
        { garage: true, body: 'garage',
          openings: plan.garageOpenings, against: plan.foundation || plan.house,
          ...(garageTopHeight ? { topHeight: garageTopHeight } : {}) });
      raised.push(garageBody);
    }

    // ── AND THE ROOM OVER IT ─────────────────────────────────────────────
    //
    // ON 2ND FL, NOT ON THE OVER-GARAGE LEVEL. Movie, 19 Sep, asked directly:
    // "no it will be the '2 storey', the 'over garage' layer is for bilevels
    // when that would be a 'lower' 2nd floor" -- then "this one is even with
    // the 2nd floor so will be considered 2nd floor". A half-level is for a
    // room sitting half a storey off the floors around it; this one is flush
    // with the storey above, so it IS that storey.
    //
    // WHICH MEANS NOTHING GETS ADDED TO ANYBODY'S LEVEL STACK. The room goes
    // on a level the house is already using, so this tile needs no more
    // permission than the other two.
    //
    // ITS OWN BODY, NOT THE UPPER STOREY STRETCHED. It is a separate loop
    // with its own walls and its own windows, and `against: plan.house` is
    // what stops its back wall being raised on top of the house's -- twenty
    // feet of the two run in the same place, and premade-plans.js splits that
    // stretch into an edge of its own so this skip can take it whole.
    //
    // AND IT NEEDS AN UPPER STOREY TO BE ON. storeyLevels returns the levels
    // the drawing HAS, not the ones the design wants, so a room-over ordered
    // into a drawing with a single floor level has nowhere to go. Raised when
    // there is somewhere, named when there is not -- the same rule the
    // foundation and the roof already follow below, and the alternative is
    // what this tile did until now: build a house and a garage, no room, and
    // not one word about the one that went missing.
    const upperStorey = storeys[1] || null;
    // WHERE THE ROOM GOES: a 2 STOREY's on its upper storey, a MOD BILEVEL's
    // on OVER GARAGE, half a storey over MAIN.
    const overGarageLevelId = plan.entry
      ? (levelPresent(OVER_GARAGE_LEVEL_ID) ? OVER_GARAGE_LEVEL_ID : null)
      : (upperStorey ? upperStorey.id : null);
    if (plan.overGarage && plan.entry && overGarageLevelId != null) {
      overGarageBody = raiseLoop(plan.overGarage, overGarageLevelId,
        { openings: plan.overGarageOpenings, topHeight: split.upperWallHeightFt,
          stackOn: [plan.house, plan.entry] });
      raised.push(overGarageBody);
    } else if (plan.overGarage && upperStorey) {
      overGarageBody = raiseLoop(plan.overGarage, upperStorey.id,
        { openings: plan.overGarageOpenings, against: plan.house });
      raised.push(overGarageBody);
    }
    // ── AND THE REST OF THE BUILDING ─────────────────────────────────────
    // _buildHouse's order: the storey's own floor, then the concrete under
    // it, then the roof over it. The garage keeps its stud walls only on this
    // rung -- its grade beam, footings, piles and slab are a different set of
    // members with their own rules, and half a garage foundation would be
    // worse than none.
    const extra = [...levelItems];
    const parts = ['house'];
    // A FLOOR UNDER EVERY STOREY, which is _buildHouse's own per-level pass:
    // walls AND a floor, once per floor level. A second storey framed with no
    // deck under it is a storey the section draws standing on nothing.
    drawing.floors = drawing.floors || [];
    storeys.forEach(level => {
      const deck = floorRecord(plan.house, level.id, 'floor');
      drawing.floors.push(deck);
      extra.push({ list: drawing.floors, item: deck });
    });
    // THE LANDING'S OWN DECK, the shape of the entry. MAIN FL's deck above is
    // the notched house, so the foyer over the landing is open.
    if (entryBody) {
      // ONE 2x4 PAST ITS INSIDE EDGES, onto the fill wall (entryDeckLoop).
      const deck = floorRecord(plan.entryDeck || plan.entry, entryLevelId, 'floor');
      drawing.floors.push(deck);
      extra.push({ list: drawing.floors, item: deck });
    }
    // THE ROOM OVER THE GARAGE GETS ITS OWN DECK, because it is its own
    // footprint. The storey loop above lays a floor the shape of the HOUSE,
    // and the room hangs off the side of it -- so a room framed by that pass
    // alone is a room standing on nothing, which is the same thing a storey
    // with no deck under it would be.
    // AND THE UPPER LANDING IN THE SAME DECK, on the same level as the room
    // it leads into. Movie, 4 Oct: "see the 2 X floors - make them 1 floor"
    // -- one floor over one set of joists, not two with a seam between them
    // (premade-plans.js joinLoops). Two only if the landing does not touch.
    if (overGarageBody) {
      const joined = plan.upperLanding
        && window.DraftPremadePlans.joinLoops(plan.overGarage, plan.upperLanding);
      const loops = joined ? [joined] : [plan.upperLanding, plan.overGarage].filter(Boolean);
      loops.forEach(loop => {
        const deck = floorRecord(loop, overGarageLevelId, 'floor');
        drawing.floors.push(deck);
        extra.push({ list: drawing.floors, item: deck });
      });
    }

    // EACH PIECE ONLY WHERE THE DRAWING HAS SOMEWHERE TO PUT IT, and the
    // strip says which pieces went up rather than claiming all of them.
    // UNDER THE RECTANGLE when the design names one (a bilevel's entry is cut
    // out of its house but stands inside its concrete), and a split pours
    // PROJECT's 5'-0" with the sill on top.
    const splitBearing = split
      ? split.fdnWallHeightFt + window.DraftLevelAssembly.SILL_PLATE_IN / 12 : undefined;
    const under = levelPresent(FOUNDATION_LEVEL_ID)
      ? raiseFoundationUnder(plan.foundation || plan.house, split ? {
        topHeight: splitBearing,
      } : {}) : { walls: [], items: [] };
    if (under.items.length) parts.push('foundation');
    extra.push(...under.items);

    // THE GARAGE'S OWN CONCRETE, measured against the house so the edges they
    // share get neither a beam nor a footing -- the same rule its stud walls
    // already follow, through the same edgeOnLoop.
    const garageConcrete = (plan.garage && garageBody?.outline)
      ? raiseGarageConcrete(plan.garage, garageBody.outline,
        { against: plan.foundation || plan.house, houseTop: splitBearing })
      : { walls: [], items: [] };
    extra.push(...garageConcrete.items);
    // SAID OUT LOUD, because a garage that arrives on nothing and a garage
    // that arrives on eleven piles look identical on the plan until you zoom
    // in -- and the first of those is what this page shipped until now.
    if (garageConcrete.piles) {
      parts.push(`${garageConcrete.piles} pile${garageConcrete.piles === 1 ? '' : 's'}`);
    }

    // ── AND THE ROOFS, ONE PER BODY THAT NEEDS ONE ───────────────────────
    //
    // NOT ONE ROOF OVER EVERYTHING. A single-storey garage beside a 2 STOREY
    // bears its roof a whole storey lower than the house does, and the format
    // already carries that: cut-view.js's roofBaseElev reads `garage` and
    // `plateHeightFt` and bears such a roof at the first floor's top plus the
    // plate instead of on the full wall stack.
    //
    // AND IT IS NOT A SPECIAL CASE FOR THE BUNGALOW. `bearing` is the top of
    // the topmost wall, so on a one-storey house the flagged garage roof and
    // an unflagged one land on the same number -- the flag changes nothing
    // there and does the right thing beside a 2 STOREY. That agreement is
    // checked rather than assumed.
    const madeRoofs = [];
    // THE TYPE THE PROJECT ROWS ARE READ FOR -- the order's, when the file
    // has not been told one yet (the same fallback the bilevel heights take).
    const roofType = drawing.buildType || order?.entry?.type;
    // The walls that close in under the room's roof where it runs back over
    // the third flight (stairHood), for the build's one undo.
    const hoodWalls = [];
    // AND THE GABLE WALLS a main roof stands over a shed arm with (Movie, 17
    // Oct), raised with the roofs below and undone with them.
    const gableWalls = [];
    // THE GARAGE'S PLATE, as the roof reads it: cut-view bears a garage roof
    // at the LOWEST floor's top plus this. On a bilevel the lowest floor is
    // the ENTRY deck, while the garage's walls stand on the sill under it --
    // one entry package lower -- so the plate is the walls' height less that
    // package, or the roof floats ten inches over the walls it sits on.
    // OFF A SPLIT the plate IS the garage walls' own top, which is measured
    // from MAIN FL the way a garage roof's plate is (cut-view roofBaseElev).
    const garagePlateFt = (split && garageBody)
      ? Math.max(...garageBody.walls.map(wall => Number(wall.topHeight) || 0))
        - window.DraftLevelAssembly.levelFloorFt(assemblyFor(ENTRY_LEVEL_ID))
      : (garageBody && !plan.overGarage)
        ? Math.max(...garageBody.walls.map(wall => Number(wall.topHeight) || 0))
        : assemblyFor(levelId).wallHeightFt;
    // ── A BUNGALOW'S GARAGE: ONE ROOF IF THE TOPS MATCH, TWO IF NOT ─────
    //
    // Movie, 6 Oct: "if both walls are same height exactly they should be
    // ONE roof". The design hands one roof over both; when the garage tops
    // out above or below the house, garage-roofs.js cuts two instead and the
    // lower one dies into the taller wall.
    const grouped = (!split && garageBody && plan.storeys === 1 && !plan.overGarage
      && !plan.garageRoof)
      ? window.DraftGarageRoofs.roofLoops({
        house: plan.house, garage: plan.garage,
        houseTopFt: assemblyFor(levelId).wallHeightFt, garageTopFt: garagePlateFt })
      : null;
    const twoRoofs = grouped && !grouped.merged ? grouped : null;
    // ── THE WALL LINE THE HOUSE ROOF DIES INTO, WORKED OUT FIRST ────────
    //
    // It used to be worked out at the ROOM's roof, two hundred lines down,
    // and the house roof was cut round it afterwards -- which is the cut
    // that silently failed on a traced house (see notchPlainRoof). The house
    // roof is cut as it is RAISED now, so the line it is cut against has to
    // exist by then. Nothing else moved: stairHood reads the plan and the
    // entry deck's walls, and both are settled well above here.
    const roomHood = (overGarageBody && plan.overGarageRoof)
      ? stairHood(plan, overGarageLevelId, entryDeckWalls) : null;
    // AND ONLY A BILEVEL'S ROOM IS A WALL TO DIE INTO. `plan.entry` is the
    // half-storey family: there the room stands above MAIN's plate and the
    // main roof must stop at it. Elsewhere the room is roofed by the house's
    // own loop and there is nothing to cut.
    const houseRoofNotch = (plan.entry && overGarageBody && plan.overGarageRoof)
      ? (roomHood ? roomHood.roof : plan.overGarageRoof) : null;
    if (levelPresent(ROOF_LEVEL_ID)) {
      // THE ROOF'S OWN LOOP, which is NOT always the house's body. A
      // bungalow with a garage is roofed over the perimeter of both -- the
      // design says so through `houseRoof`, because where the two bodies
      // meet is the design's arithmetic and not this page's.
      // A ROOF SPLIT OFF THE HOUSE'S (raiseRoofOver's end attachment) lands
      // in madeRoofs through `collect`, so one Ctrl+Z still takes it all.
      const collect = made => madeRoofs.push(made);
      // THE GABLE WALL the main roof stands over a shed arm with (Movie, 17
      // Oct: "will need the main roof to have a 'gable wall' ... where the
      // lower green roof will meet the GABLE wall of the main roof"):
      // raiseRoofOver hands back each run; the walls go up below, once the
      // storey they stand in is known.
      const gableWallRuns = [];
      madeRoofs.push(twoRoofs
        ? raiseRoofOver(twoRoofs.house.ring, { buildType: roofType, flush: twoRoofs.house.flush,
          stepped: true, cuts: twoRoofs.house.cuts, collect })
        : raiseRoofOver(plan.houseRoof || plan.house, {
          buildType: roofType, notch: houseRoofNotch, collect,
          onGableWall: run => gableWallRuns.push(run) }));
      const houseRoofMade = madeRoofs[madeRoofs.length - 1];
      // ── THE GABLE WALL ITSELF ─────────────────────────────────────────
      //
      // A knee wall standing on MAIN's ceiling along the block's gable line
      // where the shed arm meets it, filed on OVER GARAGE the way the stair
      // hood's walls are (stairHood): its plate IS the main roof's bearing,
      // so the elevation climbs it to the rakes (cut-view gableTopAt) and
      // the triangle between the shed and the main roof is wall, not sky.
      // Its body sits on the block's side of the line, so its outside face
      // is the line the shed dies into.
      if (gableWallRuns.length && overGarageLevelId != null && plan.entry) {
        const SG = window.DraftStairGeometry;
        const LA = window.DraftLevelAssembly;
        const descent = SG && SG.stairDescent(overGarageLevelId, stairLevels());
        const split = LA.splitValues(drawing.buildType, drawing.sectionTable?.rows?.[drawing.buildType]);
        const base = split.mainWallHeightFt - (descent && Number.isFinite(descent.riseFt) ? descent.riseFt : 0);
        const blockRing = houseRoofMade && houseRoofMade.item ? houseRoofMade.item.points : null;
        const G2 = window.DraftGeometry2D;
        gableWallRuns.forEach(run => {
          const dx = run.end.x - run.start.x, dz = run.end.z - run.start.z;
          const mid = { x: (run.start.x + run.end.x) / 2, z: (run.start.z + run.end.z) / 2 };
          const len = Math.hypot(dx, dz) || 1;
          const left = { x: mid.x - dz / len * 0.3, z: mid.z + dx / len * 0.3 };
          const inBlock = blockRing && G2.pointInLoop ? G2.pointInLoop(left, blockRing) : true;
          const wall = commitWall(run.start, run.end, {
            bone: false, levelId: overGarageLevelId, view: 'plan',
            refLine: inBlock ? 'left' : 'right', baseHeight: base, topHeight: base,
          });
          if (wall) {
            if (houseRoofMade && houseRoofMade.item) wall.gableWallOf = String(houseRoofMade.item.id);
            gableWalls.push(wall);
          }
        });
      }
      if (twoRoofs) {
        madeRoofs.push(raiseRoofOver(twoRoofs.garage.ring, {
          buildType: roofType,
          garage: true,
          collect,
          plateHeightFt: garagePlateFt,
          sourceLevelId: levelId,
          flush: twoRoofs.garage.flush,
          stepped: true,
        }));
      }
      if (plan.garageRoof) {
        // THE PLATE IS THE STOREY THE GARAGE ACTUALLY STANDS ON, asked of the
        // same assembly its walls were raised to rather than typed again.
        madeRoofs.push(raiseRoofOver(plan.garageRoof, {
          buildType: roofType,
          garage: true,
          collect,
          plateHeightFt: garagePlateFt,
          sourceLevelId: levelId,
          // THE EDGE THE DESIGN SAYS DIES INTO THE BUILDING BEHIND IT. With a
          // room over, that edge also lies on the room and the derivation
          // would find it; with no room it runs four feet past the house's
          // corner and nothing but the design knows.
          flush: plan.garageRoofHouseEnd,
          // WHATEVER THIS ROOF WAS CUT AGAINST. With a room over the garage
          // the stub abuts the ROOM and never reaches the house; without one
          // the garage roof abuts the house along the two edges its walls
          // already skip. Either way it is the body the footprint stops at.
          against: plan.overGarage || plan.foundation || plan.house,
        }));
      }
      // ── AND THE FOOT OF THE TIE, WHICH THE STUB STOPS SHORT OF ─────────
      //
      // Movie, 24 Sep: *"we will need additional short 2ft extra peice of
      // gable that extends 2ft past the back exterior garage wall"*.
      // premade-plans.js works out what is bare and why only this entry has
      // it; the page's whole job is that the piece bears where the stub
      // bears, which is the same plate asked the same way.
      //
      // NULL ON EVERY OTHER DESIGN, and read as a LOOP rather than derived
      // from "is there a tie" -- the contract garageRoof already keeps. The
      // BUNGALOW's roof and the ROOM OVER's both run over the tie already;
      // a design that stops needing this says so by handing null.
      if (plan.garageTieRoof) {
        madeRoofs.push(raiseRoofOver(plan.garageTieRoof, {
          buildType: roofType,
          garage: true,
          collect,
          plateHeightFt: garagePlateFt,
          sourceLevelId: levelId,
          flush: plan.garageTieRoofFlush,
          rake: plan.garageTieRoofRake,
          against: plan.foundation || plan.house,
        }));
      }
      // ── THE ROOM'S OWN ROOF, WHEN THE DESIGN GIVES IT ONE ─────────────
      //
      // AND TODAY IT NEVER DOES, which is the fix for what Movie reported on
      // 20 Sep: "the 2 storey roofs have same problem the 1 storeys had
      // earlier". The room over the garage bears on the HOUSE'S OWN PLATE --
      // he ruled on 19 Sep that it is "even with the 2nd floor so will be
      // considered 2nd floor" -- so a roof of its own is a second hip at the
      // same height as the house's, meeting it badly. That is the 1 STOREY's
      // defect exactly, one floor up, and premade-plans.js answers it the way
      // it answered that one: houseRoof is the perimeter of both bodies and
      // this loop is null.
      //
      // THE BRANCH STAYS, AND READS A LOOP RATHER THAN A BODY. It asked
      // whether a room was BUILT and roofed it on that basis, which is the
      // page deciding a question the design owns -- the same shape the
      // garageRoof branch above avoids. A design that one day wants the room
      // roofed separately says so by handing a loop, and nothing here moves.
      if (overGarageBody && plan.overGarageRoof) {
        const hood = roomHood;
        // A BILEVEL'S ROOM STANDS HALF A STOREY OVER MAIN, so nothing of the
        // house rises past its roof: every edge is an eave and every corner
        // hips up to the ridge at 45 (Movie, 6 Oct, on the traced MOD
        // BILEVEL: "it should be ridgeline to corner at 45"). Cut flush
        // against the house it gabled the room's house side -- the main
        // roof is what stops at the room's walls (roofBearing's exclude).
        const roomRoof = raiseRoofOver(hood ? hood.roof : plan.overGarageRoof, {
          buildType: roofType,
          sourceLevelId: overGarageLevelId,
          against: plan.entry ? null : plan.house,
          collect,
          // ONE ROOF, AS DRAWN: the hood over the room and its landing is a
          // designed ring, hipped at every corner (Movie, 6 Oct). Read as
          // wings, the landing came off as a roof of its own under the
          // room's hip; the drafter's ROOF tool still flips any edge.
          wings: false,
        });
        madeRoofs.push(roomRoof);
        // ── AND THE MAIN ROOF STOPS AT IT, WITH NOTHING DRAINING INTO IT ──
        //
        // Movie, 10 Oct: the main roof "slopes and creates a spot along the
        // back of the 2nd floor where rainwater and snow will build up", and
        // marking it up: "just take out the part sloping to the house". The
        // room and the stair strip stand higher than MAIN's plate, so the
        // main roof is cut round their wall line -- the same ring the room's
        // own roof is raised over -- and every edge it shares with that ring
        // is a gable: the roof dies into the wall flush, and no plane runs
        // down into it. The ridge carries on to the strip's end wall, the
        // north side drains north past the room, and the east end below the
        // strip keeps its hip (the ROOF tool's edge flip makes it a gable).
        // THE NOTCH ITSELF HAPPENS AS THE ROOF IS RAISED (see raiseRoofOver),
        // AND SO DO THE ENDS. This branch used to gable every end of the main
        // roof afterwards (Movie, 15 Oct: "gabled at certain points"), which
        // on 16 Oct gabled the back of his house where "the back on this one
        // could have been a hip". geometry-2d's roofWingKinds decides each
        // end in raiseRoofOver now: the strip beside the room is a wing whose
        // far end stands in open air and hips, the house's back end hips the
        // same way, and nothing here flips an edge after the fact.
        if (hood) {
          // Tagged with the roof they close in under, so a later BONEYARD
          // push of that roof replaces them rather than adding a second set
          // (boneyard-edit.js roofHood).
          if (roomRoof && roomRoof.item) hood.walls.forEach(w => { w.hoodOf = String(roomRoof.item.id); });
          hoodWalls.push(...hood.walls);
        }
      }
    }
    const built = madeRoofs.filter(Boolean);
    if (built.length) {
      extra.push(...built);
      parts.push(built.length > 1 ? `${built.length} roofs` : 'roof');
    }

    // ── AND NOW THE ROOFS STAND, THE WINDOWS CAN CLEAR THEM ──────────────
    //
    // Each body with the loop it was raised on, because the loop is what says
    // which side of a wall is outdoors. Read the comment on
    // clearOpeningsOverRoofs for the rule and for why the board that
    // diagnosed this named the wrong module.
    const clearedWindows = clearOpeningsOverRoofs([
      ...raised.filter(body => body !== entryBody).map(body => ({ loop: plan.house, body })),
      { loop: plan.garage, body: garageBody },
      { loop: plan.overGarage, body: overGarageBody },
      { loop: plan.entry, body: entryBody },
    ]);
    if (clearedWindows.lifted) {
      parts.push(`${clearedWindows.lifted} window${clearedWindows.lifted === 1 ? '' : 's'} raised clear of a roof`);
    }
    if (clearedWindows.dropped) {
      parts.push(`${clearedWindows.dropped} window${clearedWindows.dropped === 1 ? '' : 's'} dropped — a roof leaves no glass there`);
    }


    // AND THE MID-SPAN BEAM, which is where Movie asked for it first: "we
    // should just autoplace the beam once into the 'premade homes' and if i
    // need to change them i will". The BEAM panel's button is the second way
    // in, for a house he traced himself or one he has since edited.
    //
    // AFTER THE FOUNDATION, not merely later in the file: placeAutoBeam
    // refuses without a FOUNDATION level, and it reads the outline `raised`
    // has just filed. Run before either, it would return -1 on every press
    // and say nothing about why.
    //
    // ITS RECORDS JOIN `extra`, so ONE Ctrl+Z still takes the whole building.
    // A beam with an undo step of its own would make a premade house cost two.
    //
    // ITS SWEEP DOES NOT JOIN `sweptDims`, and the first draft of this had it
    // doing exactly that. `sweptDims` is restored as ONE group into
    // drawing.dimensions, so a swept beam folded in there would be put back
    // into the DIMENSION list on Ctrl+Z -- a beam the drawing cannot paint,
    // sitting in a list the format validates as dimensions and drops. NO
    // FIXTURE WOULD HAVE CAUGHT IT: a premade press sweeps nothing on a fresh
    // drawing, so the wrong list is only ever reached by a re-press. The
    // groups come through carrying their own list instead.
    // EVERY LEVEL THAT CARRIES A FLOOR, BOTTOM-UP, and the order is the rule
    // rather than tidiness: a storey's posts have to land on what is already
    // holding the floor below, so the level under it must be framed FIRST or
    // supportsUnder reads an empty list and every post above divides evenly
    // and claims nothing. Movie, 25 Sep: "i don't think we discussed the
    // columns and beams that will be needed on the main floor if there is a
    // 2nd floor".
    //
    // THE TOP STOREY EXCLUDES ITSELF, because floorCarriedBy hands back null
    // for it -- it carries a roof, and "usually the exterior walls do the
    // complete job". No branch here says so; the lookup does.
    const sweptStructure = [];
    const framedTally = { beams: 0, columns: 0, unsupported: 0 };
    // THE HOUSE'S MID-SPAN ROWS ARE ASKED ABOUT (Movie, 19 Oct: "on the
    // AUTOHOUSE, before the beams are placed, maybe we should make a popup
    // that says PLACE BEAMS and COLUMS (if they are needed due to span) --
    // place all the stair opening beams and columns AUTOMATICALLY"). They
    // still go down HERE, first, because the stairs below are placed against
    // them -- a well hugs a carrying beam, and the dead strip beside it is
    // framed only where no beam already is -- so laying them afterwards
    // would move his stairs. What the drafter decides is whether they stay:
    // askForBeams, once the build is done.
    const beamAsk = { items: [], spanFt: 0 };
    [FOUNDATION_LEVEL_ID, ...window.DraftLayerViews
      .floorLevels(drawing?.levels || []).map(level => Number(level.id))]
      .forEach(id => {
        const beamed = placeAutoBeam({ levelId: id });
        if (beamed === -1) return;
        beamAsk.items.push(...beamed.midSpan);
        beamAsk.spanFt = Math.max(beamAsk.spanFt, beamed.midSpanFt);
        extra.push(...beamed.placed);
        sweptStructure.push(...beamed.restored);
        framedTally.beams += beamed.beams;
        framedTally.columns += beamed.columns;
        framedTally.unsupported += beamed.unsupported;
      });
    if (framedTally.beams) {
      parts.push(`${framedTally.beams} beam${framedTally.beams === 1 ? '' : 's'}`
        + ` and ${framedTally.columns} column${framedTally.columns === 1 ? '' : 's'}`
        // SAID IN THE BUILD LINE, because a post standing on nothing is a fact
        // about the house that was just raised and the drafter is reading this
        // sentence anyway.
        + (framedTally.unsupported
          ? ` (${framedTally.unsupported} on nothing)` : ''));
    }

    // ── AND THE STAIRS BETWEEN THE FLOORS ──────────────────────────────────
    //
    // Movie: "make sure all the 'pre-made' houses get the beams, columns and
    // piles and i will check them out. maybe give them stairs too". A house
    // with two floors and nothing between them asserts a storey nobody can
    // reach.
    //
    // AFTER THE BEAMS, AND THE ORDER IS A DECISION rather than a line's
    // position. Both placers want to run second:
    //
    //   stairNudgeOffBeams reads the beams the well must keep clear of. With
    //   none placed yet it takes its empty-list exit -- the exact defect
    //   MODEL.dc.html carried until 7 Sep, where the nudge AND the check that
    //   verifies it were both inert on every automatically built house.
    //
    //   placeAutoBeam reads stairHolesOn, so a beam laid before the stairs
    //   divides evenly instead of re-landing beside the hole.
    //
    // BEAMS FIRST WINS because the stair MOVES to clear the beam, and that is
    // the safety-critical direction: a beam crossing an open well is a beam
    // over the drafter's head on the way down. What is given up is only that
    // the beam is placed by even division rather than beside the hole -- a
    // placement question, not a legality one -- and a second AUTO BEAM press
    // fixes it, because placeAutoBeam sweeps and replaces its own.
    //
    // NOT A SECOND BEAM PASS HERE. Re-deriving the beams after the stairs
    // would move them out from under the well the nudge had just aligned to,
    // and the two would chase each other with no fixed point.
    // A BILEVEL'S TWO FLIGHTS ARE THE DESIGN'S, placed before the auto pass so
    // it finds both levels already served and leaves them be.
    const flights = (entryBody && plan.stairs) ? placeBilevelStairs(plan.stairs, levelId) : [];
    extra.push(...flights);
    const staired = placeAutoStairs({ served: new Set(flights.served || []) });
    if (staired !== -1) {
      extra.push(...staired.placed);
      if (staired.stairs) {
        parts.push(`${staired.stairs} stair${staired.stairs === 1 ? '' : 's'}`
          + (staired.openings
            ? ` through ${staired.openings} opening`
              + `${staired.openings === 1 ? '' : 's'}` : ''));
      }
      // A REFUSED OPENING IS SAID OUT LOUD. Nobody is watching a single stair
      // during a build, so a hole that silently did not get cut is a drafter
      // handed a house with a stair and no opening and nothing saying why --
      // the same reasoning as the unsupported-column count above.
      if (staired.refused.length) {
        parts.push(`${staired.refused.length} stair opening`
          + `${staired.refused.length === 1 ? '' : 's'} NOT cut`);
      }
      // AND THE HEADERS THE WELLS NEED, now the wells are cut. Every level the
      // beam pass walked, since a stair through a garage room can be on any of
      // them -- the pass itself is the one that knows there is nothing to do.
      [FOUNDATION_LEVEL_ID, ...window.DraftLayerViews
        .floorLevels(drawing?.levels || []).map(level => Number(level.id))]
        .forEach(id => {
          const headers = placeStairHeaders({ levelId: id });
          extra.push(...headers);
          framedTally.beams += headers.length;
        });
    }
    // AND THE FRAMING ROUND THE ENTRY, once the well it frames is cut.
    // The side walls stop at the front foundation wall's inside face.
    const fdnType = under.walls[0] && window.DraftWallTypes.WALL_TYPES
      .find(type => type.id === under.walls[0].wallType);
    const framed = entryBody
      ? placeBilevelFraming(plan.framing, flights, split,
        fdnType ? { frontFaceFt: fdnType.totalIn / 12 } : {})
      : null;
    if (framed) {
      raised.push(framed.body);
      extra.push(...framed.items);
      parts.push(`${framed.body.walls.length} fill walls, ${framed.beams} stairwell beams`
        + ` and ${framed.posts} posts`);
    }

    // ── AND THE DIMENSIONS, LAST, WHEN THERE IS SOMETHING TO MEASURE ─────
    //
    // THIS PASS USED TO RUN BEFORE THE STRUCTURE, and on the framing views it
    // therefore measured a level with no beams, no posts and no stair hole in
    // it yet -- all three of which A-DIMS-COLS strings. A built house arrived
    // with its perimeter dimensioned and its columns not, and nothing said so:
    // pressing AUTO DIMS afterwards produced them, which is the shape of a
    // feature that looks like it was never switched on.
    //
    // MOVED RATHER THAN RE-RUN, and the difference is the undo. A second pass
    // sweeps the first pass's strings, so those records would sit in `extra`
    // to be removed AND in `sweptDims` to be restored -- and would survive the
    // Ctrl+Z that is supposed to take the whole building with it.
    //
    // SAFE TO MOVE because nothing it now runs after reads a dimension:
    // placeAutoBeam reads the stair holes, placeAutoStairs reads the beams,
    // and neither asks what has been measured. The build line reports the
    // dims after the beams and stairs now, which is the order they are in.
    // ── AND THE DIMENSIONS, ON EVERY LEVEL THE PRESS TOUCHED ─────────────
    //
    // MODEL.dc.html's BUILD HOUSE calls _placeAutoDims for every level it
    // built on, and so does this: a house that arrives undimensioned is a
    // drawing somebody still has to measure by hand, which is the whole thing
    // AUTO DIMS exists to stop.
    //
    // EVERY LEVEL THAT GOT GEOMETRY, gathered from the records rather than
    // from a list written out here -- the storeys, the foundation under them
    // and the roof over, each already knows which level it went to. Written
    // as a list, this would have to be edited again by the same hand that
    // added the next body, and the one it forgot would simply arrive without
    // dimensions and say nothing about it.
    //
    // THE HOME VIEW OF EACH, not the active one: a dimension is filed against
    // a layer view, and a string filed against the view the drafter happens
    // to be standing in would be invisible on the plan it measures.
    const dimensioned = [];
    const touched = new Map();
    const noteLevel = (id, view) => {
      if (id == null) return;
      const key = `${id}:${view}`;
      if (!touched.has(key)) touched.set(key, { levelId: Number(id), view });
    };
    storeys.forEach(level => noteLevel(level.id, 'plan'));
    // AND THE FLOOR LAYOUT OF EACH FULL STOREY (Movie, 7 Oct): "need exterior
    // dims added to the 1 FLOOR and 2 FLOOR plans (not necessary on the .5"
    // ones). The half-floors -- ENTRY and OVER GARAGE -- get none.
    storeys.forEach(level => noteLevel(level.id, 'floor'));
    if (entryBody) noteLevel(entryLevelId, 'plan');
    if (overGarageBody) noteLevel(overGarageLevelId, 'plan');
    // EVERY PLAN BUT THE ELECTRIC ONE (Movie, 12 Oct: "can we add dimensions
    // to ALL them except electric plan", then "yes" to every plan getting them
    // when the house is built): the basement's walls plan too, wherever the
    // build raised walls on it, and the half-floors' floor layouts now as
    // well -- he had said on 7 Oct they were not needed, and on 12 Oct, of
    // the OVER GARAGE floor layout, "they don't dimension the floor".
    if (entryBody) noteLevel(entryLevelId, 'floor');
    if (overGarageBody) noteLevel(overGarageLevelId, 'floor');
    if ((drawing.walls || []).some(wall => Number(wall.levelId) === FOUNDATION_LEVEL_ID
      && (wall.view || 'plan') === 'plan')) noteLevel(FOUNDATION_LEVEL_ID, 'plan');
    if (under.items.length) noteLevel(FOUNDATION_LEVEL_ID, 'foundation');
    if (built.length) noteLevel(ROOF_LEVEL_ID, 'plan');
    const sweptDims = [];
    touched.forEach(({ levelId: id, view }) => {
      const result = placeAutoDims(id, view);
      // -1 IS A REAL ANSWER: the level holds nothing big enough to string.
      // It is not an error and it is not a count of zero.
      if (result === -1) return;
      dimensioned.push(...result.placed);
      sweptDims.push(...result.removed);
    });
    if (dimensioned.length) {
      extra.push(...dimensioned.map(item => ({ list: drawing.dimensions, item })));
      parts.push(`${dimensioned.length} dims`);
    }

    undoStack.length = mark;
    undoStack.push({
      kind: 'built',
      walls: raised.flatMap(body => body.walls)
        .concat(under.walls, garageConcrete.walls, hoodWalls, gableWalls),
      outlines: raised.map(body => body.outline).filter(Boolean),
      list: drawing.outlines,
      // EVERY OTHER RECORD THE PRESS MADE, each with the list it went into, so
      // one Ctrl+Z takes the whole building. Kept as {list, item} pairs rather
      // than four typed fields because the undo branch then needs no knowledge
      // of what a floor, a footing line or a roof IS -- the same trick
      // 'add-item' plays, which is why a column and a beam share one branch.
      items: extra,
      // AND ANYTHING THE PRESS SWEPT, put back on the way out. The only
      // thing it sweeps is auto dims already on a level it dimensioned --
      // nothing on a fresh drawing, which is why an undo that forgot them
      // would look correct on every fixture and lose them on the one drawing
      // that had them.
      restored: (sweptDims.length
        ? [{ list: drawing.dimensions, items: sweptDims }] : [])
        .concat(sweptStructure)
        .concat(given?.restore || []),
      // ONE PRESS IS STILL ONE UNDO, and the openings are part of that press.
      // Left out, Ctrl+Z would take the house and leave eleven windows and
      // doors hosted on walls that no longer exist -- records the loader drops
      // on the next open, so the drawing would quietly repair itself and the
      // drafter would never know what had been in the file.
      openings: raised.flatMap(body => body.openings || []),
    });
    // AND THE TRACE GOES DOWN WITH IT. Pressing the tile armed the outline
    // through onChoose -- that is the old page's own two-things-at-once and it
    // still stands, because a drafter who closes the board instead of pressing
    // the bone means to draw it himself. Once the house is BUILT he does not,
    // and an armed trace left over a finished house turns his next press into
    // the first corner of a second one.
    setTool(RESTING_TOOL);
    // WHAT WENT UP AND WHERE, because the drafter is very likely not looking
    // at the level it went on -- the entry screen opens on FOUNDATION. Naming
    // the storey is the difference between an empty sheet that looks broken
    // and an empty sheet that tells you where to look.
    if (plan.garage) parts.splice(1, 0, 'garage');
    if (entryBody) parts.splice(1, 0, 'entry landing');
    // WHAT WENT UP, AND WHAT DID NOT. A design carrying a room over the
    // garage into a drawing with one floor level has nowhere to put it, and
    // the drafter pressed a tile with ROOM OVER written on it -- so the strip
    // says which of the two happened rather than reading the same either way.
    if (plan.overGarage) {
      parts.splice(parts.indexOf('garage') + 1, 0,
        overGarageBody ? 'room over' : 'NO room over (no storey above it)');
    }
    // WHERE IT STARTS, not where it sits, once there is more than one storey.
    // "built on MAIN FL" is true of a bungalow and misleading of a 2 STOREY,
    // whose upper half is somewhere else entirely.
    if (storeys.length > 1) parts[0] = `house on ${storeys.length} storeys`;
    sayOnStrip(`${order.entry.label} built ${storeys.length > 1 ? 'from' : 'on'} `
      + `${levelLabel(storey.id, storey.name) || 'the main floor'}`
      + `${storeys.length > 1 ? ' up' : ''}`
      + ` — ${parts.join(', ')}.`);
    markDirty();
    buildChrome();
    paint();
    if (beamAsk.items.length) askForBeams(beamAsk);
    return raised;
  };

  // ── PLACE BEAMS AND COLUMNS? ────────────────────────────────────────────
  //
  // Movie, 19 Oct, of AUTO HOUSE: "before the beams are placed, maybe we
  // should make a popup that says PLACE BEAMS and COLUMS (if they are needed
  // due to span)". Asked once, after the build, and only when a floor's span
  // wants mid-span beams -- the stair opening headers and their posts were
  // never in question and are already down.
  //
  // IT DOES NOT HOLD THE PAGE. It sits over the top of the sheet without a
  // backdrop, so the drafter can look at the house before answering. YES is
  // AUTO BEAM on every level, bottom-up, as one UNDO of its own; NOT NOW
  // leaves the floors bare -- AUTO BEAM in the BEAM panel places them later,
  // and a bay past what its joist reaches says so meanwhile.
  //
  // NOT TO BE CONFUSED with the AUTO BEAM popup Movie had taken out on 15
  // Oct ("don't ask the user about placing beams and columns ... just make
  // the decision based on spans"): that one asked WHICH answer; this asks
  // whether at all, on AUTO HOUSE only. The AUTO BEAM button stays silent.
  const beamAskBox = document.getElementById('beam-ask');
  let beamAskItems = [];
  const askForBeams = ({ items, spanFt }) => {
    if (!beamAskBox) return;
    beamAskItems = items;
    const why = beamAskBox.querySelector('[data-beam-ask-why]');
    if (why) why.textContent = `The floor spans ${feetLabel(spanFt)} -- past what its joists reach without a beam.`;
    beamAskBox.hidden = false;
  };
  beamAskBox?.querySelector('[data-beam-ask-yes]')?.addEventListener('click', () => {
    beamAskBox.hidden = true;
    sayOnStrip('Beams and columns placed. MOVE or DELETE a row to change them.');
    beamAskItems = [];
  });
  // NOT NOW takes the mid-span rows and their posts out again, as one UNDO;
  // the stair headers, the stairwell framing and the garage's beams stay.
  beamAskBox?.querySelector('[data-beam-ask-no]')?.addEventListener('click', () => {
    beamAskBox.hidden = true;
    const removed = [];
    beamAskItems.forEach(({ list, item }) => {
      const index = list.indexOf(item);
      if (index < 0) return;
      list.splice(index, 1);
      removed.push({ list, index, item });
    });
    beamAskItems = [];
    if (removed.length) {
      undoStack.push({ kind: 'remove-items', removed });
      markDirty();
    }
    setSelection(selection.filter(entry => !removed.some(r => r.item === entry.item)));
    sayOnStrip('No mid-span beams. AUTO BEAM in the BEAM panel places them when you want them; UNDO puts them back.');
    paint();
  });

  // A HOUSE ORDER AT THE WINDOW IS BUILT, OR IT IS REFUSED OUT LOUD.
  //
  // The sign's bone had ONE listener and it builds garages: buildOrderedGarage
  // (:7085) opens with `if (!drawing || !order?.entry?.needsSize || !order.size)
  // return null`, and only the detached garage carries `needsSize`. So every
  // house order fell out of that guard before it built anything AND before it
  // took the sign down -- the drafter pressed the bone under a dog that had
  // just said "press the bone and I'll build it", and got silence and a board
  // still in his way. Measured from Movie's own screen, 18 Sep.
  //
  // IT HANDED OVER THE ARMED TRACE FOR A WHILE, which Movie then ruled out:
  // "we shouldn't put it in the drivethru window yet, i'd just like to offer
  // them premade designs in there at the beginning", and for the tiles with no
  // design yet, "have those tiles say 'not ready yet' and build nothing". So
  // the window does one thing and says when it cannot: a board that answered a
  // press by quietly arming a tool somewhere else is a board teaching the
  // drafter that its button means something other than what it says.
  //
  // THE REFUSAL IS THE SIGN'S, not the strip's, because the sign is what the
  // drafter is looking at when he presses that bone -- the same place the
  // garage's HOW BIG, THOUGH? and the wallet's OUT OF BONES land.
  //
  // THE ONE ANSWER THAT DOES NOT LAND THERE is the one building per file
  // cap, and deliberately: it is no longer a refusal but an offer to save
  // and open a clean one, so it needs the save dialog's three buttons rather
  // than a line on a sign. A sign can only be read; that one has to be
  // answered.
  //
  // AND IT IS DECIDED HERE RATHER THAN IN THE BONE'S HANDLER, where the other
  // refusals live. The seam's own rule is that what an order MEANS is the
  // geometry side's call (:4184); refusing before fireOrder would also stop
  // the order reaching the seam at all, and model-drivethru.spec.js measures
  // that each press fires its own seam and not the other's.
  //
  // THE GARAGE ORDER IS NOT TOUCHED. It is served by the listener above, which
  // runs first, builds, and spends the order; this one recognises the same
  // tile through the same predicate and stands off.
  window.ModelBuild.onOrder(order => {
    if (!order?.entry || isGarageChoice(order) || order.entry.suite) return;
    const design = window.DraftPremadePlans.planFor(order.entry.id);
    withGarageAlign(order.entry, Boolean(design?.garage), () => {
      if (builtFrontDown(buildPremadePlan)(order)) {
        setSign(false);
        // SPENT: something was BUILT, which is exactly what orderServed means
        // (:4262). A refusal below spends nothing -- the drafter's choice still
        // stands, because he has not been answered.
        window.ModelBuild.orderServed();
        return;
      }
      signRefusal = {
        line: 'NOT READY YET.',
        note: `${order.entry.label} has no design on the board yet. `
          + `${window.DraftPremadePlans.entryIds().length} tiles on the board do.`,
      };
      paintSign();
    });
  });

