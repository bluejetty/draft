// DETAILS ON LAYOUT SHEETS — step 4 of jb's DETAILS library plan.
//
// jb, 19 Nov 2026: "can the MAIN FILE use the DETAIL FILE", "only allow each
// MAIN DRAFT file to open one DETAIL.draft at a time, but they will still be
// able to bring in LAYOUT from a different DETAIL2.draft file". And on the
// next step: "yes".
//
// WHAT IS CHECKED, each where it would quietly go wrong:
//
//   1. + ADD VIEWPORT -> DETAILS LIBRARY lists the libraries this browser
//      keeps (SAVE DETAIL on MODEL puts them there); USE one links it, and
//      its details are offered by category.
//   2. A detail placed comes in at the scale it was drawn at, framed on its
//      frame, painted from the library's copy kept in this file, with its
//      bubble (number on the sheet / sheet number) under it, and it is
//      still there after a reload.
//   3. RELOAD FROM LIBRARY brings the library's newer copy onto every
//      detail from it, keeping place and scale.
//   4. ONE LIBRARY LINKED AT A TIME: CHANGE LIBRARY links another, and the
//      details already placed keep the copy they came from.
//   5. A details .draft off the disk (FROM ANOTHER FILE) offers its details
//      the same way.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const LIBRARIES = 'details-libraries';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;
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

// A LIBRARY of two details, the footing's lines in red so they can be
// counted on the sheet.
function library(color = '#ff0000', footingName = 'TYP. STRIP FOOTING') {
  const line = (id, shelf, sx, sz, ex, ez) => ({ id, levelId: -shelf, view: 'plan', layer: 'draft',
    start: point(sx, sz), end: point(ex, ez), color, weight: 6 });
  return {
    version: 1, standalone: 'details', detailsLibrary: 'DETAILS-LIBRARY',
    levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 3, name: 'MAIN FL', elev: 0 }],
    walls: [],
    boneyardShelves: [
      { id: 1, name: footingName, detail: { category: 'FOUNDATION', kind: 'typ', frameW: 4, frameH: 4, scale: 1 } },
      { id: 2, name: 'TYP. EAVE', detail: { category: 'FRAMING', kind: 'typ', frameW: 3, frameH: 2, scale: 1.5 } },
      { id: 3, name: 'PARKED SHELF' },
    ],
    nextBoneyardShelfId: 4,
    lines: [line(1, 1, -1, -1.5, 1, -1.5), line(2, 1, 1, -1.5, 1, 1.5), line(3, 1, 1, 1.5, -1, 1.5), line(4, 1, -1, 1.5, -1, -1.5),
      line(5, 2, -1, 0, 1, 0)],
  };
}

const fileOf = (name, saved) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });

async function openLayout(page, drawing, libraries = { 'DETAILS-LIBRARY.draft': library() }) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved, libs, libBucket }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
    for (const [name, lib] of Object.entries(libs)) {
      await window.SharedFileStore.saveNamedFile(new File([JSON.stringify(lib)], name, { type: 'application/json' }), libBucket);
    }
  }, { bucket: BUCKET, saved: drawing, libs: libraries, libBucket: LIBRARIES });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}
const storeLibrary = (page, name, lib) => page.evaluate(async ({ name, lib, libBucket }) => {
  await window.SharedFileStore.saveNamedFile(new File([JSON.stringify(lib)], name, { type: 'application/json' }), libBucket);
}, { name, lib, libBucket: LIBRARIES });

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
  return { x: box.x + panX + xIn * zoom, y: box.y + panY + yIn * zoom, zoom };
}

const frames = page => page.evaluate(() =>
  JSON.parse(document.querySelector('[data-layout-canvas]').getAttribute('data-layout-frames') || '[]'));

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

async function linkLibrary(page, name = 'DETAILS-LIBRARY.draft') {
  await page.click('[data-layout-add-viewport]');
  await page.click(`[data-add-library="${name}"]`);
  await expect(page.locator('[data-add-menu]')).toContainText(`LIBRARY: ${name}`);
}
async function place(page, pick, xIn, yIn) {
  await page.click(`[data-add-pick="${pick}"]`);
  const at = await sheetToClient(page, xIn, yIn);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));
}

