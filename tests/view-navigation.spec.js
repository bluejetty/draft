// Navigating the drawing without a wheel or a middle button (board #304).
//
// The pointer migration made the iPad able to DRAW; it could not move the
// view. Zoom was `wheel` only and pan was middle-drag or alt-drag, and a
// touchscreen has none of those. ZOOM IN / ZOOM OUT / FIT and a HAND mode put
// navigation on the strip, where a thumb reaches it and nothing covers the
// drawing. They work the same with a mouse — a desk feature that happens to
// save the tablet.
//
// HOW THIS MEASURES ZOOM. The app keeps no test hook, so the specs read the
// camera the way a drafter would: they draw a line between two fixed SCREEN
// points and read back the world coordinates it committed. Feet-per-pixel
// falls out of that, and it is the only honest way to prove the view moved.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A line committed between two raw client points, returned in world feet.
// Raw client coordinates on purpose: helpers' worldToClient assumes the
// default zoom, which is the very thing under test here.
async function probe(page, x1, y1, x2, y2) {
  await h.selectTool(page, 'Line');
  for (const [cx, cy] of [[x1, y1], [x2, y2]]) {
    await page.evaluate(({ cx, cy }) => {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      const canvas = document.querySelector('[data-model-canvas]');
      const opts = {
        bubbles: true, cancelable: true, view: window,
        clientX: cx, clientY: cy, button: 0, pointerId: 1, isPrimary: true,
      };
      canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, buttons: 0 }));
      canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, buttons: 1 }));
      window.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }));
    }, { cx, cy });
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const lines = h.allLines(await h.savedDrawing(page));
  const last = lines[lines.length - 1];
  return { start: last.start, end: last.end, spanX: Math.abs(last.end.x - last.start.x) };
}

async function canvasBox(page) {
  return page.locator('[data-model-canvas]').boundingBox();
}

test('ZOOM IN and ZOOM OUT move the view by the wheel\'s own step', async ({ page }) => {
  await h.openModel(page);
  const box = await canvasBox(page);
  const midY = box.y + box.height / 2;
  const left = box.x + box.width / 2 - 100;
  const right = box.x + box.width / 2 + 100;

  // 200px of screen covers this many feet at the default zoom.
  const atDefault = await probe(page, left, midY - 60, right, midY - 60);
  expect(atDefault.spanX).toBeGreaterThan(0);

  await page.locator('[data-zoom-in]').click();
  await page.locator('[data-zoom-in]').click();
  await page.locator('[data-zoom-in]').click();
  const zoomedIn = await probe(page, left, midY, right, midY);
  // Zoomed in, the same 200px of screen covers FEWER feet.
  expect(zoomedIn.spanX).toBeLessThan(atDefault.spanX * 0.95);

  await page.locator('[data-zoom-out]').click();
  await page.locator('[data-zoom-out]').click();
  await page.locator('[data-zoom-out]').click();
  const backOut = await probe(page, left, midY + 60, right, midY + 60);
  // Three steps out undoes three steps in: 0.88 and 1.14 are near-inverses,
  // so this lands back within a couple of percent, not exactly.
  expect(Math.abs(backOut.spanX - atDefault.spanX)).toBeLessThan(atDefault.spanX * 0.08);
});

test('FIT frames the drawing, however far in the view was', async ({ page }) => {
  await h.openModel(page);
  // A wall run 40' across, then zoom right in so it no longer fits.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -20, -8);
  await h.clickWorld(page, 20, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  for (let i = 0; i < 6; i++) await page.locator('[data-zoom-in]').click();

  const box = await canvasBox(page);
  const midY = box.y + box.height / 2;
  const zoomed = await probe(page, box.x + 40, midY, box.x + box.width - 40, midY);
  // Deep in: the full canvas width no longer spans the 40' house.
  expect(zoomed.spanX).toBeLessThan(40);

  await page.locator('[data-zoom-fit]').click();
  await page.waitForTimeout(200);
  const fitted = await probe(page, box.x + 40, midY - 40, box.x + box.width - 40, midY - 40);
  // Framed: the canvas now spans the whole 40' drawing, with the margin FIT
  // adds — and not absurdly more than that.
  expect(fitted.spanX).toBeGreaterThan(40);
  expect(fitted.spanX).toBeLessThan(40 * 3);
});

test('FIT on an empty level says so instead of doing nothing', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-zoom-fit]').click();
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/nothing to fit/i);
});

