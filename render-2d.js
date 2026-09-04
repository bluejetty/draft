// 2D overlay painters extracted pure from the Model Space: canvas context,
// world→screen transform, the thing to draw, and an env object naming every
// outside dependency — no component state, no THREE, no DOM beyond the ctx.
// Draw order stays with the caller; these paint exactly one thing each.
if (!window.DraftRender2D) {
(() => {
  function drawWallSeg2D(ctx, toS, seg, preview, joins, mode, env) {
    // The wall's own two colours, resolved once. Fallbacks are the literals
    // this painter hardcoded before the roles existed, which are exactly the
    // DAY values -- so a caller that supplies no colours keeps the look it
    // has today rather than painting undefined (transparent black).
    //
    // Why it mattered: on the night skin the edge literal '#1d1f20' IS the
    // page colour. Contrast 1.00. Every end cap crossing bare paper was drawn
    // in invisible ink, and the wall read as a bare white slab.
    //
    // Material fills (concrete, insulation) are deliberately NOT skinned. They
    // are a legend, not a theme: a concrete wall has to read as concrete on
    // both skins, so those keep their own colours.
    const wallColors    = env.colors || {};
    const wallFill      = wallColors.wall            || '#ffffff';
    const wallFillPrev  = wallColors.wallPreview     || 'rgba(255,255,255,0.8)';
    const wallEdge      = wallColors.wallEdge        || '#1d1f20';
    const wallEdgePrev  = wallColors.wallEdgePreview || 'rgba(29,31,32,0.45)';
    const wtDef = env.wallTypes.find(w => w.id === (seg.wallType || 'stud_2x6')) || env.wallTypes[1];
    const totalFt = wtDef.totalIn / 12;
    const half = totalFt / 2;

    // Reference-line offset: where does the drawn line sit on the wall assembly?
    // 'left'   → drawn line = exterior left face;  wall body fills to the right (+perp)
    // 'right'  → drawn line = exterior right face; wall body fills to the left (−perp)
    // 'center' → drawn line = centreline; fills symmetrically on both sides
    const refLine  = seg.refLine || 'center';
    const startOff = refLine === 'left' ? 0 : refLine === 'right' ? -totalFt : -half;
    const endOff   = startOff + totalFt;

    const dx = seg.end.x - seg.start.x, dz = seg.end.z - seg.start.z;
    const len = Math.sqrt(dx*dx + dz*dz);
    if (len < 0.001) return;

    const nx = -dz / len, nz = dx / len; // perp normal
    const wp = (pt, across) => ({ x: pt.x + nx*across, z: pt.z + nz*across });

    const alpha = preview ? 0.45 : 1;

    const wallMetrics = wall => {
      const def = env.wallTypes.find(w => w.id === (wall.wallType || 'stud_2x6')) || env.wallTypes[1];
      const total = def.totalIn / 12;
      const mid = total / 2;
      const ref = wall.refLine || 'center';
      const first = ref === 'left' ? 0 : ref === 'right' ? -total : -mid;
      return { total, first, last: first + total };
    };
    const otherOffset = (across, other) => {
      const metric = wallMetrics(other);
      // Match every layer edge from its nearest physical face, not from the
      // authored reference line. This carries an ICF's layer edge correctly
      // between left-, centre-, and right-referenced walls of any thickness.
      const distFromFirst = across - startOff;
      const distFromLast = endOff - across;
      const mapped = distFromFirst <= distFromLast
        ? metric.first + distFromFirst
        : metric.last - distFromLast;
      return Math.max(metric.first, Math.min(metric.last, mapped));
    };
    const pointOnWall = (wall, at, across) => {
      const dxWall = wall.end.x - wall.start.x, dzWall = wall.end.z - wall.start.z;
      const wallLen = Math.sqrt(dxWall * dxWall + dzWall * dzWall);
      if (wallLen < 0.001) return null;
      const nxWall = -dzWall / wallLen, nzWall = dxWall / wallLen;
      const vertex = at === 'start' ? wall.start : wall.end;
      return { x: vertex.x + nxWall * across, z: vertex.z + nzWall * across };
    };
    const lineIntersection = (origin, dxA, dzA, otherOrigin, dxB, dzB) => {
      const den = dxA * dzB - dzA * dxB;
      if (Math.abs(den) < 0.001) return null;
      const rx = otherOrigin.x - origin.x, rz = otherOrigin.z - origin.z;
      const t = (rx * dzB - rz * dxB) / den;
      return { x: origin.x + t * dxA, z: origin.z + t * dzA };
    };

    // Return a clipped endpoint and whether the join is genuinely resolved.
    // A cap is only suppressed when this returns true for both assembly faces.
    const joinPoint = (pt, across) => {
      const fallback = wp(pt, across);
      if (!joins || !joins.has(pt)) return { point: fallback, resolved: false };
      const join = joins.get(pt);
      if (!join || join.type === 'none') return { point: fallback, resolved: false };

      const at = pt === seg.start ? 'start' : pt === seg.end ? 'end' : null;
      if (!at) return { point: fallback, resolved: false };

      const dxOut = (at === 'start' ? seg.end.x - seg.start.x : seg.start.x - seg.end.x);
      const dzOut = (at === 'start' ? seg.end.z - seg.start.z : seg.start.z - seg.end.z);
      const outLen = Math.sqrt(dxOut * dxOut + dzOut * dzOut);
      if (outLen < 0.001) return { point: fallback, resolved: false };
      const currentOrigin = wp(pt, across);

      if (join.type === 'tee') {
        if (join.host.some(entry => entry.seg === seg)) {
          return { point: fallback, resolved: true };
        }
        if (join.stem.seg !== seg) return { point: fallback, resolved: false };
        const host = join.host[0];
        const hdx = host.seg.end.x - host.seg.start.x, hdz = host.seg.end.z - host.seg.start.z;
        const hLen = Math.sqrt(hdx * hdx + hdz * hdz);
        if (hLen < 0.001) return { point: fallback, resolved: false };
        const hNormalX = -hdz / hLen, hNormalZ = hdx / hLen;
        const hostMetric = wallMetrics(host.seg);
        const stemSide = hNormalX * dxOut / outLen + hNormalZ * dzOut / outLen;
        const hostAcross = stemSide >= 0 ? hostMetric.last : hostMetric.first;
        const hostOrigin = pointOnWall(host.seg, host.at, hostAcross);
        const ix = hostOrigin && lineIntersection(currentOrigin, dxOut, dzOut, hostOrigin, hdx, hdz);
        return ix ? { point: ix, resolved: true } : { point: fallback, resolved: false };
      }
      if (join.type === 'continuation' || join.type === 'multi') {
        // Continuous hosts and cross intersections do not have an exposed
        // cap. Their boundary lines remain square/continuous at the vertex.
        return { point: fallback, resolved: true };
      }

      const otherEntry = join.entries.find(entry => entry.seg !== seg);
      if (!otherEntry) return { point: fallback, resolved: false };
      const other = otherEntry.seg;
      const otherAt = otherEntry.at;
      const odxOut = (otherAt === 'start' ? other.end.x - other.start.x : other.start.x - other.end.x);
      const odzOut = (otherAt === 'start' ? other.end.z - other.start.z : other.start.z - other.end.z);
      const otherOrigin = pointOnWall(other, otherAt, otherOffset(across, other));
      const ix = otherOrigin && lineIntersection(currentOrigin, dxOut, dzOut, otherOrigin, odxOut, odzOut);
      if (!ix) return { point: fallback, resolved: false };
      const miterLen = Math.sqrt((ix.x - pt.x) ** 2 + (ix.z - pt.z) ** 2);
      const limit = Math.max(totalFt, wallMetrics(other).total) * 8;
      return miterLen <= limit ? { point: ix, resolved: true } : { point: fallback, resolved: false };
    };
    const joinTransitions = pt => {
      if (!joins || !joins.has(pt)) return [];
      const join = joins.get(pt);
      const at = pt === seg.start ? 'start' : pt === seg.end ? 'end' : null;
      if (!at || !join) return [];
      let peer = null;
      if (join.type === 'continuation') {
        peer = join.entries.find(entry => entry.seg !== seg) || null;
      } else if (join.type === 'tee' && join.host.some(entry => entry.seg === seg)) {
        peer = join.host.find(entry => entry.seg !== seg) || null;
      }
      if (!peer) return [];

      // When continuous host profiles differ, leave only the exposed face
      // transition visible. A full cap would cut straight through the other
      // wall; no transition at all leaves the wider profile open.
      const peerMetric = wallMetrics(peer.seg);
      const peerDx = peer.seg.end.x - peer.seg.start.x;
      const peerDz = peer.seg.end.z - peer.seg.start.z;
      const peerLen = Math.hypot(peerDx, peerDz);
      if (peerLen < 0.001) return [];
      const peerNormalX = -peerDz / peerLen, peerNormalZ = peerDx / peerLen;
      const samePhysicalNormal = nx * peerNormalX + nz * peerNormalZ >= 0;
      // A collinear continuation may be authored in either direction. Match
      // faces by their physical normal, not by the local start/end label, so
      // equal wall profiles stay seamless when one segment is drawn backwards.
      const pairs = samePhysicalNormal
        ? [[startOff, peerMetric.first], [endOff, peerMetric.last]]
        : [[startOff, peerMetric.last], [endOff, peerMetric.first]];
      return pairs.flatMap(([ownAcross, peerAcross]) => {
        const own = wp(pt, ownAcross);
        const other = pointOnWall(peer.seg, peer.at, peerAcross);
        if (!other || Math.hypot(own.x - other.x, own.z - other.z) < 0.0001) return [];
        return [{ own, other }];
      });
    };

    // Draw each layer fill
    let offset = startOff;
    wtDef.layers.forEach(layer => {
      const layerFt = layer.in / 12;
      const nextOff = offset + layerFt;

      const p0 = toS(joinPoint(seg.start, offset).point), p1 = toS(joinPoint(seg.end,   offset).point);
      const p2 = toS(joinPoint(seg.end,   nextOff).point),p3 = toS(joinPoint(seg.start, nextOff).point);

      if (mode !== 'stroke') {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y);
        ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y);
        ctx.closePath();

        if (layer.fill === 'stud') {
          ctx.fillStyle = preview ? wallFillPrev : wallFill;
          ctx.fill();
        } else if (layer.fill === 'concrete') {
          ctx.fillStyle = `rgba(182,182,182,${alpha})`;
          ctx.fill();
          ctx.clip();
          ctx.strokeStyle = `rgba(90,90,90,${alpha * 0.45})`;
          ctx.lineWidth = 0.7;
          const xs = [p0.x,p1.x,p2.x,p3.x], ys = [p0.y,p1.y,p2.y,p3.y];
          const x0 = Math.min(...xs)-6, x1 = Math.max(...xs)+6;
          const y0 = Math.min(...ys)-6, y1 = Math.max(...ys)+6;
          const span = Math.max(x1-x0, y1-y0)+12;
          const step = 5;
          ctx.beginPath();
          for (let i = -span; i < span*2; i += step) {
            ctx.moveTo(x0+i, y0); ctx.lineTo(x0+i-(y1-y0), y1); // NE
            ctx.moveTo(x0+i, y1); ctx.lineTo(x0+i+(y1-y0), y0); // NW
          }
          ctx.stroke();
        } else if (layer.fill === 'insulation') {
          ctx.fillStyle = `rgba(205,228,248,${alpha})`;
          ctx.fill();
          ctx.clip();
          ctx.strokeStyle = `rgba(70,130,200,${alpha * 0.4})`;
          ctx.lineWidth = 0.7;
          const xs = [p0.x,p1.x,p2.x,p3.x], ys = [p0.y,p1.y,p2.y,p3.y];
          const x0 = Math.min(...xs)-6, y0 = Math.min(...ys)-6, y1 = Math.max(...ys)+6;
          const span = Math.max(Math.max(...xs)-x0, y1-y0)+12;
          const step = 5;
          ctx.beginPath();
          for (let i = -span; i < span*2; i += step) {
            ctx.moveTo(x0+i, y0); ctx.lineTo(x0+i-(y1-y0), y1);
          }
          ctx.stroke();
        }

        ctx.restore();
      }
      offset = nextOff;
    });

    if (mode === 'fill') return;

    // Boundary lines (all layer edges + end caps)
    ctx.strokeStyle = preview ? wallEdgePrev : wallEdge;
    ctx.lineWidth   = preview ? 1 : 1.5;
    let bOff = startOff;
    wtDef.layers.forEach((layer, i) => {
      const bNext = bOff + layer.in / 12;
      if (i === 0) {
        const a = toS(joinPoint(seg.start, bOff).point), b = toS(joinPoint(seg.end, bOff).point);
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      }
      const a = toS(joinPoint(seg.start, bNext).point), b = toS(joinPoint(seg.end, bNext).point);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      bOff = bNext;
    });
    // End caps stop at a shared vertex. The mitered layer boundaries above
    // continue through the join and form the architectural corner instead.
    [seg.start, seg.end].forEach(pt => {
      const transitions = joinTransitions(pt);
      if (transitions.length) {
        transitions.forEach(({ own, other }) => {
          const a = toS(own), b = toS(other);
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        });
        return;
      }
      const isJoined = joinPoint(pt, startOff).resolved && joinPoint(pt, endOff).resolved;
      if (isJoined) return;
      const a = toS(wp(pt, startOff)), b = toS(wp(pt, endOff));
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    });

    // Centreline endpoint dots
    if (!preview) {
      ctx.fillStyle = wallEdge;
      const DOT_R = 2.5;
      [seg.start, seg.end].forEach(pt => {
        const s = toS(pt);
        ctx.beginPath(); ctx.arc(s.x,s.y,DOT_R,0,Math.PI*2); ctx.fill();
      });
    }
  }

  function drawRoof2D(ctx, toS, roof, options = {}, env) {
    const pts = roof.points.map(pt => toS(pt));
    if (pts.length < 3) return;
    const referenceColor = options.referenceColor;
    // Openings cut from this roof render as holes in the fill (even-odd).
    const holes = roof.id
      ? env.surfaceOpeningsFor('roof', roof.id).map(opening => opening.points.map(pt => toS(pt)))
      : [];
    ctx.save();
    ctx.beginPath();
    pts.forEach((pt, index) => (index ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.closePath();
    holes.forEach(hole => {
      hole.forEach((pt, index) => (index ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.closePath();
    });
    if (!referenceColor) { ctx.fillStyle = 'rgba(122,74,33,0.07)'; ctx.fill('evenodd'); }
    ctx.strokeStyle = referenceColor || '#7a4a21';
    ctx.lineWidth = referenceColor ? 1.25 : (options.selected ? 3.5 : 2);
    ctx.stroke();
    ctx.lineWidth = referenceColor ? 1.25 : 2;
    // Gable edges read as a double line: the footprint edge is the rake
    // (overhang included) and the inner stroke is the exterior face of the
    // gable wall — the footprint pulled back in by the overhang, which lands
    // on the building outline the roof grew from.
    const overhangFt = Number(roof.overhang) || 0;
    const hasGable = (roof.edges || []).some(kind => kind === 'gable');
    const wallRing = hasGable && overhangFt > 0
      ? env.offsetOutline(roof.points.map(pt => ({ x: pt.x, z: pt.z })), -overhangFt).map(pt => toS(pt))
      : null;
    const count = pts.length;
    for (let index = 0; index < count; index++) {
      const a = pts[index], b = pts[(index + 1) % count];
      const isGable = roof.edges[index] === 'gable';
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      if (isGable && wallRing) {
        const wa = wallRing[index], wb = wallRing[(index + 1) % count];
        ctx.beginPath();
        ctx.moveTo(wa.x, wa.y); ctx.lineTo(wb.x, wb.y);
        ctx.lineWidth = referenceColor ? 1 : 1.25;
        ctx.stroke();
      }
      if (options.tagging && !referenceColor) {
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isGable ? '#7a4a21' : 'rgba(122,74,33,0.7)';
        ctx.fillText(isGable ? 'GABLE' : 'EAVE', (a.x + b.x) / 2 - dy / len * 12, (a.y + b.y) / 2 + dx / len * 12);
      }
    }
    // Generated ridge / hip / valley guides.
    ctx.strokeStyle = referenceColor || '#a3703f';
    ctx.lineWidth = referenceColor ? 1 : 1.5;
    ctx.setLineDash([8, 5]);
    env.roofSkeleton(roof).forEach(seg => {
      const a = toS(seg.a), b = toS(seg.b);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    if (!env.isPrinting && !referenceColor) {
      ctx.fillStyle = '#7a4a21';
      pts.forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2); ctx.fill();
      });
      holes.forEach(hole => hole.forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill();
      }));
    }
    ctx.restore();
  }

  function drawShape2D(ctx, toS, shape, options = {}, env) {
    const points = shape?.points || [];
    if (points.length < 2) return;
    const { preview = false } = options;
    const screenPoints = points.map(toS);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    screenPoints.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    if (points.length >= 3) {
      ctx.closePath();
      ctx.fillStyle = preview ? 'rgba(63,143,122,0.06)' : 'rgba(63,143,122,0.09)';
      ctx.fill();
    }
    ctx.strokeStyle = preview ? 'rgba(63,143,122,0.72)' : env.shapeColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!preview && !env.isPrinting) {
      ctx.fillStyle = env.shapeColor;
      screenPoints.forEach(point => ctx.fillRect(point.x - 2.5, point.y - 2.5, 5, 5));
    }
    // A flooring area labels itself with its finish and measured area.
    if (!preview && shape.flooring && points.length >= 3) {
      const type = env.flooringTypes.find(entry => entry.id === shape.flooring.type);
      const label = [type?.label, env.areaLabel(env.outlineAreaSqFt(points))]
        .filter(Boolean).join(' · ');
      if (label) {
        const cx = screenPoints.reduce((sum, pt) => sum + pt.x, 0) / screenPoints.length;
        const cy = screenPoints.reduce((sum, pt) => sum + pt.y, 0) / screenPoints.length;
        ctx.font = "600 11px 'Barlow Condensed', system-ui, sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(cx - textWidth / 2 - 3, cy - 8, textWidth + 6, 15);
        ctx.fillStyle = env.shapeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);
      }
    }
    ctx.restore();
  }

  function drawFixture2D(ctx, toS, fixture, options, wall, env) {
    const geo = env.fixtureGeometry(fixture, wall);
    if (!geo) return;
    const P = (along, across) => toS(geo.frame.at(along, across));
    const poly = pts => {
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    };
    const rect = (a0, a1, c0, c1) => poly([P(a0, c0), P(a1, c0), P(a1, c1), P(a0, c1)]);
    const oval = (alongC, acrossC, ra, rc) => {
      ctx.beginPath();
      for (let i = 0; i <= 20; i += 1) {
        const t = (i / 20) * Math.PI * 2;
        const p = P(alongC + Math.cos(t) * ra, acrossC + Math.sin(t) * rc);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };
    const sa = P(0, 0), sb = P(1, 0);
    const pxPerFt = Math.hypot(sb.x - sa.x, sb.y - sa.y);
    const a0 = geo.tub ? geo.tubAlongStart : geo.alongStart;
    const a1 = geo.tub ? geo.tubAlongEnd : geo.alongEnd;
    const cBack = geo.backOff, cFront = geo.frontOff;
    const cMin = Math.min(cBack, cFront), cMax = Math.max(cBack, cFront);
    const mid = (cBack + cFront) / 2;
    const inset = 0.15;
    ctx.save();
    ctx.globalAlpha = options.preview ? 0.55 : 1;
    ctx.strokeStyle = env.FIXTURE_COLOR;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.2;
    rect(a0, a1, cBack, cFront); ctx.fill(); ctx.stroke();
    const kind = fixture.kind;
    if (kind === 'cabinet' || kind === 'vanity') {
      // Countertop edge — a parallel line just past the cabinet face.
      const counter = cFront + (cFront >= cBack ? 1 : -1) * env.COUNTER_OVERHANG_FT;
      const ca = P(a0, counter), cb = P(a1, counter);
      ctx.beginPath(); ctx.moveTo(ca.x, ca.y); ctx.lineTo(cb.x, cb.y); ctx.stroke();
      if (kind === 'vanity') {
        oval((a0 + a1) / 2, mid, Math.max(Math.min((a1 - a0) / 2 - 0.2, 0.7), 0.2), Math.max((cMax - cMin) / 2 - 0.15, 0.2));
        ctx.stroke();
      }
    } else if (kind === 'sink') {
      const w = a1 - a0;
      if (w > 2.2) {
        rect(a0 + inset, a0 + w / 2 - 0.05, cMin + inset, cMax - inset); ctx.stroke();
        rect(a0 + w / 2 + 0.05, a1 - inset, cMin + inset, cMax - inset); ctx.stroke();
      } else {
        rect(a0 + inset, a1 - inset, cMin + inset, cMax - inset); ctx.stroke();
      }
    } else if (kind === 'stove') {
      const w = a1 - a0, d = cMax - cMin;
      [[0.28, 0.3], [0.72, 0.3], [0.28, 0.7], [0.72, 0.7]].forEach(([fa, fc]) => {
        oval(a0 + w * fa, cMin + d * fc, 0.28, 0.28);
        ctx.stroke();
      });
    } else if (kind === 'fridge' || kind === 'washer' || kind === 'dryer' || kind === 'dish') {
      rect(a0 + inset, a1 - inset, cMin + inset, cMax - inset); ctx.stroke();
      if (pxPerFt > 6) {
        const c = toS(geo.center);
        ctx.fillStyle = env.FIXTURE_COLOR;
        ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(kind === 'fridge' ? 'REF' : kind === 'washer' ? 'W' : kind === 'dryer' ? 'D' : 'DW', c.x, c.y);
      }
    } else if (kind === 'island') {
      // Freestanding island: counter overhang line on the seating side (away
      // from the host wall) and a label when zoomed in.
      const dir = cFront >= cBack ? 1 : -1;
      const counter = cFront + dir * env.COUNTER_OVERHANG_FT;
      const ca = P(a0, counter), cb = P(a1, counter);
      ctx.beginPath(); ctx.moveTo(ca.x, ca.y); ctx.lineTo(cb.x, cb.y); ctx.stroke();
      if (pxPerFt > 6) {
        const c = toS(geo.center);
        ctx.fillStyle = env.FIXTURE_COLOR;
        ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ISLAND', c.x, c.y);
      }
    } else if (kind === 'pantry') {
      // Corner walk-in pantry: shelves dashed along the back, and the classic
      // 45° angled door across the open front corner — the end away from the
      // crossing wall that closes the corner.
      const dir = cFront >= cBack ? 1 : -1;
      const nearCross = along => (geo.wall ? env.walls.some(other => {
        if (other === geo.wall) return false;
        if (other.levelId !== geo.wall.levelId || (other.view || 'plan') !== (geo.wall.view || 'plan')) return false;
        const hit = env.wallCross(geo.wall, geo.frame, other);
        return hit && hit.s > -0.05 && hit.s < 1.05
          && Math.abs(hit.along - along) < ((env.wallFrame(other)?.totalFt || 0) / 2) + 0.3;
      }) : false);
      const openAtEnd = nearCross(a0) || !nearCross(a1);
      const cut = Math.min(2.5, (a1 - a0) * 0.6);
      const doorA = openAtEnd ? a1 - cut : a0 + cut;
      const openA = openAtEnd ? a1 : a0;
      const d0 = P(doorA, cFront), d1 = P(openA, cFront - dir * cut);
      ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.stroke();
      ctx.save(); ctx.setLineDash([4, 3]);
      const s0 = P(a0 + 0.15, cBack + dir * 1), s1 = P(a1 - 0.15, cBack + dir * 1);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
      ctx.restore();
      if (pxPerFt > 6) {
        const c = toS(geo.center);
        ctx.fillStyle = env.FIXTURE_COLOR;
        ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('PANTRY', c.x, c.y);
      }
    } else if (kind === 'closet') {
      // A small room off the host wall: 2x4 side walls (skipped where the run
      // end snugs into an existing crossing wall), a 2x4 front wall carrying a
      // door from the DD/D ladder, then rod / shelf / clothes inside.
      const dir = cFront >= cBack ? 1 : -1;
      const wallFt = env.CLOSET_WALL_FT;
      const nearCross = along => (geo.wall ? env.walls.some(other => {
        if (other === geo.wall) return false;
        if (other.levelId !== geo.wall.levelId || (other.view || 'plan') !== (geo.wall.view || 'plan')) return false;
        const hit = env.wallCross(geo.wall, geo.frame, other);
        return hit && hit.s > -0.05 && hit.s < 1.05
          && Math.abs(hit.along - along) < ((env.wallFrame(other)?.totalFt || 0) / 2) + 0.1;
      }) : false);
      const skip0 = nearCross(a0), skip1 = nearCross(a1);
      const in0 = a0 + (skip0 ? 0 : wallFt);
      const in1 = a1 - (skip1 ? 0 : wallFt);
      if (!skip0) { rect(a0, a0 + wallFt, cBack, cFront); ctx.stroke(); }
      if (!skip1) { rect(a1 - wallFt, a1, cBack, cFront); ctx.stroke(); }
      const frontIn = cFront - dir * wallFt;
      // The door is sized from the closet's OWN width, not from what is left
      // between its side walls: Movie's trim is 4" each side on the outside
      // face and the inside face does not care. So a run snugged into a
      // crossing wall -- which skips a side wall and widens the inside -- gets
      // the same door as one that is not, which is what "follows the closet
      // width" means.
      const door = env.closetDoorFor(a1 - a0);
      const doorC = (in0 + in1) / 2;
      if (door) {
        const g0 = doorC - door.widthFt / 2, g1 = doorC + door.widthFt / 2;
        if (g0 > in0 + 0.02) { rect(in0, g0, frontIn, cFront); ctx.stroke(); }
        if (g1 < in1 - 0.02) { rect(g1, in1, frontIn, cFront); ctx.stroke(); }
        const j0 = P(g0, frontIn), j1 = P(g0, cFront), k0 = P(g1, frontIn), k1 = P(g1, cFront);
        ctx.beginPath(); ctx.moveTo(j0.x, j0.y); ctx.lineTo(j1.x, j1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(k0.x, k0.y); ctx.lineTo(k1.x, k1.y); ctx.stroke();
      } else {
        rect(in0, in1, frontIn, cFront); ctx.stroke();
      }
      // Rod at 1'-0" off the back wall, shelf edge dashed at 1'-6", and the
      // clothes as 1'-10" hanger-direction strokes centered on the rod.
      const rodC = cBack + dir * env.CLOSET_ROD_FT;
      const r0 = P(in0 + 0.1, rodC), r1 = P(in1 - 0.1, rodC);
      ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.stroke();
      const shelfC = cBack + dir * env.CLOSET_SHELF_FT;
      ctx.save(); ctx.setLineDash([4, 3]);
      const s0 = P(in0 + 0.1, shelfC), s1 = P(in1 - 0.1, shelfC);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
      ctx.restore();
      const c0 = rodC - dir * (env.CLOSET_CLOTHES_FT / 2), c1 = rodC + dir * (env.CLOSET_CLOTHES_FT / 2);
      for (let a = in0 + 0.45; a < in1 - 0.35; a += 0.6) {
        const h0 = P(a, c0), h1 = P(a, c1);
        ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.lineTo(h1.x, h1.y); ctx.stroke();
      }
      if (door && pxPerFt > 6) {
        const t = P(doorC, cFront + dir * 0.45);
        ctx.fillStyle = env.FIXTURE_COLOR;
        ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(door.label, t.x, t.y);
      }
    } else if (kind === 'shower' || kind === 'stall') {
      // Shower pan: inset curb, diagonals to a centered drain.
      const p0 = a0 + inset, p1 = a1 - inset, q0 = cMin + inset, q1 = cMax - inset;
      rect(p0, p1, q0, q1); ctx.stroke();
      const da = (a0 + a1) / 2, dc = mid, r = 0.18;
      [[p0, q0], [p1, q0], [p1, q1], [p0, q1]].forEach(([fa, fc]) => {
        const dirA = fa < da ? 1 : -1, dirC = fc < dc ? 1 : -1;
        const from = P(fa, fc);
        const to = P(da - dirA * r * 0.7, dc - dirC * r * 0.7);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      });
      oval(da, dc, r, r); ctx.stroke();
    } else if (kind === 'toilet') {
      // Tank against the wall, bowl beyond it.
      const tank = cBack + (cFront >= cBack ? 1 : -1) * 0.6;
      rect(a0 + 0.05, a1 - 0.05, cBack, tank); ctx.stroke();
      oval((a0 + a1) / 2, (tank + cFront) / 2,
        Math.max(Math.min((a1 - a0) / 2 - 0.15, 0.62), 0.2), Math.max(Math.abs(cFront - tank) / 2 - 0.05, 0.2));
      ctx.stroke();
    } else if (kind === 'tub') {
      // Basin inset, with extra room at the faucet end for the fittings.
      const faucetAtStart = geo.faucetAlong != null
        && Math.abs(geo.faucetAlong - a0) < Math.abs(geo.faucetAlong - a1);
      const b0 = a0 + (faucetAtStart ? 0.55 : 0.25);
      const b1 = a1 - (faucetAtStart ? 0.25 : 0.55);
      if (b1 > b0 + 0.5) {
        rect(b0, b1, cMin + 0.2, cMax - 0.2); ctx.stroke();
        oval(faucetAtStart ? b0 + 0.35 : b1 - 0.35, mid, 0.15, 0.15); ctx.stroke();
      }
      // Deck strips fill any leftover alcove.
      (geo.decks || []).forEach(deck => {
        const pts = deck.map(toS);
        poly(pts); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.stroke();
      });
    }
    if (options.selected) {
      ctx.strokeStyle = '#5980a6'; ctx.lineWidth = 2;
      rect(a0, a1, cBack, cFront); ctx.stroke();
    }
    ctx.restore();
  }


  // ─── Chrome: what sits under and around the drawing ───────────────────────
  // Three painters with no geometry of their own — the scanned underlay, the
  // measuring grid, and the datum marker. They move first because they read
  // the least: between them the env is nine plain values, no model objects.

  // Underlays sit beneath everything drawn: over the grid, under geometry.
  // Only the active level's, and never on a print — a scan is a tracing aid,
  // not part of the drawing.
  function drawUnderlays2D(ctx, toS, env) {
    if (env.isPrinting) return;
    const underlays = env.underlays || [];
    if (!underlays.length || !env.activeLevel) return;
    for (const underlay of underlays) {
      if (underlay.levelId !== env.activeLevel.id) continue;
      const image = env.imageFor(underlay.id);
      if (!image) continue;
      const halfW = underlay.widthFt / 2, halfH = underlay.heightFt / 2;
      const a = toS({ x: underlay.x - halfW, y: 0, z: underlay.z - halfH });
      const b = toS({ x: underlay.x + halfW, y: 0, z: underlay.z + halfH });
      const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
      const width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y);
      if (width < 1 || height < 1) continue;
      ctx.save();
      ctx.globalAlpha = underlay.opacity;
      ctx.drawImage(image, left, top, width, height);
      ctx.restore();
    }
  }

  // No datum, no grid: an untouched model space has nothing to measure from,
  // and a grid drawn from the world's 0,0 would be measuring from a point
  // that means nothing to this drawing. The look is unchanged once there is
  // one — only what it counts from moves.
  //
  // Top view only; the caller decides that and passes no datum otherwise.
  function drawGrid2D(ctx, w, h, env) {
    const datum = env.datum;
    if (!datum) return;
    const halfH = env.halfH;
    const halfW = halfH * (w / h);
    const camX = env.camX || 0;
    const camZ = env.camZ || 0;

    // World → screen (top-down ortho, up=(0,0,-1) so +Z = down on screen)
    const sx = wx => (wx - camX + halfW) / (2 * halfW) * w;
    const sy = wz => (wz - camZ + halfH) / (2 * halfH) * h;

    const drawGridLines = (unit, color, lineWidth) => {
      ctx.beginPath();
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
      const x0 = datum.x + Math.ceil((camX - halfW - datum.x) / unit) * unit;
      const z0 = datum.z + Math.ceil((camZ - halfH - datum.z) / unit) * unit;
      for (let x = x0; x <= camX + halfW + unit; x += unit) {
        ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), h);
      }
      for (let z = z0; z <= camZ + halfH + unit; z += unit) {
        ctx.moveTo(0, sy(z)); ctx.lineTo(w, sy(z));
      }
      ctx.stroke();
    };

    // Colour comes from the caller, like drawShape2D's env.shapeColor two
    // functions above. The greys were hardcoded here before the move; leaving
    // them hardcoded would have baked page styling into the shared module and
    // cost another pass through this file when the grid is skinned.
    const zoomed = halfH < 50;
    if (zoomed) drawGridLines(1,   env.gridFine,   0.5);  // 1ft fine
    drawGridLines(10,  env.gridMajor,  0.5);               // 10ft major / fine
    if (!zoomed) drawGridLines(100, env.gridCoarse, 0.75); // 100ft when zoomed out
  }

  // The datum is the drawing's, not the world's, so the target stands on the
  // first node placed rather than on 0,0 — and on nothing at all before one
  // exists. It moves to the SITE level when that plan can draw the house
  // (board NEW-5 part 3); until then it stays visible here, because the
  // origin still has hold of the cursor and an unseen snap target is worse
  // than a marker sitting on a node the drafter placed themselves.
  //
  // The point goes to toS as a plain object rather than a THREE.Vector3: toS
  // reads x / y || 0 / z off whatever it is given and builds its own vector,
  // so the two are identical and the painter carries no THREE dependency.
  function drawOrigin2D(ctx, toS, env) {
    const datum = env.datum;
    if (!datum) return;
    const o = toS({ x: datum.x, y: env.elev || 0, z: datum.z });
    ctx.save();
    // The marker's green was hardcoded here, which made it the one painter a
    // skinned page could not re-colour. Measured on the skins, that literal
    // scores 2.94 over the night floor wash -- under the 3.0 non-text floor,
    // and a datum is the drafter's FIRST CLICK, so it lands on the building
    // far more often than on bare page.
    //
    // The fallback is the same literal, and that is not a placeholder hiding a
    // gap: MODEL.dc.html has no skins and its ground is always light, so this
    // value IS correct for that page -- it is the day skin's value too. A
    // caller that supplies colours gets its own; the one that does not keeps
    // exactly what it painted before.
    ctx.strokeStyle = (env.colors && env.colors.origin) || '#557a46';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x - 12, o.y); ctx.lineTo(o.x + 12, o.y);
    ctx.moveTo(o.x, o.y - 12); ctx.lineTo(o.x, o.y + 12);
    ctx.stroke();
    ctx.restore();
  }


  // ─── The stair in plan ────────────────────────────────────────────────────
  // Stringers, tread lines, handrail bars, the landing square with its winder
  // fan, the U gap, and the downhill walk-line arrow with its DN label.
  //
  // Everything about the stair's geometry arrives already computed:
  // env.layoutFor gives the riser/tread layout and env.partsFor turns that
  // into runs, rails, landing, gap and walk line. This paints those parts; it
  // does not work out where they go.
  function drawStairs2D(ctx, toS, env) {
    const std = env.layer;
    if (!std.visible || (env.isPrinting && !std.printable)) return;
    const stairs = env.stairs;
    if (!stairs.length) return;
    const font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
    const elev = env.elev || 0;
    const origin = toS({ x: 0, y: elev, z: 0 });
    const unit = toS({ x: 1, y: elev, z: 0 });
    const pxPerFt = Math.max(0.001, Math.hypot(unit.x - origin.x, unit.y - origin.y));
    stairs.forEach(stair => {
      const layout = env.layoutFor(stair);
      const parts = env.partsFor(stair, layout);
      const y = stair.start.y || 0;
      const pt = p => toS({ x: p.x, y, z: p.z });
      const half = Math.max(2, (stair.widthFt / 2) * pxPerFt);
      ctx.save();
      ctx.strokeStyle = env.stairColor;
      ctx.fillStyle = env.stairColor;
      parts.runs.forEach(run => {
        const a = pt(run.start);
        const b = pt({ x: run.start.x + run.dir.x * run.lenFt, z: run.start.z + run.dir.z * run.lenFt });
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux; // right side walking down, in screen space
        ctx.lineWidth = 1.5;
        // Stringers
        ctx.beginPath();
        ctx.moveTo(a.x - px * half, a.y - py * half); ctx.lineTo(b.x - px * half, b.y - py * half);
        ctx.moveTo(a.x + px * half, a.y + py * half); ctx.lineTo(b.x + px * half, b.y + py * half);
        ctx.stroke();
        // Tread lines at every run increment, top nosing included
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= run.treads; i++) {
          const t = (i * env.treadRunIn / 12) * pxPerFt;
          const cx = a.x + ux * t, cy = a.y + uy * t;
          ctx.moveTo(cx - px * half, cy - py * half);
          ctx.lineTo(cx + px * half, cy + py * half);
        }
        ctx.stroke();
      });
      // Handrail bars, 3" inside the stringer on the picked side(s), running
      // continuously through a turn: level along the landing edge between the
      // flights, and 36" above the walking surface the whole way.
      if (parts.rails && parts.rails.length) {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        parts.rails.forEach(path => {
          path.map(pt).forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        });
        ctx.stroke();
      }
      // Landing square, with winder division lines fanning from the inside
      // corner when the landing converts to 2 or 3 winders.
      if (parts.landing) {
        const poly = parts.landing.poly.map(pt);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
        ctx.lineWidth = 1;
        parts.landing.winderLines.forEach(line => {
          const a = pt(line[0]), b = pt(line[1]);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
      }
      // The U gap line: the rail or wall the 4.5" between the runs is for.
      if (parts.gap) {
        const a = pt(parts.gap[0]), b = pt(parts.gap[1]);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // Downhill walk-line arrow with the DN label and riser count
      const walk = parts.walk.map(pt);
      ctx.lineWidth = 1;
      ctx.beginPath();
      walk.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      const wa = walk[walk.length - 2], wb = walk[walk.length - 1];
      const wd = Math.hypot(wb.x - wa.x, wb.y - wa.y) || 1;
      const wux = (wb.x - wa.x) / wd, wuy = (wb.y - wa.y) / wd;
      const wpx = -wuy, wpy = wux;
      ctx.beginPath();
      ctx.moveTo(wb.x - wux * 8 - wpx * 4, wb.y - wuy * 8 - wpy * 4); ctx.lineTo(wb.x, wb.y);
      ctx.lineTo(wb.x - wux * 8 + wpx * 4, wb.y - wuy * 8 + wpy * 4);
      ctx.stroke();
      if (!env.isPrinting || std.printable) {
        const a = walk[0], b = walk[1];
        ctx.font = font;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.save();
        ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
        let angle = Math.atan2(b.y - a.y, b.x - a.x);
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
        ctx.rotate(angle);
        ctx.fillText(`DN — ${layout.risers}R @ ${env.formatInchesOnly(layout.riserIn)}`, 0, -3);
        ctx.restore();
      }
      ctx.restore();
    });
  }


  // ─── The floor slab in plan ───────────────────────────────────────────────
  // Outline, fill, corner handles, and — for a garage slab — the dashed
  // thickened-edge ring and the pour/slope note. Openings cut from the floor
  // are holes in the fill, drawn even-odd rather than subtracted, so a hole
  // reads as a hole at any zoom.
  //
  // Three modes share one path: a reference floor (another level shown
  // faintly beneath), a preview while drawing, and the committed slab.
  function drawFloor2D(ctx, toS, floor, options = {}, env) {
    const points = floor?.points || [];
    if (points.length < 2) return;
    const { preview = false, referenceColor = null, selected = false } = options;
    const screenPoints = points.map(toS);
    // Openings cut from this floor render as holes in the fill (even-odd).
    const holes = floor?.id
      ? env.surfaceOpeningsFor('floor', floor.id).map(opening => opening.points.map(toS))
      : [];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    screenPoints.slice(1).forEach(point => ctx.lineTo(point.x, point.y));

    if (referenceColor) {
      if (points.length >= 3) {
        ctx.closePath();
        holes.forEach(hole => {
          ctx.moveTo(hole[0].x, hole[0].y);
          hole.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
          ctx.closePath();
        });
        ctx.fillStyle = referenceColor.replace(/[\d.]+\)$/, '0.08)');
        ctx.fill('evenodd');
      }
      ctx.strokeStyle = referenceColor;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }

    if (points.length >= 3) {
      ctx.closePath();
      holes.forEach(hole => {
        ctx.moveTo(hole[0].x, hole[0].y);
        hole.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
        ctx.closePath();
      });
      ctx.fillStyle = preview ? env.colors.fillPreview : env.colors.fill;
      ctx.fill('evenodd');
    }
    ctx.strokeStyle = selected ? env.colors.selected : (preview ? env.colors.strokePreview : env.colors.stroke);
    ctx.lineWidth = selected ? 3 : 1.5;
    if (preview) ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!preview) {
      ctx.fillStyle = selected ? env.colors.selected : env.colors.stroke;
      screenPoints.forEach(point => ctx.fillRect(point.x - 2.5, point.y - 2.5, 5, 5));
      holes.forEach(hole => hole.forEach(point => ctx.fillRect(point.x - 2, point.y - 2, 4, 4)));
    }
    // A garage slab carries its pour + slope note so the plan reads the spec.
    // A thickened-edge slab also shows a dashed inset ring where the 1'-0"
    // perimeter edge and its 45° taper give way to the 4" field.
    if (floor?.garage && points.length >= 3) {
      if (floor.thickenedEdge === true) {
        const inset = env.offsetOutline(
          points.map(pt => ({ x: pt.x, z: pt.z })),
          -((env.garageEdgeDepthIn + env.garageEdgeTaperRunIn) / 12),
        ).map(toS);
        if (inset.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(inset[0].x, inset[0].y);
          inset.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
          ctx.closePath();
          ctx.strokeStyle = selected ? env.colors.selected : env.colors.stroke;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      const centroid = screenPoints.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      ctx.fillStyle = env.colors.stroke;
      ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const slope = Number(floor.slopeInPerFt) || 0;
      const pour = env.formatInchesOnly(Math.round((floor.thickness || env.garageSlabThicknessIn / 12) * 12));
      const note = floor.thickenedEdge === true
        ? `${pour} THICKENED-EDGE SLAB — LEVEL, 1'-0" EDGE, 45° TAPER`
        : slope ? `${pour} GARAGE SLAB — SLOPE ${slope === 1 / 8 ? '1/8' : slope}"/FT TO DOOR` : `${pour} GARAGE SLAB`;
      ctx.fillText(
        note,
        centroid.x / screenPoints.length,
        centroid.y / screenPoints.length + 6,
      );
    }
    ctx.restore();
  }


  // ─── A boneyard mark on an outline edge ───────────────────────────────────
  // The door / window / gable-bump stamp a drafter drops on an outline edge
  // before the house exists: a heavy bar the width of the opening, a tick at
  // each end, and a letter naming what it is. The colour arrives as an
  // argument because the caller varies it by state, not by kind.
  function drawBoneyardMark2D(ctx, toS, outline, mark, hex, env) {
    const at = env.geometryFor(outline, mark);
    if (!at) return;
    const half = mark.widthFt / 2;
    const a = toS({ x: at.center.x - at.ux * half, z: at.center.z - at.uz * half });
    const b = toS({ x: at.center.x + at.ux * half, z: at.center.z + at.uz * half });
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.strokeStyle = hex;
    ctx.fillStyle = hex;
    ctx.setLineDash([]);
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.lineWidth = 1.5;
    [a, b].forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.x - nx * 6, p.y - ny * 6);
      ctx.lineTo(p.x + nx * 6, p.y + ny * 6);
      ctx.stroke();
    });
    const c = toS(at.center);
    ctx.font = '600 10px "Barlow Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(mark.type === 'door' ? 'D' : mark.type === 'gable-bump' ? 'G' : 'W', c.x + nx * 11, c.y + ny * 11);
    ctx.restore();
  }


  // ─── A dimension string ───────────────────────────────────────────────────
  // Extension lines, the dimension line between them, an arrowhead at each
  // end, and the measurement on a knocked-out label.
  //
  // The label arrives already formatted: env.label decides feet-and-inches or
  // metres, because which units a drawing reads in is the page's business,
  // not the painter's.
  function drawDimension2D(ctx, toS, dimension, options = {}, env) {
    const a = toS(dimension.start);
    const b = toS(dimension.end);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const nx = -dy / length;
    const ny = dx / length;
    const offset = options.preview ? 14 : 19;
    const da = { x:a.x + nx * offset, y:a.y + ny * offset };
    const db = { x:b.x + nx * offset, y:b.y + ny * offset };
    const value = Math.hypot(dimension.end.x - dimension.start.x, dimension.end.z - dimension.start.z);
    const label = env.label(value);
    const color = options.preview ? env.colors.preview : options.selected ? env.colors.selected : env.colors.stroke;
    const arrow = (point, angle) => {
      const size = 5;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + size * Math.cos(angle + 2.65), point.y + size * Math.sin(angle + 2.65));
      ctx.lineTo(point.x + size * Math.cos(angle - 2.65), point.y + size * Math.sin(angle - 2.65));
      ctx.closePath();
      ctx.fill();
    };
    ctx.save();
    if (options.selected) {
      ctx.strokeStyle = env.colors.selectedHalo;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(da.x, da.y); ctx.lineTo(db.x, db.y);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = options.selected ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(da.x, da.y);
    ctx.moveTo(b.x, b.y); ctx.lineTo(db.x, db.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(da.x, da.y); ctx.lineTo(db.x, db.y);
    ctx.stroke();
    const angle = Math.atan2(db.y - da.y, db.x - da.x);
    arrow(da, angle);
    arrow(db, angle + Math.PI);
    const midX = (da.x + db.x) / 2;
    const midY = (da.y + db.y) / 2;
    // Aligned text: the label runs along the dimension line, normalized so it
    // reads from the bottom or the right edge of the sheet, never the left.
    let textAngle = angle;
    while (textAngle >= Math.PI / 2) textAngle -= Math.PI;
    while (textAngle < -Math.PI / 2) textAngle += Math.PI;
    ctx.font = "600 11px 'Barlow Condensed', system-ui, sans-serif";
    const textWidth = ctx.measureText(label).width;
    ctx.translate(midX, midY);
    ctx.rotate(textAngle);
    ctx.fillStyle = env.colors.labelBack;
    ctx.fillRect(-textWidth / 2 - 3, -8, textWidth + 6, 15);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }


  // ─── Outlines, their marks, and the trace in progress ─────────────────────
  // Committed outlines dashed in the edit-scope colours -- RED on the
  // BONEYARD where an edit moves every level, BLUE on a floor level where it
  // stays local, and one shade over for garages -- plus their fenestration
  // marks, the ghost mark under the cursor, and the rubber band while a new
  // outline is being traced.
  //
  // The last of those reads live interaction state (snapPt, outlineDrawing,
  // outlinePoints, activeTool). A caller working from a SAVED drawing has
  // none of it: pass outlineDrawing false and snapPt null and those branches
  // simply do not fire, leaving the committed outlines. That is why the
  // painter is not split in two -- the preview half costs a caller nothing
  // to ignore.
  function drawOutlines2D(ctx, toS, env) {
    if (env.isPrinting) return;
    // Scope colours: RED on the BONEYARD, where an edit moves every level;
    // BLUE on a floor level, where an edit stays local — the app's red/blue
    // all-levels language. Garage outlines speak the same language one shade
    // over: ORANGE on the BONEYARD, PURPLE on the levels.
    const hex = env.boneyardActive ? env.colors.boneyard : env.colors.level;
    const garageHex = env.boneyardActive ? env.colors.garageBoneyard : env.colors.garageLevel;
    const outlines = env.boneyardActive ? env.boneyardOutlines : env.outlines;
    const showHandles = env.showHandles;
    ctx.save();
    ctx.lineWidth = 2;
    outlines.forEach(outline => {
      if (outline.points.length < 2) return;
      const selected = env.isSelected(outline);
      const colour = outline.garage ? garageHex : hex;
      ctx.strokeStyle = colour;
      ctx.fillStyle = colour;
      ctx.lineWidth = selected ? 3.5 : 2;
      ctx.setLineDash([9, 5]);
      ctx.beginPath();
      const count = env.segmentCount(outline);
      for (let index = 0; index < count; index++) {
        const seg = env.segment(outline, index);
        const a = toS(seg.start), b = toS(seg.end);
        if (!index) ctx.moveTo(a.x, a.y);
        if (seg.bulge) {
          const c = toS(env.controlPoint(seg));
          ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
        } else {
          ctx.lineTo(b.x, b.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (outline.garage) {
        const centroid = outline.points.reduce(
          (sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }),
          { x: 0, z: 0 },
        );
        const s = toS({ x: centroid.x / outline.points.length, z: centroid.z / outline.points.length });
        ctx.font = '600 11px "Barlow Condensed", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GARAGE', s.x, s.y);
      }
      if (showHandles) {
        outline.points.forEach(point => {
          const s = toS(point);
          ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
        });
      }
      // Fenestration marks live on masters only, so they show on the BONEYARD.
      (outline.marks || []).forEach(mark => drawBoneyardMark2D(ctx, toS, outline, mark, colour, env));
    });
    // The FENESTRATION tool on the BONEYARD ghosts the mark it would place
    // on the master edge under the cursor.
    if (env.boneyardActive && env.activeTool === 'fenestration'
        && env.fenestrationType !== 'stairs' && env.snapPt) {
      const placement = env.markPlacement(env.snapPt);
      if (placement && !placement.error) {
        const ghost = {
          edgeId: placement.edgeId,
          offsetFt: placement.offsetFt,
          widthFt: placement.widthFt,
          type: env.fenestrationType === 'window' ? 'window' : 'door',
        };
        ctx.globalAlpha = 0.55;
        drawBoneyardMark2D(ctx, toS, placement.outline, ghost, hex, env);
        ctx.globalAlpha = 1;
      }
    }
    // In-progress preview: placed corners plus a rubber band to the cursor,
    // with a close ring on the start point once the outline can close.
    if (env.outlineDrawing && env.outlinePoints.length) {
      // The live trace wears its top-bar button's colour so the drafter
      // always knows what they are drawing: HOUSE red, ATTACHED garage
      // blue, DETACHED garage purple. Committed outlines fall back to the
      // red/blue edit-scope language above.
      const drawHex = env.outlineGarage === 'attached' ? env.colors.traceAttached
        : env.outlineGarage === 'detached' ? env.colors.garageLevel
        : env.colors.traceHouse;
      ctx.strokeStyle = drawHex;
      ctx.fillStyle = drawHex;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      env.outlinePoints.forEach((point, index) => {
        const s = toS(point);
        if (index) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
      });
      const cursor = env.frozenEnd
        ? env.frozenEnd : env.snapPt;
      if (cursor) { const s = toS(cursor); ctx.lineTo(s.x, s.y); }
      ctx.stroke();
      ctx.setLineDash([]);
      env.outlinePoints.forEach(point => {
        const s = toS(point);
        ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
      });
      // An ATTACHED garage run finishes on its LAST point (double-click /
      // Enter there); a DETACHED garage and a house outline close back on
      // the START point, so those only ring the start.
      const rings = [];
      if (env.outlinePoints.length >= 3 && env.outlineStart) rings.push(env.outlineStart);
      if (env.outlineGarage === 'attached' && env.outlinePoints.length >= 4) {
        rings.push(env.outlinePoints[env.outlinePoints.length - 1]);
      }
      rings.forEach(ring => {
        const sc = toS(ring);
        ctx.beginPath(); ctx.arc(sc.x, sc.y, 7.5, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
    ctx.restore();
  }


  // ─── A segment's path, straight or bulged ─────────────────────────────────
  // Traces and strokes one segment. A bulged segment curves through its
  // control point; a straight one is a line to its end.
  //
  // This is a PRIMITIVE, not a painter: it owns the path and nothing else.
  // Colour, width, line cap and endpoint decoration stay with the caller,
  // because the three callers in MODEL disagree on every one of them -- a
  // reference segment is thin in the caller's colour with round dots, a
  // committed line is LINE_COLOR with dots, a selected segment is a thick
  // round-capped halo with square handles. The bulge maths is the only part
  // they share, and it is the only part here.
  function strokeSegPath2D(ctx, toS, seg, env) {
    const a = toS(seg.start), b = toS(seg.end);
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    if (seg.bulge) {
      const c = toS(env.controlPoint(seg));
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
    } else {
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }


  // ─── A leader note ────────────────────────────────────────────────────────
  // The text block, its leader to the anchor, an optional arrowhead, and an
  // optional filled / outlined box with a bullnose radius. The block grows
  // away from the anchor so the leader always meets its near edge.
  //
  // Note that anchor and text arrive in SCREEN space, not world -- the caller
  // has already projected them, because a note on the stair workspace is
  // placed in pane coordinates rather than on the plan. So this painter needs
  // no toS and reads nothing from the model: two colours are its whole env.
  // It was callable from any page all along; only its location said otherwise.
  function drawNoteScreen2D(ctx, anchor, text, note, options = {}, env) {
    const preview = options.preview === true;
    const alpha = preview ? 0.6 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = env.color;
    ctx.fillStyle = env.color;
    ctx.lineWidth = 1;
    ctx.font = "600 12px 'Barlow Condensed', system-ui, sans-serif";
    const lines = String(note.body || '').split('\n');
    const padX = 6, lineH = 14;
    const boxW = Math.max(24, ...lines.map(line => ctx.measureText(line).width)) + padX * 2;
    const boxH = lines.length * lineH + 8;
    // The text block grows away from the anchor; the leader meets its near edge.
    const left = text.x >= anchor.x ? text.x : text.x - boxW;
    const top = text.y - boxH / 2;
    const leaderX = text.x >= anchor.x ? left : left + boxW;
    if (note.end !== 'none') {
      if (preview) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(leaderX, text.y);
      ctx.lineTo(anchor.x, anchor.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (note.end === 'arrow') {
      const angle = Math.atan2(anchor.y - text.y, anchor.x - leaderX);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(anchor.x - 9 * Math.cos(angle - 0.3), anchor.y - 9 * Math.sin(angle - 0.3));
      ctx.lineTo(anchor.x - 9 * Math.cos(angle + 0.3), anchor.y - 9 * Math.sin(angle + 0.3));
      ctx.closePath();
      ctx.fill();
    }
    if (note.fill || note.outline) {
      const radius = Math.min(Math.max(0, Number(note.bullnose) || 0), boxH / 2, boxW / 2);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(left, top, boxW, boxH, radius);
      else ctx.rect(left, top, boxW, boxH);
      if (note.fill) {
        ctx.save();
        ctx.globalAlpha = alpha * Math.min(1, Math.max(0, note.fillOpacity ?? 0.85));
        ctx.fillStyle = env.fillColor;
        ctx.fill();
        ctx.restore();
      }
      if (note.outline) ctx.stroke();
    }
    ctx.fillStyle = env.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, left + padX, top + 4 + lineH * i + lineH / 2));
    ctx.restore();
  }


  // ─── Notes on the stair workspace ─────────────────────────────────────────
  // The committed notes for this stair, the anchor being placed, and the one
  // being typed. Positions come from the frame's pane projections, because a
  // stair note lives in pane coordinates -- section or plan -- rather than on
  // the drawing.
  //
  // paintNote is drawNoteScreen2D directly: inside the module a painter calls
  // its neighbour rather than going back out through the page.
  function drawStairNotes2D(ctx, frame, env) {
    const paintNote = (a, t, n, o) => drawNoteScreen2D(ctx, a, t, n, o || {}, {
      color: env.noteColor, fillColor: env.noteFillColor,
    });
    env.notes
      .filter(note => note.view === 'stair' && note.levelId === frame.stair.levelId)
      .forEach(note => {
        const pane = note.pane === 'plan' ? 'plan' : 'section';
        if (!frame.rects[pane]) return;
        paintNote(frame.paneScreen(pane, note.anchor), frame.paneScreen(pane, note.text), note);
      });
    const anchor = env.anchor;
    if (anchor && anchor.view === 'stair' && frame.rects[anchor.pane]) {
      const a = frame.paneScreen(anchor.pane, anchor.pt);
      const hover = env.hover;
      if (hover && frame.paneAt(hover.x, hover.y) === anchor.pane
        && Math.hypot(hover.x - a.x, hover.y - a.y) > 1) {
        paintNote(a, hover, env.previewStyle('…'), { preview: true });
      } else {
        ctx.save();
        ctx.strokeStyle = env.noteColor;
        ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    const pending = env.pending;
    if (pending && pending.view === 'stair' && frame.rects[pending.pane] && env.noteEditor) {
      paintNote(
        frame.paneScreen(pending.pane, pending.anchor),
        frame.paneScreen(pending.pane, pending.text),
        env.previewStyle(env.noteDraft.trim() || '…'),
        { preview: true },
      );
    }
  }

  // ─── The drafter's cuts ───────────────────────────────────────────────────
  // A cut is a section line: a dashed run across the plan with a labelled
  // bubble at each end wearing a filled triangle that points the way the view
  // looks. TWO painters, not one, and the reason is paint order rather than
  // taste — on the page these two are separated by the elevation-mark grab
  // handles, so fusing them here would lift the in-progress preview above the
  // handles in z-order. The caller keeps them in its own order.
  //
  // What did NOT come with them: the hit regions. The page function these were
  // lifted out of also cleared and rebuilt _eMarkHandleHits and _toyTabHits on
  // the same traversal, which is component state and cannot live in a module
  // whose contract is "no component state, no THREE, no DOM beyond the ctx".
  // Building hit regions is not painting; they are separable concerns that
  // happen to want the same geometry.
  const cutSnap = v => Math.round(v - 0.5) + 0.5;

  // Hairlines land on the half-pixel grid so the dashes stay crisp at any
  // canvas size instead of antialiasing into two washed-out rows.
  function cutDashedSeg(ctx, toS, start, end) {
    const a = toS(start), b = toS(end);
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(cutSnap(a.x), cutSnap(a.y));
    ctx.lineTo(cutSnap(b.x), cutSnap(b.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Direction choice previews as the mark itself: a small blank bubble wearing
  // the tucked triangle, one per side, each pointing the way that side's view
  // would look. The cursor's side glows.
  function cutChoiceMark(ctx, toS, mid, dir, hot) {
    const mS = toS(mid);
    const dS = toS({ x: mid.x + dir.x, y: mid.y, z: mid.z + dir.z });
    let vx = dS.x - mS.x, vy = dS.y - mS.y;
    const vLen = Math.hypot(vx, vy) || 1;
    vx /= vLen; vy /= vLen;
    const ux = -vy, uy = vx;
    const R = 6, ink = hot ? '#ff3366' : '#994466';
    const cx = mS.x + vx * 18, cy = mS.y + vy * 18;
    const reach = R + 6, wing = R + 4, back = 2;
    ctx.beginPath();
    ctx.moveTo(cx + vx * reach, cy + vy * reach);
    ctx.lineTo(cx - ux * wing - vx * back, cy - uy * wing - vy * back);
    ctx.lineTo(cx + ux * wing - vx * back, cy + uy * wing - vy * back);
    ctx.closePath();
    ctx.fillStyle = ink; ctx.fill();
    ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.stroke();
  }

  // The committed cuts: every standard elevation plus every cut the drafter
  // has placed. env.lineSpan runs a hand-placed cut clear across the plan --
  // a section line never dies halfway through the house -- while the standard
  // elevations already sit in the gap outside the walls and keep their ends.
  function drawCutMarks2D(ctx, toS, env) {
    const bubbleMark = cut => {
      const y = cut.elev + 0.02;
      let start = { x: cut.startPt.x, y, z: cut.startPt.z };
      let end = { x: cut.endPt.x, y, z: cut.endPt.z };
      // A hand-placed cut draws as an infinite line: it runs clear across the
      // plan whatever the drafter drew — never dying halfway through the
      // house — and stops in the gap between the walls and the first
      // dimension string, landing the bubbles there. The standard elevations
      // already sit in that gap, so they keep their drawn ends.
      if (!cut.auto) {
        const span = env.lineSpan(start, end);
        start = span.start;
        end = span.end;
      }
      cutDashedSeg(ctx, toS, start, end);

      const a = toS(start), b = toS(end);
      const lineLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (lineLen < 2) return;
      const ux = (b.x - a.x) / lineLen, uy = (b.y - a.y) / lineLen;
      // The viewer stands on +dirVec, so the sight line is the opposite way.
      const mid = { x: (start.x + end.x) / 2, y, z: (start.z + end.z) / 2 };
      const mS = toS(mid);
      const vS = toS({ x: mid.x - cut.dirVec.x, y, z: mid.z - cut.dirVec.z });
      let vx = vS.x - mS.x, vy = vS.y - mS.y;
      const vLen = Math.hypot(vx, vy) || 1;
      vx /= vLen; vy /= vLen;

      const R = 8, ink = ctx.strokeStyle;
      [[a, -1], [b, 1]].forEach(([p, side]) => {
        const cx = p.x + ux * side * (R + 2), cy = p.y + uy * side * (R + 2);
        if (env.bubbleStyle === 'tucked') {
          // Triangle first, tucked behind the circle — but wide enough that
          // all three points clear the rim: the apex shows in the view
          // direction and both back corners poke out either side, so the
          // whole triangle reads instead of a lone spike.
          const reach = R + 8, wing = R + 6, back = 2;
          ctx.beginPath();
          ctx.moveTo(cx + vx * reach, cy + vy * reach);
          ctx.lineTo(cx - ux * wing - vx * back, cy - uy * wing - vy * back);
          ctx.lineTo(cx + ux * wing - vx * back, cy + uy * wing - vy * back);
          ctx.closePath();
          ctx.fillStyle = ink; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.stroke();
        if (env.bubbleStyle === 'proud') {
          const tx = cx + vx * R, ty = cy + vy * R;
          ctx.beginPath();
          ctx.moveTo(tx + vx * 8, ty + vy * 8);
          ctx.lineTo(tx - vy * 5.5, ty + vx * 5.5);
          ctx.lineTo(tx + vy * 5.5, ty - vx * 5.5);
          ctx.closePath();
          ctx.fillStyle = ink; ctx.fill();
        }
        // The circle never grows: long names shrink their letters to fit.
        const label = cut.name || '';
        let fontPx = 10;
        ctx.font = `600 ${fontPx}px "Barlow Condensed", system-ui, sans-serif`;
        const maxW = (R - 1.5) * 2;
        const w = ctx.measureText(label).width;
        if (w > maxW) {
          fontPx = Math.max(5, Math.floor(fontPx * maxW / w * 10) / 10);
          ctx.font = `600 ${fontPx}px "Barlow Condensed", system-ui, sans-serif`;
        }
        ctx.fillStyle = ink;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy + 0.5);
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    };
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#b04060';
    ctx.fillStyle = '#b04060';
    [...env.autoCuts, ...env.cuts].forEach(bubbleMark);
    ctx.restore();
  }

  // The cut being placed: the rubber-band line, and once both ends are down,
  // the two direction bubbles the drafter picks between.
  function drawCutPreview2D(ctx, toS, env) {
    ctx.save();
    const phase = env.phase;
    if (phase !== 'idle' && env.cutStart) {
      const y = (env.drawElev || 0) + 0.05;
      const start = { x: env.cutStart.x, y, z: env.cutStart.z };
      const pending = phase === 'placing' ? env.snapPt : env.cutEnd;
      if (pending) {
        const end = { x: pending.x, y, z: pending.z };
        ctx.strokeStyle = '#994466';
        ctx.fillStyle = '#994466';
        cutDashedSeg(ctx, toS, start, end);
        if (phase === 'choosing' && env.dirLeft && env.dirRight) {
          const mid = { x: (start.x + end.x) / 2, y, z: (start.z + end.z) / 2 };
          cutChoiceMark(ctx, toS, mid, env.dirLeft,  env.hoverSide === 'left');
          cutChoiceMark(ctx, toS, mid, env.dirRight, env.hoverSide === 'right');
        }
      }
    }
    ctx.restore();
  }

  window.DraftRender2D = Object.freeze({
    drawWallSeg2D,
    drawRoof2D,
    drawShape2D,
    drawFixture2D,
    drawUnderlays2D,
    drawGrid2D,
    drawOrigin2D,
    drawStairs2D,
    drawFloor2D,
    drawBoneyardMark2D,
    drawDimension2D,
    drawOutlines2D,
    strokeSegPath2D,
    drawNoteScreen2D,
    drawStairNotes2D,
    drawCutMarks2D,
    drawCutPreview2D,
  });
})();
}
