const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const CUT_RED = [176, 64, 96];
const PENDING_RED = [153, 68, 102];

// Cuts are Three.js objects; without WebGL the overlay is the only renderer.
test.describe('Cut with WebGL unavailable', () => {
  test('placement preview and committed cut are drawn in 2D', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await page.keyboard.press('c');

    await h.clickWorld(page, -10, 6);
    await h.moveTo(page, 10, 6);
    await page.waitForTimeout(200);

    const mid = await h.worldToClient(page, 0, 6);
    const preview = await h.overlayPixels(page, mid.x, mid.y, 16);
    expect(h.countColor(preview, PENDING_RED)).toBeGreaterThan(0);

    page.once('dialog', dialog => dialog.accept('SECTION A-A'));
    await h.clickWorld(page, 10, 6);       // end point → direction choice
    await h.moveTo(page, 0, 0);
    await page.waitForTimeout(200);
    await h.clickWorld(page, 0, 0);        // choose direction, name the cut
    await page.waitForTimeout(500);

    const committed = await h.overlayPixels(page, mid.x, mid.y, 16);
    expect(h.countColor(committed, CUT_RED)).toBeGreaterThan(0);
  });

  test('deleting a level removes only the cuts that level owns', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    // window.prompt / confirm answers, consumed in order.
    const answers = [];
    page.on('dialog', dialog => dialog.accept(answers.shift() ?? ''));

    const placeCut = async (name, z) => {
      await page.keyboard.press('c');
      answers.push(name);
      await h.clickWorld(page, -10, z);
      await h.clickWorld(page, 10, z);
      await h.clickWorld(page, 0, z - 6);
      await page.waitForTimeout(400);
    };

    await placeCut('SECTION A-A', 6);

    answers.push('LEVEL 2', '10');
    await page.getByRole('button', { name: '+ ADD' }).click();
    await page.waitForTimeout(400);
    await page.locator('.level-row').nth(1).locator('.level-body').click();
    await page.waitForTimeout(400);

    await placeCut('SECTION B-B', 12);
    await h.waitForSaved(page);

    const before = await h.savedDrawing(page);
    expect(before.cuts.map(c => c.name)).toEqual(['SECTION A-A', 'SECTION B-B']);
    expect(new Set(before.cuts.map(c => c.levelId)).size).toBe(2);

    await page.locator('.level-row').nth(1).locator('.level-del').click();
    await h.waitForSaved(page);

    const after = await h.savedDrawing(page);
    expect(after.cuts.map(c => c.name)).toEqual(['SECTION A-A']);
  });
});
