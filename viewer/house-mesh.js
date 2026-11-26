// HOUSE MESH -- a saved drawing turned into plain 3D faces, and nothing else.
//
// jb, 25 Nov 2026: a separate 3D VIEWER that opens a .draft (or a SAVE AS
// ZIP) and builds the house. The 2D drafter never loads this file or
// anything else in viewer/ -- delete the folder and every 2D page still works.
//
// ONE LIST OF FACES, TWO PAINTERS. Everything the viewer shows or exports is
// built here first as plain polygons in feet: { pts: [{x,y,z}...], kind,
// colour, twoSided }. y is up; x and z are the plan's own axes. No 3D
// library is touched here, so jb's PC with no graphics card (no WebGL) gets
// the very same house from the plain-canvas painter, and the exporters
// (Phase 5) read this list rather than a three.js scene.
//
// IT ASKS THE DRAFTER, NEVER RE-DERIVES. The heights come from the same
// level stack every elevation and section is drawn from
// (DraftCutView.sectionLevelStack over DraftCutViewEnv.buildCutViewEnv), the
// roof planes from geometry-2d.js's skeleton and faces, a wall's thickness
// and reference side from wall-types.js. Fix a roof once and both programs
// see it -- RD-DOCUMENTS/RULING-a-ported-rule-keeps-one-home.md.
//
// PHASE 1: walls on every storey, the garage on its own plate, foundation
// walls and footings, floor decks and slabs, and the roof planes. PHASE 2:
// gable-end walls and fascia. PHASE 3: doors and windows cut through the
// walls (glass and door panels in them), stairs, decks at their own height,
// and holograms stood where the plan puts them.
(function () {
  'use strict';
  if (window.DraftHouseMesh) return;

  const COLOURS = Object.freeze({
    wall: [226, 220, 205],
    garageWall: [214, 208, 192],
    foundation: [168, 168, 164],
    footing: [140, 140, 136],
    floor: [196, 164, 120],
    slab: [184, 184, 178],
    roof: [96, 92, 90],
    gable: [226, 220, 205],
    fascia: [238, 236, 228],
    glass: [138, 178, 204],
    door: [150, 106, 72],
    overhead: [232, 232, 226],
    deck: [176, 150, 116],
    stair: [190, 156, 112],
    landing: [182, 148, 104],
    drywall: [238, 236, 230],
    beam: [158, 124, 86],
    post: [150, 118, 82],
  });
  // WHAT EACH EXTERIOR FINISH LOOKS LIKE (wall-types.js EXTERIOR_FINISHES and
  // the fascia's PFM). The drafter's own colour (finishColor, a band's
  // color) wins over these -- Movie, 27 Sep: "we don't have 3d Window yet so
  // COLOR won't show anywhere yet". It shows here.
  const FINISH_COLOURS = Object.freeze({
    stucco: [232, 224, 204], siding_v_bb: [208, 202, 184], siding_h: [214, 218, 214],
    shake: [168, 136, 100], ledgestone: [172, 160, 140], ashlar: [196, 186, 166],
    roundstone: [164, 158, 148], fieldstone: [152, 142, 126], brick: [166, 88, 66],
    pfm: [240, 240, 236],
  });
  // What a hologram's faces are mixed toward, by its file's colour (the same
  // order as hologram.js COLOURS: blue first). A suite keeps the house's own.
  const HOLO_TINTS = Object.freeze([
    [82, 151, 218], [222, 140, 60], [84, 178, 104], [186, 96, 196],
    [206, 182, 48], [56, 176, 176], [214, 92, 92],
  ]);

  const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  const hexRgb = hex => {
    const v = parseInt(String(hex).slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };

  // ── A WALL'S BODY IN PLAN ──────────────────────────────────────────────
  // The stored line is the wall's REFERENCE line, not its centre: 'left'
  // keeps the body on the +normal side (-dz, dx), 'right' on the other, and
  // an OFFSET FROM LINE moves the whole body (wall-types.js). The same rule
  // cut-view.js's sectionWallCrossings reads.
  function wallFrame(wall, thickFt) {
    const a = wall.start, b = wall.end;
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (!(len > 1e-6)) return null;
    const ux = dx / len, uz = dz / len;
    const nx = -uz, nz = ux;
    const WT = window.DraftWallTypes;
    const ref = wall.refLine || 'center';
    const shift = (WT && WT.wallLineShiftFt ? WT.wallLineShiftFt(wall) : 0);
    const mid = (ref === 'left' ? thickFt / 2 : ref === 'right' ? -thickFt / 2 : 0) + shift;
    // A centre-line wall meets its neighbour at the centre, so each end runs
    // on half a thickness to close the corner. A face-line wall already
    // meets at the face: no stretch, or the corner would poke out.
    const ext = ref === 'center' ? thickFt / 2 : 0;
    const lo = mid - thickFt / 2, hi = mid + thickFt / 2;
    // `t` is feet along the stored line from its start -- the same measure a
    // door's or window's `offset` is kept in -- and `off` feet across it.
    const p = (t, off) => ({ x: a.x + ux * t + nx * off, z: a.z + uz * t + nz * off });
    const at = (t, off, y) => ({ x: a.x + ux * t + nx * off, y, z: a.z + uz * t + nz * off });
    return { p, at, t0: -ext, t1: len + ext, lo, hi, len, u: { x: ux, z: uz }, n: { x: nx, z: nz } };
  }
  function wallFootprint(wall, thickFt) {
    const f = wallFrame(wall, thickFt);
    if (!f) return null;
    return [f.p(f.t0, f.lo), f.p(f.t1, f.lo), f.p(f.t1, f.hi), f.p(f.t0, f.hi)];
  }

  // Signed area in plan (x, z), for winding.
  const planArea = ring => ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p.x * q.z - q.x * p.z;
  }, 0) / 2;

  // A plan ring stood between two heights: top, bottom and one quad per side,
  // every face wound so its normal points OUT of the solid.
  function prism(ring, bottom, top, kind, colour, out) {
    if (!ring || ring.length < 3 || !(top - bottom > 1e-4)) return;
    // Counter-clockwise seen from above (+y) -- in x/z with y up that is a
    // NEGATIVE planArea, because z runs toward the viewer.
    const r = planArea(ring) > 0 ? ring.slice().reverse() : ring.slice();
    const up = r.map(p => ({ x: p.x, y: top, z: p.z }));
    const down = r.slice().reverse().map(p => ({ x: p.x, y: bottom, z: p.z }));
    out.push({ pts: up, kind, colour });
    out.push({ pts: down, kind, colour });
    for (let i = 0; i < r.length; i += 1) {
      const p = r[i], q = r[(i + 1) % r.length];
      out.push({ pts: [
        { x: p.x, y: bottom, z: p.z }, { x: q.x, y: bottom, z: q.z },
        { x: q.x, y: top, z: q.z }, { x: p.x, y: top, z: p.z },
      ], kind, colour });
    }
  }

  // A ring pulled in by `d` feet, each corner along its own bisector (the
  // two neighbouring edges moved in and crossed). A floor deck stops a hair
  // inside the walls' outside face: the two would otherwise lie in one plane
  // and flicker through each other on WebGL.
  function insetRing(ring, d) {
    const n = ring.length;
    if (n < 3) return ring;
    const sign = planArea(ring) > 0 ? 1 : -1;   // which side is inside
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const p0 = ring[(i + n - 1) % n], p1 = ring[i], p2 = ring[(i + 1) % n];
      const e1 = { x: p1.x - p0.x, z: p1.z - p0.z }, e2 = { x: p2.x - p1.x, z: p2.z - p1.z };
      const l1 = Math.hypot(e1.x, e1.z) || 1, l2 = Math.hypot(e2.x, e2.z) || 1;
      // Inward normals: for a positive-area ring in (x, z), inside is left.
      const n1 = { x: -e1.z / l1 * sign, z: e1.x / l1 * sign }, n2 = { x: -e2.z / l2 * sign, z: e2.x / l2 * sign };
      const bx = n1.x + n2.x, bz = n1.z + n2.z;
      const cos = (bx * n1.x + bz * n1.z);
      const bl = Math.hypot(bx, bz);
      if (bl < 1e-6 || cos < 0.2) { out.push({ x: p1.x + n2.x * d, z: p1.z + n2.z * d }); continue; }
      const k = d / cos;   // along (bx, bz), which is n1 + n2
      out.push({ x: p1.x + bx * k / 1, z: p1.z + bz * k / 1 });
    }
    return out;
  }

  function thicknessFt(wall, fallbackIn) {
    const WT = window.DraftWallTypes;
    let type = null;
    try { type = WT && WT.wallTypeOf ? WT.wallTypeOf(wall) : null; } catch (e) { type = null; }
    return (type && type.totalIn ? type.totalIn : fallbackIn) / 12;
  }

  // ── PHASE 3: A WALL WITH ITS DOORS AND WINDOWS CUT THROUGH ─────────────
  //
  // A face turned so its normal points along `outward` (any vector), its
  // seams kept on the same edges when the corners are turned round.
  function facing(pts, outward, kind, colour, seams, out, twoSided) {
    let p = pts, sm = seams || null;
    const n = normalOf(p);
    if (n.x * outward.x + n.y * outward.y + n.z * outward.z < 0) {
      const k = p.length;
      p = p.slice().reverse();
      // Reversed, new edge i joins old corners k-1-i and k-2-i: old edge k-2-i.
      if (sm) sm = p.map((_, i) => !!seams[((k - 2 - i) % k + k) % k]);
    }
    const face = { pts: p, kind, colour };
    if (sm && sm.some(Boolean)) face.seams = sm;
    if (twoSided) face.twoSided = true;
    out.push(face);
  }

  // The wall body between `bottom` and `top`, less its openings. `holes` are
  // { t0, t1, y0, y1, type } in the frame's own measure (feet along the line,
  // feet up). The wall is cut into upright columns at every jamb: a plain
  // column is the full height, an opening's column keeps what is under its
  // sill and over its head. Each long face is those pieces, joined at seams
  // the painters do not ink, so it reads as one face with holes in it; the
  // jambs, sill and head are the reveals you see into the thickness.
  // `paint`, when given, colours the two long faces: { lo, hi } are each a
  // function from a height to a colour (a wall's finish and its bands on an
  // outside face, drywall inside), and `cuts` the heights where a band
  // starts or stops, so each colour is its own piece with a line between.
  function wallWithOpenings(frame, bottom, top, holes, kind, colour, out, counts, paint) {
    if (!frame || !(top - bottom > 1e-4)) return;
    const { at, t0: T0, t1: T1 } = frame;
    let { lo, hi } = frame;
    if (PRINT && hi - lo < PRINT.minFt) {
      const c = (lo + hi) / 2;
      lo = c - PRINT.minFt / 2; hi = c + PRINT.minFt / 2;
    }
    const fits = (holes || []).map(h => ({
      ...h, t0: Math.max(h.t0, T0 + 0.02), t1: Math.min(h.t1, T1 - 0.02),
      y0: Math.max(h.y0, bottom), y1: Math.min(h.y1, top),
    })).filter(h => h.t1 - h.t0 > 0.05 && h.y1 - h.y0 > 0.05).sort((x, y) => x.t0 - y.t0);
    // Two openings that overlap (a drafting slip) keep the first.
    const keep = [];
    fits.forEach(h => { if (!keep.length || h.t0 >= keep[keep.length - 1].t1 + 0.01) keep.push(h); });
    if (PRINT) {
      // Print: a closed box for each piece of wall; the openings stay open.
      let t = T0;
      const box = (a, b, y0, y1) => {
        if (b - a > 1e-4 && y1 - y0 > 1e-4) wallBox(at, frame.u, frame.n, a, b, lo, hi, y0, y1, kind, colour, out);
      };
      keep.forEach(h => {
        box(t, h.t0, bottom, top);
        box(h.t0, h.t1, bottom, h.y0);
        box(h.t0, h.t1, h.y1, top);
        t = h.t1;
        if (counts) { if (h.type === 'window') counts.windows += 1; else counts.doors += 1; }
      });
      box(t, T1, bottom, top);
      return;
    }
    if (!keep.length) {
      if (!paint) {
        prism([frame.p(T0, lo), frame.p(T1, lo), frame.p(T1, hi), frame.p(T0, hi)], bottom, top, kind, colour, out);
        return;
      }
    }
    const cols = [];
    let t = T0;
    keep.forEach(h => {
      if (h.t0 > t + 1e-6) cols.push({ a: t, b: h.t0, hole: null });
      cols.push({ a: h.t0, b: h.t1, hole: h });
      t = h.t1;
    });
    if (T1 > t + 1e-6) cols.push({ a: t, b: T1, hole: null });
    const spans = c => (c.hole
      ? [[bottom, c.hole.y0], [c.hole.y1, top]].filter(([y0, y1]) => y1 - y0 > 1e-4)
      : [[bottom, top]]);
    const u = frame.u, n = frame.n;
    const atEnd = v => Math.abs(v - T0) < 1e-9 || Math.abs(v - T1) < 1e-9;
    // The two long faces.
    const cuts = paint && Array.isArray(paint.cuts) ? paint.cuts.filter(y => y > bottom + 1e-4 && y < top - 1e-4) : [];
    [{ off: lo, dir: { x: -n.x, y: 0, z: -n.z }, tint: paint && paint.lo },
      { off: hi, dir: { x: n.x, y: 0, z: n.z }, tint: paint && paint.hi }].forEach(side => {
      cols.forEach(c => spans(c).forEach(([s0, s1]) => {
        const ys = [s0, ...cuts.filter(y => y > s0 + 1e-4 && y < s1 - 1e-4).sort((a, b) => a - b), s1];
        for (let i = 0; i + 1 < ys.length; i += 1) {
          const y0 = ys[i], y1 = ys[i + 1];
          const col = side.tint ? side.tint((y0 + y1) / 2) : colour;
          facing([at(c.a, side.off, y0), at(c.b, side.off, y0), at(c.b, side.off, y1), at(c.a, side.off, y1)],
            side.dir, kind, col, [false, !atEnd(c.b), false, !atEnd(c.a)], out);
        }
      }));
    });
    // Top and bottom, under each column that reaches them.
    cols.forEach(c => {
      const sp = spans(c);
      if (sp.some(([, y1]) => Math.abs(y1 - top) < 1e-6)) {
        facing([at(c.a, lo, top), at(c.b, lo, top), at(c.b, hi, top), at(c.a, hi, top)],
          { x: 0, y: 1, z: 0 }, kind, colour, [false, !atEnd(c.b), false, !atEnd(c.a)], out);
      }
      if (sp.some(([y0]) => Math.abs(y0 - bottom) < 1e-6)) {
        facing([at(c.a, lo, bottom), at(c.b, lo, bottom), at(c.b, hi, bottom), at(c.a, hi, bottom)],
          { x: 0, y: -1, z: 0 }, kind, colour, [false, !atEnd(c.b), false, !atEnd(c.a)], out);
      }
    });
    // The two ends.
    [[T0, -1], [T1, 1]].forEach(([tt, sg]) => {
      facing([at(tt, lo, bottom), at(tt, hi, bottom), at(tt, hi, top), at(tt, lo, top)],
        { x: u.x * sg, y: 0, z: u.z * sg }, kind, colour, null, out);
    });
    // Each opening: its reveals, and what fills it.
    const mid = (lo + hi) / 2;
    keep.forEach(h => {
      facing([at(h.t0, lo, h.y0), at(h.t0, hi, h.y0), at(h.t0, hi, h.y1), at(h.t0, lo, h.y1)],
        { x: u.x, y: 0, z: u.z }, kind, colour, null, out);
      facing([at(h.t1, lo, h.y0), at(h.t1, hi, h.y0), at(h.t1, hi, h.y1), at(h.t1, lo, h.y1)],
        { x: -u.x, y: 0, z: -u.z }, kind, colour, null, out);
      if (h.y0 > bottom + 1e-6) {
        facing([at(h.t0, lo, h.y0), at(h.t1, lo, h.y0), at(h.t1, hi, h.y0), at(h.t0, hi, h.y0)],
          { x: 0, y: 1, z: 0 }, kind, colour, null, out);
      }
      if (h.y1 < top - 1e-6) {
        facing([at(h.t0, lo, h.y1), at(h.t1, lo, h.y1), at(h.t1, hi, h.y1), at(h.t0, hi, h.y1)],
          { x: 0, y: -1, z: 0 }, kind, colour, null, out);
      }
      // Glass in a window, a slab in a door: one sheet down the middle of
      // the wall, seen from both sides.
      const fill = h.type === 'window' ? ['glass', COLOURS.glass]
        : h.type === 'overhead' ? ['overhead', COLOURS.overhead] : ['door', COLOURS.door];
      const pane = [at(h.t0, mid, h.y0), at(h.t1, mid, h.y0), at(h.t1, mid, h.y1), at(h.t0, mid, h.y1)];
      out.push({ pts: pane, kind: fill[0], colour: fill[1], twoSided: true });
      if (counts) {
        if (h.type === 'window') counts.windows += 1; else counts.doors += 1;
      }
    });
  }

  // ── THE BUILD ──────────────────────────────────────────────────────────
  // `saved` is the parsed .draft. Returns { faces, stack, counts, bounds }.
  // `opts.levels` stands the drawing on other levels than its own (a suite
  // on its shell's floors); `opts.inner` builds a hologram's drawing, which
  // brings no holograms of its own (hologram.js drawn() has flattened them).
  // ── PHASE 6: THE PRINT BUILD ───────────────────────────────────────────
  //
  // build(saved, { print: { minFt } }) makes the house for a 3D printer
  // instead of the screen: every part a CLOSED solid a slicer can fill.
  // Walls are boxes, one for each piece between and over and under the
  // openings (the screen's walls share faces across a jamb, which leaves
  // edges a slicer reads as holes); glass and door slabs are left out, so
  // the openings print open; a roof plane becomes a slab under its top
  // surface; and a wall or roof thinner than `minFt` is thickened to it
  // (the thinnest a nozzle lays down, in feet at the model's scale).
  // Holograms build inside the same call, so they print the same way.
  let PRINT = null;
  const PRINT_ROOF_FT = 4 / 12;   // a printed roof slab: sheathing and rafters, about 4"
  function build(saved, opts = {}) {
    const before = PRINT;
    if (!opts.inner) PRINT = opts.print && opts.print.minFt >= 0 ? opts.print : null;
    try { return buildHouse(saved, opts); } finally { PRINT = before; }
  }

  // A closed box from a wall frame: along the line a..b, across lo..hi,
  // up y0..y1. Six faces, each turned out.
  function wallBox(at, u, n, a, b, lo, hi, y0, y1, kind, colour, out) {
    facing([at(a, lo, y0), at(b, lo, y0), at(b, lo, y1), at(a, lo, y1)], { x: -n.x, y: 0, z: -n.z }, kind, colour, null, out);
    facing([at(a, hi, y0), at(b, hi, y0), at(b, hi, y1), at(a, hi, y1)], { x: n.x, y: 0, z: n.z }, kind, colour, null, out);
    facing([at(a, lo, y1), at(b, lo, y1), at(b, hi, y1), at(a, hi, y1)], { x: 0, y: 1, z: 0 }, kind, colour, null, out);
    facing([at(a, lo, y0), at(b, lo, y0), at(b, hi, y0), at(a, hi, y0)], { x: 0, y: -1, z: 0 }, kind, colour, null, out);
    facing([at(a, lo, y0), at(a, hi, y0), at(a, hi, y1), at(a, lo, y1)], { x: -u.x, y: 0, z: -u.z }, kind, colour, null, out);
    facing([at(b, lo, y0), at(b, hi, y0), at(b, hi, y1), at(b, lo, y1)], { x: u.x, y: 0, z: u.z }, kind, colour, null, out);
  }

  // A sheet (a roof plane) made a slab: its own face on top, the same face
  // `th` feet under it along its normal, and the sides between.
  function sheetSlab(pts, th, kind, colour, out) {
    let top = pts;
    let n = normalOf(top);
    if (n.y < 0) { top = top.slice().reverse(); n = { x: -n.x, y: -n.y, z: -n.z }; }
    const under = top.map(p => ({ x: p.x - n.x * th, y: p.y - n.y * th, z: p.z - n.z * th }));
    out.push({ pts: top, kind, colour });
    out.push({ pts: under.slice().reverse(), kind, colour });
    for (let i = 0; i < top.length; i += 1) {
      const j = (i + 1) % top.length;
      const e = { x: top[j].x - top[i].x, y: top[j].y - top[i].y, z: top[j].z - top[i].z };
      const outward = { x: e.y * n.z - e.z * n.y, y: e.z * n.x - e.x * n.z, z: e.x * n.y - e.y * n.x };
      facing([top[i], top[j], under[j], under[i]], outward, kind, colour, null, out);
    }
  }

  function buildHouse(saved, opts) {
    const format = window.DraftDrawingFormat;
    const CV = window.DraftCutView;
    const G = window.DraftGeometry2D;
    if (!format || !CV || !G || !window.DraftCutViewEnv) throw new Error('The drafter modules did not load.');
    if (window.DraftWallTypes && window.DraftWallTypes.adoptDrawing) window.DraftWallTypes.adoptDrawing(saved);
    const levels = opts.levels || format.levels(saved.levels);
    const env = window.DraftCutViewEnv.buildCutViewEnv(saved, levels);
    const stack = CV.sectionLevelStack(env);
    const faces = [];
    const counts = { walls: 0, foundationWalls: 0, floors: 0, roofs: 0, gables: 0, fascia: 0,
      windows: 0, doors: 0, stairs: 0, decks: 0, holograms: 0, beams: 0, posts: 0 };
    if (!stack) return { faces, stack: null, counts, groups: [], bounds: boundsOf(faces) };

    const fdn = stack.foundation;
    const levelById = {};
    stack.floors.forEach(level => { levelById[level.id] = level; });
    const plateFt = 1.5 / 12;

    // Where a garage's own roof bears -- the top of that garage's walls, as
    // the elevations stand them (cut-view.js elevationFaces).
    const garageCache = {};
    const garageRoofBase = new Map();
    const roofBaseFor = garage => {
      if (!garageRoofBase.has(garage)) {
        const roof = env.roofs().find(r => {
          const g = CV.garageOfRoof(r, env);
          if (g !== undefined) return !!g && CV.sameGarageBody(g, garage);
          const pts = r.points || [];
          if (r.garage !== true || pts.length < 3) return false;
          const mid = { x: pts.reduce((s, q) => s + q.x, 0) / pts.length, z: pts.reduce((s, q) => s + q.z, 0) / pts.length };
          return G.pointInLoop ? !!G.pointInLoop(mid, garage.points || []) : false;
        });
        garageRoofBase.set(garage, roof ? CV.roofBaseElev(roof, stack, env) : null);
      }
      return garageRoofBase.get(garage);
    };

    // ── THE OPENINGS IN EACH WALL ─────────────────────────────────────────
    // Heights as the elevations stand them (cut-view.js drawElevationView):
    // a window from its floor + sill to floor + head, a door from the floor
    // (on a 1/2" threshold; an OVERHEAD door seals to the slab) to the head,
    // the head never above the wall's top. A garage wall's floor is the
    // garage's bearing on its lowest storey, and a garage door stands on the
    // slab where it is.
    const HEAD_FT = 6 + 10 / 12, SILL_FT = 3;
    const THRESHOLD_FT = ((CV.STANDARDS && CV.STANDARDS.DOOR_THRESHOLD_IN) || 0.5) / 12;
    const fenByWall = new Map();
    (env.fenestrations ? env.fenestrations() : []).forEach(f => {
      if (!f || f.wallId == null) return;
      const key = String(f.wallId);
      if (!fenByWall.has(key)) fenByWall.set(key, []);
      fenByWall.get(key).push(f);
    });
    const holesFor = (wall, floor, top, garage) => (fenByWall.get(String(wall.id)) || []).map(f => {
      const width = num(f.width);
      if (!(width > 0)) return null;
      const head = f.headHeight > 0 ? f.headHeight : HEAD_FT;
      const sill = f.sillHeight > 0 ? f.sillHeight : SILL_FT;
      let y0 = floor + sill;
      if (f.type === 'door') {
        let stands = floor;
        if (garage) {
          try {
            const at = CV.garageFloorAt(env, fdn, garage, CV.doorPoint(wall, f));
            if (Number.isFinite(at)) stands = at;
          } catch (e) { stands = floor; }
        }
        y0 = stands + (f.garage ? 0 : THRESHOLD_FT);
      }
      const c = num(f.offset);
      return { t0: c - width / 2, t1: c + width / 2, y0, y1: Math.min(floor + head, top),
        type: f.type === 'door' ? (f.garage ? 'overhead' : 'door') : 'window' };
    }).filter(Boolean);
    // A garage's lowest storey, where its walls bear on the garage's own
    // foundation (cut-view.js bearsOnGarage).
    const garageGround = [];
    env.walls().forEach(wall => {
      const storey = wall && levelById[wall.levelId];
      if (!storey || (wall.view || 'plan') !== 'plan' || !wall.start || !wall.end) return;
      const garage = CV.garageOfWall(wall, env, garageCache);
      if (!garage) return;
      const at = garageGround.find(g => CV.sameGarageBody(g.garage, garage));
      if (!at) garageGround.push({ garage, floorTop: storey.floorTop });
      else if (storey.floorTop < at.floorTop) at.floorTop = storey.floorTop;
    });
    const bearsOnGarage = (garage, storey) => {
      const at = garageGround.find(g => CV.sameGarageBody(g.garage, garage));
      return !at || storey.floorTop <= at.floorTop + 0.01;
    };

    // ── WHICH LEVEL EACH FACE BELONGS TO, for the viewer's level chips:
    // 'fdn' (foundation, basement and slabs), 'L<id>' for a storey, 'roof'.
    const mark = (from, group) => {
      for (let i = from; i < faces.length; i += 1) if (!faces[i].group) faces[i].group = group;
    };

    // ── WHAT EACH WALL WEARS ──────────────────────────────────────────────
    // Outside, its finish (wall-types.js finishAtFt, bands and all, measured
    // from the same three lines the elevations clad to: the sill, the plate
    // and the head); inside, drywall. The outside is the side away from every
    // room its level's walls close (geometry-2d.js roomLoops); a wall with
    // rooms on neither side, or on both, wears its finish on both faces only
    // when it was given one.
    const WT = window.DraftWallTypes;
    const loopsByLevel = new Map();
    const loopsOn = (levelId, view) => {
      const key = `${levelId}/${view}`;
      if (!loopsByLevel.has(key)) {
        let loops = [];
        try {
          const own = env.walls().filter(w => w && w.levelId === levelId && (w.view || 'plan') === view && w.start && w.end);
          loops = G.roomLoops ? G.roomLoops(own).map(l => l.points) : [];
        } catch (e) { loops = []; }
        loopsByLevel.set(key, loops);
      }
      return loopsByLevel.get(key);
    };
    const finishColour = (id, own) => {
      if (typeof own === 'string' && /^#[0-9a-f]{6}$/i.test(own)) return hexRgb(own);
      return FINISH_COLOURS[id] || FINISH_COLOURS.stucco;
    };
    const paintFor = (wall, frame, bottom, top, plate) => {
      if (!frame || !WT || !WT.finishAtFt) return null;
      const loops = loopsOn(wall.levelId, wall.view || 'plan');
      const mid = (frame.t0 + frame.t1) / 2;
      const inside = off => loops.some(pts => G.pointInLoop(frame.p(mid, off), pts));
      const inLo = inside(frame.lo - 0.4), inHi = inside(frame.hi + 0.4);
      const given = !!(wall.finish || wall.finishColor || (wall.finishBands && wall.finishBands.length));
      let outLo = !inLo, outHi = !inHi;
      if (outLo === outHi) { outLo = given || outLo; outHi = given || outHi; }
      const lines = { sill: bottom, plate, head: top };
      const outside = y => { const f = WT.finishAtFt(wall, y, lines); return finishColour(f.id, f.color); };
      const cuts = [];
      (wall.finishBands || []).forEach(band => {
        const r = WT.bandRange ? WT.bandRange(band, lines) : null;
        if (r) cuts.push(r.lo, r.hi);
      });
      return { lo: outLo ? outside : () => COLOURS.drywall, hi: outHi ? outside : () => COLOURS.drywall, cuts };
    };

    // ── WALLS ─────────────────────────────────────────────────────────────
    env.walls().forEach(wall => {
      if (!wall || !wall.start || !wall.end || wall.levelId < 0) return;
      const n0 = faces.length;
      wallOne(wall);
      mark(n0, (wall.view || 'plan') === 'foundation' || wall.levelId === 1 ? 'fdn' : `L${wall.levelId}`);
    });
    function wallOne(wall) {
      const view = wall.view || 'plan';
      if (view === 'foundation') {
        const garage = CV.garageOfWall(wall, env, garageCache);
        const top = garage ? fdn.wallBottom + num(wall.topHeight, 8)
          : Math.min(fdn.wallBottom + num(wall.topHeight, 8), fdn.wallTop - plateFt);
        const bottom = fdn.wallBottom + num(wall.baseHeight);
        const t = thicknessFt(wall, 8);
        // A door drawn in a foundation wall (a detached garage's frost wall)
        // is cut down to the slab it closes onto.
        wallWithOpenings(wallFrame(wall, t), bottom, top, holesFor(wall, bottom, top, garage),
          'foundation', COLOURS.foundation, faces, counts);
        // The strip footing under a wall that bears on one (base at 0).
        if (num(wall.baseHeight) <= 0.01) {
          const wide = Math.max(t, num(fdn.footingWidthIn, 20) / 12);
          const centred = { ...wall, refLine: 'center', offsetFt: 0 };
          const ring = wallFootprint(centred, wide);
          // Shifted to sit under the wall's own centre.
          const body = wallFootprint(wall, t);
          if (ring && body) {
            const cx = (body[0].x + body[2].x) / 2 - (ring[0].x + ring[2].x) / 2;
            const cz = (body[0].z + body[2].z) / 2 - (ring[0].z + ring[2].z) / 2;
            prism(ring.map(p => ({ x: p.x + cx, z: p.z + cz })), fdn.footingBottom, bottom,
              'footing', COLOURS.footing, faces);
          }
        }
        counts.foundationWalls += 1;
        return;
      }
      // A basement wall (FOUNDATION level, plan view) stands on the slab.
      if (wall.levelId === 1) {
        const bottom = fdn.slabTop;
        const top = Math.min(bottom + num(wall.topHeight, 8), fdn.wallTop);
        const frame = wallFrame(wall, thicknessFt(wall, 5.5));
        wallWithOpenings(frame, bottom, top, holesFor(wall, bottom, top, null), 'wall', COLOURS.wall, faces, counts,
          paintFor(wall, frame, bottom, top, top));
        counts.walls += 1;
        return;
      }
      const storey = levelById[wall.levelId];
      if (!storey) return;
      const garage = CV.garageOfWall(wall, env, garageCache);
      let top = storey.floorTop + num(wall.topHeight, storey.wallTop - storey.floorTop);
      let bottom;
      if (garage) {
        const plate = roofBaseFor(garage);
        if (plate != null) top = plate;
        bottom = CV.faceSillFt(env, { level: storey, garage }, stack);
      } else {
        // Down over the floor package (and the sill plate on the first
        // storey), as the cladding runs on the elevations.
        bottom = CV.faceSillFt(env, { level: storey, garage: null }, stack);
      }
      let floor = storey.floorTop + (wall.hoodOf ? Math.max(0, num(wall.baseHeight)) : 0);
      if (garage && bearsOnGarage(garage, storey)) {
        try { const b = CV.garageBearing(env, fdn, garage); if (Number.isFinite(b)) floor = b; } catch (e) { /* keep the storey's */ }
      }
      const frame = wallFrame(wall, thicknessFt(wall, 5.5));
      wallWithOpenings(frame, bottom, top, holesFor(wall, floor, top, garage),
        garage ? 'garageWall' : 'wall', garage ? COLOURS.garageWall : COLOURS.wall, faces, counts,
        paintFor(wall, frame, bottom, top, Math.min(top, storey.wallTop)));
      counts.walls += 1;
    }

    // ── FLOORS AND SLABS ─────────────────────────────────────────────────
    // A DECK stands its own floor type's depth (2x10 + 3/4"), its top a
    // little under its storey's floor (geometry-2d.js deckSpec, jb 20 Nov).
    let deckSet = new Set();
    try { deckSet = new Set(G.deckFloors ? G.deckFloors(env.floors(), env.walls()) : []); } catch (e) { deckSet = new Set(); }
    env.floors().forEach(floor => {
      const n0 = faces.length;
      floorOne(floor);
      mark(n0, floor && (floor.view === 'foundation' || floor.levelId === 1) ? 'fdn' : `L${floor && floor.levelId}`);
    });
    function floorOne(floor) {
      const pts = (floor && floor.points) || [];
      if (pts.length < 3 || floor.levelId < 0) return;
      const ring = pts.map(p => ({ x: p.x, z: p.z }));
      let garage = null;
      try { garage = CV.garageOfFloor(floor, env); } catch (e) { garage = null; }
      // A garage slab filed on the FOUNDATION level has no garage outline on
      // its own level to match; the flag says it is a garage's, and the
      // outline round its middle says whose.
      if (!garage && floor.garage === true) {
        const mid = { x: ring.reduce((s, p) => s + p.x, 0) / ring.length, z: ring.reduce((s, p) => s + p.z, 0) / ring.length };
        [3, 2, 1, 5].some(id => {
          garage = (env.garageOutlines(id) || []).find(g => G.pointInLoop(mid, g.points || [])) || null;
          return !!garage;
        });
      }
      if (floor.view === 'foundation' || floor.levelId === 1 || floor.structure === 'slab') {
        let top = null;
        if (garage) { try { top = CV.garageSlabTop(env, fdn, garage); } catch (e) { top = null; } }
        if (Number.isFinite(top)) {
          prism(ring, top - 4 / 12, top, 'slab', COLOURS.slab, faces);
        } else {
          prism(ring, fdn.slabTop - fdn.slabIn / 12, fdn.slabTop, 'slab', COLOURS.slab, faces);
        }
        counts.floors += 1;
        return;
      }
      const storey = levelById[floor.levelId];
      if (!storey) return;
      if (deckSet.has(floor)) {
        const spec = G.deckSpec(floor);
        const top = storey.floorTop - spec.dropFt;
        prism(ring, top - spec.thickFt, top, 'deck', COLOURS.deck, faces);
        counts.decks += 1;
        counts.floors += 1;
        return;
      }
      if (garage || floor.garage === true) {
        let top = storey.floorTop;
        try { if (garage) top = CV.garageSlabTop(env, fdn, garage); } catch (e) { top = storey.floorTop; }
        prism(ring, top - 4 / 12, top, 'slab', COLOURS.slab, faces);
      } else {
        prism(insetRing(ring, 0.02), storey.floorBottom, storey.floorTop, 'floor', COLOURS.floor, faces);
      }
      counts.floors += 1;
    }

    // ── ROOFS ────────────────────────────────────────────────────────────
    const roofFrom = faces.length;
    const solved = [];
    env.roofs().forEach(roof => {
      if (!roof || !Array.isArray(roof.points) || roof.points.length < 3 || roof.levelId < 0) return;
      let list = [];
      try { list = G.roofFaces(roof, G.roofSkeleton(roof)) || []; } catch (e) { list = []; }
      const eave = CV.roofEaveElev(roof, stack, env);
      list.forEach(face => {
        const poly = face.points || [];
        if (poly.length < 3) return;
        const pts = poly.map(p => ({ x: p.x, y: eave + G.roofFaceRise(face, p, roof.pitch || 4), z: p.z }));
        if (PRINT) sheetSlab(pts, Math.max(PRINT.minFt, PRINT_ROOF_FT), 'roof', COLOURS.roof, faces);
        else faces.push({ pts, kind: 'roof', colour: COLOURS.roof, twoSided: true });
      });
      if (list.length) {
        counts.roofs += 1;
        solved.push({ roof, list, eave, base: CV.roofBaseElev(roof, stack, env) });
      }
    });
    solved.forEach(item => dressRoof(item, solved, G, faces, counts));
    mark(roofFrom, 'roof');

    // ── BEAMS AND POSTS ──────────────────────────────────────────────────
    const beamFrom = faces.length;
    buildFraming(saved, env, stack, levelById, levels, faces, counts);
    for (let i = beamFrom; i < faces.length; i += 1) if (!faces[i].group) faces[i].group = faces[i].groupHint || 'fdn';

    // ── STAIRS ───────────────────────────────────────────────────────────
    const SG = window.DraftStairGeometry;
    if (SG) env.stairs().forEach(stair => {
      const n0 = faces.length;
      let group = null;
      try { group = buildStair(stair, stack, levelById, SG, faces); } catch (e) { group = null; /* a stair that will not solve is left out */ }
      if (group) { counts.stairs += 1; mark(n0, group); }
    });

    // ── HOLOGRAMS ────────────────────────────────────────────────────────
    if (!opts.inner) buildHolograms(saved, faces, counts);

    const groups = [{ id: 'fdn', name: 'FOUNDATION' },
      ...stack.floors.slice().sort((a, b) => a.floorTop - b.floorTop).map(l => ({
        id: `L${l.id}`, name: ((levels.find(v => v.id === l.id) || {}).name || `LEVEL ${l.id}`).toUpperCase() })),
      { id: 'roof', name: 'ROOF' }].filter(g => faces.some(f => f.group === g.id));
    return { faces, stack, counts, groups, bounds: boundsOf(faces) };
  }

  // ── A STAIR, TREAD BY TREAD ─────────────────────────────────────────────
  //
  // Filed on the floor it goes DOWN from (stair-geometry.js stairDescent):
  // it starts at that storey's floor and lands on the storey below it, or on
  // the basement slab under the lowest. The plan parts (stairPlanParts) give
  // each flight's centre line, direction walking down and width, and each
  // landing's outline; stairSequence gives the order they come in. Every
  // tread is one riser lower than the last; a flat landing is one riser, a
  // landing of winders as many risers as it has winders. The upper floor is
  // the top tread, so the first tread already stands one riser down.
  function buildStair(stair, stack, levelById, SG, out) {
    if (!stair || !stair.start || !stair.end) return false;
    const storey = levelById[stair.levelId];
    if (!storey) return false;
    const below = stack.floors.filter(l => l.floorTop < storey.floorTop - 0.01)
      .sort((a, b) => b.floorTop - a.floorTop)[0];
    const landOn = below ? below.floorTop : stack.foundation.slabTop;
    // It stands in the room it comes down into, so it shows with that level.
    const group = below ? `L${below.id}` : 'fdn';
    const riseFt = storey.floorTop - landOn;
    if (!(riseFt > 0.2)) return false;
    const layout = SG.stairCurrentLayout(stair, { floors: [], riseFtFor: () => ({ riseFt }) });
    const parts = SG.stairPlanParts(stair, layout);
    if (!parts || !parts.runs || !parts.runs.length) return false;
    const riser = layout.riseFt / layout.risers;
    const step = SG.stairStandards().treadRunIn / 12;
    // In descending order: flights and landings as stairSequence lays them.
    const seq = parts.split ? SG.stairSequence(parts.split) : [{ treads: layout.treads }];
    const flights = [parts.runs[0], ...(parts.middle ? [parts.middle] : []), ...parts.runs.slice(1)];
    const landings = parts.landings && parts.landings.length ? parts.landings : (parts.landing ? [parts.landing] : []);
    const landingCount = seq.length - 2 - (parts.middle ? 1 : 0);
    const landingList = landingCount === 1 && landings.length > 1 && parts.landing ? [parts.landing] : landings;
    let y = storey.floorTop;
    let fi = 0, li = 0;
    const block = (ring, top, kind, colour) => prism(ring, top - Math.min(riser, 0.75), top, kind, colour, out);
    // seq is [flight] straight, [flight, landing, flight] for an L (or a U
    // whose landings merge), [flight, landing, (middle flight), landing,
    // flight] for a U. A landing of winders carries `treads` too, so a
    // flight is known by its place, not by its fields.
    seq.forEach((item, idx) => {
      const isFlight = idx === 0 || idx === seq.length - 1 || (seq.length === 5 && idx === 2);
      if (isFlight) {
        const run = flights[fi++];
        if (!run) return;
        const d = run.dir, side = { x: -d.z, z: d.x }, half = run.widthFt / 2;
        const count = Math.max(0, Math.round(run.treads != null ? run.treads : item.treads));
        for (let k = 0; k < count; k += 1) {
          y -= riser;
          const a = k * step, b = (k + 1) * step;
          const at = (u, v) => ({ x: run.start.x + d.x * u + side.x * v, z: run.start.z + d.z * u + side.z * v });
          block([at(a, -half), at(b, -half), at(b, half), at(a, half)], y, 'stair', COLOURS.stair);
        }
        return;
      }
      const landing = landingList[li++];
      const drops = item.treads > 0 ? item.treads : 1;
      // A landing of winders stands at the middle of its fall.
      const top = y - riser * Math.ceil(drops / 2);
      y -= riser * drops;
      if (landing && landing.poly && landing.poly.length >= 3) {
        block(landing.poly.map(p => ({ x: p.x, z: p.z })), top, 'landing', COLOURS.landing);
      }
    });
    return group;
  }

  // ── BEAMS AND POSTS ─────────────────────────────────────────────────────
  //
  // A BEAM carries a floor. One drawn on the FOUNDATION plan carries the
  // lowest storey; one on a FLOOR LAYOUT sits in that level's own floor; one
  // on a storey's plan carries the storey above it. FLUSH (the default) sits
  // in the joist depth, under the sheathing; DROPPED hangs its full depth
  // under the joists. The model keeps no beam size, so it is drawn a
  // joist-deep, 3-ply (4 1/2") wide.
  //
  // A POST: the drafter's own piles in the open, under a deck or a roof,
  // as the elevations stand them (cut-view.js pilePosts, 6x6 from the top of
  // the concrete up to what they carry); a column inside the concrete is a
  // basement telepost from the slab up under the beam over it, or under the
  // floor where no beam passes; a column on a storey is a post from that
  // floor up under the floor or beam above.
  const BEAM_WIDE_FT = 4.5 / 12;
  function buildFraming(saved, env, stack, levelById, levels, out, counts) {
    const F = window.DraftDrawingFormat;
    const CV = window.DraftCutView;
    const ids = new Set(levels.map(l => l.id));
    let beams = [];
    try { beams = F.beams ? F.beams(saved.beams, ids) : (saved.beams || []); } catch (e) { beams = []; }
    if (beams && !Array.isArray(beams) && Array.isArray(beams.items)) beams = beams.items;
    if (!Array.isArray(beams)) beams = [];
    // ONE ANSWER WITH THE SECTIONS: cut-view.js framingPieces stands every
    // beam and post up, and this only builds the solids.
    const framing = CV.framingPieces
      ? CV.framingPieces(Object.assign(Object.create(env), { beams: () => beams }), stack)
      : { beams: [], posts: [] };
    framing.beams.forEach(b => {
      const ring = wallFootprint({ start: b.a, end: b.b, refLine: 'center' }, BEAM_WIDE_FT);
      if (!ring) return;
      const n0 = out.length;
      prism(ring, b.bottom, b.top, 'beam', COLOURS.beam, out);
      const group = b.filing === 'fdn' ? 'fdn' : `L${b.beam.levelId}`;
      for (let i = n0; i < out.length; i += 1) out[i].groupHint = group;
      counts.beams += 1;
    });
    const square = (p, sizeFt) => [
      { x: p.x - sizeFt / 2, z: p.z - sizeFt / 2 }, { x: p.x + sizeFt / 2, z: p.z - sizeFt / 2 },
      { x: p.x + sizeFt / 2, z: p.z + sizeFt / 2 }, { x: p.x - sizeFt / 2, z: p.z + sizeFt / 2 }];
    framing.posts.forEach(pp => {
      if (!(pp.top - pp.foot > 0.2)) return;
      const group = pp.kind === 'telepost' ? 'fdn' : (pp.levelId != null ? `L${pp.levelId}` : 'fdn');
      const n0 = out.length;
      prism(square(pp.point, (pp.sizeIn || 3.5) / 12), pp.foot, pp.top, 'post', COLOURS.post, out);
      for (let i = n0; i < out.length; i += 1) out[i].groupHint = group;
      counts.posts += 1;
    });
  }

  // ── HOLOGRAMS, STOOD WHERE THE PLAN PUTS THEM ───────────────────────────
  //
  // Each hologram as hologram.js draws it (drawn(): its own holograms come
  // with it), less its DEMO parts (parts().existing), moved, turned and
  // mirrored by placed(). A SUITE, or a suite file, stands on the shell's
  // floors at the shell's heights (hologram.js shellLevels / shellHeights,
  // copied rule for rule from paintCut); any other hologram on its own.
  // A blue hologram is mixed toward its file's colour; a suite keeps the
  // house's own colours, as it does on the plan.
  const SHELL_HEIGHT_KEYS = ['levelAssemblies', 'sectionTable', 'buildType', 'zoneHeights',
    'foundationAttachment', 'foundationAttachmentIn', 'foundationLadderIn', 'elevationDatum'];
  function buildHolograms(saved, out, counts) {
    const H = window.DraftHologram;
    const F = window.DraftDrawingFormat;
    if (!H || !Array.isArray(saved.holograms) || !saved.holograms.length) return;
    let list = [];
    try { list = H.drawn(saved); } catch (e) { list = []; }
    const hostLevels = F.levels(saved.levels);
    list.forEach((holo, index) => {
      try {
        const source = holo.source || {};
        const suite = H.isSuite(holo);
        const fits = suite || Boolean(F.suiteKind && F.suiteKind(source.suiteKind));
        const own = F.levels(source.levels);
        const levels = fits ? [...hostLevels, ...own.filter(l => !hostLevels.some(h => h.id === l.id))] : own;
        const heights = {};
        if (fits) SHELL_HEIGHT_KEYS.forEach(key => { heights[key] = saved[key]; });
        const moved = H.placed(holo, H.parts(holo).existing);
        const built = build({ ...moved, holograms: [], ...heights }, { inner: true, levels });
        const tint = suite ? null
          : HOLO_TINTS[(Number.isInteger(holo.colour) ? holo.colour : index) % HOLO_TINTS.length];
        built.faces.forEach(f => {
          if (tint) f.colour = f.colour.map((v, i) => Math.round(v * 0.45 + tint[i] * 0.55));
          f.hologram = holo.id;
          out.push(f);
        });
        counts.holograms += 1;
      } catch (e) {
        if (typeof console !== 'undefined') console.warn(`hologram ${holo.name || holo.id} could not be built`, e);
      }
    });
  }

  // ── PHASE 2: WHAT HANGS OFF A ROOF'S EDGES ──────────────────────────────
  //
  // A roof record names each edge (roof.edges[i], from points[i] to
  // points[i+1]): 'eave' sheds water and wears a fascia; 'gable' is a rake,
  // wearing a fascia up the slope and a wall filling the triangle under it;
  // 'flush' dies into a wall and 'joint' meets the piece next door, and
  // neither gets anything -- the elevations' own rule (cut-view.js draws no
  // fascia and no gable wall under a joint).
  //
  // ONE WALK SERVES BOTH. The height of the roof along any line in plan is
  // the drafter's own roofRiseAt over the solved faces, read at every place
  // the line crosses a face edge or passes a face corner -- the surface is
  // flat between those, so that polyline is exact, not sampled. A fascia is
  // that polyline along the roof's outer edge with its board hung under it
  // (roof.fascia inches, which "grows down"); a gable wall is the same walk
  // taken along the wall line -- the edge moved in by its own overhang --
  // from the plate up to the roof.
  const FASCIA_THICK_FT = 1.5 / 12;
  const GABLE_THICK_FT = 5.5 / 12;
  const roofFasciaFt = roof => (Number(roof.fascia) > 0 ? Number(roof.fascia) : 5.5) / 12;

  // The roof surface's height along a -> b, as runs of {t, y} where the
  // roof covers the line. `inward` is the unit plan normal into the roof: the
  // read is taken a hair inside, since a point exactly on a face's boundary
  // can fall outside every face.
  function surfaceAlong(roof, list, eave, a, b, inward, G, keep) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (!(len > 1e-6)) return [];
    const ts = new Set([0, 1]);
    const addT = t => { if (t > -1e-9 && t < 1 + 1e-9) ts.add(Math.min(1, Math.max(0, Math.round(t * 1e7) / 1e7))); };
    list.forEach(face => {
      const poly = face.points || [];
      poly.forEach((p, i) => {
        // A corner on (or within an inch of) the line.
        const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (len * len);
        const off = Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) / len;
        if (off < 0.1) addT(t);
        // Where this face edge crosses the line.
        const q = poly[(i + 1) % poly.length];
        const ex = q.x - p.x, ez = q.z - p.z;
        const den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-12) return;
        const tt = ((p.x - a.x) * ez - (p.z - a.z) * ex) / den;
        const u = ((p.x - a.x) * dz - (p.z - a.z) * dx) / den;
        if (u > -1e-9 && u < 1 + 1e-9) addT(tt);
      });
    });
    // Every foot as well: the surface is flat between the breakpoints, so
    // these add nothing to the shape, but they let `keep` cut a run where
    // another roof takes over part way along.
    const steps = Math.min(400, Math.floor(len));
    for (let k = 1; k < steps; k += 1) addT(k / steps);
    const NUDGE = 0.02;
    const sorted = [...ts].sort((x, y) => x - y);
    const runs = [];
    let run = [];
    sorted.forEach(t => {
      // A hair in from each end too, so an end on a corner still reads.
      const tAt = Math.min(1 - 1e-4, Math.max(1e-4, t));
      const p = { x: a.x + dx * tAt + inward.x * NUDGE, z: a.z + dz * tAt + inward.z * NUDGE };
      const rise = G.roofRiseAt(roof, p, list);
      const p0 = { x: a.x + dx * tAt, z: a.z + dz * tAt };
      if (rise == null || !Number.isFinite(rise) || (keep && !keep(p0, eave + rise))) {
        if (run.length > 1) runs.push(run);
        run = [];
        return;
      }
      run.push({ t, y: eave + rise });
    });
    if (run.length > 1) runs.push(run);
    return runs;
  }

  // A planar polygon given thickness `depth` along plan direction `dir`,
  // every face turned to point out of the solid.
  function slab(front, dir, depth, kind, colour, out) {
    if (front.length < 3) return;
    const M = { normalOf };
    const off = { x: dir.x * depth, y: 0, z: dir.z * depth };
    let f = front.slice();
    let n = M.normalOf(f);
    // The front looks AWAY from the thickness.
    if (n.x * off.x + n.z * off.z > 0) { f = f.reverse(); }
    const back = f.map(p => ({ x: p.x + off.x, y: p.y, z: p.z + off.z })).reverse();
    out.push({ pts: f, kind, colour });
    out.push({ pts: back, kind, colour });
    // Each side turned out by its own edge: with the front wound round its
    // normal fn, edge x fn points away from the polygon. (A test against
    // the centre turned the sides of a stepped board inward.)
    const fn = normalOf(f);
    for (let i = 0; i < f.length; i += 1) {
      const p = f[i], q = f[(i + 1) % f.length];
      if (Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) <= 1e-6) continue;
      const e = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
      let quad = [p, q, { x: q.x + off.x, y: q.y, z: q.z + off.z }, { x: p.x + off.x, y: p.y, z: p.z + off.z }];
      const want = { x: e.y * fn.z - e.z * fn.y, y: e.z * fn.x - e.x * fn.z, z: e.x * fn.y - e.y * fn.x };
      const qn = normalOf(quad);
      if (qn.x * want.x + qn.y * want.y + qn.z * want.z < 0) quad = quad.reverse();
      out.push({ pts: quad, kind, colour });
    }
  }

  function dressRoof(item, solved, G, out, counts) {
    const { roof, list, eave, base } = item;
    const pts = roof.points;
    const n = pts.length;
    const edges = Array.isArray(roof.edges) ? roof.edges : [];
    const sign = planArea(pts) > 0 ? 1 : -1;
    const fasciaFt = roofFasciaFt(roof);
    // What the fascia wears (jb, 13 Nov 2026: FASCIA finish), PFM unless set.
    const WTs = window.DraftWallTypes;
    const fasciaColour = FINISH_COLOURS[WTs && WTs.fasciaFinishIdOf ? WTs.fasciaFinishIdOf(roof) : 'pfm'] || COLOURS.fascia;
    for (let i = 0; i < n; i += 1) {
      const kind = edges[i] || 'eave';
      if (kind !== 'eave' && kind !== 'gable') continue;
      const a = pts[i], b = pts[(i + 1) % n];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (!(len > 1e-6)) continue;
      const inward = { x: -(b.z - a.z) / len * sign, z: (b.x - a.x) / len * sign };
      // AN EDGE BURIED IN ANOTHER ROOF IS NOT AN EDGE ANYONE SEES. Where a
      // wing's gable butts into the main roof, the main roof's surface
      // carries on just outside it at or above the wing's own height; no
      // fascia hangs there and no gable wall stands there, as on the
      // elevations, where the bigger roof hides it.
      const keep = (p, y) => !solved.some(other => {
        if (other === item) return false;
        const q = { x: p.x - inward.x * 0.15, z: p.z - inward.z * 0.15 };
        const rise = G.roofRiseAt(other.roof, q, other.list);
        // Above the bottom of this edge's own board: the board is buried.
        return rise != null && other.eave + rise >= y - fasciaFt;
      });
      const at = (t, y, shift = 0) => ({
        x: a.x + (b.x - a.x) * t + inward.x * shift, y, z: a.z + (b.z - a.z) * t + inward.z * shift,
      });
      // The fascia board: the surface along the edge, hung down by its depth.
      surfaceAlong(roof, list, eave, a, b, inward, G, keep).forEach(run => {
        const top = run.map(s => at(s.t, s.y));
        const bottom = run.slice().reverse().map(s => at(s.t, s.y - fasciaFt));
        slab([...top, ...bottom], inward, FASCIA_THICK_FT, 'fascia', fasciaColour, out);
        counts.fascia = (counts.fascia || 0) + 1;
      });
      if (kind !== 'gable') continue;
      // The gable wall: on the wall line (the edge in by its overhang), from
      // the plate the roof bears on up to the underside of the roof.
      const over = Array.isArray(roof.edgeOverhang) && Number.isFinite(Number(roof.edgeOverhang[i]))
        ? Number(roof.edgeOverhang[i]) : Number(roof.overhang) || 0;
      const wa = { x: a.x + inward.x * over, z: a.z + inward.z * over };
      const wb = { x: b.x + inward.x * over, z: b.z + inward.z * over };
      const wat = (t, y) => ({ x: wa.x + (wb.x - wa.x) * t, y, z: wa.z + (wb.z - wa.z) * t });
      surfaceAlong(roof, list, eave, wa, wb, inward, G, keep).forEach(run => {
        // An inch under the roof, so its top never shares a plane with the
        // roof sheathing (the two would flicker through each other).
        const top = run.map(s => wat(s.t, s.y - 1 / 12));
        if (!top.some(p => p.y > base + 0.6)) return;   // nothing to fill under a near-flat run
        const bottom = [wat(run[run.length - 1].t, base), wat(run[0].t, base)];
        slab([...top, ...bottom], inward, GABLE_THICK_FT, 'gable', COLOURS.gable, out);
        counts.gables = (counts.gables || 0) + 1;
      });
    }
  }

  function boundsOf(faces) {
    const lo = { x: Infinity, y: Infinity, z: Infinity }, hi = { x: -Infinity, y: -Infinity, z: -Infinity };
    faces.forEach(f => f.pts.forEach(p => {
      ['x', 'y', 'z'].forEach(k => { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; });
    }));
    if (!faces.length) return { lo: { x: -10, y: 0, z: -10 }, hi: { x: 10, y: 10, z: 10 } };
    return { lo, hi };
  }

  // ── NORMALS AND TRIANGLES (shared by both painters and the exporters) ──
  // Newell's normal: robust for any planar polygon, convex or not.
  function normalOf(pts) {
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      nx += (p.y - q.y) * (p.z + q.z);
      ny += (p.z - q.z) * (p.x + q.x);
      nz += (p.x - q.x) * (p.y + q.y);
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / len, y: ny / len, z: nz / len };
  }

  // Ear clipping on the polygon's dominant plane. Returns index triples in
  // the polygon's own winding, so a triangle keeps the face's normal.
  function triangulate(pts) {
    const n = pts.length;
    if (n < 3) return [];
    if (n === 3) return [[0, 1, 2]];
    const nm = normalOf(pts);
    const ax = Math.abs(nm.x), ay = Math.abs(nm.y), az = Math.abs(nm.z);
    // Drop the dominant axis; keep the 2D winding the same sign as the normal.
    const to2 = ax >= ay && ax >= az ? (p => [p.y, p.z]) : ay >= az ? (p => [p.z, p.x]) : (p => [p.x, p.y]);
    const flat = pts.map(to2);
    const area = flat.reduce((s, p, i) => { const q = flat[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
    const ccw = area > 0;
    const idx = [];
    for (let i = 0; i < n; i += 1) idx.push(i);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, a, b, c) => {
      const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
      return ccw ? d1 > 1e-12 && d2 > 1e-12 && d3 > 1e-12 : d1 < -1e-12 && d2 < -1e-12 && d3 < -1e-12;
    };
    const tris = [];
    let guard = n * n;
    while (idx.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let k = 0; k < idx.length; k += 1) {
        const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
        const a = flat[i0], b = flat[i1], c = flat[i2];
        const turn = cross(a, b, c);
        if (ccw ? turn <= 1e-12 : turn >= -1e-12) continue;
        if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inside(flat[j], a, b, c))) continue;
        tris.push([i0, i1, i2]);
        idx.splice(k, 1);
        clipped = true;
        break;
      }
      if (!clipped) break;   // degenerate: fan the rest rather than lose it
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    else for (let k = 1; k + 1 < idx.length; k += 1) tris.push([idx[0], idx[k], idx[k + 1]]);
    return tris;
  }

  window.DraftHouseMesh = Object.freeze({ build, normalOf, triangulate, COLOURS, wallFootprint, wallFrame });
})();
