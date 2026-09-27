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
    // Boards standing up, one line per joint. Courses run off a wall END,
    // because that is where a sider starts, and the odd board lands at the
    // far corner the way it does on site.
    { id: 'siding_v', label: 'V. Siding', pattern: 'lines', axis: 'vertical', thicknessIn: 0,
      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 4 }]) },
    // BOARD AND BATTEN, LAID HORIZONTAL, and that is Movie's own call --
    // asked whether he meant the usual vertical, he answered *"Board and
    // Batten is Horizontal siding"*. Recorded rather than corrected: the
    // drafter naming the finish is the one who owns what it means here.
    //
    // TWO WIDTHS, NOT ONE EXPOSURE, which is what separates it from the row
    // above: a wide board with a narrow batten over each joint draws as a
    // pair of close lines at a wide interval, not as evenly spaced singles.
    { id: 'siding_h_bb', label: 'H. Siding (B&B)', pattern: 'batten', axis: 'horizontal',
      thicknessIn: 0,
      params: Object.freeze([
        { key: 'boardIn', label: 'Board', in: 12 },
        { key: 'battenIn', label: 'Batten', in: 2 },
      ]) },
    // Movie: *"also CEDAR SHAKE - which is used for details sparingly for
    // some styles"*. SPARINGLY IS THE POINT, and it is why this row exists
    // rather than being folded into the siding above: shakes turn up in a
    // gable, a dormer cheek, a band under a window -- a PART of a face, not a
    // face. It is the material that proves a face needs more than one finish.
    //
    // STAGGERED, which is what tells it from lap siding at a glance: the
    // courses are the same idea but the joints between shakes wander, and a
    // ruled grid would read as panelling instead.
    { id: 'shake', label: 'Cedar Shake', pattern: 'shake', axis: 'horizontal',
      thicknessIn: 0,
      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 7 }]) },
  ]);
  const DEFAULT_FINISH_ID = 'stucco';
  const finishById = id => EXTERIOR_FINISHES.find(f => f.id === id)
    || EXTERIOR_FINISHES.find(f => f.id === DEFAULT_FINISH_ID);

  window.DraftWallTypes = Object.freeze({
    WALL_TYPES,
    LEGACY_WALL_TYPES,
    FOUNDATION_WALL_TYPE_IDS,
    EXTERIOR_WALL_TYPE_IDS,
    EXTERIOR_FINISHES,
    DEFAULT_FINISH_ID,
    finishById,
  });
})();
}
