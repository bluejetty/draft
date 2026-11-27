// THE LANDSCAPE PAGE -- open a drawing, show its SITE plan, grade the lot.
//
// RUFF LANDSCAPE / ROUGH LANDSCAPE (jb, 27 Nov 2026): "an area where the house
// stays as it is and the user can manipulate the landscape for the lot
// grading", in 2D -- a grading plan, the way one is drawn by hand: spot
// elevations, the ground between them straight-line, contours, slope arrows.
//
// THE HOUSE IS NOT TOUCHED. The page draws it with the drafter's own SITE
// painter (layout-plan.js drawPlan) and has no tool that edits it. What this
// page writes is the drawing's `landscape` block and nothing else; SAVE
// writes the file back with that one key changed.
//
// FROM THE DRAFTER (?from=drafter): MODEL's OPEN LANDSCAPE chip opens this
// tab and hands it the drawing as it stands. Every change here is handed
// back to that tab, so the drafter's own SAVE keeps the grading.
//
// window.DraftLandscape is the page's handle, for the spec.
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const Gr = window.DraftGrading;
  const SITE_LEVEL_ID = 8;
  const FROM_DRAFTER = new URLSearchParams(location.search).get('from') === 'drafter';

  const state = {
    saved: null,          // the drawing as opened (the house), never changed
    name: null,
    land: null,           // the landscape block being edited
    houseGrade: null,     // y of grade at the house (cut-view's foundation grade)
    gradeGuessed: false,
    house: [],            // footprint polygons [{ id, points }]
    lot: null,            // lot polygon, or null
    work: null,           // the polygon the ground covers (lot, or a box round the house)
    tool: 'pick',
    show: { contours: true, arrows: true, existing: true, checks: true },
    picked: null,         // { kind: 'spot', id } | { kind: 'corner', key }
    camX: 0, camZ: 0, pxPerFt: 6,
    history: [],
    surface: null, existing: null, checks: null,
    frames: 0,
    brand: 'RUFF LANDSCAPE',
  };

  // THE NAME FOLLOWS THE SKIN, the same pick RUFF 3D makes: ?theme= first,
  // then the drafter's chosen skin, then the door the visit came in by.
  function brandName() {
    const P = window.DraftPalette;
    const themes = P && P.THEMES ? P.THEMES : ['ruff', 'rough'];
    let theme = new URLSearchParams(location.search).get('theme');
    if (!themes.includes(theme)) {
      try { theme = (JSON.parse(localStorage.getItem('draft-skin') || 'null') || {}).theme; } catch (e) { theme = null; }
    }
    if (!themes.includes(theme)) theme = P && P.homeTheme ? P.homeTheme() : 'ruff';
    return theme === 'rough' ? 'ROUGH LANDSCAPE' : 'RUFF LANDSCAPE';
  }

  function setStatus(text, warn) {
    const el = $('status');
    el.textContent = text;
    el.classList.toggle('warn', !!warn);
  }

  const datum = () => (state.land && Number.isFinite(state.land.datum) ? state.land.datum : 0);
  const shown = y => (y + datum()).toFixed(2);

  // ── THE HOUSE, READ ONCE ───────────────────────────────────────────────
  function readHouse(saved) {
    const LP = window.DraftLayoutPlan;
    const parts = LP && LP.sitePlanParts ? LP.sitePlanParts(saved) : { lot: null, bodies: [] };
    const house = (parts.bodies || []).map(o => ({ id: String(o.id || ''), points: o.points.map(p => ({ x: Number(p.x), z: Number(p.z) })) }))
      .filter(o => o.points.length >= 3 && o.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)));
    const lot = parts.lot ? parts.lot.points.map(p => ({ x: Number(p.x), z: Number(p.z) })) : null;
    // GRADE AT THE HOUSE: the elevations' own grade line (cut-view's
    // foundation stack), so the grading starts where the drawings say the
    // ground meets the house.
    let grade = null;
    try {
      const F = window.DraftDrawingFormat;
      const env = window.DraftCutViewEnv.buildCutViewEnv(saved, F.levels(saved.levels));
      const stack = env && window.DraftCutView.sectionLevelStack(env);
      if (stack && Number.isFinite(stack.foundation && stack.foundation.grade)) grade = stack.foundation.grade;
    } catch (e) { grade = null; }
    return { house, lot, grade };
  }

  function boxAround(polys, padFt) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    polys.forEach(poly => poly.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }));
    if (!Number.isFinite(minX)) { minX = -30; maxX = 30; minZ = -30; maxZ = 30; }
    return [{ x: minX - padFt, z: minZ - padFt }, { x: maxX + padFt, z: minZ - padFt },
      { x: maxX + padFt, z: maxZ + padFt }, { x: minX - padFt, z: maxZ + padFt }];
  }

  // A drawing with no landscape yet starts with a spot on each lot corner,
  // falling away from the house (grading.js defaultCornerHeight).
  function startingLandscape() {
    const polys = state.house.map(h => h.points);
    const spots = state.work.map((p, i) => ({
      id: `c${i + 1}`, x: p.x, z: p.z, kind: 'fg', lotCorner: true,
      y: Math.floor(Gr.defaultCornerHeight(state.houseGrade, polys.length ? Gr.distToPolys(p, polys) : 0) * 100) / 100,
    }));
    Gr.ringSpots(polys, state.work, state.houseGrade).forEach((p, i) => {
      spots.push({ id: `r${i + 1}`, x: p.x, z: p.z, y: p.y, kind: 'fg' });
    });
    const fileDatum = Number(state.saved.elevationDatum) === 100 ? 100 : 0;
    return { version: 1, spots, houseCorners: {}, interval: 1, datum: fileDatum };
  }

  function normalizeLand(raw) {
    const land = Gr.normalize(raw);
    land.datum = raw && Number(raw.datum) === 100 ? 100 : raw && Number(raw.datum) === 0 ? 0
      : (Number(state.saved.elevationDatum) === 100 ? 100 : 0);
    return land;
  }

  // Every known height: the spots of one kind, and (finished only) the
  // house corners at house grade unless one has its own.
  function cornerKey(h, i) { return `${h.id}:${i}`; }
  function houseCornerPoints() {
    const out = [];
    state.house.forEach(h => h.points.forEach((p, i) => {
      const key = cornerKey(h, i);
      const own = state.land.houseCorners[key];
      out.push({ x: p.x, z: p.z, y: Number.isFinite(own) ? own : state.houseGrade, key, own: Number.isFinite(own) });
    }));
    return out;
  }

  function rebuild() {
    if (!state.saved) return;
    const holes = state.house.map(h => h.points);
    const fg = state.land.spots.filter(s => s.kind === 'fg').concat(houseCornerPoints());
    state.surface = Gr.buildSurface(fg, { holes });
    const eg = state.land.spots.filter(s => s.kind === 'eg');
    // The ground as it is now runs under where the house will stand.
    state.existing = eg.length >= 3 ? Gr.buildSurface(eg) : null;
    const fall = Gr.fallChecks(state.surface, holes, state.lot || state.work);
    const slopes = Gr.slopeWarnings(state.surface);
    state.checks = { fall, steep: slopes.steep, flat: slopes.flat };
    showChecks();
    showSpotPanel();
    redraw();
  }

  // ── CHANGES, UNDO, AND THE TRIP BACK TO THE DRAFTER ───────────────────
  function change(fn) {
    state.history.push(JSON.stringify(state.land));
    if (state.history.length > 200) state.history.shift();
    fn();
    $('undo').disabled = false;
    rebuild();
    handBack();
  }
  function undo() {
    const last = state.history.pop();
    if (!last) return;
    state.land = JSON.parse(last);
    if (state.picked && state.picked.kind === 'spot' && !state.land.spots.some(s => s.id === state.picked.id)) state.picked = null;
    $('undo').disabled = !state.history.length;
    rebuild();
    handBack();
  }
  let handTimer = null;
  function handBack() {
    if (!FROM_DRAFTER) return;
    clearTimeout(handTimer);
    handTimer = setTimeout(() => {
      const opener = window.opener;
      if (!opener || opener.closed) { setStatus('The drafter tab is gone: use SAVE .draft to keep this grading.', true); return; }
      try {
        opener.postMessage({ type: 'draft-landscape-update', landscape: JSON.parse(JSON.stringify(state.land)) }, location.origin);
        document.body.dataset.handedBack = String((Number(document.body.dataset.handedBack) || 0) + 1);
      } catch (e) { /* the drafter went away */ }
    }, 150);
  }

  function nextSpotId() {
    const used = new Set(state.land.spots.map(s => s.id));
    let n = state.land.spots.length + 1;
    while (used.has(`s${n}`)) n += 1;
    return `s${n}`;
  }

  // ── SCREEN ↔ GROUND ────────────────────────────────────────────────────
  const canvas = () => $('plan');
  const dpr = () => window.devicePixelRatio || 1;
  const toS = p => {
    const c = canvas();
    return { x: c.width / 2 + (p.x - state.camX) * state.pxPerFt, y: c.height / 2 + (p.z - state.camZ) * state.pxPerFt };
  };
  const toGround = (px, py) => {
    const c = canvas();
    return { x: state.camX + (px - c.width / 2) / state.pxPerFt, z: state.camZ + (py - c.height / 2) / state.pxPerFt };
  };
  const eventPx = e => {
    const r = canvas().getBoundingClientRect();
    return { x: (e.clientX - r.left) * dpr(), y: (e.clientY - r.top) * dpr() };
  };

  function fit() {
    if (!state.work) return;
    const c = canvas();
    sizeCanvas();
    const box = boxAround([state.work, ...state.house.map(h => h.points)], 0);
    const w = box[1].x - box[0].x, h = box[2].z - box[1].z;
    state.camX = (box[0].x + box[1].x) / 2;
    state.camZ = (box[1].z + box[2].z) / 2;
    state.pxPerFt = Math.max(0.5, Math.min(c.width / (w * 1.25 || 1), c.height / (h * 1.25 || 1)));
    redraw();
  }

  function sizeCanvas() {
    const c = canvas();
    const r = c.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width * dpr())), H = Math.max(1, Math.round(r.height * dpr()));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  }

  // ── PAINTING ───────────────────────────────────────────────────────────
  const INK = {
    paper: '#ffffff',
    contour: '#8a5a2b',
    contourExisting: '#7d8790',
    arrow: '#1f5fa8',
    steep: 'rgba(214,48,32,0.20)',
    flat: 'rgba(240,180,41,0.28)',
    fail: '#d63020',
    spotFg: '#1d1f20',
    spotEg: '#6b747c',
    picked: '#f0b429',
  };

  let queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => { const s = toS(p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
    ctx.closePath();
  }

  function paint() {
    sizeCanvas();
    const c = canvas();
    const ctx = c.getContext('2d');
    const k = dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = INK.paper;
    ctx.fillRect(0, 0, c.width, c.height);
    if (!state.saved) return;

    // THE SITE PLAN, the drafter's own painter: lot, footprint, its rows.
    try {
      window.DraftLayoutPlan.drawPlan(ctx, toS, state.saved, SITE_LEVEL_ID, { paperColor: INK.paper });
    } catch (e) {
      // Drawn by hand below if the painter cannot: the grading still works.
      if (!state.paintFailed) { state.paintFailed = true; console.warn('LANDSCAPE: the site painter failed:', e); }
    }
    if (!state.lot) {
      // No lot on the SITE level: show the working area the grading covers.
      ctx.save();
      ctx.setLineDash([8 * k, 6 * k]);
      ctx.strokeStyle = '#7d8790'; ctx.lineWidth = 1.2 * k;
      poly(ctx, state.work); ctx.stroke();
      ctx.restore();
    }
    if (state.paintFailed) {
      ctx.save(); ctx.fillStyle = 'rgba(29,31,32,0.35)';
      state.house.forEach(h => { poly(ctx, h.points); ctx.fill(); });
      ctx.restore();
    }

    const S = state.surface;
    if (!S) return;

    // SLOPE WARNINGS UNDER EVERYTHING: too steep red, too flat amber.
    if (state.show.checks) {
      ctx.save();
      state.checks.steep.forEach(t => { ctx.fillStyle = INK.steep; poly(ctx, t.pts); ctx.fill(); });
      state.checks.flat.forEach(t => { ctx.fillStyle = INK.flat; poly(ctx, t.pts); ctx.fill(); });
      ctx.restore();
    }

    // CONTOURS. Existing first, dashed grey; finished over them, brown.
    const drawContours = (surface, colour, dashed) => {
      const lines = Gr.contours(surface, state.land.interval, datum());
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineCap = 'round';
      lines.forEach(line => {
        ctx.lineWidth = (line.major ? 2 : 1) * k;
        ctx.setLineDash(dashed ? [6 * k, 4 * k] : []);
        ctx.beginPath();
        line.segs.forEach(([a, b]) => { const A = toS(a), B = toS(b); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); });
        ctx.stroke();
      });
      // A label on each line, on its longest piece.
      ctx.setLineDash([]);
      ctx.font = `${11 * k}px "Barlow Condensed", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach(line => {
        let best = null, bestLen = 0;
        line.segs.forEach(seg => { const L = Math.hypot(seg[1].x - seg[0].x, seg[1].z - seg[0].z); if (L > bestLen) { bestLen = L; best = seg; } });
        if (!best || bestLen * state.pxPerFt < 40 * k) return;
        const A = toS(best[0]), B = toS(best[1]);
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        let ang = Math.atan2(B.y - A.y, B.x - A.x);
        if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
        const text = line.shown.toFixed(state.land.interval < 1 ? 1 : 0);
        ctx.save();
        ctx.translate(mx, my); ctx.rotate(ang);
        const w = ctx.measureText(text).width + 6 * k;
        ctx.fillStyle = INK.paper; ctx.fillRect(-w / 2, -7 * k, w, 14 * k);
        ctx.fillStyle = colour; ctx.fillText(text, 0, 0);
        ctx.restore();
      });
      ctx.restore();
      return lines.length;
    };
    let contourCount = 0;
    if (state.show.existing && state.existing) drawContours(state.existing, INK.contourExisting, true);
    if (state.show.contours) contourCount = drawContours(S, INK.contour, false);
    document.body.dataset.contours = String(contourCount);

    // SLOPE ARROWS: one per triangle big enough to hold one, pointing
    // downhill, with its fall in %.
    let arrows = 0;
    if (state.show.arrows) {
      ctx.save();
      ctx.strokeStyle = INK.arrow; ctx.fillStyle = INK.arrow;
      ctx.lineWidth = 1.4 * k;
      ctx.font = `${11 * k}px "Barlow Condensed", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      S.tris.forEach(t => {
        if (t.inHole || t.sliver || !t.down) return;
        const sizePx = Math.sqrt(Math.abs(Gr.area(t.pts))) * state.pxPerFt;
        if (sizePx < 46 * k) return;
        const len = Math.min(34 * k, sizePx * 0.35);
        const C = toS(t.centre);
        const dx = t.down.x * len / 2, dy = t.down.z * len / 2;
        const A = { x: C.x - dx, y: C.y - dy }, B = { x: C.x + dx, y: C.y + dy };
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        const ang = Math.atan2(B.y - A.y, B.x - A.x);
        ctx.beginPath();
        ctx.moveTo(B.x, B.y);
        ctx.lineTo(B.x - 7 * k * Math.cos(ang - 0.45), B.y - 7 * k * Math.sin(ang - 0.45));
        ctx.lineTo(B.x - 7 * k * Math.cos(ang + 0.45), B.y - 7 * k * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
        ctx.fillText(`${t.slopePct.toFixed(1)}%`, C.x, C.y + 6 * k);
        arrows += 1;
      });
      ctx.restore();
    }
    document.body.dataset.arrows = String(arrows);

    // FALL-AWAY FAILURES: a red tick from the wall out to where it was
    // measured.
    if (state.show.checks) {
      ctx.save();
      ctx.strokeStyle = INK.fail; ctx.fillStyle = INK.fail; ctx.lineWidth = 2 * k;
      state.checks.fall.fails.forEach(f => {
        const A = toS(f.at), B = toS(f.far);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(A.x, A.y, 3.5 * k, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }

    // HOUSE CORNERS: a small square and the grade there.
    ctx.save();
    ctx.font = `${12 * k}px "Barlow Condensed", system-ui, sans-serif`;
    houseCornerPoints().forEach(p => {
      const s = toS(p);
      const picked = state.picked && state.picked.kind === 'corner' && state.picked.key === p.key;
      ctx.fillStyle = picked ? INK.picked : (p.own ? INK.arrow : '#1d1f20');
      ctx.fillRect(s.x - 3.5 * k, s.y - 3.5 * k, 7 * k, 7 * k);
      label(ctx, s, shown(p.y), p.own ? INK.arrow : '#1d1f20', picked);
    });
    ctx.restore();

    // SPOTS: a cross for finished grade, a circle for existing.
    ctx.save();
    ctx.font = `${12 * k}px "Barlow Condensed", system-ui, sans-serif`;
    state.land.spots.forEach(spot => {
      const s = toS(spot);
      const picked = state.picked && state.picked.kind === 'spot' && state.picked.id === spot.id;
      const colour = spot.kind === 'eg' ? INK.spotEg : INK.spotFg;
      ctx.strokeStyle = picked ? INK.picked : colour;
      ctx.lineWidth = (picked ? 3 : 1.6) * k;
      ctx.beginPath();
      if (spot.kind === 'eg') {
        ctx.arc(s.x, s.y, 5 * k, 0, Math.PI * 2);
      } else {
        ctx.moveTo(s.x - 6 * k, s.y - 6 * k); ctx.lineTo(s.x + 6 * k, s.y + 6 * k);
        ctx.moveTo(s.x + 6 * k, s.y - 6 * k); ctx.lineTo(s.x - 6 * k, s.y + 6 * k);
      }
      ctx.stroke();
      label(ctx, s, `${spot.kind === 'eg' ? 'EG' : 'FG'} ${shown(spot.y)}`, colour, picked);
    });
    ctx.restore();

    state.frames += 1;
    document.body.dataset.frames = String(state.frames);
  }

  function label(ctx, s, text, colour, picked) {
    const k = dpr();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 6 * k;
    const x = s.x + 8 * k, y = s.y - 10 * k;
    ctx.fillStyle = picked ? INK.picked : 'rgba(255,255,255,0.88)';
    ctx.fillRect(x - 3 * k, y - 7 * k, w, 14 * k);
    ctx.fillStyle = picked ? '#0f2a4a' : colour;
    ctx.fillText(text, x, y);
  }

  // ── THE CHECKS PANEL ───────────────────────────────────────────────────
  function showChecks() {
    const box = $('checks');
    box.hidden = !state.saved || !state.show.checks;
    const c = state.checks;
    if (!c) return;
    const items = [];
    const fails = c.fall.fails.length;
    const short = c.fall.fails.filter(f => f.short).length;
    items.push(fails
      ? { cls: 'bad', colour: INK.fail, text: `${fails} place${fails === 1 ? '' : 's'} where the ground does not fall 6" in the first 10' from the house${short ? ` (${short} near the lot line: a swale is needed there)` : ''}` }
      : { cls: 'ok', colour: '#3aa35a', text: c.fall.checked ? 'The ground falls away from the house all round (6" in 10\')' : 'No house on the lot to check against' });
    items.push(c.steep.length
      ? { cls: 'bad', colour: '#d63020', text: `${c.steep.length} slope${c.steep.length === 1 ? '' : 's'} steeper than 3:1 (33%)` }
      : { cls: 'ok', colour: '#3aa35a', text: 'Nothing steeper than 3:1' });
    items.push(c.flat.length
      ? { cls: 'bad', colour: '#f0b429', text: `${c.flat.length} flat spot${c.flat.length === 1 ? '' : 's'} under 2% (water may sit)` }
      : { cls: 'ok', colour: '#3aa35a', text: 'No flat spots under 2%' });
    const list = $('check-list');
    list.textContent = '';
    items.forEach(it => {
      const li = document.createElement('li');
      li.className = it.cls;
      const dot = document.createElement('span');
      dot.className = 'dot'; dot.style.background = it.colour;
      const t = document.createElement('span'); t.textContent = it.text;
      li.append(dot, t);
      list.appendChild(li);
    });
    document.body.dataset.fallFails = String(fails);
    document.body.dataset.steep = String(c.steep.length);
    document.body.dataset.flat = String(c.flat.length);
  }

  // ── THE SPOT PANEL ─────────────────────────────────────────────────────
  function pickedThing() {
    const p = state.picked;
    if (!p || !state.land) return null;
    if (p.kind === 'spot') {
      const spot = state.land.spots.find(s => s.id === p.id);
      return spot ? { kind: 'spot', spot } : null;
    }
    const corner = houseCornerPoints().find(c => c.key === p.key);
    return corner ? { kind: 'corner', corner } : null;
  }

  function showSpotPanel() {
    const it = pickedThing();
    $('spot-panel').hidden = !it;
    if (!it) return;
    const input = $('spot-elev');
    if (it.kind === 'spot') {
      $('spot-title').textContent = it.spot.kind === 'eg' ? 'EXISTING SPOT' : (it.spot.lotCorner ? 'LOT CORNER (FINISHED)' : 'FINISHED SPOT');
      if (document.activeElement !== input) input.value = shown(it.spot.y);
      $('spot-note').textContent = it.spot.kind === 'eg'
        ? 'What the ground is now. Existing contours draw dashed once there are 3 of these.'
        : 'What the ground will be when the work is done.';
      $('spot-kind').hidden = false;
      $('spot-kind').textContent = it.spot.kind === 'eg' ? 'MAKE FINISHED' : 'MAKE EXISTING';
      $('spot-reset').hidden = true;
      $('spot-delete').hidden = false;
    } else {
      $('spot-title').textContent = 'HOUSE CORNER';
      if (document.activeElement !== input) input.value = shown(it.corner.y);
      $('spot-note').textContent = it.corner.own
        ? `Set here. The drafter's grade at the house is ${shown(state.houseGrade)}.`
        : `The drafter's grade at the house (the grade line on the elevations). Type a height to set this corner on its own.`;
      $('spot-kind').hidden = true;
      $('spot-reset').hidden = !it.corner.own;
      $('spot-delete').hidden = true;
    }
  }

  function typeElevation() {
    const it = pickedThing();
    if (!it) return;
    const raw = Gr.parseFeet($('spot-elev').value);
    if (raw == null) { setStatus(`"${$('spot-elev').value}" is not a height: type feet like 99.5 or 99'-6".`, true); return; }
    const y = Math.round((raw - datum()) * 1000) / 1000;
    if (it.kind === 'spot') {
      if (Math.abs(it.spot.y - y) < 1e-9) return;
      change(() => { state.land.spots.find(s => s.id === it.spot.id).y = y; });
    } else {
      change(() => { state.land.houseCorners[it.corner.key] = y; });
    }
    setStatus(`Set to ${shown(y)}.`);
  }

  // ── PICKING ON THE PLAN ────────────────────────────────────────────────
  function hitTest(px) {
    const k = dpr();
    const near = 10 * k;
    let best = null, bestD = near;
    state.land.spots.forEach(s => {
      const p = toS(s); const d = Math.hypot(p.x - px.x, p.y - px.y);
      if (d < bestD) { bestD = d; best = { kind: 'spot', id: s.id }; }
    });
    houseCornerPoints().forEach(c => {
      const p = toS(c); const d = Math.hypot(p.x - px.x, p.y - px.y);
      if (d < bestD) { bestD = d; best = { kind: 'corner', key: c.key }; }
    });
    return best;
  }

  function placeSpot(ground, kind) {
    if (state.house.some(h => Gr.inside(ground, h.points))) {
      setStatus('That is inside the house: spots go on the ground round it.', true);
      return;
    }
    const here = Gr.heightAt(kind === 'eg' && state.existing ? state.existing : state.surface, ground);
    const y = Math.round((here == null ? state.houseGrade - 0.5 : here) * 100) / 100;
    const id = nextSpotId();
    change(() => { state.land.spots.push({ id, x: Math.round(ground.x * 100) / 100, z: Math.round(ground.z * 100) / 100, y, kind }); });
    state.picked = { kind: 'spot', id };
    showSpotPanel();
    const input = $('spot-elev');
    input.focus(); input.select();
    setStatus(`${kind === 'eg' ? 'Existing' : 'Finished'} spot placed at ${shown(y)} (the ground there now). Type its height and press Enter.`);
  }

  function deletePicked() {
    const it = pickedThing();
    if (!it || it.kind !== 'spot') return;
    change(() => { state.land.spots = state.land.spots.filter(s => s.id !== it.spot.id); });
    state.picked = null;
    showSpotPanel();
    redraw();
  }

  function wireStage() {
    const stage = $('stage');
    const c = canvas();
    let drag = null;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      if (!state.saved) return;
      const px = eventPx(e);
      c.setPointerCapture(e.pointerId);
      if (e.button === 1 || e.button === 2) { drag = { pan: true, px }; return; }
      if (state.tool === 'fg' || state.tool === 'eg') {
        placeSpot(toGround(px.x, px.y), state.tool);
        drag = null;
        return;
      }
      const hit = hitTest(px);
      state.picked = hit;
      showSpotPanel();
      redraw();
      if (hit && hit.kind === 'spot') {
        const spot = state.land.spots.find(s => s.id === hit.id);
        drag = { spot: hit.id, px, start: { x: spot.x, z: spot.z }, moved: false };
      } else {
        drag = { pan: true, px };
      }
    });
    c.addEventListener('pointermove', e => {
      if (!drag) return;
      const px = eventPx(e);
      if (drag.pan) {
        state.camX -= (px.x - drag.px.x) / state.pxPerFt;
        state.camZ -= (px.y - drag.px.y) / state.pxPerFt;
        drag.px = px;
        redraw();
        return;
      }
      if (!drag.moved && Math.hypot(px.x - drag.px.x, px.y - drag.px.y) < 4 * dpr()) return;
      if (!drag.moved) { state.history.push(JSON.stringify(state.land)); $('undo').disabled = false; drag.moved = true; }
      const g = toGround(px.x, px.y);
      const spot = state.land.spots.find(s => s.id === drag.spot);
      if (!spot) return;
      spot.x = Math.round(g.x * 100) / 100; spot.z = Math.round(g.z * 100) / 100;
      rebuild();
    });
    const end = () => {
      if (drag && drag.moved) handBack();
      drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', e => {
      if (!state.saved) return;
      e.preventDefault();
      const px = eventPx(e);
      const before = toGround(px.x, px.y);
      const f = Math.exp(-e.deltaY * 0.0015);
      state.pxPerFt = Math.max(0.3, Math.min(200, state.pxPerFt * f));
      const after = toGround(px.x, px.y);
      state.camX += before.x - after.x; state.camZ += before.z - after.z;
      redraw();
    }, { passive: false });

    // Drop a file anywhere on the stage.
    stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('dropping'); });
    stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
    stage.addEventListener('drop', e => {
      e.preventDefault(); stage.classList.remove('dropping');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) openFile(f);
    });
    window.addEventListener('resize', redraw);
  }

  function wireChrome() {
    $('open').addEventListener('click', () => $('file').click());
    $('file').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFile(f); e.target.value = ''; });
    $('fit').addEventListener('click', fit);
    $('undo').addEventListener('click', undo);
    $('save').addEventListener('click', saveFile);
    document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
    document.querySelectorAll('[data-interval]').forEach(b => b.addEventListener('click', () => {
      if (!state.land) return;
      const v = Number(b.dataset.interval);
      if (state.land.interval !== v) change(() => { state.land.interval = v; });
      showChips();
    }));
    document.querySelectorAll('[data-datum]').forEach(b => b.addEventListener('click', () => {
      if (!state.land) return;
      const v = Number(b.dataset.datum);
      if (state.land.datum !== v) change(() => { state.land.datum = v; });
      showChips();
    }));
    document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => {
      state.show[b.dataset.show] = !state.show[b.dataset.show];
      showChips(); showChecks(); redraw();
    }));
    const input = $('spot-elev');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); typeElevation(); input.blur(); }
      if (e.key === 'Escape') { input.blur(); showSpotPanel(); }
      e.stopPropagation();
    });
    input.addEventListener('change', typeElevation);
    $('spot-delete').addEventListener('click', deletePicked);
    $('spot-reset').addEventListener('click', () => {
      const it = pickedThing();
      if (!it || it.kind !== 'corner') return;
      change(() => { delete state.land.houseCorners[it.corner.key]; });
    });
    $('spot-kind').addEventListener('click', () => {
      const it = pickedThing();
      if (!it || it.kind !== 'spot') return;
      change(() => {
        const s = state.land.spots.find(o => o.id === it.spot.id);
        s.kind = s.kind === 'eg' ? 'fg' : 'eg';
        delete s.lotCorner;
      });
    });
    window.addEventListener('keydown', e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { deletePicked(); return; }
      if (e.key === 'Escape') { state.picked = null; setTool('pick'); showSpotPanel(); redraw(); return; }
      if (e.key === 'f' || e.key === 'F') fit();
    });
  }

  function setTool(tool) {
    state.tool = tool;
    showChips();
    canvas().style.cursor = tool === 'pick' ? 'default' : 'crosshair';
  }

  function showChips() {
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('lit', b.dataset.tool === state.tool));
    document.querySelectorAll('[data-interval]').forEach(b => b.classList.toggle('lit', !!state.land && Number(b.dataset.interval) === state.land.interval));
    document.querySelectorAll('[data-datum]').forEach(b => b.classList.toggle('lit', !!state.land && Number(b.dataset.datum) === state.land.datum));
    document.querySelectorAll('[data-show]').forEach(b => b.classList.toggle('lit', !!state.show[b.dataset.show]));
  }

  // ── OPENING AND SAVING ─────────────────────────────────────────────────
  async function readDrawing(file) {
    const Z = window.DraftZipBundle;
    if (Z && await Z.looksLikeZip(file)) {
      const bundle = await Z.readBundle(file);
      return { saved: JSON.parse(await bundle.drawingFile.text()), name: bundle.drawingFile.name };
    }
    return { saved: JSON.parse(await file.text()), name: file.name };
  }

  function loadDrawing(saved, name) {
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.levels)) throw new Error('that is not a Rough Drafter drawing');
    state.saved = saved;
    state.name = name || 'drawing';
    state.paintFailed = false;
    const read = readHouse(saved);
    state.house = read.house;
    state.lot = read.lot;
    state.gradeGuessed = read.grade == null;
    state.houseGrade = read.grade == null ? -1 : read.grade;
    state.work = state.lot || boxAround(state.house.map(h => h.points), 25);
    state.land = saved.landscape ? normalizeLand(saved.landscape) : startingLandscape();
    state.history = [];
    state.picked = null;
    $('undo').disabled = true;
    $('save').disabled = false;
    $('drop-hint').hidden = true;
    document.title = `${state.name} - ${state.brand}`;
    showChips();
    fit();
    rebuild();
    const bits = [`${state.name}: grade at the house ${shown(state.houseGrade)}`];
    if (state.gradeGuessed) bits.push('(guessed: the drawing has no foundation to read it from)');
    if (!state.lot) bits.push('· no lot drawn on SITE, so grading a box 25\' round the house');
    if (!state.house.length) bits.push('· no house footprint on this drawing');
    setStatus(bits.join(' '), state.gradeGuessed || !state.lot);
    document.body.dataset.loaded = '1';
    if (!saved.landscape) handBack();
    return state;
  }

  async function openFile(file) {
    if (!file) return null;
    setStatus(`Opening ${file.name}...`);
    try {
      const { saved, name } = await readDrawing(file);
      return loadDrawing(saved, name);
    } catch (e) {
      setStatus(`Could not open ${file.name}: ${e && e.message ? e.message : e}`, true);
      document.body.dataset.loaded = 'error';
      return null;
    }
  }

  // THE FILE BACK, house untouched: the drawing as opened with only its
  // `landscape` key replaced.
  function fileText() {
    return JSON.stringify({ ...state.saved, landscape: state.land });
  }
  function saveFile() {
    if (!state.saved) return;
    const base = String(state.name || 'drawing').replace(/\.(draft|json|zip)$/i, '').replace(/[\\/:*?"<>|]+/g, '-') || 'drawing';
    const blob = new Blob([fileText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${base}.draft`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    setStatus(`Saved ${base}.draft with its grading. The house in it is as it was.`);
  }

  // ── FROM THE DRAFTER ───────────────────────────────────────────────────
  function listenForDrafter() {
    if (!FROM_DRAFTER) return;
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'draft-landscape-drawing') return;
      try {
        loadDrawing(e.data.drawing, e.data.name || 'drawing');
        setStatus(`${$('status').textContent} · changes go back to the drafter tab: SAVE there to keep them.`);
      } catch (err) {
        setStatus(`Could not open the drawing: ${err && err.message ? err.message : err}`, true);
        document.body.dataset.loaded = 'error';
      }
    });
    const opener = window.opener;
    if (opener && !opener.closed) {
      setStatus('Bringing the drawing over from the drafter...');
      try { opener.postMessage({ type: 'draft-landscape-ready' }, location.origin); } catch (e) { /* gone */ }
    } else {
      setStatus('Open a .draft or a SAVE AS ZIP to grade its lot. (The drafter tab that opened this one is gone.)');
    }
  }

  function boot() {
    state.brand = brandName();
    $('brand').textContent = state.brand;
    document.title = state.brand;
    document.body.dataset.brand = state.brand;
    wireChrome();
    wireStage();
    showChips();
    sizeCanvas();
    paint();
    if (FROM_DRAFTER) listenForDrafter();
    else setStatus('Open a .draft or a SAVE AS ZIP to grade its lot.');
  }

  window.DraftLandscape = { state, openFile, loadDrawing, fit, redraw, rebuild, fileText, placeSpot, undo,
    pick: p => { state.picked = p; showSpotPanel(); redraw(); }, toS, toGround };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
