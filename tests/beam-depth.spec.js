// THE FLOOR STEPS UP WHEN A BEAM MOVE LENGTHENS ITS SPAN (Movie, 19 Oct).
//
// "allow the user to INCREASE the thickness of the floor if the span is
// increased past acceptable span, and would be 31 feet max space for OWJ, they
// can span further, but the floor will stay at the same thickness (24" 23.25"
// plus 3/4" sheathin) but the beams and joists will be marked BEAM / JOIST
// SPAN REQUIRES ENGINEERING / ADDITIONAL SUPPORT" -- "yes the whole house will
// need to increase height ... if it is a crawl space under the main floor (if
// it is less than 8ft height foundation) THAT ceiling height can be decreased".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
// A 60 x 40 house on MAIN FL, its OWJ floor 19-1/4" @ 16" (25 ft), one beam
// row across it at z = 0 on FOUNDATION: two 20 ft bays.
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'house', levelId: 3, garage: false,
    points: [[-30, -20], [30, -20], [30, 20], [-30, 20]].map(([x, z]) => P(x, z)) }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [{ id: 1, start: P(-30, 0), end: P(30, 0), levelId: 1, view: 'foundation', mode: 'flush', auto: true }],
  columns: [],
  levelAssemblies: { 3: { joistType: 'owj', joistDepthIn: 19.25, joistSpacingIn: 16 } },
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
  await h.pickModelLayer(page, 1, 'foundation');
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function moveRow(page, at, fromZ, toZ) {
  await page.mouse.click(...at(12, fromZ));
  await page.waitForTimeout(100);
  await page.locator('#model-move').click();
  await page.mouse.move(...at(12, fromZ));
  await page.mouse.down();
  await page.mouse.move(...at(12, toZ), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const asm = (d, id) => (d.levelAssemblies || {})[String(id)] || {};
// What the painter writes, caught at fillText through one full repaint.
const painted = page => page.evaluate(() => new Promise(resolve => {
  const said = [];
  const real = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) { said.push(String(text)); return real.call(this, text, ...rest); };
  window.dispatchEvent(new Event('resize'));
  setTimeout(() => { CanvasRenderingContext2D.prototype.fillText = real; resolve(said); }, 300);
}));
const MARK = 'BEAM / JOIST SPAN REQUIRES ENGINEERING / ADDITIONAL SUPPORT';

test('a row moved to leave a 28 ft bay steps the OWJ up to 23-1/4" @ 16"; one UNDO puts the row and the floor back', async ({ page }) => {
  const { at } = await open(page);
  await moveRow(page, at, 0, -8);
  await expect(page.locator('[data-strip-message]')).toContainText('23-1/4" @ 16" O.C.');
  await expect(page.locator('[data-strip-message]')).toContainText('rises');
  let d = await saved(page);
  expect(asm(d, 3)).toMatchObject({ joistType: 'owj', joistDepthIn: 23.25, joistSpacingIn: 16 });
  expect(asm(d, 1).wallHeightFt, 'a basement keeps its height').toBeUndefined();
  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(asm(d, 3)).toMatchObject({ joistDepthIn: 19.25, joistSpacingIn: 16 });
  expect(Math.round(d.beams[0].start.z * 100) / 100 + 0).toBe(0);
});

test('over a crawl space the floor deepens down into it: the pour gives up the 4"', async ({ page }) => {
  const crawl = 4 + 1.5 / 12;
  const { at } = await open(page, drawing({ levelAssemblies: {
    3: { joistType: 'owj', joistDepthIn: 19.25, joistSpacingIn: 16 }, 1: { wallHeightFt: crawl } } }));
  await moveRow(page, at, 0, -8);
  await expect(page.locator('[data-strip-message]')).toContainText('crawl space');
  const d = await saved(page);
  expect(asm(d, 3).joistDepthIn).toBe(23.25);
  expect(asm(d, 1).wallHeightFt).toBeCloseTo(crawl - 4 / 12, 6);
});

test('past 31 ft the floor stays at 23-1/4" @ 12" and the bay and its beam carry the ENGINEERING mark', async ({ page }) => {
  const { at } = await open(page);
  await moveRow(page, at, 0, -12);
  await expect(page.locator('[data-strip-message]')).toContainText('REQUIRES ENGINEERING');
  const d = await saved(page);
  expect(asm(d, 3)).toMatchObject({ joistDepthIn: 23.25, joistSpacingIn: 12 });
  // The beam on FOUNDATION carries it here.
  const onFoundation = await painted(page);
  expect(onFoundation.filter(t => t === MARK).length, 'the beam beside the long bay').toBeGreaterThan(0);
  // And the bay on MAIN FL's FLOOR LAYOUT.
  await h.pickModelLayer(page, 3, 'floor');
  const onFloor = await painted(page);
  expect(onFloor.filter(t => t === MARK).length, 'the long bay').toBeGreaterThan(0);
});

test('deleting a row steps the floor up too, in the same UNDO', async ({ page }) => {
  const { at } = await open(page, drawing({ beams: [
    { id: 1, start: P(-30, -7), end: P(30, -7), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
    { id: 2, start: P(-30, 7), end: P(30, 7), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
  ] }));
  await page.mouse.click(...at(12, 7));
  await page.waitForTimeout(100);
  await page.locator('#delete').click();
  let d = await saved(page);
  expect(d.beams).toHaveLength(1);
  expect(asm(d, 3)).toMatchObject({ joistDepthIn: 23.25, joistSpacingIn: 16 });
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(d.beams).toHaveLength(2);
  expect(asm(d, 3).joistDepthIn).toBe(19.25);
});

test('a floor the engineer has specified carries no mark', async ({ page }) => {
  const { at } = await open(page, drawing({ levelAssemblies: {
    3: { joistType: 'owj', joistDepthIn: 19.25, joistSpacingIn: 16, joistCallout: 'STEEL W10x22 @ 8\' O.C.' } } }));
  await moveRow(page, at, 0, -12);
  await h.pickModelLayer(page, 3, 'floor');
  const onFloor = await painted(page);
  expect(onFloor).not.toContain(MARK);
  expect(onFloor.some(t => t.includes('STEEL W10x22'))).toBe(true);
});
