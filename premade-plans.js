// PREMADE PLANS — the designs the drive-thru hands over, in whole feet.
//
// Movie, 18 Sep: "we shouldn't put it in the drivethru window yet, i'd just
// like to offer them premade designs in there at the beginning". The board
// asks a drafter what he wants and the bone builds it; until this module
// there was nothing for the bone to build but a garage.
//
// A DESIGN, NOT A GENERATOR. starter-shape.js invents a house — three shapes,
// varied proportions, a random source — because its job is "a beginner presses
// the bone on an empty screen and A house appears". This is the other thing:
// the drafter picked 1 STOREY off a board of pictures, and what he gets has to
// be the building in the picture. Same numbers every time, which is also what
// makes it checkable.
//
// ── THE BUNGALOW (Movie, 18 Sep, in his own numbers) ─────────────────────
//
//   "lets make the bungalows all 32 feet wide"           -> WIDTH_FT
//   "house 40 long"  ("40x32 = 1280 sqft good starter")  -> DEPTH_FT
//   "a 24 ft wide garage"                                -> GARAGE_WIDTH_FT
//   "make the garage 26 ft long"                         -> GARAGE_DEPTH_FT
//   "sticks over past the house by 4 ft (so there will be 12ft of house
//    visible and 20 ft covered by garage"
//   "the right garage wall will be 4ft closer to the property line than the
//    house wall"
//   "only the garage wall should go the extra foot so will be 27 ft on that
//    side"
//
// THE ARITHMETIC CLOSES, which is how the reading was checked before a line
// was written: 12 visible + 20 covered = 32, the house width; 20 covered + 4
// past = 24, the garage width. Two independent sums landing on two given
// numbers is a stronger reading than any amount of re-reading the sentence.
//
// ── THE EXTRA FOOT ───────────────────────────────────────────────────────
//
// Movie: "you need 8\" for the foundation to connect (or 1ft if its ICF" ...
// "lets standardize that to connect at 1ft" ... "even if its 8\" conc put it
// in at 1ft and the user can adjust it later" ... "rather than fitting the
// concrete move it over 1ft exactly easier to construct other floors etc"
// ... "and good for toy mode too".
//
// So the connection is a WHOLE FOOT of building rather than a wall thickness
// to fit. Only the garage's right wall takes it -- 27 ft where the left is 26
// -- which carries the garage's rear wall one foot past the house's front line
// and lands it ON THE HOUSE'S RIGHT WALL rather than butting it onto the front
// face. The house square is untouched: "the garage won't overlap the house
// though the house square will be primary".
//
// Every vertex here is an integer. The app quantises to whole feet, and a
// premade design arriving on a half-inch would be the catalogue arguing with
// the drawing before the drafter has touched anything.
//
// ── ORIENTATION ──────────────────────────────────────────────────────────
//
// +z IS THE FRONT and +x is east, which is garage-site.js's convention, taken
// from it rather than decided again here: "the door wall faces the viewer
// (+z), so depth runs back from it". A second opinion about which way a house
// points is how a garage ends up in the back yard.
//
// Pure: no DOM, no state, no ids. It returns points. Whoever commits them
// owns identity, levels and walls.
if (!window.DraftPremadePlans) {
(() => {
  const WIDTH_FT = 32;
  const DEPTH_FT = 40;
  const GARAGE_WIDTH_FT = 24;
  const GARAGE_DEPTH_FT = 26;
  // How far the garage's right wall stands proud of the house's, toward the
  // property line. The 4 ft of garage rear wall this exposes is the wall a
  // man-door goes in -- Movie: "so a man-door can be installed that leads on
  // a path to backyard" -- which is why it is a dimension and not a leftover.
  const GARAGE_PAST_FT = 4;
  // The connection, standardised at a foot. See above.
  const GARAGE_TIE_FT = 1;

  const pt = (x, z) => Object.freeze({ x, z });

  // Counter-clockwise by the shoelace sign this app uses, the same winding
  // starter-shape.js returns. build-house.js reads the winding itself to
  // decide which side the wall body sits on, so either direction would
  // work -- one direction consistently is simply easier to reason about when
  // a plan looks wrong on screen.
  const houseLoop = () => {
    const halfW = WIDTH_FT / 2;
    const halfD = DEPTH_FT / 2;
    return [
      pt(-halfW, -halfD), pt(halfW, -halfD), pt(halfW, halfD), pt(-halfW, halfD),
    ];
  };

  // THE GARAGE HANGS OFF THE HOUSE and is measured from it, never from the
  // origin. Written the other way -- its own centre, its own offsets -- the
  // two bodies would drift apart the first time the house's width changed,
  // and the drift would be a gap or an overlap of a foot or two that reads on
  // screen as a drawing mistake rather than as a rule.
  const garageLoop = () => {
    const houseRight = WIDTH_FT / 2;
    const houseFront = DEPTH_FT / 2;
    const right = houseRight + GARAGE_PAST_FT;
    const left = right - GARAGE_WIDTH_FT;
    const doorZ = houseFront + GARAGE_DEPTH_FT;
    // One foot BEHIND the house's front line, which is the tie.
    const tieZ = houseFront - GARAGE_TIE_FT;
    return [
      pt(houseRight, houseFront),   // where it leaves the house's front wall
      pt(houseRight, tieZ),         // down the house's right wall, the 1 ft tie
      pt(right, tieZ),              // the exposed rear wall -- the man-door one
      pt(right, doorZ),             // the long side, GARAGE_DEPTH + the tie
      pt(left, doorZ),              // the door wall
      pt(left, houseFront),         // back to the house's front wall
    ];
  };

  // ── WHERE THE WINDOWS AND DOORS GO ───────────────────────────────────────
  //
  // Movie, 18 Sep: "i'd like the windows to be in set positions for each house
  // in the drivethru menu, but for the 'AUTOHOUSE' when they draw the outline
  // and create the house that one could have the fenestrations auto
  // generated". So these are part of the DESIGN, the way the wall positions
  // are -- not the bone's deal. auto-windows.js is the other thing, and the
  // records below carry `auto: false` so a re-deal leaves them alone.
  //
  // "please windows and doors into the bungalow and i'll change them if i need
  // to afterwards", so these are a first pass to be corrected against, and
  // they are arranged to be easy to correct: every one is an offset along a
  // NAMED EDGE of the loop, so moving a window is moving one number.
  //
  // AN OPENING IS KEYED TO AN EDGE, NOT TO A POINT. `edge: 2` is the run from
  // points[2] to points[3], which is exactly what build-house.js's
  // houseWallRuns hands back in that order -- so the committer can hang an
  // opening on the wall it just made without matching coordinates back up.
  // `offsetFt` is from that edge's START to the opening's CENTRE, which is
  // what drawing-format.js:211 means by offset.
  // THE APP'S OWN DEFAULTS, read rather than typed. These were 6'-8" and 2'-6"
  // written out here with a comment pointing at MODEL.dc.html -- which is a
  // copy with a citation, and a citation does not update itself. geometry-2d.js
  // holds the one set now; a design that quietly disagreed with the page's own
  // defaults would put two head heights in one drawing.
  const G = window.DraftGeometry2D;
  const DOOR_HEAD_FT = G.DEFAULT_OPENING_HEAD_FT;
  const WINDOW_HEAD_FT = G.DEFAULT_WINDOW_HEAD_FT;
  // ── THE DESIGN'S WINDOWS ARE 4'-2" TALL, AND THAT IS WHAT IS KEPT ───────
  //
  // Movie, 21 Sep: the head is the datum at 7'-0"; 22 Sep, asked whether the
  // windows already drawn should follow: *"move to 7ft"*.
  //
  // So these move UP, and they keep their size -- a 2'-6" sill under a 6'-8"
  // head is a 4'-2" window, and under a 7'-0" head it is the same window on a
  // 2'-10" sill. A design whose windows changed SIZE because the standard
  // moved would be a different design, and a house rebuilt from the drive-thru
  // would then disagree with the same house opened from a file, which
  // drawing-format.js migrates by keeping the size. Two answers to one
  // ruling is the thing to avoid.
  //
  // DERIVED FROM WHAT IT WAS, not typed as 4.167: the old pair is still the
  // authority on what size this design's windows are, and writing the number
  // out here would be a third place to edit the day the office changes it.
  const WINDOW_HEIGHT_FT = DOOR_HEAD_FT - G.DEFAULT_WINDOW_SILL_FT;
  const WINDOW_SILL_FT = Math.max(0, WINDOW_HEAD_FT - WINDOW_HEIGHT_FT);
  // NOT a default: an overhead door heads at 7'-0" because that is the door,
  // not because nobody said. It stays a number of this design's own -- and it
  // is a coincidence that a window now heads there too, which is why this is
  // still written separately rather than pointed at the window's.
  const GARAGE_DOOR_HEAD_FT = 7;
  const opening = (edge, offsetFt, widthFt, type, over = {}) => Object.freeze({
    edge,
    offsetFt,
    widthFt,
    type,
    // A DOOR STANDS ON THE FLOOR, so its head IS its height and it keeps the
    // 6'-8" leaf. Only the window moved.
    sillFt: type === 'door' ? 0 : WINDOW_SILL_FT,
    headFt: type === 'door' ? DOOR_HEAD_FT : WINDOW_HEAD_FT,
    garage: false,
    ...over,
  });

  // THE HOUSE. Its loop is wound [back, right, front, left] from
  // houseLoop() -- edge 0 runs along the back wall, 1 up the right, 2 back
  // along the FRONT, 3 down the left.
  //
  // THE FRONT CARRIES ONLY WHAT FITS IN THE 12 FT THE GARAGE LEAVES. Edge 2
  // starts at the house's right corner and runs left, so the garage covers its
  // first 20 ft and the visible stretch is offset 20 to 32. A window on the
  // covered part would look into the garage.
  const houseOpenings = () => {
    // WHERE THE GARAGE STOPS, in offsets along edge 2. That edge starts at the
    // house's RIGHT corner and runs left, and the garage covers the first
    // twenty feet of it -- Movie's own "20 ft covered by garage", which is the
    // garage's width less the part standing proud of the house.
    //
    // THE FIRST DRAFT USED THE 12 AS AN OFFSET, which is the VISIBLE width,
    // not where the visible part begins -- so the door and the window both
    // landed on the covered stretch, looking into the garage. Two numbers in
    // this design add up to 32 and it is easy to reach for the wrong one.
    const covered = GARAGE_WIDTH_FT - GARAGE_PAST_FT;
    return [
      // Front: the door, then a window, both inside the visible stretch.
      opening(2, covered + 3.5, 3, 'door'),
      opening(2, covered + 8.5, 4, 'window'),
      // Back: three, evenly spread and clear of both corners.
      opening(0, 8, 4, 'window'),
      opening(0, 16, 4, 'window'),
      opening(0, 24, 4, 'window'),
      // Right: two. The garage ties into this wall's far end (the last foot),
      // so both sit well short of it.
      opening(1, 12, 4, 'window'),
      opening(1, 28, 4, 'window'),
      // Left: two, mirroring them.
      opening(3, 12, 4, 'window'),
      opening(3, 28, 4, 'window'),
    ];
  };

  // THE GARAGE. Its loop runs [tie, rear, right, door wall, left, shared] --
  // see garageLoop, which builds it in that order.
  //
  // THE MAN-DOOR IS WHY THE 4 FT REAR WALL EXISTS. Movie: the garage stands
  // proud of the house "so a man-door can be installed that leads on a path to
  // backyard". Four feet is not four feet of door: the bearing has to come off
  // each end, and what is left is a shade under 2'-8". A 2'-6" leaf fits with
  // room to spare, which is the difference between a door and a door that the
  // clamp refuses on a rounding error.
  const garageOpenings = () => [
    opening(1, GARAGE_PAST_FT / 2, 2.5, 'door'),
    opening(3, GARAGE_WIDTH_FT / 2, 16, 'door',
      { garage: true, headFt: GARAGE_DOOR_HEAD_FT }),
  ];

  // ── THE DETACHED GARAGE THE BOARD ORDERS ─────────────────────────────────
  //
  // Movie, 20 Sep: "also the detached garage doesn't have a roof or windows
  // and doors yet i noticed". It was a bare box -- four stud walls and the
  // concrete under them, and no way into it.
  //
  // ITS LOOP IS NOT THIS MODULE'S. A detached garage is PLACED rather than
  // designed: the drafter typed the size and garage-site.js decided where the
  // box stands. So this takes the two numbers and hands back openings keyed to
  // THAT loop's edges, which run clockwise from its back-left corner --
  //
  //   edge 0  back      edge 1  right
  //   edge 2  FRONT, the door wall ("the door wall faces the viewer (+z)")
  //   edge 3  left, the side facing the house: plot() stands the garage at
  //           `standing.maxX + SETBACK_FT`, so what is already built is west
  //           of it and the path between the two runs off this wall.
  //
  // ── THE OVERHEAD DOOR IS SIZED TO THE WALL ───────────────────────────────
  //
  // Which the attached garage never had to be: its door wall is 26 ft every
  // time. This one is anything from 8 ft to 60. A 16 ft door needs 17'-5" of
  // wall to carry it -- the leaf, plus at each end the stud wall it runs into
  // and the bearing the lintel sits on -- so the 16x24 ON THE BOARD cannot
  // take one at all, and comes down the ladder to the 12.
  //
  // AND WRITING IT ANYWAY WOULD NOT SHOW UP AS A BUG. The record would reach
  // the file, geometry-2d.js's clampOpeningToWall would refuse it on every
  // paint, and the drafter would get a garage that is shut on the plan, shut
  // on the elevation and shut in 3D, with nothing anywhere saying why. So the
  // fit is asked HERE, against the same clamp the painter uses.
  //
  // A LADDER OF STOCK WIDTHS, widest first, and the first the wall can carry
  // wins: 16 and 12 are doubles, 10, 9 and 8 singles. Below about 9'-2" of
  // door wall none of them fits and the garage gets no overhead door -- an 8 ft
  // box is a shed, and a made-up width would be a door nobody can order.
  const OVERHEAD_DOOR_WIDTHS_FT = Object.freeze([16, 12, 10, 9, 8]);

  // WHAT A WALL OF THIS LENGTH CAN CARRY, by the painter's own rule. Each end
  // reserves the wall it runs into plus the lintel's bearing, which is
  // openingEndReserveFt over a corner -- and at a corner of this box the
  // carrier is always another wall of the same garage, so one thickness
  // answers for both ends.
  const carries = (wallLengthFt, widthFt, wallThicknessFt) =>
    wallLengthFt >= widthFt + 2 * (wallThicknessFt + G.openingBearingFt(widthFt));

  const widestDoorFor = (wallLengthFt, wallThicknessFt) =>
    OVERHEAD_DOOR_WIDTHS_FT.find(w => carries(wallLengthFt, w, wallThicknessFt)) || null;

  // A MAN DOOR AND ONE WINDOW, which is the "windows and doors" half of the
  // report. The man door is the everyday way in, on the wall the house is on;
  // the window is on the BACK, away from both the street and the neighbour,
  // and it is one number to move when Movie wants it elsewhere -- the same
  // promise houseOpenings makes.
  const MAN_DOOR_WIDTH_FT = 2.5;
  const GARAGE_WINDOW_WIDTH_FT = 3;

  // `wallThicknessFt` IS ASKED FOR RATHER THAN ASSUMED. What carries the end
  // of a lintel is the wall it runs into, and this module does not know what
  // the page framed the garage in -- a 2x4 garage reserves an inch and a half
  // less per end than a 2x6 one, which is the difference between a 9 ft door
  // fitting and not on a wall near the line. The caller has just built the
  // walls and knows.
  const detachedGarageOpenings = ({ widthFt, depthFt, wallThicknessFt } = {}) => {
    const w = Number(widthFt);
    const d = Number(depthFt);
    const t = Number(wallThicknessFt);
    if (!Number.isFinite(w) || !Number.isFinite(d) || !Number.isFinite(t)) return [];
    const out = [];
    // THE BACK WALL'S WINDOW, first so the list reads round the loop.
    if (carries(w, GARAGE_WINDOW_WIDTH_FT, t)) {
      out.push(opening(0, w / 2, GARAGE_WINDOW_WIDTH_FT, 'window'));
    }
    const overhead = widestDoorFor(w, t);
    if (overhead) {
      out.push(opening(2, w / 2, overhead, 'door',
        { garage: true, headFt: GARAGE_DOOR_HEAD_FT }));
    }
    // THE MAN DOOR ON THE HOUSE SIDE, centred on the depth. Only a box under
    // about 3'-8" deep could refuse it, which the board's own 8 ft minimum
    // already rules out -- but the question is asked rather than assumed,
    // because a typed size is the one a drafter can get wrong.
    if (carries(d, MAN_DOOR_WIDTH_FT, t)) {
      out.push(opening(3, d / 2, MAN_DOOR_WIDTH_FT, 'door'));
    }
    return out;
  };

  // ── THE UPPER STOREY'S WINDOWS ───────────────────────────────────────────
  //
  // NO DOORS UP HERE. The ground floor's set carries the front door, and a
  // door on the second storey opens into air -- which the clamp would accept
  // and the drafter would find on the elevation.
  //
  // AND THE FRONT IS WHOLE. On the ground floor the garage covers the first
  // twenty feet of the front wall, so the design keeps its openings clear of
  // it; the garage is a SINGLE STOREY, so upstairs that stretch is a wall
  // looking over the garage roof and takes windows like any other.
  const upperOpenings = () => [
    // Front: three across the whole width, since nothing is in front of it.
    opening(2, 8, 4, 'window'),
    opening(2, 16, 4, 'window'),
    opening(2, 24, 4, 'window'),
    // Back: three, mirroring the ground floor's.
    opening(0, 8, 4, 'window'),
    opening(0, 16, 4, 'window'),
    opening(0, 24, 4, 'window'),
    // The two long sides, clear of both corners.
    opening(1, 12, 4, 'window'),
    opening(1, 28, 4, 'window'),
    opening(3, 12, 4, 'window'),
    opening(3, 28, 4, 'window'),
  ];

  // ── THE ROOM OVER THE GARAGE ─────────────────────────────────────────────
  //
  // Movie, 19 Sep: "put the 2nd story over the garage only 2/3 the garage
  // length (make it about 18ft long by 24 or 26 wide" ... "so the front of the
  // garage will have some roof on the main floor area".
  //
  // SO IT IS NOT THE GARAGE'S FOOTPRINT. The room sits against the house and
  // stops short, and the stretch it does not cover is what gives the garage
  // door end its own roof at the main-floor level -- which is the shape Movie
  // is describing and the reason for the 2/3.
  //
  //   24 ft WIDE, the garage's own width, so the walls above land on the
  //   walls below rather than mid-span.
  //   18 ft LONG from the house, which is two thirds of the 27 ft the garage
  //   runs including its tie -- his "about 18ft" and his "2/3" agree, and
  //   that agreement is the check.
  //
  // It leaves 9 ft at the door end. That is not a leftover: it is the piece
  // of single-storey garage roof he asked for.
  const OVER_GARAGE_LENGTH_FT = 18;

  const overGarageLoop = () => {
    const houseRight = WIDTH_FT / 2;
    const houseFront = DEPTH_FT / 2;
    const right = houseRight + GARAGE_PAST_FT;
    const left = right - GARAGE_WIDTH_FT;
    // FROM THE TIE, which reverses what this file said here until 22 Sep.
    //
    // Movie: *"where the garage hooks into the house the foundation, main
    // floor and 2nd floor should connect all the same (1ft in from corner)"*,
    // and then, asked to choose between three consistent readings, **(a)**:
    // all three levels at the tie. Measured on his own drawing before the
    // change, the connector carrying the garage's proud four feet into the
    // house's right wall:
    //
    //     FOUNDATION   (16, 19) -> (20, 19)     one foot in from the corner
    //     MAIN FL      (16, 19) -> (20, 19)     the same
    //     2ND FL       (16, 20) -> (20, 20)     ON the corner
    //
    // So the second-floor wall stood a foot in FRONT of the wall beneath it
    // for that stretch, with nothing under it.
    //
    // WHAT THIS USED TO SAY, kept because somebody reasoned it out: *"FROM THE
    // HOUSE'S FRONT WALL, not from the tie. The tie is a one-foot strip of
    // garage that reaches back along the house's side wall; a room starting
    // there would hang a foot past the house's own front face."* That is true
    // of moving the WHOLE back run to the tie, which would put twenty feet of
    // it inside the house. It is not true of the step garageLoop actually
    // makes, where only the PROUD four feet go back and the shared stretch
    // stays on the house's front line. The room takes that same step now.
    //
    // AND THE TIE IS TWO STOREYS HERE, which answers houseRoofLoop's old
    // objection rather than ignoring it. It refused this because *"the tie is
    // single storey"* -- true while nothing stood on it. With the room over
    // it, it is not, so the two-storey roof covering it is right; houseRoomLoop
    // now starts at the tie for exactly that reason.
    const back = houseFront;
    const tieZ = houseFront - GARAGE_TIE_FT;
    const front = back + OVER_GARAGE_LENGTH_FT;
    // A CORNER AT THE HOUSE'S OWN, and it is the whole reason this loop has
    // five points instead of four.
    //
    // The room is wider than the house is long here: its back run starts
    // inside the house's front wall and carries on 4 ft past the house's
    // right corner, because that is how far the garage sticks out. Left as
    // ONE edge, that run is only PARTLY shared -- and edgeOnLoop tests whole
    // edges, by design, so it would answer "not shared" and the room's back
    // wall would be raised in full. Twenty feet of it would then stand in
    // exactly the same place as the house's own upper front wall: doubled
    // linework, a doubled stud count, and two walls to drag when the house
    // moves. That is the wall Movie marked in green on the garage, one floor
    // further up.
    //
    // Splitting the run at the house's corner makes the shared stretch an
    // edge of its own, which edgeOnLoop then skips whole -- the same shape
    // garageLoop has carried from the start, and the reason IT has a vertex
    // at this exact point.
    //
    // AND THE TIE IS A SECOND SHARED EDGE, for the same reason the split
    // above exists: `(houseRight, back) -> (houseRight, tieZ)` lies ON the
    // house's right wall, so edgeOnLoop drops it whole and the room raises no
    // wall there. Two shared edges, not one -- which is exactly the pair
    // MODEL.html's raiseLoop comment already counts for the garage below.
    return [
      pt(left, back),          // the shared back run, along the house's front
      pt(houseRight, back),    // the house's own corner -- splits that run
      pt(houseRight, tieZ),    // down the house's right wall: the 1 ft tie
      pt(right, tieZ),         // the proud rear wall, over the garage's own
      pt(right, front),        // the long right side
      pt(left, front),         // the far end
    ];
  };

  // Windows on three sides. NOT on either back edge -- the long one is
  // interior, against the house, and a window in it would look into the upper
  // hall; the 4 ft stub beside it is too short to take one clear of both
  // corners.
  //
  // EDGES 3, 4 AND 5 -- and they were 2, 3 and 4 until the tie went in, which
  // is the second time this loop's vertices have moved these numbers. The
  // corner split pushed them once; the tie's two points pushed them again.
  // These indices are the loop's, and the loop is the only thing that decides
  // them -- which is why premade-plans-harness.js reads the edge each opening
  // names and measures ITS length rather than trusting the number.
  //
  // AND THE RIGHT SIDE GOT A FOOT LONGER WITH THE TIE, so its window is no
  // longer centred by halving the room's length. That edge runs `tieZ` to
  // `front` -- OVER_GARAGE_LENGTH plus the tie -- and keeping the old number
  // would leave it six inches off centre, which is exactly the drift a
  // hand-kept index produces.
  const overGarageOpenings = () => [
    opening(3, (OVER_GARAGE_LENGTH_FT + GARAGE_TIE_FT) / 2, 4, 'window'),
    opening(4, GARAGE_WIDTH_FT / 2, 4, 'window'),
    opening(5, OVER_GARAGE_LENGTH_FT / 2, 4, 'window'),
  ];

  // ── WHAT THE GARAGE'S OWN ROOF COVERS ────────────────────────────────────
  //
  // The whole garage, usually. NOT where a room sits on it: a roof over the
  // part the room stands on would be a roof INSIDE the building, under a
  // floor. So the garage roof takes what the room leaves, and on the designs
  // with no room that is the garage entire.
  //
  // THE STUB IS THE THING MOVIE ASKED FOR, not a remainder. 19 Sep: "so the
  // front of the garage will have some roof on the main floor area". The room
  // stops two thirds along on purpose, and this is the third it stops short
  // of -- the piece of single-storey roof at the garage door end that gives
  // the front its step down.
  //
  // IT IS CUT FROM THE GARAGE'S OWN NUMBERS rather than clipped out of the
  // garage polygon by the page. The design knows where the room ends because
  // the design put it there, and a boolean subtraction is a second, weaker
  // answer to a question that is already answered here.
  //
  // ── AND THE ROOF DOES NOT FOLLOW THE TIE ────────────────────────────────
  //
  // Movie, 20 Sep, looking at the E4 RIGHT elevation of a 2 STOREY + GARAGE:
  // "when the main floor garage roof connects to the house that has 2 storey
  // it should be gabled on the house end (not cottage) i think this was a
  // problem on model.dc but was solved". Ruled B of two readings, the one
  // where the roof is cut on the HOUSE LINE rather than gabling the jog.
  //
  // WHAT HE WAS LOOKING AT. garageLoop steps back a foot along the house's
  // right wall so the foundations connect -- his own "rather than fitting the
  // concrete move it over 1ft exactly easier to construct". Taking that jog
  // into the roof leaves a four-foot edge at z = 19 which is NOT on the house,
  // so it gets an eave and hips: a little triangle of roof tucked against the
  // house wall, which is the "cottage" end he is objecting to.
  //
  // THE TIE IS A FOUNDATION DETAIL AND THE ROOF IS NOT A FOUNDATION. So the
  // roof's rear runs straight along the house's front line, and the one foot
  // of tie behind it is simply not under this roof -- it sits under the
  // house's own eave, which oversails it.
  //
  // MODEL.dc.html HAD ALREADY ANSWERED THIS, which is what Movie remembered.
  // Its OPEN garages store only their LEGS and close the footprint along the
  // house's own boundary path (_garageSlabPolygon :13327), and _buildGarageRoof
  // then marks those closing edges gable BY INDEX with zero overhang --
  // `index >= legCount - 1` -- rather than asking geometry whether they lie on
  // the house. That is the piece that makes B work at all: see the note on
  // `houseEnd` below.
  const garageRoofLoop = ({ overGarage = false } = {}) => {
    const houseRight = WIDTH_FT / 2;
    const houseFront = DEPTH_FT / 2;
    const right = houseRight + GARAGE_PAST_FT;
    const left = right - GARAGE_WIDTH_FT;
    // WHERE THIS ROOF STARTS. With a room over it, the room's front wall is
    // the stub's back one -- they meet on that line, which is what makes the
    // upper roof's edge and the lower roof's edge the same line rather than
    // two lines a few inches apart. With no room, it is the house's own front
    // line: the tie is behind it and stays behind it.
    const back = houseFront + (overGarage ? OVER_GARAGE_LENGTH_FT : 0);
    const front = houseFront + GARAGE_DEPTH_FT;
    // EDGE 0 IS THE HOUSE END in both, which is what makes one index serve
    // both designs -- see GARAGE_ROOF_HOUSE_END.
    return [pt(left, back), pt(right, back), pt(right, front), pt(left, front)];
  };

  // ── THE EDGE THAT IS CUT FLUSH, DECLARED RATHER THAN DERIVED ─────────────
  //
  // WHY IT CANNOT BE DERIVED, which is the whole reason this key exists. The
  // page gables a roof edge when it LIES ON the body it is raised against,
  // end to end -- and end to end is deliberate, because a wall is raised whole
  // or not at all. The stub's rear runs the garage's full width, from x = -4
  // to x = 20, and the house it dies into stops at x = 16: four feet of that
  // edge stands past the house's corner in open air. So the test answers NO
  // for the whole edge and the house end hips, which is the bug.
  //
  // Measured, before this was written:
  //     rear edge (-4,20)->(20,20) reads as on the house?  false
  //
  // AND THE ROOM-OVER CASE WOULD HAVE SURVIVED IT. There the stub dies into
  // the ROOM, which is the garage's own width, so the edge does lie on it end
  // to end and the derivation finds it. Declaring it in both says the same
  // thing about the same edge rather than letting one design work by geometry
  // and the other by luck.
  //
  // KEYED BY EDGE INDEX, which is this file's own idiom -- `opening(edge, ...)`
  // keys every window and door the same way, and the committer looks the wall
  // up rather than counting. It is also exactly what MODEL.dc.html does for
  // the same edges: `index >= legCount - 1` marks the house path.
  const GARAGE_ROOF_HOUSE_END = Object.freeze([0]);

  // ── ONE ROOF OVER BOTH BODIES ────────────────────────────────────────────
  //
  // Movie, 19 Sep, looking at a house and a garage each wearing their own
  // hip: "it doesn't know how to connect the garage and main floor roof - it
  // is easy when they are the same height it would be like one large outline
  // (ignore the line between house and garage and make the roof full perimter
  // as house and garage".
  //
  // SO THE PERIMETER IS THE TWO BODIES' OUTSIDE EDGE and the wall between
  // them is not in it. Written out here rather than computed as a union: a
  // boolean of two polygons is a second, weaker answer to a question this
  // file already knows -- the garage is MEASURED from the house (see
  // garageLoop), so where they meet is arithmetic, not a search.
  //
  //      (-16,-20) ---------------- (16,-20)
  //          |                          |
  //          |        HOUSE             |
  //          |                     (16,19) --- (20,19)
  //          |                                     |
  //      (-16,20) --- (-4,20)                      |
  //                      |        GARAGE           |
  //                   (-4,46) ---------------- (20,46)
  //
  // TWO REFLEX CORNERS, ONE WING PROUD AND ONE INSET, which is the footprint
  // that floated a ridge a full storey high until #439: roofSkeleton acted on
  // the first of two simultaneous arrivals and left the second hanging off
  // the ring as a spike. This loop is why that fix had to come first, and
  // proto/roof-skeleton-harness.js carries the shape as its Z case.
  //
  // TWO WINGS, ONE SHAPE. The garage and the room over it occupy the SAME
  // stretch of x -- both are GARAGE_WIDTH_FT wide and both stand GARAGE_PAST_FT
  // proud of the house's right wall, because the room is built on the garage.
  // The only thing that differs is where the wing starts and stops in z. So
  // the perimeter is written once and asked twice, rather than twice and
  // compared never: two copies of an eight-corner loop are two places for the
  // day the house width changes to land, and only one of them would get the
  // edit.
  const houseWingLoop = (backZ, frontZ) => {
    const halfW = WIDTH_FT / 2;
    const halfD = DEPTH_FT / 2;
    const right = halfW + GARAGE_PAST_FT;
    const left = right - GARAGE_WIDTH_FT;
    return [
      pt(-halfW, -halfD), pt(halfW, -halfD),
      pt(halfW, backZ),       // up the house's right wall as far as the wing
      pt(right, backZ),       // out along the wing's rear wall
      pt(right, frontZ),      // down the wing's long side
      pt(left, frontZ),       // its far end
      pt(left, halfD),        // back up to the house's front line
      pt(-halfW, halfD),
    ];
  };

  // THE BUNGALOW'S: the wing starts one foot BEHIND the house's front line --
  // the tie -- and runs to the garage door.
  const houseGarageLoop = () =>
    houseWingLoop(DEPTH_FT / 2 - GARAGE_TIE_FT, DEPTH_FT / 2 + GARAGE_DEPTH_FT);

  // ── AND THE 2 STOREY'S, WHICH IS THE ROOM AND NOT THE GARAGE ─────────────
  //
  // Movie, 20 Sep, looking at the ROOF PLAN of a 2 STOREY + GARAGE + ROOM
  // OVER: "the 2 storey roofs have same problem the 1 storeys had earlier".
  //
  // AND HE IS RIGHT, THOUGH THE REASON THIS WAS MISSED IS IN THE NOTE BELOW.
  // houseRoofLoop refuses to splice a 2 STOREY because its GARAGE is a storey
  // lower -- true, and it is why the stub keeps its own roof. But the ROOM
  // OVER is not the garage: Movie ruled on 19 Sep that it is "even with the
  // 2nd floor so will be considered 2nd floor", so it stands on the house's
  // own plate. Two bodies, same height, each wearing its own hip -- which is
  // the 1 STOREY's defect exactly, one floor up.
  //
  // THE WING STARTS ON THE TIE, and this reverses what stood here until
  // 22 Sep along with overGarageLoop -- read its comment for Movie's ruling
  // and the measurement behind it.
  //
  // IT USED TO REFUSE THE TIE ON A STOREY ARGUMENT: *"the tie is single
  // storey, and taking it into this loop would put the two-storey roof over a
  // body a floor lower, which is the very thing houseRoofLoop's storey test
  // exists to refuse."* That was right while nothing stood on the tie. The
  // room does now, so the tie is two storeys where this roof covers it, and
  // the storey test has nothing to refuse.
  //
  // AND IT IS ONE ARGUMENT, not a new shape: houseWingLoop already takes a
  // `backZ`, and houseGarageLoop -- the BUNGALOW -- has passed the tie into
  // it from the start. This is that same call, one floor up.
  const houseRoomLoop = () =>
    houseWingLoop(DEPTH_FT / 2 - GARAGE_TIE_FT, DEPTH_FT / 2 + OVER_GARAGE_LENGTH_FT);

  // ── WHICH LOOP THE HOUSE'S ROOF IS RAISED OVER ───────────────────────────
  //
  // THE SAME HEIGHT IS THE CONDITION, and it is Movie's own: "it is easy WHEN
  // THEY ARE THE SAME HEIGHT ... when they are different heights it will need
  // a 'cricket' between the roofs at places where low points could cause
  // water damage".
  //
  // A BUNGALOW'S GARAGE STANDS ON THE SAME PLATE AS ITS HOUSE -- one storey
  // each -- so the two roofs are one roof and this returns the perimeter of
  // both. A 2 STOREY's garage is deliberately single storey (Movie: "make a
  // single story garage"), so its roof lands a whole floor below the house's
  // and they are two roofs with a valley between them that wants a cricket.
  // The cricket is NOT built, and that is why this asks about storeys rather
  // than always splicing: splicing a 2 STOREY would put one hip over bodies
  // at two different heights, which is not a roof at all.
  //
  // ── AND THE ROOM OVER THE GARAGE IS THE THIRD CASE ──────────────────────
  //
  // THE HEIGHT IS THE QUESTION, NOT THE STOREY COUNT, and reading the rule as
  // "2 STOREY never splices" is what let this through. The condition Movie
  // gave is the same one it always was -- "it is easy WHEN THEY ARE THE SAME
  // HEIGHT" -- and a 2 STOREY has a body at the house's own height whenever
  // the room over the garage is there: he ruled on 19 Sep that the room is
  // "even with the 2nd floor so will be considered 2nd floor", so it bears on
  // the same plate the house does.
  //
  // So the three answers are three heights, not three tiles:
  //   overGarage   the room shares the house's plate   -> splice house + room
  //   1 storey     the garage shares it                -> splice house + garage
  //   otherwise    nothing shares it                   -> the house alone
  //
  // THE GARAGE STUB IS OUT OF ALL OF THEM and keeps its own lower roof, which
  // is garageRoofLoop's job. The valley between that stub and this roof is
  // still the cricket, still unbuilt -- fixing the two hips at ONE height does
  // not pretend to fix the one junction that genuinely has two.
  const houseRoofLoop = ({ garage = false, storeys = 1, overGarage = false } = {}) => {
    if (garage && overGarage) return houseRoomLoop();
    return garage && storeys === 1 ? houseGarageLoop() : houseLoop();
  };

  // ── 2 STOREY ─────────────────────────────────────────────────────────────
  //
  // Movie, 19 Sep: "make the 2 storey the same for now sizewise". So it is the
  // bungalow's footprint with a storey on top -- same 32 x 40, same garage,
  // same openings on the ground floor. Nothing here is a new dimension, which
  // is the point: a 2 STOREY that quietly measured differently from the
  // 1 STOREY beside it on the same board would be the catalogue disagreeing
  // with itself.
  //
  // THE GARAGE STAYS SINGLE STOREY. Movie, same message: "make a single story
  // garage". The board's third 2-storey entry -- 2 STOREY + GARAGE + ROOM
  // OVER -- is the one where the floor reaches over it.
  //
  // AND THE ROOM GOES ON 2ND FL, NOT ON THE OVER-GARAGE LEVEL. That level
  // exists, it has id 4 and its own deeper joist, and it is the wrong one:
  // Movie, 19 Sep, asked directly -- "no it will be the '2 storey', the 'over
  // garage' layer is for bilevels when that would be a 'lower' 2nd floor",
  // then "this one is even with the 2nd floor so will be considered 2nd
  // floor". A half-level is for a room that sits half a storey off the floors
  // around it. This room is FLUSH with the storey above, so it is that
  // storey: more 2ND FL, on the level the house already has.
  //
  // WHICH IS WHY THIS ENTRY NEEDS NOTHING ADDED TO ANYBODY'S LEVEL STACK.
  // It was unserved for a while on the belief that it wanted level 4, and a
  // drawing has no level 4 by default -- so the tile built a house and a
  // garage and no room, and said nothing about the missing one.
  const twoStorey = ({ garage = false, overGarage = false } = {}) => ({
    house: houseLoop(),
    houseOpenings: houseOpenings(),
    upperOpenings: upperOpenings(),
    storeys: 2,
    // OVER THE HOUSE, AND OVER THE ROOM WHEN THERE IS ONE -- see
    // houseRoofLoop. The garage STUB is never in here: it is a storey lower,
    // and the valley between it and this roof is the cricket, still unbuilt.
    houseRoof: houseRoofLoop({ garage, storeys: 2, overGarage }),
    garage: garage ? garageLoop() : null,
    garageOpenings: garage ? garageOpenings() : null,
    // WHAT THE GARAGE'S OWN ROOF COVERS, which is the garage itself unless a
    // room sits on it -- see garageRoofLoop. Carried as its own loop rather
    // than left for the committer to work out, because the design is where
    // the room's length is decided and so it is where the leftover is known.
    garageRoof: garage ? garageRoofLoop({ overGarage }) : null,
    // WHICH OF ITS EDGES DIES INTO THE BUILDING BEHIND IT. Gabled and cut
    // flush -- no rake overhang -- because a roof that dies into a wall has
    // no eave there and no board to hang one on.
    garageRoofHouseEnd: garage ? GARAGE_ROOF_HOUSE_END : null,
    // THE ROOM OVER IS ITS OWN BODY, on its own level. It is not the garage
    // raised twice and not the upper storey stretched: level-assembly.js
    // gives the over-garage level its own role and a deeper joist, because a
    // garage spans clear and the 11 7/8" that draws perfectly over a bedroom
    // will not cross a double bay.
    overGarage: overGarage && garage ? overGarageLoop() : null,
    overGarageOpenings: overGarage && garage ? overGarageOpenings() : null,
    // AND NO ROOF OF ITS OWN, which is the other half of the splice above and
    // is said here rather than left to the committer to infer. The bungalow's
    // `garageRoof: null` is the same sentence about the same thing: a second
    // roof over a body already under the house's would sit INSIDE it -- a roof
    // under a roof, which is worse than the two hips meeting badly that this
    // replaces.
    //
    // ALWAYS NULL, and that is not a key doing nothing. It is the design
    // stating that this body is roofed by the house, so the page never has to
    // decide -- the same contract `garageRoof` keeps, and the reason the page
    // reads a LOOP rather than testing whether a room exists.
    overGarageRoof: null,
  });

  // `garage` is the ATTACHED one. A detached garage is a different body with
  // a different rule and it has its own module (garage-site.js); asking for
  // one here would be a second answer to a question already answered.
  const bungalow = ({ garage = false } = {}) => ({
    house: houseLoop(),
    houseOpenings: houseOpenings(),
    // SAID, NOT IMPLIED. A bungalow is one storey, and the committer reads
    // this number to know how many floor levels to raise the shell on --
    // leaving it out would make "absent" mean "one", which is the kind of
    // default that is right until the day something asks the question the
    // other way round.
    storeys: 1,
    garage: garage ? garageLoop() : null,
    garageOpenings: garage ? garageOpenings() : null,
    // ONE ROOF OVER BOTH, when there is a garage. Same storey, same plate,
    // same roof -- Movie's "like one large outline".
    houseRoof: houseRoofLoop({ garage, storeys: 1 }),
    // AND NO GARAGE ROOF OF ITS OWN, which is the other half of the same
    // sentence. A second roof over the garage would now sit INSIDE the
    // house's, which is worse than the two hips meeting badly that this
    // replaces: a roof under a roof.
    garageRoof: null,
  });

  // WHAT THE BOARD CAN ACTUALLY BUILD, keyed by build-menu.js entry id. A
  // caller asks this rather than testing entry ids itself, so the day 2 STOREY
  // gets a design the board does not also need editing. Movie, 18 Sep: "for 2
  // lets just do the bungalows and attached garages, the bilevel will be more
  // complex and need more work".
  const PLANS = Object.freeze({
    bungalow: () => bungalow({ garage: false }),
    'bungalow-garage': () => bungalow({ garage: true }),
    // build-menu.js's own entry ids, so the board needs no editing when a
    // design arrives. `twoStorey-over` is deliberately absent -- see the note
    // on twoStorey: the room over the garage wants the over-garage level.
    twoStorey: () => twoStorey({ garage: false }),
    'twoStorey-garage': () => twoStorey({ garage: true }),
    'twoStorey-over': () => twoStorey({ garage: true, overGarage: true }),
  });

  const planFor = entryId => (PLANS[entryId] ? PLANS[entryId]() : null);

  window.DraftPremadePlans = Object.freeze({
    WIDTH_FT, DEPTH_FT, GARAGE_WIDTH_FT, GARAGE_DEPTH_FT,
    GARAGE_PAST_FT, GARAGE_TIE_FT, OVER_GARAGE_LENGTH_FT,
    OVERHEAD_DOOR_WIDTHS_FT, GARAGE_ROOF_HOUSE_END,
    MAN_DOOR_WIDTH_FT, GARAGE_WINDOW_WIDTH_FT, GARAGE_DOOR_HEAD_FT,
    bungalow, twoStorey, planFor, detachedGarageOpenings,
    entryIds: () => Object.keys(PLANS),
  });
})();
}
