// PROJECTS -- a house opened by its link, and the upload behind it.
//
// jb, 28 Nov 2026: "https://roughdrafter.com/viewer/ and then a filename
// directory where i can put the file for a project and a user can type in
// https://roughdrafter.com/viewer/PROJECT_NAME and it will open their file
// directly in the viewer without having to load any files", uploaded "from
// the website", kept "kindof 'secret' so only i can upload". jb chose
// Cloudflare storage over commits to the repo.
//
// THE LINK. roughdrafter.com is GitHub Pages and ruffdrafter.com Cloudflare
// Pages; neither has a page at /viewer/smith-house, so both serve the site's
// 404.html, which sends the visit here as /viewer/?project=smith-house. This
// page fetches the file from the projects Worker, opens it as if it had been
// dropped in, and puts the short address back in the bar.
//
// THE UPLOAD. Only while 3DBONES sits on lines 1 to 5 of the NOTEPAD's page 1
// (jb: "lets make it 25BONES 3DBONES (to unlock the saving files)", "once
// the code is in make the button show up for the saving the projects") does
// the PROJECTS button show. The code is in this page's source for anyone to
// read, so it only shows the button: the lock is the password, checked by
// the Worker (workers/projects/worker.mjs), asked once and remembered on
// this computer if wanted.
(function () {
  'use strict';
  if (window.DraftViewerProjects) return;

  // The Worker's address (workers/projects/README.md, step 4). jb's
  // workers.dev name is bluejetty (the mail worker is
  // bluejetty-mail.bluejetty.workers.dev).
  const PROJECTS_API = 'https://roughdrafter-projects.bluejetty.workers.dev';
  const KEY_STORE = 'draft-viewer-projects-key';
  const MAX_BYTES = 25 * 1024 * 1024;

  const $ = id => document.getElementById(id);
  const V = () => window.DraftViewer;
  const api = () => PROJECTS_API;

  // Letters, digits and dashes; capitals do not count (jb, 28 Nov 2026).
  // The Worker cleans names the same way; a name it would refuse is refused
  // here first, in words.
  const NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
  const cleanName = raw => {
    const n = String(raw || '').trim().toLowerCase();
    return NAME.test(n) ? n : null;
  };
  // A name made from a file name: SMITH HOUSE.draft -> smith-house.
  const nameFromFile = fileName => String(fileName || '')
    .replace(/\.(draft|json|zip)$/i, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');

  // The viewer's own folder, wherever the site sits: /viewer/ on both sites.
  const viewerDir = () => {
    const p = location.pathname;
    const i = p.toLowerCase().lastIndexOf('/viewer/');
    return i >= 0 ? p.slice(0, i + '/viewer/'.length) : p.replace(/[^/]*$/, '');
  };
  const linkFor = name => `${location.origin}${viewerDir()}${name}`;

  // ── OPENING A PROJECT BY ITS LINK ──────────────────────────────────────
  // ?project=NAME (from 404.html), or /viewer/NAME itself where a server
  // hands this page out for that address.
  function projectAsked() {
    const q = new URLSearchParams(location.search).get('project');
    if (q != null) return { raw: q, name: cleanName(q) };
    const m = /\/viewer\/([^/?#]+)\/?$/i.exec(location.pathname);
    if (m && !/\.html?$/i.test(m[1])) return { raw: decodeURIComponent(m[1]), name: cleanName(decodeURIComponent(m[1])) };
    return null;
  }

  async function openProject(name, { pretty = true } = {}) {
    const v = V();
    const clean = cleanName(name);
    if (!clean) {
      v.setStatus(`"${name}" is not a project name: letters, numbers and dashes only.`, true);
      document.body.dataset.project = 'bad-name';
      return null;
    }
    v.setStatus(`Opening the project ${clean}...`);
    document.body.dataset.project = 'loading';
    let res;
    try {
      res = await fetch(`${api()}/p/${encodeURIComponent(clean)}`, { cache: 'no-cache' });
    } catch (e) {
      v.setStatus(`Could not reach the project store to open ${clean}. Check the connection and reload.`, true);
      document.body.dataset.project = 'unreachable';
      return null;
    }
    if (res.status === 404) {
      v.setStatus(`There is no project called ${clean}. Check the link, or open a .draft yourself.`, true);
      document.body.dataset.project = 'missing';
      return null;
    }
    if (!res.ok) {
      v.setStatus(`The project store said no (${res.status}) to ${clean}.`, true);
      document.body.dataset.project = 'error';
      return null;
    }
    const blob = await res.blob();
    const fileName = res.headers.get('X-File-Name') || `${clean}.draft`;
    const file = new File([blob], fileName, { type: blob.type });
    const built = await v.openFile(file);
    if (!built) { document.body.dataset.project = 'error'; return null; }
    v.state.project = clean;
    document.body.dataset.project = clean;
    // The short address back in the bar: what was typed, and what to share.
    if (pretty) {
      try { history.replaceState(history.state, '', `${viewerDir()}${clean}`); } catch (e) { /* file:// */ }
    }
    return built;
  }

  // ── THE PASSWORD ───────────────────────────────────────────────────────
  let sessionKey = null;
  const savedKey = () => { try { return localStorage.getItem(KEY_STORE); } catch (e) { return null; } };
  const key = () => sessionKey || savedKey();
  const authed = (extra) => ({ ...(extra || {}), Authorization: `Bearer ${key()}` });

  function say(text, warn) {
    const el = $('projects-said');
    el.textContent = text || '';
    el.classList.toggle('warn', !!warn);
  }

  function showLocked(locked) {
    $('projects-lock').hidden = !locked;
    $('projects-open-box').hidden = locked;
    $('projects-forget').hidden = locked || !savedKey();
  }

  async function unlock() {
    const pw = $('projects-password').value;
    if (!pw) { say('Type your password first.', true); return false; }
    say('Checking...');
    let res;
    try {
      res = await fetch(`${api()}/check`, { headers: { Authorization: `Bearer ${pw}` } });
    } catch (e) {
      say('Could not reach the project store. Is the Cloudflare worker set up? (workers/projects/README.md)', true);
      return false;
    }
    if (res.status === 401) { say('That is not the password.', true); return false; }
    if (!res.ok) { say(`The project store said no (${res.status}).`, true); return false; }
    sessionKey = pw;
    if ($('projects-remember').checked) { try { localStorage.setItem(KEY_STORE, pw); } catch (e) { /* private window */ } }
    $('projects-password').value = '';
    say('');
    showLocked(false);
    await refreshList();
    return true;
  }

  function forget() {
    sessionKey = null;
    try { localStorage.removeItem(KEY_STORE); } catch (e) { /* private window */ }
    showLocked(true);
    say('Locked. The password is forgotten on this computer.');
  }

  // A 401 on any call: the password changed in Cloudflare, or was wrong.
  function refused() {
    sessionKey = null;
    try { localStorage.removeItem(KEY_STORE); } catch (e) { /* private window */ }
    showLocked(true);
    say('The project store did not take the saved password. Type it again.', true);
  }

  // ── THE LIST ───────────────────────────────────────────────────────────
  const sizeWords = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const whenWords = iso => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    const mins = (Date.now() - d.getTime()) / 60000;
    if (mins < 2) return 'just now';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  async function copy(text, button) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
    if (button) {
      const was = button.textContent;
      button.textContent = ok ? 'COPIED' : 'SELECT IT';
      setTimeout(() => { button.textContent = was; }, 1500);
    }
    return ok;
  }

  function button(label, title, on) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', on);
    return b;
  }

  async function refreshList() {
    const table = $('projects-list');
    let res;
    try {
      res = await fetch(`${api()}/list`, { headers: authed(), cache: 'no-store' });
    } catch (e) {
      say('Could not reach the project store for the list.', true);
      return null;
    }
    if (res.status === 401) { refused(); return null; }
    if (!res.ok) { say(`The project store said no (${res.status}) to the list.`, true); return null; }
    const { projects } = await res.json();
    table.textContent = '';
    if (!projects.length) {
      const tr = table.insertRow();
      const td = tr.insertCell();
      td.colSpan = 3;
      td.textContent = 'None yet. Upload one above.';
    }
    projects.forEach(p => {
      const tr = table.insertRow();
      tr.dataset.project = p.name;
      tr.insertCell().textContent = p.name;
      const when = tr.insertCell();
      when.className = 'when';
      when.textContent = `${whenWords(p.uploadedAt)} · ${sizeWords(p.size)}`;
      const acts = tr.insertCell();
      acts.className = 'acts';
      acts.append(
        button('OPEN', `Open ${p.name} here`, () => openProject(p.name)),
        button('COPY LINK', linkFor(p.name), e => copy(linkFor(p.name), e.target)),
        button('DELETE', `Delete ${p.name} for good: its link stops working`, e => {
          const b = e.target;
          // Two presses, no browser dialog: DELETE, then SURE?
          if (!b.classList.contains('sure')) {
            b.classList.add('sure'); b.textContent = 'SURE?';
            setTimeout(() => { b.classList.remove('sure'); b.textContent = 'DELETE'; }, 4000);
            return;
          }
          remove(p.name);
        }),
      );
    });
    document.body.dataset.projects = projects.map(p => p.name).join(',');
    return projects;
  }

  async function remove(name) {
    say(`Deleting ${name}...`);
    let res;
    try {
      res = await fetch(`${api()}/p/${encodeURIComponent(name)}`, { method: 'DELETE', headers: authed() });
    } catch (e) { say('Could not reach the project store.', true); return false; }
    if (res.status === 401) { refused(); return false; }
    if (!res.ok) { say(`The project store said no (${res.status}).`, true); return false; }
    say(`${name} is deleted; its link no longer opens anything.`);
    await refreshList();
    return true;
  }

  // ── THE UPLOAD ─────────────────────────────────────────────────────────
  let picked = null;
  function pick(file) {
    picked = file || null;
    $('projects-file-name').textContent = picked ? `${picked.name} (${sizeWords(picked.size)})` : 'Pick a .draft or a SAVE AS ZIP';
    if (picked && !$('projects-name').value.trim()) $('projects-name').value = nameFromFile(picked.name);
    checkReady();
  }
  function checkReady() {
    const name = cleanName($('projects-name').value);
    $('projects-upload').disabled = !(picked && name);
    if ($('projects-name').value.trim() && !name) say('Names are letters, numbers and dashes, no spaces (smith-house).', true);
    else if (picked && picked.size > MAX_BYTES) say(`${picked.name} is over 25 MB.`, true);
    else say('');
  }

  async function upload() {
    const name = cleanName($('projects-name').value);
    if (!picked || !name) return null;
    if (picked.size > MAX_BYTES) { say(`${picked.name} is over 25 MB.`, true); return null; }
    $('projects-upload').disabled = true;
    say(`Uploading ${picked.name} as ${name}...`);
    let res;
    try {
      res = await fetch(`${api()}/p/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: authed({ 'X-File-Name': picked.name.replace(/[^\w.\- ()]+/g, '') }),
        body: picked,
      });
    } catch (e) {
      say('Could not reach the project store. Nothing was uploaded.', true);
      $('projects-upload').disabled = false;
      return null;
    }
    $('projects-upload').disabled = false;
    if (res.status === 401) { refused(); return null; }
    if (!res.ok) {
      let why = `(${res.status})`;
      try { why = (await res.json()).error || why; } catch (e) { /* not JSON */ }
      say(`Not uploaded: ${why}`, true);
      return null;
    }
    const link = linkFor(name);
    const box = $('projects-link');
    box.textContent = 'Link ready: ';
    const b = document.createElement('b');
    b.textContent = link;
    box.append(b, button('COPY', 'Copy the link', e => copy(link, e.target)));
    box.hidden = false;
    say(`Uploaded. Anyone with the link sees the house.`);
    document.body.dataset.uploaded = name;
    pick(null);
    $('projects-name').value = '';
    $('projects-upload').disabled = true;
    await refreshList();
    return link;
  }

  // ── THE BUTTON AND THE PANEL ───────────────────────────────────────────
  const codeOn = () => {
    const W = window.DraftBoneWallet;
    return !!(W && W.padHas && W.padHas(W.PROJECTS_CODE));
  };
  function showButton() {
    const on = codeOn() && document.body.dataset.embed !== '1';
    $('projects-open').hidden = !on;
    if (!on && !$('projects').hidden) V().closePanel('projects');
  }

  async function openPanel(want) {
    const panel = $('projects');
    const on = want == null ? panel.hidden : !!want;
    if (on) V().closeOthers('projects');
    panel.hidden = !on;
    $('projects-open').classList.toggle('lit', on);
    if (!on) return;
    say('');
    $('projects-link').hidden = true;
    if (key()) { showLocked(false); await refreshList(); }
    else { showLocked(true); $('projects-password').focus(); }
  }

  function boot() {
    if (!$('projects') || !V()) return;
    $('projects-open').addEventListener('click', () => openPanel());
    $('projects-close').addEventListener('click', () => openPanel(false));
    $('projects-unlock').addEventListener('click', unlock);
    $('projects-password').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
    $('projects-forget').addEventListener('click', forget);
    $('projects-pick').addEventListener('click', () => $('projects-file').click());
    $('projects-file').addEventListener('change', e => { pick(e.target.files[0]); e.target.value = ''; });
    $('projects-name').addEventListener('input', checkReady);
    $('projects-upload').addEventListener('click', upload);
    showButton();
    window.addEventListener('draft-pad-changed', showButton);
    window.addEventListener('storage', e => { if (e.key === 'draft.notepad' || e.key === null) showButton(); });

    const asked = projectAsked();
    if (asked && document.body.dataset.embed !== '1') {
      if (asked.name) openProject(asked.name);
      else {
        V().setStatus(`"${asked.raw}" is not a project name: letters, numbers and dashes only.`, true);
        document.body.dataset.project = 'bad-name';
      }
    }
  }

  window.DraftViewerProjects = Object.freeze({ PROJECTS_API, cleanName, nameFromFile, linkFor, openProject, upload, refreshList, openPanel, pick });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
