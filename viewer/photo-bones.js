// THE BONE AT THE FOOT, AND TAKE PHOTO -- spending bones in the viewer.
//
// jb, 28 Nov 2026:
//   - "we should add a bone button to the 3D viewer maybe?" ... "can we have
//     the bone button position in a similar location bottom center?" ...
//     "when they press it ask them if they would like to take a photo or
//     export the 3D model". The bone wears the wallet's count, the drafter's
//     art for the skin (shell-bars.js BONE_ART), and opens a card: TAKE
//     PHOTO, EXPORT 3D MODEL, PRINT MODEL, each 1 bone.
//   - "in the 3D area we should also allow the user to TAKE PHOTO" ... "and
//     give them a file JPG or PNG etc whatever they choose" ... "make a photo
//     1 bone too". What is on screen -- the angle, the levels that are on,
//     the section, textures and edges as set -- drawn again off screen at 1,
//     2 or 4 times the window, with no buttons in it, saved as PNG, JPG or
//     WEBP. The bone is taken once the picture is saved (a cancelled save
//     picker is free), the rule EXPORT and PRINT MODEL keep.
//
// Always drawn by the plain painter, whatever is on screen: it draws at any
// size on any computer, jb's PC without a graphics card included.
(function () {
  'use strict';
  if (window.DraftViewerPhoto) return;

  const $ = id => document.getElementById(id);
  const V = () => window.DraftViewer;
  const W = () => window.DraftBoneWallet;
  const PREF_KEY = 'draft-viewer-photo';
  const FORMATS = Object.freeze({
    png: { mime: 'image/png', ext: 'png', label: 'PNG' },
    jpg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG', quality: 0.92 },
    webp: { mime: 'image/webp', ext: 'webp', label: 'WEBP', quality: 0.92 },
  });
  const SCALES = [1, 2, 4];
  // The most pixels one picture may have: past this a browser's canvas, or
  // the plain painter's memory for depth, gives out. A 4x of a big window
  // is brought down to fit, and the panel says the size it will be.
  const MAX_PIXELS = 16e6;
  const MAX_SIDE = 8192;

  const ART = Object.freeze({
    ruff: '../assets/bone-red.png',
    rough: '../assets/house-blue-off.png',
  });

  const bonesWord = n => (W() ? W().bonesWord(n) : `${n} bone${n === 1 ? '' : 's'}`);
  const held = () => (W() ? W().read().balance : 0);
  const cost = () => (W() && W().COSTS.photo3d ? W().COSTS.photo3d : 1);

  function prefs() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch (e) { p = null; }
    p = p && typeof p === 'object' ? p : {};
    return { format: FORMATS[p.format] ? p.format : 'png', scale: SCALES.includes(p.scale) ? p.scale : 2 };
  }
  function setPref(key, value) {
    const p = { ...prefs(), [key]: value };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* private window */ }
  }

  // The picture's size in pixels for a scale: the stage times the scale,
  // brought down (same shape) to the limits.
  function sizeFor(scale) {
    const st = $('stage');
    const w0 = Math.max(16, st ? st.clientWidth : 800), h0 = Math.max(16, st ? st.clientHeight : 600);
    let w = w0 * scale, h = h0 * scale;
    const shrink = Math.min(1, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
    w = Math.max(16, Math.round(w * shrink)); h = Math.max(16, Math.round(h * shrink));
    return { w, h };
  }

  // Draw what is on screen into a canvas of w x h.
  function draw(w, h) {
    const v = V();
    const canvas = document.createElement('canvas');
    const painter = window.DraftPaintCanvas.create(canvas);
    painter.setFaces(v.state.shown);
    painter.render(v.state.camera, { ...v.LOOK }, { W: w, H: h });
    if (painter.dispose) painter.dispose();
    return canvas;
  }

  const toBlob = (canvas, f) => new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error(`this browser cannot write ${f.label}`))), f.mime, f.quality);
  });

  function baseName() {
    const n = String((V() && V().state.name) || 'house').replace(/\.(draft|json|zip)$/i, '').replace(/[\\/:*?"<>|]+/g, '-');
    return n || 'house';
  }

  function showToll(said) {
    const el = $('photo-toll');
    const c = cost(), have = held();
    const short = have < c;
    el.textContent = said || (short
      ? `A photo costs ${bonesWord(c)} and you have ${have}. A free bone drips in every hour.`
      : `Each photo costs ${bonesWord(c)} (you have ${have}).`);
    el.classList.toggle('warn', short && !said);
  }

  function showPanel() {
    const p = prefs();
    document.querySelectorAll('[data-photo-format]').forEach(b => b.classList.toggle('lit', b.dataset.photoFormat === p.format));
    document.querySelectorAll('[data-photo-scale]').forEach(b => b.classList.toggle('lit', Number(b.dataset.photoScale) === p.scale));
    const { w, h } = sizeFor(p.scale);
    $('photo-size-note').textContent = `${w} x ${h} pixels`;
    showToll();
  }

  let taking = false;
  async function takePhoto(opts) {
    const v = V();
    if (taking || !v || !v.state.shown || !v.state.shown.length || !v.state.camera) return null;
    const p = { ...prefs(), ...(opts || {}) };
    const f = FORMATS[p.format] || FORMATS.png;
    const c = cost();
    if (!W() || held() < c) { showToll(); return null; }
    taking = true;
    $('photo-go').disabled = true;
    try {
      const { w, h } = sizeFor(p.scale);
      showToll(`Drawing the photo, ${w} x ${h}...`);
      await new Promise(r => setTimeout(r, 30));   // let the words show first
      const blob = await toBlob(draw(w, h), f);
      const file = { name: `${baseName()} 3D.${f.ext}`, blob, mime: f.mime };
      const written = await v.writeOut(file);
      if (!written) { showToll(`Photo not saved: the save was cancelled, no bone taken. Each photo costs ${bonesWord(c)} (you have ${held()}).`); return null; }
      W().spend(c);
      window.dispatchEvent(new CustomEvent('draft-bones-changed'));
      showToll(`Saved ${file.name}, ${w} x ${h} (${bonesWord(c)}, ${held()} left).`);
      document.body.dataset.photo = `${file.name}|${w}x${h}|${blob.type}`;
      return { ...file, w, h };
    } catch (e) {
      showToll(`Could not take the photo: ${e && e.message ? e.message : e}. No bone taken.`);
      return null;
    } finally {
      taking = false;
      $('photo-go').disabled = false;
    }
  }

  function openPanel(want) {
    const panel = $('photo');
    const on = want == null ? panel.hidden : !!want;
    if (on) V().closeOthers('photo');
    panel.hidden = !on;
    $('photo-open').classList.toggle('lit', on);
    if (on) showPanel();
  }

  // ── THE BONE AT THE FOOT ───────────────────────────────────────────────
  function paintBone() {
    const foot = $('bone-foot');
    if (!foot) return;
    const theme = document.body.dataset.theme === 'rough' ? 'rough' : 'ruff';
    const art = ART[theme];
    if ($('bone-art').getAttribute('src') !== art) $('bone-art').setAttribute('src', art);
    const wallet = W() ? W().read() : null;
    const have = wallet ? wallet.balance : 0;
    $('bone-count').textContent = String(have);
    foot.toggleAttribute('data-broke', have <= 0);
    let title = `${bonesWord(have)}`;
    if (wallet) {
      title += wallet.nextDripMs == null
        ? `; the wallet is full at ${wallet.cap}.`
        : `; next free bone in ${Math.max(1, Math.ceil(wallet.nextDripMs / 60000))} min (fills to ${wallet.cap}).`;
    }
    foot.title = `${title} Press to take a photo or export the house.`;
    foot.dataset.bones = String(have);
    if (!$('spend').hidden) paintSpend();
  }

  function paintSpend() {
    const have = held();
    const loaded = !!(V() && V().state.shown && V().state.shown.length);
    $('spend-title').textContent = `YOU HAVE ${bonesWord(have).toUpperCase()}`;
    $('spend-note').textContent = !loaded
      ? 'Open a house first, then spend a bone on it.'
      : have < 1
        ? 'No bones left. A free bone drips in every hour.'
        : 'What would you like to do with this house?';
    const costs = W() ? W().COSTS : {};
    const price = { photo: costs.photo3d || 1, export: costs.export3d || 1, print: costs.printModel || 1 };
    document.querySelectorAll('[data-spend]').forEach(b => {
      b.disabled = !loaded;
      b.querySelector('span').textContent = bonesWord(price[b.dataset.spend]);
    });
  }

  function openSpend(want) {
    const panel = $('spend');
    const on = want == null ? panel.hidden : !!want;
    if (on) V().closeOthers('spend');
    panel.hidden = !on;
    $('bone-foot').setAttribute('aria-expanded', String(on));
    if (on) paintSpend();
  }

  function boot() {
    if (!$('photo') || !V()) return;
    $('photo-open').addEventListener('click', () => openPanel());
    $('photo-close').addEventListener('click', () => openPanel(false));
    $('photo-go').addEventListener('click', () => takePhoto());
    document.querySelectorAll('[data-photo-format]').forEach(b => b.addEventListener('click', () => { setPref('format', b.dataset.photoFormat); showPanel(); }));
    document.querySelectorAll('[data-photo-scale]').forEach(b => b.addEventListener('click', () => { setPref('scale', Number(b.dataset.photoScale)); showPanel(); }));
    window.addEventListener('resize', () => { if (!$('photo').hidden) showPanel(); });

    $('bone-foot').addEventListener('click', () => openSpend());
    $('spend-close').addEventListener('click', () => openSpend(false));
    document.querySelectorAll('[data-spend]').forEach(b => b.addEventListener('click', () => {
      openSpend(false);
      const which = b.dataset.spend;
      if (which === 'photo') openPanel(true);
      else $(`${which}-open`).click();
    }));
    paintBone();
    window.addEventListener('draft-bones-changed', () => { paintBone(); if (!$('photo').hidden && !taking) showToll(); });
    window.addEventListener('storage', e => { if (e.key === 'draft-bone-wallet' || e.key === 'draft.notepad' || e.key === null) paintBone(); });
    window.addEventListener('draft-viewer-shown', () => { if (!$('spend').hidden) paintSpend(); });
    // The hourly drip lands while the page sits open.
    setInterval(paintBone, 60000);
  }

  window.DraftViewerPhoto = Object.freeze({ takePhoto, sizeFor, draw, FORMATS, SCALES, paintBone, openSpend });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
