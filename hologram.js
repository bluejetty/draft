// HOLOGRAMS: ANOTHER .draft SHOWN UNDER THIS ONE, AND WHAT COMES OUT OF IT.
//
// Movie, 8 Oct: "allow users to bring DRAFT 'HOLOGRAM' into another file" --
// the existing house on a lot getting a new house or an addition -- and
// then DEMO: "the hologram will stay, but just parts will be 'removed' from
// the new 'hologram' the DEMO parts, and then the user can REDRAW the new
// stuff in that location".
//
// SHARED, because it is drawn in more than one place. It lived in MODEL.html
// for its first three PRs; the LAYOUT sheets (hologram PR 4) are the second
// caller, and a second copy of "what does the existing plan leave out" is
// the drift this repo keeps paying for. The record itself -- the copy, the
// placement, the DEMO lists -- is drawing-format.js's; this file is what is
// DRAWN from it.
//
// It reads its neighbours off `window` when called, like every other shared
// module here: DraftLayoutPlan (the whole-drawing painter), DraftDrawingFormat
// (the placement), DraftGeometry2D, DraftWallTypes, DraftFixtureGeometry.
(() => {
  const BLUE = 'rgb(82,151,218)';
  const PALE = 'rgb(186,214,242)';
  const ALPHA = 0.75;
  const VIEWS = new Set(['plan', 'floor', 'foundation']);

  // The drawing of a level a hologram shows under a given one: the same view
  // where it has one, the PLAN for any other (electrical, stair), and the
  // roof or site as itself.
  const planViewFor = viewId => (VIEWS.has(viewId) ? viewId : (viewId == null ? null : 'plan'));

  // ── WHAT IS EXISTING AND WHAT IS COMING OUT ───────────────────────────────
  //
  // A WALL COMING OUT TAKES ITS DOORS, WINDOWS AND FIXTURES WITH IT, so a
  // drafter demolishing a wall does not have to find each thing on it.
  //
  // PART OF A WALL (hologram PR 3): a wall with pieces cut out of it stands
  // in the existing plan as the runs either side of them, each its own
  // wall, and what sat in a piece -- a window where the addition opens up
  // -- comes out with the piece. What sat on a run moves onto that run.
  const wallRunsOutside = (wall, pieces) => {
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    const cuts = pieces.map(p => [Math.max(0, p.from), Math.min(len, p.to)])
      .filter(([a, b]) => b > a).sort((m, n) => m[0] - n[0]);
    const runs = [];
    let at = 0;
    cuts.forEach(([a, b]) => { if (a > at + 1e-6) runs.push([at, a]); at = Math.max(at, b); });
    if (len > at + 1e-6) runs.push([at, len]);
    return { len, runs, cuts };
  };
  const wallAlong = (wall, len, d) => ({
    x: wall.start.x + (wall.end.x - wall.start.x) * d / len,
    y: wall.start.y || 0,
    z: wall.start.z + (wall.end.z - wall.start.z) * d / len,
  });
  const parts = holo => {
    const source = holo.source || {};
    const marked = kind => new Set(holo.demo?.[kind] || []);
    const walls = marked('walls');
    const fens = marked('fenestrations');
    const fixes = marked('fixtures');
    const list = key => (Array.isArray(source[key]) ? source[key] : []);
    const piecesOn = new Map();
    (holo.demo?.pieces || []).forEach(piece => {
      if (walls.has(piece.wallId)) return;            // the whole wall is out already
      if (!piecesOn.has(piece.wallId)) piecesOn.set(piece.wallId, []);
      piecesOn.get(piece.wallId).push(piece);
    });
    // Each cut wall: its runs as walls of their own, and the pieces.
    const split = new Map();
    list('walls').forEach(wall => {
      const pieces = piecesOn.get(wall.id);
      if (!pieces) return;
      const { len, runs, cuts } = wallRunsOutside(wall, pieces);
      if (!(len > 0)) return;
      split.set(wall.id, {
        len, cuts,
        runs: runs.map(([a, b], i) => ({ from: a, wall: { ...wall, id: `${wall.id}~${i + 1}`,
          start: wallAlong(wall, len, a), end: wallAlong(wall, len, b) } })),
        pieces: cuts.map(([a, b]) => ({ ...wall, start: wallAlong(wall, len, a), end: wallAlong(wall, len, b) })),
      });
    });
    // Something ON a wall: out with the wall, out with a piece it touches,
    // or moved onto the run it sits on.
    const placed = (item, halfFt) => {
      if (walls.has(item?.wallId)) return null;
      const cut = split.get(item?.wallId);
      if (!cut) return item;
      const centre = Number(item.offset) || 0;
      const lo = centre - halfFt, hi = centre + halfFt;
      // Only what fits wholly on one run stays; touching a piece, it goes.
      const run = cut.runs.find(r => lo >= r.from - 1e-6
        && hi <= r.from + Math.hypot(r.wall.end.x - r.wall.start.x, r.wall.end.z - r.wall.start.z) + 1e-6);
      return run ? { ...item, wallId: run.wall.id, offset: centre - run.from } : null;
    };
    const keepFen = list('fenestrations').map(f => (fens.has(f.id) ? null : placed(f, (Number(f.width) || 0) / 2)));
    const keepFix = list('fixtures').map(f => (fixes.has(f.id) ? null : placed(f, 0)));
    return {
      existing: {
        ...source,
        walls: list('walls').flatMap(wall => (walls.has(wall.id) ? []
          : split.has(wall.id) ? split.get(wall.id).runs.map(run => run.wall) : [wall])),
        fenestrations: keepFen.filter(Boolean),
        fixtures: keepFix.filter(Boolean),
      },
      demo: {
        walls: list('walls').filter(wall => walls.has(wall.id))
          .concat([...split.values()].flatMap(cut => cut.pieces)),
        fenestrations: list('fenestrations').filter((f, i) => !keepFen[i]),
        fixtures: list('fixtures').filter((f, i) => !keepFix[i]),
      },
    };
  };

  // ── OUTLINES, IN THE HOLOGRAM'S OWN FEET ──────────────────────────────────
  const wallThicknessFt = wall => {
    const types = window.DraftWallTypes.WALL_TYPES;
    return ((types.find(type => type.id === (wall?.wallType || 'stud_2x6')) || types[1]).totalIn / 12);
  };
  // The four corners of a wall's body, off its stored line and refLine.
  const wallCorners = wall => {
    const G = window.DraftGeometry2D;
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (!(len > 0)) return null;
    const nx = -dz / len, nz = dx / len;
    const { startOff, endOff } = G.wallFaceOffsets(wall, wallThicknessFt(wall));
    const at = (p, off) => ({ x: p.x + nx * off, z: p.z + nz * off });
    return [at(wall.start, startOff), at(wall.end, startOff), at(wall.end, endOff), at(wall.start, endOff)];
  };
  // What a demo pick or a dashed outline needs about each thing: its outline,
  // and a line to measure a click to.
  const shapes = (holo, items, levelId, view) => {
    const G = window.DraftGeometry2D;
    const FX = window.DraftFixtureGeometry;
    const sourceWalls = (holo.source?.walls || []).filter(wall => wall.levelId === levelId);
    const onView = item => item.levelId === levelId && (item.view || 'plan') === view;
    const out = [];
    items.walls.filter(onView).forEach(wall => {
      const corners = wallCorners(wall);
      if (corners) out.push({ kind: 'walls', id: wall.id, corners, line: [wall.start, wall.end],
        reach: wallThicknessFt(wall) / 2 });
    });
    items.fenestrations.filter(onView).forEach(opening => {
      const wall = sourceWalls.find(w => w.id === opening.wallId);
      const geo = wall && G.openingGeometry(opening, wall,
        { walls: sourceWalls, thicknessFt: wallThicknessFt, faceReferenced: false });
      if (geo) out.push({ kind: 'fenestrations', id: opening.id, corners: geo.corners,
        line: geo.glazing, reach: wallThicknessFt(wall) / 2 + 0.25 });
    });
    items.fixtures.filter(onView).forEach(fixture => {
      const geo = FX && FX.fixtureGeometry(sourceWalls, fixture);
      if (geo && geo.corners) out.push({ kind: 'fixtures', id: fixture.id, corners: geo.corners,
        line: null, reach: 0 });
    });
    return out;
  };

  // DASHED, in the ink the hologram is screened blue from, so a demo line is
  // the hologram's colour and goes on and off with it.
  const paintDemo = (ink, place, holo, split, levelId, view) => {
    const outlines = shapes(holo, split.demo, levelId, view);
    if (!outlines.length) return false;
    ink.save();
    ink.setLineDash([7, 5]);
    ink.lineWidth = 1.4;
    ink.strokeStyle = '#000';
    outlines.forEach(shape => {
      const pts = shape.corners.map(place);
      ink.beginPath();
      pts.forEach((p, i) => (i ? ink.lineTo(p.x, p.y) : ink.moveTo(p.x, p.y)));
      ink.closePath();
      ink.stroke();
      // A door or window: its glazing line too, so it reads as an opening.
      if (shape.kind === 'fenestrations' && shape.line) {
        const [a, b] = shape.line.map(place);
        ink.beginPath(); ink.moveTo(a.x, a.y); ink.lineTo(b.x, b.y); ink.stroke();
      }
    });
    ink.restore();
    return true;
  };

  // ── PAINTING: BLUE, ON ANY GROUND ─────────────────────────────────────────
  //
  // LIGHT BLUE, the colour MODEL.dc.html's BACKGROUND ghost already used, so
  // it cannot be read as the drawing's own ink. The painters draw in black on
  // the ground they are given; SCREEN with blue turns the black to blue, and
  // MULTIPLY by a pale blue turns a wall's white body pale blue -- screen
  // alone left it a white bar that read as the drawing's own wall. A dark
  // ground stays dark through both. The second canvas is the mask that keeps
  // the passes off the empty parts.
  //
  // DRAWN ON A CANVAS OF ITS OWN THE SIZE OF THE TARGET, under the target's
  // own transform, and laid back on with none -- so a clip the caller has set
  // (a LAYOUT viewport's window) still holds.
  const scratch = new WeakMap();
  const canvasesFor = target => {
    let pair = scratch.get(target);
    if (!pair) {
      pair = { ink: document.createElement('canvas'), mask: document.createElement('canvas') };
      scratch.set(target, pair);
    }
    [pair.ink, pair.mask].forEach(c => {
      if (c.width !== target.width || c.height !== target.height) {
        c.width = target.width; c.height = target.height;
      }
    });
    return pair;
  };
  const shown = saved => (Array.isArray(saved?.holograms) ? saved.holograms : []).filter(holo => !holo.hidden);

  // Paint every shown hologram of `saved` at `levelId`. `toS` is the caller's
  // feet-to-screen; env: { view, show: { existing, demo }, paperColor }.
  // Returns whether anything was drawn.
  const paint = (ctx, toS, saved, levelId, env = {}) => {
    const list = shown(saved);
    const LP = window.DraftLayoutPlan;
    const F = window.DraftDrawingFormat;
    if (!list.length || !LP || !F) return false;
    const show = { existing: true, demo: true, ...(env.show || {}) };
    if (!show.existing && !show.demo) return false;
    const { ink: inkCanvas, mask: maskCanvas } = canvasesFor(ctx.canvas);
    const w = inkCanvas.width, h = inkCanvas.height;
    const ink = inkCanvas.getContext('2d');
    ink.setTransform(1, 0, 0, 1, 0, 0);
    ink.globalCompositeOperation = 'source-over';
    ink.clearRect(0, 0, w, h);
    ink.setTransform(ctx.getTransform());
    const view = planViewFor(env.view);
    let drew = false;
    list.forEach(holo => {
      try {
        const place = pt => toS(F.hologramPoint(holo, pt));
        const split = parts(holo);
        if (show.existing) {
          drew = LP.drawPlan(ink, place, split.existing, levelId,
            { view, hologram: true, paperColor: env.paperColor || '#ffffff' }) || drew;
        }
        if (show.demo) drew = paintDemo(ink, place, holo, split, levelId, view || 'plan') || drew;
      } catch (error) {
        console.warn(`hologram ${holo.name || holo.id} could not be drawn`, error);
      }
    });
    if (!drew) return false;
    ink.setTransform(1, 0, 0, 1, 0, 0);
    const mask = maskCanvas.getContext('2d');
    mask.globalCompositeOperation = 'copy';
    mask.drawImage(inkCanvas, 0, 0);
    ink.globalCompositeOperation = 'screen';
    ink.fillStyle = BLUE;
    ink.fillRect(0, 0, w, h);
    ink.globalCompositeOperation = 'multiply';
    ink.fillStyle = PALE;
    ink.fillRect(0, 0, w, h);
    ink.globalCompositeOperation = 'destination-in';
    ink.drawImage(maskCanvas, 0, 0);
    ink.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= ALPHA;
    ctx.drawImage(inkCanvas, 0, 0);
    ctx.restore();
    return true;
  };

  // The shown holograms' walls where they are placed, for a caller framing
  // the drawing -- every level, or one.
  const framePoints = (saved, levelId = null) => {
    const F = window.DraftDrawingFormat;
    return shown(saved).flatMap(holo => (Array.isArray(holo.source?.walls) ? holo.source.walls : [])
      .filter(wall => levelId == null || wall?.levelId === levelId)
      .flatMap(wall => [wall?.start, wall?.end])
      .filter(pt => Number.isFinite(pt?.x) && Number.isFinite(pt?.z))
      .map(pt => F.hologramPoint(holo, pt)));
  };

  window.DraftHologram = Object.freeze({
    BLUE, PALE, ALPHA, VIEWS, planViewFor, parts, shapes, wallThicknessFt, paint, framePoints,
  });
})();
