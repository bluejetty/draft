// THE TUB CLICKS ON (Movie, 28 Oct: "I CAN'T INSERT a TUB ... shower i can
// insert but can't do a tub"). TUB said "not on this page yet -- it takes a
// gesture of its own" and placed nothing; now it goes on like the SHOWER:
// its back to the wall pressed, into the corner when pressed by one.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const drawing = () => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  walls: [W('a', [0, 0], [10, 0]), W('b', [10, 0], [10, 8]), W('c', [10, 8], [0, 8]), W('d', [0, 8], [0, 0])],
  fixtures: [], fenestrations: [], lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});

test('TUB pressed by a corner goes on the wall, into the corner; one UNDO takes it off', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=3&left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await page.locator('[data-fixture-kind="tub"]').click();
  await page.mouse.click(...at(1, 0.6));
  await page.waitForTimeout(150);
  await expect(page.locator('#strip-message')).not.toContainText('not on this page');
  const tub = await page.evaluate(() => drawing.fixtures.find(f => f.kind === 'tub'));
  expect(tub, 'a tub was placed').toBeTruthy();
  expect(tub.wallId).toBe('a');
  expect([tub.width, tub.depth]).toEqual([5, 2.5]);
  // Into the corner: its near end a half inch off wall d's inside face.
  const minX = await page.evaluate(() => {
    const g = window.DraftFixtureGeometry.fixtureGeometry(drawing.walls, drawing.fixtures[0]);
    return Math.min(...g.corners.map(c => c.x));
  });
  expect(minX).toBeCloseTo(3.5 / 24 + 0.5 / 12, 3);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => drawing.fixtures.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('TUB pressed far from any corner goes on the wall where pressed, a plain 60 x 30', async ({ page }) => {
  const d = drawing();
  d.walls = [W('a', [0, 0], [20, 0])];
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), d);
  await page.goto('/MODEL.html?level=3&left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await page.locator('[data-fixture-kind="tub"]').click();
  await page.mouse.click(...at(10, 0.6));
  await page.waitForTimeout(150);
  const tub = await page.evaluate(() => drawing.fixtures.find(f => f.kind === 'tub'));
  expect(tub.endWallId, 'no corner, no faucet wall').toBeUndefined();
  expect(tub.offset).toBeCloseTo(10, 1);
});
