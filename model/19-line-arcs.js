// ARCS AND CIRCLES INSIDE THE LINE COMMAND (jb, 11 Nov 2026: "i don't think
// i can draw circle yet" -- "can it be a part of the LINE command, so i could
// includ and ARC in a series of lines, maybe would need to use the right click
// menu for this").
//
// NOTHING NEW ON THE PALETTE. Every letter is taken, and jb asked for the arc
// to live in the run, the way AutoCAD's PLINE takes A for Arc and L for Line
// mid-string. So while LINE is up, a right click opens a small menu --
// STRAIGHT / ARC / 3-POINT ARC / CIRCLE, then CLOSE / FINISH / CANCEL -- and
// the same four stand as chips in the foot row for anyone without a right
// button. The right click used to FINISH the run (jb, 9 Nov, PR #947); it
// still does on a WALL run and everywhere else. On LINE the menu's FINISH is
// that same verb, one press further away, and ENTER / SPACE / a double-click
// are unchanged.
//
// WHAT AN ARC PIECE IS: the same `bulge` field a FILLET or a traced DXF arc
// has always written on a line record, read since today as a circular arc
// (geometry-2d.js lineArc). So an arc drawn here picks, moves, deletes,
// prints, pens and goes out to DXF exactly as a bent line already did -- and
// as a true ARC entity, because every painter now strokes it with ctx.arc.
//
// THE THREE WAYS TO BEND:
//   ARC         -- the next press is the arc's END; it leaves the piece before
//                  it tangent-continuous (AutoCAD's default). With nothing
//                  before it (the first piece of a run) it asks for the point
//                  the arc passes through as a second press, like 3-POINT ARC.
//   3-POINT ARC -- the END, then the point the arc passes THROUGH.
//   CIRCLE      -- the CENTRE, then the radius by a press or a typed length
//                  (R, the LENGTH box). Two half-circle pieces, one assembly.
// STRAIGHT puts the run back on plain lines. The mode is kept across runs
// while LINE stays up and goes back to STRAIGHT when the tool is put down.
//
// Loaded after 18-draft-commands.js. Every call into here from an earlier
// file is guarded with typeof, as 18's are. Same scope, same indent.

  // ── the state ───────────────────────────────────────────────────────────
  var lineArcState = {
    mode: 'straight',       // 'straight' | 'arc' | 'arc3' | 'circle'
    end: null,              // 3-POINT: the end pressed, waiting for the through point
    through: null,          // the through point, set for the one commit it steers
  };
  const LINE_ARC_MODES = Object.freeze([
    { id: 'straight', label: 'STRAIGHT', title: 'Plain lines, as before' },
    { id: 'arc', label: 'ARC', title: 'The next press ends an arc that leaves the last piece smoothly; on a fresh run, press the end then the point it passes through' },
    { id: 'arc3', label: '3-POINT ARC', title: 'Press the arc’s end, then the point it passes through' },
    { id: 'circle', label: 'CIRCLE', title: 'Press the centre, then the radius -- or type it' },
  ]);
  const lineArcGeo = () => window.DraftGeometry2D;
  const lineToolUp = () => activeTool === 'line' && !activeCut();
  const lineArcModeIs = id => lineArcState.mode === id;
  const lineArcSays = text => { sayOnStrip(`LINE: ${text}`); };

  // THE PIECE BEFORE THE OPEN END, if the run is chained to it by identity --
  // the tangent an ARC continues.
  const lineRunTangent = from => {
    const last = drawnChain[drawnChain.length - 1];
    if (!last || last.type !== 'line' || !from || last.item.end !== from) return null;
    const G = lineArcGeo();
    const arc = last.item.bulge ? G.lineArc(last.item) : null;
    if (arc) return arc.tangentEnd;
    const dx = last.item.end.x - last.item.start.x, dz = last.item.end.z - last.item.start.z;
    const l = Math.hypot(dx, dz);
    return l < 1e-9 ? null : { x: dx / l, z: dz / l };
  };
  // Whether the next piece needs a THROUGH point before it can be made.
  const lineArcWantsThrough = () => lineArcModeIs('arc3')
    || (lineArcModeIs('arc') && !lineRunTangent(drawStart));
  // THE BULGE THE NEXT PIECE TAKES, asked by commitDrawnPiece (08) for every
  // line it writes: a through point steers it once; ARC bends off the
  // tangent; anything else is straight.
  function lineRunBulge(from, to) {
    if (activeTool !== 'line') return 0;
    const G = lineArcGeo();
    if (lineArcState.through) {
      const b = G.bulgeThrough(from, to, lineArcState.through);
      lineArcState.through = null;
      return b;
    }
    if (lineArcModeIs('arc')) {
      const u = lineRunTangent(from);
      return u ? G.bulgeForTangent(from, to, u) : 0;
    }
    return 0;
  }

  // A FREE POINT WITH THE SNAPS, for the through point and the circle's
  // radius press: a corner or a node if the hand is on one, else the hand.
  // Not drawPoint, which squares and foots the press to drawStart -- a point
  // the arc passes through is not on the chord.
  const lineArcFreePoint = at => {
    const corner = cornerSnap(at, []);
    if (corner) return { x: corner.x, y: 0, z: corner.z };
    const snap = drawSnap(at);
    return snap.pt ? { x: snap.pt.x, y: 0, z: snap.pt.z } : { x: at.x, y: 0, z: at.z };
  };

  // ── the presses ─────────────────────────────────────────────────────────
  // Before drawPress (16's pointerdown and the touch lift). True = taken.
  function lineArcPress(at) {
    if (!lineToolUp()) return false;
    if (lineArcModeIs('circle')) {
      clearNotice();
      if (!drawStart) {
        drawStart = lineArcFreePoint(at);
        lineArcSays('now press the radius, or type it.');
        stripRefresh(); paint();
        return true;
      }
      const p = lineArcFreePoint(at);
      const r = Math.hypot(p.x - drawStart.x, p.z - drawStart.z);
      if (r < 0.01) return true;
      lineArcCircle(drawStart, r);
      return true;
    }
    if (!drawStart) return false;
    if (!lineArcWantsThrough()) return false;
    clearNotice();
    if (!lineArcState.end) {
      const end = drawPoint(at);
      if (Math.hypot(end.x - drawStart.x, end.z - drawStart.z) < 0.001) return true;
      lineArcState.end = end;
      lineArcSays('now press the point the arc passes through.');
      stripRefresh(); paint();
      return true;
    }
    lineArcState.through = lineArcFreePoint(at);
    lineArcCommit(lineArcState.end);
    return true;
  }
  // The piece from drawStart to `end`, chained like drawPress's own commit.
  const lineArcCommit = end => {
    const made = commitDrawn(drawStart, end);
    lineArcState.end = null;
    lineArcState.through = null;
    drawStart = made.item.end;
    setSelection([made]);
    stripRefresh();
    paint();
  };
  // A TYPED LENGTH with a circle's centre down is its radius; with a 3-POINT
  // arc waiting for its end it sets that end along the aim. True = taken.
  function lineArcTyped(feet, end) {
    if (!lineToolUp() || !drawStart) return false;
    if (lineArcModeIs('circle')) { lineArcCircle(drawStart, feet); return true; }
    if (lineArcWantsThrough() && !lineArcState.end && end) {
      lineArcState.end = { x: end.x, y: 0, z: end.z };
      lineArcSays('now press the point the arc passes through.');
      stripRefresh(); paint();
      return true;
    }
    return false;
  }

  // ── THE CIRCLE: two half circles, one assembly ──────────────────────────
  // Pooled ends like any line's, so the quadrant points are nodes; the
  // style the panel last set, like any line drawn; ONE undo step.
  const lineArcCircle = (centre, r) => {
    const { levelId, viewId } = onActiveLevel();
    const lineView = wallHomeView(viewId);
    drawing.lines = drawing.lines || [];
    const west = poolVertex({ x: centre.x - r, z: centre.z }, levelId, lineView);
    const east = poolVertex({ x: centre.x + r, z: centre.z }, levelId, lineView);
    const piece = (start, end) => ({
      id: newDrawingItemId('line'), start, end, levelId, view: lineView, layer: 'draft',
      // A bulge of 2r puts the middle a radius out from the chord: a half
      // circle each way round.
      bulge: 2 * r,
      ...lineStyleDefaults(),
    });
    const top = piece(west, east), bottom = piece(east, west);
    drawing.lines.push(top, bottom);
    const n = Number(drawing.nextGroupId) > 0 ? Number(drawing.nextGroupId) : groups().length + 1;
    drawing.groups = drawing.groups || [];
    const group = {
      id: `group-${n}`, name: `CIRCLE ${n}`, fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'line', id: top.id }, { type: 'line', id: bottom.id }], wallSettings: null,
    };
    drawing.groups.push(group);
    drawing.nextGroupId = n + 1;
    undoStack.push({ kind: 'batch', steps: [
      { kind: 'add-item', list: drawing.lines, item: top },
      { kind: 'add-item', list: drawing.lines, item: bottom },
      { kind: 'add-item', list: drawing.groups, item: group },
    ] });
    markDirty();
    drawStart = null;
    setSelection([{ type: 'line', item: top }, { type: 'line', item: bottom }]);
    lineArcSays(`circle, ${feetLabel(r)} radius. Press the next centre, or STRAIGHT for lines.`);
    stripRefresh();
    paint();
  };

  // ── the mode ────────────────────────────────────────────────────────────
  function setLineArcMode(mode) {
    if (!LINE_ARC_MODES.some(m => m.id === mode)) return;
    const was = lineArcState.mode;
    lineArcState.mode = mode;
    lineArcState.end = null;
    lineArcState.through = null;
    // A circle has no run to chain onto, and a run cannot continue from a
    // circle's centre: the open end goes either way across.
    if ((mode === 'circle') !== (was === 'circle')) drawStart = null;
    const hint = { straight: 'plain lines.', arc: drawStart && lineRunTangent(drawStart)
      ? 'press where the arc ends.' : 'press where the arc ends, then the point it passes through.',
      arc3: 'press where the arc ends, then the point it passes through.',
      circle: 'press the centre.' }[mode];
    lineArcSays(hint);
    stripRefresh();
    paint();
  }
  // CLOSE: the piece back to where the run began, in the mode in hand, and
  // the run is put down. The run's first point is the chain's first start.
  function lineRunClose() {
    if (!lineToolUp() || !drawStart || lineArcModeIs('circle')) return false;
    const first = drawnChain.find(entry => entry.type === 'line' && drawing.lines.includes(entry.item));
    if (!first) { lineArcSays('nothing to close yet -- draw a piece first.'); return true; }
    const home = first.item.start;
    if (Math.hypot(home.x - drawStart.x, home.z - drawStart.z) < 0.001) { endDrawRun(); return true; }
    if (lineArcWantsThrough()) {
      lineArcState.end = { x: home.x, y: 0, z: home.z };
      lineArcSays('closing with an arc -- press the point it passes through.');
      stripRefresh(); paint();
      return true;
    }
    lineArcCommit({ x: home.x, y: 0, z: home.z });
    endDrawRun();
    stripRefresh(); paint();
    return true;
  }
  // Esc and a tool change put the half-taken arc down; the mode stays
  // through Esc and goes back to STRAIGHT with the tool.
  function lineArcCancel() { lineArcState.end = null; lineArcState.through = null; }
  toolListeners.push(next => {
    if (next !== 'line') { lineArcState.mode = 'straight'; lineArcCancel(); }
    // The row comes and goes with the tool, not with the next paint.
    syncLineBar();
  });

  // ── what the strip says ─────────────────────────────────────────────────
  function lineArcStrip() {
    if (!lineToolUp()) return null;
    if (lineArcModeIs('straight')) {
      // The right button opens the menu here, not FINISH as on a WALL run.
      return drawStart
        ? 'line — second point · ENTER, SPACE or a double-click ends the run · the right button: ARC, CIRCLE, CLOSE · ESC abandons it'
        : 'line — first point · the right button: ARC, CIRCLE';
    }
    if (lineArcModeIs('circle')) return `line — CIRCLE · ${drawStart ? 'press or type the radius' : 'press the centre'} · ESC abandons it`;
    const kind = lineArcModeIs('arc3') ? '3-POINT ARC' : 'ARC';
    if (!drawStart) return `line — ${kind} · first point`;
    if (lineArcState.end) return `line — ${kind} · the point the arc passes through · ESC abandons it`;
    return `line — ${kind} · where the arc ends · ENTER, SPACE or a double-click ends the run · ESC abandons it`;
  }

  // ── the ghost ───────────────────────────────────────────────────────────
  // Painted by 03's run ghost in place of its straight dash. True = painted.
  function paintLineArcGhost(run) {
    if (!lineToolUp() || lineArcModeIs('straight')) return false;
    const G = lineArcGeo();
    ctx.save();
    ctx.strokeStyle = skin['draw-wall-edge'];
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    if (lineArcModeIs('circle')) {
      const c = toS(drawStart);
      const r = Math.hypot(run.to.x - run.from.x, run.to.z - run.from.z) * view.scale;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      const b = toS(run.to);
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
      return true;
    }
    let seg = null;
    if (lineArcState.end) {
      // The end is down; the arc bends through the hand.
      const through = cursorWorld ? lineArcFreePoint(cursorWorld) : null;
      seg = { start: drawStart, end: lineArcState.end,
        bulge: through ? G.bulgeThrough(drawStart, lineArcState.end, through) : 0 };
      const e = toS(lineArcState.end);
      ctx.fillStyle = skin['accent'];
      ctx.fillRect(e.x - 3, e.y - 3, 6, 6);
    } else if (lineArcModeIs('arc') && lineRunTangent(drawStart)) {
      seg = { start: drawStart, end: run.to, bulge: G.bulgeForTangent(drawStart, run.to, lineRunTangent(drawStart)) };
    } else {
      ctx.restore();
      return false;
    }
    window.DraftRender2D.strokeSegPath2D(ctx, toS, seg, { controlPoint: G.lineControlPoint });
    ctx.restore();
    return true;
  }

  // ── the foot row ────────────────────────────────────────────────────────
  const lineBar = document.getElementById('line-bar');
  if (lineBar) {
    lineBar.querySelectorAll('[data-line-mode]').forEach(chip => {
      chip.addEventListener('click', () => { setLineArcMode(chip.dataset.lineMode); });
    });
    lineBar.querySelector('[data-line-close]')?.addEventListener('click', () => { lineRunClose(); });
  }
  function syncLineBar() {
    if (!lineBar) return;
    const up = !modalUp() && lineToolUp();
    lineBar.hidden = !up;
    if (!up) return;
    // THE ROW STANDS OVER THE VERBS, as OFFSET's and ARRAY's do (Movie, 18
    // Oct: "i like how those little commands cover the other ones when they
    // are active"); eleven verbs and five chips do not fit the foot.
    [deleteButton, undoButton, copyButton, pasteButton, rotateButton, flipButton, orderButton, moveButton, breakButton, rescaleButton, wallOffButton]
      .forEach(b => { if (b) b.hidden = true; });
    [rotateBar, flipBar, orderBar, rescaleBar].forEach(b => { if (b) b.hidden = true; });
    lineBar.querySelectorAll('[data-line-mode]').forEach(chip => {
      const lit = chip.dataset.lineMode === lineArcState.mode;
      chip.setAttribute('aria-pressed', String(lit));
      chip.classList.toggle('lit', lit);
    });
    const close = lineBar.querySelector('[data-line-close]');
    if (close) close.disabled = !(drawStart && !lineArcModeIs('circle') && drawnChain.length);
  }

  // ── the right-click menu ────────────────────────────────────────────────
  // Opened by 16's right button when it did not travel and LINE is up.
  const lineMenu = document.createElement('div');
  lineMenu.id = 'line-menu';
  lineMenu.dataset.lineMenu = '';
  lineMenu.setAttribute('role', 'menu');
  lineMenu.hidden = true;
  document.body.append(lineMenu);
  const closeLineMenu = () => { if (!lineMenu.hidden) { lineMenu.hidden = true; lineMenu.textContent = ''; } };
  function lineRunMenu(clientX, clientY) {
    if (!lineToolUp() || modalUp()) return false;
    const inHand = !!drawStart;
    const items = [
      ...LINE_ARC_MODES.map(m => ({ key: m.id, label: m.label, title: m.title, on: true,
        lit: lineArcModeIs(m.id), run: () => setLineArcMode(m.id) })),
      { rule: true },
      { key: 'close', label: 'CLOSE', title: 'Back to where the run began, and the run is done',
        on: inHand && !lineArcModeIs('circle') && drawnChain.length > 0, run: () => { lineRunClose(); } },
      { key: 'finish', label: 'FINISH', title: 'End the run here (ENTER)', on: inHand && !lineArcModeIs('circle'),
        run: () => { endDrawRun(); stripRefresh(); paint(); } },
      { key: 'cancel', label: 'CANCEL', title: 'Put the run down (ESC)', on: inHand,
        run: () => { cancelGestures(); stripRefresh(); paint(); } },
    ];
    lineMenu.textContent = '';
    items.forEach(item => {
      if (item.rule) {
        const rule = document.createElement('div');
        rule.className = 'line-menu-rule';
        lineMenu.append(rule);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.dataset.lineMenuItem = item.key;
      button.textContent = item.label;
      button.title = item.title || '';
      button.disabled = !item.on;
      if (item.lit) button.classList.add('lit');
      button.addEventListener('click', () => { closeLineMenu(); item.run(); });
      lineMenu.append(button);
    });
    lineMenu.hidden = false;
    const w = lineMenu.offsetWidth, h = lineMenu.offsetHeight;
    lineMenu.style.left = `${Math.max(4, Math.min(clientX, window.innerWidth - w - 4))}px`;
    lineMenu.style.top = `${Math.max(4, Math.min(clientY, window.innerHeight - h - 4))}px`;
    return true;
  }
  // A press anywhere else shuts it, as does Esc; a press on the canvas
  // with it open shuts it and goes no further.
  window.addEventListener('pointerdown', e => {
    if (lineMenu.hidden || lineMenu.contains(e.target)) return;
    closeLineMenu();
    if (e.target === canvas) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !lineMenu.hidden) { closeLineMenu(); e.stopPropagation(); } }, true);
  const lineMenuOpen = () => !lineMenu.hidden;
