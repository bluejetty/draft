const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A typed length used to reset the chain origin to the typed endpoint, so the
// chain could never be closed back onto its real first node.
test.describe('typed length inside a chain', () => {
  test('a Line chain still closes onto its first point', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');

    await h.clickWorld(page, 0, 0);
    await h.clickWorld(page, 10, 0);

    // Typed segment: aim north, freeze, type 10 ft.
    await h.moveTo(page, 10, -5);
    await page.keyboard.press('r');
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await h.clickWorld(page, 0, -10);
    await h.clickWorld(page, 0, 0);           // close

    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(4);
    expect(lines.filter(l => h.touchesPoint(l, 0, 0))).toHaveLength(2);
  });

  test('a Wall chain still closes onto its first point', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Wall');

    await h.clickWorld(page, 0, 0);
    await h.clickWorld(page, 10, 0);

    await h.moveTo(page, 10, -5);
    await page.keyboard.press('r');
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await h.clickWorld(page, 0, -10);
    await h.clickWorld(page, 0, 0);

    await h.waitForSaved(page);
    const walls = h.allWalls(await h.savedDrawing(page));
    expect(walls).toHaveLength(4);
    expect(walls.filter(w => h.touchesPoint(w, 0, 0))).toHaveLength(2);
  });

  test('the 2D preview follows the typed length, not the cursor', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);

    await h.moveTo(page, 4, 0);
    const far = await h.worldToClient(page, 17, 0);
    const before = await h.overlayPixels(page, far.x, far.y);

    await page.keyboard.press('r');
    await page.keyboard.type('17');
    await page.waitForTimeout(300);
    const after = await h.overlayPixels(page, far.x, far.y);

    expect(after.join(',')).not.toBe(before.join(','));
  });
});
