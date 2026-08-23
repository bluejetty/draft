// Plan-view geometry helpers shared by the Model Space tools.
//
// Everything here is pure and works on plain { x, y, z } objects: no THREE, no
// component state, no canvas. Callers own the Vector3 pool and the camera, and
// pass in the numbers these functions need. That keeps the snapping and trim
// maths testable on its own rather than only through the canvas.
if (!window.DraftGeometry2D) {
(() => {
  // Plan distance ignores y: levels are stacked, drafting happens in x/z.
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // Feet per screen pixel for the top-view ortho camera. Snap radii are given in
  // pixels so they stay the same size on screen at any zoom.
  const worldPerPixel = (orthoHalfHeight, canvasHeight) =>
    (orthoHalfHeight * 2) / (canvasHeight || 600);

  // Nearest vertex within radius, or null. Ties keep the earlier vertex, so a
  // stable input order gives a stable snap.
  const nearestVertex = (vertices, point, radius) => {
    let best = null;
    let bestDistance = radius;
    vertices.forEach(vertex => {
      const d = distance(vertex, point);
      if (d < bestDistance) { bestDistance = d; best = vertex; }
    });
    return best;
  };

  const midpoint = seg => ({
    x: (seg.start.x + seg.end.x) / 2,
    y: seg.start.y,
    z: (seg.start.z + seg.end.z) / 2,
  });

  const nearestMidpoint = (segments, point, radius) => {
    let best = null;
    let bestDistance = radius;
    segments.forEach(seg => {
      const mid = midpoint(seg);
      const d = distance(mid, point);
      if (d < bestDistance) { bestDistance = d; best = mid; }
    });
    return best;
  };

  // Position of point projected onto the ray leaving start at angle radians.
  const projectOntoRay = (start, angle, point) => {
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const along = (point.x - start.x) * dirX + (point.z - start.z) * dirZ;
    return { x: start.x + dirX * along, y: point.y ?? start.y, z: start.z + dirZ * along };
  };

  // Nearest step multiple (45° by default) to the direction start → point, or
  // null when the two points coincide and there is no meaningful direction yet.
  const lockAngleFor = (start, point, step = Math.PI / 4) => {
    if (distance(start, point) < 0.001) return null;
    const raw = Math.atan2(point.z - start.z, point.x - start.x);
    return Math.round(raw / step) * step;
  };

  // Compass bearing in whole degrees with North at 90°, or null for a zero-length
  // segment. Used for the status-bar readout.
  const angleDeg = (start, end) => {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    if (Math.hypot(dx, dz) < 0.001) return null;
    const deg = Math.round(Math.atan2(-dz, dx) * 180 / Math.PI);
    return deg < 0 ? deg + 360 : deg;
  };

  // Where point falls along seg, clamped to [0, 1].
  const paramAlongSegment = (seg, point) => {
    const dx = seg.end.x - seg.start.x;
    const dz = seg.end.z - seg.start.z;
    const len2 = dx * dx + dz * dz;
    if (len2 <= 0) return 0;
    const t = ((point.x - seg.start.x) * dx + (point.z - seg.start.z) * dz) / len2;
    return Math.max(0, Math.min(1, t));
  };

  // Intersection of two plan segments, or null when they are parallel or cross
  // outside either segment. t is along a, u along b; the small tolerance lets
  // endpoints that meet count as an intersection.
  const segmentIntersection = (a, b) => {
    const ax = a.start.x, az = a.start.z, bx = a.end.x, bz = a.end.z;
    const cx = b.start.x, cz = b.start.z, dx = b.end.x, dz = b.end.z;
    const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
    if (Math.abs(den) < 1e-10) return null;
    const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
    const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
    if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;
    const tc = Math.max(0, Math.min(1, t));
    return {
      t: tc,
      u: Math.max(0, Math.min(1, u)),
      x: ax + tc * (bx - ax),
      z: az + tc * (bz - az),
    };
  };

  // Intersection nearest to where the user clicked along seg.
  const nearestIntersection = (seg, others, point) => {
    const hits = [];
    others.forEach(other => {
      const hit = segmentIntersection(seg, other);
      if (hit) hits.push({ ...hit, other });
    });
    if (!hits.length) return null;
    const tPoint = paramAlongSegment(seg, point);
    hits.sort((first, second) => Math.abs(first.t - tPoint) - Math.abs(second.t - tPoint));
    return { ...hits[0], tPoint };
  };

  window.DraftGeometry2D = {
    distance,
    worldPerPixel,
    nearestVertex,
    midpoint,
    nearestMidpoint,
    projectOntoRay,
    lockAngleFor,
    angleDeg,
    paramAlongSegment,
    segmentIntersection,
    nearestIntersection,
  };
})();
}