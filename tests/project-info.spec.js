// PROJECT tab: the top-bar button opens a dialog whose fields (name, client,
// site address, legal land description) save inside the drawing file, survive
// a reload, and reset with NEW — the site plan's LEGAL LAND DESCRIPTION block
// reads from here.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function openProjectDialog(page) {
  await page.locator('[data-project-open]').click();
  await expect(page.locator('[data-project-dialog]')).toBeVisible();
}

test.describe('PROJECT tab', () => {
  test('the PROJECT button opens the dialog and Escape closes it', async ({ page }) => {
    await h.openModel(page);
    await openProjectDialog(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-project-dialog]')).toHaveCount(0);
  });

  test('project information saves with the drawing and survives a reload', async ({ page }) => {
    await h.openModel(page);
    await openProjectDialog(page);

    await page.locator('[data-project-name]').fill('MAPLE CREST RESIDENCE');
    await page.locator('[data-project-client]').fill('J. + K. THOMPSON');
    await page.locator('[data-project-address]').fill('412 MAPLE CREST BAY');
    await page.locator('[data-project-legal]').fill('LOT 12, BLOCK 4, PLAN 5566 MLTO');
    await page.locator('[data-project-dialog] button', { hasText: 'DONE' }).click();
    await h.waitForSaved(page);

    const saved = await h.savedDrawing(page);
    expect(saved.projectInfo).toEqual({
      name: 'MAPLE CREST RESIDENCE',
      client: 'J. + K. THOMPSON',
      address: '412 MAPLE CREST BAY',
      legal: 'LOT 12, BLOCK 4, PLAN 5566 MLTO',
    });

    await page.reload();
    await h.waitForModelReady(page);
    await openProjectDialog(page);
    await expect(page.locator('[data-project-name]')).toHaveValue('MAPLE CREST RESIDENCE');
    await expect(page.locator('[data-project-legal]')).toHaveValue('LOT 12, BLOCK 4, PLAN 5566 MLTO');
  });

  test('tool shortcuts stay quiet while the dialog is open', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Line');
    await openProjectDialog(page);
    // W would switch to the WALL tool if the dialog let it through.
    await page.keyboard.press('w');
    await page.locator('[data-project-name]').press('w');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const labels = await h.activeToolLabels(page);
    expect(labels.some(l => /\bLINE\b/i.test(l))).toBe(true);
    expect(labels.some(l => /\bWALL\b/i.test(l))).toBe(false);
  });

  test('NEW clears the project information with the drawing', async ({ page }) => {
    await h.openModel(page);
    await openProjectDialog(page);
    await page.locator('[data-project-name]').fill('OLD PROJECT');
    await page.locator('[data-project-dialog] button', { hasText: 'DONE' }).click();
    await h.waitForSaved(page);

    await page.getByRole('button', { name: 'NEW', exact: true }).click();
    // Typing project info marks the file dirty, so NEW asks to save first.
    await page.getByRole('button', { name: "DON'T SAVE" }).click();
    await expect(page.locator('[data-model-drawing-message]')).toContainText('New drawing started');
    await h.waitForSaved(page);

    await openProjectDialog(page);
    await expect(page.locator('[data-project-name]')).toHaveValue('');
  });
});
