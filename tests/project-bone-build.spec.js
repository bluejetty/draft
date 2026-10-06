// PROJECT'S BONE BUILDS WHAT THE PAGE CHOSE (Movie, 6 Oct): "i'd like a user
// to be able to go into the PROJECT area on a NEW plan, and pick the type
// within that area (rather than on the popup) and once they select
// everything they want, they press the BONE/HOUSE it will build as they
// chose" ... "when they press the BONE in the PROJECT AREA it should ask them
// - DRAW OUTLINE or NO OUTLINE?".
//
// His answers: an existing building asks to start fresh; a detached garage
// with no outline is 24' x 24'.
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

async function openProject(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/PROJECT.html');
  await expect(page.locator('.type-card').first()).toBeVisible();
}

const pressBone = async page => {
  await page.locator('#bone').click();
  await expect(page.locator('#project-build-ask')).toBeVisible();
};

const savedAfterBuild = async page => {
  await page.waitForURL(/MODEL\.html/);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

test('a type picked on PROJECT and NO OUTLINE builds that house in MODEL', async ({ page }) => {
  await openProject(page);
  await expect(page.locator('.type-card.home')).toHaveCount(0);
  await page.locator('.type-card[data-type="bungalow"]').click();
  await page.locator('[data-family-entry="twoStorey-garage"]').click();
  await expect(page.locator('.type-card[data-type="bungalow"]')).toHaveClass(/\bhome\b/);

  await pressBone(page);
  await expect(page.locator('[data-build-ask-name]')).toHaveText('2 STOREY + GARAGE');
  await page.locator('[data-build-ask="menu"]').click();

  const saved = await savedAfterBuild(page);
  expect(saved.buildType).toBe('twoStorey');
  expect(saved.outlines.some(o => o.garage === true), 'the garage was not built').toBe(true);
  expect(saved.outlines.some(o => !o.garage), 'the house was not built').toBe(true);
  expect(saved.walls.length).toBeGreaterThan(0);
  // The order is spent: a reload must not build it again.
  expect(new URL(page.url()).searchParams.get('order')).toBeNull();
});

test('DRAW OUTLINE goes to MODEL with the outline armed for that type', async ({ page }) => {
  await openProject(page);
  await page.locator('.type-card[data-type="bungalow"]').click();
  await page.locator('[data-family-entry="bungalow"]').click();
  await pressBone(page);
  await page.locator('[data-build-ask="outline"]').click();
  await page.waitForURL(/MODEL\.html/);
  await expect(page.locator('#strip-message'))
    .toContainText(/Trace your 1 STOREY — press each corner/i, { timeout: 10000 });
});

test('a detached garage with NO OUTLINE is 24 x 24', async ({ page }) => {
  await openProject(page);
  await page.locator('.type-card[data-type="detached"]').click();
  await page.locator('[data-family-entry="detached-thickened"]').click();
  await expect(page.locator('.type-card[data-type="detached"]')).toHaveClass(/\bhome\b/);
  await pressBone(page);
  await expect(page.locator('[data-build-ask-name]')).toContainText("24' x 24'");
  await page.locator('[data-build-ask="menu"]').click();
  const saved = await savedAfterBuild(page);
  const garage = saved.outlines.find(o => o.detached === true);
  expect(garage, 'no detached garage was set on the lot').toBeTruthy();
  const xs = garage.points.map(p => p.x), zs = garage.points.map(p => p.z);
  expect(Math.round(Math.max(...xs) - Math.min(...xs))).toBe(24);
  expect(Math.round(Math.max(...zs) - Math.min(...zs))).toBe(24);
});

test('CANCEL closes the question and builds nothing; no type says so', async ({ page }) => {
  await openProject(page);
  await page.locator('#bone').click();
  await expect(page.locator('#project-build-ask')).toBeHidden();
  await expect(page.locator('#status')).toContainText(/pick a type/i);
  await page.locator('.type-card[data-type="bilevel"]').click();
  await page.locator('[data-family-entry="bilevel"]').click();
  await pressBone(page);
  await page.locator('[data-build-ask="cancel"]').click();
  await expect(page.locator('#project-build-ask')).toBeHidden();
  await expect(page).toHaveURL(/PROJECT\.html/);
});

test('a plan that already has a house asks to start fresh, and keeps the PROJECT numbers', async ({ page }) => {
  const built = empty();
  built.buildType = 'bungalow';
  built.garagePlan = 'none';
  built.roofPitch = 7;
  built.outlines = [{ id: 'h', levelId: 3, garage: false, points: [
    { x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, { x: 40, y: 0, z: 28 }, { x: 0, y: 0, z: 28 }] }];
  await openProject(page, built);
  await expect(page.locator('.type-card[data-type="bungalow"]')).toHaveClass(/\bhome\b/);
  await page.locator('[data-family-entry="twoStorey"]').click();
  await pressBone(page);
  await page.locator('[data-build-ask="menu"]').click();
  await page.waitForURL(/MODEL\.html/);
  await expect(page.locator('body')).toContainText(/start a new plan with your PROJECT settings/i, { timeout: 10000 });
  await page.locator('[data-guard-discard]').click();
  const saved = await savedAfterBuild(page);
  // THE NEW PLAN IS THE ONE PROJECT CHOSE, CARRYING ITS NUMBERS.
  expect(saved.buildType).toBe('twoStorey');
  expect(saved.roofPitch).toBe(7);
  expect(saved.outlines.some(o => o.id === 'h'), 'the old house came along').toBe(false);
  expect(saved.walls.length).toBeGreaterThan(0);
});
