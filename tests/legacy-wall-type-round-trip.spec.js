// RULING-substitution-is-not-a-save, 11 Sep — the old page's half.
//
// `LEGACY_WALL_TYPES` maps a retired 12" concrete foundation to `concrete_8`,
// "their closest current assembly", which is four inches thinner. Both pages
// apply that on load and both re-emit what they loaded, so a round trip
// rewrote a drafter's 12" foundation to 8" and saved it — on the old page
// without even a press, since it autosaves every edit.
//
// THE RULING: a substitution made to PAINT is not a fact about the drawing.
// The page may substitute in order to draw something — it has no 12" assembly
// and drawing nothing is worse than drawing 8" — but the file keeps
// `concrete_12`, and the drafter should be able to find out.
//
// WHY IT IS NOT MERELY UNTIDY: the mapping is lossy AND ONE-WAY. Nothing in a
// saved file records that a wall was ever 12". Thicker types are one table row
// from returning, but a drawing already round-tripped does not come back with
// them, so every save that persisted the substitute cost four inches of
// foundation that no later feature can restore.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const RETIRED = 'concrete_12';
const SUBSTITUTE = 'concrete_8';   // wall-types.js:19

// A drawing with one wall, then that wall retyped in the store to the retired
// assembly — which is what a file drawn before the type was retired looks
// like. It cannot be drawn through the UI: the type is gone from the picker,
// which is the whole reason it needs a substitute to paint at all.
async function retiredWallInStore(page) {
  await h.openModel(page, { webgl: false });
  // THE SAME URL, not a bare path. openModel boots the page with the flags the
  // suite runs under; re-opening at '/MODEL.dc.html' drops them and the reload
  // comes back a different page than the fixture built on.
  const booted = page.url();
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const id = await page.evaluate(async ({ bucket, retired }) => {
    const S = window.SharedFileStore;
    const file = await S.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    drawing.walls[0].wallType = retired;
    await S.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
    return drawing.walls[0].id;
  }, { bucket: 'model-drawing', retired: RETIRED });

  await page.goto(booted);
  await expect(page.locator('body')).toHaveAttribute('data-model-ready', '1', { timeout: 10000 });
  return id;
}

const storedWall = (saved, id) => saved.walls.find(wall => wall.id === id);

test('a round trip through the old page keeps the retired wall type', async ({ page }) => {
  const id = await retiredWallInStore(page);

  // AN EDIT ELSEWHERE, which is the whole point: the drafter did not touch
  // this wall, and on this page any edit at all writes the file.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -6, 6);
  await h.clickWorld(page, 6, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(storedWall(saved, id).wallType,
    'the file must still hold the retired type, not the assembly used to paint it')
    .toBe(RETIRED);
  // AND THE SUBSTITUTE MUST NOT BE THERE UNDER ANOTHER NAME. The fix keeps the
  // original in memory only; a format that grew a field would be a different
  // change needing a census and a persisted-format entry.
  expect(storedWall(saved, id).legacyWallType,
    'the kept original is a paint-time fact and must not reach the file')
    .toBeUndefined();
});

test('the page says a retired assembly was substituted, and not as an error', async ({ page }) => {
  await retiredWallInStore(page);

  // IN THE VOICE THE LOAD REPORT ALREADY SPEAKS, beside "incomplete" and
  // "belonged to a level that is no longer in the drawing". The drafter is
  // told what this app could not do rather than being left to assume it drew
  // what the file says.
  const message = page.locator('[data-model-drawing-message]');
  await expect(message).toContainText('retired assembly this app no longer draws');
  await expect(message).toContainText('the file keeps the original');
  // NOT AN ERROR. `skipped` means something is wrong with the FILE; this means
  // something is missing from THIS APP, and the file is intact. A substitution
  // that flipped the error styling would teach drafters to distrust files that
  // are perfectly good.
  await expect(message).not.toContainText('could not be loaded');
});
