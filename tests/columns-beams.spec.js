// Columns and beams are manual structural supports placed in either order —
// columns centre onto a beam line and beam ends snap to columns. Each beam is
// FLUSH or DROPPED; dropped beams bearing on a foundation wall mark a BEAM
// POCKET on the foundation plan.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function useFloorContext(page, level = 'MAIN FL') {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: 'FLOOR' }).click();
}

test('beam first: a column placed near the beam centres onto its line', async ({ page }) => {
  await h.openModel(page);
  await useFloorContext(page);

  await h.selectTool(page, 'Beam');
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await h.waitForSaved(page);

  await h.selectTool(page, 'Column');
  await h.clickWorld(page, 0, 0.5);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.beams).toHaveLength(1);
  expect(saved.beams[0].mode).toBe('flush');
  expect(saved.beams[0].view).toBe('floor');
  expect(saved.beams[0].levelId).toBe(3);
  expect(saved.beams[0].layer).toBe('S-BEAM');
  expect(saved.columns).toHaveLength(1);
  expect(saved.columns[0].layer).toBe('S-COL-FOOTING');
  expect(saved.columns[0].footing).toBe('pad36');
  // Centred onto the beam line (z pulled from 0.5 to 0).
  expect(h.near(saved.columns[0].point.x, 0)).toBe(true);
  expect(Math.abs(saved.columns[0].point.z)).toBeLessThan(0.01);

  // Everything survives a reload.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  const reloaded = await h.savedDrawing(page);
  expect(reloaded.beams).toHaveLength(1);
  expect(reloaded.columns).toHaveLength(1);
});

test('columns first: a DROPPED beam snaps its ends onto the columns', async ({ page }) => {
  await h.openModel(page);
  await useFloorContext(page);

  await h.selectTool(page, 'Column');
  await h.clickWorld(page, -5, 2);
  await h.clickWorld(page, 5, 2);
  await h.waitForSaved(page);

  await h.selectTool(page, 'Beam');
  await page.getByRole('button', { name: 'DROPPED' }).click();
  await h.clickWorld(page, -5, 2.4);
  await h.clickWorld(page, 5, 1.6);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(2);
  expect(saved.beams).toHaveLength(1);
  expect(saved.beams[0].mode).toBe('dropped');
  // Beam ends landed exactly on the column centres.
  const centres = saved.columns.map(column => column.point)
    .sort((a, b) => a.x - b.x);
  expect(Math.abs(saved.beams[0].start.x - centres[0].x)).toBeLessThan(0.001);
  expect(Math.abs(saved.beams[0].start.z - centres[0].z)).toBeLessThan(0.001);
  expect(Math.abs(saved.beams[0].end.x - centres[1].x)).toBeLessThan(0.001);
  expect(Math.abs(saved.beams[0].end.z - centres[1].z)).toBeLessThan(0.001);
});

test('PLAN places and shows structure in the level\'s home set', async ({ page }) => {
  await h.openModel(page);

  // A floor level's PLAN saves structure home to FLOOR.
  await levelRow(page, 'MAIN FL').locator('.level-body').click();
  await levelRow(page, 'MAIN FL').locator('.level-layer', { hasText: 'PLAN' }).first().click();
  await h.selectTool(page, 'Beam');
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await h.waitForSaved(page);
  await h.selectTool(page, 'Column');
  await h.clickWorld(page, 0, 0.5);
  await h.waitForSaved(page);

  // The foundation level's PLAN saves home to FOUNDATION.
  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'PLAN' }).first().click();
  await h.selectTool(page, 'Column');
  await h.clickWorld(page, -8, -6);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.beams).toHaveLength(1);
  expect(saved.beams[0].view).toBe('floor');
  expect(saved.beams[0].levelId).toBe(3);
  expect(saved.columns).toHaveLength(2);
  const floorColumn = saved.columns.find(column => column.levelId === 3);
  const fdnColumn = saved.columns.find(column => column.levelId === 1);
  expect(floorColumn.view).toBe('floor');
  expect(fdnColumn.view).toBe('foundation');

  // The beam renders full strength on the MAIN FL PLAN it was placed from.
  await levelRow(page, 'MAIN FL').locator('.level-body').click();
  await levelRow(page, 'MAIN FL').locator('.level-layer', { hasText: 'PLAN' }).first().click();
  await page.waitForTimeout(400);
  const at = await h.worldToClient(page, -3, 0);
  const pixels = await h.overlayPixels(page, at.x, at.y, 10);
  expect(h.countColor(pixels, [122, 74, 33])).toBeGreaterThan(0);
});

test('a dropped beam bearing on foundation walls marks BEAM POCKETs', async ({ page }) => {
  await h.openModel(page);

  // Concrete foundation walls on each side of the span.
  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'FOUNDATION' }).click();
  await h.selectTool(page, 'Wall');
  await page.getByRole('button', { name: '8" Concrete' }).click();
  await h.clickWorld(page, -6, -4);
  await h.clickWorld(page, -6, 4);
  await page.keyboard.press('Enter');
  await h.clickWorld(page, 6, -4);
  await h.clickWorld(page, 6, 4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Beam');
  await page.getByRole('button', { name: 'DROPPED' }).click();
  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.beams).toHaveLength(1);
  expect(saved.beams[0].mode).toBe('dropped');
  expect(saved.beams[0].view).toBe('foundation');

  // The pocket notation renders at the bearing point on the foundation plan.
  const at = await h.worldToClient(page, -6, 0);
  const pixels = await h.overlayPixels(page, at.x, at.y, 14);
  expect(h.countColor(pixels, [176, 64, 80])).toBeGreaterThan(0);
});
