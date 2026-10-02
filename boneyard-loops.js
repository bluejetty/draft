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

  const loopsOn = (drawing, levelId) => ((drawing && drawing.outlines) || [])
    .filter(o => Number(o.levelId) === Number(levelId) && (o.points || []).length >= 3)
    .map(o => ({ garage: o.garage === true, points: o.points.map(p => ({ x: Number(p.x), z: Number(p.z) })) }));

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
    const own = loopsOn(drawing, 1);
    const fdnLoops = own.length ? own : floors[0].loops.filter(l => !l.garage);
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
    const roofLoops = top.loops.filter(l => !l.garage);
    if (roofLoops.length) {
      out.push({ levelId: 7, kind: 'roof', name: 'ROOF',
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
