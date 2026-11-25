// A COLUMN RIDES ITS BEAM (jb, 25 Nov 2026).
//
// "when a guy drags a column can you force it to follow the beam, and also
// move any footings, or columns above or below that column". The plan jb
// said go to: along the beam only and between its ends; a beam that stops
// on the column has that end ride; a column under two crossing beams stays
// put unless ALT is held on the press; with LEVEL LOCK on, the columns in
// the same spot on every other level (the foundation's, with its pad) go
// the same distance; one UNDO.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const L = [[-20, -16], [20, -16], [20, 16], [-20, 16]];
const P = (x, z) => ({ x, y: 0, z });
// A row on FOUNDATION at z = 8 in two pieces, joined on post 1 at x = -8;
// post 2 mid-piece at x = -14; post 3 off the row. Posts 4 and 5 stand over
// post 2 on MAIN FL and 2ND FL.
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'outline-r', levelId: 3, garage: false, points: L.map(([x, z]) => P(x, z)) }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [
    { id: 1, start: P(-20, 8), end: P(-8, 8), levelId: 1, view: 'foundation', mode: 'flush' },
    { id: 2, start: P(-8, 8), end: P(0, 8), levelId: 1, view: 'foundation', mode: 'flush' },
  ],
  columns: [
    { id: 1, point: P(-8, 8), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 2, point: P(-14, 8), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 3, point: P(-10, 12), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 4, point: P(-14, 8), levelId: 3, view: 'plan', footing: 'pad36' },
    { id: 5, point: P(-14, 8), levelId: 5, view: 'plan', footing: 'pad36' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function toFoundation(page) {
  await h.pickModelLayer(page, 1, 'foundation');
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
// The column picked by its id (a press on it would pick the beam row first).
const pickColumn = (page, id) => page.evaluate(n => {
  setSelection([{ type: 'column', item: drawing.columns.find(c => Number(c.id) === n) }]);
  paint();
}, id);
async function drag(page, at, from, to, { alt = false } = {}) {
  await page.mouse.move(...at(...from));
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.down();
  if (alt) await page.keyboard.up('Alt');
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
const seg = b => [b.start.x, b.start.z, b.end.x, b.end.z].map(r2);
const cols = d => Object.fromEntries(d.columns.map(c => [c.id, [r2(c.point.x), r2(c.point.z)]]));

test('a column on a beam slides along it only, and the posts over it on MAIN and 2ND FL go too; one UNDO', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await pickColumn(page, 2);
  await page.locator('#model-move').click();
  // Three along and three across: only the three along is taken.
  await drag(page, at, [-14, 8], [-11, 5]);
  let d = await saved(page);
  expect(cols(d)).toEqual({ 1: [-8, 8], 2: [-11, 8], 3: [-10, 12], 4: [-11, 8], 5: [-11, 8] });
  expect(d.beams.map(seg), 'the beams stay').toEqual([[-20, 8, -8, 8], [-8, 8, 0, 8]]);
  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(cols(d)).toEqual({ 1: [-8, 8], 2: [-14, 8], 3: [-10, 12], 4: [-14, 8], 5: [-14, 8] });
});

test('it stops at the end of its beam', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await pickColumn(page, 2);
  await page.locator('#model-move').click();
  await drag(page, at, [-14, 8], [-26, 8]);
  const d = await saved(page);
  expect(cols(d)[2]).toEqual([-20, 8]);
});

test('beams that stop on the column ride with it', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await pickColumn(page, 1);
  await page.locator('#model-move').click();
  await drag(page, at, [-8, 8], [-5, 10]);
  const d = await saved(page);
  expect(cols(d)[1]).toEqual([-5, 8]);
  expect(d.beams.map(seg)).toEqual([[-20, 8, -5, 8], [-5, 8, 0, 8]]);
});

test('under two crossing beams it stays put; ALT on the press drags it free, its stack still with it', async ({ page }) => {
  const f = drawing();
  f.beams.push({ id: 3, start: P(-14, -16), end: P(-14, 8), levelId: 1, view: 'foundation', mode: 'flush' });
  await open(page, f);
  const { at } = await toFoundation(page);
  await pickColumn(page, 2);
  await page.locator('#model-move').click();
  await drag(page, at, [-14, 8], [-11, 5]);
  expect(await page.evaluate(() => stripNotice)).toContain('hold ALT');
  let d = await saved(page);
  expect(cols(d)[2], 'pinned').toEqual([-14, 8]);
  await pickColumn(page, 2);
  await drag(page, at, [-14, 8], [-11, 5], { alt: true });
  d = await saved(page);
  expect(cols(d)[2]).toEqual([-11, 5]);
  expect(cols(d)[4]).toEqual([-11, 5]);
});

test('LEVEL UNLOCKED: only this level\'s column moves', async ({ page }) => {
  await open(page, drawing({ beamLock: false }));
  const { at } = await toFoundation(page);
  await pickColumn(page, 2);
  await page.locator('#model-move').click();
  await drag(page, at, [-14, 8], [-11, 8]);
  const d = await saved(page);
  expect(cols(d)).toEqual({ 1: [-8, 8], 2: [-11, 8], 3: [-10, 12], 4: [-14, 8], 5: [-14, 8] });
});

test('the arrows nudge it along the beam and not across', async ({ page }) => {
  await open(page);
  await toFoundation(page);
  await pickColumn(page, 2);
  await page.keyboard.press('Control+ArrowUp');
  await page.keyboard.press('Control+ArrowRight');
  const d = await saved(page);
  expect(cols(d)[2]).toEqual([-13, 8]);
  expect(cols(d)[5]).toEqual([-13, 8]);
});
