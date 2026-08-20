// Lifecycle / performance behaviour: frames are drawn on demand, and hover
// indicators do not survive the pointer leaving the canvas.
const { test, expect } = require('@playwright/test');
const { openModel, moveTo, selectTool, clickWorld } = require('./helpers');

// Counts overlay clears, which happen once per painted frame in _redrawOverlay().
async function countFrames(page) {
  await page.addInitScript(() => {
    window.__overlayFrames = 0;
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas && this.canvas.hasAttribute('data-model-overlay')) window.__overlayFrames += 1;
      return clearRect.apply(this, args);
    };
  });
}

async function frames(page) {
  return page.evaluate(() => window.__overlayFrames);
}

test('the overlay stops repainting while the drawing is idle', async ({ page }) => {
  await countFrames(page);
  await openModel(page);

  const settled = await frames(page);
  await page.waitForTimeout(1000);
  const idle = await frames(page);

  // A 60 FPS loop would add ~60 frames per idle second.
  expect(idle - settled).toBeLessThan(5);
});

test('input repaints the overlay again', async ({ page }) => {
  await countFrames(page);
  await openModel(page);
  await page.waitForTimeout(600);

  const before = await frames(page);
  await moveTo(page, 4, 4);
  await moveTo(page, 8, 6);
  await page.waitForTimeout(300);

  expect(await frames(page)).toBeGreaterThan(before);
});

test('leaving the canvas clears the cursor and snap indicators', async ({ page }) => {
  await openModel(page);
  await selectTool(page, 'Line');
  await clickWorld(page, 0, 0);
  await moveTo(page, 10, 0);
  await moveTo(page, 0.1, 0.1); // near the first point: magnet indicator shows

  const box = await page.locator('[data-model-canvas]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y - 30);
  await page.waitForTimeout(200);

  const displays = await page.evaluate(() => {
    const shown = sel => getComputedStyle(document.querySelector(sel)).display;
    return {
      magnet:  shown('[data-model-magnet]'),
      midSnap: shown('[data-model-midsnap]'),
    };
  });
  expect(displays.magnet).toBe('none');
  expect(displays.midSnap).toBe('none');
});
