// COPY A BEAM ROW AND ITS POSTS COME TOO (Movie, 20 Oct).
//
// "i COPYed the BEAM - when this happens the COLUMNS and upper beams and pad
// footing for the whole building should get coppied and pasted" -- "i need a
// row along the inner column walls that will support the 2nd floor owjs but
// on the main floor i want to use TJI so i will have a 2nd row of beams for
// each main floor set of TJI in the middle of the suite". So COPY on one
// piece takes the whole row and every post on it, each with its pad; PASTE
// puts it down selected, ready to MOVE; one UNDO takes the paste back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// An L on MAIN FL: 40 wide, 32 deep on the left, the right half stopping at
// z = 4. A row of beam in two pieces post to post -- the way AUTO BEAM lays
// one -- runs across the deep half at z = 8, x -20 to 0, on a post at the
// joint and another mid-piece; a third post stands off it.
const L = [[-20, -16], [20, -16], [20, 4], [0, 4], [0, 16], [-20, 16]];
const P = (x, z) => ({ x, y: 0, z });
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'outline-l', levelId: 3, garage: false, points: L.map(([x, z]) => P(x, z)) }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [
    { id: 1, start: P(-20, 8), end: P(-8, 8), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
    { id: 2, start: P(-8, 8), end: P(0, 8), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
  ],
  columns: [
    { id: 1, point: P(-8, 8), levelId: 1, view: 'foundation', footing: 'pad36', auto: true },
    { id: 2, point: P(-14, 8), levelId: 1, view: 'foundation', footing: 'pad36', auto: true },
    { id: 3, point: P(-10, 12), levelId: 1, view: 'foundation', footing: 'pad36' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, f = drawing(), url = '/MODEL.html') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
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
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
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
const pt = c => [c.point.x, c.point.z].map(r2);


test('COPY on one piece takes the whole row and its posts with their pads; PASTE puts them down', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await page.locator('#copy').click();
  await expect(page.locator('#strip-message')).toContainText('2 posts with their pads');
  await page.locator('#paste').click();
  const d = await saved(page);
  expect(d.beams, 'both pieces of the row, twice').toHaveLength(4);
  const copies = d.beams.filter(b => ![1, 2].includes(Number(b.id)));
  expect(copies.map(seg).sort()).toEqual([[-20, 8, -8, 8], [-8, 8, 0, 8]]);
  expect(d.columns, 'the two posts on the row, not the one off it').toHaveLength(5);
  const newPosts = d.columns.filter(c => ![1, 2, 3].includes(Number(c.id)));
  expect(newPosts.map(pt).sort()).toEqual([[-14, 8], [-8, 8]]);
  expect(newPosts.every(c => c.footing === 'pad36'), 'each with its pad').toBe(true);
  expect(newPosts.every(c => Number(c.levelId) === 1)).toBe(true);
});

test('pasted, it is selected: MOVE slides the new row and its posts to the middle of the suite', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await page.locator('#copy').click();
  await page.locator('#paste').click();
  await page.locator('#model-move').click();
  await drag(page, at, [-4, 8], [-4, 0]);
  const d = await saved(page);
  const copies = d.beams.filter(b => ![1, 2].includes(Number(b.id)));
  expect(copies.every(b => r2(b.start.z) === 0 && r2(b.end.z) === 0), 'the new row at z = 0').toBe(true);
  const newPosts = d.columns.filter(c => ![1, 2, 3].includes(Number(c.id)));
  expect(newPosts.map(pt).sort(), 'its posts went with it').toEqual([[-14, 0], [-8, 0]]);
  expect(d.beams.filter(b => [1, 2].includes(Number(b.id))).map(seg).sort(), 'the first row stayed')
    .toEqual([[-20, 8, -8, 8], [-8, 8, 0, 8]]);
});

test('one UNDO takes the whole paste back', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await page.locator('#copy').click();
  await page.locator('#paste').click();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect(d.beams).toHaveLength(2);
  expect(d.columns).toHaveLength(3);
});
