// LAYOUT WINDOWS FROM ANOTHER FILE (jb, 19 Nov 2026): "i'd like to draw the
// SITE PLAN in a seperate file and then bring it into the construction plan
// with the house, which i will be drawing in seperate file", "need to bring
// in LAYOUT WINDOWS from other DRAFT files", "select file, and then select
// layout", "level / layout".
//
// + ADD VIEWPORT -> OPEN A .DRAFT FILE... -> that file's LAYOUT WINDOWS (with
// their scale, window and layers off) or its LEVELS -> click the sheet. The
// other drawing is kept as a COPY in this file's layout record; RELOAD FROM
// FILE on the window's right-click menu swaps the copy for the file as it is
// now, and UNDO puts the old copy back.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;
const SITE = 8;
const point = (x, z) => ({ x, y: 0, z });

function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId: 1, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  });
  return {
    version: 1,
    levels: [{ id: 0, name: 'FOUNDATION', elev: -8 }, { id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [wall(1, 0, 0, 24, 0), wall(2, 24, 0, 24, 16), wall(3, 24, 16, 0, 16), wall(4, 0, 16, 0, 0)],
    layout: {
      auto: false, nextViewportId: 2, sheets: [{ title: '' }],
      viewports: [{ id: 1, kind: 'plan', levelId: 1, pif: 0.25, xIn: 4, yIn: 3, sheet: 1 }],
    },
  };
}

// A STANDALONE SITE PLAN: lines on SITE in one colour, a note, and its own
// sheet with one window at 1" = 30' that has a layer switched off.
function siteDrawing(color = '#ff0000') {
  const line = (id, sx, sz, ex, ez) => ({ id, start: point(sx, sz), end: point(ex, ez),
    levelId: SITE, view: 'plan', layer: 'draft', color, weight: 6 });
  return {
    version: 1,
    standalone: 'site',
    levels: [
      { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [],
    lines: [line(1, 0, 0, 120, 0), line(2, 120, 0, 120, 90), line(3, 120, 90, 0, 90), line(4, 0, 90, 0, 0)],
    notes: [{ id: 1, levelId: SITE, view: 'plan', anchor: point(60, 45), text: point(70, 55), body: 'LEGAL LAND DESCRIPTION' }],
    layout: {
      auto: false, nextViewportId: 2, sheets: [{ title: 'SITE PLAN' }],
      viewports: [{ id: 1, kind: 'plan', levelId: SITE, pif: 1 / 30, xIn: 7, yIn: 5, sheet: 1, layersOff: ['A-ANNO-DIMS'] }],
    },
  };
}

const fileOf = (name, saved) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

const savedLayout = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).layout;
}, BUCKET);

async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}

async function sheetToClient(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  const panX = (box.width - PW * zoom) / 2, panY = (box.height - PH * zoom) / 2;
  return { x: box.x + panX + xIn * zoom, y: box.y + panY + yIn * zoom };
}

const frames = page => page.evaluate(() =>
  JSON.parse(document.querySelector('[data-layout-canvas]').getAttribute('data-layout-frames') || '[]'));

// Pixels of one colour on the sheet: the house walls, the titleblock and the
// frames are greys, so a red (or blue) line is the site file's and nothing else.
const inkOf = (page, which) => page.evaluate(which => {
  const canvas = document.querySelector('[data-layout-canvas]');
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    if (which === 'red' ? r > 180 && g < 90 && b < 90 : b > 180 && r < 90 && g < 120) n += 1;
  }
  return n;
}, which);

