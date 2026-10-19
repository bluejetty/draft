// INTERNET LINKS ON THE ENTRY PAGE, AND THE PAGE IT OPENS (Movie, 19 Oct):
// "put a link to useful other programs on my entry page maybe in the
// REFERENCE side, put INTERNET LINKS -- as a link that will go into a new page
// with basically ROUGHDRAFTER Favorite links. put this link in there as the
// first one" -- the DXF to DWG converter.
const { test, expect } = require('@playwright/test');

const box = (page, sel) => page.locator(sel).first().boundingBox();

test('INTERNET LINKS stands under REFERENCES, below the codes link, and opens the links page', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseURL}/index.html`);
  const link = page.locator('a[href="LINKS.html"]');
  await expect(link).toHaveText('INTERNET LINKS');
  // In the REFERENCES column, under the code link, clear of the logo.
  const refs = await page.locator('.ring-title', { hasText: /references/i }).boundingBox();
  const codes = await box(page, 'a[href="CODES.html"]');
  const links = await box(page, 'a[href="LINKS.html"]');
  const logo = await box(page, '.enter-logo');
  expect(links.y).toBeGreaterThan(refs.y + refs.height - 1);
  expect(links.y).toBeGreaterThan(codes.y + codes.height - 1);
  expect(links.x + links.width).toBeLessThanOrEqual(logo.x + 1);
  // And the page still fits the screen with it there.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await link.click();
  await expect(page).toHaveURL(/LINKS\.html$/);
  await expect(page.locator('h1')).toHaveText('Rough Drafter Favourite Links');
});

test('the links page lists the DXF to DWG converter first, in a new tab, and its header goes home', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/LINKS.html`);
  const items = page.locator('[data-links] ul.catalog a');
  await expect(items.first()).toHaveAttribute('href', 'https://pdfaid.com/dxf-to-dwg');
  await expect(items.first()).toContainText('DXF to DWG');
  await expect(items.first()).toHaveAttribute('target', '_blank');
  await expect(items.first()).toHaveAttribute('rel', /noopener/);
  // Its note says what it is for.
  await expect(page.locator('[data-links] ul.catalog li').first()).toContainText('DWG for AutoCAD');
  // Every entry is a link in a group with a heading.
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(1);
  expect(await page.locator('[data-links] h3').count()).toBeGreaterThanOrEqual(1);
  await page.locator('header a').click();
  await expect(page).toHaveURL(/\/(index\.html)?$/);
});
