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
    { id:'concrete_8',  label:'8" Concrete',         totalIn:8,     layers:[{in:8,     fill:'concrete'}] },
    { id:'icf',         label:'ICF  (11¼")',         totalIn:11.25, layers:[{in:2.625,fill:'insulation'},{in:6,fill:'concrete'},{in:2.625,fill:'insulation'}] },
    { id:'icf_13',      label:'ICF  (13¼")',         totalIn:13.25, layers:[{in:2.625,fill:'insulation'},{in:8,fill:'concrete'},{in:2.625,fill:'insulation'}] },
    { id:'pt_wood_fdn', label:'2×8 PT Wood Fdn  (8")', totalIn:8,   layers:[{in:0.75,fill:'stud'},{in:7.25,fill:'stud'}] },
  ];
  // Retired wall types in saved drawings map to their closest current assembly.
  const LEGACY_WALL_TYPES = Object.freeze({ concrete_12: 'concrete_8' });
  // Structural assemblies live on the FOUNDATION layer set only; every other
  // context offers the stud / insul walls.
  const FOUNDATION_WALL_TYPE_IDS = Object.freeze(['concrete_8', 'icf', 'icf_13', 'pt_wood_fdn']);

  window.DraftWallTypes = Object.freeze({
    WALL_TYPES,
    LEGACY_WALL_TYPES,
    FOUNDATION_WALL_TYPE_IDS,
  });
})();
}
