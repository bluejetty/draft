// Keyboard layout presets: picking a preset fills the editable bindings with
// the closest single-key match to that application, keys stay editable after,
// and the choice persists like any other keyboard setting.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function openSettings(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    localStorage.clear();
  });
  await page.goto('/SETTINGS.html');
  await expect(page.locator('#layout-row')).toBeVisible();
}

const activeKey = (page, command) => page.locator(`[data-command="${command}"]`);

test('every preset is offered and DRAFT native starts active', async ({ page }) => {
  await openSettings(page);

  for (const label of ['DRAFT native', 'AutoCAD style', 'Revit style', 'MicroStation style', 'ArchiCAD style']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'DRAFT native' })).toHaveClass(/active/);
});

test('AutoCAD preset fills the bindings and persists through a reload', async ({ page }) => {
  await openSettings(page);

  await page.getByRole('button', { name: 'AutoCAD style' }).click();
  await expect(activeKey(page, 'extend')).toHaveText('E');
  await expect(activeKey(page, 'fenestration')).toHaveText('I');
  await expect(activeKey(page, 'node')).toHaveText('A');
  await expect(activeKey(page, 'redo')).toHaveText('Ctrl+Y');
  // Unchanged commands keep their native keys.
  await expect(activeKey(page, 'line')).toHaveText('L');

  await page.reload();
  await expect(page.getByRole('button', { name: 'AutoCAD style' })).toHaveClass(/active/);
  await expect(activeKey(page, 'extend')).toHaveText('E');
});

test('a manual edit after a preset keeps the keys but drops the preset highlight', async ({ page }) => {
  await openSettings(page);

  await page.getByRole('button', { name: 'ArchiCAD style' }).click();
  await expect(activeKey(page, 'select')).toHaveText('A');

  await activeKey(page, 'wall').click();
  await activeKey(page, 'wall').press('j');
  await expect(activeKey(page, 'wall')).toHaveText('J');
  await expect(activeKey(page, 'select')).toHaveText('A');
  await expect(page.locator('.layout.active')).toHaveCount(0);
});

test('the model space honours a preset binding', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('button', { name: 'Revit style' }).click();
  await expect(activeKey(page, 'fenestration')).toHaveText('Shift+W');

  await page.goto('/MODEL.dc.html');
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  await expect(page.getByRole('button', { name: /Fenestration\s+Shift\+W/i })).toBeVisible();
  await page.keyboard.press('Shift+W');
  await expect(page.getByRole('button', { name: 'DOOR' })).toBeVisible();
});

test('the missing-command report is in the keyboard area', async ({ page }) => {
  await openSettings(page);

  const report = page.locator('.report');
  await report.locator('summary').click();
  await expect(report).toContainText('OFFSET');
  await expect(report).toContainText('MIRROR');
  await expect(report).toContainText('two-letter shortcuts');
});
