// THE VIEWER PAGE -- open a file, build the house, pick a painter, turn it.
//
// Opens a .draft (the drawing as SAVE writes it) or a SAVE AS ZIP (the
// drafter's own zip reader, zip-bundle.js, finds the drawing inside).
// Builds the faces once (house-mesh.js) and hands them to whichever painter
// this browser can run: WebGL when it can, plain canvas when it cannot, and
// the PAINTER chips let you force either one.
//
// window.DraftViewer is the page's handle, for the spec and for later phases
// (EXPORT writes `state.shown`, what is on screen).
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const LOOK = { background: '#dfe6ee', ambient: 0.42, edges: true, section: false, cutColour: '#4a4744' };
  const PAINTER_KEY = 'draft-viewer-painter';

  const state = {
    name: null,
    faces: [],
    counts: null,
    camera: null,
    painterWanted: 'auto',   // 'auto' | 'webgl' | 'plain'
    painter: null,
    webglOk: false,
    frames: 0,
    lastDrawn: 0,
    brand: 'RUFF 3D',
    groups: [],          // [{ id, name }] the level chips, lowest first
    hidden: new Set(),   // group ids switched off
    cut: { axis: 'off', at: 0.5, flip: false },
    shown: [],           // the faces the painter has now (levels and cut applied)
  };

  // THE NAME FOLLOWS THE SKIN (jb, 26 Nov 2026: "ROUGH 3D / RUFF 3D"). The
  // same pick MODEL makes: ?theme= first, then the skin the drafter chose
  // (localStorage 'draft-skin'), then the door the visit came in by.
  function brandName() {
    const P = window.DraftPalette;
    const themes = P ? P.THEMES : ['ruff', 'rough'];
    let theme = new URLSearchParams(location.search).get('theme');
    if (!themes.includes(theme)) {
      try { theme = (JSON.parse(localStorage.getItem('draft-skin') || 'null') || {}).theme; } catch (e) { theme = null; }
    }
    if (!themes.includes(theme)) theme = P ? P.homeTheme() : 'ruff';
    return { theme, name: theme === 'rough' ? 'ROUGH 3D' : 'RUFF 3D' };
  }

  const readPref = () => { try { return localStorage.getItem(PAINTER_KEY); } catch (e) { return null; } };
  const writePref = v => { try { localStorage.setItem(PAINTER_KEY, v); } catch (e) { /* private window */ } };

  function setStatus(text, warn) {
    const el = $('status');
    el.textContent = text;
    el.classList.toggle('warn', !!warn);
  }

  // ── PAINTERS ───────────────────────────────────────────────────────────
  function choosePainter() {
    const want = state.painterWanted;
    const useWebgl = want === 'webgl' ? state.webglOk : want === 'auto' ? state.webglOk : false;
    const kind = useWebgl ? 'webgl' : 'plain';
    if (state.painter && state.painter.kind === kind) return;
    if (state.painter) state.painter.dispose();
    state.painter = null;
    $('gl').hidden = kind !== 'webgl';
    $('plain').hidden = kind !== 'plain';
    if (kind === 'webgl') {
      try {
        state.painter = window.DraftPaintWebGL.create($('gl'));
      } catch (e) {
        // The test said yes and the context still failed: say so, and
        // fall back rather than show nothing.
        state.webglOk = false;
        $('gl').hidden = true; $('plain').hidden = false;
        state.painter = window.DraftPaintCanvas.create($('plain'));
      }
    } else {
      state.painter = window.DraftPaintCanvas.create($('plain'));
    }
    if (state.faces.length) state.painter.setFaces(state.shown);
    showPainterChips();
  }

  function showPainterChips() {
    document.querySelectorAll('[data-painter]').forEach(btn => {
      btn.classList.toggle('lit', btn.dataset.painter === state.painterWanted);
      if (btn.dataset.painter === 'webgl') btn.disabled = !state.webglOk;
    });
    const using = state.painter ? state.painter.kind : null;
    $('painter-note').textContent = using === 'webgl' ? 'WEBGL'
      : state.webglOk ? 'PLAIN' : 'PLAIN (no WebGL on this computer)';
    document.body.dataset.painter = using || '';
  }

  let queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!state.painter || !state.camera) return;
      state.lastDrawn = state.painter.render(state.camera, LOOK);
      state.frames += 1;
      if (EMBED) toParent({ type: 'draft-viewer-camera', camera: state.camera });
      document.body.dataset.frames = String(state.frames);
    });
  }

  // ── LEVELS AND THE SECTION CUT ─────────────────────────────────────────
  //
  // Neither changes the house: they choose which of its faces go to the
  // painter. A level chip leaves a whole level out (house-mesh.js tags each
  // face with its level); the SECTION cuts every face at one plane and keeps
  // one side, and the painter shows what the cut opens up in the cut colour.
  function showLevelChips() {
    const box = $('levels');
    box.textContent = '';
    state.groups.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.level = g.id;
      b.textContent = g.name;
      b.title = `Show or hide ${g.name}`;
      b.classList.toggle('lit', !state.hidden.has(g.id));
      b.addEventListener('click', () => {
        if (state.hidden.has(g.id)) state.hidden.delete(g.id); else state.hidden.add(g.id);
        b.classList.toggle('lit', !state.hidden.has(g.id));
        applyView();
      });
      box.appendChild(b);
    });
  }

  // The cut plane: keep the side of `axis` at or below `value` (or above,
  // flipped). x and z cut upright, y takes the top off like a plan.
  function cutPlane() {
    const c = state.cut;
    if (c.axis === 'off' || !state.bounds) return null;
    const lo = state.bounds.lo[c.axis], hi = state.bounds.hi[c.axis];
    // PLAN's slider runs from the slab to the ridge; a little in from each
    // end on the others so the far end still cuts something.
    const value = lo + (hi - lo) * c.at;
    return { axis: c.axis, value, keepBelow: !c.flip };
  }

  // Sutherland-Hodgman against one axis-aligned plane, keeping each kept
  // edge's seam flag; an edge made along the cut is a real edge (it outlines
  // the section).
  function clipFace(f, plane) {
    const { axis, value, keepBelow } = plane;
    const inside = p => (keepBelow ? p[axis] <= value + 1e-9 : p[axis] >= value - 1e-9);
    const pts = f.pts, n = pts.length;
    if (pts.every(inside)) return f;
    if (!pts.some(inside)) return null;
    const out = [], seams = [];
    const cross = (p, q) => {
      const t = (value - p[axis]) / (q[axis] - p[axis]);
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t };
    };
    for (let i = 0; i < n; i += 1) {
      const p = pts[i], q = pts[(i + 1) % n];
      const seam = !!(f.seams && f.seams[i]);
      const pin = inside(p), qin = inside(q);
      if (pin) {
        out.push(p); seams.push(seam);
        if (!qin) { out.push(cross(p, q)); seams.push(false); }
      } else if (qin) {
        out.push(cross(p, q)); seams.push(seam);
      }
    }
    if (out.length < 3) return null;
    const g = { ...f, pts: out };
    if (seams.some(Boolean)) g.seams = seams; else delete g.seams;
    return g;
  }

  function applyView() {
    const plane = cutPlane();
    let list = state.faces.filter(f => !f.group || !state.hidden.has(f.group));
    if (plane) list = list.map(f => clipFace(f, plane)).filter(Boolean);
    state.shown = list;
    LOOK.section = !!plane;
    if (state.painter) state.painter.setFaces(list);
    document.body.dataset.shown = String(list.length);
    $('export-open').disabled = !list.length;
    $('print-open').disabled = !list.length;
    if (!$('print').hidden) showPrintPanel();
    redraw();
  }

  function showCutChips() {
    document.querySelectorAll('[data-cut]').forEach(b => b.classList.toggle('lit', b.dataset.cut === state.cut.axis));
    $('cut-at').disabled = state.cut.axis === 'off';
    $('cut-flip').disabled = state.cut.axis === 'off';
    $('cut-flip').classList.toggle('lit', state.cut.flip);
  }

  // ── OPENING A FILE ─────────────────────────────────────────────────────
  async function readDrawing(file) {
    const Z = window.DraftZipBundle;
    if (Z && await Z.looksLikeZip(file)) {
      const bundle = await Z.readBundle(file);
      return { saved: JSON.parse(await bundle.drawingFile.text()), name: bundle.drawingFile.name, zip: true };
    }
    return { saved: JSON.parse(await file.text()), name: file.name, zip: false };
  }

  function loadDrawing(saved, name) {
    const t0 = performance.now();
    const built = window.DraftHouseMesh.build(saved);
    state.saved = saved;
    state.faces = built.faces;
    state.counts = built.counts;
    state.stack = built.stack;
    state.name = name || 'drawing';
    state.camera = window.DraftViewerCamera.fit(built.bounds);
    state.bounds = built.bounds;
    state.groups = built.groups || [];
    state.hidden = new Set();
    showLevelChips();
    applyView();
    $('drop-hint').hidden = state.faces.length > 0;
    document.title = `${state.name} - ${state.brand}`;
    const c = built.counts;
    const extra = [[c.windows, 'windows'], [c.doors, 'doors'], [c.stairs, 'stairs'], [c.decks, 'decks'], [c.beams, 'beams'], [c.posts, 'posts'], [c.holograms, 'holograms']]
      .filter(([n]) => n > 0).map(([n, w]) => `, ${n} ${n === 1 ? w.replace(/s$/, '') : w}`).join('');
    setStatus(`${state.name}: ${c.walls} walls, ${c.foundationWalls} foundation walls, ${c.floors} floors, ${c.roofs} roofs, ${c.gables} gable ends${extra}`
      + ` (${Math.round(performance.now() - t0)} ms)`, !state.faces.length);
    document.body.dataset.loaded = String(state.faces.length);
    redraw();
    return built;
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

  // ── MOUSE, WHEEL, KEYS, TOUCH ──────────────────────────────────────────
  function wireControls(stage) {
    const C = window.DraftViewerCamera;
    let drag = null;
    // The EXPORT panel floats over the stage: presses on it are its own.
    // So is the view-button bar on a sheet (?embed=1).
    const onPanel = e => !!(e.target.closest && e.target.closest('.panel, #embed-bar'));
    stage.addEventListener('contextmenu', e => { if (!onPanel(e)) e.preventDefault(); });
    stage.addEventListener('pointerdown', e => {
      if (!state.camera || onPanel(e)) return;
      stage.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey };
    });
    stage.addEventListener('pointermove', e => {
      if (!drag || !state.camera) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      state.camera = drag.pan ? C.pan(state.camera, dx, dy, stage.clientHeight)
        : C.orbit(state.camera, -dx * 0.4, dy * 0.3);
      redraw();
    });
    const end = () => { drag = null; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', e => {
      if (!state.camera || onPanel(e)) return;
      e.preventDefault();
      state.camera = C.zoom(state.camera, Math.exp(e.deltaY * 0.0015));
      redraw();
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (!state.camera || e.target.closest('input,select,textarea')) return;
      const step = 15;   // degrees a press, like the 3D ISO arrows
      const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (moves[e.key]) {
        state.camera = C.orbit(state.camera, moves[e.key][0], moves[e.key][1]);
      } else if (e.key === '+' || e.key === '=') state.camera = C.zoom(state.camera, 0.85);
      else if (e.key === '-') state.camera = C.zoom(state.camera, 1 / 0.85);
      else if (e.key === 'f' || e.key === 'F' || e.key === 'Home') fit();
      else return;
      e.preventDefault();
      redraw();
    });
    // Two fingers pinch to zoom; pointer events already give one-finger orbit.
    let pinch = null;
    stage.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        drag = null;
        pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || !pinch || !state.camera) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      state.camera = C.zoom(state.camera, pinch / Math.max(d, 1));
      pinch = d;
      redraw();
    }, { passive: true });
    stage.addEventListener('touchend', () => { pinch = null; });
  }

  function fit() {
    if (!state.faces.length) return;
    let lo = { x: Infinity, y: Infinity, z: Infinity }, hi = { x: -Infinity, y: -Infinity, z: -Infinity };
    state.faces.forEach(f => f.pts.forEach(p => {
      lo = { x: Math.min(lo.x, p.x), y: Math.min(lo.y, p.y), z: Math.min(lo.z, p.z) };
      hi = { x: Math.max(hi.x, p.x), y: Math.max(hi.y, p.y), z: Math.max(hi.z, p.z) };
    }));
    state.camera = window.DraftViewerCamera.fit({ lo, hi });
    redraw();
  }

  // ── EXPORT ─────────────────────────────────────────────────────────────
  //
  // 1 bone a file (jb, 25 Nov 2026), taken once the file is written: a
  // cancelled save picker costs nothing, and at 0 bones the press is refused
  // in words. What goes in the file is what is on screen (state.shown), so
  // a level switched off or a section cut exports that way.
  const UNIT_KEY = 'draft-viewer-unit';
  const exportCost = () => {
    const W = window.DraftBoneWallet;
    return W && W.COSTS.export3d ? W.COSTS.export3d : 1;
  };
  const bonesWord = n => (window.DraftBoneWallet ? window.DraftBoneWallet.bonesWord(n) : `${n} bone${n === 1 ? '' : 's'}`);
  const held = () => (window.DraftBoneWallet ? window.DraftBoneWallet.read().balance : 0);

  function exportUnit() {
    let u = null;
    try { u = localStorage.getItem(UNIT_KEY); } catch (e) { u = null; }
    return window.DraftExportWriters.UNITS[u] ? u : 'ft';
  }

  function showExportToll(said) {
    const el = $('export-toll');
    const cost = exportCost(), have = held();
    const short = have < cost;
    el.textContent = said || (short
      ? `An export costs ${bonesWord(cost)} and you have ${have}. A free bone drips in every hour. Turning the house round is free.`
      : `Each file costs ${bonesWord(cost)} (you have ${have}).`);
    el.classList.toggle('warn', short && !said);
  }

  function showExportPanel() {
    const X = window.DraftExportWriters;
    const unit = exportUnit();
    document.querySelectorAll('[data-unit]').forEach(b => b.classList.toggle('lit', b.dataset.unit === unit));
    const box = $('export-formats');
    box.textContent = '';
    X.FORMATS.forEach(f => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.export = f.id;
      const label = document.createElement('b');
      label.textContent = f.label;
      const note = document.createElement('span');
      note.textContent = f.metresOnly || unit === 'm' ? f.note : `${f.note}, ${X.UNITS[unit].label.toLowerCase()}`;
      b.append(label, note);
      b.addEventListener('click', () => exportFile(f.id));
      box.appendChild(b);
    });
    showExportToll();
  }

  // Write the blob where the person says (the save picker), or into the
  // downloads folder where the browser has no picker. Resolves false when
  // the picker was cancelled.
  async function writeOut(file) {
    if (window.showSaveFilePicker) {
      let handle;
      try {
        const ext = file.name.slice(file.name.lastIndexOf('.'));
        handle = await window.showSaveFilePicker({
          suggestedName: file.name,
          types: [{ description: `${ext.slice(1).toUpperCase()} file`, accept: { [file.mime || 'application/octet-stream']: [ext] } }],
        });
      } catch (e) {
        if (e && e.name === 'AbortError') return false;
        throw e;
      }
      const w = await handle.createWritable();
      await w.write(file.blob);
      await w.close();
      return true;
    }
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }

  let exporting = false;
  async function exportFile(id) {
    if (exporting || !state.shown.length) return null;
    const W = window.DraftBoneWallet;
    const cost = exportCost();
    if (!W || held() < cost) { showExportToll(); return null; }
    const format = window.DraftExportWriters.FORMATS.find(f => f.id === id);
    const unit = format.metresOnly ? 'm' : exportUnit();
    const base = String(state.name || 'house').replace(/\.(draft|json|zip)$/i, '').replace(/[\\/:*?"<>|]+/g, '-') || 'house';
    exporting = true;
    try {
      showExportToll(`Writing the ${format.label}...`);
      const file = await window.DraftExportWriters.exportAs(id, state.shown, base, unit);
      const written = await writeOut(file);
      if (!written) { showExportToll(`${format.label} not saved: the save was cancelled, no bone taken. Each file costs ${bonesWord(cost)} (you have ${held()}).`); return null; }
      W.spend(cost);
      window.dispatchEvent(new CustomEvent('draft-bones-changed'));
      showExportToll(`Saved ${file.name} (${bonesWord(cost)}, ${held()} left).`);
      document.body.dataset.exported = file.name;
      return file;
    } catch (e) {
      showExportToll(`Could not write the ${format.label}: ${e && e.message ? e.message : e}. No bone taken.`);
      return null;
    } finally {
      exporting = false;
    }
  }

  function wireExport() {
    $('export-open').addEventListener('click', () => {
      const panel = $('export');
      closePanel('print');
      panel.hidden = !panel.hidden;
      $('export-open').classList.toggle('lit', !panel.hidden);
      if (!panel.hidden) showExportPanel();
    });
    $('export-close').addEventListener('click', () => closePanel('export'));
    document.querySelectorAll('[data-unit]').forEach(b => b.addEventListener('click', () => {
      try { localStorage.setItem(UNIT_KEY, b.dataset.unit); } catch (e) { /* private window */ }
      showExportPanel();
    }));
    // A bone spent in a drafter tab, or dripped in, shows here too.
    window.addEventListener('storage', e => { if (e.key === 'draft-bone-wallet' && !$('export').hidden) showExportToll(); });
    window.addEventListener('draft-bones-changed', () => { if (!$('export').hidden && !exporting) showExportToll(); });
  }

  // ── PRINT MODEL ────────────────────────────────────────────────────────
  //
  // Phase 6 (jb, 26 Nov 2026: "go Sir !!"). The panel builds the print house
  // (print-model.js) at the scale picked, lists each piece's size on the bed,
  // and writes a 3MF or STL for 1 bone, taken once the file is written, the
  // same rule as EXPORT. What prints is the levels switched on.
  const PRINT_KEY = 'draft-viewer-print';
  const printCost = () => {
    const W = window.DraftBoneWallet;
    return W && W.COSTS.printModel ? W.COSTS.printModel : 1;
  };
  function printPrefs() {
    let got = {};
    try { got = JSON.parse(localStorage.getItem(PRINT_KEY) || '{}') || {}; } catch (e) { got = {}; }
    const P = window.DraftPrintModel;
    return {
      scale: P.SCALES.some(sc => sc.id === got.scale) ? got.scale : '96',
      split: got.split === 'one' ? 'one' : 'lift',
      format: got.format === 'stl' ? 'stl' : '3mf',
    };
  }
  function setPrintPref(key, value) {
    const next = { ...printPrefs(), [key]: value };
    try { localStorage.setItem(PRINT_KEY, JSON.stringify(next)); } catch (e) { /* private window */ }
  }

  function closePanel(id) {
    $(id).hidden = true;
    $(`${id}-open`).classList.remove('lit');
  }

  const sizeWords = ([w, d, h]) => {
    const mm = [w, d, h].map(v => Math.round(v)).join(' × ');
    const inch = [w, d, h].map(v => (v / 25.4).toFixed(1)).join(' × ');
    return `${mm} mm (${inch} in)`;
  };

  // The pieces as they stand for the chips picked: built fresh each time,
  // so a level switched off drops out of the list.
  function printPlan() {
    const P = window.DraftPrintModel, pref = printPrefs();
    const scale = P.SCALES.find(sc => sc.id === pref.scale);
    const placed = state.saved ? P.prepare(state.saved, { ratio: scale.ratio, split: pref.split, hidden: state.hidden }) : [];
    return { pref, scale, placed };
  }

  function showPrintToll(said) {
    const el = $('print-toll');
    const cost = printCost(), have = held();
    const short = have < cost;
    el.textContent = said || (short
      ? `A print file costs ${bonesWord(cost)} and you have ${have}. A free bone drips in every hour. Turning the house round is free.`
      : `Costs ${bonesWord(cost)} (you have ${have}).`);
    el.classList.toggle('warn', short && !said);
  }

  function showPrintPanel() {
    const P = window.DraftPrintModel;
    const { pref, scale, placed } = printPlan();
    const box = $('print-scales');
    box.textContent = '';
    P.SCALES.forEach(sc => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.scale = sc.id;
      b.textContent = sc.label;
      b.classList.toggle('lit', sc.id === pref.scale);
      b.addEventListener('click', () => { setPrintPref('scale', sc.id); showPrintPanel(); });
      box.appendChild(b);
    });
    document.querySelectorAll('[data-split]').forEach(b => b.classList.toggle('lit', b.dataset.split === pref.split));
    document.querySelectorAll('[data-print-format]').forEach(b => b.classList.toggle('lit', b.dataset.printFormat === pref.format));
    const list = $('print-pieces');
    list.textContent = '';
    placed.forEach(pc => {
      const li = document.createElement('li');
      li.dataset.piece = pc.id;
      li.textContent = `${pc.name}: ${sizeWords(pc.size)}`;
      li.classList.toggle('big', !pc.fits);
      list.appendChild(li);
    });
    const big = placed.filter(pc => !pc.fits);
    const fit = $('print-fit');
    fit.textContent = !placed.length ? 'Nothing to print: switch a level on.'
      : big.length ? `${big.map(pc => pc.name).join(', ')} ${big.length === 1 ? 'is' : 'are'} bigger than a ${P.BED_MM} mm bed. Pick a smaller scale${pref.split === 'one' ? ' or LIFT-OFF' : ''}, or split it in the slicer.`
        : `At ${scale.label} every piece fits a ${P.BED_MM} mm bed.`;
    fit.classList.toggle('warn', !placed.length || big.length > 0);
    $('print-go').disabled = !placed.length;
    showPrintToll();
    state.printPlaced = placed;
  }

  let printing = false;
  async function savePrint() {
    if (printing || !state.saved) return null;
    const W = window.DraftBoneWallet;
    const cost = printCost();
    if (!W || held() < cost) { showPrintToll(); return null; }
    const { pref, placed } = printPlan();
    if (!placed.length) return null;
    const base = String(state.name || 'house').replace(/\.(draft|json|zip)$/i, '').replace(/[\\/:*?"<>|]+/g, '-') || 'house';
    printing = true;
    try {
      showPrintToll('Writing the print file...');
      const file = await window.DraftPrintModel.write(placed, base, pref.format);
      const written = await writeOut(file);
      if (!written) { showPrintToll(`Not saved: the save was cancelled, no bone taken. Costs ${bonesWord(cost)} (you have ${held()}).`); return null; }
      W.spend(cost);
      window.dispatchEvent(new CustomEvent('draft-bones-changed'));
      showPrintToll(`Saved ${file.name} (${bonesWord(cost)}, ${held()} left).`);
      document.body.dataset.printed = file.name;
      return file;
    } catch (e) {
      showPrintToll(`Could not write the print file: ${e && e.message ? e.message : e}. No bone taken.`);
      return null;
    } finally {
      printing = false;
    }
  }

  function wirePrint() {
    $('print-open').addEventListener('click', () => {
      const panel = $('print');
      closePanel('export');
      panel.hidden = !panel.hidden;
      $('print-open').classList.toggle('lit', !panel.hidden);
      if (!panel.hidden) showPrintPanel();
    });
    $('print-close').addEventListener('click', () => closePanel('print'));
    document.querySelectorAll('[data-split]').forEach(b => b.addEventListener('click', () => { setPrintPref('split', b.dataset.split); showPrintPanel(); }));
    document.querySelectorAll('[data-print-format]').forEach(b => b.addEventListener('click', () => { setPrintPref('format', b.dataset.printFormat); showPrintPanel(); }));
    $('print-go').addEventListener('click', savePrint);
    window.addEventListener('storage', e => { if (e.key === 'draft-bone-wallet' && !$('print').hidden) showPrintToll(); });
    window.addEventListener('draft-bones-changed', () => { if (!$('print').hidden && !printing) showPrintToll(); });
  }

  // ── EMBEDDED ON A SHEET (?embed=1) ─────────────────────────────────────
  //
  // jb, 27 Nov 2026: a 3D window on the REAL ESTATE PLAN (made by itself)
  // and on CONSTRUCTION LAYOUT (added by the drafter), with the camera his
  // to turn. The sheet pages are 2D and load none of this: view3d-host.js
  // opens this page in a frame and talks to it by message, same site only.
  //   in   draft-viewer-drawing  { drawing, name, camera?, preset? }
  //   in   draft-viewer-preset   { preset }
  //   in   draft-viewer-edit     { on }       the view buttons and DONE show
  //   in   draft-viewer-picture  { id, w, h, camera?, preset?, look? }
  //   out  draft-viewer-ready, draft-viewer-loaded { camera },
  //        draft-viewer-camera { camera }, draft-viewer-done { camera },
  //        draft-viewer-picture { id, png, camera }
  const EMBED = new URLSearchParams(location.search).get('embed') === '1';
  const PRESETS = Object.freeze({
    'front-left': { turn: -35, pitch: 20 },
    'front': { turn: 0, pitch: 8 },
    'front-right': { turn: 35, pitch: 20 },
    'side': { turn: 90, pitch: 8 },
    'back': { turn: 180 + 35, pitch: 20 },
    'top': { turn: 0, pitch: 89 },
  });
  // The yaw that looks at E1, the front, square on. E1 follows the house
  // turn round the plan (cut-marks.js): south, west, north, east for a turn
  // of 0, 1, 2, 3 -- and yaw 0 has the eye to the south (+z).
  function frontYaw() {
    const turn = ((Math.round(Number(state.saved && state.saved.planTurn) || 0) % 4) + 4) % 4;
    return [0, 270, 180, 90][turn];
  }
  function presetCamera(name, aspect) {
    const p = PRESETS[name] || PRESETS['front-left'];
    const base = { target: { x: 0, y: 0, z: 0 }, yaw: (frontYaw() + p.turn + 360) % 360, pitch: p.pitch, dist: 100, fov: 40 };
    return state.bounds ? window.DraftViewerCamera.frame(base, state.bounds, aspect) : base;
  }
  const stageAspect = () => {
    const st = $('stage');
    return st && st.clientHeight ? st.clientWidth / st.clientHeight : 4 / 3;
  };
  const toParent = msg => {
    if (!EMBED || window.parent === window) return;
    try { window.parent.postMessage(msg, location.origin); } catch (e) { /* the sheet went away */ }
  };
  const goodCamera = c => !!(c && c.target && [c.target.x, c.target.y, c.target.z, c.yaw, c.pitch, c.dist, c.fov].every(Number.isFinite));

  // A picture of the house for a sheet: the plain painter, off screen, at
  // the size asked, on white paper with the edges inked.
  function picture(w, h, camera, preset, look) {
    const W = Math.max(16, Math.min(4096, Math.round(w))), H = Math.max(16, Math.min(4096, Math.round(h)));
    const cam = goodCamera(camera) ? camera : presetCamera(preset || 'front-left', W / H);
    const canvas = document.createElement('canvas');
    const painter = window.DraftPaintCanvas.create(canvas);
    painter.setFaces(state.shown);
    painter.render(cam, { ...LOOK, background: '#ffffff', edges: true, ambient: 0.5, ...(look || {}) }, { W, H });
    return { png: canvas.toDataURL('image/png'), camera: cam };
  }

  function listenForHost() {
    document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      state.camera = presetCamera(b.dataset.preset, stageAspect());
      redraw();
    }));
    $('embed-done').addEventListener('click', () => toParent({ type: 'draft-viewer-done', camera: state.camera }));
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || e.source !== window.parent || !e.data) return;
      const m = e.data;
      try {
        if (m.type === 'draft-viewer-drawing') {
          loadDrawing(m.drawing, m.name || 'drawing');
          state.camera = goodCamera(m.camera) ? m.camera : presetCamera(m.preset || 'front-left', stageAspect());
          redraw();
          toParent({ type: 'draft-viewer-loaded', camera: state.camera, faces: state.faces.length });
        } else if (m.type === 'draft-viewer-preset') {
          state.camera = presetCamera(m.preset, stageAspect());
          redraw();
        } else if (m.type === 'draft-viewer-edit') {
          const was = document.body.dataset.editing === '1';
          document.body.dataset.editing = m.on ? '1' : '';
          $('embed-bar').hidden = !m.on;
          // Switched off by the sheet (a click off the frame): the camera
          // as it is now, which the trailing redraw reports may not have yet.
          if (was && !m.on) toParent({ type: 'draft-viewer-done', camera: state.camera });
        } else if (m.type === 'draft-viewer-picture') {
          const out = picture(m.w, m.h, m.camera, m.preset, m.look);
          toParent({ type: 'draft-viewer-picture', id: m.id, png: out.png, camera: out.camera });
        }
      } catch (err) {
        toParent({ type: 'draft-viewer-error', id: m.id, message: String(err && err.message ? err.message : err) });
      }
    });
    toParent({ type: 'draft-viewer-ready' });
  }

  // ── BOOT ───────────────────────────────────────────────────────────────
  function boot() {
    const brand = brandName();
    state.brand = brand.name;
    $('brand').textContent = brand.name;
    document.title = brand.name;
    document.body.dataset.theme = brand.theme;
    state.webglOk = window.DraftPaintWebGL.available();
    const pref = readPref();
    if (pref === 'auto' || pref === 'webgl' || pref === 'plain') state.painterWanted = pref;
    // ?painter=plain forces the plain canvas (the spec, and anyone testing
    // what jb's PC sees).
    const q = new URLSearchParams(location.search).get('painter');
    if (q === 'plain' || q === 'webgl' || q === 'auto') state.painterWanted = q;
    choosePainter();

    const stage = $('stage');
    wireControls(stage);
    new ResizeObserver(redraw).observe(stage);

    $('open').addEventListener('click', () => $('file').click());
    $('file').addEventListener('change', e => { openFile(e.target.files[0]); e.target.value = ''; });
    $('fit').addEventListener('click', fit);
    $('edges').addEventListener('click', () => {
      LOOK.edges = !LOOK.edges;
      $('edges').classList.toggle('lit', LOOK.edges);
      redraw();
    });
    document.querySelectorAll('[data-cut]').forEach(btn => btn.addEventListener('click', () => {
      state.cut.axis = btn.dataset.cut;
      state.cut.flip = false;
      // A plan cut starts at about window height on the lowest storey; an
      // upright one through the middle.
      state.cut.at = state.cut.axis === 'y' ? planCutStart() : 0.5;
      $('cut-at').value = String(Math.round(state.cut.at * 1000));
      showCutChips();
      applyView();
    }));
    $('cut-at').addEventListener('input', e => {
      state.cut.at = Number(e.target.value) / 1000;
      applyView();
    });
    $('cut-flip').addEventListener('click', () => {
      state.cut.flip = !state.cut.flip;
      showCutChips();
      applyView();
    });
    document.querySelectorAll('[data-painter]').forEach(btn => btn.addEventListener('click', () => {
      state.painterWanted = btn.dataset.painter;
      writePref(state.painterWanted);
      choosePainter();
      redraw();
    }));
    ['dragenter', 'dragover'].forEach(t => stage.addEventListener(t, e => { e.preventDefault(); stage.classList.add('dropping'); }));
    ['dragleave', 'drop'].forEach(t => stage.addEventListener(t, () => stage.classList.remove('dropping')));
    stage.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) openFile(file);
    });
    setStatus('Open a .draft or a SAVE AS ZIP to see the house.');
    wireExport();
    wirePrint();
    if (EMBED) {
      document.body.dataset.embed = '1';
      // On a sheet the house stands on the paper: white, edges inked, as
      // the picture the sheet keeps is drawn.
      LOOK.background = '#ffffff';
      LOOK.edges = true;
      LOOK.ambient = 0.5;
      listenForHost();
    } else listenForDrafter();
    document.body.dataset.ready = '1';
  }

  // Where PLAN starts: 4 ft over the lowest storey's floor, as a plan cuts.
  function planCutStart() {
    if (!state.bounds) return 0.5;
    const lo = state.bounds.lo.y, hi = state.bounds.hi.y;
    const floors = state.stack ? state.stack.floors.map(l => l.floorTop) : [];
    const at = floors.length ? Math.min(...floors) + 4 : lo + (hi - lo) * 0.5;
    return Math.max(0, Math.min(1, (at - lo) / Math.max(hi - lo, 1e-6)));
  }

  // ── OPEN IN 3D, FROM THE DRAFTER ───────────────────────────────────────
  //
  // MODEL's OPEN IN 3D chip opens this page as a new tab (?from=drafter)
  // and hands it the drawing as it stands, unsaved edits and all. This page
  // says it is ready; the drafter answers with the drawing. Same site only,
  // both ways. Nothing here is loaded by MODEL: it only opens a tab.
  function listenForDrafter() {
    const from = new URLSearchParams(location.search).get('from');
    if (from !== 'drafter') return;
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'draft-viewer-drawing') return;
      try {
        loadDrawing(e.data.drawing, e.data.name || 'drawing');
      } catch (err) {
        setStatus(`Could not build the drawing: ${err && err.message ? err.message : err}`, true);
        document.body.dataset.loaded = 'error';
      }
    });
    const opener = window.opener;
    if (opener && !opener.closed) {
      setStatus('Bringing the drawing over from the drafter...');
      try { opener.postMessage({ type: 'draft-viewer-ready' }, location.origin); } catch (e) { /* the drafter went away */ }
    } else {
      setStatus('Open a .draft or a SAVE AS ZIP to see the house. (The drafter tab that opened this one is gone.)');
    }
  }

  window.DraftViewer = { state, openFile, loadDrawing, fit, redraw, applyView, exportFile, savePrint, presetCamera, picture };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
