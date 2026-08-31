// Two fingers pan and pinch (the deferred gesture board).
//
// The iPad could draw (the pointer migration) and had buttons to navigate
// (the polish sweep). This is the fast path on top of them: two fingers move
// the view the way a native app does. The on-screen cluster stays — it is the
// discoverable path and the mouse user's path.
//
// The gestures are driven through CDP's touch pipeline, two touch points at a
// time, and the results are checked NUMERICALLY — the world point under the
// finger midpoint has to still be under it after a pinch, which is not
// something you can eyeball.
//
// HOW THE VIEW IS MEASURED: the app keeps no test hook, so these specs read
// the camera the way a drafter would — draw a line between two fixed SCREEN
// points and read back the world coordinates it committed. Feet-per-pixel and
// the world point under any pixel both fall out of that.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.use({ hasTouch: true });

// A line committed between two raw client points, read back in world feet.
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

// Two fingers, moved together through a list of frames.
async function twoFinger(page, frames) {
  const client = await page.context().newCDPSession(page);
  const send = (type, points) => client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })),
  });
  await send('touchStart', [frames[0][0]]);
  await send('touchStart', frames[0]);
  for (let i = 1; i < frames.length; i++) await send('touchMove', frames[i]);
  await send('touchEnd', [frames[frames.length - 1][0]]);
  await send('touchEnd', []);
  await client.detach();
  await page.waitForTimeout(150);
}

async function canvasBox(page) {
  return page.locator('[data-model-canvas]').boundingBox();
}

test('two fingers pan the view', async ({ page }) => {
  await h.openModel(page);
  const box = await canvasBox(page);
  const midY = box.y + box.height / 2;
  const left = box.x + box.width / 2 - 100;
  const right = box.x + box.width / 2 + 100;

  const before = await probe(page, left, midY - 70, right, midY - 70);
  const feetPerPx = before.spanX / 200;

  // Both fingers travel 140px left, together: a pure pan, no spread change.
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const frames = [];
  for (let i = 0; i <= 7; i++) {
    const dx = -140 * (i / 7);
    frames.push([{ x: cx - 60 + dx, y: cy }, { x: cx + 60 + dx, y: cy }]);
  }
  await twoFinger(page, frames);

  const after = await probe(page, left, midY - 70, right, midY - 70);
  // Dragging the sheet left walks the camera right, so the same screen point
  // now sits further along +x — by roughly the drag, in feet.
  const moved = after.start.x - before.start.x;
  expect(moved).toBeGreaterThan(140 * feetPerPx * 0.6);
  // And the scale is untouched: a pan must not zoom.
  expect(Math.abs(after.spanX - before.spanX)).toBeLessThan(before.spanX * 0.05);
});

test('a pinch zooms, and the world point under the midpoint stays there', async ({ page }) => {
  await h.openModel(page);
  const box = await canvasBox(page);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  // What is under the midpoint before the pinch? Probe a line that STARTS
  // there, so its start point is exactly that world position.
  const before = await probe(page, cx, cy, cx + 200, cy);
  const spanBefore = before.spanX;

  // Fingers spread from 60px apart to 240px about a FIXED midpoint: pure
  // zoom in, no pan.
  const frames = [];
  for (let i = 0; i <= 8; i++) {
    const half = 30 + (120 - 30) * (i / 8);
    frames.push([{ x: cx - half, y: cy }, { x: cx + half, y: cy }]);
  }
  await twoFinger(page, frames);

  const after = await probe(page, cx, cy, cx + 200, cy);
  // Zoomed IN: the same 200px of screen covers fewer feet.
  expect(after.spanX).toBeLessThan(spanBefore * 0.8);
  // ANCHORED: the world point under the midpoint did not move. The tolerance
  // is a fraction of what 200px covers, so it scales with the zoom.
  expect(Math.abs(after.start.x - before.start.x)).toBeLessThan(spanBefore * 0.12);
  expect(Math.abs(after.start.z - before.start.z)).toBeLessThan(spanBefore * 0.12);
});

test('a second finger mid-draw cancels the line and commits nothing', async ({ page }) => {
  await h.openModel(page);
  const box = await canvasBox(page);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  // One finger starts a wall run — a point is down and the chain is live.
  await h.selectTool(page, 'Wall');
  const first = await h.worldToClient(page, -6, -4);
  await page.touchscreen.tap(first.x, first.y);
  await page.waitForTimeout(300);
  await expect(page.locator('[data-finish-chain]')).toBeVisible();

  // The classic save: the drafter actually wanted to move the view.
  const frames = [];
  for (let i = 0; i <= 6; i++) {
    const dx = -90 * (i / 6);
    frames.push([{ x: cx - 60 + dx, y: cy }, { x: cx + 60 + dx, y: cy }]);
  }
  await twoFinger(page, frames);

  // The run is gone, and nothing was committed by it.
  await expect(page.locator('[data-finish-chain]')).toHaveCount(0);
  const saved = await h.savedDrawing(page);
  expect(h.allWalls(saved || {})).toHaveLength(0);
  expect(h.allLines(saved || {})).toHaveLength(0);
});

test('lifting to one finger does not resume drawing mid-gesture', async ({ page }) => {
  await h.openModel(page);
  const box = await canvasBox(page);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await h.selectTool(page, 'Wall');

  const client = await page.context().newCDPSession(page);
  const send = (type, points) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })),
  });
  await send('touchStart', [{ x: cx - 60, y: cy }]);
  await send('touchStart', [{ x: cx - 60, y: cy }, { x: cx + 60, y: cy }]);
  await send('touchMove', [{ x: cx - 90, y: cy }, { x: cx + 30, y: cy }]);
  // Second finger up; the first stays down and keeps moving.
  await send('touchEnd', [{ x: cx - 90, y: cy }]);
  await send('touchMove', [{ x: cx - 140, y: cy + 60 }]);
  await send('touchEnd', []);
  await client.detach();
  await page.waitForTimeout(250);

  // That trailing finger drew nothing: the gesture owned the whole sequence
  // until the last finger lifted.
  const saved = await h.savedDrawing(page);
  expect(h.allWalls(saved || {})).toHaveLength(0);
  expect(h.allLines(saved || {})).toHaveLength(0);
});

test('a mouse press plus a stray finger never becomes a gesture', async ({ page }) => {
  await h.openModel(page);
  const box = await canvasBox(page);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  // Mouse down on the canvas with the Wall tool, then a finger lands too.
  await h.selectTool(page, 'Wall');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: cx + 80, y: cy + 40, id: 9 }],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await page.mouse.up();
  await page.waitForTimeout(200);

  // The mouse press still behaved as a press: the wall run is live, which it
  // would not be if the finger had promoted this into a view gesture and
  // discarded it.
  await expect(page.locator('[data-finish-chain]')).toBeVisible();
});

test('the on-screen cluster still works with gestures installed', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-zoom-in]').tap();
  await page.locator('[data-hand-toggle]').tap();
  await expect(page.locator('[data-hand-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-hand-toggle]')).toHaveAttribute('aria-pressed', 'false');
});
