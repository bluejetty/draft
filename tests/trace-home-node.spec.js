// THE TRACE IN HAND FINDS ITS OWN FIRST CORNER (Movie, 21 Oct, closing a
// single slope roof): "having a hard time to complete the roof, can we make
// the CROSS LINES (perpendicular locations) and the NODE SNAP on the first
// point so the last point can find first point easily". The roof's outline
// -- and a floor's, a shape's -- now sends the neon cross lines from every
// corner it has, and once three corners stand its first corner is a node:
// it glows under the hand and a press near it lands on it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1, lv) => [W(`${p}1`, [x0, z0], [x1, z0], lv), W(`${p}2`, [x1, z0], [x1, z1], lv),
  W(`${p}3`, [x1, z1], [x0, z1], lv), W(`${p}4`, [x0, z1], [x0, z0], lv)];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// The shed roof spec's house: MAIN FL 30 x 20, the 2ND FL set back 10 ft.
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50, roofPitch: 3,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 0, 30, 10, 20, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page, level = 5) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(`/MODEL.html?level=${level}&lpane=build&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); }
async function hover(page, at, x, z) { await page.mouse.move(...at(x, z)); await page.waitForTimeout(120); }
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const rays = async page => JSON.parse(await page.locator('#plan').getAttribute('data-tracking-rays') || 'null');
const snapNode = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-node') || 'null');
const r2 = n => Math.round(n * 100) / 100;
// The single slope roof up to its outline stage, with three corners down.
async function shedToThree(page, at) {
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await page.locator('[data-roof-kind="shed"]').click();
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, -0.2);
  await press(page, at, 15, -1.2);
  await expect(strip(page)).toContainText('3/3');
  for (const [x, z] of [[-1, -2], [31, -2], [31, 10]]) await press(page, at, x, z);
}

test('the roof outline in hand sends cross lines from its corners, its first corner glows, and the last corner lands on its line', async ({ page }) => {
  const { at } = await open(page);
  await shedToThree(page, at);
  await hover(page, at, 10, 5);
  const r = await rays(page);
  expect(r?.nodes, 'rays from the three corners in hand').toEqual([[-1, -2], [31, -2], [31, 10]]);
  // THE FIRST CORNER GLOWS under the hand, a node now.
  await hover(page, at, -1.1, -2.1);
  expect(await snapNode(page)).toEqual([-1, -2]);
  // THE FOURTH CORNER, a hair off the first corner's plumb line, lands ON it.
  await press(page, at, -1.15, 10);
  await press(page, at, -1.1, -2.1);
  await expect(strip(page)).toContainText('SINGLE SLOPE ROOF made');
  const roof = (await saved(page)).roofs[0];
  const ring = roof.points || roof.footprint;
  expect(ring.map(p => [r2(p.x), r2(p.z)])).toEqual([[-1, -2], [31, -2], [31, 10], [-1, 10]]);
});

test('with two corners down the first is not yet a node: a press near it is a corner there', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="shed"]').click();
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, -0.2);
  await press(page, at, 15, -1.2);
  for (const [x, z] of [[-1, -2], [31, -2]]) await press(page, at, x, z);
  await hover(page, at, 10, 5);
  expect((await rays(page))?.nodes, 'rays from both').toEqual([[-1, -2], [31, -2]]);
  await hover(page, at, -1.1, -2.1);
  expect(await snapNode(page), 'no node on the first corner yet').toBeNull();
});

test('a FLOOR traced by hand gets the same cross lines and the same first-corner node', async ({ page }) => {
  const { at } = await open(page, 3);
  await page.locator('[data-tool-key="floor"]').click();
  await expect(page.locator('[data-tool-key="floor"]')).toHaveAttribute('aria-pressed', 'true');
  for (const [x, z] of [[2, 2], [12, 2], [12, 8]]) await press(page, at, x, z);
  await hover(page, at, 6, 5);
  expect((await rays(page))?.nodes).toEqual([[2, 2], [12, 2], [12, 8]]);
  await hover(page, at, 2.1, 2.1);
  expect(await snapNode(page)).toEqual([2, 2]);
  await press(page, at, 2.15, 8);
  await press(page, at, 2.1, 2.1);
  const floor = (await saved(page)).floors[0];
  expect(floor, 'the floor closed on its first corner').toBeTruthy();
  expect(floor.points.map(p => [r2(p.x), r2(p.z)])).toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
});
