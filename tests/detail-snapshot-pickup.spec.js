// DETAIL SNAPSHOT: the pick-up.
//
// jb, 20 Nov 2026: "take a 'snapshot' of the elevation or section and have
// it pop up in the DETAIL area as a new detail" -- "(that can be further
// edited - not a window that shows what exists there, but takes a snapshot
// and copies the lines over so they can be edited and new details added
// too" -- "it will only be used to get information for drawing the details
// which will be stand alone files".
//
// tests/detail-snapshot-camera.spec.js is the first half: the key, the box,
// and what is filed in the tray. This is the second: a DETAILS LIBRARY
// showing what is waiting, and USE making a detail of one.
//
// WHAT IS CHECKED, each where it would quietly go wrong:
//
//   1. THE PANE SAYS WHAT IS WAITING: the count on the key, the pictures
//      newest first, each with a drawing of itself that is really drawn.
//   2. USE MAKES A DETAIL: named for the view, framed to the box that was
//      dragged, and the picture's lines in it AS THE FILE'S OWN LINES -- in
//      feet where the picture was inches, the right way up, centred in the
//      frame, on the sheet where the screen shows them. Read out of the
//      SAVED drawing, and off the canvas.
//   3. THEY CAN BE EDITED: one is picked and deleted, and the rest stay.
//   4. THE PICTURE STAYS IN THE TRAY until its X; a second detail from it
//      takes its own name.
//   5. A PICTURE TAKEN IN ANOTHER TAB ARRIVES without a reload -- the camera
//      is in the house's file, which is usually another tab.
//   6. END TO END: a box dragged on a real elevation, then the library
//      opened and USE pressed, and the detail holds that box's lines.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const blank = (extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
// A library as saved: one detail, with a line of its own in it.
const library = () => blank({
  standalone: 'details', detailsLibrary: 'DETAILS-LIBRARY',
  boneyardShelves: [
    { id: 1, name: 'TYP. STRIP FOOTING', detail: { category: 'FOUNDATION', kind: 'typ', frameW: 4, frameH: 4, scale: 1 } },
  ],
  nextBoneyardShelfId: 2, activeBoneyardShelfId: 1,
  lines: [{ id: 'l1', levelId: -1, start: { x: -1, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 }, layer: 'A-DETL' }],
});

