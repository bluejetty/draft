// THE BATH FIXTURES: FREE OF THEIR WC'S WALLS, THEIR OWN SIZE, AND A SIZE
// MARK TO CHANGE IT BY (Movie, 23 Oct): "the shower seems to be deleted if
// i delete this back wall, can we do the same thing we did with the toilet
// so the wall can be deleted, and lets only allow the object to change if
// they click on it and change the properties (we should actually add a SIZE
// mark (30X60) etc to show the size, and also allow the user to click on
// the size mark to change the size".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const FX = (id, kind, wallId, offset, width, depth, more = {}) => ({ id, wallId, levelId: 3, view: 'plan', kind, offset, width, depth, side: 1, ...more });
// A WC: back and left walls with a 60 x 30 shower on the back wall, the
// three an assembly; a 48 x 32 stall on a 3 ft wall of its own; a tub
// filling a 10 ft alcove.
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50, nextGroupId: 2,
  walls: [W('back', [0, 0], [8, 0]), W('left', [0, 0], [0, 8]), W('far', [0, 8], [8, 8]),
    W('short', [20, 0], [23, 0]),
    W('tb', [0, 20], [10, 20]), W('te', [10, 20], [10, 30])],
  fixtures: [FX('sh', 'shower', 'back', 4, 5, 2.5), FX('st', 'stall', 'short', 1.5, 4, 8 / 3),
    FX('tb', 'tub', 'tb', 0, 5, 2.5, { endWallId: 'te', dir: -1 })],
  groups: [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'back' }, { type: 'wall', id: 'left' }, { type: 'fixture', id: 'sh' }] }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
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
  await page.waitForTimeout(250);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const tags = page => page.evaluate(() => window.__fixtureTags || []);
async function pressTag(page, id) {
  const tag = (await tags(page)).find(t => t.id === id);
  expect(tag, `a size mark on ${id}`).toBeTruthy();
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.click(box.x + tag.cx, box.y + tag.cy);
  return tag;
}

test('DELETE on a wall of the WC takes its walls and leaves the shower standing where it was; UNDO hangs it back', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(6, 0));
  await page.waitForTimeout(100);
  await expect(page.locator('#model-break'), 'the press picked the whole WC').toBeVisible();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  await expect(page.locator('#strip-message')).toContainText('stays where it stood');
  let d = await saved(page);
  expect(d.walls.map(w => w.id)).not.toContain('back');
  expect(d.walls.map(w => w.id)).not.toContain('left');
  const sh = d.fixtures.find(f => f.id === 'sh');
  expect(sh, 'the shower is still on the drawing').toBeTruthy();
  expect(sh.wallId).toBeNull();
  expect(sh.host, 'standing on the line its wall stood on').toBeTruthy();
  expect(sh.width).toBe(5);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.walls.map(w => w.id)).toContain('back');
  expect(d.fixtures.find(f => f.id === 'sh').wallId).toBe('back');
});

test('a fixture keeps its own width on a wall shorter than it', async ({ page }) => {
  await open(page);
  const d = drawing();
  const geo = await page.evaluate(d => {
    const g = window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures.find(f => f.id === 'st'));
    return { width: g.width, xs: g.corners.map(p => p.x) };
  }, d);
  expect(geo.width, 'the 48" stall on the 3 ft wall is still 48"').toBeCloseTo(4, 3);
  expect(Math.max(...geo.xs) - Math.min(...geo.xs)).toBeCloseTo(4, 3);
});

test('the shower carries its size, depth X width in inches; the mark typed into sets its size; UNDO puts it back', async ({ page }) => {
  // A WALL DELETED FIRST, so a step of another kind stands under the
  // shower's: UNDO must take back the shower's size alone, not jump past
  // it to the wall.
  const { at } = await open(page);
  await page.mouse.click(...at(4, 8));
  await page.waitForTimeout(100);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  expect((await saved(page)).walls.map(w => w.id)).not.toContain('far');
  const tag = await pressTag(page, 'sh');
  expect(tag.label).toBe('30X60');
  const box = page.locator('[data-fixture-size-entry="sh"]');
  await expect(box).toBeVisible();
  await expect(box).toHaveValue('30X60');
  await box.fill('36X48');
  await box.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('36 X 48');
  let sh = (await saved(page)).fixtures.find(f => f.id === 'sh');
  expect(sh.depth).toBeCloseTo(3, 3);
  expect(sh.width).toBeCloseTo(4, 3);
  expect((await tags(page)).find(t => t.id === 'sh').label).toBe('36X48');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const after = await saved(page);
  sh = after.fixtures.find(f => f.id === 'sh');
  expect([sh.depth, sh.width]).toEqual([2.5, 5]);
  expect(after.walls.map(w => w.id), 'the wall\'s step under it still stands').not.toContain('far');
});

test('a size that cannot be read is refused, and the fixture stays as it was', async ({ page }) => {
  await open(page);
  await pressTag(page, 'sh');
  const box = page.locator('[data-fixture-size-entry="sh"]');
  await box.fill('big');
  await box.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('not a size');
  const sh = (await saved(page)).fixtures.find(f => f.id === 'sh');
  expect([sh.depth, sh.width]).toEqual([2.5, 5]);
});

test('the tub in its alcove carries the length it fills; a typed size makes it a plain tub of that size', async ({ page }) => {
  await open(page);
  const tag = await pressTag(page, 'tb');
  expect(tag.label).toMatch(/^30X\d+$/);
  const box = page.locator('[data-fixture-size-entry="tb"]');
  await box.fill('32X66');
  await box.press('Enter');
  const tb = (await saved(page)).fixtures.find(f => f.id === 'tb');
  expect(tb.depth).toBeCloseTo(32 / 12, 3);
  expect(tb.width).toBeCloseTo(5.5, 3);
  expect(tb.endWallId, 'no longer filling the alcove').toBeUndefined();
});
