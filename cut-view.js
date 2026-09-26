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
  const { WALL_TYPES } = window.DraftWallTypes;
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
  function garageSillDropFt(buildType, mode) {
    if (mode !== 'frostwall') return 0;
    return ['bilevel', 'modifiedBilevel'].includes(buildType) ? 0 : GARAGE_SILL_BELOW_HOUSE_FT;
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

  // THE FINISHED GARAGE FLOOR -- what a stair lands on, what the door sits at,
  // and the one number three painters were each deriving for themselves. See
  // GARAGE_SLAB_ABOVE_GRADE_IN for what they each had.
  function garageSlabTop(env, fdn, garage) {
    const top = garageConcreteTop(env, fdn, garage);
    // The monolithic pour's top IS the floor; there is no slab poured onto it.
    if (env.garageFoundation(garage) === 'thickened') return top;
    return top - GARAGE_SLAB_THICKNESS_IN / 12;
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
  function extendRunsToEaves(runs, eaves, eps = 0.05) {
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
        u0 = Math.min(u0, eave.u0);
        u1 = Math.max(u1, eave.u1);
      });
      return { ...run, u0, u1 };
    });
  }

  function sectionLevelStack(env) {
    const floors = env.floorLevels();
    if (!floors.length) return null;
    let floorTop = 0;
    const stack = floors.map((level, index) => {
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
    const lowest = stack[0];
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
    const wallBottom = wallTop - houseSillPlateFt()
      - env.levelWallTopFt(1, 'foundation');
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
    const bearer = standing.length ? standing[standing.length - 1]
      : stack[stack.length - 1];
    return {
      floors: stack,
      bearing: bearer.wallTop,
      foundation: {
        wallTop, wallBottom,
        grade: gradeFromBearing(wallTop),
        slabTop: wallBottom + foundationAssembly.slabThicknessIn / 12,
        slabIn: foundationAssembly.slabThicknessIn,
        footingBottom: wallBottom - foundationAssembly.footingDepthIn / 12,
        footingIn: foundationAssembly.footingDepthIn,
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
  // really there. room-grow.js and closets.js already build interior walls.
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

  function cutViewExtents(env, cut) {
    const stack = sectionLevelStack(env);
    if (!stack) return null;
    const axis = cutAxis(cut);
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
        roofSamples.push({ u: pt.u, elev: pt.rise });
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
        if (runs.length) return runs;
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
    fdnCrossings.forEach(c => {
      const top = fdn.wallBottom + c.wall.topHeight;
      const base = fdn.wallBottom + c.wall.baseHeight;
      ctx.fillStyle = weight(C.concrete, 0.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      const x = X(c.u - c.width / 2), wid = c.width * pxPerFt;
      ctx.fillRect(x, Y(top), wid, (top - base) * pxPerFt);
      ctx.strokeRect(x, Y(top), wid, (top - base) * pxPerFt);
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
    // A frost-wall garage's slab: 4" thick, its top 4" below the top of the
    // wall's concrete, between the garage's own bearing walls. The 1/8"/ft
    // fall is toward the door, across the cut, so the band reads level here.
    const frostGarages = [...new Set(fdnCrossings
      .filter(c => c.garage && c.wall.baseHeight <= 0.01 && env.garageFoundation(c.garage) === 'frostwall')
      .map(c => c.garage))];
    frostGarages.forEach(garage => {
      const us = fdnCrossings.filter(c => c.garage === garage).map(c => c.u);
      if (us.length < 2 || Math.max(...us) - Math.min(...us) <= 1) return;
      const top = garageSlabTop(env, fdn, garage);
      ctx.fillStyle = weight(C.concrete, 0.35);
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      const x = X(Math.min(...us)), wid = (Math.max(...us) - Math.min(...us)) * pxPerFt;
      ctx.fillRect(x, Y(top), wid, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
      ctx.strokeRect(x, Y(top), wid, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
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
        // of concrete less the slab -- rather than a second arrangement.
        const slabTop = garage ? garageSlabTop(env, fdn, garage)
          : fdn.wallBottom + Math.max(...beamCrossings.map(c => c.wall.topHeight))
            - GARAGE_SLAB_THICKNESS_IN / 12;
        // THE GRAVEL HANGS OFF THE SLAB, NOT OFF THE PLATE. It was measured
        // down from the sill plate top, which worked only while the slab was
        // drawn a slab ABOVE that plate. With the floor at the spec's
        // grade + 10" the plate is above the slab, so the "under-slab" line
        // would have been struck at grade + 9 1/2" -- inside a slab spanning
        // grade + 6" to grade + 10". Same detail, same offsets, hung off the
        // one thing it describes the underside of.
        const slabBottom = slabTop - GARAGE_SLAB_THICKNESS_IN / 12;
        ctx.fillStyle = weight(C.concrete, 0.35);
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(X(lo), Y(slabTop), (hi - lo) * pxPerFt, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
        ctx.strokeRect(X(lo), Y(slabTop), (hi - lo) * pxPerFt, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
        ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(X(lo), Y(slabBottom - 0.5));
        ctx.lineTo(X(hi), Y(slabBottom - 0.5));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ink(0.45);
        for (let g = lo + 0.5; g < hi - 0.25; g += 0.75) {
          const j = (g * 7.3) % 1;   // deterministic jitter, no flicker on redraw
          ctx.beginPath();
          ctx.arc(X(g + j * 0.3), Y(slabBottom - 0.1 - j * 0.32), 1.1, 0, Math.PI * 2);
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

    // Roof profile over everything: the sampled top chord plus fascia drops.
    const lit = roofSamples.filter(s => s.elev != null);
    if (lit.length > 1) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let pen = null;
      roofSamples.forEach(s => {
        if (s.elev == null) {
          if (pen) ctx.lineTo(X(pen.u), Y(pen.elev - fasciaFt));
          pen = null;
          return;
        }
        if (!pen) {
          ctx.moveTo(X(s.u), Y(s.elev - fasciaFt));     // fascia drop at the edge
          ctx.lineTo(X(s.u), Y(s.elev));
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
    const gapBottom = opening.type === 'door' ? bottom : bottom + sillFt;
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
    const faces = [];
    const fdnFaces = [];
    env.walls().forEach(wall => {
      const p1 = proj(wall.start), p2 = proj(wall.end);
      if (Math.max(p1.u, p2.u) < uMin || Math.min(p1.u, p2.u) > uMax) return;
      if ((wall.view || 'plan') === 'foundation') {
        const type = WALL_TYPES.find(w => w.id === wall.wallType);
        fdnFaces.push({
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
      const level = levelById[wall.levelId];
      if (!level || Math.abs(p2.u - p1.u) < 0.5) return;
      faces.push({
        wall, u1: p1.u, u2: p2.u, depth: (p1.d + p2.d) / 2, level,
        garage: garageFor(wall),
      });
    });
    if (!faces.length) return false;
    faces.sort((a, b) => a.depth - b.depth);   // viewer sits on +dir: far first

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
        topE: fdn.wallBottom + face.top,
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
    const behindFdn = (g, o) => o !== g
      && o.depth > g.depth + 1e-6
      && o.topE >= g.topE - 1e-3
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
    const PLATE_CAP_FT = 0.5;
    const plateTopOf = g => (g.garage
      ? garageBearing(env, fdn, g.garage) : fdn.wallTop);
    const plateOf = g => {
      const rise = plateTopOf(g) - g.topE;
      return rise > 0.01 && rise < PLATE_CAP_FT ? rise : 0;
    };
    shownFdn.forEach(({ g, runs }) => {
      const shownBase = Math.max(g.baseE, fdn.grade);
      ctx.fillStyle = C.faceShade;
      runs.forEach(r => ctx.fillRect(X(r.lo), Y(g.topE),
        (r.hi - r.lo) * pxPerFt, (g.topE - shownBase) * pxPerFt));
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
      ctx.fillStyle = C.face;
      runs.forEach(r => ctx.fillRect(X(r.lo), Y(g.topE + plate),
        (r.hi - r.lo) * pxPerFt, plate * pxPerFt));
    });
    // Strokes after every fill, so a near face can't erase a far corner.
    ctx.lineWidth = 1;
    const strokedV = new Set();
    shownFdn.forEach(({ g, runs }) => {
      const shownBase = Math.max(g.baseE, fdn.grade);
      ctx.strokeStyle = INK;
      ctx.beginPath();
      runs.forEach(r => {
        ctx.moveTo(X(r.lo), Y(g.topE)); ctx.lineTo(X(r.hi), Y(g.topE));
        ctx.moveTo(X(r.lo), Y(shownBase)); ctx.lineTo(X(r.hi), Y(shownBase));
      });
      ctx.stroke();
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
        // the note above this pass was written against -- and it would be
        // wrong here too, because the step is real and a drafter looking for
        // it should find it. Drawn to the nearest COVERING face's top, the
        // crease is three eighths of an inch long: the truth, at the size
        // the truth is.
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
    pileColumns.forEach(column => {
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
    // Only a wall running ALONG the gable climbs; a perpendicular wall
    // passing the gable's corner keeps its plate.
    const gableTopAt = (pt, plateTop, wallDir) => {
      let top = plateTop;
      if (!facesByRoof) return top;
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
    const faceGeoms = faces.map(face => {
      const { wall, u1, u2, level } = face;
      const loU = Math.max(Math.min(u1, u2), uMin);
      const hiU = Math.min(Math.max(u1, u2), uMax);
      const floor = face.garage ? garageBase(face.garage) : level.floorTop;
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
      const tops = [];
      for (let s = 0; s <= samples; s++) {
        const u = loU + (hiU - loU) * s / samples;
        const at = worldAt(u);
        // Dropped to the floor of a nearer roof's band when that band swallows
        // the wall's top. What is left below still meets the nearer WALLS, and
        // the painter's opaque fill goes on covering that the way it always has.
        // Never below the face's own floor: a band floor under this storey
        // would turn the face inside out rather than hide it.
        const top = Math.max(floor, roofClippedTop(at, face.depth,
          gableTopAt(at, level.wallTop, wallDir)));
        tops.push({ u, top });
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
        gableTopAt(other.worldAt(s.u), other.face.level.wallTop, other.wallDir) >= s.top - 1e-3));
    const paintFace = geom => {
      const { face, loU, hiU, floor, tops } = geom;
      const { wall, u1, u2, level } = face;
      const xa = X(loU), xb = X(hiU);
      ctx.fillStyle = C.face;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(xa, Y(floor));
      tops.forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.lineTo(xb, Y(floor));
      ctx.closePath();
      ctx.fill();
      // The wall finish runs into the soffit triangle: end verticals stop
      // at the plate, only the top profile follows the roof underside.
      ctx.beginPath();
      ctx.moveTo(xa, Y(floor));
      ctx.lineTo(xa, Y(Math.min(tops[0].top, level.wallTop)));
      ctx.moveTo(X(tops[0].u), Y(tops[0].top));
      tops.slice(1).forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.moveTo(xb, Y(Math.min(tops[tops.length - 1].top, level.wallTop)));
      ctx.lineTo(xb, Y(floor));
      // ── AND A GARAGE WALL DOES NOT LINE ITS OWN BASE ─────────────────
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
      // THE HOUSE KEEPS ITS LINE. A house face's floor is a STOREY line --
      // the main floor across the facade, with the band's white directly
      // under it and no concrete for a foot -- and it is the line a drafter
      // expects at a floor level. The two cases differ in what the face
      // stands on, which is exactly what `face.garage` records.
      if (!face.garage) ctx.lineTo(xa, Y(floor));
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
        const bottom = f.type === 'door' ? floor : floor + sill;
        ctx.fillStyle = C.recess;
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(ox, Y(top), ow, (top - bottom) * pxPerFt);
        ctx.strokeRect(ox, Y(top), ow, (top - bottom) * pxPerFt);
        const clipped = uc - half < uMin - 1e-6 || uc + half > uMax + 1e-6;
        if (clipped) return;
        if (f.type === 'door' && !f.garage) {
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
          if (!Number.isFinite(area2) || Math.abs(area2) < 4) return;
          const parts = [pts];
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            const ea = eaveTop + geo().roofFaceRise(face, a, pitch);
            const eb = eaveTop + geo().roofFaceRise(face, b, pitch);
            if (!isEaveEdge(ea, eb, eaveTop)) continue;
            const xa = X(a.x * axis.x + a.z * axis.z);
            const xb = X(b.x * axis.x + b.z * axis.z);
            if (Math.abs(xb - xa) < 1) continue;   // this eave runs away from us
            parts.push([
              { x: xa, y: Y(eaveTop) }, { x: xb, y: Y(eaveTop) },
              { x: xb, y: Y(base) }, { x: xa, y: Y(base) },
            ]);
          }
          const depth = Math.max(...pts.map(pt => pt.d));
          if (!Number.isFinite(depth)) return;
          roofFills.push({ depth, parts });
        });
      });
    }
    const paintRoof = ({ parts }) => {
      ctx.fillStyle = C.face;
      parts.forEach(part => {
        ctx.beginPath();
        ctx.moveTo(part[0].x, part[0].y);
        for (let i = 1; i < part.length; i++) ctx.lineTo(part[i].x, part[i].y);
        ctx.closePath();
        ctx.fill();
      });
    };
    // FAR FIRST, AND ON A TIE THE WALL GOES DOWN BEFORE THE ROOF. A sheet
    // whose nearest corner lands exactly on a wall's depth is a sheet bearing
    // on that wall's own plate, and it laps OVER the plate -- which is both
    // how the roof is built and the only way round that cannot rub out a
    // gable wall's climb. `sort` is stable, so listing the walls first is
    // what states it.
    [
      ...faceGeoms.filter(geom => !faceHidden(geom))
        .map(geom => ({ depth: geom.face.depth, go: () => paintFace(geom) })),
      ...roofFills.map(fill => ({ depth: fill.depth, go: () => paintRoof(fill) })),
    ].sort((a, b) => a.depth - b.depth).forEach(item => item.go());

    // Floor assembly bands: each floor's rim (joists + sheathing) is part of
    // the house face — white like the walls, no banding line, keeping the
    // vertical edges of every visible face corner through the band.
    // IS THIS POINT BEHIND A ROOF? Lifted out of `hidden` so the rim-band
    // pass below can ask it too -- `hidden` itself cannot move, because its
    // OTHER half reads `rimBands`, which that pass is what builds.
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

    const spanOf = face => ({
      lo: Math.max(Math.min(face.u1, face.u2), uMin),
      hi: Math.min(Math.max(face.u1, face.u2), uMax),
      depth: face.depth,
      levelId: face.level.id,
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
    const uncovered = (lo, hi, depth) => {
      let parts = [{ lo, hi }];
      allSpans.filter(other => other.depth > depth + 1e-6).forEach(other => {
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
    // The rim bands are part of the opaque house face, so the roof pass reads
    // them alongside the walls: between one storey's plate and the next
    // storey's floor there is no wall face, and a roof behind the house at
    // exactly that height would otherwise show through the joist band.
    const rimBands = [];
    stack.floors.forEach(level => {
      const spans = houseSpans.filter(span => span.levelId === level.id);
      if (!spans.length) return;
      // Contiguous runs of face coverage — a level with two separate wings
      // wears two rim bands, not one across the gap between them.
      const runs = [];
      spans.slice().sort((a, b) => a.lo - b.lo).forEach(span => {
        const last = runs[runs.length - 1];
        if (last && span.lo <= last.hi + 0.5) last.hi = Math.max(last.hi, span.hi);
        else runs.push({ lo: span.lo, hi: span.hi });
      });
      const yTopPx = Y(level.floorTop) - 1, yBotPx = Y(level.floorBottom) + 1;
      ctx.fillStyle = C.face;
      // WHAT WAS ACTUALLY PAINTED, kept for the edge pass below. The run is
      // the house's own extent; the PARTS are what survived the clip against
      // whatever stands in front, and the two are different the moment a
      // garage laps the house.
      const paintedOf = new Map();
      runs.forEach(run => {
        if (run.hi - run.lo < 0.5) return;
        const depth = Math.max(...spans
          .filter(span => span.hi > run.lo && span.lo < run.hi)
          .map(span => span.depth));
        // ONLY WHERE NOTHING NEARER STANDS. The band is the house's floor
        // package seen flat, and a garage in front of it is a wall, not a
        // window. What is pushed to rimBands is what was PAINTED, so the roof
        // pass downstream reads the same surface the sheet shows.
        const parts = uncovered(run.lo, run.hi, depth);
        paintedOf.set(run, parts);
        parts.forEach(part => {
          ctx.fillRect(X(part.lo) - 1, yTopPx, (part.hi - part.lo) * pxPerFt + 2, yBotPx - yTopPx);
          rimBands.push({
            lo: part.lo, hi: part.hi,
            bottom: level.floorBottom, top: level.floorTop, depth,
          });
        });
      });
      // Vertical edges through the band: the run boundaries plus any face
      // corner inside a run that isn't hidden behind a nearer face — a jog
      // in the facade keeps its corner line crossing the floor.
      const edges = new Set();
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
        (paintedOf.get(run) || []).forEach(part => {
          [part.lo, part.hi].forEach(u => {
            if (!behindRoof(atUDepth(u, runDepth(spans, u)), midE)) edges.add(u);
          });
        });
        spans.forEach(span => [span.lo, span.hi].forEach(u => {
          if (u > run.lo + 0.05 && u < run.hi - 0.05
            && edgeVisible(u, span.depth, midE)) edges.add(u);
        }));
      });
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      ctx.beginPath();
      edges.forEach(u => { ctx.moveTo(X(u), yTopPx); ctx.lineTo(X(u), yBotPx); });
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
      extendRunsToEaves(runs.map(r => ({ ...r, top: r.base + ROOF_FASCIA_IN / 12 })),
        eaveSpans).forEach((grown, index) => {
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
      const closePen = () => {
        if (!pen) return;
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
        if (pen && pen.base !== s.base) closePen();
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
            const runs = [];
            let run = null;
            for (let s = 0; s <= samples; s++) {
              const t = s / samples;
              const pt = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
              const u = ua + (ub - ua) * t;
              const elev = ea + (eb - ea) * t;
              if (u < uMin - 0.01 || u > uMax + 0.01 || hidden(pt, elev, u)) { run = null; continue; }
              // NO LINE WHERE THE SHEET DOES NOT STOP. Probed just past the
              // edge, on this face's own plane, so the two sheets are
              // compared where they would meet rather than where either ends.
              //
              // AND TAKEN A HAIR INSIDE THE EDGE, which is not fussiness. An
              // edge's ENDPOINTS are corners, and at a corner the probe lands
              // exactly on the neighbouring roof's own boundary, where
              // inside-or-out is a coin toss. Measured on the tie's piece,
              // E4: its 3 ft edge against the house gets three stations, the
              // one at the shared corner read as "carried on", and a foot and
              // a half of a line that should be there went with it. Touching
              // at a corner is not being continued.
              const tp = Math.min(Math.max(t, 0.02), 0.98);
              const past = {
                x: a.x + (b.x - a.x) * tp + (outward ? outward.x * 0.05 : 0),
                z: a.z + (b.z - a.z) * tp + (outward ? outward.z * 0.05 : 0),
              };
              if (outward && carriedOn(roof, past,
                eaveTop + geo().roofFaceRise(face, past, pitch))) { run = null; continue; }
              if (!run) { run = { u0: u, e0: elev, u1: u, e1: elev }; runs.push(run); }
              else { run.u1 = u; run.e1 = elev; }
            }
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
            // A run of a single station paints nothing, and the corner it
            // stands on is not "shown" for the soffit return either — a rake
            // hidden behind the house all but its bottom point once hung its
            // soffit line off that one surviving station.
            const drawn = runs.filter(r =>
              Math.abs(r.u1 - r.u0) > 0.05 || Math.abs(r.e1 - r.e0) > 0.05);
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
                  ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
                  ctx.beginPath();
                  ctx.moveTo(X(sp.u0), Y(eaveTop - ROOF_FASCIA_IN / 12));
                  ctx.lineTo(X(sp.u1), Y(eaveTop - ROOF_FASCIA_IN / 12));
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

    // Grade, heavy, straight across the sheet — the exposed concrete stands
    // on it and everything below it reads dashed.
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginL - 18, Y(fdn.grade));
    ctx.lineTo(w - marginR, Y(fdn.grade));
    ctx.stroke();
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
    cutAxis,
    sectionLevelStack,
    extendRunsToEaves,
    sectionWallCrossings,
    cutViewExtents,
    roofBaseElev,
    roofEaveElev,
    garageBearing,
    garageConcreteTop,
    garageSlabTop,
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
