// Background references pick either a whole level (its BG button) or one of
// its layer sets (the small BG button on the set's row). A scoped reference
// draws only that set's geometry, and choices are remembered per working
// context, so returning to a level / layer set restores its backgrounds.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

function levelBg(page, name) {
  return levelRow(page, name).locator('.level-bg');
}

function layerBg(page, name, layer) {
  return levelRow(page, name)
    .locator('.level-layer-row')
    .filter({ has: page.locator('.level-layer').getByText(layer, { exact: true }) })
    .locator('.level-layer-bg');
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('the level BG button backgrounds the whole level', async ({ page }) => {
  await h.openModel(page);

  await levelBg(page, '2ND FL').click();
  await expect(levelBg(page, '2ND FL')).toHaveText('B1');
  await expect(page.locator('[data-model-background-status]'))
    .toContainText('BACKGROUND BLUE: 2ND FL');

  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.backgroundLevelIds).toEqual([5]);
  expect(saved.backgroundLevelViews).toEqual({});
});

test('a layer-set BG button narrows the reference to that set', async ({ page }) => {
  await h.openModel(page);

  await layerBg(page, '2ND FL', 'FLOOR').click();
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B1');
  await expect(levelBg(page, '2ND FL')).toHaveText('B');
  await expect(page.locator('[data-model-background-status]'))
    .toContainText('BACKGROUND BLUE: 2ND FL / FLOOR');

  await h.waitForSaved(page);
  let saved = await h.savedDrawing(page);
  expect(saved.backgroundLevelIds).toEqual([5]);
  expect(saved.backgroundLevelViews).toEqual({ 5: 'floor' });

  // The level button widens the same reference back to the whole level.
  await levelBg(page, '2ND FL').click();
  await expect(levelBg(page, '2ND FL')).toHaveText('B1');
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B');

  // Selecting the set again scopes it; a second click removes the reference.
  await layerBg(page, '2ND FL', 'FLOOR').click();
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B1');
  await layerBg(page, '2ND FL', 'FLOOR').click();
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B');

  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.backgroundLevelIds).toEqual([]);
});

// The reference stroke is semi-transparent, so it reaches the overlay blended
// with whatever sits underneath; count clearly-blue pixels instead of an
// exact colour.
function countBluish(pixels) {
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    if (pixels[i + 2] > 200 && pixels[i + 2] - pixels[i] > 40) count += 1;
  }
  return count;
}

test('a scoped background draws only its own layer set', async ({ page }) => {
  await h.openModel(page);

  // Geometry on 2ND FL PLAN, then draft from MAIN FL.
  await switchLevel(page, '2ND FL');
  await drawLine(page, -10, 0, 10, 0);
  await switchLevel(page, 'MAIN FL');

  // Sample away from 0,0 so the origin marker never covers the blue stroke.
  const mid = await h.worldToClient(page, 5, 0);

  // Scoped to ELECTRIC, the PLAN line stays out of the background.
  await layerBg(page, '2ND FL', 'ELECTRIC').click();
  await page.waitForTimeout(300);
  expect(countBluish(await h.overlayPixels(page, mid.x, mid.y))).toBe(0);

  // Scoped to PLAN, the line appears as the blue reference.
  await layerBg(page, '2ND FL', 'PLAN').click();
  await page.waitForTimeout(300);
  expect(countBluish(await h.overlayPixels(page, mid.x, mid.y))).toBeGreaterThan(0);

  // The whole level includes the PLAN line as well.
  await levelBg(page, '2ND FL').click();
  await page.waitForTimeout(300);
  expect(countBluish(await h.overlayPixels(page, mid.x, mid.y))).toBeGreaterThan(0);
});

test('background choices are remembered per working context', async ({ page }) => {
  await h.openModel(page);

  // MAIN FL wants only 2ND FL's FLOOR behind it.
  await layerBg(page, '2ND FL', 'FLOOR').click();
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B1');

  // FOUNDATION prefers the whole 2ND FL level.
  await switchLevel(page, 'FOUNDATION');
  await levelBg(page, '2ND FL').click();
  await expect(levelBg(page, '2ND FL')).toHaveText('B1');
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B');

  // Each context restores its own remembered pick.
  await switchLevel(page, 'MAIN FL');
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B1');
  await expect(levelBg(page, '2ND FL')).toHaveText('B');

  await switchLevel(page, 'FOUNDATION');
  await expect(levelBg(page, '2ND FL')).toHaveText('B1');
  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B');
});

test('background scope and context memory persist through reload', async ({ page }) => {
  await h.openModel(page);

  await layerBg(page, '2ND FL', 'FLOOR').click();
  await switchLevel(page, 'FOUNDATION');
  await levelBg(page, '2ND FL').click();
  await switchLevel(page, 'MAIN FL');
  await h.waitForSaved(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(600);

  await expect(layerBg(page, '2ND FL', 'FLOOR')).toHaveText('B1');
  await expect(page.locator('[data-model-background-status]'))
    .toContainText('BACKGROUND BLUE: 2ND FL / FLOOR');

  await switchLevel(page, 'FOUNDATION');
  await expect(levelBg(page, '2ND FL')).toHaveText('B1');
});
