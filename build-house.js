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
  const pilePoints = (points, { maxSpacingFt = 9, skipEdge = null,
    standoffFt = 0, minGapFt = 3 } = {}) => {
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
    const standoff = Number(standoffFt) > 0 ? Number(standoffFt) : 0;
    const skipped = index => typeof skipEdge === 'function' && !!skipEdge(index);
    points.forEach((pt, index) => {
      const next = points[(index + 1) % points.length];
      const len = Math.hypot(next.x - pt.x, next.z - pt.z);
      // A degenerate edge is skipped for houseWallRuns' reason: it raises no
      // wall, so there is no beam over it to hold up.
      if (len < 0.01) return;
      if (skipped(index)) return;
      // ── THE FIRST PILE STANDS BACK FROM THE HOUSE ────────────────────────
      //
      // Movie, 25 Sep: "the first one should not be at the foundation it
      // should be 4-6 min or 5' max (lets go 4'6 default) the first pile
      // shouldn't effect the foundation/ footing so therefore needs to be
      // placed min 4'6 from the foundation wall".
      //
      // A pile is DRILLED, and drilling it hard against the house footing
      // undermines the thing it is standing next to. So a leg that MEETS a
      // skipped edge starts its run `standoff` back from that end, and the
      // remaining length re-evens at the spacing -- the same rule as before,
      // measured over what is left rather than over the whole leg.
      //
      // WHICH END IS THE HOUSE END IS THE NEIGHBOUR'S ANSWER, not this leg's:
      // the shared edge itself is skipped, so the house shows up as the edge
      // BEFORE or AFTER this one. A leg between two house edges stands off at
      // both ends.
      const before = (index - 1 + points.length) % points.length;
      const after = (index + 1) % points.length;
      const head = skipped(before) ? standoff : 0;
      const tail = skipped(after) ? standoff : 0;
      // A LEG TOO SHORT TO STAND A PILE OFF THE HOUSE GETS NONE, and the beam
      // spans it. Placing one anyway would put it inside the very distance
      // this rule exists to keep clear, which is worse than not placing it.
      const usable = len - head - tail;
      if (usable < 0.01) return;
      const spans = Math.max(1, Math.ceil(usable / spacing));
      for (let s = 0; s <= spans; s++) {
        const t = (head + (usable * s) / spans) / len;
        // srcIndex RIDES ONLY ON A CORNER, and it is the corner's own index in
        // the ring the caller passed. An intermediate pile sits on no vertex,
        // so claiming one would link it to a point that does not move with it.
        //
        // AND A PILE THAT HAS BEEN STOOD OFF IS NO LONGER ON ITS CORNER, so it
        // hands the link back: srcIndex makes the pile ride that vertex when
        // the outline is dragged, and a pile 4'-6" down the leg riding the
        // corner would slide along the beam every time the corner moved.
        const onHead = s === 0 && head === 0;
        const onTail = s === spans && tail === 0;
        add(pt.x + (next.x - pt.x) * t, pt.z + (next.z - pt.z) * t,
          onHead ? index : (onTail ? after : undefined));
      }
    });
    return mergeClose(out, Number(minGapFt) > 0 ? Number(minGapFt) : 0);
  };

  // ── TWO PILES TOO CLOSE TOGETHER ARE ONE PILE ────────────────────────────
  //
  // Movie, 25 Sep: "there are situations where 2 corners are too close
  // together (piles shouldn't be withing 3ft of each other) if the piles would
  // be 3ft or closer, remove both piles and replace with 1 at the centerpoint
  // between the 2 corners".
  //
  // NOT THE SAME RULE AS THE 0.01 MERGE ABOVE, which answers "these are one
  // place" -- two records for one hole. This one answers "these are two
  // places too close to drill", and it MOVES the survivor: neither original
  // position is kept, because the pair is replaced by the point between them.
  //
  // CLOSEST PAIR FIRST, and repeatedly, so the answer does not depend on the
  // order the legs were walked. A single forward pass would merge whichever
  // pair it met first and leave a tighter pair behind it untouched.
  //
  // THE MIDPOINT IS A STRAIGHT LINE BETWEEN THEM, which is on the beam for the
  // case this exists for -- two corners at the ends of one short jog, whose
  // midpoint lies on that jog. Two piles either side of a 90 degrees corner
  // cannot reach this: each leg places one AT the corner and those two are
  // already one point by position.
  //
  // THE MERGED PILE CARRIES NO srcIndex. It stands on neither corner now, so
  // claiming either would link it to a vertex it no longer sits on -- the same
  // reason an intermediate pile claims none.
  const mergeClose = (list, minGapFt) => {
    if (!(minGapFt > 0)) return list;
    const pts = list.slice();
    for (;;) {
      let best = null;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
          // "3ft OR CLOSER", so the bound is inclusive -- a pair exactly 3 ft
          // apart is the case he named, not the first legal one.
          if (d <= minGapFt + 1e-9 && (!best || d < best.d)) best = { i, j, d };
        }
      }
      if (!best) return pts;
      const a = pts[best.i], b = pts[best.j];
      pts.splice(best.j, 1);
      pts.splice(best.i, 1, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    }
  };

  // ── The tour's mid-span beam rule (board #230, answers confirmed) ──
  // Joists span the SHORT way, so a house whose short span exceeds beamAtFt
  // gets beams along the LONG axis -- one at mid-span, and another evenly
  // spaced row each time the span passes another beamAtFt, so no joist runs
  // further than beamAtFt (Movie, 6 Oct) -- clipped to the outline;
  // columns split each run into spans no longer than maxSpanFt ("a beam is
  // one span between two supports"). holes are intervals along the short
  // axis (a stair opening) the beam must respect: each clear strip either side
  // of one takes its own rows. Validated offline before wiring.

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
    // ── AS MANY ROWS AS THE SPAN NEEDS (Movie, 6 Oct) ──
    // "for AUTOplacement with 1-0 5/8" floor the max span of joists is 19ft
    // so we will need to shift the beams/columns and add at least 1 more row,
    // maybe 2". One beam, or two at third points past 2x, ran out at 57 ft
    // and an 81 ft wide L came back with 27 ft joists. Each clear strip now
    // takes the FEWEST evenly spaced rows that keep every gap within
    // beamAtFt: ceil(len / beamAtFt) bays, one row between each pair.
    // EVERY STRIP that is too wide, not only the larger one: a stair opening
    // that leaves 22 ft on its short side is still a 22 ft floor.
    const cutStrips = [];
    strips.forEach(([a, b]) => {
      const bays = Math.ceil((b - a) / beamAtFt - 1e-9);
      for (let k = 1; k < bays; k++) cutStrips.push({ c: a + ((b - a) * k) / bays, strip: [a, b] });
    });
    // A STAIR HOLE IS NOT THE WHOLE WIDTH. It cuts the joists over the
    // opening and nowhere else, so beside it they still span the full short
    // way. When every strip is narrow enough on its own, the house still
    // needs its beam, and it goes mid-span of the larger strip, as before.
    if (!cutStrips.length && strips.length) {
      const [a, b] = strips.reduce((w, s) => (s[1] - s[0] > w[1] - w[0] ? s : w));
      cutStrips.push({ c: (a + b) / 2, strip: [a, b] });
    }
    cutStrips.sort((p, q) => p.c - q.c);
    const cuts = cutStrips.map(entry => entry.c);
    const alongCoord = pt => (axis === 'x' ? pt.x : pt.z);
    const crossCoord = pt => (axis === 'x' ? pt.z : pt.x);
    const breaks = [...new Set(points.map(alongCoord))].sort((a, b) => a - b);
    // THE SPAN THIS BEAM SITS IN, not the one through the middle of the
    // house. With one beam the two were the same floor; with rows across an
    // L, the row out in the wing would have been asked about the main body
    // and dropped where the wing needs it.
    //
    // A ROW ON A SECTION'S OWN WALL carries nothing there: the foundation is
    // already under it. A row snapped onto the line where a wing meets the
    // body runs inside the body and along the wing's wall, and only the first
    // half of that is a beam.
    const localSpanAt = (t, c) => {
      const spans = clipLineToPolygon(points, axis === 'x' ? 'z' : 'x', t);
      const host = spans.find(([a, b]) => a + 1e-6 < c && c < b - 1e-6) || [0, 0];
      return host[1] - host[0];
    };
    const trimRun = c => ([r0, r1]) => {
      const edges = [r0, ...breaks.filter(b => b > r0 + 1e-9 && b < r1 - 1e-9), r1];
      const kept = [];
      for (let i = 0; i + 1 < edges.length; i++) {
        if (localSpanAt((edges[i] + edges[i + 1]) / 2, c) > beamAtFt) {
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
    //
    // Two rows reaching for one corner need no rule of their own: the pair
    // would leave a gap past beamAtFt, which the span check below refuses.
    const snapFor = ({ c: c0, strip: own }) => {
      let best = null;
      points.forEach((pt, index) => {
        const cc = crossCoord(pt);
        if (cc <= own[0] + 1e-9 || cc >= own[1] - 1e-9) return;
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
      const runsByCut = cutList.map(c => clipLineToPolygon(points, axis, c).flatMap(trimRun(c)));
      const bad = new Set();
      // EVERY SECTION OF EVERY PIECE, not the one through the middle: an L's
      // wing is a floor of its own and its joists have the same limit.
      for (let i = 0; i + 1 < breaks.length; i++) {
        const m = (breaks[i] + breaks[i + 1]) / 2;
        const sections = clipLineToPolygon(points, axis === 'x' ? 'z' : 'x', m);
        sections.forEach((host, h) => {
          if (host[1] - host[0] <= beamAtFt + 1e-9) return;
          const stops = [host[0], host[1]];
          cutList.forEach((c, k) => {
            if (c <= host[0] + 1e-9 || c >= host[1] - 1e-9) return;
            if (runsByCut[k].some(([r0, r1]) => r0 - 1e-9 <= m && m <= r1 + 1e-9)) stops.push(c);
          });
          stops.sort((a, b) => a - b);
          for (let s = 0; s + 1 < stops.length; s++) {
            if (stops[s + 1] - stops[s] > beamAtFt + 1e-9) { bad.add(`${i}:${h}`); break; }
          }
        });
      }
      return bad;
    };
    const snaps = cutStrips.map(entry => ({ c0: entry.c, snap: snapFor(entry) }));
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
      clipLineToPolygon(points, axis, c).flatMap(trimRun(c)).forEach(([r0, r1]) => {
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

  // ── WHAT A COLUMN STANDS ON ───────────────────────────────────────────────
  //
  // Movie, 25 Sep, looking at a built foundation: "we have beam and columns,
  // but no footing, we will need footings below the columns, please check the
  // model.DC version i think it had them already 36"x36"x8"dp". It did --
  // MODEL.dc.html:2460 COLUMN_FOOTINGS -- and this is that table, unchanged
  // in its numbers.
  //
  // THERE WAS NO TABLE ON THIS SIDE AT ALL, which is why the pads never drew.
  // MODEL.html carries id+label pairs for the picker and nothing else, so it
  // hands render-2d.js `footing: null` for every pad and the painter draws the
  // 3" telepost alone. The same gap makes every PILE draw at 6": the page
  // passes a hard-coded `sizeIn: 6` because it has no size to look up, so a
  // 12" pile and an 8" pile are the same circle.
  //
  // `note` IS THE SCHEDULE ROW, `label` IS THE PLAN. A drawing says TYP 36x36
  // PAD beside the square and the schedule carries the reinforcement; putting
  // the long form on the plan would bury the drawing in text.
  const COLUMN_FOOTINGS = Object.freeze([
    Object.freeze({ id: 'pad36', label: 'TYP 36×36 PAD', sizeIn: 36,
      note: '36"×36"×8" DP PAD — 3-15M @ 10" O.C. E/W' }),
    Object.freeze({ id: 'pad42', label: 'MED 42×42 PAD', sizeIn: 42,
      note: '42"×42"×10" DP PAD — 4-15M @ 9" O.C. E/W' }),
    // THE SOLID SUPPORT UNDER A BEAM'S END, built into the wall it bears on
    // (Movie, 16 Oct: "a solid support column built into the wall below
    // where the beam rests"). A 6x6, 5 1/2" square, standing on the wall's
    // own footing -- so it is no pad of its own in the schedule.
    Object.freeze({ id: 'post6', label: '6×6 POST IN WALL', sizeIn: 5.5, post: true,
      note: '6×6 POST BUILT INTO WALL UNDER BEAM — SOLID BEARING, NO OPENING BELOW' }),
    // Drilled piles carry a garage grade beam. Depth comes from the soils
    // report, so the PLAN marks diameter and centre only -- the schedule mark
    // (P1/P2/P3) carries the length and the steel.
    Object.freeze({ id: 'pile8', label: '8"ø PILE', sizeIn: 8, pile: true,
      note: '8"ø CONC PILE — DEPTH PER SOILS REPORT' }),
    Object.freeze({ id: 'pile10', label: '10"ø PILE', sizeIn: 10, pile: true,
      note: '10"ø CONC PILE — DEPTH PER SOILS REPORT' }),
    Object.freeze({ id: 'pile12', label: '12"ø PILE', sizeIn: 12, pile: true,
      note: '12"ø CONC PILE — DEPTH PER SOILS REPORT' }),
  ]);

  // FIRST ROW IS THE FALLBACK, which is dc's rule and matters for the same
  // reason its validator's does: an id the table has never heard of is a pad,
  // not a crash and not a missing footing.
  const footingFor = id =>
    COLUMN_FOOTINGS.find(footing => footing.id === id) || COLUMN_FOOTINGS[0];

  // ── WHICH PILE IS WHICH: P1, P2, P3 ───────────────────────────────────
  //
  // Movie, 15 Oct: "rather than noting the piles "12" PILE" just make each
  // pile "P1"", and then the whole rule in one line: "anything under 'HOUSE'
  // type outline for any storey will need P3, and thing under GARAGE will
  // need P2, and the ext piles for roof and deck P1".
  //
  // SO THE MARK IS A QUESTION ABOUT WHAT STANDS OVER THE PILE, asked of the
  // outlines rather than stored on the column. A pile that is dragged, or a
  // storey that is added over one, changes what it carries -- and a stored
  // mark would go on saying what was true when it was poured. The table's own
  // note has said the schedule mark belongs to the pile since the piles went
  // in ("the schedule mark (P1/P2/P3) carries the length and the steel"); this
  // is the half that was missing.
  //
  // HOUSE BEATS GARAGE wherever they overlap, which is the detail he spelt out
  // first: a room over part of a garage puts P3 under all of that part, and
  // the garage's own front -- roof over it and nothing else -- goes back to
  // P2. Testing the house loops first IS that rule; there is no second branch
  // for the transition, because the transition is where the house loop stops.
  //
  // `bodies` are the building outlines in plan, each {points, garage}. A lot
  // line is not a building and must not be passed in.
  const pileMark = (point, bodies = []) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return 'P1';
    const inRing = ring => {
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a.z > point.z) !== (b.z > point.z)
          && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    };
    const loops = bodies.filter(body => Array.isArray(body?.points) && body.points.length >= 3);
    if (loops.some(body => body.garage !== true && inRing(body.points))) return 'P3';
    if (loops.some(body => body.garage === true && inRing(body.points))) return 'P2';
    return 'P1';
  };

  // A pad column may carry its own size typed on the plan; without one it
  // takes the picked footing's standard. A PILE has no such override -- its
  // size IS its diameter and the id says which.
  const padSizeIn = column => {
    const footing = footingFor(column?.footing);
    const custom = Number(column?.padIn);
    return !footing.pile && Number.isFinite(custom) && custom > 0
      ? custom : footing.sizeIn;
  };

  // PADS THAT TOUCH POUR AS ONE FOOTING, and the gap is why this is union-find
  // rather than a pairwise sweep: three pads in a row where only the
  // neighbours touch are still ONE pour, and a pairwise pass would emit two
  // overlapping rectangles for the same concrete.
  //
  // The default gap is dc's PAD_JOIN_GAP_FT -- 6", close enough that forming
  // two separate pads is more work than pouring the rectangle between them.
  const padGroups = (columns, { joinGapFt = 0.5 } = {}) => {
    const pads = (columns || []).filter(column => !footingFor(column?.footing).pile
      && column?.point && Number.isFinite(column.point.x) && Number.isFinite(column.point.z));
    const rects = pads.map(column => {
      const half = padSizeIn(column) / 24;
      return {
        minX: column.point.x - half, maxX: column.point.x + half,
        minZ: column.point.z - half, maxZ: column.point.z + half,
      };
    });
    const parent = pads.map((_, index) => index);
    const find = index => (parent[index] === index ? index : (parent[index] = find(parent[index])));
    const gap = Number(joinGapFt) >= 0 ? Number(joinGapFt) : 0;
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.minX <= b.maxX + gap && b.minX <= a.maxX + gap
          && a.minZ <= b.maxZ + gap && b.minZ <= a.maxZ + gap) {
          parent[find(i)] = find(j);
        }
      }
    }
    const groups = new Map();
    pads.forEach((column, index) => {
      const root = find(index);
      if (!groups.has(root)) {
        groups.set(root, {
          columns: [], minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity,
        });
      }
      const group = groups.get(root);
      group.columns.push(column);
      const rect = rects[index];
      group.minX = Math.min(group.minX, rect.minX);
      group.maxX = Math.max(group.maxX, rect.maxX);
      group.minZ = Math.min(group.minZ, rect.minZ);
      group.maxZ = Math.max(group.maxZ, rect.maxZ);
    });
    return [...groups.values()];
  };

  // ── OPEN WEB JOISTS OVER A GARAGE ────────────────────────────────────────
  //
  // Movie, 12 Oct: "we don't want columns in the garage. what i prefer to do
  // is go SIDE WALL to SIDE WALL direction for joists and use ENGINEERED OWJ
  // of 19.75" (but these may need to be increased based on distance the
  // joists need to span", spacing "16" or 12" for longest", and "the joists
  // over the garage will need to be engineered so they might change but if
  // we can provide an accurate size its best".
  //
  // ONE TABLE, so the supplier's own numbers replace these in one place --
  // and a SAFE one (Movie, 12 Oct: "a generalized span table for OWJ that
  // would be 'safe' to use (don't get too close to the limits)", "showing max
  // span for different joist depths / joist spacing").
  //
  // HOW IT WAS MADE, so it can be checked: a generic wood open-web floor
  // truss chart (40 psf live, 10 psf dead, L/480 live-load deflection) gives
  // the 19.2" o.c. column -- 16" 23'-9", 18" 25'-4", 20" 26'-2", 22" 27'-11",
  // 24" 29'-7". The other spacings follow the deflection limit, which goes as
  // the cube root of the load per joist (span x (19.2 / spacing)^(1/3)); every
  // figure is then cut by 10% and rounded DOWN to the half foot. Feet, clear
  // span between bearings. The 22" figure is read between its neighbours
  // rather than off the chart, which is said here rather than hidden: it is
  // the only row in the table that was interpolated.
  //
  // EVERY DEPTH IS ITS ROUND NUMBER LESS THE SHEATHING, which is the rule
  // Movie set on 13 Oct: "lets leave ours at 19.25\" and then it will be 20\"
  // even. lets also do that for the other TRUSS sizes so they end up at 24\"
  // for exacmple with the sheathing". So the TRUSS is 3/4" shy of a round
  // figure and the FLOOR PACKAGE lands on it:
  //
  //     15-1/4  ->  16      19-1/4  ->  20      23-1/4  ->  24
  //     17-1/4  ->  18      21-1/4  ->  22
  //
  // (His example said the 24" one would be "24.25", which is the rule the
  // other way round -- 24-1/4 plus sheathing is 25. The rule is what is
  // built here, and it is the same one his own 19-1/4 -> 20 states.)
  //
  // THE 19-1/4" ROW IS THE 20" ROW, and it keeps the 20" figures on purpose.
  // Movie, 13 Oct, asked which depth to carry -- "so 19.25\" or 19.75\" either
  // would work right, since they have to build the truss per job" -- and then
  // answered it himself: "i like for ours lines up to 20\" even with the
  // sheathing". An open-web truss is built to order, so neither depth is a
  // catalogue size and both are equally buildable; what decides it is the
  // framing arithmetic, and 19-1/4" plus 3/4" of sheathing is a round 20"
  // floor package. PROJECT has scheduled this deck at 19-1/4" since 28 Sep,
  // so this row is what makes the two sheets say one number.
  //
  // THE SPANS ARE NOT RE-DERIVED for the quarter inch, and that is safe
  // rather than lazy: each row's figures already come off the ROUND depth's
  // chart cut by 10%, and three quarters of an inch of depth is far inside
  // that haircut. A supplier's own chart replaces the table whole.
  //
  // WHICH DEPTHS AN OWJ COMES IN, Movie, 14 Oct: "the OWJ are 19.25" or
  // bigger, also smaller one 16" 15.25" 18" (17.25"", then "than i guess
  // 21.25" and 23.25" and that's probably it hey". Five rows, 16" through
  // 24" nominal. Two changes from what this table held:
  //
  //   - 13-1/4" IS GONE. A 14" nominal open-web truss is not a thing he
  //     orders; that depth is TJI country, and the TJI is one depth --
  //     11 7/8" -- which is level-assembly.js's own `tji` row and not an
  //     open-web joist at all. Nothing chose it anyway on the path that
  //     matters: over a garage `minDepthIn` is 19-1/4", so this row was only
  //     ever reachable by a short house-floor span.
  //   - 21-1/4" IS NEW, the 22" nominal he named. Its figures are the chart
  //     read between the 20" and 24" rows and then put through the same mill
  //     as every other row here -- the cube-root spacing rule and the 10%
  //     haircut, rounded down to the half foot -- so it sits between its two
  //     neighbours in every column rather than being eyeballed.
  const OWJ_OC_IN = Object.freeze([12, 16, 19.2, 24]);
  const OWJ_SPANS = Object.freeze([
    Object.freeze({ depthIn: 15.25, spanFt: Object.freeze({ 12: 25, 16: 22.5, 19.2: 21, 24: 19.5 }) }),
    Object.freeze({ depthIn: 17.25, spanFt: Object.freeze({ 12: 26.5, 16: 24, 19.2: 22.5, 24: 21 }) }),
    Object.freeze({ depthIn: 19.25, spanFt: Object.freeze({ 12: 27.5, 16: 25, 19.2: 23.5, 24: 21.5 }) }),
    Object.freeze({ depthIn: 21.25, spanFt: Object.freeze({ 12: 29, 16: 26.5, 19.2: 25, 24: 23 }) }),
    Object.freeze({ depthIn: 23.25, spanFt: Object.freeze({ 12: 31, 16: 28, 19.2: 26.5, 24: 24.5 }) }),
  ]);
  // THE JOIST FOR A SPAN, the way Movie lays them: 16" o.c. first, the
  // shallowest depth that spans it but never under `minDepthIn` (over a
  // garage that is his 19-1/4"); "12" for longest" when no 16" row reaches.
  // Past the table, `fits: false` and the deepest at 12" -- said, not guessed.
  const owjFor = (spanFt, { minDepthIn = 0, ocOrder = [16, 12] } = {}) => {
    const rows = OWJ_SPANS.filter(r => r.depthIn >= minDepthIn - 1e-6);
    for (const ocIn of ocOrder) {
      const row = rows.find(r => spanFt <= r.spanFt[ocIn] + 1e-6);
      if (row) return { depthIn: row.depthIn, ocIn, maxSpanFt: row.spanFt[ocIn], fits: true };
    }
    const last = OWJ_SPANS[OWJ_SPANS.length - 1];
    const ocIn = ocOrder[ocOrder.length - 1];
    return { depthIn: last.depthIn, ocIn, maxSpanFt: last.spanFt[ocIn], fits: false };
  };

  // ── HOW FAR A FLOOR OVER A GARAGE MAY SPAN WITH NO BEAM ────────────────
  //
  // Movie, 15 Oct, looking at the detached 2-storey garage's own build -- 30
  // ft side wall to side wall, carried on "ENGINEERED OWJ 23-1/4" @ 12" O.C."
  // and nothing else: "there should have been at least 1 beam (or 2 with one
  // by the stairs) the span was too far".
  //
  // THE LIMIT IS HIS OWN TABLE READ AT HIS OWN SPACING, not a new number. He
  // lays joists "16" o.c. first" and keeps 12" for the longest -- the last
  // resort, where the only way to reach the span is to crowd the joists at
  // the deepest section the supplier makes. What he is saying here is that the
  // last resort is not an answer for a floor somebody lives on: if the deck
  // needs 12" o.c. (or falls off the table entirely) the span is too far and a
  // beam goes in. So the bare-deck ceiling is the deepest allowed row at 16"
  // o.c. -- 28 ft over a garage, where `minDepthIn` is his 19-1/4".
  //
  // It moves nothing under 28 ft: a 24 ft double garage still gets a clear
  // bay and no post, which is 12 Oct's "we don't want columns in the garage".
  // Past it the columns are still placed where he put them -- centred between
  // two doors, clear of the cars -- so the rule he gave then is kept by
  // PLACEMENT rather than by absence.
  const OWJ_BARE_OC_IN = 16;
  const garageBareSpanFt = ({ minDepthIn = 0 } = {}) => Math.max(
    ...OWJ_SPANS.filter(r => r.depthIn >= minDepthIn - 1e-6).map(r => r.spanFt[OWJ_BARE_OC_IN]));

  // ── PAST THE TABLE: DROPPED ENGINEERED BEAMS ON COLUMNS ────────────────
  //
  // Movie, 12 Oct, on a garage floor wider than the OWJ table reaches: "PLACE
  // COLUMNS to support BEAM (which are placed 10ft max from the back wall to
  // where the front of the room above is. or spaced evenly at less than 10ft.
  // the floor joists can span lets go 30ft between them or even out to approx
  // car bays based on garage door locations (place the columns centered
  // between 2 doors so the cars won't hit the columns", then "if more than 60
  // would need 3 rows", "dropped beam ... better for ducts etc ... and
  // insulation of 2nd floor", "mark it ENGINEERED BEAM".
  //
  // THE JOISTS STILL RUN SIDE WALL TO SIDE WALL (the box's short way). The
  // beams run the other way, front to back across the body, cutting the joist
  // span into rows of no more than `maxJoistFt`: one beam up to 60 ft, two
  // past it -- "3 rows". Each beam sits between two garage doors when the
  // doors offer a line that keeps every row in reach (`doors`: the garage
  // doors' centres in plan), else the rows are made even. Columns stand under
  // each beam no more than `maxColumnFt` apart; an end that lands on a wall
  // (`onWall`) bears there and takes no column.
  //
  // Pure: box {x0, x1, z0, z1} in plan feet. Answers the joist axis, the beam
  // lines, the column points and the widest joist row left.
  // SIDE WALL TO SIDE WALL: the joists land on the two walls without the
  // garage doors, so they run the same way as the door wall. Front to back
  // they would only land on the back wall and need a long beam under the
  // door end. The doors' nearest edge of `box` names the door wall; with no
  // doors, the shorter side.
  const garageJoistAxis = (box, doors = []) => {
    const w = box.x1 - box.x0, d = box.z1 - box.z0;
    let xWall = 0, zWall = 0;                  // doors on a wall running in x / in z
    doors.forEach(p => {
      const toX = Math.min(Math.abs(p.z - box.z0), Math.abs(p.z - box.z1));
      const toZ = Math.min(Math.abs(p.x - box.x0), Math.abs(p.x - box.x1));
      if (toX < toZ) xWall += 1; else if (toZ < toX) zWall += 1;
    });
    if (xWall !== zWall) return xWall > zWall ? 'x' : 'z';
    return w <= d ? 'x' : 'z';
  };
  const garageSpanFt = (box, doors = []) => (garageJoistAxis(box, doors) === 'x'
    ? box.x1 - box.x0 : box.z1 - box.z0);

  // `maxJoistFt` IS THE BARE-DECK CEILING, one number for both halves of the
  // rule: the span that decides a beam is needed is the same span the rows are
  // then cut to. It used to be a flat 30, which disagreed with the table the
  // deck is sized from -- a 30 ft garage was told its joists were fine and
  // then told no row needed cutting, and both answers came from different
  // arithmetic. A caller may still pass its own.
  // ── THE GARAGE SQUARE: NOTHING STANDS WHERE THE CAR GOES ─────────────
  //
  // Movie, 16 Oct, settling it after the parking research: "lets go 20ft total
  // 'height (length) for square" ... "(not +4) just 20" ... "actually on the
  // sides only make it increase by 6" so the colms can know they can be placed
  // between the 2 doors" ... "so the stairs of other stuff to interfer with
  // the vehicle shouldn't locate there" ... "no columns in that area either".
  // And before that: "the landing area for the man door (42"x42" landing".
  //
  // ONE SQUARE PER OVERHEAD DOOR: the door's own width plus 6" each side (his
  // 6'8" doors come to 7'-8"), 20'-0" deep from the INSIDE face of the door
  // wall into the garage, capped at the garage's own depth so the rule always
  // has an answer -- and says so (`capped`), because a garage shallower than
  // its square is one the app should call out rather than quietly stand a
  // post in front of a car. The 6" is not a clearance guess: it is what leaves
  // the pier between two doors free for a column.
  //
  // A FLOOR KEEP-OUT, NOT A STAIR RULE. Nothing that stands on the garage
  // floor may be inside one: a stair and its well, a column or pile. Overhead
  // is a different question and is allowed -- a beam crossing the bay is how
  // a garage is framed.
  //
  // THE OTHER KEEP-OUT is the 42" x 42" landing inside the man door.
  //
  // Doors come in as `{ at, along, inward, widthFt, overhead }`: the centre on
  // the wall line, the wall's unit direction, the unit normal INTO the garage,
  // the clear width in feet, and whether it is the overhead door (a man door
  // takes the landing). `insetFt` is the door wall's thickness, wall line to
  // inside face; the depth is measured from there.
  const GARAGE_SQUARE_DEPTH_FT = 20;
  const GARAGE_SQUARE_SIDE_IN = 6;
  const MAN_DOOR_LANDING_IN = 42;
  const garageKeepOuts = (points, doors = [], {
    insetFt = 0, depthFt = GARAGE_SQUARE_DEPTH_FT, sideIn = GARAGE_SQUARE_SIDE_IN,
    landingIn = MAN_DOOR_LANDING_IN,
  } = {}) => {
    const ring = (points || []).map(p => ({ x: p.x, z: p.z }));
    if (ring.length < 3) return [];
    return (doors || []).flatMap(door => {
      const { at, along, inward } = door;
      if (!at || !along || !inward || !(door.widthFt > 0)) return [];
      // How far the garage runs in from this wall: the far wall's inside face.
      // The door's own wall thickness when it says (a stud wall and a
      // concrete one differ), else the one inset for all.
      const inset = Number.isFinite(door.insetFt) ? door.insetFt : insetFt;
      // The floor runs from this wall's inside face to the far wall's: the
      // far wall taken at the same thickness.
      const farFace = Math.max(...ring.map(p => (p.x - at.x) * inward.x + (p.z - at.z) * inward.z)) - inset;
      const avail = farFace - inset;
      const wantFt = door.overhead ? depthFt : landingIn / 12;
      const halfFt = door.overhead ? door.widthFt / 2 + sideIn / 12 : landingIn / 24;
      const deep = Math.min(wantFt, avail);
      if (!(deep > 0.01)) return [];
      const corner = (s, v) => ({ x: at.x + inward.x * s + along.x * v, z: at.z + inward.z * s + along.z * v });
      return [{
        kind: door.overhead ? 'bay' : 'landing',
        doorId: door.id ?? null,
        depthFt: deep,
        capped: door.overhead && avail < depthFt - 1e-6,
        points: [corner(inset, -halfFt), corner(inset, halfFt),
          corner(inset + deep, halfFt), corner(inset + deep, -halfFt)],
      }];
    });
  };
  const pointInRing = (ring, p) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
    }
    return hit;
  };
  const segmentsCross = (a, b, c, d) => {
    const cross = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  const inKeepOut = (keepOuts, p) => (keepOuts || []).some(k => pointInRing(k.points, p));
  // A polygon stands in a keep-out when a corner of either is inside the
  // other or an edge crosses: the three ways two rectangles can meet.
  const hitsKeepOut = (keepOuts, poly) => (keepOuts || []).some(k => {
    if (poly.some(p => pointInRing(k.points, p))) return true;
    if (k.points.some(p => pointInRing(poly, p))) return true;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      for (let j = 0; j < k.points.length; j += 1) {
        if (segmentsCross(a, b, k.points[j], k.points[(j + 1) % k.points.length])) return true;
      }
    }
    return false;
  });

  // ── A BEAM MAY NOT LAND OVER AN OPENING ──────────────────────────────
  //
  // Movie, 16 Oct: "the beam cant rest over the garage opening or door
  // opening either, they should have a solid support column built into the
  // wall below where the beam rests (can't be opening)".
  //
  // The beam row's ends bear on the two walls it runs between -- for a
  // garage that is the door wall and the wall facing it -- so the row's
  // position has to be solid wall at both: clear of every opening on those
  // walls by half a 6x6 post and the lintel's own bearing. `openings` are the
  // spans along the row axis of the openings on EITHER end wall.
  const BEAM_POST_IN = 5.5;          // a 6x6, which is what stands in a wall under a beam
  const BEAM_BEARING_IN = 1.5;       // the lintel bearing the post must not take (NBC 9.23.12.3)
  const BEAM_BEARING_CLEAR_FT = (BEAM_POST_IN / 2 + BEAM_BEARING_IN) / 12;
  const solidAt = (u, openings) => (openings || []).every(([a, b]) =>
    u <= Math.min(a, b) - BEAM_BEARING_CLEAR_FT + 1e-9 || u >= Math.max(a, b) + BEAM_BEARING_CLEAR_FT - 1e-9);

  const garageBeamPlan = (box, {
    doors = [], onWall = () => false, maxJoistFt = garageBareSpanFt(), maxColumnFt = 10, doorBox = box,
    keepOuts = [], openings = [],
  } = {}) => {
    const axis = garageJoistAxis(doorBox, doors);   // the joists' direction
    const lo = axis === 'x' ? box.x0 : box.z0;
    const hi = axis === 'x' ? box.x1 : box.z1;
    const along0 = axis === 'x' ? box.z0 : box.x0;
    const along1 = axis === 'x' ? box.z1 : box.x1;
    const span = hi - lo;
    const n = Math.max(0, Math.ceil(span / maxJoistFt - 1e-9) - 1);
    if (!n) return { axis, beams: [], columns: [], posts: [], dropped: [], rowFt: span, bearing: 'solid' };
    const widest = cuts => {
      const edges = [lo, ...cuts, hi];
      return Math.max(...edges.slice(1).map((e, i) => e - edges[i]));
    };
    // BETWEEN TWO DOORS: the midpoints of neighbouring door centres, inside
    // the body. Every choice of n of them is tried; the one leaving the
    // narrowest widest row wins, if it is within reach.
    const doorsAt = [...new Set(doors.map(p => (axis === 'x' ? p.x : p.z))
      .filter(v => v > lo && v < hi).map(v => Math.round(v * 1000) / 1000))]
      .sort((a, b) => a - b);
    const between = doorsAt.slice(1).map((v, i) => (v + doorsAt[i]) / 2);
    let best = null;
    const pick = (from, start, chosen) => {
      if (chosen.length === n) {
        const row = widest(chosen);
        if (row <= maxJoistFt + 1e-6 && (!best || row < best.row - 1e-9)) best = { cuts: chosen.slice(), row };
        return;
      }
      for (let i = start; i < from.length; i += 1) pick(from, i + 1, [...chosen, from[i]]);
    };
    // SOLID BEARING ONLY: a row whose end would rest over a door is not a
    // candidate at all (solidAt, above).
    const even = Array.from({ length: n }, (_, i) => lo + span * (i + 1) / (n + 1));
    const solid = u => u > lo + 0.01 && u < hi - 0.01 && solidAt(u, openings);
    const legalBetween = between.filter(solid);
    if (legalBetween.length >= n && legalBetween.length <= 12) pick(legalBetween, 0, []);
    let bearing = 'solid';
    let cuts;
    if (best) {
      cuts = best.cuts;
    } else if (even.every(solid)) {
      cuts = even;
    } else {
      // THE EVEN ROW LANDS IN AN OPENING -- the single centred door. Slide
      // each cut to the nearest solid bearing: an opening's edge plus the
      // post and its bearing, choosing the set that keeps the rows within
      // the joists' reach; failing that, the nearest solid stand, and the
      // plan's `rowFt` carries the long row to the note. No solid stand at
      // all is `bearing: 'none'` for the page to say out loud.
      const edges = (openings || []).flatMap(([a, b]) => [
        Math.min(a, b) - BEAM_BEARING_CLEAR_FT, Math.max(a, b) + BEAM_BEARING_CLEAR_FT]);
      const candidates = [...new Set([...legalBetween, ...edges.filter(solid)])].sort((p, q) => p - q);
      if (candidates.length >= n && candidates.length <= 12) pick(candidates, 0, []);
      if (best) {
        cuts = best.cuts;
      } else if (candidates.length >= n) {
        cuts = [...new Set(even.map(u => candidates.reduce((near, c) =>
          (Math.abs(c - u) < Math.abs(near - u) ? c : near))))].sort((p, q) => p - q);
      } else {
        cuts = even;
        bearing = 'none';
      }
    }
    const at = (u, v) => (axis === 'x' ? { x: u, z: v } : { x: v, z: u });
    const beams = [], columns = [], posts = [], dropped = [];
    cuts.forEach(u => {
      const start = at(u, along0), end = at(u, along1);
      beams.push({ start, end });
      // THE SOLID SUPPORT BUILT INTO THE WALL under each end of the beam.
      posts.push(start, end);
      const len = along1 - along0;
      const bays = Math.max(1, Math.ceil(len / maxColumnFt - 1e-9));
      for (let k = 0; k <= bays; k += 1) {
        const p = at(u, along0 + len * k / bays);
        if ((k === 0 || k === bays) && onWall(p)) continue;
        // "no columns in that area either": a post inside a square is
        // dropped and the beam spans to its neighbours -- the longer, deeper
        // beam rather than a post in front of a car.
        if (inKeepOut(keepOuts, p)) { dropped.push(p); continue; }
        columns.push(p);
      }
    });
    return { axis, beams, columns, posts, dropped, rowFt: widest(cuts), bearing };
  };

  // ── THE HEADER WHERE A STAIR WELL CUTS THE JOISTS ──────────────────────
  //
  // Movie, 15 Oct: "at least 1 beam (or 2 with one by the stairs)". The second
  // one is not another row across the floor -- it is the header the cut joists
  // land on. A well is a hole with joists running INTO it from both sides, and
  // whichever side runs farther has to be caught before it reaches the hole.
  //
  // WHICH EDGE, MEASURED RATHER THAN ASSUMED. The two edges that face the
  // joists are the well's two ends across the span. Each one is asked how far
  // its own side runs to the next thing that holds a joist up -- a side wall
  // or a beam line, which is what `supports` carries -- and the header goes on
  // the edge with the longer run. For the detached garage that is the inboard
  // edge: the well sits 2 1/2 ft off the side wall and 9 ft from the mid-span
  // beam, so the stub by the wall needs nothing and the long side does.
  //
  // NO COLUMN UNDER IT. A header's ends land on the trimmer joists either side
  // of the opening, which is how a stairwell is framed; a post there would
  // stand in the garage for no reason. It is FLUSH for the same reason -- it
  // is inside the floor, catching joists, not hung under it carrying a storey.
  //
  // Pure: well and body boxes {x0,x1,z0,z1} in plan feet, the joists' axis,
  // and the cross-coordinates the joists already bear on. Answers one
  // {start, end} or null when the well touches a support on both sides and
  // there is nothing to catch.
  // ── ONLY PARALLEL, AND ONLY PAST 10 FT ───────────────────────────────
  //
  // Movie, 16 Oct, on a stair set across the beam: "when the stairs are
  // alligned perp to the main beam like in ths photo above, we don't need
  // beams on the short ends of the stairs, only when it is ll and there is
  // 10ft or more span of floor until the next beam or ext. wall".
  //
  // BOTH HAVE TO HOLD. Joists span across the beam, so a well set ACROSS it
  // runs with the joists: it interrupts few, the trimmers down its long sides
  // carry what it does, and the edges this picks between -- its ends -- are
  // headers with almost nothing on them. A well set ALONG the beam cuts
  // across the joists its whole length, so the edge on the open side gathers
  // every cut joist, and past 10 ft of remaining span that header is a beam.
  // Under 10 ft the joists are the engineer's sheet, as a plain deck is.
  //
  // `axis` is the JOISTS' direction (garageJoistAxis); the well is parallel to
  // the beam when it is longer ACROSS the joists than along them. `minRunFt`
  // is his 10, measured from the well's edge to the next support, not from
  // the stair's middle.
  const STAIR_HEADER_SPAN_FT = 10;
  const garageStairHeader = (well, { axis, supports = [], minRunFt = STAIR_HEADER_SPAN_FT } = {}) => {
    const lo = axis === 'x' ? well.x0 : well.z0;
    const hi = axis === 'x' ? well.x1 : well.z1;
    const a0 = axis === 'x' ? well.z0 : well.x0;
    const a1 = axis === 'x' ? well.z1 : well.x1;
    if (!(hi - lo > 0.01) || !(a1 - a0 > 0.01)) return null;
    // ACROSS THE BEAM: the ends are headers, not beams.
    if (!(a1 - a0 > hi - lo + 0.01)) return null;
    const sorted = [...supports].sort((p, q) => p - q);
    const below = sorted.filter(s => s <= lo + 1e-6);
    const above = sorted.filter(s => s >= hi - 1e-6);
    const runLo = below.length ? lo - Math.max(...below) : 0;
    const runHi = above.length ? Math.min(...above) - hi : 0;
    if (runLo <= 0.01 && runHi <= 0.01) return null;
    // UNDER 10 FT OF FLOOR TO THE NEXT SUPPORT, nothing: the joists carry it.
    if (Math.max(runLo, runHi) < minRunFt - 1e-6) return null;
    const u = runHi > runLo ? hi : lo;
    const at = (c, v) => (axis === 'x' ? { x: c, z: v } : { x: v, z: c });
    return { start: at(u, a0), end: at(u, a1) };
  };

  // ── THE JOIST CALLOUT, ONE PER BAY (Movie, 16 Oct) ──────────────────────
  //
  // Marked up in GIMP on the 2ND FL FLOOR LAYOUT: the three-line note
  // ("ENGINEERED OWJ 19-1/4" @ 16" O.C. / WALL TO BEAM -- 18'-0" SPAN / TO
  // BE CONFIRMED BY JOIST ENGINEER") struck out, and in its place an ARROWED
  // span line perpendicular to the beam in every bay, each with the short
  // form beside it -- "ENGINEERED OWJ 19-1/4"" and nothing else.
  //
  // A BAY is the run the joists make between two bearings: wall to beam, beam
  // to beam, beam to wall -- or wall to wall on a deck with no beam. The
  // beams decide which way the joists run (across them); a bare deck takes
  // `axis` from its caller (a room over a garage runs with the door wall, see
  // garageJoistAxis) and otherwise the shorter way.
  //
  // WHERE THE ARROW STANDS along the beam: a third of the way along, then two
  // thirds, then the middle -- the first that is clear of a hole (the
  // stairwell) by a foot. Pure: points in plan feet, answers { axis, spanFt,
  // bays: [{ at, from, to, spanFt }] } with `at` on the beam axis and from/to
  // on the joist axis, or null for a body too small to frame.
  const JOIST_ARROW_CLEAR_FT = 1;
  const joistBays = (points, { beams = [], holes = [], axis = null } = {}) => {
    if (!Array.isArray(points) || points.length < 3) return null;
    const xs = points.map(pt => pt.x), zs = points.map(pt => pt.z);
    const box = { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)] };
    if (box.x[1] - box.x[0] < 0.5 || box.z[1] - box.z[0] < 0.5) return null;
    const boxOf = pts => {
      const px = pts.map(pt => pt.x), pz = pts.map(pt => pt.z);
      return { x: [Math.min(...px), Math.max(...px)], z: [Math.min(...pz), Math.max(...pz)] };
    };
    const holeBoxes = holes.map(hole => (Array.isArray(hole?.points) ? hole.points : hole))
      .filter(pts => Array.isArray(pts) && pts.length >= 3).map(boxOf);
    // THE BEAMS THAT CROSS THIS BODY, by the axis they run on.
    const crossing = beams.filter(beam => beam?.start && beam?.end).map(beam => {
      const along = Math.abs(beam.end.x - beam.start.x) >= Math.abs(beam.end.z - beam.start.z) ? 'x' : 'z';
      const across = along === 'x' ? 'z' : 'x';
      const fixed = (beam.start[across] + beam.end[across]) / 2;
      const lo = Math.min(beam.start[along], beam.end[along]);
      const hi = Math.max(beam.start[along], beam.end[along]);
      return { along, across, fixed, lo, hi };
    }).filter(beam => beam.fixed > box[beam.across][0] + 0.01 && beam.fixed < box[beam.across][1] - 0.01
      && Math.min(beam.hi, box[beam.along][1]) - Math.max(beam.lo, box[beam.along][0]) > 0.01);
    // THE JOIST AXIS: across the beams when there are any (the most of them,
    // where two directions cross), else the caller's, else the short way.
    let joist;
    if (crossing.length) {
      const onX = crossing.filter(beam => beam.along === 'x').length;
      joist = onX >= crossing.length - onX ? 'z' : 'x';
    } else if (axis === 'x' || axis === 'z') {
      joist = axis;
    } else {
      joist = box.x[1] - box.x[0] <= box.z[1] - box.z[0] ? 'x' : 'z';
    }
    const beamAxis = joist === 'x' ? 'z' : 'x';
    const cuts = [...new Set(crossing.filter(beam => beam.along === beamAxis)
      .map(beam => Math.round(beam.fixed * 1000) / 1000))].sort((a, b) => a - b);
    const stops = [box[joist][0], ...cuts, box[joist][1]];
    const runLo = box[beamAxis][0], runHi = box[beamAxis][1], run = runHi - runLo;
    const bays = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i], to = stops[i + 1];
      if (to - from < 0.5) continue;
      const clear = at => !holeBoxes.some(hole =>
        Math.min(hole[joist][1], to) - Math.max(hole[joist][0], from) > 0.01
        && at > hole[beamAxis][0] - JOIST_ARROW_CLEAR_FT && at < hole[beamAxis][1] + JOIST_ARROW_CLEAR_FT);
      const candidates = [runLo + run / 3, runLo + run * 2 / 3, runLo + run / 2];
      const at = candidates.find(clear) ?? candidates[0];
      bays.push({ at, from, to, spanFt: to - from });
    }
    if (!bays.length) return null;
    return { axis: joist, spanFt: Math.max(...bays.map(bay => bay.spanFt)), bays };
  };

  // THE WAY A DECK'S JOISTS RUN WHEN NO BEAM SAYS: over a garage, with the
  // door wall (garageJoistAxis, the doors read as points on their wall);
  // anywhere else null, which joistBays reads as the shorter way. `garages`
  // are the garage outlines UNDER the deck (the caller's level filter);
  // `doorPoints` any points on the garage doors' walls.
  const deckJoistAxis = (points, { garages = [], doorPoints = [] } = {}) => {
    if (!Array.isArray(points) || points.length < 3) return null;
    const c = points.reduce((m, p) => ({ x: m.x + p.x / points.length, z: m.z + p.z / points.length }), { x: 0, z: 0 });
    const inLoop = (loop, p) => {
      let hit = false;
      for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const a = loop[i], b = loop[j];
        if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    };
    const garage = garages.find(g => Array.isArray(g?.points) && g.points.length >= 3 && inLoop(g.points, c));
    if (!garage) return null;
    const gx = garage.points.map(p => p.x), gz = garage.points.map(p => p.z);
    const box = { x0: Math.min(...gx), x1: Math.max(...gx), z0: Math.min(...gz), z1: Math.max(...gz) };
    const near = doorPoints.filter(p => p && p.x >= box.x0 - 1 && p.x <= box.x1 + 1 && p.z >= box.z0 - 1 && p.z <= box.z1 + 1);
    return garageJoistAxis(box, near);
  };

  // THE SHORT FORM, off the level's schedule (level-assembly's assembly for
  // the storey): "ENGINEERED OWJ 19-1/4"", "TJI 11-7/8"", "2x10 JOISTS". One
  // home for the depth -- PROJECT's row and this label read the same field.
  const inchesLabel = depthIn => {
    const whole = Math.floor(depthIn + 1e-9);
    const eighths = Math.round((depthIn - whole) * 8);
    if (eighths === 0) return `${whole}"`;
    if (eighths === 8) return `${whole + 1}"`;
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const g = gcd(eighths, 8);
    return `${whole}-${eighths / g}/${8 / g}"`;
  };
  const joistCallout = assembly => {
    const type = String(assembly?.joistType || 'owj');
    const depthIn = Number(assembly?.joistDepthIn);
    if (/^conv_/.test(type)) return `${type.replace(/^conv_/, '')} JOISTS`;
    const name = type === 'tji' ? 'TJI' : 'ENGINEERED OWJ';
    return Number.isFinite(depthIn) && depthIn > 0 ? `${name} ${inchesLabel(depthIn)}` : name;
  };

  window.DraftBuildHouse = Object.freeze({
    joistBays,
    deckJoistAxis,
    joistCallout,
    inchesLabel,
    JOIST_ARROW_CLEAR_FT,
    OWJ_OC_IN,
    OWJ_SPANS,
    owjFor,
    garageBareSpanFt,
    garageBeamPlan,
    garageKeepOuts,
    inKeepOut,
    hitsKeepOut,
    GARAGE_SQUARE_DEPTH_FT,
    GARAGE_SQUARE_SIDE_IN,
    MAN_DOOR_LANDING_IN,
    BEAM_BEARING_CLEAR_FT,
    garageStairHeader,
    STAIR_HEADER_SPAN_FT,
    garageJoistAxis,
    garageSpanFt,
    outlineInteriorRef,
    houseWallRuns,
    footingRings,
    pilePoints,
    midSpanBeams,
    COLUMN_FOOTINGS,
    footingFor,
    pileMark,
    padSizeIn,
    padGroups,
  });
})();
}
