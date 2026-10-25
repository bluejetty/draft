// A FREE FIXTURE TURNS (Movie, 25 Oct: "the VANITY doesn't go with its back
// towards the wall, it seems to only get positioned this way and i tried to
// rotate it ... didn't work"). Dropped away from every wall, a piece stands
// with its back to the top of the sheet. Dragged with a SIDE against a wall
// it now goes onto that wall back first, and ROTATE turns it where it stands.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// A 30" x 24" VANITY standing free, its back along z = 4, its middle at x 15.
const VAN = () => ({ id: 'van', wallId: null, levelId: 3, view: 'plan', kind: 'vanity', width: 2.5, depth: 2, side: 1,
  offset: 2.5, host: { id: 'free:van', start: { x: 12.5, y: 0, z: 4 }, end: { x: 17.5, y: 0, z: 4 },
    wallType: 'stud_2x4', refLine: 'center', levelId: 3, view: 'plan' } });
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [W('back', [0, 0], [20, 0]), W('end', [20, 0], [20, 12])],
  fixtures: [VAN()],
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
const geoOf = (page, d) => page.evaluate(d => {
  const g = window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures.find(f => f.id === 'van'));
  const r = p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100];
  return { corners: g.corners.map(r), center: r(g.center) };
}, d);
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

test('a free vanity dragged with its SIDE against a wall goes onto it with its back to the wall', async ({ page }) => {
  const { at } = await open(page);
  // ITS RIGHT SIDE (x 16.25) TO THE WALL AT x 20: three and a half feet over.
  await drag(page, at, [15, 5], [18.5, 5]);
  await expect(page.locator('#strip-message')).toContainText('is on that wall now');
  const d = await saved(page);
  const van = d.fixtures.find(f => f.id === 'van');
  expect(van.wallId, 'on the end wall').toBe('end');
  const g = await geoOf(page, d);
  // BACK (corners 0, 1) ON THE WALL'S FACE, FRONT (2, 3) TWO FEET INTO THE ROOM.
  g.corners.slice(0, 2).forEach(([x]) => expect(x).toBeGreaterThan(19.5));
  g.corners.slice(2).forEach(([x]) => expect(x).toBeLessThan(18));
});

test('ROTATE turns a free vanity a quarter about its own middle, and UNDO turns it back', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(15, 5));
  await page.waitForTimeout(120);
  const was = await geoOf(page, await saved(page));
  await page.locator('#model-rotate').click();
  await page.locator('[data-rotate-by="90"]').click();
  await expect(page.locator('#strip-message')).toContainText('Turned 90');
  const now = await geoOf(page, await saved(page));
  expect(now.center, 'in place').toEqual(was.center);
  // A QUARTER TURN: 30" across x became 30" down z.
  const span = (g, i) => Math.max(...g.corners.map(c => c[i])) - Math.min(...g.corners.map(c => c[i]));
  expect(Math.round(span(was, 0) * 100) / 100).toBe(2.5);
  expect(Math.round(span(now, 1) * 100) / 100).toBe(2.5);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  expect((await geoOf(page, await saved(page))).corners).toEqual(was.corners);
});

test('FLIP top for bottom turns a free vanity to face the other way, in place', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(15, 5));
  await page.waitForTimeout(120);
  const was = await geoOf(page, await saved(page));
  await page.locator('#model-flip').click();
  await page.locator('[data-flip-axis="z"]').click();
  await expect(page.locator('#strip-message')).toContainText('Flipped');
  const now = await geoOf(page, await saved(page));
  expect(now.center, 'in place').toEqual(was.center);
  // ITS BACK WAS THE TOP EDGE; NOW IT IS THE BOTTOM.
  expect(now.corners[0][1]).toBeGreaterThan(now.corners[3][1]);
  expect(was.corners[0][1]).toBeLessThan(was.corners[3][1]);
});
