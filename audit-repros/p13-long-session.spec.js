// Checklist 17: an hour of editing, compressed. Heap, history size and save
// latency over 120 committed edits.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('P13: long session growth', async ({ page }) => {
  test.setTimeout(600000);
  await h.openModel(page);
  const heap = async () => page.evaluate(() => performance.memory
    ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  const listeners = async () => page.evaluate(() => 'n/a');
  const rows = [];
  const t00 = Date.now();
  await h.selectTool(page, 'Line');
  for (let i = 0; i < 120; i++) {
    const x = -40 + (i % 20) * 2;
    const z = -40 + Math.floor(i / 20) * 3;
    const t0 = Date.now();
    await h.clickWorld(page, x, z);
    await h.clickWorld(page, x, z + 2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.body.dataset.saveDirty === '0');
    const ms = Date.now() - t0;
    if (i % 20 === 19) {
      const bytes = await page.evaluate(async bucket => {
        const f = await window.SharedFileStore.loadSharedFile(bucket); return (await f.text()).length;
      }, h.STORAGE_BUCKET);
      rows.push({ edit: i + 1, heapMB: await heap(), commitMs: ms, bytes });
    }
  }
  console.log('elapsed', Math.round((Date.now() - t00) / 1000), 's for 120 edits');
  rows.forEach(r => console.log(`  after ${String(r.edit).padStart(3)} edits: heap ${r.heapMB} MB, commit ${r.commitMs} ms, drawing ${r.bytes} bytes`));
  const after = await page.evaluate(() => new Promise(r => setTimeout(() => r(performance.memory
    ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null), 3000)));
  console.log('heap after a 3 s idle:', after, 'MB');
});
