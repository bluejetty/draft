// SAVE ONLINE AND OPEN ONLINE IN MODEL (jb, 28 Nov 2026) -- model/23-save-online.js.
//
// "can i put a code into my main MODEL program so that i can save my file
// directly ... accessed by the viewer / or also i can open and edit it with
// the model html part". 3DBONES on the NOTES pad shows the two buttons; the
// password is checked by the projects Worker, which is never reached from
// here: a stand-in answers its address with the Worker's rules (the real
// code runs in proto/projects-worker-harness.js).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const API = 'https://roughdrafter-projects.bluejetty.workers.dev';
const PASSWORD = 'jb-long-password';
const BUCKET = 'model-drawing';

const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const drawing = walls => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls,
  fenestrations: [], lines: [], fixtures: [], dimensions: [], floors: [], roofs: [], outlines: [],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
const BOX = [W('n', [0, 0], [20, 0]), W('e', [20, 0], [20, 10]), W('s', [20, 10], [0, 10]), W('w', [0, 10], [0, 0])];

async function standInWorker(page, start = {}, { down = false } = {}) {
  const bucket = new Map(Object.entries(start));
  const calls = [];
  await page.route(`${API}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (down) return route.abort('connectionrefused');
    const auth = (await req.headerValue('authorization')) || '';
    const okPw = auth === `Bearer ${PASSWORD}`;
    calls.push({ method: req.method(), path: url.pathname, auth: okPw });
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-File-Name' };
    const json = (status, body) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'Access-Control-Allow-Headers': 'Authorization, X-File-Name, X-Saved-From', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE' } });
    const m = /^\/p\/([a-z0-9-]+)$/.exec(url.pathname);
    if (m && req.method() === 'GET') {
      const it = bucket.get(m[1]);
      if (!it) return json(404, { error: `No project called ${m[1]}.` });
      return route.fulfill({ status: 200, headers: { ...cors, 'X-File-Name': it.fileName }, contentType: 'application/json', body: it.body });
    }
    if (!okPw) return json(401, { error: 'Wrong password.' });
    if (url.pathname === '/check') return json(200, { ok: true });
    if (url.pathname === '/list') {
      return json(200, { projects: [...bucket.entries()].map(([name, it]) => ({ name, size: it.body.length, uploadedAt: new Date().toISOString(), fileName: it.fileName, files: 0 })) });
    }
    if (m && req.method() === 'PUT') {
      bucket.set(m[1], { body: req.postDataBuffer(), fileName: (await req.headerValue('x-file-name')) || `${m[1]}.draft`, from: await req.headerValue('x-saved-from') });
      return json(200, { ok: true, name: m[1] });
    }
    return json(404, {});
  });
  return { bucket, calls };
}

// The code goes on the real pad, typed, as jb would.
async function openWithPad(page, pad, walls = BOX, { password = null } = {}) {
  await h.openEditor(page, { drawing: drawing(walls), bucket: BUCKET, url: '/MODEL.html', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  if (password) await page.evaluate(pw => localStorage.setItem('draft-viewer-projects-key', pw), password);
  if (pad == null) return;
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await page.locator('[data-pad-tab="notes"]').click();
  await page.locator('[data-notes-text]').fill(pad);
  await tab.click();
}

test('an ordinary drafter sees no ONLINE button, and nothing is sent', async ({ page }) => {
  const { calls } = await standInWorker(page);
  await openWithPad(page, null);
  await expect(page.locator('#file-save-as')).toBeVisible();
  await expect(page.locator('#file-online')).toBeHidden();
  expect(calls).toEqual([]);
});

test('3DBONES on the pad shows the ONLINE button; taking it off hides it', async ({ page }) => {
  await standInWorker(page);
  await openWithPad(page, 'call the framer\n3DBONES');
  await expect(page.locator('#file-online')).toBeVisible();
  await page.locator('#notes-tab').click();
  await page.locator('[data-notes-text]').fill('call the framer');
  await expect(page.locator('#file-online')).toBeHidden();
});

test('SAVE ONLINE asks the password once, then sends the drawing under its name and gives the customer link', async ({ page }) => {
  const { bucket, calls } = await standInWorker(page);
  await openWithPad(page, '3DBONES');
  await page.locator('#file-online').click();
  const card = page.locator('#save-online');
  await expect(card.locator('[data-online-lock]')).toBeVisible();
  await card.locator('[data-online-password]').fill('guess');
  await card.locator('[data-online-unlock]').click();
  await expect(card.locator('[data-online-said]')).toHaveText('That is not the password.');
  await card.locator('[data-online-password]').fill(PASSWORD);
  await card.locator('[data-online-unlock]').click();
  await expect(card.locator('[data-online-save]')).toBeVisible();
  await card.locator('[data-online-name]').fill('Bad Name');
  await expect(card.locator('[data-online-save-go]')).toBeDisabled();
  await card.locator('[data-online-name]').fill('TimberHouse');
  await expect(card.locator('[data-online-link-preview]')).toContainText('/viewer/timberhouse');
  await card.locator('[data-online-save-go]').click();
  await page.waitForFunction(() => document.body.dataset.savedOnline === 'timberhouse');
  await expect(card.locator('[data-online-done]')).toContainText('/viewer/timberhouse');
  const sent = JSON.parse(bucket.get('timberhouse').body.toString());
  expect(sent.walls.length).toBe(4);
  expect(bucket.get('timberhouse').fileName).toBe('TIMBERHOUSE.draft');
  expect(bucket.get('timberhouse').from).toBe('model');
  // Saved here too: SAVE says so.
  await expect(page.locator('#save')).toHaveText('SAVED');
  // The password is remembered on this computer: the next press goes straight to the name.
  expect(await page.evaluate(() => localStorage.getItem('draft-viewer-projects-key'))).toBe(PASSWORD);
  await card.locator('[data-online-save] [data-online-cancel]').click();
  await page.locator('#file-online').click();
  await expect(card.locator('[data-online-save]')).toBeVisible();
  await expect(card.locator('[data-online-name]')).toHaveValue('timberhouse');
  await card.locator('[data-online-save-go]').click();
  await expect.poll(() => calls.filter(c => c.method === 'PUT').length).toBe(2);
});

test('saving over a different house already online asks twice', async ({ page }) => {
  const { bucket } = await standInWorker(page, { 'smith-house': { body: Buffer.from('{"version":1}'), fileName: 'SMITH.draft' } });
  await openWithPad(page, '3DBONES', BOX, { password: PASSWORD });
  await page.locator('#file-online').click();
  const card = page.locator('#save-online');
  await card.locator('[data-online-name]').fill('smith-house');
  await page.waitForTimeout(300); // the quiet list fetch
  await card.locator('[data-online-save-go]').click();
  await expect(card.locator('[data-online-save-go]')).toHaveText('REPLACE SMITH-HOUSE?');
  expect(bucket.get('smith-house').body.toString()).toBe('{"version":1}');
  await card.locator('[data-online-save-go]').click();
  await page.waitForFunction(() => document.body.dataset.savedOnline === 'smith-house');
  expect(JSON.parse(bucket.get('smith-house').body.toString()).walls.length).toBe(4);
});

test('OPEN ONLINE lists the projects and opens one to keep editing', async ({ page }) => {
  const three = JSON.stringify(drawing(BOX.slice(0, 3)));
  await standInWorker(page, { 'jones-garage': { body: Buffer.from(three), fileName: 'JONES-GARAGE.draft' } });
  await openWithPad(page, '3DBONES', BOX, { password: PASSWORD });
  await page.locator('#file-online').click();
  const card = page.locator('#save-online');
  await card.locator('[data-online-mode="open"]').click();
  const row = card.locator('tr[data-project="jones-garage"]');
  await expect(row).toBeVisible();
  await row.locator('button', { hasText: 'OPEN' }).click();
  // Typing the code was an edit: the usual unsaved-edits question comes first.
  await expect(page.locator('#file-guard')).toBeVisible();
  await page.locator('[data-guard-discard]').click();
  await page.waitForFunction(() => document.body.dataset.openedOnline === 'jones-garage');
  await expect(page.locator('#readout')).toContainText('walls 3/3');
  await expect(card).toBeHidden();
});

test('before the Cloudflare setup it fails politely, in words', async ({ page }) => {
  await standInWorker(page, {}, { down: true });
  await openWithPad(page, '3DBONES');
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.locator('#file-online').click();
  const card = page.locator('#save-online');
  await card.locator('[data-online-password]').fill(PASSWORD);
  await card.locator('[data-online-unlock]').click();
  await expect(card.locator('[data-online-said]')).toContainText('Cloudflare setup');
  expect(errors).toEqual([]);
});