test('+ ADD VIEWPORT links a library this browser keeps and offers its details by category', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await page.click('[data-layout-add-viewport]');
  const menu = page.locator('[data-add-menu]');
  await expect(menu).toContainText('DETAILS LIBRARY');
  await expect(page.locator('[data-add-library="DETAILS-LIBRARY.draft"]')).toHaveText('USE DETAILS-LIBRARY');
  await page.click('[data-add-library="DETAILS-LIBRARY.draft"]');
  await expect(menu).toContainText('LIBRARY: DETAILS-LIBRARY.draft');
  await expect(menu).toContainText('FOUNDATION');
  await expect(menu).toContainText('FRAMING');
  await expect(page.locator('[data-add-pick="L1|libdetail:1"]')).toHaveText(`TYP. STRIP FOOTING  ·  1" = 1'-0"`);
  await expect(page.locator('[data-add-pick="L1|libdetail:2"]')).toHaveText(`TYP. EAVE  ·  1 1/2" = 1'-0"`);
  // A SHELF WITH NO CARD IS NOT A DETAIL.
  await expect(page.locator('[data-add-pick="L1|libdetail:3"]')).toHaveCount(0);
  // AND IT IS NOT A FILE FROM DISK: FROM ANOTHER FILE does not list it.
  await expect(page.locator('[data-add-file="L1"]')).toHaveCount(0);
});

test('a detail comes in at its own scale, framed on its frame, with its bubble, and stays after a reload', async ({ page }) => {
  await openLayout(page, houseDrawing());
  expect(await inkOf(page, 'red')).toBe(0);
  await linkLibrary(page);
  await place(page, 'L1|libdetail:1', 12, 4);
  const layout = await savedLayout(page);
  const placed = layout.viewports.find(v => v.kind === 'libdetail');
  expect(placed).toMatchObject({ kind: 'libdetail', source: 'L1', shelfId: 1, pif: 1, sheet: 1 });
  expect(layout.sources).toHaveLength(1);
  expect(layout.sources[0]).toMatchObject({ id: 'L1', name: 'DETAILS-LIBRARY.draft', library: true });
  expect(layout.sources[0].drawing.standalone).toBe('details');
  // FRAMED ON ITS FRAME: 4' x 4' at 1" = 1'-0" is 4" x 4" of paper.
  const frame = (await frames(page)).find(f => f.id === placed.id);
  expect(frame.wIn).toBeCloseTo(4, 3);
  expect(frame.hIn).toBeCloseTo(4, 3);
  expect(await inkOf(page, 'red'), 'the footing is painted').toBeGreaterThan(200);
  // THE BUBBLE: drawn under the frame.
  const at = await sheetToClient(page, frame.xIn, frame.yIn + frame.hIn);
  const bubbleInk = await page.evaluate(({ x, y, s }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const box = canvas.getBoundingClientRect();
    const k = canvas.width / box.width;
    const d = canvas.getContext('2d').getImageData((x - box.x) * k, (y - box.y) * k, s * k, s * k).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) n += 1;
    return n;
  }, { x: at.x, y: at.y + 2, s: at.zoom * 0.5 });
  expect(bubbleInk, 'the bubble under the frame').toBeGreaterThan(30);
  if (process.env.DRAFT_SHOT) await page.screenshot({ path: process.env.DRAFT_SHOT });
  // IT IS IN THE FILE.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(300);
  expect(await inkOf(page, 'red')).toBeGreaterThan(200);
  // AND STILL A LIBRARY'S DETAIL after the reload: its menu reads the
  // library again, not a file off the disk.
  const mid = await sheetToClient(page, frame.xIn + frame.wIn / 2, frame.yIn + frame.hIn / 2);
  await page.mouse.click(mid.x, mid.y, { button: 'right' });
  await expect(page.locator('[data-context-item="reload-from-library"]')).toBeVisible();
  await expect(page.locator('[data-context-item="reload-from-file"]')).toHaveCount(0);
});

