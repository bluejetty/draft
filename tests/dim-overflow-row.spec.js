// A FIGURE THAT STILL DOES NOT FIT STEPS OUT A SECOND ROW (jb, 25 Nov 2026,
// the ROOF plan zoomed right in: a 15/16" piece beside a 1'-11 3/8" one, and
// "the dim label overlaps huge"). Zoomed in that far both figures step down
// and outboard to the same row; the short piece's figure is many times wider
// than its own run and lay across its neighbour's. It now stands one plate
// further out, clear of the row the fitting figures use.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const V = (x, z) => ({ x, y: 0, z });
const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [
    { id: 'l-1', start: V(-4, 0), end: V(4, 0), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
  ],
  outlines: [], floors: [], roofs: [], fenestrations: [],
  dimensions: [
    { id: 1, start: V(0, 1), end: V(23.375 / 12, 1), levelId: 3, view: 'plan', layer: 'A-DIMS-HAND', auto: false },
    { id: 2, start: V(23.375 / 12, 1), end: V(24.3125 / 12, 1), levelId: 3, view: 'plan', layer: 'A-DIMS-HAND', auto: false },
  ],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  levelLocks: [], underlays: [], nextDimensionId: 3,
};

test('zoomed right in, a short piece\'s figure stands on its own row, clear of its neighbour\'s', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async file => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, FIXTURE);
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const rows = await page.evaluate(async () => {
    const seen = [];
    const real = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      const m = this.getTransform();
      seen.push({ text: String(text), x: m.e, y: m.f, w: this.measureText(text).width });
      return real.call(this, text, x, y, ...rest);
    };
    view.scale = 175; view.cx = 1; view.cz = 1;
    paint();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    CanvasRenderingContext2D.prototype.fillText = real;
    return { seen, t: dimensionEnv().textScale };
  });
  const long = rows.seen.find(s => s.text.startsWith('1\'-11'));
  const short = rows.seen.find(s => s.text.includes('15/16'));
  expect(long).toBeTruthy();
  expect(short).toBeTruthy();
  // The two plates are 15 x the text scale tall: rows that far apart, or more,
  // cannot overlap however wide the figures are.
  expect(Math.abs(short.y - long.y)).toBeGreaterThanOrEqual(15 * rows.t);
});
