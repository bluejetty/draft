// The sheet gets a history too (audit C4, slice 3).
//
// LAYOUT had none at all — zero matches for undo or history on the page —
// and it is the one page in the app driven entirely by pointer: a viewport
// dragged off the edge, a titleblock swapped by mistake, a delete, all of it
// permanent with no keyboard path to fall back on.
//
// Every sheet mutation already funnels through _persistLayout, so that is
// where the snapshot is taken, and the two controls sit on the status bar in
// the same shape the Model Space's strip carries.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const undo = page => page.locator('[data-undo]');
const redo = page => page.locator('[data-redo]');

// A drawing with a house on MAIN FL, so the sheet has something to frame.
async function buildAndOpenLayout(page) {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

const storedLayout = async page => (await h.savedDrawing(page)).layout;

async function waitForSheetSave(page, run) {
  const before = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await run();
  await page.waitForFunction(
    seq => Number(document.body.dataset.layoutSaveSeq || 0) > seq, before);
}

test('the status bar carries UNDO and REDO, and they take a sheet change back', async ({ page }) => {
  await buildAndOpenLayout(page);
  await expect(undo(page)).toBeVisible();
  await expect(redo(page)).toBeVisible();
  // Nothing has changed yet, so there is nothing to take back.
  await expect(undo(page)).toBeDisabled();
  await expect(redo(page)).toBeDisabled();

  await waitForSheetSave(page, () => page.getByRole('button', { name: /8\.5 × 11/i }).click());
  expect((await storedLayout(page)).paperKey).toBe('8.5x11');
  await expect(undo(page), 'a sheet change lights UNDO').toBeEnabled();

  await waitForSheetSave(page, () => undo(page).click());
  expect((await storedLayout(page)).paperKey, 'the paper went back').toBe('11x17');
  await expect(redo(page), 'and REDO lit').toBeEnabled();

  await waitForSheetSave(page, () => redo(page).click());
  expect((await storedLayout(page)).paperKey).toBe('8.5x11');
});

test('a placed viewport can be taken back, and put back again', async ({ page }) => {
  await buildAndOpenLayout(page);
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();

  await waitForSheetSave(page, async () => {
    await page.getByRole('button', { name: /ADD VIEWPORT/i }).click();
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.45);
  });
  expect((await storedLayout(page)).viewports, 'the viewport landed').toHaveLength(1);

  await waitForSheetSave(page, () => undo(page).click());
  expect((await storedLayout(page)).viewports, 'and came back off the sheet').toHaveLength(0);

  await waitForSheetSave(page, () => redo(page).click());
  const back = (await storedLayout(page)).viewports;
  expect(back, 'redo put it back').toHaveLength(1);
  expect(back[0].pif, 'at the scale it was placed with').toBeCloseTo(1 / 4, 5);
});

test('the sheet history writes only the layout key — the drawing rides through', async ({ page }) => {
  await buildAndOpenLayout(page);
  const before = await h.savedDrawing(page);
  expect(before.walls.length, 'the house is on the drawing').toBeGreaterThan(0);

  await waitForSheetSave(page, () => page.getByRole('button', { name: /PORT/i }).first().click());
  await waitForSheetSave(page, () => undo(page).click());

  const after = await h.savedDrawing(page);
  expect(after.walls.length, 'an undo on the sheet leaves the walls alone').toBe(before.walls.length);
  expect(after.roofs.length).toBe(before.roofs.length);
  expect(after.layout.orientation, 'and the sheet really went back').toBe(before.layout?.orientation ?? 'landscape');
});

test('a new sheet change closes the redo branch', async ({ page }) => {
  await buildAndOpenLayout(page);
  await waitForSheetSave(page, () => page.getByRole('button', { name: /8\.5 × 11/i }).click());
  await waitForSheetSave(page, () => undo(page).click());
  await expect(redo(page)).toBeEnabled();

  await waitForSheetSave(page, () => page.getByRole('button', { name: /PORT/i }).first().click());
  await expect(redo(page), 'the branch the undo opened is closed by new work').toBeDisabled();
});

test('a fingertip can hit them', async ({ page }) => {
  await buildAndOpenLayout(page);
  for (const control of [undo(page), redo(page)]) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(28);
  }
});
