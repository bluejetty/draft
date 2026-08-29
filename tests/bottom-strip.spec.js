// The bottom instrument strip after the Replit-era status line retired
// (board #259): PROJECT in all four corners, the ruler / LENGTH / T-square /
// protractor cluster dead-center with three dormant chips on each side, every
// chip lighting its own colour under the cursor, and no X/Y or level/view
// readouts anywhere.
const { test, expect } = require('@playwright/test');
const { openModel } = require('./helpers');

test('PROJECT stands in all four corners, the logo keeping the true bottom-right', async ({ page }) => {
  await openModel(page);

  const corners = [
    '[data-project-open]',        // top-left
    '[data-project-corner-tr]',   // top-right
    '[data-project-corner-bl]',   // bottom-left
    '[data-nav-project]',         // bottom-right, one seat in from the logo
  ];
  for (const selector of corners) {
    const control = page.locator(selector);
    await expect(control).toBeVisible();
    await expect(control).toHaveText('PROJECT');
  }

  // The logo earns the actual corner; PROJECT rides beside it.
  const projectBox = await page.locator('[data-nav-project]').boundingBox();
  const homeBox = await page.locator('[data-nav-home]').boundingBox();
  expect(homeBox.x).toBeGreaterThan(projectBox.x + projectBox.width - 1);
});

test('the instrument cluster holds the center of the strip', async ({ page }) => {
  await openModel(page);

  const strip = await page.locator('[data-instrument-strip]').boundingBox();
  const center = await page.locator('[data-strip-center]').boundingBox();
  const stripMid = strip.x + strip.width / 2;
  const centerMid = center.x + center.width / 2;
  expect(Math.abs(centerMid - stripMid)).toBeLessThan(2);

  // The working instruments all live inside the centered cluster.
  for (const selector of ['[data-mode-ruler]', '[data-frozen-length]', '[data-mode-tsquare]', '[data-mode-protractor]']) {
    await expect(page.locator(`[data-strip-center] ${selector}`)).toBeVisible();
  }
});

test('three dormant chips flank each side of the working instruments', async ({ page }) => {
  await openModel(page);

  const leftChips = ['[data-mode-compass]', '[data-mode-triangle]', '[data-mode-brush]'];
  const rightChips = ['[data-mode-scale]', '[data-mode-shield]', '[data-mode-frenchcurve]'];

  const rulerBox = await page.locator('[data-mode-ruler]').boundingBox();
  for (const selector of leftChips) {
    const box = await page.locator(selector).boundingBox();
    expect(box.x + box.width).toBeLessThan(rulerBox.x);
  }

  const protractorBox = await page.locator('[data-mode-protractor]').boundingBox();
  for (const selector of rightChips) {
    const box = await page.locator(selector).boundingBox();
    expect(box.x).toBeGreaterThan(protractorBox.x + protractorBox.width);
  }
});

test('every side chip lights its own colour under the cursor', async ({ page }) => {
  await openModel(page);

  const glows = [
    ['[data-mode-compass]', 'rgb(217, 126, 47)'],
    ['[data-mode-triangle]', 'rgb(63, 159, 159)'],
    ['[data-mode-brush]', 'rgb(138, 99, 184)'],
    ['[data-mode-scale]', 'rgb(106, 154, 74)'],
    ['[data-mode-shield]', 'rgb(192, 80, 80)'],
    ['[data-mode-frenchcurve]', 'rgb(74, 127, 192)'],
  ];
  for (const [selector, color] of glows) {
    const chip = page.locator(selector);
    await chip.hover();
    await expect(chip).toHaveCSS('color', color);
  }
});

test('the Replit-era readouts are gone from both drawing pages', async ({ page }) => {
  await openModel(page);

  await expect(page.locator('[data-model-sx]')).toHaveCount(0);
  await expect(page.locator('[data-model-sy]')).toHaveCount(0);
  const strip = page.locator('[data-instrument-strip]');
  await expect(strip).not.toContainText('TOP / PLAN');
  await expect(strip).not.toContainText('MAIN FL / PLAN');
  // The idle bg-blue hint retired with the line: the background seat only
  // shows once a reference is actually engaged.
  await expect(page.locator('[data-model-background-status]')).toHaveCount(0);
  // The cut-view seat stays, empty until a section or elevation opens.
  await expect(page.locator('[data-model-title-detail]')).toHaveText('');

  await page.goto('/LAYOUT.dc.html');
  await expect(page.locator('[data-nav-cluster]')).toBeVisible();
  await expect(page.locator('[data-layout-sx]')).toHaveCount(0);
  await expect(page.locator('[data-layout-sy]')).toHaveCount(0);
});

test('the SAVED light sits beside SAVE in the top bar', async ({ page }) => {
  await openModel(page);

  const status = page.locator('[data-save-controls] [data-model-status]');
  await expect(status).toHaveCount(1);
  const saveBox = await page.getByRole('button', { name: 'SAVE', exact: true }).boundingBox();
  const statusBox = await page.locator('[data-model-status]').boundingBox();
  expect(statusBox.x).toBeGreaterThan(saveBox.x);
  expect(Math.abs((statusBox.y + statusBox.height / 2) - (saveBox.y + saveBox.height / 2))).toBeLessThan(10);
});
