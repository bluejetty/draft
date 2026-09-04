// The PROJECT page's build defaults and zones (boards #158/#187/#221): the
// live typical wall-section detail redraws as numbers change, ZONE HEIGHTS
// edit both ways (local elevation vs offset from MAIN FL) and persist, and
// the sidebar level cards keep showing the SAME values the page sets — one
// source of truth, no forked data.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The module's own constants, loaded the way proto/ loads it: from source,
// under a stub window. Asserting a derive against numbers typed into this
// file would only prove the two agree today.
const P = (() => {
  const saved = global.window;
  global.window = {};
  delete require.cache[require.resolve('../project-page.js')];
  require('../project-page.js');
  const api = global.window.DraftProjectPage;
  global.window = saved;
  return api;
})();

async function openProjectPage(page) {
  await page.locator('[data-project-open]').click();
  await page.waitForURL(/PROJECT\.html/);
  await expect(page.locator('[data-detail-input="pitch"]')).toBeVisible();
}

async function commitDetail(page, name, value) {
  const input = page.locator(`[data-detail-input="${name}"]`);
  await input.fill(value);
  await input.dispatchEvent('change');
}

test('a build-default edit redraws the detail — the anchors move with the parts', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  // MEASURE THE LABEL, NOT THE BOX. The numbers moved off the drawing into a
  // schedule beside it, so an input sits in a fixed row and cannot travel --
  // asserting on the box here would fail for the layout rather than for the
  // painter, and pinning it to zero travel would then pass with the redraw
  // removed entirely. What still rides the anchor is the grey part label, so
  // that is what this measures. Same claim as before: change a number and the
  // drawing re-anchors.
  const tagY = async name => (await page
    .locator(`.detail-tag`, { hasText: name }).first().boundingBox()).y;
  const fdnBefore = await tagY('FDN WALL HT');
  const footingBefore = await tagY('FTG DEPTH');

  // A much shorter foundation wall: its own anchor rides up its mid-height
  // and the footing below it climbs too. The detail is drawn small beside the
  // section table, so a few pixels of travel is the whole four feet.
  await commitDetail(page, 'fdnHeight', `4'-0"`);
  await expect(page.locator('#status')).toContainText('saved');

  expect(Math.abs(await tagY('FDN WALL HT') - fdnBefore)).toBeGreaterThan(2);
  expect(Math.abs(await tagY('FTG DEPTH') - footingBefore)).toBeGreaterThan(2);

  // Garbage never sticks: the box snaps back to the stored number.
  await commitDetail(page, 'pitch', 'steep');
  await expect(page.locator('[data-detail-input="pitch"]')).toHaveValue('4');
});

test('zone heights edit both ways against the elevation datum and persist', async ({ page }) => {
  await h.openModel(page);
  // The drafter's usual reference: MAIN FL reads 100'-0". A fresh model has
  // not saved a file yet, so build the envelope if needed.
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = file ? JSON.parse(await file.text())
      : { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }] };
    drawing.elevationDatum = 100;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], file?.name || 'model-drawing.json',
        { type: 'application/json' }), bucket);
  }, h.STORAGE_BUCKET);
  await page.goto('/PROJECT.html');

  // Offset first: -2'-0" off MAIN FL reads locally as 98'-0".
  const offset = page.locator('[data-zone-offset="attachedGarage"]');
  await offset.fill(`-2'-0"`);
  await offset.dispatchEvent('change');
  await expect(page.locator('[data-zone-local="attachedGarage"]')).toHaveValue(`98'-0"`);

  // Local the other way: 97'-6" works out to -2'-6" off MAIN FL.
  const local = page.locator('[data-zone-local="attachedGarage"]');
  await local.fill(`97'-6"`);
  await local.dispatchEvent('change');
  await expect(offset).toHaveValue(`-2'-6"`);

  const saved = await h.savedDrawing(page);
  expect(saved.zoneHeights.zones.attachedGarage.offsetFt).toBeCloseTo(-2.5, 5);
  expect(saved.zoneHeights.zones.bilevel.offsetFt).toBe(0);

  await page.reload();
  await expect(page.locator('[data-zone-offset="attachedGarage"]')).toHaveValue(`-2'-6"`);
  await expect(page.locator('[data-zone-local="attachedGarage"]')).toHaveValue(`97'-6"`);
});

