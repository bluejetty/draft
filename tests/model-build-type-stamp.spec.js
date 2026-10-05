// THE BUILD TELLS THE FILE WHAT IT IS, whichever drawing it lands in.
//
// Movie, 4 Oct, on a MOD BILEVEL: "the main roof of the modified bilevel
// isn't supposed to go up high", "the GARAGE wall should only go to the
// underside of the 2nd floor over the garage" and "the sill plates don't
// look lined up still". The file had no buildType, so every elevation
// stacked it as a plain 2 STOREY. The tile stamped the drawing open when it
// was pressed; NEW then swapped that drawing for a blank, and the bone built
// the house into a file that had never been told its type.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

test('a type picked before NEW still reaches the file the bone builds into', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, empty());
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bilevel"]').click();
  await page.locator('#dt-tiles [data-build-entry="modifiedBilevel"]').click();
  await page.keyboard.press('Escape');

  // The tile stamped THIS drawing, so it is dirty and NEW asks first.
  await page.locator('[data-file-new]').click();
  await page.locator('[data-guard-discard]').click();
  await expect(page.locator('#save')).toHaveText(/UNSAVED/);

  // The choice outlived the drawing: the foot bone offers to build it.
  await page.locator('#bone').click();
  await page.locator('[data-build-choice-build]').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.walls.length, 'the bone built nothing').toBeGreaterThan(0);
  expect(d.buildType, 'the house rose into a file that does not know its type')
    .toBe('modifiedBilevel');
});
