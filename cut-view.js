// Generated section / elevation painter (board #168): the semantic cut view
// shared by the Model Space and the LAYOUT sheets. A cut is a line through
// the plan with a dirVec naming the side the viewer stands on; the painter
// projects the level stack, the walls the cut crosses (sections) or every
// wall face the viewer sees (elevations), floor assemblies, foundation walls
// with footings and slab, garage grade beams / thickened-edge slabs, the
// roof planes with fascia, and the heavy grade line.
//
// Everything the painter reads from a drawing arrives through an explicit
// env — plain accessor functions over either the live Model Space state or
// a saved drawing's JSON — so the module owns no state of its own:
//   floorLevels()            → floor levels bottom-up [{ id, name }]
//   levelAssembly(levelId)   → normalised level assembly (wallHeightFt, ...)
//   levelFloorFt(levelId)    → floor assembly depth in feet
//   levelWallTopFt(levelId, view) → tallest wall top on the level/view
//   footingWidthIn(levelId)  → footing width under that level's walls
//   walls() / roofs() / floors() / fenestrations() → entity collections
//   garageOutlines(levelId)  → garage outlines on a level
//   garageFoundation(garage) → 'gradebeam' | 'thickened' | 'frostwall'
//   buildType()              → the drawing's build type, or null
//   edgeOnOutline(a, b, outline) → true when edge a→b lies on the outline
//   masterPointById(srcId)   → BONEYARD master point or null
//   gableCornerStyle()       → 'flat' | 'return' | 'porkchop' | 'boxed'
//   elevLabel(elev) / ftIn(feet) → formatted construction elevations
//   elevationDatum()         → true when labels read from the datum
if (!window.DraftCutView) {
(() => {
  const geo = () => window.DraftGeometry2D;
  // The style a door is drawn in on an elevation: one of the styles below,
  // or a single for anything else -- a door drawn before styles existed has
  // always been a single.
  const ELEVATION_DOOR_STYLES = Object.freeze(['single', 'french', 'pocket', 'barn', 'slide', 'bypass', 'garden']);
  const elevationDoorStyle = f => (ELEVATION_DOOR_STYLES.includes(f.doorStyle) ? f.doorStyle : 'single');
  let warnedNoPatterns = false;
  let warnedNoRoofPatterns = false;
  let warnedNoFootings = false;
  let warnedNoFenLabels = false;

  // A SIZE TAG SET IN THE LARGEST OF 9, 8 OR 7 PX THAT FITS THE OPENING, with
  // two pixels clear each side and a box at least 11 px tall. Leaves the font
  // set on `ctx` and says whether anything fitted; false means draw nothing.
  const fitTagText = (ctx, label, roomPx, tallPx) => {
    if (!(tallPx >= 11)) return false;
    for (const px of [9, 8, 7]) {
      ctx.font = `600 ${px}px 'Barlow Condensed', system-ui, sans-serif`;
      if (ctx.measureText(label).width + 4 <= roomPx) return true;
    }
    return false;
  };
  const { WALL_TYPES, DEFAULT_FINISH_ID, finishById, bandIsCapped,
    bandRange, bandSpan } = window.DraftWallTypes;
  const { formatInchesOnly } = window.DraftFormatters;

  // Physical drafting standards, shared with the Model Space via STANDARDS.
  // Garage slab: 4" pour over the grade beam at the doors.
  const GARAGE_SLAB_THICKNESS_IN = 4;
  // HOW FAR A GARAGE SLAB FALLS, per foot of depth, toward the door. Movie,
  // 4 Sep: "slab 4\" conc slope 1/8\" down from back to the garage door
  // opening (front)". It sits beside the thickness because it is the same
  // slab's other number, and project-page.js:553 asked for exactly this:
  // "it belongs in cut-view.js STANDARDS with the beam and the sill -- but
  // PROJECT.html does not load cut-view yet, which is the deferred tidy-up".
  // Two of the three copies can stop being copies now; that page's load order
  // is the only thing still holding the third.
  const GARAGE_SLAB_SLOPE_IN_PER_FT = 1 / 8;
  // ── WHERE THE SLAB SITS, AND WHICH END THE NUMBER IS MEASURED AT ─────────
  //
  // Movie, 25 Sep: the curb is "approx. 8\" at garage door opening approx 4\"
  // or higher (if further than 32ft to back of garage) at back of garage",
  // and "past 32 ft the slab will continue at the slope of 1/8\" per foot" --
  // then "flatten it after 64'".
  //
  // THE DOOR IS THE ANCHOR, and the 64 ft is what proves it. 8\" of curb at
  // 1/8\" per foot reaches the top of concrete after exactly 64 ft, which is
  // the number he gave for where it flattens. Anchored at the BACK instead,
  // nothing lands on 64. His 8\"/4\" pair is one garage read at both ends: 32
  // ft of depth is 4\" of fall, so the two descriptions are the same slab.
  //
  // AND IT SETTLES AN AMBIGUITY THE REPOSITORY HAD ALREADY ADMITTED.
  // project-page.js:565 says the slope "had nothing to multiply ... so a
  // sloped slab was drawn at whatever station its author happened to be
  // thinking of, and nothing said which", and that file then anchors the BACK
  // at 4\" (:1584) and lets the door fall away -- which agrees with this only
  // at a 32 ft garage and drifts at every other depth.
  //
  // IT ALSO MAKES THE DOOR BUCK ARITHMETIC EXACT: a 12\" buck cut from the
  // top of a 32\" grade beam leaves 20\", and the slab overlapping the bottom
  // 4\" of it brings the opening back to the 24\" he calls the least
  // acceptable depth. That only works if the slab at the door is 8\" down.
  const GARAGE_SLAB_AT_DOOR_IN = 8;
  // Where the slope reaches the top of concrete and the curb runs out: 64 ft.
  // COMPOSED, never written as 64, so it follows if either number moves.
  const GARAGE_SLAB_FLAT_AT_FT = GARAGE_SLAB_AT_DOOR_IN / GARAGE_SLAB_SLOPE_IN_PER_FT;
  // How far the finished slab sits BELOW the top of concrete, this many feet
  // in from the garage door. Positive is down.
  //
  // THE CAP IS A FLOOR AT ZERO, not a refusal. Movie: "use the CAP rule
  // whenever the slope reaches top of concrete" and "flatten it after 64'
  // your right they can deal with it, they shouldn't need slope at that
  // point". So past the cap the slab is simply level with the concrete and
  // stays there -- it never climbs above it, which is what an uncapped rate
  // would do and what would put a garage floor over its own grade beam.
  //
  // A NEGATIVE DISTANCE IS THE DOOR. Nothing sits outside the garage, and
  // clamping is the honest answer to a caller asking about a point that is
  // not on the slab -- a silent negative curb would read as the slab rising
  // out through the door.
  const garageSlabBelowConcreteIn = (fromDoorFt = 0) => {
    const d = Number(fromDoorFt) > 0 ? Number(fromDoorFt) : 0;
    const fall = GARAGE_SLAB_AT_DOOR_IN - d * GARAGE_SLAB_SLOPE_IN_PER_FT;
    return fall > 0 ? fall : 0;
  };
  // Attached-garage grade beam stack: concrete + 1.5" sill plate, hung with
  // the top of concrete 1'-0" above grade — level with the top of the house
  // foundation wall at the default grade.
  const GARAGE_BEAM_PLATE_IN = 1.5;
  // The concrete half of that stack. It sat alone in MODEL.dc.html while its
  // own comment there described the pair -- 32" concrete + 1.5" sill plate =
  // 33.5" -- with the sill half already living here. Two halves of one
  // dimension in two files is how they drift; PROJECT.html had meanwhile
  // grown a third copy of the 32.
  const GARAGE_BEAM_CONCRETE_IN = 32;
  // GRADE: drawn 1'-0" below the top of the foundation wall — the
  // conservative LOW case, so the site fills UP to the drawn grade (real
  // grade usually sits 6"-8" below the foundation top). Garages hang off
  // grade, not the house: an attached beam tops out 1'-0" above it, a
  // detached grade beam 8".
  // 1'-2", NOT 1'-0". Movie moved this on 4 Sep -- project-page.js commit
  // e3593a0, "Grade drops to 1'-2" below the concrete, and 8" becomes only the
  // floor" -- and this file never got the move. It sat at 1'-0" from the 30 Aug
  // extraction until 5 Sep, so the section painter and the PROJECT page drew
  // grade 2" apart all week. Same face on both -- see the note above: this
  // file's "foundation top" IS the top of concrete, which is what
  // project-page.js's GRADE_BELOW_CONCRETE_IN measures from too.
  //
  // The reason for 1'-2", in Movie's words on 4 Sep: "if the house is higher
  // out of the ground it is easier to regrade afterwards... let's move it to
  // 1'-2" grade to top of concrete so they have 6" to slope around the
  // perimeter." The 8" legal minimum stays a separate number over there --
  // GRADE_MIN_BELOW_CONCRETE_IN -- because one is the line a drafter cannot
  // type past and this is where the drawing puts it.
  const GRADE_BELOW_FOUNDATION_TOP_FT = 14 / 12;
  // ── AND IT IS MEASURED FROM THE CONCRETE, WHICH IS NOT fdn.wallTop ──────
  //
  // The comment above has always said "top of concrete", and this file has
  // always subtracted it from fdn.wallTop -- which level-assembly.js says in
  // capitals is NOT that: FOUNDATION_WALL_TOP_FT "IS THE BEARING LINE, WHICH
  // IS NOT THE CONCRETE'S OWN HEIGHT ... pour + plate". So grade sat one sill
  // plate high and the house stood 1'-0 1/2" out of the ground instead of the
  // 1'-2" Movie specified on 4 Sep: "let's move it to 1'-2" grade to top of
  // concrete so they have 6" to slope around the perimeter."
  //
  // IT SHOWED UP AT THE GARAGE, not at the house. SPEC-garage-foundations.md
  // has every garage foundation topping out 1'-2" above grade -- board #296,
  // and the reason all three floors land at grade + 10" whichever one is
  // chosen. With grade a plate high, an attached grade beam came out at
  // 1'-0 1/2" and that invariant was quietly false. Movie, 25 Sep: "the
  // garage grade beam should be locked at the grade height".
  //
  // THE HOUSE'S PLATE, NOT THE GARAGE'S. GARAGE_BEAM_PLATE_IN is also 1 1/2"
  // and using it here would read as the garage setting the house's grade.
  // They are the same number for different reasons, and that coincidence is
  // what let one plate go missing in four places at once, so this asks the
  // module that owns the foundation's makeup.
  const houseSillPlateFt = () => window.DraftLevelAssembly.SILL_PLATE_IN / 12;
  // Grade from the house's BEARING line -- exported, because MODEL.html holds
  // `wallTop` rather than a foundation record and was computing this itself.
  function gradeFromBearing(wallTop) {
    return wallTop - houseSillPlateFt() - GRADE_BELOW_FOUNDATION_TOP_FT;
  }
  // 1'-2", MOVED WITH GRADE. This number exists to put the beam's top of
  // concrete LEVEL with the top of the house foundation wall -- the comment
  // above says so -- and it does that only while it equals
  // GRADE_BELOW_FOUNDATION_TOP_FT. When grade went to 1'-2" and this stayed at
  // 1'-0", the beam sank 2" below the house it is attached to and nothing
  // errored: the drawing just stopped matching its own stated intent.
  const GARAGE_BEAM_ABOVE_GRADE_FT = 14 / 12;
  // 1'-2" TOO, and no longer 8". Movie, 5 Sep: the 1'-2" is "for the grade beam
  // or frost wall", on "all 3 detached" -- so a detached beam tops out the same
  // height out of the ground as an attached one and as the house. The one
  // exception is the thickened edge, which cannot: it is only 1'-0" of concrete
  // deep, so a top 1'-2" above grade would leave the whole edge in the air.
  const DETACHED_BEAM_ABOVE_GRADE_IN = 14;
  // FROST WALL (Movie, 4 Sep): a garage on a concrete wall and strip footing
  // at the house's footing depth. Its top is set SILL TO SILL against the
  // house: level on a bilevel or modified bilevel, GARAGE_SILL_BELOW_HOUSE_FT
  // lower on a bungalow, a 2 storey, or an untyped drawing. Sill to sill and
  // not concrete to concrete, because the two agree only while both
  // attachments stand the same plate proud of the concrete. A detached frost
  // wall has no house sill to meet and tops out where its grade beam would.
  // project-page.js carries the same 2 under the same name; PROJECT.html
  // cannot reach STANDARDS.
  const GARAGE_SILL_BELOW_HOUSE_FT = 2;
  // Detached-garage thickened-edge slab: a LEVEL FLAT monolithic pour on
  // gravel — 4" field, 1'-0" deep perimeter edge, 45° taper from the edge
  // back up to the field.
  const GARAGE_EDGE_DEPTH_IN = 12;
  // ── AND EVERY GARAGE FLOOR LANDS 10" ABOVE GRADE ────────────────────────
  //
  // SPEC-garage-foundations.md, from Movie's numbers on 5 Sep and confirmed by
  // him again on 25 Sep: "10" is not a compromise, it is the number that keeps
  // the floor still. A grade beam tops out at grade + 14" with its slab 4"
  // under that, so its floor is grade + 10". A thickened edge IS its own top
  // of concrete. Both floors land at grade + 10", so changing a detached
  // garage's foundation moves the concrete and leaves the door where it was."
  //
  // THIS FILE HELD THAT INVARIANT IN ONE OF THREE PLACES. Measured on the
  // section before the fix, all three drawing the same garage floor:
  //
  //     frost wall      grade + 10"     frostWallTop - slab. Right.
  //     grade beam      grade + 19 1/2" the SILL PLATE top PLUS a slab --
  //                                     a concrete slab standing on the wood
  //                                     plate, and a 19 1/2" step off the
  //                                     driveway into the garage
  //     thickened edge  grade + 4"      the old number; project-page.js got
  //                                     DETACHED_SLAB_ABOVE_GRADE_IN = 10 in
  //                                     board #296 and this file never did
  //
  // So the door's own rule -- the one reason the 10" exists -- was false for
  // two of the three foundations it exists to keep level, and true for the
  // one nobody had touched. The three expressions are collapsed onto
  // garageSlabTop below; this constant is what project-page.js already calls
  // DETACHED_SLAB_ABOVE_GRADE_IN, pinned equal to it in the harness.
  const GARAGE_SLAB_ABOVE_GRADE_IN = 10;
  // HOW MUCH SKY THE DRAWING KEEPS ABOVE THE ROOF, and it is the only reason
  // this is a number rather than a 2 written twice.
  //
  // Movie, 25 Sep: "make the elevations smaller (add about 8 ft of extra
  // space above the roof (to even out the extra foundation space and make the
  // house a little smaller" ... "the house will end up looking smaller but
  // centered more".
  //
  // WHAT WENT OUT OF BALANCE WAS THE BOTTOM, NOT THE TOP. This was 2ft above
  // the ridge against 2ft below the footing, which was even while a footing
  // was the lowest thing drawn. It is not any more: a garage on a grade beam
  // carries piles, the house's own footings step, and the extent below grade
  // grew several feet without anything above the roof growing at all -- so
  // the house drew high in the frame with a long empty run of ground under
  // it. Giving the top the same order of room is what puts the building back
  // in the middle.
  //
  // AND IT IS THE FRAME THAT GROWS, NOT THE HOUSE THAT SHRINKS. pxPerFt is
  // the smaller of what the width allows and what the height allows, so eight
  // more feet of extent either costs nothing (a drawing already bounded by
  // its width) or scales the whole elevation down to fit -- which is the
  // "little smaller" he asked for, arrived at by asking for more paper rather
  // than by picking a zoom.
  const SKY_ABOVE_ROOF_FT = 10;
  // AND WHAT THE FOOTING SITS ON AT THE BOTTOM OF THE SHEET. Movie, 26 Sep:
  // "make it look like the footing is just about resting on one inch of dirt
  // and then the tint starts". Not a margin -- it is part of the drawing's
  // extent, so it is an inch of GROUND at whatever scale the elevation lands
  // at rather than a pixel count that means a different depth on every screen.
  // The two feet BELOW it are the pile shafts' run-off and are allowed out of
  // the frame; see the note at `yFit`.
  const GROUND_UNDER_FOOTING_FT = 1 / 12;
  const ROOF_FASCIA_IN = 5.5;
  // A truss chord in section: 3 1/2" measured ACROSS the member, so the
  // vertical drop under a sloped top chord grows with the pitch.
  const ROOF_CHORD_IN = 3.5;

  // ── HOW FAR AN ATTACHED GARAGE SITS BELOW THE HOUSE SILL ────────────────
  //
  // Movie gave this twice and the two agree. 4 Sep: a frost wall is set SILL
  // TO SILL against the house -- level on a bilevel or modified bilevel,
  // GARAGE_SILL_BELOW_HOUSE_FT lower otherwise. 25 Sep: "for typ of house the
  // default height of the garage sill will be different ... for bilevels it
  // should be level as default position", and a bungalow "will often be
  // dropped from house position by 2-4 ft".
  //
  // BUT A GRADE BEAM CANNOT TAKE THAT DROP, and that is arithmetic rather
  // than preference. Grade is GRADE_BELOW_FOUNDATION_TOP_FT (1'-2") under the
  // house sill. Drop a garage the full GARAGE_SILL_BELOW_HOUSE_FT and its top
  // of concrete lands 11 1/2" BELOW GRADE -- the slab it carries would be a
  // foot underground and the beam would have no face out of the ground at
  // all. A frost wall can be dropped because it runs to footing depth anyway
  // and the site backfills against it; a beam hanging off grade cannot.
  //
  // So the drop is asked of the FOUNDATION and not of the build type alone,
  // and a grade beam answers zero -- which is also exactly what Movie was
  // looking at on 25 Sep when he said "the garage sill and house sill line
  // up". Dropping a grade-beam garage means dropping the SITE with it, which
  // is board #44's phantom-house grade datum and is not this change.
  // ── `open` MEANS THE OUTLINE IS OPEN, NOT THAT THE GARAGE IS ────────────
  //
  // An ATTACHED garage's loop is left open along the wall it welds to the
  // house with -- harness-env's edgeOnOutline walks `points.length - 1` edges
  // for exactly that reason -- so `garage.open === true` reads "attached",
  // not "carport". It is the single most mis-readable field in this file:
  // written out as a bare `garage.open === true` in garageBearing it looks
  // like a building type, and a branch added under it for "the attached case"
  // is dead code, because the attached case already left through that line.
  //
  // So the predicate is named, once, and both callers ask it. A garage is
  // DETACHED when its loop closes AND it says it is detached; everything else
  // is attached and meets the house sill to sill.
  const isDetachedGarage = garage => garage.open !== true && garage.detached === true;

  // TAKES THE TYPE, NOT AN ENV, so the page that BUILDS the garage can ask
  // the same question the painter does. MODEL.html's raiseGarageConcrete held
  // its own copy of this rule and the copy had already drifted -- it applied
  // the drop unconditionally, with no split clause at all, so a frost-walled
  // bilevel was BUILT 2 ft down and DRAWN level. Exporting the rule is the
  // only version of this that cannot drift again.
  const SPLIT_TYPES = Object.freeze(['bilevel', 'modifiedBilevel']);
  function garageSillDropFt(buildType, mode) {
    if (mode !== 'frostwall') return 0;
    return SPLIT_TYPES.includes(buildType) ? 0 : GARAGE_SILL_BELOW_HOUSE_FT;
  }
  const envBuildType = env => (env && env.buildType ? env.buildType() : null);

  // ── WHERE AN ATTACHED GARAGE'S WALLS BEAR: THE TOP OF ITS SILL PLATE ────
  //
  // Movie, 25 Sep, looking at a built attached garage: "wait- the garage
  // bears at the house sill height" ... "the garage sill and house sill line
  // up" ... "the concrete starts below the 1.5" sill".
  //
  // THE DATUM IS THE HOUSE SILL, NOT GRADE -- and both attached paths in this
  // file already SAID so while neither DID it:
  //
  //   frostWallTop    "set SILL TO SILL against the house ... sill to sill
  //                    and NOT concrete to concrete" -- then returned the
  //                    garage's CONCRETE top set to the house's SILL top, and
  //                    the caller added the plate on top of that.
  //   the grade beam  GARAGE_BEAM_ABOVE_GRADE_FT exists "to put the beam's
  //                    top of concrete LEVEL with the top of the house
  //                    foundation wall" -- but fdn.wallTop IS THE BEARING
  //                    LINE (level-assembly.js, FOUNDATION_WALL_TOP_FT: "pour
  //                    + plate"), so grade + 1'-2" puts the beam's concrete on
  //                    the house's PLATE TOP rather than on its concrete.
  //
  // ONE DEFECT, ONE PLATE THICKNESS, WRITTEN TWICE -- and a third time in
  // MODEL.html's raiseGarageConcrete, which BUILDS what this file DRAWS off
  // the same `houseTop`. That is why nothing caught it: every site was wrong
  // by the same 1 1/2", so the drawing stayed self-consistent at the wrong
  // height. Measured on the bungalow before the fix: house sill 8'-1 1/2",
  // attached garage sill 8'-3" on BOTH foundation types -- the garage
  // standing exactly GARAGE_BEAM_PLATE_IN proud of the house it is bolted to.
  //
  // SO THE SILL TOP IS THE NUMBER, and the concrete is derived from it by
  // subtracting the plate -- the direction Movie gave ("the concrete starts
  // BELOW the 1.5" sill"), and the only direction that cannot drift: what
  // every garage wall stands on is now computed rather than inferred.
  function garageBearing(env, fdn, garage) {
    const mode = env.garageFoundation(garage);
    if (mode === 'frostwall') return frostWallTop(env, fdn, garage) + GARAGE_BEAM_PLATE_IN / 12;
    // ATTACHED: sill to sill with the house, less this foundation's drop.
    // Replaces `fdn.grade + GARAGE_BEAM_ABOVE_GRADE_FT + plate`, which reached
    // the same place by the wrong road -- grade is DERIVED from fdn.wallTop
    // (wallTop - 1'-2"), so climbing 1'-2" back out of it just returned the
    // bearing line, and the plate then stood the garage 1 1/2" over the house.
    if (!isDetachedGarage(garage)) return fdn.wallTop - garageSillDropFt(envBuildType(env), mode);
    // A thickened edge IS its own top of concrete, and its walls bear on it.
    if (mode === 'thickened') return fdn.grade + GARAGE_SLAB_ABOVE_GRADE_IN / 12;
    return fdn.grade + (DETACHED_BEAM_ABOVE_GRADE_IN + GARAGE_BEAM_PLATE_IN) / 12;
  }

  // Top of a garage's CONCRETE, whatever it stands on: one sill plate below
  // where its walls bear, except a thickened edge, which has no plate because
  // it has no wall under the slab -- the slab is the foundation.
  function garageConcreteTop(env, fdn, garage) {
    if (env.garageFoundation(garage) === 'thickened') return garageBearing(env, fdn, garage);
    return garageBearing(env, fdn, garage) - GARAGE_BEAM_PLATE_IN / 12;
  }

  // ── WHERE A FACE'S CLADDING STARTS ──────────────────────────────────────
  //
  // EXPORTED, BECAUSE THE PAINTER IS NOT THE ONLY THING THAT ASKS. EXT.
  // FINISH draws a dashed box round the face you pick, and it had its own
  // arithmetic for the bottom of that box: `level.floorTop + baseHeight`,
  // which is the FINISHED FLOOR -- a whole floor package above where the
  // cladding actually starts.
  //
  // MEASURED ON repro-garage-house, both storeys, E1:
  //
  //     MAIN FL   box 0.0000   paint -1.1771   out by 1'-2 1/8"
  //     2ND FL    box 9.1458   paint  8.0938   out by 1'-0 5/8"
  //
  // So the page drew the stucco in the right place and then drew a line
  // saying it had not. Movie read the line and reported the paint -- twice,
  // with screenshots -- and every measurement I made of the PAINT came back
  // correct, which is exactly how a wrong second mechanism hides.
  //
  // A claim two mechanisms both satisfy is a claim no check can hold. There
  // is one mechanism now, and `faceLines` below reads it too rather than
  // keeping a copy that agrees today.
  //
  //   SILL   where this storey's cladding starts. On the storey that bears
  //          on concrete that is the BOTTOM OF THE SILL PLATE -- Movie,
  //          27 Sep: *"the main floor and garage should go down to the
  //          bottom of sill plate and 2nd floor should go to main fl ceiling
  //          line"*. On a storey above there is no sill plate and the
  //          cladding runs down over the rim, so it is that floor's own
  //          underside -- which IS the ceiling line of the storey below.
  //
  // A GARAGE STANDS ON ITS OWN CONCRETE, so its cladding starts a plate below
  // its own floor wherever that floor is; a house storey does only when it is
  // the one on the foundation.
  function faceSillFt(env, face, stack) {
    const level = face.level;
    if (!face.garage) {
      return level.id === stack.floors[0].id
        ? level.floorBottom - houseSillPlateFt()
        : level.floorBottom;
    }
    return garageBearing(env, stack.foundation, face.garage)
      - GARAGE_BEAM_PLATE_IN / 12;
  }

  // THE FINISHED GARAGE FLOOR AS ONE LEVEL -- what a stair lands on, what a
  // door schedule quotes, and the one number three painters were each deriving
  // for themselves. See GARAGE_SLAB_ABOVE_GRADE_IN for what they each had.
  //
  // IT IS THE LEVEL, NOT THE SURFACE. The floor falls toward the door, so a
  // view that runs along the fall has to ask garageFloorAt below about a PLACE.
  // This is the datum that fall is quoted around, and the two agree where
  // `GARAGE_SLAB_THICKNESS_IN` of drop and the fall coincide -- 32 ft in -- and
  // everywhere at all on a thickened edge, which has no fall to quote.
  //
  // NO PAINTER READS THIS ANY MORE, and it is kept rather than deleted because
  // it is what SPEC-garage-foundations.md means by the garage floor: "Both
  // floors land at grade + 10", so changing a detached garage's foundation
  // moves the concrete and leaves the door where it was." That invariant is
  // held by the LEVEL and not by the surface, and the two readings of this
  // floor now disagree about it:
  //
  //     thickened edge   the pour IS the floor      grade + 10"
  //     detached beam    the pour is grade + 8",
  //                      the floor 8" under it      grade + 0"  at the door
  //
  // -- so on the top-of-concrete datum, swapping a detached garage's foundation
  // moves its door 10". THAT IS MOVIE'S CALL, not this file's: either a
  // thickened edge's own top slopes with the floor it is (and its walls bear on
  // a sloping line), or the fall is quoted around this level instead of around
  // the pour. Board #45 is about the buck, and re-datuming three foundation
  // types is not in it. Flagged rather than quietly picked.
  function garageSlabTop(env, fdn, garage) {
    const top = garageConcreteTop(env, fdn, garage);
    // The monolithic pour's top IS the floor; there is no slab poured onto it.
    if (env.garageFoundation(garage) === 'thickened') return top;
    return top - GARAGE_SLAB_THICKNESS_IN / 12;
  }

  // ── AND THE FLOOR AT A PLACE, MEASURED FROM THE TOP OF THE CONCRETE ─────
  //
  // Movie, 26 Sep, on being shown this floor quoted against grade: *"it
  // shouldn't be measured to 'grade' it should be measured from top of
  // concrete (1ft down from top of concrete)"*, and *"1 ft down default"*.
  //
  // THE SECTION DREW THE LEVEL ABOVE AND CALLED IT THE FLOOR, and one level is
  // the fall at 32 ft in and nowhere else. Read against grade it came to the
  // spec's 10", which is why nothing caught it -- the two readings of this one
  // floor cross at exactly one station, and that station is where the check
  // stood:
  //
  //     at the overhead door    8" below the pour     (the buck shows 8")
  //     27 ft in                4 5/8" below          (the buck shows 4 5/8")
  //     32 ft in                4" below              = grade + 10", the old
  //                                                     level answer
  //     past GARAGE_SLAB_FLAT_AT_FT   level with it   (no buck shows at all)
  //
  // ONE RULE, NOT TWO. The fall is the same expression the buck already
  // shows, so the floor cannot drift from the opening drawn at the door --
  // they are the same subtraction.
  //
  // THE LEVEL ABOVE IS NOT WRONG AND IS NOT REPLACED. `garageSlabTop` answers
  // the question a spec and a stair ask -- one number for the garage -- and
  // this answers the one a section asks, which is where the floor is HERE.
  function garageFloorAt(env, fdn, garage, pt) {
    const top = garageConcreteTop(env, fdn, garage);
    // The monolithic pour's top IS the floor; there is no slab poured onto it,
    // nothing above it to measure down from, and no buck formed out of it.
    if (env.garageFoundation(garage) === 'thickened') return top;
    // NO OVERHEAD DOOR, NO FALL TO MEASURE -- and that is not the same as no
    // slab. `garageDoorOpeningFt` answers zero without a datum, which is the
    // right answer about a BUCK (there is none to show) and the wrong one about
    // a FLOOR: it would lay the slab's top flush with the pour and lose the
    // four inches of it. Such a garage takes the level the spec names.
    if (!garageDoorDatum(env, garage)) return garageSlabTop(env, fdn, garage);
    return top - garageDoorOpeningFt(env, garage, pt);
  }

  // ── A DOOR BUCK IS ALWAYS A FOOT; WHAT SHOWS OF IT IS NOT ───────────────
  //
  // Movie, 26 Sep, settling it: "could we make the man door or a 2ndry garage
  // door (at back of garage - high point) to adjust the buck based on the slab
  // ... the slab will always pour over the 1ft door buck and fill in the extra
  // space". And earlier, on the overhead door: "the 1ft door buck - and 8"
  // garage door drops. (and 4" slab filling the 4" gap between door and door
  // buck - completing 24" height grade beam ... the door buck will appear on
  // the elevations as a 8" opening in the top of the concrete".
  //
  // SO THE VOID IS A CONSTANT AND THE FILL IS NOT. Twelve inches is formed out
  // of the top of the beam at every door, which leaves 20" of concrete under
  // it whatever else changes; the slab is then poured over the buck and fills
  // whatever depth is left. WHAT A DRAFTER SEES in the top of the concrete is
  // the part the slab did not fill, which is exactly the slab's own fall at
  // that door -- 8" at the overhead door, less further in, nothing at all past
  // GARAGE_SLAB_FLAT_AT_FT where the slab has climbed level with the pour.
  //
  // WHICH IS WHY THIS IS NOT A SECOND NUMBER PER DOOR KIND. Movie's other
  // figure -- "make it 10" - 4" slab (6")" for a man door -- is this rule at a
  // particular station and not a constant of its own: a 6" opening is where
  // the slab has risen two inches, 16 ft in. Measured on a drive-thru
  // twoStorey-garage, whose garage is 27 ft deep:
  //
  //     the overhead door      0.00 ft in   8"      slab fills 4" of the buck
  //     the man door at back  27.00 ft in   4 5/8"  slab fills 7 3/8"
  //
  // THE DATUM IS THE OVERHEAD DOOR'S OWN WALL, because that is what the slab
  // falls to. The model already says which door that is -- `garage: true` on
  // the fenestration, set by the builder -- so nothing here has to guess from
  // a width. A garage with no overhead door has no fall to measure and no
  // buck to show: its slab is level with the pour and a man door sits on it.
  const GARAGE_DOOR_BUCK_IN = 12;
  // WHAT AN EXTERIOR DOOR STANDS ON. Movie, 26 Sep: "we should put the
  // exterior 'mandoor's thresholds at 1/2" (to avoid the bottom line not
  // showing ...) and usually there is one on exterior doors". An overhead
  // door takes none -- it seals to the slab.
  const DOOR_THRESHOLD_IN = 0.5;
  // ── AND THE BARE STRIP UNDER AN EXTERIOR DOOR ─────────────────────────
  //
  // Movie, 28 Sep, having just got the stone to run under his front door:
  // *"we should put a 6\" 'threshold' just blank spot where they can install
  // pfm drip edge under the door to the edge of the DECK - which i will be
  // adding to in front of the higher up exterior doors"*, and *"I will be
  // adding DECK and COVERED deck later"*.
  //
  // SO IT IS SIX INCHES OF NOTHING, hung off the door's own bottom, with a
  // line under it: prefinished metal goes there and the deck lands on it.
  // The cladding is painted first and this is laid back over it, which is
  // the same way the band under a water table is done a few hundred lines
  // down -- paint it, then take it away where something else belongs.
  const DOOR_SILL_BARE_IN = 6;
  // WHAT THE TRIM ADDS EACH SIDE, AND THERE IS NO TRIM YET. He asked for the
  // strip to run *"the full with of DOOR + TRIM (if trim is added)"*, so the
  // width is one expression rather than a number written twice: nothing
  // today, and whatever the trim is the day it lands. Anything else that has
  // to follow a door's trim asks HERE instead of carrying its own copy --
  // two copies of a width is two widths, eventually.
  const doorTrimFt = fen => (Number(fen && fen.trimWidth) > 0 ? Number(fen.trimWidth) : 0);
  // The overhead door's wall, as an origin and a unit normal POINTING INTO THE
  // GARAGE, or null.
  //
  // INTO, and that is not a detail: a wall's +normal follows the order its ends
  // were drawn in, so on half the drawings it points at the driveway.
  // `garageSlabBelowConcreteIn` clamps a NEGATIVE distance for exactly that
  // reason -- "a silent negative curb would read as the slab rising out through
  // the door" -- and an unsigned distance defeats the clamp instead of feeding
  // it: a point 4" outside the door comes back as one 4" inside, and the floor
  // climbs back out of the building. It went unseen while the only callers
  // asked about door CENTRES, which sit on the wall at zero either way.
  //
  // MEASURED AGAINST THE BODY, so the sense is the garage's own and not the
  // wall's. `sameGarageBody` for the same reason it exists at the buck pass:
  // the outline is filed once per storey.
  function garageDoorDatum(env, garage) {
    const byId = new Map(env.walls().map(w => [w.id, w]));
    const cache = {};
    const overhead = env.fenestrations().find(f => f.garage === true
      && (f.type || f.kind) === 'door'
      && sameGarageBody(garageOfWall(byId.get(f.wallId), env, cache), garage));
    const wall = overhead && byId.get(overhead.wallId);
    if (!wall) return null;
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (!(len > 1e-6)) return null;
    let nx = -dz / len, nz = dx / len;
    const pts = garage.points || [];
    if (pts.length) {
      const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length;
      const cz = pts.reduce((a, q) => a + q.z, 0) / pts.length;
      if ((cx - wall.start.x) * nx + (cz - wall.start.z) * nz < 0) { nx = -nx; nz = -nz; }
    }
    return { at: wall.start, nx, nz };
  }
  // How far INTO the garage this plan point is, in feet, measured from the
  // overhead door's wall. Negative is outside it -- past the door, where the
  // buck is formed and the slab reaches. Zero where there is no overhead door
  // to measure from, which is the same answer as standing in the doorway and
  // is what leaves such a garage's floor level with its pour.
  function garageDepthFt(env, garage, pt) {
    const datum = garageDoorDatum(env, garage);
    if (!datum || !pt) return 0;
    return (pt.x - datum.at.x) * datum.nx + (pt.z - datum.at.z) * datum.nz;
  }
  // WHERE A DOOR IS IN PLAN -- its centre on the wall it is cut into. Both
  // views need it to ask the floor how far it has fallen there, and the
  // elevation worked it out inline from the same three numbers.
  function doorPoint(wall, f) {
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    const t = len > 1e-6 ? f.offset / len : 0;
    return { x: wall.start.x + (wall.end.x - wall.start.x) * t,
      z: wall.start.z + (wall.end.z - wall.start.z) * t };
  }
  // How deep the buck shows in the top of the concrete at this plan point, in
  // FEET. Zero where the slab has caught up with the pour.
  function garageDoorOpeningFt(env, garage, pt) {
    if (!garageDoorDatum(env, garage) || !pt) return 0;
    return garageSlabBelowConcreteIn(garageDepthFt(env, garage, pt)) / 12;
  }

  // Top of a frost-wall garage's CONCRETE, on the section's foundation datum
  // -- one sill plate below where its walls bear. See garageBearing.
  function frostWallTop(env, fdn, garage) {
    if (isDetachedGarage(garage)) {
      return fdn.grade + DETACHED_BEAM_ABOVE_GRADE_IN / 12;
    }
    return fdn.wallTop - garageSillDropFt(envBuildType(env), 'frostwall')
      - GARAGE_BEAM_PLATE_IN / 12;
  }

  // ── THE FASCIA IS BANDED ONCE, OVER THE EAVE'S TRUE LENGTH ───────────────
  //
  // An eave gets its band from two passes. The SILHOUETTE bands each run it
  // finds; the FACE-EDGE pass then bands eaves from the real face polygons and
  // subtracts whatever the silhouette already drew, so the stretches the
  // silhouette could not see still get one.
  //
  // THE SILHOUETTE IS SAMPLED AND THE FACE EDGE IS EXACT, and that is the
  // whole bug. It walks the cut in 240 steps and probes 40 depths at each for
  // the tallest roof surface; near a roof's outer corner the roof is a sliver
  // in depth, every probe misses it, and the run simply stops early. Measured
  // on the bungalow's front elevation:
  //
  //     silhouette run   u0 -22        u1 46.25
  //     eave face edge   u0  22.947    u1 48      -> 46.25..48 survives
  //
  // Twenty-one inches of fascia, hanging off the end of an eave that had
  // already been banded to within two feet of there. Three runs in that one
  // elevation ended short -- by 1.75 ft, 1.0 ft and 0.167 ft -- and the
  // `> 0.2` filter downstream is why only some of them were ever visible:
  // 0.167 was dropped by luck and 1.75 was not.
  //
  // SO THE RUN IS GROWN TO WHAT IT APPROXIMATES, rather than the leftover
  // being filtered harder. A run that overlaps an eave edge is part of that
  // eave, and the eave's own ends are known exactly -- so the band is drawn
  // over them and the subtraction downstream then finds nothing left. Raising
  // the filter instead would trade the stub for a GAP, since the sampling
  // shortfall is real and the eave would simply stop early; and a tolerance
  // is what produced this in the first place.
  //
  // PURE, AND SEPARATE, so it can be checked. Everything around it is canvas
  // work that has to be looked at; this is arithmetic that can be measured.
  //
  // ── AND ONLY AS FAR AS THE SAMPLING COULD HAVE MISSED ────────────────────
  //
  // Movie, 29 Sep, on a BILEVEL + ATTACHED ROOM-OVER GARAGE: a line leaves the
  // top of the little lean-to, crosses the house face climbing slightly, and
  // stops in mid-wall meeting nothing at either end. It is this growth.
  //
  // On that E2 the lean-to tying the garage to the house is the tallest
  // surface for four feet and the HOUSE roof takes over after that, so the run
  // is u -7..-3.17. The garage's far eave is at the same plate and runs the
  // whole depth of the garage, u -7..21. Equal tops, overlapping intervals --
  // so a four-foot run was grown to twenty-eight, and the outline's closing
  // riser went in at u 21 with the slope run out to meet it. Twenty-four feet
  // of line across the middle of a wall.
  //
  // WHAT IS BEING CORRECTED IS A SAMPLING SHORTFALL, so the correction is
  // bounded by what the sampling can hide: a corner the probes stepped over,
  // a sample or two of u. A run ending where another surface RISES IN FRONT
  // of it is not short of anything -- it ends at an intersection, found to
  // within a step -- and the eave carrying on past that point belongs to the
  // part of the roof now behind something else. Reach is that bound; the
  // caller passes it in samples of its own cut, and the eave's exact end is
  // still what an end inside the bound is snapped to.
  //
  // No reach given means unbounded, which is how the pure checks state the
  // height and overlap rules in their own numbers.
  function extendRunsToEaves(runs, eaves, eps = 0.05, reach = Infinity) {
    if (!Array.isArray(runs) || !Array.isArray(eaves)) return runs;
    return runs.map(run => {
      let u0 = run.u0, u1 = run.u1;
      eaves.forEach(eave => {
        // SAME BAND, OR IT IS A DIFFERENT EAVE. A garage roof on its own plate
        // runs at another height through the same stretch of paper, and
        // growing one to the other's ends would stretch a band across a roof
        // it has nothing to do with.
        if (Math.abs(eave.top - run.top) > eps) return;
        // TOUCHING COUNTS AS OVERLAP. The sampling stops short, so the run's
        // end and the edge's start can be a sample apart rather than crossing.
        if (eave.u1 < u0 - eps || eave.u0 > u1 + eps) return;
        u0 = Math.min(u0, Math.max(eave.u0, run.u0 - reach));
        u1 = Math.max(u1, Math.min(eave.u1, run.u1 + reach));
      });
      return { ...run, u0, u1 };
    });
  }

  // ── A SPLIT STANDS ITS HALF-LEVELS WHERE PROJECT DOES ─────────────────
  //
  // Movie, 2 Oct: the premade BILEVEL takes its "floor heights and
  // thicknesses" from PROJECT, and "the BILEVEL needs a entry floor sitting on
  // the foundation wall". So on a BILEVEL or MOD BILEVEL that has an ENTRY:
  //
  //   ENTRY        on the SILL atop the 5'-0" pour; its joists and the wood
  //                fill wall beside them both reach MAIN's bearing line, so
  //                its wall is the fill less its own package (3'-4 3/4").
  //   MAIN FL      the datum, 0 -- as on every drawing. It is NOT the lowest
  //                floor here, which is the whole point of the change.
  //   OVER GARAGE  (MOD BILEVEL) the lower 2nd floor: its deck the typed
  //                deck-to-deck above ENTRY's, not a storey over MAIN.
  //
  // The numbers are PROJECT's own -- its section table row through
  // DraftLevelAssembly.splitValues -- and the arithmetic is its
  // buildWallSection's: fill = entry wall + entry package.
  //
  // Any other level (a 2ND FL the default stack carries) climbs from MAIN as
  // before. Returns null when the drawing is not a split with an ENTRY, and
  // the plain stack is used.
  const ENTRY_LEVEL_ID = 2;
  function splitFloorStack(env, floors) {
    const LA = window.DraftLevelAssembly;
    if (!LA || !LA.isSplitType || !LA.isSplitType(envBuildType(env))) return null;
    const ids = floors.map(level => Number(level.id));
    if (!ids.includes(2) || !ids.includes(3)) return null;
    const type = envBuildType(env);
    const split = LA.splitValues(type, env.sectionRow ? env.sectionRow(type) : null);
    const pkgFt = id => env.levelFloorFt(id);
    const main = env.levelAssembly(3);
    const mainPkgFt = split.mainJoistDepthIn || split.mainSheathingIn
      ? ((split.mainJoistDepthIn ?? main.joistDepthIn) + (split.mainSheathingIn ?? main.sheathingIn)) / 12
      : pkgFt(3);
    const place = {};
    place[3] = { floorTop: 0, floorBottom: -mainPkgFt, wallTop: split.mainWallHeightFt };
    const entrySill = -mainPkgFt - split.woodFillHeightFt;
    place[2] = { floorBottom: entrySill, floorTop: entrySill + pkgFt(2), wallTop: -mainPkgFt };
    if (split.upper && ids.includes(4)) {
      const deck = place[2].floorTop + split.upperDeckAboveEntryFt;
      place[4] = { floorTop: deck, floorBottom: deck - pkgFt(4), wallTop: deck + split.upperWallHeightFt };
    }
    // Everything else stacks on the last FULL storey below it in the list.
    let under = place[3];
    return floors.map(level => {
      const id = Number(level.id);
      const assembly = env.levelAssembly(id);
      let at = place[id];
      if (!at) {
        const floorTop = under.wallTop + pkgFt(id);
        at = { floorTop, floorBottom: floorTop - pkgFt(id), wallTop: floorTop + assembly.wallHeightFt };
      }
      if (id !== 2 && id !== 4) under = at;
      return {
        id: level.id, name: level.name, ...at,
        joistDepthIn: assembly.joistDepthIn,
        sheathingIn: assembly.sheathingIn,
      };
    });
  }

  function sectionLevelStack(env) {
    const floors = env.floorLevels();
    if (!floors.length) return null;
    let floorTop = 0;
    const splitStack = splitFloorStack(env, floors);
    const split = splitStack ? window.DraftLevelAssembly.splitValues(envBuildType(env),
      env.sectionRow ? env.sectionRow(envBuildType(env)) : null) : null;
    const stack = splitStack || floors.map((level, index) => {
      if (index > 0) {
        floorTop += env.levelAssembly(floors[index - 1].id).wallHeightFt
          + env.levelFloorFt(level.id);
      }
      const assembly = env.levelAssembly(level.id);
      return {
        id: level.id, name: level.name,
        floorTop,
        floorBottom: floorTop - env.levelFloorFt(level.id),
        wallTop: floorTop + assembly.wallHeightFt,
        joistDepthIn: assembly.joistDepthIn,
        sheathingIn: assembly.sheathingIn,
      };
    });
    // The lowest DECK, which on a split is ENTRY and not the first in the list.
    const lowest = stack.reduce((low, level) => (level.floorBottom < low.floorBottom ? level : low), stack[0]);
    const foundationAssembly = env.levelAssembly(1);
    const wallTop = lowest.floorBottom;
    // ── THE PLATE COMES OFF BEFORE THE POUR DOES ─────────────────────────
    //
    // Movie, 25 Sep, on E4 of a 1 STOREY + GARAGE: "the 'main floor' is still
    // on top of the garage in the elevation" ... "to me it looks like the
    // edge of the main floor line that is showing through".
    //
    // WHAT HE WAS LOOKING AT WAS THE GARAGE'S OWN TOP OF CONCRETE, standing
    // exactly where the house's floor package ends -- both at -1.0521 on that
    // build, equal to four decimals -- so the two surfaces met with no step
    // and read as one main-floor band running the width of the sheet.
    //
    // `wallTop` IS THE BEARING LINE: it is the lowest floor's underside, which
    // is the top of the sill plate, and gradeFromBearing below is named for
    // taking it. `levelWallTopFt` is NOT the same kind of number -- it reads
    // the foundation WALLS, and the builder writes those at the POUR, 8'-0".
    // level-assembly.js says the difference in capitals: FOUNDATION_WALL_TOP_FT
    // "IS THE BEARING LINE, WHICH IS NOT THE CONCRETE'S OWN HEIGHT ... pour +
    // plate", 8'-1 1/2" against 8'-0" (Movie, 7 Sep: "default is 8\" conc wall
    // with 1.5\"").
    //
    // SUBTRACTING THE POUR FROM THE BEARING LINE LEFT THE BASE ONE PLATE
    // HIGH, and every face measured from it drew a plate too tall -- topping
    // out at the bearing line instead of at the concrete. On the house that
    // is invisible: the rim band sits directly on it. On the garage there is
    // nothing above it, so the line shows.
    //
    // THE CHAIN CLOSES ONCE THE PLATE COMES OFF FIRST. Measured on his build,
    // before and after:
    //
    //     wallTop (bearing)        -1.0521
    //       less plate  1 1/2"     -1.1771   top of concrete
    //       less pour   8'-0"      -9.1771   bottom of concrete  (was -9.0521)
    //
    //     every foundation face's top   -1.0521  ->  -1.1771
    //     grade + GARAGE_BEAM_ABOVE_GRADE_FT    =   -1.1771
    //     the house out of the ground   15 1/2"  ->  14"
    //
    // -- which is the rule the builder already follows and the painter was
    // drawing 1 1/2" away from. The garage's concrete now tops out a plate
    // BELOW the house's floor bottom, so the junction carries a step instead
    // of a line that reads as the main floor carrying over the garage.
    //
    // THE FOOTINGS MOVE WITH IT, because footingBottom is measured from this
    // base. That is the correction, not a side effect: the wall is a plate
    // taller than the painter had it, so its underside is a plate deeper.
    // A SPLIT POURS ITS OWN WALL: PROJECT's 5'-0", with the rest of the
    // basement made up in wood above the sill.
    const wallBottom = wallTop - houseSillPlateFt()
      - (split ? split.fdnWallHeightFt : env.levelWallTopFt(1, 'foundation'));
    // ── A ROOF BEARS ON THE WALLS THAT HOLD IT UP ────────────────────────
    //
    // `bearing` was the top of the TOPMOST FLOOR LEVEL IN THE STACK, and the
    // stack comes from floorLevels(), which keeps a level because it has a
    // floor layer view -- never because anything was built there. The default
    // stack always carries 2ND FL, so every ONE-STOREY house on both pages
    // drew its roof a whole storey above the walls under it.
    //
    // Measured on Movie's own bungalow, kept as the harness fixture: the
    // house roof bore at 17.240 and the garage roof -- which carries its own
    // plate and was therefore right -- at 8.094, with ZERO walls on the level
    // the house roof was standing on. He reported it as "the roof is real
    // messed on this one"; it was the roof standing on nothing.
    //
    // IT WENT UNSEEN FOR WANT OF SOMETHING CORRECT BESIDE IT. Until the
    // garage got a roof there was no second one in the elevation to disagree
    // with, and one floating roof alone reads as how the thing draws.
    //
    // THE TOPMOST OCCUPIED STOREY, then -- and occupancy is asked of the
    // walls rather than of the level list, because the level list is the
    // thing that was wrong. env.walls() is already in this env's contract, so
    // nothing new is required of the three pages that build one.
    //
    // A NO-OP WHEREVER THE TOP FLOOR IS OCCUPIED, which is what makes it safe
    // in the one file that draws every elevation and section on both pages:
    // `standing` ends at the same level `stack` does, so the number does not
    // move. With NO level occupied it falls back to the old answer rather
    // than to the ground -- an empty drawing has no walls to bear on and a
    // bearing at zero would put its roof through the floor.
    const built = new Set((env.walls() || []).map(wall => Number(wall.levelId)));
    const standing = stack.filter(level => built.has(Number(level.id)));
    // The TALLEST standing storey: on a split the list does not climb in
    // order, so the last one is not always the top.
    const tallest = list => list.reduce((top, level) => (level.wallTop > top.wallTop ? level : top), list[0]);
    // A SPLIT'S HOUSE ROOF LANDS ON MAIN FL'S CEILING. The storey over its
    // garage is roofed on its own level (see roofBaseElev), so the house roof
    // does not ride up to it -- PROJECT's own section says the same: "a stack
    // that stops at MAIN FL lands the eave on MAIN FL's ceiling".
    const splitMain = splitStack && stack.find(level => Number(level.id) === 3);
    const bearer = splitMain || (standing.length ? tallest(standing) : tallest(stack));
    // The split row's slab and footing where it typed them, as PROJECT reads.
    const slabIn = split?.slabThicknessIn ?? foundationAssembly.slabThicknessIn;
    const footingIn = split?.footingDepthIn ?? foundationAssembly.footingDepthIn;
    return {
      floors: stack,
      bearing: bearer.wallTop,
      split: !!splitStack,
      foundation: {
        wallTop, wallBottom,
        grade: gradeFromBearing(wallTop),
        slabTop: wallBottom + slabIn / 12,
        slabIn,
        footingBottom: wallBottom - footingIn / 12,
        footingIn,
        footingWidthIn: env.footingWidthIn(1),
      },
    };
  }

  // ── BODY MEMBERSHIP: ONE SOURCE OF TRUTH (board #293) ──────────────────
  //
  // A drawing is bodies, not one building, and every painter below has to ask
  // "which body?" before "which level?". Until now this file answered that
  // question three different ways:
  //
  //   * two VERBATIM copies of the wall rule -- one closure inside
  //     sectionWallCrossings, an identical one inside drawElevationView.
  //   * roofBaseElev read the STORED flag `roof.garage === true`.
  //
  // Two definitions disagree the first time they drift, and a duplicated one
  // drifts by being edited in one place. Both are fixed here: geometry is the
  // single definition, and it lives once.
  //
  // ROOFS ARE DERIVABLE, and that was worth measuring rather than assuming.
  // A roof's points are the source outline OFFSET by the overhang, so
  // edgeOnOutline can never match them -- but each roof point carries the
  // srcId of the outline point it was offset from (`_linkVertex` at the
  // generator). Measured on a real bone build with an attached garage,
  // 8 Sep 2026:
  //
  //   house outline   op-2 op-3 op-11 op-12 op-4 op-5
  //   garage outline  op-11 op-15 op-16 op-12
  //   house roof      op-2 op-3 op-11 op-12 op-4 op-5   <- the house exactly
  //   garage roof     op-11 op-15 op-16 op-12           <- the garage exactly
  //
  // SET EQUALITY, NOT OVERLAP, and the measurement is what proves it: an
  // attached garage WELDS onto the house at shared master points, so the
  // house roof and the garage outline genuinely share op-11 and op-12. An
  // overlap test calls the house roof a garage roof and drops the main roof
  // a storey. Equality does not.
  const srcIdsOf = points => {
    const ids = new Set();
    (points || []).forEach(pt => { if (pt && pt.srcId) ids.add(pt.srcId); });
    return ids;
  };
  const sameIds = (a, b) => a.size === b.size && a.size > 0
    && [...a].every(id => b.has(id));

  // The garage outline a WALL lies on, or null. One home for the rule that
  // used to be copied twice. `cache` is a per-call object so the outline
  // lookup still happens once per level, exactly as the closures did.
  // ── AND A FOUNDATION WALL SAYS SO ITSELF ───────────────────────────────
  //
  // Geometry alone cannot answer for a garage's grade beam, and every painter
  // that asks about the FOUNDATION view was getting `null`.
  //
  // env.garageOutlines(levelId) filters outlines to that level exactly, and
  // MODEL.html's raiseGarageConcrete builds the beam with `withOutline: false`
  // -- so a garage has ONE outline, on MAIN FL, and none on FOUNDATION. The
  // beam walls lie exactly ON that outline, but they are asked about against
  // level 1's list, which is empty. Measured on a 2 STOREY + GARAGE + ROOM
  // OVER saved from the app on 25 Sep: all four grade-beam walls resolved to
  // `house`, and with them the frost-wall garage slab block (which filters on
  // `c.garage`) never fired at all and the grade-beam slab always took its
  // fallback arm.
  //
  // THE RECORD ALREADY KNEW. raiseGarageConcrete tags those walls
  // `body: 'garage'` and drawing-format.js:507 persists it, so the answer was
  // in the file the whole time and this function was re-deriving it from
  // geometry that had been filtered away. The marker is authoritative and
  // cannot produce a false positive, so it is asked only after the geometric
  // answer comes back empty -- nothing that resolved before resolves
  // differently now.
  //
  // WHY IT WENT UNSEEN: proto/repro-garage-house.draft was saved by an older
  // builder that wrote a garage outline on EVERY level, level 1 included. The
  // geometric path finds it there, so the harnesses reading that fixture were
  // green on a shape the app has not produced for some time -- a check
  // passing because the fixture has something the program no longer makes.
  function garageOfWall(wall, env, cache) {
    const list = cache[wall.levelId]
      || (cache[wall.levelId] = env.garageOutlines(wall.levelId));
    const hit = list.find(garage => env.edgeOnOutline(wall.start, wall.end, garage));
    if (hit) return hit;
    if (String(wall.body || '').trim() !== 'garage') return null;
    // The wall says it is a garage's. Find WHICH by looking for the outline it
    // lies on, on any storey -- a foundation beam is raised from the garage's
    // own loop, so it sits on that boundary wherever the outline is filed.
    const levels = (env.floorLevels() || []).map(level => level.id);
    for (const levelId of levels) {
      const others = cache[levelId] || (cache[levelId] = env.garageOutlines(levelId));
      const found = others.find(garage => env.edgeOnOutline(wall.start, wall.end, garage));
      if (found) return found;
    }
    return null;
  }

  // ── ONE GARAGE, FILED ONCE PER STOREY ─────────────────────────────────
  //
  // `garageOutlines(levelId)` answers the records ON THAT LEVEL, so a garage
  // that reaches two storeys comes back as two objects -- different `id`,
  // shared `masterId` -- and garageOfWall caches per level, which means a
  // FOUNDATION wall and the plan wall standing on it get two different objects
  // for the one garage.
  //
  // WHICH MAKES `===` A TRAP, and it cost a reading: the section's buck pass
  // paired a door with the concrete under it by object identity and found
  // nothing on repro-garage-house, whose outline is filed on levels 1 and 3
  // (outline-21 / outline-22, both master outline-13), while
  // repro-2storey-garage-beam -- filed once -- worked. A defect that shows on
  // one fixture and not the other, from a test that looks exact.
  const sameGarageBody = (a, b) => !!a && !!b && (a === b
    || (a.masterId && a.masterId === b.masterId)
    || a.masterId === b.id || b.masterId === a.id);

  // The garage outline a ROOF was generated from.
  //
  // Three answers, and the third is the honest one rather than a hedge:
  //   an outline  -- this roof is that garage's
  //   null        -- decidable, and it is not a garage roof
  //   undefined   -- UNDECIDABLE: the roof carries no source links at all
  //                  (hand-built geometry, or a drawing older than linking),
  //                  so geometry has no opinion and the stored flag is all
  //                  there is.
  function garageOfShape(shape, env, levelId) {
    const ids = srcIdsOf(shape.points);
    if (!ids.size) return undefined;
    const found = env.garageOutlines(levelId)
      .find(garage => sameIds(srcIdsOf(garage.points), ids));
    return found || null;
  }

  function garageOfRoof(roof, env) {
    return garageOfShape(roof, env,
      roof.sourceLevelId != null ? roof.sourceLevelId : roof.levelId);
  }

  // FLOORS HAVE THE SAME SHAPE, and the sweep found it where the work order
  // had not looked. A garage slab is generated from the garage outline and
  // carries its srcIds exactly -- measured on the garage fixture:
  //
  //   outline-22 (garage, level 1)  op-11 op-15 op-16 op-12
  //   floor-62   (slab,   level 1)  op-11 op-15 op-16 op-12
  //
  // so `floor.garage` is a second stored flag of exactly the class board
  // #293 was about.
  //
  // THE PAINTERS STILL READ THE FLAG, deliberately. Switching roofBaseElev
  // to geometry was one call site and paid for itself; floor.garage is read
  // across the slab, grade-beam, frost-wall and thickened-edge paths, and
  // moving all of them buys no behaviour -- the drift check below already
  // makes flag and geometry provably identical wherever geometry can
  // decide. Written down rather than done, so the next person chooses with
  // the measurement in hand instead of rediscovering it.
  function garageOfFloor(floor, env) {
    return garageOfShape(floor, env, floor.levelId);
  }

  // IS this a garage roof. Geometry decides whenever it can; the stored flag
  // answers only where geometry cannot see. That is the "one definition"
  // this board asked for, with the fallback named instead of hidden.
  function isGarageRoof(roof, env) {
    const derived = env && typeof env.garageOutlines === 'function'
      ? garageOfRoof(roof, env) : undefined;
    if (derived === undefined) return roof.garage === true;
    return derived !== null;
  }

  // THE DRIFT DETECTOR, and the reason this board did not simply delete the
  // flag. Where geometry CAN decide, the stored flag must agree with it; a
  // disagreement means an outline was edited after generation, or a roof was
  // regenerated against a stale flag. Returns the roofs that disagree, so a
  // spec can assert the list is empty and SAY which roof drifted when it is
  // not. Silence on drift is what board #293 was.
  function bodyDrift(env) {
    const rows = [];
    const scan = (items, resolve, kind) => items.forEach(item => {
      const derived = resolve(item, env);
      if (derived === undefined) return;          // geometry has no opinion
      if ((derived !== null) === (item.garage === true)) return;
      rows.push({ id: item.id, kind, stored: item.garage === true, geometry: derived !== null });
    });
    scan(env.roofs(), garageOfRoof, 'roof');
    scan(env.floors(), garageOfFloor, 'floor');
    return rows;
  }

  // ── WHERE A FLOOR ACTUALLY IS (board #292) ─────────────────────────────
  //
  // A floor-assembly band claims "there is a framed floor here". The old
  // rule took min..max of the crossing positions within one body, which is
  // only the same claim when the body is solid all the way across. For a U
  // or courtyard footprint the cut crosses the same body's walls with a real
  // GAP between the wings, and one band bridged the open courtyard -- a
  // framed floor drawn over open air, the same lie audit C5 fixed for
  // garages, now inside a single body.
  //
  // THE FLOOR POLYGON IS THE ANSWER, not a pairing of wall crossings. The
  // work order proposed pairing consecutive crossings enter/exit along u,
  // and on today's fixtures that works -- every wall in both is exterior.
  // It stops working the moment an interior wall exists: a cut through a
  // partitioned house yields three crossings, the pairing opens a gap under
  // the partition, and the band stops in the middle of a floor that is
  // really there. closets.js already builds interior walls.
  //
  // A floor polygon has no such problem in either direction: a courtyard has
  // no floor over it, and a partition does not touch the polygon at all. It
  // is also the semantic truth rather than a proxy for it -- the question
  // was always "is there a floor here", and floors() answers it.
  //
  // Even-odd along the cut, which is why a U yields two runs and a
  // rectangle one.

  const pointInPolygon = (pt, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const a = pts[i], b = pts[j];
      if ((a.z > pt.z) !== (b.z > pt.z)
        && pt.x < (b.x - a.x) * (pt.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };

  // The [s0,s1] parameter ranges along a->b that lie inside one polygon.
  const insideRanges = (a, b, pts) => {
    const hits = [];
    for (let i = 0; i < pts.length; i += 1) {
      const c = pts[i], d = pts[(i + 1) % pts.length];
      const denom = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
      if (Math.abs(denom) < 1e-9) continue;
      const s = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / denom;
      const t = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / denom;
      if (s < 0 || s > 1 || t < 0 || t > 1) continue;
      hits.push(s);
    }
    hits.sort((x, y) => x - y);
    // A cut through a VERTEX crosses two edges at the same parameter and
    // would toggle twice, turning a solid floor into two runs meeting at a
    // point. Collapse those before walking.
    const uniq = hits.filter((s, i) => i === 0 || s - hits[i - 1] > 1e-7);
    const ranges = [];
    let inside = pointInPolygon(a, pts);
    let start = inside ? 0 : null;
    uniq.forEach(s => {
      if (inside) { ranges.push([start, s]); inside = false; } else { start = s; inside = true; }
    });
    if (inside) ranges.push([start, 1]);
    return ranges;
  };

  // `runs` with the `holes` taken out, both merged u-runs.
  const subtractRuns = (runs, holes) => runs.flatMap(run => {
    let parts = [{ ...run }];
    holes.forEach(hole => {
      parts = parts.flatMap(part => {
        if (hole.max <= part.min || hole.min >= part.max) return [part];
        const out = [];
        if (hole.min > part.min) out.push({ min: part.min, max: hole.min });
        if (hole.max < part.max) out.push({ min: hole.max, max: part.max });
        return out;
      });
    });
    return parts;
  });

  // Merged u-runs where the cut lies over any of the given floor polygons.
  function floorRuns(cut, axis, floors) {
    const a = cut.startPt, b = cut.endPt;
    const uAt = s => (a.x + (b.x - a.x) * s) * axis.x + (a.z + (b.z - a.z) * s) * axis.z;
    const spans = [];
    floors.forEach(floor => {
      insideRanges(a, b, floor.points).forEach(([s0, s1]) => {
        const u0 = uAt(s0), u1 = uAt(s1);
        spans.push({ min: Math.min(u0, u1), max: Math.max(u0, u1) });
      });
    });
    spans.sort((x, y) => x.min - y.min);
    const merged = [];
    spans.forEach(span => {
      const last = merged[merged.length - 1];
      // Touching runs are one floor: two polygons meeting on a shared edge
      // are not a courtyard. Only a real opening survives this.
      if (last && span.min <= last.max + 0.01) last.max = Math.max(last.max, span.max);
      else merged.push({ ...span });
    });
    return merged;
  }

  // Where the cut segment crosses a wall centreline: the position along the
  // viewer's horizontal axis, the wall, and how far along the wall it lands
  // (for reading fenestrations at the crossing).
  function sectionWallCrossings(env, cut, axis) {
    const a = cut.startPt, b = cut.endPt;
    const crossings = [];
    // A wall belongs to the garage it lies on, not just to a level: garage
    // walls are stored on the SAME level as the house walls with only a body
    // marker, so anything spanning "the level" has to ask which building
    // (audit C5). The elevation path already groups this way.
    const garagesByLevel = {};
    const garageFor = wall => garageOfWall(wall, env, garagesByLevel);
    // Where a garage's own roof bears, once per garage: null when it has none.
    const roofBaseByGarage = new Map();
    const garageRoofBase = garage => {
      if (!roofBaseByGarage.has(garage)) {
        const roof = env.roofs().find(r => {
          const g = garageOfRoof(r, env);
          if (g !== undefined) return !!g && sameGarageBody(g, garage);
          // UNDECIDABLE BY SOURCE LINKS -- the premade build raises its roofs
          // without them -- so the stored flag says it is a garage roof and
          // where it stands says whose.
          const pts = r.points || [];
          if (r.garage !== true || pts.length < 3) return false;
          const mid = { x: pts.reduce((a, q) => a + q.x, 0) / pts.length,
            z: pts.reduce((a, q) => a + q.z, 0) / pts.length };
          return pointInPolygon(mid, garage.points || []);
        });
        roofBaseByGarage.set(garage, roof ? roofBaseElev(roof, stack, env) : null);
      }
      return roofBaseByGarage.get(garage);
    };
    env.walls().forEach(wall => {
      // BONEYARD shelf walls live on negative pseudo levels and are not in
      // the building at all.
      if (wall.levelId < 0) return;
      const c = wall.start, d = wall.end;
      const denom = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
      if (Math.abs(denom) < 1e-9) return;   // parallel — an elevation face, not a cut
      const s = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / denom;
      const t = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / denom;
      if (s < 0 || s > 1 || t < 0 || t > 1) return;
      const px = a.x + (b.x - a.x) * s, pz = a.z + (b.z - a.z) * s;
      const type = WALL_TYPES.find(w => w.id === wall.wallType);
      const wallLen = Math.hypot(d.x - c.x, d.z - c.z);
      // A skewed wall reads wider on the section — its thickness over the
      // sine of the crossing angle, capped so near-parallel walls stay sane.
      const cutLen = Math.hypot(b.x - a.x, b.z - a.z);
      const sin = Math.abs(denom) / (cutLen * wallLen || 1);
      const totalFt = (type ? type.totalIn : 5.5) / 12;
      const width = totalFt / Math.max(sin, 0.35);
      // The stored line is the wall's REFERENCE LINE, not its centre: an
      // exterior wall keeps the outline on its exterior face (refLine
      // 'left'/'right', render-2d.js's rule), so the band centre sits half
      // the thickness inside it, along the wall's own +normal (-dz, dx).
      const nx = -(d.z - c.z) / (wallLen || 1), nz = (d.x - c.x) / (wallLen || 1);
      const axisDotN = axis.x * nx + axis.z * nz;
      const ref = wall.refLine || 'center';
      const acrossMid = ref === 'left' ? totalFt / 2
        : ref === 'right' ? -totalFt / 2 : 0;
      const uShift = acrossMid / ((axisDotN < 0 ? -1 : 1)
        * Math.max(Math.abs(axisDotN), 0.35));
      crossings.push({
        wall, u: px * axis.x + pz * axis.z + uShift,
        width,
        alongWall: t * wallLen,
        garage: garageFor(wall),
      });
    });
    return crossings;
  }

  // The elevation a roof bears on: a garage roof carries its own plate
  // height over the main-floor line, so a garage beside a two-storey house
  // keeps a one-storey roof; every other roof sits on top of the full wall
  // stack.
  function roofBaseElev(roof, stack, env) {
    const plate = Number(roof.plateHeightFt);
    if (isGarageRoof(roof, env) && Number.isFinite(plate) && stack.floors.length) {
      return stack.floors[0].floorTop + plate;
    }
    // ON A SPLIT, A ROOF RAISED FROM A LEVEL BEARS ON THAT LEVEL'S CEILING. The
    // MOD BILEVEL's room over the garage sits 6'-3" over MAIN FL and carries
    // its own roof; at the house's bearing it would stand inside the room.
    if (stack.split && roof.sourceLevelId != null) {
      const own = stack.floors.find(level => Number(level.id) === Number(roof.sourceLevelId));
      if (own) return own.wallTop;
    }
    return stack.bearing;
  }

  // ── AND THE ELEVATION THE ROOF SURFACE STARTS FROM, WHICH IS NOT THAT ──
  //
  // `roofBaseElev` is where the roof BEARS -- the bottom of the fascia, the
  // soffit line. The sloping surface starts one fascia board higher, at the
  // eave, and `roofFaceRise`/`sectionRoofHeightAt` are measured from there.
  // So the elevation of a roof at a plan point is
  //
  //     roofEaveElev(roof, stack, env) + rise
  //
  // and this file spelled that `roofBaseElev(...) + ROOF_FASCIA_IN / 12` in
  // seven places, under four different local names (`base`, `top`, `eaveTop`,
  // and an inline sum).
  //
  // IT HAD ALSO ESCAPED THE FILE. MODEL hands auto-windows.js each roof's
  // `base` for the window-over-roof clearance, and handed it `roofBaseElev`
  // -- so the clearance was measured to a roof 5 1/2" lower than the one the
  // painter draws. Movie's own drawing shows exactly that: the dealer lifted
  // a second-floor sill 4" over the roof it was told about, and the garage
  // ridge still came up an inch and a half INSIDE the window. Two callers on
  // two pages were each assembling that sum themselves, which is two chances
  // to leave a term out and no way to see that one of them had.
  function roofEaveElev(roof, stack, env) {
    return roofBaseElev(roof, stack, env) + ROOF_FASCIA_IN / 12;
  }

  // ── A PILE OUT IN THE OPEN CARRIES A POST ──────────────────────────────
  //
  // Movie, 4 Oct, on EXT FINISH after pulling a roof out in BONEYARD: "a pile
  // was added under the roof i extended but no POST/ Column going from the
  // pile to the roof", then "when piles are generated also add a column to
  // the bottom of whatever is being supported", and "make the top of pile /
  // bottom of column level with the top of concrete".
  //
  // DERIVED, NOT STORED. A pile record is already a column on a pile footing
  // -- the post is that same column's shaft above the concrete, and what it
  // holds is a question the drawing answers every time it is asked: the
  // lowest floor or roof over its point. Stored, a second record would have
  // to follow every push, and every drawing made before today would stand
  // its piles bare.
  //
  // ONLY A PILE IN THE OPEN. One inside or on a foundation outline -- the
  // house's or the garage's -- stands under concrete, and what it carries is
  // the beam or the slab, not a post; the overhang ladder puts its piles
  // strictly outside the wall it pushes off. Tour-placed piles (`auto`) are
  // the garage's grade beam piles and are left alone.
  //
  // 6x6, 5 1/2" square, from the top of the concrete (the house's bearing
  // line less its sill plate) up to the underside of what it carries: a
  // floor's underside, or the roof's bearing line.
  const POST_SIZE_IN = 5.5;
  function pilePosts(env, stack) {
    if (!stack || !env || !env.columns) return [];
    const foot = stack.foundation.wallTop - houseSillPlateFt();
    const near = (p, pts, tol) => pts.some((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
      return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)) <= tol;
    });
    const over = (p, pts) => pointInPolygon(p, pts) || near(p, pts, 0.05);
    const floors = (env.floors() || []).filter(f => f.points && f.points.length >= 3);
    const concrete = floors.filter(f => (f.view || 'plan') === 'foundation');
    const decks = floors
      .filter(f => (f.view || 'plan') !== 'foundation' && !f.garage)
      .map(f => ({ pts: f.points, level: stack.floors.find(l => Number(l.id) === Number(f.levelId)) }))
      .filter(d => d.level);
    const roofs = (env.roofs() || []).filter(r => r.points && r.points.length >= 3);
    return env.columns()
      .filter(c => (c.view || 'plan') === 'foundation' && c.point && c.auto !== true
        && String(c.footing || '').startsWith('pile'))
      .map(column => {
        const p = column.point;
        if (concrete.some(f => over(p, f.points))) return null;
        const carried = [
          ...decks.filter(d => over(p, d.pts)).map(d => ({ top: d.level.floorBottom, levelId: d.level.id })),
          ...roofs.filter(r => over(p, r.points)).map(r => ({ top: roofBaseElev(r, stack, env), roof: r })),
        ];
        if (!carried.length) return null;
        const held = carried.reduce((low, c) => (c.top < low.top ? c : low));
        if (held.top <= foot + 0.01) return null;
        return { column, point: p, foot, top: held.top, sizeIn: POST_SIZE_IN,
          carries: held.roof ? 'roof' : 'floor', levelId: held.levelId ?? null };
      })
      .filter(Boolean);
  }

  // Roof surface height over a plan point, from the roof's REAL face
  // polygons (geometry-2d builds them off the straight skeleton): locate the
  // containing face, evaluate its plane. The old rule — min over every eave
  // edge's infinite line — carved phantom valleys through L/T/U footprints
  // wherever a far wing's eave line passed; a face only ever answers for
  // its own region. Callers doing many queries build the faces once and
  // pass them in.
  function sectionRoofHeightAt(pt, roof, faces = geo().roofFaces(roof, geo().roofSkeleton(roof))) {
    if (!roof.points || roof.points.length < 3) return null;
    for (const face of faces) {
      const poly = face.points;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const pi = poly[i], pj = poly[j];
        if ((pi.z > pt.z) !== (pj.z > pt.z)
          && pt.x < (pj.x - pi.x) * (pt.z - pi.z) / (pj.z - pi.z) + pi.x) inside = !inside;
      }
      if (inside) return geo().roofFaceRise(face, pt, roof.pitch || 4);
    }
    // A POINT ON THE OUTLINE IS ON THE ROOF. The crossing test is half-open,
    // so a point lying exactly on a face's boundary answers "outside" -- and a
    // wall's end corner is exactly that point wherever a roof dies flush into
    // a wall. The surface has a height there; only the parity rule does not.
    // Two faces sharing that edge carry the same height along it, so the first
    // one found is the answer either of them would give.
    //
    // AND IT IS REACHED ON EVERY MISS, which is most calls: a wall station
    // with open sky over it asks this question too, and so does every station
    // asked about a roof it does not stand under. Walking each face's edges
    // through pointToSegment for all of those cost SIX TIMES the whole
    // elevation paint over the sixteen fixtures -- 1.5 s to 9.8 s, and eight
    // seconds again on each of this file's mutants, which put the harness job
    // past its limit. Two boxes of plain arithmetic bring it back, and both
    // are exact: they drop only work that could not have answered.
    //
    // THE FOOTPRINT'S BOX FIRST, which is where nearly every miss ends. Every
    // face vertex is a footprint point, a point on a footprint edge, or an
    // interior skeleton node -- `roofFaces` builds them from exactly those --
    // so a point outside the footprint's box is on no face's edge. It is
    // taken HERE rather than at the top of the function because a point the
    // loop above answered never needed it, and that is the other half of the
    // calls.
    let rxLo = Infinity, rxHi = -Infinity, rzLo = Infinity, rzHi = -Infinity;
    for (let i = 0; i < roof.points.length; i++) {
      const p = roof.points[i];
      if (p.x < rxLo) rxLo = p.x;
      if (p.x > rxHi) rxHi = p.x;
      if (p.z < rzLo) rzLo = p.z;
      if (p.z > rzHi) rzHi = p.z;
    }
    if (pt.x < rxLo - 1e-6 || pt.x > rxHi + 1e-6
      || pt.z < rzLo - 1e-6 || pt.z > rzHi + 1e-6) return null;
    // THEN EACH EDGE'S OWN BOX. A point within 1e-6 of a segment is inside
    // that segment's box grown by 1e-6, so every edge whose distance could
    // have been small still reaches the test below. A face-wide box would not
    // do here: a hip or a rake is a diagonal, and most of its box is nowhere
    // near any of its edges.
    for (const face of faces) {
      const poly = face.points;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if (pt.x < Math.min(a.x, b.x) - 1e-6 || pt.x > Math.max(a.x, b.x) + 1e-6
          || pt.z < Math.min(a.z, b.z) - 1e-6 || pt.z > Math.max(a.z, b.z) + 1e-6) continue;
        if (geo().pointToSegment(pt, { start: a, end: b }).d > 1e-6) continue;
        return geo().roofFaceRise(face, pt, roof.pitch || 4);
      }
    }
    return null;
  }

  // A caller-owned fit (LAYOUT sheets) maps model feet to pixels at an exact
  // architectural scale: pxPerFt fixes the scale and extents fix the framing,
  // so the drawing lands on the sheet where the viewport says, not where the
  // screen-fit margins would centre it.
  // ── WHAT THIS PAINTER DRAWS IN, AND WHO CHOOSES IT ───────────────────
  //
  // Movie, 24 Sep, looking at an elevation on a night page: "would it be
  // possible to make the background of the elevations black when in NIGHT
  // mode?" -- then, answering himself, "or should we reverse the lines to
  // white? like on the PROJECT Sections?" The second, and the reason is
  // measurable rather than a preference: the wall faces here are FILLED, so a
  // black sky with black lines would keep the house and lose everything drawn
  // beside it -- the roof outline (the roof is not filled), the grade line
  // where it runs out past the building, the dashed footings below it.
  //
  // BUT THIS PAINTER IS SHARED, and that is the whole shape of the answer.
  // The Construction Layout draws these same elevations as viewports on a
  // sheet that gets PRINTED, and a printed sheet is white with near-black ink
  // whatever the lights in the room are doing. So the painter does not know
  // about skins: it takes its inks from whoever calls it, and the values
  // below -- which are exactly the literals this file carried until now --
  // are what it uses when nobody says otherwise. The sheet says nothing and
  // gets paper; the model space hands it the skin.
  //
  // THREE OF THESE ARE `r,g,b` TRIPLES rather than colours, because the
  // weights are what the drawing is made of: a truss chord is the same ink as
  // a wall at a different strength, and a table of fourteen finished colours
  // would let those drift apart. `line` is the only one spelled out, so that
  // full strength can be a shade off the pure ink if a skin needs it to be.
  const PAPER_INKS = Object.freeze({
    ground:    '#fafafa',      // the page the drawing sits on
    line:      '#1d1f20',      // the drawing's line at full strength
    ink:       '29,31,32',     // and the rgb its quieter weights are mixed from
    face:      '#fff',         // a blank surface seen flat: wall finish, rim, glass
    faceShade: '#e8e8ea',      // concrete seen in ELEVATION, one step under a face
    recess:    '#fafafa',      // an opening's face, a hair back from the wall's.
                               // NOT `ground`: the sheet passes white paper, and
                               // folding the two would sink every window into
                               // its wall on exactly the drawing that gets built
                               // from.
    concrete:  '150,150,155',  // poured concrete seen in SECTION
    assembly:  '89,128,166',   // the floor assembly band between storeys
  });

  // paperColor IS the ground, under the name the two callers already use. It
  // stays rather than being folded into `colors` because it is one fact with
  // one name, and two spellings of one fact is the drift this table exists to
  // stop.
  const inksFor = (opts) => {
    const out = { ...PAPER_INKS, ...(opts && opts.colors) };
    if (opts && opts.paperColor) out.ground = opts.paperColor;
    return out;
  };
  const weight = (triple, a) => `rgba(${triple},${a})`;

  // THE SKIN, TRANSLATED INTO THE EIGHT THINGS THIS PAINTER DRAWS.
  //
  // It lives here rather than in the model space because the MAPPING is the
  // painter's own knowledge -- which palette role is a wall face and which is
  // a concrete mass -- and because two callers need it: the sheet's cut view
  // and the rail's thumbnails, which are the same picture at two sizes and
  // must not be able to disagree.
  //
  // EVERY VALUE IS A ROLE. Nothing is invented, and that is the test this
  // mapping had to pass: if a thing this painter draws has no role, the
  // honest answer is to add one to palette.js where its contrast is measured
  // against every skin, not to pick a grey here that looks right on the one
  // skin I happen to have open.
  //
  // WHAT THE ROLES WERE CHOSEN FOR:
  //   face      draw-wall. Its own note in palette.js reads "the wall body --
  //             poche, not a signal. It is barely distinct from the page on
  //             BOTH skins on purpose (1.30 night, 1.12 day)", which is
  //             exactly what a wall face in elevation is -- and on day it
  //             resolves to #ffffff over a #f2f2f3 page, the same hair of
  //             difference #fff had over #fafafa here.
  //   line      draw-wall-edge, "the line that actually carries the wall".
  //             On DAY it is #1d1f20 -- this painter's own ink, unchanged --
  //             so the day skin's elevation comes out as it always was.
  //   faceShade surface-chip, which lands on #e4e4e6 on day against the
  //             #e8e8ea concrete has been drawn in here since it was written.
  //             On night it sits between the page and the wall face, so the
  //             materials still read in order: sky, then concrete, then
  //             finish.
  //   assembly  draw-floor-edge, and this one needs no argument: it is
  //             #5980a6 on all four skins, which is the literal this painter
  //             already used for the floor band.
  //   concrete  ink-quiet, the closest thing to the mid grey a section poche
  //             wants, at the weights the painter already applies.
  //
  // THE LINE AND THE INK MUST AGREE, and they do by construction rather than
  // by being kept in step: the triple is read back off the same role.
  const tripleOf = (css) => {
    const s = String(css).trim();
    const fn = s.match(/^rgba?\(([^)]+)\)$/i);
    if (fn) return fn[1].split(',').slice(0, 3).map(v => Math.round(parseFloat(v))).join(',');
    let hex = s.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length < 6) return '29,31,32';
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
  };

  // ONE ENTRY, KEYED ON THE SKIN OBJECT ITSELF. MODEL calls this on every
  // paint, and the work is three regex parses and an object build -- small,
  // but it is NEW work on a path that already has a frame budget with no
  // headroom (model-html-cut-views holds six section paints inside 16ms, and
  // this landed one run of four exactly on the line).
  //
  // IDENTITY IS A SAFE KEY HERE BECAUSE DraftPalette.resolve FREEZES what it
  // returns, so the same object can never come back meaning something else;
  // a skin change hands over a different object and the cache misses, which
  // is exactly when it should.
  let lastSkin = null;
  let lastInks = null;

  function inksFromSkin(skin) {
    if (!skin) return { ...PAPER_INKS };
    if (skin === lastSkin) return lastInks;
    lastSkin = skin;
    // FROZEN, which is what makes the cache above safe rather than merely
    // fast: the same object is handed to every caller, so one of them
    // tweaking a key in place would recolour everybody else's next paint.
    lastInks = Object.freeze({
      ground:    skin['surface-page'],
      line:      skin['draw-wall-edge'],
      ink:       tripleOf(skin['draw-wall-edge']),
      face:      skin['draw-wall'],
      faceShade: skin['surface-chip'],
      recess:    skin['surface-page'],
      concrete:  tripleOf(skin['ink-quiet']),
      assembly:  tripleOf(skin['draw-floor-edge']),
    });
    return lastInks;
  }

  const externalFit = opts =>
    (opts && Number.isFinite(opts.pxPerFt) && opts.pxPerFt > 0 ? opts : null);

  // The model-space extents a cut view will occupy: the cut's own span along
  // the viewing axis, and the vertical band from below the footings to above
  // the tallest roof. LAYOUT sizes a sheet viewport from these and hands them
  // back through fit.extents so the rectangle and the drawing agree exactly.
  // Screen-x in world terms: the viewer looks along -dir with +Y up, so right
  // on the paper is (dir.z, -dir.x) -- the cut line's own direction.
  //
  // ONE HOME, because this had four: twice here and twice in the elevation
  // harness. A host that wants to report what the section contains has to ask
  // the painter's own passes with the painter's own axis, or it reports the
  // other direction's answer and disagrees with the picture it sits under.
  function cutAxis(cut) {
    const dir = cut.dirVec;
    return { x: dir.z, z: -dir.x };
  }

  // ── THE WALL FACES AN ELEVATION SHOWS, AND HOW FAR OFF EACH ONE IS ────
  //
  // LIFTED OUT OF drawElevationView on 27 Sep, unchanged, because a second
  // caller arrived: the Real Estate Layout lets a drafter CLICK a wall on an
  // elevation to clad it, and a click has to land on the same face the paint
  // landed on. Computing that on the page would be a second answer to "which
  // wall is at this spot", and the first one to drift would be the one nobody
  // was measuring -- which is the reason `cutAxis` above says "ONE HOME,
  // because this had four".
  //
  // FAR FIRST, which is the painter's contract and now the picker's too. An
  // elevation is occlusion by paint ORDER: each opaque surface covers what
  // stands behind it, so the LAST face drawn at a spot is the one a drafter
  // sees and the one a click means. A picker walks this list backwards.
  //
  // FOUNDATION WALLS COME BACK SEPARATELY. They are not faces to be clad --
  // they are concrete, and what a drafter sees of them is whatever stands
  // above grade -- but the painter needs them in the same pass, so they are
  // returned rather than re-derived.
  function elevationFaces(env, cut, stack, axis) {
    const dir = cut.dirVec;
    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    const uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);
    const proj = pt => ({ u: pt.x * axis.x + pt.z * axis.z, d: pt.x * dir.x + pt.z * dir.z });
    const levelById = {};
    stack.floors.forEach(level => { levelById[level.id] = level; });
    // A plan wall lying on a garage outline belongs to that garage: it
    // stands on the garage's beam plate or slab, off the house floor stack.
    const garagesByLevel = {};
    const garageFor = wall => garageOfWall(wall, env, garagesByLevel);
    // Where a garage's own roof bears, once per garage: null when it has none.
    const roofBaseByGarage = new Map();
    const garageRoofBase = garage => {
      if (!roofBaseByGarage.has(garage)) {
        const roof = env.roofs().find(r => {
          const g = garageOfRoof(r, env);
          if (g !== undefined) return !!g && sameGarageBody(g, garage);
          // UNDECIDABLE BY SOURCE LINKS -- the premade build raises its roofs
          // without them -- so the stored flag says it is a garage roof and
          // where it stands says whose.
          const pts = r.points || [];
          if (r.garage !== true || pts.length < 3) return false;
          const mid = { x: pts.reduce((a, q) => a + q.x, 0) / pts.length,
            z: pts.reduce((a, q) => a + q.z, 0) / pts.length };
          return pointInPolygon(mid, garage.points || []);
        });
        roofBaseByGarage.set(garage, roof ? roofBaseElev(roof, stack, env) : null);
      }
      return roofBaseByGarage.get(garage);
    };
    const faces = [];
    const fdnFaces = [];
    const tagsGarage = env.walls().some(w => w.body === 'garage');
    env.walls().forEach(wall => {
      const p1 = proj(wall.start), p2 = proj(wall.end);
      if (Math.max(p1.u, p2.u) < uMin || Math.min(p1.u, p2.u) > uMax) return;
      if ((wall.view || 'plan') === 'foundation') {
        const type = WALL_TYPES.find(w => w.id === wall.wallType);
        fdnFaces.push({
          // ── THE WALL RECORD COMES WITH IT ─────────────────────────────
          //
          // Movie, 28 Sep: *"we also need the FOUNDATION to be clickable -
          // sometimes someone may want finish added to the side of foundation
          // too"*, and why: *"sometimes it will be needed on the side of a
          // house that has a walkout for instance"*.
          //
          // A FOUNDATION WALL IS A WALL, and it has always been one -- same
          // record, same `finish` and `finishBands` keys, differing only in
          // `view: 'foundation'`. What stopped a finish reaching it was this
          // list: it carried the GEOMETRY and dropped the record, so nothing
          // downstream could ask what the concrete wears or say what it
          // should. `faces` above has carried its `wall` from the start.
          wall,
          lo: Math.max(Math.min(p1.u, p2.u), uMin),
          hi: Math.min(Math.max(p1.u, p2.u), uMax),
          depth: (p1.d + p2.d) / 2,
          top: wall.topHeight, base: wall.baseHeight,
          wallIn: type ? type.totalIn : 8,
          bearing: wall.baseHeight <= 0.01,   // on a strip footing, not hung
          // WHOSE CONCRETE IT IS, for the sill plate on top of it: the house
          // bears on SILL_PLATE_IN, a garage on GARAGE_BEAM_PLATE_IN, and
          // the note at houseSillPlateFt is emphatic that those are the same
          // number for different reasons and must not be swapped.
          garage: garageFor(wall),
        });
        return;
      }
      const storey = levelById[wall.levelId];
      if (!storey || Math.abs(p2.u - p1.u) < 0.5) return;
      // A WALL TALLER THAN ITS STOREY reaches its own top. A bilevel's entry
      // front runs unbroken from the landing to MAIN FL's ceiling -- the foyer
      // is open over the landing -- and stopped at the ENTRY level's own
      // ceiling, under MAIN's floor, it left a hole in the front with the
      // back wall's windows showing through it. Only ever UP: a wall stored
      // shorter than its storey keeps the storey's top, as every one has.
      const ownTop = storey.floorTop + (Number(wall.topHeight) || 0);
      // A WALL THE GARAGE ONLY SHARES IS THE HOUSE'S, on a split. Movie, 4
      // Oct, on E1 of a BILEVEL + GARAGE: a line up the entry's edge above
      // the garage roof. The house front x 2..16 runs along the garage's
      // outline, so garageFor answered garage: the wall stood on the
      // garage's sill and stopped at the garage's plate, the house's back
      // wall showed through above it, and its end drew a line beside the
      // entry. Where the drawing tags its garage walls (`body: 'garage'`,
      // as every build since the tie does) only those are the garage's; an
      // untagged drawing keeps the geometry's answer.
      const split = SPLIT_TYPES.includes(envBuildType(env));
      const garage = split && tagsGarage && wall.body !== 'garage' ? null : garageFor(wall);
      let level = ownTop > storey.wallTop + 0.05 && storey.id === ENTRY_LEVEL_ID
        ? { ...storey, wallTop: ownTop } : storey;
      // ── A SPLIT'S GARAGE STOPS UNDER ITS OWN ROOF ────────────────────
      //
      // Movie, 3 Oct, on E4 of a MODIFIED BILEVEL: "the garage wall height
      // also extends too high up. it should only go to the underside of the
      // 2nd floor". The garage was drawn to MAIN FL's ceiling -- the storey
      // it is filed on, a whole storey above where it stops -- and stood a
      // wall over its own lean-to.
      //
      // ON A SPLIT THE GARAGE IS NOT THAT STOREY: it stands on the sill under
      // ENTRY, and its walls stop where its own roof bears -- under a room,
      // the OVER GARAGE floor's underside, which is where MODEL raises both
      // the walls and that roof. Asked of the ROOF rather than the walls'
      // stored height, because a bilevel saved before 3 Oct stored its garage
      // walls at the level default and bore its roof at the plate; the roof
      // is right on both. Every other house keeps the storey's top.
      //
      // AND OFF A SPLIT, WHEN THE GARAGE HAS A ROOF OF ITS OWN. Movie, 6 Oct:
      // the house and garage walls "should be different heights" -- a garage
      // roofed apart from the house bears at its own plate, so its walls stop
      // there; one roofed together with the house has no roof of its own and
      // keeps the storey's top, which is the same height by construction.
      if (garage) {
        const plate = garageRoofBase(garage);
        if (plate != null) level = { ...level, wallTop: plate };
      }
      faces.push({
        wall, u1: p1.u, u2: p2.u, depth: (p1.d + p2.d) / 2, level, garage,
      });
    });
    faces.sort((a, b) => a.depth - b.depth);   // viewer sits on +dir: far first
    return { faces, fdnFaces, garageFor, proj, uMin, uMax };
  }

  // ── AN ELEVATION RUNS OUT TO THE EAVES, NOT TO THE MARK'S ENDS ─────────
  //
  // Movie, 6 Oct, on a 4 ft overhang: the roof ends came out white with the
  // outlines stopping short. The four standard marks run the walls' extent
  // plus 2 ft (cut-marks.js autoElevationCuts), which is exactly a default
  // eave -- so every roof ever drawn fitted, and a longer one ran past the
  // window: its fill went on to the real corner while every line, the
  // fascia band and the silhouette, stopped at the window's edge.
  //
  // SO THE WINDOW TAKES IN EVERY ROOF, seen along the elevation's own axis.
  // Only ever wider, and ONLY FOR THE FOUR STANDARD MARKS (`auto`) -- the
  // ones sized off the walls. A cut the drafter placed by hand is the view
  // he chose: one drawn across the garage alone stays the garage alone.
  //
  // THE LINE ITSELF IS LENGTHENED, not just the window: the silhouette is
  // sampled from startPt to endPt and every other reader measures off the
  // same two points, so one longer line keeps them all in step.
  const reachingEaves = (env, cut, axis) => {
    if (cut?.auto !== true) return cut;
    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    let uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);
    (env.roofs() || []).forEach(roof => (roof.points || []).forEach(pt => {
      const u = pt.x * axis.x + pt.z * axis.z;
      if (Number.isFinite(u)) { uMin = Math.min(uMin, u); uMax = Math.max(uMax, u); }
    }));
    const forward = uB >= uA;
    const toStart = (forward ? uMin : uMax) - uA;
    const toEnd = (forward ? uMax : uMin) - uB;
    if (Math.abs(toStart) < 1e-9 && Math.abs(toEnd) < 1e-9) return cut;
    return {
      ...cut,
      startPt: { ...cut.startPt, x: cut.startPt.x + axis.x * toStart, z: cut.startPt.z + axis.z * toStart },
      endPt: { ...cut.endPt, x: cut.endPt.x + axis.x * toEnd, z: cut.endPt.z + axis.z * toEnd },
    };
  };

  function cutViewExtents(env, cut) {
    const stack = sectionLevelStack(env);
    if (!stack) return null;
    const axis = cutAxis(cut);
    if (!sectionWallCrossings(env, cut, axis).length) cut = reachingEaves(env, cut, axis);
    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    let roofTop = null;
    env.roofs().forEach(roof => {
      if (!roof.points || roof.points.length < 3) return;
      const base = roofEaveElev(roof, stack, env);
      geo().roofFaces(roof, geo().roofSkeleton(roof)).forEach(face => {
        face.points.forEach(pt => {
          const elev = base + geo().roofFaceRise(face, pt, roof.pitch || 4);
          if (roofTop === null || elev > roofTop) roofTop = elev;
        });
      });
    });
    // Two rectangles, not one. yTop/yBottom are what the SECTION painter
    // reserves: the object plus 2' of air above the ridge and below the
    // footing, which keeps a section's cut edges off its frame.
    //
    // yTopDrawn/yBottomDrawn are what an ELEVATION actually puts ink on:
    // the roof silhouette at the top (or the bearing line where no roof
    // covers the cut), and the footing bottom underneath — the buried
    // foundation IS drawn, dashed, below grade, so it stays in. The air
    // does not. A sheet sizing an elevation by the padded figure asks the
    // page for four feet it will never fill, which on a two-storey house
    // over a basement is the difference between 1/8" and 1/16".
    const bare = roofTop === null ? stack.bearing : Math.max(stack.bearing, roofTop);
    return {
      uMin: Math.min(uA, uB),
      uMax: Math.max(uA, uB),
      yTop: Math.max(stack.bearing + 4, roofTop === null ? -Infinity : roofTop + 2),
      yBottom: stack.foundation.footingBottom - 2,
      yTopDrawn: bare,
      yBottomDrawn: stack.foundation.footingBottom,
    };
  }

  // ── THE MARGINS A SCREEN FIT LEAVES ──────────────────────────────────────
  //
  // Movie, 22 Sep, on an elevation with both rails open: *"when the side menus
  // are open they cover the drawing in elevation, can we make the zoom for the
  // elevations so the house is a little smaller and there is more white around
  // the edges and sides so these menus when expanded don't cover it"*.
  //
  // THE CALLER SAYS HOW MUCH, because the caller is the only thing that knows
  // what is on top of the canvas. The rails are `position:fixed` overlays --
  // MODEL.html paints the full width underneath them -- and their widths are
  // CSS, bounded there and measured there. A number typed into this painter
  // would be a copy of that CSS, and the comment beside `max-width:277px`
  // already records what a near-miss costs: "An estimate that is nearly right
  // is a panel that nearly stays off the sheet."
  //
  // SO THE DEFAULTS ARE WHAT THIS FILE HAS ALWAYS USED, and a caller that
  // measures its own furniture passes more. An external fit (LAYOUT's sheet
  // viewports) still takes none: the paper decides there, not the screen.
  const SCREEN_MARGINS = Object.freeze({ left: 64, right: 24, top: 30, bottom: 16 });
  const screenMargins = (opts, w) => {
    const want = (opts && opts.margins) || null;
    const at = side => {
      // `want == null` RATHER THAN A FALSY TEST: Number(null) is 0, so a
      // caller handing over no measurement at all would otherwise read as one
      // asking for nothing -- the same answer by luck of the floor below, and
      // the wrong reason to be right.
      const asked = want == null ? NaN : Number(want[side]);
      // THE FURNITURE'S BOX PLUS THE DRAWING'S OWN INSET, not the greater of
      // the two -- and the difference is a whole row of numbers.
      //
      // Movie, 25 Sep: "of the left the elevation numbers, can you bring
      // those to the right so they aren't covered by the side menu when it is
      // open".
      //
      // WHAT SCREEN_MARGINS.left IS FOR. 64px is not white space: the level
      // marks are drawn OUTSIDE the drawing on that side, the rule at
      // marginL-18 and the reading right-aligned at marginL-22, which with a
      // label like -12'-11 3/4" at 34px puts its left edge 56px in. The left
      // margin IS the marks' gutter and always has been.
      //
      // SO A MAX SPENT THE GUTTER TWICE. A rail asking for 200px of cover got
      // max(64, 200) = 200, the drawing started at 200, and the marks were
      // drawn back out to 144 -- inside the rail, under the panel, exactly
      // what he is looking at. The two numbers answer different questions --
      // "how much canvas is the furniture sitting on" and "how far in from
      // its own edge does this drawing start" -- and questions that different
      // compose rather than compete.
      //
      // BOTH SIDES, because the right has the same shape without the marks:
      // max() drew the elevation flush against the right rail where it has a
      // 24px inset from every other edge it meets.
      //
      // THE HALF-CANVAS CAP BELOW IS WHAT KEEPS THIS HONEST on a narrow
      // screen -- it scales back the EXTRA over these defaults, so the sum
      // can ask for more without being able to take more.
      if (!(Number.isFinite(asked) && asked > 0)) return SCREEN_MARGINS[side];
      // EXCEPT AT THE BOTTOM, WHERE THE FURNITURE'S EDGE IS THE FRAME.
      //
      // Movie, 26 Sep, looking at the first cut of this with the foot bar
      // reserved and the drawing sitting SCREEN_MARGINS.bottom above it:
      // "could be even closer to the 'tint line (less gap) maybe move it to
      // 75% closer (25% gap size)", and then what he actually wanted: "make
      // it look like the footing is just about resting on one inch of dirt
      // and then the tint starts".
      //
      // THE SUM IS RIGHT ON THE SIDES FOR A REASON THE BOTTOM HAS NOT GOT.
      // `SCREEN_MARGINS.left` is not white space -- the level marks are drawn
      // OUTSIDE the drawing in it, right-aligned at `marginL - 22` -- so a
      // rail's box and the marks' gutter are two different claims on the same
      // strip and they compose. The right mirrors it for the datum tails, and
      // the top holds the sheet's header. NOTHING IS DRAWN BELOW THE DRAWING.
      // The bottom default is pure inset from a bare canvas edge, and against
      // furniture the drafter wants the sheet tucked under it rather than
      // floating an unrelated 16px off it.
      //
      // AND THE CLEARANCE ITSELF IS NOT A PIXEL COUNT. It is an inch of
      // ground under the footing, spent in `yFit` where the extent is decided,
      // so it stays an inch at any window size or scale instead of being three
      // and a half inches on a laptop and half of one on a sheet.
      return side === 'bottom' ? asked : SCREEN_MARGINS[side] + asked;
    };
    // AND NEVER MORE THAN HALF THE CANVAS TO THE FURNITURE. MODEL.html's two
    // rails ask for about 540px between them on this page's own CSS, which is
    // white space on a wide screen and most of a narrow one -- honoured
    // literally at 800px it would leave the drawing 260px to stand in, and at
    // 600px a sliver. What the asker wants is not to be covered; what the
    // drafter wants is to see the house, and past halfway the second wins.
    //
    // WHAT IS SCALED BACK IS THE EXTRA, proportionally and on both sides at
    // once, so the drawing still sits toward whichever side has the room. The
    // painter's own defaults are the floor and are never eaten into: they are
    // the inset every elevation has always had, furniture or none.
    const asked = { left: at('left'), right: at('right') };
    const room = Math.max(0, Number(w) || 0) / 2;
    const base = SCREEN_MARGINS.left + SCREEN_MARGINS.right;
    const over = asked.left + asked.right - base;
    // `Math.min(1, ...)` IS THE CAP AND ALSO THE "ONLY WHEN IT BITES" TEST:
    // an ask that already fits leaves `over` no larger than `room - base`, so
    // the ratio is at least 1 and nothing is scaled. Without it this would
    // WIDEN a margin that fits, out to exactly half the canvas every time.
    const k = over > 0 ? Math.min(1, Math.max(0, room - base) / over) : 1;
    return {
      left: SCREEN_MARGINS.left + (asked.left - SCREEN_MARGINS.left) * k,
      right: SCREEN_MARGINS.right + (asked.right - SCREEN_MARGINS.right) * k,
      top: at('top'), bottom: at('bottom'),
    };
  };

  // ── THE DRAFTER'S OWN LINES AND NOTES ON AN ELEVATION ─────────────────────
  //
  // Movie, 5 Oct: "i'd like to be able to also draw lines and add annotations
  // to the elevations" -- a note in plain text, or with a leader arrow ("Both"),
  // and on the LAYOUT sheets too ("Yes").
  //
  // STORED IN THE ELEVATION'S OWN FEET: `u` along the cut, `e` the elevation,
  // the two numbers every other line on this sheet is placed by -- so a mark
  // stays where it was put at any zoom and on any sheet scale. Painted LAST,
  // over the building, by whichever page draws the view: the sheet and the
  // model ask the same env for the same list (`elevationMarks(cut.name)`).
  //
  // AND THE FRAME GOES BACK OUT (`opts.onFrame`), the one place a page can
  // learn where a foot of this drawing landed, so a press can be read in feet.
  function paintElevationMarks(env, ctx, cut, X, Y, pxPerFt, C, opts, frame) {
    if (opts && typeof opts.onFrame === 'function') opts.onFrame(frame);
    const marks = (env && typeof env.elevationMarks === 'function'
      ? env.elevationMarks(cut.name) : null) || [];
    const selected = opts && opts.selectedMark;
    const live = opts && opts.markPreview;
    const all = live ? marks.concat([live]) : marks;
    if (!all.length) return;
    const ink = C.line;
    const textPx = Math.max(9, Math.min(16, pxPerFt * 0.55));
    ctx.save();
    all.forEach(m => {
      const hot = selected && m.id && m.id === selected;
      ctx.strokeStyle = hot ? ((opts && opts.selectColor) || '#2f6fd6') : ink;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = hot ? 2 : 1.25;
      ctx.setLineDash(m === live ? [5, 4] : []);
      if (m.kind === 'line' && m.a && m.b) {
        ctx.beginPath();
        ctx.moveTo(X(m.a.u), Y(m.a.e));
        ctx.lineTo(X(m.b.u), Y(m.b.e));
        ctx.stroke();
        return;
      }
      if (m.kind !== 'note' || !m.at) return;
      const tx = X(m.at.u), ty = Y(m.at.e);
      const text = String(m.text || '');
      ctx.font = `600 ${textPx}px 'Barlow Condensed', system-ui, sans-serif`;
      const width = ctx.measureText(text).width;
      if (m.tip) {
        const px = X(m.tip.u), py = Y(m.tip.e);
        // The leader lands on the near end of the text, at its middle.
        const toRight = px >= tx + width / 2;
        const lx = toRight ? tx + width + 3 : tx - 3;
        ctx.beginPath(); ctx.moveTo(lx, ty); ctx.lineTo(px, py); ctx.stroke();
        // A STRAIGHT END is the line alone (Movie, 6 Oct); the arrowhead is
        // for a note that asked for one, or was drawn before the choice.
        if (m.end !== 'line') {
          const ang = Math.atan2(py - ty, px - lx), head = Math.max(6, textPx * 0.6);
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - head * Math.cos(ang - 0.35), py - head * Math.sin(ang - 0.35));
          ctx.lineTo(px - head * Math.cos(ang + 0.35), py - head * Math.sin(ang + 0.35));
          ctx.closePath(); ctx.fill();
        }
      }
      if (text) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, tx, ty);
      }
    });
    ctx.restore();
  }

  function drawCutView(env, ctx, w, h, cut, opts) {
    const fit = externalFit(opts);
    const C = inksFor(opts);
    const ink = a => weight(C.ink, a);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, w, h);
    const stack = sectionLevelStack(env);
    const axis = cutAxis(cut);
    const header = (label) => {
      if (fit) return;   // the sheet captions its viewports itself
      ctx.fillStyle = ink(0.55);
      ctx.font = "600 10px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(label, 10, 8);
    };
    if (!stack) { header(cut.name); return; }
    const crossings = sectionWallCrossings(env, cut, axis);
    if (!crossings.length) {
      // Standing outside the model looking at it: an elevation, not a section.
      if (drawElevationView(env, ctx, w, h, cut, stack, axis, header, opts)) return;
      header(cut.name);
      ctx.fillStyle = ink(0.55);
      ctx.font = "600 13px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('The cut line crosses no walls — draw it through the plan.', w / 2, h / 2);
      return;
    }

    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    const uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);

    // Roof profile along the cut, EXACT: each roof's face polygons clipped
    // by the cut segment (breakpoints only — straight between them at any
    // cut angle), the roofs merged as an upper envelope. No sampling, so a
    // diagonal cut is as clean as an axis-aligned one.
    const roofSamples = [];
    const roofChords = [];
    const roofs = env.roofs();
    const fasciaFt = ROOF_FASCIA_IN / 12;
    if (roofs.length) {
      const profiles = [];
      roofs
        .filter(roof => roof.points && roof.points.length >= 3)
        .forEach(roof => {
          const base = roofBaseElev(roof, stack, env);
          const profile = geo().roofProfile(
            roof, geo().roofFaces(roof, geo().roofSkeleton(roof)),
            cut.startPt, cut.endPt, axis)
            .map(pt => ({ u: pt.u, rise: base + fasciaFt + pt.rise }));
          if (profile.length < 2) return;
          profiles.push(profile);
          roofChords.push({
            u0: profile[0].u, u1: profile[profile.length - 1].u, elev: base,
            profile, overhang: Number(roof.overhang) || 0,
          });
        });
      geo().profileEnvelope(profiles).forEach(pt => {
        roofSamples.push({ u: pt.u, elev: pt.rise, resume: !!pt.resume, noDrop: !!pt.noDrop });
      });
    }

    const yTop = fit?.extents ? fit.extents.yTop
      : Math.max(stack.bearing + 2,
        ...roofSamples.filter(s => s.elev != null).map(s => s.elev))
        + SKY_ABOVE_ROOF_FT;
    const yBottom = fit?.extents ? fit.extents.yBottom : stack.foundation.footingBottom - 2;
    const mg = screenMargins(opts, w);
    const marginL = fit ? 0 : mg.left, marginR = fit ? 0 : mg.right,
      marginT = fit ? 0 : mg.top, marginB = fit ? 0 : mg.bottom;
    const pxPerFt = fit ? fit.pxPerFt : Math.max(2, Math.min(
      (w - marginL - marginR) / Math.max(uMax - uMin, 4),
      (h - marginT - marginB) / Math.max(yTop - yBottom, 8)));
    const x0 = marginL + ((w - marginL - marginR) - (uMax - uMin) * pxPerFt) / 2;
    const y0 = marginT + ((h - marginT - marginB) - (yTop - yBottom) * pxPerFt) / 2;
    const X = u => x0 + (u - uMin) * pxPerFt;
    const Y = e => y0 + (yTop - e) * pxPerFt;

    const INK = C.line;
    header(`${cut.name} — GENERATED SECTION · ${env.ftIn(uMax - uMin)} CUT`);

    // Elevation marks down the left margin, on the level-card datum.
    const datum = env.elevationDatum();
    const mark = (elevFt, label) => {
      ctx.strokeStyle = ink(0.25); ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(marginL - 18, Y(elevFt)); ctx.lineTo(w - marginR, Y(elevFt));
      ctx.stroke();
      ctx.fillStyle = ink(0.6);
      ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(label ?? env.elevLabel(elevFt + datum), marginL - 22, Y(elevFt));
    };
    stack.floors.forEach(level => { mark(level.floorTop); mark(level.wallTop); });
    mark(stack.foundation.grade, 'GRADE');
    mark(stack.foundation.slabTop);
    mark(stack.foundation.footingBottom);

    // Level extents: the floor-assembly band spans the outermost walls of
    // the HOUSE it crosses — never the garage's (audit C5). A garage is a
    // slab on grade, so a band drawn across it claimed a framed floor and an
    // open storey underneath; with a detached garage the same band ran
    // across the open ground between the two buildings.
    // RUNS, not one span. floorRuns answers from the level's own floor
    // polygon; the crossings answer only when the level has no floor to ask
    // -- an older or hand-built drawing -- and that fallback is the OLD
    // min..max, named here rather than left as a silent default so a
    // courtyard drawn without floors is a known limit and not a surprise.
    const levelRuns = levelId => {
      const polys = env.floors().filter(floor => floor.levelId === levelId
        && !floor.garage && (floor.view || 'plan') !== 'foundation'
        && (floor.points || []).length >= 3);
      if (polys.length) {
        const runs = floorRuns(cut, axis, polys);
        // THE STAIRWELL IS A HOLE IN THE FLOOR, and a section through the
        // stair shows it: the band stops at the opening's edges.
        const holes = typeof env.floorOpenings === 'function'
          ? polys.flatMap(floor => env.floorOpenings(floor.id) || [])
            .filter(hole => (hole.points || []).length >= 3)
          : [];
        if (runs.length) return holes.length ? subtractRuns(runs, floorRuns(cut, axis, holes)) : runs;
      }
      const us = crossings
        .filter(c => c.wall.levelId === levelId && !c.garage)
        .map(c => c.u);
      return us.length ? [{ min: Math.min(...us), max: Math.max(...us) }] : [];
    };

    // Foundation first: each crossed wall at its own heights — a basement
    // wall runs grade to footing, a hung garage grade beam is just its band.
    // Footings belong to walls that bear at the bottom of the excavation.
    const fdn = stack.foundation;
    const fdnCrossings = crossings.filter(c => (c.wall.view || 'plan') === 'foundation');
    // ── A PLAN POINT FROM A STATION ON THE CUT ──────────────────────────
    //
    // The garage floor falls toward its door, so anything that asks where the
    // floor is has to ask about a PLACE, not a station -- and a cut running
    // into the garage crosses that fall. `u` is affine along the cut line, so
    // inverting it is the same interpolation the projection is.
    const ptAtU = (u) => {
      const span = uB - uA;
      const t = Math.abs(span) < 1e-9 ? 0 : (u - uA) / span;
      return { x: cut.startPt.x + (cut.endPt.x - cut.startPt.x) * t,
        z: cut.startPt.z + (cut.endPt.z - cut.startPt.z) * t };
    };
    // ── WHERE THE CUT PASSES A GARAGE DOOR, THE CONCRETE IS BUCKED OUT ──
    //
    // Movie, 26 Sep: *"the slab will always 'pour over the 1ft door buck and
    // fil in the extra space"*, and on the datum: *"it should be measured from
    // top of concrete (1ft down from top of concrete)"* -- *"1 ft down
    // default"*. The elevation has drawn the part of that void the slab did
    // not fill since board #45's first half; this is the same void seen from
    // the side, where what shows is the whole foot of it.
    //
    // MATCHED BY PLACE, NOT BY ID, for the reason the elevation's `bucks` list
    // gives: a door is a fenestration on a MAIN FLOOR wall and the concrete
    // under it is a FOUNDATION wall, two records at one spot with no reference
    // between them. Here both are already in `crossings`, so the question is
    // just which plan crossing stands over this foundation one -- a foot of
    // slack on `u`, the same slack `bucksOf` carries on depth, because a
    // wall's concrete and the wall on it agree to within their own thickness.
    const doorAt = (c) => {
      if (!c.garage) return null;
      const over = crossings.find(p => (p.wall.view || 'plan') === 'plan'
        && sameGarageBody(p.garage, c.garage) && Math.abs(p.u - c.u) < 1
        && env.fenestrations().some(f => f.wallId === p.wall.id
          && (f.type || f.kind) === 'door'
          && Math.abs(p.alongWall - f.offset) < f.width / 2));
      return over || null;
    };
    // The buck's own extent in a section is the BEAM's width, not the door's:
    // the cut runs across the wall, so the foot-deep pocket formed in the top
    // of it is as wide here as the concrete it is formed out of.
    const buckFloor = g => garageConcreteTop(env, fdn, g) - GARAGE_DOOR_BUCK_IN / 12;
    const bucks = fdnCrossings.map(c => (doorAt(c) ? {
      lo: c.u - c.width / 2, hi: c.u + c.width / 2, garage: c.garage,
      floor: buckFloor(c.garage),
    } : null)).filter(Boolean);
    const buckAt = (u) => bucks.find(b => u > b.lo - 1e-6 && u < b.hi + 1e-6) || null;
    fdnCrossings.forEach(c => {
      // THE BUCK COMES OFF THE TOP, so the concrete drawn here is only what is
      // left under it. The slab poured over it fills the rest and is drawn by
      // the floor pass below, which dips into the same void.
      const buck = doorAt(c) ? buckFloor(c.garage) : null;
      const top = buck != null ? buck : fdn.wallBottom + c.wall.topHeight;
      const base = fdn.wallBottom + c.wall.baseHeight;
      ctx.fillStyle = weight(C.concrete, 0.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      const x = X(c.u - c.width / 2), wid = c.width * pxPerFt;
      ctx.fillRect(x, Y(top), wid, (top - base) * pxPerFt);
      ctx.strokeRect(x, Y(top), wid, (top - base) * pxPerFt);
      // ── AND THE TOP THE BUCK CAME OUT OF, DRAWN LIGHT ────────────────
      //
      // Movie, 26 Sep: *"maybe also show the top of the grade beam in the
      // background with not as dark lines (for reference)"*.
      //
      // IT IS A BEYOND LINE. The pocket is only as long as the door: past
      // either jamb the beam runs on at its full height, so what the cut
      // exposes at a buck is a view PAST the void to the concrete behind it.
      // Without it the beam simply reads as a shorter beam, and a drafter has
      // nothing on the sheet to measure the foot of buck against.
      //
      // LIGHT, AND FOR THE REASON A BEYOND LINE ALWAYS IS: this edge is not
      // ON the cut. The same ink weight as the pour's own outline would put a
      // second top of concrete on the drawing at equal authority.
      if (buck != null) {
        ctx.strokeStyle = ink(0.35); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, Y(garageConcreteTop(env, fdn, c.garage)));
        ctx.lineTo(x + wid, Y(garageConcreteTop(env, fdn, c.garage)));
        ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      }
      if (c.wall.baseHeight <= 0.01) {
        const fw = fdn.footingWidthIn / 12;
        const fx = X(c.u - fw / 2), fwid = fw * pxPerFt;
        ctx.fillRect(fx, Y(base), fwid, (fdn.footingIn / 12) * pxPerFt);
        ctx.strokeRect(fx, Y(base), fwid, (fdn.footingIn / 12) * pxPerFt);
      }
    });
    // The house slab spans the HOUSE's bearing walls. A frost-wall garage
    // bears too, but its slab is its own, higher and sloped, so its
    // crossings are kept out of the house span and drawn below.
    const bearingCrossings = fdnCrossings.filter(c => c.wall.baseHeight <= 0.01 && !c.garage);
    // The house slab, by the same rule as the floors above: its own polygon
    // where there is one, the bearing crossings where there is not. The
    // garage slab is a separate polygon, already flagged, and stays out.
    const slabPolys = env.floors().filter(floor => floor.levelId === 1
      && !floor.garage && (floor.view || 'plan') === 'foundation'
      && (floor.points || []).length >= 3);
    const fdnRuns = slabPolys.length ? floorRuns(cut, axis, slabPolys) : [];
    const fdnSpans = fdnRuns.length ? fdnRuns
      : (bearingCrossings.length
        ? [{ min: Math.min(...bearingCrossings.map(c => c.u)), max: Math.max(...bearingCrossings.map(c => c.u)) }]
        : []);
    fdnSpans.forEach(fdnSpan => {
      if (fdnSpan.max - fdnSpan.min <= 1) return;
      ctx.fillStyle = weight(C.concrete, 0.35);
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      const x = X(fdnSpan.min), wid = (fdnSpan.max - fdnSpan.min) * pxPerFt;
      ctx.fillRect(x, Y(fdn.slabTop), wid, (fdn.slabIn / 12) * pxPerFt);
      ctx.strokeRect(x, Y(fdn.slabTop), wid, (fdn.slabIn / 12) * pxPerFt);
    });
    // ── THE GARAGE FLOOR ALONG THE CUT ──────────────────────────────────
    //
    // A slab of one thickness whose TOP is measured down from the top of the
    // concrete -- so it FALLS toward the door, and on a cut that runs into the
    // garage it is a wedge rather than a band. Both floor passes below drew it
    // with a `fillRect` off a single level, and the level they used is the fall
    // at 32 ft in: right at one station, and out by up to 4" everywhere else.
    // The note at garageFloorAt has Movie's correction and the table.
    //
    // AND IT FILLS THE BUCK. *"the slab will always 'pour over the 1ft door
    // buck and fil in the extra space"* -- so across a door the underside drops
    // to the bottom of the void and the slab is locally as deep as it takes. At
    // the overhead door that comes out exact rather than close: 8" of fall plus
    // a 4" slab IS the foot of buck, which is the *"4" slab filling the 4" gap
    // between door and door buck"* he described from the other end.
    //
    // A POLYGON WALKED OUT AND BACK rather than two edges computed apart, so
    // the top and the underside cannot disagree about where the floor is.
    const floorTopPts = (garage, lo, hi) => {
      const F = u => garageFloorAt(env, fdn, garage, ptAtU(u));
      // SOLVED, NOT SAMPLED. The fall is linear in how far in you are and flat
      // outside both ends of that run -- level with the pour past
      // GARAGE_SLAB_FLAT_AT_FT, and held at the door's own drop outside the
      // door, where the buck is. So the top edge has at most two corners, both
      // at a known DEPTH, and depth is affine along the cut: interpolate for
      // the station and keep it if it lands in the span.
      //
      // A sampled edge cannot do this. It rounds a corner off to its step --
      // right at the door, which is the one place a drafter reads this floor.
      const D = u => garageDepthFt(env, garage, ptAtU(u));
      const d0 = D(lo), d1 = D(hi);
      const stations = [lo, hi];
      [0, GARAGE_SLAB_FLAT_AT_FT].forEach(d => {
        if (Math.abs(d1 - d0) < 1e-9) return;
        const u = lo + (hi - lo) * ((d - d0) / (d1 - d0));
        if (u > lo + 1e-6 && u < hi - 1e-6) stations.push(u);
      });
      stations.sort((a, b) => a - b);
      return stations.map(u => ({ u, e: F(u) }));
    };
    // The underside: one slab thickness under the fall, dropping to the bottom
    // of the void wherever the cut passes a door. Cut at every buck edge that
    // falls inside the span, and the two elevations at a shared edge are the
    // vertical face of the step.
    const floorUnderPts = (garage, lo, hi) => {
      const U = u => garageFloorAt(env, fdn, garage, ptAtU(u)) - GARAGE_SLAB_THICKNESS_IN / 12;
      const stops = [lo, hi];
      bucks.forEach(b => [b.lo, b.hi].forEach(u => {
        if (u > lo + 1e-6 && u < hi - 1e-6) stops.push(u);
      }));
      stops.sort((a, b) => a - b);
      const out = [];
      for (let i = 0; i < stops.length - 1; i += 1) {
        const a = stops[i], b = stops[i + 1];
        const buck = buckAt((a + b) / 2);
        const ea = buck ? buck.floor : U(a);
        const eb = buck ? buck.floor : U(b);
        const last = out[out.length - 1];
        if (!last || Math.abs(last.u - a) > 1e-6 || Math.abs(last.e - ea) > 1e-6) {
          out.push({ u: a, e: ea });
        }
        out.push({ u: b, e: eb });
      }
      return out;
    };
    // THE BUCK IS OUTBOARD OF THE GARAGE BODY, formed in the top of the beam
    // whose outer face IS the outline, so the span the floor is asked for does
    // not reach it. The slab does, so the span grows to the void it fills.
    const withBucks = (lo, hi) => bucks.reduce((sp, b) => ({
      lo: Math.max(uMin, Math.min(sp.lo, b.lo)),
      hi: Math.min(uMax, Math.max(sp.hi, b.hi)),
    }), { lo, hi });
    const paintGarageFloor = (garage, lo0, hi0) => {
      const { lo, hi } = withBucks(lo0, hi0);
      const tops = floorTopPts(garage, lo, hi);
      const unders = floorUnderPts(garage, lo, hi);
      ctx.fillStyle = weight(C.concrete, 0.35);
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath();
      tops.forEach((q, i) => (i ? ctx.lineTo(X(q.u), Y(q.e)) : ctx.moveTo(X(q.u), Y(q.e))));
      unders.slice().reverse().forEach(q => ctx.lineTo(X(q.u), Y(q.e)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return { lo, hi };
    };
    // A frost-wall garage's slab, between the garage's own bearing walls.
    const frostGarages = [...new Set(fdnCrossings
      .filter(c => c.garage && c.wall.baseHeight <= 0.01 && env.garageFoundation(c.garage) === 'frostwall')
      .map(c => c.garage))];
    frostGarages.forEach(garage => {
      const us = fdnCrossings.filter(c => c.garage === garage).map(c => c.u);
      if (us.length < 2 || Math.max(...us) - Math.min(...us) <= 1) return;
      paintGarageFloor(garage, Math.min(...us), Math.max(...us));
    });

    // Hung grade beams carry a slab poured over the plate on graded fill:
    // the 4" garage slab, its under-slab line dashed, gravel dotted below —
    // section detail only, elevations keep just the buried outline.
    const beamCrossings = fdnCrossings.filter(c => c.wall.baseHeight > 0.01);
    if (beamCrossings.length) {
      // The slab spans its GARAGE, not the pair of legs the cut happened to
      // clip (audit C5): a cut through a single grade-beam leg used to draw
      // no slab at all, leaving the band above it standing over nothing.
      // Project the garage's own outline onto the cut axis and clip that to
      // the cut; fall back to the crossings when the body is unknown.
      const garage = beamCrossings.map(c => c.garage).find(Boolean);
      const outlineUs = garage
        ? garage.points.map(pt => pt.x * axis.x + pt.z * axis.z)
        : [];
      const lo = outlineUs.length
        ? Math.max(uMin, Math.min(...outlineUs))
        : Math.min(...beamCrossings.map(c => c.u));
      const hi = outlineUs.length
        ? Math.min(uMax, Math.max(...outlineUs))
        : Math.max(...beamCrossings.map(c => c.u));
      if (hi - lo > 1) {
        // ONE DATUM. The stored wall is the fallback for a crossing whose
        // body is unknown, and it answers by the same rule -- the beam's top
        // of concrete less the fall at that point -- rather than a second
        // arrangement. It cannot slope, having no body to measure the fall
        // from, so it answers the level it always did.
        const under = (u) => (garage
          ? garageFloorAt(env, fdn, garage, ptAtU(u))
          : fdn.wallBottom + Math.max(...beamCrossings.map(c => c.wall.topHeight)))
          - GARAGE_SLAB_THICKNESS_IN / 12;
        const span = garage ? paintGarageFloor(garage, lo, hi) : (() => {
          const top = fdn.wallBottom + Math.max(...beamCrossings.map(c => c.wall.topHeight))
            - GARAGE_SLAB_THICKNESS_IN / 12;
          ctx.fillStyle = weight(C.concrete, 0.35);
          ctx.strokeStyle = INK; ctx.lineWidth = 1;
          ctx.fillRect(X(lo), Y(top), (hi - lo) * pxPerFt, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
          ctx.strokeRect(X(lo), Y(top), (hi - lo) * pxPerFt, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
          return { lo, hi };
        })();
        // THE GRAVEL HANGS OFF THE SLAB, NOT OFF THE PLATE. It was measured
        // down from the sill plate top, which worked only while the slab was
        // drawn a slab ABOVE that plate. With the floor below that plate the
        // "under-slab" line would have been struck INSIDE the slab. Same
        // detail, same offsets, hung off the one thing it describes the
        // underside of -- and now following it down, because the graded fill
        // under a sloping slab slopes with it.
        //
        // THE FILL LINE IGNORES THE BUCKS. What is under a buck is the beam it
        // was formed out of, not fill, so the line that describes the top of
        // the gravel runs past a door at the slab's own thickness.
        ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(X(span.lo), Y(under(span.lo) - 0.5));
        ctx.lineTo(X(span.hi), Y(under(span.hi) - 0.5));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ink(0.45);
        for (let g = span.lo + 0.5; g < span.hi - 0.25; g += 0.75) {
          const j = (g * 7.3) % 1;   // deterministic jitter, no flicker on redraw
          ctx.beginPath();
          ctx.arc(X(g + j * 0.3), Y(under(g) - 0.1 - j * 0.32), 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Grade, heavy, running off the sheet on both sides of the building.
    if (crossings.length) {
      const uLo = Math.min(...crossings.map(c => c.u - c.width / 2));
      const uHi = Math.max(...crossings.map(c => c.u + c.width / 2));
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginL - 18, Y(fdn.grade)); ctx.lineTo(X(uLo), Y(fdn.grade));
      ctx.moveTo(X(uHi), Y(fdn.grade)); ctx.lineTo(w - marginR, Y(fdn.grade));
      ctx.stroke();
    }

    // Floor levels: assembly band, then the crossed walls standing on it.
    stack.floors.forEach(level => {
      // ONE BAND PER RUN. A U-shaped storey wears two, with the courtyard
      // between them left as the open air it is.
      const runs = levelRuns(level.id);
      (runs.length ? runs : fdnSpans).forEach(span => {
        if (span.max - span.min <= 0.5) return;
        ctx.fillStyle = weight(C.assembly, 0.15);
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        const x = X(span.min), wid = (span.max - span.min) * pxPerFt;
        const depth = (level.floorTop - level.floorBottom) * pxPerFt;
        ctx.fillRect(x, Y(level.floorTop), wid, depth);
        ctx.strokeRect(x, Y(level.floorTop), wid, depth);
        ctx.fillStyle = ink(0.55);
        ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(
          `${formatInchesOnly(level.joistDepthIn)} TJI + ${formatInchesOnly(level.sheathingIn)} SHTG`,
          x + 4, Y((level.floorTop + level.floorBottom) / 2));
      });
      crossings.filter(c => c.wall.levelId === level.id && (c.wall.view || 'plan') === 'plan')
        .forEach(c => drawSectionWall(env, ctx, X, Y, pxPerFt, c, level, opts, C, fdn));
    });

    // THE STAIRS THE CUT PASSES THROUGH, with their rails (Movie, 7 Oct: "i
    // will need them to also display on the SECTIONS when i make cuts" --
    // "it should show the full stairs with the rails").
    drawSectionStairs(env, ctx, cut, axis, stack, X, Y, pxPerFt, C, ptAtU);

    // Roof profile over everything: the sampled top chord plus fascia drops.
    const lit = roofSamples.filter(s => s.elev != null);
    if (lit.length > 1) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let pen = null;
      roofSamples.forEach(s => {
        if (s.elev == null) {
          // A BREAK. Usually an eave: the fascia drops and the pen lifts. A
          // roof running in UNDER a higher eave (`noDrop`) has no fascia there
          // -- it just stops behind the other one.
          if (pen && !s.noDrop) ctx.lineTo(X(pen.u), Y(pen.elev - fasciaFt));
          pen = null;
          return;
        }
        if (!pen) {
          if (s.resume) ctx.moveTo(X(s.u), Y(s.elev));  // carries on under a higher eave
          else {
            ctx.moveTo(X(s.u), Y(s.elev - fasciaFt));   // fascia drop at the edge
            ctx.lineTo(X(s.u), Y(s.elev));
          }
        } else ctx.lineTo(X(s.u), Y(s.elev));
        pen = s;
      });
      if (pen) ctx.lineTo(X(pen.u), Y(pen.elev - fasciaFt));
      ctx.stroke();
      // The truss in section, chords only -- the settled ruling (Movie,
      // 17 Sep 2026, on the PROJECT detail: "lock that in !!"), drawn with
      // the same joints here. The plate line doubles as soffit and ceiling;
      // a 3 1/2" bottom chord band sits over it between the heels; the top
      // chord's underside follows the slope 3 1/2" perpendicular below the
      // surface and opens across each heel's width, so the side chord piece
      // at the wall face connects straight into the top chord -- no line
      // across the joint. The truss's internal webs are the truss designer's
      // part and are deliberately never drawn.
      const chordFt = ROOF_CHORD_IN / 12;
      ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1;
      ctx.beginPath();
      roofChords.forEach(chord => {
        ctx.moveTo(X(chord.u0), Y(chord.elev));
        ctx.lineTo(X(chord.u1), Y(chord.elev));
        const prof = chord.profile;
        // An end is an EAVE when the surface lands on the fascia top there;
        // the bearing wall stands the overhang inside it, and the heel's two
        // faces rise from the plate and the bottom chord to the underside.
        const eaveAt = pt => Math.abs(pt.rise - (chord.elev + fasciaFt)) < 0.05;
        const first = prof[0], last = prof[prof.length - 1];
        const span = last.u - first.u;
        const hasHeel = chord.overhang > 0.05
          && span > 2 * (chord.overhang + chordFt);
        const leftEave = hasHeel && eaveAt(first);
        const rightEave = hasHeel && eaveAt(last);
        const underAt = u => {
          for (let i = 1; i < prof.length; i++) {
            if (u <= prof[i].u + 1e-9) {
              const a = prof[i - 1], b = prof[i];
              const m = b.u - a.u > 1e-9 ? (b.rise - a.rise) / (b.u - a.u) : 0;
              return a.rise + (u - a.u) * m - chordFt * Math.hypot(1, m);
            }
          }
          return last.rise - chordFt;
        };
        // Crisp verticals: a 1px translucent line astride a pixel boundary
        // antialiases into two half-strength columns that read as concrete
        // gray, so each heel face snaps onto a pixel centre.
        const crisp = px => Math.round(px) + 0.5;
        const heelFace = (u, footY) => {
          const px = crisp(X(u));
          ctx.moveTo(px, Y(footY));
          ctx.lineTo(px, Y(underAt(u)));
        };
        const gaps = [];
        if (leftEave) {
          const wallU = first.u + chord.overhang;
          gaps.push([wallU, wallU + chordFt]);
          heelFace(wallU, chord.elev);
          heelFace(wallU + chordFt, chord.elev + chordFt);
        }
        if (rightEave) {
          const wallU = last.u - chord.overhang;
          gaps.push([wallU - chordFt, wallU]);
          heelFace(wallU, chord.elev);
          heelFace(wallU - chordFt, chord.elev + chordFt);
        }
        // The bottom chord's upper line stops against the heels.
        const bcLo = leftEave ? first.u + chord.overhang + chordFt : first.u;
        const bcHi = rightEave ? last.u - chord.overhang - chordFt : last.u;
        if (bcHi > bcLo) {
          ctx.moveTo(X(bcLo), Y(chord.elev + chordFt));
          ctx.lineTo(X(bcHi), Y(chord.elev + chordFt));
        }
        // The top chord's underside, segment by segment, open over the heels.
        for (let i = 1; i < prof.length; i++) {
          const a = prof[i - 1], b = prof[i];
          if (b.u - a.u < 1e-9) continue;
          const m = (b.rise - a.rise) / (b.u - a.u);
          const drop = chordFt * Math.hypot(1, m);
          let spans = [[a.u, b.u]];
          gaps.forEach(([g0, g1]) => {
            spans = spans.flatMap(([s0, s1]) => {
              const parts = [];
              if (s0 < g0) parts.push([s0, Math.min(s1, g0)]);
              if (s1 > g1) parts.push([Math.max(s0, g1), s1]);
              return parts;
            });
          });
          const eAt = u => a.rise + (u - a.u) * m - drop;
          spans.forEach(([s0, s1]) => {
            if (s1 - s0 < 1e-6) return;
            ctx.moveTo(X(s0), Y(eAt(s0)));
            ctx.lineTo(X(s1), Y(eAt(s1)));
          });
        }
      });
      ctx.stroke();
    }
    paintElevationMarks(env, ctx, cut, X, Y, pxPerFt, C, opts,
      { x0, y0, pxPerFt, uMin, yTop });
  }

  // ── STAIRS IN A SECTION ───────────────────────────────────────────────
  //
  // Every flight the cut line passes over, drawn where it stands. A cut
  // running WITH the flight (within 45 degrees) shows its whole profile --
  // stringer, 2x12 treads, 3/4" ply risers, the 36" rail -- by the same
  // routine the STAIR SECTION page draws with (stair-section.js), so the two
  // cannot tell a carpenter different things. A cut running ACROSS it shows
  // the tread and the two stringers the cut slices, the steps beyond it in a
  // lighter line, and the rail standing over them.
  //
  // THE RISE IS THE SECTION'S OWN: from the stair's floor down to the next
  // floor drawn below it (or the basement slab), so the last riser lands on
  // the floor this section draws and not on one a hair away from it.
  //
  // A turned stair draws flight by flight in its real place; the landing
  // between them draws where the cut crosses it. Pages without
  // stair-section.js (an elevation-only page) simply draw no stairs.
  function drawSectionStairs(env, ctx, cut, axis, stack, X, Y, pxPerFt, C, ptAtU) {
    const SS = window.DraftStairSection, SG = window.DraftStairGeometry;
    if (!SS || !SG || typeof env.stairs !== 'function') return;
    const stairs = (env.stairs() || []).filter(st => st && st.start && st.end
      && (st.view || 'plan') === 'plan' && st.widthFt > 0);
    if (!stairs.length) return;
    const ink = a => weight(C.ink, a);
    const inks = {
      line: C.line, stringer: weight(C.assembly, 0.15), tread: C.face, riser: C.face,
    };
    const projU = pt => pt.x * axis.x + pt.z * axis.z;
    // The viewer stands on the +dirVec side and looks the other way: a
    // point is BEYOND the cut when it lies on the -dirVec side of it.
    const dir = cut.dirVec || { x: -axis.z, z: axis.x };
    const depthOf = pt => -((pt.x - cut.startPt.x) * dir.x + (pt.z - cut.startPt.z) * dir.z);
    const RAIL_FT = 3;
    const runStep = SG.STAIR_TREAD_RUN_IN / 12;
    stairs.forEach(stair => {
      const top = stack.floors.find(level => level.id === Number(stair.levelId));
      if (!top) return;
      const below = stack.floors
        .filter(level => level.floorTop < top.floorTop - 0.5)
        .reduce((hi, level) => (!hi || level.floorTop > hi.floorTop ? level : hi), null);
      const bottomFt = below ? below.floorTop : stack.foundation.slabTop;
      const layout = SG.stairLayout(top.floorTop - bottomFt);
      if (!(layout.riseFt > 0.5)) return;
      const parts = SG.stairPlanParts(stair, layout);
      const { flights } = SS.stairFlights(layout, parts.split);
      const riseStep = layout.riserIn / 12;
      const half = stair.widthFt / 2;
      const railSides = stair.rail === 'both' ? [-1, 1]
        : stair.rail === 'none' || !stair.rail ? []
          : [stair.rail === 'right' ? 1 : -1];
      const railOff = Math.max(0.05, half - SG.STAIR_RAIL_INSET_FT);
      const yOf = e => Y(top.floorTop + e);
      ctx.save();
      parts.runs.forEach((run, i) => {
        const flight = flights[i];
        if (!flight) return;
        const d = run.dir;
        const rp = { x: -d.z, z: d.x };   // right hand, walking down
        const at = (s, v) => ({ x: run.start.x + d.x * s + rp.x * v, z: run.start.z + d.z * s + rp.z * v });
        const lenFt = Math.max(run.lenFt, flight.risers * runStep - SG.STAIR_RISER_FACE_IN / 12);
        const rect = [at(0, -half), at(lenFt, -half), at(lenFt, half), at(0, half)];
        const spans = floorRuns(cut, axis, [{ points: rect }]);
        if (!spans.length) return;
        const c = d.x * axis.x + d.z * axis.z;
        const uS = projU(run.start);
        // Stair u (this flight's) -> section station.
        const station = u => uS + (u - flight.u0) * c;
        if (Math.abs(c) > Math.SQRT1_2) {
          // WITH THE RUN: the whole flight in profile.
          SS.drawFlight(ctx, flight, layout, u => X(station(u)), yOf, inks);
          if (railSides.length) {
            const end = SS.flightRailEnd(flight, layout);
            ctx.strokeStyle = C.line; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(X(station(flight.u0)), yOf(flight.e0 + RAIL_FT));
            ctx.lineTo(X(station(end.u)), yOf(end.e + RAIL_FT));
            ctx.stroke();
          }
          return;
        }
        // ACROSS THE RUN: where along the flight the cut slices it.
        const span = spans.reduce((a, b) => (b.max - b.min > a.max - a.min ? b : a));
        const mid = ptAtU((span.min + span.max) / 2);
        const s = (mid.x - run.start.x) * d.x + (mid.z - run.start.z) * d.z;
        const k = Math.max(1, Math.min(flight.risers - 1, Math.ceil(s / runStep - 1e-6)));
        const eTread = flight.e0 - k * riseStep;
        const treadThk = SS.STAIR_TREAD_THICK_IN / 12;
        const strW = 1.5 / 12;
        const nosingE = u => flight.e0 - u * (riseStep / runStep);
        const xa = X(span.min), xb = X(span.max);
        // Beyond: every other tread on the far side, a light nosing line
        // across the width, with the stringers' outline down (or up) to it.
        const far = (depthOf(at(lenFt, 0)) > depthOf(at(0, 0))) ? 1 : -1;
        const beyond = [];
        for (let j = 1; j < flight.risers; j += 1) if ((j - k) * far > 0) beyond.push(j);
        ctx.strokeStyle = ink(0.45); ctx.lineWidth = 0.75;
        ctx.beginPath();
        beyond.forEach(j => {
          const y = yOf(flight.e0 - j * riseStep);
          ctx.moveTo(xa, y); ctx.lineTo(xb, y);
        });
        if (beyond.length) {
          const eEnd = far > 0 ? flight.e0 - flight.risers * riseStep : flight.e0;
          ctx.moveTo(xa, yOf(eTread)); ctx.lineTo(xa, yOf(eEnd));
          ctx.moveTo(xb, yOf(eTread)); ctx.lineTo(xb, yOf(eEnd));
        }
        ctx.stroke();
        // The cut: the tread the line passes through, and a stringer each side.
        ctx.strokeStyle = C.line; ctx.lineWidth = 1.25;
        ctx.fillStyle = weight(C.assembly, 0.3);
        const yT = yOf(eTread), hT = treadThk * pxPerFt;
        ctx.fillRect(xa, yT, xb - xa, hT);
        ctx.strokeRect(xa, yT, xb - xa, hT);
        const strTop = eTread - treadThk;
        const strBottom = SS.notchRootE(flight, layout, flight.u0 + s) - SS.STAIR_STRINGER_DROP_IN / 12;
        const sx = strW * pxPerFt;
        [xa, xb - sx].forEach(x => {
          ctx.fillRect(x, yOf(strTop), sx, (strTop - strBottom) * pxPerFt);
          ctx.strokeRect(x, yOf(strTop), sx, (strTop - strBottom) * pxPerFt);
        });
        // The rail: seen end-on it runs straight up or down the page, 36"
        // over the nosings from the slice to the flight's far end.
        const end = SS.flightRailEnd(flight, layout);
        const eFar = far > 0 ? end.e : flight.e0;
        ctx.strokeStyle = C.line; ctx.lineWidth = 2;
        ctx.beginPath();
        railSides.forEach(side => {
          const x = X(projU(at(s, side * railOff)));
          ctx.moveTo(x, yOf(nosingE(s) + RAIL_FT));
          ctx.lineTo(x, yOf(eFar + RAIL_FT));
        });
        ctx.stroke();
      });
      // The landing of a turned stair, where the cut crosses it: a level
      // band 8" deep at the foot of the first flight.
      if (parts.landing && flights[1]) {
        const eL = flights[1].e0;
        floorRuns(cut, axis, [{ points: parts.landing.poly }]).forEach(span => {
          ctx.fillStyle = weight(C.assembly, 0.15);
          ctx.strokeStyle = C.line; ctx.lineWidth = 1.25;
          const x = X(span.min), wid = (span.max - span.min) * pxPerFt;
          ctx.fillRect(x, yOf(eL), wid, (8 / 12) * pxPerFt);
          ctx.strokeRect(x, yOf(eL), wid, (8 / 12) * pxPerFt);
          if (railSides.length) {
            ctx.strokeStyle = C.line; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, yOf(eL + RAIL_FT)); ctx.lineTo(x + wid, yOf(eL + RAIL_FT));
            ctx.stroke();
          }
        });
      }
      ctx.restore();
    });
  }

  // One crossed wall on the section: the stud rectangle for its level, with
  // any fenestration the cut happens to pass through read out of the wall —
  // doors clear to the head, windows hang from it to a default sill.
  // `inks` IS THE HOISTED TABLE and the reason it is a ninth argument rather
  // than a lookup. This runs ONCE PER WALL CROSSING, so deriving the table
  // here spread eight keys into a fresh object for every wall in the section
  // -- pure waste on the one path in this file that is already in a frame
  // budget (model-html-seats holds an edit under one long task with four live
  // elevations). drawCutView builds it once and hands it down.
  //
  // IT STILL DERIVES ITS OWN when called without one: this function is
  // exported, and a caller reaching for it directly gets paper rather than a
  // crash.
  function drawSectionWall(env, ctx, X, Y, pxPerFt, crossing, level, opts, inks, fdn) {
    const C = inks || inksFor(opts);
    const ink = a => weight(C.ink, a);
    const INK = C.line;
    const HEAD_FT = 6 + 10 / 12;          // default door / window head
    const SILL_FT = 3;                    // default window sill
    const { wall, u, width, alongWall } = crossing;
    const x = X(u - width / 2), wid = width * pxPerFt;
    // ── A GARAGE HAS NO FLOOR TO STAND ON ───────────────────────────────
    //
    // Movie, 25 Sep, on the section: "we need extra 1'-0 5/8" of wall added
    // to the bottom of the garage wall to meet the top of the sill plate
    // (main floor joists + sheathing height". That is DEFAULT_FLOOR_THICKNESS
    // exactly -- 11 7/8" TJI + 3/4" sheathing -- and it is the measure of
    // what this line was missing.
    //
    // sectionWallCrossings has put `garage` on every crossing since audit C5
    // and this painter never read it, so a garage wall stood on level.floorTop
    // like a house wall: the top of the MAIN FLOOR DECK. A house wall belongs
    // there. A garage has no joists and no deck under it -- its wall runs down
    // past where that floor would be and lands on the sill plate on its own
    // foundation, one whole floor package lower.
    //
    // THE ELEVATION ALREADY KNEW (drawElevationView's garageBase), which is
    // why the two views of the same garage disagreed by a foot -- and why the
    // PROJECT page, which draws sections, is where Movie saw it.
    //
    // The wall TOP does not move: the extra height is added at the BOTTOM, so
    // the garage plate still lines up with the storey it shares.
    const bottom = crossing.garage && fdn
      ? garageBearing(env, fdn, crossing.garage)
      : level.floorTop;
    const top = level.wallTop;
    const opening = env.fenestrations().find(f => f.wallId === wall.id
      && Math.abs(alongWall - f.offset) < f.width / 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
    ctx.fillStyle = ink(0.12);
    if (!opening) {
      ctx.fillRect(x, Y(top), wid, (top - bottom) * pxPerFt);
      ctx.strokeRect(x, Y(top), wid, (top - bottom) * pxPerFt);
      return;
    }
    const headFt = opening.headHeight > 0 ? opening.headHeight : HEAD_FT;
    const sillFt = opening.sillHeight > 0 ? opening.sillHeight : SILL_FT;
    // ── A GARAGE DOOR STANDS ON THE FLOOR, NOT ON THE PLATE ─────────────
    //
    // The elevation learned this in board #45's first half; the section stood
    // every door on `bottom`, which for a garage wall is the top of its sill
    // plate -- grade + 15 1/2" on a hung beam, 5 1/2" clear of the garage
    // floor this same painter drew below it. The door hung in the air.
    //
    // THE FLOOR IS WHERE IT IS, buck and all: `garageFloorAt` is the top of
    // the slab poured into the void, which is what the door closes onto and
    // the reason the void is formed at all.
    //
    // AND AN EXTERIOR DOOR STANDS ON A THRESHOLD -- Movie, 26 Sep: *"we should
    // put the exterior 'mandoor's thresholds at 1/2" ... and usually there is
    // one on exterior doors"*. An OVERHEAD door takes none; it seals to the
    // slab. Only a door on a GARAGE wall is answered here: a section crosses
    // interior walls too, and nothing in the model marks a door exterior, so
    // the house's doors keep the floor they had rather than get a sill this
    // painter guessed at.
    const stands = opening.type === 'door' && crossing.garage && fdn
      ? garageFloorAt(env, fdn, crossing.garage, doorPoint(wall, opening))
        + (opening.garage ? 0 : DOOR_THRESHOLD_IN / 12)
      : bottom;
    const gapBottom = opening.type === 'door' ? stands : bottom + sillFt;
    const gapTop = Math.min(bottom + headFt, top);
    // Above the head (header + plates) and, for windows, below the sill.
    ctx.fillRect(x, Y(top), wid, (top - gapTop) * pxPerFt);
    ctx.strokeRect(x, Y(top), wid, (top - gapTop) * pxPerFt);
    if (gapBottom > bottom) {
      ctx.fillRect(x, Y(gapBottom), wid, (gapBottom - bottom) * pxPerFt);
      ctx.strokeRect(x, Y(gapBottom), wid, (gapBottom - bottom) * pxPerFt);
    }
    ctx.fillStyle = C.face; ctx.lineWidth = 1;
    if (opening.type === 'window') {
      // The window unit in section: 2x6 frame members at head and sill
      // reaching 1/2" past each wall face, double glazing between them —
      // two 1/4" panes 1/2" apart — with 1/2" square stops between and on
      // each side of the glass.
      const frameDeep = Math.max(6 / 12, width + 1 / 12);
      const fx = X(u - frameDeep / 2), fw = frameDeep * pxPerFt;
      const frameThick = (2 / 12) * pxPerFt;
      ctx.fillRect(fx, Y(gapTop), fw, frameThick);
      ctx.strokeRect(fx, Y(gapTop), fw, frameThick);
      ctx.fillRect(fx, Y(gapBottom + 2 / 12), fw, frameThick);
      ctx.strokeRect(fx, Y(gapBottom + 2 / 12), fw, frameThick);
      const glassTop = gapTop - 2 / 12, glassBottom = gapBottom + 2 / 12;
      [0.375 / 12, -0.375 / 12].forEach(off => {
        const gx = X(u + off);
        ctx.beginPath(); ctx.moveTo(gx, Y(glassTop)); ctx.lineTo(gx, Y(glassBottom)); ctx.stroke();
      });
      const stop = (0.5 / 12) * pxPerFt;
      ctx.fillStyle = ink(0.35);
      [u - 0.875 / 12, u, u + 0.875 / 12].forEach(su => {
        ctx.fillRect(X(su) - stop / 2, Y(glassBottom + 0.5 / 12), stop, stop);
        ctx.fillRect(X(su) - stop / 2, Y(glassTop), stop, stop);
      });
    } else {
      // A flat 1-3/4" slab door standing in the opening.
      const slabW = Math.max(1.5, (1.75 / 12) * pxPerFt);
      ctx.fillRect(X(u) - slabW / 2, Y(gapTop), slabW, (gapTop - gapBottom) * pxPerFt);
      ctx.strokeRect(X(u) - slabW / 2, Y(gapTop), slabW, (gapTop - gapBottom) * pxPerFt);
    }
  }

  // A cut that crosses nothing but faces the model is an elevation: wall
  // faces projected onto the cut line (far to near, so close walls occlude),
  // openings on each face, the roof silhouette, a grade line, and the
  // below-grade foundation dashed. Returns false when nothing projects
  // into the cut's span, so the caller can fall back to the guidance text.
  function drawElevationView(env, ctx, w, h, cut, stack, axis, header, opts) {
    const fit = externalFit(opts);
    const C = inksFor(opts);
    const ink = a => weight(C.ink, a);
    const dir = cut.dirVec;
    cut = reachingEaves(env, cut, axis);
    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    const uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);
    const proj = pt => ({ u: pt.x * axis.x + pt.z * axis.z, d: pt.x * dir.x + pt.z * dir.z });

    const { faces, fdnFaces, garageFor } = elevationFaces(env, cut, stack, axis);
    if (!faces.length) return false;

    // WHETHER THE WINDOW SIZE TAGS DRAW AT ALL, asked once for the elevation
    // rather than per opening. A size tag is a fenestration dimension, so it
    // rides A-DIMS-FENS -- the same layer the plan's opening-centre string is
    // on. Unticking it in STANDARDS takes both.
    //
    // VISIBLE ONLY, NOT PRINTABLE, and deliberately: plan-composition's
    // layerShows also drops a layer whose Print box is clear, but it is
    // handed `isPrinting` and this painter has no such mode -- nothing in
    // cut-view.js knows whether it is drawing to paper. Reading `printable`
    // here would hide the tag on screen because of a PRINT setting, which is
    // a different and wrong answer. When elevations learn about printing this
    // is the line that has to learn with them.
    //
    // NO STANDARD MEANS IT DRAWS: an env whose page never wired the profile
    // is not a page that hid the tag.
    // A-DIMS-WIN, NOT A-DIMS-FENS, AND THE SPLIT IS THE POINT. The tag rode
    // the centre-string layer from 29 Sep -- Movie: "can we make the window
    // number get layer A-DIMS-FENS so the user can turn them off in ELEVATION
    // views if desired". One layer answered that and answered the next
    // question wrong, which he found on 30 Sep: "if i want to turn of the
    // outside line dimensions and leave the window sizes on i won't be able
    // too". The corner string and the 36X36 are different marks about the
    // same window and a drafter wants each without the other.
    const fenStandard = env.layerStandard ? env.layerStandard('A-DIMS-WIN') : null;
    const showFenTags = !fenStandard || fenStandard.visible !== false;
    // A DOOR'S SIZE ON AN ELEVATION IS OFF UNTIL THE OFFICE TURNS IT ON
    // (Movie, 1 Oct: "WINDOW sizes ON in elevation ... DOORS off by default
    // but they could turn it on"). Two switches, both needed: STANDARDS'
    // DOOR SIZES ON ELEVATIONS, and A-DIMS-DOOR's own Visible tick. A page
    // that hands no fenestration standards draws none -- off is the default.
    const doorStandard = env.layerStandard ? env.layerStandard('A-DIMS-DOOR') : null;
    const fenStandards = env.fenStandards ? env.fenStandards() : null;
    const showDoorTags = !!(fenStandards && fenStandards.doorsOnElevations)
      && (!doorStandard || doorStandard.visible !== false);

    // Roof silhouette: at each spot along the cut, the tallest roof surface
    // anywhere along the viewing depth — the ridge/hip outline from outside.
    const roofs = env.roofs();
    const silhouette = [];
    let facesByRoof = null;
    let dLo = Infinity, dHi = -Infinity;
    if (roofs.length) {
      roofs.forEach(roof => (roof.points || []).forEach(pt => {
        const d = pt.x * dir.x + pt.z * dir.z;
        dLo = Math.min(dLo, d); dHi = Math.max(dHi, d);
      }));
      // Silhouette stays sampled (it also feeds shading), but samples the
      // REAL faces — built once here, thousands of queries after.
      facesByRoof = new Map(roofs
        .filter(roof => roof.points && roof.points.length >= 3)
        .map(roof => [roof, geo().roofFaces(roof, geo().roofSkeleton(roof))]));
      // THE BEARING AND THE EAVE, ONCE PER ROOF RATHER THAN ONCE PER PROBE.
      // `roofBaseElev` asks whether a roof belongs to a garage, and that walks
      // the garage outlines -- while the loop below asks a quarter of a
      // million times. It was already paying that, so hoisting it was only
      // going to be tidy; measured on proto/cut-view-timing.js it HALVES an
      // elevation:
      //
      //     rail repaint, all five seats   211.9 ms  ->  102.0 ms
      //     E1 median                       56.6 ms  ->   28.4 ms
      //
      // which says the file's own note above -- "it is where an elevation's
      // ~28 ms goes" -- was measuring this call as much as the sampling.
      const bearingByRoof = new Map();
      facesByRoof.forEach((roofFaces, roof) => bearingByRoof.set(roof, {
        base: roofBaseElev(roof, stack, env),
        eave: roofEaveElev(roof, stack, env),
      }));
      // THE ROOF SILHOUETTE'S RESOLUTION, and the painter's whole cost. This
      // walks the cut, and at each spot walks the viewing depth, bisecting for
      // the tallest roof surface -- 240 x 40 x up to 24 iterations. Measured on
      // repro-garage-house, it is where an elevation's ~28 ms goes; a section
      // never reaches here and costs 0.3 ms.
      //
      // `coarseSilhouette` is for callers drawing SMALL. A rail seat is 82 px
      // wide, where 240 samples is eleven per pixel and 40 is one per two --
      // detail the seat cannot show. It takes the elevation to ~7 ms, so four
      // live thumbnails cost ~30 ms instead of ~112.
      //
      // OPT-IN, so the full-size view and LAYOUT's sheets are untouched: the
      // number that matters on a printed sheet is the one that was always here.
      const coarse = Boolean(opts && opts.coarseSilhouette);
      const steps = coarse ? 40 : 240, depthSteps = coarse ? 10 : 40;
      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const bx = cut.startPt.x + (cut.endPt.x - cut.startPt.x) * s;
        const bz = cut.startPt.z + (cut.endPt.z - cut.startPt.z) * s;
        const baseD = bx * dir.x + bz * dir.z;
        const elevAt = k => {
          const px = bx + dir.x * (k - baseD), pz = bz + dir.z * (k - baseD);
          let tallest = null;
          facesByRoof.forEach((faces, roof) => {
            const rise = sectionRoofHeightAt({ x: px, z: pz }, roof, faces);
            if (rise == null) return;
            const { base, eave } = bearingByRoof.get(roof);
            const elev = eave + rise;
            if (tallest === null || elev > tallest.elev) tallest = { elev, base };
          });
          return tallest;
        };
        let best = null, bestK = null;
        for (let j = 0; j <= depthSteps; j++) {
          const k = dLo + (dHi - dLo) * j / depthSteps;
          const sample = elevAt(k);
          if (sample && (best === null || sample.elev > best.elev)) { best = sample; bestK = k; }
        }
        // The true peak (a ridge or hip) usually falls between the coarse
        // samples; ternary-search the bracket around the best one so the
        // silhouette reads the real ridge height at every step.
        if (bestK != null) {
          const dk = (dHi - dLo) / depthSteps;
          let a = bestK - dk, b = bestK + dk;
          for (let it = 0; it < 24; it++) {
            const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
            if ((elevAt(m1)?.elev ?? -Infinity) < (elevAt(m2)?.elev ?? -Infinity)) a = m1;
            else b = m2;
          }
          const refined = elevAt((a + b) / 2);
          if (refined && refined.elev > best.elev) best = refined;
        }
        silhouette.push({
          u: bx * axis.x + bz * axis.z,
          elev: best === null ? null : best.elev,
          base: best === null ? null : best.base,
        });
      }
    }

    const fdn = stack.foundation;
    const lit = silhouette.filter(s => s.elev != null);
    const yTop = fit?.extents ? fit.extents.yTop
      : Math.max(stack.bearing + 2, ...lit.map(s => s.elev)) + SKY_ABOVE_ROOF_FT;
    const yBottom = fit?.extents ? fit.extents.yBottom : fdn.footingBottom - 2;
    // ── THE PILES' ROOM IS BELOW THE FRAME, NOT INSIDE IT ────────────────
    //
    // Movie, 26 Sep, on a two-storey with a garage: "see how the footing
    // bottom line is just under the dashboard line where the tint starts --
    // could we make the house just a little smaller so that the bottom of the
    // footing doesnt cross over the 'tint' line of the lower bar ... so there
    // is a little space, BUT ALLOW THE PILES TO EXTEND PAST THAT TINT LINE."
    //
    // THE TWO FEET UNDER THE FOOTING ARE THE SHAFTS', and that is what the
    // last clause is naming. A pile is drawn from the underside of what it
    // carries down to `yBottom` and stops there -- it has no bottom of its
    // own on an elevation, because the drawing is not saying how deep it
    // goes. Measured on screen at 1366x700, twoStorey-garage E1: footing
    // bottom at y 655, shafts running on to y 682, which is 2 ft at that
    // scale exactly. So the extent's last two feet are not air to be kept
    // clear; they are ink that is allowed to run off under the furniture.
    //
    // SO THE FIT IS MEASURED TO THE FOOTING and the shafts overflow. Sizing
    // the padded figure into the margins instead reserves those two feet
    // TWICE -- once as extent and once as the bar the caller is now asking
    // this to keep off -- and the house shrinks about 10% to pay for room
    // Movie has just said the piles may use. Measured both ways at 1366x700:
    // fitting yBottom puts the footing 42px clear of the bar; fitting the
    // footing and an inch of ground under it puts it against the bar, which is
    // what he asked for -- "make it look like the footing is just about
    // resting on one inch of dirt and then the tint starts".
    //
    // SO THE INCH IS EXTENT, NOT MARGIN, and that is the whole of why it is
    // here. A pixel clearance in `screenMargins` would be three and a half
    // inches of ground on a laptop and half an inch on a large screen; an inch
    // of GROUND is an inch at every size, which is the thing he described.
    //
    // AN EXTERNAL FIT IS UNTOUCHED. LAYOUT hands its own extents and its own
    // pxPerFt: the paper decides there, and a viewport that asked for a
    // figure this then overran would be a drawing off the edge of a sheet.
    const yFit = fit?.extents ? fit.extents.yBottom
      : fdn.footingBottom - GROUND_UNDER_FOOTING_FT;
    const mg = screenMargins(opts, w);
    const marginL = fit ? 0 : mg.left, marginR = fit ? 0 : mg.right,
      marginT = fit ? 0 : mg.top, marginB = fit ? 0 : mg.bottom;
    const pxPerFt = fit ? fit.pxPerFt : Math.max(2, Math.min(
      (w - marginL - marginR) / Math.max(uMax - uMin, 4),
      (h - marginT - marginB) / Math.max(yTop - yFit, 8)));
    const x0 = marginL + ((w - marginL - marginR) - (uMax - uMin) * pxPerFt) / 2;
    const y0 = marginT + ((h - marginT - marginB) - (yTop - yFit) * pxPerFt) / 2;
    const X = u => Math.round(x0 + (u - uMin) * pxPerFt - 0.5) + 0.5;
    const Y = e => Math.round(y0 + (yTop - e) * pxPerFt - 0.5) + 0.5;

    const INK = C.line;
    // WHAT MAKES A FACE EDGE AN EAVE: both ends sitting on the fascia top.
    // ONE HOME, because two passes ask it -- the band below grows its runs to
    // the eave's true ends, and the face-edge pass decides which edges wear a
    // fascia. Written twice, the day one of them widened its tolerance the
    // other would go on banding a different set of edges and the stub would
    // come back wearing a new number.
    const isEaveEdge = (ea, eb, eaveTop) =>
      Math.abs(ea - eaveTop) < 0.01 && Math.abs(eb - eaveTop) < 0.01;
    header(`${cut.name} — GENERATED ELEVATION`);

    const datum = env.elevationDatum();
    const mark = (elevFt, uEnd) => {
      ctx.strokeStyle = ink(0.25); ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(marginL - 18, Y(elevFt));
      ctx.lineTo(uEnd == null ? w - marginR : X(uEnd), Y(elevFt));
      ctx.stroke();
      ctx.fillStyle = ink(0.6);
      ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(env.elevLabel(elevFt + datum), marginL - 22, Y(elevFt));
    };
    // House level lines stop at the house face — a garage hangs off grade
    // and never carries the house datums across its front.
    const houseFaces = faces.filter(face => !face.garage);
    const houseHi = houseFaces.length
      ? Math.max(...houseFaces.map(face => Math.min(Math.max(face.u1, face.u2), uMax)))
      : uMax;
    stack.floors.forEach(level => { mark(level.floorTop, houseHi); mark(level.wallTop, houseHi); });
    mark(fdn.grade);

    // Foundation faces split at grade. The exposed concrete above grade reads
    // as light grey faces, far to near, with a light-medium crease down each
    // visible corner where two faces meet. Below grade only the outer outline
    // shows, dashed: down the extreme wall edge, out at the footing, across
    // the bottom and back up — one loop per building mass — plus dashed
    // creases at viewer-facing corners and the footing steps under them.
    const CREASE = ink(0.45);
    const fdnGeoms = fdnFaces
      .filter(face => face.hi - face.lo >= 0.5)
      .map(face => ({
        ...face,
        // ── THE HOUSE'S CONCRETE STOPS A PLATE UNDER ITS BEARING ─────────
        //
        // Movie, 4 Oct, on E1 of a MOD BILEVEL: "the grade beam and house
        // sill plates don't seem to line up ... there is no LINE at the
        // house". A split stores its house foundation walls at the pour PLUS
        // the plate, 5'-1 1/2", while the stack measures them up from a
        // 5'-0" pour -- so the house's grey ran to the bearing line and the
        // plate under the rim was concrete. Capped at the house's own top of
        // concrete, every house reads the same: the pour, then the plate.
        // A no-op wherever the stored height is the pour, which is every
        // house built the other way.
        topE: face.garage ? fdn.wallBottom + face.top
          : Math.min(fdn.wallBottom + face.top, fdn.wallTop - houseSillPlateFt()),
        baseE: fdn.wallBottom + face.base,
        projFt: face.bearing
          ? Math.max(0, fdn.footingWidthIn - face.wallIn) / 2 / 12 : 0,
      }));
    const exposed = fdnGeoms.filter(g => g.topE > fdn.grade)
      .sort((a, b) => a.depth - b.depth);   // far first
    // ── A NEARER FACE HIDES THE PART IT COVERS, NOT ALL OR NOTHING ──────
    //
    // Movie, 22 Sep, on E4 of a 2 STOREY + GARAGE + ROOM OVER: *"the 2nd floor
    // is lined up but foundation off kilter still"*.
    //
    // THE WALLS WERE ALREADY RIGHT. Measured on that build, the tie is the
    // same on every level:
    //
    //     FOUNDATION  (16,19) -> (20,19)   body=garage
    //     MAIN FL     (16,19) -> (20,19)   body=garage
    //     2ND FL      (16,19) -> (20,19)
    //
    // What was off was the ELEVATION. Two exposed foundation tops overlapped
    // for exactly one foot -- the tie's foot:
    //
    //     e -1.048   u -46.00..-19.00    the GARAGE's concrete, z 19..46
    //     e -1.173   u -20.00.. 20.00    the HOUSE's concrete,  z -20..20
    //
    // 1.5" apart in height and stepping a foot apart in plan, so the drawing
    // showed a step a foot from where the concrete actually steps.
    //
    // THE TEST DEMANDED TOTAL COVER: `o.lo <= g.lo && o.hi >= g.hi`. The
    // garage's face covers one foot of the house's twenty-eight, so it hid
    // none of it and the house's line ran on underneath. Subtracting the
    // stretch instead is the same question asked per foot rather than per
    // face, and a face a nearer one swallows whole now yields no runs at all
    // -- which is the old all-or-nothing answer, kept as a special case of
    // the general one rather than as a rule of its own.
    // ── AND WHAT HIDES SOMETHING IS THE WALL, NOT JUST ITS CONCRETE ──
    //
    // Movie, 26 Sep, on the BACK elevation: *"the garage door buck is showing
    // on the HOUSE FOUNDATION at the back"*, and then the diagnosis himself --
    // *"its like the house is transparent or the door buck lines are going in
    // front of the house"*. Which is what it was.
    //
    // `o.topE >= g.topE` ASKED THE CONCRETE. On repro-tie-gable E3 the house's
    // foundation tops out at -1.3017 and the garage's at -1.1767, so the house
    // -- standing a clear 26 ft in FRONT of the garage's front wall -- topped
    // out an inch and a half LOWER and hid none of it. The garage's own top of
    // concrete then ran twenty feet across the back of the house:
    //
    //     e -1.1729   u -16.00..4.00    the GARAGE's front wall, behind
    //     e -1.2979   u -16.00..16.00   the HOUSE's own, in front
    //
    // -- two parallel lines an inch and a half apart, and the buck notched out
    // of the first for good measure. It shows because the OUTLINE pass runs
    // after every fill on the sheet, so a far face's line goes down on top of
    // the near face that covered its fill.
    //
    // THE INCH AND A HALF IS THE STORED HEIGHTS, which this file already knows
    // about: "the house's foundation walls were stored at the generic 8'-0"
    // while the garage's took the foundation assembly's 8'-1 1/2"", and
    // reconciling those is the open question about the junction. This does not
    // wait on it. A wall does not stop at its concrete -- the sill plate on top
    // is opaque too, and the pass below fills exactly that strip -- so the
    // height a face hides things up to is the top of its PLATE. The house's
    // reaches the bearing line, which is above the garage's concrete, and that
    // is true whatever the two are stored at.
    const PLATE_CAP_FT = 0.5;
    const plateTopOf = g => (g.garage
      ? garageBearing(env, fdn, g.garage) : fdn.wallTop);
    const plateOf = g => {
      const rise = plateTopOf(g) - g.topE;
      return rise > 0.01 && rise < PLATE_CAP_FT ? rise : 0;
    };
    // HOW THIS CONCRETE HOLDS ITS FRAMING DOWN: PROJECT's FND ATTACHMENT
    // and LADDER DEPTH -- a split's own row, else the drawing's -- for the
    // house; the DETACHED GARAGE row for a detached garage; an attached
    // garage is drawn on a sill in PROJECT and so here. An ICF wall takes no
    // ladder (PROJECT: "the sill plate is the only option for the ICF
    // walls"). Answers the ladder's depth in feet, or 0 for a sill.
    const holdDownOf = g => {
      const read = row => {
        if (!row || row.foundationAttachment !== 'ladder') return 0;
        const inches = Number(row.foundationLadderIn);
        return ([3.5, 5.5].includes(inches) ? inches : 3.5) / 12;
      };
      if (g.garage) {
        return g.garage.detached && env.sectionRow ? read(env.sectionRow('detachedGarage')) : 0;
      }
      if (String(g.wall?.wallType || '').startsWith('icf')) return 0;
      const top = env.foundationHoldDown ? env.foundationHoldDown() || {} : {};
      const split = SPLIT_TYPES.includes(envBuildType(env)) && env.sectionRow
        ? env.sectionRow(envBuildType(env)) || {} : {};
      return read({
        foundationAttachment: split.foundationAttachment ?? top.attachment,
        foundationLadderIn: split.foundationLadderIn ?? top.ladderIn,
      });
    };
    const behindFdn = (g, o) => o !== g
      && o.depth > g.depth + 1e-6
      && o.topE + plateOf(o) >= g.topE - 1e-3
      && Math.max(o.baseE, fdn.grade) <= Math.max(g.baseE, fdn.grade) + 1e-3;
    const visibleRuns = g => exposed.reduce((runs, o) => (behindFdn(g, o)
      ? runs.flatMap(r => {
        if (o.hi <= r.lo + 0.05 || o.lo >= r.hi - 0.05) return [r];
        const kept = [];
        if (o.lo > r.lo + 0.05) kept.push({ lo: r.lo, hi: o.lo });
        if (o.hi < r.hi - 0.05) kept.push({ lo: o.hi, hi: r.hi });
        return kept;
      })
      : runs), [{ lo: g.lo, hi: g.hi }]).filter(r => r.hi - r.lo > 0.05);
    const shownFdn = exposed
      .map(g => ({ g, runs: visibleRuns(g) }))
      .filter(entry => entry.runs.length);
    // ── AND THE SILL PLATE ON TOP OF IT IS WALL, NOT CONCRETE ───────────
    //
    // Movie, 25 Sep, on E4 of a 2 STOREY + GARAGE + ROOM OVER: "looks like
    // the side connection is fixed but there is a new gap looks like at sill
    // location" ... "sill attachment 1.5"".
    //
    // THE SIDE CONNECTION IS THE FIX THAT OPENED THIS. 97a82c9 took the plate
    // off the foundation base so the concrete tops out where the concrete
    // really tops out -- one plate BELOW the bearing line -- and that is what
    // stepped the garage's top of concrete clear of the house's floor
    // package. But nothing in this painter draws the plate, and the wall
    // above it starts at the bearing:
    //
    //     the rim band's bottom        fdn.wallTop          -1.0521
    //     a garage wall face's floor   garageBearing(...)   -1.0521
    //     every exposed concrete top   ...less one plate    -1.1771
    //
    // -- so the 1 1/2" between them was paper. On the NIGHT skin it reads as
    // ground and nobody saw it; on DAY it is a white slot with the building's
    // own corner lines broken across it.
    //
    // IT BELONGS TO THE WALL. The plate is wood, the siding runs down over it
    // to the top of concrete, and `garageConcreteTop`'s own comment already
    // states the relation from the other end: "one sill plate below where its
    // walls bear". So this fills the strip in the WALL's ink, and the grey
    // stops where the concrete stops.
    //
    // FILLED HERE RATHER THAN AT THE BAND because this pass is the one that
    // knows what is VISIBLE: `visibleRuns` has already cut each face against
    // whatever stands nearer, and the plate is exactly as wide as the
    // concrete under it. Doing it at the rim band instead would have needed
    // that clip written a second time -- and would still have left the garage
    // faces, which carry no band at all, wearing the gap.
    //
    // WHAT BEARS ON THIS PIECE, not a plate thickness quoted here: a stepped
    // foundation, a walkout, a garage dropped for a bilevel all move the two
    // ends independently, and the strip is the distance between them. The cap
    // is what keeps a genuine STEP from being painted as a plate -- a step is
    // feet, a plate is inches -- and it also closes the wider slot an older
    // drawing shows, where the house's foundation walls were stored at the
    // generic 8'-0" wall default while the garage's took the foundation
    // assembly's 8'-1 1/2" (the note at the corner pass below has the rest of
    // that: "reconciling those is a question about the junction").
    // ── AND A DOOR IS A NOTCH OUT OF THE TOP OF IT ──────────────────────
    //
    // Movie, 25 Sep: "i guess the door buck will appear on the elevations as a
    // 8" opening in the top of the concrete". The note at GARAGE_DOOR_BUCK_IN
    // has the rule -- a foot of buck at every door, the slab poured over it,
    // and what shows is the part the slab did not fill.
    //
    // MATCHED BY GEOMETRY, not by wall id. A door is a fenestration on a MAIN
    // FLOOR wall and the concrete under it is a FOUNDATION wall: two records
    // at one place, with no reference between them. What they do share is
    // where they stand, so a buck belongs to the face at the same depth whose
    // span it falls in -- the same question `visibleRuns` above answers for
    // faces, asked of a door.
    const bucks = [];
    env.walls().forEach(wall => {
      if ((wall.view || 'plan') === 'foundation') return;
      const garage = garageFor(wall);
      if (!garage) return;
      const p1 = proj(wall.start), p2 = proj(wall.end);
      const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      if (!(len > 1e-6)) return;
      const perFt = (p2.u - p1.u) / len;
      env.fenestrations().forEach(f => {
        if (f.wallId !== wall.id || (f.type || f.kind) !== 'door') return;
        const open = garageDoorOpeningFt(env, garage, doorPoint(wall, f));
        if (open <= 0.01) return;      // the slab has filled the whole buck
        const half = Math.abs(perFt) * f.width / 2;
        if (half < 0.05) return;       // this door is edge on to this view
        const uc = p1.u + perFt * f.offset;
        bucks.push({ id: f.id, lo: uc - half, hi: uc + half,
          depth: (p1.d + p2.d) / 2, open });
      });
    });
    // THE FACE'S OWN, and a foot of slack on depth for the same reason the
    // pile rule carries one: a wall's concrete and the wall on it are two
    // records that agree to within their own thickness, not to the inch.
    const bucksOf = g => bucks.filter(b => Math.abs(b.depth - g.depth) < 1);
    // A run, cut at every jamb that falls inside it, each piece carrying how
    // far the concrete is notched there. A run with no door comes back as
    // itself with a drop of zero, which is what every face had before.
    const notched = (r, bs) => {
      const cuts = [r.lo, r.hi];
      bs.forEach(b => [b.lo, b.hi].forEach(u => {
        if (u > r.lo + 1e-6 && u < r.hi - 1e-6) cuts.push(u);
      }));
      cuts.sort((a, b) => a - b);
      const out = [];
      for (let i = 0; i < cuts.length - 1; i += 1) {
        const lo = cuts[i], hi = cuts[i + 1];
        if (hi - lo < 0.01) continue;
        const mid = (lo + hi) / 2;
        const over = bs.filter(b => mid > b.lo && mid < b.hi);
        out.push({ lo, hi, drop: over.length ? Math.max(...over.map(b => b.open)) : 0 });
      }
      return out;
    };
    shownFdn.forEach(({ g, runs }) => {
      const shownBase = Math.max(g.baseE, fdn.grade);
      const bs = bucksOf(g);
      // ── THE POUR AND THE BEAM ARE ONE CONCRETE FACE FROM OUTSIDE ─────
      //
      // Movie, 26 Sep: *"on the elevations don't show the line where the pour
      // and grade beam [meet] - just show them all as concrete. in the
      // sections you can show that line."*
      //
      // THE NOTCH SHIPPED FIRST AND THIS REPLACES IT. Board #45's first half
      // drew the buck here as an opening in the top of the concrete -- his own
      // description of it before either of us had seen one -- and seeing it he
      // called it: the slab is poured INTO the buck and fills it, so what an
      // elevation looks at is one continuous concrete face. A step in it is a
      // joint this drawing has no business claiming. The SECTION still shows
      // it, and should: that is the view where the two pours are cut.
      //
      // WHAT STILL VARIES IS THE DOOR, and he said so in the same breath:
      // *"it will be 8" alot of the times but not for doors further back"*.
      // The door's own bottom is the fall -- 8" at the overhead door, 4 5/8"
      // at 27 ft in -- and it keeps it. Only the concrete runs flat.
      //
      // THE FILL FOLLOWS THE OUTLINE RATHER THAN THE OTHER WAY ROUND. Only the
      // outline is readable here: a door's recess is painted over its rough
      // opening down to where the door stands, which is exactly the strip a
      // stepped fill would leave empty -- so whether this fill steps or not is
      // invisible on any elevation. It is flat because the line is flat, and
      // the harness carries a note where its mutant would be.
      ctx.fillStyle = C.faceShade;
      runs.forEach(r => ctx.fillRect(X(r.lo), Y(g.topE),
        (r.hi - r.lo) * pxPerFt, (g.topE - shownBase) * pxPerFt));
      // ── AND WHAT THE CONCRETE IS CLAD IN GOES ONTO THAT FILL ─────────
      //
      // Movie, 28 Sep: *"we also need the FOUNDATION to be clickable -
      // sometimes someone may want finish added to the side of foundation
      // too"*, and the case that makes it ordinary rather than exotic:
      // *"sometimes it will be needed on the side of a house that has a
      // walkout for instance"*.
      //
      // FROM GRADE TO THE TOP OF THE POUR, which is the whole of what is
      // there to clad -- `shownBase` is already `max(baseE, grade)` and
      // `topE` is the concrete's own top. That top is the BOTTOM OF THE SILL
      // PLATE, the same line the wall's cladding above now runs down to, so
      // the two finishes meet on one line with nothing between them. Movie
      // asked it as a question and it is worth writing down: *"goes to top of
      // concrete/ bot of sill plate right?"* -- one line, two names.
      //
      // BARE CONCRETE UNLESS ASKED, and that is deliberate. Every wall above
      // has a DEFAULT finish; a foundation does not, because concrete is what
      // a foundation looks like and defaulting one would repaint the exposed
      // concrete of every drawing in existence. `wall.finish` set is the
      // drafter having chosen.
      //
      // CLIPPED TO THE RUNS, NOT TO THE FACE. `runs` is what `visibleRuns`
      // left after cutting this face against everything nearer, so the
      // cladding stops exactly where the grey under it stops -- one answer to
      // "what of this concrete can be seen", not a second one drawn here.
      if (opts && opts.finishes && g.wall && g.wall.finish
        && g.topE - shownBase > 0.02) {
        const FP = window.DraftFinishPatterns;
        if (!FP) {
          if (!warnedNoPatterns) {
            warnedNoPatterns = true;
            console.warn('cut-view: finishes were asked for, but finish-patterns.js '
              + 'is not loaded -- every wall will draw plain.');
          }
        } else {
          const finish = finishById(g.wall.finish);
          runs.forEach(r => {
            const x0 = X(r.lo), x1 = X(r.hi);
            if (x1 - x0 < 2) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, Y(g.topE), x1 - x0, (g.topE - shownBase) * pxPerFt);
            ctx.clip();
            FP.drawFinish(ctx, { x0, x1, yTop: Y(g.topE), yBottom: Y(shownBase), pxPerFt },
              finish, C);
            ctx.restore();
          });
        }
      }
      const plate = plateOf(g);
      if (!plate) return;
      // ── THE PLATE WEARS THE WALL'S FINISH, NOT ONE OF ITS OWN ────────
      //
      // Movie, 26 Sep: "make the sill plate match the 'finish' of main floor
      // (like how it does it on the house) ... we will be adding EXTERIOR
      // FINISH MATERIALS - the walls and sill should match the default
      // EXTERIOR FINISH".
      //
      // `C.face` IS THAT, TODAY, and it is the same constant paintFace and
      // the rim band use -- which is the whole reason the three read as one
      // surface. The plate is not a material a drafter picks; it is 1 1/2" of
      // wood with the siding run down over it, so whatever the wall above is
      // clad in, this is clad in.
      //
      // WHEN EXTERIOR FINISH MATERIALS LANDS this line has to follow the
      // WALL, not the palette: the moment a finish can differ per body or per
      // face, `C.face` stops meaning "this wall's cladding" and starts
      // meaning "the default one" -- and a garage in a different siding would
      // grow a 1 1/2" band of the house's at its foot. Said here rather than
      // left to be noticed, because it would look like a skin bug.
      // NOT ACROSS A DOOR. The plate is what the wall above bears on, and over
      // a buck there is no concrete for it to sit on and no wall over it --
      // there is a door.
      //
      // WHICH IS THE ONE THING IN THIS PAINTER STILL READING THE BUCKS. The
      // concrete's top stopped stepping at them (above), but that was never
      // this rule: the plate is about the WALL, and there is still no wall
      // over a door however the concrete under it is drawn.
      ctx.fillStyle = C.face;
      runs.forEach(r => notched(r, bs).filter(p => !p.drop)
        .forEach(p => ctx.fillRect(X(p.lo), Y(g.topE + plate),
          (p.hi - p.lo) * pxPerFt, plate * pxPerFt)));
    });
    // Strokes after every fill, so a near face can't erase a far corner.
    ctx.lineWidth = 1;
    const strokedV = new Set();
    shownFdn.forEach(({ g, runs }) => {
      const shownBase = Math.max(g.baseE, fdn.grade);
      const bs = bucksOf(g);
      // THE TOP OF CONCRETE GOES LIGHT UNDER A PLATE. Movie, 4 Oct: "make
      // the lower 'sil plate' line lighter" -- the top of the plate above it
      // is the line that reads; the concrete's own top is the quieter one.
      const plateLine = plateOf(g);
      if (plateLine) {
        ctx.strokeStyle = ink(0.45);
        ctx.beginPath();
        runs.forEach(r => { ctx.moveTo(X(r.lo), Y(g.topE)); ctx.lineTo(X(r.hi), Y(g.topE)); });
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.beginPath();
      runs.forEach(r => {
        // TOP AND BASE BOTH STRAIGHT THROUGH. The top followed the notches
        // until 26 Sep -- down at one jamb, along the sill, back up at the
        // other -- which is the step the note at the fill above records him
        // calling off. The base never stepped: a buck is cut out of the TOP of
        // the beam and the 20" under it is continuous concrete either way.
        if (!plateLine) { ctx.moveTo(X(r.lo), Y(g.topE)); ctx.lineTo(X(r.hi), Y(g.topE)); }
        ctx.moveTo(X(r.lo), Y(shownBase)); ctx.lineTo(X(r.hi), Y(shownBase));
      });
      ctx.stroke();
      // ── AND THE TOP OF THE SILL PLATE, A SECOND LINE OVER IT ──────────
      //
      // Movie, 4 Oct: "i'm considering adding a second line (1.5\" down) to
      // show the location of the sill plate" -- both lines, on the house and
      // the garage: the top of concrete above, the top of the plate 1 1/2"
      // over it. Only where a plate is drawn, and not across a door buck,
      // which carries none.
      if (plateLine) {
        ctx.beginPath();
        runs.forEach(r => notched(r, bs).filter(p => !p.drop).forEach(p => {
          ctx.moveTo(X(p.lo), Y(g.topE + plateLine)); ctx.lineTo(X(p.hi), Y(g.topE + plateLine));
        }));
        ctx.stroke();
        // ── A PT LADDER'S BOTTOM, A THIRD LINE, LIGHT ─────────────────
        //
        // Movie, 4 Oct: "what if the user changes to 'PT LADDER'? ... add
        // another line" -- the bottom of the ladder's 2x4 or 2x6 (PROJECT's
        // LADDER DEPTH), measured down from the top line, where it is set
        // into the pour. Only where PROJECT says this concrete is held down
        // by a ladder.
        const ladderFt = holdDownOf(g);
        const ladderBottom = g.topE + plateLine - ladderFt;
        if (ladderFt && ladderBottom > shownBase + 0.01 && ladderBottom < g.topE - 0.01) {
          ctx.strokeStyle = ink(0.45);
          ctx.beginPath();
          runs.forEach(r => notched(r, bs).filter(p => !p.drop).forEach(p => {
            ctx.moveTo(X(p.lo), Y(ladderBottom)); ctx.lineTo(X(p.hi), Y(ladderBottom));
          }));
          ctx.stroke();
          ctx.strokeStyle = INK;
        }
      }
      // THE RUN'S OWN ENDS, not the face's. Where a face disappears behind a
      // nearer one, that end is where its concrete stops being visible, which
      // is the corner the drafter sees -- and it is exactly the foot this fix
      // is about. A face clear of everything has one run and this is what it
      // always was.
      runs.forEach(r => [r.lo, r.hi].forEach(u => {
        const over = shownFdn.filter(({ g: o }) => o !== g
          && u > o.lo + 0.05 && u < o.hi - 0.05);
        const interior = over.length > 0;
        // ── A CORNER SHOWS ONLY AS FAR DOWN AS ITS FACE DOES ───────────
        //
        // Movie, 24 Sep, marking a 2 STOREY + GARAGE + ROOM OVER on E3 BACK
        // and again on E2 LEFT: "here are some small errors (with red
        // highlight)", "another small spot (opposite where garage
        // connects)". One light vertical crossing the floor line, the full
        // depth of the exposed concrete, in the middle of a wall with
        // nothing behind it to crease.
        //
        // IT IS THE GARAGE'S, SEEN THROUGH THE HOUSE. Its left corner is at
        // x = -4, which on that elevation falls well inside the house's own
        // span -- the house's concrete stands in front of it for the whole
        // height. The run survives `behindFdn` on a technicality: the
        // garage's concrete tops out THREE EIGHTHS OF AN INCH above the
        // house's (8.125 against 8.09375, two different answers to "how tall
        // is the foundation"), so `o.topE >= g.topE` fails and the face
        // counts as unhidden. Three eighths of an inch of it really is
        // visible; the other eleven inches are not.
        //
        // SO THE LINE IS CLIPPED TO WHAT SHOWS rather than the run being
        // thrown away. Throwing it away would be the all-or-nothing answer
        // the note above this pass was written against.
        //
        // AND ON THIS FIXTURE THERE IS NOTHING LEFT TO CLIP, since 26 Sep.
        // `behindFdn` measures cover to the top of the near face's PLATE now,
        // not to the top of its concrete, so a face whose step is hidden
        // behind a sill plate yields no runs and never reaches this pass --
        // the reading this note called a technicality, answered where it
        // arose. What is left here is the real case: a far face that genuinely
        // stands proud of what is in front of it, clipped to the part that
        // shows rather than drawn whole or dropped.
        //
        // THE 3/8" ITSELF IS NOT THIS PASS'S TO FIX. It is the build handing
        // the garage's beam `assemblyFor(1).wallHeightFt` while the house's
        // own walls took the generic default wall top, and reconciling those
        // is a question about the junction, not about the drawing of it.
        const hiddenTo = over.reduce((top, { g: o }) =>
          (o.depth > g.depth + 1e-6 ? Math.max(top, o.topE) : top), shownBase);
        const foot = Math.max(shownBase, Math.min(g.topE, hiddenTo));
        // NOTHING LEFT MEANS NO CLAIM ON THIS u EITHER. The key is taken only
        // by a corner that actually draws, so a face buried here cannot stop
        // one that is not from drawing at the same spot.
        if (g.topE - foot < 0.01) return;
        const key = `${X(u)}|${interior}`;
        if (strokedV.has(key)) return;
        strokedV.add(key);
        ctx.strokeStyle = interior ? CREASE : INK;
        ctx.beginPath();
        // UP THROUGH THE PLATE AT AN OUTLINE CORNER, so the building's edge is
        // one line from the wall above to the footing below. The plate filled
        // a few lines up is part of THIS face -- same width, same two ends --
        // and a corner that stopped at the concrete left the outline broken
        // by exactly the 1 1/2" Movie could see.
        //
        // NOT AT A BURIED ONE. A crease is concrete seen against concrete and
        // its length is decided by what covers it, which `foot` above is the
        // whole argument about; carrying it up into the plate would state a
        // step in the plates that the plates do not have -- both stacks bear
        // the house's floor, so their TOPS meet even where their concrete
        // steps. The wall and the rim band draw their own corner above the
        // bearing line, and this is where the two meet.
        ctx.moveTo(X(u), Y(g.topE + (interior ? 0 : plateOf(g))));
        ctx.lineTo(X(u), Y(foot));
        ctx.stroke();
      }));
    });

    // Underground: outline-only loops, one per building mass, gaps preserved.
    const buried = fdnGeoms.filter(g => g.baseE < fdn.grade)
      .sort((a, b) => a.lo - b.lo);
    const bottomOf = g => g.bearing ? g.baseE - fdn.footingIn / 12 : g.baseE;
    const runs = [];
    buried.forEach(g => {
      const last = runs[runs.length - 1];
      if (last && g.lo <= last.hi + 0.5) {
        last.hi = Math.max(last.hi, g.hi);
        last.faces.push(g);
      } else runs.push({ lo: g.lo, hi: g.hi, faces: [g] });
    });
    ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    runs.forEach(run => {
      const edgeFace = u => run.faces.reduce((best, g) =>
        Math.min(Math.abs(g.lo - u), Math.abs(g.hi - u))
          < Math.min(Math.abs(best.lo - u), Math.abs(best.hi - u)) ? g : best);
      const leftF = edgeFace(run.lo), rightF = edgeFace(run.hi);
      // Bottom silhouette: the deepest concrete under each stretch of the
      // run — a footing under bearing walls, the beam base where it hangs.
      // Asked over the FOOTING's extent, to match the stops below: a wall's
      // concrete stops at g.lo, the footing under it does not.
      const bottomAt = u => Math.min(...run.faces
        .filter(g => g.lo - g.projFt - 1e-6 <= u && u <= g.hi + g.projFt + 1e-6)
        .map(bottomOf));
      // ── A FOOTING IS WIDER THAN THE WALL ON IT, AT BOTH ENDS ──────────
      //
      // Movie, 25 Sep, on E4 of a 2 STOREY + GARAGE + ROOM OVER: "the 6" X 8"
      // side of footing on left side of the house foundation is also missing".
      // Measured on the file he sent, the right step was drawn and the left
      // was not:
      //
      //     u  20.50   e -9.70..-9.05    the 6" step, 8" deep
      //     u -20.50   (nothing)
      //
      // THE PROJECTION BELONGED TO THE RUN, NOT TO THE FACE. These stops were
      // each face's WALL extent, and only the run's two outer ends had
      // `projFt` added -- once through `run.lo - leftF.projFt` and once
      // through the `stops[s + 1] === run.hi` special case. An attached
      // garage's grade beam OVERLAPS the house across GARAGE_TIE_FT, so the
      // two merge into one run whose left end is the BEAM's (u -46, and a
      // hung beam has no footing, correctly projFt 0). The house's own left
      // end at u -20 is then interior to that run, and nothing spent its 6".
      //
      // The crease pass below could not cover it either: it fires only where
      // a face ends strictly INSIDE a farther one, and the house's end sits
      // exactly on the beam face's own edge rather than within it.
      //
      // SO THE STOPS ARE THE FOOTING'S extent rather than the wall's, and
      // both ends of every face fall out of one rule. The two special cases
      // go with it -- the run's ends are just the outermost stops now.
      const footLo = g => g.lo - g.projFt;
      const footHi = g => g.hi + g.projFt;
      const startU = run.lo - leftF.projFt;
      const endU = run.hi + rightF.projFt;
      const stops = [...new Set([startU, endU,
        ...run.faces.flatMap(g => [footLo(g), footHi(g)])])]
        .filter(u => u >= startU - 1e-6 && u <= endU + 1e-6)
        .sort((a, b) => a - b);
      // ── AND A FOOTING'S SIDE IS ONLY AS TALL AS THE FOOTING ───────────
      //
      // Movie, 26 Sep, marking it in green on E4 and again on E2: "the
      // footing line looks like the 8" side of footing extends all the way
      // up but should stop after 8"".
      //
      // THE RISER AT A STOP CLIMBED TO THE NEXT BOTTOM, whatever stood
      // between. Measured on repro-2storey-garage-beam, E2, at the house
      // footing's outer edge where the garage's hung beam takes over:
      //
      //     u -20.50   e -9.823..-9.173   0.65 ft    the left end, right
      //     u  20.50   e -9.823..-9.173   0.65 ft    the 8" side, drawn
      //     u  20.50   e -9.823..-3.823   6.00 ft    AND this, over it
      //
      // Six feet of line up the side of an eight-inch footing, standing in
      // ground that holds nothing: above the footing's top there is no
      // concrete at that u at all until the beam, three feet further in.
      //
      // WHY ONLY ONE END. The run's outer ends are walked by hand and the
      // left one already does this -- down the wall, out 6", down 8". The
      // INTERIOR stops are walked by the loop, which knew the bottom either
      // side and nothing about what owns it.
      //
      // THE SIDE BELONGS TO WHATEVER OWNS THE BOTTOM. A bearing wall's
      // bottom is its footing's underside and its side is the 8" to the
      // footing's top; a hung beam's bottom IS its own underside and its
      // side runs the beam. So the cap is read off the piece that owns the
      // deeper bottom, not off a constant -- which keeps it right when the
      // footing depth or the beam changes.
      const sideTopAt = u => {
        const here = run.faces.filter(g => footLo(g) - 1e-6 <= u && u <= footHi(g) + 1e-6);
        if (!here.length) return null;
        const deepest = Math.min(...here.map(bottomOf));
        return Math.max(...here.filter(g => bottomOf(g) <= deepest + 1e-6)
          .map(g => g.baseE));
      };
      ctx.beginPath();
      ctx.moveTo(X(run.lo), Y(Math.min(leftF.topE, fdn.grade)));
      ctx.lineTo(X(run.lo), Y(leftF.baseE));
      if (leftF.projFt > 0) ctx.lineTo(X(startU), Y(leftF.baseE));
      ctx.lineTo(X(startU), Y(bottomOf(leftF)));
      let prevBottom = bottomOf(leftF);
      for (let s = 0; s < stops.length - 1; s++) {
        const b = bottomAt((stops[s] + stops[s + 1]) / 2);
        if (b !== prevBottom) {
          // THE RISER IS THE DEEPER PIECE'S SIDE, whichever way the step
          // goes -- and it is asked on the side that OWNS the deeper bottom.
          // Going up, that is the stretch being left; going down, the one
          // being entered. E4 needed both: its run starts at the garage's
          // hung beam, so the house footing arrives as a DESCENT at u -20.50
          // and a rise-only cap left six feet of line standing there.
          const shallower = Math.max(b, prevBottom);
          const deeper = Math.min(b, prevBottom);
          const top = sideTopAt(stops[s] + (b < prevBottom ? 0.01 : -0.01));
          const cap = top == null ? shallower
            : Math.min(shallower, Math.max(top, deeper));
          // The 6" back to the wall face, and the rise above it, are NOT
          // this profile's to draw: they run BACKWARD in u, which a
          // left-to-right silhouette cannot express. The shoulder pass below
          // draws the horizontal and the crease pass the vertical, each
          // where the ink actually goes.
          if (b < prevBottom) {
            if (cap !== prevBottom) ctx.moveTo(X(stops[s]), Y(cap));
            ctx.lineTo(X(stops[s]), Y(b));
          } else {
            ctx.lineTo(X(stops[s]), Y(cap));
            if (cap !== b) ctx.moveTo(X(stops[s]), Y(b));
          }
        }
        ctx.lineTo(X(stops[s + 1]), Y(b));
        prevBottom = b;
      }
      if (prevBottom !== bottomOf(rightF)) {
        ctx.lineTo(X(run.hi + rightF.projFt), Y(bottomOf(rightF)));
      }
      if (rightF.projFt > 0) {
        ctx.lineTo(X(run.hi + rightF.projFt), Y(rightF.baseE));
        ctx.lineTo(X(run.hi), Y(rightF.baseE));
      }
      ctx.lineTo(X(run.hi), Y(Math.min(rightF.topE, fdn.grade)));
      ctx.stroke();
      // ── A PIECE THE SILHOUETTE SWALLOWS STILL HAS A BOTTOM ────────────
      //
      // Movie, 25 Sep, marking it in green on E1 of a 2 STOREY + GARAGE: "i
      // noticed the bottom of the dashed line for the grade beam is missing
      // where it crosses the house".
      //
      // `bottomAt` IS A SILHOUETTE: the DEEPEST concrete under each stretch,
      // which is the right answer for the loop above -- that outline is the
      // edge of the excavation and nothing shows below it. It is the wrong
      // answer for the beam. Measured on repro-tie-gable, E1:
      //
      //     the garage's grade beam   u  -4.00..20.00   base -3.8438
      //     the house's footing       u -16.50..16.50   base -9.9479
      //
      //     drawn:  -9.9479 from -16.50 to 16.50, then -3.8229 to 20.00
      //
      // -- so the beam's underside appears for the 3 1/2 ft it hangs clear of
      // the house and vanishes for the twenty it hangs over. A hung beam
      // OVERLAPS the house by GARAGE_TIE_FT by construction, so this is every
      // attached grade beam on the office default, on every elevation that
      // sees it. E2 loses 1 1/2 ft of it, E4 the same, E1 twenty.
      //
      // A SILHOUETTE IS NOT AN OCCLUSION. `bottomAt` is deeper here because
      // the house's FOOTING is deeper, and a footing eight inches tall at
      // e -9.82 hides nothing at e -3.84; the beam's underside is an edge of
      // concrete crossing empty ground and belongs on the sheet. So where
      // the silhouette is deeper than a face's own base, that base is drawn.
      //
      // EXCEPT BEHIND A BEARING WALL, which Movie ruled on twice on 26 Sep --
      // on E3 BACK, "the grade beam line extends over the house foundation
      // (which is in front of the grade beam) ... the grade beam dashed line
      // bottom shouldn't show", and again on E2 LEFT, "the bottom dashed line
      // of the grade beam is extending into where the house foundation should
      // be in front". Measured on repro-2storey-garage-beam:
      //
      //     E3  the garage's beam  u -20.00.. 4.00  depth -46  base -3.8438
      //         the house's wall   u -16.00..16.00  depth  20  base -9.1771
      //         drawn: -3.8229 from -20.00 to 4.00, twenty feet of it
      //                behind twenty feet of house
      //     E2  the beam u 19.00..46.00 depth -20, the house u -20..20
      //         depth 16 -- the foot of GARAGE_TIE_FT overlap, drawn
      //
      // THE SAME RULE THE PILES GOT, in the same words: a piece of concrete
      // standing between the viewer and the thing is what the drawing shows
      // there. `o.depth > g.depth + 1` keeps a face from being read as
      // standing in front of itself.
      //
      // AND ONLY WHERE ITS CONCRETE IS AT THIS ELEVATION -- which is the
      // whole of the rest of it, and is why this does NOT need the piles'
      // `bearing` test. That one exists because a pile runs to the bottom of
      // the sheet, so the question can only be asked about the wall; here the
      // thing being hidden is a single elevation and the concrete in front
      // either reaches it or does not. A garage's own near beam is then no
      // threat to its own far one: they hang at the SAME elevation, merge
      // into one entry in `byElev` before anything is stroked, and the near
      // one draws the very stretch the far one would have. Measured with the
      // test removed, across every fixture and elevation in proto/: not one
      // stroke moves. A hung face that reaches DEEPER than the beam and
      // stands in front of it should hide it, and this lets it.
      //
      // CLIPPED, NOT DROPPED. The piles ask a yes/no question about one
      // station and can afford the 0.05 slack that keeps a pile at a wall's
      // own end from reading as behind it. A bottom is a RANGE, so the wall's
      // exact edges cut it: a stretch that only touches the wall's end loses
      // nothing, and one that runs under it loses exactly that much. Which
      // also means the covering wall's ends do not have to be `stops` -- they
      // are not, `stops` being the FOOTING extents, so the house's own edge
      // at u -16.00 is a stop on E3 only by the accident of a garage face
      // ending there.
      //
      // ONLY WHERE THE SILHOUETTE IS NOT ALREADY IT. `bottomAt` is a minimum
      // over the faces covering u and g is one of them, so it is either g's
      // own bottom -- already drawn, skip -- or deeper, which is the stretch
      // this pass is for. Over the same `stops`, so a step lands on the same
      // u the outline steps at and the two cannot disagree.
      // AND MERGED BY ELEVATION BEFORE ANYTHING IS STROKED. Two faces of one
      // mass project to the same run at the same depth of concrete -- a
      // garage's front beam and its back beam both land here -- and they
      // rarely span the SAME stretch, so an exact-match dedupe let the
      // overlap through twice. Measured: E1 drew u -4.00..16.50 and then
      // u 16.00..16.50 again, half a foot of dashes at double weight.
      const clipOut = (parts, iv) => parts.flatMap(p => {
        if (iv.hi <= p.lo + 1e-6 || iv.lo >= p.hi - 1e-6) return [p];
        const kept = [];
        if (iv.lo > p.lo) kept.push({ lo: p.lo, hi: iv.lo });
        if (iv.hi < p.hi) kept.push({ lo: iv.hi, hi: p.hi });
        return kept;
      });
      const byElev = new Map();
      run.faces.forEach(g => {
        const mine = bottomOf(g);
        const lo = footLo(g), hi = footHi(g);
        const key = mine.toFixed(4);
        const walls = run.faces.filter(o => o.depth > g.depth + 1
          && bottomOf(o) <= mine + 1e-6 && o.topE > mine + 1e-6);
        const into = byElev.get(key) || byElev.set(key, { e: mine, segs: [] }).get(key);
        for (let s = 0; s < stops.length - 1; s++) {
          const a = Math.max(stops[s], lo), b = Math.min(stops[s + 1], hi);
          if (b - a < 0.05) continue;
          if (bottomAt((a + b) / 2) > mine - 1e-6) continue;
          walls.reduce(clipOut, [{ lo: a, hi: b }])
            .forEach(p => { if (p.hi - p.lo >= 0.05) into.segs.push(p); });
        }
      });
      byElev.forEach(({ e, segs }) => {
        const merged = [];
        segs.sort((a, b) => a.lo - b.lo).forEach(seg => {
          const last = merged[merged.length - 1];
          if (last && seg.lo <= last.hi + 1e-6) last.hi = Math.max(last.hi, seg.hi);
          else merged.push({ lo: seg.lo, hi: seg.hi });
        });
        if (!merged.length) return;
        ctx.beginPath();
        merged.forEach(seg => {
          ctx.moveTo(X(seg.lo), Y(e));
          ctx.lineTo(X(seg.hi), Y(e));
        });
        ctx.stroke();
      });
      // ── AND A FOOTING ENDS WITH A SHOULDER WHEREVER IT ENDS ───────────
      //
      // Movie, 25 Sep: "the left footing doesn't stick out 6" x 8" deep", and
      // again on 26 Sep, on a later build: "the dashed footings were
      // sometimes flat on one side".
      //
      // "SOMETIMES" AND "ONE SIDE" ARE THE WHOLE DIAGNOSIS. The shoulder is
      // drawn by the loop above, and only ever at the run's two OUTER ends --
      // `leftF.projFt > 0` on the way in, `rightF.projFt > 0` on the way out.
      // An attached grade beam HANGS (projFt 0, correctly: there is no
      // footing under it) and it OVERLAPS the house by GARAGE_TIE_FT, so the
      // two merge into one run whose outer end on that side is the BEAM's.
      // The house's own footing end is then interior to the run and nothing
      // spends its 6". Measured on repro-2storey-garage-beam, which the page
      // built from the drive-thru rather than being written by hand:
      //
      //     E1   e -9.1729  u -16.50..-16.00     drawn, the run's left end
      //          u 16.00..16.50                  NOTHING -- the beam's end
      //     E4   e -9.1729  u  20.00.. 20.50     drawn, the run's right end
      //          u -20.50..-20.00                NOTHING
      //
      // -- which is "one side", and it is whichever side the garage is on.
      //
      // THE HORIZONTAL IS ALL THAT IS MISSING. The vertical at the footing's
      // outer edge is already there: the silhouette steps up at that u from
      // the footing's bottom to whatever is shallower next door, and that
      // riser passes straight through the 8". What it does not do is turn the
      // 6" at the top, so the footing reads as running on under the beam
      // instead of stopping and stepping in.
      //
      // NOT WHERE CONCRETE CARRIES THROUGH. Another face whose own base
      // reaches at least this deep across the same stretch means the footing
      // does not end here at all -- an L-shaped house, a wall meeting a wall
      // -- and there is no shoulder to draw. The two coincident faces of one
      // wall line (a front and a back at the same u) do NOT trip it: their
      // walls stop at the same u, so neither spans the other's 6".
      const shoulders = new Set();
      run.faces.forEach(g => {
        if (g.projFt <= 0) return;
        [[g.lo, footLo(g)], [g.hi, footHi(g)]].forEach(([at, out]) => {
          const lo = Math.min(at, out), hi = Math.max(at, out);
          if (lo <= startU + 1e-6 || hi >= endU - 1e-6) return;
          if (run.faces.some(o => o !== g && o.baseE <= g.baseE + 1e-6
            && o.lo <= lo + 1e-6 && o.hi >= hi - 1e-6)) return;
          const key = `${g.baseE.toFixed(4)}|${lo.toFixed(4)}|${hi.toFixed(4)}`;
          if (shoulders.has(key)) return;
          shoulders.add(key);
          ctx.beginPath();
          ctx.moveTo(X(lo), Y(g.baseE));
          ctx.lineTo(X(hi), Y(g.baseE));
          ctx.stroke();
          // ── AND THE WALL ABOVE THE SHOULDER ─────────────────────────
          //
          // Movie, 26 Sep, marking it in green on E1: "the footing is
          // correct, but the line of the ext of foundation wall going up to
          // grade level is missing".
          //
          // IT WAS NEVER DRAWN; THE RISER WAS STANDING IN FOR IT. Before the
          // cap above, the silhouette climbed the full step at the FOOTING's
          // outer edge -- six feet at u 16.50 -- and read as the foundation's
          // edge going up. Capping it to the footing's own 8" was right and
          // left the wall's real face, a foot further in, bare. Measured on
          // repro-2storey-garage-beam E1:
          //
          //     u -16.00   -9.173..-2.323   the run's own left end, drawn
          //     u  16.00   NOTHING          interior to the merged run
          //
          // THE OUTLINE ONLY WALKS THE RUN'S TWO OUTER ENDS, which is the
          // same reason the shoulder above was missing: where a hung beam
          // laps the house, the house's own end is interior and no pass owned
          // it. This is the vertical that goes with that horizontal.
          //
          // TO GRADE, THROUGH WHATEVER IS IN FRONT. Underground there is no
          // occlusion -- the drawing shows an arrangement, not a view, which
          // is why a beam's underside is drawn over the house's footing -- so
          // the face runs from the footing's top to grade even where the
          // beam laps it.
          //
          // UNLESS THE CREASE PASS HAS IT. That pass draws exactly this
          // vertical where a FARTHER face contains the end; asked the same
          // way here, the two cannot both take the same u. On E2 the garage
          // is behind and the crease owns u 20; on E1 it is in front and
          // nothing did.
          const creased = run.faces.some(o => o !== g
            && o.depth < g.depth - 1e-6 && at > o.lo + 0.05 && at < o.hi - 0.05);
          if (creased) return;
          const top = Math.min(g.topE, fdn.grade);
          if (top - g.baseE < 0.01) return;
          ctx.beginPath();
          ctx.moveTo(X(at), Y(g.baseE));
          ctx.lineTo(X(at), Y(top));
          ctx.stroke();
        });
      });
      // Viewer-facing corner creases: where a nearer buried face ends inside
      // a farther one, the corner runs down the wall — and its footing turns
      // a little further over with its own short crease.
      run.faces.forEach(g => {
        [g.lo, g.hi].forEach(u => {
          const behind = run.faces.some(o => o !== g
            && o.depth < g.depth - 1e-6
            && u > o.lo + 0.05 && u < o.hi - 0.05);
          if (!behind) return;
          ctx.beginPath();
          ctx.moveTo(X(u), Y(Math.min(g.topE, fdn.grade)));
          ctx.lineTo(X(u), Y(g.baseE));
          ctx.stroke();
          if (g.projFt > 0) {
            const out = u === g.lo ? u - g.projFt : u + g.projFt;
            ctx.beginPath();
            ctx.moveTo(X(out), Y(g.baseE));
            ctx.lineTo(X(out), Y(bottomOf(g)));
            ctx.stroke();
          }
        });
      });
    });

    // ── WHERE THE PILES ARE, DASHED ──────────────────────────────────────
    //
    // Movie, 25 Sep, of an E4 with ten of them under the garage beam: "we
    // should should the dashed lines where the piles are located on this view
    // too". Nothing drew columns on an elevation at all before this -- the
    // env did not even serve them.
    //
    // WHERE, NOT HOW DEEP, and build-house.js's own footing table says why:
    // "Depth comes from the soils report, so the PLAN marks diameter and
    // centre only -- the schedule mark (P1/P2/P3) carries the length and the
    // steel." A P2 is 15' long and a P3 is 20', so a shaft drawn to its tip
    // would hang seven feet of empty ground under a two-storey elevation and
    // push the building up the sheet to make room for it. It runs from the
    // concrete it carries down to the bottom of the drawing and breaks there,
    // which is how a pile is shown on an elevation -- and the schedule is
    // where the length already lives.
    //
    // THE HEAD COMES FROM THE CONCRETE ABOVE IT, not from the pile: a column
    // stores its point and its footing and has no idea what it holds up. The
    // deepest buried face over that station is the grade beam's underside,
    // which is exactly where a drilled pile starts.
    const pileColumns = (env.columns ? env.columns() : [])
      .filter(column => (column.view || 'plan') === 'foundation'
        && String(column.footing || '').startsWith('pile')
        && column.point);
    // A pile carrying a post is drawn with its post, after the roof.
    const posts = pilePosts(env, stack);
    const postOf = new Set(posts.map(post => post.column));
    pileColumns.forEach(column => {
      if (postOf.has(column)) return;
      const u = column.point.x * axis.x + column.point.z * axis.z;
      if (u < uMin - 0.5 || u > uMax + 0.5) return;
      const over = fdnGeoms.filter(g => g.lo - 0.5 <= u && u <= g.hi + 0.5);
      if (!over.length) return;
      // ── NOT THROUGH THE FOUNDATION WALL IN FRONT OF IT ────────────────
      //
      // Movie, 26 Sep, on E2 of a 2 STOREY + GARAGE + ROOM OVER: "on inside
      // the far side pile shouldn't show because its 'behind' the foundation
      // wall".
      //
      // EVERY PILE WAS DRAWN, and the only question asked was whether any
      // concrete stood over its station at all. Measured on that build's E2:
      //
      //     the pile     u 19.3   depth -19.7
      //     the house    u -20..20   depth +16   -9.177..-1.177
      //
      // Twenty feet of house foundation between the viewer and it, and its
      // shaft drawn straight down the sheet through all of it.
      //
      // THIS IS NOT THE SAME QUESTION AS THE BURIED OUTLINE'S. Everything
      // below grade is dashed because it is hidden work, and a piece of
      // concrete does not hide another piece of concrete -- the drawing is
      // showing an arrangement, and the beam's underside over the house's
      // footing belongs on it for that reason. A PILE is not part of that
      // arrangement: it is a separate column standing behind a wall, and
      // Movie's rule is that the wall is what the drawing shows there.
      //
      // NEARER, OVER ITS STATION, AND BEARING -- three conditions, and the
      // third is the one the measurement forced. `depth` alone hid far too
      // much: a grade beam runs the garage's whole perimeter, so its FAR
      // side is nearer than a pile standing under its near side, and the
      // garage's own concrete deleted the garage's own piles. Counted
      // across the fixtures, depth-only took 20 pile edges to 2 on one
      // elevation and 4 to 0 on another:
      //
      //     repro-garage-house E1   piles u 8.0 at depth -4.0 and +4.0
      //                             garage faces u 8..20 at depth -4.0, +4.0
      //
      // A HUNG BEAM BESIDE A PILE IS NOT IN FRONT OF IT. They stand on one
      // perimeter and belong to one arrangement -- the beam is what the pile
      // carries. What hides a pile is a wall that runs to FOOTING DEPTH
      // between it and the viewer, which is the house's foundation, and
      // `bearing` is already how this file says "on a strip footing, not
      // hung". On Movie's E2 that is the house's wall at depth +16 over a
      // pile at -19.7: twenty feet of concrete in front of it.
      //
      // AND STRICTLY INSIDE THE WALL, not merely touching its end. A pile at
      // the junction stands at the same u as the house's corner -- the
      // garage's beam starts where the house's wall stops -- and a test with
      // slack either side reads that corner as covering it. Measured on
      // repro-garage-house E1: house u -8..8, the two piles both at u 8.0,
      // and a 0.05 tolerance deleted both. Nothing is behind a wall at the
      // wall's own end; it is beside it. The same strict form the buried
      // crease pass uses, for the same reason.
      const pileDepth = column.point.x * dir.x + column.point.z * dir.z;
      const infront = fdnGeoms.some(g => g.bearing && g.depth > pileDepth + 1
        && u > g.lo + 0.05 && u < g.hi - 0.05);
      if (infront) return;
      // A PILE CARRIES HUNG CONCRETE, and that is what picks the head where
      // two faces cover one station. At the corner where a garage's beam
      // meets the house, the house's own wall stands on a strip footing at
      // full depth and the beam hangs 5'-6" above it; taking the DEEPEST of
      // the two started the shaft below the beam it is holding up, so the
      // pile was drawn entirely under its own cap. A wall on a footing needs
      // no pile, so a hung face answers first and the deepest only when
      // nothing over the station hangs.
      const hung = over.filter(g => !g.bearing);
      const head = Math.min(...(hung.length ? hung : over).map(g => g.baseE));
      if (head <= yBottom) return;   // nothing of it is in the drawing
      const bh = window.DraftBuildHouse;
      if (!bh && !warnedNoFootings) {
        warnedNoFootings = true;
        // 12" IS A REAL SIZE, which is what makes this one dangerous: the pile
        // is drawn, correctly, at a width nobody chose. A wrong number that
        // looks right is worse than a blank.
        console.warn('cut-view: build-house.js is not loaded, so every pile '
          + 'footing is drawn at the 12" fallback rather than its own size.');
      }
      const sizeIn = (bh && bh.footingFor(column.footing).sizeIn) || 12;
      const half = sizeIn / 24;
      [u - half, u + half].forEach(edge => {
        ctx.beginPath();
        ctx.moveTo(X(edge), Y(head));
        ctx.lineTo(X(edge), Y(yBottom));
        ctx.stroke();
      });
    });
    ctx.setLineDash([]);

    // A thickened-edge detached slab has no foundation walls: its band is
    // the monolithic pour itself — GARAGE_SLAB_ABOVE_GRADE_IN proud of grade,
    // the 1'-0" perimeter edge buried and dashed. At the spec's 10" that
    // leaves exactly the 2" of edge in the ground it names as the cost;
    // at the 4" this drew before, it left 8".
    env.floors()
      .filter(floor => (floor.view || 'plan') === 'foundation'
        && floor.garage && floor.thickenedEdge && floor.points.length >= 3)
      .forEach(slab => {
        const us = slab.points.map(pt => pt.x * axis.x + pt.z * axis.z);
        const lo = Math.max(Math.min(...us), uMin);
        const hi = Math.min(Math.max(...us), uMax);
        if (hi - lo < 0.5) return;
        const top = fdn.grade + GARAGE_SLAB_ABOVE_GRADE_IN / 12;
        const x = X(lo), wid = (hi - lo) * pxPerFt;
        ctx.fillStyle = C.faceShade;
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(x, Y(top), wid, (top - fdn.grade) * pxPerFt);
        ctx.strokeRect(x, Y(top), wid, (top - fdn.grade) * pxPerFt);
        ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x, Y(fdn.grade), wid,
          (GARAGE_EDGE_DEPTH_IN / 12 - (top - fdn.grade)) * pxPerFt);
        ctx.setLineDash([]);
      });

    // Wall faces, far to near, each with the openings it hosts. A garage
    // face stands on its own bearing — the beam plate or the slab — so its
    // face and its doors run down to that, not to the house floor.
    // Hoisted to garageBearing so the SECTION can stand its garage walls on
    // the same line this elevation does. It could not before: drawSectionWall
    // never asked which body a wall belonged to, and every garage wall in
    // section stood on level.floorTop -- the main floor DECK, one whole floor
    // package above the sill it actually bears on.
    const garageBase = garage => garageBearing(env, fdn, garage);
    const HEAD_FT = 6 + 10 / 12, SILL_FT = 3;
    // A gable-end wall climbs to the roof: where a roof bearing on this
    // wall's plate runs a GABLE edge just past the face, the top of the
    // wall follows the underside of the rakes — the triangle between the
    // plate and the ridge is wall, not sky.
    // Board #346: the last of four outboard copies of point-to-segment,
    // collapsed onto the shared export. No caller-local fallback — both callers
    // are asking "is this wall along that gable edge", and the export's refusal
    // of a sub-0.01ft segment is the right answer to that question.
    //
    // The `|| 1` this replaces made a zero-length gable edge behave as a POINT:
    // a wall within `reach` of it would climb, and two rake ends within 0.1ft
    // of it would read as lying along it. An edge under an eighth of an inch is
    // not a gable, and the export declines to measure one.
    //
    // This helper had no coverage of any kind when the sweep reached it —
    // always-Infinity and always-zero both left twenty specs and both harnesses
    // green, and the one check that named the behaviour, "E4: the near
    // gable-end wall still climbs its gable", passed whether the wall climbed
    // or not. That check now counts wall ink alone and fails for the right
    // reason; the collapse rides on it rather than on nothing.
    const distToSegment = (p, a, b) => geo().pointToSegment(p, { start: a, end: b }).d;
    // ── A WALL THAT CARRIES A STOREY HAS NO GABLE TO CLIMB ───────────────
    //
    // Movie, 29 Sep, on a BILEVEL + ATTACHED ROOM-OVER GARAGE: a line leaves
    // the top of the little lean-to and runs across the house face, climbing,
    // then stops in mid-wall. It was the house's own main-floor face: its top
    // left the plate at the garage's near corner, peaked at the garage RIDGE,
    // and came back down to the plate where the garage ended.
    //
    // The garage's gable edge is the line the garage shares with the house —
    // no overhang, dying straight into it — and the house wall on that line
    // bears the same plate, so every test below passed and the wall climbed
    // the garage's triangle. But the house is two storeys there: that wall
    // goes on up to its own second-floor plate, and the second storey stands
    // on it. There is no triangle of wall between the plate and those rakes;
    // there is a floor, and a wall above that.
    //
    // A gable triangle exists only where the storey is the LAST one on that
    // wall. `floorBottom` of the storey above IS this storey's plate (see
    // sectionLevelStack), so "something stands on this plate along this wall"
    // is the exact question, and the answer is a wall record rather than a
    // guess about build type — a two-storey house with a one-storey wing gets
    // its gable on the wing and not on the body, from the same test.
    //
    // STANDING ON IT, NOT MERELY NEAR IT. The wall above has to share a
    // stretch of this one, measured along it. A garage gable end meeting the
    // house square on touches a second-floor wall at its last station and
    // runs parallel to another a foot off, sharing only a corner with it;
    // neither stands on the gable wall, which climbs all the way to the house.
    const STOREY_ABOVE_EPS = 0.05;
    const CARRIED_REACH_FT = 1;
    const carriesStoreyAbove = (pt, plateTop, wall, wallDir) => faces.some(other => {
      if (other.level.floorBottom < plateTop - STOREY_ABOVE_EPS) return false;
      const along = q => (q.x - wall.start.x) * wallDir.x + (q.z - wall.start.z) * wallDir.z;
      const own = along(wall.end);
      const a = along(other.wall.start), b = along(other.wall.end);
      const shared = Math.min(Math.max(a, b), Math.max(0, own))
        - Math.max(Math.min(a, b), Math.min(0, own));
      if (shared <= STOREY_ABOVE_EPS) return false;
      return distToSegment(pt, other.wall.start, other.wall.end) <= CARRIED_REACH_FT;
    });
    // Only a wall running ALONG the gable climbs; a perpendicular wall
    // passing the gable's corner keeps its plate.
    const gableTopAt = (pt, plateTop, wallDir, wall) => {
      let top = plateTop;
      if (!facesByRoof) return top;
      if (carriesStoreyAbove(pt, plateTop, wall, wallDir)) return top;
      facesByRoof.forEach((roofFaces, roof) => {
        const base = roofBaseElev(roof, stack, env);
        if (Math.abs(base - plateTop) > 0.6) return;   // bears on another storey
        const reach = (Number(roof.overhang) || 0) + 1;
        const pts = roof.points || [];
        const nearGable = pts.some((a, i) => {
          if (roof.edges?.[i] !== 'gable') return false;
          const b = pts[(i + 1) % pts.length];
          if (wallDir) {
            const gx = b.x - a.x, gz = b.z - a.z;
            const gLen = Math.hypot(gx, gz) || 1;
            const cross = Math.abs(wallDir.x * gz - wallDir.z * gx) / gLen;
            if (cross > 0.2) return false;
          }
          return distToSegment(pt, a, b) <= reach;
        });
        if (!nearGable) return;
        const rise = sectionRoofHeightAt(pt, roof, roofFaces);
        if (rise == null) return;
        top = Math.max(top, base + rise);   // wall stops under the fascia
      });
      return top;
    };
    // A wall standing BEHIND a nearer roof is not visible through it. Walls
    // hide each other by the painter's algorithm — far first, each filled
    // opaque before it is stroked — and `faceHidden` skips the ones a nearer
    // wall swallows whole. Roofs never joined that: the roof passes stroke
    // edges onto the paper and fill nothing, so no wall has ever been hidden
    // by one. A far wing's gable-end wall therefore climbed its triangle
    // straight through a nearer wing's roof, which is the see-through this
    // board was raised for.
    //
    // Along the sightline a roof sheet covers a BAND of the elevation it
    // projects onto: from the lowest surface the ray crosses, less the
    // fascia hanging off that edge, up to the highest. The band, not a bare
    // height comparison, is the test — a gable's OWN roof stands nearer than
    // its wall and higher than its plate, yet sits on that wall rather than
    // in front of it. `gableTopAt` returns `base + rise` and the band's floor
    // works out to the same `base + rise` for that roof, so a wall is never
    // clipped by the roof it carries; EPS covers the float noise between two
    // spellings of one number.
    //
    // Only surfaces STRICTLY NEARER than the wall may hide it, so the ray runs
    // from the wall toward the viewer, the way `hidden()` does — but EXACTLY,
    // by clipping the real face polygons against it the way the section
    // painter does, not by marching stations. `roofFaceRise` is linear across
    // a face, so a piece's two ends bracket every height along it and the
    // band is read straight off the breakpoints. A sampled march put the
    // band's floor wherever a station happened to land — up to half a foot
    // above the eave it was meant to find, leaving a sliver of wall top
    // standing above a roof that covers it.
    // Each roof is banded ON ITS OWN. Merged, a low detached-garage roof and
    // the house roof behind it would read as one mass filling everything
    // between them, and a wall top standing in the clear air between the two
    // would be hidden by neither of them.
    const ROOF_COVER_EPS = 0.02;
    // A wall only hides what stands behind it: an eave overhanging toward the
    // viewer clears its own wall by the overhang, and a rake clears its gable
    // wall the same way, so the margin only has to beat float noise.
    const WALL_COVER_EPS = 0.05;
    // A roof edge landing exactly on a wall's END is at the corner, not behind
    // it: the flush cut where a garage roof dies into the house, and the ridge
    // starting off that wall, both sit on that line and stay drawn.
    const WALL_EDGE_EPS = 0.05;
    const fasciaFt = ROOF_FASCIA_IN / 12;
    const roofClippedTop = (pt, depth, top) => {
      if (!facesByRoof || !facesByRoof.size) return top;
      const span = dHi - depth;
      if (span < 0.1) return top;
      const far = { x: pt.x + dir.x * span, z: pt.z + dir.z * span };
      let clipped = top;
      facesByRoof.forEach((roofFaces, roof) => {
        const base = roofEaveElev(roof, stack, env);
        let lo = Infinity, hi = -Infinity;
        geo().roofProfile(roof, roofFaces, pt, far, dir).forEach(p => {
          const elev = base + p.rise;
          if (elev > hi) hi = elev;
          if (elev < lo) lo = elev;
        });
        if (hi === -Infinity) return;   // the ray misses this roof entirely
        lo -= fasciaFt;
        if (top > lo + ROOF_COVER_EPS && top <= hi + ROOF_COVER_EPS) clipped = Math.min(clipped, lo);
      });
      return clipped;
    };
    // ── AND THE SAME QUESTION AT THE OTHER END OF THE WALL ────────────────
    //
    // Movie, 26 Sep, on a 2 STOREY + GARAGE: "found another very small problem
    // where the garage connects to the house again at the gable ... a grey
    // line goes down (that shouldn't show) ... the grey line covers the black
    // line (black ext house wall line should show)".
    //
    // IT IS ONE LINE HALF PAINTED OVER. Read off the canvas in DAY mode at the
    // house's front-right corner, twoStorey-garage E4, one pixel column:
    //
    //     e 13.05 .. 11.00   x621 = 29     the corner, in ink
    //     e 10.83 ..  9.30   x621 = 199    the same stroke, a ghost of it
    //     e  9.21 ..  8.70   x621 = 255    and then nothing at all
    //
    // 29 is the ink and 255 the paper, so 199 is a 1px stroke with most of it
    // painted back out. THE FILLS ALREADY HIDE WHAT IS BEHIND THEM -- the tie
    // roof's sheet is keyed on its nearest corner and goes down after the
    // house's wall, which is right -- but a stroke sitting ON the fill's own
    // edge is covered by whatever fraction of that pixel the fill claims. Half
    // a line is the one answer that is never correct: the corner is either in
    // front of the sheet, in which case it is ink, or behind it, in which case
    // it is nothing.
    //
    // BEHIND IT. The tie's piece runs x 16..22 by z 17..20 (premade-plans's
    // garageTieRoofLoop) and the house's right wall IS x = 16, so every inch
    // of that sheet stands between the viewer and this corner. The line Movie
    // wants back above it is the same stroke, where no sheet covers it.
    //
    // SO THIS IS roofClippedTop's OTHER END: that one drops a wall's TOP to
    // the floor of a band that swallows it, and this one lifts a wall's END
    // VERTICAL off its floor to the CEILING of a band that covers the foot.
    // Same ray, same bands, same fascia allowance -- the two tests differ only
    // in which end of the wall is asked about.
    const roofClippedFoot = (pt, depth, floor, top) => {
      if (!facesByRoof || !facesByRoof.size) return floor;
      const span = dHi - depth;
      if (span < 0.1) return floor;
      const far = { x: pt.x + dir.x * span, z: pt.z + dir.z * span };
      let lifted = floor;
      facesByRoof.forEach((roofFaces, roof) => {
        const base = roofEaveElev(roof, stack, env);
        let lo = Infinity, hi = -Infinity;
        geo().roofProfile(roof, roofFaces, pt, far, dir).forEach(p => {
          const elev = base + p.rise;
          if (elev > hi) hi = elev;
          if (elev < lo) lo = elev;
        });
        if (hi === -Infinity) return;   // the ray misses this roof entirely
        lo -= fasciaFt;
        if (floor >= lo - ROOF_COVER_EPS && floor < hi - ROOF_COVER_EPS) {
          lifted = Math.max(lifted, hi);
        }
      });
      // NEVER PAST THE TOP: a wall covered to its head draws no vertical at
      // all, and a foot above its own head would draw one upside down.
      return Math.min(lifted, top);
    };
    // HOW FAR ABOVE ITS STOREY'S FLOOR A WALL STARTS: only a wall hung under
    // a roof pushed out over the storey below (`hoodOf`) says, and it starts
    // on that storey's ceiling. Every other wall stands on its floor.
    const hungBy = wall => (wall.hoodOf ? Math.max(0, Number(wall.baseHeight) || 0) : 0);
    const faceGeoms = faces.map(face => {
      const { wall, u1, u2, level } = face;
      const loU = Math.max(Math.min(u1, u2), uMin);
      const hiU = Math.min(Math.max(u1, u2), uMax);
      const floor = face.garage ? garageBase(face.garage) : level.floorTop + hungBy(wall);
      const worldAt = u => {
        const t = (u - u1) / (u2 - u1);
        return {
          x: wall.start.x + (wall.end.x - wall.start.x) * t,
          z: wall.start.z + (wall.end.z - wall.start.z) * t,
        };
      };
      const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) || 1;
      const wallDir = {
        x: (wall.end.x - wall.start.x) / wallLen,
        z: (wall.end.z - wall.start.z) / wallLen,
      };
      const samples = Math.min(64, Math.max(2, Math.ceil((hiU - loU) / 0.5)));
      // Dropped to the floor of a nearer roof's band when that band swallows
      // the wall's top. What is left below still meets the nearer WALLS, and
      // the painter's opaque fill goes on covering that the way it always has.
      // Never below the face's own floor: a band floor under this storey
      // would turn the face inside out rather than hide it.
      const sampleTop = u => {
        const at = worldAt(u);
        const raw = gableTopAt(at, level.wallTop, wallDir, wall);
        const top = Math.max(floor, roofClippedTop(at, face.depth, raw));
        return { top, clipped: top < raw - 1e-6 };
      };
      const tops = [];
      let prev = null;
      for (let s = 0; s <= samples; s++) {
        const u = loU + (hiU - loU) * s / samples;
        const here = sampleTop(u);
        // WHERE A ROOF IN FRONT STARTS OR STOPS SWALLOWING THE TOP, the top
        // STEPS there. Joined sample to sample it drew a slanted line a
        // whole sample long across the wall (Movie's corner-garage E4), so
        // the step is found by halving and drawn plumb.
        if (prev && prev.clipped !== here.clipped) {
          let a = prev.u, b = u;
          for (let k = 0; k < 14; k++) {
            const m = (a + b) / 2;
            if (sampleTop(m).clipped === prev.clipped) a = m; else b = m;
          }
          tops.push({ u: a, top: sampleTop(a).top });
          tops.push({ u: b, top: sampleTop(b).top });
        }
        tops.push({ u, top: here.top });
        prev = { u, clipped: here.clipped };
      }
      return { face, loU, hiU, floor, worldAt, wallDir, tops };
    });
    // A face standing entirely behind a nearer, taller face paints nothing
    // visible; skipping it keeps the shared corner verticals single-stroked.
    const faceHidden = geom => faceGeoms.some(other =>
      other !== geom && other.face.depth > geom.face.depth + 1e-6
      && other.loU <= geom.loU + 0.05 && other.hiU >= geom.hiU - 0.05
      && other.floor <= geom.floor + 1e-3
      && geom.tops.every(s =>
        gableTopAt(other.worldAt(s.u), other.face.level.wallTop, other.wallDir,
          other.face.wall) >= s.top - 1e-3));
    // ── THE CLADDING ON ONE FACE ──────────────────────────────────────
    //
    // A BASE OVER THE WHOLE FACE, THEN THE BANDS OVER THAT, in the order they
    // were laid -- which is what makes "last band wins" true of the drawing
    // and not merely of the rule that reads the record. Each band repaints the
    // face fill under itself first, so a ledgestone wainscot on a brick wall
    // shows ledgestone rather than both at once.
    //
    // MEASURED FROM THE FOOT OF THE FACE. `lowFt: 0` is where the cladding
    // starts, which on a finished elevation is the top of the concrete -- so
    // "the bottom 3 ft" is 0 to 3 whatever the foundation under it is.
    // ── THE THREE LINES A FACE'S FINISHES ARE MEASURED FROM ───────────
    //
    // wall-types.js says a band is anchored to a line a drafter NAMES; this is
    // where those names get their numbers, per face, because only the painter
    // knows them.
    //
    //   SILL   where this storey's cladding starts. On the storey that bears
    //          on concrete that is the BOTTOM OF THE SILL PLATE -- Movie,
    //          27 Sep: *"the top area where they should start the finishing
    //          should be the bottom of the sill plate"* -- which is the top of
    //          the concrete, a plate below the floor structure. On a storey
    //          above, there is no sill plate and the cladding runs down over
    //          the rim, so it is that floor's own underside.
    //   PLATE  the top of the wall, which is the bottom of a gable triangle.
    //   HEAD   the top of the face, whatever is there: a ridge, a rake, or
    //          simply the plate again on a wall with no gable over it.
    //
    // AND THE SILL IS WHAT PUTS THE FINISH ON THE PLATE. The note at the
    // foundation's plate pass says this line has to follow the WALL when
    // exterior finishes land, or a garage in different siding grows a band of
    // the house's at its foot. It follows it here: the plate is inside the
    // face's own cladding now, because the cladding starts underneath it.
    // THE SILL MOVED OUT to module scope as faceSillFt, so the page that
    // draws a box round a face reads the same line the painter clads to. The
    // garage branch there recomputes `floor` from garageBearing rather than
    // taking geom's -- the same call geom's own `garageBase` makes, with the
    // same env and the same stack.foundation, so this is the number it always
    // was and not a second opinion about it.
    const faceLines = geom => {
      const { face, floor, tops } = geom;
      return {
        sill: faceSillFt(env, face, stack),
        plate: face.level.wallTop,
        head: Math.max(...tops.map(t => t.top)),
        foot: floor,
      };
    };

    // ── WHAT WRAPS ONTO THIS FACE ─────────────────────────────────────
    //
    // A band carrying `wrapFt` turns the corner and runs that far along
    // whatever wall it meets. The RECORD lives on the wall the band is on;
    // the DRAWING happens on the wall next door -- so this is asked from the
    // neighbour's side, which is why the feature was easy to miss. Painting
    // the face that owns the band, there is nothing to draw.
    //
    // A SHARED POINT IS A CORNER, and that is the drawing's own definition
    // rather than a tolerance invented here: MODEL pools the vertex where two
    // walls meet, so a corner is ONE OBJECT and its coordinates are equal to
    // the bit. The comparison still carries a lattice-sized epsilon, because a
    // wall may arrive from a FILE rather than from the pool -- an imported
    // drawing, a hand-edited record, a plan turned a quarter -- and two walls
    // a millionth of a foot apart are a corner to every eye and every builder.
    //
    // SAME LEVEL AND SAME LAYER SET. A second-storey wall standing over this
    // one shares no corner with it in the building, only in plan; and a
    // foundation wall is concrete, which nothing wraps onto.
    const WRAP_TOL_FT = 1e-6;
    const sameCorner = (a, b) => !!a && !!b
      && Math.abs(Number(a.x) - Number(b.x)) < WRAP_TOL_FT
      && Math.abs(Number(a.z) - Number(b.z)) < WRAP_TOL_FT;

    const wrapsOnto = face => {
      const wall = face && face.wall;
      if (!wall || !wall.start || !wall.end) return [];
      // THE FORESHORTENING, once per face. A wall square to the cut draws its
      // whole length; one at an angle draws less, and the wrap has to shrink
      // with it or two feet of stone would cover more elevation than two feet
      // of the wall it is standing on.
      const runFt = Math.hypot(Number(wall.end.x) - Number(wall.start.x),
        Number(wall.end.z) - Number(wall.start.z));
      const duPerFt = runFt > WRAP_TOL_FT
        ? Math.abs(face.u2 - face.u1) / runFt : 0;
      if (!(duPerFt > 0)) return [];
      const out = [];
      (env.walls() || []).forEach(other => {
        if (other === wall) return;
        if (Number(other.levelId) !== Number(wall.levelId)) return;
        if ((other.view || 'plan') !== (wall.view || 'plan')) return;
        // AND THE SAME BUILDING. A garage is a separate body with its own
        // cladding -- Movie clads it from its own row in the rail -- and it
        // does not even meet the house flush: there is a foot of standoff
        // where a garage wall runs up to a house corner, which is a rule with
        // its own checks. Stone turning off the house and onto the garage
        // would be a return across a joint that is not a corner.
        //
        // FOUND BY A CHECK RATHER THAN BY READING. The angled-wall
        // measurement came back at exactly two feet when the geometry said
        // 1.70, because the widest return on the sheet belonged to a GARAGE
        // face -- square to the cut, so undistorted -- that the house's band
        // had no business reaching.
        if (String(other.body || '') !== String(wall.body || '')) return;
        const bands = Array.isArray(other.finishBands) ? other.finishBands : [];
        if (!bands.length) return;
        // WHICH END OF THIS FACE THE CORNER IS AT, and `inward` is the way the
        // wrap runs from it -- towards the face's other end, whichever way
        // round u happens to increase on this wall.
        const atStart = sameCorner(other.start, wall.start)
          || sameCorner(other.end, wall.start);
        const atEnd = sameCorner(other.start, wall.end)
          || sameCorner(other.end, wall.end);
        if (!atStart && !atEnd) return;
        const fromU = atStart ? face.u1 : face.u2;
        const inward = Math.sign((atStart ? face.u2 : face.u1) - fromU) || 1;
        // NO `wrapFt > 0` TEST HERE, and that is one authority rather than
        // two. A band with no wrap has a reach of zero, so the run it asks
        // for is a zero-width stripe and the painter's own minimum turns it
        // away -- which is the same answer this guard gave, arrived at by the
        // measurement instead of beside it. Mutation proved the cost:
        // deleting the guard changed nothing any check could see, because the
        // reach had already decided.
        bands.forEach(band => out.push({ band, fromU, inward,
          reachU: (Number(band.wrapFt) || 0) * duPerFt }));
      });
      return out;
    };

    // ── THE CLADDING ON ONE FACE ──────────────────────────────────────
    //
    // A BASE OVER THE WHOLE FACE, THEN THE BANDS OVER THAT, in the order they
    // were laid -- which is what makes "last band wins" true of the drawing
    // and not merely of the rule that reads the record. Each band repaints the
    // face fill under itself first, so a ledgestone wainscot on a brick wall
    // shows ledgestone rather than both at once.
    const paintFaceFinish = geom => {
      const { face, loU, hiU, tops } = geom;
      const wall = face.wall;
      const xa = X(loU), xb = X(hiU);
      if (xb - xa < 2) return;
      const lines = faceLines(geom);
      if (lines.head - lines.sill < 0.05) return;
      const FP = window.DraftFinishPatterns;
      if (!FP) {
        if (!warnedNoPatterns) {
          warnedNoPatterns = true;
          console.warn('cut-view: finishes were asked for, but finish-patterns.js '
            + 'is not loaded -- every wall will draw plain.');
        }
        return;
      }
      const boxAt = (lo, hi, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb)) => ({
        x0, x1, yTop: Y(hi), yBottom: Y(lo), pxPerFt,
      });
      ctx.save();
      // ── CLIPPED TO THE SILL, NOT TO THE FLOOR ────────────────────────
      //
      // Movie, 28 Sep, marking the strip under his front door in orange: *"the
      // stone should continue under the door"*, and before that *"the exterior
      // finish doesn't go down to the SILL"* with the number to go with it --
      // *"on typical house (this one) the band should be -1'-2 1/8\" below the
      // 0-0 main floor level"*.
      //
      // THE PAINTER WAS ALREADY RIGHT AND THE CLIP THREW IT AWAY. The base
      // below runs from `lines.sill`, which is exactly -1'-2 1/8" on his
      // house -- joists 11 7/8", sheathing 3/4", sill plate 1 1/2", to the
      // inch. What `ctx.clip()` took here was the CURRENT PATH, and the
      // current path is paintFace's own polygon, whose bottom is the storey
      // line at 0. Everything between the two was cut off. Read off the clips
      // recorded while painting his E1:
      //
      //     clip  0.0021 .. 8.1021    the MAIN FL face
      //     clip  9.1521 .. 17.2521   the 2ND FL face
      //     base drawn from -1.177083 and from 8.102083
      //
      // -- 1'-2 1/8" of cladding removed on the main floor and 1'-0 5/8" on
      // the storey above, which is the same face's floor package with no plate
      // under it. The comment below has claimed since the finishes landed that
      // the base "runs from the sill ... which is the whole of what puts the
      // cladding down over the plate and closes the band of bare white a
      // drafter could see under the stone". It did run from the sill. Two
      // mechanisms, one claim, and the second one won silently.
      //
      // I MEASURED THE BOX THREE TIMES AND NEVER THE CLIP, and told him twice
      // the paint was correct while he was looking straight at the gap.
      //
      // THE OUTLINE STAYS ON THE FLOOR LINE. Only this clip moves: a house
      // face's floor is a STOREY line, the one a drafter expects at a floor
      // level, and the wall's drawn edge belongs there. What the siding does
      // is run over the rim band and the plate to the top of the concrete,
      // which is what the sill is.
      ctx.beginPath();
      ctx.moveTo(xa, Y(lines.sill));
      tops.forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.lineTo(xb, Y(lines.sill));
      ctx.closePath();
      ctx.clip();
      // THE BASE RUNS FROM THE SILL, not from the wall's foot -- which is the
      // whole of what puts the cladding down over the plate and closes the
      // band of bare white a drafter could see under the stone.
      FP.drawFinish(ctx, boxAt(lines.sill, lines.head),
        finishById(wall.finish || DEFAULT_FINISH_ID), C);
      const bands = Array.isArray(wall.finishBands) ? wall.finishBands : [];
      // ── ONE PAINTER FOR A RUN OF BAND MATERIAL ───────────────────────
      //
      // Between two screen x's, whatever decided them. A band's own run
      // decides them from its side insets; a WRAP decides them from a corner
      // and a reach. Both are the same stripe of material with the same water
      // table on top, so they are the same code -- and that is the point: the
      // wrap was the one thing on this face the painter had never drawn, and a
      // second copy of the stripe would have been a second place for the
      // ledge, the fill order and the cap height to drift.
      const paintBandRun = (band, x0, x1) => {
        const span = bandRange(band, lines);
        if (!span) return;
        const lo = span.lo;
        const hi = Math.min(lines.head, span.hi);
        if (hi - lo < 0.02) return;
        if (x1 - x0 < 1) return;
        // THE FACE FILL AGAIN, under this band only. Without it the base
        // finish's lines read through the band on top of it.
        ctx.fillStyle = C.face;
        ctx.fillRect(x0, Y(hi), x1 - x0, (hi - lo) * pxPerFt);
        // ITS OWN CLIP, INSIDE THE FACE'S. A pattern may overhang its box --
        // fieldstone runs a whole cell past every edge -- and the face's clip
        // reaches the wall head, so only this keeps the stone on the band.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, Y(hi)); ctx.lineTo(x1, Y(hi));
        ctx.lineTo(x1, Y(lo)); ctx.lineTo(x0, Y(lo));
        ctx.closePath();
        ctx.clip();
        FP.drawFinish(ctx, boxAt(lo, hi, x0, x1), finishById(band.finishId), C);
        ctx.restore();
        // ── AND THE WATER TABLE WHERE IT STOPS SHORT ──────────────────
        //
        // Movie: *"we should put a ledge at the top of the stone that
        // overhangs the top of the stone"*, *"(if its not at top of wall)"*.
        // The question is the BAND's, not the material's, so the table's own
        // bandIsCapped answers it against the face's head.
        const finish = finishById(band.finishId);
        if (!bandIsCapped(band, lines) || !finish.cap) return;
        const capHigh = finish.cap.highIn / 12;
        const capY = Y(hi), capPx = capHigh * pxPerFt;
        if (capPx < 1.5) return;
        ctx.fillStyle = C.face;
        ctx.fillRect(x0, capY - capPx, x1 - x0, capPx);
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, capY - capPx); ctx.lineTo(x1, capY - capPx);
        ctx.moveTo(x0, capY); ctx.lineTo(x1, capY);
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, capY + 1); ctx.lineTo(x1, capY + 1);
        ctx.stroke();
        ctx.restore();
      };

      bands.forEach(band => {
        // HOW FAR ALONG THE WALL, which is the side insets: a band need not
        // run corner to corner. `bandSpan` measures them from each END.
        const along = bandSpan(band, Math.min(loU, hiU), Math.max(loU, hiU));
        if (!along) return;
        const bx0 = X(along.lo), bx1 = X(along.hi);
        paintBandRun(band, Math.min(bx0, bx1), Math.max(bx0, bx1));
      });

      // ── AND THE NEIGHBOUR'S MATERIAL ROUND THE CORNER ─────────────────
      //
      // Movie asked for the wrap and the rail has offered it since the band
      // controls landed -- a checkbox that stores `wrapFt: 2` and a readout
      // beside it. THE PAINTER HAD NEVER READ THE FIELD. `wrapFt` appeared
      // nowhere in this file, so the toggle stored a number and the drawing
      // did not change; and EXTFINISH's own note claimed the opposite in
      // writing ("the painter reads all six"), which is the worst version of
      // a dead control -- the page asserting that it works.
      //
      // IT SHOWS ON THE NEIGHBOUR, WHICH IS WHY IT WAS EASY TO MISS. A band
      // that wraps belongs to wall A; what a drafter sees is A's stone
      // standing two feet along wall B, on B's OWN elevation. Painting A's
      // face -- where the record lives -- there is nothing to draw. So this
      // pass runs the other way round: it asks what wraps ONTO this face.
      //
      // MEASURED ALONG THE WALL, NOT ACROSS THE PAPER. u is a projection, so
      // a wall at an angle to the cut is foreshortened and two feet of stone
      // covers less than two feet of elevation. The reach is scaled by the
      // face's own compression, which is the same factor everything else on
      // it is already drawn at.
      //
      // OVER THIS FACE'S OWN BANDS, last, and that is the architecture rather
      // than a paint-order convenience: the stone turns the corner and stops,
      // so at the corner it is the stone a drafter sees, whatever B is clad
      // in underneath.
      //
      // AND IT TAKES THIS FACE'S LINES, not the neighbour's. The material is
      // being carried onto THIS wall and its courses have to line up with
      // this wall's -- a band anchored to a sill that is not this face's
      // would step at the corner, which is the one thing a return must not do.
      wrapsOnto(face).forEach(({ band, reachU, fromU, inward }) => {
        const toU = fromU + inward * reachU;
        const lo = Math.max(Math.min(fromU, toU), Math.min(loU, hiU));
        const hi = Math.min(Math.max(fromU, toU), Math.max(loU, hiU));
        if (hi - lo <= 0) return;
        const wx0 = X(lo), wx1 = X(hi);
        paintBandRun(band, Math.min(wx0, wx1), Math.max(wx0, wx1));
      });
      // ── AND A LEDGE UNDER EVERY WINDOW THE MASONRY REACHES ────────
      //
      // Movie, 27 Sep, with a photograph of his own drawing: *"for the types
      // that are over 1\" under windows we should put a ledge (topledge over
      // the brick) below the window if the brick goes into the window area"*.
      //
      // IT IS THE WATER TABLE AGAIN, under an opening instead of at a band's
      // top, and for the same reason: masonry carried up to a window leaves an
      // open horizontal joint facing the weather, and the sill oversails it so
      // the water drips clear. So it reuses the row's own `cap` rather than
      // inventing a second ledge with its own numbers.
      //
      // OVER AN INCH, which is his gate and which sorts the table exactly:
      // the stones at 2\" and brick at 4 5/8\" take one, the shake at 1\" and
      // the thin finishes at a half do not. A sill is a masonry detail and
      // these are the masonry rows.
      //
      // AND IT CAN BE TURNED OFF: *"lets add a choice button on the menu that
      // allows them to TURN OFF the ledge if they choose not to show it"*.
      // Stored as the REFUSAL -- `noSillLedge` on the band -- because showing
      // it is the default, and the record's rule is that only a departure from
      // the default is written down.
      paintSillLedges(geom, lines, bands);
      ctx.restore();
    };

    // THE HORN IS THE CAP'S OWN PROJECTION, each side, which is what a sill
    // does: it runs past the opening it serves so the water leaves the jamb
    // as well as the head.
    const paintSillLedges = (geom, lines, bands) => {
      const { face, loU, hiU } = geom;
      const wall = face.wall;
      const span = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      if (!(span > 0.01)) return;
      // WINDOWS ONLY. A door has a threshold, not a sill: the masonry runs
      // past its jambs to the ground and there is no horizontal joint under it
      // for a ledge to cover. Written before any check asked -- the first
      // draft of this filtered on the wall alone, so the garage's overhead
      // door grew a stone sill two feet off the slab.
      const openings = env.fenestrations()
        .filter(f => f.wallId === wall.id && f.type === 'window');
      if (!openings.length) return;
      bands.forEach(band => {
        if (band.noSillLedge) return;
        const finish = finishById(band.finishId);
        if (!(finish.thicknessIn > 1) || !finish.cap) return;
        const range = bandRange(band, lines);
        if (!range) return;
        const hi = Math.min(lines.head, range.hi);
        openings.forEach(open => {
          const sillE = face.level.floorTop
            + (open.sillHeight > 0 ? open.sillHeight : SILL_FT);
          // THE BRICK HAS TO REACH IT. Below the band there is no masonry to
          // terminate, and above its top the wall is something else.
          if (!(sillE >= range.lo && sillE < hi)) return;
          const horn = finish.cap.projectIn / 12;
          const at = t => loU + (hiU - loU) * t;
          const a0 = at(Math.max(0, (open.offset - open.width / 2) / span));
          const a1 = at(Math.min(1, (open.offset + open.width / 2) / span));
          const px0 = Math.min(X(a0), X(a1)) - horn * pxPerFt;
          const px1 = Math.max(X(a0), X(a1)) + horn * pxPerFt;
          const high = (finish.cap.highIn / 12) * pxPerFt;
          if (px1 - px0 < 2 || high < 1.5) return;
          const y = Y(sillE);
          ctx.fillStyle = C.face;
          ctx.fillRect(px0, y - high, px1 - px0, high);
          ctx.strokeStyle = INK; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px0, y - high); ctx.lineTo(px1, y - high);
          ctx.moveTo(px0, y); ctx.lineTo(px1, y);
          ctx.moveTo(px0, y - high); ctx.lineTo(px0, y);
          ctx.moveTo(px1, y - high); ctx.lineTo(px1, y);
          ctx.stroke();
          // The shadow under the nose, which is what reads the detail.
          ctx.save();
          ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px0, y + 1); ctx.lineTo(px1, y + 1);
          ctx.stroke();
          ctx.restore();
        });
      });
    };

    const paintFace = geom => {
      const { face, loU, hiU, floor, tops, worldAt } = geom;
      const { wall, u1, u2, level } = face;
      const xa = X(loU), xb = X(hiU);
      // A GARAGE STANDS ON ITS PLATE, AND THE PLATE'S LINE IS ITS FOOT. That
      // line goes down before the faces, on a pixel's centre, so a fill from
      // Y(floor) took half its row and left it grey beside the house's black
      // -- Movie, 5 Oct: "the garage line is grey the house line is black ...
      // they should match in shade of line". Stop half a pixel short, as the
      // house's band on its sill does (paintRimBand).
      const yFoot = face.garage ? Y(floor) - 0.5 : Y(floor);
      ctx.fillStyle = C.face;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(xa, yFoot);
      tops.forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.lineTo(xb, yFoot);
      ctx.closePath();
      ctx.fill();
      // ── AND A HALF PIXEL PAST ITS OWN EDGE ────────────────────────────
      //
      // Movie, 4 Oct, on E1 of a BILEVEL + GARAGE: two faint lines in the
      // wall -- one at the entry's edge from sill to head, one along the
      // ENTRY level's top. Neither was ink. Two faces in one plane meet ON a
      // pixel boundary that X() and Y() put at the pixel's centre, so each
      // fill covers half that column and the column ends up three-quarters
      // wall and one-quarter WHATEVER IS BEHIND -- there, the jamb of a back
      // wall window and a level datum. The fill's own colour stroked round
      // its outline closes the half pixel; the face is opaque, so anything
      // it laps was behind it anyway.
      //
      // ROUND THE SIDES AND THE TOP ONLY, NOT ALONG THE FOOT. The foot of a
      // wall standing on its foundation IS the top of the sill plate, and the
      // plate's line is drawn there before the faces go down -- so a stroke
      // along the foot rubbed it out on every face that reached it. Movie, 4
      // Oct: "sill plate looks to me only on house (not completely) and not
      // on garage". Both seams this stroke is for are a side and a top.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xa, yFoot);
      tops.forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.lineTo(xb, yFoot);
      ctx.strokeStyle = C.face; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      // THE FACE'S OWN OUTLINE STAYS THE CURRENT PATH, for the finish clip
      // below, which reads it.
      ctx.beginPath();
      ctx.moveTo(xa, yFoot);
      tops.forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.lineTo(xb, yFoot);
      ctx.closePath();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      // ── AND WHAT THE WALL IS CLAD IN GOES ONTO THAT FILL ──────────────
      //
      // CLIPPED TO THE FACE'S OWN POLYGON, which is still the current path --
      // so the hatch follows the roof underside into the gable without the
      // pattern knowing anything about roofs, and a face standing behind
      // another is covered by that one's fill in the ordinary way. Occlusion
      // here is paint ORDER, the same as everywhere else on an elevation.
      //
      // OFF UNLESS ASKED. Movie's finishes are the Real Estate Layout's
      // subject; the construction elevations are line work, and a hatch on
      // them would be a change to every sheet in the set that nobody ordered.
      // One opt, so turning them on for MODEL later is one word.
      if (opts && opts.finishes) paintFaceFinish(geom);
      // The wall finish runs into the soffit triangle: end verticals stop
      // at the plate, only the top profile follows the roof underside.
      //
      // AND THEY START ABOVE A SHEET THAT COVERS THEIR FOOT, which is the
      // 26 Sep reading; the note at `roofClippedFoot` has it and why the
      // fill's own edge cannot be left to do the job.
      //
      // A HAIR INSIDE THE END, not on it. An end vertical stands on the face's
      // own corner, and a ray cast from a corner lands on the neighbouring
      // sheet's boundary where inside-or-out is a coin toss -- the same reason
      // the roof-edge pass probes at `tp` rather than at `t`, written there in
      // full. Two hundredths of a foot is a quarter of an inch and cannot
      // reach past anything.
      const nudge = Math.min(0.02, (hiU - loU) / 4);
      const footAt = (u, top) => (worldAt
        ? roofClippedFoot(worldAt(u), face.depth, floor, top) : floor);
      const topL = Math.min(tops[0].top, level.wallTop);
      const topR = Math.min(tops[tops.length - 1].top, level.wallTop);
      const footL = footAt(loU + nudge, topL);
      const footR = footAt(hiU - nudge, topR);
      // ── NO SEAM WHERE THE WALL CARRIES ON IN THE SAME PLANE ───────────
      //
      // Movie, 4 Oct, on E1 of a MODIFIED BILEVEL: "see that LINE in the
      // wall it looks like there the entry area is / main floor. we need to
      // remove that line". The house's front (its fill wall and MAIN's wall
      // over it) and the entry's tall front are separate records meeting at
      // one corner-less point on one face, and each drew its own end there.
      // An end is a corner only where the face stops: if faces in the same
      // plane abut it and, with the floor bands between them, cover the whole
      // height of this end, the cladding runs straight across.
      const carriesOn = (u, side, foot, top) => {
        const near = (a, b) => Math.abs(a - b) < 0.05;
        const cover = faceGeoms
          .filter(g => g !== geom && near(g.face.depth, face.depth)
            && (side < 0 ? near(g.hiU, u) : near(g.loU, u)))
          .map(g => ({ lo: g.floor, hi: g.face.level.wallTop }))
          // A floor band reaching into the neighbour's side of u.
          .concat(rimBands.filter(b => near(b.depth, face.depth) && (side < 0
            ? b.lo < u - 0.05 && b.hi >= u - 1e-6
            : b.hi > u + 0.05 && b.lo <= u + 1e-6))
            .map(b => ({ lo: b.bottom, hi: b.top })))
          .sort((a, b) => a.lo - b.lo);
        // THE STRETCHES NOTHING CARRIES ON ACROSS, not all-or-nothing. Movie,
        // 4 Oct, on E1 of a BILEVEL + GARAGE: the entry's edge drew full height
        // because the house front beside it had no floor band for one foot
        // of it -- a foot that stands behind the garage anyway. The end is a
        // corner only where it is uncovered, so only there is it drawn.
        const open = [];
        let reach = foot;
        for (const c of cover) {
          if (c.hi <= reach) continue;
          if (c.lo > reach + 0.02) open.push([reach, Math.min(c.lo, top)]);
          reach = Math.max(reach, c.hi);
          if (reach >= top - 0.02) break;
        }
        if (reach < top - 0.02) open.push([reach, top]);
        return open.filter(([lo, hi]) => hi - lo > 0.01);
      };
      const endL = topL - footL > 0.01 ? carriesOn(loU, -1, footL, topL) : [];
      const endR = topR - footR > 0.01 ? carriesOn(hiU, 1, footR, topR) : [];
      ctx.beginPath();
      endL.forEach(([lo, hi]) => { ctx.moveTo(xa, Y(lo)); ctx.lineTo(xa, Y(hi)); });
      ctx.moveTo(X(tops[0].u), Y(tops[0].top));
      tops.slice(1).forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      endR.forEach(([lo, hi]) => { ctx.moveTo(xb, Y(hi)); ctx.lineTo(xb, Y(lo)); });
      // ── AND NO WALL FACE LINES ITS OWN BASE ──────────────────────────
      //
      // Movie, 26 Sep, on E1 and E4 of a 2 STOREY + GARAGE + ROOM OVER,
      // after the sill plate was painted: "there is still a gap where the
      // garage sill plate should be (i think its the sill plate location)".
      //
      // THE PLATE IS PAINTED. It is OUTLINED, which is a different thing.
      // Read off the tape at the garage on that build's E4:
      //
      //     fill   seq 8   u -46..-19   e -1.1729..-1.0479   the plate, C.face
      //     stroke seq 12  u -46..-19   e -1.1729            top of concrete, w1
      //     stroke seq 56  u -46..-19   e -1.0479            THIS LINE, w1.25
      //
      // -- two horizontals 1 1/2" apart with white between them, the lower
      // one lighter than the upper. Filled or not, a strip bracketed by two
      // lines reads as a slot, and at 1.25 against the concrete's 1 the
      // bracket is heavier than the thing it brackets.
      //
      // THE RIM BAND ALREADY HAS THIS RULE and says why: it is "part of the
      // house face -- white like the walls, no banding line". A garage wall
      // is the same case one storey down. What is under it is the sill plate
      // and then concrete; the siding runs over both to the top of the pour,
      // and the top-of-concrete line already terminates the wall. There is
      // one line there on a real building, and the concrete draws it.
      //
      // ── AND THE HOUSE DOES NOT KEEP ONE EITHER, WHICH IS NEW ─────────
      //
      // This branch used to read `if (!face.garage)`, under a paragraph
      // headed THE HOUSE KEEPS ITS LINE: a house face's floor was called a
      // STOREY line, "the line a drafter expects at a floor level". IT WAS
      // NEVER ON THE SHEET. The rim-band fill was painted after every face
      // and bleeds 1px above floorTop, so it covered this 2px line along its
      // whole length -- for as long as both have existed. Two rules, one
      // strip, and the one that ran second won without either saying so.
      //
      // IT SURFACED THE MOMENT THE BAND WENT INTO THE DEPTH-SORTED PASS (see
      // the rim-band note there, and the cladding it was covering). Measured
      // on repro-garage-house E2 the instant the order changed: two full
      // width horizontals inside the house body where there had been none,
      // at e 0.023 and e 9.148 -- MAIN FL and 2ND FL, drawn right across the
      // facade. garage-elevation-occlusion.spec.js counted them.
      //
      // MOVIE SAW BOTH DRAWINGS AND CHOSE, 28 Sep: *"we don't want to show
      // those horizontal lines on the house, only off to the side of the
      // house (for the user to visualize where the floors are located"*, and
      // *"on the side of the house is sufficient"*. The faint level datums
      // that run past the house each way are that, and they already exist.
      //
      // SO THE TWO CASES ARE ONE CASE and the condition goes with the line:
      // no wall face closes its outline along its own foot, house or garage.
      // What terminates a wall at the bottom is what it stands on -- the top
      // of the pour under a garage, the band's own white under a house.
      //
      // WHAT WENT WITH IT. The removed sub-path carried a note, "AND IT
      // STARTS WHERE IT STARTS": it named both its ends rather than
      // inheriting the pen from the right-hand vertical, because
      // `roofClippedFoot` had moved that vertical's end to `footR` and the
      // storey line came out of a fresh twoStorey-garage E1 as (16.00,
      // 10.577) -> (-16.00, 9.152), leaning a foot and a half across the
      // front of the house. Kept here because the lesson outlives the line:
      // a sub-path that inherits the pen is a sub-path another change can
      // bend without touching it.
      ctx.stroke();
      const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      if (wallLen < 1e-6) return;
      const du = (u2 - u1) / wallLen;
      env.fenestrations().filter(f => f.wallId === wall.id).forEach(f => {
        const uc = u1 + du * f.offset;
        const half = Math.abs(du) * f.width / 2;
        const ox = X(Math.max(uc - half, uMin)), ow = X(Math.min(uc + half, uMax)) - ox;
        if (ow <= 0) return;
        const head = f.headHeight > 0 ? f.headHeight : HEAD_FT;
        const sill = f.sillHeight > 0 ? f.sillHeight : SILL_FT;
        const top = Math.min(floor + head, level.wallTop);
        // ── A DOOR STANDS ON WHAT IS ACTUALLY UNDER IT ──────────────────
        //
        // Movie, 26 Sep, on the elevation once the bucks were drawn: "why is
        // there an extra line in door buck? looks like top of sill plate
        // location (marked red arrows) and we should put the exterior
        // 'mandoor's thresholds at 1/2" (to avoid the bottom line not showing
        // like marked in green) and usually there is one on exterior doors".
        //
        // TWO THINGS, AND BOTH ARE THIS ONE EXPRESSION. It read `floor` for
        // every door: the wall's own floor, which for a garage wall is the
        // top of its sill plate.
        //
        // THE EXTRA LINE IS THE WALL'S FILL, ENDING. Over a buck the concrete
        // is notched away and the door stopped at the plate, so between the
        // two -- nine and a half inches on a drive-thru twoStorey-garage --
        // the wall's own fill edge stood against bare ground with nothing
        // drawn on it. `C.face` and the page's ground are not the same white,
        // so the seam reads as a line at exactly the height Movie named.
        // A DOOR IN A BUCK GOES DOWN TO THE SLAB: the buck is formed so the
        // door can, and the slab poured over it is what the door closes onto.
        //
        // AND AN EXTERIOR DOOR STANDS ON A THRESHOLD, which is the other
        // half: with the bottom AT the floor its line lands exactly on the
        // wall's own base line and there is nothing to see. Half an inch is
        // the detail as well as the fix -- an exterior door has a sill under
        // it. An OVERHEAD door does not: it seals to the slab, which is why
        // `f.garage` takes none.
        const buck = f.type === 'door' && face.garage
          ? bucks.find(b => b.id === f.id) : null;
        const stands = buck
          ? garageConcreteTop(env, fdn, face.garage) - buck.open : floor;
        const reaches = f.type !== 'door' ? floor + sill
          : stands + (f.garage ? 0 : DOOR_THRESHOLD_IN / 12);
        // ── AND IT REACHES BELOW ITS OWN WALL ONLY WHERE NOTHING IS IN
        //    FRONT OF IT ───────────────────────────────────────────────
        //
        // Movie, 26 Sep, circling the back of a 2 STOREY + GARAGE: *"the garage
        // door buck is showing on the HOUSE FOUNDATION at the back"*, and the
        // diagnosis with it -- *"its like the house is transparent or the door
        // buck lines are going in front of the house"*.
        //
        // A DOOR IN A BUCK HANGS BELOW ITS WALL. Since the expression above, a
        // garage door stands on the slab, which is 9 1/2" under the floor its
        // own face stands on. On the garage's own elevation that is the point:
        // you look into the buck. On the BACK it is nine and a half inches of
        // door hanging below the wall it belongs to.
        //
        // AND THAT STRIP IS THE FOUNDATION'S, ALREADY PAINTED. Occlusion on an
        // elevation is not a rule, it is the ORDER -- far first, each opaque
        // surface covering what it stands in front of -- and this painter lays
        // every foundation down before any wall face. So a far door dipping
        // below its wall lands on top of a near house's concrete, which was
        // painted twenty passes earlier and cannot cover it. Measured on
        // repro-movie-garage-2storey E3 at u -6:
        //
        //     seq  8  the HOUSE's concrete    e -2.3433..-1.3017
        //     seq  9  the HOUSE's sill plate  e -1.3017..-1.0517
        //     seq 24  the GARAGE's door       e -1.8433..5.9483   <- over both
        //
        // ONLY THE DIP IS ASKED, and that is what keeps this from being a
        // second occlusion rule: everything at or above the face's own floor
        // is covered by the nearer face painted after it, which is the order
        // working as intended. What hangs below it has nothing coming later.
        const dips = reaches < floor - 1e-6;
        const infront = dips && exposed.some(o => o.depth > face.depth + 1
          && o.lo < uc + half - 0.05 && o.hi > uc - half + 0.05);
        const bottom = infront ? floor : reaches;
        // ── AND AN EXTERIOR DOOR KEEPS ITS SIX INCHES BARE ─────────────
        //
        // See DOOR_SILL_BARE_IN. HUNG OFF `reaches`, which is the door's own
        // bottom -- the half-inch threshold on a house door -- so the strip
        // follows the door up a storey without being told where the floor is.
        // On the main floor that puts it across the top of the rim band,
        // which is exactly where the stone had just started reaching.
        //
        // HOUSE DOORS ONLY, which is his answer asked: *"House exterior doors
        // only"*. A garage's man door and its overhead door stand on a slab
        // with no rim band under them and no deck coming to them.
        //
        // OFF THE SAME SWITCH AS THE CLADDING. The strip is a hole IN the
        // cladding; on a construction elevation there is no cladding for it
        // to be a hole in, and those sheets are line work nobody asked to
        // change. Say the word and it goes on both.
        if (opts && opts.finishes && f.type === 'door' && !face.garage && !f.garage) {
          const trimHalf = half + Math.abs(du) * doorTrimFt(f);
          const bx0 = X(Math.max(uc - trimHalf, uMin));
          const bx1 = X(Math.min(uc + trimHalf, uMax));
          const bare = reaches - DOOR_SILL_BARE_IN / 12;
          if (bx1 - bx0 > 0) {
            ctx.fillStyle = C.face;
            ctx.fillRect(bx0, Y(reaches), bx1 - bx0, (reaches - bare) * pxPerFt);
            ctx.strokeStyle = INK; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx0, Y(bare));
            ctx.lineTo(bx1, Y(bare));
            ctx.stroke();
          }
        }
        ctx.fillStyle = C.recess;
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(ox, Y(top), ow, (top - bottom) * pxPerFt);
        ctx.strokeRect(ox, Y(top), ow, (top - bottom) * pxPerFt);
        const clipped = uc - half < uMin - 1e-6 || uc + half > uMax + 1e-6;
        if (clipped) return;
        // ── AND A WINDOW SAYS ITS SIZE, IN THE MIDDLE OF THE GLASS ──────
        //
        // Movie, 28 Sep: *"on the elevations i'd like the window marked in
        // middle center of the window"*, with the size itself settled on the
        // plan the same afternoon -- *"36 X 42 width by height in inches"*,
        // *"(don't need the letter for the window)"*, *"i want it to match the
        // actual size of the window"*.
        //
        // THE RECORD'S SIZE, NOT THE DRAWN ONE. `top` above is clamped to the
        // wall plate -- a window that would poke through its own top plate is
        // drawn short -- and `bottom` moves for what stands in front. Neither
        // is what a framer orders. The label is `f.width` by the resolved head
        // less the resolved sill, which is the opening as the record has it,
        // and the same pair of defaults the drawing itself used a few lines
        // up rather than a second copy of them.
        //
        // HORIZONTAL, unlike the plan tag. On a plan the wall runs any which
        // way and the tag turns with it; an elevation's glass is always
        // upright, so there is nothing to turn to.
        // THE FIFTH OF THE FOUR, and it was mine. The tag on the PLAN hid
        // behind a guard exactly like this one and cost a morning; the plan
        // was given its script and this half was never given a voice. A
        // window draws, its glass draws, and the size simply is not there.
        //
        // GATED ON A WINDOW BEING PRESENT, so a section with no glass in it
        // stays quiet -- there is nothing to label and nothing is missing.
        if (f.type === 'window' && !window.DraftFenLabels && !warnedNoFenLabels) {
          warnedNoFenLabels = true;
          console.warn('cut-view: fen-labels.js is not loaded, so no window on '
            + 'any elevation carries its size tag -- the glass draws, the size '
            + 'does not.');
        }
        if (f.type === 'window' && window.DraftFenLabels && showFenTags) {
          const sizeLabel = window.DraftFenLabels.fenLabel({
            type: 'window', widthFt: f.width, heightFt: head - sill, units: env.units });
          if (sizeLabel) {
            ctx.save();
            ctx.fillStyle = INK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // OFF THE SHEET IF IT WILL NOT FIT. A tag wider than the glass it
            // names, or taller than it, is not a smaller tag -- it is ink
            // across the neighbouring wall. Better absent than wrong.
            //
            // BUT A STEP SMALLER FIRST. A metric tag is two digits longer
            // than the inches it replaces (Movie, 1 Oct: "make text smaller
            // if necessary"), so it tries 9, 8 and 7 px before giving up --
            // never below 7, where a tag stops being read and starts being
            // texture.
            if (fitTagText(ctx, sizeLabel, ow, (top - bottom) * pxPerFt)) {
              ctx.fillText(sizeLabel, ox + ow / 2, (Y(top) + Y(bottom)) / 2);
            }
            ctx.restore();
          }
        }
        // THE DOOR'S, when the office asked for it: D36, or G 16W x 8H on a
        // garage door, centred on the leaf by the window's own fit rule.
        if (f.type === 'door' && window.DraftFenLabels && showDoorTags) {
          const doorLabel = window.DraftFenLabels.fenLabel({
            // A door stands on the floor: its height is its head, not a
            // window's head-less-sill (a door's stored sill is 0, which the
            // line above reads as "use the default window sill").
            type: 'door', widthFt: f.width, heightFt: head,
            garage: f.garage === true || f.doorType === 'garage', units: env.units });
          if (doorLabel) {
            ctx.save();
            ctx.fillStyle = INK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (fitTagText(ctx, doorLabel, ow, (top - bottom) * pxPerFt)) {
              ctx.fillText(doorLabel, ox + ow / 2, (Y(top) + Y(bottom)) / 2);
            }
            ctx.restore();
          }
        }
        const doorStyle = f.type === 'door' && !f.garage ? elevationDoorStyle(f) : null;
        if (doorStyle && doorStyle !== 'single') {
          // ── A DOOR BY ITS STYLE (Movie, 1 Oct) ──────────────────────────
          //
          // Each is drawn inside the same opening the single fills, with the
          // hinge on the side the plan hangs it: the jamb at the wall's start
          // unless FLIP HINGE moved it. Lines, never strokeRect -- the
          // elevation harness's recording context cannot see a strokeRect,
          // and a detail nothing can measure is the one that quietly stops
          // being drawn (the mullion's lesson, below).
          const IN = pxPerFt / 12;
          const hingeU = uc + (f.hingeFlip === true ? 1 : -1) * du * f.width / 2;
          const latchU = uc - (f.hingeFlip === true ? 1 : -1) * du * f.width / 2;
          const hingeLeft = X(hingeU) <= X(latchU);
          const yt = Y(top), yb = Y(bottom);
          const xl = ox, xr = ox + ow;
          const seg = (x0, y0, x1, y1) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
          const frameLines = (x0, x1, inset) => {
            if (x1 - x0 <= inset * 2 || yb - yt <= inset * 2) return;
            seg(x0 + inset, yt + inset, x1 - inset, yt + inset);
            seg(x1 - inset, yt + inset, x1 - inset, yb - inset);
            seg(x1 - inset, yb - inset, x0 + inset, yb - inset);
            seg(x0 + inset, yb - inset, x0 + inset, yt + inset);
          };
          const knob = x => {
            const r = Math.max(1.5, 1.25 * IN);
            const ky = Y(Math.min(floor + 3, (top + bottom) / 2));
            ctx.moveTo(x + r, ky);
            ctx.arc(x, ky, r, 0, Math.PI * 2);
          };
          const mid = (xl + xr) / 2;
          ctx.beginPath();
          if (doorStyle === 'french') {
            // Two leaves meeting at a stile, a knob each side of it.
            seg(mid - 0.75 * IN, yt, mid - 0.75 * IN, yb);
            seg(mid + 0.75 * IN, yt, mid + 0.75 * IN, yb);
            frameLines(xl, mid, 4 * IN);
            frameLines(mid, xr, 4 * IN);
            knob(mid - 2.5 * IN);
            knob(mid + 2.5 * IN);
          } else if (doorStyle === 'pocket') {
            // No knob: a recessed pull at the latch edge.
            const px = hingeLeft ? xr - 3 * IN : xl + 1 * IN;
            const py = Y(Math.min(floor + 3, (top + bottom) / 2));
            seg(px, py - 3 * IN, px + 2 * IN, py - 3 * IN);
            seg(px + 2 * IN, py - 3 * IN, px + 2 * IN, py + 3 * IN);
            seg(px + 2 * IN, py + 3 * IN, px, py + 3 * IN);
            seg(px, py + 3 * IN, px, py - 3 * IN);
          } else if (doorStyle === 'barn') {
            // The slab hangs over the opening on an exposed track that runs
            // past the hinge jamb, where the door parks open.
            const trackY = Y(Math.min(top + 0.5, level.wallTop));
            const reach = ow + 2 * IN;
            const t0 = hingeLeft ? Math.max(X(uMin), xl - reach) : xl - 2 * IN;
            const t1 = hingeLeft ? xr + 2 * IN : Math.min(X(uMax), xr + reach);
            seg(t0, trackY, t1, trackY);
            seg(xl - 2 * IN, trackY, xl - 2 * IN, yb);
            seg(xr + 2 * IN, trackY, xr + 2 * IN, yb);
            const bar = hingeLeft ? xr - 3 * IN : xl + 3 * IN;
            const by = Y(Math.min(floor + 3, (top + bottom) / 2));
            seg(bar, by - 9 * IN, bar, by + 9 * IN);
          } else if (doorStyle === 'slide') {
            // A framed patio unit: two glass panels and the stile where
            // they meet, the handle on the one that slides.
            frameLines(xl, xr, 2 * IN);
            seg(mid - 0.5 * IN, yt + 2 * IN, mid - 0.5 * IN, yb - 2 * IN);
            seg(mid + 0.5 * IN, yt + 2 * IN, mid + 0.5 * IN, yb - 2 * IN);
            frameLines(xl + 2 * IN, mid, 2 * IN);
            frameLines(mid, xr - 2 * IN, 2 * IN);
            const hx = hingeLeft ? mid - 3 * IN : mid + 3 * IN;
            const hy = Y(Math.min(floor + 3, (top + bottom) / 2));
            seg(hx, hy - 4 * IN, hx, hy + 4 * IN);
          } else if (doorStyle === 'bypass') {
            // Two slabs overlapping at the middle, a pull at each outer edge.
            seg(mid - 0.5 * IN, yt, mid - 0.5 * IN, yb);
            seg(mid + 0.5 * IN, yt, mid + 0.5 * IN, yb);
            const py = Y(Math.min(floor + 3, (top + bottom) / 2));
            seg(xl + 3 * IN, py - 3 * IN, xl + 3 * IN, py + 3 * IN);
            seg(xr - 3 * IN, py - 3 * IN, xr - 3 * IN, py + 3 * IN);
          } else if (doorStyle === 'garden') {
            // One unit, the same height: the door at the hinge side with the
            // wider frame, the fixed window beside it with the thinner one
            // and more glass, a mullion between.
            const split = geo().gardenSplitFt(f);
            const splitU = hingeU + (latchU - hingeU) * (split.doorFt / f.width);
            const sx = X(splitU);
            seg(sx, yt, sx, yb);
            const [doorL, doorR] = hingeLeft ? [xl, sx] : [sx, xr];
            const [winL, winR] = hingeLeft ? [sx, xr] : [xl, sx];
            frameLines(doorL, doorR, 4 * IN);
            frameLines(winL, winR, 2 * IN);
            knob(hingeLeft ? sx - 2.5 * IN : sx + 2.5 * IN);
          }
          ctx.stroke();
        } else if (f.type === 'door' && !f.garage) {
          // Flat slab door face with a round knob at handle height on the
          // latch side.
          const knobR = Math.max(1.5, (1.25 / 12) * pxPerFt);
          const kx = ox + ow - (2.5 / 12) * pxPerFt;
          const ky = Y(Math.min(floor + 3, (top + bottom) / 2));
          ctx.beginPath(); ctx.arc(kx, ky, knobR, 0, Math.PI * 2); ctx.stroke();
        } else if (f.type === 'window') {
          // The unit's frame face inside the rough opening: a 2"-wide border
          // around the glazing.
          const inset = (2 / 12) * pxPerFt;
          const glassH = (top - bottom) * pxPerFt - inset * 2;
          if (ow > inset * 3 && glassH > 0 && (top - bottom) * pxPerFt > inset * 3) {
            ctx.strokeRect(ox + inset, Y(top) + inset, ow - inset * 2, glassH);
            // A DOUBLE CASEMENT IS ONE WINDOW WITH TWO PANES -- Movie, 22 Sep:
            // *"1 window, with 2 window panes"*. So what divides them is a
            // MULLION inside the one frame, drawn at the same 2" as the frame
            // it is part of. Two openings side by side would be a different
            // building: two rough openings, two headers, and a stud between
            // them, which is not what he asked for and not what gets ordered.
            //
            // ONLY WHEN THERE IS ROOM FOR IT. At a sheet scale where the unit
            // is a few pixels wide a bar down its middle is a smear, and the
            // same `inset * 3` test the frame already makes is the one that
            // answers it -- the mullion needs a pane either side of it, so it
            // needs the frame's width again.
            //
            // TWO LINES RATHER THAN A strokeRect, and the reason is that the
            // harness can see them. proto/elevation-harness.js's recording
            // context implements strokeRect as a NO-OP -- the frame border
            // above is already invisible to it -- so a mullion drawn that way
            // could not be measured offline, and a rule nothing can measure is
            // the one that quietly stops being true. It is also how a mullion
            // meets its frame: the bar runs between the two, it does not sit
            // in the opening with its own cap top and bottom.
            if (f.casement === 'double' && ow > inset * 5) {
              const mx = ox + ow / 2;
              ctx.beginPath();
              ctx.moveTo(mx - inset / 2, Y(top) + inset);
              ctx.lineTo(mx - inset / 2, Y(top) + inset + glassH);
              ctx.moveTo(mx + inset / 2, Y(top) + inset);
              ctx.lineTo(mx + inset / 2, Y(top) + inset + glassH);
              ctx.stroke();
            }
          }
        }
      });
    };

    // ── A ROOF IS A SURFACE, AND IT JOINS THE PAINTER'S SORT ─────────────
    //
    // Movie, on an elevation of his own drawing: *"the roofs look
    // 'transparent'"*, and again over a marked-up screenshot: *"there are
    // still arrached garage lines showing (looks like some things are
    // 'tranparent')"*.
    //
    // THEY WERE. Every wall face here is FILLED before it is stroked and the
    // faces run far-first, so a nearer wall hides a farther one by simply
    // being painted over it. Roofs never joined that sort: the passes below
    // STROKE roof edges and fill nothing, and occlusion BY a roof was
    // hand-built one symptom at a time -- `roofClippedTop` lowers a wall's
    // top into a roof's band, `behindRoof` drops a roof edge, the joist band
    // asks the same question a third way. Each of those hides ONE thing.
    // Nothing hid the rest, so on Movie's own E1 the house's right corner ran
    // straight down through the garage's hip and the house's own hip end read
    // as open sky.
    //
    // A ROOF FACE PROJECTS TO A POLYGON like any other surface: `u` off the
    // cut's axis, elevation off `roofFaceRise`, which is LINEAR across a face
    // -- so the plan corners are the whole outline and nothing is sampled.
    // Filled at its depth in the same sort, it hides what stands behind it
    // and is hidden by what stands in front, under no rule of its own.
    //
    // ITS DEPTH IS ITS NEAREST CORNER. A roof face slopes, so it has no one
    // depth the way a wall does, and the sort wants a single key. The nearest
    // corner is the safe end: the only part of a sheet that lands on a wall's
    // paper is the part above that wall's plate, and a roof rises as it goes
    // BACK, so a sheet whose near edge clears a wall clears it everywhere
    // they meet. Keyed on the FAR corner instead, a garage roof would sit
    // behind the house wall it laps.
    //
    // EDGE-ON FACES DROP OUT BY THEIR OWN AREA. A gable roof seen from its
    // end throws both slopes onto one line -- every corner of a slope shares
    // a `u` with the corner above it and an elevation with the corner beside
    // it -- so there is no polygon to fill. The triangle between the rakes is
    // the gable END WALL, which `gableTopAt` already climbs and the wall pass
    // already fills, and that is the right answer rather than a gap: the
    // sheet really is edge on there.
    //
    // THE FASCIA COMES WITH IT, AS A BOARD RATHER THAN A NUDGE. The sheet's
    // own polygon stops at the eave LINE and the board hangs one fascia
    // below it, so a wall behind showed through a stripe that deep along
    // every eave -- the see-through, narrowed but not gone. Dropping the
    // eave corners instead was tried first and is wrong for a hip: moving a
    // corner down also swings the hip edge that leaves it, and the fill's
    // sloping edge came away from the drawn one by about two feet at the
    // eave. So the board is its own quad along each EAVE edge, decided by
    // the same `isEaveEdge` the silhouette's runs are grown by -- one answer
    // to what an eave is, for the pass that outlines the band and the pass
    // that fills it.
    const roofFills = [];
    if (facesByRoof) {
      facesByRoof.forEach((roofFaces, roof) => {
        const base = roofBaseElev(roof, stack, env);
        const eaveTop = roofEaveElev(roof, stack, env);
        const pitch = roof.pitch || 4;
        roofFaces.forEach(face => {
          const poly = face.points || [];
          if (poly.length < 3) return;
          const pts = poly.map(pt => ({
            x: X(pt.x * axis.x + pt.z * axis.z),
            y: Y(eaveTop + geo().roofFaceRise(face, pt, pitch)),
            d: pt.x * dir.x + pt.z * dir.z,
          }));
          // Twice the signed area, in PIXELS: the question is "does this face
          // cover any paper", and a roof seen almost edge on at a rail
          // thumbnail's scale covers none.
          let area2 = 0;
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            area2 += a.x * b.y - b.x * a.y;
          }
          // NaN IS NOT A SMALL AREA, and it must not reach the sort: one
          // NaN key scrambles the whole paint order, so a degenerate face
          // would not merely go unfilled, it would put the walls down in the
          // wrong order. `Math.abs(NaN) < 4` is false, so the area test lets
          // it straight through.
          if (!Number.isFinite(area2)) return;
          const parts = [];
          // ── A GABLE END SEEN SQUARE ON IS A LINE, AND STILL OPAQUE ────
          //
          // Movie, 27 Sep, on the Real Estate elevations: "it looks like the
          // finishes are coming through the gable of lower roof". They were.
          //
          // A ROOF PLANE WHOSE RIDGE RUNS AWAY FROM THE VIEWER PROJECTS TO A
          // LINE. Both slopes of that gable came through here with `area2`
          // of exactly ZERO, were dropped as covering no paper, and left the
          // rake with nothing filled behind it -- so the wall beyond showed
          // through. Invisible until the day a wall had a hatch on it,
          // because a white wall behind a white roof is a white rake.
          //
          // WHAT IS REALLY THERE IS THE ROOF'S OWN THICKNESS, seen edge on:
          // the sheathing and the fascia under it, a band following the slope
          // from eave to ridge. That band is the two lines a drafter sees as
          // the rake, and it is as opaque as any other surface on the sheet.
          // Swept down from the projected line by the fascia, it is exactly
          // the strip between them.
          //
          // THE ORDER WAS NEVER THE PROBLEM. Measured on repro-garage-house's
          // E2: the roof's own depth is -8 and the walls it laps are -8 too,
          // and the tie rule twenty lines down already puts the wall first and
          // the roof over it. There was simply nothing to put over it.
          //
          // AND THE SAME TEST STILL SPARES A THUMBNAIL, which is what the old
          // one was for: at a rail seat's 2 px/ft this band is nine tenths of
          // a pixel, so a roof seen almost edge on still costs nothing there.
          if (Math.abs(area2) < 4) {
            const ends = pts.slice().sort((p1, p2) => p1.x - p2.x || p1.y - p2.y);
            const lo = ends[0], hi = ends[ends.length - 1];
            if (hi.x - lo.x < 1) return;   // truly edge on: no paper either way
            const drop = fasciaFt * pxPerFt;
            parts.push([{ x: lo.x, y: lo.y }, { x: hi.x, y: hi.y },
              { x: hi.x, y: hi.y + drop }, { x: lo.x, y: lo.y + drop }]);
            const depthEdge = Math.max(...pts.map(pt => pt.d));
            if (!Number.isFinite(depthEdge)) return;
            // NO HATCH ON THIS ONE. What is drawn here is the roof's own
            // THICKNESS seen edge on -- the sheathing and fascia, a band a
            // fascia deep -- and a band of shingles a fascia deep is a smudge
            // that says nothing. The surface this belongs to is being seen
            // from the side; its covering is not visible at all.
            roofFills.push({ depth: depthEdge, parts });
            return;
          }
          parts.push(pts);
          // THE EAVE IS WHAT THE COURSES RUN PARALLEL TO, so the hatch needs
          // one -- and this loop is already finding them for the eave board.
          // The FIRST visible one is taken: a face has one eave in the ordinary
          // case, and where a hip gives two they are parallel, so either
          // answers the same frame.
          //
          // WHICH WAS MEASURED RATHER THAN ASSUMED. A mutant taking the LAST
          // one instead survives every check, over both repros and all four
          // elevations -- not a gap in the reading but an inert mutation:
          // every face with area on either house has exactly one visible eave,
          // so first and last are the same edge. `if (!eave)` is kept because
          // a stable rule beats an arbitrary one the day a face has two.
          let eave = null;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            const ea = eaveTop + geo().roofFaceRise(face, a, pitch);
            const eb = eaveTop + geo().roofFaceRise(face, b, pitch);
            if (!isEaveEdge(ea, eb, eaveTop)) continue;
            const xa = X(a.x * axis.x + a.z * axis.z);
            const xb = X(b.x * axis.x + b.z * axis.z);
            if (Math.abs(xb - xa) < 1) continue;   // this eave runs away from us
            if (!eave) eave = [{ x: xa, y: Y(eaveTop) }, { x: xb, y: Y(eaveTop) }];
            parts.push([
              { x: xa, y: Y(eaveTop) }, { x: xb, y: Y(eaveTop) },
              { x: xb, y: Y(base) }, { x: xa, y: Y(base) },
            ]);
          }
          // AND NO FALLBACK WHERE NO EAVE IS FOUND. One was written -- the two
          // lowest corners on the paper standing in for an eave, for a hip
          // face whose own eave runs away from the viewer -- and it was taken
          // out again because nothing can reach it. The two tests are very
          // nearly complementary: an eave rejected for running away
          // (|xb - xa| < 1) belongs to a face seen almost edge on, and such a
          // face has already gone down the `area2 < 4` branch above. Measured
          // over both repros and all four elevations, including the L-house's
          // hip: every face with area found an eave, four of four and two of
          // two, and deleting the fallback changed no drawing.
          //
          // A BRANCH NOTHING REACHES IS A BRANCH NOTHING CHECKS, which is this
          // session's recurring slip. If such a face ever does come through,
          // it draws plain -- which is what it did before any of this existed.
          const depth = Math.max(...pts.map(pt => pt.d));
          if (!Number.isFinite(depth)) return;
          roofFills.push({ depth, parts, roof, eave });
        });
      });
    }
    const paintRoof = ({ parts, roof, eave }) => {
      ctx.fillStyle = C.face;
      parts.forEach(part => {
        ctx.beginPath();
        ctx.moveTo(part[0].x, part[0].y);
        for (let i = 1; i < part.length; i++) ctx.lineTo(part[i].x, part[i].y);
        ctx.closePath();
        ctx.fill();
      });
      // ── AND WHAT THE ROOF IS COVERED IN GOES ONTO THAT FILL ─────────
      //
      // ASKED FOR WITH THE WALL FINISHES, off the same `opts.finishes`: a
      // sheet showing what a house is clad in and not what it is roofed in is
      // half an elevation, and the two are one decision a drafter makes.
      //
      // CLIPPED TO THE FACE ITSELF, which is `parts[0]` -- the eave boards
      // after it are the roof's edge seen from below and carry no shingles.
      // And the frame deliberately overhangs a triangular face at the ridge
      // (see frameFor), so the clip is what stops it.
      if (!opts || !opts.finishes || !eave || !roof) return;
      const RP = window.DraftRoofPatterns;
      const RT = window.DraftRoofTypes;
      if (!RP || !RT) {
        if (!warnedNoRoofPatterns) {
          warnedNoRoofPatterns = true;
          console.warn('cut-view: finishes were asked for, but roof-patterns.js '
            + 'or roof-types.js is not loaded -- every roof will draw plain.');
        }
        return;
      }
      const frame = RP.frameFor(parts[0], eave[0], eave[1], pxPerFt);
      if (!frame) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(parts[0][0].x, parts[0][0].y);
      for (let i = 1; i < parts[0].length; i++) ctx.lineTo(parts[0][i].x, parts[0][i].y);
      ctx.closePath();
      ctx.clip();
      RP.drawRoofing(ctx, frame, RT.roofingById(roof.roofing), { hatch: INK });
      ctx.restore();
    };
    const spanOf = face => ({
      lo: Math.max(Math.min(face.u1, face.u2), uMin),
      hi: Math.min(Math.max(face.u1, face.u2), uMax),
      depth: face.depth,
      levelId: face.level.id,
      top: face.level.wallTop,
      bottom: face.garage ? -Infinity : face.level.floorTop + hungBy(face.wall),
      // A wall hung off the storey below's ceiling (`hoodOf`) has no floor
      // package of this storey under it, so it lays no rim band.
      hood: !!face.wall.hoodOf,
    });
    const houseSpans = houseFaces.map(spanOf).filter(span => span.hi - span.lo >= 0.5);
    // ── AND A GARAGE IN FRONT IS SOMETHING NEARER ──────────────────────
    //
    // Movie, 25 Sep, marking the band in red on E1 and E4 of his own build:
    // "the main floor looks like it over 'overlayed' overtop of the attached
    // garage walls/door etc".
    //
    // houseFaces drops every garage face -- it was built for houseHi, where
    // dropping them is the point ("a garage hangs off grade and never carries
    // the house datums across its front") -- and houseSpans then inherited
    // that blindness. So the rim band, and the edges through it, asked "is a
    // nearer face covering this?" of a list the garage had been removed from,
    // and the answer was always no.
    //
    // Measured on E1 of his file. The garage's front wall is the NEAREST face
    // in the drawing and the house's rim band is filled straight over it:
    //
    //     seq 56  u  -4.0..20.0  e -1.05..8.10   the garage's face
    //     seq 61  u -16.0..16.0  e -1.07..0.03   the house's rim band, after
    //
    // -- twelve feet of the garage's wall and the head of its door, papered
    // over with the house's floor package.
    //
    // THE OCCLUSION QUESTION IS NOT THE DATUM QUESTION. A datum line is the
    // house's to carry or not; a rim band is a surface, and a surface is
    // hidden by whatever stands in front of it, whichever body that is. So
    // the bands are still BUILT from the house's faces -- a garage's floor
    // package is its own and sits at its own height -- while what HIDES them
    // is asked of every face on the drawing.
    const allSpans = faces.map(spanOf).filter(span => span.hi - span.lo >= 0.5);
    // The stretches of [lo, hi] that no nearer face covers. Returned as a
    // list because a face can be interrupted in the middle -- a garage
    // standing off a house's centre leaves a band either side of it.
    // `top`, where given, is the height the stretch has to be hidden up to:
    // a nearer face that stops below it hides only its own lower part, and
    // paint order already does that -- clipping the whole stretch for it is
    // how the OVER GARAGE floor band of a MODIFIED BILEVEL went missing over
    // its garage's lean-to, and the entry wall behind showed its top through
    // the gap (Movie, 4 Oct: "i also noticed a 'height' line that should be
    // removed").
    const uncovered = (lo, hi, depth, top = null) => {
      let parts = [{ lo, hi }];
      allSpans.filter(other => other.depth > depth + 1e-6
        && (top == null || other.top >= top - 1e-6)).forEach(other => {
        const next = [];
        parts.forEach(part => {
          if (other.hi <= part.lo + 1e-6 || other.lo >= part.hi - 1e-6) { next.push(part); return; }
          if (other.lo > part.lo + 1e-6) next.push({ lo: part.lo, hi: other.lo });
          if (other.hi < part.hi - 1e-6) next.push({ lo: other.hi, hi: part.hi });
        });
        parts = next;
      });
      return parts.filter(part => part.hi - part.lo >= 0.5);
    };

    // ── FLOOR ASSEMBLY BANDS, AND THEY GO DOWN WITH THEIR OWN FACE ──────
    //
    // Each floor's rim (joists + sheathing) is part of the house face --
    // white like the walls, no banding line, keeping the vertical edges of
    // every visible face corner through the band. The bands are also read
    // back by the roof pass below, alongside the walls: between one storey's
    // plate and the next storey's floor there is no wall face, and a roof
    // behind the house at exactly that height would otherwise show through
    // the joist band.
    //
    // ── AND THE FACE'S OWN CLADDING RUNS DOWN OVER THEM ─────────────────
    //
    // Movie, 28 Sep, marking the strip under his front door in orange: *"the
    // stone should continue under the door"*. It runs from the sill, over
    // the plate and the rim -- and this fill used to be laid down AFTER
    // every face, so it put C.face back over the bottom of its own wall's
    // stone. Read off his E1 with the clip already fixed:
    //
    //     seq 45  u -16.0..16.0  e -2.173..3.827   the roundstone
    //     seq 90  u -16.0.. -4.0 e -1.073..0.027   the band, over it
    //
    // -- 1'-0 5/8" of stone painted and then papered over, the whole of the
    // rim, leaving only the 1 1/2" plate strip showing under the door.
    //
    // SO THE BAND JOINS THE DEPTH-SORTED PASS BELOW, at its own depth and
    // just ahead of the walls that STAND ON IT -- see the note there for why
    // the storey below has to go down first. A surface is hidden by whatever
    // is in front of it, and its own wall's cladding is one of those things;
    // paint ORDER is how this painter says that everywhere else. It also
    // puts the band in order against the ROOFS for the first time -- painted
    // last, it went over a garage roof standing in front of it, because
    // `uncovered` asks about faces and a roof is not one, and it washed out
    // the top of a garage's own corner line for the same reason.
    //
    // WHAT IS PAINTED IS WORKED OUT HERE AND THE EDGE PASS READS IT BACK.
    // The run is the house's own extent; the PARTS are what survived the
    // clip against whatever stands in front, and the two are different the
    // moment a garage laps the house.
    const rimBands = [];
    const bandLevels = [];
    stack.floors.forEach(level => {
      const spans = houseSpans.filter(span => span.levelId === level.id && !span.hood);
      if (!spans.length) return;
      // Contiguous runs of face coverage — a level with two separate wings
      // wears two rim bands, not one across the gap between them.
      const runs = [];
      spans.slice().sort((a, b) => a.lo - b.lo).forEach(span => {
        const last = runs[runs.length - 1];
        if (last && span.lo <= last.hi + 0.5) last.hi = Math.max(last.hi, span.hi);
        else runs.push({ lo: span.lo, hi: span.hi });
      });
      const paintedOf = new Map();
      const bandFills = [];
      runs.forEach(run => {
        if (run.hi - run.lo < 0.5) return;
        const depth = Math.max(...spans
          .filter(span => span.hi > run.lo && span.lo < run.hi)
          .map(span => span.depth));
        // ONLY WHERE NOTHING NEARER STANDS. The band is the house's floor
        // package seen flat, and a garage in front of it is a wall, not a
        // window. What is pushed to rimBands is what was PAINTED, so the roof
        // pass downstream reads the same surface the sheet shows.
        const parts = uncovered(run.lo, run.hi, depth, level.floorTop);
        // AND NOT ACROSS A WALL THAT RUNS PAST THIS FLOOR. A bilevel's entry
        // front stands on the landing and climbs to MAIN FL's ceiling -- the
        // foyer is open, there is no floor package in it -- so MAIN's rim
        // drawn across it papered a strip of white over the front door.
        const shown = parts.flatMap(part => faces
          .filter(face => face.level.id !== level.id
            && face.level.floorTop < level.floorBottom - 1e-6
            && face.level.wallTop > level.floorTop + 1e-6
            && face.depth >= depth - 1e-6)
          .map(spanOf)
          .reduce((kept, through) => kept.flatMap(piece => {
            if (through.hi <= piece.lo + 1e-6 || through.lo >= piece.hi - 1e-6) return [piece];
            return [{ lo: piece.lo, hi: through.lo }, { lo: through.hi, hi: piece.hi }]
              .filter(bit => bit.hi - bit.lo >= 0.5);
          }), [part]));
        paintedOf.set(run, shown);
        shown.forEach(part => {
          bandFills.push({ part, depth });
          rimBands.push({
            lo: part.lo, hi: part.hi,
            bottom: level.floorBottom, top: level.floorTop, depth,
          });
        });
      });
      bandLevels.push({ level, spans, runs, paintedOf, bandFills });
    });
    const paintRimBand = (level, part) => {
      // A FLOOR ON THE FOUNDATION HAS NO WALL HEAD UNDER IT, only the sill
      // plate's top line -- which is wanted. Movie, 4 Oct, on a MOD BILEVEL's
      // E1: "the sill plate lines don't show both lines on the house". The
      // ENTRY's band ran a pixel past its floor bottom and the strip below
      // filled the rest of that row, which is exactly where the plate top
      // is drawn. So that band stops on the row above it and lays no strip.
      //
      // ON A SPLIT ONLY. A one- or two-storey house's MAIN sits on its sill
      // too, but there an attached garage's wall face, painted after the
      // foundation lines and standing lower than the house's plate, takes
      // the middle of that row anyway -- so the band's cover is all that
      // kept the sheet clean (garage-elevation-occlusion.spec.js, E2).
      const onSill = !!stack.split && Math.abs(level.floorBottom - fdn.wallTop) < 0.01;
      const yTopPx = Y(level.floorTop) - 1;
      const yBotPx = onSill ? Y(level.floorBottom) - 0.5 : Y(level.floorBottom) + 1;
      ctx.fillStyle = C.face;
      ctx.fillRect(X(part.lo) - 1, yTopPx, (part.hi - part.lo) * pxPerFt + 2, yBotPx - yTopPx);
      if (onSill) return;
      // AND THE REST OF THAT PIXEL ROW, BETWEEN THE CORNERS. Y() lands on a
      // pixel's centre, so one pixel past it is half a row -- and the wall
      // below's own top line, 1 1/4 wide on that centre, kept a sliver
      // showing under the band (Movie, 4 Oct, a faint line along a
      // BILEVEL's ENTRY top). Inset from the ends, because the corner lines
      // run through there and a full row would put a gap in them.
      ctx.fillRect(X(part.lo) + 1, Y(level.floorBottom) + 0.5, (part.hi - part.lo) * pxPerFt - 2, 1);
    };

    // FAR FIRST, AND ON A TIE THE WALL GOES DOWN BEFORE THE ROOF. A sheet
    // whose nearest corner lands exactly on a wall's depth is a sheet bearing
    // on that wall's own plate, and it laps OVER the plate -- which is both
    // how the roof is built and the only way round that cannot rub out a
    // gable wall's climb. `sort` is stable, so listing the walls first is
    // what states it.
    //
    // ── AND THE RIM BANDS GO IN WITH THE STOREY THEY BELONG TO ─────────
    //
    // A band is a floor package: its own storey's joists and sheathing, seen
    // flat. So the walls go down BOTTOM STOREY FIRST and each storey's band
    // goes down just ahead of the walls standing on it. The two edges of that
    // strip are what the order is for, and they are different edges:
    //
    //   ITS OWN WALL'S FOOT is below the band, so the band goes FIRST and the
    //   wall's cladding then runs down over it to the top of the concrete --
    //   the whole of *"the stone should continue under the door"*.
    //
    //   THE WALL BELOW'S HEAD is above that wall's top plate and under this
    //   band, so the band goes AFTER it and rubs the line out. A storey line
    //   across the facade is not wanted: Movie, 28 Sep, shown both drawings,
    //   *"we don't want to show those horizontal lines on the house, only off
    //   to the side of the house (for the user to visualize where the floors
    //   are located"*. The faint level datums running past the house are what
    //   does that job, and they are drawn first and left alone.
    //
    // ONE PASS DOES BOTH BECAUSE THE BAND SITS BETWEEN THEM. Painted after
    // every face, as it was until 28 Sep, it rubbed out both edges AND the
    // cladding with them; painted before every face it rubs out neither.
    // Interleaved, each edge gets the answer it needs.
    //
    // A FACE ON NO LISTED STOREY keeps its place after them -- `sort` is
    // stable, so these groups only ever decide a TIE, and a tie is exactly
    // where the band-against-its-own-wall question lives.
    const wallItems = [];
    const onLevel = new Set();
    stack.floors.forEach(level => {
      bandLevels.filter(bl => bl.level.id === level.id).forEach(bl => {
        // MARKED, so the two ways of getting this wrong can each be written
        // as one edit -- see the mutations in garage-bearing-harness.js.
        bl.bandFills.forEach(f => wallItems.push({ depth: f.depth, band: true,
          go: () => paintRimBand(bl.level, f.part) }));
      });
      faceGeoms.filter(geom => !faceHidden(geom) && geom.face.level.id === level.id)
        .forEach(geom => {
          onLevel.add(geom);
          wallItems.push({ depth: geom.face.depth, go: () => paintFace(geom) });
        });
    });
    faceGeoms.filter(geom => !faceHidden(geom) && !onLevel.has(geom))
      .forEach(geom => wallItems.push({ depth: geom.face.depth, go: () => paintFace(geom) }));
    [
      ...wallItems,
      ...roofFills.map(fill => ({ depth: fill.depth, go: () => paintRoof(fill) })),
    ].sort((a, b) => a.depth - b.depth).forEach(item => item.go());

    // ── A WALL STANDING ON THE ROOF BELOW SHOWS WHERE IT CLEARS THAT ROOF ──
    //
    // Movie, 5 Oct, on E2 of a MOD BILEVEL whose upper roof was pushed out
    // over the main roof in BONEYARD: "we should see the wall below the 2nd
    // floor roof (bottom of this wall should allign with the main floor
    // ceiling)". The wall (`hoodOf`, see boneyard-edit.js roofHood) stands
    // on MAIN's ceiling, which is under the main roof, and pokes up through
    // it. Paint order alone cannot draw that: the main roof's eave is nearer
    // than the wall, so its sheet goes down after the wall and covers all of
    // it. So the part above the roof is painted again here, after every
    // sheet: from the highest roof along the ray toward the viewer (its own
    // roof aside, which is above it) up to the top the face already has.
    //
    // ONLY THE ONES IN LINE WITH THE STOREY'S OWN FACE (Movie, 8 Oct, on E2
    // of a MOD BILEVEL with the garage on the corner): the walls round the
    // upper landing stand set back from the room's front, and drawn above
    // the roof they made a box hanging under the room's eave that he marked
    // as wrong. The one carrying the room's front wall on down to the
    // ceiling stays.
    const collinearWalls = (a, b) => {
      const dx = a.end.x - a.start.x, dz = a.end.z - a.start.z;
      const len = Math.hypot(dx, dz) || 1;
      const off = p => Math.abs((p.x - a.start.x) * dz - (p.z - a.start.z) * dx) / len;
      return off(b.start) < 0.05 && off(b.end) < 0.05;
    };
    const inLineWithStorey = wall => (env.walls() || []).some(other =>
      other !== wall && !other.hoodOf && Number(other.levelId) === Number(wall.levelId)
      && (other.view || 'plan') === (wall.view || 'plan') && collinearWalls(wall, other));
    faceGeoms.filter(geom => geom.face.wall.hoodOf && !faceHidden(geom)
      && inLineWithStorey(geom.face.wall)).forEach(geom => {
      const { face, tops, worldAt } = geom;
      const ownRoofId = String(face.wall.hoodOf);
      const span = dHi - face.depth;
      const footAt = (u, floor) => {
        if (!facesByRoof || span < 0.1) return floor;
        const pt = worldAt(u);
        const far = { x: pt.x + dir.x * span, z: pt.z + dir.z * span };
        let foot = floor;
        facesByRoof.forEach((roofFaces, roof) => {
          if (String(roof.id) === ownRoofId) return;
          const base = roofEaveElev(roof, stack, env);
          geo().roofProfile(roof, roofFaces, pt, far, dir).forEach(p => {
            foot = Math.max(foot, base + p.rise);
          });
        });
        return foot;
      };
      const floor = face.level.floorTop + (Number(face.wall.baseHeight) || 0);
      const strip = tops.map(s => ({ u: s.u, top: s.top, foot: Math.min(s.top, footAt(s.u, floor)) }));
      // One run per stretch where the wall clears the roof in front of it.
      const runs = [];
      let cur = null;
      strip.forEach(s => {
        if (s.top - s.foot > 0.02) { (cur = cur || []).push(s); } else if (cur) { runs.push(cur); cur = null; }
      });
      if (cur) runs.push(cur);
      runs.filter(run => run.length > 1).forEach(run => {
        ctx.beginPath();
        run.forEach((s, i) => (i ? ctx.lineTo(X(s.u), Y(s.top)) : ctx.moveTo(X(s.u), Y(s.top))));
        for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(X(run[i].u), Y(run[i].foot));
        ctx.closePath();
        ctx.fillStyle = C.face;
        ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
        ctx.beginPath();
        // The line where it meets the roof, and its ends where they stand
        // clear; its top is the soffit's line, already drawn.
        run.forEach((s, i) => (i ? ctx.lineTo(X(s.u), Y(s.foot)) : ctx.moveTo(X(s.u), Y(s.foot))));
        [run[0], run[run.length - 1]].forEach(s => {
          if (Math.abs(s.u - geom.loU) < 1e-6 || Math.abs(s.u - geom.hiU) < 1e-6) {
            ctx.moveTo(X(s.u), Y(s.foot)); ctx.lineTo(X(s.u), Y(s.top));
          }
        });
        ctx.stroke();
      });
    });

    // IS THIS POINT BEHIND A ROOF? Lifted out of `hidden` so the rim-band
    // edge pass below can ask it too -- `hidden` itself cannot move, because
    // its OTHER half reads `rimBands`, and the edges are drawn before it.
    //
    // A ray is cast from just in front of the point to the far side of the
    // drawing, and each roof's profile along it is reduced to a lo and a hi.
    // "Just in front" is what stops a surface hiding itself.
    const behindRoof = (pt, elev) => {
      if (!facesByRoof || !facesByRoof.size) return false;
      const depth = pt.x * dir.x + pt.z * dir.z;
      const span = dHi - depth;
      if (span < 0.1) return false;
      const near = { x: pt.x + dir.x * 0.05, z: pt.z + dir.z * 0.05 };
      const far = { x: pt.x + dir.x * span, z: pt.z + dir.z * span };
      let covered = false;
      facesByRoof.forEach((roofFaces, roof) => {
        if (covered) return;
        const base = roofEaveElev(roof, stack, env);
        let lo = Infinity, hi = -Infinity;
        geo().roofProfile(roof, roofFaces, near, far, dir).forEach(p => {
          const e = base + p.rise;
          if (e > hi) hi = e;
          if (e < lo) lo = e;
        });
        if (hi === -Infinity) return;   // the ray misses this roof entirely
        lo -= fasciaFt;
        if (elev > lo + ROOF_COVER_EPS && elev < hi - ROOF_COVER_EPS) covered = true;
      });
      return covered;
    };

    // WHERE A POINT ON THE VIEW PLANE ACTUALLY IS. `u` is the distance along
    // the cut's axis and `depth` the distance along its direction, and the two
    // are perpendicular, so the world point is just the sum of the two
    // components. The rim-band pass knows a `u` and a face depth and needs a
    // point to cast a ray from.
    const atUDepth = (u, depth) => ({
      x: u * axis.x + depth * dir.x,
      z: u * axis.z + depth * dir.z,
    });

    // AND A ROOF IN FRONT HIDES IT TOO. This asked only whether a nearer WALL
    // FACE covered the edge, never whether a roof did -- so a garage roof
    // standing in front of the house at rim-band height left the band's
    // vertical edges drawn straight over it, and the roof read as transparent.
    // Movie, 21 Sep, on his own drawing: *"i could see the sidewalls through
    // the roof"*, *"they are in line with the exterior wall"*, *"it looks like
    // the roof can be seen through"*. Measured there: two verticals at the
    // garage's own exterior walls, one overhang in from each roof edge,
    // standing about 13" above the garage eave.
    //
    // THE FILE ALREADY SOLVED THE MIRROR CASE and says so a few lines down --
    // "a roof behind the house at exactly that height would otherwise show
    // through the joist band". That is roof BEHIND, band in front. This is
    // roof in FRONT, band behind, and nothing covered it.
    //
    // ASKED AT THE BAND'S MIDDLE, and the limit is worth stating: a roof that
    // covers only part of the band's height still takes the whole edge, and
    // one that clears the middle leaves the whole edge. The alternative --
    // clipping the edge to the uncovered part -- is a different and larger
    // change, and no drawing to hand needs it.
    // WHICH FACE'S DEPTH TO CAST A RUN END'S RAY FROM. A run is a contiguous
    // stretch of face coverage and may be several faces at different depths,
    // so an end takes the NEAREST face that reaches it -- the one a viewer
    // would actually be looking at. Falling back to the nearest face overall
    // keeps the ray in front of the house rather than behind it, which is the
    // safe direction: a ray cast too far back finds a roof that is not really
    // in front and would hide an edge that should show.
    const runDepth = (spans, u) => {
      let best = null;
      spans.forEach(span => {
        if (u < span.lo - 0.05 || u > span.hi + 0.05) return;
        if (best == null || span.depth < best) best = span.depth;
      });
      if (best != null) return best;
      return spans.reduce((d, s) => (d == null || s.depth < d ? s.depth : d), null) ?? 0;
    };

    const edgeVisible = (u, depth, elev = null) => {
      // Asked of EVERY face, not just the house's: a garage standing in front
      // hides an edge exactly as another wing would.
      if (allSpans.some(other => other.depth > depth + 1e-6
        && other.lo < u - 0.05 && other.hi > u + 0.05)) return false;
      if (elev != null && behindRoof(atUDepth(u, depth), elev)) return false;
      return true;
    };
    // The band's vertical edges, drawn after every face and roof: a corner
    // line crossing the floor package is a corner whatever is clad over it.
    bandLevels.forEach(({ level, spans, runs, paintedOf }) => {
      const yTopPx = Y(level.floorTop) - 1, yBotPx = Y(level.floorBottom) + 1;
      // Vertical edges through the band: the run boundaries plus any face
      // corner inside a run that isn't hidden behind a nearer face — a jog
      // in the facade keeps its corner line crossing the floor.
      // u -> the depth the edge stands at: a run's end at its nearest face,
      // an interior joint at its own span's (an interior wall's end stands
      // behind the exterior wall, and is hidden by it).
      const edges = new Map();
      runs.filter(run => run.hi - run.lo >= 0.5).forEach(run => {
        // A RUN'S OWN ENDS ARE THE BAND'S ENDS, so they are drawn without
        // asking whether a nearer FACE covers them -- by construction nothing
        // does; that is what makes them ends. But a ROOF in front is a
        // different question, and it was not being asked here at all: on
        // Movie's drawing the second of the two see-through verticals was a
        // run end, which is why gating only the interior edges below removed
        // one of the pair and left its twin.
        //
        // ── AND THE BAND'S ENDS ARE THE PAINTED PARTS', NOT THE RUN'S ─────
        //
        // Movie, 25 Sep, on E1 of his 1 STOREY + GARAGE: "the missing line
        // near middle".
        //
        // THIS IS THE OTHER HALF OF THE CLIP. The fill learned to stop where
        // a garage stands in front of the band; the edges did not, and went
        // on being drawn at the run's own ends -- which by then were UNDER
        // the garage. Measured on that build: the house's faces run u -20..20
        // and the garage's -46..-19, so the band is painted from -19 and its
        // closing edge was drawn at -20, a foot inside the garage wall and
        // invisible behind it. The band simply ran into the garage with
        // nothing terminating it.
        //
        // A RUN WITH NOTHING IN FRONT OF IT IS UNCHANGED: uncovered() hands
        // back the whole span, so its parts' ends ARE the run's ends and the
        // same two lines are drawn as before. Only a clipped run moves, and
        // it moves to where the ink actually stops.
        const midE = (level.floorBottom + level.floorTop) / 2;
        // NO CORNER WHERE THE FACE RUNS ON IN ITS OWN PLANE -- paintFace's
        // `carriesOn`, asked of the band. Movie, 4 Oct: "see that LINE in the
        // wall". A joint between two records at one depth is not a corner,
        // and a band that stops against a wall standing in the same plane
        // (a bilevel's entry front, open past MAIN's floor) stops inside the
        // cladding, not at an edge of the building.
        const same = (a, b) => Math.abs(a - b) < 0.05;
        const flushJoint = (u, depth) => {
          const at = faces.filter(f => same(f.depth, depth));
          const lo = f => Math.min(f.u1, f.u2), hi = f => Math.max(f.u1, f.u2);
          return at.some(f => same(hi(f), u)) && at.some(f => same(lo(f), u));
        };
        const flushStop = (u, depth, part) => faces.some(f => same(f.depth, depth)
          && f.level.wallTop >= level.floorTop - 0.02
          && (f.garage ? -Infinity : f.level.floorTop) <= level.floorBottom + 0.02
          && (same(u, part.lo) ? same(Math.max(f.u1, f.u2), u) : same(Math.min(f.u1, f.u2), u)));
        // The NEAREST span at u: the band's visible face there, where
        // runDepth answers the farthest (a back wall projects onto the same u).
        const nearDepth = u => spans.reduce((d, sp) => (u >= sp.lo - 0.05 && u <= sp.hi + 0.05
          && (d == null || sp.depth > d) ? sp.depth : d), null) ?? runDepth(spans, u);
        (paintedOf.get(run) || []).forEach(part => {
          [part.lo, part.hi].forEach(u => {
            const d = nearDepth(u);
            if (flushStop(u, d, part)) return;
            edges.set(u, d);
          });
        });
        spans.forEach(span => [span.lo, span.hi].forEach(u => {
          if (u > run.lo + 0.05 && u < run.hi - 0.05 && !flushJoint(u, span.depth)
            && !edges.has(u)) edges.set(u, span.depth);
        }));
      });
      // EACH EDGE DOWN TO WHERE A ROOF IN FRONT TAKES OVER, not all or
      // nothing on the band's middle: over a garage's lean-to the building's
      // corner shows above the sheet and is hidden under it.
      // A BAND DOES NOT HIDE ITS OWN CORNERS. It is recorded flat, at its
      // run's NEAREST face, all the way along -- so at a jog in the facade
      // its strip stood in front of the deeper face's corner and swallowed
      // the very line it was drawing. Movie, 6 Oct, on E4 of his MOD BILEVEL,
      // marking the gaps in the corner line under 0'-0" and at the sill:
      // "that is the wall lines that are missing". Another wing's band in
      // front still hides it, as a nearer wall does.
      // STILL HIDDEN where nearer walls of this floor stand on BOTH sides of
      // it -- two pieces meeting in one plane in front of a deeper wall's end
      // -- which is the case the flat strip was there to cover. Only at a
      // jog, where the nearer wall ENDS, is the corner the building's own.
      const ownBand = b => Math.abs(b.top - level.floorTop) < 0.05
        && Math.abs(b.bottom - level.floorBottom) < 0.05
        && runs.some(run => b.lo >= run.lo - 0.05 && b.hi <= run.hi + 0.05);
      const nearerBothSides = (u, d) => [u - 0.1, u + 0.1].every(x => spans.some(sp =>
        sp.depth > d + 1e-6 && sp.lo <= x && sp.hi >= x));
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      ctx.beginPath();
      edges.forEach((d, u) => {
        const STEPS = 12;
        let from = null;
        for (let k = 0; k <= STEPS; k++) {
          const e = level.floorTop - (level.floorTop - level.floorBottom) * (k / STEPS);
          // Hidden by a nearer face that stands at this height, or a roof.
          // A nearer floor band is as solid as a nearer wall: a house's own
          // band stands between its walls, and a face test alone saw a gap.
          const seen = !allSpans.some(o => o.depth > d + 1e-6
            && o.lo < u - 0.05 && o.hi > u + 0.05 && o.top >= e - 1e-6 && o.bottom <= e + 1e-6)
            && !rimBands.some(b => b.depth > d + 1e-6 && (!ownBand(b) || nearerBothSides(u, d))
              && b.lo < u - 0.05 && b.hi > u + 0.05 && b.top >= e - 1e-6 && b.bottom <= e + 1e-6)
            && !behindRoof(atUDepth(u, d), e);
          if (seen && from == null) from = e;
          if ((!seen || k === STEPS) && from != null) {
            const to = seen ? level.floorBottom : e;
            ctx.moveTo(X(u), from === level.floorTop ? yTopPx : Y(from));
            ctx.lineTo(X(u), to === level.floorBottom ? yBotPx : Y(to));
            from = null;
          }
        }
      });
      ctx.stroke();
    });

    // Roof silhouette over the faces. The fascia band along the eave is the
    // face-edge pass's, below -- see the note where this pass used to draw it.
    if (lit.length > 1) {
      // Fascia band per eave run — a run breaks where the roof drops out or
      // where a differently-based roof (the garage) takes over the front.
      // The fascia's lower edge carries the roof's shadow — the heaviest
      // roof line on the sheet.
      //
      // AND THE RUNS ARE GROWN TO THE EAVE'S TRUE ENDS FIRST. The silhouette
      // is sampled and stops short of a roof's outer corner; the face edges
      // below know exactly where the eave ends. See extendRunsToEaves for the
      // measurement and for why this is not a filter.
      //
      // THE GROWING HAPPENS BEFORE THE OUTLINE IS DRAWN, and that is the whole
      // of board #453. The ends are worked out up here so the SILHOUETTE can
      // use them too: its end risers used to stand at the last sample, one
      // sample short of the band they cap, leaving a spare vertical a couple
      // of inches inside the roof's edge with the band running on past it.
      // Movie, looking at a garage roof: *"there is usually always an extra
      // line where the fascia is on one side about 1.5\" inwards that should
      // NOT be showing"*. Measured across four elevations of
      // repro-2storey-garage: 1.8", 2.1", 3.0", 3.3", 3.6" — one sampling
      // step, every time, and on ONE end of a run because the other end
      // happened to land on a sample.
      const runs = [];
      let run = null;
      silhouette.forEach((s, i) => {
        if (s.elev == null || (run && run.base !== s.base)) run = null;
        if (s.elev == null) return;
        if (!run) { run = { base: s.base, u0: s.u, u1: s.u, i0: i, i1: i }; runs.push(run); }
        else { run.u1 = s.u; run.i1 = i; }
      });
      // AND THE WALK CAN RUN THE OTHER WAY. E3 and E4 look back along their
      // axis, so u DESCENDS as the silhouette is sampled and a run comes out
      // of that loop with its ends the wrong way round -- measured on
      // repro-bungalow-garage-roofs E4: `u0 22, u1 -47.708`. Every test
      // downstream reads them as an interval, so an inverted run overlapped
      // no eave and grew by nothing, and `u1 - u0 > 0.5` then threw it away
      // before it could be banded. The band still appeared because the
      // face-edge pass draws it exactly and had nothing of the silhouette's
      // to subtract -- which is why this hid for so long: the ARTIFACT was
      // the stranded riser, and the silhouette's own band was simply absent.
      runs.forEach(r => {
        if (r.u0 <= r.u1) return;
        const u = r.u0; r.u0 = r.u1; r.u1 = u;
        const i = r.i0; r.i0 = r.i1; r.i1 = i;
      });
      // EVERY EAVE EDGE'S TRUE EXTENT, read off the same faces the pass below
      // reads, through the same test -- isEaveEdge is defined once for both,
      // so the two cannot come to different answers about what an eave is.
      const eaveSpans = [];
      if (facesByRoof) {
        facesByRoof.forEach((roofFaces, roof) => {
          const top = roofEaveElev(roof, stack, env);
          roofFaces.forEach(face => {
            const poly = face.points;
            for (let i = 0; i < poly.length; i++) {
              const a = poly[i], b = poly[(i + 1) % poly.length];
              const ea = top + geo().roofFaceRise(face, a, roof.pitch || 4);
              const eb = top + geo().roofFaceRise(face, b, roof.pitch || 4);
              if (!isEaveEdge(ea, eb, top)) continue;
              const ua = a.x * axis.x + a.z * axis.z;
              const ub = b.x * axis.x + b.z * axis.z;
              eaveSpans.push({ u0: Math.min(ua, ub), u1: Math.max(ua, ub), top });
            }
          });
        });
      }
      // TWO SAMPLES OF REACH. One is the corner the probes stepped over; the
      // second is the slack the eps above already allows for a run and an edge
      // that end a sample apart. Anything further off is another surface's
      // eave, seen past the point where this run stopped.
      extendRunsToEaves(runs.map(r => ({ ...r, top: r.base + ROOF_FASCIA_IN / 12 })),
        eaveSpans, 0.05, silhouette.length > 1
          ? 2 * Math.abs(silhouette[1].u - silhouette[0].u) : Infinity)
        .forEach((grown, index) => {
        runs[index].u0 = grown.u0;
        runs[index].u1 = grown.u1;
      });

      // WHERE A RUN'S END REALLY IS, by the sample that used to stand in for
      // it. Only ends that MOVED are listed: a gable end grows by nothing,
      // because a rake is not an eave and extendRunsToEaves never touches it,
      // so the outline there is left exactly as it was.
      //
      // KEYED BY SAMPLE, NOT BY WHICH END IT IS, so the descending walk above
      // needs no second case here -- a sample knows the u it was grown to
      // whether it opened the run or closed it. A one-sample run is left out:
      // both its risers sit on the same index, so there is no end to tell
      // apart, and it is under the half-foot the banding asks for anyway.
      const grownAt = new Map();
      runs.forEach(r => {
        if (r.i0 === r.i1) return;
        if (Math.abs(r.u0 - silhouette[r.i0].u) > 1e-9) grownAt.set(r.i0, r.u0);
        if (Math.abs(r.u1 - silhouette[r.i1].u) > 1e-9) grownAt.set(r.i1, r.u1);
      });

      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let pen = null, penI = -1, prevLit = false;
      // Closing the outline against open air. At a grown end the riser stands
      // at the eave's true edge and is exactly the fascia board: at a roof's
      // outer corner the surface top IS the fascia top, so the run out to it
      // is the last of the slope and the drop from it is 5.5" of board.
      //
      // AND ONLY AGAINST OPEN AIR. Where another roof TAKES OVER the front --
      // a lean-to running on behind the house's own sheet -- this run's end is
      // not an edge of anything: the surface carries on, hidden. The start of
      // such a run has never drawn a riser (see the moveTo below), and the end
      // of one drew a fascia drop hanging in mid-slope with nothing under it.
      const closePen = (openAir = true) => {
        if (!pen) return;
        if (!openAir) { pen = null; return; }
        const u1 = grownAt.has(penI) ? grownAt.get(penI) : pen.u;
        if (u1 !== pen.u) ctx.lineTo(X(u1), Y(pen.base + fasciaFt));
        ctx.lineTo(X(u1), Y(pen.base));
        pen = null;
      };
      silhouette.forEach((s, i) => {
        if (s.elev == null) {
          closePen();
          prevLit = false;
          return;
        }
        if (pen && pen.base !== s.base) closePen(false);
        // A roof taking over from another — a garage roof running on under
        // the house's overhang — has no vertical edge, so it starts at its
        // surface.
        if (!pen && !prevLit) {
          const u0 = grownAt.has(i) ? grownAt.get(i) : s.u;
          ctx.moveTo(X(u0), Y(s.base));
          if (u0 !== s.u) { ctx.lineTo(X(u0), Y(s.base + fasciaFt)); ctx.lineTo(X(s.u), Y(s.elev)); }
          else ctx.lineTo(X(u0), Y(s.elev));
        }
        else if (!pen) ctx.moveTo(X(s.u), Y(s.elev));
        else ctx.lineTo(X(s.u), Y(s.elev));
        pen = s; penI = i; prevLit = true;
      });
      closePen();
      ctx.stroke();

      // AND THE BAND ITSELF IS NOT DRAWN HERE. It was, and it could not be
      // hidden: this pass knows a run's u and its base and nothing about
      // what stands in front of it, so the band went down over everything.
      // On Movie's own E3 the attached garage sits BEHIND the house, and its
      // eave was banded straight across twenty-two feet of two-storey wall --
      // a pair of lines crossing the house at second-floor height with
      // nothing there to cast them.
      //
      // `extendRunsToEaves` is why it reached that far, and is not the fault:
      // a run stops a sample or two short of a roof's outer corner and the
      // riser that caps it has to stand at the true end, which is the whole
      // of board #453. Growing a run to the eave's true end is right for the
      // OUTLINE. It is the band that had no business following it across a
      // wall.
      //
      // SO THE FACE-EDGE PASS OWNS THE BAND, ALL OF IT. That pass already
      // draws exactly this band from the real eave polygons -- same two
      // lines, same inks, same 5.5" -- and it tests every station against
      // `hidden`, which is the answer this pass cannot give. It used to
      // subtract whatever was banded here and draw the leftovers; with
      // nothing drawn here it simply draws the eave, hidden stretches left
      // out. One band, one pass, one hidden test.
    }

    // Visible roof edges — eaves, rakes, ridges, hips and valleys — from the
    // real face polygons, drawn wherever no nearer roof surface stands in
    // front. The silhouette only ever answers with the tallest surface at
    // each spot, so a near wing's eave and a viewer-facing gable's rakes
    // stayed invisible behind a taller wing; this pass walks every face edge
    // and hides only the truly hidden stretches.
    if (facesByRoof && facesByRoof.size) {
      // Hidden when a nearer roof covers the point on the paper: the band it
      // projects onto, from the lowest surface the ray crosses (less its
      // fascia) up to the highest — the test `roofClippedTop` runs for walls.
      // A taller roof behind does not hide what passes under it, so each roof
      // is banded on its own rather than compared by height.
      // A roof standing behind a nearer WALL is not visible through it. The
      // wall pass fills opaque and the roof pass strokes over it afterwards,
      // so an attached garage's roof — which dies into the house wall with no
      // eave on that side — drew its whole gable, fascia and all, straight
      // through two storeys of house when the elevation was taken from the
      // far side. Faces carry the tops the wall pass already worked out
      // (plate, gable climb, roof clip), so the cover test is the wall's own
      // painted profile read at the point's u.
      const topAtU = (geom, u) => {
        const tops = geom.tops;
        if (u <= tops[0].u) return tops[0].top;
        for (let i = 1; i < tops.length; i++) {
          if (u > tops[i].u) continue;
          const lo = tops[i - 1], hi = tops[i];
          const t = (u - lo.u) / ((hi.u - lo.u) || 1);
          return lo.top + (hi.top - lo.top) * t;
        }
        return tops[tops.length - 1].top;
      };
      const behindWall = (pt, u, elev) => {
        const depth = pt.x * dir.x + pt.z * dir.z;
        return faceGeoms.some(geom => geom.face.depth > depth + WALL_COVER_EPS
          && u > geom.loU + WALL_EDGE_EPS && u < geom.hiU - WALL_EDGE_EPS
          && elev > geom.floor - ROOF_COVER_EPS
          && elev < topAtU(geom, u) - ROOF_COVER_EPS)
        || rimBands.some(band => band.depth > depth + WALL_COVER_EPS
          && u > band.lo + WALL_EDGE_EPS && u < band.hi - WALL_EDGE_EPS
          && elev > band.bottom - ROOF_COVER_EPS && elev < band.top + ROOF_COVER_EPS);
      };
      const hidden = (pt, elev, u) => {
        if (u != null && behindWall(pt, u, elev)) return true;
        return behindRoof(pt, elev);
      };
      // ── WHERE A SHEET CARRIES ON, THERE IS NO EDGE AND NO BOARD ───────
      //
      // Movie, 25 Sep, on the short gable over the garage tie: *"your updated
      // roof has an extra line in it, that should be all one connected
      // roof"*, marking the join in the elevation and again in the roof plan.
      //
      // HE IS RIGHT, AND HALF OF THIS WAS ALREADY DONE. The piece and the
      // stub meet IN THE SAME PLANE -- one is the other continued -- and the
      // fascia board that edge used to wear came off a day earlier for
      // exactly this reason. The LINE stayed. On E1 it happened to lie on the
      // stub's own hip and could not be seen; on E4 it projects to a vertical
      // and is the extra line he marked.
      //
      // SO THE TEST MOVES UP HERE AND IS ASKED PER STATION. An edge is not a
      // thing that is shared or not -- the stub's gable at the house line is
      // shared for the four feet the piece covers and free for the other
      // twenty-two, and only the shared four may go.
      //
      // BOTH ROOFS ARE READ AT ONE POINT, through this roof's own face PLANE
      // (which can be evaluated past its polygon) against the other's
      // surface. Same point, so the pitch cancels and the tolerance only has
      // to beat float noise; asked at two points it would have to cover the
      // slope, which at the format's steepest pitch is a third of a foot.
      const carriedOn = (roof, at, elev) => {
        let on = false;
        facesByRoof.forEach((otherFaces, other) => {
          if (on || other === roof) return;
          const rise = sectionRoofHeightAt(at, other, otherFaces);
          if (rise == null) return;
          if (Math.abs(roofEaveElev(other, stack, env) + rise - elev) < 0.02) on = true;
        });
        return on;
      };
      // OUTWARD FROM THIS ROOF'S OWN FOOTPRINT, so a probe lands on the sheet
      // next door and never back on this one. An edge INTERIOR to a roof -- a
      // hip, a ridge, a valley between its own faces -- has this roof on both
      // sides, and `carriedOn` skips this roof, so it answers no whichever way
      // the normal ends up pointing.
      const outwardOf = (a, b, rpts) => {
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.01) return null;
        const n = { x: -dz / len, z: dx / len };
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        return pointInPolygon({ x: mid.x + n.x * 0.05, z: mid.z + n.z * 0.05 }, rpts)
          ? { x: -n.x, z: -n.z } : n;
      };
      const seen = new Set();
      facesByRoof.forEach((roofFaces, roof) => {
        const eaveTop = roofEaveElev(roof, stack, env);
        const pitch = roof.pitch || 4;
        const rpts = roof.points || [];
        // ── A GABLE END HAS A FRONT AND A BACK, AND ONLY ONE OF THEM ──────
        //
        // Movie, 21 Sep, on the garage roof in E1 FRONT: *"you shouldn't see
        // the bottom of the top choard ... its a cottage roof nor a gable
        // roof"*, and on 22 Sep, with the ridge fixed and the two sloping
        // bands still there, marking them green: *"i can still see the
        // 'lower' line of the top chord (except in the middle where the
        // window is)"*.
        //
        // He is right, and the edges ARE rakes. roof-69's faces:
        //
        //     face 0   (-6,38) (4,38) (-6,48)
        //     face 1   (4,38) (12,38) (22,48) (-6,48)
        //     face 2   (12,38) (22,38) (22,48)
        //
        // `(-6,38)->(4,38)` and `(12,38)->(22,38)` lie flat in plan on the
        // gable line and rise in elevation from eave to ridge: the sloping
        // top edges of the gable end wall. A real rake is a board on edge and
        // shows a top and a bottom, so banding them is right -- FROM THE SIDE
        // THE GABLE FACES.
        //
        // E1 IS NOT THAT SIDE. Its cut sits at z = 48 with `dirVec {x:0,z:1}`,
        // and `behindRoof` a thousand lines up settles the sign: it steps
        // `pt + dir * 0.05` to reach the NEAR point, so +dir is toward the
        // viewer and larger z is nearer. The gable end at z = 38 faces -z,
        // away. What the drafter is looking at is the HIP in front of it --
        // `(4,38)->(-6,48)` -- which projects onto exactly the same line,
        // because both run between the same two points in elevation. A hip is
        // where two planes meet: one line, no board.
        //
        // THE BOARD SAID THIS WAS "NEVER OCCLUSION" AND HAD THE DIRECTION
        // BACKWARDS. It read larger z as farther, concluded the gable faced
        // the viewer, and closed the question. The sign is not a thing to
        // remember: `behindRoof` states it, in this file.
        const gableSegs = rpts.flatMap((a, i) => {
          if (roof.edges?.[i] !== 'gable') return [];
          const b = rpts[(i + 1) % rpts.length];
          const dx = b.x - a.x, dz = b.z - a.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.01) return [];
          // Outward is decided by the RING, not by its winding: a probe off
          // the mid-point either lands inside the footprint or it does not.
          let n = { x: -dz / len, z: dx / len };
          const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
          if (pointInPolygon({ x: mid.x + n.x * 0.1, z: mid.z + n.z * 0.1 }, rpts)) {
            n = { x: -n.x, z: -n.z };
          }
          // ── A BOARD HANGS WHERE THE ROOF STOPS ────────────────────────
          //
          // And sometimes it does not stop. A short gable covering the foot
          // of a garage tie is its own record, abutting the stub it hangs
          // off along one edge -- and that edge is marked `gable` because
          // this app's only way to say "no overhang here" is to say gable,
          // which is also the only way it says "put a rake board on it".
          // Two sheets meeting IN THE SAME PLANE then wore a board between
          // them: measured on a fresh 2 STOREY + GARAGE, E1,
          //
          //     the stub's hip    (8.00,13.227) -> (22.00,8.552)
          //     the piece's edge  (16.00,10.577) -> (22.00,8.552)   on it
          //     a fascia shadow   (22.00,8.102) -> (16.00,10.102)   5 1/2" under
          //
          // -- a pair of parallel lines running down the middle of a roof
          // with no gable under them, which is the artefact Movie marked in
          // green once already and had reverted for.
          //
          // SO THE TEST IS WHETHER ANOTHER SHEET CARRIES ON. The edge's own
          // face gives a PLANE, and a plane can be read past its polygon --
          // so this roof's surface and every other roof's are both asked at
          // ONE point, a hair outside the edge. Same point, so the pitch
          // cancels and the tolerance only has to beat float noise; ask them
          // at two points and the slack would have to cover the slope, which
          // at the format's steepest pitch is a third of a foot.
          const inward = { x: mid.x - n.x * 0.02, z: mid.z - n.z * 0.02 };
          const own = roofFaces.find(face => pointInPolygon(inward, face.points));
          if (own) {
            const past = { x: mid.x + n.x * 0.02, z: mid.z + n.z * 0.02 };
            if (carriedOn(roof, past, eaveTop + geo().roofFaceRise(own, past, pitch))) return [];
          }
          return [{ a, b, toward: n.x * dir.x + n.z * dir.z }];
        });
        // A rake LIES ALONG one gable edge; a ridge spanning gable-to-gable
        // (the dropped garage) touches two different ones and is no rake.
        //
        // AND THE EDGE MUST FACE THIS ELEVATION. 0.01 rather than 0 so a
        // gable running exactly along the line of sight -- its end seen edge
        // on, where there is no face to show a board on either -- falls out
        // rather than landing on the sign of a rounding error.
        const onGable = (p, q) => gableSegs.some(s => s.toward > 0.01
          && distToSegment(p, s.a, s.b) < 0.1 && distToSegment(q, s.a, s.b) < 0.1);
        roofFaces.forEach(face => {
          const poly = face.points;
          for (let i = 0; i < poly.length; i++) {
            // A SEAM IS NOT AN EDGE: where a roof's cut split one face into
            // pieces, the plane carries on across the join (geometry-2d's
            // cutRoofFaces marks them).
            if (face.seams && face.seams[i]) continue;
            const a = poly[i], b = poly[(i + 1) % poly.length];
            const key = [a, b].map(p => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).sort().join('|');
            if (seen.has(key)) continue;   // shared ridge/hip/valley: once is enough
            seen.add(key);
            const ea = eaveTop + geo().roofFaceRise(face, a, pitch);
            const eb = eaveTop + geo().roofFaceRise(face, b, pitch);
            const ua = a.x * axis.x + a.z * axis.z;
            const ub = b.x * axis.x + b.z * axis.z;
            if (Math.abs(ub - ua) < 0.05 && Math.abs(eb - ea) < 0.05) continue; // end-on: a point
            const samples = Math.min(48, Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5)));
            // The probe direction for this edge, worked out once: the same
            // station cannot need two of them.
            const outward = outwardOf(a, b, rpts);
            // WHETHER THIS EDGE SHOWS AT `t`, as one question, so the walk
            // below and the refinement after it cannot answer it differently.
            //
            // NO LINE WHERE THE SHEET DOES NOT STOP. Probed just past the
            // edge, on this face's own plane, so the two sheets are compared
            // where they would meet rather than where either ends.
            //
            // AND TAKEN A HAIR INSIDE THE EDGE, which is not fussiness. An
            // edge's ENDPOINTS are corners, and at a corner the probe lands
            // exactly on the neighbouring roof's own boundary, where
            // inside-or-out is a coin toss. Measured on the tie's piece, E4:
            // its 3 ft edge against the house gets three stations, the one at
            // the shared corner read as "carried on", and a foot and a half of
            // a line that should be there went with it. Touching at a corner
            // is not being continued.
            const showsAt = t => {
              const pt = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
              const u = ua + (ub - ua) * t;
              const elev = ea + (eb - ea) * t;
              if (u < uMin - 0.01 || u > uMax + 0.01 || hidden(pt, elev, u)) return false;
              const tp = Math.min(Math.max(t, 0.02), 0.98);
              const past = {
                x: a.x + (b.x - a.x) * tp + (outward ? outward.x * 0.05 : 0),
                z: a.z + (b.z - a.z) * tp + (outward ? outward.z * 0.05 : 0),
              };
              return !(outward && carriedOn(roof, past,
                eaveTop + geo().roofFaceRise(face, past, pitch)));
            };
            // ── AND A RUN ENDS AT THE EDGE, NOT AT THE LAST STATION ───────
            //
            // Movie, 26 Sep, on the corner above the tie: "this little 'wall
            // not fully dark' spot still has light area".
            //
            // THE RUN WAS STOPPING A STATION SHORT. Where a garage roof dies
            // into the house, its gable-end edge is carried on by the tie's
            // sheet for the part the tie covers and shows for the rest -- and
            // the boundary between them is wherever the tie starts, which is
            // nothing to do with where the stations fall. Measured on E4 of a
            // twoStorey-garage: the edge runs x 8..22, ten stations 1.4 ft
            // apart, the tie takes over at x = 16, and the last station that
            // showed was x = 15. So the line stopped at e 10.902 with the
            // tie's own top at 10.577, leaving FOUR INCHES where the wall
            // corner underneath is half painted over by the roof's fill and
            // nothing draws it back.
            //
            // BISECTED, because the station spacing is a sampling choice and
            // the boundary is not. Twelve halvings of a 14 ft edge land inside
            // a twentieth of an inch, and they are spent only at a boundary --
            // an edge wholly shown or wholly hidden pays nothing.
            const edgeBetween = (tShown, tHidden) => {
              let lo = tShown, hi = tHidden;
              for (let i = 0; i < 12; i += 1) {
                const mid = (lo + hi) / 2;
                if (showsAt(mid)) lo = mid; else hi = mid;
              }
              return lo;
            };
            const stations = [];
            for (let s = 0; s <= samples; s += 1) {
              const t = s / samples;
              stations.push({ t, shown: showsAt(t) });
            }
            const atT = t => ({ u: ua + (ub - ua) * t, e: ea + (eb - ea) * t });
            const runs = [];
            let run = null;
            stations.forEach((st, i) => {
              if (!st.shown) { run = null; return; }
              const prev = stations[i - 1], next = stations[i + 1];
              if (!run) {
                const t0 = prev ? edgeBetween(st.t, prev.t) : st.t;
                const p = atT(t0);
                run = { u0: p.u, e0: p.e, u1: p.u, e1: p.e, t0, t1: t0 };
                runs.push(run);
              }
              const t1 = next && !next.shown ? edgeBetween(st.t, next.t) : st.t;
              const q = atT(t1);
              run.u1 = q.u; run.e1 = q.e; run.t1 = t1;
            });
            const eave = isEaveEdge(ea, eb, eaveTop);
            // AND A RAKE SLOPES, which is what makes it a rake and not the
            // ridge the rake runs up to. `onGable` asks only whether both
            // ends of an edge lie on a gable PLAN edge, and the flat top of
            // a gable end lies on it as squarely as the sloped sides do.
            //
            // THIS TEST WAS WRITTEN ONCE ALREADY, 21 Sep, and in the wrong
            // place: on the fascia-band branch alone, where it fixed the
            // band Movie was looking at -- *"you shouldn't see the bottom of
            // the top choard"* -- and left the other reader of `rake`, the
            // soffit return sixty lines down, still calling the ridge a
            // rake. Measured on proto/repro-movie-garage-2storey.draft, E1,
            // with the band gone: a solid w1 line still ran level at
            // `u 4..6, e 11.452`, one board under the ridge at 11.902 and
            // exactly the 2 ft of overhang long. A soffit return closes the
            // open corner under a rake's low end; a ridge has no such
            // corner, and nothing to close it with.
            //
            // So the test belongs to the WORD, not to one painter of it.
            // The run-level slope test on the band branch below stays: a run
            // is a visible piece of an edge, not the edge, and that one is
            // guarding run extent rather than answering "is this a rake".
            const rake = !eave && onGable(a, b) && Math.abs(eb - ea) > 0.05;
            // A run too short to be an edge paints nothing, and the corner it
            // stands on is not "shown" for the soffit return either — a rake
            // hidden behind the house all but its bottom point once hung its
            // soffit line off that one surviving station.
            //
            // MEASURED AS A LENGTH, AND AGAINST THE DRAWING'S OWN SHORTEST
            // EDGE. This used to read "more than 0.05 on either axis", which
            // was a way of saying "spanned more than one station" back when a
            // run's ends WERE stations. Now that they are refined to the real
            // boundary, a run that covers a single station has a real extent
            // and eleven of them appeared across proto/ at 0.05..0.08 ft --
            // an inch of ink at a corner, saying nothing.
            //
            // HALF A FASCIA. Counted over every fixture, the shortest edge
            // this painter draws is 0.4500 ft, which is ROOF_FASCIA_IN: the
            // depth of the board, drawn wherever an eave is cut off square.
            // So half of it is below anything real by a factor of two and
            // above every sliver by three, and it moves if the board does.
            const drawn = runs.filter(r =>
              Math.hypot(r.u1 - r.u0, r.e1 - r.e0) > fasciaFt / 2);
            drawn.forEach(r => {
              if (eave) {
                // An eave wears the fascia band: the light top line and the
                // heavy shadow along its bottom. THE WHOLE BAND IS DRAWN
                // HERE -- this run is already a VISIBLE stretch of the eave,
                // every station of it past `hidden`, which is why the band
                // moved off the silhouette pass and onto this one.
                const spans = [{ u0: Math.min(r.u0, r.u1), u1: Math.max(r.u0, r.u1) }];
                spans.filter(sp => sp.u1 - sp.u0 > 0.2).forEach(sp => {
                  ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(X(sp.u0), Y(eaveTop)); ctx.lineTo(X(sp.u1), Y(eaveTop));
                  ctx.stroke();
                });
                // ── THE BOARD'S FOOT IS ASKED ON ITS OWN ───────────────
                //
                // Movie, 5 Oct, on E3 of a MOD BILEVEL: "the top peak of the
                // roof should extend up above the eave of the 2nd floor roof
                // (main fl roof peak it is in front)". The run above is where
                // the eave's TOP shows, and the heavy line 5.5" under it was
                // drawn the whole length of that run -- straight across the
                // main roof's ridge, which stands nearer and between the two.
                // So the foot gets its own visibility, at its own height.
                const footE = eaveTop - ROOF_FASCIA_IN / 12;
                const tLo = Math.min(r.t0, r.t1), tHi = Math.max(r.t0, r.t1);
                // Half-foot stations, then bisected to the real boundary the
                // way the run's own ends are: a ridge poking 1 1/2" past the
                // board is under a foot wide, and painting every station of
                // every eave at a finer spacing costs the mutation sweeps.
                const steps = Math.max(2, Math.ceil(Math.abs(r.u1 - r.u0) / 0.5));
                const footShows = t => !hidden(
                  { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, footE, ua + (ub - ua) * t);
                const footEdge = (tIn, tOut) => {
                  let lo = tIn, hi = tOut;
                  for (let i = 0; i < 8; i += 1) {
                    const mid = (lo + hi) / 2;
                    if (footShows(mid)) lo = mid; else hi = mid;
                  }
                  return lo;
                };
                const ts = [];
                for (let k = 0; k <= steps; k += 1) ts.push(tLo + (tHi - tLo) * k / steps);
                const shows = ts.map(footShows);
                const feet = [];
                let foot = null;
                ts.forEach((t, k) => {
                  if (!shows[k]) { foot = null; return; }
                  if (!foot) {
                    const t0 = k > 0 ? footEdge(t, ts[k - 1]) : t;
                    foot = { u0: ua + (ub - ua) * t0, u1: 0 };
                    feet.push(foot);
                  }
                  const t1 = k < ts.length - 1 && !shows[k + 1] ? footEdge(t, ts[k + 1]) : t;
                  foot.u1 = ua + (ub - ua) * t1;
                });
                ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
                feet.filter(f => Math.abs(f.u1 - f.u0) > 0.05).forEach(f => {
                  ctx.beginPath();
                  ctx.moveTo(X(f.u0), Y(footE)); ctx.lineTo(X(f.u1), Y(footE));
                  ctx.stroke();
                });
              } else if (rake && Math.abs(r.u1 - r.u0) > 0.2
                && Math.abs(r.e1 - r.e0) > 0.05) {
                // A rake wears its fascia too: the sloped board along the
                // gable edge, top line light, heavy shadow 5.5" under it.
                //
                // AND A RAKE SLOPES, WHICH IS WHY THE SECOND TEST IS THERE.
                // `onGable` asks whether both ends of an edge lie on a gable
                // plan edge, and a RIDGE that terminates at that edge passes
                // -- so the flat top of a gable end was wearing a fascia
                // board. Measured on proto/repro-movie-garage-2storey.draft,
                // E1: three runs on roof-69's gable edge, `u -6..4` rising,
                // `u 4..12` FLAT at 11.885, `u 12..22` falling, all three
                // banded. The middle one is the ridge, and a ridge is where
                // two planes meet: no board, one line.
                //
                // Movie, looking at exactly that: *"you shouldn't see the
                // bottom of the top choard in the front elevation"*.
                //
                // 0.05 ft is the same slack the run filter above uses to
                // decide a run has any extent at all, rather than a second
                // tolerance invented here.
                const drop = ROOF_FASCIA_IN / 12;
                ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(X(r.u0), Y(r.e0)); ctx.lineTo(X(r.u1), Y(r.e1));
                ctx.stroke();
                ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
                ctx.beginPath();
                ctx.moveTo(X(r.u0), Y(r.e0 - drop)); ctx.lineTo(X(r.u1), Y(r.e1 - drop));
                ctx.stroke();
              } else {
                ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(X(r.u0), Y(r.e0)); ctx.lineTo(X(r.u1), Y(r.e1));
                ctx.stroke();
              }
            });
            const overhang = Number(roof.overhang) || 0;
            if (rake && drawn.length && overhang > 0.05) {
              // The metal soffit closes the corner: a line from the low
              // point of the rake fascia straight back to the house wall,
              // the flat soffit plane under the eave-overhang triangle.
              // The reach back to the wall runs ALONG the rake's plan
              // direction — the EAVE-side offset at the corner — so it is
              // measured by projecting the corner's BONEYARD master point
              // (the wall corner it was offset from) onto that direction.
              // Halved-gable builds (board #252) and intent-pulled edges
              // both land the line exactly on the wall face this way;
              // roof.overhang stays the fallback for unlinked roofs.
              const drop = ROOF_FASCIA_IN / 12;
              const lo = ea <= eb ? { p: a, u: ua, e: ea } : { p: b, u: ub, e: eb };
              const hi = ea <= eb ? { p: b, u: ub, e: eb } : { p: a, u: ua, e: ea };
              const len = Math.hypot(hi.p.x - lo.p.x, hi.p.z - lo.p.z) || 1;
              const rux = (hi.p.x - lo.p.x) / len, ruz = (hi.p.z - lo.p.z) / len;
              const srcPt = rpts.find(rp => Math.hypot(rp.x - lo.p.x, rp.z - lo.p.z) < 0.05);
              const masterPt = srcPt?.srcId ? env.masterPointById(srcPt.srcId) : null;
              const along = masterPt
                ? (masterPt.x - lo.p.x) * rux + (masterPt.z - lo.p.z) * ruz : NaN;
              const reach = Number.isFinite(along) && along > 0.05 ? along : overhang;
              const wallU = (lo.p.x + rux * reach) * axis.x + (lo.p.z + ruz * reach) * axis.z;
              const shown = drawn.some(r => Math.min(r.u0, r.u1) - 0.1 <= lo.u
                && lo.u <= Math.max(r.u0, r.u1) + 0.1);
              if (shown && reach > 0.05 && Math.abs(wallU - lo.u) > 0.2
                && lo.u >= uMin - 0.01 && lo.u <= uMax + 0.01) {
                const wallUc = Math.max(uMin, Math.min(uMax, wallU));
                ctx.strokeStyle = INK; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(X(lo.u), Y(lo.e - drop));
                ctx.lineTo(X(wallUc), Y(lo.e - drop));
                ctx.stroke();
                // GABLE CORNER treatments (board #252). Everything below is
                // metal matching the fascia — one blended family, drawn in
                // the soffit/crease inks, never the heavy silhouette.
                const style = env.gableCornerStyle();
                const du = hi.u - lo.u;
                if (Math.abs(du) > 0.3) {
                  const undersideAt = u => lo.e + (u - lo.u) / du * (hi.e - lo.e) - drop;
                  if (style === 'return') {
                    // SOFFIT RETURN: the eave soffit wraps the corner — a
                    // short cornice-return band continuing the eave fascia
                    // across the gable face, capped with a vertical seam.
                    const dirIn = Math.sign(wallU - lo.u) || 1;
                    const retLen = Math.min(Math.abs(wallU - lo.u), 1.25);
                    const uEnd = lo.u + dirIn * retLen;
                    ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(X(lo.u), Y(lo.e)); ctx.lineTo(X(uEnd), Y(lo.e));
                    ctx.stroke();
                    ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
                    ctx.beginPath();
                    ctx.moveTo(X(lo.u), Y(lo.e - drop)); ctx.lineTo(X(uEnd), Y(lo.e - drop));
                    ctx.stroke();
                    ctx.lineWidth = 1.25;
                    ctx.beginPath();
                    ctx.moveTo(X(uEnd), Y(lo.e));
                    ctx.lineTo(X(uEnd), Y(lo.e - drop));
                    ctx.stroke();
                  } else if (style === 'porkchop' || style === 'boxed') {
                    // PORK CHOP: the boxed corner return — the little
                    // pyramid between the rake underside, the soffit line,
                    // and this inner vertical face at the wall. (The
                    // vertical the owner removed from FLAT CLOSE returns
                    // here on purpose: this corner is metal, not wall
                    // finish, so the seam against the wall exists.)
                    ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
                    ctx.beginPath();
                    ctx.moveTo(X(wallUc), Y(lo.e - drop));
                    ctx.lineTo(X(wallUc), Y(undersideAt(wallU)));
                    ctx.stroke();
                    if (style === 'boxed') {
                      // FULL BOXED RAKE: the pork chop soffit runs end to
                      // end — the box's wall-side edge parallels the rake
                      // underside the whole way up, stopping under the
                      // apex where it meets its twin from the other slope
                      // in a single peak vertex.
                      const peakE = lo.e - drop + (hi.u - wallU) / du * (hi.e - lo.e);
                      ctx.lineWidth = 1;
                      ctx.beginPath();
                      ctx.moveTo(X(wallUc), Y(lo.e - drop));
                      ctx.lineTo(X(Math.max(uMin, Math.min(uMax, hi.u))), Y(peakE));
                      ctx.stroke();
                    }
                  }
                }
              }
            }
          }
        });
        // The fascia creases at every plan corner: where the roof edge
        // changes direction (an outside corner, or a valley landing on a
        // re-entrant one) a thin vertical seam crosses the 5.5" band.
        rpts.forEach((pt, i) => {
          const prev = rpts[(i + rpts.length - 1) % rpts.length];
          const next = rpts[(i + 1) % rpts.length];
          const kindPrev = roof.edges?.[(i + rpts.length - 1) % rpts.length];
          const kindNext = roof.edges?.[i];
          if (kindPrev === 'gable' && kindNext === 'gable') return;
          const d1 = { x: pt.x - prev.x, z: pt.z - prev.z };
          const d2 = { x: next.x - pt.x, z: next.z - pt.z };
          const cross = d1.x * d2.z - d1.z * d2.x;
          const l1 = Math.hypot(d1.x, d1.z), l2 = Math.hypot(d2.x, d2.z);
          if (l1 < 0.05 || l2 < 0.05 || Math.abs(cross) < 0.02 * l1 * l2) return;
          const u = pt.x * axis.x + pt.z * axis.z;
          if (u < uMin - 0.01 || u > uMax + 0.01 || hidden(pt, eaveTop, u)) return;
          // ── AND NOT WHERE THE EAVE SIMPLY CARRIES ON ────────────────
          //
          // Movie, 25 Sep, on E4 of a 2 STOREY + GARAGE, twice: "the
          // exterior front house line is showing through in the roof and at
          // main floor level", then "the line still visible through the roof
          // on the 2 storey with garage".
          //
          // IT IS NOT A WALL LINE. Read off the tape at the house's front
          // wall line, u -20 on repro-tie-gable E4:
          //
          //     seq 57/58   the garage band   u -48.00..-20.00   e 8.10..8.55
          //     seq 64/65   the stub's band   u -20.00..-17.00   e 8.10..8.55
          //     seq 60      a riser           u -20.00           e 8.10..8.55
          //     seq 68      the same riser again
          //
          // -- one straight eave, banded in two pieces because it is carried
          // by two roof POLYGONS, and each polygon creased its own end. Drawn
          // twice, at 1.25 against the band's own 1, so it reads heavier than
          // the band it crosses and lands exactly on the house's front wall
          // line, which is what made it look like the wall showing through.
          //
          // THE FILE ALREADY KNOWS THIS SENTENCE. `carriedOn` was written for
          // the roof EDGE pass, for the same defect one component over --
          // Movie, on the short gable over the garage tie: "your updated roof
          // has an extra line in it, that should be all one connected roof".
          // A corner is a corner of the POLYGON; whether it is a corner of
          // the BUILDING is a question about the sheet next door, and this
          // asks the same helper rather than growing a second answer.
          //
          // PROBED ALONG THE BOARD, PAST THE CORNER -- not across it, and not
          // at the corner itself. `carriedOn(roof, pt, ...)` answers no here:
          // pt is on the neighbour's own boundary, where inside-or-out is a
          // coin toss, and the edge pass's note says exactly that ("Touching
          // at a corner is not being continued") and clamps its stations away
          // from the ends for it. The question a CREASE asks has a direction
          // the edge pass's has not: does a sheet next door carry this same
          // board straight on through? So each of the two edges is followed
          // PAST pt -- outside this polygon by construction, since the
          // polygon turns there -- and the neighbour is asked at that point.
          //
          // AND A HAIR INWARD WITH IT, which the measurement forced. The two
          // sheets share the eave LINE, so a probe that only steps along it
          // lands on the neighbour's boundary too and answers the same coin
          // toss. Measured on repro-tie-gable E4: the shared corner is
          // (22.00, 20.00), the garage roof runs z 20..48 and the stub
          // z 17..20, both out to x 22 -- and the along-only probe
          // (22.00, 19.90) sits exactly on the stub's own edge.
          //
          // The nudge is 1/4", against 1 3/4" along, because it climbs the
          // slope: `carriedOn` matches surfaces to 0.02 ft, and at the
          // format's steepest pitch 1/4" inward gains well under that while
          // a whole inch would not.
          const inwardOf = (a, b) => {
            const n = outwardOf(a, b, rpts);
            return n ? { x: -n.x * 0.02, z: -n.z * 0.02 } : { x: 0, z: 0 };
          };
          const stepPast = (dir, len, a, b) => {
            const inw = inwardOf(a, b);
            return { x: pt.x + dir.x / len * 0.15 + inw.x,
              z: pt.z + dir.z / len * 0.15 + inw.z };
          };
          const past = [
            stepPast(d1, l1, prev, pt),
            stepPast({ x: -d2.x, z: -d2.z }, l2, pt, next),
          ];
          if (past.some(p => carriedOn(roof, p, eaveTop))) return;
          ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(X(u), Y(eaveTop));
          ctx.lineTo(X(u), Y(eaveTop - ROOF_FASCIA_IN / 12));
          ctx.stroke();
        });
      });
    }

    // ── THE POSTS, AND THE PILES UNDER THEM ─────────────────────────────
    //
    // pilePosts says which piles carry a post and how high it goes. Painted
    // LAST, after the walls and the roof: a post out in the open stands in
    // front of the house it holds up, and painted with the piles it would be
    // under every wall face that follows. Behind the house it is hidden the
    // way a pile is -- by a foundation nearer than it over its station --
    // and here by ANY nearer concrete, since a post is no part of the
    // garage's beam arrangement the way the garage's own piles are.
    //
    // The post is solid, 5 1/2" wide, from the top of the concrete up to
    // what it carries; the pile is its own width, solid above grade and
    // dashed below it down off the sheet, as every pile is.
    const drawn = [];
    posts.forEach(post => {
      const u = post.point.x * axis.x + post.point.z * axis.z;
      if (u < uMin - 0.5 || u > uMax + 0.5) return;
      const depth = post.point.x * dir.x + post.point.z * dir.z;
      if (fdnGeoms.some(g => g.depth > depth + 1 && u > g.lo + 0.05 && u < g.hi - 0.05)) return;
      const bh = window.DraftBuildHouse;
      const pileHalf = ((bh && bh.footingFor(post.column.footing).sizeIn) || 12) / 24;
      const half = post.sizeIn / 24;
      // A box in model feet, filled and outlined as one path.
      const box = (u0, u1, e0, e1, fill) => {
        ctx.beginPath();
        ctx.moveTo(X(u0), Y(e0)); ctx.lineTo(X(u1), Y(e0));
        ctx.lineTo(X(u1), Y(e1)); ctx.lineTo(X(u0), Y(e1));
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      };
      ctx.setLineDash([]);
      // The pile's head above grade, then its shaft below, dashed.
      if (post.foot > fdn.grade) box(u - pileHalf, u + pileHalf, fdn.grade, post.foot, C.faceShade);
      ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      [u - pileHalf, u + pileHalf].forEach(edge => {
        ctx.beginPath();
        ctx.moveTo(X(edge), Y(Math.min(fdn.grade, post.foot)));
        ctx.lineTo(X(edge), Y(yBottom));
        ctx.stroke();
      });
      ctx.setLineDash([]);
      box(u - half, u + half, post.foot, post.top, C.face);
      drawn.push({ u: Number(u.toFixed(3)), foot: Number(post.foot.toFixed(4)),
        top: Number(post.top.toFixed(4)), carries: post.carries });
    });
    if (ctx.canvas && ctx.canvas.setAttribute) ctx.canvas.setAttribute('data-posts', JSON.stringify(drawn));

    // Grade, heavy, straight across the sheet — the exposed concrete stands
    // on it and everything below it reads dashed.
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginL - 18, Y(fdn.grade));
    ctx.lineTo(w - marginR, Y(fdn.grade));
    ctx.stroke();
    paintElevationMarks(env, ctx, cut, X, Y, pxPerFt, C, opts,
      { x0, y0, pxPerFt, uMin, yTop });
    return true;
  }

  // Heel height: the fascia board plus whatever the pitch gains over the
  // overhang. MODEL.dc.html computed this from its own arguments while the
  // fascia constant it needs lived here -- the number and the formula using it
  // in different files.
  const roofHeelIn = (pitch, overhangFt) => ROOF_FASCIA_IN + overhangFt * pitch;

  window.DraftCutView = Object.freeze({
    STANDARDS: Object.freeze({
      GARAGE_SLAB_THICKNESS_IN,
      GARAGE_SLAB_ABOVE_GRADE_IN,
      GARAGE_SLAB_SLOPE_IN_PER_FT,
      GARAGE_SLAB_AT_DOOR_IN,
      GARAGE_SLAB_FLAT_AT_FT,
      GARAGE_DOOR_BUCK_IN,
      DOOR_THRESHOLD_IN,
      GARAGE_BEAM_PLATE_IN,
    GARAGE_BEAM_CONCRETE_IN,
      GRADE_BELOW_FOUNDATION_TOP_FT,
      GARAGE_BEAM_ABOVE_GRADE_FT,
      DETACHED_BEAM_ABOVE_GRADE_IN,
      GARAGE_SILL_BELOW_HOUSE_FT,
      GARAGE_EDGE_DEPTH_IN,
      ROOF_FASCIA_IN,
    }),
    roofHeelIn,
    garageSlabBelowConcreteIn,
    garageDoorOpeningFt,
    garageDepthFt,
    cutAxis,
    sectionLevelStack,
    extendRunsToEaves,
    sectionWallCrossings,
    cutViewExtents,
    elevationFaces,
    faceSillFt,
    roofBaseElev,
    roofEaveElev,
    pilePosts,
    POST_SIZE_IN,
    garageBearing,
    garageConcreteTop,
    garageSlabTop,
    garageFloorAt,
    doorPoint,
    sameGarageBody,
    gradeFromBearing,
    frostWallTop,
    garageSillDropFt,
    floorRuns,
    garageOfWall,
    garageOfRoof,
    garageOfFloor,
    isGarageRoof,
    bodyDrift,
    sectionRoofHeightAt,
    drawCutView,
    drawSectionWall,
    drawElevationView,
    // The ink table and the two ways to get one: paper by default, or the
    // skin a page is wearing.
    PAPER_INKS,
    inksFromSkin,
  });
})();
}
