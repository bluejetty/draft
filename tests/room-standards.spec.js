// ROOM MINIMUMS (board #190): a COMPANY STANDARDS table of preferred
// minimum room sizes — seeded from the code's own constants plus stated
// office defaults, editable on STANDARDS.html, persisted with the other
// standards — and a quiet UNDER MIN flag that rides the existing ROOM TAGS
// flow. Feedback only: nothing blocks, nothing auto-fixes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function openStandards(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-room-min-area="bedroom"]')).toBeVisible();
}

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawRoomWithCloset(page, x0, z0, x1, z1) {
  await drawWall(page, x0, z0, x1, z0);
  await drawWall(page, x1, z0, x1, z1);
  await drawWall(page, x1, z1, x0, z1);
  await drawWall(page, x0, z1, x0, z0);
  // A closet is a RUN fixture: two clicks along one wall set its extents,
  // and the run must fit a D18 door — 4' along the top wall, half a foot in.
  await page.locator('[data-model-left]').getByRole('button', { name: /\bFixture\b/i }).click();
  await page.getByRole('button', { name: 'CLOSET', exact: true }).click();
  const mid = (x0 + x1) / 2;
  await h.clickWorld(page, mid - 2, z0 + 0.5);
  await h.clickWorld(page, mid + 2, z0 + 0.5);
  await h.waitForSaved(page);
}

async function runRoomTags(page) {
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
}

test('the default table carries the stated seeds', async ({ page }) => {
  await h.openModel(page);
  const table = await page.evaluate(() =>
    window.DraftRoomStandards.normaliseRoomMinimums(null));
  // Kitchen row comes straight from the code's auto-kitchen envelope.
  expect(table.kitchen.minAreaSqFt).toBe(40);
  expect(table.kitchen.minDimensionFt).toBe(5);
  // Bedroom row is the NBC-style default the order names.
  expect(table.bedroom.minAreaSqFt).toBe(97);
  expect(table.bedroom.minDimensionFt).toBeCloseTo(9 + 8 / 12, 5);
  // DZ row (board #210): required-core derivation — 2'-6" bench depth plus
  // a 36" clear strip by the 6' bench run.
  expect(table.dz.minAreaSqFt).toBe(33);
  expect(table.dz.minDimensionFt).toBe(5.5);
  // All six categories present, living stored for AUTO-FURNISH.
  expect(Object.keys(table).sort()).toEqual(['bedroom', 'dz', 'kitchen', 'laundry', 'living', 'wc']);
});

test('J&JBATH rides the tray as a bathroom, held to the WC minimums', async ({ page }) => {
  await h.openModel(page);
  const tray = await page.evaluate(() => window.DraftRoomStandards.normaliseRoomTray(null));
  expect(tray).toContain('J&JBATH');
  expect(await page.evaluate(() => window.DraftRoomStandards.stampCategory('J&JBATH'))).toBe('wc');
});

test('STANDARDS edits persist through a reload and reset restores the defaults', async ({ page }) => {
  await openStandards(page);
  const bedroomArea = page.locator('[data-room-min-area="bedroom"]');
  await expect(bedroomArea).toHaveValue('97');
  await bedroomArea.fill('120');
  await bedroomArea.dispatchEvent('change');
  await expect(page.locator('#status')).toContainText('BEDROOM minimum saved.');

  await page.reload();
  await expect(page.locator('[data-room-min-area="bedroom"]')).toHaveValue('120');
  // Garbage never sticks: a non-number falls back to the stored value.
  await page.locator('[data-room-min-dim="wc"]').fill('nonsense');
  await page.locator('[data-room-min-dim="wc"]').dispatchEvent('change');
  await expect(page.locator('[data-room-min-dim="wc"]')).toHaveValue('3');

  await page.locator('#reset').click();
  await expect(page.locator('[data-room-min-area="bedroom"]')).toHaveValue('97');
});

test('an under-min bedroom wears the quiet flag and a compliant one does not', async ({ page }) => {
  await h.openModel(page);
  // 8 x 9 with a closet: inside area ~64 sq ft — under the 97 default, and
  // the 8' short side is under 9'-8".
  await drawRoomWithCloset(page, -4, -4.5, 4, 4.5);
  await runRoomTags(page);
  let tags = (await h.savedDrawing(page)).roomTags.filter(tag => tag.levelId === 3);
  expect(tags).toHaveLength(1);
  expect(tags[0].name).toMatch(/BEDR/);
  expect(tags[0].underMin).toBe(true);

  // 12 x 11 with a closet on 2ND FL: inside ~121 sq ft, short side 11' —
  // clears both numbers, so no flag.
  await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: '2ND FL' }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
  await drawRoomWithCloset(page, -6, -5.5, 6, 5.5);
  await runRoomTags(page);
  tags = (await h.savedDrawing(page)).roomTags.filter(tag => tag.levelId === 5);
  expect(tags).toHaveLength(1);
  expect(tags[0].name).toMatch(/BEDR/);
  expect(tags[0].underMin).toBe(false);

  // The flag survives a save and reload with the tag record.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  const restored = (await h.savedDrawing(page)).roomTags;
  expect(restored.find(tag => tag.levelId === 3).underMin).toBe(true);
  expect(restored.find(tag => tag.levelId === 5).underMin).toBe(false);
});
