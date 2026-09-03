// The right rail lists views in the drawing set's order, not its own.
//
// The rail used to render the four automatic elevations and the drafter's
// sections through one sc-for, so a section landed directly under E4 at the
// top. The printed set runs elevations first and sections near the end, after
// foundation and basement (RD-DOCUMENTS/paper-rules.md) — and a drafter who knows the set
// should not have to learn a second order for the screen.
//
// The split is at `auto`, which already told elevations from sections. No new
// field on the cut record, no renaming or re-sorting of E1-E4.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const headingOrder = page => page.evaluate(() => {
  const rail = document.querySelector('[data-model-right]');
  if (!rail) return [];
  return [...rail.querySelectorAll('div')]
    .map(el => (el.childNodes.length === 1 && el.firstChild.nodeType === 3
      ? el.textContent.trim() : ''))
    .filter(t => ['Elevations', 'Levels', 'Sections'].includes(t));
});

// The four automatic elevations only exist once the plan has walls --
// _autoElevationCuts() reads _planWallExtents() and returns [] without them --
// so the rail is only realistic with a shell up. Then [C], two clicks for the
// cut line, one for the direction it looks.
async function railWithBoth(page) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await page.keyboard.press('c');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await h.clickWorld(page, 0, 8);
  await page.waitForTimeout(400);
  await h.waitForSaved(page);
}

test('SECTIONS sits below LEVELS in the rail, and ELEVATIONS above it', async ({ page }) => {
  await h.openModel(page);
  await railWithBoth(page);
  // Document order is the assertion a human would make looking at the rail.
  expect(await headingOrder(page)).toEqual(['Elevations', 'Levels', 'Sections']);
});

test('E1-E4 hold the top block with no section among them', async ({ page }) => {
  await h.openModel(page);
  await railWithBoth(page);
  const names = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('[data-model-right] div')]
      .filter(el => el.textContent.trim() === 'Elevations' && el.children.length === 0);
    const block = heads[0] && heads[0].parentElement;
    // The body holds the name as a bare text node followed by the side
    // label's span (E1 + FRONT), with no space between them.
    return block ? [...block.querySelectorAll('.cut-row .cut-body')]
      .map(el => (el.firstChild ? el.firstChild.textContent.trim() : '')) : [];
  });
  // Exactly the four automatic elevations, in their standard order.
  expect(names).toEqual(['E1', 'E2', 'E3', 'E4']);

  // Names and side labels come from company standards via _elevationName;
  // this board moves markup and must not touch either.
  const sides = await page.evaluate(() => [...document.querySelectorAll('[data-model-right] .cut-side')]
    .map(el => el.textContent.trim()).filter(Boolean));
  expect(sides).toEqual(['FRONT', 'LEFT', 'BACK', 'RIGHT']);
});

test('the section row lives in the SECTIONS block and still enters its view', async ({ page }) => {
  await h.openModel(page);
  await railWithBoth(page);
  const inSections = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('[data-model-right] div')]
      .filter(el => el.textContent.trim() === 'Sections' && el.children.length === 0);
    const block = heads[0] && heads[0].parentElement;
    return block ? block.querySelectorAll('.cut-row').length : 0;
  });
  expect(inSections).toBe(1);

  // Clicking it still enters that cut view — this was a move, not a rewrite.
  await page.locator('[data-model-right] .cut-row').last().click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
});
