// THE ROOFING MATERIALS, DRAWN.
//
// roof-types.js names the ten and says what varies about each; this draws the
// seven pictures they share. Kept apart from cut-view.js for the reason
// finish-patterns.js is: a hatch is a drawing decision that belongs beside the
// table naming it, and the elevation painter is long enough.
//
// ── A ROOF IS NOT A BOX, WHICH IS THE WHOLE DIFFERENCE ────────────────────
//
// finish-patterns.js takes `{x0, x1, yTop, yBottom}` because a wall face on an
// elevation is an upright rectangle: across is horizontal, up is vertical, and
// a course is a level line. A roof plane is none of those. It is a sloped
// quadrilateral, its courses run PARALLEL TO THE EAVE rather than level, and
// on a hip its two edges are not even parallel to each other.
//
// SO THE FRAME IS A PARALLELOGRAM, not a box: an origin at one end of the
// eave, a unit vector ALONG the eave, a unit vector UP the rake, and how far
// it runs each way. Every pattern below is written in those two axes and
// nothing in this file knows which way is up on the screen.
//
// WHICH ALSO HANDS THE FORESHORTENING OVER FOR FREE. A roof seen at an angle
// is shorter up the slope than it is in reality, and the caller already knows
// by how much -- it computed the projected corners. Reading the axes off those
// corners means a course drawn here lands exactly where the roof's own edges
// say it should, and this file never does trigonometry it could get wrong.
//
// DETERMINISTIC, ALWAYS, for the same reason the wall hatches are: shake wants
// irregularity and `Math.random()` would give it differently on every repaint,
// so a roof would shimmer as the window resized. The jitter is hashed off the
// unit's own position in the frame.
if (!window.DraftRoofPatterns) {
(() => {
  // THE SCALE GATE, and the same number the wall hatches use: below three
  // pixels a course spacing stops being a pattern and becomes a grey wash that
  // hides the roof's own outline while saying a material is there without
  // saying which. A thumbnail shows the house, not its shingles.
  const MIN_SPACING_PX = 3;

  // Position-hashed, in [0,1). Two numbers in, the same number out, forever.
  const jitter = (a, b) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };

  const paramOf = (roofing, key, fallback) => {
    const found = (roofing.params || []).find(p => p.key === key);
    return found ? found.in : fallback;
  };

  // ── THE TWO AXES ──────────────────────────────────────────────────────
  //
  // `s` runs along the eave and `t` runs up the rake, both in PIXELS, and
  // `at` is the only place either is turned into a screen point. A pattern
  // that reached past this into x and y would be a pattern that breaks the
  // first time a roof is seen at an angle.
  const at = (frame, s, t) => ({
    x: frame.ox + frame.ax * s + frame.ux * t,
    y: frame.oy + frame.ay * s + frame.uy * t,
  });
  // A COURSE: constant height up the slope, running the width of the frame.
  const course = (ctx, frame, t, from = 0, to = frame.wide) => {
    const a = at(frame, from, t), b = at(frame, to, t);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  };
  // A RAKE LINE: constant position along the eave, running up the slope.
  const rake = (ctx, frame, s, from = 0, to = frame.high) => {
    const a = at(frame, s, from), b = at(frame, s, to);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  };

  const upFt = (frame, inches) => inches / 12 * frame.pxPerFt;

  // ── THE SEVEN PICTURES ────────────────────────────────────────────────
  const PATTERNS = {
    // ASPHALT. Courses, and a slit at every tab -- and the slits STAGGER half
    // a tab each course, which is the whole of what tells a shingle roof from
    // a tiled one at a glance. Laid in line they would read as a grid.
    //
    // THE SLIT IS SHORT, running down from its course rather than across the
    // whole band: that is what it is on a roof, a cut through one layer with
    // the course below showing whole underneath.
    tab: (ctx, frame, roofing) => {
      const step = upFt(frame, paramOf(roofing, 'exposureIn', 5.625));
      const tab = upFt(frame, paramOf(roofing, 'tabIn', 12));
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      let row = 0;
      for (let t = step; t < frame.high; t += step, row += 1) {
        course(ctx, frame, t);
        if (tab < MIN_SPACING_PX) continue;
        const shift = (row % 2) * tab / 2;
        for (let s = shift; s < frame.wide; s += tab) {
          rake(ctx, frame, s, t - step * 0.55, t);
        }
      }
      ctx.stroke();
    },

    // STANDING SEAM. Pans and the seams between them, running the full slope
    // eave to ridge -- and NOTHING across, because there is nothing across: a
    // standing seam roof is one continuous sheet up the slope, which is most
    // of why it is specified. A course line here would be drawing a joint the
    // roof does not have.
    seam: (ctx, frame, roofing) => {
      const pan = upFt(frame, paramOf(roofing, 'panIn', 16));
      if (pan < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let s = pan; s < frame.wide; s += pan) rake(ctx, frame, s);
      ctx.stroke();
    },

    // CORRUGATED. The same idea at a quarter the spacing, which is what tells
    // an exposed-fastener panel from a standing seam: ribs you can count
    // against seams you can measure. It is one pattern reading differently
    // because of one number, and that is exactly what a parameter is for.
    rib: (ctx, frame, roofing) => {
      const step = upFt(frame, paramOf(roofing, 'ribIn', 9));
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let s = step; s < frame.wide; s += step) rake(ctx, frame, s);
      ctx.stroke();
    },

    // PRESSED METAL SHINGLE. A REGULAR GRID, joints lined up course to course
    // -- which is the pair this pattern exists to be distinct from. A metal
    // tile panel is a module stamped off a press and installed in line; slate
    // is a small unit laid in a broken bond. Drawn the same way, a metal roof
    // reads as slate at four times the weight, which is the reading that
    // matters on a sheet somebody frames a house from.
    panel: (ctx, frame, roofing) => {
      const step = upFt(frame, paramOf(roofing, 'exposureIn', 15));
      const wide = upFt(frame, paramOf(roofing, 'widthIn', 24));
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let t = step; t < frame.high; t += step) course(ctx, frame, t);
      if (wide >= MIN_SPACING_PX) {
        for (let s = wide; s < frame.wide; s += wide) rake(ctx, frame, s);
      }
      ctx.stroke();
    },

    // SHAKE. Courses with the butts lapping, and joints between the shakes
    // that WANDER -- a split shake is not a sawn one, and a ruled grid reads
    // as panelling. The same correction the wall's shake pattern needed, for
    // the same reason and by the same means: the joint's position is hashed
    // off its own course and index so it is irregular and still the SAME roof
    // on every repaint.
    //
    // AND THE JOINT STOPS AT ITS COURSE. A joint running the whole band would
    // close the shakes into rectangles, which is precisely the defect the wall
    // pattern was caught with on a swatch sheet: it read as coursed ashlar.
    shake: (ctx, frame, roofing) => {
      const step = upFt(frame, paramOf(roofing, 'exposureIn', 10));
      if (step < MIN_SPACING_PX) return;
      const nominal = step * 0.9;
      ctx.beginPath();
      let row = 0;
      for (let t = step; t < frame.high; t += step, row += 1) {
        course(ctx, frame, t);
        if (nominal < MIN_SPACING_PX) continue;
        let s = 0, i = 0;
        while (s < frame.wide) {
          s += nominal * (0.55 + jitter(row, i) * 0.9);
          i += 1;
          if (s >= frame.wide) break;
          // Down from its own course, never across the one below it.
          rake(ctx, frame, s, t - step, t);
        }
      }
      ctx.stroke();
    },

    // BARREL TILE. Courses, and the ROLL between them -- a pan tile roof reads
    // as a row of half-cylinders, so what is drawn at every cover width is a
    // short pair of strokes standing up off the course rather than a line
    // running the whole slope. Run full height they would read as corrugated
    // metal, which is a different material at a tenth the weight.
    barrel: (ctx, frame, roofing) => {
      const step = upFt(frame, paramOf(roofing, 'exposureIn', 13));
      const cover = upFt(frame, paramOf(roofing, 'coverIn', 13));
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let t = step; t < frame.high; t += step) {
        course(ctx, frame, t);
        if (cover < MIN_SPACING_PX) continue;
        for (let s = cover / 2; s < frame.wide; s += cover) {
          rake(ctx, frame, s, t - step * 0.45, t);
        }
      }
      ctx.stroke();
    },

    // SLATE. A small flat unit in a BROKEN BOND: courses, and a joint every
    // width, offset half a unit each course. The offset is the pattern -- laid
    // in line it is the metal panel above, and that pair is the one the table
    // keeps seven pictures for rather than six.
    slate: (ctx, frame, roofing) => {
      const step = upFt(frame, paramOf(roofing, 'exposureIn', 7.5));
      const wide = upFt(frame, paramOf(roofing, 'widthIn', 12));
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      let row = 0;
      for (let t = step; t < frame.high; t += step, row += 1) {
        course(ctx, frame, t);
        if (wide < MIN_SPACING_PX) continue;
        const shift = (row % 2) * wide / 2;
        for (let s = shift; s < frame.wide; s += wide) {
          if (s <= 0) continue;
          rake(ctx, frame, s, t - step, t);
        }
      }
      ctx.stroke();
    },
  };

  // THE SHADOW UNDER A LAPPED BUTT, which is what `relief` means on this
  // table: a shake, a slate and a tile all stand over the course below and
  // throw a line a drafter draws. Offset UP THE SLOPE rather than down-right
  // like the wall hatches, because on a roof the thing casting the shadow is
  // the course's own leading edge and the shadow falls below it -- which in
  // this frame is the negative `t` direction.
  const reliefOffset = (roofing, pxPerFt) =>
    Math.max(0.6, Math.min(2.5, (roofing.weightPsf || 2) / 12 * pxPerFt * 0.35));

  // ── ONE CALL ──────────────────────────────────────────────────────────
  //
  // `frame` is pixels: an origin, the two unit axes, and the extent each way.
  // The caller has already clipped to the roof face and is responsible for
  // saving and restoring; this sets only its own stroke.
  //
  // FALSE MEANS NOTHING WAS DRAWN, so a caller can tell "too small to hatch"
  // from "hatched", the way drawFinish does.
  function drawRoofing(ctx, frame, roofing, inks) {
    const pattern = PATTERNS[roofing && roofing.pattern];
    if (!pattern) return false;
    if (!(frame.wide > 0) || !(frame.high > 0) || !(frame.pxPerFt > 0)) return false;
    const line = (inks && inks.hatch) || '#1d1f20';
    ctx.save();
    if (roofing.relief) {
      const off = reliefOffset(roofing, frame.pxPerFt);
      ctx.save();
      // ALONG THE SLOPE, not down the screen: `ux, uy` is where up is on this
      // roof, so the shadow lands under the course whatever angle it is seen
      // at. A translate in screen y would put it sideways on a hip.
      ctx.translate(-frame.ux * off, -frame.uy * off);
      ctx.strokeStyle = line;
      ctx.globalAlpha = 0.26;
      ctx.lineWidth = Math.max(1, off);
      pattern(ctx, frame, roofing);
      ctx.restore();
    }
    ctx.strokeStyle = line;
    ctx.globalAlpha = roofing.relief ? 0.7 : 0.45;
    ctx.lineWidth = 0.75;
    pattern(ctx, frame, roofing);
    ctx.restore();
    return true;
  }

  // ── THE FRAME, OFF A PROJECTED ROOF FACE ──────────────────────────────
  //
  // The caller has a polygon in screen pixels and knows which of its edges is
  // the EAVE -- the low one. This turns those two facts into the axes above,
  // so cut-view.js hands over geometry it already has rather than learning
  // what a pattern needs.
  //
  // THE FRAME IS THE FACE'S BOUNDING PARALLELOGRAM and it will overhang a
  // triangular face at the ridge. That is correct and is why the caller
  // clips: a gable's two planes each want their courses running to the ridge,
  // and a frame cut to the triangle would stop them short of it.
  const frameFor = (poly, eaveA, eaveB, pxPerFt) => {
    const ex = eaveB.x - eaveA.x, ey = eaveB.y - eaveA.y;
    const wide = Math.hypot(ex, ey);
    if (!(wide > 0.5)) return null;
    const ax = ex / wide, ay = ey / wide;
    // UP IS PERPENDICULAR TO THE EAVE, turned toward the rest of the face.
    // Both perpendiculars are perpendicular; the one that points at the roof
    // is the one the far corners are on, so the sign is read off the face
    // rather than assumed -- a roof drawn from the other side would otherwise
    // hatch into thin air.
    let ux = -ay, uy = ax;
    const far = poly.reduce((best, pt) => {
      const t = (pt.x - eaveA.x) * ux + (pt.y - eaveA.y) * uy;
      return Math.abs(t) > Math.abs(best) ? t : best;
    }, 0);
    if (far < 0) { ux = -ux; uy = -uy; }
    const high = Math.abs(far);
    if (!(high > 0.5)) return null;
    return { ox: eaveA.x, oy: eaveA.y, ax, ay, ux, uy, wide, high, pxPerFt };
  };

  window.DraftRoofPatterns = Object.freeze({
    MIN_SPACING_PX,
    PATTERNS,
    frameFor,
    drawRoofing,
  });
})();
}
