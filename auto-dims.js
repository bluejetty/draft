// AUTO DIMS string computation, extracted pure from the Model Space: plain
// data in (filtered walls/outlines/roofs, resolved opening centres, tuning
// numbers), dimension segments out. No THREE, no component state, no DOM —
// the caller owns filtering, vertex linking, and the dimension records.
if (!window.DraftAutoDims) {
(() => {
  // Computes the auto-dimension string stacks for one level/view. Returns
  // null when nothing on the plan is big enough to string (the caller keeps
  // existing dims in that case), else an array of segments:
  //   { start: {x, z}, end: {x, z}, srcStartId, srcEndId }
  // with srcIds naming the nearest master-linked corner for each end (null
  // when the group has no linked corners).
  function computeAutoDimStrings({
    walls, outlines, roofs, openings, offsetOutline,
    firstOffset, jogMergeFt, stringSpacingFt,
  }) {
    const toCorner = point => ({ x: point.x, z: point.z, srcId: point.srcId || null });
    // Which side each edge of a closed loop faces, and the coordinates its
    // corners lend to that side's string: N/S edges contribute x, W/E z. A
    // side only strings corners it can see, so a far-side notch never echoes.
    const facingOf = pts => {
      const facing = { N: [], S: [], W: [], E: [] };
      const area2 = pts.reduce((sum, pt, index) => {
        const next = pts[(index + 1) % pts.length];
        return sum + (pt.x * next.z - next.x * pt.z);
      }, 0);
      pts.forEach((pt, index) => {
        const next = pts[(index + 1) % pts.length];
        const dx = next.x - pt.x, dz = next.z - pt.z;
        const nx = area2 > 0 ? dz : -dz;
        const nz = area2 > 0 ? -dx : dx;
        const faces = Math.abs(nx) >= Math.abs(nz) ? (nx > 0 ? 'E' : 'W') : (nz > 0 ? 'S' : 'N');
        if (faces === 'N' || faces === 'S') facing[faces].push(pt.x, next.x);
        else facing[faces].push(pt.z, next.z);
      });
      return facing;
    };
    const mergeFacing = (into, from) =>
      ['N', 'S', 'W', 'E'].forEach(side => into[side].push(...from[side]));
    // The house and each garage string their own stacks: every group's dims
    // hug that group's own edge instead of the combined extents, so a garage
    // never pushes the house strings out past itself.
    const groups = [];
    const houseOutlines = outlines.filter(outline => !outline.garage);
    const housePoints = houseOutlines.flatMap(outline => outline.points.map(toCorner));
    if (housePoints.length) {
      const facing = { N: [], S: [], W: [], E: [] };
      houseOutlines.forEach(outline => mergeFacing(facing, facingOf(outline.points)));
      groups.push({ corners: housePoints, house: true, facing });
    }
    outlines.filter(outline => outline.garage)
      .forEach(outline => groups.push({
        corners: outline.points.map(toCorner), house: false, facing: facingOf(outline.points) }));
    if (!groups.length) {
      const wallCorners = walls.flatMap(wall => [toCorner(wall.start), toCorner(wall.end)]);
      if (wallCorners.length >= 2) groups.push({ corners: wallCorners, house: true });
    }
    // The ROOF level dims its roof footprints for the truss designer: each
    // roof strings its own stack, broken at the bearing wall corners so every
    // truss span and overhang reads straight off the plan.
    if (roofs.length) {
      groups.length = 0;
      roofs.forEach(roof => {
        const pts = roof.points;
        // The bearing line the trusses land on sits one overhang inside the
        // roof edge — the exterior wall face the footprint was grown from.
        const wallLoop = offsetOutline(pts.map(pt => ({ x: pt.x, z: pt.z })), -roof.overhang);
        groups.push({ corners: pts.map(toCorner), house: !roof.garage, roof: true,
          wallFacing: facingOf(wallLoop) });
      });
    }
    groups.forEach(group => {
      group.bbox = {
        minX: Math.min(...group.corners.map(point => point.x)),
        maxX: Math.max(...group.corners.map(point => point.x)),
        minZ: Math.min(...group.corners.map(point => point.z)),
        maxZ: Math.max(...group.corners.map(point => point.z)),
      };
    });
    const sized = groups.filter(group =>
      group.bbox.maxX - group.bbox.minX >= 0.01 && group.bbox.maxZ - group.bbox.minZ >= 0.01);
    if (!sized.length) return null;
    const houseBox = sized.find(group => group.house)?.bbox || null;
    const uniqSorted = values => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted.filter((value, index) => index === 0 || value - sorted[index - 1] > 0.01);
    };
    // Near-coincident corners string as ONE coordinate: a slightly off-square
    // outline gets straight strings instead of a pile of inch-scale jogs. The
    // end clusters keep the true extremes so overalls measure the footprint.
    const mergeJogs = values => {
      const sorted = [...values].sort((a, b) => a - b);
      const clusters = [];
      sorted.forEach(value => {
        const last = clusters[clusters.length - 1];
        if (last && value - last[last.length - 1] <= jogMergeFt) last.push(value);
        else clusters.push([value]);
      });
      return clusters.map((cluster, index) => {
        if (index === 0) return cluster[0];
        if (index === clusters.length - 1) return cluster[cluster.length - 1];
        return cluster.reduce((sum, value) => sum + value, 0) / cluster.length;
      });
    };
    // Fenestration centres, keyed to the group whose footprint holds the host
    // wall and to the side that wall faces within it.
    const openingsFor = sized.map(() => ({ N: [], S: [], W: [], E: [] }));
    openings.forEach(({ center, wall }) => {
      const horizontal = Math.abs(wall.end.x - wall.start.x) >= Math.abs(wall.end.z - wall.start.z);
      const mid = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
      let bestIndex = 0, bestScore = Infinity;
      sized.forEach((group, index) => {
        const box = group.bbox;
        const dx = Math.max(box.minX - mid.x, 0, mid.x - box.maxX);
        const dz = Math.max(box.minZ - mid.z, 0, mid.z - box.maxZ);
        // The tiny area term hands a wall shared by both footprints to the
        // smaller group — the garage's own doors dim with the garage.
        const score = dx * dx + dz * dz
          + (box.maxX - box.minX) * (box.maxZ - box.minZ) * 1e-6;
        if (score < bestScore) { bestScore = score; bestIndex = index; }
      });
      const box = sized[bestIndex].bbox;
      if (horizontal) openingsFor[bestIndex][mid.z - box.minZ <= box.maxZ - mid.z ? 'N' : 'S'].push(center.x);
      else openingsFor[bestIndex][mid.x - box.minX <= box.maxX - mid.x ? 'W' : 'E'].push(center.z);
    });
    // Strings never land on a building: each side's stack steps out from the
    // furthest footprint edge in its way, so a house side with an attached
    // garage beyond it strings outside the garage instead of across it, and
    // stacks sharing that corridor continue each other instead of colliding.
    const outward = { N: -1, S: 1, W: -1, E: 1 };
    const entries = [];
    sized.forEach((group, groupIndex) => {
      const corners = group.corners;
      const xs = mergeJogs(corners.map(point => point.x));
      const zs = mergeJogs(corners.map(point => point.z));
      const minX = xs[0], maxX = xs[xs.length - 1];
      const minZ = zs[0], maxZ = zs[zs.length - 1];
      // A garage side buried against the house gets no strings — that face
      // belongs to the house and its own stack already dims it.
      const sideClear = side => {
        if (group.house || !houseBox) return true;
        const fixed = side === 'N' ? minZ - firstOffset
          : side === 'S' ? maxZ + firstOffset
          : side === 'W' ? minX - firstOffset
          : maxX + firstOffset;
        // Shared-edge tolerance: a garage welded flush shares a coordinate
        // (to float dust) with the house — that is not an overlap.
        const edge = 0.01;
        if (side === 'N' || side === 'S') {
          return !(fixed > houseBox.minZ && fixed < houseBox.maxZ
            && minX < houseBox.maxX - edge && maxX > houseBox.minX + edge);
        }
        return !(fixed > houseBox.minX && fixed < houseBox.maxX
          && minZ < houseBox.maxZ - edge && maxZ > houseBox.minZ + edge);
      };
      ['N', 'S', 'W', 'E'].forEach(side => {
        if (!sideClear(side)) return;
        const cornerCoords = side === 'N' || side === 'S' ? xs : zs;
        const lo = cornerCoords[0], hi = cornerCoords[cornerCoords.length - 1];
        const strings = [];
        if (group.roof) {
          // Roof stack: the closest string runs roof edge → the wall corners
          // facing this side → roof edge (the end pieces read the overhang),
          // and the overall runs eave to eave across the whole footprint.
          const wallCoords = uniqSorted(mergeJogs(group.wallFacing[side]))
            .filter(value => value > lo + 0.01 && value < hi - 0.01);
          if (wallCoords.length) strings.push(uniqSorted([lo, ...wallCoords, hi]));
          strings.push([lo, hi]);
        } else {
          const centres = uniqSorted(openingsFor[groupIndex][side])
            .filter(value => value > lo + 0.01 && value < hi - 0.01);
          if (centres.length) strings.push(uniqSorted([lo, ...centres, hi]));
          const jogCoords = group.facing
            ? uniqSorted(mergeJogs([lo, hi, ...group.facing[side]]))
            : cornerCoords;
          if (jogCoords.length > 2) strings.push(jogCoords);
          strings.push([lo, hi]);
        }
        const own = side === 'N' ? minZ : side === 'S' ? maxZ : side === 'W' ? minX : maxX;
        entries.push({ group, side, lo, hi, strings, own, edge: own, base: 0 });
      });
    });
    // Push each stack's base edge past every footprint sitting in its path.
    // A footprint is in the path when it overlaps the strings' run, reaches
    // beyond the current edge, and leaves no room for the stack before it.
    entries.forEach(entry => {
      const dir = outward[entry.side];
      const depth = firstOffset + entry.strings.length * stringSpacingFt;
      for (let pass = 0; pass < sized.length; pass++) {
        let moved = false;
        sized.forEach(other => {
          if (other === entry.group) return;
          const box = other.bbox;
          const [spanLo, spanHi] = entry.side === 'N' || entry.side === 'S'
            ? [box.minX, box.maxX] : [box.minZ, box.maxZ];
          if (Math.min(spanHi, entry.hi) - Math.max(spanLo, entry.lo) <= 0.01) return;
          const [near, far] = entry.side === 'N' ? [box.maxZ, box.minZ]
            : entry.side === 'S' ? [box.minZ, box.maxZ]
            : entry.side === 'W' ? [box.maxX, box.minX]
            : [box.minX, box.maxX];
          if ((far - entry.edge) * dir <= 0.01) return;
          if ((near - entry.edge) * dir > depth) return;
          entry.edge = far;
          moved = true;
        });
        if (!moved) break;
      }
    });
    // Stacks that ended on the same corridor stack together: the footprint
    // whose own face IS that edge strings closest, the pushed-out ones after.
    ['N', 'S', 'W', 'E'].forEach(side => {
      const stack = entries.filter(entry => entry.side === side)
        .sort((a, b) => (b.own - a.own) * outward[side]);
      stack.forEach((entry, index) => {
        for (let i = 0; i < index; i++) {
          const prev = stack[i];
          if (Math.abs(prev.edge - entry.edge) > 0.01) continue;
          if (Math.min(prev.hi, entry.hi) - Math.max(prev.lo, entry.lo) <= 0.01) continue;
          entry.base += prev.strings.length;
        }
      });
    });
    const segments = [];
    entries.forEach(entry => {
      // Each string end names the nearest master-linked corner, so the caller
      // can carry the auto strings along with the footprint they measure.
      const nearestSrcId = vtx => {
        let best = null, bestD = Infinity;
        entry.group.corners.forEach(corner => {
          if (!corner.srcId) return;
          const d = (corner.x - vtx.x) ** 2 + (corner.z - vtx.z) ** 2;
          if (d < bestD) { bestD = d; best = corner; }
        });
        return best ? best.srcId : null;
      };
      const horizontal = entry.side === 'N' || entry.side === 'S';
      entry.strings.forEach((coords, stringIndex) => {
        const fixed = entry.edge + outward[entry.side]
          * (firstOffset + (entry.base + stringIndex) * stringSpacingFt);
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i], b = coords[i + 1];
          if (b - a < 0.05) continue;
          // The rendered dim line offsets to the right of the start→end
          // direction (south for west→east runs, west for north→south), so
          // N and E strings run reversed to keep the ink on the outward side.
          const flip = entry.side === 'N' || entry.side === 'E';
          const [p, q] = flip ? [b, a] : [a, b];
          const start = horizontal ? { x: p, z: fixed } : { x: fixed, z: p };
          const end = horizontal ? { x: q, z: fixed } : { x: fixed, z: q };
          segments.push({
            start, end,
            srcStartId: nearestSrcId(start),
            srcEndId: nearestSrcId(end),
          });
        }
      });
    });
    return segments;
  }

  window.DraftAutoDims = { computeAutoDimStrings };
})();
}
