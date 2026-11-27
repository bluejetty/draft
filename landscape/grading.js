// THE GRADING ARITHMETIC -- landscape/grading.js, part of RUFF LANDSCAPE /
// ROUGH LANDSCAPE (jb, 27 Nov 2026). No page, no canvas: points in, surface,
// contours, slopes and warnings out, so a spec can ask it questions without
// drawing anything.
//
// The frame is the drafter's own: x and z are plan feet, exactly as the
// .draft stores them, and y is height in feet with MAIN FL at 0 -- the same
// frame the levels' `elev` and cut-view's foundation grade use. The page adds
// the drawing's datum (0 or 100) when it SHOWS a number, never when it
// stores one.
//
// THE SURFACE IS A TIN: every spot elevation, every house corner and every
// lot corner joined into triangles (Delaunay), each triangle a flat plane.
// That is how a grading plan is drawn by hand -- straight-line interpolation
// between known spots -- so the contours it gives are the ones a drafter
// would draw, and a slope arrow is one triangle's fall.
//
// window.DraftGrading is the module's handle.
(function () {
  'use strict';

  // ── THE RULES THE WARNINGS CHECK ────────────────────────────────────────
  //
  // FALL AWAY FROM THE HOUSE: IRC R401.3 -- the ground falls at least 6" in
  // the first 10 ft out from the foundation (5%). Where the lot line is
  // closer than 10 ft the same 5% is asked over what there is (the code
  // then wants a swale; the warning says so).
  // TOO STEEP: 3 horizontal to 1 vertical (33%) is the usual most a mowed
  // slope or an unretained bank is drawn at.
  // TOO FLAT: under 2% grass holds water.
  const RULES = Object.freeze({
    fallFt: 0.5,
    fallRunFt: 10,
    fallPct: 5,
    steepPct: 100 / 3,
    flatPct: 2,
  });

  const EPS = 1e-9;

  // ── DELAUNAY (Bowyer-Watson) ────────────────────────────────────────────
  //
  // A few hundred points at most on a lot, so the plain O(n^2) build is
  // instant and has nothing in it to get wrong. Returns triangles as index
  // triples into `pts`, counter-clockwise in x/z.
  function triangulate(pts) {
    const n = pts.length;
    if (n < 3) return [];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    pts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    const d = Math.max(maxX - minX, maxZ - minZ, 1) * 20;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const all = pts.map(p => ({ x: p.x, z: p.z }));
    all.push({ x: cx - d, z: cz - d }, { x: cx + d, z: cz - d }, { x: cx, z: cz + d });
    const circum = (a, b, c) => {
      const A = all[a], B = all[b], C = all[c];
      const D = 2 * (A.x * (B.z - C.z) + B.x * (C.z - A.z) + C.x * (A.z - B.z));
      if (Math.abs(D) < EPS) return { x: 0, z: 0, r2: Infinity };
      const a2 = A.x * A.x + A.z * A.z, b2 = B.x * B.x + B.z * B.z, c2 = C.x * C.x + C.z * C.z;
      const x = (a2 * (B.z - C.z) + b2 * (C.z - A.z) + c2 * (A.z - B.z)) / D;
      const z = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D;
      return { x, z, r2: (A.x - x) ** 2 + (A.z - z) ** 2 };
    };
    let tris = [{ v: [n, n + 1, n + 2], c: circum(n, n + 1, n + 2) }];
    for (let i = 0; i < n; i += 1) {
      const p = all[i];
      const bad = [], keep = [];
      tris.forEach(t => {
        const dx = p.x - t.c.x, dz = p.z - t.c.z;
        (dx * dx + dz * dz < t.c.r2 - EPS ? bad : keep).push(t);
      });
      // The hole's boundary: edges of the bad triangles not shared by two.
      const edges = new Map();
      bad.forEach(t => {
        for (let k = 0; k < 3; k += 1) {
          const a = t.v[k], b = t.v[(k + 1) % 3];
          const key = a < b ? `${a},${b}` : `${b},${a}`;
          if (edges.has(key)) edges.set(key, null); else edges.set(key, [a, b]);
        }
      });
      tris = keep;
      edges.forEach(e => {
        if (!e) return;
        tris.push({ v: [e[0], e[1], i], c: circum(e[0], e[1], i) });
      });
    }
    return tris
      .filter(t => t.v.every(k => k < n))
      .map(t => {
        const [a, b, c] = t.v;
        const A = pts[a], B = pts[b], C = pts[c];
        const cross = (B.x - A.x) * (C.z - A.z) - (B.z - A.z) * (C.x - A.x);
        if (Math.abs(cross) < EPS) return null;
        return cross > 0 ? [a, b, c] : [a, c, b];
      })
      .filter(Boolean);
  }

  // ── POLYGON HELPERS ─────────────────────────────────────────────────────
  function inside(pt, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i], b = poly[j];
      if ((a.z > pt.z) !== (b.z > pt.z)
        && pt.x < (b.x - a.x) * (pt.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
    }
    return hit;
  }
  const area = poly => poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return s + p.x * q.z - q.x * p.z;
  }, 0) / 2;

  // ── THE SURFACE ─────────────────────────────────────────────────────────
  //
  // `points`: [{ x, z, y }] -- every known height. `holes`: polygons the
  // ground does not run through (the house), whose triangles are kept for
  // the arithmetic but marked so nothing is drawn or warned on them.
  function buildSurface(points, { holes = [] } = {}) {
    // Two spots on one place would make a sliver: the later one wins.
    const seen = new Map();
    points.forEach(p => {
      if (![p.x, p.z, p.y].every(Number.isFinite)) return;
      seen.set(`${Math.round(p.x * 100)},${Math.round(p.z * 100)}`, p);
    });
    const pts = [...seen.values()];
    const tris = triangulate(pts).map(v => {
      const [A, B, C] = v.map(k => pts[k]);
      // The plane y = a x + b z + c through the three corners.
      const det = (B.x - A.x) * (C.z - A.z) - (C.x - A.x) * (B.z - A.z);
      const a = ((B.y - A.y) * (C.z - A.z) - (C.y - A.y) * (B.z - A.z)) / det;
      const b = ((C.y - A.y) * (B.x - A.x) - (B.y - A.y) * (C.x - A.x)) / det;
      const centre = { x: (A.x + B.x + C.x) / 3, z: (A.z + B.z + C.z) / 3 };
      const slopePct = Math.hypot(a, b) * 100;
      const inHole = holes.some(h => inside(centre, h));
      // A SLIVER -- three points nearly in a line, as along a lot line --
      // still carries heights, but its own tilt is noise: no arrow, no
      // warning. Under half a foot across at its thinnest.
      const longest = Math.max(Math.hypot(B.x - A.x, B.z - A.z), Math.hypot(C.x - B.x, C.z - B.z), Math.hypot(A.x - C.x, A.z - C.z));
      const sliver = Math.abs(det) / (longest || 1) < 0.5;
      return { v, pts: [A, B, C], a, b, centre, slopePct, inHole, sliver,
        // Downhill, in plan: against the gradient.
        down: slopePct > EPS ? { x: -a / Math.hypot(a, b), z: -b / Math.hypot(a, b) } : null };
    });
    return { pts, tris, holes };
  }

  // Height at a plan point, or null off the surface.
  function heightAt(surface, pt) {
    for (const t of surface.tris) {
      const [A, B, C] = t.pts;
      const d1 = (pt.x - B.x) * (A.z - B.z) - (A.x - B.x) * (pt.z - B.z);
      const d2 = (pt.x - C.x) * (B.z - C.z) - (B.x - C.x) * (pt.z - C.z);
      const d3 = (pt.x - A.x) * (C.z - A.z) - (C.x - A.x) * (pt.z - A.z);
      const neg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
      const pos = d1 > EPS || d2 > EPS || d3 > EPS;
      if (neg && pos) continue;
      return A.y + t.a * (pt.x - A.x) + t.b * (pt.z - A.z);
    }
    return null;
  }

  // ── CONTOURS ────────────────────────────────────────────────────────────
  //
  // Every `interval` feet (in the SHOWN numbers, so with a 100.00 datum the
  // lines fall on 99.00, 100.00, ... and not on 0.37 past them). Each
  // triangle a level crosses gives one straight piece; pieces on the house
  // are left out. `major` every fifth line, the way they are inked heavier.
  function contours(surface, interval = 1, datum = 0) {
    if (!(interval > 0) || !surface.tris.length) return [];
    let lo = Infinity, hi = -Infinity;
    surface.pts.forEach(p => { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); });
    const out = [];
    const first = Math.ceil((lo + datum) / interval - EPS);
    const last = Math.floor((hi + datum) / interval + EPS);
    if (last - first > 2000) return out;
    for (let k = first; k <= last; k += 1) {
      const shown = k * interval;
      const level = shown - datum;
      const segs = [];
      surface.tris.forEach(t => {
        const hits = [];
        for (let e = 0; e < 3; e += 1) {
          const P = t.pts[e], Q = t.pts[(e + 1) % 3];
          if ((P.y - level) * (Q.y - level) > 0 || P.y === Q.y) continue;
          const f = (level - P.y) / (Q.y - P.y);
          if (f < -EPS || f > 1 + EPS) continue;
          hits.push({ x: P.x + (Q.x - P.x) * f, z: P.z + (Q.z - P.z) * f });
        }
        // A level through a corner hits two edges at one place: keep two
        // distinct points or none.
        const uniq = hits.filter((h, i) => hits.findIndex(o => Math.hypot(o.x - h.x, o.z - h.z) < 1e-6) === i);
        // Left out where it crosses the house: tested on the piece, not the
        // triangle, so a big triangle reaching over the house still draws
        // its line on the ground either side.
        if (uniq.length === 2) {
          const mid = { x: (uniq[0].x + uniq[1].x) / 2, z: (uniq[0].z + uniq[1].z) / 2 };
          if (!surface.holes.some(h => inside(mid, h))) segs.push(uniq);
        }
      });
      if (segs.length) {
        const majorEvery = interval * 5;
        out.push({ shown, level, segs,
          major: Math.abs(shown / majorEvery - Math.round(shown / majorEvery)) < 1e-6 });
      }
    }
    return out;
  }

  // ── WARNINGS ────────────────────────────────────────────────────────────
  //
  // `house`: the footprint polygons. Each wall of each is walked every
  // `stepFt`; at each stop the ground 10 ft straight out (or to the lot line
  // when that is nearer) must sit at least 5% lower than the ground at the
  // wall. Returns the stops that fail, each with what it found.
  function fallChecks(surface, house, lot, { stepFt = 4 } = {}) {
    const fails = [];
    let checked = 0;
    house.forEach(poly => {
      const ccw = area(poly) > 0;
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.5) continue;
        const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
        // Outward normal: right of the edge on a counter-clockwise ring.
        const out = ccw ? { x: u.z, z: -u.x } : { x: -u.z, z: u.x };
        const stops = Math.max(1, Math.round(len / stepFt));
        for (let s = 0; s < stops; s += 1) {
          const t = (s + 0.5) / stops;
          const at = { x: a.x + u.x * len * t + out.x * 0.05, z: a.z + u.z * len * t + out.z * 0.05 };
          if (house.some(h => h !== poly && inside(at, h))) continue;
          const y0 = heightAt(surface, at);
          if (y0 == null) continue;
          // As far out as 10 ft, the lot and the other house pieces allow.
          let run = RULES.fallRunFt;
          for (let r = 0.5; r <= RULES.fallRunFt; r += 0.5) {
            const p = { x: at.x + out.x * r, z: at.z + out.z * r };
            if ((lot && !inside(p, lot)) || house.some(h => inside(p, h))) { run = r - 0.5; break; }
          }
          if (run < 1) continue;
          const far = { x: at.x + out.x * run, z: at.z + out.z * run };
          const y1 = heightAt(surface, far);
          if (y1 == null) continue;
          checked += 1;
          const need = run * RULES.fallPct / 100;
          const fall = y0 - y1;
          // A hundredth of a foot (1/8") of slack: spots are typed to two places.
          if (fall + 0.01 < need) fails.push({ at, far, runFt: run, fallFt: fall, needFt: need, short: run < RULES.fallRunFt - EPS });
        }
      }
    });
    return { fails, checked };
  }

  function slopeWarnings(surface) {
    const steep = [], flat = [];
    surface.tris.forEach(t => {
      if (t.inHole || t.sliver) return;
      if (t.slopePct > RULES.steepPct + 1e-6) steep.push(t);
      else if (t.slopePct < RULES.flatPct - 1e-6) flat.push(t);
    });
    return { steep, flat };
  }

  // ── WHAT A NEW FILE STARTS WITH ─────────────────────────────────────────
  //
  // A lot corner nobody has set yet falls away from the house: 6" in the
  // first 10 ft, then 2.5% on to the corner (over the 2% a lawn needs).
  // That is a sensible first look with no warnings, and each corner is a
  // spot the drafter can retype.
  function defaultCornerHeight(houseGrade, distFt) {
    const d = Math.max(0, distFt);
    if (d <= RULES.fallRunFt) return houseGrade - d * RULES.fallPct / 100;
    return houseGrade - RULES.fallFt - (d - RULES.fallRunFt) * 0.025;
  }

  // THE RING 10 FT OUT. Straight-line ground from the house corners to lot
  // corners 40 ft away cannot hold a 6"-in-10' fall and then flatten out:
  // one triangle is one slope. So a new file also gets the spots a drafter
  // would set by hand -- out from each wall end and each outside corner,
  // 10 ft off the house at 6" below it -- pulled in to the lot line where
  // the lot is closer, at the same 5% over what there is.
  function ringSpots(house, lot, grade) {
    const out = [];
    const run = RULES.fallRunFt;
    house.forEach(poly => {
      const ccw = area(poly) > 0;
      const n = poly.length;
      const normal = (a, b) => {
        const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const u = { x: (b.x - a.x) / L, z: (b.z - a.z) / L };
        return ccw ? { x: u.z, z: -u.x } : { x: -u.z, z: u.x };
      };
      for (let i = 0; i < n; i += 1) {
        const prev = poly[(i - 1 + n) % n], at = poly[i], next = poly[(i + 1) % n];
        const n1 = normal(prev, at), n2 = normal(at, next);
        const dirs = [n1, n2];
        // An outside corner (the ring turns the same way as the house) gets
        // its diagonal too, so the corner's triangle is not a long sliver.
        const turn = (at.x - prev.x) * (next.z - at.z) - (at.z - prev.z) * (next.x - at.x);
        if ((turn > 0) === ccw) {
          const d = { x: n1.x + n2.x, z: n1.z + n2.z };
          const L = Math.hypot(d.x, d.z);
          if (L > 1e-6) dirs.push({ x: d.x / L, z: d.z / L });
        }
        dirs.forEach(dir => {
          let reach = run;
          for (let r = 0.25; r <= run + 1e-9; r += 0.25) {
            const p = { x: at.x + dir.x * r, z: at.z + dir.z * r };
            if ((lot && !inside(p, lot)) || house.some(h => inside(p, h))) { reach = r - 0.25; break; }
          }
          if (reach < 1) return;
          const p = { x: at.x + dir.x * reach, z: at.z + dir.z * reach };
          if (out.some(o => Math.hypot(o.x - p.x, o.z - p.z) < 2)) return;
          out.push({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100,
            // Rounded DOWN to the hundredth: a spot written 1/8" high of the rule
            // would fail the very check it was set to pass.
            y: Math.floor((grade - reach * RULES.fallPct / 100) * 100 + 1e-9) / 100 });
        });
      }
    });
    return out;
  }

  // Distance from a point to the nearest edge of any of the polygons.
  function distToPolys(pt, polys) {
    let best = Infinity;
    polys.forEach(poly => poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const L2 = dx * dx + dz * dz;
      const t = L2 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.z - a.z) * dz) / L2)) : 0;
      best = Math.min(best, Math.hypot(pt.x - a.x - dx * t, pt.z - a.z - dz * t));
    }));
    return best;
  }

  // ── THE BLOCK THE .draft CARRIES ────────────────────────────────────────
  //
  // `landscape` on the drawing. The drafter never reads it and carries it
  // through untouched (model/17-boot-save.js builds the drawing by spreading
  // the file), so deleting this program leaves the key sitting quietly in
  // the file and nothing else changes.
  //
  //   { version: 1,
  //     spots: [{ id, x, z, y, kind: 'fg' | 'eg', lotCorner?: true }],
  //     houseCorners: { '<outlineId>:<index>': y },  // overrides only
  //     interval: 1 }
  function normalize(raw) {
    const num = v => (v === null || v === '' || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
    const src = raw && typeof raw === 'object' ? raw : {};
    const spots = (Array.isArray(src.spots) ? src.spots : []).map(s => {
      const x = num(s?.x), z = num(s?.z), y = num(s?.y);
      if (x === null || z === null || y === null) return null;
      return { id: String(s.id || '').trim() || null, x, z, y,
        kind: s.kind === 'eg' ? 'eg' : 'fg', ...(s.lotCorner === true ? { lotCorner: true } : {}) };
    }).filter(Boolean);
    let next = 1;
    const used = new Set(spots.map(s => s.id).filter(Boolean));
    spots.forEach(s => { if (!s.id) { while (used.has(`s${next}`)) next += 1; s.id = `s${next}`; used.add(s.id); } });
    const houseCorners = {};
    if (src.houseCorners && typeof src.houseCorners === 'object') {
      Object.entries(src.houseCorners).forEach(([k, v]) => { if (num(v) !== null) houseCorners[k] = num(v); });
    }
    const interval = [0.5, 1, 2, 5].includes(Number(src.interval)) ? Number(src.interval) : 1;
    return { version: 1, spots, houseCorners, interval };
  }

  // Feet as typed: 100.5, 100'-6", 100' 6", -1'-2 1/2", 6" -- to decimal feet.
  function parseFeet(text) {
    const s = String(text || '').trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
    if (!s) return null;
    if (/^[+-]?\d*\.?\d+$/.test(s)) return Number(s);
    const m = s.match(/^([+-])?\s*(?:(\d+(?:\.\d+)?)\s*')?\s*-?\s*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*"?)?$/);
    if (!m || (m[2] == null && m[3] == null)) return null;
    const ft = Number(m[2] || 0);
    const inch = Number(m[3] || 0) + (m[4] && m[5] ? Number(m[4]) / Number(m[5]) : 0);
    const v = ft + inch / 12;
    return m[1] === '-' ? -v : v;
  }

  window.DraftGrading = {
    RULES, triangulate, buildSurface, heightAt, contours, fallChecks, slopeWarnings,
    defaultCornerHeight, ringSpots, distToPolys, inside, area, normalize, parseFeet,
  };
})();
