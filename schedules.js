// DOOR AND WINDOW SCHEDULES (jb, 9 Nov): the openings on the drawing grouped
// by what a supplier orders -- one row per size and kind, with a count -- and
// marked W1.., D1.., G1.. so a row can be found on the plan and the estimate.
//
// ONE GROUPING, TWO READERS. ESTIMATES has counted doors under 8-A and
// windows under 8-B by size since 23 Oct, and jb asked that the schedules
// live there too: "will you put the window schedules in the ESTIMATES
// section? ... and doors". So the grouping moved HERE from estimates.js and
// both the sheet and the estimate read it. The row KEYS are the estimate's
// own (`8-A:ext:single:36`, `8-B:36x48`) and are not changed: a unit price
// typed on ESTIMATES is stored against its key, and a key that moved would
// be a price that vanished.
//
// A DOOR GROUPS BY KIND, STYLE AND WIDTH; its height is carried, not keyed.
// That is the rule 8-A has always had (a 36" door is a 36" door), and jb's
// doors are 80" unless SHOW HEIGHT says otherwise. A window groups by width
// AND height, since 36 x 48 and 36 x 36 are two orders. A garage door is its
// own family -- feet, marked G -- the way fen-labels.js already names it.
//
// MARKS ARE PER SCHEDULE, NOT PER LEVEL (the choice jb was offered and took
// with "ok sounds good"): the same window on two floors is one row, one
// mark, QTY 2, with both levels named. Windows read W1.. from the narrowest
// up; doors D1.. exterior first, then interior, each from the narrowest;
// overhead doors G1...
//
// Plain data in, rows out: no DOM, no store, no page state -- the sheet's
// painter and the ESTIMATES page lay the rows out their own way, and
// proto/schedules-harness.js checks the rows in node.
if (!window.DraftSchedules) {
(() => {
  const STYLE_WORD = Object.freeze({
    single: '', french: 'FRENCH', pocket: 'POCKET', barn: 'BARN', slide: 'SLIDING',
    bypass: 'BYPASS', garden: 'GARDEN', sidelight: 'W/ SIDELIGHT', overhead: 'OVERHEAD',
  });
  const KIND_WORD = Object.freeze({ ext: 'EXTERIOR', int: 'INTERIOR', garage: 'OVERHEAD' });
  const CASEMENT_WORD = Object.freeze({ single: 'SINGLE', double: 'DOUBLE' });
  const KIND_RANK = Object.freeze({ ext: 0, int: 1, garage: 2 });

  // Inches (or millimetres, to 5) as the estimate has always written them.
  const sizeIn = (ft, metric) => (metric
    ? `${window.DraftFenLabels.mmTo(ft, 5)}` : `${Math.round(ft * 12)}`);
  const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);

  // THE LEVEL A ROW STANDS ON, by name and in the set's order (top storey
  // first), so "MAIN FL, 2ND FL" reads the same on every row.
  const levelNamer = levels => {
    const list = (Array.isArray(levels) ? levels : []).slice()
      .sort((a, b) => num(b.elev) - num(a.elev) || num(b.id) - num(a.id));
    const rank = new Map(list.map((level, index) => [level.id, index]));
    const name = new Map(list.map(level => [level.id, String(level.name || '').toUpperCase()]));
    return ids => [...new Set(ids)].filter(id => name.has(id))
      .sort((a, b) => rank.get(a) - rank.get(b)).map(id => name.get(id));
  };

  const doorGroups = (fenestrations, metric) => {
    const groups = new Map();
    (fenestrations || []).filter(o => o && o.type === 'door').forEach(o => {
      const garage = o.garage === true || o.doorType === 'garage';
      const w = sizeIn(o.width, metric);
      const h = sizeIn(o.headHeight, metric);
      const kind = garage ? 'garage' : (o.doorType === 'ext' ? 'ext' : 'int');
      const style = garage ? 'overhead' : (o.doorStyle || 'single');
      const key = garage ? `8-A:garage:${w}x${h}` : `8-A:${kind}:${style}:${w}`;
      if (!groups.has(key)) {
        groups.set(key, { key, type: 'door', count: 0, garage, kind, style, w, h,
          widthFt: o.width, heightFt: o.headHeight, ids: [], levelIds: [],
          sidelight: style === 'sidelight' ? { widthFt: o.sidelightWidth, sides: o.sidelightSides } : null });
      }
      const g = groups.get(key);
      g.count += 1;
      g.ids.push(o.id);
      g.levelIds.push(o.levelId);
    });
    return [...groups.values()]
      .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || Number(a.w) - Number(b.w)
        || Number(a.h) - Number(b.h) || a.style.localeCompare(b.style));
  };

  const windowGroups = (fenestrations, metric) => {
    const groups = new Map();
    (fenestrations || []).filter(o => o && o.type === 'window').forEach(o => {
      const w = sizeIn(o.width, metric);
      const height = (Number(o.headHeight) || 0) - (Number(o.sillHeight) || 0);
      const h = height > 0 ? sizeIn(height, metric) : '?';
      const key = `8-B:${w}x${h}`;
      if (!groups.has(key)) {
        groups.set(key, { key, type: 'window', count: 0, w, h, widthFt: o.width,
          heightFt: height > 0 ? height : null, sillFt: Number(o.sillHeight) || 0,
          casement: o.casement || 'single', ids: [], levelIds: [] });
      }
      const g = groups.get(key);
      g.count += 1;
      g.ids.push(o.id);
      g.levelIds.push(o.levelId);
      // THE LOWEST SILL OF THE GROUP is the one the schedule quotes; a
      // window moved up a few inches on one wall is still the same order.
      g.sillFt = Math.min(g.sillFt, Number(o.sillHeight) || 0);
    });
    return [...groups.values()]
      .sort((a, b) => a.widthFt - b.widthFt || Number(a.h) - Number(b.h));
  };

  // THE MARKS, dealt down each sorted list: W1.. for windows, D1.. for swing
  // doors, G1.. for overhead doors.
  const markGroups = groups => {
    const next = { W: 1, D: 1, G: 1 };
    return groups.map(g => {
      const letter = g.type === 'window' ? 'W' : g.garage ? 'G' : 'D';
      return { ...g, mark: `${letter}${next[letter]++}` };
    });
  };

  // ── THE SCHEDULE'S OWN WORDS ──────────────────────────────────────────
  //
  // SIZE reads width x height in inches, the way a window's plan tag does
  // (36 X 42) -- a garage door in feet, the way its tag does (16W x 8H).
  // Metric drawings read millimetres, through the same rounding the tags use.
  const sizeText = (g, metric) => {
    if (g.heightFt == null) return metric ? `${g.w} mm WIDE` : `${g.w}" WIDE`;
    if (g.garage && !metric) {
      const feet = ft => {
        const whole = Math.floor(ft + 1e-9), inches = Math.round((ft - whole) * 12);
        return inches ? `${whole}'-${inches}"` : `${whole}'-0"`;
      };
      return `${feet(g.widthFt)} x ${feet(g.heightFt)}`;
    }
    return metric ? `${g.w} x ${g.h} mm` : `${g.w} x ${g.h}"`;
  };
  const heightText = (ft, metric) => (metric
    ? `${window.DraftFenLabels.mmTo(ft, 5)} mm`
    : window.DraftFormatters.formatArchitecturalInches(ft * 12));

  const doorRow = (g, metric, namesOf) => ({
    ...g, qty: g.count,
    size: sizeText(g, metric),
    kindWord: KIND_WORD[g.kind],
    styleWord: g.garage ? 'SECTIONAL' : (STYLE_WORD[g.style] ?? g.style.toUpperCase()) || 'SINGLE',
    levels: namesOf(g.levelIds),
    remarks: [
      g.sidelight ? `SIDELIGHT ${g.sidelight.widthFt ? `${Math.round(g.sidelight.widthFt * 12)}"` : ''} ${
        g.sidelight.sides === 'both' ? 'BOTH SIDES' : g.sidelight.sides === 'hinge' ? 'HINGE SIDE' : 'LATCH SIDE'}`.replace(/\s+/g, ' ') : '',
    ].filter(Boolean).join(', '),
  });
  const windowRow = (g, metric, namesOf) => ({
    ...g, qty: g.count,
    size: sizeText(g, metric),
    casementWord: CASEMENT_WORD[g.casement] || 'SINGLE',
    sill: heightText(g.sillFt, metric),
    levels: namesOf(g.levelIds),
    remarks: g.heightFt == null ? 'HEIGHT NOT SET' : '',
  });

  // THE TWO SCHEDULES OFF A DRAWING: `fenestrations` as drawing-format reads
  // them, `levels` for the names, `metric` for the units.
  const openingSchedules = ({ fenestrations, levels, metric = false }) => {
    const namesOf = levelNamer(levels);
    const doors = markGroups(doorGroups(fenestrations, metric)).map(g => doorRow(g, metric, namesOf));
    const windows = markGroups(windowGroups(fenestrations, metric)).map(g => windowRow(g, metric, namesOf));
    return { doors, windows };
  };

  // THE MARK OF EVERY OPENING, by id, so a plan tag or an estimate row can
  // say which schedule row it is.
  const marksById = schedules => {
    const marks = new Map();
    [...schedules.doors, ...schedules.windows].forEach(row =>
      row.ids.forEach(id => marks.set(String(id), row.mark)));
    return marks;
  };
  const marksByKey = schedules => new Map(
    [...schedules.doors, ...schedules.windows].map(row => [row.key, row.mark]));

  // ── THE TABLE, AS TEXT ─────────────────────────────────────────────────
  // Head, columns and cells with no layout in them, so the sheet painter,
  // a DXF and a harness all read one table. Column widths are shares of
  // the table's width.
  const DOOR_COLUMNS = Object.freeze([
    { id: 'mark', head: 'MARK', share: 0.9 }, { id: 'qty', head: 'QTY', share: 0.7 },
    { id: 'size', head: 'SIZE (W x H)', share: 1.8 }, { id: 'kind', head: 'TYPE', share: 1.4 },
    { id: 'style', head: 'STYLE', share: 1.5 }, { id: 'levels', head: 'LEVEL', share: 1.8 },
    { id: 'remarks', head: 'REMARKS', share: 2.6 },
  ]);
  const WINDOW_COLUMNS = Object.freeze([
    { id: 'mark', head: 'MARK', share: 0.9 }, { id: 'qty', head: 'QTY', share: 0.7 },
    { id: 'size', head: 'SIZE (W x H)', share: 1.8 }, { id: 'casement', head: 'TYPE', share: 1.4 },
    { id: 'sill', head: 'SILL HT', share: 1.3 }, { id: 'levels', head: 'LEVEL', share: 1.8 },
    { id: 'remarks', head: 'REMARKS', share: 2.6 },
  ]);
  const scheduleTable = (schedules, table) => {
    const door = table === 'door';
    const rows = door ? schedules.doors : schedules.windows;
    const columns = door ? DOOR_COLUMNS : WINDOW_COLUMNS;
    const cells = row => columns.map(col => {
      switch (col.id) {
        case 'mark': return row.mark;
        case 'qty': return String(row.qty);
        case 'size': return row.size;
        case 'kind': return row.kindWord;
        case 'style': return row.styleWord;
        case 'casement': return row.casementWord;
        case 'sill': return row.sill;
        case 'levels': return row.levels.join(', ');
        default: return row.remarks || '';
      }
    });
    return {
      title: door ? 'DOOR SCHEDULE' : 'WINDOW SCHEDULE',
      columns: columns.map(col => ({ head: col.head, share: col.share })),
      rows: rows.map(cells),
      empty: door ? 'NO DOORS ON THE DRAWING YET' : 'NO WINDOWS ON THE DRAWING YET',
    };
  };

  window.DraftSchedules = Object.freeze({
    doorGroups, windowGroups, openingSchedules, marksById, marksByKey, scheduleTable,
    DOOR_COLUMNS, WINDOW_COLUMNS, STYLE_WORD,
  });
})();
}
