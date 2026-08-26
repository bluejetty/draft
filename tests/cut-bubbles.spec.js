const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const CUT_RED = [176, 64, 96];

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6);
  await page.waitForTimeout(300);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

test.describe('Cut bubble styles', () => {
  test('STANDARDS offers the triangle style, tucked by default, and remembers proud', async ({ page }) => {
    await page.goto('/STANDARDS.html');
    const select = page.locator('[data-cut-bubble-style]');
    await expect(select).toHaveValue('tucked');

    await select.selectOption('proud');
    await expect(page.locator('#status')).toContainText('proud triangle');

    await page.reload();
    await expect(page.locator('[data-cut-bubble-style]')).toHaveValue('proud');

    await page.locator('#reset').click();
    await expect(page.locator('[data-cut-bubble-style]')).toHaveValue('tucked');
  });

  test('marks render in both office styles', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // Tucked (default): the E1 mark inks its line in the wall-to-dims gap.
    const south = await h.worldToClient(page, 0, 6.75);
    const pixels = await h.overlayPixels(page, south.x, south.y, 20);
    expect(h.countColor(pixels, CUT_RED)).toBeGreaterThan(0);

    // Flip the office to the proud rim triangle; the marks still draw.
    await page.goto('/STANDARDS.html');
    await page.locator('[data-cut-bubble-style]').selectOption('proud');
    await expect(page.locator('#status')).toContainText('proud triangle');

    await page.goto('/MODEL.dc.html');
    await expect(page.locator('[data-model-canvas]')).toBeVisible();
    await page.waitForTimeout(500);
    const proudPixels = await h.overlayPixels(page, south.x, south.y, 20);
    expect(h.countColor(proudPixels, CUT_RED)).toBeGreaterThan(0);
  });

  test('hand-placed cuts run clear through the house to the dims gap', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // Cut a short section ending mid-house: (-6,0) to (0,0).
    await page.keyboard.press('c');
    await h.clickWorld(page, -6, 0);
    await h.clickWorld(page, 0, 0);
    await h.clickWorld(page, -3, -4);
    await page.waitForTimeout(400);
    await h.waitForSaved(page);

    // The line never dies halfway through: ink shows well past the drawn
    // end, still inside the house, where the infinite line carries on. The
    // 1px dashes blend into the floor fill, so the match runs looser here.
    const inside = await h.worldToClient(page, 6, 0);
    const insidePixels = await h.overlayPixels(page, inside.x, inside.y, 12);
    expect(h.countColor(insidePixels, CUT_RED, 60)).toBeGreaterThan(0);

    // And the bubble lands in the wall-to-dims gap just outside the house,
    // not tossed out past the dimension strings.
    const gap = await h.worldToClient(page, 9, 0);
    const gapPixels = await h.overlayPixels(page, gap.x, gap.y, 20);
    expect(h.countColor(gapPixels, CUT_RED)).toBeGreaterThan(0);
    const far = await h.worldToClient(page, 15, 0);
    const farPixels = await h.overlayPixels(page, far.x, far.y, 12);
    expect(h.countColor(farPixels, CUT_RED)).toBe(0);
  });

  test('hand-placed cut bubbles toss out past the drawn ends', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    // Cut a section from (-6,0) to (6,0); its bubbles push ~6' further out.
    await page.keyboard.press('c');
    await h.clickWorld(page, -6, 0);
    await h.clickWorld(page, 6, 0);
    await h.clickWorld(page, 0, -4);
    await page.waitForTimeout(400);
    await h.waitForSaved(page);

    // Ink lives well outside the drawn end, where the pushed bubble sits.
    const out = await h.worldToClient(page, 11, 0);
    const pixels = await h.overlayPixels(page, out.x, out.y, 20);
    expect(h.countColor(pixels, CUT_RED)).toBeGreaterThan(0);
  });
});
