// ROOM GROWING (boards #275/#276) — the pure module. Stamp programs in,
// partition walls + room claims out; plus the #276 numbering rules and
// the WC fixture suffix. No DOM, no component state: MODEL gathers real
// geometry and commits, exactly like build-house.js / auto-stair.js.
if (!window.DraftRoomGrow) {
(() => {
  const geo = window.DraftGeometry2D;

  // ── Tunables ──────────────────────────────────────────────────────────
  const CORRIDOR_FT = 3;            // hall spine, clear width
  const WALL_FT = 3.5 / 12;         // 2x4 interior stock, centreline thinking
  const JOG_SNAP_FT = 1;            // #247: under 1'-0" off a jog face = accident
  // Size seeds for chips without a minimums row (blessed as tunables;
  // they graduate to an office standard under #196 later). ENSUITE reads
  // the wc row at growth time.
  const SIZE_SEEDS = Object.freeze({
    'WALK-IN': { minAreaSqFt: 24, minDimensionFt: 4 },   // 4'x6'
    CLOSET: { minAreaSqFt: 24, minDimensionFt: 4 },       // 4'x6'
    PANTRY: { minAreaSqFt: 16, minDimensionFt: 4 },       // 4'x4'
    STORAGE: { minAreaSqFt: 24, minDimensionFt: 4 },      // 4'x6'
    DINING: { minAreaSqFt: 100, minDimensionFt: 8 },
    'OFFICE/DEN': { minAreaSqFt: 80, minDimensionFt: 8 },
  });

  // ── #276 numbering ───────────────────────────────────────────────────
  // BEDROOM and WC ladders run ONCE across all above-grade floors, in
  // stamp order (placement order — the id). BEDROOM 1 is the primary
  // suite's own base, exactly one per house, never numbered further and
  // never in the basement. The basement runs its own B-series ladder per
  // base. A claimedNo pins a tag's number; the ladder skips claimed
  // numbers. Everything else (CLOSET, KITCHEN...) keeps today's
  // per-floor bare-when-alone behavior — only BEDROOM and WC went
  // house-wide under the ruling.
  const HOUSE_WIDE_BASES = Object.freeze(['BEDROOM', 'WC']);
  const PRIMARY_BASE = 'BEDROOM 1';

  const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

  // tags: [{ id, base, levelId, claimedNo?, companionOf? }] — every
  // STAMPED tag in the house. Returns Map id → name for the tags whose
  // names this rule owns (primary + house-wide bases + basement series);
  // tags of other bases are left to the existing per-floor machinery.
  const assignStampNumbers = (tags, { basementLevelId = 1 } = {}) => {
    const names = new Map();
    const list = (Array.isArray(tags) ? tags : [])
      .filter(tag => tag && Number.isInteger(tag.id))
      .sort((a, b) => a.id - b.id);
    list.filter(tag => norm(tag.base) === PRIMARY_BASE)
      .forEach(tag => names.set(tag.id, 'BEDROOM 1'));
    HOUSE_WIDE_BASES.forEach(base => {
      [true, false].forEach(basement => {
        const pool = list.filter(tag => norm(tag.base) === base
          && (tag.levelId === basementLevelId) === basement);
        if (!pool.length) return;
        const claimed = new Set(pool
          .filter(tag => Number.isInteger(tag.claimedNo) && tag.claimedNo > 0)
          .map(tag => tag.claimedNo));
        // The ordinary BEDROOM ladder starts at 2 above grade — number 1
        // belongs to the primary suite. Basement ladders and WC start at 1.
        let next = !basement && base === 'BEDROOM' ? 2 : 1;
        const prefix = basement ? 'B' : '';
        pool.forEach(tag => {
          let n;
          if (Number.isInteger(tag.claimedNo) && tag.claimedNo > 0) {
            n = tag.claimedNo;
          } else {
            while (claimed.has(next)) next += 1;
            n = next;
            next += 1;
          }
          names.set(tag.id, `${base} ${prefix}${n}`);
        });
      });
    });
    return names;
  };

  // One primary per house, at any instant. Basement never hosts it.
  const primaryAllowed = (tags, { basementLevelId = 1, levelId } = {}) => {
    if (levelId === basementLevelId) return { ok: false, reason: 'basement' };
    const standing = (Array.isArray(tags) ? tags : [])
      .some(tag => norm(tag.base) === PRIMARY_BASE);
    return standing ? { ok: false, reason: 'standing' } : { ok: true };
  };

  // ── The WC fixture suffix ────────────────────────────────────────────
  // A live property readout, never stored: /B for a tub in the room, /S
  // for a shower (a stall IS a shower), /BS for both.
  const wcSuffix = kinds => {
    const set = new Set([...(kinds || [])].map(norm));
    const bath = set.has('TUB');
    const shower = set.has('SHOWER') || set.has('STALL');
    return bath && shower ? '/BS' : bath ? '/B' : shower ? '/S' : '';
  };

  // ── The partition (blessed v1: slice-packing off the corridor spine) ──
  const seedFor = (base, minimums) => {
    const b = norm(base);
    const table = minimums || {};
    const category = window.DraftRoomStandards
      ? window.DraftRoomStandards.stampCategory(b) : null;
    if (b === PRIMARY_BASE) {
      const row = table.bedroom || { minAreaSqFt: 97, minDimensionFt: 9 + 8 / 12 };
      // The primary claims the largest bedroom position: half again the row.
      return { minAreaSqFt: row.minAreaSqFt * 1.5, minDimensionFt: row.minDimensionFt, optional: false };
    }
    if (category && table[category]) {
      return { ...table[category], optional: !['bedroom', 'wc'].includes(category) };
    }
    if (SIZE_SEEDS[b]) return { ...SIZE_SEEDS[b], optional: true };
    if (b === 'LIVING' && table.living) return { ...table.living, optional: true };
    return { minAreaSqFt: 60, minDimensionFt: 6, optional: true }; // custom chips
  };

  const pointInRing = (ring, pt) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if ((a.z > pt.z) !== (b.z > pt.z)
        && pt.x < a.x + (b.x - a.x) * (pt.z - a.z) / (b.z - a.z)) inside = !inside;
    }
    return inside;
  };

  // growRooms: the level's interior region (inside face of the exterior
  // walls, a plain ring), this level's stamps, and the stair wells to
  // carve. Returns centreline wall segments, per-stamp room claims with
  // their minimums verdicts, the corridor, and a report.
  const growRooms = opts => {
    const {
      points, stamps = [], stairWells = [], minimums = null,
      corridorFt = CORRIDOR_FT, jogSnapFt = JOG_SNAP_FT,
    } = opts;
    const report = [];
    if (!Array.isArray(points) || points.length < 3) {
      return { walls: [], rooms: [], corridor: null, report: ['no region'] };
    }
    const roomStamps = stamps.filter(stamp => stamp.companionOf == null);
    const companions = stamps.filter(stamp => stamp.companionOf != null);
    if (!roomStamps.length) return { walls: [], rooms: [], corridor: null, report: ['no stamps'] };
    const xs = points.map(pt => pt.x), zs = points.map(pt => pt.z);
    const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    // v1 works in the long axis = x frame; flip a tall region.
    const flipped = (box.x1 - box.x0) < (box.z1 - box.z0);
    const T = flipped ? pt => ({ x: pt.z, z: pt.x }) : pt => ({ x: pt.x, z: pt.z });
    const ring = points.map(T);
    const wells = stairWells.map(poly => poly.map(T));
    const S = roomStamps.map(stamp => ({ ...stamp, ...T(stamp) }));
    const C = companions.map(stamp => ({ ...stamp, ...T(stamp) }));
    const rxs = ring.map(pt => pt.x), rzs = ring.map(pt => pt.z);
    const R = { x0: Math.min(...rxs), x1: Math.max(...rxs), z0: Math.min(...rzs), z1: Math.max(...rzs) };

    // The corridor spine: a corridorFt band along the long axis at the
    // stair well's cross position (the region middle without a stair),
    // clamped inside the region.
    const wellBox = wells.length ? {
      x0: Math.min(...wells[0].map(pt => pt.x)), x1: Math.max(...wells[0].map(pt => pt.x)),
      z0: Math.min(...wells[0].map(pt => pt.z)), z1: Math.max(...wells[0].map(pt => pt.z)),
    } : null;
    const czRaw = wellBox ? (wellBox.z0 + wellBox.z1) / 2 : (R.z0 + R.z1) / 2;
    // The spine slides off the well's centre when a MANDATORY room (a
    // bedroom or WC — the rows that flag) needs more depth than its side
    // would get: each side's deepest mandatory least-dimension bounds the
    // corridor, and the spine still has to touch the stair well to
    // connect, so the slide stays within the well's reach.
    const mandatoryDepth = side => Math.max(0, ...S
      .filter(stamp => (stamp.z <= czRaw) === (side === 'low'))
      .map(stamp => {
        const seed = seedFor(stamp.base, minimums);
        return seed.optional ? 0 : seed.minDimensionFt;
      }));
    const loBound = R.z0 + mandatoryDepth('low') + corridorFt / 2;
    const hiBound = R.z1 - mandatoryDepth('high') - corridorFt / 2;
    let cz = loBound <= hiBound ? Math.min(hiBound, Math.max(loBound, czRaw)) : czRaw;
    if (wellBox) {
      cz = Math.min(wellBox.z1 + corridorFt / 2, Math.max(wellBox.z0 - corridorFt / 2, cz));
    }
    cz = Math.min(R.z1 - corridorFt / 2 - 2, Math.max(R.z0 + corridorFt / 2 + 2, cz));
    const corridor = { x0: R.x0, x1: R.x1, z0: cz - corridorFt / 2, z1: cz + corridorFt / 2 };

    // Two bands beside the spine; each stamp claims the band its point
    // sits in, ordered along the axis.
    const bands = [
      { z0: R.z0, z1: corridor.z0, stamps: [] },   // near side
      { z0: corridor.z1, z1: R.z1, stamps: [] },   // far side
    ];
    S.forEach(stamp => {
      const band = stamp.z <= cz ? bands[0] : bands[1];
      band.stamps.push(stamp);
    });
    // A band nobody claimed folds into the rooms as leftover; a band
    // whose depth is unusable pushes its stamps across.
    bands.forEach((band, index) => {
      if (band.z1 - band.z0 < 4 && band.stamps.length) {
        const other = bands[index === 0 ? 1 : 0];
        other.stamps.push(...band.stamps);
        band.stamps = [];
        report.push('one side of the spine is too shallow — rooms moved across');
      }
      band.stamps.sort((a, b) => a.x - b.x);
    });

    const walls = [];
    const rooms = [];
    const addWall = (x0, z0, x1, z1) => {
      if (Math.hypot(x1 - x0, z1 - z0) < 0.25) return;
      walls.push({ start: { x: x0, z: z0 }, end: { x: x1, z: z1 } });
    };
    // Ring x-coordinates are the jog faces slice edges may snap to (#247).
    const jogXs = [...new Set(ring.map(pt => Math.round(pt.x * 96) / 96))];
    const snapX = x => {
      const near = jogXs.find(jx => Math.abs(jx - x) < jogSnapFt - 1e-9 && Math.abs(jx - x) > 1e-9);
      return near != null ? near : x;
    };

    bands.forEach(band => {
      if (!band.stamps.length) return;
      const depth = band.z1 - band.z0;
      // The stair well reserves its slice of this band.
      const reserved = wellBox && wellBox.z0 < band.z1 && wellBox.z1 > band.z0
        ? { x0: wellBox.x0, x1: wellBox.x1 } : null;
      const segments = reserved
        ? [{ x0: R.x0, x1: Math.max(R.x0, reserved.x0) }, { x0: Math.min(R.x1, reserved.x1), x1: R.x1 }]
          .filter(seg => seg.x1 - seg.x0 > 4)
        : [{ x0: R.x0, x1: R.x1 }];
      // Assign stamps to segments by position, then slice each segment.
      const bySeg = segments.map(() => []);
      band.stamps.forEach(stamp => {
        let best = 0, bestD = Infinity;
        segments.forEach((seg, index) => {
          const d = stamp.x < seg.x0 ? seg.x0 - stamp.x : stamp.x > seg.x1 ? stamp.x - seg.x1 : 0;
          if (d < bestD) { bestD = d; best = index; }
        });
        bySeg[best].push(stamp);
      });
      segments.forEach((seg, segIndex) => {
        const pool = bySeg[segIndex];
        if (!pool.length) return;
        // A segment cut short by the stair well needs enclosing walls at
        // the reservation edges — the rooms beside the well close against
        // it instead of spilling into the open slice.
        if (seg.x0 > R.x0 + 0.01) addWall(seg.x0, band.z0, seg.x0, band.z1);
        if (seg.x1 < R.x1 - 0.01) addWall(seg.x1, band.z0, seg.x1, band.z1);
        const length = seg.x1 - seg.x0;
        const needs = pool.map(stamp => {
          const seed = seedFor(stamp.base, minimums);
          return { stamp, seed, needFt: Math.max(seed.minAreaSqFt / depth, seed.minDimensionFt) };
        });
        let total = needs.reduce((sum, need) => sum + need.needFt, 0);
        let widths;
        if (total <= length) {
          // Stretch proportionally to fill the segment — walls shared.
          widths = needs.map(need => need.needFt * (length / total));
        } else {
          // Shrink-optionals-then-flag: optional rooms pin to their row;
          // the mandatory remainder splits what is left and flags below.
          const optionalFt = needs.filter(n => n.seed.optional).reduce((sum, n) => sum + n.needFt, 0);
          const mandatory = needs.filter(n => !n.seed.optional);
          const left = Math.max(0, length - optionalFt);
          const mandTotal = mandatory.reduce((sum, n) => sum + n.needFt, 0) || 1;
          widths = needs.map(n => n.seed.optional ? n.needFt * Math.min(1, length / total)
            : n.needFt * (left / mandTotal));
          report.push('the floor cannot fit every stamp at minimums — smallest rooms pinned, remainder flagged');
        }
        let x = seg.x0;
        needs.forEach((need, index) => {
          let x1 = index === needs.length - 1 ? seg.x1 : snapX(x + widths[index]);
          if (x1 <= x + 1) x1 = x + widths[index];
          const rect = { x0: x, x1, z0: band.z0, z1: band.z1 };
          const insideSqFt = (rect.x1 - rect.x0) * depth;
          const minDim = Math.min(rect.x1 - rect.x0, depth);
          const seed = need.seed;
          const verdict = window.DraftRoomStandards
            ? window.DraftRoomStandards.evaluateRoom({
                category: window.DraftRoomStandards.stampCategory(
                  norm(need.stamp.base) === PRIMARY_BASE ? 'BEDROOM' : need.stamp.base),
                insideSqFt, minDimensionFt: minDim,
              }, minimums)
            : { ok: insideSqFt >= seed.minAreaSqFt && minDim >= seed.minDimensionFt };
          rooms.push({ stampId: need.stamp.id, base: need.stamp.base, rect: unT(rect, flipped),
            insideSqFt, minDimensionFt: minDim, underMin: !verdict.ok });
          // The dividing wall to the next room in the slice.
          if (index < needs.length - 1) addWall(x1, band.z0, x1, band.z1);
          // Companions carve the outer corner of their bedroom's claim.
          C.filter(comp => comp.companionOf === need.stamp.id).forEach(comp => {
            const cSeed = seedFor(comp.base, minimums);
            const w = Math.max(cSeed.minDimensionFt, cSeed.minAreaSqFt / Math.max(4, cSeed.minDimensionFt + 2));
            const d = Math.min(depth - 3, Math.max(cSeed.minDimensionFt, cSeed.minAreaSqFt / w));
            const outerZ = band.z0 === corridor.z1 ? rect.z1 : rect.z0; // away from the spine
            const innerZ = outerZ === rect.z1 ? rect.z1 - d : rect.z0 + d;
            const cx1 = Math.min(rect.x1, rect.x0 + w);
            rooms.push({ stampId: comp.id, base: comp.base,
              rect: unT({ x0: rect.x0, x1: cx1, z0: Math.min(outerZ, innerZ), z1: Math.max(outerZ, innerZ) }, flipped),
              insideSqFt: (cx1 - rect.x0) * d, minDimensionFt: Math.min(cx1 - rect.x0, d),
              underMin: false, companion: true });
            addWall(rect.x0, innerZ, cx1, innerZ);
            addWall(cx1, Math.min(outerZ, innerZ), cx1, Math.max(outerZ, innerZ));
          });
          x = x1;
        });
      });
      // The band's corridor-side wall runs the claimed stretch.
      const wallZ = band.z1 === corridor.z0 ? band.z1 : band.z0;
      addWall(R.x0, wallZ, R.x1, wallZ);
    });

    const unWall = wall => flipped
      ? { start: { x: wall.start.z, z: wall.start.x }, end: { x: wall.end.z, z: wall.end.x } }
      : wall;
    return {
      walls: walls.map(unWall),
      rooms,
      corridor: unT(corridor, flipped),
      report,
    };
  };

  const unT = (rect, flipped) => flipped
    ? { x0: rect.z0, x1: rect.z1, z0: rect.x0, z1: rect.x1 }
    : { ...rect };

  window.DraftRoomGrow = Object.freeze({
    CORRIDOR_FT,
    WALL_FT,
    JOG_SNAP_FT,
    SIZE_SEEDS,
    PRIMARY_BASE,
    HOUSE_WIDE_BASES,
    assignStampNumbers,
    primaryAllowed,
    wcSuffix,
    growRooms,
  });
})();
}
