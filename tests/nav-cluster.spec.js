// The bottom-right nav cluster: MODEL · LAYOUT · PROJECT and the logo back
// to the main page, riding the status bar on both drawing pages.
const { test, expect } = require('@playwright/test');
const { openModel } = require('./helpers');

const LINKS = [
  ['[data-nav-model]', 'MODEL.dc.html'],
  ['[data-nav-layout]', 'LAYOUT.html'],
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

test('LAYOUT carries the nav cluster with LAYOUT wearing the accent face', async ({ page }) => {
  await page.goto('/LAYOUT.html');

  for (const [selector, target] of LINKS) {
    const link = page.locator(selector);
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toContain(target);
  }
  // READ OFF THE SKIN, NOT TYPED. This page was rgb(29,31,32) against
  // rgb(255,255,255) until 24 Sep, when it went over to palette.js roles: the
  // chip for the page you are on is --accent and the others are
  // --surface-chip, and both of those are four different values depending on
  // which of the four skins is up. A literal here would be a spec that only
  // passes on RUFF night -- and worse, one that would keep passing if the
  // whole page lost its skin, since an unskinned var() falls back to
  // transparent rather than to the old colour.
  //
  // THE ASSERTION IS STILL THAT THEY DIFFER, which is the rule the cluster
  // has always carried: the current page wears a face nothing else wears.
  const skin = await page.evaluate(() => {
    const seen = getComputedStyle(document.documentElement);
    return {
      accent: seen.getPropertyValue('--accent').trim(),
      chip: seen.getPropertyValue('--surface-chip').trim(),
    };
  });
  expect(skin.accent, 'the page never got a skin').toBeTruthy();
  expect(skin.accent).not.toBe(skin.chip);
  const rgb = async hex => page.evaluate(value => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.appendChild(probe);
    const out = getComputedStyle(probe).color;
    probe.remove();
    return out;
  }, hex);
  await expect(page.locator('[data-nav-layout]'))
    .toHaveCSS('background-color', await rgb(skin.accent));
  await expect(page.locator('[data-nav-model]'))
    .toHaveCSS('background-color', await rgb(skin.chip));
});

test('the cluster walks MODEL over to PROJECT and the logo back home', async ({ page }) => {
  await openModel(page);

  await page.click('[data-nav-project]');
  await expect(page).toHaveURL(/PROJECT\.html/);

  await page.goto('/LAYOUT.html');
  await page.click('[data-nav-home]');
  await expect(page).toHaveURL(/index\.html|\/$/);
});
