// Checklist 5: every way to abandon the tour, and what each leaves behind.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

async function startTour(page) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}
const tourOf = async page => (await h.savedDrawing(page)).tour;
const msg = async page => ((await page.locator('[data-model-drawing-message]').textContent().catch(() => '')) || '').trim();

test('R18a: reload mid-tour', async ({ page }) => {
  await h.openModel(page);
  await startTour(page);
  console.log('tour after the outline closes:', JSON.stringify(await tourOf(page)));
  await page.reload();
  await h.waitForModelReady(page);
  console.log('tour after a reload        :', JSON.stringify(await tourOf(page)));
  console.log('popup visible after reload :', await page.locator('[data-tour-popup]').isVisible().catch(() => false));
  await h.selectTool(page, 'Outline');
  await page.locator('[data-build-house]').click();
  await page.waitForTimeout(900);
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  console.log('bone after the reload      :', JSON.stringify((await tourOf(page))),
    '| walls', (d.walls || []).length, '| stairs', (d.stairs || []).length, '| roofs', (d.roofs || []).length);
  console.log('message:', JSON.stringify((await msg(page)).slice(0, 110)));
});

test('R18b: Escape and a level switch mid-tour', async ({ page }) => {
  await h.openModel(page);
  await startTour(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log('tour after Escape          :', JSON.stringify(await tourOf(page)));
  await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: 'ROOF' }) })
    .locator('.level-name').click();
  await page.waitForTimeout(400);
  console.log('tour after switching to ROOF:', JSON.stringify(await tourOf(page)));
  console.log('popup visible               :', await page.locator('[data-tour-popup]').isVisible().catch(() => false));
  await h.selectTool(page, 'Outline');
  await page.locator('[data-build-house]').click();
  await page.waitForTimeout(900);
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  console.log('after the bone from ROOF    :', JSON.stringify(await tourOf(page)),
    '| walls', (d.walls || []).length, '| stairs', (d.stairs || []).length, '| roofs', (d.roofs || []).length);
});

test('R18c: leave to LAYOUT mid-tour and come back', async ({ page, context }) => {
  await h.openModel(page);
  await startTour(page);
  const before = await tourOf(page);
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.getByRole('button', { name: /8\.5 × 11/i }).click();
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0);
  await page.goto('/MODEL.dc.html');
  await h.waitForModelReady(page);
  const after = await tourOf(page);
  console.log('tour before leaving :', JSON.stringify(before));
  console.log('tour after coming back:', JSON.stringify(after));
  console.log('popup visible        :', await page.locator('[data-tour-popup]').isVisible().catch(() => false));
});
