// A LOOP CLOSES THE WAY A RUN ENDS (Movie, 22 Oct): "for when a user is
// completing a shape like FLOOR, ROOF or SHAPE once the user is ready to make
// the LAST / at FIRST point location by DOUBLE clicking, or pressing ENTER or
// SPACEBAR twice quickly" -- and, asked the same day, "dimensions and lines
// too should work that way too". One click, ENTER or SPACE is a corner at the
// cursor; a double-click, or the same key twice quickly with the cursor
// still, closes the loop on its first corner. Below three corners nothing
// closes and the strip says so. (DIMENSION keeps its own rule -- once ends;
// tests/dim-once.spec.js.)
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
const house = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50, roofPitch: 3,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 0, 30, 10, 20, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
// A bare sheet for the outline, which builds the house.
const bare = () => ({ ...house(), levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, walls: [] });
async function open(page, level = 5, f = house()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(`/MODEL.html?level=${level}&lpane=build&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); }
async function hover(page, at, x, z) { await page.mouse.move(...at(x, z)); await page.waitForTimeout(120); }
// THE SAME KEY TWICE, QUICKLY: well inside the 450 ms the page allows.
async function twice(page, key) { await page.keyboard.press(key); await page.keyboard.press(key); await page.waitForTimeout(80); }
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const rays = async page => JSON.parse(await page.locator('#plan').getAttribute('data-tracking-rays') || 'null');
const r2 = n => Math.round(n * 100) / 100;
const ring = loop => loop.map(p => [r2(p.x), r2(p.z)]);
// Through the pane the key lives on: FLOOR on BUILD, SHAPE and DIMENSION on DRAFTING.
const arm = (page, key) => h.armFromRail(page, key);
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

test('a double-click on a FLOOR is its last corner and closes it on the first; the second click leaves no corner behind', async ({ page }) => {
  const { at } = await open(page, 3);
  await arm(page, 'floor');
  for (const [x, z] of [[2, 2], [12, 2], [12, 8], [2, 8]]) await press(page, at, x, z);
  // A SECOND PRESS ON THE LAST CORNER, slow, is no corner on top of it.
  await page.waitForTimeout(600);
  await press(page, at, 2, 8);
  await hover(page, at, 6, 5);
  expect((await rays(page))?.nodes, 'four corners in hand, not five').toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
  await page.mouse.dblclick(...at(2, 8));
  await page.waitForTimeout(120);
  const d = await saved(page);
  expect(d.floors, 'one floor, closed').toHaveLength(1);
  expect(ring(d.floors[0].points)).toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
  // NOTHING IN HAND AFTER: the double's second click started no new floor.
  await hover(page, at, 6, 5);
  expect(await rays(page), 'no trace in hand').toBeNull();
});

test('on a SHAPE, ENTER once is a corner at the cursor and ENTER twice quickly closes on the first', async ({ page }) => {
  const { at } = await open(page, 3);
  await arm(page, 'shape');
  for (const [x, z] of [[2, 2], [12, 2], [12, 8]]) await press(page, at, x, z);
  await hover(page, at, 2, 8);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  // ONE PRESS, ONE CORNER: four in hand now, nothing closed.
  await hover(page, at, 6, 5);
  expect((await rays(page))?.nodes, 'the fourth corner joined the trace').toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
  expect((await saved(page)).shapes, 'nothing closed by one ENTER').toHaveLength(0);
  // ANOTHER SLOW ENTER ON THE SAME CORNER is no corner on top of it.
  await hover(page, at, 2, 8);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await hover(page, at, 6, 5);
  expect((await rays(page))?.nodes, 'still four').toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
  await hover(page, at, 2, 8);
  await twice(page, 'Enter');
  await expect(strip(page)).toContainText('SHAPE closed');
  const d = await saved(page);
  expect(d.shapes).toHaveLength(1);
  expect(ring(d.shapes[0].points)).toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
});

test('SPACE twice quickly closes the single slope ROOF outline on its first corner; its first press on the last corner is no corner', async ({ page }) => {
  const { at } = await open(page);
  await shedToThree(page, at);
  await press(page, at, -1, 10);
  await twice(page, ' ');
  await expect(strip(page)).toContainText('SINGLE SLOPE ROOF made');
  const roof = (await saved(page)).roofs[0];
  expect(ring(roof.points || roof.footprint)).toEqual([[-1, -2], [31, -2], [31, 10], [-1, 10]]);
});

test('a double-click ON THE FIRST CORNER closes on its first click, and its second starts no new loop', async ({ page }) => {
  const { at } = await open(page, 3);
  await arm(page, 'floor');
  for (const [x, z] of [[2, 2], [12, 2], [12, 8], [2, 8]]) await press(page, at, x, z);
  await page.mouse.dblclick(...at(2, 2));
  await page.waitForTimeout(120);
  const d = await saved(page);
  expect(d.floors).toHaveLength(1);
  expect(ring(d.floors[0].points)).toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
  await hover(page, at, 6, 5);
  expect(await rays(page), 'no new floor started at the first corner').toBeNull();
});

test('below three corners nothing closes: the strip says so and the corners stay, to carry on from', async ({ page }) => {
  const { at } = await open(page, 3);
  await arm(page, 'floor');
  await press(page, at, 2, 2);
  await hover(page, at, 12, 2);
  await twice(page, 'Enter');
  await expect(strip(page)).toContainText('FLOOR needs three corners');
  expect((await saved(page)).floors).toHaveLength(0);
  await hover(page, at, 6, 5);
  expect((await rays(page))?.nodes, 'both corners still in hand').toEqual([[2, 2], [12, 2]]);
  await press(page, at, 12, 8);
  await page.mouse.dblclick(...at(2, 8));
  await page.waitForTimeout(120);
  const d = await saved(page);
  expect(d.floors).toHaveLength(1);
  expect(ring(d.floors[0].points)).toEqual([[2, 2], [12, 2], [12, 8], [2, 8]]);
});

test('an OUTLINE closes by ENTER twice as a press on its first corner does', async ({ page }) => {
  const { at } = await open(page, 3, bare());
  await h.selectTool(page, 'outline');
  for (const [x, z] of [[0, 0], [30, 0], [30, 20]]) await press(page, at, x, z);
  await hover(page, at, 0, 20);
  await twice(page, 'Enter');
  await page.waitForTimeout(300);
  const d = await saved(page);
  const [master] = d.boneyardOutlines || [];
  expect(master, 'the outline closed and the house was built from it').toBeTruthy();
  const o = master.points[0];
  expect(master.points.map(p => [r2(p.x - o.x), r2(p.z - o.z)])).toEqual([[0, 0], [30, 0], [30, 20], [0, 20]]);
});
