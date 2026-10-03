// THE BONE BUILDS THE HOUSE THE DRAFTER TRACED (BONEYARD PR 3b).
//
// Movie, 3 Oct: the drive-thru's "CLICK HERE to draw house OUTLINE", then
// "main floor -> garage (if attached) -> bone builds, like the premade
// houses", for every type, with automatic windows and doors. His rulings on
// the roofs: a bungalow + garage is one roof, a garage on a lower plate (2
// STOREY + garage) keeps its own; a bilevel's entry is placed for him after
// the garage is traced.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The board, the type, and CLICK HERE to draw it.
async function drawType(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-outline').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  // The sign slides down for 220 ms and takes a press until it is gone: a
  // corner in its path would land on the sign, not the plan.
  await expect(page.locator('#drivethru')).toBeHidden();
}

async function trace(page, corners) {
  const { at } = await h.planFrame(page);
  for (const [x, z] of [...corners, corners[0]]) await page.mouse.click(...at(x, z));
}

// The bone's second press offers BUILD; BUILD builds off the trace.
async function build(page) {
  await page.locator('#bone').click();
  await expect(page.locator('#build-choice')).toBeVisible();
  await page.locator('[data-build-choice-build]').click();
  await page.waitForTimeout(300);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const HOUSE = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
// In front of the house, against its front wall, two feet past its right corner.
const GARAGE = [[-2, 8], [12, 8], [12, 24], [-2, 24]];

test('a traced 1 STOREY + GARAGE is built whole, under one roof', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'bungalow-garage');
  await trace(page, HOUSE);
  await expect(page.locator('#strip-message')).toContainText('Now trace the garage');
  await trace(page, GARAGE);
  await expect(page.locator('#strip-message')).toContainText('Press the bone to build your 1 STOREY + GARAGE');
  const d = await build(page);

  const main = d.outlines.filter(o => Number(o.levelId) === 3);
  expect(main.filter(o => o.garage).length, 'the garage body').toBe(1);
  expect(main.filter(o => !o.garage).length, 'the house body').toBe(1);
  expect(d.boneyardOutlines, 'the trace came off with the build').toEqual([]);
  expect(d.walls.filter(w => Number(w.levelId) === 1).length, 'concrete under it').toBeGreaterThan(0);
  expect(d.floors.length, 'a floor').toBeGreaterThan(0);
  expect(d.roofs.length, 'one roof over house and garage').toBe(1);
  const doors = d.fenestrations.filter(f => f.type === 'door');
  expect(doors.filter(f => f.garage).length, 'overhead doors on the garage').toBeGreaterThan(0);
  expect(doors.filter(f => !f.garage).length, 'a front door and a man door').toBeGreaterThanOrEqual(2);
  expect(d.fenestrations.filter(f => f.type === 'window').length, 'windows dealt').toBeGreaterThan(0);

  // ONE CTRL+Z takes the house and puts the trace back.
  await page.locator('#model-undo').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const back = await h.savedDrawing(page);
  expect(back.walls.length, 'the house went').toBe(0);
  expect(back.boneyardOutlines.length, 'the two traced loops came back').toBe(2);
});

test('a traced 2 STOREY + GARAGE keeps the garage under its own lower roof', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'twoStorey-garage');
  await trace(page, HOUSE);
  await trace(page, GARAGE);
  const d = await build(page);
  expect(d.walls.filter(w => Number(w.levelId) === 5).length, 'the upper storey').toBeGreaterThan(0);
  expect(d.roofs.length, 'two roofs').toBe(2);
  expect(d.roofs.filter(r => r.garage).length, 'one of them the garage\'s').toBe(1);
});

test('a traced BILEVEL + GARAGE gets its entry placed for it', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'bilevel-garage');
  await trace(page, HOUSE);
  await trace(page, GARAGE);
  const d = await build(page);
  expect(d.levels.some(l => Number(l.id) === 2), 'the ENTRY level').toBe(true);
  const entry = d.outlines.find(o => Number(o.levelId) === 2);
  expect(entry, 'the entry body').toBeTruthy();
  // STRADDLING THE GARAGE LINE (x = -2): six feet either side, on the front.
  const xs = entry.points.map(p => p.x), zs = entry.points.map(p => p.z);
  expect([Math.min(...xs), Math.max(...xs), Math.max(...zs), Math.min(...zs)]).toEqual([-8, 4, 8, 2]);
  expect(d.stairs.length, 'the up and down flights').toBeGreaterThanOrEqual(2);
});

test('a traced DETACHED GARAGE is built on its own loop', async ({ page }) => {
  await open(page);
  await drawType(page, 'detachedGarage', 'detached-thickened');
  await trace(page, [[0, 0], [14, 0], [14, 18], [0, 18]]);
  await expect(page.locator('#strip-message')).toContainText('Press the bone to build your garage');
  const d = await build(page);
  const g = d.outlines.filter(o => o.garage && o.detached);
  expect(g.length, 'one detached garage').toBe(1);
  const xs = g[0].points.map(p => p.x), zs = g[0].points.map(p => p.z);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([0, 14, 0, 18]);
  expect(d.fenestrations.some(f => f.garage), 'its overhead door').toBe(true);
  expect(d.roofs.length, 'its roof').toBe(1);
});

// A garage deeper than the room, so the room takes 18 ft at the house end
// and the rest keeps a lower roof of its own.
const DEEP_GARAGE = [[-2, 8], [12, 8], [12, 32], [-2, 32]];

test('a traced 2 STOREY + ROOM OVER puts the room on the 18 ft at the house end', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'twoStorey-over');
  await trace(page, HOUSE);
  await trace(page, DEEP_GARAGE);
  const d = await build(page);
  const room = d.outlines.filter(o => Number(o.levelId) === 5 && !o.garage)
    .find(o => Math.max(...o.points.map(p => p.z)) > 8);
  expect(room, 'the room over the garage, on 2ND FL').toBeTruthy();
  expect(Math.max(...room.points.map(p => p.z)), '18 ft out from the house front').toBe(26);
  expect(d.roofs.length, 'one over house and room, one lower over the rest').toBe(2);
  expect(d.roofs.filter(r => r.garage).length).toBe(1);
});

test('a traced MODIFIED BILEVEL gets its entry and its room over the garage', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'modifiedBilevel');
  await trace(page, HOUSE);
  await trace(page, DEEP_GARAGE);
  const d = await build(page);
  expect(d.levels.some(l => Number(l.id) === 2), 'ENTRY').toBe(true);
  expect(d.levels.some(l => Number(l.id) === 4), 'OVER GARAGE').toBe(true);
  expect(d.outlines.some(o => Number(o.levelId) === 4), 'the room').toBe(true);
  expect(d.stairs.length, 'three flights').toBeGreaterThanOrEqual(3);
});