test('HAND pans with a plain drag, and releases on Escape', async ({ page }) => {
  await h.openModel(page);
  const box = await canvasBox(page);
  const midY = box.y + box.height / 2;
  const left = box.x + box.width / 2 - 100;
  const right = box.x + box.width / 2 + 100;

  const before = await probe(page, left, midY - 60, right, midY - 60);
  const feetPerPx = before.spanX / 200;

  await page.locator('[data-hand-toggle]').click();
  await expect(page.locator('[data-hand-toggle]')).toHaveAttribute('aria-pressed', 'true');
  // A plain left drag: no middle button, no Alt — the gesture a finger has.
  await page.mouse.move(box.x + box.width / 2, midY);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 150, midY, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  // The HAND is still up, so the drag panned instead of drawing: nothing new
  // was committed by that press.
  const savedMid = await h.savedDrawing(page);
  expect(h.allLines(savedMid)).toHaveLength(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-hand-toggle]')).toHaveAttribute('aria-pressed', 'false');

  const after = await probe(page, left, midY - 60, right, midY - 60);
  // Dragging the sheet 150px to the LEFT walks the camera 150px to the right,
  // so the same screen point now sits that much further along +x.
  const moved = after.start.x - before.start.x;
  expect(moved).toBeGreaterThan(150 * feetPerPx * 0.6);
});

test('a finger works the view keys and the HAND', async ({ page, browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 900 } });
  const touchPage = await context.newPage();
  await h.openModel(touchPage);
  await touchPage.locator('[data-zoom-in]').tap();
  await touchPage.locator('[data-zoom-out]').tap();
  await touchPage.locator('[data-hand-toggle]').tap();
  await expect(touchPage.locator('[data-hand-toggle]')).toHaveAttribute('aria-pressed', 'true');

  // One finger, dragging: the pan an iPad has no other way to perform.
  const box = await touchPage.locator('[data-model-canvas]').boundingBox();
  const client = await context.newCDPSession(touchPage);
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const touch = (type, pt) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: pt.x, y: pt.y, id: 1 }],
  });
  await touch('touchStart', from);
  for (let i = 1; i <= 6; i++) await touch('touchMove', { x: from.x - i * 20, y: from.y });
  await touch('touchEnd', { x: from.x - 120, y: from.y });
  await client.detach();
  await touchPage.waitForTimeout(200);

  // Nothing was drawn by that drag — the HAND owned it.
  const saved = await touchPage.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, h.STORAGE_BUCKET);
  expect((saved?.lines || []).length + (saved?.walls || []).length).toBe(0);
  await context.close();
});

test('FINISH appears only during a run, and commits the same as Enter', async ({ page }) => {
  await h.openModel(page);
  // Nothing in progress: no dead chrome on the strip.
  await expect(page.locator('[data-finish-chain]')).toHaveCount(0);

  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -6, -4);
  await h.clickWorld(page, 6, -4);
  await expect(page.locator('[data-finish-chain]')).toBeVisible();

  await page.locator('[data-finish-chain]').click();
  await h.waitForSaved(page);
  const walls = h.allWalls(await h.savedDrawing(page));
  expect(walls).toHaveLength(1);
  expect(h.touchesPoint(walls[0], -6, -4)).toBe(true);
  expect(h.touchesPoint(walls[0], 6, -4)).toBe(true);
  // The run is over, so the control stands down again.
  await expect(page.locator('[data-finish-chain]')).toHaveCount(0);
});

test('a finger finishes an outline with FINISH — no keyboard anywhere', async ({ page, browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 900 } });
  const touchPage = await context.newPage();
  await h.openModel(touchPage);
  await h.selectTool(touchPage, 'Outline');
  for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) {
    const p = await h.worldToClient(touchPage, x, z);
    await touchPage.touchscreen.tap(p.x, p.y);
    await touchPage.waitForTimeout(400);
  }
  await touchPage.locator('[data-finish-chain]').tap();
  await h.waitForSaved(touchPage);

  const saved = await touchPage.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, h.STORAGE_BUCKET);
  const master = (saved.boneyardOutlines || []).find(outline => !outline.garage);
  expect(master, 'the outline closed from a tap on FINISH').toBeTruthy();
  expect(master.points).toHaveLength(4);
  await context.close();
});
