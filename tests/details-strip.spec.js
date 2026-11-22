// THE DETAILS TAB ON A HOUSE — a details library loaded into the house file.
//
// jb, 20 Nov 2026: "i need a little area in ther main model house area like
// the SHELFS to load all the details into" -- "to load a DETAILS.draft file
// within a house drawing" -- "a little area where you can search through
// them too". The plan he passed ("lets try it sir"): a DETAILS tab right of
// the bone; LOAD DETAILS FILE; search and category chips over squares; a
// press is a bigger look with PUT ON SHEET and EDIT; snapshots wait there
// and ADD TO DETAILS files one into the library; the house keeps a copy.
//
// WHAT IS CHECKED, each where it would quietly go wrong:
//
//   1. THE TAB sits right of the bone, and LOAD -> USE puts a COPY of the
//      library into the house's own file (it survives a save).
//   2. SEARCH and the CATEGORY chips narrow the squares.
//   3. ADD TO DETAILS makes a new detail in the stored library AND the
//      house's copy, from the snapshot's lines.
//   4. EDIT opens the library at that detail with the house put aside, and
//      BACK TO HOUSE brings the house back with the library's edit in its
//      copy.
//   5. PUT ON SHEET lands on LAYOUT with that detail held and the library
//      linked; a click on the sheet places it.
//   6. A library has no DETAILS tab of its own (its pane is its details).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const LIBS = 'details-libraries';
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
    { id: 1, name: 'TYP. STRIP FOOTING', detail: { category: 'FOUNDATION', kind: 'typ', frameW: 4, frameH: 4, scale: 1, tags: ['footing'] } },
    { id: 2, name: 'TYP. EAVE', detail: { category: 'FRAMING', kind: 'typ', frameW: 3, frameH: 2, scale: 1.5, note: 'vented soffit' } },
    { id: 3, name: 'RIM JOIST', detail: { category: 'FRAMING', kind: 'special', frameW: 3, frameH: 3, scale: 1 } },
  ],
  nextBoneyardShelfId: 4, activeBoneyardShelfId: 1,
  lines: [
    { id: 'l1', levelId: -1, start: { x: -1, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 }, layer: 'A-DETL' },
    { id: 'l2', levelId: -2, start: { x: -1, y: 0, z: 0.5 }, end: { x: 1, y: 0, z: -0.5 }, layer: 'A-DETL' },
  ],
});
const house = () => blank({
  lines: [{ id: 'h1', levelId: 3, view: 'plan', start: { x: 0, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 }, layer: 'draft' }],
});

async function openHouse(page, { file = house(), snapshot = false } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, libs, drawing, lib }) => {
    const S = window.SharedFileStore;
    await S.saveNamedFile(new File([JSON.stringify(lib)], 'DETAILS-LIBRARY.draft', { type: 'application/json' }), libs);
    await S.saveSharedFile(new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, libs: LIBS, drawing: file, lib: library() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
  // A PICTURE WAITING, written the camera's way once MODEL (and its DXF
  // writer) is up; the tab hears the store change.
  if (snapshot) {
    await page.evaluate(async () => {
      const S = window.SharedFileStore;
      const W = window.DraftDxfWriter;
      const rec = { version: 1, id: 'snap1', name: 'E1 SNAPSHOT', cut: 'E1', kind: 'elevation', from: '',
        takenAt: '2026-11-20T12:00:00.000Z', widthFt: 2, heightFt: 1, units: 'in', lines: 1,
        dxf: W.write({ entities: [{ type: 'poly', layer: 'SNAPSHOT', closed: false, pts: [-10, 0, 10, 0] }],
          layers: [{ name: 'SNAPSHOT', color: 7 }] }) };
      await S.saveNamedFile(new File([JSON.stringify(rec)], 'snap1.json', { type: 'application/json' }), 'detail-snapshots');
    });
    await expect(page.locator('#details-tab')).toHaveAttribute('data-waiting', '');
  }
}
const loadLibrary = async page => {
  await page.locator('#details-tab').click();
  await page.locator('[data-details-use="DETAILS-LIBRARY.draft"]').click();
  await expect(page.locator('[data-details-linked]')).toHaveAttribute('data-details-linked', 'DETAILS-LIBRARY.draft');
};
const storedLibrary = page => page.evaluate(async () => JSON.parse(await (await window.SharedFileStore
  .loadNamedFile('DETAILS-LIBRARY.draft', 'details-libraries')).text()));

test('the DETAILS tab sits right of the bone, and LOAD puts a copy of the library in the house', async ({ page }) => {
  await openHouse(page);
  const tab = await page.locator('#details-tab').boundingBox();
  const bone = await page.locator('#dt-bone').boundingBox();
  expect(tab.x, 'right of the bone').toBeGreaterThan(bone.x + bone.width);
  await loadLibrary(page);
  await expect(page.locator('[data-details-square]')).toHaveCount(3);
  await expect(page.locator('#details-tab')).toContainText('DETAILS (3)');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.linkedDetails.name).toBe('DETAILS-LIBRARY.draft');
  expect(d.linkedDetails.drawing.boneyardShelves.map(s => s.name))
    .toEqual(['TYP. STRIP FOOTING', 'TYP. EAVE', 'RIM JOIST']);
  // THE COPY IS THE HOUSE'S: with the browser's library gone, a reload still shows the squares.
  await page.evaluate(() => window.SharedFileStore.removeNamedFile('DETAILS-LIBRARY.draft', 'details-libraries'));
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-details-square]')).toHaveCount(3);
});

