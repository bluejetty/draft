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
    const lowest = floors[0].loops.filter(l => !l.garage);
    const poured = concreteLoop(drawing);
    const fdnLoops = own.length ? own
      : (poured && !(lowest.length === 1 && sameLoop(poured.points, lowest[0].points))
        ? [poured] : lowest);
    if (fdnLoops.length && stack.foundation) {
      out.push({ levelId: 1, kind: 'foundation', name: 'FOUNDATION',
        elev: stack.foundation.wallBottom, color: COLORS.foundation, loops: fdnLoops });
    }
    floors.forEach(({ floor, index, loops }) => {
      out.push({ levelId: floor.id, kind: 'floor', name: floor.name || `LEVEL ${floor.id}`,
        elev: floor.floorTop, color: COLORS.floors[Math.min(index, COLORS.floors.length - 1)], loops });
    });
    // THE ROOF: the TOP floor's house outline, at that floor's ceiling (its
    // wall top). Not a loop of its own drawing -- "one for the roof which will
    // be at highest floor ceiling".
    // The HIGHEST ceiling, not the last level in the list: a split's levels
    // do not climb in list order (cut-view.js splitFloorStack).
    const top = floors.reduce((hi, f) => (f.floor.wallTop > hi.floor.wallTop ? f : hi), floors[floors.length - 1]);
    // THE ROOF'S OWN FOOTPRINT where it has one -- its eave brought back in by
    // its overhang, which is the top floor's loop until a roof is pulled out
    // on its own (a covered entry, a back deck).
    const G = window.DraftGeometry2D;
    const ownRoof = ((drawing && drawing.roofs) || []).find(r => r.sourceLevelId == null
      && !r.garage && (r.points || []).length >= 3);
    const inset = ownRoof && G && G.offsetOutlineVariable
      ? G.offsetOutlineVariable(ownRoof.points.map(p => ({ x: Number(p.x), z: Number(p.z) })),
        ownRoof.points.map((_, i) => -(Number((ownRoof.edgeOverhang || [])[i] ?? ownRoof.overhang) || 0)))
        .map(p => ({ x: Math.round(p.x * 1e6) / 1e6, z: Math.round(p.z * 1e6) / 1e6 }))
        // Two eave corners can come back in to one point (a bump's corner and
        // the break beside it); one corner is kept.
        .filter((p, i, all) => {
          const q = all[(i + 1) % all.length];
          return all.length < 2 || Math.hypot(p.x - q.x, p.z - q.z) > 1e-6;
        })
      : null;
    const roofLoops = inset ? [{ id: ownRoof.id, garage: false, roof: true, points: inset }]
      : top.loops.filter(l => !l.garage);
    if (roofLoops.length) {
      out.push({ levelId: 7, kind: 'roof', name: 'ROOF', sourceLevelId: top.floor.id,
        elev: top.floor.wallTop, color: COLORS.roof, loops: roofLoops });
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
      polys: level.loops.map(loop => loop.points.map(p => project(p, level.elev, deg))),
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
        polys: l.polys.map(poly => poly.map(p => ({ x: ox + p.x * scale, y: oy + p.y * scale }))) })),
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

  window.DraftBoneyardLoops = Object.freeze({
    COLORS, STEP_DEG, TILT, boneLevels, project, layout, levelAt, stepAngle,
  });
})();
}
