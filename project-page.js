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
  const ZONE_ROWS = Object.freeze([
    Object.freeze({ id: 'attachedGarage', label: 'ATTACHED GARAGE', reserved: false }),
    Object.freeze({ id: 'detachedGarage', label: 'DETACHED GARAGE', reserved: false }),
    Object.freeze({ id: 'bilevel', label: 'BILEVEL', reserved: true }),
    Object.freeze({ id: 'modifiedBilevel', label: 'MODIFIED BILEVEL', reserved: true }),
  ]);

  // ── The section table ────────────────────────────────────────────────
  // A row per BUILD TYPE, a column per measured item. HOUSE is the drawing's
  // own live assembly; the rest carry only what they differ in and show only
  // the items their type uses — a garage has no floor joists, a bungalow no
  // second floor, a bilevel no wood fill wall.
  //
  // Wall heights are DERIVED FROM THE STUD, never typed: a wall is a stud
  // plus two top plates and one bottom plate, so the height that wastes no
  // lumber is a precut length plus 4½". Type the stud, read the wall.
  const PLATE_STACK_IN = 1.5 * 3;
  const STUD_LENGTHS_IN = Object.freeze([92.625, 104.625, 116.625]);
  // A basement fill wall doesn't get to choose its height, so it takes the
  // offcut instead: an 8' precut sawn in two, rounded off the sixteenth.
  const HALF_STUD_IN = 46.25;
  const wallHeightFtFromStud = studIn => (studIn + PLATE_STACK_IN) / 12;
  const studInFromWallHeightFt = wallHeightFt => wallHeightFt * 12 - PLATE_STACK_IN;

  const SECTION_TABLE_ROWS = Object.freeze([
    Object.freeze({ id: 'house', label: 'HOUSE', live: true }),
    Object.freeze({ id: 'split', label: 'SPLIT', live: false }),
    Object.freeze({ id: 'bilevel', label: 'BILEVEL', live: false }),
    Object.freeze({ id: 'modifiedBilevel', label: 'MOD BILEVEL', live: false }),
    Object.freeze({ id: 'attachedGarage', label: 'ATTACHED GARAGE', live: false }),
    Object.freeze({ id: 'detachedGarage', label: 'DETACHED GARAGE', live: false }),
  ]);

  const ALL_TYPES = SECTION_TABLE_ROWS.map(row => row.id);
  const HOUSE_LIKE = ['house', 'split', 'bilevel', 'modifiedBilevel'];
  const SILL_PLATE_IN = 1.5;
  const item = (id, label, unit, field, types, extra) =>
    Object.freeze({ id, label, unit, field, types: Object.freeze(types), ...extra });

  // unit: 'pitch' plain number | 'ftin' feet-and-inches | 'in' inches |
  // 'stud' inches typed, wall height read back underneath | 'derived' read-only.
  const SECTION_TABLE_ITEMS = Object.freeze([
    item('pitch', 'PITCH :12', 'pitch', 'roofPitch', ALL_TYPES),
    item('overhang', 'OVERHANG', 'ftin', 'roofOverhangFt', ALL_TYPES),
    item('heel', 'ROOF HEEL', 'derived', null, ALL_TYPES),
    item('upperStud', '2ND FL STUD', 'stud', 'upperWallHeightFt', ['house', 'modifiedBilevel']),
    item('upperJoists', '2ND FL JOISTS', 'in', 'upperJoistDepthIn', ['house', 'modifiedBilevel']),
    item('mainStud', 'MAIN FL STUD', 'stud', 'mainWallHeightFt', ALL_TYPES),
    item('mainJoists', 'MAIN FL JOISTS', 'in', 'mainJoistDepthIn', HOUSE_LIKE),
    item('mainSheathing', 'MAIN FL SHEATHING', 'in', 'mainSheathingIn', HOUSE_LIKE),
    item('fdnWall', 'FDN WALL HT', 'ftin', 'fdnWallHeightFt', ALL_TYPES),
    item('sill', 'SILL PLATE', 'derived', null, ALL_TYPES),
    item('woodFill', 'WOOD FILL HT', 'ftin', 'woodFillHeightFt', ['split', 'modifiedBilevel']),
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
  const SECTION_TABLE_DEFAULTS = Object.freeze({
    split: Object.freeze({
      fdnWallHeightFt: 5,
      woodFillHeightFt: (HALF_STUD_IN + PLATE_STACK_IN) / 12,
    }),
    bilevel: Object.freeze({ fdnWallHeightFt: 5 }),
    modifiedBilevel: Object.freeze({
      fdnWallHeightFt: 5,
      woodFillHeightFt: (HALF_STUD_IN + PLATE_STACK_IN) / 12,
    }),
  });

  // The heel is the fascia plus the rise the roof gains across the overhang
  // — the same rule the detail draws it with.
  const roofHeelIn = (fasciaIn, overhangFt, pitch) => fasciaIn + overhangFt * pitch;

  // The detached garage's grade beam rides ~8" above grade at the house —
  // the derive rule the ZONE HEIGHTS panel applies until overridden.
  const GARAGE_BEAM_ABOVE_GRADE_IN = 8;
  const CUT_DEPTH_FT = 4; // "the first 4 ft of the exterior wall cut inward"

  // Section geometry in world feet: x = 0 at the exterior wall face,
  // positive inward; y = elevation with the MAIN FL floor surface at 0.
  // Returns line/rect parts plus one anchor per annotated value.
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
    let y = 0;
    const mainDepthFt = (floors[0].joistDepthIn + floors[0].sheathingIn) / 12;
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
    const riseAt = x => fasciaFt + (roof.overhangFt + x) * (roof.pitch / 12);
    rect(-roof.overhangFt - 0.1, plateY, 0.1, fasciaFt, 1.5);   // fascia board
    line(-roof.overhangFt, plateY, 0, plateY, 1);               // soffit
    line(-roof.overhangFt, plateY + fasciaFt, CUT_DEPTH_FT, plateY + riseAt(CUT_DEPTH_FT), 2);
    anchors.pitch = { x: CUT_DEPTH_FT * 0.45, y: plateY + riseAt(CUT_DEPTH_FT * 0.45) + 0.55 };
    anchors.overhang = { x: -roof.overhangFt / 2, y: plateY - 0.55 };
    anchors.fascia = { x: -roof.overhangFt - 0.55, y: plateY + fasciaFt / 2 };
    anchors.heel = { x: 0.45, y: plateY + riseAt(0) / 2 };
    line(0, plateY, 0, plateY + riseAt(0), 1);                  // heel at the wall face

    // Foundation: wall top carries the main floor, footing centered under
    // it, slab pouring against the wall at the footing.
    const fdnTop = -mainDepthFt;
    const fdnBot = fdnTop - fdn.wallHeightFt;
    rect(0, fdnBot, fdnFt, fdn.wallHeightFt, 2);
    anchors.fdnHeight = { x: fdnFt + 0.9, y: fdnTop - fdn.wallHeightFt / 2 };
    anchors.fdnThickness = { x: fdnFt / 2, y: fdnTop + 0.45 };
    const footW = fdn.footingWidthIn / 12, footD = fdn.footingDepthIn / 12;
    rect(fdnFt / 2 - footW / 2, fdnBot - footD, footW, footD, 1.5);
    anchors.footingWidth = { x: fdnFt / 2, y: fdnBot - footD - 0.5 };
    anchors.footingDepth = { x: fdnFt / 2 + footW / 2 + 0.85, y: fdnBot - footD / 2 };
    const slabFt = fdn.slabIn / 12;
    rect(fdnFt, fdnBot, CUT_DEPTH_FT - fdnFt, slabFt, 1);
    anchors.slab = { x: CUT_DEPTH_FT * 0.62, y: fdnBot + slabFt + 0.5 };

    // Grade on the exterior side, with soil ticks — GRADE LEVEL is stored
    // relative to the top of the foundation wall (default 1'-0" below).
    const gradeY = fdnTop + fdn.gradeOffsetFt;
    line(-roof.overhangFt - 0.6, gradeY, 0, gradeY, 1.5);
    for (let gx = -roof.overhangFt - 0.5; gx < -0.15; gx += 0.35) {
      line(gx, gradeY, gx - 0.22, gradeY - 0.26, 0.75);
    }
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

  // Fit the section into the canvas, paint it, and hand back each anchor in
  // CANVAS pixels so the page can park the matching input beside its part.
  const paintWallSection = (canvas, values) => {
    const section = buildWallSection(values);
    const ctx = canvas.getContext('2d');
    const { extents } = section;
    const w = canvas.width, h = canvas.height;
    const scale = Math.min(w / (extents.maxX - extents.minX), h / (extents.maxY - extents.minY));
    const X = x => (x - extents.minX) * scale;
    const Y = y => h - (y - extents.minY) * scale;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#1d1f20';
    ctx.lineJoin = 'miter';
    section.parts.forEach(part => {
      ctx.lineWidth = part.weight || 1.5;
      if (part.kind === 'line') {
        ctx.beginPath(); ctx.moveTo(X(part.x1), Y(part.y1)); ctx.lineTo(X(part.x2), Y(part.y2)); ctx.stroke();
      } else if (part.kind === 'rect') {
        ctx.strokeRect(X(part.x), Y(part.y + part.h), part.w * scale, part.h * scale);
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

  window.DraftProjectPage = Object.freeze({
    ZONE_ROWS,
    CUT_DEPTH_FT,
    GARAGE_BEAM_ABOVE_GRADE_IN,
    SECTION_TABLE_ROWS,
    SECTION_TABLE_ITEMS,
    SECTION_TABLE_DEFAULTS,
    STUD_LENGTHS_IN,
    HALF_STUD_IN,
    PLATE_STACK_IN,
    SILL_PLATE_IN,
    wallHeightFtFromStud,
    studInFromWallHeightFt,
    roofHeelIn,
    buildWallSection,
    paintWallSection,
  });
})();
}