// DAY, on white paper, so "dark" off the canvas means ink.
async function openFile(page, file, query = '?theme=rough&mode=day') {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openEditor(page, { drawing: file, bucket: BUCKET, url: `/MODEL.html${query}`, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

// A PICTURE WITH KNOWN LINES IN IT, filed the way the camera files one: an
// 8 ft by 6 ft box holding a line two feet long through the middle, a line a
// foot UP from the middle, a line right across two feet below it, and a word.
// Inches, y up, from the box's centre.
const KNOWN = { id: 'snap-known', name: 'S1 SNAPSHOT', cut: 'S1', kind: 'section',
  takenAt: '2026-11-20T15:00:00.000Z', widthFt: 8, heightFt: 6 };
const fileKnown = (page, over = {}) => page.evaluate(async rec => {
  const W = window.DraftDxfWriter;
  const entities = [
    { type: 'poly', layer: 'SNAPSHOT', pts: [-12, 0, 12, 0] },
    { type: 'poly', layer: 'SNAPSHOT', pts: [0, 0, 0, 12] },
    { type: 'poly', layer: 'SNAPSHOT', pts: [-48, -24, 48, -24] },
    { type: 'text', layer: 'SNAPSHOT', x: -36, y: 24, h: 3, rot: 0, text: '2x10 JOIST', align: 'left', baseline: 'middle' },
  ];
  await window.DraftDetailSnapshot.save({ version: 1, units: 'in', lines: 3, from: '', ...rec,
    dxf: W.write({ entities, layers: [{ name: 'SNAPSHOT', color: 7 }] }) });
}, { ...KNOWN, ...over });

const trayKey = page => page.locator('[data-open-snapshots]');
const openTray = async page => {
  if (await trayKey(page).getAttribute('aria-expanded') !== 'true') await trayKey(page).click();
  await expect(page.locator('[data-snapshot-tray]')).toBeVisible();
};
// The lines of one detail, out of a saved drawing, as "x0 z0 x1 z1" in feet
// to the hundredth, either end first.
const linesOf = (drawing, shelfId) => (drawing.lines || []).filter(l => l.levelId === -shelfId).map(l => {
  const r = v => Math.round(v * 100) / 100 + 0;
  const a = [r(l.start.x), r(l.start.z)], b = [r(l.end.x), r(l.end.z)];
  return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [...a, ...b] : [...b, ...a]).join(' ');
}).sort();
// How much ink the sheet has along a world line, off the canvas: pixels in a
// strip three deep along it that are a line's grey or darker. The sheet's
// one-foot grid is fainter than that, and is not counted.
const inkAlong = (page, a, b) => page.evaluate(([p, q]) => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const sx = c.width / r.width, sy = c.height / r.height;
  const s0 = toS(p), s1 = toS(q);
  const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const len = Math.hypot(s1.x - s0.x, s1.y - s0.y);
  let dark = 0, n = 0;
  for (let d = 4; d <= len - 4; d += 2) {
    const x = s0.x + (s1.x - s0.x) * d / len, y = s0.y + (s1.y - s0.y) * d / len;
    let best = 255;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const i = (Math.round((y + dy) * sy) * img.width + Math.round((x + dx) * sx)) * 4;
      best = Math.min(best, (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3);
    }
    n += 1;
    if (best < 190) dark += 1;
  }
  return { n, dark };
}, [a, b]);

test('the pane says what is waiting: the count on the key, the newest first, each with a drawing of itself', async ({ page }) => {
  await openFile(page, library());
  // NOTHING YET, and the key says so and says how to fill it.
  await expect(trayKey(page)).toHaveText('SNAPSHOTS (0)');
  await openTray(page);
  await expect(page.locator('[data-snapshot-tray-empty]')).toContainText('DETAIL SNAPSHOT');
  await expect(page.locator('[data-snapshot-tray-empty]')).toContainText('elevation or a section');
  await trayKey(page).click();

  await fileKnown(page);
  await fileKnown(page, { id: 'snap-later', name: 'E1 SNAPSHOT', cut: 'E1', kind: 'elevation',
    takenAt: '2026-11-20T16:00:00.000Z' });
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(trayKey(page)).toHaveText('SNAPSHOTS (2)');
  await openTray(page);
  const rows = page.locator('[data-snapshot-tray] [data-snapshot]');
  await expect(rows).toHaveCount(2);
  expect(await rows.evaluateAll(els => els.map(el => el.dataset.snapshot)),
    'the one just taken is on top').toEqual(['snap-later', 'snap-known']);
  await expect(rows.nth(0)).toContainText('E1 SNAPSHOT');
  await expect(rows.nth(1)).toContainText('S1 SNAPSHOT');
  await expect(rows.nth(1)).toContainText('8\'-0" x 6\'-0"');
  // THE DRAWING OF IT IS DRAWN. Counted off the chip's own pixels: the three
  // lines of this picture, fitted to it -- the long one most of its width.
  const thumb = page.locator('[data-snapshot-thumb="snap-known"]');
  await expect(thumb).toHaveAttribute('data-snapshot-thumb-lines', '3');
  const ink = await thumb.evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let x0 = Infinity, x1 = -Infinity, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 60) { const x = (i / 4) % c.width; x0 = Math.min(x0, x); x1 = Math.max(x1, x); n += 1; }
    }
    return { n, span: (x1 - x0) / c.width };
  });
  expect(ink.n, 'ink on the chip').toBeGreaterThan(30);
  expect(ink.span, 'the line across the box runs most of the chip').toBeGreaterThan(0.75);
});

