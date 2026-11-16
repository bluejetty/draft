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
// STACKED LINES MOVE TOGETHER under LEVEL LOCK (below). A line dragged
// across carries the line in the same place on every other level, posts and
// all, so the main floor's pair stays over the foundation's centre pair. A line dragged on
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

  // ── LEVEL LOCK ────────────────────────────────────────────────────────
  //
  // jb, 16 Nov: "LEVEL LOCK COLUMNS & BEAMS so they will be the same all the
  // way up", then "i'm only talking about manuplating and deleting, deleting
  // will be all upper layers and the current layer, leave level below. why
  // you manuplate them (move beams and columns) all levels will need to
  // match the columns locations so all levels will move", "for COPYING and
  // pasting to an upper level if they are in the exact location as the
  // lower levels ... lock them, or if they past 2 layers up draw the laying
  // in between too (the column need to have support all the way the base of
  // the foudnation", and "or they LEVEL UNLOCK and edit how they please".
  //
  // ON BY DEFAULT and saved with the drawing (`beamLock: false` = UNLOCK).
  // With it on:
  //   ADD     -- this level only.
  //   DELETE  -- this level and every level ABOVE (a cut, a whole line, a
  //              column); levels below keep theirs.
  //   MOVE    -- a line dragged across, an end moved, a column slid: the
  //              same piece on EVERY level, below and above, goes with it.
  //   PASTE   -- onto a level above at the exact spot, and onto every level
  //              between that has none there yet, so a column stands on
  //              columns all the way down.
  //
  // LOCKED TOGETHER means in the same place, not a stored link: a line on
  // the same axis within ON_LINE_FT (3"), a column within 3". So a paste in
  // the exact spot is locked, and old files and AUTO BEAM's lines lock too
  // (jb: "after the autobeam is drawn allow the user to edit it as a normal
  // handdrawn beam").
  const isLocked = d => !(d && d.beamLock === false);
  const levelsAbove = (levelId, levelOrder = []) => {
    const at = levelOrder.indexOf(Number(levelId));
    return at < 0 ? [] : levelOrder.slice(at + 1);
  };
  const lockOn = (d, opts = {}) => (opts.lock === undefined ? isLocked(d) : !!opts.lock);
  const lockedAbove = (d, levelId, opts = {}) => (lockOn(d, opts) ? levelsAbove(levelId, opts.levelOrder) : []);
  // Every other level, for a move.
  const lockedOthers = (d, levelId, opts = {}) => (lockOn(d, opts)
    ? (opts.levelOrder || []).filter(id => Number(id) !== Number(levelId)) : []);
  const insideAny = (loops, p) => (loops || []).some(loop => {
    const pts = loop.points || loop;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const a = pts[i], b = pts[j];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  });
  // The parts of [lo, hi] along a line inside a level's bone; all of it
  // when the level has no bone to cut by.
  const clipToLoops = (loops, line, lo, hi) => {
    if (!loops || !loops.length) return [[lo, hi]];
    const at = s => (line.axis === 'x' ? { x: s, z: line.c } : { x: line.c, z: s });
    const cuts = crossings(loops.map(l => ({ points: l.points || l })), line.axis === 'x' ? 'z' : 'x', line.c)
      .filter(v => v > lo + TOL && v < hi - TOL);
    const stops = uniq([lo, hi, ...cuts]);
    const out = [];
    for (let i = 1; i < stops.length; i += 1) {
      const [a, z] = [stops[i - 1], stops[i]];
      if (z - a < TOL || !insideAny(loops, at((a + z) / 2))) continue;
      if (out.length && Math.abs(out[out.length - 1][1] - a) < TOL) out[out.length - 1][1] = z;
      else out.push([a, z]);
    }
    return out.filter(([a, z]) => z - a >= 1 - TOL);
  };
  // The rows of a level standing on a line (same axis, within 3", reaching
  // into [lo, hi]).
  const rowsOver = (d, line, levelId, lo = line.lo, hi = line.hi) => {
    const rows = [];
    beamsOf(d, levelId).forEach(b => {
      const l = lineOf(b);
      if (!l || l.axis !== line.axis || Math.abs(l.c - line.c) > ON_LINE_FT) return;
      if (l.hi <= lo + TOL || l.lo >= hi - TOL) return;
      if (!rows.some(r => r.includes(b))) rows.push(rowOf(d, b));
    });
    return rows;
  };
  const columnsAt = (d, levelId, p) => columnsOf(d, levelId)
    .filter(c => Math.hypot(c.point.x - p.x, c.point.z - p.z) <= ON_LINE_FT);

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
  const moveBeam = (drawing, { beamId, deltaFt, levelOrder = [], lock }) => {
    const d = clone(drawing);
    const beam = (d.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return { ok: false, reason: 'NO_BEAM' };
    const row = rowOf(d, beam);
    const line = rowLine(row);
    if (!line) return { ok: false, reason: 'ON_ANGLE' };
    if (Math.abs(deltaFt) < TOL) return { ok: false, reason: 'NO_MOVE' };
    // LOCKED: the line in the same place on every other level, below and
    // above, goes with it, each with its own posts. UNLOCKED, it moves alone.
    const moving = [row];
    const seen = new Set(row);
    lockedOthers(d, beam.levelId, { lock, levelOrder }).forEach(id => {
      rowsOver(d, line, id).forEach(r => {
        const fresh = r.filter(b => !seen.has(b));
        fresh.forEach(b => seen.add(b));
        if (fresh.length) moving.push(fresh);
      });
    });
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
  const moveColumn = (drawing, { columnId, to, lock, levelOrder }) => {
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
    // LOCKED: the column in the same place on every other level goes too.
    const riders = lockedOthers(d, col.levelId, { lock, levelOrder }).flatMap(up => columnsAt(d, up, col.point));
    [col, ...riders].forEach(c => {
      c.point.x = next.x; c.point.z = next.z;
      delete c.point.srcId; delete c.point.offX; delete c.point.offZ;
    });
    return { ok: true, drawing: d, report: { columnId: col.id, at: next, others: riders.length } };
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
  // LOCKED: what stands over it on the levels above is cut out with it.
  const cutAbove = (d, levelId, line, lo, hi, opts) => {
    let n = 0;
    lockedAbove(d, levelId, opts).forEach(up => {
      rowsOver(d, line, up, lo, hi).forEach(row => {
        reshapeRow(d, row, rowLine(row), [[lo, hi]]);
        n += 1;
      });
    });
    return n;
  };
  const deleteBeam = (drawing, { beamId, lock, levelOrder }) => {
    const d = clone(drawing);
    const beam = (d.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return { ok: false, reason: 'NO_BEAM' };
    const row = rowOf(d, beam);
    const line = rowLine(row);
    const others = beamsOf(d, beam.levelId).filter(b => !row.includes(b));
    const posts = postsOn(d, row).filter(c => !others.some(b => segDist(c.point, b.start, b.end) <= ON_LINE_FT));
    d.beams = d.beams.filter(b => !row.includes(b));
    d.columns = (d.columns || []).filter(c => !posts.includes(c));
    const above = line ? cutAbove(d, beam.levelId, line, line.lo, line.hi, { lock, levelOrder }) : 0;
    return { ok: true, drawing: d, report: { beams: row.length, posts: posts.length, above } };
  };
  const deleteColumn = (drawing, { columnId, lock, levelOrder }) => {
    const d = clone(drawing);
    const col = (d.columns || []).find(c => Number(c.id) === Number(columnId));
    if (!col) return { ok: false, reason: 'NO_COLUMN' };
    const gone = [col, ...(col.point ? lockedAbove(d, col.levelId, { lock, levelOrder })
      .flatMap(up => columnsAt(d, up, col.point)) : [])];
    d.columns = d.columns.filter(c => !gone.includes(c));
    return { ok: true, drawing: d, report: { columnId, above: gone.length - 1 } };
  };

  // ── ONE SPAN OF A LINE, AND CUTTING IT OUT ────────────────────────────
  //
  // jb, 16 Nov: "i need to be able to SHORTEN this beam ... i only need 2
  // columns and a beam beside the stair opening, and i don't need the part
  // that goes over to the walls on each side", and "how would be good to CUT
  // a beam after a certain column or between columns". A click on a line
  // picks the SPAN under it -- from the post (or the line's end) on one side
  // to the post (or end) on the other -- and DELETE cuts that span out. The
  // posts at its two ends stay and the line now ends on them.
  //
  // The stops along a row: its two ends and every post on it.
  const stopsOf = (d, row) => {
    const line = rowLine(row);
    if (!line) return null;
    return uniq([line.lo, line.hi, ...postsOn(d, row).map(c => along(line, c.point))
      .filter(s => s > line.lo + TOL && s < line.hi - TOL)]);
  };
  const spanAt = (d, { beamId, at }) => {
    const beam = (d.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return null;
    const row = rowOf(d, beam);
    const line = rowLine(row);
    const stops = line && stopsOf(d, row);
    if (!stops) return null;
    const s = Math.max(line.lo, Math.min(line.hi, along(line, at)));
    for (let i = 1; i < stops.length; i += 1) {
      if (s <= stops[i] + TOL) return { lo: stops[i - 1], hi: stops[i], axis: line.axis, c: line.c };
    }
    return { lo: stops[stops.length - 2], hi: stops[stops.length - 1], axis: line.axis, c: line.c };
  };

  // A piece of a row between two places along it, keeping the way it runs.
  const pieceOf = (b, line, lo, hi) => {
    const fwd = along(line, b.end) >= along(line, b.start);
    const at = s => (line.axis === 'x' ? { x: s, y: 0, z: line.c } : { x: line.c, y: 0, z: s });
    const keepEnd = (p, s) => (Math.abs(along(line, p) - s) < TOL ? p : at(s));
    const [s0, s1] = fwd ? [lo, hi] : [hi, lo];
    return { ...clone(b), start: keepEnd(b.start, s0), end: keepEnd(b.end, s1) };
  };
  // A RESHAPED LINE IS HIS: `auto: false` on every piece of the row and on
  // its posts, so AUTO BEAM's sweep leaves it alone (and placeAutoBeam lays
  // no new line on top of a hand one).
  const handOver = (d, row) => {
    row.forEach(b => { b.auto = false; });
    postsOn(d, row).forEach(c => { c.auto = false; });
  };

  // Every row piece cut to [keepLo, keepHi] pieces: `cut` is a list of
  // intervals along the line to take away. Posts strictly inside a cut go
  // (unless another line holds them), and so does a post no piece reaches.
  const reshapeRow = (d, row, line, cuts) => {
    const before = postsOn(d, row);
    const others = beamsOf(d, row[0].levelId).filter(b => !row.includes(b));
    const onOther = c => others.some(b => segDist(c.point, b.start, b.end) <= ON_LINE_FT);
    let id = nextId(d.beams);
    const pieces = [];
    row.forEach(b => {
      const l = lineOf(b);
      let parts = [[l.lo, l.hi]];
      cuts.forEach(([lo, hi]) => {
        parts = parts.flatMap(([a, z]) => {
          if (hi <= a + TOL || lo >= z - TOL) return [[a, z]];
          return [[a, Math.min(z, lo)], [Math.max(a, hi), z]].filter(([p, q]) => q - p > TOL);
        });
      });
      parts.forEach(([a, z], i) => {
        const piece = pieceOf(b, line, a, z);
        if (i > 0) piece.id = id++;
        // An end that moved is no longer a corner of the outline.
        [['start', b.start], ['end', b.end]].forEach(([k, was]) => {
          if (Math.abs(along(line, piece[k]) - along(line, was)) > TOL) {
            delete piece[k].srcId; delete piece[k].srcIndex; delete piece[k].offX; delete piece[k].offZ;
          }
        });
        pieces.push(piece);
      });
    });
    const inCut = c => cuts.some(([lo, hi]) => {
      const s = along(line, c.point);
      return s > lo + TOL && s < hi - TOL;
    });
    const reached = c => pieces.some(p => segDist(c.point, p.start, p.end) <= ON_LINE_FT);
    const gone = before.filter(c => !onOther(c) && (inCut(c) || !reached(c)));
    d.beams = d.beams.filter(b => !row.includes(b)).concat(pieces);
    d.columns = (d.columns || []).filter(c => !gone.includes(c));
    // Every row the pieces now make.
    const rows = [];
    pieces.forEach(p => { if (!rows.some(r => r.includes(p))) rows.push(rowOf(d, p)); });
    rows.forEach(r => handOver(d, r));
    return { pieces, posts: gone.length };
  };

  const cutSpan = (drawing, { beamId, lo, hi, lock, levelOrder }) => {
    const d = clone(drawing);
    const beam = (d.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return { ok: false, reason: 'NO_BEAM' };
    const row = rowOf(d, beam);
    const line = rowLine(row);
    if (!line) return { ok: false, reason: 'ON_ANGLE' };
    const a = Math.max(line.lo, Math.min(lo, hi)), z = Math.min(line.hi, Math.max(lo, hi));
    if (z - a < TOL) return { ok: false, reason: 'NO_MOVE' };
    const whole = a <= line.lo + TOL && z >= line.hi - TOL;
    if (whole) {
      const res = deleteBeam(drawing, { beamId, lock, levelOrder });
      return res.ok ? { ...res, report: { ...res.report, cutFt: z - a, whole: true, left: 0 } } : res;
    }
    const { pieces, posts } = reshapeRow(d, row, line, [[a, z]]);
    const above = cutAbove(d, beam.levelId, line, a, z, { lock, levelOrder });
    return { ok: true, drawing: d, report: { cutFt: z - a, posts, left: pieces.length, above,
      lengths: pieces.map(p => Math.hypot(p.end.x - p.start.x, p.end.z - p.start.z)) } };
  };

  // ── AN END OF A LINE, MOVED ALONG IT ──────────────────────────────────
  //
  // jb, 16 Nov: "sometimes a beam can cantilever up to 2 ft so we should
  // also allow for this", and "similar to grabbing a roof corner, grab the
  // roof then click on the corner and then M the corner". An end goes in or
  // out along its own line. A FREE END -- one not on a wall -- stands at
  // most CANTILEVER_FT past the last post; an end on a wall has no limit.
  const CANTILEVER_FT = 2;
  const MIN_FT = 1;
  // `which` is 'lo' or 'hi' (the row's ends along its axis); `to` a place
  // along the axis wanted; `walls` the places along the axis where the line
  // crosses the level's bone; `snapFt` the reach of a snap.
  const endLanding = (drawing, { beamId, which, to, walls = [], snapFt = 0 }) => {
    const beam = (drawing.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return { ok: false, reason: 'NO_BEAM' };
    const row = rowOf(drawing, beam);
    const line = rowLine(row);
    if (!line) return { ok: false, reason: 'ON_ANGLE' };
    const posts = postsOn(drawing, row).map(c => along(line, c.point));
    const other = which === 'lo' ? line.hi : line.lo;
    const dir = which === 'lo' ? -1 : 1;
    let s = to, on = null;
    const near = (list, kind) => list.forEach(v => {
      const dist = Math.abs(v - to);
      if (dist <= snapFt && (!on || dist < on.dist)) on = { v, dist, kind };
    });
    near(walls, 'wall');
    near(posts, 'column');
    s = on ? on.v : Math.round(to / STEP_FT) * STEP_FT;
    let kind = on ? on.kind : null;
    // Never past the other end, never shorter than a foot.
    if ((s - other) * dir < MIN_FT) { s = other + dir * MIN_FT; kind = null; }
    const onWall = walls.some(w => Math.abs(w - s) < TOL);
    let capped = false;
    // The posts that stay: those on the inside of the new end.
    const insideOf = v => posts.filter(p => (v - p) * dir >= -TOL);
    const outermost = list => (dir > 0 ? Math.max(...list) : Math.min(...list));
    if (!onWall) {
      const inside = insideOf(s);
      if (!inside.length) {
        // Cut back past every post: the end goes back out to the nearest
        // one, since a line has to stand on something.
        const beyond = posts.filter(p => (p - s) * dir > 0);
        if (!beyond.length) return { ok: false, reason: 'NEEDS_COLUMN' };
        s = dir > 0 ? Math.min(...beyond) : Math.max(...beyond);
        kind = 'column';
        capped = true;
      } else {
        const last = outermost(inside);
        if ((s - last) * dir > CANTILEVER_FT + TOL) { s = last + dir * CANTILEVER_FT; capped = true; kind = null; }
      }
    }
    const was = which === 'lo' ? line.lo : line.hi;
    const inside = insideOf(s);
    const overhangFt = !onWall && inside.length ? Math.max(0, (s - outermost(inside)) * dir) : 0;
    return { ok: true, at: s, was, kind: onWall ? 'wall' : kind, capped, overhangFt };
  };

  // A row's end at `which` taken to `to` along its line: shorter cuts the
  // row back (posts past it go), longer reaches the piece holding it out.
  const endTo = (d, row, line, which, to) => {
    const was = which === 'lo' ? line.lo : line.hi;
    const lengthens = which === 'lo' ? to < was : to > was;
    if (!lengthens) {
      const cut = which === 'lo' ? [line.lo, to] : [to, line.hi];
      return { shorter: true, posts: reshapeRow(d, row, line, [cut]).posts };
    }
    const holder = row.find(b => Math.abs(along(line, b.start) - was) < TOL || Math.abs(along(line, b.end) - was) < TOL);
    const k = Math.abs(along(line, holder.start) - was) < TOL ? 'start' : 'end';
    holder[k] = line.axis === 'x' ? { x: to, y: 0, z: line.c } : { x: line.c, y: 0, z: to };
    handOver(d, rowOf(d, holder));
    return { shorter: false, posts: 0 };
  };
  const moveEnd = (drawing, { beamId, which, to, lock, levelOrder }) => {
    const d = clone(drawing);
    const beam = (d.beams || []).find(b => Number(b.id) === Number(beamId));
    if (!beam) return { ok: false, reason: 'NO_BEAM' };
    const row = rowOf(d, beam);
    const line = rowLine(row);
    if (!line) return { ok: false, reason: 'ON_ANGLE' };
    const was = which === 'lo' ? line.lo : line.hi;
    if (Math.abs(to - was) < TOL) return { ok: false, reason: 'NO_MOVE' };
    const { shorter, posts } = endTo(d, row, line, which, to);
    // LOCKED: a line on any other level whose end stands at the same place
    // (within 3") has that end moved to the same place too.
    let others = 0;
    lockedOthers(d, beam.levelId, { lock, levelOrder }).forEach(up => {
      rowsOver(d, line, up, Math.min(was, to) - ON_LINE_FT, Math.max(was, to) + ON_LINE_FT).forEach(r => {
        const rl = rowLine(r);
        if (!rl || Math.abs(rl[which] - was) > ON_LINE_FT) return;
        if ((which === 'lo' && to >= rl.hi - TOL) || (which === 'hi' && to <= rl.lo + TOL)) return;
        endTo(d, r, rl, which, to);
        others += 1;
      });
    });
    return { ok: true, drawing: d, report: { which, from: was, to, deltaFt: Math.abs(to - was), shorter, posts, others } };
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

  // Where a line crosses the level's walls, as places along it.
  const wallsAlong = (loops, line) => uniq(crossings(loops, line.axis === 'x' ? 'z' : 'x', line.c));

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

  // ── COPY AND PASTE, ONTO ANOTHER LEVEL ────────────────────────────────
  //
  // `pick` is { type: 'beam' | 'column', id } on the level it was copied
  // from; it lands on `toLevelId` in exactly the same place -- a line as its
  // whole row with the posts on it, a column on its own -- less what is
  // already there. UNDER LEVEL LOCK, pasted UP, every level between gets it
  // too (cut to that level's walls, `loopsOf(levelId)`), so it stands on
  // the same piece all the way down to where it was copied from.
  const pasteTo = (drawing, { pick, toLevelId, lock, levelOrder = [], loopsOf }) => {
    const d = clone(drawing);
    d.beams = d.beams || [];
    d.columns = d.columns || [];
    const src = pick && (pick.type === 'beam' ? d.beams : d.columns).find(x => Number(x.id) === Number(pick.id));
    if (!src) return { ok: false, reason: pick && pick.type === 'beam' ? 'NO_BEAM' : 'NO_COLUMN' };
    const from = Number(src.levelId), to = Number(toLevelId);
    if (from === to) return { ok: false, reason: 'SAME_LEVEL' };
    const fi = levelOrder.indexOf(from), ti = levelOrder.indexOf(to);
    const between = lockOn(d, { lock }) && fi >= 0 && ti > fi + 1 ? levelOrder.slice(fi + 1, ti) : [];
    const report = { type: pick.type, levels: 0, between: between.length, beams: 0, columns: 0 };
    const putColumn = (c, id) => {
      if (columnsAt(d, id, c.point).length) return false;
      d.columns.push({ ...clone(c), id: nextId(d.columns), levelId: id,
        view: id === 1 ? 'foundation' : 'floor', auto: false });
      report.columns += 1;
      return true;
    };
    if (pick.type === 'column') {
      [...between, to].forEach(id => { if (putColumn(src, id)) report.levels += 1; });
      return report.columns ? { ok: true, drawing: d, report } : { ok: false, reason: 'ALREADY_THERE' };
    }
    const row = rowOf(d, src);
    const line = rowLine(row);
    const posts = postsOn(d, row);
    const putRow = (id, clip) => {
      let did = false;
      if (!line) {
        // On an angle: the piece as it is, unless one is there already.
        if (beamsOf(d, id).some(b => segDist(src.start, b.start, b.end) < TOL && segDist(src.end, b.start, b.end) < TOL)) return false;
        d.beams.push({ ...clone(src), id: nextId(d.beams), levelId: id, view: id === 1 ? 'foundation' : 'floor', auto: false });
        report.beams += 1;
        did = true;
      } else {
        let parts = clip ? clipToLoops(loopsOf ? loopsOf(id) : null, line, line.lo, line.hi) : [[line.lo, line.hi]];
        rowsOver(d, line, id).forEach(r => {
          const rl = rowLine(r);
          parts = parts.flatMap(([p0, p1]) => [[p0, Math.min(p1, rl.lo)], [Math.max(p0, rl.hi), p1]]
            .filter(([q0, q1]) => q1 - q0 >= 1 - TOL));
        });
        const fwd = along(line, src.end) >= along(line, src.start);
        const P = v => (line.axis === 'x' ? { x: v, y: 0, z: line.c } : { x: line.c, y: 0, z: v });
        parts.forEach(([p0, p1]) => {
          d.beams.push({ ...clone(src), id: nextId(d.beams), levelId: id, view: id === 1 ? 'foundation' : 'floor',
            auto: false, start: P(fwd ? p0 : p1), end: P(fwd ? p1 : p0) });
          report.beams += 1;
          did = true;
        });
      }
      posts.forEach(c => {
        const onIt = beamsOf(d, id).some(b => segDist(c.point, b.start, b.end) <= ON_LINE_FT);
        if (onIt && putColumn(c, id)) did = true;
      });
      return did;
    };
    between.forEach(id => { if (putRow(id, true)) report.levels += 1; });
    if (putRow(to, false)) report.levels += 1;
    return report.beams || report.columns ? { ok: true, drawing: d, report } : { ok: false, reason: 'ALREADY_THERE' };
  };

  // ── IS A COLUMN HELD UP? ──────────────────────────────────────────────
  //
  // jb, 16 Nov: "if there are unsupported columns when it is LOCKED can we
  // make them glow red, and for supported columns can we make them glow
  // green". A column is SUPPORTED when every level under it, down to the
  // FOUNDATION, has a column in the same place (within 3"); a FOUNDATION
  // column stands on its footing. The page asks only under LEVEL LOCK.
  const columnSupport = (d, levelId, levelOrder = []) => {
    const at = levelOrder.indexOf(Number(levelId));
    const under = at > 0 ? levelOrder.slice(0, at) : [];
    return columnsOf(d, levelId).map(c => {
      const missing = under.filter(id => !columnsAt(d, id, c.point).length);
      return { id: c.id, supported: !missing.length, missing };
    });
  };

  window.DraftBoneyardBeams = Object.freeze({
    endStrings, postStrings,
    MAX_SPAN_FT, ON_LINE_FT,
    levelIdOf, viewFor, shown, lineOf, rowOf, rowLine, postsOn, postsBetween, stackedOver,
    columnNear, beamNear, landing, squareEnd,
    addBeam, moveBeam, moveColumn, addColumn, deleteBeam, deleteColumn,
    spanAt, cutSpan, endLanding, moveEnd, wallsAlong, CANTILEVER_FT,
    isLocked, levelsAbove, clipToLoops, pasteTo, columnSupport,
  });
})();
}
