// A FIXTURE STAYS WHERE IT STANDS WHEN THE WALL BEHIND IT IS DELETED.
//
// Movie, 21 Oct: "rather than 'attaching' the toilet and shower etc to the
// WALL behind it ... so that a user can delete the walls behind these items
// without them disappearing"; then, of keeping them free: "leave the item and
// i can either leave it in position or move to attach to a wall in new
// location".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const FX = (id, kind, offset, width, depth, more = {}) => ({ id, wallId: 'back', levelId: 3, view: 'plan',
  kind, offset, width, depth, side: 1, ...more });
// THE BACK WALL along z = 0, the tub's end wall at x = 20, another wall at z = 9.
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [W('back', [0, 0], [20, 0]), W('end', [20, 0], [20, 9]), W('far', [0, 9], [20, 9])],
  fixtures: [FX('loo', 'toilet', 3, 1.7, 2.4), FX('tb', 'tub', 0, 5, 2.5, { endWallId: 'end', dir: -1 })],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// EACH FIXTURE'S FOOTPRINT, as the plan draws it.
const footprints = (page, d) => page.evaluate(d => Object.fromEntries(d.fixtures.map(fx => {
  const geo = window.DraftFixtureGeometry.fixtureGeometry(d.walls, fx);
  return [fx.id, geo && geo.corners.map(p => [Number(p.x.toFixed(3)), Number(p.z.toFixed(3))])];
})), d);
async function deleteBack(page, at) {
  await page.mouse.click(...at(10, 0));
  await page.waitForTimeout(100);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
}

test('deleting the wall behind them leaves the toilet and the tub where they stood', async ({ page }) => {
  const { at } = await open(page);
  const before = await footprints(page, await saved(page));
  expect(before.loo && before.tb, 'both drawn on their wall').toBeTruthy();
  await deleteBack(page, at);
  const d = await saved(page);
  expect(d.walls.map(w => w.id).sort()).toEqual(['end', 'far']);
  expect(d.fixtures.map(f => f.id).sort(), 'still there').toEqual(['loo', 'tb']);
  const loo = d.fixtures.find(f => f.id === 'loo');
  expect(loo.wallId).toBeNull();
  expect(loo.host.start).toEqual({ x: 0, y: 0, z: 0 });
  // THE TUB lost a wall of its alcove too: a plain tub the length it had.
  const tb = d.fixtures.find(f => f.id === 'tb');
  expect(tb.endWallId).toBeUndefined();
  const after = await footprints(page, d);
  const same = (a, b, what) => a.forEach((p, i) => p.forEach((v, k) => expect(v, what).toBeCloseTo(b[i][k], 1)));
  same(after.loo, before.loo, 'the toilet exactly where it stood');
  same(after.tb, before.tb, 'the tub exactly where it stood');
  // AND A RELOAD KEEPS THEM.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect((await saved(page)).fixtures.find(f => f.id === 'loo').host).toBeTruthy();
});

test('UNDO puts the wall back and hangs them on it again', async ({ page }) => {
  const { at } = await open(page);
  await deleteBack(page, at);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect(d.walls.map(w => w.id).sort()).toEqual(['back', 'end', 'far']);
  const loo = d.fixtures.find(f => f.id === 'loo');
  expect(loo.wallId).toBe('back');
  expect(loo.host).toBeUndefined();
  expect(d.fixtures.find(f => f.id === 'tb').endWallId).toBe('end');
});

// A FIXTURE IN THE SELECTION IS A GRAB: pressed once, then dragged.
async function drag(page, at, from, to) {
  await page.mouse.click(...at(...from));
  await page.waitForTimeout(100);
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(...at(...to), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test('a free toilet drags anywhere, and let go by a wall it hangs on that wall', async ({ page }) => {
  const { at } = await open(page);
  await deleteBack(page, at);
  // THE TOILET'S MIDDLE is about (3, 1.4); off into the room, both ways.
  await drag(page, at, [3, 1.4], [8, 4.4]);
  let d = await saved(page);
  let loo = d.fixtures.find(f => f.id === 'loo');
  expect(loo.wallId, 'still free in the middle of the room').toBeNull();
  const box = (await footprints(page, d)).loo;
  const xs = box.map(p => p[0]), zs = box.map(p => p[1]);
  expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(8, 1);
  expect(Math.min(...zs), 'moved 3 ft off the old wall line').toBeGreaterThan(2.5);
  // NOW BACK UP TO THE FAR WALL: its back lands on that wall's face.
  await drag(page, at, [8, 4.4], [8, 7.3]);
  d = await saved(page);
  loo = d.fixtures.find(f => f.id === 'loo');
  expect(loo.wallId, 'hung on the far wall').toBe('far');
  expect(loo.host).toBeUndefined();
  expect(loo.offset).toBeCloseTo(8, 1);
  expect(loo.side, 'facing back into the room').toBe(-1);
});

test('a free fixture copies and pastes, and the copy is free too', async ({ page }) => {
  const { at } = await open(page);
  await deleteBack(page, at);
  await page.mouse.click(...at(3, 1.4));
  await page.waitForTimeout(100);
  await page.locator('#copy').click();
  await expect(page.locator('#paste')).toBeVisible();
  await page.locator('#paste').click();
  await page.waitForTimeout(150);
  const d = await saved(page);
  const loos = d.fixtures.filter(f => f.kind === 'toilet');
  expect(loos).toHaveLength(2);
  expect(loos.every(f => f.wallId == null && f.host), 'both free').toBe(true);
  expect(loos[0].host.id, 'not run mates').not.toBe(loos[1].host.id);
});
