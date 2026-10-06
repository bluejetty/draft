// THE HOUSE AND THE GARAGE KEEP THEIR OWN WALL HEIGHTS (Movie, 6 Oct): "i
// increased the HOUSE wall (not GARAGE WALL) the garage wall also moved to
// house height though. they should be different heights" -- "if both walls
// are same height exactly they should be ONE roof". The garage default is
// 10'-1 3/4" from the house sill: level with a 9'-1 1/8" house.
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
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);
const garageTops = d => [...new Set(d.walls
  .filter(w => w.body === 'garage' && w.levelId === 3 && (w.view || 'plan') === 'plan')
  .map(w => Math.round(w.topHeight * 1000) / 1000))];
const MAIN_PKG = (11.875 + 0.75) / 12;
const r3 = n => Math.round(n * 1000) / 1000;

const typeOnProject = async (page, key, value) => {
  await page.goto('/PROJECT.html');
  const box = page.locator(`[data-detail-input="${key}"]`);
  await box.fill(value);
  await box.press('Enter');
};

test('the garage keeps its own height and the roofs regroup as the two tops meet and part', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/PROJECT.html');
  await expect(page.locator('[data-detail-input="garageWallHeight"]')).toHaveValue(`10'-1 3/4"`);
  await page.locator('.type-card[data-type="bungalow"]').click();
  await page.locator('[data-family-entry="bungalow-garage"]').click();
  await page.locator('#bone').click();
  await page.locator('[data-build-ask="menu"]').click();
  await page.waitForURL(/MODEL\.html/);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);

  // BUILT: the house at the office's 8'-1 1/8", the garage a foot higher on
  // its 10'-1 3/4" -- two roofs, the house's cut where the garage stands.
  let d = await stored(page);
  expect(garageTops(d)).toEqual([r3(121.75 / 12 - MAIN_PKG)]);
  expect(d.roofs.filter(r => r.follows === 'attachedGarage')).toHaveLength(1);
  expect((d.roofs.find(r => r.follows === 'house').cuts || []).length).toBe(1);

  // THE HOUSE UP TO 9'-1 1/8": the tops meet -- one roof -- and the garage
  // walls stay where they were.
  await typeOnProject(page, 'wallHeight-3', `9'-1 1/8"`);
  await expect.poll(async () => (await stored(page)).roofs.length).toBe(1);
  d = await stored(page);
  expect(d.roofs[0].follows).toBe('house');
  expect(d.roofs[0].cuts).toBeUndefined();
  expect(garageTops(d)).toEqual([r3(121.75 / 12 - MAIN_PKG)]);

  // THE GARAGE UP TO 12': its walls follow its own box, and the roofs part.
  await typeOnProject(page, 'garageWallHeight', `12'-0"`);
  await expect.poll(async () => garageTops(await stored(page))).toEqual([r3(12 - MAIN_PKG)]);
  d = await stored(page);
  const garageRoof = d.roofs.find(r => r.follows === 'attachedGarage');
  expect(garageRoof).toBeTruthy();
  expect(r3(garageRoof.plateHeightFt)).toBe(r3(12 - MAIN_PKG));
});