test('USE makes a detail of it: named for the view, framed to the box, its lines the file\'s own, full size and the right way up', async ({ page }) => {
  await openFile(page, library());
  await fileKnown(page);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openTray(page);
  await page.locator('[data-snapshot-use="snap-known"]').click();

  // THE NEW DETAIL IS THE ONE BEING DRAWN, under the picture's name.
  const active = page.locator('[data-detail][data-active]');
  await expect(active).toContainText('S1 SNAPSHOT');
  await expect(page.locator('#strip-message')).toContainText('a new detail from the snapshot');
  await expect(page.locator('#strip-message')).toContainText('3 lines');
  // AND HE IS STOOD IN ITS WINDOW, not left behind the board a library
  // opens on, where a new detail cannot be seen or drawn on.
  await expect(page.locator('[data-details-board]')).toBeHidden();

  const file = await saved(page);
  const shelf = file.boneyardShelves.find(s => s.name === 'S1 SNAPSHOT');
  expect(shelf, 'the detail is in the saved file').toBeTruthy();
  // FRAMED TO THE BOX THAT WAS DRAGGED, in feet.
  expect([shelf.detail.frameW, shelf.detail.frameH], 'its frame is the box').toEqual([8, 6]);
  expect(shelf.detail.note, 'and its card says where it came from').toContain('snapshot of S1');
  // THE LINES, IN FEET, Z DOWN. Twenty-four inches across the middle is two
  // feet; a foot UP the picture is a foot up the sheet, which is z = -1; the
  // line two feet BELOW the middle is at z = +2 and runs the frame's width.
  expect(linesOf(file, shelf.id)).toEqual(['-1 0 1 0', '-4 2 4 2', '0 -1 0 0']);
  const mine = file.lines.filter(l => l.levelId === -shelf.id);
  expect(new Set(mine.map(l => l.layer)), 'on a layer of their own').toEqual(new Set(['SNAPSHOT']));
  // NOT ONE ASSEMBLY: they are there to be worked on a line at a time.
  expect((file.groups || []).length, 'no group was made of them').toBe(0);
  // ITS WORD, as a note where it stood: three feet left of the middle, two up.
  const note = (file.notes || []).find(n => n.levelId === -shelf.id);
  expect(note && note.body, 'the picture\'s word came as a note').toBe('2x10 JOIST');
  expect([Math.round(note.anchor.x * 100) / 100, Math.round(note.anchor.z * 100) / 100]).toEqual([-3, -2]);
  expect(Math.round(note.heightFt * 1000) / 1000, 'lettered three inches high').toBe(0.25);
  // THE DETAIL THAT WAS THERE IS UNTOUCHED.
  expect(linesOf(file, 1), 'the first detail keeps its own line and gains none').toEqual(['-1 0 1 0']);

  // AND ON THE SHEET, measured off the canvas: ink along the long line, and
  // none a foot under it, where the picture has nothing.
  const on = await inkAlong(page, { x: -4, z: 2 }, { x: 4, z: 2 });
  const off = await inkAlong(page, { x: -4, z: 2.6 }, { x: 4, z: 2.6 });
  expect(on.n, 'a line long enough to measure').toBeGreaterThan(40);
  expect(on.dark / on.n, 'the line is drawn where the file has it').toBeGreaterThan(0.9);
  expect(off.dark / off.n, 'and not where it is not').toBeLessThan(0.05);
});

