// DIMENSION FIGURES SIZED OFF THE SHEET (Movie, 25 Oct).
//
// "the dimension text is pretty small. can we make it so it stays a standard
// size" -- "see the background drawing, it would be nice if the dimension
// text was approx that size" -- and, choosing, "lock it in with the layout
// scale if possible ... maybe have a secondary method to change the scale
// (not linked to the layout view)". So: a figure is 1/8" printed at the
// level's LAYOUT scale, a size in feet on the plan that grows and shrinks
// with the walls; never under 7px; DIM SCALE beside AUTO DIMS / HAND DIMS
// overrides the sheet for this level and is kept in the file.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const DIM = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', auto: false, layer: 'A-DIMS-HAND' });
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 40,
  walls: [W('w1', [0, 0], [30, 0]), W('w2', [30, 0], [30, 20])], lines: [], floors: [], roofs: [],
  fenestrations: [], dimensions: [DIM(31, [0, -3], [30, -3])],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
// The level also sits at 1" = 30' on sheet 1 beside the site plan, as his
// sheet sets deal it; the working scale is the one that counts.
const sheetAt = pif => ({ layout: { viewports: [
  { id: 1, kind: 'plan', levelId: 3, pif: 1 / 30, sheet: 1, xIn: 2, yIn: 2 },
  { id: 2, kind: 'plan', levelId: 3, pif, sheet: 2, xIn: 2, yIn: 2 },
], nextViewportId: 3 } });

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// The figure's font, in px, as one paint at `scale` px a foot draws it.
async function figurePx(page, scale) {
  return page.evaluate(s => {
    const proto = CanvasRenderingContext2D.prototype;
    const real = proto.fillText;
    const fonts = [];
    proto.fillText = function (text, ...rest) {
      if (/^30'/.test(String(text))) fonts.push(this.font);
      return real.call(this, text, ...rest);
    };
    try {
      view.scale = s;
      paint();
    } finally { proto.fillText = real; }
    const m = /([\d.]+)px/.exec(fonts[0] || '');
    return m ? Number(m[1]) : null;
  }, scale);
}

test('1/8" printed at the level\'s most detailed LAYOUT scale: grows with the zoom, follows the sheet, never under 7px', async ({ page }) => {
  await open(page, drawing(sheetAt(1 / 4)));
  // 1/8" at 1/4" = 1' is 6" of building: half a foot, 1.4 em to the cap.
  expect(await figurePx(page, 20)).toBeCloseTo(0.5 * 20 * 1.4, 1);
  expect(await figurePx(page, 40)).toBeCloseTo(0.5 * 40 * 1.4, 1);
  // Zoomed right out it stops at 7px.
  expect(await figurePx(page, 2)).toBeCloseTo(7, 1);
});

test('a 1/8" sheet doubles the figure; no sheet reads 1/4"', async ({ page }) => {
  await open(page, drawing(sheetAt(1 / 8)));
  expect(await figurePx(page, 20)).toBeCloseTo(1 * 20 * 1.4, 1);
  await open(page, drawing());
  expect(await figurePx(page, 20)).toBeCloseTo(0.5 * 20 * 1.4, 1);
});

test('DIM SCALE beside HAND DIMS: names the sheet, overrides it on this level, is kept in the file, and LAYOUT again lets go', async ({ page }) => {
  await open(page, drawing(sheetAt(1 / 4)));
  const pick = page.locator('[data-dim-scale]');
  await expect(pick).toBeVisible();
  await expect(pick.locator('option').first()).toHaveText('DIM: LAYOUT 1/4"');
  await pick.selectOption({ label: 'DIM 1/2"' });
  expect(await figurePx(page, 20)).toBeCloseTo(0.25 * 20 * 1.4, 1);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).dimScales).toEqual({ 3: 0.5 });
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-dim-scale]')).toHaveValue('0.5');
  expect(await figurePx(page, 20)).toBeCloseTo(0.25 * 20 * 1.4, 1);
  await page.locator('[data-dim-scale]').selectOption({ index: 0 });
  expect(await figurePx(page, 20)).toBeCloseTo(0.5 * 20 * 1.4, 1);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).dimScales).toEqual({});
});