test('RELOAD FROM LIBRARY brings the newer library in, keeping place and scale', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await linkLibrary(page);
  await place(page, 'L1|libdetail:1', 12, 4);
  const before = (await savedLayout(page)).viewports.find(v => v.kind === 'libdetail');
  expect(await inkOf(page, 'blue')).toBe(0);
  // THE LIBRARY CHANGES (SAVE DETAIL on MODEL): the footing redrawn in blue.
  await storeLibrary(page, 'DETAILS-LIBRARY.draft', library('#0000ff', 'TYP. STRIP FOOTING 8"'));
  expect(await inkOf(page, 'red'), 'the sheet keeps its copy until asked').toBeGreaterThan(200);
  const frame = (await frames(page)).find(f => f.id === before.id);
  const mid = await sheetToClient(page, frame.xIn + frame.wIn / 2, frame.yIn + frame.hIn / 2);
  await page.mouse.click(mid.x, mid.y, { button: 'right' });
  await withLayoutSave(page, () => page.click("[data-context-item=\"reload-from-library\"]"));
  await expect.poll(() => inkOf(page, 'blue')).toBeGreaterThan(200);
  expect(await inkOf(page, 'red')).toBe(0);
  const layout = await savedLayout(page);
  const after = layout.viewports.find(v => v.kind === 'libdetail');
  expect({ x: after.xIn, y: after.yIn, pif: after.pif }).toEqual({ x: before.xIn, y: before.yIn, pif: before.pif });
  expect(layout.sources[0].drawing.boneyardShelves[0].name).toBe('TYP. STRIP FOOTING 8"');
});

test('one library linked at a time: CHANGE LIBRARY links another, placed details keep their copy', async ({ page }) => {
  const second = library('#0000ff');
  await openLayout(page, houseDrawing(), { 'DETAILS-LIBRARY.draft': library(), 'DUPLEX-DETAILS.draft': second });
  await linkLibrary(page);
  await place(page, 'L1|libdetail:1', 12, 4);
  await page.click('[data-layout-add-viewport]');
  await page.click('[data-add-library-change]');
  await page.click('[data-add-library="DUPLEX-DETAILS.draft"]');
  await expect(page.locator('[data-add-menu]')).toContainText('LIBRARY: DUPLEX-DETAILS.draft');
  // ONLY THE LINKED ONE'S DETAILS ARE OFFERED.
  await expect(page.locator('[data-add-pick^="L1|"]')).toHaveCount(0);
  await place(page, 'L2|libdetail:1', 12, 9);
  const layout = await savedLayout(page);
  expect(layout.sources.map(s => [s.id, s.name])).toEqual([['L1', 'DETAILS-LIBRARY.draft'], ['L2', 'DUPLEX-DETAILS.draft']]);
  expect(layout.viewports.filter(v => v.kind === 'libdetail').map(v => v.source)).toEqual(['L1', 'L2']);
  expect(await inkOf(page, 'red')).toBeGreaterThan(200);
  expect(await inkOf(page, 'blue')).toBeGreaterThan(200);
});

test('a details .draft from the disk offers its details through FROM ANOTHER FILE', async ({ page }) => {
  await openLayout(page, houseDrawing(), {});
  await page.click('[data-layout-add-viewport]');
  await expect(page.locator('[data-add-menu]')).toContainText('No details library in this browser yet');
  const chooser = page.waitForEvent('filechooser');
  await page.click('[data-add-file-open]');
  await (await chooser).setFiles(fileOf('DETAIL2.draft', library()));
  await expect(page.locator('[data-add-pick="F1|libdetail:2"]')).toBeVisible();
  await place(page, 'F1|libdetail:2', 12, 4);
  const placed = (await savedLayout(page)).viewports.find(v => v.kind === 'libdetail');
  expect(placed).toMatchObject({ source: 'F1', shelfId: 2, pif: 1.5 });
});
