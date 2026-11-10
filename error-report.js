// SEND A REPORT WHEN THE APP HITS A PROBLEM (Movie, 6 Nov).
//
// "on my old Archicad Program, (which had alot of bugs) whenever it bugged out
// it would give me message about sending the report to archicad. could we do
// something like that when a user has a problem maybe it could help us smooth
// everything out" -- and on where it goes: "they wouldn't go to the user they
// would come to me, maybe a copy could go to the user".
//
// WHAT OPENS THE CARD. An uncaught error or a promise nobody caught, once per
// distinct fault per page load so a bug that fires on every repaint asks
// once, not fifty times. And REPORT A PROBLEM in the foot lane, for a thing
// that did not crash but looked wrong. jb on that card (6 Nov): "alot of
// them probably won't fill it out i bet" -- so it is ONE TAP: a row of
// quick picks (ROOF LOOKS WRONG, WON'T PRINT RIGHT ...) and the box stays
// optional beside them; a pick or a line of text is enough to send. The
// drawing is ticked on by default there, since a report with no drawing
// usually cannot be read; on the crash card it stays off.
//
// WHAT THE REPORT HOLDS. The fault (message, where, stack), the page and when,
// the browser and screen, the last ACTIONS (clicks, keys, tool changes --
// a page can add its own with `note()`), whatever a page registered with
// `attach()` (MODEL gives its tool, level and the last undo steps), and what
// the drafter typed. The drawing is private, so it goes ONLY when the drafter
// ticks INCLUDE MY DRAWING, and then as its own .draft attachment.
//
// WHERE IT GOES. The same mail worker as SAVE BACKUP FILE TO EMAIL
// (backup-email.js): a POST of { app, email, filename, dataUrl }, one to the
// REPORT DESK (REPORT_TO below) and one to the drafter if they ask for a copy.
// jb has no desk address yet (6 Nov: "not sure of the email i should use yet
// i will have to leave it empty for now"), so with REPORT_TO empty and no
// copy address, SEND becomes SAVE REPORT FILE and the report lands on this
// computer for the drafter to email by hand. Nothing leaves the page unless
// a button is pressed. At most SENDS_PER_HOUR reports a browser, no bones.
(() => {
  'use strict';
  // THE REPORT DESK -- the one setting to fill in when jb picks an address.
  const REPORT_TO = '';
  const ENDPOINT = 'https://bluejetty-mail.bluejetty.workers.dev';
  const APP = 'bluejetty';
  const SENDS_PER_HOUR = 3;
  const ACTIONS_KEPT = 40;
  const QUICK_PICKS = ['ROOF LOOKS WRONG', 'WALLS LOOK WRONG', 'WON\'T PRINT RIGHT', 'SOMETHING DISAPPEARED',
    'A BUTTON DOES NOTHING', 'TOO SLOW', 'OTHER'];
  const SENT_KEY = 'draft-error-report-sent';
  const ADDRESS_KEY = 'draft-backup-email';   // the backup card's address, shared

  const store = {
    get: key => { try { return localStorage.getItem(key); } catch { return null; } },
    set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private window */ } },
  };
  const validAddress = text => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(text || '').trim());

  // ── THE HOURLY ALLOWANCE, per browser ─────────────────────────────────
  const sentTimes = (now = Date.now()) => {
    let list = [];
    try { list = JSON.parse(store.get(SENT_KEY) || '[]'); } catch { list = []; }
    return (Array.isArray(list) ? list : []).filter(t => Number.isFinite(t) && now - t < 3600e3);
  };
  const allowance = (now = Date.now()) => SENDS_PER_HOUR - sentTimes(now).length;
  const noteSent = (now = Date.now()) => store.set(SENT_KEY, JSON.stringify([...sentTimes(now), now]));

  // ── THE TRAIL OF ACTIONS ──────────────────────────────────────────────
  const started = Date.now();
  const actions = [];
  const note = text => {
    const line = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!line) return;
    actions.push({ at: Date.now(), text: line });
    if (actions.length > ACTIONS_KEPT) actions.splice(0, actions.length - ACTIONS_KEPT);
  };
  const labelOf = el => {
    const text = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
      .replace(/\s+/g, ' ').trim().slice(0, 40);
    const id = el.id ? `#${el.id}` : '';
    const data = Object.keys(el.dataset || {}).slice(0, 2).map(k => `[${k}${el.dataset[k] ? `=${el.dataset[k]}` : ''}]`).join('');
    return `${el.tagName.toLowerCase()}${id}${data}${text ? ` "${text}"` : ''}`;
  };
  const watch = () => {
    document.addEventListener('pointerdown', event => {
      const el = event.target instanceof Element ? event.target.closest('button, a, [role=button], input, select, textarea, canvas, [data-tool]') : null;
      if (!el || el.closest('[data-error-report]')) return;
      note(`${event.pointerType || 'pointer'} down ${labelOf(el)} @${Math.round(event.clientX)},${Math.round(event.clientY)}`);
    }, true);
    document.addEventListener('keydown', event => {
      const typing = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]');
      if (typing) return;
      const mods = ['ctrlKey', 'altKey', 'shiftKey', 'metaKey'].filter(k => event[k]).map(k => k.replace('Key', ''));
      note(`key ${[...mods, event.key].join('+')}`);
    }, true);
  };

  // ── WHAT A PAGE TELLS THE REPORT ──────────────────────────────────────
  // attach({ state, file }): `state()` returns an object to print under APP
  // STATE; `file()` returns { name, text } of the drawing, asked only when
  // the drafter ticks INCLUDE MY DRAWING.
  let hooks = { state: null, file: null };
  const attach = ({ state = null, file = null } = {}) => { hooks = { state, file }; };
  const safely = (fn, orElse) => { try { return fn(); } catch (error) { return orElse(error); } };

  // ── THE REPORT TEXT ───────────────────────────────────────────────────
  const stamp = (date = new Date()) => {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  };
  const line = (label, value) => `${label.padEnd(10)} ${value}`;
  const compose = ({ fault, said, pick = '', copyTo }) => {
    const now = new Date();
    const out = ['ROUGH-DRAFTER PROBLEM REPORT', '='.repeat(28), ''];
    out.push(line('WHEN', now.toString()));
    out.push(line('PAGE', location.href));
    out.push(line('SERVED', document.lastModified || '?'));
    out.push(line('BROWSER', navigator.userAgent));
    out.push(line('LANGUAGE', navigator.language || '?'));
    out.push(line('SCREEN', `${window.innerWidth}x${window.innerHeight} css px, dpr ${window.devicePixelRatio || 1}, `
      + `${screen.width}x${screen.height} screen, ${(screen.orientation && screen.orientation.type) || 'orientation ?'}, `
      + `${matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse'}`));
    out.push(line('ONLINE', String(navigator.onLine)));
    out.push(line('UP FOR', `${Math.round((now - started) / 1000)} s`));
    if (copyTo) out.push(line('COPY TO', copyTo));
    out.push('', 'THE FAULT', '-'.repeat(9));
    if (fault) {
      out.push(line('KIND', fault.kind));
      out.push(line('MESSAGE', fault.message));
      if (fault.where) out.push(line('WHERE', fault.where));
      out.push('', fault.stack || '(no stack)');
    } else {
      out.push('(none -- the drafter pressed REPORT A PROBLEM)');
    }
    out.push('', 'WHAT THE DRAFTER SAID', '-'.repeat(21));
    if (pick) out.push(line('PICKED', pick));
    out.push(said.trim() || '(nothing typed)');
    out.push('', 'APP STATE', '-'.repeat(9));
    const state = hooks.state ? safely(hooks.state, error => ({ 'state hook failed': String(error && error.message || error) })) : null;
    if (state && typeof state === 'object') {
      Object.keys(state).forEach(key => out.push(line(key.toUpperCase().slice(0, 10), safely(() => (
        typeof state[key] === 'string' ? state[key] : JSON.stringify(state[key])), () => '?'))));
    } else out.push('(the page registered none)');
    out.push('', `LAST ${actions.length} ACTIONS, oldest first`, '-'.repeat(12));
    if (!actions.length) out.push('(none)');
    actions.forEach(a => out.push(`${String(((a.at - now) / 1000).toFixed(1)).padStart(8)} s  ${a.text}`));
    out.push('');
    return out.join('\n');
  };

  // ── ONE CARD PER DISTINCT FAULT ───────────────────────────────────────
  const seen = new Set();
  const faultOf = event => {
    if (event.type === 'unhandledrejection') {
      const reason = event.reason;
      return {
        kind: 'unhandled promise rejection',
        message: String(reason && reason.message || reason || 'no reason given'),
        where: '',
        stack: String(reason && reason.stack || ''),
      };
    }
    const error = event.error;
    return {
      kind: 'uncaught error',
      message: String(event.message || (error && error.message) || 'unknown'),
      where: event.filename ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}` : '',
      stack: String(error && error.stack || ''),
    };
  };
  const onFault = event => {
    // A failed <img> or <script> arrives on the same event name with no
    // message and a target that is not the window; that is a loading fault,
    // not a crash, and it has its own readout elsewhere.
    if (event.type === 'error' && !(event instanceof ErrorEvent)) return;
    const fault = faultOf(event);
    const key = `${fault.kind}|${fault.message}|${fault.where}`;
    if (seen.has(key)) return;
    seen.add(key);
    // A FAULT WHILE BOOTING ON THE LIVE SITE gets one fresh fetch before it
    // gets a card. An old page paired with new scripts (jb, 10 Nov: "H is not
    // defined" on every load) looks exactly like a crash, and the cure is a
    // fresh copy of the page, not a report. build-id.js keeps the retry to
    // one; a page that is already on its way out shows nothing.
    const build = window.DraftBuild;
    if (build && build.live && (build.reloading() || (build.booting() && build.retryFresh(`fault while booting: ${fault.message}`)))) return;
    note(`FAULT ${fault.kind}: ${fault.message}`);
    open({ fault });
  };

  // ── THE CARD ──────────────────────────────────────────────────────────
  const CSS = `
  .er-scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100001}
  .er-card{background:#fff;color:#1d1f20;width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;
    padding:18px 18px 14px;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.35);font-family:'Barlow Condensed',system-ui,sans-serif}
  .er-card h2{margin:0 0 6px;font-size:18px;letter-spacing:.5px;font-weight:700}
  .er-card p{margin:0 0 10px;font-size:13px;line-height:1.35;color:#4b4f52}
  .er-card p[data-er-fault]{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#8a1f1f;word-break:break-word}
  .er-card label{display:block;font-size:13px;margin:0 0 8px}
  .er-card label.er-tick{display:flex;gap:6px;align-items:center}
  .er-picks{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
  .er-picks button{font:inherit;font-size:12px;font-weight:700;letter-spacing:.5px;padding:5px 9px;border:1px solid #9aa0a4;
    background:#fff;color:#1d1f20;cursor:pointer;border-radius:3px}
  .er-picks button[aria-pressed=true]{background:#2f5b85;border-color:#2f5b85;color:#fff}
  .er-card textarea,.er-card input[type=email]{width:100%;box-sizing:border-box;padding:7px 8px;font:inherit;font-size:14px;border:1px solid #9aa0a4;margin-top:3px}
  .er-card textarea{min-height:56px;resize:vertical}
  .er-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
  .er-row button{font:inherit;font-weight:700;letter-spacing:.5px;padding:7px 14px;border:1px solid #2f5b85;background:#fff;color:#2f5b85;cursor:pointer}
  .er-row button[data-er-send]{background:#2f5b85;color:#fff}
  .er-row button:disabled{opacity:.5;cursor:default}
  .er-status{min-height:16px;margin-top:8px;font-size:13px}
  .er-status[data-kind=error]{color:#c62828}
  .er-status[data-kind=ok]{color:#2e7d32}
  #foot-lane > [data-report-problem]{font:inherit;font-size:11px;letter-spacing:.5px;margin-left:12px;background:none;border:0;
    padding:0;color:inherit;opacity:.7;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  #foot-lane > [data-report-problem]:hover{opacity:1}`;
  const ensureStyle = () => {
    if (document.getElementById('er-style')) return;
    const style = document.createElement('style');
    style.id = 'er-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  };

  const asDataUrl = (text, type) => `data:${type};base64,${btoa(unescape(encodeURIComponent(text)))}`;
  const unreachable = () => `the mail server did not answer ${location.host || 'this page'} -- it may be down, or not yet set up for this site`;
  const post = async (to, filename, dataUrl) => {
    const body = JSON.stringify({ app: APP, email: to, filename, dataUrl });
    let res;
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    } catch { throw new Error(unreachable()); }
    if (!res.ok) throw new Error(`the mail server replied ${res.status}`);
  };
  const download = (filename, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const open = ({ fault = null } = {}) => {
    if (!document.body) return null;
    if (document.querySelector('[data-error-report]')) return null;   // one at a time
    ensureStyle();
    const scrim = document.createElement('div');
    scrim.className = 'er-scrim';
    scrim.dataset.errorReport = fault ? 'fault' : 'manual';
    const canFile = Boolean(hooks.file);
    scrim.innerHTML = `<div class="er-card" role="dialog" aria-modal="true" aria-labelledby="er-title">
      <h2 id="er-title">${fault ? 'ROUGH-DRAFTER HIT A PROBLEM' : 'REPORT A PROBLEM'}</h2>
      ${fault ? '<p data-er-fault></p>' : ''}
      <p data-er-what>${fault
        ? 'Send a report to the Rough Drafter desk so we can fix it? It carries the fault, your browser and your last few actions. Nothing is sent until you press SEND.'
        : 'Tell the Rough Drafter desk what went wrong. The report carries your browser and your last few actions. Nothing is sent until you press SEND.'}</p>
      ${fault ? '' : `<div class="er-picks" data-er-picks role="group" aria-label="What went wrong">${
        QUICK_PICKS.map(p => `<button type="button" data-er-pick aria-pressed="false">${p}</button>`).join('')}</div>`}
      <label>${fault ? 'What were you doing?' : 'Anything more? (optional)'}<textarea data-er-said placeholder="${fault ? 'Optional' : 'What happened, and what you expected'}"></textarea></label>
      ${canFile ? `<label class="er-tick"><input type="checkbox" data-er-file${fault ? '' : ' checked'}> Include my drawing (the .draft file)</label>` : ''}
      <label>Email me a copy (optional)<input type="email" data-er-copy placeholder="you@example.com"></label>
      <div class="er-status" data-er-status></div>
      <div class="er-row">
        <button type="button" data-er-skip>NOT NOW</button>
        <button type="button" data-er-send>SEND</button>
      </div></div>`;
    if (fault) scrim.querySelector('[data-er-fault]').textContent = `${fault.message}${fault.where ? ` (${fault.where})` : ''}`;
    const said = scrim.querySelector('[data-er-said]');
    const tick = scrim.querySelector('[data-er-file]');
    const copy = scrim.querySelector('[data-er-copy]');
    const status = scrim.querySelector('[data-er-status]');
    const sendBtn = scrim.querySelector('[data-er-send]');
    const skipBtn = scrim.querySelector('[data-er-skip]');
    copy.value = store.get(ADDRESS_KEY) || '';
    const say = (text, kind = '') => { status.textContent = text; status.dataset.kind = kind; };
    // ONE PICK AT A TIME; tapping the pressed one lets go of it.
    let pick = '';
    scrim.querySelectorAll('[data-er-pick]').forEach(btn => btn.addEventListener('click', () => {
      pick = btn.getAttribute('aria-pressed') === 'true' ? '' : btn.textContent;
      scrim.querySelectorAll('[data-er-pick]').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === pick)));
      say('');
    }));
    const close = () => scrim.remove();
    // THE BUTTON SAYS WHAT WILL HAPPEN: no desk address and no copy address
    // means nothing can be mailed, so the report is saved here instead.
    const recipients = () => [REPORT_TO, copy.value].map(s => String(s).trim()).filter(validAddress);
    const relabel = () => { sendBtn.textContent = recipients().length ? 'SEND' : 'SAVE REPORT FILE'; };
    relabel();
    copy.addEventListener('input', relabel);
    skipBtn.addEventListener('click', close);
    scrim.addEventListener('click', event => { if (event.target === scrim) close(); });
    scrim.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    let keepHere = null;   // set once a send fails: the next press saves instead
    sendBtn.addEventListener('click', async () => {
      if (keepHere) { keepHere(); return; }
      const copyTo = copy.value.trim();
      if (!fault && !pick && !said.value.trim()) { say('Tap what went wrong, or type a line.', 'error'); return; }
      if (copyTo && !validAddress(copyTo)) { say('That copy address does not look like an email.', 'error'); copy.focus(); return; }
      const to = recipients();
      const name = `rough-drafter-report-${stamp()}`;
      const text = compose({ fault, said: said.value, pick, copyTo });
      let file = null;
      if (tick && tick.checked) {
        file = safely(hooks.file, error => ({ name: `${name}.draft`, text: `the drawing could not be read: ${error && error.message || error}` }));
        if (file && !file.name) file.name = `${name}.draft`;
      }
      if (!to.length) {
        download(`${name}.txt`, text, 'text/plain');
        if (file) download(file.name, file.text, 'application/json');
        say('Report saved on this computer. Email it to the Rough Drafter desk when you can.', 'ok');
        sendBtn.disabled = true;
        skipBtn.textContent = 'CLOSE';
        return;
      }
      if (allowance() < to.length) {
        say(`This browser has sent its ${SENDS_PER_HOUR} reports for the hour. Try again later, or clear the copy address.`, 'error');
        return;
      }
      sendBtn.disabled = true; skipBtn.disabled = true;
      try {
        if (copyTo) store.set(ADDRESS_KEY, copyTo);
        const reportUrl = asDataUrl(text, 'text/plain');
        const fileUrl = file ? asDataUrl(file.text, 'application/json') : null;
        for (const address of to) {
          say(`Sending to ${address === REPORT_TO ? 'the Rough Drafter desk' : address}…`);
          await post(address, `${name}.txt`, reportUrl);
          if (fileUrl) await post(address, file.name, fileUrl);
          noteSent();
        }
        say(`Report sent${copyTo && REPORT_TO ? `, with a copy to ${copyTo}` : copyTo ? ` to ${copyTo}` : ''}. Thank you.`, 'ok');
        skipBtn.disabled = false;
        skipBtn.textContent = 'CLOSE';
      } catch (error) {
        say(`Could not send (${error.message || error}). SAVE REPORT FILE keeps it on this computer instead.`, 'error');
        sendBtn.disabled = false; skipBtn.disabled = false;
        sendBtn.textContent = 'SAVE REPORT FILE';
        keepHere = () => {
          download(`${name}.txt`, text, 'text/plain');
          if (file) download(file.name, file.text, 'application/json');
          say('Report saved on this computer.', 'ok');
          sendBtn.disabled = true;
          skipBtn.textContent = 'CLOSE';
        };
      }
    });
    document.body.appendChild(scrim);
    (fault ? sendBtn : said).focus();
    return scrim;
  };

  // ── REPORT A PROBLEM, in the foot lane ────────────────────────────────
  const mountButton = () => {
    const lane = document.querySelector('[data-foot-lane]');
    if (!lane || lane.querySelector('[data-report-problem]')) return;
    ensureStyle();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-report-problem', '');
    btn.textContent = 'REPORT A PROBLEM';
    btn.title = 'Send a report to the Rough Drafter desk';
    btn.addEventListener('click', () => open());
    // LEFT OF THE NOTE, never after it: the clock lives in [data-foot-note]
    // with margin-left:auto, and tests/model-clock.spec.js holds it to the
    // bar's 12px right inset. A button appended after it would stand in the
    // clock's corner.
    lane.insertBefore(btn, lane.querySelector('[data-foot-note]'));
  };

  window.addEventListener('error', onFault);
  window.addEventListener('unhandledrejection', onFault);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { watch(); mountButton(); }, { once: true });
  } else { watch(); mountButton(); }

  window.DraftErrorReport = Object.freeze({
    open: () => open(), note, attach, compose, allowance, noteSent, mountButton,
    REPORT_TO, ENDPOINT, APP, SENDS_PER_HOUR, QUICK_PICKS,
  });
})();
