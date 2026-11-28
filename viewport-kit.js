// VIEWPORT KIT: what a sheet's viewport is set with, shared by the two sheet
// pages. CONSTRUCTION LAYOUT (LAYOUT.html) wrote these first, inline; the
// REAL ESTATE PLAN (jb, 28 Nov 2026: "can we make these viewports so the user
// can place them and add or delete more ... double click the floor plans to
// change scale and layers") asks the same two questions of its own plans, so
// the answers moved here and both pages read the one copy. A scale added to
// the list, or a layer row added to SHOW LAYERS, reaches both sheets at once.
//
// Pure data and two string helpers: no DOM, no drawing, nothing to load first.
(() => {
  // ARCHITECTURAL SCALES, label and paper inches per FOOT (pif).
  const SCALES = Object.freeze([
    { label: '1/16" = 1\'-0"', pif: 1 / 16 },
    { label: '3/32" = 1\'-0"', pif: 3 / 32 },
    { label: '1/8" = 1\'-0"', pif: 1 / 8 },
    { label: '3/16" = 1\'-0"', pif: 3 / 16 },
    { label: '1/4" = 1\'-0"', pif: 1 / 4 },
    { label: '3/8" = 1\'-0"', pif: 3 / 8 },
    { label: '1/2" = 1\'-0"', pif: 1 / 2 },
    { label: '3/4" = 1\'-0"', pif: 3 / 4 },
    { label: '1" = 1\'-0"', pif: 1 },
    // THE ENGINEER'S SCALES, for the site plan (Movie, 16 Oct: "when the lots
    // are larger i may have problems"): 1" = 10' up to 1" = 500' for an
    // acreage. pif is paper inches per FOOT, so 1" = 10' is 1/10.
    { label: '1" = 10\'', pif: 1 / 10 },
    { label: '1" = 20\'', pif: 1 / 20 },
    { label: '1" = 30\'', pif: 1 / 30 },
    { label: '1" = 40\'', pif: 1 / 40 },
    { label: '1" = 50\'', pif: 1 / 50 },
    { label: '1" = 60\'', pif: 1 / 60 },
    { label: '1" = 80\'', pif: 1 / 80 },
    { label: '1" = 100\'', pif: 1 / 100 },
    { label: '1" = 200\'', pif: 1 / 200 },
    { label: '1" = 300\'', pif: 1 / 300 },
    { label: '1" = 400\'', pif: 1 / 400 },
    { label: '1" = 500\'', pif: 1 / 500 },
  ].map(s => Object.freeze(s)));

  // A SCALE'S NAME, for any pif: the list's own label when it is on the list,
  // else one written the way the list writes its two kinds -- an engineer's
  // "1\" = N'" when a whole number of feet goes to the inch, an architect's
  // "x\" = 1'-0\"" otherwise. A scale typed into CHANGE SCALE? is named too.
  const scaleLabelOf = pif => {
    if (!(pif > 0)) return '';
    const listed = SCALES.find(s => Math.abs(s.pif - pif) < 1e-9);
    if (listed) return listed.label;
    const feet = 1 / pif;
    if (feet >= 1 && Math.abs(feet - Math.round(feet)) < 1e-6) return `1" = ${Math.round(feet)}'`;
    for (const den of [2, 4, 8, 16, 32, 64]) {
      const num = pif * den;
      if (Math.abs(num - Math.round(num)) < 1e-6) {
        const n = Math.round(num);
        const whole = Math.floor(n / den), rest = n % den;
        const g = (a, b) => (b ? g(b, a % b) : a);
        const frac = rest ? `${rest / g(rest, den)}/${den / g(rest, den)}` : '';
        return `${whole ? whole + (frac ? ' ' : '') : ''}${frac}" = 1'-0"`;
      }
    }
    return `1" = ${Math.round(feet * 100) / 100}'`;
  };

  // WHAT A DRAFTER TYPES FOR A SCALE: 1/8" = 1'-0", 3/16, 1" = 25', 1"=25',
  // 25' or 1:300. A bare fraction or inch figure is inches to the foot; a
  // figure with ' (or 1" = N') is feet to the inch; 1:N is a ratio. Null for
  // anything else.
  const parseScale = text => {
    const t = String(text || '').trim().replace(/\s+/g, '').replace(/[’′]/g, "'").replace(/[”″]/g, '"');
    if (!t) return null;
    const num = str => {
      const m = /^(\d+(?:\.\d+)?)(?:-?(\d+)\/(\d+))?$|^(\d+)\/(\d+)$/.exec(str);
      if (!m) return null;
      if (m[4]) return Number(m[4]) / Number(m[5]);
      return Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
    };
    let m = /^1:(\d+(?:\.\d+)?)$/.exec(t);
    if (m) return Number(m[1]) > 0 ? 12 / Number(m[1]) : null;
    m = /^1"?=(\d+(?:\.\d+)?)'$/.exec(t);
    if (m) return Number(m[1]) > 0 ? 1 / Number(m[1]) : null;
    m = /^(\d+(?:\.\d+)?)'$/.exec(t);
    if (m) return Number(m[1]) > 0 ? 1 / Number(m[1]) : null;
    m = /^([\d./-]+)"?(?:=1'(?:-0"?)?)?$/.exec(t);
    if (m) { const v = num(m[1]); return v > 0 ? v : null; }
    return null;
  };

  // SHOW LAYERS: the rows a plan viewport's layers are switched on and off by.
  // THE GROUPS are the HOLOGRAM card's five (hologram.js LAYER_GROUPS), so a
  // drafter who has used one has used the other, and then the three a sheet
  // viewport draws that a hologram never did: its dimension strings, its
  // notes and lines, and its structure.
  const LAYER_GROUPS = [
    // OUTLINE rides WALLS (jb, 25 Nov 2026): a hologram's dashed
    // footprint stayed on with every row off.
    { id: 'walls', label: 'WALLS', layers: ['A-WALL-EXT', 'A-WALL-INT', 'A-WALL-PATT', 'OUTLINE'] },
    { id: 'openings', label: 'DOORS & WINDOWS', layers: ['A-DOOR', 'A-GLAZ'] },
    { id: 'fixtures', label: 'FIXTURES / CABINETS', layers: ['A-FIXT', 'E-POWER'] },
    { id: 'flooring', label: 'FLOORING / AREAS', layers: ['A-FL', 'A-FL-DECK', 'A-FL-FLOORING', 'SHAPE'] },
    // TEXT, ALL OF IT OR ONE KIND (jb, 25 Nov 2026): a press on the row is
    // every kind; hover (or the arrow) shows each kind on its own.
    // ANNOTATION TEXT is the NOTES layer, so it also rides NOTES & LINES.
    // BUILTINS rides two text ids plan-composition.js stops the
    // lettering under (TEXT_IDS), not layers anything is filed on.
    { id: 'text', label: 'TEXT & ROOM NAMES', layers: ['ROOM-IDS-AREA', 'A-DIMS-WIN', 'A-DIMS-DOOR',
      'A-DIMS-EQUIP', 'A-ANNO-NOTE', 'BUILTIN-TEXT'],
    subs: [
      { id: 'text-door', label: 'DOOR TEXT', layers: ['A-DIMS-DOOR'] },
      { id: 'text-room', label: 'ROOM NAMES', layers: ['ROOM-IDS-AREA'] },
      { id: 'text-window', label: 'WINDOW TEXT', layers: ['A-DIMS-WIN'] },
      { id: 'text-note', label: 'ANNOTATION TEXT', layers: ['A-ANNO-NOTE'] },
      // CABINETS AND EVERYTHING ELSE IN ONE ROW (jb: "change CABINET TEXT
      // to BUILTINS TEXT ... put everything else in there").
      { id: 'text-builtin', label: 'BUILTINS TEXT', layers: ['A-DIMS-EQUIP', 'BUILTIN-TEXT'],
        title: 'Cabinets, bath and laundry pieces, stairs, beam and joist tags, pile marks, shape labels' },
    ] },
    // DIMENSIONS BY KIND the same way (jb, 25 Nov 2026), one row per
    // A-DIMS layer the STANDARDS table names. A-DIMS-EQUIP (cabinet size
    // tags) is BUILTINS TEXT now.
    { id: 'dims', label: 'DIMENSIONS', layers: ['A-DIMS', 'A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-INT',
      'A-DIMS-FENS', 'A-DIMS-COLS', 'A-DIMS-HAND'],
    subs: [
      { id: 'dims-fens', label: 'FENESTRATION DIMS', layers: ['A-DIMS-FENS'],
        title: 'The string locating window and door centres from the corners' },
      { id: 'dims-ext', label: 'EXT DIMS', layers: ['A-DIMS-EXT'], title: 'Overhang string and outline jogs' },
      { id: 'dims-int', label: 'INT DIMS', layers: ['A-DIMS-INT'], title: 'Wall faces and items inside the footprint' },
      { id: 'dims-ovr', label: 'OVERALL DIMS', layers: ['A-DIMS-OVR'], title: 'The footprint corner to corner' },
      { id: 'dims-cols', label: 'STRUCTURE DIMS', layers: ['A-DIMS-COLS'], title: 'Column and beam locations' },
      { id: 'dims-hand', label: 'HAND DIMS', layers: ['A-DIMS-HAND'], title: 'Drawn with the DIMENSION tool' },
      { id: 'dims-special', label: 'SPECIAL DIMS', layers: ['A-DIMS'], title: 'Dimensions for cases the other rows do not cover (A-DIMS)' },
    ] },
    // A-SITE is the SITE plan's lot line (jb, 25 Nov 2026).
    { id: 'notes', label: 'NOTES & LINES', layers: ['A-ANNO-NOTE', 'draft', 'A-SITE'] },
    { id: 'structure', label: 'STRUCTURE / ROOF', layers: ['S-BEAM', 'S-SLAB', 'S-FDN', 'S-COL-FOOTING',
      'S-FOOTING', 'A-STR', 'A-STR-DECK', 'A-ROOF'] },
  ];

  // A FRESH COPY each time it is asked for, so a page that edits what it was
  // handed cannot change what the other page is handed next.
  const layerGroups = () => JSON.parse(JSON.stringify(LAYER_GROUPS));

  window.DraftViewportKit = Object.freeze({ SCALES, scaleLabelOf, parseScale, layerGroups });
})();
