// ROOM NUMBERS (board #276) — the naming rules a stamped room tag answers to:
// the house-wide BEDROOM and WC ladders, the one primary suite, and the WC
// fixture suffix. Pure, no DOM.
//
// WHAT IS LEFT OF room-grow.js (1 Oct). That module also GREW rooms -- turned
// a stamp program into partition walls -- and the drafter ruled it out twice:
// 9 Sep, "SKIP the room part ... didn't work good", and 1 Oct, "lets remove
// it i don't need it, didn't work". The bone had not grown a room since the
// first ruling. These three rules were never part of the growing: the tour
// and the stamp tags name rooms with them whether anything grows or not, so
// they moved here whole, and the grower went.
if (!window.DraftRoomNumbers) {
(() => {
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

  window.DraftRoomNumbers = Object.freeze({
    PRIMARY_BASE,
    HOUSE_WIDE_BASES,
    assignStampNumbers,
    primaryAllowed,
    wcSuffix,
  });
})();
}
