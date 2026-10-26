// NO WORDS IN A LEVEL'S SEAT (Movie, 26 Oct: "the MAIN FL layout looks like
// there is a bunch of text but its all jumbled, just show the main wall
// outlines" -- "no text"). The LEVELS rail's thumbnails -- plans and
// elevations -- draw their lines and write nothing: room names, areas, tags,
// level marks and dimension figures were a smear at that size.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BUNGALOW = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));

test('a level seat draws its walls and writes no text', async ({ page }) => {
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    for (const name of ['fillText', 'strokeText']) {
      const real = proto[name];
      proto[name] = function (...args) {
        const seat = this.canvas?.closest?.('#view-rail .seat');
        if (seat) (window.__seatText ||= []).push(seat.dataset.seat);
        return real.apply(this, args);
      };
    }
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: BUNGALOW });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#view-rail')).toBeVisible();
  await page.waitForTimeout(800);
  // The main canvas still writes its words.
  expect(await page.evaluate(() => document.querySelectorAll('#view-rail .seat[data-seat="3:plan"] canvas').length)).toBe(1);
  const ink = await page.evaluate(() => {
    const c = document.querySelector('#view-rail .seat[data-seat="3:plan"] canvas');
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n += 1;
    return n;
  });
  expect(ink, 'the seat still draws the plan').toBeGreaterThan(200);
  expect(await page.evaluate(() => [...new Set(window.__seatText || [])]), 'no words in a seat').toEqual([]);
});
