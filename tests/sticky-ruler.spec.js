const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Sticky RULER mode: R is a latch, not a one-shot. Once lit, the length box
// re-opens after every committed segment — point, type, Enter, point, type —
// until R turns it back off.
const LIT = 'rgb(224, 122, 32)';

async function chipColor(page) {
  return page.$eval('[data-mode-ruler]', el => getComputedStyle(el).color);
}

test.describe('sticky ruler mode', () => {
  test('R latches on: segment after segment with no second R', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);            // point east

    await page.keyboard.press('r');        // latch ON
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();
    expect(await chipColor(page)).toBe(LIT);

    await page.keyboard.type('10');
    await page.keyboard.press('Enter');    // commit — box re-opens empty
    await expect(box).toBeEnabled();
    await expect(box).toHaveValue('');
    expect(await chipColor(page)).toBe(LIT);

    await h.moveTo(page, 10, -5);          // swing north — no R
    await page.keyboard.type('8');
    await page.keyboard.press('Enter');
    await expect(box).toBeEnabled();       // still armed for the next one

    await page.keyboard.press('Enter');    // empty box = finish the chain
    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(2);
    expect(lines.filter(l => h.touchesPoint(l, 10, 0))).toHaveLength(2);
    expect(lines.some(l => h.touchesPoint(l, 10, -8))).toBe(true);
    expect(await chipColor(page)).toBe(LIT);  // mode survives the finished chain
  });

  test('R again turns the ruler off, even from inside the box', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);

    await page.keyboard.press('r');        // ON — box takes focus
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();

    await page.keyboard.press('r');        // OFF — typed into the focused box
    await expect(box).toBeDisabled();      // the permanent box goes idle
    await expect(box).toHaveValue('');
    expect(await chipColor(page)).not.toBe(LIT);

    await h.clickWorld(page, 6, 0);        // ordinary click-drawn segment
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(1);
    expect(h.touchesPoint(lines[0], 6, 0)).toBe(true);
  });

  test('R before the first click arms the ruler for the whole run', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Wall');
    await page.keyboard.press('r');        // latch ON before drawing
    expect(await chipColor(page)).toBe(LIT);
    await expect(page.locator('[data-frozen-length]')).toBeDisabled();

    await h.clickWorld(page, 0, 0);        // first corner wakes the box
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();

    await h.moveTo(page, 5, 0);
    await page.keyboard.type('12');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');    // finish
    await h.waitForSaved(page);
    const walls = h.allWalls(await h.savedDrawing(page));
    expect(walls).toHaveLength(1);
    expect(h.touchesPoint(walls[0], 12, 0)).toBe(true);
  });

  test('an empty-box canvas click drops the corner and stays armed', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);
    await page.keyboard.press('r');        // ON, nothing typed

    await h.clickWorld(page, 7, 0);        // ordinary corner at the cursor
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();       // re-armed for the next segment

    await h.moveTo(page, 7, -5);
    await page.keyboard.type('9');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');    // finish
    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(2);
    expect(lines.filter(l => h.touchesPoint(l, 7, 0))).toHaveLength(2);
    expect(lines.some(l => h.touchesPoint(l, 7, -9))).toBe(true);
  });

  test('a typed length beats the click point while latched', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 5, 0);
    await page.keyboard.press('r');
    await page.keyboard.type('9');

    // While latched the segment keeps aiming where the cursor points, so the
    // click chooses the east ray — but the typed 9 wins over the click point.
    await h.clickWorld(page, 5, -1);
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();       // and the box is already re-armed
    await page.keyboard.press('Enter');    // empty box = finish
    await h.waitForSaved(page);
    const lines = h.allLines(await h.savedDrawing(page));
    expect(lines).toHaveLength(1);
    expect(h.touchesPoint(lines[0], 9, 0)).toBe(true);
    expect(h.touchesPoint(lines[0], 5, -1)).toBe(false);
  });

  test('the outline keeps the latch too', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Outline');
    await page.keyboard.press('r');
    await h.clickWorld(page, -5, 5);
    const box = page.locator('[data-frozen-length]');
    await expect(box).toBeEnabled();

    await h.moveTo(page, 0, 5);            // east
    await page.keyboard.type('20');
    await page.keyboard.press('Enter');
    await expect(box).toBeEnabled();

    await h.moveTo(page, 15, 0);           // north
    await page.keyboard.type('15');
    await page.keyboard.press('Enter');
    await expect(box).toBeEnabled();
    expect(await chipColor(page)).toBe(LIT);
  });
});
