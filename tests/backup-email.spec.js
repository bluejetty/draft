// SAVE BACKUP FILE TO EMAIL (Movie, 30 Oct).
//
// "when the SAVE a DRAFT file it asks them -SEND BACKUP TO EMAIL?" -- the
// popup says SAVE BACKUP FILE TO EMAIL -- "only offer the email save if they
// save locally", and "charge them 3 bones per email backup". The mail goes
// through the same worker as the invoice book; here the worker is stood in
// for by a route, so nothing leaves the test.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const WORKER = 'https://bluejetty-mail.bluejetty.workers.dev/**';
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [], notepad: 'BACKUP ME',
});
const bones = (page, n) => page.evaluate(n => localStorage.setItem('draft-bone-wallet',
  JSON.stringify({ balance: n, lastDripAt: Date.now(), createdAt: Date.now() })), n);
const balance = page => page.evaluate(() => window.DraftBoneWallet.read().balance);

async function openModel(page) {
  // SAVE AS goes to a stand-in picker, so the file is "saved locally".
  await page.addInitScript(() => {
    window.showSaveFilePicker = async opts => ({ kind: 'file', name: opts.suggestedName,
      createWritable: async () => ({ write: async () => {}, close: async () => {} }) });
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const sent = [];
const standInWorker = async (page, status = 200) => {
  sent.length = 0;
  await page.route(WORKER, async route => {
    sent.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status, contentType: 'application/json', body: '{"ok":true}' });
  });
};
const popup = page => page.locator('[data-backup-email]');

test('SAVE AS offers SAVE BACKUP FILE TO EMAIL; SEND mails the saved file and costs 3 bones', async ({ page }) => {
  await openModel(page);
  await standInWorker(page);
  await bones(page, 5);
  await expect(popup(page)).toHaveCount(0);
  await page.locator('#file-save-as').click();
  await page.locator('[data-save-as-go]').click();
  await expect(popup(page)).toBeVisible();
  await expect(popup(page).locator('#bk-title')).toHaveText('SAVE BACKUP FILE TO EMAIL');
  await expect(popup(page)).toContainText('It costs 3 bones (you have 5)');
  await popup(page).locator('[data-bk-to]').fill('kris@example.com');
  await popup(page).locator('[data-bk-send]').click();
  await expect(popup(page).locator('[data-bk-status]')).toHaveText('BACKUP FILE sent to kris@example.com.');
  expect(sent).toHaveLength(1);
  expect(sent[0].email).toBe('kris@example.com');
  expect(sent[0].app).toBe('bluejetty');
  expect(sent[0].filename).toMatch(/\.draft$/);
  const body = Buffer.from(sent[0].dataUrl.split(',')[1], 'base64').toString('utf8');
  expect(JSON.parse(body).notepad, 'the very file that was saved').toBe('BACKUP ME');
  expect(await balance(page), '3 bones spent').toBe(2);
  // The address is offered again next time.
  await popup(page).locator('[data-bk-skip]').click();
  await page.locator('#file-save-as').click();
  await page.locator('[data-save-as-go]').click();
  await expect(popup(page).locator('[data-bk-to]')).toHaveValue('kris@example.com');
});

test('no BACKUP FILE email without 3 bones, and a failed send costs nothing', async ({ page }) => {
  await openModel(page);
  await standInWorker(page, 500);
  await bones(page, 2);
  await page.locator('#file-save-as').click();
  await page.locator('[data-save-as-go]').click();
  await popup(page).locator('[data-bk-to]').fill('kris@example.com');
  await popup(page).locator('[data-bk-send]').click();
  await expect(popup(page).locator('[data-bk-status]')).toContainText('costs 3 bones and you have 2');
  expect(sent).toHaveLength(0);
  await bones(page, 4);
  await popup(page).locator('[data-bk-send]').click();
  await expect(popup(page).locator('[data-bk-status]')).toContainText('Could not send');
  expect(await balance(page), 'nothing spent on a failure').toBe(4);
});

test('a big file goes zipped, in numbered parts each under the limit', async ({ page }) => {
  await openModel(page);
  const parts = await page.evaluate(async () => {
    const B = window.DraftBackupEmail;
    // Incompressible: random bytes, a little over one part.
    const n = B.PART_BYTES + 1024 * 1024;
    const bytes = new Uint8Array(n);
    for (let at = 0; at < n; at += 65536) crypto.getRandomValues(bytes.subarray(at, Math.min(n, at + 65536)));
    const small = await B.piecesOf('small.draft', new Blob(['{"a":1}']));
    const big = await B.piecesOf('big.draft', new Blob([bytes]));
    return { small: small.map(p => p.filename), big: big.map(p => ({ name: p.filename, size: p.blob.size })),
      limit: B.PART_BYTES };
  });
  expect(parts.small).toEqual(['small.draft']);
  expect(parts.big.map(p => p.name)).toEqual(['big.draft.zip.001', 'big.draft.zip.002']);
  parts.big.forEach(p => expect(p.size).toBeLessThanOrEqual(parts.limit));
});

test('after LAYOUT\'s SAVE AS too, and after PRINT the saved PDF is picked to send', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await standInWorker(page);
  await bones(page, 6);
  await page.locator('#file-save-as').click();
  await Promise.all([page.waitForEvent('download'), page.locator('[data-lay-saveas-go]').click()]);
  await expect(popup(page)).toBeVisible();
  await popup(page).locator('[data-bk-skip]').click();
  // The print window's own question, asked after it closes.
  await page.evaluate(() => window.DraftBackupEmail.offerPicked({ what: 'PDF' }));
  await expect(popup(page)).toContainText('Saved your PDF on this computer?');
  await popup(page).locator('[data-bk-to]').fill('kris@example.com');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), popup(page).locator('[data-bk-send]').click()]);
  await chooser.setFiles({ name: 'sheets.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sheets') });
  await expect(popup(page).locator('[data-bk-status]')).toHaveText('BACKUP FILE sent to kris@example.com.');
  expect(sent.map(s => s.filename)).toEqual(['sheets.pdf']);
  expect(await balance(page)).toBe(3);
});

test('a browser sends at most 5 an hour', async ({ page }) => {
  await openModel(page);
  await standInWorker(page);
  await bones(page, 9);
  await page.evaluate(() => window.DraftBackupEmail.noteSent(5));
  await page.locator('#file-save-as').click();
  await page.locator('[data-save-as-go]').click();
  await popup(page).locator('[data-bk-to]').fill('kris@example.com');
  await popup(page).locator('[data-bk-send]').click();
  await expect(popup(page).locator('[data-bk-status]')).toContainText('has 0 left this hour');
  expect(sent).toHaveLength(0);
});
