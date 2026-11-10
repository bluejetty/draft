// A DIMENSION'S OWN UNITS (jb, 10 Nov 2026).
//
// "can we add a prop / obj - in dimensions so that the user can change the
// measurement to nothing checked - would be go with current drawing imp or
// metric selection. or they could select either IMPERIAL or METRIC or third
// option IMPERIAL / METRIC would display both on the same line". So: three
// chips on the picked dimension's OBJ / PROP panel, nothing lit follows the
// drawing's switch, the record carries `units` only while a chip is lit,
// UNDO takes it off, and every painter (Model Space and the sheets) reads
// the figure through one formatter.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const DIM = { id: 7, start: { x: 0, y: 0, z: -3 }, end: { x: 10, y: 0, z: -3 }, levelId: 3, view: 'plan',
  layer: 'A-DIMS-HAND', auto: false };
const drawing = (units = 'imperial') => ({
  version: 1, board: 'drafting', units,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20,
  walls: [W('w1', [0, 0], [10, 0]), W('w2', [10, 0], [10, 6])],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [DIM],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('s');
  await page.locator('#objprop-tab').click();
}
// PICK THE DIMENSION: its line stands 19px off its record, to the LEFT of
// start -> end (render-2d drawDimension2D); start -> end runs +x here, so
// the line is 19px down the screen from the string.
async function pickDim(page) {
  const { at } = await h.planFrame(page);
  const [x, y] = at(5, -3);
  await page.mouse.click(x, y + 19);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => selection.map(s => s.type))).toEqual(['dimension']);
}
const chip = (page, id) => page.locator(`[data-dim-units="${id}"]`);
const measures = page => page.locator('[data-prop-row="measures"]').textContent();
const units = page => page.evaluate(() => drawing.dimensions[0].units ?? null);
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('the formatter: no key follows the drawing, a key overrules it, BOTH is the two figures on one line', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const out = await page.evaluate(() => {
    const F = window.DraftFormatters;
    return [F.formatDimension(10, 'imperial'), F.formatDimension(10, 'metric'), F.formatDimension(10, undefined),
      F.formatDimension(10, 'imperial', 'metric'), F.formatDimension(10, 'metric', 'imperial'),
      F.formatDimension(10, 'imperial', 'both'), F.formatDimension(10, 'metric', 'nonsense')];
  });
  expect(out).toEqual(['10\'-0"', '3.048 m', '10\'-0"', '3.048 m', '10\'-0"', '10\'-0" / 3.048 m', '3.048 m']);
});

test('the panel: three UNITS chips, nothing lit on a dimension that follows the drawing', async ({ page }) => {
  await open(page, drawing());
  await pickDim(page);
  await expect(page.locator('[data-objprop-title]')).toContainText('DIMENSION');
  await expect(page.locator('[data-dim-units]')).toHaveText(['IMPERIAL', 'METRIC', 'IMPERIAL / METRIC']);
  for (const id of ['imperial', 'metric', 'both']) await expect(chip(page, id)).toHaveAttribute('aria-pressed', 'false');
  expect(await measures(page)).toContain('MEASURES 10\'-0"');
  await expect(page.locator('[data-prop-row="units-hint"]')).toContainText('FOLLOWS THE DRAWING (IMPERIAL)');
});

test('METRIC lights, the record carries units, the figure reads in metres; IMPERIAL / METRIC reads both; the lit chip pressed again follows the drawing; UNDO takes the key off', async ({ page }) => {
  await open(page, drawing());
  await pickDim(page);
  await chip(page, 'metric').click();
  await expect(chip(page, 'metric')).toHaveAttribute('aria-pressed', 'true');
  expect(await units(page)).toBe('metric');
  expect(await measures(page)).toContain('MEASURES 3.048 m');
  await chip(page, 'both').click();
  await expect(chip(page, 'both')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'metric')).toHaveAttribute('aria-pressed', 'false');
  expect(await units(page)).toBe('both');
  expect(await measures(page)).toContain('MEASURES 10\'-0" / 3.048 m');
  // SAVED AND READ BACK: the key goes into the file and the reader keeps it.
  const file = await saved(page);
  expect(file.dimensions.find(d => d.id === 7).units).toBe('both');
  // The lit chip pressed again: nothing lit, the drawing's switch again.
  await chip(page, 'both').click();
  await expect(chip(page, 'both')).toHaveAttribute('aria-pressed', 'false');
  expect(await units(page)).toBe(null);
  expect(await measures(page)).toContain('MEASURES 10\'-0"');
  // UNDO walks back: BOTH, then METRIC, then no key at all.
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Control+z');
  expect(await units(page)).toBe('both');
  await page.keyboard.press('Control+z');
  expect(await units(page)).toBe('metric');
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => 'units' in drawing.dimensions[0])).toBe(false);
});

test('on a METRIC drawing nothing lit reads metres and IMPERIAL overrules it; a bad units value in a file is dropped on read', async ({ page }) => {
  await open(page, { ...drawing('metric'), dimensions: [{ ...DIM, units: 'furlongs' }] });
  expect(await page.evaluate(() => 'units' in drawing.dimensions[0])).toBe(false);
  await pickDim(page);
  expect(await measures(page)).toContain('MEASURES 3.048 m');
  await expect(page.locator('[data-prop-row="units-hint"]')).toContainText('FOLLOWS THE DRAWING (METRIC)');
  await chip(page, 'imperial').click();
  expect(await measures(page)).toContain('MEASURES 10\'-0"');
});

test('a LAYOUT sheet prints each dimension in its own units, and follows the drawing\'s switch otherwise', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => window.DraftLayoutPlan && window.DraftFormatters && window.DraftRender2D);
  const labels = await page.evaluate(() => {
    const LP = window.DraftLayoutPlan;
    const texts = [], out = [];
    const ctx = new Proxy({}, { get: (_, k) => (k === 'fillText' ? (t => texts.push(t)) : (k === 'measureText' ? (() => ({ width: 10 })) : (() => 0))) });
    const toS = p => ({ x: p.x * 20, y: p.z * 20 });
    const base = { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], walls: [], lines: [], notes: [], shapes: [],
      outlines: [], floors: [], roofs: [], fenestrations: [], stairs: [], roomTags: [], columns: [], beams: [] };
    const dim = u => ({ id: 1, start: { x: 0, y: 0, z: -3 }, end: { x: 10, y: 0, z: -3 }, levelId: 3, view: 'plan', layer: 'A-DIMS-HAND', auto: false, ...(u ? { units: u } : {}) });
    for (const [units, u] of [['imperial', null], ['metric', null], ['imperial', 'both'], ['metric', 'imperial']]) {
      texts.length = 0;
      LP.drawLevelMarks(ctx, toS, { ...base, units, dimensions: [dim(u)] }, 3, {});
      out.push(texts.join(' '), '|');
    }
    return out.join(' ');
  });
  expect(labels).toBe('10\'-0" | 3.048 m | 10\'-0" / 3.048 m | 10\'-0" |');
});
