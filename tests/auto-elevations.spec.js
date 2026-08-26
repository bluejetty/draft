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

test.describe('Standard E1-E4 elevations', () => {
  test('the four elevations place themselves around the built house', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    // No walls yet — no marks.
    expect(await page.locator('.cut-row').count()).toBe(0);

    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    for (const name of ['E1', 'E2', 'E3', 'E4']) {
      const row = page.locator('.cut-row', { hasText: `${name} · ELEVATION` });
      await expect(row).toHaveCount(1);
      // Standard elevations aren't deletable — the × stays hidden.
      await expect(row.locator('.cut-del')).toBeHidden();
    }

    // They are generated, not stored: the saved drawing has no cuts.
    const saved = await h.savedDrawing(page);
    expect(saved.cuts).toEqual([]);
  });

  test('E1 sits below the plan looking up; E4 right looking left', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // E1's cut line runs along the bottom of the model area (larger z in
    // world terms) with the viewer standing south of it. Its bubble ink is
    // on the plan, south of the walls.
    const south = await h.worldToClient(page, 0, 16);
    const pixels = await h.overlayPixels(page, south.x, south.y, 20);
    expect(h.countColor(pixels, CUT_RED)).toBeGreaterThan(0);

    const east = await h.worldToClient(page, 18, 0);
    const eastPixels = await h.overlayPixels(page, east.x, east.y, 20);
    expect(h.countColor(eastPixels, CUT_RED)).toBeGreaterThan(0);

    // Opening E1 renders a generated elevation with real ink.
    await page.locator('.cut-row', { hasText: 'E1 · ELEVATION' }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
    const census = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { data } = canvas.getContext('2d')
        .getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
      }
      return ink;
    });
    expect(census).toBeGreaterThan(1200);
  });

  test('turning the standard off in COMPANY STANDARDS removes the marks', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await expect(page.locator('.cut-row')).toHaveCount(4);

    await page.goto('/STANDARDS.html');
    const toggle = page.locator('[data-auto-elevations]');
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await expect(page.locator('#status')).toContainText('Standard elevations are off');

    await page.goto('/MODEL.dc.html');
    await expect(page.locator('[data-model-canvas]')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('.cut-row')).toHaveCount(0);
  });
});
