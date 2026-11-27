// 3D VIEW HOST -- a 3D window on a 2D sheet, without a line of 3D code here.
//
// jb, 27 Nov 2026: "automatically generate one for Real Estate Plans
// please", and "i guess the user can put them in Construction plans too".
//
// The sheet pages are the 2D side, and the 2D side never loads the 3D
// viewer (delete viewer/ and every sheet still works). So this file only
// opens viewer/index.html?embed=1 in a frame and talks to it by message:
//   picture({ drawing, camera | preset, w, h }) -> { png, camera } | null
//       a PNG of the house, for the sheet to draw and print like any image;
//   edit({ drawing, camera | preset, rect, onCamera }) -> camera | null
//       the same frame laid over the tile, live, with the view buttons and
//       DONE; it resolves on DONE, a click off it, or Escape.
// One frame serves both, kept alive between calls. If the viewer is not
// there (or never answers), every call resolves null and `missing` is set,
// and the sheet says "3D viewer not installed" in the tile.
(function () {
  'use strict';
  if (window.DraftView3dHost) return;

  const READY_MS = 12000;
  const CALL_MS = 20000;
  let frame = null, ready = null, missing = false;
  let loadedKey = null, seq = 0;
  const keys = new WeakMap();  // drawing -> key, so one drawing goes over once
  const waiting = new Map();   // id -> resolve
  let editing = null;          // { resolve, onCamera, camera, off() }

  const url = () => new URL('viewer/index.html?embed=1', document.baseURI).href;

  function parkFrame() {
    if (!frame) return;
    Object.assign(frame.style, {
      position: 'fixed', left: '-10000px', top: '0px', width: '400px', height: '300px',
      border: '0', visibility: 'hidden', pointerEvents: 'none', zIndex: '',
      boxShadow: '', borderRadius: '',
    });
  }

  function onMessage(e) {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin || !e.data) return;
    const m = e.data;
    if (m.type === 'draft-viewer-ready' && frame.__ready) frame.__ready(true);
    else if (m.type === 'draft-viewer-picture' || m.type === 'draft-viewer-loaded' || m.type === 'draft-viewer-error') {
      const key = m.type === 'draft-viewer-loaded' ? 'loaded' : m.id;
      const done = waiting.get(key);
      if (done) { waiting.delete(key); done(m); }
    } else if (m.type === 'draft-viewer-camera' && editing) {
      editing.camera = m.camera;
      if (editing.onCamera) editing.onCamera(m.camera);
    } else if (m.type === 'draft-viewer-done' && editing) {
      finishEdit(m.camera);
    }
  }

  // The frame, made once. Resolves true when the viewer said ready.
  function boot() {
    if (ready) return ready;
    ready = new Promise(resolve => {
      window.addEventListener('message', onMessage);
      frame = document.createElement('iframe');
      frame.title = '3D view';
      frame.setAttribute('data-view3d-frame', '');
      parkFrame();
      let settled = false;
      const settle = ok => {
        if (settled) return;
        settled = true;
        missing = !ok;
        resolve(ok);
      };
      frame.__ready = settle;
      // A viewer that is not there is a 404 page that never says ready.
      setTimeout(() => settle(false), READY_MS);
      // The viewer says ready while it boots, before its frame's load event;
      // a frame that loads and stays quiet is a page that is not the viewer.
      frame.addEventListener('load', () => setTimeout(() => settle(false), 1500));
      frame.src = url();
      document.body.appendChild(frame);
    });
    return ready;
  }

  const send = msg => { try { frame.contentWindow.postMessage(msg, location.origin); } catch (e) { /* frame gone */ } };

  function ask(key, msg) {
    return new Promise(resolve => {
      const t = setTimeout(() => { waiting.delete(key); resolve(null); }, CALL_MS);
      waiting.set(key, m => { clearTimeout(t); resolve(m); });
      send(msg);
    });
  }

  // The drawing goes over once; asked again with the same one, it stays.
  async function load(drawing, camera, preset) {
    if (!keys.has(drawing)) keys.set(drawing, `d${(seq += 1)}`);
    const key = keys.get(drawing);
    if (key === loadedKey && !camera && !preset) return true;
    const m = await ask('loaded', { type: 'draft-viewer-drawing', drawing, name: 'sheet', camera, preset });
    if (!m || m.type !== 'draft-viewer-loaded') return false;
    loadedKey = key;
    return true;
  }

  async function picture({ drawing, camera = null, preset = 'front-left', w = 800, h = 600, look = null } = {}) {
    if (!drawing || !(await boot())) return null;
    if (!(await load(drawing))) return null;
    seq += 1;
    const id = `p${seq}`;
    const m = await ask(id, { type: 'draft-viewer-picture', id, w, h, camera, preset, look });
    return m && m.type === 'draft-viewer-picture' ? { png: m.png, camera: m.camera } : null;
  }

  function finishEdit(camera) {
    if (!editing) return;
    const e = editing;
    editing = null;
    e.off();
    send({ type: 'draft-viewer-edit', on: false });
    parkFrame();
    e.resolve(camera || e.camera || null);
  }

  // rect: { left, top, width, height } in page (client) pixels.
  async function edit({ drawing, camera = null, preset = 'front-left', rect, onCamera = null } = {}) {
    if (editing) finishEdit(null);
    if (!drawing || !rect || !(await boot())) return null;
    if (!(await load(drawing, camera, camera ? null : preset))) return null;
    Object.assign(frame.style, {
      left: `${Math.round(rect.left)}px`, top: `${Math.round(rect.top)}px`,
      width: `${Math.max(160, Math.round(rect.width))}px`, height: `${Math.max(120, Math.round(rect.height))}px`,
      visibility: 'visible', pointerEvents: 'auto', zIndex: '50',
      boxShadow: '0 0 0 2px #2f7de1, 0 6px 18px rgba(0,0,0,0.25)', borderRadius: '2px',
    });
    send({ type: 'draft-viewer-edit', on: true });
    try { frame.focus(); } catch (e) { /* fine */ }
    return new Promise(resolve => {
      // A press anywhere else on the page keeps the view, as DONE does.
      // The frame's camera reports trail its redraws, so it is asked for
      // the one it has now: switched off, it answers with DONE's message.
      const close = () => {
        if (!editing || editing.closing) return;
        editing.closing = true;
        send({ type: 'draft-viewer-edit', on: false });
        setTimeout(() => finishEdit(null), 1000);
      };
      const outside = ev => { if (ev.target !== frame) close(); };
      const key = ev => { if (ev.key === 'Escape') close(); };
      setTimeout(() => {
        if (!editing) return;
        window.addEventListener('pointerdown', outside, true);
        window.addEventListener('keydown', key, true);
      }, 0);
      editing = {
        resolve, onCamera, camera, closing: false,
        off() {
          window.removeEventListener('pointerdown', outside, true);
          window.removeEventListener('keydown', key, true);
        },
      };
    });
  }

  window.DraftView3dHost = Object.freeze({
    picture,
    edit,
    stopEditing: () => finishEdit(null),
    get editing() { return !!editing; },
    get missing() { return missing; },
  });
})();
