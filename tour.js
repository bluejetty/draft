// The guided tour's pure rules (board #230/#238) — plain data in, verdicts
// and geometry out: no state, no DOM, no THREE. Slice 5 started the module
// with the roof step's math (gable anchors, snapping, splitting, the
// wall-lengthens number, the finale's reveal easing); slice 3 adds the
// MOVE FLOOR pull ladder and graduates the stacked-stair snap zone here.
// Everything below was validated offline before wiring.
if (!window.DraftTour) {
(() => {
  // ── MOVE FLOOR: the pull ladder (slice 3, the drafter's exact numbers) ──
  // How far a floor corner may pull past the supporting wall/footing below,
  // and where the pile stubs land as it goes:
  //   0 → 2'        pure cantilever — no pile (2' is the office's hard cap)
  //   2' → 4'-6"    FORBIDDEN — the drag snaps across to the nearest side
  //                 (3' is both an illegal cantilever and a bad pile spot)
  //   4'-6" → 8'    one pile riding directly under the pulled corner
  //   8' → 10'      the pile parks at 8'; the corner cantilevers ≤2' past it
  //   10' → 18'     two piles: the outer rides the corner (parking at 16'),
  //                 the inner always splits the footing→outer run evenly, so
  //                 every span stays ≤8' and the final cantilever stays ≤2'
  //   18'           the ceiling — the pull refuses to go further.
  // The same 2' cap deliberately appears twice: off the footing at the
  // bottom of the ladder, and off the outermost pile at the top of each
  // pile stage. Pile distances are measured from the support toward the
  // pulled corner.
  const FLOOR_PULL_MAX_FT = 18;
  const FLOOR_CANTILEVER_FT = 2;
  const FLOOR_FIRST_PILE_FT = 4.5;
  const FLOOR_ONE_PILE_PARK_FT = 8;
  const FLOOR_TWO_PILE_PARK_FT = 16;
  const floorPullLadder = requestedFt => {
    let d = Math.max(0, Math.min(FLOOR_PULL_MAX_FT, requestedFt));
    if (d > FLOOR_CANTILEVER_FT && d < FLOOR_FIRST_PILE_FT) {
      d = d - FLOOR_CANTILEVER_FT < FLOOR_FIRST_PILE_FT - d
        ? FLOOR_CANTILEVER_FT : FLOOR_FIRST_PILE_FT;
    }
    if (d <= FLOOR_CANTILEVER_FT) return { d, piles: [] };
    if (d <= FLOOR_ONE_PILE_PARK_FT) return { d, piles: [d] };
    if (d <= FLOOR_ONE_PILE_PARK_FT + FLOOR_CANTILEVER_FT) {
      return { d, piles: [FLOOR_ONE_PILE_PARK_FT] };
    }
    const outer = Math.min(d, FLOOR_TWO_PILE_PARK_FT);
    return { d, piles: [outer / 2, outer] };
  };

  // Stacked stairs (slice 2, graduated here): on the 2ND FLOOR the top
  // nosing snaps into the run-below's landing zone — the run's rectangle
  // plus a 1' margin. Inside the zone the point stands (snapped:false);
  // within snapFt of it, the point snaps to the zone edge; farther away
  // the click is refused (null). Stairs are plain {start:{x,z}, end:{x,z},
  // widthFt} runs.
  const stairSnapZone = (pt, stairs, marginFt = 1, snapFt = 6) => {
    if (!Array.isArray(stairs) || !stairs.length) return { x: pt.x, z: pt.z, snapped: false };
    let best = null;
    stairs.forEach(stair => {
      const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len, uz = dz / len;
      const half = (stair.widthFt || 3) / 2 + marginFt;
      const relX = pt.x - stair.start.x, relZ = pt.z - stair.start.z;
      const along = Math.max(0, Math.min(len, relX * ux + relZ * uz));
      const across = Math.max(-half, Math.min(half, -relX * uz + relZ * ux));
      const zx = stair.start.x + ux * along - uz * across;
      const zz = stair.start.z + uz * along + ux * across;
      const dist = Math.hypot(pt.x - zx, pt.z - zz);
      if (!best || dist < best.dist) best = { x: zx, z: zz, dist };
    });
    if (best.dist < 0.05) return { x: pt.x, z: pt.z, snapped: false }; // already inside
    if (best.dist <= snapFt) return { x: best.x, z: best.z, snapped: true };
    return null;
  };

  // Anchors along one wall edge (a → b), harvested from what the floors
  // below put under it: opening centers (W/D), exterior-run midpoints
  // (WALL), adjacent column-pair midpoints (COL). Candidates are projected
  // onto the edge; only projections landing within the run become anchors.
  // Labels read kind + floor: "W 1" is a main-floor window, "D 2" a
  // second-floor door.
  const gableAnchors = (a, b, candidates, marginFt = 0.25) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    return candidates.map(candidate => {
      const t = (candidate.x - a.x) * ux + (candidate.z - a.z) * uz;
      if (t < marginFt || t > len - marginFt) return null;
      return { t, kind: candidate.kind, floor: candidate.floor, widthFt: candidate.widthFt || null };
    }).filter(Boolean).sort((p, q) => p.t - q.t);
  };

  // Free placement snaps to the increment counted FROM THE BUILDING CORNER
  // (the edge's start — the number a drafter would dimension); an anchor
  // within snapRadius wins over the grid.
  const snapAlongEdge = (tFt, edgeLenFt, incrementFt, anchors, snapRadiusFt = 0.75) => {
    let best = null;
    (anchors || []).forEach(anchor => {
      const d = Math.abs(anchor.t - tFt);
      if (d <= snapRadiusFt && (!best || d < Math.abs(best.t - tFt))) best = anchor;
    });
    if (best) return { t: best.t, anchor: best };
    const snapped = Math.round(tFt / incrementFt) * incrementFt;
    return { t: Math.min(Math.max(snapped, 0), edgeLenFt), anchor: null };
  };

  // The gable segment on the wall edge: centered at centerFt, widthFt wide,
  // clamped so both flanks keep at least minFlankFt of eave.
  const gableSplit = (edgeLenFt, centerFt, widthFt, minFlankFt = 1) => {
    const half = widthFt / 2;
    const from = Math.max(minFlankFt,
      Math.min(centerFt - half, edgeLenFt - minFlankFt - widthFt));
    return { fromFt: from, toFt: from + widthFt };
  };

  // "Wall lengthens X at the peak": the gable face's triangle rise.
  const gablePeakRiseFt = (widthFt, pitch) => (widthFt / 2) * (pitch / 12);

  // The finale's rising reveal — one eased clip height, shared by the 2D
  // mask today and the 3D clip plane later (same choreography, same
  // timing). easeInOutCubic.
  const revealClipY = (elapsedMs, durationMs, y0, y1) => {
    const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return y0 + (y1 - y0) * eased;
  };
  const REVEAL_MS = 2500;
  // The held beat before the reveal starts climbing: the rails have just
  // slid open, the audience settles, THEN the house grows.
  const REVEAL_HOLD_MS = 1000;

  // ── Room stamps (board #198, slice 4; numbering reworked under #276) ────
  // A stamp: { id, levelId, base, name } — base is the tray chip it came
  // from; a renamed stamp has base:null and its custom name is forever.
  // Numbering is DERIVED from placement order (id order), so deleting a
  // stamp renumbers the rest with no stored counter. BEDROOM and WC run
  // house-wide ladders (room-grow.js owns those, plus the BEDROOM 1
  // primary and the basement B-series); every other base stays per-floor,
  // bare until a second lands.
  const HOUSE_WIDE = ['BEDROOM', 'WC', 'BEDROOM 1'];
  const stampDisplayName = (stamps, stamp) => {
    if (!stamp.base) return stamp.name; // renamed — custom forever
    if (HOUSE_WIDE.includes(stamp.base) && window.DraftRoomGrow) {
      const name = window.DraftRoomGrow.assignStampNumbers(stamps).get(stamp.id);
      if (name) return name;
    }
    const pool = stamps
      .filter(other => other.base === stamp.base && other.levelId === stamp.levelId)
      .sort((a, b) => a.id - b.id);
    if (pool.length === 1) return stamp.base;
    return `${stamp.base} ${pool.indexOf(stamp) + 1}`;
  };

  // Companion bases to drop when a tray-stamped bedroom lands (#276): the
  // PRIMARY SUITE — the one BEDROOM 1 — brings its ENSUITE + WALK-IN;
  // every ordinary bedroom brings a CLOSET, first-of-its-floor or not.
  const bedroomCompanions = base =>
    base === 'BEDROOM 1' ? ['ENSUITE', 'WALK-IN']
      : base === 'BEDROOM' ? ['CLOSET'] : [];

  // Where the detector starts numbering a base (1-based), so a stamped
  // room and a detected room can never share a name. BEDROOM and WC
  // ladders run house-wide above grade under #276 (the basement keeps its
  // own B ladder), counting claimed numbers too; other bases stay
  // per-floor. Detected tags themselves keep their provisional per-run
  // names — the primary-suite rule governs STAMPS only.
  const detectorNumberStart = (stamps, base, levelId, basementLevelId = 1) => {
    const houseWide = ['BEDROOM', 'WC'].includes(base);
    const basement = levelId === basementLevelId;
    if (houseWide && window.DraftRoomGrow) {
      // Read the numbers the stamps ACTUALLY carry (the primary's 1, the
      // ordinary ladder from 2, claims, the basement B-series) and start
      // one past the highest — counting stamps would collide now that the
      // ordinary bedroom ladder starts at 2.
      const names = window.DraftRoomGrow.assignStampNumbers(stamps, { basementLevelId });
      const pattern = new RegExp(`^${base} ${basement ? 'B' : ''}(\\d+)$`);
      let highest = 0;
      stamps.forEach(stamp => {
        const match = (names.get(stamp.id) || '').match(pattern);
        if (match) highest = Math.max(highest, Number(match[1]));
      });
      return highest + 1;
    }
    return stamps.filter(stamp => stamp.base === base && stamp.levelId === levelId).length + 1;
  };

  // Free-placement increments (office standard, personal SETTINGS): the
  // resting grid plus the two momentary modifier grids, all in inches.
  const normaliseTourRoofIncrements = value => {
    const positive = (input, fallback) => {
      const n = Number(input);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    const stored = value && typeof value === 'object' ? value : {};
    return {
      baseIn: positive(stored.baseIn, 12),
      shiftIn: positive(stored.shiftIn, 6),
      ctrlShiftIn: positive(stored.ctrlShiftIn, 3),
    };
  };

  window.DraftTour = Object.freeze({
    floorPullLadder,
    FLOOR_PULL_MAX_FT,
    FLOOR_CANTILEVER_FT,
    stairSnapZone,
    stampDisplayName,
    bedroomCompanions,
    detectorNumberStart,
    normaliseTourRoofIncrements,
    gableAnchors,
    snapAlongEdge,
    gableSplit,
    gablePeakRiseFt,
    revealClipY,
    REVEAL_MS,
    REVEAL_HOLD_MS,
  });
})();
}
