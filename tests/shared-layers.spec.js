const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Wall layers are shared between PLAN and ELECTRIC: they render and print at
// full strength in both views, but only PLAN can edit them.
const WALL_STROKE = [29, 31, 32]; // #1d1f20, the committed wall boundary color

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function switchLayerView(page, label) {
  await page.locator('.level-row.active').getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function wallStrokeCount(page, x, z) {
  const p = await h.worldToClient(page, x, z);
  const pixels = await h.overlayPixels(page, p.x, p.y);
  return h.countColor(pixels, WALL_STROKE);
}

test.describe('shared wall layers', () => {
  test('PLAN walls render at full strength in ELECTRIC but stay uneditable there', async ({ page }) => {
    await h.openModel(page);
    await drawWall(page, -10, 0, 10, 0);

    await switchLayerView(page, 'ELECTRIC');
    expect(await wallStrokeCount(page, 5, 0)).toBeGreaterThan(0);

    // Clicking and deleting in ELECTRIC must leave the wall untouched.
    await h.selectTool(page, 'Select');
    await h.clickWorld(page, 5, 0);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(1);

    // The same wall stays editable from PLAN.
    await switchLayerView(page, 'PLAN');
    await h.selectTool(page, 'Select');
    await h.clickWorld(page, 5, 0);
    await page.keyboard.press('Delete');
    await h.waitForSaved(page);
    expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(0);
  });

  test('shared walls stay in the ELECTRIC print output', async ({ page }) => {
    await h.openModel(page);
    await drawWall(page, -10, 0, 10, 0);
    await switchLayerView(page, 'ELECTRIC');

    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.waitForTimeout(400);
    expect(await wallStrokeCount(page, 5, 0)).toBeGreaterThan(0);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  });
});
