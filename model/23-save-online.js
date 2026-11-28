// MODEL.html's page script, part 23: SAVE ONLINE and OPEN ONLINE.
//
// jb, 28 Nov 2026: "can i put a code into my main MODEL program so that i can
// save my file directly to a HTML file that can be either accessed by the
// viewer / or also i can open and edit it with the model html part ... that
// way i could allow the user to view the most recent update in live time".
//
// WHAT IT DOES. One ONLINE button beside SAVE AS opens a card with two
// presses at its top. SAVE ONLINE saves the drawing as SAVE does, then sends the
// same .draft SAVE AS writes (underlay pictures packed in) to the projects
// store under a name: the house's folder (workers/projects/worker.mjs).
// Saving again replaces it, and roughdrafter.com/viewer/NAME shows that
// latest save the next time the customer opens or refreshes the link.
// OPEN ONLINE lists the folders and opens one here, on any computer, to keep
// editing. Nothing is charged in bones: this is jb's own tool.
//
// WHO SEES IT. Only while 3DBONES sits on one of lines 1 to 5 of NOTES
// page 1 (bone-wallet.js padHas), the code that shows the viewer's PROJECTS
// button. The code is in the page source for anyone to read, so it only
// shows the button: the lock is the password, checked by the Worker, asked
// once and remembered on this computer if wanted. The viewer and this page
// share one site, so a password remembered in either is remembered in both.
// Customers can never put anything in a folder (jb: "don't allow the user to
// save anything in there, only i will").
//
// Loaded after part 17 and sharing its scope: save, serializeDrawing,
// withUnderlayFiles, unpackUnderlayFiles, openZipBundle, adoptAndShow,
// guardUnsaved, setRail, drawing.

  (() => {
  // The Worker's address: the same one viewer/projects.js uses
  // (workers/projects/README.md, step 4). Change both together.
  const PROJECTS_API = 'https://roughdrafter-projects.bluejetty.workers.dev';
  const KEY_STORE = 'draft-viewer-projects-key';
  const LAST_NAME_STORE = 'draft-online-name';
  const MAX_BYTES = 25 * 1024 * 1024;

  // Letters, digits and dashes; capitals do not count (the Worker's rule).
  const NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
  const cleanName = raw => {
    const n = String(raw || '').trim().toLowerCase();
    return NAME.test(n) ? n : null;
  };
  const nameFrom = text => String(text || '')
    .replace(/\.(draft|json|model|plan|zip)$/i, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
  // The customer's link, on whichever of the two sites this page is.
  const siteRoot = () => {
    const p = location.pathname.replace(/[^/]*$/, '');
    return /^https?:/.test(location.protocol) ? `${location.origin}${p}` : 'https://roughdrafter.com/';
  };
  const linkFor = name => `${siteRoot()}viewer/${name}`;

  const fileRow = document.getElementById('file-row');
  if (!fileRow) return;

  // ── ONE BUTTON, after SAVE AS and its extension ──────────────────────
  // ONLINE, one press for both jobs: the top bar has no room for two more
  // (at 1400 px PRINTSCREEN was pushed off the right edge). The card it
  // opens has SAVE ONLINE and OPEN ONLINE side by side at its top.
  const onlineButton = document.createElement('button');
  onlineButton.type = 'button';
  onlineButton.id = 'file-online';
  onlineButton.dataset.fileOnline = '';
  onlineButton.textContent = 'ONLINE';
  onlineButton.title = 'SAVE ONLINE: put this drawing online, its customer link shows this save. OPEN ONLINE: open one you saved online.';
  onlineButton.hidden = true;
  const extPick = document.getElementById('file-ext');
  (extPick || document.getElementById('file-save-as') || fileRow.lastElementChild).after(onlineButton);

  // ── THE CARD, in the shell every file question wears ─────────────────
  const box = document.createElement('div');
  box.id = 'save-online';
  box.dataset.saveOnline = '';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.innerHTML = `
  <div class="promote-card">
    <div class="online-modes" role="tablist">
      <button type="button" role="tab" data-online-mode="save">SAVE ONLINE</button>
      <button type="button" role="tab" data-online-mode="open">OPEN ONLINE</button>
    </div>
    <div data-online-lock hidden>
      <p class="online-small">Type your projects password. It is checked by your Cloudflare store.</p>
      <input id="online-password" data-online-password type="password" autocomplete="current-password" aria-label="Projects password" />
      <label class="online-small online-remember"><input type="checkbox" data-online-remember checked /> remember on this computer</label>
      <div class="promote-row">
        <button type="button" data-online-unlock>UNLOCK</button>
        <button type="button" data-online-cancel>Cancel</button>
      </div>
    </div>
    <div data-online-save hidden>
      <p class="online-small">Project name (letters, numbers, dashes). Saving again under the same name replaces it, and the customer's link shows the new one.</p>
      <input id="online-name" data-online-name type="text" spellcheck="false" autocomplete="off" aria-label="Project name" />
      <p class="online-small" data-online-link-preview></p>
      <div class="promote-row">
        <button type="button" data-online-save-go>SAVE ONLINE</button>
        <button type="button" data-online-cancel>Cancel</button>
      </div>
    </div>
    <div data-online-open hidden>
      <p class="online-small">Your online projects. OPEN puts one on this page to keep working on.</p>
      <table class="online-list" data-online-list></table>
      <div class="promote-row">
        <button type="button" data-online-cancel>Cancel</button>
      </div>
    </div>
    <p class="online-said" data-online-said role="status"></p>
    <p class="online-small" data-online-done hidden></p>
    <p class="online-small online-forget"><button type="button" data-online-forget hidden>forget password on this computer</button></p>
  </div>`;
  document.body.append(box);
  const $ = sel => box.querySelector(sel);
  const nameBox = $('[data-online-name]');
  const pwBox = $('[data-online-password]');

  // ── WHO SEES THE BUTTONS ────────────────────────────────────────────
  const codeOn = () => {
    const W = window.DraftBoneWallet;
    return !!(W && W.padHas && W.PROJECTS_CODE && W.padHas(W.PROJECTS_CODE));
  };
  const showButtons = () => {
    const on = codeOn();
    onlineButton.hidden = !on;
    if (!on && !box.hidden) close();
  };
  window.addEventListener('draft-pad-changed', showButtons);
  window.addEventListener('storage', e => { if (e.key === 'draft.notepad' || e.key === null) showButtons(); });

  // ── THE PASSWORD ─────────────────────────────────────────────────────
  let sessionKey = null;
  const savedKey = () => { try { return localStorage.getItem(KEY_STORE); } catch { return null; } };
  const key = () => sessionKey || savedKey();
  const authed = extra => ({ ...(extra || {}), Authorization: `Bearer ${key()}` });

  const said = (text, warn) => {
    const el = $('[data-online-said]');
    el.textContent = text || '';
    el.dataset.kind = warn ? 'error' : '';
  };
  const UNREACHABLE = 'Could not reach your online projects store. It works once the Cloudflare setup is done (workers/projects/README.md); until then nothing is sent.';

  let mode = 'save';
  const show = part => {
    ['lock', 'save', 'open'].forEach(p => { $(`[data-online-${p}]`).hidden = p !== part; });
    $('[data-online-forget]').hidden = part === 'lock' || !savedKey();
  };

  const refused = () => {
    sessionKey = null;
    try { localStorage.removeItem(KEY_STORE); } catch { /* private window */ }
    show('lock');
    said('The store did not take the saved password. Type it again.', true);
    pwBox.focus();
  };

  const unlock = async () => {
    const pw = pwBox.value;
    if (!pw) { said('Type your password first.', true); return false; }
    said('Checking...');
    let res;
    try {
      res = await fetch(`${PROJECTS_API}/check`, { headers: { Authorization: `Bearer ${pw}` } });
    } catch { said(UNREACHABLE, true); return false; }
    if (res.status === 401) { said('That is not the password.', true); return false; }
    if (!res.ok) { said(`The store said no (${res.status}).`, true); return false; }
    sessionKey = pw;
    if ($('[data-online-remember]').checked) { try { localStorage.setItem(KEY_STORE, pw); } catch { /* private window */ } }
    pwBox.value = '';
    said('');
    await enter(mode);
    return true;
  };

  // ── THE LIST (OPEN ONLINE, and the replace check on SAVE ONLINE) ─────
  let known = null;
  const fetchList = async () => {
    let res;
    try {
      res = await fetch(`${PROJECTS_API}/list`, { headers: authed(), cache: 'no-store' });
    } catch { said(UNREACHABLE, true); return null; }
    if (res.status === 401) { refused(); return null; }
    if (!res.ok) { said(`The store said no (${res.status}) to the list.`, true); return null; }
    known = (await res.json()).projects || [];
    return known;
  };
  const whenWords = iso => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  };
  const paintList = list => {
    const table = $('[data-online-list]');
    table.textContent = '';
    if (!list.length) {
      const td = table.insertRow().insertCell();
      td.textContent = 'Nothing saved online yet. Use SAVE ONLINE first.';
      return;
    }
    list.forEach(p => {
      const tr = table.insertRow();
      tr.dataset.project = p.name;
      tr.insertCell().textContent = p.name;
      const when = tr.insertCell();
      when.className = 'when';
      when.textContent = whenWords(p.uploadedAt);
      const acts = tr.insertCell();
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'OPEN';
      b.title = `Open ${p.name} on this page`;
      b.addEventListener('click', () => openOnline(p.name));
      acts.append(b);
    });
  };

  // ── OPENING AND CLOSING THE CARD ─────────────────────────────────────
  const lastName = () => { try { return localStorage.getItem(LAST_NAME_STORE) || ''; } catch { return ''; } };
  const rememberName = name => { try { localStorage.setItem(LAST_NAME_STORE, name); } catch { /* private window */ } };
  const generated = () => {
    try { return nameFrom(window.DraftDrawingFormat.drawingFileName('draft')); } catch { return ''; }
  };
  const paintPreview = () => {
    const n = cleanName(nameBox.value);
    const line = $('[data-online-link-preview]');
    $('[data-online-save-go]').disabled = !n;
    resetReplace();
    if (!nameBox.value.trim()) line.textContent = '';
    else if (!n) line.textContent = 'Letters, numbers and dashes only, no spaces (smith-house).';
    else line.textContent = `Customer link: ${linkFor(n)}`;
    line.dataset.kind = nameBox.value.trim() && !n ? 'error' : '';
  };

  const enter = async want => {
    mode = want;
    box.querySelectorAll('[data-online-mode]').forEach(b => {
      b.setAttribute('aria-selected', String(b.dataset.onlineMode === want));
    });
    // No drawing on the page, nothing to save: OPEN is the only way in.
    box.querySelector('[data-online-mode="save"]').disabled = !drawing;
    $('[data-online-done]').hidden = true;
    if (!key()) { show('lock'); pwBox.focus(); return; }
    if (want === 'save') {
      show('save');
      if (!nameBox.value.trim()) nameBox.value = lastName() || generated();
      paintPreview();
      nameBox.focus();
      nameBox.select();
      fetchList(); // quietly, for the replace check
    } else {
      show('open');
      said('Getting your projects...');
      const list = await fetchList();
      if (list) { said(''); paintList(list); }
    }
  };
  const open = async (want = drawing ? 'save' : 'open') => {
    if (want === 'save' && !drawing) want = 'open';
    said('');
    box.hidden = false;
    await enter(want);
  };
  const close = () => { box.hidden = true; said(''); resetReplace(); };

  // ── SAVE ONLINE ──────────────────────────────────────────────────────
  // SAVING OVER ANOTHER HOUSE ASKS TWICE: a name already online that this
  // page did not last save or open turns the button to REPLACE IT? for four
  // seconds, the same two-press the viewer's DELETE uses (no browser dialog).
  let replaceArmed = false;
  let replaceTimer = null;
  const goButton = $('[data-online-save-go]');
  function resetReplace() {
    replaceArmed = false;
    clearTimeout(replaceTimer);
    goButton.textContent = 'SAVE ONLINE';
  }

  const saveOnline = async () => {
    const name = cleanName(nameBox.value);
    if (!name || !drawing) return null;
    const exists = (known || []).some(p => p.name === name);
    if (exists && name !== lastName() && !replaceArmed) {
      replaceArmed = true;
      goButton.textContent = `REPLACE ${name.toUpperCase()}?`;
      said(`${name} is already online. Press again to replace it with this drawing.`, true);
      replaceTimer = setTimeout(() => { resetReplace(); said(''); }, 4000);
      return null;
    }
    resetReplace();
    goButton.disabled = true;
    // SAVED HERE FIRST, as SAVE AS does: what goes online is what the store
    // took. A refused save (another window holds the drawing) sends nothing.
    said('Saving...');
    if (!(await save())) { goButton.disabled = false; said('The drawing was not saved here, so nothing was sent.', true); return null; }
    const packed = await withUnderlayFiles(JSON.stringify(serializeDrawing()));
    const body = new Blob([packed], { type: 'application/json' });
    if (body.size > MAX_BYTES) {
      goButton.disabled = false;
      said(`This drawing is ${(body.size / 1048576).toFixed(1)} MB with its underlay pictures; online saves can be up to 25 MB.`, true);
      return null;
    }
    said(`Sending ${name}...`);
    let res;
    try {
      res = await fetch(`${PROJECTS_API}/p/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: authed({ 'X-File-Name': `${name.toUpperCase()}.draft`, 'X-Saved-From': 'model' }),
        body,
      });
    } catch {
      goButton.disabled = false;
      said(`${UNREACHABLE} The drawing is saved in this browser.`, true);
      return null;
    }
    goButton.disabled = false;
    if (res.status === 401) { refused(); return null; }
    if (!res.ok) {
      let why = `(${res.status})`;
      try { why = (await res.json()).error || why; } catch { /* not JSON */ }
      said(`Not sent: ${why}`, true);
      return null;
    }
    rememberName(name);
    nameBox.value = name;
    known = (known || []).filter(p => p.name !== name).concat([{ name }]);
    const link = linkFor(name);
    said(`Saved online at ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. The customer's link shows this save.`);
    const done = $('[data-online-done]');
    done.textContent = '';
    const b = document.createElement('b');
    b.textContent = link;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'COPY LINK';
    copy.addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(link); ok = true; } catch { ok = false; }
      copy.textContent = ok ? 'COPIED' : 'SELECT IT';
      setTimeout(() => { copy.textContent = 'COPY LINK'; }, 1500);
    });
    done.append(b, ' ', copy);
    done.hidden = false;
    document.body.dataset.savedOnline = name;
    return link;
  };

  // ── OPEN ONLINE ──────────────────────────────────────────────────────
  // The same road as OPEN: the unsaved-edits guard first, then a zip or a
  // .draft, its underlay pictures put back, onto LEVELS / LAYERS.
  const openOnline = name => {
    close();
    guardUnsaved('opening another', async () => {
      let res;
      try {
        res = await fetch(`${PROJECTS_API}/p/${encodeURIComponent(name)}`, { cache: 'no-cache' });
      } catch { box.hidden = false; show('open'); said(UNREACHABLE, true); return; }
      if (!res.ok) { box.hidden = false; show('open'); said(`Could not open ${name} (${res.status}).`, true); return; }
      const blob = await res.blob();
      const file = new File([blob], res.headers.get('X-File-Name') || `${name}.draft`, { type: blob.type });
      const opened = (await window.DraftZipBundle?.looksLikeZip(file)) ? await openZipBundle(file) : file;
      if (opened && (await adoptAndShow(await unpackUnderlayFiles(opened)))) {
        rememberName(name);
        nameBox.value = name;
        setRail('right', true);
        document.body.dataset.openedOnline = name;
      }
    });
  };

  // ── WIRING ───────────────────────────────────────────────────────────
  onlineButton.addEventListener('click', () => open());
  box.querySelectorAll('[data-online-mode]').forEach(b => b.addEventListener('click', () => {
    said('');
    resetReplace();
    enter(b.dataset.onlineMode);
  }));
  box.querySelectorAll('[data-online-cancel]').forEach(b => b.addEventListener('click', close));
  $('[data-online-unlock]').addEventListener('click', unlock);
  pwBox.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); unlock(); } else if (e.key === 'Escape') close();
  });
  nameBox.addEventListener('input', paintPreview);
  nameBox.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveOnline(); } else if (e.key === 'Escape') close();
  });
  goButton.addEventListener('click', saveOnline);
  $('[data-online-forget]').addEventListener('click', () => {
    sessionKey = null;
    try { localStorage.removeItem(KEY_STORE); } catch { /* private window */ }
    show('lock');
    said('The password is forgotten on this computer.');
  });
  showButtons();

  window.DraftSaveOnline = Object.freeze({ PROJECTS_API, cleanName, linkFor, open, close, saveOnline, openOnline, showButtons });
  })();
