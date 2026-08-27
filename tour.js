// The guided tour's pure rules (board #230/#238) — plain data in, verdicts
// and geometry out: no state, no DOM, no THREE. Slice 5 starts the module
// with the roof step's math (gable anchors, snapping, splitting, the
// wall-lengthens number, the finale's reveal easing); the earlier slices'
// rules graduate here as they're touched. Everything below was validated
// offline before wiring.
if (!window.DraftTour) {
(() => {
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
    normaliseTourRoofIncrements,
    gableAnchors,
    snapAlongEdge,
    gableSplit,
    gablePeakRiseFt,
    revealClipY,
    REVEAL_MS,
  });
})();
}
