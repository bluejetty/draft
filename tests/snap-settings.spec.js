// Snap feedback and adjustable magnetic pull: the 0,0 origin marker rings
// when it has hold of the cursor, and the catch radii for node / midpoint
// snaps come from the shared snap-strength settings.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const originRing = page => page.locator('[data-model-originsnap]');

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

test('the 0,0 origin rings while it has hold of the cursor, with no toggle', async ({ page }) => {
  await h.openModel(page);

  // Slightly off the origin: the pull grabs the cursor, the ring marks it.
  await h.moveTo(page, 0.2, 0);
  await expect(originRing(page)).toBeVisible();
  const box = await originRing(page).boundingBox();
  const target = await h.worldToClient(page, 0, 0);
  expect(Math.abs(box.x + box.width / 2 - target.x)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - target.y)).toBeLessThan(2);

  // Away from the origin nothing rings — there are no other grid points.
  await h.moveTo(page, 5.2, 5);
  await expect(originRing(page)).toBeHidden();
});

test('a click near the origin snaps exactly to 0,0', async ({ page }) => {
  await h.openModel(page);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0.2, 0);
  await h.clickWorld(page, 9, 5.4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const line = h.allLines(await h.savedDrawing(page))[0];
  // The origin click snaps exactly; the far click stays unsnapped.
  expect(line.start.x).toBe(0);
  expect(line.start.z).toBe(0);
  expect(Math.abs(line.end.x - 9)).toBeLessThan(0.1);
  expect(Math.abs(line.end.z - 5.4)).toBeLessThan(0.1);
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
  await expect(page.locator('#snap-node')).toHaveValue(String(defaults.node));
  await expect(page.locator('#snap-midpoint')).toHaveValue(String(defaults.midpoint));
  await expect(page.locator('#snap-polar')).toHaveValue(String(defaults.polar));

  await page.locator('#snap-midpoint').fill('9');
  await page.locator('#snap-midpoint').blur();

  const stored = await page.evaluate(() =>
    window.DraftProfileManager.getActive('settings')?.content?.model?.snapStrength);
  expect(stored.midpoint).toBe(9);

  // Out-of-range values clamp instead of saving nonsense.
  await page.locator('#snap-node').fill('500');
  await page.locator('#snap-node').blur();
  await expect(page.locator('#snap-node')).toHaveValue('60');
});

test('the Settings page saves the drafter name and phone', async ({ page }) => {
  await page.goto('/SETTINGS.html');

  await page.locator('#drafter-name').fill('Jane Draft');
  await page.locator('#drafter-name').blur();
  await page.locator('#drafter-phone').fill('(555) 555-5555');
  await page.locator('#drafter-phone').blur();

  const stored = await page.evaluate(() =>
    window.DraftProfileManager.getActive('settings')?.content?.model?.drafter);
  expect(stored).toEqual({ name: 'Jane Draft', phone: '(555) 555-5555' });

  // Reload: the fields come back from the saved settings package.
  await page.reload();
  await expect(page.locator('#drafter-name')).toHaveValue('Jane Draft');
  await expect(page.locator('#drafter-phone')).toHaveValue('(555) 555-5555');
});
