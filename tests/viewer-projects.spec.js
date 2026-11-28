// PROJECT LINKS, THE VIEWER'S NOTEPAD, THE BONE AT THE FOOT AND TAKE PHOTO
// (jb, 28 Nov 2026) -- viewer/projects.js, viewer/notepad.js,
// viewer/photo-bones.js, 404.html.
//
// The projects Worker (workers/projects/worker.mjs) lives in Cloudflare and
// is never reached from here: its address is answered by a stand-in, a
// bucket in this file, with the Worker's own rules (its own harness,
// proto/projects-worker-harness.js, runs the real code against a fake bucket).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'proto', 'repro-movie-2storey-garage.draft');
const API = 'https://roughdrafter-projects.bluejetty.workers.dev';
const PASSWORD = 'jb-long-password';

// The Worker, as far as the viewer can tell: GET /p/NAME open to all, the
// rest behind the password. `calls` records what the page sent.
async function standInWorker(p, start = {}) {
  const bucket = new Map(Object.entries(start));
  const calls = [];
  await p.route(`${API}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const auth = (await req.headerValue('authorization')) || '';
    const okPw = auth === `Bearer ${PASSWORD}`;
    calls.push({ method: req.method(), path: url.pathname, auth: okPw });
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-File-Name' };
    const json = (status, body) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'Access-Control-Allow-Headers': 'Authorization, X-File-Name', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE' } });
    const m = /^\/p\/([a-z0-9-]+)$/.exec(url.pathname);
    if (m && req.method() === 'GET') {
      const it = bucket.get(m[1]);
      if (!it) return json(404, { error: `No project called ${m[1]}.` });
      return route.fulfill({ status: 200, headers: { ...cors, 'X-File-Name': it.fileName }, contentType: 'application/json', body: it.body });
    }
    if (!okPw) return json(401, { error: 'Wrong password.' });
    if (url.pathname === '/check') return json(200, { ok: true });
    if (url.pathname === '/list') {
      return json(200, { projects: [...bucket.entries()].map(([name, it]) => ({ name, size: it.body.length, uploadedAt: new Date().toISOString(), fileName: it.fileName })) });
    }
    if (m && req.method() === 'PUT') {
      bucket.set(m[1], { body: req.postDataBuffer(), fileName: (await req.headerValue('x-file-name')) || `${m[1]}.draft` });
      return json(200, { ok: true, name: m[1] });
    }
    if (m && req.method() === 'DELETE') { bucket.delete(m[1]); return json(200, { ok: true }); }
    return json(404, {});
  });
  return { bucket, calls };
}

const house = () => ({ body: fs.readFileSync(FIXTURE), fileName: 'SMITH HOUSE.draft' });

const setPad = (p, text) => p.evaluate(t => {
  if (t == null) localStorage.removeItem('draft.notepad'); else localStorage.setItem('draft.notepad', t);
}, text);
const wallet = (p, n) => p.evaluate(n => localStorage.setItem('draft-bone-wallet',
  JSON.stringify({ balance: n, lastDripAt: Date.now(), createdAt: Date.now() })), n);

async function viewer(p, query = '') {
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(`/viewer/index.html?painter=plain${query}`);
  await p.waitForSelector('body[data-ready="1"]');
  return errors;
}

// ── THE LINK ─────────────────────────────────────────────────────────────

test('a project link opens the house with no file to pick, and the short address goes back in the bar', async ({ page: p }) => {
  const { calls } = await standInWorker(p, { 'smith-house': house() });
  const errors = await viewer(p, '&project=Smith-House');
  await p.waitForFunction(() => document.body.dataset.project === 'smith-house');
  expect(Number(await p.evaluate(() => document.body.dataset.loaded))).toBeGreaterThan(100);
  expect(new URL(p.url()).pathname).toBe('/viewer/smith-house');
  expect(calls).toEqual([{ method: 'GET', path: '/p/smith-house', auth: false }]);
  await expect(p.locator('#status')).toContainText('SMITH HOUSE.draft');
  // A visitor sees no PROJECTS button.
  await expect(p.locator('#projects-open')).toBeHidden();
  expect(errors).toEqual([]);
});

test('a name nobody uploaded says so in words; a bad name is refused before asking', async ({ page: p }) => {
  const { calls } = await standInWorker(p);
  await viewer(p, '&project=jones');
  await p.waitForFunction(() => document.body.dataset.project === 'missing');
  await expect(p.locator('#status')).toHaveText(/no project called jones/i);
  await p.goto('/viewer/index.html?painter=plain&project=bad_name!');
  await p.waitForFunction(() => document.body.dataset.project === 'bad-name');
  await expect(p.locator('#status')).toHaveText(/letters, numbers and dashes/);
  expect(calls.length).toBe(1);
});

test('404.html sends /viewer/NAME on to the viewer with the name, and anything else home', async ({ page: p }) => {
  const html = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const goes = await p.evaluate(script => {
    const out = {};
    for (const at of ['/viewer/smith-house', '/viewer/Smith-House/', '/viewer/index.htm', '/LAYOUT', '/viewer/a/b']) {
      let went = null;
      const loc = { pathname: at, hash: '', replace: u => { went = u; } };
      new Function('location', script)(loc);
      out[at] = went;
    }
    return out;
  }, script);
  expect(goes).toEqual({
    '/viewer/smith-house': '/viewer/?project=smith-house',
    '/viewer/Smith-House/': '/viewer/?project=Smith-House',
    '/viewer/index.htm': null,
    '/LAYOUT': null,
    '/viewer/a/b': null,
  });
});

// ── THE NOTEPAD AND 3DBONES ──────────────────────────────────────────────

test('the NOTEPAD is the drafter\'s pad, and 3DBONES on lines 1 to 5 shows the PROJECTS button', async ({ page: p }) => {
  await viewer(p);
  await setPad(p, 'from the drafter');
  await p.reload();
  await p.waitForSelector('body[data-ready="1"]');
  await expect(p.locator('#pad')).toBeHidden();
  await p.locator('#pad-tab').click();
  await expect(p.locator('#pad-text')).toHaveValue('from the drafter');
  await expect(p.locator('#projects-open')).toBeHidden();
  await p.locator('#pad-text').fill('lot 12\n\n25bones\n 3dbones \nnotes');
  await expect(p.locator('#projects-open')).toBeVisible();
  expect(await p.evaluate(() => DraftBoneWallet.cap())).toBe(25);
  // Kept where the drafter reads it.
  expect(await p.evaluate(() => localStorage.getItem('draft.notepad'))).toBe('lot 12\n\n25bones\n 3dbones \nnotes');
  // Line 6 is just a note.
  await p.locator('#pad-text').fill('a\nb\nc\nd\ne\n3DBONES');
  await expect(p.locator('#projects-open')).toBeHidden();
  // Page 2 is a page of its own and holds no codes.
  await p.locator('#pad-text').fill('');
  await p.locator('[data-pad-page="2"]').click();
  await p.locator('#pad-text').fill('3DBONES');
  await expect(p.locator('#projects-open')).toBeHidden();
  expect(JSON.parse(await p.evaluate(() => localStorage.getItem('draft.notepad.pages')))[1]).toBe('3DBONES');
});

// ── THE UPLOAD ───────────────────────────────────────────────────────────

test('the password unlocks PROJECTS; an upload gives the link, the list shows it, DELETE takes two presses', async ({ page: p }) => {
  const { bucket, calls } = await standInWorker(p, { timberhouse: house() });
  await viewer(p);
  await setPad(p, '3DBONES');
  await p.reload();
  await p.waitForSelector('body[data-ready="1"]');
  await p.locator('#projects-open').click();
  await expect(p.locator('#projects-lock')).toBeVisible();
  await p.locator('#projects-password').fill('guess');
  await p.locator('#projects-unlock').click();
  await expect(p.locator('#projects-said')).toHaveText('That is not the password.');
  await p.locator('#projects-password').fill(PASSWORD);
  await p.locator('#projects-unlock').click();
  await expect(p.locator('#projects-open-box')).toBeVisible();
  await expect(p.locator('#projects-list tr[data-project="timberhouse"]')).toBeVisible();
  // Remembered on this computer.
  expect(await p.evaluate(() => localStorage.getItem('draft-viewer-projects-key'))).toBe(PASSWORD);

  await p.setInputFiles('#projects-file', FIXTURE);
  await expect(p.locator('#projects-name')).toHaveValue('repro-movie-2storey-garage');
  await p.locator('#projects-name').fill('Smith House');
  await expect(p.locator('#projects-upload')).toBeDisabled();
  await expect(p.locator('#projects-said')).toHaveText(/letters, numbers and dashes/);
  await p.locator('#projects-name').fill('smith-house');
  await p.locator('#projects-upload').click();
  await expect(p.locator('#projects-link')).toContainText('/viewer/smith-house');
  expect(bucket.get('smith-house').body.length).toBe(fs.statSync(FIXTURE).size);
  expect(calls.find(c => c.method === 'PUT').auth).toBe(true);
  await expect(p.locator('#projects-list tr[data-project="smith-house"]')).toBeVisible();

  const del = p.locator('#projects-list tr[data-project="timberhouse"] button', { hasText: 'DELETE' });
  await del.click();
  expect(bucket.has('timberhouse')).toBe(true);
  await p.locator('#projects-list tr[data-project="timberhouse"] button', { hasText: 'SURE?' }).click();
  await expect(p.locator('#projects-list tr[data-project="timberhouse"]')).toHaveCount(0);
  expect(bucket.has('timberhouse')).toBe(false);

  // Taking 3DBONES off the pad hides the button and shuts the panel.
  await p.locator('#pad-tab').click();
  await p.locator('#pad-text').fill('');
  await expect(p.locator('#projects-open')).toBeHidden();
  await expect(p.locator('#projects')).toBeHidden();
});

test('a remembered password that Cloudflare no longer takes is forgotten and asked again', async ({ page: p }) => {
  await standInWorker(p);
  await viewer(p);
  await setPad(p, '3DBONES');
  await p.evaluate(() => localStorage.setItem('draft-viewer-projects-key', 'old-password'));
  await p.reload();
  await p.waitForSelector('body[data-ready="1"]');
  await p.locator('#projects-open').click();
  await expect(p.locator('#projects-lock')).toBeVisible();
  await expect(p.locator('#projects-said')).toHaveText(/did not take the saved password/);
  expect(await p.evaluate(() => localStorage.getItem('draft-viewer-projects-key'))).toBe(null);
});

// ── THE BONE AND TAKE PHOTO ──────────────────────────────────────────────

async function withHouse(p, picker = 'save') {
  await p.addInitScript(mode => {
    window.__files = [];
    window.showSaveFilePicker = async opts => {
      if (mode === 'cancel') throw new DOMException('cancelled', 'AbortError');
      return { kind: 'file', name: opts.suggestedName, createWritable: async () => ({
        write: async blob => {
          const bmp = await createImageBitmap(blob);
          window.__files.push({ name: opts.suggestedName, size: blob.size, type: blob.type, w: bmp.width, h: bmp.height });
        }, close: async () => {} }) };
    };
  }, picker);
  const errors = await viewer(p);
  await p.setInputFiles('#file', FIXTURE);
  await p.waitForFunction(() => Number(document.body.dataset.loaded) > 0);
  return errors;
}

test('the bone at the foot wears the count, and pressing it asks: photo, export or print', async ({ page: p }) => {
  const errors = await withHouse(p);
  await wallet(p, 4);
  await p.evaluate(() => window.dispatchEvent(new Event('draft-bones-changed')));
  const foot = p.locator('#bone-foot');
  await expect(p.locator('#bone-count')).toHaveText('4');
  // Bottom centre of the stage.
  const [b, s] = await Promise.all([foot.boundingBox(), p.locator('#stage').boundingBox()]);
  expect(Math.abs(b.x + b.width / 2 - (s.x + s.width / 2))).toBeLessThan(2);
  expect(s.y + s.height - (b.y + b.height)).toBeLessThan(20);
  await foot.click();
  await expect(p.locator('#spend')).toBeVisible();
  await expect(p.locator('#spend-title')).toHaveText('YOU HAVE 4 BONES');
  await expect(p.locator('[data-spend]')).toHaveText(['TAKE PHOTO 1 bone', 'EXPORT 3D MODEL 1 bone', 'PRINT MODEL 1 bone']);
  await p.locator('[data-spend="export"]').click();
  await expect(p.locator('#spend')).toBeHidden();
  await expect(p.locator('#export')).toBeVisible();
  await foot.click();
  await expect(p.locator('#export')).toBeHidden();
  await p.locator('[data-spend="print"]').click();
  await expect(p.locator('#print')).toBeVisible();
  // The skin's art: ROUGH wears the blue house, as on the drafter.
  await p.goto('/viewer/index.html?painter=plain&theme=rough');
  await p.waitForSelector('body[data-ready="1"]');
  await expect(p.locator('#bone-art')).toHaveAttribute('src', '../assets/house-blue-off.png');
  expect(errors).toEqual([]);
});

test('TAKE PHOTO saves what is on screen at the size and file picked, for 1 bone', async ({ page: p }) => {
  const errors = await withHouse(p);
  await wallet(p, 2);
  await p.locator('#bone-foot').click();
  await p.locator('[data-spend="photo"]').click();
  await expect(p.locator('#photo')).toBeVisible();
  await p.locator('[data-photo-format="jpg"]').click();
  await p.locator('[data-photo-scale="2"]').click();
  const stage = await p.locator('#stage').boundingBox();
  await expect(p.locator('#photo-size-note')).toHaveText(`${Math.round(stage.width) * 2} x ${Math.round(stage.height) * 2} pixels`);
  await p.locator('#photo-go').click();
  await expect(p.locator('#photo-toll')).toHaveText(/^Saved .* 3D\.jpg/);
  const files = await p.evaluate(() => window.__files);
  expect(files.length).toBe(1);
  expect(files[0]).toMatchObject({ name: 'repro-movie-2storey-garage 3D.jpg', type: 'image/jpeg', w: Math.round(stage.width) * 2, h: Math.round(stage.height) * 2 });
  expect(await p.evaluate(() => DraftBoneWallet.read().balance)).toBe(1);
  await expect(p.locator('#bone-count')).toHaveText('1');
  // PNG and WEBP too.
  for (const f of ['png', 'webp']) {
    await p.locator(`[data-photo-format="${f}"]`).click();
    await p.locator('[data-photo-scale="1"]').click();
    await wallet(p, 1);
    await p.locator('#photo-go').click();
    await expect(p.locator('#photo-toll')).toHaveText(new RegExp(`3D\\.${f}`));
  }
  const types = await p.evaluate(() => window.__files.map(f => f.type));
  expect(types).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  // No bones: refused in words, nothing written.
  await wallet(p, 0);
  await p.locator('#photo-go').click();
  await expect(p.locator('#photo-toll')).toHaveText(/costs 1 bone and you have 0/);
  expect(await p.evaluate(() => window.__files.length)).toBe(3);
  expect(errors).toEqual([]);
});

test('a cancelled photo costs nothing', async ({ page: p }) => {
  await withHouse(p, 'cancel');
  await wallet(p, 3);
  await p.locator('#photo-open').click();
  await p.locator('#photo-go').click();
  await expect(p.locator('#photo-toll')).toHaveText(/cancelled, no bone taken/);
  expect(await p.evaluate(() => DraftBoneWallet.read().balance)).toBe(3);
});

test('the photo is the view on screen: the same picture the painter draws, with no buttons in it', async ({ page: p }) => {
  await withHouse(p);
  const r = await p.evaluate(() => {
    const st = document.getElementById('stage');
    const c = DraftViewerPhoto.draw(st.clientWidth, st.clientHeight);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let inked = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0xdf) + Math.abs(d[i + 1] - 0xe6) + Math.abs(d[i + 2] - 0xee) > 30) inked++;
    return { w: c.width, h: c.height, inked, stageW: st.clientWidth, stageH: st.clientHeight };
  });
  expect(r.w).toBe(r.stageW);
  expect(r.h).toBe(r.stageH);
  expect(r.inked).toBeGreaterThan(r.w * r.h * 0.03);
});
