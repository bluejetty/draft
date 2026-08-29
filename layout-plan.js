// LAYOUT plan viewports (board #168): pure helpers that turn a saved drawing's
// plan-level entities into ink on a sheet. Everything model-side stays in feet;
// the caller owns the model→screen transform (toS), built from the viewport's
// architectural scale (paper inches per model foot) and the sheet zoom. The
// wall painter is the shared DraftRender2D one; walls parsed from JSON get
// their shared corners re-interned so the identity-keyed join index works
// exactly as it does in the Model Space.
if (!window.DraftLayoutPlan) {
(() => {
  const { WALL_TYPES, LEGACY_WALL_TYPES } = window.DraftWallTypes;

  const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);

  // Walls of one level as the PLAN context shows them: the level's own plan
  // walls plus its foundation structure (the foundation-level PLAN draws the
  // int walls against the poured concrete). Shared endpoints intern to one
  // point object per coordinate so the join index can key on identity.
  function planWalls(saved, levelId) {
    const interned = new Map();
    const intern = raw => {
      const x = num(raw?.x), z = num(raw?.z);
      if (x === null || z === null) return null;
      const key = `${Math.round(x * 4096)},${Math.round(z * 4096)}`;
      if (!interned.has(key)) interned.set(key, { x, y: 0, z });
      return interned.get(key);
    };
    return (Array.isArray(saved?.walls) ? saved.walls : [])
      .filter(wall => wall?.levelId === levelId)
      .map(wall => {
        const start = intern(wall.start), end = intern(wall.end);
        if (!start || !end || start === end) return null;
        const wallType = WALL_TYPES.some(type => type.id === wall.wallType)
          ? wall.wallType
          : (LEGACY_WALL_TYPES[wall.wallType] || 'stud_2x6');
        return {
          id: wall.id,
          start,
          end,
          levelId,
          wallType,
          refLine: ['left', 'right', 'center'].includes(wall.refLine) ? wall.refLine : 'left',
        };
      })
      .filter(Boolean);
  }

  function planOpenings(saved, levelId, walls) {
    const wallIds = new Set(walls.map(wall => wall.id));
    return (Array.isArray(saved?.fenestrations) ? saved.fenestrations : [])
      .filter(opening => opening?.levelId === levelId
        && wallIds.has(opening.wallId)
        && num(opening.offset) !== null
        && num(opening.width) > 0);
  }

  // Same shared-endpoint join index the Model Space builds: two non-collinear
  // walls form a miter, collinear pairs are continuous, three entries with a
  // collinear pair form a T, larger nodes suppress ambiguous cap lines.
  function wallJoins(walls) {
    const endpointGroups = new Map();
    const add = (seg, pt, at) => {
      if (!endpointGroups.has(pt)) endpointGroups.set(pt, []);
      endpointGroups.get(pt).push({ seg, at });
    };
    walls.forEach(w => {
      add(w, w.start, 'start');
      add(w, w.end, 'end');
    });
    const joins = new Map();
    const outward = entry => {
      const vertex = entry.at === 'start' ? entry.seg.start : entry.seg.end;
      const other = entry.at === 'start' ? entry.seg.end : entry.seg.start;
      const dx = other.x - vertex.x, dz = other.z - vertex.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      return len < 0.001 ? null : { x: dx / len, z: dz / len };
    };
    for (const [vertex, entries] of endpointGroups) {
      if (entries.length === 2) {
        const a = outward(entries[0]), b = outward(entries[1]);
        if (a && b) {
          if (Math.abs(a.x * b.z - a.z * b.x) > 0.001) {
            joins.set(vertex, { type: 'miter', entries });
          } else if (a.x * b.x + a.z * b.z < -0.995) {
            joins.set(vertex, { type: 'continuation', entries });
          }
        }
        continue;
      }
      if (entries.length === 3) {
        let hostPair = null;
        let strongestOpposition = -1;
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            const a = outward(entries[i]), b = outward(entries[j]);
            if (!a || !b) continue;
            const opposition = -(a.x * b.x + a.z * b.z);
            if (opposition > strongestOpposition) {
              strongestOpposition = opposition;
              hostPair = [entries[i], entries[j]];
            }
          }
        }
        if (hostPair && strongestOpposition > 0.995) {
          joins.set(vertex, {
            type: 'tee',
            host: hostPair,
            stem: entries.find(entry => !hostPair.includes(entry)),
          });
        }
        continue;
      }
      if (entries.length >= 4) {
        joins.set(vertex, { type: 'multi', entries });
      }
    }
    return joins;
  }

  // Extents of the walls in model feet, outside faces included, so the
  // viewport centres on the drawn plan rather than on the reference lines.
  function wallBounds(walls) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    walls.forEach(wall => {
      const def = WALL_TYPES.find(type => type.id === wall.wallType) || WALL_TYPES[1];
      const reach = def.totalIn / 12;
      [wall.start, wall.end].forEach(pt => {
        minX = Math.min(minX, pt.x - reach); maxX = Math.max(maxX, pt.x + reach);
        minZ = Math.min(minZ, pt.z - reach); maxZ = Math.max(maxZ, pt.z + reach);
      });
    });
    if (minX > maxX) return null;
    return { minX, minZ, maxX, maxZ };
  }

  // World-space footprint of an opening on its host wall — the Model Space's
  // opening geometry with the gap pad as a plain model-feet argument.
  function openingGeometry(opening, wall, padFt = 0.02) {
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    const width = Number(opening.width);
    const JAMB_FT = 0.01;
    if (!(width > 0) || len < width + JAMB_FT * 2) return null;
    const half = width / 2;
    const offset = Math.min(Math.max(Number(opening.offset), half + JAMB_FT), len - half - JAMB_FT);
    const ux = dx / len, uz = dz / len;
    const nx = -uz, nz = ux;
    const def = WALL_TYPES.find(w => w.id === (wall.wallType || 'stud_2x6')) || WALL_TYPES[1];
    const totalFt = def.totalIn / 12;
    const refLine = wall.refLine || 'center';
    const startOff = refLine === 'left' ? 0 : refLine === 'right' ? -totalFt : -totalFt / 2;
    const endOff = startOff + totalFt;
    const midOff = (startOff + endOff) / 2;
    const at = (along, across) => ({
      x: wall.start.x + ux * along + nx * across,
      y: 0,
      z: wall.start.z + uz * along + nz * across,
    });
    return {
      wall,
      center: at(offset, midOff),
      corners: [
        at(offset - half, startOff - padFt),
        at(offset + half, startOff - padFt),
        at(offset + half, endOff + padFt),
        at(offset - half, endOff + padFt),
      ],
      jambs: [
        [at(offset - half, startOff - padFt), at(offset - half, endOff + padFt)],
        [at(offset + half, startOff - padFt), at(offset + half, endOff + padFt)],
      ],
      glazing: [at(offset - half, midOff), at(offset + half, midOff)],
    };
  }

  // Paint one opening the way the plan does: paper-coloured gap, jamb caps,
  // double-glazed panes with frame blocks for windows, leaf + quarter swing
  // for doors. Garage doors stay a plain gap with jambs.
  function drawOpening2D(ctx, toS, opening, geo, env = {}) {
    const pts = geo.corners.map(toS);
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = env.paperColor || '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#1d1f20';
    ctx.lineWidth = 1.5;
    geo.jambs.forEach(([a, b]) => {
      const sa = toS(a), sb = toS(b);
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
    });
    const [gwa, gwb] = geo.glazing;
    const glazeRun = Math.hypot(gwb.x - gwa.x, gwb.z - gwa.z) || 1;
    const gux = (gwb.x - gwa.x) / glazeRun, guz = (gwb.z - gwa.z) / glazeRun;
    const gnx = -guz, gnz = gux;
    if (opening.type === 'window') {
      ctx.lineWidth = 1.25;
      [0.375 / 12, -0.375 / 12].forEach(off => {
        const a = toS({ x: gwa.x + gnx * off, z: gwa.z + gnz * off });
        const b = toS({ x: gwb.x + gnx * off, z: gwb.z + gnz * off });
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      const halfDepth = Math.max(...geo.corners.map(corner =>
        Math.abs((corner.x - geo.center.x) * gnx + (corner.z - geo.center.z) * gnz)));
      const poke = halfDepth + 0.5 / 12;
      const frameAlong = 2 / 12;
      [[gwa, 1], [gwb, -1]].forEach(([end, sgn]) => {
        const quad = [
          { x: end.x + gnx * poke, z: end.z + gnz * poke },
          { x: end.x - gnx * poke, z: end.z - gnz * poke },
          { x: end.x + gux * sgn * frameAlong - gnx * poke, z: end.z + guz * sgn * frameAlong - gnz * poke },
          { x: end.x + gux * sgn * frameAlong + gnx * poke, z: end.z + guz * sgn * frameAlong + gnz * poke },
        ].map(toS);
        ctx.beginPath();
        ctx.moveTo(quad[0].x, quad[0].y); ctx.lineTo(quad[1].x, quad[1].y);
        ctx.lineTo(quad[2].x, quad[2].y); ctx.lineTo(quad[3].x, quad[3].y);
        ctx.closePath(); ctx.stroke();
      });
    }
    if (opening.type === 'door' && !opening.garage) {
      const hinge = toS(gwa);
      const tip = toS({ x: gwa.x + gnx * glazeRun, z: gwa.z + gnz * glazeRun });
      const latch = toS(gwb);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(hinge.x, hinge.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      const r = Math.hypot(tip.x - hinge.x, tip.y - hinge.y);
      const a0 = Math.atan2(tip.y - hinge.y, tip.x - hinge.x);
      const a1 = Math.atan2(latch.y - hinge.y, latch.x - hinge.x);
      let sweep = a1 - a0;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(hinge.x, hinge.y, r, a0, a0 + sweep, sweep < 0); ctx.stroke();
    }
    ctx.restore();
  }

  // Paint one plan viewport: walls in the Model Space draw order (every fill
  // beneath every boundary), then the openings carving their gaps. toS maps
  // model feet to screen pixels; the caller centres it on the wall bounds.
  function drawPlan(ctx, toS, saved, levelId, env = {}) {
    const walls = planWalls(saved, levelId);
    if (!walls.length) return false;
    const joins = wallJoins(walls);
    const wallEnv = { wallTypes: WALL_TYPES };
    walls.forEach(w => window.DraftRender2D.drawWallSeg2D(ctx, toS, w, false, joins, 'fill', wallEnv));
    walls.forEach(w => window.DraftRender2D.drawWallSeg2D(ctx, toS, w, false, joins, 'stroke', wallEnv));
    planOpenings(saved, levelId, walls).forEach(opening => {
      const wall = walls.find(w => w.id === opening.wallId);
      const geo = wall && openingGeometry(opening, wall, env.padFt);
      if (geo) drawOpening2D(ctx, toS, opening, geo, env);
    });
    return true;
  }

  window.DraftLayoutPlan = Object.freeze({
    planWalls,
    planOpenings,
    wallJoins,
    wallBounds,
    openingGeometry,
    drawOpening2D,
    drawPlan,
  });
})();
}
