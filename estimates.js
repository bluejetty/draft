// ESTIMATES -- the quantities a drawing holds, laid out in the order and under
// the numbers of the SPECIFICATIONS (Movie, 23 Oct: "i guess we should start
// the ESTIMATION area" -- "will be easier to estimate directly from the file
// rather than from the PDF" -- "our estimation area should follow the ORDER
// and numbering of the SPECIFICATION area if we can").
//
// WHAT HIS PDF MARKUP DID, kept: an area goes under a category, each category
// has its types, a WASTE percent rides every area (10-15%, default 15), a
// roof's flat area becomes a sloped one by its pitch and is said in squares
// too, and the windows and doors are counted by size. WHAT CHANGES: nothing is
// traced. The rooms' shapes, the roofs, the exterior walls and every opening
// are the drawing's own records, so the count is exact -- "it didn't count
// the doors right" was the PDF's text being read for numbers.
//
// PURE. A saved drawing in, sections out; every module it needs is read off
// `window` at call time, the way areas.js reads the shoelace, so the harness
// sandbox and the page serve the same code.
if (!window.DraftEstimates) {
(() => {
  const DEFAULT_WASTE_PCT = 15;
  const CATEGORIES = Object.freeze(['flooring', 'roofing', 'exterior']);
  // THE SECTIONS THAT COUNT SOMETHING, by the spec's own numbers. Everything
  // else in the spec is a heading here with nothing under it, so the page
  // reads top to bottom as the specification does.
  const COUNTED = Object.freeze({
    '7-B': 'roofing', '8-A': 'doors', '8-B': 'windows', '9-A': 'flooring', '9-B': 'exterior',
  });
  const EXTERIOR_MIN_IN = 5.4;      // MODEL.html's own rule when no outline says which walls are the shell's
  const ON_OUTLINE_FT = 0.6;

  const loopArea = pts => Math.abs((pts || []).reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return sum + (p.x * q.z - q.x * p.z) / 2;
  }, 0));
  const round1 = v => Math.round(v * 10) / 10;
  const round2 = v => Math.round(v * 100) / 100;
  const pct = (settings, cat) => {
    const v = Number(settings?.waste?.[cat]);
    return Number.isFinite(v) && v >= 0 ? v : DEFAULT_WASTE_PCT;
  };
  const withWaste = (sqFt, waste) => round1(sqFt * (1 + waste / 100));

  // ── THE DRAWING, NORMALISED THE WAY THE SHEETS READ IT ─────────────────
  const read = saved => {
    const F = window.DraftDrawingFormat;
    const WT = window.DraftWallTypes;
    const RT = window.DraftRoofTypes;
    const levels = F.levels(saved?.levels);
    const levelIds = new Set(levels.map(level => level.id));
    const walls = F.walls(saved?.walls, levelIds, {
      wallTypes: WT ? WT.WALL_TYPES : [],
      legacyWallTypes: WT ? WT.LEGACY_WALL_TYPES || {} : {},
      finishIds: WT ? WT.EXTERIOR_FINISHES.map(f => f.id) : [],
      legacyFinishes: WT ? WT.LEGACY_FINISH_IDS || {} : {},
    });
    const roofs = F.roofs(saved?.roofs, levelIds, { roofingIds: RT ? RT.ROOFING_TYPES.map(r => r.id) : null });
    const fenestrations = F.fenestrations(saved?.fenestrations, levelIds);
    const roomTags = F.roomTags(saved?.roomTags, levelIds);
    return { levels, levelIds, walls, roofs, fenestrations, roomTags, metric: saved?.units === 'metric' };
  };

  // ── 9-A INTERIOR FINISH: the flooring the room shapes lay ────────────────
  const flooringRows = (d, settings) => {
    const waste = pct(settings, 'flooring');
    const finishes = window.DraftDrawingFormat.FLOORING_FINISHES || [];
    const groups = new Map();
    const unset = [];
    d.roomTags.forEach(tag => {
      if (!Array.isArray(tag.points) || tag.points.length < 3) return;
      const sqFt = loopArea(tag.points);
      if (!(sqFt > 0)) return;
      const level = d.levels.find(l => l.id === tag.levelId);
      const room = { name: tag.name, level: level ? level.name : '', sqFt: round1(sqFt) };
      const type = tag.flooring?.type;
      if (!type) { unset.push(room); return; }
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(room);
    });
    const rows = [];
    finishes.forEach(finish => {
      const rooms = groups.get(finish.id);
      if (!rooms) return;
      const net = round1(rooms.reduce((sum, r) => sum + r.sqFt, 0));
      rows.push({ key: `9-A:${finish.id}`, label: finish.label, unit: 'SQ FT',
        detail: rooms.map(r => `${r.name} ${r.sqFt}`).join(' · '),
        net, waste, qty: withWaste(net, waste), rooms });
    });
    if (unset.length) {
      const net = round1(unset.reduce((sum, r) => sum + r.sqFt, 0));
      rows.push({ key: '9-A:none', label: 'NO FLOORING SET', unit: 'SQ FT', unassigned: true,
        detail: unset.map(r => `${r.name} ${r.sqFt}`).join(' · '),
        net, waste: 0, qty: net, rooms: unset });
    }
    return rows;
  };

  // ── 7-B ROOF: every roof by its roofing and pitch ───────────────────────
  // Flat area is the eave line's (the record's points are the eave, the
  // overhang already in); sloped is flat x sqrt(144 + rise^2) / 12, his PDF
  // tool's own multiplier; a square is 100 sq ft, after waste.
  const roofingRows = (d, settings) => {
    const waste = pct(settings, 'roofing');
    const RT = window.DraftRoofTypes;
    const types = RT ? RT.ROOFING_TYPES : [];
    const groups = new Map();
    d.roofs.forEach(roof => {
      if (!Array.isArray(roof.points) || roof.points.length < 3) return;
      const flat = loopArea(roof.points);
      if (!(flat > 0)) return;
      const pitch = Number(roof.pitch) || 0;
      const mult = Math.sqrt(144 + pitch * pitch) / 12;
      const type = roof.roofing || (types[0] && types[0].id) || 'asphalt';
      const key = `${type}:${pitch}`;
      if (!groups.has(key)) groups.set(key, { type, pitch, flat: 0, sloped: 0, count: 0 });
      const g = groups.get(key);
      g.flat += flat; g.sloped += flat * mult; g.count += 1;
    });
    return [...groups.values()].map(g => {
      const type = types.find(t => t.id === g.type);
      const qty = withWaste(g.sloped, waste);
      return { key: `7-B:${g.type}:${g.pitch}`, label: `${type ? type.label.toUpperCase() : g.type.toUpperCase()} ${g.pitch}/12`,
        unit: 'SQ FT', detail: `${g.count} roof${g.count === 1 ? '' : 's'} · flat ${round1(g.flat)} · sloped ${round1(g.sloped)} · ${round2(qty / 100)} squares`,
        net: round1(g.sloped), waste, qty, squares: round2(qty / 100), pitch: g.pitch };
    });
  };

  // ── 9-B EXTERIOR FINISH: the shell's walls, less their openings ─────────
  // A wall is the shell's when it LIES ALONG the storey's house outline: both
  // ends and its middle on it, since a partition run wall to wall has both
  // ends on the outline and its middle in the room. A drawing with no
  // outline (hand-drawn walls) falls back to the wall's thickness, as
  // MODEL.html does for the washrooms' snap: a 2x4 is never the shell.
  const exteriorWalls = (saved, d) => {
    const B = window.DraftBuildingBodies;
    const WT = window.DraftWallTypes;
    const G = window.DraftGeometry2D;
    const thick = wall => {
      const def = WT ? WT.WALL_TYPES.find(w => w.id === wall.wallType) : null;
      return def ? def.totalIn : 0;
    };
    const byLevel = new Map();
    d.levels.forEach(level => {
      const outline = B && B.houseOutlineOn ? B.houseOutlineOn(saved, level.id) : null;
      byLevel.set(level.id, outline && Array.isArray(outline.points) && outline.points.length >= 3 ? outline.points : null);
    });
    const onOutline = (pt, pts) => pts.some((a, i) => {
      const b = pts[(i + 1) % pts.length];
      return G.pointToSegment(pt, { start: a, end: b }).d < ON_OUTLINE_FT;
    });
    return d.walls.filter(wall => {
      if ((wall.view || 'plan') !== 'plan' || wall.body === 'garage') return false;
      const pts = byLevel.get(wall.levelId);
      if (pts) {
        const mid = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
        return onOutline(wall.start, pts) && onOutline(wall.end, pts) && onOutline(mid, pts);
      }
      return thick(wall) >= EXTERIOR_MIN_IN;
    });
  };
  const openingArea = opening => {
    const width = Number(opening.width) || 0;
    const height = opening.type === 'window'
      ? (Number(opening.headHeight) || 0) - (Number(opening.sillHeight) || 0)
      : (Number(opening.headHeight) || 0);
    return width > 0 && height > 0 ? width * height : 0;
  };
  const exteriorRows = (saved, d, settings) => {
    const waste = pct(settings, 'exterior');
    const WT = window.DraftWallTypes;
    const LA = window.DraftLevelAssembly;
    const finishes = WT ? WT.EXTERIOR_FINISHES : [];
    const groups = new Map();
    exteriorWalls(saved, d).forEach(wall => {
      const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      const own = Number(wall.topHeight) - Number(wall.baseHeight);
      const height = Number.isFinite(own) && own > 0 ? own
        : (LA ? LA.levelAssemblyFor(saved?.levelAssemblies, wall.levelId).wallHeightFt : 0);
      const gross = len * height;
      if (!(gross > 0)) return;
      const openings = d.fenestrations.filter(o => String(o.wallId) === String(wall.id))
        .reduce((sum, o) => sum + openingArea(o), 0);
      const finish = wall.finish || null;
      const key = finish || 'none';
      if (!groups.has(key)) groups.set(key, { finish, gross: 0, openings: 0, walls: 0 });
      const g = groups.get(key);
      g.gross += gross; g.openings += Math.min(openings, gross); g.walls += 1;
    });
    const rows = [];
    const order = [...finishes.map(f => f.id), 'none'];
    order.forEach(id => {
      const g = groups.get(id);
      if (!g) return;
      const finish = finishes.find(f => f.id === id);
      const net = round1(Math.max(0, g.gross - g.openings));
      const unassigned = id === 'none';
      rows.push({ key: `9-B:${id}`, label: finish ? finish.label.toUpperCase() : 'NO FINISH SET', unit: 'SQ FT',
        ...(unassigned ? { unassigned: true } : {}),
        detail: `${g.walls} wall${g.walls === 1 ? '' : 's'} · gross ${round1(g.gross)} · less openings ${round1(g.openings)}`,
        net, waste: unassigned ? 0 : waste, qty: unassigned ? net : withWaste(net, waste) });
    });
    return rows;
  };

  // ── 8-A DOORS, 8-B WINDOWS: counted by size ─────────────────────────────
  const sizeIn = (ft, metric) => (metric
    ? `${window.DraftFenLabels.mmTo(ft, 5)}` : `${Math.round(ft * 12)}`);
  const STYLE_WORD = { single: '', french: 'FRENCH', pocket: 'POCKET', barn: 'BARN', slide: 'SLIDING', bypass: 'BYPASS', garden: 'GARDEN', overhead: 'OVERHEAD' };
  const doorRows = d => {
    const groups = new Map();
    d.fenestrations.filter(o => o.type === 'door').forEach(o => {
      const garage = o.garage === true || o.doorType === 'garage';
      const w = sizeIn(o.width, d.metric);
      const h = sizeIn(o.headHeight, d.metric);
      const kind = garage ? 'garage' : (o.doorType === 'ext' ? 'ext' : 'int');
      const style = garage ? 'overhead' : (o.doorStyle || 'single');
      const key = garage ? `8-A:garage:${w}x${h}` : `8-A:${kind}:${style}:${w}`;
      if (!groups.has(key)) {
        groups.set(key, { key, count: 0, garage, kind, style, w, h });
      }
      groups.get(key).count += 1;
    });
    const unit = d.metric ? 'mm' : '"';
    const rank = { ext: 0, int: 1, garage: 2 };
    return [...groups.values()]
      .sort((a, b) => rank[a.kind] - rank[b.kind] || Number(a.w) - Number(b.w))
      .map(g => ({
        key: g.key, unit: 'EA', qty: g.count, waste: 0, net: g.count,
        label: g.garage ? `OVERHEAD DOOR ${g.w}${unit} x ${g.h}${unit}`
          : [g.kind === 'ext' ? 'EXTERIOR' : 'INTERIOR', STYLE_WORD[g.style] || g.style.toUpperCase(), `${g.w}${unit} WIDE`].filter(Boolean).join(' '),
        detail: g.garage ? '' : `${g.h}${unit} high`,
      }));
  };
  const windowRows = d => {
    const groups = new Map();
    d.fenestrations.filter(o => o.type === 'window').forEach(o => {
      const w = sizeIn(o.width, d.metric);
      const height = (Number(o.headHeight) || 0) - (Number(o.sillHeight) || 0);
      const h = height > 0 ? sizeIn(height, d.metric) : '?';
      const key = `8-B:${w}x${h}`;
      if (!groups.has(key)) groups.set(key, { key, count: 0, w, h, width: o.width });
      groups.get(key).count += 1;
    });
    const unit = d.metric ? ' mm' : '"';
    return [...groups.values()]
      .sort((a, b) => a.width - b.width || Number(a.h) - Number(b.h))
      .map(g => ({ key: g.key, unit: 'EA', qty: g.count, waste: 0, net: g.count,
        label: `WINDOW ${g.w} x ${g.h}${unit}`, detail: `${g.w}${unit} wide, ${g.h}${unit} high` }));
  };

  // ── THE SECTIONS, IN THE SPEC'S ORDER ────────────────────────────────────
  // `settings` is the drawing's `estimates` record: the waste per category
  // and a unit price per row key. A row's amount is its quantity, waste in,
  // times its price; a section's total is its rows'; a row with no price
  // shows its quantity and adds nothing.
  const estimateSections = (saved, settings = {}) => {
    const master = window.DraftSpecMaster;
    const d = read(saved);
    const built = {
      roofing: roofingRows(d, settings),
      doors: doorRows(d),
      windows: windowRows(d),
      flooring: flooringRows(d, settings),
      exterior: exteriorRows(saved, d, settings),
    };
    const priceOf = key => {
      const v = Number(settings?.prices?.[key]);
      return Number.isFinite(v) && v >= 0 ? v : null;
    };
    const sections = (master ? master.sections() : []).map(section => {
      const what = COUNTED[section.id] || null;
      const rows = (what ? built[what] : []).map(row => {
        const price = row.unassigned ? null : priceOf(row.key);
        return { ...row, price, amount: price == null ? null : round2(row.qty * price) };
      });
      const total = rows.reduce((sum, row) => sum + (row.amount || 0), 0);
      return { id: section.id, div: section.div, divTitle: section.divTitle, title: section.title,
        category: what && CATEGORIES.includes(what) ? what : null, rows, total: round2(total) };
    });
    const grand = round2(sections.reduce((sum, s) => sum + s.total, 0));
    return { sections, total: grand, counted: Object.keys(COUNTED) };
  };

  window.DraftEstimates = Object.freeze({
    DEFAULT_WASTE_PCT, CATEGORIES, COUNTED, estimateSections, loopArea,
  });
})();
}
