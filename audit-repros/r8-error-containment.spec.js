// Checklist 13: throw inside the render pass and see what the drafter gets.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R8: an exception in the 2D paint leaves the canvas half-drawn with no error boundary', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 120)); });
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-14, -10], [14, -10], [14, 10], [-14, 10], [-14, -10]]) await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const before = (await h.savedDrawing(page)).walls.length;

  // Break one painter the plan uses on every frame.
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const real = proto.fillText;
    window.__paintCalls = 0;
    proto.fillText = function (...args) {
      window.__paintCalls++;
      throw new Error('audit: simulated paint failure');
    };
    window.__restorePaint = () => { proto.fillText = real; };
  });
  // Force a repaint (any pointer move invalidates).
  await h.moveTo(page, 0, 0);
  await page.waitForTimeout(1500);
  const paintCalls = await page.evaluate(() => window.__paintCalls);
  console.log('paint attempts after the break:', paintCalls, '| errors seen:', errors.length);
  console.log('first error:', errors[0]);

  // Is anything on screen? Count non-background pixels on the overlay.
  const inkAfter = await page.evaluate(() => {
    const c = document.querySelector('[data-model-overlay]');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) ink++;
    return ink;
  });
  console.log('overlay pixels drawn while broken:', inkAfter);

  // Can the drafter still work and still save?
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -25, -25);
  await h.clickWorld(page, -25, -20);
  await page.keyboard.press('Enter');
  let saved = null;
  try { await h.waitForSaved(page); saved = 'saved'; } catch (e) { saved = 'SAVE WAIT FAILED'; }
  const after = await h.savedDrawing(page);
  console.log('save queue:', saved, '| lines now:', (after.lines || []).length, '| walls still', after.walls.length, 'was', before);
  // Any visible warning to the user?
  const msg = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('status bar says:', JSON.stringify((msg || '').trim()));
});
