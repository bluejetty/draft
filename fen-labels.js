// The office's fenestration NAMING ladder (board #141) — a pure formatter
// plus the COMPANY STANDARDS stock table behind it. Labels are how the
// office reads a plan; the quirks below are deliberate and encoded here so
// nobody has to remember them:
//   G 16W x 8H  garage overhead doors — FEET, WIDTH then HEIGHT, marked W/H
//   D36         every other door      — inches, width only
//   W 36 X 42   windows               — INCHES, WIDTH X HEIGHT
//
// THREE LETTERS, FOR ESTIMATING (Movie, 1 Oct): "for later ESTIMATION
// purposes we should put the W before the window sizes ... for doors i think
// it should go like : G - GARAGE DOOR, D - EXT, INT or Double ... all those
// can be D, don't need to distinguish them ... and then W for window". And
// the garage reads the way he marks one -- "Garage 16W X 8H", "use the W and
// the H" -- with the letters on the garage ALONE, since "garage is only one in
// FT". ED and DD are gone: an exterior door and a pair are D like any other.
//
// THE WINDOW LOST ITS LETTER ON 28 SEP AND GOT IT BACK ON 1 OCT, for the
// estimate: a takeoff counts W's, D's and G's.
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

  // ── AND THE SAME TAGS IN MILLIMETRES ────────────────────────────────────
  //
  // Movie, 1 Oct: *"is it possible to adjust the window and door / fixture
  // dimensions to metric / back to imperial?"*, *"when the METRIC button
  // hit"*, *"make text smaller if necessary and yes rounding you decide"*,
  // and for the garage *"put the mm number 4880 2440"*.
  //
  // ALL OF IT IN MILLIMETRES, the garage too -- metric has no feet to keep
  // the garage apart, so the W and the H are what still say which is which.
  // A WINDOW OR DOOR TO THE NEAREST 5 MM (36" is 914.4, written 915), the
  // grain a metric window schedule is ordered in. A GARAGE DOOR TO THE
  // NEAREST 10, which is his 4880 x 2440 for a 16 x 8 -- to the 5 it would
  // read 4875. The letters do not change: a takeoff still counts W, D and G.
  //
  // `units` is the drawing's own field: 'metric' is metric, and anything else
  // -- missing included -- is the imperial every reader already defaults to.
  const MM_PER_FT = 304.8;
  const isMetric = units => units === 'metric';
  const mmTo = (ft, step) => Math.round(ft * MM_PER_FT / step) * step;

  const fenLabel = ({ type, widthFt, heightFt, exterior, double: isDouble, garage, units }) => {
    if (!Number.isFinite(widthFt) || widthFt <= 0) return '';
    const metric = isMetric(units);
    const size = ft => (metric ? mmTo(ft, 5) : roundInches(ft));
    if (type === 'window') {
      if (!Number.isFinite(heightFt) || heightFt <= 0) return '';
      // WIDTH BY HEIGHT, off the opening's own numbers: "match the actual size
      // of the window". Nothing is snapped to the stock ladder here -- a
      // drafter who typed 37 gets 37, and the ladder is what he picks FROM,
      // not what the sheet claims he built.
      return `W ${size(widthFt)} X ${size(heightFt)}`;
    }
    if (type !== 'door') return '';
    if (garage) {
      if (!Number.isFinite(heightFt) || heightFt <= 0) return '';
      // WIDTH FIRST, AND SAYS WHICH IS WHICH: "make it obvious which is which
      // in the garage".
      if (metric) return `G ${mmTo(widthFt, 10)}W x ${mmTo(heightFt, 10)}H`;
      return `G ${trimFeet(widthFt)}W x ${trimFeet(heightFt)}H`;
    }
    // ONE LETTER FOR EVERY OTHER DOOR. `exterior` and `double` are still
    // accepted, so a caller that passes them is not wrong -- they simply no
    // longer change the name.
    void exterior; void isDouble;
    return `D${size(widthFt)}`;
  };

  // Classification the plan can derive without asking anyone: garage from
  // the BUILD HOUSE flag (or an exterior door too wide for any man door —
  // no single leaf reaches 8'), double from a 4'+ width, exterior from the
  // host wall riding the house outline (the codebase's own exterior test —
  // loose walls with no closed outline read interior, which fails to the
  // plain D label, never to a wrong claim).
  const fenLabelForOpening = (opening, { exteriorWall, units } = {}) => {
    if (!opening) return '';
    const widthFt = opening.width;
    const heightFt = opening.type === 'window'
      ? (opening.headHeight ?? 0) - (opening.sillHeight ?? 0)
      : opening.headHeight;
    const garage = opening.garage === true || opening.doorType === 'garage'
      || (exteriorWall === true && opening.type === 'door' && widthFt >= 8);
    return fenLabel({
      type: opening.type,
      widthFt,
      heightFt,
      exterior: exteriorWall === true,
      double: widthFt >= 4,
      garage,
      units,
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
  //
  // ON A METRIC DRAWING THE TWO NUMBERS ARE MILLIMETRES -- the tag the box
  // opens with says 915 X 1065, and a reader that took those back as inches
  // would make a window seventy-six feet wide.
  const parseWindowSize = (text, { units } = {}) => {
    const nums = String(text ?? '').match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length !== 2) return null;
    const width = Number(nums[0]), height = Number(nums[1]);
    if (!(width > 0) || !(height > 0)) return null;
    const perFt = isMetric(units) ? MM_PER_FT : 12;
    return { widthFt: width / perFt, heightFt: height / perFt };
  };

  // The preferred stock ladder — which sizes the office actually orders.
  // Door families are widths in inches; garage entries are WIDTH x HEIGHT in
  // feet (16x8 is the 16W x 8H double) and window entries WIDTH x HEIGHT in
  // inches. The family keys keep their old names (ed, dd) so a saved office
  // keeps its lists; what the rows are CALLED is STANDARDS.html's, and the
  // DOUBLE row is FRENCH now (Movie, 1 Oct: "rename double FRENCH").
  //
  // showLabels is MODEL.dc.html's switch and is left as that page reads it.
  // The current pages answer to the layers instead -- A-DIMS-WIN and
  // A-DIMS-DOOR -- because a tick on STANDARDS that the pages ignored was a
  // switch that did nothing.
  //
  // doorsOnElevations: a door's size on an ELEVATION is OFF until the office
  // turns it on (Movie, 1 Oct: "WINDOW sizes ON in elevation construction
  // plans (by default) DOORS off by default but they could turn it on"). On
  // the floor plan both draw, by their layers.
  const DEFAULT_FEN_STANDARDS = Object.freeze({
    showLabels: false,
    doorsOnElevations: false,
    stock: Object.freeze({
      garage: Object.freeze(['16x8', '9x8']),
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
      doorsOnElevations: stored.doorsOnElevations === true,
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

  // A DOOR'S TAG GOES WHERE ITS LEAF DOES NOT. An interior door has no
  // outside to step to, and the side it swings into is under the arc -- so
  // the tag is stepped off the OTHER face, by the same half-thickness-plus-gap
  // a window's is. For the usual inswing front door that is the outside too.
  // The swing side is render-2d's: the left of the glazing run, turned over
  // by FLIP SWING.
  const doorTagLine = (opening, geometry, { gapFt = PLAN_TAG_GAP_FT } = {}) => {
    if (!geometry || !geometry.glazing || !geometry.corners || !geometry.center) return null;
    const [ga, gb] = geometry.glazing;
    const run = Math.hypot(gb.x - ga.x, gb.z - ga.z) || 1;
    const ux = (gb.x - ga.x) / run, uz = (gb.z - ga.z) / run;
    const flip = opening && opening.swingFlip === true ? -1 : 1;
    const away = { x: uz * flip, z: -ux * flip };
    const half = Math.max(...geometry.corners.map(corner =>
      Math.abs((corner.x - geometry.center.x) * away.x
        + (corner.z - geometry.center.z) * away.z)));
    const gap = half + gapFt;
    const cx = geometry.center.x + away.x * gap;
    const cz = geometry.center.z + away.z * gap;
    return {
      a: { x: cx - ux * run / 2, z: cz - uz * run / 2 },
      b: { x: cx + ux * run / 2, z: cz + uz * run / 2 },
    };
  };

  // WHICH LINE A TAG RUNS ALONG, for any opening: a window and a garage door
  // step outside the house; every other door steps off the face its leaf
  // does not swing to. A garage with no outline to read falls back to that.
  const openingTagLine = (opening, geometry, outline) => {
    if (!opening) return null;
    const isGarage = opening.type === 'door'
      && (opening.garage === true || opening.doorType === 'garage');
    if (opening.type === 'window' || isGarage) {
      return planTagLine(geometry, outline) || (isGarage ? doorTagLine(opening, geometry) : null);
    }
    return opening.type === 'door' ? doorTagLine(opening, geometry) : null;
  };

  window.DraftFenLabels = Object.freeze({
    fenLabel,
    MM_PER_FT,
    isMetric,
    mmTo,
    fenLabelForOpening,
    parseWindowSize,
    DEFAULT_FEN_STANDARDS,
    stockListFromText,
    normaliseFenStandards,
    PLAN_TAG_GAP_FT,
    exteriorNormalAt,
    planTagLine,
    doorTagLine,
    openingTagLine,
  });
})();
}
