// MODEL.html's page script, part 18: the classic edits -- OFFSET, MIRROR,
// ROTATE about a base point, FILLET and ARRAY.
//
// jb, 9 Nov: "these are vital: OFFSET, MIRROR, ROTATE, FILLET, ARRAY. Offset
// is the most-used command in 2D drafting and it is not on the palette."
//
// LOADED AFTER THE BOOT, in its numbered place, and the boot's first paint
// runs before this file exists: the two calls the paint makes into it
// (paintDraftCommands, syncDraftCommandBars) are guarded with typeof in
// 03-plan-paint.js, as followDimLinks is. Everything else here is reached
// by a press or a key, long after the page is up. Same scope as the other
// parts, same indent.
//
// WHAT IS NEW AND WHAT IS BORROWED. The foot's ROTATE and FLIP turn and
// mirror a selection about its own middle (09-draw-move-stretch.js). These
// five are the drafting-table versions: a base point the drafter presses, a
// mirror line he draws, a distance he types. The point-moving under them --
// turnSet, the stair's framing and well, a kept link's offset, a hologram's
// pivot -- is the foot's own, through transformSelection below, so a wall
// corner shared with something left behind is let go here exactly as a turn
// lets it go, and one UNDO takes the whole edit back.
//
// COPIES ARE PASTES. MIRROR with KEEP ORIGINAL and every ARRAY copy go
// through copySelection / pasteHeld (08-structure-roof.js) with nudge off,
// so a copy carries what a paste carries -- its doors, its windows, the
// fixtures on its walls, a new id -- and is then moved where it goes.

  // ── the five states ─────────────────────────────────────────────────────
  var draftCmd = {
    offset: { pick: null },                 // { kind: 'seg'|'ring', item, type, list }
    mirror: { a: null },                    // the first point of the mirror line
    turn: { base: null },                   // ROTATE's base point
    fillet: { first: null },                // { seg, t } the first line pressed
  };
  const DRAFT_CMD_TOOLS = Object.freeze(['offset', 'mirror', 'rotate', 'fillet', 'array']);
  // The three that act on what is picked: armed with nothing picked they say
  // to pick first, as MOVE does, rather than arming a tool with nothing to
  // carry.
  const DRAFT_CMD_NEEDS_PICK = Object.freeze(['mirror', 'rotate', 'array']);

  const draftBar = id => document.getElementById(id);
  const offsetBar = draftBar('offset-bar'), mirrorBar = draftBar('mirror-bar'), turnBar = draftBar('turn-bar');
  const filletBar = draftBar('fillet-bar'), arrayBar = draftBar('array-bar');
  const offsetDistBox = draftBar('offset-dist'), turnAngleBox = draftBar('turn-angle'), filletRadiusBox = draftBar('fillet-radius');
  const arrayBoxes = { cols: draftBar('array-cols'), dx: draftBar('array-dx'), rows: draftBar('array-rows'), dz: draftBar('array-dz') };
  const mirrorKeepButton = mirrorBar?.querySelector('[data-mirror-keep]');
  const barSay = (bar, sel, text) => { const el = bar?.querySelector(sel); if (el) el.textContent = text; };

  const draftCmdLetter = id => {
    const roster = window.DraftToolRoster;
    const key = roster ? roster.keyFor(id, roster.bindings()) : '';
    return key ? `press ${key} or ` : 'press ';
  };
  // Asked by pressToolKey before it arms one of the three.
  function draftCommandNeedsPick(id) {
    if (!DRAFT_CMD_NEEDS_PICK.includes(id) || activeTool === id || selection.length) return false;
    const name = id.toUpperCase();
    const verb = id === 'mirror' ? 'mirror' : id === 'rotate' ? 'turn' : 'copy';
    sayOnStrip(`${name}: pick what to ${verb} first -- click it, or box it -- then ${draftCmdLetter(id)}${name}.`);
    return true;
  }
  const draftCommandsBusy = () => !!(draftCmd.offset.pick || draftCmd.mirror.a || draftCmd.turn.base || draftCmd.fillet.first);
  // Esc, the right button and a tool change all come through here: the
  // half-made gesture goes, the tool stays up for the next one.
  function draftCommandsCancel() {
    const had = draftCommandsBusy();
    draftCmd.offset.pick = null;
    draftCmd.mirror.a = null;
    draftCmd.turn.base = null;
    draftCmd.fillet.first = null;
    if (had) draftCmdPrompt(activeTool);
    return had;
  }

  // ── typed numbers ───────────────────────────────────────────────────────
  const draftFeet = (box, { allowZero = false, allowMinus = false } = {}) => {
    const raw = String(box?.value ?? '').trim();
    if (!raw) return null;
    const minus = allowMinus && raw.startsWith('-');
    const parsed = readLength(minus ? raw.slice(1) : raw);
    if (!parsed.ok) { sayOnStrip(parsed.error); return null; }
    const ft = parsed.inches / 12;
    if (!allowZero && !(ft > 0)) { sayOnStrip('Type a length over zero.'); return null; }
    return minus ? -ft : ft;
  };
  const draftCount = box => {
    const n = Math.round(Number(String(box?.value ?? '').replace(/[^\d]/g, '')));
    return Number.isFinite(n) && n >= 1 ? n : null;
  };
  const draftDegrees = box => {
    const raw = String(box?.value ?? '').trim();
    if (!raw) return null;
    const deg = Number(raw.replace(/[^\d.+-]/g, ''));
    return Number.isFinite(deg) ? deg : null;
  };

  // ── the point maps ──────────────────────────────────────────────────────
  // Clockwise on the screen, as rotateSelection turns: x runs right and z
  // runs down the sheet.
  const turnAbout = (c, degrees) => {
    const a = degrees * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const vec = ({ dx, dz }) => ({ dx: dx * cos - dz * sin, dz: dx * sin + dz * cos });
    const pt = p => { const dx = p.x - c.x, dz = p.z - c.z; p.x = c.x + dx * cos - dz * sin; p.z = c.z + dx * sin + dz * cos; };
    return { pt, vec };
  };
  const shiftBy = (dx, dz) => ({
    pt: p => { p.x += dx; p.z += dz; },
    vec: v => v,
  });
  // Across the line through `a` in the direction of `b`.
  const reflectAcross = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
    const vec = ({ dx, dz }) => { const along = dx * ux + dz * uz; return { dx: 2 * along * ux - dx, dz: 2 * along * uz - dz }; };
    const pt = p => { const r = vec({ dx: p.x - a.x, dz: p.z - a.z }); p.x = a.x + r.dx; p.z = a.z + r.dz; };
    // The line's angle, for a hologram's turn: a direction at angle `t` seen
    // in a mirror at angle `theta` lies at 180 - 2*theta - t in this page's
    // clockwise degrees -- FLIP's own -a (a vertical mirror) and 180 - a (a
    // horizontal one) are the two ends of that line.
    const theta = Math.atan2(uz, ux) * 180 / Math.PI;
    return { pt, vec, theta };
  };

  // ── ONE MOVE OF THE PICKED SET, by any map ──────────────────────────────
  // rotateSelection and flipSelection in 09, with the point map taken as an
  // argument. `after` adds property edits (a mirror's side swaps) once the
  // points have moved and gets the entries and the holograms.
  const transformSelection = (map, { holo, after } = {}) => {
    if (!selection.length) return null;
    const { entries, detached, points, linked } = turnSet();
    const holos = entries.filter(e => e.type === 'hologram').map(e => e.item);
    if (!points.length && !holos.length) {
      detached.forEach(d => { d.wall[d.key] = d.orig; });
      return null;
    }
    const before = points.map(vtx => ({ vtx, x: vtx.x, z: vtx.z,
      ...(vtx.offX !== undefined ? { offX: vtx.offX, offZ: vtx.offZ } : {}) }));
    points.forEach(map.pt);
    linked.forEach(pt => {
      const was = before.find(b => b.vtx === pt);
      if (was) was.link = { ...pt.link };
      pt.link = { ...pt.link, ...map.vec({ dx: pt.link.dx, dz: pt.link.dz }) };
    });
    const framing = turnFraming(entries, points);
    framing.forEach(vtx => before.push({ vtx, x: vtx.x, z: vtx.z }));
    framing.forEach(map.pt);
    const wells = recutWells(entries);
    points.forEach(relinkVertex);
    const moved = { kind: 'rotate', before, detached, wells };
    const edits = holos.map(h => {
      const was = { ...h };
      const p = hologramPivotPlaced(h);
      map.pt(p);
      h.x = p.x - (Number(h.pivotX) || 0);
      h.z = p.z - (Number(h.pivotZ) || 0);
      if (holo) holo(h);
      return { item: h, before: was };
    });
    if (after) edits.push(...(after(entries, holos) || []));
    const reframed = entries.filter(e => e.type === 'stair').map(({ item }) => reframeStair(item));
    const steps = [moved, ...(edits.length ? [{ kind: 'props', edits }] : []), ...reframed.flatMap(r => r.steps)];
    undoStack.push(steps.length > 1 ? { kind: 'batch', steps } : moved);
    markDirty();
    return { entries, reframed };
  };
  // A MIRROR REVERSES THE HAND -- flipSelection's own swaps: a wall drawn by
  // its left or right line swaps lines, a fixture crosses to the other face,
  // a door swings the other way, a stair that turned left turns right.
  const mirrorSideSwaps = (entries, holos) => {
    const edits = [];
    const flippedWalls = entries.filter(e => e.type === 'wall').map(e => e.item);
    const wallIds = new Set(flippedWalls.map(w => String(w.id)));
    const freeOnes = entries.filter(e => e.type === 'fixture' && e.item.wallId == null && e.item.host).map(e => e.item);
    flippedWalls.forEach(w => {
      if (w.refLine !== 'left' && w.refLine !== 'right') return;
      edits.push({ item: w, before: { ...w } });
      w.refLine = w.refLine === 'left' ? 'right' : 'left';
    });
    (drawing.fixtures || []).filter(f => wallIds.has(String(f.wallId)) || freeOnes.includes(f)).forEach(f => {
      edits.push({ item: f, before: { ...f } });
      f.side = f.side === -1 ? 1 : -1;
    });
    (drawing.fenestrations || []).filter(o => wallIds.has(String(o.wallId)) && o.type === 'door').forEach(o => {
      edits.push({ item: o, before: { ...o } });
      o.swingFlip = o.swingFlip !== true;
    });
    entries.filter(e => e.type === 'stair').forEach(({ item }) => {
      if (item.turn !== 'left' && item.turn !== 'right') return;
      edits.push({ item, before: { ...item } });
      item.turn = item.turn === 'left' ? 'right' : 'left';
    });
    void holos;
    return edits;
  };

  // A COPY OF THE SELECTION, LANDED ON ITSELF, now picked in its place. The
  // clipboard is lent and handed back: COPY's held snapshot is the drafter's.
  const duplicateSelection = () => {
    const lent = held;
    const n = copySelection() ? pasteHeld({ nudge: false }) : 0;
    held = lent;
    return n;
  };
  // Several steps the gesture pushed, folded into one.
  const foldUndo = mark => {
    if (undoStack.length - mark > 1) undoStack.push({ kind: 'batch', steps: undoStack.splice(mark) });
  };

  // ── the ghost: what is picked, drawn where the map would put it ─────────
  const ghostSegs = (entries, map) => {
    const out = [];
    const mapped = p => { const q = { x: p.x, z: p.z }; map.pt(q); return q; };
    entries.forEach(({ type, item }) => {
      if (!item) return;
      if (type === 'fixture' && item.wallId == null && item.host?.start && item.host?.end) {
        out.push([mapped(item.host.start), mapped(item.host.end)]);
        return;
      }
      if (Array.isArray(item.points) && item.points.length >= 2) {
        const ring = item.points.map(mapped);
        ring.forEach((p, i) => { if (i + 1 < ring.length || ring.length > 2) out.push([p, ring[(i + 1) % ring.length]]); });
        return;
      }
      if (item.start && item.end) out.push([mapped(item.start), mapped(item.end)]);
    });
    return out;
  };
  const strokeGhost = segs => {
    ctx.save();
    ctx.strokeStyle = skin['draw-selected'];
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([5, 3]);
    segs.forEach(([a, b]) => {
      const s = toS(a), e = toS(b);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    });
    ctx.restore();
  };
  const strokeGuide = (a, b, dot = true) => {
    ctx.save();
    ctx.strokeStyle = skin['draw-selected-cross'];
    ctx.fillStyle = skin['draw-selected'];
    ctx.lineWidth = 1;
    const s = toS(a);
    if (dot) { ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill(); }
    if (b) {
      const e = toS(b);
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
    ctx.restore();
  };

  // ── OFFSET ──────────────────────────────────────────────────────────────
  // Type the distance, press the line, wall or shape, press the side. The
  // tool stays up for the next one, as AutoCAD's does.
  const offsetRings = () => [
    ...shapes().map(item => ({ type: 'shape', item, list: drawing.shapes || (drawing.shapes = []) })),
    ...floors().map(item => ({ type: 'floor', item, list: drawing.floors || (drawing.floors = []) })),
    ...outlines().filter(o => (drawing.outlines || []).includes(o)).map(item => ({ type: 'outline', item, list: drawing.outlines })),
  ];
  const distToSeg = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
    return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
  };
  const offsetTargetAt = at => {
    const seg = trimSegAt(at);
    if (seg) {
      const isLine = lines().includes(seg.seg);
      return { kind: 'seg', item: seg.seg, type: isLine ? 'line' : 'wall', off: seg.off };
    }
    const grab = SELECT_GRAB_PX / view.scale;
    let best = null;
    offsetRings().forEach(({ type, item, list }) => {
      const ring = item.points || [];
      if (ring.length < 3) return;
      ring.forEach((p, i) => {
        const d = distToSeg(at, p, ring[(i + 1) % ring.length]);
        if (d <= grab && (!best || d < best.off)) best = { kind: 'ring', item, type, list, off: d };
      });
    });
    return best;
  };
  const offsetDistance = () => draftFeet(offsetDistBox);
  // A ring, pushed in or out by `d`: each corner is where its two edges'
  // offset lines meet; parallel edges fall back to the corner slid straight.
  const offsetRing = (ring, d, inset) => {
    const n = ring.length;
    const normals = ring.map((p, i) => {
      const q = ring[(i + 1) % n];
      const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
      return { x: -(q.z - p.z) / len, z: (q.x - p.x) / len };
    });
    // Does the left normal point in? Test it on the first edge's middle.
    const p0 = ring[0], p1 = ring[1 % n];
    const probe = { x: (p0.x + p1.x) / 2 + normals[0].x * 1e-3, z: (p0.z + p1.z) / 2 + normals[0].z * 1e-3 };
    const leftIn = pointInRing(ring, probe);
    const s = (inset ? 1 : -1) * (leftIn ? 1 : -1) * d;
    const shifted = ring.map((p, i) => {
      const q = ring[(i + 1) % n];
      return { a: { x: p.x + normals[i].x * s, z: p.z + normals[i].z * s }, b: { x: q.x + normals[i].x * s, z: q.z + normals[i].z * s } };
    });
    return ring.map((p, i) => {
      const e1 = shifted[(i - 1 + n) % n], e2 = shifted[i];
      const r = { x: e1.b.x - e1.a.x, z: e1.b.z - e1.a.z };
      const q = { x: e2.b.x - e2.a.x, z: e2.b.z - e2.a.z };
      const den = r.x * q.z - r.z * q.x;
      if (Math.abs(den) < 1e-9) return { x: p.x + normals[i].x * s, z: p.z + normals[i].z * s };
      const w = { x: e2.a.x - e1.a.x, z: e2.a.z - e1.a.z };
      const t = (w.x * q.z - w.z * q.x) / den;
      return { x: e1.a.x + r.x * t, z: e1.a.z + r.z * t };
    });
  };
  // Where the pick would go for a press at `at` and a distance `d`.
  const offsetPlan = (pick, at, d) => {
    if (!pick || !(d > 0) || !at) return null;
    if (pick.kind === 'seg') {
      const seg = pick.item;
      const dx = seg.end.x - seg.start.x, dz = seg.end.z - seg.start.z;
      const len = Math.hypot(dx, dz) || 1;
      const cross = (at.x - seg.start.x) * dz - (at.z - seg.start.z) * dx;
      const side = cross >= 0 ? 1 : -1;
      // The normal on the press's side: cross > 0 is the (dz, -dx) side.
      const nx = dz / len * side, nz = -dx / len * side;
      return { kind: 'seg', start: { x: seg.start.x + nx * d, z: seg.start.z + nz * d }, end: { x: seg.end.x + nx * d, z: seg.end.z + nz * d } };
    }
    const inset = pointInRing(pick.item.points, at);
    return { kind: 'ring', inset, points: offsetRing(pick.item.points, d, inset) };
  };
  const offsetSays = text => { barSay(offsetBar, '[data-offset-say]', text); sayOnStrip(`OFFSET: ${text}`); };
  const offsetPress = at => {
    const d = offsetDistance();
    if (d == null) { offsetSays('type the distance in the box first.'); offsetDistBox?.focus(); return; }
    const st = draftCmd.offset;
    if (!st.pick) {
      const pick = offsetTargetAt(at);
      if (!pick) { offsetSays('press a line, a wall or the edge of a shape to offset.'); return; }
      if (pick.kind === 'seg' && pick.item.bulge) { offsetSays('an arc cannot be offset yet -- press a straight line or wall.'); return; }
      st.pick = pick;
      offsetSays(`now press the side it goes, ${feetLabel(d)} over.`);
      paint();
      return;
    }
    const plan = offsetPlan(st.pick, at, d);
    const pick = st.pick;
    st.pick = null;
    if (!plan) return;
    if (plan.kind === 'seg' && pick.type === 'wall') {
      const w = pick.item;
      commitWall(plan.start, plan.end, { bone: false, refLine: w.refLine, wallType: w.wallType,
        baseHeight: w.baseHeight, topHeight: w.topHeight, body: w.body, levelId: w.levelId, view: w.view });
      offsetSays(`wall offset ${feetLabel(d)}. Press the next line, or Esc. UNDO takes it back.`);
    } else if (plan.kind === 'seg') {
      const l = pick.item;
      const { id: _id, srcId: _s, offX: _ox, offZ: _oz, ...rest } = l;
      drawing.lines = drawing.lines || [];
      addItem(drawing.lines, { ...rest, id: newDrawingItemId('line'),
        start: poolVertex({ x: plan.start.x, z: plan.start.z }, l.levelId, l.view || 'plan'),
        end: poolVertex({ x: plan.end.x, z: plan.end.z }, l.levelId, l.view || 'plan') });
      offsetSays(`line offset ${feetLabel(d)}. Press the next line, or Esc. UNDO takes it back.`);
    } else {
      const { id: _id, srcId: _s, offX: _ox, offZ: _oz, points: _p, ...rest } = pick.item;
      const y = pick.item.points[0]?.y;
      addItem(pick.list, { ...rest, id: newDrawingItemId(pick.type),
        points: plan.points.map(p => ({ ...(y !== undefined ? { y } : {}), x: p.x, z: p.z })) });
      offsetSays(`${pick.type} offset ${feetLabel(d)} ${plan.inset ? 'in' : 'out'}. Press the next one, or Esc. UNDO takes it back.`);
    }
    paint();
  };
  const paintOffset = () => {
    const st = draftCmd.offset;
    if (activeTool !== 'offset' || !st.pick) return;
    const picked = st.pick.kind === 'seg' ? [[st.pick.item.start, st.pick.item.end]]
      : st.pick.item.points.map((p, i, r) => [p, r[(i + 1) % r.length]]);
    ctx.save();
    ctx.strokeStyle = skin['draw-selected'];
    ctx.lineWidth = 6; ctx.globalAlpha = 0.35; ctx.lineCap = 'round';
    picked.forEach(([a, b]) => { const s = toS(a), e = toS(b); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke(); });
    ctx.restore();
    const d = draftFeetQuiet(offsetDistBox);
    const plan = cursorWorld && d ? offsetPlan(st.pick, cursorWorld, d) : null;
    if (!plan) return;
    strokeGhost(plan.kind === 'seg' ? [[plan.start, plan.end]] : plan.points.map((p, i, r) => [p, r[(i + 1) % r.length]]));
  };
  // The ghost reads the box without complaining about it.
  const draftFeetQuiet = (box, opts) => {
    const was = stripNotice;
    const ft = draftFeet(box, opts);
    if (stripNotice !== was) { stripNotice = was; stripRefresh(); }
    return ft;
  };

  // ── MIRROR ──────────────────────────────────────────────────────────────
  // Two points for the mirror line; KEEP ORIGINAL (lit) mirrors a copy.
  var mirrorKeep = true;
  const mirrorSays = text => { barSay(mirrorBar, '[data-mirror-say]', text); sayOnStrip(`MIRROR: ${text}`); };
  const mirrorPress = at => {
    if (!selection.length) { mirrorSays('nothing is picked -- press Esc, pick what to mirror, then MIRROR.'); return; }
    const st = draftCmd.mirror;
    const p = drawSnap(at).pt || at;
    if (!st.a) {
      st.a = { x: p.x, z: p.z };
      mirrorSays('now press the other end of the mirror line.');
      paint();
      return;
    }
    const b = squareTo(st.a, { x: p.x, z: p.z });
    if (Math.hypot(b.x - st.a.x, b.z - st.a.z) * view.scale < 4) { mirrorSays('that line has no length -- press further along it.'); return; }
    const a = st.a;
    st.a = null;
    mirrorAcross(a, b, mirrorKeep);
  };
  const mirrorAcross = (a, b, keep) => {
    const mark = undoStack.length;
    const n = selection.length;
    if (keep && !duplicateSelection()) { sayOnStrip('MIRROR: nothing in the selection can be copied -- turn KEEP ORIGINAL off to mirror it in place.'); return; }
    const map = reflectAcross(a, b);
    const done = transformSelection(map, {
      holo: h => {
        if (h.flip === true) delete h.flip; else h.flip = true;
        const t = Number(h.angleDeg) || 0;
        h.angleDeg = ((((180 - 2 * map.theta - t) % 360) + 360) % 360);
      },
      after: mirrorSideSwaps,
    });
    if (!done) {
      // Nothing moved: a kept copy that cannot be mirrored is taken back.
      while (undoStack.length > mark) undoOnce();
      sayOnStrip('Nothing in the selection can be mirrored on its own -- doors, windows and fixtures mirror with their walls.');
      return;
    }
    foldUndo(mark);
    setTool(RESTING_TOOL);
    sayOnStrip(`MIRRORED ${n === 1 ? hitSays(done.entries[0]) : `${n} things`}${keep ? ' -- a copy, the original kept' : ' in place'}.${stairFramingSaid(done.reframed)} UNDO takes it back.`);
    paint();
  };
  if (mirrorKeepButton) {
    mirrorKeepButton.addEventListener('click', () => {
      mirrorKeep = !mirrorKeep;
      mirrorKeepButton.setAttribute('aria-pressed', String(mirrorKeep));
      mirrorKeepButton.textContent = mirrorKeep ? 'KEEP ORIGINAL' : 'MIRROR IN PLACE';
      sayOnStrip(mirrorKeep ? 'MIRROR: the original stays and a mirrored copy is made.' : 'MIRROR: the original itself is mirrored.');
    });
  }
  const paintMirror = () => {
    const st = draftCmd.mirror;
    if (activeTool !== 'mirror' || !st.a) return;
    const b = cursorWorld ? squareTo(st.a, cursorWorld) : null;
    strokeGuide(st.a, b);
    if (b && Math.hypot(b.x - st.a.x, b.z - st.a.z) > 1e-6) strokeGhost(ghostSegs(selection, reflectAcross(st.a, b)));
  };

  // ── ROTATE about a base point ───────────────────────────────────────────
  const turnSays = text => { barSay(turnBar, '[data-turn-say]', text); sayOnStrip(`ROTATE: ${text}`); };
  const turnAngleAt = at => {
    const b = draftCmd.turn.base;
    const deg = Math.atan2(at.z - b.z, at.x - b.x) * 180 / Math.PI;
    return ((deg % 360) + 360) % 360;
  };
  const turnPress = at => {
    if (!selection.length) { turnSays('nothing is picked -- press Esc, pick what to turn, then ROTATE.'); return; }
    const st = draftCmd.turn;
    const p = drawSnap(at).pt || at;
    if (!st.base) {
      st.base = { x: p.x, z: p.z };
      turnSays('press a point for the angle, or type degrees and ENTER.');
      paint();
      return;
    }
    if (Math.hypot(p.x - st.base.x, p.z - st.base.z) * view.scale < 4) { turnSays('press further from the base point for the angle.'); return; }
    turnBy(turnAngleAt(p));
  };
  const turnBy = degrees => {
    const base = draftCmd.turn.base;
    if (!base || !Number.isFinite(degrees)) return;
    if (Math.abs(degrees % 360) < 1e-9) { turnSays('that is no turn at all -- type the degrees, 90, 45, -30.'); return; }
    const n = selection.length;
    const done = transformSelection(turnAbout(base, degrees), {
      holo: h => { h.angleDeg = ((((Number(h.angleDeg) || 0) + degrees) % 360) + 360) % 360; },
    });
    draftCmd.turn.base = null;
    if (!done) { sayOnStrip('Nothing in the selection can be turned on its own -- doors, windows and fixtures turn with their walls.'); return; }
    setTool(RESTING_TOOL);
    const shown = Math.round(((degrees % 360) + 360) % 360 * 100) / 100;
    sayOnStrip(`Turned ${n === 1 ? hitSays(done.entries[0]) : `${n} things`} ${shown}° clockwise about the base point.${stairFramingSaid(done.reframed)} UNDO turns it back.`);
    paint();
  };
  const paintTurn = () => {
    const st = draftCmd.turn;
    if (activeTool !== 'rotate' || !st.base) return;
    strokeGuide(st.base, cursorWorld);
    const typed = draftDegrees(turnAngleBox);
    const deg = typed != null ? typed : (cursorWorld ? turnAngleAt(cursorWorld) : null);
    if (deg != null) strokeGhost(ghostSegs(selection, turnAbout(st.base, deg)));
  };

  // ── FILLET ──────────────────────────────────────────────────────────────
  // Two presses, two lines or walls, one corner. The part pressed is the
  // part kept, as AutoCAD keeps it. A RADIUS typed first rounds the corner
  // of two LINES with an arc; a wall takes a square corner whatever is typed.
  const filletSays = text => { barSay(filletBar, '[data-fillet-say]', text); sayOnStrip(`FILLET: ${text}`); };
  const filletPress = at => {
    const st = draftCmd.fillet;
    const hit = trimSegAt(at);
    if (!hit) { filletSays(st.first ? 'press the second line or wall.' : 'press the first line or wall.'); return; }
    if (!st.first) {
      st.first = hit;
      filletSays('now press the second line or wall, on the part to keep.');
      paint();
      return;
    }
    if (hit.seg === st.first.seg) { filletSays('that is the same line -- press the other one.'); return; }
    const first = st.first;
    st.first = null;
    filletJoin(first, hit);
  };
  const segPt = (seg, t) => ({ x: seg.start.x + (seg.end.x - seg.start.x) * t, z: seg.start.z + (seg.end.z - seg.start.z) * t });
  const filletJoin = (p1, p2) => {
    const s1 = p1.seg, s2 = p2.seg;
    const r = { x: s1.end.x - s1.start.x, z: s1.end.z - s1.start.z };
    const q = { x: s2.end.x - s2.start.x, z: s2.end.z - s2.start.z };
    const den = r.x * q.z - r.z * q.x;
    if (Math.abs(den) < 1e-9) { filletSays('those two are parallel -- they never meet. Press the first line again.'); paint(); return; }
    const w = { x: s2.start.x - s1.start.x, z: s2.start.z - s1.start.z };
    const t1 = (w.x * q.z - w.z * q.x) / den;
    const t2 = (w.x * r.z - w.z * r.x) / den;
    const X = segPt(s1, t1);
    // The end that goes to the corner is the one on the far side of it from
    // the press; the pressed part stays.
    const end1 = t1 > p1.t ? 'end' : 'start', end2 = t2 > p2.t ? 'end' : 'start';
    const keep1 = end1 === 'end' ? 'start' : 'end', keep2 = end2 === 'end' ? 'start' : 'end';
    const isLine = seg => lines().includes(seg);
    const bothLines = isLine(s1) && isLine(s2);
    const radius = draftFeet(filletRadiusBox, { allowZero: true });
    const changes = [], added = [], removed = [];
    const edits = new Map();
    [s1, s2].forEach(seg => (drawing.fenestrations || []).forEach(o => {
      if (o && o.wallId === seg.id) edits.set(o, { opening: o, offset: o.offset, wallId: o.wallId });
    }));
    let said = 'Joined at a square corner.';
    let arc = null;
    if (radius > 0 && bothLines) {
      const unit = (seg, keep) => { const dx = seg[keep].x - X.x, dz = seg[keep].z - X.z; const l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l, len: l }; };
      const u1 = unit(s1, keep1), u2 = unit(s2, keep2);
      const cosPhi = Math.max(-1, Math.min(1, u1.x * u2.x + u1.z * u2.z));
      const phi = Math.acos(cosPhi);
      if (phi < 1e-6 || Math.PI - phi < 1e-6) { filletSays('those two run the same way -- no corner to round.'); paint(); return; }
      const tan = radius / Math.tan(phi / 2);
      if (tan > u1.len + 1e-9 || tan > u2.len + 1e-9) { filletSays(`a ${feetLabel(radius)} radius does not fit -- the lines are too short. Type a smaller one.`); paint(); return; }
      const T1 = { x: X.x + u1.x * tan, z: X.z + u1.z * tan }, T2 = { x: X.x + u2.x * tan, z: X.z + u2.z * tan };
      const bx = u1.x + u2.x, bz = u1.z + u2.z, bl = Math.hypot(bx, bz) || 1;
      const toC = radius / Math.sin(phi / 2);
      const C = { x: X.x + bx / bl * toC, z: X.z + bz / bl * toC };
      const cx = X.x - C.x, cz = X.z - C.z, cl = Math.hypot(cx, cz) || 1;
      const M = { x: C.x + cx / cl * radius, z: C.z + cz / cl * radius };
      const chord = { x: T2.x - T1.x, z: T2.z - T1.z }, chl = Math.hypot(chord.x, chord.z) || 1;
      const mid = { x: (T1.x + T2.x) / 2, z: (T1.z + T2.z) / 2 };
      // The painter's quadratic passes half the control offset from the
      // chord, so the control point stands twice the sagitta out.
      const sagitta = (M.x - mid.x) * (-chord.z / chl) + (M.z - mid.z) * (chord.x / chl);
      trimMoveEnd(s1, end1, T1, changes);
      trimMoveEnd(s2, end2, T2, changes);
      const { id: _id, srcId: _s, offX: _ox, offZ: _oz, ...style } = s1;
      arc = { ...style, id: newDrawingItemId('line'),
        start: poolVertex({ x: T1.x, z: T1.z }, s1.levelId, s1.view || 'plan'),
        end: poolVertex({ x: T2.x, z: T2.z }, s1.levelId, s1.view || 'plan'),
        bulge: 2 * sagitta };
      drawing.lines.push(arc);
      added.push({ list: drawing.lines, item: arc });
      said = `Rounded with a ${feetLabel(radius)} radius.`;
    } else {
      trimMoveEnd(s1, end1, X, changes);
      trimMoveEnd(s2, end2, X, changes);
      if (radius > 0) said = 'Joined at a square corner -- a radius rounds LINES; walls take a square corner.';
    }
    // AN OPENING THE CORNER CUT THE WALL FROM UNDER is put back where it fits.
    const gone = [];
    [s1, s2].forEach(seg => {
      if (isLine(seg)) return;
      const len = Math.hypot(seg.end.x - seg.start.x, seg.end.z - seg.start.z);
      const moved = new Set((drawing.fenestrations || []).filter(o => o && o.wallId === seg.id
        && ((Number(o.offset) || 0) < 0 || (Number(o.offset) || 0) + (Number(o.width) || 0) > len + 1e-9)));
      gone.push(...trimRefitOpenings(seg, moved, edits, removed));
    });
    const retired = retirePoolCorners(changes.map(c => c.was));
    if (!changes.length && !added.length) { filletSays('already a corner -- nothing to change.'); paint(); return; }
    undoStack.push({ kind: 'trim', changes, retired, added, removed, openings: [...edits.values()] });
    markDirty();
    filletSays(`${said}${gone.length ? ` ${gone.length} opening${gone.length === 1 ? '' : 's'} did not fit and went.` : ''} Press the next pair, or Esc. UNDO puts it back.`);
    paint();
  };
  const paintFillet = () => {
    const st = draftCmd.fillet;
    if (activeTool !== 'fillet' || !st.first) return;
    const seg = st.first.seg;
    ctx.save();
    ctx.strokeStyle = skin['draw-selected'];
    ctx.lineWidth = 6; ctx.globalAlpha = 0.35; ctx.lineCap = 'round';
    const s = toS(seg.start), e = toS(seg.end);
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    ctx.restore();
  };

  // ── ARRAY ───────────────────────────────────────────────────────────────
  // ACROSS × DOWN copies at the two spacings, the original counted and kept
  // where it is. One UNDO takes every copy back.
  const ARRAY_MOST = 400;
  const arrayPlan = ({ quiet = false } = {}) => {
    const read = quiet ? draftFeetQuiet : draftFeet;
    const cols = draftCount(arrayBoxes.cols) || 1, rows = draftCount(arrayBoxes.rows) || 1;
    const dx = cols > 1 ? read(arrayBoxes.dx, { allowMinus: true }) : 0;
    const dz = rows > 1 ? read(arrayBoxes.dz, { allowMinus: true }) : 0;
    if (dx == null || dz == null) return null;
    const cells = [];
    for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) if (i || j) cells.push({ dx: i * dx, dz: j * dz });
    return { cols, rows, dx, dz, cells };
  };
  const arrayMake = () => {
    if (activeTool !== 'array') return;
    if (!selection.length) { sayOnStrip('ARRAY: nothing is picked -- press Esc, pick what to copy, then ARRAY.'); return; }
    const plan = arrayPlan();
    if (!plan) return;
    if (!plan.cells.length) { sayOnStrip('ARRAY: type how many across or down -- 2 or more -- and the spacing.'); return; }
    if (plan.cells.length > ARRAY_MOST) { sayOnStrip(`ARRAY: that is ${plan.cells.length} copies -- ${ARRAY_MOST} at most in one go.`); return; }
    const original = selection.slice();
    const mark = undoStack.length;
    let made = 0;
    for (const cell of plan.cells) {
      setSelection(original);
      if (!duplicateSelection()) break;
      if (transformSelection(shiftBy(cell.dx, cell.dz))) made += 1;
    }
    if (!made) {
      while (undoStack.length > mark) undoOnce();
      setSelection(original);
      sayOnStrip('ARRAY: nothing in the selection can be copied.');
      paint();
      return;
    }
    foldUndo(mark);
    setSelection(original);
    setTool(RESTING_TOOL);
    sayOnStrip(`ARRAY made ${made} cop${made === 1 ? 'y' : 'ies'}, ${plan.cols} across by ${plan.rows} down. UNDO takes them back.`);
    paint();
  };
  const paintArray = () => {
    if (activeTool !== 'array' || !selection.length) return;
    const plan = arrayPlan({ quiet: true });
    if (!plan || !plan.cells.length || plan.cells.length > ARRAY_MOST) return;
    plan.cells.forEach(cell => strokeGhost(ghostSegs(selection, shiftBy(cell.dx, cell.dz))));
  };

  // ── the press, the paint, the rows ──────────────────────────────────────
  function draftCommandPress(at) {
    if (activeTool === 'offset') offsetPress(at);
    else if (activeTool === 'mirror') mirrorPress(at);
    else if (activeTool === 'rotate') turnPress(at);
    else if (activeTool === 'fillet') filletPress(at);
    else if (activeTool === 'array') sayOnStrip('ARRAY: type how many and the spacing in the boxes below, then press MAKE.');
  }
  function paintDraftCommands() {
    if (!DRAFT_CMD_TOOLS.includes(activeTool)) return;
    paintOffset();
    paintMirror();
    paintTurn();
    paintFillet();
    paintArray();
  }
  const draftCmdPrompt = tool => {
    if (tool === 'offset') offsetSays('type the distance, press a line, wall or shape, then the side it goes.');
    else if (tool === 'mirror') mirrorSays(`press two points on the mirror line${mirrorKeep ? ' -- the original is kept' : ' -- the original is mirrored in place'}.`);
    else if (tool === 'rotate') turnSays('press the base point.');
    else if (tool === 'fillet') filletSays('press the first line or wall, on the part to keep.');
    else if (tool === 'array') sayOnStrip('ARRAY: type how many across and down and the spacing, then MAKE.');
  };
  function syncDraftCommandBars() {
    const up = !modalUp() && !activeCut() ? activeTool : null;
    const bars = { offset: offsetBar, mirror: mirrorBar, rotate: turnBar, fillet: filletBar, array: arrayBar };
    let any = false;
    Object.entries(bars).forEach(([tool, bar]) => {
      if (!bar) return;
      bar.hidden = up !== tool;
      if (!bar.hidden) any = true;
    });
    if (!any) return;
    [deleteButton, undoButton, copyButton, pasteButton, rotateButton, flipButton, orderButton, moveButton, breakButton, rescaleButton]
      .forEach(b => { if (b) b.hidden = true; });
    [rotateBar, flipBar, orderBar, rescaleBar].forEach(b => { if (b) b.hidden = true; });
  }
  toolListeners.push(next => {
    draftCmd.offset.pick = null;
    draftCmd.mirror.a = null;
    draftCmd.turn.base = null;
    draftCmd.fillet.first = null;
    if (turnAngleBox) turnAngleBox.value = '';
    if (next === 'offset' && offsetDistBox && !offsetDistBox.value.trim()) offsetDistBox.value = '1';
    if (next === 'array') {
      if (arrayBoxes.cols && !arrayBoxes.cols.value.trim()) arrayBoxes.cols.value = '3';
      if (arrayBoxes.dx && !arrayBoxes.dx.value.trim()) arrayBoxes.dx.value = '4';
      if (arrayBoxes.rows && !arrayBoxes.rows.value.trim()) arrayBoxes.rows.value = '1';
      if (arrayBoxes.dz && !arrayBoxes.dz.value.trim()) arrayBoxes.dz.value = '4';
    }
    syncDraftCommandBars();
    if (DRAFT_CMD_TOOLS.includes(next)) {
      draftCmdPrompt(next);
      // The number box takes the keyboard, so the first thing typed is the
      // distance and not a tool letter.
      const box = { offset: offsetDistBox, fillet: filletRadiusBox, array: arrayBoxes.cols }[next];
      if (box) { try { box.focus(); box.select(); } catch { /* not focusable yet */ } }
    }
  });
  // The boxes keep the page's keys to themselves (S would arm SELECT under
  // a typed "5"), ENTER commits what the tool is waiting for, Esc lets go.
  const draftBox = (box, onEnter) => {
    if (!box) return;
    box.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); box.blur(); if (!draftCommandsCancel()) setTool(RESTING_TOOL); paint(); return; }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      onEnter();
    });
    box.addEventListener('input', () => paint());
  };
  draftBox(offsetDistBox, () => { if (offsetDistance() != null) offsetSays(draftCmd.offset.pick ? 'now press the side it goes.' : 'now press the line, wall or shape.'); });
  draftBox(filletRadiusBox, () => { if (draftFeet(filletRadiusBox, { allowZero: true }) != null) filletSays(draftCmd.fillet.first ? 'now press the second line.' : 'now press the first line, on the part to keep.'); });
  draftBox(turnAngleBox, () => {
    const deg = draftDegrees(turnAngleBox);
    if (deg == null) { turnSays('type the turn in degrees, clockwise -- 90, 45, -30.'); return; }
    if (!draftCmd.turn.base) { turnSays('press the base point first, then ENTER turns by what is typed.'); return; }
    turnBy(deg);
    turnAngleBox.value = '';
  });
  Object.values(arrayBoxes).forEach(box => draftBox(box, arrayMake));
  arrayBar?.querySelector('[data-array-make]')?.addEventListener('click', arrayMake);
