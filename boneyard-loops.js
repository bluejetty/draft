// THE BONEYARD'S BONES: one loop per floor, and one for the roof.
//
// Movie, 1 Oct, on the BONEYARD / WIREFRAME page: the left window is a 3D
// wireframe of "only the exterior-wall outline of each level ... house and
// garage both", coloured "FOUNDATION purple, MAIN FLOOR red, 2ND FL green,
// ROOF orange", and isometric -- "ISOMETRIC / 2 POINT PERSPECTIVE / 3 POINT
// PERSPECTIVE ... our wireframe will be ISOMETRIC". On 2 Oct, which loops:
// "only 1 loops per floor and one for the roof which will be at highest floor
// ceiling (none for ceiling)".
//
// SO THE LOOPS ARE:
//   FOUNDATION   the house footprint, at the BOTTOM of the foundation wall
//   each FLOOR   its outlines (house and garage), at its TOP OF SHEATHING
//   ROOF         the top floor's house outline, at that floor's CEILING
//                -- and a roof on a plate of its own (the MOD BILEVEL's room)
//                at its own floor's ceiling
//
// THE HEIGHTS ARE THE ELEVATIONS' OWN. `stack` is cut-view's
// sectionLevelStack, the one table every elevation and section on every page
// stands its floors on; a wireframe that worked its heights out again would
// be the third copy of that arithmetic and the first to drift.
//
// AND THE BONES ARE THE OUTLINES. A level's loop is the outline (the bone)
// drawn on it -- what the TOY board builds walls from and what BUILD HOUSE
// reads -- not a loop re-traced from the walls.
//
// Pure: a drawing and a stack in, loops and screen points out.
if (!window.DraftBoneyardLoops) {
(() => {
  const COLORS = Object.freeze({
    foundation: '#9b6bd6',   // purple
    floors: Object.freeze(['#e0453a', '#3fae5a', '#2fa3c4', '#c9a227']), // red, green, then on
    roof: '#ff8c1a',         // orange
    // The openings' centre dots: a door one colour, a window another, and
    // neither a level's.
    door: '#d63fa8',         // magenta
    window: '#1e6fd9',       // blue
  });

  // Each loop keeps its outline's id: the BONEYARD's editor (boneyard-edit.js)
  // breaks an edge by writing a corner into that outline.
  const loopsOn = (drawing, levelId) => ((drawing && drawing.outlines) || [])
    .filter(o => Number(o.levelId) === Number(levelId) && (o.points || []).length >= 3)
    .map(o => ({ id: o.id, garage: o.garage === true,
      points: o.points.map(p => ({ x: Number(p.x), z: Number(p.z) })) }));

  // THE FOUNDATION'S OWN CONCRETE, chained wall to wall -- once the bones can
  // be pushed, the foundation and the floor over it stop being one loop, and
  // the concrete is where the foundation actually is. Null when the walls do
  // not close (or there are none).
  const concreteLoop = drawing => {
    const E = window.DraftBoneyardEdit;
    if (!E) return null;
    const walls = ((drawing && drawing.walls) || []).filter(w => Number(w.levelId) === 1
      && w.view === 'foundation' && w.body !== 'garage');
    const pts = E.chainLoop(walls);
    return pts ? { id: null, garage: false, points: pts } : null;
  };
  // The same loop either way round and from either corner.
  const sameLoop = (a, b) => {
    if (!a || !b || a.length !== b.length) return false;
    const k = p => `${Math.round(p.x * 1000)},${Math.round(p.z * 1000)}`;
    const set = new Set(a.map(k));
    return b.every(p => set.has(k(p)));
  };

  // ── THE OPENINGS IN THE BONE (Movie, 3 Oct) ─────────────────────────
  // "show the doors and window as openings in the outline with a dot where
  // their center position is" -- in the BONEYARD's 2D and 3D both, every
  // opening a gap in the line its own width, a dot at its centre, one colour
  // for a door and another for a window.
  //
  // An opening is a fenestration in a wall of the level; it is found on the
  // loop edge its wall runs along (parallel, within OPENING_TOL_FT of it --
  // a wall stands on its outline, not always exactly on the line) and kept
  // as feet along that edge from the edge's first corner.
  const OPENING_TOL_FT = 1;
  const openingsOn = (drawing, levelId, loops) => {
    const walls = new Map(((drawing && drawing.walls) || []).map(w => [String(w.id), w]));
    const found = loops.map(() => []);
    ((drawing && drawing.fenestrations) || []).forEach(f => {
      // THE WALL'S LEVEL: an opening is cut into a wall and is wherever it is.
      const wall = walls.get(String(f.wallId));
      if (!wall || !wall.start || !wall.end || Number(wall.levelId) !== Number(levelId)) return;
      const wx = wall.end.x - wall.start.x, wz = wall.end.z - wall.start.z;
      const wl = Math.hypot(wx, wz);
      if (!(wl > 0)) return;
      const off = Number(f.offset) || 0;
      const c = { x: wall.start.x + wx * off / wl, z: wall.start.z + wz * off / wl };
      let best = null;
      loops.forEach((loop, li) => loop.points.forEach((a, ei) => {
        const b = loop.points[(ei + 1) % loop.points.length];
        const ex = b.x - a.x, ez = b.z - a.z;
        const len = Math.hypot(ex, ez);
        if (!(len > 0)) return;
        // Parallel to the wall, and the centre beside the edge, not past it.
        if (Math.abs(ex * wz - ez * wx) / (len * wl) > 1e-3) return;
        const t = ((c.x - a.x) * ex + (c.z - a.z) * ez) / len;
        const d = Math.abs((c.x - a.x) * ez - (c.z - a.z) * ex) / len;
        if (t < -1e-6 || t > len + 1e-6 || d > OPENING_TOL_FT) return;
        if (!best || d < best.d) best = { li, ei, t, len, d };
      }));
      if (!best) return;
      const half = Math.max(0, Number(f.width) || 0) / 2;
      found[best.li].push({ id: f.id, edge: best.ei, type: f.type === 'door' ? 'door' : 'window',
        at: best.t, from: Math.max(0, best.t - half), to: Math.min(best.len, best.t + half) });
    });
    return found;
  };

  // A loop as the runs of line between its openings, and the dots at their
  // centres: [{a, b}] and [{p, type}], in plan feet. A loop with no openings
  // is its edges, corner to corner.
  const runsOf = loop => {
    const pts = loop.points;
    const runs = [], dots = [];
    pts.forEach((a, ei) => {
      const b = pts[(ei + 1) % pts.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const at = t => ({ x: a.x + (b.x - a.x) * (len ? t / len : 0), z: a.z + (b.z - a.z) * (len ? t / len : 0) });
      const gaps = (loop.openings || []).filter(o => o.edge === ei).sort((p, q) => p.from - q.from);
      let t = 0;
      gaps.forEach(g => {
        if (g.from > t + 1e-6) runs.push({ a: at(t), b: at(g.from) });
        t = Math.max(t, g.to);
        dots.push({ p: at(g.at), type: g.type });
      });
      if (len > t + 1e-6) runs.push({ a: at(t), b });
    });
    return { runs, dots };
  };

  // EVERY LEVEL THAT HAS A BONE, bottom to top, each with its colour and the
  // height its loop stands at.
  const boneLevels = (drawing, stack) => {
    if (!drawing || !stack || !Array.isArray(stack.floors) || !stack.floors.length) return [];
    const out = [];
    const floors = stack.floors.map((floor, index) => ({ floor, index, loops: loopsOn(drawing, floor.id) }))
      .filter(f => f.loops.length);
    if (!floors.length) return [];
    // THE FOUNDATION carries the house it holds up: its own outline where one
    // was drawn, otherwise the lowest floor's house footprint -- a garage
    // stands on a slab, not on the foundation wall.
    // Where the concrete runs the same loop as the lowest floor, that floor's
    // loop is drawn -- the same bone, from the same corner, as before.
    const own = loopsOn(drawing, 1);
    // Copies: the floor's own loops take its openings below; the foundation's
    // are solid.
    const lowest = floors[0].loops.filter(l => !l.garage).map(l => ({ ...l }));
    const poured = concreteLoop(drawing);
    const fdnLoops = own.length ? own
      : (poured && !(lowest.length === 1 && sameLoop(poured.points, lowest[0].points))
        ? [poured] : lowest);
    if (fdnLoops.length && stack.foundation) {
      out.push({ levelId: 1, kind: 'foundation', name: 'FOUNDATION',
        elev: stack.foundation.wallBottom, color: COLORS.foundation, loops: fdnLoops });
    }
    floors.forEach(({ floor, index, loops }) => {
      const openings = openingsOn(drawing, floor.id, loops);
      loops.forEach((loop, i) => { if (openings[i].length) loop.openings = openings[i]; });
      out.push({ levelId: floor.id, kind: 'floor', name: floor.name || `LEVEL ${floor.id}`,
        elev: floor.floorTop, color: COLORS.floors[Math.min(index, COLORS.floors.length - 1)], loops });
    });
    // THE ROOF: the TOP floor's house outline, at that floor's ceiling (its
    // wall top). Not a loop of its own drawing -- "one for the roof which will
    // be at highest floor ceiling".
    // The HIGHEST ceiling, not the last level in the list: a split's levels
    // do not climb in list order (cut-view.js splitFloorStack).
    // AND NOT A FLOOR THAT CARRIES A ROOF OF ITS OWN: the MOD BILEVEL's room
    // over the garage stands half a storey over MAIN on its own plate, so
    // the house's roof is MAIN's, and the room's is drawn on the room's.
    const G = window.DraftGeometry2D;
    const ownedBy = new Set(((drawing && drawing.roofs) || [])
      .filter(r => r.sourceLevelId != null && !r.garage && (r.points || []).length >= 3)
      .map(r => Number(r.sourceLevelId)));
    const plates = floors.filter(f => !ownedBy.has(Number(f.floor.id)));
    const pool = plates.length ? plates : floors;
    const top = pool.reduce((hi, f) => (f.floor.wallTop > hi.floor.wallTop ? f : hi), pool[pool.length - 1]);
    // A ROOF'S OWN FOOTPRINT where it has one -- its eave brought back in by
    // its overhang, which is the top floor's loop until a roof is pulled out
    // on its own (a covered entry, a back deck).
    const footprint = roof => (G && G.offsetOutlineVariable
      ? G.offsetOutlineVariable(roof.points.map(p => ({ x: Number(p.x), z: Number(p.z) })),
        roof.points.map((_, i) => -(Number((roof.edgeOverhang || [])[i] ?? roof.overhang) || 0)))
        .map(p => ({ x: Math.round(p.x * 1e6) / 1e6, z: Math.round(p.z * 1e6) / 1e6 }))
        // Two eave corners can come back in to one point (a bump's corner and
        // the break beside it); one corner is kept.
        .filter((p, i, all) => {
          const q = all[(i + 1) % all.length];
          return all.length < 2 || Math.hypot(p.x - q.x, p.z - q.z) > 1e-6;
        })
      : null);
    const ownRoof = ((drawing && drawing.roofs) || []).find(r => r.sourceLevelId == null
      && !r.garage && (r.points || []).length >= 3);
    const inset = ownRoof ? footprint(ownRoof) : null;
    // The top floor's loop stands in only where NO roof of the house's was
    // drawn: a roof made off a floor's outline is that floor's roof, below.
    const roofLoops = inset ? [{ id: ownRoof.id, garage: false, roof: true, points: inset }]
      : ownedBy.size ? []
      : top.loops.filter(l => !l.garage).map(({ openings, ...l }) => l);
    // AND EVERY ROOF ON A PLATE OF ITS OWN, at that floor's ceiling. Movie,
    // 4 Oct: "the upper roof needs a 'roof' - orange' wireframe on the bone".
    // One ROOF level still -- one button, one colour -- with each loop
    // carrying the height and the floor it stands on.
    ((drawing && drawing.roofs) || []).forEach(roof => {
      if (roof.sourceLevelId == null || roof.garage || (roof.points || []).length < 3) return;
      const on = floors.find(f => Number(f.floor.id) === Number(roof.sourceLevelId));
      const pts = on && footprint(roof);
      if (!pts || pts.length < 3) return;
      roofLoops.push({ id: roof.id, garage: false, roof: true, points: pts,
        elev: on.floor.wallTop, sourceLevelId: on.floor.id });
    });
    if (roofLoops.length) {
      // The level stands where its first loop does: the house's roof, or the
      // first roof on a plate of its own when the house has none.
      const lead = roofLoops[0];
      out.push({ levelId: 7, kind: 'roof', name: 'ROOF', sourceLevelId: lead.sourceLevelId ?? top.floor.id,
        elev: lead.elev ?? top.floor.wallTop, color: COLORS.roof, loops: roofLoops });
    }
    return out;
  };

  // ── ISOMETRIC ──────────────────────────────────────────────────────────
  //
  // Parallel lines stay parallel; nothing shrinks with distance. The plan is
  // turned about the vertical by `deg` (stepped by the page, 15 at a time) and
  // tipped by the isometric angle, atan(1/sqrt 2) -- at 45 that is the classic
  // three-faces-equal view.
  const TILT = Math.atan(1 / Math.SQRT2);
  const STEP_DEG = 15;
  const project = (pt, elev, deg) => {
    const a = deg * Math.PI / 180;
    const rx = pt.x * Math.cos(a) - pt.z * Math.sin(a);
    const rz = pt.x * Math.sin(a) + pt.z * Math.cos(a);
    return { x: rx, y: rz * Math.sin(TILT) - elev * Math.cos(TILT) };
  };

  // Every level's loops projected and fitted into a w x h box with a margin;
  // returns screen polylines plus the scale used.
  const layout = (levels, deg, w, h, margin = 30) => {
    const raw = levels.map(level => ({
      ...level,
      // A loop may stand at its own height (a roof on a plate of its own).
      polys: level.loops.map(loop => loop.points.map(p => project(p, loop.elev ?? level.elev, deg))),
      cut: level.loops.map(loop => {
        const { runs, dots } = runsOf(loop);
        const e = loop.elev ?? level.elev;
        return { runs: runs.map(r => ({ a: project(r.a, e, deg), b: project(r.b, e, deg) })),
          dots: dots.map(d => ({ ...project(d.p, e, deg), type: d.type })) };
      }),
    }));
    const all = raw.flatMap(l => l.polys.flat());
    if (!all.length) return { levels: [], scale: 0 };
    const xs = all.map(p => p.x), ys = all.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min((w - 2 * margin) / Math.max(maxX - minX, 1),
      (h - 2 * margin) / Math.max(maxY - minY, 1));
    const ox = (w - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = (h - (maxY - minY) * scale) / 2 - minY * scale;
    return {
      scale,
      levels: raw.map(l => ({ ...l,
        polys: l.polys.map(poly => poly.map(p => ({ x: ox + p.x * scale, y: oy + p.y * scale }))),
        cut: l.cut.map(c => ({
          runs: c.runs.map(r => ({ a: { x: ox + r.a.x * scale, y: oy + r.a.y * scale },
            b: { x: ox + r.b.x * scale, y: oy + r.b.y * scale } })),
          dots: c.dots.map(d => ({ x: ox + d.x * scale, y: oy + d.y * scale, type: d.type })),
        })) })),
    };
  };

  const segDist = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  // The level whose loop runs nearest the press, within `tol` pixels.
  const levelAt = (laidOut, p, tol = 8) => {
    let best = null, bestD = tol;
    laidOut.levels.forEach(level => level.polys.forEach(poly => poly.forEach((a, i) => {
      const d = segDist(p, a, poly[(i + 1) % poly.length]);
      if (d <= bestD) { bestD = d; best = level; }
    })));
    return best;
  };

  const stepAngle = (deg, steps) => ((((deg + steps * STEP_DEG) % 360) + 360) % 360);

  // ── THE GROW (Movie, 3 Oct) ─────────────────────────────────────────
  // "show the 3d ISO bone grow first and then flip to model space and show
  // the front elevation grow". The bones come up the way a house does:
  // bottom first, one height at a time, each rising off the one below it.
  // Levels at the SAME height (the house's floor and the garage's) share a
  // slot and rise together. The lowest rises off the ground FIRST_RISE_FT
  // under it, so the foundation is seen coming up too, not just appearing.
  //
  // Pure: given the levels and the milliseconds since the start, where each
  // one is. `shown` false is not drawn yet; `h` is the height it is drawn at
  // now and `base` the one it rises from. The page draws, this decides.
  const GROW_LEVEL_MS = 700;
  const FIRST_RISE_FT = 4;
  const growSlots = levels => [...new Set(levels.map(l => l.elev))].sort((a, b) => a - b);
  const growStage = (levels, ms, levelMs = GROW_LEVEL_MS) => {
    const slots = growSlots(levels);
    return levels.map(level => {
      const k = slots.indexOf(level.elev);
      const base = k ? slots[k - 1] : level.elev - FIRST_RISE_FT;
      const t = (ms - k * levelMs) / levelMs;
      if (t <= 0) return { shown: false, base, h: base, done: false };
      const p = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
      return { shown: true, base, h: base + (level.elev - base) * p, done: t >= 1 };
    });
  };
  const growMs = (levels, levelMs = GROW_LEVEL_MS) => growSlots(levels).length * levelMs;

  window.DraftBoneyardLoops = Object.freeze({
    COLORS, STEP_DEG, TILT, OPENING_TOL_FT, boneLevels, openingsOn, runsOf, project, layout, levelAt, stepAngle,
    GROW_LEVEL_MS, FIRST_RISE_FT, growStage, growMs,
  });
})();
}
