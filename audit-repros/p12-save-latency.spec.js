const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

function bigDrawing(wallCount) {
  const levels = [
    { id: 8, name: 'SITE', elev: 0, visible: true }, { id: 7, name: 'ROOF', elev: 18, visible: true },
    { id: 5, name: '2ND FL', elev: 9, visible: true }, { id: 3, name: 'MAIN FL', elev: 0, visible: true },
    { id: 1, name: 'FOUNDATION', elev: -10, visible: true }];
  const walls = []; let n = 1;
  [1, 3, 5].forEach(levelId => {
    for (let i = 0; i < Math.floor(wallCount / 3); i++) {
      const x = -60 + (i % 20) * 6, z = -40 + Math.floor(i / 20) * 6;
      walls.push({ id: `wall-${n++}`, start: { x, y: 0, z }, end: { x: x + 5, y: 0, z }, levelId,
        view: levelId === 1 ? 'foundation' : 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' });
    }
  });
  return { version: 1, levels, walls, nextDrawingItemId: n };
}

async function measure(page, label) {
  const bytes = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket); return f ? (await f.text()).length : 0;
  }, h.STORAGE_BUCKET);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -30, -30);
  const t0 = Date.now();
  await h.clickWorld(page, -30, -25);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.dataset.saveDirty === '0');
  const ms = Date.now() - t0;
  const unused = await page.evaluate(() => new Promise(resolve => {
    // Time the whole commit: history snapshot + serialize + IndexedDB write.
    const t0 = performance.now();
    const obs = new MutationObserver(() => {
      if (document.body.dataset.saveDirty === '0') { obs.disconnect(); resolve(Math.round(performance.now() - t0)); }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-save-dirty'] });
    document.querySelector('[data-model-canvas]').dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
    setTimeout(() => { obs.disconnect(); resolve(-1); }, 10);
  }));
  console.log(`${label}: drawing ${bytes} bytes, commit round trip ${ms} ms`);
}

test('P12: per-edit commit cost vs drawing size', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -20, -20); await h.clickWorld(page, -20, -15);
  await page.keyboard.press('Enter'); await h.waitForSaved(page);
  await measure(page, 'small drawing ');
  await page.evaluate(async ({ bucket, json }) => {
    await window.SharedFileStore.saveSharedFile(new File([json], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, json: JSON.stringify(bigDrawing(3000)) });
  await page.reload(); await h.waitForModelReady(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -20, -20); await h.clickWorld(page, -20, -15);
  await page.keyboard.press('Enter'); await h.waitForSaved(page);
  await measure(page, '3000-wall drawing');
});