test('the lines are his to edit: one is picked and deleted, the others stay, and UNDO brings it back', async ({ page }) => {
  await openFile(page, library());
  await fileKnown(page);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openTray(page);
  await page.locator('[data-snapshot-use="snap-known"]').click();
  await expect(page.locator('[data-detail][data-active]')).toContainText('S1 SNAPSHOT');
  // A PRESS ON THE LONG LINE, with the resting tool: it is a line like any
  // other he drew, so it is picked.
  const at = await page.evaluate(() => {
    const r = document.getElementById('plan').getBoundingClientRect();
    const s = toS({ x: 2.5, z: 2 });
    return { x: r.left + s.x, y: r.top + s.y };
  });
  await page.mouse.click(at.x, at.y);
  await page.keyboard.press('Delete');
  let file = await saved(page);
  const shelf = file.boneyardShelves.find(s => s.name === 'S1 SNAPSHOT');
  expect(linesOf(file, shelf.id), 'the long line is gone, the other two are not').toEqual(['-1 0 1 0', '0 -1 0 0']);
  await page.keyboard.press('Control+z');
  file = await saved(page);
  expect(linesOf(file, shelf.id), 'and one UNDO puts it back').toEqual(['-1 0 1 0', '-4 2 4 2', '0 -1 0 0']);
  // AND THE NEXT UNDO TAKES THE PICTURE'S LINES BACK OUT, all of them at
  // once: bringing them in was one act, and is one to take back.
  await page.keyboard.press('Control+z');
  file = await saved(page);
  expect(linesOf(file, shelf.id), 'one UNDO for the whole picture').toEqual([]);
  expect((file.notes || []).filter(n => n.levelId === -shelf.id).length, 'its note with it').toBe(0);
  expect(linesOf(file, 1), 'and nothing of the detail beside it').toEqual(['-1 0 1 0']);
});

test('the picture stays in the tray: a second detail from it takes its own name, and X throws it away', async ({ page }) => {
  await openFile(page, library());
  await fileKnown(page);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openTray(page);
  await page.locator('[data-snapshot-use="snap-known"]').click();
  await expect(page.locator('[data-detail][data-active]')).toContainText('S1 SNAPSHOT');
  await expect(trayKey(page), 'still waiting after it was used').toHaveText('SNAPSHOTS (1)');
  await openTray(page);
  await page.locator('[data-snapshot-use="snap-known"]').click();
  await expect(page.locator('[data-detail][data-active]')).toContainText('S1 SNAPSHOT 2');
  const file = await saved(page);
  expect(file.boneyardShelves.map(s => s.name)).toEqual(['TYP. STRIP FOOTING', 'S1 SNAPSHOT', 'S1 SNAPSHOT 2']);
  const second = file.boneyardShelves[2];
  expect(linesOf(file, second.id), 'and its own copy of the lines').toEqual(['-1 0 1 0', '-4 2 4 2', '0 -1 0 0']);
  // X: out of the tray, in the store and on the key.
  await openTray(page);
  await page.locator('[data-snapshot-drop="snap-known"]').click();
  await expect(trayKey(page)).toHaveText('SNAPSHOTS (0)');
  expect(await page.evaluate(async () => (await window.DraftDetailSnapshot.list()).length),
    'and out of the store').toBe(0);
  // THE DETAILS MADE FROM IT ARE NOT ITS TO TAKE BACK.
  const after = await saved(page);
  expect(linesOf(after, second.id)).toEqual(['-1 0 1 0', '-4 2 4 2', '0 -1 0 0']);
});

test('a picture taken in another tab arrives without a reload', async ({ page, context }) => {
  await openFile(page, library());
  await expect(trayKey(page)).toHaveText('SNAPSHOTS (0)');
  // THE OTHER TAB: the house's file, where the camera is.
  const other = await context.newPage();
  await other.goto('/MODEL.html');
  await other.waitForFunction(() => !!window.DraftDetailSnapshot && !!window.DraftDxfWriter);
  await fileKnown(other);
  await expect(trayKey(page), 'the library heard about it').toHaveText('SNAPSHOTS (1)');
  await openTray(page);
  await expect(page.locator('[data-snapshot="snap-known"]')).toContainText('S1 SNAPSHOT');
  await other.close();
});

