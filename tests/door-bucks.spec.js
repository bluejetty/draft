// THE DOOR BUCKS ON A GARAGE'S FOUNDATION PLAN (Movie, 16 Oct): "DOOR BUCKS
// at the man door and each garage door, 2" wider than the door each side; no
// width dimension on the buck; buck areas in a lighter weight; the slab pours
// through the buck in the slab's light blue. The inside edge of the door buck,
// below the slab, is a lighter line."
//
// THE ARITHMETIC IS door-bucks.js's (proto/door-bucks-harness.js) and the
// painter render-2d's (proto/render-2d-harness.js); layout-plan's seam is in
// proto/layout-plan-harness.js. What this pins is MODEL's seam -- the
// foundation view cuts the bucks and the basement plan does not -- and the
// dealt FOUNDATION sheet doing the same, on the attached-garage repro that
// has both doors he named.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));

test('MODEL: the FOUNDATION view cuts a buck at the man door and the overhead door, the basement plan none', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: REPRO });
  await page.goto('/MODEL.html?right=1&level=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.pickModelLayer(page, 1, 'foundation');
  await page.waitForTimeout(300);
  await expect(page.locator('#plan'), 'two bucks: the man door and the 16 ft overhead door')
    .toHaveAttribute('data-door-bucks', '2');
  await h.pickModelLayer(page, 1, 'plan');
  await page.waitForTimeout(300);
  await expect(page.locator('#plan'), 'the basement plan is not the pour').toHaveAttribute('data-door-bucks', '0');
});

// THE SHEET: the inside face's lighter line (alpha 0.4) is the buck's own
// mark on the canvas -- nothing else on a foundation sheet strokes at it.
const spy = page => page.evaluate(() => {
  const proto = CanvasRenderingContext2D.prototype;
  window.__tape = [];
  const stroke = proto.stroke;
  proto.stroke = function (...args) {
    window.__tape.push({ op: 'stroke', canvas: this.canvas && this.canvas.id, alpha: this.globalAlpha });
    return stroke.apply(this, args);
  };
  const clearRect = proto.clearRect;
  proto.clearRect = function (...args) {
    window.__tape.push({ op: 'clear', canvas: this.canvas && this.canvas.id });
    return clearRect.apply(this, args);
  };
});
const lighterStrokes = page => page.evaluate(() => {
  const mine = (window.__tape || []).filter(e => e.canvas === 'lay-canvas');
  let start = 0;
  mine.forEach((e, i) => { if (e.op === 'clear') start = i; });
  return mine.slice(start).filter(e => e.op === 'stroke' && Math.abs(e.alpha - 0.4) < 0.01).length;
});

test('LAYOUT: the dealt FOUNDATION sheet cuts the same two bucks, and the MAIN FL PLAN none', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: { ...REPRO, layout: { auto: true } } });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
  const layout = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()).layout : null;
  }, BUCKET);
  const sheetOf = async title => {
    const sheet = layout.sheets.findIndex(s => s.title === title) + 1;
    expect(sheet, `the ${title} sheet was dealt`).toBeGreaterThan(0);
    await spy(page);
    await page.locator(`[data-layout-sheet="${sheet}"]`).click();
    await page.waitForTimeout(400);
    return lighterStrokes(page);
  };
  // THE SHEET PAINTS ITSELF TWICE WITHIN ONE CLEAR, so two bucks read as two
  // or four lighter lines; what matters is some and an even pair, and none
  // on the walls plan.
  const fdn = await sheetOf('FOUNDATION');
  expect(fdn, 'the FOUNDATION sheet strokes the bucks\' inside faces lighter').toBeGreaterThanOrEqual(2);
  expect(fdn % 2, 'two bucks, however many paints').toBe(0);
  expect(await sheetOf('MAIN FL PLAN'), 'the walls plan cuts none').toBe(0);
});
