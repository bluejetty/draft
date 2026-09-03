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

  // Does a closed ring cross itself? Reuses segmentIntersection rather than
  // repeating the math, and skips the pairs that always touch: adjacent edges
  // share a corner, and the first and last edges share the closing one. Their
  // shared endpoint lands inside segmentIntersection's own tolerance, so
  // counting them would report every polygon as self-intersecting.
  //
  // WHAT THIS IS FOR, and what it deliberately is not. A self-intersecting
  // outline is drawable today: the T-square forces segments onto an axis and
  // hides it, but `t` stows the T-square. polygonArea then returns 0 for a
  // bowtie, because the two lobes wind oppositely and cancel exactly -- the
  // shoelace formula doing precisely what it says, and no way for the caller
  // to tell that 0 from an honest zero.
  //
  // This answers only "does it cross itself". What the app should DO about one
  // -- refuse the outline, warn and continue, or report the area as unknown --
  // is a ruling nobody has made, so it is not made here.
  const selfIntersects = points => {
    if (!Array.isArray(points) || points.length < 4) return false;
    const n = points.length;
    // PROPER crossings only -- strict sign changes on both segments. Touching
    // at a point and lying along each other are deliberately NOT crossings,
    // and that distinction is the whole of this function.
    //
    // WHY, measured 2 Sep. The vertex magnet merges corners closer together
    // than its screen-space reach, so a drafter's small jog becomes a
    // ZERO-WIDTH SPIKE in the stored ring -- out and back along one line, as
    // in (3,6) -> (3,3) -> (3,6). That spike is normal, permanent, and present
    // in ordinary drawings. An earlier version of this function used
    // segmentIntersection, whose tolerance counts a touch as a hit, so it
    // called every spike a crossing and refused houses the app itself draws.
    //
    // The strict test separates them exactly: rectangle, L, T, deep C, U and
    // spike ring all false; a bowtie true whether its lobes are equal or not.
    // That last case matters -- an unequal bowtie defeats every area-ratio
    // test, because a deep C encloses the same fraction of itself that one
    // does.
    const side = (a, b, p) => Math.sign((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
    for (let i = 0; i < n; i += 1) {
      const a = points[i], b = points[(i + 1) % n];
      for (let j = i + 2; j < n; j += 1) {
        if (i === 0 && j === n - 1) continue;   // the closing pair share a corner
        const c = points[j], d = points[(j + 1) % n];
        if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
      }
    }
    return false;
  };

  // Is `inner` wholly inside `outer`? Both must be simple rings.
  //
  // Corner containment alone is NOT enough: on a concave host, every corner of
  // the inner ring can sit inside while an edge between two of them leaves and
  // comes back. So this asks twice — every corner inside, AND no edge of the
  // inner ring crossing any edge of the outer one — and reuses
  // segmentIntersection for the second question rather than repeating the math.
  //
  // WHY IT EXISTS. A floor opening is deducted from its host's area
  // ARITHMETICALLY: the slab polygon is never cut, so nothing else ever asks
  // whether the hole is actually in the floor it is charged against. Cutting
  // the hole geometrically would have answered that for free; subtracting it
  // has to ask out loud.
  const ringInsideRing = (inner, outer) => {
    if (!Array.isArray(inner) || !Array.isArray(outer)) return false;
    if (inner.length < 3 || outer.length < 3) return false;
    const EPS = 0.001;
    // On the boundary counts as inside. A stair opening run flush to an
    // exterior wall shares that wall's line exactly, and refusing it would
    // force the drafter to leave the sliver of floor this design exists to
    // make unnecessary.
    const onEdge = pt => outer.some((a, i) => {
      const b = outer[(i + 1) % outer.length];
      const cross = (b.x - a.x) * (pt.z - a.z) - (b.z - a.z) * (pt.x - a.x);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < EPS || Math.abs(cross) / len > EPS) return false;
      const t = ((pt.x - a.x) * (b.x - a.x) + (pt.z - a.z) * (b.z - a.z)) / (len * len);
      return t >= -EPS && t <= 1 + EPS;
    });
    const within = pt => {
      if (onEdge(pt)) return true;
      let hit = false;
      for (let i = 0, j = outer.length - 1; i < outer.length; j = i, i += 1) {
        const a = outer[i], b = outer[j];
        if ((a.z > pt.z) !== (b.z > pt.z)
          && pt.x < (b.x - a.x) * (pt.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    };
    if (!inner.every(within)) return false;
    // Corners alone are not enough on a CONCAVE host: a triangle with all three
    // corners on an L-shaped floor can still run its long edge through the
    // notch. So also require that no edge PROPERLY crosses a host edge —
    // strict sign changes on both sides, which is deliberately false for edges
    // that merely touch at a point or lie along each other. Collinear must not
    // count: an opening flush to an exterior wall shares that wall's line, and
    // that is the case this whole guard exists to keep legal.
    const side = (a, b, p) => Math.sign((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
    const properlyCrosses = (a, b, c, d) =>
      side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
    for (let i = 0; i < inner.length; i += 1) {
      const a = inner[i], b = inner[(i + 1) % inner.length];
      for (let j = 0; j < outer.length; j += 1) {
        const c = outer[j], d = outer[(j + 1) % outer.length];
        if (properlyCrosses(a, b, c, d)) return false;
      }
    }
    return true;
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

  // Offset a closed outline outward by a distance: each edge line shifts along
  // its outward normal and each corner is the intersection of its two shifted
  // edges, so angled footprints stay true. Orientation-agnostic — whichever
  // normal direction grows the area is outward; a negative distance insets.
  // GABLE CORNER (board #252): the overhang a roof edge is BUILT with, given
  // its kind and the office's gable-corner style. The boxed treatments
  // ('porkchop', 'boxed') halve the gable-edge overhang for proportion —
  // 2' eaves → 1' rake; 'flat' and 'return' keep the full overhang, and
  // eave edges always do. Pure rule: every footprint derivation (bone,
  // garage roof, tour preview) reads it so plan, faces, and auto-dims all
  // see one geometry.
  const gableOverhangFt = (kind, overhangFt, cornerStyle) => (
    kind === 'gable' && (cornerStyle === 'porkchop' || cornerStyle === 'boxed')
      ? overhangFt / 2 : overhangFt
  );

  // Per-edge offset (board #238): like offsetOutline — line displacement plus
  // corner re-intersection — but each edge carries its own distance, so one
  // roof edge can be pulled further out than its neighbours. Outward
  // orientation is resolved once with a uniform unit probe, so zero or mixed
  // distances cannot fool the area test.
  const offsetOutlineVariable = (points, distances) => {
    const count = points.length;
    const area = pts => Math.abs(pts.reduce((sum, pt, index) => {
      const next = pts[(index + 1) % pts.length];
      return sum + (pt.x * next.z - next.x * pt.z);
    }, 0) / 2);
    const offsetWith = (flip, dists) => {
      const edges = points.map((pt, index) => {
        const next = points[(index + 1) % count];
        const dx = next.x - pt.x, dz = next.z - pt.z;
        const len = Math.hypot(dx, dz) || 1;
        const d = dists[index] || 0;
        const nx = flip * dz / len, nz = -flip * dx / len;
        return { ax: pt.x + nx * d, az: pt.z + nz * d, dx: dx / len, dz: dz / len, nx, nz, d };
      });
      return points.map((pt, index) => {
        const prev = edges[(index + count - 1) % count], edge = edges[index];
        const cross = prev.dx * edge.dz - prev.dz * edge.dx;
        if (Math.abs(cross) < 1e-9) return { x: pt.x + edge.nx * edge.d, z: pt.z + edge.nz * edge.d };
        const t = ((edge.ax - prev.ax) * edge.dz - (edge.az - prev.az) * edge.dx) / cross;
        return { x: prev.ax + prev.dx * t, z: prev.az + prev.dz * t };
      });
    };
    const unit = offsetWith(1, points.map(() => 1));
    const flip = area(unit) >= area(points) ? 1 : -1;
    return offsetWith(flip, distances);
  };

  const offsetOutline = (points, distance) => {
    if (!distance) return points.map(pt => ({ ...pt }));
    const count = points.length;
    const polygonArea = pts => Math.abs(pts.reduce((sum, pt, index) => {
      const next = pts[(index + 1) % pts.length];
      return sum + (pt.x * next.z - next.x * pt.z);
    }, 0) / 2);
    const offsetWith = flip => {
      const edges = points.map((pt, index) => {
        const next = points[(index + 1) % count];
        const dx = next.x - pt.x, dz = next.z - pt.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = flip * dz / len, nz = -flip * dx / len;
        return { ax: pt.x + nx * distance, az: pt.z + nz * distance, dx: dx / len, dz: dz / len, nx, nz };
      });
      return points.map((pt, index) => {
        const prevEdge = edges[(index + count - 1) % count], edge = edges[index];
        const cross = prevEdge.dx * edge.dz - prevEdge.dz * edge.dx;
        if (Math.abs(cross) < 1e-9) return { x: pt.x + edge.nx * distance, z: pt.z + edge.nz * distance };
        const t = ((edge.ax - prevEdge.ax) * edge.dz - (edge.az - prevEdge.az) * edge.dx) / cross;
        return { x: prevEdge.ax + prevEdge.dx * t, z: prevEdge.az + prevEdge.dz * t };
      });
    };
    const first = offsetWith(1);
    return (polygonArea(first) >= polygonArea(points)) === (distance > 0) ? first : offsetWith(-1);
  };

  // Straight-skeleton wavefront for the tagged footprint: eave edges advance
  // inward at a uniform rate while gable edges stay put, and the paths the
  // corners trace as edges collapse become the hip / valley / ridge lines.
  // Concave footprints (L / T / U) split the ring at reflex corners so each
  // wing resolves to its own ridge, joined by valleys.
  const roofSkeleton = (roof) => {
    const initialCount = roof.points.length;
    if (initialCount < 3) return [];
    let pts = roof.points.map(pt => ({ x: pt.x, z: pt.z }));
    let kinds = pts.map((_, index) => (roof.edges[index] === 'gable' ? 'gable' : 'eave'));
    const signedArea = list => list.reduce((sum, pt, index) => {
      const next = list[(index + 1) % list.length];
      return sum + (pt.x * next.z - next.x * pt.z);
    }, 0);
    // Work on a CCW copy so the inward normals are consistent. Edge i runs
    // point i → i+1, so reversing the points remaps edge kinds too.
    if (signedArea(pts) < 0) {
      const original = kinds;
      pts = pts.slice().reverse();
      kinds = pts.map((_, index) => original[(initialCount * 2 - 2 - index) % initialCount]);
    }
    const gableEdges = [];
    pts.forEach((pt, index) => {
      if (kinds[index] === 'gable') gableEdges.push({ a: pt, b: pts[(index + 1) % pts.length] });
    });
    const eps = 1e-6;
    const arcs = [];
    // Concave footprints split the shrinking ring in two when a reflex corner
    // reaches an opposite edge (the valley), so the wavefront runs as a queue
    // of independent loops.
    // Each loop carries t0, its elapsed wavefront advance at entry: arc
    // endpoints record their advance (ta/tb) so a roof plane's height can be
    // read straight off an arc — height = t × pitch/12 above the eave line.
    // 2D consumers read only a/b; the t fields are for the 3D lift.
    const queue = [{ pts, kinds, t0: 0 }];
    let guard = initialCount * 8;
    while (queue.length && guard-- > 0) {
      const loop = queue.shift();
      pts = loop.pts;
      kinds = loop.kinds;
      const t0 = loop.t0 || 0;
      if (pts.length < 3 || Math.abs(signedArea(pts)) < eps) continue;
      const count = pts.length;
      const normals = pts.map((pt, index) => {
        const next = pts[(index + 1) % count];
        const dx = next.x - pt.x, dz = next.z - pt.z;
        const len = Math.hypot(dx, dz) || 1;
        return { x: -dz / len, z: dx / len };
      });
      const speeds = kinds.map(kind => (kind === 'gable' ? 0 : 1));
      // Each vertex moves so both adjacent offset edges stay in contact:
      // v · nA = speedA and v · nB = speedB.
      const velocities = pts.map((pt, index) => {
        const nA = normals[(index + count - 1) % count], nB = normals[index];
        const sA = speeds[(index + count - 1) % count], sB = speeds[index];
        const det = nA.x * nB.z - nA.z * nB.x;
        if (Math.abs(det) < 1e-9) {
          const speed = Math.max(sA, sB);
          return { x: nB.x * speed, z: nB.z * speed };
        }
        return { x: (sA * nB.z - sB * nA.z) / det, z: (sB * nA.x - sA * nB.x) / det };
      });
      // Earliest edge collapse: endpoints closing along the edge direction.
      let collapseT = Infinity;
      for (let index = 0; index < count; index++) {
        const next = (index + 1) % count;
        const dx = pts[next].x - pts[index].x, dz = pts[next].z - pts[index].z;
        const len = Math.hypot(dx, dz);
        if (len < eps) { collapseT = 0; break; }
        const closing = (velocities[index].x - velocities[next].x) * (dx / len)
          + (velocities[index].z - velocities[next].z) * (dz / len);
        if (closing > eps) collapseT = Math.min(collapseT, len / closing);
      }
      // Earliest split: a reflex corner catching a non-adjacent advancing edge —
      // where the ring pinches in two and a valley forms.
      let splitT = Infinity, splitVertex = -1, splitEdge = -1;
      for (let index = 0; index < count; index++) {
        const prev = pts[(index + count - 1) % count], next = pts[(index + 1) % count];
        const cross = (pts[index].x - prev.x) * (next.z - pts[index].z)
          - (pts[index].z - prev.z) * (next.x - pts[index].x);
        if (cross >= -eps) continue; // convex corner
        for (let edge = 0; edge < count; edge++) {
          if (edge === index || (edge + 1) % count === index) continue;
          const n = normals[edge];
          const denom = n.x * velocities[index].x + n.z * velocities[index].z - speeds[edge];
          if (Math.abs(denom) < 1e-9) continue;
          const t = (n.x * (pts[edge].x - pts[index].x) + n.z * (pts[edge].z - pts[index].z)) / denom;
          if (t < eps || t >= Math.min(splitT, collapseT) - eps) continue;
          const hit = {
            x: pts[index].x + velocities[index].x * t,
            z: pts[index].z + velocities[index].z * t,
          };
          const a = {
            x: pts[edge].x + velocities[edge].x * t,
            z: pts[edge].z + velocities[edge].z * t,
          };
          const bIndex = (edge + 1) % count;
          const b = {
            x: pts[bIndex].x + velocities[bIndex].x * t,
            z: pts[bIndex].z + velocities[bIndex].z * t,
          };
          const dx = b.x - a.x, dz = b.z - a.z;
          const len2 = dx * dx + dz * dz;
          if (len2 < eps) continue;
          const u = ((hit.x - a.x) * dx + (hit.z - a.z) * dz) / len2;
          if (u < -0.001 || u > 1.001) continue;
          splitT = t; splitVertex = index; splitEdge = edge;
        }
      }
      const bestT = Math.min(collapseT, splitT);
      if (!Number.isFinite(bestT)) continue;
      const t1 = t0 + bestT;
      const moved = pts.map((pt, index) => ({
        x: pt.x + velocities[index].x * bestT,
        z: pt.z + velocities[index].z * bestT,
      }));
      moved.forEach((pt, index) => {
        if (Math.hypot(pt.x - pts[index].x, pt.z - pts[index].z) > eps) arcs.push({ a: pts[index], b: pt, ta: t0, tb: t1 });
      });
      if (splitT < collapseT - eps) {
        // Pinch the ring at the reflex corner: two loops share the split point.
        const s = moved[splitVertex];
        const loopA = { pts: [ { ...s } ], kinds: [kinds[splitVertex]], t0: t1 };
        for (let index = (splitVertex + 1) % count; index !== (splitEdge + 1) % count; index = (index + 1) % count) {
          loopA.pts.push(moved[index]);
          loopA.kinds.push(kinds[index]);
        }
        loopA.kinds[loopA.kinds.length - 1] = kinds[splitEdge];
        const loopB = { pts: [ { ...s } ], kinds: [kinds[splitEdge]], t0: t1 };
        for (let index = (splitEdge + 1) % count; index !== splitVertex; index = (index + 1) % count) {
          loopB.pts.push(moved[index]);
          loopB.kinds.push(kinds[index]);
        }
        queue.push(loopA, loopB);
        continue;
      }
      // Drop collapsed edges; each surviving edge keeps its start vertex.
      let nextPts = [];
      let nextKinds = [];
      for (let index = 0; index < count; index++) {
        const next = (index + 1) % count;
        if (Math.hypot(moved[next].x - moved[index].x, moved[next].z - moved[index].z) <= eps * 10) continue;
        nextPts.push(moved[index]);
        nextKinds.push(kinds[index]);
      }
      if (nextPts.length === count && splitT >= collapseT) continue; // no topological change — stop this loop
      // Simultaneous collapses can fold the ring back over itself: a zero-width
      // spike is a finished ridge, so emit it and trim the ring.
      let trimmed = true;
      while (trimmed && nextPts.length >= 3) {
        trimmed = false;
        for (let index = 0; index < nextPts.length; index++) {
          const size = nextPts.length;
          const prev = nextPts[(index + size - 1) % size];
          const pt = nextPts[index];
          const next = nextPts[(index + 1) % size];
          const lenA = Math.hypot(pt.x - prev.x, pt.z - prev.z) || 1;
          const lenB = Math.hypot(next.x - pt.x, next.z - pt.z) || 1;
          const ax = (pt.x - prev.x) / lenA, az = (pt.z - prev.z) / lenA;
          const bx = (next.x - pt.x) / lenB, bz = (next.z - pt.z) / lenB;
          if (Math.abs(ax * bz - az * bx) > 1e-4 || ax * bx + az * bz > -0.9999) continue;
          const tail = lenA <= lenB ? prev : next;
          if (Math.hypot(pt.x - tail.x, pt.z - tail.z) > eps) arcs.push({ a: pt, b: tail, ta: t1, tb: t1 });
          nextPts.splice(index, 1);
          nextKinds.splice(index, 1);
          trimmed = true;
          break;
        }
      }
      if (nextPts.length === 2) {
        if (Math.hypot(nextPts[1].x - nextPts[0].x, nextPts[1].z - nextPts[0].z) > eps) {
          arcs.push({ a: nextPts[0], b: nextPts[1], ta: t1, tb: t1 }); // the ridge
        }
        continue;
      }
      queue.push({ pts: nextPts, kinds: nextKinds, t0: t1 });
    }
    // A gable corner slides along its own gable edge — that trace is the edge
    // itself, not a roof line, so drop arcs lying on a single gable edge.
    const onSegment = (pt, seg) => {
      const dx = seg.b.x - seg.a.x, dz = seg.b.z - seg.a.z;
      const len2 = dx * dx + dz * dz;
      if (len2 < eps) return false;
      const t = ((pt.x - seg.a.x) * dx + (pt.z - seg.a.z) * dz) / len2;
      if (t < -0.01 || t > 1.01) return false;
      const px = seg.a.x + dx * t, pz = seg.a.z + dz * t;
      return Math.hypot(pt.x - px, pt.z - pz) < 0.01;
    };
    return arcs.filter(arc => !gableEdges.some(edge => onSegment(arc.a, edge) && onSegment(arc.b, edge)));
  };


// Planar face tracing over footprint edges + skeleton arcs: standard
// half-edge walk taking the sharpest counter-clockwise turn, keeping
// bounded faces. Each bounded face names the one EAVE footprint edge on
// its boundary — that edge's line plus the pitch is the face's plane.
const roofFaces = (roof, arcs) => {
  const pts = roof.points.map(pt => ({ x: pt.x, z: pt.z }));
  const kinds = pts.map((_, i) => (roof.edges?.[i] === 'gable' ? 'gable' : 'eave'));
  // Arc endpoints can land mid-edge on the footprint (the skeleton drops
  // arcs that slide along a gable, leaving a ridge end sitting on it), so
  // each footprint edge splits at any such point. Sub-segments keep the
  // PARENT edge as the face's eave line — the plane uses the infinite line,
  // so the distance is identical.
  const arcEnds = [];
  arcs.forEach(arc => { arcEnds.push(arc.a, arc.b); });
  const segments = [];
  pts.forEach((pt, i) => {
    const a = pt, b = pts[(i + 1) % pts.length];
    const ex = b.x - a.x, ez = b.z - a.z;
    const len2 = ex * ex + ez * ez;
    const cuts = [0, 1];
    arcEnds.forEach(p => {
      const t = ((p.x - a.x) * ex + (p.z - a.z) * ez) / len2;
      if (t <= 1e-6 || t >= 1 - 1e-6) return;
      const px = a.x + ex * t, pz = a.z + ez * t;
      if (Math.hypot(p.x - px, p.z - pz) < 1e-4) cuts.push(t);
    });
    cuts.sort((p, q) => p - q);
    for (let c = 0; c < cuts.length - 1; c++) {
      if (cuts[c + 1] - cuts[c] < 1e-9) continue;
      segments.push({
        a: { x: a.x + ex * cuts[c], z: a.z + ez * cuts[c] },
        b: { x: a.x + ex * cuts[c + 1], z: a.z + ez * cuts[c + 1] },
        boundary: true, kind: kinds[i], parent: { a, b }, index: i,
      });
    }
  });
  arcs.forEach(arc => segments.push({ a: arc.a, b: arc.b, boundary: false }));

  // Node pool with epsilon dedup.
  const nodes = [];
  const nodeAt = p => {
    for (let i = 0; i < nodes.length; i++) {
      if (Math.abs(nodes[i].x - p.x) < 1e-4 && Math.abs(nodes[i].z - p.z) < 1e-4) return i;
    }
    nodes.push({ x: p.x, z: p.z });
    return nodes.length - 1;
  };
  // Half-edges.
  const half = [];
  segments.forEach(segment => {
    const na = nodeAt(segment.a), nb = nodeAt(segment.b);
    if (na === nb) return;
    const fwd = { from: na, to: nb, seg: segment, twin: null, next: null, used: false };
    const rev = { from: nb, to: na, seg: segment, twin: fwd, next: null, used: false };
    fwd.twin = rev;
    half.push(fwd, rev);
  });
  // Angular order of outgoing half-edges per node.
  const out = new Map();
  half.forEach(h => {
    if (!out.has(h.from)) out.set(h.from, []);
    out.get(h.from).push(h);
  });
  const angleOf = h => Math.atan2(nodes[h.to].z - nodes[h.from].z, nodes[h.to].x - nodes[h.from].x);
  out.forEach(list => list.sort((p, q) => angleOf(p) - angleOf(q)));
  // next(h): at h.to, the outgoing edge one step clockwise from h.twin.
  half.forEach(h => {
    const list = out.get(h.to);
    const i = list.indexOf(h.twin);
    h.next = list[(i - 1 + list.length) % list.length];
  });
  // Trace faces.
  const faces = [];
  half.forEach(start => {
    if (start.used) return;
    const ring = [];
    let h = start;
    let guard = half.length + 1;
    while (!h.used && guard-- > 0) {
      h.used = true;
      ring.push(h);
      h = h.next;
    }
    if (h !== start) return; // open walk (shouldn't happen on a tiled graph)
    const poly = ring.map(e => nodes[e.from]);
    const area2 = poly.reduce((sum, pt, i) => {
      const nxt = poly[(i + 1) % poly.length];
      return sum + (pt.x * nxt.z - nxt.x * pt.z);
    }, 0);
    if (area2 <= 1e-6) return; // outer face or degenerate
    const eaves = ring.filter(e => e.seg.boundary && e.seg.kind === 'eave');
    if (!eaves.length) return; // gable-only sliver: no roof plane
    const edge = eaves[0].seg;
    const line = edge.parent || { a: edge.a, b: edge.b };
    faces.push({ points: poly, area: area2 / 2, eave: { a: line.a, b: line.b } });
  });
  return faces;
};

const roofFaceRise = (face, p, pitch) => {
  const ex = face.eave.b.x - face.eave.a.x, ez = face.eave.b.z - face.eave.a.z;
  const len = Math.hypot(ex, ez) || 1;
  return Math.abs((p.x - face.eave.a.x) * ez - (p.z - face.eave.a.z) * ex) / len * (pitch || 4) / 12;
};

// Exact section profile: the cut segment clipped to each face, crossing
// points lifted by that face's plane. Returns u-sorted breakpoints only —
// straight lines between them at any cut angle.
const roofProfile = (roof, faces, cutA, cutB, axis) => {
  const pitch = roof.pitch || 4;
  const dx = cutB.x - cutA.x, dz = cutB.z - cutA.z;
  const pieces = [];
  faces.forEach(face => {
    const ts = [0, 1];
    const poly = face.points;
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      const ex = p2.x - p1.x, ez = p2.z - p1.z;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-6) continue;
      const t = ((p1.x - cutA.x) * ez - (p1.z - cutA.z) * ex) / den;
      const s = ((p1.x - cutA.x) * dz - (p1.z - cutA.z) * dx) / den;
      if (t > -1e-6 && t < 1 + 1e-6 && s > -1e-6 && s < 1 + 1e-6) ts.push(Math.min(1, Math.max(0, t)));
    }
    ts.sort((a, b) => a - b);
    const inside = p => {
      let inPoly = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const pi = poly[i], pj = poly[j];
        if ((pi.z > p.z) !== (pj.z > p.z)
          && p.x < (pj.x - pi.x) * (p.z - pi.z) / (pj.z - pi.z) + pi.x) inPoly = !inPoly;
      }
      return inPoly;
    };
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i], t1 = ts[i + 1];
      if (t1 - t0 < 1e-6) continue;
      const mid = { x: cutA.x + dx * (t0 + t1) / 2, z: cutA.z + dz * (t0 + t1) / 2 };
      if (!inside(mid)) continue;
      const p0 = { x: cutA.x + dx * t0, z: cutA.z + dz * t0 };
      const p1 = { x: cutA.x + dx * t1, z: cutA.z + dz * t1 };
      pieces.push({
        u0: p0.x * axis.x + p0.z * axis.z, rise0: roofFaceRise(face, p0, pitch),
        u1: p1.x * axis.x + p1.z * axis.z, rise1: roofFaceRise(face, p1, pitch),
      });
    }
  });
  pieces.sort((a, b) => Math.min(a.u0, a.u1) - Math.min(b.u0, b.u1));
  const points = [];
  pieces.forEach(piece => {
    const lo = piece.u0 <= piece.u1
      ? [{ u: piece.u0, rise: piece.rise0 }, { u: piece.u1, rise: piece.rise1 }]
      : [{ u: piece.u1, rise: piece.rise1 }, { u: piece.u0, rise: piece.rise0 }];
    lo.forEach(pt => {
      const last = points[points.length - 1];
      if (last && Math.abs(last.u - pt.u) < 1e-4 && Math.abs(last.rise - pt.rise) < 1e-4) return;
      points.push(pt);
    });
  });
  return points;
};


  // Upper envelope across several roofs' profiles: piecewise-linear max over
  // the union of breakpoints PLUS pairwise segment crossings — an envelope
  // vertexes where one roof passes another, not only at either one's kinks.
  const profileEnvelope = (profiles) => {
    // Event u-values stay EXACT (audit C6). Rounding them for de-duplication
    // moved each by up to 5e-6, five times the containment tolerance below,
    // so a profile's own endpoint could fall outside the segment it came
    // from — valueAt returned null, the point dropped, and a section with
    // fewer than two lit samples drew no roof at all. Near-equal events are
    // merged after sorting instead, which keeps the surviving value one the
    // profile really contains.
    //
    // The envelope-keeps-every-point guarantee holds for STRICTLY INCREASING
    // profiles, which is what roofProfile produces (sections draw fascia
    // drops themselves, so vertical steps never enter a profile). A profile
    // carrying two points at the same u would lose one to this merge.
    const EVENT_MERGE_EPS = 1e-9;
    const events = profiles.flat().map(p => p.u);
    const segs = profiles.map(profile => {
      const list = [];
      for (let i = 0; i < profile.length - 1; i++) list.push([profile[i], profile[i + 1]]);
      return list;
    });
    for (let a = 0; a < segs.length; a++) for (let b = a + 1; b < segs.length; b++) {
      segs[a].forEach(([p1, p2]) => segs[b].forEach(([q1, q2]) => {
        const lo = Math.max(p1.u, q1.u), hi = Math.min(p2.u, q2.u);
        if (hi - lo < 1e-9) return;
        const mP = (p2.rise - p1.rise) / (p2.u - p1.u), mQ = (q2.rise - q1.rise) / (q2.u - q1.u);
        if (Math.abs(mP - mQ) < 1e-12) return;
        const u = (q1.rise - mQ * q1.u - p1.rise + mP * p1.u) / (mP - mQ);
        if (u > lo + 1e-9 && u < hi - 1e-9) events.push(u);
      }));
    }
    const sorted = events.sort((x, y) => x - y)
      .filter((u, index, list) => index === 0 || u - list[index - 1] > EVENT_MERGE_EPS);
    const valueAt = (profile, u) => {
      for (let i = 0; i < profile.length - 1; i++) {
        const a = profile[i], b = profile[i + 1];
        if (u >= a.u - 1e-6 && u <= b.u + 1e-6 && b.u - a.u > 1e-9) {
          return a.rise + (b.rise - a.rise) * (u - a.u) / (b.u - a.u);
        }
      }
      return null;
    };
    return sorted.map(u => {
      let best = null;
      profiles.forEach(profile => {
        const v = valueAt(profile, u);
        if (v != null && (best === null || v > best)) best = v;
      });
      return { u, rise: best };
    }).filter(pt => pt.rise != null);
  };

  // ─── Where walls meet ─────────────────────────────────────────────────────
  // Groups wall endpoints by the SHARED POINT OBJECT and classifies each
  // vertex, returning a Map the wall painter reads to decide whether an end is
  // mitred, clipped, continued or capped. Identity, not proximity: two walls
  // at the same coordinate with separate point objects are not joined, which
  // is what keeps a garage wall from splicing into a coincident house wall.
  //
  // The four kinds it emits are miter, tee, continuation and multi. It never
  // emits `none` -- the painter honours that defensively, but nothing produces
  // it. See DEFINITIONS, JOIN.
  //
  // Lifted verbatim out of MODEL.dc.html's _wallJoins, which was already pure:
  // its only component reference was a default argument every caller overrode.
  //
  // THIS IS HALF OF WHAT THE NEW PAGE NEEDS, NOT ALL OF IT. MODEL.html passes
  // joins = null today, so every corner on it is a butt joint -- but sharing
  // this function does not by itself fix that. Identity is the key, and
  // MODEL.html builds its walls straight off parsed JSON, which restores
  // VALUES rather than references: its two walls at a shared corner hold
  // separate point objects, so this classifier finds no join and returns an
  // empty Map. Measured, not assumed. The other half is a vertex pool -- the
  // old page's _mergeVertex, which hands back ONE vector per corner -- and
  // until that moves too, the new page has nothing to pass here.
  function wallJoins(walls) {
    const endpointGroups = new Map();
    const add = (seg, pt, at) => {
      if (!endpointGroups.has(pt)) endpointGroups.set(pt, []);
      endpointGroups.get(pt).push({ seg, at });
    };
    walls.forEach(w => {
      add(w, w.start, 'start');
      add(w, w.end, 'end');
    });
    const joins = new Map();
    const outward = entry => {
      const vertex = entry.at === 'start' ? entry.seg.start : entry.seg.end;
      const other = entry.at === 'start' ? entry.seg.end : entry.seg.start;
      const dx = other.x - vertex.x, dz = other.z - vertex.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      return len < 0.001 ? null : { x: dx / len, z: dz / len };
    };
    for (const [vertex, entries] of endpointGroups) {
      if (entries.length === 2) {
        const a = outward(entries[0]), b = outward(entries[1]);
        if (a && b) {
          if (Math.abs(a.x * b.z - a.z * b.x) > 0.001) {
            joins.set(vertex, { type: 'miter', entries });
          } else if (a.x * b.x + a.z * b.z < -0.995) {
            joins.set(vertex, { type: 'continuation', entries });
          }
        }
        continue;
      }
      if (entries.length === 3) {
        let hostPair = null;
        let strongestOpposition = -1;
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            const a = outward(entries[i]), b = outward(entries[j]);
            if (!a || !b) continue;
            const opposition = -(a.x * b.x + a.z * b.z);
            if (opposition > strongestOpposition) {
              strongestOpposition = opposition;
              hostPair = [entries[i], entries[j]];
            }
          }
        }
        if (hostPair && strongestOpposition > 0.995) {
          joins.set(vertex, {
            type: 'tee',
            host: hostPair,
            stem: entries.find(entry => !hostPair.includes(entry)),
          });
        }
        continue;
      }
      if (entries.length >= 4) {
        // A cross or multi-stem node has no unambiguous two-wall miter. Keep
        // every arm open to the shared vertex rather than drawing cap lines
        // through it; the existing fill pass still draws every assembly.
        joins.set(vertex, { type: 'multi', entries });
      }
    }
    return joins;
  }

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
    selfIntersects,
    ringInsideRing,
    nearestIntersection,
    roomLoops,
    offsetOutline,
    offsetOutlineVariable,
    gableOverhangFt,
    roofSkeleton,
    roofFaces,
    roofFaceRise,
    roofProfile,
    profileEnvelope,
    wallJoins,
  };
})();
}