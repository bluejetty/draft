const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

async function frameStats(page, n = 90, jiggle = false) {
  return page.evaluate(async ({ n, jiggle }) => {
    const canvas = document.querySelector('[data-model-canvas]');
    const box = canvas.getBoundingClientRect();
    const times = [];
    await new Promise(r => requestAnimationFrame(r));
    for (let i = 0; i < n; i++) {
      const t = performance.now();
      if (jiggle) canvas.dispatchEvent(new PointerEvent('mousemove', {
        bubbles: true, clientX: box.x + 80 + (i % 250), clientY: box.y + 80 + (i % 150), buttons: 0 }));
      await new Promise(r => requestAnimationFrame(r));
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    return { median: +times[Math.floor(n / 2)].toFixed(1), p95: +times[Math.floor(n * 0.95)].toFixed(1), max: +times[n - 1].toFixed(1) };
  }, { n, jiggle });
}

test('P3: elevation / section view frame cost after a real BUILD HOUSE', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-18, -12], [18, -12], [18, 12], [-18, 12], [-18, -12]]) await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  console.log('PLAN idle      :', JSON.stringify(await frameStats(page)));
  console.log('PLAN mousemove :', JSON.stringify(await frameStats(page, 90, true)));

  // Enter the E1 elevation the bone reveal would have jumped to.
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(1200);
  console.log('E1 idle        :', JSON.stringify(await frameStats(page)));
  console.log('E1 mousemove   :', JSON.stringify(await frameStats(page, 90, true)));
});

test('P4: cost of one edit (history snapshot + full serialize + IndexedDB write)', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-18, -12], [18, -12], [18, 12], [-18, 12], [-18, -12]]) await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const size = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket); return (await f.text()).length;
  }, h.STORAGE_BUCKET);

  const times = [];
  for (let i = 0; i < 8; i++) {
    await h.selectTool(page, 'Line');
    const t0 = Date.now();
    await h.clickWorld(page, -30 + i, -30);
    await h.clickWorld(page, -30 + i, -24);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    times.push(Date.now() - t0);
  }
  times.sort((a, b) => a - b);
  console.log('drawing bytes:', size, '| per-edit commit ms median:', times[4], 'max:', times[7]);
});
