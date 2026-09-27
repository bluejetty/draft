// ROOFING MATERIALS, and what a drawing has to know about each.
//
// Movie, 27 Sep: *"we should make a special ROOF area with the roof corners in
// there and the ROOFING TYPE 1. ASPHALT/FIBERGLASS  2. PRE-FINISHED METAL
// (PFM) vertical  3. CEDAR SHAKE  4. TERRA-COTTA.... can you think of any main
// roofing types people use that i'm missing. (i don't have flat roofs but can
// add those later - Membrane roof, Asphalt Roll-on Roofing etc"*, and then, on
// the list that came back: *"All 10"*.
//
// A SEPARATE TABLE FROM THE WALL FINISHES, though it is the same shape. Nothing
// on this list can clad a wall and nothing on that one can shed water off a
// slope; a single table with a `where` field would be two vocabularies sharing
// one namespace, and the first wrong pick would be a stucco roof drawn without
// complaint. The SHAPE is deliberately the same, because the two are read the
// same way -- an id, a label, a pattern to draw it with, and the parameters a
// drafter changes rather than a new row.
//
// ── PITCHED ONLY, WHICH IS HIS PARENTHESIS ────────────────────────────────
//
// *"i don't have flat roofs but can add those later - Membrane roof, Asphalt
// Roll-on Roofing etc"*. So membrane, torch-on and tar-and-gravel are absent
// rather than stubbed: a row that cannot be drawn on any roof this app makes
// is a row that teaches the table a shape it does not have. They are named
// here so the day they arrive is a row and not an argument.
if (!window.DraftRoofTypes) {
(() => {
  // ── WHAT EACH ROW CARRIES ───────────────────────────────────────────────
  //
  // `pattern` is what the painter draws, and the ten rows share SEVEN of them
  // -- which is the fact that makes ten rows affordable. The market has ten
  // materials and seven pictures: courses of tabs, vertical seams, vertical
  // ribs, a large pressed panel, a lapped butt, a barrel, and a small flat
  // unit in a broken bond.
  //
  // SEVEN AND NOT SIX, which is worth recording because the first draft of
  // this comment said six and the check written beside it went red on the
  // table it was describing. The pair that will not merge is the pressed metal
  // PANEL and the SLATE: both are flat units, and they are a two-foot regular
  // grid against a foot-wide staggered course with a shadow under every tail.
  // Drawn with one painter, a metal roof reads as slate at four times the
  // weight.
  //
  // `weightPsf` IS NOT DECORATION. It is the one number on this list with a
  // structural consequence: slate and tile are four times the load of asphalt,
  // which is the difference between a truss you can buy and a truss somebody
  // has to design. It is carried now, while the table is being written, rather
  // than added the day a specification page wants it -- because the value per
  // row is a thing to look up once and the shape of the table is a thing to
  // argue about forever.
  //
  // `relief` follows the JOINT and not the thickness, exactly as it does in
  // the wall finish table: a material with a visible edge standing proud of
  // the course below it throws a shadow a drafter draws. A shake has a butt, a
  // slate has a tail, a tile has a roll. Asphalt lies flat, a standing seam IS
  // the relief and the painter draws it as a line, and a pressed metal shingle
  // is a crease rather than an edge.
  const ROOFING_TYPES = Object.freeze([
    // ── THE ONE ON NINE HOUSES IN TEN ─────────────────────────────────────
    //
    // ASPHALT AND FIBERGLASS ARE ONE ROW, which is Movie's own pairing:
    // "ASPHALT/FIBERGLASS". They are the same shingle with a different mat --
    // organic felt or glass -- and organic has not been made in North America
    // for years. Two rows would be a distinction a drafter cannot act on.
    //
    // THE EXPOSURE IS 5 5/8", which is the laminated ("architectural") shingle
    // that is now the default; a three-tab is 5" and is the same row with the
    // number changed, which is what a parameter is for.
    { id: 'asphalt', label: 'Asphalt / Fibreglass', pattern: 'tab',
      weightPsf: 2.5, relief: false,
      params: Object.freeze([
        { key: 'exposureIn', label: 'Exposure', in: 5.625 },
        { key: 'tabIn', label: 'Tab', in: 12 },
      ]) },

    // ── THE THREE METALS, WHICH ARE THREE PICTURES ────────────────────────
    //
    // Movie named one: "PRE-FINISHED METAL (PFM) vertical". That is the
    // standing seam -- a flat pan with a raised seam up the slope every foot
    // and a bit -- and it is what an architect means by a metal roof.
    //
    // THE OTHER TWO ARE NOT VARIANTS OF IT. Corrugated is an exposed-fastener
    // panel whose ribs run at a few inches rather than a few feet, and a
    // pressed metal SHINGLE is a unit, drawn as a grid. On a sheet at any
    // scale the three read as: wide seams, close ribs, and a tile pattern.
    // Folding them into one row with a "profile" field would be three painters
    // hiding behind one id, which is the ruling the four stones already made.
    { id: 'pfm_vertical', label: 'Pre-Finished Metal (PFM)', pattern: 'seam',
      weightPsf: 1.5, relief: true,
      params: Object.freeze([
        { key: 'panIn', label: 'Pan', in: 16 },
        { key: 'seamIn', label: 'Seam', in: 1.5 },
      ]) },
    // THE AG PANEL, which is on every shop, every detached garage and a good
    // many houses now. 7.2" and 9" covers are both common; the number is the
    // parameter and 9" is the one a drafter sees most.
    { id: 'corrugated', label: 'Corrugated Metal', pattern: 'rib',
      weightPsf: 1.2, relief: true,
      params: Object.freeze([{ key: 'ribIn', label: 'Rib spacing', in: 9 }]) },
    // PRESSED STEEL OR ALUMINIUM IN A UNIT PROFILE -- shingle, shake or tile.
    // It is the hail answer in this market: the look of a tile roof at a metal
    // roof's weight, which is why it earns a row rather than a note.
    { id: 'metal_shingle', label: 'Metal Shingle / Tile', pattern: 'panel',
      weightPsf: 1.6, relief: false,
      params: Object.freeze([
        { key: 'exposureIn', label: 'Exposure', in: 15 },
        { key: 'widthIn', label: 'Width', in: 24 },
      ]) },

    // ── THE THREE THAT ARE DRAWN AS A LAPPED BUTT ─────────────────────────
    //
    // A SHAKE IS SPLIT AND A SHINGLE IS SAWN, which is the whole difference
    // and it is a difference you can see at twenty feet: a shake is thick,
    // irregular and laid at a long exposure, a shingle is thin, even and laid
    // at half of it. The wall table already carries the same distinction for
    // the same reason, and its `shake` pattern is the one that draws this.
    { id: 'cedar_shake', label: 'Cedar Shake', pattern: 'shake',
      weightPsf: 3, relief: true,
      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 10 }]) },
    { id: 'wood_shingle', label: 'Wood Shingle', pattern: 'shake',
      weightPsf: 2.5, relief: true,
      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 5 }]) },
    // THE RUBBER ONE. Recycled-tyre and polymer shakes are ordinary here --
    // hail country buys them for the impact rating and gets a cedar roof that
    // does not burn. It is a SEPARATE ROW and not a colour of cedar, because a
    // specification that cannot tell them apart cannot price either.
    //
    // ITS COURSES ARE STRAIGHTER, which is how it is told from cedar on a
    // drawing: it is moulded off a mould, so the butts line up in a way split
    // cedar never does. That is the exposure and the painter, not a flag.
    { id: 'composite_shake', label: 'Composite Shake', pattern: 'shake',
      weightPsf: 2.2, relief: true,
      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 9 }]) },

    // ── THE TWO TILES, AND THEY ARE THE SAME PICTURE ──────────────────────
    //
    // Movie named the clay one: "TERRA-COTTA". Concrete is the same profile in
    // the cheaper, heavier material, and it outsells clay several times over
    // wherever either is used. They draw identically -- a barrel -- so the row
    // exists for the SPECIFICATION and not for the painter: same pattern,
    // different weight and different price.
    { id: 'terracotta', label: 'Terra-Cotta Tile', pattern: 'barrel',
      weightPsf: 9.5, relief: true,
      params: Object.freeze([
        { key: 'exposureIn', label: 'Exposure', in: 13 },
        { key: 'coverIn', label: 'Cover width', in: 13 },
      ]) },
    { id: 'concrete_tile', label: 'Concrete Tile', pattern: 'barrel',
      weightPsf: 10.5, relief: true,
      params: Object.freeze([
        { key: 'exposureIn', label: 'Exposure', in: 14 },
        { key: 'coverIn', label: 'Cover width', in: 13 },
      ]) },

    // ── AND THE HEAVY ONE ─────────────────────────────────────────────────
    //
    // Natural slate, and the synthetic slates that copy it draw the same way.
    // The heaviest thing on the list by a wide margin, which is the fact the
    // `weightPsf` column exists to carry: a house re-roofed in slate is a
    // house whose framing somebody checked.
    { id: 'slate', label: 'Slate', pattern: 'slate',
      weightPsf: 9, relief: true,
      params: Object.freeze([
        { key: 'exposureIn', label: 'Exposure', in: 7.5 },
        { key: 'widthIn', label: 'Width', in: 12 },
      ]) },
  ]);

  // ASPHALT IS THE DEFAULT, because it is what is on the roof unless somebody
  // says otherwise -- the same reasoning that makes stucco the wall default.
  const DEFAULT_ROOFING_ID = 'asphalt';

  // THE HEAVY ONES, named once. Anything over about 6 psf is outside what a
  // stock truss is designed for, so this is the list a specification page asks
  // for rather than re-deriving a threshold nobody wrote down. The flag lives
  // here and not on the row for the reason `masonry` does in the wall table:
  // one place to disagree is no places to disagree.
  const HEAVY_ROOFING_PSF = 6;
  const HEAVY_ROOFING_IDS = Object.freeze(ROOFING_TYPES
    .filter(r => r.weightPsf >= HEAVY_ROOFING_PSF).map(r => r.id));

  // AN UNKNOWN ID ANSWERS THE DEFAULT, not nothing. A roof carrying a material
  // this build has never heard of is still a roof, and a painter handed null
  // draws a hole. Same bargain as finishById, and made for the same reason: a
  // file from a later version has to open here.
  const roofingById = id => ROOFING_TYPES.find(r => r.id === id)
    || ROOFING_TYPES.find(r => r.id === DEFAULT_ROOFING_ID);

  // ── THE CORNER, WHICH IS NOT A MATERIAL ─────────────────────────────────
  //
  // Movie, 27 Sep: *"we should make a special ROOF area with the roof corners
  // in there"*, and earlier, on where they are set: *"we will want to be able
  // to change those in the elevation views"*, and *"allow them to change each
  // iduvidually, don't worry about changing all"*.
  //
  // THE NAMES ARE ALREADY DECIDED and they live in profile-manager.js, which
  // is the office standard: flat, return, porkchop, boxed. They are NOT copied
  // here. What this file adds is the rule that a ROOF may override the office,
  // which is his "individually" -- so the answer for one roof is its own style
  // if it has named one and the office's if it has not.
  //
  // READ THROUGH A FUNCTION rather than off the record, because "not set" and
  // "set to the same thing the office says" have to stay different: the first
  // follows the office when the standard changes and the second does not, and
  // that is the whole of what per-roof control means.
  const cornerStyleOf = (roof, officeStyle, styles = []) => {
    const own = roof && typeof roof.gableCorner === 'string' ? roof.gableCorner : null;
    if (own && styles.includes(own)) return own;
    return styles.includes(officeStyle) ? officeStyle : (styles[0] || null);
  };

  // WHAT A LEGEND PRINTS for one drawing: every roofing material actually on
  // it, once each, in table order. Table order and not first-seen order, so
  // two drawings with the same roofs print the same legend whatever sequence
  // the roofs were drawn in.
  const roofingsInUse = roofs => {
    const asked = new Set((Array.isArray(roofs) ? roofs : [])
      .map(roof => roofingById(roof?.roofing).id));
    return ROOFING_TYPES.filter(r => asked.has(r.id)).map(r => r.id);
  };

  window.DraftRoofTypes = Object.freeze({
    ROOFING_TYPES,
    DEFAULT_ROOFING_ID,
    HEAVY_ROOFING_PSF,
    HEAVY_ROOFING_IDS,
    roofingById,
    cornerStyleOf,
    roofingsInUse,
  });
})();
}
