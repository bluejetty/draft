// ONE CLICK IN THE MIDDLE OF A WALL DIMENSIONS BOTH ITS FACES (Movie, 25 Oct:
// "when the use DOUBLE CLICKS on a wall, the dimension will choose BOTH sides
// of the wall and show the dimension between (usually 3 1/2" or 5 1/2")", then
// "how about if the user clicks in the middle of a wall it does that ... one
// click not 2"). The east wall here is a 2x6 drawn on its left line at x 10,
// so its body runs from x 9 6/12" (9.5417) to x 10.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  boneyardShelves: [], groups: [], levelLocks: [], underlays: [], nextDrawingItemId: 20,
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z, button = 'left') {
  await page.mouse.move(...at(x, z));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(x, z), { button });
  await page.waitForTimeout(80);
}
async function armDimension(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await h.armFromRail(page, 'dimension');
}
const saved = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};
const hand = d => (d.dimensions || []).filter(x => x.auto === false);
const r3 = n => Math.round(n * 1000) / 1000;
const WALL_FT = 5.5 / 12;
// CLOSE ENOUGH TO SEE A 5 1/2" WALL'S BODY: zoomed in on it.
async function zoomOn(page, at, x, z) {
  await page.mouse.move(...at(x, z));
  for (let i = 0; i < 6; i += 1) { await page.mouse.wheel(0, -200); await page.waitForTimeout(40); }
  await page.waitForTimeout(150);
  return (await h.planFrame(page)).at;
}

test('one click in the middle of a wall puts points on both its faces; the line placed reads the wall', async ({ page }) => {
  let { at } = await open(page);
  at = await zoomOn(page, at, 9.77, 0);
  await armDimension(page);
  await press(page, at, 10 - WALL_FT / 2, 0);
  await expect(strip(page)).toContainText('both faces of the wall');
  await expect(strip(page)).toContainText('2 points');
  await page.keyboard.press(' ');
  await press(page, at, 9.77, 1.5);
  await page.keyboard.press('Enter');
  await expect(strip(page)).toContainText('done');
  const made = hand(await saved(page));
  expect(made, 'one dimension, the wall').toHaveLength(1);
  const xs = [made[0].start.x, made[0].end.x].map(r3).sort((a, b) => a - b);
  expect(xs).toEqual([r3(10 - WALL_FT), 10]);
});

test('in a string, the wall\'s two faces join the chain: a point in the room, then the wall, gives the room piece and the wall', async ({ page }) => {
  let { at } = await open(page);
  at = await zoomOn(page, at, 9.77, 0);
  await armDimension(page);
  await press(page, at, 8, 0);
  await press(page, at, 10 - WALL_FT / 2, 0);
  await expect(strip(page)).toContainText('3 points');
  await page.keyboard.press(' ');
  await press(page, at, 9, 1.5);
  await page.keyboard.press('Enter');
  const made = hand(await saved(page));
  const lens = made.map(d => r3(Math.abs(d.end.x - d.start.x))).sort((a, b) => a - b);
  expect(lens).toEqual([r3(WALL_FT), r3(2 - WALL_FT)]);
});

test('a click on a face, outside the wall, is that face alone', async ({ page }) => {
  let { at } = await open(page);
  at = await zoomOn(page, at, 9.77, 0);
  await armDimension(page);
  await press(page, at, 10.1, 0);
  await expect(strip(page)).toContainText('the next point');
  await expect(strip(page)).not.toContainText('both faces');
});
