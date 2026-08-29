// Measurements, not adjectives. Seeds a big-but-plausible drawing straight
// into the store, then times the frame loop and pointer path.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

function bigDrawing(wallCount) {
  const levels = [
    { id: 8, name: 'SITE', elev: 0, visible: true },
    { id: 7, name: 'ROOF', elev: 18, visible: true },
    { id: 5, name: '2ND FL', elev: 9, visible: true },
    { id: 3, name: 'MAIN FL', elev: 0, visible: true },
    { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
  ];
  const walls = [];
  let n = 1;
  const perLevel = Math.floor(wallCount / 3);
  [1, 3, 5].forEach(levelId => {
    for (let i = 0; i < perLevel; i++) {
      const x = -60 + (i % 20) * 6;
      const z = -40 + Math.floor(i / 20) * 6;
      walls.push({
        id: `wall-${n++}`, start: { x, y: 0, z }, end: { x: x + 5, y: 0, z },
        levelId, view: levelId === 1 ? 'foundation' : 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
      });
    }
  });
  return { version: 1, levels, walls, nextDrawingItemId: n, activeLevelIdx: 3 };
}

async function seed(page, drawing) {
  await page.evaluate(async ({ bucket, json }) => {
    const file = new File([json], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: h.STORAGE_BUCKET, json: JSON.stringify(drawing) });
}

// Frame cost with nothing changing: the rAF loop still runs _syncViewRails.
async function idleFrameCost(page, frames = 120) {
  return page.evaluate(async n => {
    const times = [];
    await new Promise(r => requestAnimationFrame(r));
    for (let i = 0; i < n; i++) {
      const t = performance.now();
      await new Promise(r => requestAnimationFrame(r));
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    return { median: times[Math.floor(n / 2)], p95: times[Math.floor(n * 0.95)], max: times[n - 1] };
  }, frames);
}

test('P1: idle frame cost, empty vs 300-wall drawing', async ({ page }) => {
  await h.openModel(page);
  const empty = await idleFrameCost(page);
  console.log('IDLE empty  :', JSON.stringify(empty));
  await seed(page, bigDrawing(300));
  await page.reload();
  await h.waitForModelReady(page);
  const big = await idleFrameCost(page);
  console.log('IDLE 300w   :', JSON.stringify(big));
  const drawing = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket); return JSON.parse(await f.text()).walls.length;
  }, h.STORAGE_BUCKET);
  console.log('walls in store:', drawing);
});

test('P2: mousemove latency over the plan (300 walls)', async ({ page }) => {
  await h.openModel(page);
  await seed(page, bigDrawing(300));
  await page.reload();
  await h.waitForModelReady(page);
  await h.selectTool(page, 'Wall');
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const stats = await page.evaluate(async b => {
    const canvas = document.querySelector('[data-model-canvas]');
    const times = [];
    for (let i = 0; i < 120; i++) {
      const t = performance.now();
      canvas.dispatchEvent(new PointerEvent('mousemove', {
        bubbles: true, clientX: b.x + 100 + (i % 300), clientY: b.y + 100 + (i % 200), buttons: 0,
      }));
      await new Promise(r => requestAnimationFrame(r));
      times.push(performance.now() - t);
    }
    times.sort((a, b2) => a - b2);
    return { median: times[60], p95: times[114], max: times[119] };
  }, box);
  console.log('MOUSEMOVE+frame 300w:', JSON.stringify(stats));
});
