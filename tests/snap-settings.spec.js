// Snap feedback and the one SNAP ZONE setting: the drawing's datum rings when
// it has hold of the cursor, and every catch radius — node, midpoint, polar —
// derives from the single snap-zone number.
//
// The datum WAS the world's 0,0, and board NEW-5 made it float: an untouched
// model space measures from nothing, and the first node placed becomes the
// origin. So these two tests changed with the behaviour rather than being
// deleted — the ring and the exact pull still exist and are still asserted,
// they just belong to a point the drafter placed instead of to the world.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const originRing = page => page.locator('[data-model-originsnap]');

async function setSnapZone(page, zone) {
  await page.evaluate(value => {
    const active = window.DraftProfileManager.getActive('settings');
    const pkg = window.DraftProfileManager.createPackage(
      'settings', active?.name || 'test', { model: { snapZone: value } },
    );
    window.DraftProfileManager.saveActive(pkg);
  }, zone);
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
}

test("the datum has hold of the cursor, and rings when no node is on it", async ({ page }) => {
  await h.openModel(page);

  // Nothing placed, nothing to measure from: there is no datum to ring, so
  // hovering where the world's 0,0 used to pull now rings nothing.
  await h.moveTo(page, 0.2, 0);
  await expect(originRing(page)).toBeHidden();

  // Place a line away from 0,0 — its first node becomes the datum.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 4, -3);
  await h.clickWorld(page, 11, -3);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Hovering next to the datum, the cursor is caught exactly. The RING does
  // not show, and that is the behaviour changing rather than breaking: the
  // datum is now a node the drafter placed, so the node magnet — which
  // outranks the origin ring by design — owns the feedback. The old ring
  // existed because the world's 0,0 was a snap point no node ever occupied.
  await h.moveTo(page, 4.2, -3);
  await expect(page.locator('[data-model-magnet]')).toBeVisible();
  await expect(originRing(page)).toBeHidden();

  // The origin pull is still there underneath, for the case the magnet cannot
  // cover: a datum whose node has been deleted. Away from everything, nothing
  // rings and nothing magnets.
  await h.moveTo(page, 9.2, 5);
  await expect(originRing(page)).toBeHidden();
});

test("a click near the datum snaps exactly onto it", async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('t'); // set the T-square down — the far click stays unsnapped

  // The first line sets the datum at its start; the second starts near that
  // datum and must land exactly on it, the way a click near 0,0 used to.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 4, -3);
  await h.clickWorld(page, 11, -3);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const datum = h.allLines(await h.savedDrawing(page))[0].start;

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 4.2, -3);
  await h.clickWorld(page, 9, 5.4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const second = h.allLines(await h.savedDrawing(page))[1];
  // The datum click snaps exactly; the far click stays unsnapped.
  expect(second.start.x).toBe(datum.x);
  expect(second.start.z).toBe(datum.z);
  expect(Math.abs(second.end.x - 9)).toBeLessThan(0.1);
  expect(Math.abs(second.end.z - 5.4)).toBeLessThan(0.1);
});

test('node and midpoint pull follow the settings', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Default 4px zone: ~8px away catches neither the midpoint nor the node.
  await h.moveTo(page, 5, 0.6);
  await expect(page.locator('[data-model-midsnap]')).toBeHidden();
  await h.moveTo(page, 10.4, 0.4);
  await expect(page.locator('[data-model-magnet]')).toBeHidden();

  await setSnapZone(page, 30);
  await h.selectTool(page, 'Line');
  await h.moveTo(page, 5, 0.6);
  await expect(page.locator('[data-model-midsnap]')).toBeVisible();
  await h.moveTo(page, 10.4, 0.4);
  await expect(page.locator('[data-model-magnet]')).toBeVisible();
});

// SNAP STRENGTH (Movie, 26 Oct, the one snap rule) replaces the snap-zone
// pixels on the Settings page: four steps that scale every reach MODEL has.
test('the Settings page edits and saves the snap strength', async ({ page }) => {
  await page.goto('/SETTINGS.html');
  await page.locator('.advanced summary').click();
  const pick = page.locator('#snap-reach');
  await expect(pick).toHaveValue('1');
  await expect(pick.locator('option')).toHaveText(['50%', '75%', '100%', '150%']);
  // The pixel box and the old per-snap inputs are gone.
  await expect(page.locator('#snap-zone')).toHaveCount(0);
  await expect(page.locator('#snap-node')).toHaveCount(0);

  await pick.selectOption('1.5');
  const stored = await page.evaluate(() =>
    window.DraftProfileManager.getActive('settings')?.content?.model?.snapReach);
  expect(stored).toBe(1.5);
  await page.reload();
  await page.locator('.advanced summary').click();
  await expect(page.locator('#snap-reach')).toHaveValue('1.5');
});

test('a strength that is not one of the four reads as 100%', async ({ page }) => {
  await page.goto('/SETTINGS.html');
  await page.evaluate(() => {
    const active = window.DraftProfileManager.getActive('settings');
    window.DraftProfileManager.saveActive(window.DraftProfileManager.createPackage(
      'settings', active?.name || 'test', { model: { snapReach: 7 } }));
  });
  await page.reload();
  await page.locator('.advanced summary').click();
  await expect(page.locator('#snap-reach')).toHaveValue('1');
});

test('MODEL reads the strength: at 150% every reach is half again as long', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => typeof reachFt === 'function');
  const plain = await page.evaluate(() => reachFt('suite'));
  await page.evaluate(() => {
    const active = window.DraftProfileManager.getActive('settings');
    window.DraftProfileManager.saveActive(window.DraftProfileManager.createPackage(
      'settings', active?.name || 'test', { model: { snapReach: 1.5 } }));
  });
  await page.reload();
  await page.waitForFunction(() => typeof reachFt === 'function');
  expect(plain).toBeCloseTo(0.25, 6);
  expect(await page.evaluate(() => reachFt('suite'))).toBeCloseTo(0.375, 6);
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
