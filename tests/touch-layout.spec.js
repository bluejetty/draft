// A finger works the sheet (audit C2).
//
// LAYOUT's canvas listened for mouse events only, so on the iPad this app is
// aimed at, a viewport could not be placed or dragged. It takes pointer events
// now, and this spec drives it from a real touchscreen — the browser's own
// touch pipeline, not synthetic events — so the pointer path is exercised the
// way a drafter's finger exercises it.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

test.use({ hasTouch: true });

const point = (x, z) => ({ x, y: 0, z });

// The same minimal saved drawing the mouse-driven viewport specs use: a
// 24' x 16' main floor, four walls.
function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id,
    start: point(sx, sz),
    end: point(ex, ez),
    levelId: 1,
    view: 'plan',
    wallType: 'stud_2x6',
    baseHeight: 0,
    topHeight: 8,
    refLine: 'left',
  });
  return {
    version: 1,
    levels: [{ id: 0, name: 'FOUNDATION', elev: -8 }, { id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [wall(1, 0, 0, 24, 0), wall(2, 24, 0, 24, 16), wall(3, 24, 16, 0, 16), wall(4, 0, 16, 0, 0)],
    fenestrations: [],
  };
}

async function openLayout(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: houseDrawing() });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return { box, zoom, panX: (box.width - PW * zoom) / 2, panY: (box.height - PH * zoom) / 2 };
}

async function sheetToClient(page, xIn, yIn) {
  const m = await sheetMetrics(page);
  return { x: m.box.x + m.panX + xIn * m.zoom, y: m.box.y + m.panY + yIn * m.zoom };
}

async function savedDrawing(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, BUCKET);
}

async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}

test('a finger places a viewport on the sheet and drags it', async ({ page }) => {
  await openLayout(page);

  await page.locator('[data-layout-add-viewport]').tap();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');

  const spot = await sheetToClient(page, 8, 5);
  await withLayoutSave(page, () => page.touchscreen.tap(spot.x, spot.y));

  let saved = await savedDrawing(page);
  expect(saved.layout.viewports, 'a tap placed the viewport').toHaveLength(1);
  expect(saved.layout.viewports[0].xIn).toBeCloseTo(8, 1);
  expect(saved.layout.viewports[0].yIn).toBeCloseTo(5, 1);

  // Now drag it with a finger — the half that needs the captured pointer.
  const to = await sheetToClient(page, 11, 6.5);
  const client = await page.context().newCDPSession(page);
  const touch = (type, pt) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: pt.x, y: pt.y, id: 1 }],
  });
  await withLayoutSave(page, async () => {
    await touch('touchStart', spot);
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', {
        x: spot.x + (to.x - spot.x) * (i / 6),
        y: spot.y + (to.y - spot.y) * (i / 6),
      });
    }
    await touch('touchEnd', to);
  });
  await client.detach();

  saved = await savedDrawing(page);
  expect(saved.layout.viewports).toHaveLength(1);
  expect(saved.layout.viewports[0].xIn, 'the finger moved it').toBeCloseTo(11, 1);
  expect(saved.layout.viewports[0].yIn).toBeCloseTo(6.5, 1);
});
