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
  // A SECOND WALL THAT IS NOT RETIRED, and it is not scenery. With one wall in
  // the drawing, "1 wall uses a retired assembly" is true whether the page
  // substituted for that one wall or for every wall it loaded — measured, not
  // supposed: a mutant that marked EVERY wall substituted passed the whole file
  // until this wall existed.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -6, 4);
  await h.clickWorld(page, 6, 4);
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
  // THE RAIL CLOSES ON A RELOAD. openModel opens it on the way in; a second
  // navigation comes back with the tools folded into their tab, and the first
  // case spent two full timeouts reaching for a Line button that was behind it.
  await h.openRails(page);
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
  await expect(message).toContainText('1 wall uses a retired assembly this app no longer draws');
  // ONE, not both. The drawing holds two walls and only one of them is retired.
  await expect(message).not.toContainText('2 walls use');
  await expect(message).toContainText('the file keeps the original');
  // NOT AN ERROR. `skipped` means something is wrong with the FILE; this means
  // something is missing from THIS APP, and the file is intact. A substitution
  // that flipped the error styling would teach drafters to distrust files that
  // are perfectly good.
  await expect(message).not.toContainText('could not be loaded');
});

// ── the drafter's own change ends the substitution ───────────────────────────
//
// THE FAILURE THE FIX ITSELF CREATES. Keeping the original past a deliberate
// retype would re-emit `concrete_12` for a wall somebody had just set to
// something else — "never persist the substitute" turned into "never persist
// the drafter's change", which is worse than the defect being fixed because it
// overrides an intention rather than a gap.
//
// AND THE CASE THAT DISCRIMINATES BETWEEN TWO DESIGNS. A guard that re-emitted
// the original "while the wall still carries the substituted type" passes a
// retype to ICF and FAILS this one: `concrete_8` IS the substituted type, so a
// drafter choosing it deliberately looks identical to a drafter who chose
// nothing. Clearing the kept original at the point of the change is what tells
// those two apart, and this is the only case that can see the difference.
//
// The wall-type control is group-scoped, so this is also the repo's first spec
// to drive ASSEMBLY.
test('a wall retyped to the substitute\'s own type keeps the drafter\'s choice',
  async ({ page }) => {
    const id = await retiredWallInStore(page);

    await h.selectTool(page, 'Select');
    await h.clickWorld(page, 0, 0);
    await page.waitForTimeout(150);

    await page.getByRole('button', { name: /ASSEMBLY/ }).first().click();
    await expect(page.locator('[data-group-dialog]')).toBeVisible({ timeout: 4000 });
    await page.getByRole('button', { name: 'NOT FIXED' }).click();
    await page.waitForTimeout(200);

    // The drafter picks the 8" assembly ON PURPOSE — the same id the page had
    // been substituting silently.
    await page.getByRole('button', { name: '8" Concrete', exact: true }).first().click();
    await h.waitForSaved(page);

    const saved = await h.savedDrawing(page);
    const wall = saved.walls.find(item => item.id === id);
    expect(wall.wallType, 'the drafter chose 8" — the file must say 8"').toBe(SUBSTITUTE);
  });
