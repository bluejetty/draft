// REGULAR WALLS, THEN FOUNDATION WALLS; and the stock 8" CONC + 2X6 BSMT
// (jb, 16 Nov 2026).
//
// "can we seperate the REGULAR WALLS from the FOUNDATION WALLS in the wall
// selection part, list the reg wall first and then the foundation walls
// later. and can we make another 8" conc foundation wall, but this one will
// show as only 8" foundation on the FOUNDATION PLAN, but on the Basement plan
// the other part of the wall will show the 1/2" air space and 5.5" batt
// insulated wall studs, but these should not show on the foundation plan".
//
// wall-types.js STOCK_WALL_TYPES (the type: a made foundation type every
// page holds), model/15-panels.js groupWallTypeRow (the two groups),
// model/11 WALL_PANEL_TYPES (the WALL tool's row).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SHOTS = process.env.STOCK_WALL_SHOTS || '';
const STOCK = 'wt_stock_conc8_bsmt';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8, ...extra });
const F = (id, a, b, extra) => W(id, a, b, { levelId: 1, view: 'foundation', wallType: 'concrete_8',
  refLine: 'left', baseHeight: -8, topHeight: 0, ...extra });
const drawing = (fdnType = 'concrete_8', extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 40,
  walls: [W('n', [0, 0], [12, 0]),
    // A foundation loop drawn clockwise on screen, its line on the OUTSIDE face.
    ...[['fn', [0, 0], [20, 0]], ['fe', [20, 0], [20, 16]], ['fs', [20, 16], [0, 16]], ['fw', [0, 16], [0, 0]]]
      .map(([id, a, b]) => F(id, a, b, fdnType === STOCK ? { wallType: STOCK, widthIn: 14 } : { wallType: fdnType })),
    W('bp', [10, 1], [10, 15], { levelId: 1, wallType: 'stud_2x4' })],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, url, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const shot = async (page, name, locator) => {
  if (!SHOTS) return;
  await (locator ? page.locator(locator) : page).screenshot({ path: `${SHOTS}/${name}.png` });
};
const inkAt = async (page, x, z) => {
  const { at } = await h.planFrame(page);
  const [sx, sy] = at(x, z);
  return page.evaluate(([px, py]) => {
    const c = document.querySelector('#plan');
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((px - r.left) * k), Math.round((py - r.top) * k), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [sx, sy]);
};
const groupIds = (row, key) => row.locator(`[data-wall-type-group-chips="${key}"] [data-prop-value]`)
  .evaluateAll(els => els.map(el => el.dataset.propValue));
const REGULAR = ['stud_2x4', 'stud_2x6', 'stud_2x8', 'insulation_6', 'guardrail'];
const FOUNDATION = ['concrete_8', 'icf', 'icf_13', 'pt_wood_fdn', STOCK];

test('a picked wall\'s TYPE row: REGULAR WALLS first, FOUNDATION WALLS after, on a floor and in the foundation alike', async ({ page }) => {
  const { at } = await open(page, '/MODEL.html?left=1&right=1&level=1&view=foundation', drawing());
  await page.mouse.click(...at(15, 0));
  const row = page.locator('#props-slot [data-prop-row="type"]');
  const heads = await row.locator('[data-wall-type-group]').evaluateAll(els => els.map(el => el.textContent));
  expect(heads).toEqual(['REGULAR WALLS', 'FOUNDATION WALLS']);
  expect(await groupIds(row, 'regular')).toEqual(REGULAR);
  expect(await groupIds(row, 'foundation')).toEqual(FOUNDATION);
  // CUSTOM WIDTH and CREATE WALL TYPE still close the row.
  const all = await row.locator('[data-prop-value]').evaluateAll(els => els.map(el => el.dataset.propValue));
  expect(all).toEqual([...REGULAR, ...FOUNDATION, 'custom', 'create-wall-type']);
  // The stock type is built in: grey, no pencil.
  await expect(row.locator(`[data-prop-value="${STOCK}"]`)).toContainText('8" CONC + 2X6 BSMT');
  await expect(row.locator(`[data-prop-value="${STOCK}"]`)).not.toHaveAttribute('data-made-type', '');
  await expect(row.locator(`[data-made-type-edit="${STOCK}"]`)).toHaveCount(0);
  await shot(page, '1-type-row-grouped', '#props-slot');

  await page.keyboard.press('Escape');
  await page.goto('/MODEL.html?left=1&right=1&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const main = await h.planFrame(page);
  await page.mouse.click(...main.at(6, 0));
  expect(await groupIds(row, 'regular')).toEqual(REGULAR);
  expect(await groupIds(row, 'foundation')).toEqual(FOUNDATION);
});

test('the stock type goes on a foundation wall; FOUNDATION draws only its 8" concrete, BASEMENT the air space and batt studs too', async ({ page }) => {
  const { at } = await open(page, '/MODEL.html?left=1&right=1&level=1&view=foundation', drawing());
  await page.mouse.click(...at(15, 0));
  await page.locator(`#props-slot [data-prop-row="type"] [data-prop-value="${STOCK}"]`).click();
  // SLICES row: FLIP SLICES, but no EDIT.
  await expect(page.locator('#props-slot [data-wall-slice-flip]')).toHaveCount(1);
  await expect(page.locator('#props-slot [data-wall-type-edit]')).toHaveCount(0);
  let d = await saved(page);
  expect(d.walls.find(w => w.id === 'fn')).toMatchObject({ wallType: STOCK, widthIn: 14 });
  expect(d.wallTypes || [], 'a stock type is never written into the file').toEqual([]);

  // The whole loop in it, then look.
  await page.evaluate(stock => {
    drawing.walls.filter(w => w.view === 'foundation').forEach(w => { w.wallType = stock; w.widthIn = 14; });
    paint();
  }, STOCK);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  // The batt stud slice is 8 1/2" to 14" in from the line (the outside
  // face), a plain stud wall like the basement's own 2x4 partition.
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 12);
  const fdnInk = await inkAt(page, 15, 0.95);
  const fdnConc = await inkAt(page, 15, 0.35);
  await shot(page, '2-foundation-plan-concrete-only', null);
  await saved(page);

  await page.goto('/MODEL.html?left=1&right=1&level=1&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const bsmtInk = await inkAt(page, 15, 0.95);
  const stud = await inkAt(page, 10, 8);
  expect(near(bsmtInk, stud), `BASEMENT plan, the stud wall shows: ${bsmtInk} vs the 2x4's ${stud}`).toBe(true);
  expect(near(fdnInk, stud), `FOUNDATION plan, no stud wall: ${fdnInk}`).toBe(false);
  expect(near(await inkAt(page, 15, 0.35), fdnConc), 'the same concrete on both').toBe(true);
  await shot(page, '3-basement-plan-full-wall', null);
  d = await saved(page);
  expect(d.walls.filter(w => w.view === 'foundation').every(w => w.wallType === STOCK)).toBe(true);
});

test('the WALL tool\'s row groups the same way and draws in the stock type on FOUNDATION', async ({ page }) => {
  await open(page, '/MODEL.html?left=1&right=1&level=1&view=foundation', drawing());
  await h.armWall(page);
  const row = page.locator('[data-prop-row="wall type"]');
  const heads = await row.locator('[data-wall-type-group]').evaluateAll(els => els.map(el => el.textContent));
  expect(heads).toEqual(['REGULAR WALLS', 'FOUNDATION WALLS']);
  expect(await groupIds(row, 'regular')).toEqual(['stud_2x4', 'stud_2x6', 'stud_2x8']);
  expect(await groupIds(row, 'foundation')).toEqual(['icf', 'icf_13', 'concrete_8', STOCK]);
  await row.locator(`[data-prop-value="${STOCK}"]`).click();
  await expect(row.locator(`[data-prop-value="${STOCK}"]`)).toHaveAttribute('aria-pressed', 'true');
  await shot(page, '4-wall-tool-grouped', '#props-slot');
  const d = await saved(page);
  expect(d.activeWallType).toBe(STOCK);
});

// THE SHEET'S OWN PAINTER at 200 px a foot, on a canvas of its own: the
// darkest ink down a column across the stud wall's outer face (8 1/2" in
// from the north wall's line), where FOUNDATION has nothing.
const studFaceOnSheet = (page, saved, view) => page.evaluate(({ saved, view }) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = 600;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1000, 600);
  window.DraftLayoutPlan.drawPlan(ctx, p => ({ x: 50 + (p.x - 5) * 200, y: 50 + p.z * 200 }), saved, 1, { view });
  const y0 = Math.round(50 + (8.5 / 12) * 200) - 2;
  const d = ctx.getImageData(600, y0, 1, 5).data;
  let darkest = 255;
  for (let i = 0; i < d.length; i += 4) darkest = Math.min(darkest, (d[i] + d[i + 1] + d[i + 2]) / 3);
  return darkest;
}, { saved, view });

test('on the LAYOUT sheets: FOUNDATION prints the concrete only, BASEMENT the whole wall', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const d = drawing(STOCK);
  expect(await studFaceOnSheet(page, d, 'foundation'), 'no stud wall on the FOUNDATION sheet').toBeGreaterThan(200);
  expect(await studFaceOnSheet(page, d, 'plan'), 'the stud wall\'s face on the BASEMENT sheet').toBeLessThan(140);
});

