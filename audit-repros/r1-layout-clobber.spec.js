const { test, expect } = require('@playwright/test');
const { openModel, clickWorld, selectTool, waitForSaved, savedDrawing, climbTourToMain } = require('../tests/helpers.js');

test('R1: LAYOUT writes a stale whole-drawing snapshot back over MODEL edits', async ({ page, context }) => {
  await openModel(page);
  // Build a house so there is real work to lose.
  await selectTool(page, 'outline');
  for (const [x, z] of [[-10, -8], [10, -8], [10, 8], [-10, 8], [-10, -8]]) await clickWorld(page, x, z);
  await climbTourToMain(page);
  await page.locator('[data-build-house]').click().catch(() => {});
  await waitForSaved(page);
  const before = await savedDrawing(page);
  const wallsBefore = (before.walls || []).length;
  expect(wallsBefore).toBeGreaterThan(0);

  // A second tab on LAYOUT — it snapshots the drawing as it is now.
  const linesAtLayoutOpen = (before.lines || []).length;
  const layout = await context.newPage();
  await layout.goto('/LAYOUT.dc.html');
  await layout.waitForFunction(() => document.body.dataset.layoutReady === '1');

  // Back in MODEL: draw more walls. These autosave.
  await page.bringToFront();
  await selectTool(page, 'Line');
  await clickWorld(page, -20, -20);
  await clickWorld(page, -20, 20);
  await page.keyboard.press('Enter');
  await waitForSaved(page);
  const mid = await savedDrawing(page);
  const linesAfterEdit = (mid.lines || []).length;
  console.log('lines at layout open:', linesAtLayoutOpen, 'after MODEL edit:', linesAfterEdit);
  expect(linesAfterEdit, 'the MODEL edit really added a line').toBeGreaterThan(linesAtLayoutOpen);

  // Now touch the LAYOUT sheet (any sheet change persists it).
  await layout.bringToFront();
  await layout.getByRole('button', { name: /8\.5 × 11/i }).click();
  await layout.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0);
  await layout.waitForTimeout(500);

  const after = await savedDrawing(page);
  console.log('lines before layout write:', linesAfterEdit, ' after:', (after.lines || []).length);
  expect((after.lines || []).length, 'MODEL lines survive a LAYOUT sheet change').toBe(linesAfterEdit);
});
