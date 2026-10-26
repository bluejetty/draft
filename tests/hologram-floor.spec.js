// A HOLOGRAM BROUGHT IN STANDS ON THE FLOOR THE DRAFTER IS ON.
//
// Movie, 20 Oct: "i saved the 2BD on the SHELF and when i brought it in as a
// HOLOGRAM - it loaded it into the SHELF. can we load them in the CURRENT PLAN
// LEVEL.. so if i'm in MAIN FLOOR PLAN - it would align into that floor, or
// 2nd floor --- same thing, it would be brought to the 2nd floor".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
const shell = () => ({ version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 3, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0], 3), W('b', [0, 0], [60, 0], 5)] });
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 3, ...EMPTY, suiteKind: 'residential',
  walls: [W('s1', [0, 0], [20, 0], 3), W('s2', [20, 0], [20, 15], 3)] };
// THE 2BD AS HE SAVED IT: a whole drawing, its suite parked on SHELF 1 and
// nothing on any floor, and no suite mark.
const SHELF_ONLY = { version: 1, levels: LEVELS, activeLevelIdx: 3, ...EMPTY,
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }],
  walls: [W('s1', [0, 0], [20, 0], -1), W('s2', [20, 0], [20, 15], -1)] };

async function bringIn(page, level, file, name = 'two-bed.draft') {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: shell() });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-ask-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });

test('brought in on 2ND FL, a suite stands on 2ND FL', async ({ page }) => {
  const d = await bringIn(page, 5, SUITE);
  expect(d.holograms[0].levelMap, 'its MAIN FL on this 2ND FL').toEqual({ 3: 5 });
});

test('brought in on MAIN FL, it stands on MAIN FL', async ({ page }) => {
  const d = await bringIn(page, 3, SUITE);
  expect(d.holograms[0].levelMap ?? null).toBeNull();
});

test('a drawing with its suite only on a shelf comes onto the floor, not the shelf', async ({ page }) => {
  const d = await bringIn(page, 5, SHELF_ONLY);
  const holo = d.holograms[0];
  expect(holo.source.walls.map(w => w.levelId), 'off the shelf, onto its MAIN FL').toEqual([3, 3]);
  expect(holo.levelMap, 'and that on the 2ND FL he is on').toEqual({ 3: 5 });
});

test('a drawing with walls on its floors keeps what it parked on a shelf on the shelf', async ({ page }) => {
  const mixed = { ...SHELF_ONLY, walls: [W('m1', [0, 0], [20, 0], 3), W('p1', [0, 5], [10, 5], -1)] };
  const d = await bringIn(page, 3, mixed);
  expect(d.holograms[0].source.walls.map(w => w.levelId), 'only a shelf-only drawing comes off the shelf')
    .toEqual([3, -1]);
});
