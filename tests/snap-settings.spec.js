// Snap feedback and adjustable magnetic pull: grid snap rings the engaged
// grid point, and the catch radii for grid / node / midpoint snaps come from
// the shared snap-strength settings.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const gridRing = page => page.locator('[data-model-gridsnap]');

async function setSnapStrength(page, strength) {
  await page.evaluate(value => {
    const active = window.DraftProfileManager.getActive('settings');
    const pkg = window.DraftProfileManager.createPackage(
      'settings', active?.name || 'test', { model: { snapStrength: value } },
    );
    window.DraftProfileManager.saveActive(pkg);
  }, strength);
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
}

test('grid snap rings the snapped point while it has hold of the cursor', async ({ page }) => {
  await h.openModel(page);

  // Slightly off the grid point: the pull grabs the cursor, the ring marks it.
  await h.moveTo(page, 5.2, 5);
  await expect(gridRing(page)).toBeVisible();
  const box = await gridRing(page).boundingBox();
  const target = await h.worldToClient(page, 5, 5);
  expect(Math.abs(box.x + box.width / 2 - target.x)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - target.y)).toBeLessThan(2);

  // Turning grid snap off hides the ring.
  await page.keyboard.press('#');
  await h.moveTo(page, 6.2, 6);
  await expect(gridRing(page)).toBeHidden();
});

test('a weaker grid pull frees the cursor between grid points', async ({ page }) => {
  await h.openModel(page);
  await setSnapStrength(page, { grid: 2 });

  // 0.4 ft is a few pixels at default zoom — beyond a 2px pull, so no snap.
  await h.moveTo(page, 5.4, 5);
  await expect(gridRing(page)).toBeHidden();

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 5.4, 5);
  await h.clickWorld(page, 9, 5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const line = h.allLines(await h.savedDrawing(page))[0];
  // The far click stays unsnapped; the click on the grid point still snaps.
  expect(Math.abs(line.start.x - 5.4)).toBeLessThan(0.1);
  expect(line.end.x).toBeCloseTo(9, 1);
});

test('node and midpoint pull follow the settings', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Default 3px pull: ~8px away catches neither the midpoint nor the node.
  await h.moveTo(page, 5, 0.6);
  await expect(page.locator('[data-model-midsnap]')).toBeHidden();
  await h.moveTo(page, 10.4, 0.4);
  await expect(page.locator('[data-model-magnet]')).toBeHidden();

  await setSnapStrength(page, { node: 30, midpoint: 30 });
  await h.selectTool(page, 'Line');
  await h.moveTo(page, 5, 0.6);
  await expect(page.locator('[data-model-midsnap]')).toBeVisible();
  await h.moveTo(page, 10.4, 0.4);
  await expect(page.locator('[data-model-magnet]')).toBeVisible();
});

test('the Settings page edits and saves the snap pull', async ({ page }) => {
  await page.goto('/SETTINGS.html');

  const defaults = await page.evaluate(() => window.DraftSnapStrength.DEFAULT_SNAP_STRENGTH);
  await page.locator('.advanced summary').click();
  await expect(page.locator('#snap-grid')).toHaveValue(String(defaults.grid));
  await expect(page.locator('#snap-node')).toHaveValue(String(defaults.node));
  await expect(page.locator('#snap-midpoint')).toHaveValue(String(defaults.midpoint));
  await expect(page.locator('#snap-polar')).toHaveValue(String(defaults.polar));

  await page.locator('#snap-grid').fill('9');
  await page.locator('#snap-grid').blur();

  const stored = await page.evaluate(() =>
    window.DraftProfileManager.getActive('settings')?.content?.model?.snapStrength);
  expect(stored.grid).toBe(9);

  // Out-of-range values clamp instead of saving nonsense.
  await page.locator('#snap-node').fill('500');
  await page.locator('#snap-node').blur();
  await expect(page.locator('#snap-node')).toHaveValue('60');
});
