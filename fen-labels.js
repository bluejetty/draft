// The office's fenestration NAMING ladder (board #141) — a pure formatter
// plus the COMPANY STANDARDS stock table behind it. Labels are how the
// office reads a plan; the quirks below are deliberate and encoded here so
// nobody has to remember them:
//   G 8x16  garage overhead doors — FEET, HEIGHT x WIDTH (height first)
//   ED36    exterior / man doors  — inches, width only
//   D32     interior swing doors  — inches, width only
//   DD72    double doors          — inches, width only
//   W 24x36 windows               — INCHES, WIDTH x HEIGHT
// Plain data in, label out: no state, no DOM. Future schedules and
// auto-fenestration (#169) pick from the stock ladder; this slice only
// stores and displays it.
if (!window.DraftFenLabels) {
(() => {
  const roundInches = ft => Math.round(ft * 12);
  // Garage doors read in feet; quarter-foot grid keeps 8.5 honest and 8 clean.
  const trimFeet = ft => String(Math.round(ft * 4) / 4);

  const fenLabel = ({ type, widthFt, heightFt, exterior, double: isDouble, garage }) => {
    if (!Number.isFinite(widthFt) || widthFt <= 0) return '';
    if (type === 'window') {
      if (!Number.isFinite(heightFt) || heightFt <= 0) return '';
      return `W ${roundInches(widthFt)}x${roundInches(heightFt)}`;
    }
    if (type !== 'door') return '';
    if (garage) {
      if (!Number.isFinite(heightFt) || heightFt <= 0) return '';
      return `G ${trimFeet(heightFt)}x${trimFeet(widthFt)}`;
    }
    // A double IS a double wherever it hangs, so DD outranks ED — a 4'
    // patio pair reads DD48, not ED48.
    if (isDouble) return `DD${roundInches(widthFt)}`;
    if (exterior) return `ED${roundInches(widthFt)}`;
    return `D${roundInches(widthFt)}`;
  };

  // Classification the plan can derive without asking anyone: garage from
  // the BUILD HOUSE flag (or an exterior door too wide for any man door —
  // no single leaf reaches 8'), double from a 4'+ width, exterior from the
  // host wall riding the house outline (the codebase's own exterior test —
  // loose walls with no closed outline read interior, which fails to the
  // plain D label, never to a wrong claim).
  const fenLabelForOpening = (opening, { exteriorWall } = {}) => {
    if (!opening) return '';
    const widthFt = opening.width;
    const heightFt = opening.type === 'window'
      ? (opening.headHeight ?? 0) - (opening.sillHeight ?? 0)
      : opening.headHeight;
    const garage = opening.garage === true
      || (exteriorWall === true && opening.type === 'door' && widthFt >= 8);
    return fenLabel({
      type: opening.type,
      widthFt,
      heightFt,
      exterior: exteriorWall === true,
      double: widthFt >= 4,
      garage,
    });
  };

  // The preferred stock ladder — which sizes the office actually orders.
  // Door families are widths in inches; garage and window entries are the
  // label bodies themselves (HxW feet / WxH inches). Seeds are the boss's
  // stated ladder; D carries the closet run (D36–D18) since it is one
  // family. showLabels defaults OFF so no current drawing changes until
  // the office opts in.
  const DEFAULT_FEN_STANDARDS = Object.freeze({
    showLabels: false,
    stock: Object.freeze({
      garage: Object.freeze(['8x16', '8x9']),
      ed: Object.freeze(['36', '32']),
      d: Object.freeze(['36', '32', '30', '24', '18']),
      dd: Object.freeze(['72', '60', '48']),
      w: Object.freeze(['24x36']),
    }),
  });

  const stockListFromText = text => String(text ?? '')
    .split(',').map(entry => entry.trim()).filter(Boolean);

  const normaliseFenStandards = value => {
    const stored = value && typeof value === 'object' ? value : {};
    const storedStock = stored.stock && typeof stored.stock === 'object' ? stored.stock : {};
    return {
      showLabels: stored.showLabels === true,
      stock: Object.fromEntries(Object.entries(DEFAULT_FEN_STANDARDS.stock).map(([family, fallback]) => {
        const list = Array.isArray(storedStock[family])
          ? storedStock[family].map(entry => String(entry).trim()).filter(Boolean)
          : null;
        return [family, list && list.length ? list : [...fallback]];
      })),
    };
  };

  window.DraftFenLabels = Object.freeze({
    fenLabel,
    fenLabelForOpening,
    DEFAULT_FEN_STANDARDS,
    stockListFromText,
    normaliseFenStandards,
  });
})();
}
