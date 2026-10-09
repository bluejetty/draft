// THE BONEYARD'S EDITS: push a bone's edge, break it, and carry the house.
//
// Movie, 3 Oct, on BONEYARD PR 2: when a bone moves "walls, floors, roof
// follow"; an edge moves by "drag or arrow keys, whole feet", square to itself
// with its corners square; "all of them" of the moving rules; and "also need
// to 'break' the outline (per foot)" -- split an edge at a foot mark so a
// part of it can be pushed on its own.
//
// THE RULES, from RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/HOW-THE-BONEYARD-WORKS.md:
//
//   OUTWARD, any floor or the foundation: everything above responds. A level
//   flush over the pushed edge goes out with it; one that overhangs it spends
//   its overhang first and only travels once the overhang is gone. An
//   overhang that would land between 2'-0" and 4'-6" is trimmed back to
//   2'-0" -- "remove 2'6 from upstairs floors" -- and its piles come out.
//
//   INWARD: "whatever is hooked up inline above also changes and the stuff
//   hanging over the edge is brought inward the exact same amount". A
//   translation: overhangs keep their width.
//
//   A FLOOR'S OWN PULL walks the floor-pull ladder (tour.js floorPullLadder)
//   against the level under it: 0 to 2'-0" free cantilever, 2'-0" to 4'-6"
//   never, piles from 4'-6" out to 18'-0". A nudge that would land in the gap
//   jumps it, so an arrow press from 2'-0" goes to 4'-6" and back.
//
//   PILES under an overhang stand in rows at the ladder's distances, at most
//   8'-0" apart along the edge -- "a safe DEFAULT, not a fixed rule".
//
// HOW THE HOUSE FOLLOWS, and why it is geometry rather than links: a premade
// house carries no master ("a house the bone built has no master until the
// drafter makes one"), so nothing is linked to the bone by id. What IS true
// of every built house is that its walls, decks, slabs and footings stand ON
// the outline -- so a push moves every point lying on the pushed line inside
// the pushed span, on the records of that body: the line's own walls travel,
// the walls meeting it stretch, and where only part of an edge moves a short
// wall closes the jog. The roof's eave is the same edge one overhang out.
//
// Pure: a drawing in, a new drawing and a report out. Nothing here touches
// the page, the store, or the drawing it was handed.
if (!window.DraftBoneyardEdit) {
(() => {
  const TOL = 1e-3;
  const CANTILEVER_FT = 2;
  const FIRST_PILE_FT = 4.5;
  const PILE_SPACING_FT = 8;
  // A cantilever pile is the 10" pile, P1 on the CONCRETE PILE SCHEDULE --
  // the garage's are P2 -- and it is the drafter's (not `auto`), so a later
  // AUTO PILES press, which sweeps its own, leaves it standing.
  const PILE_FOOTING = 'pile10';
  const PILE_MARK = 'P1';
  // How far outside a pushed wall a dimension string may sit and still ride
  // with it -- the auto strings stand 1'-6" apart, three deep.
  const DIM_BAND_FT = 6;
  // A garage pile stands on the grade beam's centreline, a few inches in.
  const PILE_BAND_FT = 1;

  const near = (a, b, t = TOL) => Math.abs(a - b) <= t;
  const clone = value => JSON.parse(JSON.stringify(value));
  const coord = (p, axis) => (axis === 'z' ? p.z : p.x);
  const along = (p, axis) => (axis === 'z' ? p.x : p.z);
  const setCoord = (p, axis, v) => { if (axis === 'z') p.z = v; else p.x = v; };
  const pointAt = (axis, c, u) => (axis === 'z' ? { x: u, z: c } : { x: c, z: u });
  const samePt = (a, b) => near(a.x, b.x) && near(a.z, b.z);

  const inside = (pts, p) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.z > p.z) !== (b.z > p.z)
        && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
    }
    return hit;
  };

  // ── AN EDGE, SQUARE OR NOT ─────────────────────────────────────────────
  //
  // `axis` is the direction the edge MOVES: 'z' for an edge running along x
  // (constant z), 'x' for one running along z. `c` is its line, `lo..hi` its
  // span along the line, `n` the outward sign on the moving axis.
  const edgeOf = (pts, index) => {
    const a = pts[index], b = pts[(index + 1) % pts.length];
    if (!a || !b) return null;
    const dx = b.x - a.x, dz = b.z - a.z;
    if (Math.hypot(dx, dz) < TOL) return null;
    let axis = null;
    if (near(dz, 0)) axis = 'z';
    else if (near(dx, 0)) axis = 'x';
    if (!axis) return { index, square: false };
    const u0 = along(a, axis), u1 = along(b, axis);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const probe = { ...mid };
    setCoord(probe, axis, coord(mid, axis) + 0.01);
    return {
      index, square: true, axis, c: coord(a, axis),
      lo: Math.min(u0, u1), hi: Math.max(u0, u1),
      n: inside(pts, probe) ? -1 : 1,
      length: Math.hypot(dx, dz),
    };
  };
  const edgesOf = pts => pts.map((_, i) => edgeOf(pts, i)).filter(Boolean);

  // ── A LOOP FROM SEGMENTS ───────────────────────────────────────────────
  //
  // The FOUNDATION's bone is its concrete: the walls chained end to end.
  // Collinear joints are kept -- a break in the foundation is a wall split
  // there. Null unless the segments make exactly one closed loop.
  const key = p => `${Math.round(p.x * 1000)},${Math.round(p.z * 1000)}`;
  const chainLoop = segments => {
    const segs = (segments || []).filter(s => s && s.start && s.end && !samePt(s.start, s.end));
    if (segs.length < 3) return null;
    const ends = new Map();
    const add = (k, i) => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); };
    segs.forEach((s, i) => { add(key(s.start), i); add(key(s.end), i); });
    if ([...ends.values()].some(list => list.length !== 2)) return null;
    const used = new Set();
    const pts = [];
    let i = 0;
    let at = segs[0].start;
    while (!used.has(i)) {
      used.add(i);
      pts.push({ x: at.x, z: at.z });
      const s = segs[i];
      const next = samePt(s.start, at) ? s.end : s.start;
      const others = ends.get(key(next)).filter(j => j !== i);
      at = next;
      i = others[0];
    }
    return used.size === segs.length ? pts : null;
  };

  // ── PUSH PART OF A LINE, ON A POLYGON ──────────────────────────────────
  //
  // L = { axis, c, n, lo, hi, delta }. Every vertex on the line inside the
  // span moves by `delta`. Where the polygon carries on along the line past
  // the span, the corner stays and a jog edge joins it to the moved one.
  // `source` says which old edge each new edge came from (null for a jog),
  // so a roof's per-edge eave and overhang can follow.
  const onLine = (p, L) => near(coord(p, L.axis), L.c);
  const inSpan = (p, L) => along(p, L.axis) >= L.lo - TOL && along(p, L.axis) <= L.hi + TOL;
  const strictlyIn = (u, a, b) => u > Math.min(a, b) + TOL && u < Math.max(a, b) - TOL;

  const pushPolygon = (points, L) => {
    const pts = points.map((p, i) => ({ p: { ...p }, e: i }));
    [L.lo, L.hi].forEach(t => {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i].p, b = pts[(i + 1) % pts.length].p;
        if (onLine(a, L) && onLine(b, L) && strictlyIn(t, along(a, L.axis), along(b, L.axis))) {
          pts.splice(i + 1, 0, { p: { ...a, ...pointAt(L.axis, L.c, t) }, e: pts[i].e });
          return;
        }
      }
    });
    const moving = pts.map(v => onLine(v.p, L) && inSpan(v.p, L));
    if (!moving.some(Boolean)) return null;
    const N = pts.length;
    const out = [];
    pts.forEach((v, i) => {
      if (!moving[i]) { out.push(v); return; }
      const prev = pts[(i - 1 + N) % N], next = pts[(i + 1) % N];
      const moved = { ...v.p };
      setCoord(moved, L.axis, L.c + L.delta);
      if (!moving[(i - 1 + N) % N] && onLine(prev.p, L)) out.push({ p: { ...v.p }, e: null });
      if (!moving[(i + 1) % N] && onLine(next.p, L)) {
        out.push({ p: moved, e: null });
        out.push({ p: { ...v.p }, e: v.e });
      } else {
        out.push({ p: moved, e: v.e });
      }
    });
    // A ZERO-LENGTH EDGE GOES: pushed back flush, a jog closes up.
    const clean = [];
    out.forEach(v => {
      const last = clean[clean.length - 1];
      if (last && samePt(last.p, v.p)) { last.e = v.e; return; }
      clean.push(v);
    });
    while (clean.length > 1 && samePt(clean[0].p, clean[clean.length - 1].p)) {
      clean[clean.length - 1].e = clean[0].e;
      clean.shift();
    }
    return { points: clean.map(v => v.p), source: clean.map(v => v.e) };
  };

  // ── PUSH PART OF A LINE, ON SEGMENTS (walls, footings) ─────────────────
  //
  // A segment lying along the line is cut where the span ends and the part
  // inside it travels; a segment meeting the line stretches. Where a moved
  // piece and a staying piece shared an end, a new segment -- a copy of the
  // moved one -- closes the jog.
  const pushSegments = (segs, L, newId) => {
    const out = [];
    const pieces = new Map();
    const changed = new Set();
    const movedAt = new Map();
    const stayedAt = new Set();
    segs.forEach(seg => {
      const s = seg.start, e = seg.end;
      if (!s || !e) { out.push(seg); return; }
      if (onLine(s, L) && onLine(e, L) && !samePt(s, e)) {
        const u0 = along(s, L.axis), u1 = along(e, L.axis);
        const cuts = [u0, ...[L.lo, L.hi].filter(t => strictlyIn(t, u0, u1))
          .sort((a, b) => (u1 > u0 ? a - b : b - a)), u1];
        const made = [];
        for (let k = 0; k < cuts.length - 1; k++) {
          const mid = (cuts[k] + cuts[k + 1]) / 2;
          const moves = mid >= L.lo - TOL && mid <= L.hi + TOL;
          const piece = k === 0 ? seg : { ...clone(seg), id: newId() };
          piece.start = { ...s, ...pointAt(L.axis, L.c, cuts[k]) };
          piece.end = { ...e, ...pointAt(L.axis, L.c, cuts[k + 1]) };
          made.push({ seg: piece, moved: moves,
            from: pointAt(L.axis, L.c, cuts[k]), to: pointAt(L.axis, L.c, cuts[k + 1]) });
          [cuts[k], cuts[k + 1]].forEach(u => {
            const k2 = Math.round(u * 1000);
            if (moves) movedAt.set(k2, piece); else stayedAt.add(k2);
          });
          if (moves) {
            setCoord(piece.start, L.axis, L.c + L.delta);
            setCoord(piece.end, L.axis, L.c + L.delta);
          }
          out.push(piece);
        }
        if (made.some(m => m.moved)) changed.add(seg.id);
        pieces.set(seg.id, made);
        return;
      }
      let moved = false;
      const from = { start: { x: s.x, z: s.z }, end: { x: e.x, z: e.z } };
      [s, e].forEach(p => {
        if (onLine(p, L) && inSpan(p, L)) { setCoord(p, L.axis, L.c + L.delta); moved = true; }
      });
      if (moved) {
        changed.add(seg.id);
        pieces.set(seg.id, [{ seg, moved: false, from: from.start, to: from.end }]);
      }
      out.push(seg);
    });
    const jogs = [];
    [L.lo, L.hi].forEach(t => {
      const k = Math.round(t * 1000);
      if (!movedAt.has(k) || !stayedAt.has(k)) return;
      const model = movedAt.get(k);
      const jog = { ...clone(model), id: newId() };
      jog.start = { ...model.start, ...pointAt(L.axis, L.c, t) };
      jog.end = { ...model.start, ...pointAt(L.axis, L.c + L.delta, t) };
      jogs.push(jog);
      out.push(jog);
    });
    return { list: out, pieces, changed, jogs };
  };

  // ── IDS ────────────────────────────────────────────────────────────────
  //
  // MODEL's string ids share one counter across kinds ("wall-2", "floor-37",
  // "roof-59"), so a new one is one past the highest anywhere in the file.
  const idMaker = drawing => {
    let max = 0;
    Object.values(drawing || {}).forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        const m = /^[a-z]+-(\d+)$/i.exec(String(item && item.id));
        if (m) max = Math.max(max, Number(m[1]));
      });
    });
    return prefix => `${prefix}-${++max}`;
  };
  const numericIdMaker = list => {
    let max = (list || []).reduce((m, item) => Math.max(m, Number(item && item.id) || 0), 0);
    return () => ++max;
  };

  // ── THE RECORDS OF ONE BODY ON ONE LEVEL ───────────────────────────────
  const isGarageWall = w => w && w.body === 'garage';
  const isGarageLine = l => l && l.start && l.start._draftBody === 'garage';
  const centreOf = (wall, offset) => {
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) || 1;
    return { x: wall.start.x + (wall.end.x - wall.start.x) * offset / len,
      z: wall.start.z + (wall.end.z - wall.start.z) * offset / len };
  };
  const project = (seg, p) => {
    const dx = seg.end.x - seg.start.x, dz = seg.end.z - seg.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const t = ((p.x - seg.start.x) * dx + (p.z - seg.start.z) * dz) / len;
    return { t, len, off: Math.abs((p.x - seg.start.x) * dz - (p.z - seg.start.z) * dx) / len };
  };

  // DIMENSION STRINGS ride a pushed wall: an end on it, or a string standing
  // just outside it, travels with it.
  const pushDims = (d, levelId, L) => {
    (d.dimensions || []).forEach(dim => {
      if (Number(dim.levelId) !== Number(levelId)) return;
      [dim.start, dim.end].forEach(p => {
        if (!p) return;
        const s = (coord(p, L.axis) - L.c) * L.n;
        const u = along(p, L.axis);
        const onIt = Math.abs(s) <= TOL && u >= L.lo - TOL && u <= L.hi + TOL;
        const out = s > TOL && s <= DIM_BAND_FT && u >= L.lo - DIM_BAND_FT && u <= L.hi + DIM_BAND_FT;
        if (onIt || out) setCoord(p, L.axis, coord(p, L.axis) + L.delta);
      });
    });
  };

  const pushLevelRecords = (d, levelId, garage, L, newId) => {
    const lid = Number(levelId);
    let touched = false;
    (d.outlines || []).forEach(o => {
      if (Number(o.levelId) !== lid || (o.garage === true) !== garage) return;
      const r = pushPolygon(o.points || [], L);
      if (r) { o.points = r.points.map(p => ({ x: p.x, y: p.y || 0, z: p.z })); touched = true; }
    });
    (d.floors || []).forEach(f => {
      if (Number(f.levelId) !== lid || (f.garage === true) !== garage) return;
      const r = pushPolygon(f.points || [], L);
      if (r) { f.points = r.points.map(p => ({ x: p.x, y: p.y || 0, z: p.z })); touched = true; }
    });
    // WALLS, with their openings kept where they stand on the wall.
    const mine = (d.walls || []).filter(w => Number(w.levelId) === lid && isGarageWall(w) === garage);
    if (mine.length) {
      const fens = (d.fenestrations || []).map(f => {
        const host = mine.find(w => w.id === f.wallId);
        return host ? { f, centre: centreOf(host, Number(f.offset) || 0) } : null;
      }).filter(Boolean);
      const r = pushSegments(mine, L, () => newId('wall'));
      if (r.changed.size || r.jogs.length) touched = true;
      const others = (d.walls || []).filter(w => !mine.includes(w));
      d.walls = [...others, ...r.list];
      fens.forEach(({ f, centre }) => {
        const made = r.pieces.get(f.wallId);
        if (!made) return;
        // The piece of the old wall the opening stood on.
        const home = made.find(m => {
          const pr = project({ start: m.from, end: m.to }, centre);
          return pr.off < 0.05 && pr.t >= -TOL && pr.t <= pr.len + TOL;
        }) || made[0];
        const at = { ...centre };
        if (home.moved) setCoord(at, L.axis, coord(at, L.axis) + L.delta);
        const p = project(home.seg, at);
        f.wallId = home.seg.id;
        f.offset = Math.max(0, Math.min(p.len, p.t));
      });
    }
    const lines = (d.lines || []).filter(l => Number(l.levelId) === lid && isGarageLine(l) === garage);
    if (lines.length) {
      const r = pushSegments(lines, L, () => newId('line'));
      if (r.changed.size || r.jogs.length) touched = true;
      d.lines = [...(d.lines || []).filter(l => !lines.includes(l)), ...r.list];
    }
    pushDims(d, lid, L);
    // POSTS AND BEAMS meeting the line, and a garage's piles on its grade
    // beam a few inches in.
    (d.beams || []).forEach(b => {
      if (Number(b.levelId) !== lid) return;
      [b.start, b.end].forEach(p => {
        if (p && onLine(p, L) && inSpan(p, L)) setCoord(p, L.axis, L.c + L.delta);
      });
    });
    (d.columns || []).forEach(col => {
      if (Number(col.levelId) !== lid || !col.point) return;
      const p = col.point;
      const s = (coord(p, L.axis) - L.c) * L.n;
      const pile = String(col.footing || '').startsWith('pile') && col.pileMark !== PILE_MARK;
      if (!inSpan(p, L)) return;
      if (Math.abs(s) <= TOL || (pile && garage && s < 0 && s >= -PILE_BAND_FT)) {
        setCoord(p, L.axis, coord(p, L.axis) + L.delta);
      }
    });
    return touched;
  };

  // ── THE ROOF OVER A PUSHED EDGE ────────────────────────────────────────
  //
  // Its eave is the same edge one overhang out. Where the pushed span ends
  // on a corner the eave's end is that corner's own offset -- out past a
  // corner that turns in, in from one that turns out -- and where it ends
  // part-way along an edge the new jog decides: a bump out widens the eave
  // by the overhang each side, a notch in narrows it.
  const endSign = (oldPts, L, t, out) => {
    const at = oldPts.findIndex(p => onLine(p, L) && near(along(p, L.axis), t));
    if (at < 0) return out > 0 ? 1 : -1;
    const N = oldPts.length;
    const nbs = [oldPts[(at - 1 + N) % N], oldPts[(at + 1) % N]];
    const off = nbs.find(p => !onLine(p, L));
    const onward = nbs.find(p => onLine(p, L) && !inSpan(p, L));
    if (onward || !off) return out > 0 ? 1 : -1;
    return (coord(off, L.axis) - L.c) * L.n < 0 ? 1 : -1;
  };

  const pushRoofs = (d, roofs, oldPts, L) => {
    let moved = 0;
    const out = L.delta * L.n;
    roofs.forEach(roof => {
      const pts = roof.points || [];
      const ohOf = i => Number((roof.edgeOverhang || [])[i] ?? roof.overhang ?? 0) || 0;
      const match = edgesOf(pts).find(e => e.square && e.axis === L.axis && e.n === L.n
        && near(e.c, L.c + L.n * ohOf(e.index), 0.01)
        && e.hi > L.lo - ohOf(e.index) - TOL && e.lo < L.hi + ohOf(e.index) + TOL);
      if (!match) return;
      const oh = ohOf(match.index);
      const sLo = endSign(oldPts, L, L.lo, out);
      const sHi = endSign(oldPts, L, L.hi, out);
      const Lr = { axis: L.axis, n: L.n, c: match.c, delta: L.delta,
        lo: L.lo - sLo * oh, hi: L.hi + sHi * oh };
      if (Lr.hi - Lr.lo < TOL) return;
      const r = pushPolygon(pts, Lr);
      if (!r) return;
      const edges = roof.edges || [];
      const ohs = roof.edgeOverhang || [];
      roof.points = r.points.map(p => ({ x: p.x, z: p.z }));
      if (Array.isArray(roof.edges)) roof.edges = r.source.map(s => (s == null ? 'eave' : edges[s] || 'eave'));
      if (Array.isArray(roof.edgeOverhang)) {
        roof.edgeOverhang = r.source.map(s => (s == null ? Number(roof.overhang) || 0 : ohs[s]));
      }
      pushDims(d, roof.levelId, Lr);
      moved += 1;
    });
    return moved;
  };

  // ── THE LADDER ─────────────────────────────────────────────────────────
  //
  // Where an overhang may stand, given where it was asked to go. A nudge that
  // the ladder would snap straight back to where it started jumps the gap
  // instead, so arrows step 2'-0" -> 4'-6" -> 5'-6" ... and back down.
  const snapOverhang = (ladder, want, was) => {
    if (want <= TOL) return want;
    const got = ladder(want).d;
    if (near(got, was, 0.01) && !near(want, was, 0.01)) {
      if (want > was && near(was, CANTILEVER_FT, 0.01)) return FIRST_PILE_FT;
      if (want < was && near(was, FIRST_PILE_FT, 0.01)) return CANTILEVER_FT;
    }
    return got;
  };

  // The piles under one overhang strip: those this module placed come out,
  // and the ladder's rows for the new width go in, at most 8'-0" apart.
  const rePile = (d, strip, ladder, spacingFt) => {
    const { axis, n, base, lo, hi, oldH, newH } = strip;
    const reach = Math.max(oldH, newH, 0);
    const inStrip = p => {
      const s = (coord(p, axis) - base) * n;
      const u = along(p, axis);
      return s > TOL && s <= reach + 0.25 && u >= lo - 0.25 && u <= hi + 0.25;
    };
    // ONLY OUTSIDE THE FOUNDATION. Movie, 5 Oct: "the piles are needed when
    // the roof or floors are pulled over area with no foundation below
    // (exterior of foundation perimeter)". A roof pushed out over the house
    // hangs over the house's own concrete, so no pile goes there.
    const footprints = (d.floors || []).filter(f => f && f.view === 'foundation'
      && Array.isArray(f.points) && f.points.length >= 3).map(f => f.points);
    const onFoundation = p => footprints.some(pts => inside(pts, p)
      || pts.some((a, i) => {
        const b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
        return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz) < 0.5;
      }));
    const before = (d.columns || []).length;
    d.columns = (d.columns || []).filter(col => !(col.footing === PILE_FOOTING
      && col.pileMark === PILE_MARK && col.auto !== true && Number(col.levelId) === 1
      && col.point && inStrip(col.point)));
    const removed = before - d.columns.length;
    let placed = 0;
    if (newH >= FIRST_PILE_FT - TOL && hi - lo > TOL) {
      const nextId = numericIdMaker(d.columns);
      const rows = ladder(newH).piles || [];
      const count = Math.max(1, Math.ceil((hi - lo) / spacingFt - TOL));
      rows.forEach(r => {
        for (let k = 0; k <= count; k++) {
          const u = lo + (hi - lo) * k / count;
          const p = pointAt(axis, base + r * n, u);
          if (onFoundation(p)) continue;
          d.columns.push({ id: nextId(), point: { x: p.x, y: 0, z: p.z }, levelId: 1,
            view: 'foundation', footing: PILE_FOOTING, pileMark: PILE_MARK });
          placed += 1;
        }
      });
    }
    return { removed, placed };
  };

  // ── THE BONES, AS THE EDITOR SEES THEM ─────────────────────────────────
  //
  // `levels` is boneyard-loops' boneLevels: foundation, the floors and the
  // roof, each with its loops and the elevation it stands at. The loops a
  // push can reach are the foundation's and the floors'.
  const floorsOf = levels => (levels || []).filter(l => l.kind === 'foundation' || l.kind === 'floor')
    .slice().sort((a, b) => a.elev - b.elev);
  // The bilevel's ENTRY level (cut-view's ENTRY_LEVEL_ID): a landing inside
  // the house, framed on the slab -- see pushEdge.
  const LANDING_LEVEL_ID = 2;
  const isLanding = l => l.kind === 'floor' && Number(l.levelId) === LANDING_LEVEL_ID;
  // The farthest a floor hangs past what is under it (tour.js FLOOR_PULL_MAX_FT).
  const REACH_FT = 18;
  // Every edge of `lvl` lying on the moved line, whichever way it faces, goes
  // with it by the same world distance -- a notch's side moves with the
  // landing that fills it.
  const carryOnLine = (d, lvl, e, lo, hi, worldDelta, newId, report) => {
    let moved = false;
    lvl.loops.forEach(lp => {
      if (lp.garage) return;
      edgesOf(lp.points).forEach(o => {
        if (!o.square || o.axis !== e.axis || !near(o.c, e.c)) return;
        const a = Math.max(lo, o.lo), b = Math.min(hi, o.hi);
        if (b - a <= TOL) return;
        pushLevelRecords(d, lvl.levelId, false,
          { axis: o.axis, c: o.c, n: o.n, lo: a, hi: b, delta: worldDelta }, newId);
        moved = true;
      });
    });
    if (moved && !report.moves.some(m => m.levelId === lvl.levelId && m.kind === lvl.kind)) {
      report.moves.push({ name: lvl.name, levelId: lvl.levelId, kind: lvl.kind, outFt: worldDelta * e.n });
    }
  };
  const pushLanding = (drawing, req, ctx, all) => {
    const level = all.find(isLanding);
    const loop = level.loops[req.loopIndex];
    if (!loop) return { ok: false, reason: 'NO_LOOP' };
    const edge = edgeOf(loop.points, req.edgeIndex);
    if (!edge) return { ok: false, reason: 'NO_EDGE' };
    if (!edge.square) return { ok: false, reason: 'NOT_SQUARE' };
    const want = Math.round(Number(req.deltaFt) || 0);
    if (!want) return { ok: false, reason: 'NO_MOVE' };
    const out = want * edge.n;
    const d = clone(drawing);
    const newId = idMaker(d);
    const report = { moves: [], trims: [], piles: { placed: 0, removed: 0 }, roofs: 0, overhangFt: null };
    const L = { axis: edge.axis, c: edge.c, n: edge.n, lo: edge.lo, hi: edge.hi, delta: out * edge.n };
    pushLevelRecords(d, level.levelId, false, L, newId);
    report.moves.push({ name: level.name, levelId: level.levelId, kind: level.kind, outFt: out });
    // MAIN FL's notch around the landing: the storey the landing is cut
    // into, which is the next floor up. The room over the garage is not --
    // its back wall shares the landing's front line only by being built on it.
    const into = all.filter(l => l.kind === 'floor' && l.elev > level.elev)
      .sort((a, b) => a.elev - b.elev)[0];
    if (into) carryOnLine(d, into, edge, edge.lo, edge.hi, out * edge.n, newId, report);
    return { ok: true, drawing: d, report };
  };

  const levelOf = (levels, kind, levelId) => (levels || []).find(l => l.kind === kind
    && Number(l.levelId) === Number(levelId));

  // The edge on a level that a moved edge below is "inline" with: parallel,
  // facing the same way, over the moved span, and flush or hanging past it.
  const inlineEdge = (level, ref) => {
    let best = null;
    level.loops.forEach(loop => edgesOf(loop.points).forEach(e => {
      if (!e.square || e.axis !== ref.axis || e.n !== ref.n) return;
      if (Math.min(e.hi, ref.hi) - Math.max(e.lo, ref.lo) <= TOL) return;
      const h = (e.c - ref.c) * ref.n;
      if (h < -TOL) return;
      if (!best || h < best.h) best = { loop, edge: e, h };
    }));
    return best;
  };
  // The edge under a floor's edge it overhangs, flush, or stands back from.
  const belowEdge = (level, ref) => {
    let best = null;
    level.loops.forEach(loop => {
      if (loop.garage) return;
      edgesOf(loop.points).forEach(e => {
        if (!e.square || e.axis !== ref.axis || e.n !== ref.n) return;
        if (Math.min(e.hi, ref.hi) - Math.max(e.lo, ref.lo) <= TOL) return;
        const h = (ref.c - e.c) * ref.n;
        if (!best || Math.abs(h) < Math.abs(best.h)) best = { loop, edge: e, h };
      });
    });
    return best;
  };

  const roofsFor = (d, levelId, roofSourceId) => (d.roofs || []).filter(r =>
    (r.sourceLevelId != null ? Number(r.sourceLevelId) === Number(levelId)
      : Number(levelId) === Number(roofSourceId)));

  // ── PUSH ───────────────────────────────────────────────────────────────
  //
  // req: { kind, levelId, loopIndex, edgeIndex, deltaFt } -- deltaFt along
  // the edge's moving axis in world feet (+x / +z), whole feet.
  // ctx: { levels, ladder, roofSourceId, pileSpacingFt }.
  // Returns { ok: true, drawing, report } or { ok: false, reason }.
  const pushEdge = (drawing, req, ctx) => {
    if (req.kind === 'roof') return pushRoofEdge(drawing, req, ctx);
    // ── A BILEVEL'S ENTRY IS A LANDING, NOT A STOREY ──────────────────
    //
    // Movie, 4 Oct, stretching the ENTRY of a MOD BILEVEL: the status said
    // "8 piles under the overhang", then "10", and the dots landed inside the
    // house -- "they shouldn't show up there on the interior". The ENTRY sits
    // below MAIN FL in the list, so the editor read it as the storey MAIN
    // bears on: an ENTRY push measured itself against the foundation's far
    // wall as a cantilever and piled it, and an inward push dragged MAIN FL's
    // back wall -- 34 ft away, the nearest edge facing the same way -- in by
    // the same amount, folding MAIN's outline back on itself.
    //
    // THE LANDING STANDS INSIDE THE HOUSE, on the slab. So it is out of the
    // stack the ladder and the cascade climb: MAIN FL bears on the foundation,
    // and a push of the landing moves the landing and MAIN FL's notch around
    // it (the edges lying on the same line), with no ladder and no piles.
    const all = floorsOf(ctx.levels);
    const landing = all.find(isLanding) || null;
    const asked = all.find(l => l.kind === req.kind && Number(l.levelId) === Number(req.levelId));
    if (!asked) return { ok: false, reason: 'NO_LEVEL' };
    if (asked === landing) return pushLanding(drawing, req, ctx, all);
    const stack = all.filter(l => l !== landing);
    const p = stack.indexOf(asked);
    const level = stack[p];
    const loop = level.loops[req.loopIndex];
    if (!loop) return { ok: false, reason: 'NO_LOOP' };
    const edge = edgeOf(loop.points, req.edgeIndex);
    if (!edge) return { ok: false, reason: 'NO_EDGE' };
    if (!edge.square) return { ok: false, reason: 'NOT_SQUARE' };
    const want = Math.round(Number(req.deltaFt) || 0);
    if (!want) return { ok: false, reason: 'NO_MOVE' };
    // AN EDGE THE GARAGE AND THE HOUSE SHARE moves neither: the two bodies
    // meet there and a push would walk one into the other.
    const shared = level.loops.some((other, i) => i !== req.loopIndex
      && edgesOf(other.points).some(e => e.square && e.axis === edge.axis && near(e.c, edge.c)
        && Math.min(e.hi, edge.hi) - Math.max(e.lo, edge.lo) > TOL));
    if (shared) return { ok: false, reason: 'SHARED' };

    const ladder = ctx.ladder;
    const spacingFt = Number(ctx.pileSpacingFt) > 0 ? Number(ctx.pileSpacingFt) : PILE_SPACING_FT;
    let out = want * edge.n;
    const report = { moves: [], trims: [], piles: { placed: 0, removed: 0 }, roofs: 0, overhangFt: null };
    const strips = [];

    // A FLOOR'S OWN PULL walks the ladder against what is under it. The
    // garage stands on its own concrete, so it has no ladder.
    if (level.kind === 'floor' && !loop.garage && p > 0 && ladder) {
      const under = belowEdge(stack[p - 1], edge);
      if (under) {
        const wantH = under.h + out;
        const gotH = snapOverhang(ladder, wantH, under.h);
        out = gotH - under.h;
        report.overhangFt = gotH;
        const lo = Math.max(edge.lo, under.edge.lo), hi = Math.min(edge.hi, under.edge.hi);
        strips.push({ axis: edge.axis, n: edge.n, base: under.edge.c, lo, hi,
          oldH: under.h, newH: gotH });
      }
    }
    if (near(out, 0)) return { ok: false, reason: 'NO_RUNG' };

    const d = clone(drawing);
    const newId = idMaker(d);
    const moveLoop = (lvl, lp, e, lo, hi, amount) => {
      const L = { axis: e.axis, c: e.c, n: e.n, lo, hi, delta: amount * e.n };
      const garage = lp.garage === true;
      if (lvl.kind === 'foundation') pushLevelRecords(d, 1, false, L, newId);
      else {
        pushLevelRecords(d, lvl.levelId, garage, L, newId);
        if (garage) pushLevelRecords(d, 1, true, L, newId);
        report.roofs += pushRoofs(d, roofsFor(d, lvl.levelId, ctx.roofSourceId), lp.points, L);
      }
      // One line per level and distance, however many of its edges moved.
      if (!report.moves.some(m => m.levelId === lvl.levelId && m.kind === lvl.kind && near(m.outFt, amount))) {
        report.moves.push({ name: lvl.name, levelId: lvl.levelId, kind: lvl.kind, outFt: amount });
      }
      // The landing's edges on the same line go with it: the entry's front
      // is the house's front where the two meet.
      if (landing && !garage) carryOnLine(d, landing, e, lo, hi, amount * e.n, newId, report);
    };

    moveLoop(level, loop, edge, edge.lo, edge.hi, out);

    // ── AND EVERYTHING ABOVE ───────────────────────────────────────────
    let prev = { axis: edge.axis, n: edge.n, c: edge.c, lo: edge.lo, hi: edge.hi, out };
    for (let q = p + 1; q < stack.length; q++) {
      const lvl = stack[q];
      if (lvl.kind !== 'floor') continue;
      const hit = inlineEdge(lvl, prev);
      if (!hit) break;
      // HOOKED, NOT MERELY FACING THE SAME WAY. An edge further out than the
      // ladder ever reaches is not hanging off this one -- it is another wall
      // of the building -- so an inward push does not drag it.
      if (prev.out < 0 && hit.h > REACH_FT + TOL) break;
      // ALL OF THE LEVEL'S EDGES ON THAT LINE, not the first one found: a
      // notched front (a bilevel's MAIN FL around its entry) is two edges on
      // one line, and moving one left the other standing behind.
      const twins = [];
      lvl.loops.forEach(lp => edgesOf(lp.points).forEach(e => {
        if ((lp === hit.loop && e.index === hit.edge.index) || !e.square || e.axis !== prev.axis || e.n !== prev.n
          || !near(e.c, hit.edge.c) || lp.garage !== hit.loop.garage) return;
        if (Math.min(e.hi, prev.hi) - Math.max(e.lo, prev.lo) <= TOL) return;
        twins.push({ loop: lp, edge: e });
      }));
      // OVER A GARAGE, NOT OVER AIR. The room over a garage stands on the
      // garage's walls; the strip between this line and it is the garage's
      // roof, and needs no piles and no trim.
      const mid = pointAt(prev.axis, prev.c + (prev.out + hit.h) / 2 * prev.n,
        (Math.max(prev.lo, hit.edge.lo) + Math.min(prev.hi, hit.edge.hi)) / 2);
      const overGarage = stack.slice(0, q).some(l => l.loops.some(lp => lp.garage
        && inside(lp.points, mid)));
      if (overGarage) break;
      const lo = Math.max(prev.lo, hit.edge.lo), hi = Math.min(prev.hi, hit.edge.hi);
      let move = 0;
      if (prev.out > 0) {
        const left = hit.h - prev.out;
        if (left <= TOL) move = -left;
        else if (left > CANTILEVER_FT + TOL && left < FIRST_PILE_FT - TOL) {
          move = CANTILEVER_FT - left;
          report.trims.push({ name: lvl.name, levelId: lvl.levelId, trimFt: -move });
        }
      } else {
        move = prev.out;
      }
      const newH = hit.h + move - prev.out;
      strips.push({ axis: edge.axis, n: edge.n, base: prev.c + prev.out * prev.n, lo, hi,
        oldH: hit.h + 0, newH, oldBase: prev.c });
      if (!near(move, 0)) {
        moveLoop(lvl, hit.loop, hit.edge, lo, hi, move);
        twins.forEach(t => moveLoop(lvl, t.loop, t.edge,
          Math.max(prev.lo, t.edge.lo), Math.min(prev.hi, t.edge.hi), move));
      }
      if (near(move, 0)) break;
      prev = { axis: edge.axis, n: edge.n, c: hit.edge.c, lo, hi, out: move };
    }

    // ── THE PILES UNDER EVERY OVERHANG THAT CHANGED ────────────────────
    strips.forEach(s => {
      // Both the strip as it was and as it is: a pile the old overhang
      // needed may stand where the new one does not reach.
      const old = { ...s, base: s.oldBase ?? s.base, newH: -1, oldH: s.oldH };
      const r0 = rePile(d, old, ladder || (() => ({ piles: [] })), spacingFt);
      const r1 = rePile(d, s, ladder || (() => ({ piles: [] })), spacingFt);
      report.piles.removed += r0.removed + r1.removed;
      report.piles.placed += r1.placed;
    });
    return { ok: true, drawing: d, report };
  };

  // ── THE ROOF, PULLED ON ITS OWN ────────────────────────────────────────
  //
  // "ROOF follows the 2ND FL outline by default, but can also be pulled out
  // on its own (front entry, covered back deck), by the same ladder: a pile
  // at 4'-6" minimum, then about every 8 ft." The roof's bone is its eave
  // brought in by its overhang; pulling it walks the ladder against the top
  // floor's wall and moves the eave the same distance. It never comes in
  // past the wall it sits on.
  const pushRoofEdge = (drawing, req, ctx) => {
    const roofLevel = levelOf(ctx.levels, 'roof', req.levelId);
    const loop = roofLevel && roofLevel.loops[req.loopIndex];
    const edge = loop && edgeOf(loop.points, req.edgeIndex);
    if (!edge) return { ok: false, reason: 'NO_EDGE' };
    if (!edge.square) return { ok: false, reason: 'NOT_SQUARE' };
    const want = Math.round(Number(req.deltaFt) || 0);
    if (!want) return { ok: false, reason: 'NO_MOVE' };
    const ladder = ctx.ladder;
    const spacingFt = Number(ctx.pileSpacingFt) > 0 ? Number(ctx.pileSpacingFt) : PILE_SPACING_FT;
    let out = want * edge.n;
    // A loop on a plate of its own stands on its own floor.
    const top = levelOf(ctx.levels, 'floor', loop.sourceLevelId ?? roofLevel.sourceLevelId);
    const under = top && belowEdge(top, edge);
    const strips = [];
    if (under) {
      const wantH = Math.max(0, under.h + out);
      const gotH = ladder ? snapOverhang(ladder, wantH, under.h) : wantH;
      out = gotH - under.h;
      strips.push({ axis: edge.axis, n: edge.n, base: under.edge.c,
        lo: Math.max(edge.lo, under.edge.lo), hi: Math.min(edge.hi, under.edge.hi),
        oldH: under.h, newH: gotH });
    }
    if (near(out, 0)) return { ok: false, reason: 'NO_RUNG' };
    const d = clone(drawing);
    const L = { axis: edge.axis, c: edge.c, n: edge.n, lo: edge.lo, hi: edge.hi, delta: out * edge.n };
    // The roof that loop IS, where it is one; otherwise the house's.
    const mine = (d.roofs || []).filter(r => r.id != null && r.id === loop.id);
    const roofs = mine.length ? mine : (d.roofs || []).filter(r => r.sourceLevelId == null && !r.garage);
    const moved = pushRoofs(d, roofs, loop.points, L);
    if (!moved) return { ok: false, reason: 'NO_ROOF' };
    const report = { moves: [{ name: 'ROOF', levelId: 7, kind: 'roof', outFt: out }], trims: [],
      piles: { placed: 0, removed: 0 }, roofs: moved, overhangFt: under ? under.h + out : null };
    strips.forEach(s => {
      const r0 = rePile(d, { ...s, newH: -1 }, ladder || (() => ({ piles: [] })), spacingFt);
      const r1 = rePile(d, s, ladder || (() => ({ piles: [] })), spacingFt);
      report.piles.removed += r0.removed + r1.removed;
      report.piles.placed += r1.placed;
    });
    // AND THE WALL UNDER IT, where it now stands over the main roof.
    roofs.forEach(r => { report.hoodWalls = (report.hoodWalls || 0) + roofHood(d, r, ctx); });
    return { ok: true, drawing: d, report };
  };

  // ── THE WALL UNDER AN UPPER ROOF THAT RUNS OUT OVER THE MAIN ROOF ──────
  //
  // Movie, 4-5 Oct, pushing the room-over-the-garage's roof out over the
  // house: "the roof and 2nd floor wall over the main floor area should have
  // a WALL that goes at the wall distance from edge of roof eave overhang
  // (2ft typ ...) and lines up with the walls over the garage on each side",
  // "a wall that goes from the bottom of the 2nd fl roof to the top of the
  // main fl ceiling", stick framed "so there won't be a jog".
  //
  // SO: the roof's wall line -- its outline moved in by its overhang -- less
  // what the room's own walls already stand on, ON that line. A room wall a
  // jog off it does not count: Movie, 5 Oct, marking x 19 beside the room's
  // x 20 in red, "make sure to add the 'stickframed wall to flatten out the
  // back wall". Kept only where it is over the house's
  // foundation, i.e. over the main roof. Walls there go on the room's level
  // from MAIN's ceiling to the room's plate (ctx.hoodHeights), tagged with
  // the roof's id so the next push replaces exactly them. Returns the count.
  // ── AND THE MAIN ROOF STOPS AT THOSE WALLS ──────────────────────────────
  //
  // Movie, 5 Oct: "the main floor roof should stop at the new wall" -- "except
  // at the part where it jogs in the back ... the main roof will go all the
  // way to the actual 2nd floor wall (will be about 3ft overhang), but a
  // small stickframed wall at 2ft will make that wall appear flat".
  //
  // SO THE CUT IS what the new walls box in over the house: inside the
  // upper roof's wall line and over the house's foundation, less the strip
  // between a stick-framed wall and the room's own wall a jog behind it. On
  // the main roof (the house's own, not a garage's), as rectangles -- the
  // cells of the grid every one of those corners lies on, merged by row --
  // tagged with the upper roof's id like the walls are.
  const cutMainRoof = (d, roof, line, house, runs, roomEdges) => {
    const main = (d.roofs || []).filter(r => !r.garage && r.sourceLevelId == null);
    if (!main.length) return;
    const strips = [];
    runs.forEach(r => roomEdges.forEach(e => {
      if (!e.square || e.axis !== r.axis) return;
      const gap = Math.abs(e.c - r.c);
      if (gap < 1e-6 || gap > 1.5 + 1e-6) return;
      const lo = Math.max(r.lo, e.lo), hi = Math.min(r.hi, e.hi);
      if (hi - lo < 0.01) return;
      const c0 = Math.min(r.c, e.c), c1 = Math.max(r.c, e.c);
      strips.push(r.axis === 'x' ? { x0: c0, x1: c1, z0: lo, z1: hi } : { x0: lo, x1: hi, z0: c0, z1: c1 });
    }));
    const all = [...line, ...house.flat()];
    const xs = [...new Set(all.map(p => p.x))].sort((u, v) => u - v);
    const zs = [...new Set(all.map(p => p.z))].sort((u, v) => u - v);
    const inStrip = p => strips.some(s => p.x > s.x0 && p.x < s.x1 && p.z > s.z0 && p.z < s.z1);
    const rows = [];
    for (let j = 0; j < zs.length - 1; j++) {
      let run = null;
      for (let i = 0; i < xs.length - 1; i++) {
        const mid = { x: (xs[i] + xs[i + 1]) / 2, z: (zs[j] + zs[j + 1]) / 2 };
        const take = inside(line, mid) && house.some(h => inside(h, mid)) && !inStrip(mid);
        if (take && run) run.x1 = xs[i + 1];
        else if (take) run = { x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] };
        if (!take && run) { rows.push(run); run = null; }
      }
      if (run) rows.push(run);
    }
    // A row run continuing one directly above it, same ends, is one rectangle.
    const rects = [];
    rows.forEach(r => {
      const above = rects.find(q => near(q.x0, r.x0) && near(q.x1, r.x1) && near(q.z1, r.z0));
      if (above) above.z1 = r.z1; else rects.push({ ...r });
    });
    if (!rects.length) return;
    main.forEach(r => {
      r.cuts = (r.cuts || []).concat(rects.map(q => ({
        points: [{ x: q.x0, z: q.z0 }, { x: q.x1, z: q.z0 }, { x: q.x1, z: q.z1 }, { x: q.x0, z: q.z1 }],
        hoodOf: String(roof.id),
      })));
    });
  };
  const roofHood = (d, roof, ctx) => {
    if (!roof || roof.garage || roof.sourceLevelId == null || !ctx || !ctx.hoodHeights) return 0;
    // A MODIFIED BILEVEL ONLY, for now. Movie, 5 Oct: "for now lets only do
    // this for MODIFIED BILEVEL to accomodate the stair / balcony area which
    // shouldn't be necessary in the other houses".
    if (d.buildType !== 'modifiedBilevel') return 0;
    const levelId = Number(roof.sourceLevelId);
    d.walls = (d.walls || []).filter(w => w.hoodOf !== String(roof.id));
    (d.roofs || []).forEach(r => {
      if (!Array.isArray(r.cuts)) return;
      r.cuts = r.cuts.filter(cut => cut.hoodOf !== String(roof.id));
      if (!r.cuts.length) delete r.cuts;
    });
    const heights = ctx.hoodHeights(levelId);
    const pts = roof.points || [];
    if (!heights || pts.length < 4 || !pts.every((p, i) => {
      const q = pts[(i + 1) % pts.length];
      return near(p.x, q.x) || near(p.z, q.z);
    })) return 0;
    const room = (d.outlines || []).find(o => Number(o.levelId) === levelId && !o.garage);
    const house = (d.floors || []).filter(f => f && f.view === 'foundation' && !f.garage
      && Array.isArray(f.points) && f.points.length >= 3).map(f => f.points);
    if (!room || !house.length) return 0;
    const o = Number(roof.overhang) > 0 ? Number(roof.overhang) : 2;
    // The wall line: each edge moved in by the overhang, corners where the
    // moved lines meet (a straight-through vertex just moves in).
    const area = pts.reduce((s, p, i) => {
      const q = pts[(i + 1) % pts.length];
      return s + p.x * q.z - q.x * p.z;
    }, 0);
    const inward = (a, b) => {
      const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
      return area > 0 ? { x: -dz, z: dx } : { x: dz, z: -dx };
    };
    const line = pts.map((p, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length], next = pts[(i + 1) % pts.length];
      const n1 = inward(prev, p), n2 = inward(p, next);
      const same = near(n1.x, n2.x) && near(n1.z, n2.z);
      return { x: p.x + o * (same ? n1.x : n1.x + n2.x), z: p.z + o * (same ? n1.z : n1.z + n2.z) };
    });
    const roomEdges = edgesOf(room.points);
    const inHouse = p => house.some(h => inside(h, p));
    const runs = [];
    line.forEach((a, i) => {
      const b = line[(i + 1) % line.length];
      const axis = near(a.z, b.z) ? 'z' : 'x';
      const c = axis === 'z' ? a.z : a.x;
      const lo = Math.min(along(a, axis), along(b, axis)), hi = Math.max(along(a, axis), along(b, axis));
      if (hi - lo < 0.01) return;
      let open = [[lo, hi]];
      roomEdges.forEach(e => {
        if (!e.square || e.axis !== axis || Math.abs(e.c - c) > 1e-6) return;
        open = open.flatMap(([p0, p1]) => [[p0, Math.min(p1, e.lo)], [Math.max(p0, e.hi), p1]])
          .filter(([p0, p1]) => p1 - p0 > 0.01);
      });
      // Over the house only: cut at every house corner and keep the pieces
      // whose middle is inside.
      const cuts = [...new Set(house.flat().map(p => along(p, axis)))];
      open.forEach(([p0, p1]) => {
        const marks = [p0, ...cuts.filter(v => v > p0 + 0.01 && v < p1 - 0.01), p1].sort((u, v) => u - v);
        let start = null;
        for (let k = 0; k < marks.length - 1; k++) {
          const mid = (marks[k] + marks[k + 1]) / 2;
          const keep = inHouse(pointAt(axis, c, mid));
          if (keep && start == null) start = marks[k];
          if ((!keep || k === marks.length - 2) && start != null) {
            const end = keep ? marks[k + 1] : marks[k];
            if (end - start > 0.01) runs.push({ axis, c, lo: start, hi: end, inward: inward(a, b) });
            start = null;
          }
        }
      });
    });
    const newId = idMaker(d);
    const like = (d.walls || []).find(w => Number(w.levelId) === levelId && w.body !== 'garage');
    // ON THE EXTERIOR FACE, like the room's own walls, so the two line up
    // outside (Movie, 9 Oct: "why is it CENTERLINE ? should be EXT line so it
    // lines up"). A run goes low to high, so its inside is whichever side of
    // that direction faces in from the wall line: 'left' is (-dz, dx), the
    // side build-house.js's outlineInteriorRef names for a ring wound that way.
    runs.forEach(r => {
      const a = pointAt(r.axis, r.c, r.lo), b = pointAt(r.axis, r.c, r.hi);
      const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
      const n = r.inward;
      const refLine = (near(n.x, -dz) && near(n.z, dx)) ? 'left' : 'right';
      d.walls.push({
        id: newId('wall'),
        start: { x: a.x, y: 0, z: a.z }, end: { x: b.x, y: 0, z: b.z },
        levelId, view: 'plan',
        wallType: (like && like.wallType) || 'stud_2x6',
        refLine,
        baseHeight: heights.baseHeight, topHeight: heights.topHeight,
        hoodOf: String(roof.id),
      });
    });
    if (runs.length) cutMainRoof(d, roof, line, house, runs, roomEdges);
    return runs.length;
  };

  // ── BREAK ──────────────────────────────────────────────────────────────
  //
  // A corner where there was none, on a foot mark, so part of an edge can be
  // pushed alone. A floor's bone gets the corner in its outline; the
  // foundation's bone is its concrete, so the wall and the footing under it
  // are cut there instead.
  const breakEdge = (drawing, req, ctx) => {
    if (req.kind === 'roof') return breakRoofEdge(drawing, req, ctx);
    const stack = floorsOf(ctx.levels);
    const level = stack.find(l => l.kind === req.kind && Number(l.levelId) === Number(req.levelId));
    const loop = level && level.loops[req.loopIndex];
    const edge = loop && edgeOf(loop.points, req.edgeIndex);
    if (!edge) return { ok: false, reason: 'NO_EDGE' };
    if (!edge.square) return { ok: false, reason: 'NOT_SQUARE' };
    const u = Math.round(Number(req.atFt));
    if (!(u >= edge.lo + 1 - TOL && u <= edge.hi - 1 + TOL)) return { ok: false, reason: 'AT_END' };
    const at = pointAt(edge.axis, edge.c, u);
    const d = clone(drawing);
    if (level.kind === 'foundation') {
      const newId = idMaker(d);
      const split = (list, keep, prefix) => {
        const outList = [];
        list.forEach(seg => {
          if (!keep(seg) || !seg.start || !seg.end
            || !onLine(seg.start, edge) || !onLine(seg.end, edge)
            || !strictlyIn(u, along(seg.start, edge.axis), along(seg.end, edge.axis))) {
            outList.push(seg);
            return;
          }
          const second = { ...clone(seg), id: newId(prefix) };
          seg.end = { ...seg.end, x: at.x, z: at.z };
          second.start = { ...second.start, x: at.x, z: at.z };
          outList.push(seg, second);
        });
        return outList;
      };
      d.walls = split(d.walls || [], w => Number(w.levelId) === 1 && w.view === 'foundation'
        && !isGarageWall(w), 'wall');
      d.lines = split(d.lines || [], l => Number(l.levelId) === 1 && !isGarageLine(l), 'line');
      return { ok: true, drawing: d, at };
    }
    const outline = (d.outlines || []).find(o => o.id === loop.id);
    if (!outline) return { ok: false, reason: 'NO_LOOP' };
    outline.points.splice(req.edgeIndex + 1, 0, { x: at.x, y: 0, z: at.z });
    return { ok: true, drawing: d, at };
  };

  // A ROOF'S BREAK goes in its eave, one overhang out from the bone's edge,
  // carrying that edge's eave and overhang on both halves.
  const breakRoofEdge = (drawing, req, ctx) => {
    const roofLevel = levelOf(ctx.levels, 'roof', req.levelId);
    const loop = roofLevel && roofLevel.loops[req.loopIndex];
    const edge = loop && edgeOf(loop.points, req.edgeIndex);
    if (!edge) return { ok: false, reason: 'NO_EDGE' };
    if (!edge.square) return { ok: false, reason: 'NOT_SQUARE' };
    const u = Math.round(Number(req.atFt));
    if (!(u >= edge.lo + 1 - TOL && u <= edge.hi - 1 + TOL)) return { ok: false, reason: 'AT_END' };
    const d = clone(drawing);
    const roof = (d.roofs || []).find(r => r.id === loop.id);
    if (!roof) return { ok: false, reason: 'NO_ROOF' };
    const ohOf = i => Number((roof.edgeOverhang || [])[i] ?? roof.overhang ?? 0) || 0;
    const eave = edgesOf(roof.points).find(e => e.square && e.axis === edge.axis && e.n === edge.n
      && near(e.c, edge.c + edge.n * ohOf(e.index), 0.01) && strictlyIn(u, e.lo, e.hi));
    if (!eave) return { ok: false, reason: 'NO_ROOF' };
    const at = pointAt(edge.axis, eave.c, u);
    roof.points.splice(eave.index + 1, 0, { x: at.x, z: at.z });
    if (Array.isArray(roof.edges)) roof.edges.splice(eave.index + 1, 0, roof.edges[eave.index]);
    if (Array.isArray(roof.edgeOverhang)) {
      roof.edgeOverhang.splice(eave.index + 1, 0, roof.edgeOverhang[eave.index]);
    }
    return { ok: true, drawing: d, at: pointAt(edge.axis, edge.c, u) };
  };

  // The edge of a loop nearest a world point, within `tolFt`.
  const edgeNear = (loops, pt, tolFt) => {
    let best = null;
    (loops || []).forEach((loop, li) => edgesOf(loop.points).forEach(e => {
      const a = loop.points[e.index], b = loop.points[(e.index + 1) % loop.points.length];
      const pr = project({ start: a, end: b }, pt);
      if (pr.t < -TOL || pr.t > pr.len + TOL) return;
      if (pr.off <= tolFt && (!best || pr.off < best.off)) best = { loopIndex: li, edge: e, off: pr.off, t: pr.t };
    }));
    return best;
  };

  window.DraftBoneyardEdit = Object.freeze({
    CANTILEVER_FT, FIRST_PILE_FT, PILE_SPACING_FT, PILE_FOOTING, PILE_MARK,
    edgeOf, edgesOf, chainLoop, pushPolygon, pushSegments, snapOverhang,
    pushEdge, breakEdge, edgeNear, roofHood,
  });
})();
}
