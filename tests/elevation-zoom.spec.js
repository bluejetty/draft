// ZOOM AND PAN ON AN ELEVATION.
//
// Movie, 23 Oct, looking at the end of a roof on E2 he could not get close
// to: *"it looks like there is something wrong at the end of the roof but i
// can't zoom in on elevations. once a user goes to elevation can it be zoomed
// out fill like it is now, but once the user is in the elevation can they
// zoom in to look at details they'l like to see closer"*.
//
// An elevation opens at the painter's own fit, as before. The wheel then
// zooms about the cursor, a right-button drag pans, and 0 brings the fit
// back -- the plan's own gestures, on the painter's frame rather than the
// plan's view. The frame MODEL hands to `window.__elevFrame` is the one the
// painter drew in, so every claim here is arithmetic on it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-clipped-gable.draft'), 'utf8'));
const PLATE = 8.09375;

async function openE3(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?theme=rough&mode=day&level=3&view=cut%3AE3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForFunction(() => !!window.__elevFrame);
  await page.waitForTimeout(400);
}
const frame = page => page.evaluate(() => {
  const f = window.__elevFrame;
  const r = document.getElementById('plan').getBoundingClientRect();
  return { x0: f.x0, y0: f.y0, pxPerFt: f.pxPerFt, uMin: f.uMin, yTop: f.yTop, marginL: f.marginL, left: r.left, top: r.top, w: r.width, h: r.height };
});
const feetAt = (f, x, y) => ({ u: f.uMin + (x - f.x0) / f.pxPerFt, e: f.yTop - (y - f.y0) / f.pxPerFt });

test('the wheel zooms the elevation about the cursor, and 0 brings the fit back', async ({ page }) => {
  await openE3(page);
  const fit = await frame(page);
  // A point on the house: the gable wall, a third of the way across.
  const x = fit.x0 + (30 - fit.uMin) * fit.pxPerFt, y = fit.y0 + (fit.yTop - 4) * fit.pxPerFt;
  const before = feetAt(fit, x, y);
  await page.mouse.move(fit.left + x, fit.top + y);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(300);
  const zoomed = await frame(page);
  expect(zoomed.pxPerFt, 'zoomed in').toBeGreaterThan(fit.pxPerFt * 1.4);
  const after = feetAt(zoomed, x, y);
  // Within two pixels at the zoomed scale: the painter puts its lines on
  // half-pixel centres, so a frame can land a pixel off where it was asked.
  const slack = 2 / zoomed.pxPerFt;
  expect(Math.abs(after.u - before.u), 'the foot under the cursor stays put (u)').toBeLessThan(slack);
  expect(Math.abs(after.e - before.e), 'the foot under the cursor stays put (e)').toBeLessThan(slack);
  // And the level readings are still on the page: the plate's rule reaches
  // into the gutter, zoomed as it did fitted (a pinned pass used to drop
  // its margins, and the readings with them).
  // The reading sits right-aligned 22px inside the painter's left margin
  // (cut-view.js SCREEN_MARGINS), which the frame hands back; a box over
  // the reading's last characters, on the rule's row.
  const gutterInk = await page.evaluate(([x, y]) => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const d = c.getContext('2d').getImageData(Math.round(x * sx) - 3, Math.round(y * sy) - 5, 7, 11).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 180) dark += 1;
    return dark;
  }, [zoomed.marginL - 26, zoomed.y0 + (zoomed.yTop - PLATE) * zoomed.pxPerFt]);
  expect(gutterInk, 'the plate\'s reading or its rule in the gutter while zoomed').toBeGreaterThan(0);
  // 0 TO FIT.
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
  const back = await frame(page);
  expect(Math.abs(back.pxPerFt - fit.pxPerFt)).toBeLessThan(1e-6);
  expect(Math.abs(back.x0 - fit.x0)).toBeLessThan(1e-6);
});

test('a right-button drag pans the elevation, and zooming out stops at half the fit', async ({ page }) => {
  await openE3(page);
  const fit = await frame(page);
  const x = fit.left + fit.w / 2, y = fit.top + fit.h / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 60, y + 25, { steps: 4 });
  await page.mouse.move(x + 120, y + 50, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(300);
  const panned = await frame(page);
  expect(Math.abs(panned.x0 - (fit.x0 + 120)), `x0 moved ${(panned.x0 - fit.x0).toFixed(1)}px for a 120px drag`).toBeLessThan(2);
  expect(Math.abs(panned.y0 - (fit.y0 + 50)), `y0 moved ${(panned.y0 - fit.y0).toFixed(1)}px for a 50px drag`).toBeLessThan(2);
  expect(Math.abs(panned.pxPerFt - fit.pxPerFt), 'a pan does not zoom').toBeLessThan(1e-6);
  // OUT, AND OUT AGAIN: never below half the fit.
  await page.mouse.move(x, y);
  for (let i = 0; i < 12; i += 1) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  const out = await frame(page);
  expect(out.pxPerFt, 'zoomed out').toBeLessThan(fit.pxPerFt * 0.8);
  expect(out.pxPerFt, 'but not below half the fit').toBeGreaterThanOrEqual(fit.pxPerFt * 0.5 - 1e-6);
});
