const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('P6: VIEWPORT SCALE after placement', async ({ page, context }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-18, -12], [18, -12], [18, 12], [-18, 12], [-18, -12]]) await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  const layout = await context.newPage();
  await layout.goto('/LAYOUT.dc.html');
  await layout.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await layout.getByRole('button', { name: /ADD VIEWPORT/i }).click();
  const box = await layout.locator('canvas').first().boundingBox();
  await layout.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.45);
  await layout.waitForTimeout(500);
  const read = async () => layout.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await f.text());
    return { pifs: (d.layout?.viewports || []).map(v => v.pif), footer: document.body.innerText.match(/\d+\/?\d*" = 1'-0"/g)?.slice(-1)[0] };
  }, h.STORAGE_BUCKET);
  console.log('after placing at 1/4:', JSON.stringify(await read()));
  await layout.getByRole('button', { name: /1\/8" = 1'-0"/ }).click();
  await layout.waitForTimeout(600);
  console.log('after clicking 1/8 :', JSON.stringify(await read()));
  const footer = await layout.locator('text=/= 1\'-0"/').last().textContent();
  console.log('sheet footer says:', JSON.stringify(footer.trim()));
});
