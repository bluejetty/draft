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

  // ── WALKING A WALL IN COURSES AND STONES ──────────────────────────────
  //
  // The stone patterns share a shape and differ only in their numbers: a
  // course of some height, laid with stones of some width, both hashed off
  // the cell so the wall is irregular and still the SAME wall every repaint.
  // Written once because the alternative is three loops that drift apart.
  //
  // THE COURSE AND THE STONE BOTH VARY, and that is the correction Movie's
  // own reference photographs forced (assets/textures, 27 Sep). The first
  // version of these laid a uniform grid, which is what a MANUFACTURED unit
  // looks like -- and of the five masonry rows only brick is manufactured.
  // Real ashlar puts a big block beside two small ones; real ledgestone runs
  // a long thin piece past three short ones. A ruled grid reads as tile.
  //
  // EACH STONE DRAWS ITS TOP AND ITS RIGHT, and nothing else. The bottom is
  // the course below's top and the left is the last stone's right, so every
  // joint is drawn once -- twice over and a wall at any real scale is a
  // solid block of ink.
  const layStones = (ctx, box, spec) => {
    let y = box.yBottom;
    for (let row = 0; y > box.yTop && row < 400; row += 1) {
      const high = spec.high(row);
      if (!(high >= 1)) break;
      const top = Math.max(y - high, box.yTop);
      // A COURSE STARTS PART WAY INTO A STONE, so the end of the wall does
      // not read as a ruled edge of whole units -- which is the tell that
      // separates a drawn wall from a tiled one.
      let x = box.x0 - spec.wide(row, -1) * jitter(row, 9);
      for (let col = 0; x < box.x1 && col < 400; col += 1) {
        const wide = spec.wide(row, col);
        if (!(wide >= 1)) break;
        const x0 = Math.max(x, box.x0);
        const x1 = Math.min(x + wide, box.x1);
        if (x1 > x0) spec.stone(x0, x1, top, y, row, col);
        x += wide;
      }
      y = top;
    }
  };

  // The top edge and the right edge of one stone, clipped to the wall.
  const stoneEdges = (ctx, box) => (x0, x1, top, bottom) => {
    if (top > box.yTop) { ctx.moveTo(x0, top); ctx.lineTo(x1, top); }
    if (x1 < box.x1) { ctx.moveTo(x1, top); ctx.lineTo(x1, bottom); }
  };

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

    // LAP SIDING, RUNNING ACROSS -- one line per course. Courses run off the
    // wall's FOOT, which is where a sider starts, so the odd course lands at
    // the top the way it does on site.
    //
    // ROTATED 90 DEGREES ON 27 SEP with the row that carries it: Movie had
    // vertical and horizontal siding the wrong way round and said so --
    // *"switch the h and the v"*, *"and change the style to the opposite
    // directions"*. This pattern used to stand its lines up.
    lines: (ctx, box, finish) => {
      const step = paramOf(finish, 'exposureIn', 4) / 12 * box.pxPerFt;
      if (step < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let y = box.yBottom - step; y > box.yTop; y -= step) {
        lineAcross(ctx, box.x0, box.x1, y);
      }
      ctx.stroke();
    },

    // BOARD AND BATTEN, STANDING UP, which is what board and batten IS: wide
    // boards set vertical with a narrow batten covering each joint. It draws
    // as a PAIR of close lines at a wide interval rather than as evenly
    // spaced singles, and that pairing is the whole of what tells it from the
    // lap siding above.
    //
    // ALSO ROTATED ON 27 SEP, and for the same correction -- it used to lay
    // its boards flat.
    batten: (ctx, box, finish) => {
      const board = paramOf(finish, 'boardIn', 12) / 12 * box.pxPerFt;
      const batten = paramOf(finish, 'battenIn', 2) / 12 * box.pxPerFt;
      if (board < MIN_SPACING_PX) return;
      ctx.beginPath();
      for (let x = box.x0 + board; x < box.x1; x += board) {
        ctx.moveTo(x, box.yTop);
        ctx.lineTo(x, box.yBottom);
        if (batten >= 1.5 && x + batten < box.x1) {
          ctx.moveTo(x + batten, box.yTop);
          ctx.lineTo(x + batten, box.yBottom);
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
        // NARROWER BY THIRTY PER CENT, Movie 27 Sep: *"can you strech reduce
        // the cedar shake widthwise maybe 70% so the vert lines of shake are
        // closer together about 30%"*. Was 1.4 to 2.2 of the exposure; a
        // shake read too wide against the courses it laps.
        const wide = step * (0.98 + 0.56 * jitter(row, 3));
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
      const edge = stoneEdges(ctx, box);
      ctx.beginPath();
      layStones(ctx, box, {
        // SORTED THIN, NOT MILLED. Stacked stone runs roughly two thirds to
        // one and a half of nominal, and a ruled set of courses reads as tile.
        high: row => course * (0.7 + 0.8 * jitter(row, 5)),
        // AND LAID LONG, which is the other half of what makes it ledgestone.
        // The photograph runs pieces the better part of a metre beside short
        // ones; five to fifteen courses long covers both.
        wide: (row, col) => course * (5 + 10 * jitter(row + 1, col + 3)),
        stone: (x0, x1, top, bottom, row, col) => {
          edge(x0, x1, top, bottom);
          // AND A SHORT PIECE IS SOMETIMES TWO, STACKED. The photograph is
          // full of them -- two thin slabs filling the height one thicker
          // one takes beside it -- and it is most of what stops the courses
          // reading as ruled lines with breaks in.
          if (bottom - top > MIN_SPACING_PX * 2 && jitter(col + 7, row) > 0.62) {
            const mid = (top + bottom) / 2;
            ctx.moveTo(x0, mid); ctx.lineTo(x1, mid);
          }
        },
      });
      ctx.stroke();
    },

    ashlar: (ctx, box, finish) => {
      const high = paramOf(finish, 'stoneHighIn', 8) / 12 * box.pxPerFt;
      const long = paramOf(finish, 'stoneLongIn', 16) / 12 * box.pxPerFt;
      if (high < MIN_SPACING_PX || long < MIN_SPACING_PX) return;
      const edge = stoneEdges(ctx, box);
      ctx.beginPath();
      layStones(ctx, box, {
        // RANDOM COURSED, which is what the trade calls the photograph and
        // what the first version of this was not. A uniform running bond of
        // one unit is a BRICK wall drawn at stone size; what makes ashlar
        // ashlar is squared stones of MANY sizes fitted to courses.
        high: row => high * (0.6 + 1.1 * jitter(row, 5)),
        // NARROWER BY A FIFTH, Movie 27 Sep: *"strech the width of the
        // Ashlar about 80% (reduce by 20% width"*. Was 0.4 to 1.7 of the
        // nominal; the long blocks read too long against their courses.
        wide: (row, col) => long * (0.32 + 1.04 * jitter(row + 2, col + 1)),
        stone: (x0, x1, top, bottom, row, col) => {
          edge(x0, x1, top, bottom);
          // TWO SMALL ONES WHERE A BIG ONE WOULD GO. The photograph does it
          // constantly, and it is the difference between a wall that was
          // FITTED and a grid that was ruled.
          if (bottom - top > MIN_SPACING_PX * 2.5 && jitter(col + 4, row + 6) > 0.58) {
            const mid = (top + bottom) / 2;
            ctx.moveTo(x0, mid); ctx.lineTo(x1, mid);
          }
        },
      });
      ctx.stroke();
    },

    // Roundstone: cobbles. Drawn as circles rather than a grid, because the
    // shape IS the material -- a round stone in a square joint is the one
    // thing a drafter cannot mistake for the other three.
    round: (ctx, box, finish) => {
      const size = paramOf(finish, 'stoneIn', 8) / 12 * box.pxPerFt;
      if (size < MIN_SPACING_PX * 1.6) return;
      ctx.beginPath();
      let row = 0;
      // A COBBLE IS NOT A CIRCLE AND THEY ARE NOT ALL ONE SIZE. The
      // photograph packs big rounded lumps against small ones filling the
      // gaps, each wider than it is tall or the other way about. Drawn as
      // one repeated circle it read as a bag of marbles.
      for (let y = box.yBottom - size * 0.45; y > box.yTop; y -= size * 0.82, row += 1) {
        const stagger = size * 0.5 * jitter(row, 11);
        for (let x = box.x0 + stagger; x < box.x1 + size; x += size * 0.88) {
          const cell = Math.round(x);
          const rx = size * (0.26 + 0.28 * jitter(row, cell));
          const ry = size * (0.26 + 0.24 * jitter(cell, row + 5));
          const cx = x + size * 0.3 * (jitter(cell + 2, row) - 0.5);
          const cy = y + size * 0.22 * (jitter(row + 3, cell) - 0.5);
          if (cx + rx < box.x0 || cx - rx > box.x1) continue;
          if (rx < 1 || ry < 1) continue;
          // A ROUNDED LUMP, not an ellipse: eight corners pushed in and out
          // by their own hash, which is what a river stone's outline is.
          const corners = 8;
          for (let i = 0; i <= corners; i += 1) {
            const ang = (i / corners) * Math.PI * 2;
            const wob = 0.84 + 0.3 * jitter(cell + i, row);
            const px = cx + Math.cos(ang) * rx * wob;
            const py = cy + Math.sin(ang) * ry * wob;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
    },

    // Fieldstone: rubble laid to no line at all, which is what "odd shapes"
    // means and what separates it from the ashlar above.
    //
    // TESSELLATE, THEN SHRINK. Movie, 27 Sep: *"make all the fieldstones
    // individual shapes and try to reduce the mortar space between them, fit
    // the shapes together"*. Those two asks pull against each other in any
    // obvious drawing -- scatter the stones and they do not fit; tile them and
    // they are not individual, which is the two versions this has already
    // been. A lattice gives the FIT for nothing, because displaced corners
    // stay a perfect tessellation however far they move. Insetting each cell
    // toward its own middle then opens the joint, by exactly the mortar and no
    // more, and leaves every stone a closed shape of its own.
    //
    // THE MORTAR IS THE ROW'S OWN JOINT, so a drafter who wants it tighter
    // sets the number rather than waiting on a new material -- the same
    // promise every other parameter here makes.
    //
    // FOUR TO EIGHT SIDES. Each edge of the lattice carries a midpoint, pushed
    // off the straight by its own hash, on a coin decided by the EDGE rather
    // than by either stone -- so the two stones sharing it agree, and the fit
    // survives. That is what makes a slab angular instead of merely
    // quadrilateral.
    field: (ctx, box, finish) => {
      const size = paramOf(finish, 'stoneIn', 12) / 12 * box.pxPerFt;
      if (size < MIN_SPACING_PX * 2) return;
      const mortar = Math.max(0.6,
        paramOf(finish, 'jointIn', 1) / 12 * box.pxPerFt / 2);
      const cols = Math.ceil((box.x1 - box.x0) / size) + 1;
      const rows = Math.ceil((box.yBottom - box.yTop) / size) + 1;
      const corner = (i, j) => ({
        x: box.x0 + (i - 1) * size + size * 0.5 * (jitter(i, j) - 0.5),
        y: box.yTop + (j - 1) * size + size * 0.5 * (jitter(j, i + 31) - 0.5),
      });
      // The midpoint of one lattice edge, or null where that edge runs
      // straight. Keyed on the EDGE, so both stones using it get the same
      // answer and the joint between them stays the same width.
      const midOf = (i, j, horizontal) => {
        const key = horizontal ? jitter(i * 2 + 1, j * 3) : jitter(i * 3, j * 2 + 1);
        if (key < 0.45) return null;
        const a0 = corner(i, j);
        const b0 = horizontal ? corner(i + 1, j) : corner(i, j + 1);
        const dx = b0.x - a0.x, dy = b0.y - a0.y;
        const off = (horizontal ? jitter(j, i + 7) : jitter(i, j + 7)) - 0.5;
        return { x: (a0.x + b0.x) / 2 - dy * off * 0.45,
          y: (a0.y + b0.y) / 2 + dx * off * 0.45 };
      };
      // ── AND A MASON PICKS THE STONE THAT FILLS THE HOLE ───────────────
      //
      // Movie, 27 Sep: *"a bricklayer would be choosing a shape to fill the
      // gaps as much as possible"*. A lattice on its own lays one size, which
      // is a net rather than a wall -- so a cell sometimes swallows the one
      // beside it or below it and goes down as a single bigger slab, the way
      // a big stone spans where two would have gone. The joints it ate simply
      // are not drawn, and the fit is untouched: the outside of two cells is
      // still a ring of shared lattice points.
      const eaten = new Set();
      const ctxBegin = () => ctx.beginPath();
      ctxBegin();
      for (let j = 0; j <= rows; j += 1) {
        for (let i = 0; i <= cols; i += 1) {
          if (eaten.has(`${i},${j}`)) continue;
          const wide = i < cols && !eaten.has(`${i + 1},${j}`)
            && jitter(i + 13, j + 5) > 0.74;
          const tall = !wide && j < rows && !eaten.has(`${i},${j + 1}`)
            && jitter(i + 5, j + 13) > 0.78;
          if (wide) eaten.add(`${i + 1},${j}`);
          if (tall) eaten.add(`${i},${j + 1}`);
          const ring = (wide ? [
            corner(i, j), midOf(i, j, true), corner(i + 1, j),
            midOf(i + 1, j, true), corner(i + 2, j),
            midOf(i + 2, j, false), corner(i + 2, j + 1),
            midOf(i + 1, j + 1, true), corner(i + 1, j + 1),
            midOf(i, j + 1, true), corner(i, j + 1), midOf(i, j, false),
          ] : tall ? [
            corner(i, j), midOf(i, j, true), corner(i + 1, j),
            midOf(i + 1, j, false), corner(i + 1, j + 1),
            midOf(i + 1, j + 1, false), corner(i + 1, j + 2),
            midOf(i, j + 2, true), corner(i, j + 2),
            midOf(i, j + 1, false), corner(i, j + 1), midOf(i, j, false),
          ] : [
            corner(i, j), midOf(i, j, true), corner(i + 1, j),
            midOf(i + 1, j, false), corner(i + 1, j + 1),
            midOf(i, j + 1, true), corner(i, j + 1), midOf(i, j, false),
          ]).filter(Boolean);
          if (ring.length < 4) continue;
          // Inset toward the stone's own middle by half the joint, which is
          // what turns one tessellation into a wall of separate stones.
          const cx = ring.reduce((sum, pt) => sum + pt.x, 0) / ring.length;
          const cy = ring.reduce((sum, pt) => sum + pt.y, 0) / ring.length;
          const laid = ring.map(pt => {
            const dx = cx - pt.x, dy = cy - pt.y;
            const len = Math.hypot(dx, dy) || 1;
            if (len <= mortar * 1.5) return null;
            return { x: pt.x + dx / len * mortar, y: pt.y + dy / len * mortar };
          });
          if (laid.some(pt => !pt)) continue;
          if (Math.max(...laid.map(pt => pt.x)) < box.x0
            || Math.min(...laid.map(pt => pt.x)) > box.x1) continue;
          laid.forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
          ctx.lineTo(laid[0].x, laid[0].y);
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
