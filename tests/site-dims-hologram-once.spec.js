// THE SITE'S TWO DIMENSION ROWS ARE DRAWN ONCE, HOLOGRAM OR NOT.
//
// jb, 10 Nov 2026, the SITE level on MODEL: "how come there are 2 dims that
// show? on the construction plan it looks good only one shows". Every figure
// of the setback rows stood twice, the second set a row's width in from the
// first. The second set was the HOLOGRAM'S: a shelf saved as a suite or a
// hologram carries the file's lot and footprint, and the hologram pass
// hands the SITE level to drawSitePlan, which laid the source file's own
// rows again -- at the default 1" = 30' rather than the DIM SCALE, so they
// did not even land on the first set. A hologram draws no dimensions on any
// other level (drawLevelMarks, drawPlan's dimensionEnv); now the site rows
// follow that rule too.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
const rect = (hx, hz, extra) => ({
  closed: true,
  points: [{ x: hx, y: 0, z: -hz }, { x: -hx, y: 0, z: -hz }, { x: -hx, y: 0, z: hz }, { x: hx, y: 0, z: hz }],
  ...extra,
});
const base = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [rect(25, 37.5, { id: 'lot', site: true, levelId: SITE }), rect(20, 15, { id: 'house', levelId: 3 })],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [], holograms: [],
});
// THE SAME FILE AGAIN, as a shelf save brings it: its lot and footprint come
// with it, laid exactly where this file's stand.
const withHologram = mode => {
  const d = base();
  const source = { ...base(), outlines: [...d.outlines, rect(5, 5, { id: 'shed', levelId: 3,
    points: [{ x: 40, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, { x: 50, y: 0, z: 10 }, { x: 40, y: 0, z: 10 }] })] };
  d.holograms = [{ id: 'hologram-1', name: 'DUPLEX', x: 0, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0,
    ...(mode ? { mode } : {}), source }];
  return d;
};

async function openOnSite(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, d }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, d: drawing });
  await page.goto(`/MODEL.html?level=${SITE}&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// HOW MANY TIMES EACH FIGURE REACHES THE CANVAS in one paint: the lot's two
// outer figures and the inner row's setbacks, by the text drawn.
const figuresPainted = page => page.evaluate(() => {
  const counts = {};
  const proto = CanvasRenderingContext2D.prototype;
  const was = proto.fillText;
  proto.fillText = function (text, ...rest) {
    const t = String(text).trim();
    if (/^\d+'-\d+/.test(t)) counts[t] = (counts[t] || 0) + 1;
    return was.call(this, text, ...rest);
  };
  // A fresh paint, not the pictures the last one kept (hologram.js
  // picturesFor keys on the model epoch).
  try { bumpModelEpoch(); paint(); } finally { proto.fillText = was; }
  return counts;
});

for (const [label, mode] of [['a suite', 'suite'], ['a hologram', null]]) {
  test(`${label} of this file on the SITE does not draw the setback rows a second time`, async ({ page }) => {
    await openOnSite(page, withHologram(mode));
    const counts = await figuresPainted(page);
    // The rows are there once: the lot front to back and side to side, and
    // the house's 22'-6" and 5'-0" setbacks (each setback twice, the two
    // sides of the house).
    expect(counts["75'-0\""], JSON.stringify(counts)).toBe(1);
    expect(counts["50'-0\""], JSON.stringify(counts)).toBe(1);
    expect(counts["22'-6\""], JSON.stringify(counts)).toBe(2);
    expect(counts["5'-0\""], JSON.stringify(counts)).toBe(2);
  });
}

test('without a hologram the rows are drawn once, as before', async ({ page }) => {
  await openOnSite(page, base());
  const counts = await figuresPainted(page);
  expect(counts["75'-0\""], JSON.stringify(counts)).toBe(1);
  expect(counts["50'-0\""], JSON.stringify(counts)).toBe(1);
});
