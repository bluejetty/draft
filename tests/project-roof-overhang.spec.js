// THE ROOF TAKES THE PROJECT PAGE'S OVERHANG AND PITCH (Movie, 6 Oct): "i
// tried to make the 4ft overhang using the PROJECT area but didn't work ...
// after i pressed the bone it was still 2ft eave". And, of a house already
// drawn: "RESHAPE each time ... allow it to autoregenerate".
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

async function openProject(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/PROJECT.html');
  await expect(page.locator('.type-card').first()).toBeVisible();
}

const buildFromBone = async page => {
  await page.locator('#bone').click();
  await page.locator('[data-build-ask="menu"]').click();
  await page.waitForURL(/MODEL\.html/);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

// How far the roof reaches past the body it was cut over, on the left side
// (an eave on every design here).
const leftReach = (roof, outline) =>
  Math.min(...outline.points.map(p => p.x)) - Math.min(...roof.points.map(p => p.x));

test('the BONE cuts the house roof at the PROJECT overhang, and a changed overhang reshapes it', async ({ page }) => {
  const file = empty();
  file.roofOverhang = 4;
  await openProject(page, file);
  await page.locator('.type-card[data-type="bungalow"]').click();
  await page.locator('[data-family-entry="bungalow"]').click();
  const built = await buildFromBone(page);
  const house = built.outlines.find(o => !o.garage);
  const roof = built.roofs.find(r => r.follows === 'house');
  expect(roof, 'the house roof is not marked as following the PROJECT row').toBeTruthy();
  expect(roof.overhang).toBe(4);
  expect(leftReach(roof, house)).toBeCloseTo(4, 3);

  // BACK ON PROJECT, 4 FT BECOMES 3 FT AND THE BUILT ROOF FOLLOWS.
  await page.goto('/PROJECT.html');
  const box = page.locator('[data-detail-input="overhang"]');
  await box.fill(`3'-0"`);
  await box.press('Enter');
  await expect.poll(async () => (await stored(page)).roofOverhang).toBe(3);
  const after = await stored(page);
  const moved = after.roofs.find(r => r.follows === 'house');
  expect(moved.overhang).toBe(3);
  expect(leftReach(moved, house)).toBeCloseTo(3, 3);
  expect(after.walls.length).toBe(built.walls.length);
});

test('a MOD BILEVEL takes its own row: house at the split overhang, garage at its own', async ({ page }) => {
  const file = empty();
  file.sectionTable = { rows: { modifiedBilevel: { roofOverhangFt: 4, roofPitch: 5 } } };
  await openProject(page, file);
  await page.locator('.type-card[data-type="bilevel"]').click();
  await page.locator('[data-family-entry="modifiedBilevel"]').click();
  const built = await buildFromBone(page);
  const house = built.roofs.filter(r => r.follows === 'house');
  const garage = built.roofs.filter(r => r.follows === 'attachedGarage');
  expect(house.length).toBeGreaterThan(0);
  house.forEach(r => { expect(r.overhang).toBe(4); expect(r.pitch).toBe(5); });
  // The garage row is untouched, so it falls back to the drawing's 2 ft -- what
  // the PROJECT card shows beside it.
  garage.forEach(r => { expect(r.overhang).toBe(2); expect(r.pitch).toBe(4); });
});
