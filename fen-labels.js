// The office's fenestration NAMING ladder (board #141) — a pure formatter
// plus the COMPANY STANDARDS stock table behind it. Labels are how the
// office reads a plan; the quirks below are deliberate and encoded here so
// nobody has to remember them:
//   G 8x16  garage overhead doors — FEET, HEIGHT x WIDTH (height first)
//   ED36    exterior / man doors  — inches, width only
//   D32     interior swing doors  — inches, width only
//   DD72    double doors          — inches, width only
//   36 X 42 windows               — INCHES, WIDTH X HEIGHT, and NO letter
//
// THE WINDOW LOST ITS LETTER ON 28 SEP. Movie: *"make the windows on the floor
// plans and on the elevations size : \"36 X 42\" width by height in inches"*,
// then *"i want it to match the actual size of the window"* and *"(don't need
// the letter for the window)"*. A door's label is a NAME out of a ladder --
// ED36 is a family and a width -- and a window's is a SIZE, which is what a
// framer measures and orders. The doors keep their ladder; the window reads
// as the dimension it is.
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
      // WIDTH BY HEIGHT, off the opening's own numbers: "match the actual size
      // of the window". Nothing is snapped to the stock ladder here -- a
      // drafter who typed 37 gets 37, and the ladder is what he picks FROM,
      // not what the sheet claims he built.
      return `${roundInches(widthFt)} X ${roundInches(heightFt)}`;
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

  // THE LABEL READ BACK. Movie, 28 Sep: *"i want to change the window tags
  // when you click on them and that will also change the actual window
  // soze"*. The tag became a control, so the format needs a reader as well as
  // a writer -- and it lives HERE, beside `fenLabel`, because a parser
  // anywhere else is a second copy of the format that drifts the day the
  // format moves. It moved once already: the window dropped its letter on the
  // day it was asked for.
  //
  // WHAT IT TAKES: two numbers in INCHES, width first, separated by anything
  // that is not a digit -- `36 X 42`, `36x42`, `36 42`, `36-42`. That is
  // wider than what fenLabel WRITES on purpose: a drafter retyping a tag is
  // not copying a format, and refusing `36x42` for want of spaces would teach
  // nothing except that the box is fussy.
  //
  // WHAT IT REFUSES, by returning null rather than a guess: one number (is a
  // lone 36 a width or a square?), three or more, zero, negative, and
  // anything with no digits at all. A size that cannot be read must not
  // silently become a size that was not typed -- this is a drawing.
  const parseWindowSize = text => {
    const nums = String(text ?? '').match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length !== 2) return null;
    const widthIn = Number(nums[0]), heightIn = Number(nums[1]);
    if (!(widthIn > 0) || !(heightIn > 0)) return null;
    return { widthFt: widthIn / 12, heightFt: heightIn / 12 };
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

  // ── WHERE A SIZE TAG GOES ON A PLAN ──────────────────────────────────────
  //
  // THE FORMAT AND THE PLACEMENT LIVE TOGETHER because two pages draw this
  // tag and they were drawing it differently. MODEL.html rebuilt its plan tag
  // on 28 Sep to Movie's ruling -- *"mark the window on ext side of window
  // paralel with the window"* -- and plan-composition.js, which paints the
  // Construction Layout sheets, kept the placement from before it: horizontal
  // text, the side taken from the glazing's perpendicular (whose sign is
  // whichever way the wall happened to be drawn, so it landed inside the
  // house as often as out), and a tag on every opening including doors.
  //
  // Two placements of one tag is the drift this repo keeps paying for, and
  // the 0.55 ft gap was already written in both files. There is one of each
  // now.
  //
  // GEOMETRY, NOT PAINT. This returns the LINE to run the label along, in
  // world feet; the caller turns it to screen and calls render-2d's
  // labelAlongLine2D with its own ctx. That split is deliberate: ctx and the
  // world-to-screen transform are locals of each page's paint pass, and a
  // helper at this level that reached for them would find nothing -- which is
  // exactly how MODEL's first attempt drew no tag at all and threw nothing.
  const PLAN_TAG_GAP_FT = 0.55;

  // WHICH WAY IS OUT, by the ring's own winding. Lifted from MODEL.html,
  // where it had one caller -- this tag -- so nothing is left behind and no
  // second copy is made. It asks build-house.js for the winding rather than
  // repeating the six lines: that module is the one place that answers
  // "interior is to the left or the right of this ring", and a fourth
  // implementation of that question is how the answers start disagreeing.
  //
  // NULL, NOT A GUESS, for an outline too small to have an inside or a point
  // that is nowhere near it. A tag placed off a guessed normal lands inside
  // the house, which reads as a different window.
  const exteriorNormalAt = (outline, at) => {
    const pts = Array.isArray(outline) ? outline
      : (outline && Array.isArray(outline.points) ? outline.points : null);
    if (!pts || pts.length < 3 || !at || !window.DraftBuildHouse) return null;
    let best = null, bestD = Infinity;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const dx = q.x - p.x, dz = q.z - p.z;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-9) return;
      const t = Math.max(0, Math.min(1,
        ((at.x - p.x) * dx + (at.z - p.z) * dz) / len2));
      const d = Math.hypot(at.x - (p.x + dx * t), at.z - (p.z + dz * t));
      if (d < bestD) { bestD = d; best = { dx, dz, len: Math.sqrt(len2) }; }
    });
    if (!best) return null;
    const ux = best.dx / best.len, uz = best.dz / best.len;
    // Interior to the LEFT of a positively wound ring; out is the other way.
    const inside = window.DraftBuildHouse.outlineInteriorRef(pts) === 'left'
      ? { x: -uz, z: ux } : { x: uz, z: -ux };
    return { x: -inside.x, z: -inside.z };
  };

  // ALONG THE GLASS, which is the line the drafter is reading. The label runs
  // the window's OWN width so it cannot be mistaken for the one next door,
  // and it is stepped off the wall by the assembly's own half thickness --
  // the corners say how far that is, rather than a guess.
  const planTagLine = (geometry, outline, { gapFt = PLAN_TAG_GAP_FT } = {}) => {
    if (!geometry || !geometry.glazing || !geometry.corners || !geometry.center) return null;
    const out = exteriorNormalAt(outline, geometry.center);
    if (!out) return null;
    const [ga, gb] = geometry.glazing;
    const run = Math.hypot(gb.x - ga.x, gb.z - ga.z) || 1;
    const ux = (gb.x - ga.x) / run, uz = (gb.z - ga.z) / run;
    const half = Math.max(...geometry.corners.map(corner =>
      Math.abs((corner.x - geometry.center.x) * out.x
        + (corner.z - geometry.center.z) * out.z)));
    const gap = half + gapFt;
    const cx = geometry.center.x + out.x * gap;
    const cz = geometry.center.z + out.z * gap;
    return {
      a: { x: cx - ux * run / 2, z: cz - uz * run / 2 },
      b: { x: cx + ux * run / 2, z: cz + uz * run / 2 },
    };
  };

  window.DraftFenLabels = Object.freeze({
    fenLabel,
    fenLabelForOpening,
    parseWindowSize,
    DEFAULT_FEN_STANDARDS,
    stockListFromText,
    normaliseFenStandards,
    PLAN_TAG_GAP_FT,
    exteriorNormalAt,
    planTagLine,
  });
})();
}
