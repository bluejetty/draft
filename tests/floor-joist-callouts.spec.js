// THE JOIST CALLOUTS AND THE FOOTPRINT ON EVERY PLAN PAGE (Movie, 16 Oct,
// marked up in GIMP on the 2ND FL FLOOR LAYOUT): the three-line OWJ note
// struck out, and in its place an ARROWED span line perpendicular to the beam
// in every bay with the short form beside it ("ENGINEERED OWJ 19-1/4""); a
// faded footprint (the house and its garage) as a background line on every
// PLAN-view page, the same scale page to page.
//
// THE ARITHMETIC IS THE MODULES' -- build-house joistBays / deckJoistAxis /
// joistCallout (proto/mid-span-beam-harness.js), render-2d drawJoistSpans2D
// (proto/render-2d-harness.js), layout-plan footprintLoops / ghostLoops /
// joistCalloutsFor (proto/layout-plan-harness.js), each with its rows. What
// this pins is the pages' link to them: MODEL's floor view paints a label in
// every bay, the LAYOUT floor sheet paints the same, the FOUNDATION sheet
// carries the faded footprint, and the building's plan sheets are dealt at
// one scale.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const rect = (x0, z0, x1, z1) => [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)];

// A 24 x 30 HOUSE WITH A 20 x 20 GARAGE ON ITS EAST SIDE, two storeys on a
// concrete foundation. The main floor's beam runs east-west at z 22 in two
// pieces; the stairwell (x 8..11, z 24..28) is cut in both decks. The line
// far out on MAIN FL makes that level's sheets need a smaller rung than the
// others would take on their own, which is what the shared scale is for.
const HOUSE = rect(0, 0, 24, 30);
const GARAGE = rect(24, 0, 44, 20);
const WELL = [point(8, 24), point(11, 24), point(11, 28), point(8, 28)];
const wallsOf = (levelId, startId, pts, view = 'plan') => pts.map((pt, i) => ({
  id: startId + i, start: pt, end: pts[(i + 1) % pts.length], levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
}));
const fixture = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [...wallsOf(3, 100, HOUSE), ...wallsOf(3, 110, GARAGE), ...wallsOf(5, 200, HOUSE),
    ...wallsOf(1, 300, HOUSE, 'foundation')],
  lines: [{ id: 1, start: point(60, 0), end: point(90, 0), levelId: 3, view: 'plan' }],
  roofs: [], fenestrations: [], dimensions: [], shapes: [], stairs: [], notes: [],
  roomTags: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  outlines: [
    { id: 1, levelId: 3, points: HOUSE, garage: false },
    { id: 2, levelId: 3, points: GARAGE, garage: true },
    { id: 3, levelId: 5, points: HOUSE, garage: false },
  ],
  floors: [
    { id: 'deck-3', levelId: 3, view: 'floor', structure: 'floor', points: HOUSE },
    { id: 'deck-5', levelId: 5, view: 'floor', structure: 'floor', points: HOUSE },
  ],
  surfaceOpenings: [
    { id: 'well-3', levelId: 3, hostType: 'floor', hostId: 'deck-3', points: WELL },
    { id: 'well-5', levelId: 5, hostType: 'floor', hostId: 'deck-5', points: WELL },
  ],
  beams: [
    { id: 1, start: point(0.5, 22), end: point(10, 22), levelId: 3, view: 'floor', mode: 'flush' },
    { id: 2, start: point(10, 22), end: point(23.5, 22), levelId: 3, view: 'floor', mode: 'flush' },
  ],
  columns: [
    { id: 1, point: point(10, 22), levelId: 3, view: 'floor', footing: 'pad36' },
    { id: 2, point: point(16, 22), levelId: 3, view: 'floor', footing: 'pad36' },
  ],
  layout: { auto: true },
});

const JOIST = /^(ENGINEERED OWJ|TJI|\dx\d+ JOISTS)/;

