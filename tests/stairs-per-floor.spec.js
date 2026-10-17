// WHICH STAIRS A FLOOR PLAN SHOWS, AND HOW (Movie, 16 Oct): "BASEMENT shows
// main->basement only; MAIN shows main->2nd and any main->basement; 2ND FL
// shows main->2nd normal weight and main->basement lighter." Generalised: a
// floor shows the stairs that start on it (DN) and the stairs that land on it
// (UP) at normal weight, a stair entirely below it lighter with no tag, and
// never one above it.
//
// THE RULE IS stair-geometry's (stairsShownOn, proto/layout-plan-harness.js)
// and the weights and tags are render-2d's (proto/render-2d-harness.js). What
// this pins is each page's seam: MODEL's plan and the LAYOUT sheets both hand
// the painter the same list and the same roles.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const rect = (x0, z0, x1, z1) => [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)];
const HOUSE = rect(0, 0, 24, 30);
const wallsOf = (levelId, startId, pts, view = 'plan') => pts.map((pt, i) => ({
  id: startId + i, start: pt, end: pts[(i + 1) % pts.length], levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
}));
// ONE STAIR DOWN FROM EACH STOREY, on the same spot: 3's goes to the
// basement, 5's lands on MAIN.
const stairOn = (id, levelId) => ({
  id, levelId, view: 'plan', layer: 'A-STR', start: point(4, 4), end: point(4, 14),
  widthFt: 3, riseFt: 9, risers: 14, rail: 'left', shape: 'straight', turn: 'right', winders: 0,
});
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
  walls: [...wallsOf(5, 200, HOUSE), ...wallsOf(3, 100, HOUSE), ...wallsOf(1, 300, HOUSE),
    ...wallsOf(1, 310, HOUSE, 'foundation')],
  outlines: [{ id: 1, levelId: 3, points: HOUSE }, { id: 2, levelId: 5, points: HOUSE }],
  stairs: [stairOn(1, 3), stairOn(2, 5)],
  lines: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], notes: [], floors: [],
  roomTags: [], columns: [], beams: [], surfaceOpenings: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  layout: { auto: true },
});

const TAG = /^(UP|DN) — \d+R @ /;
// Each paint's text, per canvas, the last paint read on its own (clearRect
// marks a paint's start); and every stroke's alpha with it, so the lighter
// stair can be told from a full-weight one.
const spy = page => page.evaluate(() => {
  const proto = CanvasRenderingContext2D.prototype;
  window.__tape = [];
  const fillText = proto.fillText;
  proto.fillText = function (text, ...rest) {
    window.__tape.push({ op: 'text', canvas: this.canvas && this.canvas.id, text: String(text) });
    return fillText.call(this, text, ...rest);
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
// THE SHEET PAINTS ITSELF TWICE WITHIN ONE CLEAR (the thumbnail and the
// page share a pass), so the tags are read as a set: which directions, not
// how many times.
const tagsOf = paint => [...new Set(paint.filter(e => e.op === 'text' && TAG.test(e.text)).map(e => e.text.slice(0, 2)))].sort();
const lighter = paint => paint.some(e => e.op === 'stroke' && Math.abs(e.alpha - 0.45) < 0.02);

async function openModel(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
}
// THE PLAN VIEW OF THE LEVEL, picked by name: the basement level opens on
// its FOUNDATION view, and a stair lives on the plan.
async function planOf(page, levelId) {
  await page.goto(`/MODEL.html?right=1&level=${levelId}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.pickModelLayer(page, levelId, 'plan');
  await page.waitForTimeout(200);
  await spy(page);
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1);
  await page.waitForTimeout(400);
  return lastPaint(page, 'plan');
}

test('MODEL: the basement reads UP, MAIN reads DN and UP, 2ND FL reads DN with the lower stair lighter', async ({ page }) => {
  await openModel(page, fixture());
  const basement = await planOf(page, 1);
  expect(tagsOf(basement), 'the basement shows the MAIN stair landing on it, going UP').toEqual(['UP']);
  expect(lighter(basement), 'and nothing lighter: the 2ND\'s stair is above it').toBe(false);
  const main = await planOf(page, 3);
  expect(tagsOf(main), 'MAIN shows its own going DN and the 2ND\'s landing UP').toEqual(['DN', 'UP']);
  const upper = await planOf(page, 5);
  expect(tagsOf(upper), '2ND FL shows its own going DN and tags the one under it not at all').toEqual(['DN']);
  expect(lighter(upper), 'the MAIN stair under it is drawn lighter').toBe(true);
});

test('LAYOUT: the dealt plan sheets show the same stairs the same way', async ({ page }) => {
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
  }, { bucket: BUCKET, f: fixture() });
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
  const basement = await sheetOf('BASEMENT PLAN');
  expect(tagsOf(basement), 'BASEMENT PLAN: the MAIN stair going UP').toEqual(['UP']);
  const main = await sheetOf('MAIN FL PLAN');
  expect(tagsOf(main), 'MAIN FL PLAN: DN and UP').toEqual(['DN', 'UP']);
  const upper = await sheetOf('2ND FL PLAN');
  expect(tagsOf(upper), '2ND FL PLAN: DN only').toEqual(['DN']);
  expect(lighter(upper), 'with the MAIN stair under it lighter').toBe(true);
});