test('search and the category chips narrow the squares', async ({ page }) => {
  await openHouse(page);
  await loadLibrary(page);
  await page.locator('[data-details-search]').fill('vented');
  await expect(page.locator('[data-details-square]')).toHaveCount(1);
  await expect(page.locator('[data-details-square="2"]')).toBeVisible();
  await page.locator('[data-details-search]').fill('footing');
  await expect(page.locator('[data-details-square]')).toHaveCount(1);
  await page.locator('[data-details-search]').fill('');
  await page.locator('[data-details-category="FRAMING"]').click();
  await expect(page.locator('[data-details-square]')).toHaveCount(2);
  await page.locator('[data-details-category="ALL"]').click();
  await expect(page.locator('[data-details-square]')).toHaveCount(3);
  // A PRESS IS A BIGGER LOOK, with the two presses.
  await page.locator('[data-details-square="1"]').click();
  await expect(page.locator('[data-details-look="1"]')).toBeVisible();
  await expect(page.locator('[data-details-put="1"]')).toBeVisible();
  await expect(page.locator('[data-details-edit="1"]')).toBeVisible();
});

test('ADD TO DETAILS files a snapshot into the library and the house copy', async ({ page }) => {
  await openHouse(page, { snapshot: true });
  await loadLibrary(page);
  await page.locator('[data-details-snapshots]').click();
  await page.locator('[data-details-snapshot-add="snap1"]').click();
  await expect(page.locator('[data-details-look="4"]')).toBeVisible();
  const lib = await storedLibrary(page);
  const shelf = lib.boneyardShelves.find(s => s.id === 4);
  expect(shelf.name).toBe('E1 SNAPSHOT');
  expect(shelf.detail.frameW).toBe(2);
  expect(shelf.detail.frameH).toBe(1);
  expect(lib.lines.filter(l => l.levelId === -4 && l.layer === 'SNAPSHOT')).toHaveLength(1);
  const copy = await page.evaluate(() => drawing.linkedDetails.drawing.boneyardShelves.map(s => s.name));
  expect(copy).toContain('E1 SNAPSHOT');
});

test('EDIT opens the library at the detail, and BACK TO HOUSE brings the house back up to date', async ({ page }) => {
  await openHouse(page);
  await loadLibrary(page);
  await page.locator('[data-details-square="2"]').click();
  await page.locator('[data-details-edit="2"]').click();
  await expect.poll(() => page.evaluate(() => drawing.standalone)).toBe('details');
  expect(await page.evaluate(() => [activeShelfId(), boneyardActive])).toEqual([2, true]);
  await expect(page.locator('#details-strip'), 'no house tab on a library').toBeHidden();
  await h.openModelRail(page);
  await expect(page.locator('[data-back-to-house]')).toBeVisible();
  // AN EDIT IN THE LIBRARY.
  await page.evaluate(() => {
    drawing.lines.push({ id: 'new', levelId: -2, view: 'plan', start: { x: 0, y: 0, z: 0 }, end: { x: 0.5, y: 0, z: 0.5 }, layer: 'draft' });
    markDirty();
  });
  await page.locator('[data-back-to-house]').click();
  await expect.poll(() => page.evaluate(() => drawing.standalone ?? null)).toBeNull();
  const state = await page.evaluate(() => ({
    houseLines: drawing.lines.map(l => l.id),
    copyLines: drawing.linkedDetails.drawing.lines.filter(l => l.levelId === -2).length,
  }));
  expect(state.houseLines).toEqual(['h1']);
  expect(state.copyLines, 'the edit came home in the copy').toBe(2);
  expect((await storedLibrary(page)).lines.some(l => l.id === 'new'), 'and in the browser library').toBe(true);
});

