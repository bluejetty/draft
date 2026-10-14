// THE SITE PLAN HAS SOMETHING ON IT.
//
// Movie, 14 Oct, having drawn a lot and gone to the layout: "i tried to do the
// site plan in the layout area - it should pop up a viewport with the new site
// plan, (nothing happens) i tried to RE-DEAL the sheets, and it still didn't
// pop up a site plan" -- and, the same hour: "also show a 'footprint shape' of
// the building on the site plan. is that possible".
//
// THE SHEET WAS DEALT EMPTY ON PURPOSE and nobody came back to it when the lot
// arrived: SITE PLAN is one of the names the set deals by name "even with
// nothing to draw on it". So the guard this file is really for is not "does
// the painter work" -- layout-plan.js's own harness can ask that -- it is
// WHETHER ANYTHING IS DEALT ONTO THE SHEET, which is what he reported twice.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A house, then a lot drawn from MODEL's own card: the drafter's own order,
// and the only one that leaves a lot AND a building in the drawing.
async function houseAndLot(page) {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await page.goto('/MODEL.html?level=8');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(400);
  // THE FIRST SIZE THE BUILDING FITS ON. The narrow tiers are faded and
  // disabled since 14 Oct, so `.first()` would wait on a button that never
  // enables.
  await page.locator('#lot-pick [data-lot-tier]:not([disabled])').first().click();
  await page.locator('#lot-pick [data-lot-pick-draw]').click();
  // AND SAVED, because this page does not save by itself and says so: the
  // button reads UNSAVED the instant a corner moves, by design ("a manual save
  // is only honest if the drafter can see there is something unsaved"). A lot
  // drawn and not saved is not in the file LAYOUT reads, which is a true thing
  // about the app rather than something for this spec to paper over.
  await page.locator('#save').click();
  await h.waitForSaved(page);
}

// A VIEWPORT NAMES ITS SHEET BY NUMBER (`sheet`, 1-based in the dealt order),
// and a sheet record carries no id of its own -- so the SITE PLAN's views are
// the ones whose number is its place in the list.
const siteViewports = page => page.evaluate(async () => {
  const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
  const saved = JSON.parse(await at.file.text());
  const layout = saved.layout || {};
  const index = (layout.sheets || []).findIndex(s => /SITE/i.test(s.title || ''));
  if (index < 0) return null;
  return (layout.viewports || []).filter(v => Number(v.sheet) === index + 1)
    .map(v => `${v.kind}:${v.levelId}`);
});

test('the dealt SITE PLAN sheet carries a view of the site', async ({ page }) => {
  await houseAndLot(page);
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(600);
  expect(await siteViewports(page), 'the SITE PLAN sheet was dealt empty')
    .toEqual(['plan:8']);
});

test('and RE-DEAL SHEETS keeps it, which is what he tried next', async ({ page }) => {
  await houseAndLot(page);
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.getByRole('button', { name: /RE-DEAL/i }).click();
  await page.waitForTimeout(800);
  expect(await siteViewports(page), 'a re-deal dropped the site view')
    .toEqual(['plan:8']);
});

// WHAT THE SITE PLAN DRAWS -- the lot line, the footprint and the eave -- is
// measured in proto/site-plan-harness.js against the painter's own strokes,
// which is both cheaper and stricter than counting dark pixels on a canvas
// that also carries a desk, a grid and two registration marks.
