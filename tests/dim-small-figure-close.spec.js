// THE SMALL FIGURES STAY BY THEIR OWN LINE (jb, 27 Nov 2026, TIMBERHOUSE's
// main floor plan: "the SMALLER 5 1/2" 3 1/2" etc dimensions go too far up or
// too far down away from the dimension"). Every wall-thickness figure was
// stood a whole second row out, level with the next string, because it
// overflows its run. It now sits on the close row, right off its own line,
// and steps out only when a figure already drawn is in its way (the 25 Nov
// case, tests/dim-overflow-row.spec.js).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-jb-timberhouse-notches.draft'), 'utf8'));

test('TIMBERHOUSE main floor: a 3 1/2" figure sits just off its own string, not level with the next one', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async file => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, HOUSE);
  await page.goto('/MODEL.html?left=1&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const rows = await page.evaluate(async () => {
    const seen = [];
    const real = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      const m = this.getTransform();
      seen.push({ text: String(text), x: m.e, y: m.f, vertical: Math.abs(m.b) > Math.abs(m.a) });
      return real.call(this, text, x, y, ...rest);
    };
    view.scale *= 2.2; view.cz -= 4; view.cx -= 6;
    paint();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    CanvasRenderingContext2D.prototype.fillText = real;
    return { seen, t: dimensionEnv().textScale };
  });
  const across = rows.seen.filter(s => !s.vertical);
  // The string along the back wall: 5'-1 1/4", 5'-4", 11'-8 1/2" sit ON their
  // line; the 3 1/2" partitions between them overflow their runs.
  const onLine = across.find(s => s.text === '5\'-4"');
  const outer = across.find(s => s.text === '40\'-6"');
  expect(onLine).toBeTruthy();
  expect(outer).toBeTruthy();
  const small = across.filter(s => s.text === '0\'-3 1/2"' && Math.abs(s.y - onLine.y) < 40 * rows.t);
  expect(small.length).toBeGreaterThan(0);
  small.forEach(s => {
    // The close row: 10 x the text scale off its line (render-2d), not 26.
    expect(Math.abs(s.y - onLine.y)).toBeLessThanOrEqual(11 * rows.t);
    // And nearer its own line than the next string's, not level with it.
    expect(Math.abs(s.y - onLine.y)).toBeLessThan(Math.abs(s.y - outer.y));
  });
});
