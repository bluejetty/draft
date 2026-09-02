// AUTO-PLACE STAIRS (board #260) — the pure placement derivation. Plain
// data in (outline, beam lines, stamps, layout numbers), one suggested
// stair out (same shape as a hand placement: start = top nosing, end =
// downhill), plus a per-shape report of WHY when a shape found no home.
// MODEL passes real geometry in, commits the winner, and owns everything
// stateful: riser math, the opening cut, stacking, the wallet, the tour.
//
// The suggestion is born legal: every candidate keeps its well (inflated
// by half the finish allowance) inside the interior ring and holds the
// #246 beam-edge gap, so `_stairAutoFit` finds nothing to nudge.
// REQUIRES window.DraftGeometry2D -- resolved at CALL time, not at load. A page may list this
// script before its dependency and still work; only the run/landing geometry needs the
// dependency present by the time it is called.
//
// It was captured at load until 2 Sep, which meant a page whose script order
// put this first got a module that loaded clean, reported every export, and
// threw later from a call site naming a different file.
if (!window.DraftAutoStair) {
(() => {
  const geo = () => window.DraftGeometry2D;

  // The rulebook (stair-rules.js). The brains used to be the constants
  // below; they now live in a table with provenance and confidence on
  // every row, and this file reads it. The constants stay as SEEDS: the
  // table was seeded from them, so a table row and its seed agree, and a
  // build that somehow loads this file without the rulebook still places
  // exactly the stair it placed before rather than a silently different
  // one. `rule` reads a weight, `sized` reads a distance/threshold.
  const rules = () => window.DraftStairRules || null;
  const rule = (id, seed) => {
    const row = rules()?.PLACEMENT_BY_ID?.[id];
    return Number.isFinite(row?.weight) ? row.weight : seed;
  };
  const sized = (id, field, seed) => {
    const row = rules()?.PLACEMENT_BY_ID?.[id];
    return Number.isFinite(row?.[field]) ? row[field] : seed;
  };

  // Tunables — scoring weights and the placement gaps. Each is the seed
  // for the table row named beside it.
  const BEAM_EDGE_GAP_IN = rule('beamEdgeGap', 2);          // well long edge off the beam centreline (#246)
  const BEDROOM_REPEL_FT = sized('bedroomRepel', 'radiusFt', 6);  // BEDROOM stamp proximity that starts the penalty
  const BEDROOM_REPEL_WEIGHT = rule('bedroomRepel', 2);     // score per foot of intrusion into that circle
  const EXTERIOR_SOFT_PENALTY = rule('exteriorWallPenalty', 2);   // rule B: soft nudge away from the exterior wall
  const WALL_ADJACENT_FT = sized('exteriorWallPenalty', 'thresholdFt', 1); // "beside an exterior wall" = well within this of the ring
  const ENTRY_L_BONUS = -rule('entryLBonus', -4);           // rule A: the entry L beats an equally-near straight
  const ENTRY_STEP_PENALTY = rule('entryStepPenalty', 1);   // per entry step past the fewest: steps are need-driven
  // Stacking (research §2.4): a bonus for landing over the stair below,
  // falling off to nothing at the radius. Absent unless the caller passes
  // lowerStair, so it changes no placement that ships today.
  const STACK_BONUS = -rule('basementStacking', -10);
  const STACK_RADIUS_FT = sized('basementStacking', 'radiusFt', 12);
  const CIRCULATION_WEIGHT = rule('circulationDistance', 1);  // cost per foot from the circulation target
  const ENTRY_STAMPS = ['ENTRY', 'FOYER'];   // the front-entry zone (HALL is generic circulation)
  const PULL_STAMPS = ['HALL', 'ENTRY', 'FOYER'];
  const REPEL_STAMPS = ['BEDROOM'];

  const norm = name => String(name || '').trim().toUpperCase();

  // Even-odd clip of the horizontal line v = c against a polygon in (u,v)
  // space — the same pairing build-house.js uses for beams.
  const clipAtV = (poly, c) => {
    const crossings = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j], b = poly[i];
      if ((a.v > c) === (b.v > c)) continue;
      const t = (c - a.v) / (b.v - a.v);
      crossings.push(a.u + t * (b.u - a.u));
    }
    crossings.sort((p, q) => p - q);
    const runs = [];
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      if (crossings[i + 1] - crossings[i] > 0.01) runs.push([crossings[i], crossings[i + 1]]);
    }
    return runs;
  };

  // The u-intervals fully inside the polygon across the whole v-band
  // [v0,v1]: intersect the clip at both edges, the middle, and every
  // polygon vertex v inside the band — exact for the rectilinear rings
  // houses are, a tight approximation otherwise.
  const bandIntervals = (poly, v0, v1) => {
    const samples = [v0 + 0.001, (v0 + v1) / 2, v1 - 0.001];
    poly.forEach(pt => {
      if (pt.v > v0 + 0.01 && pt.v < v1 - 0.01) samples.push(pt.v);
    });
    let intervals = null;
    for (const s of samples) {
      const runs = clipAtV(poly, s);
      if (!intervals) { intervals = runs; continue; }
      const next = [];
      intervals.forEach(([a, b]) => runs.forEach(([c, d]) => {
        const lo = Math.max(a, c), hi = Math.min(b, d);
        if (hi - lo > 0.01) next.push([lo, hi]);
      }));
      intervals = next;
    }
    return intervals || [];
  };

  const distPtSeg = (pt, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.z - a.z) * dz) / len2)) : 0;
    return Math.hypot(pt.x - (a.x + dx * t), pt.z - (a.z + dz * t));
  };

  const distToRing = (pt, ring) => {
    let best = Infinity;
    for (let i = 0; i < ring.length; i++) {
      best = Math.min(best, distPtSeg(pt, ring[i], ring[(i + 1) % ring.length]));
    }
    return best;
  };

  const centroidOf = points => {
    let area = 0, cx = 0, cz = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const cross = points[j].x * points[i].z - points[i].x * points[j].z;
      area += cross;
      cx += (points[j].x + points[i].x) * cross;
      cz += (points[j].z + points[i].z) * cross;
    }
    if (Math.abs(area) < 1e-9) {
      const n = points.length || 1;
      return {
        x: points.reduce((s, p) => s + p.x, 0) / n,
        z: points.reduce((s, p) => s + p.z, 0) / n,
      };
    }
    return { x: cx / (3 * area), z: cz / (3 * area) };
  };

  // The circulation target (Q3/Q5): nearest pull stamp when one exists,
  // else the footprint centroid.
  const circulationTarget = (points, stamps) => {
    const pulls = (stamps || []).filter(st => PULL_STAMPS.includes(norm(st.name)));
    if (!pulls.length) return { point: centroidOf(points), kind: 'centroid' };
    const c = centroidOf(points);
    const best = pulls.reduce((most, st) =>
      (!most || Math.hypot(st.x - c.x, st.z - c.z) < Math.hypot(most.x - c.x, most.z - c.z) ? st : most), null);
    return { point: { x: best.x, z: best.z }, kind: norm(best.name) };
  };

  const bedroomPenalty = (wellCentre, stamps) => {
    let worst = 0;
    (stamps || []).filter(st => REPEL_STAMPS.includes(norm(st.name))).forEach(st => {
      const d = Math.hypot(st.x - wellCentre.x, st.z - wellCentre.z);
      if (d < BEDROOM_REPEL_FT) worst = Math.max(worst, (BEDROOM_REPEL_FT - d) * BEDROOM_REPEL_WEIGHT);
    });
    return worst;
  };

  // Stacking (research §2.4): the basement stair usually sits under the
  // main one — claimed rates run 60-100%, stored as a 0.7-0.9 prior. The
  // research does NOT agree on what "stacking" means (exact footprint
  // overlap, same structural bay, or merely nearby), so this models the
  // middle reading: proximity of well centres, full bonus dead-on and
  // nothing left by the radius. No lowerStair, no term — which is why
  // adding this rule moves no stair that ships today.
  const stackingBonus = (wellCentre, lowerStair) => {
    const at = lowerStair?.wellCentre || lowerStair;
    if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return 0;
    const d = Math.hypot(at.x - wellCentre.x, at.z - wellCentre.z);
    if (!(d < STACK_RADIUS_FT)) return 0;
    return -STACK_BONUS * (1 - d / STACK_RADIUS_FT);
  };

  // One beam LINE per distinct cross-position: collinear committed spans
  // collapse to a single {origin, dir} the candidates hug.
  const beamLines = beams => {
    const lines = [];
    (beams || []).forEach(beam => {
      const dx = beam.end.x - beam.start.x, dz = beam.end.z - beam.start.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) return;
      const dir = { x: dx / len, z: dz / len };
      const n = { x: -dir.z, z: dir.x };
      const c = beam.start.x * n.x + beam.start.z * n.z;
      const hit = lines.find(line =>
        Math.abs(line.dir.x * dir.x + line.dir.z * dir.z) > 0.999 && Math.abs(line.c - c) < 0.1);
      if (!hit) lines.push({ origin: { x: beam.start.x, z: beam.start.z }, dir, n, c });
    });
    return lines;
  };

  // ── The straight candidate: hug a beam line on either side ──
  // In the line's (u,v) frame the well is a [u0, u0+runFt] x width band at
  // v = ±(gap + finish/2 + w/2); the run plus a landing each end must fit
  // the interior ring's band, and the top nosing lands toward the target.
  const straightCandidates = (ring, lines, opts, target) => {
    const { runFt, widthFt, landingFt, finishFt, gapFt } = opts;
    const need = runFt + 2 * landingFt;
    const out = [];
    let longest = 0;
    lines.forEach(line => {
      const toUV = pt => ({
        u: (pt.x - line.origin.x) * line.dir.x + (pt.z - line.origin.z) * line.dir.z,
        v: (pt.x - line.origin.x) * line.n.x + (pt.z - line.origin.z) * line.n.z,
      });
      const ringUV = ring.map(toUV);
      const targetUV = toUV(target);
      [1, -1].forEach(side => {
        const vCentre = side * (gapFt + finishFt / 2 + widthFt / 2);
        const half = widthFt / 2 + finishFt / 2;
        const intervals = bandIntervals(ringUV, vCentre - half, vCentre + half);
        intervals.forEach(([lo, hi]) => {
          longest = Math.max(longest, hi - lo);
          if (hi - lo < need) return;
          // Slide the run inside [lo+landing, hi-landing] toward the target.
          const u0 = Math.max(lo + landingFt,
            Math.min(hi - landingFt - runFt, targetUV.u - runFt / 2));
          const centreU = u0 + runFt / 2;
          // Q3: the top nosing takes the end nearer the target.
          const topAtHigh = targetUV.u > centreU;
          const at = (u, v) => ({
            x: line.origin.x + line.dir.x * u + line.n.x * v,
            z: line.origin.z + line.dir.z * u + line.n.z * v,
          });
          const start = at(topAtHigh ? u0 + runFt : u0, vCentre);
          const end = at(topAtHigh ? u0 : u0 + runFt, vCentre);
          out.push({
            shape: 'straight',
            start, end,
            wellCentre: at(centreU, vCentre),
            well: [
              at(u0, vCentre - half), at(u0 + runFt, vCentre - half),
              at(u0 + runFt, vCentre + half), at(u0, vCentre + half),
            ],
          });
        });
      });
    });
    return { candidates: out, longest };
  };

  // ── The fold candidates: elbow at a ring corner near the core ──
  // Legs run along the corner's two edges, held a small clearance inside
  // the ring so the suggestion is strictly legal. Each candidate is three
  // axis-of-the-corner rects (top leg, landing, low leg — or the U's two
  // legs and switchback landing); containment tests every rect corner and
  // the beam gap is held rect by rect (folds never hug the beam — they
  // must not crowd it either).
  const FOLD_EDGE_CLEAR_FT = 0.05;
  const foldCandidates = (ring, lines, opts, target, shape) => {
    const { t1, t2, runStepFt, widthFt, landingFt, finishFt, gapFt, landFt, uGapFt } = opts;
    const wFin = widthFt + finishFt;
    const out = [];
    const reasons = [];
    for (let i = 0; i < ring.length; i++) {
      const corner = ring[i];
      const prev = ring[(i - 1 + ring.length) % ring.length];
      const next = ring[(i + 1) % ring.length];
      const edges = [
        { x: prev.x - corner.x, z: prev.z - corner.z },
        { x: next.x - corner.x, z: next.z - corner.z },
      ].map(vec => {
        const len = Math.hypot(vec.x, vec.z) || 1;
        return { dir: { x: vec.x / len, z: vec.z / len }, len };
      });
      // Convex ring corners only: the bisector must open into the ring.
      const probe = {
        x: corner.x + (edges[0].dir.x + edges[1].dir.x) * 0.2,
        z: corner.z + (edges[0].dir.z + edges[1].dir.z) * 0.2,
      };
      if (!pointInRing(ring, probe)) continue;
      [[0, 1], [1, 0]].forEach(([ai, bi]) => {
        const eA = edges[ai], eB = edges[bi];
        const origin = {
          x: corner.x + (eA.dir.x + eB.dir.x) * FOLD_EDGE_CLEAR_FT,
          z: corner.z + (eA.dir.z + eB.dir.z) * FOLD_EDGE_CLEAR_FT,
        };
        // Local frame: a along eA, b along eB, both from the shifted origin.
        const at = (a, b) => ({
          x: origin.x + eA.dir.x * a + eB.dir.x * b,
          z: origin.z + eA.dir.z * a + eB.dir.z * b,
        });
        const rectAt = (a0, a1, b0, b1) => [at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)];
        const availA = eA.len - 2 * FOLD_EDGE_CLEAR_FT;
        const availB = eB.len - 2 * FOLD_EDGE_CLEAR_FT;
        if (shape === 'L') {
          const run1 = t1 * runStepFt, run2 = t2 * runStepFt;
          const needA = landFt + run1 + landingFt;
          const needB = landFt + run2 + landingFt;
          if (availA < needA || availB < needB) {
            reasons.push(`L needs ${needA.toFixed(1)}'/${needB.toFixed(1)}' along a corner, edges give ${availA.toFixed(1)}'/${availB.toFixed(1)}'`);
            return;
          }
          const rects = [
            rectAt(landFt, landFt + run1, 0, wFin),   // top leg along eA
            rectAt(0, landFt, 0, landFt),             // elbow landing
            rectAt(0, wFin, landFt, landFt + run2),   // low leg along eB
          ];
          const centreline = widthFt / 2 + finishFt / 2;
          const start = at(landFt + run1, centreline);          // top nosing
          const first = { x: -eA.dir.x, z: -eA.dir.z };         // downhill
          const end = at(landFt, centreline);                   // toward the elbow
          const sRight = -first.z * eB.dir.x + first.x * eB.dir.z;
          out.push({
            shape: 'L',
            start, end,
            turn: sRight > 0 ? 'right' : 'left',
            wellCentre: at((landFt + run1) / 2, (landFt + run2) / 2),
            rects,
          });
        } else {
          const legFt = Math.max(t1, t2) * runStepFt;
          const wideFt = 2 * widthFt + uGapFt + finishFt;
          const needA = landingFt + legFt + landFt;
          if (availA < needA || availB < wideFt) {
            reasons.push(`U needs ${needA.toFixed(1)}' x ${wideFt.toFixed(1)}' at a corner, edges give ${availA.toFixed(1)}'/${availB.toFixed(1)}'`);
            return;
          }
          const a0 = landingFt;
          const rects = [
            rectAt(a0, a0 + legFt, 0, wFin),                    // run 1
            rectAt(a0 + legFt, a0 + legFt + landFt, 0, wideFt), // switchback landing
            rectAt(a0, a0 + legFt, wideFt - wFin, wideFt),      // run 2
          ];
          const centreline = widthFt / 2 + finishFt / 2;
          const start = at(a0, centreline);                     // top nosing
          const first = { x: eA.dir.x, z: eA.dir.z };           // descends away
          const end = at(a0 + legFt, centreline);
          const sRight = -first.z * eB.dir.x + first.x * eB.dir.z;
          out.push({
            shape: 'U',
            start, end,
            turn: sRight > 0 ? 'right' : 'left',
            wellCentre: at(a0 + (legFt + landFt) / 2, wideFt / 2),
            rects,
          });
        }
      });
    }
    const kept = out.filter(cand => {
      cand.well = cand.rects.flat();
      return cand.well.every(pt => pointInRing(ring, pt))
        && cand.rects.every(rect => beamGapOk(rect, lines, gapFt));
    });
    if (!kept.length && !reasons.length && out.length) {
      reasons.push(`every ${shape} corner crowded a beam or broke the ring`);
    }
    return { candidates: kept, reasons };
  };

  // ── Rule A: the entry L ──
  // When the circulation target is the front-entry zone, an L whose
  // code-required 36" landing sits against the front wall saves the space:
  // the front door (which slides along that wall) opens directly onto the
  // landing, 1-3 steps below the entry floor — so the top leg is SHORT
  // (splitTreads, the #260 override), descending perpendicular into the
  // landing, and the main flight runs along the wall. The door's own wall
  // margins (6" min / 1'-0" preferred to the studs) belong to the door,
  // not the stair, and are not enforced here.
  //
  // Vocabulary (per the boss, via Devin): splitTreads is always treads in
  // the TOP leg of the stored top-down stair. For the basement stair the
  // entry floor is the TOP, so the short entry-side leg IS the top leg
  // (2-3 treads, fewest that fit). A stacked upper stair sees the entry
  // floor at its BOTTOM: same plan rects, splitTreads = treads − 2..3 —
  // that mapping belongs to the commit layer's stacking, not here.
  const entryLCandidates = (ring, lines, opts, target) => {
    const { treads, runStepFt, widthFt, landingFt, finishFt, landFt } = opts;
    const wFin = widthFt + finishFt;
    // The front wall: the ring edge nearest the entry stamp.
    let front = null;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const d = distPtSeg(target, a, b);
      if (!front || d < front.d) front = { a, b, d };
    }
    if (!front) return [];
    const ex = front.b.x - front.a.x, ez = front.b.z - front.a.z;
    const elen = Math.hypot(ex, ez) || 1;
    const e = { x: ex / elen, z: ez / elen };
    let n = { x: -e.z, z: e.x };
    const mid = { x: (front.a.x + front.b.x) / 2 + n.x * 0.1, z: (front.a.z + front.b.z) / 2 + n.z * 0.1 };
    if (!pointInRing(ring, mid)) n = { x: -n.x, z: -n.z };
    // Landing anchored at the wall, slid toward the stamp's projection.
    const targetAlong = (target.x - front.a.x) * e.x + (target.z - front.a.z) * e.z;
    const out = [];
    [2, 3].forEach(tTop => {
      const t2 = treads - tTop;
      if (t2 < 1) return;
      const run2 = t2 * runStepFt;
      const topFt = tTop * runStepFt;
      [1, -1].forEach(dirSign => {
        // a: along the wall from the landing's near edge, signed; b: inward.
        const a0 = Math.max(FOLD_EDGE_CLEAR_FT + (dirSign > 0 ? 0 : run2 + landingFt),
          Math.min(elen - FOLD_EDGE_CLEAR_FT - landFt - (dirSign > 0 ? run2 + landingFt : 0),
            targetAlong - landFt / 2));
        const at = (a, b) => ({
          x: front.a.x + e.x * a + n.x * b,
          z: front.a.z + e.z * a + n.z * b,
        });
        const b0 = FOLD_EDGE_CLEAR_FT;
        const rects = [
          [at(a0, b0), at(a0 + landFt, b0), at(a0 + landFt, b0 + landFt), at(a0, b0 + landFt)],
          // top leg: perpendicular, from the landing inward + its clearance
          [at(a0, b0 + landFt), at(a0 + wFin, b0 + landFt),
           at(a0 + wFin, b0 + landFt + topFt + landingFt), at(a0, b0 + landFt + topFt + landingFt)],
          // main flight along the wall + bottom clearance
          [at(a0 + (dirSign > 0 ? landFt : -run2 - landingFt), b0),
           at(a0 + (dirSign > 0 ? landFt + run2 + landingFt : 0), b0),
           at(a0 + (dirSign > 0 ? landFt + run2 + landingFt : 0), b0 + wFin),
           at(a0 + (dirSign > 0 ? landFt : -run2 - landingFt), b0 + wFin)],
        ];
        const centreline = a0 + widthFt / 2 + finishFt / 2;
        const start = at(centreline - widthFt / 2 - finishFt / 2 + wFin / 2, b0 + landFt + topFt);
        const end = at(centreline - widthFt / 2 - finishFt / 2 + wFin / 2, b0 + landFt);
        const first = { x: -n.x, z: -n.z };                    // downhill, toward the wall
        const second = { x: e.x * dirSign, z: e.z * dirSign }; // then along it
        const sRight = -first.z * second.x + first.x * second.z;
        out.push({
          shape: 'L',
          entryL: true,
          splitTreads: tTop,
          start, end,
          turn: sRight > 0 ? 'right' : 'left',
          wellCentre: at(a0 + landFt / 2, b0 + landFt / 2),
          rects,
        });
      });
    });
    return out.filter(cand => {
      cand.well = cand.rects.flat();
      return cand.well.every(pt => pointInRing(ring, pt))
        && cand.rects.every(rect => beamGapOk(rect, lines, opts.gapFt));
    });
  };

  const pointInRing = (ring, pt) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if ((a.z > pt.z) !== (b.z > pt.z)
        && pt.x < a.x + (b.x - a.x) * (pt.z - a.z) / (b.z - a.z)) inside = !inside;
    }
    return inside;
  };

  const beamGapOk = (well, lines, gapFt) => lines.every(line => {
    // Distance from the beam line to the well polygon: the well must not
    // cross the line and must keep the gap.
    const ds = well.map(pt => (pt.x - line.origin.x) * line.n.x + (pt.z - line.origin.z) * line.n.z);
    const lo = Math.min(...ds), hi = Math.max(...ds);
    if (lo < 0 && hi > 0) return false;            // straddles the beam
    return Math.min(Math.abs(lo), Math.abs(hi)) >= gapFt - 0.001;
  });

  // ── The one entry point ──
  // opts: { points, insetFt, beams, stamps, runFt, treads, widthFt,
  //         landingFt=3, landFt, finishIn=1, gapIn=2, uGapIn=4.5,
  //         runStepFt=10/12, softInterior=false,
  //         lowerStair=null, jurisdiction='ca' }
  //
  // Both new inputs are additive. `lowerStair` is the committed stair on
  // the level below and enables the stacking bonus; without it that term
  // is absent. `jurisdiction` picks the DIMENSIONS pack that supplies the
  // width and landing defaults — and only the DEFAULTS, so a caller
  // passing explicit numbers (MODEL always passes widthFt) is untouched
  // by it. The two packs deliberately agree on the landing: 36" satisfies
  // both IRC and NBC, and narrowing it would move every stair that leaves
  // landingFt unset.
  const suggestStair = opts => {
    const pack = rules()?.dimensionsFor?.(opts.jurisdiction) || null;
    const {
      points, insetFt, beams = [], stamps = [],
      runFt, treads,
      widthFt = pack?.defaultWidthFt ?? 3,
      landingFt = pack?.defaultLandingFt ?? 3,
      landFt = 3, finishIn = 1, gapIn = BEAM_EDGE_GAP_IN,
      uGapIn = 4.5, runStepFt = 10 / 12, softInterior = false,
      lowerStair = null,
    } = opts;
    if (!Array.isArray(points) || points.length < 3 || !(runFt > 0)) {
      return { stair: null, report: { straight: 'no footprint or run', L: null, U: null } };
    }
    const ring = geo().offsetOutline(points.map(pt => ({ x: pt.x, z: pt.z })), -insetFt);
    const lines = beamLines(beams);
    const target = circulationTarget(points, stamps);
    const finishFt = finishIn / 12, gapFt = gapIn / 12, uGapFt = uGapIn / 12;
    const common = { runFt, widthFt, landingFt, finishFt, gapFt, landFt, uGapFt, runStepFt };
    const report = { straight: null, L: null, U: null };
    // The score is a COST: lower wins. Every term is recorded as it is
    // added, so the winner can say WHY it won — same arithmetic as
    // before, now with its working shown.
    const score = cand => {
      const terms = [];
      const add = (ruleId, points) => { if (points) terms.push({ ruleId, points }); return points; };
      let s = add('circulationDistance', CIRCULATION_WEIGHT
        * Math.hypot(cand.wellCentre.x - target.point.x, cand.wellCentre.z - target.point.z));
      s += add('bedroomRepel', bedroomPenalty(cand.wellCentre, stamps));
      const edge = Math.min(...cand.well.map(pt => distToRing(pt, ring)));
      cand.wallAdjacent = edge < WALL_ADJACENT_FT;
      if (softInterior && cand.wallAdjacent) s += add('exteriorWallPenalty', EXTERIOR_SOFT_PENALTY); // rule B
      if (cand.entryL) {                                                   // rule A
        s += add('entryLBonus', -ENTRY_L_BONUS);
        s += add('entryStepPenalty', (cand.splitTreads - 2) * ENTRY_STEP_PENALTY);
      }
      s += add('basementStacking', stackingBonus(cand.wellCentre, lowerStair));
      cand.terms = terms;
      return s;
    };
    // The winner explains itself through the rulebook; with no rulebook
    // loaded the raw terms still travel, so the report never goes empty.
    const breakdown = cand => (rules()?.scoreBreakdown
      ? rules().scoreBreakdown(cand, cand.terms || [])
      : (cand.terms || []).filter(term => term.points));
    const pick = list => list.reduce((best, cand) => {
      const s = score(cand);
      return !best || s < best.s ? { cand, s } : best;
    }, null);

    // Straight first (no beam under the trigger → no lines: fall back to
    // the ring's own long axis as a single pseudo-line through the target).
    const effLines = lines.length ? lines : [pseudoLine(ring, target.point)];
    const straight = straightCandidates(ring, effLines, common, target.point);
    // Rule A: in the front-entry zone the entry L competes in the SAME
    // pool as straight — it can win even where a straight run fits.
    const pool = [...straight.candidates];
    if (ENTRY_STAMPS.includes(target.kind)) {
      pool.push(...entryLCandidates(ring, lines, { ...common, treads }, target.point));
    }
    if (pool.length) {
      const best = pick(pool);
      report.rulesFired = breakdown(best.cand);
      return { stair: finish(best.cand, target), report, target: target.kind };
    }
    report.straight = `needs ${(runFt + 2 * landingFt).toFixed(1)}' clear along the beam; longest run is ${straight.longest.toFixed(1)}'`;

    for (const shape of ['L', 'U']) {
      const t1 = Math.max(1, Math.floor((treads - 1) / 2));
      const t2 = Math.max(1, treads - 1 - t1);
      const folds = foldCandidates(ring, lines, { ...common, t1, t2 }, target.point, shape);
      if (folds.candidates.length) {
        const best = pick(folds.candidates);
        report.rulesFired = breakdown(best.cand);
        return { stair: finish(best.cand, target), report, target: target.kind };
      }
      report[shape] = folds.reasons[0] || `no ${shape} corner fits`;
    }
    return { stair: null, report, target: target.kind };
  };

  const finish = (cand, target) => ({
    start: { x: cand.start.x, z: cand.start.z },
    end: { x: cand.end.x, z: cand.end.z },
    shape: cand.shape,
    turn: cand.turn || 'right',
    ...(cand.splitTreads ? { splitTreads: cand.splitTreads } : {}),
    wallAdjacent: cand.wallAdjacent === true,
    wellCentre: cand.wellCentre,
  });

  const pseudoLine = (ring, target) => {
    const xs = ring.map(pt => pt.x), zs = ring.map(pt => pt.z);
    const wide = (Math.max(...xs) - Math.min(...xs)) >= (Math.max(...zs) - Math.min(...zs));
    const dir = wide ? { x: 1, z: 0 } : { x: 0, z: 1 };
    const n = { x: -dir.z, z: dir.x };
    return { origin: { x: target.x, z: target.z }, dir, n, c: target.x * n.x + target.z * n.z };
  };

  window.DraftAutoStair = Object.freeze({
    BEAM_EDGE_GAP_IN,
    BEDROOM_REPEL_FT,
    PULL_STAMPS,
    REPEL_STAMPS,
    suggestStair,
    circulationTarget,
    beamLines,
  });
})();
}
