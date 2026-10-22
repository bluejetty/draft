// A GABLE ROOF, DRAWN BY HAND ON A STOREY.
//
// Movie, 22 Oct: "can we make a 2-sided ... gable roof with 2 edges
// specified (opposite edges PEAK will be in the middle and eaves on outside
// (the 2nd 'eave direction' q from the 1 slope would be answered when they
// place 2nd edge"; "for this one ASK overhang (and pitch)"; "maybe the first
// draw of it place the edges of the roof where the user places the ends of
// his EDGE marks"; "and then allow him to change its shape afterwards".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1, lv) => [W(`${p}1`, [x0, z0], [x1, z0], lv), W(`${p}2`, [x1, z0], [x1, z1], lv),
  W(`${p}3`, [x1, z1], [x0, z1], lv), W(`${p}4`, [x0, z1], [x0, z0], lv)];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50, roofPitch: 3,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 10, 20, 5, 15, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=5&lpane=build&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// THE TWO EAVE LINES: along the main floor's front wall (z = 0) and its
// back wall (z = 20), each pressed near the wall's ends.
async function twoLines(page, at) {
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="gable"]').click();
  await expect(strip(page)).toContainText('GABLE ROOF 1/3');
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, -0.2);
  await expect(strip(page)).toContainText('GABLE ROOF 2/3');
  await press(page, at, 0.3, 19.8);
  await press(page, at, 29.7, 20.2);
}
const ask = page => page.locator('[data-gable-ask]');

test('two eave lines, then the overhang and pitch asked: eaves out past the lines, ends at the marks', async ({ page }) => {
  const { at } = await open(page);
  await twoLines(page, at);
  await expect(ask(page)).toBeVisible();
  await expect(page.locator('[data-gable-pitch]'), 'the PROJECT pitch to start').toHaveValue('3');
  await page.locator('[data-gable-eave]').fill(`1'-6"`);
  await page.locator('[data-gable-pitch]').fill('6');
  await page.locator('[data-gable-make]').click();
  await expect(strip(page)).toContainText('GABLE ROOF made at 6/12');
  await expect(ask(page)).toBeHidden();
  const roof = (await saved(page)).roofs[0];
  expect(roof.edges).toEqual(['eave', 'gable', 'eave', 'gable']);
  expect(roof.points.map(p => [Number(p.x.toFixed(3)), Number(p.z.toFixed(3))]), 'eaves 1\'-6" out, ends where the lines end')
    .toEqual([[0, -1.5], [30, -1.5], [30, 21.5], [0, 21.5]]);
  expect(roof.edgeOverhang).toEqual([1.5, 0, 1.5, 0]);
  expect(roof.pitch).toBe(6);
  expect(roof.levelId, 'on the ROOF plan').toBe(7);
  expect(roof.drawnOn, 'drawn on the 2nd floor').toBe(5);
  expect(roof.sourceLevelId, 'bearing on the main floor').toBe(3);
  expect(roof.follows).toBe('none');
});

test('the second line drawn backwards still pairs each end with its own', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="gable"]').click();
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, -0.2);
  await press(page, at, 29.7, 20.2);
  await press(page, at, 0.3, 19.8);
  await page.locator('[data-gable-eave]').fill(`2'`);
  await page.keyboard.press('Enter');
  const roof = (await saved(page)).roofs[0];
  expect(roof.points.map(p => [Number(p.x.toFixed(3)), Number(p.z.toFixed(3))]))
    .toEqual([[0, -2], [30, -2], [30, 22], [0, 22]]);
});

test('a second line that does not run the same way is refused', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="gable"]').click();
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, -0.2);
  await press(page, at, 30.2, 0.3);
  await press(page, at, 29.8, 19.7);
  await expect(strip(page)).toContainText('must run the same way');
  await expect(ask(page)).toBeHidden();
});

test('CANCEL in the questions puts it down, and nothing is made', async ({ page }) => {
  const { at } = await open(page);
  await twoLines(page, at);
  await page.locator('[data-gable-cancel]').click();
  await expect(strip(page)).toContainText('GABLE ROOF put down');
  await expect(ask(page)).toBeHidden();
  expect((await saved(page)).roofs || []).toEqual([]);
});

test('a bad pitch is refused with its reason', async ({ page }) => {
  const { at } = await open(page);
  await twoLines(page, at);
  await page.locator('[data-gable-pitch]').fill('abc');
  await page.locator('[data-gable-make]').click();
  await expect(strip(page)).toContainText('Type the pitch');
  await expect(ask(page)).toBeVisible();
});
