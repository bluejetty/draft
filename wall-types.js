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

  window.DraftWallTypes = Object.freeze({
    WALL_TYPES,
    LEGACY_WALL_TYPES,
    FOUNDATION_WALL_TYPE_IDS,
    EXTERIOR_WALL_TYPE_IDS,
  });
})();
}
