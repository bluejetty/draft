// LEVEL READINGS NEVER PRINT ON TOP OF EACH OTHER (audit, 27 Nov 2026): on
// the corner-garage house's E1, +10'-1 3/4" printed over +9'-1 1/8" and
// 0'-0" over -1'-0 5/8" -- levels a foot apart are about a reading's height
// apart at the fit. The lines stay on their levels; the figures spread.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'), 'utf8'));

const READING = /^[+-]?\d+'-\d/;

for (const view of ['E1']) {
  test(`corner-garage ${view}: every level reading has its own line of space`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 700 });
    await h.openModel(page, { webgl: false });
    await page.evaluate(async file => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
    }, HOUSE);
    await page.goto(`/MODEL.html?left=0&view=cut:${view}`);
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    const seen = await page.evaluate(async () => {
      const out = [];
      const real = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
        const m = this.getTransform();
        out.push({ text: String(text), x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f,
          px: parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]), align: this.textAlign });
        return real.call(this, text, x, y, ...rest);
      };
      paint();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      CanvasRenderingContext2D.prototype.fillText = real;
      return out;
    });
    // The readings down the left margin: right-aligned figures in one column.
    const marks = seen.filter(s => s.align === 'right' && (READING.test(s.text) || s.text === 'GRADE'));
    const column = Math.max(...marks.map(s => s.x));
    const left = marks.filter(s => Math.abs(s.x - column) < 1).sort((a, b) => a.y - b.y);
    expect(left.length).toBeGreaterThan(3);
    for (let i = 1; i < left.length; i += 1) {
      expect(left[i].y - left[i - 1].y, `${left[i - 1].text} / ${left[i].text}`)
        .toBeGreaterThanOrEqual(left[i].px);
    }
  });
}
