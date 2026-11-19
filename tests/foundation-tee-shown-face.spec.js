// A WALL TEED INTO A STOCK 8" CONC + 2X6 BSMT WALL MEETS ITS CONCRETE.
//
// jb, 19 Nov 2026, on the FOUNDATION plan of the stepped-front house, with
// the foundation walls run out past the front at the step: "when i added
// the T in the foundation it cut out some of the wall". The stock type
// (wall-types.js wt_stock_conc8_bsmt) is 14" thick but shows only its 8" of
// concrete on FOUNDATION; the 1/2" air and 5 1/2" studs are hidden there and
// keep their room. render-2d's tee join stopped the stem at the host's FULL
// face, the hidden lining's, so 6" of the stem's concrete was missing where
// it met the host -- a white gap in the hatched wall.
//
// render-2d wallMetrics now gives shownFirst / shownLast, the faces this plan
// draws, and the tee join stops the stem there (and the host's face line
// opens across the stem at that same face).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const STOCK = 'wt_stock_conc8_bsmt';
const W = (id, levelId, a, b, view, wallType, extra = {}) => ({ id,
  start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view, wallType, baseHeight: 0, topHeight: 8, refLine: 'left', ...extra });
// jb's house: 19'-6" deep, the front (z 0) stepped back a foot for its last
// 6'-6"; on FOUNDATION the step wall runs on 2 ft past the front (fin), so
// the front wall tees into it at the step corner.
const ring = (lv, view, type, extra) => [
  W(`w${lv}a`, lv, [0, 0], [0, -41.5], view, type, extra), W(`w${lv}b`, lv, [0, -41.5], [19.5, -41.5], view, type, extra),
  W(`w${lv}c`, lv, [19.5, -41.5], [19.5, -1], view, type, extra), W(`w${lv}d`, lv, [19.5, -1], [13, -1], view, type, extra),
  W(`w${lv}e`, lv, [13, -1], [13, 0], view, type, extra), W(`w${lv}f`, lv, [13, 0], [0, 0], view, type, extra)];
const drawing = type => {
  const fx = { baseHeight: -8, topHeight: 0, ...(type === STOCK ? { widthIn: 14 } : {}) };
  return {
    version: 1, planTurn: 0, buildType: 'twoStorey', autoRoof: false,
    levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 }, { id: 5, name: '2ND FL', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
    activeLevelIdx: 4, nextDrawingItemId: 50,
    walls: [...ring(3, 'plan', 'stud_2x6'), ...ring(1, 'foundation', type, fx),
      W('fin', 1, [13, 0], [13, 2], 'foundation', type, fx)],
    lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [],
    notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
    roofs: [], fixtures: [],
  };
};
async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, { f });
  await page.goto('/MODEL.html?left=1&right=1&level=1&view=foundation');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  // In close on the step corner, so 6" is many pixels.
  const { at } = await h.planFrame(page);
  await page.mouse.move(...at(12.5, -0.5));
  for (let i = 0; i < 5; i += 1) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); }
  await page.waitForTimeout(250);
}
// The brightest pixel in a 5x5 patch: the concrete's grey fill shows through
// its hatch lines; the night plan behind it is near black.
const brightAt = async (page, x, z) => {
  const { at } = await h.planFrame(page);
  const [sx, sy] = at(x, z);
  return page.evaluate(([px, py]) => {
    const c = document.querySelector('#plan');
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((px - r.left) * k) - 2, Math.round((py - r.top) * k) - 2, 5, 5).data;
    let best = 0;
    for (let i = 0; i < d.length; i += 4) best = Math.max(best, (d[i] + d[i + 1] + d[i + 2]) / 3);
    return best;
  }, [sx, sy]);
};

for (const type of [STOCK, 'concrete_8']) {
  test(`FOUNDATION: the front wall's concrete runs to the step wall's concrete (${type})`, async ({ page }) => {
    await open(page, drawing(type));
    // The front wall's concrete is z 0 to -8" (refLine left, body toward -z);
    // the step wall's concrete is x 13 to 12'-4". The 6" of the step wall's
    // hidden lining (x 12'-4" to 11'-10") is where the gap was.
    for (const x of [11.95, 12.1, 12.25]) {
      expect(await brightAt(page, x, -0.33), `x ${x}`).toBeGreaterThan(120);
    }
    // And the stem's concrete is not painted past the host's: the step wall's
    // own concrete is there (bright), and on beyond it, outside, nothing.
    expect(await brightAt(page, 12.66, -0.33)).toBeGreaterThan(120);
    expect(await brightAt(page, 13.4, -0.33)).toBeLessThan(90);
  });
}
