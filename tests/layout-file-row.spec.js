// THE FILE ROW ON LAYOUT (Movie, 26 Oct: "the OPEN / NEW / SAVE AS etc
// buttons top right don't seem to work in the construction layout area, and
// i think after i arranged the layouts last time i saved them and they might
// not have been saved").
//
// The sheets live in the drawing (its `layout`), written on every change.
// SAVE finishes that write; SAVE AS downloads the drawing with its sheets
// (and its underlay pictures packed in, as MODEL's SAVE AS writes them);
// OPEN reads a drawing file in, sheets and all, after the same save-or-
// discard question NEW asks.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const HOUSE = (name = 'HOUSE A') => ({
  version: 1, board: 'drafting', planTurn: 0, buildType: 'bungalow',
  projectInfo: { name },
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [
    { id: 'w1', levelId: 3, view: 'plan', start: { x: 0, z: 0 }, end: { x: 20, z: 0 }, baseHeight: 0, topHeight: 8, thickness: 0.5 },
    { id: 'w2', levelId: 3, view: 'plan', start: { x: 20, z: 0 }, end: { x: 20, z: 20 }, baseHeight: 0, topHeight: 8, thickness: 0.5 },
  ],
  underlays: [{ id: 'u1', name: 'survey.png', levelId: 8, x: 0, z: 0, scale: 1 }],
  layout: { auto: true },
});
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

async function openLayout(page, drawing = HOUSE()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, png }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
    const blob = await (await fetch(png)).blob();
    await window.SharedFileStore.saveNamedFile(new File([blob], 'u1', { type: 'image/png' }), 'underlays');
  }, { bucket: BUCKET, f: drawing, png: PNG });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

test('OPEN, SAVE, SAVE AS and the extension are live on LAYOUT', async ({ page }) => {
  await openLayout(page);
  for (const id of ['#file-new', '#file-open', '#save', '#file-save-as', '#file-ext']) {
    await expect(page.locator(id)).toBeEnabled();
  }
});

test('SAVE AS downloads the drawing with its sheets and pictures, under the name typed', async ({ page }) => {
  await openLayout(page);
  await page.locator('#file-save-as').click();
  const card = page.locator('[data-lay-saveas]');
  await expect(card).toBeVisible();
  await expect(page.locator('[data-lay-saveas-name]')).toHaveValue(/\.draft$/);
  await page.locator('[data-lay-saveas-name]').fill('my house');
  const download = page.waitForEvent('download');
  await page.locator('[data-lay-saveas-go]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('my house.draft');
  const copy = JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
  expect(copy.walls).toHaveLength(2);
  // THE SHEETS GO WITH IT: the layout the page dealt is in the copy.
  expect((copy.layout?.viewports || []).length).toBeGreaterThan(0);
  expect(copy.layout).toEqual((await stored(page)).layout);
  expect(copy.underlayFiles?.u1?.dataUrl).toMatch(/^data:image\/png/);
  await expect(card).toBeHidden();
});

test('SAVE AS Cancel downloads nothing', async ({ page }) => {
  await openLayout(page);
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.locator('#file-save-as').click();
  await page.locator('[data-lay-saveas-cancel]').click();
  await expect(page.locator('[data-lay-saveas]')).toBeHidden();
  await page.waitForTimeout(300);
  expect(downloads).toBe(0);
});

test('SAVE finishes the sheets\' write and says SAVED', async ({ page }) => {
  await openLayout(page);
  await page.locator('#save').click();
  await page.waitForFunction(() => document.body.dataset.layoutSaveDirty === '0');
  expect((await stored(page)).layout?.viewports?.length).toBeGreaterThan(0);
});

test('OPEN asks first, then reads the file in -- its sheets and its pictures', async ({ page }) => {
  await openLayout(page);
  await page.locator('#file-open').click();
  const ask = page.locator('#lay-new-scrim');
  await expect(ask).toBeVisible();
  await expect(ask.locator('[data-new-title]')).toHaveText('Open a drawing');
  const other = HOUSE('HOUSE B');
  other.walls = other.walls.slice(0, 1);
  other.layout = { auto: false, viewports: [{ id: 1, kind: 'plan', levelId: 3, pif: 0.25, sheet: 1, xIn: 2, yIn: 2 }], nextViewportId: 2 };
  other.underlays = [{ id: 'u2', name: 'other.png', levelId: 8, x: 0, z: 0, scale: 1 }];
  other.underlayFiles = { u2: { name: 'other.png', dataUrl: PNG } };
  const chooser = page.waitForEvent('filechooser');
  await ask.locator('[data-new-discard]').click();
  await (await chooser).setFiles({ name: 'other.draft', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(other)) });
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await expect.poll(async () => (await stored(page))?.projectInfo?.name).toBe('HOUSE B');
  const d = await stored(page);
  expect(d.walls).toHaveLength(1);
  expect(d.underlayFiles).toBeUndefined();
  expect(d.layout.viewports).toHaveLength(1);
  const pic = await page.evaluate(async () => !!(await window.SharedFileStore.loadNamedFile('u2', 'underlays')));
  expect(pic).toBe(true);
});

test('OPEN Cancel leaves the drawing as it was', async ({ page }) => {
  await openLayout(page);
  await page.locator('#file-open').click();
  await page.locator('#lay-new-scrim [data-new-cancel]').click();
  await expect(page.locator('#lay-new-scrim')).toBeHidden();
  expect((await stored(page)).projectInfo.name).toBe('HOUSE A');
});
