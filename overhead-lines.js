// THE OVERHEAD LINES ON A WALLS PLAN -- what hangs over this floor from the
// storey above and the roof, drawn dashed and lighter.
//
// Movie, 16 Oct (MAIN FL PLAN sheet 7): "anything above the cut is drawn
// lighter weight with a dash-dot line ... Also under it: a cantilever of
// the floor above and a roof overhang, drawn dashed and lighter ... A floor
// shows only what sits DIRECTLY over it: on a 2-storey the 2ND FL shows the
// roof overhang (dashed, lighter); MAIN shows the 2nd floor's cantilevers
// and any roof covering main-floor area (lower roof over a one-storey wing,
// garage roof, porch roof). Nothing two storeys up."
//
// PURE, like door-bucks.js: handed the outlines, the roofs, the storey
// ladder and the level, it answers with segments in plan feet. Which ink and
// which dash is the painter's (render-2d drawOverheadLines2D); which level
// is being drawn is the page's.
//
// THE ONE RULE UNDER BOTH: a line is overhead where it lies OUTSIDE this
// level's own outlines. The floor above's outline inside this floor's is
// the wall under it, already drawn; outside, it is a cantilever. A roof's
// eave line inside the walls is the plate the roof plan draws; outside, it
// is the overhang. So every edge of an upper loop is clipped against this
// level's loops and only the parts outside survive. A level with no
// outlines at all has nothing to be outside of, so an upper outline draws
// nothing there and a roof draws whole.
//
// WHICH ROOF COVERS WHICH FLOOR: the roof's sourceLevelId when it names a
// storey on the ladder (a garage roof is filed against the garage's floor,
// a MOD BILEVEL's upper roof against OVER GARAGE); a roof naming none is
// the main roof, over the top storey that has outlines. Nothing is ever
// read two storeys up: a floor sees the outline one rung above it and the
// roofs filed to itself, and no more.
if (!window.DraftOverheadLines) {
(() => {
  // On-the-line counts as inside: an upper edge lying along a lower edge is
  // the wall under it, not a cantilever of nothing.
  const EDGE_TOL_FT = 0.05;

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
  const pt = p => ({ x: num(p?.x), z: num(p?.z) });
  const loopOf = points => (Array.isArray(points) ? points.map(pt) : [])
    .filter(p => p.x !== null && p.z !== null);

  const insideRing = (ring, x, z) => {
    let on = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i], b = ring[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) on = !on;
    }
    return on;
  };
  const distToSeg = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
  };
  const onRing = (ring, p) => ring.some((a, i) => distToSeg(p, a, ring[(i + 1) % ring.length]) <= EDGE_TOL_FT);
  const covered = (loops, p) => loops.some(ring => insideRing(ring, p.x, p.z) || onRing(ring, p));

  // Where the segment a->b crosses an edge of any lower loop, as parameters
  // along a->b; the ends themselves; and sorted.
  const crossings = (a, b, loops) => {
    const ts = [0, 1];
    const bx = b.x - a.x, bz = b.z - a.z;
    loops.forEach(ring => ring.forEach((c, i) => {
      const d = ring[(i + 1) % ring.length];
      const dx = d.x - c.x, dz = d.z - c.z;
      const den = bx * dz - bz * dx;
      if (Math.abs(den) < 1e-10) return;
      const t = ((c.x - a.x) * dz - (c.z - a.z) * dx) / den;
      const u = ((c.x - a.x) * bz - (c.z - a.z) * bx) / den;
      if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
    }));
    return [...new Set(ts.map(t => Math.round(t * 1e6) / 1e6))].sort((lo, hi) => lo - hi);
  };

  // THE PARTS OF A CLOSED LOOP'S EDGES THAT LIE OUTSIDE EVERY LOWER LOOP, as
  // {start, end} segments. Each edge is cut at every crossing and each piece
  // is kept or dropped by where its middle sits.
  const outsideSegments = (points, lowerLoops) => {
    const ring = loopOf(points);
    if (ring.length < 3) return [];
    const lower = (Array.isArray(lowerLoops) ? lowerLoops : []).map(loopOf).filter(r => r.length >= 3);
    const out = [];
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-9) return;
      if (!lower.length) { out.push({ start: { ...a }, end: { ...b } }); return; }
      const ts = crossings(a, b, lower);
      for (let k = 0; k + 1 < ts.length; k += 1) {
        const t0 = ts[k], t1 = ts[k + 1];
        if (t1 - t0 < 1e-6) continue;
        const at = t => ({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) });
        if (!covered(lower, at((t0 + t1) / 2))) out.push({ start: at(t0), end: at(t1) });
      }
    });
    return out;
  };

  const loopsOn = (outlines, levelId, { garages = true } = {}) => (Array.isArray(outlines) ? outlines : [])
    .filter(outline => Number(outline?.levelId) === Number(levelId) && outline.site !== true
      && (garages || outline.garage !== true)
      && Array.isArray(outline.points) && outline.points.length >= 3)
    .map(outline => outline.points);

  // WHICH FLOOR A ROOF COVERS: its sourceLevelId if that is a rung of the
  // ladder, else the top rung that has outlines.
  const roofLevelOf = (roof, ladder, outlines) => {
    const src = num(roof?.sourceLevelId);
    if (src !== null && ladder.includes(src)) return src;
    for (let i = ladder.length - 1; i >= 0; i -= 1) if (loopsOn(outlines, ladder[i]).length) return ladder[i];
    return null;
  };

  // `ladder`: the floor levels low to high (layer-views floorLevels' ids),
  // already thinned to full storeys by the caller if it wants half levels
  // left out. `levelId`: the plan being drawn.
  const overheadLines = ({ levelId, ladder = [], outlines = [], roofs = [] } = {}) => {
    const id = num(levelId);
    const rungs = (Array.isArray(ladder) ? ladder : []).map(Number).filter(Number.isFinite);
    const own = loopsOn(outlines, id);
    const at = rungs.indexOf(id);
    const above = at >= 0 && at + 1 < rungs.length ? rungs[at + 1] : null;
    // NO OUTLINES, NO CANTILEVER: there is nothing to be outside of, and the
    // whole floor above drawn dashed over a plan would be a second plan.
    // A GARAGE NEVER HANGS: it stands on its own slab beside the house, so
    // the garage outline on the storey above is not read as a cantilever
    // over this one (the basement does not sit under the garage).
    const cantilevers = above === null || !own.length ? []
      : loopsOn(outlines, above, { garages: false }).flatMap(points => outsideSegments(points, own));
    const overhangs = (Array.isArray(roofs) ? roofs : [])
      .filter(roof => Array.isArray(roof?.points) && roof.points.length >= 3
        && roofLevelOf(roof, rungs, outlines) === id)
      .flatMap(roof => outsideSegments(roof.points, own));
    return { cantilevers, overhangs };
  };

  window.DraftOverheadLines = Object.freeze({ overheadLines, outsideSegments, roofLevelOf, EDGE_TOL_FT });
})();
}
