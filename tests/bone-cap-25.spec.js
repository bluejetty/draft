// THE 25-BONE LINE (jb, 11 Nov 2026: "how about instead of unlimited an area
// with same drip rate but max token drip is 25" -- "go into the notepad and
// type 25BONES on the first line, as long as it's typed in there first line
// they get 25 BONES max"). The arithmetic is proved in
// proto/bone-wallet-harness.js; these check the pad on MODEL.html: the line
// typed, the bone's word, the strip's word, a file carrying the line, and
// the line taken off again. The helpers' fat test wallet is opted out,
// because the economy is the subject.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const HOUR = 60 * 60 * 1000;
const empty = (extra = {}) => ({
  version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, { balance = 10, file = empty() } = {}) {
  await h.openModel(page, { webgl: false, boneWallet: false });
  await page.evaluate(async ({ bucket, f, b }) => {
    ['draft.notepad', 'draft.notepad.pages'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('draft-bone-wallet',
      JSON.stringify({ balance: b, lastDripAt: Date.now(), createdAt: Date.now() }));
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file, b: balance });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function openPad(page) {
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await page.locator('[data-pad-tab="notes"]').click();
  await expect(page.locator('[data-notes-text]')).toBeVisible();
}
const capNow = page => page.evaluate(() => window.DraftBoneWallet.cap());
const strip = page => page.evaluate(() => stripNotice);

test('25BONES on the first line of the pad lifts the ceiling to 25; the bone and the strip say so', async ({ page }) => {
  await open(page, { balance: 10 });
  await expect(page.locator('#bone')).toHaveAttribute('title', /the free wallet is full/);
  expect(await capNow(page)).toBe(10);
  await openPad(page);
  const pad = page.locator('[data-notes-text]');
  await pad.fill('25BONES\nw 86.86\nn 106.38');
  expect(await capNow(page)).toBe(25);
  expect(await strip(page)).toBe('25BONES on the pad: the wallet fills to 25 bones.');
  // A full-at-10 wallet is below the ceiling now: the bone counts down again.
  await expect(page.locator('#bone')).toHaveAttribute('title', /next free bone in/);
  // The same drip rate, up to 25 -- a hundred hours fills it and no more.
  const after = await page.evaluate(HOUR => window.DraftBoneWallet.read(Date.now() + 100 * HOUR), HOUR);
  expect(after.balance).toBe(25);
  expect(after.nextDripMs).toBe(null);
  // The line goes: 10 again, the 25 bones kept, no drip coming.
  await pad.fill('w 86.86\nn 106.38');
  expect(await capNow(page)).toBe(10);
  expect(await strip(page)).toBe('25BONES off the pad: the wallet fills to 10 bones again.');
  const kept = await page.evaluate(HOUR => window.DraftBoneWallet.read(Date.now() + 200 * HOUR), HOUR);
  expect(kept.balance).toBe(25);
  expect(kept.nextDripMs).toBe(null);
  await expect(page.locator('#bone')).toHaveAttribute('title', /25 bones .* full/);
});

test('the line counts only as the FIRST line, and only on page 1', async ({ page }) => {
  await open(page);
  await openPad(page);
  const pad = page.locator('[data-notes-text]');
  await pad.fill('site notes\n25BONES');
  expect(await capNow(page)).toBe(10);
  await pad.fill('  25bones  \nsite notes');
  expect(await capNow(page)).toBe(25);
  await page.locator('[data-notes-page="2"]').click();
  await pad.fill('25BONES');
  expect(await capNow(page)).toBe(25);          // page 1 still holds the line
  await page.locator('[data-notes-page="1"]').click();
  await pad.fill('');
  expect(await capNow(page)).toBe(10);          // page 2's line is just a note
});

test('a file opened with the line on its pad brings the 25 ceiling with it', async ({ page }) => {
  await open(page, { balance: 3, file: empty({ notepad: '25BONES\nduplex condo site' }) });
  expect(await capNow(page)).toBe(25);
  await expect(page.locator('#bone')).toHaveAttribute('title', /next free bone in/);
  const after = await page.evaluate(HOUR => window.DraftBoneWallet.read(Date.now() + 100 * HOUR), HOUR);
  expect(after.balance).toBe(25);
});
