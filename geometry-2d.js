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

  // Enclosed rooms from plan wall centerlines. Segments are { start:{x,z},
  // end:{x,z}, ... } and ride through untouched, so callers can hang wall
  // data on them. Endpoints weld within joinFt, a welded endpoint near a
  // foreign segment pulls onto it (the T against a wall centerline) and cuts
  // it there, and X-crossings cut both walls. Faces trace the half-edge
  // subdivision; only the enclosed interiors return, each as
  // { points:[{x,z}], segments:[seg], area } with area in square feet.
  const roomLoops = (rawSegments, joinFt = 0.7) => {
    const eps = 0.01;
    const segs = rawSegments
      .map(seg => ({ seg, cuts: [] }))
      .filter(s => distance(s.seg.start, s.seg.end) > 0.05);

    const nodes = [];
    const nodeFor = (pt, tol) => {
      let best = null, bestD = tol;
      nodes.forEach(n => {
        const d = Math.hypot(n.x - pt.x, n.z - pt.z);
        if (d < bestD) { bestD = d; best = n; }
      });
      if (best) return best;
      const node = { x: pt.x, z: pt.z };
      nodes.push(node);
      return node;
    };
    segs.forEach(s => { s.aNode = nodeFor(s.seg.start, joinFt); s.bNode = nodeFor(s.seg.end, joinFt); });

    nodes.forEach(node => {
      let best = null, bestD = joinFt;
      segs.forEach(s => {
        if (s.aNode === node || s.bNode === node) return;
        const dx = s.bNode.x - s.aNode.x, dz = s.bNode.z - s.aNode.z;
        const len2 = dx * dx + dz * dz;
        if (len2 <= 0) return;
        const t = ((node.x - s.aNode.x) * dx + (node.z - s.aNode.z) * dz) / len2;
        if (t < 0 || t > 1) return;
        const px = s.aNode.x + dx * t, pz = s.aNode.z + dz * t;
        const d = Math.hypot(node.x - px, node.z - pz);
        if (d < bestD) { bestD = d; best = { s, t, px, pz }; }
      });
      if (!best) return;
      if (bestD > 1e-9) { node.x = best.px; node.z = best.pz; }
      best.s.cuts.push({ t: best.t, node });
    });

    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const s1 = segs[i], s2 = segs[j];
        const ax = s1.aNode.x, az = s1.aNode.z, bx = s1.bNode.x, bz = s1.bNode.z;
        const cx = s2.aNode.x, cz = s2.aNode.z, dx = s2.bNode.x, dz = s2.bNode.z;
        const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
        if (Math.abs(den) < 1e-10) continue;
        const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
        const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
        const len1 = Math.hypot(bx - ax, bz - az), len2 = Math.hypot(dx - cx, dz - cz);
        const m1 = eps / len1, m2 = eps / len2;
        if (t <= m1 || t >= 1 - m1 || u <= m2 || u >= 1 - m2) continue;
        const node = nodeFor({ x: ax + t * (bx - ax), z: az + t * (bz - az) }, 0.05);
        s1.cuts.push({ t, node });
        s2.cuts.push({ t: u, node });
      }
    }

    const edgeKeys = new Set();
    const edges = [];
    segs.forEach(s => {
      const stops = [{ t: 0, node: s.aNode }, ...s.cuts.sort((p, q) => p.t - q.t), { t: 1, node: s.bNode }];
      for (let i = 1; i < stops.length; i++) {
        const n1 = stops[i - 1].node, n2 = stops[i].node;
        if (n1 === n2 || Math.hypot(n2.x - n1.x, n2.z - n1.z) < eps) continue;
        const i1 = nodes.indexOf(n1), i2 = nodes.indexOf(n2);
        const key = i1 < i2 ? `${i1}:${i2}` : `${i2}:${i1}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        edges.push({ n1, n2, seg: s.seg });
      }
    });

    const half = [];
    edges.forEach(edge => {
      const fwd = { from: edge.n1, to: edge.n2, seg: edge.seg };
      const rev = { from: edge.n2, to: edge.n1, seg: edge.seg };
      fwd.twin = rev; rev.twin = fwd;
      half.push(fwd, rev);
    });
    const out = new Map();
    half.forEach(h => {
      h.angle = Math.atan2(h.to.z - h.from.z, h.to.x - h.from.x);
      if (!out.has(h.from)) out.set(h.from, []);
      out.get(h.from).push(h);
    });
    out.forEach(list => list.sort((p, q) => p.angle - q.angle));
    const next = h => {
      const list = out.get(h.to) || [];
      if (!list.length) return null;
      let pick = null;
      list.forEach(cand => {
        if (cand.angle > h.twin.angle + 1e-9 && (!pick || cand.angle < pick.angle)) pick = cand;
      });
      return pick || list[0];
    };
    const faces = [];
    const visited = new Set();
    half.forEach(start => {
      if (visited.has(start)) return;
      const points = [];
      const faceSegs = new Set();
      let h = start, guard = half.length + 2;
      while (h && guard-- > 0) {
        visited.add(h);
        points.push(h.from);
        faceSegs.add(h.seg);
        h = next(h);
        if (h === start) break;
      }
      if (!h || h !== start || points.length < 3) return;
      let doubled = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i], q = points[(i + 1) % points.length];
        doubled += p.x * q.z - q.x * p.z;
      }
      // Interior faces trace with negative signed area in x/z; the outer face
      // of each connected component comes out positive and is dropped.
      if (doubled >= 0) return;
      faces.push({
        points: points.map(p => ({ x: p.x, z: p.z })),
        segments: [...faceSegs],
        area: -doubled / 2,
      });
    });
    return faces;
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
    roomLoops,
  };
})();
}