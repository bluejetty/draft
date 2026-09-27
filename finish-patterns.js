// THE EXTERIOR FINISHES, DRAWN.
//
// wall-types.js names the materials and says what varies about each one; this
// draws them. Kept apart from cut-view.js because a hatch is a drawing
// decision that belongs beside the table naming it, and because the elevation
// painter is 4,700 lines already.
//
// WHAT A HATCH IS FOR. It is not a rendering -- it is the mark that tells one
// material from its neighbour at a glance on a printed sheet, which is why
// STUCCO draws nothing at all: hatch everything and an elevation is noise
// carrying no more information than before. The four stones and the brick read
// differently from each other because a drafter has to be able to say which is
// which without reading the legend.
//
// DETERMINISTIC, ALWAYS. Fieldstone and roundstone want irregularity, and
// `Math.random()` would give it to them -- differently on every repaint, so a
// wall would shimmer as the window resized and no two screenshots of one
// drawing would agree. The jitter is hashed off the unit's own grid position
// instead: the same stone lands in the same place forever.
if (!window.DraftFinishPatterns) {
(() => {
  // ── THE SCALE GATE ────────────────────────────────────────────────────
  //
  // A 4" exposure at 3 px/ft is one pixel. Drawn anyway, the hatch stops being
  // a pattern and becomes a grey wash -- which is worse than nothing, because
  // it hides the wall's own outline and says a material is there without
  // saying which. Below this, a face keeps its plain fill.
  //
  // THREE PIXELS, not one: two lines a pixel apart with a pixel between them
  // is a solid block at any real rendering. This is the number the rail seats
  // and LAYOUT's small viewports fall under, which is the point -- a thumbnail
  // shows the house, not its siding.
  const MIN_SPACING_PX = 3;

  // Position-hashed, in [0,1). Two integers in, the same number out, forever.
  const jitter = (a, b) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };

  const paramOf = (finish, key, fallback) => {
    const found = (finish.params || []).find(p => p.key === key);
    return found ? found.in : fallback;
  };

  // ── LIGHT FROM THE UPPER LEFT ─────────────────────────────────────────
  //
  // The convention every set uses, and the reason `relief` is one flag on a
  // row rather than a drawing per material: a unit standing proud of its joint
  // throws its shadow on the BOTTOM and the RIGHT. Written once here so the
  // four stones and the brick cannot each answer it differently.
  const SHADE_SIDES = Object.freeze({ bottom: true, right: true });

  // Everything below draws into a box already clipped to the wall face, in
  // PIXELS, with `up` the direction of increasing elevation on screen (-1:
  // screen y grows downward). A pattern never strokes the box's own edge --
  // the face's outline is the painter's, and a hatch that redrew it would
  // double every wall line on the sheet.
  const lineAcross = (ctx, x0, x1, y) => {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  };

  // ── THE PATTERNS ──────────────────────────────────────────────────────
  // Each takes the clipped box and the finish's own numbers, and each is
  // deliberately a few lines: a hatch that needs a page of code is a hatch
  // that is trying to be a photograph.
  const PATTERNS = {
    // Stucco. THE QUIET GROUND -- see the note at the top.
    none: () => {},

    // Vertical boards, one line per joint. Courses run off the wall's LEFT
    // end, which is where a sider starts, so the odd board lands at the far
    // corner the way it does on site.
    lines: (ctx, box, finish) => {
      const step = paramOf(finish, 'exposureIn', 4) / 12 * box.pxPerFt;
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let x = box.x0 + step; x < box.x1; x += step) {
        ctx.moveTo(x, box.yTop);
        ctx.lineTo(x, box.yBottom);
      }
      ctx.stroke();
    },

    // Board and batten, laid HORIZONTAL -- Movie's own call for it. A wide
    // board with a narrow batten over each joint, which draws as a PAIR of
    // close lines at a wide interval rather than as evenly spaced singles.
    // That pairing is the whole of what tells it from the row above.
    batten: (ctx, box, finish) => {
      const board = paramOf(finish, 'boardIn', 12) / 12 * box.pxPerFt;
      const batten = paramOf(finish, 'battenIn', 2) / 12 * box.pxPerFt;
      if (board < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let y = box.yBottom - board; y > box.yTop; y -= board) {
        lineAcross(ctx, box.x0, box.x1, y);
        if (batten >= 1.5 && y + batten < box.yBottom) {
          lineAcross(ctx, box.x0, box.x1, y + batten);
        }
      }
      ctx.stroke();
    },

    // Cedar shake. The courses are lap siding's, and what tells it from lap
    // siding is that the joints between shakes WANDER.
    //
    // THE JOINTS ARE SHORT, AND THAT IS THE WHOLE OF IT. Drawn the full course
    // height they close into rectangles and the wall reads as coursed ashlar
    // -- which is what the first version of this did. A shake is LAPPED: what
    // shows of the joint is the part below the course above it, so the mark is
    // a stub rising off the butt line, not a cell wall.
    //
    // WIDE AND WANDERING. A shake is 8 to 14 inches, laid so no two courses
    // break together, so the interval is hashed per course AND the position
    // hashed again within it. Regular spacing at any width reads as panelling.
    shake: (ctx, box, finish) => {
      const step = paramOf(finish, 'exposureIn', 7) / 12 * box.pxPerFt;
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      let row = 0;
      for (let y = box.yBottom - step; y > box.yTop - step; y -= step, row += 1) {
        if (y > box.yTop) lineAcross(ctx, box.x0, box.x1, y);
        const wide = step * (1.4 + 0.8 * jitter(row, 3));
        if (wide < MIN_SPACING_PX * 2) continue;
        const stub = Math.min(step * 0.62, y - box.yTop);
        if (stub < 1) continue;
        for (let x = box.x0 + wide * jitter(row, 0); x < box.x1; x += wide) {
          const at = x + wide * 0.5 * (jitter(row, Math.round(x)) - 0.5);
          if (at <= box.x0 || at >= box.x1) continue;
          ctx.moveTo(at, y);
          ctx.lineTo(at, y - stub);
        }
      }
      ctx.stroke();
    },

    // Ledgestone: thin courses, stacked, with the pieces in each course broken
    // at wandering joints. The courses are the strong mark and the joints are
    // the weak one, which is what separates it from ashlar below.
    stacked: (ctx, box, finish) => {
      const course = paramOf(finish, 'courseIn', 3) / 12 * box.pxPerFt;
      if (course < MIN_SPACING_PX) return;
      ctx.beginPath();
      let row = 0;
      // THE COURSES CARRY IT, AND THEY ARE NOT ALL ONE HEIGHT. Stacked stone
      // is sorted thin, not milled: courses run maybe two thirds to one and a
      // half of nominal, and an exactly ruled set of them reads as tile. The
      // variation is hashed per course, so the same wall stacks the same way
      // every repaint.
      for (let y = box.yBottom; y > box.yTop; row += 1) {
        const high = course * (0.7 + 0.7 * jitter(row, 5));
        const next = y - high;
        if (y < box.yBottom) lineAcross(ctx, box.x0, box.x1, y);
        // AND THE PIECES ARE LONG, WHICH IS WHY THE JOINTS ARE SPARSE. The
        // first version broke every 10 inches and hashed the offset per ROW,
        // which lined the breaks up into diagonal streaks across the wall --
        // the eye joins near-regular marks faster than it reads the courses
        // they sit in. Two feet apart and hashed per COLUMN as well, there is
        // nothing left to join.
        const long = course * (7 + 5 * jitter(row, 6));
        if (long >= MIN_SPACING_PX * 2) {
          for (let x = box.x0 + long * jitter(row, 1); x < box.x1; x += long) {
            const at = x + long * 0.6 * (jitter(Math.round(x), row) - 0.5);
            if (at <= box.x0 || at >= box.x1) continue;
            ctx.moveTo(at, y);
            ctx.lineTo(at, Math.max(box.yTop, next));
          }
        }
        y = next;
      }
      ctx.stroke();
    },

    // Ashlar: SQUARED, COURSED blocks -- a real grid, laid in a running bond,
    // which is exactly the thing the ledgestone above is not.
    ashlar: (ctx, box, finish) => {
      const high = paramOf(finish, 'stoneHighIn', 8) / 12 * box.pxPerFt;
      const long = paramOf(finish, 'stoneLongIn', 16) / 12 * box.pxPerFt;
      if (high < MIN_SPACING_PX || long < MIN_SPACING_PX) return;
      ctx.beginPath();
      let row = 0;
      for (let y = box.yBottom; y > box.yTop; y -= high, row += 1) {
        if (y < box.yBottom) lineAcross(ctx, box.x0, box.x1, y);
        const offset = (row % 2) * long / 2;
        for (let x = box.x0 + offset; x < box.x1; x += long) {
          if (x <= box.x0) continue;
          ctx.moveTo(x, y);
          ctx.lineTo(x, Math.max(box.yTop, y - high));
        }
      }
      ctx.stroke();
    },

    // Roundstone: cobbles. Drawn as circles rather than a grid, because the
    // shape IS the material -- a round stone in a square joint is the one
    // thing a drafter cannot mistake for the other three.
    round: (ctx, box, finish) => {
      const size = paramOf(finish, 'stoneIn', 8) / 12 * box.pxPerFt;
      if (size < MIN_SPACING_PX * 1.6) return;
      const r = size / 2;
      ctx.beginPath();
      let row = 0;
      for (let y = box.yBottom - r; y > box.yTop + r * 0.4; y -= size, row += 1) {
        const offset = (row % 2) * r;
        for (let x = box.x0 + r + offset; x < box.x1 - r * 0.4; x += size) {
          const rr = r * (0.72 + 0.24 * jitter(row, Math.floor(x)));
          ctx.moveTo(x + rr, y);
          ctx.arc(x, y, rr, 0, Math.PI * 2);
        }
      }
      ctx.stroke();
    },

    // Fieldstone: rubble laid to no line at all, which is what "odd shapes"
    // means. A scattered polygon per stone, its corners hashed off its own
    // cell so the wall is irregular and still the same wall every repaint.
    field: (ctx, box, finish) => {
      const size = paramOf(finish, 'stoneIn', 12) / 12 * box.pxPerFt;
      if (size < MIN_SPACING_PX * 2) return;
      ctx.beginPath();
      let row = 0;
      for (let y = box.yBottom - size / 2; y > box.yTop; y -= size * 0.82, row += 1) {
        const offset = size * jitter(row, 2);
        for (let x = box.x0 + offset; x < box.x1; x += size * 0.95) {
          const cell = Math.floor(x);
          const rx = size * (0.3 + 0.16 * jitter(row, cell));
          const ry = size * (0.24 + 0.14 * jitter(cell, row));
          const corners = 6;
          for (let i = 0; i <= corners; i += 1) {
            const a = (i / corners) * Math.PI * 2;
            const wob = 0.72 + 0.4 * jitter(cell + i, row);
            const px = x + Math.cos(a) * rx * wob;
            const py = y + Math.sin(a) * ry * wob;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
    },

    // Brick: the one masonry that comes in a SIZE. A running bond -- the
    // half-lap every other course -- because that is what a house is laid in
    // unless somebody says otherwise. Coursing is the unit plus its joint,
    // which is arithmetic rather than character: see the note in wall-types.js
    // on why the nominal is not what is stored.
    brick: (ctx, box, finish) => {
      const joint = paramOf(finish, 'jointIn', 0.375);
      const high = (paramOf(finish, 'brickHighIn', 2.25) + joint) / 12 * box.pxPerFt;
      const long = (paramOf(finish, 'brickLongIn', 7.625) + joint) / 12 * box.pxPerFt;
      if (high < MIN_SPACING_PX || long < MIN_SPACING_PX) return;
      ctx.beginPath();
      let row = 0;
      for (let y = box.yBottom; y > box.yTop; y -= high, row += 1) {
        if (y < box.yBottom) lineAcross(ctx, box.x0, box.x1, y);
        const offset = (row % 2) * long / 2;
        for (let x = box.x0 + offset; x < box.x1; x += long) {
          if (x <= box.x0) continue;
          ctx.moveTo(x, y);
          ctx.lineTo(x, Math.max(box.yTop, y - high));
        }
      }
      ctx.stroke();
    },
  };

  // ── THE RELIEF PASS ───────────────────────────────────────────────────
  //
  // Movie: *"can we give these texture where the stone stuck out past the
  // mortor"*. Outlined flat, the same pattern reads as a tile floor stood on
  // end; what makes stone read as stone is that the unit sits FORWARD and the
  // mortar is recessed behind it.
  //
  // DRAWN AS A SECOND, HEAVIER PASS over the same lines, offset down and
  // right. That is the shadow the joint throws with light from the upper left,
  // and doing it as an offset repaint of the pattern rather than as a shape
  // per unit means every material gets it from its own geometry and none of
  // them needs a second drawing routine.
  //
  // THE OFFSET IS THE JOINT, in feet, because the shadow's width is what the
  // stone stands proud OF. A 2" stone in a 1" joint throws a wider shadow than
  // brick in three eighths, and that difference is most of what tells the two
  // apart at a distance.
  const reliefOffsetPx = (finish, pxPerFt) => {
    const joint = paramOf(finish, 'jointIn', 0.375);
    return Math.max(0.6, Math.min(2.5, joint / 12 * pxPerFt * 0.9));
  };

  // ── ONE CALL ──────────────────────────────────────────────────────────
  //
  // `box` is pixels: x0/x1 across, yTop/yBottom down the screen (yTop is the
  // SMALLER number -- screen y grows downward), plus the scale everything is
  // measured at. The caller has already clipped to the face and is responsible
  // for saving and restoring; this sets only its own stroke.
  function drawFinish(ctx, box, finish, inks) {
    const pattern = PATTERNS[finish?.pattern];
    if (!pattern || box.yBottom - box.yTop < 1 || box.x1 - box.x0 < 1) return false;
    const line = (inks && inks.line) || '#1d1f20';
    ctx.save();
    if (finish.relief) {
      // The shadow first, so the pattern's own line lands ON TOP of it and the
      // unit reads as standing in front of its joint rather than behind it.
      const off = reliefOffsetPx(finish, box.pxPerFt);
      ctx.save();
      ctx.translate(off, off);
      ctx.strokeStyle = line;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = Math.max(1, off);
      pattern(ctx, box, finish);
      ctx.restore();
    }
    ctx.strokeStyle = line;
    ctx.globalAlpha = finish.relief ? 0.75 : 0.5;
    ctx.lineWidth = 0.75;
    pattern(ctx, box, finish);
    ctx.restore();
    return true;
  }

  window.DraftFinishPatterns = Object.freeze({
    MIN_SPACING_PX,
    SHADE_SIDES,
    PATTERNS,
    reliefOffsetPx,
    drawFinish,
  });
})();
}
