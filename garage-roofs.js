// GARAGE ROOFS — one roof over a bungalow and its attached garage, or two.
//
// Movie, 6 Oct: "i increased the HOUSE wall (not GARAGE WALL) the garage wall
// also moved to house height though. they should be different heights", and,
// asked how the roof should behave then: split it -- "if both walls are same
// height exactly they should be ONE roof".
//
// SAME TOP, ONE ROOF. Both tops are measured from MAIN FL, the datum the house
// wall and a garage roof's plateHeightFt are already read from (level-assembly
// garageTopAboveMainFt), so "same height" is a plain comparison.
//
// DIFFERENT TOPS, TWO ROOFS, AND THE LOWER ONE DIES INTO THE TALLER WALL. A
// roof that meets a taller body's wall has no eave there and no board to hang
// one on, so its shared edges are cut flush (gable, zero overhang) -- the same
// rule raiseRoofOver applies to the 2 STOREY's garage. The taller body's roof
// keeps its eaves all round and oversails the lower one, as a taller roof
// does. A shared stretch that is only PART of an edge is made an edge of its
// own first (traced-plans splitAt), so the open-air rest keeps its eave.
//
// Pure: plain { x, z } loops in, plain records out. MODEL.html raises the
// roofs at build time from `roofLoops`; PROJECT.html regroups the roofs
// already built (`regroupRoofs`) when a wall height changes.
if (!window.DraftGarageRoofs) {
(() => {
  const T = () => window.DraftTracedPlans;
  const G = () => window.DraftGeometry2D;
  const LA = () => window.DraftLevelAssembly;

  const ROOF_LEVEL_ID = 7;     // MODEL.html's ROOF_LEVEL_ID
  const MAIN_LEVEL_ID = 3;
  const UPPER_LEVEL_ID = 5;    // 2ND FL
  const SAME_TOP_FT = 1 / 96;  // an eighth of an inch
  // cut-view.js GARAGE_SILL_BELOW_HOUSE_FT / garageSillDropFt: a FROST-WALLED
  // attached garage sits 2 ft under the house sill (level on a split, which
  // never reaches here). garage-roofs-harness holds the two together.
  const FROST_SILL_DROP_FT = 2;

  const sameTop = (a, b) => Math.abs(a - b) < SAME_TOP_FT;

  // The edges of `ring` lying wholly on `other`.
  const edgesOn = (ring, other) => T().edgesOf(ring)
    .filter(e => {
      const on = T().coveredSpans(e, other).reduce((sum, [a, b]) => sum + b - a, 0);
      return Math.abs(on - e.len) < 1e-4;
    })
    .map(e => e.index);

  // The convex hull of a loop: a roof cut must be convex, and a garage loop
  // with its tie notch is not.
  //
  // A SQUARE-CORNERED LOOP TAKES ITS BOUNDING RECTANGLE: the true hull of a
  // notched rectangle runs one edge on a slant across the notch, and a roof
  // edge on a slant is not what a drafter would draw there.
  const hull = loop => {
    const square = loop.every((p, i) => {
      const q = loop[(i + 1) % loop.length];
      return Math.abs(p.x - q.x) < 1e-6 || Math.abs(p.z - q.z) < 1e-6;
    });
    if (square) {
      const xs = loop.map(p => p.x), zs = loop.map(p => p.z);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      return [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
    }
    const pts = loop.map(p => ({ x: p.x, z: p.z }))
      .sort((a, b) => a.x - b.x || a.z - b.z);
    const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
    const lower = [], upper = [];
    pts.forEach(p => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
      lower.push(p);
    });
    pts.slice().reverse().forEach(p => {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
      upper.push(p);
    });
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  };

  // ── WHICH LOOPS GET ROOFED, AND WHICH EDGES DIE INTO A WALL ──────────────
  //
  // `house` and `garage` are the bodies' wall loops. Returns
  //   { merged, house: { ring, flush }, garage: { ring, flush } | null }
  // where `flush` lists the edge indexes cut against the other body.
  const roofLoops = ({ house, garage, houseTopFt, garageTopFt }) => {
    const H = T().clean(house), Gr = T().clean(garage);
    if (sameTop(houseTopFt, garageTopFt)) {
      const one = T().unionLoops(H, Gr);
      if (one) return { merged: true, house: { ring: one, flush: [] }, garage: null };
    }
    // Two roofs. On equal tops that would not join, the garage is the one
    // that dies into the house, as before.
    const garageLower = !(garageTopFt > houseTopFt + SAME_TOP_FT);
    if (garageLower) {
      const ring = T().splitAt(Gr, H);
      return { merged: false,
        house: { ring: H, flush: [] },
        garage: { ring, flush: edgesOn(ring, H) } };
    }
    // A GARAGE TALLER THAN THE HOUSE STANDS UP OUT OF THE HOUSE'S ROOF. Cut
    // flush against it, the house's front became a gable 20 ft wide -- a tall
    // flat face on the side elevation and a ridge bent toward it in plan. So
    // the house keeps its hip, eaves all round, and the garage's footprint is
    // cut out of it (a roof `cut`, geometry-2d cutRoofFaces): the house roof
    // runs into the garage wall wherever it meets it.
    //
    // AND THE GARAGE'S OWN ROOF GOES OVER ITS HULL. Its loop carries the tie's
    // one-foot notch at the house corner, and a 2 ft eave offset off a 1 ft
    // step folds back on itself -- a twisted edge in plan, a step on E4. Over
    // the hull the taller roof simply oversails that corner of the house.
    const box = hull(Gr);
    return { merged: false,
      house: { ring: H, flush: [], cuts: [box] },
      garage: { ring: box, flush: [] } };
  };

  // A roof record's geometry off a ring: the flush edges take no overhang and
  // stand as gables, the rest take the overhang as eaves -- raiseRoofOver's
  // own cut, for the page that has no raiseRoofOver.
  //
  // AND WHERE AN EAVE AND A FLUSH STRETCH SHARE ONE STRAIGHT LINE, A STEP. The
  // lower roof's front is eave where it is open air and flush where the taller
  // wall stands, on the same line; a single corner point cannot be both 2 ft
  // out and on the wall, and geometry-2d's offset answered with a slanted edge
  // running between them. So the corner becomes two points and a short edge
  // between them -- the eave turning in to die into the taller wall, flush
  // itself, since it runs along that wall's line.
  const cutRoof = (ring, flush, overhangFt) => {
    const flat = new Set(flush || []);
    const n = ring.length;
    if (n < 3) return null;
    const d = ring.map((_, i) => (flat.has(i) ? 0 : overhangFt));
    const area = ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % n];
      return sum + (p.x * q.z - q.x * p.z);
    }, 0);
    // Outward normal of a ring wound either way.
    const sign = area > 0 ? 1 : -1;
    const lines = ring.map((a, i) => {
      const b = ring[(i + 1) % n];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
      const nx = sign * uz, nz = -sign * ux;
      return { ax: a.x + nx * d[i], az: a.z + nz * d[i], ux, uz, nx, nz };
    });
    const out = [];   // { p, edge } -- edge: the kind of the edge leaving p
    ring.forEach((v, i) => {
      const prev = lines[(i + n - 1) % n], cur = lines[i];
      const cross = prev.ux * cur.uz - prev.uz * cur.ux;
      const kind = { gable: flat.has(i), over: d[i] };
      if (Math.abs(cross) > 1e-9) {
        const t = ((cur.ax - prev.ax) * cur.uz - (cur.az - prev.az) * cur.ux) / cross;
        out.push({ p: { x: prev.ax + prev.ux * t, z: prev.az + prev.uz * t }, kind });
        return;
      }
      const dPrev = d[(i + n - 1) % n];
      if (Math.abs(dPrev - d[i]) < 1e-9) {
        out.push({ p: { x: v.x + cur.nx * d[i], z: v.z + cur.nz * d[i] }, kind });
        return;
      }
      out.push({ p: { x: v.x + cur.nx * dPrev, z: v.z + cur.nz * dPrev }, kind: { gable: true, over: 0 } });
      out.push({ p: { x: v.x + cur.nx * d[i], z: v.z + cur.nz * d[i] }, kind });
    });
    if (out.some(o => !Number.isFinite(o.p.x) || !Number.isFinite(o.p.z))) return null;
    return {
      points: out.map(o => o.p),
      edges: out.map(o => (o.kind.gable ? 'gable' : 'eave')),
      edgeOverhang: out.map(o => o.kind.over),
    };
  };

  // How far an attached garage's sill sits under the house sill.
  const garageDropFt = (drawing, garageOutline) => {
    if (LA().isSplitType(drawing?.buildType)) return 0;
    const stored = garageOutline?.foundation;
    const cell = drawing?.sectionTable?.rows?.attachedGarage?.garageFoundation;
    const kind = stored || cell || 'gradebeam';
    return kind === 'frostwall' ? FROST_SILL_DROP_FT : 0;
  };

  const garageTopFt = (drawing, garageOutline) =>
    LA().garageTopAboveMainFt(drawing, garageDropFt(drawing, garageOutline));

  // The bodies of a plain house with one attached garage on MAIN FL, or null.
  const bodiesOf = drawing => {
    const main = (drawing?.outlines || [])
      .filter(o => Number(o.levelId) === MAIN_LEVEL_ID && (o.points || []).length >= 3);
    const houses = main.filter(o => o.garage !== true);
    const garages = main.filter(o => o.garage === true && o.detached !== true);
    if (houses.length !== 1 || garages.length !== 1) return null;
    return { house: houses[0], garage: garages[0] };
  };
  // A second storey over any of it makes this a 2 STOREY, whose garage roof
  // is always its own.
  const singleStorey = drawing => !(drawing?.outlines || [])
    .some(o => Number(o.levelId) === UPPER_LEVEL_ID && (o.points || []).length >= 3)
    && !(drawing?.walls || []).some(w => Number(w.levelId) === UPPER_LEVEL_ID);

  // Whether a wall belongs to a DETACHED garage -- its midpoint inside a
  // detached outline -- so the attached garage's height never moves it.
  const inLoop = (p, loop) => {
    let inside = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i], b = loop[j];
      if ((a.z > p.z) !== (b.z > p.z)
        && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };
  const detachedWallTest = drawing => {
    const loops = (drawing?.outlines || [])
      .filter(o => o.detached === true && (o.points || []).length >= 3).map(o => o.points);
    return wall => {
      if (!loops.length || !wall?.start || !wall?.end) return false;
      const mid = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
      // A wall ON the loop has its midpoint on the boundary; nudge toward
      // each side and call it detached if either lands inside.
      const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
      const len = Math.hypot(dx, dz) || 1;
      const n = { x: -dz / len * 0.05, z: dx / len * 0.05 };
      return loops.some(loop => inLoop({ x: mid.x + n.x, z: mid.z + n.z }, loop)
        || inLoop({ x: mid.x - n.x, z: mid.z - n.z }, loop));
    };
  };

  // ── AND THE ROOFS ALREADY BUILT, REGROUPED ───────────────────────────────
  //
  // Called by PROJECT.html when the house or garage wall height changed in a
  // save. A bungalow gets its house and garage roofs cut again from the two
  // wall loops -- one roof if the tops now match, two if they differ -- with
  // the house roof keeping its id, roofing and corner style. A 2 STOREY only
  // moves its garage roofs to the garage's new plate. Null when nothing
  // changed, so the caller leaves the roofs key alone.
  const regroupRoofs = drawing => {
    const L = LA();
    if (!drawing || L.isSplitType(drawing.buildType)) return null;
    const bodies = bodiesOf(drawing);
    if (!bodies) return null;
    const roofs = Array.isArray(drawing.roofs) ? drawing.roofs : [];
    const topG = garageTopFt(drawing, bodies.garage);
    const isGarageRoof = r => L.roofFollows(r) === 'attachedGarage';

    if (!singleStorey(drawing)) {
      let moved = false;
      const next = roofs.map(r => {
        if (!isGarageRoof(r) || sameTop(Number(r.plateHeightFt), topG)) return r;
        moved = true;
        return { ...r, plateHeightFt: topG };
      });
      return moved ? next : null;
    }

    const houseRoof = roofs.find(r => L.roofFollows(r) === 'house');
    if (!houseRoof) return null;
    const plan = roofLoops({
      house: bodies.house.points, garage: bodies.garage.points,
      houseTopFt: L.houseWallTopFt(drawing), garageTopFt: topG,
    });
    const houseNums = L.projectRoofFor(drawing, 'house');
    const houseCut = cutRoof(plan.house.ring, plan.house.flush, houseNums.overhangFt);
    if (!houseCut) return null;
    const { cuts, ...houseKeep } = houseRoof;
    const next = roofs.filter(r => r !== houseRoof && !isGarageRoof(r));
    next.push({ ...houseKeep, ...houseCut, overhang: houseNums.overhangFt,
      pitch: houseNums.pitch, garage: false, follows: 'house',
      ...(plan.house.cuts ? { cuts: plan.house.cuts.map(points => ({ points })) } : {}) });
    if (plan.garage) {
      const garageNums = L.projectRoofFor(drawing, 'attachedGarage');
      const garageCut = cutRoof(plan.garage.ring, plan.garage.flush, garageNums.overhangFt);
      if (!garageCut) return null;
      const was = roofs.find(isGarageRoof);
      next.push({
        id: was?.id || `${houseRoof.id}-garage`,
        levelId: ROOF_LEVEL_ID,
        sourceLevelId: MAIN_LEVEL_ID,
        sourceShapeId: null,
        ...garageCut,
        overhang: garageNums.overhangFt,
        pitch: garageNums.pitch,
        fascia: houseRoof.fascia,
        garage: true,
        plateHeightFt: topG,
        follows: 'attachedGarage',
        ...(was?.roofing ? { roofing: was.roofing } : houseRoof.roofing ? { roofing: houseRoof.roofing } : {}),
        layer: 'A-ROOF',
      });
    }
    const key = list => JSON.stringify(list.map(r => [r.id, r.points, r.edges, r.plateHeightFt]));
    return key(next) === key(roofs) ? null : next;
  };

  window.DraftGarageRoofs = Object.freeze({
    SAME_TOP_FT,
    FROST_SILL_DROP_FT,
    hull,
    roofLoops,
    cutRoof,
    garageDropFt,
    garageTopFt,
    bodiesOf,
    singleStorey,
    detachedWallTest,
    regroupRoofs,
  });
})();
}
