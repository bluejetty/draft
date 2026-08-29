// LAYOUT plan viewports (board #168): a real plan projected onto the sheet at
// an architectural scale — placed with a click, dragged in paper inches, and
// persisted additively on the shared drawing. The specs seed the same
// IndexedDB bucket the Model Space saves to, then work the sheet as a drafter
// does: arm + Add Viewport, click the paper, drag the frame around.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';

// Landscape 11x17 sheet dimensions in paper inches, and the canvas margin the
// fit uses — the specs recompute the sheet transform from these.
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

// A saved drawing the way MODEL writes it: a 24' x 16' four-wall main floor
// with one door, plus an empty foundation level.
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
    levels: [
      { id: 0, name: 'FOUNDATION', elev: -8 },
      { id: 1, name: 'MAIN FL', elev: 0 },
    ],
    walls: [
      wall(1, 0, 0, 24, 0),
      wall(2, 24, 0, 24, 16),
      wall(3, 24, 16, 0, 16),
      wall(4, 0, 16, 0, 0),
    ],
    fenestrations: [
      { id: 1, levelId: 1, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
  };
}

async function openLayout(page, drawing = null) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  if (drawing) {
    await page.evaluate(async ({ bucket, saved }) => {
      const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
      await window.SharedFileStore.saveSharedFile(file, bucket);
    }, { bucket: BUCKET, saved: drawing });
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  }
  return page.locator('[data-layout-canvas]');
}

async function savedDrawing(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, BUCKET);
}

// The layout page stamps data-layout-save-seq up once each persisted write
// lands; actions that save are wrapped so the read-back never races the write.
async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev,
    seq,
  );
}

// The sheet transform the page computes in _fitPaper, rebuilt from the canvas
// box: zoom (pixels per paper inch) and the paper's top-left corner.
async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return {
    box,
    zoom,
    panX: (box.width - PW * zoom) / 2,
    panY: (box.height - PH * zoom) / 2,
  };
}

async function sheetToClient(page, xIn, yIn) {
  const m = await sheetMetrics(page);
  return { x: m.box.x + m.panX + xIn * m.zoom, y: m.box.y + m.panY + yIn * m.zoom };
}

async function clickSheet(page, xIn, yIn) {
  const p = await sheetToClient(page, xIn, yIn);
  await page.mouse.click(p.x, p.y);
}

// Ink counter on the layout canvas: non-white pixels in a square around a
// sheet point — enough to tell a drawn plan from bare paper.
async function inkAround(page, xIn, yIn, radiusIn = 0.5) {
  const m = await sheetMetrics(page);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const data = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2),
    ).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, { cx: m.panX + xIn * m.zoom, cy: m.panY + yIn * m.zoom, r: radiusIn * m.zoom });
}

async function placeViewport(page, xIn, yIn) {
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
  await withLayoutSave(page, () => clickSheet(page, xIn, yIn));
}

test('without a saved drawing the sheet explains itself and places nothing', async ({ page }) => {
  await openLayout(page);
  await expect(page.getByText('Draw a house in the MODEL space first')).toBeVisible();
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
  await clickSheet(page, PW / 2, PH / 2);
  // The click disarms placement instead of minting an empty viewport…
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('Add Viewport');
  // …and nothing was written to the shared bucket.
  expect(await savedDrawing(page)).toBeNull();
});

test('a click places a plan viewport at the sheet point, at the active scale', async ({ page }) => {
  await openLayout(page, houseDrawing());
  // The busiest plan is the default level; its button reads engaged.
  await expect(page.locator('[data-layout-level="1"]')).toBeVisible();
  await placeViewport(page, 8, 5);
  const saved = await savedDrawing(page);
  expect(saved.layout.viewports).toHaveLength(1);
  const viewport = saved.layout.viewports[0];
  expect(viewport.kind).toBe('plan');
  expect(viewport.levelId).toBe(1);
  expect(viewport.pif).toBeCloseTo(1 / 4, 5); // the working plan scale is the default
  expect(viewport.xIn).toBeCloseTo(8, 1);
  expect(viewport.yIn).toBeCloseTo(5, 1);
  expect(saved.layout.nextViewportId).toBe(2);
  expect(saved.layout.paperKey).toBe('11x17');
  expect(saved.layout.orientation).toBe('landscape');
  // The plan itself is ink on the sheet, not just a frame.
  expect(await inkAround(page, 8, 5, 2)).toBeGreaterThan(50);
});

test('the engaged scale writes its pif onto the new viewport', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await page.getByRole('button', { name: '1/8" = 1\'-0"' }).click();
  await placeViewport(page, 6, 4);
  const saved = await savedDrawing(page);
  expect(saved.layout.viewports[0].pif).toBeCloseTo(1 / 8, 5);
});

test('dragging a viewport moves it in paper inches and persists the spot', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await placeViewport(page, 8, 5);
  const from = await sheetToClient(page, 8, 5);
  const to = await sheetToClient(page, 11, 6.5);
  await withLayoutSave(page, async () => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  });
  const saved = await savedDrawing(page);
  expect(saved.layout.viewports[0].xIn).toBeCloseTo(11, 1);
  expect(saved.layout.viewports[0].yIn).toBeCloseTo(6.5, 1);
});

test('Escape stands placement down; Delete removes the selected viewport', async ({ page }) => {
  await openLayout(page, houseDrawing());
  // Escape while armed: the next click selects nothing and places nothing.
  await page.locator('[data-layout-add-viewport]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('Add Viewport');
  await clickSheet(page, 4, 3);
  expect((await savedDrawing(page)).layout).toBeUndefined();
  // Place one, click it to select, Delete clears it from the sheet and the file.
  await placeViewport(page, 8, 5);
  await clickSheet(page, 8, 5);
  await withLayoutSave(page, () => page.keyboard.press('Delete'));
  expect((await savedDrawing(page)).layout.viewports).toHaveLength(0);
});

test('layout rides the drawing additively and survives a reload', async ({ page }) => {
  const seeded = houseDrawing();
  await openLayout(page, seeded);
  await placeViewport(page, 8, 5);
  // Additive: the model's own geometry rides through the layout write untouched.
  const saved = await savedDrawing(page);
  expect(saved.walls).toEqual(seeded.walls);
  expect(saved.levels).toEqual(seeded.levels);
  expect(saved.fenestrations).toEqual(seeded.fenestrations);
  // A fresh visit reads the sheet back: same viewport, same ink.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  expect(await inkAround(page, 8, 5, 2)).toBeGreaterThan(50);
  // And it is still the same live object: select + Delete works on the reload.
  await clickSheet(page, 8, 5);
  await withLayoutSave(page, () => page.keyboard.press('Delete'));
  expect((await savedDrawing(page)).layout.viewports).toHaveLength(0);
});

test('paper size and orientation persist onto the drawing', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await withLayoutSave(page, () => page.getByRole('button', { name: '8.5 × 11' }).click());
  await withLayoutSave(page, () => page.getByRole('button', { name: 'PORT', exact: true }).click());
  const saved = await savedDrawing(page);
  expect(saved.layout.paperKey).toBe('8.5x11');
  expect(saved.layout.orientation).toBe('portrait');
  // The sheet reads them back on reload.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await expect(page.getByText('8.5" × 11"')).toBeVisible();
});