// WHAT THE PAGE WRITES AND STROKES, per canvas, with each paint marked by its
// clearRect so the LAST paint can be read on its own.
const spy = page => page.evaluate(() => {
  const proto = CanvasRenderingContext2D.prototype;
  window.__tape = [];
  const fillText = proto.fillText;
  proto.fillText = function (text, x, y, ...rest) {
    window.__tape.push({ op: 'text', canvas: this.canvas && this.canvas.id, text: String(text) });
    return fillText.call(this, text, x, y, ...rest);
  };
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
const lastPaint = (page, canvasId) => page.evaluate(id => {
  const mine = (window.__tape || []).filter(e => e.canvas === id);
  let start = 0;
  mine.forEach((e, i) => { if (e.op === 'clear') start = i; });
  return mine.slice(start).filter(e => e.op !== 'clear');
}, canvasId);

async function openModel(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function openLayout(page, file) {
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
  }, { bucket: BUCKET, f: file });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()).layout : null;
  }, BUCKET);
}
const sheetTitled = (layout, title) => layout.sheets.findIndex(s => s.title === title) + 1;

test('the deck is called out in every bay, on MODEL and on the 2ND FLOOR sheet', async ({ page }) => {
  await openModel(page, fixture());
  await spy(page);
  await h.pickModelLayer(page, 5, 'floor');
  await page.waitForTimeout(300);
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1);
  await page.waitForTimeout(300);
  const plan = await lastPaint(page, 'plan');
  const labels = plan.filter(e => e.op === 'text' && JOIST.test(e.text)).map(e => e.text);
  // TWO BAYS -- wall to beam, beam to wall -- and the short form in each,
  // off the storey's schedule (a 2ND FL deck's stock TJI).
  expect(labels, 'one label per bay').toEqual(['TJI 11-7/8"', 'TJI 11-7/8"']);
  expect(plan.some(e => e.op === 'text' && /TO BE CONFIRMED|O\.C\.|SPAN$/.test(e.text)),
    'the three-line note is gone').toBe(false);

  const layout = await openLayout(page, fixture());
  const sheet = sheetTitled(layout, '2ND FLOOR');
  expect(sheet, 'the 2ND FLOOR sheet was dealt').toBeGreaterThan(0);
  await spy(page);
  await page.locator(`[data-layout-sheet="${sheet}"]`).click();
  await page.waitForTimeout(400);
  const onSheet = await lastPaint(page, 'lay-canvas');
  expect(onSheet.filter(e => e.op === 'text' && JOIST.test(e.text)).map(e => e.text),
    'the sheet labels both bays too').toEqual(['TJI 11-7/8"', 'TJI 11-7/8"']);
});

test('every plan page carries the faded footprint, and the building\'s plan sheets share one scale', async ({ page }) => {
  const layout = await openLayout(page, fixture());
  // ONE SCALE: the line far out on MAIN FL forces its sheets to a smaller
  // rung, and every other plan sheet of the building follows it, so the
  // footprint reads the same size page to page. The SITE PLAN keeps its own.
  const building = layout.viewports.filter(v => v.kind === 'plan' && Number(v.levelId) !== 8);
  expect(building.length, 'the plan sheets of the building').toBeGreaterThanOrEqual(4);
  const pifs = [...new Set(building.map(v => v.pif))];
  expect(pifs, `one scale across ${building.map(v => `${v.levelId}:${v.view}`).join(', ')}`).toHaveLength(1);
  expect(pifs[0], 'the smaller rung the wide MAIN FL needs, not 1/4"').toBeLessThan(0.25);

  // THE FOOTPRINT, FADED, ON THE FOUNDATION SHEET: the house's concrete is
  // the only thing drawn there at full ink; the house-and-garage line under
  // it is the ghost, at the ghost's alpha.
  const sheet = sheetTitled(layout, 'FOUNDATION');
  expect(sheet, 'the FOUNDATION sheet was dealt').toBeGreaterThan(0);
  await spy(page);
  await page.locator(`[data-layout-sheet="${sheet}"]`).click();
  await page.waitForTimeout(400);
  const onSheet = await lastPaint(page, 'lay-canvas');
  const faded = onSheet.filter(e => e.op === 'stroke' && Math.abs(e.alpha - 0.3) < 0.02);
  expect(faded.length, 'the faded footprint under the foundation').toBeGreaterThan(0);
});
