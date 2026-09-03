// TIER 2a — MODEL.html paints ONE level, not five stacked.
//
// Tier 1 drew every level at once. That is not a drawing, it is five drawings
// on top of each other, and it was the first thing tier 2 owed. See
// RD-DOCUMENTS/SPEC-model-html-tiers.md.
//
// The filter is FIVE RULES, not one, measured out of MODEL.dc.html:6505 rather
// than guessed:
//
//   walls / lines / floors   level AND view
//   roofs / outlines         level ONLY -- no view filter
//   and the view filter switches ITSELF OFF on a level with no layer views
//   (ROOF id 7, SITE id 8), which show everything they hold.
//
// Each test below is written to fail if the filter were deleted, not merely to
// pass while it happens to be there.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The rule, longhand. Deliberately NOT layer-views.js: asking the module the
// same question the page asks it would let a wrong answer agree with itself.
const MAIN_FL = 3, FOUNDATION = 1;
const onLevel = (item, levelId, viewId) => Number(item.levelId) === levelId
  && (item.view || 'plan') === viewId;

const readout = page => page.locator('#readout');
const wallCount = async page => Number(
  (await readout(page).textContent()).match(/walls (\d+)/)?.[1] ?? -1);

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test.describe('MODEL.html levels', () => {
  test('it opens on MAIN FL and paints that level only', async ({ page }) => {
    const saved = await houseOnOldPage(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 5000 });

    const expected = saved.walls.filter(w => onLevel(w, MAIN_FL, 'plan')).length;

    // THE CONTROL. Without these two the test passes on a page that ignores
    // the filter entirely: if every wall happened to be on MAIN FL, "shows
    // the right number" and "shows all of them" are the same assertion.
    expect(expected, 'the fixture must put walls on MAIN FL').toBeGreaterThan(0);
    expect(expected, 'and must ALSO put walls elsewhere, or nothing is filtered')
      .toBeLessThan(saved.walls.length);

    expect(await wallCount(page)).toBe(expected);
  });

  test('a different level is a different drawing', async ({ page }) => {
    const saved = await houseOnOldPage(page);

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 5000 });
    const onMain = await wallCount(page);

    await page.goto(`/MODEL.html?level=${FOUNDATION}`);
    await expect(readout(page)).toContainText('FOUNDATION', { timeout: 5000 });
    const onFoundation = await wallCount(page);

    // FOUNDATION opens on the concrete plan, not the walls plan -- its default
    // layer view is 'foundation'. So this is not only a different level, it is
    // a different DRAWING of it, which is the whole point of layer-views.js.
    await expect(readout(page)).toContainText('foundation');
    expect(onFoundation).toBe(
      saved.walls.filter(w => onLevel(w, FOUNDATION, 'foundation')).length);
    expect(onMain + onFoundation,
      'two levels together must still be fewer than the whole drawing, or '
      + 'nothing is being held back')
      .toBeLessThan(saved.walls.length);
  });

  test('ROOF has no layer views, so it holds nothing back', async ({ page }) => {
    const saved = await houseOnOldPage(page);
    await page.goto('/MODEL.html?level=7');
    await expect(readout(page)).toContainText('ROOF', { timeout: 5000 });

    // The third rule: a level with no layer views shows everything ON it, with
    // no view filter at all. The readout says `all` rather than a view name.
    await expect(readout(page)).toContainText('all');
    expect(await wallCount(page))
      .toBe(saved.walls.filter(w => Number(w.levelId) === 7).length);
  });

  test('an unknown ?level falls back to MAIN FL and says so', async ({ page }) => {
    await houseOnOldPage(page);
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });

    await page.goto('/MODEL.html?level=99');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 5000 });
    expect(warnings.join(' '), 'a bad level must not blank the page silently')
      .toContain('99');
  });
});
