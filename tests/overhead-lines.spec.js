// THE CANTILEVER ABOVE AND THE ROOF OVERHANG ON A WALLS PLAN (Movie, 16
// Oct, MAIN FL PLAN sheet 7): "a cantilever of the floor above and a roof
// overhang, drawn dashed and lighter ... A floor shows only what sits
// DIRECTLY over it: on a 2-storey the 2ND FL shows the roof overhang; MAIN
// shows the 2nd floor's cantilevers and any roof covering main-floor area
// (lower roof over a one-storey wing, garage roof, porch roof). Nothing two
// storeys up."
//
// THE CLIPPING IS overhead-lines.js's (proto/overhead-lines-harness.js), the
// painter render-2d's and the sheet's seam layout-plan's. What this pins is
// MODEL's seam and the dealt sheets', on the attached-garage repro with its
// 2nd floor pushed 2' past the front wall: MAIN FL's walls plan hangs that
// cantilever and the garage roof, the 2ND FL's the main roof, the floor
// layout nothing.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
REPRO.outlines.find(o => o.id === 'outline-15').points = [
  { x: -16, y: 0, z: -22 }, { x: 16, y: 0, z: -22 }, { x: 16, y: 0, z: 20 }, { x: -16, y: 0, z: 20 }];
// MAIN FL: the cantilever's front edge and two ends (3) and the garage roof's
// two sides, back and two gable ends (5). 2ND FL: the main roof's eight
// edges, its front edge cut in two where it runs along the pushed front
// wall (that 32' is the plate, not an overhang) -- nine.
const MAIN_SEGS = 8, UPPER_SEGS = 9;

// THE TAPE: every stroke with the dash it was made under; the overhead lines
// are the one [6,4]-dashed stroke at alpha 0.5 on a plan with no kitchen.
const spy = page => page.evaluate(() => {
  const proto = CanvasRenderingContext2D.prototype;
  window.__tape = [];
  const setLineDash = proto.setLineDash;
  proto.setLineDash = function (dash) { this.__dash = Array.from(dash || []); return setLineDash.call(this, dash); };
  const stroke = proto.stroke;
  proto.stroke = function (...args) {
    window.__tape.push({ op: 'stroke', canvas: this.canvas && this.canvas.id, dash: this.__dash || [], alpha: this.globalAlpha });
    return stroke.apply(this, args);
  };
  const clearRect = proto.clearRect;
  proto.clearRect = function (...args) {
    window.__tape.push({ op: 'clear', canvas: this.canvas && this.canvas.id });
    return clearRect.apply(this, args);
  };
});
const dashedLighter = (page, canvasId) => page.evaluate(id => {
  const mine = (window.__tape || []).filter(e => e.canvas === id);
  let start = 0;
  mine.forEach((e, i) => { if (e.op === 'clear') start = i; });
  return mine.slice(start).filter(e => e.op === 'stroke' && e.dash.length === 2 && e.dash[0] === 6 && e.dash[1] === 4
    && Math.abs(e.alpha - 0.5) < 0.01).length;
}, canvasId);

test('MODEL: the walls plan hangs the cantilever above and the roof over it; the floor layout nothing', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: REPRO });
  await page.goto('/MODEL.html?right=1&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await spy(page);
  await h.pickModelLayer(page, 3, 'plan');
  await page.waitForTimeout(300);
  await expect(page.locator('#plan'), 'MAIN FL: the cantilever (3) and the garage roof (5)')
    .toHaveAttribute('data-overhead-lines', String(MAIN_SEGS));
  expect(await dashedLighter(page, 'plan'), 'stroked dashed and lighter, one stroke for the lot').toBe(1);
  await h.pickModelLayer(page, 3, 'floor');
  await page.waitForTimeout(300);
  await expect(page.locator('#plan'), 'the floor layout hangs nothing').toHaveAttribute('data-overhead-lines', '0');
  expect(await dashedLighter(page, 'plan'), 'and strokes nothing dashed').toBe(0);
  await page.goto('/MODEL.html?right=1&level=5');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.pickModelLayer(page, 5, 'plan');
  await page.waitForTimeout(300);
  await expect(page.locator('#plan'), '2ND FL: the main roof all round, not the garage roof')
    .toHaveAttribute('data-overhead-lines', String(UPPER_SEGS));
});

test('LAYOUT: the dealt MAIN FL PLAN and 2ND FL PLAN sheets hang their overhead lines; the MAIN FLOOR layout none', async ({ page }) => {
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
    return dashedLighter(page, 'lay-canvas');
  };
  // THE SHEET PAINTS ITSELF TWICE WITHIN ONE CLEAR: some, and none.
  expect(await sheetOf('MAIN FL PLAN'), 'MAIN FL PLAN hangs the cantilever and the garage roof').toBeGreaterThanOrEqual(1);
  expect(await sheetOf('2ND FL PLAN'), '2ND FL PLAN hangs the main roof').toBeGreaterThanOrEqual(1);
  expect(await sheetOf('MAIN FLOOR'), 'the floor layout hangs nothing').toBe(0);
});
