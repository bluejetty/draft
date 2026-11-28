// CROP A DETAIL TO ITS FRAME.
//
// jb, 21 Nov 2026: "can i make it so that if the user scrolls over the
// 'detail box' dotted line, light up and also show a popup that says 'click
// to crop to detail window' and then cut off any part of the drawing outside
// the box at that time" -- then: "ok ya actually just hide the ouside part
// and we won't have to worry about it and can still adjust it later". And:
// "when you make DXF or PDF it won't show it right?"
//
// WHAT IS CHECKED:
//   1. Hovering the dashed frame (Select in hand) lights it and shows the
//      popup; off the frame the popup goes.
//   2. A press on the frame sets `crop` on the card, deletes nothing, and
//      what lay outside the frame is no longer painted. One UNDO puts it
//      back; a press again (or SHOW ALL) shows it again.
//   3. On a LAYOUT sheet, a detail window grown past its frame shows the
//      outside of a cropped detail neither on the desk nor in the DXF.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
// A 4' x 4' frame; a red line from inside the frame to 3' outside it.
const library = (crop = false) => ({
  version: 1, planTurn: 0, standalone: 'details', detailsLibrary: 'DETAILS-LIBRARY',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 1,
  walls: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  boneyardShelves: [{ id: 1, name: 'TYP. STRIP FOOTING',
    detail: { category: 'FOUNDATION', kind: 'typ', frameW: 4, frameH: 4, scale: 1, ...(crop ? { crop: true } : {}) } }],
  nextBoneyardShelfId: 2, activeBoneyardShelfId: 1,
  lines: [{ id: 'l1', levelId: -1, view: 'plan', layer: 'draft', start: point(0, 0), end: point(5, 0), color: '#ff0000', weight: 6 }],
});

async function openDetail(page) {
  await h.openEditor(page, { drawing: library(), bucket: BUCKET, url: '/MODEL.html?left=1', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // A details file opens on its board; double-click goes into the detail.
  await page.locator('#details-board [data-board-card="1"]').dblclick();
  await expect(page.locator('#details-board')).toBeHidden();
  await page.waitForTimeout(200);
}
// The frame's right edge and the canvas point 2' past it, in client pixels.
const spots = page => page.evaluate(() => {
  const rect = canvas.getBoundingClientRect();
  const at = (x, z) => { const s = toS({ x, z }); return { x: rect.left + s.x, y: rect.top + s.y }; };
  return { edge: at(2, -1), inside: at(1, 0), outside: at(3.5, 0), canvas: { x: rect.left, y: rect.top } };
});
const redAt = (page, client) => page.evaluate(({ x, y }) => {
  const rect = canvas.getBoundingClientRect();
  const g = canvas.getContext('2d');
  const k = canvas.width / rect.width;
  let n = 0;
  const d = g.getImageData(Math.round((x - rect.left) * k) - 6, Math.round((y - rect.top) * k) - 6, 12, 12).data;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) n += 1;
  return n;
}, client);
const card = page => page.evaluate(() => detailCardOf(storedShelf(1)));

test('the frame lights under the cursor and offers the crop', async ({ page }) => {
  await openDetail(page);
  const s = await spots(page);
  await page.mouse.move(s.edge.x, s.edge.y);
  const pop = page.locator('[data-detail-frame-popup]');
  await expect(pop).toBeVisible();
  await expect(pop).toHaveText('CLICK TO CROP TO DETAIL WINDOW');
  expect(await page.evaluate(() => detailFrameHover)).toBe(true);
  await page.mouse.move(s.inside.x, s.inside.y + 30);
  await expect(pop).toBeHidden();
  expect(await page.evaluate(() => detailFrameHover)).toBe(false);
});

test('a press on the frame hides what is outside, deletes nothing, and UNDO / a press again bring it back', async ({ page }) => {
  await openDetail(page);
  const s = await spots(page);
  expect(await redAt(page, s.outside), 'the line shows past the frame').toBeGreaterThan(0);
  await page.mouse.move(s.edge.x, s.edge.y);
  await page.mouse.click(s.edge.x, s.edge.y);
  expect((await card(page)).crop).toBe(true);
  expect(await page.evaluate(() => drawing.lines.length), 'nothing deleted').toBe(1);
  expect(await page.evaluate(() => selection.length), 'the press picks nothing').toBe(0);
  await page.mouse.move(s.inside.x, s.inside.y + 40);
  expect(await redAt(page, s.outside), 'hidden past the frame').toBe(0);
  expect(await redAt(page, s.inside), 'still drawn inside').toBeGreaterThan(0);
  await expect(page.locator('[data-detail-crop="on"]')).toHaveAttribute('aria-pressed', 'true');
  // ONE UNDO.
  await page.keyboard.press('Control+z');
  expect((await card(page)).crop).toBeFalsy();
  await page.evaluate(() => paint());
  expect(await redAt(page, s.outside)).toBeGreaterThan(0);
  // CROP TO FRAME on the card, then the frame pressed again.
  await page.locator('[data-detail-crop="on"]').click();
  expect((await card(page)).crop).toBe(true);
  await page.mouse.move(s.edge.x, s.edge.y);
  await expect(page.locator('[data-detail-frame-popup]')).toHaveText('CLICK TO SHOW THE WHOLE DRAWING');
  await page.mouse.click(s.edge.x, s.edge.y);
  expect((await card(page)).crop).toBeFalsy();
  // AND IT REACHES THE FILE.
  await page.locator('[data-detail-crop="on"]').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.boneyardShelves.find(sh => sh.id === 1).detail.crop).toBe(true);
});

// ── ON A SHEET ────────────────────────────────────────────────────────────
function house(lib) {
  return {
    version: 1,
    levels: [{ id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [],
    layout: {
      auto: false, nextViewportId: 2, sheets: [{ title: '' }],
      sources: [{ id: 'L1', name: 'DETAILS-LIBRARY.draft', library: true, copiedAt: '2026-11-21T00:00:00Z', drawing: lib }],
      // GROWN two inches of paper to the right: 2' of detail past the frame.
      viewports: [{ id: 1, kind: 'libdetail', source: 'L1', shelfId: 1, pif: 1, xIn: 6, yIn: 5, sheet: 1, crop: { r: -2 } }],
    },
  };
}
async function openLayout(page, drawing) {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}
const dxfLineReach = page => page.evaluate(() => {
  // THE RED LINE'S RUNS (the frame and bubble are not exported ink).
  const ents = window.__layoutPage._sheetDxfEntities(1).filter(e => e.type === 'poly' && e.layer !== 'A-ANNO-TITL');
  const xs = ents.flatMap(e => e.pts.filter((_, i) => i % 2 === 0));
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
});
const sheetRed = page => page.evaluate(() => {
  const c = document.querySelector('[data-layout-canvas]');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) n += 1;
  return n;
});

test('a cropped detail shows nothing past its frame on a grown sheet window, nor in the DXF', async ({ page }) => {
  await openLayout(page, house(library(false)));
  const redOpen = await sheetRed(page);
  const reachOpen = await dxfLineReach(page);
  await openLayout(page, house(library(true)));
  const redCropped = await sheetRed(page);
  const reachCropped = await dxfLineReach(page);
  expect(redOpen).toBeGreaterThan(0);
  expect(redCropped, 'less red on the sheet').toBeLessThan(redOpen * 0.75);
  expect(redCropped).toBeGreaterThan(0);
  // The line runs 5' from the frame's centre; cropped, only 2' of it is left.
  expect(reachCropped, 'the DXF line stops at the frame').toBeLessThan(reachOpen * 0.75);
  expect(reachCropped).toBeGreaterThan(0);
});
