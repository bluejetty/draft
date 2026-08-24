// The company standard layer list lives on STANDARDS.html: every CAD layer the
// commands assign, with an office-editable name and print rule, packaged as
// .draft.standards so the taxonomy can drive an AutoCAD/DXF export later.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const LINE_STROKE = [29, 31, 32]; // #1d1f20, committed generic line color

const ALL_LAYER_IDS = [
  'draft', 'no-draft', 'SHAPE',
  'A-WALL-EXT', 'A-WALL-INT', 'A-FL', 'A-FL-DECK', 'A-FL-FLOORING', 'A-DOOR', 'A-GLAZ', 'A-ROOF',
  'A-FL-OPNG', 'A-ROOF-OPNG', 'A-STR', 'A-STR-DECK', 'A-FIXT', 'A-CASE', 'A-ANNO-NOTE',
  'PLAN DIMENSION', 'ROOM-IDS-AREA',
  'S-BEAM', 'S-SLAB', 'FLOOR DIMENSION', 'S-FDN', 'S-COL-FOOTING', 'S-FOOTING', 'FOUNDATION DIMENSION',
  'E-POWER', 'E-POWER DIMENSION',
];

async function openStandards(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/STANDARDS.html');
  await expect(page.locator('#groups .group')).toHaveCount(6);
}

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function lineStrokeCount(page, x, z) {
  const p = await h.worldToClient(page, x, z);
  const pixels = await h.overlayPixels(page, p.x, p.y);
  return h.countColor(pixels, LINE_STROKE);
}

test('the standards page lists every command layer with its default print rule', async ({ page }) => {
  await openStandards(page);

  for (const layerId of ALL_LAYER_IDS) {
    await expect(page.locator(`[data-layer-name="${layerId}"]`)).toBeVisible();
  }
  // NO-DRAFT is the construction-only layer: everything prints except it.
  await expect(page.locator('[data-layer-print="no-draft"]')).not.toBeChecked();
  await expect(page.locator('[data-layer-print="draft"]')).toBeChecked();
  await expect(page.locator('[data-layer-print="A-WALL-EXT"]')).toBeChecked();
});

test('renaming a layer in the standards shows in the Model Space layer views', async ({ page }) => {
  await openStandards(page);
  await page.locator('[data-layer-name="A-WALL-EXT"]').fill('X-WALL-CUSTOM');
  await page.locator('[data-layer-name="A-WALL-EXT"]').blur();
  await expect(page.locator('#status')).toContainText('X-WALL-CUSTOM');

  await h.openModel(page);
  // Clicking a layer set reveals its layers, named after the standards.
  await page.locator('.level-row.active').getByRole('button', { name: 'PLAN', exact: true }).click();
  await expect(page.locator('.level-layer-content', { hasText: 'X-WALL-CUSTOM' }).first()).toBeVisible();
});

test('a layer whose standard says not printed is excluded from print output', async ({ page }) => {
  await openStandards(page);
  await page.locator('[data-layer-print="draft"]').uncheck();
  await expect(page.locator('#status')).toContainText('not printed');

  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);
  expect(await lineStrokeCount(page, 5, 0)).toBeGreaterThan(0);

  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(400);
  expect(await lineStrokeCount(page, 5, 0)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  // Print exclusion hides the line from output only; the geometry survives.
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
});

test('the Model Space picker places new lines on the chosen generic layer', async ({ page }) => {
  await h.openModel(page);
  // The DRAFT / NO-DRAFT picker lives in the Line tool's menu.
  await h.selectTool(page, 'Line');
  await page.getByRole('button', { name: 'NO-DRAFT', exact: true }).click();
  await drawLine(page, -10, 0, 10, 0);
  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(lines[0].layer).toBe('no-draft');

  await page.getByRole('button', { name: 'DRAFT', exact: true }).click();
  await drawLine(page, -10, 5, 10, 5);
  const after = h.allLines(await h.savedDrawing(page));
  expect(after).toHaveLength(2);
  expect(after.filter(line => line.layer === 'draft')).toHaveLength(1);
});

test('lines drawn in the ELECTRIC layer set save on E-POWER', async ({ page }) => {
  await h.openModel(page);
  await page.locator('.level-row.active').getByRole('button', { name: 'ELECTRIC', exact: true }).click();
  await page.waitForTimeout(400);

  // The picker offers E-POWER in place of DRAFT while working in ELECTRIC.
  await h.selectTool(page, 'Line');
  await expect(page.getByRole('button', { name: 'E-POWER', exact: true })).toBeVisible();

  await drawLine(page, -10, 0, 10, 0);
  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(lines[0].layer).toBe('E-POWER');
  expect(lines[0].view).toBe('e-power');
});

test('hiding a generic layer in the standards falls back to the other layer', async ({ page }) => {
  await openStandards(page);
  await page.locator('[data-layer-visible="draft"]').uncheck();
  await expect(page.locator('#status')).toContainText('hidden');

  await h.openModel(page);
  // With DRAFT hidden, the Line tool falls back to NO-DRAFT automatically.
  await drawLine(page, -10, 0, 10, 0);
  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(lines[0].layer).toBe('no-draft');
});

test('the layer section is gone from Settings, which links to the standards', async ({ page }) => {
  await page.goto('/SETTINGS.html');
  await expect(page.locator('.layer-settings')).toHaveCount(0);
  await expect(page.locator('a[href="./STANDARDS.html"]')).toBeVisible();
});
