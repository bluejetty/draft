// THE VIEWER PAGE -- open a file, build the house, pick a painter, turn it.
//
// Opens a .draft (the drawing as SAVE writes it) or a SAVE AS ZIP (the
// drafter's own zip reader, zip-bundle.js, finds the drawing inside).
// Builds the faces once (house-mesh.js) and hands them to whichever painter
// this browser can run: WebGL when it can, plain canvas when it cannot, and
// the PAINTER chips let you force either one.
//
// window.DraftViewer is the page's handle, for the spec and for later phases
// (exports read `state.faces`).
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const LOOK = { background: '#dfe6ee', ambient: 0.42, edges: true };
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
    if (state.faces.length) state.painter.setFaces(state.faces);
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
      document.body.dataset.frames = String(state.frames);
    });
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
    state.faces = built.faces;
    state.counts = built.counts;
    state.name = name || 'drawing';
    state.camera = window.DraftViewerCamera.fit(built.bounds);
    if (state.painter) state.painter.setFaces(state.faces);
    $('drop-hint').hidden = state.faces.length > 0;
    document.title = `${state.name} - ${state.brand}`;
    const c = built.counts;
    const extra = [[c.windows, 'windows'], [c.doors, 'doors'], [c.stairs, 'stairs'], [c.decks, 'decks'], [c.holograms, 'holograms']]
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
    stage.addEventListener('contextmenu', e => e.preventDefault());
    stage.addEventListener('pointerdown', e => {
      if (!state.camera) return;
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
      if (!state.camera) return;
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
    document.body.dataset.ready = '1';
  }

  window.DraftViewer = { state, openFile, loadDrawing, fit, redraw };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
