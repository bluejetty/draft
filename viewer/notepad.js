// THE VIEWER'S NOTEPAD -- the drafter's pad, in the 3D viewer.
//
// jb, 28 Nov 2026: "can we add the blue/yello NOTEPAD tab to the ROUGH 3d
// and i could have the code in there like i do with the Bones". It is the
// same pad, not a second one: five pages kept under the drafter's own keys
// (model/04-levels-notes-bars.js storeNotes), so a line typed here shows on
// the drafter's NOTES tab on this site and the other way round. Codes are
// whole lines on lines 1 to 5 of page 1 (bone-wallet.js padHas): 25BONES
// for the wallet, 3DBONES for the PROJECTS button (projects.js).
//
// NOTES only: CALC and TURTLE stay in the drafter, where they draw.
(function () {
  'use strict';
  if (window.DraftViewerPad) return;

  const $ = id => document.getElementById(id);
  const PAGES = 5;
  const MAX = 15000;
  const KEY = 'draft.notepad';          // page 1, the one bone-wallet.js reads
  const PAGES_KEY = 'draft.notepad.pages';
  const PAGE_KEY = 'draft.notepad.page';

  const blank = () => Array.from({ length: PAGES }, () => '');
  const stored = () => {
    const pages = blank();
    try {
      const all = JSON.parse(localStorage.getItem(PAGES_KEY) || '[]');
      if (Array.isArray(all)) all.slice(0, PAGES).forEach((t, i) => { pages[i] = String(t == null ? '' : t).slice(0, MAX); });
      pages[0] = String(localStorage.getItem(KEY) || '').slice(0, MAX);
    } catch (e) { /* nothing kept */ }
    return pages;
  };
  // Written exactly as the drafter writes them, so either page reads both.
  const store = (pages, at) => {
    try {
      if (pages[0]) localStorage.setItem(KEY, pages[0]); else localStorage.removeItem(KEY);
      if (pages.slice(1).some(Boolean)) localStorage.setItem(PAGES_KEY, JSON.stringify(pages));
      else localStorage.removeItem(PAGES_KEY);
      localStorage.setItem(PAGE_KEY, String(at));
    } catch (e) { /* private window: the pad lives for this visit */ }
  };

  let pages = blank();
  let at = 0;

  function show() {
    const text = $('pad-text');
    if (text.value !== pages[at]) text.value = pages[at];
    $('pad-page-said').textContent = `PAGE ${at + 1} OF ${PAGES}`;
    document.querySelectorAll('[data-pad-page]').forEach(b => {
      const i = Number(b.dataset.padPage) - 1;
      b.setAttribute('aria-pressed', String(i === at));
      b.toggleAttribute('data-written', Boolean(pages[i]));
    });
  }

  // Anything that reads a code hears about it (the wallet's ceiling, the
  // PROJECTS button).
  const changed = () => {
    window.dispatchEvent(new Event('draft-pad-changed'));
    window.dispatchEvent(new Event('draft-bones-changed'));
  };

  function open(on) {
    const want = on == null ? $('pad').hidden : !!on;
    $('pad').hidden = !want;
    $('pad-tab').classList.toggle('lit', want);
    $('pad-tab').setAttribute('aria-expanded', String(want));
    if (want) { pages = stored(); show(); $('pad-text').focus(); }
  }

  function boot() {
    if (!$('pad')) return;
    pages = stored();
    try { at = Math.min(PAGES - 1, Math.max(0, Number(localStorage.getItem(PAGE_KEY)) || 0)); } catch (e) { at = 0; }
    $('pad-text').maxLength = MAX;
    show();
    $('pad-tab').addEventListener('click', () => open());
    $('pad-close').addEventListener('click', () => open(false));
    $('pad-text').addEventListener('input', e => {
      pages[at] = e.target.value;
      store(pages, at);
      show();
      if (at === 0) changed();
    });
    $('pad-clear').addEventListener('click', () => {
      pages[at] = '';
      store(pages, at);
      show();
      if (at === 0) changed();
    });
    document.querySelectorAll('[data-pad-page]').forEach(b => b.addEventListener('click', () => {
      at = Number(b.dataset.padPage) - 1;
      store(pages, at);
      show();
    }));
    // Typed in the drafter in another tab: shows here.
    window.addEventListener('storage', e => {
      if (e.key !== KEY && e.key !== PAGES_KEY && e.key !== null) return;
      pages = stored();
      show();
      changed();
    });
  }

  window.DraftViewerPad = Object.freeze({ open, pages: () => pages.slice() });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
