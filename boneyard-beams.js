// THE BONEYARD'S BEAMS: show, add, drag and delete beam lines and their
// columns on the WIREFRAME page.
//
// Movie, 28 Oct: "for the beams - which i think will be easier to edit in the
// wireframe area, i'd like to be able to add a beam line in the basement/
// crawl space ... 2 beam lines on main floor to support 2nd floor there", and
// "the 2 beamlines on the main floor should be alligned with 2 of the
// foundation beamlines in the center".
//
// WHICH BEAMS ARE A LEVEL'S: the ones filed on it, the way AUTO BEAM files
// them (12-garage-storeys-stairs.js placeAutoBeam) -- a level's beams carry
// the floor ABOVE it. FOUNDATION's carry MAIN; MAIN's carry 2ND. A pile
// under an overhang (pileMark) is the bone's, drawn and moved by
// boneyard-edit.js, and is no column of a beam here.
//
// A BEAM LINE is a row: the collinear pieces of one level that touch, the
// way MODEL picks them (06-selection-pick.js beamRun). Its columns are the
// posts of that level standing on its line (columnsOnBeam, 0.25 ft).
//
// STACKED LINES MOVE TOGETHER. A line dragged across carries every line on
// the levels above that stands exactly over it, posts and all, so the main
// floor's pair stays over the foundation's centre pair. A line dragged on
// its own level snaps to a line on the level below.
//
// Pure: a drawing in, a new drawing and a report out.
if (!window.DraftBoneyardBeams) {
(() => {
  const TOL = 1e-3;
  const ON_LINE_FT = 0.25;      // MODEL's COLUMN_ON_BEAM_FT
  const MAX_SPAN_FT = 12;       // build-house midSpanBeams' maxSpanFt
  const STEP_FT = 1 / 12;       // a drag moves in whole inches
  const clone = value => JSON.parse(JSON.stringify(value));

  const viewFor = level => (level.kind === 'foundation' ? 'foundation' : 'floor');
  const levelIdOf = level => (level.kind === 'foundation' ? 1 : Number(level.levelId));
  const isPile = col => !!(col && col.pileMark);

  const beamsOf = (d, levelId) => (d.beams || [])
    .filter(b => Number(b.levelId) === Number(levelId) && b.start && b.end);
  const columnsOf = (d, levelId) => (d.columns || [])
    .filter(c => Number(c.levelId) === Number(levelId) && c.point && !isPile(c));

  // A beam's line: the axis it runs on ('x' runs along x at z = c) or null
  // for one on an angle, which is drawn and deleted but never dragged.
  const lineOf = b => {
    const dx = b.end.x - b.start.x, dz = b.end.z - b.start.z;
    if (Math.abs(dz) < TOL && Math.abs(dx) > TOL) {
      return { axis: 'x', c: (b.start.z + b.end.z) / 2,
        lo: Math.min(b.start.x, b.end.x), hi: Math.max(b.start.x, b.end.x) };
    }
    if (Math.abs(dx) < TOL && Math.abs(dz) > TOL) {
      return { axis: 'z', c: (b.start.x + b.end.x) / 2,
        lo: Math.min(b.start.z, b.end.z), hi: Math.max(b.start.z, b.end.z) };
    }
    return null;
  };
  const along = (line, p) => (line.axis === 'x' ? p.x : p.z);
  const across = (line, p) => (line.axis === 'x' ? p.z : p.x);

  // The row a beam belongs to: collinear pieces on its level that touch.
  const rowOf = (d, beam) => {
    const line = lineOf(beam);
    if (!line) return [beam];
    const mates = beamsOf(d, beam.levelId).filter(b => {
      const l = lineOf(b);
      return l && l.axis === line.axis && Math.abs(l.c - line.c) < TOL;
    });
    const row = [beam];
    let lo = line.lo, hi = line.hi, grew = true;
    while (grew) {
      grew = false;
      mates.forEach(b => {
        if (row.includes(b)) return;
        const l = lineOf(b);
        if (l.lo <= hi + TOL && l.hi >= lo - TOL) {
          row.push(b); lo = Math.min(lo, l.lo); hi = Math.max(hi, l.hi); grew = true;
        }
      });
    }
    return row;
  };
  const rowLine = row => {
    const lines = row.map(lineOf).filter(Boolean);
    if (!lines.length) return null;
    return { axis: lines[0].axis, c: lines[0].c,
      lo: Math.min(...lines.map(l => l.lo)), hi: Math.max(...lines.map(l => l.hi)) };
  };

  const segDist = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
    return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
  };
  // The posts standing on a row, by position (no stored link, as in MODEL).
  const postsOn = (d, row) => {
    const levelId = row[0].levelId;
    return columnsOf(d, levelId).filter(c => row.some(b => segDist(c.point, b.start, b.end) <= ON_LINE_FT));
  };

  // The lines of the levels above a row standing exactly over it.
  const stackedOver = (d, row, levelOrder) => {
    const line = rowLine(row);
    if (!line) return [];
    const at = levelOrder.indexOf(Number(row[0].levelId));
    if (at < 0) return [];
    const out = [];
    levelOrder.slice(at + 1).forEach(levelId => {
      beamsOf(d, levelId).forEach(b => {
        const l = lineOf(b);
        if (!l || l.axis !== line.axis || Math.abs(l.c - line.c) > TOL) return;
        if (l.hi < line.lo - TOL || l.lo > line.hi + TOL) return;
        if (!out.includes(b)) out.push(b);
      });
    });
    return out;
  };

  // ── HIT TESTS, for the page ────────────────────────────────────────────
  const columnNear = (d, level, pt, reach) => {
    let best = null;
    columnsOf(d, levelIdOf(level)).forEach(c => {
      const dist = Math.hypot(c.point.x - pt.x, c.point.z - pt.z);
      if (dist <= reach && (!best || dist < best.dist)) best = { column: c, dist };
    });
    return best && best.column;
  };
  const beamNear = (d, level, pt, reach) => {
    let best = null;
    beamsOf(d, levelIdOf(level)).forEach(b => {
      const dist = segDist(pt, b.start, b.end);
      if (dist <= reach && (!best || dist < best.dist)) best = { beam: b, dist };
    });
    return best && best.beam;
  };

  // ── WHAT THE PAGE DRAWS ───────────────────────────────────────────────
  // A level's beams and posts, and the level below's for lining up on.
  const shown = (d, level) => ({
    beams: beamsOf(d, levelIdOf(level)),
    columns: columnsOf(d, levelIdOf(level)),
  });

  const nextId = list => (list || []).reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  const plain = p => ({ x: p.x, y: 0, z: p.z });

  // Posts between a line's ends, no span longer than MAX_SPAN_FT. The ends
  // bear on the walls a line is drawn between, so none stands there.
  const postsBetween = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const spans = Math.max(1, Math.ceil(len / MAX_SPAN_FT - 1e-9));
    const out = [];
    for (let i = 1; i < spans; i += 1) {
      const t = i / spans;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
    return out;
  };

  // ── ADD A BEAM LINE ───────────────────────────────────────────────────
  const addBeam = (drawing, { level, a, b }) => {
    if (!a || !b || Math.hypot(b.x - a.x, b.z - a.z) < 1) return { ok: false, reason: 'TOO_SHORT' };
    const d = clone(drawing);
    d.beams = d.beams || [];
    d.columns = d.columns || [];
    const levelId = levelIdOf(level);
    const view = viewFor(level);
    const beam = { id: nextId(d.beams), start: plain(a), end: plain(b), levelId, view, mode: 'flush', auto: false };
    d.beams.push(beam);
    let id = nextId(d.columns);
    const posts = postsBetween(a, b).map(p => ({ id: id++, point: plain(p), levelId, view, footing: 'pad36', auto: false }));
    d.columns.push(...posts);
    return { ok: true, drawing: d, report: { beamId: beam.id, posts: posts.length,
      lengthFt: Math.hypot(b.x - a.x, b.z - a.z) } };
  };

  // ── DRAG A BEAM LINE ACROSS ITSELF ────────────────────────────────────
  //
  // `levelOrder` is the level ids bottom-up (FOUNDATION first). Every line
  // above standing exactly over the row goes with it, with its posts.
  const moveBeam = (drawing, { beamId, deltaFt, levelOrder = [] }) => {
    const d = clone(drawing);
    const beam = (d.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return { ok: false, reason: 'NO_BEAM' };
    const row = rowOf(d, beam);
    const line = rowLine(row);
    if (!line) return { ok: false, reason: 'ON_ANGLE' };
    if (Math.abs(deltaFt) < TOL) return { ok: false, reason: 'NO_MOVE' };
    const moving = [row];
    const seen = new Set(row);
    let frontier = row;
    while (frontier.length) {
      const over = stackedOver(d, frontier, levelOrder).filter(b => !seen.has(b));
      over.forEach(b => seen.add(b));
      // Grouped by level so each carries its own posts.
      const byLevel = new Map();
      over.forEach(b => byLevel.set(b.levelId, [...(byLevel.get(b.levelId) || []), b]));
      byLevel.forEach(list => moving.push(list));
      frontier = over;
    }
    const shift = p => {
      if (line.axis === 'x') p.z += deltaFt; else p.x += deltaFt;
      delete p.srcId; delete p.offX; delete p.offZ;
    };
    const posts = new Set();
    moving.forEach(list => postsOn(d, list).forEach(c => posts.add(c)));
    moving.flat().forEach(b => { shift(b.start); shift(b.end); });
    posts.forEach(c => shift(c.point));
    return { ok: true, drawing: d, report: {
      moved: moving.flat().length, carried: moving.length - 1, posts: posts.size, deltaFt } };
  };

  // Where a dragged row lands: whole inches, or onto a line of the level
  // below within `snapFt`.
  const landing = (drawing, { beamId, rawDeltaFt, snapFt, levelOrder = [] }) => {
    const beam = (drawing.beams || []).find(b => Number(b.id) === Number(beamId));
    const line = beam && rowLine(rowOf(drawing, beam));
    if (!line) return { deltaFt: 0, snapped: null };
    const want = line.c + rawDeltaFt;
    const at = levelOrder.indexOf(Number(beam.levelId));
    const belowId = at > 0 ? levelOrder[at - 1] : null;
    let best = null;
    if (belowId != null) {
      beamsOf(drawing, belowId).forEach(b => {
        const l = lineOf(b);
        if (!l || l.axis !== line.axis) return;
        if (l.hi < line.lo - TOL || l.lo > line.hi + TOL) return;
        const dist = Math.abs(l.c - want);
        if (dist <= snapFt && (!best || dist < best.dist)) best = { c: l.c, dist };
      });
    }
    if (best) return { deltaFt: best.c - line.c, snapped: best.c };
    return { deltaFt: Math.round(rawDeltaFt / STEP_FT) * STEP_FT, snapped: null };
  };

  // ── DRAG A COLUMN ALONG ITS LINE ──────────────────────────────────────
  const moveColumn = (drawing, { columnId, to }) => {
    const d = clone(drawing);
    const col = (d.columns || []).find(c => Number(c.id) === Number(columnId));
    if (!col) return { ok: false, reason: 'NO_COLUMN' };
    const host = beamsOf(d, col.levelId).find(b => segDist(col.point, b.start, b.end) <= ON_LINE_FT);
    let next = { x: to.x, z: to.z };
    if (host) {
      const line = rowLine(rowOf(d, host));
      if (line) {
        const s = Math.max(line.lo, Math.min(line.hi, Math.round(along(line, to) / STEP_FT) * STEP_FT));
        next = line.axis === 'x' ? { x: s, z: line.c } : { x: line.c, z: s };
      }
    }
    if (Math.hypot(next.x - col.point.x, next.z - col.point.z) < TOL) return { ok: false, reason: 'NO_MOVE' };
    col.point.x = next.x; col.point.z = next.z;
    delete col.point.srcId; delete col.point.offX; delete col.point.offZ;
    return { ok: true, drawing: d, report: { columnId: col.id, at: next } };
  };

  // ── ADD A COLUMN ON A LINE ────────────────────────────────────────────
  const addColumn = (drawing, { level, at, reach }) => {
    const hit = beamNear(drawing, level, at, reach);
    if (!hit) return { ok: false, reason: 'NO_BEAM_HERE' };
    const line = lineOf(hit);
    const d = clone(drawing);
    d.columns = d.columns || [];
    let p = { x: at.x, z: at.z };
    if (line) {
      const s = Math.max(line.lo, Math.min(line.hi, Math.round(along(line, at) / STEP_FT) * STEP_FT));
      p = line.axis === 'x' ? { x: s, z: line.c } : { x: line.c, z: s };
    }
    const col = { id: nextId(d.columns), point: plain(p), levelId: hit.levelId,
      view: hit.view || viewFor(level), footing: 'pad36', auto: false };
    d.columns.push(col);
    return { ok: true, drawing: d, report: { columnId: col.id, at: p } };
  };

  // ── DELETE ────────────────────────────────────────────────────────────
  // A beam goes as its whole row, with the posts that stand on it and on no
  // other line.
  const deleteBeam = (drawing, { beamId }) => {
    const d = clone(drawing);
    const beam = (d.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return { ok: false, reason: 'NO_BEAM' };
    const row = rowOf(d, beam);
    const others = beamsOf(d, beam.levelId).filter(b => !row.includes(b));
    const posts = postsOn(d, row).filter(c => !others.some(b => segDist(c.point, b.start, b.end) <= ON_LINE_FT));
    d.beams = d.beams.filter(b => !row.includes(b));
    d.columns = (d.columns || []).filter(c => !posts.includes(c));
    return { ok: true, drawing: d, report: { beams: row.length, posts: posts.length } };
  };
  const deleteColumn = (drawing, { columnId }) => {
    const d = clone(drawing);
    const before = (d.columns || []).length;
    d.columns = (d.columns || []).filter(c => Number(c.id) !== Number(columnId));
    if (d.columns.length === before) return { ok: false, reason: 'NO_COLUMN' };
    return { ok: true, drawing: d, report: { columnId } };
  };

  // A drawn line's second end: square to the first along the longer run,
  // and onto a line of the level below within `snapFt`.
  const squareEnd = (drawing, { level, a, b, snapFt, levelOrder = [] }) => {
    const runX = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z);
    let start = { x: a.x, z: a.z }, end = runX ? { x: b.x, z: a.z } : { x: a.x, z: b.z };
    const at = levelOrder.indexOf(levelIdOf(level));
    const belowId = at > 0 ? levelOrder[at - 1] : null;
    let best = null;
    if (belowId != null) {
      beamsOf(drawing, belowId).forEach(bm => {
        const l = lineOf(bm);
        if (!l || l.axis !== (runX ? 'x' : 'z')) return;
        const dist = Math.abs(l.c - (runX ? a.z : a.x));
        if (dist <= snapFt && (!best || dist < best.dist)) best = { c: l.c, dist };
      });
    }
    if (best) {
      if (runX) { start.z = best.c; end.z = best.c; } else { start.x = best.c; end.x = best.c; }
    }
    return { a: start, b: end, snapped: best ? best.c : null };
  };

  // ── THE DIMENSIONS ─────────────────────────────────────────────────────
  //
  // Movie, 28 Oct: "we should also show the dimensions between the beams at
  // each end", and "(maybe columns too but only when zoomed in closer".
  //
  // AT EACH END: for each way the lines run, a string square across them
  // just inside each end of the run -- the walls the probe crosses (the
  // level's bone) and every line it crosses, in order. A T's wing and its
  // body are different ends, so each gets the lines it actually has.
  const crossings = (loops, axis, at) => {
    const out = [];
    (loops || []).forEach(loop => loop.points.forEach((a, i) => {
      const b = loop.points[(i + 1) % loop.points.length];
      const ua = axis === 'x' ? a.x : a.z, ub = axis === 'x' ? b.x : b.z;
      if ((ua - at) * (ub - at) > 0 || Math.abs(ua - ub) < TOL) return;
      const t = (at - ua) / (ub - ua);
      out.push(axis === 'x' ? a.z + (b.z - a.z) * t : a.x + (b.x - a.x) * t);
    }));
    return out;
  };
  const uniq = list => list.sort((a, b) => a - b)
    .filter((v, i, all) => i === 0 || Math.abs(v - all[i - 1]) > TOL);
  const endStrings = (drawing, level, loops) => {
    const rows = [];
    beamsOf(drawing, levelIdOf(level)).forEach(b => {
      if (rows.some(r => r.includes(b))) return;
      rows.push(rowOf(drawing, b));
    });
    const lines = rows.map(rowLine).filter(Boolean);
    const out = [];
    ['x', 'z'].forEach(axis => {
      const mine = lines.filter(l => l.axis === axis);
      if (!mine.length) return;
      const lo = Math.min(...mine.map(l => l.lo)), hi = Math.max(...mine.map(l => l.hi));
      [{ end: 'start', at: lo + 0.5 }, { end: 'end', at: hi - 0.5 }].forEach(({ end, at }) => {
        const beamsAt = mine.filter(l => l.lo <= at + TOL && l.hi >= at - TOL).map(l => l.c);
        if (!beamsAt.length) return;
        const walls = crossings(loops, axis, at);
        const stops = uniq([...beamsAt,
          // The nearest wall each side of the lines it has.
          ...[Math.max(...walls.filter(w => w < Math.min(...beamsAt) - TOL)),
            Math.min(...walls.filter(w => w > Math.max(...beamsAt) + TOL))].filter(Number.isFinite)]);
        if (stops.length < 2) return;
        out.push({ axis, end, at, stops, gaps: stops.slice(1).map((v, i) => v - stops[i]) });
      });
    });
    return out;
  };

  // ALONG EACH LINE: its ends and its posts, in order.
  const postStrings = (drawing, level) => {
    const rows = [];
    beamsOf(drawing, levelIdOf(level)).forEach(b => {
      if (rows.some(r => r.includes(b))) return;
      rows.push(rowOf(drawing, b));
    });
    return rows.map(row => {
      const line = rowLine(row);
      if (!line) return null;
      const stops = uniq([line.lo, line.hi, ...postsOn(drawing, row).map(c => along(line, c.point))]);
      return { line, stops, gaps: stops.slice(1).map((v, i) => v - stops[i]) };
    }).filter(r => r && r.stops.length > 2);
  };

  window.DraftBoneyardBeams = Object.freeze({
    endStrings, postStrings,
    MAX_SPAN_FT, ON_LINE_FT,
    levelIdOf, viewFor, shown, lineOf, rowOf, rowLine, postsOn, postsBetween, stackedOver,
    columnNear, beamNear, landing, squareEnd,
    addBeam, moveBeam, moveColumn, addColumn, deleteBeam, deleteColumn,
  });
})();
}
