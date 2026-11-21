// SAVE DETAILS FILE — the details library a house holds, saved on its own.
//
// jb, 21 Nov 2026: "when i'm in a house plan can i save the DETAIL.draft
// file seperately (and allow rename and send to email address)". The plan he
// passed ("looks good Proceed Sir"): a SAVE DETAILS FILE press on the house's
// DETAILS panel, a name box, the computer or an email through the house's
// BACKUP FILE mail, at the house's prices -- 1 bone to the computer (refused
// short), 1 bone for the email -- paid once it has gone.
//
// WHAT IS CHECKED, each where it would quietly go wrong:
//
//   1. TO THE COMPUTER writes the LIBRARY (not the house) under the typed
//      name, with the new name inside it too, and costs 1 bone. The house's
//      link and this browser's library keep their old name.
//   2. SHORT OF BONES it is refused in words, and no picker opens.
//   3. EMAIL IT posts the library to the mail worker, named as typed, and
//      costs 1 bone; a refused send costs nothing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const LIBS = 'details-libraries';
const WORKER = 'https://bluejetty-mail.bluejetty.workers.dev/**';
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
  { id: 1, name: 'FOUNDATION', elev: -10 }];
const blank = (extra = {}) => ({
  version: 1, planTurn: 0, levels: LEVELS, activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
const library = () => blank({
  standalone: 'details', detailsLibrary: 'DETAILS-LIBRARY',
  boneyardShelves: [
    { id: 1, name: 'TYP. STRIP FOOTING', detail: { category: 'FOUNDATION', kind: 'typ', frameW: 4, frameH: 4, scale: 1 } },
    { id: 2, name: 'TYP. EAVE', detail: { category: 'FRAMING', kind: 'typ', frameW: 3, frameH: 2, scale: 1.5 } },
  ],
  nextBoneyardShelfId: 3, activeBoneyardShelfId: 1,
  lines: [{ id: 'l1', levelId: -1, start: { x: -1, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 }, layer: 'A-DETL' }],
});
const house = () => blank({
  lines: [{ id: 'h1', levelId: 3, view: 'plan', start: { x: 0, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 }, layer: 'draft' }],
});
const bones = (page, n) => page.evaluate(n => localStorage.setItem('draft-bone-wallet',
  JSON.stringify({ balance: n, lastDripAt: Date.now(), createdAt: Date.now() })), n);
const balance = page => page.evaluate(() => window.DraftBoneWallet.read().balance);

async function openHouse(page) {
  // A STAND-IN PICKER that keeps what was written, so the file can be read.
  await page.addInitScript(() => {
    window.__written = [];
    window.showSaveFilePicker = async opts => ({ kind: 'file', name: opts.suggestedName,
      createWritable: async () => ({
        write: async data => { window.__written.push({ name: opts.suggestedName, text: String(data) }); },
        close: async () => {} }) });
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, libs, drawing, lib }) => {
    const S = window.SharedFileStore;
    await S.saveNamedFile(new File([JSON.stringify(lib)], 'DETAILS-LIBRARY.draft', { type: 'application/json' }), libs);
    await S.saveSharedFile(new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, libs: LIBS, drawing: house(), lib: library() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('#details-tab').click();
  await page.locator('[data-details-use="DETAILS-LIBRARY.draft"]').click();
  await expect(page.locator('[data-details-linked]')).toHaveAttribute('data-details-linked', 'DETAILS-LIBRARY.draft');
}
const say = page => page.locator('[data-details-file-say]');

test('SAVE DETAILS FILE to the computer writes the library under the new name for 1 bone', async ({ page }) => {
  await openHouse(page);
  await bones(page, 3);
  await page.locator('[data-details-file]').click();
  const name = page.locator('[data-details-file-name]');
  await expect(name, 'the box starts on the library\'s own name').toHaveValue('DETAILS-LIBRARY');
  await expect(page.locator('[data-details-file-toll]')).toHaveText('Computer 1 bone, email 1 bone (you have 3).');
  await name.fill('SMITH JOB DETAILS');
  await page.locator('[data-details-file-save]').click();
  await expect(say(page)).toHaveText('SMITH JOB DETAILS.draft saved on this computer.');
  const written = await page.evaluate(() => window.__written);
  expect(written).toHaveLength(1);
  expect(written[0].name).toBe('SMITH JOB DETAILS.draft');
  const file = JSON.parse(written[0].text);
  // THE LIBRARY, not the house: its details, its standalone mark, its new name.
  expect(file.standalone).toBe('details');
  expect(file.detailsLibrary).toBe('SMITH JOB DETAILS');
  expect(file.boneyardShelves.map(s => s.name)).toEqual(['TYP. STRIP FOOTING', 'TYP. EAVE']);
  expect(file.lines.map(l => l.id)).toEqual(['l1']);
  expect(await balance(page), 'one bone, once written').toBe(2);
  await expect(page.locator('[data-details-file-toll]')).toContainText('(you have 2)');
  // THE HOUSE'S LINK is untouched by a rename of the copy.
  await expect(page.locator('[data-details-linked]')).toHaveAttribute('data-details-linked', 'DETAILS-LIBRARY.draft');
});

test('short of a bone, SAVE DETAILS FILE is refused in words and nothing is written', async ({ page }) => {
  await openHouse(page);
  await bones(page, 0);
  await page.locator('[data-details-file]').click();
  await page.locator('[data-details-file-save]').click();
  await expect(say(page)).toContainText('costs 1 bone and you have 0');
  await expect(say(page)).toHaveAttribute('data-kind', 'error');
  expect(await page.evaluate(() => window.__written)).toHaveLength(0);
  expect(await balance(page)).toBe(0);
});

test('EMAIL IT sends the library named as typed for 1 bone; a failed send costs nothing', async ({ page }) => {
  await openHouse(page);
  await bones(page, 3);
  const sent = [];
  let status = 500;
  await page.route(WORKER, async route => {
    sent.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.locator('[data-details-file]').click();
  await page.locator('[data-details-file-name]').fill('DECK DETAILS');
  await page.locator('[data-details-file-to]').fill('not-an-address');
  await page.locator('[data-details-file-email]').click();
  await expect(say(page)).toHaveText('Enter a valid email address.');
  await page.locator('[data-details-file-to]').fill('drafter@example.com');
  // THE MAIL SERVER REFUSES: no bone.
  await page.locator('[data-details-file-email]').click();
  await expect(say(page)).toContainText('Could not send');
  expect(await balance(page)).toBe(3);
  status = 200;
  sent.length = 0;
  await page.locator('[data-details-file-email]').click();
  await expect(say(page)).toHaveText('DECK DETAILS.draft sent to drafter@example.com.');
  expect(sent).toHaveLength(1);
  expect(sent[0].app).toBe('roughdrafter');
  expect(sent[0].email).toBe('drafter@example.com');
  expect(sent[0].filename).toBe('DECK DETAILS.draft');
  const body = JSON.parse(Buffer.from(sent[0].dataUrl.split(',')[1], 'base64').toString('utf8'));
  expect(body.standalone).toBe('details');
  expect(body.detailsLibrary).toBe('DECK DETAILS');
  expect(await balance(page), 'one bone, once sent').toBe(2);
});
