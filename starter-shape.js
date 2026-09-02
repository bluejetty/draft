// THE FIRST HOUSE'S SHAPE — what the bone draws before anybody has drawn
// anything.
//
// A beginner presses the bone on an empty screen and a house appears. Something
// has to decide what shape that house is, and until now nothing did: every
// outline in this app's history was traced by hand. This is the only place that
// invents one.
//
// ── WHY IT IS NOT ALWAYS A RECTANGLE ──────────────────────────────────────
//
// A rectangle would be the safe answer and it would be the same house every
// time, which quietly teaches that the app draws one house. Three shapes with
// varied proportions teach the opposite in the same number of presses.
//
// The corner counts are the real reason for these three, though. Four, six and
// eight corners walk three different amounts of the wall-joining and roof code
// on a beginner's very first press -- which is exactly where a generated house
// is most likely to expose something, and exactly the moment nobody is watching
// a test suite.
//
// ── WHOLE FEET, ALWAYS ────────────────────────────────────────────────────
//
// The app quantises to whole feet. A starter house arriving on a half-inch
// would be a house arguing with its own rules before the drafter has touched
// anything, so every vertex here is an integer and the arithmetic is done in
// whole feet rather than rounded at the end.
//
// Pure: no DOM, no state, no THREE. The random source is an argument so a test
// can hand it a fixed sequence and get the same house twice. build-house.js
// takes the outline from here unchanged.
if (!window.DraftStarterShape) {
(() => {
  // Movie's number, 2 Sep. Approximate on purpose -- see the note in
  // PLAN-first-house.md: this is the FOOTPRINT, and the interview defaults to
  // two storeys, so the finished house is about twice this.
  const TARGET_SQ_FT = 1500;

  // How far a shape may stray from the target once its proportions are varied.
  // Whole feet cannot hit 1500 exactly at every width, and chasing it would
  // mean fractional depths -- the thing the whole module refuses to do.
  const TOLERANCE_SQ_FT = 60;

  // The long side, in feet. Narrow enough to sit on an ordinary lot, wide
  // enough that the house does not read as a corridor.
  const WIDTH_RANGE = Object.freeze({ least: 40, most: 56 });

  const KIND = Object.freeze({
    RECTANGLE: 'rectangle',
    L: 'L',
    T: 'T',
  });

  const area = points => {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += a.x * b.z - b.x * a.z;
    }
    return Math.abs(sum) / 2;
  };

  const pt = (x, z) => Object.freeze({ x, z });

  // ── The three shapes ──────────────────────────────────────────────────
  // Each takes the long side and returns whole-foot vertices whose area lands
  // near TARGET_SQ_FT. Wound counter-clockwise; build-house.js reads the
  // winding itself to decide which side the wall body sits on, so either
  // direction would work -- one direction consistently is simply easier to
  // reason about when a shape looks wrong on screen.

  const rectangle = width => {
    const depth = Math.round(TARGET_SQ_FT / width);
    return [pt(0, 0), pt(width, 0), pt(width, depth), pt(0, depth)];
  };

  // An L: a full-width bar along the front, and one leg running back from the
  // left. The leg is 40% of the width so the notch reads as deliberate rather
  // than as a mistake in the drawing.
  const lShape = width => {
    const legWidth = Math.round(width * 0.4);
    const barDepth = Math.round(TARGET_SQ_FT / (width + legWidth));
    const legDepth = barDepth;
    return [
      pt(0, 0), pt(width, 0), pt(width, barDepth),
      pt(legWidth, barDepth), pt(legWidth, barDepth + legDepth), pt(0, barDepth + legDepth),
    ];
  };

  // A T: a full-width bar along the front with a stem running back from the
  // middle. The stem is a third of the width and centred, so the two shoulders
  // are equal -- an off-centre stem reads as an L that went wrong.
  const tShape = width => {
    const stemWidth = Math.round(width / 3);
    const barDepth = Math.round(TARGET_SQ_FT / (width + stemWidth));
    const stemDepth = barDepth;
    const left = Math.round((width - stemWidth) / 2);
    const right = left + stemWidth;
    return [
      pt(0, 0), pt(width, 0), pt(width, barDepth),
      pt(right, barDepth), pt(right, barDepth + stemDepth),
      pt(left, barDepth + stemDepth), pt(left, barDepth),
      // The left shoulder. Leaving it out closes the polygon on a diagonal
      // straight back to the origin, which still LOOKS like a T in a list of
      // coordinates and is not one -- it cost about 200 sq ft a shape, and the
      // area sweep in the harness is what found it.
      pt(0, barDepth),
    ];
  };

  const BUILDERS = Object.freeze({
    [KIND.RECTANGLE]: rectangle,
    [KIND.L]: lShape,
    [KIND.T]: tShape,
  });

  const KINDS = Object.freeze(Object.keys(BUILDERS));

  // Centre on the origin. MODEL's world has the origin in the middle of the
  // screen, so a shape built from (0,0) outward would arrive in the corner.
  const centred = points => {
    const xs = points.map(p => p.x);
    const zs = points.map(p => p.z);
    const dx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
    const dz = Math.round((Math.min(...zs) + Math.max(...zs)) / 2);
    return points.map(p => pt(p.x - dx, p.z - dz));
  };

  // One shape. `rng` returns [0,1) and is an argument so a test gets the same
  // house twice; `kind` forces one shape when a caller wants a specific one.
  const shapeFor = (kind, width) => {
    const build = BUILDERS[kind];
    if (!build) return null;
    return Object.freeze(centred(build(width)));
  };

  const generate = (rng = Math.random, kind = null) => {
    const chosen = kind && BUILDERS[kind]
      ? kind
      : KINDS[Math.floor(rng() * KINDS.length) % KINDS.length];
    const span = WIDTH_RANGE.most - WIDTH_RANGE.least;
    const width = WIDTH_RANGE.least + Math.round(rng() * span);
    const points = shapeFor(chosen, width);
    return Object.freeze({
      kind: chosen,
      widthFt: width,
      points,
      areaSqFt: Math.round(area(points)),
    });
  };

  // A shape is only usable if it is whole-footed and lands near the target.
  // The caller does not have to ask -- generate() cannot produce one that
  // fails this -- but the harness does, on every shape at every width.
  const isUsable = shape => Boolean(
    shape
    && shape.points.length >= 4
    && shape.points.every(p => Number.isInteger(p.x) && Number.isInteger(p.z))
    && Math.abs(shape.areaSqFt - TARGET_SQ_FT) <= TOLERANCE_SQ_FT
  );

  window.DraftStarterShape = Object.freeze({
    KIND, KINDS, TARGET_SQ_FT, TOLERANCE_SQ_FT, WIDTH_RANGE,
    generate, shapeFor, isUsable, area,
  });
})();
}
