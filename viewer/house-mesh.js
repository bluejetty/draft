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
// PHASE 1 (this file today): walls on every storey, the garage on its own
// plate, foundation walls and footings, floor decks and slabs, and the roof
// planes. Gable-end infill, fascia, openings, stairs, decks and holograms are
// the later phases in the plan.
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
  });

  const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  // ── A WALL'S BODY IN PLAN ──────────────────────────────────────────────
  // The stored line is the wall's REFERENCE line, not its centre: 'left'
  // keeps the body on the +normal side (-dz, dx), 'right' on the other, and
  // an OFFSET FROM LINE moves the whole body (wall-types.js). The same rule
  // cut-view.js's sectionWallCrossings reads.
  function wallFootprint(wall, thickFt) {
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
    const p = (t, off) => ({ x: a.x + ux * t + nx * off, z: a.z + uz * t + nz * off });
    return [p(-ext, lo), p(len + ext, lo), p(len + ext, hi), p(-ext, hi)];
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

  // ── THE BUILD ──────────────────────────────────────────────────────────
  // `saved` is the parsed .draft. Returns { faces, stack, counts, bounds }.
  function build(saved) {
    const format = window.DraftDrawingFormat;
    const CV = window.DraftCutView;
    const G = window.DraftGeometry2D;
    if (!format || !CV || !G || !window.DraftCutViewEnv) throw new Error('The drafter modules did not load.');
    if (window.DraftWallTypes && window.DraftWallTypes.adoptDrawing) window.DraftWallTypes.adoptDrawing(saved);
    const levels = format.levels(saved.levels);
    const env = window.DraftCutViewEnv.buildCutViewEnv(saved, levels);
    const stack = CV.sectionLevelStack(env);
    const faces = [];
    const counts = { walls: 0, foundationWalls: 0, floors: 0, roofs: 0 };
    if (!stack) return { faces, stack: null, counts, bounds: boundsOf(faces) };

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

    // ── WALLS ─────────────────────────────────────────────────────────────
    env.walls().forEach(wall => {
      if (!wall || !wall.start || !wall.end || wall.levelId < 0) return;
      const view = wall.view || 'plan';
      if (view === 'foundation') {
        const garage = CV.garageOfWall(wall, env, garageCache);
        const top = garage ? fdn.wallBottom + num(wall.topHeight, 8)
          : Math.min(fdn.wallBottom + num(wall.topHeight, 8), fdn.wallTop - plateFt);
        const bottom = fdn.wallBottom + num(wall.baseHeight);
        const t = thicknessFt(wall, 8);
        prism(wallFootprint(wall, t), bottom, top, 'foundation', COLOURS.foundation, faces);
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
        prism(wallFootprint(wall, thicknessFt(wall, 5.5)), bottom, top, 'wall', COLOURS.wall, faces);
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
      prism(wallFootprint(wall, thicknessFt(wall, 5.5)), bottom, top,
        garage ? 'garageWall' : 'wall', garage ? COLOURS.garageWall : COLOURS.wall, faces);
      counts.walls += 1;
    });

    // ── FLOORS AND SLABS ─────────────────────────────────────────────────
    env.floors().forEach(floor => {
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
      if (garage || floor.garage === true) {
        let top = storey.floorTop;
        try { if (garage) top = CV.garageSlabTop(env, fdn, garage); } catch (e) { top = storey.floorTop; }
        prism(ring, top - 4 / 12, top, 'slab', COLOURS.slab, faces);
      } else {
        prism(insetRing(ring, 0.02), storey.floorBottom, storey.floorTop, 'floor', COLOURS.floor, faces);
      }
      counts.floors += 1;
    });

    // ── ROOFS ────────────────────────────────────────────────────────────
    env.roofs().forEach(roof => {
      if (!roof || !Array.isArray(roof.points) || roof.points.length < 3 || roof.levelId < 0) return;
      let list = [];
      try { list = G.roofFaces(roof, G.roofSkeleton(roof)) || []; } catch (e) { list = []; }
      const eave = CV.roofEaveElev(roof, stack, env);
      list.forEach(face => {
        const poly = face.points || [];
        if (poly.length < 3) return;
        faces.push({
          pts: poly.map(p => ({ x: p.x, y: eave + G.roofFaceRise(face, p, roof.pitch || 4), z: p.z })),
          kind: 'roof', colour: COLOURS.roof, twoSided: true,
        });
      });
      if (list.length) counts.roofs += 1;
    });

    return { faces, stack, counts, bounds: boundsOf(faces) };
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

  window.DraftHouseMesh = Object.freeze({ build, normalOf, triangulate, COLOURS, wallFootprint });
})();
