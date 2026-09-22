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
  // ── WHAT NOTHING SITS ON ─────────────────────────────────────────────────
  //
  // Movie, 14 Sep: "if a main floor is added a roof should be added on it at
  // the lower level if the 2nd floor doesn't cover it, or also if the 2nd
  // floor is pulled back a main floor roof should cover the open ceiling".
  //
  // So a roof is not a thing attached to the top storey. It belongs to every
  // part of a floor the storey above does not cover, which is a polygon
  // DIFFERENCE -- and this module had no boolean operation of any kind.
  //
  // RECTILINEAR, BY DECOMPOSITION, and that is a decision worth its lines. A
  // general clipper is a large and delicate thing; TOY guarantees every
  // footprint is axis-aligned (there are no angles in TOY, ruled 14 Sep), so
  // the cheap exact method works: cut the plane on every x and every z either
  // outline mentions, ask of each cell whether it is inside the lower and
  // outside the upper, and glue the surviving cells back into rectangles.
  //
  // IT RETURNS RECTANGLES, NOT ONE POLYGON, and that is architecture rather
  // than laziness. A storey set back on all four sides leaves a RING
  // uncovered, and a ring is not expressible as a roof footprint -- the format
  // stores `points`, with no holes. Four lean-to roofs, one per side, is how
  // such a house is actually built and what the format can hold.
  const uncoveredRegions = (lower, upper) => {
    if (!Array.isArray(lower) || lower.length < 3) return [];
    const inside = (ring, x, z) => {
      let on = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const a = ring[i], b = ring[j];
        if ((a.z > z) !== (b.z > z)
          && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) on = !on;
      }
      return on;
    };
    const cover = Array.isArray(upper) && upper.length >= 3 ? upper : null;
    const axis = pick => {
      const all = lower.map(pick).concat(cover ? cover.map(pick) : []);
      return [...new Set(all.map(v => Number(v.toFixed(6))))].sort((a, b) => a - b);
    };
    const xs = axis(p => p.x), zs = axis(p => p.z);
    if (xs.length < 2 || zs.length < 2) return [];

    // One row of flags per band of z, so the glue below can run down columns.
    const open = [];
    for (let r = 0; r < zs.length - 1; r += 1) {
      const zMid = (zs[r] + zs[r + 1]) / 2;
      open.push(xs.slice(0, -1).map((x, c) => {
        const xMid = (x + xs[c + 1]) / 2;
        return inside(lower, xMid, zMid) && !(cover && inside(cover, xMid, zMid));
      }));
    }

    // GREEDY MAXIMAL RECTANGLES: take a cell, run right while the row stays
    // open, then run DOWN while every column of that span stays open, and
    // strike out what was taken. Fewest pieces for the common shapes -- one
    // rectangle for a storey pulled back from one side, four for a setback all
    // round -- and no piece is ever left one cell wide by accident.
    const out = [];
    for (let r = 0; r < open.length; r += 1) {
      for (let c = 0; c < open[r].length; c += 1) {
        if (!open[r][c]) continue;
        let c2 = c;
        while (c2 + 1 < open[r].length && open[r][c2 + 1]) c2 += 1;
        let r2 = r;
        while (r2 + 1 < open.length
          && open[r2 + 1].slice(c, c2 + 1).every(Boolean)) r2 += 1;
        for (let rr = r; rr <= r2; rr += 1) {
          for (let cc = c; cc <= c2; cc += 1) open[rr][cc] = false;
        }
        const x0 = xs[c], x1 = xs[c2 + 1], z0 = zs[r], z1 = zs[r2 + 1];
        out.push([{ x: x0, y: 0, z: z0 }, { x: x1, y: 0, z: z0 },
          { x: x1, y: 0, z: z1 }, { x: x0, y: 0, z: z1 }]);
      }
    }
    return out;
  };

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
    // Two events at the same instant fold a ring back over itself: one edge
    // of the ring ends up lying on top of another, pointing the other way,
    // and between them is a spike of no width. That spike is a finished
    // ridge -- the two wavefronts have already met along it -- so emit it and
    // trim the ring back to the shape that is actually left.
    //
    // THE RING MUST NOT BE QUEUED WITH THE SPIKE STILL ON IT. The corner at
    // the spike's base has one edge facing each way, its velocity solves to
    // the outward direction, and from the next event on the wavefront walks
    // out of the building. That is how a garage-plus-house outline came back
    // with its ridge a full storey too high.
    const trimSpikes = (loopPts, loopKinds, t) => {
      let trimmed = true;
      while (trimmed && loopPts.length >= 3) {
        trimmed = false;
        for (let index = 0; index < loopPts.length; index++) {
          const size = loopPts.length;
          const prev = loopPts[(index + size - 1) % size];
          const pt = loopPts[index];
          const next = loopPts[(index + 1) % size];
          const lenA = Math.hypot(pt.x - prev.x, pt.z - prev.z) || 1;
          const lenB = Math.hypot(next.x - pt.x, next.z - pt.z) || 1;
          const ax = (pt.x - prev.x) / lenA, az = (pt.z - prev.z) / lenA;
          const bx = (next.x - pt.x) / lenB, bz = (next.z - pt.z) / lenB;
          if (Math.abs(ax * bz - az * bx) > 1e-4 || ax * bx + az * bz > -0.9999) continue;
          const tail = lenA <= lenB ? prev : next;
          if (Math.hypot(pt.x - tail.x, pt.z - tail.z) > eps) arcs.push({ a: pt, b: tail, ta: t, tb: t });
          loopPts.splice(index, 1);
          loopKinds.splice(index, 1);
          trimmed = true;
          break;
        }
      }
    };
    // A ring is done when it is a single segment: that segment is the ridge.
    const settle = (loop) => {
      trimSpikes(loop.pts, loop.kinds, loop.t0);
      if (loop.pts.length === 2) {
        if (Math.hypot(loop.pts[1].x - loop.pts[0].x, loop.pts[1].z - loop.pts[0].z) > eps) {
          arcs.push({ a: loop.pts[0], b: loop.pts[1], ta: loop.t0, tb: loop.t0 });
        }
        return;
      }
      if (loop.pts.length >= 3) queue.push(loop);
    };
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
        settle(loopA);
        settle(loopB);
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
      settle({ pts: nextPts, kinds: nextKinds, t0: t1 });
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

  // THE OTHER HALF OF wallJoins, and the reason it could not mitre on the new
  // page. wallJoins keys endpoints by OBJECT IDENTITY; JSON restores values,
  // not references, so a drawing read back off disk has a separate point
  // object at every corner and the classifier finds nothing. This rebuilds the
  // identity, which is what MODEL.dc.html's load path calls "restoring
  // reference equality at shared corners instead of merely restoring values".
  //
  // THE KEY IS (levelId, viewId, body), NOT THE COORDINATE. Two walls may sit
  // on the same point and still be different buildings -- that is what keeps a
  // garage wall from splicing into a coincident house wall, and it is why the
  // body argument matters more than it looks. Pass the body through; do not
  // collapse it to a known set on the way in. An unrecognised body pools
  // separately, which is the safe direction: the walls stay butt-jointed
  // rather than joining something they are not part of.
  //
  // Lifted from MODEL.dc.html's _mergeVertex with two deliberate differences.
  // It builds a plain object rather than a THREE.Vector3, because nothing here
  // needs a vector and the new page loads no three.js; and it stores the body
  // on every vertex instead of only on non-house ones, because the original's
  // `(v._draftBody || 'house') === body` dance saves a field and costs a
  // reader. y is carried but not used by anything downstream -- wallJoins
  // reads x and z, and a plan projection drops y -- so it is not the pool's
  // job to know a level's elevation.
  function mergeVertex(pool, pt, levelId, viewId, body = 'house') {
    const THRESH = 0.001;   // snapped points are exact; this is for float dust
    for (const v of pool) {
      if (v._draftLevelId === levelId
        && v._draftViewId === viewId
        && v._draftBody === body
        && Math.abs(v.x - pt.x) < THRESH
        && Math.abs(v.z - pt.z) < THRESH) return v;
    }
    const v = {
      x: pt.x,
      y: Number.isFinite(pt.y) ? pt.y : 0,
      z: pt.z,
      _draftLevelId: levelId,
      _draftViewId: viewId,
      _draftBody: body,
    };
    pool.push(v);
    return v;
  }

  // THE THREE OUTLINE ACCESSORS, LIFTED VERBATIM FROM MODEL.dc.html.
  //
  // drawOutlines2D has been in render-2d.js since the painters moved, and no
  // page but MODEL.dc.html could call it -- not because of the painter, but
  // because three of its env keys resolved to `this._` methods on the model.
  // That is the distinction the tier spec draws: a painter that moved house
  // without changing address. These are the address.
  //
  // All three are pure -- no `this`, no module state, no canvas -- which is
  // why the lift is a copy rather than a rewrite. Nothing is "improved" on
  // the way across: a silent behaviour change here would show up as a
  // mis-drawn arc on one page and not the other, which is the most expensive
  // kind of difference to find. The names lose their underscore to match this
  // file; the bodies are byte-for-byte what MODEL.dc.html ran.
  //
  // geometry-2d.js rather than a new module on purpose: wall-joins-harness.js
  // source-loads this file and mutates it, so anything landing here is already
  // inside a mutation engine. A new file would be a new file with no coverage.

  // Outline segments are keyed to their starting point: points[index] carries
  // the bulge of the edge running to the next point (wrapping at the close).
  // An OPEN outline (attached garage) has no closing segment: the last point
  // has no outgoing edge, so it owns one fewer segment than it has points.
  function outlineSegment(outline, index) {
    const points = outline.points;
    const start = points[index];
    const end = outline.open === true ? (points[index + 1] || start) : points[(index + 1) % points.length];
    return { start, end, bulge: start.bulge || 0 };
  }

  function outlineSegmentCount(outline) {
    return outline.open === true ? outline.points.length - 1 : outline.points.length;
  }

  // Arc segments are quadratic curves: the control point sits at the segment
  // midpoint, offset along the left normal by the line's bulge (in feet).
  function lineControlPoint(seg) {
    const bulge = seg.bulge || 0;
    const dx = seg.end.x - seg.start.x, dz = seg.end.z - seg.start.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      x: (seg.start.x + seg.end.x) / 2 + (-dz / len) * bulge,
      y: ((seg.start.y || 0) + (seg.end.y || 0)) / 2,
      z: (seg.start.z + seg.end.z) / 2 + (dx / len) * bulge,
    };
  }

  // A point on a segment at parameter t, straight or arced. The arc is the
  // quadratic through start and end with lineControlPoint as its control.
  function pointOnLineSeg(seg, t) {
    const it = 1 - t;
    if (!seg.bulge) {
      return {
        x: seg.start.x + (seg.end.x - seg.start.x) * t,
        y: ((seg.start.y || 0) + (seg.end.y || 0)) / 2,
        z: seg.start.z + (seg.end.z - seg.start.z) * t,
      };
    }
    const c = lineControlPoint(seg);
    return {
      x: it * it * seg.start.x + 2 * it * t * c.x + t * t * seg.end.x,
      y: c.y,
      z: it * it * seg.start.z + 2 * it * t * c.z + t * t * seg.end.z,
    };
  }

  // How far worldPt lies from a segment, straight or arced, and where along it
  // -> { d, t }. This is what answers "did the drafter click that wall": the
  // caller compares d against its own pixel threshold, converted to world
  // units at the current zoom. THE THRESHOLD IS DELIBERATELY NOT HERE -- the
  // old page uses eight different ones (30px down to 4px) for different
  // targets, so a number baked in here would be a ninth, wrong for seven
  // callers and invisible to all of them.
  //
  // EXTRACTED FROM MODEL.dc.html's _distToLineSeg, which is the spec: same
  // degenerate rule (a segment shorter than 0.01ft is Infinity away, not zero
  // -- a zero would make every click "hit" a collapsed wall), same 24-step
  // sampling on the arc branch, same {d, t} shape.
  //
  // WHY IT IS HERE AND NOT COMPOSED FROM paramAlongSegment: that function
  // already exports the clamped projection -- the whole t half of this sum --
  // and eleven places in this repo wrote the same arithmetic anyway, six of
  // them as named functions under six different names (distPtSeg, distToSeg,
  // distToSegment, pointToSegment, _distToLineSeg). It was not composed
  // because the halves were never named as halves. It cannot simply call
  // paramAlongSegment either: that returns 0 for a degenerate segment where
  // this must report Infinity, and quietly swapping one for the other would
  // change what a click on a zero-length wall does.
  // ── IS THIS EDGE ON THAT LOOP? ───────────────────────────────────────────
  //
  // WHAT AN ATTACHED GARAGE ASKS BEFORE IT RAISES A WALL. Movie, 18 Sep, with
  // the offending wall marked in green on a screenshot: "the garage has an
  // extra wall that is not needed. the garage walls should link into the house
  // (look at how the DC version did it)". The DC version is one line of
  // _buildGarageWalls -- `if (!open && !detached && house &&
  // this._edgeOnOutline(a, b, house)) continue;` -- and this is that test,
  // lifted here so the two pages cannot come to different answers about which
  // edges are shared.
  //
  // THE MIDPOINT IS THE WHOLE TEST. Both ENDS of an edge lying on the loop is
  // not enough and the difference is not academic: a garage tucked into an L
  // can have both its corners on the house and its wall crossing open air
  // between them -- a chord. Dropping that wall would leave the building open
  // to the weather. Three samples is still only three samples, which is honest
  // for the straight runs this is asked about; a shape that needed more would
  // be a shape whose "shared" edge was a curve, and the loop below already
  // follows one of those through pointToSegment.
  //
  // SEGMENTS, NOT POINTS, is why the old page can hand this its own outline
  // unchanged. pointToSegment FOLLOWS A BULGE (it samples the arc), so a
  // points-only version of this would quietly straighten every arc edge it was
  // asked about and answer a different question on exactly the drawings where
  // the answer is hard.
  function edgeOnLoop(a, b, segments, eps = 0.1) {
    // A body with no loop to compare against — a DETACHED garage — shares
    // nothing, and is told so rather than thrown at. An EMPTY list needs no
    // guard of its own: `some` on nothing is false, so the first sample
    // already answers. A `|| !segments.length` stood here and was removed
    // after a mutation that deleted it changed no answer at all — a line
    // that cannot be wrong is a line that cannot be right either.
    if (!Array.isArray(segments)) return false;
    const near = pt => segments.some(seg => pointToSegment(pt, seg).d <= eps);
    return near(a) && near(b)
      && near({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
  }

  // The closed ring of segments a list of corners makes, in the shape
  // pointToSegment and edgeOnLoop read. Straight edges only: a caller holding
  // bulges builds its own segments and keeps them.
  function loopSegments(points) {
    const list = Array.isArray(points) ? points : [];
    return list.map((point, index) => ({
      start: point,
      end: list[(index + 1) % list.length],
      bulge: 0,
    }));
  }

  function pointToSegment(worldPt, seg) {
    if (!seg.bulge) {
      const ax = seg.start.x, az = seg.start.z;
      const dx = seg.end.x - ax, dz = seg.end.z - az;
      const len2 = dx * dx + dz * dz;
      if (len2 < 0.0001) return { d: Infinity, t: 0 };
      const t = Math.max(0, Math.min(1, ((worldPt.x - ax) * dx + (worldPt.z - az) * dz) / len2));
      return { d: Math.hypot(worldPt.x - ax - t * dx, worldPt.z - az - t * dz), t };
    }
    let bestD = Infinity, bestT = 0;
    const STEPS = 24;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const p = pointOnLineSeg(seg, t);
      const d = Math.hypot(worldPt.x - p.x, worldPt.z - p.z);
      if (d < bestD) { bestD = d; bestT = t; }
    }
    return { d: bestD, t: bestT };
  }

  // ─── AN OPENING ON ITS HOST WALL ─────────────────────────────────────────
  //
  // LIFTED OUT OF MODEL.dc.html, and the comments below the constants are
  // Movie's own reasoning carried across with them rather than mine.
  //
  // WHY IT MOVED. MODEL.html has to place doors and windows now, and the old
  // page has derived this since fenestration existed. A hand-rolled twin is
  // how #401 lost a shard, so the arithmetic lives here and both pages call
  // it. What each page does with the result stays its own business.
  //
  // EVERYTHING IS PASSED IN, including the wall list and a thickness lookup,
  // because this file holds no component state and must load under node. The
  // thickness lookup is a FUNCTION rather than a table: what a wall type is
  // belongs to wall-types.js, and a second copy of that lookup here is the
  // drift this extraction exists to prevent.

  // BEARING AT THE ENDS OF A LINTEL. NBC Table 9.23.12.3.-A note (4):
  // "provide minimum 38 mm bearing for lintel spans up to 3 m, or minimum
  // 76 mm bearing for lintel spans greater than 3 m". 38 mm is 1 1/2", 76 mm
  // is 3" -- and 3" is the figure Movie gave from the yard on 5 Sep before
  // either of us had opened the code book, which is a good sign for both.
  //
  // It is what an opening must keep back from the end of its wall, and before
  // #294 that was 0.01 ft -- an eighth of an inch, which is nothing. A window
  // could sit hard against a corner with no wood under the lintel to carry it.

  // A 6x6 post where no wall stands at the end of a run. Movie, 5 Sep: "if
  // nothing there use a 6x6 post". He first said 5.25" and corrected it to
  // 5.5" -- a dressed 6x6 is 5 1/2", the same dressing rule as his 2x8 at
  // 7 1/4". So a free end and a 2x6 corner reserve the same 8 1/2", which is
  // one number to remember rather than two that are nearly equal.
  const OPENING_FREE_END_POST_IN = 5.5;
  // SPAN-DEPENDENT, not a flat 3". A 3'-0" window and a 16'-0" garage door do
  // not need the same bearing, and rounding every opening up to the long-span
  // figure would refuse narrow walls that build perfectly well.
  const OPENING_BEARING_SHORT_IN = 1.5;
  const OPENING_BEARING_LONG_IN = 3;
  const OPENING_BEARING_SPAN_FT = 3 / 0.3048;   // the code's 3 m, 9'-10 1/8"

  // ── WHAT AN OPENING IS WHEN NOBODY HAS SAID ──────────────────────────────
  //
  // A door is 3'-0" wide and heads out at 6'-8"; a window is 4'-0" wide and
  // HEADS OUT AT 7'-0". Ordinary residential numbers, and none of them is a
  // geometry fact -- they are here because they were in THREE PLACES and
  // about to be in a fourth. MODEL.dc.html:2342-2345 held the originals;
  // premade-plans.js wrote its own DOOR_HEAD_FT and WINDOW_SILL_FT for the
  // bungalow; and MODEL.html was about to type a third set for its placing
  // gesture.
  //
  // THE WINDOW'S HEAD IS ITS OWN NUMBER NOW, and it used not to be -- both
  // kinds headed out at 6'-8" and premade-plans.js still calls the shared one
  // DOOR_HEAD_FT from when it answered for both. Movie, 21 Sep: *"on windows
  // the top of the window should be default located 7ft high from the current
  // level floor level (if the window changes size the bottom changes)"*, and
  // on 22 Sep, asked whether that was only the default or the rule: *"7' is
  // default window height, but use can change window height"*.
  //
  // SO THE HEAD IS THE DATUM AND THE SILL IS DERIVED. A window is described
  // by its head and its HEIGHT; `sill = head - height`. Today it is described
  // by sill and head with height falling out, which is the same three numbers
  // related the other way round and gives a different answer the moment a
  // window is resized. Heads line up across a wall and sills do not -- a row
  // of windows of different heights reads as a row when their tops agree and
  // as a mess when their bottoms do -- and it is how they are built: the
  // header is set by the framing and the opening grows downward from it.
  //
  // A DOOR IS UNTOUCHED. It stands on the floor, so its head IS its height,
  // and 6'-8" is the leaf the office orders.
  //
  // THE FAILURE THAT ENDS IS A QUIET ONE. Three copies of 6'-8" do not
  // disagree on the day they are written. They disagree the day someone raises
  // the head height for one page -- and the drawing then has two head heights
  // in it, the designed windows at one and the drafted ones at the other, with
  // nothing on the plan to say so. It is the DEFAULT_FLOOR_THICKNESS_IN
  // lesson, one module over.
  //
  // THEY LIVE BESIDE THE BEARING because this file already owns what an
  // opening must reserve and what shape it cuts; a default width is asked in
  // the same breath as "will it fit". Nothing here is a limit -- a drafter
  // types over any of them -- so they are named DEFAULT, not MIN or MAX.
  const DEFAULT_DOOR_WIDTH_FT = 3;
  const DEFAULT_WINDOW_WIDTH_FT = 4;
  const DEFAULT_WINDOW_SILL_FT = 2.5;
  const DEFAULT_OPENING_HEAD_FT = (6 * 12 + 8) / 12;
  const DEFAULT_WINDOW_HEAD_FT = 7;
  // THE HEIGHTS A WINDOW USED TO HEAD OUT AT, kept because a drawing made
  // before the ruling still carries one and drawing-format.js moves it. Two
  // of them: 6'-8" was the shared opening head this file has always named,
  // and 6'-6" was auto-windows.js's own catalogue, which put a 42" window on
  // a 3'-0" sill and a 24" one on a 4'-6" sill and headed both there.
  //
  // A HAND-SET HEAD IS NOT IN THIS LIST, which is the whole point of the
  // list existing rather than the migration moving every window it sees.
  // Movie asked for both -- "move to 7ft" and "use can change window
  // height" -- and those are only both true if what moves is what nobody
  // chose.
  const SUPERSEDED_WINDOW_HEADS_FT = Object.freeze([
    DEFAULT_OPENING_HEAD_FT,
    6.5,
  ]);

  // ── A WINDOW IS A SINGLE OR A DOUBLE CASEMENT, AND EACH COMES A SIZE ────
  //
  // Movie, 22 Sep, on the windows over the garage: *"lets make it a different
  // window TYPE in WINDOW PROPERTIES"*, *"it will be DOUBLE WINDOW"*, *"the
  // first one SINGLE CASEMENT, this one DOUBLE CASEMENT"* -- at *"36\" height"*
  // and *"66\" wide ... 1 window, with 2 window panes"*.
  //
  // A DEFAULT, NOT A RULE, and the distinction is his: *"no size should stay
  // the same (they can change it) ... ya lets make that size default for that
  // type"*. So a size here is what a window gets when it is PLACED as this
  // type. Switching an EXISTING window between the two changes how many panes
  // it wears and leaves every dimension alone -- which is the 7'-0" head
  // ruling a second time: what moves is what nobody chose.
  //
  // THE SINGLE'S SIZE IS DERIVED, NOT TYPED. It is what this file's own
  // defaults already made a window: 4'-0" wide, and 4'-2" tall because a 2'-6"
  // sill under the 6'-8" head that windows and doors used to share is a 4'-2"
  // window. Writing 4.167 here would be a third place to edit the day the
  // office changes it, and the two would disagree silently.
  const DEFAULT_WINDOW_HEIGHT_FT = DEFAULT_OPENING_HEAD_FT - DEFAULT_WINDOW_SILL_FT;
  // THE KEYS ARE THE VOCABULARY, which is why this is a table and not a list
  // beside one. drawing-format.js owns the vocabulary proper -- it validates
  // what a stored record may say, and it may not read anything off `window` --
  // so a second literal list here would be free to drift from it. Keyed like
  // this the two cannot disagree about WHICH casements exist without
  // proto/casement-harness.js going red, and there is no list to forget.
  const CASEMENT_SIZES_FT = Object.freeze({
    single: Object.freeze({
      widthFt: DEFAULT_WINDOW_WIDTH_FT,
      heightFt: DEFAULT_WINDOW_HEIGHT_FT,
    }),
    double: Object.freeze({ widthFt: 66 / 12, heightFt: 36 / 12 }),
  });
  // An unknown casement reads as a single rather than as nothing: this answers
  // the PLACER, and a placer with no size places no window at all.
  const casementSizeFt = kind => CASEMENT_SIZES_FT[kind] || CASEMENT_SIZES_FT.single;

  // The width an opening of this type takes when the drafter has not typed
  // one. A door and a window are the only two kinds this app cuts into a
  // wall, so anything that is not a window is a door -- the same fallback
  // every caller was already writing for itself.
  const defaultOpeningWidthFt = type => (type === 'window'
    ? DEFAULT_WINDOW_WIDTH_FT : DEFAULT_DOOR_WIDTH_FT);

  // What this opening must keep back from each end of its wall, so the lintel
  // has wood to bear on.
  const openingBearingFt = widthFt => (widthFt > OPENING_BEARING_SPAN_FT
    ? OPENING_BEARING_LONG_IN : OPENING_BEARING_SHORT_IN) / 12;

  // The wall meeting this one at `point`, if any. Matched on the endpoint
  // rather than through wallJoins on purpose: the clamp runs once per opening
  // per hit test, and building the join map in here would make that quadratic.
  // NOT ITSELF, BY ID AS WELL AS BY IDENTITY. The page this came from always
  // held the live wall object, so `other !== wall` was enough there. A module
  // is called by whoever has the numbers, and MODEL.html hands its painters
  // plain copies -- under identity alone a wall would find ITS OWN COPY
  // standing at its corner and take that as the carrier, reserving a whole
  // wall thickness that is not there. It renders perfectly and the lintel has
  // nowhere to bear.
  const wallMeetingAt = (wall, point, walls) => (walls || []).find(other => other !== wall
    && !(other.id !== undefined && wall.id !== undefined && String(other.id) === String(wall.id))
    && other.levelId === wall.levelId
    && (other.view || 'plan') === (wall.view || 'plan')
    && (distance(other.start, point) < 0.02 || distance(other.end, point) < 0.02));

  // WHAT ACTUALLY CARRIES THE END OF A LINTEL, and it is not the endpoint.
  // A wall's endpoint is a CENTRELINE intersection -- it sits INSIDE the wall
  // it runs into -- so reserving the bearing from it puts the opening that far
  // from a line in the middle of somebody else's studs, and counts those studs
  // as the bearing under the lintel.
  //
  // Movie, 5 Sep: the bearing is "measured from inside of exterior wall (5.5"
  // typ)". 5.5 + 3 = 8.5, which is his own older rule -- "make a wood wall max
  // to corner allowed 8.5"" -- arriving from the other direction.
  //
  // AND THERE IS NO FREE END. "If nothing there use a 6x6 post" -- something
  // always carries it, so the reserve is always (what is there) + bearing and
  // the rule has no undefined case. A rule with an "and otherwise, nothing" in
  // it is a bug with a delay on it.
  const openingEndReserveFt = (wall, point, bearingFt, { walls, thicknessFt }) => {
    const meeting = wallMeetingAt(wall, point, walls);
    const carrier = meeting ? thicknessFt(meeting) : OPENING_FREE_END_POST_IN / 12;
    return carrier + bearingFt;
  };

  // Keep the whole opening on the wall, with its bearing left at each end.
  // Returns null when the wall is too short for the width plus both bearings.
  //
  // faceReferenced:false is the OLD bearing-from-the-endpoint rule, and it
  // exists for exactly one caller: restore. Widening a rule must not reach
  // backwards into drawings that were sound when they were saved -- an opening
  // inside the new margin would MOVE on load, and one on a wall shorter than
  // width + 2 x 8 1/2" would be DROPPED and counted into the load message's
  // "skipped". Load repairs damaged files; it does not re-rule sound ones.
  const clampOpeningToWall = (wall, offset, width, opts = {}) => {
    const { walls, thicknessFt, faceReferenced = true } = opts;
    if (faceReferenced && typeof thicknessFt !== 'function') {
      throw new Error('clampOpeningToWall needs thicknessFt to know what carries each end — '
        + 'without it every end would reserve the free-post figure and openings would '
        + 'sit closer to a corner than the wood allows');
    }
    const bearing = openingBearingFt(width);
    // Each end is measured against whatever stands at THAT end -- a 2x6
    // exterior and a 2x4 partition do not reserve the same, and one wall can
    // meet a different thing at each of its ends.
    const ends = { walls, thicknessFt };
    const atStart = faceReferenced ? openingEndReserveFt(wall, wall.start, bearing, ends) : bearing;
    const atEnd = faceReferenced ? openingEndReserveFt(wall, wall.end, bearing, ends) : bearing;
    const len = distance(wall.start, wall.end);
    if (!(width > 0) || len < width + atStart + atEnd) return null;
    const half = width / 2;
    return { offset: Math.min(Math.max(offset, half + atStart), len - half - atEnd) };
  };

  // World-space footprint of an opening on its host wall: the carved quad, the
  // two jamb caps, the glazing centreline and the centre grab/snap point.
  //
  // `padFt` is the zoom fact, not a geometry one: the wall boundary stroke is
  // centred on the face, so the gap fill must reach a little past each face to
  // fully interrupt it, and "a little" is a couple of SCREEN pixels. The
  // caller owns the camera, so the caller converts. Zero is the honest value
  // for anything not painting to a canvas.
  const openingGeometry = (opening, wall, opts = {}) => {
    if (!wall || !opening) return null;
    const { walls, thicknessFt, padFt = 0, faceReferenced = true } = opts;
    const clamped = clampOpeningToWall(wall, opening.offset, opening.width,
      { walls, thicknessFt, faceReferenced });
    if (!clamped) return null;
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    const nx = -uz, nz = ux;
    const totalFt = thicknessFt(wall);
    const refLine = wall.refLine || 'center';
    const startOff = refLine === 'left' ? 0 : refLine === 'right' ? -totalFt : -totalFt / 2;
    const endOff = startOff + totalFt;
    const midOff = (startOff + endOff) / 2;
    const half = opening.width / 2;
    const at = (along, across) => ({
      x: wall.start.x + ux * along + nx * across,
      y: wall.start.y || 0,
      z: wall.start.z + uz * along + nz * across,
    });
    return {
      wall,
      center: at(clamped.offset, midOff),
      corners: [
        at(clamped.offset - half, startOff - padFt),
        at(clamped.offset + half, startOff - padFt),
        at(clamped.offset + half, endOff + padFt),
        at(clamped.offset - half, endOff + padFt),
      ],
      jambs: [
        [at(clamped.offset - half, startOff - padFt), at(clamped.offset - half, endOff + padFt)],
        [at(clamped.offset + half, startOff - padFt), at(clamped.offset + half, endOff + padFt)],
      ],
      glazing: [at(clamped.offset - half, midOff), at(clamped.offset + half, midOff)],
    };
  };

  // ─── WHICH WAY A SECTION LOOKS ───────────────────────────────────────────
  //
  // A cut is a line plus a direction, and the direction is the half of it that
  // is easy to store backwards. The drafter draws the line and then presses
  // the side they want to SEE; what the file keeps is where the VIEWER
  // STANDS, which is the opposite perpendicular. MODEL.dc.html:22324 says so
  // in its own words -- "the clicked arrow is the way the view LOOKS; dirVec
  // records where the viewer STANDS" -- and a cut stored the wrong way round
  // draws an identical line on the plan and a mirrored section everywhere
  // else.
  //
  // Lifted here because MODEL.html has to cut sections now, and this is the
  // one piece of the gesture that cannot be checked by looking at the plan.

  // The two perpendiculars of a cut line, as unit vectors. Null when the line
  // has no length, because a cut with no direction is not a cut.
  const cutPerpendiculars = (start, end) => {
    const dx = end.x - start.x, dz = end.z - start.z;
    const len = Math.hypot(dx, dz);
    if (!(len > 0)) return null;
    const nx = dx / len, nz = dz / len;
    return { left: { x: -nz, z: nx }, right: { x: nz, z: -nx } };
  };

  // Which side of the cut line a point falls on: the 2D cross product, so
  // positive is one side and negative the other. Zero means ON the line, and
  // the caller decides what to do about a press that picks no side.
  const cutSide = (start, end, at) =>
    (end.x - start.x) * (at.z - start.z) - (end.z - start.z) * (at.x - start.x);

  // THE STORED DIRECTION for a press on one side, with the flip already in it.
  // Ported from the old page exactly: a positive side takes the RIGHT
  // perpendicular, and that is the answer whichever way it reads, because the
  // press is where the drafter looks FROM the other side.
  const cutDirVec = (start, end, at) => {
    const perps = cutPerpendiculars(start, end);
    if (!perps) return null;
    return cutSide(start, end, at) > 0 ? perps.right : perps.left;
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
    selfIntersects,
    ringInsideRing,
    uncoveredRegions,
    nearestIntersection,
    roomLoops,
    offsetOutline,
    offsetOutlineVariable,
    gableOverhangFt,
    roofSkeleton,
    mergeVertex,
    roofFaces,
    roofFaceRise,
    roofProfile,
    profileEnvelope,
    wallJoins,
    outlineSegment,
    outlineSegmentCount,
    lineControlPoint,
    pointOnLineSeg,
    pointToSegment,
    edgeOnLoop,
    loopSegments,
    DEFAULT_DOOR_WIDTH_FT,
    DEFAULT_WINDOW_WIDTH_FT,
    DEFAULT_WINDOW_SILL_FT,
    DEFAULT_WINDOW_HEAD_FT,
    SUPERSEDED_WINDOW_HEADS_FT,
    DEFAULT_WINDOW_HEIGHT_FT,
    CASEMENT_SIZES_FT,
    casementSizeFt,
    DEFAULT_OPENING_HEAD_FT,
    defaultOpeningWidthFt,
    OPENING_FREE_END_POST_IN,
    OPENING_BEARING_SHORT_IN,
    OPENING_BEARING_LONG_IN,
    OPENING_BEARING_SPAN_FT,
    openingBearingFt,
    wallMeetingAt,
    openingEndReserveFt,
    clampOpeningToWall,
    openingGeometry,
    cutPerpendiculars,
    cutSide,
    cutDirVec,
  };
})();
}