test('grade derives from the attached garage beam and drives the detached garage until overridden', async ({ page }) => {
  await h.openModel(page);
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = file ? JSON.parse(await file.text())
      : { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }] };
    drawing.elevationDatum = 100;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], file?.name || 'model-drawing.json',
        { type: 'application/json' }), bucket);
  }, h.STORAGE_BUCKET);
  await page.goto('/PROJECT.html');

  // GRADE IS NO LONGER A NUMBER OF ITS OWN. It used to default to a flat
  // 1'-0" below the foundation top; an attached garage's beam has to sit 8"
  // above grade, so the garage decides where grade is and the house takes
  // it. The garage drops 2'-0" from the house's sill, its beam top is one
  // sill plate below its floor, grade is 1'-2" under that -- and the two
  // sill plates cancel, leaving 2'-0" + 1'-2" = 3'-2" below the foundation
  // top.
  //
  // 1'-2", not the 8" MINIMUM, and the two are different jobs. Movie: "if
  // the house is higher out of the ground it is easier to regrade afterwards
  // if there is space... move it to 1'-2" grade to top of concrete so they
  // have 6" to slope around the perimeter". 8" is the line a drafter cannot
  // type past; 1'-2" is where it is drawn; the 6" between them is the room
  // the site has to fall away from the building.
  //
  // Two assertions, deliberately. The first pins the ARITHMETIC against the
  // module's own constants, so moving either one fails here naming which.
  // The second pins what the box actually READS, because a derive that
  // computes correctly and renders wrong is still wrong. Asserting only the
  // second would pass with 2'-8" hardcoded anywhere in the chain.
  expect(-(P.GARAGE_SILL_BELOW_HOUSE_FT + P.GRADE_BELOW_CONCRETE_IN / 12))
    .toBeCloseTo(-2 - 14 / 12, 6);
  // And the drawn depth must stay clear of the minimum, or the default would
  // be a value the page itself refuses.
  expect(P.GRADE_BELOW_CONCRETE_IN).toBeGreaterThan(P.GRADE_MIN_BELOW_CONCRETE_IN);
  await expect(page.locator('[data-grade-offset]')).toHaveValue(`-3'-2"`);
  // Local reads off the datum: MAIN FL 100'-0", the foundation top one
  // main-floor assembly (11 7/8" + 3/4") below it, grade 3'-2" under that.
  await expect(page.locator('[data-grade-local]')).toHaveValue(`95'-9 3/8"`);
  // Detached garage derives until overridden: beam top 8" above grade. It
  // moved with grade -- which is the point: the attached garage sets grade,
  // and the detached one is measured off grade, so a chain runs from the
  // attached garage's floor all the way to the detached garage's beam.
  const detachedLocal = page.locator('[data-zone-local="detachedGarage"]');
  await expect(detachedLocal).toHaveValue(`96'-5 3/8"`);

  // Dropping grade a foot drops the derived garage the same foot.
  await page.locator('[data-grade-offset]').fill(`-2'-0"`);
  await page.locator('[data-grade-offset]').dispatchEvent('change');
  await expect(detachedLocal).toHaveValue(`97'-7 3/8"`);
  await expect(page.locator('[data-grade-local]')).toHaveValue(`96'-11 3/8"`);

  // An explicit garage height is an override — later grade edits leave it.
  await detachedLocal.fill(`96'-0"`);
  await detachedLocal.dispatchEvent('change');
  await expect(page.locator('[data-zone-offset="detachedGarage"]')).toHaveValue(`-4'-0"`);
  await page.locator('[data-grade-offset]').fill(`-1'-0"`);
  await page.locator('[data-grade-offset]').dispatchEvent('change');
  await expect(detachedLocal).toHaveValue(`96'-0"`);

  const saved = await h.savedDrawing(page);
  expect(saved.zoneHeights.gradeOffsetFt).toBeCloseTo(-1, 5);
  expect(saved.zoneHeights.zones.detachedGarage.offsetFt).toBeCloseTo(-4, 5);
});

test('a wall height set on the PROJECT page lands in the saved assembly', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  await commitDetail(page, 'wallHeight-3', `9'-2"`);
  await expect(page.locator('#status')).toContainText('saved');

  const saved = await h.savedDrawing(page);
  expect(saved.levelAssemblies['3'].wallHeightFt).toBeCloseTo((9 * 12 + 2) / 12, 5);
});
