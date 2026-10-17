// THE OVERHEAD CONVENTION ON PLAN VIEWS (Movie, 16 Oct, MAIN FL PLAN sheet
// 7): "anything above the cut is drawn lighter weight with a dash-dot line --
// the beam in the floor system above (or dropped) on the floor it is over
// (columns already shown); upper kitchen cabinets ... Beams dash-dot;
// cantilevers, overhangs and uppers dashed."
//
// THE PAINTERS ARE render-2d's (proto/render-2d-harness.js) and the sheet's
// seam layout-plan's (proto/layout-plan-harness.js). What this pins is
// MODEL's seam -- the walls plan borrows the beam its level carries and
// hangs the uppers, the floor layout does not -- and the dealt MAIN FL PLAN
// sheet doing the same, on the attached-garage repro with a kitchen added
// along its back wall.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
// NO ROOFS: the garage roof's overhang is drawn on this same walls plan with
// the uppers' dash (tests/overhead-lines.spec.js pins that), and this spec
// counts dashed strokes as uppers. Beams and cabinets are what it is about.
REPRO.roofs = [];
// A base cabinet, a sink base and a fridge along the back wall (uppers over
// each), and an island standing free (none).
REPRO.fixtures = [
  { id: 'fx1', wallId: 'wall-2', levelId: 3, view: 'plan', kind: 'cabinet', layer: 'A-FIXT', offset: 6, width: 3, depth: 2, side: 1 },
  { id: 'fx2', wallId: 'wall-2', levelId: 3, view: 'plan', kind: 'sinkbase', layer: 'A-FIXT', offset: 9.5, width: 4, depth: 2, side: 1 },
  { id: 'fx3', wallId: 'wall-2', levelId: 3, view: 'plan', kind: 'fridge', layer: 'A-FIXT', offset: 13, width: 3, depth: 2.5, side: 1 },
  { id: 'fx4', wallId: 'wall-2', levelId: 3, view: 'plan', kind: 'island', layer: 'A-FIXT', offset: 9, width: 6, depth: 3, side: 1, standoff: 5.5 },
];

// THE TAPE: every stroke with the dash it was made under, per canvas, so a
// dash-dot (four-part) stroke is the beam above and a [6,4] stroke the
// uppers -- nothing else on a walls plan strokes under either.
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
const lastPaint = (page, canvasId) => page.evaluate(id => {
  const mine = (window.__tape || []).filter(e => e.canvas === id);
  let start = 0;
  mine.forEach((e, i) => { if (e.op === 'clear') start = i; });
  const strokes = mine.slice(start).filter(e => e.op === 'stroke');
  return {
    dashDot: strokes.filter(e => e.dash.length === 4).length,
    dashed: strokes.filter(e => e.dash.length === 2 && e.dash[0] === 6 && e.dash[1] === 4).length,
    lighter: strokes.filter(e => Math.abs(e.alpha - 0.5) < 0.01).length,
  };
}, canvasId);

test('MODEL: the walls plan draws the beam over it dash-dot and the uppers dashed; the floor layout neither', async ({ page }) => {
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
  await expect(page.locator('#plan'), 'the four pieces of the main floor beam, filed on its floor view')
    .toHaveAttribute('data-beams-above', '4');
  const plan = await lastPaint(page, 'plan');
  expect(plan.dashDot, 'each piece stroked dash-dot').toBeGreaterThanOrEqual(4);
  expect(plan.dashed, 'three pieces hang uppers, the island none').toBe(3);
  expect(plan.lighter, 'all of it lighter').toBeGreaterThanOrEqual(7);
  await h.pickModelLayer(page, 3, 'floor');
  await page.waitForTimeout(300);
  await expect(page.locator('#plan'), 'the floor layout owns that beam and borrows nothing').toHaveAttribute('data-beams-above', '0');
  const floor = await lastPaint(page, 'plan');
  expect(floor.dashDot, 'no dash-dot on the floor layout').toBe(0);
  expect(floor.dashed, 'and no uppers').toBe(0);
  // THE BASEMENT PLAN borrows FOUNDATION's beam, the one under the main floor.
  await page.goto('/MODEL.html?right=1&level=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.pickModelLayer(page, 1, 'plan');
  await page.waitForTimeout(300);
  await expect(page.locator('#plan'), 'the basement plan shows the foundation beam over it').toHaveAttribute('data-beams-above', '4');
});

test('LAYOUT: the dealt MAIN FL PLAN sheet draws the beam over it dash-dot and the uppers dashed; the MAIN FLOOR layout neither', async ({ page }) => {
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
    return lastPaint(page, 'lay-canvas');
  };
  // THE SHEET PAINTS ITSELF TWICE WITHIN ONE CLEAR, so counts are "some, and
  // a multiple of what one paint draws".
  const plan = await sheetOf('MAIN FL PLAN');
  expect(plan.dashDot, 'the beam over the walls plan, dash-dot').toBeGreaterThanOrEqual(4);
  expect(plan.dashDot % 4, 'four pieces, however many paints').toBe(0);
  expect(plan.dashed, 'the uppers over three pieces, dashed').toBeGreaterThanOrEqual(3);
  expect(plan.dashed % 3, 'three pieces, however many paints').toBe(0);
  const floor = await sheetOf('MAIN FLOOR');
  expect(floor.dashDot, 'the floor layout draws that beam as its own, solid').toBe(0);
  expect(floor.dashed, 'and hangs no uppers').toBe(0);
});
