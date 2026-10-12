// THE ROUGH DRAFTER LOGO ON EVERY BAR. Movie, 12 Oct: "we need a ROUGH DRAFTER
// logo which links back to the ENTRY area page, put it to the left of the
// SETTINGS / STANDARDS button up top".
const { test, expect } = require('@playwright/test');

for (const pagePath of ['/MODEL.html', '/LAYOUT.html', '/PROJECT.html']) {
  test(`${pagePath}: the logo stands left of SETTINGS / STANDARDS and goes to the entry page`, async ({ page }) => {
    await page.goto(pagePath);
    const logo = page.locator('#strip #home-logo');
    await expect(logo).toBeVisible({ timeout: 10000 });
    await expect(logo).toHaveAttribute('href', './');
    const img = logo.locator('img');
    await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    const l = await logo.boundingBox();
    const s = await page.locator('#settings-stack').boundingBox();
    expect(l.x + l.width, 'left of the stack').toBeLessThanOrEqual(s.x);
    expect(Math.abs((l.y + l.height / 2) - (s.y + s.height / 2)), 'level with it').toBeLessThan(2);
    await logo.click();
    await expect(page).toHaveURL(/\/(index\.html)?$/);
  });
}
