// THE UNDERLAY PICTURES RIDE IN THE .draft (Movie, 25 Oct: "can it save the
// jpg within the file so when the user reopens the jpg is already loaded",
// and, asked, "Always pack them in"). SAVE AS's file carries each picture;
// OPEN on a browser that never had it puts it back in the store.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const DRAWING = {
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 20,
  walls: [W('a', [0, 0], [10, 0]), W('b', [10, 0], [10, 8])],
  underlays: [{ id: 'ul-1', levelId: 3, kind: 'image', name: 'plan.png', x: 0, z: 0, widthFt: 20, heightFt: 10 }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [],
};

test('SAVE AS packs the picture under the plan into the file; OPEN on a bare browser puts it back', async ({ page }) => {
  await page.addInitScript(() => {
    try { delete window.showSaveFilePicker; } catch { window.showSaveFilePicker = undefined; }
  });
  await h.openModel(page, { webgl: false });
  // The drawing, and its picture in this browser's store, as BRING IN leaves them.
  const png = await page.evaluate(async ({ bucket, f }) => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 20;
    const g = c.getContext('2d'); g.fillStyle = '#d23'; g.fillRect(0, 0, 40, 20);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await window.SharedFileStore.saveNamedFile(new File([blob], 'ul-1', { type: 'image/png' }), 'underlays');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
    return c.toDataURL('image/png');
  }, { bucket: BUCKET, f: DRAWING });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  await page.locator('#file-save-as').click();
  await page.locator('#save-as-name').fill('with-picture.draft');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-save-as-go]').click(),
  ]);
  const onDisk = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(Object.keys(onDisk.underlayFiles || {})).toEqual(['ul-1']);
  expect(onDisk.underlayFiles['ul-1'].dataUrl).toBe(png);
  // THE EVERYDAY SAVE STAYS ITS SIZE: the store's copy carries no pictures.
  expect((await h.savedDrawing(page)).underlayFiles).toBeUndefined();

  // A bare browser: the picture gone from the store.
  await page.evaluate(() => window.SharedFileStore.removeNamedFile('ul-1', 'underlays'));
  expect(await page.evaluate(async () => !!(await window.SharedFileStore.loadNamedFile('ul-1', 'underlays')))).toBe(false);
  const file = path.join(test.info().outputPath('opened'), 'with-picture.draft');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(onDisk));
  await page.locator('#file-input').setInputFiles(file);
  await expect.poll(() => page.evaluate(async () => {
    const f = await window.SharedFileStore.loadNamedFile('ul-1', 'underlays');
    if (!f) return null;
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  }), { timeout: 5000 }).toBe(png);
  // And the drawing on the page does not carry the packed copy along with it.
  expect(await page.evaluate(() => drawing.underlayFiles)).toBeUndefined();
  expect(await page.evaluate(() => drawing.underlays.map(u => u.id))).toEqual(['ul-1']);
});

test('a drawing with no underlay pictures to hand saves as it always did', async ({ page }) => {
  await page.addInitScript(() => {
    try { delete window.showSaveFilePicker; } catch { window.showSaveFilePicker = undefined; }
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket),
  // The underlay is named but its picture was never in this browser.
  { bucket: BUCKET, f: DRAWING });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('#file-save-as').click();
  await page.locator('#save-as-name').fill('plain.draft');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-save-as-go]').click(),
  ]);
  expect(fs.readFileSync(await download.path(), 'utf8')).toBe(JSON.stringify(await h.savedDrawing(page)));
});
