// A PHOTO PICKED ON THE SHEET, AND RESCALED (Movie, 23 Oct): "can we allow
// the user to click on the bg photo and 'resize' it with a resize button in
// bottom left menu area and put move and rotate there too" -- "RESCALE might
// be a better term to use" -- "allow them to change it with proportions
// locked and also without proportions locked".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
// A 20 x 10 picture standing at (20, 15), inside the house and clear of its
// walls, so a press on it lands on nothing else.
const PHOTO = { id: 'u1', levelId: 3, kind: 'image', name: 'plan.png', page: 1, x: 20, z: 15,
  widthFt: 20, heightFt: 10, opacity: 0.4, scaleRaw: null, scaleRatio: null, scaleUnit: null, layer: 'UNDERLAY' };
const house = () => ({ version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [['n', V(0, 0), V(40, 0)], ['e', V(40, 0), V(40, 30)], ['s', V(40, 30), V(0, 30)], ['w', V(0, 30), V(0, 0)]]
    .map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [],
  notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [],
  underlays: [PHOTO], nextDrawingItemId: 20 });

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.setItem('draft.trace.on', '1'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
    // The picture's bytes, under the record's id, as INSERT files them.
    const blob = await new Promise(res => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 100;
      const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, 200, 100);
      c.toBlob(res, 'image/png');
    });
    await window.SharedFileStore.saveNamedFile(new File([blob], 'u1', { type: 'image/png' }), 'underlays');
  }, { bucket: BUCKET, f: house() });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(250);
  return h.planFrame(page);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const photo = async page => (await saved(page)).underlays[0];
async function pick(page, at) {
  await page.mouse.click(...at(20, 15));
  await expect(page.locator('#model-rescale')).toBeVisible();
}
async function drag(page, from, to) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(from[0] + 3, from[1] + 3);
  await page.mouse.move(...to, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

test('a press on the picture picks it: RESCALE, MOVE, ROTATE and DELETE come to the foot; a press on bare sheet lets it go', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at);
  for (const id of ['model-move', 'model-rotate', 'delete']) await expect(page.locator(`#${id}`)).toBeVisible();
  await page.mouse.click(...at(10, 25));
  await expect(page.locator('#model-rescale')).toBeHidden();
  // A WALL PICKED gets MOVE and ROTATE as ever, and no RESCALE: that is the
  // picture's verb alone.
  await page.mouse.click(...at(20, 0));
  await expect(page.locator('#model-move')).toBeVisible();
  await expect(page.locator('#model-rescale')).toBeHidden();
});

test('RESCALE: a corner keeps the proportions, scaling about the opposite corner; one UNDO puts it back', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at);
  // A HALF TURN FIRST, so a step stands under the rescale's: UNDO must take
  // back the rescale alone, not jump past it to the turn.
  await page.locator('#model-rotate').click();
  await page.locator('[data-rotate-by="180"]').click();
  await page.locator('[data-rotate-done]').click();
  expect((await photo(page)).turn).toBe(2);
  await page.locator('#model-rescale').click();
  await expect(page.locator('#rescale-bar')).toBeVisible();
  await expect(page.locator('#delete'), 'its row stands over the verbs').toBeHidden();
  // The south-east corner from (30, 20) to (36, 22), a hand OFF the
  // diagonal: the factor is the hand's travel along it, 1.28, about the
  // north-west corner at (10, 10) -- so 25.6 by 12.8, not 26 by 12.
  await drag(page, at(30, 20), at(36, 22));
  let p = await photo(page);
  expect(p.widthFt).toBeCloseTo(25.6, 1);
  expect(p.heightFt).toBeCloseTo(12.8, 1);
  expect(p.x).toBeCloseTo(22.8, 1);
  expect(p.z).toBeCloseTo(16.4, 1);
  await expect(page.locator('#strip-message')).toContainText('UNDO puts it back');
  await page.keyboard.press('Control+z');
  p = await photo(page);
  expect([p.widthFt, p.heightFt, p.x, p.z]).toEqual([20, 10, 20, 15]);
  expect(p.turn, 'the turn under it still stands').toBe(2);
});

test('RESCALE: a side stretches that way only, the opposite side staying put', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at);
  await page.locator('#model-rescale').click();
  // The east side from x 30 to x 36: 26 wide, still 10 tall, the west side at 10.
  await drag(page, at(30, 15), at(36, 15));
  let p = await photo(page);
  expect(p.widthFt).toBeCloseTo(26, 1);
  expect(p.heightFt).toBeCloseTo(10, 1);
  expect(p.x).toBeCloseTo(23, 1);
  // The north side from z 10 up to z 5: 15 tall, the south side at 20.
  await drag(page, at(23, 10), at(23, 5));
  p = await photo(page);
  expect(p.heightFt).toBeCloseTo(15, 1);
  expect(p.z).toBeCloseTo(12.5, 1);
  expect(p.widthFt).toBeCloseTo(26, 1);
  await page.locator('[data-rescale-done]').click();
  await expect(page.locator('#rescale-bar')).toBeHidden();
  await expect(page.locator('#model-rescale')).toBeVisible();
});

test('ROTATE turns the picked picture a quarter; DELETE takes it off and UNDO brings it back', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at);
  await page.locator('#model-rotate').click();
  await page.locator('[data-rotate-by="90"]').click();
  let p = await photo(page);
  expect(p.turn).toBe(1);
  expect([p.widthFt, p.heightFt]).toEqual([10, 20]);
  await page.locator('[data-rotate-done]').click();
  await page.locator('#delete').click();
  expect((await saved(page)).underlays).toHaveLength(0);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).underlays).toHaveLength(1);
});

test('MOVE takes the picked picture in hand, and a drag moves it', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at);
  await page.locator('#model-move').click();
  await expect(page.locator('#strip-message')).toContainText('Drag plan.png');
  await drag(page, at(20, 15), at(24, 19));
  const p = await photo(page);
  expect(p.x).toBeGreaterThan(22);
  expect(p.z).toBeGreaterThan(17);
});
