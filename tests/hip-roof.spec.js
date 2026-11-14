// HIP ROOF OFF THE WALL LINE (jb, 13 Nov 2026).
//
// "can i make one where i draw an outline and it will make a hip/pyramid
// style roof from it" -- "i'd like to draw the line on the ext wall and make
// the roof create the desired overhang". A fourth option on the DRAW A ROOF
// card: the outline clicked ON the exterior wall line, pushed out by the
// PROJECT's overhang, every edge an EAVE; then any edge pressed is a GABLE
// end (pressed again, an eave), and ENTER finishes. jb chose "HIP ROOF plus
// gable ends" on the card.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1, lv) => [W(`${p}1`, [x0, z0], [x1, z0], lv), W(`${p}2`, [x1, z0], [x1, z1], lv),
  W(`${p}3`, [x1, z1], [x0, z1], lv), W(`${p}4`, [x0, z1], [x0, z0], lv)];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// MAIN FL 30 x 20; 2ND FL set back 10 ft off its z = 0 side. HAND ROOF on,
// PROJECT overhang 2 (the default), SIDE OVERHANG 1.
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  roofPitch: 3, roofSideOverhang: 1, autoRoof: false,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 0, 30, 10, 20, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page, level = 5) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
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
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
}
const roofsNow = page => page.evaluate(() => (drawing.roofs || []).map(r => ({
  id: r.id, levelId: r.levelId, drawnOn: r.drawnOn, sourceLevelId: r.sourceLevelId, edges: r.edges.slice(),
  overhang: r.overhang, edgeOverhang: r.edgeOverhang.slice(), pitch: r.pitch, fascia: r.fascia, follows: r.follows,
  points: r.points.map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]),
  footprint: (r.footprint || []).map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]) })));
// The wall ring of the 2ND FL box, clicked on the wall line and closed.
const WALL_RING = [[0, 10], [30, 10], [30, 20], [0, 20]];
async function drawHip(page, at, corners = WALL_RING) {
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await page.locator('[data-roof-kind="hip"]').click();
  await expect(strip(page)).toContainText('HIP ROOF 1/2');
  for (const [x, z] of corners) await press(page, at, x, z);
  await press(page, at, ...corners[0]);
  await expect(strip(page)).toContainText('HIP ROOF 2/2');
}

test('the wall outline, closed, then ENTER: a hip with the PROJECT overhang added outward, every edge an eave', async ({ page }) => {
  const { at } = await open(page);
  await drawHip(page, at);
  await page.keyboard.press('Enter');
  await expect(strip(page)).toContainText('HIP ROOF made at 3/12, every edge an eave');
  const [roof] = await roofsNow(page);
  expect(roof.points, 'the wall ring pushed out 2 ft on every side').toEqual([[-2, 8], [32, 8], [32, 22], [-2, 22]]);
  expect(roof.footprint, 'the wall ring kept as the footprint').toEqual(WALL_RING);
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'eave']);
  expect(roof.overhang).toBe(2);
  expect(roof.edgeOverhang).toEqual([2, 2, 2, 2]);
  expect(roof.pitch, 'the PROJECT pitch').toBe(3);
  expect(roof.follows, 'a hand roof from birth').toBe('none');
  expect(roof.levelId).toBe(7);
  expect(roof.drawnOn, 'drawn on the 2nd floor').toBe(5);
  expect(roof.sourceLevelId, 'bearing on the floor below').toBe(3);
  expect(await page.evaluate(() => [activeTool, selection.map(e => `${e.type}:${e.item.id}`)])).toEqual(['select', [`roof:${roof.id}`]]);
});

test('edges pressed are GABLE ends with the SIDE OVERHANG, pressed again eaves; ENTER keeps the last answer', async ({ page }) => {
  const { at } = await open(page);
  await drawHip(page, at);
  // The left end (x = -2 once pushed out), then the right (x = 32).
  await press(page, at, -2, 15);
  await expect(strip(page)).toContainText('1 GABLE end');
  await press(page, at, 32, 15);
  await expect(strip(page)).toContainText('2 GABLE ends');
  // The right end once more: an eave again, and the ring follows (its
  // edge is back out at x = 32, which is where the next press finds it).
  await press(page, at, 31, 15);
  await expect(strip(page)).toContainText('1 GABLE end');
  await press(page, at, 32, 15);
  await expect(strip(page)).toContainText('2 GABLE ends');
  await page.keyboard.press('Enter');
  await expect(strip(page)).toContainText('HIP ROOF made at 3/12, 2 GABLE ends');
  const [roof] = await roofsNow(page);
  expect(roof.edges).toEqual(['eave', 'gable', 'eave', 'gable']);
  expect(roof.edgeOverhang, 'eaves 2 ft out, gable ends 1 ft (SIDE OVERHANG)').toEqual([2, 1, 2, 1]);
  expect(roof.points).toEqual([[-1, 8], [31, 8], [31, 22], [-1, 22]]);
  expect(roof.footprint).toEqual(WALL_RING);
});

test('on the ROOF plan the card offers the HIP ROOF beside the ROOF PIECE; a press off every edge makes nothing; Escape puts it down; UNDO takes it back', async ({ page }) => {
  const { at } = await open(page, 7);
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await expect(page.locator('[data-roof-kind="shed"]')).toBeHidden();
  await expect(page.locator('[data-roof-kind="piece"]')).toBeVisible();
  await expect(page.locator('[data-roof-kind="hip"]')).toBeVisible();
  await page.locator('[data-roof-kind="hip"]').click();
  for (const [x, z] of WALL_RING) await press(page, at, x, z);
  await press(page, at, ...WALL_RING[0]);
  await expect(strip(page)).toContainText('HIP ROOF 2/2');
  await press(page, at, 15, 40);
  await expect(strip(page)).toContainText('Click ON an edge');
  expect(await roofsNow(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(strip(page)).toContainText('HIP ROOF put down');
  expect(await roofsNow(page)).toEqual([]);
  // Drawn again and finished: on the ROOF plan it bears on the top storey
  // and is drawn on no storey of its own.
  await page.evaluate(() => setTool('select'));
  await drawHip(page, at);
  await page.keyboard.press('Enter');
  await expect(strip(page)).toContainText('HIP ROOF made');
  const [roof] = await roofsNow(page);
  expect(roof.drawnOn).toBeUndefined();
  expect(roof.sourceLevelId, 'bearing on the top storey, 2ND FL').toBe(5);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect(await roofsNow(page)).toEqual([]);
});
