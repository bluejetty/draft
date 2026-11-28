// FOUR SMALL DRAWING ITEMS FROM THE 27 NOV 2026 AUDIT, on TIMBERHOUSE
// (proto/repro-jb-timberhouse-notches.draft), fixed together (jb, 28 Nov:
// "sure why not"):
//
//   1. The empty section seat beside S2 said "+ CUT S2" and its press made S1.
//   2. The ROOF plan opened at the 6 px/ft fallback round the world origin.
//   3. LAYOUT's foot line said 1/4" = 1'-0" on the site sheet whose title
//      block says 1" = 10'.
//   4. The elevation's title was written under the top bar (SETTINGS).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const drawing = () => JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-jb-timberhouse-notches.draft'), 'utf8'));

test.use({ viewport: { width: 1280, height: 720 } });

test('an empty section seat is named for the cut its press will make', async ({ page }) => {
  await h.openEditor(page, { drawing: drawing(), url: '/MODEL.html?left=1&right=1&level=3' });
  // One stored section, called S2, so it takes the first seat and the
  // spare seat is the second one.
  await expect(page.locator('[data-seat="S1"]')).toContainText('S2');
  const spare = page.locator('[data-seat="S2"]');
  await expect(spare).toContainText('+ CUT');
  await expect(spare).toContainText('S1');
  await expect(spare).not.toContainText('S2');
  // And the name + CUT mints is that same name.
  expect(await page.evaluate(() => freeSectionNames(1)[0])).toBe('S1');
});

test('the ROOF plan opens framed on its roofs, not at the fallback zoom', async ({ page }) => {
  await h.openEditor(page, { drawing: drawing(), url: '/MODEL.html?left=1&right=1&level=7' });
  const got = await page.evaluate(() => {
    const pts = roofs().flatMap(r => r.points || []);
    const xs = pts.map(p => p.x);
    return { view: { ...view }, mid: (Math.min(...xs) + Math.max(...xs)) / 2 };
  });
  // The fallback is exactly scale 6 at 0,0. TIMBERHOUSE's floors open at
  // about 13 px/ft; the roof plan should be in that neighbourhood.
  expect(got.view.scale).toBeGreaterThan(10);
  expect(got.view.cx).toBeCloseTo(got.mid, 1);
});

test('LAYOUT\'s foot line names the site sheet\'s own scale', async ({ page }) => {
  await h.openEditor(page, { drawing: drawing(), url: '/MODEL.html?level=3' });
  await page.goto('/LAYOUT.html');
  const readout = page.locator('[data-sheet-readout]');
  await expect(readout).toContainText('1" = 10\'', { timeout: 10000 });
  await expect(readout).not.toContainText('1/4"');
});

test('the elevation title is written clear of the top bar and the left rail', async ({ page }) => {
  await page.addInitScript(() => {
    const was = CanvasRenderingContext2D.prototype.fillText;
    window.__titles = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      if (/GENERATED ELEVATION/.test(String(text))) window.__titles.push({ x, y, w: this.canvas.width });
      return was.call(this, text, x, y, ...rest);
    };
  });
  await h.openEditor(page, { drawing: drawing(), url: '/MODEL.html?left=1&right=1&view=cut:E1' });
  await page.waitForFunction(() => window.__titles.length > 0);
  const got = await page.evaluate(() => {
    const main = document.querySelector('#plan');
    const at = window.__titles.filter(t => t.w === main.width).pop();
    const strip = document.querySelector('#strip').getBoundingClientRect();
    const rail = document.querySelector('#left-rail').getBoundingClientRect();
    const box = main.getBoundingClientRect();
    return { at, stripBottom: strip.bottom - box.top, railRight: rail.right - box.left };
  });
  expect(got.at).toBeTruthy();
  expect(got.at.y).toBeGreaterThanOrEqual(got.stripBottom);
  expect(got.at.x).toBeGreaterThanOrEqual(got.railRight);
});
