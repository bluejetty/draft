// A SAVE AS TO THIS COMPUTER COSTS A BONE (jb, 11 Nov 2026: "make a save 1
// bone and make the email save an additional bone"), and jb ruled the
// empty wallet is REFUSED: the card says so, nothing is written, and the
// plain SAVE to this browser stays free. The toll is taken once the file is
// on the disk, so a cancelled picker costs nothing. Both pages' cards:
// MODEL (model/17-boot-save.js) and LAYOUT (LAYOUT.html).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const drawing = () => ({
  version: 1, levels: [{ id: 'main', name: 'MAIN', elevation: 0 }],
  walls: [{ id: 'w1', level: 'main', a: { x: 0, z: 0 }, b: { x: 20, z: 0 }, kind: 'exterior' }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [], notepad: 'TOLL ME',
});
const bones = (page, n) => page.evaluate(n => localStorage.setItem('draft-bone-wallet',
  JSON.stringify({ balance: n, lastDripAt: Date.now(), createdAt: Date.now() })), n);
const balance = page => page.evaluate(() => window.DraftBoneWallet.read().balance);

const seed = async page => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
};

async function openModel(page, { picker = 'save' } = {}) {
  await page.addInitScript(mode => {
    window.__saved = 0;
    window.showSaveFilePicker = async opts => {
      if (mode === 'cancel') throw new DOMException('cancelled', 'AbortError');
      return { kind: 'file', name: opts.suggestedName,
        createWritable: async () => ({ write: async () => { window.__saved += 1; }, close: async () => {} }) };
    };
  }, picker);
  await seed(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const card = page => page.locator('#save-as');
const toll = page => page.locator('[data-save-as-toll]');

test('MODEL: SAVE AS names its price, takes 1 bone once the file is written, and the email asks 1 more', async ({ page }) => {
  await openModel(page);
  await bones(page, 5);
  await page.locator('#file-save-as').click();
  await expect(toll(page)).toHaveText('Costs 1 bone (you have 5).');
  await page.locator('[data-save-as-go]').click();
  await expect(card(page)).toBeHidden();
  // The email offer comes up only once the file is written and paid for.
  await expect(page.locator('[data-backup-email]')).toContainText('It costs 1 bone more (you have 4)');
  expect(await page.evaluate(() => window.__saved), 'the file went to the disk').toBe(1);
  expect(await balance(page), 'one bone for the SAVE AS').toBe(4);
  await expect(page.locator('#bone-balance')).toHaveText('4');
});

test('MODEL: at 0 bones SAVE AS is refused in words, nothing is written, and the plain SAVE still works', async ({ page }) => {
  await openModel(page);
  await bones(page, 0);
  await page.locator('#file-save-as').click();
  await expect(toll(page)).toContainText('SAVE AS costs 1 bone and you have 0');
  await expect(toll(page)).toContainText('SAVE (to this browser) is still free');
  await page.locator('[data-save-as-go]').click();
  await expect(card(page), 'the card stays up').toBeVisible();
  expect(await page.evaluate(() => window.__saved), 'nothing written').toBe(0);
  await expect(page.locator('[data-backup-email]')).toHaveCount(0);
  await page.locator('[data-save-as-cancel]').click();
  // The plain SAVE (to this browser) costs nothing and goes through.
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED');
  expect(await balance(page)).toBe(0);
});

test('MODEL: a cancelled picker costs nothing', async ({ page }) => {
  await openModel(page, { picker: 'cancel' });
  await bones(page, 2);
  await page.locator('#file-save-as').click();
  await page.locator('[data-save-as-go]').click();
  await expect(card(page)).toBeVisible();
  expect(await balance(page)).toBe(2);
});

test('LAYOUT: SAVE AS costs 1 bone and is refused at 0', async ({ page }) => {
  await seed(page);
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await bones(page, 0);
  await page.locator('#file-save-as').click();
  await expect(page.locator('[data-lay-saveas-toll]')).toContainText('SAVE AS costs 1 bone and you have 0');
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.locator('[data-lay-saveas-go]').click();
  await expect(page.locator('[data-lay-saveas]')).toBeVisible();
  expect(downloads).toBe(0);
  await page.locator('[data-lay-saveas-cancel]').click();
  await bones(page, 3);
  await page.locator('#file-save-as').click();
  await expect(page.locator('[data-lay-saveas-toll]')).toHaveText('Costs 1 bone (you have 3).');
  await Promise.all([page.waitForEvent('download'), page.locator('[data-lay-saveas-go]').click()]);
  expect(await balance(page)).toBe(2);
  await expect(page.locator('[data-backup-email]')).toContainText('It costs 1 bone more (you have 2)');
});
