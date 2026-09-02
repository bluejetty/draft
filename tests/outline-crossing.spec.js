// A crossing outline encloses no floor, so it is refused at commit.
//
// It is drawable, which is the part that took measuring: the T-square is DOWN
// by default and squares every segment, so a clicked bowtie collapses onto an
// axis and the crossing never forms. Press `t` to stow it and the corners land
// exactly where they were clicked. Any spec here that does not stow the
// T-square is testing a different app -- and would pass against no fix at all.
//
// Zero is why this is refused rather than reported. Two lobes wind oppositely
// and the shoelace area is exactly 0, not merely wrong: a sheet reading 47 sq
// ft where it should say 50 gets questioned, one reading 0 for a room plainly
// on the page reads as a rendering glitch.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BOWTIE = [[-10, -8], [10, 8], [10, -8], [-10, 8]];
const SQUARE = [[-10, -8], [10, -8], [10, 8], [-10, 8]];

const drawOutline = async (page, pts) => {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of pts) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const saved = await h.savedDrawing(page);
  return ((saved && saved.outlines) || []).length;
};

test('a crossing outline is refused, and says why', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.keyboard.press('t');            // stow the T-square, or it squares the crossing away

  const before = ((await h.savedDrawing(page))?.outlines || []).length;
  const after = await drawOutline(page, BOWTIE);
  expect(after, 'the bowtie is not stored').toBe(before);
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/crosses itself/i);
});

test('a plain rectangle still commits with the T-square stowed', async ({ page }) => {
  // The control. Without it, a spec that broke outline drawing outright would
  // pass the test above and look like a working guard.
  await h.openModel(page, { webgl: false });
  await page.keyboard.press('t');

  const before = ((await h.savedDrawing(page))?.outlines || []).length;
  const after = await drawOutline(page, SQUARE);
  expect(after, 'the rectangle is stored').toBeGreaterThan(before);
});
