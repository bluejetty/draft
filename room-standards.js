// Preferred room MINIMUM sizes — the office's numbers, seeded from the
// minimums the code already applies plus stated residential-style defaults.
// Pure data + evaluator: no component state, no store. The table is OFFICE
// PREFERENCE, not a code engine; flags are feedback the drafter can ignore.
if (!window.DraftRoomStandards) {
(() => {
  // Seeds, each with its source:
  // - kitchen: KITCHEN_MIN_LONG_FT (8) x KITCHEN_MIN_SHORT_FT (5) — the
  //   code's own auto-kitchen envelope → 40 sq ft, least dimension 5'.
  // - wc: office default — a 3' clear width (the code's landing-style
  //   clearance thinking) and 18 sq ft floor.
  // - bedroom: NBC-style habitable-room default — ~97 sq ft with a 9'-8"
  //   least dimension.
  // - living: office default (stored for AUTO-FURNISH #135; the detector
  //   has no LIVING category yet, so no flag rides on it — see evaluateRoom).
  // - laundry: office default — a washer+dryer pair wants ~4'-6" clear.
  // ROOM_TAG_MIN_AREA_SQFT (12) stays the detector's own floor and is not
  // part of this table.
  const DEFAULT_ROOM_MINIMUMS = Object.freeze({
    bedroom: Object.freeze({ label: 'BEDROOM', minAreaSqFt: 97, minDimensionFt: 9 + 8 / 12 }),
    kitchen: Object.freeze({ label: 'KITCHEN', minAreaSqFt: 40, minDimensionFt: 5 }),
    living: Object.freeze({ label: 'LIVING ROOM', minAreaSqFt: 145, minDimensionFt: 10 }),
    wc: Object.freeze({ label: 'WC / BATH', minAreaSqFt: 18, minDimensionFt: 3 }),
    laundry: Object.freeze({ label: 'LAUNDRY', minAreaSqFt: 15, minDimensionFt: 4.5 }),
  });

  const positive = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const normaliseRoomMinimums = value => {
    const stored = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(Object.entries(DEFAULT_ROOM_MINIMUMS).map(([id, fallback]) => {
      const entry = stored[id] && typeof stored[id] === 'object' ? stored[id] : {};
      return [id, {
        label: fallback.label,
        minAreaSqFt: positive(entry.minAreaSqFt, fallback.minAreaSqFt),
        minDimensionFt: positive(entry.minDimensionFt, fallback.minDimensionFt),
      }];
    }));
  };

  // Verdict for one detected room. Categories without a table row (the
  // generic 'room' — the detector cannot tell a living room from a hall)
  // always pass: a flag must never fire on a guess.
  const evaluateRoom = ({ category, insideSqFt, minDimensionFt }, minimums) => {
    const table = minimums || DEFAULT_ROOM_MINIMUMS;
    const row = table[category];
    if (!row) return { ok: true, failures: [] };
    const failures = [];
    if (Number.isFinite(insideSqFt) && insideSqFt < row.minAreaSqFt) {
      failures.push({ rule: 'area', min: row.minAreaSqFt, actual: insideSqFt });
    }
    if (Number.isFinite(minDimensionFt) && minDimensionFt < row.minDimensionFt) {
      failures.push({ rule: 'dimension', min: row.minDimensionFt, actual: minDimensionFt });
    }
    return { ok: failures.length === 0, failures };
  };

  window.DraftRoomStandards = Object.freeze({
    DEFAULT_ROOM_MINIMUMS,
    normaliseRoomMinimums,
    evaluateRoom,
  });
})();
}
