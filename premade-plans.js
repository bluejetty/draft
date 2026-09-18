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

  // `garage` is the ATTACHED one. A detached garage is a different body with
  // a different rule and it has its own module (garage-site.js); asking for
  // one here would be a second answer to a question already answered.
  const bungalow = ({ garage = false } = {}) => ({
    house: houseLoop(),
    garage: garage ? garageLoop() : null,
  });

  // WHAT THE BOARD CAN ACTUALLY BUILD, keyed by build-menu.js entry id. A
  // caller asks this rather than testing entry ids itself, so the day 2 STOREY
  // gets a design the board does not also need editing. Movie, 18 Sep: "for 2
  // lets just do the bungalows and attached garages, the bilevel will be more
  // complex and need more work".
  const PLANS = Object.freeze({
    bungalow: () => bungalow({ garage: false }),
    'bungalow-garage': () => bungalow({ garage: true }),
  });

  const planFor = entryId => (PLANS[entryId] ? PLANS[entryId]() : null);

  window.DraftPremadePlans = Object.freeze({
    WIDTH_FT, DEPTH_FT, GARAGE_WIDTH_FT, GARAGE_DEPTH_FT,
    GARAGE_PAST_FT, GARAGE_TIE_FT,
    bungalow, planFor,
    entryIds: () => Object.keys(PLANS),
  });
})();
}
