// LOT SIZES, AND THE AUTOSITE RECTANGLE THEY LAY DOWN.
//
// Movie, 13 Oct, with a tier table ("Residential Lot Size Tiers (v2)"):
// "when they enter onto the SITE in the MODEL area or on layout area can you
// ask them to pick a size from this list or to enter their size information
// (if it rectangle) or tell them they will need to adjust the 'AUTOSITE' if
// it isn't square, manually adjust the 'approx sized rectangle version. they
// can click on points to break them" -- "just add the main ones so we can
// start drawing the site plans in too quickly".
//
// SO THIS MODULE IS THE TABLE AND THE RECTANGLE, AND NOTHING ELSE. Picking,
// drawing and editing belong to the pages; what lives here is the vocabulary
// they share, in the shape build-menu.js already uses for GARAGE_SIZES -- a
// frozen list of stock sizes, a lookup, and a parser for a typed pair that
// returns THE SAME SHAPE as a stock one. That last part is the whole trick:
// whoever lays the rectangle never asks which of the seven the drafter
// pressed.
//
// THE SITE IS AN OUTLINE, NOT A NEW KIND OF THING. The rectangle goes into
// `outlines` carrying `site: true`, so the point dragging, the vertex
// breaking and the undo that outlines already have are what a drafter adjusts
// an odd-shaped lot with -- which is exactly what Movie asked for, and is a
// feature nobody has to write. The flag is what keeps it OUT of the things
// that read outlines as buildings: auto-dims strings the house, areas counts
// floor area, and a lot line is neither.
if (!window.DraftLotSizes) {
(() => {
  // ── THE TIERS, IN MOVIE'S TABLE ───────────────────────────────────────
  //
  // FEET ARE THE TRUTH and metres are derived, because a lot drawn to one
  // set of numbers and labelled with another is a drawing that lies. The
  // app is imperial all the way down (LAYOUT's METRIC is greyed for the
  // same reason: an architectural scale ladder has no metric rungs).
  //
  // `character` is Movie's own column and is shown with the size, because
  // "45 x 120" means nothing to someone who has not drawn fifty of them and
  // "Standard suburban" does.
  const LOT_TIERS = Object.freeze([
    Object.freeze({ id: 'S', label: 'S', widthFt: 25, depthFt: 120, character: 'Narrow urban lot' }),
    Object.freeze({ id: 'M', label: 'M', widthFt: 35, depthFt: 120, character: 'Lean typical lot' }),
    Object.freeze({ id: 'L', label: 'L', widthFt: 45, depthFt: 120, character: 'Standard suburban' }),
    Object.freeze({ id: 'XL', label: 'XL', widthFt: 55, depthFt: 150, character: 'Generous' }),
    Object.freeze({ id: 'XXL', label: 'XXL', widthFt: 65, depthFt: 150, character: 'Large / estate-leaning' }),
    Object.freeze({ id: 'XXXL', label: 'XXXL', widthFt: 80, depthFt: 200, character: 'Estate' }),
  ]);

  // ── WHAT A TYPED LOT MAY BE ──────────────────────────────────────────
  //
  // The floor is a lot narrower than the narrowest tier because a laneway
  // or infill lot is a real thing and the tiers are a menu, not a rulebook.
  // The ceiling is where a "lot" stops being a lot and becomes acreage that
  // wants a different drawing altogether -- and, more practically, is where
  // a typo (2500 for 250) stops being plausible.
  const LOT_MIN_FT = 10;
  const LOT_MAX_FT = 1000;

  // ── FEET ARE STORED; THE DRAFTER MAY SPEAK EITHER ────────────────────
  //
  // Movie, 13 Oct, in three steps. The table came with a metric column; then
  // "ok use the FT side, don't worry about the metric"; then the rule that
  // settles it -- "our METRIC conversions will apply to it, or if the user
  // selects METRIC they can enter it in METRIC (switches to METRIC before
  // entering the data)".
  //
  // So METRIC IS A UNIT, NOT A SECOND SET OF LOTS. Feet are what is stored
  // and what the geometry is in, the way every other length in this app is;
  // the units switch decides what the tiles PRINT and what the two typed
  // fields MEAN. A drafter in METRIC types 13.7 and gets the same 45 foot
  // lot as the drafter who typed 45 -- one lot, said two ways, which is the
  // only arrangement where switching units cannot move a lot line.
  //
  // THE TIERS STAY IN FEET even on a metric screen, because they are a
  // menu of real lots ("a 45 foot lot" is what the lot IS), and converting
  // the menu would make six tidy numbers into six untidy ones. What the
  // metric drafter sees is the conversion beside them.
  const FT_PER_M = 3.280839895;
  const SQFT_PER_SQM = 10.763910417;

  const round1 = value => Math.round(value * 10) / 10;
  const metresOf = ft => round1(Number(ft) / FT_PER_M);
  const feetOfMetres = m => Number(m) * FT_PER_M;

  const areaSqFt = (widthFt, depthFt) => Math.round(widthFt * depthFt);

  // AND THE METRIC AREA IS THE SQUARE FEET CONVERTED, which disagrees with
  // half of Movie's own table and is deliberate.
  //
  // That table computes m² two ways: S, M and L are the square feet
  // converted (3,000 sq ft -> 279 m²), while XL, XXL and XXXL are the
  // ROUNDED metric dimensions multiplied (16.8 x 45.7 -> 768, where
  // converting 8,250 sq ft gives 766). No single rule reproduces all six
  // rows, so one had to be picked.
  //
  // THE CONVERSION WINS because it is the lot's actual area, and because
  // the other way rounds each side to a tenth of a metre and then
  // multiplies the error -- an area that changes when you change how you
  // print the sides. Against the table that moves XL to 766, XXL to 906 and
  // XXXL to 1,486; S, M and L were already conversions and do not move.
  const areaSqM = (widthFt, depthFt) =>
    Math.round(areaSqFt(widthFt, depthFt) / SQFT_PER_SQM);

  // Everything a page needs to print about a size, in the unit in force,
  // derived in one place so two pages cannot label the same lot
  // differently. `metric` is the units switch's answer, not a preference
  // of this module's.
  const describe = (size, { metric = false } = {}) => {
    if (!size) return null;
    const sqFt = areaSqFt(size.widthFt, size.depthFt);
    // THE SIZE IS THE NAME (Movie: "25X120, 35X150 etc"). The tier letter is
    // kept as a quiet second marker -- a drafter who has read the table
    // knows what L means -- but the dimensions are what the tile says,
    // because they are what he is choosing.
    //
    // A TYPED METRIC LOT IS NOT A ROUND NUMBER OF FEET, so the label is
    // trimmed rather than printed raw: 13.7 m is 44' 11", and a tile reading
    // "44.916666666666664X120.08333333333333" is not a tile. Whole feet stay
    // whole -- 45X120, not 45.0X120.0 -- which is every tier and every lot an
    // imperial drafter types.
    const trim = value => {
      const rounded = Math.round(Number(value) * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    };
    const imperial = `${trim(size.widthFt)}X${trim(size.depthFt)}`;
    const metricLabel = `${metresOf(size.widthFt).toFixed(1)}X${metresOf(size.depthFt).toFixed(1)}`;
    return Object.freeze({
      ...size,
      imperial,
      metric: metricLabel,
      sizeLabel: metric ? metricLabel : imperial,
      unitLabel: metric ? 'M' : 'FT',
      areaSqFt: sqFt,
      areaSqM: areaSqM(size.widthFt, size.depthFt),
      areaLabel: metric
        ? `${areaSqM(size.widthFt, size.depthFt).toLocaleString('en-US')} m\u00b2`
        : `${sqFt.toLocaleString('en-US')} sq ft`,
    });
  };

  const lotTierById = id => LOT_TIERS.find(tier => tier.id === id) || null;

  // A typed pair, checked and named, or null -- customGarageSize's shape and
  // its reason. `custom: true` is what tells a page it is showing a typed
  // lot rather than a pressed one; nothing else reads it.
  // A typed pair, checked and named, or null -- customGarageSize's shape and
  // its reason.
  //
  // WHAT IS TYPED IS IN THE UNIT IN FORCE, and is converted here, at the one
  // door typed lots come through. "Switches to METRIC before entering the
  // data" is Movie's description of the flow and also the contract: the
  // fields mean whatever the switch said when they were filled, and what
  // comes out of here is always feet. Converting anywhere later would mean a
  // page holding a number whose unit it has to remember.
  //
  // THE BOUNDS ARE CHECKED IN FEET, after the conversion, so a metric
  // drafter gets the same floor and ceiling as an imperial one rather than
  // one 3.28 times off.
  const customLotSize = (widthFt, depthFt, { metric = false } = {}) => {
    const raw = (value) => (metric ? feetOfMetres(value) : Number(value));
    const w = raw(widthFt);
    const d = raw(depthFt);
    const sane = value => Number.isFinite(value)
      && value >= LOT_MIN_FT && value <= LOT_MAX_FT;
    if (!sane(w) || !sane(d)) return null;
    // ROUNDED TO THE INCH, not left at the full conversion. 13.7 m is
    // 44.9475 ft, and a lot line stored to four decimals prints as 44'-11
    // 3/8" and dimensions as a number nobody typed. An inch is finer than
    // any lot is ever surveyed to on this page.
    // TYPED IN FEET AND INCHES IT KEEPS ITS SIXTEENTHS (Movie, 18 Oct: "895-2
    // 3/8" is a surveyed frontage): only a conversion is rounded to the inch.
    const toInch = value => (metric ? Math.round(value * 12) / 12 : Math.round(value * 192) / 192);
    return Object.freeze({
      id: 'custom', label: 'CUSTOM', widthFt: toInch(w), depthFt: toInch(d),
      character: 'Typed', custom: true,
    });
  };

  // A tier id, or a typed pair, resolved to one thing. Pages hold a chosen
  // id and two fields; this is the single place that turns those into a lot.
  const lotSizeFor = (id, widthFt, depthFt, { metric = false } = {}) => describe(
    id === 'custom' ? customLotSize(widthFt, depthFt, { metric }) : lotTierById(id),
    { metric });

  // ── THE RECTANGLE ────────────────────────────────────────────────────
  //
  // THE FRONTAGE LIES LEFT TO RIGHT AND THE DEPTH RUNS BACK, which is the
  // third answer this has had and the one the numbers force.
  //
  // Movie first corrected a portrait lot: "the wider side will be right to
  // left and narrow side up down", "the E1 and E3 elevations will show the
  // width and the E2 and E4 will show the LEngth". Asked which shape that
  // meant, he answered "the house was already that direction, i also wanted
  // the site in that direction (the front of the house and front of the site
  // face E1)".
  //
  // THE CONTENT OF THAT IS WHICH EDGE IS THE FRONT, not which side is longer.
  // Both the house and the lot FACE E1 -- the south edge, largest z -- and
  // that is what is kept. Laying the lot's LONGER side across the page as
  // well does not survive its own arithmetic: a 45X120 drawn 120 across is
  // 45 deep, and a 20' front setback in front of the premade bungalow's 40'
  // depth puts the back of the house 15 FEET BEYOND THE REAR LOT LINE, with
  // an 84' side yard beside it. Drawn 45 across and 120 back the same house
  // lands with a 4' left yard, a 9' right yard and 60' of rear yard, which is
  // the lot it is a plan of.
  //
  // So WIDTH IS FRONTAGE and runs on X; DEPTH runs back on Z, away from E1.
  // That is also how the tiers are quoted ("a 45 foot lot" is its frontage)
  // and how the typed fields are labelled, so one reading now serves all
  // three. A drafter whose lot really is wider than deep types it that way
  // and gets it; nothing is sorted behind his back.
  //
  // SETBACKS COME FROM placeLotFor, which is where Movie's 20' front and the
  // side rules live. This function is the rectangle alone, centred, and is
  // what gets used when there is no house to place it against.
  //
  // WOUND THE SAME WAY AS EVERY OTHER OUTLINE, clockwise in plan, so the
  // offset and area readers that assume a winding get the one they assume.
  // ── WHICH WAY THE LOT FACES ──────────────────────────────────────────
  //
  // Movie, 14 Oct: "the site is in the wrong position still - the front (25ft
  // side currently facing bottom E2) should rotate 90 so it faces E1 to the
  // right", and then the rule itself: "the front of the lot and the front of
  // the house should line up both facing E1".
  //
  // EVERYTHING HERE USED TO BE WRITTEN IN x AND z. The front was +z and the
  // left was -x, which is where E1 and E2 stand on a house NOBODY HAS TURNED
  // -- so the lot and the house agreed by coincidence rather than by rule.
  // cut-marks.js rotates the four marks by the drawing's `planTurn`, and the
  // HOUSE's own registration mark goes with them (tests/model-html-site-point:
  // "a turned house takes its target with it"). The lot did not, so one
  // quarter turn put the front of the lot 90 degrees off the front of the
  // house and the site datum on the wrong corner.
  //
  // READ FROM cut-marks, NOT RE-DERIVED. That file owns which side each mark
  // stands on and what a turn does to it; a second copy of that table here is
  // how the lot comes to disagree with the elevations it is drawn beside.
  // With no cut-marks loaded the untarned seats are used, which is exactly
  // what this module did before and keeps a page that has not got the module
  // drawing the same lot it always drew.
  const UNTURNED = Object.freeze({ front: Object.freeze({ x: 0, z: 1 }),
    left: Object.freeze({ x: -1, z: 0 }) });
  const lotAxes = (planTurn = 0) => {
    const CM = typeof window !== 'undefined' ? window.DraftCutMarks : null;
    if (!CM || typeof CM.eMarkDir !== 'function') return UNTURNED;
    const front = CM.eMarkDir('E1', planTurn);
    const left = CM.eMarkDir('E2', planTurn);
    return front && left ? { front, left } : UNTURNED;
  };
  // How far along a direction a point stands. The two axes are unit vectors
  // at right angles, so this is the whole of the arithmetic either way.
  const along = (pt, dir) => Number(pt.x) * dir.x + Number(pt.z) * dir.z;

  // THE RECTANGLE, LAID ON THOSE AXES. The FRONTAGE (`widthFt`, the 25 in a
  // 25 x 120) runs ACROSS the front, and the DEPTH runs back from it -- which
  // is what those two words have always meant and is now true whichever way
  // the house is turned. On an unturned house this is the same four points it
  // has always returned.
  const lotRectanglePoints = (widthFt, depthFt, { centerX = 0, centerZ = 0 } = {}, planTurn = 0) => {
    const w = Number(widthFt);
    const d = Number(depthFt);
    if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) return null;
    const { front, left } = lotAxes(planTurn);
    const at = (acrossHalf, backHalf) => ({
      x: centerX + left.x * acrossHalf + front.x * backHalf,
      z: centerZ + left.z * acrossHalf + front.z * backHalf,
    });
    // THE SAME WINDING AS BEFORE -- the outline is a closed loop and the
    // order is what gives it its inside.
    return [
      at(w / 2, -d / 2), at(-w / 2, -d / 2), at(-w / 2, d / 2), at(w / 2, d / 2),
    ];
  };

  // ── WHERE THE HOUSE SITS IN THE LOT (Movie, 13 Oct) ──────────────────
  //
  // The first version centred the lot on the house and said setbacks were a
  // zoning question not worth guessing. Movie answered the question instead:
  //
  //   "the house registration can be placed on the site plan so the distance
  //    is 20ft from the front registration SITE to the HOUSE registration
  //    (20 ft setback at front typical)"
  //
  //   "when first placed put it as far possible front (20ft default setback)
  //    and as far possible left - (4ft if windows) and if no windows ... it
  //    can be 2'6ft from the property line ... BUT - if the eave it 2ft, it
  //    has to stay 2ft from the property line so in most cases even with no
  //    windows the distance will be 4ft, unless the eave requested is less
  //    than 2ft"
  //
  // FRONT IS E1 AND LEFT IS E2, which is where the green site datum stands,
  // so "20 from the front mark to the house mark" and "as far left as the
  // side rule allows" are the two numbers that place the lot.
  const FRONT_SETBACK_FT = 20;
  // The two side minimums, and the eave's own clearance over the top of
  // them. A blank wall may come closer than a windowed one -- but the ROOF
  // may not, and the roof sticks out past the wall, which is why the eave
  // rule usually wins.
  const SIDE_SETBACK_WINDOWED_FT = 4;
  const SIDE_SETBACK_BLANK_FT = 2.5;
  const EAVE_CLEAR_FT = 2;

  // THE SIDE SETBACK IS THE LOOSER OF TWO RULES, not a choice between them.
  // A wall with no openings may stand 2'-6" off the line; its eave may not
  // come closer than 2'-0". With the usual 2' overhang that makes 4'-0"
  // whichever kind of wall it is, which is Movie's "in most cases even with
  // no windows the distance will be 4ft" -- and a 1' eave on a blank wall
  // gives 3', which is his "unless the eave requested is less than 2ft".
  const sideSetbackFt = ({ windowed = true, eaveFt = 2 } = {}) => {
    const wall = windowed ? SIDE_SETBACK_WINDOWED_FT : SIDE_SETBACK_BLANK_FT;
    const eave = (Number(eaveFt) || 0) + EAVE_CLEAR_FT;
    return Math.max(wall, eave);
  };

  // THE SITE'S OWN REGISTRATION MARK -- the green target (Movie: "the SITE
  // PLAN will need a seperate registration mark make it a GREEN TARGET - it
  // should be located at the corne were E1 and E2 are front and left side
  // corner").
  //
  // E1 STANDS ON THE SOUTH EDGE AND E2 ON THE WEST (cut-marks.js's
  // E_MARK_SIDES), so the corner they share is the one with the SMALLEST x
  // and the LARGEST z. Read off the outline's own points rather than stored,
  // so it follows the corner after a drafter has dragged the lot into an odd
  // shape -- which is the whole reason the lot is an outline.
  const siteDatumOf = (outline, planTurn = 0) => {
    const pts = (outline && Array.isArray(outline.points) ? outline.points : [])
      .filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)));
    if (!pts.length) return null;
    // THE CORNER WHERE E1 AND E2 MEET, asked of the axes rather than of x and
    // z. On an unturned house that is still the smallest x and the largest z,
    // which is what this did before; on his quarter-turned one E1 is east and
    // E2 is south, so it is the lower RIGHT corner -- "the 2 registration
    // marks will both be in the lower right corner of their respective (SITE
    // / HOUSE)", which comes out of the rule rather than being told to it.
    const { front, left } = lotAxes(planTurn);
    const far = dir => Math.max(...pts.map(p => along(p, dir)));
    const frontEdge = far(front);
    const leftEdge = far(left);
    // THE CORNER ITSELF WHERE THERE IS ONE. On a rectangle the two extremes
    // meet at a real corner; on a dragged outline they may not, and the mark
    // then stands at the point nearest that meeting -- which is still the
    // front-left of the lot, and still where the two elevations cross.
    let best = null, bestD = Infinity;
    pts.forEach(p => {
      const d = (along(p, front) - frontEdge) ** 2 + (along(p, left) - leftEdge) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    });
    return { x: Number(best.x), z: Number(best.z) };
  };

  // AND WHERE THE RECTANGLE GOES SO THE HOUSE LANDS ON THOSE SETBACKS.
  //
  // THE LOT MOVES, NOT THE HOUSE. The drafter has drawn or built a house and
  // is now being asked how big his lot is; answering that question must not
  // pick his building up and carry it twenty feet. Placing the rectangle
  // around him gives the same geometry on the sheet with nothing disturbed,
  // and every number below is the same number either way.
  //
  // `houseFront` is the house's front face (its largest z, since E1 is the
  // south side) and `houseLeft` its left face (smallest x). The datum is
  // what Movie measures the 20 from, so it is passed in and used for the
  // front; the left is measured off the WALL, because a setback is a
  // distance from the building to the line and the datum may sit anywhere.
  const placeLotFor = (widthFt, depthFt, house, opts = {}, planTurn = 0) => {
    const size = lotRectanglePoints(widthFt, depthFt, {}, planTurn);
    if (!size || !house) return size;
    const across = Number(widthFt);
    const up = Number(depthFt);
    const side = sideSetbackFt(opts);
    const { front, left } = lotAxes(planTurn);
    // ON THE SAME TWO AXES AS EVERYTHING ELSE HERE. `datumZ`/`frontZ`/`leftX`
    // are the names this took when front meant +z; what they have always been
    // is HOW FAR ALONG THE FRONT and HOW FAR ALONG THE LEFT, so they are read
    // that way and the turn costs nothing.
    // THE HOUSE'S FRONT-LEFT CORNER, projected onto the two axes. `leftX` and
    // `datumZ` are the names these took when the front WAS +z; what they have
    // always meant is the house's left face and its front, so the corner they
    // name is projected rather than read as raw x and z -- which is the same
    // two numbers on an unturned house and the right two on any other.
    const datumAt = Number(house.datumZ);
    const corner = {
      x: Number(house.leftX),
      z: Number.isFinite(datumAt) ? datumAt : Number(house.frontZ),
    };
    // FRONT: the front lot line sits 20 in front of the house datum.
    const frontAt = along(corner, front) + FRONT_SETBACK_FT;
    // LEFT: the left lot line sits `side` to the left of the house's left face.
    const leftAt = along(corner, left) + side;
    // Back from the front line by `up`, and across from the left line by
    // `across` -- the same rectangle, said in the lot's own directions.
    const at = (backBy, acrossBy) => ({
      x: front.x * (frontAt - backBy) + left.x * (leftAt - acrossBy),
      z: front.z * (frontAt - backBy) + left.z * (leftAt - acrossBy),
    });
    return [at(up, 0), at(up, across), at(0, across), at(0, 0)];
  };

  // ── IS THE LOT BIG ENOUGH FOR WHAT IS ALREADY DRAWN? ─────────────────
  //
  // Movie, 14 Oct, after an AUTOSITE 25 x 120 came up under a 30 ft garage:
  // "oh i guess my site was too narrow for the garage - when the site comes
  // up can it figure out the house width and not allow lots that are too
  // small from the selections (allow them to create any size they would like
  // if they enter data and draw the site" -- then the number itself: "for
  // that 30 for garage with 2ft overhangs would be min 38 min".
  //
  // HIS 38 IS THIS MODULE'S OWN ARITHMETIC, which is why no new constant
  // appears here: 30 ft of wall, plus a side setback at each side, and the
  // side setback is already max(wall rule, eave + 2) -- a 2 ft eave gives 4 ft
  // a side, and 30 + 4 + 4 is 38. The rule was written for where the house
  // SITS in the lot; asking it for the smallest lot the house fits on is the
  // same question from the other end.
  //
  // DEPTH IS ASKED TOO, with no rear setback invented: a lot has to hold the
  // house behind the 20 ft front setback, so front + depth is the floor. A
  // rear yard is a zoning number nobody has given, and guessing one would
  // fade out lots that are legal.
  const minLotFor = (house, opts = {}) => {
    const w = house ? Number(house.widthFt) : NaN;
    const d = house ? Number(house.depthFt) : NaN;
    if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) return null;
    return { widthFt: w + 2 * sideSetbackFt(opts), depthFt: FRONT_SETBACK_FT + d };
  };

  // A SIZE AGAINST THAT FLOOR. Anything shaped like a stock tier or a typed
  // pair answers, which is the trick lotSizeFor already plays and the reason
  // the pages never ask which of the two they are holding.
  //
  // NOTHING DRAWN MEANS EVERYTHING FITS (Movie, 14 Oct: "if no house drawn
  // all would be allowed nothing lighten up"), so a drawing with no building
  // gets the plain list it had before any of this.
  const lotFitsHouse = (size, house, opts = {}) => {
    const min = minLotFor(house, opts);
    if (!min || !size) return true;
    return Number(size.widthFt) >= min.widthFt - 1e-9
      && Number(size.depthFt) >= min.depthFt - 1e-9;
  };

  // AND THE ONE TO POINT AT (Movie, 14 Oct: "make the most appropriate size
  // brighter (first size to fit)"). The tiers run smallest to biggest, so the
  // first that fits is the smallest that does -- the cheapest land that holds
  // his building, which is what "most appropriate" means to someone buying
  // it. Null where there is nothing to be appropriate TO, and null again
  // where the building outgrows the whole table: there the honest answer is
  // that he will be typing his own size, not that the biggest tier is right.
  const bestLotTierFor = (house, opts = {}) => {
    if (!minLotFor(house, opts)) return null;
    return LOT_TIERS.find(tier => lotFitsHouse(tier, house, opts)) || null;
  };

  // THE WHOLE BUILDING AS A BOX, which is what the two rules above measure
  // against. houseFaceOf below answers the two FACES the lot is placed off;
  // this answers the footprint's own size. Same filter, same reason: an
  // outline is what a building IS on this page, and `site` is the flag that
  // says this one is the lot.
  // ── THE BUILDING'S WIDTH IS ITS WIDTH ACROSS THE FRONT ────────────────
  //
  // Movie, 16 Oct, with a bungalow and garage turned a quarter on its site:
  // "it selected a site plan not wide enough this time". The card had read
  // the house 32 wide along x and offered the 45 ft lot -- and the lot,
  // laid on the TURNED axes (lotAxes), put its 45 ft of frontage along z,
  // where that house runs 50. The house hung out the side of its own lot.
  //
  // So the box is measured on the lot's own axes: `widthFt` is the extent
  // ACROSS the front (along E2, the left mark) and `depthFt` the extent BACK
  // from it (along E1), whichever way the plan is turned. On an unturned
  // plan these are the x and z extents they always were. The raw corners
  // stay for the callers that place things on an unturned plan.
  const houseBoxOf = (outlines, planTurn = 0) => {
    const pts = (Array.isArray(outlines) ? outlines : [])
      .filter(outline => outline && outline.site !== true && Array.isArray(outline.points))
      .flatMap(outline => outline.points)
      .filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)));
    if (!pts.length) return null;
    const xs = pts.map(p => Number(p.x));
    const zs = pts.map(p => Number(p.z));
    const leftX = Math.min(...xs), rightX = Math.max(...xs);
    const backZ = Math.min(...zs), frontZ = Math.max(...zs);
    const { front, left } = lotAxes(planTurn);
    const extent = dir => Math.max(...pts.map(p => along(p, dir))) - Math.min(...pts.map(p => along(p, dir)));
    return { leftX, rightX, backZ, frontZ, widthFt: extent(left), depthFt: extent(front) };
  };

  // The house as those two numbers, off the outlines that are not the lot.
  const houseFaceOf = outlines => {
    const pts = (Array.isArray(outlines) ? outlines : [])
      .filter(outline => outline && outline.site !== true && Array.isArray(outline.points))
      .flatMap(outline => outline.points)
      .filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)));
    if (!pts.length) return null;
    return {
      leftX: Math.min(...pts.map(p => Number(p.x))),
      frontZ: Math.max(...pts.map(p => Number(p.z))),
    };
  };

  // The middle of whatever is already drawn, for the centring above: every
  // outline's points, or null when there is nothing to centre on. Walls are
  // deliberately not read -- an outline is what a building IS on this page,
  // and a drawing with walls but no outline is one the board did not raise.
  const centreOfOutlines = outlines => {
    const pts = (Array.isArray(outlines) ? outlines : [])
      .filter(outline => outline && outline.site !== true && Array.isArray(outline.points))
      .flatMap(outline => outline.points)
      .filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)));
    if (!pts.length) return null;
    const xs = pts.map(p => Number(p.x));
    const zs = pts.map(p => Number(p.z));
    return {
      centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
      centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
    };
  };

  // Does this drawing already have a lot? The question both pages ask before
  // deciding whether to put the picker up, and it is asked HERE so neither
  // can answer it with a different filter.
  const siteOutlineOf = outlines => (Array.isArray(outlines) ? outlines : [])
    .find(outline => outline && outline.site === true) || null;

  // ── AND THE SENTENCE ABOUT ODD SHAPES ────────────────────────────────
  //
  // Movie: "tell them they will need to adjust the 'AUTOSITE' if it isn't
  // square". It lives here rather than in the two pages that say it, for
  // the reason every other shared string does: two copies drift.
  const AUTOSITE_NOTE = 'AUTOSITE draws a rectangle this size. '
    + 'If your lot is not a rectangle, drag its corners to suit — '
    + 'and click an edge to break in a new point where you need one.';

  window.DraftLotSizes = Object.freeze({
    LOT_TIERS,
    LOT_MIN_FT,
    LOT_MAX_FT,
    AUTOSITE_NOTE,
    describe,
    metresOf,
    feetOfMetres,
    lotTierById,
    customLotSize,
    lotSizeFor,
    lotRectanglePoints,
    centreOfOutlines,
    FRONT_SETBACK_FT,
    SIDE_SETBACK_WINDOWED_FT,
    SIDE_SETBACK_BLANK_FT,
    EAVE_CLEAR_FT,
    sideSetbackFt,
    minLotFor,
    lotFitsHouse,
    bestLotTierFor,
    houseBoxOf,
    siteDatumOf,
    lotAxes,
    placeLotFor,
    houseFaceOf,
    siteOutlineOf,
  });
})();
}
