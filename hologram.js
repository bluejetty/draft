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
  // ONE COLOUR PER FILE (Movie, 20 Oct: "i'd like a different color for each
  // new 'HOLOGRAM'" -- "1 per file (and 1 color per file)"). The blue first,
  // so a drawing with one file looks as it always did; each pair is the ink a
  // line turns and the pale a wall's body turns (see PAINTING below). A copy
  // is the same file, so it is the same colour. Shown on a blue HOLOGRAM; a
  // SUITE draws in the drawing's own inks.
  const COLOURS = Object.freeze([
    Object.freeze({ ink: BLUE, pale: PALE }),
    Object.freeze({ ink: 'rgb(222,140,60)', pale: 'rgb(244,214,184)' }),
    Object.freeze({ ink: 'rgb(84,178,104)', pale: 'rgb(196,232,204)' }),
    Object.freeze({ ink: 'rgb(186,96,196)', pale: 'rgb(232,204,238)' }),
    Object.freeze({ ink: 'rgb(206,182,48)', pale: 'rgb(240,232,184)' }),
    Object.freeze({ ink: 'rgb(56,176,176)', pale: 'rgb(188,232,232)' }),
    Object.freeze({ ink: 'rgb(214,92,92)', pale: 'rgb(242,200,200)' }),
  ]);
  // A FILE IS ITS NAME: the copies are named for the file they came from,
  // which is what REFRESH already reads as one block.
  const fileOf = holo => String(holo?.name || holo?.id || '');
  // Its colour: the one any of its copies was given when it came in, else
  // its place among the drawing's files, in the order they first appear.
  const colourIndex = (holo, saved) => {
    const all = Array.isArray(saved?.holograms) ? saved.holograms : [];
    const key = fileOf(holo);
    const given = [holo, ...all.filter(h => fileOf(h) === key)]
      .find(h => Number.isInteger(h?.colour) && h.colour >= 0);
    if (given) return given.colour % COLOURS.length;
    const files = [];
    all.forEach(h => { const k = fileOf(h); if (!files.includes(k)) files.push(k); });
    return Math.max(0, files.indexOf(key)) % COLOURS.length;
  };
  const colourOf = (holo, saved) => COLOURS[colourIndex(holo, saved)];
  // The colour a file coming in takes: the first no file here has.
  const nextColour = saved => {
    const taken = new Set((Array.isArray(saved?.holograms) ? saved.holograms : []).map(h => colourIndex(h, saved)));
    for (let i = 0; i < COLOURS.length; i += 1) if (!taken.has(i)) return i;
    return taken.size % COLOURS.length;
  };

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
  // ── WHICH FLOOR OF THE SHELL (Movie, 18 Oct: "we might want the same suite
  // on different floors" -- "make the ability to copy the suite floor to
  // floor easily and match up") ─────────────────────────────────────────
  //
  // `levelMap` is the suite's own levels to this drawing's: { 3: 5 } puts a
  // suite drawn on MAIN FL onto 2ND FL, and a two-storey suite's both floors
  // go up together ({ 3: 5, 5: 9 }). Absent, every level is its own id, as a
  // hologram has always been. A level mapped to nothing is not shown. What
  // every painter reads, so plan, elevation, the shell's windows and the
  // snap all move with it.
  const levelsMoved = holo => {
    const source = holo?.source || {};
    const map = holo?.levelMap;
    if (!map || typeof map !== 'object' || !Object.keys(map).length) return source;
    const to = id => (Object.prototype.hasOwnProperty.call(map, String(id)) ? map[String(id)] : id);
    const out = { ...source };
    Object.keys(source).forEach(key => {
      const list = source[key];
      if (key === 'levels' || !Array.isArray(list)) return;
      if (!list.some(item => item && typeof item === 'object' && 'levelId' in item)) return;
      out[key] = list.map(item => {
        if (!item || typeof item !== 'object' || !('levelId' in item)) return item;
        const levelId = to(item.levelId);
        return levelId == null ? null : { ...item, levelId };
      }).filter(Boolean);
    });
    return out;
  };

  const parts = holo => {
    const source = levelsMoved(holo);
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
  // ── A SUITE: NORMAL COLOURS, AND ITS WINDOWS IN THE SHELL'S WALL ─────────
  //
  // Movie, 18 Oct, building the SHELL and saving each SUITE as its own .draft:
  // "can we have an option where it is shaded the normal colors but NOT
  // editable from the 'SHELL BUILDING' file except to MOVE, COPY or FLIP etc"
  // -- and "CUT THE HOLES for the WINDOWS in the SUITES in the proper
  // locations on the SHELL ... all the FENSTRATIONS from the SUITE exterior
  // wall will 'OVERRIDE' the SOLID SHELL wall", "as long as it will look
  // normal without having the 2 walls overlapping".
  //
  // SO A SUITE WALL WHOSE BOTH FACES LINE UP WITH A SHELL WALL'S, lying
  // wholly along it, is the shell's wall: the suite's copy is not drawn, and
  // its doors and windows are handed to the shell wall at the same spot.
  // The shell wall stays the one real wall -- its type, its siding. Where a
  // shell opening and a suite opening land on the same stretch, BOTH are
  // drawn and the clash is reported ("Show both + warn").
  const isSuite = holo => holo?.mode === 'suite';
  const FACE_TOL_FT = 0.02;        // a quarter inch: faces "line up"
  // AND A FOOT AT THE ENDS (Movie, 20 Oct: "if i go past the corner a bit it
  // doesn't allow to switch the windows, can we allow it to change the
  // windows even if its up to 1ft off (not alligned) at the sides"). The faces
  // must still line up to the quarter inch; along the shell wall, the suite's
  // wall may run up to a foot past either end of it.
  const SIDE_TOL_FT = 1;
  const wallFrame = wall => {
    const G = window.DraftGeometry2D;
    if (!wall?.start || !wall?.end) return null;
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (!(len > 1e-6)) return null;
    const u = { x: dx / len, z: dz / len }, n = { x: -u.z, z: u.x };
    const { startOff, endOff } = G.wallFaceOffsets(wall, wallThicknessFt(wall));
    return { wall, s: wall.start, u, n, len, faces: [startOff, endOff] };
  };
  const dot = (a, b) => a.x * b.x + a.z * b.z;
  // How far the suite wall's faces sit from the host's, across the host: the
  // two gaps, low face to low face and high to high.
  const faceGaps = (sf, hf) => {
    const across = dot({ x: sf.s.x - hf.s.x, z: sf.s.z - hf.s.z }, hf.n);
    const turn = dot(sf.n, hf.n);
    const S = sf.faces.map(o => across + o * turn).sort((a, b) => a - b);
    const Hs = hf.faces.slice().sort((a, b) => a - b);
    return [Hs[0] - S[0], Hs[1] - S[1]];
  };
  const parallel = (sf, hf) => Math.abs(sf.u.x * hf.u.z - sf.u.z * hf.u.x) < 1e-4;
  // Where the suite wall runs along the host, in feet from the host's start.
  const alongHost = (sf, hf) => {
    const a = dot({ x: sf.s.x - hf.s.x, z: sf.s.z - hf.s.z }, hf.u);
    const dir = dot(sf.u, hf.u) >= 0 ? 1 : -1;
    return { a, dir, lo: Math.min(a, a + dir * sf.len), hi: Math.max(a, a + dir * sf.len) };
  };
  const hostWalls = saved => (Array.isArray(saved?.walls) ? saved.walls : []);
  const shared = saved => {
    const out = { openings: [], hidden: new Map(), clashes: [] };
    const suites = shown(saved).filter(isSuite);
    if (!suites.length || !window.DraftGeometry2D || !window.DraftWallTypes) return out;
    const hosts = hostWalls(saved).map(wallFrame).filter(Boolean);
    suites.forEach(holo => {
      const split = parts(holo);
      const walls = placed(holo, { walls: split.existing.walls || [] }).walls;
      const fens = placed(holo, { fenestrations: split.existing.fenestrations || [] }).fenestrations;
      const hidden = new Set();
      walls.forEach(wall => {
        const sf = wallFrame(wall);
        if (!sf) return;
        const hf = hosts.find(h => h.wall.levelId === wall.levelId && parallel(sf, h)
          && faceGaps(sf, h).every(g => Math.abs(g) < FACE_TOL_FT)
          && (() => { const r = alongHost(sf, h); return r.lo > -SIDE_TOL_FT && r.hi < h.len + SIDE_TOL_FT; })());
        if (!hf) return;
        hidden.add(wall.id);
        const { a, dir } = alongHost(sf, hf);
        fens.filter(o => o && o.wallId === wall.id).forEach(o => {
          // AN OPENING'S OFFSET IS ITS MIDDLE (clampOpeningToWall), so it
          // maps straight across, whichever way the two walls run.
          const offset = Math.max(0, a + dir * o.offset);
          const flipped = dir < 0;
          out.openings.push({ ...o, id: `${holo.id}:${o.id}`, wallId: hf.wall.id, levelId: hf.wall.levelId,
            offset, suite: holo.id,
            ...(flipped && o.type === 'door' ? { hingeFlip: o.hingeFlip !== true } : {}),
            ...(flipped ? { swingFlip: o.swingFlip !== true } : {}) });
        });
      });
      if (hidden.size) out.hidden.set(holo.id, hidden);
    });
    // THE CLASH: a suite opening over a shell opening, or over another
    // suite's, on the same wall.
    const own = Array.isArray(saved?.fenestrations) ? saved.fenestrations : [];
    const span = o => [Number(o.offset) || 0, (Number(o.offset) || 0) + (Number(o.width) || 0)];
    const overlaps = (p, q) => { const [a, b] = span(p), [c, d] = span(q); return Math.min(b, d) - Math.max(a, c) > 1e-3; };
    out.openings.forEach((o, i) => {
      own.filter(h => h && String(h.wallId) === String(o.wallId) && overlaps(o, h))
        .forEach(h => out.clashes.push({ wallId: o.wallId, suite: o, other: h }));
      out.openings.slice(i + 1).filter(p => p.wallId === o.wallId && p.suite !== o.suite && overlaps(o, p))
        .forEach(p => out.clashes.push({ wallId: o.wallId, suite: o, other: p }));
    });
    return out;
  };
  // THE SNAP (Movie, 18 Oct: "when they go close to lining them up it snaps
  // to make it easy for them"). While a suite is dragged, each of its walls
  // on this level that runs beside a shell wall of the same thickness, faces
  // within `reachFt` of lining up and the two overlapping along their length,
  // offers the slide across the shell wall that lines them up. The nearest
  // is taken, then the nearest across a second direction, so a suite in a
  // corner of the shell lines up both ways. Returns the slide, { x, z }.
  const suiteSnap = (saved, holo, levelId, reachFt = 0.5) => {
    const none = { x: 0, z: 0 };
    if (!isSuite(holo) || !window.DraftGeometry2D || !window.DraftWallTypes) return none;
    const hosts = hostWalls(saved).filter(w => w?.levelId === levelId).map(wallFrame).filter(Boolean);
    const walls = placed(holo, { walls: (parts(holo).existing.walls || []).filter(w => w?.levelId === levelId) }).walls;
    const offers = [];
    walls.map(wallFrame).filter(Boolean).forEach(sf => hosts.forEach(hf => {
      if (!parallel(sf, hf)) return;
      const [g0, g1] = faceGaps(sf, hf);
      if (Math.abs(g0 - g1) > FACE_TOL_FT || Math.abs(g0) > reachFt) return;
      const r = alongHost(sf, hf);
      if (Math.min(r.hi, hf.len) - Math.max(r.lo, 0) <= FACE_TOL_FT) return;
      offers.push({ n: hf.n, d: (g0 + g1) / 2 });
    }));
    if (!offers.length) return none;
    offers.sort((p, q) => Math.abs(p.d) - Math.abs(q.d));
    const first = offers[0];
    const second = offers.find(o => Math.abs(o.n.x * first.n.z - o.n.z * first.n.x) > 0.5);
    const out = { x: first.n.x * first.d, z: first.n.z * first.d };
    if (second) {
      // The second slide, less what the first already moved along it.
      const left = second.d - (out.x * second.n.x + out.z * second.n.z);
      const t = { x: -first.n.z, z: first.n.x };
      const k = t.x * second.n.x + t.z * second.n.z;
      if (Math.abs(k) > 1e-6) { out.x += t.x * left / k; out.z += t.z * left / k; }
    }
    return out;
  };
  // WHAT A DRAGGED SUITE IS BESIDE (Movie, 18 Oct: "the wall alignement snap
  // should light up the walls when they are close enough for auto snap
  // allignment and then show where the windows ard doors are"). Each shell
  // wall on this level a suite wall runs beside, faces within `reachFt`:
  // whether both faces line up (it will cut), or the two are not one
  // thickness and never can.
  const suiteNear = (saved, holo, levelId, reachFt = 0.5) => {
    if (!isSuite(holo) || !window.DraftGeometry2D || !window.DraftWallTypes) return [];
    const hosts = hostWalls(saved).filter(w => w?.levelId === levelId).map(wallFrame).filter(Boolean);
    const walls = placed(holo, { walls: (parts(holo).existing.walls || []).filter(w => w?.levelId === levelId) }).walls;
    const out = [];
    walls.map(wallFrame).filter(Boolean).forEach(sf => hosts.forEach(hf => {
      if (!parallel(sf, hf)) return;
      const [g0, g1] = faceGaps(sf, hf);
      if (Math.min(Math.abs(g0), Math.abs(g1)) > reachFt) return;
      const r = alongHost(sf, hf);
      if (Math.min(r.hi, hf.len) - Math.max(r.lo, 0) <= FACE_TOL_FT) return;
      if (out.some(o => o.host === hf.wall && o.lined)) return;
      out.push({ host: hf.wall, wall: sf.wall,
        lined: Math.abs(g0) < FACE_TOL_FT && Math.abs(g1) < FACE_TOL_FT,
        sameThickness: Math.abs(g0 - g1) < FACE_TOL_FT,
        suiteIn: wallThicknessFt(sf.wall) * 12, shellIn: wallThicknessFt(hf.wall) * 12 });
    }));
    return out;
  };
  // A SUITE'S SUPER NODES, where the hologram's placement puts them (Movie,
  // 20 Oct: "place them on the corners of the suites where they will attach
  // to the other SUPER NODES"), on this level. Any hologram's, in fact: a
  // blue one's are read too, so the page can say it would have caught.
  const suiteSuperNodes = (holo, levelId) => {
    const existing = parts(holo).existing;
    const own = (existing.superNodes || []).filter(n => n?.point && Number(n.levelId) === Number(levelId));
    if (own.length) return placed(holo, { superNodes: own }).superNodes;
    const auto = (isSuite(holo) || isSuiteFile(holo)) ? cornerSuperNodes(existing.walls, levelId) : [];
    return auto.length ? placed(holo, { superNodes: auto }).superNodes : [];
  };
  // A SUITE'S CORNERS ARE ITS SUPER NODES UNTIL HE PLACES HIS OWN (Movie, 20
  // Oct: "auto place those on the SUITES at the furthest corners of the
  // 'SUITE how the user draws it make a RECTAGLE shape that contains it" --
  // "but we wil maybe need the to be placed manually or moved too afterwards
  // by the user for unique suite situations"). The rectangle that holds every
  // wall of the floor, out to the walls' outside faces, in the suite's own
  // frame -- so it turns and mirrors with the hologram. Any super node drawn
  // in the suite's own file replaces all four.
  const cornerSuperNodes = (walls, levelId) => {
    const pts = (walls || []).filter(w => Number(w?.levelId) === Number(levelId))
      .flatMap(w => wallCorners(w) || []);
    if (pts.length < 2) return [];
    const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) return [];
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z], i) => ({
      id: `corner-${i + 1}`, levelId: Number(levelId), view: 'plan', point: { x, y: 0, z }, auto: true }));
  };
  // A suite's own plan less the walls the shell has taken, and their openings.
  const suiteExisting = (holo, existing, info) => {
    const gone = info?.hidden.get(holo.id);
    if (!gone || !gone.size) return existing;
    return { ...existing,
      walls: (existing.walls || []).filter(w => !gone.has(w.id)),
      fenestrations: (existing.fenestrations || []).filter(o => !gone.has(o.wallId)) };
  };
  // The openings the shell's walls carry from the suites placed on them --
  // what every painter of the shell adds to its own.
  const hostOpenings = saved => shared(saved).openings;
  const clashes = saved => shared(saved).clashes;

  // What a demo pick or a dashed outline needs about each thing: its outline,
  // and a line to measure a click to.
  const shapes = (holo, items, levelId, view) => {
    const G = window.DraftGeometry2D;
    const FX = window.DraftFixtureGeometry;
    const sourceWalls = (levelsMoved(holo).walls || []).filter(wall => wall.levelId === levelId);
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
  // ── A HOLOGRAM'S OWN HOLOGRAMS COME WITH IT (Movie, 18 Oct: "i put a
  // HOLOGRAM of SUITE S into the PHASE 1, and then i saved it and i loaded the
  // PHASE 1 into PHASE 2 and the SUITE HOLOGRAMS didn't show. we need those to
  // also show as part of the PHASE 1 hologram") ────────────────────────────
  //
  // WHAT IS DRAWN, not what is listed: the card still shows PHASE 1 as one
  // hologram, moved and turned as one. Each hologram inside it is drawn as
  // part of it -- placed where PHASE 1 put it, then wherever PHASE 1 is put
  // here -- and PHASE 1's shell wears its suites' windows, with the suite
  // walls that are the shell's own left out, exactly as PHASE 1 drew them.
  // In PHASE 1's own colours here: what came in with it is existing work.
  // As deep as the files go: a suite holding a hologram brings that too.
  const drawn = (saved, depth = 0) => shown(saved).flatMap(holo => {
    const src = holo?.source || {};
    if (depth > 4 || !shown(src).length) return [holo];
    const own = shared(src);
    const outer = { ...holo, source: { ...src, holograms: [],
      fenestrations: [...(Array.isArray(src.fenestrations) ? src.fenestrations : []), ...own.openings] } };
    const inner = drawn(src, depth + 1).map(child => {
      const moved = placed(child, levelsMoved(child));
      const hidden = own.hidden.get(child.id);
      if (hidden && Array.isArray(moved.walls)) moved.walls = moved.walls.filter(w => !hidden.has(w.id));
      return { ...holo, id: `${holo.id}/${child.id}`, demo: child.demo, source: moved, nested: true };
    });
    return [outer, ...inner];
  });

  // A page ground darker than mid-grey is a NIGHT page.
  const darkGround = color => {
    const m = String(color || '').match(/^#([0-9a-f]{6})$/i)
      || null;
    let r, g, b;
    if (m) { const v = parseInt(m[1], 16); r = v >> 16; g = (v >> 8) & 255; b = v & 255; } else {
      const c = String(color || '').match(/\d+(\.\d+)?/g);
      if (!c || c.length < 3) return false;
      [r, g, b] = c.map(Number);
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
  };
  // SUITES IN NORMAL COLOURS. The plan painter draws a sheet's black on
  // white; on a night page that black is turned over to the page's light ink
  // (an invert through the scratch canvas), so a suite reads as drawing, not
  // as the blue of an existing house.
  const paintSuites = (ctx, toS, list, info, levelId, view, env) => {
    const LP = window.DraftLayoutPlan;
    const F = window.DraftDrawingFormat;
    const night = darkGround(env.paperColor);
    const { ink: inkCanvas } = canvasesFor(ctx.canvas);
    const w = inkCanvas.width, h = inkCanvas.height;
    const ink = inkCanvas.getContext('2d');
    ink.setTransform(1, 0, 0, 1, 0, 0);
    ink.globalCompositeOperation = 'source-over';
    ink.clearRect(0, 0, w, h);
    ink.setTransform(ctx.getTransform());
    let drew = false;
    list.forEach(holo => {
      try {
        const place = pt => toS(F.hologramPoint(holo, pt));
        const existing = suiteExisting(holo, parts(holo).existing, info);
        drew = LP.drawPlan(ink, place, existing, levelId,
          { view, hologram: true, paperColor: night ? '#ffffff' : (env.paperColor || '#ffffff') }) || drew;
      } catch (error) {
        console.warn(`suite ${holo.name || holo.id} could not be drawn`, error);
      }
    });
    if (drew) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (night) ctx.filter = 'invert(1)';
      ctx.drawImage(inkCanvas, 0, 0);
      ctx.restore();
    }
    // The scratch handed back empty: the blue pass draws on it next.
    ink.setTransform(1, 0, 0, 1, 0, 0);
    ink.clearRect(0, 0, w, h);
    ink.setTransform(ctx.getTransform());
    return drew;
  };

  // Paint every shown hologram of `saved` at `levelId`. `toS` is the caller's
  // feet-to-screen; env: { view, show: { existing, demo }, paperColor }.
  // Returns whether anything was drawn.
  const paint = (ctx, toS, saved, levelId, env = {}) => {
    const list = drawn(saved);
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
    const info = shared(saved);
    // THE SUITES FIRST, straight onto the target in the drawing's own inks.
    const suiteDrew = list.some(isSuite) && show.existing
      ? paintSuites(ctx, toS, list.filter(isSuite), info, levelId, view, env) : false;
    // ONE PASS PER COLOUR: each file's holograms drawn, tinted its colour
    // through the mask, laid on, and the scratch cleared for the next.
    const groups = new Map();
    list.filter(holo => !isSuite(holo)).forEach(holo => {
      const i = colourIndex(holo, saved);
      if (!groups.has(i)) groups.set(i, []);
      groups.get(i).push(holo);
    });
    let any = false;
    groups.forEach((group, i) => {
      const colour = COLOURS[i];
      let drew = false;
      ink.setTransform(1, 0, 0, 1, 0, 0);
      ink.globalCompositeOperation = 'source-over';
      ink.clearRect(0, 0, w, h);
      ink.setTransform(ctx.getTransform());
      group.forEach(holo => {
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
      if (!drew) return;
      any = true;
      ink.setTransform(1, 0, 0, 1, 0, 0);
      const mask = maskCanvas.getContext('2d');
      mask.globalCompositeOperation = 'copy';
      mask.drawImage(inkCanvas, 0, 0);
      ink.globalCompositeOperation = 'screen';
      ink.fillStyle = colour.ink;
      ink.fillRect(0, 0, w, h);
      ink.globalCompositeOperation = 'multiply';
      ink.fillStyle = colour.pale;
      ink.fillRect(0, 0, w, h);
      ink.globalCompositeOperation = 'destination-in';
      ink.drawImage(maskCanvas, 0, 0);
      ink.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha *= ALPHA;
      ctx.drawImage(inkCanvas, 0, 0);
      ctx.restore();
    });
    return any || suiteDrew;
  };

  // The shown holograms' walls where they are placed, for a caller framing
  // the drawing -- every level, or one.
  const framePoints = (saved, levelId = null) => {
    const F = window.DraftDrawingFormat;
    return drawn(saved).flatMap(holo => (Array.isArray(levelsMoved(holo).walls) ? levelsMoved(holo).walls : [])
      .filter(wall => levelId == null || wall?.levelId === levelId)
      .flatMap(wall => [wall?.start, wall?.end])
      .filter(pt => Number.isFinite(pt?.x) && Number.isFinite(pt?.z))
      .map(pt => F.hologramPoint(holo, pt)));
  };

  // ── ELEVATIONS AND SECTIONS (hologram PR 5) ──────────────────────────────
  //
  // The cut painter reads a drawing in its own feet, so the hologram goes in
  // MOVED: every point of the copy (anything carrying an x and a z) through
  // its placement. Lengths along a wall -- an opening's offset, a piece's
  // run -- do not move, and a turn does not change them.
  //
  // A MIRRORED HOLOGRAM TURNS ITS RECORDS OVER TOO (17 Oct). Its points go
  // through the mirror like any other, but a wall keeps start and end, so
  // the left of its line is now its right: a face line, a fixture's side and
  // a door's swing are all named by that left, and each is flipped so the
  // cut painter stands them where the plan shows them.
  const placed = (holo, value) => {
    const F = window.DraftDrawingFormat;
    const walk = v => {
      if (Array.isArray(v)) return v.map(walk);
      if (!v || typeof v !== 'object') return v;
      const out = {};
      Object.keys(v).forEach(key => { out[key] = walk(v[key]); });
      if (Number.isFinite(v.x) && Number.isFinite(v.z)) {
        const p = F.hologramPoint(holo, v);
        out.x = p.x; out.z = p.z;
      }
      return out;
    };
    const moved = walk(value);
    if (holo?.flip !== true || !moved || typeof moved !== 'object' || Array.isArray(moved)) return moved;
    const other = { left: 'right', right: 'left' };
    if (Array.isArray(moved.walls)) {
      moved.walls = moved.walls.map(w => (w && other[w.refLine] ? { ...w, refLine: other[w.refLine] } : w));
    }
    if (Array.isArray(moved.fixtures)) {
      moved.fixtures = moved.fixtures.map(f => (f && Number.isFinite(f.side) ? { ...f, side: -f.side } : f));
    }
    if (Array.isArray(moved.fenestrations)) {
      moved.fenestrations = moved.fenestrations.map(o => (o ? { ...o, swingFlip: o.swingFlip !== true } : o));
    }
    return moved;
  };
  // A raster dash: a fine checker knocked out of a pass breaks every line in
  // it, whatever its slope -- the cut painter strokes solid, and DEMO reads
  // dashed on every other drawing of the set.
  let checker = null;
  const dashPattern = ctx => {
    if (!checker) {
      checker = document.createElement('canvas');
      checker.width = checker.height = 8;
      const c = checker.getContext('2d');
      c.fillStyle = '#000';
      c.fillRect(0, 0, 4, 4);
      c.fillRect(4, 4, 4, 4);
    }
    return ctx.createPattern(checker, 'repeat');
  };
  // Paint every shown hologram of `saved` into an elevation or section, in
  // that drawing's frame -- called from the cut painter's `opts.underlay`,
  // after its ground and before its own lines, so the new work is drawn over
  // the existing house and hides what stands behind it. env:
  // { show: { existing, demo }, paperColor }.
  // ── A SUITE TAKES THE FLOOR'S HEIGHTS ─────────────────────────────────────
  //
  // Movie, 20 Oct: "the HEIGHTS won't really need to be determined until it
  // is place onto a plan and it will take the floor and ceiling height and
  // fit itself into that height". The floors it stands on are the shell's,
  // and so are the numbers that stack them: each floor's wall height and
  // floor package (levelAssemblies), a split's row (sectionTable, buildType)
  // and the foundation's attachment. Its own file's levels fill in only a
  // floor the shell has none of. A wall's top in a cut is its storey's, so
  // handing the env these is the whole fit -- no wall is rewritten.
  const SHELL_HEIGHT_KEYS = ['levelAssemblies', 'sectionTable', 'buildType', 'zoneHeights',
    'foundationAttachment', 'foundationAttachmentIn', 'foundationLadderIn', 'elevationDatum'];
  const shellHeights = saved => {
    const out = {};
    SHELL_HEIGHT_KEYS.forEach(key => { out[key] = saved?.[key]; });
    return out;
  };
  const shellLevels = (holo, saved) => {
    const F = window.DraftDrawingFormat;
    const source = holo.source || {};
    const own = F.levels ? F.levels(source.levels) : (source.levels || []);
    const host = F.levels ? F.levels(saved.levels) : (saved.levels || []);
    return [...host, ...own.filter(l => !host.some(hl => hl.id === l.id))];
  };
  // A FILE MADE AS A SUITE (RESIDENTIAL / COMMERCIAL, 20 Oct) fits the floor
  // even while it is still a blue hologram.
  const isSuiteFile = holo => Boolean(window.DraftDrawingFormat?.suiteKind?.(holo?.source?.suiteKind));

  // IN FRONT OR BEHIND, FROM WHERE THIS ELEVATION STANDS (Movie, 21 Oct: the
  // PHASE 1 hologram's roof "doesn't show in the E1 top layer position").
  // A hologram goes down under the drawing, which is right while it stands
  // behind; from E1 PHASE 1 is the NEARER building, and the PHASE 2 gable
  // painted over it left only its eaves and a sliver of hip. So each hologram
  // is weighed whole: every point of it at least as near the viewer (the
  // +dirVec side) as the drawing's nearest wall, give or take a wall's
  // thickness where the two meet, and it goes on OVER the building. A suite
  // inside the shell is never wholly in front of it, so it stays under.
  const FRONT_TOL_FT = 2;
  const nearSpan = (walls, cut) => {
    const d = cut.dirVec, o = cut.startPt;
    let lo = Infinity, hi = -Infinity;
    walls.forEach(wall => [wall?.start, wall?.end].forEach(p => {
      if (!p) return;
      const v = (p.x - o.x) * d.x + (p.z - o.z) * d.z;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }));
    return lo <= hi ? { lo, hi } : null;
  };
  const standsInFront = (holo, saved, cut) => {
    if (!cut?.dirVec || !cut?.startPt) return false;
    const own = nearSpan((saved?.walls || []).filter(wall => Number(wall?.levelId) >= 0), cut);
    const it = nearSpan(placed(holo, parts(holo).existing.walls || []), cut);
    return Boolean(own && it && it.lo >= own.hi - FRONT_TOL_FT);
  };

  const paintCut = (ctx, w, h, cut, saved, frame, env = {}) => {
    // A HOLOGRAM'S OWN SUITES BEFORE ITS SHELL (Movie, 20 Oct: "the EXT
    // WALL isn't showing ... only showing up on the HOLOGRAM that has a
    // HOLOGRAM SHELL - phase 1 and also the SUITES within that shell" -- "it
    // is working in the CURRENT PHASE 2"). Each elevation pass paints its own
    // faces over what is under it, so the shell has to go on last, over its
    // suites, the order this drawing's own shell takes over its suites: drawn
    // shell-first, a suite's back and side walls painted over the shell's
    // front face and left it a bare outline round its windows.
    // `env.front`: true paints only the holograms standing in front, false
    // only those behind; a nested one goes with the hologram it came in.
    const front = new Set(shown(saved).filter(holo => standsInFront(holo, saved, cut)).map(holo => String(holo.id)));
    const top = holo => String(holo.id).split('/')[0];
    const all = drawn(saved).filter(holo => env.front == null || front.has(top(holo)) === env.front);
    const list = [...all.filter(holo => holo.nested), ...all.filter(holo => !holo.nested)];
    const CV = window.DraftCutView;
    const CE = window.DraftCutViewEnv;
    const F = window.DraftDrawingFormat;
    if (!list.length || !CV || !CE || !F || !frame || !cut) return false;
    const show = { existing: true, demo: true, ...(env.show || {}) };
    if (!show.existing && !show.demo) return false;
    const { ink: inkCanvas, mask: maskCanvas } = canvasesFor(ctx.canvas);
    const W = inkCanvas.width, H = inkCanvas.height;
    const ink = inkCanvas.getContext('2d');
    const extra = maskCanvas.getContext('2d');
    const clear = c => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, W, H);
      c.setTransform(ctx.getTransform());
    };
    clear(ink);
    const paperColor = env.paperColor || '#ffffff';
    // In the drawing's own inks, so a night page gets night faces.
    const pass = { hologram: true, frame, paperColor, ...(env.colors ? { colors: env.colors } : {}) };
    let drew = false;
    const info = shared(saved);
    // A SUITE IN THE DRAWING'S OWN INKS, straight onto the target, less the
    // walls the shell has taken (their windows come with the shell's).
    let suiteDrew = false;
    if (show.existing) {
      list.filter(isSuite).forEach(holo => {
        try {
          // THE SHELL'S HEIGHTS: a suite stands on the shell's floor, at the
          // shell's elevation -- its own file's levels fill in only what the
          // shell has none of.
          const levels = shellLevels(holo, saved);
          const cutEnv = CE.buildCutViewEnv(
            { ...placed(holo, suiteExisting(holo, parts(holo).existing, info)), ...shellHeights(saved) }, levels);
          if (cutEnv) { CV.drawCutView(cutEnv, ctx, w, h, cut, pass); suiteDrew = true; }
        } catch (error) {
          console.warn(`suite ${holo.name || holo.id} could not be drawn in ${cut.name}`, error);
        }
      });
    }
    list.filter(holo => !isSuite(holo)).forEach(holo => {
      try {
        const split = parts(holo);
        const source = holo.source || {};
        // A SUITE FILE STILL BLUE fits the floor it is stood on all the same.
        const fits = isSuiteFile(holo);
        const levels = fits ? shellLevels(holo, saved)
          : (F.levels ? F.levels(source.levels) : (source.levels || []));
        const heights = fits ? shellHeights(saved) : {};
        if (show.existing) {
          const cutEnv = CE.buildCutViewEnv({ ...placed(holo, split.existing), ...heights }, levels);
          if (cutEnv) { CV.drawCutView(cutEnv, ink, w, h, cut, pass); drew = true; }
        }
        const out = split.demo;
        if (show.demo && (out.walls.length || out.fenestrations.length)) {
          // The demo parts alone, dashed, then laid onto the ink.
          clear(extra);
          const demoEnv = CE.buildCutViewEnv({ ...placed(holo, { ...source, walls: out.walls,
            fenestrations: out.fenestrations, fixtures: out.fixtures, roofs: [], floors: [] }), ...heights }, levels);
          if (demoEnv) {
            CV.drawCutView(demoEnv, extra, w, h, cut, pass);
            extra.setTransform(1, 0, 0, 1, 0, 0);
            extra.globalCompositeOperation = 'destination-out';
            extra.fillStyle = dashPattern(extra);
            extra.fillRect(0, 0, W, H);
            extra.globalCompositeOperation = 'source-over';
            ink.save();
            ink.setTransform(1, 0, 0, 1, 0, 0);
            ink.drawImage(maskCanvas, 0, 0);
            ink.restore();
            drew = true;
          }
        }
      } catch (error) {
        console.warn(`hologram ${holo.name || holo.id} could not be drawn in ${cut.name}`, error);
      }
    });
    if (!drew) return suiteDrew;
    // Tint, through the mask, exactly as the plan does.
    ink.setTransform(1, 0, 0, 1, 0, 0);
    extra.setTransform(1, 0, 0, 1, 0, 0);
    extra.globalCompositeOperation = 'copy';
    extra.drawImage(inkCanvas, 0, 0);
    extra.globalCompositeOperation = 'source-over';
    ink.globalCompositeOperation = 'screen';
    ink.fillStyle = BLUE;
    ink.fillRect(0, 0, W, H);
    ink.globalCompositeOperation = 'multiply';
    ink.fillStyle = PALE;
    ink.fillRect(0, 0, W, H);
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

  // The cut painter's options for a drawing that may carry a hologram: its
  // `underlay` and, with NEW off, `underlayOnly`. Nothing at all when there
  // is no hologram to show, so a plain drawing paints exactly as before.
  const cutOptions = (ctx, w, h, cut, saved, env = {}) => {
    if (!drawn(saved).length) return {};
    const show = { existing: true, demo: true, new: true, ...(env.show || {}) };
    return {
      underlay: frame => paintCut(ctx, w, h, cut, saved, frame, { ...env, show, front: frame?.section ? null : false }),
      overlay: frame => paintCut(ctx, w, h, cut, saved, frame, { ...env, show, front: true }),
      ...(show.new ? {} : { underlayOnly: true }),
    };
  };

  window.DraftHologram = Object.freeze({
    BLUE, PALE, ALPHA, VIEWS, COLOURS, colourOf, colourIndex, nextColour, fileOf,
    planViewFor, parts, shapes, wallThicknessFt, paint, framePoints,
    placed, paintCut, cutOptions, standsInFront, isSuite, shared, hostOpenings, clashes, suiteSnap, levelsMoved, suiteNear,
    drawn, suiteSuperNodes,
  });
})();
