// THE RAIL IS WIDE ENOUGH FOR WHAT IS IN IT.
//
// Movie, 14 Oct, circling the slider that had appeared under the seat
// thumbnails: "can you widen this menu so the RIGHT/LEFT scroll won't be
// needed".
//
// THE ARITHMETIC WAS RIGHT ABOUT EVERYTHING BUT THE SCROLLBAR. --rail-w was
// worked out as the seat grid (two 84px seats and a 6px gap = 174) plus 10px
// of padding either side and the 1px edge, which is 195 -- and the rail
// SCROLLS, so on a desktop its vertical bar takes about 15px off the inside
// of that box and leaves the grid 159px to stand in. The browser's answer to
// a grid that does not fit is a second, sideways scroller, which is what he
// was circling.
//
// WHAT THIS FILE HOLDS is the property, not the number: whatever the rail is
// worth, nothing inside it may need a sideways slider to reach. A later
// retune of the seat size or the padding is free to move 210 anywhere it
// likes and this still asks the right question.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const railMetrics = page => page.evaluate(() => {
  const rail = document.getElementById('right-rail');
  if (!rail) return null;
  const grid = document.getElementById('view-rail');
  return {
    client: rail.clientWidth,
    scroll: rail.scrollWidth,
    gutter: Math.round(rail.getBoundingClientRect().width) - rail.clientWidth,
    grid: grid ? Math.round(grid.getBoundingClientRect().width) : 0,
    seats: document.querySelectorAll('.seat').length,
  };
});

test('the seat rail needs no sideways scroll', async ({ page }) => {
  await h.openModel(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openModelRail(page);
  const at = await railMetrics(page);
  expect(at, 'there is no right rail to measure').not.toBeNull();
  expect(at.seats, 'the rail is empty, so this proves nothing').toBeGreaterThan(1);
  // NOTHING OVERFLOWS SIDEWAYS. A pixel of slop for sub-pixel layout; two
  // would be a slider.
  expect(at.scroll - at.client,
    `the rail scrolls ${at.scroll - at.client}px sideways`).toBeLessThanOrEqual(1);
  // AND THE GRID FITS INSIDE WHAT IS LEFT after the padding and the bar's own
  // lane -- which is the thing that was actually wrong, rather than the
  // overflow it produced.
  expect(at.grid, 'the seat grid is wider than the rail can hold')
    .toBeLessThanOrEqual(at.client - 20 + 1);
});

test('and the scrollbar has a lane of its own, showing or not', async ({ page }) => {
  // `scrollbar-gutter:stable` is why the fix holds on a machine whose
  // scrollbars overlay (a phone, a Mac, this headless browser) AND on one
  // whose scrollbars take room (his). Without it the rail would be right on
  // one and wrong on the other, and the one it was wrong on is the one he
  // draws with.
  await h.openModel(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openModelRail(page);
  const reserved = await page.evaluate(() => getComputedStyle(
    document.getElementById('right-rail')).scrollbarGutter);
  expect(reserved, 'the rail does not reserve a lane for its scrollbar')
    .toContain('stable');
});
