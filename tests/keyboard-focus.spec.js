const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Global drawing shortcuts used to fire while a form control had focus, so
// choosing an export format could silently switch the active tool.
test.describe('shortcuts while a control has focus', () => {
  test('a focused select keeps the keys the user is typing', async ({ page }) => {
    await h.openModel(page);
    await page.locator('select').first().focus();
    await page.keyboard.press('l');
    await page.waitForTimeout(200);

    const labels = await h.activeToolLabels(page);
    expect(labels.some(l => /\bLINE\b/i.test(l))).toBe(false);
    expect(labels.some(l => /^Select/.test(l))).toBe(true);
  });

  test('a focused button does not also run the global Space command', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.clickWorld(page, 10, 0);

    // Space finishes a chain. With the Wall button focused the button owns the
    // key, so the pending segment must be discarded by the tool switch, never
    // committed behind the user's back.
    await page.locator('.tool-key', { has: page.locator('.tool-key-name', { hasText: /^Wall$/i }) }).focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);

    expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
  });

  test('the canvas still answers shortcuts', async ({ page }) => {
    await h.openModel(page);
    await page.locator('[data-model-canvas]').click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('w');
    await page.waitForTimeout(200);

    const labels = await h.activeToolLabels(page);
    expect(labels.some(l => /\bWALL\b/i.test(l))).toBe(true);
  });
});
