// THE STRIP FOOTING UNDER THE CONCRETE, AS ONE DASHED OUTLINE.
//
// jb, 16 Nov 2026, on the FOUNDATION plan: "i should actually show the
// dotted line for the footing on the foundation wall. for 8" conc.
// foundation it needs a 20" wide footing so the lines will be 6" from the
// ext and in lines of the foundation wall", then "all 8" conc walls will
// need this 'outline' to show the footing and it can connect on the inside
// and blend we only need the outline", and for ICF "24" footing so will be
// centered on the center of the wall ... try to keep it to 1/2"".
//
// WORKED OUT FROM THE WALLS EVERY PAINT, not stored. BUILD HOUSE writes its
// footing rings as S-FOOTING lines once, and a wall moved or drawn by hand
// afterwards leaves them behind; this follows whatever concrete is there.
//
// HOW: each bearing concrete wall gives a rectangle -- its two faces pushed
// out by the footing's projection, its ends pushed past the end by the same
// (a free end) or out to the far side of the footing of the wall it meets
// (a corner or a T). The OUTLINE is every rectangle edge with the stretches
// that lie inside another rectangle cut away, so where footings meet they
// blend and only the outside and inside edges are left.
if (!window.DraftFootingOutline) {
(() => {
  const EPS = 1e-6;
  const TOUCH_FT = 0.05;
  // The concrete a strip footing sits under. A PT wood foundation stands on
  // gravel, not a poured strip, and a grade beam hung off piles has none.
  const FOOTED_TYPES = ['concrete_8', 'icf', 'icf_13'];
  // The stock 8" CONC + 2X6 BSMT (wall-types.js) stands on a footing under
  // its concrete slice; see concreteBandIn.
  const isFooted = wall => wall && (wall.view || 'plan') === 'foundation'
    && (FOOTED_TYPES.includes(String(wall.wallType || ''))
      || !!(typeof window !== 'undefined' && window.DraftWallTypes?.isStockWallType?.(wall.wallType)))
    && !(Number(wall.baseHeight) > 0.01);

  // The footing's projection past each face, in feet. The OUTSIDE one is a
  // clean 1/2" ("try to keep it to 1/2""), rounded down, and what is left of
  // the footing's width goes to the inside ("adjust to inside a bit"): 8"
  // concrete on 20" is 6" and 6"; 11 1/4" ICF on 24" is 6" out, 6 3/4" in.
  // THE SLICES A STOCK SLICED TYPE SHOWS ON FOUNDATION, as inches from its
  // first face (the low offset), its slices turned round by sliceFlip. Null
  // for every other wall, which bears across its whole width.
  const concreteBandIn = wall => {
    const WT = typeof window !== 'undefined' ? window.DraftWallTypes : null;
    if (!WT?.isStockWallType?.(wall.wallType)) return null;
    const type = WT.wallTypeOf(wall);
    const layers = wall.sliceFlip === true ? [...type.layers].reverse() : type.layers;
    let at = 0, from = null, to = null;
    layers.forEach(layer => {
      if (WT.sliceShows(layer, 'fdn')) { if (from == null) from = at; to = at + layer.in; }
      at += layer.in;
    });
    return from == null || !(to > from) ? null : { from, to };
  };
  const projectionFt = (footingWidthIn, wallIn) => {
    const total = Math.max(0, footingWidthIn - wallIn);
    const out = Math.floor(total / 2 * 2 + 1e-9) / 2;
    return { out: out / 12, in: (total - out) / 12, even: total / 2 / 12 };
  };

  // Which side of a wall the building is on: +1 its n side, -1 the other, 0
  // when neither side is closed in (a stub, a lone wall). Ray parity against
  // the footed walls' own lines, from a foot off the wall's middle.
  const insideSide = (f, frames) => {
    const mid = { x: (f.wall.start.x + f.wall.end.x) / 2, z: (f.wall.start.z + f.wall.end.z) / 2 };
    const enclosed = p => {
      let odd = false;
      frames.forEach(o => {
        const a = o.wall.start, b = o.wall.end;
        if ((a.z > p.z) !== (b.z > p.z)) {
          const x = a.x + (p.z - a.z) * (b.x - a.x) / (b.z - a.z);
          if (x > p.x) odd = !odd;
        }
      });
      return odd;
    };
    const pos = enclosed({ x: mid.x + f.n.x, z: mid.z + f.n.z });
    const neg = enclosed({ x: mid.x - f.n.x, z: mid.z - f.n.z });
    return pos === neg ? 0 : pos ? 1 : -1;
  };

  const frameOf = (wall, totalFt, faceOffsets) => {
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (len < EPS) return null;
    const u = { x: dx / len, z: dz / len }, n = { x: -u.z, z: u.x };
    const { startOff, endOff } = faceOffsets(wall, totalFt);
    return { wall, u, n, len, lo: Math.min(startOff, endOff), hi: Math.max(startOff, endOff) };
  };

  const segDist = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 > EPS ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
  };

  // How far past its end point a wall's footing runs: its own projection at a
  // free end; where another wall meets it, out to the far edge of THAT wall's
  // footing, measured along this wall.
  const reachPast = (f, end, outDir, frames) => {
    let reach = -Infinity;
    frames.forEach(o => {
      if (o === f || segDist(end, o.wall.start, o.wall.end) > TOUCH_FT) return;
      const cos = outDir.x * o.n.x + outDir.z * o.n.z;
      if (Math.abs(cos) < 0.05) return;   // running on in line: they overlap
      // Offsets of the other footing's two edges, against its own line.
      const base = (end.x - o.wall.start.x) * o.n.x + (end.z - o.wall.start.z) * o.n.z;
      [o.lo - o.projLo, o.hi + o.projHi].forEach(edge => {
        const along = (edge - base) / cos;
        if (along > reach) reach = along;
      });
    });
    // A free end (or one running on in line): the footing's own share past it.
    return reach === -Infinity ? f.proj : reach;
  };

  const rectOf = (f, frames) => {
    const back = { x: -f.u.x, z: -f.u.z };
    const r0 = reachPast(f, f.wall.start, back, frames);
    const r1 = reachPast(f, f.wall.end, f.u, frames);
    const at = (along, off) => ({
      x: f.wall.start.x + f.u.x * along + f.n.x * off,
      z: f.wall.start.z + f.u.z * along + f.n.z * off,
    });
    const a0 = -r0, a1 = f.len + r1, o0 = f.lo - f.projLo, o1 = f.hi + f.projHi;
    // Counter-clockwise in (u, n): outward normals point away from the inside.
    return [at(a0, o0), at(a1, o0), at(a1, o1), at(a0, o1)];
  };

  const inside = (p, poly) => {
    // Convex, either winding: strictly on one side of every edge.
    let sign = 0;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const c = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
      if (Math.abs(c) < 1e-9) return false;
      const s = c > 0 ? 1 : -1;
      if (!sign) sign = s; else if (s !== sign) return false;
    }
    return true;
  };

  const crossT = (a, b, c, d) => {
    const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z;
    const den = rx * sz - rz * sx;
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den;
    const v = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
    return t > EPS && t < 1 - EPS && v > -EPS && v < 1 + EPS ? t : null;
  };

  // The outline: every rectangle edge, cut where another rectangle's edge
  // crosses it, keeping the pieces with open ground on their outer side.
  const outlineOf = rects => {
    const out = [];
    rects.forEach((poly, i) => {
      // Winding of this rectangle, for its outward side.
      const area = poly.reduce((s, p, k) => {
        const q = poly[(k + 1) % poly.length];
        return s + (p.x * q.z - q.x * p.z);
      }, 0);
      const w = area > 0 ? 1 : -1;
      poly.forEach((a, k) => {
        const b = poly[(k + 1) % poly.length];
        const ts = [0, 1];
        rects.forEach((other, j) => {
          if (j === i) return;
          other.forEach((c, m) => {
            const t = crossT(a, b, c, other[(m + 1) % other.length]);
            if (t != null) ts.push(t);
            // A corner of the other lying ON this edge cuts it too, so two
            // footings sharing a stretch of edge give the same pieces.
            const l2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
            if (l2 > EPS) {
              const tc = ((c.x - a.x) * (b.x - a.x) + (c.z - a.z) * (b.z - a.z)) / l2;
              const off = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / Math.sqrt(l2);
              if (tc > EPS && tc < 1 - EPS && off < 1e-6) ts.push(tc);
            }
          });
        });
        ts.sort((x, y) => x - y);
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < EPS) return;
        // Outward normal (right of travel on a CCW ring).
        const nx = w * (b.z - a.z) / len, nz = -w * (b.x - a.x) / len;
        for (let s = 0; s < ts.length - 1; s += 1) {
          if (ts[s + 1] - ts[s] < 1e-6) continue;
          const tm = (ts[s] + ts[s + 1]) / 2;
          const mid = { x: a.x + (b.x - a.x) * tm, z: a.z + (b.z - a.z) * tm };
          const outPt = { x: mid.x + nx * 1e-3, z: mid.z + nz * 1e-3 };
          const inPt = { x: mid.x - nx * 1e-3, z: mid.z - nz * 1e-3 };
          // Open ground outside, and not a seam shared with another footing.
          if (rects.some((o, j) => j !== i && (inside(outPt, o) || inside(mid, o)))) continue;
          if (!inside(inPt, poly)) continue;
          out.push({
            start: { x: a.x + (b.x - a.x) * ts[s], z: a.z + (b.z - a.z) * ts[s] },
            end: { x: a.x + (b.x - a.x) * ts[s + 1], z: a.z + (b.z - a.z) * ts[s + 1] },
          });
        }
      });
    });
    // A stretch two footings share is drawn once.
    const key = p => `${p.x.toFixed(4)},${p.z.toFixed(4)}`;
    const seen = new Set();
    const unique = out.filter(seg => {
      const k = [key(seg.start), key(seg.end)].sort().join('|');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // AND ONE LINE PER STRAIGHT RUN, so the dashes run on through the cuts.
    const merged = [];
    const used = new Set();
    const dirOf = sg => {
      const l = Math.hypot(sg.end.x - sg.start.x, sg.end.z - sg.start.z);
      return { x: (sg.end.x - sg.start.x) / l, z: (sg.end.z - sg.start.z) / l };
    };
    const same = (p, q) => Math.abs(p.x - q.x) < 1e-4 && Math.abs(p.z - q.z) < 1e-4;
    unique.forEach((seg, i) => {
      if (used.has(i)) return;
      used.add(i);
      let run = { start: seg.start, end: seg.end };
      const d = dirOf(seg);
      let grew = true;
      while (grew) {
        grew = false;
        unique.forEach((o, j) => {
          if (used.has(j)) return;
          const e = dirOf(o);
          if (Math.abs(d.x * e.z - d.z * e.x) > 1e-6) return;
          const ends = [[o.start, o.end], [o.end, o.start]];
          for (const [p, q] of ends) {
            if (same(p, run.end)) { run = { start: run.start, end: q }; used.add(j); grew = true; return; }
            if (same(q, run.start)) { run = { start: p, end: run.end }; used.add(j); grew = true; return; }
          }
        });
      }
      merged.push(run);
    });
    return merged;
  };

  // walls: the drawing's walls (any level, any view; only the given level's
  //   bearing foundation concrete is used).
  // levelId: the foundation level drawn.
  // levelAssemblies: the drawing's, for a footing width set in PROJECT
  //   (20" when none is; ICF never under 24").
  const footingOutline = ({ walls, levelId, levelAssemblies,
    footingWidthIn = null, wallTotalIn = null, faceOffsets = null }) => {
    const LA = window.DraftLevelAssembly, WT = window.DraftWallTypes, G = window.DraftGeometry2D;
    footingWidthIn = footingWidthIn || (id => (LA && LA.levelAssemblyFor
      ? LA.levelAssemblyFor(levelAssemblies, id).footingWidthIn : null) || 20);
    wallTotalIn = wallTotalIn || (wall => {
      const type = WT && (WT.isCustomWall && WT.isCustomWall(wall) ? WT.wallTypeOf(wall)
        : (WT.WALL_TYPES || []).find(t => t.id === wall.wallType));
      return type ? type.totalIn : 8;
    });
    faceOffsets = faceOffsets || G.wallFaceOffsets;
    const mine = (walls || []).filter(wall => Number(wall.levelId) === Number(levelId) && isFooted(wall));
    if (!mine.length) return [];
    const widthIn = Number(footingWidthIn(levelId)) || 20;
    const frames = mine.map(wall => {
      const totalIn = Number(wallTotalIn(wall)) || 8;
      const band = concreteBandIn(wall);
      const wallIn = band ? band.to - band.from : totalIn;
      // ICF takes 24" whatever the level says for plain concrete.
      const fIn = String(wall.wallType).startsWith('icf') ? Math.max(widthIn, 24) : widthIn;
      const f = frameOf(wall, totalIn / 12, faceOffsets);
      // ONLY THE CONCRETE BEARS: the footing centres under the slices the
      // FOUNDATION plan shows, not under the basement lining beside them.
      if (f && band) { const lo = f.lo; f.lo = lo + band.from / 12; f.hi = lo + band.to / 12; }
      if (f) f.p = projectionFt(fIn, wallIn);
      return f;
    }).filter(f => f && f.p.in > 0);
    frames.forEach(f => {
      const side = insideSide(f, frames);
      f.projHi = side > 0 ? f.p.in : side < 0 ? f.p.out : f.p.even;
      f.projLo = side > 0 ? f.p.out : side < 0 ? f.p.in : f.p.even;
      // Past a free end: the even share.
      f.proj = f.p.even;
    });
    return outlineOf(frames.map(f => rectOf(f, frames)));
  };

  // Dashed, the way a footing under the concrete is shown on a plan.
  const FOOTING_DASH = [6, 4];
  const drawFootingOutline2D = (ctx, toS, segs, { ink = '#1d1f20', alpha = 1 } = {}) => {
    const list = Array.isArray(segs) ? segs : [];
    if (!list.length) return;
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.globalAlpha *= alpha;
    ctx.setLineDash(FOOTING_DASH);
    ctx.beginPath();
    list.forEach(seg => {
      const a = toS(seg.start), b = toS(seg.end);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  window.DraftFootingOutline = Object.freeze({ footingOutline, drawFootingOutline2D, projectionFt, isFooted, concreteBandIn });
})();
}