async function openSiteFile(page, saved = siteDrawing(), name = 'SITE.draft') {
  await page.click('[data-layout-add-viewport]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('[data-add-file-open]');
  await (await chooser).setFiles(fileOf(name, saved));
  await expect(page.locator('[data-add-menu] .lay-add-file')).toHaveText(`FROM ${name}`);
}

test('a layout window from another file comes in with its scale and layers, copied into this file', async ({ page }) => {
  await openLayout(page, houseDrawing());
  expect(await inkOf(page, 'red')).toBe(0);
  await openSiteFile(page);
  // ITS SHEET'S WINDOW, under its sheet's name, and its levels below.
  const win = page.locator('[data-add-pick="window:F1:1"]');
  await expect(win).toHaveText(/SITE PLAN/);
  await expect(page.locator('[data-add-menu]')).toContainText('SHEET 1 · SITE PLAN');
  await expect(page.locator('[data-add-pick="F1|plan:8"]')).toBeVisible();
  // A STANDALONE SITE FILE OFFERS ITS SITE PLAN ALONE, as it does at home.
  await expect(page.locator('[data-add-pick="F1|plan:3"]')).toHaveCount(0);
  await win.click();
  const at = await sheetToClient(page, 10, 5);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));

  const layout = await savedLayout(page);
  const placed = layout.viewports.find(v => v.source === 'F1');
  expect(placed).toMatchObject({ kind: 'plan', levelId: SITE, layersOff: ['A-ANNO-DIMS'] });
  expect(placed.pif).toBeCloseTo(1 / 30, 9);
  expect(placed.fromWindow).toBeUndefined();
  expect(layout.sources).toHaveLength(1);
  expect(layout.sources[0]).toMatchObject({ id: 'F1', name: 'SITE.draft' });
  expect(layout.sources[0].drawing.standalone).toBe('site');
  expect(layout.sources[0].copiedAt).toBeTruthy();
  // The house's own window is untouched.
  expect(layout.viewports.find(v => v.id === 1)).toMatchObject({ kind: 'plan', levelId: 1, pif: 0.25 });
  expect(await inkOf(page, 'red')).toBeGreaterThan(50);
  expect((await frames(page)).find(f => f.source === 'F1')).toBeTruthy();

  // IT IS IN THE FILE: a reload paints it again from the copy.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(300);
  expect(await inkOf(page, 'red')).toBeGreaterThan(50);
  const again = (await savedLayout(page)).viewports.find(v => v.source === 'F1');
  expect(again.layersOff).toEqual(['A-ANNO-DIMS']);
});

test('a level of the other file comes in as a fresh window, and the file is listed to pick from again', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await openSiteFile(page);
  await page.click('[data-add-pick="F1|plan:8"]');
  const at = await sheetToClient(page, 11, 5);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));
  const placed = (await savedLayout(page)).viewports.find(v => v.source === 'F1');
  expect(placed).toMatchObject({ kind: 'plan', levelId: SITE });
  expect(placed.layersOff).toBeUndefined();
  expect(await inkOf(page, 'red')).toBeGreaterThan(50);
  // The menu offers the file brought in, without opening it again.
  await page.click('[data-layout-add-viewport]');
  await expect(page.locator('[data-add-file="F1"]')).toHaveText('SITE.draft');
  await page.click('[data-add-file="F1"]');
  await expect(page.locator('[data-add-pick="window:F1:1"]')).toBeVisible();
  await page.click('[data-add-file-back]');
  await expect(page.locator('[data-add-pick^="plan:1"]').first()).toBeVisible();
});

test('RELOAD FROM FILE swaps the copy, keeps the window where it is, and UNDO puts the old copy back', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await openSiteFile(page);
  await page.click('[data-add-pick="window:F1:1"]');
  const at = await sheetToClient(page, 10, 5);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));
  const before = (await savedLayout(page));
  const placed = before.viewports.find(v => v.source === 'F1');
  expect(await inkOf(page, 'red')).toBeGreaterThan(50);

  // Right-click inside the window, away from the house's.
  const f = (await frames(page)).find(fr => fr.source === 'F1');
  const inside = await sheetToClient(page, f.xIn + f.wIn * 0.5, f.yIn + f.hIn * 0.5);
  await page.mouse.click(inside.x, inside.y, { button: 'right' });
  const item = page.locator('[data-context-item="reload-from-file"]');
  await expect(item).toBeVisible();
  await expect(page.locator('[data-context-item="edit-in-model"]')).toBeDisabled();
  const chooser = page.waitForEvent('filechooser');
  await item.click();
  await withLayoutSave(page, async () => (await chooser).setFiles(fileOf('SITE.draft', siteDrawing('#0000ff'))));

  expect(await inkOf(page, 'red')).toBe(0);
  expect(await inkOf(page, 'blue')).toBeGreaterThan(50);
  const after = await savedLayout(page);
  const moved = after.viewports.find(v => v.source === 'F1');
  expect(moved).toMatchObject({ id: placed.id, xIn: placed.xIn, yIn: placed.yIn, pif: placed.pif, layersOff: placed.layersOff });
  expect(after.sources[0].drawing.lines[0].color).toBe('#0000ff');
  expect(after.sources[0].copiedAt >= before.sources[0].copiedAt).toBe(true);
  await expect(page.locator('[data-layout-source-note]')).toContainText('1 window updated');

  await withLayoutSave(page, () => page.keyboard.press('Control+z'));
  expect(await inkOf(page, 'red')).toBeGreaterThan(50);
  expect((await savedLayout(page)).sources[0].drawing.lines[0].color).toBe('#ff0000');
});

