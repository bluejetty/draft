// PHONES AND TABLETS (jb, 26 Nov 2026).
//
// jb: "for the mobile phones and ipads / tablets. this program won't work
// properly, or will be very hard to operate, i'd like to offer them a
// 'partial' program". And on the suggestion that came back -- a friendly
// note on a touch-only device, saying what works there -- "put the note in".
//
// WHAT THIS DOES. On a device whose only pointer is a finger (a phone, or a
// tablet with no mouse or trackpad) the first page opened shows one card:
// the program is built for a computer, and here is what you can do on this
// device. Two answers:
//
//   GOT IT     the device stays a TOUCH device (body[data-device-mode=touch]).
//   PC MODE    "I have a keyboard and mouse" -- the device is treated as a
//              computer from now on (body[data-device-mode=pc]).
//
// Either answer is remembered in this browser (`draft-device`), so the card
// shows once, not on every page. SETTINGS has a row to change the answer or
// see the card again.
//
// A KEYBOARD CANNOT BE DETECTED, only guessed. A browser will not say whether
// a keyboard is plugged in, so PC MODE is the main road. Two hints help:
//   - a mouse or trackpad (`(any-pointer: fine)`) makes the device a computer
//     outright, with no card at all -- an iPad with a Magic Keyboard is one;
//   - a real key pressed while nothing is being typed into, on a device in
//     TOUCH, offers PC MODE once on that page (an on-screen keyboard only
//     types into boxes, so a key with no box focused came from real keys).
//
// DESKTOP IS NOT TOUCHED: a computer never sees the card, never gets the
// chip, and body[data-device-mode] says `computer`.
//
// UNDER THE ORIENTATION GUARD: the guard (z 99999) still covers a portrait
// tablet, and this card (z 99990) waits under it.
if (!window.DraftTouchDevice) {
(() => {
  const KEY = 'draft-device';
  const mq = q => !!(window.matchMedia && window.matchMedia(q).matches);

  // A FINGER AND NOTHING FINER. `pointer: coarse` alone is not enough -- a
  // touchscreen laptop reports its primary pointer coarse on some browsers
  // while its trackpad is right there -- so a fine pointer anywhere wins.
  const touchOnly = () => mq('(pointer: coarse)') && !mq('(any-pointer: fine)');

  // A PHONE IS THE SHORT SIDE UNDER 600 CSS PX, whichever way it is held.
  const kind = () => {
    if (!touchOnly()) return 'computer';
    const s = window.screen || {};
    const short = Math.min(s.width || innerWidth, s.height || innerHeight);
    return short < 600 ? 'phone' : 'tablet';
  };

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && typeof v === 'object' ? v : null;
    } catch (err) { return null; }
  };
  const write = v => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (err) { /* private window */ }
  };

  // computer | touch | pc. A touch-only device that has not answered yet is
  // TOUCH: the card is up and nothing has been unlocked.
  const mode = () => {
    if (!touchOnly()) return 'computer';
    const saved = read();
    return saved && saved.mode === 'pc' ? 'pc' : 'touch';
  };

  const brand = () => {
    const t = document.documentElement.getAttribute('data-theme')
      || (window.DraftPalette && window.DraftPalette.homeTheme ? window.DraftPalette.homeTheme() : 'ruff');
    return t === 'rough' ? 'ROUGH DRAFTER' : 'RUFF-DRAFTER';
  };
  // The wire page wears the brand's own name (shell-bars.js: BONEYARD / WIREFRAME).
  const wire = () => (brand() === 'ROUGH DRAFTER' ? 'WIREFRAME' : 'BONEYARD');

  const mark = () => {
    if (document.body) document.body.dataset.deviceMode = mode();
  };

  let card = null;
  const close = () => {
    if (card && card.isConnected) card.remove();
    card = null;
  };

  const setMode = m => {
    write({ mode: m === 'pc' ? 'pc' : 'touch', noted: true });
    mark();
    close();
    window.dispatchEvent(new CustomEvent('draft-device-mode', { detail: { mode: mode() } }));
  };

  const css = [
    '[data-touch-note]{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;',
    'padding:16px;background:rgba(14,22,30,.55);font-family:"Barlow Condensed",system-ui,sans-serif;}',
    '[data-touch-note] .tn-card{width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;',
    'background:#f2f2f3;color:#1d1f20;border-top:4px solid #5980a6;padding:20px 22px 18px;',
    'box-shadow:0 18px 50px rgba(0,0,0,.35);}',
    '[data-touch-note] h2{margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}',
    '[data-touch-note] .tn-sub{margin:0 0 12px;font-size:15px;color:rgba(29,31,32,.75);}',
    '[data-touch-note] ul{margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.45;}',
    '[data-touch-note] li{margin:3px 0;}',
    '[data-touch-note] b{letter-spacing:.04em;}',
    '[data-touch-note] .tn-small{margin:0 0 14px;font-size:13px;line-height:1.4;color:rgba(29,31,32,.65);}',
    '[data-touch-note] .tn-row{display:flex;flex-wrap:wrap;gap:10px;}',
    '[data-touch-note] button{flex:1 1 160px;min-height:44px;border:1px solid #5980a6;background:#fff;color:#1d4d78;',
    'font:inherit;font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;}',
    '[data-touch-note] button[data-touch-ok]{background:#5980a6;color:#fff;}',
    '[data-touch-hint]{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99989;',
    'display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;background:#1d1f20;color:#fff;',
    'font-family:"Barlow Condensed",system-ui,sans-serif;font-size:14px;letter-spacing:.04em;',
    'box-shadow:0 8px 24px rgba(0,0,0,.35);}',
    '[data-touch-hint] button{min-height:36px;border:0;padding:0 12px;font:inherit;font-weight:700;',
    'letter-spacing:.06em;text-transform:uppercase;cursor:pointer;background:#5980a6;color:#fff;}',
    '[data-touch-hint] button[data-touch-hint-no]{background:transparent;color:rgba(255,255,255,.75);}',
  ].join('');
  let styled = false;
  const style = () => {
    if (styled) return;
    styled = true;
    const el = document.createElement('style');
    el.setAttribute('data-touch-note-style', '');
    el.textContent = css;
    document.head.appendChild(el);
  };

  // THE CARD. What it lists is jb's partial program, in his words where he
  // gave them: look at the plans, turn the house in 3D, view and print the
  // sheets, and the easy pages (EXT. FINISH, SPECIFICATIONS, ESTIMATES).
  const showNote = () => {
    if (!document.body) return;
    style();
    close();
    const k = kind() === 'phone' ? 'phone' : 'tablet';
    card = document.createElement('div');
    card.setAttribute('data-touch-note', '');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'touch-note-title');
    card.innerHTML = [
      '<div class="tn-card">',
      `<h2 id="touch-note-title">${brand()} is built for a computer</h2>`,
      `<p class="tn-sub">Here's what you can do on this ${k}:</p>`,
      '<ul>',
      `<li><b>Open your plans</b> and look them over in MODEL, ${wire()} and PROJECT.</li>`,
      '<li><b>Turn the house in 3D</b> in the 3D VIEWER.</li>',
      '<li><b>View and print</b> the CONSTRUCTION LAYOUT sheets.</li>',
      '<li><b>Fill in</b> EXT. FINISH, SPECIFICATIONS and ESTIMATES.</li>',
      '</ul>',
      '<p class="tn-small">Drawing and editing the house needs a mouse and keyboard. ',
      k === 'phone'
        ? 'If you have them plugged in, PC MODE opens everything (the screen will be very small).'
        : 'If this tablet has a keyboard and mouse, PC MODE opens everything.',
      ' You can change this later in SETTINGS.</p>',
      '<div class="tn-row">',
      '<button type="button" data-touch-ok>GOT IT</button>',
      '<button type="button" data-touch-pc>PC MODE (keyboard &amp; mouse)</button>',
      '</div>',
      '</div>',
    ].join('');
    card.querySelector('[data-touch-ok]').addEventListener('click', () => setMode('touch'));
    card.querySelector('[data-touch-pc]').addEventListener('click', () => setMode('pc'));
    document.body.appendChild(card);
    card.querySelector('[data-touch-ok]').focus({ preventScroll: true });
  };

  // A REAL KEY ON A TOUCH DEVICE offers PC MODE, once a page. A key with a
  // box focused may be the on-screen keyboard, so it says nothing.
  let hinted = false;
  const typingInto = el => !!el && (el.isContentEditable
    || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const onKey = e => {
    if (hinted || mode() !== 'touch' || card) return;
    if (typingInto(document.activeElement) || e.isComposing) return;
    if (!e.key || e.key === 'Unidentified' || e.key === 'Process') return;
    hinted = true;
    style();
    const bar = document.createElement('div');
    bar.setAttribute('data-touch-hint', '');
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Keyboard found. Switch to PC MODE?</span>'
      + '<button type="button" data-touch-hint-yes>PC MODE</button>'
      + '<button type="button" data-touch-hint-no aria-label="No thanks">NO</button>';
    bar.querySelector('[data-touch-hint-yes]').addEventListener('click', () => { bar.remove(); setMode('pc'); });
    bar.querySelector('[data-touch-hint-no]').addEventListener('click', () => bar.remove());
    document.body.appendChild(bar);
  };

  // A MOUSE PLUGGED IN (or out) mid-visit changes the answer without a reload.
  const watch = q => {
    try {
      const m = window.matchMedia && window.matchMedia(q);
      if (m && m.addEventListener) m.addEventListener('change', () => {
        mark();
        if (!touchOnly()) close();
      });
    } catch (err) { /* old browser */ }
  };

  const start = () => {
    mark();
    if (!touchOnly()) return;
    const saved = read();
    if (!saved || !saved.noted) showNote();
  };

  window.addEventListener('keydown', onKey, true);
  watch('(any-pointer: fine)');
  watch('(pointer: coarse)');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DraftTouchDevice = Object.freeze({
    touchOnly, kind, mode, setMode, showNote,
    forget() { try { localStorage.removeItem(KEY); } catch (err) { /* private window */ } mark(); },
  });
})();
}
