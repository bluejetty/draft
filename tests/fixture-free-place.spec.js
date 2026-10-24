// A KITCHEN PIECE PLACED ANYWHERE (Movie, 24 Oct): "i can't place the
// INDUVIDUAL items of the kitchen items manually yet - like STOVE / CABINET
// / or FRIDGE etc. i'l like to be able to place all those so i can arrange
// the kitchens". Pressed away from every wall it drops free where it was
// pressed; dragged against a wall and let go, it goes onto that wall.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const drawing = () => ({
  version: 1, board: 'drafting', levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [W('n', [0, 0], [20, 0])],
  fixtures: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=3&left=1&lpane=build');
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

test('a STOVE pressed in the middle of the room drops there, free; dragged against the wall it goes onto it', async ({ page }) => {
  const { at } = await open(page);
  await h.armFromRail(page, 'fixture');
  await page.locator('[data-fixture-kind="stove"]').click();
  await page.mouse.click(...at(8, 4));
  await page.waitForTimeout(150);
  await expect(page.locator('#strip-message')).toContainText('placed free');
  let d = await saved(page);
  const stove = d.fixtures.find(f => f.kind === 'stove');
  expect(stove, 'a stove was placed').toBeTruthy();
  expect(stove.wallId).toBeNull();
  expect(stove.host, 'standing on a line of its own').toBeTruthy();
  const centre = await page.evaluate(({ d, id }) => {
    const g = window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures.find(f => f.id === id));
    return g.center;
  }, { d, id: stove.id });
  expect(centre.x).toBeCloseTo(8, 1);
  expect(centre.z, 'centred on the press').toBeCloseTo(4, 1);
  // PICK IT, then drag it up against the wall.
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'select');
  await page.mouse.click(...at(8, 4));
  await page.waitForTimeout(150);
  await page.mouse.move(...at(8, 4));
  await page.mouse.down();
  await page.mouse.move(...at(8, 3), { steps: 5 });
  await page.mouse.move(...at(8, 1.2), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.fixtures.find(f => f.id === stove.id).wallId, 'on the wall now').toBe('n');
});

test('a CABINET and a FRIDGE drop free too; one UNDO takes each back', async ({ page }) => {
  const { at } = await open(page);
  await h.armFromRail(page, 'fixture');
  await page.locator('[data-fixture-kind="fridge"]').click();
  await page.mouse.click(...at(4, 4));
  await page.locator('[data-fixture-kind="cabinet"]').click();
  await page.mouse.click(...at(12, 4.5));
  await page.waitForTimeout(150);
  let d = await saved(page);
  expect(d.fixtures.map(f => f.kind).sort()).toEqual(['cabinet', 'fridge']);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.fixtures.map(f => f.kind)).toEqual(['fridge']);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.fixtures, 'and the second UNDO takes the fridge').toEqual([]);
});
