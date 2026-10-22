// NO E1-E4 ON THE SHELF (Movie, 22 Oct: "lets take off the E1-E4 from the
// SHELF don't think its needed there"). The elevation marks are the house's,
// cut round the house's walls; a shelf shows a suite, not the house, so the
// sheet draws none there. The record itself stands: back on a floor the four
// are drawn again, and the elevations still cut from them.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// A 60 x 30 house on MAIN FL; a 20 x 15 suite on SHELF 1.
const drawing = () => ({ version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0], 3), W('b', [60, 0], [60, 30], 3), W('c', [60, 30], [0, 30], 3), W('d', [0, 30], [0, 0], 3),
    W('s1', [0, 0], [20, 0], -1), W('s2', [20, 0], [20, 15], -1), W('s3', [20, 15], [0, 15], -1), W('s4', [0, 15], [0, 0], -1)],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }], nextBoneyardShelfId: 2, activeBoneyardShelfId: 1 });

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=3&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openModelRail(page);
}
const drawn = async page => JSON.parse(await page.locator('#plan').getAttribute('data-e-marks-drawn') || '[]');
const record = async page => JSON.parse(await page.locator('#plan').getAttribute('data-e-marks') || '[]');
const ids = marks => marks.map(m => m.id).sort();

test('on the shelf no E mark is drawn; the record keeps its four, and a floor draws them again', async ({ page }) => {
  await open(page);
  expect(ids(await drawn(page)), 'four round the house on MAIN FL').toEqual(['E1', 'E2', 'E3', 'E4']);
  await page.locator('[data-shelf="1"]').click();
  await page.waitForTimeout(300);
  await expect.poll(async () => (await drawn(page)).length, 'none drawn on the shelf').toBe(0);
  expect(ids(await record(page)), 'the record stands').toEqual(['E1', 'E2', 'E3', 'E4']);
  await page.locator('[data-level-row="3"]').click();
  await page.waitForTimeout(300);
  await expect.poll(async () => ids(await drawn(page)), 'back on the floor').toEqual(['E1', 'E2', 'E3', 'E4']);
});
