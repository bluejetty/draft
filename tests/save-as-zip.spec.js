// SAVE AS ZIP (jb, 19 Nov 2026): "save a zip file that has the main file in
// the main directory and subfolders for all the hologram files etc.. logos
// title blocks anything added to it", "so user can save 1 zip file with
// everything in there"; 5 bones, refused at fewer. OPEN takes the zip back
// on a bare browser: the drawing, its underlay picture and its logo.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const HOUSE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'), 'utf8'));
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
// A 1x1 red PNG, as an uploaded logo is kept.
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const DRAWING = {
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 20,
  walls: [W('a', [0, 0], [10, 0]), W('b', [10, 0], [10, 8])],
  underlays: [{ id: 'ul-1', levelId: 3, kind: 'image', name: 'plan.png', x: 0, z: 0, widthFt: 20, heightFt: 10 }],
  holograms: [
    { id: 'hologram-1', name: 'existing-house', x: 0, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0, source: HOUSE },
    // A second copy of the same file is still one file in the zip.
    { id: 'hologram-2', name: 'existing-house', x: 40, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0, source: HOUSE },
  ],
  layout: { titleblock: 'LSQUARE01', titleblockMark: 'logo:acme' },
  notepad: 'CALL THE ENGINEER',
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [],
};
const STANDARDS = {
  format: 'draft-profile-package', version: 1, kind: 'standards', name: 'ACME-OFFICE',
  createdAt: '2026-11-19T00:00:00.000Z',
  content: { model: { companyLogos: [{ id: 'acme', label: 'ACME HOMES', dataUrl: LOGO }] } },
};
const bones = (page, n) => page.evaluate(n => localStorage.setItem('draft-bone-wallet',
  JSON.stringify({ balance: n, lastDripAt: Date.now(), createdAt: Date.now() })), n);
const balance = page => page.evaluate(() => window.DraftBoneWallet.read().balance);

async function openModel(page) {
  await page.addInitScript(() => {
    try { delete window.showSaveFilePicker; } catch { window.showSaveFilePicker = undefined; }
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, std }) => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 20;
    const g = c.getContext('2d'); g.fillStyle = '#d23'; g.fillRect(0, 0, 40, 20);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await window.SharedFileStore.saveNamedFile(new File([blob], 'ul-1', { type: 'image/png' }), 'underlays');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
    localStorage.setItem('draft-active-package:standards', JSON.stringify(std));
  }, { bucket: BUCKET, f: DRAWING, std: STANDARDS });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const unzip = (page, bytes) => page.evaluate(async b64 => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i);
  const files = await window.DraftZipBundle.readZip(u);
  return Object.fromEntries(files.map(f => [f.name, new TextDecoder().decode(f.bytes)]));
}, bytes.toString('base64'));

test('SAVE AS ZIP writes the .draft on top and folders of holograms, underlays, logos and notes, for 5 bones', async ({ page }) => {
  await openModel(page);
  await bones(page, 7);
  await page.locator('#file-save-as').click();
  await expect(page.locator('[data-save-zip-toll]')).toContainText('Costs 5 bones (you have 7)');
  await page.locator('#save-as-name').fill('smith house.draft');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-save-as-zip]').click(),
  ]);
  expect(download.suggestedFilename()).toBe('smith house.zip');
  const bytes = fs.readFileSync(await download.path());
  expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
  const files = await unzip(page, bytes);
  expect(Object.keys(files).sort()).toEqual([
    'holograms/existing-house.draft',
    'logos/ACME HOMES.png',
    'logos/ACME-OFFICE.draft.standards',
    'notes/smith house NOTES.txt',
    'smith house.draft',
    'underlays/plan.png',
  ]);
  const top = JSON.parse(files['smith house.draft']);
  expect(top.walls.length).toBe(2);
  expect(Object.keys(top.underlayFiles), 'the top .draft opens on its own too').toEqual(['ul-1']);
  expect(JSON.parse(files['holograms/existing-house.draft']).walls.length).toBe(HOUSE.walls.length);
  expect(files['notes/smith house NOTES.txt']).toContain('CALL THE ENGINEER');
  expect(await balance(page), 'five bones once the zip is written').toBe(2);
  await expect(page.locator('#bone-balance')).toHaveText('2');

  // A BARE BROWSER: the picture and the logo gone, then OPEN the zip.
  await page.evaluate(() => {
    localStorage.removeItem('draft-active-package:standards');
    return window.SharedFileStore.removeNamedFile('ul-1', 'underlays');
  });
  await page.locator('#file-input').setInputFiles(
    { name: 'smith house.zip', mimeType: 'application/zip', buffer: bytes });
  await expect.poll(() => page.evaluate(async () =>
    !!(await window.SharedFileStore.loadNamedFile('ul-1', 'underlays'))), { timeout: 5000 }).toBe(true);
  expect(await page.evaluate(() => drawing.underlays.map(u => u.id))).toEqual(['ul-1']);
  expect(await page.evaluate(() => drawing.holograms.length)).toBe(2);
  expect(await page.evaluate(() => drawing.underlayFiles)).toBeUndefined();
  const logos = await page.evaluate(() => JSON.parse(localStorage.getItem('draft-active-package:standards'))
    .content.model.companyLogos.map(l => [l.id, l.dataUrl.length]));
  expect(logos).toEqual([['acme', LOGO.length]]);
});

test('SAVE AS ZIP at fewer than 5 bones is refused in words and writes nothing', async ({ page }) => {
  await openModel(page);
  await bones(page, 4);
  await page.locator('#file-save-as').click();
  await expect(page.locator('[data-save-zip-toll]')).toContainText('SAVE AS ZIP costs 5 bones and you have 4');
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.locator('[data-save-as-zip]').click();
  await expect(page.locator('#save-as'), 'the card stays up').toBeVisible();
  await page.waitForTimeout(300);
  expect(downloads).toBe(0);
  expect(await balance(page)).toBe(4);
});

test('a zip squeezed by another program (stored or deflated) reads back the same', async ({ page }) => {
  await openModel(page);
  const back = await page.evaluate(async () => {
    const Z = window.DraftZipBundle;
    const long = 'WALL '.repeat(500);
    const blob = await Z.writeZip([{ name: 'a.draft', data: long }, { name: 'sub/', data: '' },
      { name: 'sub/b.txt', data: 'hi' }]);
    const files = await Z.readZip(blob);
    return files.map(f => [f.name, new TextDecoder().decode(f.bytes).length]);
  });
  expect(back).toEqual([['a.draft', 2500], ['sub/b.txt', 2]]);
});