// ── THE AUTOHOUSE OFF AN OUTLINE (jb, 16 Nov 2026: "use that new 8\" wall
// ... as the default for 8\" conc foundation when the OUTLINE is drawn") ──
const emptyHouse = () => ({ ...drawing(), walls: [], levelAssemblies: { 3: { wallHeightFt: 109.125 / 12 } } });
async function drawType(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-banner-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  await h.dropSeededCorner(page);
}
async function trace(page, corners) {
  const { at } = await h.planFrame(page);
  for (const [x, z] of [...corners, corners[0]]) await page.mouse.click(...at(x, z));
  if (await page.locator('#garage-lesson').isVisible()) {
    await page.keyboard.press('Enter');
    await expect(page.locator('#garage-lesson')).toBeHidden();
  }
  await page.waitForTimeout(150);
  if (await page.locator('#corner-join').isVisible()) {
    await page.keyboard.press('Enter');
    await expect(page.locator('#corner-join')).toBeHidden();
  }
}

test('a house built off a traced OUTLINE stands on 8" CONC + 2X6 BSMT, concrete on the outline, footing under the concrete', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: emptyHouse() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await drawType(page, 'bungalow', 'bungalow-garage');
  await trace(page, [[-10, -8], [10, -8], [10, 8], [-10, 8]]);
  await trace(page, [[-2, 8], [12, 8], [12, 24], [-2, 24]]);
  await page.waitForTimeout(500);
  const d = await saved(page);
  const fdn = d.walls.filter(w => Number(w.levelId) === 1 && w.view === 'foundation' && w.body !== 'garage');
  expect(fdn.length, 'the house\'s concrete').toBeGreaterThan(0);
  expect(fdn.every(w => w.wallType === STOCK), fdn.map(w => w.wallType).join()).toBe(true);
  expect(fdn.every(w => w.widthIn === 14)).toBe(true);
  expect(fdn.every(w => (w.sliceFlip === true) === (w.refLine === 'right')), 'slices start at the outline').toBe(true);
  expect(d.wallTypes || [], 'nothing written into the file\'s own types').toEqual([]);

  // The basement plan: the stud wall just inside the north wall, 8 1/2" to
  // 14" in; the FOUNDATION plan shows none of it.
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 12);
  await page.goto('/MODEL.html?left=1&right=1&level=1&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const north = Math.min(...fdn.flatMap(w => [w.start.z, w.end.z]));
  const bsmtConc = await inkAt(page, 0, north + 0.3);
  const bsmtStud = await inkAt(page, 0, north + 0.95);
  expect(near(bsmtStud, bsmtConc), `BASEMENT: a stud wall inside the concrete ${bsmtStud} vs ${bsmtConc}`).toBe(false);
  await shot(page, '5-autohouse-basement', null);
  await page.goto('/MODEL.html?left=1&right=1&level=1&view=foundation');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  expect(near(await inkAt(page, 0, north + 0.95), bsmtStud), 'FOUNDATION: no stud wall').toBe(false);
  expect(near(await inkAt(page, 0, north + 0.3), bsmtConc), 'the same concrete on both').toBe(true);
  // THE FOOTING CENTRES UNDER THE 8" CONCRETE, not the 14" wall.
  const foot = await page.evaluate(north => {
    const segs = window.DraftFootingOutline.footingOutline({
      walls: drawing.walls, levelId: 1, levelAssemblies: drawing.levelAssemblies });
    const zs = segs.filter(s => Math.abs(s.start.z - s.end.z) < 1e-6 && Math.abs(s.start.z - north) < 3)
      .map(s => s.start.z);
    return { n: segs.length, zs };
  }, north);
  expect(foot.n, 'the footing outline is drawn').toBeGreaterThan(0);
  // Its two lines straddle the concrete's middle (4" in), not the 14"
  // wall's (7" in).
  const lo = Math.min(...foot.zs), hi = Math.max(...foot.zs);
  expect(lo, `the outer line is outside the house: ${foot.zs}`).toBeLessThan(north);
  expect(Math.abs((lo + hi) / 2 - (north + 4 / 12)), `centred under the 8" concrete: ${foot.zs}`).toBeLessThan(0.02);
  await shot(page, '6-autohouse-foundation', null);
});
