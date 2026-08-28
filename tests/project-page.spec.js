// The PROJECT page's build defaults and zones (boards #158/#187/#221): the
// live typical wall-section detail redraws as numbers change, ZONE HEIGHTS
// edit both ways (local elevation vs offset from MAIN FL) and persist, and
// the sidebar level cards keep showing the SAME values the page sets — one
// source of truth, no forked data.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

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

  const fdnBefore = await page.locator('[data-detail-input="fdnHeight"]').boundingBox();
  const footingBefore = await page.locator('[data-detail-input="footingDepth"]').boundingBox();

  // A much shorter foundation wall: its own anchor rides up its mid-height
  // and the footing below it climbs too.
  await commitDetail(page, 'fdnHeight', `4'-0"`);
  await expect(page.locator('#status')).toContainText('saved');

  const fdnAfter = await page.locator('[data-detail-input="fdnHeight"]').boundingBox();
  const footingAfter = await page.locator('[data-detail-input="footingDepth"]').boundingBox();
  expect(Math.abs(fdnAfter.y - fdnBefore.y)).toBeGreaterThan(4);
  expect(Math.abs(footingAfter.y - footingBefore.y)).toBeGreaterThan(4);

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

test('grade defaults a foot below foundation top and drives the detached garage until overridden', async ({ page }) => {
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

  // Default: grade 1'-0" below the top of the foundation wall, which sits
  // one main-floor assembly (11 7/8" + 3/4") under MAIN FL's 100'-0".
  await expect(page.locator('[data-grade-offset]')).toHaveValue(`-1'-0"`);
  await expect(page.locator('[data-grade-local]')).toHaveValue(`97'-11 3/8"`);
  // Detached garage derives until overridden: beam top 8" above grade.
  const detachedLocal = page.locator('[data-zone-local="detachedGarage"]');
  await expect(detachedLocal).toHaveValue(`98'-7 3/8"`);

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

test('the level cards show the same values the PROJECT page sets', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  await commitDetail(page, 'wallHeight-3', `9'-2"`);
  await expect(page.locator('#status')).toContainText('saved');

  const saved = await h.savedDrawing(page);
  expect(saved.levelAssemblies['3'].wallHeightFt).toBeCloseTo((9 * 12 + 2) / 12, 5);

  await page.goto('/MODEL.dc.html');
  await h.waitForModelReady(page);
  const mainRow = page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: 'MAIN FL' }) });
  await expect(mainRow.locator('.level-assembly-summary').first()).toHaveText(`9'-2"`);
});
