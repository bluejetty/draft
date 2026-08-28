// The bottom-right nav cluster: MODEL · LAYOUT · PROJECT and the logo back
// to the main page, riding the status bar on both drawing pages.
const { test, expect } = require('@playwright/test');
const { openModel } = require('./helpers');

const LINKS = [
  ['[data-nav-model]', 'MODEL.dc.html'],
  ['[data-nav-layout]', 'LAYOUT.dc.html'],
  ['[data-nav-project]', 'PROJECT.html'],
  ['[data-nav-home]', 'index.html'],
];

test('MODEL carries the nav cluster with MODEL wearing the dark face', async ({ page }) => {
  await openModel(page);

  for (const [selector, target] of LINKS) {
    const link = page.locator(selector);
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toContain(target);
  }
  await expect(page.locator('[data-nav-model]')).toHaveCSS('background-color', 'rgb(29, 31, 32)');
  await expect(page.locator('[data-nav-layout]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('LAYOUT carries the nav cluster with LAYOUT wearing the dark face', async ({ page }) => {
  await page.goto('/LAYOUT.dc.html');

  for (const [selector, target] of LINKS) {
    const link = page.locator(selector);
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toContain(target);
  }
  await expect(page.locator('[data-nav-layout]')).toHaveCSS('background-color', 'rgb(29, 31, 32)');
  await expect(page.locator('[data-nav-model]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('the cluster walks MODEL over to PROJECT and the logo back home', async ({ page }) => {
  await openModel(page);

  await page.click('[data-nav-project]');
  await expect(page).toHaveURL(/PROJECT\.html/);

  await page.goto('/LAYOUT.dc.html');
  await page.click('[data-nav-home]');
  await expect(page).toHaveURL(/index\.html|\/$/);
});
