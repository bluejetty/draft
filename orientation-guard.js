// Landscape on every working screen (board #310).
//
// The ruling: MODEL, LAYOUT, PROJECT, STANDARDS and SETTINGS always present
// landscape on a tablet — width greater than height, the way they look on a
// computer. Never the portrait arrangement, not even briefly. Both landscape
// directions are fine (the device may be held either way up); portrait is
// blocked both ways up too, because upside-down portrait is still portrait.
// ENTRY (index.html) is the one exception and does not load this file.
//
// THE HONEST VERSION. The web platform will not let a page hard-lock
// orientation outside fullscreen, so the guarantee here is an interstitial:
// in portrait the working surface is covered completely and nothing beneath
// it can be touched, so the app never attempts a portrait layout. Where the
// real lock IS available — fullscreen, or an installed PWA — it is taken as
// a bonus; 'landscape' allows both landscape-primary and landscape-secondary,
// which is exactly the ruling.
//
// DESKTOP IS NOT TOUCHED. The gate is a COARSE POINTER, not the aspect ratio:
// someone dragging a desktop window tall must never see this. That is why the
// test is `(pointer: coarse)` and not `innerHeight > innerWidth` alone.
if (!window.DraftOrientationGuard) {
(() => {
  const isCoarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const isPortrait = () => window.innerHeight > window.innerWidth;
  const shouldBlock = () => isCoarse() && isPortrait();

  let panel = null;

  function build() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.setAttribute('data-orientation-guard', '');
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-label', 'Turn your device to landscape');
    panel.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999', 'display:flex',
      'flex-direction:column', 'align-items:center', 'justify-content:center',
      'gap:18px', 'padding:32px', 'text-align:center', 'background:#f2f2f3',
      'color:#1d1f20', "font-family:'Barlow Condensed',system-ui,sans-serif",
      'user-select:none', 'touch-action:none',
    ].join(';');
    panel.innerHTML = [
      '<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#5980a6"',
      ' stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<rect x="7" y="2" width="10" height="20" rx="2"></rect>',
      '<path d="M3.5 15.5a9 9 0 0 0 3 4"></path><path d="M2 13.5l1.5 2 2-1.5"></path>',
      '</svg>',
      '<div style="font-size:22px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Turn your device</div>',
      '<div style="max-width:34ch; font-size:14px; line-height:1.5; color:rgba(29,31,32,0.7);">',
      'Rough Drafter draws in landscape, the way it looks on a computer screen. ',
      'Rotate the tablet and this will step aside.',
      '</div>',
    ].join('');
    return panel;
  }

  function apply() {
    const body = document.body;
    if (!body) return;
    if (shouldBlock()) {
      const node = build();
      if (!node.isConnected) body.appendChild(node);
      node.hidden = false;
      body.dataset.orientationBlocked = '1';
    } else {
      if (panel && panel.isConnected) panel.remove();
      body.dataset.orientationBlocked = '0';
    }
  }

  // Opportunistic, and deliberately quiet: outside fullscreen this rejects on
  // every browser that implements it, which is not an error worth reporting.
  function tryLock() {
    try {
      const lock = window.screen && screen.orientation && screen.orientation.lock;
      if (typeof lock === 'function') {
        const result = screen.orientation.lock('landscape');
        if (result && typeof result.catch === 'function') result.catch(() => {});
      }
    } catch (error) { /* not permitted here; the interstitial is the guarantee */ }
  }

  function start() {
    apply();
    tryLock();
  }

  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.DraftOrientationGuard = Object.freeze({ apply, shouldBlock, isCoarse, isPortrait });
})();
}
