// CUT MARKS — where the section lines and their bubbles land on the plan.
//
// Pulled out of MODEL.dc.html so both boards can draw a cut from ONE copy.
// render-2d.js's drawCutMarks2D asks its caller for two things it cannot work
// out itself: `autoCuts`, the four standard elevation marks ringing the house,
// and `lineSpan`, how far a hand-placed cut runs before its bubbles sit down.
// Both were methods on the Model Space component, so only that page could
// answer, and MODEL.html drew no cuts at all.
//
// Everything here is pure. It works on plain { x, z } points, a walls array
// and a dimensions array, plus the three settings the answers depend on --
// passed in rather than read, because two of the three do not live in the
// drawing (see MODEL.html's caller for where each one comes from).
//
// WHAT IS DELIBERATELY NOT HERE. `_autoElevationsOn` and `_cutMarkGapFt` stay
// on the component. They are two-line reads of `this.state` with no geometry
// in them, and dragging state access into a pure module to save four lines
// would be the trade backwards: the module takes their ANSWERS -- a boolean
// and a number -- so it can be tested by handing it either one.
if (!window.DraftCutMarks) {
(() => {
  // How far past its drawn end a cut runs when there is no house to measure
  // against, so the bubbles still clear the geometry.
  const CUT_BUBBLE_PUSH_FT = 6;
  // The default clearance from the house to a standard elevation mark, used
  // for any mark the drafter has not dragged.
  const E_MARK_CLEAR_FT = 2;
  // Which side of the plan each standard elevation looks at, and which way it
  // steps off the edge. E1 is the front, then anticlockwise.
  const E_MARK_SIDES = Object.freeze({
    E1: { side: 'S', axis: 'z', sign: 1 },
    E2: { side: 'W', axis: 'x', sign: -1 },
    E3: { side: 'N', axis: 'z', sign: -1 },
    E4: { side: 'E', axis: 'x', sign: 1 },
  });

  // The house's bounding box in plan, or null when there is not enough of a
  // house to ring.
  //
  // WHAT IT IS GIVEN IS WHAT IT MEASURES, and that is the contract rather than
  // an omission. This filtered `walls.filter(w => w.levelId > 0)` -- every wall
  // on every level and every layer view, boneyard excluded -- and Movie ruled
  // that out on 6 Sep with a drawing:
  //
  //   A 30 x 40 bungalow with a covered front porch. On FOUNDATION you draw a
  //   frost wall 8 ft out in front of the house to carry the porch posts. That
  //   is correct drawing; it is where the concrete goes. Switch back to MAIN FL
  //   and the porch foundation is not shown -- but E1 has moved 8 ft into the
  //   front yard, positioned by a wall the drafter cannot see.
  //
  // "Should a mark you can see be positioned by a wall you can't?" No. So the
  // CALLER passes the walls it is showing -- _activeWalls() on the bone,
  // walls() on MODEL.html -- and both of those already exclude the boneyard,
  // the other levels and the other layer views in one place. Two filters, one
  // of them invisible from the call site, is how the porch bug survived.
  //
  // It does not re-filter what it is handed. A `levelId > 0` kept here would be
  // dead against both callers while reading as though it were guarding
  // something.
  const planWallExtents = walls => {
    const kept = walls || [];
    if (!kept.length) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    kept.forEach(wall => [wall.start, wall.end].forEach(pt => {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minZ = Math.min(minZ, pt.z); maxZ = Math.max(maxZ, pt.z);
    }));
    if (maxX - minX < 1 || maxZ - minZ < 1) return null;
    return { minX, maxX, minZ, maxZ };
  };

  // The box pushed out to clear the dimension strings, so an elevation mark
  // sits outside the numbers rather than through them. A dimension only counts
  // against an edge it actually runs along -- the pad keeps a string that
  // brushes the corner from pushing both edges at once.
  //
  // SAME CONTRACT AS ABOVE, and fixing only the walls would have half-worked:
  // a dimension string on a hidden layer view would still have pushed the marks
  // out, on a drawing where nothing visible is out there. Half a fix here is
  // worse than none, because the porch case would look fixed.
  const eMarkDimEdges = (walls, dimensions) => {
    const box = planWallExtents(walls);
    if (!box) return null;
    const { minX, maxX, minZ, maxZ } = box;
    const pad = 2;
    const edge = { N: minZ, S: maxZ, W: minX, E: maxX };
    (dimensions || []).forEach(dimension => {
      [dimension.start, dimension.end].forEach(pt => {
        if (pt.x >= minX - pad && pt.x <= maxX + pad) {
          if (pt.z > edge.S) edge.S = pt.z;
          if (pt.z < edge.N) edge.N = pt.z;
        }
        if (pt.z >= minZ - pad && pt.z <= maxZ + pad) {
          if (pt.x > edge.E) edge.E = pt.x;
          if (pt.x < edge.W) edge.W = pt.x;
        }
      });
    });
    return edge;
  };

  // A mark the drafter has dragged keeps its own clearance; every other one
  // takes the default. Only a FINITE stored number counts, so a null or a
  // stale string falls back rather than placing the mark at NaN.
  const eMarkClearFt = (offsets, id) => {
    const stored = (offsets || {})[id];
    return Number.isFinite(stored) ? stored : E_MARK_CLEAR_FT;
  };

  // The four standard elevation marks, or none. They are generated rather than
  // stored, so they cannot be edited away -- dragging one changes its
  // clearance, which is what elevationMarkOffsets holds.
  const autoElevationCuts = ({ walls, dimensions, elevationMarkOffsets, autoElevations }) => {
    if (!autoElevations) return [];
    const box = planWallExtents(walls);
    if (!box) return [];
    const edge = eMarkDimEdges(walls, dimensions);
    const { minX, maxX, minZ, maxZ } = box;
    const pad = 2;
    const at = id => edge[E_MARK_SIDES[id].side]
      + E_MARK_SIDES[id].sign * eMarkClearFt(elevationMarkOffsets, id);
    return [
      { id: 'E1', name: 'E1', auto: true, elev: 0, levelId: null,
        startPt: { x: minX - pad, z: at('E1') }, endPt: { x: maxX + pad, z: at('E1') }, dirVec: { x: 0, z: 1 } },
      { id: 'E2', name: 'E2', auto: true, elev: 0, levelId: null,
        startPt: { x: at('E2'), z: minZ - pad }, endPt: { x: at('E2'), z: maxZ + pad }, dirVec: { x: -1, z: 0 } },
      { id: 'E3', name: 'E3', auto: true, elev: 0, levelId: null,
        startPt: { x: minX - pad, z: at('E3') }, endPt: { x: maxX + pad, z: at('E3') }, dirVec: { x: 0, z: -1 } },
      { id: 'E4', name: 'E4', auto: true, elev: 0, levelId: null,
        startPt: { x: at('E4'), z: minZ - pad }, endPt: { x: at('E4'), z: maxZ + pad }, dirVec: { x: 1, z: 0 } },
    ];
  };

  // A hand-placed cut draws as an INFINITE line: however short the drafter
  // dragged it, it runs clear across the plan and stops in the gap between the
  // walls and the first dimension string, which is where the bubbles land.
  // The maths is a ray-versus-slab clip -- the box grown by `gapFt` on every
  // side -- and every way it can fail falls back to the drawn segment pushed
  // out at both ends rather than to nothing.
  const cutLineSpan = (walls, start, end, gapFt) => {
    const dx = end.x - start.x, dz = end.z - start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return { start, end };
    const ux = dx / len, uz = dz / len;
    const along = t => ({ x: start.x + ux * t, y: start.y, z: start.z + uz * t });
    const pushed = () => ({ start: along(-CUT_BUBBLE_PUSH_FT), end: along(len + CUT_BUBBLE_PUSH_FT) });
    const box = planWallExtents(walls);
    if (!box) return pushed();
    // An axis the ray does not travel along cannot bound it: the answer is
    // "the whole line" when the ray starts inside that slab and "never" when
    // it does not, and neither is a division.
    const slab = (origin, dir, lo, hi) => {
      if (Math.abs(dir) < 1e-9) {
        return (origin >= lo && origin <= hi) ? [-Infinity, Infinity] : null;
      }
      const t0 = (lo - origin) / dir, t1 = (hi - origin) / dir;
      return [Math.min(t0, t1), Math.max(t0, t1)];
    };
    const sx = slab(start.x, ux, box.minX - gapFt, box.maxX + gapFt);
    const sz = slab(start.z, uz, box.minZ - gapFt, box.maxZ + gapFt);
    if (!sx || !sz) return pushed();
    const tMin = Math.max(sx[0], sz[0]), tMax = Math.min(sx[1], sz[1]);
    // Both infinite means the ray is parallel to both slabs, which cannot
    // happen for a unit vector -- but an Infinity reaching `along` would put
    // the bubble at NaN, so it is refused rather than trusted.
    if (!(tMax - tMin > 0.5) || !Number.isFinite(tMin) || !Number.isFinite(tMax)) return pushed();
    return { start: along(tMin), end: along(tMax) };
  };

  window.DraftCutMarks = Object.freeze({
    planWallExtents,
    eMarkDimEdges,
    eMarkClearFt,
    autoElevationCuts,
    cutLineSpan,
    CUT_BUBBLE_PUSH_FT,
    E_MARK_CLEAR_FT,
    E_MARK_SIDES,
  });
})();
}
