// BUILD HOUSE derivations, extracted pure from the Model Space: measure the
// outline and return plain data — wall runs, footing rings, the interior
// reference side. The component keeps the commit layer (vertex pool, srcId
// links, collection writes); nothing here mints identity.
// REQUIRES window.DraftGeometry2D -- resolved at CALL time, not at load. A page may list this
// script before its dependency and still work; only footingRings needs the
// dependency present by the time it is called.
//
// It was captured at load until 2 Sep, which meant a page whose script order
// put this first got a module that loaded clean, reported every export, and
// threw later from a call site naming a different file.
if (!window.DraftBuildHouse) {
(() => {
  const geo = () => window.DraftGeometry2D;

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
  //
  // EACH RUN SAYS WHICH EDGE IT IS. The index is not the run's position in
  // this list, and callers were relying on it being one: a degenerate edge is
  // skipped here, so from that point on every run sits one place earlier than
  // the edge it came from. MODEL.html hangs a premade plan's windows and doors
  // on walls BY EDGE NUMBER, and an attached garage now drops the runs it
  // shares with the house — two more ways for a position to stop meaning an
  // edge. Saying it outright costs a field and ends the class.
  const houseWallRuns = points => {
    const runs = [];
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      if (Math.hypot(next.x - point.x, next.z - point.z) < 0.01) return;
      runs.push({ start: point, end: next, edge: index });
    });
    return runs;
  };

  // Strip footing rings, the footing centered on the wall: equal projection
  // past the exterior and interior faces. Ring corners map 1:1 onto the
  // outline corners they were offset from.
  const footingRings = (points, wallFt, projFt) => {
    const base = points.map(pt => ({ x: pt.x, z: pt.z }));
    return [
      geo().offsetOutline(base, projFt),
      geo().offsetOutline(base, -(wallFt + projFt)),
    ];
  };


  // ── AUTO PILES: one per corner, then evened out at 9 ft or less ──────────
  //
  // Movie, 25 Sep: "i pile per corner and then 1 every 9ft or less" ... "(even
  // them out if its less than 9ft".
  //
  // EVENED, NOT PACKED, and that parenthesis is the whole rule. A 12 ft leg is
  // TWO SPANS OF 6, never 9 and then 3: the spacing is a maximum and the piles
  // under one run carry equal shares of it. Same arithmetic midSpanBeams uses
  // for its teleposts, at a different number and walked around a loop instead
  // of along one line.
  //
  // THE CALLER HANDS IN THE CENTRELINE, not the outline. An outline is a wall
  // FACE -- footingRings above offsets from 0 and -(wallFt + projFt), so the
  // wall hangs inboard of it -- and Movie's rule is "the pile should be
  // located in the center of the wall". Insetting in here would mean this
  // function had to know a wall thickness and which side the wall is on, both
  // of which are the page's business and neither of which is pile spacing.
  //
  // skipEdge ANSWERS FOR AN EDGE INDEX, so an attached garage's leg against
  // the house takes no piles: there is no grade beam along it to carry. Its
  // two ENDS still get one, because they are the ends of the runs that remain
  // -- which is MODEL.dc.html's "10"ø piles at the two beam corners against
  // the house" (:23740) arrived at by the general rule instead of written in
  // as a special case. The old page placed those two and left the rest to the
  // drafter; this places the run.
  const pilePoints = (points, { maxSpacingFt = 9, skipEdge = null } = {}) => {
    const out = [];
    // ONE PILE PER PLACE. Adjacent runs share a corner and each would claim
    // it; two records at one point is two lines in the schedule and one hole
    // in the ground. By POSITION rather than by index, because the corner is
    // shared by where it is and not by what it is numbered.
    //
    // AND "THE SAME PLACE" IS THE SAME SLACK THE EDGE TEST USES, which an
    // exact key got wrong. A mid-wall insert leaves a degenerate edge; this
    // skips the EDGE, but its two endpoints survive as separate corners, and
    // on the harness's 0.001 ft stub they came back as two piles 1/64" apart
    // -- both in the schedule, one hole on site. Anything under the length
    // that makes an edge worth walking is one place.
    const MERGE_FT = 0.01;
    const add = (x, z, srcIndex) => {
      if (out.some(pt => Math.hypot(pt.x - x, pt.z - z) < MERGE_FT)) return;
      out.push(srcIndex == null ? { x, z } : { x, z, srcIndex });
    };
    const spacing = Number(maxSpacingFt) > 0 ? Number(maxSpacingFt) : 9;
    points.forEach((pt, index) => {
      const next = points[(index + 1) % points.length];
      const len = Math.hypot(next.x - pt.x, next.z - pt.z);
      // A degenerate edge is skipped for houseWallRuns' reason: it raises no
      // wall, so there is no beam over it to hold up.
      if (len < 0.01) return;
      if (typeof skipEdge === 'function' && skipEdge(index)) return;
      const spans = Math.max(1, Math.ceil(len / spacing));
      for (let s = 0; s <= spans; s++) {
        const t = s / spans;
        // srcIndex RIDES ONLY ON A CORNER, and it is the corner's own index in
        // the ring the caller passed. An intermediate pile sits on no vertex,
        // so claiming one would link it to a point that does not move with it.
        add(pt.x + (next.x - pt.x) * t, pt.z + (next.z - pt.z) * t,
          s === 0 ? index : (s === spans ? (index + 1) % points.length : undefined));
      }
    });
    return out;
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

  const midSpanBeams = (points, { beamAtFt = 19, maxSpanFt = 12, holes = [], bearsAt = null,
    supportsBelow = null, supportTolFt = 0.5 } = {}) => {
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
    const crossCoord = pt => (axis === 'x' ? pt.z : pt.x);
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
    // ── The jog-corner rule (board #244) ──
    // A re-entrant (interior angle > 180°) corner is where the point load
    // lands, so a cut whose line can reach one snaps onto the corner node —
    // the beam then rides outline edits through that shared point. Concavity
    // reads from the ring orientation, the same signed-area convention as
    // outlineInteriorRef; collinear points (mid-wall inserts) never qualify.
    const ringArea = points.reduce((sum, pt, index) => {
      const next = points[(index + 1) % points.length];
      return sum + (pt.x * next.z - next.x * pt.z);
    }, 0);
    const reentrants = points.map((pt, index) => {
      const prev = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const cross = (pt.x - prev.x) * (next.z - pt.z) - (pt.z - prev.z) * (next.x - pt.x);
      return { index, pt, cross };
    }).filter(entry => Math.abs(entry.cross) > 1e-6
      && Math.sign(entry.cross) !== Math.sign(ringArea));
    // ── Favour the corner over the middle ──
    // Lining up is the PREFERRED answer and dead centre is the fallback, not
    // the other way round: joists come out equal lengths and the framing
    // stacks. So every outline corner is a candidate, not only the re-entrant
    // ones — a convex corner carries the line of an exterior wall, and lining
    // up on that is the same win. An edge running parallel to the beam has a
    // constant cross-coordinate shared with its own endpoints, so the vertex
    // list already carries the wall lines with the corners.
    //
    // A candidate sits INSIDE the chosen clear strip (one in a stair hole or
    // the smaller strip would pull the beam out of its strip; the strip's own
    // ends are the exterior walls, where a beam would be redundant) and within
    // beamAtFt of the unsnapped cut. Nearest wins — least-moved — and a
    // re-entrant node breaks a tie, since that is where a point load actually
    // lands (board #244).
    const reentrantIndexes = new Set(reentrants.map(entry => entry.index));
    const snapFor = c0 => {
      let best = null;
      points.forEach((pt, index) => {
        const cc = crossCoord(pt);
        if (cc <= strip[0] + 1e-9 || cc >= strip[1] - 1e-9) return;
        const dist = Math.abs(cc - c0);
        if (dist > beamAtFt) return;
        const reentrant = reentrantIndexes.has(index);
        if (!best || dist < best.dist - 1e-9
          || (Math.abs(dist - best.dist) <= 1e-9 && reentrant && !best.reentrant)) {
          best = { c: cc, dist, reentrant };
        }
      });
      return best;
    };
    // Never trade a lined-up beam for an over-span floor: after snapping,
    // every joist span the beams leave behind — wall to beam, beam to beam —
    // must stay within beamAtFt wherever the beams run. Violations are
    // judged piecewise between vertex coordinates and RELATIVE to the
    // unsnapped baseline (a stair hole can leave the smaller strip over-span
    // today; the snap only has to introduce nothing new).
    const violations = cutList => {
      const runsByCut = cutList.map(c => clipLineToPolygon(points, axis, c).flatMap(trimRun));
      const bad = new Set();
      for (let i = 0; i + 1 < breaks.length; i++) {
        const m = (breaks[i] + breaks[i + 1]) / 2;
        const sections = clipLineToPolygon(points, axis === 'x' ? 'z' : 'x', m);
        const host = sections.find(([a, b]) => a - 1e-9 <= stripMid && stripMid <= b + 1e-9);
        if (!host || host[1] - host[0] <= beamAtFt + 1e-9) continue;
        const stops = [host[0], host[1]];
        cutList.forEach((c, k) => {
          if (c <= host[0] + 1e-9 || c >= host[1] - 1e-9) return;
          if (runsByCut[k].some(([r0, r1]) => r0 - 1e-9 <= m && m <= r1 + 1e-9)) stops.push(c);
        });
        stops.sort((a, b) => a - b);
        for (let s = 0; s + 1 < stops.length; s++) {
          if (stops[s + 1] - stops[s] > beamAtFt + 1e-9) { bad.add(i); break; }
        }
      }
      return bad;
    };
    const snaps = cuts.map(c0 => ({ c0, snap: snapFor(c0) }));
    let finalCuts = snaps.map(s => (s.snap ? s.snap.c : s.c0));
    if (snaps.some(s => s.snap && s.snap.dist > 1e-9)) {
      const baseViol = violations(cuts);
      const okAgainstBase = list =>
        [...violations(list)].every(piece => baseViol.has(piece));
      if (!okAgainstBase(finalCuts)) {
        // Un-snap the cut that moved furthest first, one at a time, until
        // the span set is clean again — the least-moved beam survives.
        const byMove = snaps.map((s, i) => ({ i, moved: s.snap ? s.snap.dist : 0 }))
          .filter(entry => entry.moved > 1e-9)
          .sort((a, b) => b.moved - a.moved);
        for (const entry of byMove) {
          finalCuts[entry.i] = snaps[entry.i].c0;
          if (okAgainstBase(finalCuts)) break;
        }
      }
    }
    // A beam point landing on an outline corner (within 1e-6) carries the
    // corner's index so the commit layer can link it to the master point.
    // That link is about identity, not support: whether a post belongs at an
    // end is asked separately, below.
    const cornerIndexAt = (t, c) => {
      const x = axis === 'x' ? t : c, z = axis === 'x' ? c : t;
      const index = points.findIndex(pt => Math.abs(pt.x - x) < 1e-6 && Math.abs(pt.z - z) < 1e-6);
      return index >= 0 ? index : null;
    };
    // ── What carries a post (board: the beam posts what bears on nothing) ──
    // A post goes where a beam end has nothing under it. The question used to
    // be asked the other way round — a post if and only if the end landed on
    // a re-entrant outline vertex — and that is inverted, because an outline
    // vertex is a point the foundation wall runs through. It put teleposts and
    // 36" pads on top of concrete, and it missed every end `trimRun` leaves
    // out in the floor, since a trim lands on a break coordinate that is no
    // vertex at all.
    //
    // The outline is the bearing midSpanBeams can answer for itself: the
    // foundation wall traces it, so an end anywhere ON it already bears. A
    // caller that knows about interior bearing walls or beams underneath
    // passes a wider test in — nothing is reached for.
    //
    // BEAMS ARE DRAWN TO THE EDGE OF THE FLOOR, and that is a drawing
    // convention, not an oversight: the sheet is a measurement document, and
    // the fabricator takes the bearing off the length (3" onto concrete or
    // masonry, 1½" onto wood). Do not shorten a beam here to model that — it
    // would make every dimension on the sheet read short. For the same reason
    // this asks whether bearing is PRESENT, not how much of it there is.
    //
    // The question is only ever asked outward. A floor or beam may cantilever
    // up to 2' PAST its support, but an end stopping SHORT of one never
    // reaches it and cannot bear on it however close it comes. Runs are
    // clipped to the outline, so no end extends past a wall and the outward
    // allowance never decides a case; if that ever changes, it belongs here
    // as a tolerance on this test rather than anywhere else.
    // BOARD #346 LOOKED AT THIS COPY AND LEFT IT, which is the finding rather
    // than an omission. The shared export (geometry-2d.js pointToSegment)
    // floors at len2 < 0.0001 — a segment under 0.01ft is unreachable,
    // Infinity — and this guard floors at true zero, 1e-12.
    //
    // At EXACTLY zero the two agree: `return false` here, and Infinity there,
    // which the `< 1e-6` below rejects just the same. They part company in the
    // band between: an outline edge from ~1e-6 up to 0.01ft is measured
    // normally here and refused outright by the export.
    //
    // That band is reachable from ordinary geometry, not from a corrupt file.
    // offsetOutline emits edges inside it — a 20 x 2.001ft room inset 1ft comes
    // back with two edges of exactly 0.001ft — so collapsing this would change
    // which runs are found to bear, on plans a drafter can draw. Value-
    // preserving means this copy stays private.
    const onOutline = p => points.some((a, i) => {
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-12) return false;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
      return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)) < 1e-6;
    });
    const bears = typeof bearsAt === 'function' ? bearsAt : onOutline;
    // ── WHAT A POST MAY STAND ON (Movie, 25 Sep) ─────────────────────────
    //
    // "the columns and beams are most often located over top of each other (
    // this is always the case for a columns - it need to be over another
    // column" ... "or over a solid wall" ... "(which acts as a column".
    //
    // EVEN DIVISION IS THE FALLBACK, NOT THE RULE -- and it was the only rule
    // until now. On the ground floor it is the right one: the posts stand on
    // their own pads and nothing underneath constrains where they go. A floor
    // ABOVE is a different question, because its posts have to land on what is
    // already holding the floor below, and two runs divided evenly stack only
    // by COINCIDENCE.
    //
    // ON THE PREMADE twoStorey THEY DO COINCIDE, whose 2nd floor sits on the
    // same rectangle as the main floor -- which is exactly why this cannot be
    // left to luck. It would look right on every fixture in the repo and come
    // apart on the first outline edit that made the two floors differ, with
    // nothing to say so.
    //
    // `supportsBelow` IS A LIST OF WHAT IS THERE, points and segments mixed: a
    // column below is a point, a solid wall below is a segment. The caller
    // decides what counts as solid -- an opening's width is the page's
    // business, not this file's -- and hands over only the stretches that do.
    const along = pt => (axis === 'x' ? pt.x : pt.z);
    const cross = pt => (axis === 'x' ? pt.z : pt.x);
    // WHERE THE RUN IS HELD UP, as intervals of t. A wall running ALONG the
    // beam holds the whole stretch it covers; one CROSSING it holds a single
    // point; a column below holds a point. A wall parallel to the beam but a
    // foot to one side holds nothing, which is the case the tolerance is for.
    const heldSpansOn = c => {
      const held = [];
      (Array.isArray(supportsBelow) ? supportsBelow : []).forEach(item => {
        if (item && item.start && item.end) {
          const a0 = along(item.start), a1 = along(item.end);
          const c0 = cross(item.start), c1 = cross(item.end);
          if (Math.abs(c0 - c) <= supportTolFt && Math.abs(c1 - c) <= supportTolFt) {
            held.push([Math.min(a0, a1), Math.max(a0, a1)]);
          } else if ((c0 - c) * (c1 - c) <= 0 && Math.abs(c1 - c0) > 1e-9) {
            const k = (c - c0) / (c1 - c0);
            held.push([a0 + (a1 - a0) * k, a0 + (a1 - a0) * k]);
          }
        } else if (item && Math.abs(cross(item) - c) <= supportTolFt) {
          held.push([along(item), along(item)]);
        }
      });
      return held;
    };
    // GREEDY-FURTHEST: from the last division, the furthest support still
    // within maxSpanFt. That is the FEWEST posts that keeps every span legal
    // -- a nearer support would add a post the frame does not need, a further
    // one would leave a span over the limit.
    const divisionsFor = (r0, r1, c) => {
      const len = r1 - r0;
      const evenly = (from, to) => {
        const spans = Math.max(1, Math.ceil((to - from) / maxSpanFt));
        const cuts = [];
        for (let s = 1; s < spans; s++) cuts.push({ t: from + ((to - from) * s) / spans, unsupported: true });
        return cuts;
      };
      // No list means the old question: nothing below is being tracked, so
      // divide evenly and claim nothing about what holds the posts up.
      if (!Array.isArray(supportsBelow) || !supportsBelow.length) {
        return evenly(r0, r1).map(cut => ({ t: cut.t, unsupported: false }));
      }
      const held = heldSpansOn(c);
      const cuts = [];
      let at = r0;
      let guard = 0;
      while (r1 - at > maxSpanFt + 1e-9 && guard++ < 500) {
        const limit = at + maxSpanFt;
        // The furthest point of any held interval that is reachable, clipped
        // to the interval so a long wall is used at its far end rather than
        // wherever it happens to start.
        let best = null;
        held.forEach(([h0, h1]) => {
          const reach = Math.min(h1, limit);
          if (reach <= at + 0.5 || h0 > limit + 1e-9) return;
          if (best === null || reach > best) best = reach;
        });
        if (best === null) {
          // NOTHING WITHIN REACH. The beam still has to be held up, so a post
          // goes in at the limit and says out loud that it stands on nothing
          // -- a silent one here is the drawing claiming support it has not
          // got, which is the whole defect this rule exists to prevent.
          cuts.push({ t: limit, unsupported: true });
          at = limit;
        } else {
          cuts.push({ t: best, unsupported: false });
          at = best;
        }
      }
      return cuts;
    };

    const beams = [];
    const columns = [];
    finalCuts.forEach(c => {
      clipLineToPolygon(points, axis, c).flatMap(trimRun).forEach(([r0, r1]) => {
        const at = t => (axis === 'x' ? { x: t, z: c } : { x: c, z: t });
        const withSrc = t => {
          const index = cornerIndexAt(t, c);
          return index == null ? at(t) : { ...at(t), srcIndex: index };
        };
        // ONE LIST OF DIVISIONS FOR BOTH. "a beam is one span between two
        // supports", so a beam is cut where a post stands and nowhere else --
        // and these used to be two separate loops over the same arithmetic,
        // which was safe only while both were even.
        const cuts = divisionsFor(r0, r1, c);
        const stops = [r0, ...cuts.map(cut => cut.t), r1];
        for (let s = 0; s + 1 < stops.length; s++) {
          beams.push({ start: withSrc(stops[s]), end: withSrc(stops[s + 1]) });
        }
        // srcIndex still rides along wherever an end coincides with a master
        // point — that is what carries a beam through outline edits, and it is
        // unrelated to whether a post belongs there.
        const freeEnds = [r0, r1]
          .map(t => ({ t, index: cornerIndexAt(t, c) }))
          .filter(end => !bears(at(end.t)));
        freeEnds.forEach(end => columns.push(end.index == null
          ? at(end.t) : { ...at(end.t), srcIndex: end.index }));
        cuts.forEach(cut => {
          if (freeEnds.some(end => Math.abs(end.t - cut.t) < 0.5)) return;
          columns.push(cut.unsupported ? { ...at(cut.t), unsupported: true } : at(cut.t));
        });
      });
    });
    return { beams, columns };
  };

  window.DraftBuildHouse = Object.freeze({
    outlineInteriorRef,
    houseWallRuns,
    footingRings,
    pilePoints,
    midSpanBeams,
  });
})();
}
