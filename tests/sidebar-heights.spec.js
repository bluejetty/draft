// The right rail keeps each layer set's standards list tucked away: clicking
// the set's button reveals it and it hides itself again after a minute. The
// freed space beside each level title shows key construction heights, measured
// from a 0' datum at the top of the main-floor sheathing (switchable to 100').
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

test('layer standards stay hidden until their set is clicked, then hide after a minute', async ({ page }) => {
  await page.clock.install();
  await h.openModel(page);

  await expect(page.locator('.level-layer-content')).toHaveCount(0);

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'PLAN', exact: true }).click();
  await expect(page.locator('.level-layer-content').first()).toBeVisible();

  await page.clock.fastForward(61_000);
  await expect(page.locator('.level-layer-content')).toHaveCount(0);
});

test('switching layer sets moves the revealed list and restarts the timer', async ({ page }) => {
  await page.clock.install();
  await h.openModel(page);

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'PLAN', exact: true }).click();
  await page.clock.fastForward(40_000);
  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'FLOOR', exact: true }).click();
  await expect(levelRow(page, 'MAIN FL').locator('.level-layer-content').first()).toBeVisible();

  // The earlier click's timer must not hide the newly revealed set.
  await page.clock.fastForward(40_000);
  await expect(page.locator('.level-layer-content').first()).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(page.locator('.level-layer-content')).toHaveCount(0);
});

test('levels show construction height marks from the sheathing datum', async ({ page }) => {
  await h.openModel(page);

  // MAIN FL: sheathing is the 0' datum, walls default to 8'-1 1/8" plates.
  const main = levelRow(page, 'MAIN FL');
  await expect(main.locator('.level-height', { hasText: 'T.O. SHEATHING' })).toContainText(`0"`);
  await expect(main.locator('.level-height', { hasText: 'T.O. WALL' })).toContainText(`8'-1 1/8"`);

  // FOUNDATION: wall top sits one floor thickness below the datum.
  const fdn = levelRow(page, 'FOUNDATION');
  await expect(fdn.locator('.level-height', { hasText: 'T.O. FDN WALL' })).toContainText(`-1'-0 5/8"`);
  await expect(fdn.locator('.level-height', { hasText: 'T.O. FOOTING' })).toBeVisible();

  // 2ND FL: sheathing = main wall top + floor thickness.
  const second = levelRow(page, '2ND FL');
  await expect(second.locator('.level-height', { hasText: 'T.O. SHEATHING' })).toContainText(`9'-1 3/4"`);
  await expect(second.locator('.level-height', { hasText: 'B.O. TRUSS' })).toBeVisible();
});

test('the datum toggle shifts every mark by 100 feet and persists', async ({ page }) => {
  await h.openModel(page);

  await page.getByRole('button', { name: "DATUM 0'" }).click();
  await expect(page.getByRole('button', { name: "DATUM 100'" })).toBeVisible();

  const main = levelRow(page, 'MAIN FL');
  await expect(main.locator('.level-height', { hasText: 'T.O. SHEATHING' })).toContainText(`+100'-0"`);
  const fdn = levelRow(page, 'FOUNDATION');
  await expect(fdn.locator('.level-height', { hasText: 'T.O. FDN WALL' })).toContainText(`+98'-11 3/8"`);

  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).elevationDatum).toBe(100);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: "DATUM 100'" })).toBeVisible();
});
