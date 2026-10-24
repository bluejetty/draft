// THE ISLAND, ITS PIECES, AND ITS SIZE (Movie, 20 Oct): "i'd like to be
// able to move sink / dw in island back an forth / and they shouldn't
// overlap like in the photo... also don't need the ISLAND mark on the island
// (no title) its obvious to a person looking of what it is" -- "also would
// like to be able to click on the island and change the dimensions size and
// also would like to move the island independantly from the wall and other
// cabinets".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8 });
// A 24' wall along z = 0. The island rides it 5' off its face (side 1 is
// +z), 7' wide centred on the wall's middle (offset 12 -> x 0), so it spans
// x -3.5..3.5 and z 5.23..8.23. Its sink sits left (x -3.25..-0.75), its
// dishwasher right (x 1.5..3.5).
const F = (id, kind, offset, width, extra = {}) => ({ id, wallId: 'a', levelId: 3, view: 'plan', kind, layer: 'A-FIXT',
  offset, width, depth: kind === 'island' ? 3 : 2, side: 1, standoff: 5, ...extra });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('a', [-12, 0], [12, 0])],
  fixtures: [F('isl', 'island', 12, 7), F('sink', 'sink', 10, 2.5), F('dw', 'dish', 14.5, 2)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await page.addInitScript(() => {
    window.__texts = [];
    const proto = CanvasRenderingContext2D.prototype;
    const orig = proto.fillText;
    proto.fillText = function (text, ...rest) { window.__texts.push(String(text)); return orig.call(this, text, ...rest); };
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?left=1&lpane=drafting&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // SELECT ONLY IF IT IS NOT ALREADY UP: pressing a lit SELECT opens its
  // pick-a-kind mode, and a click would then box kinds rather than choose.
  const selectKey = page.locator('[data-tool-key="select"]');
  if (await selectKey.getAttribute('aria-pressed') !== 'true') await h.armFromRail(page, 'select');
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  // THE FIT FRAMES THE WALL ALONE and leaves the island under the foot bar:
  // wheel out until the sheet shows 20 px to the foot or less.
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 8; i += 1) {
    const { scale } = await h.planFrame(page);
    if (scale <= 20) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(120);
  }
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const fx = (d, id) => d.fixtures.find(f => f.id === id);
const r2 = n => Math.round(n * 100) / 100;
async function pick(page, at, x, z) {
  await page.mouse.click(...at(x, z));
  await expect(page.locator('#delete')).toBeVisible();
}
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at((from[0] + to[0]) / 2, (from[1] + to[1]) / 2), { steps: 4 });
  await page.mouse.move(...at(...to), { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test('the island carries no name; its dishwasher still says DW', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.__texts.length = 0; });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const texts = await page.evaluate(() => window.__texts);
  expect(texts, 'the painter still labels the pieces').toContain('DW');
  expect(texts, 'and names the island no more').not.toContain('ISLAND');
});

test('the dishwasher slides inside its island and stops at the sink, never over it', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, 2.5, 6.7);
  // PULLED LEFT PAST THE SINK: it stops with its edge on the sink's.
  await drag(page, at, [2.5, 6.7], [-6, 6.7]);
  let d = await saved(page);
  expect(r2(fx(d, 'dw').offset), 'its centre a foot off the sink\'s right edge').toBe(12.25);
  expect(r2(fx(d, 'sink').offset), 'the sink did not move').toBe(10);
  // PUSHED RIGHT PAST THE ISLAND'S END: it stops at the end.
  await drag(page, at, [0.25, 6.7], [9, 6.7]);
  d = await saved(page);
  expect(r2(fx(d, 'dw').offset), 'a foot in from the island\'s end').toBe(14.5);
  expect(fx(d, 'dw').standoff, 'still in the island').toBeCloseTo(5, 6);
});

test('the island dragged goes along the wall and off it, its sink and dishwasher riding', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, 0, 7.8);
  await drag(page, at, [0, 7.8], [4, 11.8]);
  const d = await saved(page);
  expect([r2(fx(d, 'isl').offset), r2(fx(d, 'isl').standoff)], 'four along, four out').toEqual([16, 9]);
  expect([r2(fx(d, 'sink').offset), r2(fx(d, 'sink').standoff)]).toEqual([14, 9]);
  expect([r2(fx(d, 'dw').offset), r2(fx(d, 'dw').standoff)]).toEqual([18.5, 9]);
  expect(fx(d, 'isl').wallId, 'still the wall\'s').toBe('a');
  await expect(page.locator('#strip-message')).toContainText(/island moved, its pieces with it/i);
  // ONE UNDO TAKES THE LOT BACK, the aisle included -- the drag's own step,
  // not the saved version before it, which an empty stack falls back to.
  await page.keyboard.press('Control+z');
  await expect(page.locator('#strip-message')).not.toContainText('version from');
  const back = await saved(page);
  expect([r2(fx(back, 'isl').offset), r2(fx(back, 'isl').standoff), r2(fx(back, 'dw').offset), r2(fx(back, 'dw').standoff)])
    .toEqual([12, 5, 14.5, 5]);
});

test('clicking the island opens WIDTH, DEPTH and AISLE; a narrower island pulls its pieces in; UNDO puts it back', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, 0, 7.8);
  const width = page.locator('[data-prop-field="width"]');
  await expect(width).toHaveValue('7\'-0"');
  await expect(page.locator('[data-prop-field="depth"]')).toHaveValue('3\'-0"');
  await expect(page.locator('[data-prop-field="aisle"]')).toHaveValue('5\'-0"');
  await width.fill('5');
  await width.press('Enter');
  let d = await saved(page);
  expect(r2(fx(d, 'isl').width)).toBe(5);
  // THE DISHWASHER WAS AT THE OLD END: it comes in to the new one.
  expect(r2(fx(d, 'dw').offset), 'a foot in from the 5\' island\'s end').toBe(13.5);
  // AND THE SINK, whose left edge stood 9\" past the new end, comes in too.
  expect(r2(fx(d, 'sink').offset), 'its edge on the island\'s left end').toBe(10.75);
  await page.locator('[data-prop-field="depth"]').fill('4');
  await page.locator('[data-prop-field="depth"]').press('Enter');
  d = await saved(page);
  expect(r2(fx(d, 'isl').depth)).toBe(4);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect([r2(fx(d, 'isl').width), r2(fx(d, 'isl').depth), r2(fx(d, 'sink').offset), r2(fx(d, 'dw').offset)],
    'two UNDOs, back as it was').toEqual([7, 3, 10, 14.5]);
});
