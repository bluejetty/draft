// JOIST SPANS — the floor joist picks the JOIST DEPTH box offers, and the
// span tables that say how far each one reaches.
//
// jb, 16 Nov 2026, with Weyerhaeuser's TJ-4500 (Trus Joist TJI Specifier's
// Guide, Canada, December 2024) open: "in the FLOOR JOISTS area can we allow
// the user to enter a number as it is now, but also offer all these floor
// thicknesses, later i will add in the conventional floor joist span tables
// too" -- "conventional lumber floor joists 2x10 2x12 etc".
//
// SO THERE ARE TWO LISTS HERE, and they are kept apart on purpose:
//
//   PICKS   what the ▾ beside JOIST DEPTH offers: a family (TJI / SAWN), a
//           depth and the joist type it sets. Typing a number still works;
//           a pick only fills the same box and names the type with it.
//   TABLES  how far a joist reaches, one table per source. Each table says
//           what it was read at (`basis`) and holds rows of
//           { series, depthIn, spanFt: { [ocIn]: feet } }. The sawn-lumber
//           tables slot in as one more entry with family 'sawn' and the
//           same row shape -- nothing that reads a table changes.
//
// THE COLUMN READ, and why that one: ¾" OSB glue-nailed (the SHEATHING
// default), 40 psf live, NO DIRECTLY APPLIED CEILING, SIMPLE OR CONTINUOUS
// SPAN -- the shortest of the four ¾" columns, so a floor that passes here
// passes every way the ceiling and bearings could turn out. 15 psf dead is
// the default; the 30 psf dead rows (tile, heavier finishes) sit beside it.
// TJ-4500 page 8 for 9½"-16", page 18 for 18"-24" (no 12" o.c. column
// there). Figures are the PDF's own, feet-inches turned to decimal feet.
//
// Pure, reads nothing, loads before build-house.js and PROJECT's script.
if (!window.DraftJoistSpans) {
(() => {
  const ft = (feet, inches) => feet + inches / 12;
  const row = (series, depthIn, oc12, oc16, oc192, oc24) => Object.freeze({
    series, depthIn,
    spanFt: Object.freeze({
      ...(oc12 ? { 12: ft(...oc12) } : {}),
      16: ft(...oc16), 19.2: ft(...oc192), 24: ft(...oc24),
    }),
  });

  // ── TJI, ¾" OSB, NO DIRECTLY APPLIED CEILING, SIMPLE OR CONTINUOUS ──────
  const TJI_40_15 = Object.freeze([
    row('110', 9.5, [16, 1], [15, 2], [14, 7], [13, 8]),
    row('210', 9.5, [16, 6], [15, 7], [15, 0], [14, 5]),
    row('230', 9.5, [16, 9], [15, 10], [15, 3], [14, 7]),
    row('360', 9.5, [17, 4], [16, 4], [15, 8], [15, 1]),
    row('560', 9.5, [18, 10], [17, 6], [16, 10], [16, 2]),
    row('110', 11.875, [18, 0], [16, 11], [16, 4], [15, 8]),
    row('210', 11.875, [18, 8], [17, 5], [16, 9], [16, 1]),
    row('230', 11.875, [19, 0], [17, 8], [17, 0], [16, 4]),
    row('360', 11.875, [19, 9], [18, 4], [17, 7], [16, 10]),
    row('560', 11.875, [21, 9], [20, 1], [19, 2], [18, 1]),
    row('110', 14, [20, 0], [18, 7], [17, 9], [17, 0]),
    row('210', 14, [20, 8], [19, 2], [18, 3], [17, 6]),
    row('230', 14, [21, 1], [19, 7], [18, 8], [17, 9]),
    row('360', 14, [22, 0], [20, 4], [19, 4], [18, 4]),
    row('560', 14, [24, 2], [22, 4], [21, 3], [20, 1]),
    row('210', 16, [22, 6], [20, 10], [19, 11], [18, 10]),
    row('230', 16, [23, 0], [21, 3], [20, 3], [19, 3]),
    row('360', 16, [23, 11], [22, 1], [21, 1], [19, 11]),
    row('560', 16, [26, 4], [24, 3], [23, 1], [21, 9]),
    row('360', 18, null, [23, 10], [22, 8], [21, 5]),
    row('560', 18, null, [26, 2], [24, 10], [23, 5]),
    row('360', 20, null, [25, 5], [24, 3], [21, 6]),
    row('560', 20, null, [27, 11], [26, 6], [25, 0]),
    row('560D', 22, null, [29, 9], [28, 3], [26, 8]),
    row('560D', 24, null, [31, 5], [29, 10], [28, 2]),
  ]);
  const TJI_40_30 = Object.freeze([
    row('110', 9.5, [16, 1], [15, 2], [14, 6], [12, 5]),
    row('210', 9.5, [16, 6], [15, 7], [15, 0], [13, 9]),
    row('230', 9.5, [16, 9], [15, 10], [15, 3], [14, 7]),
    row('360', 9.5, [17, 4], [16, 4], [15, 8], [15, 1]),
    row('560', 9.5, [18, 10], [17, 6], [16, 10], [16, 2]),
    row('110', 11.875, [18, 0], [16, 11], [16, 3], [14, 6]),
    row('210', 11.875, [18, 8], [17, 5], [16, 9], [15, 10]),
    row('230', 11.875, [19, 0], [17, 8], [17, 0], [16, 4]),
    row('360', 11.875, [19, 9], [18, 4], [17, 7], [16, 10]),
    row('560', 11.875, [21, 9], [20, 1], [19, 2], [18, 1]),
    row('110', 14, [20, 0], [18, 7], [17, 9], [14, 6]),
    row('210', 14, [20, 8], [19, 2], [18, 3], [15, 10]),
    row('230', 14, [21, 1], [19, 7], [18, 8], [17, 0]),
    row('360', 14, [22, 0], [20, 4], [19, 4], [17, 4]),
    row('560', 14, [24, 2], [22, 4], [21, 3], [20, 1]),
    row('210', 16, [22, 6], [20, 10], [19, 11], [15, 10]),
    row('230', 16, [23, 0], [21, 3], [20, 3], [17, 0]),
    row('360', 16, [23, 11], [22, 1], [21, 1], [17, 4]),
    row('560', 16, [26, 4], [24, 3], [23, 1], [20, 4]),
    row('360', 18, null, [23, 10], [21, 9], [17, 4]),
    row('560', 18, null, [26, 2], [24, 10], [20, 4]),
    row('360', 20, null, [25, 5], [21, 9], [17, 4]),
    row('560', 20, null, [27, 11], [25, 5], [20, 4]),
    row('560D', 22, null, [29, 9], [28, 3], [26, 8]),
    row('560D', 24, null, [31, 5], [29, 10], [28, 2]),
  ]);

  const TABLES = Object.freeze([
    Object.freeze({
      id: 'tji-tj4500-40-15', family: 'tji', joistType: 'tji',
      source: 'Weyerhaeuser TJ-4500 (Dec 2024)',
      basis: Object.freeze({ subfloor: '3/4" OSB glue-nailed', liveLoadPsf: 40, deadLoadPsf: 15,
        ceiling: 'none', span: 'simple or continuous' }),
      rows: TJI_40_15,
    }),
    Object.freeze({
      id: 'tji-tj4500-40-30', family: 'tji', joistType: 'tji',
      source: 'Weyerhaeuser TJ-4500 (Dec 2024)',
      basis: Object.freeze({ subfloor: '3/4" OSB glue-nailed', liveLoadPsf: 40, deadLoadPsf: 30,
        ceiling: 'none', span: 'simple or continuous' }),
      rows: TJI_40_30,
    }),
    // Sawn lumber (2x8 / 2x10 / 2x12) slots in here as
    //   { id, family: 'sawn', joistType: 'conv_2x10', ..., rows: [{ series: 'SPF #2', depthIn, spanFt }] }
    // when jb brings the tables.
  ]);
  const DEFAULT_DEAD_LOAD_PSF = 15;

  // ── THE PICKS ─────────────────────────────────────────────────────────────
  // TJI: every depth TJ-4500 makes (9½" to 24"). SAWN: the dressed depths
  // (1½ x 7¼ / 9¼ / 11¼ -- jb, 16 Nov: "the 2x12 should be 1.5x11 1/4"),
  // offered now and spanned once their tables arrive.
  const pick = (family, joistType, depthIn, label) => Object.freeze({ family, joistType, depthIn, label });
  const PICKS = Object.freeze([
    pick('tji', 'tji', 9.5, '9 1/2" TJI'),
    pick('tji', 'tji', 11.875, '11 7/8" TJI'),
    pick('tji', 'tji', 14, '14" TJI'),
    pick('tji', 'tji', 16, '16" TJI'),
    pick('tji', 'tji', 18, '18" TJI'),
    pick('tji', 'tji', 20, '20" TJI'),
    pick('tji', 'tji', 22, '22" TJI'),
    pick('tji', 'tji', 24, '24" TJI'),
    pick('sawn', 'conv_2x8', 7.25, '2x8 (7 1/4")'),
    pick('sawn', 'conv_2x10', 9.25, '2x10 (9 1/4")'),
    pick('sawn', 'conv_2x12', 11.25, '2x12 (11 1/4")'),
  ]);
  const FAMILY_LABEL = Object.freeze({ tji: 'TJI', sawn: 'SAWN LUMBER' });

  const same = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-6;
  const familyOf = joistType => (joistType === 'tji' ? 'tji'
    : /^conv_/.test(String(joistType || '')) ? 'sawn' : null);
  const tableFor = (joistType, { deadLoadPsf = DEFAULT_DEAD_LOAD_PSF } = {}) => {
    const family = familyOf(joistType);
    return TABLES.find(t => t.family === family && t.basis.deadLoadPsf === deadLoadPsf
      && (t.family !== 'sawn' || t.joistType === joistType)) || null;
  };
  // The rows a depth has, lightest series first (the table's own order).
  const rowsAt = (joistType, depthIn, opts) => {
    const table = tableFor(joistType, opts);
    return table ? table.rows.filter(r => same(r.depthIn, depthIn)) : [];
  };

  // THE JOIST FOR A SPAN, the way the OWJ table is read (build-house
  // owjFor): at the depth already picked, 16" o.c. first and 12" the last
  // resort, the lightest series that reaches. Past every row, `fits: false`
  // with the strongest row's reach -- said, not guessed. Null when the type
  // has no table yet (sawn lumber today) or the depth is not in it.
  const sizeFor = ({ joistType, depthIn, spanFt, ocOrder = [16, 12], deadLoadPsf } = {}) => {
    const rows = rowsAt(joistType, depthIn, { deadLoadPsf });
    if (!rows.length || !Number.isFinite(spanFt)) return null;
    for (const ocIn of ocOrder) {
      const r = rows.find(x => Number.isFinite(x.spanFt[ocIn]) && spanFt <= x.spanFt[ocIn] + 1e-6);
      if (r) return { series: r.series, depthIn: r.depthIn, ocIn, reachFt: r.spanFt[ocIn], fits: true };
    }
    const last = rows[rows.length - 1];
    const ocIn = ocOrder.find(oc => Number.isFinite(last.spanFt[oc])) ?? 16;
    return { series: last.series, depthIn: last.depthIn, ocIn, reachFt: last.spanFt[ocIn], fits: false };
  };
  // HOW FAR A DEPTH REACHES at one spacing, lightest to strongest series --
  // the PROJECT page's line under the box, before any span is drawn.
  const reachAt = ({ joistType, depthIn, ocIn = 16, deadLoadPsf } = {}) => {
    const rows = rowsAt(joistType, depthIn, { deadLoadPsf })
      .filter(r => Number.isFinite(r.spanFt[ocIn]));
    if (!rows.length) return null;
    return { ocIn, lightest: { series: rows[0].series, reachFt: rows[0].spanFt[ocIn] },
      strongest: { series: rows[rows.length - 1].series, reachFt: rows[rows.length - 1].spanFt[ocIn] } };
  };
  const pickFor = depthIn => PICKS.filter(p => same(p.depthIn, depthIn));

  window.DraftJoistSpans = Object.freeze({
    TABLES, PICKS, FAMILY_LABEL, DEFAULT_DEAD_LOAD_PSF,
    familyOf, tableFor, rowsAt, sizeFor, reachAt, pickFor,
  });
})();
}
