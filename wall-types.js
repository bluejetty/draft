// Wall assembly definitions shared by the Model Space and the LAYOUT sheets:
// totalIn is full assembly width in inches, centreline-based layers listed
// left→right (outside→inside); fill: 'stud'|'concrete'|'insulation'.
if (!window.DraftWallTypes) {
(() => {
  const WALL_TYPES = [
    { id:'stud_2x4',    label:'2×4 Stud  (3½")',   totalIn:3.5,   layers:[{in:3.5,   fill:'stud'}] },
    { id:'stud_2x6',    label:'2×6 Stud  (5½")',   totalIn:5.5,   layers:[{in:5.5,   fill:'stud'}] },
    // Basement wall insul at concrete — 2×4 SPF @ 24" O.C. held 2½" off the conc
    // wall, 5½" batt filling out to a ½" air space at the concrete, VB on the
    // warm side under ½" drywall; lines the concrete on the foundation PLAN.
    { id:'insulation_6', label:'Insul Wall  (6½")',   totalIn:6.5,   layers:[{in:2.5,   fill:'insulation'},{in:3.5, fill:'insulation'},{in:0.5, fill:'stud'}] },
    // A GUARDRAIL IS A WALL. Movie, 19 Sep: "lets consider a 'RAIL' a wall
    // type", and "any wall could be made into a 'RAIL'" -- so a pony wall is
    // a wall whose TYPE is this one, and needs no key of its own in the file.
    //
    // GUARDRAIL, NOT RAIL, and Movie drew the line himself on 20 Sep: "it
    // should be clarified as GUARDRAIL (typical 42" height) / to be not
    // confused with HANDRAIL which would be 3' height an accompany min one
    // side of a staircase". Two different things at two different heights,
    // and the short word fits both. `rail` is retired to the legacy table
    // below rather than deleted, so a drawing saved in the hours it existed
    // still opens. RD-DOCUMENTS/DEFINITIONS.md carries the distinction.
    //
    // 3 1/2" HERE IS THE THICKNESS, not the height -- the assembly is a 2x4,
    // and a guardrail's 42" is a HEIGHT, which lives on the wall as its top.
    // The two numbers sit one line apart in this table's labels and are not
    // the same kind of thing.
    //
    // A HELD DEFAULT, not a measurement. Movie named what is still open --
    // "we will need extra special 'properties' for the RAIL ... or Subwall
    // type maybe", and "will need walls with Ballusters specially made for
    // specialty rails". None of that is here. What is here is the ASSEMBLY,
    // so the type can be picked, stored and drawn while the rest is decided.
    //
    // IN NEITHER SPECIAL LIST, and that is the placement rather than an
    // omission: FOUNDATION_WALL_TYPE_IDS is what holds a house up and
    // EXTERIOR_WALL_TYPE_IDS is what PROJECT offers for its skin. A
    // guardrail is neither, so it lands in the framed group a drafter picks
    // from on a floor and nowhere else.
    { id:'guardrail',   label:'Guardrail  (3\u00bd")',   totalIn:3.5,   layers:[{in:3.5,   fill:'stud'}] },
    { id:'concrete_8',  label:'8" Concrete',         totalIn:8,     layers:[{in:8,     fill:'concrete'}] },
    { id:'icf',         label:'ICF  (11¼")',         totalIn:11.25, layers:[{in:2.625,fill:'insulation'},{in:6,fill:'concrete'},{in:2.625,fill:'insulation'}] },
    { id:'icf_13',      label:'ICF  (13¼")',         totalIn:13.25, layers:[{in:2.625,fill:'insulation'},{in:8,fill:'concrete'},{in:2.625,fill:'insulation'}] },
    { id:'pt_wood_fdn', label:'2×8 PT Wood Fdn  (8")', totalIn:8,   layers:[{in:0.75,fill:'stud'},{in:7.25,fill:'stud'}] },
  ];
  // Retired wall types in saved drawings map to their closest current assembly.
  // `rail` SHIPPED FOR A DAY under the short name and was clarified out of
  // it (Movie, 20 Sep, above). It maps to the name that survives, which is
  // exactly what this table is for.
  const LEGACY_WALL_TYPES = Object.freeze({ concrete_12: 'concrete_8', rail: 'guardrail' });
  // Structural assemblies live on the FOUNDATION layer set only; every other
  // context offers the stud / insul walls.
  const FOUNDATION_WALL_TYPE_IDS = Object.freeze(['concrete_8', 'icf', 'icf_13', 'pt_wood_fdn']);
  // The assemblies a house's exterior walls come in — what the PROJECT page
  // offers for the shared exterior type and its per-floor overrides. ICF runs
  // above grade too, so the two lists overlap without being each other.
  const EXTERIOR_WALL_TYPE_IDS = Object.freeze(['stud_2x4', 'stud_2x6', 'icf', 'icf_13']);

  // ── WHAT A WALL IS CLAD IN ────────────────────────────────────────────
  //
  // Movie, 26 Sep, dictating the list: *"1. STUCCO  2. V. SIDING  3. H.
  // SIDING (B&B)"*.
  //
  // A FINISH IS NOT AN ASSEMBLY, which is why it is its own table beside
  // WALL_TYPES rather than a column in it. An assembly is what the wall is
  // built of and how thick it is; a finish is what it wears. The same 2x6
  // stud wall takes any of these, and cut-view.js's `C.face` -- one palette
  // role standing in for "cladding" -- is what this replaces.
  //
  // EVERY ROW CARRIES A THICKNESS, and these three carry zero. Stucco is a
  // coat; siding and battens are three quarters of an inch of wood at the
  // butt, which at any scale this draws is nothing. So no wall face moves,
  // no foundation grows a ledge, no overhang is measured from a new line --
  // and every drawing in the repo renders exactly as it did.
  //
  // THE FIELD IS HERE ANYWAY because Movie said what is coming: *"the next
  // few will need to have thickness"*. A masonry finish stands its own
  // width off the sheathing plus an air gap, and wants a ledge under it to
  // carry that weight. Writing `thicknessIn` in now costs a word per row;
  // adding it once drawings are saved costs a migration.
  //
  // WHAT IT DOES NOT DO YET IS MOVE ANYTHING. Nothing reads this field, and
  // a non-zero one is not drawable until the ledge, the air gap and the face
  // offset are designed -- that is masonry's own piece of work, not a number
  // typed into a row. Said here so a later reader does not mistake a present
  // field for a working one.
  //
  // COLOUR IS NOT IN THIS TABLE EITHER. Movie: *"the 'color' of stucco might
  // not be white"*. Colour is orthogonal to material -- any of these comes in
  // any colour -- so it is a field on the FACE, and baking it in here would
  // mean a second finish for every colour anyone ever wanted.
  //
  // THE NUMBERS ARE DEFAULTS, NOT CONSTANTS. *"make default 4\" but allow
  // them to change it (then we don't need multiple types)"* -- so his 6" and
  // 8" vertical are this row with one field edited, and a 5" or a 12" costs
  // nothing later. What is fixed per row is the PATTERN; what varies is its
  // spacing.
  const EXTERIOR_FINISHES = Object.freeze([
    // Blank on purpose. A hatch earns its place by telling one material from
    // its neighbour, and stucco is the quiet background the others read
    // against -- hatch everything and an elevation is noise carrying no more
    // information than before.
    { id: 'stucco', label: 'Stucco', pattern: 'none', thicknessIn: 0,
      params: Object.freeze([]) },
    // ── VERTICAL SIDING IS BOARD AND BATTEN ────────────────────────────
    //
    // Movie, 27 Sep: *"i made a mistake in my Vertical Siding / Horizontal
    // siding (i got them mixed up 90 degrees)"*, *"switch the h and the v"*,
    // *"and change the style to the opposite directions"*.
    //
    // AND THE CORRECTION PUTS THE TRADE BACK THE RIGHT WAY UP. He had called
    // board and batten horizontal on 26 Sep and it was recorded as his --
    // "the drafter naming the finish is the one who owns what it means here"
    // -- which was the right instinct about WHOSE call it is and the wrong
    // answer to keep. B&B is boards standing UP with a narrow batten over
    // each joint; lap siding is what runs across. So vertical siding IS the
    // battened one, and horizontal siding is the plain lap.
    //
    // TWO WIDTHS, NOT ONE EXPOSURE, which is what separates this row from the
    // one below: a wide board with a narrow batten over each joint draws as a
    // PAIR of close lines at a wide interval, not as evenly spaced singles.
    { id: 'siding_v_bb', label: 'V. Siding (B&B)', pattern: 'batten', axis: 'vertical',
      thicknessIn: 0,
      params: Object.freeze([
        { key: 'boardIn', label: 'Board', in: 12 },
        { key: 'battenIn', label: 'Batten', in: 2 },
      ]) },
    // Lap siding: courses running across, one line per joint. Movie: *"make
    // default 4\" but allow them to change it (then we don't need multiple
    // types)"* -- so his 6" and 8" are this row with one field edited.
    // Courses run off the wall's FOOT, because that is where a sider starts,
    // and the odd course lands at the top the way it does on site.
    { id: 'siding_h', label: 'H. Siding', pattern: 'lines', axis: 'horizontal', thicknessIn: 0,
      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 4 }]) },
    // Movie: *"also CEDAR SHAKE - which is used for details sparingly for
    // some styles"*. SPARINGLY IS THE POINT, and it is why this row exists
    // rather than being folded into the siding above: shakes turn up in a
    // gable, a dormer cheek, a band under a window -- a PART of a face, not a
    // face. It is the material that proves a face needs more than one finish.
    //
    // STAGGERED, which is what tells it from lap siding at a glance: the
    // courses are the same idea but the joints between shakes wander, and a
    // ruled grid would read as panelling instead.
    // A SHAKE HAS A BUTT, which is Movie asking *"can we give the cedar ... a
    // texture with 1\" thickness?"*. A shake is split, not sawn: it is thick
    // at the bottom and thin at the top, each course laps the one below, and
    // the line a drafter draws at every course IS the shadow off that butt.
    // So it stands off the wall like masonry does and takes relief like
    // masonry does -- and is not masonry, which is the distinction the two
    // lists below are about.
    { id: 'shake', label: 'Cedar Shake', pattern: 'shake', axis: 'horizontal',
      thicknessIn: 1, relief: true,
      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 7 }]) },
    // ── THE STONES, WHICH ARE FOUR PATTERNS AND NOT ONE MATERIAL ────────
    //
    // Movie, 26 Sep: *"1 LEDGESTONE (stacked stone)  2. ASHLAR (rectangle
    // stone)  3. ROUNDSTONE  4. FIELDSTONE (odd shapes)"* -- his own glosses,
    // kept because they are what tells them apart on a sheet. Stacked thin
    // courses, squared coursed blocks, cobbles, and random rubble read
    // nothing like each other, so one STONE row with a "style" field would be
    // four painters hiding behind one id.
    //
    // THEY ARE THE FIRST ROWS WITH A THICKNESS, and it is not yet drawable.
    // See the note above: a face offset is masonry's own piece of work.
    //
    // VENEER, NOT FULL BED, and Movie settled it when asked which: *"we will
    // use vaneer stone but make the stone about 2\" thick and mortar 1\""*. The
    // difference is not decoration -- a full bed is 4" of stone on a 1" air
    // space and wants a LEDGE under it to carry the weight, which would put
    // this in the foundation as well as the elevation. A veneer hangs on the
    // wall, so what is left is two inches of face offset and no ledge at all.
    //
    // AND THE JOINT IS A PARAMETER, not a constant, because it is what the
    // relief below is measured against: a one inch mortar joint with the
    // stone standing two inches proud of the sheathing is a deep shadow, and
    // a drafter who wants it tighter changes the number rather than the row.
    //
    // ── AND THEY STAND PROUD OF THE JOINT, WHICH IS `relief` ────────────
    //
    // Movie: *"can we give these texture where the stone stuck out past the
    // mortor"*. That is the thing that makes stone read as stone: the unit
    // sits forward and the mortar is recessed behind it, so on an elevation
    // each stone throws a SHADOW rather than merely being outlined. Outline
    // it flat and the same pattern reads as a tile floor stood on end.
    //
    // ONE FLAG, NOT A DRAWING. `relief: true` says the units are proud of
    // their joints; which sides go dark is the painter's, and it takes the
    // convention every set uses -- light from the upper left, so the shadow
    // falls on the BOTTOM and the RIGHT of each unit. Written as a flag so
    // the four stones and the brick cannot each answer it differently.
    { id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',
      thicknessIn: 2, relief: true, masonry: true,
      cap: Object.freeze({ projectIn: 1, highIn: 2, drip: true }),
      params: Object.freeze([
        { key: 'courseIn', label: 'Course', in: 3 },
        { key: 'jointIn', label: 'Joint', in: 1 },
      ]) },
    { id: 'ashlar', label: 'Ashlar', pattern: 'ashlar', axis: 'horizontal',
      thicknessIn: 2, relief: true, masonry: true,
      cap: Object.freeze({ projectIn: 1, highIn: 2, drip: true }),
      params: Object.freeze([
        { key: 'stoneHighIn', label: 'Stone high', in: 8 },
        { key: 'stoneLongIn', label: 'Stone long', in: 16 },
        { key: 'jointIn', label: 'Joint', in: 1 },
      ]) },
    { id: 'roundstone', label: 'Roundstone', pattern: 'round', axis: 'horizontal',
      thicknessIn: 2, relief: true, masonry: true,
      cap: Object.freeze({ projectIn: 1, highIn: 2, drip: true }),
      params: Object.freeze([
        { key: 'stoneIn', label: 'Stone', in: 8 },
        { key: 'jointIn', label: 'Joint', in: 1 },
      ]) },
    // NO COURSE AND NO GRID: rubble laid to no line, which is what "odd
    // shapes" means and what separates it from the ashlar above. The one
    // number is a nominal size for the painter to scatter around.
    { id: 'fieldstone', label: 'Fieldstone', pattern: 'field', axis: 'horizontal',
      thicknessIn: 2, relief: true, masonry: true,
      cap: Object.freeze({ projectIn: 1, highIn: 2, drip: true }),
      params: Object.freeze([
        { key: 'stoneIn', label: 'Stone', in: 12 },
        { key: 'jointIn', label: 'Joint', in: 1 },
      ]) },
    // ── AND A WAINSCOT IS CAPPED, WHICH IS `cap` ───────────────────────
    //
    // Movie: *"we should put a ledge at the top of the stone that overhangs
    // the top of the stone"*. That is the WATER TABLE, and it is not trim: a
    // band of stone stopped partway up a wall is an open horizontal joint
    // facing the weather, and the cap oversails it so the water drips clear
    // of the face instead of running down behind it.
    //
    // IT OVERHANGS, so on an elevation the wall steps OUT at the cap and back
    // IN above -- which puts a shadow under the cap's nose, and that shadow
    // is the line that reads the whole detail at a glance. Projection is
    // measured past the STONE's face, not the sheathing, because the stone is
    // what it has to shed water clear of.
    //
    // ONLY WHERE THE BAND STOPS SHORT -- Movie's own qualifier, given in the
    // same breath: *"(if its not at top of wall)"*, *"at top of the wall
    // won't need a legde"*. A cap is the TERMINATION of a wainscot; stone
    // carried to the underside of the soffit has nothing to terminate and
    // takes none. That is the painter's test, not a field here, because it is
    // a fact about the BAND rather than about the material -- the same stone
    // is capped in one place and bare in another on one drawing.
    //
    // AND THE NOSE IS KERFED: Movie, naming it, *"drip edge"*. A projecting
    // cap without one is worse than no cap at all -- water follows the
    // underside back to the wall by surface tension and runs down the face it
    // was put there to protect. The groove breaks that path and the drop
    // falls clear.
    //
    // IT IS A SECTION DETAIL THAT ELEVATIONS INHERIT. What a drafter sees on
    // an elevation is the shadow under the nose, which the projection already
    // gives; the kerf itself shows where the cap is CUT. Carried as a flag
    // rather than a dimension because a drip is present or absent -- an eighth
    // of an inch of groove in one office and three sixteenths in the next
    // makes no difference to either drawing.
    //
    // THE NUMBERS ARE MINE, NOT MOVIE'S -- 1" of nose past a 2" stone and a
    // 2" course -- and they are defaults on a row, so a drafter who wants a
    // heavier cap sets two fields rather than waiting on a new material.

    // ── BRICK, WHICH IS THE ONE MASONRY THAT COMES IN A SIZE ───────────
    //
    // A stone is whatever the mason pulled off the pallet, which is why the
    // four above are drawn from a nominal size and scattered. A brick is a
    // MANUFACTURED unit: every one the same, laid to a bond, and its coursing
    // is arithmetic rather than character.
    //
    // MODULAR, WHICH IS NOT 8 BY 2. Movie asked: *"BRICK standard 8\"x 2\"? -
    // is this standard brick size?"* The length is right and the height is
    // not. A North American modular brick is 7 5/8" by 2 1/4" ACTUAL, laid
    // with a 3/8" joint: 8" long nominal, and 2 5/8" per COURSE.
    //
    // 2 5/8", NOT THE 2 2/3" THE TABLES PRINT, and the difference is worth
    // the line it takes. Modular brick is published as 4 x 2 2/3 x 8 nominal,
    // and 2 2/3 is where "three courses to eight inches" comes from -- but
    // 2 1/4 of brick plus a 3/8 joint is 2 5/8, and three of those come to
    // 7 7/8.
    //
    // AND NO STANDARD JOINT CLOSES THE GAP. The joint that would land three
    // courses on 8" is 8/3 - 2 1/4 = 5/12", which nobody lays; 7/16 overshoots
    // to 8 1/16. So "three to eight" is a rule of thumb with no exact joint
    // behind it, and a drawing that believed it would be an eighth out per
    // course and two inches by the top of a storey.
    //
    // SO THE UNIT AND THE JOINT ARE BOTH STORED and the coursing is their
    // sum, whatever that comes to. Storing the nominal instead would mean a
    // drafter editing the joint silently changed the brick.
    //
    // RUNNING BOND, the half-lap every other course, because it is what a
    // house is laid in unless somebody says otherwise. Stack, soldier and the
    // rest are bonds of the same unit rather than materials of their own, so
    // when they are wanted they are a field beside these and not new rows.
    { id: 'brick', label: 'Brick', pattern: 'brick', axis: 'horizontal',
      thicknessIn: 4.625, relief: true, masonry: true,
      cap: Object.freeze({ projectIn: 1, highIn: 2, drip: true }),
      params: Object.freeze([
        { key: 'brickLongIn', label: 'Brick long', in: 7.625 },
        { key: 'brickHighIn', label: 'Brick high', in: 2.25 },
        { key: 'jointIn', label: 'Joint', in: 0.375 },
      ]) },
  ]);
  // ── ONE LIST, AND MASONRY IS A PROPERTY ON A ROW ──────────────────────
  //
  // There was briefly a second list here, splitting the "special" finishes --
  // the ones with a thickness -- from the plain ones. Movie called it off the
  // moment he saw it: *"don't seperate the finishes"*. So a drafter is offered
  // ONE list, and what varies between its rows is what the rows say, not which
  // group they were filed under.
  //
  // MASONRY STAYS, BECAUSE IT IS NOT A GROUPING. It answers a detailing
  // question a painter has to ask -- does this have mortar joints to stand
  // proud of, and does a band of it need a capped, kerfed water table where it
  // stops -- and it is DECLARED on the row rather than inferred from
  // thickness. Inferred, it broke: it was read off `thicknessIn > 0` while
  // every thick finish happened to be stone or brick, and the moment cedar
  // shake took its 1" butt the checks began asking a shake for a mortar joint
  // and a stone ledge. A shake stands off the wall and is not masonry; it
  // terminates on a trim board.
  const MASONRY_FINISH_IDS = Object.freeze(
    EXTERIOR_FINISHES.filter(f => f.masonry === true).map(f => f.id));
  // ── AND THE TWO SIDINGS CHANGED NAMES WHEN THEY CHANGED PLACES ────────
  //
  // Movie clad walls with these before the 27 Sep correction, and an id that
  // no longer exists is DROPPED by drawing-format.js -- so without this a
  // wall he had sided would come back stucco with nothing anywhere saying
  // why. Mapped by ORIENTATION, which is what he actually chose and what he
  // actually saw: a wall picked as vertical stays vertical, and gets the
  // battens it should have had.
  const LEGACY_FINISH_IDS = Object.freeze({
    siding_v: 'siding_v_bb',
    siding_h_bb: 'siding_h',
  });
  const DEFAULT_FINISH_ID = 'stucco';
  const finishById = id => EXTERIOR_FINISHES.find(f => f.id === id)
    || EXTERIOR_FINISHES.find(f => f.id === LEGACY_FINISH_IDS[id])
    || EXTERIOR_FINISHES.find(f => f.id === DEFAULT_FINISH_ID);

  // ── WHAT A WALL WEARS, AND WHERE ──────────────────────────────────────
  //
  // A wall is not ONE finish. Movie, 26 Sep: *"i'd like to make it easy to for
  // instance choose the bottom 3 ft of a certain wall for LEDGESTONE"* -- so a
  // wall carries a BASE finish that covers it whole, and BANDS laid over that
  // base between two heights. Stone to 3 ft with stucco above is one band on a
  // default wall, which is the case this has to make cheap.
  //
  // A BAND IS A HEIGHT RANGE, NOT A RECTANGLE, and the difference is that a
  // range follows the wall. Stored as a rectangle in elevation space it would
  // be measured off whichever elevation the drafter happened to be looking at,
  // and moving the wall, or reading it on the other elevation, would leave the
  // stone behind. A range belongs to the wall, so both elevations agree and a
  // wall that moves takes its stone with it.
  //
  // MEASURED FROM THE BOTTOM OF THE WALL -- `lowFt: 0` is where the cladding
  // starts, which on a finished elevation is the top of the concrete. "The
  // bottom 3 ft" is then literally 0 to 3 and needs no arithmetic, and the
  // same band reads the same on a wall standing on a frost wall as on one
  // standing on a grade beam.
  //
  // LAST BAND WINS, which is paint order and not a rule to remember. A drafter
  // who puts stone up to 3 ft and then shake from 2 to 6 gets shake over the
  // top foot of the stone, the same as if they had drawn it that way, rather
  // than an error about an overlap they can see perfectly well.
  //
  // HALF OPEN, [low, high), so two bands stacked at the same number do not
  // fight over it: 0-3 and 3-6 meet at 3 with the upper one owning the line.
  const finishAtFt = (wall, ft) => {
    const bands = Array.isArray(wall?.finishBands) ? wall.finishBands : [];
    for (let i = bands.length - 1; i >= 0; i -= 1) {
      const band = bands[i];
      if (ft >= band.lowFt && ft < band.highFt) {
        return Object.freeze({ id: band.finishId, band,
          color: band.color || wall?.finishColor || null });
      }
    }
    return Object.freeze({ id: wall?.finish || DEFAULT_FINISH_ID, band: null,
      color: wall?.finishColor || null });
  };

  // EVERY FINISH ON A WALL, base first and bands in the order they were laid.
  // What a legend needs, and what a painter needs to know whether to set up a
  // pattern at all.
  const finishesOnWall = wall => Object.freeze([
    wall?.finish || DEFAULT_FINISH_ID,
    ...(Array.isArray(wall?.finishBands) ? wall.finishBands.map(b => b.finishId) : []),
  ].filter((id, i, all) => all.indexOf(id) === i));

  // ── AND WHETHER THE BAND IS CAPPED ────────────────────────────────────
  //
  // Movie gave the test himself, in the same breath as the ledge: *"(if its not
  // at top of wall)"*, *"at top of the wall won't need a legde"*. A water table
  // is the TERMINATION of a wainscot, so stone carried to the soffit has
  // nothing to terminate and takes none -- and that is a fact about the BAND,
  // not about the material, which is why `cap` on the row is a default and
  // this is the question a painter actually asks.
  //
  // THE BASE FINISH IS NEVER CAPPED, because it has no top to stop short at:
  // it runs the whole wall by definition. Only a band can end in mid air.
  const bandIsCapped = (band, wallHighFt) => {
    if (!band || !finishById(band.finishId)?.cap) return false;
    return Number.isFinite(wallHighFt) && band.highFt < wallHighFt - 1e-6;
  };

  window.DraftWallTypes = Object.freeze({
    WALL_TYPES,
    LEGACY_WALL_TYPES,
    FOUNDATION_WALL_TYPE_IDS,
    EXTERIOR_WALL_TYPE_IDS,
    EXTERIOR_FINISHES,
    MASONRY_FINISH_IDS,
    LEGACY_FINISH_IDS,
    DEFAULT_FINISH_ID,
    finishById,
    finishAtFt,
    finishesOnWall,
    bandIsCapped,
  });
})();
}
