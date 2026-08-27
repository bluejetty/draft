// BUILD HOUSE derivations, extracted pure from the Model Space: measure the
// outline and return plain data — wall runs, footing rings, the interior
// reference side. The component keeps the commit layer (vertex pool, srcId
// links, collection writes); nothing here mints identity.
if (!window.DraftBuildHouse) {
(() => {
  const geo = window.DraftGeometry2D;

  // refLine that puts the wall body inside the ring, keeping the outline on
  // the exterior face: 'left' for counter-clockwise rings, 'right' for
  // clockwise ones.
  const outlineInteriorRef = points => {
    const area = points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + (point.x * next.z - next.x * point.z);
    }, 0);
    return area > 0 ? 'left' : 'right';
  };

  // Walk the outline into wall runs, skipping degenerate edges. Points pass
  // through untouched (x, z, srcId) in ring order — the commit side reads
  // them exactly as it read the outline.
  const houseWallRuns = points => {
    const runs = [];
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      if (Math.hypot(next.x - point.x, next.z - point.z) < 0.01) return;
      runs.push({ start: point, end: next });
    });
    return runs;
  };

  // Strip footing rings, the footing centered on the wall: equal projection
  // past the exterior and interior faces. Ring corners map 1:1 onto the
  // outline corners they were offset from.
  const footingRings = (points, wallFt, projFt) => {
    const base = points.map(pt => ({ x: pt.x, z: pt.z }));
    return [
      geo.offsetOutline(base, projFt),
      geo.offsetOutline(base, -(wallFt + projFt)),
    ];
  };

  // ── The tour's mid-span beam rule (board #230, answers confirmed) ──
  // Joists span the SHORT way, so a house whose short span exceeds beamAtFt
  // gets ONE beam along the LONG axis at mid-span (two at third points past
  // 2x — the engineer sorts anything wilder), clipped to the outline;
  // columns split each run into spans no longer than maxSpanFt ("a beam is
  // one span between two supports"). holes are intervals along the short
  // axis (a stair opening) the beam must respect: it lands mid-span of the
  // LARGER remaining clear strip. Validated offline before wiring.

  // Clip an axis line (axis 'x' = the line RUNS along x at the given
  // cross-coordinate) to the polygon: even-odd pairing of edge crossings.
  const clipLineToPolygon = (points, axis, c) => {
    const crossings = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i];
      const a1 = axis === 'x' ? a.z : a.x, b1 = axis === 'x' ? b.z : b.x;
      const a2 = axis === 'x' ? a.x : a.z, b2 = axis === 'x' ? b.x : b.z;
      if ((a1 > c) === (b1 > c)) continue;
      const t = (c - a1) / (b1 - a1);
      crossings.push(a2 + t * (b2 - a2));
    }
    crossings.sort((p, q) => p - q);
    const runs = [];
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      if (crossings[i + 1] - crossings[i] > 0.5) runs.push([crossings[i], crossings[i + 1]]);
    }
    return runs;
  };

  const midSpanBeams = (points, { beamAtFt = 19, maxSpanFt = 12, holes = [] } = {}) => {
    const xs = points.map(pt => pt.x), zs = points.map(pt => pt.z);
    const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    const w = box.maxX - box.minX, d = box.maxZ - box.minZ;
    const shortSpan = Math.min(w, d);
    if (shortSpan <= beamAtFt) return { beams: [], columns: [] };
    const axis = w >= d ? 'x' : 'z';
    const lo = axis === 'x' ? box.minZ : box.minX;
    const hi = axis === 'x' ? box.maxZ : box.maxX;
    let strips = [[lo, hi]];
    holes.forEach(hole => {
      strips = strips.flatMap(([a, b]) => {
        if (hole.max <= a || hole.min >= b) return [[a, b]];
        const out = [];
        if (hole.min - a > 1) out.push([a, hole.min]);
        if (b - hole.max > 1) out.push([hole.max, b]);
        return out;
      });
    });
    strips.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    const strip = strips[0];
    const stripLen = strip[1] - strip[0];
    const cuts = shortSpan > 2 * beamAtFt
      ? [strip[0] + stripLen / 3, strip[0] + (2 * stripLen) / 3]
      : [strip[0] + stripLen / 2];
    // A run only carries a beam where the LOCAL joist span needs one: in an
    // L, the mid-line can pass a foot from a narrow wing's back wall — that
    // wing spans under the trigger on its own and gets no beam. For the
    // rectilinear outlines houses are, the local span is piecewise-constant
    // between vertex coordinates along the beam axis, so trim exactly there.
    const alongCoord = pt => (axis === 'x' ? pt.x : pt.z);
    const breaks = [...new Set(points.map(alongCoord))].sort((a, b) => a - b);
    const stripMid = (strip[0] + strip[1]) / 2;
    const localSpanAt = t => {
      const spans = clipLineToPolygon(points, axis === 'x' ? 'z' : 'x', t);
      const host = spans.find(([a, b]) => a - 1e-9 <= stripMid && stripMid <= b + 1e-9) || [0, 0];
      return host[1] - host[0];
    };
    const trimRun = ([r0, r1]) => {
      const edges = [r0, ...breaks.filter(b => b > r0 + 1e-9 && b < r1 - 1e-9), r1];
      const kept = [];
      for (let i = 0; i + 1 < edges.length; i++) {
        if (localSpanAt((edges[i] + edges[i + 1]) / 2) > beamAtFt) {
          if (kept.length && Math.abs(kept[kept.length - 1][1] - edges[i]) < 1e-9) {
            kept[kept.length - 1][1] = edges[i + 1];
          } else kept.push([edges[i], edges[i + 1]]);
        }
      }
      return kept.filter(([a, b]) => b - a > 0.5);
    };
    const beams = [];
    const columns = [];
    cuts.forEach(c => {
      clipLineToPolygon(points, axis, c).flatMap(trimRun).forEach(([r0, r1]) => {
        const len = r1 - r0;
        const spans = Math.max(1, Math.ceil(len / maxSpanFt));
        const at = t => (axis === 'x' ? { x: t, z: c } : { x: c, z: t });
        for (let s = 0; s < spans; s++) {
          beams.push({ start: at(r0 + (len * s) / spans), end: at(r0 + (len * (s + 1)) / spans) });
        }
        for (let s = 1; s < spans; s++) columns.push(at(r0 + (len * s) / spans));
      });
    });
    return { beams, columns };
  };

  window.DraftBuildHouse = Object.freeze({
    outlineInteriorRef,
    houseWallRuns,
    footingRings,
    midSpanBeams,
  });
})();
}
