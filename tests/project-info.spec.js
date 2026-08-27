// PROJECT identity (boards #158/#181): the top-bar button navigates to the
// full PROJECT page, whose identity fields save inside the drawing file,
// survive a reload, and reset with NEW. The stored keys predate the labels —
// OWNER lives in `client`, CIVIC ADDRESS in `address` — so the titleblock and
// site plan keep reading them and old drawings open with their values in the
// right boxes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function openProjectPage(page) {
  await page.locator('[data-project-open]').click();
  await page.waitForURL(/PROJECT\.html/);
  await expect(page.locator('[data-project-name]')).toBeVisible();
}

async function setField(page, selector, value) {
  await page.locator(selector).fill(value);
  await page.locator(selector).dispatchEvent('change');
}

test.describe('PROJECT page', () => {
  test('the PROJECT button navigates to the project page and back', async ({ page }) => {
    await h.openModel(page);
    await openProjectPage(page);
    await page.locator('.back').click();
    await page.waitForURL(/MODEL\.dc\.html/);
    await h.waitForModelReady(page);
  });

  test('project information saves with the drawing and survives a reload', async ({ page }) => {
    await h.openModel(page);
    await openProjectPage(page);

    await setField(page, '[data-project-name]', 'MAPLE CREST RESIDENCE');
    await setField(page, '[data-project-owner]', 'J. + K. THOMPSON');
    await setField(page, '[data-project-contractor]', 'DZ HOMES LTD.');
    await setField(page, '[data-project-civic]', '412 MAPLE CREST BAY');
    await setField(page, '[data-legal-block]', '4');
    await setField(page, '[data-legal-lot]', '12');
    await setField(page, '[data-legal-plan]', '5566 MLTO');
    await setField(page, '[data-project-legal]', 'REM OF THE NW QUARTER');
    await expect(page.locator('#status')).toContainText('saved');

    const saved = await h.savedDrawing(page);
    expect(saved.projectInfo).toMatchObject({
      name: 'MAPLE CREST RESIDENCE',
      client: 'J. + K. THOMPSON',       // the OWNER box
      contractor: 'DZ HOMES LTD.',
      address: '412 MAPLE CREST BAY',   // the CIVIC ADDRESS box
      legalBlock: '4',
      legalLot: '12',
      legalPlan: '5566 MLTO',
      legal: 'REM OF THE NW QUARTER',
    });

    await page.reload();
    await expect(page.locator('[data-project-name]')).toHaveValue('MAPLE CREST RESIDENCE');
    await expect(page.locator('[data-project-owner]')).toHaveValue('J. + K. THOMPSON');
    await expect(page.locator('[data-legal-lot]')).toHaveValue('12');
  });

  test('an older drawing opens with client and address in the renamed boxes', async ({ page }) => {
    await h.openModel(page);
    // Write the pre-page projectInfo shape straight into the stored file —
    // a fresh model has not saved one yet, so build the envelope if needed.
    await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const drawing = file ? JSON.parse(await file.text())
        : { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }] };
      drawing.projectInfo = {
        name: 'OLD SAVE', client: 'EARLY CLIENT',
        address: '9 FIRST STREET', legal: 'LOT 1, BLOCK 1',
      };
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(drawing)], file?.name || 'model-drawing.json',
          { type: 'application/json' }), bucket);
    }, h.STORAGE_BUCKET);

    await page.goto('/PROJECT.html');
    await expect(page.locator('[data-project-owner]')).toHaveValue('EARLY CLIENT');
    await expect(page.locator('[data-project-civic]')).toHaveValue('9 FIRST STREET');
    await expect(page.locator('[data-project-legal]')).toHaveValue('LOT 1, BLOCK 1');
    await expect(page.locator('[data-project-contractor]')).toHaveValue('');
  });

  test('NEW clears the project information with the drawing', async ({ page }) => {
    await h.openModel(page);
    await openProjectPage(page);
    await setField(page, '[data-project-name]', 'OLD PROJECT');
    await expect(page.locator('#status')).toContainText('saved');

    await page.goto('/MODEL.dc.html');
    await h.waitForModelReady(page);
    await page.getByRole('button', { name: 'NEW', exact: true }).click();
    // The page saved straight to the file, so the model opens clean and NEW
    // needs no save prompt — but absorb one if an unrelated edit left one.
    const dontSave = page.getByRole('button', { name: "DON'T SAVE" });
    if (await dontSave.isVisible().catch(() => false)) await dontSave.click();
    await expect(page.locator('[data-model-drawing-message]')).toContainText('New drawing started');
    await h.waitForSaved(page);

    await page.goto('/PROJECT.html');
    await expect(page.locator('[data-project-name]')).toHaveValue('');
  });
});
