const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Type-ahead ruler: mid-draw a plain digit wakes the ruler — no R — with the
// T-square holding the direction; Enter / Space / click commits the length.
test.describe('type-ahead ruler', () => {
  test('a digit opens the ruler mid-draw and Enter commits the typed length', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);          // point east — the T-square holds it

    await page.keyboard.press('1');      // digit alone wakes the ruler
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();
    await expect(box).toHaveValue('1');
    await page.keyboard.type('0');       // following digits keep typing
    await expect(box).toHaveValue('10');

    await page.keyboard.press('Enter');  // commit the segment
    await page.keyboard.press('Enter');  // finish the chain
    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(1);
    expect(h.touchesPoint(lines[0], 0, 0)).toBe(true);
    expect(h.touchesPoint(lines[0], 10, 0)).toBe(true);
  });

  test('direction → number repeats segment after segment without R', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);

    await h.moveTo(page, 5, 0);          // east
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');

    await h.moveTo(page, 10, -5);        // swing north, type the next number
    await page.keyboard.type('8');
    await page.keyboard.press('Enter');

    await page.keyboard.press('Enter');  // finish
    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(2);
    expect(lines.filter(l => h.touchesPoint(l, 10, 0))).toHaveLength(2);
    expect(lines.some(l => h.touchesPoint(l, 10, -8))).toBe(true);
  });

  test('Space commits a plain typed footage', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Wall');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);

    await page.keyboard.type('12');
    await page.keyboard.press(' ');      // Space is the off-hand commit
    await page.keyboard.press('Enter');  // finish
    await h.waitForSaved(page);
    const walls = h.allWalls(await h.savedDrawing(page));
    expect(walls).toHaveLength(1);
    expect(h.touchesPoint(walls[0], 12, 0)).toBe(true);
  });

  test('Space stays a literal separator inside feet-inch forms', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);

    await page.keyboard.type('8-1');
    await page.keyboard.press(' ');
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();     // no commit — the ruler stays open
    await expect(box).toHaveValue('8-1 ');
    await page.keyboard.type('1/8');
    await expect(box).toHaveValue('8-1 1/8');
  });

  test('a canvas click commits the typed length, not the click point', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);

    await page.keyboard.type('9');
    await h.clickWorld(page, 3, 7);      // anywhere — the click means "done"
    await page.keyboard.press('Enter');  // finish
    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(1);
    expect(h.touchesPoint(lines[0], 9, 0)).toBe(true);
    expect(h.touchesPoint(lines[0], 3, 7)).toBe(false);
  });

  test('digits do nothing when no segment is in progress', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await page.keyboard.press('5');
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeDisabled();    // the permanent box stays idle
    await expect(box).toHaveValue('');
  });
});
