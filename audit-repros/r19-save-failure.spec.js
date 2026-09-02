// Checklist 1: what happens to a drawing when the write fails mid-save
// (quota exceeded, private browsing, iPad Safari eviction)?
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R19a: MODEL surfaces a failed write and keeps working', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -20, -20); await h.clickWorld(page, -20, -16);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const good = await h.savedDrawing(page);
  console.log('lines saved before the failure:', (good.lines || []).length);

  // Every write from here on fails, the way a full quota does.
  await page.evaluate(() => {
    window.__realSave = window.SharedFileStore.saveSharedFile;
    window.SharedFileStore.saveSharedFile = async () => {
      const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
    };
  });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -16, -20); await h.clickWorld(page, -16, -16);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('status pill  :', JSON.stringify((await page.locator('[data-model-status]').textContent().catch(() => '')).trim()));
  console.log('data-save-dirty:', await page.evaluate(() => document.body.dataset.saveDirty));
  const err = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /save failed/i.test(e.textContent || ''));
    return el ? el.textContent.trim() : null;
  });
  console.log('visible error text:', JSON.stringify(err));

  // Does the app keep working, and does a later successful write recover?
  await page.evaluate(() => { window.SharedFileStore.saveSharedFile = window.__realSave; });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -12, -20); await h.clickWorld(page, -12, -16);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  console.log('lines after recovery:', (after.lines || []).length, '(all three should be there)');
  expect((after.lines || []).length).toBe(3);
});

test('R19b: LAYOUT says nothing at all when its write fails', async ({ page, context }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-10, -8], [10, -8], [10, 8], [-10, 8]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  const layout = await context.newPage();
  await layout.goto('/LAYOUT.dc.html');
  await layout.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await layout.evaluate(() => {
    window.SharedFileStore.saveSharedFile = async () => { throw new Error('QuotaExceededError'); };
  });
  await layout.getByRole('button', { name: /ADD VIEWPORT/i }).click();
  const box = await layout.locator('canvas').first().boundingBox();
  await layout.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.45);
  await layout.waitForTimeout(1200);
  const anyError = await layout.evaluate(() =>
    [...document.querySelectorAll('*')].filter(e => e.children.length === 0
      && /fail|error|unsaved|not saved/i.test(e.textContent || '')).map(e => e.textContent.trim()));
  console.log('LAYOUT surfaced:', JSON.stringify(anyError));
  console.log('layoutSaveSeq  :', await layout.evaluate(() => document.body.dataset.layoutSaveSeq));
  await layout.reload();
  await layout.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const vp = await layout.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await f.text());
    return (d.layout?.viewports || []).length;
  }, h.STORAGE_BUCKET);
  console.log('viewports after the reload:', vp, '(the one just placed is gone)');
});