test('PUT ON SHEET goes to LAYOUT holding the detail, and a click places it', async ({ page }) => {
  await openHouse(page);
  await loadLibrary(page);
  await page.locator('[data-details-square="2"]').click();
  await page.locator('[data-details-put="2"]').click();
  await page.waitForURL(/LAYOUT\.html/);
  await expect(page.locator('body')).toHaveAttribute('data-layout-ready', '1', { timeout: 10000 });
  await expect(page.locator('[data-add-pick$="libdetail:2"]')).toHaveClass(/on/);
  expect(page.url()).not.toContain('placeDetail');
  const sheet = await page.locator('canvas').first().boundingBox();
  await page.mouse.click(sheet.x + sheet.width * 0.4, sheet.y + sheet.height * 0.4);
  await expect.poll(async () => {
    const d = await h.savedDrawing(page);
    return (d.layout?.viewports || []).filter(v => v.kind === 'libdetail' && v.shelfId === 2).length;
  }).toBe(1);
});

// THE DETAILS LIBRARY SEAT on the LEVELS / LAYERS pane (jb, 22 Nov 2026:
// "could we make a 'viewport' window after the section cuts for the DETAIL
// LIBRARY"): the last seat, after S1 / S2, a picture of the first details,
// and a press opens the library on its board.
test('the DETAILS LIBRARY seat sits after the sections and opens the library on its board', async ({ page }) => {
  await openHouse(page);
  await h.openModelRail(page);
  const seats = page.locator('#view-rail .seat');
  const ids = await seats.evaluateAll(els => els.map(el => el.dataset.seat));
  expect(ids.slice(-3), 'after the section seats').toEqual(['S1', 'S2', 'DETAILS']);
  const seat = page.locator('#view-rail .seat[data-seat="DETAILS"]');
  // NOTHING LINKED: + LOAD, and a press opens the DETAILS panel's LOAD list.
  await expect(seat.locator('.seat-cut')).toBeVisible();
  await expect(seat.locator('.seat-cut span')).toHaveText('+ LOAD');
  await seat.click();
  await expect(page.locator('#details-panel')).toBeVisible();
  await page.locator('[data-details-use="DETAILS-LIBRARY.draft"]').click();
  // LINKED: the count on the label, the picture drawn, no + LOAD.
  await expect(seat.locator('.seat-label')).toHaveText('DETAILS LIBRARY (3)');
  await expect(seat.locator('.seat-cut')).toBeHidden();
  await expect.poll(() => seat.locator('canvas').evaluate(c => Number(c.dataset.detailsSeatShows || 0))).toBe(3);
  await expect.poll(() => seat.locator('canvas').evaluate(c => Number(c.dataset.detailThumbMarks || 0)),
    'the details lines are drawn into the seat').toBeGreaterThan(0);
  // A PRESS: the library is the drawing, on its board, the house waiting.
  await seat.click();
  await expect.poll(() => page.evaluate(() => drawing.standalone)).toBe('details');
  await expect(page.locator('#details-board')).toBeVisible();
  await expect(page.locator('#view-rail .seat'), 'a library seats nothing').toHaveCount(0);
  await expect(page.locator('[data-back-to-house]')).toBeVisible();
  await page.locator('[data-back-to-house]').click();
  await expect.poll(() => page.evaluate(() => drawing.standalone ?? null)).toBeNull();
  await expect(page.locator('#view-rail .seat[data-seat="DETAILS"] .seat-label')).toHaveText('DETAILS LIBRARY (3)');
});
