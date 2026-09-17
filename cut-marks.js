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
  // house to ring. levelId > 0 excludes the boneyard, whose walls are off to
  // one side and would stretch the box across the whole sheet.
  const planWallExtents = walls => {
    const kept = (walls || []).filter(wall => wall.levelId > 0);
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
  const eMarkDimEdges = (walls, dimensions) => {
    const box = planWallExtents(walls);
    if (!box) return null;
    const { minX, maxX, minZ, maxZ } = box;
    const pad = 2;
    const edge = { N: minZ, S: maxZ, W: minX, E: maxX };
    (dimensions || []).filter(dimension => dimension.levelId > 0).forEach(dimension => {
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
    // ONE RING, SIZED BY THE DEEPEST SIDE (board #271).
    //
    // Each corner carries two marks, one from each side, and the ruling is
    // that the pair reads as one composition: each bubble is the other
    // reflected across that corner's 45 degree diagonal.
    //
    // THAT FORCES A UNIFORM RING, and the arithmetic leaves no choice. The
    // reflection swaps the two legs, so it maps one mark's CLEARANCE onto the
    // other mark's clearance -- a corner can only mirror when both marks stand
    // the same distance out. Seating each mark at a fixed clearance off its
    // OWN dim edge therefore mirrors only while every side's dim stack is the
    // same depth, which is why this looked right for so long: the plain
    // fixtures are even on all four sides (5.00 each), and only a plan with an
    // attached garage -- repro-garage-house, 5/5/5/8 -- came out wrong, on
    // exactly the two corners touching its deeper side.
    //
    // OUTWARD, NEVER INWARD. Of the two ways to equalise a corner, pulling the
    // deeper mark in would bury it in its own dimension strings, so the ring
    // takes the DEEPEST side's clearance and the shallower sides stand further
    // off their own numbers than they strictly need. That is the cost, and it
    // is the one that keeps every bubble outside every string.
    const boxEdge = { N: minZ, S: maxZ, W: minX, E: maxX };
    const ringClear = Math.max(
      minZ - edge.N, edge.S - maxZ, minX - edge.W, edge.E - maxX, 0,
    ) + E_MARK_CLEAR_FT;
    // A DRAGGED MARK IS STILL THE DRAFTER'S WORD, and it keeps meaning what it
    // has always meant: a clearance off its own dim edge, which is the frame
    // the drag itself stores (_eMarkDrag captures `base: edge[side]`). Reading
    // it in any other frame would move every mark anyone has ever dragged. The
    // two frames meet without a jump -- grabbing a ring-seated mark reads back
    // the clearance it is already standing at -- so symmetry is the default
    // here and never a cage.
    const at = id => {
      const { side, sign } = E_MARK_SIDES[id];
      const stored = (elevationMarkOffsets || {})[id];
      return Number.isFinite(stored)
        ? edge[side] + sign * stored
        : boxEdge[side] + sign * ringClear;
    };
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
