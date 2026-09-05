// The PROJECT page's typical wall-section detail (boards #158/#187) — a live
// annotated cut through the first ~4 ft of the exterior wall, drawn from the
// SAME per-drawing assembly values the sidebar level cards edit. Pure: plain
// values in, canvas ink + anchor points out. The anchors are where the page
// parks each editable number beside the piece of the detail it controls —
// this diagram IS the form. Zone-row metadata (board #221) lives here too so
// the page and future consumers agree on ids and labels.
if (!window.DraftProjectPage) {
(() => {
  // Zones are areas whose floors do not sit at MAIN FL 0. The garage rows
  // feed BUILD HOUSE's garage generation in a follow-up; the bilevel rows
  // are reserved until the split-level feature lands (#73) — stored and
  // editable now so the numbers are already there when it does.
  // WHAT EACH ROW'S NUMBER MEASURES, because it is not the same thing for all
  // of them and the panel described every one as a floor. Both garages hold a
  // BEARING LINE: the attached one its sill top (the section reads it as
  // sillOffsetFt), the detached one its grade beam top, 8" above grade. A
  // garage FLOOR is 5 1/2" under the attached one -- a sill plate and the
  // slab's drop below the concrete -- so calling the stored number a floor was
  // wrong by more than a word.
  //
  // The two reserved rows get no datum rather than a guessed one. Their split
  // feature has not landed, nothing reads them, and inventing "floor" here is
  // how the garage rows got their label in the first place.
  const ZONE_ROWS = Object.freeze([
    Object.freeze({ id: 'attachedGarage', label: 'ATTACHED GARAGE', reserved: false, datum: 'sill' }),
    Object.freeze({ id: 'detachedGarage', label: 'DETACHED GARAGE', reserved: false, datum: 'beam top' }),
    Object.freeze({ id: 'bilevel', label: 'BILEVEL', reserved: true, datum: null }),
    Object.freeze({ id: 'modifiedBilevel', label: 'MODIFIED BILEVEL', reserved: true, datum: null }),
  ]);

  // ── The section table ────────────────────────────────────────────────
  // A row per BUILD TYPE, a column per measured item. HOUSE is the drawing's
  // own live assembly; the rest carry only what they differ in and show only
  // the items their type uses — a garage has no floor joists or wood fill,
  // a bungalow no second floor.
  //
  // Wall heights are DERIVED FROM THE STUD, never typed: a wall is a stud
  // plus two top plates and one bottom plate, so the height that wastes no
  // lumber is a precut length plus 4½". Type the stud, read the wall.
  //
  // TWO ON TOP, AND THE REASON MATTERS. Movie, 5 Sep: "top plate needs 2 so
  // they can overlap for strength" -- the second plate laps the joints in the
  // first, tying the walls together at the corners and over the studs. It is
  // structure, not a stack of arbitrary thickness, so 3 is not a number to
  // round off. Anybody reading 1.5 * 3 and wondering why not two now has the
  // answer without having to ask a framer.
  const PLATE_STACK_IN = 1.5 * 3;
  const STUD_LENGTHS_IN = Object.freeze([92.625, 104.625, 116.625]);
  // Which precut a build type starts on. Movie, 4 Sep: "8'1-1/8" is default
  // wall height for bungalow, for bilevel we are going with 9'-1 1/8" ceiling
  // height / walls (both are about 50% common in both)".
  //
  // Nothing to add for it: 9'-1 1/8" is simply the NEXT PRECUT, 104 5/8" plus
  // the same three plates, and MAIN FL STUD already takes it and reads the
  // wall back. What is missing is only which one a type STARTS on, and that
  // needs a build type on the drawing -- NEW-5.
  //
  // And 50/50 is not a rule in either direction, so both stay typeable: a
  // bungalow with 9' walls and a bilevel with 8' walls are both ordinary.
  // A basement fill wall doesn't get to choose its height, so it takes the
  // offcut instead: an 8' precut sawn in two, rounded off the sixteenth.
  const HALF_STUD_IN = 46.25;
  const wallHeightFtFromStud = studIn => (studIn + PLATE_STACK_IN) / 12;
  const studInFromWallHeightFt = wallHeightFt => wallHeightFt * 12 - PLATE_STACK_IN;

  const SECTION_TABLE_ROWS = Object.freeze([
    Object.freeze({ id: 'house', label: 'HOUSE', live: true }),
    Object.freeze({ id: 'bilevel', label: 'BILEVEL', live: false }),
    Object.freeze({ id: 'modifiedBilevel', label: 'MOD BILEVEL', live: false }),
    Object.freeze({ id: 'attachedGarage', label: 'ATTACHED GARAGE', live: false }),
    Object.freeze({ id: 'detachedGarage', label: 'DETACHED GARAGE', live: false }),
  ]);

  const ALL_TYPES = SECTION_TABLE_ROWS.map(row => row.id);
  const HOUSE_LIKE = ['house', 'bilevel', 'modifiedBilevel'];
  // Movie, 4 Sep: a SPLIT is not a third build type, it is the family name
  // for the two -- a BILEVEL or a MODIFIED BILEVEL. Both pour the same 5'-0"
  // wall and make the rest of the basement height up in wood above it, so
  // WOOD FILL HT belongs to both and BILEVEL's cell was hatched by mistake.
  // What a MOD BILEVEL adds to a BILEVEL is the storey over the garage, not
  // the fill wall.
  //
  // AND THE FAMILY NAME IS NO LONGER A ROW, 5 Sep, Movie's option A. SPLIT
  // was a complete section-table row: visible, in HOUSE_LIKE, with a WOOD
  // FILL cell, its own default, and storable in drawing-format.js -- so a
  // drafter could type numbers into it that persisted and that nothing could
  // ever read. A drawing is ONE building, the build type picks the live row,
  // and no build type is SPLIT, precisely because of the sentence above it.
  // The family name stays as SPLIT_BASE, which is what it always was: the
  // defaults the two real rows start from.
  const SPLIT_TYPES = Object.freeze(['bilevel', 'modifiedBilevel']);
  const SILL_PLATE_IN = 1.5;
  const item = (id, label, unit, field, types, extra) =>
    Object.freeze({ id, label, unit, field, types: Object.freeze(types), ...extra });

  // unit: 'pitch' plain number | 'ftin' feet-and-inches | 'in' inches |
  // 'stud' inches typed, wall height read back underneath | 'derived' read-only.
  const SECTION_TABLE_ITEMS = Object.freeze([
    item('pitch', 'PITCH :12', 'pitch', 'roofPitch', ALL_TYPES),
    item('overhang', 'OVERHANG', 'ftin', 'roofOverhangFt', ALL_TYPES),
    // A CALCULATED NUMBER YOU CAN STILL TYPE OVER. Movie, 5 Sep: "we should
    // actually be able to change that -- is it possible to put in the
    // calculated number but allow them to change it". The default is the
    // fascia plus the rise across the overhang and it is right nearly always,
    // which is exactly why it must not be welded in: a raised heel is ordered
    // by the truss plant, not derived, and a derived-only cell makes that
    // drawing impossible to draw. Null here means DERIVE; a number is the
    // override.
    item('heel', 'ROOF HEEL', 'in', 'roofHeelIn', ALL_TYPES),
    item('upperStud', '2ND FL STUD', 'stud', 'upperWallHeightFt', ['house', 'modifiedBilevel']),
    item('upperJoists', '2ND FL JOISTS', 'in', 'upperJoistDepthIn', ['house', 'modifiedBilevel']),
    item('mainStud', 'MAIN FL STUD', 'stud', 'mainWallHeightFt', ALL_TYPES),
    // NO ENTRY FLOOR ROWS HERE, deliberately. They were added to this table
    // on 5 Sep and taken out the same evening once Movie settled that ENTRY
    // is a LEVEL rather than an area of the main one. Every other floor's
    // package lives in its LEVEL ASSEMBLY -- the numbers the level cards edit
    // -- so a pair of rows here would have been a second place to set one
    // fact, and the two would disagree the first time anybody used the card.
    item('mainJoists', 'MAIN FL JOISTS', 'in', 'mainJoistDepthIn', HOUSE_LIKE),
    item('mainSheathing', 'MAIN FL SHEATHING', 'in', 'mainSheathingIn', HOUSE_LIKE),
    item('fdnWall', 'FDN WALL HT', 'ftin', 'fdnWallHeightFt', ALL_TYPES),
    item('sill', 'SILL PLATE', 'derived', null, ALL_TYPES),
    item('woodFill', 'WOOD FILL HT', 'ftin', 'woodFillHeightFt', SPLIT_TYPES),
    item('slab', 'SLAB', 'in', 'slabThicknessIn', ALL_TYPES),
    item('basementClg', 'BSMT CLG HT', 'derived', null, HOUSE_LIKE),
    item('footingWidth', 'FTG WIDTH', 'in', 'footingWidthIn', ALL_TYPES),
    item('footingDepth', 'FTG DEPTH', 'in', 'footingDepthIn', ALL_TYPES),
  ]);

  // What a type is worth before anyone types anything. The SPLIT's 5'-0"
  // concrete wall with the 1½" sill on top is the office default — 5'-1½"
  // to the bearing surface, and the entry floor sits on that sill, so extra
  // basement height is made up with a 2x6 wood wall above the concrete
  // rather than a taller pour. A field absent here falls back to the
  // HOUSE's live value.
  //
  // AND THE SPLIT FRAMES A FOOT TALLER THAN THE BUNGALOW. Movie, 4 Sep:
  // "8'1-1/8" is default wall height for bungalow[;] for bilevel we are going
  // with 9-1 1/8" ceiling height / walls", and 5 Sep: "for default make the
  // main floor 9-1 1/8", 2nd fl over garage 9-1 1/8"". Without these the
  // split rows fell back to the HOUSE's live wall -- the bungalow's 8'-1 1/8"
  // -- and read as though somebody had chosen it. The absent default that
  // reads as a decision, the same shape as the garage's basement wall below.
  //
  // Written as THE PRECUT ONE STEP UP, not as 9.09375. It is a stock stud
  // (104 5/8" plus three plates), and naming it that way means the wall stays
  // a real order if the plate stack ever changes, instead of quietly becoming
  // a height nobody can buy.
  const SPLIT_WALL_FT = wallHeightFtFromStud(STUD_LENGTHS_IN[1]);
  const SPLIT_BASE = Object.freeze({
    fdnWallHeightFt: 5,
    woodFillHeightFt: (HALF_STUD_IN + PLATE_STACK_IN) / 12,
    mainWallHeightFt: SPLIT_WALL_FT,
    // The storey over the garage that makes a MOD BILEVEL a MOD BILEVEL. The
    // BILEVEL row has no cell for it, so this sits unused there rather than
    // wrongly -- one shared default, as the harness requires.
    upperWallHeightFt: SPLIT_WALL_FT,
  });
  // A GARAGE DOES NOT HAVE A BASEMENT WALL, and until now the table said it
  // did. Neither garage row carried a default, so both fell back to the
  // HOUSE's live value and the ATTACHED GARAGE read 8'-1 1/8" of foundation
  // -- a basement wall under a garage, shown grey as though it had been
  // inherited on purpose. Not blank, not an error: a plausible number from
  // the wrong parent, which is the kind that survives because nobody squints
  // at an inherited cell. The same shape as the bilevel's hatched wood fill.
  //
  // Movie, 4 Sep: "the garage section should have a grade beam with 32" conc
  // and 1.5" sill plate grade beam (33.5")", and "32" conc for garage grade
  // beam is DEFAULT - changeable". So it goes here, where a default is a
  // starting number the drafter types over, rather than into the drawing as
  // a constant no one can reach.
  //
  // 32" only. The 1 1/2" sill is NOT added in: SILL_PLATE_IN is what the
  // table's own TO SILL note adds to every row, so writing 33.5 here would
  // count the sill twice and read 2'-11" to bearing instead of 2'-9 1/2".
  const GARAGE_GRADE_BEAM_IN = 32;
  // A THICKENED EDGE IS 1'-0" DEEP, and this is a second copy of cut-view.js's
  // GARAGE_EDGE_DEPTH_IN. Declared here rather than beside the slab slope with
  // the other duplicate because SECTION_TABLE_DEFAULTS reads it, and a const
  // declared after its reader is a ReferenceError at load, not a lint nit.
  //
  // NOT SOLVED BY LOADING cut-view.js, which the slab-slope note proposes as the
  // tidy-up. Measured 5 Sep: cut-view reads window.DraftWallTypes,
  // window.DraftGeometry and window.DraftFormatters at module scope, and
  // PROJECT.html loads only the last of the three. "Load cut-view" is really
  // three more scripts on a page that never paints a cut view, to import two
  // numbers.
  //
  // SO THE COPY STAYS AND THE DRIFT IS WHAT GETS KILLED. The 32" near-collision
  // was not caused by there being two copies of a number; it was caused by
  // nobody noticing when they stopped agreeing. section-table-harness.js reads
  // cut-view.js and fails if a shared number here disagrees with it, which is
  // the property the tidy-up was wanted for. Revisit the script tags when
  // PROJECT.html needs cut-view for something it actually paints.
  const GARAGE_EDGE_DEPTH_IN = 12;
  // Which foundations each garage may be, in the order the drafter should see
  // them. Detached: all three. Attached: NOT thickened edge -- Movie, 4 Sep,
  // "it will move / the house foundation is solid and will cause cracking".
  // A floating slab fastened to something that does not float cracks at the
  // joint. drawing-format.js refuses to store it for an attached garage, so
  // this list is the drafter's view of a rule, not the rule itself.
  const GARAGE_FOUNDATIONS = Object.freeze({
    attachedGarage: Object.freeze(['gradebeam', 'frostwall']),
    detachedGarage: Object.freeze(['thickened', 'gradebeam', 'frostwall']),
  });
  const GARAGE_FOUNDATION_LABEL = Object.freeze({
    gradebeam: 'GRADE BEAM', frostwall: 'FROST WALL', thickened: 'THICKENED EDGE',
  });
  // WHAT THE HEAD OF AN OPENING COSTS, top of wall downward: two top plates,
  // the lintel, and the rough-opening plate under it. On the deep case that is
  // 3" + 11 7/8" + 1 1/2" = 1'-4 3/8", and Movie rounds it up an eighth and
  // uses it for EVERY opening rather than branching on span. 5 Sep: "we should
  // make the deep 1'-4 1/2" lintel default... will cause less problems", and
  // "let's go with least chance of people getting into a bind".
  //
  // A shallow opening really does take a 2-ply 2x10 in the field -- 9 1/4" plus
  // the same 4 1/2" is 1'-1 3/4" -- and reserving the deep stack anyway costs
  // 2 3/4" of cripples. That is not waste: it lands EVERY head in the building
  // at one elevation, which is what a drafter wants anyway, instead of a house
  // where the patio door head sits below the windows beside it.
  //
  // MIND THE 4 1/2". It is two TOP plates (3") plus the rough-opening plate
  // (1 1/2"), and it is NOT PLATE_STACK_IN, which is also 4 1/2" and is two top
  // plates plus a BOTTOM plate. Different members, same sum, sixty lines apart.
  // Anyone who reuses one for the other gets the right answer today and a wrong
  // one the moment either changes. See RD-DOCUMENTS/SPEC-lintels.md.
  const OPENING_HEAD_DROP_IN = 16.5;

  // A GARAGE WALL IS TALLER THAN THE HOUSE'S, and until now it WAS the house's.
  // Nothing set mainWallHeightFt for the attached garage, so it fell through to
  // HOUSE and the schedule read 8'-1 1/8". Movie, 5 Sep: "good thing the garage
  // is usually taller walls than the house."
  //
  // It is not a missing default, it is a WRONG one, and the arithmetic says so
  // rather than taste: a 7'-0" overhead door needs OPENING_HEAD_DROP_IN above
  // its head, so the wall has to reach 8'-4 1/2". The house precut is 8'-1 1/8".
  // The default garage could not be built as drawn.
  //
  // The next rung up the precut ladder is the answer -- 9'-1 1/8" leaves
  // 8 5/8" of cripples over a 7'-0" door -- and three unrelated things now
  // point at the same wall: this, the storey over the garage needing its deck
  // at 10'-5 5/8", and "lots of bungalows have extra space there".
  //
  // FOURTH GARAGE ROW TO INHERIT A HOUSE NUMBER, after the 3" slab, the
  // basement wall under a garage, and the 11 7/8" joists that should be 20".
  // They keep arriving because the fallback is silent: no default means HOUSE,
  // and HOUSE is always plausible.
  const GARAGE_WALL_FT = wallHeightFtFromStud(STUD_LENGTHS_IN[1]);

  const SECTION_TABLE_DEFAULTS = Object.freeze({
    bilevel: SPLIT_BASE,
    modifiedBilevel: SPLIT_BASE,
    // A GARAGE SLAB IS 4", not the house's 3". The row had no default at all,
    // so it inherited HOUSE and the schedule read 3" -- the same shape as the
    // basement wall a garage was inheriting before this default existed.
    // cut-view.js has said GARAGE_SLAB_THICKNESS_IN = 4 all along.
    attachedGarage: Object.freeze({
      fdnWallHeightFt: GARAGE_GRADE_BEAM_IN / 12,
      slabThicknessIn: 4,
      mainWallHeightFt: GARAGE_WALL_FT,
    }),
    // AND THE DETACHED ROW HAD THE SAME HOLE. The comment above describes the
    // attached garage's defect and #293 fixed that row alone; its neighbour was
    // left inheriting HOUSE, so DETACHED GARAGE has been reading a 3" slab, the
    // house's 9'-1 1/8" precut wall and the house's basement wall ever since.
    // Fixing the row you are looking at is not fixing the bug.
    //
    // THE DEFAULT IS A THICKENED EDGE, not a grade beam. Movie, 5 Sep: "the
    // detached garage will have default thickened edge slab". GARAGE_FOUNDATIONS
    // already said so -- 'thickened' is first in the detached list and the
    // comment there calls it "the order the drafter should see them" -- so the
    // fact was in the file and only the order carried it. The other two stay
    // options: "the detached garage should also have a grade beam or frost wall
    // foundation as options".
    //
    // FDN WALL HT IS THE EDGE DEPTH on this row, and that is the label doing its
    // job rather than a label stretched over something else: ON A MONOLITHIC
    // SLAB THE THICKENED EDGE IS THE FOUNDATION. Movie, 5 Sep. There is no
    // separate wall to be the height of because the edge is the thing carrying
    // the building. 1'-0" is the same 12" cut-view.js draws the taper against
    // (GARAGE_EDGE_DEPTH_IN) -- see that constant for why this file keeps its
    // own copy and how the two are held together.
    detachedGarage: Object.freeze({
      fdnWallHeightFt: GARAGE_EDGE_DEPTH_IN / 12,
      slabThicknessIn: 4,
      mainWallHeightFt: GARAGE_WALL_FT,
    }),
  });

  // The heel is the fascia plus the rise the roof gains across the overhang
  // — the same rule the detail draws it with.
  const roofHeelIn = (fasciaIn, overhangFt, pitch) => fasciaIn + overhangFt * pitch;

  // The detached garage's grade beam rides ~8" above grade at the house --
  // the derive rule the ZONE HEIGHTS panel applies until overridden.
  //
  // NAMED DETACHED, BECAUSE IT IS ONLY THE DETACHED RULE. It was
  // GARAGE_BEAM_ABOVE_GRADE_IN until 5 Sep, which is a general name over a
  // specific number -- and cut-view.js, one file away, has both facts spelt
  // out: "an attached beam tops out 1'-0" above it, a detached grade beam
  // 8"". So a reader wanting the ATTACHED rule found a plausibly-named
  // constant here holding the detached one, four inches wrong, and grep
  // agreed with them. Not a duplicate: a near-collision, which is worse,
  // because a duplicate that drifts looks wrong and this looks right. The
  // name now matches cut-view.js's DETACHED_BEAM_ABOVE_GRADE_IN exactly,
  // so the two read as the one fact they are.
  const DETACHED_BEAM_ABOVE_GRADE_IN = 14;
  // THE THICKENED EDGE CANNOT TAKE THE 1'-2", and it is the concrete's own
  // depth that stops it. Every other foundation here tops out 1'-2" above
  // grade. A thickened edge is GARAGE_EDGE_DEPTH_IN -- 1'-0" -- of concrete
  // TOTAL, so a top 1'-2" up would stand the whole edge above ground with 2"
  // of air under it.
  //
  // AND YET THE FLOOR DOES NOT MOVE, which is the point of 10" rather than a
  // smaller number. A grade beam tops out at grade + 1'-2" and its slab sits
  // GARAGE_SLAB_BELOW_CONCRETE_IN under that, so its floor is grade + 10". A
  // thickened edge IS its own top of concrete -- there is nothing above the
  // slab -- so 10" here puts the two floors at the SAME height. Switching a
  // detached garage between grade beam and thickened edge moves the
  // foundation and leaves the door, the apron and the driveway where they
  // were. Movie, 5 Sep: "a little higher sure better for drainage" -- and the
  // drainage is the reason he gave, the matching floor is what it buys.
  //
  // The cost is 2" of edge in the ground instead of 4". Acceptable on a
  // floating slab bearing on gravel; a garage that needs frost protection
  // takes the frost wall option, which is what that option is for.
  const DETACHED_SLAB_ABOVE_GRADE_IN = 10;
  // How far the garage sill sits below the house's. Movie, 4 Sep: "2 ft below
  // the house sill (house sill drops 2 ft to meet garage sill)". Measured
  // sill to sill, not floor to floor, so it holds when the floor package
  // changes.
  const GARAGE_SILL_BELOW_HOUSE_FT = 2;
  // THE HEEL'S BAND. Movie, 5 Sep: "the min heel is 3.5" in reality but lets
  // make ours 5.5" min", then "the max how about 30" max", then "actually the
  // max should be more". So the floor is an OFFICE rule, not a physical one --
  // the trusses will do 3 1/2" and the office will not draw it -- which is the
  // reason to name it rather than bury a 5.5 in a comparison: the day somebody
  // wants the real minimum they need to find it, and see that it was a choice.
  //
  // AND IT IS BUILDABLE AT ANY PITCH, WHICH IS NOT OBVIOUS. A 3 1/2" chord is
  // 3 1/2" measured SQUARE ACROSS ITSELF, so the vertical it makes grows with
  // the pitch: 3.69" at 4:12, 4.95" at 12:12, 6.90" at 24:12. Read that way
  // the physical floor would overtake this one around 14 1/2:12, and above
  // that a 5 1/2" heel would drive the chord through the top plate. It does
  // not, because the chord does not arrive uncut -- Movie, 5 Sep: "cut the
  // bottom off flat so the fascia will be 5.5"". The tail is cut to make that
  // face, so 5 1/2" is reachable on any roof and this floor is rightly a
  // constant rather than a function of pitch. The fascia matching it is the
  // same cut and not a coincidence; it is still not the rule, and a deeper
  // fascia does not move this number.
  //
  // THE CEILING IS A TYPO CATCH, NOT A DESIGN LIMIT. Movie, 5 Sep: "actually
  // the max should be more ... in case of large overhangs ... lets make it
  // 20ft max haha". The laugh is the point. THE HEEL IS NOT A FREE NUMBER --
  // it is what the roof has climbed by the time it reaches the wall, so a big
  // overhang on a steep pitch DERIVES a heel far past anything anyone would
  // type. The drawing allows 6' of overhang at 24:12, which calculates to
  // 12'-5 1/2" all on its own. A 4'-0" ceiling would have refused numbers the
  // app itself had just worked out -- the bound arguing with the arithmetic
  // behind it, which is the worst kind. 20' clears every derivable heel with
  // room to spare and still stops a fat-fingered 3000.
  //
  // THE TYPICAL HEEL IS THE CALCULATED ONE. Movie, 5 Sep, correcting exactly
  // this comment: "the typical is the calculated one where the fascia bottom
  // is equal to the top of the top plate". So the usual drawing does not type
  // a heel at all -- it takes fascia + rise, 13 1/2" at the office default,
  // and the box reads TYPICAL. Movie, 5 Sep: "there is a calculation to find
  // the heel ... to find the TYPICAL HEEL" -- the arithmetic is not a mode
  // the cell is in, it is how the typical heel is arrived at. Raising it at
  // all is the exception.
  //
  // THREE NUMBERS ON A SCALE OF HOW UNUSUAL, AND ONLY THE LAST ONE REFUSES
  // ANYTHING. 13 1/2" is what the arithmetic gives and what nearly every
  // drawing uses. 30" is already EXTREME -- Movie, 5 Sep: "30" not typical it
  // is extreme but less extreme than 20ft" -- the outer edge of what somebody
  // would really build, reached by choice and not often. 20' is past absurd,
  // and that is its whole job: a ceiling only earns its place by never
  // arguing with a real drawing, so it is set where no real drawing reaches.
  //
  // The confusion runs one way, which is why all three are written down: a
  // number describing what people actually do gets mistaken for a limit, the
  // ceiling is trimmed back to it, and the unusual drawing becomes impossible
  // to draw. Neither 13 1/2" nor 30" bounds anything here, and neither should.
  const ROOF_HEEL_MIN_IN = 5.5;
  const ROOF_HEEL_MAX_IN = 20 * 12;
  const roofHeelInBand = inches => Number.isFinite(inches)
    && inches >= ROOF_HEEL_MIN_IN && inches <= ROOF_HEEL_MAX_IN;

  // Movie, 4 Sep: "the grade line will always be min. 8" below the level of
  // top of concrete (where it meets sill plate)". Not a default -- a floor.
  // Grade higher than this puts soil against the sill plate and the framing
  // above it, which is a wood-to-earth detail nobody draws on purpose. The
  // office default sits at 1'-0", comfortably under it; this is the line the
  // drafter cannot type past.
  const GRADE_MIN_BELOW_CONCRETE_IN = 8;
  // WHERE IT IS ACTUALLY DRAWN, which is not the same as the minimum. Movie,
  // 4 Sep: "let's move our grade line down further than 8". If the house is
  // higher out of the ground it is easier to regrade afterwards if there is
  // space. If it's too low it can cause additional problems, so better
  // higher. Let's move it to 1'-2" grade to top of concrete so they have 6"
  // to slope around the perimeter."
  //
  // So the two numbers do different jobs and both are needed: 8" is the line
  // a drafter cannot type past, 1'-2" is where the drawing puts it, and the
  // 6" between them is the room the site crew has to fall away from the
  // building. Collapsing them to one number would either forbid a legal 8"
  // or draw a building with no slope to give.
  const GRADE_BELOW_CONCRETE_IN = 14;
  // The truss top chord, drawn as a member rather than as a line. Movie,
  // 4 Sep: draw the roof "with 2 x 3.5" separated lines to show the roof
  // chords". Measured off his own drawing to be sure: its two roof lines sit
  // 3.3pt apart vertically at slope -0.333, which is 3.13pt perpendicular =
  // 3.42" at that sheet's scale. A 2x4 chord.
  const ROOF_CHORD_IN = 3.5;
  // One face of a drilled pile, shown dotted because the pile is BEYOND the
  // cut -- at ~8 ft on centre the section almost never lands on one, so what
  // is drawn is where the nearest one would be, not one that is there. Movie,
  // 4 Sep: "a dotted line about 5 inches in from the garage section line
  // (which will represent one side of the pile)... extend down further than
  // the footing by about 8"".
  const PILE_FACE_FROM_CUT_IN = 5;
  const PILE_BELOW_LOWEST_IN = 8;
  // How far the pile's top end shows above the void form. Movie, 4 Sep: "the
  // dotted line should start above the 4" void form under the concrete grade
  // beam". It ran from the TOP of the beam's concrete before, the full depth
  // of the pour -- but a pile does not pass through the beam, the beam bears
  // ON it, so the line starting at the top drew a pile going up through
  // concrete it never reaches. Starting just above the void form shows the
  // pile arriving at the beam's underside, which is what it does.
  const PILE_TOP_ABOVE_VOID_IN = 4;
  // The attached garage's roof cavity. Movie, 4 Sep: "the roof cavity with
  // 3.5" top and bottom chords could also be shown with 4' space between
  // ceiling height and top of top chord", then "just flat section", "talking
  // about attached garage".
  //
  // THE ROOF IS NOT FLAT. Movie: "it is sloped but not the direction we are
  // cutting" -- the garage roof falls across this section rather than along
  // it, so the cut runs parallel to its ridge and every chord projects level.
  // Worth saying, because "drawn level" and "is level" are different claims
  // and only the first one is true here; someone reading this later should
  // not come away thinking a garage has a flat roof, or "fix" the drawing by
  // adding a pitch to it.
  //
  // It is also why the house and the garage draw the same members
  // differently on one sheet: the house is cut ACROSS its slope and gets the
  // sloping pair, the garage ALONG its slope and gets four level lines.
  const GARAGE_CAVITY_FT = 4;
  // The garage slab, from Movie, 4 Sep: "draw the 4" sloping slab in there,
  // 5" down from the top and then slope down to the cut line at 1/8" per ft",
  // then exactly: "4" down from top of CONCRETE, 5.5" down from top of GRADE
  // BEAM". Both readings are the same line -- the sill plate is 1 1/2" thick
  // -- and he gave both because "top of grade beam" is the phrase that has
  // been catching us all day.
  //
  // Measured from the CONCRETE here, because that is the face the slab is
  // actually poured against; the sill plate is above it and has nothing to do
  // with where a slab sits.
  const GARAGE_SLAB_BELOW_CONCRETE_IN = 4;
  // DUPLICATED, and saying so. MODEL.dc.html carries the same 1/8" as
  // GARAGE_SLAB_SLOPE_IN_PER_FT. It belongs in cut-view.js STANDARDS with the
  // beam and the sill -- but PROJECT.html does not load cut-view yet, which
  // is the deferred tidy-up. Until it does, this is a second copy of a number
  // that must agree with a first, which is exactly what happened to the 32".
  const GARAGE_SLAB_SLOPE_IN_PER_FT = 1 / 8;
  // HOW DEEP A GARAGE IS, and until 5 Sep nothing in the repo said. Movie:
  // "24ft deep garage typical". GARAGE_OVERHEAD_DOOR_FT is the door's WIDTH,
  // which is what made the absence easy to miss -- there was a garage
  // dimension in scope and it was the wrong one.
  //
  // THE SLOPE HAD NOTHING TO MULTIPLY. GARAGE_SLAB_SLOPE_IN_PER_FT has been
  // right above this line the whole time and no drawing could turn it into a
  // fall, because a rate needs a run. So a sloped slab was drawn at whatever
  // station its author happened to be thinking of, and nothing said which.
  const GARAGE_DEPTH_FT = 24;
  // 24 ft at 1/8"/ft = 3". The fall is COMPOSED, never written as 3", so it
  // follows if either number moves.
  const garageSlabFallIn = (depthFt = GARAGE_DEPTH_FT) => depthFt * GARAGE_SLAB_SLOPE_IN_PER_FT;
  // The edge depth this file also carries is declared up with the grade beam,
  // because SECTION_TABLE_DEFAULTS reads it -- see GARAGE_EDGE_DEPTH_IN there
  // for why the copy stays and what holds it to cut-view.js.

  // FOR BAND 2 ONLY, not built. Movie, 4 Sep: "put the EXT WALL HEIGHT on
  // each floor under 2ND FL WALL HEIGHT, MAIN FL WALL HEIGHT, and above
  // FOUNDATION WALL -- not on this version but on the BILEVEL versions."
  //
  // So the bilevel and modified bilevel sections carry an extra row per
  // level that the bungalow and 2 storey do not. Which fits what a bilevel
  // is: its floors are half a storey apart, so the height of the EXTERIOR
  // wall at a level is not the same as the floor-to-ceiling height the level
  // card already carries, and the two would be one number on any other type.
  //
  // Recorded here rather than added now because the row is per BUILD TYPE
  // and no drawing stores one yet -- NEW-5. Adding it to every section would
  // put a row on the bungalow that Movie explicitly said should not have it.

  // HOW THE FRAMING IS HELD DOWN TO THE FOUNDATION. Movie, 4 Sep. Two ways,
  // and they bear at the SAME height on purpose, so switching between them
  // moves nothing above the foundation:
  //
  //   'sill'   -- a 1 1/2" sill plate on top of the concrete, held by
  //               embedded anchor bolts every 4 ft. The bolts are the detail;
  //               the plate is just what they hold.
  //   'ladder' -- a PT SPF 2x6 "ladder": two 2x6 ON EDGE at the wall faces
  //               with 2x6 separators every 2 ft, 8" outside to outside, set
  //               into the top of the form and the concrete poured around it.
  //               Standing 1 1/2" proud, so 4" of its 5 1/2" is embedded.
  //
  // The 1 1/2" proud is a choice, not a constraint -- it could stand higher.
  // Movie keeps it at the sill plate's thickness so the two are
  // interchangeable and nothing downstream has to know which was used.
  // Movie, 4 Sep, on where this is heading: "in the future I will probably
  // split this into a simplified version for each -- bungalow with or without
  // garage, and bilevel and modified bilevel separate -- but this will be
  // excellent to start with, and maybe keep using and not change that much,
  // we will see." So one section that draws every case is the deliberate
  // starting point, not an accident of not having split it yet. If it does
  // split, the split is by BUILD TYPE, which is NEW-5 again.
  const FOUNDATION_ATTACHMENTS = Object.freeze(['sill', 'ladder']);
  // Short enough for a dropdown and for a label on the drawing. The full
  // material -- a PT SPF 2x6 ladder -- is in the comment above and in the
  // commit that added it; a picker does not need to carry the spec.
  const ATTACHMENT_LABEL = Object.freeze({
    sill: 'SILL PLATE', ladder: 'PT LADDER',
  });
  const LADDER_MEMBER_IN = 1.5;   // a 2x6 on edge, its thickness
  const LADDER_DEPTH_IN = 5.5;    // and its width, standing vertical
  const LADDER_WIDTH_IN = 8;      // outside to outside, the wall's own 8"
  const CUT_DEPTH_FT = 4; // "the first 4 ft of the exterior wall cut inward"
  // Movie, 4 Sep: the garage panel is the JUNCTION, not a garage -- it is cut
  // where the garage meets the house. His own drawing dimensions 4'-6" out
  // from the house wall face, so that is what the section shows.
  //
  // Measured off the PDF rather than guessed: the 4'-6" label carries a
  // HORIZONTAL dimension line from x=107.8 to x=157.0, and x=157 is the wall
  // face. At 1.0925 in/pt (taken from the 8'-1 1/8" wall drawn 88.9pt tall)
  // that run is 53.7" -- 4'-6". An earlier "2 ft of straight roof until the
  // cut" was about the ROOF, and 2 ft of roof sits inside a 4'-6" cut.
  //
  // One constant, so if 4'-6" turns out to show too much, every section moves
  // together and nothing has to be re-measured.
  const GARAGE_CUT_FT = 4.5;
  // spec-master.js already says it: "4" POLYSTYRENE VOID FORM UNDER, BETWEEN
  // PILES". The beam is cast on it and it crushes, so frost heave lifts the
  // soil and not the garage.
  const VOID_FORM_IN = 4;

  // Section geometry in world feet: x = 0 at the exterior wall face,
  // positive inward; y = elevation with the MAIN FL floor surface at 0.
  // Returns line/rect parts plus one anchor per annotated value.
  // Draws whichever hold-down was chosen, in the 1 1/2" band above the
  // concrete. Shared by the house and the garage so the two can never drift
  // into drawing the same detail differently.
  const attachment = (rect, line, kind, x, concTop, wallFt) => {
    const proudFt = SILL_PLATE_IN / 12;
    if (kind !== 'ladder') { rect(x, concTop, wallFt, proudFt, 1.5); return; }
    // Two members on edge at the wall faces, most of them below the pour.
    const memberFt = LADDER_MEMBER_IN / 12, deepFt = LADDER_DEPTH_IN / 12;
    const topFt = concTop + proudFt;
    [x, x + wallFt - memberFt].forEach(mx =>
      rect(mx, topFt - deepFt, memberFt, deepFt, 1.5));
    // The separator behind the cut, and the wood the pour stops against.
    line(x + memberFt, concTop, x + wallFt - memberFt, concTop, 0.75);
    line(x, topFt, x + wallFt, topFt, 1.5);
  };

  const buildWallSection = values => {
    const floors = values.floors; // bottom-up: [{id, name, wallHeightFt, joistDepthIn, sheathingIn}]
    const fdn = values.foundation; // {wallHeightFt, thicknessIn, slabIn, footingWidthIn, footingDepthIn}
    const roof = values.roof;      // {pitch, overhangFt, fasciaIn}
    const wallIn = values.wallThicknessIn;
    const wallFt = wallIn / 12;
    const fdnFt = fdn.thicknessIn / 12;
    const parts = [];
    const anchors = {};
    const line = (x1, y1, x2, y2, weight = 1.5) => parts.push({ kind: 'line', x1, y1, x2, y2, weight });
    const rect = (x, y, w, h, weight = 1.5) => parts.push({ kind: 'rect', x, y, w, h, weight });

    // Climb the floor stack. Each level's band is ITS OWN floor assembly
    // (the same numbers the level card's FL JST box edits), the wall above
    // it that level's wall height.
    // WHICH FLOOR IS THE DATUM. Movie has been firm that 0.0 / 100.0 is the
    // top of MAIN FL sheathing on every drawing, and until now that could be
    // assumed to be floors[0] because nothing framed below the main floor.
    // A bilevel does: its ENTRY floor is a storey in the stack, below main.
    // So the stack still climbs bottom-up, but the datum is named rather than
    // assumed -- floors[datumIndex] is what sits at 0, and everything below
    // it comes out negative, which is where a bilevel's entry floor belongs.
    const datumIndex = values.datumIndex ?? 0;
    const below = floors.slice(0, datumIndex).reduce((sum, level) =>
      sum + level.wallHeightFt + (level.joistDepthIn + level.sheathingIn) / 12, 0);
    let y = -below;
    const mainDepthFt = (floors[datumIndex].joistDepthIn + floors[datumIndex].sheathingIn) / 12;
    floors.forEach((level, index) => {
      const depthFt = (level.joistDepthIn + level.sheathingIn) / 12;
      rect(0, y - depthFt, CUT_DEPTH_FT, depthFt, 1);           // floor band
      line(0, y, CUT_DEPTH_FT, y, 1.5);                          // sheathing top
      anchors[`floor-${level.id}`] = { x: CUT_DEPTH_FT * 0.62, y: y - depthFt / 2 };
      line(0, y, 0, y + level.wallHeightFt, 2);                  // exterior face
      line(wallFt, y, wallFt, y + level.wallHeightFt, 1.5);      // interior face
      anchors[`wallHeight-${level.id}`] = { x: wallFt + 0.9, y: y + level.wallHeightFt / 2 };
      if (index === 0) anchors.wallType = { x: -0.35, y: y + level.wallHeightFt * 0.24 };
      y += level.wallHeightFt + ((floors[index + 1])
        ? (floors[index + 1].joistDepthIn + floors[index + 1].sheathingIn) / 12 : 0);
    });
    const plateY = y;

    // Roof: fascia bottom rides level with the top plate at the overhang's
    // end; the surface climbs inward at pitch:12, so the heel at the wall
    // face is fascia depth plus the rise gained across the overhang — the
    // same rule the roof tool documents.
    const fasciaFt = roof.fasciaIn / 12;
    // A RAISED HEEL LIFTS THE ROOF; IT DOES NOT FATTEN THE FASCIA. By default
    // the fascia's bottom is level with the top of the top plate (Movie,
    // 5 Sep) and the heel comes out at fascia + rise. Type a bigger heel and
    // the whole roof -- chords, fascia, soffit -- rises by the difference,
    // which is what a raised-heel truss actually does: the soffit line goes
    // up and the extra room over the plate is what the insulation goes in.
    // A RIGID LIFT. Movie, 5 Sep: "when heel is raised or lowered the fascia
    // will raise or lower and peak at the same up down rate" -- one
    // translation applied to the whole roof, so nothing about its shape
    // changes. The ceiling does not come with it: it is set by the wall
    // height, so the attic gains exactly the lift.
    // The fascia stays a 2x6, because it is a board.
    const heelLiftFt = roof.heelIn == null ? 0
      : (roof.heelIn - roofHeelIn(roof.fasciaIn, roof.overhangFt, roof.pitch)) / 12;
    const eaveY = plateY + heelLiftFt;
    // WHAT THE LIFT COSTS, DRAWN. Movie, 5 Sep: "the fascia will lift up and
    // down they will need extra or less sheathing on the wall". The exterior
    // face stops at the top plate, so a raised heel opened a gap between the
    // plate and the soffit with nothing in it -- the section showed the roof
    // higher and said nothing about the wall that now has to reach it. Same
    // weight as the face below it, because it is the same face.
    if (heelLiftFt > 0) line(0, plateY, 0, eaveY, 2);
    const riseAt = x => heelLiftFt + fasciaFt + (roof.overhangFt + x) * (roof.pitch / 12);
    rect(-roof.overhangFt - 0.1, eaveY, 0.1, fasciaFt, 1.5);    // fascia board
    line(-roof.overhangFt, eaveY, 0, eaveY, 1);                 // soffit
    // TWO LINES, NOT ONE. The offset is PERPENDICULAR to the slope -- a chord
    // is 3 1/2" thick measured across itself, not measured vertically -- so
    // the vertical drop between the two lines grows with the pitch. At 4:12
    // that is 3.55" of vertical for 3 1/2" of chord; at 12:12 it would be
    // 4.95". Dropping both lines by a flat 3 1/2" would draw a chord that
    // gets thinner as the roof gets steeper.
    const chordDropFt = (ROOF_CHORD_IN / 12)
      * Math.hypot(1, roof.pitch / 12);
    line(-roof.overhangFt, eaveY + fasciaFt, CUT_DEPTH_FT, plateY + riseAt(CUT_DEPTH_FT), 2);
    // ONE UNBROKEN UNDERSIDE, out to the eave. Movie: "the top chord extends
    // to the eave". It had been drawn in two pieces with a gap at the wall,
    // which is what the top PLATE does to a rafter -- but this is a truss:
    // the top chord passes over the wall in one piece and the heel web below
    // it carries the load down. Breaking it drew a rafter's detail on a
    // truss.
    line(-roof.overhangFt, eaveY + fasciaFt - chordDropFt,
      CUT_DEPTH_FT, plateY + riseAt(CUT_DEPTH_FT) - chordDropFt, 1);
    anchors.pitch = { x: CUT_DEPTH_FT * 0.45, y: plateY + riseAt(CUT_DEPTH_FT * 0.45) + 0.55 };
    anchors.overhang = { x: -roof.overhangFt / 2, y: eaveY - 0.55 };
    anchors.fascia = { x: -roof.overhangFt - 0.55, y: eaveY + fasciaFt / 2 };
    // Movie, 4 Sep: the heel reads UNDER the overhang and OVER the 2nd floor
    // wall. Since a label now keeps only its height, the heel sitting at its
    // own mid-height put it above the fascia and overhang -- above the things
    // it is measured from. Dropped below the plate, it falls into the order
    // the eye works down: pitch, fascia, overhang, heel, then the wall.
    // Labels keep only their height, so their order down the page IS the
    // reading order -- and it has to match the schedule beside it. Movie
    // wants PITCH / HEEL / FASCIA / OVERHANG, so the heel sits between the
    // pitch above it and the fascia below.
    anchors.heel = { x: 0.45, y: eaveY + fasciaFt / 2 + 0.8 };

    // The ceiling, and the truss over it. Movie, 4 Sep: first "you can add a
    // roof area, just some separation line that says attic space maybe", then
    // "the roof cavity with 3.5" top and bottom chords". Without the ceiling
    // line the roof read as sitting straight on the wall with no room
    // between; without the bottom chord the ceiling read as a line rather
    // than as the member the drywall hangs off.
    //
    // The chord's UNDERSIDE is the ceiling plane -- that is the face the
    // finish attaches to -- so the member sits above it, not straddling it.
    line(0, plateY, CUT_DEPTH_FT, plateY, 1);
    line(0, plateY + ROOF_CHORD_IN / 12, CUT_DEPTH_FT, plateY + ROOF_CHORD_IN / 12, 1);
    // BETWEEN THE PITCH AND THE HEEL, by construction. Movie, 4 Sep: "put
    // attic space under pitch over heel". Placed as the midpoint of the two
    // rather than at a height of its own, so it stays between them at any
    // pitch -- a fixed number would be right at 4:12 and drift out of order
    // the moment the roof got steeper, which is exactly how the label order
    // went wrong the first time.
    anchors.attic = {
      x: CUT_DEPTH_FT * 0.55,
      y: (anchors.pitch.y + anchors.heel.y) / 2,
    };
    // THE HEEL WEB. A 2x4 standing at the wall with its outer face flush
    // with the outside, so what shows in section is its INNER face, 3 1/2"
    // in, running from the bottom chord up to the underside of the top
    // chord. It replaces a line drawn on the wall face itself that ran the
    // full height of the heel -- which drew the outside of the building, not
    // a member.
    line(ROOF_CHORD_IN / 12, plateY + ROOF_CHORD_IN / 12,
      ROOF_CHORD_IN / 12, plateY + riseAt(ROOF_CHORD_IN / 12) - chordDropFt, 1);

    // Foundation: wall top carries the main floor, footing centered under
    // it, slab pouring against the wall at the footing.
    // The house gets the band it has always been missing: the concrete stopped
    // at the bearing line and the plate was drawn nowhere, exactly as the
    // garage's was until Movie asked where it had gone.
    // THE SPLIT'S WOOD FILL WALL, and it is why this is one builder and not
    // two. A bilevel is not a different section: it is this section with a
    // SHORTER POUR and a stud wall making up the rest (Movie, 5 Sep: "a
    // couple extra pieces added on and moved a bit, shorter foundation").
    // 5'-0" of concrete plus 4'-2 3/4" of wall gets to the same bearing line
    // the bungalow reaches with 8'-1 1/8" of pour.
    //
    // Null, not zero, for a type that has no fill wall -- the same
    // null-means-derive discipline the rest of the page keeps. A 0 here would
    // draw a zero-height rect and a plate on top of nothing.
    const fillFt = fdn.woodFillHeightFt ?? null;
    const fdnTop = -mainDepthFt;
    const attachFt = SILL_PLATE_IN / 12;
    // The bearing line does not move: the floor still lands one attachment
    // below MAIN FL. What changes is how far down the CONCRETE starts, since
    // the fill wall now occupies the top of that distance.
    const concTopFt = fdnTop - attachFt - (fillFt || 0);
    const fdnBot = concTopFt - fdn.wallHeightFt;
    rect(0, fdnBot, fdnFt, concTopFt - fdnBot, 2);
    attachment(rect, line, fdn.attachment, 0, concTopFt, fdnFt);
    // The fill wall stands on the attachment, its own faces at the wall's
    // thickness rather than the concrete's -- it is framing, not pour.
    if (fillFt) {
      const fillBot = concTopFt + attachFt;
      line(0, fillBot, 0, fillBot + fillFt, 2);
      line(wallFt, fillBot, wallFt, fillBot + fillFt, 1.5);
      anchors.woodFill = { x: wallFt + 0.9, y: fillBot + fillFt / 2 };
    }
    anchors.attachment = { x: fdnFt / 2, y: concTopFt + attachFt / 2 };
    anchors.fdnHeight = { x: fdnFt + 0.9, y: fdnTop - fdn.wallHeightFt / 2 };
    // BELOW the sill, not above it. Labels keep only their height now, so
    // three of them -- the floor joists, the attachment, and this -- were
    // landing within a few inches of each other and reading as one string.
    // The foundation's thickness is as true half a foot down the wall as it
    // is at the top, and down there it has the space to itself.
    anchors.fdnThickness = { x: fdnFt / 2, y: concTopFt - 0.55 };
    const footW = fdn.footingWidthIn / 12, footD = fdn.footingDepthIn / 12;
    rect(fdnFt / 2 - footW / 2, fdnBot - footD, footW, footD, 1.5);
    anchors.footingWidth = { x: fdnFt / 2, y: fdnBot - footD - 0.5 };
    anchors.footingDepth = { x: fdnFt / 2 + footW / 2 + 0.85, y: fdnBot - footD / 2 };
    const slabFt = fdn.slabIn / 12;
    rect(fdnFt, fdnBot, CUT_DEPTH_FT - fdnFt, slabFt, 1);
    anchors.slab = { x: CUT_DEPTH_FT * 0.62, y: fdnBot + slabFt + 0.5 };

    // GRADE RUNS THE WHOLE WIDTH, DOTTED. Movie, 4 Sep: "for the grade line
    // just show a dotted line where the grade height is across the full width
    // of the section". It was a short solid line with soil ticks on the
    // exterior side only, which stopped at the wall face -- so with a garage
    // drawn on the other side of that face, grade appeared to stop existing
    // where the building started.
    //
    // A `grade` part carries only its elevation; the painter draws it across
    // whatever the drawing turns out to be wide, so it spans the garage and
    // the house without either builder knowing about the other.
    const gradeY = fdnTop + fdn.gradeOffsetFt;
    parts.push({ kind: 'grade', y: gradeY });
    anchors.grade = { x: -roof.overhangFt - 0.6, y: gradeY - 0.55 };

    // The cut's break edge: everything stops at 4 ft with a jog.
    const topY = plateY + riseAt(CUT_DEPTH_FT);
    parts.push({ kind: 'break', x: CUT_DEPTH_FT, y1: fdnBot - footD - 0.3, y2: topY + 0.3 });

    return {
      parts,
      anchors,
      extents: {
        minX: -roof.overhangFt - 1.3,
        maxX: CUT_DEPTH_FT + 1.6,
        minY: fdnBot - footD - 1.1,
        maxY: topY + 1.1,
      },
    };
  };

  // ── The attached garage, quasi-attached ─────────────────────────────────
  //
  // Movie, 4 Sep: "'quasi attached' only because it will move up and down as
  // the user enters new heights for it". So the garage is joined to the house
  // HORIZONTALLY and free VERTICALLY: x = 0 is the shared wall face for both
  // drawings, and y stays the house's datum -- MAIN FL floor surface at 0 --
  // with the garage riding at whatever ZONE HEIGHTS says its offset is.
  // Type a new offset and the whole garage slides against a house that has not
  // moved, which is the relationship the zone panel's number could not show as
  // a number.
  //
  // Only CUT_DEPTH_FT of it, measured from the house wall outward, which is
  // the same 4 ft the house section is cut at -- one constant, so the two
  // drawings can never disagree about how much of a building a section shows.
  //
  // X RUNS NEGATIVE HERE, into the garage. The house's own x runs positive
  // inward from the same face, so the two share an origin and read outward in
  // opposite directions without either needing to be mirrored at paint time.
  // A mirrored painter would flip the break line's jog and the footing's
  // taper the wrong way round, which looks like a drafting error rather than
  // a transform.
  // ─── THE DETACHED GARAGE ──────────────────────────────────────────────────
  // A BUILDING OF ITS OWN, which is why this is not a flag on
  // buildGarageSection. That one is structurally attached: the house wall IS
  // its wall at the cut, its x runs negative from the shared face, it draws no
  // grade because the garage stands over that ground, and every height hangs
  // off g.sillOffsetFt on the HOUSE's datum. A detached garage has no house to
  // measure from and needs all four the other way -- its own wall, its own
  // grade line, its own roof, and a datum of its own.
  //
  // THE DATUM IS THE TOP OF SLAB, y = 0. A standalone slab-on-grade is set out
  // from its floor; there is no main floor to be 0.0 and no sill to hang off.
  // Grade sits DETACHED_SLAB_ABOVE_GRADE_IN below it.
  //
  // X RUNS POSITIVE INWARD from the exterior face, matching the house section
  // rather than buildGarageSection's negative run -- there is no second
  // drawing beside this one for it to read outward from.
  // ─── THE THREE FOUNDATIONS, SIDE BY SIDE ──────────────────────────────────
  // The section above draws the BUILDING and the foundation comes out about
  // 25px tall at the bottom of it -- which is honest at that scale and useless
  // for the one thing this band exists to show. A 45 degree taper and a 4"
  // field against a 1'-0" edge are simply not visible in a drawing that also
  // has to hold a 9'-1 1/8" wall and a roof.
  //
  // So the three get their own strip, at their own scale, side by side. Movie
  // asked for "the 3 way split"; the section screenshot is the argument for it.
  //
  // ONE SHARED SCALE, WHICH IS THE ENTIRE POINT. paintSections computes a
  // single view across every section handed to it, so three details at x
  // offsets are drawn to one scale without asking. Giving each its own would
  // make them compact and readable and destroy the comparison, which is the
  // only reason to put them in a row.
  //
  // THE DATUM IS THE GARAGE FLOOR on all three, y = 0, and that is what makes
  // the row legible: the three slabs line up across the strip and the concrete
  // under them is the only thing that changes.
  //
  // AND THAT IS TRUE AT ONE STATION ONLY -- THE BACK. This comment used to say
  // "the floor does not move between foundations" flat out, and Movie caught it
  // by eye on the first render: "the slab looks like it should be further down,
  // is this at the back of the garage". It is.
  //
  // A grade beam and a frost wall take a slab sloping to the door; a thickened
  // edge is LEVEL. So the three share a floor height where the sloped ones meet
  // their concrete -- the back -- and diverge from there. At the door they are
  // garageSlabFallIn() lower, which on a 24 ft garage is 3". The strip is cut
  // at the back and says so on the page; drawing the fall inside a detail would
  // be dishonest precision, since over DETAIL_RUN_FT of run it comes to 0.4".
  //
  // Grade is DETACHED_SLAB_ABOVE_GRADE_IN below the datum in all three, and
  // that part IS unconditional.
  // Tuned against the drawing, not guessed: at pitch 7 / wall 1.4 the row fits
  // by HEIGHT and left ~200px of the canvas unused, so every detail came out
  // small enough that the taper -- the thing the row exists to show -- was
  // back to being a squiggle. Tightening the y span is what grows the scale.
  const DETAIL_PITCH_FT = 6;          // centre-to-centre spacing in the row
  const DETAIL_WALL_FT = 0.75;        // how much wall each detail carries
  const DETAIL_RUN_FT = 2.6;          // how far into the building each runs
  const DETAIL_FROST_BREAK_FT = -2.3; // where a frost wall runs off, not ends
  const DETAIL_CAPTION_FT = -2.75;    // one baseline under the deepest detail
  const buildDetachedFoundationDetail = ({ kind, slabIn, index = 0 }) => {
    const parts = [];
    const anchors = {};
    const x0 = index * DETAIL_PITCH_FT;
    const line = (x1, y1, x2, y2, weight = 1.5) =>
      parts.push({ kind: 'line', x1: x0 + x1, y1, x2: x0 + x2, y2, weight });

    const slabFt = slabIn / 12;
    const gradeY = -DETACHED_SLAB_ABOVE_GRADE_IN / 12;
    const run = DETAIL_RUN_FT;

    // Common to all three: the floor line, the slab underside, and grade
    // outside. Drawn first so they read as the shared datums they are.
    line(0, 0, run, 0, 2);
    line(-1.1, gradeY, 0, gradeY, 2);
    anchors[`grade${index}`] = { x: x0 - 0.75, y: gradeY - 0.28 };
    anchors[`floor${index}`] = { x: x0 + run * 0.6, y: 0.3 };

    if (kind === 'thickened') {
      // ONE POUR. The slab IS the foundation, so there is no joint anywhere in
      // this outline -- 4" in the field, deepening to 1'-0" at the perimeter,
      // the two joined at 45 degrees. The taper's run equals its drop because
      // that is what 45 degrees means; it is computed, not written as 8".
      const edgeFt = GARAGE_EDGE_DEPTH_IN / 12;
      const taper = edgeFt - slabFt;
      line(0, 0, 0, -edgeFt, 2);
      line(0, -edgeFt, edgeFt, -edgeFt, 2);
      line(edgeFt, -edgeFt, edgeFt + taper, -slabFt, 1.5);
      line(edgeFt + taper, -slabFt, run, -slabFt, 1.5);
      anchors[`edge${index}`] = { x: x0 + edgeFt * 0.5, y: -edgeFt * 0.55 };
    } else {
      // GRADE BEAM AND FROST WALL both stand their concrete PROUD of the slab:
      // the top of concrete is 1'-2" above grade and the slab sits
      // GARAGE_SLAB_BELOW_CONCRETE_IN under that, which is why the floor lands
      // at grade + 10" and matches the thickened edge. The slab is poured
      // INSIDE them, so the concrete shows above the floor.
      const concTop = gradeY + GRADE_BELOW_CONCRETE_IN / 12;
      const widthFt = (kind === 'frostwall' ? 8 : 12) / 12;
      const bottom = kind === 'frostwall'
        ? DETAIL_FROST_BREAK_FT                   // broken, not ended -- see below
        : concTop - GARAGE_GRADE_BEAM_IN / 12;
      line(0, concTop, widthFt, concTop, 2);
      line(0, concTop, 0, bottom, 2);
      line(widthFt, concTop, widthFt, bottom, 2);
      if (kind === 'gradebeam') line(0, bottom, widthFt, bottom, 2);
      // THE SLAB BEARS ON FILL, not on the concrete: the beam is a PERIMETER
      // member with gravel inside it. Drawn as the slab running to the face of
      // the concrete and stopping there.
      line(widthFt, -slabFt, run, -slabFt, 1.5);
      line(widthFt, 0, widthFt, -slabFt, 1);
      anchors[`conc${index}`] = { x: x0 + widthFt * 0.5, y: (concTop + Math.max(bottom, -2.4)) / 2 };
      // A FROST WALL HAS NO BOTTOM IN THIS DRAWING, which is the convention
      // this file already uses for the pile: "a pile is drilled to depth per
      // the soils report, so a drawn end would be a number nobody has." A
      // frost wall is the same -- it runs to the HOUSE's footing depth, which
      // varies per drawing and is several times the beam beside it. Drawing it
      // to length would fill the strip with empty concrete and shrink the
      // taper this row exists to show.
      //
      // The first attempt used a 'break' part. That kind draws a full-height
      // break line down a section, not a small symbol at the end of a member,
      // so at 4" long it rendered as an arrowhead. Two lines running off the
      // bottom say "continues" without inventing a glyph.
    }
    // WHERE THE NAME GOES, and it is not "near the floor". The first version
    // hung each caption off the floor anchor and they landed squarely on the
    // slab and grade lines -- legible in the DOM, unreadable on the drawing.
    // A caption belongs under everything its detail draws, so the anchor is
    // computed from the parts rather than from a datum that happens to be
    // handy.
    // ON ONE BASELINE, not each under its own detail. Hanging every caption
    // off its own lowest point put THICKENED EDGE most of a foot above the
    // other two, because a 1'-0" edge is shallower than a 32" beam -- three
    // captions at three heights read as three drawings that happen to be near
    // each other rather than as a row to compare. DETAIL_CAPTION_FT is below
    // the deepest of the three, so the row shares a line the way a sheet does.
    anchors[`caption${index}`] = { x: x0 + DETAIL_RUN_FT * 0.25, y: DETAIL_CAPTION_FT };
    return { parts, anchors };
  };

  // The row, built in the order GARAGE_FOUNDATIONS lists them -- which is the
  // order the drafter should see them, with the default first.
  const buildDetachedFoundationRow = (slabIn = 4) =>
    GARAGE_FOUNDATIONS.detachedGarage.map((kind, index) => {
      const detail = buildDetachedFoundationDetail({ kind, slabIn, index });
      const xs = detail.parts.flatMap(part =>
        part.kind === 'break' ? [part.x] : [part.x1, part.x2]);
      const ys = detail.parts.flatMap(part =>
        part.kind === 'break' ? [part.y1, part.y2] : [part.y1, part.y2]);
      return {
        ...detail,
        kind,
        extents: {
          minX: Math.min(...xs) - 0.5, maxX: Math.max(...xs) + 0.5,
          minY: Math.min(...ys) - 0.85, maxY: Math.max(...ys) + DETAIL_WALL_FT,
        },
      };
    });

  const buildDetachedGarageSection = values => {
    const g = values.garage;
    const roof = values.roof;
    const parts = [];
    const anchors = {};
    const line = (x1, y1, x2, y2, weight = 1.5) => parts.push({ kind: 'line', x1, y1, x2, y2, weight });
    const rect = (x, y, w, h, weight = 1.5) => parts.push({ kind: 'rect', x, y, w, h, weight });

    const wallFt = values.wallThicknessIn / 12;
    const slabFt = g.slabIn / 12;
    const edgeFt = GARAGE_EDGE_DEPTH_IN / 12;
    const gradeY = -DETACHED_SLAB_ABOVE_GRADE_IN / 12;

    // THE THICKENED EDGE, and it is the foundation -- there is no wall under
    // this building. One monolithic pour: a 4" field slab that deepens to
    // 1'-0" at the perimeter, the two joined by a 45 degree taper. At 45 the
    // taper's run equals its drop, so it is (edge - field) long in plan and
    // needs no angle of its own.
    const fieldBot = -slabFt;
    const edgeBot = -edgeFt;
    const taperRun = edgeFt - slabFt;
    line(0, 0, CUT_DEPTH_FT, 0, 2);                       // slab top, LEVEL
    line(0, 0, 0, edgeBot, 2);                            // outer face of the edge
    line(0, edgeBot, edgeFt, edgeBot, 2);                 // underside of the edge
    line(edgeFt, edgeBot, edgeFt + taperRun, fieldBot, 1.5);  // the 45 taper
    line(edgeFt + taperRun, fieldBot, CUT_DEPTH_FT, fieldBot, 1.5); // field underside
    anchors.edgeDepth = { x: edgeFt * 0.45, y: (edgeBot + 0) / 2 };
    anchors.slabThickness = { x: CUT_DEPTH_FT * 0.78, y: fieldBot / 2 };
    anchors.slabAboveGrade = { x: -0.9, y: gradeY / 2 };

    // GRADE, on the outside only. It stops at the building face for the same
    // reason buildGarageSection draws none at all: soil ticks carried under a
    // slab would draw earth inside a building.
    line(-1.6, gradeY, 0, gradeY, 2);
    anchors.grade = { x: -1.15, y: gradeY - 0.3 };

    // THE WALL. Its own, unlike the attached garage's.
    const plateStackFt = PLATE_STACK_IN / 12;
    const plateY = g.wallHeightFt;
    rect(0, 0, wallFt, plateY, 1.5);
    line(0, plateY - plateStackFt, wallFt, plateY - plateStackFt, 1);  // under the plates
    anchors.wallHeight = { x: wallFt + 0.55, y: plateY / 2 };
    anchors.plates = { x: wallFt + 0.55, y: plateY - plateStackFt / 2 };

    // THE OVERHEAD DOOR HEAD, dropped OPENING_HEAD_DROP_IN off the top of the
    // wall -- two top plates, the lintel and the rough-opening plate. Drawn as
    // the line a drafter dimensions to, not as the lintel itself: which member
    // sits there is SPEC-lintels.md's business and depends on the span.
    const headY = plateY - OPENING_HEAD_DROP_IN / 12;
    parts.push({ kind: 'dashed', x1: 0, y1: headY, x2: wallFt + 1.2, y2: headY });
    anchors.doorHead = { x: wallFt + 1.5, y: headY };

    // THE ROOF, by the same rules as the house: the heel is fascia plus the
    // rise gained across the overhang, and a typed heel lifts the whole roof
    // rigidly rather than fattening the fascia.
    const fasciaFt = roof.fasciaIn / 12;
    const heelLiftFt = roof.heelIn == null ? 0
      : (roof.heelIn - roofHeelIn(roof.fasciaIn, roof.overhangFt, roof.pitch)) / 12;
    const eaveY = plateY + heelLiftFt;
    if (heelLiftFt > 0) line(0, plateY, 0, eaveY, 2);
    const riseAt = x => heelLiftFt + fasciaFt + (roof.overhangFt + x) * (roof.pitch / 12);
    rect(-roof.overhangFt - 0.1, eaveY, 0.1, fasciaFt, 1.5);
    line(-roof.overhangFt, eaveY, 0, eaveY, 1);
    const chordDropFt = (ROOF_CHORD_IN / 12) * Math.hypot(1, roof.pitch / 12);
    line(-roof.overhangFt, eaveY + fasciaFt, CUT_DEPTH_FT, plateY + riseAt(CUT_DEPTH_FT), 2);
    line(-roof.overhangFt, eaveY + fasciaFt - chordDropFt,
      CUT_DEPTH_FT, plateY + riseAt(CUT_DEPTH_FT) - chordDropFt, 1);
    anchors.overhang = { x: -roof.overhangFt / 2, y: eaveY - 0.55 };
    anchors.fascia = { x: -roof.overhangFt - 0.55, y: eaveY + fasciaFt / 2 };

    const topY = plateY + riseAt(CUT_DEPTH_FT);
    parts.push({ kind: 'break', x: CUT_DEPTH_FT, y1: edgeBot - 0.3, y2: topY + 0.3 });

    return {
      parts,
      anchors,
      extents: {
        minX: -roof.overhangFt - 1.4,
        maxX: CUT_DEPTH_FT + 0.4,
        minY: edgeBot - 1.0,
        maxY: topY + 0.9,
      },
    };
  };

  const buildGarageSection = values => {
    const g = values.garage;
    const parts = [];
    const anchors = {};
    const line = (x1, y1, x2, y2, weight = 1.5) => parts.push({ kind: 'line', x1, y1, x2, y2, weight });
    const rect = (x, y, w, h, weight = 1.5) => parts.push({ kind: 'rect', x, y, w, h, weight });

    const cut = -GARAGE_CUT_FT;                // the break edge, 2 ft out
    const fdnFt = g.thicknessIn / 12;
    const slabFt = g.slabIn / 12;

    // THE SILL TOP, NOT THE FLOOR, on the HOUSE's datum. Everything hangs off
    // it. This was called floorOffsetFt and commented "the floor surface" for
    // as long as it has existed, and it has never been the floor: three lines
    // down, `fdnTop = sillY`, then the concrete starts a sill plate below that
    // and the slab another 4" below the concrete. The garage floor is
    // 5 1/2" under this number.
    //
    // The name mattered more than a name usually does, because the value is a
    // BEARING LINE and the section is full of them -- houseSillFt,
    // GARAGE_SILL_BELOW_HOUSE_FT, anchors.garageSill all mean the same kind of
    // thing, and derivedAttachedOffsetFt computes this one FROM houseSillFt.
    // Every neighbour said sill; only this said floor, so a reader checking
    // whether the two buildings line up had one word telling them the wrong
    // datum.
    //
    // Renaming it does not fix the control feeding it, which is still labelled
    // "Garage floor off main fl" -- that is store-vs-display, parked. But a
    // field named sillOffsetFt fed by a box labelled floor is visibly odd,
    // where floorOffsetFt fed by "floor" looked settled. The lie was the
    // agreement.
    const sillY = g.sillOffsetFt;
    anchors.garageOffset = { x: cut / 2, y: sillY + 0.62 };


    // TWO FOUNDATIONS, ONE TOP. Movie, 4 Sep: "that should actually be an
    // option to switch from grade beam to frost wall on these drawings...
    // add onto the bottom of the grade beam to depth of footing and add
    // footing if they select frost wall", and "let's make the footings line
    // up".
    //
    // So a frost wall is not a different foundation drawn in a different
    // place: it is THIS beam continued down until its footing sits at the
    // same elevation as the house's. The top does not move -- the slab still
    // bears where it bore -- and nothing above the beam changes.
    //
    // The depth is DERIVED, never typed. "Footings line up" is the whole
    // rule, so the wall spans from the beam top to the top of the house's
    // footing, whatever those happen to be. A typed frost-wall height would
    // be a number that agrees with the house until one of them moved.
    // THE SILL PLATE. Movie, 4 Sep: "look on my drawing see the sill plate,
    // where is your sill plate?" -- there wasn't one. His spec was "32" conc
    // and 1.5" sill plate grade beam (33.5")", and I had stored the 32 and
    // let the section table's TO SILL note add the plate, so the number was
    // right everywhere it was written and the plate was drawn nowhere. A
    // dimension that exists only in a footnote is not a part.
    //
    // It bears on top of the concrete and the wall bears on IT, so the top of
    // the stack does not move: 32" of concrete now tops out 1 1/2" lower and
    // the plate makes the difference up.
    //
    // FOR BAND 2, not built yet, and the distinction matters more than the
    // fact. Movie, 4 Sep: "they line up between house and garage on the
    // bilevel", then "on the house if the foundation is deep they also line
    // up on a house but not too often".
    //
    // NEITHER IS A RULE. Movie, 4 Sep: "on bilevel could change but not
    // often, 95% inline", "on bungalow 95% not inline (opposite)".
    //
    // So it is one editable number with two different starting points:
    // a MODIFIED BILEVEL defaults to the offset that puts this sill level
    // with the house's, a BUNGALOW defaults to whatever the drafter's own
    // grade gives. Both stay typeable.
    //
    // The first version of this note called the bilevel case a RULE and
    // derived it. That would have been right 95% of the time and impossible
    // to draw the other 5% -- the shape of defect this project keeps finding,
    // where a number that is usually correct is welded in so the unusual
    // drawing cannot be made at all. A 95% answer is a DEFAULT, and a default
    // is something you can type over.
    // THE CUT RUNS ALONG THE BEAM, NOT ACROSS IT. Movie, 4 Sep: "you drew the
    // grade beam sideways it should extend out and meet the section cut line
    // approx 4-6 out, the 4" void form will also go that way".
    //
    // The first version drew the beam as an 8"-wide stub hanging at the house
    // wall -- the beam seen END ON, which is what you get cutting across it.
    // This section is cut ALONG the garage's side wall, so the beam runs out
    // from the house and is cut lengthwise: it reads as a band the full width
    // of the drawing, ending at the break. The void form does the same,
    // because it is cast under the beam for its whole run.
    const frostWall = g.foundation === 'frostwall';
    const sillFt = SILL_PLATE_IN / 12;
    const fdnTop = sillY;
    const concTop = fdnTop - sillFt;
    const fdnBot = frostWall ? g.houseFootingTopFt : concTop - g.fdnWallHeightFt;
    rect(cut, fdnBot, GARAGE_CUT_FT, concTop - fdnBot, 2);
    rect(cut, concTop, GARAGE_CUT_FT, sillFt, 1.5);
    anchors.garageFdnHeight = { x: cut * 0.5, y: (concTop + fdnBot) / 2 };
    anchors.garageSill = { x: cut * 0.5, y: concTop + sillFt / 2 };

    // THE SLAB, sloping to the doors. Its top starts 4" below the top of the
    // beam's concrete at the house end and falls 1/8" per foot toward the
    // cut -- the doors are out past the break, so within this section it only
    // ever goes down. Three sides: it runs into the beam at the house end
    // rather than stopping against it, the same way the footing does.
    const slabTopHouse = concTop - GARAGE_SLAB_BELOW_CONCRETE_IN / 12;
    const slabFall = GARAGE_CUT_FT * GARAGE_SLAB_SLOPE_IN_PER_FT / 12;
    const slabTopCut = slabTopHouse - slabFall;
    line(cut, slabTopCut, 0, slabTopHouse, 1);
    line(cut, slabTopCut - slabFt, 0, slabTopHouse - slabFt, 1);
    line(cut, slabTopCut - slabFt, cut, slabTopCut, 1);
    anchors.garageSlab = { x: cut * 0.55, y: slabTopCut - slabFt - 0.45 };
    // THE FLOOR ITSELF, which had no anchor because nothing named it. The
    // typed offset is the SILL, 5 1/2" above this line, and the schedule
    // called that "garage floor off main fl" -- so the one number a drafter
    // actually pictures, how far you step down into the garage, was the one
    // the drawing could not point at. It points here, at the slab where it
    // meets the house wall, which is the end that shares the datum.
    anchors.garageFloor = { x: cut * 0.28, y: slabTopHouse + 0.42 };

    let lowest;
    if (frostWall) {
      // A footing, the house's own size, its bottom level with the house's.
      // NO RIGHT-HAND EDGE. Movie struck a line off the footing in red, and
      // this was it: a closed rectangle drew its own end at the shared wall
      // face -- x = 0 -- and the HOUSE's footing spans -0.500 to 1.167 at the
      // same depth, so that edge landed as a vertical straight through the
      // middle of it. The two are one continuous pour; a line where they meet
      // says they are two that happen to touch.
      //
      // Three sides, not four. The garage's footing simply runs off into the
      // house's, which is what it does.
      const footD = g.footingDepthIn / 12;
      line(cut, fdnBot - footD, 0, fdnBot - footD, 1.5);   // underside
      line(cut, fdnBot, 0, fdnBot, 1.5);                   // top
      line(cut, fdnBot - footD, cut, fdnBot, 1.5);         // the cut end
      anchors.garageFooting = { x: cut * 0.5, y: fdnBot - footD / 2 };
      lowest = fdnBot - footD;
    } else {
      // 4" void form under the beam, between the piles: the beam is cast on
      // it and the form crushes, so heaving soil lifts nothing.
      rect(cut, fdnBot - VOID_FORM_IN / 12, GARAGE_CUT_FT, VOID_FORM_IN / 12, 1);
      anchors.garageVoidForm = { x: cut * 0.5, y: fdnBot - VOID_FORM_IN / 24 };
      lowest = fdnBot - VOID_FORM_IN / 12;
    }
    // NO FOOTING. Movie, 4 Sep: "why does your garage have a footing?" -- it
    // does not. A grade beam bears on drilled piles at about 8 ft on centre,
    // over a 4" void form between them; there is no spread footing under it.
    // The first draft copied the house's foundation pattern, which put a
    // strip footing under a beam that is deliberately hung off piles.
    //
    // The piles themselves are not drawn here either, and that is correct
    // rather than missing: at 8 ft o.c. and a 2 ft cut, the first pile is
    // beyond the break. (Movie: "first pile won't be shown too far".)

    // THE GARAGE HAS NO WALL HERE. This is the junction: the house's exterior
    // wall IS the wall at this cut, and the house section next door draws it.
    // The first version drew the garage its own studs a few inches away, which
    // read as two buildings standing beside each other rather than one joined
    // to the other -- and put a second line where there is one wall.
    //
    // The height still matters and still gets an anchor: it is the garage's
    // clear height AT the house, slab to roof, measured against the shared
    // face rather than against a wall of its own.
    const plateY = sillY + g.wallHeightFt;
    anchors.garageWallHeight = { x: -0.75, y: sillY + g.wallHeightFt / 2 };

    // STRAIGHT, and no grade. Movie: "no roof slop just 2ft of straight roof
    // until the cut... we want to show where the connection happens". The
    // slope and the eave belong to a garage; what happens AT the house is a
    // level run into the wall. And no grade line on this side at all -- the
    // garage is standing there, so soil ticks would draw earth inside a
    // building. The house's own section still carries grade, because a
    // typical exterior wall does have some.
    // Ceiling, bottom chord, cavity, top chord. The bottom chord's UNDERSIDE
    // is the ceiling plane -- the face the finish hangs off -- and the 4'-0"
    // is measured from that plane to the TOP of the top chord, so the cavity
    // between the two members is 4'-0" less both chords.
    const chordFt = ROOF_CHORD_IN / 12;
    const cavityTop = plateY + GARAGE_CAVITY_FT;
    line(0, plateY, cut, plateY, 2);
    line(0, plateY + chordFt, cut, plateY + chordFt, 1);
    line(0, cavityTop - chordFt, cut, cavityTop - chordFt, 1);
    line(0, cavityTop, cut, cavityTop, 2);
    anchors.garageCavity = { x: cut * 0.42, y: plateY + GARAGE_CAVITY_FT / 2 };

    const topY = cavityTop;
    // The pile face, dotted, running past everything above it. It has no
    // bottom in this drawing on purpose: a pile is drilled to depth per the
    // soils report, so a drawn end would be a number nobody has.
    const pileX = cut + PILE_FACE_FROM_CUT_IN / 12;
    const pileBot = lowest - PILE_BELOW_LOWEST_IN / 12;
    const pileTop = fdnBot + PILE_TOP_ABOVE_VOID_IN / 12;
    parts.push({ kind: 'dashed', x1: pileX, y1: pileTop, x2: pileX, y2: pileBot });
    anchors.garagePile = { x: pileX, y: (pileTop + pileBot) / 2 };

    parts.push({ kind: 'break', x: cut, y1: pileBot - 0.3, y2: topY + 0.3 });

    return {
      parts,
      anchors,
      extents: {
        minX: cut - 1.1,
        maxX: 0,      // the shared wall face: the house's own extents carry on
                      // from here, and the two together are one drawing
        minY: pileBot - 1.1,
        maxY: topY + 1.1,
      },
    };
  };

  // ONE VERTICAL MAPPING ACROSS SEVERAL CANVASES.
  //
  // The house and its garage are drawn on separate canvases so each can carry
  // its own schedule, but they are one section: an elevation has to land on
  // the same pixel row in both, or the garage's offset -- the whole point of
  // it being free vertically -- reads as a drawing error instead of a height.
  // So the scale and the y origin are computed once across every section and
  // handed to each paint call.
  //
  // The scale is the SMALLEST that fits them all: each canvas must hold its
  // own width, and the tallest section must fit the shared height. Taking the
  // largest, or each canvas's own fit, is what makes two drawings that agree
  // about feet disagree about pixels.
  // Movie's mockup, 4 Sep: the house and its garage are ONE section. A single
  // wall stack, with the garage's floor, beam and roof dying into it -- not
  // two drawings placed side by side. The first build put them on separate
  // canvases, which made the junction impossible to draw honestly: the garage
  // grew a wall of its own a few inches from the house's, because there was
  // nowhere for one wall to belong to both.
  //
  // They already share an origin -- x = 0 is the house's exterior wall face
  // for both builders, y = 0 is MAIN FL -- so the union of their extents is a
  // real drawing, not a montage. This returns ONE mapping: shared scale,
  // shared minX, shared minY.
  const sectionView = entries => {
    const ex = entries.map(e => e.section.extents);
    const minX = Math.min(...ex.map(e => e.minX));
    const maxX = Math.max(...ex.map(e => e.maxX));
    const minY = Math.min(...ex.map(e => e.minY));
    const maxY = Math.max(...ex.map(e => e.maxY));
    const canvas = entries[0].canvas;
    return {
      minX, minY,
      span: maxX - minX,
      scale: Math.min(canvas.width / (maxX - minX), canvas.height / (maxY - minY)),
    };
  };

  // Fit the section into the canvas, paint it, and hand back each anchor in
  // CANVAS pixels so the page can park the matching input beside its part.
  //
  // `view` is OPTIONAL and omitting it is the old behaviour exactly -- fit
  // this section to this canvas alone. A single drawing has nothing to line
  // up with, and a caller that passes nothing should not silently get a
  // different picture than it got before.
  // `align` decides where the leftover width goes: 0 packs the drawing
  // left, 1 right, 0.5 centres it. The garage is pushed RIGHT and the house
  // LEFT so the two meet at the shared wall face -- they are one building
  // shown in two canvases, and a gap down the middle would say they are two.
  const paintSection = (canvas, section, view, align = 0.5, clear = true) => {
    const ctx = canvas.getContext('2d');
    const { extents } = section;
    const w = canvas.width, h = canvas.height;
    const scale = view ? view.scale
      : Math.min(w / (extents.maxX - extents.minX), h / (extents.maxY - extents.minY));
    const baseY = view ? view.minY : extents.minY;
    // Under a shared view every section is placed from the SAME origin, so
    // the garage lands where it belongs against the house rather than being
    // fitted to its own box. `align` only spends the leftover width of the
    // whole drawing, once.
    const baseX = view ? view.minX : extents.minX;
    const span = view ? view.span : (extents.maxX - extents.minX);
    const slack = view ? (w - span * scale) * align : 0;
    const X = x => (x - baseX) * scale + slack;
    const Y = y => h - (y - baseY) * scale;
    if (clear) ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#1d1f20';
    ctx.lineJoin = 'miter';
    section.parts.forEach(part => {
      ctx.lineWidth = part.weight || 1.5;
      if (part.kind === 'line') {
        ctx.beginPath(); ctx.moveTo(X(part.x1), Y(part.y1)); ctx.lineTo(X(part.x2), Y(part.y2)); ctx.stroke();
      } else if (part.kind === 'rect') {
        ctx.strokeRect(X(part.x), Y(part.y + part.h), part.w * scale, part.h * scale);
      } else if (part.kind === 'dashed') {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(part.x1), Y(part.y1));
        ctx.lineTo(X(part.x2), Y(part.y2));
        ctx.stroke();
        ctx.restore();
      } else if (part.kind === 'grade') {
        // THE DRAWING PLUS A TAIL, not the whole canvas. It has to cross both
        // sections -- grade does not stop where a building starts -- but it
        // was running the full canvas width, which set the page's width from
        // a dashed line rather than from anything drawn. Movie: "could delete
        // some grade line width there". The tail is what makes it read as
        // continuing past the section rather than stopping at it.
        const tail = 14;
        const from = view ? slack - tail : 0;
        const to = view ? slack + span * scale + tail : w;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, from), Y(part.y));
        ctx.lineTo(Math.min(w, to), Y(part.y));
        ctx.stroke();
        ctx.restore();
      } else if (part.kind === 'break') {
        // The section's cut edge — a drafting break line with a mid jog.
        const midY = (part.y1 + part.y2) / 2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(part.x), Y(part.y1));
        ctx.lineTo(X(part.x), Y(midY - 0.3));
        ctx.lineTo(X(part.x + 0.3), Y(midY - 0.1));
        ctx.lineTo(X(part.x - 0.3), Y(midY + 0.1));
        ctx.lineTo(X(part.x), Y(midY + 0.3));
        ctx.lineTo(X(part.x), Y(part.y2));
        ctx.stroke();
      }
    });
    const anchors = Object.fromEntries(Object.entries(section.anchors)
      .map(([key, at]) => [key, { x: X(at.x), y: Y(at.y) }]));
    return { anchors, scale };
  };

  // Several sections, ONE canvas, one coordinate system: the view is computed
  // across all of them, the canvas is cleared once, and each is painted into
  // the same mapping. Painting them one at a time with paintSection would have
  // the second clear the first -- which is the kind of thing that looks like a
  // painter bug and is really an argument default.
  const paintSections = (canvas, sections, align = 0.5) => {
    const view = sectionView(sections.map(section => ({ section, canvas })));
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    const anchors = {};
    sections.forEach(section => {
      Object.assign(anchors, paintSection(canvas, section, view, align, false).anchors);
    });
    // The view goes back with the anchors so the page can put labels against
    // the DRAWING's edges rather than the canvas's -- the two are not the same
    // once the canvas is wider than the section needs.
    return { anchors, scale: view.scale, view };
  };

  window.DraftProjectPage = Object.freeze({
    ZONE_ROWS,
    CUT_DEPTH_FT,
    ROOF_CHORD_IN,
    SPLIT_TYPES,
    SPLIT_WALL_FT,
    ROOF_HEEL_MIN_IN,
    ROOF_HEEL_MAX_IN,
    roofHeelInBand,
    DETACHED_BEAM_ABOVE_GRADE_IN,
    DETACHED_SLAB_ABOVE_GRADE_IN,
    // Exported so section-table-harness.js can hold this file's copies of
    // cut-view.js's numbers against the originals. The 32" is the pair that
    // already drifted once, under two different names.
    GARAGE_DEPTH_FT,
    garageSlabFallIn,
    GARAGE_EDGE_DEPTH_IN,
    GARAGE_GRADE_BEAM_IN,
    GARAGE_SILL_BELOW_HOUSE_FT,
    GARAGE_SLAB_BELOW_CONCRETE_IN,
    GARAGE_WALL_FT,
    OPENING_HEAD_DROP_IN,
    GRADE_MIN_BELOW_CONCRETE_IN,
    GRADE_BELOW_CONCRETE_IN,
    FOUNDATION_ATTACHMENTS,
    ATTACHMENT_LABEL,
    LADDER_WIDTH_IN,
    SECTION_TABLE_ROWS,
    SECTION_TABLE_ITEMS,
    SECTION_TABLE_DEFAULTS,
    GARAGE_FOUNDATIONS,
    GARAGE_FOUNDATION_LABEL,
    VOID_FORM_IN,
    STUD_LENGTHS_IN,
    HALF_STUD_IN,
    PLATE_STACK_IN,
    SILL_PLATE_IN,
    wallHeightFtFromStud,
    studInFromWallHeightFt,
    roofHeelIn,
    buildWallSection,
    buildGarageSection,
    buildDetachedGarageSection,
    buildDetachedFoundationDetail,
    buildDetachedFoundationRow,
    paintSections,
  });
})();
}
