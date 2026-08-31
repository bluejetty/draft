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
        // A number belongs to ONE tag per series: the earliest claimant
        // (stamp order) keeps it, later claimants of the same number fall
        // back onto the ladder like unclaimed tags.
        const honored = new Map();
        const claimed = new Set();
        pool.forEach(tag => {
          if (Number.isInteger(tag.claimedNo) && tag.claimedNo > 0 && !claimed.has(tag.claimedNo)) {
            honored.set(tag.id, tag.claimedNo);
            claimed.add(tag.claimedNo);
          }
        });
        // The ordinary BEDROOM ladder starts at 2 above grade — number 1
        // belongs to the primary suite. Basement ladders and WC start at 1.
        let next = !basement && base === 'BEDROOM' ? 2 : 1;
        const prefix = basement ? 'B' : '';
        pool.forEach(tag => {
          let n;
          if (honored.has(tag.id)) {
            n = honored.get(tag.id);
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

  // ── Ring-aware stretches (board #290) ────────────────────────────────
  // The partition used to slice the ring's BOUNDING BOX, so an L / T / U
  // footprint grew claims and walls into the notch — outside the
  // building. Every stretch a band, the corridor, or a wall may use is
  // now an interval of the ring itself.
  const EPS = 1e-6;
  // Geometric "same place" for band edges: a ring face and a band limit
  // that agree to within a thousandth of an inch are the same line, and
  // must compare equal or a stretch splits where nothing splits it.
  const NEAR = 1e-4;
  const QUANT = 4096;                 // ring x-coordinates land on this grid

  // The z-spans the ring covers on the vertical line at x. Only ever
  // called strictly between two ring x-coordinates, where a rectilinear
  // outline's vertical structure is constant, so the spans are exact.
  const ringSpansAt = (ring, x) => {
    const zs = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if ((a.x > x) === (b.x > x)) continue;
      zs.push(a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x));
    }
    zs.sort((p, q) => p - q);
    const spans = [];
    for (let i = 0; i + 1 < zs.length; i += 2) spans.push([zs[i], zs[i + 1]]);
    return spans;
  };

  // The stretches of [z0, z1] that lie INSIDE the ring, as rectangles.
  // Each gap between consecutive ring x-coordinates contributes the part
  // of the band the ring actually covers there (a leg keeps its own
  // shallower depth instead of being dropped); neighbours with the same
  // usable depth merge into one interval. Anything shallower than
  // minDepth is not a room stretch and is left out.
  const bandIntervals = (ring, z0, z1, minDepth) => {
    const xs = [...new Set(ring.map(pt => Math.round(pt.x * QUANT) / QUANT))]
      .sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      const xa = xs[i], xb = xs[i + 1];
      if (xb - xa < EPS) continue;
      ringSpansAt(ring, (xa + xb) / 2).forEach(([sa, sb]) => {
        let lo = Math.max(sa, z0), hi = Math.min(sb, z1);
        // A stretch clipped by the ring and one clipped by the band edge
        // sit on the same line: hold them to the band limit so they merge.
        if (Math.abs(lo - z0) <= NEAR) lo = z0;
        if (Math.abs(hi - z1) <= NEAR) hi = z1;
        if (hi - lo < minDepth) return;
        const run = out.find(iv => Math.abs(iv.x1 - xa) < NEAR
          && Math.abs(iv.z0 - lo) < NEAR && Math.abs(iv.z1 - hi) < NEAR);
        if (run) run.x1 = xb;
        else out.push({ x0: xa, x1: xb, z0: lo, z1: hi });
      });
    }
    return out;
  };

  const overlaps = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;

  // The stretches of the horizontal line at z, between x0 and x1, that run
  // through the INSIDE of the ring. A wall lying on the ring's own face is
  // the exterior wall — it is already built, and drawing over it would put
  // a second wall on the boundary.
  const interiorRuns = (ring, z, x0, x1) => {
    const xs = [...new Set([x0, x1, ...ring.map(pt => Math.round(pt.x * QUANT) / QUANT)])]
      .filter(x => x >= x0 - EPS && x <= x1 + EPS)
      .sort((a, b) => a - b);
    const runs = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      const xa = xs[i], xb = xs[i + 1];
      if (xb - xa < EPS) continue;
      const inside = ringSpansAt(ring, (xa + xb) / 2)
        .some(([sa, sb]) => sa + NEAR < z && z < sb - NEAR);
      if (!inside) continue;
      const last = runs[runs.length - 1];
      if (last && Math.abs(last[1] - xa) < NEAR) last[1] = xb;
      else runs.push([xa, xb]);
    }
    return runs;
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
      return { walls: [], rooms: [], corridor: null, corridorSpans: [], report: ['no region'] };
    }
    const roomStamps = stamps.filter(stamp => stamp.companionOf == null);
    const companions = stamps.filter(stamp => stamp.companionOf != null);
    if (!roomStamps.length) {
      return { walls: [], rooms: [], corridor: null, corridorSpans: [], report: ['no stamps'] };
    }
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
    const corridorZ0 = cz - corridorFt / 2;
    const corridorZ1 = cz + corridorFt / 2;
    // The spine runs only where the ring gives it its full width — on an
    // L the hall stops at the notch instead of sailing through it, and on
    // a U it comes back in pieces (reported, not silently joined).
    const corridorSpans = bandIntervals(ring, corridorZ0, corridorZ1, corridorFt - EPS);
    if (!corridorSpans.length) {
      return { walls: [], rooms: [], corridor: null, corridorSpans: [],
        report: ['no stretch of this floor fits the corridor — nothing grown'] };
    }
    if (corridorSpans.length > 1) {
      report.push('the corridor comes in pieces — this footprint has legs the spine cannot join');
    }
    // The named corridor is the piece the stair well opens onto (the one
    // the house is entered through), else the longest.
    const wellX = wellBox ? (wellBox.x0 + wellBox.x1) / 2 : null;
    const corridor = (wellX != null
      && corridorSpans.find(span => span.x0 - EPS <= wellX && wellX <= span.x1 + EPS))
      || corridorSpans.reduce((best, span) =>
        (span.x1 - span.x0 > best.x1 - best.x0 ? span : best), corridorSpans[0]);

    // Two bands beside the spine; each stamp claims the band its point
    // sits in, ordered along the axis. A band is only ever the stretches
    // of the ring beside the spine — never the bounding box (board #290).
    const MIN_STRETCH_FT = 4;
    const bands = [
      { z0: R.z0, z1: corridorZ0, far: false, stamps: [] },   // near side
      { z0: corridorZ1, z1: R.z1, far: true, stamps: [] },    // far side
    ];
    S.forEach(stamp => {
      const band = stamp.z <= cz ? bands[0] : bands[1];
      band.stamps.push(stamp);
    });
    bands.forEach(band => {
      band.intervals = bandIntervals(ring, band.z0, band.z1, MIN_STRETCH_FT);
    });
    // A band nobody claimed folds into the rooms as leftover; a band
    // whose depth is unusable — or which the ring gives no stretch at
    // all — pushes its stamps across.
    bands.forEach((band, index) => {
      const other = bands[index === 0 ? 1 : 0];
      const shallow = band.z1 - band.z0 < MIN_STRETCH_FT;
      if ((shallow || !band.intervals.length) && band.stamps.length && other.intervals.length) {
        other.stamps.push(...band.stamps);
        band.stamps = [];
        report.push(shallow
          ? 'one side of the spine is too shallow — rooms moved across'
          : 'one side of the spine has no room stretch on this footprint — rooms moved across');
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
    let strayStamp = false;
    let unreached = false;

    bands.forEach(band => {
      if (!band.stamps.length || !band.intervals.length) return;
      const intervals = band.intervals;
      // Each stamp joins the ring stretch it stands in; a stamp standing
      // where no band stretch reaches (the shallow tip of a leg) packs
      // into the nearest one and says so.
      const byInterval = intervals.map(() => []);
      band.stamps.forEach(stamp => {
        let best = 0, bestD = Infinity;
        intervals.forEach((iv, index) => {
          const dx = stamp.x < iv.x0 ? iv.x0 - stamp.x : stamp.x > iv.x1 ? stamp.x - iv.x1 : 0;
          const dz = stamp.z < iv.z0 ? iv.z0 - stamp.z : stamp.z > iv.z1 ? stamp.z - iv.z1 : 0;
          const d = Math.hypot(dx, dz);
          if (d < bestD - EPS) { bestD = d; best = index; }
        });
        if (bestD > EPS) strayStamp = true;
        byInterval[best].push(stamp);
      });

      intervals.forEach((interval, ivIndex) => {
        const pool = byInterval[ivIndex];
        if (!pool.length) return;
        const depth = interval.z1 - interval.z0;
        // Where the ring cut this stretch short (the far side of a leg)
        // its corridor-side face is an exterior wall, not the spine.
        const spineZ = band.far ? corridorZ1 : corridorZ0;
        const touchesSpine = Math.abs((band.far ? interval.z0 : interval.z1) - spineZ) < NEAR;
        // The stair well reserves its slice of this stretch. A segment
        // edge that came from the well needs an enclosing wall; an edge
        // that came from the ring already HAS one — the exterior wall.
        const reserved = wellBox && wellBox.z0 < interval.z1 && wellBox.z1 > interval.z0
          && wellBox.x1 > interval.x0 && wellBox.x0 < interval.x1
          ? { x0: wellBox.x0, x1: wellBox.x1 } : null;
        const segments = (reserved
          ? [
            { x0: interval.x0, x1: Math.max(interval.x0, Math.min(interval.x1, reserved.x0)),
              wellEnd: true },
            { x0: Math.min(interval.x1, Math.max(interval.x0, reserved.x1)), x1: interval.x1,
              wellStart: true },
          ]
          : [{ x0: interval.x0, x1: interval.x1 }])
          .filter(seg => seg.x1 - seg.x0 > MIN_STRETCH_FT);
        if (!segments.length) {
          report.push('the stair well leaves no room stretch beside it here');
          return;
        }
        // Assign stamps to segments by position, then slice each segment.
        const bySeg = segments.map(() => []);
        pool.forEach(stamp => {
          let best = 0, bestD = Infinity;
          segments.forEach((seg, index) => {
            const d = stamp.x < seg.x0 ? seg.x0 - stamp.x : stamp.x > seg.x1 ? stamp.x - seg.x1 : 0;
            if (d < bestD) { bestD = d; best = index; }
          });
          bySeg[best].push(stamp);
        });
        let grewHere = false;
        segments.forEach((seg, segIndex) => {
          const slice = bySeg[segIndex];
          if (!slice.length) return;
          grewHere = true;
          // A segment cut short by the stair well needs enclosing walls at
          // the reservation edges — the rooms beside the well close against
          // it instead of spilling into the open slice. A segment edge that
          // is the ring's own face needs nothing: the exterior wall stands
          // there already.
          if (seg.wellStart) addWall(seg.x0, interval.z0, seg.x0, interval.z1);
          if (seg.wellEnd) addWall(seg.x1, interval.z0, seg.x1, interval.z1);
          const length = seg.x1 - seg.x0;
          const needs = slice.map(stamp => {
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
            x1 = Math.min(x1, seg.x1);
            const rect = { x0: x, x1, z0: interval.z0, z1: interval.z1 };
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
            // A room only opens onto the hall where the spine actually
            // runs past it; in a leg the spine cannot enter, it does not.
            if (!touchesSpine || !corridorSpans.some(span =>
              overlaps(span.x0, span.x1, rect.x0, rect.x1))) unreached = true;
            // The dividing wall to the next room in the slice.
            if (index < needs.length - 1) addWall(x1, interval.z0, x1, interval.z1);
            // Companions carve the outer corner of their bedroom's claim.
            C.filter(comp => comp.companionOf === need.stamp.id).forEach(comp => {
              const cSeed = seedFor(comp.base, minimums);
              const w = Math.max(cSeed.minDimensionFt, cSeed.minAreaSqFt / Math.max(4, cSeed.minDimensionFt + 2));
              const d = Math.min(depth - 3, Math.max(cSeed.minDimensionFt, cSeed.minAreaSqFt / w));
              const outerZ = band.far ? rect.z1 : rect.z0;   // away from the spine
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
        if (!grewHere) return;
        // The stretch's corridor-side wall — only where the stretch
        // actually meets the spine. Where the ring cut the band short
        // (the far side of a leg) that face is an exterior wall already.
        if (touchesSpine) {
          const wallZ = band.far ? interval.z0 : interval.z1;
          interiorRuns(ring, wallZ, interval.x0, interval.x1)
            .forEach(([xa, xb]) => addWall(xa, wallZ, xb, wallZ));
        }
      });
    });
    if (strayStamp) {
      report.push('a stamp stands where no band stretch reaches — its room packed into the nearest stretch');
    }
    if (unreached) {
      report.push('a room grew in a leg the corridor does not reach — hall it by hand');
    }
    // Nothing leaves silently: a stamp the partition could not seat is
    // named in the report, not simply absent from the claims.
    const seated = new Set(rooms.map(room => room.stampId));
    const unseated = S.filter(stamp => !seated.has(stamp.id)).length;
    if (unseated) {
      report.push(`this floor is too tight to grow every stamp — ${unseated} `
        + `${unseated === 1 ? 'stamp has' : 'stamps have'} no room`);
    }

    const unWall = wall => flipped
      ? { start: { x: wall.start.z, z: wall.start.x }, end: { x: wall.end.z, z: wall.end.x } }
      : wall;
    return {
      walls: walls.map(unWall),
      rooms,
      // corridor stays the one named spine (the piece the stair opens
      // onto); corridorSpans is every stretch of hall the footprint got.
      corridor: unT(corridor, flipped),
      corridorSpans: corridorSpans.map(span => unT(span, flipped)),
      // One line per distinct problem: a stretch that flags twice is not
      // two problems.
      report: [...new Set(report)],
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
