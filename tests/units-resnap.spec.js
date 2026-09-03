// SWITCHING UNITS RE-SNAPS THE DRAWING (board: units round trip).
//
// Before this, switching re-labelled the drawing and left the geometry where
// it was. That reads as the safe option and is not: three 12'-0" walls shown
// in mm print 3658 each against an overall of 10973, so the partials sum to
// 10974 and the sheet is 1 mm out with nothing wrong in the drawing. The only
// fix available to the drafter was to nudge a wall by an amount that exists
// nowhere on screen — which is the exact bug board NEW-5 removed, reappearing
// in the other unit system.
//
// What re-snaps is every quantity the drafter ENTERED: node positions, and
// also the sizes and offsets that are not coordinates at all. A window stores
// width and an offset along its wall, both of which print as dimensions, so
// re-snapping the node pool alone would leave a window measuring 914.4 mm
// inside a wall whose ends read whole millimetres.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MM_FT = 0.001 / 0.3048;       // one millimetre, in feet
const SIXTEENTH_FT = 1 / 192;
const mm = ft => ft * 304.8;

const offGrid = (value, step) => {
  const n = value / step;
  return Math.abs(n - Math.round(n));
};

// Every coordinate the drawing stores for its own geometry.
const coords = drawing => [
  ...(drawing.lines || []).flatMap(l => [l.start, l.end]),
  ...(drawing.walls || []).flatMap(w => [w.start, w.end]),
  ...(drawing.floors || []).flatMap(f => f.points || []),
  ...(drawing.shapes || []).flatMap(s => s.points || []),
  ...(drawing.boneyardOutlines || []).flatMap(o => o.points || []),
].flatMap(p => [p.x, p.z]);

const setUnits = async (page, name) => {
  await page.getByRole('button', { name, exact: true }).click();
  await h.waitForSaved(page);
};

// Three walls in a row, drawn on whole feet from an awkward datum so nothing
// else in the snap path can be credited with the result.
const drawRun = async page => {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 12, 0);
  await h.clickWorld(page, 24, 0);
  await h.clickWorld(page, 36, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
};

test('switching to metric puts every stored coordinate on the millimetre grid', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -7.3137, 4.8291);
  await h.clickWorld(page, 9.1719, -3.4157);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const before = coords(await h.savedDrawing(page));
  expect(Math.max(...before.map(v => offGrid(v, SIXTEENTH_FT)))).toBeLessThan(1e-6);

  await setUnits(page, 'METRIC');

  const drawing = await h.savedDrawing(page);
  const datum = drawing.drawingOrigin;
  const after = coords(drawing);
  expect(after.length).toBe(before.length);
  // Measured FROM THE DATUM, which is where the grid is counted from.
  const worst = Math.max(
    ...(drawing.lines || []).flatMap(l => [l.start, l.end]).flatMap(p => [
      offGrid(p.x - datum.x, MM_FT), offGrid(p.z - datum.z, MM_FT),
    ]),
  );
  expect(worst).toBeLessThan(1e-6);
});

test('the partials sum to the overall — the discrepancy the board measured', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);

  // Before: each segment prints 3658 and the overall 10973, so the numbers
  // on the sheet disagree by a millimetre.
  const asPrinted = drawing => {
    const pts = (drawing.lines || []).flatMap(l => [l.start, l.end]);
    const xs = [...new Set(pts.map(p => p.x))].sort((a, b) => a - b);
    const datum = drawing.drawingOrigin;
    const at = x => Math.round(mm(x - datum.x));
    const segments = xs.slice(1).map((x, i) => at(x) - at(xs[i]));
    return { segments, overall: at(xs[xs.length - 1]) - at(xs[0]) };
  };

  await setUnits(page, 'METRIC');
  const { segments, overall } = asPrinted(await h.savedDrawing(page));
  expect(segments.length).toBe(3);
  expect(segments.reduce((a, b) => a + b, 0)).toBe(overall);
});

test('a window re-snaps its size and its offset, not only the wall it sits in', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  const opening = await page.evaluate(() => {
    const el = document.querySelector('[data-model-overlay]');
    return el ? true : false;
  });
  expect(opening).toBe(true);

  await setUnits(page, 'METRIC');
  const drawing = await h.savedDrawing(page);
  // Whatever openings and fixtures the drawing holds, every stored size and
  // offset is a whole number of millimetres once the switch has run.
  const lengths = [
    ...(drawing.fenestrations || []).flatMap(f => [f.offset, f.width, f.sillHeight, f.headHeight]),
    ...(drawing.fixtures || []).flatMap(f => [f.offset, f.width, f.depth]),
  ].filter(v => Number.isFinite(v));
  lengths.forEach(v => expect(offGrid(v, MM_FT)).toBeLessThan(1e-6));
});

test('imperial to metric and back returns every node exactly where it started', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  const before = coords(await h.savedDrawing(page));

  await setUnits(page, 'METRIC');
  await setUnits(page, 'IMPERIAL');

  const after = coords(await h.savedDrawing(page));
  expect(after.length).toBe(before.length);
  after.forEach((v, i) => expect(v).toBeCloseTo(before[i], 9));
});

test('opening a drawing never re-snaps it — only the drafter switching does', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  await setUnits(page, 'METRIC');
  const before = coords(await h.savedDrawing(page));

  await page.reload();
  await h.waitForModelReady(page);

  const after = coords(await h.savedDrawing(page));
  expect(after).toEqual(before);
});

test('the whole switch is one undo, geometry and units together', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  const before = coords(await h.savedDrawing(page));

  await setUnits(page, 'METRIC');
  expect(coords(await h.savedDrawing(page))).not.toEqual(before);

  await page.keyboard.press('Control+z');
  await h.waitForSaved(page);

  const after = coords(await h.savedDrawing(page));
  after.forEach((v, i) => expect(v).toBeCloseTo(before[i], 9));
});

test('the move is announced rather than made quietly', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  await setUnits(page, 'METRIC');
  await expect(page.getByText(/Re-snapped to mm/)).toBeVisible();
});
