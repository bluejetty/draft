// TOY — the game (Movie, 27 Oct 2026).
//
// "i am thinking of changing things and not having TOY MODE. i was thinking
// of using this program to create a 2nd program with only TOY MODE, and make
// a very simplistic GAME version of this programs" -- "and then if they
// create a house in the TOY MODE 'game' they can bring it over to this
// program and do more detailed work if they want".
//
// STEP 1 OF THE SPLIT PLAN: square walls on the whole foot, SAVE and OPEN.
// The test of done is the bridge -- a house drawn here opens in MODEL.
//
// ONE GRID, NO SNAP RULES. Every point TOY makes lands on the 1' grid: the
// first press rounds to it, and each next point is squared to the last and
// its length rounded to the whole foot, which from a grid point lands on the
// grid again. So the ends of every wall are grid points, a wall end is always
// exactly where the next run can start, and the game needs none of MODEL's
// snap reaches, rings or magnets -- the grid IS the snap.
//
// THE FILE IS MODEL'S. A wall here is the record MODEL writes for a centre-
// line 2x6 on MAIN FL, the levels are MODEL's blank five, and the board is
// written 'toy'. Nothing in the file is the game's own, so the bridge needs
// no translation on either side.
(() => {
  const WT = window.DraftWallTypes;
  const FORMAT = window.DraftDrawingFormat;

  // MODEL's blank drawing (model/17-boot-save.js BLANK_LEVELS), so a house
  // from here opens on the same storeys a NEW drawing in MODEL has.
  const LEVELS = [
    { id: 8, name: 'SITE', elev: 0, visible: true },
    { id: 7, name: 'ROOF', elev: 18, visible: true },
    { id: 5, name: '2ND FL', elev: 9, visible: true },
    { id: 3, name: 'MAIN FL', elev: 0, visible: true },
    { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
  ];
  const MAIN_FL = 3;
  const WALL_TYPE = 'stud_2x6';
  const WALL_IN = (WT.WALL_TYPES.find(type => type.id === WALL_TYPE) || { totalIn: 5.5 }).totalIn;
  const STORE_KEY = 'draft-toy-game-v1';

  const canvas = document.getElementById('plan');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);

  // ── the house ──────────────────────────────────────────────────────────
  let walls = [];
  let nextId = 1;
  let run = null;          // the last point of the run being drawn, or null
  let runStart = null;     // where that run began: pressing it again closes
  let hover = null;        // where the next press would land
  const history = [];      // walls before each change, for UNDO

  const P = (x, z) => ({ x, y: 0, z });
  const same = (a, b) => !!a && !!b && a.x === b.x && a.z === b.z;
  const wallOf = (a, b) => ({
    id: `toy-${nextId++}`, levelId: MAIN_FL, view: 'plan',
    wallType: WALL_TYPE, refLine: 'center', start: P(a.x, a.z), end: P(b.x, b.z),
  });

  // ── where a press lands ─────────────────────────────────────────────────
  // The first point: the nearest grid point. Every next point: square to the
  // last (the longer of the two runs wins), a whole number of feet, at least
  // one -- a run rounded to nothing would be a wall of no length.
  // `+ 0` folds the -0 that rounding -0.2 gives, so the file says 0.
  const onGrid = at => ({ x: Math.round(at.x) + 0, z: Math.round(at.z) + 0 });
  const landing = at => {
    if (!run) return onGrid(at);
    const dx = at.x - run.x, dz = at.z - run.z;
    if (Math.abs(dx) >= Math.abs(dz)) {
      const feet = Math.max(1, Math.round(Math.abs(dx)));
      return { x: run.x + Math.sign(dx || 1) * feet, z: run.z };
    }
    const feet = Math.max(1, Math.round(Math.abs(dz)));
    return { x: run.x, z: run.z + Math.sign(dz) * feet };
  };

  // ── view ───────────────────────────────────────────────────────────────
  const view = { cx: 0, cz: 0, scale: 24 };   // world centre, px per foot
  let width = 0, height = 0;
  const toScreen = p => ({ x: width / 2 + (p.x - view.cx) * view.scale,
    y: height / 2 + (p.z - view.cz) * view.scale });
  const toWorld = (sx, sy) => ({ x: view.cx + (sx - width / 2) / view.scale,
    z: view.cz + (sy - height / 2) / view.scale });

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = box.width; height = box.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  };

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const feetLabel = ft => `${ft}'`;

  const paint = () => {
    ctx.clearRect(0, 0, width, height);
    // The grid, a line a foot and a bolder one every four.
    const a = toWorld(0, 0), b = toWorld(width, height);
    for (let x = Math.floor(a.x); x <= Math.ceil(b.x); x++) {
      const sx = toScreen(P(x, 0)).x;
      ctx.strokeStyle = x % 4 === 0 ? css('--grid-bold') : css('--grid');
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
    }
    for (let z = Math.floor(a.z); z <= Math.ceil(b.z); z++) {
      const sy = toScreen(P(0, z)).y;
      ctx.strokeStyle = z % 4 === 0 ? css('--grid-bold') : css('--grid');
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
    }
    // The walls, at their true thickness, square-capped so corners close.
    const thick = Math.max(3, (WALL_IN / 12) * view.scale);
    const stroke = (p, q, colour) => {
      const s = toScreen(p), e = toScreen(q);
      ctx.strokeStyle = colour; ctx.lineWidth = thick; ctx.lineCap = 'square';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    };
    walls.forEach(wall => stroke(wall.start, wall.end, css('--wall')));
    // The wall in hand, and its length.
    if (run && hover && !same(run, hover)) {
      ctx.globalAlpha = 0.55; stroke(run, hover, css('--toy')); ctx.globalAlpha = 1;
      const s = toScreen(run), e = toScreen(hover);
      ctx.font = `600 14px ${css('--font-ui')}`; ctx.fillStyle = css('--toy');
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(feetLabel(Math.abs(hover.x - run.x) + Math.abs(hover.z - run.z)),
        (s.x + e.x) / 2, (s.y + e.y) / 2 - thick);
    }
    if (hover) {
      const h = toScreen(hover);
      ctx.strokeStyle = css('--toy'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, 6, 0, Math.PI * 2); ctx.stroke();
    }
    $('s-walls').textContent = `${walls.length} wall${walls.length === 1 ? '' : 's'}`;
    canvas.dataset.walls = String(walls.length);
  };

  const say = text => { $('say').textContent = text; };

  // ── keeping it ─────────────────────────────────────────────────────────
  // THE BROWSER KEEPS THE HOUSE between visits, and only as a convenience:
  // a private window or cleared storage starts empty, and the .draft file
  // is the house's real home.
  const keep = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ walls, nextId })); } catch { /* storage off */ }
  };
  const recall = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (stored && Array.isArray(stored.walls)) { walls = stored.walls; nextId = stored.nextId || walls.length + 1; }
    } catch { /* storage off or junk: start empty */ }
  };

  const change = next => { history.push(walls); walls = next; keep(); };

  // ── the run ────────────────────────────────────────────────────────────
  const endRun = () => { run = null; runStart = null; $('s-run').textContent = '—'; paint(); };

  const press = at => {
    const point = landing(at);
    if (!run) {
      run = point; runStart = point;
      $('s-run').textContent = 'drawing';
      say('Click the next corner · click the start to close · Esc ends');
      paint();
      return;
    }
    change([...walls, wallOf(run, point)]);
    if (same(point, runStart)) { say('Closed'); endRun(); return; }
    run = point;
    paint();
  };

  const undo = () => {
    if (run) { endRun(); return; }
    if (!history.length) return;
    walls = history.pop(); keep(); say('Took back the last wall'); paint();
  };

  // ── the file ───────────────────────────────────────────────────────────
  // A blank MODEL drawing holding these walls on MAIN FL. Every list MODEL
  // reads is present and empty, so the file never relies on a reader's
  // default for a key it left out.
  const drawingOf = () => ({
    version: 1, planTurn: 0, board: FORMAT.board('toy'),
    levels: LEVELS, activeLevelIdx: LEVELS.findIndex(level => level.id === MAIN_FL),
    walls,
    lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
    outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
    roomTags: [], columns: [], beams: [], boneyardOutlines: [],
    groups: [], levelLocks: [], underlays: [],
  });

  const save = () => {
    const blob = new Blob([JSON.stringify(drawingOf(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'toy-house.draft';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    say('Saved · open it in MODEL to keep working on it');
  };

  // OPEN TAKES MAIN FL's plan walls and nothing else. A file from MODEL may
  // hold far more than the game can show, and the game says so rather than
  // pretending to have opened all of it.
  const isPoint = p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z));
  const open = text => {
    let parsed;
    try { parsed = JSON.parse(text); } catch { say('That file is not a .draft'); return; }
    const all = Array.isArray(parsed && parsed.walls) ? parsed.walls : [];
    const mine = all.filter(wall => Number(wall.levelId) === MAIN_FL
      && (wall.view || 'plan') === 'plan' && isPoint(wall.start) && isPoint(wall.end));
    endRun();
    change(mine.map(wall => wallOf(
      { x: Number(wall.start.x), z: Number(wall.start.z) },
      { x: Number(wall.end.x), z: Number(wall.end.z) })));
    say(mine.length < all.length
      ? `Opened ${mine.length} of ${all.length} walls · TOY shows MAIN FL only`
      : `Opened ${mine.length} walls`);
    paint();
  };

  // ── hands ──────────────────────────────────────────────────────────────
  let pan = null;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 1 || e.button === 2) {
      if (e.button === 2 && run) { endRun(); return; }
      pan = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const box = canvas.getBoundingClientRect();
    press(toWorld(e.clientX - box.left, e.clientY - box.top));
  });
  canvas.addEventListener('pointermove', e => {
    if (pan) {
      view.cx = pan.cx - (e.clientX - pan.x) / view.scale;
      view.cz = pan.cz - (e.clientY - pan.y) / view.scale;
      paint();
      return;
    }
    const box = canvas.getBoundingClientRect();
    hover = landing(toWorld(e.clientX - box.left, e.clientY - box.top));
    if (run) $('s-run').textContent = feetLabel(Math.abs(hover.x - run.x) + Math.abs(hover.z - run.z));
    paint();
  });
  canvas.addEventListener('pointerup', () => { pan = null; });
  canvas.addEventListener('pointerleave', () => { hover = null; paint(); });
  canvas.addEventListener('dblclick', () => { if (run) endRun(); });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    const sx = e.clientX - box.left, sy = e.clientY - box.top;
    const before = toWorld(sx, sy);
    view.scale = Math.min(120, Math.max(4, view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const after = toWorld(sx, sy);
    view.cx += before.x - after.x; view.cz += before.z - after.z;
    paint();
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'Enter') { if (run) { endRun(); say('Run ended'); } return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  $('undo').addEventListener('click', undo);
  $('clear').addEventListener('click', () => {
    if (!walls.length || !window.confirm('Start over? The walls on screen will be gone.')) return;
    endRun(); change([]); say('Cleared'); paint();
  });
  $('save').addEventListener('click', save);
  $('open').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (file) open(await file.text());
    e.target.value = '';
  });

  window.addEventListener('resize', resize);
  recall();
  resize();
  // For the specs: the page is drawn and its hands are on.
  document.body.dataset.toyReady = '1';
  window.DraftToyGame = Object.freeze({ drawingOf, toScreen, landing: at => landing(at) });
})();