test('a reload that has lost the level takes that window off and says so', async ({ page }) => {
  await openLayout(page, houseDrawing());
  // A section in the other file, brought in as a level pick.
  const site = siteDrawing();
  site.standalone = undefined;
  site.walls = [{ id: 1, start: point(10, 10), end: point(40, 10), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' }];
  site.cuts = [{ id: 5, name: 'A', startPt: point(20, 0), endPt: point(20, 30), dirVec: { x: 1, z: 0 }, elev: 4, levelId: 3 }];
  await openSiteFile(page, site, 'HOUSE-B.draft');
  await page.click('[data-add-pick="F1|section:5"]');
  const at = await sheetToClient(page, 11, 6);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));
  expect((await savedLayout(page)).viewports.some(v => v.source === 'F1' && v.kind === 'section')).toBe(true);

  const f = (await frames(page)).find(fr => fr.source === 'F1');
  const inside = await sheetToClient(page, f.xIn + f.wIn * 0.5, f.yIn + f.hIn * 0.5);
  await page.mouse.click(inside.x, inside.y, { button: 'right' });
  const chooser = page.waitForEvent('filechooser');
  await page.click('[data-context-item="reload-from-file"]');
  const gone = { ...site, cuts: [] };
  await withLayoutSave(page, async () => (await chooser).setFiles(fileOf('HOUSE-B.draft', gone)));
  const layout = await savedLayout(page);
  expect(layout.viewports.some(v => v.source === 'F1')).toBe(false);
  expect(layout.sources).toBeUndefined();
  await expect(page.locator('[data-layout-source-note]')).toContainText('SECTION A');
});

test('double-click on a window from another file says where to change it', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await openSiteFile(page);
  await page.click('[data-add-pick="window:F1:1"]');
  const at = await sheetToClient(page, 10, 5);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));
  const f = (await frames(page)).find(fr => fr.source === 'F1');
  const inside = await sheetToClient(page, f.xIn + f.wIn * 0.5, f.yIn + f.hIn * 0.5);
  await page.mouse.dblclick(inside.x, inside.y);
  await expect(page.locator('#lay-edit-description')).toContainText('comes from SITE.draft');
  expect(page.url()).toContain('LAYOUT.html');
});

test('a file that is not a drawing is refused with a word', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await page.click('[data-layout-add-viewport]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('[data-add-file-open]');
  await (await chooser).setFiles({ name: 'notes.draft', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await expect(page.locator('[data-layout-source-note]')).toContainText('notes.draft is not a drawing');
  expect((await savedLayout(page)).sources).toBeUndefined();
});

test('the layout reader keeps a viewport\'s SHOW LAYERS list (it used to drop it on the way in)', async ({ page }) => {
  await openLayout(page, houseDrawing());
  const kept = await page.evaluate(() => window.DraftDrawingFormat.layout(
    { viewports: [{ id: 1, kind: 'plan', levelId: 1, pif: 0.25, xIn: 1, yIn: 1, layersOff: ['A-ANNO-DIMS'] }] },
    new Set([1]), new Set()).viewports[0].layersOff);
  expect(kept).toEqual(['A-ANNO-DIMS']);
});

test('a window from another file prints and goes into the DXF with its note', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await openSiteFile(page);
  await page.click('[data-add-pick="window:F1:1"]');
  const at = await sheetToClient(page, 10, 5);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));
  const out = await page.evaluate(() => {
    const L = window.__layoutPage;
    const { canvas } = L._printSheetCanvas(1, 72);
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) red += 1;
    const texts = L._sheetDxfEntities(1).filter(e => e.type === 'text').map(e => e.text);
    return { red, texts };
  });
  expect(out.red).toBeGreaterThan(20);
  expect(out.texts.join(' ')).toContain('LEGAL LAND DESCRIPTION');
  expect(out.texts.join(' ')).toContain('SITE PLAN');
});
