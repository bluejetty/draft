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

  window.DraftBuildHouse = Object.freeze({
    outlineInteriorRef,
    houseWallRuns,
    footingRings,
  });
})();
}
