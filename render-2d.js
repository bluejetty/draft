// 2D overlay painters extracted pure from the Model Space: canvas context,
// world→screen transform, the thing to draw, and an env object naming every
// outside dependency — no component state, no THREE, no DOM beyond the ctx.
// Draw order stays with the caller; these paint exactly one thing each.
if (!window.DraftRender2D) {
(() => {
  function drawWallSeg2D(ctx, toS, seg, preview, joins, mode, env) {
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
          ctx.fillStyle = preview ? 'rgba(255,255,255,0.8)' : '#ffffff';
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
    ctx.strokeStyle = preview ? 'rgba(29,31,32,0.45)' : '#1d1f20';
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
      ctx.fillStyle = '#1d1f20';
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
      const door = env.closetDoorFor(in1 - in0);
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

  window.DraftRender2D = Object.freeze({
    drawWallSeg2D,
    drawRoof2D,
    drawShape2D,
    drawFixture2D,
  });
})();
}