test('end to end: a box dragged on a house\'s elevation becomes a detail holding that box\'s lines', async ({ page }) => {
  const HOUSE = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'proto', 'repro-jb-fdn-tee.draft'), 'utf8'));
  await openFile(page, HOUSE, '?theme=rough&mode=day&level=3&lpane=drafting&left=1&view=cut%3AE1');
  await page.waitForFunction(() => !!window.__elevFrame);
  await h.armFromRail(page, 'snapshot');
  // The front gable, on the open part of the view: a box 180 px by 150.
  const box = await page.evaluate(() => {
    const f = window.__elevFrame;
    const r = document.getElementById('plan').getBoundingClientRect();
    const ink = elevInkFeet().flatMap(s => [s.a, s.b]);
    const u = (Math.min(...ink.map(p => p.u)) + Math.max(...ink.map(p => p.u))) / 2;
    const e = (Math.min(...ink.map(p => p.e)) + Math.max(...ink.map(p => p.e))) / 2;
    return { x: Math.round(r.left + f.x0 + (u - f.uMin) * f.pxPerFt), y: Math.round(r.top + f.y0 + (f.yTop - e) * f.pxPerFt),
      pxPerFt: f.pxPerFt };
  });
  await page.mouse.move(box.x - 90, box.y - 75);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y, { steps: 4 });
  await page.mouse.move(box.x + 90, box.y + 75, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#strip-message')).toContainText('In the snapshot tray (1)');
  await expect(page.locator('#strip-message'), 'and it says where the picture goes next')
    .toContainText('DETAILS LIBRARY');
  const picture = await page.evaluate(async () => {
    const [rec] = await window.DraftDetailSnapshot.list();
    const geo = window.DraftDxfReader.parse(rec.dxf, { segments: true });
    return { id: rec.id, widthFt: rec.widthFt, heightFt: rec.heightFt,
      segs: geo.segments.map(s => [s.a[0] / 12, -s.a[1] / 12, s.b[0] / 12, -s.b[1] / 12]) };
  });
  expect(picture.widthFt, 'a 180 px box, in feet').toBeCloseTo(180 / box.pxPerFt, 3);

  // THE LIBRARY, in the same browser: the tray is what the two files share.
  await openFile(page, library());
  await expect(trayKey(page)).toHaveText('SNAPSHOTS (1)');
  await openTray(page);
  await page.locator(`[data-snapshot-use="${picture.id}"]`).click();
  await expect(page.locator('[data-detail][data-active]')).toContainText('E1 SNAPSHOT');
  const file = await saved(page);
  const shelf = file.boneyardShelves.find(s => s.name === 'E1 SNAPSHOT');
  // THE FRAME HOLDS THE BOX: the box's size, up to the quarter inch a frame
  // is kept to, and never under it.
  expect(shelf.detail.frameW).toBeGreaterThanOrEqual(picture.widthFt - 1e-6);
  expect(shelf.detail.frameW - picture.widthFt).toBeLessThan(1 / 48 + 1e-6);
  expect(shelf.detail.frameH).toBeGreaterThanOrEqual(picture.heightFt - 1e-6);
  // EVERY LINE OF THE PICTURE IS A LINE OF THE DETAIL, in feet, where it was.
  const mine = file.lines.filter(l => l.levelId === -shelf.id);
  expect(mine.length, 'as many lines as the picture has').toBe(picture.segs.length);
  expect(mine.length).toBeGreaterThan(10);
  const near = (a, b) => Math.abs(a - b) < 1e-4;
  const lost = picture.segs.filter(([x0, z0, x1, z1]) => !mine.some(l =>
    (near(l.start.x, x0) && near(l.start.z, z0) && near(l.end.x, x1) && near(l.end.z, z1))
    || (near(l.start.x, x1) && near(l.start.z, z1) && near(l.end.x, x0) && near(l.end.z, z0))));
  expect(lost, 'none of them missing or moved').toEqual([]);
  // AND ALL OF THEM INSIDE THE FRAME.
  mine.forEach(l => [l.start, l.end].forEach(p => {
    expect(Math.abs(p.x)).toBeLessThanOrEqual(shelf.detail.frameW / 2 + 1e-6);
    expect(Math.abs(p.z)).toBeLessThanOrEqual(shelf.detail.frameH / 2 + 1e-6);
  }));
});
