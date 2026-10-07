// NEW ON PROJECT CLEARS THE HOUSE AND COMES BACK TO PICK A NEW ONE.
//
// Movie, 7 Oct: "can we allow the NEW button to function in the PROJECT area
// (clear the MODEL area - and bring up the selection screen, and then they
// can proceed to change the PROJECT info prior to hitting the BONE/HOUSE".
//
// MODEL owns what a blank drawing is and asks whether to save a copy first,
// so PROJECT's NEW is MODEL's NEW reached by `?new=1&then=project`, which
// sends the drafter back here afterwards -- and back here too if they cancel.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const HOUSE = {
  version: 1, board: 'drafting', planTurn: 0, buildType: 'bungalow',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [
    { id: 'w1', levelId: 3, view: 'plan', start: { x: 0, z: 0 }, end: { x: 20, z: 0 }, baseHeight: 0, topHeight: 8, thickness: 0.5 },
    { id: 'w2', levelId: 3, view: 'plan', start: { x: 20, z: 0 }, end: { x: 20, z: 20 }, baseHeight: 0, topHeight: 8, thickness: 0.5 },
  ],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  projectInfo: { name: 'OLD JOB', client: 'OLD OWNER' },
  // THE PROJECT NUMBERS a KEEP carries over: a 7:12 roof and a typed wall.
  roofPitch: 7,
  levelAssemblies: { 3: { wallHeightFt: 10 } },
};

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

async function seedAndOpenProject(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: HOUSE });
  // On the DETACHED GARAGE card, which a bungalow locks to viewing only.
  await page.goto('/PROJECT.html?type=detached');
  await expect(page.locator('#file-new')).toBeEnabled({ timeout: 10000 });
  await expect(page.locator('[data-view-only]').filter({ hasText: 'Viewing only' })).not.toHaveCount(0);
}

test('NEW on PROJECT clears the house and comes back with every card open', async ({ page }) => {
  await seedAndOpenProject(page);
  await page.locator('#file-new').click();
  // FIRST, whether to keep the PROJECT numbers (Movie, 7 Oct: "ask each time").
  await expect(page.locator('#project-new-ask')).toBeVisible();
  await page.locator('[data-new-ask="reset"]').click();
  // MODEL asks about the house on screen, as its own NEW does.
  await expect(page.locator('#file-guard')).toBeVisible({ timeout: 10000 });
  await page.locator('#file-guard [data-guard-discard]').click();
  await page.waitForURL(/PROJECT\.html$/, { timeout: 10000 });

  const d = await stored(page);
  expect(d.walls || []).toHaveLength(0);
  expect(d.buildType ?? null).toBeNull();
  // RESET: the office defaults, not the old house's numbers.
  expect(d.roofPitch ?? null).toBeNull();
  expect(d.levelAssemblies?.[3]?.wallHeightFt ?? null).toBeNull();
  // THE SELECTION SCREEN: no type is the house's yet, so nothing is locked.
  await expect(page.locator('#file-new')).toBeEnabled({ timeout: 10000 });
  await expect(page.locator('[data-view-only]').filter({ hasText: 'Viewing only' })).toHaveCount(0);
});

test('CANCEL keeps the house and still comes back to PROJECT', async ({ page }) => {
  await seedAndOpenProject(page);
  await page.locator('#file-new').click();
  await page.locator('[data-new-ask="keep"]').click();
  await expect(page.locator('#file-guard')).toBeVisible({ timeout: 10000 });
  await page.locator('#file-guard [data-guard-cancel]').click();
  await page.waitForURL(/PROJECT\.html$/, { timeout: 10000 });
  expect((await stored(page)).walls).toHaveLength(2);
});

test('KEEP carries the PROJECT numbers into the new drawing, not the house or its name', async ({ page }) => {
  await seedAndOpenProject(page);
  await page.locator('#file-new').click();
  await page.locator('[data-new-ask="keep"]').click();
  await expect(page.locator('#file-guard')).toBeVisible({ timeout: 10000 });
  await page.locator('#file-guard [data-guard-discard]').click();
  await page.waitForURL(/PROJECT\.html$/, { timeout: 10000 });
  const d = await stored(page);
  expect(d.walls || []).toHaveLength(0);
  expect(d.roofPitch).toBe(7);
  expect(d.levelAssemblies[3].wallHeightFt).toBe(10);
  expect(d.projectInfo?.name ?? '').toBe('');
  expect(d.buildType ?? null).toBeNull();
  await expect(page.locator('[data-view-only]').filter({ hasText: 'Viewing only' })).toHaveCount(0);
});

test('CANCEL on the question leaves everything where it was', async ({ page }) => {
  await seedAndOpenProject(page);
  await page.locator('#file-new').click();
  await page.locator('[data-new-ask="cancel"]').click();
  await expect(page.locator('#project-new-ask')).toBeHidden();
  await expect(page).toHaveURL(/PROJECT\.html/);
  expect((await stored(page)).walls).toHaveLength(2);
});
