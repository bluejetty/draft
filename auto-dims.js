// AUTO DIMS string computation, extracted pure from the Model Space: plain
// data in (filtered walls/outlines/roofs, resolved opening centres, tuning
// numbers), dimension segments out. No THREE, no component state, no DOM —
// the caller owns filtering, vertex linking, and the dimension records.
if (!window.DraftAutoDims) {
(() => {
  // Computes the auto-dimension string stacks for one level/view. Returns
  // null when nothing on the plan is big enough to string (the caller keeps
  // existing dims in that case), else an array of segments:
  //   { start: {x, z}, end: {x, z}, layer, srcStartId, srcEndId }
  // with srcIds naming the nearest master-linked corner for each end (null
  // when the group has no linked corners).
  // ── THE TUNING, WHERE THE THING IT TUNES LIVES ──────────────────────────
  //
  // These two were `const AUTO_DIM_STRING_SPACING_FT` and
  // `AUTO_DIM_JOG_MERGE_FT` at the top of MODEL.dc.html, and each had exactly
  // ONE use: the call below it. That is a number living in a page rather than
  // in the module it tunes, and the moment a second page called this module
  // it would have become two numbers free to drift -- the fourth-copy problem
  // this repo keeps paying for (RULING-a-ported-rule-keeps-one-home.md).
  //
  // They are DEFAULTS, not a law: computeAutoDimStrings still takes both as
  // arguments, so a caller with a reason can pass its own. What it may not do
  // is keep its own copy of the number it did not change.
  const STRING_SPACING_FT = 1.5;
  // Corners closer than this string as one coordinate.
  const JOG_MERGE_FT = 2 / 12;

  // ── WHICH LAYER EACH STRING LANDS ON ────────────────────────────────────
  //
  // Movie, 29 Sep: "with those i should be able to control them all on off
  // nicely". A dimension nobody can switch off is one this module decides for
  // every sheet that will ever show it -- and a REAL ESTATE PLAN wants the
  // footprint WITHOUT the wall runs, where a CONSTRUCTION LAYOUT wants both.
  // One drawing, two audiences, and until now one answer.
  //
  // THE LAYER IS DECIDED HERE, AT THE PUSH, because this is the only place
  // that knows what a string MEASURES. By the time a string leaves this
  // function all five kinds are the same shape -- two points and a distance --
  // so anything downstream would have to read the geometry back and infer the
  // intent from it. That inference is exactly the bug: an opening-centre
  // string on a house with one window has two coordinates, and so does the
  // overall. The emitter does not guess; it names what it just built.
  //
  // These ids are the drawing format's vocabulary, spelled the same in
  // profile-manager.js (the standards table, which carries their name and
  // print flag) and layer-views.js (which of them a given view starts with).
  // Spelled once here so this file holds one copy rather than five literals.
  //
  // A-DIMS-INT and A-DIMS-COLS are in that table and ABSENT FROM THIS OBJECT
  // on purpose: nothing in this module measures an interior wall or locates a
  // column yet, and a constant for a string that is never pushed would read
  // like coverage this file does not have.
  const DIM_LAYERS = Object.freeze({
    OVERALL: 'A-DIMS-OVR',       // the footprint: eave to eave, corner to corner
    EXTERIOR: 'A-DIMS-EXT',      // the overhang string and the outline jogs
    FENESTRATION: 'A-DIMS-FENS', // window and door centres
    COLUMNS: 'A-DIMS-COLS',      // where the posts and the beam line sit
    INTERIOR: 'A-DIMS-INT',      // wall faces, and partitions meeting this side
  });

  // How near an exterior wall a partition must reach to be dimensioned from
  // it. Movie, 29 Sep: "interior walls within 4 ft of an exterior wall on
  // each side". A wall stranded in the middle of the house has no exterior
  // face to be measured from, and putting it on all four strings would give
  // four figures for one wall and clutter every side of the sheet.
  const PARTITION_REACH_FT = 4;

  // How far off the columns their strings sit. Movie, 29 Sep: "about 1ft from
  // the cols".
  const COLUMN_CLEAR_FT = 1;
  // How far a column string stands off a beam on a side that already carries
  // a tag (the beam's own name, or a pile's footing), so its figures clear it.
  const TAG_CLEAR_FT = 2.5;
  const HOLE_MARGIN_FT = 0.25;
  // How far off a beam's line a column may stand and still be ON that beam.
  // Half a foot is wider than any placement error and narrower than the gap
  // to a second beam, so a neighbour's posts never join this beam's string.
  const ON_BEAM_FT = 0.5;
  // How close to a floor opening a string may sit. A string must not be drawn
  // ACROSS a hole -- there is nothing under it to measure to -- but it does
  // not need a foot of air to clear one. Inflating the hole by the full
  // clearance instead blocked BOTH sides of a beam running along a stair
  // hole's edge, so the beam got no string at all: a hole two feet away
  // silently cost the drawing its column dimensions. Three inches keeps the
  // string off the edge without claiming ground the hole does not occupy.

  // The grid the dimension labels print on: formatArchitecturalInches rounds
  // to the sixteenth, so 1/16" is 1/192 of a foot.
  const PRINT_GRID_FT = 1 / 192;
  // The shortest partial worth a string: under this the arrow pair and the
  // text have nowhere to sit.
  const MIN_PARTIAL_FT = 0.05;

  // One string's coordinates, ready to print (board #290 / audit C1).
  //
  // Every label is `formatArchitecturalInches(distance * 12)` at paint time,
  // which rounds to 1/16" — and a string of partials rounded one by one does
  // NOT sum to the separately-rounded overall above it. Traced corners are
  // free-running reals, so the mismatch was the normal case, not the corner
  // case: 39.5% of strings printed a total that disagreed with its own parts.
  //
  // Quantising the coordinates ONCE, here, fixes it by construction: every
  // partial and the overall are then differences of the same rounded numbers,
  // so the parts add up to the whole exactly. The dimension line moves by at
  // most 1/32" — the drawn extent now agrees with the printed number, which
  // is the point. No building geometry is touched.
  //
  // A partial too short to draw is ABSORBED, never dropped: dropping one
  // leaves a hole in the chain and the survivors stop summing to the overall.
  // HOISTED OUT OF computeAutoDimStrings so the column stack below reads the
  // same one. It closed over nothing; moving it changes no behaviour, and a
  // second copy is what this repo keeps paying for.
  const uniqSorted = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.filter((value, index) => index === 0 || value - sorted[index - 1] > 0.01);
  };

  const printableCoords = values => {
    const snapped = values.map(value => Math.round(value / PRINT_GRID_FT) * PRINT_GRID_FT);
    if (snapped.length < 2) return snapped;
    const kept = [snapped[0]];
    for (let i = 1; i < snapped.length - 1; i++) {
      if (snapped[i] - kept[kept.length - 1] >= MIN_PARTIAL_FT) kept.push(snapped[i]);
    }
    const last = snapped[snapped.length - 1];
    // The end coordinate always survives — it is what the overall measures to.
    // When it is the ONLY partial, it prints whatever length it has, even
    // under MIN_PARTIAL_FT: a lone partial has no neighbour to absorb into,
    // and a side with a string but no segments would be worse than a cramped
    // label. Needs a whole side under 0.6" to arise, so unreachable on a
    // real plan.
    if (last - kept[kept.length - 1] >= MIN_PARTIAL_FT || kept.length === 1) kept.push(last);
    else kept[kept.length - 1] = last;
    return kept;
  };

  function computeAutoDimStrings({
    walls, outlines, roofs, openings, offsetOutline,
    firstOffset, jogMergeFt, stringSpacingFt,
    // BOTH OR NEITHER, and the interior string is skipped without them. A
    // wall's FACES are where it is measured to, and a face is the stored line
    // offset by a thickness the caller owns the table for -- this module has
    // never known a wall type. Guessing a thickness here would print a figure
    // that is wrong by a wall and says nothing about it.
    thicknessFt, faceOffsets,
    // THE BEAMS ON A FRAMING SHEET, whose lines are located on the outside
    // of the plan (Movie, 11 Oct: "only need 1 mark for beams (if the beams
    // are lined up) and put it on the EXT of the plan").
    beams,
    // THE ROWS THE DRAFTER TOOK OFF (Movie, 26 Oct: "allow the user to be
    // able to DELETE a string ... when the line is deleted i'd like the other
    // lines to re-adjust. and then put it back if they change their mind").
    // `SIDE:LAYER` keys -- 'W:A-DIMS-INT' is the west side's interior row --
    // left out of the side's stack before it is laid, so the rows outside it
    // step in and close the gap.
    rowsOff,
  }) {
    const exteriorBeamLines = beamLinesOf(beams);
    const offRows = new Set(Array.isArray(rowsOff) ? rowsOff : []);
    const toCorner = point => ({ x: point.x, z: point.z, srcId: point.srcId || null });
    const boxOf = pts => ({
      minX: Math.min(...pts.map(pt => pt.x)), maxX: Math.max(...pts.map(pt => pt.x)),
      minZ: Math.min(...pts.map(pt => pt.z)), maxZ: Math.max(...pts.map(pt => pt.z)),
    });
    const touch = (a, b) => a.minX <= b.maxX + 0.05 && b.minX <= a.maxX + 0.05
      && a.minZ <= b.maxZ + 0.05 && b.minZ <= a.maxZ + 0.05;
    // Seeds that touch are one building. A seed is a LIST of items rather
    // than one, because the house's own loops are a single seed however they
    // sit: two wings drawn as two outlines are one house and always were, and
    // clustering them by touch would quietly split a stack this has never
    // split. Only the garages arrive as seeds of their own, to be joined or
    // not on their geometry.
    const clusterSeeds = seeds => {
      const clusters = [];
      seeds.forEach(seed => {
        const joined = clusters.filter(cluster =>
          cluster.some(other => seed.some(item => touch(other.box, item.box))));
        const merged = [...seed, ...joined.flat()];
        joined.forEach(cluster => clusters.splice(clusters.indexOf(cluster), 1));
        clusters.push(merged);
      });
      return clusters;
    };
    const insideAny = (loops, p) => loops.some(pts => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
        const a = pts[i], b = pts[j];
        if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    });
    // A SIDE STRINGS ONLY THE EDGES IT CAN SEE: an edge whose outside is
    // another loop of the same building is buried inside it and has nothing
    // to show from this side. Which side each edge faces, and the coordinates
    // its corners lend to that side's string: N/S edges contribute x, W/E z.
    const step = { N: { x: 0, z: -1 }, S: { x: 0, z: 1 }, W: { x: -1, z: 0 }, E: { x: 1, z: 0 } };
    const seenFacing = loops => {
      const facing = { N: [], S: [], W: [], E: [] };
      const runs = { N: [], S: [], W: [], E: [] };
      loops.forEach((own, ownIndex) => {
        const others = loops.filter((loop, index) => index !== ownIndex);
        // Each edge is judged on the side it really faces.
        const area2 = own.reduce((sum, pt, index) => {
          const next = own[(index + 1) % own.length];
          return sum + (pt.x * next.z - next.x * pt.z);
        }, 0);
        own.forEach((pt, index) => {
          const next = own[(index + 1) % own.length];
          const dx = next.x - pt.x, dz = next.z - pt.z;
          if (Math.hypot(dx, dz) < 1e-9) return;
          const nx = area2 > 0 ? dz : -dz;
          const nz = area2 > 0 ? -dx : dx;
          const side = Math.abs(nx) >= Math.abs(nz) ? (nx > 0 ? 'E' : 'W') : (nz > 0 ? 'S' : 'N');
          const along = side === 'N' || side === 'S' ? 'x' : 'z';
          const a = Math.min(pt[along], next[along]), b = Math.max(pt[along], next[along]);
          // PART OF AN EDGE CAN BE BURIED: split it wherever another loop's
          // corner falls along it, and keep the stretches whose outside is
          // open -- the house front stops where the garage starts, not at its
          // own far corner behind it.
          const cuts = uniqSorted([a, b, ...others.flat().map(q => q[along])
            .filter(v => v > a + 1e-6 && v < b - 1e-6)]);
          // Neighbouring open stretches join, so a cut that buries nothing
          // lends no coordinate of its own.
          let run = null;
          const across = along === 'x' ? pt.z : pt.x;
          const close = () => { if (run) runs[side].push({ across, lo: run[0], hi: run[1] }); run = null; };
          for (let c = 0; c + 1 < cuts.length; c += 1) {
            const t = (cuts[c] + cuts[c + 1]) / 2;
            const f = Math.abs(b - a) < 1e-9 ? 0.5 : (t - pt[along]) / (next[along] - pt[along]);
            const probe = { x: pt.x + dx * f, z: pt.z + dz * f };
            const out = { x: probe.x + step[side].x * 0.3, z: probe.z + step[side].z * 0.3 };
            if (insideAny(others, out)) close();
            else if (run) run[1] = cuts[c + 1];
            else run = [cuts[c], cuts[c + 1]];
          }
          close();
        });
      });
      // TWO LOOPS ON ONE LINE ARE ONE EDGE: overlapping or touching stretches
      // at the same offset join before they lend coordinates, so where the
      // house and the garage share a front there is no seam to dimension.
      Object.keys(runs).forEach(side => {
        const list = runs[side].sort((m, n) => m.across - n.across || m.lo - n.lo);
        let cur = null;
        list.forEach(r => {
          if (cur && Math.abs(r.across - cur.across) < 1e-6 && r.lo <= cur.hi + 1e-6) {
            cur.hi = Math.max(cur.hi, r.hi);
            return;
          }
          if (cur) facing[side].push(cur.lo, cur.hi);
          cur = { ...r };
        });
        if (cur) facing[side].push(cur.lo, cur.hi);
      });
      return facing;
    };
    // ── ONE STACK PER BUILDING ON THE PLANS TOO ─────────────────────────────
    //
    // Movie, 12 Oct, on a plan whose garage sits north of the house: "the
    // outer row that is 28' should go all the way to the other outside wall
    // (maybe around 35'? total) and then the next string that shows front of
    // garage (19ft i think) add the extra part on the north side dimention
    // from garage to outside wall", and "the door dimension can line up with
    // the garage door line". Three complaints with ONE cause: every row
    // stopped at its own group's edge, so the overall measured the house and
    // not the building, the jog row never reached the garage's step, and the
    // front door and the garage door were strung on two different rows.
    //
    // THIS REPLACES THE RULE THAT STOOD HERE -- "the house and each garage
    // string their own stacks: every group's dims hug that group's own edge
    // instead of the combined extents, so a garage never pushes the house
    // strings out past itself". It was right about what it was avoiding and
    // wrong about the unit. An ATTACHED garage is not a second building whose
    // dims crowd the house's; it is part of the one footprint the sheet
    // measures, and the row that stops at the house's corner is the bug. What
    // that rule was protecting against survives as the cluster test: a
    // DETACHED garage does not touch the house, so it stays its own building
    // and still strings its own stack against its own edge.
    //
    // It is the ruling the ROOF level already has (Movie, 11 Oct, below) --
    // one stack per building, every row reading right across it -- which the
    // floor plans never received. Same clustering, same seen-edge pass.
    const groups = [];
    const itemOf = outline => ({ outline, pts: outline.points, box: boxOf(outline.points) });
    // A LOT LINE IS NOT A BUILDING. The AUTOSITE rectangle (Movie, 13 Oct)
    // lives in `outlines` so it inherits their point editing, which means
    // every reader of outlines has to say whether it means buildings. This
    // one does: strung as a building it would put a 45' x 120' row around
    // the house and call the pair one cluster.
    const drawn = outlines.filter(outline =>
      outline.site !== true && outline.points && outline.points.length);
    const houseSeed = drawn.filter(outline => !outline.garage).map(itemOf);
    const seeds = houseSeed.length ? [houseSeed] : [];
    drawn.filter(outline => outline.garage).forEach(outline => seeds.push([itemOf(outline)]));
    clusterSeeds(seeds).forEach(cluster => groups.push({
      corners: cluster.flatMap(item => item.pts.map(toCorner)),
      house: cluster.some(item => !item.outline.garage),
      facing: seenFacing(cluster.map(item => item.pts)),
    }));
    if (!groups.length) {
      const wallCorners = walls.flatMap(wall => [toCorner(wall.start), toCorner(wall.end)]);
      if (wallCorners.length >= 2) groups.push({ corners: wallCorners, house: true });
    }
    // The ROOF level dims its roof footprints for the truss designer.
    //
    // ONE STACK PER BUILDING, NOT PER ROOF (Movie, 11 Oct): "the 1st row
    // closest to the building to be the edge of roof to edge of wall (showing
    // over hang), edge of wall to edge of wall / then to edge of roof again ...
    // 2nd row out will be edge of roof to edge of roofs, and then the 3rd row
    // will be very front edge roof to very back edge of roof (full lengeth of
    // building roof)" -- "all rows will be front to back and also side to
    // side". Roofs that touch are one building (house, attached garage, the
    // room over it); a detached garage's roof stands apart and keeps its own.
    if (roofs.length) {
      groups.length = 0;
      const items = roofs.map(roof => {
        const pts = roof.points.map(pt => ({ x: pt.x, z: pt.z }));
        // The bearing line the trusses land on sits one overhang inside the
        // roof edge — the exterior wall face the footprint was grown from.
        return { roof, pts, box: boxOf(pts), wallLoop: offsetOutline(pts, -roof.overhang) };
      });
      // Each roof stands as its own seed: roofs that touch are one building,
      // and that is the only thing joining them.
      clusterSeeds(items.map(item => [item])).forEach(cluster => {
        groups.push({
          corners: cluster.flatMap(item => item.pts.map(toCorner)),
          house: cluster.some(item => !item.roof.garage),
          roof: true,
          wallFacing: seenFacing(cluster.map(item => item.wallLoop)),
          roofFacing: seenFacing(cluster.map(item => item.pts)),
        });
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
    // Near-coincident corners string as ONE coordinate: a slightly off-square
    // outline gets straight strings instead of a pile of inch-scale jogs. The
    // end clusters keep the true extremes so overalls measure the footprint.
    //
    // The merged coordinate is always a REAL member of the cluster — a wall
    // face that exists in the building (audit M7). An interior cluster used to
    // collapse to its arithmetic mean, which put a printed dimension up to an
    // inch from any wall on the drawing: a fabricated coordinate on a permit
    // set. The dominant face wins (the coordinate the most edges land on),
    // ties going to the lowest member so the choice is deterministic — and a
    // tie is the COMMON case: a two-face cluster where each face contributes
    // the same number of edges. The chosen face is later snapped to the 1/16"
    // print grid, so the strung coordinate is a real face to the nearest
    // sixteenth rather than exactly on it.
    const dominantMember = cluster => {
      let best = cluster[0], bestCount = 0;
      cluster.forEach(value => {
        const count = cluster.filter(other => Math.abs(other - value) < 1e-9).length;
        if (count > bestCount) { bestCount = count; best = value; }
      });
      return best;
    };
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
        return dominantMember(cluster);
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
    // ── THE WALL FACES A SIDE'S INTERIOR STRING LANDS ON ─────────────────
    //
    // Perpendicular to the string (so it has a position along it), within
    // this group's footprint, and reaching within PARTITION_REACH_FT of the
    // side being measured. Both faces of each, because a wall's thickness is
    // a figure the framer needs and the drafter cannot get from a centreline.
    //
    // WITHOUT thicknessFt AND faceOffsets THIS RETURNS NOTHING, rather than
    // falling back to the stored line. A centreline dressed up as a face is
    // a dimension that lands half a wall from the wall it names, and prints
    // as confidently as a right one.
    const interiorFaces = (group, along, across, sideFace) => {
      if (!thicknessFt || !faceOffsets) return [];
      const box = group.bbox;
      const coords = [];
      walls.forEach(wall => {
        if (!wall || !wall.start || !wall.end) return;
        const midX = (wall.start.x + wall.end.x) / 2;
        const midZ = (wall.start.z + wall.end.z) / 2;
        if (midX < box.minX - 0.5 || midX > box.maxX + 0.5) return;
        if (midZ < box.minZ - 0.5 || midZ > box.maxZ + 0.5) return;
        const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.01) return;
        const u = { x: dx / len, z: dz / len };
        // Runs across the string, so it crosses it and has a coordinate ON
        // it. A wall parallel to the string is the one being measured FROM.
        if (Math.abs(u[across]) < 0.9) return;
        // And it has to REACH this side: the nearer of its two ends decides.
        const reach = Math.min(
          Math.abs(wall.start[across] - sideFace),
          Math.abs(wall.end[across] - sideFace));
        if (reach > PARTITION_REACH_FT) return;
        const normal = { x: -u.z, z: u.x };
        const offsets = faceOffsets(wall, thicknessFt(wall));
        coords.push(wall.start[along] + normal[along] * offsets.startOff);
        coords.push(wall.start[along] + normal[along] * offsets.endOff);
      });
      return uniqSorted(coords);
    };

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
        // A ROOF STACK IS BLOCKED ONLY WHERE THE HOUSE IS ACTUALLY IN ITS WAY
        // (Movie, 11 Oct, marking the garage's bottom edge on the roof plan:
        // "need some dimension lines for the other side of garage too"). A
        // garage set off the house's corner has a row line that lands inside
        // the house's box for a few feet at one end and is open the rest of
        // the way. The plan rule below treats any touch as buried; on a roof
        // plan that face is the garage's own eave and the truss designer needs
        // it. Buried means most of the run is behind the house.
        if (group.roof) {
          const ns = side === 'N' || side === 'S';
          const inBand = ns ? fixed > houseBox.minZ && fixed < houseBox.maxZ
            : fixed > houseBox.minX && fixed < houseBox.maxX;
          if (!inBand) return true;
          const lo = ns ? minX : minZ, hi = ns ? maxX : maxZ;
          const hlo = ns ? houseBox.minX : houseBox.minZ, hhi = ns ? houseBox.maxX : houseBox.maxZ;
          const covered = Math.max(0, Math.min(hi, hhi) - Math.max(lo, hlo));
          return covered <= (hi - lo) / 2;
        }
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
        // A side's string measures positions ALONG one axis and sits ACROSS
        // the other; `sideFace` is the face of the footprint this side IS,
        // which is what a partition has to reach to earn a place on it.
        const along = side === 'N' || side === 'S' ? 'x' : 'z';
        const across = side === 'N' || side === 'S' ? 'z' : 'x';
        const sideFace = side === 'N' ? minZ : side === 'S' ? maxZ
          : side === 'W' ? minX : maxX;
        const strings = [];
        if (group.roof) {
          // Roof stack, three out (Movie, 11 Oct). CLOSEST: roof edge → the
          // wall faces this side sees → roof edge, so the end pieces read the
          // overhang. SECOND: every roof edge this side sees, so each step
          // between roofs reads. THIRD: eave to eave, the whole building.
          const wallCoords = uniqSorted(mergeJogs(group.wallFacing[side]))
            .filter(value => value > lo + 0.01 && value < hi - 0.01);
          if (wallCoords.length) {
            strings.push({ coords: uniqSorted([lo, ...wallCoords, hi]), layer: DIM_LAYERS.EXTERIOR });
          }
          const roofCoords = uniqSorted(mergeJogs(group.roofFacing[side]))
            .filter(value => value > lo + 0.01 && value < hi - 0.01);
          if (roofCoords.length) {
            strings.push({ coords: uniqSorted([lo, ...roofCoords, hi]), layer: DIM_LAYERS.EXTERIOR });
          }
          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.OVERALL });
        } else {
          // THE BEAM LINES, CLOSEST IN, on the right side for beams running
          // across it and the bottom for beams running up it -- one mark per
          // line however many pieces it was laid in.
          if (group.house && (side === 'E' || side === 'S')) {
            const beamCoords = uniqSorted(exteriorBeamLines
              .filter(line => line.along === (side === 'E' ? 'x' : 'z'))
              .map(line => line.fixed)
              .filter(value => value > lo + 0.01 && value < hi - 0.01));
            if (beamCoords.length) {
              strings.push({ coords: uniqSorted([lo, ...beamCoords, hi]), layer: DIM_LAYERS.COLUMNS });
            }
          }
          const centres = uniqSorted(openingsFor[groupIndex][side])
            .filter(value => value > lo + 0.01 && value < hi - 0.01);
          if (centres.length) {
            strings.push({ coords: uniqSorted([lo, ...centres, hi]), layer: DIM_LAYERS.FENESTRATION });
          }
          // ── THE INTERIOR STRING, SECOND OUT ────────────────────────────
          //
          // Movie, 29 Sep: "on the outside perimter of the floor plans on the
          // inner dimension should be A-DIMS-FENS and will be 1'6" from the
          // house default, next dimension at 3' from house A-DIMS-INT -- this
          // will be a line of dimensions that measures both sides of the
          // exterior and interior walls within 4 ft of an exterior wall on
          // each side".
          //
          // ONE RULE, NO CLASSIFICATION. This wants "the exterior walls'
          // faces, plus nearby partitions", and nothing in the drawing says
          // which walls are exterior -- A-WALL-EXT and A-WALL-INT are in the
          // standards table and no code has ever put a wall on either. It
          // needs no such flag: a wall perpendicular to this string that
          // reaches within 4 ft of this side picks up the two exterior walls
          // for free (they run the full depth, so they reach every side) and
          // the partitions by his own rule.
          //
          // PERPENDICULAR, because only those have a position ALONG the
          // string. The wall this string is measuring across runs parallel to
          // it and lends no coordinate -- it is the thing being measured FROM.
          const faceCoords = interiorFaces(group, along, across, sideFace);
          if (faceCoords.length >= 2) {
            strings.push({ coords: faceCoords, layer: DIM_LAYERS.INTERIOR });
          }
          const jogCoords = group.facing
            ? uniqSorted(mergeJogs([lo, hi, ...group.facing[side]]))
            : cornerCoords;
          if (jogCoords.length > 2) strings.push({ coords: jogCoords, layer: DIM_LAYERS.EXTERIOR });
          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.OVERALL });
        }
        const own = side === 'N' ? minZ : side === 'S' ? maxZ : side === 'W' ? minX : maxX;
        const kept = strings.filter(string => !offRows.has(`${side}:${string.layer}`));
        if (!kept.length) return;
        entries.push({ group, side, lo, hi, strings: kept, own, edge: own, base: 0 });
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
          const shared = Math.min(spanHi, entry.hi) - Math.max(spanLo, entry.lo);
          if (shared <= 0.01) return;
          // A GARAGE'S ROOF ROWS STAY UNDER ITS OWN EAVE when the house only
          // clips the end of the run (Movie's markup, 11 Oct: the rows drawn
          // straight under the garage, running a few feet over the house's
          // corner). Pushed past the whole house they would read as the
          // house's and land a building away from the edge they measure. The
          // same half-the-run test sideClear uses, so a side it lets through
          // is a side that strings where it stands.
          if (entry.group.roof && !entry.group.house && shared <= (entry.hi - entry.lo) / 2) return;
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
      entry.strings.forEach((string, stringIndex) => {
        const fixed = entry.edge + outward[entry.side]
          * (firstOffset + (entry.base + stringIndex) * stringSpacingFt);
        // Quantised once, here — every partial and the overall on this side
        // are differences of the same rounded coordinates, so they add up.
        const coords = printableCoords(string.coords);
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i], b = coords[i + 1];
          // The rendered dim line offsets to the right of the start→end
          // direction (south for west→east runs, west for north→south), so
          // N and E strings run reversed to keep the ink on the outward side.
          const flip = entry.side === 'N' || entry.side === 'E';
          const [p, q] = flip ? [b, a] : [a, b];
          const start = horizontal ? { x: p, z: fixed } : { x: fixed, z: p };
          const end = horizontal ? { x: q, z: fixed } : { x: fixed, z: q };
          segments.push({
            start, end,
            layer: string.layer,
            srcStartId: nearestSrcId(start),
            srcEndId: nearestSrcId(end),
          });
        }
      });
    });
    return segments;
  }

  // ── THE COLUMN STACK, WHICH IS NOT THE PERIMETER STACK ──────────────────
  //
  // Movie, 29 Sep: "on the FLOOR LAYOUT and FOUNDATION LAYOUT the A-DIMS-COLS
  // layer should measure the columns (and beam since the col sits on it) from
  // both directions" ... "on the interior of the floor" ... "about 1ft from
  // the cols" ... "on a side that doesn't have stair hole" ... "the COLS will
  // need to be dimensioned from ext edge of house" ... and the shape, exactly:
  // "when you measure along a beam you need each column and then the ext edge
  // where the beams sit and the other direction center of column to ext edges
  // on either side".
  //
  // TWO STRINGS PER BEAM, answering two different questions:
  //
  //   ALONG   [ext edge, col, col, ..., ext edge]   where the posts stand on
  //                                                 the beam, and where the
  //                                                 beam bears at each end
  //   ACROSS  [ext edge, beam line, ext edge]       where that beam line sits
  //                                                 across the house
  //
  // A SEPARATE FUNCTION, not a branch inside computeAutoDimStrings, and the
  // reason is what that one does: it groups footprints, decides which SIDE
  // each stack hangs off, steps every stack out past whatever footprint is in
  // its way, and continues stacks that end up sharing a corridor. None of it
  // applies to a string running INSIDE the house beside a beam. Threading a
  // third geometry through those passes would put working, delicate code at
  // risk to share nothing -- the only overlap is two pure helpers, and those
  // are hoisted rather than copied.
  //
  // MEASURED FROM THE HOUSE EDGE, not from the beam's own ends. A beam bears
  // on the exterior wall, so the first and last figures on the along string
  // are the bearing distances a framer needs; reading them off the beam's
  // endpoints instead would print two zeros.
  // ── BEAM LINES: COLLINEAR BEAMS ARE ONE ──────────────────────────────────
  //
  // Movie, 11 Oct, on the MAIN FLOOR layout: "only need 1 mark for beams (if
  // the beams are lined up)". AUTO BEAM lays a long line as several pieces,
  // and each piece strung its own edge-to-edge row -- five rows on one line.
  // Pieces on one line (same direction, same offset) join, whatever gaps sit
  // between them.
  const beamLinesOf = beams => {
    const lines = [];
    (Array.isArray(beams) ? beams : []).forEach(beam => {
      if (!beam || !beam.start || !beam.end) return;
      const horizontal = Math.abs(beam.end.x - beam.start.x)
        >= Math.abs(beam.end.z - beam.start.z);
      const along = horizontal ? 'x' : 'z';
      const across = horizontal ? 'z' : 'x';
      const fixed = (beam.start[across] + beam.end[across]) / 2;
      const lo = Math.min(beam.start[along], beam.end[along]);
      const hi = Math.max(beam.start[along], beam.end[along]);
      const line = lines.find(other => other.along === along && Math.abs(other.fixed - fixed) <= ON_BEAM_FT);
      if (line) { line.lo = Math.min(line.lo, lo); line.hi = Math.max(line.hi, hi); }
      else lines.push({ along, across, fixed, lo, hi });
    });
    return lines;
  };

  // How far off a stair opening its own strings sit (Movie: "keep these
  // close to the opening (about 1ft / 1-6)").
  const OPENING_DIM_OFF_FT = 1.25;
  // A beam this near an opening's side puts the opening's string on the
  // other side (Movie: "NOT on the same side as a beam if a beam is nearby").
  const BEAM_NEAR_FT = 4;

  // A stair opening this close to the exterior wall has no room for its own
  // string between the two, so the string goes OUTSIDE the plan instead
  // (Movie, 16 Oct, marked up on the 2ND FL FLOOR LAYOUT: the opening's dims
  // outside the plan when the opening is within 3 ft of the exterior wall's
  // outside perimeter line, inside when farther).
  const OPENING_OUTSIDE_FT = 3;

  function computeColumnDimStrings({
    beams, columns, outlines, walls, floorOpenings,
    clearFt = COLUMN_CLEAR_FT,
    // THE PERIMETER STACK ALREADY OUTSIDE THE PLAN (computeAutoDimStrings'
    // segments), so an opening string sent outside lands one row past it
    // rather than across it; with no stack, `firstOffsetFt` off the wall.
    perimeter = null, firstOffsetFt = 1.5, stringSpacingFt = STRING_SPACING_FT,
  }) {
    const columnList = Array.isArray(columns) ? columns : [];

    // THE HOUSE EDGE, found the same way and in the same order
    // computeAutoDimStrings finds it -- outlines when the drawing has them,
    // wall corners when it does not -- so the two can never disagree about
    // where the house ends. A garage outline is not the house.
    const houseOutlines = (Array.isArray(outlines) ? outlines : [])
      .filter(outline => !outline.garage && outline.site !== true
        && Array.isArray(outline.points) && outline.points.length >= 3);
    const outlinePoints = houseOutlines.flatMap(outline => outline.points);
    const corners = outlinePoints.length ? outlinePoints
      : (Array.isArray(walls) ? walls : []).flatMap(wall => [wall.start, wall.end]);
    if (corners.length < 2) return [];
    const edge = {
      x: [Math.min(...corners.map(p => p.x)), Math.max(...corners.map(p => p.x))],
      z: [Math.min(...corners.map(p => p.z)), Math.max(...corners.map(p => p.z))],
    };
    if (edge.x[1] - edge.x[0] < 0.01 || edge.z[1] - edge.z[0] < 0.01) return [];

    // Every floor opening as a box. A stair hole is a polygon, but which SIDE
    // of a beam it falls on is a question its extents answer.
    const holes = (Array.isArray(floorOpenings) ? floorOpenings : [])
      .map(hole => (hole && Array.isArray(hole.points) ? hole.points : []))
      .filter(points => points.length >= 3)
      .map(points => ({
        x: [Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x))],
        z: [Math.min(...points.map(p => p.z)), Math.max(...points.map(p => p.z))],
      }));

    const segments = [];
    // One run of coordinates at one fixed position, cut into segments the way
    // the perimeter stack cuts its own.
    //
    // `away` IS THE SIDE THE LINE STANDS OFF TO: the screen draws a string 19
    // px to its left-hand normal, and an interior string run low to high on
    // the far side of a beam drew its line back across the beam onto the
    // stair side it was placed to avoid. A run is flipped so that stand-off
    // points away from the beam or opening it was placed clear of.
    const emit = (runAxis, rawCoords, fixedValue, layer = DIM_LAYERS.COLUMNS, away = 1) => {
      const coords = printableCoords(rawCoords);
      // Left-hand normal of a run: +z for +x, -x for +z.
      const flip = runAxis === 'x' ? away < 0 : away > 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const a = flip ? coords[i + 1] : coords[i], b = flip ? coords[i] : coords[i + 1];
        segments.push({
          start: runAxis === 'x' ? { x: a, z: fixedValue } : { x: fixedValue, z: a },
          end: runAxis === 'x' ? { x: b, z: fixedValue } : { x: fixedValue, z: b },
          layer,
          srcStartId: null,
          srcEndId: null,
        });
      }
    };

    const lines = beamLinesOf(beams);
    if (columnList.length) lines.forEach(line => {
      const { along, across, fixed } = line;
      const runLo = line.lo, runHi = line.hi;

      // THE POSTS THIS LINE CARRIES AND NO OTHERS. A column belongs to a line
      // when it stands on it and within its run, so a parallel beam's posts
      // never join this one's string -- which would print a figure to a post
      // that is not on the member being dimensioned.
      const onBeam = columnList.filter(column => {
        const point = column && column.point;
        if (!point) return false;
        if (Math.abs(point[across] - fixed) > ON_BEAM_FT) return false;
        return point[along] >= runLo - ON_BEAM_FT && point[along] <= runHi + ON_BEAM_FT;
      });
      if (!onBeam.length) return;
      const posts = uniqSorted(onBeam.map(column => column.point[along]));

      // ── ALONG THE BEAM, INSIDE ──────────────────────────────────────────
      // WHICH SIDE: away from a stair hole beside it, and inside the house
      // either way. Movie: "on a side that doesn't have stair hole", and 11
      // Oct: "the COLUMN dims should NOT be on the 'stair opening side' if
      // there is a stair opening nearby go on other side of beam".
      //
      // THE BEAM'S OWN POSITION is not strung here any more: it rides the
      // perimeter stack (computeAutoDimStrings `beams`), "on the EXT of the
      // plan", and the strings that crossed the floor at each post are gone.
      // ── AND CLEAR OF THE TEXT ALREADY THERE (Movie, 11 Oct: "not
      // overlapping other text") ────────────────────────────────────────────
      //
      // Two labels sit against a beam line on a sheet. The beam's own
      // FLUSH/DROPPED BEAM tag rides its -across side (render-2d drawBeam2D:
      // labelAlongLine2D, offset 5, read from the bottom or right, so above a
      // level beam and left of an upright one). A PILE's footing tag hangs
      // under its post (+z, drawColumn2D), which is the +across side of a
      // level beam. At a foot off the line the string's figures land on
      // either one, so a side with a tag stands the string further out --
      // past a 9px tag at the 1/8" sheets these are drawn at.
      //
      // THE BEAM'S OWN TAG NO LONGER COUNTS: it follows the string now, to the
      // other side of the beam (Movie, 16 Oct: the FLUSH/DROPPED BEAM note
      // and the beam's string on opposite sides -- render-2d beamTagSides),
      // so a string standing 2'-6" clear of a tag that has moved away was
      // the figures drifting off the member they measure for nothing.
      const hasPile = onBeam.some(column => /pile/i.test(String(column.footing || '')));
      const tagged = direction => direction > 0 && along === 'x' && hasPile;
      const distOf = direction => (tagged(direction) ? Math.max(clearFt, TAG_CLEAR_FT) : clearFt);
      const clearSide = direction => {
        const at = fixed + direction * distOf(direction);
        if (at <= edge[across][0] + 0.01 || at >= edge[across][1] - 0.01) return false;
        return !holes.some(hole => {
          // Only a hole this beam actually runs past can be in the way.
          if (Math.min(hole[along][1], runHi) - Math.max(hole[along][0], runLo) <= 0) return false;
          // On this side of the beam, and near it.
          return direction > 0
            ? hole[across][1] > fixed + HOLE_MARGIN_FT && hole[across][0] - fixed <= BEAM_NEAR_FT
            : hole[across][0] < fixed - HOLE_MARGIN_FT && fixed - hole[across][1] <= BEAM_NEAR_FT;
        });
      };
      const side = clearSide(1) ? 1 : clearSide(-1) ? -1 : 0;
      if (side !== 0) {
        const inner = posts.filter(value =>
          value > edge[along][0] + 0.01 && value < edge[along][1] - 0.01);
        emit(along, [edge[along][0], ...inner, edge[along][1]], fixed + side * distOf(side),
          DIM_LAYERS.COLUMNS, side);
      }
    });

    // ── THE STAIR OPENING, BOTH WAYS (Movie, 11 Oct) ─────────────────────
    //
    // "for the stair opening need dims from the ext wall to opening, opening
    // width, and to opposite ext, keep these close to the opening (about 1ft
    // / 1-6) from the openings and NOT on the same side as a beam if a beam is
    // nearby go on opposite side of opening" -- both directions.
    //
    // THE EXTERIOR WALLS ARE WHERE THE STRING'S OWN LINE MEETS THE HOUSE, not
    // the house's extremes: on an L the wall beside the opening can stand well
    // inside the far corner.
    const loops = houseOutlines.length ? houseOutlines.map(outline => outline.points) : [];
    const wallsAlong = (runAxis, fixedValue, lo, hi) => {
      const other = runAxis === 'x' ? 'z' : 'x';
      const hits = [];
      loops.forEach(pts => pts.forEach((a, i) => {
        const b = pts[(i + 1) % pts.length];
        const a1 = a[other], b1 = b[other];
        if ((a1 - fixedValue) * (b1 - fixedValue) > 0 || Math.abs(b1 - a1) < 1e-9) return;
        hits.push(a[runAxis] + (b[runAxis] - a[runAxis]) * (fixedValue - a1) / (b1 - a1));
      }));
      const before = hits.filter(v => v <= lo + 1e-6);
      const after = hits.filter(v => v >= hi - 1e-6);
      return [before.length ? Math.max(...before) : edge[runAxis][0],
        after.length ? Math.min(...after) : edge[runAxis][1]];
    };
    holes.forEach(hole => {
      ['x', 'z'].forEach(runAxis => {
        const other = runAxis === 'x' ? 'z' : 'x';
        // The two candidate lines, one each side of the opening.
        const sides = [hole[other][0] - OPENING_DIM_OFF_FT, hole[other][1] + OPENING_DIM_OFF_FT];
        const beamNear = sideIndex => lines.some(line => {
          if (line.along !== runAxis) return false;
          if (Math.min(line.hi, hole[runAxis][1]) - Math.max(line.lo, hole[runAxis][0]) <= 0) return false;
          return sideIndex === 0
            ? line.fixed <= hole[other][0] + HOLE_MARGIN_FT && hole[other][0] - line.fixed <= BEAM_NEAR_FT
            : line.fixed >= hole[other][1] - HOLE_MARGIN_FT && line.fixed - hole[other][1] <= BEAM_NEAR_FT;
        });
        const inside = at => at > edge[other][0] + 0.01 && at < edge[other][1] - 0.01;
        const order = beamNear(0) && !beamNear(1) ? [1, 0] : [0, 1];
        // ── OUTSIDE THE PLAN when the opening hugs the exterior wall ──────
        // Within OPENING_OUTSIDE_FT of the wall on a side, the string goes
        // out past the perimeter stack on that side; the side away from a
        // beam first when both hug. Farther from the wall, inside as before.
        const hugs = [hole[other][0] - edge[other][0] <= OPENING_OUTSIDE_FT + 1e-6,
          edge[other][1] - hole[other][1] <= OPENING_OUTSIDE_FT + 1e-6];
        const outsideAt = index => {
          const beyond = (Array.isArray(perimeter) ? perimeter : [])
            .filter(seg => seg && seg.start && seg.end
              && Math.abs(seg.start[other] - seg.end[other]) < 0.01)
            .map(seg => (index === 0 ? edge[other][0] - seg.start[other] : seg.start[other] - edge[other][1]))
            .filter(off => off > 0.01);
          const off = beyond.length ? Math.max(...beyond) + stringSpacingFt : firstOffsetFt;
          return index === 0 ? edge[other][0] - off : edge[other][1] + off;
        };
        const hug = order.find(index => hugs[index]);
        const pick = hug !== undefined ? hug : order.find(index => inside(sides[index]));
        if (pick === undefined) return;
        const at = hug !== undefined ? outsideAt(pick) : sides[pick];
        const [wallLo, wallHi] = wallsAlong(runAxis, at, hole[runAxis][0], hole[runAxis][1]);
        emit(runAxis, uniqSorted([wallLo, hole[runAxis][0], hole[runAxis][1], wallHi]), at,
          DIM_LAYERS.INTERIOR, pick === 0 ? -1 : 1);
      });
    });
    return segments;
  }

  window.DraftAutoDims = Object.freeze({
    computeAutoDimStrings, computeColumnDimStrings, beamLinesOf,
    STRING_SPACING_FT, JOG_MERGE_FT, COLUMN_CLEAR_FT, TAG_CLEAR_FT, OPENING_OUTSIDE_FT, DIM_LAYERS,
  });
})();
}
