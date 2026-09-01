// WHERE A COORDINATE IS MEASURED FROM, AND WHAT IT MAY LAND ON (board NEW-5).
//
// Part 1: a free node lands on the project's own increment — a sixteenth of an
// inch on an imperial project, a millimetre on a metric one. Before this, a
// node landed on a free real, so a wall could sit at 12.0001' while its
// dimension printed 12'-0"; the partials then failed to sum to the overall and
// the only way to make the numbers agree was to nudge the wall by a
// sixty-fourth that existed nowhere on screen. The discrepancy was in the
// rounding, not the drawing.
//
// The snap is at `_snap`, which is the FREE-point path only. A caught node, a
// midpoint or a point projected onto a locked ray returns earlier and comes
// back exactly as before — those are already on real geometry, and rounding
// them would break the alignment they exist to provide.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A sixteenth of an inch, in feet. 12 in/ft x 16 = 192.
const SIXTEENTH_FT = 1 / 192;
const MM_FT = 0.001 / 0.3048;

const offGrid = (value, step) => {
  const n = value / step;
  return Math.abs(n - Math.round(n));
};
// Every coordinate a drawing stores for its own geometry.
const coords = drawing => [
  ...(drawing.lines || []).flatMap(l => [l.start, l.end]),
  ...(drawing.walls || []).flatMap(w => [w.start, w.end]),
  ...(drawing.boneyardOutlines || []).flatMap(o => o.points || []),
].flatMap(p => [p.x, p.z]);

test('a free node lands on a sixteenth, so the printed number and the drawing agree', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  // Deliberately awkward: nowhere near the origin, and not a round number, so
  // nothing else in the snap path can be credited with the result.
  await h.clickWorld(page, -7.3137, 4.8291);
  await h.clickWorld(page, 9.1719, -3.4157);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const stored = coords(await h.savedDrawing(page));
  expect(stored.length).toBeGreaterThan(0);
  const worst = Math.max(...stored.map(v => offGrid(v, SIXTEENTH_FT)));
  expect(worst).toBeLessThan(1e-6);
});

// ── Part 2: the origin floats to the first node placed ──
// "No origin yet" is a real state, not an empty value: an untouched model
// space measures from nothing, so it shows no grid and no target. The first
// node placed sets the datum, and the drawing carries it, so a reopened file
// keeps the grid it was drawn on.

const origin = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()).drawingOrigin : undefined;
}, h.STORAGE_BUCKET);

// Grid ink on the overlay: the faint greys the grid is drawn in, and nothing
// else on the sheet uses them. Counting them is how "no grid" is observed —
// the stored datum cannot be, because an untouched drawing has nothing to save.
const gridInk = page => page.evaluate(() => {
  const c = document.querySelector('[data-model-overlay]');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r === g && g === b && r >= 0xaa && r <= 0xe8) n += 1;
  }
  return n;
});

test('an untouched model space draws no grid, and the first node sets the datum', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  // Nothing placed: nothing to measure from, so no grid on the sheet.
  expect(await gridInk(page)).toBe(0);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 5.5, -3.25);
  await h.clickWorld(page, 12, -3.25);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // The grid appears, counted from the node just placed.
  expect(await gridInk(page)).toBeGreaterThan(0);
  const datum = await origin(page);
  expect(datum).not.toBeNull();
  expect(Math.hypot(datum.x, datum.z)).toBeGreaterThan(1);   // not the world's 0,0
  const first = (await h.savedDrawing(page)).lines[0].start;
  expect(datum.x).toBeCloseTo(first.x, 6);
  expect(datum.z).toBeCloseTo(first.z, 6);
});

test('the datum survives a reload, so the grid lands where it did', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -4.75, 6.5);
  await h.clickWorld(page, 3, 6.5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const before = await origin(page);

  await page.reload();
  await h.waitForModelReady(page);
  expect(await origin(page)).toEqual(before);
});

test('NEW puts the drawing back to measuring from nothing', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 2, 2);
  await h.clickWorld(page, 8, 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  expect(await origin(page)).not.toBeNull();

  await page.getByRole('button', { name: 'NEW', exact: true }).click();
  const dontSave = page.getByRole('button', { name: "DON'T SAVE" });
  if (await dontSave.count()) await dontSave.click();
  await h.waitForSaved(page);
  expect(await origin(page)).toBeNull();
});

test('a drawing saved before this board opens on the world grid, unchanged', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 6, -5);
  await h.clickWorld(page, 14, -5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const before = (await h.savedDrawing(page)).lines.map(l => [l.start.x, l.start.z, l.end.x, l.end.z]);

  // Strip the key the way an older file has it — ABSENT, not null. Absent
  // means the drawing was made on the world grid, so it must open measuring
  // from 0,0 with every coordinate exactly where it was.
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const saved = JSON.parse(await file.text());
    delete saved.drawingOrigin;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, h.STORAGE_BUCKET);
  await page.reload();
  await h.waitForModelReady(page);

  // Nothing moved ...
  const after = (await h.savedDrawing(page)).lines.map(l => [l.start.x, l.start.z, l.end.x, l.end.z]);
  expect(after).toEqual(before);
  // ... and the datum read as 0,0 rather than being claimed by the next node,
  // which is the only way to observe how an absent key was normalised.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -9, 7);
  await h.clickWorld(page, -2, 7);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  expect(await origin(page)).toEqual({ x: 0, z: 0 });
});

// ── Part 3, scoped: the field exists, nothing reads it yet ──
// The site plan has no painter, so a target could not move anything and none
// is drawn. The FORMAT field is the part that is expensive to add later —
// every drawing saved between now and then would lack it — so it is carried
// now and the UI waits. These pin the round-trip, not a feature.
test('the site registration round-trips, and defaults to unregistered', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 3, 3);
  await h.clickWorld(page, 9, 3);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Every drawing that exists today is unregistered, and says so.
  const read = async () => page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text()).siteRegistration;
  }, h.STORAGE_BUCKET);
  expect(await read()).toBeNull();

  // A registration written into the file survives a reload with its angle.
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const saved = JSON.parse(await file.text());
    saved.siteRegistration = { x: 40.5, z: -12.25, angleRad: 0.5235987755982988 };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, h.STORAGE_BUCKET);
  await page.reload();
  await h.waitForModelReady(page);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -6, 8);
  await h.clickWorld(page, -1, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const back = await read();
  expect(back.x).toBeCloseTo(40.5, 6);
  expect(back.z).toBeCloseTo(-12.25, 6);
  expect(back.angleRad).toBeCloseTo(0.5235987755982988, 9);   // 30°, kept
});
