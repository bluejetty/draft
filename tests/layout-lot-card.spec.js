// THE LOT, ASKED ON THE LAYOUT SHEET TOO (Movie, 13 Oct): "also do the LAYOUT
// area if the SITE isn't loaded yet, and they go there, bring it up".
//
// WHAT THIS FILE IS REALLY FOR is the half of that nobody writes a spec for:
// the card stands ON the sheet, so it takes every press underneath it. Put at
// the top centre -- which is where it first went, under a comment that said
// bottom-left -- it covered the middle of the sheet and swallowed the press
// that PLACES A VIEWPORT. Two specs that place one (defaults.spec.js,
// undo-layout.spec.js) went red the moment SITE PLAN became the first sheet
// dealt, because until then the card was hardly ever up when they ran: a
// three-minute timeout each, in two different files, for a CSS rule.
//
// So the first test here is not about the lot at all. It asks whether the
// canvas is still reachable where a drafter works, with the card up -- which
// is the question those two timeouts were really asking.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const card = page => page.locator('#lay-lot');

// A HOUSE AND THE DEALT SET, which is what a drafter arrives at: the bone
// deals SITE PLAN first, so LAYOUT opens on the sheet that raises the card.
async function buildAndOpenLayout(page) {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

test('the card comes up on the SITE PLAN sheet when the drawing has no lot', async ({ page }) => {
  await buildAndOpenLayout(page);
  await expect(card(page)).toBeVisible();
  // AND IT OFFERS THE SAME SIZES MODEL DOES, because both read lot-sizes.js.
  // Counted against the module rather than typed here: two copies of a table
  // is how the two pages come to disagree about what an L is.
  const tiers = await page.evaluate(() => window.DraftLotSizes.LOT_TIERS.length);
  await expect(page.locator('#lay-lot [data-lot-tier]')).toHaveCount(tiers + 1);  // + OTHER
});

test('and it stands clear of the sheet, so a viewport can still be placed under it',
  async ({ page }) => {
    await buildAndOpenLayout(page);
    await expect(card(page), 'the card has to be UP or this proves nothing').toBeVisible();
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    // THE SAME PRESS undo-layout.spec.js makes, asked of the DOM instead of
    // the sheet: what is under the drafter's finger at the place a viewport
    // is placed. A card over that point answers BUTTON and the placement
    // never happens -- which is exactly how this was found.
    const under = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName}${el.id ? `#${el.id}` : ''}` : 'nothing';
    }, { x: box.x + box.width * 0.4, y: box.y + box.height * 0.45 });
    expect(under, 'something is standing on the sheet where a viewport is placed')
      .toBe('CANVAS#lay-canvas');
  });

test('NOT NOW puts it away and leaves the drawing alone', async ({ page }) => {
  await buildAndOpenLayout(page);
  await page.locator('#lay-lot [data-lot-skip]').click();
  await expect(card(page)).toBeHidden();
  // NOTHING WAS WRITTEN. "Not now" that quietly filed a lot would be worse
  // than a card that would not close.
  const lot = await page.evaluate(async () => {
    const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
    const saved = JSON.parse(await at.file.text());
    return !!window.DraftLotSizes.siteOutlineOf(saved.outlines);
  });
  expect(lot, 'NOT NOW drew a lot').toBe(false);
});

test('DRAW AUTOSITE files the lot and the card does not come back', async ({ page }) => {
  await buildAndOpenLayout(page);
  // THE FIRST SIZE THE BUILDING FITS ON, not the first row. Since 14 Oct a
  // tier too small for what is drawn is faded and disabled (Movie: "not allow
  // lots that are too small from the selections"), and this fixture's house
  // rules the narrowest one out -- `.first()` waited three minutes for a
  // button that will never be enabled.
  await page.locator('#lay-lot [data-lot-tier]:not([disabled])').first().click();
  await page.locator('#lay-lot [data-lot-draw]').click();
  await expect(card(page)).toBeHidden();
  // ON THE SITE LEVEL, which is what makes it the same lot MODEL draws rather
  // than a rectangle this page keeps to itself.
  const site = await page.evaluate(async () => {
    const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
    const saved = JSON.parse(await at.file.text());
    const lot = window.DraftLotSizes.siteOutlineOf(saved.outlines);
    return lot ? { levelId: Number(lot.levelId), points: (lot.points || []).length } : null;
  });
  expect(site, 'the lot was never written').not.toBeNull();
  expect(site.levelId, 'the lot is filed on SITE').toBe(8);
  expect(site.points, 'and it is a closed rectangle').toBe(4);
});
