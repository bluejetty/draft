// Generated section / elevation painter (board #168): the semantic cut view
// shared by the Model Space and the LAYOUT sheets. A cut is a line through
// the plan with a dirVec naming the side the viewer stands on; the painter
// projects the level stack, the walls the cut crosses (sections) or every
// wall face the viewer sees (elevations), floor assemblies, foundation walls
// with footings and slab, garage grade beams / thickened-edge slabs, the
// roof planes with fascia, and the heavy grade line.
//
// Everything the painter reads from a drawing arrives through an explicit
// env — plain accessor functions over either the live Model Space state or
// a saved drawing's JSON — so the module owns no state of its own:
//   floorLevels()            → floor levels bottom-up [{ id, name }]
//   levelAssembly(levelId)   → normalised level assembly (wallHeightFt, ...)
//   levelFloorFt(levelId)    → floor assembly depth in feet
//   levelWallTopFt(levelId, view) → tallest wall top on the level/view
//   footingWidthIn(levelId)  → footing width under that level's walls
//   walls() / roofs() / floors() / fenestrations() → entity collections
//   garageOutlines(levelId)  → garage outlines on a level
//   garageFoundation(garage) → 'gradebeam' | 'thickened'
//   edgeOnOutline(a, b, outline) → true when edge a→b lies on the outline
//   masterPointById(srcId)   → BONEYARD master point or null
//   gableCornerStyle()       → 'flat' | 'return' | 'porkchop' | 'boxed'
//   elevLabel(elev) / ftIn(feet) → formatted construction elevations
//   elevationDatum()         → true when labels read from the datum
if (!window.DraftCutView) {
(() => {
  const geo = () => window.DraftGeometry2D;
  const { WALL_TYPES } = window.DraftWallTypes;
  const { formatInchesOnly } = window.DraftFormatters;

  // Physical drafting standards, shared with the Model Space via STANDARDS.
  // Garage slab: 4" pour over the grade beam at the doors.
  const GARAGE_SLAB_THICKNESS_IN = 4;
  // Attached-garage grade beam stack: concrete + 1.5" sill plate, hung with
  // the top of concrete 1'-0" above grade — level with the top of the house
  // foundation wall at the default grade.
  const GARAGE_BEAM_PLATE_IN = 1.5;
  // The concrete half of that stack. It sat alone in MODEL.dc.html while its
  // own comment there described the pair -- 32" concrete + 1.5" sill plate =
  // 33.5" -- with the sill half already living here. Two halves of one
  // dimension in two files is how they drift; PROJECT.html had meanwhile
  // grown a third copy of the 32.
  const GARAGE_BEAM_CONCRETE_IN = 32;
  // GRADE: drawn 1'-0" below the top of the foundation wall — the
  // conservative LOW case, so the site fills UP to the drawn grade (real
  // grade usually sits 6"-8" below the foundation top). Garages hang off
  // grade, not the house: an attached beam tops out 1'-0" above it, a
  // detached grade beam 8".
  const GRADE_BELOW_FOUNDATION_TOP_FT = 1;
  const GARAGE_BEAM_ABOVE_GRADE_FT = 1;
  const DETACHED_BEAM_ABOVE_GRADE_IN = 8;
  // Detached-garage thickened-edge slab: a LEVEL FLAT monolithic pour on
  // gravel — 4" field, 1'-0" deep perimeter edge, 45° taper from the edge
  // back up to the field.
  const GARAGE_EDGE_DEPTH_IN = 12;
  const ROOF_FASCIA_IN = 5.5;

  function sectionLevelStack(env) {
    const floors = env.floorLevels();
    if (!floors.length) return null;
    let floorTop = 0;
    const stack = floors.map((level, index) => {
      if (index > 0) {
        floorTop += env.levelAssembly(floors[index - 1].id).wallHeightFt
          + env.levelFloorFt(level.id);
      }
      const assembly = env.levelAssembly(level.id);
      return {
        id: level.id, name: level.name,
        floorTop,
        floorBottom: floorTop - env.levelFloorFt(level.id),
        wallTop: floorTop + assembly.wallHeightFt,
        joistDepthIn: assembly.joistDepthIn,
        sheathingIn: assembly.sheathingIn,
      };
    });
    const lowest = stack[0];
    const foundationAssembly = env.levelAssembly(1);
    const wallTop = lowest.floorBottom;
    const wallBottom = wallTop - env.levelWallTopFt(1, 'foundation');
    return {
      floors: stack,
      bearing: stack[stack.length - 1].wallTop,
      foundation: {
        wallTop, wallBottom,
        grade: wallTop - GRADE_BELOW_FOUNDATION_TOP_FT,
        slabTop: wallBottom + foundationAssembly.slabThicknessIn / 12,
        slabIn: foundationAssembly.slabThicknessIn,
        footingBottom: wallBottom - foundationAssembly.footingDepthIn / 12,
        footingIn: foundationAssembly.footingDepthIn,
        footingWidthIn: env.footingWidthIn(1),
      },
    };
  }

  // Where the cut segment crosses a wall centreline: the position along the
  // viewer's horizontal axis, the wall, and how far along the wall it lands
  // (for reading fenestrations at the crossing).
  function sectionWallCrossings(env, cut, axis) {
    const a = cut.startPt, b = cut.endPt;
    const crossings = [];
    // A wall belongs to the garage it lies on, not just to a level: garage
    // walls are stored on the SAME level as the house walls with only a body
    // marker, so anything spanning "the level" has to ask which building
    // (audit C5). The elevation path already groups this way.
    const garagesByLevel = {};
    const garageFor = wall => {
      const list = garagesByLevel[wall.levelId]
        || (garagesByLevel[wall.levelId] = env.garageOutlines(wall.levelId));
      return list.find(garage => env.edgeOnOutline(wall.start, wall.end, garage)) || null;
    };
    env.walls().forEach(wall => {
      // BONEYARD shelf walls live on negative pseudo levels and are not in
      // the building at all.
      if (wall.levelId < 0) return;
      const c = wall.start, d = wall.end;
      const denom = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
      if (Math.abs(denom) < 1e-9) return;   // parallel — an elevation face, not a cut
      const s = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / denom;
      const t = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / denom;
      if (s < 0 || s > 1 || t < 0 || t > 1) return;
      const px = a.x + (b.x - a.x) * s, pz = a.z + (b.z - a.z) * s;
      const type = WALL_TYPES.find(w => w.id === wall.wallType);
      const wallLen = Math.hypot(d.x - c.x, d.z - c.z);
      // A skewed wall reads wider on the section — its thickness over the
      // sine of the crossing angle, capped so near-parallel walls stay sane.
      const cutLen = Math.hypot(b.x - a.x, b.z - a.z);
      const sin = Math.abs(denom) / (cutLen * wallLen || 1);
      const width = (type ? type.totalIn : 5.5) / 12 / Math.max(sin, 0.35);
      crossings.push({
        wall, u: px * axis.x + pz * axis.z,
        width,
        alongWall: t * wallLen,
        garage: garageFor(wall),
      });
    });
    return crossings;
  }

  // The elevation a roof bears on: a garage roof carries its own plate
  // height over the main-floor line, so a garage beside a two-storey house
  // keeps a one-storey roof; every other roof sits on top of the full wall
  // stack.
  function roofBaseElev(roof, stack) {
    const plate = Number(roof.plateHeightFt);
    if (roof.garage === true && Number.isFinite(plate) && stack.floors.length) {
      return stack.floors[0].floorTop + plate;
    }
    return stack.bearing;
  }

  // Roof surface height over a plan point, from the roof's REAL face
  // polygons (geometry-2d builds them off the straight skeleton): locate the
  // containing face, evaluate its plane. The old rule — min over every eave
  // edge's infinite line — carved phantom valleys through L/T/U footprints
  // wherever a far wing's eave line passed; a face only ever answers for
  // its own region. Callers doing many queries build the faces once and
  // pass them in.
  function sectionRoofHeightAt(pt, roof, faces = geo().roofFaces(roof, geo().roofSkeleton(roof))) {
    if (!roof.points || roof.points.length < 3) return null;
    for (const face of faces) {
      const poly = face.points;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const pi = poly[i], pj = poly[j];
        if ((pi.z > pt.z) !== (pj.z > pt.z)
          && pt.x < (pj.x - pi.x) * (pt.z - pi.z) / (pj.z - pi.z) + pi.x) inside = !inside;
      }
      if (inside) return geo().roofFaceRise(face, pt, roof.pitch || 4);
    }
    return null;
  }

  // A caller-owned fit (LAYOUT sheets) maps model feet to pixels at an exact
  // architectural scale: pxPerFt fixes the scale and extents fix the framing,
  // so the drawing lands on the sheet where the viewport says, not where the
  // screen-fit margins would centre it.
  const externalFit = opts =>
    (opts && Number.isFinite(opts.pxPerFt) && opts.pxPerFt > 0 ? opts : null);

  // The model-space extents a cut view will occupy: the cut's own span along
  // the viewing axis, and the vertical band from below the footings to above
  // the tallest roof. LAYOUT sizes a sheet viewport from these and hands them
  // back through fit.extents so the rectangle and the drawing agree exactly.
  function cutViewExtents(env, cut) {
    const stack = sectionLevelStack(env);
    if (!stack) return null;
    const dir = cut.dirVec;
    const axis = { x: dir.z, z: -dir.x };
    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    let roofTop = null;
    env.roofs().forEach(roof => {
      if (!roof.points || roof.points.length < 3) return;
      const base = roofBaseElev(roof, stack) + ROOF_FASCIA_IN / 12;
      geo().roofFaces(roof, geo().roofSkeleton(roof)).forEach(face => {
        face.points.forEach(pt => {
          const elev = base + geo().roofFaceRise(face, pt, roof.pitch || 4);
          if (roofTop === null || elev > roofTop) roofTop = elev;
        });
      });
    });
    // Two rectangles, not one. yTop/yBottom are what the SECTION painter
    // reserves: the object plus 2' of air above the ridge and below the
    // footing, which keeps a section's cut edges off its frame.
    //
    // yTopDrawn/yBottomDrawn are what an ELEVATION actually puts ink on:
    // the roof silhouette at the top (or the bearing line where no roof
    // covers the cut), and the footing bottom underneath — the buried
    // foundation IS drawn, dashed, below grade, so it stays in. The air
    // does not. A sheet sizing an elevation by the padded figure asks the
    // page for four feet it will never fill, which on a two-storey house
    // over a basement is the difference between 1/8" and 1/16".
    const bare = roofTop === null ? stack.bearing : Math.max(stack.bearing, roofTop);
    return {
      uMin: Math.min(uA, uB),
      uMax: Math.max(uA, uB),
      yTop: Math.max(stack.bearing + 4, roofTop === null ? -Infinity : roofTop + 2),
      yBottom: stack.foundation.footingBottom - 2,
      yTopDrawn: bare,
      yBottomDrawn: stack.foundation.footingBottom,
    };
  }

  function drawCutView(env, ctx, w, h, cut, opts) {
    const fit = externalFit(opts);
    ctx.fillStyle = (opts && opts.paperColor) || '#fafafa';
    ctx.fillRect(0, 0, w, h);
    const stack = sectionLevelStack(env);
    const dir = cut.dirVec;
    // Screen-x in world terms: the viewer looks along -dir with +Y up, so
    // right on the paper is (dir.z, -dir.x) — the cut line's own direction.
    const axis = { x: dir.z, z: -dir.x };
    const header = (label) => {
      if (fit) return;   // the sheet captions its viewports itself
      ctx.fillStyle = 'rgba(29,31,32,0.55)';
      ctx.font = "600 10px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(label, 10, 8);
    };
    if (!stack) { header(cut.name); return; }
    const crossings = sectionWallCrossings(env, cut, axis);
    if (!crossings.length) {
      // Standing outside the model looking at it: an elevation, not a section.
      if (drawElevationView(env, ctx, w, h, cut, stack, axis, header, opts)) return;
      header(cut.name);
      ctx.fillStyle = 'rgba(29,31,32,0.55)';
      ctx.font = "600 13px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('The cut line crosses no walls — draw it through the plan.', w / 2, h / 2);
      return;
    }

    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    const uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);

    // Roof profile along the cut, EXACT: each roof's face polygons clipped
    // by the cut segment (breakpoints only — straight between them at any
    // cut angle), the roofs merged as an upper envelope. No sampling, so a
    // diagonal cut is as clean as an axis-aligned one.
    const roofSamples = [];
    const roofChords = [];
    const roofs = env.roofs();
    const fasciaFt = ROOF_FASCIA_IN / 12;
    if (roofs.length) {
      const profiles = [];
      roofs
        .filter(roof => roof.points && roof.points.length >= 3)
        .forEach(roof => {
          const base = roofBaseElev(roof, stack);
          const profile = geo().roofProfile(
            roof, geo().roofFaces(roof, geo().roofSkeleton(roof)),
            cut.startPt, cut.endPt, axis)
            .map(pt => ({ u: pt.u, rise: base + fasciaFt + pt.rise }));
          if (profile.length < 2) return;
          profiles.push(profile);
          roofChords.push({ u0: profile[0].u, u1: profile[profile.length - 1].u, elev: base });
        });
      geo().profileEnvelope(profiles).forEach(pt => {
        roofSamples.push({ u: pt.u, elev: pt.rise });
      });
    }

    const yTop = fit?.extents ? fit.extents.yTop : Math.max(stack.bearing + 4,
      ...roofSamples.filter(s => s.elev != null).map(s => s.elev + 2));
    const yBottom = fit?.extents ? fit.extents.yBottom : stack.foundation.footingBottom - 2;
    const marginL = fit ? 0 : 64, marginR = fit ? 0 : 24,
      marginT = fit ? 0 : 30, marginB = fit ? 0 : 16;
    const pxPerFt = fit ? fit.pxPerFt : Math.max(2, Math.min(
      (w - marginL - marginR) / Math.max(uMax - uMin, 4),
      (h - marginT - marginB) / Math.max(yTop - yBottom, 8)));
    const x0 = marginL + ((w - marginL - marginR) - (uMax - uMin) * pxPerFt) / 2;
    const y0 = marginT + ((h - marginT - marginB) - (yTop - yBottom) * pxPerFt) / 2;
    const X = u => x0 + (u - uMin) * pxPerFt;
    const Y = e => y0 + (yTop - e) * pxPerFt;

    const INK = '#1d1f20';
    header(`${cut.name} — GENERATED SECTION · ${env.ftIn(uMax - uMin)} CUT`);

    // Elevation marks down the left margin, on the level-card datum.
    const datum = env.elevationDatum();
    const mark = (elevFt, label) => {
      ctx.strokeStyle = 'rgba(29,31,32,0.25)'; ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(marginL - 18, Y(elevFt)); ctx.lineTo(w - marginR, Y(elevFt));
      ctx.stroke();
      ctx.fillStyle = 'rgba(29,31,32,0.6)';
      ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(label ?? env.elevLabel(elevFt + datum), marginL - 22, Y(elevFt));
    };
    stack.floors.forEach(level => { mark(level.floorTop); mark(level.wallTop); });
    mark(stack.foundation.grade, 'GRADE');
    mark(stack.foundation.slabTop);
    mark(stack.foundation.footingBottom);

    // Level extents: the floor-assembly band spans the outermost walls of
    // the HOUSE it crosses — never the garage's (audit C5). A garage is a
    // slab on grade, so a band drawn across it claimed a framed floor and an
    // open storey underneath; with a detached garage the same band ran
    // across the open ground between the two buildings.
    const levelSpan = levelId => {
      const us = crossings
        .filter(c => c.wall.levelId === levelId && !c.garage)
        .map(c => c.u);
      return us.length ? { min: Math.min(...us), max: Math.max(...us) } : null;
    };

    // Foundation first: each crossed wall at its own heights — a basement
    // wall runs grade to footing, a hung garage grade beam is just its band.
    // Footings belong to walls that bear at the bottom of the excavation.
    const fdn = stack.foundation;
    const fdnCrossings = crossings.filter(c => (c.wall.view || 'plan') === 'foundation');
    fdnCrossings.forEach(c => {
      const top = fdn.wallBottom + c.wall.topHeight;
      const base = fdn.wallBottom + c.wall.baseHeight;
      ctx.fillStyle = 'rgba(150,150,155,0.5)';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      const x = X(c.u - c.width / 2), wid = c.width * pxPerFt;
      ctx.fillRect(x, Y(top), wid, (top - base) * pxPerFt);
      ctx.strokeRect(x, Y(top), wid, (top - base) * pxPerFt);
      if (c.wall.baseHeight <= 0.01) {
        const fw = fdn.footingWidthIn / 12;
        const fx = X(c.u - fw / 2), fwid = fw * pxPerFt;
        ctx.fillRect(fx, Y(base), fwid, (fdn.footingIn / 12) * pxPerFt);
        ctx.strokeRect(fx, Y(base), fwid, (fdn.footingIn / 12) * pxPerFt);
      }
    });
    const bearingCrossings = fdnCrossings.filter(c => c.wall.baseHeight <= 0.01);
    const fdnSpan = bearingCrossings.length
      ? { min: Math.min(...bearingCrossings.map(c => c.u)), max: Math.max(...bearingCrossings.map(c => c.u)) }
      : null;
    if (fdnSpan && fdnSpan.max - fdnSpan.min > 1) {
      ctx.fillStyle = 'rgba(150,150,155,0.35)';
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      const x = X(fdnSpan.min), wid = (fdnSpan.max - fdnSpan.min) * pxPerFt;
      ctx.fillRect(x, Y(fdn.slabTop), wid, (fdn.slabIn / 12) * pxPerFt);
      ctx.strokeRect(x, Y(fdn.slabTop), wid, (fdn.slabIn / 12) * pxPerFt);
    }

    // Hung grade beams carry a slab poured over the plate on graded fill:
    // the 4" garage slab, its under-slab line dashed, gravel dotted below —
    // section detail only, elevations keep just the buried outline.
    const beamCrossings = fdnCrossings.filter(c => c.wall.baseHeight > 0.01);
    if (beamCrossings.length) {
      // The slab spans its GARAGE, not the pair of legs the cut happened to
      // clip (audit C5): a cut through a single grade-beam leg used to draw
      // no slab at all, leaving the band above it standing over nothing.
      // Project the garage's own outline onto the cut axis and clip that to
      // the cut; fall back to the crossings when the body is unknown.
      const garage = beamCrossings.map(c => c.garage).find(Boolean);
      const outlineUs = garage
        ? garage.points.map(pt => pt.x * axis.x + pt.z * axis.z)
        : [];
      const lo = outlineUs.length
        ? Math.max(uMin, Math.min(...outlineUs))
        : Math.min(...beamCrossings.map(c => c.u));
      const hi = outlineUs.length
        ? Math.min(uMax, Math.max(...outlineUs))
        : Math.max(...beamCrossings.map(c => c.u));
      if (hi - lo > 1) {
        const plateTop = fdn.wallBottom
          + Math.max(...beamCrossings.map(c => c.wall.topHeight)) + GARAGE_BEAM_PLATE_IN / 12;
        const slabTop = plateTop + GARAGE_SLAB_THICKNESS_IN / 12;
        ctx.fillStyle = 'rgba(150,150,155,0.35)';
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(X(lo), Y(slabTop), (hi - lo) * pxPerFt, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
        ctx.strokeRect(X(lo), Y(slabTop), (hi - lo) * pxPerFt, (GARAGE_SLAB_THICKNESS_IN / 12) * pxPerFt);
        ctx.strokeStyle = 'rgba(29,31,32,0.5)'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(X(lo), Y(plateTop - 0.5));
        ctx.lineTo(X(hi), Y(plateTop - 0.5));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(29,31,32,0.45)';
        for (let g = lo + 0.5; g < hi - 0.25; g += 0.75) {
          const j = (g * 7.3) % 1;   // deterministic jitter, no flicker on redraw
          ctx.beginPath();
          ctx.arc(X(g + j * 0.3), Y(plateTop - 0.1 - j * 0.32), 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Grade, heavy, running off the sheet on both sides of the building.
    if (crossings.length) {
      const uLo = Math.min(...crossings.map(c => c.u - c.width / 2));
      const uHi = Math.max(...crossings.map(c => c.u + c.width / 2));
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginL - 18, Y(fdn.grade)); ctx.lineTo(X(uLo), Y(fdn.grade));
      ctx.moveTo(X(uHi), Y(fdn.grade)); ctx.lineTo(w - marginR, Y(fdn.grade));
      ctx.stroke();
    }

    // Floor levels: assembly band, then the crossed walls standing on it.
    stack.floors.forEach(level => {
      const span = levelSpan(level.id) || fdnSpan;
      if (span && span.max - span.min > 0.5) {
        ctx.fillStyle = 'rgba(89,128,166,0.15)';
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        const x = X(span.min), wid = (span.max - span.min) * pxPerFt;
        const depth = (level.floorTop - level.floorBottom) * pxPerFt;
        ctx.fillRect(x, Y(level.floorTop), wid, depth);
        ctx.strokeRect(x, Y(level.floorTop), wid, depth);
        ctx.fillStyle = 'rgba(29,31,32,0.55)';
        ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(
          `${formatInchesOnly(level.joistDepthIn)} TJI + ${formatInchesOnly(level.sheathingIn)} SHTG`,
          x + 4, Y((level.floorTop + level.floorBottom) / 2));
      }
      crossings.filter(c => c.wall.levelId === level.id && (c.wall.view || 'plan') === 'plan')
        .forEach(c => drawSectionWall(env, ctx, X, Y, pxPerFt, c, level));
    });

    // Roof profile over everything: the sampled top chord plus fascia drops.
    const lit = roofSamples.filter(s => s.elev != null);
    if (lit.length > 1) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let pen = null;
      roofSamples.forEach(s => {
        if (s.elev == null) {
          if (pen) ctx.lineTo(X(pen.u), Y(pen.elev - fasciaFt));
          pen = null;
          return;
        }
        if (!pen) {
          ctx.moveTo(X(s.u), Y(s.elev - fasciaFt));     // fascia drop at the edge
          ctx.lineTo(X(s.u), Y(s.elev));
        } else ctx.lineTo(X(s.u), Y(s.elev));
        pen = s;
      });
      if (pen) ctx.lineTo(X(pen.u), Y(pen.elev - fasciaFt));
      ctx.stroke();
      // Bottom chord: each roof's flat ceiling line at its own plate.
      ctx.strokeStyle = 'rgba(29,31,32,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath();
      roofChords.forEach(chord => {
        ctx.moveTo(X(chord.u0), Y(chord.elev));
        ctx.lineTo(X(chord.u1), Y(chord.elev));
      });
      ctx.stroke();
    }
  }

  // One crossed wall on the section: the stud rectangle for its level, with
  // any fenestration the cut happens to pass through read out of the wall —
  // doors clear to the head, windows hang from it to a default sill.
  function drawSectionWall(env, ctx, X, Y, pxPerFt, crossing, level) {
    const INK = '#1d1f20';
    const HEAD_FT = 6 + 10 / 12;          // default door / window head
    const SILL_FT = 3;                    // default window sill
    const { wall, u, width, alongWall } = crossing;
    const x = X(u - width / 2), wid = width * pxPerFt;
    const bottom = level.floorTop, top = level.wallTop;
    const opening = env.fenestrations().find(f => f.wallId === wall.id
      && Math.abs(alongWall - f.offset) < f.width / 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
    ctx.fillStyle = 'rgba(29,31,32,0.12)';
    if (!opening) {
      ctx.fillRect(x, Y(top), wid, (top - bottom) * pxPerFt);
      ctx.strokeRect(x, Y(top), wid, (top - bottom) * pxPerFt);
      return;
    }
    const headFt = opening.headHeight > 0 ? opening.headHeight : HEAD_FT;
    const sillFt = opening.sillHeight > 0 ? opening.sillHeight : SILL_FT;
    const gapBottom = opening.type === 'door' ? bottom : bottom + sillFt;
    const gapTop = Math.min(bottom + headFt, top);
    // Above the head (header + plates) and, for windows, below the sill.
    ctx.fillRect(x, Y(top), wid, (top - gapTop) * pxPerFt);
    ctx.strokeRect(x, Y(top), wid, (top - gapTop) * pxPerFt);
    if (gapBottom > bottom) {
      ctx.fillRect(x, Y(gapBottom), wid, (gapBottom - bottom) * pxPerFt);
      ctx.strokeRect(x, Y(gapBottom), wid, (gapBottom - bottom) * pxPerFt);
    }
    ctx.fillStyle = '#fff'; ctx.lineWidth = 1;
    if (opening.type === 'window') {
      // The window unit in section: 2x6 frame members at head and sill
      // reaching 1/2" past each wall face, double glazing between them —
      // two 1/4" panes 1/2" apart — with 1/2" square stops between and on
      // each side of the glass.
      const frameDeep = Math.max(6 / 12, width + 1 / 12);
      const fx = X(u - frameDeep / 2), fw = frameDeep * pxPerFt;
      const frameThick = (2 / 12) * pxPerFt;
      ctx.fillRect(fx, Y(gapTop), fw, frameThick);
      ctx.strokeRect(fx, Y(gapTop), fw, frameThick);
      ctx.fillRect(fx, Y(gapBottom + 2 / 12), fw, frameThick);
      ctx.strokeRect(fx, Y(gapBottom + 2 / 12), fw, frameThick);
      const glassTop = gapTop - 2 / 12, glassBottom = gapBottom + 2 / 12;
      [0.375 / 12, -0.375 / 12].forEach(off => {
        const gx = X(u + off);
        ctx.beginPath(); ctx.moveTo(gx, Y(glassTop)); ctx.lineTo(gx, Y(glassBottom)); ctx.stroke();
      });
      const stop = (0.5 / 12) * pxPerFt;
      ctx.fillStyle = 'rgba(29,31,32,0.35)';
      [u - 0.875 / 12, u, u + 0.875 / 12].forEach(su => {
        ctx.fillRect(X(su) - stop / 2, Y(glassBottom + 0.5 / 12), stop, stop);
        ctx.fillRect(X(su) - stop / 2, Y(glassTop), stop, stop);
      });
    } else {
      // A flat 1-3/4" slab door standing in the opening.
      const slabW = Math.max(1.5, (1.75 / 12) * pxPerFt);
      ctx.fillRect(X(u) - slabW / 2, Y(gapTop), slabW, (gapTop - gapBottom) * pxPerFt);
      ctx.strokeRect(X(u) - slabW / 2, Y(gapTop), slabW, (gapTop - gapBottom) * pxPerFt);
    }
  }

  // A cut that crosses nothing but faces the model is an elevation: wall
  // faces projected onto the cut line (far to near, so close walls occlude),
  // openings on each face, the roof silhouette, a grade line, and the
  // below-grade foundation dashed. Returns false when nothing projects
  // into the cut's span, so the caller can fall back to the guidance text.
  function drawElevationView(env, ctx, w, h, cut, stack, axis, header, opts) {
    const fit = externalFit(opts);
    const dir = cut.dirVec;
    const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
    const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
    const uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);
    const proj = pt => ({ u: pt.x * axis.x + pt.z * axis.z, d: pt.x * dir.x + pt.z * dir.z });

    const levelById = {};
    stack.floors.forEach(level => { levelById[level.id] = level; });
    // A plan wall lying on a garage outline belongs to that garage: it
    // stands on the garage's beam plate or slab, off the house floor stack.
    const garagesByLevel = {};
    const garageFor = wall => {
      const list = garagesByLevel[wall.levelId]
        || (garagesByLevel[wall.levelId] = env.garageOutlines(wall.levelId));
      return list.find(g => env.edgeOnOutline(wall.start, wall.end, g)) || null;
    };
    const faces = [];
    const fdnFaces = [];
    env.walls().forEach(wall => {
      const p1 = proj(wall.start), p2 = proj(wall.end);
      if (Math.max(p1.u, p2.u) < uMin || Math.min(p1.u, p2.u) > uMax) return;
      if ((wall.view || 'plan') === 'foundation') {
        const type = WALL_TYPES.find(w => w.id === wall.wallType);
        fdnFaces.push({
          lo: Math.max(Math.min(p1.u, p2.u), uMin),
          hi: Math.min(Math.max(p1.u, p2.u), uMax),
          depth: (p1.d + p2.d) / 2,
          top: wall.topHeight, base: wall.baseHeight,
          wallIn: type ? type.totalIn : 8,
          bearing: wall.baseHeight <= 0.01,   // on a strip footing, not hung
        });
        return;
      }
      const level = levelById[wall.levelId];
      if (!level || Math.abs(p2.u - p1.u) < 0.5) return;
      faces.push({
        wall, u1: p1.u, u2: p2.u, depth: (p1.d + p2.d) / 2, level,
        garage: garageFor(wall),
      });
    });
    if (!faces.length) return false;
    faces.sort((a, b) => a.depth - b.depth);   // viewer sits on +dir: far first

    // Roof silhouette: at each spot along the cut, the tallest roof surface
    // anywhere along the viewing depth — the ridge/hip outline from outside.
    const roofs = env.roofs();
    const silhouette = [];
    let facesByRoof = null;
    let dLo = Infinity, dHi = -Infinity;
    if (roofs.length) {
      roofs.forEach(roof => (roof.points || []).forEach(pt => {
        const d = pt.x * dir.x + pt.z * dir.z;
        dLo = Math.min(dLo, d); dHi = Math.max(dHi, d);
      }));
      // Silhouette stays sampled (it also feeds shading), but samples the
      // REAL faces — built once here, thousands of queries after.
      facesByRoof = new Map(roofs
        .filter(roof => roof.points && roof.points.length >= 3)
        .map(roof => [roof, geo().roofFaces(roof, geo().roofSkeleton(roof))]));
      const steps = 240, depthSteps = 40;
      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const bx = cut.startPt.x + (cut.endPt.x - cut.startPt.x) * s;
        const bz = cut.startPt.z + (cut.endPt.z - cut.startPt.z) * s;
        const baseD = bx * dir.x + bz * dir.z;
        const elevAt = k => {
          const px = bx + dir.x * (k - baseD), pz = bz + dir.z * (k - baseD);
          let tallest = null;
          facesByRoof.forEach((faces, roof) => {
            const rise = sectionRoofHeightAt({ x: px, z: pz }, roof, faces);
            if (rise == null) return;
            const base = roofBaseElev(roof, stack);
            const elev = base + ROOF_FASCIA_IN / 12 + rise;
            if (tallest === null || elev > tallest.elev) tallest = { elev, base };
          });
          return tallest;
        };
        let best = null, bestK = null;
        for (let j = 0; j <= depthSteps; j++) {
          const k = dLo + (dHi - dLo) * j / depthSteps;
          const sample = elevAt(k);
          if (sample && (best === null || sample.elev > best.elev)) { best = sample; bestK = k; }
        }
        // The true peak (a ridge or hip) usually falls between the coarse
        // samples; ternary-search the bracket around the best one so the
        // silhouette reads the real ridge height at every step.
        if (bestK != null) {
          const dk = (dHi - dLo) / depthSteps;
          let a = bestK - dk, b = bestK + dk;
          for (let it = 0; it < 24; it++) {
            const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
            if ((elevAt(m1)?.elev ?? -Infinity) < (elevAt(m2)?.elev ?? -Infinity)) a = m1;
            else b = m2;
          }
          const refined = elevAt((a + b) / 2);
          if (refined && refined.elev > best.elev) best = refined;
        }
        silhouette.push({
          u: bx * axis.x + bz * axis.z,
          elev: best === null ? null : best.elev,
          base: best === null ? null : best.base,
        });
      }
    }

    const fdn = stack.foundation;
    const lit = silhouette.filter(s => s.elev != null);
    const yTop = fit?.extents ? fit.extents.yTop
      : Math.max(stack.bearing + 4, ...lit.map(s => s.elev + 2));
    const yBottom = fit?.extents ? fit.extents.yBottom : fdn.footingBottom - 2;
    const marginL = fit ? 0 : 64, marginR = fit ? 0 : 24,
      marginT = fit ? 0 : 30, marginB = fit ? 0 : 16;
    const pxPerFt = fit ? fit.pxPerFt : Math.max(2, Math.min(
      (w - marginL - marginR) / Math.max(uMax - uMin, 4),
      (h - marginT - marginB) / Math.max(yTop - yBottom, 8)));
    const x0 = marginL + ((w - marginL - marginR) - (uMax - uMin) * pxPerFt) / 2;
    const y0 = marginT + ((h - marginT - marginB) - (yTop - yBottom) * pxPerFt) / 2;
    const X = u => Math.round(x0 + (u - uMin) * pxPerFt - 0.5) + 0.5;
    const Y = e => Math.round(y0 + (yTop - e) * pxPerFt - 0.5) + 0.5;

    const INK = '#1d1f20';
    header(`${cut.name} — GENERATED ELEVATION`);

    const datum = env.elevationDatum();
    const mark = (elevFt, uEnd) => {
      ctx.strokeStyle = 'rgba(29,31,32,0.25)'; ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(marginL - 18, Y(elevFt));
      ctx.lineTo(uEnd == null ? w - marginR : X(uEnd), Y(elevFt));
      ctx.stroke();
      ctx.fillStyle = 'rgba(29,31,32,0.6)';
      ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(env.elevLabel(elevFt + datum), marginL - 22, Y(elevFt));
    };
    // House level lines stop at the house face — a garage hangs off grade
    // and never carries the house datums across its front.
    const houseFaces = faces.filter(face => !face.garage);
    const houseHi = houseFaces.length
      ? Math.max(...houseFaces.map(face => Math.min(Math.max(face.u1, face.u2), uMax)))
      : uMax;
    stack.floors.forEach(level => { mark(level.floorTop, houseHi); mark(level.wallTop, houseHi); });
    mark(fdn.grade);

    // Foundation faces split at grade. The exposed concrete above grade reads
    // as light grey faces, far to near, with a light-medium crease down each
    // visible corner where two faces meet. Below grade only the outer outline
    // shows, dashed: down the extreme wall edge, out at the footing, across
    // the bottom and back up — one loop per building mass — plus dashed
    // creases at viewer-facing corners and the footing steps under them.
    const CREASE = 'rgba(29,31,32,0.45)';
    const fdnGeoms = fdnFaces
      .filter(face => face.hi - face.lo >= 0.5)
      .map(face => ({
        ...face,
        topE: fdn.wallBottom + face.top,
        baseE: fdn.wallBottom + face.base,
        projFt: face.bearing
          ? Math.max(0, fdn.footingWidthIn - face.wallIn) / 2 / 12 : 0,
      }));
    const exposed = fdnGeoms.filter(g => g.topE > fdn.grade)
      .sort((a, b) => a.depth - b.depth);   // far first
    const fdnHidden = g => exposed.some(o => o !== g
      && o.depth > g.depth + 1e-6
      && o.lo <= g.lo + 0.05 && o.hi >= g.hi - 0.05
      && o.topE >= g.topE - 1e-3
      && Math.max(o.baseE, fdn.grade) <= Math.max(g.baseE, fdn.grade) + 1e-3);
    const shownFdn = exposed.filter(g => !fdnHidden(g));
    shownFdn.forEach(g => {
      const shownBase = Math.max(g.baseE, fdn.grade);
      ctx.fillStyle = '#e8e8ea';
      ctx.fillRect(X(g.lo), Y(g.topE),
        (g.hi - g.lo) * pxPerFt, (g.topE - shownBase) * pxPerFt);
    });
    // Strokes after every fill, so a near face can't erase a far corner.
    ctx.lineWidth = 1;
    const strokedV = new Set();
    shownFdn.forEach(g => {
      const shownBase = Math.max(g.baseE, fdn.grade);
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(X(g.lo), Y(g.topE)); ctx.lineTo(X(g.hi), Y(g.topE));
      ctx.moveTo(X(g.lo), Y(shownBase)); ctx.lineTo(X(g.hi), Y(shownBase));
      ctx.stroke();
      [g.lo, g.hi].forEach(u => {
        const interior = shownFdn.some(o => o !== g
          && u > o.lo + 0.05 && u < o.hi - 0.05);
        const key = `${X(u)}|${interior}`;
        if (strokedV.has(key)) return;
        strokedV.add(key);
        ctx.strokeStyle = interior ? CREASE : INK;
        ctx.beginPath();
        ctx.moveTo(X(u), Y(g.topE)); ctx.lineTo(X(u), Y(shownBase));
        ctx.stroke();
      });
    });

    // Underground: outline-only loops, one per building mass, gaps preserved.
    const buried = fdnGeoms.filter(g => g.baseE < fdn.grade)
      .sort((a, b) => a.lo - b.lo);
    const bottomOf = g => g.bearing ? g.baseE - fdn.footingIn / 12 : g.baseE;
    const runs = [];
    buried.forEach(g => {
      const last = runs[runs.length - 1];
      if (last && g.lo <= last.hi + 0.5) {
        last.hi = Math.max(last.hi, g.hi);
        last.faces.push(g);
      } else runs.push({ lo: g.lo, hi: g.hi, faces: [g] });
    });
    ctx.strokeStyle = 'rgba(29,31,32,0.5)'; ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    runs.forEach(run => {
      const edgeFace = u => run.faces.reduce((best, g) =>
        Math.min(Math.abs(g.lo - u), Math.abs(g.hi - u))
          < Math.min(Math.abs(best.lo - u), Math.abs(best.hi - u)) ? g : best);
      const leftF = edgeFace(run.lo), rightF = edgeFace(run.hi);
      // Bottom silhouette: the deepest concrete under each stretch of the
      // run — a footing under bearing walls, the beam base where it hangs.
      const bottomAt = u => Math.min(...run.faces
        .filter(g => g.lo - 1e-6 <= u && u <= g.hi + 1e-6)
        .map(bottomOf));
      const stops = [...new Set(run.faces.flatMap(g => [g.lo, g.hi]))]
        .sort((a, b) => a - b);
      ctx.beginPath();
      ctx.moveTo(X(run.lo), Y(Math.min(leftF.topE, fdn.grade)));
      ctx.lineTo(X(run.lo), Y(leftF.baseE));
      if (leftF.projFt > 0) ctx.lineTo(X(run.lo - leftF.projFt), Y(leftF.baseE));
      ctx.lineTo(X(run.lo - leftF.projFt), Y(bottomOf(leftF)));
      let prevBottom = bottomOf(leftF);
      for (let s = 0; s < stops.length - 1; s++) {
        const b = bottomAt((stops[s] + stops[s + 1]) / 2);
        const xe = stops[s + 1] === run.hi ? run.hi + rightF.projFt : stops[s + 1];
        if (b !== prevBottom) ctx.lineTo(X(stops[s]), Y(b));
        ctx.lineTo(X(xe), Y(b));
        prevBottom = b;
      }
      if (prevBottom !== bottomOf(rightF)) {
        ctx.lineTo(X(run.hi + rightF.projFt), Y(bottomOf(rightF)));
      }
      if (rightF.projFt > 0) {
        ctx.lineTo(X(run.hi + rightF.projFt), Y(rightF.baseE));
        ctx.lineTo(X(run.hi), Y(rightF.baseE));
      }
      ctx.lineTo(X(run.hi), Y(Math.min(rightF.topE, fdn.grade)));
      ctx.stroke();
      // Viewer-facing corner creases: where a nearer buried face ends inside
      // a farther one, the corner runs down the wall — and its footing turns
      // a little further over with its own short crease.
      run.faces.forEach(g => {
        [g.lo, g.hi].forEach(u => {
          const behind = run.faces.some(o => o !== g
            && o.depth < g.depth - 1e-6
            && u > o.lo + 0.05 && u < o.hi - 0.05);
          if (!behind) return;
          ctx.beginPath();
          ctx.moveTo(X(u), Y(Math.min(g.topE, fdn.grade)));
          ctx.lineTo(X(u), Y(g.baseE));
          ctx.stroke();
          if (g.projFt > 0) {
            const out = u === g.lo ? u - g.projFt : u + g.projFt;
            ctx.beginPath();
            ctx.moveTo(X(out), Y(g.baseE));
            ctx.lineTo(X(out), Y(bottomOf(g)));
            ctx.stroke();
          }
        });
      });
    });
    ctx.setLineDash([]);

    // A thickened-edge detached slab has no foundation walls: its band is
    // the monolithic pour itself — the 4" face proud of grade, the 1'-0"
    // perimeter edge buried and dashed.
    env.floors()
      .filter(floor => (floor.view || 'plan') === 'foundation'
        && floor.garage && floor.thickenedEdge && floor.points.length >= 3)
      .forEach(slab => {
        const us = slab.points.map(pt => pt.x * axis.x + pt.z * axis.z);
        const lo = Math.max(Math.min(...us), uMin);
        const hi = Math.min(Math.max(...us), uMax);
        if (hi - lo < 0.5) return;
        const top = fdn.grade + GARAGE_SLAB_THICKNESS_IN / 12;
        const x = X(lo), wid = (hi - lo) * pxPerFt;
        ctx.fillStyle = '#e8e8ea';
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(x, Y(top), wid, (top - fdn.grade) * pxPerFt);
        ctx.strokeRect(x, Y(top), wid, (top - fdn.grade) * pxPerFt);
        ctx.strokeStyle = 'rgba(29,31,32,0.5)'; ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x, Y(fdn.grade), wid,
          (GARAGE_EDGE_DEPTH_IN / 12 - (top - fdn.grade)) * pxPerFt);
        ctx.setLineDash([]);
      });

    // Wall faces, far to near, each with the openings it hosts. A garage
    // face stands on its own bearing — the beam plate or the slab — so its
    // face and its doors run down to that, not to the house floor.
    const garageBase = garage => garage.open === true
      ? fdn.grade + GARAGE_BEAM_ABOVE_GRADE_FT + GARAGE_BEAM_PLATE_IN / 12
      : env.garageFoundation(garage) === 'thickened'
        ? fdn.grade + GARAGE_SLAB_THICKNESS_IN / 12
        : fdn.grade + (DETACHED_BEAM_ABOVE_GRADE_IN + GARAGE_BEAM_PLATE_IN) / 12;
    const HEAD_FT = 6 + 10 / 12, SILL_FT = 3;
    // A gable-end wall climbs to the roof: where a roof bearing on this
    // wall's plate runs a GABLE edge just past the face, the top of the
    // wall follows the underside of the rakes — the triangle between the
    // plate and the ridge is wall, not sky.
    const distToSegment = (p, a, b) => {
      const dx = b.x - a.x, dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
      return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
    };
    // Only a wall running ALONG the gable climbs; a perpendicular wall
    // passing the gable's corner keeps its plate.
    const gableTopAt = (pt, plateTop, wallDir) => {
      let top = plateTop;
      if (!facesByRoof) return top;
      facesByRoof.forEach((roofFaces, roof) => {
        const base = roofBaseElev(roof, stack);
        if (Math.abs(base - plateTop) > 0.6) return;   // bears on another storey
        const reach = (Number(roof.overhang) || 0) + 1;
        const pts = roof.points || [];
        const nearGable = pts.some((a, i) => {
          if (roof.edges?.[i] !== 'gable') return false;
          const b = pts[(i + 1) % pts.length];
          if (wallDir) {
            const gx = b.x - a.x, gz = b.z - a.z;
            const gLen = Math.hypot(gx, gz) || 1;
            const cross = Math.abs(wallDir.x * gz - wallDir.z * gx) / gLen;
            if (cross > 0.2) return false;
          }
          return distToSegment(pt, a, b) <= reach;
        });
        if (!nearGable) return;
        const rise = sectionRoofHeightAt(pt, roof, roofFaces);
        if (rise == null) return;
        top = Math.max(top, base + rise);   // wall stops under the fascia
      });
      return top;
    };
    // A wall standing BEHIND a nearer roof is not visible through it. Walls
    // hide each other by the painter's algorithm — far first, each filled
    // opaque before it is stroked — and `faceHidden` skips the ones a nearer
    // wall swallows whole. Roofs never joined that: the roof passes stroke
    // edges onto the paper and fill nothing, so no wall has ever been hidden
    // by one. A far wing's gable-end wall therefore climbed its triangle
    // straight through a nearer wing's roof, which is the see-through this
    // board was raised for.
    //
    // Along the sightline a roof sheet covers a BAND of the elevation it
    // projects onto: from the lowest surface the ray crosses, less the
    // fascia hanging off that edge, up to the highest. The band, not a bare
    // height comparison, is the test — a gable's OWN roof stands nearer than
    // its wall and higher than its plate, yet sits on that wall rather than
    // in front of it. `gableTopAt` returns `base + rise` and the band's floor
    // works out to the same `base + rise` for that roof, so a wall is never
    // clipped by the roof it carries; EPS covers the float noise between two
    // spellings of one number.
    //
    // Only surfaces STRICTLY NEARER than the wall may hide it, so the ray runs
    // from the wall toward the viewer, the way `hidden()` does — but EXACTLY,
    // by clipping the real face polygons against it the way the section
    // painter does, not by marching stations. `roofFaceRise` is linear across
    // a face, so a piece's two ends bracket every height along it and the
    // band is read straight off the breakpoints. A sampled march put the
    // band's floor wherever a station happened to land — up to half a foot
    // above the eave it was meant to find, leaving a sliver of wall top
    // standing above a roof that covers it.
    // Each roof is banded ON ITS OWN. Merged, a low detached-garage roof and
    // the house roof behind it would read as one mass filling everything
    // between them, and a wall top standing in the clear air between the two
    // would be hidden by neither of them.
    const ROOF_COVER_EPS = 0.02;
    // A wall only hides what stands behind it: an eave overhanging toward the
    // viewer clears its own wall by the overhang, and a rake clears its gable
    // wall the same way, so the margin only has to beat float noise.
    const WALL_COVER_EPS = 0.05;
    // A roof edge landing exactly on a wall's END is at the corner, not behind
    // it: the flush cut where a garage roof dies into the house, and the ridge
    // starting off that wall, both sit on that line and stay drawn.
    const WALL_EDGE_EPS = 0.05;
    const fasciaFt = ROOF_FASCIA_IN / 12;
    const roofClippedTop = (pt, depth, top) => {
      if (!facesByRoof || !facesByRoof.size) return top;
      const span = dHi - depth;
      if (span < 0.1) return top;
      const far = { x: pt.x + dir.x * span, z: pt.z + dir.z * span };
      let clipped = top;
      facesByRoof.forEach((roofFaces, roof) => {
        const base = roofBaseElev(roof, stack) + fasciaFt;
        let lo = Infinity, hi = -Infinity;
        geo().roofProfile(roof, roofFaces, pt, far, dir).forEach(p => {
          const elev = base + p.rise;
          if (elev > hi) hi = elev;
          if (elev < lo) lo = elev;
        });
        if (hi === -Infinity) return;   // the ray misses this roof entirely
        lo -= fasciaFt;
        if (top > lo + ROOF_COVER_EPS && top <= hi + ROOF_COVER_EPS) clipped = Math.min(clipped, lo);
      });
      return clipped;
    };
    const faceGeoms = faces.map(face => {
      const { wall, u1, u2, level } = face;
      const loU = Math.max(Math.min(u1, u2), uMin);
      const hiU = Math.min(Math.max(u1, u2), uMax);
      const floor = face.garage ? garageBase(face.garage) : level.floorTop;
      const worldAt = u => {
        const t = (u - u1) / (u2 - u1);
        return {
          x: wall.start.x + (wall.end.x - wall.start.x) * t,
          z: wall.start.z + (wall.end.z - wall.start.z) * t,
        };
      };
      const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) || 1;
      const wallDir = {
        x: (wall.end.x - wall.start.x) / wallLen,
        z: (wall.end.z - wall.start.z) / wallLen,
      };
      const samples = Math.min(64, Math.max(2, Math.ceil((hiU - loU) / 0.5)));
      const tops = [];
      for (let s = 0; s <= samples; s++) {
        const u = loU + (hiU - loU) * s / samples;
        const at = worldAt(u);
        // Dropped to the floor of a nearer roof's band when that band swallows
        // the wall's top. What is left below still meets the nearer WALLS, and
        // the painter's opaque fill goes on covering that the way it always has.
        // Never below the face's own floor: a band floor under this storey
        // would turn the face inside out rather than hide it.
        const top = Math.max(floor, roofClippedTop(at, face.depth,
          gableTopAt(at, level.wallTop, wallDir)));
        tops.push({ u, top });
      }
      return { face, loU, hiU, floor, worldAt, wallDir, tops };
    });
    // A face standing entirely behind a nearer, taller face paints nothing
    // visible; skipping it keeps the shared corner verticals single-stroked.
    const faceHidden = geom => faceGeoms.some(other =>
      other !== geom && other.face.depth > geom.face.depth + 1e-6
      && other.loU <= geom.loU + 0.05 && other.hiU >= geom.hiU - 0.05
      && other.floor <= geom.floor + 1e-3
      && geom.tops.every(s =>
        gableTopAt(other.worldAt(s.u), other.face.level.wallTop, other.wallDir) >= s.top - 1e-3));
    faceGeoms.filter(geom => !faceHidden(geom)).forEach(geom => {
      const { face, loU, hiU, floor, tops } = geom;
      const { wall, u1, u2, level } = face;
      const xa = X(loU), xb = X(hiU);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(xa, Y(floor));
      tops.forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.lineTo(xb, Y(floor));
      ctx.closePath();
      ctx.fill();
      // The wall finish runs into the soffit triangle: end verticals stop
      // at the plate, only the top profile follows the roof underside.
      ctx.beginPath();
      ctx.moveTo(xa, Y(floor));
      ctx.lineTo(xa, Y(Math.min(tops[0].top, level.wallTop)));
      ctx.moveTo(X(tops[0].u), Y(tops[0].top));
      tops.slice(1).forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.moveTo(xb, Y(Math.min(tops[tops.length - 1].top, level.wallTop)));
      ctx.lineTo(xb, Y(floor));
      ctx.lineTo(xa, Y(floor));
      ctx.stroke();
      const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      if (wallLen < 1e-6) return;
      const du = (u2 - u1) / wallLen;
      env.fenestrations().filter(f => f.wallId === wall.id).forEach(f => {
        const uc = u1 + du * f.offset;
        const half = Math.abs(du) * f.width / 2;
        const ox = X(Math.max(uc - half, uMin)), ow = X(Math.min(uc + half, uMax)) - ox;
        if (ow <= 0) return;
        const head = f.headHeight > 0 ? f.headHeight : HEAD_FT;
        const sill = f.sillHeight > 0 ? f.sillHeight : SILL_FT;
        const top = Math.min(floor + head, level.wallTop);
        const bottom = f.type === 'door' ? floor : floor + sill;
        ctx.fillStyle = '#fafafa';
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(ox, Y(top), ow, (top - bottom) * pxPerFt);
        ctx.strokeRect(ox, Y(top), ow, (top - bottom) * pxPerFt);
        const clipped = uc - half < uMin - 1e-6 || uc + half > uMax + 1e-6;
        if (clipped) return;
        if (f.type === 'door' && !f.garage) {
          // Flat slab door face with a round knob at handle height on the
          // latch side.
          const knobR = Math.max(1.5, (1.25 / 12) * pxPerFt);
          const kx = ox + ow - (2.5 / 12) * pxPerFt;
          const ky = Y(Math.min(floor + 3, (top + bottom) / 2));
          ctx.beginPath(); ctx.arc(kx, ky, knobR, 0, Math.PI * 2); ctx.stroke();
        } else if (f.type === 'window') {
          // The unit's frame face inside the rough opening: a 2"-wide border
          // around the glazing.
          const inset = (2 / 12) * pxPerFt;
          if (ow > inset * 3 && (top - bottom) * pxPerFt > inset * 3) {
            ctx.strokeRect(ox + inset, Y(top) + inset, ow - inset * 2, (top - bottom) * pxPerFt - inset * 2);
          }
        }
      });
    });

    // Floor assembly bands: each floor's rim (joists + sheathing) is part of
    // the house face — white like the walls, no banding line, keeping the
    // vertical edges of every visible face corner through the band.
    const houseSpans = houseFaces.map(face => ({
      lo: Math.max(Math.min(face.u1, face.u2), uMin),
      hi: Math.min(Math.max(face.u1, face.u2), uMax),
      depth: face.depth,
      levelId: face.level.id,
    })).filter(span => span.hi - span.lo >= 0.5);
    const edgeVisible = (u, depth) => !houseSpans.some(other =>
      other.depth > depth + 1e-6 && other.lo < u - 0.05 && other.hi > u + 0.05);
    // The rim bands are part of the opaque house face, so the roof pass reads
    // them alongside the walls: between one storey's plate and the next
    // storey's floor there is no wall face, and a roof behind the house at
    // exactly that height would otherwise show through the joist band.
    const rimBands = [];
    stack.floors.forEach(level => {
      const spans = houseSpans.filter(span => span.levelId === level.id);
      if (!spans.length) return;
      // Contiguous runs of face coverage — a level with two separate wings
      // wears two rim bands, not one across the gap between them.
      const runs = [];
      spans.slice().sort((a, b) => a.lo - b.lo).forEach(span => {
        const last = runs[runs.length - 1];
        if (last && span.lo <= last.hi + 0.5) last.hi = Math.max(last.hi, span.hi);
        else runs.push({ lo: span.lo, hi: span.hi });
      });
      const yTopPx = Y(level.floorTop) - 1, yBotPx = Y(level.floorBottom) + 1;
      ctx.fillStyle = '#fff';
      runs.forEach(run => {
        if (run.hi - run.lo < 0.5) return;
        ctx.fillRect(X(run.lo) - 1, yTopPx, (run.hi - run.lo) * pxPerFt + 2, yBotPx - yTopPx);
        const depth = Math.max(...spans
          .filter(span => span.hi > run.lo && span.lo < run.hi)
          .map(span => span.depth));
        rimBands.push({ lo: run.lo, hi: run.hi, bottom: level.floorBottom, top: level.floorTop, depth });
      });
      // Vertical edges through the band: the run boundaries plus any face
      // corner inside a run that isn't hidden behind a nearer face — a jog
      // in the facade keeps its corner line crossing the floor.
      const edges = new Set();
      runs.filter(run => run.hi - run.lo >= 0.5).forEach(run => {
        edges.add(run.lo); edges.add(run.hi);
        spans.forEach(span => [span.lo, span.hi].forEach(u => {
          if (u > run.lo + 0.05 && u < run.hi - 0.05 && edgeVisible(u, span.depth)) edges.add(u);
        }));
      });
      ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
      ctx.beginPath();
      edges.forEach(u => { ctx.moveTo(X(u), yTopPx); ctx.lineTo(X(u), yBotPx); });
      ctx.stroke();
    });

    // Roof silhouette over the faces, with the fascia band along the eave.
    const drawnFascia = [];
    if (lit.length > 1) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let pen = null, prevLit = false;
      silhouette.forEach(s => {
        if (s.elev == null) {
          if (pen) ctx.lineTo(X(pen.u), Y(pen.base));
          pen = null; prevLit = false;
          return;
        }
        if (pen && pen.base !== s.base) {
          ctx.lineTo(X(pen.u), Y(pen.base));
          pen = null;
        }
        // The riser down to the base closes the outline against open air. A
        // roof taking over from another — a garage roof running on under the
        // house's overhang — has no vertical edge, so it starts at its surface.
        if (!pen && !prevLit) { ctx.moveTo(X(s.u), Y(s.base)); ctx.lineTo(X(s.u), Y(s.elev)); }
        else if (!pen) ctx.moveTo(X(s.u), Y(s.elev));
        else ctx.lineTo(X(s.u), Y(s.elev));
        pen = s; prevLit = true;
      });
      if (pen) ctx.lineTo(X(pen.u), Y(pen.base));
      ctx.stroke();
      // Fascia band per eave run — a run breaks where the roof drops out or
      // where a differently-based roof (the garage) takes over the front.
      // The fascia's lower edge carries the roof's shadow — the heaviest
      // roof line on the sheet.
      const runs = [];
      let run = null;
      silhouette.forEach(s => {
        if (s.elev == null || (run && run.base !== s.base)) run = null;
        if (s.elev == null) return;
        if (!run) { run = { base: s.base, u0: s.u, u1: s.u }; runs.push(run); }
        else run.u1 = s.u;
      });
      runs.filter(r => r.u1 - r.u0 > 0.5).forEach(r => {
        drawnFascia.push(r);
        ctx.strokeStyle = 'rgba(29,31,32,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(r.u0), Y(r.base + ROOF_FASCIA_IN / 12));
        ctx.lineTo(X(r.u1), Y(r.base + ROOF_FASCIA_IN / 12));
        ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
        ctx.beginPath();
        ctx.moveTo(X(r.u0), Y(r.base));
        ctx.lineTo(X(r.u1), Y(r.base));
        ctx.stroke();
      });
    }

    // Visible roof edges — eaves, rakes, ridges, hips and valleys — from the
    // real face polygons, drawn wherever no nearer roof surface stands in
    // front. The silhouette only ever answers with the tallest surface at
    // each spot, so a near wing's eave and a viewer-facing gable's rakes
    // stayed invisible behind a taller wing; this pass walks every face edge
    // and hides only the truly hidden stretches.
    if (facesByRoof && facesByRoof.size) {
      // Hidden when a nearer roof covers the point on the paper: the band it
      // projects onto, from the lowest surface the ray crosses (less its
      // fascia) up to the highest — the test `roofClippedTop` runs for walls.
      // A taller roof behind does not hide what passes under it, so each roof
      // is banded on its own rather than compared by height.
      // A roof standing behind a nearer WALL is not visible through it. The
      // wall pass fills opaque and the roof pass strokes over it afterwards,
      // so an attached garage's roof — which dies into the house wall with no
      // eave on that side — drew its whole gable, fascia and all, straight
      // through two storeys of house when the elevation was taken from the
      // far side. Faces carry the tops the wall pass already worked out
      // (plate, gable climb, roof clip), so the cover test is the wall's own
      // painted profile read at the point's u.
      const topAtU = (geom, u) => {
        const tops = geom.tops;
        if (u <= tops[0].u) return tops[0].top;
        for (let i = 1; i < tops.length; i++) {
          if (u > tops[i].u) continue;
          const lo = tops[i - 1], hi = tops[i];
          const t = (u - lo.u) / ((hi.u - lo.u) || 1);
          return lo.top + (hi.top - lo.top) * t;
        }
        return tops[tops.length - 1].top;
      };
      const behindWall = (pt, u, elev) => {
        const depth = pt.x * dir.x + pt.z * dir.z;
        return faceGeoms.some(geom => geom.face.depth > depth + WALL_COVER_EPS
          && u > geom.loU + WALL_EDGE_EPS && u < geom.hiU - WALL_EDGE_EPS
          && elev > geom.floor - ROOF_COVER_EPS
          && elev < topAtU(geom, u) - ROOF_COVER_EPS)
        || rimBands.some(band => band.depth > depth + WALL_COVER_EPS
          && u > band.lo + WALL_EDGE_EPS && u < band.hi - WALL_EDGE_EPS
          && elev > band.bottom - ROOF_COVER_EPS && elev < band.top + ROOF_COVER_EPS);
      };
      const hidden = (pt, elev, u) => {
        const depth = pt.x * dir.x + pt.z * dir.z;
        if (u != null && behindWall(pt, u, elev)) return true;
        const span = dHi - depth;
        if (span < 0.1) return false;
        // From just in front of the point, so a surface never hides itself.
        const near = { x: pt.x + dir.x * 0.05, z: pt.z + dir.z * 0.05 };
        const far = { x: pt.x + dir.x * span, z: pt.z + dir.z * span };
        let covered = false;
        facesByRoof.forEach((roofFaces, roof) => {
          if (covered) return;
          const base = roofBaseElev(roof, stack) + fasciaFt;
          let lo = Infinity, hi = -Infinity;
          geo().roofProfile(roof, roofFaces, near, far, dir).forEach(p => {
            const e = base + p.rise;
            if (e > hi) hi = e;
            if (e < lo) lo = e;
          });
          if (hi === -Infinity) return;   // the ray misses this roof entirely
          lo -= fasciaFt;
          if (elev > lo + ROOF_COVER_EPS && elev < hi - ROOF_COVER_EPS) covered = true;
        });
        return covered;
      };
      const seen = new Set();
      facesByRoof.forEach((roofFaces, roof) => {
        const eaveTop = roofBaseElev(roof, stack) + ROOF_FASCIA_IN / 12;
        const pitch = roof.pitch || 4;
        const rpts = roof.points || [];
        const gableSegs = rpts.flatMap((a, i) => (roof.edges?.[i] === 'gable'
          ? [{ a, b: rpts[(i + 1) % rpts.length] }] : []));
        // A rake LIES ALONG one gable edge; a ridge spanning gable-to-gable
        // (the dropped garage) touches two different ones and is no rake.
        const onGable = (p, q) => gableSegs.some(s =>
          distToSegment(p, s.a, s.b) < 0.1 && distToSegment(q, s.a, s.b) < 0.1);
        roofFaces.forEach(face => {
          const poly = face.points;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            const key = [a, b].map(p => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).sort().join('|');
            if (seen.has(key)) continue;   // shared ridge/hip/valley: once is enough
            seen.add(key);
            const ea = eaveTop + geo().roofFaceRise(face, a, pitch);
            const eb = eaveTop + geo().roofFaceRise(face, b, pitch);
            const ua = a.x * axis.x + a.z * axis.z;
            const ub = b.x * axis.x + b.z * axis.z;
            if (Math.abs(ub - ua) < 0.05 && Math.abs(eb - ea) < 0.05) continue; // end-on: a point
            const samples = Math.min(48, Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5)));
            const runs = [];
            let run = null;
            for (let s = 0; s <= samples; s++) {
              const t = s / samples;
              const pt = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
              const u = ua + (ub - ua) * t;
              const elev = ea + (eb - ea) * t;
              if (u < uMin - 0.01 || u > uMax + 0.01 || hidden(pt, elev, u)) { run = null; continue; }
              if (!run) { run = { u0: u, e0: elev, u1: u, e1: elev }; runs.push(run); }
              else { run.u1 = u; run.e1 = elev; }
            }
            const eave = Math.abs(ea - eaveTop) < 0.01 && Math.abs(eb - eaveTop) < 0.01;
            const rake = !eave && onGable(a, b);
            // A run of a single station paints nothing, and the corner it
            // stands on is not "shown" for the soffit return either — a rake
            // hidden behind the house all but its bottom point once hung its
            // soffit line off that one surviving station.
            const drawn = runs.filter(r =>
              Math.abs(r.u1 - r.u0) > 0.05 || Math.abs(r.e1 - r.e0) > 0.05);
            drawn.forEach(r => {
              if (eave) {
                // An eave wears the fascia band: the light top line and the
                // heavy shadow along its bottom, same inks as the silhouette's.
                // Stretches the silhouette pass already banded stay drawn
                // once: subtract its runs at this elevation, keep the rest.
                let spans = [{ u0: Math.min(r.u0, r.u1), u1: Math.max(r.u0, r.u1) }];
                drawnFascia
                  .filter(f => Math.abs(f.base + ROOF_FASCIA_IN / 12 - eaveTop) < 0.05)
                  .forEach(f => {
                    spans = spans.flatMap(sp => {
                      if (f.u1 <= sp.u0 + 0.05 || f.u0 >= sp.u1 - 0.05) return [sp];
                      const keep = [];
                      if (f.u0 > sp.u0 + 0.05) keep.push({ u0: sp.u0, u1: f.u0 });
                      if (f.u1 < sp.u1 - 0.05) keep.push({ u0: f.u1, u1: sp.u1 });
                      return keep;
                    });
                  });
                spans.filter(sp => sp.u1 - sp.u0 > 0.2).forEach(sp => {
                  ctx.strokeStyle = 'rgba(29,31,32,0.6)'; ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(X(sp.u0), Y(eaveTop)); ctx.lineTo(X(sp.u1), Y(eaveTop));
                  ctx.stroke();
                  ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
                  ctx.beginPath();
                  ctx.moveTo(X(sp.u0), Y(eaveTop - ROOF_FASCIA_IN / 12));
                  ctx.lineTo(X(sp.u1), Y(eaveTop - ROOF_FASCIA_IN / 12));
                  ctx.stroke();
                });
              } else if (rake && Math.abs(r.u1 - r.u0) > 0.2) {
                // A rake wears its fascia too: the sloped board along the
                // gable edge, top line light, heavy shadow 5.5" under it.
                const drop = ROOF_FASCIA_IN / 12;
                ctx.strokeStyle = 'rgba(29,31,32,0.6)'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(X(r.u0), Y(r.e0)); ctx.lineTo(X(r.u1), Y(r.e1));
                ctx.stroke();
                ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
                ctx.beginPath();
                ctx.moveTo(X(r.u0), Y(r.e0 - drop)); ctx.lineTo(X(r.u1), Y(r.e1 - drop));
                ctx.stroke();
              } else {
                ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(X(r.u0), Y(r.e0)); ctx.lineTo(X(r.u1), Y(r.e1));
                ctx.stroke();
              }
            });
            const overhang = Number(roof.overhang) || 0;
            if (rake && drawn.length && overhang > 0.05) {
              // The metal soffit closes the corner: a line from the low
              // point of the rake fascia straight back to the house wall,
              // the flat soffit plane under the eave-overhang triangle.
              // The reach back to the wall runs ALONG the rake's plan
              // direction — the EAVE-side offset at the corner — so it is
              // measured by projecting the corner's BONEYARD master point
              // (the wall corner it was offset from) onto that direction.
              // Halved-gable builds (board #252) and intent-pulled edges
              // both land the line exactly on the wall face this way;
              // roof.overhang stays the fallback for unlinked roofs.
              const drop = ROOF_FASCIA_IN / 12;
              const lo = ea <= eb ? { p: a, u: ua, e: ea } : { p: b, u: ub, e: eb };
              const hi = ea <= eb ? { p: b, u: ub, e: eb } : { p: a, u: ua, e: ea };
              const len = Math.hypot(hi.p.x - lo.p.x, hi.p.z - lo.p.z) || 1;
              const rux = (hi.p.x - lo.p.x) / len, ruz = (hi.p.z - lo.p.z) / len;
              const srcPt = rpts.find(rp => Math.hypot(rp.x - lo.p.x, rp.z - lo.p.z) < 0.05);
              const masterPt = srcPt?.srcId ? env.masterPointById(srcPt.srcId) : null;
              const along = masterPt
                ? (masterPt.x - lo.p.x) * rux + (masterPt.z - lo.p.z) * ruz : NaN;
              const reach = Number.isFinite(along) && along > 0.05 ? along : overhang;
              const wallU = (lo.p.x + rux * reach) * axis.x + (lo.p.z + ruz * reach) * axis.z;
              const shown = drawn.some(r => Math.min(r.u0, r.u1) - 0.1 <= lo.u
                && lo.u <= Math.max(r.u0, r.u1) + 0.1);
              if (shown && reach > 0.05 && Math.abs(wallU - lo.u) > 0.2
                && lo.u >= uMin - 0.01 && lo.u <= uMax + 0.01) {
                const wallUc = Math.max(uMin, Math.min(uMax, wallU));
                ctx.strokeStyle = INK; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(X(lo.u), Y(lo.e - drop));
                ctx.lineTo(X(wallUc), Y(lo.e - drop));
                ctx.stroke();
                // GABLE CORNER treatments (board #252). Everything below is
                // metal matching the fascia — one blended family, drawn in
                // the soffit/crease inks, never the heavy silhouette.
                const style = env.gableCornerStyle();
                const du = hi.u - lo.u;
                if (Math.abs(du) > 0.3) {
                  const undersideAt = u => lo.e + (u - lo.u) / du * (hi.e - lo.e) - drop;
                  if (style === 'return') {
                    // SOFFIT RETURN: the eave soffit wraps the corner — a
                    // short cornice-return band continuing the eave fascia
                    // across the gable face, capped with a vertical seam.
                    const dirIn = Math.sign(wallU - lo.u) || 1;
                    const retLen = Math.min(Math.abs(wallU - lo.u), 1.25);
                    const uEnd = lo.u + dirIn * retLen;
                    ctx.strokeStyle = 'rgba(29,31,32,0.6)'; ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(X(lo.u), Y(lo.e)); ctx.lineTo(X(uEnd), Y(lo.e));
                    ctx.stroke();
                    ctx.strokeStyle = INK; ctx.lineWidth = 2.25;
                    ctx.beginPath();
                    ctx.moveTo(X(lo.u), Y(lo.e - drop)); ctx.lineTo(X(uEnd), Y(lo.e - drop));
                    ctx.stroke();
                    ctx.lineWidth = 1.25;
                    ctx.beginPath();
                    ctx.moveTo(X(uEnd), Y(lo.e));
                    ctx.lineTo(X(uEnd), Y(lo.e - drop));
                    ctx.stroke();
                  } else if (style === 'porkchop' || style === 'boxed') {
                    // PORK CHOP: the boxed corner return — the little
                    // pyramid between the rake underside, the soffit line,
                    // and this inner vertical face at the wall. (The
                    // vertical the owner removed from FLAT CLOSE returns
                    // here on purpose: this corner is metal, not wall
                    // finish, so the seam against the wall exists.)
                    ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
                    ctx.beginPath();
                    ctx.moveTo(X(wallUc), Y(lo.e - drop));
                    ctx.lineTo(X(wallUc), Y(undersideAt(wallU)));
                    ctx.stroke();
                    if (style === 'boxed') {
                      // FULL BOXED RAKE: the pork chop soffit runs end to
                      // end — the box's wall-side edge parallels the rake
                      // underside the whole way up, stopping under the
                      // apex where it meets its twin from the other slope
                      // in a single peak vertex.
                      const peakE = lo.e - drop + (hi.u - wallU) / du * (hi.e - lo.e);
                      ctx.lineWidth = 1;
                      ctx.beginPath();
                      ctx.moveTo(X(wallUc), Y(lo.e - drop));
                      ctx.lineTo(X(Math.max(uMin, Math.min(uMax, hi.u))), Y(peakE));
                      ctx.stroke();
                    }
                  }
                }
              }
            }
          }
        });
        // The fascia creases at every plan corner: where the roof edge
        // changes direction (an outside corner, or a valley landing on a
        // re-entrant one) a thin vertical seam crosses the 5.5" band.
        rpts.forEach((pt, i) => {
          const prev = rpts[(i + rpts.length - 1) % rpts.length];
          const next = rpts[(i + 1) % rpts.length];
          const kindPrev = roof.edges?.[(i + rpts.length - 1) % rpts.length];
          const kindNext = roof.edges?.[i];
          if (kindPrev === 'gable' && kindNext === 'gable') return;
          const d1 = { x: pt.x - prev.x, z: pt.z - prev.z };
          const d2 = { x: next.x - pt.x, z: next.z - pt.z };
          const cross = d1.x * d2.z - d1.z * d2.x;
          const l1 = Math.hypot(d1.x, d1.z), l2 = Math.hypot(d2.x, d2.z);
          if (l1 < 0.05 || l2 < 0.05 || Math.abs(cross) < 0.02 * l1 * l2) return;
          const u = pt.x * axis.x + pt.z * axis.z;
          if (u < uMin - 0.01 || u > uMax + 0.01 || hidden(pt, eaveTop, u)) return;
          ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(X(u), Y(eaveTop));
          ctx.lineTo(X(u), Y(eaveTop - ROOF_FASCIA_IN / 12));
          ctx.stroke();
        });
      });
    }

    // Grade, heavy, straight across the sheet — the exposed concrete stands
    // on it and everything below it reads dashed.
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginL - 18, Y(fdn.grade));
    ctx.lineTo(w - marginR, Y(fdn.grade));
    ctx.stroke();
    return true;
  }

  window.DraftCutView = Object.freeze({
    STANDARDS: Object.freeze({
      GARAGE_SLAB_THICKNESS_IN,
      GARAGE_BEAM_PLATE_IN,
    GARAGE_BEAM_CONCRETE_IN,
      GRADE_BELOW_FOUNDATION_TOP_FT,
      GARAGE_BEAM_ABOVE_GRADE_FT,
      DETACHED_BEAM_ABOVE_GRADE_IN,
      GARAGE_EDGE_DEPTH_IN,
      ROOF_FASCIA_IN,
    }),
    sectionLevelStack,
    sectionWallCrossings,
    cutViewExtents,
    roofBaseElev,
    sectionRoofHeightAt,
    drawCutView,
    drawSectionWall,
    drawElevationView,
  });
})();
}
