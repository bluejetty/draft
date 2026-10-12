// THE LADDER DEPTH GOES INVISIBLE ON A SILL PLATE. Movie, 12 Oct: "make the
// 'ladder' menu invisible when they have selected the SILL PLATE for
// attachemnt (so they don't get confused)". Invisible, not removed: the rows
// after it keep their places.
const { test, expect } = require('@playwright/test');

test('LADDER DEPTH shows only with a LADDER attachment, and its row keeps its seat', async ({ page }) => {
  await page.goto('/PROJECT.html?type=bungalow');
  const attach = page.locator('[data-detail-input="attachment"]');
  const ladder = page.locator('[data-detail-input="ladderDepth"]');
  const next = page.locator('[data-detail-input="fdnWallType"]');
  await expect(attach).toBeVisible({ timeout: 10000 });

  await attach.selectOption('sill');
  await expect(ladder, 'a sill plate has no ladder to size').toBeHidden();
  const seatSill = await next.boundingBox();

  await attach.selectOption('ladder');
  await expect(ladder).toBeVisible();
  const seatLadder = await next.boundingBox();
  expect(seatLadder.y, 'the row after it did not move').toBeCloseTo(seatSill.y, 0);
  expect(seatLadder.x).toBeCloseTo(seatSill.x, 0);

  await attach.selectOption('sill');
  await expect(ladder).toBeHidden();
});
